import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from './confirm-leave-dialog.component';

describe('ConfirmLeaveDialogComponent', () => {
  function create() {
    const close = vi.fn();
    const onCancelUserGesture = vi.fn();
    TestBed.configureTestingModule({
      imports: [ConfirmLeaveDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            title: 'Alle Quizze löschen?',
            message: 'Alle Quizze dieser Sammlung werden gelöscht.',
            consequences: ['Das lässt sich nicht rückgängig machen.'],
            note: 'Laufende Sessions bleiben geöffnet.',
            confirmLabel: 'Alle Quizze löschen',
            cancelLabel: 'Abbrechen',
            onCancelUserGesture,
          } satisfies ConfirmLeaveDialogData,
        },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmLeaveDialogComponent);
    fixture.detectChanges();
    return { fixture, close, onCancelUserGesture };
  }

  it('macht die Konsequenzliste für das Scrollen per Tastatur fokussierbar', () => {
    const { fixture } = create();
    const content = fixture.nativeElement.querySelector('mat-dialog-content') as HTMLElement;
    expect(content.tabIndex).toBe(0);
    expect(content.textContent).toContain('nicht rückgängig');
    content.focus();
    expect(document.activeElement).toBe(content);
  });

  it('bricht ab, ohne die destruktive Bestätigung auszulösen', () => {
    const { fixture, close, onCancelUserGesture } = create();
    const cancel = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => (button as HTMLButtonElement).textContent?.trim() === 'Abbrechen',
    ) as HTMLButtonElement;
    cancel.click();
    expect(onCancelUserGesture).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('bestätigt nur über die ausdrücklich benannte Löschaktion', () => {
    const { fixture, close } = create();
    const confirm = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => (button as HTMLButtonElement).textContent?.trim() === 'Alle Quizze löschen',
    ) as HTMLButtonElement;
    confirm.click();
    expect(close).toHaveBeenCalledExactlyOnceWith(true);
  });
});
