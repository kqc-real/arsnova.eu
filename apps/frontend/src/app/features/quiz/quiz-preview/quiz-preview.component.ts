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
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  createQuizHistoryAccessProof,
  PresetStorageEntrySchema,
  DEFAULT_BONUS_TOKEN_COUNT,
  DEFAULT_TIMER_SECONDS,
  SHORT_TEXT_DEFAULT_EVALUATION_MODE,
  SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
  questionSupportsConfidence,
  resolveShortTextMaxLength,
  resolveEffectiveQuestionTimer,
  type CreateSessionOutput,
  type Difficulty,
  type MatchingPairInput,
  type OrderingItemInput,
  type CategorizationCategoryInput,
  type CategorizationItemInput,
  type QuestionNumericToleranceMode,
  type QuizUploadInput,
  type ShortAnswerEvaluationMode,
  type ToleranceLevel,
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
import { LocaleSwitchGuardService } from '../../../core/locale-switch-guard.service';
import { localizeCommands } from '../../../core/locale-router';
import { confirmDiscardUnsavedChanges } from '../../../shared/confirm-leave-dialog/confirm-unsaved-changes';
import { decorateLeadingAnswerEmoji } from '../../../shared/leading-answer-emoji.util';
import { answerOptionColor, answerOptionShape } from '../../../shared/answer-option-badge.util';
import { AnswerOptionBadgeComponent } from '../../../shared/answer-option-badge/answer-option-badge.component';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { MarkdownKatexEditorComponent } from '../../../shared/markdown-katex-editor/markdown-katex-editor.component';
import { MarkdownImageLightboxDirective } from '../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { questionTypeLabel as questionTypeLabelI18n } from '../../../shared/question-type-label';
import { mergeTimerPresetOptions } from '../default-timer-presets';
import { tryAutoRequestDocumentFullscreen } from '../../../core/document-fullscreen.util';
import { localizeKnownServerError } from '../../../core/localize-known-server-message';

type LiveStartMode = 'full' | 'current';
type PreviewValidationWarning = { index: number; message: string };
type NumericEstimateDraft = {
  numericToleranceMode: QuestionNumericToleranceMode | null;
  numericReferenceValue: number | null;
  numericTolerancePercent: number | null;
  numericIntervalLeft: number | null;
  numericIntervalRight: number | null;
  numericInputType: 'INTEGER' | 'DECIMAL' | null;
  numericDecimalPlaces: number | null;
  numericMin: number | null;
  numericMax: number | null;
  numericTwoRounds: boolean;
};

function usesClassicAnswerOptions(type: SupportedQuestionType): boolean {
  return (
    type === 'SINGLE_CHOICE' ||
    type === 'MULTIPLE_CHOICE' ||
    type === 'SURVEY' ||
    type === 'SHORT_TEXT'
  );
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

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
    MatIconButton,
    MatCard,
    MatCardContent,
    MatIcon,
    MatProgressBar,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MarkdownKatexEditorComponent,
    MarkdownImageLightboxDirective,
    AnswerOptionBadgeComponent,
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly localeGuard = inject(LocaleSwitchGuardService);
  private readonly markdownCache = new Map<string, SafeHtml>();
  private readonly answerMarkdownCache = new Map<string, SafeHtml>();
  private animationTimer: ReturnType<typeof setTimeout> | null = null;
  private touchStartX: number | null = null;
  private readonly localeDirtyGetter = (): boolean => this.inlineEditHasChanges();
  private confirmDiscardInFlight: Promise<boolean> | null = null;

  readonly id = this.route.parent?.snapshot.paramMap.get('id') ?? '';
  readonly currentIndex = signal(0);
  readonly inlineEditMode = signal(false);
  readonly questionDraftText = signal('');
  readonly answerDraftTexts = signal<string[]>([]);
  readonly answerDraftCorrectFlags = signal<boolean[]>([]);
  readonly orderingDraftTexts = signal<string[]>([]);
  readonly matchingDraftPairs = signal<Array<{ left: string; right: string }>>([]);
  readonly categoryDraftNames = signal<string[]>([]);
  readonly categorizationItemDrafts = signal<Array<{ text: string; correctCategoryId: string }>>(
    [],
  );
  readonly numericEstimateDraft = signal<NumericEstimateDraft | null>(null);
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

    const orderingItems = this.mergeOrderingDrafts(question);
    const matchingPairs = this.mergeMatchingDrafts(question);
    const categories = this.mergeCategoryDrafts(question);
    const categorizationItems = this.mergeCategorizationItemDrafts(question);
    const numeric = this.numericEstimateDraft();

    return {
      ...question,
      text: this.questionDraftText(),
      answers: question.answers.map((answer, index) => ({
        ...answer,
        text: this.answerDraftTexts()[index] ?? answer.text,
        isCorrect: this.answerDraftCorrectFlags()[index] ?? answer.isCorrect,
      })),
      ...(question.type === 'ORDERING' ? { orderingItems } : {}),
      ...(question.type === 'MATCHING' ? { matchingPairs } : {}),
      ...(question.type === 'CATEGORIZATION' ? { categories, categorizationItems } : {}),
      ...(question.type === 'NUMERIC_ESTIMATE' && numeric
        ? {
            numericToleranceMode: numeric.numericToleranceMode,
            numericReferenceValue: numeric.numericReferenceValue,
            numericTolerancePercent: numeric.numericTolerancePercent,
            numericIntervalLeft: numeric.numericIntervalLeft,
            numericIntervalRight: numeric.numericIntervalRight,
            numericInputType: numeric.numericInputType,
            numericDecimalPlaces: numeric.numericDecimalPlaces,
            numericMin: numeric.numericMin,
            numericMax: numeric.numericMax,
            numericTwoRounds: numeric.numericTwoRounds,
          }
        : {}),
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

    if (this.structuredInlineDraftsDiffer(original)) {
      return true;
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
  readonly validationWarnings = computed(() => this.buildValidationWarningsFromStartIndex(0));
  readonly currentStartValidationWarnings = computed(() =>
    this.currentIndex() > 0 ? this.buildValidationWarningsFromStartIndex(this.currentIndex()) : [],
  );
  readonly currentQuestionValidation = computed(() => {
    const question = this.displayedQuestion();
    if (!question) {
      return {
        hasIssues: false,
        needsMoreAnswers: false,
        needsCorrectAnswer: false,
        needsShortTextSolutions: false,
      };
    }

    const needsMoreAnswers =
      (question.type === 'SINGLE_CHOICE' ||
        question.type === 'MULTIPLE_CHOICE' ||
        question.type === 'SURVEY') &&
      question.answers.length < 2;
    const needsShortTextSolutions = question.type === 'SHORT_TEXT' && question.answers.length < 1;

    const correctCount = question.answers.filter((answer) => answer.isCorrect).length;
    const needsCorrectAnswer =
      (question.type === 'SINGLE_CHOICE' && correctCount !== 1) ||
      (question.type === 'MULTIPLE_CHOICE' && correctCount < 1);

    return {
      hasIssues: needsMoreAnswers || needsCorrectAnswer || needsShortTextSolutions,
      needsMoreAnswers,
      needsCorrectAnswer,
      needsShortTextSolutions,
    };
  });

  constructor() {
    if (this.id === DEMO_QUIZ_ID) {
      this.quizStore.ensureDemoQuiz();
    }
    this.localeGuard.register(this.localeDirtyGetter);
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
    this.localeGuard.unregister(this.localeDirtyGetter);
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  }

  /**
   * Zustandsfrei: bei Bestätigung den Entwurf nicht verwerfen.
   * Sonst gehen Änderungen verloren, wenn ein späterer Guard die Navigation ablehnt.
   */
  async canDeactivate(): Promise<boolean> {
    return this.confirmDiscardUnsavedIfNeeded();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.localeGuard.isFullPageUnloadConfirmed()) return;
    if (!this.inlineEditHasChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  async nextQuestion(): Promise<void> {
    const total = this.questions().length;
    if (total === 0) return;
    const nextIndex = Math.min(this.currentIndex() + 1, total - 1);
    if (nextIndex === this.currentIndex()) return;
    if (!(await this.prepareLeaveInlineEdit())) return;
    this.currentIndex.set(nextIndex);
    this.triggerSwipeAnimation('left');
  }

  async previousQuestion(): Promise<void> {
    const previousIndex = Math.max(this.currentIndex() - 1, 0);
    if (previousIndex === this.currentIndex()) return;
    if (!(await this.prepareLeaveInlineEdit())) return;
    this.currentIndex.set(previousIndex);
    this.triggerSwipeAnimation('right');
  }

  async goToQuestion(index: number): Promise<void> {
    const total = this.questions().length;
    if (index < 0 || index >= total) return;
    const currentIndex = this.currentIndex();
    if (index === currentIndex) return;
    if (!(await this.prepareLeaveInlineEdit())) return;
    this.currentIndex.set(index);
    this.triggerSwipeAnimation(index > currentIndex ? 'left' : 'right');
  }

  questionAriaLabel(index: number): string {
    return $localize`Frage ${index + 1}`;
  }

  goFirst(): void {
    void this.goToQuestion(0);
  }

  goLast(): void {
    const total = this.questions().length;
    if (total === 0) return;
    void this.goToQuestion(total - 1);
  }

  async backToOrigin(): Promise<void> {
    if (!(await this.prepareLeaveInlineEdit())) return;
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
    await this.openLiveStartDialogForMode(this.currentIndex() > 0 ? 'current' : 'full');
  }

  async openLiveStartDialogForMode(mode: LiveStartMode): Promise<void> {
    const quiz = this.quiz();
    if (!quiz || this.questions().length === 0 || this.liveStartPending()) return;
    if (mode === 'current' && this.currentStartValidationWarnings().length > 0) {
      return;
    }
    if (mode === 'full' && this.validationWarnings().length > 0) {
      return;
    }
    if (!(await this.prepareLeaveInlineEdit())) return;
    await this.startLiveSession(mode);
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
    this.orderingDraftTexts.set((question.orderingItems ?? []).map((item) => item.text));
    this.matchingDraftPairs.set(
      (question.matchingPairs ?? []).map((pair) => ({ left: pair.left, right: pair.right })),
    );
    this.categoryDraftNames.set((question.categories ?? []).map((category) => category.name));
    this.categorizationItemDrafts.set(
      (question.categorizationItems ?? []).map((item) => ({
        text: item.text,
        correctCategoryId: item.correctCategoryId,
      })),
    );
    this.numericEstimateDraft.set(
      question.type === 'NUMERIC_ESTIMATE'
        ? {
            numericToleranceMode: question.numericToleranceMode ?? 'ABSOLUTE_INTERVAL',
            numericReferenceValue: question.numericReferenceValue ?? null,
            numericTolerancePercent: question.numericTolerancePercent ?? null,
            numericIntervalLeft: question.numericIntervalLeft ?? null,
            numericIntervalRight: question.numericIntervalRight ?? null,
            numericInputType: question.numericInputType ?? 'DECIMAL',
            numericDecimalPlaces: question.numericDecimalPlaces ?? null,
            numericMin: question.numericMin ?? null,
            numericMax: question.numericMax ?? null,
            numericTwoRounds: question.numericTwoRounds ?? false,
          }
        : null,
    );
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
    this.focusEditActionAfterInlineClose();
  }

  finishInlineEditMode(): boolean {
    const saved = this.commitInlineEdits();
    if (saved) {
      this.focusEditActionAfterInlineClose();
    }
    return saved;
  }

  /**
   * Schließt den Inline-Editor nach Bestätigung bei offenen Änderungen.
   * Explizites „Änderungen verwerfen“ ruft `cancelInlineEditMode()` direkt auf.
   */
  private async prepareLeaveInlineEdit(): Promise<boolean> {
    if (!this.inlineEditMode()) return true;
    if (!(await this.confirmDiscardUnsavedIfNeeded())) return false;
    if (this.inlineEditMode()) {
      this.cancelInlineEditMode();
    }
    return true;
  }

  private async confirmDiscardUnsavedIfNeeded(): Promise<boolean> {
    if (!this.inlineEditHasChanges()) return true;
    if (this.confirmDiscardInFlight) return this.confirmDiscardInFlight;
    this.confirmDiscardInFlight = confirmDiscardUnsavedChanges(this.dialog, () =>
      this.finishInlineEditMode(),
    ).finally(() => {
      this.confirmDiscardInFlight = null;
    });
    return this.confirmDiscardInFlight;
  }

  private async handleEscapeKey(): Promise<void> {
    if (this.inlineEditMode()) {
      if (!(await this.prepareLeaveInlineEdit())) return;
      return;
    }
    await this.backToOrigin();
  }

  /** Nach Schließen des Inline-Editors Fokus auf den sichtbaren „Bearbeiten“-Button legen. */
  private focusEditActionAfterInlineClose(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    afterNextRender(
      () => {
        const editButton = this.document.querySelector<HTMLButtonElement>(
          'button.quiz-preview__edit-action',
        );
        if (
          !editButton ||
          editButton.disabled ||
          editButton.getAttribute('aria-hidden') === 'true'
        ) {
          return;
        }
        editButton.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  onQuestionDraftChanged(value: string): void {
    this.questionDraftText.set(value);
  }

  onAnswerDraftChanged(index: number, value: string): void {
    this.answerDraftTexts.update((current) =>
      current.map((entry, currentIndex) => (currentIndex === index ? value : entry)),
    );
  }

  onOrderingDraftChanged(index: number, value: string): void {
    this.orderingDraftTexts.update((current) =>
      current.map((entry, currentIndex) => (currentIndex === index ? value : entry)),
    );
  }

  onMatchingDraftChanged(index: number, side: 'left' | 'right', value: string): void {
    this.matchingDraftPairs.update((current) =>
      current.map((pair, currentIndex) =>
        currentIndex === index ? { ...pair, [side]: value } : pair,
      ),
    );
  }

  onCategoryDraftChanged(index: number, value: string): void {
    this.categoryDraftNames.update((current) =>
      current.map((entry, currentIndex) => (currentIndex === index ? value : entry)),
    );
  }

  onCategorizationItemTextChanged(index: number, value: string): void {
    this.categorizationItemDrafts.update((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, text: value } : item,
      ),
    );
  }

  onCategorizationItemCategoryChanged(index: number, categoryId: string): void {
    this.categorizationItemDrafts.update((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, correctCategoryId: categoryId } : item,
      ),
    );
  }

  onNumericEstimateDraftChanged<K extends keyof NumericEstimateDraft>(
    key: K,
    value: NumericEstimateDraft[K],
  ): void {
    this.numericEstimateDraft.update((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  onNumericEstimateNumberChanged(
    key:
      | 'numericReferenceValue'
      | 'numericTolerancePercent'
      | 'numericIntervalLeft'
      | 'numericIntervalRight'
      | 'numericDecimalPlaces'
      | 'numericMin'
      | 'numericMax',
    raw: string,
  ): void {
    this.onNumericEstimateDraftChanged(key, parseOptionalNumber(raw));
  }

  usesClassicAnswerOptions(type: SupportedQuestionType): boolean {
    return usesClassicAnswerOptions(type);
  }

  draftCategories(): Array<{ id: string; name: string }> {
    const question = this.currentQuestion();
    if (!question) return [];
    return this.mergeCategoryDrafts(question);
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
      void this.nextQuestion();
    } else {
      void this.previousQuestion();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.quiz() || this.questions().length === 0) return;
    if (event.defaultPrevented) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      void this.handleEscapeKey();
      return;
    }

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
      void this.nextQuestion();
      return;
    }
    if (event.key === 'ArrowLeft' || key === 'p') {
      event.preventDefault();
      void this.previousQuestion();
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
    if (key === 'e') {
      event.preventDefault();
      if (!this.inlineEditMode()) {
        this.enterInlineEditMode();
      }
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      void this.goToQuestion(Number(event.key) - 1);
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

  private mergeOrderingDrafts(question: QuizQuestion): OrderingItemInput[] {
    const drafts = this.orderingDraftTexts();
    return (question.orderingItems ?? []).map((item, index) => ({
      ...item,
      text: drafts[index] ?? item.text,
    }));
  }

  private mergeMatchingDrafts(question: QuizQuestion): MatchingPairInput[] {
    const drafts = this.matchingDraftPairs();
    return (question.matchingPairs ?? []).map((pair, index) => ({
      ...pair,
      left: drafts[index]?.left ?? pair.left,
      right: drafts[index]?.right ?? pair.right,
    }));
  }

  private mergeCategoryDrafts(question: QuizQuestion): CategorizationCategoryInput[] {
    const drafts = this.categoryDraftNames();
    return (question.categories ?? []).map((category, index) => ({
      ...category,
      name: drafts[index] ?? category.name,
    }));
  }

  private mergeCategorizationItemDrafts(question: QuizQuestion): CategorizationItemInput[] {
    const drafts = this.categorizationItemDrafts();
    return (question.categorizationItems ?? []).map((item, index) => ({
      ...item,
      text: drafts[index]?.text ?? item.text,
      correctCategoryId: drafts[index]?.correctCategoryId ?? item.correctCategoryId,
    }));
  }

  private structuredInlineDraftsDiffer(original: AddQuizQuestionInput): boolean {
    if (original.type === 'ORDERING') {
      const originalItems = original.orderingItems ?? [];
      const drafts = this.orderingDraftTexts();
      if (drafts.length !== originalItems.length) return true;
      return drafts.some((text, index) => text !== (originalItems[index]?.text ?? ''));
    }

    if (original.type === 'MATCHING') {
      const originalPairs = original.matchingPairs ?? [];
      const drafts = this.matchingDraftPairs();
      if (drafts.length !== originalPairs.length) return true;
      return drafts.some(
        (pair, index) =>
          pair.left !== (originalPairs[index]?.left ?? '') ||
          pair.right !== (originalPairs[index]?.right ?? ''),
      );
    }

    if (original.type === 'CATEGORIZATION') {
      const originalCategories = original.categories ?? [];
      const originalItems = original.categorizationItems ?? [];
      const categoryDrafts = this.categoryDraftNames();
      const itemDrafts = this.categorizationItemDrafts();
      if (
        categoryDrafts.length !== originalCategories.length ||
        itemDrafts.length !== originalItems.length
      ) {
        return true;
      }
      if (categoryDrafts.some((name, index) => name !== (originalCategories[index]?.name ?? ''))) {
        return true;
      }
      return itemDrafts.some(
        (item, index) =>
          item.text !== (originalItems[index]?.text ?? '') ||
          item.correctCategoryId !== (originalItems[index]?.correctCategoryId ?? ''),
      );
    }

    if (original.type === 'NUMERIC_ESTIMATE') {
      const draft = this.numericEstimateDraft();
      if (!draft) return false;
      return (
        (draft.numericToleranceMode ?? null) !== (original.numericToleranceMode ?? null) ||
        (draft.numericReferenceValue ?? null) !== (original.numericReferenceValue ?? null) ||
        (draft.numericTolerancePercent ?? null) !== (original.numericTolerancePercent ?? null) ||
        (draft.numericIntervalLeft ?? null) !== (original.numericIntervalLeft ?? null) ||
        (draft.numericIntervalRight ?? null) !== (original.numericIntervalRight ?? null) ||
        (draft.numericInputType ?? null) !== (original.numericInputType ?? null) ||
        (draft.numericDecimalPlaces ?? null) !== (original.numericDecimalPlaces ?? null) ||
        (draft.numericMin ?? null) !== (original.numericMin ?? null) ||
        (draft.numericMax ?? null) !== (original.numericMax ?? null) ||
        draft.numericTwoRounds !== (original.numericTwoRounds ?? false)
      );
    }

    return false;
  }

  getCategorizationItemsForCategory(question: QuizQuestion, categoryId: string) {
    return (question.categorizationItems || []).filter(
      (item) => item.correctCategoryId === categoryId,
    );
  }

  shortTextConfigSummary(
    question: Pick<
      QuizQuestion,
      | 'shortTextMaxLength'
      | 'shortTextCaseSensitive'
      | 'shortTextEvaluationMode'
      | 'shortTextToleranceLevel'
      | 'shortTextAllowPartialCredit'
      | 'shortTextTrimWhitespace'
      | 'shortTextNormalizeWhitespace'
    >,
  ): string {
    const parts = [
      $localize`:@@quizEdit.shortTextMaxLengthSummary:Max. ${resolveShortTextMaxLength(question.shortTextMaxLength)}:maxLength: Zeichen`,
      this.shortTextEvaluationModeLabel(question.shortTextEvaluationMode),
    ];
    if ((question.shortTextEvaluationMode ?? SHORT_TEXT_DEFAULT_EVALUATION_MODE) !== 'exact') {
      parts.push(
        $localize`:@@quizEdit.shortTextToleranceSummary:Toleranz: ${this.shortTextToleranceLabel(question.shortTextToleranceLevel)}:tolerance:`,
      );
    }
    if (question.shortTextCaseSensitive) {
      parts.push($localize`:@@quizEdit.shortTextCaseSensitiveSummary:Groß-/Kleinschreibung zählt`);
    }
    if ((question.shortTextAllowPartialCredit ?? true) === false) {
      parts.push($localize`:@@quizEdit.shortTextFullCreditOnlySummary:Nur volle Punkte`);
    }
    if (
      (question.shortTextTrimWhitespace ?? true) === false ||
      (question.shortTextNormalizeWhitespace ?? true) === false
    ) {
      parts.push(
        $localize`:@@quizEdit.shortTextWhitespaceStrictSummary:Leerzeichen werden streng geprüft`,
      );
    }
    return parts.join(' · ');
  }

  shortTextEvaluationModeLabel(mode: ShortAnswerEvaluationMode | null | undefined): string {
    switch (mode ?? SHORT_TEXT_DEFAULT_EVALUATION_MODE) {
      case 'exact':
        return $localize`:@@quizEdit.shortTextModeExactLabel:Nur exakt gleich`;
      case 'hamming':
        return $localize`:@@quizEdit.shortTextModeHammingLabel:Gleiche Länge, kleine Buchstabendreher`;
      case 'levenshtein':
        return $localize`:@@quizEdit.shortTextModeLevenshteinLabel:Auch fehlende oder zusätzliche Zeichen erlauben`;
      default:
        return $localize`:@@quizEdit.shortTextModeAutoLabel:Kleine Tippfehler erlauben`;
    }
  }

  shortTextToleranceLabel(level: ToleranceLevel | null | undefined): string {
    switch (level ?? SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL) {
      case 'none':
        return $localize`:@@quizEdit.shortTextToleranceNone:Keine Toleranz`;
      case 'medium':
        return $localize`:@@quizEdit.shortTextToleranceMedium:Mittel`;
      case 'high':
        return $localize`:@@quizEdit.shortTextToleranceHigh:Großzügig`;
      default:
        return $localize`:@@quizEdit.shortTextToleranceLow:Wenig`;
    }
  }

  shortTextDidacticWarning(): string {
    return $localize`:@@quizEdit.shortTextDidacticWarning:Verwende tolerante Bewertung nur bei eindeutigen Fachbegriffen. Für offene Formulierungen sind mehrere Musterlösungen meist fairer als hohe Toleranz.`;
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

  previewAnswerColor(index: number): string {
    return answerOptionColor(index);
  }

  previewAnswerShape(index: number, questionType: SupportedQuestionType): string {
    return answerOptionShape(
      index,
      questionType,
      this.quiz()?.settings.showQuestionTypeIndicators ?? true,
    );
  }

  showQuestionTypeIndicators(): boolean {
    return this.quiz()?.settings.showQuestionTypeIndicators !== false;
  }

  renderMarkdown(value: string): SafeHtml {
    const cached = this.markdownCache.get(value);
    if (cached) {
      return cached;
    }
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(value, {
        imagePolicy: 'allow-relative-and-https',
        headingStartLevel: 3,
      }).html,
    );
    this.markdownCache.set(value, rendered);
    return rendered;
  }

  renderAnswerMarkdown(value: string): SafeHtml {
    const cached = this.answerMarkdownCache.get(value);
    if (cached) {
      return cached;
    }
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      decorateLeadingAnswerEmoji(
        renderMarkdownWithKatex(value, {
          imagePolicy: 'allow-relative-and-https',
          headingStartLevel: 4,
          escapeListMarkers: true,
        }).html,
      ),
    );
    this.answerMarkdownCache.set(value, rendered);
    return rendered;
  }

  /** Ordering-Item-Text inkl. führender Zahlen (z. B. „9. November“); escapeListMarkers verhindert <ol>. */
  renderOrderingItemMarkdown(value: string): SafeHtml {
    return this.renderAnswerMarkdown(value);
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

    const base = this.toQuestionInput(question);
    const numeric = this.numericEstimateDraft();

    this.quizStore.updateQuestion(this.id, question.id, {
      ...base,
      text: this.questionDraftText(),
      timer: this.inlineQuestionTimerDraft(),
      answers,
      skipReadingPhase: this.inlineSkipReadingPhaseDraft(),
      ...(question.type === 'ORDERING'
        ? { orderingItems: this.mergeOrderingDrafts(question) }
        : {}),
      ...(question.type === 'MATCHING'
        ? {
            matchingPairs: this.mergeMatchingDrafts(question),
            matchingShuffleRight: question.matchingShuffleRight ?? true,
          }
        : {}),
      ...(question.type === 'CATEGORIZATION'
        ? {
            categories: this.mergeCategoryDrafts(question),
            categorizationItems: this.mergeCategorizationItemDrafts(question),
            categorizationShuffleItems: question.categorizationShuffleItems ?? true,
          }
        : {}),
      ...(question.type === 'NUMERIC_ESTIMATE' && numeric
        ? {
            numericToleranceMode: numeric.numericToleranceMode ?? undefined,
            numericReferenceValue: numeric.numericReferenceValue,
            numericTolerancePercent: numeric.numericTolerancePercent,
            numericIntervalLeft: numeric.numericIntervalLeft,
            numericIntervalRight: numeric.numericIntervalRight,
            numericInputType: numeric.numericInputType ?? undefined,
            numericDecimalPlaces: numeric.numericDecimalPlaces,
            numericMin: numeric.numericMin,
            numericMax: numeric.numericMax,
            numericTwoRounds: numeric.numericTwoRounds,
          }
        : {}),
    });
  }

  private commitInlineEdits(): boolean {
    if (!this.inlineEditMode()) return true;
    const shouldShowSaveConfirmation = this.inlineEditHasChanges();
    if (shouldShowSaveConfirmation) {
      try {
        this.persistInlineEditsNow();
      } catch (error) {
        this.snackBar.open(
          localizeKnownServerError(
            error,
            $localize`:@@quizPreview.saveError:Änderungen konnten nicht gespeichert werden.`,
          ),
          '',
          {
            duration: 8000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
          },
        );
        return false;
      }
    }
    this.resetInlineEditState();
    if (shouldShowSaveConfirmation) {
      this.showSaveConfirmation();
    }
    return true;
  }

  private showSaveConfirmation(): void {
    this.snackBar.open(
      $localize`:@@quizPreview.saveConfirmation:Gespeichert. Deine Änderungen sind jetzt in der Vorschau und im Live-Quiz übernommen.`,
      '',
      {
        duration: 6000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
      },
    );
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
    this.orderingDraftTexts.set([]);
    this.matchingDraftPairs.set([]);
    this.categoryDraftNames.set([]);
    this.categorizationItemDrafts.set([]);
    this.numericEstimateDraft.set(null);
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
      skipReadingPhase: question.skipReadingPhase ?? false,
      ...(question.type === 'RATING'
        ? {
            ratingMin: question.ratingMin ?? 1,
            ratingMax: question.ratingMax ?? 5,
            ratingLabelMin: question.ratingLabelMin ?? '',
            ratingLabelMax: question.ratingLabelMax ?? '',
          }
        : {}),
      ...(question.type === 'SHORT_TEXT'
        ? {
            shortTextEvaluationKind: question.shortTextEvaluationKind,
            shortTextMaxLength: question.shortTextMaxLength,
            shortTextCaseSensitive: question.shortTextCaseSensitive,
            shortTextEvaluationMode: question.shortTextEvaluationMode,
            shortTextToleranceLevel: question.shortTextToleranceLevel,
            shortTextAllowPartialCredit: question.shortTextAllowPartialCredit,
            shortTextTrimWhitespace: question.shortTextTrimWhitespace,
            shortTextNormalizeWhitespace: question.shortTextNormalizeWhitespace,
            numericInputKind: question.numericInputKind,
            numericToleranceMode: question.numericToleranceMode,
            numericAbsoluteTolerance: question.numericAbsoluteTolerance,
            numericRelativeTolerancePercent: question.numericRelativeTolerancePercent,
            numericUnitFamily: question.numericUnitFamily,
            numericRequireUnit: question.numericRequireUnit,
            numericAcceptEquivalentUnits: question.numericAcceptEquivalentUnits,
          }
        : {}),
      ...(question.type === 'NUMERIC_ESTIMATE'
        ? {
            numericToleranceMode: question.numericToleranceMode,
            numericReferenceValue: question.numericReferenceValue,
            numericTolerancePercent: question.numericTolerancePercent,
            numericIntervalLeft: question.numericIntervalLeft,
            numericIntervalRight: question.numericIntervalRight,
            numericInputType: question.numericInputType,
            numericDecimalPlaces: question.numericDecimalPlaces,
            numericMin: question.numericMin,
            numericMax: question.numericMax,
            numericTwoRounds: question.numericTwoRounds,
          }
        : {}),
      ...(question.type === 'MATCHING'
        ? {
            matchingPairs: question.matchingPairs?.map((pair) => ({ ...pair })) ?? [],
            matchingShuffleRight: question.matchingShuffleRight ?? true,
          }
        : {}),
      ...(question.type === 'ORDERING'
        ? {
            orderingItems: question.orderingItems?.map((item) => ({ ...item })) ?? [],
          }
        : {}),
      ...(question.type === 'CATEGORIZATION'
        ? {
            categories: question.categories?.map((category) => ({ ...category })) ?? [],
            categorizationItems: question.categorizationItems?.map((item) => ({ ...item })) ?? [],
            categorizationShuffleItems: question.categorizationShuffleItems ?? true,
          }
        : {}),
      ...(questionSupportsConfidence(question.type)
        ? {
            confidenceEnabled: question.confidenceEnabled ?? false,
            confidenceLabelLow: question.confidenceLabelLow ?? null,
            confidenceLabelHigh: question.confidenceLabelHigh ?? null,
          }
        : {}),
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

  private buildValidationWarnings(
    questions: ReadonlyArray<QuizDocument['questions'][number]>,
    indexOffset = 0,
  ): PreviewValidationWarning[] {
    return questions
      .map((question, index) => {
        const displayIndex = indexOffset + index + 1;
        if (
          (question.type === 'SINGLE_CHOICE' ||
            question.type === 'MULTIPLE_CHOICE' ||
            question.type === 'SURVEY') &&
          question.answers.length < 2
        ) {
          return {
            index: indexOffset + index,
            message: $localize`Frage ${displayIndex}:questionNumber:: weniger als 2 Antworten`,
          };
        }
        if (question.type === 'SINGLE_CHOICE') {
          const count = question.answers.filter((answer) => answer.isCorrect).length;
          if (count !== 1) {
            return {
              index: indexOffset + index,
              message: $localize`Frage ${displayIndex}:questionNumber:: keine richtige Antwort gewählt`,
            };
          }
        }
        if (question.type === 'MULTIPLE_CHOICE') {
          const count = question.answers.filter((answer) => answer.isCorrect).length;
          if (count < 1) {
            return {
              index: indexOffset + index,
              message: $localize`Frage ${displayIndex}:questionNumber:: keine richtige Antwort gewählt`,
            };
          }
        }
        if (question.type === 'SHORT_TEXT' && question.answers.length < 1) {
          return {
            index: indexOffset + index,
            message: $localize`:@@quizPreview.warningShortTextSolutionsMissing:Frage ${displayIndex}:questionNumber:: mindestens eine Musterlösung fehlt`,
          };
        }
        return null;
      })
      .filter((entry): entry is PreviewValidationWarning => entry !== null);
  }

  private buildValidationWarningsFromStartIndex(startIndex: number): PreviewValidationWarning[] {
    const questions = this.questions();
    const normalizedStartIndex = Math.max(0, Math.min(startIndex, questions.length));
    return this.buildValidationWarnings(
      questions.slice(normalizedStartIndex),
      normalizedStartIndex,
    );
  }

  private liveStartQuestionIndex(
    mode: LiveStartMode,
    questionCount = this.questions().length,
  ): number {
    if (mode !== 'current') {
      return 0;
    }
    const normalizedStartIndex = Math.max(
      0,
      Math.min(this.currentIndex(), Math.max(0, questionCount - 1)),
    );
    return normalizedStartIndex;
  }

  private buildLiveStartPayload(_mode: LiveStartMode): QuizUploadInput {
    return this.quizStore.getUploadPayload(this.id);
  }

  private async startLiveSession(mode: LiveStartMode): Promise<void> {
    this.liveStartError.set(null);
    this.liveStartPending.set(true);
    if (isPlatformBrowser(this.platformId)) {
      tryAutoRequestDocumentFullscreen(this.document);
    }
    try {
      let payload = this.buildLiveStartPayload(mode);
      const startQuestionIndex = this.liveStartQuestionIndex(mode, payload.questions.length);
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
        ...(startQuestionIndex > 0 ? { startQuestionIndex } : {}),
      });

      setHostToken(result.code, result.hostToken);
      setPendingHostSessionCode(result.code);
      try {
        await navigateToHostSession(this.router, result.code, 'quiz');
      } finally {
        clearPendingHostSessionCode();
      }
    } catch (error) {
      this.liveStartError.set(
        localizeKnownServerError(error, $localize`Veranstaltung konnte nicht gestartet werden.`),
      );
    } finally {
      this.liveStartPending.set(false);
    }
  }
}
