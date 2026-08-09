import { LOCALE_ID, PLATFORM_ID, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newsArchivePageResolver, newsArchiveTransferStateKey } from './news-archive-page.resolver';

const listArchiveQuery = vi.fn();
const getHeaderStateQuery = vi.fn();

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    motd: {
      listArchive: { query: (...args: unknown[]) => listArchiveQuery(...args) },
      getHeaderState: { query: (...args: unknown[]) => getHeaderStateQuery(...args) },
    },
  },
}));

const sanitizer = {
  bypassSecurityTrustHtml: (html: string) => html,
};

async function runResolver() {
  return Promise.resolve(
    TestBed.runInInjectionContext(() => newsArchivePageResolver({} as never, {} as never)),
  );
}

describe('newsArchivePageResolver hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    listArchiveQuery.mockReset();
    getHeaderStateQuery.mockReset();
  });

  it('übernimmt im Browser exakt den prerendered TransferState ohne vorzeitigen Live-Request', async () => {
    const transferState = new TransferState();
    const key = newsArchiveTransferStateKey('de');
    transferState.set(key, {
      items: [
        {
          id: 'c0333333-c333-4c33-8c33-c03333333333',
          contentVersion: 1,
          markdown: '### Barrierefreiheit, die allen hilft\n\nText',
          startsAt: '2026-07-22T00:00:00.000Z',
          endsAt: '2027-03-31T23:59:59.999Z',
        },
      ],
      nextCursor: null,
      archiveMaxEndsAtIso: '2027-03-31T23:59:59.999Z',
      archiveUnreadCount: 1,
      errorMessage: null,
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: LOCALE_ID, useValue: 'de' },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: TransferState, useValue: transferState },
        { provide: DomSanitizer, useValue: sanitizer },
      ],
    });

    const result = await runResolver();

    expect(result.items.map((item) => item.id)).toEqual(['c0333333-c333-4c33-8c33-c03333333333']);
    expect(result.titleById['c0333333-c333-4c33-8c33-c03333333333']).toBe(
      'Barrierefreiheit, die allen hilft',
    );
    expect(listArchiveQuery).not.toHaveBeenCalled();
    expect(getHeaderStateQuery).not.toHaveBeenCalled();
    expect(transferState.hasKey(key)).toBe(false);
  });

  it('legt auf dem Server nur das serialisierbare Resolver-Modell im TransferState ab', async () => {
    const transferState = new TransferState();
    const key = newsArchiveTransferStateKey('de');
    listArchiveQuery.mockResolvedValue({
      items: [
        {
          id: 'c0444444-c444-4c44-8c44-c04444444444',
          contentVersion: 1,
          markdown: '### 🧩 Neu: Zuordnen. Sortieren. Kategorisieren.\n\nText',
          startsAt: '2026-08-09T00:00:00.000Z',
          endsAt: '2027-03-31T23:59:59.999Z',
        },
      ],
      nextCursor: null,
    });
    getHeaderStateQuery.mockResolvedValue({
      hasActiveOverlay: true,
      hasArchiveEntries: true,
      archiveMaxEndsAtIso: '2027-03-31T23:59:59.999Z',
      archiveUnreadCount: 1,
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: LOCALE_ID, useValue: 'de' },
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: TransferState, useValue: transferState },
        { provide: DomSanitizer, useValue: sanitizer },
      ],
    });

    const result = await runResolver();
    const transferred = transferState.get(key, null as never);

    expect(result.titleById['c0444444-c444-4c44-8c44-c04444444444']).toBe(
      '🧩 Neu: Zuordnen. Sortieren. Kategorisieren.',
    );
    expect(transferred.items).toEqual(result.items);
    expect(transferred).not.toHaveProperty('titleById');
    expect(transferred).not.toHaveProperty('htmlById');
  });
});
