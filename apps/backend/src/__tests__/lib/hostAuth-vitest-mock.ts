import { TRPCError } from '@trpc/server';
import { vi, type Mock } from 'vitest';

/**
 * Vitest-Mock für `../lib/hostAuth`: überschreibt nur Token-Reads/Validierung,
 * damit `extractHostTokenFromContext` / `assertHostSessionAccessFromContext` konsistent bleiben
 * (reine `importOriginal`-Spies funktionieren nicht für interne Modulaufrufe).
 */
export function buildHostAuthTestMock(mocks: {
  extractHostToken: Mock;
  extractHostTokenFromConnectionParams: Mock;
  isHostSessionTokenValid: Mock;
  isOriginalHostSessionToken?: Mock;
}) {
  const extractHostTokenFromContext = (ctx: {
    req?: unknown;
    connectionParams?: unknown;
  }): string | null =>
    mocks.extractHostToken(ctx.req) ??
    mocks.extractHostTokenFromConnectionParams(ctx.connectionParams);

  const assertHostSessionAccessFromContext = async (
    ctx: { req?: unknown; connectionParams?: unknown },
    sessionCode: string,
  ): Promise<string> => {
    const token = extractHostTokenFromContext(ctx);
    if (!token) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Host-Authentifizierung erforderlich.',
      });
    }
    const valid = await mocks.isHostSessionTokenValid(sessionCode, token);
    if (!valid) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Host-Session ungültig oder abgelaufen.',
      });
    }
    return token;
  };

  const assertHostSessionAccess = async (
    req: unknown,
    sessionCode: string,
    connectionParams?: unknown,
  ): Promise<string> => assertHostSessionAccessFromContext({ req, connectionParams }, sessionCode);

  const isOriginalHostSessionToken =
    mocks.isOriginalHostSessionToken ?? mocks.isHostSessionTokenValid;

  const resolveHostSessionAccess = async (sessionCode: string, token: string) => {
    const valid = await mocks.isHostSessionTokenValid(sessionCode, token);
    if (!valid) return null;
    const original = await isOriginalHostSessionToken(sessionCode, token);
    return {
      token,
      role: original ? ('ORIGINAL_HOST' as const) : ('PAIRED_HOST' as const),
    };
  };

  return {
    extractHostToken: mocks.extractHostToken,
    extractHostTokenFromConnectionParams: mocks.extractHostTokenFromConnectionParams,
    extractHostTokenFromContext,
    isHostSessionTokenValid: mocks.isHostSessionTokenValid,
    isOriginalHostSessionToken,
    resolveHostSessionAccess,
    hashHostSessionToken: (token: string) => token,
    assertHostSessionAccessFromContext,
    assertHostSessionAccess,
    createHostSessionToken: vi.fn(),
    invalidateHostSessionToken: vi.fn(),
  };
}
