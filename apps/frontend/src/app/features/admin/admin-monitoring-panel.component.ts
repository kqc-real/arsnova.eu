import {
  Component,
  LOCALE_ID,
  OnDestroy,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatCard,
  MatCardContent,
  MatCardHeader,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import type { HealthSecurityStatsDTO } from '@arsnova/shared-types';
import { formatLocaleCount } from '../../core/locale-number.util';
import { trpc } from '../../core/trpc.client';

const REFRESH_INTERVAL_MS = 60_000;

@Component({
  selector: 'app-admin-monitoring-panel',
  standalone: true,
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
    MatProgressSpinner,
  ],
  templateUrl: './admin-monitoring-panel.component.html',
  styleUrl: './admin-monitoring-panel.component.scss',
})
export class AdminMonitoringPanelComponent implements OnInit, OnDestroy {
  private readonly locale = inject(LOCALE_ID);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  readonly sessionExpired = output<void>();
  readonly stats = signal<HealthSecurityStatsDTO | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly refreshedAt = signal<Date | null>(null);
  readonly formattedJson = computed(() => {
    const stats = this.stats();
    return stats ? JSON.stringify(stats, null, 2) : '';
  });

  ngOnInit(): void {
    void this.refresh();
    this.refreshTimer = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async refresh(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      this.stats.set(await trpc.admin.monitoringStats.query());
      this.refreshedAt.set(new Date());
    } catch (error) {
      if (this.isUnauthorized(error)) {
        this.stats.set(null);
        this.refreshedAt.set(null);
        this.stopPolling();
        this.sessionExpired.emit();
        return;
      }
      this.error.set(
        $localize`:@@admin.monitoringLoadError:Monitoring-Daten konnten nicht geladen werden.`,
      );
    } finally {
      this.loading.set(false);
    }
  }

  formatCount(value: number): string {
    return formatLocaleCount(value, String(this.locale));
  }

  formatPercent(value: number): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(value / 100);
  }

  formatRefreshedAt(): string {
    const refreshedAt = this.refreshedAt();
    if (!refreshedAt) return '—';
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(refreshedAt);
  }

  private stopPolling(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private isUnauthorized(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const record = error as Record<string, unknown>;
    const data = record['data'];
    const shape = record['shape'];
    const dataCode =
      data && typeof data === 'object' ? (data as Record<string, unknown>)['code'] : undefined;
    const shapeData =
      shape && typeof shape === 'object' ? (shape as Record<string, unknown>)['data'] : undefined;
    const shapeCode =
      shapeData && typeof shapeData === 'object'
        ? (shapeData as Record<string, unknown>)['code']
        : undefined;
    return dataCode === 'UNAUTHORIZED' || shapeCode === 'UNAUTHORIZED';
  }
}
