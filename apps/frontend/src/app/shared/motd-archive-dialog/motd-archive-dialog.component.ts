import { Component, OnInit, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import {
  MatAccordion,
  MatExpansionPanel,
  MatExpansionPanelDescription,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import type { AppLocale, MotdArchiveItemDTO, MotdArchiveReadCursor } from '@arsnova/shared-types';
import { trpc } from '../../core/trpc.client';
import { MotdHeaderRefreshService } from '../../core/motd-header-refresh.service';
import { MotdHeaderStateService } from '../../core/motd-header-state.service';
import {
  getMotdArchiveReadItems,
  getMotdArchiveSeenUpToCursor,
  markMotdArchiveItemRead,
  motdGetHeaderStateClientInput,
  setMotdArchiveSeenUpToCursor,
} from '../../core/motd-storage';
import { resolveMotdAssetOrigin } from '../../core/motd-asset-origin';
import { formatMotdArchiveStartsAtForDisplay } from '../../core/motd-ends-display';
import { localizeKnownServerError } from '../../core/localize-known-server-message';
import { MarkdownImageLightboxDirective } from '../markdown-image-lightbox/markdown-image-lightbox.directive';
import { buildMotdArchiveItemDisplay } from '../motd-archive-render.util';
import { splitMotdDecorativeEmoji, type MotdTitleDisplay } from '../motd-decorative-emoji.util';
import {
  compareMotdArchiveReadCursors,
  countMotdArchiveUnreadItems,
  isMotdArchiveItemUnread,
  newestMotdArchiveReadCursor,
  sortMotdArchiveItemsNewFirst,
} from '../motd-archive-sort.util';

export type MotdArchiveDialogData = { locale: AppLocale };

/** BCP 47 für Datumsdarstellung passend zur UI-Sprache (Epic 10 Archiv). */
const ARCHIVE_DATE_LOCALE: Record<AppLocale, string> = {
  de: 'de-DE',
  en: 'en-GB',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
};

@Component({
  selector: 'app-motd-archive-dialog',
  standalone: true,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogClose,
    MatButton,
    MatIconButton,
    MatIcon,
    MatProgressSpinner,
    MatTooltip,
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatExpansionPanelDescription,
    MarkdownImageLightboxDirective,
  ],
  templateUrl: './motd-archive-dialog.component.html',
  styleUrls: ['../styles/dialog-title-header.scss', './motd-archive-dialog.component.scss'],
})
export class MotdArchiveDialogComponent implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly snackBar = inject(MatSnackBar);
  private readonly motdHeaderRefresh = inject(MotdHeaderRefreshService);
  private readonly motdHeaderState = inject(MotdHeaderStateService);
  readonly data = inject<MotdArchiveDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  /** Zusätzliche Archiv-Seite nachlädt (Pagination). */
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<MotdArchiveItemDTO[]>([]);
  /** Nächste Seite für `listArchive` oder `null`. */
  readonly nextCursor = signal<string | null>(null);
  /** Neuester Publikationscursor; null wenn leer oder Header-Anfrage fehlgeschlagen. */
  readonly archiveMaxCursor = signal<MotdArchiveReadCursor | null>(null);
  /** Ungelesen relativ zum Client-Wasserzeichen und einzeln gelesenen Einträgen. */
  readonly archiveUnreadCount = signal(0);
  /** Lokal einzeln als gelesen markierte MOTDs (für den Gelesen-Button). */
  readonly archiveReadItems = signal(getMotdArchiveReadItems());

  /** motd id → Anzeige-Titel (Markdown-Überschrift oder Fallback) */
  readonly titleById = signal<Record<string, string>>({});
  /** motd id → sanitized preview html (ohne führende ATX-Überschrift, falls vorhanden) */
  readonly htmlById = signal<Record<string, SafeHtml>>({});

  private readonly archiveItemFallbackTitle = $localize`:@@motd.archiveItemFallbackTitle:Archiv-Meldung`;

  /** `startsAt` (ISO-UTC) als Veröffentlichungsdatum im Archiv. */
  formatArchiveDate(iso: string): string {
    return formatMotdArchiveStartsAtForDisplay(iso, ARCHIVE_DATE_LOCALE[this.data.locale]);
  }

  /** Stabiler Template-Zugriff für strictTemplates (Record-Index). */
  archiveItemTitle(id: string): string {
    return this.titleById()[id] ?? this.archiveItemFallbackTitle;
  }

  archiveItemTitleDisplay(id: string): MotdTitleDisplay {
    return splitMotdDecorativeEmoji(this.archiveItemTitle(id));
  }

  private buildArchiveRender(it: MotdArchiveItemDTO): { title: string; html: SafeHtml } {
    return buildMotdArchiveItemDisplay(it, this.sanitizer, this.archiveItemFallbackTitle, {
      repeatTitleInMarkdownBody: true,
      assetOrigin: resolveMotdAssetOrigin(),
    });
  }

  markArchiveAllRead(): void {
    const max = this.effectiveArchiveMaxCursor();
    if (!max) {
      return;
    }
    setMotdArchiveSeenUpToCursor(max);
    this.archiveReadItems.set([]);
    this.archiveUnreadCount.set(0);
    this.motdHeaderState.setArchiveUnreadCount(0);
    this.snackBar.open(
      $localize`:@@motd.archiveMarkedAllReadSnack:Archiv als gelesen markiert.`,
      undefined,
      { duration: 2800 },
    );
    this.motdHeaderRefresh.notifyMotdHeaderRefresh();
  }

  isArchiveItemUnread(item: MotdArchiveItemDTO): boolean {
    return isMotdArchiveItemUnread(item, getMotdArchiveSeenUpToCursor(), this.archiveReadItems());
  }

  markArchiveItemRead(item: MotdArchiveItemDTO, event: Event): void {
    if (!this.isArchiveItemUnread(item)) {
      return;
    }
    if (!markMotdArchiveItemRead(item.id, item.contentVersion)) {
      return;
    }
    this.archiveReadItems.set(getMotdArchiveReadItems());
    this.archiveUnreadCount.update((n) => Math.max(0, n - 1));
    this.motdHeaderState.decrementArchiveUnreadCount();
    this.focusArchivePanelHeader(event);
    this.motdHeaderRefresh.notifyMotdHeaderRefresh();
  }

  private focusArchivePanelHeader(event: Event): void {
    const current = event.currentTarget as HTMLElement | null;
    current
      ?.closest('.mat-expansion-panel')
      ?.querySelector<HTMLElement>('.mat-expansion-panel-header')
      ?.focus();
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.archiveReadItems.set(getMotdArchiveReadItems());
    const headerInput = {
      locale: this.data.locale,
      ...motdGetHeaderStateClientInput(),
    };
    const [stateResult, listResult] = await Promise.allSettled([
      trpc.motd.getHeaderState.query(headerInput),
      trpc.motd.listArchive.query({ locale: this.data.locale, pageSize: 30 }),
    ]);

    if (stateResult.status === 'fulfilled') {
      const s = stateResult.value;
      this.archiveMaxCursor.set(s.archiveMaxCursor ?? null);
      this.archiveUnreadCount.set(s.archiveUnreadCount);
    }

    if (listResult.status === 'fulfilled') {
      const first = listResult.value;
      const sorted = sortMotdArchiveItemsNewFirst(first.items);
      this.items.set(sorted);
      this.nextCursor.set(first.nextCursor);
      const titles: Record<string, string> = {};
      const map: Record<string, SafeHtml> = {};
      for (const it of sorted) {
        const { title, html } = this.buildArchiveRender(it);
        titles[it.id] = title;
        map[it.id] = html;
      }
      this.titleById.set(titles);
      this.htmlById.set(map);
    } else {
      const e = listResult.reason;
      this.error.set(
        localizeKnownServerError(
          e,
          $localize`:@@motd.archiveLoadError:Archiv konnte nicht geladen werden.`,
        ),
      );
    }

    this.reconcileArchiveReadSignals(stateResult.status === 'fulfilled');
    this.loading.set(false);
  }

  async loadMoreArchive(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    try {
      const page = await trpc.motd.listArchive.query({
        locale: this.data.locale,
        pageSize: 30,
        cursor,
      });
      this.items.update((prev) => sortMotdArchiveItemsNewFirst([...prev, ...page.items]));
      this.nextCursor.set(page.nextCursor);
      const rendered = page.items.map((it) => {
        const r = this.buildArchiveRender(it);
        return { id: it.id, title: r.title, html: r.html };
      });
      this.titleById.update((prevTitles) => {
        const nextT = { ...prevTitles };
        for (const r of rendered) {
          nextT[r.id] = r.title;
        }
        return nextT;
      });
      this.htmlById.update((prev) => {
        const next = { ...prev };
        for (const r of rendered) {
          next[r.id] = r.html;
        }
        return next;
      });
    } catch (e) {
      const msg = localizeKnownServerError(
        e,
        $localize`:@@motd.archiveLoadMoreError:Weitere Meldungen konnten nicht geladen werden.`,
      );
      this.snackBar.open(msg, undefined, { duration: 4000 });
    } finally {
      this.loadingMore.set(false);
    }
  }

  /**
   * Ohne gültigen Header-State (Rate-Limit, alter Server) trotzdem Button/Counts aus der ersten
   * listArchive-Seite ableiten. `archiveMaxCursor` vom Server bleibt bevorzugt (gesamtes Archiv).
   */
  private reconcileArchiveReadSignals(headerOk: boolean): void {
    const items = this.items();
    const maxFromPage = newestMotdArchiveReadCursor(items);

    if (!this.archiveMaxCursor() && maxFromPage) {
      this.archiveMaxCursor.set(maxFromPage);
    }

    if (!headerOk && items.length > 0) {
      this.archiveUnreadCount.set(
        countMotdArchiveUnreadItems(items, getMotdArchiveSeenUpToCursor(), this.archiveReadItems()),
      );
    }
  }

  /** Effektiver Cursor für „Alles gelesen“: Server-Maximum oder Maximum der geladenen Seite. */
  private effectiveArchiveMaxCursor(): MotdArchiveReadCursor | null {
    const fromServer = this.archiveMaxCursor();
    const fromPage = newestMotdArchiveReadCursor(this.items());
    if (fromServer && fromPage) {
      return compareMotdArchiveReadCursors(fromServer, fromPage) >= 0 ? fromServer : fromPage;
    }
    return fromServer ?? fromPage;
  }
}
