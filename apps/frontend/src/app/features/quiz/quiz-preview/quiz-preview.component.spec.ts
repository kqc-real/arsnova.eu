import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuizPreviewComponent } from './quiz-preview.component';
import { QuizStoreService, type QuizDocument } from '../data/quiz-store.service';

const QUIZ_ID = 'baf6b8e5-9425-495e-953d-ab4a95c8bf68';

describe('QuizPreviewComponent', () => {
  const quiz: QuizDocument = {
    id: QUIZ_ID,
    name: 'Preview Quiz',
    description: null,
    createdAt: '2026-03-08T12:00:00.000Z',
    updatedAt: '2026-03-08T12:00:00.000Z',
    settings: {
      showLeaderboard: true,
      allowCustomNicknames: true,
      defaultTimer: null,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      backgroundMusic: null,
      nicknameTheme: 'NOBEL_LAUREATES',
      bonusTokenCount: null,
      readingPhaseEnabled: true,
    },
    questions: [
      {
        id: 'f8be4e5d-2c03-4f9b-8d63-b9668212f3ea',
        text: 'Wie zufrieden bist du?',
        type: 'RATING',
        difficulty: 'MEDIUM',
        order: 0,
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

  const mockStore = {
    getQuizById: vi.fn((id: string) => (id === QUIZ_ID ? quiz : null)),
    updateQuestion: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [QuizPreviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            parent: {
              snapshot: {
                paramMap: convertToParamMap({ id: QUIZ_ID }),
              },
            },
          },
        },
        { provide: QuizStoreService, useValue: mockStore },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt RATING-Fragen mit Skalenbereich und Labels', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Rating');
    expect(text).toContain('Skala 1–5');
    expect(text).toContain('Niedrig');
    expect(text).toContain('Hoch');
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

  it('persistiert Inline-Textänderungen mit Debounce', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.enterInlineEditMode();
    component.onQuestionDraftChanged('Neue Frage');
    vi.advanceTimersByTime(220);

    expect(mockStore.updateQuestion).toHaveBeenCalledWith(
      QUIZ_ID,
      'f8be4e5d-2c03-4f9b-8d63-b9668212f3ea',
      expect.objectContaining({ text: 'Neue Frage' }),
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

  it('rendert Auswahl-Toggles linksbündig vor dem Antworttext', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    component.currentIndex.set(1);
    fixture.detectChanges();

    const firstAnswerRow = fixture.nativeElement.querySelector(
      '.quiz-preview-question__answers li',
    ) as HTMLElement | null;
    expect(firstAnswerRow).not.toBeNull();
    expect(firstAnswerRow?.firstElementChild?.classList.contains('quiz-preview-question__correct-toggle')).toBe(
      true,
    );
    expect(firstAnswerRow?.firstElementChild?.tagName).toBe('SPAN');
  });

  it('schaltet mit Hotkey E die Inline-Bearbeitung um', () => {
    const fixture = TestBed.createComponent(QuizPreviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.inlineEditMode()).toBe(false);
    component.onKeydown(new KeyboardEvent('keydown', { key: 'e' }));
    expect(component.inlineEditMode()).toBe(true);
  });
});
