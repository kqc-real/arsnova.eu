import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wsMock = vi.hoisted(() => ({
  state: 'connected' as 'connected' | 'disconnected' | 'reconnecting' | 'idle',
  listener: null as
    ((state: 'connected' | 'disconnected' | 'reconnecting' | 'idle') => void) | null,
}));

vi.mock('./trpc.client', () => ({
  getWsConnectionState: () => wsMock.state,
  onWsStateChange: (
    listener: (state: 'connected' | 'disconnected' | 'reconnecting' | 'idle') => void,
  ) => {
    wsMock.listener = listener;
    return () => {
      if (wsMock.listener === listener) wsMock.listener = null;
    };
  },
}));

import { MANUAL_RECONNECT_OFFER_DELAY_MS, WsConnectionService } from './ws-connection.service';

describe('WsConnectionService manual reconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    wsMock.state = 'connected';
    wsMock.listener = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bietet den manuellen Reconnect erst nach anhaltender Trennung an', () => {
    const service = new WsConnectionService();
    const unregister = service.registerManualReconnect(vi.fn(async () => undefined));

    wsMock.listener?.('reconnecting');
    vi.advanceTimersByTime(MANUAL_RECONNECT_OFFER_DELAY_MS - 1);
    expect(service.manualReconnectOffered()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(service.manualReconnectOffered()).toBe(true);

    unregister();
    service.ngOnDestroy();
  });

  it('verhindert doppelte Versuche und setzt einen fehlgeschlagenen Versuch frei', async () => {
    let rejectReconnect: ((error: Error) => void) | null = null;
    const reconnect = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectReconnect = reject;
        }),
    );
    const service = new WsConnectionService();
    service.registerManualReconnect(reconnect);
    wsMock.listener?.('disconnected');
    vi.advanceTimersByTime(MANUAL_RECONNECT_OFFER_DELAY_MS);

    const first = service.runManualReconnect();
    const second = service.runManualReconnect();
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(service.manualReconnectPending()).toBe(true);

    rejectReconnect?.(new Error('offline'));
    await Promise.all([first, second]);
    expect(service.manualReconnectPending()).toBe(false);
    expect(service.manualReconnectFailed()).toBe(true);
    expect(service.manualReconnectOffered()).toBe(true);
    service.ngOnDestroy();
  });

  it('entfernt Angebot und Fehlerstatus nach wiederhergestellter Verbindung', async () => {
    const service = new WsConnectionService();
    service.registerManualReconnect(async () => {
      throw new Error('offline');
    });
    wsMock.listener?.('disconnected');
    vi.advanceTimersByTime(MANUAL_RECONNECT_OFFER_DELAY_MS);
    await service.runManualReconnect();
    expect(service.manualReconnectFailed()).toBe(true);

    wsMock.listener?.('connected');
    expect(service.disconnected()).toBe(false);
    expect(service.manualReconnectOffered()).toBe(false);
    expect(service.manualReconnectFailed()).toBe(false);
    service.ngOnDestroy();
  });
});
