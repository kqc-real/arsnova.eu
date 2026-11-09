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
import { PresenterIconComponent } from '../presenter-icon.component';
import type { HostPairingPendingDTO } from '@arsnova/shared-types';
import { trpc } from '../../../core/trpc.client';
import {
  HostPairingDialogComponent,
  type HostPairingDialogData,
  type HostPairingDialogResult,
} from './host-pairing-dialog.component';

export interface PresentationStartDialogData {
  code: string;
  phoneAlreadyConnected?: boolean;
  requestFullscreen?: () => void;
}

export type PresentationStartDialogResult = 'start' | undefined;

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
    PresenterIconComponent,
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

  readonly phoneConnected = signal(this.data.phoneAlreadyConnected === true);
  readonly canAddAnother = signal(true);
  readonly capReached = signal(false);
  readonly pending = signal<HostPairingPendingDTO | null>(null);
  readonly pairingAdmin = signal(false);
  readonly pairingAdminLoading = signal(true);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  startPresentation(): void {
    this.data.requestFullscreen?.();
    this.dialogRef.close('start');
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
        offerPresentationStart: true,
        requestFullscreen: this.data.requestFullscreen,
      },
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      panelClass: 'host-pairing-dialog-panel',
      backdropClass: 'host-pairing-dialog-backdrop',
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.startPresentation) {
        this.dialogRef.close('start');
      } else {
        void this.refresh();
      }
    });
  }

  private async refresh(): Promise<void> {
    this.pairingAdminLoading.set(true);
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
    } finally {
      this.pairingAdminLoading.set(false);
    }
  }
}
