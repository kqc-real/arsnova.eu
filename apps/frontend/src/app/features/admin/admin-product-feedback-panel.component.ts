import { Component, OnInit, ViewEncapsulation, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import type { AdminProductFeedbackStatsDTO } from '@arsnova/shared-types';
import { localizeKnownServerError } from '../../core/localize-known-server-message';
import { trpc } from '../../core/trpc.client';

@Component({
  selector: 'app-admin-product-feedback-panel',
  standalone: true,
  imports: [MatButton, MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatProgressSpinner],
  templateUrl: './admin-product-feedback-panel.component.html',
  styleUrl: './admin-product-feedback-panel.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'admin-product-feedback-panel' },
})
export class AdminProductFeedbackPanelComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly stats = signal<AdminProductFeedbackStatsDTO | null>(null);

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await trpc.admin.productFeedback.getStats.query({});
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
