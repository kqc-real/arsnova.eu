import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import {
  normalizeHostSessionCode,
  setHostSessionRole,
  setHostToken,
} from '../../../core/host-session-token';
import { localizeKnownServerError } from '../../../core/localize-known-server-message';
import { localizeCommands, localizePath } from '../../../core/locale-router';
import { setPendingHostSessionCode, trpc } from '../../../core/trpc.client';
import {
  HOST_PAIRING_REMAINING_TICK_MS,
  formatHostPairingRemainingClock,
} from './host-pairing-remaining';
import { readHostPairingSecretFromLocation } from './host-pairing-url';

type RequestView =
  'missing' | 'ready' | 'requesting' | 'pending' | 'connected' | 'rejected' | 'expired' | 'error';

const POLL_MS = 1500;
const DEFINITIVE_EXPIRED_POLL_MARKERS = [
  'Es gibt keine offene Verbindungsanfrage.',
  'Die Verbindungsanfrage ist abgelaufen.',
  'Dieser Verbindungslink ist ungültig oder abgelaufen.',
] as const;

function readErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return '';
}

function readTrpcDataCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null;
  const data = error.data;
  if (!data || typeof data !== 'object' || !('code' in data)) return null;
  return typeof data.code === 'string' ? data.code : null;
}

function definitivePairingPollOutcome(error: unknown): 'expired' | 'error' | null {
  const message = readErrorMessage(error);
  if (DEFINITIVE_EXPIRED_POLL_MARKERS.some((marker) => message.includes(marker))) {
    return 'expired';
  }
  if (readTrpcDataCode(error) === 'NOT_FOUND') {
    return 'expired';
  }
  if (
    message.includes('Die Veranstaltung ist bereits beendet.') ||
    message.includes('Session nicht gefunden.')
  ) {
    return 'error';
  }
  return null;
}

@Component({
  selector: 'app-session-host-pairing-request',
  standalone: true,
  imports: [MatButton, MatCard, MatCardContent, MatIcon, MatProgressBar],
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
  readonly expiresAt = signal<string | null>(null);
  readonly nowMs = signal(Date.now());

  requestQuestion(): string {
    return $localize`:@@hostPairing.requestQuestion:Mit der Veranstaltung ${this.code}:sessionCode: verbinden?`;
  }

  readonly requestRemainingLabel = computed(() => {
    const remaining = formatHostPairingRemainingClock(this.expiresAt(), this.nowMs());
    if (!remaining) return null;
    return $localize`:@@hostPairing.requestRemaining:Noch ${remaining}:remaining: Minuten Zeit, um zu bestätigen.`;
  });

  private pairingSecret: string | null = null;
  private requestId: string | null = null;
  private requestSecret: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private remainingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly onVisibilityChange = (): void => {
    if (globalThis.document?.visibilityState !== 'visible') return;
    void this.refreshRequest();
  };

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
    this.remainingTimer = setInterval(
      () => this.nowMs.set(Date.now()),
      HOST_PAIRING_REMAINING_TICK_MS,
    );
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
      const requested = await trpc.session.requestHostPairing.mutate({
        code: this.code,
        pairingSecret: this.pairingSecret,
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
    globalThis.document?.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.refreshRequest();
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    globalThis.document?.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private hasRequestExpiredLocally(): boolean {
    const expiresAt = this.expiresAt();
    if (!expiresAt) return false;
    const parsed = Date.parse(expiresAt);
    return Number.isFinite(parsed) && parsed <= Date.now();
  }

  private finishAsExpired(): void {
    this.stopPolling();
    this.view.set('expired');
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
        if (this.hasRequestExpiredLocally()) {
          this.finishAsExpired();
        }
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
      if (this.hasRequestExpiredLocally()) {
        this.finishAsExpired();
        return;
      }
      const outcome = definitivePairingPollOutcome(error);
      if (outcome === 'expired') {
        this.finishAsExpired();
        return;
      }
      if (outcome === 'error') {
        this.stopPolling();
        this.view.set('error');
        this.error.set(
          localizeKnownServerError(
            error,
            $localize`:@@hostPairing.errorInvalidLink:Dieser Link ist nicht mehr gültig. Bitte zeige einen neuen QR-Code an.`,
          ),
        );
        return;
      }
      /* Transiente Transportfehler nicht als Abbruch zeigen — der nächste Tick holt nach. */
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
