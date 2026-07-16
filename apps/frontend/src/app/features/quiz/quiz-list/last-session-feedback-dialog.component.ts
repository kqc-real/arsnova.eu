import { DatePipe, DecimalPipe, formatNumber } from '@angular/common';
import { Component, OnInit, LOCALE_ID, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
import type {
  ConfidenceQuestionSummaryDTO,
  LastSessionAnalysisForQuizDTO,
} from '@arsnova/shared-types';
import { selectConfidencePriorityQuestions } from '@arsnova/shared-types';
import { formatLocaleCount } from '../../../core/locale-number.util';
import { trpc } from '../../../core/trpc.client';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { MarkdownImageLightboxDirective } from '../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';

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
    MarkdownImageLightboxDirective,
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
  private readonly sanitizer = inject(DomSanitizer);
  private readonly markdownCache = new Map<string, SafeHtml>();
  readonly data = inject<LastSessionFeedbackDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly payload = signal<LastSessionAnalysisForQuizDTO | null>(null);
  readonly loadError = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const result = await trpc.session.getLastSessionAnalysisForQuiz.query({
        quizId: this.data.serverQuizId,
        accessProof: this.data.accessProof,
      });
      this.payload.set(result);
    } catch {
      this.loadError.set(true);
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
      if (n > 0) parts.push(`${formatLocaleCount(n, this.localeId)}× ${star} ★`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  formatCount(value: number): string {
    return formatLocaleCount(value, this.localeId);
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

  confidencePercent(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  confidencePriorityQuestions(
    questions: ConfidenceQuestionSummaryDTO[],
  ): ConfidenceQuestionSummaryDTO[] {
    return selectConfidencePriorityQuestions(questions, 3);
  }

  incorrectCount(question: ConfidenceQuestionSummaryDTO): number {
    const crossTab = question.result.crossTab;
    return crossTab.incorrectHigh + crossTab.incorrectMid + crossTab.incorrectLow;
  }

  topWrongOption(question: ConfidenceQuestionSummaryDTO): string | null {
    return question.result.highConfidenceWrongOptions?.[0]?.text ?? null;
  }

  renderQuestionMarkdown(value: string): SafeHtml {
    const cached = this.markdownCache.get(value);
    if (cached) return cached;
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(value, {
        imagePolicy: 'external-https-and-app-assets',
      }).html,
    );
    this.markdownCache.set(value, rendered);
    return rendered;
  }
}
