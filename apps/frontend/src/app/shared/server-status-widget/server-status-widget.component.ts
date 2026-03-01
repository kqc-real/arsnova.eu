/**
 * Server-Status-Widget (Story 0.4).
 * Zeigt aggregierte Kennzahlen und Status-Indikator; Polling alle 30s.
 */
import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../core/trpc.client';
import type { ServerStatsDTO } from '@arsnova/shared-types';

@Component({
  selector: 'app-server-status-widget',
  imports: [MatIcon],
  template: `
    <div
      class="server-status"
      role="status"
      aria-live="polite"
      [attr.aria-label]="ariaStatusLabel()"
    >
      <div class="server-status__header">
        <mat-icon
          class="server-status__icon server-status__icon--status"
          [class.server-status__icon--healthy]="statusColor() === 'green'"
          [class.server-status__icon--busy]="statusColor() === 'yellow'"
          [class.server-status__icon--overloaded]="statusColor() === 'red'"
          [class.server-status__icon--unknown]="statusColor() === 'gray'"
          aria-hidden="true"
        >timeline</mat-icon>
        <span
          class="server-status__dot"
          [class.server-status__dot--healthy]="statusColor() === 'green'"
          [class.server-status__dot--busy]="statusColor() === 'yellow'"
          [class.server-status__dot--overloaded]="statusColor() === 'red'"
          [class.server-status__dot--unknown]="statusColor() === 'gray'"
          aria-hidden="true"
        ></span>
        Server-Status
      </div>
      @if (stats(); as s) {
        <p class="server-status__text">
          <strong class="server-status__highlight">{{ s.activeSessions }} Quiz live</strong>
          · {{ s.totalParticipants }} Teilnehmende · {{ s.completedSessions }} durchgeführt
        </p>
      } @else {
        <div class="server-status__skeleton" aria-hidden="true">
          <span class="server-status__skeleton-line"></span>
        </div>
        <p class="server-status__text server-status__text--muted" aria-live="polite">Wird geladen…</p>
      }
    </div>
  `,
  styles: [`
    .server-status {
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface);
      padding: 0.75rem;
      text-align: left;
    }

    .server-status__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font: var(--mat-sys-label-large);
    }

    .server-status__icon-wrap {
      display: inline-flex;
      align-items: center;
      line-height: 1;
    }

    .server-status__icon {
      display: inline-flex;
      align-items: center;
      width: 20px;
      height: 20px;
      font-size: 20px;
    }

    .server-status__icon--status {
      color: var(--mat-sys-outline);
    }

    .server-status__icon--healthy {
      color: var(--mat-sys-outline);
    }

    .server-status__icon--busy {
      color: var(--mat-sys-tertiary);
    }

    .server-status__icon--overloaded {
      color: var(--mat-sys-error);
    }

    .server-status__icon--unknown {
      color: var(--mat-sys-outline);
    }

    .server-status__dot {
      width: 0.625rem;
      height: 0.625rem;
      border-radius: var(--mat-sys-corner-full);
      flex-shrink: 0;
      background: var(--mat-sys-outline);
    }

    .server-status__dot--healthy {
      background: var(--app-status-healthy);
    }

    .server-status__dot--busy {
      background: var(--mat-sys-tertiary);
    }

    .server-status__dot--overloaded {
      background: var(--mat-sys-error);
    }

    .server-status__dot--unknown {
      background: var(--mat-sys-outline);
    }

    .server-status__text {
      margin: 0.25rem 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .server-status__text--muted {
      color: var(--mat-sys-outline);
    }

    .server-status__highlight {
      color: var(--mat-sys-primary);
      font-weight: 600;
    }

    .server-status__skeleton {
      margin: 0.25rem 0 0;
    }

    .server-status__skeleton-line {
      display: block;
      height: 0.875rem;
      width: 85%;
      background: linear-gradient(
        90deg,
        var(--mat-sys-surface-variant) 25%,
        var(--mat-sys-outline-variant) 50%,
        var(--mat-sys-surface-variant) 75%
      );
      background-size: 200% 100%;
      animation: server-status-shimmer 1.2s ease-in-out infinite;
      border-radius: var(--mat-sys-corner-extra-small);
    }

    @keyframes server-status-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class ServerStatusWidgetComponent implements OnInit, OnDestroy {
  stats = signal<ServerStatsDTO | null>(null);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  ariaStatusLabel(): string {
    const s = this.stats();
    if (!s) return 'Server-Status wird geladen';
    const statusText = s.serverStatus === 'healthy' ? 'gesund' : s.serverStatus === 'busy' ? 'ausgelastet' : 'überlastet';
    return `Server-Status: ${statusText}. ${s.activeSessions} Quiz live, ${s.totalParticipants} Teilnehmende, ${s.completedSessions} Quizzes durchgeführt.`;
  }

  statusColor(): 'green' | 'yellow' | 'red' | 'gray' {
    const s = this.stats();
    if (!s) return 'gray';
    switch (s.serverStatus) {
      case 'healthy':
        return 'green';
      case 'busy':
        return 'yellow';
      case 'overloaded':
        return 'red';
      default:
        return 'gray';
    }
  }

  async ngOnInit(): Promise<void> {
    const fetchStats = async (): Promise<void> => {
      try {
        const data = await trpc.health.stats.query();
        this.stats.set(data);
      } catch {
        this.stats.set(null);
      }
    };
    await fetchStats();
    this.intervalId = setInterval(fetchStats, 30_000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
