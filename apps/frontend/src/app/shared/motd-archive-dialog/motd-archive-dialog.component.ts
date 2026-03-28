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
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import type { AppLocale, MotdArchiveItemDTO } from '@arsnova/shared-types';
import { trpc } from '../../core/trpc.client';
import { MotdHeaderRefreshService } from '../../core/motd-header-refresh.service';
import {
  getMotdArchiveSeenUpToEndsAtIso,
  setMotdArchiveSeenUpToEndsAtIso,
} from '../../core/motd-storage';
import { formatMotdEndsAtForDisplay } from '../../core/motd-ends-display';
import { renderMarkdownWithoutKatex } from '../markdown-katex.util';

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
  ],
  templateUrl: './motd-archive-dialog.component.html',
  styleUrl: './motd-archive-dialog.component.scss',
})
export class MotdArchiveDialogComponent implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly snackBar = inject(MatSnackBar);
  private readonly motdHeaderRefresh = inject(MotdHeaderRefreshService);
  readonly data = inject<MotdArchiveDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  /** Zusätzliche Archiv-Seite nachlädt (Pagination). */
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<MotdArchiveItemDTO[]>([]);
  /** Nächste Seite für `listArchive` oder `null`. */
  readonly nextCursor = signal<string | null>(null);
  /** Spätestes Archiv-Ende (ISO); null wenn leer oder Header-Anfrage fehlgeschlagen. */
  readonly archiveMaxEndsAtIso = signal<string | null>(null);
  /** Ungelesen relativ zum Client-Wasserzeichen. */
  readonly archiveUnreadCount = signal(0);

  /** motd id → sanitized preview html */
  readonly htmlById = signal<Record<string, SafeHtml>>({});

  /** `endsAt` (ISO-UTC) als Datum; bei technisch weitem Ende im Archiv leer (Admin: „Fortlaufend“). */
  formatArchiveDate(iso: string): string {
    return formatMotdEndsAtForDisplay(iso, ARCHIVE_DATE_LOCALE[this.data.locale], 'archive');
  }

  markArchiveAllRead(): void {
    const max = this.effectiveArchiveMaxEndsAtIso();
    if (!max) {
      return;
    }
    setMotdArchiveSeenUpToEndsAtIso(max);
    this.archiveUnreadCount.set(0);
    this.snackBar.open(
      $localize`:@@motd.archiveMarkedAllReadSnack:Archiv als gelesen markiert.`,
      undefined,
      { duration: 2800 },
    );
    this.motdHeaderRefresh.notifyMotdHeaderRefresh();
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const seen = getMotdArchiveSeenUpToEndsAtIso();
    const headerInput = {
      locale: this.data.locale,
      ...(seen ? { archiveSeenUpToEndsAtIso: seen } : {}),
    };
    const [stateResult, listResult] = await Promise.allSettled([
      trpc.motd.getHeaderState.query(headerInput),
      trpc.motd.listArchive.query({ locale: this.data.locale, pageSize: 30 }),
    ]);

    if (stateResult.status === 'fulfilled') {
      const s = stateResult.value;
      this.archiveMaxEndsAtIso.set(s.archiveMaxEndsAtIso);
      this.archiveUnreadCount.set(s.archiveUnreadCount);
    }

    if (listResult.status === 'fulfilled') {
      const first = listResult.value;
      this.items.set(first.items);
      this.nextCursor.set(first.nextCursor);
      const map: Record<string, SafeHtml> = {};
      for (const it of first.items) {
        map[it.id] = this.sanitizer.bypassSecurityTrustHtml(
          renderMarkdownWithoutKatex(it.markdown),
        );
      }
      this.htmlById.set(map);
    } else {
      const e = listResult.reason;
      this.error.set(
        e &&
          typeof e === 'object' &&
          'message' in e &&
          typeof (e as { message: string }).message === 'string'
          ? (e as { message: string }).message
          : $localize`:@@motd.archiveLoadError:Archiv konnte nicht geladen werden.`,
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
      this.items.update((prev) => [...prev, ...page.items]);
      this.nextCursor.set(page.nextCursor);
      this.htmlById.update((prev) => {
        const next = { ...prev };
        for (const it of page.items) {
          next[it.id] = this.sanitizer.bypassSecurityTrustHtml(
            renderMarkdownWithoutKatex(it.markdown),
          );
        }
        return next;
      });
    } catch (e) {
      const msg =
        e &&
        typeof e === 'object' &&
        'message' in e &&
        typeof (e as { message: string }).message === 'string'
          ? (e as { message: string }).message
          : $localize`:@@motd.archiveLoadMoreError:Weitere Meldungen konnten nicht geladen werden.`;
      this.snackBar.open(msg, undefined, { duration: 4000 });
    } finally {
      this.loadingMore.set(false);
    }
  }

  /**
   * Ohne gültigen Header-State (Rate-Limit, alter Server) trotzdem Button/Counts aus der ersten
   * listArchive-Seite ableiten. `archiveMaxEndsAtIso` vom Server bleibt bevorzugt (gesamtes Archiv).
   */
  private reconcileArchiveReadSignals(headerOk: boolean): void {
    const items = this.items();
    const maxFromPage =
      items.length === 0
        ? null
        : items.reduce((best, it) => (it.endsAt > best ? it.endsAt : best), items[0]!.endsAt);

    if (!this.archiveMaxEndsAtIso() && maxFromPage) {
      this.archiveMaxEndsAtIso.set(maxFromPage);
    }

    if (!headerOk && items.length > 0) {
      const seen = getMotdArchiveSeenUpToEndsAtIso();
      this.archiveUnreadCount.set(
        seen ? items.filter((it) => it.endsAt > seen).length : items.length,
      );
    }
  }

  /** Effektives Ende für „Alles gelesen“: Server-Maximum oder Maximum der geladenen Seite. */
  private effectiveArchiveMaxEndsAtIso(): string | null {
    const fromServer = this.archiveMaxEndsAtIso();
    const items = this.items();
    const fromPage =
      items.length === 0
        ? null
        : items.reduce((best, it) => (it.endsAt > best ? it.endsAt : best), items[0]!.endsAt);
    if (fromServer && fromPage) {
      return fromServer >= fromPage ? fromServer : fromPage;
    }
    return fromServer ?? fromPage;
  }
}
