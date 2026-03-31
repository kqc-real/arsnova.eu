/**
 * Server-Status-Widget (Story 0.4).
 * Zeigt aggregierte Kennzahlen und Status-Indikator; Polling alle 30s (nur wenn Verbindung ok).
 */
import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../core/trpc.client';
import type { ServerStatsDTO } from '@arsnova/shared-types';

@Component({
  selector: 'app-server-status-widget',
  imports: [MatIcon],
  templateUrl: './server-status-widget.component.html',
  styleUrls: ['./server-status-widget.component.scss'],
})
export class ServerStatusWidgetComponent implements OnInit, OnChanges, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  /** Wenn false, wird „Keine Verbindung“ angezeigt statt „Gerade aktiv“ / „Wird geladen…“. */
  @Input() connectionOk = true;
  /** Erste Kennzahlen vom Parent (health.footerBundle); vermeidet zweiten parallelen Request beim ersten Render. */
  @Input() initialStats: ServerStatsDTO | null = null;
  /** Kompakter Modus für enge Layouts wie den globalen Footer. */
  @Input() compact = false;

  stats = signal<ServerStatsDTO | null>(null);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  ariaStatusLabel(): string {
    if (!this.connectionOk) return $localize`Server-Status: Keine Verbindung`;
    const s = this.stats();
    if (!s) return $localize`Server-Status wird geladen`;
    const statusText =
      s.serverStatus === 'healthy'
        ? $localize`gesund`
        : s.serverStatus === 'busy'
          ? $localize`ausgelastet`
          : $localize`überlastet`;
    return $localize`Server-Status: ${statusText}. ${s.activeSessions} Quiz live, ${s.activeBlitzRounds} Blitz-Runden, ${s.totalParticipants} Teilnehmende, ${s.completedSessions} Quizzes durchgeführt.`;
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

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId) && this.connectionOk) this.startPolling();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialStats'] && this.initialStats !== null) {
      this.stats.set(this.initialStats);
    }
    if (changes['connectionOk']) {
      if (this.connectionOk && isPlatformBrowser(this.platformId)) {
        this.startPolling();
      } else {
        this.stopPolling();
        if (!this.connectionOk) this.stats.set(null);
      }
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    this.stopPolling();
    const fetchStats = async (): Promise<void> => {
      try {
        const data = await trpc.health.stats.query();
        this.stats.set(data);
      } catch {
        this.stats.set(null);
      }
    };
    // Erste Anzeige kommt aus initialStats (footerBundle); nur periodisch aktualisieren.
    this.intervalId = setInterval(fetchStats, 30_000);
  }

  private stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
