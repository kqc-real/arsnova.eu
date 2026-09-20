import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRecoveryExchangeId,
  clearStagedHostRecoveryCard,
  discardExpiredPreparedRecovery,
  findUnambiguousHostRecoveryResume,
  getHostBrowserCapability,
  getHostRecoveryCandidate,
  getOrCreateRecoveryExchangeId,
  getPendingHostCredentialActivation,
  getStagedHostRecoveryCard,
  abandonRejectedHostRecovery,
  markHostRecoveryActivated,
  markHostRecoveryActivationUnconfirmed,
  persistInitialHostRecovery,
  persistPreparedHostRecovery,
  forgetHostedSessionOnThisDevice,
  stagePendingHostCredentialActivation,
  storeHostBrowserCapability,
  storeHostRecoveryCandidate,
  hasStoredHostCapabilities,
  findPreferredHostBrowserCapabilityCode,
  getLastHostedSessionCode,
} from './host-recovery-access';

const SUPPORT_ID = 'ARS-ABCD-2345';
const CARD = {
  supportId: SUPPORT_ID,
  recoveryCode: 'recovery-capability-abcdefghijklmnopqrstuvwxyz',
};

describe('host-recovery-access', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persistiert Browser-Capability dauerhaft und die einmalige Karte nur tablokal', () => {
    persistInitialHostRecovery({
      code: 'abc123',
      browserCapability: 'browser-capability-abcdefghijklmnopqrstuvwxyz',
      recoveryCard: CARD,
    });
    expect(getHostBrowserCapability('ABC123')).toBe(
      'browser-capability-abcdefghijklmnopqrstuvwxyz',
    );
    expect(getStagedHostRecoveryCard('ABC123')).toEqual(CARD);
    clearStagedHostRecoveryCard('ABC123');
    expect(getStagedHostRecoveryCard('ABC123')).toBeNull();
  });

  it('verwendet dieselbe CSPRNG-Exchange-ID bis zum bestätigten Abschluss', () => {
    const first = getOrCreateRecoveryExchangeId(SUPPORT_ID);
    const retry = getOrCreateRecoveryExchangeId('ars-abcd-2345');
    expect(first).toBe(retry);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    clearRecoveryExchangeId(SUPPORT_ID);
    expect(getOrCreateRecoveryExchangeId(SUPPORT_ID)).not.toBe(first);
  });

  it('nimmt nur eine noch gültige vorbereitete Aktivierung wieder auf', () => {
    persistInitialHostRecovery({
      code: 'ABC123',
      browserCapability: 'browser-capability-abcdefghijklmnopqrstuvwxyz',
      recoveryCard: CARD,
    });
    stagePendingHostCredentialActivation(
      SUPPORT_ID,
      'ABC123',
      new Date(Date.now() + 60_000).toISOString(),
    );

    expect(getPendingHostCredentialActivation('ars-abcd-2345')).toEqual({
      code: 'ABC123',
      browserCapability: 'browser-capability-abcdefghijklmnopqrstuvwxyz',
      recoveryCard: CARD,
      pendingExpiresAt: expect.any(String),
    });

    stagePendingHostCredentialActivation(
      SUPPORT_ID,
      'ABC123',
      new Date(Date.now() - 1).toISOString(),
    );
    expect(getPendingHostCredentialActivation(SUPPORT_ID)).toBeNull();
  });

  it('überschreibt einen aktiven Browserzugang nicht durch einen vorbereiteten Kandidaten', () => {
    persistInitialHostRecovery({
      code: 'ABC123',
      browserCapability: 'active-browser-capability-abcdefghijklmnopqrstuvwxyz',
    });
    persistPreparedHostRecovery({
      supportId: SUPPORT_ID,
      sourceKind: 'RECOVERY',
      exchangeId: getOrCreateRecoveryExchangeId(SUPPORT_ID),
      prepared: {
        code: 'ABC123',
        browserCapability: 'pending-browser-capability-abcdefghijklmnopqrstuvwxyz',
        recoveryCard: CARD,
        pendingExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    expect(getHostBrowserCapability('ABC123')).toBe(
      'active-browser-capability-abcdefghijklmnopqrstuvwxyz',
    );
    expect(getHostRecoveryCandidate('ABC123')).toBe(
      'pending-browser-capability-abcdefghijklmnopqrstuvwxyz',
    );
  });

  it('findet die Wiederaufnahme nach leerem sessionStorage und abgelaufenem Pending-Fenster', () => {
    persistPreparedHostRecovery({
      supportId: SUPPORT_ID,
      sourceKind: 'RECOVERY',
      exchangeId: 'exchange-id-abcdefghijklmnopqrstuvwxyz0123456789ab',
      prepared: {
        code: 'ABC123',
        browserCapability: 'pending-browser-capability-abcdefghijklmnopqrstuvwxyz',
        recoveryCard: CARD,
        pendingExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60_000);

    expect(getPendingHostCredentialActivation(SUPPORT_ID)).toBeNull();
    expect(findUnambiguousHostRecoveryResume()?.code).toBe('ABC123');
    expect(getHostRecoveryCandidate('ABC123')).toBe(
      'pending-browser-capability-abcdefghijklmnopqrstuvwxyz',
    );
  });

  it('bereinigt nie aktiviertes Pending-Material nach Fristablauf', () => {
    persistPreparedHostRecovery({
      supportId: SUPPORT_ID,
      sourceKind: 'RECOVERY',
      exchangeId: 'exchange-id-abcdefghijklmnopqrstuvwxyz0123456789ab',
      prepared: {
        code: 'ABC123',
        browserCapability: 'pending-browser-capability-abcdefghijklmnopqrstuvwxyz',
        recoveryCard: CARD,
        pendingExpiresAt: new Date(Date.now() - 1).toISOString(),
      },
    });
    discardExpiredPreparedRecovery(SUPPORT_ID);
    expect(getHostRecoveryCandidate('ABC123')).toBeNull();
    expect(findUnambiguousHostRecoveryResume()).toBeNull();
  });

  it('nimmt abgeschlossene Wiederherstellungen nicht automatisch wieder auf', () => {
    persistPreparedHostRecovery({
      supportId: SUPPORT_ID,
      sourceKind: 'RECOVERY',
      exchangeId: 'exchange-id-abcdefghijklmnopqrstuvwxyz0123456789ab',
      prepared: {
        code: 'ABC123',
        browserCapability: 'pending-browser-capability-abcdefghijklmnopqrstuvwxyz',
        recoveryCard: CARD,
        pendingExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    markHostRecoveryActivated(SUPPORT_ID, 'pending-browser-capability-abcdefghijklmnopqrstuvwxyz');
    expect(findUnambiguousHostRecoveryResume()).toBeNull();
  });

  it('bestätigt den Kandidaten nicht über einen anderen aktiven Browserzugang', () => {
    storeHostBrowserCapability('ABC123', 'active-browser-capability-abcdefghijklmnopqrstuvwxyz');
    persistPreparedHostRecovery({
      supportId: SUPPORT_ID,
      sourceKind: 'RECOVERY',
      exchangeId: getOrCreateRecoveryExchangeId(SUPPORT_ID),
      prepared: {
        code: 'ABC123',
        browserCapability: 'pending-browser-capability-abcdefghijklmnopqrstuvwxyz',
        recoveryCard: CARD,
        pendingExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    markHostRecoveryActivated(SUPPORT_ID, 'active-browser-capability-abcdefghijklmnopqrstuvwxyz');
    expect(getHostRecoveryCandidate('ABC123')).toBe(
      'pending-browser-capability-abcdefghijklmnopqrstuvwxyz',
    );
    expect(getHostBrowserCapability('ABC123')).toBe(
      'active-browser-capability-abcdefghijklmnopqrstuvwxyz',
    );
    expect(findUnambiguousHostRecoveryResume()?.phase).toBe('prepared');
  });

  it('gibt einen fachlich abgelehnten unbestätigten Vorgang frei, ohne den Altzugang zu löschen', () => {
    storeHostBrowserCapability('ABC123', 'active-browser-capability-abcdefghijklmnopqrstuvwxyz');
    persistPreparedHostRecovery({
      supportId: SUPPORT_ID,
      sourceKind: 'RECOVERY',
      exchangeId: 'exchange-id-abcdefghijklmnopqrstuvwxyz0123456789ab',
      prepared: {
        code: 'ABC123',
        browserCapability: 'pending-browser-capability-abcdefghijklmnopqrstuvwxyz',
        recoveryCard: CARD,
        pendingExpiresAt: new Date(Date.now() - 1).toISOString(),
      },
    });
    markHostRecoveryActivationUnconfirmed(SUPPORT_ID);
    abandonRejectedHostRecovery(SUPPORT_ID);
    expect(getHostRecoveryCandidate('ABC123')).toBeNull();
    expect(findUnambiguousHostRecoveryResume()).toBeNull();
    expect(getHostBrowserCapability('ABC123')).toBe(
      'active-browser-capability-abcdefghijklmnopqrstuvwxyz',
    );
  });

  it('erkennt gespeicherte Host-Capabilities unabhängig vom Sessioncode', () => {
    expect(hasStoredHostCapabilities()).toBe(false);
    storeHostBrowserCapability('abc123', 'browser-capability-abcdefghijklmnopqrstuvwxyz');
    expect(hasStoredHostCapabilities()).toBe(true);
    localStorage.clear();
    expect(hasStoredHostCapabilities()).toBe(false);
    storeHostRecoveryCandidate('XYZ789', 'candidate-capability-abcdefghijklmnopqrstuvwxyz');
    expect(hasStoredHostCapabilities()).toBe(true);
  });

  it('liefert direkten Host-Zugang nur für aktivierte Browser-Capabilities', () => {
    expect(findPreferredHostBrowserCapabilityCode()).toBeNull();
    storeHostRecoveryCandidate('XYZ789', 'candidate-capability-abcdefghijklmnopqrstuvwxyz');
    expect(findPreferredHostBrowserCapabilityCode()).toBeNull();
    storeHostBrowserCapability('abc123', 'browser-capability-abcdefghijklmnopqrstuvwxyz');
    storeHostBrowserCapability('DEF456', 'other-browser-capability-abcdefghijklmnopqrstuvwxyz');
    expect(getLastHostedSessionCode()).toBe('DEF456');
    expect(findPreferredHostBrowserCapabilityCode(['abc123'])).toBe('DEF456');
    localStorage.removeItem('arsnova-last-hosted-session');
    expect(findPreferredHostBrowserCapabilityCode()).toBeNull();
    expect(findPreferredHostBrowserCapabilityCode(['def456'])).toBe('DEF456');
  });

  it('entfernt den lokalen Host-Schnellzugang inkl. last-hosted-Zeiger', () => {
    persistInitialHostRecovery({
      code: 'ABC123',
      browserCapability: 'browser-capability-abcdefghijklmnopqrstuvwxyz',
      recoveryCard: CARD,
    });
    expect(getLastHostedSessionCode()).toBe('ABC123');
    forgetHostedSessionOnThisDevice('abc123');
    expect(getHostBrowserCapability('ABC123')).toBeNull();
    expect(getLastHostedSessionCode()).toBeNull();
  });

  it('legt Geheimnisse weder in Location noch in URL-artigen Storage-Schlüsseln ab', () => {
    const secret = 'browser-capability-abcdefghijklmnopqrstuvwxyz';
    persistInitialHostRecovery({ code: 'ABC123', browserCapability: secret });
    expect(location.href).not.toContain(secret);
    expect(Object.keys(localStorage)).not.toContain(expect.stringContaining(secret));
  });
});
