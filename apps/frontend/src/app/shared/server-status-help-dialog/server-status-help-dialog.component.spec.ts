import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerStatusHelpDialogComponent } from './server-status-help-dialog.component';

function buildDailyHighscores() {
  return Array.from({ length: 100 }, (_, index) => ({
    date: `2026-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
    count: index + 1,
    updatedAt: `2026-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
  }));
}

describe('ServerStatusHelpDialogComponent', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows live metrics and the session attendance record when stats are available', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusHelpDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            connectionOk: signal(true),
            loading: signal(false),
            stats: signal({
              openSessions: 11,
              activeSessions: 6,
              totalParticipants: 145,
              votesLastMinute: 87,
              sessionTransitionsLastMinute: 14,
              activeCountdownSessions: 5,
              completedSessions: 98,
              activeBlitzRounds: 3,
              maxParticipantsSingleSession: 412,
              dailyHighscores: buildDailyHighscores(),
              dailyHighscoresStatistics: {
                sampleSize: 100,
                median: 50,
                iqr: 25,
                max: 100,
              },
              maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
              serviceStatus: 'limited',
              loadStatus: 'busy',
              dependencies: { api: 'ok', database: 'ok', redis: 'ok', live: 'ok' },
              coreActionsQuality: {
                join: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                vote: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                qaRead: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                qaSubmit: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                qaRate: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
              },
              trafficQuality: {
                measurementState: 'AVAILABLE' as const,
                windowSeconds: 60 as const,
                bucketSeconds: 10 as const,
                observedWindowSeconds: 60,
                windowComplete: true,
                avgRps: 1.5,
                peakRps: 3,
                sampleSize: 90,
                errorRatePercent: 0.2,
                errorClasses: { server: 0, rateLimit: 0, client: 1 },
                p95LatencyMs: 200,
                p99LatencyMs: 400,
                latencyIncludesFailedRequests: true as const,
                insufficientLatencySample: false,
                monitoredProcedures: 14,
                definedProcedures: 14,
                groups: [],
                lastSuccessfulReadAt: '2026-04-05T10:15:00.000Z',
              },
              liveConnections: {
                measurementState: 'AVAILABLE' as const,
                trpcOpen: 2,
                yjsOpen: 1,
                trpcOpenedLastMinute: 3,
                trpcClosedLastMinute: 1,
                yjsOpenedLastMinute: 2,
                yjsClosedLastMinute: 1,
                rejectsLastMinute: 0,
                rateLimitedMessagesLastMinute: 0,
                reconnectsLastMinute: null,
                messagesPerSecond: null,
                lastSuccessfulReadAt: '2026-04-05T10:15:00.000Z',
                deliveryNotMeasured: true as const,
              },
              sloSampleSizeLastMinute: 0,
              measurementAvailable: true,
              usage: {
                timezone: 'UTC' as const,
                periodKind: 'LAST_30_DAYS' as const,
                periodFrom: '2026-04-05',
                periodTo: '2026-05-04',
                trackingStartedAt: null,
                lastAggregatedAt: null,
                historyComplete: false,
                sessionsUsed: null,
                sessionParticipations: null,
                quizAnswers: null,
                qaQuestionsAccepted: null,
                qaRatingActions: null,
                sessionsByFunction: null,
                dailySeries: [
                  {
                    date: '2026-04-05',
                    sessionsUsed: 3,
                    sessionParticipations: 12,
                    quizAnswers: 8,
                    qaQuestionsAccepted: 2,
                  },
                ],
                monthlySeries: [
                  {
                    yearMonth: '2026-04',
                    sessionsUsed: 3,
                    sessionParticipations: 12,
                    quizAnswers: 8,
                    qaQuestionsAccepted: 2,
                  },
                ],
                sizeDistribution: null,
                qaQuestionsTotalLifetime: 0,
                completedSessionsLifetime: 0,
              },
              activeQaSessions: 2,
              qaQuestionsLastMinute: 4,
              qaRatingsLastMinute: 1,
              qaQuestionsTotal: 98,
              maxQaQuestionsSingleSession: 40,
              qaStatisticsTrackingStartedAt: null,
              qaStatisticsProjectedAt: null,
              maxQaQuestionsStatisticUpdatedAt: null,
              statsGeneratedAt: '2026-04-05T10:15:00.000Z',
              qaMinuteMetricsStatus: 'AVAILABLE',
              qaPresenceMetricsStatus: 'AVAILABLE',
            }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ServerStatusHelpDialogComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Betrieb & Nutzung');
    expect(text).toContain('Gesamtzustand');
    expect(text).toContain(
      'Die Statusanzeige findest du im Footer-Menü »Mehr«. Sie zeigt den Betriebszustand — nicht die Nutzungsaktivität.',
    );
    expect(text).toContain('Aktuelle Aktivität:');
    expect(text).toContain('Funktioniert arsnova.eu gerade zuverlässig?');
    expect(text).toContain('Aktuelle Aktivität');
    expect(text).toContain('Dynamik (letzte Minute)');
    expect(text).toContain('Aktive Sessions');
    expect(text).toContain('Nutzbare Sessions');
    expect(text).toContain('145');
    expect(text).toContain('Abstimmungen / Minute');
    expect(text).toContain('Statuswechsel / Minute');
    expect(text).toContain('Countdown-Sessions');
    expect(text).toContain('Offenes Q&A nach Quizende zählt hier nicht');
    expect(text).toContain('Noch gültige Beitrittsfrist');
    expect(text).toContain('Anwesende in nutzbaren Sessions');
    expect(text).toContain('Erfolgreiche Quizantworten im rollierenden Minutenfenster');
    expect(text).toContain('Monotone Gesamtzahl beendeter Sessions');
    expect(text).toContain('98');
    expect(text).toContain('Kernfunktionen');
    expect(text).toContain('Servicequalität');
    expect(text).toContain('Betrieb');
    expect(text).toContain('Nutzung');

    const tabLabels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.mat-mdc-tab .mdc-tab__text-label'),
    ).map((el) => el.textContent?.trim());
    expect(tabLabels).toEqual(expect.arrayContaining(['Betrieb', 'Nutzung']));

    const usageTab = (fixture.nativeElement as HTMLElement).querySelectorAll('.mat-mdc-tab')[1] as
      HTMLElement | undefined;
    usageTab?.click();
    fixture.detectChanges();
    const usageText = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(usageText).toContain('Wie häufig und wofür wird arsnova.eu genutzt?');
    expect(usageText).toContain('Kennzahlen im Zeitraum');
    expect(usageText).toContain('Tages- und Monatsverlauf');
    expect(usageText).toContain('Join-Rekorde (Legacy)');
    expect(usageText).toContain('Letzte 30 Tage');
    expect(usageText).toContain('Aktuelles Semester');
    expect(usageText).toContain('Zeitraum wählen');
    expect(usageText).toContain('Genutzte Sessions');

    const seriesDetails = (fixture.nativeElement as HTMLElement).querySelector(
      '.status-help-dialog__disclosure:not(.status-help-dialog__disclosure--legacy)',
    ) as HTMLDetailsElement | null;
    expect(seriesDetails).not.toBeNull();
    expect(seriesDetails!.open).toBe(false);

    // Verlauf und Legacy sind standardmäßig eingeklappt (Chart erst nach Öffnen).
    expect((fixture.nativeElement as HTMLElement).querySelector('canvas')).toBeNull();

    const legacyDetails = (fixture.nativeElement as HTMLElement).querySelector(
      '.status-help-dialog__disclosure--legacy',
    ) as HTMLDetailsElement | null;
    expect(legacyDetails).not.toBeNull();
    expect(legacyDetails!.open).toBe(false);
    legacyDetails!.open = true;
    legacyDetails!.dispatchEvent(new Event('toggle'));
    fixture.detectChanges();
    const expandedText = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(expandedText).toContain('Höchste Join-Teilnahme einer Session');
    expect(expandedText).toContain('Join-Höchststände je Tag');
    expect(expandedText).toContain('412');
    expect((fixture.nativeElement as HTMLElement).querySelector('canvas')).not.toBeNull();
  });

  it('shows a loading fallback when the first live request has not finished yet', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusHelpDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            connectionOk: signal(true),
            loading: signal(true),
            stats: signal(null),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ServerStatusHelpDialogComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Live-Daten werden geladen');
    expect(text).not.toContain('Rekordteilnahme');
  });

  it('rerenders the history chart when the app theme changes', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusHelpDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            connectionOk: signal(true),
            loading: signal(false),
            stats: signal({
              openSessions: 4,
              activeSessions: 2,
              totalParticipants: 48,
              votesLastMinute: 7,
              sessionTransitionsLastMinute: 3,
              activeCountdownSessions: 1,
              completedSessions: 12,
              activeBlitzRounds: 0,
              maxParticipantsSingleSession: 96,
              dailyHighscores: buildDailyHighscores(),
              dailyHighscoresStatistics: {
                sampleSize: 100,
                median: 50,
                iqr: 25,
                max: 100,
              },
              maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
              serviceStatus: 'stable',
              loadStatus: 'healthy',
              dependencies: { api: 'ok', database: 'ok', redis: 'ok', live: 'ok' },
              coreActionsQuality: {
                join: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                vote: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                qaRead: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                qaSubmit: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                qaRate: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
              },
              trafficQuality: {
                measurementState: 'AVAILABLE' as const,
                windowSeconds: 60 as const,
                bucketSeconds: 10 as const,
                observedWindowSeconds: 60,
                windowComplete: true,
                avgRps: 1.5,
                peakRps: 3,
                sampleSize: 90,
                errorRatePercent: 0.2,
                errorClasses: { server: 0, rateLimit: 0, client: 1 },
                p95LatencyMs: 200,
                p99LatencyMs: 400,
                latencyIncludesFailedRequests: true as const,
                insufficientLatencySample: false,
                monitoredProcedures: 14,
                definedProcedures: 14,
                groups: [],
                lastSuccessfulReadAt: '2026-04-05T10:15:00.000Z',
              },
              liveConnections: {
                measurementState: 'AVAILABLE' as const,
                trpcOpen: 2,
                yjsOpen: 1,
                trpcOpenedLastMinute: 3,
                trpcClosedLastMinute: 1,
                yjsOpenedLastMinute: 2,
                yjsClosedLastMinute: 1,
                rejectsLastMinute: 0,
                rateLimitedMessagesLastMinute: 0,
                reconnectsLastMinute: null,
                messagesPerSecond: null,
                lastSuccessfulReadAt: '2026-04-05T10:15:00.000Z',
                deliveryNotMeasured: true as const,
              },
              sloSampleSizeLastMinute: 0,
              measurementAvailable: true,
              usage: {
                timezone: 'UTC' as const,
                periodKind: 'LAST_30_DAYS' as const,
                periodFrom: '2026-04-05',
                periodTo: '2026-05-04',
                trackingStartedAt: null,
                lastAggregatedAt: null,
                historyComplete: false,
                sessionsUsed: null,
                sessionParticipations: null,
                quizAnswers: null,
                qaQuestionsAccepted: null,
                qaRatingActions: null,
                sessionsByFunction: null,
                dailySeries: [],
                monthlySeries: [],
                sizeDistribution: null,
                qaQuestionsTotalLifetime: 0,
                completedSessionsLifetime: 0,
              },
              activeQaSessions: null,
              qaQuestionsLastMinute: null,
              qaRatingsLastMinute: null,
              qaQuestionsTotal: 0,
              maxQaQuestionsSingleSession: 0,
              qaStatisticsTrackingStartedAt: null,
              qaStatisticsProjectedAt: null,
              maxQaQuestionsStatisticUpdatedAt: null,
              statsGeneratedAt: '2026-04-05T10:15:00.000Z',
              qaMinuteMetricsStatus: 'UNAVAILABLE',
              qaPresenceMetricsStatus: 'UNAVAILABLE',
            }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ServerStatusHelpDialogComponent);
    const component = fixture.componentInstance as ServerStatusHelpDialogComponent & {
      syncChart: (stats: unknown, canvas: HTMLCanvasElement) => Promise<void>;
    };
    const syncChartSpy = vi.spyOn(component, 'syncChart').mockResolvedValue();

    fixture.detectChanges();
    const usageTab = (fixture.nativeElement as HTMLElement).querySelectorAll('.mat-mdc-tab')[1] as
      HTMLElement | undefined;
    usageTab?.click();
    fixture.detectChanges();

    const legacyDetails = (fixture.nativeElement as HTMLElement).querySelector(
      '.status-help-dialog__disclosure--legacy',
    ) as HTMLDetailsElement | null;
    expect(legacyDetails).not.toBeNull();
    legacyDetails!.open = true;
    legacyDetails!.dispatchEvent(new Event('toggle'));
    fixture.detectChanges();
    expect(syncChartSpy).toHaveBeenCalled();

    const callsAfterOpen = syncChartSpy.mock.calls.length;
    globalThis.dispatchEvent(new Event('arsnova:preset-updated'));
    expect(syncChartSpy.mock.calls.length).toBeGreaterThan(callsAfterOpen);
  });

  it('hält Ampel-Badges, Legend-Borders und Panel-Padding konsistent', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const dir = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(dir, 'server-status-help-dialog.component.scss'), 'utf8');
    const styles = readFileSync(join(dir, '../../../styles.scss'), 'utf8');

    expect(scss).toMatch(
      /\.status-help-dialog__status-badge--healthy\s*\{[^}]*--app-status-healthy/,
    );
    expect(scss).toMatch(/\.status-help-dialog__status-badge--busy\s*\{[^}]*--app-status-busy/);
    expect(scss).toMatch(
      /\.status-help-dialog__legend-item\s*\{[^}]*border:\s*1px solid transparent/,
    );
    expect(scss).toMatch(
      /\.status-help-dialog__legend-item--healthy\s*\{[^}]*border-color:\s*color-mix\([^)]*--app-status-healthy/,
    );
    expect(scss).not.toContain('status-help-dialog__status-badge-wrapper');
    expect(scss).not.toMatch(/\.status-help-dialog__legend li\s*\{/);
    expect(scss).not.toContain('!important');
    expect(styles).toMatch(
      /\.app-status-help-dialog-panel \.mat-mdc-dialog-content\s*\{[^}]*padding:\s*0 1rem 0\.5rem/,
    );
    expect(styles).toMatch(
      /html\.preset-playful[\s\S]*\.cdk-overlay-pane:not\(\.word-cloud-dialog-panel\)[\s\S]*\.mat-mdc-dialog-surface/,
    );

    TestBed.configureTestingModule({
      imports: [ServerStatusHelpDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            connectionOk: signal(true),
            loading: signal(false),
            stats: signal({
              openSessions: 1,
              activeSessions: 1,
              totalParticipants: 2,
              votesLastMinute: 0,
              sessionTransitionsLastMinute: 0,
              activeCountdownSessions: 0,
              completedSessions: 0,
              activeBlitzRounds: 0,
              maxParticipantsSingleSession: 2,
              dailyHighscores: buildDailyHighscores(),
              dailyHighscoresStatistics: { sampleSize: 2, median: 1, iqr: 1, max: 2 },
              maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
              serviceStatus: 'stable',
              loadStatus: 'healthy',
              dependencies: { api: 'ok', database: 'ok', redis: 'ok', live: 'ok' },
              coreActionsQuality: {
                join: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                vote: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                qaRead: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                qaSubmit: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
                qaRate: {
                  samples: 0,
                  errorRatePercent: null,
                  p95Ms: null,
                  p99Ms: null,
                  coverage: 'UNAVAILABLE',
                },
              },
              trafficQuality: {
                measurementState: 'AVAILABLE' as const,
                windowSeconds: 60 as const,
                bucketSeconds: 10 as const,
                observedWindowSeconds: 60,
                windowComplete: true,
                avgRps: 1.5,
                peakRps: 3,
                sampleSize: 90,
                errorRatePercent: 0.2,
                errorClasses: { server: 0, rateLimit: 0, client: 1 },
                p95LatencyMs: 200,
                p99LatencyMs: 400,
                latencyIncludesFailedRequests: true as const,
                insufficientLatencySample: false,
                monitoredProcedures: 14,
                definedProcedures: 14,
                groups: [],
                lastSuccessfulReadAt: '2026-04-05T10:15:00.000Z',
              },
              liveConnections: {
                measurementState: 'AVAILABLE' as const,
                trpcOpen: 2,
                yjsOpen: 1,
                trpcOpenedLastMinute: 3,
                trpcClosedLastMinute: 1,
                yjsOpenedLastMinute: 2,
                yjsClosedLastMinute: 1,
                rejectsLastMinute: 0,
                rateLimitedMessagesLastMinute: 0,
                reconnectsLastMinute: null,
                messagesPerSecond: null,
                lastSuccessfulReadAt: '2026-04-05T10:15:00.000Z',
                deliveryNotMeasured: true as const,
              },
              sloSampleSizeLastMinute: 0,
              measurementAvailable: true,
              usage: {
                timezone: 'UTC' as const,
                periodKind: 'LAST_30_DAYS' as const,
                periodFrom: '2026-04-05',
                periodTo: '2026-05-04',
                trackingStartedAt: null,
                lastAggregatedAt: null,
                historyComplete: false,
                sessionsUsed: null,
                sessionParticipations: null,
                quizAnswers: null,
                qaQuestionsAccepted: null,
                qaRatingActions: null,
                sessionsByFunction: null,
                dailySeries: [],
                monthlySeries: [],
                sizeDistribution: null,
                qaQuestionsTotalLifetime: 0,
                completedSessionsLifetime: 0,
              },
              activeQaSessions: null,
              qaQuestionsLastMinute: null,
              qaRatingsLastMinute: null,
              qaQuestionsTotal: 0,
              maxQaQuestionsSingleSession: 0,
              qaStatisticsTrackingStartedAt: null,
              qaStatisticsProjectedAt: null,
              maxQaQuestionsStatisticUpdatedAt: null,
              statsGeneratedAt: '2026-04-05T10:15:00.000Z',
              qaMinuteMetricsStatus: 'UNAVAILABLE',
              qaPresenceMetricsStatus: 'UNAVAILABLE',
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ServerStatusHelpDialogComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.status-help-dialog__legend-label')).toBeTruthy();
    expect(root.querySelector('.status-help-dialog__status-badge--healthy')).toBeTruthy();
    expect(root.querySelector('.status-help-dialog__status-badge-wrapper')).toBeNull();
  });
});
