import { describe, expect, it } from 'vitest';
import {
  classifyAdminHostResetError,
  createAdminHostResetDraft,
  isHostResetEvidenceCategory,
} from './admin-host-reset';

describe('admin-host-reset', () => {
  it('erzeugt getrennte Operations-IDs und setzt die Nachweiskategorie nicht voraus', () => {
    const first = createAdminHostResetDraft();
    const second = createAdminHostResetDraft();
    expect(first.evidenceCategory).toBe('');
    expect(first.operationId).not.toBe(second.operationId);
    expect(first.confirmNewReset).toBe(false);
  });

  it('unterscheidet unbestätigte Antworten von abgelehnten Resets', () => {
    expect(classifyAdminHostResetError(new Error('failed to fetch'))).toBe('unconfirmed');
    expect(
      classifyAdminHostResetError({
        message: 'PRECONDITION_FAILED: Ein Übergabecode existiert bereits.',
        data: { code: 'PRECONDITION_FAILED' },
      }),
    ).toBe('precondition');
    expect(
      classifyAdminHostResetError({
        message:
          'BAD_REQUEST: Der Host-Zugang kann nach Ende der Nachbereitung nicht zurückgesetzt werden.',
        data: { code: 'BAD_REQUEST' },
      }),
    ).toBe('rejected');
  });

  it('akzeptiert nur die zulässigen Nachweiswege', () => {
    expect(isHostResetEvidenceCategory('PREEXISTING_VERIFIED_SUPPORT_CASE')).toBe(true);
    expect(isHostResetEvidenceCategory('')).toBe(false);
    expect(isHostResetEvidenceCategory('OTHER')).toBe(false);
  });
});
