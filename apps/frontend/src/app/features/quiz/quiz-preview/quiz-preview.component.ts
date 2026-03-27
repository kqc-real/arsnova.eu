import { Location } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import {
  PresetStorageEntrySchema,
  DEFAULT_BONUS_TOKEN_COUNT,
  DEFAULT_TIMER_SECONDS,
  type Difficulty,
} from '@arsnova/shared-types';
import { firstValueFrom } from 'rxjs';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { trpc } from '../../../core/trpc.client';
import {
  DEMO_QUIZ_ID,
  QuizStoreService,
  type AddQuizQuestionInput,
  type QuizQuestion,
  type SupportedQuestionType,
} from '../data/quiz-store.service';
import { LiveSessionDialogComponent } from '../quiz-list/live-session-dialog.component';
import { localizeCommands } from '../../../core/locale-router';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { questionTypeLabel as questionTypeLabelI18n } from '../../../shared/question-type-label';

const PRESET_OPTIONS_STORAGE_PREFIX = 'home-preset-options-';

/**
 * Quiz-Preview & Schnellkorrektur (Epic 1).
 * Story 1.13, 1.7 (Markdown/KaTeX).
 */
@Component({
  selector: 'app-quiz-preview',
  standalone: true,
  imports: [RouterLink, MatButton, MatCard, MatCardContent, MatIcon, MatProgressBar],
  templateUrl: './quiz-preview.component.html',
  styleUrl: './quiz-preview.component.scss',
})
export class QuizPreviewComponent implements OnDestroy {
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly quizStore = inject(QuizStoreService);
  private readonly themePreset = inject(ThemePresetService);
  private readonly dialog = inject(MatDialog);
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
  readonly animationNonce = signal(0);
  readonly liveStartPending = signal(false);
  readonly liveStartError = signal<string | null>(null);
  readonly quiz = computed(() => this.quizStore.getQuizById(this.id));
  readonly questions = computed(() => {
    const quiz = this.quiz();
    if (!quiz) return [];
    return [...quiz.questions].sort((a, b) => a.order - b.order);
  });
  readonly currentQuestion = computed(() => this.questions()[this.currentIndex()] ?? null);
  readonly animatedCurrentQuestion = computed(() => {
    const question = this.currentQuestion();
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
    const question = this.currentQuestion();
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
    const nextIndex = Math.min(this.currentIndex() + 1, total - 1);
    if (nextIndex === this.currentIndex()) return;
    this.commitInlineEdits();
    this.currentIndex.set(nextIndex);
    this.triggerSwipeAnimation('left');
  }

  previousQuestion(): void {
    const previousIndex = Math.max(this.currentIndex() - 1, 0);
    if (previousIndex === this.currentIndex()) return;
    this.commitInlineEdits();
    this.currentIndex.set(previousIndex);
    this.triggerSwipeAnimation('right');
  }

  goToQuestion(index: number): void {
    const total = this.questions().length;
    if (index < 0 || index >= total) return;
    const currentIndex = this.currentIndex();
    if (index === currentIndex) return;
    this.commitInlineEdits();
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
    this.commitInlineEdits();
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

    const dialogRef = this.dialog.open(LiveSessionDialogComponent, {
      width: 'min(32rem, calc(100vw - 1.5rem))',
      maxWidth: '100vw',
      autoFocus: false,
      panelClass: 'live-session-dialog-panel',
      backdropClass: 'live-session-dialog-backdrop',
      data: {
        quizName: quiz.name,
        quizCanStart: this.questions().length > 0,
      },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) return;

    await this.startLiveSession({
      includeQuiz: result.enableQuiz,
      includeQa: result.enableQa,
      includeQuickFeedback: result.enableQuickFeedback,
      startWithQa: result.startChannel === 'qa',
      initialTab: result.startChannel,
    });
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
        this.backToOrigin();
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

  answerOptionLabel(index: number): string {
    return String.fromCharCode(65 + index);
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
    this.animationNonce.update((value) => value + 1);
    this.swipeDirection.set(direction);
    this.animationTimer = setTimeout(() => {
      this.swipeDirection.set(null);
      this.animationTimer = null;
    }, 1160);
  }

  private async startLiveSession(options: {
    includeQuiz: boolean;
    includeQa: boolean;
    includeQuickFeedback: boolean;
    startWithQa: boolean;
    initialTab: 'quiz' | 'qa' | 'quickFeedback';
  }): Promise<void> {
    this.liveStartError.set(null);
    this.liveStartPending.set(true);
    try {
      let result: { code: string };

      if (options.includeQuiz) {
        let payload = this.quizStore.getUploadPayload(this.id);
        const presetKey = PRESET_OPTIONS_STORAGE_PREFIX + this.themePreset.preset();
        try {
          const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(presetKey) : null;
          const parsed = raw ? (JSON.parse(raw) as unknown) : null;
          const entry = PresetStorageEntrySchema.safeParse(parsed);
          if (entry.success) {
            const storedOptions = entry.data.options;
            /** Wie quiz-list: fehlender Chip = Quiz-Wert behalten, nicht false. */
            const optionEnabled = (id: string, fallback: boolean) =>
              id in storedOptions ? storedOptions[id] === true : fallback;
            const nameMode = entry.data.nameMode;
            const effectiveTeamMode = optionEnabled('teamMode', false) || payload.teamMode;
            payload = {
              ...payload,
              nicknameTheme: entry.data.nicknameThemeValue,
              allowCustomNicknames: nameMode === 'allowCustomNicknames',
              anonymousMode: nameMode === 'anonymousMode',
              showLeaderboard: optionEnabled('showLeaderboard', payload.showLeaderboard),
              enableRewardEffects: optionEnabled(
                'enableRewardEffects',
                payload.enableRewardEffects,
              ),
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
              backgroundMusic: null,
            };
          }
        } catch {
          // Preset-Optionen nicht lesbar → Quiz-Einstellungen unverändert nutzen
        }

        const { quizId: uploadedQuizId } = await trpc.quiz.upload.mutate(payload);
        this.quizStore.setLastServerQuizId(this.id, uploadedQuizId);
        result = await trpc.session.create.mutate({
          quizId: uploadedQuizId,
          type: 'QUIZ',
          qaEnabled: options.includeQa,
          quickFeedbackEnabled: options.includeQuickFeedback,
        });
      } else {
        result = await trpc.session.create.mutate({
          type: 'Q_AND_A',
          quickFeedbackEnabled: options.includeQuickFeedback,
        });
      }

      if (options.startWithQa) {
        await trpc.session.startQa.mutate({ code: result.code });
      }

      await this.router.navigate(localizeCommands(['session', result.code, 'host']), {
        queryParams: options.initialTab === 'quiz' ? undefined : { tab: options.initialTab },
      });
    } catch {
      this.liveStartError.set($localize`Veranstaltung konnte nicht gestartet werden.`);
    } finally {
      this.liveStartPending.set(false);
    }
  }
}
