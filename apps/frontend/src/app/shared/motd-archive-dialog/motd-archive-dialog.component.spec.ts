import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MotdArchiveDialogComponent } from './motd-archive-dialog.component';
import { MotdHeaderRefreshService } from '../../core/motd-header-refresh.service';
import { MotdHeaderStateService } from '../../core/motd-header-state.service';
import { MOTD_LOCAL_STORAGE_KEY } from '../../core/motd-storage';

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

const defaultHeaderState = {
  hasActiveOverlay: false,
  hasArchiveEntries: false,
  archiveCount: 0,
  archiveMaxCursor: null,
  archiveMaxEndsAtIso: null as string | null,
  archiveUnreadCount: 0,
};

const motdHeaderStateMock = {
  decrementArchiveUnreadCount: vi.fn(),
  incrementArchiveUnreadCount: vi.fn(),
  setArchiveUnreadCount: vi.fn(),
};

describe('MotdArchiveDialogComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    listArchiveQuery.mockReset();
    listArchiveQuery.mockResolvedValue({ items: [], nextCursor: null });
    getHeaderStateQuery.mockReset();
    getHeaderStateQuery.mockResolvedValue({ ...defaultHeaderState });
    motdHeaderStateMock.decrementArchiveUnreadCount.mockReset();
    motdHeaderStateMock.incrementArchiveUnreadCount.mockReset();
    motdHeaderStateMock.setArchiveUnreadCount.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function configureDialog(locale: 'de' | 'en' = 'de'): void {
    TestBed.configureTestingModule({
      imports: [MotdArchiveDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { locale } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        MotdHeaderRefreshService,
        { provide: MotdHeaderStateService, useValue: motdHeaderStateMock },
      ],
    });
  }

  it('formatArchiveDate liefert die ersten 10 Zeichen bei ungültigem ISO-String', () => {
    configureDialog();
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    expect(fixture.componentInstance.formatArchiveDate('invalid')).toBe('invalid');
  });

  it('formatArchiveDate formatiert gültiges ISO-Datum (de-DE)', () => {
    configureDialog();
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    const s = fixture.componentInstance.formatArchiveDate('2026-04-03T12:00:00.000Z');
    expect(s).toContain('2026');
    expect(s).toContain('4');
  });

  it('formatArchiveDate zeigt auch sehr spätes Start-Datum (kein endsAt-„Fortlaufend“-Leerstring)', () => {
    configureDialog();
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    const s = fixture.componentInstance.formatArchiveDate('2099-12-31T12:00:00.000Z');
    expect(s).toContain('2099');
  });

  it('lädt Archiv per listArchive und setzt items', async () => {
    getHeaderStateQuery.mockResolvedValue({
      ...defaultHeaderState,
      hasArchiveEntries: true,
      archiveCount: 1,
      archiveMaxCursor: {
        startsAtIso: '2026-01-10T10:00:00.000Z',
        motdId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        contentVersion: 1,
      },
      archiveUnreadCount: 1,
    });
    listArchiveQuery.mockResolvedValue({
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 1,
          markdown: 'Hallo',
          startsAt: '2026-01-10T10:00:00.000Z',
          endsAt: '2026-01-15T18:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    configureDialog();
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    expect(listArchiveQuery).toHaveBeenCalledWith({ locale: 'de', pageSize: 30 });
    expect(fixture.componentInstance.items().length).toBe(1);
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.error()).toBeNull();
  });

  it('setzt Fehlertext bei listArchive-Fehler', async () => {
    listArchiveQuery.mockRejectedValue(new Error('upstream'));
    configureDialog('en');
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    expect(fixture.componentInstance.error()).toBe('upstream');
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('setzt Archiv-Maximum aus listArchive wenn getHeaderState fehlschlägt', async () => {
    getHeaderStateQuery.mockRejectedValue(new Error('rate limit'));
    listArchiveQuery.mockResolvedValue({
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 1,
          markdown: 'Hallo',
          startsAt: '2026-02-01T12:00:00.000Z',
          endsAt: '2026-03-01T12:00:00.000Z',
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          contentVersion: 1,
          markdown: 'Neu',
          startsAt: '2026-03-15T12:00:00.000Z',
          endsAt: '2026-04-01T12:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    configureDialog();
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    expect(fixture.componentInstance.archiveMaxCursor()).toEqual({
      startsAtIso: '2026-03-15T12:00:00.000Z',
      motdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      contentVersion: 1,
    });
    expect(fixture.componentInstance.archiveUnreadCount()).toBe(2);
  });

  it('loadMoreArchive hängt die nächste Seite an', async () => {
    const id1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const id2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    getHeaderStateQuery.mockResolvedValue({
      ...defaultHeaderState,
      hasArchiveEntries: true,
      archiveMaxCursor: {
        startsAtIso: '2025-12-15T00:00:00.000Z',
        motdId: id1,
        contentVersion: 1,
      },
      archiveUnreadCount: 0,
    });
    listArchiveQuery
      .mockResolvedValueOnce({
        items: [
          {
            id: id1,
            contentVersion: 1,
            markdown: 'A',
            startsAt: '2025-12-15T00:00:00.000Z',
            endsAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        nextCursor: id1,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: id2,
            contentVersion: 1,
            markdown: 'B',
            startsAt: '2025-11-20T00:00:00.000Z',
            endsAt: '2025-12-01T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      });
    configureDialog();
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    expect(fixture.componentInstance.nextCursor()).toBe(id1);
    expect(fixture.componentInstance.items().length).toBe(1);
    await fixture.componentInstance.loadMoreArchive();
    expect(listArchiveQuery).toHaveBeenLastCalledWith({
      locale: 'de',
      pageSize: 30,
      cursor: id1,
    });
    expect(fixture.componentInstance.items().length).toBe(2);
    expect(fixture.componentInstance.nextCursor()).toBeNull();
  });

  it('markArchiveAllRead speichert Wasserzeichen und benachrichtigt Toolbar', async () => {
    getHeaderStateQuery.mockResolvedValue({
      ...defaultHeaderState,
      hasArchiveEntries: true,
      archiveCount: 2,
      archiveMaxCursor: {
        startsAtIso: '2026-05-15T12:00:00.000Z',
        motdId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        contentVersion: 3,
      },
      archiveUnreadCount: 2,
    });
    configureDialog();
    const snackSpy = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    const notifySpy = vi.spyOn(TestBed.inject(MotdHeaderRefreshService), 'notifyMotdHeaderRefresh');
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.componentInstance.markArchiveAllRead();
    const raw = localStorage.getItem(MOTD_LOCAL_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).archiveSeenUpToCursor).toEqual({
      startsAtIso: '2026-05-15T12:00:00.000Z',
      motdId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      contentVersion: 3,
    });
    expect(fixture.componentInstance.archiveUnreadCount()).toBe(0);
    expect(snackSpy).toHaveBeenCalled();
    expect(notifySpy).toHaveBeenCalled();
    expect(motdHeaderStateMock.setArchiveUnreadCount).toHaveBeenCalledWith(0);
  });

  it('markArchiveItemRead senkt den Zähler um 1 ohne die Wasserlinie zu verschieben', async () => {
    const olderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const newerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    getHeaderStateQuery.mockResolvedValue({
      ...defaultHeaderState,
      hasArchiveEntries: true,
      archiveCount: 2,
      archiveMaxCursor: {
        startsAtIso: '2026-03-15T12:00:00.000Z',
        motdId: newerId,
        contentVersion: 1,
      },
      archiveUnreadCount: 2,
    });
    listArchiveQuery.mockResolvedValue({
      items: [
        {
          id: newerId,
          contentVersion: 1,
          markdown: 'Neu',
          startsAt: '2026-03-15T12:00:00.000Z',
          endsAt: '2026-04-01T12:00:00.000Z',
        },
        {
          id: olderId,
          contentVersion: 1,
          markdown: 'Alt',
          startsAt: '2026-02-01T12:00:00.000Z',
          endsAt: '2026-03-01T12:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    configureDialog();
    const notifySpy = vi.spyOn(TestBed.inject(MotdHeaderRefreshService), 'notifyMotdHeaderRefresh');
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const items = [...root.querySelectorAll('.motd-archive__item')];
    expect(items).toHaveLength(2);
    expect(items[0]!.querySelector('.motd-archive__mark-read')?.textContent).toContain(
      'Als gelesen markieren',
    );

    const markBtn = items[0]!.querySelector<HTMLButtonElement>('.motd-archive__mark-read');
    expect(markBtn).toBeTruthy();
    expect(markBtn!.textContent).toContain('Als gelesen markieren');
    markBtn!.click();
    fixture.detectChanges();

    const newer = fixture.componentInstance.items().find((item) => item.id === newerId);
    expect(newer).toBeTruthy();
    expect(fixture.componentInstance.archiveUnreadCount()).toBe(1);
    expect(fixture.componentInstance.isArchiveItemUnread(newer!)).toBe(false);
    const stored = JSON.parse(localStorage.getItem(MOTD_LOCAL_STORAGE_KEY)!);
    expect(stored.archiveReadItems).toEqual([{ motdId: newerId, contentVersion: 1 }]);
    expect(stored.archiveSeenUpToCursor).toBeUndefined();
    expect(motdHeaderStateMock.decrementArchiveUnreadCount).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalled();

    const panels = [...root.querySelectorAll('.motd-archive__panel')];
    expect(panels).toHaveLength(2);
    expect(items[0]!.classList.contains('motd-archive__item--read')).toBe(true);
    expect(panels[0]!.classList.contains('motd-archive__panel--read')).toBe(true);
    expect(panels[1]!.classList.contains('motd-archive__panel--read')).toBe(false);
    expect(items[0]!.querySelector('.motd-archive__mark-read')).toBeNull();
    expect(items[0]!.querySelector('.motd-archive__mark-unread')?.textContent).toContain(
      'Als ungelesen markieren',
    );
    expect(
      items[0]!.querySelector('.motd-archive__mark-unread mat-icon')?.textContent?.trim(),
    ).toBe('undo');
    expect(items[1]!.querySelector('.motd-archive__mark-read')).toBeTruthy();

    const unmarkBtn = items[0]!.querySelector<HTMLButtonElement>('.motd-archive__mark-unread');
    unmarkBtn!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.isArchiveItemUnread(newer!)).toBe(true);
    expect(fixture.componentInstance.archiveUnreadCount()).toBe(2);
    expect(motdHeaderStateMock.incrementArchiveUnreadCount).toHaveBeenCalledTimes(1);
    expect(items[0]!.querySelector('.motd-archive__mark-read')).toBeTruthy();
  });

  it('setzt inert auf zugeklappte Panel-Inhalte, damit Tab die Header erreicht', async () => {
    getHeaderStateQuery.mockResolvedValue({
      ...defaultHeaderState,
      hasArchiveEntries: true,
      archiveCount: 1,
      archiveMaxCursor: {
        startsAtIso: '2026-01-10T10:00:00.000Z',
        motdId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        contentVersion: 1,
      },
      archiveUnreadCount: 1,
    });
    listArchiveQuery.mockResolvedValue({
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 1,
          markdown: '# Titel\n\n[Link](https://arsnova.eu)',
          startsAt: '2026-01-10T10:00:00.000Z',
          endsAt: '2026-01-15T18:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    configureDialog();
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const body = root.querySelector('.motd-archive__body');
    expect(body).toBeTruthy();
    expect(body!.hasAttribute('inert')).toBe(true);

    const header = root.querySelector<HTMLElement>('.mat-expansion-panel-header');
    expect(header).toBeTruthy();
    header!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(body!.hasAttribute('inert')).toBe(false);
  });

  it('Klick auf den Lesestatus klappt das Panel nicht um', async () => {
    getHeaderStateQuery.mockResolvedValue({
      ...defaultHeaderState,
      hasArchiveEntries: true,
      archiveCount: 1,
      archiveMaxCursor: {
        startsAtIso: '2026-01-10T10:00:00.000Z',
        motdId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        contentVersion: 1,
      },
      archiveUnreadCount: 1,
    });
    listArchiveQuery.mockResolvedValue({
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 1,
          markdown: '# Titel\n\nText',
          startsAt: '2026-01-10T10:00:00.000Z',
          endsAt: '2026-01-15T18:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    configureDialog();
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const header = root.querySelector<HTMLElement>('.mat-expansion-panel-header');
    const markBtn = root.querySelector<HTMLElement>('.motd-archive__mark-read');
    expect(header).toBeTruthy();
    expect(markBtn).toBeTruthy();
    expect(header!.contains(markBtn!)).toBe(false);
    expect(header!.getAttribute('aria-expanded')).toBe('false');

    markBtn!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    markBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(header!.getAttribute('aria-expanded')).toBe('false');
  });

  it('hält Expansion-Header-Styles ohne ::ng-deep', () => {
    const styles = readFileSync(
      resolve(
        process.cwd(),
        'src/app/shared/motd-archive-dialog/motd-archive-dialog.component.scss',
      ),
      'utf8',
    );

    expect(styles).not.toContain('::ng-deep');
    expect(styles).toMatch(
      /\.motd-archive__panel\.mat-expansion-panel \.mat-expansion-panel-header\s*\{/,
    );
    expect(styles).toMatch(
      /\.motd-archive__mark-unread\.mat-mdc-button\s*\{[^}]*--mat-sys-on-surface-variant/s,
    );
    expect(styles).toMatch(/\.motd-archive__mark-unread \.mat-icon\s*\{[^}]*on-surface-variant/s);
  });
});
