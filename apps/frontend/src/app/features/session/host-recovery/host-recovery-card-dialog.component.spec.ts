import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostRecoveryCardDialogComponent } from './host-recovery-card-dialog.component';

const CARD = {
  supportId: 'ARS-ABCD-2345',
  recoveryCode: 'New-recovery_capability-abcdefghijklmnopqrstuvwxyz',
};

describe('HostRecoveryCardDialogComponent', () => {
  const close = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostRecoveryCardDialogComponent],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: CARD },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
  });

  it('zeigt die Material-3-Titelzeile, Abbrechen und ein zunächst gesperrtes Fertig', () => {
    const fixture = TestBed.createComponent(HostRecoveryCardDialogComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.dialog-title-header')).not.toBeNull();
    expect(host.querySelector('.dialog-title-header__icon mat-icon')?.textContent?.trim()).toBe(
      'admin_panel_settings',
    );
    expect(host.textContent).toContain('Host-Zugang sichern');
    expect(host.textContent).not.toContain('Schritt 2 von 2');
    expect(host.textContent).toContain('in diesem Browser gespeichert');
    expect(host.textContent).toContain('anderen Browser');
    expect(host.textContent).toContain('Wiederherstellungsseite');
    expect(host.textContent).toContain('Session-Kennung');
    expect(host.textContent).toContain('sechsstelligen Teilnahme-Code');
    expect(host.textContent).toContain('Berechtigung für diese Session prüfen');
    expect(host.textContent).toContain('Kontaktdaten im Impressum');
    const imprintLink = host.querySelector('a[href*="/legal/imprint"]') as HTMLAnchorElement | null;
    expect(imprintLink?.textContent?.trim()).toBe('Kontaktdaten im Impressum');
    expect(imprintLink?.getAttribute('href') ?? '').not.toContain('host-recovery');
    expect(host.textContent).not.toContain('ABC123');
    expect(host.textContent).not.toContain('Sessioncode');
    const recoveryLink = host.querySelector(
      '.recovery-card__recovery-url a',
    ) as HTMLAnchorElement | null;
    expect(recoveryLink?.getAttribute('href') ?? '').toContain('host-recovery');
    expect(recoveryLink?.textContent ?? '').toContain('host-recovery');
    expect(host.querySelector('[data-testid="host-recovery-card-cancel"]')?.textContent).toContain(
      'Abbrechen',
    );
    const done = host.querySelector(
      '[data-testid="host-recovery-card-done"]',
    ) as HTMLButtonElement | null;
    expect(done?.disabled).toBe(true);
  });

  it('zeigt die Sequenznummer beim ersten Q&A-Start', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostRecoveryCardDialogComponent],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: { ...CARD, setupStep: 2, setupStepCount: 2 } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(HostRecoveryCardDialogComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Schritt 2 von 2');
  });

  it('gibt Fertig nach dem Bestätigen der Sicherung frei', () => {
    const fixture = TestBed.createComponent(HostRecoveryCardDialogComponent);
    fixture.detectChanges();
    fixture.componentInstance.saved.set(true);
    fixture.detectChanges();

    const done = fixture.nativeElement.querySelector(
      '[data-testid="host-recovery-card-done"]',
    ) as HTMLButtonElement | null;
    expect(done?.disabled).toBe(false);
  });

  it('kopiert die Support-ID in die Zwischenablage', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const fixture = TestBed.createComponent(HostRecoveryCardDialogComponent);
    fixture.detectChanges();

    await fixture.componentInstance.copy('supportId');
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(CARD.supportId);
    expect(fixture.nativeElement.textContent).toContain('Session-Kennung kopiert.');
  });

  it('bestätigt die Checkbox nicht durch Download oder Copy-all', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const fixture = TestBed.createComponent(HostRecoveryCardDialogComponent);
    fixture.detectChanges();
    await fixture.componentInstance.copyAll();
    fixture.componentInstance.download();
    fixture.detectChanges();
    expect(fixture.componentInstance.saved()).toBe(false);
    expect(writeText.mock.calls[0]?.[0]).toContain(CARD.recoveryCode);
    expect(writeText.mock.calls[0]?.[0]).not.toMatch(/\*\*|`|\[/);
    expect(fixture.nativeElement.textContent).toContain('Download gestartet');
  });

  it('nimmt Support-ID und Recovery-Code in die HTML-Karte auf, ohne cardWhy', () => {
    const fixture = TestBed.createComponent(HostRecoveryCardDialogComponent);
    fixture.detectChanges();
    const html = fixture.componentInstance.buildDownloadHtml();

    expect(html).not.toContain('ABC123');
    expect(html).not.toContain('Sessioncode');
    expect(html).toContain(CARD.supportId);
    expect(html).toContain(CARD.recoveryCode);
    expect(html).not.toContain('Schritt 2 von 2');
    expect(html).toContain('<h1>Host-Zugangsdaten</h1>');
    expect(html).toContain('auf einem anderen Gerät oder in einem anderen Browser');
    expect(html).not.toContain('Dein Host-Zugang ist in diesem Browser gespeichert');
    expect(html).toContain('Wiederherstellungsseite');
    expect(html).toContain('Berechtigung für diese Session prüfen');
    expect(html).toContain('Kontaktdaten im Impressum');
    expect(html).toContain('host-recovery');
    expect(html).toMatch(/<a class="usage-link" href="[^"]*host-recovery[^"]*">/);
    expect(html).toMatch(/<a class="usage-link" href="[^"]*\/legal\/imprint[^"]*">/);
    expect(html).not.toContain('<script');
  });
});
