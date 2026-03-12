import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { WordCloudComponent } from './word-cloud.component';
import { trpc } from '../../../core/trpc.client';

/**
 * Beamer-Ansicht / Presenter-Mode (Epic 2).
 * Story 2.5, 2.6, 3.5, 4.1, 4.4, 4.5, 1.14, 7.1, 8.2, 8.3.
 */
@Component({
  selector: 'app-session-present',
  standalone: true,
  imports: [MatCard, MatCardContent, WordCloudComponent],
  templateUrl: './session-present.component.html',
  styleUrl: './session-present.component.scss',
})
export class SessionPresentComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';

  readonly freetextResponses = signal<string[]>([]);
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly presenterInfo = signal($localize`Warte auf Live-Freitextdaten …`);

  async ngOnInit(): Promise<void> {
    if (this.code.length !== 6) {
      this.presenterInfo.set($localize`Ungültiger Session-Code.`);
      return;
    }

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

  private async refreshLiveFreetext(): Promise<void> {
    try {
      const data = await trpc.session.getLiveFreetext.query({ code: this.code.toUpperCase() });
      this.freetextResponses.set(data.responses);

      if (data.questionType === 'FREETEXT') {
        this.currentQuestionLabel.set(
          data.questionOrder !== null ? `Frage ${data.questionOrder + 1}: ${data.questionText ?? ''}` : null,
        );
        this.presenterInfo.set($localize`Live-Freitext wird aktualisiert.`);
      } else if (data.questionType) {
        this.currentQuestionLabel.set(
          data.questionOrder !== null ? `Frage ${data.questionOrder + 1}: ${data.questionText ?? ''}` : null,
        );
        this.presenterInfo.set($localize`Aktuelle Frage ist keine Freitext-Frage.`);
      } else {
        this.currentQuestionLabel.set(null);
        this.presenterInfo.set($localize`Noch keine aktive Frage.`);
      }
    } catch {
      this.presenterInfo.set($localize`Live-Freitextdaten konnten nicht geladen werden.`);
    }
  }
}
