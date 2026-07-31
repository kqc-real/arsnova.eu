import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from './confirm-leave-dialog.component';

/**
 * Bestätigungsdialog für ungespeicherte Quiz-Änderungen (Edit, New, Preview-Inline).
 * Abbrechen = false (sicherer Default); Trotzdem fortfahren = true.
 */
export async function confirmDiscardUnsavedChanges(dialog: MatDialog): Promise<boolean> {
  const data: ConfirmLeaveDialogData = {
    title: $localize`:@@quiz.unsavedChanges.title:Ungespeicherte Änderungen?`,
    message: $localize`:@@quiz.unsavedChanges.message:Wenn du fortfährst, gehen ungespeicherte Änderungen verloren.`,
    consequences: [
      $localize`:@@quiz.unsavedChanges.consequence:Dein aktueller Entwurf wird nicht gespeichert.`,
    ],
    confirmLabel: $localize`:@@quiz.unsavedChanges.confirm:Trotzdem fortfahren`,
    cancelLabel: $localize`:@@quiz.unsavedChanges.cancel:Abbrechen`,
  };

  const dialogRef = dialog.open(ConfirmLeaveDialogComponent, {
    data,
    width: 'min(26rem, calc(100vw - 1.5rem))',
    maxWidth: '100vw',
    autoFocus: 'dialog',
  });

  return (await firstValueFrom(dialogRef.afterClosed())) === true;
}
