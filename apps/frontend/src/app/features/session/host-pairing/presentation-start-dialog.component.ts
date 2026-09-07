import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import type { HostPairingPendingDTO, HostPairingScreenVisibility } from '@arsnova/shared-types';
import { trpc } from '../../../core/trpc.client';
import {
  HostPairingDialogComponent,
  type HostPairingDialogData,
  type HostPairingDialogResult,
} from './host-pairing-dialog.component';

export interface PresentationStartDialogData {
  code: string;
  /** Muss im Klick der Primäraktion `window.open` synchron anstoßen. */
  startPresenterView?: () => Promise<Window | null>;
  phoneAlreadyConnected?: boolean;
}

export type PresentationStartDialogResult = 'start' | 'blocked' | undefined;

@Component({
  selector: 'app-presentation-start-dialog',
  standalone: true,
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
    MatRadioButton,
    MatRadioGroup,
  ],
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './presentation-start-dialog.component.scss',
  ],
  templateUrl: './presentation-start-dialog.component.html',
})
export class PresentationStartDialogComponent implements OnInit {
  readonly data = inject<PresentationStartDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef =
    inject<MatDialogRef<PresentationStartDialogComponent, PresentationStartDialogResult>>(
      MatDialogRef,
    );

  readonly visibility = signal<HostPairingScreenVisibility>('PROJECTED');
  readonly phoneConnected = signal(this.data.phoneAlreadyConnected === true);
  readonly canAddAnother = signal(true);
  readonly capReached = signal(false);
  readonly pending = signal<HostPairingPendingDTO | null>(null);
  readonly pairingAdmin = signal(true);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  onVisibilityChange(value: string): void {
    if (value === 'PROJECTED' || value === 'PRIVATE') {
      this.visibility.set(value);
    }
  }

  async startPresentation(): Promise<void> {
    const start = this.data.startPresenterView;
    if (!start) {
      this.dialogRef.close('start');
      return;
    }
    try {
      const opened = await start();
      this.dialogRef.close(opened ? 'start' : 'blocked');
    } catch {
      this.dialogRef.close('blocked');
    }
  }

  openPairing(): void {
    if (!this.pairingAdmin()) {
      return;
    }
    const ref = this.dialog.open<
      HostPairingDialogComponent,
      HostPairingDialogData,
      HostPairingDialogResult
    >(HostPairingDialogComponent, {
      data: {
        code: this.data.code,
        screenVisibility: this.visibility(),
        startPresenterView: this.data.startPresenterView,
      },
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      panelClass: 'host-pairing-dialog-panel',
      backdropClass: 'host-pairing-dialog-backdrop',
    });
    ref.afterClosed().subscribe((result) => {
      void this.refresh();
      if (!result?.connected) {
        return;
      }
      this.dialogRef.close(result.presenterOpened === false ? 'blocked' : 'start');
    });
  }

  private async refresh(): Promise<void> {
    try {
      const listed = await trpc.session.listPairedHosts.query({ code: this.data.code });
      this.phoneConnected.set(listed.devices.length > 0);
      this.canAddAnother.set(
        listed.devices.length < listed.caps.maxPairedHosts && listed.pending === null,
      );
      this.capReached.set(listed.devices.length >= listed.caps.maxPairedHosts);
      this.pending.set(listed.pending);
      this.pairingAdmin.set(true);
    } catch {
      this.pairingAdmin.set(false);
      this.canAddAnother.set(false);
      this.capReached.set(false);
      this.pending.set(null);
    }
  }
}
