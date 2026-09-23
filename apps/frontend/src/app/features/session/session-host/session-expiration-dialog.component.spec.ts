import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { sessionLocalDateTimeToIso } from '../session-local-datetime';
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
    expect(text).toContain('Der erste Zeitpunkt beendet den Zugang für Teilnehmende');
    expect(text).toContain('Zugang für Teilnehmende endet:');
    expect(text).toContain('Fragen einsehen kannst du bis:');
    expect(text).toContain('Anzahl der Tage');
    expect(text).toContain('Neuer Zugang für Teilnehmende');
    expect(text).toContain('Fragen einsehen kannst du dann bis');
    expect(text).not.toContain('Bis Datum und Uhrzeit');
    expect(text).not.toContain('Für Kalendertage');
    expect(text).not.toContain('Aktuelles Sessionende');
    expect(fixture.nativeElement.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(fixture.componentInstance.days()).toBe(1);
    expect(text).toContain(
      fixture.componentInstance.formatDateTime(fixture.componentInstance.resolvedDaysEnd()!),
    );
  });

  it('bietet kurz nach Erstellung weiter 14 Kalendertage ab createdAt', () => {
    TestBed.configureTestingModule({
      imports: [SessionExpirationDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'INITIAL_CONFIGURATION',
            lifecycle: {
              ...lifecycle,
              createdAt: '2026-03-24T12:00:00.000Z',
              firstParticipantJoinedAt: null,
              configurationAllowed: true,
              serverNow: '2026-03-24T12:30:00.000Z',
              maxExpiresAt: '2026-04-07T12:00:00.000Z',
            },
          },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(SessionExpirationDialogComponent);
    expect(fixture.componentInstance.maxSelectableDays()).toBe(14);
  });

  it('weist eine Tageszahl über der Betreiberobergrenze zurück', () => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [SessionExpirationDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'INITIAL_CONFIGURATION',
            lifecycle: {
              ...lifecycle,
              firstParticipantJoinedAt: null,
              configurationAllowed: true,
              serverNow: '2026-03-24T12:00:00.000Z',
              maxExpiresAt: '2026-03-27T12:00:00.000Z',
            },
          },
        },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(SessionExpirationDialogComponent);
    const component = fixture.componentInstance;
    component.days.set(30);

    component.chooseDays();

    expect(close).not.toHaveBeenCalled();
    expect(component.inputError()).toContain('1 bis 3');
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

  it('lässt eine abgelehnte Frist im Dialog stehen', async () => {
    const close = vi.fn();
    const dialogRef = { close, disableClose: false };
    TestBed.configureTestingModule({
      imports: [SessionExpirationDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'INITIAL_CONFIGURATION',
            lifecycle: { ...lifecycle, firstParticipantJoinedAt: null, configurationAllowed: true },
            submit: vi.fn(async () => {
              throw new Error(
                'Die Sessionfrist kann nicht vor die bestehende Q&A-Frist gesetzt werden.',
              );
            }),
          },
        },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(SessionExpirationDialogComponent);
    fixture.componentInstance.days.set(7);

    await fixture.componentInstance.chooseDays();

    expect(close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.inputError()).toContain('bestehende Q&A-Frist');
    expect(dialogRef.disableClose).toBe(false);
  });

  it('sperrt Abbrechen und disableClose während eines laufenden Speicherns', async () => {
    let resolveSubmit!: (value: boolean) => void;
    const submit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const close = vi.fn();
    const dialogRef = { close, disableClose: false };
    TestBed.configureTestingModule({
      imports: [SessionExpirationDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'INITIAL_CONFIGURATION',
            lifecycle: { ...lifecycle, firstParticipantJoinedAt: null, configurationAllowed: true },
            submit,
          },
        },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(SessionExpirationDialogComponent);
    fixture.componentInstance.days.set(7);
    fixture.detectChanges();

    const pending = fixture.componentInstance.chooseDays();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.componentInstance.checking()).toBe(true);
    expect(dialogRef.disableClose).toBe(true);
    const cancel = fixture.nativeElement.querySelector(
      'mat-dialog-actions button',
    ) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    fixture.componentInstance.close();
    expect(close).not.toHaveBeenCalled();

    resolveSubmit(false);
    await pending;
    fixture.detectChanges();

    expect(fixture.componentInstance.checking()).toBe(false);
    expect(dialogRef.disableClose).toBe(false);
    expect(close).not.toHaveBeenCalled();
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

  it('stellt in der Warnung Sessionende und unveränderten Teilnehmerzugang gegenüber', () => {
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
    expect(text).toContain('Der Zugang für Teilnehmende bleibt unverändert');
    expect(text).toContain('Zugang für Teilnehmende endet weiterhin');
    expect(text).toContain('1 Stunde');
    expect(text).toContain('1 Tag');
    expect(text).toContain('7 Tage');
    expect(text).toContain('Verlängern um');
  });

  it('begrenzt den Datepicker der Anfangskonfiguration auf Serverjetzt bis maxExpiresAt', () => {
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
    fixture.componentInstance.onDeadlineKindChange('ABSOLUTE');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement | null;
    expect(fixture.nativeElement.querySelector('input[type="number"]')).toBeNull();
    expect(input?.getAttribute('min')).toBe('2026-03-25T12:31');
    expect(input?.getAttribute('max')).toBe('2026-04-07T14:00');
    expect(input).not.toBeNull();
    const showPicker = vi.fn();
    Object.defineProperty(input, 'showPicker', { value: showPicker });
    input?.click();
    expect(showPicker).toHaveBeenCalled();
  });

  it('begrenzt den Verlängerungs-Datepicker auf nach dem bisherigen Sessionende', () => {
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

    const input = fixture.nativeElement.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement | null;
    expect(input?.getAttribute('min')).toBe('2026-03-25T13:01');
    expect(input?.getAttribute('max')).toBe('2026-04-07T14:00');
  });

  it('bestätigt kein Datum außerhalb von min/max', () => {
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
    const input = document.createElement('input');
    input.type = 'datetime-local';
    vi.spyOn(input, 'checkValidity').mockReturnValue(false);
    const reportValidity = vi.spyOn(input, 'reportValidity').mockReturnValue(false);

    fixture.componentInstance.chooseAbsolute(input);

    expect(reportValidity).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('übernimmt das sichtbare Datum statt eines älteren Modellwerts', () => {
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
    fixture.componentInstance.absoluteLocal.set('2026-03-25T13:00');
    const input = document.createElement('input');
    input.type = 'datetime-local';
    input.value = '2026-04-01T15:30';
    vi.spyOn(input, 'checkValidity').mockReturnValue(true);

    fixture.componentInstance.chooseAbsolute(input);

    expect(close).toHaveBeenCalledWith({
      purpose: 'INITIAL_CONFIGURATION',
      selection: {
        kind: 'ABSOLUTE',
        expiresAt: sessionLocalDateTimeToIso('2026-04-01T15:30', 'Europe/Berlin'),
      },
      timeZone: 'Europe/Berlin',
    });
  });
});
