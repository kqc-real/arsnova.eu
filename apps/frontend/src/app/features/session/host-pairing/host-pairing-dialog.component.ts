import { formatDate } from '@angular/common';
import { Component, LOCALE_ID, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
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
import { formatHostPairingRemainingClock } from './host-pairing-remaining';
import { buildHostPairingUrl } from './host-pairing-url';

export interface HostPairingDialogData {
  code: string;
  screenVisibility?: HostPairingScreenVisibility;
  /** Nur aus „Präsentation starten“: öffnet den Presenter im Approve-/Schließen-Klick. */
  startPresenterView?: () => Promise<Window | null>;
}

export type HostPairingDialogResult = {
  connected: boolean;
  presenterOpened?: boolean;
};

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
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle, MatIcon, MatProgressBar],
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './host-pairing-dialog.component.scss',
  ],
  templateUrl: './host-pairing-dialog.component.html',
})
export class HostPairingDialogComponent implements OnDestroy {
  readonly data = inject<HostPairingDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<HostPairingDialogComponent, HostPairingDialogResult>>(MatDialogRef);
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
  readonly inviteExpiresAt = signal<string | null>(null);
  readonly nowMs = signal(Date.now());

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private remainingTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.remainingTimer = setInterval(() => this.nowMs.set(Date.now()), 15_000);
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    if (this.remainingTimer) clearInterval(this.remainingTimer);
  }

  dialogTitle(): string {
    if (this.view() === 'pending') {
      return $localize`:@@hostPairing.dialogTitlePending:Smartphone bestätigen`;
    }
    if (this.view() === 'manage') {
      return $localize`:@@hostPairing.devicesTitle:Verbundene Geräte`;
    }
    if (this.devices().length > 0) {
      return $localize`:@@hostPairing.dialogTitleAnother:Weiteres Gerät verbinden`;
    }
    return $localize`:@@hostPairing.dialogTitle:Smartphone zum Steuern verbinden`;
  }

  closeLabel(): string {
    if (this.data.startPresenterView) {
      if (this.view() === 'manage' && this.devices().length > 0) {
        return $localize`:@@presentationStart.title:Präsentation starten`;
      }
      if (this.view() === 'invite' || this.view() === 'loading') {
        return $localize`:@@hostPairing.presentWithoutPhone:Ohne Smartphone präsentieren`;
      }
    }
    return $localize`:@@hostPairing.close:Schließen`;
  }

  approveLabel(): string {
    return this.data.startPresenterView
      ? $localize`:@@hostPairing.approveAndPresent:Gerät verbinden und Präsentation starten`
      : $localize`:@@hostPairing.approve:Ja, Gerät verbinden`;
  }

  rejectLabel(): string {
    return this.data.startPresenterView
      ? $localize`:@@hostPairing.rejectRequest:Anfrage ablehnen`
      : $localize`:@@hostPairing.reject:Nein, ablehnen`;
  }

  inviteRemainingLabel(): string | null {
    const remaining = formatHostPairingRemainingClock(this.inviteExpiresAt(), this.nowMs());
    if (!remaining) return null;
    return $localize`:@@hostPairing.inviteRemaining:Noch ${remaining}:remaining: Minuten Zeit, um den QR-Code zu scannen.`;
  }

  pendingRemainingLabel(): string | null {
    const remaining = formatHostPairingRemainingClock(this.pending()?.expiresAt, this.nowMs());
    if (!remaining) return null;
    return $localize`:@@hostPairing.pendingRemaining:Noch ${remaining}:remaining: Minuten Zeit, um zu bestätigen.`;
  }

  deviceLabel(device: PairedHostDeviceDTO, index = 0): string {
    const label = device.deviceLabel?.trim();
    if (label) return label;
    if (index <= 0) {
      return $localize`:@@hostPairing.deviceFallbackPhone:Smartphone 1`;
    }
    if (index === 1) {
      return $localize`:@@hostPairing.deviceFallbackPhone2:Smartphone 2`;
    }
    return $localize`:@@hostPairing.deviceFallback:Weiteres Gerät 3`;
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
          $localize`:@@hostPairing.errorGeneric:Das Gerät konnte nicht verbunden werden. Bitte versuche es noch einmal.`,
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
      this.inviteExpiresAt.set(invite.expiresAt);
      const url = buildHostPairingUrl(this.data.code, invite.pairingSecret);
      this.pairingUrl.set(url);
      this.view.set('invite');
      await this.renderQr(url);
      this.startPolling();
    } catch (error: unknown) {
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorGeneric:Das Gerät konnte nicht verbunden werden. Bitte versuche es noch einmal.`,
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
    const presenterOpened = await this.startPresenterIfRequested();
    this.busy.set(true);
    try {
      await trpc.session.approveHostPairing.mutate({
        code: this.data.code,
        requestId,
      });
      this.pending.set(null);
      this.stopPolling();
      if (this.data.startPresenterView) {
        this.dialogRef.close({ connected: true, presenterOpened });
        return;
      }
      const state = await trpc.session.listPairedHosts.query({ code: this.data.code });
      this.applyListedState(state);
      this.view.set('manage');
    } catch (error: unknown) {
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorGeneric:Das Gerät konnte nicht verbunden werden. Bitte versuche es noch einmal.`,
        ),
      );
    } finally {
      this.busy.set(false);
    }
  }

  async finish(): Promise<void> {
    const connected = this.devices().length > 0;
    if (connected && this.data.startPresenterView) {
      const presenterOpened = await this.startPresenterIfRequested();
      this.dialogRef.close({ connected: true, presenterOpened });
      return;
    }
    this.dialogRef.close({ connected });
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
          $localize`:@@hostPairing.errorGeneric:Das Gerät konnte nicht verbunden werden. Bitte versuche es noch einmal.`,
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
      this.announcement.set($localize`:@@hostPairing.revokedLive:Gerät getrennt`);
      const state = await trpc.session.listPairedHosts.query({ code: this.data.code });
      this.applyListedState(state);
      this.view.set('manage');
    } catch (error: unknown) {
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorGeneric:Das Gerät konnte nicht verbunden werden. Bitte versuche es noch einmal.`,
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

  private async startPresenterIfRequested(): Promise<boolean | undefined> {
    const start = this.data.startPresenterView;
    if (!start) {
      return undefined;
    }
    try {
      return Boolean(await start());
    } catch {
      return false;
    }
  }

  private applyListedState(state: ListPairedHostsOutput): void {
    this.devices.set(state.devices);
    this.caps.set(state.caps);
    this.inviteExpiresAt.set(state.invite?.expiresAt ?? this.inviteExpiresAt());
    if (state.pending) {
      this.pending.set(state.pending);
      this.view.set('pending');
      return;
    }
    this.pending.set(null);
    if (this.view() === 'pending' && state.devices.length > 0) {
      this.view.set('manage');
      this.stopPolling();
      return;
    }
    if (this.view() === 'pending') {
      this.stopPolling();
      this.error.set($localize`:@@hostPairing.errorExpired:Die Zeit zum Verbinden ist abgelaufen.`);
      this.view.set('error');
      return;
    }
    if (this.view() === 'invite' && !state.invite) {
      this.stopPolling();
      if (state.devices.length > 0) {
        this.view.set('manage');
        return;
      }
      this.error.set($localize`:@@hostPairing.errorExpired:Die Zeit zum Verbinden ist abgelaufen.`);
      this.view.set('error');
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
      this.qrDataUrl.set(qr.createDataURL(8, 4));
    } catch {
      this.qrDataUrl.set(null);
    }
  }
}
