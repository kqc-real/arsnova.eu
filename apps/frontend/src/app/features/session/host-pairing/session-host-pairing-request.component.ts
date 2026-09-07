import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatProgressBar } from '@angular/material/progress-bar';
import { normalizeHostSessionCode, setHostToken } from '../../../core/host-session-token';
import { localizeKnownServerError } from '../../../core/localize-known-server-message';
import { localizeCommands } from '../../../core/locale-router';
import { setPendingHostSessionCode, trpc } from '../../../core/trpc.client';
import { readHostPairingSecretFromLocation } from './host-pairing-url';

type RequestView =
  'missing' | 'ready' | 'requesting' | 'pending' | 'connected' | 'rejected' | 'expired' | 'error';

const POLL_MS = 1500;

@Component({
  selector: 'app-session-host-pairing-request',
  standalone: true,
  imports: [MatButton, MatCard, MatCardContent, MatProgressBar],
  templateUrl: './session-host-pairing-request.component.html',
  styleUrl: './session-host-pairing-request.component.scss',
})
export class SessionHostPairingRequestComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly code = normalizeHostSessionCode(this.route.parent?.snapshot.paramMap.get('code') ?? '');
  readonly view = signal<RequestView>('ready');
  readonly indicator = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  requestQuestion(): string {
    return $localize`:@@hostPairing.requestQuestion:Mit Veranstaltung ${this.code}:sessionCode: verbinden?`;
  }

  private pairingSecret: string | null = null;
  private requestId: string | null = null;
  private requestSecret: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (this.code.length !== 6) {
      this.view.set('error');
      this.error.set(
        $localize`:@@hostPairing.errorInvalidLink:Dieser Verbindungslink ist ungültig oder abgelaufen.`,
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
    this.stripSecretFromAddressBar();
  }

  ngOnDestroy(): void {
    this.stopPolling();
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
          $localize`:@@hostPairing.errorAlreadyPending:Es wartet bereits eine Verbindungsanfrage.`,
        );
        return;
      }
      this.requestId = requested.requestId;
      this.requestSecret = requested.requestSecret;
      this.indicator.set(requested.confirmationIndicator);
      this.view.set('pending');
      this.startPolling();
    } catch (error: unknown) {
      this.view.set('error');
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@hostPairing.errorInvalidLink:Dieser Verbindungslink ist ungültig oder abgelaufen.`,
        ),
      );
    }
  }

  goHome(): void {
    void this.router.navigate(localizeCommands(['']));
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
        return;
      }
      if (result.token?.pairedHostToken) {
        this.stopPolling();
        setHostToken(this.code, result.token.pairedHostToken);
        setPendingHostSessionCode(this.code);
        this.view.set('connected');
        await this.router.navigate(localizeCommands(['session', this.code, 'host']));
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
          $localize`:@@hostPairing.errorInvalidLink:Dieser Verbindungslink ist ungültig oder abgelaufen.`,
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
