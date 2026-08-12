import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from './confirm-leave-dialog.component';

/**
 * Bestätigungsdialog für ungespeicherte Quiz-Änderungen (Edit, New, Preview-Inline).
 * Abbrechen = false (sicherer Default); Trotzdem fortfahren = true.
 * Wenn `saveChanges` gesetzt ist, bietet der Dialog zusätzlich „Alle Änderungen speichern“ an
 * und lässt die Navigation nur nach einem erfolgreichen Save weiterlaufen.
 */
export async function confirmDiscardUnsavedChanges(
  dialog: MatDialog,
  saveChanges?: () => boolean | Promise<boolean>,
): Promise<boolean> {
  const data: ConfirmLeaveDialogData = {
    title: $localize`:@@quiz.unsavedChanges.title:Ungespeicherte Änderungen?`,
    message: $localize`:@@quiz.unsavedChanges.message:Wenn du fortfährst, gehen ungespeicherte Änderungen verloren.`,
    consequences: [
      $localize`:@@quiz.unsavedChanges.consequence:Dein aktueller Entwurf wird nicht gespeichert.`,
    ],
    confirmLabel: $localize`:@@quiz.unsavedChanges.confirm:Trotzdem fortfahren`,
    cancelLabel: $localize`:@@quiz.unsavedChanges.cancel:Abbrechen`,
    ...(saveChanges
      ? {
          saveLabel: $localize`:@@quiz.unsavedChanges.saveAll:Alle Änderungen speichern`,
        }
      : {}),
  };

  const dialogRef = dialog.open(ConfirmLeaveDialogComponent, {
    data,
    width: 'min(26rem, calc(100vw - 1.5rem))',
    maxWidth: '100vw',
    autoFocus: 'dialog',
  });

  const result = await firstValueFrom(dialogRef.afterClosed());
  if (result === 'save') {
    return (await saveChanges?.()) === true;
  }
  return result === true;
}
