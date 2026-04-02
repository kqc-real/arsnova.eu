import { Injectable, LOCALE_ID, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { AppLocale, MotdPublicDTO } from '@arsnova/shared-types';
import { getEffectiveLocale, localeIdToSupported } from './locale-from-path';
import { motdDismissedPairsForApi } from './motd-storage';
import { trpc } from './trpc.client';

/**
 * Single source of truth für `motd.getCurrent`:
 * - dedupliziert parallele Requests (auch wenn mehrere Komponenten gleichzeitig initialisieren)
 * - begrenzt die Frequenz, falls irgendwas wiederholt triggert
 */
@Injectable({ providedIn: 'root' })
export class MotdCurrentService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly localeId = inject(LOCALE_ID);

  private inFlight: Promise<MotdPublicDTO | null> | null = null;
  private lastFetchAtMs = 0;
  private cached: MotdPublicDTO | null = null;
  private static readonly MIN_FETCH_INTERVAL_MS = 10_000;

  async getCurrent(): Promise<MotdPublicDTO | null> {
    if (!isPlatformBrowser(this.platformId)) return null;
    if (this.inFlight) return this.inFlight;
    const now = Date.now();
    if (this.cached && now - this.lastFetchAtMs < MotdCurrentService.MIN_FETCH_INTERVAL_MS) {
      return this.cached;
    }
    this.lastFetchAtMs = now;
    const locale = getEffectiveLocale(localeIdToSupported(this.localeId)) as AppLocale;
    const dismissed = motdDismissedPairsForApi();

    this.inFlight = trpc.motd.getCurrent
      .query({
        locale,
        ...(dismissed.length ? { overlayDismissedUpTo: dismissed } : {}),
      })
      .then((r) => {
        this.cached = r.motd ?? null;
        return this.cached;
      })
      .catch(() => null)
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  /** Nach Dismiss/Ack: erneuter Abruf darf sofort passieren. */
  invalidate(): void {
    this.cached = null;
    this.lastFetchAtMs = 0;
  }
}
