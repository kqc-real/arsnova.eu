import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../core/trpc.client';
import { ThemePresetService } from '../../core/theme-preset.service';
import { feedbackDisplayLabel, feedbackTitle, MOOD_OPTIONS, YESNO_OPTIONS, ABCD_OPTIONS } from './feedback.config';
import type { QuickFeedbackResult } from '@arsnova/shared-types';
import type { Unsubscribable } from '@trpc/server/observable';
import QRCode from 'qrcode';

@Component({
  selector: 'app-feedback-host',
  standalone: true,
  imports: [MatCard, MatCardContent, MatButton, MatIcon],
  templateUrl: './feedback-host.component.html',
  styleUrl: './feedback-host.component.scss',
})
export class FeedbackHostComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly themePreset = inject(ThemePresetService);
  private subscription: Unsubscribable | null = null;

  readonly code = (this.route.snapshot.paramMap.get('code') ?? '').toUpperCase();
  readonly result = signal<QuickFeedbackResult | null>(null);
  readonly qrDataUrl = signal<string>('');
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);
  readonly resetting = signal(false);
  readonly locked = signal(false);

  constructor() {
    effect(() => {
      const theme = this.themePreset.theme();
      const preset = this.themePreset.preset();
      if (this.code) {
        trpc.quickFeedback.updateStyle.mutate({
          sessionCode: this.code,
          theme,
          preset,
        }).catch(() => {});
      }
    });
  }

  get joinUrl(): string {
    const base = globalThis.location?.origin ?? '';
    return `${base}/feedback/${this.code}/vote`;
  }

  async ngOnInit(): Promise<void> {
    this.generateQrCode();
    this.subscribeToResults();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private subscribeToResults(): void {
    this.subscription = trpc.quickFeedback.onResults.subscribe(
      { sessionCode: this.code },
      {
        onData: (data) => {
          this.result.set(data);
          this.locked.set(data.locked);
          this.error.set(null);
        },
        onError: () => {
          this.error.set('Feedback-Runde nicht gefunden oder abgelaufen.');
        },
      },
    );
  }

  private async generateQrCode(): Promise<void> {
    try {
      const url = await QRCode.toDataURL(this.joinUrl, { width: 280, margin: 2 });
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
    try {
      const res = await trpc.quickFeedback.toggleLock.mutate({ sessionCode: this.code });
      this.locked.set(res.locked);
    } catch {
      // best-effort
    }
  }

  readonly isDiscussion = computed(() => !!this.result()?.discussion);
  readonly isRound2 = computed(() => (this.result()?.currentRound ?? 1) === 2);
  readonly hasComparison = computed(() => !!this.result()?.round1Distribution && this.isRound2());

  readonly round1Entries = computed(() => {
    const data = this.result();
    if (!data?.round1Distribution) return [];
    const orderMap: Record<string, string[]> = {
      MOOD: MOOD_OPTIONS.map((o) => o.value),
      YESNO: YESNO_OPTIONS.map((o) => o.value),
      ABCD: ABCD_OPTIONS.map((o) => o.value),
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
    try {
      await trpc.quickFeedback.startDiscussion.mutate({ sessionCode: this.code });
    } catch {
      // best-effort
    }
  }

  async startSecondRound(): Promise<void> {
    try {
      await trpc.quickFeedback.startSecondRound.mutate({ sessionCode: this.code });
    } catch {
      // best-effort
    }
  }

  async resetRound(): Promise<void> {
    if (this.resetting()) return;
    this.resetting.set(true);
    try {
      await trpc.quickFeedback.reset.mutate({ sessionCode: this.code });
    } catch {
      // best-effort
    } finally {
      this.resetting.set(false);
    }
  }

  async newRound(): Promise<void> {
    const type = this.result()?.type;
    if (!type) return;
    try {
      const res = await trpc.quickFeedback.create.mutate({
        type: type as 'MOOD' | 'ABCD' | 'YESNO',
        theme: this.themePreset.theme(),
        preset: this.themePreset.preset(),
      });
      await this.router.navigateByUrl('/', { skipLocationChange: true });
      await this.router.navigate(['/feedback', res.sessionCode]);
    } catch {
      // best-effort
    }
  }

  readonly orderedEntries = computed(() => {
    const data = this.result();
    if (!data) return [];
    const orderMap: Record<string, string[]> = {
      MOOD: MOOD_OPTIONS.map((o) => o.value),
      YESNO: YESNO_OPTIONS.map((o) => o.value),
      ABCD: ABCD_OPTIONS.map((o) => o.value),
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

  barWidth(count: number): number {
    const max = this.maxVotes();
    return Math.round((count / max) * 100);
  }

  displayLabel(key: string, type: string): string {
    return feedbackDisplayLabel(key, type);
  }

  feedbackTitle(type: string): string {
    return feedbackTitle(type);
  }
}
