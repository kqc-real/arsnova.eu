import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import type { AppLocale } from '@arsnova/shared-types';
import { trpc } from './trpc.client';
import { getEffectiveLocale, localeIdToSupported } from './locale-from-path';
import { getMotdArchiveSeenUpToEndsAtIso, motdDismissedPairsForApi } from './motd-storage';
import { MotdHeaderRefreshService } from './motd-header-refresh.service';

/**
 * Gemeinsamer Header-/Footer-Zustand aus `motd.getHeaderState` (eine Abfrage für Toolbar + Footer).
 * Passive Aktualisierung: nach Navigation und wenn der Tab wieder sichtbar wird (neue News).
 */
@Injectable({ providedIn: 'root' })
export class MotdHeaderStateService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly localeId = inject(LOCALE_ID);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly motdHeaderRefresh = inject(MotdHeaderRefreshService);

  /** Entprellt: mehrere Routenwechsel / Visibility-Events → eine Abfrage. */
  private readonly passiveRefresh$ = new Subject<void>();

  /**
   * Schutz gegen Request-Loops (z. B. mehrfach registrierte Listener nach Hot-Reload / unerwartete Trigger-Kaskaden):
   * - niemals parallel dieselbe Query mehrfach starten
   * - minimale Pause zwischen zwei Requests
   */
  private inFlight: Promise<void> | null = null;
  private lastRefreshAtMs = 0;
  private static readonly MIN_REFRESH_INTERVAL_MS = 1500;

  /** Aktive Meldung oder Archiv-Einträge → Campaign-Icon in der Toolbar. */
  readonly motdToolbarIcon = signal(false);

  /** Ungelesene Archiv-MOTDs relativ zum Client-Wasserzeichen. */
  readonly archiveUnreadCount = signal(0);

  /** Anzahl Einträge im Archiv (Server, gleiche Filterlogik wie listArchive). */
  readonly archiveTotalCount = signal(0);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      void this.refresh();
      this.motdHeaderRefresh.requests.subscribe(() => void this.refresh());
      this.passiveRefresh$.pipe(debounceTime(500)).subscribe(() => void this.refresh());
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(() => this.passiveRefresh$.next());
      this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  async refresh(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.inFlight) {
      return this.inFlight;
    }
    const now = Date.now();
    if (now - this.lastRefreshAtMs < MotdHeaderStateService.MIN_REFRESH_INTERVAL_MS) {
      return;
    }
    this.lastRefreshAtMs = now;

    const locale = getEffectiveLocale(localeIdToSupported(this.localeId)) as AppLocale;
    this.inFlight = (async () => {
      try {
        const seen = getMotdArchiveSeenUpToEndsAtIso();
        const dismissed = motdDismissedPairsForApi();
        const s = await trpc.motd.getHeaderState.query({
          locale,
          ...(seen ? { archiveSeenUpToEndsAtIso: seen } : {}),
          ...(dismissed.length ? { overlayDismissedUpTo: dismissed } : {}),
        });
        this.motdToolbarIcon.set(s.hasActiveOverlay || s.hasArchiveEntries);
        this.archiveUnreadCount.set(s.archiveUnreadCount);
        this.archiveTotalCount.set(s.archiveCount);
      } catch {
        this.motdToolbarIcon.set(false);
        this.archiveUnreadCount.set(0);
        this.archiveTotalCount.set(0);
      }
    })().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private readonly onVisibilityChange = (): void => {
    if (this.document.visibilityState === 'visible') {
      this.passiveRefresh$.next();
    }
  };
}
