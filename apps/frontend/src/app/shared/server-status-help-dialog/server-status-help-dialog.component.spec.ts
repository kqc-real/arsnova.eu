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
              activeSessions: 6,
              totalParticipants: 145,
              completedSessions: 98,
              activeBlitzRounds: 3,
              maxParticipantsSingleSession: 412,
              maxParticipantsStatisticUpdatedAt: '2026-04-05T10:15:00.000Z',
              serverStatus: 'busy',
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ServerStatusHelpDialogComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Server-Statistik');
    expect(text).toContain('Jetzt auf dem Server');
    expect(text).toContain('145');
    expect(text).toContain('Summe über alle laufenden Live-Sessions');
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
