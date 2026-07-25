import { beforeEach, describe, expect, it, vi } from 'vitest';

const createTRPCProxyClientMock = vi.fn((opts) => opts);
const wsClientCloseMock = vi.fn();
const wsTransportCloseMock = vi.fn();
type MockConnectionState = 'idle' | 'connecting' | 'pending';
let mockConnectionState: MockConnectionState = 'pending';
let mockConnectionId = 1;
let pauseReconnect = false;
const connectionStateObservers = new Set<{
  next(state: { state: MockConnectionState; error: null }): void;
}>();
const transportCloseListeners = new Set<() => void>();

function emitConnectionState(state: MockConnectionState): void {
  mockConnectionState = state;
  connectionStateObservers.forEach((observer) => observer.next({ state, error: null }));
}

function completeMockReconnect(): void {
  mockConnectionId += 1;
  emitConnectionState('pending');
}

const mockTransport = {
  addEventListener: vi.fn((event: string, listener: () => void) => {
    if (event === 'close') transportCloseListeners.add(listener);
  }),
  close: wsTransportCloseMock,
};
wsTransportCloseMock.mockImplementation(() => {
  emitConnectionState('connecting');
  transportCloseListeners.forEach((listener) => listener());
  transportCloseListeners.clear();
  if (!pauseReconnect) queueMicrotask(completeMockReconnect);
});

const createWSClientMock = vi.fn(() => ({
  close: wsClientCloseMock,
  get connection() {
    return { id: mockConnectionId, state: 'open' as const, ws: mockTransport };
  },
  connectionState: {
    get: () => ({ state: mockConnectionState, error: null }),
    subscribe: vi.fn(
      (observer: { next(state: { state: MockConnectionState; error: null }): void }) => {
        connectionStateObservers.add(observer);
        observer.next({ state: mockConnectionState, error: null });
        return { unsubscribe: () => connectionStateObservers.delete(observer) };
      },
    ),
  },
}));
const httpBatchLinkMock = vi.fn((opts) => opts);
const splitLinkMock = vi.fn((opts) => opts);
const wsRequestSubscribeMock = vi.fn((_observer: unknown) => ({ unsubscribe: vi.fn() }));
const wsLinkMock = vi.fn(() => () => () => ({ subscribe: wsRequestSubscribeMock }));
const getHostTokenMock = vi.fn();
const normalizeHostSessionCodeMock = vi.fn((code: string) => code.trim().toUpperCase());
const storeHostTokenMock = vi.fn();
const getFeedbackHostTokenMock = vi.fn();
const normalizeFeedbackCodeMock = vi.fn((code: string) => code.trim().toUpperCase());
const getTrpcWsUrlMock = vi.fn(() => 'ws://localhost:3001');

async function loadClientModule(pathname: string, beforeImport?: () => void) {
  vi.resetModules();
  vi.clearAllMocks();
  mockConnectionState = 'pending';
  mockConnectionId = 1;
  pauseReconnect = false;
  connectionStateObservers.clear();
  transportCloseListeners.clear();
  wsTransportCloseMock.mockImplementation(() => {
    emitConnectionState('connecting');
    transportCloseListeners.forEach((listener) => listener());
    transportCloseListeners.clear();
    if (!pauseReconnect) queueMicrotask(completeMockReconnect);
  });
  globalThis.window.sessionStorage.clear();
  globalThis.window.localStorage.clear();
  globalThis.window.history.replaceState({}, '', pathname);
  beforeImport?.();

  vi.doMock('@trpc/client', () => ({
    createTRPCProxyClient: createTRPCProxyClientMock,
    createWSClient: createWSClientMock,
    httpBatchLink: httpBatchLinkMock,
    splitLink: splitLinkMock,
    wsLink: wsLinkMock,
  }));
  vi.doMock('./host-session-token', () => ({
    getHostToken: getHostTokenMock,
    normalizeHostSessionCode: normalizeHostSessionCodeMock,
    setHostToken: storeHostTokenMock,
  }));
  vi.doMock('./feedback-host-token', () => ({
    getFeedbackHostToken: getFeedbackHostTokenMock,
    normalizeFeedbackCode: normalizeFeedbackCodeMock,
  }));
  vi.doMock('./ws-urls', () => ({
    getTrpcWsUrl: getTrpcWsUrlMock,
  }));

  return import('./trpc.client');
}

describe('trpc.client host transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.window.sessionStorage.clear();
    globalThis.window.history.replaceState({}, '', '/');
  });

  it('haengt Host-Token auf lokalisierter Presenter-Route an HTTP-Requests', async () => {
    getHostTokenMock.mockReturnValue('host-token-123');

    await loadClientModule('/de/session/abc123/present');

    const httpOptions = httpBatchLinkMock.mock.calls[0]?.[0] as {
      url: string;
      headers: () => Record<string, string>;
    };
    const headers = httpOptions.headers();

    expect(normalizeHostSessionCodeMock).toHaveBeenCalledWith('abc123');
    expect(httpOptions.url).toBe('http://localhost:3000/trpc');
    expect(headers).toEqual({ 'x-host-token': 'host-token-123' });
  });

  it('sendet Host-Token ueber WebSocket-Connection-Params fuer Host-Subscriptions', async () => {
    getHostTokenMock.mockReturnValue('host-token-123');

    await loadClientModule('/en/session/abc123/host', () => {
      globalThis.window.localStorage.setItem(
        'arsnova-participant-ABC123',
        '11111111-1111-4111-8111-111111111111',
      );
    });

    const wsOptions = createWSClientMock.mock.calls[0]?.[0] as {
      connectionParams: () =>
        Promise<Record<string, string> | undefined> | Record<string, string> | undefined;
    };
    const connectionParams = await wsOptions.connectionParams();

    expect(normalizeHostSessionCodeMock).toHaveBeenCalledWith('abc123');
    expect(connectionParams).toEqual({
      sessionCode: 'ABC123',
      'x-host-token': 'host-token-123',
    });
  });

  it('sendet normalisierten Session-Code und lokal gespeicherte Participant-ID als Throttle-Signal', async () => {
    await loadClientModule('/de/session/abc123/vote', () => {
      globalThis.window.localStorage.setItem(
        'arsnova-participant-ABC123',
        '11111111-1111-4111-8111-111111111111',
      );
    });

    const wsOptions = createWSClientMock.mock.calls[0]?.[0] as {
      connectionParams: () => Record<string, string> | null;
    };

    expect(wsOptions.connectionParams()).toEqual({
      sessionCode: 'ABC123',
      participantId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('ignoriert eine ungültige lokale Participant-ID und behält das Session-Signal', async () => {
    await loadClientModule('/session/abc123', () => {
      globalThis.window.localStorage.setItem('arsnova-participant-ABC123', 'ungueltig');
    });

    const wsOptions = createWSClientMock.mock.calls[0]?.[0] as {
      connectionParams: () => Record<string, string> | null;
    };

    expect(wsOptions.connectionParams()).toEqual({ sessionCode: 'ABC123' });
  });

  it('schließt den wiederverwendeten WebSocket bei A→B-Navigation und bindet B neu', async () => {
    await loadClientModule('/de/session/aaa111/vote', () => {
      globalThis.window.localStorage.setItem(
        'arsnova-participant-AAA111',
        '11111111-1111-4111-8111-111111111111',
      );
      globalThis.window.localStorage.setItem(
        'arsnova-participant-BBB222',
        '22222222-2222-4222-8222-222222222222',
      );
    });
    const splitOptions = splitLinkMock.mock.calls[0]?.[0] as {
      condition: (op: { type: string }) => boolean;
      true: (runtime: unknown) => (input: unknown) => {
        subscribe(observer: unknown): { unsubscribe(): void };
      };
    };
    const wsOptions = createWSClientMock.mock.calls[0]?.[0] as {
      connectionParams: () => Record<string, string> | null;
    };

    expect(splitOptions.condition({ type: 'subscription' })).toBe(true);
    expect(wsTransportCloseMock).not.toHaveBeenCalled();
    expect(wsOptions.connectionParams()).toMatchObject({
      sessionCode: 'AAA111',
      participantId: '11111111-1111-4111-8111-111111111111',
    });

    globalThis.window.history.replaceState({}, '', '/fr/session/bbb222/vote');
    pauseReconnect = true;

    expect(splitOptions.condition({ type: 'subscription' })).toBe(true);
    const reboundLink = splitOptions.true({});
    const reboundObservable = reboundLink({
      op: { id: 1, type: 'subscription', path: 'session.onStatusChanged' },
      next: vi.fn(),
    });
    const reboundSubscription = reboundObservable.subscribe({});
    await vi.waitFor(() => expect(wsTransportCloseMock).toHaveBeenCalledTimes(1));
    expect(wsRequestSubscribeMock).not.toHaveBeenCalled();
    completeMockReconnect();
    await vi.waitFor(() => expect(wsRequestSubscribeMock).toHaveBeenCalledTimes(1));
    expect(wsOptions.connectionParams()).toMatchObject({
      sessionCode: 'BBB222',
      participantId: '22222222-2222-4222-8222-222222222222',
    });

    expect(splitOptions.condition({ type: 'subscription' })).toBe(true);
    expect(wsTransportCloseMock).toHaveBeenCalledTimes(1);
    expect(wsClientCloseMock).not.toHaveBeenCalled();
    reboundSubscription.unsubscribe();
  });

  it('löst den Binding-Refresh auf, wenn die letzte Subscription während Reconnect endet', async () => {
    await loadClientModule('/de/session/aaa111/vote', () => {
      globalThis.window.localStorage.setItem(
        'arsnova-participant-BBB222',
        '22222222-2222-4222-8222-222222222222',
      );
    });
    const splitOptions = splitLinkMock.mock.calls[0]?.[0] as {
      condition: (op: { type: string }) => boolean;
      true: (runtime: unknown) => (input: unknown) => {
        subscribe(observer: unknown): { unsubscribe(): void };
      };
    };
    const wsOptions = createWSClientMock.mock.calls[0]?.[0] as {
      connectionParams: () => Record<string, string> | null;
    };
    expect(splitOptions.condition({ type: 'subscription' })).toBe(true);
    const link = splitOptions.true({});
    const activeSubscription = link({
      op: { id: 1, type: 'subscription', path: 'session.onStatusChanged' },
      next: vi.fn(),
    }).subscribe({});
    await vi.waitFor(() => expect(wsRequestSubscribeMock).toHaveBeenCalledTimes(1));

    globalThis.window.history.replaceState({}, '', '/de/session/bbb222/vote');
    pauseReconnect = true;
    expect(splitOptions.condition({ type: 'subscription' })).toBe(true);
    const nextSubscription = link({
      op: { id: 2, type: 'subscription', path: 'session.onStatusChanged' },
      next: vi.fn(),
    }).subscribe({});
    await vi.waitFor(() => expect(wsTransportCloseMock).toHaveBeenCalledTimes(1));
    expect(wsRequestSubscribeMock).toHaveBeenCalledTimes(1);

    activeSubscription.unsubscribe();
    emitConnectionState('idle');

    await vi.waitFor(() => expect(wsRequestSubscribeMock).toHaveBeenCalledTimes(2));
    expect(wsOptions.connectionParams()).toEqual({
      sessionCode: 'BBB222',
      participantId: '22222222-2222-4222-8222-222222222222',
    });
    expect(wsClientCloseMock).not.toHaveBeenCalled();
    nextSubscription.unsubscribe();
  });

  it('erhält eine aktive Subscription nach Participant-Binding-Wechsel', async () => {
    const { refreshTrpcWsBinding } = await loadClientModule('/session/abc123/vote');
    const splitOptions = splitLinkMock.mock.calls[0]?.[0] as {
      condition: (op: { type: string }) => boolean;
      true: (runtime: unknown) => (input: unknown) => {
        subscribe(observer: unknown): { unsubscribe(): void };
      };
    };
    const wsOptions = createWSClientMock.mock.calls[0]?.[0] as {
      connectionParams: () => Record<string, string> | null;
    };
    const activeObserver = {
      next: vi.fn(),
      error: vi.fn(),
      complete: vi.fn(),
    };
    expect(splitOptions.condition({ type: 'subscription' })).toBe(true);
    const activeLink = splitOptions.true({});
    const activeObservable = activeLink({
      op: { id: 1, type: 'subscription', path: 'session.onStatusChanged' },
      next: vi.fn(),
    });
    const activeSubscription = activeObservable.subscribe(activeObserver);
    await vi.waitFor(() => expect(wsRequestSubscribeMock).toHaveBeenCalledTimes(1));
    const delegatedObserver = wsRequestSubscribeMock.mock.calls[0]?.[0] as {
      next(value: unknown): void;
    };
    delegatedObserver.next({ status: 'LOBBY' });

    globalThis.window.localStorage.setItem(
      'arsnova-participant-ABC123',
      '11111111-1111-4111-8111-111111111111',
    );

    expect(refreshTrpcWsBinding()).toBe(true);
    await vi.waitFor(() => expect(wsTransportCloseMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(mockConnectionId).toBe(2));
    expect(wsClientCloseMock).not.toHaveBeenCalled();
    expect(activeObserver.complete).not.toHaveBeenCalled();
    delegatedObserver.next({ status: 'ACTIVE' });
    expect(activeObserver.next).toHaveBeenNthCalledWith(1, { status: 'LOBBY' });
    expect(activeObserver.next).toHaveBeenNthCalledWith(2, { status: 'ACTIVE' });
    expect(wsOptions.connectionParams()).toEqual({
      sessionCode: 'ABC123',
      participantId: '11111111-1111-4111-8111-111111111111',
    });
    expect(refreshTrpcWsBinding()).toBe(false);
    activeSubscription.unsubscribe();
  });

  it('sendet Blitzlicht-Host-Token ueber WebSocket-Connection-Params fuer Standalone-Host-Subscriptions', async () => {
    getFeedbackHostTokenMock.mockReturnValue('feedback-token-456');

    await loadClientModule('/en/feedback/abc123');

    const wsOptions = createWSClientMock.mock.calls[0]?.[0] as {
      connectionParams: () =>
        Promise<Record<string, string> | undefined> | Record<string, string> | undefined;
    };
    const connectionParams = await wsOptions.connectionParams();

    expect(normalizeFeedbackCodeMock).toHaveBeenCalledWith('abc123');
    expect(connectionParams).toEqual({
      'x-feedback-host-token': 'feedback-token-456',
    });
  });

  it('erkennt lokalisierte Blitzlicht-Host-Routen weiter fuer Header-Injektion', async () => {
    getFeedbackHostTokenMock.mockReturnValue('feedback-token-456');

    await loadClientModule('/fr/feedback/abc123');

    const httpOptions = httpBatchLinkMock.mock.calls[0]?.[0] as {
      headers: () => Record<string, string>;
    };
    const headers = httpOptions.headers();

    expect(normalizeFeedbackCodeMock).toHaveBeenCalledWith('abc123');
    expect(headers).toEqual({ 'x-feedback-host-token': 'feedback-token-456' });
  });
});

describe('trpc.client reconnect jitter', () => {
  it('verwendet exponentielles Backoff mit begrenztem 0–349-ms-Jitter', async () => {
    const { retryDelayMs } = await loadClientModule('/');

    expect(retryDelayMs(0, () => 0)).toBe(500);
    expect(retryDelayMs(1, () => 0.5)).toBe(1_175);
    expect(retryDelayMs(8, () => 0.999999)).toBe(10_349);
  });
});
