import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuizPreviewComponent } from './quiz-preview.component';
import { QuizStoreService, type QuizDocument } from '../data/quiz-store.service';

const QUIZ_ID = 'baf6b8e5-9425-495e-953d-ab4a95c8bf68';

describe('QuizPreviewComponent', () => {
  const mockRoute = {
    snapshot: {
      queryParamMap: convertToParamMap({}),
    },
    parent: {
      snapshot: {
        paramMap: convertToParamMap({ id: QUIZ_ID }),
      },
    },
  };
  const quiz: QuizDocument = {
    id: QUIZ_ID,
    name: 'Preview Quiz',
    description: null,
    motifImageUrl: null,
    createdAt: '2026-03-08T12:00:00.000Z',
    updatedAt: '2026-03-08T12:00:00.000Z',
    settings: {
      showLeaderboard: true,
      allowCustomNicknames: true,
      defaultTimer: null,
      timerScaleByDifficulty: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      showQuestionTypeIndicators: true,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
      backgroundMusic: null,
      nicknameTheme: 'HIGH_SCHOOL',
      bonusTokenCount: null,
      readingPhaseEnabled: true,
      preset: 'PLAYFUL',
    },
    questions: [
      {
        id: 'f8be4e5d-2c03-4f9b-8d63-b9668212f3ea',
        text: 'Wie zufrieden bist du?',
        type: 'RATING',
        difficulty: 'MEDIUM',
        order: 0,
        enabled: true,
        timer: null,
        answers: [],
        ratingMin: 1,
        ratingMax: 5,
        ratingLabelMin: 'Niedrig',
        ratingLabelMax: 'Hoch',
      },
      {
        id: 'ef2d6b11-6389-4f2d-b9d7-9a6ad86ee91f',
        text: 'Welche Aussage stimmt?',
        type: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        order: 1,
        enabled: true,
        timer: null,
        answers: [
          {
            id: 'a1cfb5f1-42a8-4312-9f95-ec7ae4e9be34',
            text: 'A',
            isCorrect: false,
          },
          {
            id: '0e9151d1-5a36-42ad-a5f9-df3acbe2f981',
            text: 'B',
            isCorrect: false,
          },
        ],
        ratingMin: null,
        ratingMax: null,
        ratingLabelMin: null,
        ratingLabelMax: null,
      },
    ],
  };

  const toUploadPayload = (document: QuizDocument) => ({
    historyScopeId: document.id,
    name: document.name,
    preset: document.settings.preset,
    questions: [...document.questions]
      .filter((question) => question.enabled !== false)
      .sort((left, right) => left.order - right.order)
      .map((question, index) => ({
        text: question.text,
        type: question.type,
        difficulty: question.difficulty,
        order: index,
        timer: question.timer ?? null,
        answers: question.answers.map((answer) => ({
          text: answer.text,
          isCorrect: answer.isCorrect,
        })),
        skipReadingPhase: question.skipReadingPhase ?? false,
        ratingMin: question.ratingMin ?? undefined,
        ratingMax: question.ratingMax ?? undefined,
        ratingLabelMin: question.ratingLabelMin ?? undefined,
        ratingLabelMax: question.ratingLabelMax ?? undefined,
        numericToleranceMode: question.numericToleranceMode ?? undefined,
        numericReferenceValue: question.numericReferenceValue ?? undefined,
        numericTolerancePercent: question.numericTolerancePercent ?? undefined,
        numericIntervalLeft: question.numericIntervalLeft ?? undefined,
        numericIntervalRight: question.numericIntervalRight ?? undefined,
        numericInputType: question.numericInputType ?? undefined,
        numericDecimalPlaces: question.numericDecimalPlaces ?? undefined,
        numericMin: question.numericMin ?? undefined,
        numericMax: question.numericMax ?? undefined,
        numericTwoRounds: question.numericTwoRounds ?? undefined,
      })),
  });

  const mockStore = {
    getQuizById: vi.fn((id: string) => (id === QUIZ_ID ? quiz : null)),
    getUploadPayload: vi.fn(() => toUploadPayload(quiz)),
    updateQuestion: vi.fn(),
    updateQuizSettings: vi.fn(),
  };
  const snackBarMock = {
    open: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [QuizPreviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: mockRoute,
        },
        { provide: QuizStoreService, useValue: mockStore },
        { provide: MatSnackBar, useValue: snackBarMock },
      ],
    });
    mockRoute.snapshot.queryParamMap = convertToParamMap({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt RATING-Fragen mit Skalenbereich und Labels', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Bewertung');
    expect(text).toContain('Skala 1–5');
    expect(text).toContain('Niedrig');
    expect(text).toContain('Hoch');
  });

  it('zeigt bei Bewertung kein Schwierigkeits-Badge', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    fixture.detectChanges();

    const badges = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('.quiz-preview-question__badge'),
    ).map((badge) => (badge.textContent as string).trim());

    expect(badges).toContain('Bewertung');
    expect(badges).not.toContain('Mittel');
  });

  it('skaliert den Vorschau-Timer nach Schwierigkeitsgrad, wenn die Quiz-Option aktiv ist', () => {
    quiz.settings.defaultTimer = 40;
    quiz.settings.timerScaleByDifficulty = true;
    const originalDifficulty = quiz.questions[1]!.difficulty;
    quiz.questions[1]!.difficulty = 'HARD';

    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.effectivePreviewTimerSeconds(quiz.questions[1]!)).toBe(80);

    quiz.settings.defaultTimer = null;
    quiz.settings.timerScaleByDifficulty = true;
    quiz.questions[1]!.difficulty = originalDifficulty;
  });

  it('laesst einen expliziten Frage-Timer in der Vorschau unveraendert', () => {
    quiz.settings.defaultTimer = 40;
    quiz.settings.timerScaleByDifficulty = true;
    const originalDifficulty = quiz.questions[1]!.difficulty;
    const originalTimer = quiz.questions[1]!.timer;
    quiz.questions[1]!.difficulty = 'HARD';
    quiz.questions[1]!.timer = 30;

    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.effectivePreviewTimerSeconds(quiz.questions[1]!)).toBe(30);

    quiz.settings.defaultTimer = null;
    quiz.settings.timerScaleByDifficulty = true;
    quiz.questions[1]!.difficulty = originalDifficulty;
    quiz.questions[1]!.timer = originalTimer;
  });

  it('zeigt bei Umfragen kein Schwierigkeits-Badge', () => {
    const originalQuestion = quiz.questions[0];
    quiz.questions[0] = {
      id: 'survey-question',
      text: 'Wie hilfreich war die Einführung?',
      type: 'SURVEY',
      difficulty: 'HARD',
      order: 0,
      enabled: true,
      timer: null,
      answers: [
        { id: 's1', text: 'Sehr hilfreich', isCorrect: false },
        { id: 's2', text: 'Teilweise hilfreich', isCorrect: false },
      ],
      ratingMin: null,
      ratingMax: null,
      ratingLabelMin: null,
      ratingLabelMax: null,
    };

    const fixture = TestBed.createComponent(QuizPreviewComponent);
    fixture.detectChanges();

    const badges = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('.quiz-preview-question__badge'),
    ).map((badge) => (badge.textContent as string).trim());

    expect(badges).toContain('Umfrage');
    expect(badges).not.toContain('Schwer');

    quiz.questions[0] = originalQuestion!;
  });

  it('navigiert zwischen Fragen und zeigt Validierungshinweis', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.currentIndex()).toBe(0);
    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.currentIndex()).toBe(1);
    component.onKeydown(new KeyboardEvent('keydown', { key: '1' }));
    expect(component.currentIndex()).toBe(0);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Validierungshinweise');
  });

  it('speichert Inline-Textänderungen erst nach explizitem Speichern', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enterInlineEditMode();
    component.onQuestionDraftChanged('Neue Frage');

    expect(mockStore.updateQuestion).not.toHaveBeenCalled();

    component.finishInlineEditMode();

    expect(mockStore.updateQuestion).toHaveBeenCalledWith(
      QUIZ_ID,
      'f8be4e5d-2c03-4f9b-8d63-b9668212f3ea',
      expect.objectContaining({ text: 'Neue Frage' }),
    );
  });

  it('speichert den Lesephasen-Override im Inline-Editor', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enterInlineEditMode();
    component.onInlineSkipReadingPhaseChange(true);
    component.finishInlineEditMode();

    expect(mockStore.updateQuestion).toHaveBeenCalledWith(
      QUIZ_ID,
      'f8be4e5d-2c03-4f9b-8d63-b9668212f3ea',
      expect.objectContaining({ skipReadingPhase: true }),
    );
  });

  it('verwirft Inline-Aenderungen ohne Persistieren', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enterInlineEditMode();
    component.onQuestionDraftChanged('Neue Frage');
    component.onInlineGlobalTimerEnabledChange(true);
    component.cancelInlineEditMode();

    expect(mockStore.updateQuestion).not.toHaveBeenCalled();
    expect(mockStore.updateQuizSettings).not.toHaveBeenCalled();
    expect(component.inlineEditMode()).toBe(false);
  });

  it('rendert relative Bilder in der Fragenvorschau waehrend des Inline-Edits', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enterInlineEditMode();
    component.onQuestionDraftChanged('Vorschau ![](/assets/test-image.png)');
    fixture.detectChanges();

    const previewImage = fixture.nativeElement.querySelector('.quiz-preview-question__text img');
    expect(previewImage).not.toBeNull();
    expect(previewImage.getAttribute('src')).toContain('/assets/test-image.png');
  });

  it('cacht gerendertes Markdown fuer identische Preview-Texte', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;

    const first = component.renderMarkdown('![Bild](/assets/test-image.png)');
    const second = component.renderMarkdown('![Bild](/assets/test-image.png)');

    expect(second).toBe(first);
    fixture.destroy();
  });

  it('cacht Antwort-Markdown separat vom Fragetext-Markdown', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    const source = '😄 Bild ![Bild](/assets/test-image.png)';

    const question = component.renderMarkdown(source);
    const firstAnswer = component.renderAnswerMarkdown(source);
    const secondAnswer = component.renderAnswerMarkdown(source);

    expect(secondAnswer).toBe(firstAnswer);
    expect(firstAnswer).not.toBe(question);
    fixture.destroy();
  });

  it('rendert data-image-Bilder in der Fragenvorschau', () => {
    quiz.questions[0]!.text =
      'How are you feeling? ![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+KDv0WQAAAABJRU5ErkJggg==)';
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    fixture.detectChanges();

    const previewImage = fixture.nativeElement.querySelector('.quiz-preview-question__text img');
    expect(previewImage).not.toBeNull();
    expect(previewImage.getAttribute('src')).toContain('data:image/png;base64,');
  });

  it('verwirft beim Zurueck-Navigieren offene Inline-Aenderungen statt sie implizit zu speichern', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    mockRoute.snapshot.queryParamMap = convertToParamMap({ returnTo: 'edit' });
    fixture.detectChanges();

    component.enterInlineEditMode();
    component.onQuestionDraftChanged('Neue Frage');
    component.backToOrigin();

    expect(mockStore.updateQuestion).not.toHaveBeenCalled();
    expect(mockStore.updateQuizSettings).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalled();
    expect(component.inlineEditMode()).toBe(false);
  });

  it('verwirft beim Fragewechsel offene Inline-Aenderungen statt sie implizit zu speichern', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enterInlineEditMode();
    component.onQuestionDraftChanged('Neue Frage');
    component.nextQuestion();

    expect(mockStore.updateQuestion).not.toHaveBeenCalled();
    expect(mockStore.updateQuizSettings).not.toHaveBeenCalled();
    expect(component.currentIndex()).toBe(1);
    expect(component.inlineEditMode()).toBe(false);
  });

  it('speichert lokale Korrektheits-Toggles erst nach Speichern', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    component.currentIndex.set(1);
    fixture.detectChanges();

    component.enterInlineEditMode();
    component.toggleCorrectAnswer(1);

    expect(component.inlineEditHasChanges()).toBe(true);
    expect(mockStore.updateQuestion).not.toHaveBeenCalled();

    component.finishInlineEditMode();

    expect(mockStore.updateQuestion).toHaveBeenCalledWith(
      QUIZ_ID,
      'ef2d6b11-6389-4f2d-b9d7-9a6ad86ee91f',
      expect.objectContaining({
        answers: [
          expect.objectContaining({ isCorrect: false }),
          expect.objectContaining({ isCorrect: true }),
        ],
      }),
    );
  });

  it('rendert KaTeX-Formeln als MathML in der Frageanzeige', () => {
    quiz.questions[0]!.text = 'Formeltest: $a^2 + b^2 = c^2$';
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    fixture.detectChanges();

    const renderedMath = fixture.nativeElement.querySelector(
      '.quiz-preview-question__text .katex math',
    ) as HTMLElement | null;

    expect(renderedMath).not.toBeNull();
  });

  it('markiert Markdown-Container in der Vorschau fuer responsive Bild-Styles', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const questionText = fixture.nativeElement.querySelector(
      '.quiz-preview-question__text',
    ) as HTMLElement | null;
    expect(questionText?.classList.contains('markdown-body')).toBe(true);

    component.currentIndex.set(1);
    fixture.detectChanges();

    const answerContent = fixture.nativeElement.querySelector(
      '.quiz-preview-question__answer-content',
    ) as HTMLElement | null;
    expect(answerContent?.classList.contains('markdown-body')).toBe(true);
  });

  it('rendert Auswahl-Toggles linksbündig vor dem Antworttext', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    component.currentIndex.set(1);
    fixture.detectChanges();

    const firstAnswerRow = fixture.nativeElement.querySelector(
      '.quiz-preview-question__answers li',
    ) as HTMLElement | null;
    expect(firstAnswerRow).not.toBeNull();
    const children = Array.from(firstAnswerRow?.children ?? []);
    expect(children[0]?.classList.contains('quiz-preview-question__answer-label')).toBe(true);
    expect(children[1]?.classList.contains('quiz-preview-question__correct-toggle')).toBe(true);
    expect(children[2]?.classList.contains('quiz-preview-question__answer-content')).toBe(true);
  });

  it('nutzt typisierte Antwort-Badges, wenn Frageart-Indikatoren aktiv sind', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    component.currentIndex.set(1);
    fixture.detectChanges();

    const answerLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.quiz-preview-question__answer-label--badge'),
    ) as HTMLElement[];

    expect(answerLabels[0]?.getAttribute('data-answer-shape')).toBe('circle');
    expect(answerLabels[1]?.getAttribute('data-answer-shape')).toBe('circle');
    expect(component.previewAnswerColor(0)).toBe('#1565c0');
    expect(component.previewAnswerColor(1)).toBe('#e65100');
  });

  it('faellt bei deaktivierten Frageart-Indikatoren auf gemischte Badges zurueck', () => {
    quiz.settings.showQuestionTypeIndicators = false;
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    component.currentIndex.set(1);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    const answerLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.quiz-preview-question__answer-label--badge'),
    ) as HTMLElement[];

    expect(text).not.toContain('Single Choice');
    expect(answerLabels[0]?.getAttribute('data-answer-shape')).toBe('triangle');
    expect(answerLabels[1]?.getAttribute('data-answer-shape')).toBe('circle');
    quiz.settings.showQuestionTypeIndicators = true;
  });

  it('markiert fuehrende Antwort-Emojis in der Vorschau fuer haengenden Einzug', () => {
    const originalAnswer = quiz.questions[1]!.answers[0]!.text;
    quiz.questions[1]!.answers[0]!.text = '😢 Gerade etwas überfordert';
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    component.currentIndex.set(1);
    fixture.detectChanges();

    const answerContent = fixture.nativeElement.querySelector(
      '.quiz-preview-question__answer-content',
    ) as HTMLElement | null;

    expect(answerContent?.querySelector('.answer-leading-emoji')?.textContent).toContain('😢');
    quiz.questions[1]!.answers[0]!.text = originalAnswer;
  });

  it('markiert fuehrende Shortcut-Emojis in der Vorschau fuer mobilen Einzug', () => {
    const originalAnswer = quiz.questions[1]!.answers[0]!.text;
    quiz.questions[1]!.answers[0]!.text = ':apple: Bereit loszulegen';
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    component.currentIndex.set(1);
    fixture.detectChanges();

    const answerContent = fixture.nativeElement.querySelector(
      '.quiz-preview-question__answer-content',
    ) as HTMLElement | null;
    const leadingEmoji = answerContent?.querySelector(
      '.answer-leading-emoji',
    ) as HTMLElement | null;

    expect(leadingEmoji?.textContent).toContain('🍎');
    expect(leadingEmoji?.getAttribute('title')).toBe(':apple:');
    quiz.questions[1]!.answers[0]!.text = originalAnswer;
  });

  it('schaltet mit Hotkey E die Inline-Bearbeitung um', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.inlineEditMode()).toBe(false);
    component.onKeydown(new KeyboardEvent('keydown', { key: 'e' }));
    expect(component.inlineEditMode()).toBe(true);
  });

  it('aktiviert den Save-Button im Preview-Editor erst nach einer Aenderung', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enterInlineEditMode();
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '.quiz-preview-editor__actions button[matbutton="filled"], .quiz-preview-editor__actions button:last-child',
    ) as HTMLButtonElement | null;

    expect(saveButton).not.toBeNull();
    expect(component.inlineEditHasChanges()).toBe(false);
    expect(saveButton?.disabled).toBe(true);

    component.onQuestionDraftChanged('Neue Frage');
    fixture.detectChanges();

    expect(component.inlineEditHasChanges()).toBe(true);
    expect(saveButton?.disabled).toBe(false);
  });

  it('zeigt nach gespeicherten Preview-Aenderungen eine Bestaetigung', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enterInlineEditMode();
    component.onQuestionDraftChanged('Neue Frage');
    component.finishInlineEditMode();

    expect(mockStore.updateQuestion).toHaveBeenCalledWith(
      QUIZ_ID,
      quiz.questions[0]!.id,
      expect.objectContaining({ text: 'Neue Frage' }),
    );
    expect(snackBarMock.open).toHaveBeenCalledWith(expect.stringContaining('Vorschau'), '', {
      duration: 6000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
    expect(snackBarMock.open.mock.calls[0]?.[0]).toContain('Live-Quiz');
  });

  it('zeigt im Preview-Editor ohne Änderungen einen Schließen-Button in der Actionbar', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enterInlineEditMode();
    fixture.detectChanges();

    const actionButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.quiz-preview-editor__actions button'),
    ) as HTMLButtonElement[];

    expect(
      actionButtons.some((button) => (button.textContent as string).includes('Schließen')),
    ).toBe(true);
    expect(
      actionButtons.some((button) =>
        (button.textContent as string).includes('Änderungen verwerfen'),
      ),
    ).toBe(false);
  });

  it('zeigt im Preview-Editor nach Änderungen einen Verwerfen-Button in der Actionbar', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enterInlineEditMode();
    component.onQuestionDraftChanged('Neue Frage');
    fixture.detectChanges();

    const actionButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.quiz-preview-editor__actions button'),
    ) as HTMLButtonElement[];

    expect(
      actionButtons.some((button) =>
        (button.textContent as string).includes('Änderungen verwerfen'),
      ),
    ).toBe(true);
    expect(
      actionButtons.some((button) => (button.textContent as string).includes('Schließen')),
    ).toBe(false);
  });

  it('deaktiviert den Save-Button wieder, wenn der Draft dem Ausgangszustand entspricht', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const originalText = component.currentQuestion()?.text ?? '';
    component.enterInlineEditMode();
    component.onQuestionDraftChanged('Neue Frage');
    fixture.detectChanges();

    component.onQuestionDraftChanged(originalText);
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '.quiz-preview-editor__actions button[matbutton="filled"], .quiz-preview-editor__actions button:last-child',
    ) as HTMLButtonElement | null;

    expect(component.inlineEditHasChanges()).toBe(false);
    expect(saveButton?.disabled).toBe(true);
  });

  it('startet ab aktueller Frage mit vollständigem Upload-Payload und separatem Startindex', () => {
    const appendedQuestion = {
      id: 'trailing-question',
      text: 'Dritte Frage',
      type: 'SURVEY' as const,
      difficulty: 'EASY' as const,
      order: 2,
      enabled: true,
      timer: null,
      answers: [
        { id: 't1', text: 'Ja', isCorrect: false },
        { id: 't2', text: 'Nein', isCorrect: false },
      ],
      ratingMin: null,
      ratingMax: null,
      ratingLabelMin: null,
      ratingLabelMax: null,
    };
    quiz.questions.push(appendedQuestion);
    try {
      const fixture = TestBed.createComponent(QuizPreviewComponent);
      const component = fixture.componentInstance;
      component.currentIndex.set(1);
      fixture.detectChanges();

      const payload = component['buildLiveStartPayload']('current');

      expect(payload.questions).toHaveLength(3);
      expect(payload.questions.map((question) => question.text)).toEqual(
        quiz.questions.map((question) => question.text),
      );
      expect(payload.questions.map((question) => question.order)).toEqual(
        quiz.questions.map((question) => question.order),
      );
      expect(component['liveStartQuestionIndex']('current', payload.questions.length)).toBe(1);
    } finally {
      quiz.questions.pop();
    }
  });

  it('blockiert den Ab-hier-Start nicht wegen früherer ungültiger Fragen', () => {
    const originalFirstQuestion = quiz.questions[0];
    const originalSecondQuestion = quiz.questions[1];
    quiz.questions[0] = {
      id: 'invalid-question',
      text: 'Ungültige Startfrage',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      order: 0,
      enabled: true,
      timer: null,
      answers: [{ id: 'invalid-answer', text: 'Nur eine Option', isCorrect: false }],
      ratingMin: null,
      ratingMax: null,
      ratingLabelMin: null,
      ratingLabelMax: null,
    };
    quiz.questions[1] = {
      ...quiz.questions[1]!,
      answers: [
        { id: 'v1', text: 'Richtig', isCorrect: true },
        { id: 'v2', text: 'Falsch', isCorrect: false },
      ],
    };
    try {
      const fixture = TestBed.createComponent(QuizPreviewComponent);
      const component = fixture.componentInstance;
      component.currentIndex.set(1);
      fixture.detectChanges();

      const fullStartButton = fixture.nativeElement.querySelector(
        'button[aria-label="Ganzes Quiz starten"]',
      ) as HTMLButtonElement | null;
      const currentStartButton = fixture.nativeElement.querySelector(
        'button[aria-label="Ab dieser Frage live starten"]',
      ) as HTMLButtonElement | null;

      expect(component.validationWarnings().length).toBeGreaterThan(0);
      expect(component.currentStartValidationWarnings()).toHaveLength(0);
      expect(fullStartButton?.disabled).toBe(true);
      expect(currentStartButton?.disabled).toBe(false);
    } finally {
      quiz.questions[0] = originalFirstQuestion!;
      quiz.questions[1] = originalSecondQuestion!;
    }
  });
});
