/**
 * WebSocket-Verbindungsstatus als Angular Signal (Story 4.3).
 * Exponential Backoff wird in trpc.client.ts konfiguriert.
 */
import { Injectable, OnDestroy, signal } from '@angular/core';
import { type WsConnectionState, getWsConnectionState, onWsStateChange } from './trpc.client';

@Injectable({ providedIn: 'root' })
export class WsConnectionService implements OnDestroy {
  readonly state = signal<WsConnectionState>(getWsConnectionState());
  readonly disconnected = signal(false);
  private readonly unsubscribe: () => void;

  constructor() {
    this.unsubscribe = onWsStateChange((s) => {
      this.state.set(s);
      /** `idle` = tRPC Lazy-Mode ohne offene WS (kein Fehler) — kein Banner. */
      this.disconnected.set(s === 'reconnecting' || s === 'disconnected');
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }
}
