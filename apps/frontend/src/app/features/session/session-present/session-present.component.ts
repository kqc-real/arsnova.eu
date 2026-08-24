import { DecimalPipe } from '@angular/common';
import {
  Component,
  LOCALE_ID,
  OnDestroy,
  OnInit,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { WordCloudComponent } from './word-cloud.component';
import { SessionProjectionQuizComponent } from './session-projection-quiz.component';
import type { Unsubscribable } from '@trpc/server/observable';
import { HostDisplayModeService } from '../../../core/host-display-mode.service';
import { remainingCountdownSeconds, stableCountdownDeadlineMs } from '../session-countdown.util';
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
import type {
  HostCurrentQuestionDTO,
  HostVoteProgressDTO,
  LeaderboardEntryDTO,
  QaQuestionDTO,
  QuickFeedbackResult,
  SessionInfoDTO,
  TeamLeaderboardEntryDTO,
} from '@arsnova/shared-types';
import { recordServerTimeSample } from '../session-server-clock';
import { localizePath, resolveLocalizedJoinUrl } from '../../../core/locale-router';
import { formatLocaleCount, formatLocalePercent } from '../../../core/locale-number.util';
import {
  getEffectiveLocale,
  localeIdToSupported,
  type SupportedLocale,
} from '../../../core/locale-from-path';
import { stripMarkdownToPlainText } from '../../../core/markdown-plain-text.util';
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
import { getWordCloudWeightFromUpvotes } from './word-cloud.util';
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

/**
 * Beamer-Ansicht / Presenter-Mode (Epic 2).
 * Story 2.5, 2.6, 3.5, 4.1, 4.4, 4.5, 1.14, 7.1, 8.2, 8.3.
 */
@Component({
  selector: 'app-session-present',
  standalone: true,
  imports: [
    DecimalPipe,
    MatButton,
    MatCard,
    MatCardContent,
    MatIcon,
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
  private readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
  private readonly onVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.stopPolling();
      this.stopBoardPageTimer();
      return;
    }
    this.startPolling();
    void this.refreshSessionMeta();
    void this.refreshPresenterLiveData();
  };
  readonly localizedPath = localizePath;

  readonly session = signal<SessionInfoDTO | null>(null);
  readonly personalLeaderboard = signal<LeaderboardEntryDTO[]>([]);
  private readonly personalBoardPageIndex = signal(0);
  readonly teamLeaderboard = signal<TeamLeaderboardEntryDTO[]>([]);
  readonly pinnedQaQuestion = signal<QaQuestionDTO | null>(null);
  readonly presenterQaQuestions = signal<QaQuestionDTO[]>([]);
  readonly quickFeedbackResult = signal<QuickFeedbackResult | null>(null);
  readonly freetextResponses = signal<string[]>([]);
  readonly freetextQuestionId = signal<string | null>(null);
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly hostQuestion = signal<HostCurrentQuestionDTO | null>(null);
  readonly hostVoteProgress = signal<HostVoteProgressDTO | null>(null);
  readonly joinQrDataUrl = signal('');
  readonly countdownSeconds = signal<number | null>(null);
  private currentQuestionSub: Unsubscribable | null = null;
  private voteProgressSub: Unsubscribable | null = null;
  private statusSub: Unsubscribable | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private countdownDeadlineMs: number | null = null;
  private countdownKey: string | null = null;
  readonly joinUrl = resolveLocalizedJoinUrl(this.code);
  readonly sessionCode = this.code;
  readonly showHomeCta = signal(false);
  readonly presenterInfo = signal($localize`Warte auf Live-Freitextdaten …`);
  readonly presenterFreetextActive = signal(false);
  readonly freetextWordCloudEyebrow = $localize`:@@sessionWordCloud.freetextEyebrow:Live-Freitext`;
  readonly freetextWordCloudDescription = $localize`:@@sessionWordCloud.freetextDescription:Häufige Wörter aus den Antworten.`;
  readonly freetextWordCloudStageTitle = computed(
    () => this.currentQuestionLabel() ?? $localize`:@@wordCloud.title:Wortwolke`,
  );
  readonly qaWordCloudEyebrow = $localize`:@@sessionWordCloud.qaEyebrow:Q&A-Analyse`;
  readonly qaWordCloudDescription = $localize`:@@sessionWordCloud.qaDescription:Zeigt, welche Wörter und Phrasen in den sichtbaren Q&A-Fragen dominieren.`;
  readonly qaWordCloudTitle = $localize`:@@sessionQa.wordCloudTitle:Q&A-Wortwolke`;
  readonly qaWordCloudItemSingular = $localize`:@@sessionQa.wordCloudItemSingular:Frage`;
  readonly qaWordCloudItemPlural = $localize`:@@sessionQa.wordCloudItemPlural:Fragen`;
  readonly qaWordCloudWeightingHint = $localize`:@@sessionWordCloud.qaHint:Große Wörter und Phrasen kommen aus häufiger genannten oder stärker unterstützten Fragen.`;
  readonly isPlayfulPreset = computed(() => this.themePreset.preset() === 'spielerisch');
  readonly lobbyParticipants = signal<LobbyParticipant[]>([]);
  readonly lobbyTeams = signal<LobbyTeam[]>([]);
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
    const people = [...this.lobbyParticipants()].reverse();
    const hideNames = this.session()?.anonymousMode === true;
    const hiddenIds = this.hiddenLobbyParticipantIds();
    return this.lobbyTeams().map((team) => ({
      ...team,
      members: hideNames
        ? []
        : people.filter((person) => person.teamId === team.id && !hiddenIds.has(person.id)),
    }));
  });
  readonly lobbyPeople = computed(() => {
    if (this.lobbyTeams().length > 0) {
      return [];
    }
    const hiddenIds = this.hiddenLobbyParticipantIds();
    return [...this.lobbyParticipants()].reverse().filter((person) => !hiddenIds.has(person.id));
  });
  readonly lobbyParticipantCount = computed(() => {
    const listed = this.lobbyParticipants().length;
    const fromSession = this.session()?.participantCount ?? 0;
    const fromTeams = this.lobbyTeams().reduce((sum, team) => sum + team.memberCount, 0);
    return Math.max(listed, fromSession, fromTeams);
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
  readonly showSecondaryPresentSurfaces = computed(() => !this.showFinishProjection());
  readonly showPinnedQaQuestion = computed(
    () => this.pinnedQaQuestion() !== null && this.showSecondaryPresentSurfaces(),
  );
  readonly showQaQueue = computed(
    () => this.presenterQaQuestions().length > 0 && this.showSecondaryPresentSurfaces(),
  );
  readonly visibleQaQueueQuestions = computed(() => this.presenterQaQuestions().slice(0, 6));
  readonly showQaWordCloud = computed(
    () => this.presenterQaWordCloudQuestions().length > 0 && this.showSecondaryPresentSurfaces(),
  );
  readonly wordCloudTermLocale = computed<SupportedLocale>(() =>
    getEffectiveLocale(localeIdToSupported(this.localeId)),
  );
  readonly freetextWordCloudTerms = computed<WordCloudTerm[]>(() =>
    this.wordCloudTermExtractor.extractTerms(
      this.freetextResponses().map((response, index) => ({
        id: `response-${index}`,
        body: response,
      })),
      {
        locale: this.wordCloudTermLocale(),
        maxEntries: 80,
        maxNgramLength: 3,
      },
    ),
  );
  readonly presenterQaWordCloudQuestions = computed(() => {
    const questions: QaQuestionDTO[] = [];
    const pinned = this.pinnedQaQuestion();
    if (pinned) {
      questions.push(pinned);
    }
    return [...questions, ...this.presenterQaQuestions()];
  });
  readonly presenterQaWordCloudResponses = computed(() =>
    this.presenterQaWordCloudQuestions().map((question) => question.text),
  );
  readonly presenterQaWordCloudTermDocuments = computed<WordCloudTermDocument[]>(() =>
    this.presenterQaWordCloudQuestions().map((question) => ({
      id: question.id,
      title: question.text,
      weight: getWordCloudWeightFromUpvotes(question.upvoteCount),
    })),
  );
  readonly presenterQaWordCloudTerms = computed<WordCloudTerm[]>(() =>
    this.wordCloudTermExtractor.extractTerms(this.presenterQaWordCloudTermDocuments(), {
      locale: this.wordCloudTermLocale(),
      maxEntries: 80,
      maxNgramLength: 3,
    }),
  );
  readonly presenterQaWordCloudWeightedResponses = computed(() =>
    this.presenterQaWordCloudQuestions().map((question) => ({
      text: question.text,
      weight: getWordCloudWeightFromUpvotes(question.upvoteCount),
    })),
  );
  readonly showQuickFeedbackCard = computed(
    () => this.quickFeedbackResult() !== null && this.showSecondaryPresentSurfaces(),
  );
  readonly showPresenterFreetextStage = computed(() => {
    if (
      !this.presenterFreetextActive() ||
      this.showFinishProjection() ||
      this.showLobbyProjection()
    ) {
      return false;
    }
    const channel = this.session()?.preferredChannel;
    return channel !== 'qa' && channel !== 'quickFeedback';
  });
  readonly showPresenterFreetextResultsStage = computed(() => {
    if (!this.showPresenterFreetextStage()) {
      return false;
    }
    if (!this.hostQuestion()) {
      return true;
    }
    return this.session()?.status === 'RESULTS';
  });
  readonly showFinishProjection = computed(() => this.session()?.status === 'FINISHED');
  readonly showTeamFinish = computed(() => {
    const session = this.session();
    return (
      session?.teamMode === true &&
      session.status === 'FINISHED' &&
      this.teamLeaderboard().length > 0
    );
  });
  readonly showLobbyProjection = computed(
    () => this.session()?.status === 'LOBBY' && !this.showFinishProjection(),
  );
  readonly hasLobbyAudienceColumns = computed(
    () => this.lobbyTeamsView().length > 0 || this.lobbyPeople().length > 0,
  );
  readonly showQuizProjection = computed(() => {
    if (this.showFinishProjection() || this.showLobbyProjection()) {
      return false;
    }
    const session = this.session();
    if (!session || session.type === 'Q_AND_A') {
      return false;
    }
    if (session.preferredChannel === 'qa' || session.preferredChannel === 'quickFeedback') {
      return false;
    }
    return this.hostQuestion() !== null;
  });
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
  readonly personalBoardDensity = computed(() => {
    const count = this.personalLeaderboard().length;
    if (count > 36) {
      return 'dense' as const;
    }
    if (count > 16) {
      return 'compact' as const;
    }
    return 'comfortable' as const;
  });

  static columnCountForParticipantTotal(count: number): number {
    if (count <= 6) return 2;
    if (count <= 12) return 3;
    if (count <= 20) return 4;
    if (count <= 32) return 5;
    if (count <= 48) return 6;
    if (count <= 72) return 8;
    if (count <= 96) return 10;
    return 12;
  }

  private static readonly BOARD_PAGE_ROWS = 18;
  private static readonly BOARD_PAGE_MS = 8_000;

  static pageSizeForParticipantTotal(count: number): number {
    return this.columnCountForParticipantTotal(count) * this.BOARD_PAGE_ROWS;
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
  readonly personalBoardPageCount = computed(() => {
    const total = this.personalLeaderboard().length;
    const size = SessionPresentComponent.pageSizeForParticipantTotal(total);
    return Math.max(1, Math.ceil(total / size));
  });
  readonly personalBoardPageLabel = computed(() => {
    const total = this.personalLeaderboard().length;
    const size = SessionPresentComponent.pageSizeForParticipantTotal(total);
    if (total <= size) {
      return null;
    }
    const pages = Math.max(1, Math.ceil(total / size));
    const page = ((this.personalBoardPageIndex() % pages) + pages) % pages;
    const start = page * size + 1;
    const end = Math.min(total, (page + 1) * size);
    return $localize`:@@sessionPresent.leaderboardPage:${start}:start:–${end}:end: von ${total}:total:`;
  });
  readonly quickFeedbackEntries = computed(() => {
    const data = this.quickFeedbackResult();
    if (!data) {
      return [];
    }

    const order = feedbackResultOrder(data.type);
    return order.map((key) => ({ key, value: data.distribution[key] ?? 0 }));
  });

  async ngOnInit(): Promise<void> {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (this.code.length !== 6) {
      this.showHomeCta.set(true);
      this.presenterInfo.set($localize`Ungültiger Session-Code.`);
      return;
    }

    this.hostDisplayMode.setHostSessionActive(true);
    await this.refreshSessionMeta();
    await this.refreshPresenterLiveData();
    this.ensurePresenterSubscriptions();
    this.startPolling();
    void this.generateJoinQr();
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.stopPolling();
    this.stopBoardPageTimer();
    this.stopCountdown();
    this.currentQuestionSub?.unsubscribe();
    this.voteProgressSub?.unsubscribe();
    this.statusSub?.unsubscribe();
    this.clearLobbyAudience();
    this.hostDisplayMode.setHostSessionActive(false);
  }

  private startPolling(): void {
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
    if (this.showFinishProjection()) {
      await this.loadFinishLeaderboards();
      return;
    }
    this.stopBoardPageTimer();
    await this.refreshLiveFreetext();
    await this.refreshQaQuestions();
    await this.refreshQuickFeedbackResult();
    await this.refreshHostQuestion();
    await this.refreshHostVoteProgress();
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

  private async refreshSessionMeta(): Promise<void> {
    try {
      const requestedAt = Date.now();
      const session = await trpc.session.getInfoForReconnect.query({
        code: this.code.toUpperCase(),
        anonymousClientId: getAnonymousClientId(),
      });
      recordServerTimeSample(session.serverTime, requestedAt);
      this.showHomeCta.set(false);
      this.session.set(session);
      if (session.status === 'FINISHED') {
        await this.loadFinishLeaderboards();
        return;
      }
      this.personalLeaderboard.set([]);
      this.teamLeaderboard.set([]);
    } catch (error: unknown) {
      this.session.set(null);
      this.showHomeCta.set(true);
      this.presenterInfo.set(localizeKnownServerError(error, sessionNotFoundUiMessage()));
      this.personalLeaderboard.set([]);
      this.teamLeaderboard.set([]);
      this.clearLobbyAudience();
    }
  }

  private async loadFinishLeaderboards(): Promise<void> {
    const code = this.code.toUpperCase();
    const anonymousClientId = getAnonymousClientId();
    try {
      const [personal, teams] = await Promise.all([
        trpc.session.getLeaderboard.query({ code, anonymousClientId }),
        trpc.session.getTeamLeaderboard.query({ code, anonymousClientId }),
      ]);
      this.personalLeaderboard.set(personal);
      this.teamLeaderboard.set(teams);
    } catch {
      this.personalLeaderboard.set([]);
      this.teamLeaderboard.set([]);
    }
    this.syncBoardPageTimer();
  }

  private syncBoardPageTimer(): void {
    if (!this.showFinishProjection() || this.personalBoardPageCount() <= 1) {
      this.stopBoardPageTimer();
      this.personalBoardPageIndex.set(0);
      return;
    }
    if (this.boardPageTimer !== null) {
      return;
    }
    this.boardPageTimer = setInterval(() => {
      const pages = this.personalBoardPageCount();
      if (pages <= 1) {
        this.stopBoardPageTimer();
        this.personalBoardPageIndex.set(0);
        return;
      }
      this.personalBoardPageIndex.update((index) => (index + 1) % pages);
    }, SessionPresentComponent.BOARD_PAGE_MS);
  }

  private stopBoardPageTimer(): void {
    if (this.boardPageTimer !== null) {
      clearInterval(this.boardPageTimer);
      this.boardPageTimer = null;
    }
  }

  private async refreshLiveFreetext(): Promise<void> {
    if (!this.session()) {
      return;
    }

    try {
      const data = await trpc.session.getLiveFreetext.query({ code: this.code.toUpperCase() });
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
      this.freetextQuestionId.set(null);
      this.presenterFreetextActive.set(false);
      this.presenterInfo.set($localize`Live-Freitextdaten konnten nicht geladen werden.`);
    }
  }

  private async refreshQaQuestions(): Promise<void> {
    const sessionId = this.session()?.id;
    const qaEnabled = this.session()?.channels?.qa.enabled ?? this.session()?.type === 'Q_AND_A';
    if (!sessionId || !qaEnabled || this.showFinishProjection()) {
      this.pinnedQaQuestion.set(null);
      this.presenterQaQuestions.set([]);
      return;
    }

    try {
      const questions = await trpc.qa.list.query({ sessionId });
      const visibleQuestions = questions.filter(
        (question) => question.status === 'PINNED' || question.status === 'ACTIVE',
      );
      const pinned = visibleQuestions.find((question) => question.status === 'PINNED') ?? null;
      const queue = visibleQuestions.filter((question) => question.status === 'ACTIVE');
      this.pinnedQaQuestion.set(pinned);
      this.presenterQaQuestions.set(queue);
    } catch {
      this.pinnedQaQuestion.set(null);
      this.presenterQaQuestions.set([]);
    }
  }

  private async refreshQuickFeedbackResult(): Promise<void> {
    const quickFeedbackEnabled = this.session()?.channels?.quickFeedback.enabled ?? false;
    if (!quickFeedbackEnabled || this.showFinishProjection()) {
      this.quickFeedbackResult.set(null);
      return;
    }

    try {
      const result = await trpc.quickFeedback.results.query({
        sessionCode: this.code.toUpperCase(),
      });
      this.quickFeedbackResult.set(result);
    } catch {
      this.quickFeedbackResult.set(null);
    }
  }

  private async refreshHostQuestion(): Promise<void> {
    if (!this.session() || this.session()?.type === 'Q_AND_A') {
      this.hostQuestion.set(null);
      this.stopCountdown();
      return;
    }
    try {
      const question = await trpc.session.getCurrentQuestionForHost.query({
        code: this.code.toUpperCase(),
      });
      this.hostQuestion.set(question);
      if (this.session()?.status === 'ACTIVE') {
        this.startCountdown(question?.timer ?? null);
      } else {
        this.stopCountdown();
      }
    } catch {
      this.hostQuestion.set(null);
    }
  }

  private async refreshHostVoteProgress(): Promise<void> {
    if (!this.hostQuestion() || this.session()?.status !== 'ACTIVE') {
      this.hostVoteProgress.set(null);
      return;
    }
    try {
      this.hostVoteProgress.set(
        await trpc.session.getHostVoteProgress.query({ code: this.code.toUpperCase() }),
      );
    } catch {
      this.hostVoteProgress.set(null);
    }
  }

  private ensurePresenterSubscriptions(): void {
    if (this.code.length !== 6) {
      return;
    }
    const code = this.code.toUpperCase();
    this.currentQuestionSub ??= trpc.session.onCurrentQuestionForHostChanged.subscribe(
      { code },
      {
        onData: (data) => this.hostQuestion.set(data),
        onError: () => {
          this.currentQuestionSub?.unsubscribe();
          this.currentQuestionSub = null;
        },
      },
    );
    this.voteProgressSub ??= trpc.session.onHostVoteProgressChanged.subscribe(
      { code },
      {
        onData: (data) => this.hostVoteProgress.set(data),
        onError: () => {
          this.voteProgressSub?.unsubscribe();
          this.voteProgressSub = null;
        },
      },
    );
    this.statusSub ??= trpc.session.onStatusChanged.subscribe(
      { code, anonymousClientId: getAnonymousClientId() },
      {
        onData: (data) => {
          if (data.serverTime) {
            recordServerTimeSample(data.serverTime, Date.now());
          }
          this.session.update((current) =>
            current
              ? {
                  ...current,
                  status: data.status as SessionInfoDTO['status'],
                  currentQuestion: data.currentQuestion,
                  preferredChannel: data.preferredChannel ?? current.preferredChannel,
                }
              : current,
          );
          this.syncCountdownFromStatus(data.timer, data.activeAt);
          if (data.status === 'FINISHED') {
            void this.loadFinishLeaderboards();
          }
        },
        onError: () => {
          this.statusSub?.unsubscribe();
          this.statusSub = null;
        },
      },
    );
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
      this.countdownSeconds.set(remainingCountdownSeconds(nextDeadline));
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

  private async refreshLobbyAudience(): Promise<void> {
    if (this.session()?.status !== 'LOBBY') {
      this.clearLobbyAudience();
      return;
    }

    const code = this.code.toUpperCase();
    const anonymousClientId = getAnonymousClientId();

    try {
      const payload = await trpc.session.getParticipants.query({ code });
      this.applyLobbyParticipants(
        payload.participants.map((participant) => ({
          id: participant.id,
          nickname: participant.nickname,
          teamId: participant.teamId ?? null,
        })),
      );
    } catch {
      try {
        const payload = await trpc.session.getParticipantNicknames.query({
          code,
          anonymousClientId,
        });
        this.applyLobbyParticipants(
          payload.nicknames.map((nickname) => ({
            id: `nick:${nickname}`,
            nickname,
            teamId: null,
          })),
        );
      } catch {
        // Keep the last stable lobby snapshot if live lookups fail briefly.
      }
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
      preferEmojiOnly: session?.teamMode === true && !!kindergartenEmoji,
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
    const plainText = stripMarkdownToPlainText(questionText ?? '');
    return $localize`Frage ${questionOrder + 1}:questionNumber:: ${plainText}:questionText:`;
  }
}
