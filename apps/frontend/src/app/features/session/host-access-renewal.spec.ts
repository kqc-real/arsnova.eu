import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHostBrowserCapability } from '../../core/host-recovery-access';
import { getHostSessionRole, setHostToken } from '../../core/host-session-token';
import { refreshTrpcWsBinding, trpc } from '../../core/trpc.client';
import { renewBrowserHostAccess } from './host-access-renewal';

const renewedAccess = {
  code: 'ABC123',
  hostToken: 'erneuerter-token',
  hostTokenExpiresAt: '2026-11-09T18:00:00.000Z',
  role: 'ORIGINAL_HOST' as const,
};

vi.mock('../../core/host-recovery-access', () => ({ getHostBrowserCapability: vi.fn() }));
vi.mock('../../core/host-session-token', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/host-session-token')>()),
  getHostSessionRole: vi.fn(),
  setHostToken: vi.fn(),
}));
vi.mock('../../core/trpc.client', () => ({
  refreshTrpcWsBinding: vi.fn(),
  trpc: { session: { issueHostAccessToken: { mutate: vi.fn() } } },
}));

describe('renewBrowserHostAccess', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getHostBrowserCapability).mockReturnValue('browser-capability');
  });

  it('teilt eine laufende Erneuerung beim Wechsel zwischen den Ansichten', async () => {
    vi.mocked(trpc.session.issueHostAccessToken.mutate).mockResolvedValue(renewedAccess);
    const renewal = renewBrowserHostAccess('abc123');

    expect(renewBrowserHostAccess('ABC123')).toBe(renewal);
    await renewal;
    expect(trpc.session.issueHostAccessToken.mutate).toHaveBeenCalledExactlyOnceWith({
      code: 'ABC123',
      browserCapability: 'browser-capability',
    });
    expect(setHostToken).toHaveBeenCalledExactlyOnceWith('ABC123', 'erneuerter-token');
    expect(refreshTrpcWsBinding).toHaveBeenCalledOnce();
  });

  it('ignoriert eine Antwort nach Wegfall der Browser-Berechtigung', async () => {
    vi.mocked(trpc.session.issueHostAccessToken.mutate).mockResolvedValue(renewedAccess);
    const renewal = renewBrowserHostAccess('ABC123');
    vi.mocked(getHostBrowserCapability).mockReturnValue(null);

    await renewal;
    expect(setHostToken).not.toHaveBeenCalled();
    expect(refreshTrpcWsBinding).not.toHaveBeenCalled();
  });

  it('erneuert keinen gekoppelten Host-Token', () => {
    vi.mocked(getHostSessionRole).mockReturnValue('PAIRED_HOST');

    expect(renewBrowserHostAccess('ABC123')).toBeNull();
    expect(trpc.session.issueHostAccessToken.mutate).not.toHaveBeenCalled();
  });
});
