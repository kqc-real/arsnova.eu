import { ChangeDetectorRef, Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { trpc } from '../../../core/trpc.client';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { ThemePresetService } from '../../../core/theme-preset.service';
import type { SessionStatus, SessionInfoDTO, QuestionStudentDTO, QuestionPreviewDTO, QuestionRevealedDTO } from '@arsnova/shared-types';
import { CountdownFingersComponent } from '../../../shared/countdown-fingers/countdown-fingers.component';
import type { Unsubscribable } from '@trpc/server/observable';

const PARTICIPANT_STORAGE_KEY = 'arsnova-participant';

type CurrentQuestion = QuestionStudentDTO | QuestionPreviewDTO | QuestionRevealedDTO;

const ANSWER_COLORS = ['#1565c0', '#e65100', '#2e7d32', '#6a1b9a', '#c62828', '#00838f', '#4e342e', '#37474f'];
const ANSWER_SHAPES = ['\u25B3', '\u25CB', '\u25A1', '\u25C7', '\u2606', '\u2B21', '\u2B20', '\u2BC6'];
const MESSAGES_CORRECT = [
  'Perfekt! 🎯', 'Richtig! 💪', 'Volltreffer! ⭐', 'Stark! 🔥',
  'Genau richtig! 🚀', 'Läuft bei dir! 🎸', 'Nailed it! 👏',
];
const MESSAGES_WRONG = [
  'Knapp daneben! 🤏', 'Nächstes Mal! 💡', 'Weiter dranbleiben! 🔄',
  'Das wird schon! 📈', 'Nicht aufgeben! 💪',
];
const MESSAGES_NEUTRAL = [
  'Antwort gespeichert! ✓', 'Danke für deine Antwort! 📝', 'Weiter so! 🚀',
];
const MESSAGES_TIMEOUT = [
  'Knapp verpasst – nächste Runde! ⏱️',
  'Die Zeit war zu kurz – du schaffst das! 💪',
  "Beim nächsten Mal klappt's! 🔄",
  "Kopf hoch – gleich geht's weiter! 🚀",
  'Tick-tock – nächste Chance kommt! ⏰',
];
function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

@Component({
  selector: 'app-session-vote',
  standalone: true,
  imports: [MatButton, MatIcon, MatProgressSpinner, CountdownFingersComponent, DecimalPipe],
  templateUrl: './session-vote.component.html',
  styleUrl: './session-vote.component.scss',
})
export class SessionVoteComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly themePreset = inject(ThemePresetService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly snackBar = inject(MatSnackBar);
  private statusSub: Unsubscribable | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  readonly code = (this.route.parent?.snapshot.paramMap.get('code') ?? '').toUpperCase();
  readonly sessionId = signal('');
  readonly participantId = signal('');
  readonly status = signal<SessionStatus>('LOBBY');
  readonly sessionSettings = signal<Partial<SessionInfoDTO>>({});
  readonly currentQuestion = signal<CurrentQuestion | null>(null);

  readonly selectedAnswerIds = signal<Set<string>>(new Set());
  readonly voteSent = signal(false);
  readonly voteError = signal<string | null>(null);
  readonly voteSending = signal(false);
  readonly freeTextValue = signal('');
  readonly ratingValue = signal<number | null>(null);
  readonly debounced = signal(false);
  readonly countdownSeconds = signal<number | null>(null);
  readonly motivationMessage = signal<string | null>(null);
  readonly showRewardEffect = signal(false);
  readonly timeoutMessage = signal<string | null>(null);
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private fingerHideTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly currentRound = signal(1);
  readonly personalRank = signal<number | null>(null);
  readonly personalScore = signal<number | null>(null);
  readonly bonusToken = signal<string | null>(null);
  readonly personalResultLoaded = signal(false);

  readonly feedbackOverall = signal<number>(0);
  readonly feedbackQuality = signal<number>(0);
  readonly feedbackRepeat = signal<boolean | null>(null);
  readonly feedbackSubmitted = signal(false);
  readonly feedbackSubmitting = signal(false);
  readonly feedbackSummary = signal<{ totalResponses: number; overallAverage: number; overallDistribution: Record<string, number> } | null>(null);

  constructor() {
    effect(() => {
      if (this.isFinished() && !this.personalResultLoaded()) {
        void this.loadPersonalResult();
      }
    });
  }

  readonly isActive = computed(() => this.status() === 'ACTIVE');
  readonly isQuestionOpen = computed(() => this.status() === 'QUESTION_OPEN');
  readonly isDiscussion = computed(() => this.status() === 'DISCUSSION');
  readonly isResults = computed(() => this.status() === 'RESULTS');
  readonly isLobby = computed(() => this.status() === 'LOBBY');
  readonly isFinished = computed(() => this.status() === 'FINISHED');

  readonly hasAnswers = computed(() => {
    const q = this.currentQuestion();
    return q && 'answers' in q && Array.isArray(q.answers) && q.answers.length > 0;
  });

  readonly showFingerCountdown = computed(() => {
    const s = this.countdownSeconds();
    return this.isActive() && s !== null && s >= 0 && s <= 5 && this.themePreset.preset() === 'spielerisch';
  });

  readonly isPlayfulPreset = computed(() => this.themePreset.preset() === 'spielerisch');

  readonly timerExpired = computed(() => {
    const s = this.countdownSeconds();
    return s !== null && s <= 0;
  });

  /** True, wenn alle Teilnehmer abgestimmt haben (Server liefert participantCount/totalVotes). Countdown wird dann ausgeblendet. */
  readonly allHaveVoted = computed(() => {
    const q = this.currentQuestion();
    if (!q || !this.isActive()) return false;
    const pc = 'participantCount' in q ? (q as { participantCount?: number }).participantCount : undefined;
    const tv = 'totalVotes' in q ? (q as { totalVotes?: number }).totalVotes : undefined;
    if (pc === null || pc === undefined || tv === null || tv === undefined || pc <= 0) return false;
    return tv >= pc;
  });

  readonly isRating = computed(() => {
    const q = this.currentQuestion();
    return q && 'type' in q && q.type === 'RATING';
  });

  ratingRange(): number[] {
    const q = this.currentQuestion();
    if (!q || !('ratingMin' in q)) return [];
    const min = (q as { ratingMin?: number | null }).ratingMin ?? 1;
    const max = (q as { ratingMax?: number | null }).ratingMax ?? 5;
    const range: number[] = [];
    for (let i = min; i <= max; i++) range.push(i);
    return range;
  }

  ratingLabelMin(): string {
    const q = this.currentQuestion();
    return (q && 'ratingLabelMin' in q ? (q as { ratingLabelMin?: string | null }).ratingLabelMin : null) ?? '';
  }

  ratingLabelMax(): string {
    const q = this.currentQuestion();
    return (q && 'ratingLabelMax' in q ? (q as { ratingLabelMax?: string | null }).ratingLabelMax : null) ?? '';
  }

  selectRating(value: number): void {
    if (this.voteSent() || !this.isActive() || this.timerExpired()) return;
    this.ratingValue.set(value);
    this.cdr.detectChanges();
  }

  getColor(index: number): string { return ANSWER_COLORS[index % ANSWER_COLORS.length]; }
  getShape(index: number): string { return ANSWER_SHAPES[index % ANSWER_SHAPES.length]; }
  getLetter(index: number): string { return String.fromCharCode(65 + index); }

  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdownWithKatex(value).html);
  }

  async ngOnInit(): Promise<void> {
    if (!this.code) return;

    if (typeof localStorage !== 'undefined') {
      this.participantId.set(localStorage.getItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`) ?? '');
    }

    try {
      const session = await trpc.session.getInfo.query({ code: this.code });
      this.sessionId.set(session.id);
      this.status.set(session.status as SessionStatus);
      this.sessionSettings.set(session);
      if (session.preset === 'PLAYFUL' || session.preset === 'SERIOUS') {
        this.themePreset.setPreset(session.preset === 'PLAYFUL' ? 'spielerisch' : 'serious', { silent: true });
      }
    } catch { /* Parent-Shell hat schon validiert */ }

    this.statusSub = trpc.session.onStatusChanged.subscribe(
      { code: this.code },
      {
        onData: (data: { status: string; currentQuestion: number | null; activeAt?: string; timer?: number | null; preset?: string; currentRound?: number }) => {
          const prevRound = this.currentRound();
          const newRound = data.currentRound ?? 1;
          this.status.set(data.status as SessionStatus);
          this.currentRound.set(newRound);
          if (data.preset === 'PLAYFUL' || data.preset === 'SERIOUS') {
            this.themePreset.setPreset(data.preset === 'PLAYFUL' ? 'spielerisch' : 'serious', { silent: true });
          }
          if (data.status === 'ACTIVE' && newRound === 2 && prevRound === 1) {
            this.voteSent.set(false);
            this.selectedAnswerIds.set(new Set());
            this.voteError.set(null);
            this.freeTextValue.set('');
            this.ratingValue.set(null);
            this.motivationMessage.set(null);
            this.timeoutMessage.set(null);
          }
          if (data.status === 'ACTIVE' && data.activeAt && data.timer && data.timer > 0) {
            const deadline = new Date(data.activeAt).getTime() + data.timer * 1000;
            this.startCountdownFromDeadline(deadline);
          } else if (data.status !== 'ACTIVE') {
            this.stopCountdown();
            this.countdownSeconds.set(null);
          }
          void this.refreshQuestion();
        },
      },
    );

    void this.refreshQuestion();
    this.pollTimer = setInterval(() => void this.refreshQuestion(), 1000);
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
    this.statusSub = null;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    this.stopCountdown();
  }

  private startCountdown(q: CurrentQuestion | null): void {
    if (!q || !('timer' in q) || !q.timer || q.timer <= 0) {
      this.stopCountdown();
      this.countdownSeconds.set(null);
      return;
    }
    const activeAt = 'activeAt' in q && q.activeAt ? new Date(q.activeAt).getTime() : Date.now();
    this.startCountdownFromDeadline(activeAt + q.timer * 1000);
  }

  private startCountdownFromDeadline(deadline: number): void {
    this.stopCountdown();
    this.timeoutMessage.set(null);
    const tick = (): void => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      this.countdownSeconds.set(remaining);
      if (remaining <= 0) {
        this.stopCountdown();
        this.countdownSeconds.set(0);
        if (!this.voteSent()) {
          this.timeoutMessage.set(pickRandom(MESSAGES_TIMEOUT));
        }
        this.fingerHideTimeout = setTimeout(() => {
          this.countdownSeconds.set(null);
          this.fingerHideTimeout = null;
        }, 5000);
      }
    };
    tick();
    this.countdownTimer = setInterval(tick, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    if (this.fingerHideTimeout) { clearTimeout(this.fingerHideTimeout); this.fingerHideTimeout = null; }
  }

  private async refreshQuestion(): Promise<void> {
    try {
      const q = await trpc.session.getCurrentQuestionForStudent.query({ code: this.code });
      const prev = this.currentQuestion();
      const prevId = prev && 'id' in prev ? prev.id : null;
      const newId = q && 'id' in q ? q.id : null;
      const prevHadTimer = prev && 'timer' in prev && prev.timer;
      const newHasTimer = q && 'timer' in q && q.timer;

      const qRound = q && 'currentRound' in q ? (q as { currentRound?: number }).currentRound : undefined;
      if (qRound && qRound !== this.currentRound()) {
        this.currentRound.set(qRound);
      }

      if (newId !== prevId) {
        this.selectedAnswerIds.set(new Set());
        this.voteSent.set(false);
        this.voteError.set(null);
        this.freeTextValue.set('');
        this.ratingValue.set(null);
        this.motivationMessage.set(null);
        this.timeoutMessage.set(null);
        this.showRewardEffect.set(false);
        this.startCountdown(q);
      } else if (!prevHadTimer && newHasTimer && !this.countdownTimer) {
        this.startCountdown(q);
      }

      if (q && this.isResults() && this.voteSent() && !this.motivationMessage()) {
        const settings = this.sessionSettings();
        const qType = 'type' in q ? q.type : null;
        const isScored = qType === 'SINGLE_CHOICE' || qType === 'MULTIPLE_CHOICE';

        if (isScored && 'answers' in q) {
          const selected = this.selectedAnswerIds();
          const revealed = (q as QuestionRevealedDTO).answers;
          const correctIds = new Set(revealed.filter((a) => a.isCorrect).map((a) => a.id));
          const allCorrect = correctIds.size > 0
            && selected.size > 0
            && [...correctIds].every((id) => selected.has(id))
            && [...selected].every((id) => correctIds.has(id));

          if (allCorrect && settings.enableRewardEffects) {
            this.showRewardEffect.set(true);
          }
          if (settings.enableMotivationMessages) {
            this.motivationMessage.set(pickRandom(allCorrect ? MESSAGES_CORRECT : MESSAGES_WRONG));
          }
        } else if (settings.enableMotivationMessages) {
          this.motivationMessage.set(pickRandom(MESSAGES_NEUTRAL));
        }
      }

      // Gleiche Frage: Antwort-Liste beibehalten, um Re-Render zu vermeiden – Buttons reagieren sofort
      if (newId === prevId && prev && q && 'answers' in prev && 'answers' in q && Array.isArray((prev as { answers: unknown[] }).answers)) {
        const prevAnswers = (prev as { answers: unknown[] }).answers;
        this.currentQuestion.set({ ...q, answers: prevAnswers } as CurrentQuestion);
      } else {
        this.currentQuestion.set(q);
      }

      const pc = q && 'participantCount' in q ? (q as { participantCount?: number }).participantCount : undefined;
      const tv = q && 'totalVotes' in q ? (q as { totalVotes?: number }).totalVotes : undefined;
      if (typeof pc === 'number' && typeof tv === 'number' && pc > 0 && tv >= pc) {
        this.stopCountdown();
        this.countdownSeconds.set(null);
      }
    } catch { /* noop */ }
  }

  toggleAnswer(answerId: string): void {
    if (this.voteSent() || this.debounced() || !this.isActive() || this.timerExpired()) return;
    const q = this.currentQuestion();
    if (!q || !('type' in q)) return;
    const set = new Set(this.selectedAnswerIds());

    if (q.type === 'SINGLE_CHOICE') {
      this.selectedAnswerIds.set(new Set([answerId]));
    } else {
      if (set.has(answerId)) set.delete(answerId); else set.add(answerId);
      this.selectedAnswerIds.set(set);
    }
    this.cdr.detectChanges();
  }

  async submitVote(overrideIds?: string[]): Promise<void> {
    if (this.voteSending() || this.voteSent() || this.debounced() || this.timerExpired()) return;
    const q = this.currentQuestion();
    if (!q || !('id' in q)) return;

    const answerIds = overrideIds ?? [...this.selectedAnswerIds()];
    const freeText = q.type === 'FREETEXT' ? this.freeTextValue().trim() : undefined;
    const rating = q.type === 'RATING' ? this.ratingValue() ?? undefined : undefined;

    this.debounced.set(true);
    this.voteSending.set(true);
    this.voteError.set(null);

    try {
      await trpc.vote.submit.mutate({
        sessionId: this.sessionId(),
        participantId: this.participantId(),
        questionId: q.id,
        answerIds: answerIds.length > 0 ? answerIds : undefined,
        freeText: freeText || undefined,
        ratingValue: rating,
        round: this.currentRound(),
      });
      this.voteSent.set(true);
      try { navigator.vibrate?.(10); } catch { /* unsupported */ }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Abstimmung fehlgeschlagen.';
      this.voteError.set(msg);
      if (!overrideIds) this.selectedAnswerIds.set(new Set());
    } finally {
      this.voteSending.set(false);
      setTimeout(() => this.debounced.set(false), 300);
    }
  }

  async loadPersonalResult(): Promise<void> {
    const pid = this.participantId();
    if (!this.code || !pid) return;
    try {
      const result = await trpc.session.getPersonalResult.query({
        code: this.code,
        participantId: pid,
      });
      this.personalRank.set(result.rank);
      this.personalScore.set(result.totalScore);
      this.bonusToken.set(result.bonusToken);
      this.personalResultLoaded.set(true);
    } catch { /* noop */ }
  }

  async copyBonusCode(): Promise<void> {
    const token = this.bonusToken();
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      this.snackBar.open('Code kopiert!', '', { duration: 2000 });
    } catch { /* noop */ }
  }

  setFeedbackOverall(v: number): void { this.feedbackOverall.set(v); }
  setFeedbackQuality(v: number): void { this.feedbackQuality.set(v); }
  setFeedbackRepeat(v: boolean): void {
    this.feedbackRepeat.set(this.feedbackRepeat() === v ? null : v);
  }

  feedbackStars(): number[] { return [1, 2, 3, 4, 5]; }

  async submitFeedback(): Promise<void> {
    if (this.feedbackSubmitting() || this.feedbackSubmitted() || this.feedbackOverall() === 0) return;
    this.feedbackSubmitting.set(true);
    try {
      await trpc.session.submitSessionFeedback.mutate({
        code: this.code,
        participantId: this.participantId(),
        overallRating: this.feedbackOverall(),
        questionQualityRating: this.feedbackQuality() > 0 ? this.feedbackQuality() : undefined,
        wouldRepeat: this.feedbackRepeat() ?? undefined,
      });
      this.feedbackSubmitted.set(true);
      this.snackBar.open('Danke für dein Feedback!', '', { duration: 2000 });
      void this.loadFeedbackSummary();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : '';
      if (msg.includes('bereits bewertet')) {
        this.feedbackSubmitted.set(true);
        void this.loadFeedbackSummary();
      } else {
        this.snackBar.open('Feedback konnte nicht gesendet werden.', '', { duration: 2000 });
      }
    } finally {
      this.feedbackSubmitting.set(false);
    }
  }

  async loadFeedbackSummary(): Promise<void> {
    try {
      const summary = await trpc.session.getSessionFeedbackSummary.query({ code: this.code });
      if (summary.totalResponses > 0) {
        this.feedbackSummary.set(summary);
      }
    } catch { /* noop */ }
  }
}
