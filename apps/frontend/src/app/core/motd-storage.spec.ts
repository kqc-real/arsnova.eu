import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MOTD_LOCAL_STORAGE_KEY,
  MOTD_MOBILE_FIRST_HOME_SESSION_KEY,
  MOTD_MOBILE_HOME_SEEN_KEY,
  MOTD_OVERLAY_OFFERED_SESSION_KEY,
  MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY,
  clearMotdThumbInteractionKeys,
  consumeMotdOverlayReloadSuppress,
  getMotdArchiveSeenUpToCursor,
  hasMotdOverlayBeenOfferedThisSession,
  isMotdDismissedForVersion,
  markMotdArchiveItemRead,
  markMotdArchiveItemUnread,
  markMotdDismissed,
  markMotdInteractionRecorded,
  markMotdOverlayOfferedThisSession,
  markMotdOverlayReloadSuppress,
  hasMotdInteractionRecorded,
  motdDismissedPairsForApi,
  getMotdArchiveReadItems,
  motdGetHeaderStateClientInput,
  setMotdArchiveSeenUpToCursor,
  shouldSkipQueuedMotdAutoOverlay,
  shouldSuppressMotdOverlayOnMobileFirstHomeVisit,
} from './motd-storage';

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

describe('motd-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
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

  it('merkt einzelne Archiv-MOTDs als gelesen und sendet sie an getHeaderState', () => {
    const id = '00000000-0000-4000-8000-000000000005';
    expect(markMotdArchiveItemRead(id, 1)).toBe(true);
    expect(markMotdArchiveItemRead(id, 1)).toBe(false);
    expect(getMotdArchiveReadItems()).toEqual([{ motdId: id, contentVersion: 1 }]);
    expect(motdGetHeaderStateClientInput()).toEqual({
      archiveReadItems: [{ motdId: id, contentVersion: 1 }],
    });
  });

  it('markMotdArchiveItemUnread macht Einzel-Gelesen wieder ungelesen', () => {
    const id = '00000000-0000-4000-8000-000000000015';
    markMotdArchiveItemRead(id, 1);
    expect(
      markMotdArchiveItemUnread({
        id,
        contentVersion: 1,
        startsAt: '2026-05-01T00:00:00.000Z',
      }),
    ).toBe(true);
    expect(getMotdArchiveReadItems()).toEqual([]);
    expect(motdGetHeaderStateClientInput().archiveUnreadItems).toBeUndefined();
  });

  it('markMotdArchiveItemUnread setzt Override unter der Wasserlinie', () => {
    const id = '00000000-0000-4000-8000-000000000016';
    setMotdArchiveSeenUpToCursor({
      startsAtIso: '2026-06-01T00:00:00.000Z',
      motdId: id,
      contentVersion: 1,
    });
    expect(
      markMotdArchiveItemUnread({
        id,
        contentVersion: 1,
        startsAt: '2026-05-01T00:00:00.000Z',
      }),
    ).toBe(true);
    expect(motdGetHeaderStateClientInput()).toEqual({
      archiveSeenUpToCursor: {
        startsAtIso: '2026-06-01T00:00:00.000Z',
        motdId: id,
        contentVersion: 1,
      },
      archiveUnreadItems: [{ motdId: id, contentVersion: 1 }],
    });
  });

  it('löscht einzeln gelesene Archiv-MOTDs beim Setzen der Wasserlinie', () => {
    const id = '00000000-0000-4000-8000-000000000006';
    markMotdArchiveItemRead(id, 1);
    setMotdArchiveSeenUpToCursor({
      startsAtIso: '2026-05-01T00:00:00.000Z',
      motdId: id,
      contentVersion: 1,
    });
    expect(getMotdArchiveReadItems()).toEqual([]);
    expect(motdGetHeaderStateClientInput().archiveReadItems).toBeUndefined();
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

  it('merkt ein Overlay-Angebot nur für die aktuelle Browsersitzung', () => {
    expect(hasMotdOverlayBeenOfferedThisSession()).toBe(false);
    markMotdOverlayOfferedThisSession();
    expect(sessionStorage.getItem(MOTD_OVERLAY_OFFERED_SESSION_KEY)).toBe('1');
    expect(hasMotdOverlayBeenOfferedThisSession()).toBe(true);
  });

  it('unterdrückt die nächste andere MOTD nach einem Dismiss, nicht aber eine neue Version derselben ID', () => {
    const firstId = '00000000-0000-4000-8000-000000000001';
    const nextId = '00000000-0000-4000-8000-000000000002';
    expect(shouldSkipQueuedMotdAutoOverlay(firstId)).toBe(false);
    markMotdDismissed(firstId, 1);
    expect(shouldSkipQueuedMotdAutoOverlay(nextId)).toBe(true);
    expect(shouldSkipQueuedMotdAutoOverlay(firstId)).toBe(false);
  });

  it('unterdrückt MOTD-Overlay einmalig nach Locale-Reload', () => {
    expect(consumeMotdOverlayReloadSuppress()).toBe(false);
    markMotdOverlayReloadSuppress();
    expect(sessionStorage.getItem(MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY)).toBe('1');
    expect(consumeMotdOverlayReloadSuppress()).toBe(true);
    expect(consumeMotdOverlayReloadSuppress()).toBe(false);
    expect(sessionStorage.getItem(MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY)).toBeNull();
  });

  it('unterdrückt MOTD auf dem Desktop nicht und schreibt keine Handy-Marker', () => {
    stubMatchMedia(false);
    expect(shouldSuppressMotdOverlayOnMobileFirstHomeVisit()).toBe(false);
    expect(localStorage.getItem(MOTD_MOBILE_HOME_SEEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(MOTD_MOBILE_FIRST_HOME_SESSION_KEY)).toBeNull();
  });

  it('unterdrückt MOTD beim ersten Handy-Besuch und bei Reloads derselben Sitzung', () => {
    stubMatchMedia(true);
    expect(shouldSuppressMotdOverlayOnMobileFirstHomeVisit()).toBe(true);
    expect(localStorage.getItem(MOTD_MOBILE_HOME_SEEN_KEY)).toBe('1');
    expect(sessionStorage.getItem(MOTD_MOBILE_FIRST_HOME_SESSION_KEY)).toBe('1');
    expect(shouldSuppressMotdOverlayOnMobileFirstHomeVisit()).toBe(true);
  });

  it('lässt MOTD auf dem Handy ab dem nächsten Besuch zu', () => {
    stubMatchMedia(true);
    localStorage.setItem(MOTD_MOBILE_HOME_SEEN_KEY, '1');
    expect(shouldSuppressMotdOverlayOnMobileFirstHomeVisit()).toBe(false);
  });
});
