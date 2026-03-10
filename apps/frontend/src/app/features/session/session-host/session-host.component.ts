import { DOCUMENT } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import QRCode from 'qrcode';
import type { Unsubscribable } from '@trpc/server/observable';
import { trpc } from '../../../core/trpc.client';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import type {
  HostCurrentQuestionDTO,
  SessionInfoDTO,
  SessionParticipantsPayload,
  SessionStatusUpdate,
} from '@arsnova/shared-types';
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
  /** Lobby: Live-Teilnehmerliste (Story 2.2). */
  readonly participantsPayload = signal<SessionParticipantsPayload | null>(null);
  /** Live-Status für Steuerung (Story 2.3). */
  readonly statusUpdate = signal<SessionStatusUpdate | null>(null);
  readonly controlPending = signal(false);
  private participantSub: Unsubscribable | null = null;
  private statusSub: Unsubscribable | null = null;
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
  readonly freetextResponses = signal<string[]>([]);
  readonly wordCloudInfo = signal('Warte auf Live-Freitextdaten …');
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly exportStatus = signal<string | null>(null);
  /** Aktuelle Frage für Host (Text + Antwortoptionen), null wenn keine Frage aktiv. */
  readonly currentQuestionForHost = signal<HostCurrentQuestionDTO | null>(null);

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
    await this.refreshCurrentQuestionForHost();
    this.pollTimer = setInterval(() => {
      void this.refreshLiveFreetext();
      void this.refreshCurrentQuestionForHost();
    }, 2000);

    if (this.code.length === 6) {
      this.participantSub = trpc.session.onParticipantJoined.subscribe(
        { code: this.code.toUpperCase() },
        {
          onData: (data) => this.participantsPayload.set(data),
          onError: () => {},
        },
      );
      this.statusSub = trpc.session.onStatusChanged.subscribe(
        { code: this.code.toUpperCase() },
        {
          onData: (data) => this.statusUpdate.set(data),
          onError: () => {},
        },
      );
    }
  }

  ngOnDestroy(): void {
    this.participantSub?.unsubscribe();
    this.participantSub = null;
    this.statusSub?.unsubscribe();
    this.statusSub = null;
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

  /** Effektiver Status (Subscription oder Initial getInfo). */
  effectiveStatus(): SessionInfoDTO['status'] | null {
    const su = this.statusUpdate();
    const s = this.session();
    return su?.status ?? s?.status ?? null;
  }

  effectiveCurrentQuestion(): number | null {
    const su = this.statusUpdate();
    return su?.currentQuestion ?? null;
  }

  /** Markdown + KaTeX für Frage- und Antworttexte (wie Quiz-Vorschau). */
  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdownWithKatex(value).html);
  }

  async nextQuestion(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      const result = await trpc.session.nextQuestion.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
    } finally {
      this.controlPending.set(false);
    }
  }

  async revealAnswers(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      const result = await trpc.session.revealAnswers.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
    } finally {
      this.controlPending.set(false);
    }
  }

  async revealResults(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      const result = await trpc.session.revealResults.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
    } finally {
      this.controlPending.set(false);
    }
  }

  private async refreshCurrentQuestionForHost(): Promise<void> {
    if (!this.code || this.code.length !== 6) return;
    try {
      const q = await trpc.session.getCurrentQuestionForHost.query({ code: this.code.toUpperCase() });
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
