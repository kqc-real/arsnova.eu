import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { describe, expect, it } from 'vitest';
import { ServerStatusHelpDialogComponent } from './server-status-help-dialog.component';

describe('ServerStatusHelpDialogComponent', () => {
  it('shows live metrics and the session attendance record when stats are available', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusHelpDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            connectionOk: true,
            loading: false,
            stats: {
              openSessions: 11,
              activeSessions: 6,
              totalParticipants: 145,
              votesLastMinute: 87,
              sessionTransitionsLastMinute: 14,
              activeCountdownSessions: 5,
              completedSessions: 98,
              activeBlitzRounds: 3,
              maxParticipantsSingleSession: 412,
              maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
              serviceStatus: 'limited',
              loadStatus: 'busy',
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ServerStatusHelpDialogComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Betriebsstatus & Systemlast');
    expect(text).toContain('Systemlast-Indikatoren');
    expect(text).toContain('Die Ampel unten zeigt, wie stabil das System gerade läuft.');
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
    expect(text).toContain('Rekordteilnahme');
    expect(text).toContain('412');
  });

  it('shows a loading fallback when the first live request has not finished yet', () => {
    TestBed.configureTestingModule({
      imports: [ServerStatusHelpDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            connectionOk: true,
            loading: true,
            stats: null,
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
});
