import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

export interface ConfirmLeaveDialogData {
  title: string;
  message: string;
  consequences: string[];
  confirmLabel: string;
  cancelLabel: string;
  /** Optionale, nicht-destruktive Aktion, bevor die auslösende Navigation fortgesetzt wird. */
  saveLabel?: string;
  /**
   * Synchron im Cancel-Klick (User-Geste), z. B. Vollbild wiederherstellen,
   * bevor der Dialog schließt (afterClosed wäre oft zu spät für die Fullscreen-API).
   */
  onCancelUserGesture?: () => void;
}

@Component({
  selector: 'app-confirm-leave-dialog',
  standalone: true,
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIcon],
  styleUrls: ['../styles/dialog-title-header.scss', './confirm-leave-dialog.component.scss'],
  template: `
    <h2 mat-dialog-title class="dialog-title-header">
      <span class="dialog-title-header__icon dialog-title-header__icon--warn" aria-hidden="true">
        <mat-icon>warning</mat-icon>
      </span>
      <span class="dialog-title-header__copy">
        <span class="dialog-title-header__heading">{{ data.title }}</span>
      </span>
    </h2>
    <mat-dialog-content>
      <p class="confirm-leave__message">{{ data.message }}</p>
      @if (data.consequences.length > 0) {
        <ul class="confirm-leave__list">
          @for (item of data.consequences; track item) {
            <li>{{ item }}</li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end" [class.confirm-leave__actions--with-save]="data.saveLabel">
      @if (data.saveLabel) {
        <button mat-flat-button type="button" [mat-dialog-close]="'save'">
          <mat-icon>save</mat-icon>
          {{ data.saveLabel }}
        </button>
        <button mat-button type="button" color="warn" [mat-dialog-close]="true">
          {{ data.confirmLabel }}
        </button>
        <button mat-button type="button" (click)="onCancel()">{{ data.cancelLabel }}</button>
      } @else {
        <button mat-button type="button" (click)="onCancel()">{{ data.cancelLabel }}</button>
        <button mat-flat-button type="button" color="warn" [mat-dialog-close]="true">
          {{ data.confirmLabel }}
        </button>
      }
    </mat-dialog-actions>
  `,
})
export class ConfirmLeaveDialogComponent {
  readonly data = inject<ConfirmLeaveDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmLeaveDialogComponent, boolean | 'save'>);

  onCancel(): void {
    this.data.onCancelUserGesture?.();
    this.dialogRef.close(false);
  }
}
