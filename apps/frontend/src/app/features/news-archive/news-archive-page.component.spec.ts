import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Location } from '@angular/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsArchivePageComponent } from './news-archive-page.component';
import { MotdHeaderRefreshService } from '../../core/motd-header-refresh.service';
import { MotdHeaderStateService } from '../../core/motd-header-state.service';
import { MOTD_LOCAL_STORAGE_KEY } from '../../core/motd-storage';
import type { NewsArchiveInitialModel } from './news-archive-initial';

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

const emptyResolved: NewsArchiveInitialModel = {
  items: [],
  nextCursor: null,
  archiveMaxCursor: null,
  archiveUnreadCount: 0,
  errorMessage: null,
  titleById: {},
  htmlById: {},
};

describe('NewsArchivePageComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    listArchiveQuery.mockReset();
    getHeaderStateQuery.mockReset();
    listArchiveQuery.mockResolvedValue({ items: [], nextCursor: null });
    getHeaderStateQuery.mockResolvedValue({
      hasActiveOverlay: false,
      hasArchiveEntries: false,
      archiveMaxCursor: null,
      archiveMaxEndsAtIso: null,
      archiveUnreadCount: 0,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('zeigt Resolver-Daten und lädt nach Hydration die erste Seite live nach', async () => {
    TestBed.configureTestingModule({
      imports: [NewsArchivePageComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { openDialogs: [] } },
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { newsArchive: emptyResolved } } },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
        {
          provide: MotdHeaderStateService,
          useValue: { decrementArchiveUnreadCount: vi.fn(), setArchiveUnreadCount: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<NewsArchivePageComponent> =
      TestBed.createComponent(NewsArchivePageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.getAttribute('ngSkipHydration')).toBe('true');
    expect(fixture.componentInstance.items().length).toBe(0);

    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();

    expect(listArchiveQuery).toHaveBeenCalled();
    expect(getHeaderStateQuery).toHaveBeenCalled();
  });

  it('ersetzt prerenderte Einträge durch neuere Live-Daten', async () => {
    const stale: NewsArchiveInitialModel = {
      ...emptyResolved,
      items: [
        {
          id: 'c0222222-c222-4c22-8c22-c02222222222',
          contentVersion: 6,
          markdown: '### Neu: Der Nachbesprechungsplan als PDF\n\nAlt',
          startsAt: '2026-07-17T00:00:00.000Z',
          endsAt: '2027-03-31T23:59:59.999Z',
        },
      ],
      titleById: {
        'c0222222-c222-4c22-8c22-c02222222222': 'Neu: Der Nachbesprechungsplan als PDF',
      },
    };

    listArchiveQuery.mockResolvedValue({
      items: [
        {
          id: 'c0333333-c333-4c33-8c33-c03333333333',
          contentVersion: 1,
          markdown: '### Barrierefreiheit, die allen hilft\n\nNeu',
          startsAt: '2026-07-22T00:00:00.000Z',
          endsAt: '2027-03-31T23:59:59.999Z',
        },
        {
          id: 'c0222222-c222-4c22-8c22-c02222222222',
          contentVersion: 6,
          markdown: '### Neu: Der Nachbesprechungsplan als PDF\n\nAlt',
          startsAt: '2026-07-17T00:00:00.000Z',
          endsAt: '2027-03-31T23:59:59.999Z',
        },
      ],
      nextCursor: null,
    });

    TestBed.configureTestingModule({
      imports: [NewsArchivePageComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { openDialogs: [] } },
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { newsArchive: stale } } },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
        {
          provide: MotdHeaderStateService,
          useValue: { decrementArchiveUnreadCount: vi.fn(), setArchiveUnreadCount: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NewsArchivePageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.items().map((i) => i.id)).toEqual([
      'c0222222-c222-4c22-8c22-c02222222222',
    ]);

    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.componentInstance.items().map((i) => i.id)).toEqual([
      'c0333333-c333-4c33-8c33-c03333333333',
      'c0222222-c222-4c22-8c22-c02222222222',
    ]);
    expect(fixture.componentInstance.archiveItemTitle('c0333333-c333-4c33-8c33-c03333333333')).toBe(
      'Barrierefreiheit, die allen hilft',
    );
  });

  it('blockiert loadMore bis der Live-Refresh der ersten Seite fertig ist', async () => {
    let resolveLiveFirstPage!: (value: {
      items: Array<{
        id: string;
        contentVersion: number;
        markdown: string;
        startsAt: string;
        endsAt: string;
      }>;
      nextCursor: string | null;
    }) => void;
    const liveFirstPage = new Promise<{
      items: Array<{
        id: string;
        contentVersion: number;
        markdown: string;
        startsAt: string;
        endsAt: string;
      }>;
      nextCursor: string | null;
    }>((resolve) => {
      resolveLiveFirstPage = resolve;
    });

    listArchiveQuery.mockImplementation(() => liveFirstPage);

    const stale: NewsArchiveInitialModel = {
      ...emptyResolved,
      items: [
        {
          id: 'c0222222-c222-4c22-8c22-c02222222222',
          contentVersion: 6,
          markdown: '### Alt\n\nText',
          startsAt: '2026-07-17T00:00:00.000Z',
          endsAt: '2027-03-31T23:59:59.999Z',
        },
      ],
      nextCursor: 'stale-cursor-a30',
      titleById: {
        'c0222222-c222-4c22-8c22-c02222222222': 'Alt',
      },
    };

    TestBed.configureTestingModule({
      imports: [NewsArchivePageComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { openDialogs: [] } },
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { newsArchive: stale } } },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
        {
          provide: MotdHeaderStateService,
          useValue: { decrementArchiveUnreadCount: vi.fn(), setArchiveUnreadCount: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NewsArchivePageComponent);
    fixture.detectChanges();
    // afterNextRender anstoßen, ohne auf den noch hängenden Live-Refresh zu warten
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fixture.componentInstance.liveRefreshPending()).toBe(true);
    expect(fixture.componentInstance.nextCursor()).toBe('stale-cursor-a30');
    expect(listArchiveQuery).toHaveBeenCalled();
    expect(
      listArchiveQuery.mock.calls.some((call) => {
        const arg = call[0] as { cursor?: string } | undefined;
        return arg !== undefined && arg !== null && !('cursor' in arg);
      }),
    ).toBe(true);
    const refreshCallsBeforeLoadMore = listArchiveQuery.mock.calls.length;

    await fixture.componentInstance.loadMoreArchive();
    expect(listArchiveQuery).toHaveBeenCalledTimes(refreshCallsBeforeLoadMore);
    expect(
      listArchiveQuery.mock.calls.every((call) => {
        const arg = call[0] as { cursor?: string } | undefined;
        return arg?.cursor !== 'stale-cursor-a30';
      }),
    ).toBe(true);

    resolveLiveFirstPage({
      items: [
        {
          id: 'c0333333-c333-4c33-8c33-c03333333333',
          contentVersion: 1,
          markdown: '### Neu\n\nText',
          startsAt: '2026-07-22T00:00:00.000Z',
          endsAt: '2027-03-31T23:59:59.999Z',
        },
      ],
      nextCursor: 'live-cursor-a29',
    });

    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.componentInstance.liveRefreshPending()).toBe(false);
    expect(fixture.componentInstance.nextCursor()).toBe('live-cursor-a29');

    listArchiveQuery.mockResolvedValue({
      items: [
        {
          id: 'c0444444-c444-4c44-8c44-c04444444444',
          contentVersion: 1,
          markdown: '### Älter\n\nText',
          startsAt: '2026-07-10T00:00:00.000Z',
          endsAt: '2027-03-31T23:59:59.999Z',
        },
      ],
      nextCursor: null,
    });

    await fixture.componentInstance.loadMoreArchive();
    expect(listArchiveQuery.mock.calls.at(-1)?.[0]).toMatchObject({ cursor: 'live-cursor-a29' });
    expect(fixture.componentInstance.items().map((i) => i.id)).toEqual([
      'c0333333-c333-4c33-8c33-c03333333333',
      'c0444444-c444-4c44-8c44-c04444444444',
    ]);
  });

  it('macht Meldungstitel als In-Page-Anker per Tab erreichbar', () => {
    const withItems: NewsArchiveInitialModel = {
      ...emptyResolved,
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 1,
          markdown: '# Erste Meldung\n\nText',
          startsAt: '2026-01-10T10:00:00.000Z',
          endsAt: '2026-01-15T18:00:00.000Z',
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          contentVersion: 1,
          markdown: '# Zweite Meldung\n\nText',
          startsAt: '2026-01-12T10:00:00.000Z',
          endsAt: '2026-01-16T18:00:00.000Z',
        },
      ],
      titleById: {
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': 'Erste Meldung',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': 'Zweite Meldung',
      },
      htmlById: {},
      archiveMaxCursor: {
        startsAtIso: '2026-01-12T10:00:00.000Z',
        motdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        contentVersion: 1,
      },
      archiveUnreadCount: 2,
    };

    TestBed.configureTestingModule({
      imports: [NewsArchivePageComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { openDialogs: [] } },
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { newsArchive: withItems } } },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
        {
          provide: MotdHeaderStateService,
          useValue: { decrementArchiveUnreadCount: vi.fn(), setArchiveUnreadCount: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NewsArchivePageComponent);
    fixture.detectChanges();

    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
        '.news-archive-page__entry-title-link',
      ),
    );
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '#motd-archive-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '#motd-archive-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ]);
    expect(links.map((l) => l.textContent?.trim())).toEqual(['Zweite Meldung', 'Erste Meldung']);
    expect(links.every((l) => l.tabIndex >= 0)).toBe(true);
  });

  it('setzt den Fragment-Anker per replaceState ohne History-Push', () => {
    const withItems: NewsArchiveInitialModel = {
      ...emptyResolved,
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 1,
          markdown: '# Erste Meldung\n\nText',
          startsAt: '2026-01-10T10:00:00.000Z',
          endsAt: '2026-01-15T18:00:00.000Z',
        },
      ],
      titleById: {
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': 'Erste Meldung',
      },
      htmlById: {},
    };

    TestBed.configureTestingModule({
      imports: [NewsArchivePageComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { openDialogs: [] } },
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { newsArchive: withItems } } },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
        {
          provide: MotdHeaderStateService,
          useValue: { decrementArchiveUnreadCount: vi.fn(), setArchiveUnreadCount: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NewsArchivePageComponent);
    fixture.detectChanges();

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.news-archive-page__entry-title-link',
    );
    expect(link).toBeTruthy();
    link!.click();

    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(String(replaceStateSpy.mock.calls[0]?.[2] ?? '')).toContain(
      '#motd-archive-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(pushStateSpy).not.toHaveBeenCalled();
    replaceStateSpy.mockRestore();
    pushStateSpy.mockRestore();
  });

  it('behält den Dialogtitel auch im Fehlerzustand und schließt bei offener Lightbox nicht per Escape', () => {
    TestBed.configureTestingModule({
      imports: [NewsArchivePageComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { openDialogs: [{}] } },
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                newsArchive: {
                  ...emptyResolved,
                  errorMessage: 'Archiv konnte nicht geladen werden.',
                },
              },
            },
          },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
        {
          provide: MotdHeaderStateService,
          useValue: { decrementArchiveUnreadCount: vi.fn(), setArchiveUnreadCount: vi.fn() },
        },
      ],
    }).compileComponents();

    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 });
    const fixture = TestBed.createComponent(NewsArchivePageComponent);
    const location = TestBed.inject(Location);
    const spy = vi.spyOn(location, 'back');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#news-archive-page-title')?.textContent).toContain(
      'News-Archiv',
    );
    expect(fixture.nativeElement.querySelector('.news-archive-page__error')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('bietet einen zweiten Zurück-Button am Seitenende', () => {
    TestBed.configureTestingModule({
      imports: [NewsArchivePageComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { openDialogs: [] } },
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                newsArchive: emptyResolved,
              },
            },
          },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
        {
          provide: MotdHeaderStateService,
          useValue: { decrementArchiveUnreadCount: vi.fn(), setArchiveUnreadCount: vi.fn() },
        },
      ],
    }).compileComponents();

    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 });
    const fixture = TestBed.createComponent(NewsArchivePageComponent);
    const location = TestBed.inject(Location);
    const spy = vi.spyOn(location, 'back');
    fixture.detectChanges();

    const backNavs = fixture.nativeElement.querySelectorAll('nav.content-back');
    expect(backNavs).toHaveLength(2);
    expect(backNavs[1]?.getAttribute('aria-label')).toBe('Navigation am Seitenende');
    const bottomBack = fixture.nativeElement.querySelector(
      'nav.content-back--bottom button',
    ) as HTMLButtonElement | null;
    expect(bottomBack).toBeTruthy();
    bottomBack!.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('markArchiveItemRead senkt den Zähler um 1 und zeigt den Gelesen-Status', () => {
    const itemId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const withItems: NewsArchiveInitialModel = {
      ...emptyResolved,
      items: [
        {
          id: itemId,
          contentVersion: 1,
          markdown: '# Erste Meldung\n\nText',
          startsAt: '2026-01-10T10:00:00.000Z',
          endsAt: '2026-01-15T18:00:00.000Z',
        },
      ],
      titleById: { [itemId]: 'Erste Meldung' },
      htmlById: {},
      archiveMaxCursor: {
        startsAtIso: '2026-01-10T10:00:00.000Z',
        motdId: itemId,
        contentVersion: 1,
      },
      archiveUnreadCount: 1,
    };

    const headerState = {
      decrementArchiveUnreadCount: vi.fn(),
      setArchiveUnreadCount: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [NewsArchivePageComponent],
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: { openDialogs: [] } },
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { newsArchive: withItems } } },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
        { provide: MotdHeaderStateService, useValue: headerState },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NewsArchivePageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.news-archive-page__mark-read')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.news-archive-page__mark-read')?.textContent,
    ).toContain('Als gelesen markieren');
    expect(
      fixture.nativeElement.querySelector('.news-archive-page__read-state--unread'),
    ).toBeTruthy();

    const markBtn = fixture.nativeElement.querySelector(
      '.news-archive-page__mark-read',
    ) as HTMLButtonElement;
    markBtn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.archiveUnreadCount()).toBe(0);
    expect(fixture.nativeElement.querySelector('.news-archive-page__mark-read')).toBeNull();
    expect(fixture.nativeElement.querySelector('.news-archive-page__entry--read')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.news-archive-page__read-state')?.textContent,
    ).toContain('Gelesen');
    expect(
      fixture.nativeElement.querySelector('.news-archive-page__read-state--unread'),
    ).toBeNull();
    const stored = JSON.parse(localStorage.getItem(MOTD_LOCAL_STORAGE_KEY)!);
    expect(stored.archiveReadItems).toEqual([{ motdId: itemId, contentVersion: 1 }]);
    expect(headerState.decrementArchiveUnreadCount).toHaveBeenCalled();
  });
});
