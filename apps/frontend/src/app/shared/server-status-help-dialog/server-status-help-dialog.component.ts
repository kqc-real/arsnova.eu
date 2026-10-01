import {
  Component,
  DestroyRef,
  ElementRef,
  LOCALE_ID,
  computed,
  effect,
  inject,
  signal,
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
import { MatTab, MatTabGroup, MatTabLabel } from '@angular/material/tabs';
import type {
  PublicLiveConnections,
  PublicTrafficErrorClasses,
  PublicTrafficQuality,
  PublicUsageStats,
  ServerStatsDTO,
  UsagePeriodKind,
} from '@arsnova/shared-types';
import { formatLocaleCount, formatLocaleNumber } from '../../core/locale-number.util';
import { trpc } from '../../core/trpc.client';
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
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatDialogClose,
    MatIcon,
    MatTabGroup,
    MatTab,
    MatTabLabel,
  ],
  styleUrls: ['../styles/dialog-title-header.scss', './server-status-help-dialog.component.scss'],
  template: `
    <h2 mat-dialog-title class="dialog-title-header">
      <span class="dialog-title-header__icon" aria-hidden="true">
        <mat-icon>router</mat-icon>
      </span>
      <span class="dialog-title-header__copy">
        <span class="dialog-title-header__heading" i18n="@@app.footer.statusHelpTitle"
          >Betrieb &amp; Nutzung</span
        >
      </span>
    </h2>
    <mat-dialog-content class="status-help-dialog__content">
      @if (effectiveStats(); as s) {
        <mat-tab-group
          class="status-help-dialog__tabs"
          animationDuration="0ms"
          mat-stretch-tabs="false"
          mat-align-tabs="start"
        >
          <mat-tab>
            <ng-template mat-tab-label>
              <span i18n="@@app.footer.statusTabOperations">Betrieb</span>
            </ng-template>
            <section
              class="status-help-dialog__panel status-help-dialog__panel--stats"
              aria-labelledby="server-status-overall-heading"
            >
              <p
                class="status-help-dialog__leitfrage"
                i18n="@@app.footer.statusOperationsLeitfrage"
              >
                Funktioniert arsnova.eu gerade zuverlässig?
              </p>
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
                  id="server-status-overall-heading"
                  class="status-help-dialog__section-title"
                  i18n="@@app.footer.statusCurrentTitle"
                >
                  Gesamtzustand
                </h3>
              </div>
              <div class="status-help-dialog__status-strip" role="group">
                <div class="status-help-dialog__status-row">
                  <span
                    class="status-help-dialog__status-label"
                    i18n="@@app.footer.serviceStatusLabel"
                    >Betrieb:</span
                  >
                  @if (!s.measurementAvailable || s.serviceStatus === 'unknown') {
                    <span
                      class="status-help-dialog__status-badge status-help-dialog__status-badge--unknown"
                      i18n="@@app.footer.serviceStatusUnknown"
                      >Messung unbekannt</span
                    >
                  } @else if (s.serviceStatus === 'stable') {
                    <span
                      class="status-help-dialog__status-badge status-help-dialog__status-badge--healthy"
                      i18n="@@app.footer.serviceStatusStable"
                      >stabil</span
                    >
                  } @else if (s.serviceStatus === 'limited') {
                    <span
                      class="status-help-dialog__status-badge status-help-dialog__status-badge--busy"
                      i18n="@@app.footer.serviceStatusLimited"
                      >eingeschränkt</span
                    >
                  } @else {
                    <span
                      class="status-help-dialog__status-badge status-help-dialog__status-badge--overloaded"
                      i18n="@@app.footer.serviceStatusCritical"
                      >gestört</span
                    >
                  }
                </div>
                <div class="status-help-dialog__status-row">
                  <span class="status-help-dialog__status-label" i18n="@@app.footer.loadStatusLabel"
                    >Aktuelle Aktivität:</span
                  >
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
                </div>
              </div>
              <p
                class="status-help-dialog__copy status-help-dialog__copy--compact status-help-dialog__copy--after-strip"
                i18n="@@app.footer.statusLoadStatusDisclaimer"
              >
                Die Aktivität beschreibt die aktuelle Nutzung — nicht die technische Gesundheit des
                Dienstes.
              </p>

              <div
                class="status-help-dialog__metric-groups status-help-dialog__metric-groups--stack"
                aria-live="polite"
              >
                <section
                  class="status-help-dialog__metric-group status-help-dialog__metric-group--block"
                  aria-labelledby="server-status-dependencies-heading"
                >
                  <h4
                    id="server-status-dependencies-heading"
                    class="status-help-dialog__metric-group-title status-help-dialog__metric-group-title--with-icon"
                  >
                    <mat-icon aria-hidden="true">settings</mat-icon>
                    <span i18n="@@app.footer.statusMetricGroupDependencies">Kernfunktionen</span>
                  </h4>
                  <div class="status-help-dialog__metrics status-help-dialog__metrics--overview">
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">api</mat-icon>
                        <span i18n="@@app.footer.statusMetricDependencyApi">API</span>
                      </div>
                      <strong class="status-help-dialog__metric-value--prose">{{
                        formatDependency(s.dependencies.api)
                      }}</strong>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">storage</mat-icon>
                        <span i18n="@@app.footer.statusMetricDependencyDatabase">Datenbank</span>
                      </div>
                      <strong class="status-help-dialog__metric-value--prose">{{
                        formatDependency(s.dependencies.database)
                      }}</strong>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">memory</mat-icon>
                        <span i18n="@@app.footer.statusMetricDependencyRedis">Redis</span>
                      </div>
                      <strong class="status-help-dialog__metric-value--prose">{{
                        formatDependency(s.dependencies.redis)
                      }}</strong>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">stream</mat-icon>
                        <span i18n="@@app.footer.statusMetricDependencyLive">Live-Verbindung</span>
                      </div>
                      <strong class="status-help-dialog__metric-value--prose">{{
                        formatDependency(s.dependencies.live)
                      }}</strong>
                    </article>
                  </div>
                </section>

                <section
                  class="status-help-dialog__metric-group status-help-dialog__metric-group--block"
                  aria-labelledby="server-status-traffic-heading"
                >
                  <h4
                    id="server-status-traffic-heading"
                    class="status-help-dialog__metric-group-title status-help-dialog__metric-group-title--with-icon"
                  >
                    <mat-icon aria-hidden="true">traffic</mat-icon>
                    <span i18n="@@app.footer.statusMetricGroupTraffic"
                      >Serververkehr und Qualität</span
                    >
                  </h4>
                  <p
                    class="status-help-dialog__copy status-help-dialog__copy--compact"
                    i18n="@@app.footer.statusTrafficHint"
                  >
                    API-Anfragen/s nur im Zusammenhang mit Fehlerrate, Latenz und Live-Verbindungen.
                    Hoher Verkehr allein bedeutet weder gute Nutzung noch Störung. Überwacht werden
                    Kernaktionen (ohne Status-Polling).
                  </p>
                  <dl class="status-help-dialog__meta">
                    <div class="status-help-dialog__meta-item">
                      <dt i18n="@@app.footer.statusTrafficCoverage">Messabdeckung:</dt>
                      <dd>{{ formatTrafficCoverage(s.trafficQuality) }}</dd>
                    </div>
                    <div class="status-help-dialog__meta-item">
                      <dt i18n="@@app.footer.statusTrafficWindow">Messfenster:</dt>
                      <dd>{{ formatTrafficWindow(s.trafficQuality) }}</dd>
                    </div>
                    <div class="status-help-dialog__meta-item">
                      <dt i18n="@@app.footer.statusTrafficUpdated">Letzte erfolgreiche Messung:</dt>
                      <dd>{{ formatTrafficUpdatedAt(s.trafficQuality) }}</dd>
                    </div>
                  </dl>
                  <div class="status-help-dialog__metrics status-help-dialog__metrics--traffic">
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">speed</mat-icon>
                        <span i18n="@@app.footer.statusMetricAvgRps">API-Anfragen/s</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isTrafficValueProse(s.trafficQuality)
                        "
                        >{{ formatAvgRps(s.trafficQuality) }}</strong
                      >
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricAvgRpsHint"
                      >
                        Durchschnitt überwachter Kernaktionen im beobachteten Fenster.
                      </p>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">trending_up</mat-icon>
                        <span i18n="@@app.footer.statusMetricPeakRps">Spitzenwert/s</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isTrafficValueProse(s.trafficQuality)
                        "
                        >{{ formatPeakRps(s.trafficQuality) }}</strong
                      >
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricPeakRpsHint"
                      >
                        Höchster normalisierter 10-Sekunden-Bucket im Fenster.
                      </p>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">error_outline</mat-icon>
                        <span i18n="@@app.footer.statusMetricErrorRate">Fehlerrate</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isTrafficValueProse(s.trafficQuality)
                        "
                        >{{ formatTrafficErrorRate(s.trafficQuality) }}</strong
                      >
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricErrorRateHint"
                      >
                        Anteil Server- und Rate-Limit-Fehler an überwachten Anfragen. Clientfehler
                        zählen getrennt und verschlechtern den Zustand nicht.
                      </p>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">timer</mat-icon>
                        <span i18n="@@app.footer.statusMetricP95">p95-Latenz</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isLatencyProse(s.trafficQuality)
                        "
                        >{{ formatTrafficLatency(s.trafficQuality, 'p95') }}</strong
                      >
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">hourglass_top</mat-icon>
                        <span i18n="@@app.footer.statusMetricP99">p99-Latenz</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isLatencyProse(s.trafficQuality)
                        "
                        >{{ formatTrafficLatency(s.trafficQuality, 'p99') }}</strong
                      >
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricLatencyHint"
                      >
                        Inklusive fehlgeschlagener Requests. Bei kleiner Stichprobe keine
                        Qualitätsaussage.
                      </p>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">science</mat-icon>
                        <span i18n="@@app.footer.statusMetricSampleSize">Stichprobengröße</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isTrafficValueProse(s.trafficQuality)
                        "
                        >{{ formatTrafficSampleSize(s.trafficQuality) }}</strong
                      >
                    </article>
                  </div>
                  @if (s.trafficQuality.errorClasses; as errors) {
                    <p class="status-help-dialog__copy status-help-dialog__copy--compact">
                      <span i18n="@@app.footer.statusErrorClasses"
                        >Fehlerklassen (1&nbsp;Min.):</span
                      >
                      {{ formatErrorClasses(errors) }}
                    </p>
                  }
                </section>

                <section
                  class="status-help-dialog__metric-group status-help-dialog__metric-group--block"
                  aria-labelledby="server-status-ws-heading"
                >
                  <h4
                    id="server-status-ws-heading"
                    class="status-help-dialog__metric-group-title status-help-dialog__metric-group-title--with-icon"
                  >
                    <mat-icon aria-hidden="true">cable</mat-icon>
                    <span i18n="@@app.footer.statusMetricGroupLive">Live-Verbindungen</span>
                  </h4>
                  <p
                    class="status-help-dialog__copy status-help-dialog__copy--compact"
                    i18n="@@app.footer.statusLiveHint"
                  >
                    Offene Verbindungen beweisen keine erfolgreiche Nachrichtenzustellung.
                    Zustellfehler und Ende-zu-Ende-Latenz werden hier nicht gemessen. Werte gelten
                    über alle Backend-Instanzen.
                  </p>
                  <div class="status-help-dialog__metrics status-help-dialog__metrics--live">
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">lan</mat-icon>
                        <span i18n="@@app.footer.statusMetricTrpcOpen">tRPC-WebSocket offen</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isLiveValueProse(s.liveConnections)
                        "
                        >{{ formatLiveCount(s.liveConnections.trpcOpen) }}</strong
                      >
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">hub</mat-icon>
                        <span i18n="@@app.footer.statusMetricYjsOpen">Yjs offen</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isLiveValueProse(s.liveConnections)
                        "
                        >{{ formatLiveCount(s.liveConnections.yjsOpen) }}</strong
                      >
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">link_off</mat-icon>
                        <span i18n="@@app.footer.statusMetricWsRejects"
                          >Verbindungsfehler / Ablehnungen</span
                        >
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isLiveValueProse(s.liveConnections)
                        "
                        >{{ formatLiveCount(s.liveConnections.rejectsLastMinute) }}</strong
                      >
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricWsRejectsHint"
                      >
                        Abgelehnte Upgrades, Payload- und Cap-Ablehnungen der letzten Minute.
                      </p>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">sync_alt</mat-icon>
                        <span i18n="@@app.footer.statusMetricWsChurn">Neu / geschlossen</span>
                      </div>
                      <strong class="status-help-dialog__metric-value--prose">{{
                        formatLiveChurn(s.liveConnections)
                      }}</strong>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">forum</mat-icon>
                        <span i18n="@@app.footer.statusMetricMsgRate">Nachrichtenrate</span>
                      </div>
                      <strong class="status-help-dialog__metric-value--prose">{{
                        formatMessagesPerSecond(s.liveConnections)
                      }}</strong>
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricMsgRateHint"
                      >
                        Derzeit nicht belastbar gemessen.
                      </p>
                    </article>
                  </div>
                </section>

                <section
                  class="status-help-dialog__metric-group status-help-dialog__metric-group--block"
                  aria-labelledby="server-status-quality-heading"
                >
                  <h4
                    id="server-status-quality-heading"
                    class="status-help-dialog__metric-group-title status-help-dialog__metric-group-title--with-icon"
                  >
                    <mat-icon aria-hidden="true">speed</mat-icon>
                    <span i18n="@@app.footer.statusMetricGroupQuality">Servicequalität</span>
                  </h4>
                  <p
                    class="status-help-dialog__copy status-help-dialog__copy--compact"
                    i18n="@@app.footer.statusQualitySampleHint"
                  >
                    Stichproben lokaler Kernaktionen. Kleine Stichproben gelten als unzureichend,
                    fehlende Messungen als unbekannt — nie als Null.
                  </p>
                  @if (s.sloSampleSizeLastMinute !== null) {
                    <dl class="status-help-dialog__meta status-help-dialog__meta--single">
                      <div class="status-help-dialog__meta-item">
                        <dt i18n="@@app.footer.statusSloSampleSize">
                          SLO-Stichprobe (1&nbsp;Min.):
                        </dt>
                        <dd>{{ formatCount(s.sloSampleSizeLastMinute) }}</dd>
                      </div>
                    </dl>
                  }
                  <div class="status-help-dialog__metrics status-help-dialog__metrics--quality">
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">login</mat-icon>
                        <span i18n="@@app.footer.statusMetricQualityJoin">Beitritt</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isQualityProse(s.coreActionsQuality.join)
                        "
                        >{{ formatQualitySummary(s.coreActionsQuality.join) }}</strong
                      >
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">how_to_vote</mat-icon>
                        <span i18n="@@app.footer.statusMetricQualityVote">Quizantwort</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isQualityProse(s.coreActionsQuality.vote)
                        "
                        >{{ formatQualitySummary(s.coreActionsQuality.vote) }}</strong
                      >
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">visibility</mat-icon>
                        <span i18n="@@app.footer.statusMetricQualityQaRead">Q&A lesen</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isQualityProse(s.coreActionsQuality.qaRead)
                        "
                        >{{ formatQualitySummary(s.coreActionsQuality.qaRead) }}</strong
                      >
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">question_answer</mat-icon>
                        <span i18n="@@app.footer.statusMetricQualityQaSubmit">Q&A einreichen</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isQualityProse(s.coreActionsQuality.qaSubmit)
                        "
                        >{{ formatQualitySummary(s.coreActionsQuality.qaSubmit) }}</strong
                      >
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">thumb_up</mat-icon>
                        <span i18n="@@app.footer.statusMetricQualityQaRate">Q&A bewerten</span>
                      </div>
                      <strong
                        [class.status-help-dialog__metric-value--prose]="
                          isQualityProse(s.coreActionsQuality.qaRate)
                        "
                        >{{ formatQualitySummary(s.coreActionsQuality.qaRate) }}</strong
                      >
                    </article>
                  </div>
                </section>

                <section
                  class="status-help-dialog__metric-group status-help-dialog__metric-group--block status-help-dialog__metric-group--overview"
                  aria-labelledby="server-status-overview-heading"
                >
                  <h4
                    id="server-status-overview-heading"
                    class="status-help-dialog__metric-group-title status-help-dialog__metric-group-title--with-icon"
                  >
                    <mat-icon aria-hidden="true">monitor</mat-icon>
                    <span i18n="@@app.footer.statusMetricGroupOverview">Aktuelle Aktivität</span>
                  </h4>
                  <p
                    class="status-help-dialog__copy status-help-dialog__copy--compact"
                    i18n="@@app.footer.statusActivityDisclaimer"
                  >
                    Presence-Fenster: letzte Minuten. Kontext zur Nutzung, nicht alleinige Aussage
                    über die Dienstgesundheit.
                  </p>
                  <div class="status-help-dialog__metrics status-help-dialog__metrics--overview">
                    <article class="status-help-dialog__metric status-help-dialog__metric--key">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">groups</mat-icon>
                        <span i18n="@@app.footer.statusMetricActiveSessions">Aktive Sessions</span>
                      </div>
                      <strong>{{ formatCount(s.activeSessions) }}</strong>
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricActiveSessionsHint"
                      >
                        Nutzbare Sessions mit Status ungleich beendet und mindestens fünf anwesenden
                        Teilnehmenden. Offenes Q&A nach Quizende zählt hier nicht.
                      </p>
                    </article>
                    <article class="status-help-dialog__metric status-help-dialog__metric--key">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">chat_bubble_outline</mat-icon>
                        <span i18n="@@app.footer.statusMetricActiveQaSessions"
                          >Aktive Q&A-Sessions</span
                        >
                      </div>
                      <strong>{{
                        formatQaLiveValue(s.activeQaSessions, s.qaPresenceMetricsStatus)
                      }}</strong>
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricActiveQaSessionsHint"
                      >
                        Inklusive weiter offenem Q&A nach Quizende; Presence-Fenster der letzten
                        Minuten
                      </p>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">schedule</mat-icon>
                        <span i18n="@@app.footer.statusMetricOpenSessions">Nutzbare Sessions</span>
                      </div>
                      <strong>{{ formatCount(s.openSessions) }}</strong>
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricOpenSessionsHint"
                      >
                        Noch gültige Beitrittsfrist; einschließlich offenem Q&A nach Quizende
                      </p>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">group</mat-icon>
                        <span i18n="@@app.footer.statusMetricParticipants"
                          >Aktive Teilnehmende</span
                        >
                      </div>
                      <strong>{{ formatCount(s.totalParticipants) }}</strong>
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricParticipantsHint"
                      >
                        Anwesende in nutzbaren Sessions (Presence-Fenster)
                      </p>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">bolt</mat-icon>
                        <span i18n="@@app.footer.statusMetricBlitz">Blitz-Runden</span>
                      </div>
                      <strong>{{ formatCount(s.activeBlitzRounds) }}</strong>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">check_circle</mat-icon>
                        <span i18n="@@app.footer.statusMetricCompleted">Abgeschlossen</span>
                      </div>
                      <strong>{{ formatCount(s.completedSessions) }}</strong>
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricCompletedHint"
                      >
                        Monotone Gesamtzahl beendeter Sessions
                      </p>
                    </article>
                  </div>
                </section>

                <section
                  class="status-help-dialog__metric-group status-help-dialog__metric-group--block"
                  aria-labelledby="server-status-dynamics-heading"
                >
                  <h4
                    id="server-status-dynamics-heading"
                    class="status-help-dialog__metric-group-title status-help-dialog__metric-group-title--with-icon"
                  >
                    <mat-icon aria-hidden="true">equalizer</mat-icon>
                    <span i18n="@@app.footer.statusMetricGroupDynamics"
                      >Dynamik (letzte Minute)</span
                    >
                  </h4>
                  <div class="status-help-dialog__metrics">
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">poll</mat-icon>
                        <span i18n="@@app.footer.statusMetricVotes">Abstimmungen / Minute</span>
                      </div>
                      <strong>{{ formatCount(s.votesLastMinute) }}</strong>
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricVotesHint"
                      >
                        Erfolgreiche Quizantworten im rollierenden Minutenfenster
                      </p>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">question_answer</mat-icon>
                        <span i18n="@@app.footer.statusMetricQaQuestions">Q&A-Fragen / Minute</span>
                      </div>
                      <strong>{{
                        formatQaLiveValue(s.qaQuestionsLastMinute, s.qaMinuteMetricsStatus)
                      }}</strong>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">thumb_up</mat-icon>
                        <span i18n="@@app.footer.statusMetricQaRatings"
                          >Q&A-Bewertungen / Minute</span
                        >
                      </div>
                      <strong>{{
                        formatQaLiveValue(s.qaRatingsLastMinute, s.qaMinuteMetricsStatus)
                      }}</strong>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">swap_horiz</mat-icon>
                        <span i18n="@@app.footer.statusMetricTransitions"
                          >Statuswechsel / Minute</span
                        >
                      </div>
                      <strong>{{ formatCount(s.sessionTransitionsLastMinute) }}</strong>
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricTransitionsHint"
                      >
                        Phasenwechsel in Sessions
                      </p>
                    </article>
                    <article class="status-help-dialog__metric">
                      <div class="status-help-dialog__metric-head">
                        <mat-icon aria-hidden="true">timer</mat-icon>
                        <span i18n="@@app.footer.statusMetricCountdowns">Countdown-Sessions</span>
                      </div>
                      <strong>{{ formatCount(s.activeCountdownSessions) }}</strong>
                      <p
                        class="status-help-dialog__metric-hint"
                        i18n="@@app.footer.statusMetricCountdownsHint"
                      >
                        Sessions mit aktivem Countdown
                      </p>
                    </article>
                  </div>
                </section>
              </div>
              <p class="status-help-dialog__snapshot">
                <span i18n="@@app.footer.statusStatsGeneratedAt">Snapshot:</span>
                <time [attr.datetime]="s.statsGeneratedAt">{{
                  formatTimestamp(s.statsGeneratedAt)
                }}</time>
              </p>
            </section>
          </mat-tab>

          <mat-tab>
            <ng-template mat-tab-label>
              <span i18n="@@app.footer.statusTabUsage">Nutzung</span>
            </ng-template>
            <section
              class="status-help-dialog__panel status-help-dialog__panel--stats"
              aria-labelledby="server-status-usage-heading"
            >
              <p class="status-help-dialog__leitfrage" i18n="@@app.footer.statusUsageLeitfrage">
                Wie häufig und wofür wird arsnova.eu genutzt?
              </p>
              <div class="status-help-dialog__panel-header">
                <h3
                  id="server-status-usage-heading"
                  class="status-help-dialog__section-title status-help-dialog__section-title--with-icon"
                >
                  <mat-icon aria-hidden="true">insights</mat-icon>
                  <span i18n="@@app.footer.statusUsageTitle">Nutzung</span>
                </h3>
              </div>
              <p
                class="status-help-dialog__copy status-help-dialog__copy--compact"
                i18n="@@app.footer.statusUsageIntro"
              >
                Aggregierte, datensparsame Kennzahlen ohne Sessioncodes, Titel oder Personenbezüge.
                Zeitzone der Tageswerte: UTC.
              </p>

              <div
                class="status-help-dialog__period"
                role="group"
                i18n-aria-label="@@app.footer.statusUsagePeriodGroupAria"
                aria-label="Zeitraum für Nutzungskennzahlen"
              >
                <button
                  type="button"
                  matButton="outlined"
                  class="status-help-dialog__period-btn"
                  [class.status-help-dialog__period-btn--active]="usagePeriod() === 'LAST_30_DAYS'"
                  [attr.aria-pressed]="usagePeriod() === 'LAST_30_DAYS'"
                  [disabled]="usageLoading()"
                  (click)="selectUsagePeriod('LAST_30_DAYS')"
                  i18n="@@app.footer.statusUsagePeriod30Days"
                >
                  Letzte 30 Tage
                </button>
                <button
                  type="button"
                  matButton="outlined"
                  class="status-help-dialog__period-btn"
                  [class.status-help-dialog__period-btn--active]="
                    usagePeriod() === 'CURRENT_SEMESTER'
                  "
                  [attr.aria-pressed]="usagePeriod() === 'CURRENT_SEMESTER'"
                  [disabled]="usageLoading()"
                  (click)="selectUsagePeriod('CURRENT_SEMESTER')"
                  i18n="@@app.footer.statusUsagePeriodSemester"
                >
                  Aktuelles Semester
                </button>
                <button
                  type="button"
                  matButton="outlined"
                  class="status-help-dialog__period-btn"
                  [class.status-help-dialog__period-btn--active]="usagePeriod() === 'CUSTOM'"
                  [attr.aria-pressed]="usagePeriod() === 'CUSTOM'"
                  [disabled]="usageLoading()"
                  (click)="openCustomPeriod()"
                  i18n="@@app.footer.statusUsagePeriodCustom"
                >
                  Zeitraum wählen
                </button>
              </div>

              @if (showCustomRange()) {
                <div class="status-help-dialog__custom-range">
                  <label class="status-help-dialog__custom-field">
                    <span i18n="@@app.footer.statusUsageCustomFrom">Von (UTC)</span>
                    <input
                      type="date"
                      [value]="customFrom()"
                      (input)="customFrom.set($any($event.target).value)"
                    />
                  </label>
                  <label class="status-help-dialog__custom-field">
                    <span i18n="@@app.footer.statusUsageCustomTo">Bis (UTC)</span>
                    <input
                      type="date"
                      [value]="customTo()"
                      (input)="customTo.set($any($event.target).value)"
                    />
                  </label>
                  <button
                    type="button"
                    matButton="filled"
                    [disabled]="usageLoading()"
                    (click)="applyCustomPeriod()"
                    i18n="@@app.footer.statusUsageCustomApply"
                  >
                    Anwenden
                  </button>
                </div>
              }

              @if (usageError()) {
                <p
                  class="status-help-dialog__copy status-help-dialog__copy--compact"
                  role="alert"
                  i18n="@@app.footer.statusUsageLoadError"
                >
                  Nutzungskennzahlen konnten gerade nicht geladen werden.
                </p>
              }

              @if (usageStats(); as u) {
                <dl class="status-help-dialog__meta status-help-dialog__meta--usage">
                  <div class="status-help-dialog__meta-item">
                    <dt i18n="@@app.footer.statusUsagePeriodRange">Zeitraum (UTC):</dt>
                    <dd>
                      <time [attr.datetime]="u.periodFrom">{{ formatUsageDay(u.periodFrom) }}</time>
                      –
                      <time [attr.datetime]="u.periodTo">{{ formatUsageDay(u.periodTo) }}</time>
                    </dd>
                  </div>
                  <div class="status-help-dialog__meta-item">
                    <dt i18n="@@app.footer.statusUsageTrackingStarted">Erfassungsbeginn:</dt>
                    <dd>
                      @if (u.trackingStartedAt) {
                        <time [attr.datetime]="u.trackingStartedAt">{{
                          formatTimestamp(u.trackingStartedAt)
                        }}</time>
                      } @else {
                        <span i18n="@@app.footer.statusUsageTrackingUnknown"
                          >noch nicht verfügbar</span
                        >
                      }
                    </dd>
                  </div>
                  <div class="status-help-dialog__meta-item">
                    <dt i18n="@@app.footer.statusUsageLastAggregated">Letzte Aggregation:</dt>
                    <dd>
                      @if (u.lastAggregatedAt) {
                        <time [attr.datetime]="u.lastAggregatedAt">{{
                          formatTimestamp(u.lastAggregatedAt)
                        }}</time>
                      } @else {
                        <span i18n="@@app.footer.statusUsageTrackingUnknown"
                          >noch nicht verfügbar</span
                        >
                      }
                    </dd>
                  </div>
                </dl>
                @if (!u.historyComplete) {
                  <p
                    class="status-help-dialog__copy status-help-dialog__copy--compact status-help-dialog__copy--after-meta"
                    i18n="@@app.footer.statusUsageHistoryIncomplete"
                  >
                    Die Historie der neuen Nutzungsaggregate ist noch unvollständig. Fehlende Werte
                    werden nicht als 0 dargestellt.
                  </p>
                }

                <div
                  class="status-help-dialog__metric-groups status-help-dialog__metric-groups--stack"
                  aria-live="polite"
                >
                  <section
                    class="status-help-dialog__metric-group status-help-dialog__metric-group--block"
                    aria-labelledby="server-status-usage-core-heading"
                  >
                    <h4
                      id="server-status-usage-core-heading"
                      class="status-help-dialog__metric-group-title status-help-dialog__metric-group-title--with-icon"
                    >
                      <mat-icon aria-hidden="true">analytics</mat-icon>
                      <span i18n="@@app.footer.statusMetricGroupUsageCore"
                        >Kennzahlen im Zeitraum</span
                      >
                    </h4>
                    <div
                      class="status-help-dialog__metrics status-help-dialog__metrics--usage-core"
                    >
                      <article class="status-help-dialog__metric">
                        <div class="status-help-dialog__metric-head">
                          <mat-icon aria-hidden="true">meeting_room</mat-icon>
                          <span i18n="@@app.footer.statusMetricSessionsUsed"
                            >Genutzte Sessions</span
                          >
                        </div>
                        <strong
                          [class.status-help-dialog__metric-value--prose]="
                            isMissingCount(u.sessionsUsed)
                          "
                          >{{ formatOptionalCount(u.sessionsUsed) }}</strong
                        >
                        <p
                          class="status-help-dialog__metric-hint"
                          i18n="@@app.footer.statusMetricSessionsUsedHint"
                        >
                          Sessions mit Beitritt oder Interaktion im gewählten Zeitraum
                        </p>
                      </article>
                      <article class="status-help-dialog__metric">
                        <div class="status-help-dialog__metric-head">
                          <mat-icon aria-hidden="true">group_add</mat-icon>
                          <span i18n="@@app.footer.statusMetricSessionParticipations"
                            >Session-Teilnahmen</span
                          >
                        </div>
                        <strong
                          [class.status-help-dialog__metric-value--prose]="
                            isMissingCount(u.sessionParticipations)
                          "
                          >{{ formatOptionalCount(u.sessionParticipations) }}</strong
                        >
                        <p
                          class="status-help-dialog__metric-hint"
                          i18n="@@app.footer.statusMetricSessionParticipationsHint"
                        >
                          Erstmalige Teilnahmen je Session — keine eindeutigen Personen
                        </p>
                      </article>
                      <article class="status-help-dialog__metric">
                        <div class="status-help-dialog__metric-head">
                          <mat-icon aria-hidden="true">how_to_vote</mat-icon>
                          <span i18n="@@app.footer.statusMetricQuizAnswers">Quizantworten</span>
                        </div>
                        <strong
                          [class.status-help-dialog__metric-value--prose]="
                            isMissingCount(u.quizAnswers)
                          "
                          >{{ formatOptionalCount(u.quizAnswers) }}</strong
                        >
                      </article>
                      <article class="status-help-dialog__metric">
                        <div class="status-help-dialog__metric-head">
                          <mat-icon aria-hidden="true">question_answer</mat-icon>
                          <span i18n="@@app.footer.statusMetricQaAccepted">Q&A-Fragen</span>
                        </div>
                        <strong
                          [class.status-help-dialog__metric-value--prose]="
                            isMissingCount(u.qaQuestionsAccepted)
                          "
                          >{{ formatOptionalCount(u.qaQuestionsAccepted) }}</strong
                        >
                      </article>
                      <article class="status-help-dialog__metric">
                        <div class="status-help-dialog__metric-head">
                          <mat-icon aria-hidden="true">thumb_up</mat-icon>
                          <span i18n="@@app.footer.statusMetricQaRatingActions"
                            >Q&A-Bewertungen</span
                          >
                        </div>
                        <strong
                          [class.status-help-dialog__metric-value--prose]="
                            isMissingCount(u.qaRatingActions)
                          "
                          >{{ formatOptionalCount(u.qaRatingActions) }}</strong
                        >
                      </article>
                      <article class="status-help-dialog__metric status-help-dialog__metric--wide">
                        <div class="status-help-dialog__metric-head">
                          <mat-icon aria-hidden="true">chat_bubble_outline</mat-icon>
                          <span i18n="@@app.footer.statusMetricQaQuestionsTotal"
                            >Q&A-Fragen gesamt</span
                          >
                        </div>
                        <strong>{{ formatCount(u.qaQuestionsTotalLifetime) }}</strong>
                        <p
                          class="status-help-dialog__metric-hint"
                          i18n="@@app.footer.statusMetricQaQuestionsTotalHint"
                        >
                          Erstmalig gespeicherte Fragen seit Beginn der Erfassung (purge-sicher)
                        </p>
                      </article>
                      <article class="status-help-dialog__metric status-help-dialog__metric--wide">
                        <div class="status-help-dialog__metric-head">
                          <mat-icon aria-hidden="true">emoji_events</mat-icon>
                          <span i18n="@@app.footer.statusMetricLargestQaCollection"
                            >Größte Q&A-Sammlung</span
                          >
                        </div>
                        <strong>{{ formatCount(s.maxQaQuestionsSingleSession) }}</strong>
                        <p
                          class="status-help-dialog__metric-hint"
                          i18n="@@app.footer.statusMetricLargestQaCollectionHint"
                        >
                          Höchster gleichzeitig gespeicherter Fragenbestand seit Beginn der
                          Erfassung
                        </p>
                      </article>
                    </div>
                  </section>

                  @if (u.sessionsByFunction; as byFn) {
                    <section
                      class="status-help-dialog__metric-group status-help-dialog__metric-group--block"
                      aria-labelledby="server-status-usage-functions-heading"
                    >
                      <h4
                        id="server-status-usage-functions-heading"
                        class="status-help-dialog__metric-group-title status-help-dialog__metric-group-title--with-icon"
                      >
                        <mat-icon aria-hidden="true">apps</mat-icon>
                        <span i18n="@@app.footer.statusMetricGroupFunctions"
                          >Sessions nach Funktion</span
                        >
                      </h4>
                      <p
                        class="status-help-dialog__copy status-help-dialog__copy--compact"
                        i18n="@@app.footer.statusMetricGroupFunctionsHint"
                      >
                        Nach erfassten Interaktionen in der Session — nicht nach dem offenen Kanal.
                        »Nur Beitritt« zählt Sessions mit Teilnahme, aber noch ohne Quizantwort und
                        ohne Q&amp;A-Aktivität. 0 ist üblich, sobald jede Session mindestens einmal
                        Quiz oder Q&amp;A genutzt hat.
                      </p>
                      <div
                        class="status-help-dialog__metrics status-help-dialog__metrics--functions"
                      >
                        <article class="status-help-dialog__metric">
                          <div class="status-help-dialog__metric-head">
                            <mat-icon aria-hidden="true">login</mat-icon>
                            <span i18n="@@app.footer.statusMetricFnJoinOnly">Nur Beitritt</span>
                          </div>
                          <strong>{{ formatCount(byFn.joinOnly) }}</strong>
                          <p
                            class="status-help-dialog__metric-hint"
                            i18n="@@app.footer.statusMetricFnJoinOnlyHint"
                          >
                            Beigetreten, aber noch keine Quiz- oder Q&amp;A-Interaktion
                          </p>
                        </article>
                        <article class="status-help-dialog__metric">
                          <div class="status-help-dialog__metric-head">
                            <mat-icon aria-hidden="true">quiz</mat-icon>
                            <span i18n="@@app.footer.statusMetricFnQuizOnly">Nur Quiz</span>
                          </div>
                          <strong>{{ formatCount(byFn.quizOnly) }}</strong>
                          <p
                            class="status-help-dialog__metric-hint"
                            i18n="@@app.footer.statusMetricFnQuizOnlyHint"
                          >
                            Mindestens eine Quizantwort, keine Q&amp;A-Aktivität
                          </p>
                        </article>
                        <article class="status-help-dialog__metric">
                          <div class="status-help-dialog__metric-head">
                            <mat-icon aria-hidden="true">forum</mat-icon>
                            <span i18n="@@app.footer.statusMetricFnQaOnly">Nur Q&A</span>
                          </div>
                          <strong>{{ formatCount(byFn.qaOnly) }}</strong>
                          <p
                            class="status-help-dialog__metric-hint"
                            i18n="@@app.footer.statusMetricFnQaOnlyHint"
                          >
                            Mindestens eine Q&amp;A-Aktivität, keine Quizantwort
                          </p>
                        </article>
                        <article class="status-help-dialog__metric">
                          <div class="status-help-dialog__metric-head">
                            <mat-icon aria-hidden="true">hub</mat-icon>
                            <span i18n="@@app.footer.statusMetricFnCombined">Quiz und Q&A</span>
                          </div>
                          <strong>{{ formatCount(byFn.combined) }}</strong>
                          <p
                            class="status-help-dialog__metric-hint"
                            i18n="@@app.footer.statusMetricFnCombinedHint"
                          >
                            Mindestens eine Quizantwort und eine Q&amp;A-Aktivität
                          </p>
                        </article>
                      </div>
                    </section>
                  }

                  @if (u.sizeDistribution; as size) {
                    <section
                      class="status-help-dialog__metric-group status-help-dialog__metric-group--block status-help-dialog__metric-group--wide"
                      aria-labelledby="server-status-usage-size-heading"
                    >
                      <h4
                        id="server-status-usage-size-heading"
                        class="status-help-dialog__metric-group-title status-help-dialog__metric-group-title--with-icon"
                      >
                        <mat-icon aria-hidden="true">category</mat-icon>
                        <span i18n="@@app.footer.statusMetricGroupSize">Reichweite nach Größe</span>
                      </h4>
                      <dl class="status-help-dialog__meta status-help-dialog__meta--size">
                        <div class="status-help-dialog__meta-item">
                          <dt i18n="@@app.footer.statusUsageSizeSample">Stichprobe:</dt>
                          <dd>{{ formatCount(size.sampleSize) }}</dd>
                        </div>
                        @if (size.median != null) {
                          <div class="status-help-dialog__meta-item">
                            <dt i18n="@@app.footer.statusUsageSizeMedian">Median:</dt>
                            <dd>{{ formatCount(size.median) }}</dd>
                          </div>
                        }
                        @if (size.quartile1 != null && size.quartile3 != null) {
                          <div class="status-help-dialog__meta-item">
                            <dt i18n="@@app.footer.statusUsageSizeQuartiles">Q1–Q3:</dt>
                            <dd>
                              {{ formatCount(size.quartile1) }}–{{ formatCount(size.quartile3) }}
                            </dd>
                          </div>
                        }
                      </dl>
                      <div class="status-help-dialog__metrics status-help-dialog__metrics--size">
                        @for (cls of size.classes; track cls.id) {
                          <article class="status-help-dialog__metric">
                            <div class="status-help-dialog__metric-head">
                              <mat-icon aria-hidden="true">category</mat-icon>
                              <span>{{ cls.id }} ({{ cls.label }})</span>
                            </div>
                            <strong>{{ formatCount(cls.count) }}</strong>
                          </article>
                        }
                      </div>
                    </section>
                  }
                </div>

                @if (u.dailySeries.length > 0 || u.monthlySeries.length > 0) {
                  <details class="status-help-dialog__disclosure">
                    <summary
                      class="status-help-dialog__disclosure-summary"
                      i18n="@@app.footer.statusUsageSeriesDisclosure"
                    >
                      Tages- und Monatsverlauf
                    </summary>
                    <div class="status-help-dialog__disclosure-body">
                      @if (u.dailySeries.length > 0) {
                        <section
                          class="status-help-dialog__history"
                          aria-labelledby="server-status-usage-series-heading"
                        >
                          <h3
                            id="server-status-usage-series-heading"
                            class="status-help-dialog__section-title status-help-dialog__section-title--with-icon"
                          >
                            <mat-icon aria-hidden="true">bar_chart</mat-icon>
                            <span i18n="@@app.footer.statusUsageSeriesTitle">Nutzung je Tag</span>
                          </h3>
                          <div class="status-help-dialog__usage-series" role="list">
                            @for (day of u.dailySeries; track day.date) {
                              <div class="status-help-dialog__usage-day" role="listitem">
                                <time [attr.datetime]="day.date">{{
                                  formatUsageDay(day.date)
                                }}</time>
                                <span class="status-help-dialog__usage-stat">
                                  <span
                                    class="status-help-dialog__usage-stat-label"
                                    i18n="@@app.footer.statusUsageSeriesSessions"
                                    >Sessions</span
                                  >
                                  <span
                                    class="status-help-dialog__usage-stat-value"
                                    [class.status-help-dialog__usage-stat-value--prose]="
                                      isMissingCount(day.sessionsUsed)
                                    "
                                    >{{ formatOptionalCount(day.sessionsUsed) }}</span
                                  >
                                </span>
                                <span class="status-help-dialog__usage-stat">
                                  <span
                                    class="status-help-dialog__usage-stat-label"
                                    i18n="@@app.footer.statusUsageSeriesJoins"
                                    >Teilnahmen</span
                                  >
                                  <span
                                    class="status-help-dialog__usage-stat-value"
                                    [class.status-help-dialog__usage-stat-value--prose]="
                                      isMissingCount(day.sessionParticipations)
                                    "
                                    >{{ formatOptionalCount(day.sessionParticipations) }}</span
                                  >
                                </span>
                                <span class="status-help-dialog__usage-stat">
                                  <span
                                    class="status-help-dialog__usage-stat-label"
                                    i18n="@@app.footer.statusUsageSeriesVotes"
                                    >Antworten</span
                                  >
                                  <span
                                    class="status-help-dialog__usage-stat-value"
                                    [class.status-help-dialog__usage-stat-value--prose]="
                                      isMissingCount(day.quizAnswers)
                                    "
                                    >{{ formatOptionalCount(day.quizAnswers) }}</span
                                  >
                                </span>
                                <span class="status-help-dialog__usage-stat">
                                  <span
                                    class="status-help-dialog__usage-stat-label"
                                    i18n="@@app.footer.statusUsageSeriesQa"
                                    >Q&A</span
                                  >
                                  <span
                                    class="status-help-dialog__usage-stat-value"
                                    [class.status-help-dialog__usage-stat-value--prose]="
                                      isMissingCount(day.qaQuestionsAccepted)
                                    "
                                    >{{ formatOptionalCount(day.qaQuestionsAccepted) }}</span
                                  >
                                </span>
                              </div>
                            }
                          </div>
                        </section>
                      }

                      @if (u.monthlySeries.length > 0) {
                        <section
                          class="status-help-dialog__history"
                          aria-labelledby="server-status-usage-monthly-heading"
                        >
                          <h3
                            id="server-status-usage-monthly-heading"
                            class="status-help-dialog__section-title status-help-dialog__section-title--with-icon"
                          >
                            <mat-icon aria-hidden="true">event</mat-icon>
                            <span i18n="@@app.footer.statusUsageMonthlyTitle"
                              >Nutzung je Monat</span
                            >
                          </h3>
                          <div class="status-help-dialog__usage-series" role="list">
                            @for (month of u.monthlySeries; track month.yearMonth) {
                              <div class="status-help-dialog__usage-day" role="listitem">
                                <time [attr.datetime]="month.yearMonth">{{ month.yearMonth }}</time>
                                <span class="status-help-dialog__usage-stat">
                                  <span
                                    class="status-help-dialog__usage-stat-label"
                                    i18n="@@app.footer.statusUsageSeriesSessions"
                                    >Sessions</span
                                  >
                                  <span
                                    class="status-help-dialog__usage-stat-value"
                                    [class.status-help-dialog__usage-stat-value--prose]="
                                      isMissingCount(month.sessionsUsed)
                                    "
                                    >{{ formatOptionalCount(month.sessionsUsed) }}</span
                                  >
                                </span>
                                <span class="status-help-dialog__usage-stat">
                                  <span
                                    class="status-help-dialog__usage-stat-label"
                                    i18n="@@app.footer.statusUsageSeriesJoins"
                                    >Teilnahmen</span
                                  >
                                  <span
                                    class="status-help-dialog__usage-stat-value"
                                    [class.status-help-dialog__usage-stat-value--prose]="
                                      isMissingCount(month.sessionParticipations)
                                    "
                                    >{{ formatOptionalCount(month.sessionParticipations) }}</span
                                  >
                                </span>
                                <span class="status-help-dialog__usage-stat">
                                  <span
                                    class="status-help-dialog__usage-stat-label"
                                    i18n="@@app.footer.statusUsageSeriesVotes"
                                    >Antworten</span
                                  >
                                  <span
                                    class="status-help-dialog__usage-stat-value"
                                    [class.status-help-dialog__usage-stat-value--prose]="
                                      isMissingCount(month.quizAnswers)
                                    "
                                    >{{ formatOptionalCount(month.quizAnswers) }}</span
                                  >
                                </span>
                                <span class="status-help-dialog__usage-stat">
                                  <span
                                    class="status-help-dialog__usage-stat-label"
                                    i18n="@@app.footer.statusUsageSeriesQa"
                                    >Q&A</span
                                  >
                                  <span
                                    class="status-help-dialog__usage-stat-value"
                                    [class.status-help-dialog__usage-stat-value--prose]="
                                      isMissingCount(month.qaQuestionsAccepted)
                                    "
                                    >{{ formatOptionalCount(month.qaQuestionsAccepted) }}</span
                                  >
                                </span>
                              </div>
                            }
                          </div>
                        </section>
                      }
                    </div>
                  </details>
                }
              } @else if (usageLoading()) {
                <p class="status-help-dialog__copy" i18n="@@app.footer.statusUsageLoading">
                  Nutzungskennzahlen werden geladen …
                </p>
              }

              <details
                class="status-help-dialog__disclosure status-help-dialog__disclosure--legacy"
                (toggle)="onJoinLegacyToggle($event)"
              >
                <summary
                  class="status-help-dialog__disclosure-summary"
                  id="server-status-join-legacy-heading"
                >
                  <span
                    class="status-help-dialog__section-title status-help-dialog__section-title--with-icon"
                  >
                    <mat-icon aria-hidden="true">history</mat-icon>
                    <span i18n="@@app.footer.statusJoinLegacyTitle">Join-Rekorde (Legacy)</span>
                  </span>
                </summary>
                @if (joinLegacyExpanded()) {
                  <div class="status-help-dialog__disclosure-body">
                    <p
                      class="status-help-dialog__copy status-help-dialog__copy--compact"
                      i18n="@@app.footer.statusJoinLegacyIntro"
                    >
                      Die folgenden Werte zählen kumulative Beitritte je Session. Sie ergänzen die
                      Nutzungsaggregate oben und messen weder gleichzeitige Anwesenheit noch
                      eindeutige Personen.
                    </p>

                    <section
                      class="status-help-dialog__record"
                      aria-labelledby="server-status-record-heading"
                      aria-live="polite"
                    >
                      <div class="status-help-dialog__record-copy">
                        <h4
                          id="server-status-record-heading"
                          class="status-help-dialog__section-title status-help-dialog__section-title--with-icon"
                        >
                          <mat-icon aria-hidden="true">emoji_events</mat-icon>
                          <span i18n="@@help.statsTitle">Höchste Join-Teilnahme einer Session</span>
                        </h4>
                        <p class="status-help-dialog__record-hint" i18n="@@help.statsHint">
                          Lebenszeit-Höchstwert: Summe aller erstmaligen Beitritte in einer
                          einzelnen Session. Wiedereintritte erhöhen den Wert nicht. Keine
                          gleichzeitige Anwesenheit.
                        </p>
                        @if (recordUpdatedFormatted(); as dateLabel) {
                          <p class="status-help-dialog__record-asof">
                            <time
                              [attr.datetime]="s.maxParticipantsStatisticUpdatedAt ?? undefined"
                              i18n="@@help.statsAsOf"
                            >
                              Zuletzt angehoben am {{ dateLabel }}
                            </time>
                          </p>
                        }
                      </div>
                      <div class="status-help-dialog__record-figure">
                        <p class="status-help-dialog__record-number">
                          {{ formatCount(s.maxParticipantsSingleSession) }}
                        </p>
                        <p class="status-help-dialog__record-unit" i18n="@@help.statsUnit">Joins</p>
                      </div>
                    </section>

                    <section
                      class="status-help-dialog__history"
                      aria-labelledby="server-status-daily-history-heading"
                    >
                      <h4
                        id="server-status-daily-history-heading"
                        class="status-help-dialog__section-title status-help-dialog__section-title--with-icon"
                      >
                        <mat-icon aria-hidden="true">insights</mat-icon>
                        <span i18n="@@app.footer.statusDailyHistoryTitle"
                          >Join-Höchststände je Tag</span
                        >
                      </h4>
                      <p
                        class="status-help-dialog__copy status-help-dialog__copy--compact"
                        i18n="@@app.footer.statusDailyHistoryDisclaimer"
                      >
                        Fenster: 100 UTC-Tage. Jeder Punkt ist der höchste an diesem Tag gemessene
                        Session-Join-Stand (größte einzelne Session). Tage ohne Messung bleiben leer
                        (nicht 0). Kennzahlen: Median und IQR nur über gemessene Tage.
                      </p>
                      @if (dailyHighscoresStatisticsFormatted(); as statsFmt) {
                        <div
                          class="status-help-dialog__history-stats status-help-dialog__metrics"
                          [attr.aria-label]="dailyHistoryStatsAria()"
                        >
                          <article class="status-help-dialog__metric">
                            <div class="status-help-dialog__metric-head">
                              <mat-icon aria-hidden="true">analytics</mat-icon>
                              <span i18n="@@app.footer.statusDailyHistoryMedian">Median</span>
                            </div>
                            <strong>{{ statsFmt.median }}</strong>
                            <p
                              class="status-help-dialog__metric-hint"
                              i18n="@@app.footer.statusDailyHistoryMedianHint"
                            >
                              Nur gemessene Tage im Fenster
                            </p>
                          </article>
                          <article class="status-help-dialog__metric">
                            <div class="status-help-dialog__metric-head">
                              <mat-icon aria-hidden="true">equalizer</mat-icon>
                              <span i18n="@@app.footer.statusDailyHistoryIqr">IQR</span>
                            </div>
                            <strong>{{ statsFmt.iqr }}</strong>
                            <p
                              class="status-help-dialog__metric-hint"
                              i18n="@@app.footer.statusDailyHistoryIqrHint"
                            >
                              Q3−Q1 der gemessenen Tage
                            </p>
                          </article>
                          <article class="status-help-dialog__metric">
                            <div class="status-help-dialog__metric-head">
                              <mat-icon aria-hidden="true">leaderboard</mat-icon>
                              <span i18n="@@app.footer.statusDailyHistoryMax">Maximum</span>
                            </div>
                            <strong>{{ statsFmt.max }}</strong>
                            <p
                              class="status-help-dialog__metric-hint"
                              i18n="@@app.footer.statusDailyHistoryMaxHint"
                            >
                              Höchster Join-Stand im Fenster
                            </p>
                          </article>
                        </div>
                      }
                      <div class="status-help-dialog__history-chart-shell">
                        <canvas
                          #dailyHighscoresCanvas
                          class="status-help-dialog__history-canvas"
                          role="img"
                          i18n-aria-label="@@app.footer.statusDailyHistoryChartAria"
                          aria-label="Verlauf der Join-Höchststände"
                        ></canvas>
                      </div>
                    </section>
                  </div>
                }
              </details>
            </section>
          </mat-tab>
        </mat-tab-group>
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
            Betriebszustand
          </h3>
          <p
            class="status-help-dialog__copy status-help-dialog__copy--compact"
            i18n="@@app.footer.statusHelpDot"
          >
            Die Statusanzeige findest du im Footer-Menü »Mehr«. Sie zeigt den Betriebszustand —
            nicht die Nutzungsaktivität.
          </p>
        </div>
        <ul class="status-help-dialog__legend" role="list">
          <li class="status-help-dialog__legend-item status-help-dialog__legend-item--healthy">
            <span
              class="status-help-dialog__dot status-help-dialog__dot--healthy"
              aria-hidden="true"
            ></span>
            <span class="status-help-dialog__legend-label" i18n="@@app.footer.statusLegendHealthy"
              >Stabil</span
            >
          </li>
          <li class="status-help-dialog__legend-item status-help-dialog__legend-item--busy">
            <span
              class="status-help-dialog__dot status-help-dialog__dot--busy"
              aria-hidden="true"
            ></span>
            <span class="status-help-dialog__legend-label" i18n="@@app.footer.statusLegendBusy"
              >Eingeschränkt</span
            >
          </li>
          <li class="status-help-dialog__legend-item status-help-dialog__legend-item--overloaded">
            <span
              class="status-help-dialog__dot status-help-dialog__dot--overloaded"
              aria-hidden="true"
            ></span>
            <span
              class="status-help-dialog__legend-label"
              i18n="@@app.footer.statusLegendOverloaded"
              >Gestört</span
            >
          </li>
          <li class="status-help-dialog__legend-item status-help-dialog__legend-item--unknown">
            <span
              class="status-help-dialog__dot status-help-dialog__dot--unknown"
              aria-hidden="true"
            ></span>
            <span class="status-help-dialog__legend-label" i18n="@@app.footer.statusLegendUnknown"
              >Messung unbekannt</span
            >
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

  readonly usagePeriod = signal<UsagePeriodKind>('LAST_30_DAYS');
  readonly usageOverride = signal<PublicUsageStats | null>(null);
  readonly usageLoading = signal(false);
  readonly usageError = signal(false);
  readonly customFrom = signal('');
  readonly customTo = signal('');
  readonly showCustomRange = signal(false);
  /** Join-Legacy inkl. Chart erst bei Bedarf laden/zeichnen. */
  readonly joinLegacyExpanded = signal(false);

  readonly usageStats = computed<PublicUsageStats | null>(() => {
    return this.usageOverride() ?? this.effectiveStats()?.usage ?? null;
  });

  protected selectUsagePeriod(period: Exclude<UsagePeriodKind, 'CUSTOM'>): void {
    this.showCustomRange.set(false);
    if (this.usagePeriod() === period && this.usageOverride()) return;
    this.usagePeriod.set(period);
    void this.loadUsagePeriod({ kind: period });
  }

  protected onJoinLegacyToggle(event: Event): void {
    const details = event.target as HTMLDetailsElement;
    const open = details.open;
    this.joinLegacyExpanded.set(open);
    if (open) {
      requestAnimationFrame(() => this.refreshChartForThemeChange());
    } else {
      this.destroyChart();
    }
  }

  protected openCustomPeriod(): void {
    this.showCustomRange.set(true);
    const usage = this.usageStats();
    if (usage && !this.customFrom()) {
      this.customFrom.set(usage.periodFrom);
      this.customTo.set(usage.periodTo);
    }
  }

  protected applyCustomPeriod(): void {
    const from = this.customFrom().trim();
    const to = this.customTo().trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      this.usageError.set(true);
      return;
    }
    this.usagePeriod.set('CUSTOM');
    void this.loadUsagePeriod({ kind: 'CUSTOM', from, to });
  }

  private async loadUsagePeriod(input: {
    kind: UsagePeriodKind;
    from?: string;
    to?: string;
  }): Promise<void> {
    this.usageLoading.set(true);
    this.usageError.set(false);
    try {
      const usage = await trpc.health.usage.query(input);
      this.usageOverride.set(usage);
    } catch {
      this.usageError.set(true);
    } finally {
      this.usageLoading.set(false);
    }
  }

  protected formatUsageDay(isoDate: string): string {
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return isoDate;
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(date);
  }

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

  readonly dailyHighscoresStatisticsFormatted = computed(() => {
    const statistics = this.effectiveStats()?.dailyHighscoresStatistics;
    if (!statistics || statistics.sampleSize <= 0) return null;

    const dash = '—';
    return {
      sampleSize: statistics.sampleSize,
      median:
        statistics.median === null
          ? dash
          : formatLocaleNumber(statistics.median, this.locale, { maximumFractionDigits: 0 }),
      iqr:
        statistics.iqr === null
          ? dash
          : formatLocaleNumber(statistics.iqr, this.locale, { maximumFractionDigits: 0 }),
      max: statistics.max === null ? dash : formatLocaleCount(statistics.max, this.locale),
    };
  });

  readonly dailyHistoryStatsAria = computed(() => {
    const n = this.effectiveStats()?.dailyHighscoresStatistics.sampleSize ?? 0;
    return $localize`:@@app.footer.statusDailyHistoryStatsAria:Kennzahlen von ${n}:sampleSize: gemessenen Tagen im 100-Tage-Fenster`;
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
      const expanded = this.joinLegacyExpanded();
      const canvas = this.dailyHighscoresCanvas()?.nativeElement;

      if (!stats || !canvas || !expanded) {
        this.destroyChart();
        return;
      }

      untracked(() => void this.syncChart(stats, canvas));
    });
  }

  statusTone(): 'healthy' | 'busy' | 'overloaded' | 'unknown' {
    if (!this.data.connectionOk()) return 'unknown';
    const stats = this.effectiveStats();
    if (!stats?.measurementAvailable || stats.serviceStatus === 'unknown') return 'unknown';
    switch (stats.serviceStatus) {
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
    await renderer.render(stats.dailyHighscores, canvas, this.locale, {
      dataset: $localize`:@@app.footer.statusChartDatasetJoinRecord:Join-Höchststand`,
      xAxis: $localize`:@@app.footer.statusChartAxisDate:Datum (UTC)`,
      yAxis: $localize`:@@app.footer.statusChartAxisParticipants:Joins (kumulativ)`,
    });
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

  protected formatCount(value: number): string {
    return formatLocaleCount(value, this.locale);
  }

  protected formatQaLiveValue(
    value: number | null,
    status: ServerStatsDTO['qaMinuteMetricsStatus'] | ServerStatsDTO['qaPresenceMetricsStatus'],
  ): string {
    if (status === 'WARMING_UP') {
      return $localize`:@@app.footer.statusQaLiveRebuilding:Live-Werte werden neu aufgebaut`;
    }
    if (status === 'UNAVAILABLE' || value === null) {
      return $localize`:@@app.footer.statusQaUnavailable:Derzeit nicht verfügbar`;
    }
    return formatLocaleCount(value, this.locale);
  }

  protected formatTimestamp(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  protected formatOptionalCount(value: number | null): string {
    if (value === null) {
      return $localize`:@@app.footer.statusMetricNotYetAvailable:noch nicht verfügbar`;
    }
    return formatLocaleCount(value, this.locale);
  }

  protected isMissingCount(value: number | null): boolean {
    return value === null;
  }

  protected formatDependency(status: ServerStatsDTO['dependencies']['api']): string {
    switch (status) {
      case 'ok':
        return $localize`:@@app.footer.dependencyOk:ok`;
      case 'degraded':
        return $localize`:@@app.footer.dependencyDegraded:eingeschränkt`;
      case 'unavailable':
        return $localize`:@@app.footer.dependencyUnavailable:nicht erreichbar`;
      default:
        return $localize`:@@app.footer.dependencyUnknown:unbekannt`;
    }
  }

  protected isTrafficValueProse(traffic: PublicTrafficQuality): boolean {
    return traffic.measurementState !== 'AVAILABLE' || traffic.avgRps === null;
  }

  protected isLatencyProse(traffic: PublicTrafficQuality): boolean {
    return (
      traffic.measurementState === 'UNAVAILABLE' ||
      traffic.insufficientLatencySample ||
      traffic.p95LatencyMs === null
    );
  }

  protected isLiveValueProse(live: PublicLiveConnections): boolean {
    return live.measurementState === 'UNAVAILABLE' || live.trpcOpen === null;
  }

  protected formatTrafficCoverage(traffic: PublicTrafficQuality): string {
    return $localize`:@@app.footer.statusTrafficCoverageValue:${traffic.monitoredProcedures}:monitored: von ${traffic.definedProcedures}:defined: definierten Kernaktionen werden überwacht.`;
  }

  protected formatTrafficWindow(traffic: PublicTrafficQuality): string {
    if (traffic.measurementState === 'UNAVAILABLE' || traffic.observedWindowSeconds === null) {
      return $localize`:@@app.footer.statusMeasurementUnavailable:Messung derzeit nicht verfügbar`;
    }
    if (!traffic.windowComplete) {
      return $localize`:@@app.footer.statusTrafficWindowWarmup:${traffic.observedWindowSeconds}:seconds: s von ${traffic.windowSeconds}:window: s (Anlauf, Messung unvollständig)`;
    }
    return $localize`:@@app.footer.statusTrafficWindowFull:${traffic.windowSeconds}:window: s (vollständig)`;
  }

  protected formatTrafficUpdatedAt(traffic: PublicTrafficQuality): string {
    if (!traffic.lastSuccessfulReadAt) {
      return $localize`:@@app.footer.statusMeasurementUnavailable:Messung derzeit nicht verfügbar`;
    }
    return this.formatTimestamp(traffic.lastSuccessfulReadAt);
  }

  protected formatAvgRps(traffic: PublicTrafficQuality): string {
    if (traffic.measurementState === 'UNAVAILABLE' || traffic.avgRps === null) {
      return $localize`:@@app.footer.statusMeasurementUnavailable:Messung derzeit nicht verfügbar`;
    }
    if (traffic.measurementState === 'WARMING_UP') {
      return `${formatLocaleNumber(traffic.avgRps, this.locale, {
        maximumFractionDigits: 2,
      })} (${$localize`:@@app.footer.statusMeasurementIncomplete:unvollständig`})`;
    }
    return formatLocaleNumber(traffic.avgRps, this.locale, { maximumFractionDigits: 2 });
  }

  protected formatPeakRps(traffic: PublicTrafficQuality): string {
    if (traffic.measurementState === 'UNAVAILABLE' || traffic.peakRps === null) {
      return $localize`:@@app.footer.statusMeasurementUnavailable:Messung derzeit nicht verfügbar`;
    }
    return formatLocaleNumber(traffic.peakRps, this.locale, { maximumFractionDigits: 2 });
  }

  protected formatTrafficErrorRate(traffic: PublicTrafficQuality): string {
    if (traffic.measurementState === 'UNAVAILABLE' || traffic.errorRatePercent === null) {
      return $localize`:@@app.footer.statusMeasurementUnavailable:Messung derzeit nicht verfügbar`;
    }
    return `${formatLocaleNumber(traffic.errorRatePercent, this.locale, {
      maximumFractionDigits: 2,
    })} %`;
  }

  protected formatTrafficLatency(traffic: PublicTrafficQuality, kind: 'p95' | 'p99'): string {
    if (traffic.measurementState === 'UNAVAILABLE') {
      return $localize`:@@app.footer.statusMeasurementUnavailable:Messung derzeit nicht verfügbar`;
    }
    if (traffic.insufficientLatencySample) {
      const samples = traffic.sampleSize ?? 0;
      return $localize`:@@app.footer.statusLatencyInsufficient:noch nicht genügend Messwerte (${samples}:samples:)`;
    }
    const value = kind === 'p95' ? traffic.p95LatencyMs : traffic.p99LatencyMs;
    if (value === null) {
      return $localize`:@@app.footer.statusMeasurementUnavailable:Messung derzeit nicht verfügbar`;
    }
    return `${formatLocaleCount(value, this.locale)} ms`;
  }

  protected formatTrafficSampleSize(traffic: PublicTrafficQuality): string {
    if (traffic.measurementState === 'UNAVAILABLE' || traffic.sampleSize === null) {
      return $localize`:@@app.footer.statusMeasurementUnavailable:Messung derzeit nicht verfügbar`;
    }
    return formatLocaleCount(traffic.sampleSize, this.locale);
  }

  protected formatErrorClasses(errors: PublicTrafficErrorClasses): string {
    return $localize`:@@app.footer.statusErrorClassesValue:Server ${errors.server}:server:, Rate-Limit ${errors.rateLimit}:rateLimit:, Client ${errors.client}:client:`;
  }

  protected formatLiveCount(value: number | null): string {
    if (value === null) {
      return $localize`:@@app.footer.statusMeasurementUnavailable:Messung derzeit nicht verfügbar`;
    }
    return formatLocaleCount(value, this.locale);
  }

  protected formatLiveChurn(live: PublicLiveConnections): string {
    if (
      live.measurementState === 'UNAVAILABLE' ||
      live.trpcOpenedLastMinute === null ||
      live.trpcClosedLastMinute === null ||
      live.yjsOpenedLastMinute === null ||
      live.yjsClosedLastMinute === null
    ) {
      return $localize`:@@app.footer.statusMeasurementUnavailable:Messung derzeit nicht verfügbar`;
    }
    const opened = live.trpcOpenedLastMinute + live.yjsOpenedLastMinute;
    const closed = live.trpcClosedLastMinute + live.yjsClosedLastMinute;
    return $localize`:@@app.footer.statusLiveChurnValue:${opened}:opened: neu / ${closed}:closed: geschlossen`;
  }

  protected formatMessagesPerSecond(live: PublicLiveConnections): string {
    void live;
    return $localize`:@@app.footer.statusMetricNotMeasured:nicht gemessen`;
  }

  protected isQualityProse(quality: ServerStatsDTO['coreActionsQuality']['join']): boolean {
    return quality.coverage === 'UNAVAILABLE';
  }

  protected formatQualitySummary(quality: ServerStatsDTO['coreActionsQuality']['join']): string {
    if (quality.coverage === 'UNAVAILABLE') {
      return $localize`:@@app.footer.qualityUnavailable:keine Stichprobe`;
    }
    const samples = formatLocaleCount(quality.samples, this.locale);
    const p95 =
      quality.p95Ms === null ? '—' : `${formatLocaleCount(quality.p95Ms, this.locale)} ms p95`;
    if (quality.coverage === 'INSUFFICIENT_SAMPLE') {
      return `${samples} · ${p95}`;
    }
    const err =
      quality.errorRatePercent === null
        ? '—'
        : `${formatLocaleNumber(quality.errorRatePercent, this.locale, {
            maximumFractionDigits: 1,
          })} %`;
    return `${err} · ${p95}`;
  }
}
