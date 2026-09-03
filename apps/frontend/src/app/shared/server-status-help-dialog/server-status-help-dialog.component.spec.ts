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
                median: 50,
                standardDeviation: 12.4,
                max: 100,
              },
              maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
              serviceStatus: 'limited',
              loadStatus: 'busy',
            }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ServerStatusHelpDialogComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Betriebsstatus & Systemlast');
    expect(text).toContain('Systemlast-Indikatoren');
    expect(text).toContain(
      'Die Statusanzeige findest du im Footer-Menü „Mehr“. Sie zeigt, wie stabil Live-Quizze gerade laufen.',
    );
    expect(text).toContain('Systemlast:');
    expect(text).toContain('Aktuelle Lage');
    expect(text).toContain('Aktuelle Dynamik');
    expect(text).toContain('Aktive Sessions');
    expect(text).toContain('Offene Sessions');
    expect(text).toContain('145');
    expect(text).toContain('Abstimmungen / Minute');
    expect(text).toContain('Statuswechsel / Minute');
    expect(text).toContain('Countdown-Sessions');
    expect(text).toContain('Mindestens 5 aktive Teilnehmende in den letzten 3 Minuten');
    expect(text).toContain('Noch nicht beendet');
    expect(text).toContain('Summe über alle offenen Sessions in den letzten 3 Minuten');
    expect(text).toContain('Neue Antworten im letzten Minutenfenster');
    expect(text).toContain('Sessions, die gerade sichtbar weiterlaufen');
    expect(text).toContain('Mit laufendem Countdown im aktuellen Aktivitätsfenster');
    expect(text).toContain('Alle je beendeten Live-Sessions (kumulativ)');
    expect(text).toContain('98');
    expect(text).toContain('Rekordteilnahme');
    expect(text).toContain('Session-Tagesrekorde der letzten 100 Tage');
    expect(text).toContain(
      'Jeder Punkt zeigt den Rekord der größten einzelnen Session eines UTC-Tages.',
    );
    expect(text).toContain('Median');
    expect(text).toContain('Typischer Wert über alle bisher erfassten Tagesrekorde.');
    expect(text).toContain('Standardabweichung');
    expect(text).toContain('Streuung über alle bisher erfassten Tagesrekorde.');
    expect(text).toContain('Maximum');
    expect(text).toContain('Höchster Wert innerhalb der letzten 100 UTC-Tage im Diagramm.');
    expect(text).toContain('50');
    expect(text).toContain('12');
    expect(text).toContain('100');
    expect(text).toContain('412');
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
                median: 50,
                standardDeviation: 12.4,
                max: 100,
              },
              maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
              serviceStatus: 'stable',
              loadStatus: 'healthy',
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
    expect(syncChartSpy).toHaveBeenCalledTimes(1);

    globalThis.dispatchEvent(new Event('arsnova:preset-updated'));
    expect(syncChartSpy).toHaveBeenCalledTimes(2);
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
      /html\.preset-playful \.app-status-help-dialog-panel \.mat-mdc-dialog-surface\s*\{/,
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
              dailyHighscoresStatistics: { median: 1, standardDeviation: 0, max: 2 },
              maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
              serviceStatus: 'stable',
              loadStatus: 'healthy',
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
