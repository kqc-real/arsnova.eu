import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MotdArchiveDialogComponent } from './motd-archive-dialog.component';
import { MotdHeaderRefreshService } from '../../core/motd-header-refresh.service';
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
  archiveMaxEndsAtIso: null as string | null,
  archiveUnreadCount: 0,
};

describe('MotdArchiveDialogComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    listArchiveQuery.mockReset();
    listArchiveQuery.mockResolvedValue({ items: [], nextCursor: null });
    getHeaderStateQuery.mockReset();
    getHeaderStateQuery.mockResolvedValue({ ...defaultHeaderState });
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

  it('formatArchiveDate ist bei 2099+ leer (kein „Fortlaufend“-Label im Archiv)', () => {
    configureDialog();
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    expect(fixture.componentInstance.formatArchiveDate('2099-12-31T12:00:00.000Z')).toBe('');
  });

  it('lädt Archiv per listArchive und setzt items', async () => {
    getHeaderStateQuery.mockResolvedValue({
      ...defaultHeaderState,
      hasArchiveEntries: true,
      archiveCount: 1,
      archiveMaxEndsAtIso: '2026-01-20T00:00:00.000Z',
      archiveUnreadCount: 1,
    });
    listArchiveQuery.mockResolvedValue({
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contentVersion: 1,
          markdown: 'Hallo',
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
          endsAt: '2026-03-01T12:00:00.000Z',
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          contentVersion: 1,
          markdown: 'Neu',
          endsAt: '2026-04-01T12:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    configureDialog();
    const fixture = TestBed.createComponent(MotdArchiveDialogComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    expect(fixture.componentInstance.archiveMaxEndsAtIso()).toBe('2026-04-01T12:00:00.000Z');
    expect(fixture.componentInstance.archiveUnreadCount()).toBe(2);
  });

  it('loadMoreArchive hängt die nächste Seite an', async () => {
    const id1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const id2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    getHeaderStateQuery.mockResolvedValue({
      ...defaultHeaderState,
      hasArchiveEntries: true,
      archiveMaxEndsAtIso: '2026-02-01T00:00:00.000Z',
      archiveUnreadCount: 0,
    });
    listArchiveQuery
      .mockResolvedValueOnce({
        items: [
          {
            id: id1,
            contentVersion: 1,
            markdown: 'A',
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
      archiveMaxEndsAtIso: '2026-06-01T12:00:00.000Z',
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
    expect(JSON.parse(raw!).archiveSeenUpToEndsAtIso).toBe('2026-06-01T12:00:00.000Z');
    expect(fixture.componentInstance.archiveUnreadCount()).toBe(0);
    expect(snackSpy).toHaveBeenCalled();
    expect(notifySpy).toHaveBeenCalled();
  });
});
