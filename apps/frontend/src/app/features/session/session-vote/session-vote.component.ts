import {
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  Injector,
  signal,
  computed,
  effect,
  afterNextRender,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { trpc } from '../../../core/trpc.client';
import {
  localizeKnownServerError,
  localizeKnownServerMessage,
} from '../../../core/localize-known-server-message';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { decorateLeadingAnswerEmoji } from '../../../shared/leading-answer-emoji.util';
import { ThemePresetService } from '../../../core/theme-preset.service';
import * as vpc from './session-vote-participant-copy';
import { localizePath, resolveLocalizedJoinUrl } from '../../../core/locale-router';
import type {
  ParticipantDTO,
  PersonalScorecardDTO,
  QaQuestionDTO,
  QuickFeedbackResult,
  QuestionPreviewDTO,
  QuestionRevealedDTO,
  QuestionStudentDTO,
  SessionInfoDTO,
  SessionStatus,
  TeamDTO,
  TeamLeaderboardEntryDTO,
} from '@arsnova/shared-types';
import { CountdownFingersComponent } from '../../../shared/countdown-fingers/countdown-fingers.component';
import { MarkdownImageLightboxDirective } from '../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { remainingCountdownSeconds } from '../session-countdown.util';
import { recordServerTimeIso } from '../session-server-clock';
import { findKindergartenNicknameEmoji } from '../../join/kindergarten-nickname-icons';
import {
  edgeEmojiMarkerPosition,
  extractEdgeEmoji,
  stripEdgeEmojiMarker,
} from '../../../shared/emoji-shortcode.util';
import type { Unsubscribable } from '@trpc/server/observable';
import { FeedbackVoteComponent } from '../../feedback/feedback-vote.component';

const PARTICIPANT_STORAGE_KEY = 'arsnova-participant';
const NICKNAME_STORAGE_KEY = 'arsnova-nickname';
const VOTE_RESPONSE_STORAGE_KEY = 'arsnova-vote-response';
const VOTE_FALLBACK_POLL_MS = 2000;
const VOTE_ANCHOR_TOP = 'vote-top';
const VOTE_ANCHOR_QUESTION = 'vote-question-anchor';
const VOTE_ANCHOR_OPTIONS_START = 'vote-options-start';
const VOTE_ANCHOR_OPTION_0 = 'vote-option-0';
const VOTE_ANCHOR_RESULT_CONTAINER = 'vote-result-anchor';
const VOTE_ANCHOR_RESULT_SCORE = 'vote-result-score';
const VOTE_ANCHOR_RESULT_MESSAGE = 'vote-result-message';
const VOTE_ANCHOR_ERROR = 'vote-error';

export type VoteAutoScrollPhase = 'read' | 'vote' | 'result';

type CurrentQuestion = QuestionStudentDTO | QuestionPreviewDTO | QuestionRevealedDTO;
type SessionChannelTab = 'quiz' | 'qa' | 'quickFeedback';
type StoredVoteResponse = {
  answerIds?: string[];
  freeText?: string;
  ratingValue?: number;
  sent: true;
  updatedAt: string;
};

const ANSWER_COLORS = [
  '#1565c0',
  '#e65100',
  '#2e7d32',
  '#6a1b9a',
  '#c62828',
  '#00838f',
  '#4e342e',
  '#37474f',
];
const ANSWER_SHAPES = [
  '\u25B3',
  '\u25CB',
  '\u25A1',
  '\u25C7',
  '\u2606',
  '\u2B21',
  '\u2B20',
  '\u2BC6',
];
const MESSAGES_CORRECT_PLAYFUL = [
  $localize`Perfekt! 🎯`,
  $localize`Richtig! 💪`,
  $localize`Volltreffer! ⭐`,
  $localize`Stark! 🔥`,
  $localize`Genau richtig! 🚀`,
  $localize`Läuft bei dir! 🎸`,
  $localize`Nailed it! 👏`,
];
const MESSAGES_CORRECT_SERIOUS = [
  $localize`:@@sessionVote.msgCorrectS1:Richtig.`,
  $localize`:@@sessionVote.msgCorrectS2:Korrekt.`,
  $localize`:@@sessionVote.msgCorrectS3:Antwort stimmt.`,
];
const MESSAGES_WRONG_PLAYFUL = [
  $localize`Knapp daneben! 🤏`,
  $localize`Nächstes Mal! 💡`,
  $localize`Weiter dranbleiben! 🔄`,
  $localize`Das wird schon! 📈`,
  $localize`Nicht aufgeben! 💪`,
];
const MESSAGES_WRONG_SERIOUS = [
  $localize`:@@sessionVote.msgWrongS1:Nicht richtig.`,
  $localize`:@@sessionVote.msgWrongS2:Leider falsch.`,
  $localize`:@@sessionVote.msgWrongS3:Versuch es bei der nächsten Frage erneut.`,
];
const MESSAGES_NEUTRAL_PLAYFUL = [
  $localize`Antwort gespeichert! ✓`,
  $localize`Danke für deine Antwort! 📝`,
  $localize`Weiter so! 🚀`,
];
const MESSAGES_NEUTRAL_SERIOUS = [
  $localize`:@@sessionVote.msgNeutralS1:Antwort gespeichert.`,
  $localize`:@@sessionVote.msgNeutralS2:Danke, deine Antwort wurde übernommen.`,
];
const MESSAGES_TIMEOUT_PLAYFUL = [
  $localize`Knapp verpasst – nächste Runde! ⏱️`,
  $localize`Die Zeit war zu kurz – du schaffst das! 💪`,
  $localize`Beim nächsten Mal klappt's! 🔄`,
  $localize`Kopf hoch – gleich geht's weiter! 🚀`,
  $localize`Tick-tock – nächste Chance kommt! ⏰`,
];
const MESSAGES_TIMEOUT_SERIOUS = [
  $localize`:@@sessionVote.msgTimeoutS1:Zeit abgelaufen.`,
  $localize`:@@sessionVote.msgTimeoutS2:Die Zeit ist um – warte auf die nächste Frage.`,
  $localize`:@@sessionVote.msgTimeoutS3:Zu spät abgestimmt. Nächste Chance folgt.`,
];
function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function anchorCandidatesForPhase(
  phase: VoteAutoScrollPhase,
  hadReadPhase: boolean,
  prioritizeQuestionOnVote = false,
): string[] {
  if (phase === 'read') {
    return [VOTE_ANCHOR_QUESTION, VOTE_ANCHOR_OPTIONS_START, VOTE_ANCHOR_TOP];
  }
  if (phase === 'vote') {
    if (prioritizeQuestionOnVote) {
      return [
        VOTE_ANCHOR_QUESTION,
        VOTE_ANCHOR_OPTIONS_START,
        VOTE_ANCHOR_OPTION_0,
        VOTE_ANCHOR_TOP,
      ];
    }
    if (hadReadPhase) {
      return [
        VOTE_ANCHOR_OPTION_0,
        VOTE_ANCHOR_OPTIONS_START,
        VOTE_ANCHOR_QUESTION,
        VOTE_ANCHOR_TOP,
      ];
    }
    return [VOTE_ANCHOR_QUESTION, VOTE_ANCHOR_OPTIONS_START, VOTE_ANCHOR_OPTION_0, VOTE_ANCHOR_TOP];
  }
  return [
    VOTE_ANCHOR_RESULT_MESSAGE,
    VOTE_ANCHOR_RESULT_SCORE,
    VOTE_ANCHOR_RESULT_CONTAINER,
    VOTE_ANCHOR_TOP,
    VOTE_ANCHOR_ERROR,
  ];
}

export function focusTargetIdForAnchor(anchorId: string | null | undefined): string | null {
  if (!anchorId) return null;
  if (anchorId === VOTE_ANCHOR_OPTION_0 || anchorId === VOTE_ANCHOR_OPTIONS_START) {
    return VOTE_ANCHOR_QUESTION;
  }
  return anchorId;
}

/**
 * Kontextbasierte Motivationsmeldung aus Scorecard-Daten (Story 5.7).
 * Liefert eine passende Meldung basierend auf wasCorrect, streakCount, rankChange, currentRank und totalParticipants.
 */
function getContextMotivation(
  sc: PersonalScorecardDTO,
  totalParticipants: number,
  playful: boolean,
): string {
  if (sc.wasCorrect === true) {
    if (sc.streakCount >= 3) {
      return playful
        ? $localize`:@@sessionVote.motivStreakPlayful:On fire! 🔥 ${sc.streakCount}:c:er-Serie!`
        : $localize`:@@sessionVote.motivStreakSerious:${sc.streakCount}:c: richtige Antworten in Folge.`;
    }
    if (sc.rankChange > 0) {
      if (sc.rankChange === 1) {
        return playful
          ? $localize`:@@sessionVote.motivRank1Playful:Ein Platz nach oben! 🚀`
          : $localize`:@@sessionVote.motivRank1Serious:Ein Rang nach oben.`;
      }
      return playful
        ? $localize`:@@sessionVote.motivRankNPlayful:${sc.rankChange}:n: Plätze nach oben! 🚀`
        : $localize`:@@sessionVote.motivRankNSerious:${sc.rankChange}:n: Plätze nach oben.`;
    }
    return pickRandom(playful ? MESSAGES_CORRECT_PLAYFUL : MESSAGES_CORRECT_SERIOUS);
  }
  if (sc.wasCorrect === false) {
    if (sc.streakCount === 0 && sc.previousRank !== null && sc.previousRank < sc.currentRank) {
      return playful
        ? $localize`:@@sessionVote.motivStreakBreakPlayful:Streak gerissen! Nächste Runde! 💪`
        : $localize`:@@sessionVote.motivStreakBreakSerious:Serie beendet – nächste Frage zählt.`;
    }
    const topThird = Math.ceil(totalParticipants / 3);
    if (sc.currentRank <= topThird) {
      return playful
        ? $localize`:@@sessionVote.motivTopPlayful:Kopf hoch – du liegst noch gut! 🏅`
        : $localize`:@@sessionVote.motivTopSerious:Du befindest dich weiter vorn in der Rangliste.`;
    }
    return playful
      ? $localize`:@@sessionVote.motivChasePlayful:Weiter so – jede Frage ist eine neue Chance! 🌟`
      : $localize`:@@sessionVote.motivChaseSerious:Weiter üben – die nächste Frage bringt neue Punkte.`;
  }
  return pickRandom(playful ? MESSAGES_NEUTRAL_PLAYFUL : MESSAGES_NEUTRAL_SERIOUS);
}

@Component({
  selector: 'app-session-vote',
  standalone: true,
  imports: [
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIcon,
    MatProgressSpinner,
    CountdownFingersComponent,
    DecimalPipe,
    FeedbackVoteComponent,
    MarkdownImageLightboxDirective,
  ],
  templateUrl: './session-vote.component.html',
  styleUrls: ['../../../shared/styles/dialog-title-header.scss', './session-vote.component.scss'],
})
export class SessionVoteComponent implements OnInit, OnDestroy {
  /** Preset-abhängige Teilnehmer-Texte (Template: vpc.*) */
  readonly vpc = vpc;
  readonly localizedPath = localizePath;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly themePreset = inject(ThemePresetService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly el = inject(ElementRef);
  private readonly injector = inject(Injector);
  private readonly snackBar = inject(MatSnackBar);
  private statusSub: Unsubscribable | null = null;
  private qaSub: Unsubscribable | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastSessionInfoRetryAt = 0;
  private lastAnswerToggleAt = 0;
  private lastVoteSubmitAt = 0;
  private lastQaSubmitAt = 0;
  private reorderLockUntil = 0;
  private qaInfoTimeout: ReturnType<typeof setTimeout> | null = null;
  private qaErrorTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly questionIdsWithReadPhase = new Set<string>();
  private readonly questionIdsWithRound2QuestionScroll = new Set<string>();
  private lastAutoScrollToken: string | null = null;
  private lastResultContentScrollToken: string | null = null;

  @ViewChild('qaTextarea') qaTextareaRef?: ElementRef<HTMLTextAreaElement>;

  readonly code = (this.route.parent?.snapshot.paramMap.get('code') ?? '').toUpperCase();
  readonly sessionId = signal('');
  readonly participantId = signal('');
  readonly status = signal<SessionStatus>('LOBBY');
  readonly sessionSettings = signal<Partial<SessionInfoDTO>>({});
  readonly qrDataUrl = signal('');
  readonly activeChannel = signal<SessionChannelTab>('quiz');
  readonly qaQuestions = signal<QaQuestionDTO[]>([]);
  readonly quickFeedbackResult = signal<QuickFeedbackResult | null>(null);
  readonly qaDraft = signal('');
  readonly qaSubmitting = signal(false);
  readonly qaError = signal<string | null>(null);
  readonly qaInfo = signal<string | null>(null);
  readonly qaPendingQuestionIds = signal<Set<string>>(new Set());
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

  /** Pokal-Titel/Icon nur bei echten Punkten und gültigem Einzel-Rang (> 0). */
  readonly finishedHeroIsCelebration = computed(() => {
    if (!this.personalResultLoaded()) return false;
    const score = this.personalScore() ?? 0;
    const rank = this.personalRank() ?? 0;
    return score > 0 && rank > 0;
  });

  readonly finishedHeroShowsRank = computed(() => {
    const r = this.personalRank();
    return this.personalResultLoaded() && r !== null && r > 0;
  });

  readonly finishedHeroCardMuted = computed(
    () => this.personalResultLoaded() && !this.finishedHeroIsCelebration(),
  );
  readonly playerNickname = signal<string | null>(null);
  readonly participantTeam = signal<ParticipantDTO | null>(null);
  readonly sessionTeams = signal<TeamDTO[]>([]);
  readonly teamLeaderboard = signal<TeamLeaderboardEntryDTO[]>([]);
  readonly playerTeamName = computed(() => this.participantTeam()?.teamName ?? null);
  readonly playerTeamColor = computed(() => {
    const teamName = this.playerTeamName();
    if (!teamName) return null;
    const team = this.sessionTeams().find((t) => t.name === teamName);
    return team?.color ?? null;
  });

  readonly isKindergartenQuizNickname = computed(() => {
    const session = this.sessionSettings();
    return (
      session.type === 'QUIZ' &&
      (session.nicknameTheme ?? 'HIGH_SCHOOL') === 'KINDERGARTEN' &&
      session.anonymousMode !== true
    );
  });

  readonly playerKindergartenEmoji = computed((): string | null => {
    if (!this.isKindergartenQuizNickname()) return null;
    const nick = this.playerNickname()?.trim();
    return nick ? findKindergartenNicknameEmoji(nick) : null;
  });

  readonly playerBadgeAriaLabel = computed(() => {
    const nick = this.playerNickname()?.trim() ?? '';
    const team = this.playerTeamName()?.trim();
    if (team) {
      return `${nick}, ${this.teamNameDisplayLabel(team)}`;
    }
    return nick;
  });

  teamNameUsesEmojiMarker(teamName: string | null | undefined): boolean {
    return typeof teamName === 'string' && edgeEmojiMarkerPosition(teamName) !== null;
  }

  teamNameEmojiMarker(teamName: string | null | undefined): string | null {
    return typeof teamName === 'string' ? extractEdgeEmoji(teamName) : null;
  }

  teamNameEmojiMarkerTrailing(teamName: string | null | undefined): boolean {
    return typeof teamName === 'string' && edgeEmojiMarkerPosition(teamName) === 'trailing';
  }

  teamNameLabelWithoutEmojiMarker(teamName: string | null | undefined): string {
    if (typeof teamName !== 'string') {
      return '';
    }
    return this.teamNameDisplayLabel(teamName);
  }

  /** Story 5.6: Persönliche Scorecard pro Frage */
  readonly scorecard = signal<PersonalScorecardDTO | null>(null);
  private scorecardQuestionIndex = -1;

  /**
   * Serie mit Mehrwert: nur wenn Faktor > 1 und es gibt messbare Zusatzpunkte (question − Basis).
   */
  readonly scorecardStreakCallout = computed(() => {
    const sc = this.scorecard();
    if (!sc || sc.wasCorrect !== true) return null;
    if (sc.streakMultiplier <= 1) return null;
    const bonusPoints = sc.questionScore - sc.baseScore;
    if (bonusPoints <= 0) return null;
    return {
      multiplier: sc.streakMultiplier,
      bonusPoints,
      streakCount: sc.streakCount,
    };
  });

  /** Story 5.8: Emoji-Reaktionen */
  readonly emojiOptions = ['👏', '🎉', '😮', '😂', '😢'] as const;
  readonly emojiSent = signal(false);
  readonly emojiSentEmoji = signal('');

  readonly feedbackOverall = signal<number>(0);
  readonly feedbackQuality = signal<number>(0);
  readonly feedbackRepeat = signal<boolean | null>(null);
  readonly feedbackSubmitted = signal(false);
  readonly feedbackSubmitting = signal(false);
  readonly feedbackSummary = signal<{
    totalResponses: number;
    overallAverage: number;
    overallDistribution: Record<string, number>;
  } | null>(null);
  private readonly markdownCache = new Map<string, SafeHtml>();
  private feedbackStateLoaded = false;

  /**
   * Nach Session-Ende: Bonus-Code sichern und/oder Session-Feedback, dann Startseite.
   */
  readonly showSessionEndGate = signal(false);
  private sessionEndRedirectInFlight = false;

  constructor() {
    effect(() => {
      this.ensureActiveChannel();
    });
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
    effect(() => {
      if (!this.showPrimaryLiveView() || !this.isResults() || !this.voteSent()) {
        return;
      }
      const q = this.currentQuestion();
      const questionId = q && 'id' in q ? q.id : null;
      const message = this.motivationMessage();
      if (!questionId || !message) {
        return;
      }
      const sc = this.scorecard();
      const token = `${questionId}:${message}:${sc ? `${sc.questionOrder}:${sc.totalScore}:${sc.currentRank}` : 'pending'}`;
      this.scheduleResultContentScroll(token);
    });
  }

  readonly isActive = computed(() => this.status() === 'ACTIVE');
  readonly isQuestionOpen = computed(() => this.status() === 'QUESTION_OPEN');
  readonly isDiscussion = computed(() => this.status() === 'DISCUSSION');
  readonly isResults = computed(() => this.status() === 'RESULTS');
  readonly isLobby = computed(() => this.status() === 'LOBBY');
  readonly isFinished = computed(() => this.status() === 'FINISHED');

  /**
   * Kita-Quiz: immer großes Tier-Emoji wie in der Wartelobby — kein kompaktes Badge oben.
   */
  readonly showCompactPlayerBadge = computed(() => {
    if (!this.playerNickname()) return false;
    if (this.playerKindergartenEmoji()) return false;
    return true;
  });

  /**
   * Emoji für das große Kita-Icon im Live-Quiz (Lobby bis inkl. RESULTS), sonst null.
   * Abschlussseite (FINISHED) nutzt die eigene Hero-Karte.
   */
  readonly kitaIdentityHeroEmoji = computed((): string | null => {
    if (!this.showPrimaryLiveView() || !this.playerNickname()?.trim() || this.isFinished()) {
      return null;
    }
    return this.playerKindergartenEmoji();
  });
  readonly liveParticipantCount = computed(() => this.sessionSettings().participantCount ?? 0);

  readonly hasAnswers = computed(() => {
    const q = this.currentQuestion();
    return q && 'answers' in q && Array.isArray(q.answers) && q.answers.length > 0;
  });

  readonly showFingerCountdown = computed(() => {
    const s = this.countdownSeconds();
    return (
      this.isActive() &&
      s !== null &&
      s >= 0 &&
      s <= 5 &&
      this.themePreset.preset() === 'spielerisch'
    );
  });

  readonly isPlayfulPreset = computed(() => this.themePreset.preset() === 'spielerisch');
  readonly channels = computed(() => {
    const session = this.sessionSettings();
    const ch = session.channels;
    if (ch) {
      return {
        quiz: ch.quiz.enabled,
        qa: ch.qa.enabled,
        quickFeedback: ch.quickFeedback.enabled,
      };
    }
    return {
      quiz: session.type === 'QUIZ',
      qa: session.type === 'Q_AND_A',
      quickFeedback: false,
    };
  });
  readonly channelOpenState = computed(() => {
    const session = this.sessionSettings();
    const ch = session.channels;
    if (ch) {
      return {
        quiz: true,
        qa: ch.qa.open,
        quickFeedback: ch.quickFeedback.open,
      };
    }
    return {
      quiz: true,
      qa: session.type === 'Q_AND_A',
      quickFeedback: false,
    };
  });
  readonly visibleChannels = computed<SessionChannelTab[]>(() => {
    const result: SessionChannelTab[] = [];
    const channels = this.channels();
    if (channels.quiz) result.push('quiz');
    if (channels.qa) result.push('qa');
    if (channels.quickFeedback) result.push('quickFeedback');
    return result;
  });
  readonly showChannelTabs = computed(() => this.visibleChannels().length > 1);
  readonly isStandaloneQaSession = computed(
    () => this.channels().quiz === false && this.channels().qa === true,
  );
  readonly showPrimaryLiveView = computed(() => {
    const active = this.activeChannel();
    if (active === 'quiz') {
      return this.channels().quiz;
    }

    if (active === 'qa' && this.isStandaloneQaSession()) {
      // Standalone-Q&A must render the actual Q&A form once the round is live.
      // Lobby and finished states still use the primary session shell.
      return this.status() !== 'ACTIVE';
    }

    return false;
  });
  readonly qaHeading = computed(
    () =>
      this.sessionSettings().channels?.qa.title ??
      this.sessionSettings().title ??
      $localize`:@@sessionTabs.qaTitleDefault:Fragen zur Veranstaltung...`,
  );
  readonly isQaChannelOpen = computed(() => this.channelOpenState().qa);
  readonly isQuickFeedbackChannelOpen = computed(() => this.channelOpenState().quickFeedback);
  /** Live-Banner: Quiztitel (Anzeige mit Ellipse im Template). */
  readonly liveHeading = computed(
    () => this.sessionSettings().quizName ?? this.sessionSettings().title ?? null,
  );
  readonly qaCanSubmit = computed(
    () =>
      this.qaDraft().trim().length > 0 &&
      this.qaDraft().trim().length <= 500 &&
      !this.qaSubmitting(),
  );
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
  /** Höchster Team-Score (ohne Mindestwert); 0 = noch keine Team-Punkte vergeben. */
  readonly teamLeaderboardTopScore = computed(() => {
    const board = this.teamLeaderboard();
    if (board.length === 0) return 0;
    return Math.max(...board.map((e) => e.totalScore));
  });
  readonly teamScoreboardHasPoints = computed(() => this.teamLeaderboardTopScore() > 0);
  readonly visibleTeamLeaderboard = computed(() => {
    const leaderboard = this.teamLeaderboard();
    const ownEntry = this.ownTeamEntry();
    if (leaderboard.length <= 3 || !ownEntry || ownEntry.rank <= 3) {
      return leaderboard.slice(0, 3);
    }
    return [...leaderboard.slice(0, 2), ownEntry];
  });
  readonly showTeamRewardCard = computed(
    () => this.sessionSettings().teamMode === true && this.ownTeamEntry() !== null,
  );
  readonly showTeamRewardConfetti = computed(
    () =>
      this.showTeamRewardCard() &&
      this.sessionSettings().enableRewardEffects === true &&
      this.isPlayfulPreset() &&
      this.teamScoreboardHasPoints() &&
      this.ownTeamEntry()?.rank === 1,
  );

  readonly timerExpired = computed(() => {
    const s = this.countdownSeconds();
    return s !== null && s <= 0;
  });

  /** True, wenn alle Teilnehmer abgestimmt haben (Server liefert participantCount/totalVotes). Countdown wird dann ausgeblendet. */
  readonly allHaveVoted = computed(() => {
    const q = this.currentQuestion();
    if (!q || !this.isActive()) return false;
    const pc =
      'participantCount' in q ? (q as { participantCount?: number }).participantCount : undefined;
    const tv = 'totalVotes' in q ? (q as { totalVotes?: number }).totalVotes : undefined;
    if (pc === null || pc === undefined || tv === null || tv === undefined || pc <= 0) return false;
    return tv >= pc;
  });

  readonly isRating = computed(() => {
    const q = this.currentQuestion();
    return q && 'type' in q && q.type === 'RATING';
  });
  readonly isFreetext = computed(() => {
    const q = this.currentQuestion();
    return q && 'type' in q && q.type === 'FREETEXT';
  });

  questionUsesCorrectness(type: string | null | undefined): boolean {
    return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
  }

  private voteResponseStorageKey(questionId: string, round: number): string | null {
    if (typeof localStorage === 'undefined' || !this.code) {
      return null;
    }

    const participantId =
      this.participantId() || localStorage.getItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`) || '';
    if (!participantId) {
      return null;
    }

    return `${VOTE_RESPONSE_STORAGE_KEY}-${this.code}-${participantId}-${questionId}-${round}`;
  }

  private questionRoundForStorage(question: CurrentQuestion): number {
    return 'currentRound' in question && typeof question.currentRound === 'number'
      ? question.currentRound
      : this.currentRound();
  }

  private hasLocalVoteState(): boolean {
    return (
      this.selectedAnswerIds().size > 0 ||
      this.freeTextValue().trim().length > 0 ||
      this.ratingValue() !== null
    );
  }

  private restoreStoredVoteResponse(question: CurrentQuestion): void {
    const key = this.voteResponseStorageKey(question.id, this.questionRoundForStorage(question));
    if (!key || this.voteSent() || this.hasLocalVoteState()) {
      return;
    }

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as StoredVoteResponse;
      this.selectedAnswerIds.set(new Set(parsed.answerIds ?? []));
      this.freeTextValue.set(parsed.freeText ?? '');
      this.ratingValue.set(typeof parsed.ratingValue === 'number' ? parsed.ratingValue : null);
      this.voteSent.set(parsed.sent === true);
    } catch {
      /* noop */
    }
  }

  private storeVoteResponse(
    question: CurrentQuestion,
    answerIds: string[],
    freeText: string | undefined,
    ratingValue: number | undefined,
  ): void {
    const key = this.voteResponseStorageKey(question.id, this.questionRoundForStorage(question));
    if (!key || typeof localStorage === 'undefined') {
      return;
    }

    const payload: StoredVoteResponse = {
      answerIds: answerIds.length > 0 ? answerIds : undefined,
      freeText: freeText || undefined,
      ratingValue,
      sent: true,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      /* noop */
    }
  }

  readonly showVoteSubmitAction = computed(() => {
    if (this.showSessionEndGate() || this.isFinished()) return false;
    if (this.activeChannel() !== 'quiz' || !this.isActive() || this.voteSent()) return false;
    return this.hasAnswers() || this.isFreetext() || this.isRating();
  });
  readonly voteSubmitDisabled = computed(() => {
    if (!this.showVoteSubmitAction()) return true;
    if (this.voteSending() || this.debounced() || this.timerExpired()) return true;
    if (this.hasAnswers()) {
      return this.selectedAnswerIds().size === 0;
    }
    if (this.isFreetext()) {
      return !this.freeTextValue().trim();
    }
    if (this.isRating()) {
      return this.ratingValue() === null;
    }
    return true;
  });
  readonly showQaSubmitAction = computed(
    () =>
      !this.showSessionEndGate() &&
      !this.isFinished() &&
      this.activeChannel() === 'qa' &&
      this.isQaChannelOpen(),
  );
  readonly showFinishedActions = computed(() => this.isFinished() && !this.showSessionEndGate());
  readonly showSessionEndGateBonusAction = computed(
    () => this.showSessionEndGate() && Boolean(this.bonusToken()),
  );
  readonly showSessionEndGateFeedbackAction = computed(
    () => this.showSessionEndGate() && !this.feedbackSubmitted(),
  );
  readonly showFinishedBonusAction = computed(
    () => this.showFinishedActions() && Boolean(this.bonusToken()),
  );
  readonly showFinishedFeedbackAction = computed(
    () => this.showFinishedActions() && !this.feedbackSubmitted(),
  );
  readonly sessionEndGateActionCount = computed(
    () =>
      Number(this.showSessionEndGateFeedbackAction()) +
      Number(this.showSessionEndGateBonusAction()) +
      Number(this.showSessionEndGate()),
  );
  readonly finishedActionCount = computed(
    () =>
      Number(this.showFinishedFeedbackAction()) +
      Number(this.showFinishedBonusAction()) +
      Number(this.showFinishedActions()),
  );
  readonly showSessionEndBottomActionBar = computed(
    () => this.showSessionEndGate() || this.showFinishedActions(),
  );
  readonly showFloatingBottomActionBar = computed(
    () => this.showVoteSubmitAction() || this.showQaSubmitAction(),
  );
  readonly showBottomActionBar = computed(
    () => this.showSessionEndBottomActionBar() || this.showFloatingBottomActionBar(),
  );

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
    return (
      (q && 'ratingLabelMin' in q
        ? (q as { ratingLabelMin?: string | null }).ratingLabelMin
        : null) ?? ''
    );
  }

  ratingLabelMax(): string {
    const q = this.currentQuestion();
    return (
      (q && 'ratingLabelMax' in q
        ? (q as { ratingLabelMax?: string | null }).ratingLabelMax
        : null) ?? ''
    );
  }

  selectRating(value: number): void {
    if (this.voteSent() || !this.isActive() || this.timerExpired()) return;
    this.ratingValue.set(value);
    this.cdr.detectChanges();
  }

  getColor(index: number): string {
    return ANSWER_COLORS[index % ANSWER_COLORS.length];
  }
  getShape(index: number): string {
    return ANSWER_SHAPES[index % ANSWER_SHAPES.length];
  }
  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  channelLabel(channel: SessionChannelTab): string {
    switch (channel) {
      case 'quiz':
        return $localize`:@@sessionTabs.quiz:Quiz`;
      case 'qa':
        return $localize`:@@sessionTabs.questions:Q&A`;
      case 'quickFeedback':
        return $localize`:@@sessionTabs.quickFeedback:Blitzlicht`;
    }
  }

  quickFeedbackTabMetaLabel(): string | null {
    if (this.channels().quickFeedback && !this.isQuickFeedbackChannelOpen()) {
      return $localize`:@@sessionTabs.channelClosed:Zu`;
    }
    const result = this.quickFeedbackResult();
    if (!result) {
      return null;
    }

    if (result.discussion) {
      return 'R1';
    }

    if ((result.currentRound ?? 1) === 2) {
      return 'R2';
    }

    if (result.locked) {
      return '||';
    }

    if (result.totalVotes > 0) {
      return String(result.totalVotes);
    }

    return null;
  }

  channelTabMetaLabel(channel: SessionChannelTab): string | null {
    if (channel === 'quickFeedback') {
      return this.quickFeedbackTabMetaLabel();
    }
    return null;
  }

  selectChannel(channel: string): void {
    if (channel === 'quiz' || channel === 'qa' || channel === 'quickFeedback') {
      this.activeChannel.set(channel);
      this.ensureActiveChannel();
    }
  }

  qaStatusLabel(status: QaQuestionDTO['status']): string {
    switch (status) {
      case 'PINNED':
        return $localize`:@@sessionQa.statusPinned:Wird beantwortet`;
      case 'ACTIVE':
        return $localize`:@@sessionQa.statusActive:Offen`;
      case 'PENDING':
        return $localize`:@@sessionQa.statusPending:Wartet auf Freigabe`;
      case 'ARCHIVED':
        return $localize`:@@sessionQa.statusArchived:Beantwortet`;
      case 'DELETED':
        return $localize`:@@sessionQa.statusDeleted:Entfernt`;
    }
  }

  updateQaDraft(value: string): void {
    this.qaDraft.set(value);
  }

  relativeTime(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return $localize`gerade eben`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return $localize`vor ${minutes}\u00A0Min.`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
      return hours === 1 ? $localize`vor 1\u00A0Std.` : $localize`vor ${hours}\u00A0Std.`;
    const days = Math.floor(hours / 24);
    return days === 1 ? $localize`vor 1\u00A0Tag` : $localize`vor ${days}\u00A0Tagen`;
  }

  autoResizeTextarea(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    const maxHeight = parseFloat(getComputedStyle(el).lineHeight) * 6 + 32;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }

  private showQaInfo(msg: string, durationMs = 3000): void {
    if (this.qaInfoTimeout) clearTimeout(this.qaInfoTimeout);
    this.qaInfo.set(msg);
    this.qaInfoTimeout = setTimeout(() => this.qaInfo.set(null), durationMs);
  }

  private showQaError(msg: string, durationMs = 5000): void {
    if (this.qaErrorTimeout) clearTimeout(this.qaErrorTimeout);
    this.qaError.set(msg);
    this.qaErrorTimeout = setTimeout(() => this.qaError.set(null), durationMs);
  }

  private collapseTextarea(): void {
    const el = this.qaTextareaRef?.nativeElement;
    if (el) {
      el.style.height = '';
      el.blur();
    }
  }

  teamRewardTitle(): string {
    const entry = this.ownTeamEntry();
    if (!entry) {
      return '';
    }
    const anyTeamScored = this.teamScoreboardHasPoints();
    if (this.isFinished()) {
      return entry.rank === 1 && anyTeamScored
        ? $localize`:@@sessionVote.teamRewardTitleWinFin:Ihr gewinnt als Team!`
        : $localize`:@@sessionVote.teamRewardTitleFinishedOther:Im Ziel`;
    }
    if (entry.totalScore <= 0) {
      return anyTeamScored
        ? $localize`:@@sessionVote.teamRewardTitleChasingZero:Jetzt nachlegen – ihr holt das noch!`
        : $localize`:@@sessionVote.teamRewardTitleAllZero:Zeigt, was in euch steckt!`;
    }
    if (entry.rank === 1 && anyTeamScored) {
      return $localize`:@@sessionVote.teamRewardTitleLeading:Ihr führt gerade`;
    }
    return $localize`:@@sessionVote.teamRewardTitleChasing:Weitermachen`;
  }

  teamRewardMessage(): string {
    const entry = this.ownTeamEntry();
    if (!entry) {
      return '';
    }
    const anyTeamScored = this.teamScoreboardHasPoints();
    if (this.isFinished()) {
      if (entry.rank === 1 && anyTeamScored) {
        return $localize`:@@sessionVote.teamRewardMsgWinFin:Gemeinsam gewonnen: Platz 1 für euch.`;
      }
      if (!anyTeamScored) {
        return $localize`:@@sessionVote.teamRewardMsgFinishedAllZero:Quiz beendet – es wurden keine Team-Punkte vergeben.`;
      }
      if (entry.totalScore <= 0) {
        return $localize`:@@sessionVote.teamRewardMsgFinishedOwnZero:Quiz beendet – ihr habt keine Team-Punkte gesammelt.`;
      }
      return $localize`:@@sessionVote.teamRewardMsgFinishedOther:Ihr beendet mit ${entry.totalScore}:totalScore: Punkten auf Platz ${entry.rank}:teamRank:.`;
    }
    if (entry.totalScore <= 0) {
      if (!anyTeamScored) {
        return $localize`:@@sessionVote.teamRewardMsgAllZero:Mit richtigen Antworten sammelt ihr Punkte fürs Team.`;
      }
      return $localize`:@@sessionVote.teamRewardMsgChasing:Aktuell Platz ${entry.rank}:teamRank: mit ${entry.totalScore}:totalScore: Punkten.`;
    }
    if (entry.rank === 1 && anyTeamScored) {
      return $localize`:@@sessionVote.teamRewardMsgLeading:Mit ${entry.totalScore}:totalScore: Punkten führt ihr.`;
    }
    return $localize`:@@sessionVote.teamRewardMsgChasing:Aktuell Platz ${entry.rank}:teamRank: mit ${entry.totalScore}:totalScore: Punkten.`;
  }

  teamRewardLeaderHint(): string | null {
    const ownEntry = this.ownTeamEntry();
    const leader = this.teamLeaderboard()[0];
    if (!ownEntry || !leader || leader.teamName === ownEntry.teamName) {
      return null;
    }
    if (leader.totalScore <= 0) {
      return null;
    }
    const leaderLabel = this.teamNameDisplayLabel(leader.teamName);
    return this.isPlayfulPreset()
      ? vpc.voteTeamLeaderHintPlayful(leaderLabel, leader.totalScore)
      : vpc.voteTeamLeaderHintSerious(leaderLabel, leader.totalScore);
  }

  finishedHeroTitle(): string {
    const playful = this.isPlayfulPreset();
    if (!this.personalResultLoaded()) {
      return playful
        ? $localize`:@@sessionVote.finishedTitlePlayfulLoading:Ergebnis wird geladen…`
        : vpc.voteFinishedHeroTitle(false);
    }
    if (!this.finishedHeroIsCelebration()) {
      return playful
        ? $localize`:@@sessionVote.finishedTitlePlayfulNeutral:Das war's – danke fürs Mitmachen!`
        : vpc.voteFinishedHeroTitle(false);
    }
    if (this.personalRank() === 1) {
      return vpc.voteFinishedHeroWinnerTitle(playful);
    }
    return vpc.voteFinishedHeroTitle(playful);
  }

  unansweredResultsMessage(): string | null {
    if (!this.isResults() || this.voteSent() || !this.currentQuestion()) {
      return null;
    }
    return this.timeoutMessage() ?? vpc.voteMissedResultsMessage(this.isPlayfulPreset());
  }

  finishedHeroMatIcon(): string {
    if (!this.personalResultLoaded()) {
      return 'hourglass_top';
    }
    return this.finishedHeroIsCelebration() ? 'emoji_events' : 'task_alt';
  }

  /** Sichtbarer Team-Rang (#n) oder Gedankenstrich, solange die Wertung noch ohne Punkte ist. */
  teamRewardRankDisplay(rank: number): string {
    return this.teamScoreboardHasPoints() ? `#${rank}` : '\u2014';
  }

  teamStandingAriaLabel(entry: TeamLeaderboardEntryDTO): string {
    const teamLabel = this.teamNameDisplayLabel(entry.teamName);
    if (!this.teamScoreboardHasPoints()) {
      return $localize`:@@sessionVote.teamStandingNoRank:${teamLabel}:teamName: mit ${this.teamMemberLabel(entry.memberCount)}:memberCountLabel: und ${entry.totalScore}:totalScore: Team-Punkten, noch ohne Rang`;
    }
    return $localize`:@@sessionVote.teamStandingWithMembers:Platz ${entry.rank}:teamRank:: ${teamLabel}:teamName: mit ${this.teamMemberLabel(entry.memberCount)}:memberCountLabel: und ${entry.totalScore}:totalScore: Punkten`;
  }

  private teamNameDisplayLabel(teamName: string): string {
    const label = stripEdgeEmojiMarker(teamName).trim();
    return label.length > 0 ? label : $localize`Team`;
  }

  teamMemberLabel(count: number): string {
    return count === 1 ? $localize`${count} Mitglied` : $localize`${count} Mitglieder`;
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
    const cached = this.markdownCache.get(value);
    if (cached) {
      return cached;
    }
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      decorateLeadingAnswerEmoji(
        renderMarkdownWithKatex(value, { imagePolicy: 'external-https-only' }).html,
      ),
    );
    this.markdownCache.set(value, rendered);
    return rendered;
  }

  /** Nach Session-Ende: optional Bonus-Code zeigen, sonst direkt zur Startseite. */
  private redirectToHomeIfSessionFinished(): void {
    void this.runSessionEndRedirect();
  }

  private async runSessionEndRedirect(): Promise<void> {
    if (this.status() !== 'FINISHED') return;
    if (this.sessionEndRedirectInFlight) return;
    this.sessionEndRedirectInFlight = true;
    try {
      const pid = this.participantId();
      if (pid) {
        await this.loadPersonalResult();
        await this.refreshFeedbackSubmittedForGate();
      }
      const bonus = this.bonusToken();
      const hasBonus = typeof bonus === 'string' && bonus.length > 0;
      const needsFeedback = Boolean(pid) && !this.feedbackSubmitted();
      if (hasBonus || needsFeedback) {
        this.showSessionEndGate.set(true);
        return;
      }
      await this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
    } finally {
      if (!this.showSessionEndGate()) {
        this.sessionEndRedirectInFlight = false;
      }
    }
  }

  /** Frische Abfrage vor dem Abschluss-Screen (unabhängig vom Effect). */
  private async refreshFeedbackSubmittedForGate(): Promise<void> {
    const pid = this.participantId();
    if (!this.code || !pid) return;
    try {
      const { submitted } = await trpc.session.getHasSubmittedFeedback.query({
        code: this.code,
        participantId: pid,
      });
      this.feedbackSubmitted.set(submitted);
      if (submitted) {
        void this.loadFeedbackSummary();
      }
    } catch {
      /* optional: Formular anzeigen */
    } finally {
      this.feedbackStateLoaded = true;
    }
  }

  continueToHomeAfterSessionEnd(): void {
    void this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
  }

  async ngOnInit(): Promise<void> {
    if (!this.code) return;

    if (typeof localStorage !== 'undefined') {
      this.participantId.set(localStorage.getItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`) ?? '');
      this.playerNickname.set(localStorage.getItem(`${NICKNAME_STORAGE_KEY}-${this.code}`) ?? null);
    }

    await this.generateQrCode();
    await this.loadSessionInfo();

    this.statusSub = trpc.session.onStatusChanged.subscribe(
      { code: this.code },
      {
        onError: () => {
          /* Nach Deploy/Netz: sofortiger HTTP-Resync, nicht nur 2s-Polling */
          this.lastSessionInfoRetryAt = 0;
          void this.refreshSessionInfoFallback();
          void this.refreshQuestion();
        },
        onData: (data: {
          status: string;
          currentQuestion: number | null;
          activeAt?: string;
          timer?: number | null;
          preset?: string;
          currentRound?: number;
          serverTime?: string;
        }) => {
          if (data.serverTime) {
            recordServerTimeIso(data.serverTime);
          }
          const prevRound = this.currentRound();
          const newRound = data.currentRound ?? 1;
          this.status.set(data.status as SessionStatus);
          if (data.status === 'FINISHED') {
            this.redirectToHomeIfSessionFinished();
            return;
          }
          this.currentRound.set(newRound);
          if (newRound !== prevRound) {
            this.emojiSent.set(false);
            this.emojiSentEmoji.set('');
          }
          if (data.preset === 'PLAYFUL' || data.preset === 'SERIOUS') {
            this.themePreset.setPreset(data.preset === 'PLAYFUL' ? 'spielerisch' : 'serious', {
              silent: true,
            });
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
          } else if (data.status === 'ACTIVE') {
            this.stopCountdown();
            this.countdownSeconds.set(null);
          } else if (data.status !== 'ACTIVE') {
            this.stopCountdown();
            this.countdownSeconds.set(null);
          }
          if (this.sessionSettings().teamMode) {
            if (data.status === 'RESULTS') {
              void this.loadTeamRewardState();
            } else {
              this.teamLeaderboard.set([]);
            }
          }
          void this.refreshQuestion();
        },
      },
    );

    this.ensureQaSubscription();

    this.pollTimer = setInterval(() => {
      void this.refreshSessionInfoFallback();
      void this.refreshQuestion();
      void this.refreshQuickFeedbackResult();
    }, VOTE_FALLBACK_POLL_MS);
  }
  private async loadSessionInfo(): Promise<void> {
    try {
      const session = await trpc.session.getInfo.query({ code: this.code });
      recordServerTimeIso(session.serverTime);
      this.sessionId.set(session.id);
      this.status.set(session.status as SessionStatus);
      this.sessionSettings.set(session);
      if (session.status === 'FINISHED') {
        this.redirectToHomeIfSessionFinished();
        return;
      }
      this.ensureQaSubscription();
      await this.refreshQaQuestions();
      if (session.preset === 'PLAYFUL' || session.preset === 'SERIOUS') {
        this.themePreset.setPreset(session.preset === 'PLAYFUL' ? 'spielerisch' : 'serious', {
          silent: true,
        });
      }
      if (session.teamMode) {
        await Promise.all([this.loadParticipantTeam(), this.loadSessionTeams()]);
        if (session.status === 'RESULTS') {
          await this.loadTeamLeaderboard();
        }
      }
      await this.refreshQuestion();
      await this.refreshQuickFeedbackResult();
    } catch {
      // Parent-Shell validiert bereits; Retry läuft über Polling.
    }
  }

  private ensureQaSubscription(): void {
    if (!this.channels().qa || !this.isQaChannelOpen() || !this.sessionId()) {
      this.qaSub?.unsubscribe();
      this.qaSub = null;
      return;
    }

    if (this.qaSub) {
      return;
    }

    this.qaSub = trpc.qa.onQuestionsUpdated.subscribe(
      { sessionId: this.sessionId(), participantId: this.participantId() || undefined },
      {
        onData: (data) => {
          if (Date.now() < this.reorderLockUntil) return;
          this.setQaQuestionsAnimated(data);
          this.qaError.set(null);
        },
        onError: () => {
          this.lastSessionInfoRetryAt = 0;
          void this.refreshSessionInfoFallback();
          void this.refreshQaQuestions();
        },
      },
    );
  }

  private async refreshSessionInfoFallback(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSessionInfoRetryAt < 3000) {
      return;
    }
    this.lastSessionInfoRetryAt = now;
    try {
      const session = await trpc.session.getInfo.query({ code: this.code });
      recordServerTimeIso(session.serverTime);
      const nextStatus = session.status as SessionStatus;
      const prevStatus = this.status();
      const previousTeamMode = this.sessionSettings().teamMode === true;
      this.sessionId.set(session.id);
      this.sessionSettings.set(session);
      this.status.set(nextStatus);
      if (nextStatus === 'FINISHED') {
        this.redirectToHomeIfSessionFinished();
        return;
      }
      this.ensureQaSubscription();
      if (session.teamMode && !previousTeamMode) {
        await Promise.all([this.loadParticipantTeam(), this.loadSessionTeams()]);
      }
      if (session.preset === 'PLAYFUL' || session.preset === 'SERIOUS') {
        this.themePreset.setPreset(session.preset === 'PLAYFUL' ? 'spielerisch' : 'serious', {
          silent: true,
        });
      }
      if (prevStatus !== nextStatus && session.teamMode) {
        if (nextStatus === 'RESULTS') {
          void this.loadTeamRewardState();
        } else {
          this.teamLeaderboard.set([]);
        }
      }
      if (nextStatus === 'ACTIVE' && this.countdownSeconds() === null) {
        this.startCountdown(this.currentQuestion());
      }
    } catch {
      // best-effort fallback, WebSocket bleibt primärer Kanal
    }
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
    this.statusSub = null;
    this.qaSub?.unsubscribe();
    this.qaSub = null;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.stopCountdown();
  }

  get joinUrl(): string {
    return resolveLocalizedJoinUrl(this.code);
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
      const remaining = remainingCountdownSeconds(deadline);
      this.countdownSeconds.set(remaining);
      if (remaining <= 0) {
        this.stopCountdown();
        this.countdownSeconds.set(0);
        if (!this.voteSent()) {
          this.timeoutMessage.set(
            pickRandom(
              this.isPlayfulPreset() ? MESSAGES_TIMEOUT_PLAYFUL : MESSAGES_TIMEOUT_SERIOUS,
            ),
          );
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
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.fingerHideTimeout) {
      clearTimeout(this.fingerHideTimeout);
      this.fingerHideTimeout = null;
    }
  }

  /**
   * Teilnehmende sollen Q&A und Blitzlicht parallel zum Quiz nutzen können (ADR-0009).
   * Sperre nur: Lesephase (QUESTION_OPEN); Abstimmung (ACTIVE) solange die Antwort noch nicht
   * gesendet wurde (`voteSent`). Danach z. B. Blitzlicht oder Q&A während laufendem Timer.
   */
  private quizChannelLocksStudentNavigation(): boolean {
    if (this.currentQuestion() === null) {
      return false;
    }
    const s = this.status();
    if (s === 'QUESTION_OPEN') {
      return true;
    }
    if (s === 'ACTIVE') {
      return !this.voteSent();
    }
    return false;
  }

  private ensureActiveChannel(): void {
    const visible = this.visibleChannels();
    if (visible.length === 0) {
      return;
    }

    const active = this.activeChannel();
    if (!visible.includes(active)) {
      this.activeChannel.set(visible[0]!);
      return;
    }

    const quizContentVisible =
      visible.includes('quiz') &&
      this.currentQuestion() !== null &&
      (this.status() === 'QUESTION_OPEN' ||
        this.status() === 'ACTIVE' ||
        this.status() === 'DISCUSSION' ||
        this.status() === 'RESULTS');
    const quickFeedbackRoundVisible =
      visible.includes('quickFeedback') &&
      this.isQuickFeedbackChannelOpen() &&
      this.quickFeedbackResult() !== null &&
      !quizContentVisible;
    const qaRoundVisible =
      visible.includes('qa') &&
      this.isQaChannelOpen() &&
      this.status() === 'ACTIVE' &&
      this.currentQuestion() === null;

    if (active !== 'quickFeedback' && quickFeedbackRoundVisible) {
      this.activeChannel.set('quickFeedback');
      return;
    }

    if (
      active === 'quickFeedback' &&
      this.isQuickFeedbackChannelOpen() &&
      !quickFeedbackRoundVisible &&
      qaRoundVisible
    ) {
      this.activeChannel.set('qa');
      return;
    }

    if (active === 'quiz' && qaRoundVisible) {
      this.activeChannel.set('qa');
      return;
    }

    if (active !== 'quiz' && visible.includes('quiz') && this.quizChannelLocksStudentNavigation()) {
      this.activeChannel.set('quiz');
    }
  }

  private async generateQrCode(): Promise<void> {
    if (!this.code) {
      this.qrDataUrl.set('');
      return;
    }

    try {
      const qrcodeModule = await import('qrcode-generator');
      const qrcodeFactory = (qrcodeModule.default ?? qrcodeModule) as unknown as (
        typeNumber: 0,
        errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H',
      ) => {
        addData(data: string): void;
        make(): void;
        createDataURL(cellSize?: number, margin?: number): string;
      };
      const qr = qrcodeFactory(0, 'M');
      qr.addData(this.joinUrl);
      qr.make();
      this.qrDataUrl.set(qr.createDataURL(8, 2));
    } catch {
      this.qrDataUrl.set('');
    }
  }

  private async refreshQaQuestions(): Promise<void> {
    if (!this.channels().qa || !this.isQaChannelOpen() || !this.sessionId()) {
      this.qaQuestions.set([]);
      return;
    }
    if (Date.now() < this.reorderLockUntil) return;

    try {
      const questions = await trpc.qa.list.query({
        sessionId: this.sessionId(),
        participantId: this.participantId() || undefined,
      });
      if (Date.now() < this.reorderLockUntil) return;
      this.setQaQuestionsAnimated(questions);
      this.qaError.set(null);
    } catch {
      this.showQaError($localize`:@@sessionQa.voteLoadError:Fragen konnten nicht geladen werden.`);
    }
  }

  private async refreshQuickFeedbackResult(): Promise<void> {
    if (!this.channels().quickFeedback || !this.isQuickFeedbackChannelOpen() || !this.code) {
      this.quickFeedbackResult.set(null);
      return;
    }

    try {
      const result = await trpc.quickFeedback.results.query({ sessionCode: this.code });
      this.quickFeedbackResult.set(result);
    } catch {
      this.quickFeedbackResult.set(null);
    }
  }

  async submitQaQuestion(): Promise<void> {
    if (!this.isQaChannelOpen() || !this.qaCanSubmit()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastQaSubmitAt < 450) {
      return;
    }
    this.lastQaSubmitAt = now;
    this.qaSubmitting.set(true);
    this.qaError.set(null);
    this.qaInfo.set(null);
    try {
      const context = await this.ensureQaSubmitContext();
      if (!context) {
        return;
      }
      await trpc.qa.submit.mutate({
        sessionId: context.sessionId,
        participantId: context.participantId,
        text: this.qaDraft().trim(),
      });
      this.qaDraft.set('');
      this.collapseTextarea();
      this.showQaInfo($localize`:@@sessionQa.submitSuccess:Frage gesendet.`);
      await this.refreshQaQuestions();
    } catch (error) {
      this.showQaError(
        localizeKnownServerError(
          error,
          $localize`:@@sessionQa.submitError:Frage konnte nicht gesendet werden.`,
        ),
      );
    } finally {
      this.qaSubmitting.set(false);
    }
  }

  private async ensureQaSubmitContext(): Promise<{
    sessionId: string;
    participantId: string;
  } | null> {
    let sessionId = this.sessionId();
    if (!sessionId && this.code) {
      try {
        const session = await trpc.session.getInfo.query({ code: this.code });
        sessionId = session.id;
        this.sessionId.set(session.id);
        this.sessionSettings.set(session);
      } catch {
        this.showQaError($localize`:@@sessionQa.submitError:Frage konnte nicht gesendet werden.`);
        return null;
      }
    }

    let participantId = this.participantId();
    if (!participantId && typeof localStorage !== 'undefined' && this.code) {
      participantId = localStorage.getItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`) ?? '';
      if (participantId) {
        this.participantId.set(participantId);
      }
    }

    if (!participantId && this.code) {
      try {
        const autoNickname = `Teilnehmende #${Math.floor(Math.random() * 9000) + 1000}`;
        const join = await trpc.session.join.mutate({
          code: this.code,
          nickname: autoNickname,
        });
        participantId = join.participantId;
        sessionId = join.id;
        this.participantId.set(participantId);
        this.sessionId.set(sessionId);
        this.playerNickname.set(autoNickname);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`${PARTICIPANT_STORAGE_KEY}-${this.code}`, participantId);
          localStorage.setItem(`${NICKNAME_STORAGE_KEY}-${this.code}`, autoNickname);
        }
      } catch (error) {
        this.showQaError(
          localizeKnownServerError(
            error,
            $localize`:@@sessionQa.submitError:Frage konnte nicht gesendet werden.`,
          ),
        );
        return null;
      }
    }

    if (!sessionId || !participantId) {
      this.showQaError($localize`:@@sessionQa.submitError:Frage konnte nicht gesendet werden.`);
      return null;
    }

    return { sessionId, participantId };
  }

  async voteQa(questionId: string, direction: 'UP' | 'DOWN'): Promise<void> {
    if (
      !this.isQaChannelOpen() ||
      !this.participantId() ||
      this.qaPendingQuestionIds().has(questionId)
    ) {
      return;
    }

    this.qaError.set(null);
    const nextPending = new Set(this.qaPendingQuestionIds());
    nextPending.add(questionId);
    this.qaPendingQuestionIds.set(nextPending);

    const snapshot = this.qaQuestions();
    this.applyOptimisticVote(questionId, direction);
    this.reorderLockUntil = Date.now() + 1800;

    try {
      await trpc.qa.vote.mutate({
        questionId,
        participantId: this.participantId(),
        direction,
      });
      const serverData = await trpc.qa.list.query({
        sessionId: this.sessionId(),
        participantId: this.participantId() || undefined,
      });
      const wait = Math.max(0, this.reorderLockUntil - Date.now());
      await new Promise((r) => setTimeout(r, wait));
      this.setQaQuestionsAnimated(serverData);
      this.qaError.set(null);
    } catch {
      this.qaQuestions.set(snapshot);
      this.showQaError($localize`:@@sessionQa.upvoteError:Stimme konnte nicht gespeichert werden.`);
    } finally {
      this.reorderLockUntil = 0;
      const remaining = new Set(this.qaPendingQuestionIds());
      remaining.delete(questionId);
      this.qaPendingQuestionIds.set(remaining);
    }
  }

  async deleteOwnQuestion(questionId: string): Promise<void> {
    if (
      !this.isQaChannelOpen() ||
      !this.participantId() ||
      this.qaPendingQuestionIds().has(questionId)
    )
      return;

    const pending = new Set(this.qaPendingQuestionIds());
    pending.add(questionId);
    this.qaPendingQuestionIds.set(pending);
    this.qaError.set(null);

    this.qaQuestions.update((qs) => qs.filter((q) => q.id !== questionId));

    try {
      await trpc.qa.deleteOwn.mutate({ questionId, participantId: this.participantId() });
      await this.refreshQaQuestions();
    } catch {
      this.showQaError($localize`:@@sessionQa.deleteOwnError:Frage konnte nicht gelöscht werden.`);
      await this.refreshQaQuestions();
    } finally {
      const remaining = new Set(this.qaPendingQuestionIds());
      remaining.delete(questionId);
      this.qaPendingQuestionIds.set(remaining);
    }
  }

  private applyOptimisticVote(questionId: string, direction: 'UP' | 'DOWN'): void {
    this.qaQuestions.update((questions) =>
      questions.map((q) => {
        if (q.id !== questionId) return q;
        const wasVoted = q.myVote;
        if (wasVoted === direction) {
          const delta = direction === 'UP' ? -1 : 1;
          return { ...q, myVote: null, hasUpvoted: false, upvoteCount: q.upvoteCount + delta };
        }
        if (wasVoted) {
          const delta = direction === 'UP' ? 2 : -2;
          return {
            ...q,
            myVote: direction,
            hasUpvoted: direction === 'UP',
            upvoteCount: q.upvoteCount + delta,
          };
        }
        const delta = direction === 'UP' ? 1 : -1;
        return {
          ...q,
          myVote: direction,
          hasUpvoted: direction === 'UP',
          upvoteCount: q.upvoteCount + delta,
        };
      }),
    );
  }

  /** Wenn Fragen aus der Liste verschwinden (Moderation), Teilnehmende per Snackbar informieren. */
  private notifyQaModeratorRemovals(prev: QaQuestionDTO[], next: QaQuestionDTO[]): void {
    if (prev.length === 0) {
      return;
    }
    const nextIds = new Set(next.map((q) => q.id));
    const removed = prev.filter((q) => !nextIds.has(q.id));
    if (removed.length === 0) {
      return;
    }

    const ownRemoved = removed.filter((q) => q.isOwn);
    const otherRemoved = removed.filter((q) => !q.isOwn);

    let msg: string | null = null;
    if (ownRemoved.length > 0) {
      msg =
        ownRemoved.length > 1
          ? $localize`:@@sessionQa.snackModeratorRemovedOwnMany:Die Moderation hat deine Fragen entfernt.`
          : $localize`:@@sessionQa.snackModeratorRemovedOwn:Die Moderation hat deine Frage entfernt.`;
    } else if (otherRemoved.length > 0) {
      msg =
        otherRemoved.length > 1
          ? $localize`:@@sessionQa.snackModeratorRemovedOthersMany:Mehrere Fragen wurden von der Moderation entfernt.`
          : $localize`:@@sessionQa.snackModeratorRemovedOther:Eine Frage wurde von der Moderation entfernt.`;
    }

    if (msg) {
      this.snackBar.open(msg, '', { duration: 8000 });
    }
  }

  private setQaQuestionsAnimated(next: QaQuestionDTO[]): void {
    const prev = this.qaQuestions();
    this.notifyQaModeratorRemovals(prev, next);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const container: HTMLElement | null = this.el.nativeElement.querySelector('.session-qa-list');

    if (!container || prefersReducedMotion) {
      this.qaQuestions.set(next);
      return;
    }

    const cards = container.querySelectorAll<HTMLElement>('[data-qa-id]');
    const prevRects = new Map<string, DOMRect>();
    cards.forEach((card) => {
      const id = card.getAttribute('data-qa-id');
      if (id) prevRects.set(id, card.getBoundingClientRect());
    });

    this.qaQuestions.set(next);
    this.cdr.detectChanges();

    requestAnimationFrame(() => {
      const newCards = container.querySelectorAll<HTMLElement>('[data-qa-id]');
      newCards.forEach((card) => {
        const id = card.getAttribute('data-qa-id');
        if (!id) return;
        const prev = prevRects.get(id);
        if (!prev) {
          card.animate(
            [
              { opacity: 0, transform: 'scale(0.95)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            {
              duration: 600,
              easing: 'ease-out',
            },
          );
          return;
        }
        const curr = card.getBoundingClientRect();
        const dy = prev.top - curr.top;
        if (Math.abs(dy) < 1) return;
        card.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], {
          duration: 800,
          easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        });
      });
    });
  }

  private async refreshQuestion(): Promise<void> {
    try {
      const q = await trpc.session.getCurrentQuestionForStudent.query({ code: this.code });
      const prev = this.currentQuestion();
      const prevId = prev && 'id' in prev ? prev.id : null;
      const newId = q && 'id' in q ? q.id : null;
      const prevHadTimer = prev && 'timer' in prev && prev.timer;
      const newHasTimer = q && 'timer' in q && q.timer;

      const qRound =
        q && 'currentRound' in q ? (q as { currentRound?: number }).currentRound : undefined;
      if (qRound && qRound !== this.currentRound()) {
        this.emojiSent.set(false);
        this.emojiSentEmoji.set('');
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
      } else if (prevHadTimer && !newHasTimer) {
        this.stopCountdown();
        this.countdownSeconds.set(null);
      } else if (!prevHadTimer && newHasTimer && !this.countdownTimer) {
        this.startCountdown(q);
      }

      if (q && this.isResults()) {
        this.restoreStoredVoteResponse(q);
      }

      if (q && this.isResults() && this.voteSent() && !this.motivationMessage()) {
        const settings = this.sessionSettings();
        const qType = 'type' in q ? q.type : null;
        const isScored = qType === 'SINGLE_CHOICE' || qType === 'MULTIPLE_CHOICE';

        if (isScored && 'answers' in q) {
          const selected = this.selectedAnswerIds();
          const revealed = (q as QuestionRevealedDTO).answers;
          const correctIds = new Set(revealed.filter((a) => a.isCorrect).map((a) => a.id));
          const allCorrect =
            correctIds.size > 0 &&
            selected.size > 0 &&
            [...correctIds].every((id) => selected.has(id)) &&
            [...selected].every((id) => correctIds.has(id));

          if (allCorrect && settings.enableRewardEffects) {
            this.showRewardEffect.set(true);
          }
          if (settings.enableMotivationMessages) {
            const playful = this.isPlayfulPreset();
            this.motivationMessage.set(
              pickRandom(
                allCorrect
                  ? playful
                    ? MESSAGES_CORRECT_PLAYFUL
                    : MESSAGES_CORRECT_SERIOUS
                  : playful
                    ? MESSAGES_WRONG_PLAYFUL
                    : MESSAGES_WRONG_SERIOUS,
              ),
            );
          }
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

      // Gleiche Frage: Antwort-Liste beibehalten, um Re-Render zu vermeiden – Buttons reagieren sofort.
      // Bei Wechsel ACTIVE → RESULTS (oder erneutem Poll in RESULTS) Server-Antworten übernehmen: dort sind
      // isCorrect + Verteilung (QuestionRevealedDTO); die alte Student-Liste hat kein isCorrect — sonst
      // würden alle Optionen fälschlich als falsch erscheinen.
      const newAnswers = q && 'answers' in q ? (q as { answers?: unknown[] }).answers : undefined;
      const firstNew = Array.isArray(newAnswers) ? newAnswers[0] : undefined;
      const incomingHasSolution =
        typeof firstNew === 'object' && firstNew !== null && 'isCorrect' in firstNew;

      if (
        newId === prevId &&
        prev &&
        q &&
        'answers' in prev &&
        'answers' in q &&
        Array.isArray((prev as { answers: unknown[] }).answers) &&
        !incomingHasSolution
      ) {
        const prevAnswers = (prev as { answers: unknown[] }).answers;
        this.currentQuestion.set({ ...q, answers: prevAnswers } as CurrentQuestion);
      } else {
        this.currentQuestion.set(q);
      }
      this.ensureActiveChannel();

      const pc =
        q && 'participantCount' in q
          ? (q as { participantCount?: number }).participantCount
          : undefined;
      const tv = q && 'totalVotes' in q ? (q as { totalVotes?: number }).totalVotes : undefined;
      if (typeof pc === 'number' && typeof tv === 'number' && pc > 0 && tv >= pc) {
        this.stopCountdown();
        this.countdownSeconds.set(null);
      }
      const phase = this.resolveVoteAutoScrollPhase();
      if (newId && phase === 'read') {
        this.questionIdsWithReadPhase.add(newId);
      }
      if (newId && phase) {
        const hadReadPhase = this.questionIdsWithReadPhase.has(newId);
        const prioritizeQuestionOnVote =
          phase === 'vote' &&
          this.currentRound() === 2 &&
          !this.questionIdsWithRound2QuestionScroll.has(newId);
        this.schedulePhaseDrivenVoteScroll(
          newId,
          phase,
          hadReadPhase,
          this.currentRound(),
          prioritizeQuestionOnVote,
        );
        if (prioritizeQuestionOnVote) {
          this.questionIdsWithRound2QuestionScroll.add(newId);
        }
      }
    } catch {
      /* noop */
    }
  }

  private resolveVoteAutoScrollPhase(): VoteAutoScrollPhase | null {
    if (!this.showPrimaryLiveView()) return null;
    if (this.isQuestionOpen()) return 'read';
    if (this.isActive()) return 'vote';
    if (this.isResults()) return 'result';
    return null;
  }

  private schedulePhaseDrivenVoteScroll(
    questionId: string,
    phase: VoteAutoScrollPhase,
    hadReadPhase: boolean,
    round: number,
    prioritizeQuestionOnVote: boolean,
  ): void {
    const token = `${questionId}:${phase}:${hadReadPhase ? 'read' : 'direct'}:r${round}`;
    if (this.lastAutoScrollToken === token) {
      return;
    }
    this.lastAutoScrollToken = token;
    afterNextRender(
      () => {
        this.scrollVoteAnchorIntoView(phase, hadReadPhase, prioritizeQuestionOnVote);
      },
      { injector: this.injector },
    );
  }

  private scheduleResultContentScroll(token: string): void {
    if (this.lastResultContentScrollToken === token) {
      return;
    }
    this.lastResultContentScrollToken = token;
    afterNextRender(
      () => {
        this.scrollVoteAnchorIntoView('result', false, false);
      },
      { injector: this.injector },
    );
  }

  private voteScrollBehavior(): ScrollBehavior {
    if (typeof globalThis.matchMedia !== 'function') return 'auto';
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  private findFirstAvailableVoteAnchor(candidateIds: string[]): HTMLElement | null {
    const host = this.el.nativeElement as HTMLElement;
    for (const anchorId of candidateIds) {
      const anchor = host.querySelector(`#${anchorId}`) as HTMLElement | null;
      if (anchor) return anchor;
    }
    return null;
  }

  private ensureFocusable(element: HTMLElement): void {
    if (element.tabIndex < 0 && !element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '-1');
    }
  }

  private scrollVoteAnchorIntoView(
    phase: VoteAutoScrollPhase,
    hadReadPhase: boolean,
    prioritizeQuestionOnVote: boolean,
  ): void {
    if (!this.showPrimaryLiveView()) return;
    const host = this.el.nativeElement as HTMLElement;
    const scrollRoot = host.closest('.app-main') as HTMLElement | null;
    const anchor = this.findFirstAvailableVoteAnchor(
      anchorCandidatesForPhase(phase, hadReadPhase, prioritizeQuestionOnVote),
    );
    if (!scrollRoot) return;
    const behavior = this.voteScrollBehavior();
    if (anchor) {
      const rootRect = scrollRoot.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const toolbarClearancePx = parseFloat(getComputedStyle(scrollRoot).paddingTop) || 0;
      const gapPx = 8;
      const y = anchorRect.top - rootRect.top + scrollRoot.scrollTop - toolbarClearancePx - gapPx;
      scrollRoot.scrollTo({ top: Math.max(0, y), behavior });
      const focusTargetId = focusTargetIdForAnchor(anchor.id);
      const focusTarget =
        (focusTargetId ? (host.querySelector(`#${focusTargetId}`) as HTMLElement | null) : null) ??
        anchor;
      this.ensureFocusable(focusTarget);
      focusTarget.focus({ preventScroll: true });
    } else {
      scrollRoot.scrollTo({ top: 0, behavior });
    }
  }

  toggleAnswer(answerId: string): void {
    if (this.voteSent() || this.debounced() || !this.isActive() || this.timerExpired()) return;
    const now = Date.now();
    if (now - this.lastAnswerToggleAt < 90) return;
    this.lastAnswerToggleAt = now;
    const q = this.currentQuestion();
    if (!q || !('type' in q)) return;
    const set = new Set(this.selectedAnswerIds());

    if (q.type === 'SINGLE_CHOICE') {
      this.selectedAnswerIds.set(new Set([answerId]));
    } else {
      if (set.has(answerId)) set.delete(answerId);
      else set.add(answerId);
      this.selectedAnswerIds.set(set);
    }
    this.cdr.detectChanges();
  }

  async submitVote(overrideIds?: string[]): Promise<void> {
    if (this.voteSending() || this.voteSent() || this.debounced() || this.timerExpired()) return;
    const now = Date.now();
    if (now - this.lastVoteSubmitAt < 450) return;
    this.lastVoteSubmitAt = now;
    const q = this.currentQuestion();
    if (!q || !('id' in q)) return;

    const answerIds = overrideIds ?? [...this.selectedAnswerIds()];
    const freeText = q.type === 'FREETEXT' ? this.freeTextValue().trim() : undefined;
    const rating = q.type === 'RATING' ? (this.ratingValue() ?? undefined) : undefined;

    this.debounced.set(true);
    this.voteSending.set(true);
    this.voteError.set(null);
    this.voteSent.set(true);
    this.cdr.detectChanges();

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
      this.storeVoteResponse(q, answerIds, freeText, rating);
      try {
        navigator.vibrate?.(10);
      } catch {
        /* unsupported */
      }
    } catch (err: unknown) {
      this.voteSent.set(false);
      this.voteError.set(localizeKnownServerError(err, 'Abstimmung fehlgeschlagen.'));
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
        round: this.currentRound(),
      });
    } catch {
      /* noop */
    }
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
        this.motivationMessage.set(
          getContextMotivation(sc, totalParticipants, this.isPlayfulPreset()),
        );
      }
    } catch {
      /* noop */
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
    } catch {
      /* noop */
    }
  }

  private async loadParticipantTeam(): Promise<void> {
    const pid = this.participantId();
    if (!this.code || !pid || this.sessionSettings().teamMode !== true) {
      this.participantTeam.set(null);
      return;
    }
    try {
      const me = await trpc.session.getParticipantSelf.query({
        code: this.code,
        participantId: pid,
      });
      this.participantTeam.set(me);
      if (me?.nickname && !this.playerNickname()) {
        this.playerNickname.set(me.nickname);
      }
    } catch {
      this.participantTeam.set(null);
    }
  }

  private async loadSessionTeams(): Promise<void> {
    if (!this.code || this.sessionSettings().teamMode !== true) {
      this.sessionTeams.set([]);
      return;
    }
    try {
      const payload = await trpc.session.getTeams.query({ code: this.code });
      this.sessionTeams.set(payload.teams);
    } catch {
      this.sessionTeams.set([]);
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
    } catch {
      /* noop */
    }
  }

  setFeedbackOverall(v: number): void {
    this.feedbackOverall.set(v);
  }
  setFeedbackQuality(v: number): void {
    this.feedbackQuality.set(v);
  }
  setFeedbackRepeat(v: boolean): void {
    this.feedbackRepeat.set(this.feedbackRepeat() === v ? null : v);
  }

  feedbackStars(): number[] {
    return [1, 2, 3, 4, 5];
  }

  async submitFeedback(): Promise<void> {
    if (this.feedbackSubmitting() || this.feedbackSubmitted() || this.feedbackOverall() === 0)
      return;
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
      this.snackBar.open(vpc.voteFeedbackSnack(this.isPlayfulPreset()), '', { duration: 2000 });
      void this.loadFeedbackSummary();
    } catch (err: unknown) {
      const raw =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : '';
      const msg = localizeKnownServerMessage(raw);
      if (msg.includes('bereits bewertet')) {
        this.feedbackSubmitted.set(true);
        void this.loadFeedbackSummary();
      } else {
        this.snackBar.open(
          localizeKnownServerError(err, 'Feedback konnte nicht gesendet werden.'),
          '',
          {
            duration: 6000,
          },
        );
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
    } catch {
      /* noop */
    }
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
