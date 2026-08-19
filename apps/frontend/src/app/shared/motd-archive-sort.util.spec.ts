import { describe, expect, it } from 'vitest';
import type { MotdArchiveItemDTO } from '@arsnova/shared-types';
import {
  isMotdArchiveItemNewerThanCursor,
  isMotdArchiveItemUnread,
  newestMotdArchiveReadCursor,
  sortMotdArchiveItemsNewFirst,
} from './motd-archive-sort.util';

const permanentWelcome: MotdArchiveItemDTO = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  contentVersion: 1,
  markdown: 'Willkommen',
  startsAt: '2025-01-01T00:00:00.000Z',
  endsAt: '2099-12-31T23:59:59.999Z',
};

const newerVision: MotdArchiveItemDTO = {
  id: '11111111-1111-4111-8111-111111111111',
  contentVersion: 1,
  markdown: 'Vision',
  startsAt: '2026-08-13T00:00:00.000Z',
  endsAt: '2027-03-31T23:59:59.999Z',
};

describe('MOTD-Archivsortierung und Lesecursor', () => {
  it('ordnet nach Publikation statt nach Ende', () => {
    expect(sortMotdArchiveItemsNewFirst([permanentWelcome, newerVision])).toEqual([
      newerVision,
      permanentWelcome,
    ]);
  });

  it('erkennt eine spätere Publikation trotz früherem Ende als ungelesen', () => {
    const seenWelcome = newestMotdArchiveReadCursor([permanentWelcome]);
    expect(seenWelcome).not.toBeNull();
    expect(isMotdArchiveItemNewerThanCursor(newerVision, seenWelcome!)).toBe(true);
  });

  it('nimmt den neuesten Publikationscursor einer Seite', () => {
    expect(newestMotdArchiveReadCursor([permanentWelcome, newerVision])).toEqual({
      startsAtIso: newerVision.startsAt,
      motdId: newerVision.id,
      contentVersion: newerVision.contentVersion,
    });
  });

  it('zählt einzeln gelesene neuere MOTDs nicht als ungelesen', () => {
    const seenWelcome = newestMotdArchiveReadCursor([permanentWelcome]);
    expect(isMotdArchiveItemUnread(newerVision, seenWelcome, [])).toBe(true);
    expect(
      isMotdArchiveItemUnread(newerVision, seenWelcome, [
        { motdId: newerVision.id, contentVersion: 1 },
      ]),
    ).toBe(false);
    expect(isMotdArchiveItemUnread(permanentWelcome, seenWelcome, [])).toBe(false);
  });
});
