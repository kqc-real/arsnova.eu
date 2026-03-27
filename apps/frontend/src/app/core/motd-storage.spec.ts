import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MOTD_LOCAL_STORAGE_KEY,
  getMotdArchiveSeenUpToEndsAtIso,
  isMotdDismissedForVersion,
  markMotdDismissed,
  markMotdInteractionRecorded,
  hasMotdInteractionRecorded,
  setMotdArchiveSeenUpToEndsAtIso,
} from './motd-storage';

describe('motd-storage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('markMotdDismissed speichert mindestens die angegebene Version', () => {
    markMotdDismissed('00000000-0000-4000-8000-000000000001', 2);
    expect(isMotdDismissedForVersion('00000000-0000-4000-8000-000000000001', 2)).toBe(true);
    expect(isMotdDismissedForVersion('00000000-0000-4000-8000-000000000001', 1)).toBe(true);
    expect(isMotdDismissedForVersion('00000000-0000-4000-8000-000000000001', 3)).toBe(false);
  });

  it('Archiv-Wasserzeichen wird gelesen und geschrieben', () => {
    expect(getMotdArchiveSeenUpToEndsAtIso()).toBeUndefined();
    setMotdArchiveSeenUpToEndsAtIso('2026-05-01T00:00:00.000Z');
    expect(getMotdArchiveSeenUpToEndsAtIso()).toBe('2026-05-01T00:00:00.000Z');
    expect(localStorage.getItem(MOTD_LOCAL_STORAGE_KEY)).toContain('archiveSeenUpToEndsAtIso');
  });

  it('Interaktionen werden pro MOTD+Version+Kind getrennt', () => {
    const id = '00000000-0000-4000-8000-000000000002';
    markMotdInteractionRecorded(id, 1, 'THUMB_UP');
    expect(hasMotdInteractionRecorded(id, 1, 'THUMB_UP')).toBe(true);
    expect(hasMotdInteractionRecorded(id, 1, 'THUMB_DOWN')).toBe(false);
    expect(hasMotdInteractionRecorded(id, 2, 'THUMB_UP')).toBe(false);
    expect(localStorage.getItem(MOTD_LOCAL_STORAGE_KEY)).toContain('interactions');
  });
});
