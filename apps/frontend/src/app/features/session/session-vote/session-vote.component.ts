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
import type {
  ParticipantDTO,
  PersonalScorecardDTO,
  QuestionPreviewDTO,
  QuestionRevealedDTO,
  QuestionStudentDTO,
  SessionInfoDTO,
  SessionStatus,
  TeamLeaderboardEntryDTO,
} from '@arsnova/shared-types';
import { CountdownFingersComponent } from '../../../shared/countdown-fingers/countdown-fingers.component';
import type { Unsubscribable } from '@trpc/server/observable';

const PARTICIPANT_STORAGE_KEY = 'arsnova-participant';

type CurrentQuestion = QuestionStudentDTO | QuestionPreviewDTO | QuestionRevealedDTO;

const ANSWER_COLORS = ['#1565c0', '#e65100', '#2e7d32', '#6a1b9a', '#c62828', '#00838f', '#4e342e', '#37474f'];
const ANSWER_SHAPES = ['\u25B3', '\u25CB', '\u25A1', '\u25C7', '\u2606', '\u2B21', '\u2B20', '\u2BC6'];
const MESSAGES_CORRECT = [
  $localize`Perfekt! 🎯`, $localize`Richtig! 💪`, $localize`Volltreffer! ⭐`, $localize`Stark! 🔥`,
  $localize`Genau richtig! 🚀`, $localize`Läuft bei dir! 🎸`, $localize`Nailed it! 👏`,
];
const MESSAGES_WRONG = [
  $localize`Knapp daneben! 🤏`, $localize`Nächstes Mal! 💡`, $localize`Weiter dranbleiben! 🔄`,
  $localize`Das wird schon! 📈`, $localize`Nicht aufgeben! 💪`,
];
const MESSAGES_NEUTRAL = [
  $localize`Antwort gespeichert! ✓`, $localize`Danke für deine Antwort! 📝`, $localize`Weiter so! 🚀`,
];
const MESSAGES_TIMEOUT = [
  $localize`Knapp verpasst – nächste Runde! ⏱️`,
  $localize`Die Zeit war zu kurz – du schaffst das! 💪`,
  $localize`Beim nächsten Mal klappt's! 🔄`,
  $localize`Kopf hoch – gleich geht's weiter! 🚀`,
  $localize`Tick-tock – nächste Chance kommt! ⏰`,
];
function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Kontextbasierte Motivationsmeldung aus Scorecard-Daten (Story 5.7).
 * Liefert eine passende Meldung basierend auf wasCorrect, streakCount, rankChange, currentRank und totalParticipants.
 */
function getContextMotivation(sc: PersonalScorecardDTO, totalParticipants: number): string {
  if (sc.wasCorrect === true) {
    if (sc.streakCount >= 3) return $localize`On fire! 🔥 ${sc.streakCount}er-Serie!`;
    if (sc.rankChange > 0) {
      return sc.rankChange === 1
        ? $localize`${sc.rankChange} Platz aufgestiegen! 🚀`
        : $localize`${sc.rankChange} Plätze aufgestiegen! 🚀`;
    }
    return pickRandom([$localize`Perfekt! 🎯`, $localize`Richtig! 💪`, $localize`Volltreffer! ⭐`, $localize`Stark! 🔥`, $localize`Nailed it! 👏`]);
  }
  if (sc.wasCorrect === false) {
    if (sc.streakCount === 0 && sc.previousRank !== null && sc.previousRank < sc.currentRank) {
      return $localize`Streak gerissen! Nächste Runde! 💪`;
    }
    const topThird = Math.ceil(totalParticipants / 3);
    if (sc.currentRank <= topThird) return $localize`Kopf hoch – du liegst noch gut! 🏅`;
    return $localize`Weiter so – jede Frage ist eine neue Chance! 🌟`;
  }
  return pickRandom(MESSAGES_NEUTRAL);
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
  readonly participantTeam = signal<ParticipantDTO | null>(null);
  readonly teamLeaderboard = signal<TeamLeaderboardEntryDTO[]>([]);

  /** Story 5.6: Persönliche Scorecard pro Frage */
  readonly scorecard = signal<PersonalScorecardDTO | null>(null);
  private scorecardQuestionIndex = -1;

  /** Story 5.8: Emoji-Reaktionen */
  readonly emojiOptions = ['👏', '🎉', '😮', '😂', '😢'] as const;
  readonly emojiSent = signal(false);
  readonly emojiSentEmoji = signal('');

  readonly feedbackOverall = signal<number>(0);
  readonly feedbackQuality = signal<number>(0);
  readonly feedbackRepeat = signal<boolean | null>(null);
  readonly feedbackSubmitted = signal(false);
  readonly feedbackSubmitting = signal(false);
  readonly feedbackSummary = signal<{ totalResponses: number; overallAverage: number; overallDistribution: Record<string, number> } | null>(null);
  private feedbackStateLoaded = false;

  constructor() {
    effect(() => {
      if (this.isFinished() && !this.personalResultLoaded()) {
        void this.loadPersonalResult();
      }
    });
    effect(() => {
      if (this.isFinished() && this.code && this.participantId() && !this.feedbackStateLoaded) {
        void this.loadFeedbackState();
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
  readonly ownTeamEntry = computed(() => {
    const teamName = this.participantTeam()?.teamName;
    if (!teamName) {
      return null;
    }
    return this.teamLeaderboard().find((entry) => entry.teamName === teamName) ?? null;
  });
  readonly teamLeaderboardMaxScore = computed(() =>
    Math.max(1, ...this.teamLeaderboard().map((entry) => entry.totalScore)),
  );
  readonly visibleTeamLeaderboard = computed(() => {
    const leaderboard = this.teamLeaderboard();
    const ownEntry = this.ownTeamEntry();
    if (leaderboard.length <= 3 || !ownEntry || ownEntry.rank <= 3) {
      return leaderboard.slice(0, 3);
    }
    return [...leaderboard.slice(0, 2), ownEntry];
  });
  readonly showTeamRewardCard = computed(() =>
    this.sessionSettings().teamMode === true && this.ownTeamEntry() !== null,
  );
  readonly showTeamRewardConfetti = computed(() =>
    this.showTeamRewardCard()
    && this.sessionSettings().enableRewardEffects === true
    && this.isPlayfulPreset()
    && this.ownTeamEntry()?.rank === 1,
  );

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

  teamRewardTitle(): string {
    const entry = this.ownTeamEntry();
    if (!entry) {
      return '';
    }
    if (this.isFinished()) {
      return entry.rank === 1
        ? $localize`${entry.teamName} gewinnt das Teamduell`
        : $localize`${entry.teamName} ist im Ziel`;
    }
    return entry.rank === 1
      ? $localize`${entry.teamName} führt gerade`
      : $localize`${entry.teamName} bleibt im Rennen`;
  }

  teamRewardMessage(): string {
    const entry = this.ownTeamEntry();
    if (!entry) {
      return '';
    }
    if (this.isFinished()) {
      if (entry.rank === 1) {
        return $localize`Gemeinsam geschafft: ${entry.teamName} holt ${entry.totalScore}:totalScore: Punkte und Platz 1.`;
      }
      return $localize`${entry.teamName} beendet das Quiz mit ${entry.totalScore}:totalScore: Punkten auf Platz ${entry.rank}:teamRank:.`;
    }
    if (entry.rank === 1) {
      return $localize`Gemeinsam stark: ${entry.teamName} liegt mit ${entry.totalScore}:totalScore: Punkten vorn.`;
    }
    return $localize`${entry.teamName} steht aktuell auf Platz ${entry.rank}:teamRank: mit ${entry.totalScore}:totalScore: Punkten.`;
  }

  teamRewardLeaderHint(): string | null {
    const ownEntry = this.ownTeamEntry();
    const leader = this.teamLeaderboard()[0];
    if (!ownEntry || !leader || leader.teamName === ownEntry.teamName) {
      return null;
    }
    return $localize`Vorne liegt ${leader.teamName}:leaderName: mit ${leader.totalScore}:leaderScore: Punkten.`;
  }

  teamStandingAriaLabel(entry: TeamLeaderboardEntryDTO): string {
    return $localize`Platz ${entry.rank}:teamRank:: ${entry.teamName}:teamName: mit ${entry.totalScore}:totalScore: Punkten`;
  }

  teamScoreBarWidth(totalScore: number): string {
    const max = this.teamLeaderboardMaxScore();
    const percentage = max <= 0 ? 0 : Math.max(12, Math.round((totalScore / max) * 100));
    return `${percentage}%`;
  }

  starsAriaLabel(stars: number): string {
    return $localize`${stars} von 5 Sternen`;
  }

  countdownAriaLabel(): string {
    const seconds = this.countdownSeconds();
    return $localize`${seconds ?? 0} Sekunden verbleibend`;
  }

  ratingAriaLabel(): string {
    return $localize`Bewertung von ${this.ratingLabelMin()} bis ${this.ratingLabelMax()}`;
  }

  ratingValueAriaLabel(value: number): string {
    return $localize`Bewertung ${value}`;
  }

  emojiReactionAriaLabel(emoji: string): string {
    return $localize`Reagiere mit ${emoji}`;
  }

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
      if (session.teamMode) {
        await this.loadParticipantTeam();
        if (session.status === 'RESULTS' || session.status === 'FINISHED') {
          await this.loadTeamLeaderboard();
        }
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
          if (this.sessionSettings().teamMode) {
            if (data.status === 'RESULTS' || data.status === 'FINISHED') {
              void this.loadTeamRewardState();
            } else {
              this.teamLeaderboard.set([]);
            }
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
        this.scorecard.set(null);
        this.scorecardQuestionIndex = -1;
        this.emojiSent.set(false);
        this.emojiSentEmoji.set('');
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

      // Story 5.6: Scorecard laden, wenn RESULTS und noch nicht geladen
      if (q && this.isResults() && 'order' in q) {
        const qOrder = (q as { order: number }).order;
        if (qOrder !== this.scorecardQuestionIndex) {
          this.scorecardQuestionIndex = qOrder;
          void this.loadScorecard(qOrder);
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

  async sendEmoji(emoji: string): Promise<void> {
    if (this.emojiSent()) return;
    const q = this.currentQuestion();
    const qId = q && 'id' in q ? q.id : null;
    if (!qId || !this.sessionId() || !this.participantId()) return;
    this.emojiSent.set(true);
    this.emojiSentEmoji.set(emoji);
    try {
      await trpc.session.react.mutate({
        sessionId: this.sessionId(),
        questionId: qId,
        participantId: this.participantId(),
        emoji: emoji as '👏' | '🎉' | '😮' | '😂' | '😢',
      });
    } catch { /* noop */ }
  }

  async loadScorecard(questionIndex: number): Promise<void> {
    const pid = this.participantId();
    if (!this.code || !pid) return;
    try {
      const sc = await trpc.session.getPersonalScorecard.query({
        code: this.code,
        participantId: pid,
        questionIndex,
        round: this.currentRound(),
      });
      this.scorecard.set(sc);

      const settings = this.sessionSettings();
      if (settings.enableMotivationMessages) {
        const totalParticipants = settings.participantCount ?? 1;
        this.motivationMessage.set(getContextMotivation(sc, totalParticipants));
      }
    } catch { /* noop */ }
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

  private async loadParticipantTeam(): Promise<void> {
    const pid = this.participantId();
    if (!this.code || !pid || this.sessionSettings().teamMode !== true) {
      this.participantTeam.set(null);
      return;
    }
    try {
      const payload = await trpc.session.getParticipants.query({ code: this.code });
      this.participantTeam.set(payload.participants.find((participant) => participant.id === pid) ?? null);
    } catch {
      this.participantTeam.set(null);
    }
  }

  private async loadTeamLeaderboard(): Promise<void> {
    if (!this.code || this.sessionSettings().teamMode !== true) {
      this.teamLeaderboard.set([]);
      return;
    }
    try {
      const leaderboard = await trpc.session.getTeamLeaderboard.query({ code: this.code });
      this.teamLeaderboard.set(leaderboard);
    } catch {
      this.teamLeaderboard.set([]);
    }
  }

  private async loadTeamRewardState(): Promise<void> {
    if (this.sessionSettings().teamMode !== true) {
      this.participantTeam.set(null);
      this.teamLeaderboard.set([]);
      return;
    }
    if (!this.participantTeam()?.teamName) {
      await this.loadParticipantTeam();
    }
    await this.loadTeamLeaderboard();
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
      this.snackBar.open($localize`Danke für dein Feedback!`, '', { duration: 2000 });
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

  /** Beim Neuladen prüfen, ob dieser Teilnehmer bereits bewertet hat (Formular ausblenden). */
  private async loadFeedbackState(): Promise<void> {
    if (!this.code || !this.participantId() || this.feedbackStateLoaded) return;
    try {
      const { submitted } = await trpc.session.getHasSubmittedFeedback.query({
        code: this.code,
        participantId: this.participantId()!,
      });
      this.feedbackSubmitted.set(submitted);
      if (submitted) {
        void this.loadFeedbackSummary();
      }
      this.feedbackStateLoaded = true;
    } catch {
      this.feedbackStateLoaded = true;
    }
  }
}
