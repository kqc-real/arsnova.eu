import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_FEEDBACK_PURGE_CONFIRMATION } from '@arsnova/shared-types';
import { AdminProductFeedbackPurgeDialogComponent } from './admin-product-feedback-purge-dialog.component';

const queryMock = vi.fn();
const mutateMock = vi.fn();

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    admin: {
      productFeedback: {
        countForPurge: { query: (...args: unknown[]) => queryMock(...args) },
        purge: { mutate: (...args: unknown[]) => mutateMock(...args) },
      },
    },
  },
}));

describe('AdminProductFeedbackPurgeDialogComponent', () => {
  let fixture: ComponentFixture<AdminProductFeedbackPurgeDialogComponent>;
  let component: AdminProductFeedbackPurgeDialogComponent;
  const close = vi.fn();
  const dialogRef = { close, disableClose: false };

  beforeEach(async () => {
    queryMock.mockReset();
    mutateMock.mockReset();
    close.mockReset();
    dialogRef.disableClose = false;
    queryMock.mockResolvedValue({ count: 4, scope: 'UNTIL' });
    mutateMock.mockResolvedValue({ deletedCount: 4, scope: 'UNTIL' });
    await TestBed.configureTestingModule({
      imports: [AdminProductFeedbackPurgeDialogComponent],
      providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DIALOG_DATA, useValue: { untilDate: new Date(2026, 7, 31) } },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminProductFeedbackPurgeDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('zählt standardmäßig bis einschließlich des übergebenen Datums', () => {
    expect(component.scope).toBe('UNTIL');
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'UNTIL',
        until: expect.stringMatching(/2026-08-31T/),
      }),
    );
    expect(component.count()).toBe(4);
    expect(component.canPurge()).toBe(false);
  });

  it('weist darauf hin, dass Einladungszähler für denselben Zeitraum mitgelöscht werden', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Einladungszähler');
    expect(text).toContain('denselben Zeitraum');
    expect(text).toContain('Exportprotokolle bleiben erhalten');
  });

  it('löscht erst nach korrekter Phrase und schließt mit der Anzahl', async () => {
    component.confirmationText = PRODUCT_FEEDBACK_PURGE_CONFIRMATION;
    expect(component.canPurge()).toBe(true);
    await component.confirmPurge();
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'UNTIL',
        expectedCount: 4,
        confirmationText: PRODUCT_FEEDBACK_PURGE_CONFIRMATION,
      }),
    );
    expect(close).toHaveBeenCalledWith({ deletedCount: 4, scope: 'UNTIL' });
    expect(dialogRef.disableClose).toBe(false);
  });

  it('sperrt Escape während der Löschung', async () => {
    component.confirmationText = PRODUCT_FEEDBACK_PURGE_CONFIRMATION;
    let resolvePurge: (value: { deletedCount: number; scope: string }) => void = () => undefined;
    mutateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePurge = resolve;
        }),
    );
    const pending = component.confirmPurge();
    expect(dialogRef.disableClose).toBe(true);
    resolvePurge({ deletedCount: 4, scope: 'UNTIL' });
    await pending;
    expect(dialogRef.disableClose).toBe(false);
  });

  it('lehnt ein Datum nach heute ab', async () => {
    component.confirmationText = PRODUCT_FEEDBACK_PURGE_CONFIRMATION;
    component.untilDate = new Date(2099, 0, 1);
    expect(component.canPurge()).toBe(false);
    await component.refreshCount();
    expect(queryMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ until: expect.stringMatching(/2099/) }),
    );
    expect(component.count()).toBeNull();
  });

  it('zählt nach einer Anzahlabweichung neu, behält aber die Fehlermeldung', async () => {
    component.confirmationText = PRODUCT_FEEDBACK_PURGE_CONFIRMATION;
    mutateMock.mockRejectedValueOnce({
      data: { code: 'PRECONDITION_FAILED' },
      message: 'Die Auswahl hat sich geändert. Bitte neu zählen und erneut bestätigen.',
    });
    queryMock.mockResolvedValueOnce({ count: 7, scope: 'UNTIL' });
    await component.confirmPurge();
    expect(close).not.toHaveBeenCalled();
    expect(component.error()).toContain('Die Anzahl hat sich geändert');
    expect(component.count()).toBe(7);
    expect(component.busy()).toBe(false);
  });

  it('zählt bei „Alle“ ohne Datum', async () => {
    queryMock.mockResolvedValueOnce({ count: 9, scope: 'ALL' });
    component.scope = 'ALL';
    await component.refreshCount();
    expect(queryMock).toHaveBeenLastCalledWith({ scope: 'ALL' });
    expect(component.count()).toBe(9);
  });

  it('erlaubt die Phrase auch bei 0 Rückmeldungen, damit Einladungszähler zurückgesetzt werden', async () => {
    queryMock.mockResolvedValueOnce({ count: 0, scope: 'ALL' });
    component.scope = 'ALL';
    await component.refreshCount();
    expect(component.canPurge()).toBe(false);
    component.confirmationText = PRODUCT_FEEDBACK_PURGE_CONFIRMATION;
    expect(component.canPurge()).toBe(true);
  });
});
