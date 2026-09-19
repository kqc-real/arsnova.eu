import { DecimalPipe, DOCUMENT, formatNumber } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  getDocumentFullscreenElement,
  isDocumentFullscreenEnterAvailable,
  tryAutoRequestDocumentFullscreen,
  tryExitDocumentFullscreen,
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
import { ActivatedRoute, Router } from '@angular/router';
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
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import type { Unsubscribable } from '@trpc/server/observable';
import { clearFeedbackHostToken } from '../../../core/feedback-host-token';
import {
  clearHostToken,
  getHostSessionRole,
  hasHostToken,
  setHostToken,
} from '../../../core/host-session-token';
import {
  isHostAccessRevokedError,
  isOriginalHostForbiddenError,
} from '../host-pairing/host-access-error';
import { SessionTokenStorageService } from '../session-present/session-token-storage.service';
import {
  getEffectiveLocale,
  localeIdToSupported,
  type SupportedLocale,
} from '../../../core/locale-from-path';
import { refreshTrpcWsBinding, trpc } from '../../../core/trpc.client';
import {
  clearHostBrowserCapability,
  clearStagedHostRecoveryCard,
  getHostBrowserCapability,
  getStagedHostRecoveryCard,
} from '../../../core/host-recovery-access';
import { HostRecoveryCardDialogComponent } from '../host-recovery/host-recovery-card-dialog.component';
import { rememberPendingHostInvite } from '../../product-feedback/product-feedback-storage';
import { ContextualFeedbackOfferService } from '../../product-feedback/contextual-feedback-offer.service';
import { getAnonymousClientId } from '../../../core/anonymous-client-id';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { decorateLeadingAnswerEmoji } from '../../../shared/leading-answer-emoji.util';
import {
  answerOptionColor,
  answerOptionShape,
  showQuestionTypeIndicator,
} from '../../../shared/answer-option-badge.util';
import { AnswerOptionBadgeComponent } from '../../../shared/answer-option-badge/answer-option-badge.component';
import { InfoLandingLinkComponent } from '../../../shared/info-landing-link/info-landing-link.component';
import { INFO_LANDING_ANCHORS } from '../../../core/info-landing-url';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { SoundService } from '../../../core/sound.service';
import { HostDisplayModeService } from '../../../core/host-display-mode.service';
import {
  isPresenterViewOffered,
  openPresenterViewWindow,
  PRESENTER_VIEW_OFFERED_MEDIA,
} from '../session-present/presenter-window.util';
import { localizePath, resolveLocalizedJoinUrl } from '../../../core/locale-router';
import { sessionCodeAriaLabel as i18nSessionCodeAria } from '../../../core/session-code-aria';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../../../shared/confirm-leave-dialog/confirm-leave-dialog.component';
import {
  SessionExpirationDialogComponent,
  type SessionExpirationDialogResult,
} from './session-expiration-dialog.component';
import { SessionRetentionDialogComponent } from './session-retention-dialog.component';
import {
  QaChannelConfigurationDialogComponent,
  type QaChannelConfigurationDialogData,
} from './qa-channel-configuration-dialog.component';
import { PresentationStartDialogComponent } from '../host-pairing/presentation-start-dialog.component';
import {
  createQuizHistoryAccessProof,
  resolveNumericEstimateToleranceMode,
  resolveNumericTolerance,
  selectConfidencePriorityQuestions,
  CONFIDENCE_SCALE_MAX,
  CONFIDENCE_SCALE_MIN,
  WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH,
  WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH,
  QA_WORD_CLOUD_MAX_OUTPUT_ENTRIES,
  WordCloudAnalysisEntryDTOSchema,
  isWordCloudLemmaLocale,
  isWordCloudPhraseAnalysisVariant,
  parseQaSummaryQuestionSourceId,
  isQaChannelJoinable,
  type WordCloudLemmaLocale,
  type ProductFeedbackInAppArea,
} from '@arsnova/shared-types';
import {
  canRequestQaSummary,
  countQaSummaryVisibleQuestions,
  type AnalyzeWordCloudInput,
  AnalyzeWordCloudOutput,
  ConfidenceResultDTO,
  ConfidenceQuestionSummaryDTO,
  HostCurrentQuestionDTO,
  HostVoteProgressDTO,
  LeaderboardEntryDTO,
  NicknameTheme,
  NumericRoundComparisonDTO,
  NumericStatsDTO,
  QaNlpCategory,
  QaQuestionDTO,
  QaQuestionsInvalidationDTO,
  QaQuestionsListDTO,
  QaQuestionSortMode,
  QaSummaryRuntimeDTO,
  QaSummarySource,
  QuickFeedbackResult,
  SessionChannelsDTO,
  SessionFeedbackSummary,
  SessionConfidenceSummaryDTO,
  SessionInfoDTO,
  SessionLifecycleHostDTO,
  SessionExpirationPreviewDTO,
  SessionQaConfigurationDTO,
  SessionPresenterSurface,
  SessionParticipantsPayload,
  ParticipantArrivalDTO,
  SessionParticipantPageDTO,
  SessionParticipantSummaryDTO,
  TeamAssignment,
  SessionResultsPdfProfile,
  SessionStatus,
  SessionStatusUpdate,
  TeamDTO,
  TeamLeaderboardEntryDTO,
  QaWordCloudPresenterProjectionDTO,
  WordCloudAnalysisEntryDTO,
  WordCloudAnalysisLocale,
  WordCloudAnalysisVariant,
  WordCloudNormalizationFallbackReason,
} from '@arsnova/shared-types';
import { WordCloudLemmaLocaleSelectComponent } from './word-cloud-lemma-locale-select.component';
import {
  isDisplayableThemeWordCloudEntry,
  isWordCloudUnigramEntryKey,
  mergeThemePhrasesWithLemmaUnigrams,
  selectFreetextLemmaDisplayEntries,
} from './qa-word-cloud-theme-merge';
import {
  holdSemanticPendingProgress,
  isSemanticTopicCloudResult,
  semanticPendingWaitHintKind,
  WORD_CLOUD_SEMANTIC_WAIT_HINT_AFTER_MS,
} from './word-cloud-semantic-pending';
import { WordCloudComponent } from '../session-present/word-cloud.component';
import { getQaWordCloudQuestionWeight } from '../session-present/word-cloud.util';
import {
  WordCloudTermExtractorService,
  type WordCloudTerm,
  type WordCloudTermDocument,
} from '../session-present/word-cloud-term.service';
import {
  buildModerationCompassCards,
  collectModerationQuizFacts,
  collectQaNlpCategorySources,
  compassQuestionStem,
  compassTermsFromAnalysisEntries,
  isNegativeFeedbackKey,
  mergeModerationQuizSources,
  notableQuickFeedbackSplit,
  rememberModerationQuizSnapshot,
  resolveModerationCompassAnalysisMode,
  truncateCompassLabel,
  type ModerationCompassCardKind,
  type ModerationCompassAnalysisVariant,
  type ModerationCompassQuizInsightKind,
  type ModerationCompassQuizSourceCacheEntry,
  type ModerationCompassSource,
  type ModerationCompassTempo,
  type ModerationCompassTerm,
  type ModerationQuizFact,
} from './moderation-compass';
import { CountdownFingersComponent } from '../../../shared/countdown-fingers/countdown-fingers.component';
import { MarkdownImageLightboxDirective } from '../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { questionTypeLabel } from '../../../shared/question-type-label';
import { remainingCountdownSeconds } from '../session-countdown.util';
import {
  getSkewAdjustedNow,
  recordServerTimeIso,
  recordServerTimeSample,
} from '../session-server-clock';
import { SessionDeadlineController } from '../session-deadline';
import { resolveQaDeadlineClockParts } from '../session-qa-deadline-label.util';
import { MusicEqualizerIconComponent } from '../../../shared/music-equalizer-icon/music-equalizer-icon.component';
import { ModerationCompassIconComponent } from './moderation-compass-icon.component';
import { PresenterIconComponent } from '../presenter-icon.component';
import { FeedbackHostComponent } from '../../feedback/feedback-host.component';
import {
  feedbackDisplayLabel,
  tempoTrendEmoji,
  tempoTrendLabel,
} from '../../feedback/feedback.config';
import { QuizStoreService, DEMO_QUIZ_ID } from '../../quiz/data/quiz-store.service';
import {
  buildQaQuestionsCsvFilename,
  buildSessionResultsCsvFilename,
} from '../../../core/export-filename.util';
import { stripMarkdownToPlainText } from '../../../core/markdown-plain-text.util';
import { localizeKnownServerError } from '../../../core/localize-known-server-message';
import { SessionResultsExportService } from '../../../core/session-results-export.service';
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
import {
  PresenterDistributionMatrixComponent,
  type DistributionMatrixAxisEntry,
  type DistributionMatrixCell,
} from '../../../shared/presenter-distribution-matrix/presenter-distribution-matrix.component';

type NumericStatsDisplayItem = {
  id: string;
  label: string;
  value: string;
  caption: string | null;
};

const SESSION_LIFECYCLE_DIALOG_OVERLAY = {
  panelClass: 'session-lifecycle-dialog-panel',
  backdropClass: 'session-lifecycle-dialog-backdrop',
} as const;

const HOST_AUX_POLL_MS = 3000;
const HOST_CLOCK_POLL_MS = 15000;
const HOST_REALTIME_RESUBSCRIBE_MS = 5000;
const QA_WORD_CLOUD_ANALYSIS_DEBOUNCE_MS = 180;
const QA_WORD_CLOUD_ANALYZE_CONFLICT_RETRIES = 3;
const QA_WORD_CLOUD_ANALYZE_CONFLICT_RETRY_MS = 80;
const WORD_CLOUD_LEMMA_MAX_ENTRIES = 80;
const FOYER_MAX_ACTIVE_CHIPS = 6;
const FOYER_CHIP_LIFETIME_MS = 1100;
const FOYER_CHIP_DEV_LIFETIME_MS = 3500;
const FOYER_LANE_COUNT = 3;
const FOYER_TEAM_DELAY_STEP_MS = 720;
const FOYER_TEAM_PRESENTATION_BUFFER_MS = 440;
const FOYER_NON_TEAM_DELAY_STEP_MS = 920;
const HOST_QUESTION_DETAILS_RETRY_MS = 250;
const HOST_QUESTION_DETAILS_RETRY_LIMIT = 8;
const QUIZ_ATTACH_SESSION_INFO_RETRY_MS = 300;
const QUIZ_ATTACH_SESSION_INFO_RETRY_LIMIT = 5;
const FOYER_NON_TEAM_PRESENTATION_BUFFER_MS = 240;
const FOYER_KINDERGARTEN_DELAY_STEP_MS = 5400;
const TEAM_FOYER_SUPPRESSION_PARTICIPANT_THRESHOLD = 100;
const TEAM_FOYER_SUPPRESSION_BURST_THRESHOLD = 24;
const SESSION_NOT_FOUND_MESSAGE = 'Session nicht gefunden.';
const EXIT_ANCHOR_TOUCH_SCROLL_THRESHOLD_PX = 6;

type FoyerArrivalMotionProfile = {
  stepMs: number;
  enterDurationMs: number;
  presenceMs: number;
  settleDelayMs: number;
  badgeDelayMs: number;
  badgePresenceMs: number;
  pulseDelayMs: number;
};
type FreetextWordCloudMode = 'WORDS' | 'PHRASES' | 'SEMANTIC';

function freetextLemmaMaxNgramLength(
  mode: FreetextWordCloudMode,
): typeof WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH | typeof WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH {
  return mode === 'WORDS'
    ? WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH
    : WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH;
}

function resolveFreetextWordCloudMode(value: unknown): FreetextWordCloudMode | null {
  if (value === 'WORDS' || value === 'PHRASES' || value === 'SEMANTIC') {
    return value;
  }

  if (value !== null && typeof value === 'object' && 'value' in value) {
    return resolveFreetextWordCloudMode((value as { value: unknown }).value);
  }

  return null;
}

function wordCloudLemmaLocaleStorageKey(sessionCode: string): string {
  return `arsnova.wordCloudLemmaLocale.${sessionCode.toUpperCase()}`;
}

function readWordCloudLemmaLocaleOverride(sessionCode: string): WordCloudLemmaLocale | null {
  if (!sessionCode || typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(wordCloudLemmaLocaleStorageKey(sessionCode));
    return raw && isWordCloudLemmaLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

function wordCloudAnalysisRequestKey(request: AnalyzeWordCloudInput): string {
  return JSON.stringify({ ...request, refresh: undefined });
}

function persistWordCloudLemmaLocaleOverride(
  sessionCode: string,
  locale: WordCloudLemmaLocale,
): void {
  if (!sessionCode || typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(wordCloudLemmaLocaleStorageKey(sessionCode), locale);
  } catch {
    /* quota / private mode */
  }
}

function freetextLemmaSnapshotMaxNgramLength(snapshotKey: string | null): number | null {
  if (!snapshotKey) {
    return null;
  }

  try {
    const parsed = JSON.parse(snapshotKey) as { maxNgramLength?: unknown };
    return typeof parsed.maxNgramLength === 'number' ? parsed.maxNgramLength : null;
  } catch {
    return null;
  }
}

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

type MusicPhase = 'lobby' | 'reading' | 'countdown' | 'personalTime';

const PHASE_TRACK_DEFAULTS: Record<MusicPhase, HostMusicTrack> = {
  lobby: 'LOBBY_2',
  reading: 'READING_0',
  countdown: 'COUNTDOWN_1',
  personalTime: 'COUNTDOWN_0',
};

const MUSIC_PHASE_STORAGE_KEY = 'arsnova-host-phase-tracks';
const MUSIC_PHASE_IDS = ['lobby', 'reading', 'countdown', 'personalTime'] as const;

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

function isMusicPhaseId(value: unknown): value is MusicPhase {
  return (
    value === 'lobby' || value === 'reading' || value === 'countdown' || value === 'personalTime'
  );
}

function readStoredPhaseMusicRaw(): Record<string, unknown> | null {
  try {
    const raw =
      globalThis.localStorage === undefined
        ? null
        : globalThis.localStorage.getItem(MUSIC_PHASE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function loadPhaseTracksFromStorage(): Record<MusicPhase, HostMusicTrack> {
  const parsed = readStoredPhaseMusicRaw();
  if (!parsed) return { ...PHASE_TRACK_DEFAULTS };
  return {
    lobby: normalizeStoredHostMusicTrack(parsed['lobby']) ?? PHASE_TRACK_DEFAULTS.lobby,
    reading:
      normalizeStoredHostMusicTrack(parsed['reading'] ?? parsed['connecting']) ??
      PHASE_TRACK_DEFAULTS.reading,
    countdown:
      normalizeStoredHostMusicTrack(parsed['countdown'] ?? parsed['running']) ??
      PHASE_TRACK_DEFAULTS.countdown,
    personalTime:
      normalizeStoredHostMusicTrack(parsed['personalTime']) ?? PHASE_TRACK_DEFAULTS.personalTime,
  };
}

function loadMutedMusicPhasesFromStorage(): ReadonlySet<MusicPhase> {
  const raw = readStoredPhaseMusicRaw()?.['mutedPhases'];
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter(isMusicPhaseId));
}

function persistPhaseMusicSettings(
  tracks: Record<MusicPhase, HostMusicTrack>,
  mutedPhases: ReadonlySet<MusicPhase>,
): void {
  try {
    localStorage.setItem(
      MUSIC_PHASE_STORAGE_KEY,
      JSON.stringify({
        ...tracks,
        mutedPhases: MUSIC_PHASE_IDS.filter((phase) => mutedPhases.has(phase)),
      }),
    );
  } catch {
    /* quota */
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
    type === 'NUMERIC_ESTIMATE' ||
    type === 'MATCHING' ||
    type === 'ORDERING' ||
    type === 'CATEGORIZATION'
  );
}

function isPrevQuestionUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('Rückwärtsnavigation nicht möglich');
}

function hostSteeringFailureDetail(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const message = error.message.trim();
  if (message.length === 0) {
    return undefined;
  }
  if (/failed to fetch|network error|load failed/i.test(message)) {
    return undefined;
  }
  return message;
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
  errorRequestId: string;
  suggestedArea: ProductFeedbackInAppArea;
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
    case 'personalTime':
      return ALL_MUSIC_TRACKS.filter((t) => t.value.startsWith('COUNTDOWN_'));
  }
}

/**
 * Host-Ansicht: Lobby + Präsentations-Steuerung (Epic 2).
 * Story 2.1a, 2.2, 2.3, 2.4, 4.2, 4.6, 4.7, 4.8, 7.1, 8.1, 8.4, 8.9a.
 */
@Component({
  selector: 'app-session-host',
  standalone: true,
  imports: [
    DecimalPipe,
    MatButton,
    MatIconButton,
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
    MatProgressBar,
    MatSlideToggle,
    MatTooltip,
    WordCloudComponent,
    WordCloudLemmaLocaleSelectComponent,
    CountdownFingersComponent,
    MusicEqualizerIconComponent,
    ModerationCompassIconComponent,
    PresenterIconComponent,
    FeedbackHostComponent,
    MarkdownImageLightboxDirective,
    FoyerEntranceLayerComponent,
    AnswerOptionBadgeComponent,
    CdkTrapFocus,
    InfoLandingLinkComponent,
    PresenterDistributionMatrixComponent,
  ],
  templateUrl: './session-host.component.html',
  styleUrls: ['../../../shared/styles/dialog-title-header.scss', './session-host.component.scss'],
})
export class SessionHostComponent implements OnInit, OnDestroy {
  readonly localizedPath = localizePath;
  readonly infoLandingQaAnchor = INFO_LANDING_ANCHORS.qaWall;
  readonly infoLandingQaLabel = $localize`:@@sessionHost.infoLandingQa:Warum die Fragenwand mehr als ein Chat ist`;
  readonly infoLandingConfidenceAnchor = INFO_LANDING_ANCHORS.confidence;
  readonly infoLandingConfidenceLabel = $localize`:@@sessionHost.infoLandingConfidence:Selbsteinschätzung und Nachbesprechung verstehen`;
  session = signal<SessionInfoDTO | null>(null);
  readonly sessionUnavailable = signal(false);
  private keepHostTokenOnDeactivate = false;
  /** Lobby: Live-Teilnehmerliste (Story 2.2). */
  readonly participantsPayload = signal<SessionParticipantsPayload | null>(null);
  readonly participantDirectoryOpen = signal(false);
  readonly participantDirectoryEntries = signal<ParticipantArrivalDTO[]>([]);
  readonly participantDirectoryTotal = signal(0);
  readonly participantDirectoryPageIndex = signal(0);
  readonly participantDirectoryNextCursor = signal<string | null>(null);
  readonly participantDirectoryLoading = signal(false);
  readonly participantDirectoryError = signal<string | null>(null);
  readonly participantDirectorySearchDraft = signal('');
  readonly participantDirectorySearch = signal('');
  readonly showParticipantDirectory = computed(() => {
    const session = this.session();
    if (!session || session.anonymousMode) {
      return false;
    }
    return (this.participantsPayload()?.participantCount ?? session.participantCount) > 0;
  });
  private participantDirectoryCurrentCursor: string | null = null;
  private participantDirectoryCursorHistory: Array<string | null> = [];
  private participantDirectorySearchTimer: ReturnType<typeof setTimeout> | null = null;
  private participantDirectoryRequestId = 0;
  readonly foyerArrivalChips = signal<FoyerEntranceChip[]>([]);
  readonly hiddenFoyerParticipantIds = signal<Set<string>>(new Set());
  readonly foyerTeamDirections = signal<Record<string, 'left' | 'right'>>({});
  /** Live-Status für Steuerung (Story 2.3). */
  readonly statusUpdate = signal<SessionStatusUpdate | null>(null);
  readonly controlPending = signal(false);
  readonly sessionEndPending = signal(false);
  readonly sessionLifecycle = signal<SessionLifecycleHostDTO | null>(null);
  readonly sessionLifecyclePending = signal(false);
  private readonly sessionDeadline = new SessionDeadlineController();
  private readonly postProcessingDeadline = new SessionDeadlineController();
  private latestQaLifecycleRevision = -1;
  readonly postProcessingEnded = signal(false);
  private sessionLifecycleTimer: ReturnType<typeof setTimeout> | null = null;
  private qaDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
  readonly qaDeadlineNow = signal(getSkewAdjustedNow());
  private sessionLifecycleDialogOpen = false;
  readonly quizStartQuestionPending = signal(false);
  readonly steppedBackToPreviousResult = signal(false);
  readonly skipCurrentResultQuestionOnNext = signal(false);
  /** Auffälliger Hinweis bei fehlgeschlagenen Host-Steuer-Mutationen (Netz/Server). */
  readonly hostSteeringCallout = signal<HostSteeringCalloutState | null>(null);
  readonly activeChannel = signal<SessionChannelTab>('quiz');
  readonly qaQuestions = signal<QaQuestionDTO[]>([]);
  readonly qaListTotalCount = signal(0);
  readonly qaListNextCursor = signal<string | null>(null);
  readonly qaListRankingRevision = signal<string | null>(null);
  readonly qaListPageIndex = signal(0);
  readonly qaListPageLoading = signal(false);
  private qaListCurrentCursor: string | null = null;
  private qaListCursorHistory: Array<string | null> = [];
  private qaListRequestGeneration = 0;
  readonly qaNlpEnabled = signal(false);
  readonly qaSummaryRuntime = signal<QaSummaryRuntimeDTO | null>(null);
  readonly qaSummaryEnabled = computed(() => this.qaSummaryRuntime()?.enabled === true);
  readonly qaSummaryVisibleQuestionCount = computed(() =>
    countQaSummaryVisibleQuestions(this.qaQuestions()),
  );
  readonly qaSelectedAuthorNickname = signal<string | null>(null);
  private readonly qaUnfilteredChromeQuestions = signal<QaQuestionDTO[] | null>(null);
  readonly qaInfo = signal<string | null>(null);
  readonly qaPendingQuestionIds = signal<Set<string>>(new Set());
  readonly qaSeenQuestionIds = signal<Set<string>>(new Set());
  readonly qaScrolledDown = signal(false);
  @ViewChild('hostQuestionCard') hostQuestionCardRef?: ElementRef<HTMLElement>;
  @ViewChild('sessionFinishedHeading') sessionFinishedHeadingRef?: ElementRef<HTMLElement>;
  @ViewChild('postProcessingEndedHeading')
  postProcessingEndedHeadingRef?: ElementRef<HTMLElement>;
  @ViewChild('hostResultsSection') hostResultsSectionRef?: ElementRef<HTMLElement>;
  @ViewChild('hostAnswersList') hostAnswersListRef?: ElementRef<HTMLElement>;
  @ViewChild('qaListContainer') qaListContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('qaTitleInput') qaTitleInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('qaChannelHeading') qaChannelHeadingRef?: ElementRef<HTMLElement>;
  @ViewChild('moderationCompassButton') moderationCompassButtonRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('freetextWordCloud') freetextWordCloud?: WordCloudComponent;
  @ViewChildren('lobbyTeamCard') lobbyTeamCardRefs?: QueryList<ElementRef<HTMLElement>>;
  readonly qaHighlightedQuestionIds = signal<Set<string>>(new Set());
  readonly qaCompassFocusQuestionId = signal<string | null>(null);
  readonly qaCompassFocusQuestionIds = signal<ReadonlySet<string>>(new Set());
  readonly qaFocusOrigin = signal<'compass' | 'word-cloud' | null>(null);
  readonly qaFocusHint = signal<string | null>(null);
  readonly quickFeedbackResult = signal<QuickFeedbackResult | null>(null);
  readonly quickFeedbackSeenVoteCount = signal(0);
  readonly quickFeedbackActionPending = signal(false);
  private participantSub: Unsubscribable | null = null;
  private statusSub: Unsubscribable | null = null;
  private currentQuestionSub: Unsubscribable | null = null;
  private voteProgressSub: Unsubscribable | null = null;
  private qaSub: Unsubscribable | null = null;
  private qaSubscriptionKey: string | null = null;
  private qaSearchTimer: ReturnType<typeof setTimeout> | null = null;
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
  private quizAttachSessionInfoRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private quizAttachSessionInfoRetryCount = 0;
  private readonly foyerTeamLaneCursor = new Map<string, number>();
  private readonly foyerArrivalTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly foyerTeamPulseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly foyerTeamPulseClearTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly hiddenLobbyParticipantTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly landedTeamEchoTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private exitAnchorTouchStartY: number | null = null;
  private exitAnchorTouchLastY: number | null = null;
  private exitAnchorTouchScrolling = false;
  readonly landedTeamEchoSequences = signal<Record<string, number>>({});
  readonly foyerTeamPulseSequences = signal<Record<string, number>>({});
  private readonly foyerChipLifetimeMs = isDevMode()
    ? FOYER_CHIP_DEV_LIFETIME_MS
    : FOYER_CHIP_LIFETIME_MS;
  private readonly document = inject(DOCUMENT);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
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
  private readonly sessionResultsExport = inject(SessionResultsExportService);
  private readonly quizStore = inject(QuizStoreService);
  private readonly wordCloudTermExtractor = inject(WordCloudTermExtractorService);
  private readonly sessionTokenStorage = inject(SessionTokenStorageService);
  readonly contextualFeedbackOffer = inject(ContextualFeedbackOfferService);
  private presenterWindowOpenInFlight = false;
  private auxPollTimer: ReturnType<typeof setInterval> | null = null;
  private clockPollTimer: ReturnType<typeof setInterval> | null = null;
  readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
  private readonly requestedInitialTab = this.route.snapshot?.queryParamMap?.get('tab') ?? null;
  private readonly requestedQaCreateSetup =
    this.route.snapshot?.queryParamMap?.get('qaSetup') === '1';
  private qaCreateAbortInFlight = false;
  private qaCreateSetupCompleted = false;
  private qaConfigurationDialogInFlight: Promise<void> | null = null;
  /** Nach einmaligem Anwenden von `?tab=` nicht erneut erzwingen (sonst kein Kanalwechsel möglich). */
  private initialUrlTabApplied = false;
  /** Serverautoritativen Einstiegskanal nur beim ersten Session-Snapshot wiederherstellen. */
  private initialPreferredChannelApplied = false;
  readonly freetextResponses = signal<string[]>([]);
  readonly wordCloudExpanded = signal(false);
  readonly wordCloudInfo = signal($localize`Warte auf Live-Freitextdaten …`);
  readonly wordCloudFrozen = signal(false);
  readonly frozenWordCloudResponses = signal<string[] | null>(null);
  getHostCategorizationItemsForCategory(
    question: HostCurrentQuestionDTO | null | undefined,
    categoryId: string,
  ): Array<{ id: string; text: string; correctCategoryId: string }> {
    return (question?.categorizationItems || []).filter(
      (item) => item.correctCategoryId === categoryId,
    );
  }

  hostNeutralOrderingItems(
    question: HostCurrentQuestionDTO | null | undefined,
  ): Array<{ id: string; text: string }> {
    const canonical = [...(question?.orderingItems ?? [])];
    const neutral = [...canonical].sort((a, b) => a.id.localeCompare(b.id));
    if (neutral.length > 1 && neutral.every((item, index) => item.id === canonical[index]?.id)) {
      neutral.push(neutral.shift()!);
    }
    return neutral;
  }

  hostNeutralMatchingLeftOptions(
    question: HostCurrentQuestionDTO | null | undefined,
  ): Array<{ id: string; text: string }> {
    return [...(question?.matchingPairs ?? [])]
      .sort((a, b) => a.leftId.localeCompare(b.leftId))
      .map((pair) => ({ id: pair.leftId, text: pair.left }));
  }

  hostNeutralMatchingRightOptions(
    question: HostCurrentQuestionDTO | null | undefined,
  ): Array<{ id: string; text: string }> {
    const displayedLeft = this.hostNeutralMatchingLeftOptions(question);
    const rightByLeft = new Map(
      (question?.matchingPairs ?? []).map((pair) => [
        pair.leftId,
        { id: pair.rightId, text: pair.right },
      ]),
    );
    const neutral = displayedLeft.flatMap((left) => {
      const right = rightByLeft.get(left.id);
      return right ? [right] : [];
    });
    if (neutral.length > 1) {
      neutral.push(neutral.shift()!);
    }
    return neutral;
  }

  hostNeutralCategories(
    question: HostCurrentQuestionDTO | null | undefined,
  ): Array<{ id: string; name: string }> {
    return [...(question?.categories ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  }

  hostNeutralCategorizationItems(
    question: HostCurrentQuestionDTO | null | undefined,
  ): Array<{ id: string; text: string }> {
    return [...(question?.categorizationItems ?? [])]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, text }) => ({ id, text }));
  }

  hostMatchingMatrixRows(question: HostCurrentQuestionDTO): DistributionMatrixAxisEntry[] {
    return (question.matchingPairs ?? []).map((pair) => ({ id: pair.leftId, label: pair.left }));
  }

  hostMatchingMatrixColumns(question: HostCurrentQuestionDTO): DistributionMatrixAxisEntry[] {
    return (question.matchingPairs ?? []).map((pair) => ({ id: pair.rightId, label: pair.right }));
  }

  hostMatchingMatrixCells(question: HostCurrentQuestionDTO): DistributionMatrixCell[] {
    return (question.matchingStats?.selectionCounts ?? []).map((entry) => ({
      rowId: entry.leftId,
      columnId: entry.rightId,
      count: entry.count,
    }));
  }

  hostMatchingCorrectColumns(question: HostCurrentQuestionDTO): Record<string, string> {
    return Object.fromEntries(
      (question.matchingPairs ?? []).map((pair) => [pair.leftId, pair.rightId]),
    );
  }

  hostOrderingMatrixRows(question: HostCurrentQuestionDTO): DistributionMatrixAxisEntry[] {
    return (question.orderingItems ?? []).map((item) => ({ id: item.id, label: item.text }));
  }

  hostOrderingMatrixColumns(question: HostCurrentQuestionDTO): DistributionMatrixAxisEntry[] {
    return (question.orderingItems ?? []).map((_, index) => ({
      id: String(index),
      label: $localize`:@@sessionHost.positionColumn:Position ${index + 1}:position:`,
    }));
  }

  hostOrderingMatrixCells(question: HostCurrentQuestionDTO): DistributionMatrixCell[] {
    return (question.orderingStats?.positionCounts ?? []).map((entry) => ({
      rowId: entry.itemId,
      columnId: String(entry.position),
      count: entry.count,
    }));
  }

  hostOrderingCorrectColumns(question: HostCurrentQuestionDTO): Record<string, string> {
    return Object.fromEntries(
      (question.orderingItems ?? []).map((item, index) => [item.id, String(index)]),
    );
  }

  hostCategorizationMatrixRows(question: HostCurrentQuestionDTO): DistributionMatrixAxisEntry[] {
    return (question.categorizationItems ?? []).map((item) => ({ id: item.id, label: item.text }));
  }

  hostCategorizationMatrixColumns(question: HostCurrentQuestionDTO): DistributionMatrixAxisEntry[] {
    return (question.categories ?? []).map((category) => ({
      id: category.id,
      label: category.name,
    }));
  }

  hostCategorizationMatrixCells(question: HostCurrentQuestionDTO): DistributionMatrixCell[] {
    return (question.categorizationStats?.itemCategoryCounts ?? []).map((entry) => ({
      rowId: entry.itemId,
      columnId: entry.categoryId,
      count: entry.count,
    }));
  }

  hostCategorizationCorrectColumns(question: HostCurrentQuestionDTO): Record<string, string> {
    return Object.fromEntries(
      (question.categorizationItems ?? []).map((item) => [item.id, item.correctCategoryId]),
    );
  }

  hostStructuredCorrectSummary(
    fullyCorrectCount: number | undefined,
    totalVotes: number | undefined,
  ): string {
    const correct = fullyCorrectCount ?? 0;
    const total = totalVotes ?? 0;
    if (total <= 0) {
      return $localize`:@@sessionHost.structuredNoVotes:Noch keine Antworten`;
    }
    const percent = Math.round((correct / total) * 100);
    return $localize`:@@sessionHost.structuredCorrectSummary:${correct}:correct: von ${total}:total: vollständig korrekt (${percent}:percent: %)`;
  }

  hostHitRateBarWidth(percent: number | undefined): string {
    const value = Math.max(0, Math.min(100, percent ?? 0));
    return `${value}%`;
  }

  readonly freetextWordCloudEyebrow = $localize`:@@sessionWordCloud.freetextEyebrow:Live-Freitext`;
  readonly qaWordCloudEyebrow = $localize`:@@sessionWordCloud.qaEyebrow:Q&A-Analyse`;
  private readonly wordCloudSemanticWaitMomentHint = $localize`:@@sessionQa.wordCloudSemanticWaitMoment:Das kann einen Moment dauern.`;
  private readonly wordCloudSemanticWaitMinuteQuestionsHint = $localize`:@@sessionQa.wordCloudSemanticWaitMinute:Bei vielen Fragen kann das eine Minute dauern.`;
  private readonly wordCloudSemanticWaitMinuteResponsesHint = $localize`:@@sessionQa.wordCloudSemanticWaitMinuteFreetext:Bei vielen Antworten kann das eine Minute dauern.`;
  readonly qaWordCloudAnalysisVariant = signal<WordCloudAnalysisVariant>('THEME');
  readonly qaWordCloudDialogOpen = signal(false);
  private qaWordCloudDialogRef: { close?: (result?: unknown) => void } | null = null;
  readonly qaWordCloudFrozen = signal(false);
  readonly frozenQaWordCloudQuestions = signal<QaQuestionDTO[] | null>(null);
  readonly qaWordCloudThemeAnalysisPending = signal(false);
  readonly qaWordCloudThemeFallbackActive = signal(false);
  readonly qaWordCloudThemeAnalysisResult = signal<AnalyzeWordCloudOutput | null>(null);
  readonly qaWordCloudCoverage = signal<{
    analyzedQuestionCount: number;
    eligibleQuestionCount: number;
  } | null>(null);
  readonly qaWordCloudSemanticStale = signal(false);
  readonly qaWordCloudLemmaPending = signal(false);
  readonly qaWordCloudLemmaResult = signal<AnalyzeWordCloudOutput | null>(null);
  readonly qaWordCloudLemmaSnapshotKey = signal<string | null>(null);
  readonly qaWordCloudLemmaFallbackReason = signal<WordCloudNormalizationFallbackReason | null>(
    null,
  );
  readonly qaWordCloudLemmaPreferred = signal(true);
  readonly freetextWordCloudLemmaPending = signal(false);
  readonly freetextWordCloudLemmaResult = signal<AnalyzeWordCloudOutput | null>(null);
  readonly freetextWordCloudLemmaSnapshotKey = signal<string | null>(null);
  readonly freetextWordCloudLemmaFallbackReason =
    signal<WordCloudNormalizationFallbackReason | null>(null);
  readonly freetextWordCloudLemmaPreferred = signal(true);
  readonly freetextWordCloudMaximized = signal(false);
  readonly freetextWordCloudSemanticAnalysisPending = signal(false);
  readonly freetextWordCloudSemanticAnalysisResult = signal<AnalyzeWordCloudOutput | null>(null);
  private qaWordCloudAnalyzeTail: Promise<unknown> = Promise.resolve();
  private qaWordCloudThemeAnalysisRunId = 0;
  private qaWordCloudLemmaAnalysisRunId = 0;
  private freetextWordCloudLemmaAnalysisRunId = 0;
  private freetextWordCloudSemanticAnalysisRunId = 0;
  private presenterProjectionSyncQueue: Promise<void> = Promise.resolve();
  private lastQaWordCloudProjectionKey: string | null = null;
  private channelToggleSyncing = false;
  private lastQaWordCloudAnalysisRequestKey: string | null = null;
  private lastQaWordCloudSemanticAnalyzedKey: string | null = null;
  private lastFreetextWordCloudSemanticRequestKey: string | null = null;
  private qaWordCloudThemeAnalysisTimer: ReturnType<typeof setTimeout> | null = null;
  private freetextWordCloudSemanticAnalysisTimer: ReturnType<typeof setTimeout> | null = null;
  private qaWordCloudSemanticPendingStartedAt = 0;
  private freetextWordCloudSemanticPendingStartedAt = 0;
  private qaWordCloudSemanticWaitHintTimer: ReturnType<typeof setTimeout> | null = null;
  private freetextWordCloudSemanticWaitHintTimer: ReturnType<typeof setTimeout> | null = null;
  readonly qaWordCloudSemanticWaitHintReady = signal(false);
  readonly freetextWordCloudSemanticWaitHintReady = signal(false);
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
    void this.refreshDurableHostAccess();
    this.ensureParticipantSubscription();
    this.ensureStatusSubscription();
    this.ensureCurrentQuestionSubscription();
    this.ensureVoteProgressSubscription();
    this.startHostPolling();
    this.runAuxiliaryPollCycle();
    void this.refreshSessionLifecycle();
    if (this.hostRealtimeFallbackActive) {
      this.runRealtimeFallbackCycle();
    }
  };
  private hostAccessRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private hostAccessRefreshInFlight: Promise<void> | null = null;
  private recoveryCardDialogOpened = false;
  readonly feedbackSummary = signal<SessionFeedbackSummary | null>(null);
  readonly finishedConfidenceSummary = signal<SessionConfidenceSummaryDTO | null>(null);
  /** Aktuelle Frage für Host (Text + Antwortoptionen), null wenn keine Frage aktiv. */
  readonly currentQuestionForHost = signal<HostCurrentQuestionDTO | null>(null);
  private readonly moderationQuizSourceCache = signal<
    readonly ModerationCompassQuizSourceCacheEntry[]
  >([]);
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
  private qaSummaryPollTimer: ReturnType<typeof setInterval> | null = null;
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
  private countdownFingerSoundPlayed = false;
  private countdownFinalSoundPlayed = false;
  private countdownMusicFadeStarted = false;
  /** true ab ≤7s Rest (nach Musik-Ausblendung) → kein Countdown-Track mehr, nur SFX. */
  readonly countdownSfxPhase = signal(false);
  readonly channelActivationPending = signal<SessionChannelTab | null>(null);
  readonly channelVisibilityPending = signal<SessionChannelTab | null>(null);
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
  readonly freetextWordCloudDescription = computed(() => {
    switch (this.freetextWordCloudMode()) {
      case 'SEMANTIC':
        return $localize`:@@sessionWordCloud.freetextDescriptionSemantic:Ähnliche Antworten sind gruppiert.`;
      case 'WORDS':
        return $localize`:@@sessionWordCloud.freetextDescription:Häufige Wörter aus den Antworten.`;
      default:
        return $localize`:@@sessionQa.wordCloudDescriptionPhrases:Häufige Wörter und kurze Wortgruppen.`;
    }
  });
  readonly freetextWordCloudWordLabelSingular = computed(() => {
    switch (this.freetextWordCloudMode()) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudThemeSingular:Thema`;
      case 'PHRASES':
        return $localize`:@@sessionQa.wordCloudEntrySingular:Begriff`;
      default:
        return $localize`:@@wordCloud.wordSingular:Wort`;
    }
  });
  readonly freetextWordCloudWordLabelPlural = computed(() => {
    switch (this.freetextWordCloudMode()) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudThemePlural:Themen`;
      case 'PHRASES':
        return $localize`:@@sessionQa.wordCloudEntryPlural:Begriffe`;
      default:
        return $localize`:@@wordCloud.wordPlural:Wörter`;
    }
  });
  readonly freetextWordCloudShowSmoothing = computed(
    () => this.freetextWordCloudMode() !== 'SEMANTIC',
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
        maxNgramLength: freetextLemmaMaxNgramLength(this.freetextWordCloudMode()),
      },
    ),
  );
  readonly freetextWordCloudLemmaFingerprint = computed(() => {
    const items = this.buildFreetextWordCloudLemmaItems();
    if (items.length === 0) {
      return null;
    }

    return JSON.stringify({
      locale: this.qaWordCloudAnalysisLocale(),
      texts: items.map((item) => item.text),
      maxNgramLength: freetextLemmaMaxNgramLength(this.freetextWordCloudMode()),
    });
  });
  readonly freetextWordCloudLemmaSnapshotVisible = computed(() => {
    if (
      this.freetextWordCloudMode() === 'SEMANTIC' &&
      isSemanticTopicCloudResult(this.freetextWordCloudSemanticAnalysisResult())
    ) {
      return false;
    }

    if (this.buildFreetextWordCloudLemmaItems().length === 0) {
      return false;
    }

    if (this.freetextWordCloudLemmaResult()?.normalizationApplied !== 'LEMMA') {
      return false;
    }

    if (this.freetextWordCloudMode() !== 'PHRASES' && this.freetextWordCloudMode() !== 'SEMANTIC') {
      return true;
    }

    const snapshotNgram = freetextLemmaSnapshotMaxNgramLength(
      this.freetextWordCloudLemmaSnapshotKey(),
    );
    return snapshotNgram !== null && snapshotNgram > WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH;
  });
  readonly displayedFreetextVisibleTerms = computed<WordCloudTerm[] | null>(() => {
    if (this.freetextWordCloudLemmaSnapshotVisible()) {
      return null;
    }

    if (
      this.freetextWordCloudMode() === 'SEMANTIC' &&
      (this.freetextWordCloudSemanticAnalysisResult()?.entries.length ?? 0) > 0
    ) {
      return null;
    }

    const terms = this.displayedFreetextWordCloudTerms();
    if (
      this.freetextWordCloudMode() === 'PHRASES' &&
      this.freetextWordCloudLemmaResult()?.normalizationApplied === 'LEMMA'
    ) {
      return terms.filter((term) => !isWordCloudUnigramEntryKey(term.key));
    }

    return terms;
  });
  readonly displayedFreetextAnalysisEntries = computed(() => {
    if (this.freetextWordCloudLemmaSnapshotVisible()) {
      const entries = this.freetextWordCloudLemmaResult()?.entries;
      if (!entries) {
        return null;
      }

      return selectFreetextLemmaDisplayEntries(
        entries,
        this.freetextWordCloudMode() === 'SEMANTIC' ? 'PHRASES' : this.freetextWordCloudMode(),
        WORD_CLOUD_LEMMA_MAX_ENTRIES,
      );
    }

    if (this.freetextWordCloudMode() !== 'SEMANTIC') {
      return null;
    }

    return this.freetextWordCloudSemanticAnalysisResult()?.entries ?? null;
  });
  readonly freetextWordCloudSemanticAnalysisRequest = computed<AnalyzeWordCloudInput | null>(() =>
    this.buildFreetextWordCloudSemanticAnalysisRequest(),
  );
  readonly freetextWordCloudSemanticHint = computed(() => {
    if (this.freetextWordCloudMode() !== 'SEMANTIC') {
      return null;
    }

    if (this.freetextWordCloudSemanticAnalysisPending()) {
      return $localize`:@@sessionQa.wordCloudSemanticPendingHint:Themen werden vorbereitet. Es gelten Wörter und Phrasen.`;
    }

    return $localize`:@@sessionQa.wordCloudSemanticDisabledHint:Themen sind noch nicht verfügbar. Es gelten Wörter und Phrasen.`;
  });
  readonly freetextWordCloudSemanticWaitHint = computed(() =>
    this.resolveSemanticWaitHint(
      this.freetextWordCloudMode() === 'SEMANTIC' &&
        this.freetextWordCloudSemanticAnalysisPending() &&
        this.freetextWordCloudSemanticWaitHintReady(),
      this.displayedFreetextResponses().length,
      this.wordCloudSemanticWaitMinuteResponsesHint,
    ),
  );
  readonly freetextWordCloudSemanticProgressAria = computed(() => {
    const wait = this.freetextWordCloudSemanticWaitHint();
    const base = $localize`:@@sessionQa.wordCloudSemanticPendingHint:Themen werden vorbereitet. Es gelten Wörter und Phrasen.`;
    return wait ? `${base} ${wait}` : base;
  });
  readonly freetextWordCloudLemmaStale = computed(() => {
    const snapshotKey = this.freetextWordCloudLemmaSnapshotKey();
    if (this.freetextWordCloudLemmaResult()?.normalizationApplied !== 'LEMMA' || !snapshotKey) {
      return false;
    }

    return this.freetextWordCloudLemmaFingerprint() !== snapshotKey;
  });
  readonly freetextWordCloudSmoothingStatus = computed<'idle' | 'pending' | 'active' | 'stale'>(
    () => {
      if (this.freetextWordCloudMode() === 'SEMANTIC') {
        return 'idle';
      }

      if (this.freetextWordCloudLemmaPending()) {
        return 'pending';
      }

      if (
        this.freetextWordCloudLemmaResult()?.normalizationApplied === 'LEMMA' &&
        this.freetextWordCloudLemmaSnapshotVisible()
      ) {
        return this.freetextWordCloudLemmaStale() ? 'stale' : 'active';
      }

      return 'idle';
    },
  );
  readonly freetextWordCloudSmoothingDisabled = computed(() => {
    if (this.freetextWordCloudMode() === 'SEMANTIC') {
      return true;
    }

    if (this.freetextWordCloudLemmaPending()) {
      return true;
    }

    if (!this.qaWordCloudAnalysisLocale()) {
      return true;
    }

    return this.buildFreetextWordCloudLemmaItems().length === 0;
  });
  readonly freetextWordCloudSmoothingLabel = computed(() => {
    switch (this.freetextWordCloudSmoothingStatus()) {
      case 'pending':
        return $localize`:@@sessionQa.wordCloudSmoothPending:Analyse läuft`;
      case 'active':
        return $localize`:@@sessionQa.wordCloudSmoothActive:Glättung ist an`;
      case 'stale':
        return $localize`:@@sessionQa.wordCloudSmoothRetry:Neu analysieren`;
      default:
        return $localize`:@@sessionQa.wordCloudSmooth:Wortformen glätten`;
    }
  });
  readonly freetextWordCloudSmoothingHint = computed(() => {
    if (this.freetextWordCloudMode() === 'SEMANTIC' || this.freetextWordCloudLemmaPending()) {
      return null;
    }

    if (!this.qaWordCloudAnalysisLocale()) {
      return $localize`:@@sessionQa.wordCloudSmoothChooseLocale:Wähle die Sprache der Antworten`;
    }

    if (this.freetextWordCloudSmoothingStatus() === 'stale') {
      return $localize`:@@sessionHost.wordCloudSmoothStale:Neue Antworten seit letzter Glättung`;
    }

    const reason = this.freetextWordCloudLemmaFallbackReason();
    if (reason === 'TIMEOUT' || reason === 'INVALID_RESPONSE') {
      return $localize`:@@sessionQa.wordCloudSmoothFailed:Glättung fehlgeschlagen`;
    }

    if (
      reason === 'NLP_DISABLED' ||
      reason === 'SIDECAR_UNAVAILABLE' ||
      reason === 'LOCALE_UNSUPPORTED' ||
      reason === 'MODE_UNSUPPORTED'
    ) {
      return $localize`:@@sessionQa.wordCloudSmoothUnavailable:Glättung nicht verfügbar`;
    }

    return null;
  });
  readonly freetextWordCloudSmoothingBusy = computed(
    () => this.freetextWordCloudSmoothingStatus() === 'pending',
  );
  readonly freetextWordCloudSmoothingPressed = computed(() => {
    const status = this.freetextWordCloudSmoothingStatus();
    return status === 'active' || status === 'stale';
  });
  readonly freetextWordCloudSmoothingIcon = computed(() => {
    switch (this.freetextWordCloudSmoothingStatus()) {
      case 'pending':
        return 'hourglass_top';
      case 'active':
        return 'check';
      case 'stale':
        return 'refresh';
      default:
        return 'auto_fix_high';
    }
  });
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
  readonly qaDeadlineExpired = computed(() => {
    const closesAt = this.session()?.channels?.qa.closesAt ?? this.session()?.qaClosesAt;
    return !!closesAt && this.qaDeadlineNow() >= Date.parse(closesAt);
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
    () =>
      this.availableChannels().length > 1 &&
      (this.effectiveStatus() !== 'FINISHED' || this.qaHostWritesAllowed()),
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
  /** Nach Quiz-FINISHED bleibt Host-Moderation möglich, solange Q&A offen ist. */
  readonly qaHostWritesAllowed = computed(() => {
    if (this.postProcessingEnded()) {
      return false;
    }
    if (this.effectiveStatus() !== 'FINISHED') {
      return true;
    }
    const session = this.session();
    return !!session && isQaChannelJoinable(session);
  });
  readonly canStartAnotherQuiz = computed(
    () => this.effectiveStatus() === 'FINISHED' && this.qaHostWritesAllowed(),
  );
  /** Offenes Q&A überlebt Host-Leave und »Session beenden« in Quiz/Blitzlicht. */
  readonly keepQaOpenOnHostLeave = computed(() => {
    const qa = this.session()?.channels?.qa;
    if (qa) {
      return (
        qa.enabled === true && qa.open === true && (qa.state === undefined || qa.state === 'OPEN')
      );
    }
    return this.isQaSession() && this.isChannelOpen('qa') && !this.qaDeadlineExpired();
  });
  /** Frist und Retention sind mehrtägiges Q&A-Chrome, nicht Teil der Quiz-/Blitzlicht-Live-Kapsel. */
  readonly showQaChannelLifecycleChrome = computed(
    () => this.activeChannel() === 'qa' && this.channels().qa,
  );
  readonly showQaRetentionAction = computed(() => {
    const lifecycle = this.sessionLifecycle();
    return (
      this.showQaChannelLifecycleChrome() &&
      Boolean(lifecycle?.postProcessingEndsAt) &&
      Boolean(lifecycle?.expectedDeletionAt)
    );
  });
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
  /** Host-Chrome inkl. Presenter: laufende Session und Lobby (Quiz, Q&A, Blitzlicht). */
  readonly isLiveHostSurface = computed(() => {
    if (this.session() === null) return false;
    return this.effectiveStatus() !== 'FINISHED';
  });
  readonly showHostViewControls = computed(() => this.isLiveHostSurface());
  readonly pairedHostConnected = signal(false);
  readonly canManagePairedHosts = signal(getHostSessionRole(this.code) !== 'PAIRED_HOST');
  readonly isPairedHostClient = signal(getHostSessionRole(this.code) === 'PAIRED_HOST');
  readonly hostAccessRevoked = signal(false);
  /** Quiz-Steuerung in der Aktionsleiste nur im Quiz-Kanal, nicht in Q&A oder Blitzlicht. */
  readonly showQuizAnchorActions = computed(() => {
    if (this.isQaSession() || !this.channels().quiz) {
      return false;
    }
    return this.activeChannel() === 'quiz';
  });
  /**
   * Quiz-Kanal: ACTIVE (z. B. nach Fragerunden-Start), aber noch keine Quiz-Frage – kein Voting,
   * daher keine »Ergebnis zeigen«-Steuerung; erste Frage explizit starten.
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
  /**
   * Presenter-Button: nach der ersten Render-Runde an Viewport-Medien koppeln,
   * damit SSR/Hydration denselben DOM behalten. Tablets und Desktop bleiben sichtbar.
   */
  readonly showPresenterViewButton = signal(true);
  private presenterDesktopMediaQuery: MediaQueryList | null = null;
  private readonly onPresenterDesktopMediaChange = (
    event: MediaQueryListEvent | MediaQueryList,
  ): void => {
    const offered = event.matches;
    if (!offered && this.showPresenterViewButton()) {
      this.moveFocusFromPresenterButton();
    }
    this.showPresenterViewButton.set(offered);
  };
  readonly musicPhases = computed<ReadonlyArray<{ id: MusicPhase; label: string }>>(() => {
    const phases: Array<{ id: MusicPhase; label: string }> = [
      { id: 'lobby', label: $localize`:@@sessionHost.phaseLobbyShort:Lobby` },
      { id: 'reading', label: $localize`:@@sessionHost.phaseConnectingShort:Lesen` },
      { id: 'countdown', label: $localize`:@@sessionHost.phaseRunningShort:Countdown` },
    ];
    if (this.timerAccommodationEnabled()) {
      phases.push({
        id: 'personalTime',
        label: $localize`:@@sessionHost.phasePersonalTimeShort:Persönliche Zeit`,
      });
    }
    return phases;
  });
  /** Im Musik-Menü: welche Phase bearbeitet wird (Tracks-Liste gefiltert). */
  readonly musicMenuEditPhase = signal<MusicPhase>('lobby');
  readonly musicMenuTracksForSelection = computed(() =>
    musicTracksForPhase(this.musicMenuEditPhase()),
  );
  readonly phaseTracks = signal<Record<MusicPhase, HostMusicTrack>>(loadPhaseTracksFromStorage());
  readonly mutedMusicPhases = signal<ReadonlySet<MusicPhase>>(loadMutedMusicPhasesFromStorage());
  readonly musicMuted = signal(false);
  readonly currentMusicPhase = computed<MusicPhase | null>(() => {
    const status = this.effectiveStatus();
    if (status === 'LOBBY') return 'lobby';
    if (status === 'QUESTION_OPEN') return 'reading';
    if (status === 'ACTIVE') {
      return this.personalTimeOvertimeActive() && this.countdownSeconds() === null
        ? 'personalTime'
        : 'countdown';
    }
    return null;
  });
  readonly isCurrentMusicPhaseMuted = computed(() => {
    const phase = this.currentMusicPhase();
    return phase !== null && this.mutedMusicPhases().has(phase);
  });
  readonly personalTimeOvertimeActive = computed(
    () =>
      this.timerAccommodationEnabled() &&
      this.effectiveStatus() === 'ACTIVE' &&
      this.countdownEnded() &&
      (this.blockingTimerAccommodationCount() > 0 || this.pendingTimerAccommodationCount() > 0),
  );
  readonly activeMusicTrack = computed<HostMusicTrack | null>(() => {
    if (this.musicMuted()) return null;
    if (this.activeChannel() === 'qa') return null;
    if (this.activeChannel() === 'quickFeedback' && this.quickFeedbackResult()?.locked) {
      return null;
    }
    const phase = this.currentMusicPhase();
    if (!phase) return null;
    if (this.allHaveVoted()) return null;
    if (this.showFingerCountdown()) return null;
    if (phase === 'countdown' && (this.countdownSfxPhase() || this.countdownEnded())) {
      return null;
    }
    if (this.mutedMusicPhases().has(phase)) return null;
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

    return (
      session.quizName?.trim() || $localize`:@@sessionHost.lobbyQuizHeadingFallback:Quiz-Session`
    );
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
  readonly qaSearchDraft = signal('');
  readonly qaSearch = signal('');
  readonly qaForumQuestions = computed(() =>
    this.qaQuestions().filter((question) => question.status !== 'DELETED'),
  );
  readonly qaChromeForumQuestions = computed(() => {
    const source = this.qaUnfilteredChromeQuestions() ?? this.qaQuestions();
    return source.filter((question) => question.status !== 'DELETED');
  });
  readonly qaForumQuestionCount = computed(() =>
    Math.max(this.qaListTotalCount(), this.qaForumQuestions().length),
  );
  readonly qaFilteredQuestions = computed(() => {
    const all = this.qaForumQuestions();
    return this.qaShowPinnedOnly() ? all.filter((q) => q.status === 'PINNED') : all;
  });
  readonly qaVisibleQuestions = computed(() => {
    const questions = this.qaFilteredQuestions();
    const focused = this.qaCompassFocusQuestionIds();
    if (focused.size === 0) {
      return questions;
    }

    const focusedQuestions: QaQuestionDTO[] = [];
    const rest: QaQuestionDTO[] = [];
    for (const question of questions) {
      if (focused.has(question.id)) {
        focusedQuestions.push(question);
      } else {
        rest.push(question);
      }
    }
    focusedQuestions.sort((left, right) => this.compareQaForumSort(left, right));
    return [...focusedQuestions, ...rest];
  });
  readonly liveQaWordCloudQuestions = computed(() => {
    const visibleQuestions = (this.qaUnfilteredChromeQuestions() ?? this.qaQuestions()).filter(
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
  readonly wordCloudLemmaLocaleOverride = signal<WordCloudLemmaLocale | null>(
    readWordCloudLemmaLocaleOverride(this.code),
  );
  readonly qaWordCloudAnalysisLocale = computed<WordCloudAnalysisLocale | null>(() => {
    const override = this.wordCloudLemmaLocaleOverride();
    if (override) {
      return override;
    }

    const locale = getEffectiveLocale(localeIdToSupported(this.localeId));
    return isWordCloudLemmaLocale(locale) ? locale : null;
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
        return $localize`:@@sessionQa.wordCloudMetricBest:beste Fragen`;
      case 'CONTROVERSIAL':
        return $localize`:@@sessionQa.wordCloudMetricControversial:Kontroverse`;
      case 'TIME':
        return $localize`:@@sessionQa.wordCloudMetricTime:Häufigkeit`;
      default:
        return $localize`:@@sessionQa.wordCloudMetricTop:positive Stimmen`;
    }
  });
  readonly qaWordCloudTitle = computed(() =>
    this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC'
      ? $localize`:@@sessionQa.wordCloudTitleSemantic:Themen in den Fragen`
      : $localize`:@@sessionQa.wordCloudTitle:Q&A-Wortwolke`,
  );
  readonly qaWordCloudDescription = computed(() => {
    switch (this.qaWordCloudEffectiveAnalysisVariant()) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudDescriptionSemantic:Ähnliche Fragen sind gruppiert.`;
      case 'LEXICAL':
        return $localize`:@@sessionQa.wordCloudDescriptionLexical:Häufige Wörter aus den sichtbaren Fragen.`;
      default:
        return $localize`:@@sessionQa.wordCloudDescriptionPhrases:Häufige Wörter und kurze Wortgruppen.`;
    }
  });
  readonly qaWordCloudWordLabelSingular = computed(() => {
    switch (this.qaWordCloudEffectiveAnalysisVariant()) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudThemeSingular:Thema`;
      case 'THEME':
        return $localize`:@@sessionQa.wordCloudEntrySingular:Begriff`;
      default:
        return $localize`:@@wordCloud.wordSingular:Wort`;
    }
  });
  readonly qaWordCloudWordLabelPlural = computed(() => {
    switch (this.qaWordCloudEffectiveAnalysisVariant()) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudThemePlural:Themen`;
      case 'THEME':
        return $localize`:@@sessionQa.wordCloudEntryPlural:Begriffe`;
      default:
        return $localize`:@@wordCloud.wordPlural:Wörter`;
    }
  });
  readonly qaWordCloudWeightingHint = computed(() => {
    switch (this.qaSortMode()) {
      case 'BEST':
        return $localize`:@@sessionQa.wordCloudHintBest:Große Wörter und Phrasen kommen aus Fragen mit viel Zustimmung und ausreichend Stimmen.`;
      case 'CONTROVERSIAL':
        return $localize`:@@sessionQa.wordCloudHintControversial:Große Wörter und Phrasen kommen aus Fragen mit gegensätzlichen Reaktionen. Darüberfahren zeigt die zugehörigen Fragen.`;
      case 'TIME':
        return $localize`:@@sessionQa.wordCloudHintTime:Jede sichtbare Frage zählt gleich. Die Größe folgt der Häufigkeit, nicht den Stimmen.`;
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
      maxNgramLength: isWordCloudPhraseAnalysisVariant(this.qaWordCloudEffectiveAnalysisVariant())
        ? 3
        : 1,
    }),
  );
  readonly qaWordCloudLemmaFingerprint = computed(() => {
    const questions = this.qaWordCloudQuestions();
    if (questions.length === 0) {
      return null;
    }

    const items = questions
      .map((question) => ({
        id: question.id,
        text: question.text,
        weight: this.qaWordCloudQuestionWeight(question),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
    return JSON.stringify({
      locale: this.qaWordCloudAnalysisLocale(),
      metric: this.qaSortMode(),
      items,
    });
  });
  readonly qaWordCloudLemmaSnapshotVisible = computed(() => {
    const variant = this.qaWordCloudEffectiveAnalysisVariant();
    if (variant !== 'LEXICAL' && variant !== 'THEME' && !this.qaWordCloudSemanticPhraseFallback()) {
      return false;
    }

    if (this.qaWordCloudQuestions().length === 0) {
      return false;
    }

    return this.qaWordCloudLemmaResult()?.normalizationApplied === 'LEMMA';
  });
  readonly qaWordCloudSemanticPhraseFallback = computed(
    () =>
      this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC' &&
      !isSemanticTopicCloudResult(this.qaWordCloudThemeAnalysisResult()),
  );
  readonly qaWordCloudPhraseFallbackEntries = computed(() =>
    (this.qaWordCloudThemeAnalysisResult()?.entries ?? []).filter(isDisplayableThemeWordCloudEntry),
  );
  readonly qaWordCloudVisibleTerms = computed<WordCloudTerm[] | null>(() => {
    if (this.qaWordCloudLemmaSnapshotVisible()) {
      return null;
    }

    if ((this.qaWordCloudThemeAnalysisResult()?.entries.length ?? 0) > 0) {
      return null;
    }

    return this.qaWordCloudTerms();
  });
  readonly qaWordCloudAnalysisRequest = computed<AnalyzeWordCloudInput | null>(() =>
    this.buildQaWordCloudAnalysisRequest(),
  );
  readonly qaWordCloudAnalysisEntries = computed(() => {
    if (this.qaWordCloudLemmaSnapshotVisible()) {
      const lemmaEntries = this.qaWordCloudLemmaResult()?.entries ?? null;
      if (
        this.qaWordCloudEffectiveAnalysisVariant() === 'THEME' ||
        this.qaWordCloudSemanticPhraseFallback()
      ) {
        return mergeThemePhrasesWithLemmaUnigrams(
          this.qaWordCloudPhraseFallbackEntries(),
          lemmaEntries,
          WORD_CLOUD_LEMMA_MAX_ENTRIES,
        );
      }

      return lemmaEntries;
    }

    if (this.qaWordCloudSemanticPhraseFallback()) {
      const fallback = this.qaWordCloudPhraseFallbackEntries();
      return fallback.length > 0 ? fallback : null;
    }

    if (this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC') {
      return this.qaWordCloudThemeAnalysisResult()?.entries ?? null;
    }

    if (!isWordCloudPhraseAnalysisVariant(this.qaWordCloudEffectiveAnalysisVariant())) {
      return this.qaWordCloudThemeAnalysisResult()?.entries ?? null;
    }

    const themeEntries = this.qaWordCloudPhraseFallbackEntries();
    return themeEntries.length > 0 ? themeEntries : null;
  });
  readonly qaWordCloudLemmaStale = computed(() => {
    const snapshotKey = this.qaWordCloudLemmaSnapshotKey();
    if (this.qaWordCloudLemmaResult()?.normalizationApplied !== 'LEMMA' || !snapshotKey) {
      return false;
    }

    return this.qaWordCloudLemmaFingerprint() !== snapshotKey;
  });
  readonly qaWordCloudSmoothingStatus = computed<'idle' | 'pending' | 'active' | 'stale'>(() => {
    if (this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC') {
      if (this.qaWordCloudThemeAnalysisPending()) {
        return 'pending';
      }
      if (this.qaWordCloudSemanticStale()) {
        return 'stale';
      }
      const status = this.qaWordCloudThemeAnalysisResult()?.status;
      if (status === 'failed' || status === 'fallback') {
        return 'stale';
      }
      return 'idle';
    }

    if (this.qaWordCloudLemmaPending()) {
      return 'pending';
    }

    if (
      this.qaWordCloudLemmaResult()?.normalizationApplied === 'LEMMA' &&
      this.qaWordCloudLemmaSnapshotVisible()
    ) {
      return this.qaWordCloudLemmaStale() ? 'stale' : 'active';
    }

    return 'idle';
  });
  readonly qaWordCloudSmoothingDisabled = computed(() => {
    if (this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC') {
      if (this.qaWordCloudThemeAnalysisPending()) {
        return true;
      }
      if (this.qaWordCloudQuestions().length === 0) {
        return true;
      }
      return this.qaWordCloudThemeAnalysisResult()?.status === 'disabled';
    }

    if (this.qaWordCloudLemmaPending()) {
      return true;
    }

    if (!this.qaWordCloudAnalysisLocale()) {
      return true;
    }

    return this.qaWordCloudQuestions().length === 0;
  });
  readonly qaWordCloudSmoothingLabel = computed(() => {
    if (this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC') {
      if (this.qaWordCloudThemeAnalysisPending()) {
        return $localize`:@@sessionQa.wordCloudSmoothPending:Analyse läuft`;
      }
      return $localize`:@@sessionQa.wordCloudSmoothRetry:Neu analysieren`;
    }

    switch (this.qaWordCloudSmoothingStatus()) {
      case 'pending':
        return $localize`:@@sessionQa.wordCloudSmoothPending:Analyse läuft`;
      case 'active':
        return $localize`:@@sessionQa.wordCloudSmoothActive:Glättung ist an`;
      case 'stale':
        return $localize`:@@sessionQa.wordCloudSmoothRetry:Neu analysieren`;
      default:
        return $localize`:@@sessionQa.wordCloudSmooth:Wortformen glätten`;
    }
  });
  readonly qaWordCloudSmoothingHint = computed(() => {
    if (this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC') {
      if (this.qaWordCloudThemeAnalysisPending()) {
        return null;
      }
      if (this.qaWordCloudSemanticStale()) {
        return $localize`:@@sessionQa.wordCloudSemanticStaleHint:Neue Fragen seit der letzten Themenanalyse`;
      }
      return null;
    }

    if (this.qaWordCloudLemmaPending()) {
      return null;
    }

    if (!this.qaWordCloudAnalysisLocale()) {
      return $localize`:@@sessionQa.wordCloudSmoothChooseLocale:Wähle die Sprache der Antworten`;
    }

    if (this.qaWordCloudSmoothingStatus() === 'stale') {
      return $localize`:@@sessionQa.wordCloudSmoothStale:Neue Fragen seit letzter Glättung`;
    }

    const reason = this.qaWordCloudLemmaFallbackReason();
    if (reason === 'TIMEOUT' || reason === 'INVALID_RESPONSE') {
      return $localize`:@@sessionQa.wordCloudSmoothFailed:Glättung fehlgeschlagen`;
    }

    if (
      reason === 'NLP_DISABLED' ||
      reason === 'SIDECAR_UNAVAILABLE' ||
      reason === 'LOCALE_UNSUPPORTED' ||
      reason === 'MODE_UNSUPPORTED'
    ) {
      return $localize`:@@sessionQa.wordCloudSmoothUnavailable:Glättung nicht verfügbar`;
    }

    return null;
  });
  readonly qaWordCloudThemeFallbackHint = computed(() => {
    if (this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC') {
      if (this.qaWordCloudThemeAnalysisPending()) {
        return $localize`:@@sessionQa.wordCloudSemanticPendingHint:Themen werden vorbereitet. Es gelten Wörter und Phrasen.`;
      }
      if (this.qaWordCloudSemanticStale()) {
        return $localize`:@@sessionQa.wordCloudSemanticStaleHint:Neue Fragen seit der letzten Themenanalyse`;
      }
      const status = this.qaWordCloudThemeAnalysisResult()?.status;
      if (status === 'ready') {
        return null;
      }
      if (status === 'uncertain') {
        return $localize`:@@sessionQa.wordCloudSemanticUncertainHint:Einige Themen sind unsicher. Prüfe die Mitgliedsfragen.`;
      }
      if (status === 'failed') {
        return $localize`:@@sessionQa.wordCloudSemanticFailedHint:Themenanalyse fehlgeschlagen. Es gelten Wörter und Phrasen.`;
      }
      if (status === 'fallback') {
        return $localize`:@@sessionQa.wordCloudSemanticFallbackHint:Themen sind gerade nicht belastbar. Es gelten Wörter und Phrasen.`;
      }
      return $localize`:@@sessionQa.wordCloudSemanticDisabledHint:Themen sind noch nicht verfügbar. Es gelten Wörter und Phrasen.`;
    }

    if (this.qaWordCloudEffectiveAnalysisVariant() !== 'THEME') {
      return null;
    }

    if ((this.qaWordCloudThemeAnalysisResult()?.entries.length ?? 0) > 0) {
      return null;
    }

    if (this.qaWordCloudTerms().length > 0) {
      return null;
    }

    if (!this.qaWordCloudThemeAnalysisPending() && !this.qaWordCloudThemeFallbackActive()) {
      return null;
    }

    return $localize`:@@sessionQa.wordCloudThemeFallbackHint:Es werden Wörter gezeigt, bis Wortgruppen belastbar sind.`;
  });
  readonly qaWordCloudSemanticWaitHint = computed(() =>
    this.resolveSemanticWaitHint(
      this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC' &&
        this.qaWordCloudThemeAnalysisPending() &&
        this.qaWordCloudSemanticWaitHintReady(),
      this.qaWordCloudQuestions().length,
      this.wordCloudSemanticWaitMinuteQuestionsHint,
    ),
  );
  readonly qaSortHint = computed(() => {
    switch (this.qaSortMode()) {
      case 'BEST':
        return $localize`:@@sessionQa.sortHintBest:Zeigt Fragen mit viel Zustimmung und genug Stimmen zuerst. Hervorgehobene Fragen sind markiert, aber nicht vorgezogen.`;
      case 'CONTROVERSIAL':
        return $localize`:@@sessionQa.sortHintControversial:Zeigt Fragen mit gemischter Reaktion zuerst. Hervorgehobene Fragen sind markiert, aber nicht vorgezogen.`;
      case 'TIME':
        return $localize`:@@sessionQa.sortHintTime:Zeigt die neuesten Fragen zuerst. Hervorgehobene Fragen sind markiert, aber nicht vorgezogen.`;
      default:
        return $localize`:@@sessionQa.sortHintTop:Zeigt Fragen mit den meisten positiven Stimmen zuerst. Hervorgehobene Fragen sind markiert, aber nicht vorgezogen.`;
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
    if (count === 1) {
      return $localize`:@@sessionQa.wordCloudCountOneMetric:1 sichtbare Frage`;
    }
    return $localize`:@@sessionQa.wordCloudCountManyMetric:${count}:count: sichtbare Fragen`;
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
  readonly openQaWordCloudDialog = async (focusedTerm: string | null = null): Promise<void> => {
    this.moderationCompassFocusedTerm.set(focusedTerm);
    this.qaWordCloudDialogOpen.set(true);
    void this.activatePresenterSurface('qaWordCloud', 'qa');
    const request = this.qaWordCloudAnalysisRequest();
    if (request) {
      if (request.mode === 'SEMANTIC') {
        if (!this.qaWordCloudThemeAnalysisResult()) {
          this.queueQaWordCloudSemanticAnalysis(request);
        } else {
          this.syncQaWordCloudSemanticStale(request);
        }
      } else {
        this.queueQaWordCloudThemeAnalysis(request);
      }
    }

    try {
      const { QaWordCloudDialogComponent } = await import('./qa-word-cloud-dialog.component');
      this.syncWordCloudOverlayTop();
      const dialogRef = this.dialog.open(QaWordCloudDialogComponent, {
        data: {
          // Der sichtbare Client-Ausschnitt ist nie der kanonische Korpus.
          // Inhalte erscheinen erst aus der serverseitig gerankten Auswahl.
          responses: () => [],
          weightedResponses: () => [],
          terms: () => null,
          analysisEntries: () => this.qaWordCloudAnalysisEntries(),
          title: () => this.qaWordCloudTitle(),
          eyebrow: this.qaWordCloudEyebrow,
          description: () => this.qaWordCloudDescription(),
          wordLabelSingular: () => this.qaWordCloudWordLabelSingular(),
          wordLabelPlural: () => this.qaWordCloudWordLabelPlural(),
          weightingHint: () => this.qaWordCloudWeightingHint(),
          tooltipMetricLabel: () => this.qaWordCloudMetricLabel(),
          analyzedQuestionCount: () => this.qaWordCloudCoverage()?.analyzedQuestionCount ?? 0,
          eligibleQuestionCount: () => this.qaWordCloudCoverage()?.eligibleQuestionCount ?? 0,
          analysisModelVersion: () => this.qaWordCloudThemeAnalysisResult()?.modelVersion ?? null,
          analysisVariant: () => this.qaWordCloudEffectiveAnalysisVariant(),
          setAnalysisVariant: (variant: WordCloudAnalysisVariant) =>
            this.setQaWordCloudAnalysisVariant(variant),
          themeModeAvailable: () => this.qaWordCloudThemeModeAvailable(),
          themeFallbackHint: () => this.qaWordCloudThemeFallbackHint(),
          themeWaitHint: () => this.qaWordCloudSemanticWaitHint(),
          sortMode: () => this.qaSortMode(),
          setSortMode: (mode: QaQuestionSortMode) => this.setQaSortMode(mode),
          frozen: () => this.qaWordCloudFrozen(),
          freezeLabel: () => this.qaWordCloudFreezeLabel(),
          toggleFreeze: () => this.toggleQaWordCloudFreeze(),
          smoothingStatus: () => this.qaWordCloudSmoothingStatus(),
          smoothingLabel: () => this.qaWordCloudSmoothingLabel(),
          smoothingHint: () => this.qaWordCloudSmoothingHint(),
          smoothingDisabled: () => this.qaWordCloudSmoothingDisabled(),
          toggleSmoothing: () => this.toggleQaWordCloudSmoothing(),
          lemmaLocale: () => this.qaWordCloudAnalysisLocale(),
          setLemmaLocale: (locale: WordCloudLemmaLocale) => this.setWordCloudLemmaLocale(locale),
          itemLabelSingular: $localize`:@@sessionQa.wordCloudItemSingular:Frage`,
          itemLabelPlural: $localize`:@@sessionQa.wordCloudItemPlural:Fragen`,
          focusedTermLabel: () => this.moderationCompassFocusedTerm(),
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
      this.qaWordCloudDialogRef = dialogRef;
      let selectedIds: string[] = [];
      dialogRef.beforeClosed?.().subscribe(() => {
        selectedIds = [...(dialogRef.componentInstance?.selectedSourceIds?.() ?? [])];
      });
      dialogRef.afterClosed().subscribe((result) => {
        this.qaWordCloudDialogRef = null;
        this.qaWordCloudDialogOpen.set(false);
        void this.syncPresenterSurface('default');
        this.clearWordCloudOverlayTop();
        this.qaWordCloudFrozen.set(false);
        this.frozenQaWordCloudQuestions.set(null);
        const fromResult = Array.isArray(result)
          ? result.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          : [];
        this.restoreQaFocusAfterWordCloudClose(fromResult.length > 0 ? fromResult : selectedIds);
      });
    } catch (error) {
      this.qaWordCloudDialogRef = null;
      this.qaWordCloudDialogOpen.set(false);
      void this.syncPresenterSurface('default');
      this.clearWordCloudOverlayTop();
      this.qaWordCloudFrozen.set(false);
      this.frozenQaWordCloudQuestions.set(null);
      throw error;
    }
  };
  readonly moderationCompassCards = computed(() =>
    buildModerationCompassCards({
      qaQuestions: this.qaChromeForumQuestions().map((question) => ({
        id: question.id,
        text: this.moderationCompassQaSourceText(question),
        status: question.status,
        isControversial: question.isControversial,
        positiveVoteCount: question.positiveVoteCount,
        negativeVoteCount: question.negativeVoteCount,
        score: question.score,
        bestScore: question.bestScore,
        controversyScore: question.controversyScore,
        nlp: question.nlp,
      })),
      qaSortMode: this.qaSortMode(),
      qaTerms: this.moderationCompassQaTerms(),
      freetextTerms: [
        ...(compassTermsFromAnalysisEntries(this.displayedFreetextAnalysisEntries()) ??
          this.toModerationCompassTerms(this.displayedFreetextWordCloudTerms())),
        ...this.aggregatedFreetextCompassTerms(),
      ],
      extraTopicSources: [...this.moderationCompassPinnedSources()],
      nlpTopicSources: collectQaNlpCategorySources(
        this.qaChromeForumQuestions().map((question) => ({
          id: question.id,
          text: this.moderationCompassQaSourceText(question),
          status: question.status,
          nlp: question.nlp,
        })),
        this.moderationNlpCategoryLabels(),
      ),
      topicWeightLabel: this.moderationCompassTopicWeightLabel(),
      tempo: this.moderationCompassFeedback(),
      quizSources: this.moderationCompassQuizSources(),
      quizInsightKind: this.moderationCompassQuizInsightKind(),
    }),
  );
  readonly moderationCompassHasSignals = computed(() => this.moderationCompassCards().length > 0);
  readonly moderationCompassReturn = signal<{ readonly channel: SessionChannelTab } | null>(null);
  readonly moderationCompassFocusedTerm = signal<string | null>(null);
  readonly moderationCompassButtonAria = computed(() => {
    if (!this.moderationCompassHasSignals()) {
      return $localize`:@@sessionHost.moderationButtonAria:Moderationskompass öffnen`;
    }
    return $localize`:@@sessionHost.moderationButtonAriaWithSignals:Moderationskompass öffnen, Hinweise vorhanden`;
  });
  readonly openModerationCompassDialog = async (): Promise<void> => {
    this.moderationCompassReturn.set(null);
    this.clearQaCompassFocus();
    this.moderationCompassFocusedTerm.set(null);
    await this.refreshQaSummaryRuntime();
    const { ModerationCompassDialogComponent } =
      await import('./moderation-compass-dialog.component');
    const dialogRef = this.dialog.open(ModerationCompassDialogComponent, {
      data: {
        cards: () => this.moderationCompassCards(),
        analysisMode: resolveModerationCompassAnalysisMode({
          enabled: this.qaNlpEnabled(),
          statuses: this.qaQuestions().map((question) => question.nlp?.status),
        }),
        onSourceActivate: (
          source: ModerationCompassSource,
          cardKind: ModerationCompassCardKind,
        ) => {
          void this.followModerationCompassSource(source, cardKind);
        },
        summaryEnabled: () => this.qaSummaryEnabled(),
        summaryVisibleQuestionCount: () => this.qaSummaryVisibleQuestionCount(),
        summary: () => this.qaSummaryRuntime(),
        onRequestSummary: () => {
          void this.requestQaSummary();
        },
        onSummarySourceActivate: (source: QaSummarySource) => {
          void this.followQaSummarySource(source);
        },
      },
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      enterAnimationDuration: 180,
      exitAnimationDuration: 140,
      width: 'min(52rem, calc(100vw - 1.5rem))',
      maxWidth: 'calc(100vw - 1rem)',
      maxHeight: 'calc(100dvh - 1rem)',
      panelClass: 'moderation-compass-dialog-panel',
      backdropClass: 'moderation-compass-dialog-backdrop',
    });
    dialogRef.afterClosed().subscribe(() => {
      this.stopQaSummaryPolling();
    });
  };

  private moderationCompassQaTerms(): ModerationCompassTerm[] {
    const sortMode = this.qaSortMode();
    const lemmaEntries =
      this.qaWordCloudLemmaSnapshotVisible() && !this.qaWordCloudLemmaStale()
        ? this.qaWordCloudAnalysisEntries()
        : null;
    const fromLemma = compassTermsFromAnalysisEntries(lemmaEntries, {
      sortMode,
      analysisVariant: 'LEXICAL',
    });
    if (fromLemma) {
      return fromLemma;
    }

    const variant = this.qaWordCloudEffectiveAnalysisVariant();
    const themeEntries =
      variant === 'SEMANTIC' && !this.qaWordCloudSemanticPhraseFallback()
        ? (this.qaWordCloudThemeAnalysisResult()?.entries ?? null)
        : variant === 'THEME' || this.qaWordCloudSemanticPhraseFallback()
          ? this.qaWordCloudPhraseFallbackEntries()
          : null;
    const fromTheme = compassTermsFromAnalysisEntries(themeEntries, {
      sortMode,
      analysisVariant: 'THEME',
    });
    if (fromTheme) {
      return fromTheme;
    }

    // Lokale N-Gramme sind lexikalisch – Sprung öffnet Einzelwörter, nicht Theme-Cluster.
    return this.toModerationCompassTerms(this.qaWordCloudTerms(), {
      sortMode,
      analysisVariant: 'LEXICAL',
    });
  }

  private toModerationCompassTerms(
    terms: readonly WordCloudTerm[],
    origin?: {
      readonly sortMode: QaQuestionSortMode;
      readonly analysisVariant: ModerationCompassAnalysisVariant;
    },
  ): ModerationCompassTerm[] {
    return terms.map((term) => {
      const memberSourceIds = term.members
        .map((member) => member.sourceId.trim())
        .filter((id) => id.length > 0);
      return {
        label: term.label,
        documentFrequency: term.documentFrequency,
        sourceCount: term.sourceCount,
        memberTexts: term.members.map((member) => member.text),
        ...(memberSourceIds.length > 0 ? { memberSourceIds } : {}),
        ...origin,
      };
    });
  }

  private moderationCompassTopicWeightLabel(): string | null {
    const hasQaTerms =
      (this.qaWordCloudAnalysisEntries()?.length ?? 0) > 0 || this.qaWordCloudTerms().length > 0;
    if (!hasQaTerms) {
      return null;
    }
    return $localize`:@@sessionHost.moderationTopicWeight:Gewichtung: ${this.qaWordCloudMetricLabel()}:metric:`;
  }

  async followModerationCompassSource(
    source: ModerationCompassSource,
    cardKind: ModerationCompassCardKind | undefined = this.findCompassCardKind(source),
  ): Promise<void> {
    const target = source.target;
    if (!target) {
      return;
    }
    if (!this.isChannelEnabled(target.channel)) {
      return;
    }
    const previousChannel = this.activeChannel();
    const focusHint = this.resolveCompassFocusHint(source, cardKind);
    if (target.channel === 'qa') {
      await this.clearQaAuthorFilter();
      await this.setQaPinnedFilter(false);
    }
    await this.selectChannel(target.channel);
    if (target.surface === 'word-cloud') {
      if (target.channel === 'qa') {
        if (target.sortMode && target.sortMode !== this.qaSortMode()) {
          await this.setQaSortMode(target.sortMode, { scrollToTop: false });
        }
        const analysisVariant = this.resolveQaWordCloudJumpVariant(target);
        if (analysisVariant) {
          this.setQaWordCloudAnalysisVariant(analysisVariant);
        }
      }
      this.moderationCompassFocusedTerm.set(target.termLabel ?? null);
      this.applyQaCompassFocus(
        this.resolveQaCompassMemberQuestionIds(target),
        'compass',
        focusHint,
      );
      if (target.channel === 'qa') {
        await this.openQaWordCloudDialog(target.termLabel ?? null);
      } else {
        this.wordCloudExpanded.set(true);
        this.maximizeFreetextWordCloud();
      }
      this.moderationCompassReturn.set({ channel: previousChannel });
      return;
    }
    if (target.channel === 'qa') {
      const focusedIds = this.resolveQaCompassMemberQuestionIds(target);
      if (focusedIds.length > 0) {
        this.applyQaCompassFocus(focusedIds, 'compass', focusHint);
        this.scrollHostQaQuestionIntoView(focusedIds[0]!);
      } else {
        this.clearQaCompassFocus();
      }
    } else {
      this.clearQaCompassFocus();
    }
    this.moderationCompassReturn.set({ channel: previousChannel });
  }

  async followQaSummarySource(source: QaSummarySource): Promise<void> {
    const questionId = parseQaSummaryQuestionSourceId(source.id);
    if (!questionId) {
      return;
    }
    await this.followModerationCompassSource(
      {
        kind: 'qa-question',
        label: source.label,
        target: { channel: 'qa', questionId, questionIds: [questionId] },
      },
      'topics',
    );
  }

  private findCompassCardKind(
    source: ModerationCompassSource,
  ): ModerationCompassCardKind | undefined {
    return this.moderationCompassCards().find((card) =>
      card.sources.some((item) => item.kind === source.kind && item.label === source.label),
    )?.kind;
  }

  private resolveCompassFocusHint(
    source: ModerationCompassSource,
    cardKind: ModerationCompassCardKind | undefined,
  ): string | null {
    const fromSource = source.focusHint?.trim();
    if (fromSource) {
      return fromSource;
    }
    const term = source.target?.termLabel?.trim();
    if (term) {
      return term;
    }
    switch (cardKind) {
      case 'clarification':
        return $localize`:@@sessionHost.moderationCardClarification:Noch klären`;
      case 'friction':
        return $localize`:@@sessionHost.moderationCardFriction:Umstrittene Fragen`;
      case 'topics':
        return $localize`:@@sessionHost.moderationCardTopics:Häufige Themen`;
      default:
        return null;
    }
  }

  private applyQaCompassFocus(
    questionIds: readonly string[],
    origin: 'compass' | 'word-cloud',
    hint?: string | null,
  ): void {
    const unique = [...new Set(questionIds.filter((id) => id.trim().length > 0))];
    this.qaCompassFocusQuestionIds.set(new Set(unique));
    this.qaCompassFocusQuestionId.set(unique[0] ?? null);
    this.qaFocusOrigin.set(unique.length > 0 ? origin : null);
    if (unique.length === 0) {
      this.qaFocusHint.set(null);
      return;
    }
    if (hint !== undefined) {
      const trimmed = hint?.trim() ?? '';
      this.qaFocusHint.set(trimmed.length > 0 ? trimmed : null);
    }
  }

  private restoreQaFocusAfterWordCloudClose(cloudSourceIds: readonly string[]): void {
    if (this.activeChannel() !== 'qa') {
      return;
    }

    const forumIds = new Set(this.qaForumQuestions().map((question) => question.id));
    const merged: string[] = [];
    const seen = new Set<string>();
    const push = (id: string | null | undefined): void => {
      const next = id?.trim() ?? '';
      if (!next || !forumIds.has(next) || seen.has(next)) {
        return;
      }
      seen.add(next);
      merged.push(next);
    };

    for (const id of this.qaCompassFocusQuestionIds()) {
      push(id);
    }
    push(this.qaCompassFocusQuestionId());
    for (const id of cloudSourceIds) {
      push(id);
    }

    if (merged.length === 0) {
      return;
    }

    const origin =
      this.qaFocusOrigin() === 'compass' || this.moderationCompassReturn() !== null
        ? 'compass'
        : 'word-cloud';
    this.applyQaCompassFocus(
      merged,
      origin,
      origin === 'word-cloud' && !this.qaFocusHint()
        ? this.moderationCompassFocusedTerm()
        : undefined,
    );
    const topFocusedId =
      this.qaVisibleQuestions().find((question) => this.isQaCompassFocused(question.id))?.id ??
      merged[0]!;
    this.scrollHostQaQuestionIntoView(topFocusedId);
  }

  private clearQaCompassFocus(): void {
    this.qaCompassFocusQuestionId.set(null);
    this.qaCompassFocusQuestionIds.set(new Set());
    this.qaFocusOrigin.set(null);
    this.qaFocusHint.set(null);
  }

  clearQaListFocus(): void {
    this.clearQaCompassFocus();
    this.moderationCompassFocusedTerm.set(null);
  }

  private resolveQaWordCloudJumpVariant(
    target: ModerationCompassSource['target'],
  ): WordCloudAnalysisVariant | null {
    if (!target) {
      return null;
    }

    const requested = target.analysisVariant ?? null;
    const label = target.termLabel?.trim() ?? '';
    if (!label) {
      return requested;
    }

    if (requested === 'LEXICAL') {
      return 'LEXICAL';
    }

    if (this.qaWordCloudEntryMatchesFocus(this.qaWordCloudThemeAnalysisResult()?.entries, label)) {
      return 'THEME';
    }

    if (
      this.qaWordCloudTerms().some((term) =>
        this.qaWordCloudTextMatchesFocus([term.label, term.key, ...term.variants], label),
      )
    ) {
      return 'LEXICAL';
    }

    return requested ?? 'THEME';
  }

  private qaWordCloudEntryMatchesFocus(
    entries:
      | readonly { readonly label: string; readonly variants?: readonly string[] }[]
      | null
      | undefined,
    label: string,
  ): boolean {
    return (
      entries?.some((entry) =>
        this.qaWordCloudTextMatchesFocus([entry.label, ...(entry.variants ?? [])], label),
      ) ?? false
    );
  }

  private qaWordCloudTextMatchesFocus(candidates: readonly string[], label: string): boolean {
    const needle = label.trim().toLowerCase();
    if (!needle) {
      return false;
    }
    return candidates.some((candidate) => {
      const value = candidate.trim().toLowerCase();
      if (!value) {
        return false;
      }
      if (value === needle) {
        return true;
      }
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'u').test(value);
    });
  }

  private resolveQaCompassMemberQuestionIds(target: ModerationCompassSource['target']): string[] {
    if (!target || target.channel !== 'qa') {
      return [];
    }

    const forumIds = new Set(this.qaForumQuestions().map((question) => question.id));
    const resolved: string[] = [];
    const seen = new Set<string>();
    const push = (id: string | null | undefined) => {
      if (!id || !forumIds.has(id) || seen.has(id)) {
        return;
      }
      seen.add(id);
      resolved.push(id);
    };

    push(target.questionId);
    for (const id of target.questionIds ?? []) {
      push(id);
    }
    for (const text of target.memberTexts ?? []) {
      push(this.findQaQuestionIdForCompassMember(text));
    }
    push(this.findQaQuestionIdForCompassMember(target.memberText));
    return resolved;
  }

  private findQaQuestionIdForCompassMember(memberText: string | undefined): string | null {
    const needle = memberText?.trim().replace(/…$/u, '').replace(/\s+/g, ' ').toLowerCase();
    if (!needle || needle.length < 4) {
      return null;
    }
    const match = this.qaForumQuestions().find((question) => {
      const text = question.text.trim().replace(/\s+/g, ' ').toLowerCase();
      return text === needle || text.startsWith(needle) || needle.startsWith(text);
    });
    return match?.id ?? null;
  }

  async returnToModerationCompass(): Promise<void> {
    const returnChannel = this.moderationCompassReturn()?.channel ?? null;
    this.moderationCompassReturn.set(null);
    this.clearQaCompassFocus();
    this.moderationCompassFocusedTerm.set(null);
    if (
      returnChannel &&
      this.isChannelEnabled(returnChannel) &&
      this.activeChannel() !== returnChannel
    ) {
      await this.selectChannel(returnChannel);
    }
    const trigger = this.moderationCompassButtonRef?.nativeElement;
    if (trigger) {
      try {
        trigger.focus();
      } catch {
        /* Fokus darf den Dialog nicht blockieren */
      }
    }
    await this.openModerationCompassDialog();
  }

  private scrollHostQaQuestionIntoView(questionId: string): void {
    const elementId = `host-qa-question-${questionId}`;
    afterNextRender(
      () => {
        const attempt = (remaining: number): void => {
          const target = this.document.getElementById(elementId);
          const list = this.qaListContainerRef?.nativeElement;
          if (!(target instanceof HTMLElement)) {
            if (remaining > 0) {
              this.document.defaultView?.setTimeout(() => attempt(remaining - 1), 120);
            }
            return;
          }

          if (list instanceof HTMLElement && list.contains(target)) {
            const listRect = list.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const offset =
              targetRect.top - listRect.top - (list.clientHeight - target.offsetHeight) / 2;
            const nextTop = Math.max(0, list.scrollTop + offset);
            try {
              list.scrollTo({ top: nextTop, behavior: 'smooth' });
            } catch {
              list.scrollTop = nextTop;
            }
          }

          if (typeof target.scrollIntoView === 'function') {
            try {
              target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch {
              target.scrollIntoView();
            }
          }
          if (!target.hasAttribute('tabindex')) {
            target.tabIndex = -1;
          }
          try {
            target.focus({ preventScroll: true });
          } catch {
            target.focus();
          }
        };

        const view = this.document.defaultView;
        if (view) {
          view.setTimeout(() => attempt(4), 160);
          return;
        }
        attempt(0);
      },
      { injector: this.injector },
    );
  }

  private aggregatedFreetextCompassTerms(): ModerationCompassTerm[] {
    const counts = new Map<string, number>();
    for (const response of this.displayedFreetextResponses()) {
      const normalized = response.trim().replace(/\s+/g, ' ');
      if (normalized.length < 8) {
        continue;
      }
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([text, count]) => ({
        label: $localize`:@@sessionHost.moderationFreetextRepeat:Mehrfach genannt: ${truncateCompassLabel(text, 64)}:text:`,
        documentFrequency: count,
        sourceCount: count,
        memberTexts: [],
      }));
  }

  private moderationCompassPinnedSources(): ModerationCompassSource[] {
    return this.qaForumQuestions()
      .filter((question) => question.status === 'PINNED')
      .slice(0, 2)
      .flatMap((question) => {
        const label = truncateCompassLabel(question.text);
        return label
          ? [
              {
                kind: 'qa-question' as const,
                label: $localize`:@@sessionHost.moderationPinned:Hervorgehoben: ${label}:question:`,
                focusHint: $localize`:@@sessionHost.moderationFocusPinned:Hervorgehoben`,
                target: { channel: 'qa' as const, questionId: question.id },
              },
            ]
          : [];
      });
  }

  private moderationCompassQaSourceText(question: {
    text: string;
    isControversial?: boolean;
    positiveVoteCount?: number;
    negativeVoteCount?: number;
  }): string {
    if (
      question.isControversial === true &&
      typeof question.positiveVoteCount === 'number' &&
      typeof question.negativeVoteCount === 'number'
    ) {
      return $localize`:@@sessionHost.moderationFrictionVotes:${question.positiveVoteCount}:up: dafür, ${question.negativeVoteCount}:down: dagegen · ${question.text}:question:`;
    }
    return question.text;
  }

  private moderationCompassFeedback(): ModerationCompassTempo | null {
    const tempo = this.quickFeedbackTempoIndicator();
    const result = this.quickFeedbackResult();
    if (result?.type === 'TEMPO' || !result) {
      return tempo ? { label: tempo.label, tone: tempo.tone, variant: 'tempo' } : null;
    }
    if (result.totalVotes < 3) {
      return null;
    }

    const summary = notableQuickFeedbackSplit(result.totalVotes, result.distribution);
    const title = $localize`:@@sessionHost.moderationCardFeedback:Rückmeldungen`;
    if (summary.starAverage !== null && summary.starAverage <= 2.5) {
      const avg = formatNumber(summary.starAverage, this.localeId, '1.0-1');
      return {
        variant: 'feedback',
        title,
        tone: 'caution',
        label: $localize`:@@sessionHost.moderationFeedbackStars:Durchschnitt ${avg}:avg: von 5 Sternen`,
      };
    }
    if (summary.split) {
      return {
        variant: 'feedback',
        title,
        tone: 'caution',
        label: $localize`:@@sessionHost.moderationFeedbackSplit:Die Rückmeldungen sind geteilt.`,
      };
    }
    if (summary.majorityRatio >= 0.6 && summary.majorityKey) {
      if (!isNegativeFeedbackKey(summary.majorityKey)) {
        return null;
      }
      const option = feedbackDisplayLabel(summary.majorityKey, result.type);
      return {
        variant: 'feedback',
        title,
        tone: 'caution',
        label: $localize`:@@sessionHost.moderationFeedbackMajority:Die meisten: ${option}:option:`,
      };
    }
    return null;
  }

  private moderationCompassQuizSources(): ModerationCompassSource[] {
    const question = this.displayedCurrentQuestionForHost();
    const current =
      this.effectiveStatus() === 'RESULTS' && question
        ? this.localizeCurrentQuestionQuizSources(question)
        : [];
    return mergeModerationQuizSources(
      current,
      this.moderationQuizSourceCache(),
      question?.questionId ?? null,
    );
  }

  private moderationCompassQuizInsightKind(): ModerationCompassQuizInsightKind | null {
    const question = this.displayedCurrentQuestionForHost();
    if (this.effectiveStatus() === 'RESULTS' && question) {
      return this.moderationCompassQuizInsightKindForType(question.type);
    }
    const cached = this.moderationQuizSourceCache().find((entry) => entry.sources.length > 0);
    if (cached?.questionType) {
      return this.moderationCompassQuizInsightKindForType(cached.questionType);
    }
    return this.moderationCompassQuizSources().length > 0 ? 'scorable' : null;
  }

  private moderationCompassQuizInsightKindForType(
    type: HostCurrentQuestionDTO['type'],
  ): ModerationCompassQuizInsightKind | null {
    switch (type) {
      case 'SURVEY':
        return 'survey';
      case 'RATING':
        return 'rating';
      case 'FREETEXT':
        return null;
      default:
        return 'scorable';
    }
  }

  private localizeCurrentQuestionQuizSources(
    question: HostCurrentQuestionDTO,
  ): ModerationCompassSource[] {
    return collectModerationQuizFacts(question)
      .map((fact) => this.localizeModerationQuizFact(fact, question))
      .filter((source): source is ModerationCompassSource => source !== null)
      .slice(0, 3);
  }

  private withQuizQuestionStem(message: string, question: { text: string }): string {
    const stem = compassQuestionStem(question.text);
    if (!stem || message.includes(stem)) {
      return message;
    }
    return `${message} · ${stem}`;
  }

  private localizeModerationQuizFact(
    fact: ModerationQuizFact,
    question: HostCurrentQuestionDTO,
  ): ModerationCompassSource | null {
    const quizSource = (label: string): ModerationCompassSource => ({
      kind: 'quiz-result',
      label: this.withQuizQuestionStem(label, question),
      target: { channel: 'quiz' },
    });
    switch (fact.type) {
      case 'wrong-majority': {
        const stem = compassQuestionStem(question.text);
        return quizSource(
          stem
            ? $localize`:@@sessionHost.moderationQuizWrong:${fact.incorrect}:wrong: von ${fact.total}:total: liegen daneben · ${stem}:question:`
            : $localize`:@@sessionHost.moderationQuizWrongPlain:${fact.incorrect}:wrong: von ${fact.total}:total: liegen daneben`,
        );
      }
      case 'in-band':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizInBand:Nur ${fact.percent}:percent: % der Schätzungen liegen im erwarteten Bereich`,
        );
      case 'numeric-round-worse':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizRoundWorse:In Runde 2 liegen ${fact.percentPoints}:delta: Prozentpunkte weniger im erwarteten Bereich`,
        );
      case 'numeric-round-farther':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizRoundFarther:Mehr Schätzungen sind in Runde 2 weiter weg als näher dran`,
        );
      case 'matching-confusion':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizMatch:Häufige Verwechslung: ${truncateCompassLabel(fact.left, 32)}:left: → ${truncateCompassLabel(fact.wrong, 32)}:wrong:`,
        );
      case 'ordering-swap':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizOrder:Häufig vertauscht: ${truncateCompassLabel(fact.a, 32)}:a: und ${truncateCompassLabel(fact.b, 32)}:b:`,
        );
      case 'categorization-miss':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizCategory:Häufig falsch einsortiert: ${truncateCompassLabel(fact.item, 32)}:item: → ${truncateCompassLabel(fact.wrongCategory, 32)}:wrong:`,
        );
      case 'wrong-option':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizWrongOption:Häufigste andere Antwort: ${truncateCompassLabel(fact.option, 64)}:option:`,
        );
      case 'survey-top':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizSurveyTop:Häufigste Antwort: ${truncateCompassLabel(fact.option, 64)}:option:`,
        );
      case 'numeric-median':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizMedian:Median ${this.formatNumericHostStatValue(fact.median, question)}:median:, erwartet war etwa ${this.formatNumericHostStatValue(fact.reference, question)}:reference:`,
        );
      case 'numeric-spread':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizSpread:Die Schätzungen liegen weit auseinander`,
        );
      case 'histogram-peak-out':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizHistogramPeak:Häufigster Schätzbereich: ${this.formatNumericHostStatValue(fact.from, question)}:from:–${this.formatNumericHostStatValue(fact.to, question)}:to: (${fact.share}:share: %), außerhalb des erwarteten Bereichs`,
        );
      case 'round-drop':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizRoundDrop:Runde 2 hat weniger richtige Antworten als Runde 1`,
        );
      case 'rating-low':
        return quizSource(
          $localize`:@@sessionHost.moderationQuizRatingLow:Durchschnitt ${formatNumber(fact.avg, this.localeId, '1.0-1')}:avg: von 5`,
        );
      case 'freetext-repeat':
        return quizSource(
          $localize`:@@sessionHost.moderationFreetextRepeat:Mehrfach genannt: ${truncateCompassLabel(fact.text, 64)}:text:`,
        );
      default:
        return null;
    }
  }

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
  readonly timerAccommodationEnabled = computed(
    () => this.session()?.enableTimerAccommodation !== false,
  );
  readonly currentQuestionIsScored = computed(() =>
    isScoredQuestionType(this.displayedCurrentQuestionForHost()?.type),
  );
  readonly pendingTimerAccommodationCount = computed(() => {
    if (!this.timerAccommodationEnabled()) return 0;
    if (this.effectiveStatus() !== 'ACTIVE') return 0;
    const question = this.displayedCurrentQuestionForHost();
    const progress = this.hostVoteProgress();
    return this.hostVoteProgressMatchesQuestion(progress, question)
      ? (progress.pendingTimerAccommodationCount ?? 0)
      : 0;
  });
  readonly blockingTimerAccommodationCount = computed(() => {
    if (!this.timerAccommodationEnabled()) return 0;
    if (this.effectiveStatus() !== 'ACTIVE') return 0;
    const question = this.displayedCurrentQuestionForHost();
    const progress = this.hostVoteProgress();
    return this.hostVoteProgressMatchesQuestion(progress, question)
      ? (progress.blockingTimerAccommodationCount ?? 0)
      : 0;
  });
  /** Persönliche 10×-Fenster blockieren Freigabe, bis Raum-Countdown endet. */
  readonly personalTimerBlocksReveal = computed(
    () => this.blockingTimerAccommodationCount() > 0 && !this.countdownEnded(),
  );
  /** Nach Raum-Countdown: Host darf persönliche Fenster mit Bestätigung schließen. */
  readonly canForceClosePersonalTimers = computed(
    () => this.blockingTimerAccommodationCount() > 0 && this.countdownEnded(),
  );
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

  shouldOfferDiscussionPhase(q: HostCurrentQuestionDTO | null): boolean {
    return this.shouldShowPeerInstructionSuggestion(q);
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
  private joinInfoFocusReturn: HTMLElement | null = null;
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
        this.qaWordCloudThemeAnalysisPending.set(false);
        this.qaWordCloudSemanticPendingStartedAt = 0;
        this.clearQaWordCloudSemanticWaitHint();
        // Letztes Theme-Ergebnis behalten: Kompass und erneutes Öffnen nutzen es weiter.
        return;
      }

      untracked(() => {
        if (request.mode === 'SEMANTIC') {
          this.syncQaWordCloudSemanticStale(request);
          return;
        }
        this.queueQaWordCloudThemeAnalysis(request);
      });
    });
    effect(() => {
      const dialogOpen = this.qaWordCloudDialogOpen();
      const surface = this.session()?.presenterSurface;
      if (!dialogOpen) {
        if (surface !== 'qaWordCloud') {
          this.lastQaWordCloudProjectionKey = null;
        }
        return;
      }

      const projection = this.buildQaWordCloudPresenterProjection();
      untracked(() => this.publishQaWordCloudProjection(projection));
    });
    effect(() => {
      const request = this.freetextWordCloudSemanticAnalysisRequest();
      if (!request) {
        this.clearFreetextWordCloudSemanticAnalysisTimer();
        this.lastFreetextWordCloudSemanticRequestKey = null;
        this.freetextWordCloudSemanticAnalysisPending.set(false);
        this.freetextWordCloudSemanticPendingStartedAt = 0;
        this.clearFreetextWordCloudSemanticWaitHint();
        return;
      }

      untracked(() => {
        this.queueFreetextWordCloudSemanticAnalysis(request);
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
      this.hostDisplayMode.setHostSessionActive(this.isLiveHostSurface());
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
    /** Nach Session-Ende automatisch Vollbild beenden (z. B. nach »Veranstaltung starten«). */
    effect(() => {
      if (this.effectiveStatus() !== 'FINISHED') {
        return;
      }
      tryExitDocumentFullscreen(this.document, () => {
        this.isFullscreenActive.set(this.getFullscreenElement() !== null);
      });
    });
    effect(() => {
      const status = this.effectiveStatus();
      const question = this.displayedCurrentQuestionForHost();
      if (status !== 'RESULTS' || !question) {
        return;
      }
      const sources = this.localizeCurrentQuestionQuizSources(question);
      if (sources.length === 0) {
        return;
      }
      untracked(() => {
        this.moderationQuizSourceCache.update((existing) =>
          rememberModerationQuizSnapshot(existing, question.questionId, sources, question.type),
        );
      });
    });
    effect(() => {
      const preferred = this.freetextWordCloudLemmaPreferred();
      const visible = this.wordCloudExpanded() || this.freetextWordCloudMaximized();
      const mode = this.freetextWordCloudMode();
      const locale = this.qaWordCloudAnalysisLocale();
      const fingerprint = this.freetextWordCloudLemmaFingerprint();
      const pending = this.freetextWordCloudLemmaPending();
      const applied = this.freetextWordCloudLemmaResult()?.normalizationApplied;
      const fallback = this.freetextWordCloudLemmaFallbackReason();
      if (
        !preferred ||
        !visible ||
        (mode === 'SEMANTIC' &&
          isSemanticTopicCloudResult(this.freetextWordCloudSemanticAnalysisResult())) ||
        !locale ||
        !fingerprint ||
        pending ||
        applied === 'LEMMA' ||
        fallback
      ) {
        return;
      }

      untracked(() => {
        void this.requestFreetextWordCloudLemmaSmoothing();
      });
    });
    effect(() => {
      const preferred = this.qaWordCloudLemmaPreferred();
      const open = this.qaWordCloudDialogOpen();
      const variant = this.qaWordCloudEffectiveAnalysisVariant();
      const locale = this.qaWordCloudAnalysisLocale();
      const fingerprint = this.qaWordCloudLemmaFingerprint();
      const pending = this.qaWordCloudLemmaPending();
      const applied = this.qaWordCloudLemmaResult()?.normalizationApplied;
      const fallback = this.qaWordCloudLemmaFallbackReason();
      if (
        !preferred ||
        !open ||
        (variant === 'SEMANTIC' && !this.qaWordCloudSemanticPhraseFallback()) ||
        !locale ||
        !fingerprint ||
        pending ||
        applied === 'LEMMA' ||
        fallback
      ) {
        return;
      }

      untracked(() => {
        void this.requestQaWordCloudLemmaSmoothing();
      });
    });
    afterNextRender(
      () => {
        this.bindPresenterDesktopMedia();
      },
      { injector: this.injector },
    );
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

  async setFreetextWordCloudMode(mode: FreetextWordCloudMode | unknown): Promise<void> {
    const nextMode = resolveFreetextWordCloudMode(mode);
    if (!nextMode) {
      return;
    }

    if (nextMode === this.freetextWordCloudMode()) {
      return;
    }

    this.freetextWordCloudMode.set(nextMode);
    if (nextMode === 'SEMANTIC') {
      const shouldRefreshLemmaSmoothing = untracked(
        () =>
          this.freetextWordCloudLemmaPreferred() &&
          Boolean(this.qaWordCloudAnalysisLocale()) &&
          this.buildFreetextWordCloudLemmaItems().length > 0,
      );
      if (shouldRefreshLemmaSmoothing) {
        await this.requestFreetextWordCloudLemmaSmoothing();
      }
      return;
    }

    const shouldRefreshLemmaSmoothing = untracked(
      () =>
        this.freetextWordCloudLemmaPending() ||
        this.freetextWordCloudLemmaResult()?.normalizationApplied === 'LEMMA',
    );
    if (!shouldRefreshLemmaSmoothing) {
      return;
    }

    await this.requestFreetextWordCloudLemmaSmoothing();
  }

  async setWordCloudLemmaLocale(locale: string): Promise<void> {
    if (!isWordCloudLemmaLocale(locale)) {
      return;
    }

    if (locale === this.qaWordCloudAnalysisLocale()) {
      this.wordCloudLemmaLocaleOverride.set(locale);
      persistWordCloudLemmaLocaleOverride(this.code, locale);
      return;
    }

    this.wordCloudLemmaLocaleOverride.set(locale);
    persistWordCloudLemmaLocaleOverride(this.code, locale);

    const shouldRefreshFreetextSmoothing = untracked(
      () =>
        this.freetextWordCloudLemmaPending() ||
        this.freetextWordCloudLemmaResult()?.normalizationApplied === 'LEMMA',
    );
    const shouldRefreshQaSmoothing = untracked(
      () =>
        this.qaWordCloudLemmaPending() ||
        this.qaWordCloudLemmaResult()?.normalizationApplied === 'LEMMA',
    );

    if (shouldRefreshFreetextSmoothing) {
      await this.requestFreetextWordCloudLemmaSmoothing();
    }
    if (shouldRefreshQaSmoothing) {
      await this.requestQaWordCloudLemmaSmoothing();
    }
    if (untracked(() => this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC')) {
      const request = this.buildQaWordCloudAnalysisRequest();
      if (request) {
        this.queueQaWordCloudSemanticAnalysis(request);
      }
    }
  }

  async toggleFreetextWordCloudSmoothing(): Promise<void> {
    if (this.freetextWordCloudMode() === 'SEMANTIC' || this.freetextWordCloudLemmaPending()) {
      return;
    }

    if (this.freetextWordCloudSmoothingStatus() === 'active') {
      this.freetextWordCloudLemmaPreferred.set(false);
      this.clearFreetextWordCloudLemmaSmoothing();
      return;
    }

    this.freetextWordCloudLemmaPreferred.set(true);
    if (!this.qaWordCloudAnalysisLocale() || this.buildFreetextWordCloudLemmaItems().length === 0) {
      return;
    }

    await this.requestFreetextWordCloudLemmaSmoothing();
  }

  readonly maximizeFreetextWordCloud = (): void => {
    this.wordCloudExpanded.set(true);
    this.syncWordCloudOverlayTop();
    this.freetextWordCloudMaximized.set(true);
    void this.activatePresenterSurface('freetextWordCloud', 'quiz');
  };

  closeFreetextWordCloudMaximize(): void {
    this.freetextWordCloudMaximized.set(false);
    void this.syncPresenterSurface('default');
    this.clearWordCloudOverlayTop();
    this.wordCloudExpanded.set(true);
    this.freetextWordCloud?.revealFocusedOrSelectedResponses();
  }

  private closeOpenWordCloudOverlays(): void {
    if (this.freetextWordCloudMaximized()) {
      this.closeFreetextWordCloudMaximize();
    }
    this.qaWordCloudDialogRef?.close?.();
  }

  private syncWordCloudOverlayTop(): void {
    const marker = this.qaWordCloudDialogOpen()
      ? this.document.querySelector('app-top-toolbar')
      : this.document.querySelector('.session-channel-tabs-shell');
    const top =
      marker instanceof HTMLElement
        ? Math.max(0, Math.round(marker.getBoundingClientRect().bottom))
        : 0;
    this.document.documentElement.style.setProperty(
      '--session-host-word-cloud-overlay-top',
      `${top}px`,
    );
  }

  private clearWordCloudOverlayTop(): void {
    if (this.freetextWordCloudMaximized() || this.qaWordCloudDialogOpen()) {
      return;
    }
    this.document.documentElement.style.removeProperty('--session-host-word-cloud-overlay-top');
  }

  onFreetextWordCloudDetailsToggle(target: HTMLDetailsElement): void {
    if (this.freetextWordCloudMaximized()) {
      if (!target.open) {
        target.open = true;
      }
      return;
    }

    this.wordCloudExpanded.set(target.open);
  }

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

  finishedConfidencePriorityQuestions(
    summary: SessionConfidenceSummaryDTO,
  ): ConfidenceQuestionSummaryDTO[] {
    return selectConfidencePriorityQuestions(summary.questions, 3);
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

  toggleJoinInfoPopover(event?: Event): void {
    if (this.joinInfoPopoverOpen()) {
      this.closeJoinInfoPopover();
      return;
    }
    const eventTarget = event?.currentTarget;
    const activeElement = this.document.activeElement;
    this.joinInfoFocusReturn =
      eventTarget instanceof HTMLElement
        ? eventTarget
        : activeElement instanceof HTMLElement
          ? activeElement
          : null;
    this.joinInfoPopoverOpen.set(true);
  }

  closeJoinInfoPopover(): void {
    const focusReturn =
      this.joinInfoFocusReturn ??
      this.document.querySelector<HTMLElement>('[aria-controls="session-host-join-info"]');
    this.joinInfoFocusReturn = null;
    this.joinInfoPopoverOpen.set(false);
    queueMicrotask(() => {
      if (focusReturn?.isConnected) {
        focusReturn.focus({ preventScroll: true });
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydownCloseJoinPopover(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') {
      return;
    }
    if ((this.dialog.openDialogs?.length ?? 0) > 0) {
      return;
    }
    if (this.freetextWordCloudMaximized()) {
      this.closeFreetextWordCloudMaximize();
      ev.preventDefault();
      return;
    }
    if (this.participantDirectoryOpen()) {
      this.participantDirectoryOpen.set(false);
      ev.preventDefault();
      return;
    }
    if (this.joinInfoPopoverOpen()) {
      this.closeJoinInfoPopover();
      ev.preventDefault();
      return;
    }
    void this.clearQaAuthorFilter();
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

  private refreshDurableHostAccess(): Promise<void> {
    if (this.hostAccessRefreshInFlight) return this.hostAccessRefreshInFlight;
    if (this.isPairedHostClient()) return Promise.resolve();
    const browserCapability = getHostBrowserCapability(this.code);
    if (!browserCapability) return Promise.resolve();
    this.hostAccessRefreshInFlight = trpc.session.issueHostAccessToken
      .mutate({ code: this.code, browserCapability })
      .then((issued) => {
        setHostToken(this.code, issued.hostToken);
        refreshTrpcWsBinding();
      })
      .catch(() => {
        // Der bestehende Token bleibt bis zu seinem eigenen Ablauf nutzbar; Reconnects bleiben fail-closed.
      })
      .finally(() => {
        this.hostAccessRefreshInFlight = null;
      });
    return this.hostAccessRefreshInFlight;
  }

  private startHostAccessRefresh(): void {
    if (this.hostAccessRefreshTimer || this.isPairedHostClient()) return;
    void this.refreshDurableHostAccess();
    this.hostAccessRefreshTimer = setInterval(
      () => void this.refreshDurableHostAccess(),
      10 * 60 * 1000,
    );
  }

  private showStagedRecoveryCard(setup?: {
    setupStep: number;
    setupStepCount: number;
  }): Promise<boolean | undefined> {
    if (this.recoveryCardDialogOpened || !this.channels().qa) {
      return Promise.resolve(undefined);
    }
    if (this.qaChannelNeedsConfiguration()) {
      return Promise.resolve(undefined);
    }
    const recoveryCard = getStagedHostRecoveryCard(this.code);
    if (!recoveryCard) {
      return Promise.resolve(undefined);
    }
    this.recoveryCardDialogOpened = true;
    return firstValueFrom(
      this.dialog
        .open(HostRecoveryCardDialogComponent, {
          data: setup ? { ...recoveryCard, ...setup } : recoveryCard,
          disableClose: true,
          autoFocus: 'dialog',
          restoreFocus: !setup,
          maxWidth: 'min(38rem, calc(100vw - 2rem))',
          ...SESSION_LIFECYCLE_DIALOG_OVERLAY,
          panelClass: ['session-lifecycle-dialog-panel', 'host-recovery-card-dialog-panel'],
          backdropClass: [
            'session-lifecycle-dialog-backdrop',
            'host-recovery-card-dialog-backdrop',
          ],
          ariaDescribedBy: 'host-recovery-card-description',
        })
        .afterClosed(),
    ).then(async (confirmed) => {
      this.recoveryCardDialogOpened = false;
      if (confirmed === true) {
        clearStagedHostRecoveryCard(this.code);
        this.completeQaCreateSetup();
        await this.startQaAfterCreateSetup();
      }
      return confirmed;
    });
  }

  private completeQaCreateSetup(): void {
    this.qaCreateSetupCompleted = true;
    if (this.route.snapshot?.queryParamMap?.get('qaSetup') !== '1') {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { qaSetup: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Nach 1/2–2/2 nicht in der leeren Lobby hängen bleiben; Button bleibt für Reload in LOBBY. */
  private async startQaAfterCreateSetup(): Promise<void> {
    if (!this.requestedQaCreateSetup || !this.channels().qa) {
      return;
    }
    if (this.effectiveStatus() !== 'LOBBY') {
      return;
    }
    await this.startQa();
    afterNextRender(() => this.focusQaWallAfterCreateSetup(), { injector: this.injector });
  }

  private focusQaWallAfterCreateSetup(): void {
    if (this.effectiveStatus() !== 'ACTIVE') {
      return;
    }
    this.qaChannelHeadingRef?.nativeElement.focus({ preventScroll: true });
  }

  async ngOnInit(): Promise<void> {
    if (this.code.length !== 6) return;
    if (this.isPairedHostClient()) {
      this.sound.setOutputEnabled(false);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.startHostAccessRefresh();
    // Preset "Seriös/Business" startet standardmäßig ohne Musik.
    this.musicMuted.set(this.themePreset.preset() === 'serious');
    try {
      await this.reloadSessionInfo();
    } catch {
      this.session.set(null);
      return;
    }
    await this.refreshSessionLifecycle();
    if (this.requestedQaCreateSetup && this.qaChannelNeedsConfiguration()) {
      await this.openQaConfigurationDialog({
        abortUnconfiguredSessionOnCancel: true,
      });
    } else {
      await this.showStagedRecoveryCard(
        this.requestedQaCreateSetup && !this.qaCreateSetupCompleted
          ? { setupStep: 2, setupStepCount: 2 }
          : undefined,
      );
    }
    void this.refreshPairedHostStatus();
    try {
      await this.refreshParticipantsPayload();
      await this.refreshLobbyTeams();
      await this.refreshQaQuestions();
      await this.refreshQaNlpRuntime();
      await this.refreshQaSummaryRuntime();
      await this.refreshQuickFeedbackResult();
    } catch {
      // Session bleibt sichtbar; Kanal-Teilansichten können leer bleiben.
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
    const session = await trpc.session.getInfoForReconnect.query({
      code: this.code.toUpperCase(),
      anonymousClientId: getAnonymousClientId(),
    });
    recordServerTimeSample(session.serverTime, requestedAt);
    this.sessionUnavailable.set(false);
    this.keepHostTokenOnDeactivate = false;
    this.session.set(session);
    if (session.status !== 'FINISHED') {
      const statusUpdate = this.statusUpdate();
      if (statusUpdate?.status === 'FINISHED') {
        this.statusUpdate.set({
          status: session.status,
          currentQuestion: session.currentQuestion ?? null,
          currentRound: session.currentRound ?? 1,
          expiresAt: session.expiresAt,
          serverNow: session.serverTime,
          sessionLifecycleRevision: session.sessionLifecycleRevision,
          endedAt: session.endedAt ?? null,
        });
      }
    }
    this.syncQaTitleDraftFromSession();
    this.scheduleQaDeadlineCheck();
    return session;
  }

  private async refreshSessionLifecycle(): Promise<void> {
    if (!this.code || this.sessionLifecyclePending() || this.hostAccessRevoked()) {
      return;
    }
    this.sessionLifecyclePending.set(true);
    try {
      const lifecycle = await trpc.session.getLifecycleForHost.query({
        code: this.code.toUpperCase(),
      });
      this.sessionLifecycle.set(lifecycle);
      this.sessionDeadline.applySnapshot(lifecycle);
      this.session.update((current) =>
        current
          ? {
              ...current,
              expiresAt: lifecycle.expiresAt,
              qaClosesAt: lifecycle.qaClosesAt,
              serverNow: lifecycle.serverNow,
              sessionLifecycleRevision: lifecycle.sessionLifecycleRevision,
            }
          : current,
      );
      this.scheduleQaDeadlineCheck();
      if (lifecycle.status === 'FINISHED' || this.sessionDeadline.isExpired()) {
        this.statusUpdate.set({
          status: 'FINISHED',
          currentQuestion: null,
          currentRound: 1,
          expiresAt: lifecycle.expiresAt,
          serverNow: lifecycle.serverNow,
          sessionLifecycleRevision: lifecycle.sessionLifecycleRevision,
          endedAt: lifecycle.endedAt,
        });
        if (lifecycle.postProcessingEndsAt) {
          this.postProcessingDeadline.applySnapshot({
            status: lifecycle.hostContentAccessAllowed ? 'ACTIVE' : 'FINISHED',
            serverNow: lifecycle.serverNow,
            expiresAt: lifecycle.postProcessingEndsAt,
            sessionLifecycleRevision: lifecycle.sessionLifecycleRevision,
          });
        }
        if (
          !lifecycle.hostContentAccessAllowed ||
          !lifecycle.postProcessingEndsAt ||
          this.postProcessingDeadline.isExpired()
        ) {
          this.stopSessionLifecycleTimer();
          this.closeHostPostProcessing();
        } else {
          this.postProcessingEnded.set(false);
          this.scheduleHostPostProcessingCheck();
          this.ensureQaSubscription();
          void this.refreshQaQuestions({ silent: true });
        }
        return;
      }
      this.scheduleSessionLifecycleCheck();
    } catch {
      // Die Status-Subscription bleibt maßgeblich; Warnungen werden beim nächsten Snapshot erneut geplant.
    } finally {
      this.sessionLifecyclePending.set(false);
    }
  }

  private scheduleSessionLifecycleCheck(): void {
    this.stopSessionLifecycleTimer();
    const remaining = this.sessionDeadline.remainingMs();
    if (remaining === null || remaining <= 0) {
      if (this.sessionDeadline.isExpired()) {
        this.statusUpdate.set({
          status: 'FINISHED',
          currentQuestion: null,
          currentRound: 1,
        });
      }
      return;
    }
    this.maybeOpenSessionExpirationWarning(remaining);
    const nextBoundary =
      remaining > 30 * 60_000
        ? remaining - 30 * 60_000
        : remaining > 5 * 60_000
          ? remaining - 5 * 60_000
          : remaining;
    this.sessionLifecycleTimer = setTimeout(
      () => {
        this.sessionLifecycleTimer = null;
        this.scheduleSessionLifecycleCheck();
      },
      Math.max(1, Math.min(nextBoundary, 60_000)),
    );
  }

  private stopSessionLifecycleTimer(): void {
    if (this.sessionLifecycleTimer) {
      clearTimeout(this.sessionLifecycleTimer);
      this.sessionLifecycleTimer = null;
    }
  }

  private scheduleQaDeadlineCheck(): void {
    if (this.qaDeadlineTimer) {
      clearTimeout(this.qaDeadlineTimer);
      this.qaDeadlineTimer = null;
    }
    this.qaDeadlineNow.set(getSkewAdjustedNow());
    const closesAt = this.session()?.channels?.qa.closesAt ?? this.session()?.qaClosesAt;
    if (!closesAt || (this.effectiveStatus() === 'FINISHED' && !this.qaHostWritesAllowed())) {
      return;
    }
    const remainingMs = Date.parse(closesAt) - this.qaDeadlineNow();
    if (remainingMs <= 0) {
      this.session.update((current) =>
        current?.channels
          ? {
              ...current,
              channels: {
                ...current.channels,
                qa: {
                  ...current.channels.qa,
                  open: false,
                  state: 'DEADLINE_EXPIRED',
                },
              },
            }
          : current,
      );
      void this.refreshQaQuestions({ silent: true });
      return;
    }
    this.qaDeadlineTimer = setTimeout(
      () => {
        this.qaDeadlineTimer = null;
        this.scheduleQaDeadlineCheck();
      },
      Math.max(1, Math.min(remainingMs, 60_000)),
    );
  }

  private scheduleHostPostProcessingCheck(): void {
    this.stopSessionLifecycleTimer();
    const remaining = this.postProcessingDeadline.remainingMs();
    if (remaining === null || remaining <= 0 || this.postProcessingDeadline.isExpired()) {
      this.closeHostPostProcessing();
      return;
    }
    this.sessionLifecycleTimer = setTimeout(
      () => {
        this.sessionLifecycleTimer = null;
        this.scheduleHostPostProcessingCheck();
      },
      Math.max(1, Math.min(remaining, 60_000)),
    );
  }

  private maybeOpenSessionExpirationWarning(remainingMs: number): void {
    const lifecycle = this.sessionLifecycle();
    if (!lifecycle || this.sessionLifecycleDialogOpen || remainingMs > 30 * 60_000) {
      return;
    }
    const warningMinutes: 30 | 5 = remainingMs <= 5 * 60_000 ? 5 : 30;
    const storageKey = `session-expiration-warning:${this.code}:${lifecycle.sessionLifecycleRevision}:${warningMinutes}`;
    try {
      if (sessionStorage.getItem(storageKey) === '1') return;
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // SessionStorage ist optional; ohne Speicher kann die Warnung nach Reload erneut erscheinen.
    }
    void this.openSessionExpirationDialog(
      { mode: 'GLOBAL_WARNING', warningMinutes, lifecycle },
      this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null,
    );
  }

  async openSessionRetentionDetails(event?: Event): Promise<void> {
    const lifecycle = this.sessionLifecycle();
    if (!lifecycle?.postProcessingEndsAt || !lifecycle.expectedDeletionAt) {
      return;
    }
    const focusReturn =
      event?.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : this.document.activeElement instanceof HTMLElement
          ? this.document.activeElement
          : null;
    const dialogRef = this.dialog.open(SessionRetentionDialogComponent, {
      data: { lifecycle },
      width: 'min(32rem, calc(100vw - 2rem))',
      maxWidth: '100vw',
      autoFocus: 'first-tabbable',
      restoreFocus: false,
      ...SESSION_LIFECYCLE_DIALOG_OVERLAY,
    });
    await firstValueFrom(dialogRef.afterClosed());
    if (focusReturn?.isConnected) {
      focusReturn.focus({ preventScroll: true });
    }
  }

  async openSessionLifecycleConfiguration(event?: Event): Promise<void> {
    const lifecycle = this.sessionLifecycle();
    if (!lifecycle?.configurationAllowed || this.sessionLifecycleDialogOpen) {
      return;
    }
    const focusReturn =
      event?.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : this.document.activeElement instanceof HTMLElement
          ? this.document.activeElement
          : null;
    await this.openSessionExpirationDialog(
      { mode: 'INITIAL_CONFIGURATION', lifecycle },
      focusReturn,
    );
  }

  private async openSessionExpirationDialog(
    data:
      | {
          mode: 'INITIAL_CONFIGURATION';
          lifecycle: SessionLifecycleHostDTO;
        }
      | {
          mode: 'GLOBAL_WARNING';
          warningMinutes: 30 | 5;
          lifecycle: SessionLifecycleHostDTO;
        },
    focusReturn: HTMLElement | null,
  ): Promise<void> {
    if (this.sessionLifecycleDialogOpen) return;
    this.sessionLifecycleDialogOpen = true;
    try {
      const result = await firstValueFrom(
        this.dialog
          .open(SessionExpirationDialogComponent, {
            data,
            width: 'min(36rem, calc(100vw - 2rem))',
            maxWidth: '100vw',
            autoFocus: 'first-tabbable',
            restoreFocus: false,
            ...SESSION_LIFECYCLE_DIALOG_OVERLAY,
          })
          .afterClosed(),
      );
      if (result) {
        await this.confirmAndChangeSessionExpiration(result, focusReturn);
      }
    } finally {
      this.sessionLifecycleDialogOpen = false;
      if (focusReturn?.isConnected) {
        focusReturn.focus({ preventScroll: true });
      }
      this.scheduleSessionLifecycleCheck();
    }
  }

  private async confirmAndChangeSessionExpiration(
    selection: SessionExpirationDialogResult,
    focusReturn: HTMLElement | null,
  ): Promise<void> {
    try {
      const preview =
        selection.purpose === 'INITIAL_CONFIGURATION'
          ? await trpc.session.previewExpiration.query({
              code: this.code.toUpperCase(),
              purpose: selection.purpose,
              selection: selection.selection,
              timeZone: selection.timeZone,
            })
          : await trpc.session.previewExpiration.query({
              code: this.code.toUpperCase(),
              purpose: selection.purpose,
              selection: selection.selection,
            });
      const confirmed = await this.confirmSessionExpirationPreview(preview, focusReturn);
      if (!confirmed) return;

      const updated =
        selection.purpose === 'INITIAL_CONFIGURATION'
          ? await trpc.session.changeExpiration.mutate({
              code: this.code.toUpperCase(),
              purpose: selection.purpose,
              selection: selection.selection,
              timeZone: selection.timeZone,
              expectedLifecycleRevision: preview.expectedLifecycleRevision,
              confirmedExpiresAt: preview.newExpiresAt,
            })
          : await trpc.session.changeExpiration.mutate({
              code: this.code.toUpperCase(),
              purpose: selection.purpose,
              selection: selection.selection,
              expectedLifecycleRevision: preview.expectedLifecycleRevision,
              confirmedExpiresAt: preview.newExpiresAt,
            });
      this.sessionLifecycle.set(updated);
      this.sessionDeadline.applySnapshot(updated);
      this.session.update((current) =>
        current
          ? {
              ...current,
              expiresAt: updated.expiresAt,
              serverNow: updated.serverNow,
              sessionLifecycleRevision: updated.sessionLifecycleRevision,
            }
          : current,
      );
      this.snackBar.open(
        $localize`:@@sessionLifecycle.changedSuccess:Die Sessionfrist wurde gespeichert.`,
        $localize`:@@common.close:Schließen`,
        { duration: 5000 },
      );
    } catch (error) {
      this.snackBar.open(
        localizeKnownServerError(
          error,
          $localize`:@@sessionLifecycle.changeError:Die Sessionfrist konnte nicht geändert werden.`,
        ),
        $localize`:@@common.close:Schließen`,
        { duration: 7000 },
      );
      await this.refreshSessionLifecycle();
    }
  }

  private async confirmSessionExpirationPreview(
    preview: SessionExpirationPreviewDTO,
    focusReturn: HTMLElement | null,
  ): Promise<boolean> {
    const consequences = [
      $localize`:@@sessionLifecycle.previewOld:Bislang: ${this.formatSessionLifecycleDateTime(
        preview.oldExpiresAt,
        preview.timeZone,
      )}`,
      $localize`:@@sessionLifecycle.previewNew:Neu: ${this.formatSessionLifecycleDateTime(
        preview.newExpiresAt,
        preview.timeZone,
      )}`,
    ];
    if (preview.purpose === 'GLOBAL_EXTENSION' && preview.qaClosesAt) {
      consequences.push(
        $localize`:@@sessionLifecycle.previewQaUnchanged:Q&A bleibt unverändert bei: ${this.formatSessionLifecycleDateTime(
          preview.qaClosesAt,
          preview.timeZone,
        )}`,
      );
    }
    consequences.push(
      $localize`:@@sessionLifecycle.previewPostProcessing:Host-Lesezugriff bis: ${this.formatSessionLifecycleDateTime(
        preview.projectedPostProcessingEndsAt,
        preview.timeZone,
      )}`,
      $localize`:@@sessionLifecycle.previewPurgeEligible:Sessiondaten frühestens löschbar: ${this.formatSessionLifecycleDateTime(
        preview.projectedPurgeEligibleAt,
        preview.timeZone,
      )}`,
    );
    const dialogRef = this.dialog.open(ConfirmLeaveDialogComponent, {
      data: {
        title: $localize`:@@sessionLifecycle.previewTitle:Neues Sessionende bestätigen`,
        message:
          preview.purpose === 'GLOBAL_EXTENSION'
            ? $localize`:@@sessionLifecycle.previewExtensionMessage:Nur das globale Sessionende wird verlängert.`
            : $localize`:@@sessionLifecycle.previewInitialMessage:Gespeichert wird nur das Sessionende. Es begrenzt, wie lange die Fragerunde höchstens offen bleiben kann; der konkrete Teilnahmeschluss wird damit nicht gesetzt.`,
        consequences,
        confirmLabel: $localize`:@@sessionLifecycle.previewConfirm:Frist verbindlich speichern`,
        cancelLabel: $localize`:@@sessionLifecycle.previewCancel:Abbrechen`,
      } satisfies ConfirmLeaveDialogData,
      width: 'min(32rem, calc(100vw - 2rem))',
      maxWidth: '100vw',
      autoFocus: 'first-tabbable',
      restoreFocus: false,
      ...SESSION_LIFECYCLE_DIALOG_OVERLAY,
    });
    const confirmed = (await firstValueFrom(dialogRef.afterClosed())) === true;
    if (!confirmed && focusReturn?.isConnected) {
      focusReturn.focus({ preventScroll: true });
    }
    return confirmed;
  }

  formatSessionLifecycleDateTime(value: string, timeZone?: string): string {
    return new Intl.DateTimeFormat(this.localeId, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timeZone ?? this.sessionLifecycle()?.timeZone ?? 'UTC',
      timeZoneName: 'short',
    }).format(new Date(value));
  }

  private ensureParticipantSubscription(): void {
    if (!this.code || this.participantSub || this.hostAccessRevoked()) {
      return;
    }
    this.participantSub = trpc.session.onParticipantJoined.subscribe(
      { code: this.code.toUpperCase() },
      {
        onData: (data) => {
          this.updateParticipantsPayload(this.participantSummaryToPayload(data));
        },
        onError: (error) => {
          this.participantSub?.unsubscribe();
          this.participantSub = null;
          if (this.consumeHostUnauthorized(error)) return;
          this.burstHostFallbackAfterWsGap();
        },
      },
    );
  }

  private ensureStatusSubscription(): void {
    if (!this.code || this.statusSub || this.hostAccessRevoked()) {
      return;
    }
    this.statusSub = trpc.session.onStatusChanged.subscribe(
      {
        code: this.code.toUpperCase(),
        anonymousClientId: getAnonymousClientId(),
      },
      {
        onData: (data) => {
          if (data.serverTime) {
            recordServerTimeIso(data.serverTime);
          }
          if (data.serverNow) {
            recordServerTimeIso(data.serverNow);
          }
          const update = {
            status: data.status as SessionStatusUpdate['status'],
            currentQuestion: data.currentQuestion,
            expiresAt: data.expiresAt,
            serverNow: data.serverNow,
            sessionLifecycleRevision: data.sessionLifecycleRevision,
            endedAt: data.endedAt,
            activeAt: data.activeAt ?? undefined,
            timer: data.timer,
            currentRound: data.currentRound,
            channels: data.channels,
            preferredChannel: data.preferredChannel,
            presenterSurface: data.presenterSurface,
            enableTimerAccommodation: data.enableTimerAccommodation,
          } satisfies SessionStatusUpdate;
          if (data.enableTimerAccommodation !== undefined) {
            this.session.update((current) =>
              current
                ? { ...current, enableTimerAccommodation: data.enableTimerAccommodation }
                : current,
            );
          }
          if (update.status === 'LOBBY' || update.status === 'FINISHED') {
            this.quizStartQuestionPending.set(false);
            this.clearHostQuestionDetailsRetry();
          }
          this.clearFoyerArrivalStateWhenLeavingLobby(update.status);
          this.statusUpdate.set(update);
          if (data.channels || data.preferredChannel) {
            this.session.update((current) =>
              current
                ? {
                    ...current,
                    ...(data.channels ? { channels: data.channels } : {}),
                    ...(data.preferredChannel ? { preferredChannel: data.preferredChannel } : {}),
                  }
                : current,
            );
            this.ensureActiveChannel();
            this.scheduleQaDeadlineCheck();
          }
          if (
            data.serverNow &&
            data.expiresAt &&
            data.sessionLifecycleRevision !== undefined &&
            this.sessionDeadline.applySnapshot(data)
          ) {
            this.session.update((current) =>
              current
                ? {
                    ...current,
                    expiresAt: data.expiresAt,
                    serverNow: data.serverNow,
                    sessionLifecycleRevision: data.sessionLifecycleRevision,
                  }
                : current,
            );
            const lifecycle = this.sessionLifecycle();
            if (
              update.status === 'FINISHED' ||
              (lifecycle && lifecycle.sessionLifecycleRevision !== data.sessionLifecycleRevision)
            ) {
              void this.refreshSessionLifecycle();
            } else {
              this.scheduleSessionLifecycleCheck();
            }
          }
          this.syncCountdownFromStatusUpdate(update);
        },
        onError: (error) => {
          this.statusSub?.unsubscribe();
          this.statusSub = null;
          if (this.consumeHostUnauthorized(error)) return;
          this.burstHostFallbackAfterWsGap();
        },
      },
    );
  }

  private ensureCurrentQuestionSubscription(): void {
    if (!this.code || this.currentQuestionSub || this.hostAccessRevoked()) {
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
        onError: (error) => {
          this.currentQuestionSub?.unsubscribe();
          this.currentQuestionSub = null;
          if (this.consumeHostUnauthorized(error)) return;
          this.burstHostFallbackAfterWsGap();
        },
      },
    );
  }

  private ensureVoteProgressSubscription(): void {
    if (!this.code || this.voteProgressSub || this.hostAccessRevoked()) {
      return;
    }
    this.voteProgressSub = trpc.session.onHostVoteProgressChanged.subscribe(
      { code: this.code.toUpperCase() },
      {
        onData: (data) => {
          this.syncHostVoteProgress(data);
        },
        onError: (error) => {
          this.voteProgressSub?.unsubscribe();
          this.voteProgressSub = null;
          if (this.consumeHostUnauthorized(error)) return;
          this.burstHostFallbackAfterWsGap();
        },
      },
    );
  }

  private startHostPolling(): void {
    if (this.hostAccessRevoked()) {
      return;
    }
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
      await this.refreshQaQuestions({ silent: true });
    }
    if (this.shouldPollQuickFeedback()) {
      await this.refreshQuickFeedbackResult();
    }
    if (this.shouldPollEmojiReactions()) {
      await this.refreshEmojiReactions();
    }
  }

  private async refreshRealtimeHostFallback(): Promise<void> {
    if (this.hostAccessRevoked()) {
      return;
    }
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
    if (this.hostAccessRevoked()) {
      return;
    }
    this.hostRealtimeFallbackActive = true;
    this.startHostPolling();
    this.runRealtimeFallbackCycle();
    this.runAuxiliaryPollCycle();
    this.scheduleHostRealtimeSubscriptionRetry();
  }

  private scheduleHostRealtimeSubscriptionRetry(): void {
    if (this.hostAccessRevoked()) {
      return;
    }
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
    this.unbindPresenterDesktopMedia();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (this.hostAccessRefreshTimer) {
      clearInterval(this.hostAccessRefreshTimer);
      this.hostAccessRefreshTimer = null;
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
    if (this.qaSearchTimer) {
      clearTimeout(this.qaSearchTimer);
      this.qaSearchTimer = null;
    }
    if (this.participantDirectorySearchTimer) {
      clearTimeout(this.participantDirectorySearchTimer);
      this.participantDirectorySearchTimer = null;
    }
    this.clearQaWordCloudThemeAnalysisTimer();
    this.clearFreetextWordCloudSemanticAnalysisTimer();
    this.clearQaWordCloudSemanticWaitHint();
    this.clearFreetextWordCloudSemanticWaitHint();
    this.qaWordCloudLemmaAnalysisRunId += 1;
    this.freetextWordCloudLemmaAnalysisRunId += 1;
    this.freetextWordCloudSemanticAnalysisRunId += 1;
    this.clearHostQuestionDetailsRetry();
    this.clearQuizAttachSessionInfoRetry();
    this.clearHostRealtimeSubscriptionRetry();
    this.stopHostPolling();
    this.stopSessionLifecycleTimer();
    if (this.qaDeadlineTimer) {
      clearTimeout(this.qaDeadlineTimer);
      this.qaDeadlineTimer = null;
    }
    this.clearFoyerArrivalState();
    this.stopCountdown();
    this.stopQaSummaryPolling();
    this.sound.stopAll();
    if (this.isPairedHostClient() || this.hostAccessRevoked()) {
      this.sound.setOutputEnabled(true);
    }
    this.closeOpenWordCloudOverlays();
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

  async openPresenterView(): Promise<void> {
    if (!this.showPresenterViewButton() || this.presenterWindowOpenInFlight) {
      return;
    }
    this.tryEnterHostFullscreenFromUserGesture();
    const decision = await firstValueFrom(
      this.dialog
        .open(PresentationStartDialogComponent, {
          data: {
            code: this.code.toUpperCase(),
            phoneAlreadyConnected: this.pairedHostConnected(),
            startPresenterView: () => this.launchPresenterViewWindow(),
          },
          autoFocus: 'first-tabbable',
          restoreFocus: true,
          panelClass: 'presentation-start-dialog-panel',
          backdropClass: 'presentation-start-dialog-backdrop',
        })
        .afterClosed(),
    );
    void this.refreshPairedHostStatus();
    if (decision === 'blocked') {
      this.snackBar.open(
        $localize`:@@sessionHost.presenterViewPopupBlocked:Das Präsentationsfenster konnte nicht geöffnet werden. Erlaube Pop-up-Fenster für diese Seite und versuche es erneut.`,
        '',
        { duration: 6000 },
      );
    }
  }

  private async launchPresenterViewWindow(): Promise<Window | null> {
    if (this.presenterWindowOpenInFlight) {
      return null;
    }
    this.presenterWindowOpenInFlight = true;
    try {
      return await openPresenterViewWindow(
        this.document.defaultView,
        this.code,
        this.sessionTokenStorage,
      );
    } finally {
      this.presenterWindowOpenInFlight = false;
    }
  }

  private async refreshPairedHostStatus(): Promise<void> {
    try {
      const listed = await trpc.session.listPairedHosts.query({
        code: this.code.toUpperCase(),
      });
      if (this.hostAccessRevoked()) return;
      this.pairedHostConnected.set(listed.devices.length > 0);
      this.canManagePairedHosts.set(true);
      this.applyHostTwinMode(false);
    } catch (error: unknown) {
      if (this.consumeHostUnauthorized(error)) {
        return;
      }
      if (isOriginalHostForbiddenError(error)) {
        this.canManagePairedHosts.set(false);
        this.applyHostTwinMode(true);
      }
    }
  }

  private applyHostTwinMode(paired: boolean): void {
    this.isPairedHostClient.set(paired);
    this.sound.setOutputEnabled(!paired && !this.hostAccessRevoked());
    if (paired) {
      this.sound.stopAll();
    }
  }

  private consumeHostUnauthorized(error: unknown): boolean {
    if (this.hostAccessRevoked()) {
      return true;
    }
    if (!hasHostToken(this.code) && !this.isPairedHostClient()) {
      return false;
    }
    if (!isHostAccessRevokedError(error)) {
      return false;
    }
    this.markHostAccessRevoked();
    return true;
  }

  private markHostAccessRevoked(): void {
    if (this.hostAccessRevoked()) {
      return;
    }
    this.hostAccessRevoked.set(true);
    this.canManagePairedHosts.set(false);
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
    this.clearHostRealtimeSubscriptionRetry();
    this.stopHostPolling();
    this.sound.setOutputEnabled(false);
    this.sound.stopAll();
    this.syncCurrentQuestionForHost(null);
    this.clearSessionTokens();
  }

  async goHomeAfterHostRevoke(): Promise<void> {
    await this.exitFullscreenBeforeHomeNavigation();
    await this.ngZone.run(async () => {
      await this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
    });
  }

  private bindPresenterDesktopMedia(): void {
    const win = this.document.defaultView;
    this.showPresenterViewButton.set(isPresenterViewOffered(win));
    if (!win || typeof win.matchMedia !== 'function') {
      return;
    }
    try {
      const mediaQuery = win.matchMedia(PRESENTER_VIEW_OFFERED_MEDIA);
      this.presenterDesktopMediaQuery = mediaQuery;
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', this.onPresenterDesktopMediaChange);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(this.onPresenterDesktopMediaChange);
      }
    } catch {
      this.showPresenterViewButton.set(true);
    }
  }

  private moveFocusFromPresenterButton(): void {
    const active = this.document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return;
    }
    if (!active.closest('[data-testid="open-presenter-view"]')) {
      return;
    }
    const toolbar = active.closest('.session-host__view-controls');
    const scope = toolbar?.parentElement ?? active.closest('.session-host') ?? this.document.body;
    const preferred = Array.from(
      (toolbar ?? scope).querySelectorAll<HTMLElement>(
        '.session-host__view-toggle--fullscreen, .session-host__view-toggle--frame',
      ),
    );
    const broader = Array.from(
      scope.querySelectorAll<HTMLElement>(
        [
          '.session-host__channel-visibility-action',
          '.session-channel-tabs button',
          '.session-host__live-actions button',
          'button',
          '[href]',
          'input',
          'select',
          'textarea',
          '[tabindex]:not([tabindex="-1"])',
        ].join(', '),
      ),
    );
    const fallback = [...preferred, ...broader].find(
      (candidate) =>
        candidate !== active &&
        !candidate.closest('[data-testid="open-presenter-view"]') &&
        this.isElementVisibleForFocus(candidate),
    );
    if (!fallback) {
      return;
    }
    try {
      fallback.focus({ preventScroll: true });
    } catch {
      /* Fokusziel darf das Ausblenden nicht blockieren */
    }
  }

  private isElementVisibleForFocus(element: HTMLElement): boolean {
    if (!element.isConnected || element.hasAttribute('disabled')) {
      return false;
    }
    if (element.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    if (typeof element.checkVisibility === 'function') {
      try {
        return element.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        });
      } catch {
        /* Fallback auf computed styles */
      }
    }
    const style = this.document.defaultView?.getComputedStyle(element);
    if (!style) {
      return true;
    }
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.contentVisibility !== 'hidden'
    );
  }

  private unbindPresenterDesktopMedia(): void {
    const mediaQuery = this.presenterDesktopMediaQuery;
    if (!mediaQuery) {
      return;
    }
    if (typeof mediaQuery.removeEventListener === 'function') {
      mediaQuery.removeEventListener('change', this.onPresenterDesktopMediaChange);
    } else if (typeof mediaQuery.removeListener === 'function') {
      mediaQuery.removeListener(this.onPresenterDesktopMediaChange);
    }
    this.presenterDesktopMediaQuery = null;
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
    tryAutoRequestDocumentFullscreen(this.document, () => {
      this.isFullscreenActive.set(this.getFullscreenElement() !== null);
    });
  }

  /** Prüft, ob die Session noch läuft (nicht FINISHED und nicht null). */
  private isSessionActive(): boolean {
    const status = this.effectiveStatus();
    return !this.sessionUnavailable() && status !== null && status !== 'FINISHED';
  }

  private async leaveHostViewKeepingQaOpen(): Promise<void> {
    await this.ensureStandaloneQaStartedBeforeLeave();
    await this.closeQuickFeedbackBeforeKeepingQa();
    await this.exitFullscreenBeforeHomeNavigation();
    await this.ngZone.run(async () => {
      await this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
    });
  }

  private async closeQuickFeedbackBeforeKeepingQa(): Promise<void> {
    if (!this.code || !this.channels().quickFeedback || !this.isChannelOpen('quickFeedback')) {
      return;
    }
    try {
      const channels = await trpc.session.closeQuickFeedbackChannel.mutate({
        code: this.code.toUpperCase(),
      });
      this.patchSessionChannels(channels);
    } catch {
      // Q&A bleibt offen; ein noch laufendes Blitzlicht darf das Verlassen nicht blockieren.
    }
  }

  private async ensureStandaloneQaStartedBeforeLeave(): Promise<void> {
    if (!this.code || this.effectiveStatus() !== 'LOBBY') {
      return;
    }
    try {
      const result = await trpc.session.startQa.mutate({ code: this.code.toUpperCase() });
      this.clearFoyerArrivalStateWhenLeavingLobby(result.status);
      this.statusUpdate.set(result);
    } catch {
      // Session bleibt offen; Teilnehmende können später beitreten.
    }
  }

  private isSessionNotFoundError(error: unknown): boolean {
    return error instanceof Error && error.message.includes(SESSION_NOT_FOUND_MESSAGE);
  }

  private isSessionAlreadyFinishedError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('Session ist bereits beendet.');
  }

  private shouldWarnOnBeforeUnload(): boolean {
    if (this.hostAccessRevoked()) {
      return false;
    }
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

  private clearSessionTokens(options?: { keepHostToken?: boolean }): void {
    if (!this.code) {
      return;
    }
    if (!options?.keepHostToken) {
      clearHostToken(this.code);
      void this.sessionTokenStorage.clearHostToken(this.code);
    }
    clearFeedbackHostToken(this.code);
  }

  private markSessionUnavailable(options?: { keepHostToken?: boolean }): void {
    this.keepHostTokenOnDeactivate = options?.keepHostToken === true;
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
    this.clearSessionTokens(options);
  }

  private markSessionFinishedLocally(): void {
    this.stopCountdown();
    this.countdownSeconds.set(null);
    this.syncCurrentQuestionForHost(null);
    this.statusUpdate.set({
      status: 'FINISHED',
      currentQuestion: null,
      activeAt: undefined,
    });
    this.session.update((session) => (session ? { ...session, status: 'FINISHED' } : session));
  }

  private async navigateHomeAfterSessionUnavailable(): Promise<void> {
    this.markSessionUnavailable();
    await this.exitFullscreenBeforeHomeNavigation();
    await this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
  }

  dismissHostSteeringCallout(): void {
    this.hostSteeringCallout.set(null);
  }

  openHostProblemFeedback(event: Event, state: HostSteeringCalloutState): void {
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.contextualFeedbackOffer.open(
      state.errorRequestId,
      {
        role: 'HOST',
        routeGroup: 'SESSION_HOST',
        sessionPhase: this.effectiveStatus() === 'FINISHED' ? 'FINISHED' : 'ACTIVE',
        activeChannel:
          this.activeChannel() === 'qa'
            ? 'QA'
            : this.activeChannel() === 'quickFeedback'
              ? 'QUICK_FEEDBACK'
              : 'QUIZ',
        suggestedArea: state.suggestedArea,
        sessionRunning: this.effectiveStatus() !== 'FINISHED',
      },
      target,
    );
  }

  openHostProductFeedback(event: Event): void {
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.contextualFeedbackOffer.open(
      'host.utility:manual',
      {
        role: 'HOST',
        routeGroup: 'SESSION_HOST',
        sessionPhase: this.effectiveStatus() === 'FINISHED' ? 'FINISHED' : 'ACTIVE',
        activeChannel:
          this.activeChannel() === 'qa'
            ? 'QA'
            : this.activeChannel() === 'quickFeedback'
              ? 'QUICK_FEEDBACK'
              : 'QUIZ',
        suggestedArea: 'LIVE_CONTROL',
        sessionRunning: this.effectiveStatus() !== 'FINISHED',
      },
      target,
    );
  }

  hostSteeringCalloutReloadHref(): string {
    return this.document.location?.href ?? this.localizedPath('/');
  }

  private openHostSteeringCalloutForSteeringFailure(retry: () => void, error?: unknown): void {
    this.hostSteeringCallout.set({
      title: $localize`:@@sessionHost.steeringCalloutTitle:Das ist gerade nicht angekommen`,
      body:
        hostSteeringFailureDetail(error) ??
        $localize`:@@sessionHost.steeringCalloutBody:Kein Stress – so was passiert manchmal (kurzer Ruckler oder instabiles WLAN). Warte zwei, drei Sekunden und tippe auf »Nochmal probieren« – meist reicht das.`,
      retry,
      errorRequestId: 'host.steering:failed',
      suggestedArea: 'LIVE_CONTROL',
    });
    setTimeout(() => {
      const target = this.hostElement.nativeElement.querySelector<HTMLButtonElement>(
        '[data-testid="host-steering-retry"]',
      );
      if (this.hostSteeringCallout() && target?.isConnected) {
        target.focus({ preventScroll: true });
      }
    });
  }

  private openHostSteeringCalloutForQaFailure(retry: () => void): void {
    this.hostSteeringCallout.set({
      title: $localize`:@@sessionHost.steeringCalloutQaTitle:Mit den Fragen klappt es gerade nicht`,
      body: $localize`:@@sessionHost.steeringCalloutQaBody:Hier ist nichts kaputt – es hat nur gerade nicht geklappt. Kurz durchatmen, 2–3 Sekunden warten, dann »Nochmal probieren« – oft läuft es gleich wieder.`,
      retry,
      errorRequestId: 'host.qa:failed',
      suggestedArea: 'QA',
    });
  }

  private openHostSteeringCalloutForExportFailure(retry: () => void): void {
    this.hostSteeringCallout.set({
      title: $localize`:@@sessionHost.steeringCalloutExportTitle:Export noch nicht bereit`,
      body: $localize`:@@sessionHost.steeringCalloutExportBody:PDF- oder Excel-Export ist diesmal nicht durchgekommen. Warte ein paar Sekunden und tippe auf »Nochmal probieren« – meist klappt’s beim zweiten Anlauf.`,
      retry,
      errorRequestId: 'host.export:failed',
      suggestedArea: 'PDF_OR_EXPORT',
    });
  }

  private openHostSteeringCalloutForExportConflict(retry: () => void): void {
    this.hostSteeringCallout.set({
      title: $localize`:@@sessionHost.steeringCalloutExportConflictTitle:Fragenwand hat sich geändert`,
      body: $localize`:@@sessionHost.steeringCalloutExportConflictBody:Während des Exports sind neue Stimmen oder Statusänderungen eingegangen. Der unvollständige Abruf wurde verworfen. Tippe auf »Nochmal probieren«, um einen neuen vollständigen Export zu starten.`,
      retry,
      errorRequestId: 'host.export:conflict',
      suggestedArea: 'PDF_OR_EXPORT',
    });
  }

  private async retryEndSessionAndNavigateHome(): Promise<void> {
    if (!this.code) return;
    try {
      await this.endSessionAndNavigateHome();
      this.dismissHostSteeringCallout();
    } catch (error) {
      if (this.isSessionNotFoundError(error)) {
        await this.navigateHomeAfterSessionUnavailable();
      }
      /* Hinweis bleibt, bis Retry klappt oder die Person schließt. */
    }
  }

  onExitAnchorWheel(event: WheelEvent): void {
    if (event.ctrlKey) {
      return;
    }

    const scrollContainer = this.document.getElementById('main-content');
    if (!scrollContainer || event.deltaY === 0) {
      return;
    }
    const deltaScale =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scrollContainer.clientHeight : 1;
    scrollContainer.scrollTop += event.deltaY * deltaScale;
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  onExitAnchorTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch) {
      this.resetExitAnchorTouchScroll();
      return;
    }
    this.exitAnchorTouchStartY = touch.clientY;
    this.exitAnchorTouchLastY = touch.clientY;
    this.exitAnchorTouchScrolling = false;
  }

  onExitAnchorTouchMove(event: TouchEvent): void {
    const touch = event.touches[0];
    const scrollContainer = this.document.getElementById('main-content');
    if (
      event.touches.length !== 1 ||
      !touch ||
      !scrollContainer ||
      this.exitAnchorTouchStartY === null ||
      this.exitAnchorTouchLastY === null
    ) {
      return;
    }

    if (
      !this.exitAnchorTouchScrolling &&
      Math.abs(touch.clientY - this.exitAnchorTouchStartY) < EXIT_ANCHOR_TOUCH_SCROLL_THRESHOLD_PX
    ) {
      return;
    }

    this.exitAnchorTouchScrolling = true;
    scrollContainer.scrollTop += this.exitAnchorTouchLastY - touch.clientY;
    this.exitAnchorTouchLastY = touch.clientY;
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  onExitAnchorTouchEnd(): void {
    this.resetExitAnchorTouchScroll();
  }

  private resetExitAnchorTouchScroll(): void {
    this.exitAnchorTouchStartY = null;
    this.exitAnchorTouchLastY = null;
    this.exitAnchorTouchScrolling = false;
  }

  /**
   * CanDeactivate-Guard-Hook: zeigt einen Bestätigungsdialog,
   * wenn die Session noch läuft.
   */
  async onSessionEndAnchorClick(event?: Event): Promise<void> {
    if (!this.isSessionActive() || this.sessionEndPending()) {
      return;
    }
    if (this.keepQaOpenOnHostLeave()) {
      await this.leaveHostViewKeepingQaOpen();
      return;
    }
    const focusReturn = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.sessionEndPending.set(true);
    let shouldShowFinishedView = false;
    try {
      const hasExportableResults = await this.hasExportableResultsAfterSessionEnd();
      shouldShowFinishedView = this.activeChannel() !== 'quickFeedback' && hasExportableResults;
      const confirmed = await this.confirmSessionEnd(undefined, hasExportableResults, focusReturn);
      if (!confirmed || !this.code) {
        return;
      }
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
    } finally {
      this.sessionEndPending.set(false);
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
    if (this.qaCreateAbortInFlight || this.hostAccessRevoked()) {
      return true;
    }
    if (!this.isSessionActive()) {
      if (this.effectiveStatus() === 'FINISHED' && this.code) {
        try {
          await this.dismissFinishProjection();
          this.clearSessionTokens({ keepHostToken: this.keepHostTokenOnDeactivate });
        } catch {
          // Token behalten, damit die Person den Dismiss nach Navigation/Relaunch erneut auslösen kann.
        }
      }
      return true;
    }

    if (this.keepQaOpenOnHostLeave()) {
      await this.ensureStandaloneQaStartedBeforeLeave();
      await this.closeQuickFeedbackBeforeKeepingQa();
      await this.exitFullscreenBeforeHomeNavigation();
      return true;
    }

    const result = await this.confirmSessionEnd(() => this.tryEnterHostFullscreenFromUserGesture());
    if (result !== true || !this.code) {
      return false;
    }

    try {
      await this.endSessionAndNavigateHome();
    } catch (error) {
      if (this.isSessionNotFoundError(error) || isHostAccessRevokedError(error)) {
        this.markHostAccessRevoked();
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
    focusReturn: HTMLElement | null = this.document.activeElement instanceof HTMLElement
      ? this.document.activeElement
      : null,
  ): Promise<boolean> {
    const participants = this.participantsPayload()?.participantCount ?? 0;
    const shouldWarnAboutBonusCodes = await this.shouldWarnAboutBonusCodesOnLeave();

    const consequences: string[] = [
      $localize`:@@sessionHost.leaveConsequenceParticipantAccessEnds:Teilnehmende können danach nicht mehr beitreten oder Q&A-Inhalte aufrufen.`,
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
        title: $localize`:@@sessionHost.endGlobalSessionTitle:Gesamte Session beenden?`,
        message: $localize`:@@sessionHost.endGlobalSessionMessage:Damit beendest du Quiz, Q&A und Blitzlicht für alle.`,
        consequences,
        confirmLabel: $localize`:@@sessionHost.endGlobalSessionConfirm:Gesamte Session beenden`,
        cancelLabel: $localize`:@@sessionHost.endGlobalSessionCancel:Abbrechen`,
        onCancelUserGesture,
      } satisfies ConfirmLeaveDialogData,
      width: 'min(26rem, calc(100vw - 1.5rem))',
      maxWidth: '100vw',
      autoFocus: 'dialog',
      restoreFocus: false,
    });

    const confirmed = (await firstValueFrom(dialogRef.afterClosed())) === true;
    if (!confirmed && focusReturn?.isConnected) {
      focusReturn.focus({ preventScroll: true });
    }
    return confirmed;
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
      const entries = await trpc.session.getLeaderboard.query({
        code: this.code.toUpperCase(),
        anonymousClientId: getAnonymousClientId(),
      });
      return this.hasPotentialBonusRecipients(entries);
    } catch {
      return false;
    }
  }

  private hasPotentialBonusRecipients(entries: Array<{ totalScore: number }>): boolean {
    return entries.some((entry) => entry.totalScore > 0);
  }

  private async abortUnconfiguredQaCreateAndReturnHome(): Promise<void> {
    if (!this.code) {
      return;
    }
    this.qaCreateAbortInFlight = true;
    this.dialog.closeAll();
    clearStagedHostRecoveryCard(this.code);
    clearHostBrowserCapability(this.code);
    this.markSessionUnavailable();
    const ended = trpc.session.end.mutate({ code: this.code.toUpperCase() }).catch(() => {
      // Session trotzdem lokal verwerfen, damit »Q&A erstellen« sie nicht wieder öffnet.
    });
    await this.exitFullscreenBeforeHomeNavigation();
    await this.ngZone.run(async () => {
      await this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
    });
    await ended;
  }

  private async endSessionAndNavigateHome(): Promise<void> {
    if (!this.code) {
      return;
    }
    try {
      await trpc.session.end.mutate({ code: this.code.toUpperCase() });
    } catch (error) {
      if (!this.isSessionAlreadyFinishedError(error)) {
        throw error;
      }
    }
    this.markSessionFinishedLocally();
    await this.dismissFinishProjection();
    // Host-Token behalten: Claim auf der Startseite braucht x-host-token.
    rememberPendingHostInvite(this.code.toUpperCase());
    this.markSessionUnavailable({ keepHostToken: true });
    await this.exitFullscreenBeforeHomeNavigation();
    await this.ngZone.run(async () => {
      await this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
    });
  }

  /** Beendet die Presenter-Leaderboard-Ansicht und wechselt zur Startseite. */
  async navigateHomeFromFinishedSession(): Promise<void> {
    if (!this.code) {
      return;
    }
    try {
      await this.dismissFinishProjection();
      rememberPendingHostInvite(this.code.toUpperCase());
      this.markSessionUnavailable({ keepHostToken: true });
      await this.exitFullscreenBeforeHomeNavigation();
      await this.ngZone.run(async () => {
        await this.router.navigateByUrl(this.localizedPath('/'), { replaceUrl: true });
      });
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(
        () => void this.navigateHomeFromFinishedSession(),
      );
    }
  }

  private async dismissFinishProjection(): Promise<void> {
    if (!this.code) {
      return;
    }
    await trpc.session.dismissFinishProjection.mutate({ code: this.code.toUpperCase() });
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
    this.countdownFingerSoundPlayed = false;
    this.countdownFinalSoundPlayed = false;
    this.countdownMusicFadeStarted = false;
    if (!timerSeconds || timerSeconds <= 0) {
      this.countdownSeconds.set(null);
      return;
    }
    const start = activeAt ? new Date(activeAt).getTime() : Date.now();
    const deadline = start + timerSeconds * 1000;
    const sfxEnabled = () => !!this.session()?.enableSoundEffects && this.isPlayfulPreset();
    if (sfxEnabled()) {
      void this.sound.preload(['countdownEnd', 'sessionEnd']);
    }

    const tick = (): void => {
      const remaining = remainingCountdownSeconds(deadline);
      this.countdownSeconds.set(remaining);

      // Ab 10s: Musik sanft ausblenden bis zum Gong (7s). Track bleibt aktiv, damit syncMusic nicht neu startet.
      if (remaining <= 10 && remaining > 7 && !this.countdownMusicFadeStarted) {
        this.countdownMusicFadeStarted = true;
        this.sound.fadeOutMusic(Math.max(0.5, remaining - 7));
      }
      if (remaining <= 7 && !this.countdownSfxPhase()) {
        this.countdownMusicFadeStarted = true;
        this.countdownSfxPhase.set(true);
      }

      const sfxCountdown = sfxEnabled();
      // Gong läutet die Fingerphase ein (ab 7s); am Ablauf leiser Pfiff statt Gong.
      if (sfxCountdown && remaining <= 7 && remaining > 0 && !this.countdownFingerSoundPlayed) {
        void this.sound.play('countdownEnd', { gain: 0.32, fadeOutSeconds: 0.55 });
        this.countdownFingerSoundPlayed = true;
      }
      if (sfxCountdown && remaining === 1 && !this.countdownFinalSoundPlayed) {
        void this.sound.play('sessionEnd', { gain: 0.4 });
        this.countdownFinalSoundPlayed = true;
      }
      if (remaining <= 0) {
        if (sfxCountdown && !this.countdownFinalSoundPlayed) {
          void this.sound.play('sessionEnd', { gain: 0.4 });
          this.countdownFinalSoundPlayed = true;
        }
        this.finishRoomCountdown();
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

  /** Raum-Countdown ist bei 0: Finger/Zahl bleiben kurz, persönliche Zeit-Musik erst danach. */
  private finishRoomCountdown(): void {
    this.stopCountdown();
    this.countdownSeconds.set(0);
    this.countdownEnded.set(true);
    this.fingerHideTimeout = setTimeout(() => {
      this.countdownSeconds.set(null);
      this.fingerHideTimeout = null;
    }, 5000);
  }

  /** Synchronisiert Host-Hintergrundmusik phasenabhängig. */
  private syncMusic(): void {
    if (this.isPairedHostClient() || this.hostAccessRevoked() || !this.sound.outputEnabled()) {
      this.sound.stopMusic();
      return;
    }
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
    if (live === 'personalTime' && !this.timerAccommodationEnabled()) {
      this.musicMenuEditPhase.set('countdown');
      return;
    }
    this.musicMenuEditPhase.set(live ?? 'lobby');
  }

  onMusicMenuPhaseToggle(ev: { value: unknown }): void {
    const v = ev.value;
    if (v === 'personalTime' && !this.timerAccommodationEnabled()) {
      return;
    }
    if (v === 'lobby' || v === 'reading' || v === 'countdown' || v === 'personalTime') {
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
    const nextTracks = { ...this.phaseTracks(), [phase]: track };
    const nextMuted = new Set(this.mutedMusicPhases());
    nextMuted.delete(phase);
    this.phaseTracks.set(nextTracks);
    this.mutedMusicPhases.set(nextMuted);
    persistPhaseMusicSettings(nextTracks, nextMuted);
    this.syncMusic();
  }

  isMusicPhaseMuted(phase: MusicPhase): boolean {
    return this.mutedMusicPhases().has(phase);
  }

  toggleMusicPhaseMute(phase: MusicPhase): void {
    this.sound.unlock();
    this.sound.stopPreview();
    const nextMuted = new Set(this.mutedMusicPhases());
    if (nextMuted.has(phase)) {
      nextMuted.delete(phase);
    } else {
      nextMuted.add(phase);
    }
    this.mutedMusicPhases.set(nextMuted);
    persistPhaseMusicSettings(this.phaseTracks(), nextMuted);
    this.syncMusic();
  }

  musicPhaseMuteLabel(phase: MusicPhase): string {
    return this.isMusicPhaseMuted(phase)
      ? $localize`:@@sessionHost.musicPhaseUnmute:Diese Phase hörbar`
      : $localize`:@@sessionHost.musicPhaseMute:Diese Phase stumm`;
  }

  phaseTrackLabel(phase: MusicPhase): string {
    if (this.isMusicPhaseMuted(phase)) {
      return $localize`:@@sessionHost.musicPhaseMutedSaved:Stumm`;
    }
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
    if (su?.status === 'FINISHED' || s?.status === 'FINISHED') {
      return 'FINISHED';
    }
    return su?.status ?? s?.status ?? null;
  }

  isQuizPausedByHost(): boolean {
    const pausedFromStatus =
      this.statusUpdate()?.pausedFromStatus ?? this.session()?.pausedFromStatus ?? null;
    return (
      this.effectiveStatus() === 'PAUSED' &&
      (pausedFromStatus === 'QUESTION_OPEN' || pausedFromStatus === 'ACTIVE')
    );
  }

  showsQuizProgressionActions(): boolean {
    const status = this.effectiveStatus();
    return status === 'RESULTS' || (status === 'PAUSED' && !this.isQuizPausedByHost());
  }

  showQuizPrimaryAnchorAction(): boolean {
    const status = this.effectiveStatus();
    if (status === 'QUESTION_OPEN' || status === 'DISCUSSION') {
      return true;
    }
    if (this.showsQuizProgressionActions()) {
      return this.canOpenFollowingQuestion() || this.showFinishEvaluationAnchor();
    }
    return (
      status === 'ACTIVE' &&
      !this.quizStartQuestionPending() &&
      this.hasCurrentQuizQuestionForHost()
    );
  }

  private clearFoyerArrivalStateWhenLeavingLobby(nextStatus: SessionInfoDTO['status']): void {
    if (this.effectiveStatus() === 'LOBBY' && nextStatus !== 'LOBBY') {
      this.clearFoyerArrivalState();
    }
  }

  /** i18n: Singular label for participant count. */
  participantLabelSingular(): string {
    return $localize`:@@sessionHost.participantCountOne:Person insgesamt beigetreten`;
  }
  /** i18n: Plural label for participant count. */
  participantLabelPlural(): string {
    return $localize`:@@sessionHost.participantCountMany:insgesamt beigetreten`;
  }

  connectedParticipantStatusLabel(
    connectedCount: number | null | undefined,
    totalParticipantCount: number | null | undefined,
  ): string | null {
    if (
      typeof connectedCount !== 'number' ||
      typeof totalParticipantCount !== 'number' ||
      connectedCount < 0 ||
      totalParticipantCount < 0
    ) {
      return null;
    }
    if (connectedCount === 1) {
      return $localize`:@@sessionHost.connectedParticipantCountOne:1 jetzt verbunden`;
    }
    return $localize`:@@sessionHost.connectedParticipantCountMany:${formatLocaleCount(connectedCount, this.localeId)}:connectedCount: jetzt verbunden`;
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
      status !== 'PAUSED' &&
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
      (left.pendingTimerAccommodationCount ?? 0) === (right.pendingTimerAccommodationCount ?? 0) &&
      (left.blockingTimerAccommodationCount ?? 0) ===
        (right.blockingTimerAccommodationCount ?? 0) &&
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

  pendingTimerAccommodationLabel(count: number, blockingCount: number): string {
    const roomCountdownEnded = this.countdownEnded();
    if (blockingCount === 1) {
      return roomCountdownEnded
        ? $localize`:@@sessionHost.timerAccommodationBlockingOneForce:Eine Person nutzt ihre »10× Zeit«. »Trotzdem freigeben« beendet ihr persönliches Fenster.`
        : $localize`:@@sessionHost.timerAccommodationBlockingOne:Eine Person nutzt ihre »10× Zeit«. Warte auf den Raum-Countdown oder bis die »10× Zeit« endet.`;
    }
    if (blockingCount > 1) {
      return roomCountdownEnded
        ? $localize`:@@sessionHost.timerAccommodationBlockingManyForce:${formatLocaleCount(blockingCount, this.localeId)}:count: Personen nutzen ihre »10× Zeit«. »Trotzdem freigeben« beendet ihre persönlichen Fenster.`
        : $localize`:@@sessionHost.timerAccommodationBlockingMany:${formatLocaleCount(blockingCount, this.localeId)}:count: Personen nutzen ihre »10× Zeit«. Warte auf den Raum-Countdown oder bis die »10× Zeit« endet.`;
    }
    if (count === 1) {
      return $localize`:@@sessionHost.timerAccommodationPendingOne:Eine Person antwortet ohne persönliche Frist. »Ergebnis zeigen« beendet ihre Eingabe.`;
    }
    return $localize`:@@sessionHost.timerAccommodationPendingMany:${formatLocaleCount(count, this.localeId)}:count: Personen antworten ohne persönliche Frist. »Ergebnis zeigen« beendet ihre Eingabe.`;
  }

  voteProgressAria(votes: number, participants: number, percentage: number): string {
    const formattedPercentage = formatLocaleCount(percentage, this.localeId);
    if (votes === 1) {
      return $localize`:@@sessionHost.voteProgressAriaOne:${formatLocaleCount(votes, this.localeId)}:votes: von ${formatLocaleCount(participants, this.localeId)}:participants: Teilnehmenden hat abgestimmt. ${formattedPercentage}:percentage: Prozent erreicht.`;
    }
    return $localize`:@@sessionHost.voteProgressAriaMany:${formatLocaleCount(votes, this.localeId)}:votes: von ${formatLocaleCount(participants, this.localeId)}:participants: Teilnehmenden haben abgestimmt. ${formattedPercentage}:percentage: Prozent erreicht.`;
  }

  /** Ergebnisansicht: »X von Y hat/haben abgestimmt« (Plural nach Anzahl abgegebener Stimmen). */
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

  /** Bewertungsfrage Ergebnis: »X von Y hat/haben bewertet«. */
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

  correctChoiceVotersLabel(
    correct: number,
    total: number,
    type: HostCurrentQuestionDTO['type'],
  ): string {
    if (type === 'MULTIPLE_CHOICE') {
      return this.correctAllVotersLabel(correct, total);
    }
    return this.correctVotersLabel(correct, total);
  }

  /** Single-Choice-Ergebnis: korrekt gewählte Antwort inkl. Prozent. */
  correctVotersLabel(correct: number, total: number): string {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return $localize`:@@sessionHost.correctVoters:${formatLocaleCount(correct, this.localeId)}:correctCount: von ${formatLocaleCount(total, this.localeId)}:voteTotal: richtig (${formatLocaleCount(pct, this.localeId)}:percentage:\u00a0%)`;
  }

  /** Multiple-Choice-Ergebnis: alle korrekten Optionen gewählt inkl. Prozent. */
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
      const payload = await trpc.session.getTeams.query({
        code: this.code.toUpperCase(),
        anonymousClientId: getAnonymousClientId(),
      });
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
      const summary = await trpc.session.getParticipantSummary.query({
        code: this.code.toUpperCase(),
      });
      this.updateParticipantsPayload(
        this.participantSummaryToPayload(summary),
        this.participantBaselineReady,
      );
    } catch {
      // Subscription updates remain the primary live path; keep the last payload on transient failures.
    }
  }

  async toggleParticipantDirectory(): Promise<void> {
    const open = !this.participantDirectoryOpen();
    this.participantDirectoryOpen.set(open);
    if (open) {
      await this.resetParticipantDirectory();
    }
  }

  onParticipantDirectorySearchInput(value: string): void {
    this.participantDirectorySearchDraft.set(value);
    if (this.participantDirectorySearchTimer) {
      clearTimeout(this.participantDirectorySearchTimer);
    }
    this.participantDirectorySearchTimer = setTimeout(() => {
      this.participantDirectorySearchTimer = null;
      const search = this.participantDirectorySearchDraft().trim();
      if (search === this.participantDirectorySearch()) return;
      this.participantDirectorySearch.set(search);
      void this.resetParticipantDirectory();
    }, 300);
  }

  clearParticipantDirectorySearch(): void {
    if (this.participantDirectorySearchTimer) {
      clearTimeout(this.participantDirectorySearchTimer);
      this.participantDirectorySearchTimer = null;
    }
    this.participantDirectorySearchDraft.set('');
    if (this.participantDirectorySearch() === '') return;
    this.participantDirectorySearch.set('');
    void this.resetParticipantDirectory();
  }

  async loadNextParticipantDirectoryPage(): Promise<void> {
    const cursor = this.participantDirectoryNextCursor();
    if (!cursor || this.participantDirectoryLoading()) return;
    const previousCursor = this.participantDirectoryCurrentCursor;
    const loaded = await this.loadParticipantDirectoryPage(cursor);
    if (loaded) {
      this.participantDirectoryCursorHistory.push(previousCursor);
      this.participantDirectoryCurrentCursor = cursor;
      this.participantDirectoryPageIndex.update((index) => index + 1);
    }
  }

  async loadPreviousParticipantDirectoryPage(): Promise<void> {
    if (this.participantDirectoryCursorHistory.length === 0 || this.participantDirectoryLoading()) {
      return;
    }
    const target =
      this.participantDirectoryCursorHistory[this.participantDirectoryCursorHistory.length - 1] ??
      null;
    const loaded = await this.loadParticipantDirectoryPage(target);
    if (loaded) {
      this.participantDirectoryCursorHistory.pop();
      this.participantDirectoryCurrentCursor = target;
      this.participantDirectoryPageIndex.update((index) => Math.max(0, index - 1));
    }
  }

  private async resetParticipantDirectory(): Promise<void> {
    this.participantDirectoryCursorHistory = [];
    this.participantDirectoryCurrentCursor = null;
    this.participantDirectoryPageIndex.set(0);
    await this.loadParticipantDirectoryPage(null);
  }

  private async loadParticipantDirectoryPage(cursor: string | null): Promise<boolean> {
    if (!this.code) return false;
    const requestId = ++this.participantDirectoryRequestId;
    this.participantDirectoryLoading.set(true);
    this.participantDirectoryError.set(null);
    const search = this.participantDirectorySearch();
    try {
      const page: SessionParticipantPageDTO = await trpc.session.searchParticipants.query({
        code: this.code.toUpperCase(),
        search,
        pageSize: 80,
        ...(cursor ? { cursor } : {}),
      });
      if (
        requestId !== this.participantDirectoryRequestId ||
        search !== this.participantDirectorySearch()
      ) {
        return false;
      }
      this.participantDirectoryEntries.set(page.participants);
      this.participantDirectoryTotal.set(page.participantCount);
      this.participantDirectoryNextCursor.set(page.nextCursor);
      return true;
    } catch (error) {
      const errorCode =
        error && typeof error === 'object'
          ? 'data' in error && error.data && typeof error.data === 'object' && 'code' in error.data
            ? error.data.code
            : 'code' in error
              ? error.code
              : null
          : null;
      if (cursor && errorCode === 'CONFLICT' && requestId === this.participantDirectoryRequestId) {
        this.participantDirectoryCursorHistory = [];
        this.participantDirectoryCurrentCursor = null;
        this.participantDirectoryPageIndex.set(0);
        await this.loadParticipantDirectoryPage(null);
        return false;
      }
      if (requestId === this.participantDirectoryRequestId) {
        this.participantDirectoryError.set(
          $localize`:@@sessionHost.participantDirectoryError:Teilnahmen konnten gerade nicht geladen werden.`,
        );
      }
      return false;
    } finally {
      if (requestId === this.participantDirectoryRequestId) {
        this.participantDirectoryLoading.set(false);
      }
    }
  }

  private participantSummaryToPayload(
    summary: SessionParticipantSummaryDTO | SessionParticipantsPayload,
  ): SessionParticipantsPayload {
    // Während eines Rolling Deployments können bereits verbundene alte
    // Backend-Instanzen noch den früheren, vollständigen Payload senden. Die
    // neue UI verarbeitet davon bewusst nur die letzten 20 Einträge.
    const participants =
      'recentArrivals' in summary
        ? summary.recentArrivals
        : summary.participants.slice(Math.max(0, summary.participants.length - 20));
    return {
      participants: participants.map((participant) => ({
        id: participant.id,
        nickname: participant.nickname,
        teamId: participant.teamId ?? null,
        teamName: participant.teamName ?? null,
      })),
      participantCount: summary.participantCount,
      ...('connectedCount' in summary ? { connectedCount: summary.connectedCount } : {}),
      ...(summary.readingReady ? { readingReady: summary.readingReady } : {}),
    };
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
      QUESTION_OPEN: $localize`:@@sessionHost.phaseReadingLocked:Lesephase – Antwortoptionen noch gesperrt`,
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

  /** Fallback: letzte Vorlagenfrage nach Reihenfolge, wenn das DTO keine Folgemarker liefert. */
  isLastQuestion(): boolean {
    const q = this.displayedCurrentQuestionForHost();
    if (!q || q.totalQuestions === null || q.totalQuestions === undefined) return false;
    return q.order + 1 >= q.totalQuestions;
  }

  /**
   * True, wenn der Host aus RESULTS/DISCUSSION auf eine enthaltene Vorgängerfrage
   * zurückblättern kann. Unabhängig von Musterlösung; ohne Frage-DTO unsichtbar.
   */
  canShowPreviousResultAnchor(): boolean {
    if (this.steppedBackToPreviousResult()) return false;
    const q = this.displayedCurrentQuestionForHost();
    if (!q) return false;
    if (typeof q.canShowPreviousResult === 'boolean') {
      return q.canShowPreviousResult;
    }
    return q.order !== 0;
  }

  /** Ob nach der aktuellen (bzw. nach einem Rückblick) noch eine Frage geöffnet werden kann. */
  readonly canOpenFollowingQuestion = computed(() => {
    const q = this.displayedCurrentQuestionForHost();
    if (!q) return false;
    if (typeof q.hasUnopenedFollowingQuestion === 'boolean') {
      return q.hasUnopenedFollowingQuestion;
    }
    if (this.skipCurrentResultQuestionOnNext()) {
      return !this.isLastQuestion();
    }
    if (typeof q.hasNextQuestion === 'boolean') {
      return q.hasNextQuestion;
    }
    return !this.isLastQuestion();
  });

  /**
   * Aus RESULTS/DISCUSSION immer die bereits geöffnete Folgefrage überspringen.
   * Nach Reload ist `skipCurrentResultQuestionOnNext` weg; die DTO-Flags bleiben.
   */
  private shouldSkipCurrentResultQuestionOnNext(): boolean {
    if (this.skipCurrentResultQuestionOnNext()) return true;
    const status = this.effectiveStatus();
    return status === 'RESULTS' || status === 'DISCUSSION';
  }

  readonly hasOverallEvaluation = computed(() => {
    if ((this.participantsPayload()?.participantCount ?? 0) > 0) return true;
    if (this.leaderboard().length > 0 || this.teamLeaderboard().length > 0) return true;
    if (this.freetextResponses().length > 0) return true;
    const q = this.displayedCurrentQuestionForHost();
    if (!q) return false;
    if ((q.totalVotes ?? 0) > 0) return true;
    if ((q.freeTextResponses?.length ?? 0) > 0) return true;
    if ((q.ratingCount ?? 0) > 0) return true;
    return q.voteDistribution?.some((entry) => entry.voteCount > 0) === true;
  });

  readonly showFinishEvaluationAnchor = computed(() => {
    if (this.displayedCurrentQuestionForHost() === null) return false;
    return !this.canOpenFollowingQuestion() && this.hasOverallEvaluation();
  });

  /** Statischer Hinweis auf der Fragenkarte, nicht in der Aktionsleiste. */
  readonly showLastQuestionBadge = computed(() => {
    if (this.steppedBackToPreviousResult() || this.skipCurrentResultQuestionOnNext()) {
      return false;
    }
    const q = this.displayedCurrentQuestionForHost();
    if (!q) return false;
    if (typeof q.hasNextQuestion === 'boolean') {
      return !q.hasNextQuestion;
    }
    return this.isLastQuestion();
  });

  countdownAriaLabel(): string {
    const seconds = this.countdownSeconds() ?? 0;
    return seconds === 1
      ? $localize`:@@sessionHost.countdownAriaOne:1 Sekunde verbleibend`
      : $localize`:@@sessionHost.countdownAriaMany:${seconds}:seconds: Sekunden verbleibend`;
  }

  /** Markdown + KaTeX für Frage- und Antworttexte (wie Quiz-Vorschau). */
  renderMarkdown(value: string, headingStartLevel: 3 | 4 = 3): SafeHtml {
    const cacheKey = `${headingStartLevel}\u0000escape\u0000${value}`;
    const cached = this.markdownCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      decorateLeadingAnswerEmoji(
        renderMarkdownWithKatex(value, {
          imagePolicy: 'external-https-and-app-assets',
          headingStartLevel,
          escapeListMarkers: headingStartLevel >= 4,
        }).html,
      ),
    );
    this.markdownCache.set(cacheKey, rendered);
    return rendered;
  }

  renderOrderingItemMarkdown(value: string): SafeHtml {
    // Leading numbers like »9. November« must stay; escapeListMarkers avoids <ol> renumbering.
    return this.renderMarkdown(value, 4);
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

  private qaChannelNeedsConfiguration(): boolean {
    const session = this.session();
    if (!session) {
      return true;
    }
    const qa = session.channels?.qa;
    if (qa?.state === 'DISABLED' || qa?.state === 'UNCONFIGURED') {
      return true;
    }
    if (qa?.enabled) {
      return false;
    }
    return session.type !== 'Q_AND_A' || !session.qaClosesAt;
  }

  isChannelOpen(channel: SessionChannelTab): boolean {
    return this.channelOpenState()[channel];
  }

  qaDeadlineLabel(): string | null {
    const parts = resolveQaDeadlineClockParts({
      closesAt: this.session()?.channels?.qa.closesAt ?? this.session()?.qaClosesAt,
      nowMs: this.qaDeadlineNow(),
      localeId: this.localeId,
      timeZone: this.session()?.timeZone,
    });
    if (!parts) {
      return null;
    }
    if (parts.remainingMs <= 0) {
      return $localize`:@@sessionQa.deadlineExpired:Teilnahmefrist abgelaufen · ${parts.formatted}:deadline:`;
    }
    return $localize`:@@sessionQa.deadlineOpen:Q&A offen bis ${parts.formatted}:deadline: · ${parts.relative}:remaining:`;
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

  readonly qaAuthorTeamByNickname = computed(() => {
    const teams = new Map<string, string>();
    const remember = (nickname: string | null | undefined, teamName: string | null | undefined) => {
      const trimmedNickname = nickname?.trim();
      const trimmedTeam = teamName?.trim();
      if (!trimmedNickname || !trimmedTeam) {
        return;
      }
      teams.set(trimmedNickname, trimmedTeam);
    };
    for (const participant of this.participantsPayload()?.participants ?? []) {
      remember(participant.nickname, participant.teamName);
    }
    for (const participant of this.participantDirectoryEntries()) {
      remember(participant.nickname, participant.teamName);
    }
    return teams;
  });

  qaQuestionAuthorTeamName(question: QaQuestionDTO): string | null {
    const fromQuestion = question.authorTeamName?.trim();
    if (fromQuestion) {
      return fromQuestion;
    }
    const nickname = this.qaQuestionAuthorNickname(question);
    if (!nickname) {
      return null;
    }
    return this.qaAuthorTeamByNickname().get(nickname) ?? null;
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

  async toggleQaAuthorSelection(nickname: string | null | undefined): Promise<void> {
    const trimmedNickname = nickname?.trim();
    if (!trimmedNickname) {
      return;
    }
    if (this.qaSelectedAuthorNickname() === trimmedNickname) {
      await this.clearQaAuthorFilter();
      return;
    }
    await this.applyQaAuthorFilter(trimmedNickname);
  }

  async selectQaAuthorFromDirectory(nickname: string): Promise<void> {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      return;
    }
    if (this.qaSelectedAuthorNickname() === trimmedNickname) {
      this.participantDirectoryOpen.set(false);
      await this.clearQaAuthorFilter();
      return;
    }
    await this.applyQaAuthorFilter(trimmedNickname);
  }

  qaDirectoryAuthorAriaLabel(nickname: string): string {
    return this.qaSelectedAuthorNickname() === nickname
      ? $localize`:@@sessionHost.participantDirectoryClearAuthorAria:Auswahl für ${nickname} aufheben`
      : $localize`:@@sessionHost.participantDirectorySelectAuthorAria:Fragen von ${nickname} anzeigen`;
  }

  isQaAuthorNicknameSelected(nickname: string): boolean {
    return this.qaSelectedAuthorNickname() === nickname;
  }

  clearQaAuthorSelection(): void {
    if (this.qaSelectedAuthorNickname() !== null) {
      this.qaSelectedAuthorNickname.set(null);
    }
  }

  async clearQaAuthorFilter(): Promise<void> {
    if (this.qaSelectedAuthorNickname() === null) {
      return;
    }
    this.clearQaAuthorSelection();
    this.releaseQaChromeIfUnfiltered();
    this.ensureQaSubscription();
    await this.refreshQaQuestions({ replaceStale: true });
    this.scrollQaListToTop();
  }

  private async applyQaAuthorFilter(nickname: string): Promise<void> {
    this.captureUnfilteredQaChrome();
    this.qaSelectedAuthorNickname.set(nickname);
    this.participantDirectoryOpen.set(false);
    if (this.activeChannel() !== 'qa') {
      await this.selectChannel('qa');
    }
    this.ensureQaSubscription();
    await this.refreshQaQuestions({ replaceStale: true });
    this.scrollQaListToTop();
  }

  private captureUnfilteredQaChrome(): void {
    if (
      this.qaUnfilteredChromeQuestions() !== null ||
      this.qaSelectedAuthorNickname() ||
      this.qaSearch()
    ) {
      return;
    }
    this.qaUnfilteredChromeQuestions.set(this.qaQuestions());
  }

  private releaseQaChromeIfUnfiltered(): void {
    if (!this.qaSelectedAuthorNickname() && !this.qaSearch()) {
      this.qaUnfilteredChromeQuestions.set(null);
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
        return $localize`:@@sessionQa.statusActive:Freigegeben`;
      case 'PENDING':
        return $localize`:@@sessionQa.statusPending:Wartet auf Freigabe`;
      case 'ARCHIVED':
        return $localize`:@@sessionQa.statusArchived:Beantwortet`;
      case 'DELETED':
        return $localize`:@@sessionQa.statusDeleted:Entfernt`;
    }
  }

  qaStatusTooltip(status: QaQuestionDTO['status']): string {
    switch (status) {
      case 'PINNED':
        return $localize`:@@sessionQa.statusPinnedTooltip:Angepinnt: Diese Frage hebst du hervor. Sie gilt als »Wird beantwortet«.`;
      case 'ARCHIVED':
        return $localize`:@@sessionQa.statusArchivedTooltip:Archiviert: Diese Frage ist als beantwortet markiert und bleibt nachlesbar.`;
      default:
        return '';
    }
  }

  qaPinnedSummaryTooltip(): string {
    return $localize`:@@sessionQa.summaryPinnedTooltip:Angepinnt: Diese Fragen hebst du hervor. Sie gelten als »Wird beantwortet«.`;
  }

  qaArchivedSummaryTooltip(): string {
    return $localize`:@@sessionQa.summaryArchivedTooltip:Archiviert: Diese Fragen sind als beantwortet markiert und bleiben nachlesbar.`;
  }

  qaPinnedSummaryAria(): string {
    return $localize`:@@sessionQa.summaryPinnedAria:${this.formatCount(this.qaPinnedCount())}:count: angepinnte Fragen`;
  }

  qaArchivedSummaryAria(): string {
    return $localize`:@@sessionQa.summaryArchivedAria:${this.formatCount(this.qaArchivedCount())}:count: archivierte Fragen`;
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
            } else if (typeof target.scrollIntoView === 'function') {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          } catch {
            if (typeof target.scrollIntoView === 'function') {
              target.scrollIntoView();
            }
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
    if (!this.qaHostWritesAllowed()) {
      return false;
    }
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

  isQaCompassFocused(questionId: string): boolean {
    return this.qaCompassFocusQuestionIds().has(questionId);
  }

  hasQaListFocus(): boolean {
    return this.qaCompassFocusQuestionIds().size > 0;
  }

  qaFocusBadge(): string {
    const hint = this.qaFocusHint();
    if (this.qaFocusOrigin() === 'word-cloud') {
      return hint
        ? $localize`:@@sessionHost.moderationWordCloudFocusWithHint:Aus der Wortwolke · ${hint}:hint:`
        : $localize`:@@sessionHost.moderationWordCloudFocus:Aus der Wortwolke`;
    }
    return hint
      ? $localize`:@@sessionHost.moderationCompassFocusWithHint:Aus dem Kompass · ${hint}:hint:`
      : $localize`:@@sessionHost.moderationCompassFocus:Aus dem Kompass`;
  }

  isQaCompassFocusPrimary(questionId: string): boolean {
    return this.qaCompassFocusQuestionId() === questionId;
  }

  qaQuestionScore(question: QaQuestionDTO): number {
    return question.score ?? question.upvoteCount;
  }

  private compareQaForumSort(left: QaQuestionDTO, right: QaQuestionDTO): number {
    const mode = this.qaSortMode();
    if (mode === 'TIME') {
      const createdDiff = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      if (Number.isFinite(createdDiff) && createdDiff !== 0) {
        return createdDiff;
      }
      return left.id.localeCompare(right.id);
    }
    if (mode === 'BEST') {
      const bestDiff = (right.bestScore ?? 0) - (left.bestScore ?? 0);
      if (bestDiff !== 0) {
        return bestDiff;
      }
    } else if (mode === 'CONTROVERSIAL') {
      const controversyDiff = (right.controversyScore ?? 0) - (left.controversyScore ?? 0);
      if (controversyDiff !== 0) {
        return controversyDiff;
      }
    }

    if (mode === 'BEST' || mode === 'CONTROVERSIAL') {
      const positiveDiff = (right.positiveVoteCount ?? 0) - (left.positiveVoteCount ?? 0);
      if (positiveDiff !== 0) {
        return positiveDiff;
      }
    }

    const scoreDiff = this.qaQuestionScore(right) - this.qaQuestionScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const createdDiff = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (Number.isFinite(createdDiff) && createdDiff !== 0) {
      return createdDiff;
    }

    return left.id.localeCompare(right.id);
  }

  qaWordCloudQuestionWeight(question: QaQuestionDTO): number {
    return getQaWordCloudQuestionWeight(question, this.qaSortMode());
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

  async setQaSortMode(
    mode: QaQuestionSortMode,
    options?: { readonly scrollToTop?: boolean },
  ): Promise<void> {
    if (this.qaSortMode() === mode) {
      return;
    }

    this.qaSortMode.set(mode);
    this.ensureQaSubscription();
    await this.refreshQaQuestions();
    if (options?.scrollToTop !== false) {
      this.scrollQaListToTop();
    }

    if (untracked(() => this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC')) {
      const request = this.buildQaWordCloudAnalysisRequest();
      if (request) {
        this.queueQaWordCloudSemanticAnalysis(request);
      }
      return;
    }

    const shouldRefreshLemmaSmoothing = untracked(
      () =>
        (this.qaWordCloudAnalysisVariant() === 'LEXICAL' ||
          this.qaWordCloudAnalysisVariant() === 'THEME') &&
        (this.qaWordCloudLemmaPending() ||
          this.qaWordCloudLemmaResult()?.normalizationApplied === 'LEMMA'),
    );
    if (!shouldRefreshLemmaSmoothing) {
      return;
    }

    await this.requestQaWordCloudLemmaSmoothing();
  }

  setQaWordCloudAnalysisVariant(variant: WordCloudAnalysisVariant): void {
    const nextVariant =
      variant === 'THEME' && !this.qaWordCloudThemeModeAvailable() ? 'LEXICAL' : variant;

    if (nextVariant === this.qaWordCloudAnalysisVariant()) {
      return;
    }

    this.qaWordCloudAnalysisVariant.set(nextVariant);
    if (nextVariant === 'SEMANTIC') {
      const request = this.buildQaWordCloudAnalysisRequest();
      if (request) {
        this.queueQaWordCloudSemanticAnalysis(request);
      }
    }
  }

  async toggleQaWordCloudSmoothing(): Promise<void> {
    if (this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC') {
      if (this.qaWordCloudSmoothingDisabled()) {
        return;
      }
      const request = this.buildQaWordCloudAnalysisRequest(
        this.qaWordCloudEffectiveAnalysisVariant(),
        { refresh: true },
      );
      if (request) {
        this.queueQaWordCloudSemanticAnalysis(request);
      }
      return;
    }

    if (this.qaWordCloudLemmaPending()) {
      return;
    }

    if (this.qaWordCloudSmoothingStatus() === 'active') {
      this.qaWordCloudLemmaPreferred.set(false);
      this.clearQaWordCloudLemmaSmoothing();
      return;
    }

    this.qaWordCloudLemmaPreferred.set(true);
    if (!this.qaWordCloudAnalysisLocale() || this.qaWordCloudQuestions().length === 0) {
      return;
    }

    await this.requestQaWordCloudLemmaSmoothing();
  }

  async selectChannel(channel: string): Promise<void> {
    if (channel === 'quiz' || channel === 'qa' || channel === 'quickFeedback') {
      // Eine bewusste Auswahl darf nicht von einem noch ausstehenden Initial-Snapshot überschrieben werden.
      this.initialPreferredChannelApplied = true;
      this.initialUrlTabApplied = true;
      if (
        this.effectiveStatus() === 'FINISHED' &&
        !this.isChannelEnabled(channel) &&
        !this.qaHostWritesAllowed()
      ) {
        return;
      }
      if (channel === 'qa' && this.qaChannelNeedsConfiguration()) {
        await this.enableChannel('qa');
        return;
      }
      if (!this.isChannelEnabled(channel)) {
        if (channel === 'quiz') {
          await this.activateQuizChannel();
        } else {
          await this.enableChannel(channel);
        }
        return;
      }
      if (
        channel === 'quickFeedback' &&
        this.effectiveStatus() === 'FINISHED' &&
        this.qaHostWritesAllowed()
      ) {
        await this.reopenQuickFeedbackAfterQuiz();
      }
      const prev = this.activeChannel();
      if (prev === 'qa' && channel !== 'qa') {
        this.qaTitleEditing.set(false);
      }
      this.activeChannel.set(channel);
      if (prev !== channel) {
        this.closeOpenWordCloudOverlays();
      }
      if (channel === 'qa') {
        this.qaTitleEditing.set(false);
        this.syncQaTitleDraftFromSession();
      }
      this.ensureActiveChannel();
      if (this.effectiveStatus() !== 'FINISHED') {
        await this.reconcilePresentedChannel();
      }
    }
  }

  async onChannelToggleChange(channel: string, group: MatButtonToggleGroup): Promise<void> {
    if (this.channelToggleSyncing) {
      return;
    }
    await this.selectChannel(channel);
    if (group.value === this.activeChannel()) {
      return;
    }
    this.channelToggleSyncing = true;
    try {
      group.writeValue(this.activeChannel());
    } finally {
      this.channelToggleSyncing = false;
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

  async startAnotherQuizAfterFinish(): Promise<void> {
    if (!this.canStartAnotherQuiz()) {
      return;
    }
    await this.startQuizSelectionFlow();
  }

  private async reopenQuickFeedbackAfterQuiz(): Promise<void> {
    if (!this.code || this.channelActivationPending()) {
      return;
    }
    this.channelActivationPending.set('quickFeedback');
    try {
      const channels = await trpc.session.reopenQuickFeedbackChannel.mutate({
        code: this.code.toUpperCase(),
      });
      this.patchSessionChannels(channels);
      await this.reloadSessionInfo();
      await this.refreshQuickFeedbackResult();
      this.dismissHostSteeringCallout();
    } catch (error) {
      this.openHostSteeringCalloutForSteeringFailure(
        () => void this.reopenQuickFeedbackAfterQuiz(),
        error,
      );
    } finally {
      this.channelActivationPending.set(null);
    }
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
    } catch (error) {
      this.openHostSteeringCalloutForSteeringFailure(
        () => void this.startQuizSelectionFlow(),
        error,
      );
    } finally {
      this.channelActivationPending.set(null);
    }
  }

  private async attachUploadedQuizToSession(uploadedQuizId: string): Promise<void> {
    let attached = false;
    try {
      const channels = await trpc.session.attachQuizToSession.mutate({
        code: this.code.toUpperCase(),
        quizId: uploadedQuizId,
      });
      attached = true;
      // Kanal sofort lokal aktivieren, bevor Folge-Refreshes (getInfo/Teams/…) durchlaufen.
      this.patchSessionChannels(channels);
      this.activeChannel.set('quiz');
      this.ensureActiveChannel();
      await this.finalizeQuizChannelActivation();
      this.dismissHostSteeringCallout();
    } catch (error) {
      const retry = attached
        ? () => void this.finalizeQuizChannelActivation()
        : () => void this.attachUploadedQuizToSession(uploadedQuizId);
      this.openHostSteeringCalloutForSteeringFailure(retry, error);
    }
  }

  private async finalizeQuizChannelActivation(): Promise<void> {
    let sessionReloaded = false;
    try {
      await this.reloadSessionInfo();
      sessionReloaded = true;
      this.clearQuizAttachSessionInfoRetry();
    } catch {
      // Attach hat den Kanal schon gesetzt; getInfo kann kurz scheitern – UI bleibt auf Quiz.
      this.scheduleQuizAttachSessionInfoRetry();
    }
    if (!this.channels().quiz) {
      this.patchSessionChannels({
        quiz: { enabled: true },
        qa: this.session()?.channels?.qa ?? {
          enabled: false,
          open: false,
          title: null,
          moderationMode: false,
        },
        quickFeedback: this.session()?.channels?.quickFeedback ?? {
          enabled: false,
          open: false,
        },
      });
    }
    this.activeChannel.set('quiz');
    this.ensureActiveChannel();

    await Promise.all([
      this.refreshParticipantsPayload(),
      this.refreshLobbyTeams(),
      this.refreshCurrentQuestionForHost(),
      this.refreshQuickFeedbackResult(),
      this.refreshQaQuestionsForChannelActivation(),
    ]);
    await this.syncPreferredLiveChannel('quiz');
    if (!sessionReloaded && this.quizAttachSessionInfoRetryTimer === null) {
      this.scheduleQuizAttachSessionInfoRetry();
    }
  }

  private scheduleQuizAttachSessionInfoRetry(): void {
    if (this.quizAttachSessionInfoRetryTimer) {
      return;
    }
    if (this.quizAttachSessionInfoRetryCount >= QUIZ_ATTACH_SESSION_INFO_RETRY_LIMIT) {
      this.clearQuizAttachSessionInfoRetry();
      return;
    }
    this.quizAttachSessionInfoRetryCount += 1;
    this.quizAttachSessionInfoRetryTimer = setTimeout(() => {
      this.quizAttachSessionInfoRetryTimer = null;
      void this.reloadSessionInfo()
        .then(async () => {
          this.clearQuizAttachSessionInfoRetry();
          await Promise.all([this.refreshParticipantsPayload(), this.refreshLobbyTeams()]);
        })
        .catch(() => {
          this.scheduleQuizAttachSessionInfoRetry();
        });
    }, QUIZ_ATTACH_SESSION_INFO_RETRY_MS * this.quizAttachSessionInfoRetryCount);
  }

  private clearQuizAttachSessionInfoRetry(): void {
    if (this.quizAttachSessionInfoRetryTimer) {
      clearTimeout(this.quizAttachSessionInfoRetryTimer);
      this.quizAttachSessionInfoRetryTimer = null;
    }
    this.quizAttachSessionInfoRetryCount = 0;
  }

  /** Wie refreshQaQuestions, aber ohne Steering-Callout bei transienten Fehlern. */
  private async refreshQaQuestionsForChannelActivation(): Promise<void> {
    await this.refreshQaQuestions({ silent: true });
  }

  private async chooseQuizForSession(): Promise<string | undefined> {
    this.quizStore.ensureDemoQuiz();
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
    const quizProfile = {
      nicknameTheme: quiz.settings.nicknameTheme,
      allowCustomNicknames: quiz.settings.allowCustomNicknames,
      anonymousMode: quiz.settings.anonymousMode,
      teamMode: quiz.settings.teamMode,
      teamCount: quiz.settings.teamMode ? quiz.settings.teamCount : null,
      teamAssignment: quiz.settings.teamMode ? quiz.settings.teamAssignment : 'AUTO',
      teamNames: quiz.settings.teamMode ? quiz.settings.teamNames : [],
    };
    if (
      localQuizId === DEMO_QUIZ_ID &&
      !sessionProfile.teamMode &&
      quizProfile.teamMode &&
      quizProfile.teamAssignment === 'AUTO'
    ) {
      return true;
    }
    return this.areOnboardingProfilesCompatible(sessionProfile, quizProfile);
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
    if (channel === 'qa' && this.qaChannelNeedsConfiguration()) {
      this.channelActivationPending.set('qa');
      try {
        await this.openQaConfigurationDialog({ numberSetupSequence: true });
      } catch {
        this.openHostSteeringCalloutForSteeringFailure(() => void this.enableChannel(channel));
      } finally {
        this.channelActivationPending.set(null);
      }
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
      await this.reconcilePresentedChannel();
      if (channel === 'qa') {
        this.showStagedRecoveryCard();
      }
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.enableChannel(channel));
    } finally {
      this.channelActivationPending.set(null);
    }
  }

  async openQaConfigurationDialog(options?: {
    numberSetupSequence?: boolean;
    abortUnconfiguredSessionOnCancel?: boolean;
  }): Promise<void> {
    if (this.qaConfigurationDialogInFlight) {
      return this.qaConfigurationDialogInFlight;
    }
    const run = this.openQaConfigurationDialogNow(options);
    this.qaConfigurationDialogInFlight = run.finally(() => {
      this.qaConfigurationDialogInFlight = null;
    });
    return this.qaConfigurationDialogInFlight;
  }

  private async openQaConfigurationDialogNow(options?: {
    numberSetupSequence?: boolean;
    abortUnconfiguredSessionOnCancel?: boolean;
  }): Promise<void> {
    const session = this.session();
    if (!session || !this.code || this.effectiveStatus() === 'FINISHED') {
      return;
    }
    if (getStagedHostRecoveryCard(this.code) && !this.qaChannelNeedsConfiguration()) {
      await this.showStagedRecoveryCard(
        this.requestedQaCreateSetup && !this.qaCreateSetupCompleted
          ? { setupStep: 2, setupStepCount: 2 }
          : undefined,
      );
      return;
    }
    const lifecycle = await trpc.session.getLifecycleForHost.query({
      code: this.code.toUpperCase(),
    });
    this.sessionLifecycle.set(lifecycle);
    const numberSetupSequence =
      options?.numberSetupSequence === true &&
      !this.qaCreateSetupCompleted &&
      Boolean(getStagedHostRecoveryCard(this.code));
    const setupStepCount = 2;
    const setupStep = 1;
    const result = await firstValueFrom(
      this.dialog
        .open<
          QaChannelConfigurationDialogComponent,
          QaChannelConfigurationDialogData,
          SessionQaConfigurationDTO | null
        >(QaChannelConfigurationDialogComponent, {
          data: {
            code: this.code.toUpperCase(),
            session,
            profileLocked: Boolean(lifecycle.firstParticipantJoinedAt),
            ...(this.requestedQaCreateSetup && !this.qaCreateSetupCompleted
              ? { omitParticipationProfile: true }
              : {}),
            ...(numberSetupSequence
              ? {
                  setupStep,
                  setupStepCount,
                }
              : {}),
          },
          width: 'min(42rem, calc(100vw - 2rem))',
          maxWidth: '100vw',
          autoFocus: 'dialog',
          restoreFocus: true,
          ...SESSION_LIFECYCLE_DIALOG_OVERLAY,
        })
        .afterClosed(),
    );
    if (!result) {
      if (options?.abortUnconfiguredSessionOnCancel && this.qaChannelNeedsConfiguration()) {
        await this.abortUnconfiguredQaCreateAndReturnHome();
      }
      return;
    }
    this.session.update((current) =>
      current
        ? {
            ...current,
            channels: result.channels,
            preferredChannel: result.preferredChannel,
            qaClosesAt: result.qaClosesAt,
            expiresAt: result.expiresAt,
            sessionLifecycleRevision: result.sessionLifecycleRevision,
            serverNow: result.serverNow,
          }
        : current,
    );
    this.syncQaTitleDraftFromSession();
    this.activeChannel.set('qa');
    this.ensureActiveChannel();
    this.scheduleQaDeadlineCheck();
    await this.refreshQaQuestions();
    await this.showStagedRecoveryCard(
      (this.requestedQaCreateSetup && !this.qaCreateSetupCompleted) || numberSetupSequence
        ? { setupStep: 2, setupStepCount: 2 }
        : undefined,
    );
  }

  private syncPreferredLiveChannel(channel: SessionChannelTab): Promise<void> {
    return this.enqueuePresenterProjectionSync(() => this.syncPreferredLiveChannelNow(channel));
  }

  private async syncPreferredLiveChannelNow(
    channel: SessionChannelTab,
    options?: { forceServer?: boolean },
  ): Promise<void> {
    if (!this.code || !this.isPresenterChannelSelectable(channel)) {
      return;
    }
    if (!options?.forceServer && this.session()?.preferredChannel === channel) {
      return;
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const expectedLifecycleRevision = this.session()?.sessionLifecycleRevision;
        const result = await trpc.session.setPreferredLiveChannel.mutate({
          code: this.code.toUpperCase(),
          channel,
          ...(expectedLifecycleRevision !== undefined ? { expectedLifecycleRevision } : {}),
        });
        this.session.update((session) =>
          session
            ? {
                ...session,
                preferredChannel: result.preferredChannel,
                presenterSurface:
                  session.preferredChannel === result.preferredChannel
                    ? session.presenterSurface
                    : 'default',
                sessionLifecycleRevision: result.sessionLifecycleRevision,
                serverNow: result.serverNow,
              }
            : session,
        );
        return;
      } catch {
        if (attempt === 0) {
          try {
            await this.reloadSessionInfo();
            if (!this.isPresenterChannelSelectable(channel)) {
              return;
            }
            continue;
          } catch {
            // Fällt in den lokalen Bedienpfad zurück.
          }
        }
      }
      return;
    }
  }

  private syncPresenterSurface(surface: SessionPresenterSurface): Promise<void> {
    return this.enqueuePresenterProjectionSync(() => this.syncPresenterSurfaceNow(surface));
  }

  private async syncPresenterSurfaceNow(surface: SessionPresenterSurface): Promise<void> {
    if (!this.code || this.session()?.presenterSurface === surface) {
      return;
    }
    try {
      const result = await trpc.session.setPresenterSurface.mutate({
        code: this.code.toUpperCase(),
        surface,
      });
      this.session.update((session) =>
        session ? { ...session, presenterSurface: result.presenterSurface } : session,
      );
    } catch {
      // Die lokale Wortwolkenansicht bleibt bedienbar, auch wenn die Projektion nicht synchronisiert.
    }
  }

  private async activatePresenterSurface(
    surface: SessionPresenterSurface,
    channel: SessionChannelTab,
  ): Promise<void> {
    await this.enqueuePresenterProjectionSync(async () => {
      await this.syncPreferredLiveChannelNow(channel, { forceServer: true });
      await this.syncPresenterSurfaceNow(surface);
    });
  }

  private buildQaWordCloudPresenterProjection(): QaWordCloudPresenterProjectionDTO {
    const coverage = this.qaWordCloudCoverage();
    const questionCount = this.qaWordCloudQuestions().length;
    const modelVersion =
      this.qaWordCloudThemeAnalysisResult()?.modelVersion ??
      this.qaWordCloudLemmaResult()?.modelVersion ??
      null;
    return {
      mode: this.qaWordCloudEffectiveAnalysisVariant(),
      metric: this.qaSortMode(),
      locale: this.qaWordCloudAnalysisLocale(),
      analysisEntries: this.collectQaWordCloudPresenterEntries(),
      analyzedQuestionCount: coverage?.analyzedQuestionCount ?? questionCount,
      eligibleQuestionCount: coverage?.eligibleQuestionCount ?? questionCount,
      modelVersion: modelVersion && modelVersion.length > 0 ? modelVersion : null,
      smoothingActive: this.qaWordCloudLemmaSnapshotVisible(),
    };
  }

  private collectQaWordCloudPresenterEntries(): WordCloudAnalysisEntryDTO[] {
    const entries = this.qaWordCloudAnalysisEntries();
    if (entries && entries.length > 0) {
      return this.sanitizeQaWordCloudPresenterEntries(entries);
    }

    return this.sanitizeQaWordCloudPresenterEntries(
      this.qaWordCloudTerms().flatMap((term) => {
        const member = term.members[0];
        if (!member) {
          return [];
        }
        return [
          {
            key: term.key,
            label: term.label,
            count: Math.max(1, term.documentFrequency),
            basisLabel: term.basisLabel,
            members: [
              {
                sourceId: member.sourceId,
                text: member.text,
                weight: member.weight,
              },
            ],
            variants: term.variants.length > 0 ? term.variants : [term.label],
            confidence: term.confidence,
          },
        ];
      }),
    );
  }

  private sanitizeQaWordCloudPresenterEntries(
    entries: readonly WordCloudAnalysisEntryDTO[],
  ): WordCloudAnalysisEntryDTO[] {
    const sanitized: WordCloudAnalysisEntryDTO[] = [];
    for (const entry of entries) {
      const parsed = WordCloudAnalysisEntryDTOSchema.safeParse(entry);
      if (!parsed.success) {
        continue;
      }
      sanitized.push(parsed.data);
      if (sanitized.length >= QA_WORD_CLOUD_MAX_OUTPUT_ENTRIES) {
        break;
      }
    }
    return sanitized;
  }

  private publishQaWordCloudProjection(projection: QaWordCloudPresenterProjectionDTO): void {
    if (!this.code) {
      return;
    }

    const key = JSON.stringify(projection);
    if (key === this.lastQaWordCloudProjectionKey) {
      return;
    }
    this.lastQaWordCloudProjectionKey = key;
    void this.enqueuePresenterProjectionSync(async () => {
      try {
        await trpc.session.setQaWordCloudProjection.mutate({
          code: this.code.toUpperCase(),
          projection,
        });
      } catch {
        this.lastQaWordCloudProjectionKey = null;
      }
    });
  }

  private enqueuePresenterProjectionSync(operation: () => Promise<void>): Promise<void> {
    const queued = this.presenterProjectionSyncQueue.then(operation, operation);
    this.presenterProjectionSyncQueue = queued;
    return queued;
  }

  private isPresenterChannelSelectable(channel: SessionChannelTab): boolean {
    return this.isChannelEnabled(channel);
  }

  private async reconcilePresentedChannel(): Promise<void> {
    const active = this.activeChannel();
    if (this.isPresenterChannelSelectable(active)) {
      await this.syncPreferredLiveChannel(active);
      return;
    }

    const preferred = this.session()?.preferredChannel;
    if (preferred && this.isPresenterChannelSelectable(preferred)) {
      return;
    }

    const fallback = (['quiz', 'qa', 'quickFeedback'] as const).find((channel) =>
      this.isPresenterChannelSelectable(channel),
    );
    if (fallback) {
      await this.syncPreferredLiveChannel(fallback);
    }
  }

  private patchSessionChannels(channels: SessionChannelsDTO): void {
    this.session.update((session) => (session ? { ...session, channels } : session));
    this.scheduleQaDeadlineCheck();
  }

  activeChannelVisibilityActionLabel(): string | null {
    if (this.effectiveStatus() === 'FINISHED') {
      return null;
    }
    const active = this.activeChannel();
    if (active === 'quiz') {
      const status = this.effectiveStatus();
      if (this.isQuizPausedByHost()) {
        return $localize`:@@sessionHost.resumeQuiz:Quiz fortsetzen`;
      }
      if (status === 'QUESTION_OPEN' || status === 'ACTIVE') {
        return $localize`:@@sessionHost.pauseQuiz:Quiz pausieren`;
      }
      return null;
    }
    if (active !== 'qa' && active !== 'quickFeedback') {
      return null;
    }
    if (!this.isChannelEnabled(active)) {
      return null;
    }
    if (active === 'qa') {
      return this.isChannelOpen(active)
        ? $localize`:@@sessionTabs.closeQaChannelAction:Q&A schließen`
        : $localize`:@@sessionTabs.reopenQaChannelAction:Q&A wieder öffnen`;
    }
    return this.isChannelOpen(active)
      ? $localize`:@@sessionTabs.closeQuickFeedbackChannelAction:Blitzlicht beenden`
      : $localize`:@@sessionTabs.reopenQuickFeedbackChannelAction:Blitzlicht wieder öffnen`;
  }

  activeChannelVisibilityIcon(): string {
    const active = this.activeChannel();
    if (active === 'quiz') {
      return this.isQuizPausedByHost() ? 'play_arrow' : 'pause';
    }
    if (active !== 'qa' && active !== 'quickFeedback') {
      return 'visibility';
    }
    return this.isChannelOpen(active) ? 'visibility_off' : 'visibility';
  }

  async toggleActiveChannelOpen(): Promise<void> {
    if (this.effectiveStatus() === 'FINISHED') {
      return;
    }
    const active = this.activeChannel();
    if (active === 'quiz') {
      await this.toggleQuizPause();
      return;
    }
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

  private async toggleQuizPause(): Promise<void> {
    const status = this.effectiveStatus();
    if (
      this.channelVisibilityPending() ||
      !this.isChannelEnabled('quiz') ||
      !this.code ||
      (status !== 'QUESTION_OPEN' && status !== 'ACTIVE' && !this.isQuizPausedByHost())
    ) {
      return;
    }

    this.channelVisibilityPending.set('quiz');
    try {
      const result =
        status === 'PAUSED'
          ? await trpc.session.resumeQuiz.mutate({ code: this.code.toUpperCase() })
          : await trpc.session.pauseQuiz.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      this.syncCountdownFromStatusUpdate(result);
      await this.refreshCurrentQuestionForHost();
      this.syncMusic();
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForSteeringFailure(() => void this.toggleQuizPause());
    } finally {
      this.channelVisibilityPending.set(null);
    }
  }

  private ensureQaSubscription(): void {
    const sessionId = this.session()?.id ?? null;
    const qaEnabled = this.channels().qa;
    const sortMode = this.qaSortMode();
    const statuses = this.qaListStatuses();
    const search = this.qaSearch();
    const subscriptionKey = sessionId
      ? `${sessionId}:${sortMode}:${statuses.join(',')}:${search}`
      : null;
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
      {
        sessionId,
        moderatorView: true,
        sort: sortMode,
        pageSize: 100,
        statuses,
        search: search || undefined,
      },
      {
        onData: (data) => {
          this.handleQaQuestionsInvalidation(data);
        },
        onError: (error) => {
          if (this.consumeHostUnauthorized(error)) return;
          this.burstHostFallbackAfterWsGap();
        },
      },
    );
    this.qaSubscriptionKey = subscriptionKey;
  }

  private handleQaQuestionsInvalidation(data: QaQuestionsInvalidationDTO): void {
    if (data.sessionLifecycleRevision < this.latestQaLifecycleRevision) {
      return;
    }
    this.latestQaLifecycleRevision = data.sessionLifecycleRevision;
    if (data.state === 'POST_PROCESSING_ENDED') {
      this.closeHostPostProcessing();
      return;
    }
    if (data.postProcessingEndsAt) {
      const accepted = this.postProcessingDeadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: data.serverNow,
        expiresAt: data.postProcessingEndsAt,
        sessionLifecycleRevision: data.sessionLifecycleRevision,
      });
      if (!accepted && this.postProcessingDeadline.isExpired()) {
        this.closeHostPostProcessing();
        return;
      }
    }
    void this.refreshQaQuestions({ silent: true });
  }

  private syncQaTitleDraftFromSession(): void {
    this.qaTitleDraft.set(this.session()?.channels?.qa?.title ?? '');
  }

  startQaTitleEdit(): void {
    if (this.session()?.status === 'FINISHED' || this.effectiveStatus() === 'FINISHED') return;
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
        ...(this.shouldSkipCurrentResultQuestionOnNext() && { skipCurrentResultQuestion: true }),
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

  async skipQuestion(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    const question = this.displayedCurrentQuestionForHost();
    const status = this.effectiveStatus();
    if (!question || (status !== 'QUESTION_OPEN' && status !== 'ACTIVE')) return;
    const questionId = question.questionId;
    if (!questionId) return;
    const trigger =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const voteCount = this.hostVoteCount(question);
    const skipFinishesSession = !this.canOpenFollowingQuestion();
    const consequences: string[] = [];
    if (voteCount > 0) {
      consequences.push(
        $localize`:@@sessionHost.skipQuestionDialogVotes:Bereits abgegebene Antworten werden nicht ausgewertet.`,
      );
    }
    if (skipFinishesSession) {
      consequences.push(
        $localize`:@@sessionHost.skipQuestionDialogEndsSession:Es folgt keine weitere Frage. Die Session wird beendet.`,
      );
    }
    const dialogRef = this.dialog.open(ConfirmLeaveDialogComponent, {
      data: {
        title: $localize`:@@sessionHost.skipQuestionDialogTitle:Frage auslassen?`,
        message: $localize`:@@sessionHost.skipQuestionDialogMessage:Diese Frage wird aus der laufenden Session und der Nachbesprechung ausgeschlossen.`,
        consequences,
        confirmLabel: $localize`:@@sessionHost.skipQuestionConfirm:Frage auslassen`,
        cancelLabel: $localize`:@@sessionHost.skipQuestionCancel:Frage behalten`,
      } satisfies ConfirmLeaveDialogData,
      width: 'min(26rem, calc(100vw - 1.5rem))',
      maxWidth: '100vw',
      autoFocus: 'dialog',
      restoreFocus: false,
    });
    if ((await firstValueFrom(dialogRef.afterClosed())) !== true) {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      return;
    }
    await this.executeSkipQuestion(questionId);
  }

  private async executeSkipQuestion(questionId: string): Promise<void> {
    if (this.controlPending() || !this.code) return;
    const countdownDeadline =
      this.effectiveStatus() === 'ACTIVE' && this.countdownSeconds() !== null
        ? Date.now() + Math.max(0, this.countdownSeconds() ?? 0) * 1000
        : null;
    this.controlPending.set(true);
    try {
      this.clearEmojiNewBadge();
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.skipQuestion.mutate({
        code: this.code.toUpperCase(),
        questionId,
      });
      this.statusUpdate.set(result);
      this.steppedBackToPreviousResult.set(false);
      this.skipCurrentResultQuestionOnNext.set(false);
      this.syncCountdownFromStatusUpdate(result);
      this.dismissHostSteeringCallout();
      await this.refreshCurrentQuestionForHost();
      this.focusAfterQuestionSkip(result.status);
      if (result.status === 'FINISHED') {
        this.snackBar.open(
          $localize`:@@sessionHost.skipQuestionSuccessFinished:Frage ausgelassen. Die Session ist beendet.`,
          '',
          { duration: 4000 },
        );
      } else {
        this.snackBar.open(
          $localize`:@@sessionHost.skipQuestionSuccess:Frage ausgelassen. Die nächste Frage wurde gestartet.`,
          '',
          { duration: 4000 },
        );
      }
    } catch {
      this.restoreCountdownAfterFailedSkip(questionId, countdownDeadline);
      this.openHostSteeringCalloutForSteeringFailure(
        () => void this.executeSkipQuestion(questionId),
      );
    } finally {
      this.controlPending.set(false);
    }
  }

  private restoreCountdownAfterFailedSkip(
    questionId: string,
    countdownDeadline: number | null,
  ): void {
    if (
      this.effectiveStatus() !== 'ACTIVE' ||
      this.displayedCurrentQuestionForHost()?.questionId !== questionId
    ) {
      return;
    }

    const latestStatus = this.statusUpdate();
    if (
      latestStatus?.status === 'ACTIVE' &&
      latestStatus.activeAt &&
      latestStatus.timer !== undefined
    ) {
      this.syncCountdownFromStatusUpdate(latestStatus);
      return;
    }

    if (countdownDeadline === null) return;
    const remaining = remainingCountdownSeconds(countdownDeadline);
    if (remaining > 0) {
      this.startCountdown(remaining);
      return;
    }
    this.finishRoomCountdown();
  }

  private focusAfterQuestionSkip(status: SessionStatus): void {
    afterNextRender(
      () => {
        const target =
          status === 'FINISHED'
            ? this.sessionFinishedHeadingRef?.nativeElement
            : this.hostQuestionCardRef?.nativeElement;
        if (target?.isConnected) target.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  async prevQuestion(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    if (!this.canShowPreviousResultAnchor()) return;
    this.controlPending.set(true);
    try {
      const result = await trpc.session.prevQuestion.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      this.steppedBackToPreviousResult.set(true);
      this.skipCurrentResultQuestionOnNext.set(true);
      this.dismissHostSteeringCallout();
      this.controlPending.set(false);
      await this.refreshCurrentQuestionForHost();
      if (this.shouldPollLiveFreetext()) {
        await this.refreshLiveFreetext();
      }
    } catch (error) {
      if (isPrevQuestionUnavailableError(error)) {
        this.steppedBackToPreviousResult.set(true);
        return;
      }
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

    let active = this.activeChannel();
    const visible = this.visibleChannels();
    if (!this.isChannelEnabled(active) && visible.length > 0) {
      active = visible[0]!;
      this.activeChannel.set(active);
    }

    if (!available.includes(active)) {
      active = available[0]!;
      this.activeChannel.set(active);
    }

    const urlTab = this.requestedInitialTab;
    if (
      !this.initialUrlTabApplied &&
      (urlTab === 'quiz' || urlTab === 'qa' || urlTab === 'quickFeedback')
    ) {
      if (visible.includes(urlTab)) {
        if (active !== urlTab) {
          this.activeChannel.set(urlTab);
        }
        this.initialUrlTabApplied = true;
        this.initialPreferredChannelApplied = true;
        return;
      }
      if (!this.session()?.channels) {
        return;
      }
      this.initialUrlTabApplied = true;
    } else if (!this.initialUrlTabApplied) {
      this.initialUrlTabApplied = true;
    }

    if (
      !this.initialPreferredChannelApplied &&
      visible.includes('qa') &&
      this.effectiveStatus() === 'FINISHED'
    ) {
      this.initialPreferredChannelApplied = true;
      if (active !== 'qa') {
        this.activeChannel.set('qa');
      }
      return;
    }

    const preferred = this.session()?.preferredChannel;
    if (!this.initialPreferredChannelApplied && preferred && visible.includes(preferred)) {
      this.initialPreferredChannelApplied = true;
      if (active !== preferred) {
        this.activeChannel.set(preferred);
      }
    } else if (!this.initialPreferredChannelApplied && this.session()) {
      this.initialPreferredChannelApplied = true;
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

  private resetQaListPageNavigation(): void {
    this.qaListCurrentCursor = null;
    this.qaListCursorHistory = [];
    this.qaListPageIndex.set(0);
  }

  private async applyHostQaQuestionsSnapshot(
    snapshot: QaQuestionsListDTO | QaQuestionDTO[],
    options: { append?: boolean } = {},
  ): Promise<boolean> {
    if (Array.isArray(snapshot)) {
      if (this.postProcessingEnded()) {
        return false;
      }
      this.qaQuestions.set(snapshot);
      this.qaListTotalCount.set(
        snapshot.filter((question) => question.status !== 'DELETED').length,
      );
      this.qaListNextCursor.set(null);
      this.qaListRankingRevision.set(null);
      this.resetQaListPageNavigation();
      this.dismissHostSteeringCallout();
      return true;
    }
    if (snapshot.sessionLifecycleRevision < this.latestQaLifecycleRevision) {
      return false;
    }
    this.latestQaLifecycleRevision = snapshot.sessionLifecycleRevision;
    if (
      options.append &&
      this.qaListRankingRevision() !== null &&
      (snapshot.rankingRevision ?? null) !== this.qaListRankingRevision()
    ) {
      return false;
    }

    if (snapshot.postProcessingEndsAt) {
      const accepted = this.postProcessingDeadline.applySnapshot({
        status: snapshot.state === 'POST_PROCESSING_ENDED' ? 'FINISHED' : 'ACTIVE',
        serverNow: snapshot.serverNow,
        expiresAt: snapshot.postProcessingEndsAt,
        sessionLifecycleRevision: snapshot.sessionLifecycleRevision,
      });
      if (
        snapshot.state === 'POST_PROCESSING_ENDED' ||
        (!accepted && this.postProcessingDeadline.isExpired()) ||
        this.postProcessingDeadline.isExpired()
      ) {
        this.closeHostPostProcessing();
        return false;
      }
    }

    if (snapshot.state !== 'ACTIVE') {
      this.qaQuestions.set([]);
      this.qaListTotalCount.set(0);
      this.qaListNextCursor.set(null);
      this.qaListRankingRevision.set(snapshot.rankingRevision ?? null);
      this.resetQaListPageNavigation();
      return false;
    }
    this.postProcessingEnded.set(false);
    this.qaQuestions.set(snapshot.questions);
    if (!options.append) {
      this.resetQaListPageNavigation();
    }
    this.qaListTotalCount.set(snapshot.totalCount ?? snapshot.questions.length);
    this.qaListNextCursor.set(snapshot.nextCursor ?? null);
    this.qaListRankingRevision.set(snapshot.rankingRevision ?? null);
    this.dismissHostSteeringCallout();
    return true;
  }

  private closeHostPostProcessing(): void {
    const wasAlreadyEnded = this.postProcessingEnded();
    this.postProcessingEnded.set(true);
    this.qaQuestions.set([]);
    this.qaListTotalCount.set(0);
    this.qaListNextCursor.set(null);
    this.qaListRankingRevision.set(null);
    this.resetQaListPageNavigation();
    this.qaSummaryRuntime.set(null);
    this.qaNlpEnabled.set(false);
    this.frozenQaWordCloudQuestions.set(null);
    this.qaWordCloudThemeAnalysisResult.set(null);
    this.qaSub?.unsubscribe();
    this.qaSub = null;
    this.qaSubscriptionKey = null;
    if (!wasAlreadyEnded) {
      afterNextRender(
        () =>
          (
            this.postProcessingEndedHeadingRef?.nativeElement ??
            this.sessionFinishedHeadingRef?.nativeElement
          )?.focus({ preventScroll: true }),
        { injector: this.injector },
      );
    }
  }

  private qaListStatuses(): Array<QaQuestionDTO['status']> {
    return this.qaShowPinnedOnly() ? ['PINNED'] : ['PENDING', 'ACTIVE', 'PINNED', 'ARCHIVED'];
  }

  private hostQaListQueryInput(cursor?: string | null) {
    const sessionId = this.session()?.id;
    const search = this.qaSearch();
    const authorNickname = this.qaSelectedAuthorNickname();
    return {
      sessionId: sessionId!,
      moderatorView: true as const,
      sort: this.qaSortMode(),
      pageSize: 100,
      statuses: this.qaListStatuses(),
      ...(search ? { search } : {}),
      ...(authorNickname ? { authorNickname } : {}),
      ...(cursor ? { cursor } : {}),
    };
  }

  async setQaPinnedFilter(pinnedOnly: boolean): Promise<void> {
    if (this.qaShowPinnedOnly() === pinnedOnly) return;
    this.qaShowPinnedOnly.set(pinnedOnly);
    this.ensureQaSubscription();
    await this.refreshQaQuestions({ replaceStale: true });
    this.scrollQaListToTop();
  }

  onQaSearchInput(value: string): void {
    this.qaSearchDraft.set(value);
    if (this.qaSearchTimer) clearTimeout(this.qaSearchTimer);
    this.qaSearchTimer = setTimeout(() => {
      this.qaSearchTimer = null;
      const search = this.qaSearchDraft().trim();
      if (search === this.qaSearch()) return;
      if (search && !this.qaSearch()) {
        this.captureUnfilteredQaChrome();
      }
      this.qaSearch.set(search);
      if (!search) {
        this.releaseQaChromeIfUnfiltered();
      }
      this.ensureQaSubscription();
      void this.refreshQaQuestions({ replaceStale: true }).then(() => this.scrollQaListToTop());
    }, 300);
  }

  clearQaSearch(): void {
    if (this.qaSearchTimer) {
      clearTimeout(this.qaSearchTimer);
      this.qaSearchTimer = null;
    }
    this.qaSearchDraft.set('');
    if (this.qaSearch() === '') return;
    this.qaSearch.set('');
    this.releaseQaChromeIfUnfiltered();
    this.ensureQaSubscription();
    void this.refreshQaQuestions({ replaceStale: true }).then(() => this.scrollQaListToTop());
  }

  async loadMoreQaQuestions(): Promise<void> {
    const cursor = this.qaListNextCursor();
    if (!cursor || this.qaListPageLoading()) return;
    const previousCursor = this.qaListCurrentCursor;
    const loaded = await this.loadQaQuestionsPage(cursor);
    if (loaded) {
      this.qaListCursorHistory.push(previousCursor);
      this.qaListCurrentCursor = cursor;
      this.qaListPageIndex.update((index) => index + 1);
      this.scrollQaListToTop();
    }
  }

  async loadPreviousQaQuestions(): Promise<void> {
    if (this.qaListCursorHistory.length === 0 || this.qaListPageLoading()) return;
    const target = this.qaListCursorHistory[this.qaListCursorHistory.length - 1] ?? null;
    const loaded = await this.loadQaQuestionsPage(target);
    if (loaded) {
      this.qaListCursorHistory.pop();
      this.qaListCurrentCursor = target;
      this.qaListPageIndex.update((index) => Math.max(0, index - 1));
      this.scrollQaListToTop();
    }
  }

  private async loadQaQuestionsPage(cursor: string | null): Promise<boolean> {
    const sessionId = this.session()?.id;
    if (!sessionId) return false;
    const requestGeneration = ++this.qaListRequestGeneration;
    this.qaListPageLoading.set(true);
    try {
      const snapshot = await trpc.qa.list.query(this.hostQaListQueryInput(cursor));
      if (requestGeneration !== this.qaListRequestGeneration) {
        return false;
      }
      const accepted = await this.applyHostQaQuestionsSnapshot(snapshot, { append: true });
      if (!accepted) {
        await this.refreshQaQuestions();
      }
      return accepted;
    } catch {
      await this.refreshQaQuestions();
      return false;
    } finally {
      this.qaListPageLoading.set(false);
    }
  }

  private async refreshQaQuestions(options?: {
    silent?: boolean;
    replaceStale?: boolean;
  }): Promise<void> {
    const sessionId = this.session()?.id;
    const requestGeneration = ++this.qaListRequestGeneration;
    if (!sessionId || !this.channels().qa) {
      this.qaQuestions.set([]);
      this.qaListTotalCount.set(0);
      this.qaListNextCursor.set(null);
      this.resetQaListPageNavigation();
      this.qaListPageLoading.set(false);
      return;
    }

    if (options?.replaceStale) {
      this.qaQuestions.set([]);
      this.qaListTotalCount.set(0);
      this.qaListNextCursor.set(null);
      this.resetQaListPageNavigation();
    }
    if (!options?.silent) {
      this.qaListPageLoading.set(true);
    }

    try {
      const snapshot = await trpc.qa.list.query(this.hostQaListQueryInput());
      if (requestGeneration !== this.qaListRequestGeneration) {
        return;
      }
      await this.applyHostQaQuestionsSnapshot(snapshot);
      this.dismissHostSteeringCallout();
    } catch (error) {
      if (requestGeneration !== this.qaListRequestGeneration) {
        return;
      }
      if (this.consumeHostUnauthorized(error)) {
        return;
      }
      if (options?.silent) {
        return;
      }
      this.openHostSteeringCalloutForQaFailure(() => void this.refreshQaQuestions());
    } finally {
      if (requestGeneration === this.qaListRequestGeneration) {
        this.qaListPageLoading.set(false);
      }
    }
  }

  private async refreshQaNlpRuntime(): Promise<void> {
    const sessionId = this.session()?.id;
    if (!sessionId) {
      this.qaNlpEnabled.set(false);
      return;
    }
    try {
      const runtime = await trpc.qa.nlpRuntime.query({ sessionId });
      this.qaNlpEnabled.set(runtime.enabled);
    } catch {
      this.qaNlpEnabled.set(false);
    }
  }

  private async refreshQaSummaryRuntime(): Promise<void> {
    const sessionId = this.session()?.id;
    if (!sessionId) {
      this.qaSummaryRuntime.set(null);
      this.stopQaSummaryPolling();
      return;
    }
    try {
      const runtime = await trpc.qa.summaryRuntime.query({ sessionId });
      this.qaSummaryRuntime.set(runtime);
      if (runtime.result?.status !== 'pending') {
        this.stopQaSummaryPolling();
      }
    } catch {
      this.qaSummaryRuntime.set(null);
      this.stopQaSummaryPolling();
    }
  }

  private async requestQaSummary(): Promise<void> {
    const sessionId = this.session()?.id;
    const runtime = this.qaSummaryRuntime();
    if (
      !sessionId ||
      !canRequestQaSummary({
        enabled: runtime?.enabled === true,
        inferenceConfigured: runtime?.inferenceConfigured === true,
        visibleQuestionCount: this.qaSummaryVisibleQuestionCount(),
      })
    ) {
      return;
    }
    try {
      const runtime = await trpc.qa.requestSummary.mutate({
        sessionId,
        locale: getEffectiveLocale(localeIdToSupported(this.localeId)),
      });
      this.qaSummaryRuntime.set(runtime);
      if (runtime.result?.status === 'pending') {
        this.startQaSummaryPolling();
      } else {
        this.stopQaSummaryPolling();
      }
    } catch {
      this.stopQaSummaryPolling();
    }
  }

  private startQaSummaryPolling(): void {
    this.stopQaSummaryPolling();
    this.qaSummaryPollTimer = setInterval(() => {
      void this.refreshQaSummaryRuntime();
    }, 750);
  }

  private stopQaSummaryPolling(): void {
    if (this.qaSummaryPollTimer) {
      clearInterval(this.qaSummaryPollTimer);
      this.qaSummaryPollTimer = null;
    }
  }

  private moderationNlpCategoryLabels(): Record<QaNlpCategory, string> {
    return {
      content: $localize`:@@sessionHost.moderationNlpCategoryContent:Inhaltliche Fragen`,
      organization: $localize`:@@sessionHost.moderationNlpCategoryOrganization:Fragen zum Ablauf`,
      technical: $localize`:@@sessionHost.moderationNlpCategoryTechnical:Technische Fragen`,
    };
  }

  private buildQaWordCloudAnalysisRequest(
    variant: WordCloudAnalysisVariant = this.qaWordCloudEffectiveAnalysisVariant(),
    options: { readonly refresh?: boolean } = {},
  ): AnalyzeWordCloudInput | null {
    if (!this.qaWordCloudDialogOpen()) {
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
    return {
      sessionCode: this.code.toUpperCase(),
      mode: variant,
      locale,
      metric: this.qaSortMode(),
      channel: 'QA',
      normalization: 'NONE',
      items,
      maxEntries: 40,
      ...(options.refresh ? { refresh: true } : {}),
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
      void this.refreshQaWordCloudThemeAnalysis(request, { keepPrevious: true });
    }, QA_WORD_CLOUD_ANALYSIS_DEBOUNCE_MS);
  }

  private syncQaWordCloudSemanticStale(request: AnalyzeWordCloudInput): void {
    const requestKey = wordCloudAnalysisRequestKey(request);
    if (
      this.lastQaWordCloudSemanticAnalyzedKey &&
      requestKey !== this.lastQaWordCloudSemanticAnalyzedKey
    ) {
      this.qaWordCloudSemanticStale.set(true);
    }
  }

  private queueQaWordCloudSemanticAnalysis(request: AnalyzeWordCloudInput): void {
    const requestKey = JSON.stringify(request);
    this.lastQaWordCloudAnalysisRequestKey = requestKey;
    this.markQaWordCloudSemanticPending();
    this.clearQaWordCloudThemeAnalysisTimer();
    this.qaWordCloudThemeAnalysisTimer = setTimeout(() => {
      this.qaWordCloudThemeAnalysisTimer = null;
      void this.refreshQaWordCloudThemeAnalysis(request, { keepPrevious: true });
    }, QA_WORD_CLOUD_ANALYSIS_DEBOUNCE_MS);
  }

  private markQaWordCloudSemanticPending(): number {
    const startedFresh =
      !this.qaWordCloudThemeAnalysisPending() || this.qaWordCloudSemanticPendingStartedAt <= 0;
    if (startedFresh) {
      this.qaWordCloudSemanticPendingStartedAt = Date.now();
      this.scheduleQaWordCloudSemanticWaitHint();
    }
    this.qaWordCloudThemeAnalysisPending.set(true);
    return this.qaWordCloudSemanticPendingStartedAt;
  }

  private markFreetextWordCloudSemanticPending(): number {
    const startedFresh =
      !this.freetextWordCloudSemanticAnalysisPending() ||
      this.freetextWordCloudSemanticPendingStartedAt <= 0;
    if (startedFresh) {
      this.freetextWordCloudSemanticPendingStartedAt = Date.now();
      this.scheduleFreetextWordCloudSemanticWaitHint();
    }
    this.freetextWordCloudSemanticAnalysisPending.set(true);
    return this.freetextWordCloudSemanticPendingStartedAt;
  }

  private resolveSemanticWaitHint(
    visible: boolean,
    itemCount: number,
    manyItemsHint: string,
  ): string | null {
    if (!visible) {
      return null;
    }

    const kind = semanticPendingWaitHintKind(WORD_CLOUD_SEMANTIC_WAIT_HINT_AFTER_MS, itemCount);
    if (kind === 'none') {
      return null;
    }

    return kind === 'minute' ? manyItemsHint : this.wordCloudSemanticWaitMomentHint;
  }

  private scheduleQaWordCloudSemanticWaitHint(): void {
    this.clearQaWordCloudSemanticWaitHint();
    this.qaWordCloudSemanticWaitHintTimer = setTimeout(() => {
      this.qaWordCloudSemanticWaitHintTimer = null;
      if (this.qaWordCloudThemeAnalysisPending()) {
        this.qaWordCloudSemanticWaitHintReady.set(true);
      }
    }, WORD_CLOUD_SEMANTIC_WAIT_HINT_AFTER_MS);
  }

  private scheduleFreetextWordCloudSemanticWaitHint(): void {
    this.clearFreetextWordCloudSemanticWaitHint();
    this.freetextWordCloudSemanticWaitHintTimer = setTimeout(() => {
      this.freetextWordCloudSemanticWaitHintTimer = null;
      if (this.freetextWordCloudSemanticAnalysisPending()) {
        this.freetextWordCloudSemanticWaitHintReady.set(true);
      }
    }, WORD_CLOUD_SEMANTIC_WAIT_HINT_AFTER_MS);
  }

  private clearQaWordCloudSemanticWaitHint(): void {
    if (this.qaWordCloudSemanticWaitHintTimer) {
      clearTimeout(this.qaWordCloudSemanticWaitHintTimer);
      this.qaWordCloudSemanticWaitHintTimer = null;
    }
    this.qaWordCloudSemanticWaitHintReady.set(false);
  }

  private clearFreetextWordCloudSemanticWaitHint(): void {
    if (this.freetextWordCloudSemanticWaitHintTimer) {
      clearTimeout(this.freetextWordCloudSemanticWaitHintTimer);
      this.freetextWordCloudSemanticWaitHintTimer = null;
    }
    this.freetextWordCloudSemanticWaitHintReady.set(false);
  }

  private clearQaWordCloudThemeAnalysisTimer(): void {
    if (!this.qaWordCloudThemeAnalysisTimer) {
      return;
    }

    clearTimeout(this.qaWordCloudThemeAnalysisTimer);
    this.qaWordCloudThemeAnalysisTimer = null;
  }

  private async refreshQaWordCloudThemeAnalysis(
    request: AnalyzeWordCloudInput,
    options: { readonly keepPrevious?: boolean } = {},
  ): Promise<void> {
    const runId = ++this.qaWordCloudThemeAnalysisRunId;
    if (!options.keepPrevious) {
      this.qaWordCloudThemeAnalysisResult.set(null);
    }
    let pendingStartedAt = Date.now();
    if (request.mode === 'SEMANTIC') {
      pendingStartedAt = this.markQaWordCloudSemanticPending();
    } else {
      this.qaWordCloudThemeAnalysisPending.set(true);
    }

    try {
      const result = await this.analyzeCanonicalQaWordCloud(request);
      if (runId !== this.qaWordCloudThemeAnalysisRunId) {
        return;
      }

      if (request.mode === 'SEMANTIC') {
        await holdSemanticPendingProgress(pendingStartedAt);
        if (runId !== this.qaWordCloudThemeAnalysisRunId) {
          return;
        }
      }

      this.qaWordCloudThemeAnalysisResult.set(result);
      this.qaWordCloudCoverage.set({
        analyzedQuestionCount: result.analyzedQuestionCount,
        eligibleQuestionCount: result.eligibleQuestionCount,
      });
      this.qaWordCloudThemeFallbackActive.set(result.fallbackUsed);
      if (request.mode === 'SEMANTIC') {
        this.lastQaWordCloudSemanticAnalyzedKey = wordCloudAnalysisRequestKey(request);
        this.qaWordCloudSemanticStale.set(false);
      }
    } catch {
      if (runId !== this.qaWordCloudThemeAnalysisRunId) {
        return;
      }

      if (request.mode === 'SEMANTIC') {
        await holdSemanticPendingProgress(pendingStartedAt);
        if (runId !== this.qaWordCloudThemeAnalysisRunId) {
          return;
        }
      }

      if (!options.keepPrevious) {
        this.qaWordCloudThemeAnalysisResult.set(null);
      }
      this.qaWordCloudThemeFallbackActive.set(true);
      // SEMANTIC: Fingerprint und Stale-Flag nur bei Erfolg aktualisieren.
      // Sonst gelten veraltete Cluster nach einem fehlgeschlagenen Retry als aktuell.
    } finally {
      if (runId === this.qaWordCloudThemeAnalysisRunId) {
        this.qaWordCloudThemeAnalysisPending.set(false);
        this.qaWordCloudSemanticPendingStartedAt = 0;
        this.clearQaWordCloudSemanticWaitHint();
      }
    }
  }

  private buildFreetextWordCloudSemanticAnalysisRequest(): AnalyzeWordCloudInput | null {
    if (this.freetextWordCloudMode() !== 'SEMANTIC') {
      return null;
    }

    if (!this.wordCloudExpanded() && !this.freetextWordCloudMaximized()) {
      return null;
    }

    const locale = this.qaWordCloudAnalysisLocale();
    if (!locale) {
      return null;
    }

    const items = this.buildFreetextWordCloudLemmaItems();
    return {
      sessionCode: this.code.toUpperCase(),
      mode: 'SEMANTIC',
      locale,
      metric: 'TOP',
      channel: 'FREETEXT',
      normalization: 'NONE',
      items,
      maxEntries: 40,
    };
  }

  private queueFreetextWordCloudSemanticAnalysis(request: AnalyzeWordCloudInput): void {
    const requestKey = JSON.stringify(request);
    if (requestKey === this.lastFreetextWordCloudSemanticRequestKey) {
      return;
    }

    this.lastFreetextWordCloudSemanticRequestKey = requestKey;
    this.markFreetextWordCloudSemanticPending();
    this.clearFreetextWordCloudSemanticAnalysisTimer();
    this.freetextWordCloudSemanticAnalysisTimer = setTimeout(() => {
      this.freetextWordCloudSemanticAnalysisTimer = null;
      void this.refreshFreetextWordCloudSemanticAnalysis(request);
    }, QA_WORD_CLOUD_ANALYSIS_DEBOUNCE_MS);
  }

  private clearFreetextWordCloudSemanticAnalysisTimer(): void {
    if (!this.freetextWordCloudSemanticAnalysisTimer) {
      return;
    }

    clearTimeout(this.freetextWordCloudSemanticAnalysisTimer);
    this.freetextWordCloudSemanticAnalysisTimer = null;
  }

  private async refreshFreetextWordCloudSemanticAnalysis(
    request: AnalyzeWordCloudInput,
  ): Promise<void> {
    const runId = ++this.freetextWordCloudSemanticAnalysisRunId;
    this.freetextWordCloudSemanticAnalysisResult.set(null);
    const pendingStartedAt = this.markFreetextWordCloudSemanticPending();

    try {
      const result = await trpc.wordCloud.analyze.mutate(request);
      if (runId !== this.freetextWordCloudSemanticAnalysisRunId) {
        return;
      }

      await holdSemanticPendingProgress(pendingStartedAt);
      if (runId !== this.freetextWordCloudSemanticAnalysisRunId) {
        return;
      }

      this.freetextWordCloudSemanticAnalysisResult.set(result);
    } catch {
      if (runId !== this.freetextWordCloudSemanticAnalysisRunId) {
        return;
      }

      await holdSemanticPendingProgress(pendingStartedAt);
      if (runId !== this.freetextWordCloudSemanticAnalysisRunId) {
        return;
      }

      this.freetextWordCloudSemanticAnalysisResult.set(null);
    } finally {
      if (runId === this.freetextWordCloudSemanticAnalysisRunId) {
        this.freetextWordCloudSemanticAnalysisPending.set(false);
        this.freetextWordCloudSemanticPendingStartedAt = 0;
        this.clearFreetextWordCloudSemanticWaitHint();
      }
    }
  }

  private buildQaWordCloudLemmaAnalysisRequest(): AnalyzeWordCloudInput | null {
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
      mode: 'LEXICAL',
      locale,
      metric: this.qaSortMode(),
      normalization: 'LEMMA',
      items,
      maxEntries: WORD_CLOUD_LEMMA_MAX_ENTRIES,
    };
  }

  private clearQaWordCloudLemmaSmoothing(): void {
    this.qaWordCloudLemmaAnalysisRunId += 1;
    this.qaWordCloudLemmaPending.set(false);
    this.qaWordCloudLemmaResult.set(null);
    this.qaWordCloudLemmaSnapshotKey.set(null);
    this.qaWordCloudLemmaFallbackReason.set(null);
  }

  private async requestQaWordCloudLemmaSmoothing(): Promise<void> {
    if (
      this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC' &&
      !this.qaWordCloudSemanticPhraseFallback()
    ) {
      return;
    }

    const request = this.buildQaWordCloudLemmaAnalysisRequest();
    const fingerprint = this.qaWordCloudLemmaFingerprint();
    if (!request || !fingerprint) {
      return;
    }

    const runId = ++this.qaWordCloudLemmaAnalysisRunId;
    this.qaWordCloudLemmaPending.set(true);

    try {
      await this.waitForQaWordCloudThemeAnalysisIdle();
      if (runId !== this.qaWordCloudLemmaAnalysisRunId) {
        return;
      }

      const latestRequest = this.buildQaWordCloudLemmaAnalysisRequest();
      const latestFingerprint = this.qaWordCloudLemmaFingerprint();
      if (!latestRequest || !latestFingerprint) {
        return;
      }

      const result = await this.analyzeCanonicalQaWordCloud(latestRequest);
      if (runId !== this.qaWordCloudLemmaAnalysisRunId) {
        return;
      }

      if (result.normalizationApplied === 'LEMMA') {
        this.qaWordCloudLemmaResult.set(result);
        this.qaWordCloudCoverage.set({
          analyzedQuestionCount: result.analyzedQuestionCount,
          eligibleQuestionCount: result.eligibleQuestionCount,
        });
        this.qaWordCloudLemmaSnapshotKey.set(latestFingerprint);
        this.qaWordCloudLemmaFallbackReason.set(null);
        return;
      }

      this.qaWordCloudLemmaResult.set(null);
      this.qaWordCloudLemmaSnapshotKey.set(null);
      this.qaWordCloudLemmaFallbackReason.set(
        result.normalizationFallbackReason ?? 'SIDECAR_UNAVAILABLE',
      );
    } catch {
      if (runId !== this.qaWordCloudLemmaAnalysisRunId) {
        return;
      }

      this.qaWordCloudLemmaResult.set(null);
      this.qaWordCloudLemmaSnapshotKey.set(null);
      this.qaWordCloudLemmaFallbackReason.set('TIMEOUT');
    } finally {
      if (runId === this.qaWordCloudLemmaAnalysisRunId) {
        this.qaWordCloudLemmaPending.set(false);
      }
    }
  }

  private async waitForQaWordCloudThemeAnalysisIdle(): Promise<void> {
    if (this.qaWordCloudEffectiveAnalysisVariant() === 'SEMANTIC') {
      return;
    }

    while (this.qaWordCloudThemeAnalysisTimer || this.qaWordCloudThemeAnalysisPending()) {
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });
    }
  }

  private analyzeCanonicalQaWordCloud(request: AnalyzeWordCloudInput) {
    const {
      items: _clientPage,
      channel: _channel,
      corpusRevision: _revision,
      ...canonical
    } = request;
    const work = () => this.mutateQaWordCloudAnalysis(canonical);
    const run = this.qaWordCloudAnalyzeTail.then(work, work);
    this.qaWordCloudAnalyzeTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async mutateQaWordCloudAnalysis(
    canonical: Omit<AnalyzeWordCloudInput, 'items' | 'channel' | 'corpusRevision'>,
  ) {
    const input = {
      ...canonical,
      filter: this.qaShowPinnedOnly() ? ('PINNED_ONLY' as const) : ('ALL_ELIGIBLE' as const),
    };
    let lastError: unknown;
    for (let attempt = 0; attempt <= QA_WORD_CLOUD_ANALYZE_CONFLICT_RETRIES; attempt += 1) {
      try {
        return await trpc.wordCloud.analyzeQa.mutate(input);
      } catch (error) {
        lastError = error;
        if (
          !this.isTrpcConflictError(error) ||
          attempt === QA_WORD_CLOUD_ANALYZE_CONFLICT_RETRIES
        ) {
          throw error;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, QA_WORD_CLOUD_ANALYZE_CONFLICT_RETRY_MS * (attempt + 1));
        });
      }
    }
    throw lastError;
  }

  private buildFreetextWordCloudLemmaItems(): Array<{
    id: string;
    text: string;
    weight: number;
  }> {
    return this.displayedFreetextResponses()
      .map((response) => response.trim())
      .filter((response) => response.length > 0)
      .map((text, index) => ({
        id: `response-${index}`,
        text,
        weight: 1,
      }));
  }

  private buildFreetextWordCloudLemmaAnalysisRequest(): AnalyzeWordCloudInput | null {
    const locale = this.qaWordCloudAnalysisLocale();
    if (!locale) {
      return null;
    }

    const items = this.buildFreetextWordCloudLemmaItems();
    if (items.length === 0) {
      return null;
    }

    return {
      sessionCode: this.code.toUpperCase(),
      mode: 'LEXICAL',
      locale,
      metric: 'TOP',
      normalization: 'LEMMA',
      items,
      maxEntries: WORD_CLOUD_LEMMA_MAX_ENTRIES,
      maxNgramLength: freetextLemmaMaxNgramLength(this.freetextWordCloudMode()),
    };
  }

  private clearFreetextWordCloudLemmaSmoothing(): void {
    this.freetextWordCloudLemmaAnalysisRunId += 1;
    this.freetextWordCloudLemmaPending.set(false);
    this.freetextWordCloudLemmaResult.set(null);
    this.freetextWordCloudLemmaSnapshotKey.set(null);
    this.freetextWordCloudLemmaFallbackReason.set(null);
  }

  private async requestFreetextWordCloudLemmaSmoothing(): Promise<void> {
    const request = this.buildFreetextWordCloudLemmaAnalysisRequest();
    const fingerprint = this.freetextWordCloudLemmaFingerprint();
    if (!request || !fingerprint) {
      return;
    }

    const runId = ++this.freetextWordCloudLemmaAnalysisRunId;
    this.freetextWordCloudLemmaPending.set(true);

    try {
      const result = await trpc.wordCloud.analyze.mutate(request);
      if (runId !== this.freetextWordCloudLemmaAnalysisRunId) {
        return;
      }

      if (result.normalizationApplied === 'LEMMA') {
        this.freetextWordCloudLemmaResult.set(result);
        this.freetextWordCloudLemmaSnapshotKey.set(fingerprint);
        this.freetextWordCloudLemmaFallbackReason.set(null);
        return;
      }

      this.freetextWordCloudLemmaResult.set(null);
      this.freetextWordCloudLemmaSnapshotKey.set(null);
      this.freetextWordCloudLemmaFallbackReason.set(
        result.normalizationFallbackReason ?? 'SIDECAR_UNAVAILABLE',
      );
    } catch {
      if (runId !== this.freetextWordCloudLemmaAnalysisRunId) {
        return;
      }

      this.freetextWordCloudLemmaResult.set(null);
      this.freetextWordCloudLemmaSnapshotKey.set(null);
      this.freetextWordCloudLemmaFallbackReason.set('TIMEOUT');
    } finally {
      if (runId === this.freetextWordCloudLemmaAnalysisRunId) {
        this.freetextWordCloudLemmaPending.set(false);
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
    if (!this.qaHostWritesAllowed()) return;
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
    if (!this.code || !this.qaHostWritesAllowed()) {
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
    if (this.controlPending() || !this.code || this.personalTimerBlocksReveal()) return;
    const forceClosePersonalTimers = this.canForceClosePersonalTimers();
    if (forceClosePersonalTimers && !(await this.confirmForceClosePersonalTimers('reveal'))) {
      return;
    }
    this.controlPending.set(true);
    try {
      this.clearEmojiNewBadge();
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.revealResults.mutate({
        code: this.code.toUpperCase(),
        ...(forceClosePersonalTimers ? { forceClosePersonalTimers: true } : {}),
      });
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
    if (this.controlPending() || !this.code || this.personalTimerBlocksReveal()) return;
    const forceClosePersonalTimers = this.canForceClosePersonalTimers();
    if (forceClosePersonalTimers && !(await this.confirmForceClosePersonalTimers('discussion'))) {
      return;
    }
    this.controlPending.set(true);
    try {
      this.clearEmojiNewBadge();
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.startDiscussion.mutate({
        code: this.code.toUpperCase(),
        ...(forceClosePersonalTimers ? { forceClosePersonalTimers: true } : {}),
      });
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

  private async confirmForceClosePersonalTimers(intent: 'reveal' | 'discussion'): Promise<boolean> {
    const blockingCount = this.blockingTimerAccommodationCount();
    const consequences =
      blockingCount === 1
        ? [
            $localize`:@@sessionHost.forceClosePersonalTimersConsequenceOne:Die offene persönliche 10×-Frist dieser Person endet sofort.`,
            $localize`:@@sessionHost.forceClosePersonalTimersConsequenceNoFurtherInput:Danach ist keine weitere Antwort mehr möglich.`,
          ]
        : [
            $localize`:@@sessionHost.forceClosePersonalTimersConsequenceMany:${formatLocaleCount(blockingCount, this.localeId)}:count: offene persönliche 10×-Fristen enden sofort.`,
            $localize`:@@sessionHost.forceClosePersonalTimersConsequenceNoFurtherInput:Danach ist keine weitere Antwort mehr möglich.`,
          ];
    const dialogRef = this.dialog.open(ConfirmLeaveDialogComponent, {
      data: {
        title: $localize`:@@sessionHost.forceClosePersonalTimersTitle:Persönliche Fristen beenden?`,
        message:
          intent === 'discussion'
            ? $localize`:@@sessionHost.forceClosePersonalTimersMessageDiscussion:Du startest die Diskussionsphase, obwohl noch persönliche Timer laufen.`
            : $localize`:@@sessionHost.forceClosePersonalTimersMessageReveal:Du zeigst das Ergebnis, obwohl noch persönliche Timer laufen.`,
        consequences,
        confirmLabel: $localize`:@@sessionHost.forceClosePersonalTimersConfirm:Trotzdem freigeben`,
        cancelLabel: $localize`:@@sessionHost.forceClosePersonalTimersCancel:Weiter warten`,
      } satisfies ConfirmLeaveDialogData,
      width: 'min(26rem, calc(100vw - 1.5rem))',
      maxWidth: '100vw',
      autoFocus: 'dialog',
    });
    return (await firstValueFrom(dialogRef.afterClosed())) === true;
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
      const entries = await trpc.session.getLeaderboard.query({
        code: this.code.toUpperCase(),
        anonymousClientId: getAnonymousClientId(),
      });
      this.leaderboard.set(entries);
      const teamEntries = await trpc.session.getTeamLeaderboard.query({
        code: this.code.toUpperCase(),
        anonymousClientId: getAnonymousClientId(),
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
        anonymousClientId: getAnonymousClientId(),
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
        anonymousClientId: getAnonymousClientId(),
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
        $localize`:@@sessionHost.exportQuestionsHeader:Frage Nr.;Fragentext;Typ;Teilnehmende;Aggregationsrunde;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Hinweis;Fragil;Erkannte Wissenslücke;Unentschieden;Häufigste selbstsicher falsche Antwort;Details`,
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
          $localize`:@@sessionHost.exportConfidenceSummaryHeader:Gültige Antworten;Ausgewertete Fragen;Nicht aggregiert (<5 Antworten mit Selbsteinschätzung);Gefestigt;Fehlkonzept-Hinweis;Fragil;Erkannte Wissenslücke;Unentschieden`,
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

  exportPdfButtonAria(): string {
    const count = this.finishedConfidenceSummary()?.priorityQuestionCount ?? 0;
    if (count === 1) {
      return $localize`:@@sessionHost.exportPdfButtonAriaWithPriorityOne:Nachbesprechungsplan als PDF ansehen – 1 Frage zur Nachbesprechung`;
    }
    if (count > 1) {
      return $localize`:@@sessionHost.exportPdfButtonAriaWithPriorityMany:Nachbesprechungsplan als PDF ansehen – ${count}:count: Fragen zur Nachbesprechung`;
    }
    return $localize`:@@sessionHost.exportPdfButtonAria:Nachbesprechungsplan als PDF ansehen`;
  }

  exportPdfPriorityHint(count: number): string {
    if (count === 1) {
      return $localize`:@@sessionHost.exportPdfPriorityHintSingular:1 Frage zur Nachbesprechung empfohlen`;
    }
    return $localize`:@@sessionHost.exportPdfPriorityHintPlural:${count}:count: Fragen zur Nachbesprechung empfohlen`;
  }

  async exportSessionResultsPdf(profile: SessionResultsPdfProfile = 'visual'): Promise<void> {
    if (!this.code || this.exportExporting()) return;
    this.exportStatus.set(null);
    this.exportExporting.set(true);
    try {
      const result = await this.sessionResultsExport.exportPdfFromSessionCode(this.code, {
        profile,
        onLargeReportHint: (questionCount) => {
          this.exportStatus.set(
            $localize`:@@sessionHost.exportPdfGeneratingLarge:PDF wird erstellt (${questionCount} Fragen)…`,
          );
        },
      });
      this.exportStatus.set(
        result === 'pdf-download'
          ? $localize`:@@sessionHost.exportPdfDownloadDone:Ergebnis-PDF heruntergeladen.`
          : $localize`:@@sessionHost.exportPdfPrintDone:Ergebnis-PDF zum Speichern geöffnet.`,
      );
      this.dismissHostSteeringCallout();
    } catch {
      this.openHostSteeringCalloutForExportFailure(
        () => void this.exportSessionResultsPdf(profile),
      );
    } finally {
      this.exportExporting.set(false);
    }
  }

  async exportQaQuestionsCsv(): Promise<void> {
    if (!this.code || this.exportExporting()) {
      return;
    }

    this.exportStatus.set(null);
    this.exportExporting.set(true);

    try {
      const questions = await this.loadAllQaQuestionsForExport();
      if (questions.length === 0) {
        this.exportStatus.set($localize`:@@sessionQa.exportEmpty:Keine Fragen zum Exportieren.`);
        return;
      }

      const rows: string[] = [
        $localize`:@@sessionQa.exportHeader:Nr.;Frage-ID;Status;Statusbezeichnung;Autor;Team;Frage;Score;Positive Stimmen;Negative Stimmen;Stimmen gesamt;Wilson-Score;Kontroverse-Score;Umstritten;Hervorgehoben;Erstellt am`,
      ];

      for (const [index, question] of questions.entries()) {
        rows.push(
          [
            index + 1,
            question.id,
            question.status,
            escapeCsv(this.qaStatusLabel(question.status)),
            escapeCsv(question.authorNickname ?? ''),
            escapeCsv(question.authorTeamName ?? ''),
            escapeCsv(stripMarkdownToPlainText(question.text)),
            this.qaQuestionScore(question),
            question.positiveVoteCount ?? '',
            question.negativeVoteCount ?? '',
            question.voteCount ?? '',
            this.formatQaExportMetric(question.bestScore),
            this.formatQaExportMetric(question.controversyScore),
            question.isControversial === undefined ? '' : String(question.isControversial),
            String(this.isQaQuestionHighlighted(question.id)),
            question.createdAt,
          ].join(';'),
        );
      }

      this.downloadCsvExport(rows, buildQaQuestionsCsvFilename(this.code.toUpperCase()));
      this.exportStatus.set($localize`:@@sessionQa.exportDone:Q&A-CSV exportiert.`);
      this.dismissHostSteeringCallout();
    } catch (error) {
      if (this.isTrpcConflictError(error)) {
        this.exportStatus.set(
          $localize`:@@sessionQa.exportConflict:Der Export wurde abgebrochen, weil sich die Fragenwand während des Abrufs geändert hat. Bitte erneut versuchen.`,
        );
        this.openHostSteeringCalloutForExportConflict(() => void this.exportQaQuestionsCsv());
      } else {
        this.openHostSteeringCalloutForExportFailure(() => void this.exportQaQuestionsCsv());
      }
    } finally {
      this.exportExporting.set(false);
    }
  }

  private async loadAllQaQuestionsForExport(): Promise<QaQuestionDTO[]> {
    const sessionId = this.session()?.id;
    if (!sessionId) {
      return [];
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.loadAllQaQuestionsForExportSnapshot(sessionId);
      } catch (error) {
        lastError = error;
        if (!this.isTrpcConflictError(error)) {
          throw error;
        }
      }
    }
    throw lastError;
  }

  private async loadAllQaQuestionsForExportSnapshot(sessionId: string): Promise<QaQuestionDTO[]> {
    const questions: QaQuestionDTO[] = [];
    let cursor: string | undefined;
    const statuses: Array<QaQuestionDTO['status']> = [
      'PENDING',
      'ACTIVE',
      'PINNED',
      'ARCHIVED',
      'DELETED',
    ];

    for (let page = 0; page < 250; page += 1) {
      const snapshot = await trpc.qa.list.query({
        sessionId,
        moderatorView: true,
        sort: 'TIME',
        pageSize: 100,
        statuses,
        ...(cursor ? { cursor } : {}),
      });
      const pageQuestions = Array.isArray(snapshot) ? snapshot : snapshot.questions;
      questions.push(...pageQuestions);
      const nextCursor = Array.isArray(snapshot) ? null : (snapshot.nextCursor ?? null);
      if (!nextCursor) {
        break;
      }
      cursor = nextCursor;
    }

    return questions;
  }

  private isTrpcConflictError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    if ('data' in error && error.data && typeof error.data === 'object' && 'code' in error.data) {
      return error.data.code === 'CONFLICT';
    }
    return 'code' in error && error.code === 'CONFLICT';
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
    } catch (error: unknown) {
      if (this.consumeHostUnauthorized(error)) {
        return;
      }
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
