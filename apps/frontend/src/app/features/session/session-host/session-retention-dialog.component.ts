import { Component, LOCALE_ID, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import type { SessionLifecycleHostDTO } from '@arsnova/shared-types';

export interface SessionRetentionDialogData {
  lifecycle: SessionLifecycleHostDTO;
}

@Component({
  selector: 'app-session-retention-dialog',
  standalone: true,
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle, MatIcon],
  templateUrl: './session-retention-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './session-retention-dialog.component.scss',
  ],
})
export class SessionRetentionDialogComponent {
  readonly data = inject<SessionRetentionDialogData>(MAT_DIALOG_DATA);
  private readonly localeId = inject(LOCALE_ID);
  private readonly dialogRef = inject(MatDialogRef<SessionRetentionDialogComponent, void>);

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(this.localeId, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: this.data.lifecycle.timeZone,
      timeZoneName: 'short',
    }).format(new Date(value));
  }

  close(): void {
    this.dialogRef.close();
  }
}
