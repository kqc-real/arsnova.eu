import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MOTD_LOCAL_STORAGE_KEY,
  MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY,
  clearMotdThumbInteractionKeys,
  consumeMotdOverlayReloadSuppress,
  getMotdArchiveSeenUpToCursor,
  isMotdDismissedForVersion,
  markMotdDismissed,
  markMotdInteractionRecorded,
  markMotdOverlayReloadSuppress,
  hasMotdInteractionRecorded,
  motdDismissedPairsForApi,
  setMotdArchiveSeenUpToCursor,
} from './motd-storage';

describe('motd-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('markMotdDismissed speichert mindestens die angegebene Version', () => {
    markMotdDismissed('00000000-0000-4000-8000-000000000001', 2);
    expect(isMotdDismissedForVersion('00000000-0000-4000-8000-000000000001', 2)).toBe(true);
    expect(isMotdDismissedForVersion('00000000-0000-4000-8000-000000000001', 1)).toBe(true);
    expect(isMotdDismissedForVersion('00000000-0000-4000-8000-000000000001', 3)).toBe(false);
  });

  it('motdDismissedPairsForApi liefert Paare aus dismissed', () => {
    expect(motdDismissedPairsForApi()).toEqual([]);
    markMotdDismissed('00000000-0000-4000-8000-000000000099', 5);
    expect(motdDismissedPairsForApi()).toEqual([
      { motdId: '00000000-0000-4000-8000-000000000099', contentVersion: 5 },
    ]);
  });

  it('Archiv-Lesecursor wird gelesen und geschrieben', () => {
    const cursor = {
      startsAtIso: '2026-05-01T00:00:00.000Z',
      motdId: '00000000-0000-4000-8000-000000000004',
      contentVersion: 2,
    };
    expect(getMotdArchiveSeenUpToCursor()).toBeUndefined();
    setMotdArchiveSeenUpToCursor(cursor);
    expect(getMotdArchiveSeenUpToCursor()).toEqual(cursor);
    expect(localStorage.getItem(MOTD_LOCAL_STORAGE_KEY)).toContain('archiveSeenUpToCursor');
  });

  it('ignoriert das alte endsAt-Wasserzeichen, damit neue Publikationen wieder auffallen', () => {
    localStorage.setItem(
      MOTD_LOCAL_STORAGE_KEY,
      JSON.stringify({
        dismissed: {},
        interactions: {},
        archiveSeenUpToEndsAtIso: '2099-12-31T23:59:59.999Z',
      }),
    );
    expect(getMotdArchiveSeenUpToCursor()).toBeUndefined();
  });

  it('ignoriert einen beschädigten Archiv-Lesecursor', () => {
    localStorage.setItem(
      MOTD_LOCAL_STORAGE_KEY,
      JSON.stringify({
        dismissed: {},
        interactions: {},
        archiveSeenUpToCursor: {
          startsAtIso: 'kein Datum',
          motdId: 'keine UUID',
          contentVersion: 0,
        },
      }),
    );
    expect(getMotdArchiveSeenUpToCursor()).toBeUndefined();
  });

  it('Interaktionen werden pro MOTD+Version+Kind getrennt', () => {
    const id = '00000000-0000-4000-8000-000000000002';
    markMotdInteractionRecorded(id, 1, 'THUMB_UP');
    expect(hasMotdInteractionRecorded(id, 1, 'THUMB_UP')).toBe(true);
    expect(hasMotdInteractionRecorded(id, 1, 'THUMB_DOWN')).toBe(false);
    expect(hasMotdInteractionRecorded(id, 2, 'THUMB_UP')).toBe(false);
    expect(localStorage.getItem(MOTD_LOCAL_STORAGE_KEY)).toContain('interactions');
  });

  it('clearMotdThumbInteractionKeys entfernt Daumen-hoch und -runter', () => {
    const id = '00000000-0000-4000-8000-000000000003';
    markMotdInteractionRecorded(id, 2, 'THUMB_UP');
    clearMotdThumbInteractionKeys(id, 2);
    expect(hasMotdInteractionRecorded(id, 2, 'THUMB_UP')).toBe(false);
    expect(hasMotdInteractionRecorded(id, 2, 'THUMB_DOWN')).toBe(false);
  });

  it('unterdrückt MOTD-Overlay einmalig nach Locale-Reload', () => {
    expect(consumeMotdOverlayReloadSuppress()).toBe(false);
    markMotdOverlayReloadSuppress();
    expect(sessionStorage.getItem(MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY)).toBe('1');
    expect(consumeMotdOverlayReloadSuppress()).toBe(true);
    expect(consumeMotdOverlayReloadSuppress()).toBe(false);
    expect(sessionStorage.getItem(MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY)).toBeNull();
  });
});
