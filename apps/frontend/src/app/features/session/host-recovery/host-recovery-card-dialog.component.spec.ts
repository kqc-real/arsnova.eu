import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostRecoveryCardDialogComponent } from './host-recovery-card-dialog.component';

const CARD = {
  supportId: 'ARS-ABCD-2345',
  recoveryCode: 'recovery-capability-abcdefghijklmnopqrstuvwxyz',
};

describe('HostRecoveryCardDialogComponent', () => {
  const close = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostRecoveryCardDialogComponent],
      providers: [
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
    expect(host.textContent).toContain('Host-Notfallkarte sichern');
    expect(host.querySelector('[data-testid="host-recovery-card-cancel"]')?.textContent).toContain(
      'Abbrechen',
    );
    const done = host.querySelector(
      '[data-testid="host-recovery-card-done"]',
    ) as HTMLButtonElement | null;
    expect(done?.disabled).toBe(true);
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
    expect(fixture.nativeElement.textContent).toContain('Support-ID wurde kopiert.');
  });
});
