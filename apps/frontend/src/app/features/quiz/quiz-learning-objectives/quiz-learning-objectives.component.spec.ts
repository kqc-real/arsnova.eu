import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { QuizStoreService } from '../data/quiz-store.service';
import { QuizLearningObjectivesComponent } from './quiz-learning-objectives.component';

describe('QuizLearningObjectivesComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [QuizLearningObjectivesComponent],
      providers: [provideRouter([])],
    });
  });

  it('legt ein manuelles Ziel mit explizitem Aufgabenbereich an und bearbeitet es CAS-geschützt', () => {
    const store = TestBed.inject(QuizStoreService);
    const quiz = store.createQuiz({ name: 'Ziele' });
    const question = store.addQuestion(quiz.id, {
      text: 'Was ist Vererbung?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
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

    expect(component.errorMessage()).toContain('mindestens eine Aufgabe');
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

    expect(component.errorMessage()).toContain('fehlendem Aufgabenverweis');
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
      difficulty: 'MEDIUM',
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
    expect(intro.textContent).toContain('Manuelle Lernziele formulierst du selbst');
    expect(intro.textContent).toContain('Automatisch aus Aufgaben formulierte Lernziele');
    expect(intro.textContent).toContain('fachlich geprüft');
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
    expect(statusGroup.textContent).toContain('Noch nicht fachlich geprüft');
    expect(statusGroup.textContent).toContain('Relevante Quellenänderungen');
  });
});
