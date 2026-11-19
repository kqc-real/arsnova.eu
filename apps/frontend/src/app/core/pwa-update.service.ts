import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import type { Subscription } from 'rxjs';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CHECK_COOLDOWN_MS = 15_000;
const CHECK_TIMEOUT_MS = 30_000;
const READY_TIMEOUT_MS = 8_000;

/** Observes updates before deferred startup work; never activates a running client. */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService implements OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly sw = inject(SwUpdate, { optional: true });
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly loadedBuildId = this.doc.querySelector<HTMLMetaElement>(
    'meta[name="arsnova-pwa-build"]',
  )?.content;
  readonly available = signal(false);

  private subscription: Subscription | undefined;
  private started = false;
  private destroyed = false;
  private interval: ReturnType<typeof setInterval> | undefined;
  private readyTimeout: ReturnType<typeof setTimeout> | undefined;
  private pending: { timeout: ReturnType<typeof setTimeout> } | undefined;
  private lastCheckAt: number | undefined;

  constructor() {
    if (!this.browser || !this.sw?.isEnabled) return;
    this.subscription = this.sw.versionUpdates.subscribe((event) => this.onVersion(event));
  }

  start(): void {
    if (!this.browser || !this.sw?.isEnabled || this.started || this.destroyed) return;
    this.started = true;
    let armed = false;
    const arm = (): void => {
      if (armed || this.destroyed) return;
      armed = true;
      clearTimeout(this.readyTimeout);
      this.check();
      this.interval = setInterval(() => this.check(), CHECK_INTERVAL_MS);
      this.doc.addEventListener('visibilitychange', this.onResume);
      this.doc.defaultView?.addEventListener('focus', this.onResume);
      this.doc.defaultView?.addEventListener('pageshow', this.onResume);
      this.doc.defaultView?.addEventListener('online', this.onOnline);
      navigator.serviceWorker?.addEventListener('controllerchange', this.onResume);
    };
    this.readyTimeout = setTimeout(arm, READY_TIMEOUT_MS);
    if (navigator.serviceWorker) {
      void navigator.serviceWorker.ready.then(arm, arm);
    } else {
      arm();
    }
  }

  private onVersion(event: VersionEvent): void {
    if (event.type === 'VERSION_READY') {
      this.available.set(true);
    } else if (event.type === 'NO_NEW_VERSION_DETECTED') {
      // "Already downloaded" does not mean that this window runs that build.
      const data = event.version.appData as { pwaBuildId?: unknown } | undefined;
      if (
        this.loadedBuildId &&
        typeof data?.pwaBuildId === 'string' &&
        data.pwaBuildId.length > 0 &&
        data.pwaBuildId !== this.loadedBuildId
      ) {
        this.available.set(true);
      }
    }
  }

  private readonly onResume = (): void => this.check();
  private readonly onOnline = (): void => this.check(true);

  private check(force = false): void {
    if (
      this.destroyed ||
      !this.sw?.isEnabled ||
      this.pending ||
      this.doc.visibilityState === 'hidden' ||
      navigator.onLine === false
    )
      return;
    const now = Date.now();
    if (!force && this.lastCheckAt !== undefined && now - this.lastCheckAt < CHECK_COOLDOWN_MS) {
      return;
    }
    this.lastCheckAt = now;
    const pending = { timeout: setTimeout(() => finish(), CHECK_TIMEOUT_MS) };
    const finish = (): void => {
      clearTimeout(pending.timeout);
      if (this.pending === pending) this.pending = undefined;
    };
    this.pending = pending;
    void this.sw
      .checkForUpdate()
      .then(
        (ready) => {
          if (!this.destroyed && ready) this.available.set(true);
        },
        () => {
          if (this.pending === pending) this.lastCheckAt = undefined;
        },
      )
      .finally(finish);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscription?.unsubscribe();
    clearInterval(this.interval);
    clearTimeout(this.readyTimeout);
    clearTimeout(this.pending?.timeout);
    this.doc.removeEventListener('visibilitychange', this.onResume);
    this.doc.defaultView?.removeEventListener('focus', this.onResume);
    this.doc.defaultView?.removeEventListener('pageshow', this.onResume);
    this.doc.defaultView?.removeEventListener('online', this.onOnline);
    if (this.browser)
      navigator.serviceWorker?.removeEventListener('controllerchange', this.onResume);
  }
}
