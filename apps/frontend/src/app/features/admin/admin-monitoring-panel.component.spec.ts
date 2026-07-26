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
  sessionCodeSoftCapDelaysLastMinute: 0,
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
  yjsWebSocketPayloadRejectedLastMinute: 0,
  yjsWebSocketRateLimitedMessagesLastMinute: 0,
  yjsWebSocketProtocolErrorsLastMinute: 0,
  yjsWebSocketDocumentRejectedLastMinute: 0,
  yjsWebSocketAwarenessRejectedLastMinute: 0,
  yjsWebSocketOutboundRejectedLastMinute: 0,
};

describe('AdminMonitoringPanelComponent', () => {
  beforeEach(async () => {
    vi.mocked(trpc.admin.monitoringStats.query).mockResolvedValue(statsFixture);
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
    await fixture.whenStable();
    fixture.detectChanges();

    expect(trpc.admin.monitoringStats.query).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Live-Monitoring');
    expect(fixture.nativeElement.textContent).toContain('Vollständige JSON-Daten anzeigen');
    expect(fixture.componentInstance.formattedJson()).toContain('"sessionCreatesLastMinute": 3');

    fixture.destroy();
  });

  it('behält den letzten Snapshot sichtbar, wenn eine Aktualisierung fehlschlägt', async () => {
    const fixture = TestBed.createComponent(AdminMonitoringPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();

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
    await fixture.whenStable();

    vi.mocked(trpc.admin.monitoringStats.query).mockRejectedValueOnce({
      data: { code: 'UNAUTHORIZED' },
      message: 'Admin-Authentifizierung erforderlich.',
    });
    await fixture.componentInstance.refresh();

    expect(fixture.componentInstance.stats()).toBeNull();
    expect(fixture.componentInstance.refreshedAt()).toBeNull();
    expect(fixture.componentInstance.error()).toBeNull();
    expect(sessionExpired).toHaveBeenCalledOnce();

    fixture.destroy();
  });
});
