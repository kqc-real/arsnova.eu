import { DatePipe, DecimalPipe, formatNumber } from '@angular/common';
import { Component, OnInit, LOCALE_ID, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import type { LastSessionFeedbackForQuizDTO } from '@arsnova/shared-types';
import { trpc } from '../../../core/trpc.client';

export interface LastSessionFeedbackDialogData {
  serverQuizId: string;
  accessProof: string;
  quizName: string;
}

@Component({
  selector: 'app-last-session-feedback-dialog',
  standalone: true,
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
    MatProgressSpinner,
    DecimalPipe,
    DatePipe,
  ],
  templateUrl: './last-session-feedback-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './last-session-feedback-dialog.component.scss',
  ],
})
export class LastSessionFeedbackDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<LastSessionFeedbackDialogComponent>);
  private readonly localeId = inject(LOCALE_ID);
  readonly data = inject<LastSessionFeedbackDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly payload = signal<LastSessionFeedbackForQuizDTO | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const result = await trpc.session.getLastSessionFeedbackForQuiz.query({
        quizId: this.data.serverQuizId,
        accessProof: this.data.accessProof,
      });
      this.payload.set(result);
    } catch {
      this.payload.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  getFeedbackDistributionLine(dist: Record<string, number>): string | null {
    if (!dist || Object.keys(dist).length === 0) return null;
    const parts: string[] = [];
    for (let star = 1; star <= 5; star++) {
      const n = dist[String(star)] ?? 0;
      if (n > 0) parts.push(`${n}× ${star} ★`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  feedbackRatingSingular(): string {
    return $localize`:@@quizList.lastSessionFeedbackDialog.ratingSingular:Bewertung`;
  }

  feedbackRatingPlural(): string {
    return $localize`:@@quizList.lastSessionFeedbackDialog.ratingPlural:Bewertungen`;
  }

  feedbackAverageStarsAria(avg: number): string {
    const formatted = formatNumber(avg, this.localeId, '1.1-1');
    return $localize`:@@quizList.lastSessionFeedbackDialog.avgStarsAria:Durchschnitt ${formatted}:avg: von 5 Sternen`;
  }
}
