import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { hostAuthMocks, recoveryMocks } = vi.hoisted(() => ({
  hostAuthMocks: {
    extractHostToken: vi.fn(),
    extractHostTokenFromConnectionParams: vi.fn(() => null as string | null),
    isHostSessionTokenValid: vi.fn(),
    isOriginalHostSessionToken: vi.fn(),
  },
  recoveryMocks: {
    activateHostCredential: vi.fn(),
    createInitialHostCredentialMaterial: vi.fn(),
    issueHostTokenFromBrowserCapability: vi.fn(),
    prepareHostCredentialExchange: vi.fn(),
    prepareLegacyHostCredentialBootstrap: vi.fn(),
  },
}));

vi.mock('../db', () => ({ prisma: {} }));
vi.mock('../lib/hostCredentialRecovery', () => recoveryMocks);
vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return {
    ...buildHostAuthTestMock(hostAuthMocks),
    createCredentialBoundHostToken: vi.fn(),
  };
});

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });
const CAPABILITY = 'browser_capability_1234567890';
const NEXT_CAPABILITY = 'next_browser_capability_123456';
const RECOVERY_CODE = 'recovery_code_123456789012';
const EXCHANGE_ID = 'exchange_id_1234567890123';
const HOST_TOKEN = 'host_token_123456789012345';
const SUPPORT_ID = 'ARS-ABCD-2345';
const EXPIRES_AT = '2026-09-15T15:00:00.000Z';
const PENDING_EXPIRES_AT = '2026-09-15T14:45:00.000Z';

const accessToken = {
  code: 'ABC123',
  hostToken: HOST_TOKEN,
  hostTokenExpiresAt: EXPIRES_AT,
  role: 'ORIGINAL_HOST' as const,
};

const exchange = {
  code: 'ABC123',
  browserCapability: NEXT_CAPABILITY,
  recoveryCard: {
    supportId: SUPPORT_ID,
    recoveryCode: RECOVERY_CODE,
  },
  pendingExpiresAt: PENDING_EXPIRES_AT,
};

describe('Session-Host-Credential-Routerverträge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostToken.mockReturnValue(HOST_TOKEN);
    hostAuthMocks.extractHostTokenFromConnectionParams.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValid.mockResolvedValue(true);
    hostAuthMocks.isOriginalHostSessionToken.mockResolvedValue(true);
  });

  trpcDodIt(
    {
      procedure: 'session.issueHostAccessToken',
      case: 'happy',
      mode: 'direct',
      title: 'tauscht eine gültige Browser-Capability gegen ein kurzlebiges Host-Token',
    },
    async () => {
      recoveryMocks.issueHostTokenFromBrowserCapability.mockResolvedValue(accessToken);

      await expect(
        caller.issueHostAccessToken({
          code: 'abc123',
          browserCapability: CAPABILITY,
        }),
      ).resolves.toEqual(accessToken);
      expect(recoveryMocks.issueHostTokenFromBrowserCapability).toHaveBeenCalledWith({
        code: 'abc123',
        browserCapability: CAPABILITY,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.prepareHostCredentialBootstrap',
      case: 'error',
      mode: 'direct',
      contract: 'FORBIDDEN',
      title: 'verwehrt einem gültigen gekoppelten Host den Legacy-Bootstrap',
    },
    async () => {
      hostAuthMocks.isOriginalHostSessionToken.mockResolvedValue(false);

      await expect(
        caller.prepareHostCredentialBootstrap({
          code: 'ABC123',
          recoveryExchangeId: EXCHANGE_ID,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(recoveryMocks.prepareLegacyHostCredentialBootstrap).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.issueHostAccessToken',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'weist eine ungültige Browser-Capability mit dem öffentlichen Einheitsfehler zurück',
    },
    async () => {
      recoveryMocks.issueHostTokenFromBrowserCapability.mockRejectedValue(
        new TRPCError({ code: 'UNAUTHORIZED' }),
      );

      await expect(
        caller.issueHostAccessToken({
          code: 'ABC123',
          browserCapability: CAPABILITY,
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.prepareHostCredentialExchange',
      case: 'happy',
      mode: 'direct',
      title: 'bereitet einen idempotenten Recovery-Austausch über den Shared-Zod-Vertrag vor',
    },
    async () => {
      recoveryMocks.prepareHostCredentialExchange.mockResolvedValue(exchange);

      await expect(
        caller.prepareHostCredentialExchange({
          supportId: SUPPORT_ID,
          recoveryExchangeId: EXCHANGE_ID,
          source: { kind: 'RECOVERY', recoveryCode: RECOVERY_CODE },
        }),
      ).resolves.toEqual(exchange);
      expect(recoveryMocks.prepareHostCredentialExchange).toHaveBeenCalledWith({
        supportId: SUPPORT_ID,
        recoveryExchangeId: EXCHANGE_ID,
        source: { kind: 'RECOVERY', recoveryCode: RECOVERY_CODE },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.prepareHostCredentialExchange',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'vereinheitlicht abgewiesene Recovery-Austauschversuche',
    },
    async () => {
      recoveryMocks.prepareHostCredentialExchange.mockRejectedValue(
        new TRPCError({ code: 'UNAUTHORIZED' }),
      );

      await expect(
        caller.prepareHostCredentialExchange({
          supportId: SUPPORT_ID,
          recoveryExchangeId: EXCHANGE_ID,
          source: { kind: 'RECOVERY', recoveryCode: RECOVERY_CODE },
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.activateHostCredential',
      case: 'happy',
      mode: 'direct',
      title: 'aktiviert die vorbereitete Generation und stellt danach ein Host-Token aus',
    },
    async () => {
      recoveryMocks.activateHostCredential.mockResolvedValue({
        code: 'ABC123',
        generation: 2,
      });
      recoveryMocks.issueHostTokenFromBrowserCapability.mockResolvedValue(accessToken);

      await expect(
        caller.activateHostCredential({
          supportId: SUPPORT_ID,
          browserCapability: NEXT_CAPABILITY,
        }),
      ).resolves.toEqual(accessToken);
      expect(recoveryMocks.activateHostCredential).toHaveBeenCalledWith({
        supportId: SUPPORT_ID,
        browserCapability: NEXT_CAPABILITY,
      });
      expect(recoveryMocks.issueHostTokenFromBrowserCapability).toHaveBeenCalledWith({
        code: 'ABC123',
        browserCapability: NEXT_CAPABILITY,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.activateHostCredential',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'stellt nach fehlgeschlagener Credential-Aktivierung kein Host-Token aus',
    },
    async () => {
      recoveryMocks.activateHostCredential.mockRejectedValue(
        new TRPCError({ code: 'UNAUTHORIZED' }),
      );

      await expect(
        caller.activateHostCredential({
          supportId: SUPPORT_ID,
          browserCapability: NEXT_CAPABILITY,
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(recoveryMocks.issueHostTokenFromBrowserCapability).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.prepareHostCredentialBootstrap',
      case: 'happy',
      mode: 'direct',
      title: 'bindet den Legacy-Bootstrap an das validierte Host-Token aus dem Kontext',
    },
    async () => {
      recoveryMocks.prepareLegacyHostCredentialBootstrap.mockResolvedValue(exchange);

      await expect(
        caller.prepareHostCredentialBootstrap({
          code: 'abc123',
          recoveryExchangeId: EXCHANGE_ID,
        }),
      ).resolves.toEqual(exchange);
      expect(recoveryMocks.prepareLegacyHostCredentialBootstrap).toHaveBeenCalledWith({
        code: 'abc123',
        recoveryExchangeId: EXCHANGE_ID,
        hostToken: HOST_TOKEN,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.prepareHostCredentialBootstrap',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'weist den Legacy-Bootstrap ohne gültigen Host-Besitznachweis zurück',
    },
    async () => {
      hostAuthMocks.isHostSessionTokenValid.mockResolvedValue(false);

      await expect(
        caller.prepareHostCredentialBootstrap({
          code: 'ABC123',
          recoveryExchangeId: EXCHANGE_ID,
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(recoveryMocks.prepareLegacyHostCredentialBootstrap).not.toHaveBeenCalled();
    },
  );
});
