import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { trpc } from '../../core/trpc.client';
import { ThemePresetService } from '../../core/theme-preset.service';
import { localizeCommands, localizePath } from '../../core/locale-router';
import { feedbackDisplayIcon, feedbackDisplayLabel, feedbackOptions, feedbackTitle, QUICK_FEEDBACK_PRESET_CHIPS } from './feedback.config';
import type { QuickFeedbackResult, QuickFeedbackType } from '@arsnova/shared-types';
import type { Unsubscribable } from '@trpc/server/observable';

@Component({
  selector: 'app-feedback-host',
  standalone: true,
  imports: [MatCard, MatCardContent, MatButton, MatIcon],
  templateUrl: './feedback-host.component.html',
  styleUrl: './feedback-host.component.scss',
  host: {
    'class': 'feedback-host-shell',
    '[class.feedback-host-shell--embedded]': 'embeddedInSession()',
  },
})
export class FeedbackHostComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly themePreset = inject(ThemePresetService);
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
  readonly showEmbeddedEmptyState = computed(() => this.embeddedInSession() && this.result() === null);
  readonly presetChips = QUICK_FEEDBACK_PRESET_CHIPS;

  constructor() {
    effect(() => {
      const theme = this.themePreset.theme();
      const preset = this.themePreset.preset();
      const code = this.code();
      if (code) {
        trpc.quickFeedback.updateStyle.mutate({
          sessionCode: code,
          theme,
          preset,
        }).catch(() => {});
      }
    });
  }

  get joinUrl(): string {
    const base = globalThis.location?.origin ?? '';
    const code = this.code();
    return this.embeddedInSession() ? `${base}/join/${code}` : `${base}/feedback/${code}/vote`;
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
      if (this.subscription) {
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
      const data = await trpc.quickFeedback.results.query({ sessionCode: code });
      this.result.set(data);
      this.locked.set(data.locked);
      this.error.set(null);
      if (!this.subscription) {
        this.subscribeToResults();
      }
    } catch {
      this.result.set(null);
      this.locked.set(false);
      this.error.set(this.embeddedInSession() ? null : $localize`Feedback-Runde nicht gefunden oder abgelaufen.`);
    }
  }

  private subscribeToResults(): void {
    const code = this.code();
    if (!code || this.subscription) {
      return;
    }

    this.subscription = trpc.quickFeedback.onResults.subscribe(
      { sessionCode: code },
      {
        onData: (data) => {
          this.result.set(data);
          this.locked.set(data.locked);
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

  readonly isDiscussion = computed(() => !!this.result()?.discussion);
  readonly isRound2 = computed(() => (this.result()?.currentRound ?? 1) === 2);
  readonly hasComparison = computed(() => !!this.result()?.round1Distribution && this.isRound2());

  readonly round1Entries = computed(() => {
    const data = this.result();
    if (!data?.round1Distribution) return [];
    const orderMap: Record<string, string[]> = {
      MOOD: feedbackOptions('MOOD').map((o) => o.value),
      YESNO: feedbackOptions('YESNO').map((o) => o.value),
      YESNO_BINARY: feedbackOptions('YESNO_BINARY').map((o) => o.value),
      TRUEFALSE_UNKNOWN: feedbackOptions('TRUEFALSE_UNKNOWN').map((o) => o.value),
      ABC: feedbackOptions('ABC').map((o) => o.value),
      ABCD: feedbackOptions('ABCD').map((o) => o.value),
    };
    const order = orderMap[data.type] ?? Object.keys(data.round1Distribution);
    return order.map((key) => ({ key, value: data.round1Distribution![key] ?? 0 }));
  });

  round1Percentage(key: string): string {
    const data = this.result();
    if (!data?.round1Distribution || !data.round1Total) return '0';
    const count = data.round1Distribution[key] ?? 0;
    return data.round1Total > 0 ? String(Math.round((count / data.round1Total) * 100)) : '0';
  }

  round2Percentage(key: string): string {
    const data = this.result();
    if (!data || data.totalVotes === 0) return '0';
    const count = data.distribution[key] ?? 0;
    return data.totalVotes > 0 ? String(Math.round((count / data.totalVotes) * 100)) : '0';
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
      if (this.embeddedInSession()) {
        void this.confirmEndSession(code);
        return;
      }
      void this.confirmEndStandaloneFeedback(code);
    });
  }

  private async confirmEndSession(code: string): Promise<void> {
    try {
      await trpc.session.end.mutate({ code });
      await this.router.navigateByUrl(localizePath('/'));
    } catch {
      // best-effort
    }
  }

  private async confirmEndStandaloneFeedback(code: string): Promise<void> {
    try {
      await trpc.quickFeedback.end.mutate({ sessionCode: code });
      await this.router.navigateByUrl(localizePath('/'));
    } catch {
      // best-effort
    }
  }

  async startRound(type: QuickFeedbackType): Promise<void> {
    const code = this.code();
    try {
      const theme = this.themePreset.theme();
      const preset = this.themePreset.preset();

      if (this.shouldBlockTypeChange(type)) {
        this.snackBar.open(
          $localize`:@@feedback.compareRoundFormatHint:Eine Vergleichsrunde funktioniert nur mit demselben Blitzlicht-Format. Bitte erst zurücksetzen. Das löscht die bisherigen Stimmen.`,
          undefined,
          { duration: 5000 },
        );
        return;
      }

      if (this.result() && code) {
        await trpc.quickFeedback.changeType.mutate({
          sessionCode: code,
          type,
          theme,
          preset,
        });
        await this.loadInitialResult();
        this.subscribeToResults();
        return;
      }

      const res = await trpc.quickFeedback.create.mutate({
        type,
        theme,
        preset,
        sessionCode: code || undefined,
      });
      if (code) {
        await this.loadInitialResult();
        this.subscribeToResults();
        return;
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

    return (
      data.totalVotes > 0
      || (data.round1Total ?? 0) > 0
      || !!data.round1Distribution
      || !!data.discussion
      || (data.currentRound ?? 1) === 2
    );
  }

  readonly orderedEntries = computed(() => {
    const data = this.result();
    if (!data) return [];
    const orderMap: Record<string, string[]> = {
      MOOD: feedbackOptions('MOOD').map((o) => o.value),
      YESNO: feedbackOptions('YESNO').map((o) => o.value),
      YESNO_BINARY: feedbackOptions('YESNO_BINARY').map((o) => o.value),
      TRUEFALSE_UNKNOWN: feedbackOptions('TRUEFALSE_UNKNOWN').map((o) => o.value),
      ABC: feedbackOptions('ABC').map((o) => o.value),
      ABCD: feedbackOptions('ABCD').map((o) => o.value),
    };
    const order = orderMap[data.type] ?? Object.keys(data.distribution);
    return order.map((key) => ({ key, value: data.distribution[key] ?? 0 }));
  });

  /** Largest-Remainder auf 1 Dezimalstelle (×1000): Summe ist immer exakt 100,0 %. */
  readonly percentages = computed<Record<string, string>>(() => {
    const data = this.result();
    if (!data || data.totalVotes === 0) {
      return Object.fromEntries(Object.keys(data?.distribution ?? {}).map((k) => [k, '0']));
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
    return Object.fromEntries(raw.map((r) => {
      const val = r.floor / 10;
      return [r.key, val % 1 === 0 ? String(val) : val.toFixed(1).replace('.', ',')];
    }));
  });

  maxVotes(): number {
    const dist = this.result()?.distribution;
    if (!dist) return 1;
    return Math.max(1, ...Object.values(dist));
  }

  percentage(key: string): string {
    return this.percentages()[key] ?? '0';
  }

  resultsAriaLabel(type: string): string {
    return $localize`Ergebnisse: ${feedbackTitle(type)}`;
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
    return feedbackTitle(type);
  }
}
