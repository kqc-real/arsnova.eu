import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QA_REDACTION_PLACEHOLDER } from '@arsnova/shared-types';
import {
  QaRedactPassagesDialogComponent,
  type QaRedactPassagesDialogData,
} from './qa-redact-passages-dialog.component';

describe('QaRedactPassagesDialogComponent', () => {
  let fixture: ComponentFixture<QaRedactPassagesDialogComponent>;
  let component: QaRedactPassagesDialogComponent;
  const close = vi.fn();
  const dialogOpen = vi.fn();

  beforeEach(async () => {
    close.mockReset();
    dialogOpen.mockReset();
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });

    await TestBed.configureTestingModule({
      imports: [QaRedactPassagesDialogComponent, NoopAnimationsModule],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            question: {
              id: '11111111-1111-4111-8111-111111111111',
              text: 'Bitte Max und Max anonymisieren',
              updatedAt: '2026-03-13T12:00:00.000Z',
              passagesRedacted: false,
            },
          } satisfies QaRedactPassagesDialogData,
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QaRedactPassagesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('nimmt mehrere Fundstellen auf, entfernt eine und liefert disjunkte Ranges', async () => {
    component.searchNeedle.set('Max');
    component.runSearch();
    expect(component.searchOccurrences()).toHaveLength(2);
    component.selectedOccurrenceIndexes.set([0, 1]);
    component.addSelectedOccurrences();
    expect(component.pendingRanges()).toHaveLength(2);

    const firstId = component.pendingRanges()[0]!.id;
    component.removeRange(firstId);
    expect(component.pendingRanges()).toHaveLength(1);
    expect(component.previewText()).toContain(QA_REDACTION_PLACEHOLDER);

    await component.confirmApply();
    expect(dialogOpen).toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith({
      ranges: [{ start: 14, end: 17 }],
    });
  });

  it('lehnt leere Auswahl beim Anwenden ab', async () => {
    await component.confirmApply();
    expect(close).not.toHaveBeenCalled();
    expect(component.statusTone()).toBe('error');
  });
});
