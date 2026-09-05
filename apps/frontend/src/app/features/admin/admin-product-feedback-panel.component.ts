import { Component, OnInit, ViewEncapsulation, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect, MatOption } from '@angular/material/select';
import type {
  AdminProductFeedbackStatsDTO,
  AdminProductFeedbackStatsInput,
  ProductFeedbackRole,
  ProductFeedbackSurveyKey,
} from '@arsnova/shared-types';
import { localizeKnownServerError } from '../../core/localize-known-server-message';
import { trpc } from '../../core/trpc.client';

@Component({
  selector: 'app-admin-product-feedback-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatFormField,
    MatLabel,
    MatInput,
    MatProgressSpinner,
    MatSelect,
    MatOption,
  ],
  templateUrl: './admin-product-feedback-panel.component.html',
  styleUrl: './admin-product-feedback-panel.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'admin-product-feedback-panel' },
})
export class AdminProductFeedbackPanelComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly stats = signal<AdminProductFeedbackStatsDTO | null>(null);

  roleFilter: ProductFeedbackRole | '' = '';
  surveyKeyFilter: ProductFeedbackSurveyKey | '' = '';
  fromDate = '';
  toDate = '';

  readonly roleOptions: ProductFeedbackRole[] = ['HOST', 'PARTICIPANT'];
  readonly surveyKeyOptions: ProductFeedbackSurveyKey[] = [
    'POST_SESSION_EASE_PARTICIPANT_V1',
    'POST_SESSION_VALUE_PARTICIPANT_V1',
    'POST_SESSION_EASE_HOST_V1',
    'POST_SESSION_VALUE_HOST_V1',
  ];

  ngOnInit(): void {
    void this.reload();
  }

  formatRate(rate: number | null | undefined): string {
    if (rate === null || rate === undefined) return '—';
    return `${Math.round(rate * 1000) / 10} %`;
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const input: AdminProductFeedbackStatsInput = {};
      if (this.roleFilter) input.role = this.roleFilter;
      if (this.surveyKeyFilter) input.surveyKey = this.surveyKeyFilter;
      if (this.fromDate) input.from = new Date(`${this.fromDate}T00:00:00.000Z`).toISOString();
      if (this.toDate) input.to = new Date(`${this.toDate}T23:59:59.999Z`).toISOString();
      const data = await trpc.admin.productFeedback.getStats.query(input);
      this.stats.set(data);
    } catch (e) {
      this.error.set(
        localizeKnownServerError(
          e,
          $localize`:@@admin.productFeedback.errorLoad:Produktfeedback-Statistik konnte nicht geladen werden.`,
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }
}
