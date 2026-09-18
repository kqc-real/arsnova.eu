import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearHostToken, getHostToken, setHostToken } from '../../core/host-session-token';
import {
  getHostBrowserCapability,
  getStagedHostRecoveryCard,
  persistInitialHostRecovery,
  persistPreparedHostRecovery,
} from '../../core/host-recovery-access';
import { requireHostToken } from './session-host.guard';

const { participantsMock, issueMock, bootstrapMock, activateMock } = vi.hoisted(() => ({
  participantsMock: vi.fn(),
  issueMock: vi.fn(),
  bootstrapMock: vi.fn(),
  activateMock: vi.fn(),
}));

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    session: {
      getParticipantSummary: { query: participantsMock },
      issueHostAccessToken: { mutate: issueMock },
      prepareHostCredentialBootstrap: { mutate: bootstrapMock },
      activateHostCredential: { mutate: activateMock },
    },
  },
}));

const CODE = 'ABC123';
const BROWSER_CAPABILITY = 'browser-capability-abcdefghijklmnopqrstuvwxyz';
const RECOVERY_CODE = 'recovery-capability-abcdefghijklmnopqrstuvwxyz';

function route(): ActivatedRouteSnapshot {
  return {
    paramMap: convertToParamMap({ code: CODE }),
    pathFromRoot: [],
  } as unknown as ActivatedRouteSnapshot;
}

describe('requireHostToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    clearHostToken(CODE);
    participantsMock.mockResolvedValue({ participants: [], participantCount: 0 });
    issueMock.mockResolvedValue({
      code: CODE,
      hostToken: 'short-lived-host-token-abcdefghijklmnopqrstuvwxyz',
      hostTokenExpiresAt: '2026-09-15T08:15:00.000Z',
      role: 'ORIGINAL_HOST',
    });
    activateMock.mockResolvedValue({
      code: CODE,
      hostToken: 'activated-host-token-abcdefghijklmnopqrstuvwxyz',
      hostTokenExpiresAt: '2026-09-15T08:15:00.000Z',
      role: 'ORIGINAL_HOST',
    });
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => {
    clearHostToken(CODE);
    TestBed.resetTestingModule();
  });

  it('stellt nach Browserneustart aus der persistenten Capability einen kurzlebigen Token aus', async () => {
    persistInitialHostRecovery({ code: CODE, browserCapability: BROWSER_CAPABILITY });
    const result = await TestBed.runInInjectionContext(() =>
      Promise.resolve(requireHostToken(route(), {} as never)),
    );
    expect(result).toBe(true);
    expect(issueMock).toHaveBeenCalledWith({ code: CODE, browserCapability: BROWSER_CAPABILITY });
    expect(getHostToken(CODE)).toBe('short-lived-host-token-abcdefghijklmnopqrstuvwxyz');
    expect(participantsMock).toHaveBeenCalledWith({ code: CODE });
  });

  it('verleiht ohne gültige Capability keine Hostrechte und leitet zum Recovery-Formular', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      Promise.resolve(requireHostToken(route(), {} as never)),
    );
    const router = TestBed.inject(Router);
    expect(result).not.toBe(true);
    expect(router.serializeUrl(result as never)).toContain('/host-recovery');
    expect(participantsMock).not.toHaveBeenCalled();
  });

  it('migriert einen gültigen Legacy-Host idempotent auf Browser-Capability und Zugangskarte', async () => {
    setHostToken(CODE, 'legacy-host-token-abcdefghijklmnopqrstuvwxyz');
    bootstrapMock.mockResolvedValue({
      code: CODE,
      browserCapability: BROWSER_CAPABILITY,
      recoveryCard: { supportId: 'ARS-ABCD-2345', recoveryCode: RECOVERY_CODE },
      pendingExpiresAt: '2026-09-15T08:15:00.000Z',
    });

    const result = await TestBed.runInInjectionContext(() =>
      Promise.resolve(requireHostToken(route(), {} as never)),
    );

    expect(result).toBe(true);
    expect(bootstrapMock).toHaveBeenCalledWith({
      code: CODE,
      recoveryExchangeId: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
    });
    expect(getHostBrowserCapability(CODE)).toBe(BROWSER_CAPABILITY);
    expect(getStagedHostRecoveryCard(CODE)).toEqual({
      supportId: 'ARS-ABCD-2345',
      recoveryCode: RECOVERY_CODE,
    });
    expect(getHostToken(CODE)).toBe('activated-host-token-abcdefghijklmnopqrstuvwxyz');
  });

  it('aktiviert einen nur vorbereiteten Kandidaten nicht automatisch', async () => {
    persistPreparedHostRecovery({
      supportId: 'ARS-ABCD-2345',
      sourceKind: 'RECOVERY',
      exchangeId: 'exchange-id-abcdefghijklmnopqrstuvwxyz0123456789ab',
      prepared: {
        code: CODE,
        browserCapability: BROWSER_CAPABILITY,
        recoveryCard: { supportId: 'ARS-ABCD-2345', recoveryCode: RECOVERY_CODE },
        pendingExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    issueMock.mockRejectedValue(new Error('UNAUTHORIZED: intern'));

    const result = await TestBed.runInInjectionContext(() =>
      Promise.resolve(requireHostToken(route(), {} as never)),
    );
    const router = TestBed.inject(Router);

    expect(result).not.toBe(true);
    expect(router.serializeUrl(result as never)).toContain('/host-recovery');
    expect(activateMock).not.toHaveBeenCalled();
  });

  it('stellt nach Tabverlust aus der gespeicherten Capability einen Token aus', async () => {
    persistPreparedHostRecovery({
      supportId: 'ARS-ABCD-2345',
      sourceKind: 'RECOVERY',
      exchangeId: 'exchange-id-abcdefghijklmnopqrstuvwxyz0123456789ab',
      prepared: {
        code: CODE,
        browserCapability: BROWSER_CAPABILITY,
        recoveryCard: { supportId: 'ARS-ABCD-2345', recoveryCode: RECOVERY_CODE },
        pendingExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    sessionStorage.clear();

    const result = await TestBed.runInInjectionContext(() =>
      Promise.resolve(requireHostToken(route(), {} as never)),
    );

    expect(result).toBe(true);
    expect(issueMock).toHaveBeenCalledWith({ code: CODE, browserCapability: BROWSER_CAPABILITY });
    expect(activateMock).not.toHaveBeenCalled();
    expect(getHostBrowserCapability(CODE)).toBe(BROWSER_CAPABILITY);
    expect(getHostToken(CODE)).toBe('short-lived-host-token-abcdefghijklmnopqrstuvwxyz');
  });
});
