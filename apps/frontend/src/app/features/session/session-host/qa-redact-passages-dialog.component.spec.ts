import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QA_REDACTION_CHAR } from '@arsnova/shared-types';
import {
  QaRedactPassagesDialogComponent,
  type QaRedactPassagesDialogData,
} from './qa-redact-passages-dialog.component';

describe('QaRedactPassagesDialogComponent', () => {
  let fixture: ComponentFixture<QaRedactPassagesDialogComponent>;
  let component: QaRedactPassagesDialogComponent;
  const close = vi.fn();
  const dialogOpen = vi.fn();
  const applyRedaction = vi.fn();

  beforeEach(async () => {
    close.mockReset();
    dialogOpen.mockReset();
    applyRedaction.mockReset();
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });
    applyRedaction.mockResolvedValue({ ok: true });

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
            applyRedaction,
          } satisfies QaRedactPassagesDialogData,
        },
        { provide: MatDialogRef, useValue: { close, disableClose: false } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QaRedactPassagesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('nimmt mehrere Fundstellen auf, entfernt eine und speichert disjunkte Ranges', async () => {
    component.searchNeedle.set('Max');
    component.runSearch();
    expect(component.searchOccurrences()).toHaveLength(2);
    component.selectedOccurrenceIndexes.set([0, 1]);
    component.addSelectedOccurrences();
    expect(component.pendingRanges()).toHaveLength(2);

    const firstId = component.pendingRanges()[0]!.id;
    component.removeRange(firstId);
    expect(component.pendingRanges()).toHaveLength(1);
    expect(component.previewText()).toContain(QA_REDACTION_CHAR.repeat(3));

    await component.confirmApply();
    expect(dialogOpen).toHaveBeenCalled();
    expect(applyRedaction).toHaveBeenCalledWith(
      [{ start: 14, end: 17 }],
      'Bitte Max und Max anonymisieren',
    );
    expect(close).toHaveBeenCalledWith({ applied: true });
  });

  it('lehnt leere Auswahl beim Anwenden ab', async () => {
    await component.confirmApply();
    expect(close).not.toHaveBeenCalled();
    expect(applyRedaction).not.toHaveBeenCalled();
    expect(component.statusTone()).toBe('error');
  });

  it('übernimmt die Textauswahl auch nach Fokusverlust der Textarea', () => {
    const area = fixture.nativeElement.querySelector('#qa-redact-source') as HTMLTextAreaElement;
    area.focus();
    area.setSelectionRange(6, 9);
    component.captureSourceSelection({ target: area } as unknown as Event);
    area.blur();
    component.markCurrentSelection();
    expect(component.pendingRanges()).toEqual([
      expect.objectContaining({ start: 6, end: 9, excerpt: 'Max' }),
    ]);
    expect(component.previewText()).toContain(QA_REDACTION_CHAR.repeat(3));
  });

  it('hält bei Konflikt den Dialog offen, lädt den Text neu und verwirft die Auswahl', async () => {
    component.searchNeedle.set('Max');
    component.runSearch();
    component.selectedOccurrenceIndexes.set([0]);
    component.addSelectedOccurrences();
    applyRedaction.mockResolvedValue({
      ok: false,
      reason: 'conflict',
      question: {
        id: '11111111-1111-4111-8111-111111111111',
        text: 'Geänderter Fragetext ohne Markierung',
        updatedAt: '2026-03-13T12:05:00.000Z',
        passagesRedacted: false,
      },
    });

    await component.confirmApply();

    expect(close).not.toHaveBeenCalled();
    expect(component.sourceText()).toBe('Geänderter Fragetext ohne Markierung');
    expect(component.pendingRanges()).toEqual([]);
    expect(component.statusTone()).toBe('error');
  });

  it('hält bei Fehler die Auswahl und schließt nicht', async () => {
    component.searchNeedle.set('Max');
    component.runSearch();
    component.selectedOccurrenceIndexes.set([0]);
    component.addSelectedOccurrences();
    applyRedaction.mockResolvedValue({ ok: false, reason: 'error' });

    await component.confirmApply();

    expect(close).not.toHaveBeenCalled();
    expect(component.pendingRanges()).toHaveLength(1);
    expect(component.statusTone()).toBe('error');
  });
});
