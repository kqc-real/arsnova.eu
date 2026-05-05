import { beforeEach, describe, expect, it, vi } from 'vitest';

const createTRPCProxyClientMock = vi.fn((opts) => opts);
const createWSClientMock = vi.fn(() => ({
  connectionState: {
    subscribe: vi.fn(),
  },
}));
const httpBatchLinkMock = vi.fn((opts) => opts);
const splitLinkMock = vi.fn((opts) => opts);
const wsLinkMock = vi.fn((opts) => opts);
const getHostTokenMock = vi.fn();
const normalizeHostSessionCodeMock = vi.fn((code: string) => code.trim().toUpperCase());
const storeHostTokenMock = vi.fn();
const getFeedbackHostTokenMock = vi.fn();
const normalizeFeedbackCodeMock = vi.fn((code: string) => code.trim().toUpperCase());
const getTrpcWsUrlMock = vi.fn(() => 'ws://localhost:3001');

async function loadClientModule(pathname: string) {
  vi.resetModules();
  vi.clearAllMocks();
  globalThis.window.sessionStorage.clear();
  globalThis.window.history.replaceState({}, '', pathname);

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

    await loadClientModule('/en/session/abc123/host');

    const wsOptions = createWSClientMock.mock.calls[0]?.[0] as {
      connectionParams: () =>
        | Promise<Record<string, string> | undefined>
        | Record<string, string>
        | undefined;
    };
    const connectionParams = await wsOptions.connectionParams();

    expect(normalizeHostSessionCodeMock).toHaveBeenCalledWith('abc123');
    expect(connectionParams).toEqual({
      'x-host-token': 'host-token-123',
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
