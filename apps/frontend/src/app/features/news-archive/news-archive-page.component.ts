import { Location } from '@angular/common';
import { afterNextRender, Component, inject, Injector, LOCALE_ID, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import type { AppLocale, MotdArchiveItemDTO } from '@arsnova/shared-types';
import { trpc } from '../../core/trpc.client';
import { MotdHeaderRefreshService } from '../../core/motd-header-refresh.service';
import { setMotdArchiveSeenUpToEndsAtIso } from '../../core/motd-storage';
import { resolveMotdAssetOrigin } from '../../core/motd-asset-origin';
import { formatMotdArchiveStartsAtForDisplay } from '../../core/motd-ends-display';
import { localizeKnownServerError } from '../../core/localize-known-server-message';
import { buildMotdArchiveItemDisplay } from '../../shared/motd-archive-render.util';
import { MarkdownImageLightboxDirective } from '../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { sortMotdArchiveItemsNewFirst } from '../../shared/motd-archive-sort.util';
import { loadNewsArchivePageModel, type NewsArchiveInitialModel } from './news-archive-initial';

const ARCHIVE_DATE_LOCALE: Record<AppLocale, string> = {
  de: 'de-DE',
  en: 'en-GB',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
};

function appLocaleFromInjectedId(localeId: string): AppLocale {
  if (
    localeId === 'de' ||
    localeId === 'en' ||
    localeId === 'fr' ||
    localeId === 'it' ||
    localeId === 'es'
  ) {
    return localeId;
  }
  return 'de';
}

/**
 * Öffentliche News-Archiv-Seite (prerenderbar, semantisches HTML für Crawler).
 * Daten kommen aus {@link newsArchivePageResolver}, damit SSR/Prerender nicht im Ladezustand endet.
 *
 * Nach Hydration wird die erste Seite live nachgeladen: Deploy baut das Image vor
 * `prisma migrate deploy`, und Prerender trifft dabei die noch alte Prod-API
 * (`ARSNOVA_PRERENDER_TRPC_URL` / `https://arsnova.eu/trpc`). Ohne Browser-Refresh
 * blieben neue MOTD-Data-Migrationen unsichtbar, bis ein späteres Redeploy die SSG neu backt.
 */
@Component({
  selector: 'app-news-archive-page',
  standalone: true,
  imports: [MatButton, MatIcon, MatProgressSpinner, MatTooltip, MarkdownImageLightboxDirective],
  templateUrl: './news-archive-page.component.html',
  styleUrls: [
    '../../shared/styles/dialog-title-header.scss',
    '../../shared/styles/content-page-backdrop.scss',
    './news-archive-page.component.scss',
  ],
})
export class NewsArchivePageComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly snackBar = inject(MatSnackBar);
  private readonly motdHeaderRefresh = inject(MotdHeaderRefreshService);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly locale = appLocaleFromInjectedId(inject(LOCALE_ID));

  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<MotdArchiveItemDTO[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly archiveMaxEndsAtIso = signal<string | null>(null);
  readonly archiveUnreadCount = signal(0);
  readonly titleById = signal<Record<string, string>>({});
  readonly htmlById = signal<Record<string, SafeHtml>>({});

  private readonly archiveItemFallbackTitle = $localize`:@@motd.archiveItemFallbackTitle:Archiv-Meldung`;
  private readonly archiveLoadError = $localize`:@@motd.archiveLoadError:Archiv konnte nicht geladen werden.`;

  constructor() {
    const data = inject(ActivatedRoute).snapshot.data['newsArchive'] as NewsArchiveInitialModel;
    this.applyModel(data);

    afterNextRender(
      () => {
        void this.refreshFirstPageFromLiveApi();
      },
      { injector: this.injector },
    );
  }

  private applyModel(data: NewsArchiveInitialModel): void {
    this.items.set(sortMotdArchiveItemsNewFirst(data.items));
    this.nextCursor.set(data.nextCursor);
    this.archiveMaxEndsAtIso.set(data.archiveMaxEndsAtIso);
    this.archiveUnreadCount.set(data.archiveUnreadCount);
    this.titleById.set(data.titleById);
    this.htmlById.set(data.htmlById);
    this.error.set(data.errorMessage);
  }

  /**
   * Ersetzt die prerenderte erste Seite durch den aktuellen API-Stand.
   * Fehler lassen die SSG-/Resolver-Daten stehen (kein leeres Archiv bei Kurzausfall).
   */
  private async refreshFirstPageFromLiveApi(): Promise<void> {
    try {
      const live = await loadNewsArchivePageModel(
        this.locale,
        this.sanitizer,
        this.archiveItemFallbackTitle,
        this.archiveLoadError,
      );
      if (live.errorMessage && live.items.length === 0 && this.items().length > 0) {
        return;
      }
      this.applyModel(live);
    } catch {
      /* Prerender-/Resolver-Stand behalten */
    }
  }

  formatArchiveDate(iso: string): string | null {
    return formatMotdArchiveStartsAtForDisplay(iso, ARCHIVE_DATE_LOCALE[this.locale]);
  }

  archiveItemTitle(id: string): string {
    return this.titleById()[id] ?? this.archiveItemFallbackTitle;
  }

  /**
   * In-Page-Anker ohne History-Eintrag: nativer Fragment-Klick würde
   * `Location.back()` („Zurück“) nur zum vorherigen Hash führen.
   * Modifier-Klicks (neuer Tab usw.) behalten das native Verhalten.
   */
  onArchiveTitleLinkClick(event: MouseEvent, id: string): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (typeof window === 'undefined') {
      return;
    }
    const hash = `#motd-archive-${id}`;
    const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }

  back(): void {
    this.location.back();
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

  async loadMoreArchive(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    try {
      const page = await trpc.motd.listArchive.query({
        locale: this.locale,
        pageSize: 30,
        cursor,
      });
      this.items.update((prev) => sortMotdArchiveItemsNewFirst([...prev, ...page.items]));
      this.nextCursor.set(page.nextCursor);
      const rendered = page.items.map((it) =>
        buildMotdArchiveItemDisplay(it, this.sanitizer, this.archiveItemFallbackTitle, {
          assetOrigin: resolveMotdAssetOrigin(),
        }),
      );
      this.titleById.update((prevTitles) => {
        const nextT = { ...prevTitles };
        for (let i = 0; i < page.items.length; i++) {
          nextT[page.items[i]!.id] = rendered[i]!.title;
        }
        return nextT;
      });
      this.htmlById.update((prev) => {
        const next = { ...prev };
        for (let i = 0; i < page.items.length; i++) {
          next[page.items[i]!.id] = rendered[i]!.html;
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
