import { formatDate } from '@angular/common';
import { Component, LOCALE_ID, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import type {
  HostPairingCaps,
  HostPairingPendingDTO,
  HostPairingScreenVisibility,
  ListPairedHostsOutput,
  PairedHostDeviceDTO,
} from '@arsnova/shared-types';
import { localizeKnownServerError } from '../../../core/localize-known-server-message';
import { trpc } from '../../../core/trpc.client';
import { buildHostPairingUrl } from './host-pairing-url';

export interface HostPairingDialogData {
  code: string;
  screenVisibility?: HostPairingScreenVisibility;
}

type DialogView = 'loading' | 'invite' | 'pending' | 'manage' | 'error';

const POLL_MS = 1500;
const EMPTY_CAPS: HostPairingCaps = {
  maxPairedHosts: 3,
  maxActiveInvites: 1,
  maxPendingPerInvite: 1,
  inviteTtlSeconds: 300,
  pendingTtlSeconds: 300,
};

@Component({
  selector: 'app-host-pairing-dialog',
  standalone: true,
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
    MatProgressBar,
  ],
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './host-pairing-dialog.component.scss',
  ],
  templateUrl: './host-pairing-dialog.component.html',
})
export class HostPairingDialogComponent implements OnDestroy {
  readonly data = inject<HostPairingDialogData>(MAT_DIALOG_DATA);
  private readonly locale = inject(LOCALE_ID);
  readonly view = signal<DialogView>('loading');
  readonly pairingUrl = signal('');
  readonly qrDataUrl = signal<string | null>(null);
  readonly pending = signal<HostPairingPendingDTO | null>(null);
  readonly devices = signal<PairedHostDeviceDTO[]>([]);
  readonly caps = signal<HostPairingCaps>(EMPTY_CAPS);
  readonly error = signal<string | null>(null);
  readonly announcement = signal<string | null>(null);
  readonly copyDone = signal(false);
  readonly busy = signal(false);
  readonly screenVisibility: HostPairingScreenVisibility =
    this.data.screenVisibility ?? 'PROJECTED';
  readonly isPrivateScreen = this.screenVisibility === 'PRIVATE';
  readonly capReached = computed(() => this.devices().length >= this.caps().maxPairedHosts);
  readonly canAddAnother = computed(() => !this.capReached() && this.pending() === null);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
  }

  deviceLabel(device: PairedHostDeviceDTO): string {
    const label = device.deviceLabel?.trim();
    return label ? label : $localize`:@@hostPairing.deviceFallback:Weiteres Host-Gerät`;
  }

  deviceSince(iso: string): string {
    try {
      return formatDate(iso, 'shortTime', this.locale);
    } catch {
      return '';
    }
  }

  async bootstrap(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.view.set('loading');
    try {
      const state = await trpc.session.listPairedHosts.query({ code: this.data.code });
      this.applyListedState(state);
      if (state.pending) {
        this.startPolling();
        return;
      }
      if (state.devices.length > 0) {
        this.view.set('manage');
        return;
      }
      await this.startInvite();
    } catch (error: unknown) {
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorGeneric:Die Verbindung konnte nicht vorbereitet werden.`,
        ),
      );
      this.view.set('error');
    } finally {
      this.busy.set(false);
    }
  }

  async startInvite(): Promise<void> {
    if (this.capReached()) {
      this.view.set('manage');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.pending.set(null);
    this.view.set('loading');
    try {
      const invite = await trpc.session.createHostPairingInvite.mutate({
        code: this.data.code,
        screenVisibility: this.screenVisibility,
      });
      const url = buildHostPairingUrl(this.data.code, invite.pairingSecret);
      this.pairingUrl.set(url);
      this.view.set('invite');
      await this.renderQr(url);
      this.startPolling();
    } catch (error: unknown) {
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorGeneric:Die Verbindung konnte nicht vorbereitet werden.`,
        ),
      );
      this.view.set(this.devices().length > 0 ? 'manage' : 'error');
    } finally {
      this.busy.set(false);
    }
  }

  copyLabel(): string {
    return this.copyDone()
      ? $localize`:@@hostPairing.linkCopied:Link kopiert`
      : $localize`:@@hostPairing.copyLink:Link kopieren`;
  }

  async copyLink(): Promise<void> {
    const url = this.pairingUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copyDone.set(true);
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      this.copyResetTimer = setTimeout(() => this.copyDone.set(false), 2000);
    } catch {
      this.error.set($localize`:@@hostPairing.copyFailed:Link konnte nicht kopiert werden.`);
    }
  }

  async approve(): Promise<void> {
    const requestId = this.pending()?.requestId;
    if (!requestId) return;
    this.busy.set(true);
    try {
      await trpc.session.approveHostPairing.mutate({
        code: this.data.code,
        requestId,
      });
      this.pending.set(null);
      this.stopPolling();
      const state = await trpc.session.listPairedHosts.query({ code: this.data.code });
      this.applyListedState(state);
      this.view.set('manage');
    } catch (error: unknown) {
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorGeneric:Die Verbindung konnte nicht vorbereitet werden.`,
        ),
      );
    } finally {
      this.busy.set(false);
    }
  }

  async reject(): Promise<void> {
    const requestId = this.pending()?.requestId;
    if (!requestId) return;
    this.busy.set(true);
    try {
      await trpc.session.rejectHostPairing.mutate({
        code: this.data.code,
        requestId,
      });
      this.pending.set(null);
      this.error.set($localize`:@@hostPairing.errorRejected:Die Verbindung wurde abgelehnt.`);
      this.view.set(this.devices().length > 0 ? 'manage' : 'error');
      this.stopPolling();
    } catch (error: unknown) {
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorGeneric:Die Verbindung konnte nicht vorbereitet werden.`,
        ),
      );
    } finally {
      this.busy.set(false);
    }
  }

  async revoke(device: PairedHostDeviceDTO): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await trpc.session.revokePairedHost.mutate({
        code: this.data.code,
        tokenId: device.tokenId,
      });
      this.announcement.set($localize`:@@hostPairing.revokedLive:Verbindung getrennt`);
      const state = await trpc.session.listPairedHosts.query({ code: this.data.code });
      this.applyListedState(state);
      this.view.set('manage');
    } catch (error: unknown) {
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorGeneric:Die Verbindung konnte nicht vorbereitet werden.`,
        ),
      );
    } finally {
      this.busy.set(false);
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.refreshState();
    }, POLL_MS);
    void this.refreshState();
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async refreshState(): Promise<void> {
    try {
      const state = await trpc.session.listPairedHosts.query({ code: this.data.code });
      this.applyListedState(state);
    } catch {
      /* Polling-Fehler nicht als Dialog-Abbruch zeigen. */
    }
  }

  private applyListedState(state: ListPairedHostsOutput): void {
    this.devices.set(state.devices);
    this.caps.set(state.caps);
    if (state.pending) {
      this.pending.set(state.pending);
      this.view.set('pending');
      return;
    }
    this.pending.set(null);
    if (this.view() === 'pending' && state.devices.length > 0) {
      this.view.set('manage');
      this.stopPolling();
    }
  }

  private async renderQr(url: string): Promise<void> {
    try {
      const qrcodeModule = await import('qrcode-generator');
      const qrcodeFactory = (qrcodeModule.default ?? qrcodeModule) as unknown as (
        typeNumber: 0,
        errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H',
      ) => {
        addData(data: string): void;
        make(): void;
        createDataURL(cellSize?: number, margin?: number): string;
      };
      const qr = qrcodeFactory(0, 'M');
      qr.addData(url);
      qr.make();
      this.qrDataUrl.set(qr.createDataURL(8, 2));
    } catch {
      this.qrDataUrl.set(null);
    }
  }
}
