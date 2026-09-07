import { describe, expect, it } from 'vitest';
import { isHostAccessRevokedError, isOriginalHostForbiddenError } from './host-access-error';

describe('host-access-error', () => {
  it('erkennt Widerruf und abgelaufene Host-Token', () => {
    expect(
      isHostAccessRevokedError({
        data: { code: 'UNAUTHORIZED' },
        message: 'Die Host-Verbindung wurde beendet.',
      }),
    ).toBe(true);
    expect(
      isHostAccessRevokedError({
        message: 'Host-Session ungültig oder abgelaufen.',
      }),
    ).toBe(true);
    expect(isHostAccessRevokedError({ message: 'Session nicht gefunden.' })).toBe(false);
    expect(
      isHostAccessRevokedError({
        data: { code: 'UNAUTHORIZED' },
        message: 'Host-Authentifizierung erforderlich.',
      }),
    ).toBe(false);
  });

  it('erkennt Pairing-Administration nur für den Original-Host', () => {
    expect(
      isOriginalHostForbiddenError({
        data: { code: 'FORBIDDEN' },
        message: 'Nur die ursprüngliche Lehrperson kann weitere Geräte verbinden.',
      }),
    ).toBe(true);
    expect(isOriginalHostForbiddenError({ message: 'Session nicht gefunden.' })).toBe(false);
  });
});
