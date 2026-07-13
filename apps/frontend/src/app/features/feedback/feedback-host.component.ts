import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  HostListener,
  Injector,
  LOCALE_ID,
  NgZone,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { clearFeedbackHostToken, setFeedbackHostToken } from '../../core/feedback-host-token';
import { formatLocaleCount, formatLocalePercent } from '../../core/locale-number.util';
import { clearHostToken } from '../../core/host-session-token';
import { trpc } from '../../core/trpc.client';
import {
  localizeCommands,
  localizePath,
  resolveLocalizedAppUrl,
  resolveLocalizedJoinUrl,
} from '../../core/locale-router';
import { sessionCodeAriaLabel as i18nSessionCodeAria } from '../../core/session-code-aria';
import { MarkdownImageLightboxDirective } from '../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import {
  feedbackDisplayIcon,
  feedbackDisplayLabel,
  feedbackResultOrder,
  feedbackTitle,
  isTempoFeedbackType,
  QUICK_FEEDBACK_PRESET_CHIPS,
  QUICK_FEEDBACK_TEMPO_SPOTLIGHT,
  tempoTrendEmoji,
  tempoTrendLabel,
  tempoTrendTone,
} from './feedback.config';
import type { QuickFeedbackResult, QuickFeedbackType } from '@arsnova/shared-types';
import type { Unsubscribable } from '@trpc/server/observable';

type StarAverageIcon = 'star' | 'star_half' | 'star_border';
type TempoViewMode = 'details' | 'trend';

interface StarAverageSummary {
  scoreLabel: string;
  icons: readonly StarAverageIcon[];
  totalVotes: number;
}

@Component({
  selector: 'app-feedback-host',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MatCard,
    MatCardContent,
    MatButton,
    MatIconButton,
    MatIcon,
    MarkdownImageLightboxDirective,
  ],
  templateUrl: './feedback-host.component.html',
  styleUrls: ['../../shared/styles/dialog-title-header.scss', './feedback-host.component.scss'],
  host: {
    class: 'feedback-host-shell',
    '[class.feedback-host-shell--embedded]': 'embeddedInSession()',
  },
})
export class FeedbackHostComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly snackBar = inject(MatSnackBar);
  private readonly document = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID) as string;
  private readonly injector = inject(Injector);
  private subscription: Unsubscribable | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  readonly sessionCode = input('');
  readonly embeddedInSession = input(false);

  readonly code = computed(() =>
    (this.sessionCode() || (this.route.snapshot.paramMap.get('code') ?? '')).toUpperCase(),
  );
  readonly result = signal<QuickFeedbackResult | null>(null);
  readonly qrDataUrl = signal<string>('');
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);
  readonly resetting = signal(false);
  readonly locked = signal(false);
  readonly tempoViewMode = signal<TempoViewMode>('details');
  private priorFeedbackHadResultForMenu = false;
  private priorFeedbackQrReadyForMenu = false;
  private suppressFeedbackJoinMenuAutopen = false;
  readonly feedbackJoinPopoverOpen = signal(false);
  readonly showEmbeddedEmptyState = computed(
    () => this.embeddedInSession() && this.result() === null,
  );
  readonly showStandaloneBottomActionBar = computed(
    () => !this.embeddedInSession() && this.result() !== null && this.isStandaloneFeedbackRoute(),
  );
  readonly presetChips = QUICK_FEEDBACK_PRESET_CHIPS;
  readonly tempoSpotlight = QUICK_FEEDBACK_TEMPO_SPOTLIGHT;
  readonly tempoHostSpotlightEyebrow = $localize`:@@feedback.tempoHostSpotlightEyebrow:Live-Rückmeldung`;
  readonly tempoHostSpotlightActionLabel = $localize`:@@feedback.tempoHostSpotlightAction:Starten`;
  readonly tempoHostActiveLabel = $localize`:@@feedback.tempoHostActiveLabel:Läuft`;
  readonly tempoHelpTriggerAria = $localize`:@@feedback.tempoHelpTriggerAria:Tempo-Barometer erklären`;
  readonly tempoHelpTitle = $localize`:@@feedback.tempoHelpTitle:Tempo-Barometer`;
  readonly tempoHelpDefaultText = $localize`:@@feedback.tempoHelpDefault:Schweigen gilt als Zustimmung – alle Aktiven starten bei 🙂. Nur wer abweicht, tippt etwas anderes.`;
  readonly tempoHelpSignalRows: { emoji: string; action: string }[] = [
    { emoji: '🙂', action: $localize`:@@feedback.tempoHelpRowFollowing:Gruppe folgt` },
    { emoji: '🐢', action: $localize`:@@feedback.tempoHelpRowTooFast:Tempo drosseln` },
    { emoji: '🐇', action: $localize`:@@feedback.tempoHelpRowTooSlow:Tempo erhöhen` },
    { emoji: '🙈', action: $localize`:@@feedback.tempoHelpRowLost:Innehalten, direkt ansprechen` },
    {
      emoji: '🐇🐢',
      action: $localize`:@@feedback.tempoHelpRowHeterogeneous:Gruppe gespalten – beide Seiten abholen`,
    },
    { emoji: '🤷', action: $localize`:@@feedback.tempoHelpRowUnclear:Noch kein klares Bild` },
  ];
  readonly tempoHelpThresholdText = $localize`:@@feedback.tempoHelpThreshold:Das Signal erscheint ab drei Aktiven und reagiert mit etwa 15 Sekunden Verzögerung. Kurz abwarten, bevor Sie anpassen.`;
  readonly tempoHelpBasisText = $localize`:@@feedback.tempoHelpBasis:Bei 🙈 kurz pausieren – das zeigt Stärke, nicht Schwäche. Bei 🐇🐢 explizit beide Lager ansprechen.`;
  readonly tempoHelpSmoothingText = $localize`:@@feedback.tempoHelpSmoothing:🤷 bedeutet: Das Signal ist noch unscharf. Einfach weitermachen – das klärt sich nach kurzer Zeit.`;
  readonly tempoHelpCloseAria = $localize`:@@feedback.tempoHelpCloseAria:Hilfe schließen`;
  readonly tempoHelpCloseLabel = $localize`:@@feedback.tempoHelpClose:Verstanden`;
  readonly tempoHelpOpen = signal(false);

  sessionCodeDisplayAria(code: string): string {
    return i18nSessionCodeAria(code);
  }

  constructor() {
    /** Wie Session-Host Lobby: Beitritts-Menü mit QR nach Laden einmal automatisch öffnen. */
    effect(() => {
      if (this.embeddedInSession()) {
        return;
      }
      const hasResult = this.result() !== null;
      const hasQr = this.qrDataUrl().length > 0;
      const entered = hasResult && !this.priorFeedbackHadResultForMenu;
      const qrReady = hasResult && hasQr && !this.priorFeedbackQrReadyForMenu;

      if (entered || qrReady) {
        afterNextRender(
          () => {
            if (
              this.suppressFeedbackJoinMenuAutopen ||
              !this.result() ||
              this.embeddedInSession()
            ) {
              return;
            }
            queueMicrotask(() => {
              if (this.suppressFeedbackJoinMenuAutopen) {
                return;
              }
              try {
                this.feedbackJoinPopoverOpen.set(true);
              } catch {
                /* Menü/Trigger ggf. noch nicht im DOM (Tests, schnelle Navigation) */
              }
            });
          },
          { injector: this.injector },
        );
      }

      this.priorFeedbackHadResultForMenu = hasResult;
      this.priorFeedbackQrReadyForMenu = hasQr;
    });
  }

  get joinUrl(): string {
    const code = this.code();
    return this.embeddedInSession()
      ? resolveLocalizedJoinUrl(code)
      : resolveLocalizedAppUrl(`/feedback/${code}/vote`);
  }

  /** Hostname für Join-Menü, analog Session-Host. */
  toggleFeedbackJoinPopover(): void {
    this.feedbackJoinPopoverOpen.update((v) => !v);
  }

  closeFeedbackJoinPopover(): void {
    this.feedbackJoinPopoverOpen.set(false);
  }

  /** Wie Session-Host Kanal Blitzlicht: Beitritts-URL (hier Vote-Link) kopieren. */
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

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydownCloseFeedbackJoinPopover(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') {
      return;
    }
    if (this.tempoHelpOpen()) {
      this.closeTempoHelp();
      ev.preventDefault();
      return;
    }
    if (this.feedbackJoinPopoverOpen()) {
      this.closeFeedbackJoinPopover();
      ev.preventDefault();
    }
  }

  joinOriginForMenu(): string {
    const url = this.joinUrl;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return new URL(url).host;
      }
    } catch {
      /* ungültige URL */
    }
    const host = this.document.defaultView?.location?.host;
    return typeof host === 'string' && host.length > 0 ? host : '';
  }

  private isStandaloneFeedbackRoute(): boolean {
    return this.document.defaultView?.location?.pathname?.includes('/feedback/') ?? false;
  }

  async ngOnInit(): Promise<void> {
    await this.generateQrCode();
    await this.loadInitialResult();
    this.startPolling();
    if (this.result()) {
      this.subscribeToResults();
    }
  }

  ngOnDestroy(): void {
    this.suppressFeedbackJoinMenuAutopen = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private startPolling(): void {
    if (this.pollTimer || !this.code()) {
      return;
    }
    this.pollTimer = setInterval(() => {
      // Embedded in the session host: keep a light HTTP fallback even with an active WS subscription.
      // This closes WS gaps where the first live result update does not arrive until a full reload.
      if (this.subscription && !this.embeddedInSession()) {
        return;
      }
      void this.loadInitialResult();
    }, 3000);
  }

  /** Erste Daten per HTTP laden, damit die Seite nicht auf die WebSocket-Subscription warten muss. */
  private async loadInitialResult(): Promise<void> {
    const code = this.code();
    if (!code) {
      return;
    }

    try {
      const data = await trpc.quickFeedback.hostResults.query({ sessionCode: code });
      this.applyHostResult(data);
      this.error.set(null);
      if (!this.subscription) {
        this.subscribeToResults();
      }
    } catch {
      this.result.set(null);
      this.locked.set(false);
      if (!this.embeddedInSession()) {
        clearFeedbackHostToken(code);
      }
      this.error.set(
        this.embeddedInSession() ? null : $localize`Feedback-Runde nicht gefunden oder abgelaufen.`,
      );
    }
  }

  private subscribeToResults(): void {
    const code = this.code();
    if (!code || this.subscription) {
      return;
    }

    this.subscription = trpc.quickFeedback.onHostResults.subscribe(
      { sessionCode: code },
      {
        onData: (data) => {
          this.applyHostResult(data);
          this.error.set(null);
        },
        onError: () => {
          this.subscription?.unsubscribe();
          this.subscription = null;
          if (!this.embeddedInSession()) {
            this.error.set($localize`Feedback-Runde nicht gefunden oder abgelaufen.`);
          }
        },
      },
    );
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
      const url = qr.createDataURL(8, 2);
      this.qrDataUrl.set(url);
    } catch {
      // best-effort
    }
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.joinUrl);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Clipboard not available
    }
  }

  async toggleLock(): Promise<void> {
    const code = this.code();
    if (!code) {
      return;
    }

    try {
      const res = await trpc.quickFeedback.toggleLock.mutate({ sessionCode: code });
      this.locked.set(res.locked);
    } catch {
      // best-effort
    }
  }

  lockToggleLabel(): string {
    return this.locked() ? $localize`Fortsetzen` : $localize`Stopp`;
  }

  lockToggleAriaLabel(): string {
    return this.locked() ? $localize`Abstimmung fortsetzen` : $localize`Abstimmung einfrieren`;
  }

  standalonePrimaryActionKind(): 'second-round' | 'discussion' | 'lock-toggle' {
    const data = this.result();
    if (!data) {
      return 'lock-toggle';
    }
    if (isTempoFeedbackType(data.type)) {
      return 'lock-toggle';
    }
    if (this.isDiscussion()) {
      return 'second-round';
    }
    if (!this.isRound2() && data.totalVotes > 0) {
      return 'discussion';
    }
    return 'lock-toggle';
  }

  standalonePrimaryActionLabel(): string {
    switch (this.standalonePrimaryActionKind()) {
      case 'second-round':
        return $localize`Zweite Abstimmung`;
      case 'discussion':
        return $localize`:@@feedback.compareRoundLabel:Vergleichsrunde`;
      default:
        return this.lockToggleLabel();
    }
  }

  standalonePrimaryActionAriaLabel(): string {
    switch (this.standalonePrimaryActionKind()) {
      case 'second-round':
        return $localize`Zweite Abstimmung starten`;
      case 'discussion':
        return $localize`:@@feedback.compareRoundStartAria:Vergleichsrunde starten`;
      default:
        return this.lockToggleAriaLabel();
    }
  }

  standalonePrimaryActionIcon(): string {
    switch (this.standalonePrimaryActionKind()) {
      case 'second-round':
        return 'replay';
      case 'discussion':
        return 'groups';
      default:
        return this.locked() ? 'play_arrow' : 'stop';
    }
  }

  async runStandalonePrimaryAction(): Promise<void> {
    switch (this.standalonePrimaryActionKind()) {
      case 'second-round':
        await this.startSecondRound();
        return;
      case 'discussion':
        await this.startDiscussion();
        return;
      default:
        await this.toggleLock();
    }
  }

  readonly isDiscussion = computed(() => !!this.result()?.discussion);
  readonly isRound2 = computed(() => (this.result()?.currentRound ?? 1) === 2);
  readonly hasComparison = computed(() => !!this.result()?.round1Distribution && this.isRound2());

  readonly round1Entries = computed(() => {
    const data = this.result();
    if (!data?.round1Distribution) return [];
    const order = feedbackResultOrder(data.type);
    return order.map((key) => ({ key, value: data.round1Distribution![key] ?? 0 }));
  });

  readonly currentStarAverage = computed(() => {
    const data = this.result();
    if (!data || data.type !== 'STARS') {
      return null;
    }
    return this.starAverage(data.distribution, data.totalVotes);
  });

  readonly round1StarAverage = computed(() => {
    const data = this.result();
    if (!data?.round1Distribution || data.type !== 'STARS') {
      return null;
    }
    return this.starAverage(data.round1Distribution, data.round1Total ?? 0);
  });

  readonly round2StarAverage = computed(() => {
    const data = this.result();
    if (!data || data.type !== 'STARS') {
      return null;
    }
    return this.starAverage(data.distribution, data.totalVotes);
  });

  round1PercentageValue(key: string): number {
    const data = this.result();
    if (!data?.round1Distribution || !data.round1Total) return 0;
    const count = data.round1Distribution[key] ?? 0;
    return data.round1Total > 0 ? Math.round((count / data.round1Total) * 100) : 0;
  }

  round1PercentageLabel(key: string): string {
    return formatLocalePercent(this.round1PercentageValue(key), this.localeId, 0);
  }

  round1Count(key: string): number {
    return this.result()?.round1Distribution?.[key] ?? 0;
  }

  round2PercentageValue(key: string): number {
    const data = this.result();
    if (!data || data.totalVotes === 0) return 0;
    const count = data.distribution[key] ?? 0;
    return data.totalVotes > 0 ? Math.round((count / data.totalVotes) * 100) : 0;
  }

  round2PercentageLabel(key: string): string {
    return formatLocalePercent(this.round2PercentageValue(key), this.localeId, 0);
  }

  round2Count(key: string): number {
    return this.result()?.distribution[key] ?? 0;
  }

  comparisonRound1Label(totalVotes: number): string {
    const votes = this.feedbackVoteCountLabel(totalVotes);
    return $localize`:@@feedback.compareRound1WithVotes:Runde 1 (${votes}:votes:)`;
  }

  comparisonRound2Label(totalVotes: number): string {
    const votes = this.feedbackVoteCountLabel(totalVotes);
    return $localize`:@@feedback.compareRound2WithVotes:Runde 2 (${votes}:votes:)`;
  }

  feedbackVoteCountLabel(totalVotes: number): string {
    if (totalVotes === 1) {
      return $localize`:@@feedback.voteCountOne:1 Stimme`;
    }
    return $localize`:@@feedback.voteCountMany:${formatLocaleCount(totalVotes, this.localeId)}:count: Stimmen`;
  }

  tempoParticipantCountLabel(totalVotes: number): string {
    if (totalVotes === 1) {
      return $localize`:@@feedback.tempoParticipantCountOne:1 Person im Barometer`;
    }
    return $localize`:@@feedback.tempoParticipantCountMany:${formatLocaleCount(totalVotes, this.localeId)}:count: Teilnehmende im Barometer`;
  }

  openTempoHelp(event?: Event): void {
    event?.stopPropagation();
    this.tempoHelpOpen.set(true);
  }

  closeTempoHelp(): void {
    this.tempoHelpOpen.set(false);
  }

  async startDiscussion(): Promise<void> {
    const code = this.code();
    if (!code) {
      return;
    }

    try {
      await trpc.quickFeedback.startDiscussion.mutate({ sessionCode: code });
    } catch {
      // best-effort
    }
  }

  async startSecondRound(): Promise<void> {
    const code = this.code();
    if (!code) {
      return;
    }

    try {
      await trpc.quickFeedback.startSecondRound.mutate({ sessionCode: code });
    } catch {
      // best-effort
    }
  }

  async resetRound(): Promise<void> {
    const code = this.code();
    if (!code || this.resetting()) {
      return;
    }

    this.resetting.set(true);
    try {
      await trpc.quickFeedback.reset.mutate({ sessionCode: code });
    } catch {
      // best-effort
    } finally {
      this.resetting.set(false);
    }
  }

  endSession(): void {
    const code = this.code();
    if (!code) {
      return;
    }

    const ref = this.snackBar.open(
      this.embeddedInSession()
        ? $localize`:@@feedback.endSessionWarning:Eine zweite Vergleichsrunde ist dann nicht mehr möglich. Es werden alle Ergebnisse gelöscht.`
        : $localize`:@@feedback.endStandaloneWarning:Das Blitzlicht wird beendet. Es werden alle Ergebnisse gelöscht.`,
      $localize`:@@feedback.endSessionConfirm:Trotzdem beenden`,
      { duration: 7000 },
    );

    ref.onAction().subscribe(() => {
      this.ngZone.run(() => {
        if (this.embeddedInSession()) {
          void this.confirmEndSession(code);
          return;
        }
        void this.confirmEndStandaloneFeedback(code);
      });
    });
  }

  private async confirmEndSession(code: string): Promise<void> {
    try {
      await trpc.session.end.mutate({ code });
    } catch {
      /* Serverfehler: Nutzer wollte beenden → trotzdem zur Startseite */
    } finally {
      clearHostToken(code);
      clearFeedbackHostToken(code);
      await this.ngZone.run(async () => {
        await this.router.navigateByUrl(localizePath('/'), { replaceUrl: true });
      });
    }
  }

  private async confirmEndStandaloneFeedback(code: string): Promise<void> {
    try {
      await trpc.quickFeedback.end.mutate({ sessionCode: code });
    } catch {
      /* z. B. Host-Token abgelaufen: Client-Token trotzdem löschen und weiter */
    } finally {
      clearFeedbackHostToken(code);
      await this.ngZone.run(async () => {
        await this.router.navigateByUrl(localizePath('/'), { replaceUrl: true });
      });
    }
  }

  async startRound(type: QuickFeedbackType): Promise<void> {
    const code = this.code();
    try {
      if (this.shouldBlockTypeChange(type)) {
        const ref = this.snackBar.open(
          $localize`:@@feedback.compareRoundFormatHint:Formatwechsel gesperrt. Sobald Stimmen vorliegen oder die Vergleichsrunde läuft, bleibt das aktuelle Blitzlicht-Format aktiv. Für einen Wechsel setze das Blitzlicht zuerst zurück. Dabei werden alle bisherigen Stimmen gelöscht.`,
          $localize`Zurücksetzen`,
          {
            duration: 12000,
            panelClass: 'feedback-compare-round-snackbar',
          },
        );
        ref.onAction().subscribe(() => {
          void this.resetRound();
        });
        return;
      }

      if (this.result() && code) {
        await trpc.quickFeedback.changeType.mutate({
          sessionCode: code,
          type,
        });
        await this.loadInitialResult();
        this.subscribeToResults();
        return;
      }

      const res = await trpc.quickFeedback.create.mutate({
        type,
        sessionCode: code || undefined,
      });
      if (code) {
        await this.loadInitialResult();
        this.subscribeToResults();
        return;
      }

      if (res.hostToken) {
        setFeedbackHostToken(res.sessionCode, res.hostToken);
      }

      await this.router.navigateByUrl(localizePath('/'), { skipLocationChange: true });
      await this.router.navigate(localizeCommands(['feedback', res.sessionCode]));
    } catch {
      // best-effort
    }
  }

  private shouldBlockTypeChange(type: QuickFeedbackType): boolean {
    const data = this.result();
    if (!data || data.type === type) {
      return false;
    }
    if (data.type === 'TEMPO') {
      return false;
    }

    return (
      data.totalVotes > 0 ||
      (data.round1Total ?? 0) > 0 ||
      !!data.round1Distribution ||
      !!data.discussion ||
      (data.currentRound ?? 1) === 2
    );
  }

  readonly orderedEntries = computed(() => {
    const data = this.result();
    if (!data) return [];
    const order = feedbackResultOrder(data.type);
    return order.map((key) => ({ key, value: data.distribution[key] ?? 0 }));
  });

  /** Largest-Remainder auf 1 Dezimalstelle (×1000): Summe ist immer exakt 100,0 %. */
  readonly percentages = computed<Record<string, string>>(() => {
    const data = this.result();
    if (!data || data.totalVotes === 0) {
      return Object.fromEntries(
        Object.keys(data?.distribution ?? {}).map((k) => [
          k,
          formatLocalePercent(0, this.localeId, 0),
        ]),
      );
    }
    const entries = Object.entries(data.distribution);
    const total = data.totalVotes;
    const target = 1000;
    const raw = entries.map(([key, count]) => {
      const exact = (count / total) * target;
      return { key, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    let assigned = raw.reduce((s, r) => s + r.floor, 0);
    const sorted = [...raw].sort((a, b) => b.remainder - a.remainder);
    for (const entry of sorted) {
      if (assigned >= target) break;
      entry.floor += 1;
      assigned += 1;
    }
    return Object.fromEntries(
      raw.map((r) => {
        const val = r.floor / 10;
        const fractionDigits = val % 1 === 0 ? 0 : 1;
        return [r.key, formatLocalePercent(val, this.localeId, fractionDigits)];
      }),
    );
  });

  maxVotes(): number {
    const dist = this.result()?.distribution;
    if (!dist) return 1;
    return Math.max(1, ...Object.values(dist));
  }

  percentage(key: string): string {
    return this.percentages()[key] ?? formatLocalePercent(0, this.localeId, 0);
  }

  formatCount(value: number | null | undefined): string {
    return formatLocaleCount(value ?? 0, this.localeId);
  }

  resultsAriaLabel(type: string): string {
    return $localize`Ergebnisse: ${feedbackTitle(type)}`;
  }

  setTempoViewMode(mode: TempoViewMode): void {
    this.tempoViewMode.set(mode);
  }

  isTempoResult(type: string | null | undefined): boolean {
    return isTempoFeedbackType(type);
  }

  tempoTrendLabel(status: string | null | undefined): string {
    return tempoTrendLabel(status);
  }

  tempoTrendEmoji(status: string | null | undefined, marginMet?: boolean): string {
    return tempoTrendEmoji(status, marginMet);
  }

  tempoTrendEmojiCompound(status: string | null | undefined, marginMet?: boolean): boolean {
    return status === 'HETEROGENEOUS' && marginMet !== false;
  }

  tempoTrendTone(status: string | null | undefined): string {
    return tempoTrendTone(status);
  }

  barWidth(count: number): number {
    const max = this.maxVotes();
    return Math.round((count / max) * 100);
  }

  displayLabel(key: string, type: string): string {
    return feedbackDisplayLabel(key, type);
  }

  displayIcon(key: string, type: string) {
    return feedbackDisplayIcon(key, type);
  }

  feedbackTitle(type: string): string {
    if (isTempoFeedbackType(type)) {
      return $localize`:@@feedback.hostTitleTempo:Live-Rückmeldungen`;
    }
    return feedbackTitle(type);
  }

  private starAverage(
    distribution: Record<string, number> | undefined,
    totalVotes: number,
  ): StarAverageSummary {
    if (!distribution || totalVotes <= 0) {
      return {
        scoreLabel: '- / 5',
        icons: this.renderAverageStarIcons(0),
        totalVotes: Math.max(0, totalVotes),
      };
    }

    let weightedSum = 0;
    for (const [key, count] of Object.entries(distribution)) {
      const stars = Number.parseInt(key, 10);
      if (Number.isInteger(stars) && stars >= 1 && stars <= 5) {
        weightedSum += stars * count;
      }
    }

    const numeric = weightedSum / totalVotes;
    return {
      scoreLabel: `${numeric.toFixed(1).replace('.', ',')} / 5`,
      icons: this.renderAverageStarIcons(numeric),
      totalVotes,
    };
  }

  private renderAverageStarIcons(numeric: number): readonly StarAverageIcon[] {
    const roundedHalfSteps = Math.min(10, Math.max(0, Math.round(numeric * 2)));
    return Array.from({ length: 5 }, (_, index): StarAverageIcon => {
      const fullStep = (index + 1) * 2;
      if (roundedHalfSteps >= fullStep) {
        return 'star';
      }
      if (roundedHalfSteps === fullStep - 1) {
        return 'star_half';
      }
      return 'star_border';
    });
  }

  private applyHostResult(data: QuickFeedbackResult): void {
    const previousType = this.result()?.type ?? null;
    this.result.set(data);
    this.locked.set(data.locked);
    if (data.type === 'TEMPO' && previousType !== 'TEMPO') {
      this.tempoViewMode.set(this.embeddedInSession() ? 'details' : 'trend');
    } else if (data.type !== 'TEMPO') {
      this.tempoViewMode.set('details');
    }
  }
}
