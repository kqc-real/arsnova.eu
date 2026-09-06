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

  beforeEach(async () => {
    queryMock.mockReset();
    mutateMock.mockReset();
    close.mockReset();
    queryMock.mockResolvedValue({ count: 4, scope: 'UNTIL' });
    mutateMock.mockResolvedValue({ deletedCount: 4, scope: 'UNTIL' });
    await TestBed.configureTestingModule({
      imports: [AdminProductFeedbackPurgeDialogComponent],
      providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DIALOG_DATA, useValue: { untilDate: new Date(2026, 7, 31) } },
        { provide: MatDialogRef, useValue: { close } },
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
  });

  it('zählt bei „Alle“ ohne Datum', async () => {
    queryMock.mockResolvedValueOnce({ count: 9, scope: 'ALL' });
    component.scope = 'ALL';
    await component.refreshCount();
    expect(queryMock).toHaveBeenLastCalledWith({ scope: 'ALL' });
    expect(component.count()).toBe(9);
  });
});
