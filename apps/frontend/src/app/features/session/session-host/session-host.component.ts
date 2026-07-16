import { DecimalPipe, DOCUMENT, formatNumber } from '@angular/common';
import {
  getDocumentFullscreenElement,
  isDocumentFullscreenEnterAvailable,
  tryExitDocumentFullscreen,
  tryRequestDocumentFullscreen,
} from '../../../core/document-fullscreen.util';
import { formatLocaleCount, formatLocaleNumber } from '../../../core/locale-number.util';
import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  LOCALE_ID,
  NgZone,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  afterNextRender,
  inject,
  isDevMode,
  signal,
  computed,
  effect,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import {
  MatCard,
  MatCardContent,
  MatCardHeader,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import type { Unsubscribable } from '@trpc/server/observable';
import { clearFeedbackHostToken } from '../../../core/feedback-host-token';
import { clearHostToken } from '../../../core/host-session-token';
import {
  getEffectiveLocale,
  localeIdToSupported,
  type SupportedLocale,
} from '../../../core/locale-from-path';
import { trpc } from '../../../core/trpc.client';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { decorateLeadingAnswerEmoji } from '../../../shared/leading-answer-emoji.util';
import {
  answerOptionColor,
  answerOptionShape,
  showQuestionTypeIndicator,
} from '../../../shared/answer-option-badge.util';
import { AnswerOptionBadgeComponent } from '../../../shared/answer-option-badge/answer-option-badge.component';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { SoundService } from '../../../core/sound.service';
import { HostDisplayModeService } from '../../../core/host-display-mode.service';
import { localizePath, resolveLocalizedJoinUrl } from '../../../core/locale-router';
import { sessionCodeAriaLabel as i18nSessionCodeAria } from '../../../core/session-code-aria';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../../../shared/confirm-leave-dialog/confirm-leave-dialog.component';
import {
  createQuizHistoryAccessProof,
  resolveNumericEstimateToleranceMode,
  resolveNumericTolerance,
  CONFIDENCE_SCALE_MAX,
  CONFIDENCE_SCALE_MIN,
} from '@arsnova/shared-types';
import type {
  AnalyzeWordCloudInput,
  AnalyzeWordCloudOutput,
  ConfidenceResultDTO,
  ConfidenceQuestionSummaryDTO,
  HostCurrentQuestionDTO,
  HostVoteProgressDTO,
  LeaderboardEntryDTO,
  NicknameTheme,
  NumericRoundComparisonDTO,
  NumericStatsDTO,
  QaQuestionDTO,
  QaQuestionSortMode,
  QuickFeedbackResult,
  SessionChannelsDTO,
  SessionFeedbackSummary,
  SessionConfidenceSummaryDTO,
  SessionInfoDTO,
  SessionParticipantsPayload,
  TeamAssignment,
  SessionStatusUpdate,
  TeamDTO,
  TeamLeaderboardEntryDTO,
  WordCloudAnalysisLocale,
  WordCloudAnalysisVariant,
} from '@arsnova/shared-types';
import { WordCloudComponent } from '../session-present/word-cloud.component';
import {
  getWordCloudWeightFromNormalizedMetric,
  getWordCloudWeightFromUpvotes,
} from '../session-present/word-cloud.util';
import {
  WordCloudTermExtractorService,
  type WordCloudTerm,
  type WordCloudTermDocument,
} from '../session-present/word-cloud-term.service';
import { CountdownFingersComponent } from '../../../shared/countdown-fingers/countdown-fingers.component';
import { MarkdownImageLightboxDirective } from '../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { questionTypeLabel } from '../../../shared/question-type-label';
import { remainingCountdownSeconds } from '../session-countdown.util';
import { recordServerTimeIso, recordServerTimeSample } from '../session-server-clock';
import { MusicEqualizerIconComponent } from '../../../shared/music-equalizer-icon/music-equalizer-icon.component';
import { FeedbackHostComponent } from '../../feedback/feedback-host.component';
import { tempoTrendEmoji, tempoTrendLabel } from '../../feedback/feedback.config';
import { QuizStoreService } from '../../quiz/data/quiz-store.service';
import {
  buildQaQuestionsCsvFilename,
  buildSessionResultsCsvFilename,
} from '../../../core/export-filename.util';
import { stripMarkdownToPlainText } from '../../../core/markdown-plain-text.util';
import {
  printSessionResultsReport,
  openSessionResultsReportPreview,
} from '../../../core/session-results-report-print.util';
import { getSessionResultsReportLabels } from '../../../core/session-results-report-labels';
import { buildSessionResultsReportHtml } from '../../../core/session-results-report.util';
import { inlineExportImagesInHtml } from '@arsnova/session-export-report';
import {
  replaceEmojiShortcodes,
  edgeEmojiMarkerPosition,
  extractEdgeEmoji,
  stripEdgeEmojiMarker,
} from '../../../shared/emoji-shortcode.util';
import {
  findKindergartenNicknameBadgeLabel,
  findKindergartenNicknameEmoji,
} from '../../join/kindergarten-nickname-icons';
import {
  SessionQuizPickerDialogComponent,
  type SessionQuizPickerDialogData,
} from '../session-quiz-picker-dialog.component';
import {
  FoyerEntranceLayerComponent,
  type FoyerEntranceChip,
} from './foyer-entrance-layer.component';
import { buildFoyerChipLabel } from './foyer-chip-label.util';

type NumericStatsDisplayItem = {
  id: string;
  label: string;
  value: string;
  caption: string | null;
};

const HOST_AUX_POLL_MS = 3000;
const HOST_CLOCK_POLL_MS = 15000;
const HOST_REALTIME_RESUBSCRIBE_MS = 5000;
const QA_WORD_CLOUD_ANALYSIS_DEBOUNCE_MS = 180;
const FOYER_MAX_ACTIVE_CHIPS = 6;
const FOYER_CHIP_LIFETIME_MS = 1100;
const FOYER_CHIP_DEV_LIFETIME_MS = 3500;
const FOYER_LANE_COUNT = 3;
const FOYER_TEAM_DELAY_STEP_MS = 720;
const FOYER_TEAM_PRESENTATION_BUFFER_MS = 440;
const FOYER_NON_TEAM_DELAY_STEP_MS = 920;
const QA_WORD_CLOUD_NORMALIZED_WEIGHT_CAP = 28;
const HOST_QUESTION_DETAILS_RETRY_MS = 250;
const HOST_QUESTION_DETAILS_RETRY_LIMIT = 8;
const FOYER_NON_TEAM_PRESENTATION_BUFFER_MS = 240;
const FOYER_KINDERGARTEN_DELAY_STEP_MS = 5400;
const TEAM_FOYER_SUPPRESSION_PARTICIPANT_THRESHOLD = 100;
const TEAM_FOYER_SUPPRESSION_BURST_THRESHOLD = 24;
const SESSION_NOT_FOUND_MESSAGE = 'Session nicht gefunden.';

type FoyerArrivalMotionProfile = {
  stepMs: number;
  enterDurationMs: number;
  presenceMs: number;
  settleDelayMs: number;
  badgeDelayMs: number;
  badgePresenceMs: number;
  pulseDelayMs: number;
};
type FreetextWordCloudMode = 'WORDS' | 'PHRASES';
type SessionChannelTab = 'quiz' | 'qa' | 'quickFeedback';
type SessionChannelTempoTone = 'neutral' | 'good' | 'caution' | 'alert';
type SessionChannelTempoIndicator = {
  tone: SessionChannelTempoTone;
  label: string;
  icon: string;
  compound: boolean;
};
type SessionOnboardingProfile = {
  nicknameTheme: NicknameTheme;
  allowCustomNicknames: boolean;
  anonymousMode: boolean;
  teamMode: boolean;
  teamCount: number | null;
  teamAssignment: TeamAssignment;
  teamNames: string[];
};
type HostMusicTrack =
  | 'LOBBY_0'
  | 'LOBBY_1'
  | 'LOBBY_2'
  | 'LOBBY_3'
  | 'READING_0'
  | 'COUNTDOWN_0'
  | 'COUNTDOWN_1'
  | 'COUNTDOWN_2';

type MusicPhase = 'lobby' | 'reading' | 'countdown';

const PHASE_TRACK_DEFAULTS: Record<MusicPhase, HostMusicTrack> = {
  lobby: 'LOBBY_2',
  reading: 'READING_0',
  countdown: 'COUNTDOWN_0',
};

const MUSIC_PHASE_STORAGE_KEY = 'arsnova-host-phase-tracks';

const LEGACY_HOST_MUSIC_TRACKS: Record<string, HostMusicTrack> = {
  CONNECTING_0: 'READING_0',
  COUNTDOWN_RUNNING_0: 'COUNTDOWN_0',
  COUNTDOWN_RUNNING_1: 'COUNTDOWN_1',
  COUNTDOWN_RUNNING_2: 'COUNTDOWN_2',
};

function normalizeStoredHostMusicTrack(value: unknown): HostMusicTrack | null {
  if (typeof value !== 'string') {
    return null;
  }

  const migrated = LEGACY_HOST_MUSIC_TRACKS[value] ?? value;
  return isValidTrack(migrated) ? migrated : null;
}

function loadPhaseTracksFromStorage(): Record<MusicPhase, HostMusicTrack> {
  try {
    const raw =
      globalThis.localStorage === undefined
        ? null
        : globalThis.localStorage.getItem(MUSIC_PHASE_STORAGE_KEY);
    if (!raw) return { ...PHASE_TRACK_DEFAULTS };
    const parsed = JSON.parse(raw) as Record<string, string>;
    return {
      lobby: normalizeStoredHostMusicTrack(parsed['lobby']) ?? PHASE_TRACK_DEFAULTS.lobby,
      reading:
        normalizeStoredHostMusicTrack(parsed['reading'] ?? parsed['connecting']) ??
        PHASE_TRACK_DEFAULTS.reading,
      countdown:
        normalizeStoredHostMusicTrack(parsed['countdown'] ?? parsed['running']) ??
        PHASE_TRACK_DEFAULTS.countdown,
    };
  } catch {
    return { ...PHASE_TRACK_DEFAULTS };
  }
}

function isValidTrack(v: unknown): v is HostMusicTrack {
  return typeof v === 'string' && ALL_MUSIC_TRACK_VALUES.has(v as HostMusicTrack);
}

function isScoredQuestionType(type: HostCurrentQuestionDTO['type'] | null | undefined): boolean {
  return (
    type === 'SINGLE_CHOICE' ||
    type === 'MULTIPLE_CHOICE' ||
    type === 'SHORT_TEXT' ||
    type === 'NUMERIC_ESTIMATE'
  );
}

function sameStringArray(
  left: readonly string[] | null | undefined,
  right: readonly string[] | null | undefined,
): boolean {
  const a = left ?? [];
  const b = right ?? [];
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function sameNumberRecord(
  left: Record<string, number> | null | undefined,
  right: Record<string, number> | null | undefined,
): boolean {
  const a = left ?? {};
  const b = right ?? {};
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

const ALL_MUSIC_TRACKS: ReadonlyArray<{ value: HostMusicTrack; label: string }> = [
  {
    value: 'LOBBY_0',
    label: $localize`:@@sessionHost.musicTrackLobbyWarm:Lobby · Warm`,
  },
  {
    value: 'LOBBY_1',
    label: $localize`:@@sessionHost.musicTrackLobbyArrival:Lobby · Ankommen`,
  },
  {
    value: 'LOBBY_2',
    label: $localize`:@@sessionHost.musicTrackLobbyCalm:Lobby · Ruhig`,
  },
  {
    value: 'LOBBY_3',
    label: $localize`:@@sessionHost.musicTrackLobbyPulse:Lobby · Puls`,
  },
  {
    value: 'READING_0',
    label: $localize`:@@sessionHost.musicTrackReadingBuild:Lesen · Aufbau`,
  },
  {
    value: 'COUNTDOWN_0',
    label: $localize`:@@sessionHost.musicTrackCountdownFocus:Countdown · Fokus`,
  },
  {
    value: 'COUNTDOWN_1',
    label: $localize`:@@sessionHost.musicTrackCountdownTempo:Countdown · Tempo`,
  },
  {
    value: 'COUNTDOWN_2',
    label: $localize`:@@sessionHost.musicTrackCountdownIntense:Countdown · Intensiv`,
  },
];
const ALL_MUSIC_TRACK_VALUES = new Set(ALL_MUSIC_TRACKS.map((t) => t.value));

type HostSteeringCalloutState = {
  title: string;
  body: string;
  retry: () => void;
};

function musicTracksForPhase(
  phase: MusicPhase,
): ReadonlyArray<{ value: HostMusicTrack; label: string }> {
  switch (phase) {
    case 'lobby':
      return ALL_MUSIC_TRACKS.filter((t) => t.value.startsWith('LOBBY_'));
    case 'reading':
      return ALL_MUSIC_TRACKS.filter((t) => t.value.startsWith('READING_'));
    case 'countdown':
      return ALL_MUSIC_TRACKS.filter((t) => t.value.startsWith('COUNTDOWN_'));
  }
}

/**
 * Host-Ansicht: Lobby + Präsentations-Steuerung (Epic 2).
 * Story 2.1a, 2.2, 2.3, 2.4, 4.2, 4.6, 4.7, 4.8, 7.1, 8.1, 8.4.
 */
@Component({
  selector: 'app-session-host',
  standalone: true,
  imports: [
    DecimalPipe,
    MatButton,
    MatIconButton,
    RouterLink,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatSlideToggle,
    MatTooltip,
    WordCloudComponent,
    CountdownFingersComponent,
    MusicEqualizerIconComponent,
    FeedbackHostComponent,
    MarkdownImageLightboxDirective,
    FoyerEntranceLayerComponent,
    AnswerOptionBadgeComponent,
  ],
  templateUrl: './session-host.component.html',
  styleUrls: ['../../../shared/styles/dialog-title-header.scss', './session-host.component.scss'],
})
export class SessionHostComponent implements OnInit, OnDestroy {
  readonly localizedPath = localizePath;
  session = signal<SessionInfoDTO | null>(null);
  readonly sessionUnavailable = signal(false);
  /** Lobby: Live-Teilnehmerliste (Story 2.2). */
  readonly participantsPayload = signal<SessionParticipantsPayload | null>(null);
  readonly foyerArrivalChips = signal<FoyerEntranceChip[]>([]);
  readonly hiddenFoyerParticipantIds = signal<Set<string>>(new Set());
  readonly foyerTeamDirections = signal<Record<string, 'left' | 'right'>>({});
  /** Live-Status für Steuerung (Story 2.3). */
  readonly statusUpdate = signal<SessionStatusUpdate | null>(null);
  readonly controlPending = signal(false);
  readonly quizStartQuestionPending = signal(false);
  readonly steppedBackToPreviousResult = signal(false);
  readonly skipCurrentResultQuestionOnNext = signal(false);
  /** Auffälliger Hinweis bei fehlgeschlagenen Host-Steuer-Mutationen (Netz/Server). */
  readonly hostSteeringCallout = signal<HostSteeringCalloutState | null>(null);
  readonly activeChannel = signal<SessionChannelTab>('quiz');
  readonly qaQuestions = signal<QaQuestionDTO[]>([]);
  readonly qaSelectedAuthorNickname = signal<string | null>(null);
  readonly qaInfo = signal<string | null>(null);
  readonly qaPendingQuestionIds = signal<Set<string>>(new Set());
  readonly qaSeenQuestionIds = signal<Set<string>>(new Set());
  readonly qaScrolledDown = signal(false);
  @ViewChild('hostQuestionCard') hostQuestionCardRef?: ElementRef<HTMLElement>;
  @ViewChild('hostResultsSection') hostResultsSectionRef?: ElementRef<HTMLElement>;
  @ViewChild('hostAnswersList') hostAnswersListRef?: ElementRef<HTMLElement>;
  @ViewChild('qaListContainer') qaListContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('qaTitleInput') qaTitleInputRef?: ElementRef<HTMLInputElement>;
  @ViewChildren('lobbyTeamCard') lobbyTeamCardRefs?: QueryList<ElementRef<HTMLElement>>;
  readonly qaHighlightedQuestionIds = signal<Set<string>>(new Set());
  readonly quickFeedbackResult = signal<QuickFeedbackResult | null>(null);
  readonly quickFeedbackSeenVoteCount = signal(0);
  readonly quickFeedbackActionPending = signal(false);
  private participantSub: Unsubscribable | null = null;
  private statusSub: Unsubscribable | null = null;
  private currentQuestionSub: Unsubscribable | null = null;
  private voteProgressSub: Unsubscribable | null = null;
  private qaSub: Unsubscribable | null = null;
  private qaSubscriptionKey: string | null = null;
  private hostRealtimeFallbackActive = false;
  private hostRealtimeFallbackRefreshInFlight = false;
  private hostRealtimeSubscriptionRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private currentQuestionRefreshRunId = 0;
  private hostVoteProgressRefreshRunId = 0;
  private participantBaselineReady = false;
  private knownParticipantIds = new Set<string>();
  private foyerArrivalSequence = 0;
  private foyerGlobalLaneCursor = 0;
  private hostQuestionDetailsRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private hostQuestionDetailsRetryCount = 0;
  private readonly foyerTeamLaneCursor = new Map<string, number>();
  private readonly foyerArrivalTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly foyerTeamPulseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly foyerTeamPulseClearTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly hiddenLobbyParticipantTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly landedTeamEchoTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly landedTeamEchoSequences = signal<Record<string, number>>({});
  readonly foyerTeamPulseSequences = signal<Record<string, number>>({});
  private readonly foyerChipLifetimeMs = isDevMode()
    ? FOYER_CHIP_DEV_LIFETIME_MS
    : FOYER_CHIP_LIFETIME_MS;
  private readonly document = inject(DOCUMENT);
  private unloadWarningEnabled = !this.isLocalDevSession();
  private readonly localeId = inject(LOCALE_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly themePreset = inject(ThemePresetService);
  readonly sound = inject(SoundService);
  private readonly hostDisplayMode = inject(HostDisplayModeService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly quizStore = inject(QuizStoreService);
  private readonly wordCloudTermExtractor = inject(WordCloudTermExtractorService);
  private auxPollTimer: ReturnType<typeof setInterval> | null = null;
  private clockPollTimer: ReturnType<typeof setInterval> | null = null;
  readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
  private readonly requestedInitialTab = this.route.snapshot?.queryParamMap?.get('tab') ?? null;
  /** Nach einmaligem Anwenden von `?tab=` nicht erneut erzwingen (sonst kein Kanalwechsel möglich). */
  private initialUrlTabApplied = false;
  readonly freetextResponses = signal<string[]>([]);
  readonly wordCloudExpanded = signal(false);
  readonly wordCloudInfo = signal($localize`Warte auf Live-Freitextdaten …`);
  readonly wordCloudFrozen = signal(false);
  readonly frozenWordCloudResponses = signal<string[] | null>(null);
  readonly freetextWordCloudEyebrow = $localize`:@@sessionWordCloud.freetextEyebrow:Live-Freitext`;
  readonly freetextWordCloudDescription = $localize`:@@sessionWordCloud.freetextDescription:Häufige Wörter aus den Antworten.`;
  readonly qaWordCloudEyebrow = $localize`:@@sessionWordCloud.qaEyebrow:Q&A-Analyse`;
  readonly qaWordCloudDescription = $localize`:@@sessionWordCloud.qaDescription:Zeigt, welche Wörter und Phrasen in den sichtbaren Q&A-Fragen dominieren.`;
  readonly qaWordCloudAnalysisVariant = signal<WordCloudAnalysisVariant>('THEME');
  readonly qaWordCloudDialogOpen = signal(false);
  readonly qaWordCloudFrozen = signal(false);
  readonly frozenQaWordCloudQuestions = signal<QaQuestionDTO[] | null>(null);
  readonly qaWordCloudThemeAnalysisPending = signal(false);
  readonly qaWordCloudThemeFallbackActive = signal(false);
  readonly qaWordCloudThemeAnalysisResult = signal<AnalyzeWordCloudOutput | null>(null);
  private qaWordCloudThemeAnalysisRunId = 0;
  private lastQaWordCloudAnalysisRequestKey: string | null = null;
  private qaWordCloudThemeAnalysisTimer: ReturnType<typeof setTimeout> | null = null;
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly exportStatus = signal<string | null>(null);
  readonly exportExporting = signal(false);
  readonly leaderboard = signal<LeaderboardEntryDTO[]>([]);
  readonly teamLeaderboard = signal<TeamLeaderboardEntryDTO[]>([]);
  readonly lobbyTeams = signal<TeamDTO[]>([]);
  readonly leaderboardLoading = signal(false);
  private readonly onVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.stopHostPolling();
      return;
    }
    this.ensureParticipantSubscription();
    this.ensureStatusSubscription();
    this.ensureCurrentQuestionSubscription();
    this.ensureVoteProgressSubscription();
    this.startHostPolling();
    this.runAuxiliaryPollCycle();
    if (this.hostRealtimeFallbackActive) {
      this.runRealtimeFallbackCycle();
    }
  };
  readonly feedbackSummary = signal<SessionFeedbackSummary | null>(null);
  readonly finishedConfidenceSummary = signal<SessionConfidenceSummaryDTO | null>(null);
  /** Aktuelle Frage für Host (Text + Antwortoptionen), null wenn keine Frage aktiv. */
  readonly currentQuestionForHost = signal<HostCurrentQuestionDTO | null>(null);
  readonly hostVoteProgress = signal<HostVoteProgressDTO | null>(null);
  readonly displayedCurrentQuestionForHost = computed(() => {
    const question = this.currentQuestionForHost();
    if (!question) return null;
    const currentQuestion = this.effectiveCurrentQuestionState();
    if (currentQuestion === undefined) return question;
    if (currentQuestion === null) return null;
    return currentQuestion === question.order ? question : null;
  });
  readonly hasCurrentQuizQuestionForHost = computed(() => {
    if (this.displayedCurrentQuestionForHost() !== null) return true;
    return typeof this.effectiveCurrentQuestionState() === 'number';
  });
  readonly isHostQuestionDetailsPending = computed(
    () => this.hasCurrentQuizQuestionForHost() && this.displayedCurrentQuestionForHost() === null,
  );
  readonly showLobbyStage = computed(
    () => this.effectiveStatus() === 'LOBBY' || this.quizStartQuestionPending(),
  );
  /** Emoji-Reaktionen der Teilnehmenden in der Ergebnis-Phase (Story 5.8). */
  readonly emojiReactions = signal<{ reactions: Record<string, number>; total: number } | null>(
    null,
  );
  readonly emojiNewCount = signal(0);
  readonly emojiBadgePulse = signal(false);
  private emojiPulseTimer: ReturnType<typeof setTimeout> | null = null;
  /** Frage + Abstimmungsrunde (Peer Instruction), damit Emoji-Badge bei Rundenwechsel zurücksetzt. */
  private lastEmojiReactionScope = '';
  /** Aktuelle Quiz-Abstimmungsrunde (1/2) für Emoji-Host-Panel. */
  readonly hostQuizVoteRound = computed(
    () => this.displayedCurrentQuestionForHost()?.currentRound ?? 1,
  );
  /** Countdown in Sekunden (null = kein Timer, Story 3.5). */
  readonly countdownSeconds = signal<number | null>(null);
  /** true, sobald der Countdown 0 erreicht hat (bis zum nächsten Start). */
  readonly countdownEnded = signal(false);
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private fingerHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private countdownIntroSoundPlayed = false;
  private countdownFinalSoundPlayed = false;
  /** true ab 7 Sek. vor Countdown-Ende → Musik aus, nur SFX. */
  readonly countdownSfxPhase = signal(false);
  readonly channelActivationPending = signal<SessionChannelTab | null>(null);
  readonly channelVisibilityPending = signal<Extract<
    SessionChannelTab,
    'qa' | 'quickFeedback'
  > | null>(null);
  readonly Math = Math;
  /** ARIA für sichtbaren Session-Code (Lokalisation wie Blitzlicht-Teilnehmeransicht). */
  sessionCodeDisplayAria(code: string): string {
    return i18nSessionCodeAria(code);
  }

  /** Defektes externes Motivbild ausblenden (ohne Fehlerbehandlung im UI). */
  onHostQuizMotifError(event: Event): void {
    const el = event.target;
    if (el instanceof HTMLElement) {
      el.remove();
    }
  }
  readonly teamLeaderboardMaxScore = computed(() =>
    Math.max(1, ...this.teamLeaderboard().map((entry) => entry.totalScore)),
  );
  readonly teamLeaderboardTopScore = computed(() => {
    const board = this.teamLeaderboard();
    if (board.length === 0) return 0;
    return Math.max(...board.map((e) => e.totalScore));
  });
  readonly teamLeaderboardHasScoreTie = computed(() => {
    const seenScores = new Set<number>();
    return this.teamLeaderboard().some((entry) => {
      const score = entry.totalScore;
      if (score <= 0) {
        return false;
      }
      if (seenScores.has(score)) {
        return true;
      }
      seenScores.add(score);
      return false;
    });
  });
  readonly showsInterimLeaderboard = computed(() =>
    isScoredQuestionType(this.displayedCurrentQuestionForHost()?.type),
  );
  readonly visibleInterimLeaderboardHasScoreTie = computed(() => {
    const seenScores = new Set<number>();
    return this.leaderboard()
      .slice(0, 5)
      .some((entry) => {
        const score = entry.totalScore;
        if (score <= 0) {
          return false;
        }
        if (seenScores.has(score)) {
          return true;
        }
        seenScores.add(score);
        return false;
      });
  });
  readonly wordCloudToggleLabel = computed(() =>
    this.wordCloudExpanded()
      ? $localize`:@@sessionHost.wordCloudHide:Wortwolke ausblenden`
      : $localize`:@@sessionHost.wordCloudShow:Wortwolke anzeigen`,
  );
  readonly freetextWordCloudMode = signal<FreetextWordCloudMode>('PHRASES');
  readonly wordCloudFreezeLabel = computed(() =>
    this.wordCloudFrozen()
      ? $localize`:@@sessionHost.wordCloudResume:Live fortsetzen`
      : $localize`:@@sessionHost.wordCloudFreeze:Wortwolke einfrieren`,
  );
  readonly displayedFreetextResponses = computed(() =>
    this.wordCloudFrozen()
      ? (this.frozenWordCloudResponses() ?? this.freetextResponses())
      : this.freetextResponses(),
  );
  readonly wordCloudTermLocale = computed<SupportedLocale>(() =>
    getEffectiveLocale(localeIdToSupported(this.localeId)),
  );
  readonly displayedFreetextWordCloudTerms = computed<WordCloudTerm[]>(() =>
    this.wordCloudTermExtractor.extractTerms(
      this.displayedFreetextResponses().map((response, index) => ({
        id: `response-${index}`,
        body: response,
      })),
      {
        locale: this.wordCloudTermLocale(),
        maxEntries: 80,
        maxNgramLength: this.freetextWordCloudMode() === 'WORDS' ? 1 : 3,
      },
    ),
  );
  readonly displayedWordCloudInfo = computed(() =>
    this.wordCloudFrozen()
      ? $localize`:@@sessionHost.wordCloudFrozenInfo:Wortwolke eingefroren.`
      : this.wordCloudInfo(),
  );
  readonly teamScoreboardHasPoints = computed(() => this.teamLeaderboardTopScore() > 0);
  readonly channels = computed(() => {
    const session = this.session();
    const ch = session?.channels;
    if (ch) {
      return {
        quiz: ch.quiz.enabled,
        qa: ch.qa.enabled,
        quickFeedback: ch.quickFeedback.enabled,
      };
    }
    return {
      quiz: session?.type === 'QUIZ',
      qa: session?.type === 'Q_AND_A',
      quickFeedback: false,
    };
  });
  readonly channelOpenState = computed(() => {
    const session = this.session();
    const ch = session?.channels;
    if (ch) {
      return {
        quiz: true,
        qa: ch.qa.open,
        quickFeedback: ch.quickFeedback.open,
      };
    }
    return {
      quiz: true,
      qa: session?.type === 'Q_AND_A',
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
  readonly availableChannels = computed<SessionChannelTab[]>(() => {
    const session = this.session();
    if (!session) return [];
    return ['quiz', 'qa', 'quickFeedback'];
  });
  readonly showChannelTabs = computed(
    () => this.effectiveStatus() !== 'FINISHED' && this.availableChannels().length > 1,
  );
  readonly showPrimaryLiveView = computed(() => {
    const active = this.activeChannel();
    if (active === 'quiz') {
      return this.channels().quiz;
    }

    if (active === 'qa') {
      return this.isQaSession() && this.effectiveStatus() === 'LOBBY';
    }

    return false;
  });
  readonly isQaSession = computed(
    () => this.channels().quiz === false && this.channels().qa === true,
  );
  readonly isPlayfulPreset = computed(() => this.themePreset.preset() === 'spielerisch');
  readonly canShowFoyerEntrance = computed(() => {
    const session = this.session();
    return (
      !!session &&
      this.showPrimaryLiveView() &&
      this.effectiveStatus() === 'LOBBY' &&
      !this.quizStartQuestionPending() &&
      this.isPlayfulPreset() &&
      session.enableRewardEffects !== false
    );
  });
  readonly showFoyerEntranceLayer = computed(
    () => this.canShowFoyerEntrance() && this.session()?.teamMode !== true,
  );
  readonly suppressTeamFoyerEntrance = computed(() => {
    if (this.session()?.teamMode !== true) {
      return false;
    }
    return (
      (this.participantsPayload()?.participantCount ?? 0) >=
      TEAM_FOYER_SUPPRESSION_PARTICIPANT_THRESHOLD
    );
  });
  readonly showTeamFoyerEntranceLayers = computed(
    () =>
      this.canShowFoyerEntrance() &&
      this.session()?.teamMode === true &&
      !this.suppressTeamFoyerEntrance(),
  );
  readonly foyerArrivalChipsByTeam = computed(() => {
    const grouped = new Map<string, FoyerEntranceChip[]>();
    for (const chip of this.foyerArrivalChips()) {
      if (!chip.teamId) {
        continue;
      }
      const entries = grouped.get(chip.teamId) ?? [];
      entries.push(chip);
      grouped.set(chip.teamId, entries);
    }
    return grouped;
  });
  readonly hiddenLobbyParticipantIds = computed(() => {
    if (!this.showTeamFoyerEntranceLayers()) {
      return new Set<string>();
    }

    const hidden = new Set(this.hiddenFoyerParticipantIds());
    for (const chip of this.foyerArrivalChips()) {
      if (chip.participantId) {
        hidden.add(chip.participantId);
      }
      chip.hiddenParticipantIds?.forEach((participantId) => hidden.add(participantId));
    }
    return hidden;
  });
  readonly isRunningSession = computed(() => {
    const status = this.effectiveStatus();
    return this.session() !== null && status !== 'LOBBY' && status !== 'FINISHED';
  });
  readonly isQuizLobbyImmersive = computed(() => {
    if (this.session() === null) return false;
    if (this.effectiveStatus() !== 'LOBBY') return false;
    if (!this.channels().quiz || this.isQaSession()) return false;
    return this.activeChannel() === 'quiz';
  });
  readonly showHostViewControls = computed(
    () => this.isRunningSession() || this.isQuizLobbyImmersive(),
  );
  /**
   * Quiz-Kanal: ACTIVE (z. B. nach Fragerunden-Start), aber noch keine Quiz-Frage – kein Voting,
   * daher keine „Ergebnis zeigen“-Steuerung; erste Frage explizit starten.
   */
  readonly isQuizAwaitingFirstQuestion = computed(() => {
    if (this.isQaSession()) return false;
    if (!this.channels().quiz) return false;
    if (this.effectiveStatus() !== 'ACTIVE') return false;
    return !this.hasCurrentQuizQuestionForHost();
  });
  readonly canReplaceQuizBeforeStart = computed(() => {
    if (!this.channels().quiz) return false;
    if (this.effectiveStatus() !== 'LOBBY') return false;
    return this.displayedCurrentQuestionForHost() === null;
  });
  readonly isImmersiveMode = computed(() => this.hostDisplayMode.immersiveHostActive());
  readonly isFullscreenSupported = computed(() =>
    isDocumentFullscreenEnterAvailable(this.document),
  );
  readonly isFullscreenActive = signal(false);
  readonly musicPhases: ReadonlyArray<{ id: MusicPhase; label: string }> = [
    { id: 'lobby', label: $localize`:@@sessionHost.phaseLobbyShort:Lobby` },
    { id: 'reading', label: $localize`:@@sessionHost.phaseConnectingShort:Lesen` },
    { id: 'countdown', label: $localize`:@@sessionHost.phaseRunningShort:Countdown` },
  ];
  /** Im Musik-Menü: welche Phase bearbeitet wird (Tracks-Liste gefiltert). */
  readonly musicMenuEditPhase = signal<MusicPhase>('lobby');
  readonly musicMenuTracksForSelection = computed(() =>
    musicTracksForPhase(this.musicMenuEditPhase()),
  );
  readonly phaseTracks = signal<Record<MusicPhase, HostMusicTrack>>(loadPhaseTracksFromStorage());
  readonly musicMuted = signal(false);
  readonly currentMusicPhase = computed<MusicPhase | null>(() => {
    const status = this.effectiveStatus();
    if (status === 'LOBBY') return 'lobby';
    if (status === 'QUESTION_OPEN') return 'reading';
    if (status === 'ACTIVE') return 'countdown';
    return null;
  });
  readonly activeMusicTrack = computed<HostMusicTrack | null>(() => {
    if (this.musicMuted()) return null;
    if (this.activeChannel() === 'qa') return null;
    if (this.activeChannel() === 'quickFeedback' && this.quickFeedbackResult()?.locked) {
      return null;
    }
    const phase = this.currentMusicPhase();
    if (!phase) return null;
    if (phase === 'countdown' && (this.countdownSfxPhase() || this.countdownEnded())) {
      return null;
    }
    if (this.allHaveVoted()) return null;
    return this.phaseTracks()[phase];
  });
  readonly activeMusicLabel = computed(() => {
    const active = this.activeMusicTrack();
    if (!active) return $localize`:@@sessionHost.musicLabelOff:Musik aus`;
    return ALL_MUSIC_TRACKS.find((t) => t.value === active)?.label ?? active;
  });
  readonly isBackgroundMusicEnabled = computed(
    () => !this.musicMuted() && this.activeMusicTrack() !== null,
  );
  readonly sessionHeading = computed(() => {
    const session = this.session();
    if (!session) {
      return null;
    }

    if (this.isQaSession()) {
      return (
        session.channels?.qa.title?.trim() ||
        session.title?.trim() ||
        $localize`:@@sessionTabs.qaTitleDefault:Fragen zur Veranstaltung...`
      );
    }

    return session.quizName ?? null;
  });
  readonly qaHeading = computed(
    () =>
      this.session()?.channels?.qa.title ??
      this.session()?.title ??
      $localize`:@@sessionTabs.qaTitleDefault:Fragen zur Veranstaltung...`,
  );
  readonly qaTitleDraft = signal('');
  readonly qaTitleEditing = signal(false);
  readonly qaTitleSaving = signal(false);
  readonly qaTitleSaveDisabled = computed(() => {
    const server = (this.session()?.channels?.qa?.title ?? '').trim();
    const draft = this.qaTitleDraft().trim();
    return draft === server || this.qaTitleSaving();
  });
  readonly qaSortMode = signal<QaQuestionSortMode>('BEST');
  readonly qaShowPinnedOnly = signal(false);
  readonly qaForumQuestions = computed(() =>
    this.qaQuestions().filter((question) => question.status !== 'DELETED'),
  );
  readonly qaForumQuestionCount = computed(() => this.qaForumQuestions().length);
  readonly qaFilteredQuestions = computed(() => {
    const all = this.qaForumQuestions();
    return this.qaShowPinnedOnly() ? all.filter((q) => q.status === 'PINNED') : all;
  });
  readonly qaVisibleQuestions = computed(() => {
    const selectedNickname = this.qaSelectedAuthorNickname();
    const questions = this.qaFilteredQuestions();
    if (!selectedNickname) {
      return questions;
    }
    return questions.filter(
      (question) => this.qaQuestionAuthorNickname(question) === selectedNickname,
    );
  });
  readonly liveQaWordCloudQuestions = computed(() => {
    const visibleQuestions = this.qaQuestions().filter(
      (question) => question.status === 'PINNED' || question.status === 'ACTIVE',
    );
    return this.qaShowPinnedOnly()
      ? visibleQuestions.filter((question) => question.status === 'PINNED')
      : visibleQuestions;
  });
  readonly qaWordCloudQuestions = computed(() =>
    this.qaWordCloudFrozen()
      ? (this.frozenQaWordCloudQuestions() ?? this.liveQaWordCloudQuestions())
      : this.liveQaWordCloudQuestions(),
  );
  readonly qaWordCloudResponses = computed(() =>
    this.qaWordCloudQuestions().map((question) => question.text),
  );
  readonly qaWordCloudAnalysisLocale = computed<WordCloudAnalysisLocale | null>(() => {
    const locale = getEffectiveLocale(localeIdToSupported(this.localeId));
    return locale === 'de' || locale === 'en' ? locale : null;
  });
  readonly qaWordCloudTermLocale = computed<SupportedLocale>(() =>
    getEffectiveLocale(localeIdToSupported(this.localeId)),
  );
  readonly qaWordCloudThemeModeAvailable = computed(() => true);
  readonly qaWordCloudEffectiveAnalysisVariant = computed<WordCloudAnalysisVariant>(() => {
    return this.qaWordCloudAnalysisVariant();
  });
  readonly qaWordCloudMetricLabel = computed(() => {
    switch (this.qaSortMode()) {
      case 'BEST':
        return $localize`:@@sessionQa.wordCloudMetricBest:belastbare Zustimmung`;
      case 'CONTROVERSIAL':
        return $localize`:@@sessionQa.wordCloudMetricControversial:Kontroverse`;
      default:
        return $localize`:@@sessionQa.wordCloudMetricTop:positive Stimmen`;
    }
  });
  readonly qaWordCloudTitle = computed(() => $localize`:@@sessionQa.wordCloudTitle:Q&A-Wortwolke`);
  readonly qaWordCloudWeightingHint = computed(() => {
    switch (this.qaSortMode()) {
      case 'BEST':
        return $localize`:@@sessionQa.wordCloudHintBest:Große Wörter und Phrasen kommen aus Fragen mit viel Zustimmung und ausreichend Stimmen.`;
      case 'CONTROVERSIAL':
        return $localize`:@@sessionQa.wordCloudHintControversial:Große Wörter und Phrasen kommen aus Fragen mit gegensätzlichen Reaktionen. Darüberfahren zeigt die zugehörigen Fragen.`;
      default:
        return $localize`:@@sessionQa.wordCloudHintTop:Große Wörter und Phrasen kommen aus Fragen mit vielen positiven Stimmen.`;
    }
  });
  readonly qaWordCloudWeightedResponses = computed(() =>
    this.qaWordCloudQuestions().map((question) => ({
      text: question.text,
      weight: this.qaWordCloudQuestionWeight(question),
    })),
  );
  readonly qaWordCloudTermDocuments = computed<WordCloudTermDocument[]>(() =>
    this.qaWordCloudQuestions().map((question) => ({
      id: question.id,
      title: question.text,
      weight: this.qaWordCloudQuestionWeight(question),
    })),
  );
  readonly qaWordCloudTerms = computed<WordCloudTerm[]>(() =>
    this.wordCloudTermExtractor.extractTerms(this.qaWordCloudTermDocuments(), {
      locale: this.qaWordCloudTermLocale(),
      maxEntries: 80,
      maxNgramLength: this.qaWordCloudEffectiveAnalysisVariant() === 'THEME' ? 3 : 1,
    }),
  );
  readonly qaWordCloudAnalysisRequest = computed<AnalyzeWordCloudInput | null>(() =>
    this.buildQaWordCloudAnalysisRequest(),
  );
  readonly qaWordCloudAnalysisEntries = computed(() => {
    if (this.qaWordCloudEffectiveAnalysisVariant() !== 'THEME') {
      return null;
    }

    return this.qaWordCloudThemeAnalysisResult()?.entries ?? null;
  });
  readonly qaWordCloudThemeFallbackHint = computed(() => {
    if (this.qaWordCloudTerms().length > 0) {
      return null;
    }

    if (this.qaWordCloudEffectiveAnalysisVariant() !== 'THEME') {
      return null;
    }

    if (!this.qaWordCloudThemeAnalysisPending() && !this.qaWordCloudThemeFallbackActive()) {
      return null;
    }

    return $localize`:@@sessionQa.wordCloudThemeFallbackHint:Es werden Einzelwörter gezeigt, bis Wortgruppen und Phrasen belastbar sind.`;
  });
  readonly qaSortHint = computed(() => {
    switch (this.qaSortMode()) {
      case 'BEST':
        return $localize`:@@sessionQa.sortHintBest:Zeigt Fragen mit viel Zustimmung und genug Stimmen zuerst. Angeheftete Fragen sind markiert, aber nicht vorgezogen.`;
      case 'CONTROVERSIAL':
        return $localize`:@@sessionQa.sortHintControversial:Zeigt Fragen mit gemischter Reaktion zuerst. Angeheftete Fragen sind markiert, aber nicht vorgezogen.`;
      default:
        return $localize`:@@sessionQa.sortHintTop:Zeigt Fragen mit den meisten positiven Stimmen zuerst. Angeheftete Fragen sind markiert, aber nicht vorgezogen.`;
    }
  });
  readonly qaWordCloudOpenLabel = computed(
    () => $localize`:@@sessionQa.wordCloudShow:Wortwolke anzeigen`,
  );
  readonly qaWordCloudFreezeLabel = computed(() =>
    this.qaWordCloudFrozen()
      ? $localize`:@@sessionHost.wordCloudResume:Live fortsetzen`
      : $localize`:@@sessionHost.wordCloudFreeze:Wortwolke einfrieren`,
  );
  readonly qaWordCloudInfo = computed(() => {
    const count = this.qaWordCloudQuestions().length;
    const metric = this.qaWordCloudMetricLabel();
    if (count === 1) {
      return $localize`:@@sessionQa.wordCloudCountOneMetric:1 sichtbare Frage · Größe von Wörtern und Phrasen: ${metric}:metric:`;
    }
    return $localize`:@@sessionQa.wordCloudCountManyMetric:${count}:count: sichtbare Fragen · Größe von Wörtern und Phrasen: ${metric}:metric:`;
  });
  readonly qaPinnedCount = computed(
    () => this.qaForumQuestions().filter((q) => q.status === 'PINNED').length,
  );
  readonly qaPendingCount = computed(
    () => this.qaForumQuestions().filter((question) => question.status === 'PENDING').length,
  );
  readonly qaArchivedCount = computed(
    () => this.qaForumQuestions().filter((q) => q.status === 'ARCHIVED').length,
  );
  readonly qaDeletedCount = computed(
    () => this.qaQuestions().filter((q) => q.status === 'DELETED').length,
  );
  readonly openQaWordCloudDialog = async (): Promise<void> => {
    this.tryEnterWordCloudFullscreenFromUserGesture();
    this.qaWordCloudDialogOpen.set(true);
    const request = this.qaWordCloudAnalysisRequest();
    if (request) {
      this.queueQaWordCloudThemeAnalysis(request);
    }

    try {
      const { QaWordCloudDialogComponent } = await import('./qa-word-cloud-dialog.component');
      const dialogRef = this.dialog.open(QaWordCloudDialogComponent, {
        data: {
          responses: () => this.qaWordCloudResponses(),
          weightedResponses: () => this.qaWordCloudWeightedResponses(),
          terms: () => this.qaWordCloudTerms(),
          analysisEntries: () => this.qaWordCloudAnalysisEntries(),
          title: () => this.qaWordCloudTitle(),
          eyebrow: this.qaWordCloudEyebrow,
          description: this.qaWordCloudDescription,
          weightingHint: () => this.qaWordCloudWeightingHint(),
          tooltipMetricLabel: () => this.qaWordCloudMetricLabel(),
          analysisVariant: () => this.qaWordCloudEffectiveAnalysisVariant(),
          setAnalysisVariant: (variant: WordCloudAnalysisVariant) =>
            this.setQaWordCloudAnalysisVariant(variant),
          themeModeAvailable: () => this.qaWordCloudThemeModeAvailable(),
          themeFallbackHint: () => this.qaWordCloudThemeFallbackHint(),
          sortMode: () => this.qaSortMode(),
          setSortMode: (mode: QaQuestionSortMode) => this.setQaSortMode(mode),
          frozen: () => this.qaWordCloudFrozen(),
          freezeLabel: () => this.qaWordCloudFreezeLabel(),
          toggleFreeze: () => this.toggleQaWordCloudFreeze(),
          itemLabelSingular: 'Frage',
          itemLabelPlural: 'Fragen',
        },
        autoFocus: false,
        restoreFocus: true,
        enterAnimationDuration: 180,
        exitAnimationDuration: 140,
        width: '100vw',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        panelClass: 'word-cloud-dialog-panel',
        backdropClass: 'word-cloud-dialog-backdrop',
      });
      dialogRef.afterClosed().subscribe(() => {
        this.qaWordCloudDialogOpen.set(false);
        this.qaWordCloudFrozen.set(false);
        this.frozenQaWordCloudQuestions.set(null);
      });
    } catch (error) {
      this.qaWordCloudDialogOpen.set(false);
      this.qaWordCloudFrozen.set(false);
      this.frozenQaWordCloudQuestions.set(null);
      throw error;
    }
  };
  readonly qaShowNewBanner = computed(() => this.qaUnseenCount() > 0 && this.qaScrolledDown());
  readonly qaUnseenCount = computed(
    () =>
      this.qaQuestions().filter(
        (question) => question.status !== 'DELETED' && !this.qaSeenQuestionIds().has(question.id),
      ).length,
  );
  readonly quickFeedbackUnseenCount = computed(() => {
    const result = this.quickFeedbackResult();
    if (!result) {
      return 0;
    }
    return Math.max(0, result.totalVotes - this.quickFeedbackSeenVoteCount());
  });
  readonly lobbyTeamsWithParticipants = computed(() => {
    const teams = this.lobbyTeams();
    const participants = this.participantsPayload()?.participants ?? [];
    const showNames = this.session()?.anonymousMode !== true;
    const hiddenParticipantIds = this.hiddenLobbyParticipantIds();
    const participantMap = new Map<string, Array<{ id: string; nickname: string }>>();
    const teamMemberCounts = new Map<string, number>();

    for (const participant of participants) {
      if (!participant.teamId || !participant.nickname) {
        continue;
      }
      teamMemberCounts.set(participant.teamId, (teamMemberCounts.get(participant.teamId) ?? 0) + 1);
      const names = participantMap.get(participant.teamId) ?? [];
      if (showNames && !hiddenParticipantIds.has(participant.id)) {
        names.unshift({ id: participant.id, nickname: participant.nickname });
      }
      participantMap.set(participant.teamId, names);
    }

    return teams.map((team) => ({
      ...team,
      memberCount: teamMemberCounts.get(team.id) ?? 0,
      participants: participantMap.get(team.id) ?? [],
    }));
  });
  readonly lobbyParticipantsNewestFirst = computed(() => {
    const participants = this.participantsPayload()?.participants ?? [];
    return [...participants].reverse();
  });

  /** Reihenfolge der Emojis für die Reaktions-Anzeige (Story 5.8). */
  readonly emojiOrder: readonly string[] = ['👏', '🎉', '😮', '😂', '😢'];

  showFingerCountdown(): boolean {
    const s = this.countdownSeconds();
    return (
      this.effectiveStatus() === 'ACTIVE' &&
      s !== null &&
      s >= 0 &&
      s <= 5 &&
      this.themePreset.preset() === 'spielerisch'
    );
  }

  /** Stimmenzahl der aktuellen Frage (für Vergleich mit Teilnehmerzahl). */
  private getVoteCountForCurrentQuestion(q: HostCurrentQuestionDTO | null): number {
    if (!q) return 0;
    const progress = this.hostVoteProgress();
    if (this.hostVoteProgressMatchesQuestion(progress, q)) {
      return progress.totalVotes;
    }
    if (q.type === 'RATING') return q.ratingCount ?? 0;
    if (q.type === 'FREETEXT') return q.freeTextResponses?.length ?? 0;
    return q.totalVotes ?? 0;
  }

  hostVoteCount(q: HostCurrentQuestionDTO | null): number {
    return this.getVoteCountForCurrentQuestion(q);
  }

  private hostVoteProgressMatchesQuestion(
    progress: HostVoteProgressDTO | null,
    q: HostCurrentQuestionDTO | null,
  ): progress is HostVoteProgressDTO {
    return (
      progress !== null &&
      q !== null &&
      progress.questionId === q.questionId &&
      progress.questionOrder === q.order &&
      progress.round === (q.currentRound ?? 1) &&
      this.effectiveStatus() === 'ACTIVE'
    );
  }

  private hostPeerInstructionSuggestion(q: HostCurrentQuestionDTO | null) {
    const progress = this.hostVoteProgress();
    if (this.hostVoteProgressMatchesQuestion(progress, q)) {
      return progress.peerInstructionSuggestion ?? null;
    }
    return q?.peerInstructionSuggestion ?? null;
  }

  readonly liveVoteProgress = computed(() => {
    if (this.effectiveStatus() !== 'ACTIVE' || this.isQaSession()) {
      return null;
    }
    const question = this.displayedCurrentQuestionForHost();
    const participants = this.participantsPayload()?.participantCount ?? 0;
    if (!question || participants <= 0) {
      return null;
    }
    const votes = Math.min(this.getVoteCountForCurrentQuestion(question), participants);
    const percentage = Math.max(0, Math.min(100, Math.round((votes / participants) * 100)));
    return {
      votes,
      participants,
      percentage,
      complete: votes >= participants,
    };
  });

  readonly allHaveVoted = computed(() => {
    if (this.effectiveStatus() !== 'ACTIVE') return false;
    const participants = this.participantsPayload()?.participantCount ?? 0;
    if (participants <= 0) return false;
    const votes = this.getVoteCountForCurrentQuestion(this.displayedCurrentQuestionForHost());
    return votes >= participants;
  });
  readonly readingReadyStatus = computed(() => this.participantsPayload()?.readingReady ?? null);
  readonly allConnectedParticipantsReady = computed(
    () =>
      this.effectiveStatus() === 'QUESTION_OPEN' &&
      this.readingReadyStatus()?.allConnectedReady === true,
  );

  shouldShowPeerInstructionSuggestion(q: HostCurrentQuestionDTO | null): boolean {
    return (
      this.effectiveStatus() === 'ACTIVE' &&
      q?.currentRound === 1 &&
      this.hostPeerInstructionSuggestion(q)?.suggested === true &&
      (this.allHaveVoted() || this.countdownEnded())
    );
  }

  private previousStatus: string | null = null;
  private previousReadingReadyQuestionId: string | null = null;
  private previousAllConnectedParticipantsReady = false;
  private priorLobbyForAutoJoinMenu = false;
  private priorQrReadyForJoinMenu = false;
  /** Verhindert geplantes Öffnen des Join-Menüs nach ngOnDestroy (z. B. Vitest). */
  private suppressJoinMenuAutopen = false;
  /** Beitritts-Dialog (QR): volles Viewport-Overlay, mittig (Smartphone-Scanner). */
  readonly joinInfoPopoverOpen = signal(false);
  private readonly markdownCache = new Map<string, SafeHtml>();

  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      this.ensureActiveChannel();
    });
    effect(() => {
      const sessionId = this.session()?.id ?? null;
      const qaEnabled = this.channels().qa;
      const qaSortMode = this.qaSortMode();
      void sessionId;
      void qaEnabled;
      void qaSortMode;
      untracked(() => this.ensureQaSubscription());
    });
    effect(() => {
      const request = this.qaWordCloudAnalysisRequest();
      if (!request) {
        this.clearQaWordCloudThemeAnalysisTimer();
        this.lastQaWordCloudAnalysisRequestKey = null;
        this.qaWordCloudThemeAnalysisResult.set(null);
        this.qaWordCloudThemeAnalysisPending.set(false);
        this.qaWordCloudThemeFallbackActive.set(false);
        return;
      }

      untracked(() => {
        this.queueQaWordCloudThemeAnalysis(request);
      });
    });
    effect(() => {
      const teamMode = this.showTeamFoyerEntranceLayers();
      const teamIds = this.lobbyTeams()
        .map((team) => team.id)
        .join('|');

      if (!teamMode || teamIds.length === 0) {
        this.foyerTeamDirections.set({});
        return;
      }

      afterNextRender(
        () => {
          this.recalculateTeamFoyerDirections();
        },
        { injector: this.injector },
      );
    });
    effect(() => {
      const allVoted = this.allHaveVoted();
      if (allVoted) {
        this.stopCountdown();
        this.countdownSeconds.set(null);
        this.sound.stopAllSfx();
      }
      untracked(() => this.syncMusic());
    });
    effect(() => {
      const track = this.activeMusicTrack();
      void track;
      untracked(() => this.syncMusic());
    });
    effect(() => {
      if (this.activeChannel() !== 'qa') {
        if (this.qaHighlightedQuestionIds().size > 0) {
          this.qaHighlightedQuestionIds.set(new Set());
        }
        return;
      }

      const nextSeen = new Set(this.qaSeenQuestionIds());
      const visibleQuestionIds = new Set(
        this.qaQuestions()
          .filter((question) => question.status !== 'DELETED')
          .map((question) => question.id),
      );
      const nextHighlighted = new Set(
        [...this.qaHighlightedQuestionIds()].filter((questionId) =>
          visibleQuestionIds.has(questionId),
        ),
      );
      let changed = false;
      for (const question of this.qaQuestions()) {
        if (question.status === 'DELETED') {
          continue;
        }
        if (!nextSeen.has(question.id)) {
          nextSeen.add(question.id);
          nextHighlighted.add(question.id);
          changed = true;
        }
      }
      if (changed || !this.setsEqual(this.qaHighlightedQuestionIds(), nextHighlighted)) {
        this.qaHighlightedQuestionIds.set(nextHighlighted);
      }
      if (changed) {
        this.qaSeenQuestionIds.set(nextSeen);
      }
    });
    effect(() => {
      const selectedNickname = this.qaSelectedAuthorNickname();
      if (!selectedNickname) {
        return;
      }
      const hasMatchingQuestion = this.qaQuestions().some(
        (question) => this.qaQuestionAuthorNickname(question) === selectedNickname,
      );
      if (!hasMatchingQuestion) {
        untracked(() => this.clearQaAuthorSelection());
      }
    });
    effect(() => {
      const result = this.quickFeedbackResult();
      if (!result) {
        this.quickFeedbackSeenVoteCount.set(0);
        return;
      }

      if (this.activeChannel() === 'quickFeedback') {
        this.quickFeedbackSeenVoteCount.set(result.totalVotes);
        return;
      }

      if (result.totalVotes < this.quickFeedbackSeenVoteCount()) {
        this.quickFeedbackSeenVoteCount.set(result.totalVotes);
      }
    });
    effect(() => {
      const status = this.effectiveStatus();
      if (status === 'FINISHED' || status === 'RESULTS') {
        void this.loadLeaderboard();
      }
    });
    effect(() => {
      if (this.effectiveStatus() === 'FINISHED') {
        void this.loadFinishedConfidenceSummary();
      }
    });
    effect(() => {
      this.hostDisplayMode.setHostSessionActive(
        this.isRunningSession() || this.isQuizLobbyImmersive(),
      );
    });
    effect(() => {
      this.musicMuted.set(this.themePreset.preset() === 'serious');
      untracked(() => this.syncMusic());
    });
    // Story 5.1: Sound-Effekte bei Status-Wechsel
    effect(() => {
      const status = this.effectiveStatus();
      const prev = this.previousStatus;
      this.previousStatus = status;
      if (!status || status === prev) return;
      const settings = this.session();
      if (!settings?.enableSoundEffects) return;
      this.sound.unlock();
      if (status === 'ACTIVE' && prev !== 'ACTIVE') {
        this.sound.stopAllSfx();
      } else if (status === 'FINISHED') {
        this.sound.stopAllSfx();
      } else if (status === 'RESULTS' || status === 'QUESTION_OPEN') {
        this.sound.stopAllSfx();
      }
    });
    /** Beitritts-Menü in der Lobby einmal automatisch öffnen (nach Render, wenn Trigger existiert). */
    effect(() => {
      const su = this.statusUpdate();
      const s = this.session();
      const status = su?.status ?? s?.status ?? null;
      const inLobby = status === 'LOBBY';
      const qr = this.qrDataUrl();
      const hasQr = qr.length > 0;

      const enteredLobby = inLobby && !this.priorLobbyForAutoJoinMenu;
      const qrBecameReady = inLobby && hasQr && !this.priorQrReadyForJoinMenu;

      if (enteredLobby || qrBecameReady) {
        afterNextRender(
          () => {
            if (this.suppressJoinMenuAutopen || this.effectiveStatus() !== 'LOBBY') return;
            queueMicrotask(() => {
              if (this.suppressJoinMenuAutopen) return;
              try {
                this.joinInfoPopoverOpen.set(true);
              } catch {
                /* Overlay/View ggf. schon zerstört (Tests, schnelle Navigation) */
              }
            });
          },
          { injector: this.injector },
        );
      }

      this.priorLobbyForAutoJoinMenu = inLobby;
      this.priorQrReadyForJoinMenu = hasQr;
    });
    effect(() => {
      if (this.effectiveStatus() === 'FINISHED') {
        this.joinInfoPopoverOpen.set(false);
      }
    });
    effect(() => {
      const questionId = this.displayedCurrentQuestionForHost()?.questionId ?? null;
      const allReady = this.allConnectedParticipantsReady();

      if (questionId !== this.previousReadingReadyQuestionId) {
        this.previousReadingReadyQuestionId = questionId;
        this.previousAllConnectedParticipantsReady = false;
      }

      const shouldScroll =
        questionId !== null &&
        this.effectiveStatus() === 'QUESTION_OPEN' &&
        allReady &&
        !this.previousAllConnectedParticipantsReady;

      this.previousAllConnectedParticipantsReady = allReady;

      if (!shouldScroll) {
        return;
      }

      untracked(() => this.scrollHostTargetIntoView(this.hostQuestionCardRef));
    });
    /** Nach Session-Ende automatisch Vollbild beenden (z. B. nach „Veranstaltung starten“). */
    effect(() => {
      if (this.effectiveStatus() !== 'FINISHED') {
        return;
      }
      tryExitDocumentFullscreen(this.document, () => {
        this.isFullscreenActive.set(this.getFullscreenElement() !== null);
      });
    });
  }

  getColor(index: number): string {
    return answerOptionColor(index);
  }
  getShape(
    index: number,
    questionType?: HostCurrentQuestionDTO['type'] | null,
    showTypeIndicator?: boolean | null,
  ): string {
    return answerOptionShape(index, questionType, showTypeIndicator);
  }
  showQuestionTypeIndicators(q: HostCurrentQuestionDTO | null | undefined): boolean {
    return showQuestionTypeIndicator(q?.showQuestionTypeIndicators);
  }
  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  responseCountLabel(count: number): string {
    return count === 1
      ? $localize`:@@sessionHost.responseCountOne:1 Antwort`
      : $localize`:@@sessionHost.responseCountMany:${count}:count: Antworten`;
  }

  async toggleWordCloudFreeze(): Promise<void> {
    if (this.wordCloudFrozen()) {
      this.wordCloudFrozen.set(false);
      this.frozenWordCloudResponses.set(null);
      await this.refreshLiveFreetext();
      return;
    }

    this.frozenWordCloudResponses.set([...this.freetextResponses()]);
    this.wordCloudFrozen.set(true);
  }

  setFreetextWordCloudMode(mode: FreetextWordCloudMode): void {
    if (mode === this.freetextWordCloudMode()) {
      return;
    }

    this.freetextWordCloudMode.set(mode);
  }

  readonly openFreetextWordCloudDialog = async (): Promise<void> => {
    this.tryEnterWordCloudFullscreenFromUserGesture();

    const { FreetextWordCloudDialogComponent } =
      await import('./freetext-word-cloud-dialog.component');
    this.dialog.open(FreetextWordCloudDialogComponent, {
      data: {
        responses: () => this.displayedFreetextResponses(),
        terms: () => this.displayedFreetextWordCloudTerms(),
        selectionScopeKey: () => this.displayedCurrentQuestionForHost()?.questionId ?? null,
        eyebrow: this.freetextWordCloudEyebrow,
        description: this.freetextWordCloudDescription,
        analysisVariant: () => this.freetextWordCloudMode(),
        setAnalysisVariant: (variant: FreetextWordCloudMode) =>
          this.setFreetextWordCloudMode(variant),
        frozen: () => this.wordCloudFrozen(),
        freezeLabel: () => this.wordCloudFreezeLabel(),
        toggleFreeze: () => this.toggleWordCloudFreeze(),
      },
      autoFocus: false,
      restoreFocus: true,
      enterAnimationDuration: 180,
      exitAnimationDuration: 140,
      width: '100vw',
      maxWidth: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      panelClass: 'word-cloud-dialog-panel',
      backdropClass: 'word-cloud-dialog-backdrop',
    });
  };

  ratingBarRange(q: HostCurrentQuestionDTO): number[] {
    const min = q.ratingMin ?? 1;
    const max = q.ratingMax ?? 5;
    const range: number[] = [];
    for (let i = min; i <= max; i++) range.push(i);
    return range;
  }

  confidenceBarRange(): number[] {
    const range: number[] = [];
    for (let value = CONFIDENCE_SCALE_MIN; value <= CONFIDENCE_SCALE_MAX; value += 1) {
      range.push(value);
    }
    return range;
  }

  confidenceDistributionTotal(result: ConfidenceResultDTO): number {
    return Object.values(result.distribution).reduce((sum, count) => sum + count, 0);
  }

  confidenceDistributionPercent(result: ConfidenceResultDTO, step: number): number {
    const total = this.confidenceDistributionTotal(result);
    if (total <= 0) {
      return 0;
    }
    const key = String(step) as keyof ConfidenceResultDTO['distribution'];
    return Math.round((result.distribution[key] / total) * 100);
  }

  confidenceDistributionCount(result: ConfidenceResultDTO, step: number): number {
    const key = String(step) as keyof ConfidenceResultDTO['distribution'];
    return result.distribution[key];
  }

  confidenceTierLowHeading(q: HostCurrentQuestionDTO): string {
    return q.confidenceLabelLow
      ? $localize`:@@sessionHost.confidenceTierLowWithLabel:Niedrig · ${q.confidenceLabelLow}:label:`
      : $localize`:@@sessionHost.confidenceTierLow:Niedrig (1–2)`;
  }

  confidenceTierMidHeading(): string {
    return $localize`:@@sessionHost.confidenceTierMid:Mitte (3)`;
  }

  confidenceCrossTabTierOrder(): Array<'low' | 'mid' | 'high'> {
    return ['low', 'mid', 'high'];
  }

  confidenceCrossTabTierHeading(tier: 'low' | 'mid' | 'high', q: HostCurrentQuestionDTO): string {
    if (tier === 'low') {
      return this.confidenceTierLowHeading(q);
    }
    if (tier === 'mid') {
      return this.confidenceTierMidHeading();
    }
    return this.confidenceTierHighHeading(q);
  }

  confidenceCrossTabTierCount(
    row: { low: number; mid: number; high: number },
    tier: 'low' | 'mid' | 'high',
  ): number {
    if (tier === 'low') {
      return row.low;
    }
    if (tier === 'mid') {
      return row.mid;
    }
    return row.high;
  }

  confidenceTierHighHeading(q: HostCurrentQuestionDTO): string {
    return q.confidenceLabelHigh
      ? $localize`:@@sessionHost.confidenceTierHighWithLabel:Hoch · ${q.confidenceLabelHigh}:label:`
      : $localize`:@@sessionHost.confidenceTierHigh:Hoch (4–5)`;
  }

  confidenceCrossTabRows(result: ConfidenceResultDTO): Array<{
    correctness: 'correct' | 'incorrect';
    label: string;
    low: number;
    mid: number;
    high: number;
  }> {
    const crossTab = result.crossTab;
    return [
      {
        correctness: 'correct',
        label: $localize`:@@sessionHost.confidenceCrossTabCorrect:Richtig`,
        low: crossTab.correctLow,
        mid: crossTab.correctMid,
        high: crossTab.correctHigh,
      },
      {
        correctness: 'incorrect',
        label: $localize`:@@sessionHost.confidenceCrossTabIncorrect:Falsch`,
        low: crossTab.incorrectLow,
        mid: crossTab.incorrectMid,
        high: crossTab.incorrectHigh,
      },
    ];
  }

  confidenceCrossTabTotal(result: ConfidenceResultDTO): number {
    const crossTab = result.crossTab;
    return (
      crossTab.correctLow +
      crossTab.correctMid +
      crossTab.correctHigh +
      crossTab.incorrectLow +
      crossTab.incorrectMid +
      crossTab.incorrectHigh
    );
  }

  finishedConfidencePercent(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  finishedConfidenceIncorrectCount(question: ConfidenceQuestionSummaryDTO): number {
    const crossTab = question.result.crossTab;
    return crossTab.incorrectHigh + crossTab.incorrectMid + crossTab.incorrectLow;
  }

  finishedConfidenceTopWrongOption(question: ConfidenceQuestionSummaryDTO): string | null {
    return question.result.highConfidenceWrongOptions?.[0]?.text ?? null;
  }

  confidenceCrossTabCellIntensity(count: number, total: number): 0 | 1 | 2 | 3 {
    if (count <= 0 || total <= 0) {
      return 0;
    }
    const share = count / total;
    if (share >= 0.34) {
      return 3;
    }
    if (share >= 0.14) {
      return 2;
    }
    return 1;
  }

  confidenceCrossTabCellTone(
    correctness: 'correct' | 'incorrect',
    tier: 'low' | 'mid' | 'high',
  ): 'neutral' | 'success' | 'caution' | 'risk' {
    if (correctness === 'incorrect' && tier === 'high') {
      return 'risk';
    }
    if (correctness === 'incorrect') {
      return 'caution';
    }
    if (correctness === 'correct' && tier === 'high') {
      return 'success';
    }
    return 'neutral';
  }

  confidenceCrossTabCellHeatClass(
    count: number,
    result: ConfidenceResultDTO,
    correctness: 'correct' | 'incorrect',
    tier: 'low' | 'mid' | 'high',
  ): string {
    const total = this.confidenceCrossTabTotal(result);
    const intensity = this.confidenceCrossTabCellIntensity(count, total);
    const tone = this.confidenceCrossTabCellTone(correctness, tier);
    const classes = ['session-host__confidence-crosstab-cell'];
    if (intensity > 0) {
      classes.push(`session-host__confidence-crosstab-cell--heat-${tone}`);
      classes.push(`session-host__confidence-crosstab-cell--heat-${tone}-${intensity}`);
    } else {
      classes.push('session-host__confidence-crosstab-cell--empty');
    }
    if (correctness === 'incorrect' && tier === 'high' && count > 0) {
      classes.push('session-host__confidence-crosstab-cell--heat-focus');
    }
    return classes.join(' ');
  }

  confidenceCrossTabCellAriaLabel(rowLabel: string, tierLabel: string, count: number): string {
    return $localize`:@@sessionHost.confidenceCrossTabCellAria:${rowLabel}:row: · ${tierLabel}:tier: · ${count}:count:`;
  }

  confidenceMisconceptionLabel(count: number): string {
    return count === 1
      ? $localize`:@@sessionHost.confidenceMisconceptionSingular:1 selbstsicher falsche Antwort – mögliches Fehlkonzept`
      : $localize`:@@sessionHost.confidenceMisconceptionPlural:${count}:count: selbstsicher falsche Antworten – mögliche Fehlkonzepte`;
  }

  private confidenceExportDetails(result: ConfidenceResultDTO): string {
    const distribution = this.confidenceBarRange()
      .map((step) => {
        const key = String(step) as keyof ConfidenceResultDTO['distribution'];
        return `${step}:${result.distribution[key]}`;
      })
      .join(' ');
    const crossTab = result.crossTab;
    const cross = $localize`:@@sessionHost.exportConfidenceCrossTab:Kreuz richtig/hoch ${crossTab.correctHigh}:correctHigh: · falsch/hoch ${crossTab.incorrectHigh}:incorrectHigh:`;
    const misconception =
      result.highConfidenceWrongCount > 0
        ? ` · ${this.confidenceMisconceptionLabel(result.highConfidenceWrongCount)}`
        : '';
    const wrongOptions =
      result.highConfidenceWrongOptions && result.highConfidenceWrongOptions.length > 0
        ? ` · ${result.highConfidenceWrongOptions
            .map((entry) => `${stripMarkdownToPlainText(entry.text)}: ${entry.count}`)
            .join(' | ')}`
        : '';
    return `${distribution} | ${cross}${misconception}${wrongOptions}`;
  }

  private confidenceExportMetric(count: number, total: number): string {
    return `${count} (${this.finishedConfidencePercent(count, total)} %)`;
  }

  private exportAggregationRoundLabel(q: { aggregationRound?: 1 | 2 }): string {
    if (q.aggregationRound === 2) {
      return $localize`:@@sessionHost.exportAggregationRound2Label:2 (Peer Instruction)`;
    }
    if (q.aggregationRound === 1) {
      return '1';
    }
    return '';
  }

  private exportRoundContextDetails(q: {
    aggregationRound?: 1 | 2;
    round1ParticipantCount?: number;
    round2ParticipantCount?: number;
    participantCount: number;
  }): string | null {
    if (q.aggregationRound === 2) {
      const round1Count = q.round1ParticipantCount ?? 0;
      const round2Count = q.round2ParticipantCount ?? q.participantCount;
      if (round1Count > round2Count) {
        return $localize`:@@sessionHost.exportRoundParticipationGap:Runde 1: ${round1Count}:r1: Stimmen · Aggregiert: Runde 2 mit ${round2Count}:r2: Stimmen`;
      }
      return $localize`:@@sessionHost.exportAggregationRound2Context:Aggregationsrunde 2 (Peer Instruction)`;
    }
    if (q.aggregationRound === 1) {
      return $localize`:@@sessionHost.exportAggregationRound1Context:Aggregationsrunde 1`;
    }
    return null;
  }

  private confidenceExportColumns(result: ConfidenceResultDTO | undefined): string[] {
    if (!result) {
      return ['', '', '', '', '', '', ''];
    }
    const total = this.confidenceDistributionTotal(result);
    const crossTab = result.crossTab;
    const middle = crossTab.correctMid + crossTab.incorrectMid;
    const topWrongOption = result.highConfidenceWrongOptions?.[0];
    return [
      String(total),
      this.confidenceExportMetric(crossTab.correctHigh, total),
      this.confidenceExportMetric(crossTab.incorrectHigh, total),
      this.confidenceExportMetric(crossTab.correctLow, total),
      this.confidenceExportMetric(crossTab.incorrectLow, total),
      this.confidenceExportMetric(middle, total),
      topWrongOption
        ? `${stripMarkdownToPlainText(topWrongOption.text)} (${topWrongOption.count})`
        : '',
    ];
  }

  /** Verteilung der Sterne als lesbare Zeile (z. B. "1× 4 ★ · 2× 5 ★"). */
  getFeedbackDistributionLine(dist: Record<string, number>): string | null {
    if (!dist || Object.keys(dist).length === 0) return null;
    const parts: string[] = [];
    for (let star = 1; star <= 5; star++) {
      const n = dist[String(star)] ?? 0;
      if (n > 0) parts.push(`${formatLocaleCount(n, this.localeId)}× ${star} ★`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  /** Für Lobby: volle Beitritts-URL (präsentierbar, Story 2.1b QR-Code). */
  get joinUrl(): string {
    return resolveLocalizedJoinUrl(this.code);
  }

  async copyJoinLinkToClipboard(event?: Event): Promise<void> {
    event?.stopPropagation();
    const url = this.joinUrl;
    const clipboard = this.document.defaultView?.navigator.clipboard;
    try {
      if (!clipboard) {
        throw new Error('clipboard unavailable');
      }
      await clipboard.writeText(url);
      this.snackBar.open($localize`:@@sessionHost.copyJoinLinkSuccess:Session-Link kopiert.`, '', {
        duration: 2500,
      });
    } catch {
      this.snackBar.open(
        $localize`:@@sessionHost.copyJoinLinkFailed:Kopieren fehlgeschlagen. Bitte versuche es noch einmal.`,
        '',
        { duration: 4000 },
      );
    }
  }

  toggleJoinInfoPopover(): void {
    this.joinInfoPopoverOpen.update((v) => !v);
  }

  closeJoinInfoPopover(): void {
    this.joinInfoPopoverOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydownCloseJoinPopover(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') {
      return;
    }
    if (this.joinInfoPopoverOpen()) {
      this.closeJoinInfoPopover();
    }
    this.clearQaAuthorSelection();
  }

  /** Host der Beitritts-URL ohne Schema und ohne Pfad (Hostname, ggf. Port), für das Join-Menü. */
  joinOriginForMenu(): string {
    const url = this.joinUrl;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return new URL(url).host;
      }
    } catch {
      /* ungültige URL */
    }
    const host = this.document?.defaultView?.location?.host;
    return typeof host === 'string' && host.length > 0 ? host : '';
  }

  /** QR-Code als Data-URL für joinUrl (Beamer-tauglich, Story 2.1b). */
  readonly qrDataUrl = signal<string>('');

  async ngOnInit(): Promise<void> {
    if (this.code.length !== 6) return;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    // Preset "Seriös/Business" startet standardmäßig ohne Musik.
    this.musicMuted.set(this.themePreset.preset() === 'serious');
    try {
      await this.reloadSessionInfo();
      await this.refreshParticipantsPayload();
      await this.refreshLobbyTeams();
      await this.refreshQaQuestions();
      await this.refreshQuickFeedbackResult();
    } catch {
      this.session.set(null);
    }

    await this.generateQrCode();
    await this.refreshLiveFreetext();
    await this.refreshCurrentQuestionForHost();
    await this.refreshHostVoteProgress();
    this.syncMusic();
    this.startHostPolling();
    this.syncMusic();

    if (this.code.length === 6) {
      this.ensureParticipantSubscription();
      this.ensureStatusSubscription();
      this.ensureCurrentQuestionSubscription();
      this.ensureVoteProgressSubscription();

      this.document.addEventListener('click', this.unlockListener, { once: true });
      this.document.addEventListener('keydown', this.unlockListener, { once: true });
    }
  }

  private async reloadSessionInfo(): Promise<SessionInfoDTO> {
    const requestedAt = Date.now();
    const session = await trpc.session.getInfo.query({ code: this.code.toUpperCase() });
    recordServerTimeSample(session.serverTime, requestedAt);
    this.sessionUnavailable.set(false);
    this.session.set(session);
    this.syncQaTitleDraftFromSession();
    return session;
  }

  private ensureParticipantSubscription(): void {
    if (!this.code || this.participantSub) {
      return;
    }
    this.participantSub = trpc.session.onParticipantJoined.subscribe(
      { code: this.code.toUpperCase() },
      {
        onData: (data) => {
          this.updateParticipantsPayload(data);
        },
        onError: () => {
          this.participantSub?.unsubscribe();
          this.participantSub = null;
          this.burstHostFallbackAfterWsGap();
        },
      },
    );
  }

  private ensureStatusSubscription(): void {
    if (!this.code || this.statusSub) {
      return;
    }
    this.statusSub = trpc.session.onStatusChanged.subscribe(
      { code: this.code.toUpperCase() },
      {
        onData: (data) => {
          if (data.serverTime) {
            recordServerTimeIso(data.serverTime);
          }
          const update = {
            status: data.status as SessionStatusUpdate['status'],
            currentQuestion: data.currentQuestion,
            activeAt: data.activeAt ?? undefined,
            timer: data.timer,
            currentRound: data.currentRound,
            channels: data.channels,
            preferredChannel: data.preferredChannel,
          } satisfies SessionStatusUpdate;
          if (update.status === 'LOBBY' || update.status === 'FINISHED') {
            this.quizStartQuestionPending.set(false);
            this.clearHostQuestionDetailsRetry();
          }
          this.clearFoyerArrivalStateWhenLeavingLobby(update.status);
          this.statusUpdate.set(update);
          this.syncCountdownFromStatusUpdate(update);
        },
        onError: () => {
          this.statusSub?.unsubscribe();
          this.statusSub = null;
          this.burstHostFallbackAfterWsGap();
        },
      },
    );
  }

  private ensureCurrentQuestionSubscription(): void {
    if (!this.code || this.currentQuestionSub) {
      return;
    }
    this.currentQuestionSub = trpc.session.onCurrentQuestionForHostChanged.subscribe(
      { code: this.code.toUpperCase() },
      {
        onData: (data) => {
          this.hostRealtimeFallbackActive = false;
          this.clearHostRealtimeSubscriptionRetry();
          this.syncCurrentQuestionForHost(data);
        },
        onError: () => {
          this.currentQuestionSub?.unsubscribe();
          this.currentQuestionSub = null;
          this.burstHostFallbackAfterWsGap();
        },
      },
    );
  }

  private ensureVoteProgressSubscription(): void {
    if (!this.code || this.voteProgressSub) {
      return;
    }
    this.voteProgressSub = trpc.session.onHostVoteProgressChanged.subscribe(
      { code: this.code.toUpperCase() },
      {
        onData: (data) => {
          this.syncHostVoteProgress(data);
        },
        onError: () => {
          this.voteProgressSub?.unsubscribe();
          this.voteProgressSub = null;
          this.burstHostFallbackAfterWsGap();
        },
      },
    );
  }

  private startHostPolling(): void {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    if (!this.auxPollTimer) {
      this.auxPollTimer = setInterval(() => {
        this.runAuxiliaryPollCycle();
        if (this.hostRealtimeFallbackActive) {
          this.runRealtimeFallbackCycle();
        }
      }, HOST_AUX_POLL_MS);
    }
    if (!this.clockPollTimer) {
      this.clockPollTimer = setInterval(() => {
        void this.refreshServerClockSkew();
      }, HOST_CLOCK_POLL_MS);
    }
  }

  private stopHostPolling(): void {
    if (this.auxPollTimer) {
      clearInterval(this.auxPollTimer);
      this.auxPollTimer = null;
    }
    if (this.clockPollTimer) {
      clearInterval(this.clockPollTimer);
      this.clockPollTimer = null;
    }
  }

  private runAuxiliaryPollCycle(): void {
    void this.refreshAuxiliaryHostData();
    this.syncMusic();
  }

  private runRealtimeFallbackCycle(): void {
    if (this.hostRealtimeFallbackRefreshInFlight) {
      return;
    }
    this.hostRealtimeFallbackRefreshInFlight = true;
    void this.refreshRealtimeHostFallback()
      .catch(() => undefined)
      .finally(() => {
        this.hostRealtimeFallbackRefreshInFlight = false;
      });
  }

  private async refreshAuxiliaryHostData(): Promise<void> {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    if (this.shouldPollLiveFreetext()) {
      await this.refreshLiveFreetext();
    }
    if (this.shouldPollQaQuestions()) {
      await this.refreshQaQuestions();
    }
    if (this.shouldPollQuickFeedback()) {
      await this.refreshQuickFeedbackResult();
    }
    if (this.shouldPollEmojiReactions()) {
      await this.refreshEmojiReactions();
    }
  }

  private async refreshRealtimeHostFallback(): Promise<void> {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    try {
      await this.reloadSessionInfo();
    } catch {
      /* best effort */
    }
    await this.refreshParticipantsPayload();
    await this.refreshCurrentQuestionForHost();
    await this.refreshHostVoteProgress();
    if (this.session()?.teamMode && this.effectiveStatus() === 'LOBBY') {
      await this.refreshLobbyTeams();
    }
  }

  private shouldPollLiveFreetext(): boolean {
    if (this.activeChannel() !== 'quiz') {
      return false;
    }
    if (this.wordCloudFrozen()) {
      return false;
    }
    return this.displayedCurrentQuestionForHost()?.type === 'FREETEXT';
  }

  private shouldPollQaQuestions(): boolean {
    return this.activeChannel() === 'qa' && this.channels().qa;
  }

  private shouldPollQuickFeedback(): boolean {
    return this.channels().quickFeedback && this.isChannelOpen('quickFeedback');
  }

  private shouldPollEmojiReactions(): boolean {
    return (
      this.activeChannel() === 'quiz' &&
      this.session()?.enableEmojiReactions === true &&
      (this.effectiveStatus() === 'ACTIVE' || this.effectiveStatus() === 'RESULTS')
    );
  }

  private unlockListener = (): void => {
    this.sound.unlock();
    this.document.removeEventListener('click', this.unlockListener);
    this.document.removeEventListener('keydown', this.unlockListener);
  };

  /** Ein Poll-Zyklus ohne auf das Intervall zu warten (z. B. nach WS-Subscription-Fehler beim Deploy). */
  private burstHostFallbackAfterWsGap(): void {
    this.hostRealtimeFallbackActive = true;
    this.startHostPolling();
    this.runRealtimeFallbackCycle();
    this.runAuxiliaryPollCycle();
    this.scheduleHostRealtimeSubscriptionRetry();
  }

  private scheduleHostRealtimeSubscriptionRetry(): void {
    if (this.hostRealtimeSubscriptionRetryTimer) {
      return;
    }
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    this.hostRealtimeSubscriptionRetryTimer = setTimeout(() => {
      this.hostRealtimeSubscriptionRetryTimer = null;
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      this.ensureParticipantSubscription();
      this.ensureStatusSubscription();
      this.ensureCurrentQuestionSubscription();
      this.ensureVoteProgressSubscription();
    }, HOST_REALTIME_RESUBSCRIBE_MS);
  }

  private clearHostRealtimeSubscriptionRetry(): void {
    if (!this.hostRealtimeSubscriptionRetryTimer) {
      return;
    }
    clearTimeout(this.hostRealtimeSubscriptionRetryTimer);
    this.hostRealtimeSubscriptionRetryTimer = null;
  }

  /** Periodische Kalibrierung gegen die Serverzeit (Health), falls keine Status-Events kommen. */
  private async refreshServerClockSkew(): Promise<void> {
    try {
      const requestedAt = Date.now();
      const h = await trpc.health.check.query();
      recordServerTimeSample(h.timestamp, requestedAt);
    } catch {
      /* ignorieren */
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.suppressJoinMenuAutopen = true;
    this.hostDisplayMode.setHostSessionActive(false);
    this.participantSub?.unsubscribe();
    this.participantSub = null;
    this.statusSub?.unsubscribe();
    this.statusSub = null;
    this.currentQuestionSub?.unsubscribe();
    this.currentQuestionSub = null;
    this.voteProgressSub?.unsubscribe();
    this.voteProgressSub = null;
    this.qaSub?.unsubscribe();
    this.qaSub = null;
    this.qaSubscriptionKey = null;
    this.clearQaWordCloudThemeAnalysisTimer();
    this.clearHostQuestionDetailsRetry();
    this.clearHostRealtimeSubscriptionRetry();
    this.stopHostPolling();
    this.clearFoyerArrivalState();
    this.stopCountdown();
    this.sound.stopAll();
    if (this.emojiPulseTimer) {
      clearTimeout(this.emojiPulseTimer);
      this.emojiPulseTimer = null;
    }
    this.document.removeEventListener('click', this.unlockListener);
    this.document.removeEventListener('keydown', this.unlockListener);
  }

  /** Warnt den Host, wenn er den Tab schließt oder die Seite neu lädt. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.shouldWarnOnBeforeUnload()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreenActive.set(this.getFullscreenElement() !== null);
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.isFullscreenSupported()) {
      return;
    }
    const root = this.document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const doc = this.document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
    };

    try {
      if (this.getFullscreenElement()) {
        if (typeof doc.exitFullscreen === 'function') {
          await doc.exitFullscreen();
        } else {
          await doc.webkitExitFullscreen?.();
        }
      } else if (typeof root.requestFullscreen === 'function') {
        await root.requestFullscreen();
      } else {
        await root.webkitRequestFullscreen?.();
      }
    } catch {
      // Browser blockiert Fullscreen ohne direkte User-Geste oder unterstützt API nicht vollständig.
    } finally {
      this.isFullscreenActive.set(this.getFullscreenElement() !== null);
    }
  }

  toggleHostFrameMode(): void {
    this.hostDisplayMode.setPreferImmersiveHost(!this.isImmersiveMode());
  }

  private getFullscreenElement(): Element | null {
    return getDocumentFullscreenElement(this.document);
  }

  /**
   * Lobby-Start: Vollbild **synchron** im Click-Stack auslösen, danach Session starten.
   * Wichtig: kein `async` auf dieser Methode — sonst verliert Chrome/Safari oft die User-Activation.
   */
  onLobbyStartSessionClick(): void {
    this.tryEnterHostFullscreenFromUserGesture();
    void this.startSessionFlow();
  }

  /**
   * Gleiche Ziel-Elemente wie `toggleFullscreen` (enter), aber ohne `async`,
   * damit `requestFullscreen()` noch in derselben User-Geste wie der Klick liegt.
   */
  private tryEnterHostFullscreenFromUserGesture(): void {
    tryRequestDocumentFullscreen(this.document, () => {
      this.isFullscreenActive.set(this.getFullscreenElement() !== null);
    });
  }

  private tryEnterWordCloudFullscreenFromUserGesture(): void {
    tryRequestDocumentFullscreen(this.document, () => {
      this.isFullscreenActive.set(this.getFullscreenElement() !== null);
    });
  }

  /** Prüft, ob die Session noch läuft (nicht FINISHED und nicht null). */
  private isSessionActive(): boolean {
    const status = this.effectiveStatus();
    return !this.sessionUnavailable() && status !== null && status !== 'FINISHED';
  }

  private isSessionNotFoundError(error: unknown): boolean {
    return error instanceof Error && error.message.includes(SESSION_NOT_FOUND_MESSAGE);
  }

  private shouldWarnOnBeforeUnload(): boolean {
    if (!this.unloadWarningEnabled || !this.isSessionActive()) {
      return false;
    }

    if (this.effectiveStatus() !== 'LOBBY') {
      return true;
    }

    return (this.participantsPayload()?.participantCount ?? 0) > 0;
  }

  private isLocalDevSession(): boolean {
    const hostname = this.document.location?.hostname ?? '';
    return isDevMode() && (hostname === 'localhost' || hostname === '127.0.0.1');
  }

  private clearSessionTokens(): void {
    if (!this.code) {
      return;
    }
    clearHostToken(this.code);
    clearFeedbackHostToken(this.code);
  }

  private markSessionUnavailable(): void {
    this.sessionUnavailable.set(true);
    this.stopCountdown();
    this.countdownSeconds.set(null);
    this.syncCurrentQuestionForHost(null);
    this.statusUpdate.set({
      status: 'FINISHED',
      currentQuestion: null,
      activeAt: undefined,
    });
    this.session.update((session) => (session ? { ...session, status: 'FINISHED' } : session));
    this.dismissHostSteeringCallout();
    this.clearSessionTokens();
  }

  private async navigateHomeAfterSessionUnavailable(): Promise<void> {
    this.markSessionUnavailable();
    await this.exitFullscreenBeforeHomeNavigation();
    await this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
  }

  dismissHostSteeringCallout(): void {
    this.hostSteeringCallout.set(null);
  }

  hostSteeringCalloutReloadHref(): string {
    return this.document.location?.href ?? this.localizedPath('/');
  }

  private openHostSteeringCalloutForSteeringFailure(retry: () => void): void {
    this.hostSteeringCallout.set({
      title: $localize`:@@sessionHost.steeringCalloutTitle:Das ist gerade nicht angekommen`,
      body: $localize`:@@sessionHost.steeringCalloutBody:Kein Stress – so was passiert manchmal (kurzer Ruckler oder instabiles WLAN). Warte zwei, drei Sekunden und tippe auf „Nochmal probieren“ – meist reicht das.`,
      retry,
    });
  }

  private openHostSteeringCalloutForQaFailure(retry: () => void): void {
    this.hostSteeringCallout.set({
      title: $localize`:@@sessionHost.steeringCalloutQaTitle:Mit den Fragen klappt es gerade nicht`,
      body: $localize`:@@sessionHost.steeringCalloutQaBody:Hier ist nichts kaputt – es hat nur gerade nicht geklappt. Kurz durchatmen, 2–3 Sekunden warten, dann „Nochmal probieren“ – oft läuft es gleich wieder.`,
      retry,
    });
  }

  private openHostSteeringCalloutForExportFailure(retry: () => void): void {
    this.hostSteeringCallout.set({
      title: $localize`:@@sessionHost.steeringCalloutExportTitle:Export noch nicht bereit`,
      body: $localize`:@@sessionHost.steeringCalloutExportBody:PDF, Vorschau oder Excel-Export ist diesmal nicht durchgekommen. Warte ein paar Sekunden und tippe auf „Nochmal probieren“ – meist klappt’s beim zweiten Anlauf.`,
      retry,
    });
  }

  private async retryEndSessionAndNavigateHome(): Promise<void> {
    if (!this.code) return;
    try {
      await trpc.session.end.mutate({ code: this.code.toUpperCase() });
      this.markSessionUnavailable();
      await this.exitFullscreenBeforeHomeNavigation();
      await this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
      this.dismissHostSteeringCallout();
    } catch (error) {
      if (this.isSessionNotFoundError(error)) {
        await this.navigateHomeAfterSessionUnavailable();
      }
      /* Hinweis bleibt, bis Retry klappt oder die Person schließt. */
    }
  }

  /**
   * CanDeactivate-Guard-Hook: zeigt einen Bestätigungsdialog,
   * wenn die Session noch läuft.
   */
  async onSessionEndAnchorClick(): Promise<void> {
    if (!this.isSessionActive()) {
      return;
    }
    const hasExportableResults = await this.hasExportableResultsAfterSessionEnd();
    const shouldShowFinishedView = this.activeChannel() !== 'quickFeedback' && hasExportableResults;
    const confirmed = await this.confirmSessionEnd(undefined, hasExportableResults);
    if (!confirmed || !this.code) {
      return;
    }
    try {
      if (shouldShowFinishedView) {
        await this.endSession();
      } else {
        await this.endSessionAndNavigateHome();
      }
    } catch {
      const retry = shouldShowFinishedView
        ? () => void this.endSession()
        : () => void this.retryEndSessionAndNavigateHome();
      this.openHostSteeringCalloutForSteeringFailure(retry);
    }
  }

  private async hasExportableResultsAfterSessionEnd(): Promise<boolean> {
    if (!this.code) {
      return false;
    }
    try {
      const data = await trpc.session.getExportData.query({ code: this.code.toUpperCase() });
      return this.hasExportableSessionResults(data);
    } catch {
      const participantCount = this.participantsPayload()?.participantCount ?? 0;
      return participantCount > 0;
    }
  }

  private hasExportableSessionResults(data: {
    questions: Array<{
      participantCount: number;
      optionDistribution?: Array<{ count: number }>;
      freetextAggregates?: Array<{ count: number }>;
      ratingDistribution?: Record<string, number>;
      ratingAverage?: number | null;
    }>;
    teamLeaderboard?: unknown[];
    bonusTokens?: unknown[];
  }): boolean {
    if ((data.bonusTokens?.length ?? 0) > 0) {
      return true;
    }
    if ((data.teamLeaderboard?.length ?? 0) > 0) {
      return true;
    }
    return data.questions.some((question) => {
      if (question.participantCount > 0) {
        return true;
      }
      if (question.optionDistribution?.some((entry) => entry.count > 0)) {
        return true;
      }
      if (question.freetextAggregates?.some((entry) => entry.count > 0)) {
        return true;
      }
      if (
        question.ratingDistribution &&
        Object.values(question.ratingDistribution).some((count) => count > 0)
      ) {
        return true;
      }
      return typeof question.ratingAverage === 'number' && question.ratingAverage > 0;
    });
  }

  async canDeactivate(): Promise<boolean> {
    if (!this.isSessionActive()) {
      if (this.effectiveStatus() === 'FINISHED' && this.code) {
        this.clearSessionTokens();
      }
      return true;
    }

    const result = await this.confirmSessionEnd(() => this.tryEnterHostFullscreenFromUserGesture());
    if (result !== true || !this.code) {
      return false;
    }

    try {
      await this.endSessionAndNavigateHome();
    } catch (error) {
      if (this.isSessionNotFoundError(error)) {
        await this.navigateHomeAfterSessionUnavailable();
        return false;
      }
      this.openHostSteeringCalloutForSteeringFailure(
        () => void this.retryEndSessionAndNavigateHome(),
      );
    }
    return false;
  }

  private async confirmSessionEnd(
    onCancelUserGesture?: () => void,
    hasExportableResults = false,
  ): Promise<boolean> {
    const participants = this.participantsPayload()?.participantCount ?? 0;
    const shouldWarnAboutBonusCodes = await this.shouldWarnAboutBonusCodesOnLeave();

    const consequences: string[] = [
      $localize`:@@sessionHost.leaveConsequenceParticipantsHome:Teilnehmende und die Präsentationsansicht werden zur Startseite weitergeleitet.`,
      $localize`:@@sessionHost.leaveConsequenceSessionEnds:Die Session endet für alle; ein Fortsetzen mit demselben Code ist nicht möglich.`,
    ];
    if (participants > 0) {
      consequences.push(
        $localize`:@@sessionHost.leaveConsequenceWaitingCount:${participants}:participantCount: Teilnehmende sind noch in der Session.`,
      );
    }
    if (hasExportableResults) {
      consequences.push(
        $localize`:@@sessionHost.leaveConsequenceExportAfterEnd:Du hast bereits Ergebnisse. Nach dem Beenden kannst du sie in der Abschlussansicht exportieren oder Feedback ansehen.`,
      );
    } else {
      consequences.push(
        $localize`:@@sessionHost.leaveConsequenceNoResultsYet:Es liegen noch keine verwertbaren Ergebnisse vor. Nach dem Beenden wirst du direkt zur Startseite geführt.`,
      );
    }
    if (shouldWarnAboutBonusCodes) {
      consequences.push(
        $localize`:@@sessionHost.leaveConsequenceBonusCodes:Für Bonus-Codes: Weise die Teilnehmenden darauf hin, ihren persönlichen Code jetzt zu kopieren (Zwischenablage), bevor sie die Seite verlassen – sonst können sie ihn leicht verlieren.`,
      );
    }

    const dialogRef = this.dialog.open(ConfirmLeaveDialogComponent, {
      data: {
        title: $localize`Session verlassen?`,
        message: $localize`Deine Session ist noch aktiv.`,
        consequences,
        confirmLabel: $localize`Trotzdem verlassen`,
        cancelLabel: $localize`Zurück zur Session`,
        onCancelUserGesture,
      } satisfies ConfirmLeaveDialogData,
      width: 'min(26rem, calc(100vw - 1.5rem))',
      maxWidth: '100vw',
      autoFocus: 'dialog',
    });

    return (await firstValueFrom(dialogRef.afterClosed())) === true;
  }

  private async shouldWarnAboutBonusCodesOnLeave(): Promise<boolean> {
    const bonusTop = this.session()?.bonusTokenCount;
    if (typeof bonusTop !== 'number' || bonusTop <= 0 || !this.code) {
      return false;
    }

    const cached = this.leaderboard();
    if (this.hasPotentialBonusRecipients(cached)) {
      return true;
    }

    try {
      const entries = await trpc.session.getLeaderboard.query({ code: this.code.toUpperCase() });
      return this.hasPotentialBonusRecipients(entries);
    } catch {
      return false;
    }
  }

  private hasPotentialBonusRecipients(entries: Array<{ totalScore: number }>): boolean {
    return entries.some((entry) => entry.totalScore > 0);
  }

  private async endSessionAndNavigateHome(): Promise<void> {
    if (!this.code) {
      return;
    }
    await trpc.session.end.mutate({ code: this.code.toUpperCase() });
    this.markSessionUnavailable();
    await this.exitFullscreenBeforeHomeNavigation();
    await this.ngZone.run(async () => {
      await this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
    });
  }

  private async exitFullscreenBeforeHomeNavigation(): Promise<void> {
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        this.isFullscreenActive.set(this.getFullscreenElement() !== null);
        resolve();
      };

      tryExitDocumentFullscreen(this.document, done);
      setTimeout(done, 180);
    });
  }

  private startCountdown(timerSeconds: number | null | undefined, activeAt?: string): void {
    this.stopCountdown();
    this.countdownEnded.set(false);
    this.countdownSfxPhase.set(false);
    this.countdownIntroSoundPlayed = false;
    this.countdownFinalSoundPlayed = false;
    if (!timerSeconds || timerSeconds <= 0) {
      this.countdownSeconds.set(null);
      return;
    }
    const start = activeAt ? new Date(activeAt).getTime() : Date.now();
    const deadline = start + timerSeconds * 1000;

    const tick = (): void => {
      const remaining = remainingCountdownSeconds(deadline);
      this.countdownSeconds.set(remaining);
      if (remaining <= 9 && !this.countdownSfxPhase()) {
        this.countdownSfxPhase.set(true);
      }
      const sfxCountdown = !!this.session()?.enableSoundEffects && this.isPlayfulPreset();
      if (remaining <= 6 && sfxCountdown) {
        if (remaining === 6 && !this.countdownIntroSoundPlayed) {
          void this.sound.play('countdownEnd');
          this.countdownIntroSoundPlayed = true;
        } else if (remaining === 1 && !this.countdownFinalSoundPlayed) {
          void this.sound.play('sessionEnd');
          this.countdownFinalSoundPlayed = true;
        }
      }
      if (remaining <= 0) {
        if (sfxCountdown && !this.countdownFinalSoundPlayed) {
          void this.sound.play('sessionEnd');
          this.countdownFinalSoundPlayed = true;
        }
        this.stopCountdown();
        this.countdownSeconds.set(0);
        this.countdownEnded.set(true);
        this.fingerHideTimeout = setTimeout(() => {
          this.countdownSeconds.set(null);
          this.fingerHideTimeout = null;
        }, 5000);
      }
    };

    tick();
    this.countdownTimer = setInterval(tick, 1000);
  }

  private syncCountdownFromStatusUpdate(update: SessionStatusUpdate): void {
    if (update.status !== 'ACTIVE' || (update.currentRound ?? 1) === 2) {
      this.stopCountdown();
      this.countdownSeconds.set(null);
      return;
    }

    const timerSeconds =
      typeof update.timer === 'number'
        ? update.timer
        : update.timer === null
          ? null
          : this.displayedCurrentQuestionForHost()?.timer;

    if (timerSeconds === undefined) {
      return;
    }
    this.startCountdown(timerSeconds, update.activeAt);
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

  /** Synchronisiert Host-Hintergrundmusik phasenabhängig. */
  private syncMusic(): void {
    if (this.sound.musicPreviewing()) return;
    const session = this.session();
    const track = this.activeMusicTrack();
    if (!session || this.effectiveStatus() === 'FINISHED' || !track) {
      this.sound.stopMusic();
      return;
    }
    void this.sound.playMusic(track);
  }

  /** Menü zu: Vorschau abbrechen, normale Musik wiederherstellen. */
  onHostMusicMenuClosed(): void {
    this.sound.stopPreview();
    this.syncMusic();
  }

  /** Beim Öffnen: Bearbeitungs-Phase an live-Phase anlehnen. */
  onHostMusicMenuOpening(): void {
    const live = this.currentMusicPhase();
    this.musicMenuEditPhase.set(live ?? 'lobby');
  }

  onMusicMenuPhaseToggle(ev: { value: unknown }): void {
    const v = ev.value;
    if (v === 'lobby' || v === 'reading' || v === 'countdown') {
      this.musicMenuEditPhase.set(v);
    }
  }

  /** Kurzvorschau starten oder laufende Vorschau dieses Tracks stoppen. */
  previewOrStopHostTrack(track: HostMusicTrack, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.sound.unlock();
    if (this.sound.musicPreviewTrackId() === track) {
      this.sound.stopPreview();
      this.syncMusic();
      return;
    }
    this.sound.previewMusic(track, 12, () => this.syncMusic());
  }

  ariaHostMusicPreviewButton(trackId: HostMusicTrack): string {
    return this.sound.musicPreviewTrackId() === trackId
      ? $localize`:@@sessionHost.musicPreviewStopAria:Vorschau stoppen`
      : $localize`:@@sessionHost.musicPreviewTrackAria:Track kurz anhören (max. 12 Sekunden)`;
  }

  toggleMuteMusic(): void {
    this.sound.unlock();
    this.sound.stopPreview();
    this.musicMuted.set(!this.musicMuted());
    this.syncMusic();
  }

  musicToggleLabel(): string {
    return this.musicMuted()
      ? $localize`:@@sessionHost.musicToggleOn:Ton an`
      : $localize`:@@sessionHost.musicToggleOff:Ton aus`;
  }

  setPhaseTrack(phase: MusicPhase, track: HostMusicTrack): void {
    this.sound.unlock();
    this.sound.stopPreview();
    const next = { ...this.phaseTracks(), [phase]: track };
    this.phaseTracks.set(next);
    try {
      localStorage.setItem(MUSIC_PHASE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
    this.syncMusic();
  }

  phaseTrackLabel(phase: MusicPhase): string {
    const track = this.phaseTracks()[phase];
    return ALL_MUSIC_TRACKS.find((t) => t.value === track)?.label ?? track;
  }

  private async generateQrCode(): Promise<void> {
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
      const url = qr.createDataURL(9, 2);
      this.qrDataUrl.set(url);
    } catch {
      // best-effort
    }
  }

  /** Effektiver Status (Subscription oder Initial getInfo). */
  effectiveStatus(): SessionInfoDTO['status'] | null {
    const su = this.statusUpdate();
    const s = this.session();
    return su?.status ?? s?.status ?? null;
  }

  private clearFoyerArrivalStateWhenLeavingLobby(nextStatus: SessionInfoDTO['status']): void {
    if (this.effectiveStatus() === 'LOBBY' && nextStatus !== 'LOBBY') {
      this.clearFoyerArrivalState();
    }
  }

  /** i18n: Singular label for participant count. */
  participantLabelSingular(): string {
    return $localize`:@@sessionHost.participantCountOne:teilnehmende Person`;
  }
  /** i18n: Plural label for participant count. */
  participantLabelPlural(): string {
    return $localize`:@@sessionHost.participantCountMany:Teilnehmende`;
  }

  connectedParticipantStatusLabel(
    connectedCount: number | null | undefined,
    totalParticipantCount: number | null | undefined,
  ): string | null {
    if (
      typeof connectedCount !== 'number' ||
      typeof totalParticipantCount !== 'number' ||
      connectedCount <= 0 ||
      totalParticipantCount <= 0 ||
      connectedCount >= totalParticipantCount
    ) {
      return null;
    }
    if (connectedCount === 1) {
      return $localize`:@@sessionHost.connectedParticipantCountOne:1 live verbunden`;
    }
    return $localize`:@@sessionHost.connectedParticipantCountMany:${formatLocaleCount(connectedCount, this.localeId)}:connectedCount: live verbunden`;
  }

  teamMemberLabel(count: number): string {
    const formatted = formatLocaleCount(count, this.localeId);
    return count === 1 ? $localize`${formatted} Mitglied` : $localize`${formatted} Mitglieder`;
  }

  teamNameUsesEmojiMarker(teamName: string): boolean {
    return edgeEmojiMarkerPosition(teamName) !== null;
  }

  teamNameEmojiMarker(teamName: string): string | null {
    return extractEdgeEmoji(teamName);
  }

  teamNameEmojiMarkerTrailing(teamName: string): boolean {
    return edgeEmojiMarkerPosition(teamName) === 'trailing';
  }

  teamNameLabelWithoutEmojiMarker(teamName: string): string {
    const label = stripEdgeEmojiMarker(teamName).trim();
    return label.length > 0 ? label : $localize`Team`;
  }

  lobbyTeamEmptyLabel(): string {
    return $localize`Noch niemand in diesem Team.`;
  }

  /** Kindergarten-Preset: großes Tier-Emoji vor dem gespeicherten Nickname (Lobby). */
  lobbyKindergartenEmoji(nickname: string): string | null {
    const s = this.session();
    if (!s || s.nicknameTheme !== 'KINDERGARTEN' || s.anonymousMode === true) {
      return null;
    }
    return findKindergartenNicknameEmoji(nickname);
  }

  foyerArrivalChipsForTeam(teamId: string): readonly FoyerEntranceChip[] {
    return this.foyerArrivalChipsByTeam().get(teamId) ?? [];
  }

  latestFoyerArrivalChipForTeam(teamId: string): FoyerEntranceChip | null {
    const chips = this.foyerArrivalChipsForTeam(teamId);
    return chips.reduce<FoyerEntranceChip | null>(
      (latest, chip) => (latest === null || chip.sequence > latest.sequence ? chip : latest),
      null,
    );
  }

  latestFoyerArrivalSequenceForTeam(teamId: string): number {
    return this.latestFoyerArrivalChipForTeam(teamId)?.sequence ?? 0;
  }

  teamArrivalPulseSequenceForTeam(teamId: string): number | null {
    return this.foyerTeamPulseSequences()[teamId] ?? null;
  }

  teamArrivalPulseActive(teamId: string): boolean {
    return this.teamArrivalPulseSequenceForTeam(teamId) !== null;
  }

  teamArrivalPulseVariant(teamId: string): 'a' | 'b' {
    return (this.teamArrivalPulseSequenceForTeam(teamId) ?? 0) % 2 === 0 ? 'a' : 'b';
  }

  teamLandingEchoActive(teamId: string): boolean {
    return this.landedTeamEchoSequences()[teamId] !== undefined;
  }

  teamHasHiddenLobbyArrivals(teamId: string): boolean {
    const hiddenIds = this.hiddenLobbyParticipantIds();
    if (hiddenIds.size === 0) {
      return false;
    }

    return (this.participantsPayload()?.participants ?? []).some(
      (participant) => participant.teamId === teamId && hiddenIds.has(participant.id),
    );
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.showTeamFoyerEntranceLayers()) {
      return;
    }

    this.recalculateTeamFoyerDirections();
  }

  private recalculateTeamFoyerDirections(): void {
    const cards = this.lobbyTeamCardRefs?.toArray() ?? [];
    if (cards.length === 0) {
      this.foyerTeamDirections.set({});
      return;
    }

    const viewportWidth = this.document.defaultView?.innerWidth ?? 0;
    const viewportMidpoint = viewportWidth > 0 ? viewportWidth / 2 : 0;
    const nextDirections: Record<string, 'left' | 'right'> = {};

    for (const cardRef of cards) {
      const element = cardRef.nativeElement;
      const teamId = element.dataset['teamId'];
      if (!teamId) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      nextDirections[teamId] = centerX <= viewportMidpoint ? 'left' : 'right';
    }

    this.foyerTeamDirections.set(nextDirections);
    this.foyerArrivalChips.update((chips) =>
      chips.map((chip) => {
        if (!chip.teamId) {
          return chip;
        }
        const direction = nextDirections[chip.teamId];
        return direction ? { ...chip, direction } : chip;
      }),
    );
  }

  private updateParticipantsPayload(
    payload: SessionParticipantsPayload,
    allowArrivalEvents = true,
  ): void {
    const previousPayload = this.participantsPayload();
    if (this.isSameParticipantsPayload(previousPayload, payload)) {
      return;
    }

    const nextParticipantIds = new Set(payload.participants.map((participant) => participant.id));
    const newParticipants =
      allowArrivalEvents && this.participantBaselineReady
        ? payload.participants.filter(
            (participant) => !this.knownParticipantIds.has(participant.id),
          )
        : [];

    this.participantsPayload.set(payload);
    this.knownParticipantIds = nextParticipantIds;
    this.participantBaselineReady = true;

    if (this.session()?.teamMode === true && this.suppressTeamFoyerEntrance()) {
      this.clearFoyerArrivalState();
      return;
    }

    if (newParticipants.length > 0) {
      this.enqueueFoyerArrivalChips(newParticipants, payload.participantCount);
    }
  }

  private enqueueFoyerArrivalChips(
    participants: SessionParticipantsPayload['participants'],
    totalParticipantCount: number,
  ): void {
    if (!this.canShowFoyerEntrance()) {
      return;
    }
    if (
      this.session()?.teamMode === true &&
      (totalParticipantCount >= TEAM_FOYER_SUPPRESSION_PARTICIPANT_THRESHOLD ||
        participants.length >= TEAM_FOYER_SUPPRESSION_BURST_THRESHOLD)
    ) {
      this.clearFoyerArrivalState();
      return;
    }

    const dense = participants.length >= 3 || totalParticipantCount >= 16;
    const teamDirections = this.foyerTeamDirections();
    const additions =
      this.session()?.teamMode === true
        ? this.buildTeamFoyerArrivalBurst(participants, dense, teamDirections)
        : this.buildNonTeamFoyerArrivalBurst(participants, dense, teamDirections);

    if (additions.length === 0) {
      return;
    }

    const timedAdditions =
      this.session()?.teamMode === true
        ? this.withCalmTeamArrivalDelays(this.foyerArrivalChips(), additions)
        : this.withCalmNonTeamArrivalDelays(this.foyerArrivalChips(), additions);

    if (this.session()?.teamMode === true) {
      for (const chip of timedAdditions) {
        const hiddenIds = new Set<string>();
        if (chip.participantId) {
          hiddenIds.add(chip.participantId);
        }
        chip.hiddenParticipantIds?.forEach((participantId) => hiddenIds.add(participantId));
        this.registerHiddenLobbyParticipants([...hiddenIds], chip.presenceMs + chip.delayMs);
        this.scheduleTeamLandingEcho(chip.teamId, chip.sequence, chip.presenceMs + chip.delayMs);
      }
    }

    this.foyerArrivalChips.update((current) => [
      ...current.slice(-Math.max(0, FOYER_MAX_ACTIVE_CHIPS - timedAdditions.length)),
      ...timedAdditions,
    ]);
    timedAdditions.forEach((chip) => {
      this.scheduleFoyerArrivalCleanup(chip.id, chip.delayMs);
      this.scheduleTeamArrivalPulse(chip.teamId, chip.sequence, chip.delayMs + chip.pulseDelayMs);
    });
  }

  private buildNonTeamFoyerArrivalBurst(
    participants: SessionParticipantsPayload['participants'],
    dense: boolean,
    teamDirections: Record<string, 'left' | 'right'>,
  ): FoyerEntranceChip[] {
    return participants.map((participant, index) =>
      this.createFoyerArrivalChip(participant, index, dense, teamDirections),
    );
  }

  private buildTeamFoyerArrivalBurst(
    participants: SessionParticipantsPayload['participants'],
    dense: boolean,
    teamDirections: Record<string, 'left' | 'right'>,
  ): FoyerEntranceChip[] {
    const groupedParticipants = new Map<string, SessionParticipantsPayload['participants']>();

    for (const participant of participants) {
      const teamId = participant.teamId ?? `__unassigned__:${participant.id}`;
      const entries = groupedParticipants.get(teamId) ?? [];
      entries.push(participant);
      groupedParticipants.set(teamId, entries);
    }

    const additions: FoyerEntranceChip[] = [];
    for (const [, grouped] of groupedParticipants) {
      additions.push(
        ...grouped.map((participant, index) =>
          this.createFoyerArrivalChip(participant, index, dense, teamDirections),
        ),
      );
    }

    return additions;
  }

  private createFoyerArrivalChip(
    participant: SessionParticipantsPayload['participants'][number],
    _index: number,
    dense: boolean,
    teamDirections: Record<string, 'left' | 'right'>,
  ): FoyerEntranceChip {
    const session = this.session();
    const sequence = this.foyerArrivalSequence++;
    const kindergartenEmoji = this.lobbyKindergartenEmoji(participant.nickname);
    const label = buildFoyerChipLabel({
      nickname: participant.nickname,
      anonymousMode: session?.anonymousMode === true,
      kindergartenEmoji,
      dense,
      preferEmojiOnly: session?.teamMode === true && !!kindergartenEmoji,
      preferReadableText:
        session?.teamMode !== true ||
        (session?.allowCustomNicknames === false &&
          session?.anonymousMode !== true &&
          participant.nickname.trim().includes(' ')),
    });
    const teamDirection = participant.teamId ? teamDirections[participant.teamId] : null;

    return {
      id: `${participant.id}-${sequence}`,
      participantId: participant.id,
      teamId: participant.teamId ?? null,
      sequence,
      delayMs: 0,
      lane: this.nextFoyerLane(participant.teamId ?? null),
      direction: teamDirection ?? (sequence % 2 === 0 ? 'left' : 'right'),
      ...this.defaultFoyerArrivalMotionProfile(
        participant.teamId !== null && participant.teamId !== undefined,
      ),
      ...label,
    } satisfies FoyerEntranceChip;
  }

  private defaultFoyerArrivalMotionProfile(
    teamMode: boolean,
  ): Pick<
    FoyerEntranceChip,
    | 'enterDurationMs'
    | 'presenceMs'
    | 'settleDelayMs'
    | 'badgeDelayMs'
    | 'badgePresenceMs'
    | 'pulseDelayMs'
  > {
    const enterDurationMs = teamMode ? 1760 : 680;
    const presenceMs = teamMode ? 3200 : this.foyerChipLifetimeMs;
    return {
      enterDurationMs,
      presenceMs,
      settleDelayMs: teamMode ? 1280 : 0,
      badgeDelayMs: teamMode ? 1440 : 0,
      badgePresenceMs: teamMode ? 1380 : 0,
      pulseDelayMs: teamMode ? 1880 : 0,
    };
  }

  private withCalmTeamArrivalDelays(
    current: readonly FoyerEntranceChip[],
    additions: readonly FoyerEntranceChip[],
  ): FoyerEntranceChip[] {
    if (this.session()?.nicknameTheme === 'KINDERGARTEN') {
      return this.withKindergartenArrivalDelays(current, additions);
    }

    const nextSlots = new Map<string, number>();
    for (const chip of current) {
      if (!chip.teamId) {
        continue;
      }
      const scheduledDelay = chip.delayMs + this.teamArrivalPresentationStepMs(chip);
      const currentDelay = nextSlots.get(chip.teamId) ?? 0;
      nextSlots.set(chip.teamId, Math.max(currentDelay, scheduledDelay));
    }

    return additions.map((chip) => {
      if (!chip.teamId) {
        return chip;
      }

      const delayMs = nextSlots.get(chip.teamId) ?? 0;
      nextSlots.set(chip.teamId, delayMs + this.teamArrivalPresentationStepMs(chip));
      return { ...chip, delayMs };
    });
  }

  private teamArrivalPresentationStepMs(chip: Pick<FoyerEntranceChip, 'badgeDelayMs'>): number {
    return Math.max(
      FOYER_TEAM_DELAY_STEP_MS,
      chip.badgeDelayMs + FOYER_TEAM_PRESENTATION_BUFFER_MS,
    );
  }

  private withCalmNonTeamArrivalDelays(
    current: readonly FoyerEntranceChip[],
    additions: readonly FoyerEntranceChip[],
  ): FoyerEntranceChip[] {
    if (additions.length === 0) {
      return [];
    }

    const activeCurrent = current.filter((chip) => chip.teamId === null);
    let nextDelay =
      activeCurrent.length > 0
        ? Math.max(
            ...activeCurrent.map(
              (chip) => chip.delayMs + this.nonTeamArrivalPresentationStepMs(chip),
            ),
          )
        : 0;

    return additions.map((chip) => {
      const delayMs = nextDelay;
      nextDelay += this.nonTeamArrivalPresentationStepMs(chip);
      return { ...chip, delayMs };
    });
  }

  private nonTeamArrivalPresentationStepMs(
    chip: Pick<FoyerEntranceChip, 'enterDurationMs'>,
  ): number {
    return Math.max(
      FOYER_NON_TEAM_DELAY_STEP_MS,
      chip.enterDurationMs + FOYER_NON_TEAM_PRESENTATION_BUFFER_MS,
    );
  }

  private withKindergartenArrivalDelays(
    current: readonly FoyerEntranceChip[],
    additions: readonly FoyerEntranceChip[],
  ): FoyerEntranceChip[] {
    const activeCurrent = current.filter((chip) => chip.teamId !== null);
    let queueDepth = activeCurrent.length;
    let nextDelay =
      activeCurrent.length > 0
        ? Math.max(...activeCurrent.map((chip) => chip.delayMs)) +
          this.kindergartenArrivalMotionProfile(queueDepth).stepMs
        : 0;

    return additions.map((chip) => {
      const profile = this.kindergartenArrivalMotionProfile(queueDepth);
      const delayMs = nextDelay;
      nextDelay += profile.stepMs;
      queueDepth += 1;
      return {
        ...chip,
        delayMs,
        enterDurationMs: profile.enterDurationMs,
        presenceMs: profile.presenceMs,
        settleDelayMs: profile.settleDelayMs,
        badgeDelayMs: profile.badgeDelayMs,
        badgePresenceMs: profile.badgePresenceMs,
        pulseDelayMs: profile.pulseDelayMs,
      };
    });
  }

  private kindergartenArrivalMotionProfile(queueDepth: number): FoyerArrivalMotionProfile {
    if (queueDepth <= 0) {
      return {
        stepMs: FOYER_KINDERGARTEN_DELAY_STEP_MS,
        enterDurationMs: 2600,
        presenceMs: 5200,
        settleDelayMs: 1940,
        badgeDelayMs: 2140,
        badgePresenceMs: 2140,
        pulseDelayMs: 2780,
      };
    }

    if (queueDepth <= 2) {
      return {
        stepMs: 4800,
        enterDurationMs: 2360,
        presenceMs: 4700,
        settleDelayMs: 1760,
        badgeDelayMs: 1940,
        badgePresenceMs: 1880,
        pulseDelayMs: 2520,
      };
    }

    return {
      stepMs: 4100,
      enterDurationMs: 2080,
      presenceMs: 3980,
      settleDelayMs: 1520,
      badgeDelayMs: 1700,
      badgePresenceMs: 1560,
      pulseDelayMs: 2220,
    };
  }

  private nextFoyerLane(teamId: string | null): number {
    if (!teamId) {
      const lane = this.foyerGlobalLaneCursor % FOYER_LANE_COUNT;
      this.foyerGlobalLaneCursor += 1;
      return lane;
    }

    const cursor = this.foyerTeamLaneCursor.get(teamId) ?? 0;
    this.foyerTeamLaneCursor.set(teamId, cursor + 1);
    return cursor % FOYER_LANE_COUNT;
  }

  private scheduleFoyerArrivalCleanup(chipId: string, delayMs = 0): void {
    const existing = this.foyerArrivalTimers.get(chipId);
    if (existing) {
      clearTimeout(existing);
    }

    const chip = this.foyerArrivalChips().find((currentChip) => currentChip.id === chipId);
    const lifetimeMs = chip?.presenceMs ?? this.foyerChipLifetimeMs;

    const timer = setTimeout(() => {
      this.foyerArrivalChips.update((current) => current.filter((chip) => chip.id !== chipId));
      this.foyerArrivalTimers.delete(chipId);
    }, lifetimeMs + delayMs);

    this.foyerArrivalTimers.set(chipId, timer);
  }

  private scheduleTeamArrivalPulse(teamId: string | null, sequence: number, delayMs: number): void {
    if (!teamId) {
      return;
    }

    const timerKey = `${teamId}:${sequence}`;
    const existing = this.foyerTeamPulseTimers.get(timerKey);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.foyerTeamPulseTimers.delete(timerKey);
      this.foyerTeamPulseSequences.update((current) => ({ ...current, [teamId]: sequence }));

      const clearKey = `${teamId}:${sequence}:clear`;
      const existingClear = this.foyerTeamPulseClearTimers.get(clearKey);
      if (existingClear) {
        clearTimeout(existingClear);
      }

      const clearTimer = setTimeout(() => {
        this.foyerTeamPulseClearTimers.delete(clearKey);
        this.foyerTeamPulseSequences.update((current) => {
          if (current[teamId] !== sequence) {
            return current;
          }

          const next = { ...current };
          delete next[teamId];
          return next;
        });
      }, 980);

      this.foyerTeamPulseClearTimers.set(clearKey, clearTimer);
    }, delayMs);

    this.foyerTeamPulseTimers.set(timerKey, timer);
  }

  private scheduleTeamLandingEcho(teamId: string | null, sequence: number, delayMs: number): void {
    if (!teamId) {
      return;
    }

    const timerKey = `${teamId}:${sequence}`;
    const existing = this.landedTeamEchoTimers.get(timerKey);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.landedTeamEchoTimers.delete(timerKey);
      this.landedTeamEchoSequences.update((current) => ({ ...current, [teamId]: sequence }));

      const clearKey = `${teamId}:${sequence}:clear`;
      const clearTimer = setTimeout(() => {
        this.landedTeamEchoSequences.update((current) => {
          if (current[teamId] !== sequence) {
            return current;
          }

          const next = { ...current };
          delete next[teamId];
          return next;
        });
      }, 420);

      this.landedTeamEchoTimers.set(clearKey, clearTimer);
    }, delayMs);

    this.landedTeamEchoTimers.set(timerKey, timer);
  }

  private registerHiddenLobbyParticipants(
    participantIds: readonly string[],
    holdMs = this.foyerChipLifetimeMs,
  ): void {
    if (participantIds.length === 0) {
      return;
    }

    this.hiddenFoyerParticipantIds.update((current) => {
      const next = new Set(current);
      participantIds.forEach((participantId) => next.add(participantId));
      return next;
    });

    participantIds.forEach((participantId) => {
      const existing = this.hiddenLobbyParticipantTimers.get(participantId);
      if (existing) {
        clearTimeout(existing);
      }

      const timer = setTimeout(() => {
        this.hiddenFoyerParticipantIds.update((current) => {
          if (!current.has(participantId)) {
            return current;
          }
          const next = new Set(current);
          next.delete(participantId);
          return next;
        });
        this.hiddenLobbyParticipantTimers.delete(participantId);
      }, holdMs);

      this.hiddenLobbyParticipantTimers.set(participantId, timer);
    });
  }

  private clearFoyerArrivalState(): void {
    this.foyerArrivalTimers.forEach((timer) => clearTimeout(timer));
    this.foyerArrivalTimers.clear();
    this.foyerTeamPulseTimers.forEach((timer) => clearTimeout(timer));
    this.foyerTeamPulseTimers.clear();
    this.foyerTeamPulseClearTimers.forEach((timer) => clearTimeout(timer));
    this.foyerTeamPulseClearTimers.clear();
    this.landedTeamEchoTimers.forEach((timer) => clearTimeout(timer));
    this.landedTeamEchoTimers.clear();
    this.hiddenLobbyParticipantTimers.forEach((timer) => clearTimeout(timer));
    this.hiddenLobbyParticipantTimers.clear();
    this.foyerArrivalChips.set([]);
    this.foyerTeamPulseSequences.set({});
    this.landedTeamEchoSequences.set({});
    this.hiddenFoyerParticipantIds.set(new Set());
    this.foyerTeamDirections.set({});
    this.foyerGlobalLaneCursor = 0;
    this.foyerTeamLaneCursor.clear();
  }

  private syncCurrentQuestionForHost(next: HostCurrentQuestionDTO | null): void {
    const current = this.currentQuestionForHost();
    if (next === null && this.shouldRetainCurrentHostQuestion(current)) {
      return;
    }
    if (next !== null && this.quizStartQuestionPending()) {
      const currentQuestion = this.effectiveCurrentQuestionState();
      if (typeof currentQuestion !== 'number' || currentQuestion === next.order) {
        this.quizStartQuestionPending.set(false);
        this.clearHostQuestionDetailsRetry();
      }
    }
    if (this.isSameHostCurrentQuestion(current, next)) {
      return;
    }

    if (
      this.wordCloudFrozen() &&
      (current?.questionId !== next?.questionId || next?.type !== 'FREETEXT')
    ) {
      this.wordCloudFrozen.set(false);
      this.frozenWordCloudResponses.set(null);
    }

    this.currentQuestionForHost.set(next);
  }

  private syncHostVoteProgress(next: HostVoteProgressDTO | null): void {
    const current = this.hostVoteProgress();
    if (this.isSameHostVoteProgress(current, next)) {
      return;
    }
    this.hostVoteProgress.set(next);
  }

  private shouldRetainCurrentHostQuestion(current: HostCurrentQuestionDTO | null): boolean {
    if (!current) return false;
    const status = this.effectiveStatus();
    if (
      status !== 'QUESTION_OPEN' &&
      status !== 'ACTIVE' &&
      status !== 'RESULTS' &&
      status !== 'DISCUSSION'
    ) {
      return false;
    }
    const currentQuestion = this.effectiveCurrentQuestionState();
    if (currentQuestion === undefined) return true;
    return typeof currentQuestion === 'number'
      ? currentQuestion === current.order
      : currentQuestion !== null;
  }

  private isCurrentStatusUpdate(update: SessionStatusUpdate): boolean {
    const current = this.statusUpdate();
    return (
      current?.status === update.status &&
      current.currentQuestion === update.currentQuestion &&
      (current.currentRound ?? null) === (update.currentRound ?? null)
    );
  }

  private isSameParticipantsPayload(
    left: SessionParticipantsPayload | null,
    right: SessionParticipantsPayload | null,
  ): boolean {
    if (left === right) {
      return true;
    }
    if (!left || !right) {
      return false;
    }
    if (
      left.participantCount !== right.participantCount ||
      (left.connectedCount ?? null) !== (right.connectedCount ?? null)
    ) {
      return false;
    }

    const leftReady = left.readingReady;
    const rightReady = right.readingReady;
    if (!!leftReady !== !!rightReady) {
      return false;
    }
    if (
      leftReady &&
      rightReady &&
      (leftReady.connectedCount !== rightReady.connectedCount ||
        leftReady.readyCount !== rightReady.readyCount ||
        leftReady.allConnectedReady !== rightReady.allConnectedReady ||
        (leftReady.participantReady ?? null) !== (rightReady.participantReady ?? null))
    ) {
      return false;
    }

    if (left.participants.length !== right.participants.length) {
      return false;
    }

    for (let i = 0; i < left.participants.length; i += 1) {
      const current = left.participants[i];
      const next = right.participants[i];
      if (
        current.id !== next.id ||
        current.nickname !== next.nickname ||
        (current.teamId ?? null) !== (next.teamId ?? null) ||
        (current.teamName ?? null) !== (next.teamName ?? null)
      ) {
        return false;
      }
    }

    return true;
  }

  private isSameHostCurrentQuestion(
    left: HostCurrentQuestionDTO | null,
    right: HostCurrentQuestionDTO | null,
  ): boolean {
    if (left === right) {
      return true;
    }
    if (!left || !right) {
      return false;
    }
    if (
      left.questionId !== right.questionId ||
      left.order !== right.order ||
      (left.totalQuestions ?? null) !== (right.totalQuestions ?? null) ||
      left.text !== right.text ||
      left.type !== right.type ||
      left.difficulty !== right.difficulty ||
      (left.showQuestionTypeIndicators ?? true) !== (right.showQuestionTypeIndicators ?? true) ||
      (left.timer ?? null) !== (right.timer ?? null) ||
      (left.ratingMin ?? null) !== (right.ratingMin ?? null) ||
      (left.ratingMax ?? null) !== (right.ratingMax ?? null) ||
      (left.ratingLabelMin ?? null) !== (right.ratingLabelMin ?? null) ||
      (left.ratingLabelMax ?? null) !== (right.ratingLabelMax ?? null) ||
      (left.ratingAvg ?? null) !== (right.ratingAvg ?? null) ||
      (left.ratingCount ?? null) !== (right.ratingCount ?? null) ||
      (left.totalVotes ?? null) !== (right.totalVotes ?? null) ||
      (left.correctVoterCount ?? null) !== (right.correctVoterCount ?? null) ||
      (left.currentRound ?? null) !== (right.currentRound ?? null)
    ) {
      return false;
    }

    if (left.answers.length !== right.answers.length) {
      return false;
    }
    for (let i = 0; i < left.answers.length; i += 1) {
      const current = left.answers[i];
      const next = right.answers[i];
      if (
        current.id !== next.id ||
        current.text !== next.text ||
        current.isCorrect !== next.isCorrect
      ) {
        return false;
      }
    }

    const leftVoteDistribution = left.voteDistribution ?? [];
    const rightVoteDistribution = right.voteDistribution ?? [];
    if (leftVoteDistribution.length !== rightVoteDistribution.length) {
      return false;
    }
    for (let i = 0; i < leftVoteDistribution.length; i += 1) {
      const current = leftVoteDistribution[i];
      const next = rightVoteDistribution[i];
      if (
        current.id !== next.id ||
        current.text !== next.text ||
        current.isCorrect !== next.isCorrect ||
        current.voteCount !== next.voteCount ||
        current.votePercentage !== next.votePercentage
      ) {
        return false;
      }
    }

    if (!sameStringArray(left.freeTextResponses, right.freeTextResponses)) {
      return false;
    }

    if (!sameNumberRecord(left.ratingDistribution, right.ratingDistribution)) {
      return false;
    }

    return (
      JSON.stringify(left.peerInstructionSuggestion ?? null) ===
        JSON.stringify(right.peerInstructionSuggestion ?? null) &&
      JSON.stringify(left.roundComparison ?? null) ===
        JSON.stringify(right.roundComparison ?? null) &&
      JSON.stringify(left.numericHistogram ?? null) ===
        JSON.stringify(right.numericHistogram ?? null) &&
      JSON.stringify(left.numericStats ?? null) === JSON.stringify(right.numericStats ?? null) &&
      JSON.stringify(left.numericRoundComparison ?? null) ===
        JSON.stringify(right.numericRoundComparison ?? null) &&
      (left.numericToleranceMode ?? null) === (right.numericToleranceMode ?? null) &&
      (left.numericReferenceValue ?? null) === (right.numericReferenceValue ?? null) &&
      (left.numericTolerancePercent ?? null) === (right.numericTolerancePercent ?? null) &&
      (left.numericIntervalLeft ?? null) === (right.numericIntervalLeft ?? null) &&
      (left.numericIntervalRight ?? null) === (right.numericIntervalRight ?? null) &&
      (left.numericInputType ?? null) === (right.numericInputType ?? null) &&
      (left.numericDecimalPlaces ?? null) === (right.numericDecimalPlaces ?? null) &&
      (left.numericMin ?? null) === (right.numericMin ?? null) &&
      (left.numericMax ?? null) === (right.numericMax ?? null) &&
      (left.numericTwoRounds ?? false) === (right.numericTwoRounds ?? false) &&
      JSON.stringify(left.confidenceResult ?? null) ===
        JSON.stringify(right.confidenceResult ?? null)
    );
  }

  private isSameHostVoteProgress(
    left: HostVoteProgressDTO | null,
    right: HostVoteProgressDTO | null,
  ): boolean {
    if (left === right) {
      return true;
    }
    if (!left || !right) {
      return false;
    }
    return (
      left.questionId === right.questionId &&
      left.questionOrder === right.questionOrder &&
      left.round === right.round &&
      left.totalVotes === right.totalVotes &&
      (left.correctVoterCount ?? null) === (right.correctVoterCount ?? null) &&
      (left.incorrectVoterCount ?? null) === (right.incorrectVoterCount ?? null) &&
      JSON.stringify(left.peerInstructionSuggestion ?? null) ===
        JSON.stringify(right.peerInstructionSuggestion ?? null)
    );
  }

  /** i18n: Feedback rating count (singular). */
  feedbackRatingSingular(): string {
    return $localize`Bewertung`;
  }
  /** i18n: Feedback rating count (plural). */
  feedbackRatingPlural(): string {
    return $localize`Bewertungen`;
  }

  /** Wartetext Bewertungsfrage (Ergebnisse vor / Zeit abgelaufen / Warte auf Bewertungen). */
  ratingWaitingText(): string {
    if (this.allHaveVoted()) return $localize`Die Ergebnisse liegen vor.`;
    if (this.countdownEnded()) return $localize`Zeit abgelaufen.`;
    return $localize`Warte auf Bewertungen…`;
  }

  /** Wartetext Freitextfrage (Ergebnisse vor / Zeit abgelaufen / Warte auf Antworten). */
  freetextWaitingText(): string {
    if (this.allHaveVoted()) return $localize`Die Ergebnisse liegen vor.`;
    if (this.countdownEnded()) return $localize`Zeit abgelaufen.`;
    return $localize`Warte auf Antworten…`;
  }

  voteProgressCompactLabel(votes: number, participants: number): string {
    return $localize`${formatLocaleCount(votes, this.localeId)} von ${formatLocaleCount(participants, this.localeId)}`;
  }

  voteProgressAria(votes: number, participants: number, percentage: number): string {
    const formattedPercentage = formatLocaleCount(percentage, this.localeId);
    if (votes === 1) {
      return $localize`:@@sessionHost.voteProgressAriaOne:${formatLocaleCount(votes, this.localeId)}:votes: von ${formatLocaleCount(participants, this.localeId)}:participants: Teilnehmenden hat abgestimmt. ${formattedPercentage}:percentage: Prozent erreicht.`;
    }
    return $localize`:@@sessionHost.voteProgressAriaMany:${formatLocaleCount(votes, this.localeId)}:votes: von ${formatLocaleCount(participants, this.localeId)}:participants: Teilnehmenden haben abgestimmt. ${formattedPercentage}:percentage: Prozent erreicht.`;
  }

  /** Ergebnisansicht: „X von Y hat/haben abgestimmt“ (Plural nach Anzahl abgegebener Stimmen). */
  votesCastLabel(votes: number, participantTotal: number | null | undefined): string {
    const totalStr =
      participantTotal !== undefined && participantTotal !== null
        ? formatLocaleCount(participantTotal, this.localeId)
        : '?';
    const voteCount = formatLocaleCount(votes, this.localeId);
    if (votes === 1) {
      return $localize`:@@sessionHost.votesCastOne:${voteCount}:voteCount: von ${totalStr}:participantTotal: hat abgestimmt`;
    }
    return $localize`:@@sessionHost.votesCastMany:${voteCount}:voteCount: von ${totalStr}:participantTotal: haben abgestimmt`;
  }

  /** Bewertungsfrage Ergebnis: „X von Y hat/haben bewertet“. */
  ratingSubmittedLabel(count: number, participantTotal: number | null | undefined): string {
    const totalStr =
      participantTotal !== undefined && participantTotal !== null
        ? formatLocaleCount(participantTotal, this.localeId)
        : '?';
    const voteCount = formatLocaleCount(count, this.localeId);
    if (count === 1) {
      return $localize`:@@sessionHost.ratingSubmittedOne:${voteCount}:voteCount: von ${totalStr}:participantTotal: hat bewertet`;
    }
    return $localize`:@@sessionHost.ratingSubmittedMany:${voteCount}:voteCount: von ${totalStr}:participantTotal: haben bewertet`;
  }

  /** Multiple-Choice-Ergebnis: korrekt gewählte Antworten inkl. Prozent. */
  correctAllVotersLabel(correct: number, total: number): string {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return $localize`:@@sessionHost.correctAllVoters:${formatLocaleCount(correct, this.localeId)}:correctCount: von ${formatLocaleCount(total, this.localeId)}:voteTotal: komplett richtig (${formatLocaleCount(pct, this.localeId)}:percentage:\u00a0%)`;
  }

  opinionShiftChangedMindLabel(changed: number, both: number, pct: number): string {
    return $localize`:@@sessionHost.opinionShiftChangedMind:${formatLocaleCount(changed, this.localeId)}:changed: von ${formatLocaleCount(both, this.localeId)}:both: (${formatLocaleCount(pct, this.localeId)}:pct:\u00a0%) änderten ihre Meinung`;
  }

  opinionShiftWrongToCorrectLabel(count: number): string {
    return $localize`:@@sessionHost.opinionShiftWrongToCorrect:↑ ${count}:count: falsch → richtig`;
  }

  opinionShiftCorrectToWrongLabel(count: number): string {
    return $localize`:@@sessionHost.opinionShiftCorrectToWrong:↓ ${count}:count: richtig → falsch`;
  }

  /** aria-label für Gesamtbewertung (Sterne) auf der Abschlusskarte. */
  feedbackAverageStarsAria(avg: number): string {
    const formatted = formatNumber(avg, this.localeId, '1.1-1');
    return $localize`:@@sessionHost.feedbackAvgStarsAria:Durchschnitt ${formatted}:avg: von 5 Sternen`;
  }

  emojiReactionsTotalLabel(total: number): string {
    return total === 1 ? $localize`${total} Reaktion` : $localize`${total} Reaktionen`;
  }

  teamScoreBarWidth(totalScore: number): string {
    const max = this.teamLeaderboardMaxScore();
    const percentage = max <= 0 ? 0 : Math.max(10, Math.round((totalScore / max) * 100));
    return `${percentage}%`;
  }

  /** #n nur wenn die Team-Wertung Punkte hat; sonst Gedankenstrich (kein fiktiver Rang bei 0). */
  teamLeaderboardRankDisplay(rank: number): string {
    return this.teamScoreboardHasPoints() ? `#${rank}` : '\u2014';
  }

  private async refreshLobbyTeams(): Promise<void> {
    if (!this.session()?.teamMode) {
      this.lobbyTeams.set([]);
      return;
    }

    try {
      const payload = await trpc.session.getTeams.query({ code: this.code.toUpperCase() });
      this.lobbyTeams.set(payload.teams);
    } catch {
      // Subscription/polling can transiently fail; keep the last stable team list to avoid lobby flicker.
    }
  }

  private async refreshParticipantsPayload(): Promise<void> {
    if (!this.code) {
      this.participantsPayload.set(null);
      this.participantBaselineReady = false;
      this.knownParticipantIds.clear();
      this.clearFoyerArrivalState();
      return;
    }
    try {
      const payload = await trpc.session.getParticipants.query({ code: this.code.toUpperCase() });
      this.updateParticipantsPayload(payload, this.participantBaselineReady);
    } catch {
      // Subscription updates remain the primary live path; keep the last payload on transient failures.
    }
  }

  /** Lesbare Phasen-Beschreibung für Dozenten-Info und Publikum. */
  phaseLabel(
    status: SessionInfoDTO['status'] | null,
    allVoted = false,
    countdownEnded = false,
  ): string {
    if (!status) return '—';
    if (this.isQaSession()) {
      const labels: Record<SessionInfoDTO['status'], string> = {
        LOBBY: $localize`:@@sessionHost.phaseLobby:Lobby – Teilnehmende können beitreten`,
        QUESTION_OPEN: $localize`:@@sessionHost.phaseQaPreparing:Fragerunde wird vorbereitet`,
        ACTIVE: $localize`:@@sessionHost.phaseQaActive:Fragerunde läuft`,
        PAUSED: $localize`:@@sessionHost.phasePaused:Pausiert`,
        RESULTS: $localize`:@@sessionHost.phaseQaActive:Fragerunde läuft`,
        DISCUSSION: $localize`:@@sessionHost.phaseQaActive:Fragerunde läuft`,
        FINISHED: $localize`:@@sessionHost.phaseQaFinished:Fragerunde beendet`,
      };
      return labels[status] ?? status;
    }
    if (status === 'ACTIVE' && (allVoted || countdownEnded)) {
      return $localize`Abstimmung beendet – warte auf Auswertung`;
    }
    const labels: Record<SessionInfoDTO['status'], string> = {
      LOBBY: $localize`Lobby – Teilnehmende können beitreten`,
      QUESTION_OPEN: $localize`Lesephase – Antworten noch gesperrt`,
      ACTIVE: $localize`Abstimmung läuft`,
      PAUSED: $localize`Pausiert`,
      RESULTS: $localize`Ergebnisse werden angezeigt`,
      DISCUSSION: $localize`Diskussionsphase – Austausch vor zweiter Runde`,
      FINISHED: $localize`Session beendet`,
    };
    return labels[status] ?? status;
  }

  readingReadyProgressLabel(
    readyCount: number,
    connectedCount: number,
    totalParticipantCount: number,
  ): string {
    if (connectedCount >= totalParticipantCount) {
      return $localize`:@@sessionHost.readingReadyProgressAll:${readyCount}:readyCount: von ${connectedCount}:connectedCount: bereit`;
    }
    return $localize`${readyCount} von ${connectedCount} verbunden bereit · ${totalParticipantCount} insgesamt`;
  }

  readingReadyReleaseHint(connectedCount: number, totalParticipantCount: number): string {
    if (connectedCount >= totalParticipantCount) {
      return $localize`:@@sessionHost.readingReadyReleaseHintAll:Alle Teilnehmenden sind bereit – Antwortoptionen können freigegeben werden.`;
    }
    return $localize`:@@sessionHost.readingReadyReleaseHintConnected:Alle verbundenen Teilnehmenden sind bereit – Antwortoptionen können freigegeben werden.`;
  }

  effectiveCurrentQuestion(): number | null {
    return this.effectiveCurrentQuestionState() ?? null;
  }

  private effectiveCurrentQuestionState(): number | null | undefined {
    const statusUpdate = this.statusUpdate();
    if (statusUpdate && statusUpdate.currentQuestion !== undefined) {
      return statusUpdate.currentQuestion;
    }
    return this.session()?.currentQuestion;
  }

  /** True, wenn die aktuelle Frage die letzte ist – dann zeigt der Steuerungs-Button „Session beenden“. */
  isLastQuestion(): boolean {
    const q = this.displayedCurrentQuestionForHost();
    if (!q || q.totalQuestions === null || q.totalQuestions === undefined) return false;
    return q.order + 1 >= q.totalQuestions;
  }

  isFirstQuestion(): boolean {
    const q = this.displayedCurrentQuestionForHost();
    if (!q) return false;
    return q.order === 0;
  }

  /** Markdown + KaTeX für Frage- und Antworttexte (wie Quiz-Vorschau). */
  renderMarkdown(value: string): SafeHtml {
    const cached = this.markdownCache.get(value);
    if (cached) {
      return cached;
    }
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      decorateLeadingAnswerEmoji(
        renderMarkdownWithKatex(value, { imagePolicy: 'external-https-and-app-assets' }).html,
      ),
    );
    this.markdownCache.set(value, rendered);
    return rendered;
  }

  hostQuestionTypeLabel(type: HostCurrentQuestionDTO['type']): string {
    return questionTypeLabel(type);
  }

  hostQuestionTypeShowsDifficulty(type: HostCurrentQuestionDTO['type']): boolean {
    return type !== 'SURVEY' && type !== 'RATING';
  }

  numericHistogramBarHeight(bin: { count: number }, all: Array<{ count: number }>): number {
    if (bin.count <= 0) return 0;
    const maxCount = Math.max(1, ...all.map((b) => b.count));
    return Math.round(18 + (bin.count / maxCount) * 42);
  }

  numericHistogramBinPositionPercent(
    bin: { from: number; to: number },
    histogram: Array<{ from: number; to: number }>,
    stats?: NumericStatsDTO | null,
  ): number {
    const range = this.numericHistogramRange(histogram);
    if (!range) return 0;
    const markerValue = this.numericHistogramBinMarkerValue(bin, stats);
    return this.numericValuePositionPercent(markerValue ?? (bin.from + bin.to) / 2, range);
  }

  private numericHistogramBinMarkerValue(
    bin: { from: number; to: number; count?: number },
    stats?: NumericStatsDTO | null,
  ): number | null {
    if (!stats || !bin.count || stats.n <= 0) return null;
    if (stats.min === null || stats.max === null) return null;
    if (!Number.isFinite(stats.min) || !Number.isFinite(stats.max)) return null;
    if (Math.abs(stats.max - stats.min) > 1e-9) return null;

    const value = stats.min;
    const left = Math.min(bin.from, bin.to);
    const right = Math.max(bin.from, bin.to);
    return value >= left - 1e-9 && value <= right + 1e-9 ? value : null;
  }

  numericHistogramRangeEdgeLabel(
    question: HostCurrentQuestionDTO | null,
    histogram: Array<{ from: number; to: number }>,
    edge: 'min' | 'max',
  ): string {
    const range = this.numericHistogramRange(histogram);
    if (!range) return '';
    return this.formatNumericHostValue(edge === 'min' ? range.min : range.max, question);
  }

  numericHistogramBandStyle(
    question: HostCurrentQuestionDTO,
    histogram: Array<{ from: number; to: number }>,
  ): { left: number; width: number } | null {
    const band = this.numericToleranceBand(question);
    const range = this.numericHistogramRange(histogram);
    if (!band || !range) return null;
    const visibleLeft = Math.max(band.left, range.min);
    const visibleRight = Math.min(band.right, range.max);
    if (visibleLeft > range.max || visibleRight < range.min || visibleLeft > visibleRight) {
      return null;
    }
    const left = this.numericValuePositionPercent(visibleLeft, range);
    const right = this.numericValuePositionPercent(visibleRight, range);
    return { left, width: Math.max(1, right - left) };
  }

  numericReferenceLinePercent(
    question: HostCurrentQuestionDTO,
    histogram: Array<{ from: number; to: number }>,
  ): number | null {
    if (
      question.type !== 'NUMERIC_ESTIMATE' ||
      question.numericReferenceValue === null ||
      question.numericReferenceValue === undefined
    ) {
      return null;
    }
    const range = this.numericHistogramRange(histogram);
    if (!range) return null;
    if (question.numericReferenceValue < range.min || question.numericReferenceValue > range.max) {
      return null;
    }
    return this.numericValuePositionPercent(question.numericReferenceValue, range);
  }

  numericReferenceLineStyle(
    question: HostCurrentQuestionDTO,
    histogram: Array<{ from: number; to: number }>,
  ): { left: number } | null {
    const left = this.numericReferenceLinePercent(question, histogram);
    return left === null ? null : { left };
  }

  numericReferenceLabel(question: HostCurrentQuestionDTO): string | null {
    if (
      question.type !== 'NUMERIC_ESTIMATE' ||
      question.numericReferenceValue === null ||
      question.numericReferenceValue === undefined
    ) {
      return null;
    }
    return $localize`:@@sessionHost.numericReferenceAxisLabel:Referenz ${this.formatNumericHostValue(
      question.numericReferenceValue,
      question,
    )}:reference:`;
  }

  numericToleranceBandEdgeStyle(
    question: HostCurrentQuestionDTO,
    histogram: Array<{ from: number; to: number }>,
    edge: 'left' | 'right',
  ): { left: number } | null {
    const band = this.numericToleranceBand(question);
    const range = this.numericHistogramRange(histogram);
    if (!band || !range) return null;
    const value = edge === 'left' ? band.left : band.right;
    if (value < range.min || value > range.max) return null;
    return { left: this.numericValuePositionPercent(value, range) };
  }

  numericToleranceBandEdgeLabel(question: HostCurrentQuestionDTO, edge: 'left' | 'right'): string {
    const band = this.numericToleranceBand(question);
    if (!band) return '';
    if (this.numericHostUsesIntegerFormat(question)) {
      const acceptedLeft = Math.ceil(band.left);
      const acceptedRight = Math.floor(band.right);
      if (acceptedLeft <= acceptedRight) {
        return this.formatNumericHostValue(
          edge === 'left' ? acceptedLeft : acceptedRight,
          question,
        );
      }
    }
    return this.formatNumericHostValue(edge === 'left' ? band.left : band.right, question);
  }

  numericToleranceBandLabel(question: HostCurrentQuestionDTO): string | null {
    const band = this.numericToleranceBand(question);
    if (!band) return null;
    if (this.numericHostUsesIntegerFormat(question)) {
      const acceptedLeft = Math.ceil(band.left);
      const acceptedRight = Math.floor(band.right);
      if (acceptedLeft > acceptedRight) {
        return null;
      }
      if (acceptedLeft === acceptedRight) {
        return $localize`:@@sessionHost.numericAcceptedSingleLabel:Akzeptierter Wert ${this.formatNumericHostValue(
          acceptedLeft,
          question,
        )}:value:`;
      }
      return $localize`:@@sessionHost.numericAcceptedRangeLabel:Akzeptierte Werte ${this.formatNumericHostValue(
        acceptedLeft,
        question,
      )}:left: bis ${this.formatNumericHostValue(acceptedRight, question)}:right:`;
    }
    return $localize`:@@sessionHost.numericToleranceBandLabel:Toleranzband ${this.formatNumericHostValue(
      band.left,
      question,
    )}:left: bis ${this.formatNumericHostValue(band.right, question)}:right:`;
  }

  private numericToleranceBand(
    question: HostCurrentQuestionDTO,
  ): { left: number; right: number } | null {
    if (question.type !== 'NUMERIC_ESTIMATE') return null;
    return resolveNumericTolerance(
      resolveNumericEstimateToleranceMode(question.numericToleranceMode),
      {
        referenceValue: question.numericReferenceValue ?? null,
        tolerancePercent: question.numericTolerancePercent ?? null,
        intervalLeft: question.numericIntervalLeft ?? null,
        intervalRight: question.numericIntervalRight ?? null,
      },
    );
  }

  private numericHistogramRange(histogram: Array<{ from: number; to: number }>): {
    min: number;
    max: number;
  } | null {
    if (histogram.length === 0) return null;
    const min = Math.min(...histogram.map((bin) => Math.min(bin.from, bin.to)));
    const max = Math.max(...histogram.map((bin) => Math.max(bin.from, bin.to)));
    if (min === max) return { min: min - 0.5, max: max + 0.5 };
    return { min, max };
  }

  private numericValuePositionPercent(value: number, range: { min: number; max: number }): number {
    return Math.min(100, Math.max(0, ((value - range.min) / (range.max - range.min)) * 100));
  }

  private numericHostUsesIntegerFormat(question: HostCurrentQuestionDTO | null): boolean {
    return (
      question?.type === 'NUMERIC_ESTIMATE' &&
      (question.numericInputType === 'INTEGER' || question.numericDecimalPlaces === 0)
    );
  }

  private numericHostUsesYearFormat(question: HostCurrentQuestionDTO | null): boolean {
    if (!this.numericHostUsesIntegerFormat(question) || question?.type !== 'NUMERIC_ESTIMATE') {
      return false;
    }
    const textLooksLikeYear =
      /\b(jahr|jahreszahl|year|année|annee|año|ano|anno)\b/i.test(question.text) ||
      /\bwann\b/i.test(question.text);
    if (textLooksLikeYear) {
      return true;
    }
    const min = question.numericMin;
    const max = question.numericMax;
    return (
      typeof min === 'number' &&
      typeof max === 'number' &&
      min >= 1000 &&
      max <= 2200 &&
      max - min <= 1000
    );
  }

  private numericHostDigits(question: HostCurrentQuestionDTO | null): string {
    if (this.numericHostUsesIntegerFormat(question)) return '1.0-0';
    const places =
      question?.type === 'NUMERIC_ESTIMATE' &&
      typeof question.numericDecimalPlaces === 'number' &&
      Number.isFinite(question.numericDecimalPlaces)
        ? Math.max(0, Math.min(4, question.numericDecimalPlaces))
        : 2;
    return `1.0-${places}`;
  }

  private numericHostStatsDigits(question: HostCurrentQuestionDTO | null): string {
    return this.numericHostUsesIntegerFormat(question) ? '1.0-0' : '1.0-2';
  }

  private formatNumericHostStatValue(
    value: number,
    question: HostCurrentQuestionDTO | null,
  ): string {
    return this.formatNumericHostValue(value, question, this.numericHostStatsDigits(question));
  }

  private formatNumericHostValue(
    value: number,
    question: HostCurrentQuestionDTO | null,
    digits = this.numericHostDigits(question),
  ): string {
    if (this.numericHostUsesYearFormat(question)) {
      return this.formatNumberWithoutGrouping(value, digits);
    }
    return formatNumber(value, this.localeId, digits);
  }

  private formatNumberWithoutGrouping(value: number, digits: string): string {
    const match = /^(\d+)\.(\d+)-(\d+)$/.exec(digits);
    const minimumIntegerDigits = match ? Number(match[1]) : 1;
    const minimumFractionDigits = match ? Number(match[2]) : 0;
    const maximumFractionDigits = match ? Number(match[3]) : 2;
    return new Intl.NumberFormat(this.localeId, {
      minimumIntegerDigits,
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping: false,
    }).format(value);
  }

  numericStatsLabel(stats: NumericStatsDTO, question: HostCurrentQuestionDTO | null): string {
    const parts: string[] = [];
    parts.push(`n=${stats.n}`);
    if (stats.mean !== null) {
      parts.push(`Ø ${this.formatNumericHostStatValue(stats.mean, question)}`);
    }
    if (stats.median !== null) {
      parts.push(
        $localize`:@@sessionHost.numericMedian:Median ${this.formatNumericHostStatValue(stats.median, question)}:median:`,
      );
    }
    if (stats.stdDev !== null) {
      parts.push(`σ ${this.formatNumericHostStatValue(stats.stdDev, question)}`);
    }
    if (stats.iqr !== null) {
      parts.push(`IQR ${this.formatNumericHostStatValue(stats.iqr, question)}`);
    }
    if (stats.min !== null && stats.max !== null) {
      parts.push(
        `${this.formatNumericHostStatValue(stats.min, question)}–${this.formatNumericHostStatValue(
          stats.max,
          question,
        )}`,
      );
    }
    if (stats.inBandPercent !== null) {
      parts.push(`${formatNumber(stats.inBandPercent, this.localeId, '1.0-1')} % i. Band`);
    }
    if (stats.meanAbsoluteError !== null) {
      parts.push(`MAE ${this.formatNumericHostStatValue(stats.meanAbsoluteError, question)}`);
    }
    return parts.join(' · ');
  }

  numericStatsItems(
    stats: NumericStatsDTO,
    question: HostCurrentQuestionDTO | null,
  ): NumericStatsDisplayItem[] {
    const items: NumericStatsDisplayItem[] = [
      {
        id: 'count',
        label: $localize`:@@sessionHost.numericStatCountLabel:Schätzungen`,
        value: formatNumber(stats.n, this.localeId, '1.0-0'),
        caption: $localize`:@@sessionHost.numericStatCountCaption:gültige Antworten`,
      },
    ];
    if (stats.mean !== null) {
      items.push({
        id: 'mean',
        label: $localize`:@@sessionHost.numericStatMeanLabel:Mittelwert`,
        value: this.formatNumericHostStatValue(stats.mean, question),
        caption: $localize`:@@sessionHost.numericStatMeanCaption:Durchschnitt aller Schätzungen`,
      });
    }
    if (stats.median !== null) {
      items.push({
        id: 'median',
        label: $localize`:@@sessionHost.numericStatMedianLabel:Median`,
        value: this.formatNumericHostStatValue(stats.median, question),
        caption: $localize`:@@sessionHost.numericStatMedianCaption:Mitte der sortierten Werte`,
      });
    }
    if (stats.stdDev !== null) {
      items.push({
        id: 'stdDev',
        label: $localize`:@@sessionHost.numericStatStdDevLabel:Streuung`,
        value: this.formatNumericHostStatValue(stats.stdDev, question),
        caption: $localize`:@@sessionHost.numericStatStdDevCaption:Standardabweichung`,
      });
    }
    if (stats.q1 !== null && stats.q3 !== null && stats.iqr !== null) {
      items.push({
        id: 'middle50',
        label: $localize`:@@sessionHost.numericStatMiddle50Label:Mittlere 50 %`,
        value: `${this.formatNumericHostStatValue(stats.q1, question)}–${this.formatNumericHostStatValue(
          stats.q3,
          question,
        )}`,
        caption: $localize`:@@sessionHost.numericStatMiddle50Caption:Breite ${this.formatNumericHostStatValue(
          stats.iqr,
          question,
        )}:iqr:`,
      });
    }
    if (stats.min !== null && stats.max !== null) {
      items.push({
        id: 'range',
        label: $localize`:@@sessionHost.numericStatRangeLabel:Spanne`,
        value: `${this.formatNumericHostStatValue(stats.min, question)}–${this.formatNumericHostStatValue(
          stats.max,
          question,
        )}`,
        caption: $localize`:@@sessionHost.numericStatRangeCaption:kleinste bis größte Schätzung`,
      });
    }
    if (stats.inBandPercent !== null) {
      items.push({
        id: 'inBand',
        label: $localize`:@@sessionHost.numericStatInBandLabel:Im Band`,
        value: `${formatNumber(stats.inBandCount, this.localeId, '1.0-0')}/${formatNumber(
          stats.n,
          this.localeId,
          '1.0-0',
        )}`,
        caption: $localize`:@@sessionHost.numericStatInBandCaption:${formatNumber(
          stats.inBandPercent,
          this.localeId,
          '1.0-1',
        )}:percent: % akzeptiert`,
      });
    }
    if (stats.meanAbsoluteError !== null) {
      items.push({
        id: 'meanAbsoluteError',
        label: $localize`:@@sessionHost.numericStatMeanAbsoluteErrorLabel:Mittlerer Abstand`,
        value: this.formatNumericHostStatValue(stats.meanAbsoluteError, question),
        caption: $localize`:@@sessionHost.numericStatMeanAbsoluteErrorCaption:zur Referenz`,
      });
    }
    return items;
  }

  numericStatsPrimaryCaption(stats: NumericStatsDTO): string {
    if (stats.median !== null) {
      return $localize`:@@sessionHost.numericPrimaryMedian:Median`;
    }
    if (stats.mean !== null) {
      return $localize`:@@sessionHost.numericPrimaryMean:Mittelwert`;
    }
    return $localize`:@@sessionHost.numericPrimaryResponses:Schätzungen`;
  }

  numericStatsPrimaryValue(
    stats: NumericStatsDTO,
    question: HostCurrentQuestionDTO | null,
  ): string {
    if (stats.median !== null) {
      return this.formatNumericHostStatValue(stats.median, question);
    }
    if (stats.mean !== null) {
      return this.formatNumericHostStatValue(stats.mean, question);
    }
    return formatNumber(stats.n, this.localeId, '1.0-0');
  }

  numericStatsInBandValue(stats: NumericStatsDTO): string | null {
    if (stats.inBandPercent === null || stats.n <= 0) {
      return null;
    }
    return `${formatNumber(stats.inBandCount, this.localeId, '1.0-0')}/${formatNumber(
      stats.n,
      this.localeId,
      '1.0-0',
    )}`;
  }

  numericStatsInBandCaption(stats: NumericStatsDTO): string | null {
    if (stats.inBandPercent === null || stats.n <= 0) {
      return null;
    }
    return $localize`:@@sessionHost.numericInBandCaption:${formatNumber(
      stats.inBandPercent,
      this.localeId,
      '1.0-1',
    )}:percent: % im akzeptierten Bereich`;
  }

  numericStatsErrorValue(
    stats: NumericStatsDTO,
    question: HostCurrentQuestionDTO | null,
  ): string | null {
    if (stats.meanAbsoluteError === null) {
      return null;
    }
    return this.formatNumericHostStatValue(stats.meanAbsoluteError, question);
  }

  numericStatsErrorCaption(): string {
    return $localize`:@@sessionHost.numericMeanAbsoluteErrorCaption:Mittlerer Abstand zur Referenz`;
  }

  numericPairedInsightValue(
    paired: NonNullable<NumericRoundComparisonDTO['pairedAnalysis']>,
  ): string {
    return `${formatNumber(paired.closerCount, this.localeId, '1.0-0')}/${formatNumber(
      paired.pairedCount,
      this.localeId,
      '1.0-0',
    )}`;
  }

  numericPairedInsightCaption(): string {
    return $localize`:@@sessionHost.numericPairedInsightCaption:näher am Referenzwert`;
  }

  numericRoundDeltaValue(
    roundComparison: NumericRoundComparisonDTO,
    question: HostCurrentQuestionDTO | null,
  ): string | null {
    const delta = roundComparison.medianDelta ?? roundComparison.meanDelta;
    if (delta === null || delta === undefined) {
      return null;
    }
    const sign = delta > 0 ? '+' : '';
    return `${sign}${this.formatNumericHostStatValue(delta, question)}`;
  }

  numericRoundDeltaCaption(roundComparison: NumericRoundComparisonDTO): string {
    return roundComparison.medianDelta !== null && roundComparison.medianDelta !== undefined
      ? $localize`:@@sessionHost.numericMedianDeltaCaption:Median-Veränderung`
      : $localize`:@@sessionHost.numericMeanDeltaCaption:Mittelwert-Veränderung`;
  }

  numericRoundDeltaLabel(
    roundComparison: NumericRoundComparisonDTO,
    question: HostCurrentQuestionDTO | null = null,
  ): string {
    const parts: string[] = [];
    if (roundComparison.meanDelta !== null && roundComparison.meanDelta !== undefined) {
      const sign = roundComparison.meanDelta > 0 ? '+' : '';
      parts.push(
        $localize`:@@sessionHost.numericMeanDeltaReadable:Mittelwert ${sign}${this.formatNumericHostStatValue(
          roundComparison.meanDelta,
          question,
        )}:delta:`,
      );
    }
    if (roundComparison.medianDelta !== null && roundComparison.medianDelta !== undefined) {
      const sign = roundComparison.medianDelta > 0 ? '+' : '';
      parts.push(
        $localize`:@@sessionHost.numericMedianDelta:Median ${sign}${this.formatNumericHostStatValue(
          roundComparison.medianDelta,
          question,
        )}:medianDelta:`,
      );
    }
    if (
      roundComparison.inBandPercentDelta !== null &&
      roundComparison.inBandPercentDelta !== undefined
    ) {
      const sign = roundComparison.inBandPercentDelta > 0 ? '+' : '';
      parts.push(
        $localize`:@@sessionHost.numericInBandDeltaReadable:Im Band ${sign}${formatNumber(
          roundComparison.inBandPercentDelta,
          this.localeId,
          '1.0-1',
        )}:delta: Prozentpunkte`,
      );
    }
    return parts.join(' · ');
  }

  numericRoundInterpretation(
    roundComparison: NumericRoundComparisonDTO,
    question: HostCurrentQuestionDTO | null,
  ): string | null {
    const paired = roundComparison.pairedAnalysis;
    const parts: string[] = [];

    if (paired && paired.pairedCount > 0) {
      if (paired.closerCount > paired.fartherCount) {
        parts.push(
          $localize`:@@sessionHost.numericInterpretationRoundCloser:Runde 2 liegt näher am Referenzwert: ${formatNumber(
            paired.closerCount,
            this.localeId,
            '1.0-0',
          )}:closer: von ${formatNumber(
            paired.pairedCount,
            this.localeId,
            '1.0-0',
          )}:paired: vergleichbaren Schätzungen haben sich verbessert.`,
        );
      } else if (paired.fartherCount > paired.closerCount) {
        parts.push(
          $localize`:@@sessionHost.numericInterpretationRoundFarther:Runde 2 liegt nicht näher am Referenzwert: ${formatNumber(
            paired.fartherCount,
            this.localeId,
            '1.0-0',
          )}:farther: von ${formatNumber(
            paired.pairedCount,
            this.localeId,
            '1.0-0',
          )}:paired: vergleichbaren Schätzungen sind weiter entfernt.`,
        );
      } else {
        parts.push(
          $localize`:@@sessionHost.numericInterpretationRoundMixed:Runde 2 ist gemischt: näher und weiter entfernte Schätzungen halten sich im Paarvergleich die Waage.`,
        );
      }
    } else if (
      roundComparison.round1Stats.meanAbsoluteError !== null &&
      roundComparison.round2Stats.meanAbsoluteError !== null
    ) {
      const errorDelta =
        roundComparison.round2Stats.meanAbsoluteError -
        roundComparison.round1Stats.meanAbsoluteError;
      if (errorDelta < 0) {
        parts.push(
          $localize`:@@sessionHost.numericInterpretationErrorImproved:Der mittlere Abstand zur Referenz ist in Runde 2 um ${this.formatNumericHostStatValue(
            Math.abs(errorDelta),
            question,
          )}:delta: kleiner.`,
        );
      } else if (errorDelta > 0) {
        parts.push(
          $localize`:@@sessionHost.numericInterpretationErrorWorse:Der mittlere Abstand zur Referenz ist in Runde 2 um ${this.formatNumericHostStatValue(
            errorDelta,
            question,
          )}:delta: größer.`,
        );
      }
    }

    if (
      roundComparison.inBandPercentDelta !== null &&
      roundComparison.inBandPercentDelta !== undefined &&
      Math.abs(roundComparison.inBandPercentDelta) >= 0.05
    ) {
      const sign = roundComparison.inBandPercentDelta > 0 ? '+' : '';
      parts.push(
        $localize`:@@sessionHost.numericInterpretationInBandDelta:Akzeptierte Schätzungen: ${sign}${formatNumber(
          roundComparison.inBandPercentDelta,
          this.localeId,
          '1.0-1',
        )}:delta: Prozentpunkte.`,
      );
    }

    return parts.length > 0 ? parts.join(' ') : null;
  }

  numericStatsInterpretation(
    stats: NumericStatsDTO,
    question: HostCurrentQuestionDTO | null,
  ): string | null {
    if (stats.n <= 0) return null;
    const parts: string[] = [];
    if (stats.inBandPercent !== null) {
      parts.push(
        $localize`:@@sessionHost.numericInterpretationSingleInBand:${formatNumber(
          stats.inBandCount,
          this.localeId,
          '1.0-0',
        )}:inBand: von ${formatNumber(
          stats.n,
          this.localeId,
          '1.0-0',
        )}:total: Schätzungen liegen im Toleranzband.`,
      );
    }
    if (stats.meanAbsoluteError !== null) {
      parts.push(
        $localize`:@@sessionHost.numericInterpretationSingleError:Der mittlere Abstand zur Referenz beträgt ${this.formatNumericHostStatValue(
          stats.meanAbsoluteError,
          question,
        )}:error:.`,
      );
    } else if (stats.median !== null) {
      parts.push(
        $localize`:@@sessionHost.numericInterpretationSingleMedian:Der Median liegt bei ${this.formatNumericHostStatValue(
          stats.median,
          question,
        )}:median:.`,
      );
    }
    return parts.length > 0 ? parts.join(' ') : null;
  }

  private numericExportDetails(
    stats: NumericStatsDTO,
    roundComparison: NumericRoundComparisonDTO | undefined,
  ): string {
    const details = [this.numericStatsLabel(stats, null)];
    if (roundComparison) {
      const delta = this.numericRoundDeltaLabel(roundComparison);
      if (delta) details.push(delta);
      if (roundComparison.pairedAnalysis) {
        details.push(
          `Paare ${roundComparison.pairedAnalysis.pairedCount}: ${roundComparison.pairedAnalysis.closerCount} näher, ${roundComparison.pairedAnalysis.fartherCount} weiter, ${roundComparison.pairedAnalysis.unchangedCount} gleich`,
        );
      }
      if (roundComparison.deltaHistogram && roundComparison.deltaHistogram.length > 0) {
        details.push(
          `Δx ${roundComparison.deltaHistogram
            .map((bin) => `${bin.from}–${bin.to}: ${bin.count}`)
            .join(' | ')}`,
        );
      }
    }
    return details.join(' ; ');
  }

  hostDifficultyLabel(value: HostCurrentQuestionDTO['difficulty']): string {
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

  qaTabMetaLabel(): string | null {
    if (this.activeChannel() !== 'qa' && this.qaUnseenCount() > 0) {
      return $localize`:@@sessionTabs.questionsBadgeNew:${formatLocaleCount(this.qaUnseenCount(), this.localeId)}:count: neu`;
    }

    if (this.qaForumQuestionCount() > 0) {
      return formatLocaleCount(this.qaForumQuestionCount(), this.localeId);
    }

    return null;
  }

  quickFeedbackTabMetaLabel(): string | null {
    const result = this.quickFeedbackResult();
    if (!result) {
      return null;
    }

    if (this.activeChannel() !== 'quickFeedback' && this.quickFeedbackUnseenCount() > 0) {
      return $localize`:@@sessionTabs.questionsBadgeNew:${this.quickFeedbackUnseenCount()}:count: neu`;
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

  quickFeedbackTempoIndicator(): SessionChannelTempoIndicator | null {
    const result = this.quickFeedbackResult();
    if (result?.type !== 'TEMPO' || !result.tempoTrend) {
      return null;
    }

    const status = result.tempoTrend.status;
    let tone: SessionChannelTempoTone;

    if (status === 'FOLLOWING') {
      tone = 'good';
    } else if (status === 'TOO_FAST') {
      tone = 'caution';
    } else if (status === 'TOO_SLOW') {
      tone = 'caution';
    } else if (status === 'HETEROGENEOUS') {
      tone = 'caution';
    } else if (status === 'LOST') {
      tone = 'alert';
    } else {
      return null;
    }

    const icon = tempoTrendEmoji(status);
    return {
      tone,
      label: tempoTrendLabel(status),
      icon,
      compound: status === 'HETEROGENEOUS',
    };
  }

  showQuickFeedbackAnchorAction(): boolean {
    return this.activeChannel() === 'quickFeedback' && this.quickFeedbackResult() !== null;
  }

  quickFeedbackAnchorActionLabel(): string {
    return this.quickFeedbackResult()?.locked ? $localize`Fortsetzen` : $localize`Stopp`;
  }

  quickFeedbackAnchorActionIcon(): string {
    return this.quickFeedbackResult()?.locked ? 'play_arrow' : 'stop';
  }

  async toggleQuickFeedbackRoundLock(): Promise<void> {
    const result = this.quickFeedbackResult();
    if (
      this.activeChannel() !== 'quickFeedback' ||
      !result ||
      this.quickFeedbackActionPending() ||
      !this.code
    ) {
      return;
    }

    this.quickFeedbackActionPending.set(true);
    try {
      const next = await trpc.quickFeedback.toggleLock.mutate({
        sessionCode: this.code.toUpperCase(),
      });
      this.quickFeedbackResult.update((current) =>
        current ? { ...current, locked: next.locked } : current,
      );
      this.syncMusic();
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(
        () => void this.toggleQuickFeedbackRoundLock(),
      );
    } finally {
      this.quickFeedbackActionPending.set(false);
    }
  }

  channelTabMetaLabel(channel: SessionChannelTab): string | null {
    if (this.channelActivationPending() === channel) {
      return '...';
    }
    if (!this.channels()[channel]) {
      return $localize`:@@sessionTabs.channelInactive:Aus`;
    }
    if (!this.isChannelOpen(channel)) {
      return $localize`:@@sessionTabs.channelClosed:Zu`;
    }
    if (channel === 'qa') {
      return this.qaTabMetaLabel();
    }
    if (channel === 'quickFeedback') {
      return this.quickFeedbackTabMetaLabel();
    }
    return null;
  }

  channelTempoIndicator(channel: SessionChannelTab): SessionChannelTempoIndicator | null {
    if (channel !== 'quickFeedback' || !this.isChannelOpen(channel)) {
      return null;
    }
    return this.quickFeedbackTempoIndicator();
  }

  isChannelEnabled(channel: SessionChannelTab): boolean {
    return this.channels()[channel];
  }

  isChannelOpen(channel: SessionChannelTab): boolean {
    return this.channelOpenState()[channel];
  }

  isChannelBadgeAlert(channel: SessionChannelTab): boolean {
    if (!this.isChannelOpen(channel)) {
      return false;
    }
    if (channel === 'qa') {
      return this.activeChannel() !== 'qa' && this.qaUnseenCount() > 0;
    }
    if (channel === 'quickFeedback') {
      return this.activeChannel() !== 'quickFeedback' && this.quickFeedbackUnseenCount() > 0;
    }
    return false;
  }

  qaAuthorKindergartenBadgeLabel(question: QaQuestionDTO): string | null {
    const nickname = this.qaQuestionAuthorNickname(question);
    if (!nickname || this.session()?.nicknameTheme !== 'KINDERGARTEN') {
      return null;
    }
    return findKindergartenNicknameBadgeLabel(nickname);
  }

  qaAuthorKindergartenAriaLabel(question: QaQuestionDTO): string {
    const nickname = this.qaQuestionAuthorNickname(question);
    return nickname ? $localize`Frage von ${nickname}` : $localize`Frage aus dem Publikum`;
  }

  qaQuestionAuthorNickname(question: QaQuestionDTO): string | null {
    const nickname = question.authorNickname?.trim();
    return nickname ? nickname : null;
  }

  qaAuthorSelectionAriaLabel(question: QaQuestionDTO): string {
    const nickname = this.qaQuestionAuthorNickname(question);
    if (!nickname) {
      return this.qaAuthorKindergartenAriaLabel(question);
    }
    return this.qaSelectedAuthorNickname() === nickname
      ? $localize`Auswahl für ${nickname} aufheben`
      : $localize`Alle Fragen von ${nickname} hervorheben`;
  }

  toggleQaAuthorSelection(nickname: string | null | undefined): void {
    const trimmedNickname = nickname?.trim();
    if (!trimmedNickname) {
      return;
    }
    this.qaSelectedAuthorNickname.update((current) =>
      current === trimmedNickname ? null : trimmedNickname,
    );
  }

  clearQaAuthorSelection(): void {
    if (this.qaSelectedAuthorNickname() !== null) {
      this.qaSelectedAuthorNickname.set(null);
    }
  }

  isQaAuthorSelected(question: QaQuestionDTO): boolean {
    const selectedNickname = this.qaSelectedAuthorNickname();
    return (
      selectedNickname !== null && this.qaQuestionAuthorNickname(question) === selectedNickname
    );
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

  qaStatusIcon(status: QaQuestionDTO['status']): string {
    switch (status) {
      case 'PINNED':
        return 'push_pin';
      case 'PENDING':
        return 'hourglass_top';
      case 'ARCHIVED':
        return 'check_circle_outline';
      case 'DELETED':
        return 'delete_outline';
      default:
        return 'circle';
    }
  }

  onQaListScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.qaScrolledDown.set(el.scrollTop > 80);
  }

  scrollToQaTop(): void {
    this.scrollQaListToTop({ markSeen: true });
  }

  private scrollQaListToTop(options: { markSeen?: boolean } = {}): void {
    const el = this.qaListContainerRef?.nativeElement;
    if (el) {
      try {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        el.scrollTop = 0;
      }
    }
    this.qaScrolledDown.set(false);
    if (options.markSeen) {
      const allIds = new Set(this.qaQuestions().map((q) => q.id));
      this.qaSeenQuestionIds.set(allIds);
    }
  }

  private scrollHostTargetIntoView(targetRef: ElementRef<HTMLElement> | undefined): void {
    afterNextRender(
      () => {
        const target = targetRef?.nativeElement;
        const scrollingElement = (this.document.scrollingElement ??
          this.document.documentElement) as HTMLElement | null;
        if (target) {
          try {
            if (scrollingElement) {
              const rect = target.getBoundingClientRect();
              const marginTop =
                parseFloat(
                  this.document.defaultView?.getComputedStyle(target).scrollMarginTop ?? '0',
                ) || 0;
              const currentTop = scrollingElement.scrollTop ?? 0;
              const nextTop = Math.max(0, currentTop + rect.top - marginTop);
              scrollingElement.scrollTo({ top: nextTop, behavior: 'smooth' });
            } else {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          } catch {
            target.scrollIntoView();
          }
          return;
        }

        try {
          scrollingElement?.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          if (scrollingElement) {
            scrollingElement.scrollTop = 0;
          }
        }
      },
      { injector: this.injector },
    );
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

  qaActionLabel(
    action: 'APPROVE' | 'PIN' | 'UNPIN' | 'ARCHIVE' | 'DELETE',
    status?: QaQuestionDTO['status'],
  ): string {
    switch (action) {
      case 'APPROVE':
        return $localize`:@@sessionQa.actionApprove:Freigeben`;
      case 'PIN':
        return $localize`:@@sessionQa.actionPin:Hervorheben`;
      case 'UNPIN':
        return $localize`:@@sessionQa.actionUnpin:Hervorhebung aufheben`;
      case 'ARCHIVE':
        return $localize`:@@sessionQa.actionArchive:Archivieren`;
      case 'DELETE':
        return status === 'DELETED'
          ? $localize`:@@sessionQa.actionPurge:Endgültig entfernen`
          : $localize`:@@sessionQa.actionDelete:Löschen`;
    }
  }

  qaActionIcon(action: 'APPROVE' | 'PIN' | 'UNPIN' | 'ARCHIVE' | 'DELETE'): string {
    switch (action) {
      case 'APPROVE':
        return 'check';
      case 'PIN':
        return 'push_pin';
      case 'UNPIN':
        return 'push_pin';
      case 'ARCHIVE':
        return 'archive';
      case 'DELETE':
        return 'delete_outline';
    }
  }

  canModerateQaQuestion(
    question: QaQuestionDTO,
    action: 'APPROVE' | 'PIN' | 'UNPIN' | 'ARCHIVE' | 'DELETE',
  ): boolean {
    if (this.qaPendingQuestionIds().has(question.id)) {
      return false;
    }

    if (question.status === 'DELETED') {
      return action === 'DELETE';
    }

    switch (action) {
      case 'APPROVE':
        return question.status === 'PENDING' || question.status === 'ARCHIVED';
      case 'PIN':
        return question.status !== 'PINNED';
      case 'UNPIN':
        return question.status === 'PINNED';
      case 'ARCHIVE':
        return question.status !== 'ARCHIVED';
      case 'DELETE':
        return true;
    }
  }

  isQaQuestionHighlighted(questionId: string): boolean {
    return this.qaHighlightedQuestionIds().has(questionId);
  }

  qaQuestionScore(question: QaQuestionDTO): number {
    return question.score ?? question.upvoteCount;
  }

  qaWordCloudQuestionWeight(question: QaQuestionDTO): number {
    switch (this.qaSortMode()) {
      case 'BEST':
        return question.bestScore !== undefined
          ? this.capQaWordCloudNormalizedWeight(
              getWordCloudWeightFromNormalizedMetric(question.bestScore),
            )
          : getWordCloudWeightFromUpvotes(this.qaQuestionScore(question));
      case 'CONTROVERSIAL':
        return question.controversyScore !== undefined
          ? this.capQaWordCloudNormalizedWeight(
              getWordCloudWeightFromNormalizedMetric(question.controversyScore),
            )
          : getWordCloudWeightFromUpvotes(this.qaQuestionScore(question));
      default:
        return getWordCloudWeightFromUpvotes(this.qaQuestionScore(question));
    }
  }

  private capQaWordCloudNormalizedWeight(weight: number): number {
    return Math.min(QA_WORD_CLOUD_NORMALIZED_WEIGHT_CAP, Math.max(1, weight));
  }

  toggleQaWordCloudFreeze(): void {
    if (this.qaWordCloudFrozen()) {
      this.qaWordCloudFrozen.set(false);
      this.frozenQaWordCloudQuestions.set(null);
      return;
    }

    this.frozenQaWordCloudQuestions.set([...this.liveQaWordCloudQuestions()]);
    this.qaWordCloudFrozen.set(true);
  }

  formatQaPercent(value: number | undefined): string {
    if (!Number.isFinite(value)) {
      return '0 %';
    }

    return `${formatNumber((value ?? 0) * 100, this.localeId, '1.0-0')} %`;
  }

  formatCount(value: number | null | undefined): string {
    return formatLocaleCount(value ?? 0, this.localeId);
  }

  formatDecimal(value: number | null | undefined, maximumFractionDigits = 1): string {
    return formatLocaleNumber(value ?? 0, this.localeId, { maximumFractionDigits });
  }

  async setQaSortMode(mode: QaQuestionSortMode): Promise<void> {
    if (this.qaSortMode() === mode) {
      return;
    }

    this.qaSortMode.set(mode);
    this.ensureQaSubscription();
    await this.refreshQaQuestions();
    this.scrollQaListToTop();
  }

  setQaWordCloudAnalysisVariant(variant: WordCloudAnalysisVariant): void {
    const nextVariant =
      variant === 'THEME' && !this.qaWordCloudThemeModeAvailable() ? 'LEXICAL' : variant;

    if (nextVariant === this.qaWordCloudAnalysisVariant()) {
      return;
    }

    this.qaWordCloudAnalysisVariant.set(nextVariant);
  }

  async selectChannel(channel: string): Promise<void> {
    if (channel === 'quiz' || channel === 'qa' || channel === 'quickFeedback') {
      if (!this.isChannelEnabled(channel)) {
        if (channel === 'quiz') {
          await this.activateQuizChannel();
        } else {
          await this.enableChannel(channel);
        }
        return;
      }
      const prev = this.activeChannel();
      if (prev === 'qa' && channel !== 'qa') {
        this.qaTitleEditing.set(false);
      }
      this.activeChannel.set(channel);
      if (channel === 'qa') {
        this.qaTitleEditing.set(false);
        this.syncQaTitleDraftFromSession();
      }
      this.ensureActiveChannel();
      await this.syncPreferredLiveChannel(channel);
    }
  }

  private async activateQuizChannel(): Promise<void> {
    if (this.channelActivationPending() || !this.code) {
      return;
    }
    await this.startQuizSelectionFlow();
  }

  async replaceQuizBeforeStart(): Promise<void> {
    if (!this.canReplaceQuizBeforeStart()) {
      return;
    }
    await this.startQuizSelectionFlow();
  }

  private async startQuizSelectionFlow(): Promise<void> {
    if (this.channelActivationPending() || !this.code) {
      return;
    }

    const localQuizId = await this.chooseQuizForSession();
    if (!localQuizId) {
      return;
    }

    this.channelActivationPending.set('quiz');
    try {
      const payload = this.quizStore.getUploadPayload(localQuizId);
      const { quizId: uploadedQuizId } = await trpc.quiz.upload.mutate(payload);
      this.quizStore.setLastServerUploadAccess(
        localQuizId,
        uploadedQuizId,
        await createQuizHistoryAccessProof(payload),
      );
      await this.attachUploadedQuizToSession(uploadedQuizId);
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.startQuizSelectionFlow());
    } finally {
      this.channelActivationPending.set(null);
    }
  }

  private async attachUploadedQuizToSession(uploadedQuizId: string): Promise<void> {
    let attached = false;
    try {
      await trpc.session.attachQuizToSession.mutate({
        code: this.code.toUpperCase(),
        quizId: uploadedQuizId,
      });
      attached = true;
      await this.finalizeQuizChannelActivation();
      this.dismissHostSteeringCallout();
    } catch {
      const retry = attached
        ? () => void this.finalizeQuizChannelActivation()
        : () => void this.attachUploadedQuizToSession(uploadedQuizId);
      this.openHostSteeringCalloutForSteeringFailure(retry);
    }
  }

  private async finalizeQuizChannelActivation(): Promise<void> {
    await this.reloadSessionInfo();
    await this.refreshParticipantsPayload();
    await this.refreshLobbyTeams();
    await this.refreshCurrentQuestionForHost();
    await this.refreshQaQuestions();
    await this.refreshQuickFeedbackResult();
    this.activeChannel.set('quiz');
    this.ensureActiveChannel();
    await this.syncPreferredLiveChannel('quiz');
  }

  private async chooseQuizForSession(): Promise<string | undefined> {
    const quizzes = this.quizStore
      .quizzes()
      .filter((quiz) => this.isLocalQuizCompatibleWithSession(quiz.id));
    const dialogRef = this.dialog.open<
      SessionQuizPickerDialogComponent,
      SessionQuizPickerDialogData,
      string
    >(SessionQuizPickerDialogComponent, {
      width: '36rem',
      maxWidth: 'calc(100vw - 1.5rem)',
      autoFocus: false,
      panelClass: 'session-quiz-picker-dialog-panel',
      backdropClass: 'session-quiz-picker-dialog-backdrop',
      data: {
        quizzes,
        sessionProfile: this.getSessionOnboardingProfile(),
      },
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  private isLocalQuizCompatibleWithSession(localQuizId: string): boolean {
    const sessionProfile = this.getSessionOnboardingProfile();
    if (!sessionProfile) {
      return true;
    }
    const quiz = this.quizStore.getQuizById(localQuizId);
    if (!quiz) {
      return false;
    }
    return this.areOnboardingProfilesCompatible(sessionProfile, {
      nicknameTheme: quiz.settings.nicknameTheme,
      allowCustomNicknames: quiz.settings.allowCustomNicknames,
      anonymousMode: quiz.settings.anonymousMode,
      teamMode: quiz.settings.teamMode,
      teamCount: quiz.settings.teamMode ? quiz.settings.teamCount : null,
      teamAssignment: quiz.settings.teamMode ? quiz.settings.teamAssignment : 'AUTO',
      teamNames: quiz.settings.teamMode ? quiz.settings.teamNames : [],
    });
  }

  private getSessionOnboardingProfile(): SessionOnboardingProfile | null {
    const session = this.session();
    if (!session) {
      return null;
    }
    return {
      nicknameTheme: session.nicknameTheme ?? 'HIGH_SCHOOL',
      allowCustomNicknames: session.allowCustomNicknames ?? true,
      anonymousMode: session.anonymousMode === true,
      teamMode: session.teamMode === true,
      teamCount: session.teamMode ? (session.teamCount ?? 2) : null,
      teamAssignment: session.teamMode
        ? ((session.teamAssignment ?? 'AUTO') as TeamAssignment)
        : 'AUTO',
      teamNames: session.teamMode ? (session.teamNames ?? []) : [],
    };
  }

  private areOnboardingProfilesCompatible(
    sessionProfile: SessionOnboardingProfile,
    quizProfile: SessionOnboardingProfile,
  ): boolean {
    return sessionProfile.teamMode === quizProfile.teamMode;
  }

  private async enableChannel(
    channel: Extract<SessionChannelTab, 'qa' | 'quickFeedback'>,
  ): Promise<void> {
    if (this.channelActivationPending() || !this.code) {
      return;
    }

    this.channelActivationPending.set(channel);
    try {
      const channels =
        channel === 'qa'
          ? await trpc.session.enableQaChannel.mutate({ code: this.code.toUpperCase() })
          : await trpc.session.enableQuickFeedbackChannel.mutate({ code: this.code.toUpperCase() });
      this.patchSessionChannels(channels);
      if (channel === 'qa') {
        this.syncQaTitleDraftFromSession();
        await this.refreshQaQuestions();
      } else {
        await this.refreshQuickFeedbackResult();
      }
      this.activeChannel.set(channel);
      this.ensureActiveChannel();
      await this.syncPreferredLiveChannel(channel);
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.enableChannel(channel));
    } finally {
      this.channelActivationPending.set(null);
    }
  }

  private async syncPreferredLiveChannel(channel: SessionChannelTab): Promise<void> {
    if (!this.code || !this.isChannelEnabled(channel)) {
      return;
    }
    try {
      await trpc.session.setPreferredLiveChannel.mutate({
        code: this.code.toUpperCase(),
        channel,
      });
    } catch {
      // Der Host bleibt lokal bedienbar; bei nächstem gültigen Kanalwechsel erneut versuchen.
    }
  }

  private patchSessionChannels(channels: SessionChannelsDTO): void {
    this.session.update((session) => (session ? { ...session, channels } : session));
  }

  activeChannelVisibilityActionLabel(): string | null {
    const active = this.activeChannel();
    if (active !== 'qa' && active !== 'quickFeedback') {
      return null;
    }
    if (!this.isChannelEnabled(active)) {
      return null;
    }
    return this.isChannelOpen(active)
      ? $localize`:@@sessionTabs.closeChannelAction:Kanal schließen`
      : $localize`:@@sessionTabs.reopenChannelAction:Kanal wieder öffnen`;
  }

  activeChannelVisibilityIcon(): string {
    const active = this.activeChannel();
    if (active !== 'qa' && active !== 'quickFeedback') {
      return 'visibility';
    }
    return this.isChannelOpen(active) ? 'visibility_off' : 'visibility';
  }

  async toggleActiveChannelOpen(): Promise<void> {
    const active = this.activeChannel();
    if (active !== 'qa' && active !== 'quickFeedback') {
      return;
    }
    if (this.channelVisibilityPending() || !this.isChannelEnabled(active) || !this.code) {
      return;
    }

    this.channelVisibilityPending.set(active);
    try {
      const channels =
        active === 'qa'
          ? this.isChannelOpen(active)
            ? await trpc.session.closeQaChannel.mutate({ code: this.code.toUpperCase() })
            : await trpc.session.reopenQaChannel.mutate({ code: this.code.toUpperCase() })
          : this.isChannelOpen(active)
            ? await trpc.session.closeQuickFeedbackChannel.mutate({ code: this.code.toUpperCase() })
            : await trpc.session.reopenQuickFeedbackChannel.mutate({
                code: this.code.toUpperCase(),
              });
      this.patchSessionChannels(channels);
      if (active === 'qa') {
        await this.refreshQaQuestions();
      } else {
        await this.refreshQuickFeedbackResult();
      }
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.toggleActiveChannelOpen());
    } finally {
      this.channelVisibilityPending.set(null);
    }
  }

  private ensureQaSubscription(): void {
    const sessionId = this.session()?.id ?? null;
    const qaEnabled = this.channels().qa;
    const sortMode = this.qaSortMode();
    const subscriptionKey = sessionId ? `${sessionId}:${sortMode}` : null;
    if (!sessionId || !qaEnabled) {
      this.qaSub?.unsubscribe();
      this.qaSub = null;
      this.qaSubscriptionKey = null;
      return;
    }

    if (this.qaSub && this.qaSubscriptionKey === subscriptionKey) {
      return;
    }

    this.qaSub?.unsubscribe();
    this.qaSub = trpc.qa.onQuestionsUpdated.subscribe(
      { sessionId, moderatorView: true, sort: sortMode },
      {
        onData: (data) => {
          this.qaQuestions.set(data);
          this.dismissHostSteeringCallout();
        },
        onError: () => this.burstHostFallbackAfterWsGap(),
      },
    );
    this.qaSubscriptionKey = subscriptionKey;
  }

  private syncQaTitleDraftFromSession(): void {
    this.qaTitleDraft.set(this.session()?.channels?.qa?.title ?? '');
  }

  startQaTitleEdit(): void {
    this.syncQaTitleDraftFromSession();
    this.qaTitleEditing.set(true);
    afterNextRender(
      () => {
        const el = this.qaTitleInputRef?.nativeElement;
        el?.focus();
        el?.select();
      },
      { injector: this.injector },
    );
  }

  cancelQaTitleEdit(): void {
    this.syncQaTitleDraftFromSession();
    this.qaTitleEditing.set(false);
  }

  onQaTitleInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.saveQaHostTitle();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelQaTitleEdit();
    }
  }

  async saveQaHostTitle(): Promise<void> {
    if (this.qaTitleSaveDisabled() || !this.code) {
      return;
    }
    this.qaTitleSaving.set(true);
    try {
      const result = await trpc.session.updateQaTitle.mutate({
        code: this.code.toUpperCase(),
        qaTitle: this.qaTitleDraft().trim() || undefined,
      });
      const displayTitle = result.qaTitle ?? result.title ?? null;
      this.session.update((s) => {
        if (!s?.channels) return s;
        return {
          ...s,
          title:
            s.type === 'Q_AND_A' || (s.channels.quiz.enabled === false && s.channels.qa.enabled)
              ? result.title
              : s.title,
          channels: {
            ...s.channels,
            qa: { ...s.channels.qa, title: displayTitle },
          },
        };
      });
      this.syncQaTitleDraftFromSession();
      this.qaTitleEditing.set(false);
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForQaFailure(() => void this.saveQaHostTitle());
    } finally {
      this.qaTitleSaving.set(false);
    }
  }

  async startSessionFlow(): Promise<void> {
    if (this.activeChannel() === 'qa' && this.channels().qa) {
      await this.startQa();
      return;
    }

    await this.nextQuestion();
  }

  async nextQuestion(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    this.hostDisplayMode.setPreferImmersiveHost(true);
    const startingQuizFromLobby =
      this.effectiveStatus() === 'LOBBY' && this.channels().quiz && !this.isQaSession();
    if (startingQuizFromLobby) {
      this.clearFoyerArrivalState();
      this.quizStartQuestionPending.set(true);
    }
    try {
      this.clearEmojiNewBadge();
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.nextQuestion.mutate({
        code: this.code.toUpperCase(),
        ...(this.skipCurrentResultQuestionOnNext() && { skipCurrentResultQuestion: true }),
      });
      if (startingQuizFromLobby && typeof result.currentQuestion !== 'number') {
        this.quizStartQuestionPending.set(false);
        this.clearHostQuestionDetailsRetry();
      }
      this.clearFoyerArrivalStateWhenLeavingLobby(result.status);
      this.statusUpdate.set(result);
      this.steppedBackToPreviousResult.set(false);
      this.skipCurrentResultQuestionOnNext.set(false);
      this.syncCountdownFromStatusUpdate(result);
      this.dismissHostSteeringCallout();
      this.controlPending.set(false);
      await this.refreshCurrentQuestionForHost();
      if (!this.finishQuizStartQuestionPendingIfReady()) {
        this.scheduleHostQuestionDetailsRetry();
      }
      if (!this.isCurrentStatusUpdate(result)) return;
      if (result.status === 'ACTIVE') {
        const refreshedTimer = this.displayedCurrentQuestionForHost()?.timer;
        if (refreshedTimer !== undefined || result.timer !== undefined) {
          this.startCountdown(refreshedTimer ?? result.timer, result.activeAt);
        }
      }
    } catch {
      this.quizStartQuestionPending.set(false);
      this.clearHostQuestionDetailsRetry();
      this.openHostSteeringCalloutForSteeringFailure(() => void this.nextQuestion());
    } finally {
      this.controlPending.set(false);
    }
  }

  async prevQuestion(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      const result = await trpc.session.prevQuestion.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      this.steppedBackToPreviousResult.set(true);
      this.skipCurrentResultQuestionOnNext.set(true);
      this.dismissHostSteeringCallout();
      this.controlPending.set(false);
      await this.refreshCurrentQuestionForHost();
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.prevQuestion());
    } finally {
      this.controlPending.set(false);
    }
  }

  async startQa(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      const result = await trpc.session.startQa.mutate({ code: this.code.toUpperCase() });
      this.clearFoyerArrivalStateWhenLeavingLobby(result.status);
      this.statusUpdate.set(result);
      this.syncCurrentQuestionForHost(null);
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.startQa());
    } finally {
      this.controlPending.set(false);
    }
  }

  private ensureActiveChannel(): void {
    const available = this.availableChannels();
    if (available.length === 0) {
      return;
    }

    const active = this.activeChannel();
    const visible = this.visibleChannels();
    if (!this.isChannelEnabled(active) && visible.length > 0) {
      this.activeChannel.set(visible[0]!);
      return;
    }

    if (!available.includes(active)) {
      this.activeChannel.set(available[0]!);
      return;
    }

    const urlTab = this.requestedInitialTab;
    if (
      !this.initialUrlTabApplied &&
      (urlTab === 'qa' || urlTab === 'quickFeedback') &&
      this.visibleChannels().includes(urlTab)
    ) {
      if (active !== urlTab) {
        this.activeChannel.set(urlTab);
      }
      this.initialUrlTabApplied = true;
    }
  }

  private setsEqual<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean {
    if (left.size !== right.size) {
      return false;
    }
    for (const value of left) {
      if (!right.has(value)) {
        return false;
      }
    }
    return true;
  }

  private async refreshQaQuestions(): Promise<void> {
    const sessionId = this.session()?.id;
    if (!sessionId || !this.channels().qa) {
      this.qaQuestions.set([]);
      return;
    }

    try {
      const questions = await trpc.qa.list.query({
        sessionId,
        moderatorView: true,
        sort: this.qaSortMode(),
      });
      this.qaQuestions.set(questions);
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForQaFailure(() => void this.refreshQaQuestions());
    }
  }

  private buildQaWordCloudAnalysisRequest(
    variant: WordCloudAnalysisVariant = this.qaWordCloudEffectiveAnalysisVariant(),
  ): AnalyzeWordCloudInput | null {
    if (variant !== 'THEME' || !this.qaWordCloudDialogOpen()) {
      return null;
    }

    const locale = this.qaWordCloudAnalysisLocale();
    if (!locale) {
      return null;
    }

    const items = this.qaWordCloudQuestions().map((question) => ({
      id: question.id,
      text: question.text,
      weight: this.qaWordCloudQuestionWeight(question),
    }));
    if (items.length === 0) {
      return null;
    }

    return {
      sessionCode: this.code.toUpperCase(),
      mode: 'THEME',
      locale,
      metric: this.qaSortMode(),
      items,
      maxEntries: 40,
    };
  }

  private queueQaWordCloudThemeAnalysis(request: AnalyzeWordCloudInput): void {
    const requestKey = JSON.stringify(request);
    if (requestKey === this.lastQaWordCloudAnalysisRequestKey) {
      return;
    }

    this.lastQaWordCloudAnalysisRequestKey = requestKey;
    this.clearQaWordCloudThemeAnalysisTimer();
    this.qaWordCloudThemeAnalysisTimer = setTimeout(() => {
      this.qaWordCloudThemeAnalysisTimer = null;
      void this.refreshQaWordCloudThemeAnalysis(request);
    }, QA_WORD_CLOUD_ANALYSIS_DEBOUNCE_MS);
  }

  private clearQaWordCloudThemeAnalysisTimer(): void {
    if (!this.qaWordCloudThemeAnalysisTimer) {
      return;
    }

    clearTimeout(this.qaWordCloudThemeAnalysisTimer);
    this.qaWordCloudThemeAnalysisTimer = null;
  }

  private async refreshQaWordCloudThemeAnalysis(request: AnalyzeWordCloudInput): Promise<void> {
    const runId = ++this.qaWordCloudThemeAnalysisRunId;
    this.qaWordCloudThemeAnalysisResult.set(null);
    this.qaWordCloudThemeAnalysisPending.set(true);

    try {
      const result = await trpc.wordCloud.analyze.mutate(request);
      if (runId !== this.qaWordCloudThemeAnalysisRunId) {
        return;
      }

      this.qaWordCloudThemeAnalysisResult.set(result);
      this.qaWordCloudThemeFallbackActive.set(result.fallbackUsed);
    } catch {
      if (runId !== this.qaWordCloudThemeAnalysisRunId) {
        return;
      }

      this.qaWordCloudThemeAnalysisResult.set(null);
      this.qaWordCloudThemeFallbackActive.set(true);
    } finally {
      if (runId === this.qaWordCloudThemeAnalysisRunId) {
        this.qaWordCloudThemeAnalysisPending.set(false);
      }
    }
  }

  private async refreshQuickFeedbackResult(): Promise<void> {
    if (!this.channels().quickFeedback || this.code.length !== 6) {
      this.quickFeedbackResult.set(null);
      this.quickFeedbackSeenVoteCount.set(0);
      return;
    }

    try {
      const result = await trpc.quickFeedback.hostResults.query({
        sessionCode: this.code.toUpperCase(),
      });
      this.quickFeedbackResult.set(result);
    } catch {
      // Keep the last snapshot visible during transient polling failures.
    }
  }

  async toggleQaModeration(): Promise<void> {
    const current = this.session()?.channels?.qa?.moderationMode ?? false;
    try {
      const result = await trpc.qa.toggleModeration.mutate({
        sessionCode: this.code.toUpperCase(),
        enabled: !current,
      });
      this.session.update((s) => {
        if (!s || !s.channels) return s;
        return {
          ...s,
          channels: { ...s.channels, qa: { ...s.channels.qa, moderationMode: result.enabled } },
        };
      });
      this.qaInfo.set(
        result.enabled
          ? $localize`:@@sessionQa.moderationEnabled:Vorab-Moderation aktiviert.`
          : $localize`:@@sessionQa.moderationDisabled:Vorab-Moderation deaktiviert.`,
      );
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForQaFailure(() => void this.toggleQaModeration());
    }
  }

  async moderateQaQuestion(
    questionId: string,
    action: 'APPROVE' | 'PIN' | 'ARCHIVE' | 'DELETE',
  ): Promise<void> {
    if (!this.code) {
      return;
    }

    const pending = new Set(this.qaPendingQuestionIds());
    if (pending.has(questionId)) {
      return;
    }
    pending.add(questionId);
    this.qaPendingQuestionIds.set(pending);
    this.qaInfo.set(null);

    try {
      await trpc.qa.moderate.mutate({
        sessionCode: this.code.toUpperCase(),
        questionId,
        action,
      });
      await this.refreshQaQuestions();
      this.qaInfo.set(
        action === 'APPROVE'
          ? $localize`:@@sessionQa.moderationApproved:Frage freigegeben.`
          : action === 'PIN'
            ? $localize`:@@sessionQa.moderationPinned:Frage hervorgehoben.`
            : action === 'ARCHIVE'
              ? $localize`:@@sessionQa.moderationArchived:Frage archiviert.`
              : $localize`:@@sessionQa.moderationDeleted:Frage entfernt.`,
      );
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForQaFailure(
        () => void this.moderateQaQuestion(questionId, action),
      );
    } finally {
      const remaining = new Set(this.qaPendingQuestionIds());
      remaining.delete(questionId);
      this.qaPendingQuestionIds.set(remaining);
    }
  }

  async revealAnswers(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.clearEmojiNewBadge();
      const initialTimer = this.currentQuestionForHost()?.timer;
      const result = await trpc.session.revealAnswers.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      const timerForCountdown =
        result.timer === undefined
          ? (initialTimer ?? this.displayedCurrentQuestionForHost()?.timer)
          : result.timer;
      this.startCountdown(timerForCountdown, result.activeAt);
      this.dismissHostSteeringCallout();
      this.controlPending.set(false);
      await this.refreshCurrentQuestionForHost();
      if (!this.isCurrentStatusUpdate(result)) return;
      if (result.timer === undefined && initialTimer === undefined) {
        this.startCountdown(this.displayedCurrentQuestionForHost()?.timer, result.activeAt);
      }
      this.scrollHostTargetIntoView(this.hostAnswersListRef);
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.revealAnswers());
    } finally {
      this.controlPending.set(false);
    }
  }

  async revealResults(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.clearEmojiNewBadge();
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.revealResults.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      this.dismissHostSteeringCallout();
      this.controlPending.set(false);
      await this.refreshCurrentQuestionForHost();
      if (!this.isCurrentStatusUpdate(result)) return;
      this.scrollHostTargetIntoView(this.hostResultsSectionRef);
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.revealResults());
    } finally {
      this.controlPending.set(false);
    }
  }

  async startDiscussion(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.clearEmojiNewBadge();
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.startDiscussion.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      this.dismissHostSteeringCallout();
      this.controlPending.set(false);
      await this.refreshCurrentQuestionForHost();
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.startDiscussion());
    } finally {
      this.controlPending.set(false);
    }
  }

  async startSecondRound(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.clearEmojiNewBadge();
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.startSecondRound.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      this.dismissHostSteeringCallout();
      this.controlPending.set(false);
      await this.refreshCurrentQuestionForHost();
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.startSecondRound());
    } finally {
      this.controlPending.set(false);
    }
  }

  async refreshEmojiReactions(): Promise<void> {
    if (
      (this.effectiveStatus() !== 'RESULTS' && this.effectiveStatus() !== 'ACTIVE') ||
      !this.session()?.enableEmojiReactions
    ) {
      this.emojiReactions.set(null);
      return;
    }
    const sid = this.session()?.id;
    const qHost = this.displayedCurrentQuestionForHost();
    const qid = qHost?.questionId;
    const round = qHost?.currentRound ?? 1;
    if (!sid || !qid) {
      this.emojiReactions.set(null);
      this.clearEmojiNewBadge();
      this.lastEmojiReactionScope = '';
      return;
    }
    const scope = `${qid}:r${round}`;
    if (this.lastEmojiReactionScope !== scope) {
      this.lastEmojiReactionScope = scope;
      this.clearEmojiNewBadge();
    }
    try {
      const previousTotal = this.emojiReactions()?.total ?? 0;
      const data = await trpc.session.getReactions.query({
        sessionId: sid,
        questionId: qid,
        round,
      });
      this.emojiReactions.set(data);
      const delta = data.total - previousTotal;
      if (delta > 0) {
        this.emojiNewCount.update((count) => count + delta);
        this.emojiBadgePulse.set(true);
        if (this.emojiPulseTimer) {
          clearTimeout(this.emojiPulseTimer);
        }
        this.emojiPulseTimer = setTimeout(() => {
          this.emojiBadgePulse.set(false);
          this.emojiPulseTimer = null;
        }, 700);
      }
    } catch {
      this.emojiReactions.set(null);
      this.clearEmojiNewBadge();
    }
  }

  private clearEmojiNewBadge(): void {
    this.emojiNewCount.set(0);
    this.emojiBadgePulse.set(false);
    if (this.emojiPulseTimer) {
      clearTimeout(this.emojiPulseTimer);
      this.emojiPulseTimer = null;
    }
  }

  async loadLeaderboard(): Promise<void> {
    if (!this.code || this.leaderboardLoading()) return;
    this.leaderboardLoading.set(true);
    try {
      const entries = await trpc.session.getLeaderboard.query({ code: this.code.toUpperCase() });
      this.leaderboard.set(entries);
      const teamEntries = await trpc.session.getTeamLeaderboard.query({
        code: this.code.toUpperCase(),
      });
      this.teamLeaderboard.set(teamEntries);
    } catch {
      this.leaderboard.set([]);
      this.teamLeaderboard.set([]);
    } finally {
      this.leaderboardLoading.set(false);
    }
    if (this.effectiveStatus() === 'FINISHED') {
      void this.loadFeedbackSummary();
    }
  }

  async loadFinishedConfidenceSummary(): Promise<void> {
    if (!this.code) return;
    try {
      const summary = await trpc.session.getSessionConfidenceSummary.query({
        code: this.code.toUpperCase(),
      });
      this.finishedConfidenceSummary.set(summary);
    } catch {
      this.finishedConfidenceSummary.set(null);
    }
  }

  async loadFeedbackSummary(): Promise<void> {
    if (!this.code) return;
    try {
      const summary = await trpc.session.getSessionFeedbackSummary.query({
        code: this.code.toUpperCase(),
      });
      if (summary.totalResponses > 0) {
        this.feedbackSummary.set(summary);
      }
    } catch {
      /* noop */
    }
  }

  async exportSessionResultsCsv(): Promise<void> {
    if (!this.code || this.exportExporting()) return;
    this.exportStatus.set(null);
    this.exportExporting.set(true);
    try {
      const data = await trpc.session.getExportData.query({ code: this.code.toUpperCase() });
      const rows: string[] = [
        $localize`:@@sessionHost.exportQuestionsHeader:Frage Nr.;Fragentext;Typ;Teilnehmende;Aggregationsrunde;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Risiko;Fragil;Erkannte Wissenslücke;Unentschieden;Stärkstes Signal;Details`,
      ];

      for (const q of data.questions) {
        let details = '';
        if (q.optionDistribution) {
          details = q.optionDistribution
            .map(
              (o) =>
                `${stripMarkdownToPlainText(o.text)}: ${o.count} (${o.percentage}%)${o.isCorrect ? ' ✓' : ''}`,
            )
            .join(' | ');
        } else if (q.freetextAggregates) {
          details = q.freetextAggregates
            .map((f) => `${stripMarkdownToPlainText(f.text)}: ${f.count}`)
            .join(' | ');
        } else if (q.ratingDistribution) {
          details = Object.entries(q.ratingDistribution)
            .map(([k, v]) => `${k}★: ${v}`)
            .join(' | ');
          if (q.ratingAverage !== null && q.ratingAverage !== undefined)
            details += ` (Ø ${q.ratingAverage})`;
        } else if (q.numericStats) {
          details = this.numericExportDetails(q.numericStats, q.numericRoundComparison);
        }

        if (q.confidenceResult) {
          const confidenceDetails = this.confidenceExportDetails(q.confidenceResult);
          details = details ? `${details} | ${confidenceDetails}` : confidenceDetails;
        }

        const roundContext = this.exportRoundContextDetails(q);
        if (roundContext) {
          details = details ? `${roundContext} | ${details}` : roundContext;
        }

        rows.push(
          [
            q.questionOrder + 1,
            escapeCsv(stripMarkdownToPlainText(q.questionTextShort)),
            q.type,
            q.participantCount,
            escapeCsv(this.exportAggregationRoundLabel(q)),
            q.averageScore ?? '',
            ...this.confidenceExportColumns(q.confidenceResult).map(escapeCsv),
            escapeCsv(details),
          ].join(';'),
        );
      }

      if (data.confidenceSummary) {
        const summary = data.confidenceSummary;
        rows.push('');
        rows.push(
          $localize`:@@sessionHost.exportConfidenceSummaryTitle:Lernstand und Selbsteinschätzung`,
        );
        rows.push(
          $localize`:@@sessionHost.exportConfidenceSummaryHeader:Gültige Antworten;Ausgewertete Fragen;Aus Datenschutz ausgeblendete Fragen;Gefestigt;Fehlkonzept-Risiko;Fragil;Erkannte Wissenslücke;Unentschieden`,
        );
        const middle = summary.crossTab.correctMid + summary.crossTab.incorrectMid;
        rows.push(
          [
            summary.responseCount,
            summary.includedQuestionCount,
            summary.suppressedQuestionCount,
            this.confidenceExportMetric(summary.crossTab.correctHigh, summary.responseCount),
            this.confidenceExportMetric(summary.crossTab.incorrectHigh, summary.responseCount),
            this.confidenceExportMetric(summary.crossTab.correctLow, summary.responseCount),
            this.confidenceExportMetric(summary.crossTab.incorrectLow, summary.responseCount),
            this.confidenceExportMetric(middle, summary.responseCount),
          ]
            .map((value) => escapeCsv(String(value)))
            .join(';'),
        );
      }

      if (data.teamMode && data.teamLeaderboard && data.teamLeaderboard.length > 0) {
        rows.push('');
        rows.push($localize`:@@sessionHost.exportTeamLeaderboardTitle:Team-Wertung`);
        rows.push(
          $localize`:@@sessionHost.exportTeamLeaderboardHeader:Rang;Team;Farbe;Mitglieder;Team-Punkte;Ø Punkte pro Mitglied`,
        );
        for (const team of data.teamLeaderboard) {
          rows.push(
            [
              team.rank,
              escapeCsv(replaceEmojiShortcodes(team.teamName)),
              team.teamColor ?? '',
              team.memberCount,
              team.totalScore,
              team.averageScore,
            ].join(';'),
          );
        }
      }

      if (data.bonusTokens && data.bonusTokens.length > 0) {
        rows.push('');
        rows.push($localize`:@@sessionHost.exportBonusCodesTitle:Bonus-Codes`);
        rows.push(
          $localize`:@@sessionHost.exportBonusCodesHeader:Rang;Nickname;Code;Punkte;Generiert am`,
        );
        for (const t of data.bonusTokens) {
          rows.push(`${t.rank};${t.nickname};${t.token};${t.totalScore};${t.generatedAt}`);
        }
      }

      this.downloadCsvExport(rows, buildSessionResultsCsvFilename(data.quizName, data.sessionCode));
      this.exportStatus.set($localize`:@@sessionHost.exportCsvDone:Ergebnis-CSV exportiert.`);
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForExportFailure(() => void this.exportSessionResultsCsv());
    } finally {
      this.exportExporting.set(false);
    }
  }

  async exportSessionResultsPdf(): Promise<void> {
    if (!this.code || this.exportExporting()) return;
    this.exportStatus.set(null);
    this.exportExporting.set(true);
    try {
      const exportData = await trpc.session.getExportData.query({
        code: this.code.toUpperCase(),
      });
      if (exportData.questions.length >= 15) {
        this.exportStatus.set(
          $localize`:@@sessionHost.exportPdfGeneratingLarge:PDF wird erstellt (${exportData.questions.length} Fragen)…`,
        );
      }
      try {
        const pdf = await trpc.session.getSessionExportPdf.query({
          code: this.code.toUpperCase(),
          localeId: this.localeId,
        });
        this.downloadBase64Export(pdf.contentBase64, pdf.fileName, pdf.mimeType);
        this.exportStatus.set(
          $localize`:@@sessionHost.exportPdfDownloadDone:Ergebnis-PDF heruntergeladen.`,
        );
        this.dismissHostSteeringCallout();
        return;
      } catch {
        // Fallback: druckoptimiertes HTML im Browser
      }

      const labels = getSessionResultsReportLabels();
      const assetBaseUrl = window.location.origin;
      let html = buildSessionResultsReportHtml(exportData, labels, {
        localeId: this.localeId,
        assetBaseUrl,
        pageNumbersViaCss: true,
      });
      html = await inlineExportImagesInHtml(html, { fetchExternal: true, maxImageBytes: 400_000 });
      const documentTitle = `${labels.documentTitle} — ${exportData.quizName}`;
      const opened = printSessionResultsReport(html, documentTitle);
      if (!opened) {
        throw new Error('print window blocked');
      }
      this.exportStatus.set(
        $localize`:@@sessionHost.exportPdfPrintDone:Ergebnis-PDF zum Speichern geöffnet.`,
      );
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForExportFailure(() => void this.exportSessionResultsPdf());
    } finally {
      this.exportExporting.set(false);
    }
  }

  async previewSessionResultsReport(): Promise<void> {
    if (!this.code || this.exportExporting()) return;
    this.exportStatus.set(null);
    this.exportExporting.set(true);
    try {
      const exportData = await trpc.session.getExportData.query({
        code: this.code.toUpperCase(),
      });
      const labels = getSessionResultsReportLabels();
      const assetBaseUrl = window.location.origin;
      let html = buildSessionResultsReportHtml(exportData, labels, {
        localeId: this.localeId,
        assetBaseUrl,
        pageNumbersViaCss: true,
      });
      html = await inlineExportImagesInHtml(html, { fetchExternal: true, maxImageBytes: 400_000 });
      const documentTitle = `${labels.documentTitle} — ${exportData.quizName}`;
      const opened = openSessionResultsReportPreview(
        html,
        documentTitle,
        $localize`:@@sessionHost.exportPdfPreviewPrint:Als PDF drucken`,
      );
      if (!opened) {
        throw new Error('preview window blocked');
      }
      this.exportStatus.set(
        $localize`:@@sessionHost.exportPdfPreviewDone:Berichtsvorschau geöffnet.`,
      );
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForExportFailure(() => void this.previewSessionResultsReport());
    } finally {
      this.exportExporting.set(false);
    }
  }

  async exportQaQuestionsCsv(): Promise<void> {
    if (!this.code || this.exportExporting()) {
      return;
    }

    const questions = this.qaQuestions();
    if (questions.length === 0) {
      return;
    }

    this.exportStatus.set(null);
    this.exportExporting.set(true);

    try {
      const rows: string[] = [
        $localize`:@@sessionQa.exportHeader:Nr.;Frage-ID;Status;Frage;Score;Positive Stimmen;Negative Stimmen;Stimmen gesamt;Wilson-Score;Kontroverse-Score;Umstritten;Erstellt am`,
      ];

      for (const [index, question] of questions.entries()) {
        rows.push(
          [
            index + 1,
            question.id,
            question.status,
            escapeCsv(stripMarkdownToPlainText(question.text)),
            this.qaQuestionScore(question),
            question.positiveVoteCount ?? '',
            question.negativeVoteCount ?? '',
            question.voteCount ?? '',
            this.formatQaExportMetric(question.bestScore),
            this.formatQaExportMetric(question.controversyScore),
            question.isControversial === undefined ? '' : String(question.isControversial),
            question.createdAt,
          ].join(';'),
        );
      }

      this.downloadCsvExport(rows, buildQaQuestionsCsvFilename(this.code.toUpperCase()));
      this.exportStatus.set($localize`:@@sessionQa.exportDone:Q&A-CSV exportiert.`);
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForExportFailure(() => void this.exportQaQuestionsCsv());
    } finally {
      this.exportExporting.set(false);
    }
  }

  private formatQaExportMetric(value: number | undefined): string {
    if (value === undefined) {
      return '';
    }
    return formatNumber(value, this.localeId, '1.0-4');
  }

  private downloadCsvExport(rows: string[], fileName: string): void {
    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = this.document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  private downloadBase64Export(contentBase64: string, fileName: string, mimeType: string): void {
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async endSession(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.end.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      this.syncCurrentQuestionForHost(null);
      this.dismissHostSteeringCallout();
    } catch (error) {
      if (this.isSessionNotFoundError(error)) {
        await this.navigateHomeAfterSessionUnavailable();
        return;
      }
      this.openHostSteeringCalloutForSteeringFailure(() => void this.endSession());
    } finally {
      this.controlPending.set(false);
    }
  }

  private async refreshCurrentQuestionForHost(): Promise<void> {
    if (!this.code || this.code.length !== 6) return;
    const runId = ++this.currentQuestionRefreshRunId;
    const expectedStatus = this.effectiveStatus();
    const expectedQuestion = this.effectiveCurrentQuestionState();
    try {
      const q = await trpc.session.getCurrentQuestionForHost.query({
        code: this.code.toUpperCase(),
      });
      if (
        runId !== this.currentQuestionRefreshRunId ||
        this.effectiveStatus() !== expectedStatus ||
        this.effectiveCurrentQuestionState() !== expectedQuestion
      ) {
        return;
      }
      this.syncCurrentQuestionForHost(q);
    } catch {
      if (
        runId !== this.currentQuestionRefreshRunId ||
        this.effectiveStatus() !== expectedStatus ||
        this.effectiveCurrentQuestionState() !== expectedQuestion
      ) {
        return;
      }
      this.syncCurrentQuestionForHost(null);
    }
  }

  private async refreshHostVoteProgress(): Promise<void> {
    if (!this.code || this.code.length !== 6) return;
    const runId = ++this.hostVoteProgressRefreshRunId;
    const expectedStatus = this.effectiveStatus();
    const expectedQuestion = this.effectiveCurrentQuestionState();
    const expectedRound = this.displayedCurrentQuestionForHost()?.currentRound ?? null;
    try {
      const progress = await trpc.session.getHostVoteProgress.query({
        code: this.code.toUpperCase(),
      });
      if (
        runId !== this.hostVoteProgressRefreshRunId ||
        this.effectiveStatus() !== expectedStatus ||
        this.effectiveCurrentQuestionState() !== expectedQuestion ||
        (this.displayedCurrentQuestionForHost()?.currentRound ?? null) !== expectedRound
      ) {
        return;
      }
      this.syncHostVoteProgress(progress);
    } catch {
      if (
        runId !== this.hostVoteProgressRefreshRunId ||
        this.effectiveStatus() !== expectedStatus ||
        this.effectiveCurrentQuestionState() !== expectedQuestion ||
        (this.displayedCurrentQuestionForHost()?.currentRound ?? null) !== expectedRound
      ) {
        return;
      }
      this.syncHostVoteProgress(null);
    }
  }

  private finishQuizStartQuestionPendingIfReady(): boolean {
    if (!this.quizStartQuestionPending()) {
      return true;
    }
    if (this.isHostQuestionDetailsPending()) {
      return false;
    }
    this.quizStartQuestionPending.set(false);
    this.clearHostQuestionDetailsRetry();
    return true;
  }

  private scheduleHostQuestionDetailsRetry(): void {
    if (
      !this.quizStartQuestionPending() ||
      !this.isHostQuestionDetailsPending() ||
      this.hostQuestionDetailsRetryTimer
    ) {
      return;
    }

    if (this.hostQuestionDetailsRetryCount >= HOST_QUESTION_DETAILS_RETRY_LIMIT) {
      this.quizStartQuestionPending.set(false);
      this.clearHostQuestionDetailsRetry();
      return;
    }

    this.hostQuestionDetailsRetryCount += 1;
    this.hostQuestionDetailsRetryTimer = setTimeout(() => {
      this.hostQuestionDetailsRetryTimer = null;
      void this.refreshCurrentQuestionForHost().then(() => {
        if (!this.finishQuizStartQuestionPendingIfReady()) {
          this.scheduleHostQuestionDetailsRetry();
        }
      });
    }, HOST_QUESTION_DETAILS_RETRY_MS);
  }

  private clearHostQuestionDetailsRetry(): void {
    if (this.hostQuestionDetailsRetryTimer) {
      clearTimeout(this.hostQuestionDetailsRetryTimer);
      this.hostQuestionDetailsRetryTimer = null;
    }
    this.hostQuestionDetailsRetryCount = 0;
  }

  private async refreshLiveFreetext(): Promise<void> {
    try {
      const data = await trpc.session.getLiveFreetext.query({ code: this.code.toUpperCase() });
      this.freetextResponses.set(data.responses);

      if (data.questionType === 'FREETEXT') {
        this.currentQuestionLabel.set(
          data.questionOrder !== null
            ? $localize`Frage ${data.questionOrder + 1}:questionNumber:: ${data.questionText ?? ''}:questionText:`
            : null,
        );
        this.wordCloudInfo.set($localize`Live-Freitext wird aktualisiert.`);
      } else if (data.questionType) {
        this.wordCloudExpanded.set(false);
        this.currentQuestionLabel.set(
          data.questionOrder !== null
            ? $localize`Frage ${data.questionOrder + 1}:questionNumber:: ${data.questionText ?? ''}:questionText:`
            : null,
        );
        this.wordCloudInfo.set($localize`Aktuelle Frage ist keine Freitext-Frage.`);
      } else {
        this.currentQuestionLabel.set(null);
        this.wordCloudInfo.set($localize`Noch keine aktive Frage.`);
        this.wordCloudExpanded.set(false);
      }
    } catch {
      this.wordCloudInfo.set($localize`Live-Freitextdaten konnten nicht geladen werden.`);
    }
  }
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
