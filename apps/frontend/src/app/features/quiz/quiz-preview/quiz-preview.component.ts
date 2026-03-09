import { Component, HostListener, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import type { Difficulty } from '@arsnova/shared-types';
import {
  DEMO_QUIZ_ID,
  QuizStoreService,
  type AddQuizQuestionInput,
  type QuizQuestion,
  type SupportedQuestionType,
} from '../data/quiz-store.service';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';

/**
 * Quiz-Preview & Schnellkorrektur (Epic 1).
 * Story 1.13, 1.7 (Markdown/KaTeX).
 */
@Component({
  selector: 'app-quiz-preview',
  standalone: true,
  imports: [
    RouterLink,
    MatButton,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatIcon,
    MatProgressBar,
  ],
  templateUrl: './quiz-preview.component.html',
  styleUrl: './quiz-preview.component.scss',
})
export class QuizPreviewComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly quizStore = inject(QuizStoreService);
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private animationTimer: ReturnType<typeof setTimeout> | null = null;
  private touchStartX: number | null = null;

  readonly id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
  readonly currentIndex = signal(0);
  readonly inlineEditMode = signal(false);
  readonly questionDraftText = signal('');
  readonly answerDraftTexts = signal<string[]>([]);
  readonly originalQuestionSnapshot = signal<AddQuizQuestionInput | null>(null);
  readonly swipeDirection = signal<'left' | 'right' | null>(null);
  readonly quiz = computed(() => this.quizStore.getQuizById(this.id));
  readonly questions = computed(() => {
    const quiz = this.quiz();
    if (!quiz) return [];
    return [...quiz.questions].sort((a, b) => a.order - b.order);
  });
  readonly currentQuestion = computed(() => this.questions()[this.currentIndex()] ?? null);
  readonly progressValue = computed(() => {
    const total = this.questions().length;
    if (total === 0) return 0;
    return Math.round(((this.currentIndex() + 1) / total) * 100);
  });
  readonly validationWarnings = computed(() =>
    this.questions()
      .map((question, index) => {
        if (
          (question.type === 'SINGLE_CHOICE' ||
            question.type === 'MULTIPLE_CHOICE' ||
            question.type === 'SURVEY') &&
          question.answers.length < 2
        ) {
          return { index, message: `Frage ${index + 1}: weniger als 2 Antworten` };
        }
        if (question.type === 'SINGLE_CHOICE') {
          const count = question.answers.filter((answer) => answer.isCorrect).length;
          if (count !== 1) {
            return { index, message: `Frage ${index + 1}: keine richtige Antwort gewählt` };
          }
        }
        if (question.type === 'MULTIPLE_CHOICE') {
          const count = question.answers.filter((answer) => answer.isCorrect).length;
          if (count < 1) {
            return { index, message: `Frage ${index + 1}: keine richtige Antwort gewählt` };
          }
        }
        return null;
      })
      .filter((entry): entry is { index: number; message: string } => entry !== null),
  );

  constructor() {
    if (this.id === DEMO_QUIZ_ID) {
      this.quizStore.ensureDemoQuiz();
    }
    effect(() => {
      const total = this.questions().length;
      const index = this.currentIndex();
      if (total === 0) {
        if (index !== 0) this.currentIndex.set(0);
        return;
      }
      if (index > total - 1) {
        this.currentIndex.set(total - 1);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  }

  nextQuestion(): void {
    const total = this.questions().length;
    if (total === 0) return;
    this.commitInlineEdits();
    this.triggerSwipeAnimation('left');
    this.currentIndex.update((index) => Math.min(index + 1, total - 1));
  }

  previousQuestion(): void {
    this.commitInlineEdits();
    this.triggerSwipeAnimation('right');
    this.currentIndex.update((index) => Math.max(index - 1, 0));
  }

  goToQuestion(index: number): void {
    const total = this.questions().length;
    if (index < 0 || index >= total) return;
    this.commitInlineEdits();
    this.currentIndex.set(index);
  }

  goFirst(): void {
    this.currentIndex.set(0);
  }

  goLast(): void {
    const total = this.questions().length;
    if (total === 0) return;
    this.currentIndex.set(total - 1);
  }

  leavePreview(): void {
    this.commitInlineEdits();
    void this.router.navigate(['/quiz', this.id]);
  }

  enterInlineEditMode(): void {
    const question = this.currentQuestion();
    if (!question) return;
    if (this.inlineEditMode()) return;

    this.originalQuestionSnapshot.set(this.toQuestionInput(question));
    this.questionDraftText.set(question.text);
    this.answerDraftTexts.set(question.answers.map((answer) => answer.text));
    this.inlineEditMode.set(true);
  }

  cancelInlineEditMode(): void {
    const original = this.originalQuestionSnapshot();
    const question = this.currentQuestion();
    if (original && question) {
      this.quizStore.updateQuestion(this.id, question.id, original);
    }
    this.resetInlineEditState();
  }

  finishInlineEditMode(): void {
    this.commitInlineEdits();
  }

  onQuestionDraftChanged(value: string): void {
    this.questionDraftText.set(value);
    this.schedulePersistInlineEdits();
  }

  onAnswerDraftChanged(index: number, value: string): void {
    this.answerDraftTexts.update((current) =>
      current.map((entry, currentIndex) => (currentIndex === index ? value : entry)),
    );
    this.schedulePersistInlineEdits();
  }

  toggleCorrectAnswer(index: number): void {
    const question = this.currentQuestion();
    if (!question || !this.questionTypeHasCorrectAnswers(question.type)) return;

    const updatedAnswers = question.answers.map((answer, currentIndex) => {
      if (question.type === 'SINGLE_CHOICE') {
        return { text: answer.text, isCorrect: currentIndex === index };
      }
      if (currentIndex === index) {
        return { text: answer.text, isCorrect: !answer.isCorrect };
      }
      return { text: answer.text, isCorrect: answer.isCorrect };
    });

    this.quizStore.updateQuestion(this.id, question.id, {
      text: this.inlineEditMode() ? this.questionDraftText() : question.text,
      type: question.type,
      difficulty: question.difficulty,
      answers: updatedAnswers,
      ratingMin: question.ratingMin,
      ratingMax: question.ratingMax,
      ratingLabelMin: question.ratingLabelMin,
      ratingLabelMax: question.ratingLabelMax,
    });
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? null;
  }

  onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? this.touchStartX;
    const delta = endX - this.touchStartX;
    this.touchStartX = null;

    if (Math.abs(delta) < 40) return;
    if (delta < 0) {
      this.nextQuestion();
    } else {
      this.previousQuestion();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.quiz() || this.questions().length === 0) return;
    if (event.defaultPrevented) return;

    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    if (event.key === 'ArrowRight' || key === 'n') {
      event.preventDefault();
      this.nextQuestion();
      return;
    }
    if (event.key === 'ArrowLeft' || key === 'p') {
      event.preventDefault();
      this.previousQuestion();
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      this.goFirst();
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      this.goLast();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.inlineEditMode()) {
        this.cancelInlineEditMode();
      } else {
        this.leavePreview();
      }
      return;
    }
    if (key === 'e') {
      event.preventDefault();
      if (this.inlineEditMode()) {
        this.commitInlineEdits();
      } else {
        this.enterInlineEditMode();
      }
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      this.goToQuestion(Number(event.key) - 1);
    }
  }

  hasWarningAtIndex(index: number): boolean {
    return this.validationWarnings().some((w) => w.index === index);
  }

  questionTypeLabel(type: SupportedQuestionType): string {
    if (type === 'SINGLE_CHOICE') return 'Single Choice';
    if (type === 'MULTIPLE_CHOICE') return 'Multiple Choice';
    if (type === 'FREETEXT') return 'Freitext';
    if (type === 'SURVEY') return 'Umfrage';
    if (type === 'RATING') return 'Bewertung';
    return type;
  }

  questionTypeHasCorrectAnswers(type: SupportedQuestionType): boolean {
    return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
  }

  difficultyLabel(value: Difficulty): string {
    if (value === 'EASY') return 'Leicht';
    if (value === 'HARD') return 'Schwer';
    return 'Mittel';
  }

  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdownWithKatex(value).html);
  }

  ratingScaleValues(min: number | null, max: number | null): number[] {
    const from = min ?? 1;
    const to = max ?? 5;
    if (to < from) return [];
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  }

  private schedulePersistInlineEdits(): void {
    if (!this.inlineEditMode()) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistInlineEditsNow();
      this.persistTimer = null;
    }, 200);
  }

  private persistInlineEditsNow(): void {
    const question = this.currentQuestion();
    if (!question || !this.inlineEditMode()) return;

    const answers = question.answers.map((answer, index) => ({
      text: this.answerDraftTexts()[index] ?? answer.text,
      isCorrect: answer.isCorrect,
    }));

    this.quizStore.updateQuestion(this.id, question.id, {
      text: this.questionDraftText(),
      type: question.type,
      difficulty: question.difficulty,
      answers,
      ratingMin: question.ratingMin,
      ratingMax: question.ratingMax,
      ratingLabelMin: question.ratingLabelMin,
      ratingLabelMax: question.ratingLabelMax,
    });
  }

  private commitInlineEdits(): void {
    if (!this.inlineEditMode()) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persistInlineEditsNow();
    this.resetInlineEditState();
  }

  private resetInlineEditState(): void {
    this.inlineEditMode.set(false);
    this.originalQuestionSnapshot.set(null);
  }

  private toQuestionInput(question: QuizQuestion): AddQuizQuestionInput {
    return {
      text: question.text,
      type: question.type,
      difficulty: question.difficulty,
      answers: question.answers.map((answer) => ({
        text: answer.text,
        isCorrect: answer.isCorrect,
      })),
      ratingMin: question.ratingMin,
      ratingMax: question.ratingMax,
      ratingLabelMin: question.ratingLabelMin,
      ratingLabelMax: question.ratingLabelMax,
    };
  }

  private triggerSwipeAnimation(direction: 'left' | 'right'): void {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
    }
    this.swipeDirection.set(direction);
    this.animationTimer = setTimeout(() => {
      this.swipeDirection.set(null);
      this.animationTimer = null;
    }, 150);
  }
}
