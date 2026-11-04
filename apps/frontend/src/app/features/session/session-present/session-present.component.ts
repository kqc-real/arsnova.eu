import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DecimalPipe, DOCUMENT, formatNumber, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  viewChild,
  LOCALE_ID,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  isDevMode,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { selectFreetextLemmaDisplayEntries } from '../session-host/qa-word-cloud-theme-merge';
import { WordCloudComponent } from './word-cloud.component';
import { SessionProjectionQuizComponent } from './session-projection-quiz.component';
import type { Unsubscribable } from '@trpc/server/observable';
import { HostDisplayModeService } from '../../../core/host-display-mode.service';
import {
  getDocumentFullscreenElement,
  isDocumentFullscreenEnterAvailable,
  tryExitDocumentFullscreen,
  tryRequestDocumentFullscreen,
} from '../../../core/document-fullscreen.util';
import { remainingCountdownSeconds, stableCountdownDeadlineMs } from '../session-countdown.util';
import { scrollAppMainToTop } from '../session-auto-scroll.util';
import {
  localizeKnownServerError,
  sessionNotFoundUiMessage,
} from '../../../core/localize-known-server-message';
import { trpc } from '../../../core/trpc.client';
import { getAnonymousClientId } from '../../../core/anonymous-client-id';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import {
  feedbackDisplayIcon,
  feedbackDisplayLabel,
  feedbackResultOrder,
  feedbackTitle,
} from '../../feedback/feedback.config';
import {
  EMOJI_REACTIONS,
  WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH,
  WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH,
  isWordCloudLemmaLocale,
  isWordCloudPhraseAnalysisVariant,
} from '@arsnova/shared-types';
import type {
  AnalyzeWordCloudInput,
  HostCurrentQuestionDTO,
  HostVoteProgressDTO,
  LeaderboardEntryDTO,
  ReadingReadyStatusDTO,
  SessionStatusUpdate,
  QaQuestionDTO,
  QaQuestionSortMode,
  QaQuestionsListDTO,
  FreetextWordCloudPresenterProjectionDTO,
  QaWordCloudPresenterProjectionDTO,
  QuickFeedbackResult,
  SessionInfoDTO,
  TeamLeaderboardEntryDTO,
  WordCloudAnalysisEntryDTO,
  WordCloudAnalysisLocale,
  WordCloudAnalysisVariant,
  WordCloudNormalizationFallbackReason,
  WordCloudWeightMetric,
} from '@arsnova/shared-types';
import { recordServerTimeSample } from '../session-server-clock';
import {
  enrichDeadlineSnapshot,
  SessionDeadlineController,
  type SessionDeadlineSnapshot,
} from '../session-deadline';
import { readSessionCodeFromActivatedRoute } from '../session-route-code';
import { localizePath, resolveLocalizedJoinUrl } from '../../../core/locale-router';
import { formatLocaleCount, formatLocalePercent } from '../../../core/locale-number.util';
import {
  getEffectiveLocale,
  localeIdToSupported,
  type SupportedLocale,
} from '../../../core/locale-from-path';
import { stripMarkdownToPlainText } from '../../../core/markdown-plain-text.util';
import { presenterQuestionHeading } from './session-projection-quiz.util';
import { returnToHostWindow } from './presenter-window.util';
import {
  presenterCanOpenFollowingQuestion,
  presenterOfferDiscussion,
  presenterQuestionMatchesSession,
  presenterTimerBlocksReveal,
} from './presenter-quiz-controls.util';
import { MarkdownImageLightboxDirective } from '../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { ThemePresetService } from '../../../core/theme-preset.service';
import {
  findKindergartenNicknameBadge,
  findKindergartenNicknameEmoji,
  type KindergartenNicknameBadge,
} from '../../join/kindergarten-nickname-icons';
import { extractEdgeEmoji, stripEdgeEmojiMarker } from '../../../shared/emoji-shortcode.util';
import {
  FoyerEntranceLayerComponent,
  type FoyerEntranceChip,
} from '../session-host/foyer-entrance-layer.component';
import { buildFoyerChipLabel } from '../session-host/foyer-chip-label.util';
import {
  lobbyAudienceIsCrowd,
  lobbyAudienceIsPacked,
  lobbyFitColumnCount,
} from './lobby-audience-density.util';
import { getQaWordCloudQuestionWeight } from './word-cloud-weight.util';
import {
  WordCloudTermExtractorService,
  type WordCloudTerm,
  type WordCloudTermDocument,
} from './word-cloud-term.service';

type LobbyParticipant = {
  id: string;
  nickname: string;
  teamId: string | null;
};

type LobbyTeam = {
  id: string;
  name: string;
  color: string | null;
  memberCount: number;
};

type PackedLobbyIdentity = {
  icon: 'school' | 'military_tech' | 'theater_comedy';
  number: string;
  theme: 'middle-school' | 'high-school' | 'nobel' | 'anonymous';
  accessibleLabel: string;
  title: string;
};

type PresenterEmojiReactions = {
  reactions: Record<string, number>;
  total: number;
};

const LOBBY_FOYER_LANE_COUNT = 3;
const LOBBY_FOYER_MAX_ACTIVE_CHIPS = 6;
const LOBBY_FOYER_CHIP_LIFETIME_MS = 1100;
const LOBBY_FOYER_CHIP_DEV_LIFETIME_MS = 3500;
const LOBBY_FOYER_TEAM_DELAY_STEP_MS = 720;
const LOBBY_FOYER_TEAM_PRESENTATION_BUFFER_MS = 440;
const LOBBY_FOYER_NON_TEAM_DELAY_STEP_MS = 920;
const LOBBY_FOYER_NON_TEAM_PRESENTATION_BUFFER_MS = 240;
const LOBBY_FOYER_KINDERGARTEN_DELAY_STEP_MS = 5400;
const TEAM_FOYER_SUPPRESSION_PARTICIPANT_THRESHOLD = 100;
const TEAM_FOYER_SUPPRESSION_BURST_THRESHOLD = 24;
const LOBBY_FOYER_LANDED_BADGE_MS = 420;

type LobbyFoyerMotionProfile = {
  stepMs: number;
  enterDurationMs: number;
  presenceMs: number;
  settleDelayMs: number;
  badgeDelayMs: number;
  badgePresenceMs: number;
  pulseDelayMs: number;
};

type PresenterFreetextWordCloudMode = 'WORDS' | 'PHRASES' | 'SEMANTIC';

function presenterFreetextLemmaSnapshotMaxNgramLength(snapshotKey: string | null): number | null {
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

/**
 * Beamer-Ansicht / Presenter-Mode (Epic 2).
 * Story 2.5, 2.6, 3.5, 4.1, 4.4, 4.5, 1.14, 7.1, 8.2, 8.3.
 */
@Component({
  selector: 'app-session-present',
  standalone: true,
  imports: [
    DecimalPipe,
    CdkTrapFocus,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatRadioButton,
    MatRadioGroup,
    MatCard,
    MatCardContent,
    MatIcon,
    NgTemplateOutlet,
    RouterLink,
    WordCloudComponent,
    SessionProjectionQuizComponent,
    MarkdownImageLightboxDirective,
    FoyerEntranceLayerComponent,
  ],
  templateUrl: './session-present.component.html',
  styleUrl: './session-present.component.scss',
})
export class SessionPresentComponent implements OnInit, OnDestroy {
  private static readonly META_POLL_MS = 10_000;
  private static readonly LIVE_POLL_MS = 2_000;
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly localeId = inject(LOCALE_ID);
  private readonly wordCloudTermExtractor = inject(WordCloudTermExtractorService);
  private readonly themePreset = inject(ThemePresetService);
  private readonly hostDisplayMode = inject(HostDisplayModeService);
  private readonly document = inject(DOCUMENT);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private previousPresentStatusForScroll: string | null = null;
  private metaPollTimer: ReturnType<typeof setInterval> | null = null;
  private livePollTimer: ReturnType<typeof setInterval> | null = null;
  private boardPageTimer: ReturnType<typeof setInterval> | null = null;
  private lobbyFoyerSequence = 0;
  private lobbyFoyerLaneCursor = 0;
  private lobbyAudienceBaselineReady = false;
  private readonly knownLobbyParticipantIds = new Set<string>();
  private readonly lobbyFoyerTeamLaneCursors = new Map<string, number>();
  private readonly lobbyFoyerTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly hiddenLobbyParticipantTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly landedLobbyParticipantTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly foyerChipLifetimeMs = isDevMode()
    ? LOBBY_FOYER_CHIP_DEV_LIFETIME_MS
    : LOBBY_FOYER_CHIP_LIFETIME_MS;
  private readonly code = readSessionCodeFromActivatedRoute(this.route);
  private readonly sessionDeadline = new SessionDeadlineController();
  private sessionDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private presentDeadlineClosed = false;
  private readonly onVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.stopPolling();
      this.stopBoardPageTimer();
      return;
    }
    if (this.sessionDeadline.isAbsoluteDeadlineReached()) {
      this.closePresentAtDeadline();
    }
    this.startPolling();
    void this.refreshSessionMeta();
    void this.refreshPresenterLiveData();
  };
  private readonly onFullscreenChange = () => this.syncFullscreenAction();
  readonly localizedPath = localizePath;

  /** Verbindlicher Vollbild-Einstieg statt einer versteckten Browserfunktion. */
  readonly showFullscreenAction = signal(false);

  readonly session = signal<SessionInfoDTO | null>(null);
  readonly personalLeaderboard = signal<LeaderboardEntryDTO[]>([]);
  private readonly personalBoardPageIndex = signal(0);
  readonly teamLeaderboard = signal<TeamLeaderboardEntryDTO[]>([]);
  private readonly teamBoardPageIndex = signal(0);
  /** Handblättern hält den automatischen Wechsel an, bis er wieder gestartet wird. */
  readonly boardPagePaused = signal(false);
  /**
   * Presenter-Bühne: sortierte ACTIVE+PINNED-Liste (`qa.presentProjection`).
   * `presenterPage.index` wählt die prominente Frage; alle folgenden Beiträge
   * stehen darunter und die Bühne scrollt.
   */
  readonly presenterQaOrderedQuestions = signal<QaQuestionDTO[]>([]);
  readonly presenterQaSortModes = ['CONTROVERSIAL', 'BEST', 'TOP', 'TIME'] as const;
  readonly presenterQaSortMode = signal<QaQuestionSortMode>('BEST');
  readonly qaSortPending = signal(false);
  readonly qaSortError = signal('');
  readonly quickFeedbackResult = signal<QuickFeedbackResult | null>(null);
  readonly freetextResponses = signal<string[]>([]);
  readonly freetextQuestionId = signal<string | null>(null);
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly hostQuestion = signal<HostCurrentQuestionDTO | null>(null);
  readonly hostVoteProgress = signal<HostVoteProgressDTO | null>(null);
  /** Frischer Hörsaalstand für Bereitschaft und »alle haben abgestimmt«. */
  readonly quizAudience = signal<{
    participantCount: number;
    readingReady: ReadingReadyStatusDTO | null;
  } | null>(null);
  readonly quizControlPending = signal(false);
  readonly quizControlError = signal('');
  /** Der letzte Fragenabruf ist fehlgeschlagen, solange der passende Snapshot fehlt. */
  readonly quizQuestionLoadFailed = signal(false);
  readonly returnToHostError = signal('');
  private readonly quizPageNavHeldContext = signal<string | null>(null);
  readonly emojiReactions = signal<PresenterEmojiReactions | null>(null);
  readonly emojiOrder = EMOJI_REACTIONS;
  private emojiReactionScope: string | null = null;
  readonly joinQrDataUrl = signal('');
  readonly countdownSeconds = signal<number | null>(null);
  private currentQuestionSub: Unsubscribable | null = null;
  private voteProgressSub: Unsubscribable | null = null;
  private statusSub: Unsubscribable | null = null;
  private presentSessionMetaRefreshEpoch = 0;
  private presentHostQuestionRefreshEpoch = 0;
  private presentQuickFeedbackRefreshEpoch = 0;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private countdownDeadlineMs: number | null = null;
  private countdownKey: string | null = null;
  readonly joinUrl = resolveLocalizedJoinUrl(this.code);
  readonly sessionCode = this.code;
  readonly showHomeCta = signal(false);
  private readonly snapshotRefreshFailed = signal(false);
  readonly connectionDegraded = this.snapshotRefreshFailed.asReadonly();
  readonly connectionStatusMessage = computed(() =>
    this.session()
      ? $localize`:@@sessionPresent.refreshDelayedWithSnapshot:Aktualisierung verzögert. Der letzte Stand bleibt sichtbar.`
      : $localize`:@@sessionPresent.refreshDelayed:Daten konnten nicht aktualisiert werden. Neuer Versuch läuft …`,
  );
  readonly presenterInfo = signal($localize`Warte auf Live-Freitextdaten …`);
  readonly presenterFreetextActive = signal(false);
  readonly freetextWordCloudEyebrow = $localize`:@@sessionWordCloud.freetextEyebrow:Live-Freitext`;
  readonly freetextWordCloudStageTitle = computed(
    () => this.currentQuestionLabel() ?? $localize`:@@wordCloud.title:Wortwolke`,
  );
  readonly qaWordCloudEyebrow = $localize`:@@sessionWordCloud.qaEyebrow:Q&A-Analyse`;
  readonly qaWordCloudItemSingular = $localize`:@@sessionQa.wordCloudItemSingular:Frage`;
  readonly qaWordCloudItemPlural = $localize`:@@sessionQa.wordCloudItemPlural:Fragen`;
  readonly qaWordCloudEmptyMessage = $localize`:@@sessionQa.wordCloudEmpty:Noch keine sichtbaren Q&A-Fragen.`;
  readonly qaWordCloudProjection = signal<QaWordCloudPresenterProjectionDTO | null>(null);
  readonly quizPausedTitle = $localize`:@@sessionPresent.quizPausedTitle:Quiz pausiert`;
  readonly quizPausedMessage = $localize`:@@sessionPresent.quizPausedMessage:Gleich geht es mit derselben Frage weiter.`;
  readonly isPlayfulPreset = computed(() => this.themePreset.preset() === 'spielerisch');
  readonly lobbyParticipants = signal<LobbyParticipant[]>([]);
  readonly lobbyAudienceTotal = signal(0);
  readonly lobbyAudienceConnected = signal(0);
  readonly lobbyTeams = signal<LobbyTeam[]>([]);
  private readonly lobbyEntranceNumbers = computed(
    () =>
      new Map(
        this.lobbyParticipants().map(
          (participant, index, list) =>
            [participant.id, String(list.length - index).padStart(2, '0')] as const,
        ),
      ),
  );
  readonly lobbyFoyerChips = signal<FoyerEntranceChip[]>([]);
  readonly hiddenFoyerParticipantIds = signal<Set<string>>(new Set());
  readonly landedLobbyParticipantIds = signal<Set<string>>(new Set());
  readonly hiddenLobbyParticipantIds = computed(() => {
    if (!this.canShowLobbyFoyer() || this.suppressLobbyTeamFoyer()) {
      return new Set<string>();
    }

    const hidden = new Set(this.hiddenFoyerParticipantIds());
    for (const chip of this.lobbyFoyerChips()) {
      if (chip.participantId) {
        hidden.add(chip.participantId);
      }
      chip.hiddenParticipantIds?.forEach((participantId) => hidden.add(participantId));
    }
    return hidden;
  });
  readonly lobbyTeamsView = computed(() => {
    const people = this.lobbyParticipants();
    const hideNames = this.session()?.anonymousMode === true;
    const hiddenIds = this.hiddenLobbyParticipantIds();
    return this.lobbyTeams().map((team) => {
      const members = hideNames
        ? []
        : people.filter((person) => person.teamId === team.id && !hiddenIds.has(person.id));
      const placeholderCount = Math.max(0, team.memberCount - members.length);
      return {
        ...team,
        members,
        placeholders: Array.from({ length: placeholderCount }, (_, index) => index),
      };
    });
  });
  readonly lobbyPeople = computed(() => {
    if (this.lobbyTeams().length > 0) {
      return [];
    }
    const hiddenIds = this.hiddenLobbyParticipantIds();
    return this.lobbyParticipants().filter((person) => !hiddenIds.has(person.id));
  });
  readonly lobbyParticipantCount = computed(() => {
    const listed = this.lobbyParticipants().length;
    const fromSummary = this.lobbyAudienceTotal();
    const fromSession = this.session()?.participantCount ?? 0;
    const fromTeams = this.lobbyTeams().reduce((sum, team) => sum + team.memberCount, 0);
    return Math.max(listed, fromSummary, fromSession, fromTeams);
  });
  readonly isKindergartenLobby = computed(() => {
    const session = this.session();
    return session?.nicknameTheme === 'KINDERGARTEN' && session.anonymousMode !== true;
  });
  readonly canShowLobbyFoyer = computed(() => {
    const session = this.session();
    return (
      !!session &&
      this.showLobbyProjection() &&
      this.isPlayfulPreset() &&
      session.enableRewardEffects !== false
    );
  });
  readonly suppressLobbyTeamFoyer = computed(() => {
    if (this.session()?.teamMode !== true) {
      return false;
    }
    return this.lobbyParticipantCount() >= TEAM_FOYER_SUPPRESSION_PARTICIPANT_THRESHOLD;
  });
  readonly showLobbyFoyerOverlay = computed(
    () => this.canShowLobbyFoyer() && this.session()?.teamMode !== true,
  );
  readonly showLobbyTeamFoyer = computed(
    () =>
      this.canShowLobbyFoyer() &&
      this.session()?.teamMode === true &&
      !this.suppressLobbyTeamFoyer(),
  );
  readonly lobbyFoyerOverlayChips = computed(() =>
    this.lobbyFoyerChips().filter((chip) => !chip.teamId),
  );
  readonly lobbyFoyerChipsByTeam = computed(() => {
    const grouped = new Map<string, FoyerEntranceChip[]>();
    for (const chip of this.lobbyFoyerChips()) {
      if (!chip.teamId) {
        continue;
      }
      const entries = grouped.get(chip.teamId) ?? [];
      entries.push(chip);
      grouped.set(chip.teamId, entries);
    }
    return grouped;
  });
  readonly showPresentationEndedProjection = computed(
    () => this.session()?.presenterSurface === 'ended',
  );
  readonly showSecondaryPresentSurfaces = computed(
    () => !this.showPresentationEndedProjection() && !this.showFinishProjection(),
  );
  readonly showQuizPauseProjection = computed(
    () =>
      this.session()?.status === 'PAUSED' &&
      (this.session()?.pausedFromStatus === 'QUESTION_OPEN' ||
        this.session()?.pausedFromStatus === 'ACTIVE') &&
      this.session()?.preferredChannel === 'quiz' &&
      !this.showPresentationEndedProjection() &&
      !this.showFinishProjection(),
  );
  readonly preferredSecondaryChannel = computed<'qa' | 'quickFeedback' | null>(() => {
    if (!this.showSecondaryPresentSurfaces()) {
      return null;
    }
    const preferred = this.session()?.preferredChannel;
    return preferred === 'qa' || preferred === 'quickFeedback' ? preferred : null;
  });
  readonly preferredSecondaryChannelOpen = computed(() => {
    const preferred = this.preferredSecondaryChannel();
    if (!preferred) {
      return false;
    }
    return this.session()?.channels?.[preferred].open !== false;
  });
  /** Q&A-Projektion inkl. Wortwolke: auch bei geschlossenem Beitragskanal, solange Q&A aktiviert und bevorzugt ist. */
  readonly qaProjectionChannelReady = computed(() => {
    if (!this.showSecondaryPresentSurfaces()) {
      return false;
    }
    const session = this.session();
    if (session?.preferredChannel !== 'qa') {
      return false;
    }
    return session.channels?.qa.enabled === true || session.type === 'Q_AND_A';
  });
  readonly showQaProjection = computed(
    () =>
      this.qaProjectionChannelReady() &&
      this.preferredSecondaryChannelOpen() &&
      this.presenterQaWordCloudQuestions().length > 0 &&
      this.session()?.presenterSurface !== 'qaWordCloud',
  );
  readonly showPinnedQaQuestion = computed(
    () => this.showQaProjection() && this.pinnedQaQuestion() !== null,
  );
  readonly showQaQueue = computed(
    () => this.showQaProjection() && this.visibleQaQueueQuestions().length > 0,
  );
  /** Footer-Navigator: gleicher Bühnenindex wie der Host, direkt an der Projektion. */
  readonly qaNavPending = signal(false);
  readonly qaNavError = signal('');
  private readonly qaStage = viewChild<ElementRef<HTMLElement>>('qaStage');
  /** Eine Navigationsposition pro Bühnenfrage (Hero rückt vor). */
  readonly qaQueuePageCount = computed(() => {
    const total = this.presenterQaOrderedQuestions().length;
    return Math.max(1, total);
  });
  readonly qaQueuePageIndex = computed(() => {
    const pageCount = this.qaQueuePageCount();
    const index = this.session()?.presenterPage?.index ?? 0;
    return Math.max(0, Math.min(pageCount - 1, index));
  });
  /** Aktuelle Hero-Frage (nicht fest PINNED, sondern Cursor in der Bühnenliste). */
  readonly pinnedQaQuestion = computed(
    () => this.presenterQaOrderedQuestions()[this.qaQueuePageIndex()] ?? null,
  );
  /** Alle freigegebenen Fragen nach dem Hero; die Bühne scrollt darüber. */
  readonly presenterQaQuestions = computed(() =>
    this.presenterQaOrderedQuestions().slice(this.qaQueuePageIndex() + 1),
  );
  readonly visibleQaQueueQuestions = computed(() => this.presenterQaQuestions());
  /** Verbleibende Warteschlange; der Footer-Navigator und der Host rücken den Hero vor. */
  qaQueueCountLabel(): string {
    const count = this.presenterQaQuestions().length;
    return count === 1
      ? $localize`:@@sessionPresent.qaQueueCountOne:1 Frage`
      : $localize`:@@sessionPresent.qaQueueCountMany:${this.formatCount(count)}:count: Fragen`;
  }
  qaQueueCountAriaLabel(): string {
    const count = this.presenterQaQuestions().length;
    return count === 1
      ? $localize`:@@sessionPresent.qaQueueCountAriaOne:1 Frage in der Warteschlange`
      : $localize`:@@sessionPresent.qaQueueCountAriaMany:${this.formatCount(count)}:count: Fragen in der Warteschlange`;
  }
  qaSortModeLabel(mode: QaQuestionSortMode = this.presenterQaSortMode()): string {
    switch (mode) {
      case 'TOP':
        return $localize`:@@sessionQa.sortTop:Stimmensaldo`;
      case 'BEST':
        return $localize`:@@sessionQa.sortBest:Beste Fragen`;
      case 'CONTROVERSIAL':
        return $localize`:@@sessionQa.sortControversial:Kontroverse`;
      case 'TIME':
        return $localize`:@@sessionQa.sortTime:Zeit`;
    }
  }
  async setPresenterQaSortMode(mode: string): Promise<void> {
    if (
      (mode !== 'CONTROVERSIAL' && mode !== 'BEST' && mode !== 'TOP' && mode !== 'TIME') ||
      this.qaSortPending() ||
      this.qaNavPending() ||
      mode === this.presenterQaSortMode() ||
      !this.session()
    ) {
      return;
    }
    const previous = this.presenterQaSortMode();
    this.presenterQaSortMode.set(mode);
    this.qaSortPending.set(true);
    this.qaSortError.set('');
    try {
      await trpc.qa.setPresenterSortMode.mutate(
        {
          code: this.sessionCode,
          sortMode: mode,
          source: 'presenter',
        },
        { signal: AbortSignal.timeout(10000) },
      );
      if (this.destroyRef.destroyed) {
        return;
      }
      await this.refreshQaQuestions();
      if (this.destroyRef.destroyed) {
        return;
      }
      await this.resetQaProjectionToFirst();
    } catch {
      if (!this.destroyRef.destroyed) {
        this.presenterQaSortMode.set(previous);
        this.qaSortError.set(
          $localize`:@@sessionPresent.qaSortError:Sortierung konnte nicht gewechselt werden. Bitte erneut versuchen.`,
        );
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.qaSortPending.set(false);
      }
    }
  }

  /**
   * Neue Sortierung zeigt eine andere erste Frage. Navigator und Bühne starten wieder bei 1.
   * Schlägt nur der Index fehl, bleibt die bereits übernommene Sortierung stehen.
   */
  private async resetQaProjectionToFirst(): Promise<void> {
    const stage = this.qaStage()?.nativeElement;
    if (stage) {
      delete stage.dataset['qaNavIndex'];
      stage.scrollTop = 0;
    }
    const page = this.session()?.presenterPage;
    if (!page || this.qaQueuePageIndex() === 0) {
      return;
    }
    const count = Math.max(page.count, this.qaQueuePageCount());
    this.qaNavPending.set(true);
    this.qaNavError.set('');
    try {
      const result = await trpc.session.setPresenterSurface.mutate(
        {
          code: this.sessionCode,
          page: { context: page.context, index: 0, count },
        },
        { signal: AbortSignal.timeout(10000) },
      );
      if (this.destroyRef.destroyed) {
        return;
      }
      // Ein schon laufender Meta-Abruf darf den alten Index nicht wieder einsetzen.
      this.presentSessionMetaRefreshEpoch += 1;
      this.session.update((session) =>
        session?.presenterPage?.context === page.context
          ? { ...session, presenterPage: result.presenterPage }
          : session,
      );
    } catch {
      if (!this.destroyRef.destroyed) {
        this.qaNavError.set(
          $localize`:@@sessionHost.projectionQaPageError:Fragen konnten nicht gewechselt werden. Bitte erneut versuchen.`,
        );
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.qaNavPending.set(false);
      }
    }
  }

  /**
   * Dieselbe Bühnenposition wie der Host-Navigator, aus dem Presenter-Footer.
   * Index und Anzahl gehen zusammen raus, damit eine noch alte Seitenzahl den Schritt nicht abschneidet.
   */
  async changeQaProjectionPage(delta: -1 | 1): Promise<void> {
    const page = this.session()?.presenterPage;
    if (!page || this.qaNavPending() || this.qaSortPending() || !this.showQaProjection()) {
      return;
    }
    const count = this.qaQueuePageCount();
    const index = this.qaQueuePageIndex();
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= count) {
      return;
    }
    this.qaNavPending.set(true);
    this.qaNavError.set('');
    try {
      const result = await trpc.session.setPresenterSurface.mutate(
        {
          code: this.sessionCode,
          page: {
            context: page.context,
            index: nextIndex,
            count: Math.max(page.count, count, nextIndex + 1),
          },
        },
        { signal: AbortSignal.timeout(10000) },
      );
      if (this.destroyRef.destroyed) {
        return;
      }
      this.session.update((session) =>
        session?.presenterPage?.context === page.context
          ? { ...session, presenterPage: result.presenterPage }
          : session,
      );
    } catch {
      if (!this.destroyRef.destroyed) {
        this.qaNavError.set(
          $localize`:@@sessionHost.projectionQaPageError:Fragen konnten nicht gewechselt werden. Bitte erneut versuchen.`,
        );
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.qaNavPending.set(false);
      }
    }
  }

  returnToHost(): void {
    const view = this.document.defaultView;
    if (!view) {
      return;
    }
    this.returnToHostError.set('');
    const outcome = returnToHostWindow(view, this.sessionCode, {
      fullscreen: getDocumentFullscreenElement(this.document) !== null,
      exitFullscreen: () => tryExitDocumentFullscreen(this.document),
    });
    if (outcome === 'blocked' && !this.destroyRef.destroyed) {
      this.returnToHostError.set(
        $localize`:@@sessionPresent.returnToHostBlocked:Das Host-Fenster konnte nicht geöffnet werden. Erlaube Pop-up-Fenster für diese Seite und versuche es erneut.`,
      );
    }
  }

  async startPresenterQuiz(): Promise<void> {
    if (this.session()?.status !== 'LOBBY' || this.session()?.type === 'Q_AND_A') {
      return;
    }
    await this.runQuizAction(async () => {
      const result = await trpc.session.nextQuestion.mutate(
        { code: this.sessionCode },
        { signal: AbortSignal.timeout(10000) },
      );
      this.adoptPresenterStatus(result);
      void this.refreshHostQuestion();
    });
  }

  async revealPresenterAnswers(): Promise<void> {
    if (!this.presentedQuizQuestion()) {
      return;
    }
    await this.runQuizAction(async () => {
      const result = await trpc.session.revealAnswers.mutate(
        { code: this.sessionCode },
        { signal: AbortSignal.timeout(10000) },
      );
      this.adoptPresenterStatus(result);
      void this.refreshHostQuestion();
    });
  }

  async revealPresenterResults(): Promise<void> {
    if (!this.presentedQuizQuestion() || this.quizTimerBlocksReveal()) {
      return;
    }
    await this.runQuizAction(async () => {
      const result = await trpc.session.revealResults.mutate(
        { code: this.sessionCode },
        { signal: AbortSignal.timeout(10000) },
      );
      this.adoptPresenterStatus(result);
      void this.refreshHostQuestion();
    });
  }

  async startPresenterDiscussion(): Promise<void> {
    if (!this.presentedQuizQuestion() || this.quizTimerBlocksReveal()) {
      return;
    }
    await this.runQuizAction(async () => {
      const result = await trpc.session.startDiscussion.mutate(
        { code: this.sessionCode },
        { signal: AbortSignal.timeout(10000) },
      );
      this.adoptPresenterStatus(result);
      void this.refreshHostQuestion();
    });
  }

  async startPresenterSecondRound(): Promise<void> {
    if (!this.presentedQuizQuestion()) {
      return;
    }
    await this.runQuizAction(async () => {
      const result = await trpc.session.startSecondRound.mutate(
        { code: this.sessionCode },
        { signal: AbortSignal.timeout(10000) },
      );
      this.adoptPresenterStatus(result);
      void this.refreshHostQuestion();
    });
  }

  async advancePresenterQuiz(): Promise<void> {
    if (!this.presentedQuizQuestion()) {
      return;
    }
    const status = this.session()?.status;
    await this.runQuizAction(async () => {
      const result = await trpc.session.nextQuestion.mutate(
        {
          code: this.sessionCode,
          ...(status === 'RESULTS' || status === 'DISCUSSION'
            ? { skipCurrentResultQuestion: true }
            : {}),
        },
        { signal: AbortSignal.timeout(10000) },
      );
      this.adoptPresenterStatus(result);
      void this.refreshHostQuestion();
      if (result.status === 'FINISHED') {
        this.finishBoardsResolved.set(false);
        void this.loadPresenterLeaderboards().finally(() => {
          if (!this.destroyRef.destroyed) {
            this.finishBoardsResolved.set(true);
          }
        });
      }
    });
  }

  async pausePresenterQuiz(): Promise<void> {
    await this.runQuizAction(async () => {
      const result = await trpc.session.pauseQuiz.mutate(
        { code: this.sessionCode },
        { signal: AbortSignal.timeout(10000) },
      );
      this.adoptPresenterStatus(result);
      void this.refreshHostQuestion();
    });
  }

  async resumePresenterQuiz(): Promise<void> {
    await this.runQuizAction(async () => {
      const result = await trpc.session.resumeQuiz.mutate(
        { code: this.sessionCode },
        { signal: AbortSignal.timeout(10000) },
      );
      this.adoptPresenterStatus(result);
      void this.refreshHostQuestion();
    });
  }

  async retryPresenterQuestion(): Promise<void> {
    if (!this.quizQuestionAwaitingSnapshot()) {
      return;
    }
    const gate = this.focusedQuestionGate();
    this.quizQuestionLoadFailed.set(false);
    this.moveFocusFromQuestionGate(gate);
    await this.refreshHostQuestion();
  }

  async changeQuizProjectionPage(delta: -1 | 1): Promise<void> {
    const page = this.session()?.presenterPage;
    if (!page || this.quizControlPending() || !this.showQuizControlFooter()) {
      return;
    }
    const count = Math.max(1, page.count);
    const index = Math.max(0, Math.min(count - 1, page.index));
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= count) {
      return;
    }
    await this.runQuizAction(
      async () => {
        const result = await trpc.session.setPresenterSurface.mutate(
          {
            code: this.sessionCode,
            page: { context: page.context, index: nextIndex, count },
          },
          { signal: AbortSignal.timeout(10000) },
        );
        if (this.destroyRef.destroyed) {
          return;
        }
        this.session.update((session) =>
          session?.presenterPage?.context === page.context
            ? { ...session, presenterPage: result.presenterPage }
            : session,
        );
      },
      $localize`:@@sessionHost.projectionPageError:Seite konnte nicht gewechselt werden. Bitte erneut versuchen.`,
    );
  }

  private async runQuizAction(task: () => Promise<void>, errorMessage?: string): Promise<void> {
    if (this.quizControlPending() || this.destroyRef.destroyed) {
      return;
    }
    const trigger = this.quizActionTrigger();
    this.quizControlPending.set(true);
    this.quizControlError.set('');
    let succeeded = false;
    try {
      await task();
      succeeded = true;
    } catch {
      if (!this.destroyRef.destroyed) {
        this.quizControlError.set(
          errorMessage ??
            $localize`:@@sessionPresent.quizControlError:Die Aktion konnte nicht ausgeführt werden. Bitte erneut versuchen.`,
        );
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.quizControlPending.set(false);
      }
    }
    if (this.destroyRef.destroyed) {
      return;
    }
    if (succeeded) {
      this.scheduleQuizControlFocus(trigger);
      return;
    }
    if (trigger?.isConnected) {
      trigger.focus({ preventScroll: true });
    }
  }

  private quizActionTrigger(): HTMLElement | null {
    const active = this.document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return null;
    }
    return this.hostElement.nativeElement.contains(active) ? active : null;
  }

  /** Nach dem Phasenwechsel liegt der Fokus auf dem neuen Primärknopf, nicht auf dem entfernten. */
  private scheduleQuizControlFocus(trigger: HTMLElement | null): void {
    if (!trigger) {
      return;
    }
    afterNextRender(
      () => {
        if (this.destroyRef.destroyed || trigger.isConnected) {
          return;
        }
        this.quizPhaseFocusTarget()?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  /** Lade- oder Retry-Ansicht, solange sie selbst den Tastaturfokus hat. */
  private focusedQuestionGate(): HTMLElement | null {
    const active = this.document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return null;
    }
    if (!this.hostElement.nativeElement.contains(active)) {
      return null;
    }
    return active.matches(
      '[data-testid="presenter-quiz-question-pending"], [data-testid="presenter-quiz-question-retry"]',
    )
      ? active
      : null;
  }

  /**
   * Nach dem Auflösen der Ladeanzeige folgt der Fokus dem neuen Phasenknopf.
   * Ein inzwischen anders gesetzter Fokus bleibt liegen.
   */
  private moveFocusFromQuestionGate(gate: HTMLElement | null): void {
    if (!gate) {
      return;
    }
    afterNextRender(
      () => {
        if (this.destroyRef.destroyed || gate.isConnected) {
          return;
        }
        const active = this.document.activeElement;
        if (
          active instanceof HTMLElement &&
          active.isConnected &&
          this.hostElement.nativeElement.contains(active)
        ) {
          return;
        }
        this.quizPhaseFocusTarget()?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  private quizPhaseFocusTarget(): HTMLElement | null {
    const root = this.hostElement.nativeElement;
    const selectors = this.showFullscreenAction()
      ? ['[data-testid="presenter-return-to-host"]', '[data-testid="presenter-fullscreen-enter"]']
      : [
          '[data-testid="presenter-quiz-question-retry"]',
          '[data-testid="presenter-quiz-question-pending"]',
          '[data-testid="presenter-quiz-resume"]',
          '[data-testid="presenter-quiz-reveal-answers"]',
          '[data-testid="presenter-quiz-discussion"]',
          '[data-testid="presenter-quiz-second-round"]',
          '[data-testid="presenter-quiz-reveal-results"]',
          '[data-testid="presenter-quiz-next-question"]',
          '[data-testid="presenter-quiz-finish"]',
          '[data-testid="presenter-return-to-host"]',
          '[data-testid="presenter-surface"]',
        ];
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        continue;
      }
      if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
        continue;
      }
      return element;
    }
    return null;
  }

  private adoptPresenterStatus(update: SessionStatusUpdate): void {
    if (update.serverTime) {
      recordServerTimeSample(update.serverTime, Date.now());
    }
    if (update.serverNow) {
      recordServerTimeSample(update.serverNow, Date.now());
    }
    this.presentSessionMetaRefreshEpoch += 1;
    this.session.update((current) =>
      current
        ? {
            ...current,
            status: update.status,
            currentQuestion: update.currentQuestion,
            currentRound: update.currentRound ?? current.currentRound,
            pausedFromStatus: update.pausedFromStatus ?? current.pausedFromStatus,
            preferredChannel: update.preferredChannel ?? current.preferredChannel,
            presenterSurface: update.presenterSurface ?? current.presenterSurface,
            presenterPage: update.presenterPage ?? current.presenterPage,
            enableTimerAccommodation:
              update.enableTimerAccommodation ?? current.enableTimerAccommodation,
            finishProjection:
              update.status === 'FINISHED'
                ? (update.finishProjection ?? current.finishProjection ?? 'leaderboard')
                : current.finishProjection,
          }
        : current,
    );
    this.dropStalePresenterQuestion();
    this.syncCountdownFromStatus(update.timer, update.activeAt);
    this.resetPresentScrollForPhase(update.status);
  }

  /** Snapshot verwerfen, der nicht mehr zur Frage oder Runde der Session passt. */
  private dropStalePresenterQuestion(): void {
    const session = this.session();
    const shownQuestion = this.hostQuestion();
    if (
      shownQuestion &&
      !presenterQuestionMatchesSession(
        shownQuestion,
        session?.currentQuestion,
        session?.currentRound,
      )
    ) {
      this.hostQuestion.set(null);
      this.hostVoteProgress.set(null);
      this.quizQuestionLoadFailed.set(false);
      this.stopCountdown();
    }
  }

  qaPositiveVoteCount(question: QaQuestionDTO): number {
    return question.positiveVoteCount ?? 0;
  }
  qaNegativeVoteCount(question: QaQuestionDTO): number {
    return question.negativeVoteCount ?? 0;
  }
  qaVotesBreakdownAriaLabel(question: QaQuestionDTO): string {
    const up = this.formatCount(this.qaPositiveVoteCount(question));
    const down = this.formatCount(this.qaNegativeVoteCount(question));
    return $localize`:@@sessionQa.votesBreakdownAria:${up}:up: dafür, ${down}:down: dagegen`;
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

  formatQaCreatedAt(isoDate: string): string {
    return new Intl.DateTimeFormat(this.localeId, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoDate));
  }

  formatQaPercent(value: number | undefined): string {
    if (!Number.isFinite(value)) {
      return '0 %';
    }
    return `${formatNumber((value ?? 0) * 100, this.localeId, '1.0-0')} %`;
  }

  readonly showQaWordCloud = computed(() => {
    const session = this.session();
    if (!this.showSecondaryPresentSurfaces() || session?.presenterSurface !== 'qaWordCloud') {
      return false;
    }
    return session.channels?.qa.enabled === true || session.type === 'Q_AND_A';
  });
  readonly wordCloudTermLocale = computed<SupportedLocale>(() =>
    getEffectiveLocale(localeIdToSupported(this.localeId)),
  );
  readonly freetextWordCloudProjection = signal<FreetextWordCloudPresenterProjectionDTO | null>(
    null,
  );
  /** Gesetzte Presenter-Ansicht bleibt bestehen, auch wenn der Host danach neu projiziert. */
  readonly presenterFreetextWordCloudModeOverride = signal<PresenterFreetextWordCloudMode | null>(
    null,
  );
  readonly presenterFreetextWordCloudFrozen = signal(false);
  private readonly presenterFreetextFrozenResponses = signal<string[] | null>(null);
  readonly presenterFreetextLemmaPreferred = signal(false);
  readonly presenterFreetextLemmaPending = signal(false);
  readonly presenterFreetextLemmaEntries = signal<WordCloudAnalysisEntryDTO[] | null>(null);
  private readonly presenterFreetextLemmaApplied = signal(false);
  private readonly presenterFreetextLemmaAnalyzedKey = signal<string | null>(null);
  private readonly presenterFreetextLemmaFallbackReason = signal<
    WordCloudNormalizationFallbackReason | 'TIMEOUT' | null
  >(null);
  private readonly presenterFreetextFrozenAnalysis = signal<WordCloudAnalysisEntryDTO[] | null>(
    null,
  );
  readonly presenterFreetextSemanticPending = signal(false);
  readonly presenterFreetextSemanticEntries = signal<WordCloudAnalysisEntryDTO[] | null>(null);
  private readonly presenterFreetextSemanticAnalyzedKey = signal<string | null>(null);
  readonly presenterFreetextSemanticFailed = signal(false);
  private presenterFreetextAnalysisGeneration = 0;
  readonly presenterFreetextDisplayedResponses = computed(() =>
    this.presenterFreetextWordCloudFrozen()
      ? (this.presenterFreetextFrozenResponses() ?? this.freetextResponses())
      : this.freetextResponses(),
  );
  readonly presenterFreetextResponseKey = computed(() =>
    this.presenterFreetextDisplayedResponses().join('\u0000'),
  );
  readonly presenterFreetextWordCloudModeEffective = computed<PresenterFreetextWordCloudMode>(
    () => {
      const override = this.presenterFreetextWordCloudModeOverride();
      if (override) {
        return override;
      }
      switch (this.freetextWordCloudProjection()?.mode) {
        case 'LEXICAL':
          return 'WORDS';
        case 'SEMANTIC':
          return 'SEMANTIC';
        default:
          return 'PHRASES';
      }
    },
  );
  readonly presenterFreetextWordCloudDescription = computed(() => {
    switch (this.presenterFreetextWordCloudModeEffective()) {
      case 'SEMANTIC':
        return $localize`:@@sessionWordCloud.freetextDescriptionSemantic:Ähnliche Antworten sind gruppiert.`;
      case 'WORDS':
        return $localize`:@@sessionWordCloud.freetextDescription:Häufige Wörter aus den Antworten.`;
      default:
        return $localize`:@@sessionQa.wordCloudDescriptionPhrases:Häufige Wörter und kurze Wortgruppen.`;
    }
  });
  readonly presenterFreetextWordCloudWordLabelSingular = computed(() => {
    switch (this.presenterFreetextWordCloudModeEffective()) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudThemeSingular:Thema`;
      case 'PHRASES':
        return $localize`:@@sessionQa.wordCloudEntrySingular:Begriff`;
      default:
        return $localize`:@@wordCloud.wordSingular:Wort`;
    }
  });
  readonly presenterFreetextWordCloudWordLabelPlural = computed(() => {
    switch (this.presenterFreetextWordCloudModeEffective()) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudThemePlural:Themen`;
      case 'PHRASES':
        return $localize`:@@sessionQa.wordCloudEntryPlural:Begriffe`;
      default:
        return $localize`:@@wordCloud.wordPlural:Wörter`;
    }
  });
  readonly presenterFreetextWordCloudFreezeLabel = computed(() =>
    this.presenterFreetextWordCloudFrozen()
      ? $localize`:@@sessionHost.wordCloudResume:Live fortsetzen`
      : $localize`:@@sessionHost.wordCloudFreeze:Wortwolke einfrieren`,
  );
  readonly presenterFreetextShowSmoothing = computed(
    () => this.presenterFreetextWordCloudModeEffective() !== 'SEMANTIC',
  );
  readonly presenterFreetextLemmaFingerprint = computed(() => {
    const items = this.presenterFreetextAnalysisItems();
    if (items.length === 0) {
      return null;
    }
    const mode = this.presenterFreetextWordCloudModeEffective();
    return JSON.stringify({
      locale: this.presenterFreetextAnalysisLocale(),
      texts: items.map((item) => item.text),
      maxNgramLength:
        mode === 'WORDS' ? WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH : WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH,
    });
  });
  readonly presenterFreetextLemmaSnapshotVisible = computed(() => {
    const mode = this.presenterFreetextWordCloudModeEffective();
    if (
      mode === 'SEMANTIC' ||
      !this.presenterFreetextLemmaPreferred() ||
      !this.presenterFreetextLemmaApplied() ||
      !this.presenterFreetextLemmaEntries() ||
      this.presenterFreetextAnalysisItems().length === 0
    ) {
      return false;
    }
    if (mode === 'WORDS') {
      return true;
    }
    const snapshotNgram = presenterFreetextLemmaSnapshotMaxNgramLength(
      this.presenterFreetextLemmaAnalyzedKey(),
    );
    return snapshotNgram !== null && snapshotNgram > WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH;
  });
  readonly presenterFreetextLemmaDisplayEntries = computed(() => {
    if (!this.presenterFreetextLemmaSnapshotVisible()) {
      return null;
    }
    const entries = this.presenterFreetextLemmaEntries();
    if (!entries) {
      return null;
    }
    const mode = this.presenterFreetextWordCloudModeEffective();
    const visible = selectFreetextLemmaDisplayEntries(
      entries,
      mode === 'SEMANTIC' ? 'PHRASES' : mode,
      80,
    );
    return visible.length > 0 ? visible : null;
  });
  readonly presenterFreetextSmoothingStatus = computed(() => {
    if (this.presenterFreetextWordCloudModeEffective() === 'SEMANTIC') {
      return 'idle' as const;
    }
    if (this.presenterFreetextLemmaPending()) {
      return 'pending' as const;
    }
    if (this.presenterFreetextLemmaDisplayEntries()) {
      const analyzed = this.presenterFreetextLemmaAnalyzedKey();
      if (analyzed !== null && analyzed !== this.presenterFreetextLemmaFingerprint()) {
        return 'stale' as const;
      }
      return 'active' as const;
    }
    if (
      this.presenterFreetextLemmaPreferred() &&
      this.presenterFreetextLemmaApplied() &&
      this.presenterFreetextLemmaAnalyzedKey() !== this.presenterFreetextLemmaFingerprint()
    ) {
      return 'stale' as const;
    }
    return 'idle' as const;
  });
  readonly presenterFreetextSmoothingPressed = computed(() => {
    if (this.presenterFreetextWordCloudModeEffective() === 'SEMANTIC') {
      return false;
    }
    if (this.presenterFreetextWordCloudModeOverride() === null) {
      return this.freetextWordCloudProjection()?.smoothingActive === true;
    }
    const status = this.presenterFreetextSmoothingStatus();
    return status === 'active' || status === 'pending' || status === 'stale';
  });
  readonly presenterFreetextSmoothingDisabled = computed(() => {
    if (!this.presenterFreetextShowSmoothing() || this.presenterFreetextLemmaPending()) {
      return true;
    }
    if (!this.presenterFreetextAnalysisLocale()) {
      return true;
    }
    return this.presenterFreetextAnalysisItems().length === 0;
  });
  readonly presenterFreetextSmoothingLabel = computed(() => {
    switch (this.presenterFreetextSmoothingStatus()) {
      case 'pending':
        return $localize`:@@sessionQa.wordCloudSmoothPending:Analyse läuft`;
      case 'active':
        return $localize`:@@sessionQa.wordCloudSmoothActive:Wort-Glättung ist an`;
      case 'stale':
        return $localize`:@@sessionQa.wordCloudSmoothRetry:Neu analysieren`;
      default:
        return $localize`:@@sessionQa.wordCloudSmooth:Wortformen glätten`;
    }
  });
  readonly presenterFreetextSmoothingIcon = computed(() => {
    switch (this.presenterFreetextSmoothingStatus()) {
      case 'pending':
        return 'hourglass_top';
      case 'active':
        return 'check';
      case 'stale':
        return 'refresh';
      default:
        return 'wand_stars';
    }
  });
  readonly presenterFreetextShowThemeRefresh = computed(() => {
    if (
      this.presenterFreetextWordCloudModeEffective() !== 'SEMANTIC' ||
      this.presenterFreetextSemanticPending()
    ) {
      return false;
    }
    if (this.presenterFreetextSemanticFailed()) {
      return true;
    }
    const analyzed = this.presenterFreetextSemanticAnalyzedKey();
    return analyzed !== null && analyzed !== this.presenterFreetextResponseKey();
  });
  readonly presenterFreetextThemeRefreshLabel = $localize`:@@sessionQa.wordCloudRefreshThemes:Themen aktualisieren`;
  readonly presenterFreetextWordCloudHint = computed(() => {
    if (this.presenterFreetextSemanticPending()) {
      return $localize`:@@sessionQa.wordCloudSemanticPendingHint:Themen werden vorbereitet. Es gelten Wörter und Phrasen.`;
    }
    if (
      this.presenterFreetextWordCloudModeEffective() === 'SEMANTIC' &&
      this.presenterFreetextSemanticFailed()
    ) {
      return $localize`:@@sessionQa.wordCloudSemanticFailedHint:Themenanalyse fehlgeschlagen. Es gelten Wörter und Phrasen.`;
    }
    if (
      this.presenterFreetextShowSmoothing() &&
      !this.presenterFreetextAnalysisLocale() &&
      this.presenterFreetextAnalysisItems().length > 0
    ) {
      return $localize`:@@sessionQa.wordCloudSmoothChooseLocale:Wähle die Sprache der Antworten`;
    }
    if (this.presenterFreetextSmoothingStatus() === 'stale') {
      return $localize`:@@sessionHost.wordCloudSmoothStale:Neue Antworten seit letzter Wort-Glättung`;
    }
    const fallback = this.presenterFreetextLemmaFallbackReason();
    if (fallback === 'TIMEOUT' || fallback === 'INVALID_RESPONSE') {
      return $localize`:@@sessionQa.wordCloudSmoothFailed:Wort-Glättung fehlgeschlagen`;
    }
    if (
      fallback === 'NLP_DISABLED' ||
      fallback === 'SIDECAR_UNAVAILABLE' ||
      fallback === 'LOCALE_UNSUPPORTED' ||
      fallback === 'MODE_UNSUPPORTED'
    ) {
      return $localize`:@@sessionQa.wordCloudSmoothUnavailable:Wort-Glättung nicht verfügbar`;
    }
    if (this.presenterFreetextWordCloudFrozen()) {
      return $localize`:@@sessionHost.wordCloudFrozenInfo:Wortwolke eingefroren.`;
    }
    return null;
  });
  readonly freetextStageAnalysisEntries = computed<WordCloudAnalysisEntryDTO[] | null>(() => {
    if (
      this.presenterFreetextWordCloudFrozen() &&
      this.presenterFreetextWordCloudModeOverride() === null
    ) {
      return this.presenterFreetextFrozenAnalysis();
    }
    const override = this.presenterFreetextWordCloudModeOverride();
    if (override === 'SEMANTIC') {
      return this.presenterFreetextSemanticEntries();
    }
    if (override !== null && this.presenterFreetextLemmaDisplayEntries()) {
      return this.presenterFreetextLemmaDisplayEntries();
    }
    if (override !== null) {
      return null;
    }
    const projection = this.freetextWordCloudProjection();
    if (
      !projection ||
      projection.entries.length === 0 ||
      projection.questionId !== this.freetextQuestionId()
    ) {
      return null;
    }
    return projection.entries.map((entry) => ({
      key: entry.key,
      label: entry.label,
      count: entry.count,
      basisLabel: entry.label,
      members: [{ sourceId: entry.key, text: entry.label, weight: entry.count }],
      variants: [entry.label],
      confidence: null,
      labelOrigin: entry.labelOrigin,
    }));
  });
  readonly freetextWordCloudTerms = computed<WordCloudTerm[] | null>(() => {
    if (this.freetextStageAnalysisEntries()) {
      return null;
    }
    const mode = this.presenterFreetextWordCloudModeEffective();
    return this.wordCloudTermExtractor.extractTerms(
      this.presenterFreetextDisplayedResponses().map((response, index) => ({
        id: `response-${index}`,
        body: response,
      })),
      {
        locale: this.wordCloudTermLocale(),
        maxEntries: 80,
        maxNgramLength:
          mode === 'WORDS'
            ? WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH
            : WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH,
      },
    );
  });
  readonly presenterQaWordCloudQuestions = computed(() => this.presenterQaOrderedQuestions());
  readonly presenterQaWordCloudResponses = computed(() =>
    this.presenterQaWordCloudQuestions().map((question) => question.text),
  );
  readonly presenterQaWordCloudTermDocuments = computed<WordCloudTermDocument[]>(() =>
    this.presenterQaWordCloudQuestions().map((question) => ({
      id: question.id,
      title: question.text,
      weight: getQaWordCloudQuestionWeight(question, this.qaWordCloudProjection()?.metric),
    })),
  );
  readonly presenterQaWordCloudAnalysisEntries = computed<WordCloudAnalysisEntryDTO[] | null>(
    () => {
      const entries = this.qaWordCloudProjection()?.analysisEntries;
      return entries && entries.length > 0 ? entries : null;
    },
  );
  readonly presenterQaWordCloudTerms = computed<WordCloudTerm[] | null>(() => {
    if (this.presenterQaWordCloudAnalysisEntries()) {
      return null;
    }

    const projection = this.qaWordCloudProjection();
    const mode = projection?.mode ?? 'THEME';
    return this.wordCloudTermExtractor.extractTerms(this.presenterQaWordCloudTermDocuments(), {
      locale: projection?.locale
        ? localeIdToSupported(projection.locale)
        : this.wordCloudTermLocale(),
      maxEntries: 80,
      maxNgramLength: isWordCloudPhraseAnalysisVariant(mode)
        ? WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH
        : WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH,
    });
  });
  readonly qaWordCloudTitle = computed(() =>
    this.qaWordCloudProjection()?.mode === 'SEMANTIC'
      ? $localize`:@@sessionQa.wordCloudTitleSemantic:Themen in den Fragen`
      : $localize`:@@sessionQa.wordCloudTitle:Q&A-Wortwolke`,
  );
  readonly qaWordCloudDescription = computed(() => {
    switch (this.qaWordCloudProjection()?.mode) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudDescriptionSemantic:Ähnliche Fragen sind gruppiert.`;
      case 'LEXICAL':
        return $localize`:@@sessionQa.wordCloudDescriptionLexical:Häufige Wörter aus den sichtbaren Fragen.`;
      default:
        return $localize`:@@sessionQa.wordCloudDescriptionPhrases:Häufige Wörter und kurze Wortgruppen.`;
    }
  });
  readonly qaWordCloudWordLabelSingular = computed(() => {
    switch (this.qaWordCloudProjection()?.mode) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudThemeSingular:Thema`;
      case 'THEME':
        return $localize`:@@sessionQa.wordCloudEntrySingular:Begriff`;
      default:
        return $localize`:@@wordCloud.wordSingular:Wort`;
    }
  });
  readonly qaWordCloudWordLabelPlural = computed(() => {
    switch (this.qaWordCloudProjection()?.mode) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudThemePlural:Themen`;
      case 'THEME':
        return $localize`:@@sessionQa.wordCloudEntryPlural:Begriffe`;
      default:
        return $localize`:@@wordCloud.wordPlural:Wörter`;
    }
  });
  readonly qaWordCloudContextPills = computed(() => {
    const projection = this.qaWordCloudProjection();
    if (!projection) {
      return [];
    }

    return [
      this.qaWordCloudModePill(projection.mode),
      this.qaWordCloudMetricPill(projection.metric),
      projection.smoothingActive
        ? $localize`:@@sessionPresent.wordCloudSmoothingOn:Wort-Glättung an`
        : $localize`:@@sessionPresent.wordCloudSmoothingOff:ohne Wort-Glättung`,
    ];
  });

  private qaWordCloudModePill(mode: WordCloudAnalysisVariant): string {
    switch (mode) {
      case 'SEMANTIC':
        return $localize`:@@sessionQa.wordCloudAnalysisSemantic:Thema`;
      case 'LEXICAL':
        return $localize`:@@sessionQa.wordCloudAnalysisLexical:Wörter`;
      default:
        return $localize`:@@sessionQa.wordCloudAnalysisTheme:Wörter & Phrasen`;
    }
  }

  private qaWordCloudMetricPill(metric: WordCloudWeightMetric): string {
    switch (metric) {
      case 'BEST':
        return $localize`:@@sessionQa.sortBest:Beste Fragen`;
      case 'CONTROVERSIAL':
        return $localize`:@@sessionQa.sortControversial:Kontroverse`;
      case 'TIME':
        return $localize`:@@sessionQa.wordCloudMetricTime:Vorkommen in Fragen`;
      default:
        return $localize`:@@sessionQa.sortTop:Stimmensaldo`;
    }
  }

  readonly presenterQaWordCloudWeightedResponses = computed(() =>
    this.presenterQaWordCloudQuestions().map((question) => ({
      text: question.text,
      weight: getQaWordCloudQuestionWeight(question, this.qaWordCloudProjection()?.metric),
    })),
  );
  readonly showQuickFeedbackCard = computed(
    () =>
      this.preferredSecondaryChannel() === 'quickFeedback' &&
      this.preferredSecondaryChannelOpen() &&
      this.quickFeedbackResult() !== null &&
      this.showSecondaryPresentSurfaces(),
  );
  readonly presenterStandbyChannel = computed<'qa' | 'quickFeedback' | null>(() => {
    if (this.showQaWordCloud()) {
      return null;
    }
    const preferred = this.preferredSecondaryChannel();
    if (preferred === 'qa' && !this.showQaProjection()) {
      return preferred;
    }
    if (preferred === 'quickFeedback' && !this.showQuickFeedbackCard()) {
      return preferred;
    }
    return null;
  });
  readonly presenterStandbyState = computed<'closed' | 'empty'>(() =>
    this.preferredSecondaryChannelOpen() ? 'empty' : 'closed',
  );
  readonly presenterStandbyTitle = computed(() => {
    if (this.presenterStandbyChannel() === 'qa') {
      return this.session()?.channels?.qa.title?.trim() || $localize`:@@sessionTabs.questions:Q&A`;
    }
    return $localize`:@@sessionTabs.quickFeedback:Blitzlicht`;
  });
  readonly presenterStandbyMessage = computed(() => {
    const channel = this.presenterStandbyChannel();
    if (!this.preferredSecondaryChannelOpen()) {
      return channel === 'qa'
        ? $localize`:@@sessionPresent.qaClosed:Q&A ist geschlossen.`
        : $localize`:@@sessionPresent.quickFeedbackClosed:Blitzlicht ist geschlossen.`;
    }
    return channel === 'qa'
      ? $localize`:@@sessionPresent.qaStandby:Noch keine freigegebenen Fragen.`
      : $localize`:@@sessionPresent.quickFeedbackStandby:Blitzlicht noch nicht gestartet.`;
  });
  readonly showPresenterFreetextStage = computed(() => {
    if (
      !this.presenterFreetextActive() ||
      this.showPresentationEndedProjection() ||
      this.showFinishProjection() ||
      this.showQuizPauseProjection() ||
      this.showLobbyProjection() ||
      this.session()?.presenterSurface === 'qaWordCloud' ||
      this.presenterStandbyChannel() !== null
    ) {
      return false;
    }
    return !this.showQaProjection() && !this.showQaWordCloud() && !this.showQuickFeedbackCard();
  });
  readonly showPresenterFreetextResultsStage = computed(() => {
    if (!this.showPresenterFreetextStage() || this.quizQuestionAwaitingSnapshot()) {
      return false;
    }
    if (!this.presentedQuizQuestion()) {
      return true;
    }
    return (
      this.session()?.presenterSurface === 'freetextWordCloud' ||
      this.session()?.status === 'RESULTS'
    );
  });
  readonly showFinishProjection = computed(
    () => !this.showPresentationEndedProjection() && this.session()?.status === 'FINISHED',
  );
  /** Verhindert Idle-Flash, solange Leaderboards für die Abschlussprojektion noch laden. */
  readonly finishBoardsResolved = signal(false);
  readonly hasFinishResults = computed(() => {
    if (this.session()?.finishProjection === 'idle') {
      return false;
    }
    if (!this.finishBoardsResolved()) {
      // Noch kein Idle: leere Ergebnisseite statt Branding-Flash.
      return true;
    }
    return this.personalLeaderboard().length > 0 || this.teamLeaderboard().length > 0;
  });
  readonly showTeamFinish = computed(() => {
    const session = this.session();
    return (
      !this.showPresentationEndedProjection() &&
      session?.teamMode === true &&
      session.status === 'FINISHED' &&
      session.finishProjection !== 'idle' &&
      this.finishBoardsResolved() &&
      this.teamLeaderboard().length > 0
    );
  });
  readonly waitingLobbySession = computed(() => {
    const session = this.session();
    if (!session) return false;
    if (session.status === 'LOBBY') return true;
    if (session.type === 'Q_AND_A') return false;
    return (
      session.status === 'ACTIVE' &&
      this.hostQuestion() === null &&
      typeof session.currentQuestion !== 'number'
    );
  });
  readonly showLobbyProjection = computed(() => {
    if (
      this.showPresentationEndedProjection() ||
      this.showFinishProjection() ||
      this.showQuizPauseProjection() ||
      this.showQaProjection() ||
      this.showQaWordCloud() ||
      this.showQuickFeedbackCard() ||
      this.presenterStandbyChannel() !== null
    ) {
      return false;
    }
    if (!this.waitingLobbySession()) {
      return false;
    }
    // Freitext-Projektion hat Vorrang, sobald das Quiz schon eine Frage hat.
    // In der echten Lobby bleibt das Foyer sichtbar.
    return this.session()?.status === 'LOBBY' || !this.presenterFreetextActive();
  });
  readonly hasLobbyAudienceColumns = computed(
    () => this.lobbyTeamsView().length > 0 || this.lobbyPeople().length > 0,
  );
  readonly showQuizProjection = computed(() => {
    if (
      this.showPresentationEndedProjection() ||
      this.showFinishProjection() ||
      this.showQuizPauseProjection() ||
      this.showLobbyProjection()
    ) {
      return false;
    }
    const session = this.session();
    if (!session || session.type === 'Q_AND_A') {
      return false;
    }
    if (
      this.showQaProjection() ||
      this.showQaWordCloud() ||
      this.showQuickFeedbackCard() ||
      this.presenterStandbyChannel() !== null
    ) {
      return false;
    }
    return this.presentedQuizQuestion() !== null;
  });
  readonly presentedQuizQuestion = computed(() => {
    const question = this.hostQuestion();
    const session = this.session();
    return presenterQuestionMatchesSession(
      question,
      session?.currentQuestion,
      session?.currentRound,
    )
      ? question
      : null;
  });
  readonly quizQuestionAwaitingSnapshot = computed(() => {
    const session = this.session();
    if (
      !session ||
      session.type === 'Q_AND_A' ||
      this.showPresentationEndedProjection() ||
      this.showFinishProjection() ||
      this.showQuizPauseProjection() ||
      this.showLobbyProjection() ||
      this.showQaProjection() ||
      this.showQaWordCloud() ||
      this.showQuickFeedbackCard() ||
      this.presenterStandbyChannel() !== null
    ) {
      return false;
    }
    if (typeof session.currentQuestion !== 'number') {
      return false;
    }
    return this.presentedQuizQuestion() === null;
  });
  readonly presentedParticipantCount = computed(
    () => this.quizAudience()?.participantCount ?? this.session()?.participantCount ?? 0,
  );
  readonly presentedReadingReady = computed(() =>
    this.session()?.status === 'QUESTION_OPEN' ? (this.quizAudience()?.readingReady ?? null) : null,
  );
  /** Phasensteuerung, solange die Quizfrage die Projektion ist, auch in der Freitext-Wolke. */
  readonly showQuizControlFooter = computed(() => {
    if (
      this.showPresentationEndedProjection() ||
      this.showFinishProjection() ||
      this.showQuizPauseProjection() ||
      this.showLobbyProjection() ||
      this.showQaProjection() ||
      this.showQaWordCloud() ||
      this.showQuickFeedbackCard() ||
      this.presenterStandbyChannel() !== null
    ) {
      return false;
    }
    const session = this.session();
    if (!session || session.type === 'Q_AND_A') {
      return false;
    }
    return this.presentedQuizQuestion() !== null;
  });
  readonly showQuizPageNav = computed(() => {
    if (!this.showQuizControlFooter()) {
      return false;
    }
    const page = this.session()?.presenterPage;
    if (!page) {
      return false;
    }
    return page.count > 1 || this.quizPageNavHeldContext() === page.context;
  });
  readonly quizTimerBlocksReveal = computed(() =>
    presenterTimerBlocksReveal(
      this.session()?.status ?? null,
      this.presentedQuizQuestion(),
      this.hostVoteProgress(),
      this.session()?.enableTimerAccommodation !== false,
    ),
  );
  readonly quizOfferDiscussion = computed(() =>
    presenterOfferDiscussion(
      this.session()?.status ?? null,
      this.presentedQuizQuestion(),
      this.hostVoteProgress(),
      this.presentedParticipantCount(),
      this.countdownSeconds(),
    ),
  );
  readonly quizCanOpenFollowingQuestion = computed(() =>
    presenterCanOpenFollowingQuestion(this.presentedQuizQuestion()),
  );
  readonly personalLeaderboardWinner = computed(() => this.personalLeaderboard()[0] ?? null);
  readonly winningTeam = computed(() => this.teamLeaderboard()[0] ?? null);
  readonly teamLeaderboardMaxScore = computed(() =>
    Math.max(1, ...this.teamLeaderboard().map((entry) => entry.totalScore)),
  );
  readonly teamLeaderboardTopScore = computed(() => {
    const board = this.teamLeaderboard();
    if (board.length === 0) return 0;
    return Math.max(...board.map((e) => e.totalScore));
  });
  readonly teamScoreboardHasPoints = computed(() => this.teamLeaderboardTopScore() > 0);
  /** Ab dieser Länge wird die Boardliste mehrspaltig, damit alle Einträge auf der Projektion bleiben. */
  private static readonly BOARD_OVERFLOW_COUNT = 8;
  readonly personalBoardOverflows = computed(
    () => this.personalLeaderboard().length > SessionPresentComponent.BOARD_OVERFLOW_COUNT,
  );
  readonly teamBoardOverflows = computed(
    () => this.teamLeaderboard().length > SessionPresentComponent.BOARD_OVERFLOW_COUNT,
  );
  readonly personalBoardColumnCount = computed(() =>
    SessionPresentComponent.columnCountForParticipantTotal(this.personalLeaderboard().length),
  );
  readonly boardPageControlsLabel = $localize`:@@sessionPresent.leaderboardPageControls:Leaderboard-Seiten`;

  static columnCountForParticipantTotal(count: number): number {
    return count <= 5 ? 1 : 2;
  }

  private static readonly BOARD_PAGE_ROWS = 4;
  private static readonly BOARD_PAGE_MS = 12_000;

  static pageSizeForParticipantTotal(count: number): number {
    return this.columnCountForParticipantTotal(count) * this.BOARD_PAGE_ROWS;
  }

  static pageCountForTotal(count: number): number {
    const size = this.pageSizeForParticipantTotal(count);
    return Math.max(1, Math.ceil(count / size));
  }

  static pageSlice<T>(entries: T[], pageIndex: number): T[] {
    const size = this.pageSizeForParticipantTotal(entries.length);
    if (entries.length <= size) {
      return entries;
    }
    const pages = Math.ceil(entries.length / size);
    const page = ((pageIndex % pages) + pages) % pages;
    return entries.slice(page * size, page * size + size);
  }

  readonly visiblePersonalLeaderboard = computed(() =>
    SessionPresentComponent.pageSlice(this.personalLeaderboard(), this.personalBoardPageIndex()),
  );
  readonly visibleTeamLeaderboard = computed(() =>
    SessionPresentComponent.pageSlice(this.teamLeaderboard(), this.teamBoardPageIndex()),
  );
  readonly personalBoardPageCount = computed(() =>
    SessionPresentComponent.pageCountForTotal(this.personalLeaderboard().length),
  );
  readonly teamBoardPageCount = computed(() =>
    SessionPresentComponent.pageCountForTotal(this.teamLeaderboard().length),
  );
  readonly personalBoardPageLabel = computed(() =>
    this.boardRangeLabel(this.personalLeaderboard().length, this.personalBoardPageIndex()),
  );
  readonly teamBoardPageLabel = computed(() =>
    this.boardRangeLabel(this.teamLeaderboard().length, this.teamBoardPageIndex()),
  );
  readonly showPersonalBoardPause = computed(() => this.personalBoardPageCount() > 1);
  readonly showTeamBoardPause = computed(
    () => this.personalBoardPageCount() <= 1 && this.teamBoardPageCount() > 1,
  );

  stepBoardPage(board: 'personal' | 'team', delta: number): void {
    this.boardPagePaused.set(true);
    this.stopBoardPageTimer();
    const index = board === 'personal' ? this.personalBoardPageIndex : this.teamBoardPageIndex;
    const pages = board === 'personal' ? this.personalBoardPageCount() : this.teamBoardPageCount();
    if (pages <= 1) {
      index.set(0);
      return;
    }
    index.update((current) => (current + delta + pages) % pages);
  }

  toggleBoardPagePause(): void {
    this.boardPagePaused.update((paused) => !paused);
    this.syncBoardPageTimer();
  }

  private boardRangeLabel(total: number, pageIndex: number): string | null {
    const size = SessionPresentComponent.pageSizeForParticipantTotal(total);
    if (total <= size) {
      return null;
    }
    const pages = SessionPresentComponent.pageCountForTotal(total);
    const page = ((pageIndex % pages) + pages) % pages;
    const start = page * size + 1;
    const end = Math.min(total, (page + 1) * size);
    return $localize`:@@sessionPresent.leaderboardPage:${start}:start:–${end}:end: von ${total}:total:`;
  }
  readonly quickFeedbackEntries = computed(() => {
    const data = this.quickFeedbackResult();
    if (!data) {
      return [];
    }

    const order = feedbackResultOrder(data.type);
    return order.map((key) => ({ key, value: data.distribution[key] ?? 0 }));
  });
  readonly quickFeedbackResultsVisible = computed(() => {
    const result = this.quickFeedbackResult();
    if (!result) {
      return false;
    }
    return (
      result.resultsVisible ??
      result.showLiveResults ??
      (result.locked || result.discussion === true)
    );
  });
  readonly quickFeedbackShowsPercentages = computed(
    () => this.quickFeedbackResultsVisible() && (this.quickFeedbackResult()?.totalVotes ?? 0) >= 5,
  );

  async ngOnInit(): Promise<void> {
    effect(
      () => {
        const page = this.session()?.presenterPage;
        if (!page || page.count <= 1 || !this.showQuizControlFooter()) {
          return;
        }
        this.quizPageNavHeldContext.set(page.context);
      },
      { injector: this.injector },
    );
    effect(
      () => {
        if (!this.showQaProjection()) {
          return;
        }
        const count = this.qaQueuePageCount();
        untracked(() => {
          void this.reportProjectionPages(count);
        });
      },
      { injector: this.injector },
    );
    effect(
      () => {
        const index = this.qaQueuePageIndex();
        const stage = this.qaStage()?.nativeElement;
        if (!stage) {
          return;
        }
        untracked(() => {
          if (stage.dataset['qaNavIndex'] === String(index)) {
            return;
          }
          stage.dataset['qaNavIndex'] = String(index);
          stage.scrollTop = 0;
        });
      },
      { injector: this.injector },
    );

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      document.addEventListener('fullscreenchange', this.onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
    }
    this.syncFullscreenAction();
    if (this.code.length !== 6) {
      this.showHomeCta.set(true);
      this.presenterInfo.set($localize`Ungültiger Session-Code.`);
      return;
    }

    this.hostDisplayMode.setHostSessionActive(true);
    await this.refreshSessionMeta();
    // Nach Navigation während des Ladens keine Subscriptions oder Intervalle mehr starten.
    if (this.destroyRef.destroyed) {
      return;
    }
    await this.refreshPresenterLiveData();
    if (this.destroyRef.destroyed) {
      return;
    }
    this.ensurePresenterSubscriptions();
    this.startPolling();
    void this.generateJoinQr();
  }

  ngOnDestroy(): void {
    if (this.projectionReportRetry) clearTimeout(this.projectionReportRetry);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      document.removeEventListener('fullscreenchange', this.onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
    }
    this.stopPolling();
    this.stopSessionDeadlineTimer();
    this.stopBoardPageTimer();
    this.stopCountdown();
    this.currentQuestionSub?.unsubscribe();
    this.voteProgressSub?.unsubscribe();
    this.statusSub?.unsubscribe();
    this.clearLobbyAudience();
    this.hostDisplayMode.setHostSessionActive(false);
  }

  private measuredProjectionPage: { context: string; count: number } | null = null;
  private reportingProjectionPage = false;
  private projectionReportRetry: ReturnType<typeof setTimeout> | null = null;

  enterPresenterFullscreen(): void {
    tryRequestDocumentFullscreen(this.document, () => this.syncFullscreenAction());
  }

  private syncFullscreenAction(): void {
    const wasVisible = this.showFullscreenAction();
    const shouldShow =
      isDocumentFullscreenEnterAvailable(this.document) &&
      getDocumentFullscreenElement(this.document) === null;
    this.showFullscreenAction.set(shouldShow);
    if (wasVisible && !shouldShow) {
      queueMicrotask(() => {
        if (this.destroyRef.destroyed) return;
        const surface = this.hostElement.nativeElement.querySelector(
          '[data-testid="presenter-surface"]',
        ) as HTMLElement | null;
        if (surface?.isConnected) {
          surface.focus({ preventScroll: true });
        }
      });
    }
  }

  async reportProjectionPages(count: number): Promise<void> {
    const page = this.session()?.presenterPage;
    if (!page || this.destroyRef.destroyed) return;
    this.measuredProjectionPage = { context: page.context, count };
    if (this.reportingProjectionPage) return;
    this.reportingProjectionPage = true;
    try {
      while (!this.destroyRef.destroyed) {
        const measured = this.measuredProjectionPage;
        const current = this.session()?.presenterPage;
        if (!measured || measured.context !== current?.context || measured.count === current.count)
          break;
        const result = await trpc.session.setPresenterSurface.mutate(
          {
            code: this.sessionCode,
            page: measured,
          },
          { signal: AbortSignal.timeout(10000) },
        );
        if (this.destroyRef.destroyed) break;
        this.session.update((session) =>
          session?.presenterPage?.context === measured.context
            ? { ...session, presenterPage: result.presenterPage }
            : session,
        );
      }
    } catch {
      // Retry a lost measurement without requiring another resize or content change.
      if (!this.destroyRef.destroyed) {
        this.projectionReportRetry = setTimeout(() => {
          const measured = this.measuredProjectionPage;
          if (measured?.context === this.session()?.presenterPage?.context) {
            void this.reportProjectionPages(measured!.count);
          }
        }, 2000);
      }
    } finally {
      this.reportingProjectionPage = false;
    }
  }

  private startPolling(): void {
    if (this.destroyRef.destroyed) return;
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    if (!this.metaPollTimer) {
      this.metaPollTimer = setInterval(
        () => void this.refreshSessionMeta(),
        SessionPresentComponent.META_POLL_MS,
      );
    }
    if (!this.livePollTimer) {
      this.livePollTimer = setInterval(
        () => void this.refreshPresenterLiveData(),
        SessionPresentComponent.LIVE_POLL_MS,
      );
    }
  }

  private stopPolling(): void {
    if (this.metaPollTimer) {
      clearInterval(this.metaPollTimer);
      this.metaPollTimer = null;
    }
    if (this.livePollTimer) {
      clearInterval(this.livePollTimer);
      this.livePollTimer = null;
    }
  }

  private async refreshPresenterLiveData(): Promise<void> {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    if (this.presentDeadlineClosed || this.sessionDeadline.isAbsoluteDeadlineReached()) {
      this.closePresentAtDeadline();
      return;
    }
    if (this.showFinishProjection()) {
      if (this.session()?.finishProjection === 'idle') {
        this.personalLeaderboard.set([]);
        this.teamLeaderboard.set([]);
        this.finishBoardsResolved.set(true);
        this.syncBoardPageTimer();
        return;
      }
      await this.loadPresenterLeaderboards();
      if (this.destroyRef.destroyed) return;
      this.finishBoardsResolved.set(true);
      return;
    }
    this.stopBoardPageTimer();
    if (!this.session()) {
      return;
    }
    if (this.session()?.presenterSurface === 'qaWordCloud') {
      await this.refreshQaQuestions();
      await this.refreshQaWordCloudProjection();
      return;
    }
    await this.refreshLiveFreetext();
    // Erst nach dem Freitext-Stand: die Bühne und die Fragen-Id gibt es vorher nicht,
    // und ein früher Abruf würde die lokale Phrasenwolke stehen lassen.
    if (this.showPresenterFreetextResultsStage()) {
      await this.refreshFreetextWordCloudProjection();
    }
    await this.refreshQaQuestions();
    await this.refreshQuickFeedbackResult();
    await this.refreshHostQuestion();
    await this.refreshEmojiReactions();
    await this.refreshHostVoteProgress();
    await this.refreshQuizAudience();
    await this.refreshLobbyAudience();
  }

  teamScoreBarWidth(totalScore: number): string {
    const max = this.teamLeaderboardMaxScore();
    const percentage = max <= 0 ? 0 : Math.max(10, Math.round((totalScore / max) * 100));
    return `${percentage}%`;
  }

  readonly lobbyAudienceIsCrowd = lobbyAudienceIsCrowd;
  readonly lobbyAudienceIsPacked = lobbyAudienceIsPacked;
  readonly lobbyFitColumnCount = lobbyFitColumnCount;

  teamMemberLabel(count: number): string {
    return count === 1 ? $localize`${count} Mitglied` : $localize`${count} Mitglieder`;
  }

  lobbyAudienceCountLabel(): string {
    const count = this.lobbyParticipantCount();
    const formatted = formatLocaleCount(count, this.localeId);
    if (count === 1) {
      return $localize`:@@sessionPresent.lobbyAudienceCountOne:${formatted}:count: Person`;
    }
    return $localize`:@@sessionPresent.lobbyAudienceCountMany:${formatted}:count: Teilnehmende`;
  }

  lobbyNicknameBadge(nickname: string): KindergartenNicknameBadge | null {
    const session = this.session();
    if (session?.nicknameTheme !== 'KINDERGARTEN' || session.anonymousMode === true) {
      return null;
    }
    return findKindergartenNicknameBadge(nickname);
  }

  packedLobbyIdentity(participant: LobbyParticipant, packed: boolean): PackedLobbyIdentity | null {
    if (!packed) {
      return null;
    }

    const number = this.lobbyEntranceNumbers().get(participant.id);
    const session = this.session();
    if (!number || !session) {
      return null;
    }

    if (session.anonymousMode === true) {
      const accessibleLabel = $localize`:@@sessionPresent.anonymousParticipantNumber:Anonyme Person ${number}:number:`;
      return {
        icon: 'theater_comedy',
        number,
        theme: 'anonymous',
        accessibleLabel,
        title: accessibleLabel,
      };
    }

    const identity = (() => {
      switch (session.nicknameTheme) {
        case 'MIDDLE_SCHOOL':
          return { icon: 'school', theme: 'middle-school' } as const;
        case 'HIGH_SCHOOL':
          return { icon: 'school', theme: 'high-school' } as const;
        case 'NOBEL_LAUREATES':
          return { icon: 'military_tech', theme: 'nobel' } as const;
        default:
          return null;
      }
    })();

    if (!identity) {
      return null;
    }

    return {
      ...identity,
      number,
      accessibleLabel: participant.nickname,
      title: participant.nickname,
    };
  }

  foyerChipsForTeam(teamId: string): FoyerEntranceChip[] {
    return this.lobbyFoyerChipsByTeam().get(teamId) ?? [];
  }

  isLandedLobbyParticipant(participantId: string): boolean {
    return this.landedLobbyParticipantIds().has(participantId);
  }

  teamLeaderboardRankDisplay(rank: number): string {
    return this.teamScoreboardHasPoints() ? `#${rank}` : '\u2014';
  }

  winningTeamLabel(entry: TeamLeaderboardEntryDTO | null): string | null {
    if (!entry) {
      return null;
    }
    return $localize`${entry.teamName} gewinnt mit ${formatLocaleCount(entry.totalScore, this.localeId)}:totalScore: Punkten!`;
  }

  leaderboardKindergartenEmoji(nickname: string): string | null {
    return findKindergartenNicknameEmoji(nickname);
  }

  teamNameEmojiMarker(teamName: string | null | undefined): string | null {
    return teamName ? extractEdgeEmoji(teamName) : null;
  }

  teamNameLabelWithoutEmojiMarker(teamName: string | null | undefined): string {
    if (!teamName) {
      return $localize`Team`;
    }
    const label = stripEdgeEmojiMarker(teamName).trim();
    return label.length > 0 ? label : $localize`Team`;
  }

  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(value, {
        imagePolicy: 'external-https-and-app-assets',
        headingStartLevel: 3,
      }).html,
    );
  }

  quickFeedbackHeading(type: string): string {
    return feedbackTitle(type);
  }

  quickFeedbackDisplayLabel(key: string, type: string): string {
    return feedbackDisplayLabel(key, type);
  }

  quickFeedbackDisplayIcon(key: string, type: string) {
    return feedbackDisplayIcon(key, type);
  }

  quickFeedbackIsNeutralEntry(key: string, type: string): boolean {
    return (
      (type === 'MOOD' && key === 'NEUTRAL') ||
      (type === 'YESNO' && key === 'MAYBE') ||
      (type === 'TRUEFALSE_UNKNOWN' && key === 'UNKNOWN') ||
      (type === 'STARS' && key === '3') ||
      (type === 'TEMPO' && key === 'FOLLOWING')
    );
  }

  quickFeedbackStatusLabel(): string | null {
    const result = this.quickFeedbackResult();
    if (!result) {
      return null;
    }

    if (result.discussion) {
      return $localize`:@@sessionPresent.quickFeedbackStatusDiscussion:Vergleichsrunde läuft`;
    }

    if ((result.currentRound ?? 1) === 2) {
      return $localize`:@@sessionPresent.quickFeedbackStatusRound2:Runde 2 läuft`;
    }

    if (result.locked) {
      return $localize`:@@sessionPresent.quickFeedbackStatusPaused:Pausiert`;
    }

    return $localize`:@@sessionPresent.quickFeedbackStatusActive:Runde 1 läuft`;
  }

  quickFeedbackBarWidth(value: number): string {
    const entries = this.quickFeedbackEntries();
    const max = Math.max(1, ...entries.map((entry) => entry.value));
    return `${Math.max(8, Math.round((value / max) * 100))}%`;
  }

  quickFeedbackPercentage(value: number): string {
    const total = this.quickFeedbackResult()?.totalVotes ?? 0;
    if (total <= 0) {
      return formatLocalePercent(0, this.localeId, 0);
    }
    return formatLocalePercent(Math.round((value / total) * 100), this.localeId, 0);
  }

  formatCount(value: number | null | undefined): string {
    return formatLocaleCount(value ?? 0, this.localeId);
  }

  formatQaRedactedAt(isoDate: string): string {
    return new Intl.DateTimeFormat(this.localeId, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoDate));
  }

  qaPassagesRedactedAt(
    question: Pick<QaQuestionDTO, 'passagesRedacted' | 'passagesRedactedAt' | 'updatedAt'>,
  ): string | null {
    if (!question.passagesRedacted) {
      return null;
    }
    return question.passagesRedactedAt ?? question.updatedAt ?? null;
  }

  qaPassagesRedactedAria(isoDate?: string | null): string {
    if (!isoDate) {
      return $localize`:@@sessionQa.badgePassagesRedactedAria:Passagen durch Moderation geschwärzt`;
    }
    const when = this.formatQaRedactedAt(isoDate);
    return $localize`:@@sessionQa.badgePassagesRedactedAriaAt:Passagen durch Moderation geschwärzt am ${when}:when:`;
  }

  private async refreshSessionMeta(): Promise<void> {
    const refreshEpoch = ++this.presentSessionMetaRefreshEpoch;
    try {
      const requestedAt = Date.now();
      const session = await trpc.session.getInfoForReconnect.query({
        code: this.code.toUpperCase(),
        anonymousClientId: getAnonymousClientId(),
      });
      // Eine späte Antwort nach ngOnDestroy darf keine Subscriptions oder Timer mehr starten.
      if (this.destroyRef.destroyed || refreshEpoch !== this.presentSessionMetaRefreshEpoch) return;
      recordServerTimeSample(session.serverTime, requestedAt);
      this.snapshotRefreshFailed.set(false);
      this.showHomeCta.set(false);
      if (!this.applySessionDeadlineSnapshot(session)) {
        if (
          this.sessionDeadline.isExpired() &&
          session.sessionLifecycleRevision === this.sessionDeadline.currentRevision()
        ) {
          this.session.set({
            ...session,
            status: 'FINISHED',
            currentQuestion: null,
            finishProjection: 'idle',
          });
        } else if (!this.presentDeadlineClosed) {
          this.ensurePresenterSubscriptions();
        }
        return;
      }
      this.session.set(session);
      this.dropStalePresenterQuestion();
      this.moveFocusFromQuestionGate(this.focusedQuestionGate());
      this.ensurePresenterSubscriptions();
      if (session.status === 'FINISHED') {
        if (session.finishProjection === 'idle') {
          this.personalLeaderboard.set([]);
          this.teamLeaderboard.set([]);
          this.finishBoardsResolved.set(true);
          this.syncBoardPageTimer();
          return;
        }
        this.finishBoardsResolved.set(false);
        await this.loadPresenterLeaderboards();
        if (this.destroyRef.destroyed) return;
        this.finishBoardsResolved.set(true);
        return;
      }
      this.finishBoardsResolved.set(false);
      if (session.status === 'RESULTS' && session.showLeaderboard !== false) {
        await this.loadPresenterLeaderboards();
        return;
      }
      this.personalLeaderboard.set([]);
      this.teamLeaderboard.set([]);
    } catch (error: unknown) {
      if (!this.isDefinitiveSessionError(error)) {
        this.snapshotRefreshFailed.set(true);
        this.showHomeCta.set(false);
        if (!this.session()) {
          this.presenterInfo.set(this.connectionStatusMessage());
        }
        return;
      }
      this.snapshotRefreshFailed.set(false);
      this.session.set(null);
      this.showHomeCta.set(true);
      this.presenterInfo.set(localizeKnownServerError(error, sessionNotFoundUiMessage()));
      this.personalLeaderboard.set([]);
      this.teamLeaderboard.set([]);
      this.finishBoardsResolved.set(true);
      this.clearLobbyAudience();
    }
  }

  private applySessionDeadlineSnapshot(snapshot: SessionDeadlineSnapshot): boolean {
    const hasLifecycleSnapshot =
      snapshot.serverNow !== undefined &&
      snapshot.expiresAt !== undefined &&
      snapshot.sessionLifecycleRevision !== undefined;
    if (!hasLifecycleSnapshot) {
      return true;
    }
    snapshot = enrichDeadlineSnapshot(snapshot, this.session() ?? undefined);
    if (!this.sessionDeadline.applySnapshot(snapshot)) {
      if (this.sessionDeadline.isAbsoluteDeadlineReached()) {
        this.closePresentAtDeadline();
      }
      return false;
    }
    // Quiz-FINISHED latched die Teilnahme, solange kein Q&A offen ist.
    // Die Abschlussprojektion bleibt bis zur globalen expiresAt stehen.
    if (this.sessionDeadline.isAbsoluteDeadlineReached()) {
      this.closePresentAtDeadline();
      return false;
    }
    if (this.presentDeadlineClosed) {
      this.presentDeadlineClosed = false;
      this.ensurePresenterSubscriptions();
    }
    this.scheduleSessionDeadlineCheck();
    return true;
  }

  private scheduleSessionDeadlineCheck(): void {
    this.stopSessionDeadlineTimer();
    const remaining = this.sessionDeadline.remainingMs();
    if (remaining === null) return;
    this.sessionDeadlineTimer = setTimeout(
      () => {
        this.sessionDeadlineTimer = null;
        if (this.sessionDeadline.isAbsoluteDeadlineReached()) {
          this.closePresentAtDeadline();
          return;
        }
        this.scheduleSessionDeadlineCheck();
      },
      Math.max(1, Math.min(remaining, 60_000)),
    );
  }

  private stopSessionDeadlineTimer(): void {
    if (this.sessionDeadlineTimer) {
      clearTimeout(this.sessionDeadlineTimer);
      this.sessionDeadlineTimer = null;
    }
  }

  private closePresentAtDeadline(): void {
    this.presentDeadlineClosed = true;
    this.stopSessionDeadlineTimer();
    this.stopCountdown();
    this.stopBoardPageTimer();
    this.currentQuestionSub?.unsubscribe();
    this.currentQuestionSub = null;
    this.voteProgressSub?.unsubscribe();
    this.voteProgressSub = null;
    this.presenterQaOrderedQuestions.set([]);
    this.quickFeedbackResult.set(null);
    this.freetextResponses.set([]);
    this.freetextQuestionId.set(null);
    this.resetPresenterFreetextWordCloudControls();
    this.hostQuestion.set(null);
    this.hostVoteProgress.set(null);
    this.emojiReactions.set(null);
    this.personalLeaderboard.set([]);
    this.teamLeaderboard.set([]);
    this.clearLobbyAudience();
    this.session.update((current) =>
      current
        ? {
            ...current,
            status: 'FINISHED',
            currentQuestion: null,
            finishProjection: 'idle',
          }
        : current,
    );
  }

  private async loadPresenterLeaderboards(): Promise<void> {
    const code = this.code.toUpperCase();
    const anonymousClientId = getAnonymousClientId();
    const requestedStatus = this.session()?.status;
    try {
      const [personal, teams] = await Promise.all([
        trpc.session.getLeaderboard.query({ code, anonymousClientId }),
        trpc.session.getTeamLeaderboard.query({ code, anonymousClientId }),
      ]);
      if (this.destroyRef.destroyed) return;
      const current = this.session();
      if (!current || current.status !== requestedStatus) {
        return;
      }
      if (
        (current.status === 'FINISHED' && current.finishProjection === 'idle') ||
        (current.status === 'RESULTS' && current.showLeaderboard === false)
      ) {
        this.personalLeaderboard.set([]);
        this.teamLeaderboard.set([]);
      } else {
        this.personalLeaderboard.set(personal);
        this.teamLeaderboard.set(teams);
      }
    } catch {
      if (this.destroyRef.destroyed) return;
      if (this.session()?.status === requestedStatus) {
        this.personalLeaderboard.set([]);
        this.teamLeaderboard.set([]);
      }
    }
    this.syncBoardPageTimer();
  }

  private syncBoardPageTimer(): void {
    // Späte Antworten nach ngOnDestroy dürfen kein Intervall mehr anlegen, das niemand stoppt.
    if (this.destroyRef.destroyed) return;
    const personalPages = this.personalBoardPageCount();
    const teamPages = this.teamBoardPageCount();
    if (!this.showFinishProjection()) {
      this.stopBoardPageTimer();
      this.boardPagePaused.set(false);
      this.personalBoardPageIndex.set(0);
      this.teamBoardPageIndex.set(0);
      return;
    }
    if (personalPages <= 1) this.personalBoardPageIndex.set(0);
    if (teamPages <= 1) this.teamBoardPageIndex.set(0);
    if (this.boardPagePaused() || (personalPages <= 1 && teamPages <= 1)) {
      this.stopBoardPageTimer();
      return;
    }
    if (this.boardPageTimer !== null) {
      return;
    }
    this.boardPageTimer = setInterval(() => {
      if (this.destroyRef.destroyed || !this.showFinishProjection() || this.boardPagePaused()) {
        this.stopBoardPageTimer();
        return;
      }
      this.advanceBoardPage(this.personalBoardPageIndex, this.personalBoardPageCount());
      this.advanceBoardPage(this.teamBoardPageIndex, this.teamBoardPageCount());
      if (this.personalBoardPageCount() <= 1 && this.teamBoardPageCount() <= 1) {
        this.stopBoardPageTimer();
      }
    }, SessionPresentComponent.BOARD_PAGE_MS);
  }

  private advanceBoardPage(
    index: { set: (value: number) => void; update: (update: (current: number) => number) => void },
    pages: number,
  ): void {
    if (pages <= 1) {
      index.set(0);
      return;
    }
    index.update((current) => (current + 1) % pages);
  }

  private stopBoardPageTimer(): void {
    if (this.boardPageTimer !== null) {
      clearInterval(this.boardPageTimer);
      this.boardPageTimer = null;
    }
  }

  private async refreshLiveFreetext(): Promise<void> {
    if (
      !this.session() ||
      this.presentDeadlineClosed ||
      this.session()?.presenterSurface === 'qaWordCloud' ||
      this.showFinishProjection()
    ) {
      return;
    }

    try {
      const data = await trpc.session.getLiveFreetext.query({ code: this.code.toUpperCase() });
      if (this.presentDeadlineClosed) return;
      if (data.questionId !== this.freetextQuestionId()) {
        this.resetPresenterFreetextWordCloudControls();
      }
      this.freetextResponses.set(data.responses);
      this.freetextQuestionId.set(data.questionId);

      if (data.questionType === 'FREETEXT') {
        this.presenterFreetextActive.set(true);
        this.currentQuestionLabel.set(
          this.presenterQuestionLabel(data.questionOrder, data.questionText),
        );
        this.presenterInfo.set($localize`Live-Freitext wird aktualisiert.`);
      } else if (data.questionType) {
        this.presenterFreetextActive.set(false);
        this.currentQuestionLabel.set(
          this.presenterQuestionLabel(data.questionOrder, data.questionText),
        );
        this.presenterInfo.set($localize`Aktuelle Frage ist keine Freitext-Frage.`);
      } else {
        this.presenterFreetextActive.set(false);
        this.currentQuestionLabel.set(null);
        this.presenterInfo.set($localize`Noch keine aktive Frage.`);
      }
    } catch {
      // Einzelner Live-Abruf: letzten Stand behalten; Meta-Poll und WS melden den Gesamtzustand.
    }
  }

  private async refreshQaQuestions(): Promise<void> {
    const sessionId = this.session()?.id;
    const qaEnabled = this.session()?.channels?.qa.enabled ?? this.session()?.type === 'Q_AND_A';
    if (!sessionId || !qaEnabled || this.showFinishProjection() || this.presentDeadlineClosed) {
      this.presenterQaOrderedQuestions.set([]);
      return;
    }

    try {
      const snapshot: QaQuestionsListDTO | QaQuestionDTO[] = await trpc.qa.presentProjection.query({
        sessionId,
      });
      if (Array.isArray(snapshot)) {
        if (this.presentDeadlineClosed || this.sessionDeadline.isAbsoluteDeadlineReached()) {
          return;
        }
        const visibleQuestions = snapshot.filter(
          (question) => question.status === 'PINNED' || question.status === 'ACTIVE',
        );
        this.presenterQaOrderedQuestions.set([
          ...visibleQuestions.filter((question) => question.status === 'PINNED'),
          ...visibleQuestions.filter((question) => question.status === 'ACTIVE'),
        ]);
        return;
      }
      const terminal = snapshot.state === 'SESSION_ENDED';
      if (
        !this.sessionDeadline.applySnapshot({
          ...snapshot,
          status: terminal ? 'FINISHED' : 'ACTIVE',
        })
      ) {
        return;
      }
      if (this.sessionDeadline.isAbsoluteDeadlineReached()) {
        this.closePresentAtDeadline();
        return;
      }
      if (this.presentDeadlineClosed) {
        this.presenterQaOrderedQuestions.set([]);
        return;
      }
      if (snapshot.state === 'UNCONFIGURED') {
        this.presenterQaOrderedQuestions.set([]);
        return;
      }
      if (snapshot.sortMode && !this.qaSortPending()) {
        this.presenterQaSortMode.set(snapshot.sortMode);
      }
      const visibleQuestions = snapshot.questions.filter(
        (question) => question.status === 'PINNED' || question.status === 'ACTIVE',
      );
      this.presenterQaOrderedQuestions.set([
        ...visibleQuestions.filter((question) => question.status === 'PINNED'),
        ...visibleQuestions.filter((question) => question.status === 'ACTIVE'),
      ]);
    } catch {
      // Einzelner Live-Abruf: letzten Stand behalten; Meta-Poll und WS melden den Gesamtzustand.
    }
  }

  private async refreshQaWordCloudProjection(): Promise<void> {
    if (!this.showQaWordCloud() || this.showFinishProjection() || this.presentDeadlineClosed) {
      this.qaWordCloudProjection.set(null);
      return;
    }

    try {
      const result = await trpc.session.getQaWordCloudProjection.query({
        code: this.code.toUpperCase(),
      });
      if (this.presentDeadlineClosed) {
        return;
      }
      this.qaWordCloudProjection.set(result.projection);
    } catch {
      // Optionale Host-Projektion: ohne Snapshot bleibt der lexikalische Presenter-Pfad.
    }
  }

  setPresenterFreetextWordCloudMode(mode: string): void {
    if (mode !== 'WORDS' && mode !== 'PHRASES' && mode !== 'SEMANTIC') {
      return;
    }
    if (this.presenterFreetextWordCloudModeOverride() === mode) {
      return;
    }
    this.presenterFreetextWordCloudModeOverride.set(mode);
    this.presenterFreetextSemanticFailed.set(false);
    if (mode === 'SEMANTIC') {
      this.presenterFreetextLemmaPreferred.set(false);
      void this.requestPresenterFreetextSemantic(false);
      return;
    }
    this.beginPresenterFreetextAnalysis();
    this.presenterFreetextSemanticEntries.set(null);
    this.presenterFreetextSemanticAnalyzedKey.set(null);
    void this.publishPresenterFreetextWordCloud();
  }

  togglePresenterFreetextWordCloudFreeze(): void {
    if (this.presenterFreetextWordCloudFrozen()) {
      this.presenterFreetextWordCloudFrozen.set(false);
      this.presenterFreetextFrozenResponses.set(null);
      this.presenterFreetextFrozenAnalysis.set(null);
      return;
    }
    this.presenterFreetextFrozenAnalysis.set(this.freetextStageAnalysisEntries());
    this.presenterFreetextFrozenResponses.set([...this.freetextResponses()]);
    this.presenterFreetextWordCloudFrozen.set(true);
  }

  togglePresenterFreetextWordCloudSmoothing(): void {
    if (!this.presenterFreetextShowSmoothing() || this.presenterFreetextLemmaPending()) {
      return;
    }
    const followingProjection = this.presenterFreetextWordCloudModeOverride() === null;
    if (followingProjection && this.freetextWordCloudProjection()?.smoothingActive === true) {
      this.presenterFreetextWordCloudModeOverride.set(
        this.presenterFreetextWordCloudModeEffective(),
      );
      this.presenterFreetextLemmaPreferred.set(false);
      this.presenterFreetextLemmaEntries.set(null);
      void this.publishPresenterFreetextWordCloud();
      return;
    }
    if (this.presenterFreetextSmoothingStatus() === 'active') {
      this.presenterFreetextLemmaPreferred.set(false);
      this.presenterFreetextLemmaEntries.set(null);
      this.presenterFreetextLemmaAnalyzedKey.set(null);
      void this.publishPresenterFreetextWordCloud();
      return;
    }
    this.presenterFreetextWordCloudModeOverride.set(this.presenterFreetextWordCloudModeEffective());
    this.presenterFreetextLemmaPreferred.set(true);
    void this.requestPresenterFreetextLemmaSmoothing();
  }

  refreshPresenterFreetextWordCloudThemes(): void {
    if (this.presenterFreetextSemanticPending()) {
      return;
    }
    void this.requestPresenterFreetextSemantic(true);
  }

  private resetPresenterFreetextWordCloudControls(): void {
    this.presenterFreetextAnalysisGeneration += 1;
    this.presenterFreetextWordCloudModeOverride.set(null);
    this.presenterFreetextWordCloudFrozen.set(false);
    this.presenterFreetextFrozenResponses.set(null);
    this.presenterFreetextFrozenAnalysis.set(null);
    this.presenterFreetextLemmaPreferred.set(false);
    this.presenterFreetextLemmaPending.set(false);
    this.presenterFreetextLemmaEntries.set(null);
    this.presenterFreetextLemmaApplied.set(false);
    this.presenterFreetextLemmaAnalyzedKey.set(null);
    this.presenterFreetextLemmaFallbackReason.set(null);
    this.presenterFreetextSemanticPending.set(false);
    this.presenterFreetextSemanticEntries.set(null);
    this.presenterFreetextSemanticAnalyzedKey.set(null);
    this.presenterFreetextSemanticFailed.set(false);
  }

  private presenterFreetextAnalysisLocale(): WordCloudAnalysisLocale | null {
    const projected = this.freetextWordCloudProjection()?.locale;
    if (projected && isWordCloudLemmaLocale(projected)) {
      return projected;
    }
    const locale = this.wordCloudTermLocale();
    return isWordCloudLemmaLocale(locale) ? locale : null;
  }

  private presenterFreetextAnalysisItems(): AnalyzeWordCloudInput['items'] {
    return this.presenterFreetextDisplayedResponses()
      .map((response) => response.trim())
      .filter((response) => response.length > 0)
      .map((text, index) => ({
        id: `response-${index}`,
        text,
        weight: 1,
      }));
  }

  private beginPresenterFreetextAnalysis(): number {
    const generation = ++this.presenterFreetextAnalysisGeneration;
    this.presenterFreetextLemmaPending.set(false);
    this.presenterFreetextSemanticPending.set(false);
    return generation;
  }

  private async requestPresenterFreetextSemantic(refresh: boolean): Promise<void> {
    const generation = this.beginPresenterFreetextAnalysis();
    const locale = this.presenterFreetextAnalysisLocale();
    const items = this.presenterFreetextAnalysisItems();
    const analyzedKey = this.presenterFreetextResponseKey();
    if (!locale || items.length === 0) {
      this.presenterFreetextSemanticFailed.set(true);
      return;
    }
    this.presenterFreetextSemanticPending.set(true);
    this.presenterFreetextSemanticFailed.set(false);
    try {
      const result = await trpc.wordCloud.analyze.mutate({
        sessionCode: this.code.toUpperCase(),
        mode: 'SEMANTIC',
        locale,
        metric: 'TOP',
        channel: 'FREETEXT',
        normalization: 'NONE',
        items,
        maxEntries: 40,
        ...(refresh ? { refresh: true } : {}),
      });
      if (generation !== this.presenterFreetextAnalysisGeneration) {
        return;
      }
      this.presenterFreetextSemanticEntries.set(result.entries);
      this.presenterFreetextSemanticAnalyzedKey.set(analyzedKey);
      await this.publishPresenterFreetextWordCloud();
    } catch {
      if (generation !== this.presenterFreetextAnalysisGeneration) {
        return;
      }
      this.presenterFreetextSemanticFailed.set(true);
    } finally {
      if (generation === this.presenterFreetextAnalysisGeneration) {
        this.presenterFreetextSemanticPending.set(false);
      }
    }
  }

  private async requestPresenterFreetextLemmaSmoothing(): Promise<void> {
    const generation = this.beginPresenterFreetextAnalysis();
    const locale = this.presenterFreetextAnalysisLocale();
    const items = this.presenterFreetextAnalysisItems();
    const analyzedKey = this.presenterFreetextLemmaFingerprint();
    const mode = this.presenterFreetextWordCloudModeEffective();
    if (!locale || items.length === 0 || !analyzedKey || mode === 'SEMANTIC') {
      this.presenterFreetextLemmaPreferred.set(false);
      return;
    }
    this.presenterFreetextLemmaPending.set(true);
    this.presenterFreetextLemmaFallbackReason.set(null);
    try {
      const result = await trpc.wordCloud.analyze.mutate({
        sessionCode: this.code.toUpperCase(),
        mode: 'LEXICAL',
        locale,
        metric: 'TOP',
        normalization: 'LEMMA',
        items,
        maxEntries: 80,
        maxNgramLength:
          mode === 'WORDS'
            ? WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH
            : WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH,
      });
      if (
        generation !== this.presenterFreetextAnalysisGeneration ||
        !this.presenterFreetextLemmaPreferred()
      ) {
        return;
      }
      if (result.normalizationApplied === 'LEMMA') {
        this.presenterFreetextLemmaEntries.set(result.entries);
        this.presenterFreetextLemmaApplied.set(true);
        this.presenterFreetextLemmaAnalyzedKey.set(analyzedKey);
        this.presenterFreetextLemmaFallbackReason.set(null);
        await this.publishPresenterFreetextWordCloud();
        return;
      }
      this.presenterFreetextLemmaEntries.set(null);
      this.presenterFreetextLemmaApplied.set(false);
      this.presenterFreetextLemmaAnalyzedKey.set(null);
      this.presenterFreetextLemmaFallbackReason.set(
        result.normalizationFallbackReason ?? 'SIDECAR_UNAVAILABLE',
      );
      await this.publishPresenterFreetextWordCloud();
    } catch {
      if (generation !== this.presenterFreetextAnalysisGeneration) {
        return;
      }
      this.presenterFreetextLemmaEntries.set(null);
      this.presenterFreetextLemmaApplied.set(false);
      this.presenterFreetextLemmaAnalyzedKey.set(null);
      this.presenterFreetextLemmaFallbackReason.set('TIMEOUT');
    } finally {
      if (generation === this.presenterFreetextAnalysisGeneration) {
        this.presenterFreetextLemmaPending.set(false);
      }
    }
  }

  private async publishPresenterFreetextWordCloud(): Promise<void> {
    const questionId = this.freetextQuestionId();
    const locale = this.presenterFreetextAnalysisLocale();
    if (!questionId) {
      return;
    }
    const mode = this.presenterFreetextWordCloudModeEffective();
    const analysis = this.freetextStageAnalysisEntries();
    const terms = this.freetextWordCloudTerms();
    const entries = analysis
      ? analysis.slice(0, 80).map((entry) => ({
          key: entry.key,
          label: entry.label,
          count: entry.count,
          ...(entry.labelOrigin ? { labelOrigin: entry.labelOrigin } : {}),
        }))
      : (terms ?? []).slice(0, 80).map((term) => ({
          key: term.key,
          label: term.label,
          count: term.sourceCount,
        }));
    try {
      await trpc.session.setFreetextWordCloudProjection.mutate({
        code: this.code.toUpperCase(),
        projection: {
          mode: mode === 'WORDS' ? 'LEXICAL' : mode === 'SEMANTIC' ? 'SEMANTIC' : 'THEME',
          locale,
          questionId,
          smoothingActive: this.presenterFreetextSmoothingPressed(),
          entries,
        },
      });
    } catch {
      // Die Bühne zeigt die gewählte Ansicht auch ohne gespeicherte Projektion.
    }
  }

  private async refreshFreetextWordCloudProjection(): Promise<void> {
    if (!this.showPresenterFreetextResultsStage() || this.presentDeadlineClosed) {
      return;
    }
    try {
      const result = await trpc.session.getFreetextWordCloudProjection.query({
        code: this.code.toUpperCase(),
      });
      if (this.presentDeadlineClosed) {
        return;
      }
      this.freetextWordCloudProjection.set(result.projection);
    } catch {
      // Ohne Projektion bleibt die bisherige lokale Phrasenwolke.
    }
  }

  private async refreshQuickFeedbackResult(): Promise<void> {
    const quickFeedbackEnabled = this.session()?.channels?.quickFeedback.enabled ?? false;
    if (!quickFeedbackEnabled || this.showFinishProjection() || this.presentDeadlineClosed) {
      this.presentQuickFeedbackRefreshEpoch += 1;
      this.quickFeedbackResult.set(null);
      return;
    }

    const refreshEpoch = ++this.presentQuickFeedbackRefreshEpoch;
    try {
      const result = await trpc.quickFeedback.results.query({
        sessionCode: this.code.toUpperCase(),
      });
      if (this.presentDeadlineClosed || refreshEpoch !== this.presentQuickFeedbackRefreshEpoch) {
        return;
      }
      this.quickFeedbackResult.set(result);
    } catch (error: unknown) {
      if (
        refreshEpoch === this.presentQuickFeedbackRefreshEpoch &&
        this.errorCode(error) === 'NOT_FOUND'
      ) {
        this.quickFeedbackResult.set(null);
      }
    }
  }

  private async refreshHostQuestion(): Promise<void> {
    if (
      !this.session() ||
      this.session()?.type === 'Q_AND_A' ||
      this.presentDeadlineClosed ||
      this.session()?.presenterSurface === 'qaWordCloud'
    ) {
      this.presentHostQuestionRefreshEpoch += 1;
      this.hostQuestion.set(null);
      this.stopCountdown();
      return;
    }
    const refreshEpoch = ++this.presentHostQuestionRefreshEpoch;
    try {
      const question = await trpc.session.getCurrentQuestionForHost.query(
        { code: this.code.toUpperCase() },
        { signal: AbortSignal.timeout(10000) },
      );
      if (this.presentDeadlineClosed || refreshEpoch !== this.presentHostQuestionRefreshEpoch) {
        return;
      }
      const session = this.session();
      const matches = presenterQuestionMatchesSession(
        question,
        session?.currentQuestion,
        session?.currentRound,
      );
      if (matches) {
        const gate = this.focusedQuestionGate();
        this.hostQuestion.set(question);
        this.quizQuestionLoadFailed.set(false);
        this.moveFocusFromQuestionGate(gate);
      } else if (question === null && this.quizQuestionAwaitingSnapshot()) {
        this.quizQuestionLoadFailed.set(true);
      }
      if (session?.status === 'ACTIVE' && matches) {
        this.startCountdown(question?.timer ?? null);
      } else if (!matches) {
        this.stopCountdown();
      }
    } catch {
      if (!this.destroyRef.destroyed && this.quizQuestionAwaitingSnapshot()) {
        this.quizQuestionLoadFailed.set(true);
      }
    }
  }

  private async refreshEmojiReactions(): Promise<void> {
    const session = this.session();
    const question = this.hostQuestion();
    if (
      !session?.enableEmojiReactions ||
      (session.status !== 'ACTIVE' && session.status !== 'RESULTS') ||
      !question
    ) {
      this.emojiReactionScope = null;
      this.emojiReactions.set(null);
      return;
    }

    const round = question.currentRound ?? 1;
    const scope = `${question.questionId}:r${round}`;
    if (this.emojiReactionScope !== scope) {
      this.emojiReactionScope = scope;
      this.emojiReactions.set(null);
    }

    try {
      const reactions = await trpc.session.getReactions.query({
        sessionId: session.id,
        questionId: question.questionId,
        round,
      });
      if (this.presentDeadlineClosed) return;
      this.emojiReactions.set(reactions);
    } catch {
      // Einzelner Live-Abruf: letzten Stand behalten; Meta-Poll und WS melden den Gesamtzustand.
    }
  }

  private async refreshHostVoteProgress(): Promise<void> {
    if (
      !this.hostQuestion() ||
      this.session()?.status !== 'ACTIVE' ||
      this.session()?.presenterSurface === 'qaWordCloud'
    ) {
      this.hostVoteProgress.set(null);
      return;
    }
    try {
      const progress = await trpc.session.getHostVoteProgress.query({
        code: this.code.toUpperCase(),
      });
      if (this.presentDeadlineClosed) return;
      this.hostVoteProgress.set(progress);
    } catch {
      // Einzelner Live-Abruf: letzten Stand behalten; Meta-Poll und WS melden den Gesamtzustand.
    }
  }

  private ensurePresenterSubscriptions(): void {
    if (this.destroyRef.destroyed || this.code.length !== 6) {
      return;
    }
    const code = this.code.toUpperCase();
    if (!this.presentDeadlineClosed && !this.showQaWordCloud()) {
      this.currentQuestionSub ??= trpc.session.onCurrentQuestionForHostChanged.subscribe(
        { code },
        {
          onData: (data) => {
            if (!this.presentDeadlineClosed) {
              this.presentHostQuestionRefreshEpoch += 1;
              const session = this.session();
              const matches = presenterQuestionMatchesSession(
                data,
                session?.currentQuestion,
                session?.currentRound,
              );
              const gate = matches ? this.focusedQuestionGate() : null;
              this.hostQuestion.set(data);
              if (matches) {
                this.quizQuestionLoadFailed.set(false);
                this.moveFocusFromQuestionGate(gate);
              }
            }
          },
          onError: () => {
            this.currentQuestionSub?.unsubscribe();
            this.currentQuestionSub = null;
          },
        },
      );
      this.voteProgressSub ??= trpc.session.onHostVoteProgressChanged.subscribe(
        { code },
        {
          onData: (data) => {
            if (!this.presentDeadlineClosed) {
              this.hostVoteProgress.set(data);
            }
          },
          onError: () => {
            this.voteProgressSub?.unsubscribe();
            this.voteProgressSub = null;
          },
        },
      );
    }
    this.statusSub ??= trpc.session.onStatusChanged.subscribe(
      { code, anonymousClientId: getAnonymousClientId() },
      {
        onData: (data) => {
          if (data.serverTime) {
            recordServerTimeSample(data.serverTime, Date.now());
          }
          if (data.serverNow) {
            recordServerTimeSample(data.serverNow, Date.now());
          }
          if (!this.applySessionDeadlineSnapshot(data)) {
            return;
          }
          this.presentSessionMetaRefreshEpoch += 1;
          this.session.update((current) =>
            current
              ? {
                  ...current,
                  status: data.status as SessionInfoDTO['status'],
                  currentQuestion: data.currentQuestion,
                  currentRound: data.currentRound ?? current.currentRound,
                  pausedFromStatus: data.pausedFromStatus ?? null,
                  preferredChannel: data.preferredChannel ?? current.preferredChannel,
                  presenterSurface: data.presenterSurface ?? current.presenterSurface,
                  presenterPage: data.presenterPage ?? current.presenterPage,
                  finishProjection:
                    data.status === 'FINISHED'
                      ? (data.finishProjection ?? current.finishProjection ?? 'leaderboard')
                      : undefined,
                }
              : current,
          );
          this.dropStalePresenterQuestion();
          this.moveFocusFromQuestionGate(this.focusedQuestionGate());
          this.syncCountdownFromStatus(data.timer, data.activeAt);
          this.resetPresentScrollForPhase(data.status);
          if (data.status === 'FINISHED') {
            if (data.finishProjection === 'idle') {
              this.personalLeaderboard.set([]);
              this.teamLeaderboard.set([]);
              this.finishBoardsResolved.set(true);
              this.syncBoardPageTimer();
            } else {
              this.finishBoardsResolved.set(false);
              void this.loadPresenterLeaderboards().finally(() => {
                this.finishBoardsResolved.set(true);
              });
            }
          } else if (data.status === 'RESULTS' && this.session()?.showLeaderboard !== false) {
            void this.loadPresenterLeaderboards();
          } else {
            this.personalLeaderboard.set([]);
            this.teamLeaderboard.set([]);
          }
        },
        onError: () => {
          this.statusSub?.unsubscribe();
          this.statusSub = null;
        },
      },
    );
  }

  /** Phasenwechsel: Beamer-Bühne immer an den Anfang setzen. */
  private resetPresentScrollForPhase(status: string | null | undefined): void {
    if (!status || status === this.previousPresentStatusForScroll) {
      return;
    }
    this.previousPresentStatusForScroll = status;
    if (this.destroyRef.destroyed) return;
    afterNextRender(
      () => {
        if (this.destroyRef.destroyed) return;
        scrollAppMainToTop(this.hostElement.nativeElement, 'auto');
        const view = this.document.defaultView;
        try {
          view?.scrollTo({ top: 0, behavior: 'auto' });
        } catch {
          if (view) {
            view.scrollTo(0, 0);
          }
        }
      },
      { injector: this.injector },
    );
  }

  private isDefinitiveSessionError(error: unknown): boolean {
    const candidate = error as
      | {
          message?: unknown;
          data?: { code?: unknown };
          shape?: { data?: { code?: unknown } };
        }
      | null
      | undefined;
    const code = candidate?.data?.code ?? candidate?.shape?.data?.code;
    if (code === 'NOT_FOUND' || code === 'UNAUTHORIZED') {
      return true;
    }
    const message = typeof candidate?.message === 'string' ? candidate.message : '';
    return (
      message.startsWith('NOT_FOUND:') ||
      message.startsWith('UNAUTHORIZED:') ||
      message.includes('Session nicht gefunden.')
    );
  }

  private errorCode(error: unknown): string | null {
    const candidate = error as
      | {
          message?: unknown;
          data?: { code?: unknown };
          shape?: { data?: { code?: unknown } };
        }
      | null
      | undefined;
    const code = candidate?.data?.code ?? candidate?.shape?.data?.code;
    if (typeof code === 'string') {
      return code;
    }
    const message = typeof candidate?.message === 'string' ? candidate.message : '';
    const match = /^([A-Z_]+):/.exec(message);
    return match?.[1] ?? null;
  }

  private syncCountdownFromStatus(
    timer: number | null | undefined,
    activeAt?: string | null,
  ): void {
    if (this.session()?.status !== 'ACTIVE') {
      this.stopCountdown();
      return;
    }
    this.startCountdown(timer ?? this.hostQuestion()?.timer ?? null, activeAt ?? undefined);
  }

  private startCountdown(timerSeconds: number | null | undefined, activeAt?: string): void {
    if (this.destroyRef.destroyed) return;
    if (!timerSeconds || timerSeconds <= 0) {
      this.stopCountdown();
      return;
    }
    const question = this.hostQuestion();
    const nextKey = `${question?.questionId ?? 'none'}:${question?.currentRound ?? 1}:${timerSeconds}`;
    const nextDeadline = stableCountdownDeadlineMs({
      timerSeconds,
      activeAt,
      currentDeadlineMs: this.countdownDeadlineMs,
      currentKey: this.countdownKey,
      nextKey,
    });
    const sameRun =
      this.countdownKey === nextKey &&
      this.countdownDeadlineMs !== null &&
      Math.abs(this.countdownDeadlineMs - nextDeadline) < 750;

    this.countdownKey = nextKey;
    this.countdownDeadlineMs = nextDeadline;

    if (sameRun && (this.countdownTimer !== null || remainingCountdownSeconds(nextDeadline) <= 0)) {
      const remaining = remainingCountdownSeconds(nextDeadline);
      this.countdownSeconds.set(remaining);
      return;
    }

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    const tick = (): void => {
      const deadline = this.countdownDeadlineMs;
      if (deadline === null) {
        return;
      }
      const remaining = remainingCountdownSeconds(deadline);
      this.countdownSeconds.set(remaining);
      if (remaining <= 0 && this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
    };
    tick();
    if ((this.countdownSeconds() ?? 0) > 0) {
      this.countdownTimer = setInterval(tick, 1000);
    }
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.countdownDeadlineMs = null;
    this.countdownKey = null;
    this.countdownSeconds.set(null);
  }

  private async refreshQuizAudience(): Promise<void> {
    const status = this.session()?.status;
    if (
      this.presentDeadlineClosed ||
      (status !== 'QUESTION_OPEN' && status !== 'ACTIVE') ||
      this.session()?.type === 'Q_AND_A'
    ) {
      this.quizAudience.set(null);
      return;
    }
    try {
      const payload = await trpc.session.getParticipantSummary.query({
        code: this.code.toUpperCase(),
      });
      if (this.presentDeadlineClosed || this.destroyRef.destroyed) {
        return;
      }
      this.quizAudience.set({
        participantCount: payload.participantCount,
        readingReady: payload.readingReady ?? null,
      });
    } catch {
      // Letzten Stand behalten; der Session-Zähler bleibt der Fallback.
    }
  }

  private async refreshLobbyAudience(): Promise<void> {
    if (!this.waitingLobbySession() || this.presentDeadlineClosed) {
      this.clearLobbyAudience();
      return;
    }

    const code = this.code.toUpperCase();
    const anonymousClientId = getAnonymousClientId();

    try {
      const payload = await trpc.session.getParticipantSummary.query({ code });
      if (this.presentDeadlineClosed) return;
      this.lobbyAudienceTotal.set(payload.participantCount);
      this.lobbyAudienceConnected.set(payload.connectedCount);
      this.applyLobbyParticipants(
        payload.recentArrivals.map((participant) => ({
          id: participant.id,
          nickname: participant.nickname,
          teamId: participant.teamId ?? null,
        })),
      );
    } catch {
      // Keep the last stable, bounded lobby snapshot if live lookups fail briefly.
    }

    if (this.session()?.teamMode === true) {
      try {
        const payload = await trpc.session.getTeams.query({ code, anonymousClientId });
        this.lobbyTeams.set(
          payload.teams.map((team) => ({
            id: team.id,
            name: team.name,
            color: team.color ?? null,
            memberCount: team.memberCount,
          })),
        );
      } catch {
        // Keep the last team snapshot on transient errors.
      }
    } else {
      this.lobbyTeams.set([]);
    }
  }

  private applyLobbyParticipants(participants: LobbyParticipant[]): void {
    const previousIds = this.knownLobbyParticipantIds;
    const nextIds = new Set(participants.map((participant) => participant.id));
    const newcomers = this.lobbyAudienceBaselineReady
      ? participants.filter((participant) => !previousIds.has(participant.id))
      : [];

    this.lobbyParticipants.set(participants);
    this.knownLobbyParticipantIds.clear();
    for (const id of nextIds) {
      this.knownLobbyParticipantIds.add(id);
    }
    this.lobbyAudienceBaselineReady = true;

    if (this.session()?.teamMode === true && this.suppressLobbyTeamFoyer()) {
      this.clearLobbyFoyerChips();
      return;
    }

    this.enqueueLobbyFoyerArrivals(newcomers, this.lobbyParticipantCount());
  }

  private enqueueLobbyFoyerArrivals(
    newcomers: LobbyParticipant[],
    totalParticipantCount: number,
  ): void {
    if (newcomers.length === 0 || !this.canShowLobbyFoyer()) {
      return;
    }

    const teamMode = this.session()?.teamMode === true;
    if (
      teamMode &&
      (totalParticipantCount >= TEAM_FOYER_SUPPRESSION_PARTICIPANT_THRESHOLD ||
        newcomers.length >= TEAM_FOYER_SUPPRESSION_BURST_THRESHOLD)
    ) {
      this.clearLobbyFoyerChips();
      return;
    }

    const dense = newcomers.length >= 3 || totalParticipantCount >= 16;
    const flyers = newcomers.slice(-LOBBY_FOYER_MAX_ACTIVE_CHIPS);
    const additions = flyers.map((participant) => this.createLobbyFoyerChip(participant, dense));
    const timedAdditions = teamMode
      ? this.withCalmTeamArrivalDelays(this.lobbyFoyerChips(), additions)
      : this.withCalmNonTeamArrivalDelays(this.lobbyFoyerChips(), additions);
    const limitedAdditions = timedAdditions.slice(-LOBBY_FOYER_MAX_ACTIVE_CHIPS);
    const keepCount = Math.max(0, LOBBY_FOYER_MAX_ACTIVE_CHIPS - limitedAdditions.length);

    this.lobbyFoyerChips.update((current) => {
      const kept = keepCount === 0 ? [] : current.slice(-keepCount);
      const keptIds = new Set(kept.map((chip) => chip.id));
      for (const [chipId, timer] of this.lobbyFoyerTimers) {
        if (!keptIds.has(chipId)) {
          clearTimeout(timer);
          this.lobbyFoyerTimers.delete(chipId);
        }
      }
      return [...kept, ...limitedAdditions];
    });

    for (const chip of limitedAdditions) {
      this.scheduleLobbyFoyerCleanup(chip.id, chip.delayMs);
      this.registerHiddenLobbyParticipant(chip.participantId, chip.presenceMs + chip.delayMs);
    }
  }

  private createLobbyFoyerChip(participant: LobbyParticipant, dense: boolean): FoyerEntranceChip {
    const session = this.session();
    const sequence = this.lobbyFoyerSequence++;
    const kindergartenEmoji =
      session?.nicknameTheme === 'KINDERGARTEN' && session.anonymousMode !== true
        ? findKindergartenNicknameEmoji(participant.nickname)
        : null;
    const label = buildFoyerChipLabel({
      nickname: participant.nickname,
      anonymousMode: session?.anonymousMode === true,
      kindergartenEmoji,
      dense,
      preferEmojiOnly: !!kindergartenEmoji,
      preferReadableText:
        session?.teamMode !== true ||
        (session?.allowCustomNicknames === false &&
          session?.anonymousMode !== true &&
          participant.nickname.trim().includes(' ')),
    });
    const teamMode = session?.teamMode === true && !!participant.teamId;

    return {
      ...label,
      id: `${participant.id}-${sequence}`,
      participantId: participant.id,
      teamId: participant.teamId,
      sequence,
      delayMs: 0,
      lane: this.nextLobbyFoyerLane(participant.teamId),
      direction: sequence % 2 === 0 ? 'left' : 'right',
      ...this.defaultLobbyFoyerMotionProfile(teamMode),
    };
  }

  private defaultLobbyFoyerMotionProfile(
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
    return {
      enterDurationMs: teamMode ? 1760 : 680,
      presenceMs: teamMode ? 3200 : this.foyerChipLifetimeMs,
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
      nextSlots.set(chip.teamId, Math.max(nextSlots.get(chip.teamId) ?? 0, scheduledDelay));
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

  private kindergartenArrivalMotionProfile(queueDepth: number): LobbyFoyerMotionProfile {
    if (queueDepth <= 0) {
      return {
        stepMs: LOBBY_FOYER_KINDERGARTEN_DELAY_STEP_MS,
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

  private teamArrivalPresentationStepMs(chip: Pick<FoyerEntranceChip, 'badgeDelayMs'>): number {
    return Math.max(
      LOBBY_FOYER_TEAM_DELAY_STEP_MS,
      chip.badgeDelayMs + LOBBY_FOYER_TEAM_PRESENTATION_BUFFER_MS,
    );
  }

  private nonTeamArrivalPresentationStepMs(
    chip: Pick<FoyerEntranceChip, 'enterDurationMs'>,
  ): number {
    return Math.max(
      LOBBY_FOYER_NON_TEAM_DELAY_STEP_MS,
      chip.enterDurationMs + LOBBY_FOYER_NON_TEAM_PRESENTATION_BUFFER_MS,
    );
  }

  private nextLobbyFoyerLane(teamId: string | null): number {
    if (!teamId) {
      const lane = this.lobbyFoyerLaneCursor % LOBBY_FOYER_LANE_COUNT;
      this.lobbyFoyerLaneCursor += 1;
      return lane;
    }

    const cursor = this.lobbyFoyerTeamLaneCursors.get(teamId) ?? 0;
    this.lobbyFoyerTeamLaneCursors.set(teamId, cursor + 1);
    return cursor % LOBBY_FOYER_LANE_COUNT;
  }

  private scheduleLobbyFoyerCleanup(chipId: string, delayMs = 0): void {
    const existing = this.lobbyFoyerTimers.get(chipId);
    if (existing) {
      clearTimeout(existing);
    }

    const chip = this.lobbyFoyerChips().find((currentChip) => currentChip.id === chipId);
    const lifetimeMs = chip?.presenceMs ?? this.foyerChipLifetimeMs;
    const timer = setTimeout(() => {
      this.lobbyFoyerChips.update((current) => current.filter((entry) => entry.id !== chipId));
      this.lobbyFoyerTimers.delete(chipId);
    }, lifetimeMs + delayMs);

    this.lobbyFoyerTimers.set(chipId, timer);
  }

  private registerHiddenLobbyParticipant(participantId: string | undefined, holdMs: number): void {
    if (!participantId) {
      return;
    }

    this.hiddenFoyerParticipantIds.update((current) => {
      const next = new Set(current);
      next.add(participantId);
      return next;
    });

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
      this.markLandedLobbyParticipant(participantId);
    }, holdMs);

    this.hiddenLobbyParticipantTimers.set(participantId, timer);
  }

  private markLandedLobbyParticipant(participantId: string): void {
    this.landedLobbyParticipantIds.update((current) => {
      const next = new Set(current);
      next.add(participantId);
      return next;
    });

    const existing = this.landedLobbyParticipantTimers.get(participantId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.landedLobbyParticipantIds.update((current) => {
        if (!current.has(participantId)) {
          return current;
        }
        const next = new Set(current);
        next.delete(participantId);
        return next;
      });
      this.landedLobbyParticipantTimers.delete(participantId);
    }, LOBBY_FOYER_LANDED_BADGE_MS);

    this.landedLobbyParticipantTimers.set(participantId, timer);
  }

  private clearLobbyFoyerChips(): void {
    for (const timer of this.lobbyFoyerTimers.values()) {
      clearTimeout(timer);
    }
    this.lobbyFoyerTimers.clear();
    for (const timer of this.hiddenLobbyParticipantTimers.values()) {
      clearTimeout(timer);
    }
    this.hiddenLobbyParticipantTimers.clear();
    for (const timer of this.landedLobbyParticipantTimers.values()) {
      clearTimeout(timer);
    }
    this.landedLobbyParticipantTimers.clear();
    this.lobbyFoyerSequence = 0;
    this.lobbyFoyerLaneCursor = 0;
    this.lobbyFoyerTeamLaneCursors.clear();
    this.lobbyFoyerChips.set([]);
    this.hiddenFoyerParticipantIds.set(new Set());
    this.landedLobbyParticipantIds.set(new Set());
  }

  private clearLobbyAudience(): void {
    this.clearLobbyFoyerChips();
    this.knownLobbyParticipantIds.clear();
    this.lobbyAudienceBaselineReady = false;
    this.lobbyParticipants.set([]);
    this.lobbyAudienceTotal.set(0);
    this.lobbyAudienceConnected.set(0);
    this.lobbyTeams.set([]);
  }

  onPresenterImageError(event: Event): void {
    const el = event.target;
    if (el instanceof HTMLElement) {
      el.remove();
    }
  }

  private async generateJoinQr(): Promise<void> {
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
      this.joinQrDataUrl.set(qr.createDataURL(8, 2));
    } catch {
      this.joinQrDataUrl.set('');
    }
  }

  private presenterQuestionLabel(
    questionOrder: number | null | undefined,
    questionText: string | null | undefined,
  ): string | null {
    if (questionOrder === null || questionOrder === undefined) {
      return null;
    }
    const heading = presenterQuestionHeading(questionText ?? '');
    const plainText = stripMarkdownToPlainText(heading);
    return $localize`Frage ${questionOrder + 1}:questionNumber:: ${plainText}:questionText:`;
  }
}
