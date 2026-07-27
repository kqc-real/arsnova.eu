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
import type {
  HealthCheckResponse,
  HealthSecurityStatsDTO,
  ServerStatsDTO,
} from '@arsnova/shared-types';
import { formatLocaleCount } from '../../core/locale-number.util';
import { trpc } from '../../core/trpc.client';

const REFRESH_INTERVAL_MS = 60_000;
type MonitoringLevel = 'ok' | 'warning' | 'critical';
type Threshold = Readonly<{ warning: number; critical: number; percent?: boolean }>;
type MetricView = Readonly<{
  label: string;
  value: string;
  level: MonitoringLevel | null;
  threshold: string | null;
}>;

// Muss mit RULES in scripts/monitoring/arsnova_monitor.py synchron bleiben.
const THRESHOLDS = {
  sessionCreates: { warning: 30, critical: 60 },
  rateLimit429: { warning: 50, critical: 200 },
  sessionCodeEntryFailures: { warning: 100, critical: 500 },
  sessionCodeEntrySoftCapDelays: { warning: 10, critical: 100 },
  softCapUtilization: { warning: 80, critical: 95, percent: true },
  sessionCode429: { warning: 30, critical: 100 },
  cspDropped: { warning: 10, critical: 100 },
  cspRateLimited: { warning: 50, critical: 500 },
  cspEval: { warning: 1, critical: 10 },
  cspScriptHttps: { warning: 10, critical: 100 },
  pdfFailed: { warning: 1, critical: 3 },
  pdfRejected: { warning: 5, critical: 20 },
  trpcConnections: { warning: 600, critical: 800 },
  trpcRejectedUpgrades: { warning: 50, critical: 200 },
  trpcRejectedPayloads: { warning: 1, critical: 10 },
  trpcRateLimitedMessages: { warning: 10, critical: 50 },
  yjsConnections: { warning: 700, critical: 900 },
  yjsRejectedUpgrades: { warning: 50, critical: 200 },
  yjsRejectedPayloads: { warning: 1, critical: 10 },
  yjsRateLimitedMessages: { warning: 10, critical: 50 },
  yjsAwarenessRejected: { warning: 1, critical: 10 },
} as const satisfies Record<string, Threshold>;

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
  readonly healthCheck = signal<HealthCheckResponse | null>(null);
  readonly serviceStatus = signal<ServerStatsDTO['serviceStatus'] | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly refreshedAt = signal<Date | null>(null);
  readonly formattedJson = computed(() => {
    const stats = this.stats();
    return stats ? JSON.stringify(stats, null, 2) : '';
  });
  readonly sessionMetrics = computed<MetricView[]>(() => {
    const stats = this.stats();
    if (!stats) return [];
    return [
      this.metric(
        $localize`:@@admin.monitoringSessionCreates:Erstellte Sessions`,
        stats.sessionCreatesLastMinute,
        THRESHOLDS.sessionCreates,
      ),
      this.metric(
        $localize`:@@admin.monitoringAllCodeFailures:Globale fehlgeschlagene Code-Abfragen`,
        stats.sessionCodeFailuresLastMinute,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringEntryFailures:Fehlgeschlagene Join- und Codeprüfungen`,
        stats.sessionCodeEntryFailuresLastMinute,
        THRESHOLDS.sessionCodeEntryFailures,
      ),
      this.metric(
        $localize`:@@admin.monitoringJoinFailures:davon Join-Versuche`,
        stats.sessionCodeFailuresBySourceLastMinute.join,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringLookupFailures:davon Code-Abfragen`,
        stats.sessionCodeFailuresBySourceLastMinute.lookup,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringPollReconnectFailures:Automatische Poll-/Reconnect-Abfragen`,
        stats.sessionCodeFailuresBySourceLastMinute.pollReconnect,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringOtherCodeFailures:Sonstige fehlgeschlagene Code-Abfragen`,
        stats.sessionCodeFailuresBySourceLastMinute.other,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringEntrySoftCapDelays:Soft-Cap-Verzögerungen für Join/Codeprüfung`,
        stats.sessionCodeEntrySoftCapDelaysLastMinute,
        THRESHOLDS.sessionCodeEntrySoftCapDelays,
      ),
      this.metric(
        $localize`:@@admin.monitoringPollReconnectSoftCapDelays:Automatische Poll-/Reconnect-Verzögerungen`,
        stats.sessionCodeSoftCapDelaysBySourceLastMinute.pollReconnect,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringSoftCapUtilization:Globale Soft-Cap-Auslastung`,
        stats.sessionCodeGlobalSoftCapUtilizationPercent,
        THRESHOLDS.softCapUtilization,
      ),
      this.metric(
        $localize`:@@admin.monitoringRateLimitTotal:429-Ablehnungen`,
        stats.rateLimit429LastMinute,
        THRESHOLDS.rateLimit429,
      ),
    ];
  });
  readonly pdfMetrics = computed<MetricView[]>(() => {
    const stats = this.stats();
    if (!stats) return [];
    return [
      this.metric(
        $localize`:@@admin.monitoringPdfActive:Aktive Jobs`,
        stats.pdfActiveJobs,
        null,
        `${this.formatCount(stats.pdfActiveJobs)} / ${this.formatCount(stats.pdfMaxConcurrentJobs)}`,
      ),
      this.metric(
        $localize`:@@admin.monitoringPdfCompleted:Abgeschlossen`,
        stats.pdfCompletedLastMinute,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringPdfFailed:Fehlgeschlagen`,
        stats.pdfFailedLastMinute,
        THRESHOLDS.pdfFailed,
      ),
      this.metric(
        $localize`:@@admin.monitoringPdfRejected:Abgelehnt`,
        stats.pdfRejectedLastMinute,
        THRESHOLDS.pdfRejected,
      ),
    ];
  });
  readonly securityMetrics = computed<MetricView[]>(() => {
    const stats = this.stats();
    if (!stats) return [];
    return [
      this.metric(
        $localize`:@@admin.monitoringSessionCode429:Session-Code-429`,
        stats.rateLimit429ByCategoryLastMinute.sessionCode,
        THRESHOLDS.sessionCode429,
      ),
      this.metric(
        $localize`:@@admin.monitoringCspDropped:Verworfene CSP-Reports`,
        stats.cspReportsDroppedLastMinute,
        THRESHOLDS.cspDropped,
      ),
      this.metric(
        $localize`:@@admin.monitoringCspRateLimited:Rate-limitierte CSP-Reports`,
        stats.cspReportsRateLimitedLastMinute,
        THRESHOLDS.cspRateLimited,
      ),
      this.metric(
        $localize`:@@admin.monitoringCspEval:CSP-eval-Meldungen`,
        stats.cspReportsEvalLastMinute,
        THRESHOLDS.cspEval,
      ),
      this.metric(
        $localize`:@@admin.monitoringCspScriptHttps:Externe CSP-Script-Meldungen`,
        stats.cspReportsScriptHttpsLastMinute,
        THRESHOLDS.cspScriptHttps,
      ),
    ];
  });
  readonly trpcMetrics = computed<MetricView[]>(() => {
    const stats = this.stats();
    if (!stats) return [];
    return [
      this.metric(
        $localize`:@@admin.monitoringConnections:Verbindungen`,
        stats.trpcWebSocketConnectionsActive,
        THRESHOLDS.trpcConnections,
        `${this.formatCount(stats.trpcWebSocketConnectionsActive)} / ${this.formatCount(
          stats.trpcWebSocketConnectionLimit,
        )}`,
      ),
      this.metric(
        $localize`:@@admin.monitoringRejectedUpgrades:Abgelehnte Upgrades`,
        stats.trpcWebSocketRejectedUpgradesLastMinute,
        THRESHOLDS.trpcRejectedUpgrades,
      ),
      this.metric(
        $localize`:@@admin.monitoringRejectedPayloads:Abgelehnte Payloads`,
        stats.trpcWebSocketPayloadRejectedLastMinute,
        THRESHOLDS.trpcRejectedPayloads,
      ),
      this.metric(
        $localize`:@@admin.monitoringRateLimitedMessages:Rate-limitierte Nachrichten`,
        stats.trpcWebSocketRateLimitedMessagesLastMinute,
        THRESHOLDS.trpcRateLimitedMessages,
      ),
    ];
  });
  readonly yjsMetrics = computed<MetricView[]>(() => {
    const stats = this.stats();
    if (!stats) return [];
    return [
      this.metric(
        $localize`:@@admin.monitoringConnections:Verbindungen`,
        stats.yjsWebSocketConnectionsActive,
        THRESHOLDS.yjsConnections,
        `${this.formatCount(stats.yjsWebSocketConnectionsActive)} / ${this.formatCount(
          stats.yjsWebSocketConnectionLimit,
        )}`,
      ),
      this.metric(
        $localize`:@@admin.monitoringRejectedUpgrades:Abgelehnte Upgrades`,
        stats.yjsWebSocketRejectedUpgradesLastMinute,
        THRESHOLDS.yjsRejectedUpgrades,
      ),
      this.metric(
        $localize`:@@admin.monitoringYjsInvalidTokens:Ungültige Sync-Tokens`,
        stats.yjsWebSocketRejectedUpgradesByReasonLastMinute.invalidToken,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringYjsStaleTokens:Ersetzte Sync-Tokens`,
        stats.yjsWebSocketRejectedUpgradesByReasonLastMinute.staleGeneration,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringYjsMissingTokens:Fehlende oder abgelaufene Legacy-Tokens`,
        stats.yjsWebSocketRejectedUpgradesByReasonLastMinute.tokenRequired +
          stats.yjsWebSocketRejectedUpgradesByReasonLastMinute.legacyCutoff,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringYjsInvalidPaths:Ungültige Relay-Pfade`,
        stats.yjsWebSocketRejectedUpgradesByReasonLastMinute.invalidPath,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringYjsUpgradeLimits:Upgrade-Rate-/Kapazitätslimits`,
        stats.yjsWebSocketRejectedUpgradesByReasonLastMinute.globalRate +
          stats.yjsWebSocketRejectedUpgradesByReasonLastMinute.roomRate +
          stats.yjsWebSocketRejectedUpgradesByReasonLastMinute.globalConnectionCap +
          stats.yjsWebSocketRejectedUpgradesByReasonLastMinute.roomConnectionCap,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringYjsAuthorizationUnavailable:Autorisierung vorübergehend nicht verfügbar`,
        stats.yjsWebSocketRejectedUpgradesByReasonLastMinute.authorizationUnavailable,
        null,
      ),
      this.metric(
        $localize`:@@admin.monitoringRejectedPayloads:Abgelehnte Payloads`,
        stats.yjsWebSocketPayloadRejectedLastMinute,
        THRESHOLDS.yjsRejectedPayloads,
      ),
      this.metric(
        $localize`:@@admin.monitoringRateLimitedMessages:Rate-limitierte Nachrichten`,
        stats.yjsWebSocketRateLimitedMessagesLastMinute,
        THRESHOLDS.yjsRateLimitedMessages,
      ),
      this.metric(
        $localize`:@@admin.monitoringAwarenessRejected:Abgelehnte Awareness-Updates`,
        stats.yjsWebSocketAwarenessRejectedLastMinute,
        THRESHOLDS.yjsAwarenessRejected,
      ),
    ];
  });
  readonly overallLevel = computed<MonitoringLevel>(() => {
    const stats = this.stats();
    if (!stats) return 'critical';
    const infrastructureLevel = this.infrastructureLevel(stats.databaseStatus);
    const metricLevel = this.highestLevel([
      ...this.sessionMetrics(),
      ...this.pdfMetrics(),
      ...this.securityMetrics(),
      ...this.trpcMetrics(),
      ...this.yjsMetrics(),
    ]);
    if (infrastructureLevel === 'critical' || metricLevel === 'critical') return 'critical';
    if (infrastructureLevel === 'warning' || metricLevel === 'warning') return 'warning';
    return 'ok';
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
      const [stats, healthCheck, publicStats] = await Promise.all([
        trpc.admin.monitoringStats.query(),
        trpc.health.check.query(),
        trpc.health.stats.query(),
      ]);
      this.stats.set(stats);
      this.healthCheck.set(healthCheck);
      this.serviceStatus.set(publicStats.serviceStatus);
      this.refreshedAt.set(new Date());
    } catch (error) {
      if (this.isUnauthorized(error)) {
        this.stats.set(null);
        this.healthCheck.set(null);
        this.serviceStatus.set(null);
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

  infrastructureStatusLabel(status: 'ok' | 'unavailable'): string {
    return status === 'ok'
      ? $localize`:@@admin.monitoringStatusOk:Erreichbar`
      : $localize`:@@admin.monitoringStatusUnavailable:Nicht erreichbar`;
  }

  serviceStatusLabel(status: ServerStatsDTO['serviceStatus'] | null): string {
    if (status === 'stable') return $localize`:@@admin.monitoringServiceStable:Stabil`;
    if (status === 'limited') return $localize`:@@admin.monitoringServiceLimited:Eingeschränkt`;
    if (status === 'critical') return $localize`:@@admin.monitoringServiceCritical:Kritisch`;
    return $localize`:@@admin.monitoringStatusUnavailable:Nicht erreichbar`;
  }

  statusLabel(level: MonitoringLevel): string {
    if (level === 'critical') return $localize`:@@admin.monitoringLevelCritical:Kritisch`;
    if (level === 'warning') return $localize`:@@admin.monitoringLevelWarning:Warnung`;
    return $localize`:@@admin.monitoringLevelOk:Alles in Ordnung`;
  }

  statusDescription(level: MonitoringLevel): string {
    if (level === 'critical') {
      return $localize`:@@admin.monitoringCriticalHelp:Mindestens ein Wert erfordert sofortige Prüfung.`;
    }
    if (level === 'warning') {
      return $localize`:@@admin.monitoringWarningHelp:Mindestens ein Wert liegt über der Warnschwelle.`;
    }
    return $localize`:@@admin.monitoringOkHelp:Alle überwachten Werte liegen unter ihren Warnschwellen.`;
  }

  cardLevel(metrics: MetricView[]): MonitoringLevel {
    return this.highestLevel(metrics);
  }

  alertLevel(metric: MetricView): Exclude<MonitoringLevel, 'ok'> | null {
    return metric.level === 'warning' || metric.level === 'critical' ? metric.level : null;
  }

  infrastructureLevel(status: 'ok' | 'unavailable'): MonitoringLevel {
    const redisStatus = this.healthCheck()?.redis;
    const serviceStatus = this.serviceStatus();
    if (status !== 'ok' || redisStatus !== 'ok' || serviceStatus === 'critical' || !serviceStatus) {
      return 'critical';
    }
    return serviceStatus === 'limited' ? 'warning' : 'ok';
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

  private metric(
    label: string,
    rawValue: number,
    threshold: Threshold | null,
    displayValue?: string,
  ): MetricView {
    return {
      label,
      value:
        displayValue ??
        (threshold?.percent ? this.formatPercent(rawValue) : this.formatCount(rawValue)),
      level: threshold ? this.levelFor(rawValue, threshold) : null,
      threshold: threshold ? this.thresholdLabel(threshold) : null,
    };
  }

  private levelFor(value: number, threshold: Threshold): MonitoringLevel {
    if (value >= threshold.critical) return 'critical';
    if (value >= threshold.warning) return 'warning';
    return 'ok';
  }

  private thresholdLabel(threshold: Threshold): string {
    const warning = threshold.percent
      ? this.formatPercent(threshold.warning)
      : this.formatCount(threshold.warning);
    const critical = threshold.percent
      ? this.formatPercent(threshold.critical)
      : this.formatCount(threshold.critical);
    return $localize`:@@admin.monitoringThresholds:Warnung ab ${warning}:warning:, kritisch ab ${critical}:critical:`;
  }

  private highestLevel(metrics: MetricView[]): MonitoringLevel {
    if (metrics.some((metric) => metric.level === 'critical')) return 'critical';
    if (metrics.some((metric) => metric.level === 'warning')) return 'warning';
    return 'ok';
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
