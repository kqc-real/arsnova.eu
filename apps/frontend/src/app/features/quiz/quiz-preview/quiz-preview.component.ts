import { DOCUMENT, Location, isPlatformBrowser } from '@angular/common';
import {
  Component,
  HostListener,
  Injector,
  OnDestroy,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption } from '@angular/material/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelect } from '@angular/material/select';
import {
  createQuizHistoryAccessProof,
  PresetStorageEntrySchema,
  DEFAULT_BONUS_TOKEN_COUNT,
  DEFAULT_TIMER_SECONDS,
  resolveEffectiveQuestionTimer,
  type CreateSessionOutput,
  type Difficulty,
} from '@arsnova/shared-types';
import { homePresetOptionsKeyForQuizPreset } from '../../../core/home-preset-storage';
import {
  clearPendingHostSessionCode,
  setHostToken,
  setPendingHostSessionCode,
  trpc,
} from '../../../core/trpc.client';
import { navigateToHostSession } from '../../../core/session-host-navigation';
import {
  DEMO_QUIZ_ID,
  QuizStoreService,
  type AddQuizQuestionInput,
  type QuizDocument,
  type QuizQuestion,
  type SupportedQuestionType,
} from '../data/quiz-store.service';
import { localizeCommands } from '../../../core/locale-router';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { MarkdownKatexEditorComponent } from '../../../shared/markdown-katex-editor/markdown-katex-editor.component';
import { MarkdownImageLightboxDirective } from '../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { questionTypeLabel as questionTypeLabelI18n } from '../../../shared/question-type-label';
import { mergeTimerPresetOptions } from '../default-timer-presets';
import { tryRequestDocumentFullscreen } from '../../../core/document-fullscreen.util';

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
    MatIcon,
    MatProgressBar,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MarkdownKatexEditorComponent,
    MarkdownImageLightboxDirective,
  ],
  templateUrl: './quiz-preview.component.html',
  styleUrls: ['../../../shared/styles/dialog-title-header.scss', './quiz-preview.component.scss'],
})
export class QuizPreviewComponent implements OnDestroy {
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly quizStore = inject(QuizStoreService);
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  private animationTimer: ReturnType<typeof setTimeout> | null = null;
  private touchStartX: number | null = null;

  readonly id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
  readonly currentIndex = signal(0);
  readonly inlineEditMode = signal(false);
  readonly questionDraftText = signal('');
  readonly answerDraftTexts = signal<string[]>([]);
  readonly answerDraftCorrectFlags = signal<boolean[]>([]);
  readonly originalQuestionSnapshot = signal<AddQuizQuestionInput | null>(null);
  /** Wert beim Eintritt in den Inline-Edit (für Abbrechen); `undefined` = keine aktive Sitzung. */
  readonly quizDefaultTimerAtEditStart = signal<number | null | undefined>(undefined);
  readonly inlineQuizDefaultTimerDraft = signal<number | null>(null);
  /** `null` = Quiz-`defaultTimer` */
  readonly inlineQuestionTimerDraft = signal<number | null>(null);
  readonly inlineSkipReadingPhaseDraft = signal(false);
  readonly swipeDirection = signal<'left' | 'right' | null>(null);
  readonly animationNonce = signal(0);
  readonly liveStartPending = signal(false);
  readonly liveStartError = signal<string | null>(null);
  readonly quiz = computed(() => this.quizStore.getQuizById(this.id));
  /** Gespeicherte Fragen (inkl. deaktivierter) – für leere Vorschau mit Hinweis */
  readonly quizHasStoredQuestions = computed(() => (this.quiz()?.questions.length ?? 0) > 0);
  readonly questions = computed(() => {
    const quiz = this.quiz();
    if (!quiz) return [];
    return [...quiz.questions].filter((q) => q.enabled !== false).sort((a, b) => a.order - b.order);
  });
  readonly currentQuestion = computed(() => this.questions()[this.currentIndex()] ?? null);
  readonly displayedQuestion = computed(() => {
    const question = this.currentQuestion();
    if (!question) return null;
    if (!this.inlineEditMode()) return question;

    return {
      ...question,
      text: this.questionDraftText(),
      answers: question.answers.map((answer, index) => ({
        ...answer,
        text: this.answerDraftTexts()[index] ?? answer.text,
        isCorrect: this.answerDraftCorrectFlags()[index] ?? answer.isCorrect,
      })),
    };
  });
  readonly inlineEditHasChanges = computed(() => {
    const original = this.originalQuestionSnapshot();
    if (!original || !this.inlineEditMode()) return false;

    if (this.questionDraftText() !== original.text) {
      return true;
    }

    const defaultAtStart = this.quizDefaultTimerAtEditStart();
    if (defaultAtStart !== undefined && this.inlineQuizDefaultTimerDraft() !== defaultAtStart) {
      return true;
    }

    if (this.inlineQuestionTimerDraft() !== (original.timer ?? null)) {
      return true;
    }

    if (this.inlineSkipReadingPhaseDraft() !== (original.skipReadingPhase ?? false)) {
      return true;
    }

    const answerDrafts = this.answerDraftTexts();
    const answerDraftCorrectFlags = this.answerDraftCorrectFlags();
    const currentAnswers = this.currentQuestion()?.answers ?? [];
    const originalAnswers = original.answers ?? [];
    const answerCount = Math.max(
      answerDrafts.length,
      currentAnswers.length,
      originalAnswers.length,
    );

    for (let index = 0; index < answerCount; index += 1) {
      const originalAnswer = originalAnswers[index];
      const currentAnswer = currentAnswers[index];
      if ((answerDrafts[index] ?? '') !== (originalAnswer?.text ?? '')) {
        return true;
      }
      if (
        (answerDraftCorrectFlags[index] ?? currentAnswer?.isCorrect ?? false) !==
        (originalAnswer?.isCorrect ?? false)
      ) {
        return true;
      }
    }

    return false;
  });
  readonly animatedCurrentQuestion = computed(() => {
    const question = this.displayedQuestion();
    if (!question) return [];

    return [
      {
        key: `${question.id}-${this.animationNonce()}`,
        question,
      },
    ];
  });
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
          return {
            index,
            message: $localize`Frage ${index + 1}:questionNumber:: weniger als 2 Antworten`,
          };
        }
        if (question.type === 'SINGLE_CHOICE') {
          const count = question.answers.filter((answer) => answer.isCorrect).length;
          if (count !== 1) {
            return {
              index,
              message: $localize`Frage ${index + 1}:questionNumber:: keine richtige Antwort gewählt`,
            };
          }
        }
        if (question.type === 'MULTIPLE_CHOICE') {
          const count = question.answers.filter((answer) => answer.isCorrect).length;
          if (count < 1) {
            return {
              index,
              message: $localize`Frage ${index + 1}:questionNumber:: keine richtige Antwort gewählt`,
            };
          }
        }
        return null;
      })
      .filter((entry): entry is { index: number; message: string } => entry !== null),
  );
  readonly currentQuestionValidation = computed(() => {
    const question = this.displayedQuestion();
    if (!question) {
      return { hasIssues: false, needsMoreAnswers: false, needsCorrectAnswer: false };
    }

    const needsMoreAnswers =
      (question.type === 'SINGLE_CHOICE' ||
        question.type === 'MULTIPLE_CHOICE' ||
        question.type === 'SURVEY') &&
      question.answers.length < 2;

    const correctCount = question.answers.filter((answer) => answer.isCorrect).length;
    const needsCorrectAnswer =
      (question.type === 'SINGLE_CHOICE' && correctCount !== 1) ||
      (question.type === 'MULTIPLE_CHOICE' && correctCount < 1);

    return {
      hasIssues: needsMoreAnswers || needsCorrectAnswer,
      needsMoreAnswers,
      needsCorrectAnswer,
    };
  });

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
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  }

  nextQuestion(): void {
    const total = this.questions().length;
    if (total === 0) return;
    const nextIndex = Math.min(this.currentIndex() + 1, total - 1);
    if (nextIndex === this.currentIndex()) return;
    if (this.inlineEditMode()) {
      this.cancelInlineEditMode();
    }
    this.currentIndex.set(nextIndex);
    this.triggerSwipeAnimation('left');
  }

  previousQuestion(): void {
    const previousIndex = Math.max(this.currentIndex() - 1, 0);
    if (previousIndex === this.currentIndex()) return;
    if (this.inlineEditMode()) {
      this.cancelInlineEditMode();
    }
    this.currentIndex.set(previousIndex);
    this.triggerSwipeAnimation('right');
  }

  goToQuestion(index: number): void {
    const total = this.questions().length;
    if (index < 0 || index >= total) return;
    const currentIndex = this.currentIndex();
    if (index === currentIndex) return;
    if (this.inlineEditMode()) {
      this.cancelInlineEditMode();
    }
    this.currentIndex.set(index);
    this.triggerSwipeAnimation(index > currentIndex ? 'left' : 'right');
  }

  questionAriaLabel(index: number): string {
    return $localize`Frage ${index + 1}`;
  }

  goFirst(): void {
    this.goToQuestion(0);
  }

  goLast(): void {
    const total = this.questions().length;
    if (total === 0) return;
    this.goToQuestion(total - 1);
  }

  backToOrigin(): void {
    if (this.inlineEditMode()) {
      this.cancelInlineEditMode();
    }
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');

    if (returnTo === 'list') {
      void this.router.navigate(localizeCommands(['quiz']));
      return;
    }

    if (returnTo === 'edit') {
      void this.router.navigate(localizeCommands(['quiz', this.id]));
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }

    void this.router.navigate(localizeCommands(['quiz', this.id]));
  }

  async openLiveStartDialog(): Promise<void> {
    const quiz = this.quiz();
    if (!quiz || this.questions().length === 0 || this.liveStartPending()) return;
    await this.startLiveSession();
  }

  enterInlineEditMode(): void {
    const question = this.currentQuestion();
    const doc = this.quiz();
    if (!question || !doc) return;
    if (this.inlineEditMode()) return;

    this.originalQuestionSnapshot.set(this.toQuestionInput(question));
    this.quizDefaultTimerAtEditStart.set(doc.settings.defaultTimer);
    this.inlineQuizDefaultTimerDraft.set(doc.settings.defaultTimer);
    this.inlineQuestionTimerDraft.set(question.timer);
    this.inlineSkipReadingPhaseDraft.set(question.skipReadingPhase ?? false);
    this.questionDraftText.set(question.text);
    this.answerDraftTexts.set(question.answers.map((answer) => answer.text));
    this.answerDraftCorrectFlags.set(question.answers.map((answer) => answer.isCorrect));
    this.inlineEditMode.set(true);
    this.scrollInlineEditorIntoView();
  }

  /**
   * Scroll-Ziel: Bearbeitungsblock unterhalb der fixierten App-Toolbar — `#main-content` hat dafür
   * `padding-top` (siehe `app-main--toolbar-fixed`). Diesen Abstand in der Formel abziehen, sonst
   * landet der Block am oberen Rand des Main und wirkt unter der Toolbar „weggescrollt“.
   */
  private scrollInlineEditorIntoView(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const run = (): void => {
      const el = document.getElementById('quiz-preview-inline-editor') as HTMLElement | null;
      if (el) {
        this.scrollElementIntoAppShell(el);
      }
    };

    afterNextRender(
      () => {
        run();
        queueMicrotask(run);
        setTimeout(run, 0);
        requestAnimationFrame(() => {
          run();
          requestAnimationFrame(run);
        });
        setTimeout(run, 120);
        setTimeout(run, 280);
      },
      { injector: this.injector },
    );
  }

  private scrollBehavior(): ScrollBehavior {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  /**
   * Scrollt den ersten passenden Vorfahren mit Overflow — typisch `.app-main` / `#main-content`.
   * Fallback: `window`/`document.scrollingElement`, dann `scrollIntoView`.
   */
  private scrollElementIntoAppShell(el: HTMLElement): void {
    const behavior = this.scrollBehavior();
    const scrollRoot =
      (el.closest('.app-main') as HTMLElement | null) ?? this.findScrollableOverflowParent(el);

    const applyToRoot = (root: HTMLElement, b: ScrollBehavior): void => {
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      /** Entspricht dem freien Streifen unter der Toolbar (Layout-Padding von `.app-main--toolbar-fixed`). */
      const toolbarClearancePx = parseFloat(getComputedStyle(root).paddingTop) || 0;
      const gapPx = 8;
      const nextTop = elRect.top - rootRect.top + root.scrollTop - toolbarClearancePx - gapPx;
      root.scrollTo({ top: Math.max(0, nextTop), behavior: b });
    };

    if (scrollRoot) {
      applyToRoot(scrollRoot, behavior);
      setTimeout(() => applyToRoot(scrollRoot, 'auto'), 200);
      return;
    }

    const se = document.scrollingElement;
    if (se instanceof HTMLElement) {
      const elRect = el.getBoundingClientRect();
      const rootRect = se.getBoundingClientRect();
      const margin = 12;
      const nextTop = elRect.top - rootRect.top + se.scrollTop - margin;
      se.scrollTo({ top: Math.max(0, nextTop), behavior });
      return;
    }

    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
    }
  }

  private findScrollableOverflowParent(from: HTMLElement): HTMLElement | null {
    let p: HTMLElement | null = from.parentElement;
    while (p) {
      const { overflowY } = getComputedStyle(p);
      if (
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        p.scrollHeight > p.clientHeight + 1
      ) {
        return p;
      }
      p = p.parentElement;
    }
    return null;
  }

  cancelInlineEditMode(): void {
    this.resetInlineEditState();
  }

  finishInlineEditMode(): void {
    this.commitInlineEdits();
  }

  onQuestionDraftChanged(value: string): void {
    this.questionDraftText.set(value);
  }

  onAnswerDraftChanged(index: number, value: string): void {
    this.answerDraftTexts.update((current) =>
      current.map((entry, currentIndex) => (currentIndex === index ? value : entry)),
    );
  }

  toggleCorrectAnswer(index: number): void {
    const question = this.currentQuestion();
    if (!question || !this.questionTypeHasCorrectAnswers(question.type) || !this.inlineEditMode()) {
      return;
    }

    this.answerDraftCorrectFlags.update((current) =>
      current.map((isCorrect, currentIndex) => {
        if (question.type === 'SINGLE_CHOICE') {
          return currentIndex === index;
        }
        if (currentIndex === index) {
          return !isCorrect;
        }
        return isCorrect;
      }),
    );
  }

  draftAnswerIsCorrect(index: number): boolean {
    const currentAnswer = this.currentQuestion()?.answers[index];
    return this.answerDraftCorrectFlags()[index] ?? currentAnswer?.isCorrect ?? false;
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
        this.backToOrigin();
      }
      return;
    }
    if (key === 'e') {
      event.preventDefault();
      if (!this.inlineEditMode()) {
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
    return questionTypeLabelI18n(type);
  }

  questionTypeHasCorrectAnswers(type: SupportedQuestionType): boolean {
    return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
  }

  questionTypeShowsDifficulty(type: SupportedQuestionType): boolean {
    return type !== 'SURVEY' && type !== 'RATING';
  }

  difficultyLabel(value: Difficulty): string {
    switch (value) {
      case 'EASY':
        return $localize`:@@quiz.difficulty.easy:Leicht`;
      case 'MEDIUM':
        return $localize`:@@quiz.difficulty.medium:Mittel`;
      case 'HARD':
        return $localize`:@@quiz.difficulty.hard:Schwer`;
      default:
        return value;
    }
  }

  /**
   * Wie beim Live-Start: `question.timer` oder Quiz-`defaultTimer`; kein Limit wenn beides fehlt/unwirksam.
   */
  effectivePreviewTimerSeconds(question: QuizQuestion): number | null {
    const doc = this.quiz();
    if (!doc) return null;
    return resolveEffectiveQuestionTimer(
      question.timer,
      doc.settings.defaultTimer,
      question.difficulty,
      doc.settings.timerScaleByDifficulty ?? true,
    );
  }

  previewTimerAriaLabel(question: QuizQuestion): string {
    const sec = this.effectivePreviewTimerSeconds(question);
    if (sec !== null) {
      return $localize`:@@quizPreview.timerAriaWithLimit:Zeitlimit ${sec}:seconds: Sekunden`;
    }
    return $localize`:@@quizPreview.timerAriaNoLimit:Kein Zeitlimit`;
  }

  previewTitleName(quiz: QuizDocument): string {
    const n = quiz.name?.trim();
    return n && n.length > 0 ? n : $localize`:@@quizPreview.unnamedQuiz:Unbenanntes Quiz`;
  }

  answerOptionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(value, { imagePolicy: 'allow-relative-and-https' }).html,
    );
  }

  ratingScaleValues(min: number | null, max: number | null): number[] {
    const from = min ?? 1;
    const to = max ?? 5;
    if (to < from) return [];
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  }

  private persistInlineEditsNow(): void {
    const question = this.currentQuestion();
    const doc = this.quiz();
    if (!question || !doc || !this.inlineEditMode()) return;

    const nextDefault = this.inlineQuizDefaultTimerDraft();
    if (doc.settings.defaultTimer !== nextDefault) {
      this.quizStore.updateQuizSettings(this.id, { defaultTimer: nextDefault });
    }

    const answers = question.answers.map((answer, index) => ({
      text: this.answerDraftTexts()[index] ?? answer.text,
      isCorrect: this.answerDraftCorrectFlags()[index] ?? answer.isCorrect,
    }));

    this.quizStore.updateQuestion(this.id, question.id, {
      text: this.questionDraftText(),
      type: question.type,
      difficulty: question.difficulty,
      timer: this.inlineQuestionTimerDraft(),
      answers,
      skipReadingPhase: this.inlineSkipReadingPhaseDraft(),
      ratingMin: question.ratingMin,
      ratingMax: question.ratingMax,
      ratingLabelMin: question.ratingLabelMin,
      ratingLabelMax: question.ratingLabelMax,
    });
  }

  private commitInlineEdits(): void {
    if (!this.inlineEditMode()) return;
    this.persistInlineEditsNow();
    this.resetInlineEditState();
  }

  private resetInlineEditState(): void {
    this.inlineEditMode.set(false);
    this.originalQuestionSnapshot.set(null);
    this.quizDefaultTimerAtEditStart.set(undefined);
    this.inlineQuizDefaultTimerDraft.set(null);
    this.inlineQuestionTimerDraft.set(null);
    this.inlineSkipReadingPhaseDraft.set(false);
    this.questionDraftText.set('');
    this.answerDraftTexts.set([]);
    this.answerDraftCorrectFlags.set([]);
  }

  inlineGlobalTimerEnabled(): boolean {
    return this.inlineQuizDefaultTimerDraft() !== null;
  }

  onInlineGlobalTimerEnabledChange(checked: boolean): void {
    if (checked) {
      this.inlineQuizDefaultTimerDraft.update((v) => v ?? DEFAULT_TIMER_SECONDS);
    } else {
      this.inlineQuizDefaultTimerDraft.set(null);
    }
  }

  onInlineGlobalTimerSecondsChange(seconds: number): void {
    this.inlineQuizDefaultTimerDraft.set(seconds);
  }

  inlinePreviewDefaultTimerSelectOptions(): number[] {
    return mergeTimerPresetOptions(this.inlineQuizDefaultTimerDraft());
  }

  questionTimerUsesQuizDefaultInPreview(): boolean {
    return this.inlineQuestionTimerDraft() === null;
  }

  onInlineQuestionTimerInheritChange(useQuizDefault: boolean): void {
    if (useQuizDefault) {
      this.inlineQuestionTimerDraft.set(null);
    } else {
      const current = this.inlineQuestionTimerDraft();
      if (current === null) {
        const fallback =
          this.inlineQuizDefaultTimerDraft() ??
          this.quiz()?.settings.defaultTimer ??
          DEFAULT_TIMER_SECONDS;
        this.inlineQuestionTimerDraft.set(fallback);
      }
    }
  }

  onInlineQuestionTimerSecondsChange(seconds: number): void {
    this.inlineQuestionTimerDraft.set(seconds);
  }

  onInlineSkipReadingPhaseChange(checked: boolean): void {
    this.inlineSkipReadingPhaseDraft.set(checked);
  }

  inlinePreviewQuestionTimerSelectOptions(): number[] {
    return mergeTimerPresetOptions(this.inlineQuestionTimerDraft());
  }

  private toQuestionInput(question: QuizQuestion): AddQuizQuestionInput {
    return {
      text: question.text,
      type: question.type,
      difficulty: question.difficulty,
      timer: question.timer,
      answers: question.answers.map((answer) => ({
        text: answer.text,
        isCorrect: answer.isCorrect,
      })),
      skipReadingPhase: question.skipReadingPhase,
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
    this.animationNonce.update((value) => value + 1);
    this.swipeDirection.set(direction);
    this.animationTimer = setTimeout(() => {
      this.swipeDirection.set(null);
      this.animationTimer = null;
    }, 1160);
  }

  private async startLiveSession(): Promise<void> {
    this.liveStartError.set(null);
    this.liveStartPending.set(true);
    if (isPlatformBrowser(this.platformId)) {
      tryRequestDocumentFullscreen(this.document);
    }
    try {
      let payload = this.quizStore.getUploadPayload(this.id);
      const presetKey = homePresetOptionsKeyForQuizPreset(payload.preset);
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(presetKey) : null;
        const parsed = raw ? (JSON.parse(raw) as unknown) : null;
        const entry = PresetStorageEntrySchema.safeParse(parsed);
        if (entry.success) {
          const storedOptions = entry.data.options;
          /** Wie quiz-list: fehlender Chip = Quiz-Wert behalten, nicht false. */
          const optionEnabled = (id: string, fallback: boolean) =>
            id in storedOptions ? storedOptions[id] === true : fallback;
          const effectiveTeamMode = optionEnabled('teamMode', false) || payload.teamMode;
          payload = {
            ...payload,
            // Namensliste / Anonymität: immer aus dem Quiz (Snackbar-Preset überschreibt das nicht).
            showLeaderboard: optionEnabled('showLeaderboard', payload.showLeaderboard),
            enableRewardEffects: optionEnabled('enableRewardEffects', payload.enableRewardEffects),
            enableMotivationMessages: optionEnabled(
              'enableMotivationMessages',
              payload.enableMotivationMessages,
            ),
            enableEmojiReactions: optionEnabled(
              'enableEmojiReactions',
              payload.enableEmojiReactions,
            ),
            enableSoundEffects: optionEnabled('enableSoundEffects', payload.enableSoundEffects),
            readingPhaseEnabled: optionEnabled(
              'readingPhaseEnabled',
              payload.readingPhaseEnabled ?? true,
            ),
            teamMode: effectiveTeamMode,
            teamAssignment: optionEnabled('teamMode', false)
              ? optionEnabled('teamAssignment', false)
                ? 'MANUAL'
                : 'AUTO'
              : (payload.teamAssignment ?? 'AUTO'),
            teamCount: optionEnabled('teamMode', false)
              ? (entry.data.teamCountValue ?? payload.teamCount)
              : payload.teamCount,
            bonusTokenCount: optionEnabled('bonusTokenCount', false)
              ? (payload.bonusTokenCount ?? DEFAULT_BONUS_TOKEN_COUNT)
              : payload.bonusTokenCount,
            defaultTimer: optionEnabled('defaultTimer', typeof payload.defaultTimer === 'number')
              ? (payload.defaultTimer ?? DEFAULT_TIMER_SECONDS)
              : null,
          };
        }
      } catch {
        // Preset-Optionen nicht lesbar → Quiz-Einstellungen unverändert nutzen
      }

      const { quizId: uploadedQuizId } = await trpc.quiz.upload.mutate(payload);
      this.quizStore.setLastServerUploadAccess(
        this.id,
        uploadedQuizId,
        await createQuizHistoryAccessProof(payload),
      );
      const result: CreateSessionOutput = await trpc.session.create.mutate({
        quizId: uploadedQuizId,
        type: 'QUIZ',
      });

      setHostToken(result.code, result.hostToken);
      setPendingHostSessionCode(result.code);
      try {
        await navigateToHostSession(this.router, result.code, 'quiz');
      } finally {
        clearPendingHostSessionCode();
      }
    } catch {
      this.liveStartError.set($localize`Veranstaltung konnte nicht gestartet werden.`);
    } finally {
      this.liveStartPending.set(false);
    }
  }
}
