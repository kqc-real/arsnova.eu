import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { trpc } from '../../core/trpc.client';
import type { QuickFeedbackResult } from '@arsnova/shared-types';
import QRCode from 'qrcode';

@Component({
  selector: 'app-feedback-host',
  standalone: true,
  imports: [KeyValuePipe, MatCard, MatCardContent],
  templateUrl: './feedback-host.component.html',
  styleUrl: './feedback-host.component.scss',
})
export class FeedbackHostComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  readonly code = this.route.snapshot.paramMap.get('code') ?? '';
  readonly result = signal<QuickFeedbackResult | null>(null);
  readonly qrDataUrl = signal<string>('');
  readonly error = signal<string | null>(null);

  get joinUrl(): string {
    const base = globalThis.location?.origin ?? '';
    return `${base}/feedback/${this.code}/vote`;
  }

  async ngOnInit(): Promise<void> {
    await this.fetchResults();
    this.generateQrCode();
    this.pollTimer = setInterval(() => this.fetchResults(), 1500);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async fetchResults(): Promise<void> {
    try {
      const data = await trpc.quickFeedback.results.query({ sessionCode: this.code });
      this.result.set(data);
      this.error.set(null);
    } catch {
      this.error.set('Feedback-Runde nicht gefunden oder abgelaufen.');
    }
  }

  private async generateQrCode(): Promise<void> {
    try {
      const url = await QRCode.toDataURL(this.joinUrl, { width: 280, margin: 2 });
      this.qrDataUrl.set(url);
    } catch {
      // QR code generation is best-effort
    }
  }

  maxVotes(): number {
    const dist = this.result()?.distribution;
    if (!dist) return 1;
    return Math.max(1, ...Object.values(dist));
  }

  percentage(count: number): number {
    const total = this.result()?.totalVotes ?? 0;
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  }

  barWidth(count: number): number {
    const max = this.maxVotes();
    return Math.round((count / max) * 100);
  }

  displayLabel(key: string, type: string): string {
    if (type === 'MOOD') {
      switch (key) {
        case 'POSITIVE': return '😊';
        case 'NEUTRAL': return '😐';
        case 'NEGATIVE': return '😟';
      }
    }
    if (type === 'YESNO') {
      switch (key) {
        case 'YES': return '👍';
        case 'NO': return '👎';
        case 'MAYBE': return '🤷';
      }
    }
    return key;
  }

  feedbackTitle(type: string): string {
    switch (type) {
      case 'MOOD': return 'Stimmungsbild';
      case 'YESNO': return 'Ja / Nein / Vielleicht';
      case 'ABCD': return 'ABCD-Voting';
      default: return 'Feedback';
    }
  }
}
