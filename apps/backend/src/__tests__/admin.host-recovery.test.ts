import { beforeEach, describe, expect, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const {
  extractAdminTokenMock,
  invalidateHostPairingForSessionMock,
  invalidateHostSessionTokenMock,
  isAdminSessionTokenValidMock,
  resetSessionHostAccessMock,
} = vi.hoisted(() => ({
  extractAdminTokenMock: vi.fn(),
  invalidateHostPairingForSessionMock: vi.fn(),
  invalidateHostSessionTokenMock: vi.fn(),
  isAdminSessionTokenValidMock: vi.fn(),
  resetSessionHostAccessMock: vi.fn(),
}));

vi.mock('../db', () => ({ prisma: {} }));
vi.mock('../lib/adminAuth', () => ({
  createAdminSessionToken: vi.fn(),
  extractAdminToken: extractAdminTokenMock,
  invalidateAdminSessionToken: vi.fn(),
  isAdminSessionTokenValid: isAdminSessionTokenValidMock,
  verifyAdminSecret: vi.fn(),
}));
vi.mock('../lib/hostAuth', () => ({
  invalidateHostSessionToken: invalidateHostSessionTokenMock,
}));
vi.mock('../lib/hostPairing', () => ({
  invalidateHostPairingForSession: invalidateHostPairingForSessionMock,
}));
vi.mock('../lib/hostCredentialRecovery', () => ({
  resetSessionHostAccess: resetSessionHostAccessMock,
}));
vi.mock('../routers/health', () => ({ fetchSecurityStats: vi.fn() }));

import { adminRouter } from '../routers/admin';

const caller = adminRouter.createCaller({ req: {} as never });
const resetInput = {
  code: 'ABC123',
  evidenceCategory: 'PREEXISTING_VERIFIED_SUPPORT_CASE' as const,
  requesterIdentityVerificationReference: 'Support-ID geprüft',
  sessionAuthorizationEvidenceReference: 'Sessionbezug extern bestätigt',
  supportCaseReference: 'CASE-405-001',
  reason: 'Host hat beide ursprünglichen Zugangsmittel nachweislich verloren.',
};
const resetOutput = {
  sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
  code: 'ABC123',
  supportId: 'ARS-ABCD-2345',
  handoffCapability: 'handoff_capability_123456789',
  expiresAt: '2026-09-15T14:45:00.000Z',
  revokedCredentialVersion: 2,
};

describe('Admin-Host-Recovery-Routervertrag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractAdminTokenMock.mockReturnValue('admin-token');
    isAdminSessionTokenValidMock.mockResolvedValue(true);
    invalidateHostSessionTokenMock.mockResolvedValue(undefined);
    invalidateHostPairingForSessionMock.mockResolvedValue(undefined);
  });

  trpcDodIt(
    {
      procedure: 'admin.resetSessionHostAccess',
      case: 'happy',
      mode: 'direct',
      title: 'setzt Host-Zugang auditiert zurück und entwertet laufende Host-Credentials',
    },
    async () => {
      resetSessionHostAccessMock.mockResolvedValue(resetOutput);

      await expect(caller.resetSessionHostAccess(resetInput)).resolves.toEqual(resetOutput);
      expect(resetSessionHostAccessMock).toHaveBeenCalledWith({
        input: resetInput,
        adminIdentifier: expect.any(String),
      });
      expect(invalidateHostSessionTokenMock).toHaveBeenCalledWith('ABC123');
      expect(invalidateHostPairingForSessionMock).toHaveBeenCalledWith('ABC123');
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.resetSessionHostAccess',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'weist einen Host-Zugangsreset ohne gültige Admin-Sitzung zurück',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);

      await expect(caller.resetSessionHostAccess(resetInput)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
      expect(resetSessionHostAccessMock).not.toHaveBeenCalled();
    },
  );
});
