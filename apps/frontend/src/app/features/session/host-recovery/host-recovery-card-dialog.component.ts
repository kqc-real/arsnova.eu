import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import type { HostRecoveryCardDTO } from '@arsnova/shared-types';

type RecoveryCardField = 'supportId' | 'recoveryCode';

@Component({
  selector: 'app-host-recovery-card-dialog',
  standalone: true,
  imports: [
    MatButton,
    MatCheckbox,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
    MatIconButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './host-recovery-card-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './host-recovery-card-dialog.component.scss',
  ],
})
export class HostRecoveryCardDialogComponent {
  private readonly document = inject(DOCUMENT);
  readonly data = inject<HostRecoveryCardDTO>(MAT_DIALOG_DATA);
  readonly saved = signal(false);
  readonly copiedField = signal<RecoveryCardField | null>(null);
  readonly copyFailed = signal(false);

  async copy(field: RecoveryCardField): Promise<void> {
    const value = field === 'supportId' ? this.data.supportId : this.data.recoveryCode;
    const clipboard = this.document.defaultView?.navigator.clipboard;
    try {
      if (!clipboard) {
        throw new Error('clipboard unavailable');
      }
      await clipboard.writeText(value);
      this.copiedField.set(field);
      this.copyFailed.set(false);
    } catch {
      this.copyFailed.set(true);
    }
  }

  download(): void {
    const content = [
      $localize`:@@hostRecovery.downloadHeading:arsnova.eu Host-Notfallkarte`,
      '',
      `${$localize`:@@hostRecovery.supportIdLabel:Support-ID`}: ${this.data.supportId}`,
      `${$localize`:@@hostRecovery.recoveryCodeLabel:Recovery-Code`}: ${this.data.recoveryCode}`,
      '',
      $localize`:@@hostRecovery.downloadWarning:Geheim halten. Sessioncode oder Support-ID allein verleihen keine Hostrechte.`,
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = `arsnova-host-notfallkarte-${this.data.supportId}.txt`;
    this.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    this.saved.set(true);
  }
}
