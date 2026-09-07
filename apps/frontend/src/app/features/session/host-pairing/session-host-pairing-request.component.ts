import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { HOST_PAIRING_DEVICE_LABEL_MAX } from '@arsnova/shared-types';
import {
  normalizeHostSessionCode,
  setHostSessionRole,
  setHostToken,
} from '../../../core/host-session-token';
import { localizeKnownServerError } from '../../../core/localize-known-server-message';
import { localizeCommands, localizePath } from '../../../core/locale-router';
import { setPendingHostSessionCode, trpc } from '../../../core/trpc.client';
import { formatHostPairingRemainingClock } from './host-pairing-remaining';
import { readHostPairingSecretFromLocation } from './host-pairing-url';

type RequestView =
  'missing' | 'ready' | 'requesting' | 'pending' | 'connected' | 'rejected' | 'expired' | 'error';

const POLL_MS = 1500;

@Component({
  selector: 'app-session-host-pairing-request',
  standalone: true,
  imports: [
    MatButton,
    MatCard,
    MatCardContent,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    MatProgressBar,
  ],
  templateUrl: './session-host-pairing-request.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './session-host-pairing-request.component.scss',
  ],
})
export class SessionHostPairingRequestComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly code = normalizeHostSessionCode(this.route.parent?.snapshot.paramMap.get('code') ?? '');
  readonly view = signal<RequestView>('ready');
  readonly indicator = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly deviceName = signal('');
  readonly expiresAt = signal<string | null>(null);
  readonly nowMs = signal(Date.now());
  readonly deviceNameMax = HOST_PAIRING_DEVICE_LABEL_MAX;

  requestQuestion(): string {
    return $localize`:@@hostPairing.requestQuestion:Mit der Veranstaltung ${this.code}:sessionCode: verbinden?`;
  }

  requestRemainingLabel(): string | null {
    const remaining = formatHostPairingRemainingClock(this.expiresAt(), this.nowMs());
    if (!remaining) return null;
    return $localize`:@@hostPairing.requestRemaining:Warte auf die Bestätigung · noch ${remaining}:remaining: Minuten`;
  }

  onDeviceNameInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.deviceName.set(value.slice(0, HOST_PAIRING_DEVICE_LABEL_MAX));
  }

  private pairingSecret: string | null = null;
  private requestId: string | null = null;
  private requestSecret: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private remainingTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (this.code.length !== 6) {
      this.view.set('error');
      this.error.set(
        $localize`:@@hostPairing.errorInvalidLink:Dieser Link ist nicht mehr gültig. Bitte zeige einen neuen QR-Code an.`,
      );
      return;
    }
    this.pairingSecret = readHostPairingSecretFromLocation(
      globalThis.window?.location ?? { hash: '' },
    );
    if (!this.pairingSecret) {
      this.view.set('missing');
      return;
    }
    this.remainingTimer = setInterval(() => this.nowMs.set(Date.now()), 15_000);
    this.stripSecretFromAddressBar();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.remainingTimer) clearInterval(this.remainingTimer);
  }

  async requestConnection(): Promise<void> {
    if (!this.pairingSecret) {
      this.view.set('missing');
      return;
    }
    this.view.set('requesting');
    this.error.set(null);
    try {
      const deviceLabel = this.deviceName().trim();
      const requested = await trpc.session.requestHostPairing.mutate({
        code: this.code,
        pairingSecret: this.pairingSecret,
        ...(deviceLabel ? { deviceLabel } : {}),
      });
      if (requested.alreadyPending || !requested.requestId || !requested.requestSecret) {
        this.view.set('error');
        this.error.set(
          $localize`:@@hostPairing.errorAlreadyPending:Es wartet bereits ein anderes Gerät auf Bestätigung.`,
        );
        return;
      }
      this.requestId = requested.requestId;
      this.requestSecret = requested.requestSecret;
      this.indicator.set(requested.confirmationIndicator);
      this.expiresAt.set(requested.expiresAt);
      this.view.set('pending');
      this.startPolling();
    } catch (error: unknown) {
      this.view.set('error');
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorInvalidLink:Dieser Link ist nicht mehr gültig. Bitte zeige einen neuen QR-Code an.`,
        ),
      );
    }
  }

  goHome(): void {
    void this.router.navigateByUrl(localizePath('/'), { replaceUrl: true });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.refreshRequest();
    }, POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async refreshRequest(): Promise<void> {
    if (!this.requestId || !this.requestSecret) return;
    try {
      const result = await trpc.session.getHostPairingRequest.query({
        code: this.code,
        requestId: this.requestId,
        requestSecret: this.requestSecret,
      });
      if (result.state === 'PENDING_APPROVAL') {
        this.indicator.set(result.confirmationIndicator);
        this.expiresAt.set(result.expiresAt);
        return;
      }
      if (result.token?.pairedHostToken) {
        this.stopPolling();
        setHostToken(this.code, result.token.pairedHostToken);
        setHostSessionRole(this.code, 'PAIRED_HOST');
        setPendingHostSessionCode(this.code);
        this.view.set('connected');
        await this.router.navigate(localizeCommands(['session', this.code, 'host']));
        return;
      }
      if (result.state === 'CONNECTED' || result.state === 'PAIRED_HOST_TOKEN_ISSUED') {
        this.stopPolling();
        this.view.set('error');
        this.error.set(
          $localize`:@@hostPairing.errorExpired:Die Zeit zum Verbinden ist abgelaufen.`,
        );
        return;
      }
      if (result.state === 'REJECTED') {
        this.stopPolling();
        this.view.set('rejected');
        return;
      }
      if (result.state === 'EXPIRED') {
        this.stopPolling();
        this.view.set('expired');
        return;
      }
    } catch (error: unknown) {
      this.stopPolling();
      this.view.set('error');
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorInvalidLink:Dieser Link ist nicht mehr gültig. Bitte zeige einen neuen QR-Code an.`,
        ),
      );
    }
  }

  private stripSecretFromAddressBar(): void {
    if (typeof globalThis.window === 'undefined') return;
    const url = new URL(globalThis.window.location.href);
    if (!url.hash) return;
    url.hash = '';
    globalThis.window.history.replaceState(globalThis.window.history.state, '', url.toString());
  }
}
