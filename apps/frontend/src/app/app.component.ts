import {
  Component,
  ComponentRef,
  Directive,
  ElementRef,
  HostListener,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  ViewContainerRef,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatBadge } from '@angular/material/badge';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { SwUpdate } from '@angular/service-worker';
import { ThemePresetService } from './core/theme-preset.service';
import { PresetSnackbarFocusService } from './core/preset-snackbar-focus.service';
import { Subscription } from 'rxjs';
import { TopToolbarComponent } from './shared/top-toolbar/top-toolbar.component';
import { trpc } from './core/trpc.client';
import type { ServerStatsDTO } from '@arsnova/shared-types';
import { ServerStatusWidgetComponent } from './shared/server-status-widget/server-status-widget.component';
import { ServerStatusHelpDialogComponent } from './shared/server-status-help-dialog/server-status-help-dialog.component';
import { localizePath } from './core/locale-router';
import { HostDisplayModeService } from './core/host-display-mode.service';
import { SeoService } from './core/seo.service';
import { MotdHeaderStateService } from './core/motd-header-state.service';

const STORAGE_PLAYFUL_WELCOMED = 'home-playful-welcomed';
const STORAGE_PWA_INSTALL_DISMISSED = 'pwa-install-dismissed';
const PWA_INSTALL_DISMISSED_DAYS = 7;
/** Ohne regelmäßige `checkForUpdate()`-Aufrufe feuert `versionUpdates` nicht — Banner erscheint nie. */
const PWA_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Wenn `serviceWorker.ready` nicht zeitnah auflöst (selten), Polling trotzdem starten. */
const PWA_UPDATE_READY_FALLBACK_MS = 8_000;
const FOOTER_STATS_POLL_INTERVAL_MS = 30_000;

/** Browser-Event für „App installieren“ (PWA). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Directive({ selector: '[presetToastHost]', standalone: true })
class PresetToastHostDirective {
  readonly vcRef = inject(ViewContainerRef);
}

@Directive({ selector: '[connectionBannerHost]', standalone: true })
class ConnectionBannerHostDirective {
  readonly vcRef = inject(ViewContainerRef);
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    MatBadge,
    MatButton,
    MatIcon,
    TopToolbarComponent,
    PresetToastHostDirective,
    ConnectionBannerHostDirective,
    ServerStatusWidgetComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly localizedPath = localizePath;
  isOnline = signal(true);
  updateAvailable = signal(false);
  apiStatus = signal<string | null>(null);
  /**
   * Erst true, nachdem die erste Footer-Health-Abfrage im Browser beendet ist.
   * Solange false (SSR/Prerender + kurz beim Laden): kein „Keine Verbindung“ im HTML — sonst wirkt die Seite für Crawler/KI offline.
   */
  footerHealthCheckDone = signal(false);
  /** Erste Server-Stats aus health.footerBundle (kein zweiter sofortiger stats-Request im Widget). */
  footerStats = signal<ServerStatsDTO | null>(null);
  apiRetrying = signal(false);
  presetSnackbarVisible = signal(false);
  presetToastVisible = signal(false);
  /** Einmalig beim ersten Wechsel auf Spielerisch: Snackbar-Text „Jetzt noch schneller und flüssiger!“ */
  firstTimePlayfulMessage = signal(false);
  /** PWA installierbar (beforeinstallprompt) – Snackbar-Hinweis v. a. für Mobile sichtbar. */
  installSnackbarVisible = signal(false);
  @ViewChild(PresetToastHostDirective) private presetToastHost?: PresetToastHostDirective;
  @ViewChild(ConnectionBannerHostDirective)
  private connectionBannerHost?: ConnectionBannerHostDirective;
  @ViewChild('appFooter')
  set appFooterRef(value: ElementRef<HTMLElement> | undefined) {
    this._appFooterRef = value;
    if (isPlatformBrowser(this.platformId)) {
      queueMicrotask(() => this.syncFooterOffsetObserver());
    }
  }
  private presetToastRef: ComponentRef<unknown> | null = null;
  private connectionBannerRef: ComponentRef<unknown> | null = null;
  private snackbarTimer: ReturnType<typeof setTimeout> | null = null;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private beforeInstallPromptListener = (e: Event): void =>
    this.onBeforeInstallPrompt(e as BeforeInstallPromptEvent);
  private appInstalledListener = (): void => this.onAppInstalled();

  readonly themePreset = inject(ThemePresetService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly focusService = inject(PresetSnackbarFocusService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly hostDisplayMode = inject(HostDisplayModeService);
  private readonly seo = inject(SeoService);
  readonly motdHeaderState = inject(MotdHeaderStateService);
  private versionSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  private presetSub: Subscription | null = null;
  /** Browser: `setInterval` / `setTimeout` liefern `number` (nicht Node-`Timeout`). */
  private pwaUpdateIntervalId: number | null = null;
  private pwaUpdateReadyFallbackId: number | null = null;
  private footerStatsIntervalId: number | null = null;
  private pwaUpdatePollingArmed = false;
  private _appFooterRef?: ElementRef<HTMLElement>;
  private footerResizeObserver: ResizeObserver | null = null;
  private observedFooterElement: HTMLElement | null = null;

  /** true wenn gescrollt wurde (für stärkeren Schatten, Elevation). */
  hasScrolled = signal(false);
  /** Toolbar beim Runterscrollen ausblenden, beim Hochscrollen einblenden (UX-Empfehlung, alle Seiten). */
  toolbarHidden = signal(false);
  isFeedbackRoute = signal(
    typeof window !== 'undefined' &&
      (window.location.pathname.replace(/^\/(?:de|en|fr|it|es)(?=\/|$)/, '') || '/').startsWith(
        '/feedback/',
      ),
  );
  isPreviewRoute = signal(
    typeof window !== 'undefined' && this.matchesPreviewRoute(window.location.pathname),
  );
  private lastScrollY = 0;
  private static readonly HIDE_SCROLL_THRESHOLD_PX = 80;
  /** Erstes NavigationEnd = Bootstrap; kein Scroll-Reset — sonst kurzer Sprung „richtig → nach oben“ nach dem ersten Layout. */
  private pendingInitialNavigationEnd = true;

  presetSnackbarIcon = computed(() =>
    this.themePreset.preset() === 'serious' ? 'work' : 'celebration',
  );
  presetSnackbarLabel = computed(() => {
    if (this.firstTimePlayfulMessage() && this.themePreset.preset() === 'spielerisch') {
      return $localize`:@@7981911571029514989:Jetzt noch schneller und flüssiger!`;
    }
    return this.themePreset.preset() === 'serious'
      ? $localize`Preset: Seriös`
      : $localize`Preset: Spielerisch`;
  });
  footerRetryLabel = computed(() =>
    this.apiRetrying() ? $localize`Verbinde…` : $localize`Nochmal versuchen`,
  );
  /** Widget: vor Health-Check „Wird geladen…“, danach echtes Online/Offline. */
  footerConnectionOk = computed(() => !this.footerHealthCheckDone() || !!this.apiStatus());
  /** Offline-Styling + Retry nur nach abgeschlossenem Check und fehlgeschlagenem API-Status. */
  footerShowApiOffline = computed(() => this.footerHealthCheckDone() && !this.apiStatus());
  isImmersiveHostView = computed(() => this.hostDisplayMode.immersiveHostActive());
  footerVisible = computed(() => !this.isFeedbackRoute() && !this.isImmersiveHostView());
  footerVisibleOffset = signal(0);

  /** Footer: Badge mit ungelesenen Archiv-Meldungen (max. „99+“), wie Toolbar-Megafon. */
  footerNewsArchiveBadgeText = computed(() => {
    const n = this.motdHeaderState.archiveUnreadCount();
    return n > 99 ? '99+' : String(n);
  });

  /** Barrierefrei: Zähler in der Link-Beschriftung bei ungelesenen Meldungen. */
  footerNewsArchiveAria = computed(() => {
    const n = this.motdHeaderState.archiveUnreadCount();
    if (n <= 0) {
      return $localize`:@@app.footer.newsArchiveAria:News-Archiv öffnen`;
    }
    if (n === 1) {
      return $localize`:@@app.footer.newsArchiveAriaOne:News-Archiv öffnen, eine ungelesene Meldung`;
    }
    return $localize`:@@app.footer.newsArchiveAriaCount:News-Archiv öffnen, ${n}:INTERPOLATION: ungelesene Meldungen`;
  });

  ngOnInit(): void {
    this.seo.applyFromRouter();
    this.presetSub = this.themePreset.presetChanged$.subscribe(() => this.onPresetChanged());
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.seo.applyFromRouter();
        if (!isPlatformBrowser(this.platformId)) {
          return;
        }
        this.toolbarHidden.set(false);
        this.updateRouteFlags();
        queueMicrotask(() => this.syncFooterOffsetObserver());
        /* Nur bei Folge-Navigationen: #main-content scrollen (nicht window). Erstes Event überspringen — vermeidet sichtbares „Zucken“. */
        if (this.pendingInitialNavigationEnd) {
          this.pendingInitialNavigationEnd = false;
        } else {
          requestAnimationFrame(() => this.scrollPrimaryScrollContainerToTop());
        }
      });
    if (isPlatformBrowser(this.platformId)) {
      this.updateRouteFlags();
      this.isOnline.set(navigator.onLine);
      this.startFooterStatsPolling();
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => void this.checkApiConnection(), { timeout: 2000 });
        requestIdleCallback(() => void this.loadConnectionBanner(), { timeout: 2500 });
      } else {
        setTimeout(() => void this.checkApiConnection(), 0);
        setTimeout(() => void this.loadConnectionBanner(), 0);
      }
      this.checkForUpdates();
      this.setupPwaInstallPrompt();
    }
  }

  /** Layout: sichtbarer Inhalt scrollt in `#main-content` (.app-main), nicht auf document/window. */
  private scrollPrimaryScrollContainerToTop(): void {
    const el = document.getElementById('main-content');
    if (el) {
      el.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  ngOnDestroy(): void {
    this.versionSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.presetSub?.unsubscribe();
    this.connectionBannerRef?.destroy();
    this.connectionBannerRef = null;
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('visibilitychange', this.onDocumentVisibilityForPwaUpdate);
      if (this.pwaUpdateIntervalId !== null) {
        clearInterval(this.pwaUpdateIntervalId);
        this.pwaUpdateIntervalId = null;
      }
      if (this.pwaUpdateReadyFallbackId !== null) {
        clearTimeout(this.pwaUpdateReadyFallbackId);
        this.pwaUpdateReadyFallbackId = null;
      }
      if (this.footerStatsIntervalId !== null) {
        clearInterval(this.footerStatsIntervalId);
        this.footerStatsIntervalId = null;
      }
      this.disconnectFooterOffsetObserver();
      window.removeEventListener('beforeinstallprompt', this.beforeInstallPromptListener);
      window.removeEventListener('appinstalled', this.appInstalledListener);
      if (isDevMode()) {
        window.removeEventListener('pwa-install-test', this.pwaInstallTestListener);
        delete (window as unknown as { __triggerPwaInstallHint?: () => void })
          .__triggerPwaInstallHint;
      }
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const y = window.scrollY;
    this.hasScrolled.set(y > 0);
    if (y > this.lastScrollY && y > AppComponent.HIDE_SCROLL_THRESHOLD_PX) {
      this.toolbarHidden.set(true);
    } else if (y < this.lastScrollY) {
      this.toolbarHidden.set(false);
    }
    this.lastScrollY = y;
  }

  private checkForUpdates(): void {
    if (!this.swUpdate?.isEnabled) return;
    this.versionSub = this.swUpdate.versionUpdates.subscribe((evt) => {
      if (evt.type === 'VERSION_READY') this.updateAvailable.set(true);
    });

    const armPolling = (): void => {
      if (this.pwaUpdatePollingArmed) return;
      this.pwaUpdatePollingArmed = true;
      this.requestPwaUpdateCheck();
      this.pwaUpdateIntervalId = window.setInterval(
        () => this.requestPwaUpdateCheck(),
        PWA_UPDATE_CHECK_INTERVAL_MS,
      );
      document.addEventListener('visibilitychange', this.onDocumentVisibilityForPwaUpdate);
    };

    const clearReadyFallback = (): void => {
      if (this.pwaUpdateReadyFallbackId !== null) {
        clearTimeout(this.pwaUpdateReadyFallbackId);
        this.pwaUpdateReadyFallbackId = null;
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      this.pwaUpdateReadyFallbackId = window.setTimeout(() => {
        this.pwaUpdateReadyFallbackId = null;
        armPolling();
      }, PWA_UPDATE_READY_FALLBACK_MS);

      void navigator.serviceWorker.ready
        .then(() => {
          clearReadyFallback();
          armPolling();
        })
        .catch(() => {
          clearReadyFallback();
          armPolling();
        });
    } else {
      armPolling();
    }
  }

  private requestPwaUpdateCheck(): void {
    if (!this.swUpdate?.isEnabled) return;
    void this.swUpdate.checkForUpdate().catch(() => {
      /* offline, CORS oder kein SW — ignorieren */
    });
  }

  private readonly onDocumentVisibilityForPwaUpdate = (): void => {
    if (document.visibilityState !== 'visible') return;
    this.requestPwaUpdateCheck();
  };

  private setupPwaInstallPrompt(): void {
    if (this.isStandalone()) return;
    if (this.wasInstallDismissedRecently()) return;
    window.addEventListener('beforeinstallprompt', this.beforeInstallPromptListener);
    window.addEventListener('appinstalled', this.appInstalledListener);
    if (isDevMode()) {
      window.addEventListener('pwa-install-test', this.pwaInstallTestListener);
      /** In DevTools-Konsole ausführen: window.__triggerPwaInstallHint() – zeigt die PWA-Install-Snackbar zum Testen. */
      (window as unknown as { __triggerPwaInstallHint?: () => void }).__triggerPwaInstallHint =
        () => window.dispatchEvent(new CustomEvent('pwa-install-test'));
    }
  }

  private readonly pwaInstallTestListener = (): void => {
    const mock: BeforeInstallPromptEvent = {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    } as BeforeInstallPromptEvent;
    this.deferredInstallPrompt = mock;
    this.installSnackbarVisible.set(true);
  };

  private isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    );
  }

  private wasInstallDismissedRecently(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_PWA_INSTALL_DISMISSED);
      if (!raw) return false;
      const t = Number(raw);
      if (Number.isNaN(t)) return false;
      return Date.now() - t < PWA_INSTALL_DISMISSED_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  private onBeforeInstallPrompt(e: BeforeInstallPromptEvent): void {
    e.preventDefault();
    this.deferredInstallPrompt = e;
    this.installSnackbarVisible.set(true);
  }

  private onAppInstalled(): void {
    this.deferredInstallPrompt = null;
    this.installSnackbarVisible.set(false);
  }

  dismissInstallSnackbar(): void {
    this.installSnackbarVisible.set(false);
    try {
      localStorage.setItem(STORAGE_PWA_INSTALL_DISMISSED, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  async triggerInstall(): Promise<void> {
    if (!this.deferredInstallPrompt) return;
    try {
      await this.deferredInstallPrompt.prompt();
      const { outcome } = await this.deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') this.onAppInstalled();
      else this.dismissInstallSnackbar();
    } catch {
      this.dismissInstallSnackbar();
    }
  }

  async reloadWithUpdate(): Promise<void> {
    if (!this.swUpdate?.isEnabled) {
      window.location.reload();
      return;
    }
    try {
      await this.swUpdate.activateUpdate();
      // Kurz warten, damit der neue Service Worker die Kontrolle übernimmt.
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    } catch {
      // Bei Fehler trotzdem neu laden (z. B. kein Update mehr pending).
    }
    window.location.reload();
  }

  @HostListener('window:online')
  onOnline(): void {
    this.isOnline.set(true);
    this.requestPwaUpdateCheck();
    void this.checkApiConnection();
  }

  @HostListener('window:offline')
  onOffline(): void {
    this.isOnline.set(false);
    this.apiStatus.set(null);
    this.footerStats.set(null);
    this.footerHealthCheckDone.set(true);
  }

  retryOnline(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (navigator.onLine) {
      this.isOnline.set(true);
      void this.checkApiConnection();
    } else {
      window.location.reload();
    }
  }

  async checkApiConnection(): Promise<void> {
    try {
      const bundle = await trpc.health.footerBundle.query();
      this.apiStatus.set(bundle.check.status);
      this.footerStats.set(bundle.stats);
    } catch {
      this.apiStatus.set(null);
      this.footerStats.set(null);
    } finally {
      this.footerHealthCheckDone.set(true);
    }
  }

  private startFooterStatsPolling(): void {
    if (this.footerStatsIntervalId !== null) return;
    this.footerStatsIntervalId = window.setInterval(
      () => void this.checkApiConnection(),
      FOOTER_STATS_POLL_INTERVAL_MS,
    );
  }

  async retryApiConnection(): Promise<void> {
    this.apiRetrying.set(true);
    this.footerHealthCheckDone.set(false);
    await this.checkApiConnection();
    this.apiRetrying.set(false);
  }

  openServerStatusHelp(): void {
    this.dialog.open(ServerStatusHelpDialogComponent, {
      panelClass: 'app-status-help-dialog-panel',
      autoFocus: false,
      data: {
        connectionOk: this.footerConnectionOk(),
        loading: !this.footerHealthCheckDone(),
        stats: this.footerStats(),
      },
      width: 'min(54rem, calc(100vw - 2rem))',
      maxWidth: '100vw',
    });
  }

  onPresetChanged(): void {
    if (
      (this.router.url.replace(/^\/(?:de|en|fr|it|es)(?=\/|$)/, '') || '/').startsWith('/feedback/')
    )
      return;
    this.focusService.blurInput();
    const isPlayful = this.themePreset.preset() === 'spielerisch';
    const firstTime =
      isPlatformBrowser(this.platformId) &&
      isPlayful &&
      !localStorage.getItem(STORAGE_PLAYFUL_WELCOMED);
    this.firstTimePlayfulMessage.set(firstTime);
    if (firstTime && isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_PLAYFUL_WELCOMED, '1');
    }
    this.presetSnackbarVisible.set(true);
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
    const duration = firstTime ? 6000 : 5000;
    this.snackbarTimer = setTimeout(() => {
      this.presetSnackbarVisible.set(false);
      this.firstTimePlayfulMessage.set(false);
      this.focusService.refocusInput();
    }, duration);
  }

  dismissPresetSnackbar(refocus = true): void {
    this.presetSnackbarVisible.set(false);
    this.firstTimePlayfulMessage.set(false);
    if (this.snackbarTimer) {
      clearTimeout(this.snackbarTimer);
      this.snackbarTimer = null;
    }
    if (refocus) this.focusService.refocusInput();
  }

  openPresetCustomize(): void {
    this.focusService.blurInput();
    this.dismissPresetSnackbar(false);
    this.presetToastVisible.set(true);
    setTimeout(() => this.loadPresetToast(), 0);
  }

  closePresetToast(): void {
    if (this.presetToastRef) {
      this.presetToastRef.destroy();
      this.presetToastRef = null;
    }
    this.presetToastVisible.set(false);
    this.focusService.refocusInput();
  }

  private loadPresetToast(): void {
    if (this.presetToastRef || !this.presetToastHost) return;
    import('./shared/preset-toast/preset-toast.component').then((m) => {
      if (!this.presetToastHost || this.presetToastRef) return;
      const ref = this.presetToastHost.vcRef.createComponent(m.PresetToastComponent);
      (ref.instance as { closed: { subscribe: (fn: () => void) => void } }).closed.subscribe(() =>
        this.closePresetToast(),
      );
      this.presetToastRef = ref;
    });
  }

  private loadConnectionBanner(): void {
    if (this.connectionBannerRef || !this.connectionBannerHost) return;
    import('./shared/connection-banner/connection-banner.component').then((m) => {
      if (!this.connectionBannerHost || this.connectionBannerRef) return;
      this.connectionBannerRef = this.connectionBannerHost.vcRef.createComponent(
        m.ConnectionBannerComponent,
      );
    });
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.presetToastVisible()) {
      this.closePresetToast();
    }
  }

  private updateRouteFlags(): void {
    // Router-URL und window.location können bei NavigationEnd kurz auseinanderlaufen
    // (v. a. Mobile/Safari). Beide auswerten, damit Footer/Layout nach Klicks von der
    // Startseite zuverlässig zu /feedback/… passen.
    const routerPath = AppComponent.stripQueryAndHash(this.router.url);
    const windowPath = typeof window !== 'undefined' ? window.location.pathname : routerPath;
    const fromRouter = AppComponent.withoutLocalePath(routerPath);
    const fromWindow = AppComponent.withoutLocalePath(windowPath);
    this.isFeedbackRoute.set(
      fromRouter.startsWith('/feedback/') || fromWindow.startsWith('/feedback/'),
    );
    this.isPreviewRoute.set(
      this.matchesPreviewRoute(routerPath) || this.matchesPreviewRoute(windowPath),
    );
    if (!this.footerVisible()) {
      this.disconnectFooterOffsetObserver();
      this.footerVisibleOffset.set(0);
    }
  }

  private syncFooterOffsetObserver(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.footerVisible()) {
      this.disconnectFooterOffsetObserver();
      this.footerVisibleOffset.set(0);
      return;
    }
    const footer = this._appFooterRef?.nativeElement;
    if (!footer) {
      this.footerVisibleOffset.set(0);
      return;
    }
    this.footerVisibleOffset.set(Math.ceil(footer.getBoundingClientRect().height));
    if (typeof ResizeObserver === 'undefined') return;
    if (this.observedFooterElement === footer && this.footerResizeObserver) return;
    this.disconnectFooterOffsetObserver();
    this.footerResizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      this.footerVisibleOffset.set(Math.ceil(entry.contentRect.height));
    });
    this.footerResizeObserver.observe(footer);
    this.observedFooterElement = footer;
  }

  private disconnectFooterOffsetObserver(): void {
    this.footerResizeObserver?.disconnect();
    this.footerResizeObserver = null;
    this.observedFooterElement = null;
  }

  private static stripQueryAndHash(url: string): string {
    return url.split(/[?#]/)[0];
  }

  private static withoutLocalePath(path: string): string {
    const withSlash = path.startsWith('/') ? path : `/${path}`;
    return withSlash.replace(/^\/(?:de|en|fr|it|es)(?=\/|$)/, '') || '/';
  }

  private matchesPreviewRoute(pathname: string): boolean {
    return /\/quiz\/[^/]+\/preview\/?$/.test(pathname.replace(/^\/(?:de|en|fr|it|es)(?=\/|$)/, ''));
  }
}
