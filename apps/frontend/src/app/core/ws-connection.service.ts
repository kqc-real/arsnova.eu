/**
 * WebSocket-Verbindungsstatus als Angular Signal (Story 4.3).
 * Exponential Backoff wird in trpc.client.ts konfiguriert.
 */
import { Injectable, OnDestroy, signal } from '@angular/core';
import { type WsConnectionState, getWsConnectionState, onWsStateChange } from './trpc.client';

export const MANUAL_RECONNECT_OFFER_DELAY_MS = 8000;
type ManualReconnectHandler = () => Promise<void>;

@Injectable({ providedIn: 'root' })
export class WsConnectionService implements OnDestroy {
  readonly state = signal<WsConnectionState>(getWsConnectionState());
  readonly disconnected = signal(
    this.state() === 'reconnecting' || this.state() === 'disconnected',
  );
  readonly manualReconnectOffered = signal(false);
  readonly manualReconnectPending = signal(false);
  readonly manualReconnectFailed = signal(false);
  private readonly unsubscribe: () => void;
  private manualReconnectHandler: ManualReconnectHandler | null = null;
  private offerTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.unsubscribe = onWsStateChange((s) => {
      this.state.set(s);
      /** `idle` = tRPC Lazy-Mode ohne offene WS (kein Fehler) — kein Banner. */
      this.disconnected.set(s === 'reconnecting' || s === 'disconnected');
      this.syncManualReconnectOffer();
    });
  }

  registerManualReconnect(handler: ManualReconnectHandler): () => void {
    this.manualReconnectHandler = handler;
    this.syncManualReconnectOffer();
    return () => {
      if (this.manualReconnectHandler !== handler) return;
      this.manualReconnectHandler = null;
      this.resetManualReconnectState();
    };
  }

  async runManualReconnect(): Promise<void> {
    const handler = this.manualReconnectHandler;
    if (!handler || this.manualReconnectPending()) return;
    this.manualReconnectPending.set(true);
    this.manualReconnectFailed.set(false);
    try {
      await handler();
    } catch {
      this.manualReconnectFailed.set(true);
    } finally {
      this.manualReconnectPending.set(false);
    }
  }

  private syncManualReconnectOffer(): void {
    if (!this.manualReconnectHandler || !this.disconnected()) {
      this.resetManualReconnectState();
      return;
    }
    if (this.manualReconnectOffered() || this.offerTimer) return;
    this.offerTimer = setTimeout(() => {
      this.offerTimer = null;
      if (this.manualReconnectHandler && this.disconnected()) {
        this.manualReconnectOffered.set(true);
      }
    }, MANUAL_RECONNECT_OFFER_DELAY_MS);
  }

  private resetManualReconnectState(): void {
    if (this.offerTimer) {
      clearTimeout(this.offerTimer);
      this.offerTimer = null;
    }
    this.manualReconnectOffered.set(false);
    this.manualReconnectPending.set(false);
    this.manualReconnectFailed.set(false);
  }

  ngOnDestroy(): void {
    this.resetManualReconnectState();
    this.unsubscribe();
  }
}
