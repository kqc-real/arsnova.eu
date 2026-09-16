import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { SessionExpirationDialogComponent } from './session-expiration-dialog.component';

const lifecycle = {
  status: 'ACTIVE' as const,
  createdAt: '2026-03-24T12:00:00.000Z',
  expiresAt: '2026-03-25T12:00:00.000Z',
  endedAt: null,
  qaClosesAt: '2026-03-25T12:00:00.000Z',
  firstParticipantJoinedAt: '2026-03-24T12:05:00.000Z',
  timeZone: 'Europe/Berlin',
  sessionLifecycleRevision: 2,
  serverNow: '2026-03-25T11:30:00.000Z',
  maxExpiresAt: '2026-04-07T12:00:00.000Z',
  originalHost: true,
  extensionAllowed: true,
  configurationAllowed: false,
};

describe('SessionExpirationDialogComponent', () => {
  it('erklärt gekoppelten Hosts die fehlende Verlängerungsberechtigung ohne Auswahlbuttons', () => {
    TestBed.configureTestingModule({
      imports: [SessionExpirationDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'GLOBAL_WARNING',
            warningMinutes: 30,
            lifecycle: { ...lifecycle, originalHost: false, extensionAllowed: false },
          },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(SessionExpirationDialogComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dialog-title-header')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Nur der ursprüngliche Host kann die globale Sessionfrist verlängern.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Um 1 Stunde');
  });

  it('benennt die Anfangskonfiguration ausdrücklich als Q&A-Obergrenze', () => {
    TestBed.configureTestingModule({
      imports: [SessionExpirationDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'INITIAL_CONFIGURATION',
            lifecycle: { ...lifecycle, firstParticipantJoinedAt: null, configurationAllowed: true },
          },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(SessionExpirationDialogComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Maximales Q&A-Ende');
    expect(text).toContain('Damit setzt du das Sessionende');
    expect(text).toContain('Aktuelles maximales Q&A-Ende');
    expect(text).not.toContain('Aktuelles Sessionende');
  });

  it('liefert Kalendertage für die serverseitige Vorschau', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [SessionExpirationDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'INITIAL_CONFIGURATION',
            lifecycle: { ...lifecycle, firstParticipantJoinedAt: null, configurationAllowed: true },
          },
        },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(SessionExpirationDialogComponent);
    const component = fixture.componentInstance;
    component.days.set(7);

    component.chooseDays();

    expect(close).toHaveBeenCalledWith({
      purpose: 'INITIAL_CONFIGURATION',
      selection: { kind: 'DURATION_DAYS', days: 7 },
      timeZone: 'Europe/Berlin',
    });
  });

  it('erklärt dem Originalhost die erreichte Obergrenze ohne Verlängerungsbuttons', () => {
    TestBed.configureTestingModule({
      imports: [SessionExpirationDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'GLOBAL_WARNING',
            warningMinutes: 5,
            lifecycle: { ...lifecycle, extensionAllowed: false },
          },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(SessionExpirationDialogComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Die maximale Sessiondauer ist erreicht.');
    expect(fixture.nativeElement.textContent).not.toContain('Um 1 Stunde');
  });

  it('stellt in der Warnung Sessionende und unveränderten Q&A-Schluss gegenüber', () => {
    TestBed.configureTestingModule({
      imports: [SessionExpirationDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'GLOBAL_WARNING',
            warningMinutes: 30,
            lifecycle,
          },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(SessionExpirationDialogComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Q&A schließt unabhängig davon weiterhin');
    expect(text).toContain('1 Stunde');
    expect(text).toContain('1 Tag');
    expect(text).toContain('7 Tage');
    expect(text).toContain('Verlängern um');
  });
});
