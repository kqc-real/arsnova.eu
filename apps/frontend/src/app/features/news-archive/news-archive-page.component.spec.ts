import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsArchivePageComponent } from './news-archive-page.component';
import { MotdHeaderRefreshService } from '../../core/motd-header-refresh.service';
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
  archiveMaxEndsAtIso: null,
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
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { newsArchive: emptyResolved } } },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<NewsArchivePageComponent> =
      TestBed.createComponent(NewsArchivePageComponent);
    fixture.detectChanges();

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
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { newsArchive: stale } } },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
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
      archiveMaxEndsAtIso: '2026-01-16T18:00:00.000Z',
      archiveUnreadCount: 2,
    };

    TestBed.configureTestingModule({
      imports: [NewsArchivePageComponent],
      providers: [
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { newsArchive: withItems } } },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
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
        { provide: LOCALE_ID, useValue: 'de' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { newsArchive: withItems } } },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MotdHeaderRefreshService, useValue: { notifyMotdHeaderRefresh: vi.fn() } },
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
});
