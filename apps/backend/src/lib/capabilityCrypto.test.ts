import { describe, expect, it } from 'vitest';
import { createHostSupportId } from './capabilityCrypto';

const SUPPORT_ID_PATTERN =
  /^ARS-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/u;

describe('createHostSupportId', () => {
  it('erzeugt eine unvoreingenommene Support-ID aus dem sichtbaren Alphabet', () => {
    const ids = new Set(Array.from({ length: 64 }, () => createHostSupportId()));
    expect(ids.size).toBe(64);
    for (const supportId of ids) {
      expect(supportId).toMatch(SUPPORT_ID_PATTERN);
    }
  });
});
