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
import type { AppLocale, MotdArchiveItemDTO } from '@arsnova/shared-types';
import { trpc } from '../../core/trpc.client';
import { MotdHeaderRefreshService } from '../../core/motd-header-refresh.service';
import {
  getMotdArchiveSeenUpToEndsAtIso,
  motdDismissedPairsForApi,
  setMotdArchiveSeenUpToEndsAtIso,
} from '../../core/motd-storage';
import { formatMotdArchiveStartsAtForDisplay } from '../../core/motd-ends-display';
import { splitMotdArchiveFirstAtxHeading } from '../../core/motd-archive-split.util';
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
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatExpansionPanelDescription,
  ],
  templateUrl: './motd-archive-dialog.component.html',
  styleUrls: ['../styles/dialog-title-header.scss', './motd-archive-dialog.component.scss'],
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

  private buildArchiveRender(it: MotdArchiveItemDTO): { title: string; html: SafeHtml } {
    const { title: atxTitle, bodyMarkdown } = splitMotdArchiveFirstAtxHeading(it.markdown);
    const displayTitle = atxTitle ?? this.archiveItemFallbackTitle;
    const mdForBody =
      atxTitle !== null ? (bodyMarkdown.trim().length > 0 ? bodyMarkdown : '\n') : it.markdown;
    return {
      title: displayTitle,
      html: this.sanitizer.bypassSecurityTrustHtml(renderMarkdownWithoutKatex(mdForBody)),
    };
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
    const dismissed = motdDismissedPairsForApi();
    const headerInput = {
      locale: this.data.locale,
      ...(seen ? { archiveSeenUpToEndsAtIso: seen } : {}),
      ...(dismissed.length ? { overlayDismissedUpTo: dismissed } : {}),
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
      const titles: Record<string, string> = {};
      const map: Record<string, SafeHtml> = {};
      for (const it of first.items) {
        const { title, html } = this.buildArchiveRender(it);
        titles[it.id] = title;
        map[it.id] = html;
      }
      this.titleById.set(titles);
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
