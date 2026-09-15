import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRecoveryExchangeId,
  clearStagedHostRecoveryCard,
  getHostBrowserCapability,
  getOrCreateRecoveryExchangeId,
  getStagedHostRecoveryCard,
  persistInitialHostRecovery,
} from './host-recovery-access';

describe('host-recovery-access', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persistiert Browser-Capability dauerhaft und die einmalige Karte nur tablokal', () => {
    persistInitialHostRecovery({
      code: 'abc123',
      browserCapability: 'browser-capability-abcdefghijklmnopqrstuvwxyz',
      recoveryCard: {
        supportId: 'ARS-ABCD-2345',
        recoveryCode: 'recovery-capability-abcdefghijklmnopqrstuvwxyz',
      },
    });
    expect(getHostBrowserCapability('ABC123')).toBe(
      'browser-capability-abcdefghijklmnopqrstuvwxyz',
    );
    expect(getStagedHostRecoveryCard('ABC123')).toEqual({
      supportId: 'ARS-ABCD-2345',
      recoveryCode: 'recovery-capability-abcdefghijklmnopqrstuvwxyz',
    });
    clearStagedHostRecoveryCard('ABC123');
    expect(getStagedHostRecoveryCard('ABC123')).toBeNull();
  });

  it('verwendet dieselbe CSPRNG-Exchange-ID bis zum bestätigten Abschluss', () => {
    const first = getOrCreateRecoveryExchangeId('ARS-ABCD-2345');
    const retry = getOrCreateRecoveryExchangeId('ars-abcd-2345');
    expect(first).toBe(retry);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    clearRecoveryExchangeId('ARS-ABCD-2345');
    expect(getOrCreateRecoveryExchangeId('ARS-ABCD-2345')).not.toBe(first);
  });

  it('legt Geheimnisse weder in Location noch in URL-artigen Storage-Schlüsseln ab', () => {
    const secret = 'browser-capability-abcdefghijklmnopqrstuvwxyz';
    persistInitialHostRecovery({ code: 'ABC123', browserCapability: secret });
    expect(location.href).not.toContain(secret);
    expect(Object.keys(localStorage)).not.toContain(expect.stringContaining(secret));
  });
});
