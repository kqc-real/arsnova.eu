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
  template: `
    <h2 mat-dialog-title class="confirm-leave__title">
      <mat-icon aria-hidden="true">warning</mat-icon>
      {{ data.title }}
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
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="onCancel()">{{ data.cancelLabel }}</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true">
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .confirm-leave__title {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        mat-icon {
          color: var(--mat-sys-error, #b3261e);
        }
      }

      .confirm-leave__message {
        font: var(--mat-sys-body-large);
        color: var(--mat-sys-on-surface);
        margin: 0 0 0.75rem;
      }

      .confirm-leave__list {
        margin: 0;
        padding-left: 1.25rem;
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
        line-height: 1.7;
      }

      @media (max-width: 28rem) {
        mat-dialog-actions {
          flex-direction: column-reverse;
          align-items: stretch;
          gap: 0.5rem;
          padding-inline: 1rem;
          padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
        }

        mat-dialog-actions .mat-mdc-button-base {
          width: 100%;
        }
      }
    `,
  ],
})
export class ConfirmLeaveDialogComponent {
  readonly data = inject<ConfirmLeaveDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmLeaveDialogComponent, boolean>);

  onCancel(): void {
    this.data.onCancelUserGesture?.();
    this.dialogRef.close(false);
  }
}
