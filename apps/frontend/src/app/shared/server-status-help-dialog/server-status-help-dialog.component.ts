import {
  Component,
  DestroyRef,
  ElementRef,
  LOCALE_ID,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import type { Signal } from '@angular/core';
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
type ChartRenderer = import('./server-status-help-dialog-chart').ServerStatusHistoryChartRenderer;

const THEME_PRESET_DOM_EVENT = 'arsnova:preset-updated';

export interface ServerStatusHelpDialogData {
  connectionOk: Signal<boolean>;
  loading: Signal<boolean>;
  stats: Signal<ServerStatsDTO | null>;
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
          >Betriebsstatus &amp; Systemlast</span
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
              Systemlast-Indikatoren
            </h3>
          </div>
          <p
            class="status-help-dialog__copy status-help-dialog__copy--compact"
            i18n="@@app.footer.statusSloVsLoadHint"
          >
            Die Ampel unten zeigt, wie stabil das System gerade läuft.
          </p>
          <p class="status-help-dialog__copy status-help-dialog__copy--compact">
            <span i18n="@@app.footer.loadStatusLabel">Systemlast:</span>&nbsp;
            <strong class="status-help-dialog__status-badge-wrapper">
              @switch (s.loadStatus) {
                @case ('healthy') {
                  <span
                    class="status-help-dialog__status-badge status-help-dialog__status-badge--healthy"
                    i18n="@@app.footer.loadStatusHealthy"
                    >niedrig</span
                  >
                }
                @case ('busy') {
                  <span
                    class="status-help-dialog__status-badge status-help-dialog__status-badge--busy"
                    i18n="@@app.footer.loadStatusBusy"
                    >mittel</span
                  >
                }
                @default {
                  <span
                    class="status-help-dialog__status-badge status-help-dialog__status-badge--overloaded"
                    i18n="@@app.footer.loadStatusOverloaded"
                    >hoch</span
                  >
                }
              }
            </strong>
          </p>
          <div class="status-help-dialog__metric-groups" aria-live="polite">
            <section
              class="status-help-dialog__metric-group status-help-dialog__metric-group--overview"
              aria-labelledby="server-status-overview-heading"
            >
              <h4
                id="server-status-overview-heading"
                class="status-help-dialog__metric-group-title"
                i18n="@@app.footer.statusMetricGroupOverview"
              >
                Aktuelle Lage
              </h4>
              <div class="status-help-dialog__metrics status-help-dialog__metrics--overview">
                <article class="status-help-dialog__metric status-help-dialog__metric--key">
                  <div class="status-help-dialog__metric-head">
                    <mat-icon aria-hidden="true">play_circle</mat-icon>
                    <span i18n="@@app.footer.statusMetricActiveSessions">Aktive Sessions</span>
                  </div>
                  <strong>{{ s.activeSessions }}</strong>
                  <p
                    class="status-help-dialog__metric-hint"
                    i18n="@@app.footer.statusMetricActiveSessionsHint"
                  >
                    Mindestens 5 aktive Teilnehmende in den letzten 3 Minuten
                  </p>
                </article>
                <article class="status-help-dialog__metric status-help-dialog__metric--key">
                  <div class="status-help-dialog__metric-head">
                    <mat-icon aria-hidden="true">meeting_room</mat-icon>
                    <span i18n="@@app.footer.statusMetricOpenSessions">Offene Sessions</span>
                  </div>
                  <strong>{{ s.openSessions }}</strong>
                  <p
                    class="status-help-dialog__metric-hint"
                    i18n="@@app.footer.statusMetricOpenSessionsHint"
                  >
                    Noch nicht beendet
                  </p>
                </article>
                <article class="status-help-dialog__metric">
                  <div class="status-help-dialog__metric-head">
                    <mat-icon aria-hidden="true">group</mat-icon>
                    <span i18n="@@app.footer.statusMetricParticipants">Aktive Teilnehmende</span>
                  </div>
                  <strong>{{ s.totalParticipants }}</strong>
                  <p
                    class="status-help-dialog__metric-hint"
                    i18n="@@app.footer.statusMetricParticipantsHint"
                  >
                    Summe über alle offenen Sessions in den letzten 3 Minuten
                  </p>
                </article>
                <article class="status-help-dialog__metric">
                  <div class="status-help-dialog__metric-head">
                    <mat-icon aria-hidden="true">bolt</mat-icon>
                    <span i18n="@@app.footer.statusMetricBlitz">Blitz-Runden</span>
                  </div>
                  <strong>{{ s.activeBlitzRounds }}</strong>
                </article>
                <article class="status-help-dialog__metric status-help-dialog__metric--wide">
                  <div class="status-help-dialog__metric-head">
                    <mat-icon aria-hidden="true">check_circle</mat-icon>
                    <span i18n="@@app.footer.statusMetricCompleted">Abgeschlossen</span>
                  </div>
                  <strong>{{ s.completedSessions }}</strong>
                  <p
                    class="status-help-dialog__metric-hint"
                    i18n="@@app.footer.statusMetricCompletedHint"
                  >
                    Alle je beendeten Live-Sessions (kumulativ)
                  </p>
                </article>
              </div>
            </section>
            <section
              class="status-help-dialog__metric-group status-help-dialog__metric-group--dynamic"
              aria-labelledby="server-status-dynamics-heading"
            >
              <h4
                id="server-status-dynamics-heading"
                class="status-help-dialog__metric-group-title"
                i18n="@@app.footer.statusMetricGroupDynamics"
              >
                Aktuelle Dynamik
              </h4>
              <div class="status-help-dialog__metrics status-help-dialog__metrics--dynamic">
                <article class="status-help-dialog__metric status-help-dialog__metric--dynamic">
                  <div class="status-help-dialog__metric-head">
                    <mat-icon aria-hidden="true">how_to_vote</mat-icon>
                    <span i18n="@@app.footer.statusMetricVotes">Abstimmungen / Minute</span>
                  </div>
                  <strong>{{ s.votesLastMinute }}</strong>
                  <p
                    class="status-help-dialog__metric-hint"
                    i18n="@@app.footer.statusMetricVotesHint"
                  >
                    Neue Antworten im letzten Minutenfenster
                  </p>
                </article>
                <article class="status-help-dialog__metric status-help-dialog__metric--dynamic">
                  <div class="status-help-dialog__metric-head">
                    <mat-icon aria-hidden="true">sync_alt</mat-icon>
                    <span i18n="@@app.footer.statusMetricTransitions">Statuswechsel / Minute</span>
                  </div>
                  <strong>{{ s.sessionTransitionsLastMinute }}</strong>
                  <p
                    class="status-help-dialog__metric-hint"
                    i18n="@@app.footer.statusMetricTransitionsHint"
                  >
                    Sessions, die gerade sichtbar weiterlaufen
                  </p>
                </article>
                <article class="status-help-dialog__metric status-help-dialog__metric--dynamic">
                  <div class="status-help-dialog__metric-head">
                    <mat-icon aria-hidden="true">timer</mat-icon>
                    <span i18n="@@app.footer.statusMetricCountdowns">Countdown-Sessions</span>
                  </div>
                  <strong>{{ s.activeCountdownSessions }}</strong>
                  <p
                    class="status-help-dialog__metric-hint"
                    i18n="@@app.footer.statusMetricCountdownsHint"
                  >
                    Mit laufendem Countdown im aktuellen Aktivitätsfenster
                  </p>
                </article>
              </div>
            </section>
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
                  Zuletzt erhöht am {{ dateLabel }}
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
        </section>

        <section
          class="status-help-dialog__panel status-help-dialog__panel--history"
          aria-labelledby="server-status-daily-history-heading"
        >
          <div class="status-help-dialog__panel-header status-help-dialog__panel-header--stacked">
            <h3
              id="server-status-daily-history-heading"
              class="status-help-dialog__section-title"
              i18n="@@help.dailyHighscoresTitle"
            >
              Session-Tagesrekorde der letzten 30 Tage
            </h3>
            <p
              class="status-help-dialog__copy status-help-dialog__copy--compact"
              i18n="@@help.dailyHighscoresHint"
            >
              Jeder Punkt zeigt den Rekord der größten einzelnen Session eines UTC-Tages.
            </p>
          </div>
          <div class="status-help-dialog__history-chart-shell">
            <canvas
              #dailyHighscoresCanvas
              class="status-help-dialog__history-canvas"
              role="img"
              i18n-aria-label="@@help.dailyHighscoresChartAria"
              aria-label="Linienchart der Session-Tagesrekorde der letzten 30 UTC-Tage"
            ></canvas>
          </div>
        </section>
      } @else {
        <section class="status-help-dialog__state" aria-live="polite">
          @if (data.loading()) {
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
            Betriebsstatus
          </h3>
          <p
            class="status-help-dialog__copy status-help-dialog__copy--compact"
            i18n="@@app.footer.statusHelpDot"
          >
            Die Statusanzeige zeigt, wie stabil Live-Quizze gerade laufen.
          </p>
        </div>
        <ul class="status-help-dialog__legend" role="list">
          <li class="status-help-dialog__legend-item status-help-dialog__legend-item--healthy">
            <span
              class="status-help-dialog__dot status-help-dialog__dot--healthy"
              aria-hidden="true"
            ></span>
            <span i18n="@@app.footer.statusLegendHealthy">Stabil</span>
          </li>
          <li class="status-help-dialog__legend-item status-help-dialog__legend-item--busy">
            <span
              class="status-help-dialog__dot status-help-dialog__dot--busy"
              aria-hidden="true"
            ></span>
            <span i18n="@@app.footer.statusLegendBusy">Eingeschränkt</span>
          </li>
          <li class="status-help-dialog__legend-item status-help-dialog__legend-item--overloaded">
            <span
              class="status-help-dialog__dot status-help-dialog__dot--overloaded"
              aria-hidden="true"
            ></span>
            <span i18n="@@app.footer.statusLegendOverloaded">Kritisch</span>
          </li>
          <li class="status-help-dialog__legend-item status-help-dialog__legend-item--unknown">
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly dailyHighscoresCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('dailyHighscoresCanvas');
  readonly data = inject<ServerStatusHelpDialogData>(MAT_DIALOG_DATA);
  private chartRenderer: ChartRenderer | null = null;
  private chartRendererPromise: Promise<ChartRenderer> | null = null;
  private readonly refreshChartForThemeChange = (): void => {
    const stats = this.effectiveStats();
    const canvas = this.dailyHighscoresCanvas()?.nativeElement;
    if (!stats || !canvas) return;
    void this.syncChart(stats, canvas);
  };

  readonly effectiveStats = computed<ServerStatsDTO | null>(() => {
    return this.data.stats();
  });

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

  constructor() {
    this.destroyRef.onDestroy(() => this.destroyChart());

    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener(THEME_PRESET_DOM_EVENT, this.refreshChartForThemeChange);
      this.destroyRef.onDestroy(() => {
        globalThis.removeEventListener(THEME_PRESET_DOM_EVENT, this.refreshChartForThemeChange);
      });
    }

    effect(() => {
      const stats = this.effectiveStats();
      const canvas = this.dailyHighscoresCanvas()?.nativeElement;

      if (!stats || !canvas) {
        this.destroyChart();
        return;
      }

      untracked(() => void this.syncChart(stats, canvas));
    });
  }

  statusTone(): 'healthy' | 'busy' | 'overloaded' | 'unknown' {
    if (!this.data.connectionOk()) return 'unknown';
    const stats = this.effectiveStats();
    switch (stats?.serviceStatus) {
      case 'stable':
        return 'healthy';
      case 'limited':
        return 'busy';
      case 'critical':
        return 'overloaded';
      default:
        return 'unknown';
    }
  }

  private async syncChart(stats: ServerStatsDTO, canvas: HTMLCanvasElement): Promise<void> {
    if (!stats.dailyHighscores.length) {
      this.destroyChart();
      return;
    }

    const renderer = await this.getChartRenderer();
    await renderer.render(stats.dailyHighscores, canvas, this.locale);
  }

  private async getChartRenderer(): Promise<ChartRenderer> {
    if (this.chartRenderer) {
      return this.chartRenderer;
    }

    if (!this.chartRendererPromise) {
      this.chartRendererPromise = import('./server-status-help-dialog-chart').then((module) => {
        const renderer = new module.ServerStatusHistoryChartRenderer();
        this.chartRenderer = renderer;
        return renderer;
      });
    }

    return this.chartRendererPromise;
  }

  private destroyChart(): void {
    this.chartRenderer?.destroy();
  }
}
