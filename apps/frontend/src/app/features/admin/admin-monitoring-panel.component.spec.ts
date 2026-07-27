import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthSecurityStatsDTO } from '@arsnova/shared-types';
import { AdminMonitoringPanelComponent } from './admin-monitoring-panel.component';
import { trpc } from '../../core/trpc.client';

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    admin: {
      monitoringStats: {
        query: vi.fn(),
      },
    },
    health: {
      check: {
        query: vi.fn(),
      },
      stats: {
        query: vi.fn(),
      },
    },
  },
}));

const statsFixture: HealthSecurityStatsDTO = {
  databaseStatus: 'ok',
  sessionCreatePerHour: 120,
  sessionCreateGlobalPerHour: 1_000,
  sessionCodeClientFailuresPerWindow: 20,
  pdfActiveJobs: 0,
  pdfMaxConcurrentJobs: 1,
  pdfCompletedLastMinute: 2,
  pdfFailedLastMinute: 0,
  pdfRejectedLastMinute: 0,
  sessionCreatesLastMinute: 3,
  adminLoginFailuresLastMinute: 0,
  cspReportsReceivedLastMinute: 0,
  cspReportsDroppedLastMinute: 0,
  cspReportsRateLimitedLastMinute: 0,
  cspReportsEvalLastMinute: 0,
  cspReportsScriptHttpsLastMinute: 0,
  rateLimit429LastMinute: 1,
  rateLimit429ByCategoryLastMinute: {
    adminLogin: 0,
    sessionCreate: 1,
    quizUpload: 0,
    quickFeedback: 0,
    sessionCode: 0,
    vote: 0,
    pdf: 0,
    motd: 0,
    other: 0,
  },
  sessionCodeFailuresLastMinute: 4,
  sessionCodeFailuresBySourceLastMinute: { join: 1, lookup: 1, pollReconnect: 2, other: 0 },
  sessionCodeEntryFailuresLastMinute: 2,
  sessionCodeSoftCapDelaysLastMinute: 0,
  sessionCodeSoftCapDelaysBySourceLastMinute: {
    join: 0,
    lookup: 0,
    pollReconnect: 0,
    other: 0,
  },
  sessionCodeEntrySoftCapDelaysLastMinute: 0,
  sessionCodeGlobalSoftCapUtilizationPercent: 2,
  trpcWebSocketConnectionsActive: 12,
  trpcWebSocketConnectionLimit: 1_000,
  trpcWebSocketBoundConnectionsActive: 10,
  trpcWebSocketSessionConnectionLimit: 800,
  trpcWebSocketParticipantConnectionLimit: 2,
  trpcWebSocketSessionCapRejectedLastMinute: 0,
  trpcWebSocketParticipantCapRejectedLastMinute: 0,
  trpcWebSocketRejectedUpgradesLastMinute: 0,
  trpcWebSocketPayloadRejectedLastMinute: 0,
  trpcWebSocketRateLimitedMessagesLastMinute: 0,
  yjsWebSocketConnectionsActive: 6,
  yjsWebSocketRoomsActive: 2,
  yjsWebSocketConnectionLimit: 1_000,
  yjsWebSocketPerRoomConnectionLimit: 200,
  yjsWebSocketRejectedUpgradesLastMinute: 0,
  yjsWebSocketRejectedUpgradesByReasonLastMinute: {
    globalRate: 0,
    invalidPath: 0,
    authorizationUnavailable: 0,
    legacyCutoff: 0,
    tokenRequired: 0,
    invalidToken: 0,
    staleGeneration: 0,
    roomRate: 0,
    globalConnectionCap: 0,
    roomConnectionCap: 0,
  },
  yjsWebSocketPayloadRejectedLastMinute: 0,
  yjsWebSocketRateLimitedMessagesLastMinute: 0,
  yjsWebSocketProtocolErrorsLastMinute: 0,
  yjsWebSocketDocumentRejectedLastMinute: 0,
  yjsWebSocketAwarenessRejectedLastMinute: 0,
  yjsWebSocketOutboundRejectedLastMinute: 0,
};

function setHealthyInfrastructure(component: AdminMonitoringPanelComponent): void {
  component.healthCheck.set({
    status: 'ok',
    timestamp: '2026-07-26T16:00:00.000Z',
    version: '0.1.0',
    redis: 'ok',
  });
  component.serviceStatus.set('stable');
}

describe('AdminMonitoringPanelComponent', () => {
  beforeEach(async () => {
    vi.mocked(trpc.admin.monitoringStats.query).mockResolvedValue(statsFixture);
    vi.mocked(trpc.health.check.query).mockResolvedValue({
      status: 'ok',
      timestamp: '2026-07-26T16:00:00.000Z',
      version: '0.1.0',
      redis: 'ok',
    });
    vi.mocked(trpc.health.stats.query).mockResolvedValue({
      openSessions: 0,
      activeSessions: 0,
      totalParticipants: 0,
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeBlitzRounds: 0,
      activeCountdownSessions: 0,
      completedSessions: 0,
      maxParticipantsSingleSession: 0,
      maxParticipantsStatisticUpdatedAt: null,
      dailyHighscores: [],
      dailyHighscoresStatistics: {
        median: 0,
        standardDeviation: 0,
        max: 0,
      },
      serviceStatus: 'stable',
      loadStatus: 'healthy',
    });
    await TestBed.configureTestingModule({
      imports: [AdminMonitoringPanelComponent, NoopAnimationsModule],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('lädt den geschützten Snapshot und zeigt Zusammenfassung sowie JSON', async () => {
    const fixture = TestBed.createComponent(AdminMonitoringPanelComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();

    expect(trpc.admin.monitoringStats.query).toHaveBeenCalledOnce();
    expect(trpc.health.check.query).toHaveBeenCalledOnce();
    expect(trpc.health.stats.query).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Live-Monitoring');
    expect(fixture.nativeElement.textContent).toContain('Gesamtzustand');
    expect(fixture.nativeElement.textContent).toContain('Alles in Ordnung');
    expect(fixture.nativeElement.textContent).toContain('Warnung ab 30, kritisch ab 60');
    expect(fixture.nativeElement.textContent).toContain('Fehlgeschlagene Join- und Codeprüfungen');
    expect(fixture.nativeElement.textContent).toContain('Offene Tabs (Poll/Reconnect)');
    expect(fixture.nativeElement.textContent).toContain('Hintergrundaktivität');
    expect(fixture.nativeElement.textContent).toContain('Alarmrelevante Signale');
    expect(fixture.nativeElement.textContent).toContain('Ungültige Sync-Tokens');
    expect(fixture.nativeElement.textContent).toContain('Ersetzte Sync-Tokens');
    expect(fixture.nativeElement.textContent).toContain('Infrastruktur');
    expect(fixture.nativeElement.textContent).toContain('PostgreSQL');
    expect(fixture.nativeElement.textContent).toContain('Vollständige JSON-Daten anzeigen');
    expect(fixture.componentInstance.formattedJson()).toContain('"sessionCreatesLastMinute": 3');

    fixture.destroy();
  });

  it('schlüsselt permanente Yjs-Ablehnungen nach Token-Ursache auf', () => {
    const fixture = TestBed.createComponent(AdminMonitoringPanelComponent);
    fixture.componentInstance.stats.set({
      ...statsFixture,
      yjsWebSocketRejectedUpgradesLastMinute: 25,
      yjsWebSocketRejectedUpgradesByReasonLastMinute: {
        ...statsFixture.yjsWebSocketRejectedUpgradesByReasonLastMinute,
        staleGeneration: 25,
      },
    });

    expect(fixture.componentInstance.yjsMetrics()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Ersetzte Sync-Tokens',
          value: '25',
        }),
      ]),
    );

    fixture.destroy();
  });

  it('zeigt automatische Fehlzugriffe separat und alarmiert nur Join- und Codeprüfungen', () => {
    const fixture = TestBed.createComponent(AdminMonitoringPanelComponent);
    setHealthyInfrastructure(fixture.componentInstance);
    fixture.componentInstance.stats.set({
      ...statsFixture,
      sessionCodeFailuresLastMinute: 5_000,
      sessionCodeFailuresBySourceLastMinute: {
        join: 0,
        lookup: 0,
        pollReconnect: 5_000,
        other: 0,
      },
      sessionCodeEntryFailuresLastMinute: 0,
    });

    expect(fixture.componentInstance.overallLevel()).toBe('ok');
    expect(fixture.componentInstance.sessionInfoMetrics()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Offene Tabs (Poll/Reconnect)',
          value: '5,000',
          level: null,
          kind: 'info',
        }),
      ]),
    );
    expect(
      fixture.componentInstance.cardLevel(fixture.componentInstance.sessionAlertMetrics()),
    ).toBe('ok');

    fixture.componentInstance.stats.update((stats) => ({
      ...stats!,
      sessionCodeEntryFailuresLastMinute: 500,
    }));
    expect(fixture.componentInstance.overallLevel()).toBe('critical');

    fixture.destroy();
  });

  it('priorisiert kritische Werte und zeigt Warnungen unterhalb der kritischen Schwelle', () => {
    const fixture = TestBed.createComponent(AdminMonitoringPanelComponent);
    setHealthyInfrastructure(fixture.componentInstance);
    const warningStats = { ...statsFixture, pdfFailedLastMinute: 1 };
    fixture.componentInstance.stats.set(warningStats);

    expect(fixture.componentInstance.overallLevel()).toBe('warning');
    expect(fixture.componentInstance.cardLevel(fixture.componentInstance.pdfMetrics())).toBe(
      'warning',
    );

    fixture.componentInstance.stats.set({
      ...statsFixture,
      cspReportsEvalLastMinute: 1,
    });
    expect(fixture.componentInstance.overallLevel()).toBe('warning');
    expect(fixture.componentInstance.cardLevel(fixture.componentInstance.securityMetrics())).toBe(
      'warning',
    );

    fixture.componentInstance.stats.set({
      ...warningStats,
      databaseStatus: 'unavailable',
    });
    expect(fixture.componentInstance.overallLevel()).toBe('critical');

    fixture.destroy();
  });

  it('nimmt Redis- und öffentlichen Service-Status in den Gesamtzustand auf', () => {
    const fixture = TestBed.createComponent(AdminMonitoringPanelComponent);
    fixture.componentInstance.stats.set(statsFixture);
    fixture.componentInstance.healthCheck.set({
      status: 'ok',
      timestamp: '2026-07-26T16:00:00.000Z',
      version: '0.1.0',
      redis: 'unavailable',
    });
    fixture.componentInstance.serviceStatus.set('stable');
    expect(fixture.componentInstance.overallLevel()).toBe('critical');

    fixture.componentInstance.healthCheck.update((health) => ({ ...health!, redis: 'ok' }));
    fixture.componentInstance.serviceStatus.set('limited');
    expect(fixture.componentInstance.overallLevel()).toBe('warning');

    fixture.componentInstance.serviceStatus.set('stable');
    expect(fixture.componentInstance.overallLevel()).toBe('ok');

    fixture.destroy();
  });

  it('behält den letzten Snapshot sichtbar, wenn eine Aktualisierung fehlschlägt', async () => {
    const fixture = TestBed.createComponent(AdminMonitoringPanelComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));

    vi.mocked(trpc.admin.monitoringStats.query).mockRejectedValueOnce(new Error('offline'));
    await fixture.componentInstance.refresh();
    fixture.detectChanges();

    expect(fixture.componentInstance.stats()).toEqual(statsFixture);
    expect(fixture.componentInstance.error()).toBe(
      'Monitoring-Daten konnten nicht geladen werden.',
    );

    fixture.destroy();
  });

  it('verwirft den Snapshot und beendet die Sitzung bei UNAUTHORIZED', async () => {
    const fixture = TestBed.createComponent(AdminMonitoringPanelComponent);
    const sessionExpired = vi.fn();
    fixture.componentInstance.sessionExpired.subscribe(sessionExpired);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));

    vi.mocked(trpc.admin.monitoringStats.query).mockRejectedValueOnce({
      data: { code: 'UNAUTHORIZED' },
      message: 'Admin-Authentifizierung erforderlich.',
    });
    await fixture.componentInstance.refresh();

    expect(fixture.componentInstance.stats()).toBeNull();
    expect(fixture.componentInstance.healthCheck()).toBeNull();
    expect(fixture.componentInstance.serviceStatus()).toBeNull();
    expect(fixture.componentInstance.refreshedAt()).toBeNull();
    expect(fixture.componentInstance.error()).toBeNull();
    expect(sessionExpired).toHaveBeenCalledOnce();

    fixture.destroy();
  });
});
