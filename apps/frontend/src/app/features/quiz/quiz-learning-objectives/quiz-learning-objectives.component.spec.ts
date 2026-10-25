import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizStoreService } from '../data/quiz-store.service';
import { getDemoQuizPayload } from '../data/demo-quiz-payload';
import { LearningObjectiveDerivationClient } from './learning-objective-derivation.client';
import {
  QuizLearningObjectivesComponent,
  mapQuestionForLearningObjectiveDerivation,
} from './quiz-learning-objectives.component';

const prepareDerivationMock = vi.fn();
const runDerivationMock = vi.fn();

describe('QuizLearningObjectivesComponent', () => {
  beforeEach(() => {
    prepareDerivationMock.mockReset();
    runDerivationMock.mockReset();
    prepareDerivationMock.mockImplementation(async (input) => ({
      ...input,
      capability: 'a'.repeat(43),
      expiresAt: '2026-10-05T12:05:00.000Z',
    }));
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [QuizLearningObjectivesComponent],
      providers: [
        provideRouter([]),
        {
          provide: LearningObjectiveDerivationClient,
          useValue: {
            prepare: prepareDerivationMock,
            derive: runDerivationMock,
          },
        },
      ],
    });
  });

  it('legt ein manuelles Ziel mit explizitem Aufgabenbereich an und bearbeitet es CAS-geschützt', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Ziele' });
    const question = store.addQuestion(quiz.id, {
      text: 'Was ist Vererbung?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM' as const,
      answers: [
        { text: 'Ein OOP-Konzept', isCorrect: true },
        { text: 'Ein Netzwerkprotokoll', isCorrect: false },
      ],
    });
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [question]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.beginAdd();
    component.setText('Vererbung erklären');
    component.setScopeKind('question-set');
    component.toggleQuestion(question.id, true);
    component.setConfirmationState('confirmed');
    component.save();

    const created = store.getLearningObjectiveBundle(quiz.id).objectives[0]!;
    expect(created).toEqual(
      expect.objectContaining({
        text: 'Vererbung erklären',
        scope: { kind: 'question-set', sourceQuestionIds: [question.id] },
        confirmation: expect.objectContaining({ state: 'confirmed' }),
      }),
    );

    component.beginEdit(created);
    component.setText('Vererbung anhand eines Beispiels erklären');
    component.save();
    expect(store.getLearningObjectiveBundle(quiz.id).objectives[0]).toEqual(
      expect.objectContaining({
        text: 'Vererbung anhand eines Beispiels erklären',
        revision: created.revision + 1,
      }),
    );
  });

  it('fokussiert bei leerem Aufgabenbereich eine sichtbare Bereichsoption', async () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Fokus' });
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', []);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.beginAdd();
    component.setText('Ein Ziel');
    component.setScopeKind('question-set');
    fixture.detectChanges();

    component.save();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.errorMessage()).toContain('mindestens eine Frage');
    const scopeOption = document.getElementById('learning-objective-scope-all');
    expect(scopeOption?.contains(document.activeElement)).toBe(true);
  });

  it('stellt nach dem Löschen den Fokus auf die weiterhin sichtbare Hinzufügen-Aktion', async () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Löschen' });
    const objective = store.saveQuizLearningObjective(quiz.id, {
      text: 'Zu löschendes Ziel',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', []);
    fixture.detectChanges();

    fixture.componentInstance.confirmDelete(objective);
    fixture.detectChanges();
    await Promise.resolve();

    expect(store.getLearningObjectiveBundle(quiz.id).objectives).toEqual([]);
    expect(document.activeElement?.id).toBe('learning-objective-add');
  });

  it('stellt nach Abbruch den Fokus auf die erneut sichtbare Hinzufügen-Aktion', async () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Abbruchfokus' });
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', []);
    fixture.detectChanges();

    fixture.componentInstance.beginAdd();
    fixture.detectChanges();
    fixture.componentInstance.cancelEdit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement?.id).toBe('learning-objective-add');
  });

  it('überschreibt keine neuere Store-Revision, die während des Bearbeitens ankommt', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'CAS-Konflikt' });
    const original = store.saveQuizLearningObjective(quiz.id, {
      text: 'Ursprung',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', []);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.beginEdit(original);
    component.setText('Staler Formulartext');

    store.saveQuizLearningObjective(
      quiz.id,
      {
        text: 'Neuer Remote-Stand',
        scope: { kind: 'quiz-wide' },
        confirmationState: 'draft',
      },
      { objectiveId: original.id, expectedRevision: original.revision },
    );
    component.save();

    expect(store.getLearningObjectiveBundle(quiz.id).objectives[0]?.text).toBe(
      'Neuer Remote-Stand',
    );
    expect(component.errorMessage()).toContain('inzwischen geändert');
    expect(component.formOpen()).toBe(true);
  });

  it('bestätigt kein Ziel mit einem gelöschten Aufgabenverweis', async () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Fehlender Verweis' });
    const question = store.addQuestion(quiz.id, {
      text: 'Vergängliche Aufgabe?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    store.saveQuizLearningObjective(quiz.id, {
      text: 'Aufgabe verstehen',
      scope: { kind: 'question-set', sourceQuestionIds: [question.id] },
      confirmationState: 'confirmed',
    });
    store.deleteQuestion(quiz.id, question.id);
    const stale = store.getLearningObjectiveBundle(quiz.id).objectives[0]!;
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', []);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.beginEdit(stale);
    component.setConfirmationState('confirmed');
    fixture.detectChanges();

    component.save();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.errorMessage()).toContain('fehlendem Fragenverweis');
    expect(document.activeElement?.id).toBe(`learning-objective-remove-missing-${question.id}`);
    expect(store.getLearningObjectiveBundle(quiz.id).objectives[0]?.confirmation.state).toBe(
      'needs-review',
    );
  });

  it('verhindert die 101. Aufgabenreferenz mit einer verständlichen Meldung', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Referenzlimit' });
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', []);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.beginAdd();

    for (let index = 0; index < 101; index += 1) {
      component.toggleQuestion(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, true);
    }

    expect(component.selectedQuestionIds().size).toBe(100);
    expect(component.errorMessage()).toContain('Höchstens 100');
  });

  it('rendert Aufgaben-Markdown kompakt und ohne verschachtelte Interaktionen', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Markdown-Auswahl' });
    const question = store.addQuestion(quiz.id, {
      text: '### **Vererbung** mit [Quelle](https://example.org)\n\n![Skizze](https://example.org/a.png)',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM' as const,
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [question]);
    fixture.detectChanges();
    fixture.componentInstance.beginAdd();
    fixture.componentInstance.setScopeKind('question-set');
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector(
      '.learning-objectives__question-text',
    ) as HTMLElement;
    expect(preview.querySelector('strong')?.textContent).toBe('Vererbung');
    expect(preview.textContent).toContain('Quelle');
    expect(preview.textContent).toContain('Skizze');
    expect(preview.textContent).not.toContain('###');
    expect(preview.querySelector('a, img, button')).toBeNull();
  });

  it('erklärt manuelle und automatisch aus Aufgaben formulierte Lernziele', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Herkunftserklärung' });
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', []);
    fixture.detectChanges();

    const intro = fixture.nativeElement.querySelector(
      '.learning-objectives__origin-intro',
    ) as HTMLElement;
    expect(intro.textContent).toContain('Du kannst Lernziele selbst schreiben');
    expect(intro.textContent).toContain('automatisch aus deinen Fragen vorschlagen lassen');
    expect(intro.textContent).toContain('prüfst und bestätigst');
  });

  it('erklärt Entwurf und Bestätigt direkt an den Statusoptionen', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Statuserklärung' });
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', []);
    fixture.detectChanges();
    fixture.componentInstance.beginAdd();
    fixture.detectChanges();

    const statusGroup = fixture.nativeElement.querySelector(
      '[aria-label="Status des Lernziels"]',
    ) as HTMLElement;
    expect(statusGroup.textContent).toContain('Noch in Abstimmung');
    expect(statusGroup.textContent).toContain('zur Prüfung markiert');
  });

  it('startet die Herleitung nur per Klick, speichert Entwürfe und rendert ihr Markdown sicher', async () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Explizite Herleitung' });
    const question = store.addQuestion(quiz.id, {
      text: 'Was ist Vererbung?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM' as const,
      answers: [
        { text: 'Ein OOP-Konzept', isCorrect: true },
        { text: 'Ein Protokoll', isCorrect: false },
      ],
    });
    runDerivationMock.mockImplementation(
      async (input: { operationId: string; quizId: string; expectedBundleRevision: number }) => ({
        schemaVersion: 1,
        operationId: input.operationId,
        quizId: input.quizId,
        expectedBundleRevision: input.expectedBundleRevision,
        status: 'completed',
        drafts: [
          {
            id: '50000000-0000-4000-8000-000000000001',
            revision: 0,
            text: '**Vererbung** erklären [Quelle](https://example.org) ![Bild](https://example.org/x.png)\n\n```js\nalert(1)\n```\n<script>alert(2)</script>',
            scope: { kind: 'question-set', sourceQuestionIds: [question.id] },
            origin: {
              kind: 'model-derived',
              modelId: 'local-model',
              modelVersion: '1',
              derivationVersion: 'learning-objectives-v1' as const,
              derivedFromSourceQuestionIds: [question.id],
              sourceDigest: 'c'.repeat(64),
            },
            confirmation: { state: 'draft' },
            createdAt: '2026-10-05T12:00:00.000Z',
            updatedAt: '2026-10-05T12:00:00.000Z',
          },
        ],
        limitations: [],
        batchCount: 1,
      }),
    );
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    Object.defineProperty(fixture.componentInstance, 'maxObjectives', { value: 1 });
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [question]);
    fixture.detectChanges();

    expect(prepareDerivationMock).not.toHaveBeenCalled();
    expect(runDerivationMock).not.toHaveBeenCalled();

    const start = fixture.nativeElement.querySelector(
      '#learning-objective-derive',
    ) as HTMLButtonElement;
    start.click();
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(store.getLearningObjectiveBundle(quiz.id).objectives).toHaveLength(1),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(prepareDerivationMock).toHaveBeenCalledTimes(1);
    expect(runDerivationMock).toHaveBeenCalledTimes(1);
    expect(store.getLearningObjectiveBundle(quiz.id).objectives[0]).toEqual(
      expect.objectContaining({
        revision: 1,
        confirmation: { state: 'draft' },
        origin: expect.objectContaining({ kind: 'model-derived' }),
      }),
    );
    const rendered = fixture.nativeElement.querySelector(
      '.learning-objectives__text.markdown-body',
    ) as HTMLElement;
    expect(rendered.querySelector('strong')?.textContent).toBe('Vererbung');
    expect(rendered.querySelector('a, img, button, script, .markdown-code-block__copy')).toBeNull();
    expect(fixture.componentInstance.derivationMessage()).toBe(
      'Ein Lernzielvorschlag wurde als Entwurf hinzugefügt. Prüfe ihn vor dem Bestätigen.',
    );
    expect(start.disabled).toBe(true);
    expect(document.activeElement?.id).toBe(
      `learning-objective-edit-${store.getLearningObjectiveBundle(quiz.id).objectives[0]?.id}`,
    );
  });

  it('schreibt das Anfangswort gespeicherter KI-Lernziele groß', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Großschreibung' });
    const question = store.addQuestion(quiz.id, {
      text: 'Was ist eine Regression?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM' as const,
      answers: [
        { text: 'Ein Modell', isCorrect: true },
        { text: 'Ein Diagramm', isCorrect: false },
      ],
    });
    store.applyDerivedLearningObjectiveDrafts(
      quiz.id,
      store.getLearningObjectiveBundle(quiz.id).revision,
      '50000000-0000-4000-8000-0000000000bb',
      [
        derivedDraft(
          '50000000-0000-4000-8000-000000000021',
          question.id,
          'lineare Regressionsmodelle anwenden',
        ),
      ],
    );
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [question]);
    fixture.detectChanges();

    const rendered = fixture.nativeElement.querySelector(
      '.learning-objectives__text.markdown-body',
    ) as HTMLElement;
    expect(rendered.textContent).toContain('Lineare Regressionsmodelle anwenden.');
    expect(store.getLearningObjectiveBundle(quiz.id).objectives[0]?.text).toBe(
      'lineare Regressionsmodelle anwenden',
    );
  });

  it('nennt mehrere neue Entwürfe klar und zeigt ohne Einschränkung keine Hinweisliste', async () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Mehrere Vorschläge' });
    const question = store.addQuestion(quiz.id, {
      text: 'Welche Antwort stimmt?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    runDerivationMock.mockImplementation(
      async (input: { operationId: string; quizId: string; expectedBundleRevision: number }) => ({
        schemaVersion: 1,
        operationId: input.operationId,
        quizId: input.quizId,
        expectedBundleRevision: input.expectedBundleRevision,
        status: 'completed',
        drafts: [1, 2].map((index) => ({
          id: `50000000-0000-4000-8000-00000000000${index}`,
          revision: 0,
          text: `Lernziel ${index}`,
          scope: { kind: 'question-set', sourceQuestionIds: [question.id] },
          origin: {
            kind: 'model-derived',
            modelId: 'local-model',
            modelVersion: '1',
            derivationVersion: 'learning-objectives-v1' as const,
            derivedFromSourceQuestionIds: [question.id],
            sourceDigest: 'c'.repeat(64),
          },
          confirmation: { state: 'draft' },
          createdAt: '2026-10-05T12:00:00.000Z',
          updatedAt: '2026-10-05T12:00:00.000Z',
        })),
        limitations: [],
        batchCount: 1,
      }),
    );
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [question]);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('#learning-objective-derive') as HTMLButtonElement
    ).click();
    await vi.waitFor(() =>
      expect(store.getLearningObjectiveBundle(quiz.id).objectives).toHaveLength(2),
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.derivationMessage()).toBe(
      '2 Lernzielvorschläge wurden als Entwürfe hinzugefügt. Prüfe sie vor dem Bestätigen.',
    );
    expect(
      fixture.nativeElement.querySelector('.learning-objectives__derivation-status ul'),
    ).toBeNull();
  });

  it('zeigt Auslastung als manuellen Retry und startet nicht selbst erneut', async () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Auslastung' });
    const question = store.addQuestion(quiz.id, {
      text: 'Welche Aussage stimmt?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    runDerivationMock.mockImplementation(
      async (input: { operationId: string; quizId: string; expectedBundleRevision: number }) => ({
        schemaVersion: 1,
        operationId: input.operationId,
        quizId: input.quizId,
        expectedBundleRevision: input.expectedBundleRevision,
        status: 'busy',
        retry: 'manual',
      }),
    );
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [question]);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('#learning-objective-derive') as HTMLButtonElement
    ).click();
    await vi.waitFor(() => expect(fixture.componentInstance.derivationStatus()).toBe('busy'));
    fixture.detectChanges();
    await fixture.whenStable();

    const retry = fixture.nativeElement.querySelector(
      '#learning-objective-derive',
    ) as HTMLButtonElement;
    expect(retry.textContent).toContain('Nochmal versuchen');
    expect(runDerivationMock).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(runDerivationMock).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.id).toBe('learning-objective-derive');

    retry.click();
    await vi.waitFor(() => expect(runDerivationMock).toHaveBeenCalledTimes(2));
  });

  it('fordert bei 99 bestehenden Zielen deterministisch höchstens einen weiteren Entwurf an', async () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Restkapazität' });
    const question = store.addQuestion(quiz.id, {
      text: 'Letzte Kapazität?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'Ein Platz', isCorrect: true },
        { text: 'Unbegrenzt', isCorrect: false },
      ],
    });
    for (let index = 0; index < 99; index += 1) {
      store.saveQuizLearningObjective(quiz.id, {
        text: `Bestehendes Ziel ${index + 1}`,
        scope: { kind: 'quiz-wide' },
        confirmationState: index === 0 ? 'confirmed' : 'draft',
      });
    }
    const firstObjective = store.getLearningObjectiveBundle(quiz.id).objectives[0]!;
    runDerivationMock.mockImplementation(
      async (input: {
        operationId: string;
        quizId: string;
        expectedBundleRevision: number;
        maximumDrafts: number;
      }) => {
        expect(input.maximumDrafts).toBe(1);
        return {
          schemaVersion: 1,
          operationId: input.operationId,
          quizId: input.quizId,
          expectedBundleRevision: input.expectedBundleRevision,
          status: 'completed',
          drafts: [
            {
              id: '51000000-0000-4000-8000-000000000001',
              revision: 0,
              text: 'Der letzte freie Vorschlag',
              scope: { kind: 'question-set', sourceQuestionIds: [question.id] },
              origin: {
                kind: 'model-derived',
                modelId: 'local-model',
                modelVersion: '1',
                derivationVersion: 'learning-objectives-v1' as const,
                derivedFromSourceQuestionIds: [question.id],
                sourceDigest: 'f'.repeat(64),
              },
              confirmation: { state: 'draft' },
              createdAt: '2026-10-05T12:00:00.000Z',
              updatedAt: '2026-10-05T12:00:00.000Z',
            },
          ],
          limitations: ['Die Ausgabe wurde auf den letzten freien Platz begrenzt.'],
          batchCount: 1,
        };
      },
    );
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [question]);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('#learning-objective-derive') as HTMLButtonElement
    ).click();
    await vi.waitFor(() =>
      expect(store.getLearningObjectiveBundle(quiz.id).objectives).toHaveLength(100),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.getLearningObjectiveBundle(quiz.id).objectives[0]).toEqual(firstObjective);
    expect(fixture.componentInstance.derivationLimitations()).toContain(
      'Die Ausgabe wurde auf den letzten freien Platz begrenzt.',
    );
    expect(
      (fixture.nativeElement.querySelector('#learning-objective-derive') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(document.activeElement?.id).toBe(
      'learning-objective-edit-51000000-0000-4000-8000-000000000001',
    );
  });

  it('bricht sichtbar ab und ignoriert ein danach eintreffendes Ergebnis', async () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Abbruch' });
    const question = store.addQuestion(quiz.id, {
      text: 'Abbrechbare Aufgabe?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'Ja', isCorrect: true },
        { text: 'Nein', isCorrect: false },
      ],
    });
    let resolveRun!: (value: Record<string, unknown>) => void;
    const received = { signal: null as AbortSignal | null };
    runDerivationMock.mockImplementation(
      (_input: unknown, signal: AbortSignal) =>
        new Promise<Record<string, unknown>>((resolve) => {
          received.signal = signal;
          resolveRun = resolve;
        }),
    );
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [question]);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('#learning-objective-derive') as HTMLButtonElement
    ).click();
    await vi.waitFor(() => expect(runDerivationMock).toHaveBeenCalledTimes(1));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('learning-objective-derive-cancel');
    (
      fixture.nativeElement.querySelector('#learning-objective-derive-cancel') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(received.signal?.aborted).toBe(true);
    expect(fixture.componentInstance.derivationStatus()).toBe('aborted');

    const input = runDerivationMock.mock.calls[0]?.[0] as {
      operationId: string;
      quizId: string;
      expectedBundleRevision: number;
    };
    resolveRun({
      schemaVersion: 1,
      operationId: input.operationId,
      quizId: input.quizId,
      expectedBundleRevision: input.expectedBundleRevision,
      status: 'completed',
      drafts: [],
      limitations: [],
      batchCount: 1,
    });
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.getLearningObjectiveBundle(quiz.id).objectives).toEqual([]);
    expect(fixture.componentInstance.derivationStatus()).toBe('aborted');
    expect(document.activeElement?.id).toBe('learning-objective-derive');
  });

  it('verwirft ein spätes Ergebnis, wenn sich die referenzierte Aufgabenlösung geändert hat', async () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Quellen-Race' });
    const question = store.addQuestion(quiz.id, {
      text: 'Was ist richtig?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'Alt', isCorrect: true },
        { text: 'Falsch', isCorrect: false },
      ],
    });
    let resolveRun!: (value: Record<string, unknown>) => void;
    runDerivationMock.mockImplementation(
      () =>
        new Promise<Record<string, unknown>>((resolve) => {
          resolveRun = resolve;
        }),
    );
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [question]);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('#learning-objective-derive') as HTMLButtonElement
    ).click();
    await vi.waitFor(() => expect(runDerivationMock).toHaveBeenCalledTimes(1));
    store.updateQuestion(quiz.id, question.id, {
      text: question.text,
      type: question.type,
      difficulty: question.difficulty,
      timer: question.timer,
      answers: [
        { text: 'Alt', isCorrect: false },
        { text: 'Jetzt richtig', isCorrect: true },
      ],
    });
    fixture.componentRef.setInput('questions', store.getQuizById(quiz.id)!.questions);
    fixture.detectChanges();

    const input = runDerivationMock.mock.calls[0]?.[0] as {
      operationId: string;
      quizId: string;
      expectedBundleRevision: number;
    };
    resolveRun({
      schemaVersion: 1,
      operationId: input.operationId,
      quizId: input.quizId,
      expectedBundleRevision: input.expectedBundleRevision,
      status: 'completed',
      drafts: [
        {
          id: '60000000-0000-4000-8000-000000000001',
          revision: 0,
          text: 'Alte Lösung erklären',
          scope: { kind: 'question-set', sourceQuestionIds: [question.id] },
          origin: {
            kind: 'model-derived',
            modelId: 'local-model',
            modelVersion: '1',
            derivationVersion: 'learning-objectives-v1' as const,
            derivedFromSourceQuestionIds: [question.id],
            sourceDigest: 'd'.repeat(64),
          },
          confirmation: { state: 'draft' },
          createdAt: '2026-10-05T12:00:00.000Z',
          updatedAt: '2026-10-05T12:00:00.000Z',
        },
      ],
      limitations: [],
      batchCount: 1,
    });
    await vi.waitFor(() =>
      expect(fixture.componentInstance.derivationStatus()).toBe('unavailable'),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.getLearningObjectiveBundle(quiz.id).objectives).toEqual([]);
    expect(fixture.componentInstance.derivationMessage()).toContain('während');
    expect(document.activeElement?.id).toBe('learning-objective-derive');
  });

  it('mappt strukturierte Lösungen vollständig in den Shared-Derivationsvertrag', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Strukturierte Lösung' });
    const question = store.addQuestion(quiz.id, {
      text: 'Ordne Elemente zu',
      type: 'CATEGORIZATION',
      difficulty: 'HARD',
      answers: [],
      categories: [
        { id: '70000000-0000-4000-8000-000000000001', name: 'Kategorie A' },
        { id: '70000000-0000-4000-8000-000000000002', name: 'Kategorie B' },
      ],
      categorizationItems: [
        {
          id: '70000000-0000-4000-8000-000000000003',
          text: 'Element A',
          correctCategoryId: '70000000-0000-4000-8000-000000000001',
        },
        {
          id: '70000000-0000-4000-8000-000000000004',
          text: 'Element B',
          correctCategoryId: '70000000-0000-4000-8000-000000000001',
        },
        {
          id: '70000000-0000-4000-8000-000000000005',
          text: 'Element C',
          correctCategoryId: '70000000-0000-4000-8000-000000000002',
        },
        {
          id: '70000000-0000-4000-8000-000000000006',
          text: 'Element D',
          correctCategoryId: '70000000-0000-4000-8000-000000000002',
        },
      ],
      categorizationShuffleItems: false,
    });
    store.setQuestionEnabled(quiz.id, question.id, false);
    const disabled = store.getQuizById(quiz.id)!.questions[0]!;

    expect(mapQuestionForLearningObjectiveDerivation(disabled)).toEqual(
      expect.objectContaining({
        sourceQuestionId: question.id,
        enabled: false,
        categories: disabled.categories,
        categorizationItems: disabled.categorizationItems,
        categorizationShuffleItems: false,
      }),
    );
  });

  it('verwendet beim expliziten Lauf das kanonische deutsche Demo-Quiz als vollständige Quelle', async () => {
    const store = TestBed.inject(QuizStoreService);
    const demo = store.importQuiz(getDemoQuizPayload('de')).quiz;
    runDerivationMock.mockImplementation(
      async (input: { operationId: string; quizId: string; expectedBundleRevision: number }) => ({
        schemaVersion: 1,
        operationId: input.operationId,
        quizId: input.quizId,
        expectedBundleRevision: input.expectedBundleRevision,
        status: 'busy',
        retry: 'manual',
      }),
    );
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', demo.id);
    fixture.componentRef.setInput('questions', demo.questions);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('#learning-objective-derive') as HTMLButtonElement
    ).click();
    await vi.waitFor(() => expect(runDerivationMock).toHaveBeenCalledTimes(1));

    const sent = runDerivationMock.mock.calls[0]?.[0] as {
      quizId: string;
      questions: Array<{ sourceQuestionId: string; enabled: boolean; answers: unknown[] }>;
    };
    expect(sent.quizId).toBe(demo.id);
    expect(sent.questions).toHaveLength(demo.questions.length);
    expect(sent.questions.map(({ sourceQuestionId }) => sourceQuestionId)).toEqual(
      [...demo.questions]
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
        .map(({ id }) => id),
    );
    expect(sent.questions.some(({ enabled, answers }) => enabled && answers.length > 0)).toBe(true);
  });

  it('bietet Lernziele im eingeklappten Expansion-Panel an und blendet die KI-Herleitung ohne geeignete Frage aus', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Expansion & Sichtbarkeit' });
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', []);
    fixture.detectChanges();

    expect(fixture.componentInstance.panelExpanded()).toBe(false);
    expect(fixture.nativeElement.querySelector('#learning-objective-derive')).toBeNull();
    expect(fixture.nativeElement.querySelector('#learning-objective-add')).not.toBeNull();

    const surveyQuestion = store.addQuestion(quiz.id, {
      text: 'Was denkt ihr?',
      type: 'SURVEY',
      difficulty: 'EASY',
      answers: [
        { text: 'Option A', isCorrect: false },
        { text: 'Option B', isCorrect: false },
      ],
    });
    fixture.componentRef.setInput('questions', [surveyQuestion]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#learning-objective-derive')).toBeNull();

    const scoredQuestion = store.addQuestion(quiz.id, {
      text: 'Welche Aussage stimmt?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'Richtig', isCorrect: true },
        { text: 'Falsch', isCorrect: false },
      ],
    });
    fixture.componentRef.setInput('questions', [surveyQuestion, scoredQuestion]);
    fixture.detectChanges();
    const derive = fixture.nativeElement.querySelector(
      '#learning-objective-derive',
    ) as HTMLButtonElement;
    expect(derive).not.toBeNull();
    expect(derive.classList.contains('mat-mdc-outlined-button')).toBe(true);
    expect(derive.textContent).toContain('Automatisch aus Fragen formulieren');
  });

  it('zeigt bei fokussierter Frage nur deren Lernziele und ordnet neue Ziele dieser Frage zu', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Fragefokus' });
    const q1 = store.addQuestion(quiz.id, {
      text: 'Frage 1?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    const q2 = store.addQuestion(quiz.id, {
      text: 'Frage 2?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'C', isCorrect: true },
        { text: 'D', isCorrect: false },
      ],
    });
    store.saveQuizLearningObjective(quiz.id, {
      text: 'Quizweites Ziel',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'confirmed',
    });
    store.saveQuizLearningObjective(quiz.id, {
      text: 'Ziel zu Frage 1',
      scope: { kind: 'question-set', sourceQuestionIds: [q1.id] },
      confirmationState: 'confirmed',
    });
    store.saveQuizLearningObjective(quiz.id, {
      text: 'Ziel zu Frage 2',
      scope: { kind: 'question-set', sourceQuestionIds: [q2.id] },
      confirmationState: 'confirmed',
    });

    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [q1, q2]);
    fixture.componentRef.setInput('focusedQuestionId', q1.id);
    fixture.detectChanges();

    expect(fixture.componentInstance.objectives().map((o) => o.text)).toEqual(['Ziel zu Frage 1']);

    fixture.componentInstance.beginAdd();
    fixture.componentInstance.setText('Weiteres Ziel zu Frage 1');
    fixture.componentInstance.save();

    expect(fixture.componentInstance.objectives().map((o) => o.text)).toEqual([
      'Ziel zu Frage 1',
      'Weiteres Ziel zu Frage 1',
    ]);
  });

  it('bestätigt alle offenen KI-Vorschläge und lässt manuelle Entwürfe unverändert', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Sammelbestätigung' });
    const first = store.addQuestion(quiz.id, {
      text: 'Was ist ein Mittelwert?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'Ein Lagemaß', isCorrect: true },
        { text: 'Ein Diagramm', isCorrect: false },
      ],
    });
    const second = store.addQuestion(quiz.id, {
      text: 'Was ist eine Varianz?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM' as const,
      answers: [
        { text: 'Ein Streuungsmaß', isCorrect: true },
        { text: 'Ein Mittelwert', isCorrect: false },
      ],
    });
    store.applyDerivedLearningObjectiveDrafts(
      quiz.id,
      store.getLearningObjectiveBundle(quiz.id).revision,
      '50000000-0000-4000-8000-0000000000aa',
      [
        derivedDraft('50000000-0000-4000-8000-000000000011', first.id, 'Mittelwerte erklären'),
        derivedDraft('50000000-0000-4000-8000-000000000012', second.id, 'Streuung erklären'),
      ],
    );
    store.saveQuizLearningObjective(quiz.id, {
      text: 'Manuell formuliert',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });

    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [first, second]);
    fixture.detectChanges();

    const footer = fixture.nativeElement.querySelector(
      '.learning-objectives__footer-actions',
    ) as HTMLElement;
    const confirmAll = footer.querySelector('#learning-objective-confirm-all') as HTMLButtonElement;
    const add = footer.querySelector('#learning-objective-add') as HTMLButtonElement;
    expect(confirmAll.textContent).toContain('Alle Vorschläge bestätigen');
    expect(confirmAll.classList.contains('mat-mdc-unelevated-button')).toBe(false);
    expect(confirmAll.classList.contains('mat-mdc-outlined-button')).toBe(false);
    expect(confirmAll.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(add.classList.contains('mat-mdc-outlined-button')).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('mat-card-content') as HTMLElement).lastElementChild,
    ).toBe(footer);

    confirmAll.click();
    fixture.detectChanges();

    const objectives = store.getLearningObjectiveBundle(quiz.id).objectives;
    expect(
      objectives
        .filter((objective) => objective.origin.kind === 'model-derived')
        .map((objective) => objective.confirmation.state),
    ).toEqual(['confirmed', 'confirmed']);
    expect(
      objectives.find((objective) => objective.origin.kind === 'manual')?.confirmation.state,
    ).toBe('draft');
    expect(fixture.nativeElement.querySelector('#learning-objective-confirm-all')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Alle KI-Vorschläge wurden bestätigt.');
  });

  it('bestätigt nur KI-Vorschläge mit gültigen Fragenverweisen', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Teilbestätigung' });
    const kept = store.addQuestion(quiz.id, {
      text: 'Was bleibt?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    const removed = store.addQuestion(quiz.id, {
      text: 'Was fällt weg?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'C', isCorrect: true },
        { text: 'D', isCorrect: false },
      ],
    });
    store.applyDerivedLearningObjectiveDrafts(
      quiz.id,
      store.getLearningObjectiveBundle(quiz.id).revision,
      '50000000-0000-4000-8000-0000000000bb',
      [
        derivedDraft('50000000-0000-4000-8000-000000000021', kept.id, 'Bleibendes Ziel'),
        derivedDraft('50000000-0000-4000-8000-000000000022', removed.id, 'Verwaistes Ziel'),
      ],
    );
    store.deleteQuestion(quiz.id, removed.id);

    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [kept]);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('#learning-objective-confirm-all') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const objectives = store.getLearningObjectiveBundle(quiz.id).objectives;
    expect(
      objectives.find((objective) => objective.text === 'Bleibendes Ziel')?.confirmation.state,
    ).toBe('confirmed');
    expect(
      objectives.find((objective) => objective.text === 'Verwaistes Ziel')?.confirmation.state,
    ).toBe('needs-review');
    expect(fixture.nativeElement.textContent).toContain(
      'Ein KI-Vorschlag wurde bestätigt. Die übrigen bleiben offen.',
    );
  });

  it('meldet fehlgeschlagene Sammelbestätigung außerhalb des Formulars', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Sammelfehler' });
    const question = store.addQuestion(quiz.id, {
      text: 'Was ist ein Median?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'Ein Lagemaß', isCorrect: true },
        { text: 'Ein Diagramm', isCorrect: false },
      ],
    });
    store.applyDerivedLearningObjectiveDrafts(
      quiz.id,
      store.getLearningObjectiveBundle(quiz.id).revision,
      '50000000-0000-4000-8000-0000000000cc',
      [derivedDraft('50000000-0000-4000-8000-000000000031', question.id, 'Mediane erklären')],
    );
    const fixture = TestBed.createComponent(QuizLearningObjectivesComponent);
    fixture.componentRef.setInput('quizId', quiz.id);
    fixture.componentRef.setInput('questions', [question]);
    fixture.detectChanges();

    const saveSpy = vi.spyOn(store, 'saveQuizLearningObjective').mockImplementation(() => {
      throw new Error('Das Lernziel wurde inzwischen geändert.');
    });

    (
      fixture.nativeElement.querySelector('#learning-objective-confirm-all') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector(
      '#learning-objective-confirm-all-error',
    ) as HTMLElement | null;
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('Das Lernziel wurde inzwischen geändert.');
    expect(fixture.componentInstance.statusMessage()).toContain(
      'Das Lernziel wurde inzwischen geändert.',
    );
    expect(fixture.componentInstance.formOpen()).toBe(false);
    expect(store.getLearningObjectiveBundle(quiz.id).objectives[0]?.confirmation.state).toBe(
      'draft',
    );
    saveSpy.mockRestore();
  });
});

function derivedDraft(id: string, questionId: string, text: string) {
  return {
    id,
    revision: 0 as const,
    text,
    scope: { kind: 'question-set' as const, sourceQuestionIds: [questionId] },
    origin: {
      kind: 'model-derived' as const,
      modelId: 'local-model',
      modelVersion: '1',
      derivationVersion: 'learning-objectives-v1' as const,
      derivedFromSourceQuestionIds: [questionId],
      sourceDigest: 'c'.repeat(64),
    },
    confirmation: { state: 'draft' as const },
    createdAt: '2026-10-05T12:00:00.000Z',
    updatedAt: '2026-10-05T12:00:00.000Z',
  };
}
