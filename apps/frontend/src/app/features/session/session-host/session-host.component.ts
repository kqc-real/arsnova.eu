import { DecimalPipe, DOCUMENT, formatNumber } from '@angular/common';
import {
  getDocumentFullscreenElement,
  isDocumentFullscreenEnterAvailable,
  tryExitDocumentFullscreen,
  tryRequestDocumentFullscreen,
} from '../../../core/document-fullscreen.util';
import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  LOCALE_ID,
  OnDestroy,
  OnInit,
  ViewChild,
  afterNextRender,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { firstValueFrom } from 'rxjs';
import type { Unsubscribable } from '@trpc/server/observable';
import type { Subscription } from 'rxjs';
import { trpc } from '../../../core/trpc.client';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { SoundService } from '../../../core/sound.service';
import { HostDisplayModeService } from '../../../core/host-display-mode.service';
import { localizePath } from '../../../core/locale-router';
import { sessionCodeAriaLabel as i18nSessionCodeAria } from '../../../core/session-code-aria';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../../../shared/confirm-leave-dialog/confirm-leave-dialog.component';
import type {
  HostCurrentQuestionDTO,
  LeaderboardEntryDTO,
  QaQuestionDTO,
  QuickFeedbackResult,
  SessionFeedbackSummary,
  SessionInfoDTO,
  SessionParticipantsPayload,
  SessionStatusUpdate,
  TeamDTO,
  TeamLeaderboardEntryDTO,
} from '@arsnova/shared-types';
import { WordCloudComponent } from '../session-present/word-cloud.component';
import { CountdownFingersComponent } from '../../../shared/countdown-fingers/countdown-fingers.component';
import { remainingCountdownSeconds } from '../session-countdown.util';
import { recordServerTimeIso } from '../session-server-clock';
import { MusicEqualizerIconComponent } from '../../../shared/music-equalizer-icon/music-equalizer-icon.component';
import { FeedbackHostComponent } from '../../feedback/feedback-host.component';

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
const HOST_FALLBACK_POLL_MS = 3000;
type SessionChannelTab = 'quiz' | 'qa' | 'quickFeedback';
type HostMusicTrack =
  | 'LOBBY_0'
  | 'LOBBY_1'
  | 'LOBBY_2'
  | 'LOBBY_3'
  | 'CONNECTING_0'
  | 'COUNTDOWN_RUNNING_0'
  | 'COUNTDOWN_RUNNING_1'
  | 'COUNTDOWN_RUNNING_2';

type MusicPhase = 'lobby' | 'connecting' | 'running';

const PHASE_TRACK_DEFAULTS: Record<MusicPhase, HostMusicTrack> = {
  lobby: 'LOBBY_2',
  connecting: 'CONNECTING_0',
  running: 'COUNTDOWN_RUNNING_0',
};

const MUSIC_PHASE_STORAGE_KEY = 'arsnova-host-phase-tracks';

function loadPhaseTracksFromStorage(): Record<MusicPhase, HostMusicTrack> {
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(MUSIC_PHASE_STORAGE_KEY) : null;
    if (!raw) return { ...PHASE_TRACK_DEFAULTS };
    const parsed = JSON.parse(raw) as Record<string, string>;
    return {
      lobby: isValidTrack(parsed['lobby'])
        ? (parsed['lobby'] as HostMusicTrack)
        : PHASE_TRACK_DEFAULTS.lobby,
      connecting: isValidTrack(parsed['connecting'])
        ? (parsed['connecting'] as HostMusicTrack)
        : PHASE_TRACK_DEFAULTS.connecting,
      running: isValidTrack(parsed['running'])
        ? (parsed['running'] as HostMusicTrack)
        : PHASE_TRACK_DEFAULTS.running,
    };
  } catch {
    return { ...PHASE_TRACK_DEFAULTS };
  }
}

function isValidTrack(v: unknown): v is HostMusicTrack {
  return typeof v === 'string' && ALL_MUSIC_TRACK_VALUES.includes(v as HostMusicTrack);
}

const ALL_MUSIC_TRACKS: ReadonlyArray<{ value: HostMusicTrack; label: string }> = [
  { value: 'LOBBY_0', label: 'Lobby · Warm' },
  { value: 'LOBBY_1', label: 'Lobby · Drive' },
  { value: 'LOBBY_2', label: 'Lobby · Smooth' },
  { value: 'LOBBY_3', label: 'Lobby · Pulse' },
  { value: 'CONNECTING_0', label: 'Connecting · Build' },
  { value: 'COUNTDOWN_RUNNING_0', label: 'Running · Focus' },
  { value: 'COUNTDOWN_RUNNING_1', label: 'Running · Push' },
  { value: 'COUNTDOWN_RUNNING_2', label: 'Running · Intense' },
];
const ALL_MUSIC_TRACK_VALUES = ALL_MUSIC_TRACKS.map((t) => t.value);

function musicTracksForPhase(
  phase: MusicPhase,
): ReadonlyArray<{ value: HostMusicTrack; label: string }> {
  switch (phase) {
    case 'lobby':
      return ALL_MUSIC_TRACKS.filter((t) => t.value.startsWith('LOBBY_'));
    case 'connecting':
      return ALL_MUSIC_TRACKS.filter((t) => t.value.startsWith('CONNECTING_'));
    case 'running':
      return ALL_MUSIC_TRACKS.filter((t) => t.value.startsWith('COUNTDOWN_RUNNING_'));
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
    WordCloudComponent,
    CountdownFingersComponent,
    MusicEqualizerIconComponent,
    FeedbackHostComponent,
  ],
  templateUrl: './session-host.component.html',
  styleUrl: './session-host.component.scss',
})
export class SessionHostComponent implements OnInit, OnDestroy {
  readonly localizedPath = localizePath;
  session = signal<SessionInfoDTO | null>(null);
  /** Lobby: Live-Teilnehmerliste (Story 2.2). */
  readonly participantsPayload = signal<SessionParticipantsPayload | null>(null);
  /** Live-Status für Steuerung (Story 2.3). */
  readonly statusUpdate = signal<SessionStatusUpdate | null>(null);
  readonly controlPending = signal(false);
  readonly activeChannel = signal<SessionChannelTab>('quiz');
  readonly qaQuestions = signal<QaQuestionDTO[]>([]);
  readonly qaError = signal<string | null>(null);
  readonly qaInfo = signal<string | null>(null);
  readonly qaPendingQuestionIds = signal<Set<string>>(new Set());
  readonly qaSeenQuestionIds = signal<Set<string>>(new Set());
  readonly qaScrolledDown = signal(false);
  @ViewChild('qaListContainer') qaListContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('qaTitleInput') qaTitleInputRef?: ElementRef<HTMLInputElement>;
  readonly qaHighlightedQuestionIds = signal<Set<string>>(new Set());
  readonly quickFeedbackResult = signal<QuickFeedbackResult | null>(null);
  readonly quickFeedbackSeenVoteCount = signal(0);
  private participantSub: Unsubscribable | null = null;
  private statusSub: Unsubscribable | null = null;
  private qaSub: Unsubscribable | null = null;
  private presetSub: Subscription | null = null;
  private readonly document = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly themePreset = inject(ThemePresetService);
  readonly sound = inject(SoundService);
  private readonly hostDisplayMode = inject(HostDisplayModeService);
  private readonly dialog = inject(MatDialog);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
  private readonly requestedInitialTab = this.route.snapshot?.queryParamMap?.get('tab') ?? null;
  /** Nach einmaligem Anwenden von `?tab=` nicht erneut erzwingen (sonst kein Kanalwechsel möglich). */
  private initialUrlTabApplied = false;
  readonly freetextResponses = signal<string[]>([]);
  readonly wordCloudInfo = signal($localize`Warte auf Live-Freitextdaten …`);
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly exportStatus = signal<string | null>(null);
  readonly exportExporting = signal(false);
  readonly leaderboard = signal<LeaderboardEntryDTO[]>([]);
  readonly teamLeaderboard = signal<TeamLeaderboardEntryDTO[]>([]);
  readonly lobbyTeams = signal<TeamDTO[]>([]);
  readonly leaderboardLoading = signal(false);
  readonly feedbackSummary = signal<SessionFeedbackSummary | null>(null);
  /** Aktuelle Frage für Host (Text + Antwortoptionen), null wenn keine Frage aktiv. */
  readonly currentQuestionForHost = signal<HostCurrentQuestionDTO | null>(null);
  /** Emoji-Reaktionen der Teilnehmer in der Ergebnis-Phase (Story 5.8). */
  readonly emojiReactions = signal<{ reactions: Record<string, number>; total: number } | null>(
    null,
  );
  readonly emojiNewCount = signal(0);
  readonly emojiBadgePulse = signal(false);
  private emojiPulseTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEmojiQuestionId = '';
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
  readonly channels = computed(() => {
    const session = this.session();
    return {
      quiz: session?.channels?.quiz.enabled ?? session?.type === 'QUIZ',
      qa: session?.channels?.qa.enabled ?? session?.type === 'Q_AND_A',
      quickFeedback: session?.channels?.quickFeedback.enabled ?? false,
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
  readonly isLegacyQaOnlySession = computed(() => {
    const session = this.session();
    return (
      session?.type === 'Q_AND_A' && this.channels().quiz === false && this.channels().qa === true
    );
  });
  readonly showPrimaryLiveView = computed(() => {
    const active = this.activeChannel();
    if (active === 'quiz') {
      return this.channels().quiz;
    }

    if (active === 'qa' && this.isLegacyQaOnlySession()) {
      return true;
    }

    return false;
  });
  readonly isQaSession = computed(() => this.session()?.type === 'Q_AND_A');
  readonly isPlayfulPreset = computed(() => this.session()?.preset === 'PLAYFUL');
  readonly isRunningSession = computed(() => {
    const status = this.effectiveStatus();
    return this.session() !== null && status !== 'LOBBY' && status !== 'FINISHED';
  });
  /**
   * Quiz-Kanal: ACTIVE (z. B. nach Fragerunden-Start), aber noch keine Quiz-Frage – kein Voting,
   * daher keine „Ergebnis zeigen“-Steuerung; erste Frage explizit starten.
   */
  readonly isQuizAwaitingFirstQuestion = computed(() => {
    if (this.isQaSession()) return false;
    if (!this.channels().quiz) return false;
    if (this.effectiveStatus() !== 'ACTIVE') return false;
    return this.currentQuestionForHost() === null;
  });
  readonly isImmersiveMode = computed(() => this.hostDisplayMode.immersiveHostActive());
  readonly isFullscreenSupported = computed(() =>
    isDocumentFullscreenEnterAvailable(this.document),
  );
  readonly isFullscreenActive = signal(false);
  readonly musicPhases: ReadonlyArray<{ id: MusicPhase; label: string }> = [
    { id: 'lobby', label: $localize`:@@sessionHost.phaseLobbyShort:Lobby` },
    { id: 'connecting', label: $localize`:@@sessionHost.phaseConnectingShort:Beitritt` },
    { id: 'running', label: $localize`:@@sessionHost.phaseRunningShort:Countdown` },
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
    if (status === 'QUESTION_OPEN') return 'connecting';
    if (status === 'ACTIVE') return 'running';
    return null;
  });
  readonly activeMusicTrack = computed<HostMusicTrack | null>(() => {
    if (this.musicMuted()) return null;
    if (this.countdownSfxPhase() || this.countdownEnded()) return null;
    const phase = this.currentMusicPhase();
    if (!phase) return null;
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

    if (session.type === 'Q_AND_A') {
      return (
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
  readonly qaShowPinnedOnly = signal(false);
  readonly qaFilteredQuestions = computed(() => {
    const all = this.qaQuestions();
    return this.qaShowPinnedOnly() ? all.filter((q) => q.status === 'PINNED') : all;
  });
  readonly qaPinnedCount = computed(
    () => this.qaQuestions().filter((q) => q.status === 'PINNED').length,
  );
  readonly qaPendingCount = computed(
    () => this.qaQuestions().filter((question) => question.status === 'PENDING').length,
  );
  readonly qaArchivedCount = computed(
    () => this.qaQuestions().filter((q) => q.status === 'ARCHIVED').length,
  );
  readonly qaDeletedCount = computed(
    () => this.qaQuestions().filter((q) => q.status === 'DELETED').length,
  );
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
    const participantMap = new Map<string, string[]>();

    for (const participant of participants) {
      if (!participant.teamId || !participant.nickname) {
        continue;
      }
      const names = participantMap.get(participant.teamId) ?? [];
      if (showNames) {
        names.push(participant.nickname);
      }
      participantMap.set(participant.teamId, names);
    }

    return teams.map((team) => ({
      ...team,
      participants: participantMap.get(team.id) ?? [],
    }));
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
    if (q.type === 'RATING') return q.ratingCount ?? 0;
    if (q.type === 'FREETEXT') return q.freeTextResponses?.length ?? 0;
    return q.totalVotes ?? 0;
  }

  readonly allHaveVoted = computed(() => {
    if (this.effectiveStatus() !== 'ACTIVE') return false;
    const participants = this.participantsPayload()?.participantCount ?? 0;
    if (participants <= 0) return false;
    const votes = this.getVoteCountForCurrentQuestion(this.currentQuestionForHost());
    return votes >= participants;
  });

  private previousStatus: string | null = null;
  private priorLobbyForAutoJoinMenu = false;
  private priorQrReadyForJoinMenu = false;
  /** Verhindert geplantes Öffnen des Join-Menüs nach ngOnDestroy (z. B. Vitest). */
  private suppressJoinMenuAutopen = false;
  /** Beitritts-Dialog (QR): volles Viewport-Overlay, mittig (Smartphone-Scanner). */
  readonly joinInfoPopoverOpen = signal(false);

  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      this.ensureActiveChannel();
    });
    effect(() => {
      if (this.allHaveVoted()) {
        this.stopCountdown();
        this.countdownSeconds.set(null);
        this.sound.stopAllSfx();
      }
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
      this.hostDisplayMode.setHostSessionActive(this.isRunningSession());
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
    return ANSWER_COLORS[index % ANSWER_COLORS.length];
  }
  getShape(index: number): string {
    return ANSWER_SHAPES[index % ANSWER_SHAPES.length];
  }
  getLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  ratingBarRange(q: HostCurrentQuestionDTO): number[] {
    const min = q.ratingMin ?? 1;
    const max = q.ratingMax ?? 5;
    const range: number[] = [];
    for (let i = min; i <= max; i++) range.push(i);
    return range;
  }

  /** Verteilung der Sterne als lesbare Zeile (z. B. "1× 4 ★ · 2× 5 ★"). */
  getFeedbackDistributionLine(dist: Record<string, number>): string | null {
    if (!dist || Object.keys(dist).length === 0) return null;
    const parts: string[] = [];
    for (let star = 1; star <= 5; star++) {
      const n = dist[String(star)] ?? 0;
      if (n > 0) parts.push(`${n}× ${star} ★`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  /** Für Lobby: volle Beitritts-URL (präsentierbar, Story 2.1b QR-Code). */
  get joinUrl(): string {
    const origin =
      typeof this.document?.defaultView?.location?.origin === 'string'
        ? this.document.defaultView.location.origin
        : '';
    return origin ? `${origin}/join/${this.code}` : `/join/${this.code}`;
  }

  toggleJoinInfoPopover(): void {
    this.joinInfoPopoverOpen.update((v) => !v);
  }

  closeJoinInfoPopover(): void {
    this.joinInfoPopoverOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydownCloseJoinPopover(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape' || !this.joinInfoPopoverOpen()) {
      return;
    }
    this.closeJoinInfoPopover();
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
    try {
      const session = await trpc.session.getInfo.query({ code: this.code.toUpperCase() });
      recordServerTimeIso(session.serverTime);
      this.session.set(session);
      this.syncQaTitleDraftFromSession();
      await this.refreshParticipantsPayload();
      await this.refreshLobbyTeams();
      await this.refreshQaQuestions();
      await this.refreshQuickFeedbackResult();
      if (session.preset === 'PLAYFUL' || session.preset === 'SERIOUS') {
        this.themePreset.setPreset(session.preset === 'PLAYFUL' ? 'spielerisch' : 'serious', {
          silent: true,
        });
      }
    } catch {
      this.session.set(null);
    }

    await this.generateQrCode();
    await this.refreshLiveFreetext();
    await this.refreshCurrentQuestionForHost();
    this.syncMusic();
    this.pollTimer = setInterval(() => {
      void this.refreshServerClockSkew();
      void this.refreshParticipantsPayload();
      void this.refreshLiveFreetext();
      void this.refreshCurrentQuestionForHost();
      void this.refreshEmojiReactions();
      void this.refreshLobbyTeams();
      void this.refreshQuickFeedbackResult();
      this.syncMusic();
    }, HOST_FALLBACK_POLL_MS);
    this.syncMusic();

    if (this.code.length === 6) {
      this.participantSub = trpc.session.onParticipantJoined.subscribe(
        { code: this.code.toUpperCase() },
        {
          onData: (data) => {
            this.participantsPayload.set(data);
            void this.refreshLobbyTeams();
          },
          onError: () => {},
        },
      );
      this.statusSub = trpc.session.onStatusChanged.subscribe(
        { code: this.code.toUpperCase() },
        {
          onData: (data) => {
            if (data.serverTime) {
              recordServerTimeIso(data.serverTime);
            }
            this.statusUpdate.set({
              status: data.status as SessionStatusUpdate['status'],
              currentQuestion: data.currentQuestion,
              activeAt: data.activeAt,
            });
          },
          onError: () => {},
        },
      );

      if (this.channels().qa && this.session()?.id) {
        this.qaSub = trpc.qa.onQuestionsUpdated.subscribe(
          { sessionId: this.session()!.id, moderatorView: true },
          {
            onData: (data) => {
              this.qaQuestions.set(data);
              this.qaError.set(null);
            },
            onError: () => {},
          },
        );
      }

      this.presetSub = this.themePreset.presetChanged$.subscribe(() => {
        const preset =
          this.themePreset.preset() === 'serious' ? ('SERIOUS' as const) : ('PLAYFUL' as const);
        void trpc.session.updatePreset.mutate({ code: this.code.toUpperCase(), preset });
      });

      this.document.addEventListener('click', this.unlockListener, { once: true });
      this.document.addEventListener('keydown', this.unlockListener, { once: true });
    }
  }

  private unlockListener = (): void => {
    this.sound.unlock();
    this.document.removeEventListener('click', this.unlockListener);
    this.document.removeEventListener('keydown', this.unlockListener);
  };

  /** Periodische Kalibrierung gegen die Serverzeit (Health), falls keine Status-Events kommen. */
  private async refreshServerClockSkew(): Promise<void> {
    try {
      const h = await trpc.health.check.query();
      recordServerTimeIso(h.timestamp);
    } catch {
      /* ignorieren */
    }
  }

  ngOnDestroy(): void {
    this.suppressJoinMenuAutopen = true;
    this.hostDisplayMode.setHostSessionActive(false);
    this.participantSub?.unsubscribe();
    this.participantSub = null;
    this.statusSub?.unsubscribe();
    this.statusSub = null;
    this.qaSub?.unsubscribe();
    this.qaSub = null;
    this.presetSub?.unsubscribe();
    this.presetSub = null;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
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
    if (this.isSessionActive()) {
      event.preventDefault();
    }
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

  /** Prüft, ob die Session noch läuft (nicht FINISHED und nicht null). */
  private isSessionActive(): boolean {
    const status = this.effectiveStatus();
    return status !== null && status !== 'FINISHED';
  }

  /**
   * CanDeactivate-Guard-Hook: zeigt einen Bestätigungsdialog,
   * wenn die Session noch läuft.
   */
  async canDeactivate(): Promise<boolean> {
    if (!this.isSessionActive()) return true;

    const status = this.effectiveStatus();
    const participants = this.participantsPayload()?.participantCount ?? 0;

    const consequences: string[] = [
      $localize`Die Session läuft im Hintergrund weiter – Teilnehmende bleiben verbunden.`,
      $localize`Du verlierst die Steuerung (nächste Frage, Timer, Ergebnisse zeigen).`,
    ];
    if (participants > 0) {
      consequences.push($localize`${participants} Teilnehmende warten auf deine Steuerung.`);
    }
    if (status === 'ACTIVE' || status === 'QUESTION_OPEN') {
      consequences.push(
        $localize`Die aktuelle Frage bleibt offen – kein automatisches Weiterschalten.`,
      );
    }

    const dialogRef = this.dialog.open(ConfirmLeaveDialogComponent, {
      data: {
        title: $localize`Session verlassen?`,
        message: $localize`Deine Session ist noch aktiv.`,
        consequences,
        confirmLabel: $localize`Trotzdem verlassen`,
        cancelLabel: $localize`Zurück zur Session`,
        onCancelUserGesture: () => this.tryEnterHostFullscreenFromUserGesture(),
      } satisfies ConfirmLeaveDialogData,
      width: 'min(26rem, calc(100vw - 1.5rem))',
      maxWidth: '100vw',
      autoFocus: 'dialog',
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return result === true;
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
    if (v === 'lobby' || v === 'connecting' || v === 'running') {
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

  async exportFreetextSessionCsv(): Promise<void> {
    try {
      const data = await trpc.session.getFreetextSessionExport.query({
        code: this.code.toUpperCase(),
      });
      const rows = ['questionOrder,questionText,response,count'];
      for (const entry of data.entries) {
        for (const aggregate of entry.aggregates) {
          rows.push(
            [
              entry.questionOrder + 1,
              escapeCsv(entry.questionText),
              escapeCsv(aggregate.text),
              aggregate.count,
            ].join(','),
          );
        }
      }
      const content = rows.join('\n');
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = this.document.createElement('a');
      anchor.href = url;
      anchor.download = `freetext-session_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      this.exportStatus.set($localize`Session-CSV exportiert.`);
    } catch {
      this.exportStatus.set($localize`Session-CSV konnte nicht exportiert werden.`);
    }
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

  /** i18n: Singular label for participant count. */
  participantLabelSingular(): string {
    return $localize`Teilnehmer`;
  }
  /** i18n: Plural label for participant count. */
  participantLabelPlural(): string {
    return $localize`Teilnehmende`;
  }

  teamMemberLabel(count: number): string {
    return count === 1 ? $localize`${count} Mitglied` : $localize`${count} Mitglieder`;
  }

  lobbyTeamEmptyLabel(): string {
    return $localize`Noch niemand in diesem Team.`;
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

  /** Label „X von Y hat/haben geantwortet“ mit korrekter Pluralform. */
  freetextRespondedLabel(count: number, total: number | undefined): string {
    const totalStr = total !== undefined && total !== null ? String(total) : '?';
    if (count === 1) {
      return $localize`${count} von ${totalStr} hat geantwortet`;
    }
    return $localize`${count} von ${totalStr} haben geantwortet`;
  }

  /** Ergebnisansicht: „X von Y hat/haben abgestimmt“ (Plural nach Anzahl abgegebener Stimmen). */
  votesCastLabel(votes: number, participantTotal: number | null | undefined): string {
    const totalStr =
      participantTotal !== undefined && participantTotal !== null ? String(participantTotal) : '?';
    if (votes === 1) {
      return $localize`:@@sessionHost.votesCastOne:${votes}:voteCount: von ${totalStr}:participantTotal: hat abgestimmt`;
    }
    return $localize`:@@sessionHost.votesCastMany:${votes}:voteCount: von ${totalStr}:participantTotal: haben abgestimmt`;
  }

  /** Bewertungsfrage Ergebnis: „X von Y hat/haben bewertet“. */
  ratingSubmittedLabel(count: number, participantTotal: number | null | undefined): string {
    const totalStr =
      participantTotal !== undefined && participantTotal !== null ? String(participantTotal) : '?';
    if (count === 1) {
      return $localize`:@@sessionHost.ratingSubmittedOne:${count}:voteCount: von ${totalStr}:participantTotal: hat bewertet`;
    }
    return $localize`:@@sessionHost.ratingSubmittedMany:${count}:voteCount: von ${totalStr}:participantTotal: haben bewertet`;
  }

  /** Multiple-Choice-Ergebnis: korrekt gewählte Antworten inkl. Prozent. */
  correctAllVotersLabel(correct: number, total: number): string {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return $localize`:@@sessionHost.correctAllVoters:${correct}:correctCount: von ${total}:voteTotal: komplett richtig (${pct}:percentage:\u00a0%)`;
  }

  opinionShiftChangedMindLabel(changed: number, both: number, pct: number): string {
    return $localize`:@@sessionHost.opinionShiftChangedMind:${changed}:changed: von ${both}:both: (${pct}:pct:\u00a0%) änderten ihre Meinung`;
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

  private async refreshLobbyTeams(): Promise<void> {
    if (!this.session()?.teamMode) {
      this.lobbyTeams.set([]);
      return;
    }

    try {
      const payload = await trpc.session.getTeams.query({ code: this.code.toUpperCase() });
      this.lobbyTeams.set(payload.teams);
    } catch {
      this.lobbyTeams.set([]);
    }
  }

  private async refreshParticipantsPayload(): Promise<void> {
    if (!this.code) {
      this.participantsPayload.set(null);
      return;
    }
    try {
      const payload = await trpc.session.getParticipants.query({ code: this.code.toUpperCase() });
      this.participantsPayload.set(payload);
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

  effectiveCurrentQuestion(): number | null {
    const su = this.statusUpdate();
    return su?.currentQuestion ?? null;
  }

  /** True, wenn die aktuelle Frage die letzte ist – dann zeigt der Steuerungs-Button „Session beenden“. */
  isLastQuestion(): boolean {
    const q = this.currentQuestionForHost();
    if (!q || q.totalQuestions === null || q.totalQuestions === undefined) return false;
    return q.order + 1 >= q.totalQuestions;
  }

  /** Markdown + KaTeX für Frage- und Antworttexte (wie Quiz-Vorschau). */
  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdownWithKatex(value).html);
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
      return $localize`:@@sessionTabs.questionsBadgeNew:${this.qaUnseenCount()}:count: neu`;
    }

    if (this.qaQuestions().length > 0) {
      return String(this.qaQuestions().length);
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

  channelTabMetaLabel(channel: SessionChannelTab): string | null {
    if (channel === 'qa') {
      return this.qaTabMetaLabel();
    }
    if (channel === 'quickFeedback') {
      return this.quickFeedbackTabMetaLabel();
    }
    return null;
  }

  isChannelBadgeAlert(channel: SessionChannelTab): boolean {
    if (channel === 'qa') {
      return this.activeChannel() !== 'qa' && this.qaUnseenCount() > 0;
    }
    if (channel === 'quickFeedback') {
      return this.activeChannel() !== 'quickFeedback' && this.quickFeedbackUnseenCount() > 0;
    }
    return false;
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
    const el = this.qaListContainerRef?.nativeElement;
    if (el) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.qaScrolledDown.set(false);
    const allIds = new Set(this.qaQuestions().map((q) => q.id));
    this.qaSeenQuestionIds.set(allIds);
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

  selectChannel(channel: string): void {
    if (channel === 'quiz' || channel === 'qa' || channel === 'quickFeedback') {
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
    }
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
    this.qaError.set(null);
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
          title: s.type === 'Q_AND_A' ? result.title : s.title,
          channels: {
            ...s.channels,
            qa: { ...s.channels.qa, title: displayTitle },
          },
        };
      });
      this.syncQaTitleDraftFromSession();
      this.qaTitleEditing.set(false);
    } catch {
      this.qaError.set(
        $localize`:@@sessionHost.qaTitleSaveError:Titel konnte nicht gespeichert werden.`,
      );
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
    try {
      this.clearEmojiNewBadge();
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.nextQuestion.mutate({ code: this.code.toUpperCase() });
      this.currentQuestionForHost.set(null);
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
      if (result.status === 'ACTIVE') {
        this.startCountdown(this.currentQuestionForHost()?.timer, result.activeAt);
      }
    } finally {
      this.controlPending.set(false);
    }
  }

  async startQa(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      const result = await trpc.session.startQa.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      this.currentQuestionForHost.set(null);
    } finally {
      this.controlPending.set(false);
    }
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

    const urlTab = this.requestedInitialTab;
    if (
      !this.initialUrlTabApplied &&
      (urlTab === 'qa' || urlTab === 'quickFeedback') &&
      visible.includes(urlTab)
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
      const questions = await trpc.qa.list.query({ sessionId, moderatorView: true });
      this.qaQuestions.set(questions);
      this.qaError.set(null);
    } catch {
      this.qaError.set($localize`:@@sessionQa.hostLoadError:Fragen konnten nicht geladen werden.`);
    }
  }

  private async refreshQuickFeedbackResult(): Promise<void> {
    if (!this.channels().quickFeedback || this.code.length !== 6) {
      this.quickFeedbackResult.set(null);
      this.quickFeedbackSeenVoteCount.set(0);
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
    } catch {
      this.qaError.set(
        $localize`:@@sessionQa.moderationToggleError:Moderation konnte nicht umgeschaltet werden.`,
      );
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
    this.qaError.set(null);
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
    } catch {
      this.qaError.set(
        $localize`:@@sessionQa.moderationError:Moderationsaktion konnte nicht ausgeführt werden.`,
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
      const result = await trpc.session.revealAnswers.mutate({ code: this.code.toUpperCase() });
      this.currentQuestionForHost.set(null);
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
      this.startCountdown(this.currentQuestionForHost()?.timer, result.activeAt);
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
      await this.refreshCurrentQuestionForHost();
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
      await this.refreshCurrentQuestionForHost();
    } finally {
      this.controlPending.set(false);
    }
  }

  async startSecondRound(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.clearEmojiNewBadge();
      const result = await trpc.session.startSecondRound.mutate({ code: this.code.toUpperCase() });
      this.currentQuestionForHost.set(null);
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
      this.startCountdown(this.currentQuestionForHost()?.timer, result.activeAt);
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
    const qid = this.currentQuestionForHost()?.questionId;
    if (!sid || !qid) {
      this.emojiReactions.set(null);
      this.clearEmojiNewBadge();
      this.lastEmojiQuestionId = '';
      return;
    }
    if (this.lastEmojiQuestionId !== qid) {
      this.lastEmojiQuestionId = qid;
      this.clearEmojiNewBadge();
    }
    try {
      const previousTotal = this.emojiReactions()?.total ?? 0;
      const data = await trpc.session.getReactions.query({ sessionId: sid, questionId: qid });
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
      this.loadFeedbackSummary();
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
    const sid = this.session()?.id;
    if (!sid || this.exportExporting()) return;
    this.exportStatus.set(null);
    this.exportExporting.set(true);
    try {
      const data = await trpc.session.getExportData.query({ sessionId: sid });
      const rows: string[] = [$localize`Frage Nr.;Fragentext;Typ;Teilnehmer;Ø Punkte;Details`];

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
        }

        rows.push(
          [
            q.questionOrder + 1,
            escapeCsv(stripMarkdownToPlainText(q.questionTextShort)),
            q.type,
            q.participantCount,
            q.averageScore ?? '',
            escapeCsv(details),
          ].join(';'),
        );
      }

      if (data.bonusTokens && data.bonusTokens.length > 0) {
        rows.push('');
        rows.push('Bonus-Codes');
        rows.push('Rang;Nickname;Code;Punkte;Generiert am');
        for (const t of data.bonusTokens) {
          rows.push(`${t.rank};${t.nickname};${t.token};${t.totalScore};${t.generatedAt}`);
        }
      }

      const csv = '\uFEFF' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = this.document.createElement('a');
      a.href = url;
      a.download = `ergebnis-export-${data.sessionCode}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      this.exportStatus.set($localize`Ergebnis-CSV exportiert.`);
    } catch {
      this.exportStatus.set($localize`Export fehlgeschlagen.`);
    } finally {
      this.exportExporting.set(false);
    }
  }

  async endSession(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.end.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      this.currentQuestionForHost.set(null);
    } finally {
      this.controlPending.set(false);
    }
  }

  private async refreshCurrentQuestionForHost(): Promise<void> {
    if (!this.code || this.code.length !== 6) return;
    try {
      const q = await trpc.session.getCurrentQuestionForHost.query({
        code: this.code.toUpperCase(),
      });
      this.currentQuestionForHost.set(q);
    } catch {
      this.currentQuestionForHost.set(null);
    }
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
        this.currentQuestionLabel.set(
          data.questionOrder !== null
            ? $localize`Frage ${data.questionOrder + 1}:questionNumber:: ${data.questionText ?? ''}:questionText:`
            : null,
        );
        this.wordCloudInfo.set($localize`Aktuelle Frage ist keine Freitext-Frage.`);
      } else {
        this.currentQuestionLabel.set(null);
        this.wordCloudInfo.set($localize`Noch keine aktive Frage.`);
      }
    } catch {
      this.wordCloudInfo.set($localize`Live-Freitextdaten konnten nicht geladen werden.`);
    }
  }
}

/** Markdown/KaTeX für CSV-Export in lesbaren Fließtext umwandeln. */
function stripMarkdownToPlainText(s: string): string {
  const t = s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/^#+\s*/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
