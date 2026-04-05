import { Component, LOCALE_ID, computed, inject, isDevMode } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import type { ServerStatsDTO } from '@arsnova/shared-types';

const HELP_STATS_DEV_FAKE_MAX = 184;
const HELP_STATS_DEV_FAKE_UPDATED_AT_ISO = '2025-11-08T16:45:00.000Z';

export interface ServerStatusHelpDialogData {
  connectionOk: boolean;
  loading: boolean;
  stats: ServerStatsDTO | null;
}

@Component({
  selector: 'app-server-status-help-dialog',
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton, MatDialogClose, MatIcon],
  styleUrls: ['../styles/dialog-title-header.scss', './server-status-help-dialog.component.scss'],
  template: `
    <h2 mat-dialog-title class="dialog-title-header">
      <span class="dialog-title-header__icon" aria-hidden="true">
        <mat-icon>router</mat-icon>
      </span>
      <span class="dialog-title-header__copy">
        <span class="dialog-title-header__heading" i18n="@@app.footer.statusHelpTitle"
          >Server-Statistik</span
        >
      </span>
    </h2>
    <mat-dialog-content class="status-help-dialog__content">
      @if (effectiveStats(); as s) {
        <section
          class="status-help-dialog__panel status-help-dialog__panel--stats"
          aria-labelledby="server-status-live-heading"
        >
          <div class="status-help-dialog__panel-header">
            <span
              class="status-help-dialog__dot"
              [class.status-help-dialog__dot--healthy]="statusTone() === 'healthy'"
              [class.status-help-dialog__dot--busy]="statusTone() === 'busy'"
              [class.status-help-dialog__dot--overloaded]="statusTone() === 'overloaded'"
              [class.status-help-dialog__dot--unknown]="statusTone() === 'unknown'"
              aria-hidden="true"
            ></span>
            <h3
              id="server-status-live-heading"
              class="status-help-dialog__section-title"
              i18n="@@app.footer.statusCurrentTitle"
            >
              Jetzt auf dem Server
            </h3>
          </div>
          <div class="status-help-dialog__metrics" aria-live="polite">
            <article class="status-help-dialog__metric">
              <div class="status-help-dialog__metric-head">
                <mat-icon aria-hidden="true">play_circle</mat-icon>
                <span i18n="@@app.footer.statusMetricLiveSessions">Live-Sessions</span>
              </div>
              <strong>{{ s.activeSessions }}</strong>
            </article>
            <article class="status-help-dialog__metric">
              <div class="status-help-dialog__metric-head">
                <mat-icon aria-hidden="true">bolt</mat-icon>
                <span i18n="@@app.footer.statusMetricBlitz">Blitz-Runden</span>
              </div>
              <strong>{{ s.activeBlitzRounds }}</strong>
            </article>
            <article class="status-help-dialog__metric">
              <div class="status-help-dialog__metric-head">
                <mat-icon aria-hidden="true">group</mat-icon>
                <span i18n="@@app.footer.statusMetricParticipants">Teilnehmende</span>
              </div>
              <strong>{{ s.totalParticipants }}</strong>
            </article>
            <article class="status-help-dialog__metric">
              <div class="status-help-dialog__metric-head">
                <mat-icon aria-hidden="true">check_circle</mat-icon>
                <span i18n="@@app.footer.statusMetricCompleted">Abgeschlossen</span>
              </div>
              <strong>{{ s.completedSessions }}</strong>
            </article>
          </div>
        </section>

        <section
          class="status-help-dialog__record"
          aria-labelledby="server-status-record-heading"
          aria-live="polite"
        >
          <div class="status-help-dialog__record-copy">
            <h3
              id="server-status-record-heading"
              class="status-help-dialog__section-title"
              i18n="@@help.statsTitle"
            >
              Rekordteilnahme
            </h3>
            <p class="status-help-dialog__record-hint" i18n="@@help.statsHint">
              Bisher höchste Teilnehmerzahl in einer einzelnen Live-Session auf diesem Server.
            </p>
            @if (recordUpdatedFormatted(); as dateLabel) {
              <p class="status-help-dialog__record-asof">
                <time
                  [attr.datetime]="s.maxParticipantsStatisticUpdatedAt ?? undefined"
                  i18n="@@help.statsAsOf"
                >
                  Gemessen am {{ dateLabel }}
                </time>
              </p>
            }
          </div>
          <div class="status-help-dialog__record-figure">
            <div class="status-help-dialog__record-number">
              {{ s.maxParticipantsSingleSession }}
            </div>
            <div class="status-help-dialog__record-unit" i18n="@@help.statsUnit">Teilnehmende</div>
          </div>
          @if (statsUsesDevDemoValues()) {
            <p class="status-help-dialog__record-dev-demo" i18n="@@help.statsDevDemoNote">
              Zahl und Zeitstempel sind Beispieldaten (nur Entwicklungsmodus, solange kein echter
              Rekord aus der API kommt).
            </p>
          }
        </section>
      } @else {
        <section class="status-help-dialog__state" aria-live="polite">
          @if (data.loading) {
            <p class="status-help-dialog__copy" i18n="@@app.footer.statusLoading">
              Live-Daten werden geladen…
            </p>
          } @else {
            <p class="status-help-dialog__copy" i18n="@@app.footer.statusUnavailable">
              Derzeit sind keine Live-Daten verfügbar.
            </p>
          }
        </section>
      }
      <section
        class="status-help-dialog__panel status-help-dialog__panel--legend"
        aria-labelledby="server-status-legend-heading"
      >
        <div class="status-help-dialog__panel-header status-help-dialog__panel-header--stacked">
          <h3
            id="server-status-legend-heading"
            class="status-help-dialog__section-title"
            i18n="@@app.footer.statusLegendTitle"
          >
            Status-Legende
          </h3>
          <p
            class="status-help-dialog__copy status-help-dialog__copy--compact"
            i18n="@@app.footer.statusHelpDot"
          >
            Der Status wird über farbige Punkte angezeigt.
          </p>
        </div>
        <ul class="status-help-dialog__legend" role="list">
          <li>
            <span
              class="status-help-dialog__dot status-help-dialog__dot--healthy"
              aria-hidden="true"
            ></span>
            <span i18n="@@app.footer.statusLegendHealthy">Gesund</span>
          </li>
          <li>
            <span
              class="status-help-dialog__dot status-help-dialog__dot--busy"
              aria-hidden="true"
            ></span>
            <span i18n="@@app.footer.statusLegendBusy">Ausgelastet</span>
          </li>
          <li>
            <span
              class="status-help-dialog__dot status-help-dialog__dot--overloaded"
              aria-hidden="true"
            ></span>
            <span i18n="@@app.footer.statusLegendOverloaded">Überlastet</span>
          </li>
          <li>
            <span
              class="status-help-dialog__dot status-help-dialog__dot--unknown"
              aria-hidden="true"
            ></span>
            <span i18n="@@app.footer.statusLegendUnknown">Keine Live-Daten</span>
          </li>
        </ul>
      </section>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close i18n="@@app.footer.statusHelpClose">
        Schließen
      </button>
    </mat-dialog-actions>
  `,
})
export class ServerStatusHelpDialogComponent {
  private readonly locale = inject(LOCALE_ID);
  readonly data = inject<ServerStatusHelpDialogData>(MAT_DIALOG_DATA);

  readonly effectiveStats = computed<ServerStatsDTO | null>(() => {
    const stats = this.data.stats;
    if (!stats) return null;
    if (isDevMode() && stats.maxParticipantsSingleSession === 0) {
      return {
        ...stats,
        maxParticipantsSingleSession: HELP_STATS_DEV_FAKE_MAX,
        maxParticipantsStatisticUpdatedAt: HELP_STATS_DEV_FAKE_UPDATED_AT_ISO,
      };
    }
    return stats;
  });

  readonly statsUsesDevDemoValues = computed(
    () => !!this.data.stats && isDevMode() && this.data.stats.maxParticipantsSingleSession === 0,
  );

  readonly recordUpdatedFormatted = computed(() => {
    const iso = this.effectiveStats()?.maxParticipantsStatisticUpdatedAt;
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      try {
        return new Intl.DateTimeFormat(this.locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZoneName: 'short',
        }).format(d);
      } catch {
        return new Intl.DateTimeFormat(this.locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(d);
      }
    } catch {
      return null;
    }
  });

  statusTone(): 'healthy' | 'busy' | 'overloaded' | 'unknown' {
    if (!this.data.connectionOk) return 'unknown';
    const stats = this.effectiveStats();
    return stats?.serverStatus ?? 'unknown';
  }
}
