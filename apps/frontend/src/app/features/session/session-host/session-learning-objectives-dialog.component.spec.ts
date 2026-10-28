import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionLearningObjectivesSnapshot } from '@arsnova/shared-types';
import {
  SessionLearningObjectivesDialogComponent,
  type SessionLearningObjectivesDialogData,
} from './session-learning-objectives-dialog.component';

const { getLearningObjectivesMock, saveLearningObjectivesMock, deriveLearningObjectivesMock } =
  vi.hoisted(() => ({
    getLearningObjectivesMock: vi.fn(),
    saveLearningObjectivesMock: vi.fn(),
    deriveLearningObjectivesMock: vi.fn(),
  }));

vi.mock('../../../core/trpc.client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/trpc.client')>();
  return {
    ...actual,
    trpc: new Proxy(actual.trpc, {
      get(target, property, receiver) {
        if (property === 'session') {
          return {
            ...Reflect.get(target, property, receiver),
            getLearningObjectives: { query: getLearningObjectivesMock },
            saveLearningObjectives: { mutate: saveLearningObjectivesMock },
            deriveLearningObjectives: { mutate: deriveLearningObjectivesMock },
          };
        }
        return Reflect.get(target, property, receiver);
      },
    }),
  };
});

const SESSION_ID = '818f0501-506f-4fda-9421-bcaaeaf936d1';
const OBJECTIVE_ID = 'e22e814a-15bc-477d-9424-61e8055e13c8';
const QA_QUESTION_ID = '99d342a9-80af-479f-ae09-21db068e65ea';

function snapshot(
  overrides: Partial<SessionLearningObjectivesSnapshot> = {},
): SessionLearningObjectivesSnapshot {
  return {
    schemaVersion: 1,
    sessionId: SESSION_ID,
    learningContextRevision: 2,
    configured: true,
    access: { state: 'writable' },
    availableQuizTasks: [],
    availableQaTasks: [
      {
        kind: 'qa-question',
        questionId: QA_QUESTION_ID,
        text: 'Wie hängt das zusammen?',
      },
    ],
    availableQaTasksTruncated: false,
    objectives: [],
    ...overrides,
  };
}

function existingObjective(text = 'Servertext') {
  return {
    id: OBJECTIVE_ID,
    revision: 3,
    text,
    scope: { kind: 'session' as const },
    origin: { kind: 'manual' as const },
    confirmation: { state: 'draft' as const },
    projection: 'session-manual' as const,
    purpose: 'learning-objective' as const,
    createdAt: '2026-10-04T10:00:00.000Z',
    updatedAt: '2026-10-04T10:00:00.000Z',
  };
}

function confirmedObjective(text = 'Servertext') {
  return {
    ...existingObjective(text),
    confirmation: {
      state: 'confirmed' as const,
      confirmedAt: '2026-10-04T10:00:00.000Z',
      confirmedRevision: 3,
    },
  };
}

describe('SessionLearningObjectivesDialogComponent', () => {
  const dialogRef = { close: vi.fn(), disableClose: false };
  const hasQuizMock = vi.fn(() => true);
  const modeMock = vi.fn<() => 'quiz' | 'qa'>(() => 'quiz');
  const focusedQuestionIdMock = vi.fn<() => string | null>(() => null);
  const data: SessionLearningObjectivesDialogData = {
    code: 'ABC123',
    hasQuiz: hasQuizMock,
    mode: modeMock,
    focusedQuestionId: focusedQuestionIdMock,
  };

  beforeEach(() => {
    getLearningObjectivesMock.mockReset();
    saveLearningObjectivesMock.mockReset();
    deriveLearningObjectivesMock.mockReset();
    hasQuizMock.mockReset();
    hasQuizMock.mockReturnValue(true);
    modeMock.mockReset();
    modeMock.mockReturnValue('quiz');
    focusedQuestionIdMock.mockReset();
    focusedQuestionIdMock.mockReturnValue(null);
    dialogRef.close.mockReset();
    dialogRef.disableClose = false;
    getLearningObjectivesMock.mockResolvedValue(snapshot());
    TestBed.configureTestingModule({
      imports: [SessionLearningObjectivesDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
  });

  async function createComponent() {
    const fixture = TestBed.createComponent(SessionLearningObjectivesDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('legt im Live-Quiz kein Lernziel an', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();
    component.setText('Zusammenhang erklären');
    await component.save();

    expect(component.formOpen()).toBe(false);
    expect(saveLearningObjectivesMock).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#session-learning-objective-add')).toBeNull();
    expect(fixture.nativeElement.querySelector('#session-learning-objective-derive')).toBeNull();
  });

  it('legt ohne Quizkanal kein Lernziel im Live-Dialog an', async () => {
    hasQuizMock.mockReturnValue(false);
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();
    component.setText('Q&A-Ziel');
    await component.save();

    expect(component.formOpen()).toBe(false);
    expect(saveLearningObjectivesMock).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Gesamtes Quiz');
  });

  it('lädt bei CONFLICT die autoritative Fassung und verhindert einen blinden zweiten Save', async () => {
    modeMock.mockReturnValue('qa');
    const initial = snapshot({ objectives: [existingObjective('Erster Stand')] });
    const latest = snapshot({
      learningContextRevision: 4,
      objectives: [{ ...existingObjective('Neuer anderer Host-Stand'), revision: 4 }],
    });
    getLearningObjectivesMock.mockResolvedValueOnce(initial).mockResolvedValueOnce(latest);
    saveLearningObjectivesMock.mockRejectedValueOnce({ data: { code: 'CONFLICT' } });
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginEdit(initial.objectives[0]!);
    component.setText('Mein staler Entwurf');

    await component.save();
    await component.save();

    expect(saveLearningObjectivesMock).toHaveBeenCalledTimes(1);
    expect(component.formOpen()).toBe(false);
    expect(component.snapshot()?.objectives[0]?.text).toBe('Neuer anderer Host-Stand');
    expect(component.conflictMessage()).toContain('Serverfassung');
  });

  it('sperrt weitere Schreibversuche, wenn der autoritative Refetch nach CONFLICT fehlschlägt', async () => {
    modeMock.mockReturnValue('qa');
    const initial = snapshot({ objectives: [existingObjective()] });
    getLearningObjectivesMock
      .mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error('offline'));
    saveLearningObjectivesMock.mockRejectedValueOnce({ data: { code: 'CONFLICT' } });
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginEdit(initial.objectives[0]!);
    component.setText('Nicht überschreiben');

    await component.save();
    await component.save();

    expect(component.authoritativeReloadRequired()).toBe(true);
    expect(component.conflictMessage()).toContain('gesperrt');
    expect(saveLearningObjectivesMock).toHaveBeenCalledTimes(1);
  });

  it('verhindert Escape-/Backdrop-Schließen während einer laufenden Mutation', async () => {
    modeMock.mockReturnValue('qa');
    let resolveSave!: (value: SessionLearningObjectivesSnapshot) => void;
    saveLearningObjectivesMock.mockImplementation(
      () =>
        new Promise<SessionLearningObjectivesSnapshot>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();
    component.setText('Asynchrones Ziel');

    const savePromise = component.save();
    expect(dialogRef.disableClose).toBe(true);
    component.close();
    expect(dialogRef.close).not.toHaveBeenCalled();
    resolveSave(snapshot({ learningContextRevision: 3 }));
    await savePromise;

    expect(dialogRef.disableClose).toBe(false);
  });

  it('zeigt vor einer Frage alle bestätigten Lernziele und keine Entwürfe', async () => {
    focusedQuestionIdMock.mockReturnValue(null);
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        objectives: [
          confirmedObjective('Bestätigtes Quizziel.'),
          existingObjective('Noch ein Entwurf.'),
          {
            ...confirmedObjective('Bestätigtes Frageziel.'),
            id: '22222222-2222-4222-8222-222222222222',
            scope: {
              kind: 'question-set',
              taskReferences: [
                {
                  kind: 'quiz-question',
                  questionId: 'eb4a99f8-8d86-41ef-960c-130f6d9a48e3',
                },
              ],
            },
          },
          {
            ...confirmedObjective('Forumsauftrag.'),
            id: '33333333-3333-4333-8333-333333333333',
            purpose: 'forum-assignment',
          },
        ],
      }),
    );

    const fixture = await createComponent();
    expect(
      fixture.componentInstance.visibleObjectives().map((objective) => objective.text),
    ).toEqual(['Bestätigtes Quizziel.', 'Bestätigtes Frageziel.']);
    expect(fixture.nativeElement.textContent).toContain('Bestätigtes Quizziel.');
    expect(fixture.nativeElement.textContent).toContain('Bestätigtes Frageziel.');
    expect(fixture.nativeElement.textContent).not.toContain('Noch ein Entwurf.');
    expect(fixture.nativeElement.textContent).not.toContain('Forumsauftrag.');
    expect(fixture.nativeElement.textContent).toContain('Lernziele');
    expect(fixture.nativeElement.querySelector('#session-learning-objective-add')).toBeNull();
  });

  it('stellt nach Abbruch den Fokus auf die erneut sichtbare Hinzufügen-Aktion', async () => {
    modeMock.mockReturnValue('qa');
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();
    fixture.detectChanges();

    component.cancelEdit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement?.id).toBe('session-learning-objective-add');
  });

  it('verhindert die 101. Live-Aufgabenreferenz', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();

    for (let index = 0; index < 101; index += 1) {
      component.toggleTask(
        {
          kind: 'qa-question',
          questionId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        },
        true,
      );
    }

    expect(component.selectedTaskKeys().size).toBe(100);
    expect(component.errorMessage()).toContain('Höchstens 100');
  });

  it('rendert Markdown in auswählbaren Live-Aufgaben ohne verschachtelte Interaktionen', async () => {
    const fixture = await createComponent();
    const rendered = fixture.componentInstance.renderTaskMarkdown(
      'Frage 1: ### **Ableitung** mit [Quelle](https://example.org)',
    ) as { changingThisBreaksApplicationSecurity?: string };
    const preview = document.createElement('div');
    preview.innerHTML = rendered.changingThisBreaksApplicationSecurity ?? '';
    expect(preview.querySelector('strong')?.textContent).toBe('Ableitung');
    expect(preview.textContent).toContain('Frage 1');
    expect(preview.textContent).not.toContain('###');
    expect(preview.querySelector('a, img, button')).toBeNull();
  });

  it('zeigt keine Frage-ID im Lernzieltext', async () => {
    const questionId = '8661c0ca-d575-4267-9499-fd0bfcf63521';
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        objectives: [
          confirmedObjective(
            `Order the steps of a secure web access setup according to question id ${questionId}.`,
          ),
        ],
      }),
    );
    const fixture = await createComponent();
    const rendered = fixture.nativeElement.querySelector(
      '.session-objectives__text.markdown-body',
    ) as HTMLElement;
    expect(rendered.textContent).toContain('Order the steps of a secure web access setup.');
    expect(fixture.nativeElement.textContent).not.toContain(questionId);
    expect(fixture.nativeElement.textContent).not.toContain('question id');
  });

  it('schreibt das Anfangswort eines Lernziels groß', async () => {
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        objectives: [confirmedObjective('lineare Modelle anwenden')],
      }),
    );
    const fixture = await createComponent();
    const rendered = fixture.nativeElement.querySelector(
      '.session-objectives__text.markdown-body',
    ) as HTMLElement;
    expect(rendered.textContent).toContain('Lineare Modelle anwenden.');
  });

  it('zeigt in einer beendeten Session keine überflüssige Nur-Lesen-Erklärung', async () => {
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        access: { reason: 'session-finished', state: 'read-only' },
        objectives: [confirmedObjective('Lineare Modelle anwenden.')],
      }),
    );
    const fixture = await createComponent();

    expect(fixture.nativeElement.textContent).toContain('Lineare Modelle anwenden.');
    expect(fixture.nativeElement.textContent).not.toContain('nur noch lesbar');
    expect(fixture.nativeElement.textContent).not.toContain('nicht mehr geändert');
    expect(
      fixture.nativeElement.querySelector('.session-objectives__audience-edit-btn'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('#session-learning-objective-add')).toBeNull();
  });

  it('erklärt automatische Vorschläge im Live-Quiz nicht', async () => {
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        availableQuizTasks: [
          {
            kind: 'quiz-question',
            questionId: 'eb4a99f8-8d86-41ef-960c-130f6d9a48e3',
            order: 0,
            text: 'Frage A',
            eligibleForDerivation: true,
          },
        ],
      }),
    );
    const fixture = await createComponent();
    expect(fixture.nativeElement.querySelector('.session-objectives__origin-intro')).toBeNull();
    expect(fixture.nativeElement.querySelector('#session-learning-objective-derive')).toBeNull();
  });

  it('blendet den Hinweis auf automatische Vorschläge aus, wenn zur Frage keine Herleitung möglich ist', async () => {
    const quizQuestionA = 'eb4a99f8-8d86-41ef-960c-130f6d9a48e3';
    focusedQuestionIdMock.mockReturnValue(quizQuestionA);
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        availableQuizTasks: [
          {
            kind: 'quiz-question',
            questionId: quizQuestionA,
            order: 0,
            text: 'Frage A',
            eligibleForDerivation: false,
          },
        ],
      }),
    );
    const fixture = await createComponent();
    fixture.componentInstance.beginAdd();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Lernziel zur Frage');
    expect(fixture.nativeElement.querySelector('#session-learning-objective-derive')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-objectives__origin-intro')).toBeNull();
  });

  it('bietet im Live-Quiz keine Entwurfs- oder Bestätigungsauswahl an', async () => {
    const fixture = await createComponent();
    fixture.componentInstance.beginAdd();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="Status des Lernziels"]')).toBeNull();
    expect(fixture.componentInstance.formOpen()).toBe(false);
  });

  it('zeigt bei vorhandenem Lernziel die publikumsfreundliche Darstellung ohne KI-Herleitung mit dezentem Bearbeiten-Icon', async () => {
    const quizQuestionA = 'eb4a99f8-8d86-41ef-960c-130f6d9a48e3';
    const quizQuestionB = 'fb4a99f8-8d86-41ef-960c-130f6d9a48e4';
    focusedQuestionIdMock.mockReturnValue(quizQuestionA);
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        availableQuizTasks: [
          {
            kind: 'quiz-question',
            questionId: quizQuestionA,
            order: 0,
            text: 'Frage A',
            eligibleForDerivation: true,
          },
          {
            kind: 'quiz-question',
            questionId: quizQuestionB,
            order: 1,
            text: 'Frage B',
            eligibleForDerivation: true,
          },
        ],
        objectives: [
          {
            ...confirmedObjective('Ziel für Frage A'),
            id: '11111111-1111-4111-8111-111111111111',
            scope: {
              kind: 'question-set',
              taskReferences: [{ kind: 'quiz-question', questionId: quizQuestionA }],
            },
          },
          {
            ...confirmedObjective('Ziel für Frage B'),
            id: '22222222-2222-4222-8222-222222222222',
            scope: {
              kind: 'question-set',
              taskReferences: [{ kind: 'quiz-question', questionId: quizQuestionB }],
            },
          },
        ],
      }),
    );

    const fixture = await createComponent();
    expect(fixture.componentInstance.objectives().map((o) => o.text)).toEqual(['Ziel für Frage A']);
    expect(fixture.nativeElement.querySelector('#session-learning-objective-derive')).toBeNull();
    expect(fixture.nativeElement.querySelector('#session-learning-objective-add')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.session-objectives__audience-edit-btn'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-objectives__origin-intro')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Lernziel zur Frage');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Kompetenzziel der aktuell gezeigten Frage',
    );
    expect(fixture.nativeElement.querySelector('.dialog-title-header__sub')).toBeNull();
  });

  it('zeigt Entwürfe im Live-Quiz nicht in der publikumsfreundlichen Darstellung', async () => {
    const quizQuestionA = 'eb4a99f8-8d86-41ef-960c-130f6d9a48e3';
    focusedQuestionIdMock.mockReturnValue(quizQuestionA);
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        availableQuizTasks: [
          {
            kind: 'quiz-question',
            questionId: quizQuestionA,
            order: 0,
            text: 'Frage A',
            eligibleForDerivation: true,
          },
        ],
        objectives: [
          {
            ...existingObjective('Ungeprüfter Entwurf zur Frage A'),
            id: '11111111-1111-4111-8111-111111111111',
            scope: {
              kind: 'question-set',
              taskReferences: [{ kind: 'quiz-question', questionId: quizQuestionA }],
            },
          },
          {
            ...confirmedObjective('Bestätigtes Ziel zur Frage A'),
            id: '33333333-3333-4333-8333-333333333333',
            scope: {
              kind: 'question-set',
              taskReferences: [{ kind: 'quiz-question', questionId: quizQuestionA }],
            },
          },
        ],
      }),
    );

    const fixture = await createComponent();
    expect(fixture.componentInstance.isAudiencePresentation()).toBe(true);
    expect(fixture.componentInstance.visibleObjectives().map((o) => o.text)).toEqual([
      'Bestätigtes Ziel zur Frage A',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Bestätigtes Ziel zur Frage A');
    expect(fixture.nativeElement.textContent).not.toContain('Ungeprüfter Entwurf zur Frage A');
    expect(fixture.nativeElement.querySelector('.session-objectives__origin-intro')).toBeNull();
    expect(fixture.nativeElement.querySelector('#session-learning-objective-add')).toBeNull();
  });

  it('zeigt einen Entwurf im Live-Quiz nicht und bietet kein Anlegen an', async () => {
    const quizQuestionA = 'eb4a99f8-8d86-41ef-960c-130f6d9a48e3';
    focusedQuestionIdMock.mockReturnValue(quizQuestionA);
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        availableQuizTasks: [
          {
            kind: 'quiz-question',
            questionId: quizQuestionA,
            order: 0,
            text: 'Frage A',
            eligibleForDerivation: true,
          },
        ],
        objectives: [
          {
            ...existingObjective('Ungeprüfter Entwurf zur Frage A'),
            scope: {
              kind: 'question-set',
              taskReferences: [{ kind: 'quiz-question', questionId: quizQuestionA }],
            },
          },
        ],
      }),
    );

    const fixture = await createComponent();
    expect(fixture.componentInstance.visibleObjectives()).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('Ungeprüfter Entwurf zur Frage A');
    expect(fixture.nativeElement.textContent).toContain(
      'Für diese Frage ist noch kein bestätigtes Lernziel hinterlegt.',
    );
    expect(fixture.nativeElement.querySelector('#session-learning-objective-add')).toBeNull();
    expect(fixture.nativeElement.querySelector('#session-learning-objective-derive')).toBeNull();
  });

  it('bietet die KI-Herleitung an, wenn noch kein Lernziel vorliegt, aber geeignete Quiz-Fragen existieren', async () => {
    const quizQuestionA = 'eb4a99f8-8d86-41ef-960c-130f6d9a48e3';
    focusedQuestionIdMock.mockReturnValue(quizQuestionA);
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        availableQuizTasks: [
          {
            kind: 'quiz-question',
            questionId: quizQuestionA,
            order: 0,
            text: 'Frage A',
            eligibleForDerivation: true,
          },
        ],
        objectives: [],
      }),
    );

    const fixture = await createComponent();
    expect(fixture.componentInstance.objectives()).toEqual([]);
    expect(fixture.nativeElement.querySelector('#session-learning-objective-derive')).toBeNull();
    expect(fixture.nativeElement.querySelector('#session-learning-objective-add')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Für diese Frage ist noch kein bestätigtes Lernziel hinterlegt.',
    );
  });

  it('zeigt im Q&A-Modus nur Forum-Aufträge ohne den Begriff Lernziel und ohne KI-Herleitung', async () => {
    modeMock.mockReturnValue('qa');
    const quizQuestionA = 'eb4a99f8-8d86-41ef-960c-130f6d9a48e3';
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        availableQuizTasks: [
          {
            kind: 'quiz-question',
            questionId: quizQuestionA,
            order: 0,
            text: 'Frage A',
            eligibleForDerivation: true,
          },
        ],
        objectives: [
          {
            ...existingObjective('Diskutiert die Praxisfälle im Forum'),
            purpose: 'forum-assignment',
            confirmation: {
              state: 'confirmed',
              confirmedAt: '2026-10-04T10:00:00.000Z',
              confirmedRevision: 3,
            },
          },
          existingObjective('Sessionweites manuelles Lernziel im Entwurf'),
          {
            ...existingObjective('Quiz-Lernziel'),
            id: '33333333-3333-4333-8333-333333333333',
            projection: 'quiz-projected',
            scope: { kind: 'quiz-wide' },
          },
        ],
      }),
    );

    const fixture = await createComponent();
    expect(fixture.componentInstance.objectives().map((o) => o.text)).toEqual([
      'Diskutiert die Praxisfälle im Forum',
    ]);
    expect(fixture.nativeElement.querySelector('#session-learning-objective-derive')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Auftrag');
    expect(fixture.nativeElement.textContent).not.toContain('Lernziel');
  });

  it('legt im Q&A-Modus einen Forumsauftrag mit eigenem purpose an', async () => {
    modeMock.mockReturnValue('qa');
    saveLearningObjectivesMock.mockResolvedValue(
      snapshot({
        learningContextRevision: 3,
        objectives: [
          {
            ...existingObjective('Sammelt zentrale Fragen zum Fallbeispiel.'),
            purpose: 'forum-assignment',
            confirmation: {
              state: 'confirmed',
              confirmedAt: '2026-10-04T10:00:00.000Z',
              confirmedRevision: 3,
            },
          },
        ],
      }),
    );
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component.beginAdd();
    component.setText('Sammelt zentrale Fragen zum Fallbeispiel.');
    await component.save();

    expect(saveLearningObjectivesMock).toHaveBeenCalledWith({
      code: 'ABC123',
      expectedLearningContextRevision: 2,
      mutations: [
        expect.objectContaining({
          action: 'upsert',
          scope: { kind: 'session' },
          confirmationState: 'confirmed',
          purpose: 'forum-assignment',
        }),
      ],
    });
  });

  it('blendet Forumsaufträge im Quiz-Lernziel-Dialog aus', async () => {
    getLearningObjectivesMock.mockResolvedValue(
      snapshot({
        objectives: [
          existingObjective('Sessionweites manuelles Lernziel im Entwurf'),
          {
            ...existingObjective('Sammelt zentrale Fragen zum Fallbeispiel.'),
            id: '44444444-4444-4444-8444-444444444444',
            purpose: 'forum-assignment',
            confirmation: {
              state: 'confirmed',
              confirmedAt: '2026-10-04T10:00:00.000Z',
              confirmedRevision: 3,
            },
          },
        ],
      }),
    );

    const fixture = await createComponent();
    expect(fixture.componentInstance.objectives().map((o) => o.text)).toEqual([
      'Sessionweites manuelles Lernziel im Entwurf',
    ]);
  });
});
