import { DOCUMENT } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import QRCode from 'qrcode';
import { trpc } from '../../../core/trpc.client';
import type { SessionInfoDTO } from '@arsnova/shared-types';
import { WordCloudComponent } from '../session-present/word-cloud.component';

/**
 * Host-Ansicht: Lobby + Präsentations-Steuerung (Epic 2).
 * Story 2.1a, 2.2, 2.3, 2.4, 4.2, 4.6, 4.7, 4.8, 7.1, 8.1, 8.4.
 */
@Component({
  selector: 'app-session-host',
  standalone: true,
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
    MatIcon,
    WordCloudComponent,
  ],
  templateUrl: './session-host.component.html',
  styleUrl: './session-host.component.scss',
})
export class SessionHostComponent implements OnInit, OnDestroy {
  session = signal<SessionInfoDTO | null>(null);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
  readonly freetextResponses = signal<string[]>([]);
  readonly wordCloudInfo = signal('Warte auf Live-Freitextdaten …');
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly exportStatus = signal<string | null>(null);

  /** Für Lobby: volle Beitritts-URL (präsentierbar, Story 2.1b QR-Code). */
  get joinUrl(): string {
    const origin = typeof this.document?.defaultView?.location?.origin === 'string'
      ? this.document.defaultView.location.origin
      : '';
    return origin ? `${origin}/join/${this.code}` : `/join/${this.code}`;
  }

  /** QR-Code als Data-URL für joinUrl (Beamer-tauglich, Story 2.1b). */
  readonly qrDataUrl = signal<string>('');

  async ngOnInit(): Promise<void> {
    if (this.code.length !== 6) return;
    try {
      const session = await trpc.session.getInfo.query({ code: this.code.toUpperCase() });
      this.session.set(session);
    } catch {
      this.session.set(null);
    }

    await this.generateQrCode();
    await this.refreshLiveFreetext();
    this.pollTimer = setInterval(() => {
      void this.refreshLiveFreetext();
    }, 2000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async exportFreetextSessionCsv(): Promise<void> {
    try {
      const data = await trpc.session.getFreetextSessionExport.query({ code: this.code.toUpperCase() });
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
      this.exportStatus.set('Session-CSV exportiert.');
    } catch {
      this.exportStatus.set('Session-CSV konnte nicht exportiert werden.');
    }
  }

  private async generateQrCode(): Promise<void> {
    try {
      const url = await QRCode.toDataURL(this.joinUrl, { width: 320, margin: 2 });
      this.qrDataUrl.set(url);
    } catch {
      // best-effort
    }
  }

  private async refreshLiveFreetext(): Promise<void> {
    try {
      const data = await trpc.session.getLiveFreetext.query({ code: this.code.toUpperCase() });
      this.freetextResponses.set(data.responses);

      if (data.questionType === 'FREETEXT') {
        this.currentQuestionLabel.set(
          data.questionOrder !== null ? `Frage ${data.questionOrder + 1}: ${data.questionText ?? ''}` : null,
        );
        this.wordCloudInfo.set('Live-Freitext wird aktualisiert.');
      } else if (data.questionType) {
        this.currentQuestionLabel.set(
          data.questionOrder !== null ? `Frage ${data.questionOrder + 1}: ${data.questionText ?? ''}` : null,
        );
        this.wordCloudInfo.set('Aktuelle Frage ist keine Freitext-Frage.');
      } else {
        this.currentQuestionLabel.set(null);
        this.wordCloudInfo.set('Noch keine aktive Frage.');
      }
    } catch {
      this.wordCloudInfo.set('Live-Freitextdaten konnten nicht geladen werden.');
    }
  }
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
