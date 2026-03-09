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
  templateUrl: './server-status-widget.component.html',
  styleUrls: ['./server-status-widget.component.scss'],
})
export class ServerStatusWidgetComponent implements OnInit, OnDestroy {
  stats = signal<ServerStatsDTO | null>(null);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  ariaStatusLabel(): string {
    const s = this.stats();
    if (!s) return 'Server-Status wird geladen';
    const statusText = s.serverStatus === 'healthy' ? 'gesund' : s.serverStatus === 'busy' ? 'ausgelastet' : 'überlastet';
    return `Server-Status: ${statusText}. ${s.activeSessions} Quiz live, ${s.activeBlitzRounds} Blitz-Runden, ${s.totalParticipants} Teilnehmende, ${s.completedSessions} Quizzes durchgeführt.`;
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
