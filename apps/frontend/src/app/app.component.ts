import {
  ChangeDetectorRef,
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
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { SwUpdate } from '@angular/service-worker';
import { ThemePresetService } from './core/theme-preset.service';
import { PresetSnackbarFocusService } from './core/preset-snackbar-focus.service';
import { Subscription } from 'rxjs';
import { TopToolbarComponent } from './shared/top-toolbar/top-toolbar.component';
import { trpc } from './core/trpc.client';
import type { FooterStatusDTO, ServerStatsDTO } from '@arsnova/shared-types';
import { localizePath } from './core/locale-router';
import { INFO_LANDING_ANCHORS, infoLandingUrl } from './core/info-landing-url';
import { HostDisplayModeService } from './core/host-display-mode.service';
import { SeoService } from './core/seo.service';
import {
  resolveFooterStatusColor,
  resolveFooterStatusDotCssColor,
} from './shared/server-status-widget/footer-status-color';
import {
  clearStaleContentPageFocusReturn,
  consumeContentPageFocusReturn,
  focusFooterContentReturn,
  isContentOverlayPath,
  rememberNonOverlayPath,
} from './shared/content-page-nav';

const STORAGE_PLAYFUL_WELCOMED = 'home-playful-welcomed';
const STORAGE_PWA_INSTALL_DISMISSED = 'pwa-install-dismissed';
const DEV_SERVICE_WORKER_RESET_MARKER = 'dev-service-worker-reset-v1';
const PWA_INSTALL_DISMISSED_DAYS = 7;
/** Ohne regelmäßige `checkForUpdate()`-Aufrufe feuert `versionUpdates` nicht — Banner erscheint nie. */
const PWA_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Wenn `serviceWorker.ready` nicht zeitnah auflöst (selten), Polling trotzdem starten. */
const PWA_UPDATE_READY_FALLBACK_MS = 8_000;
const FOOTER_STATUS_POLL_INTERVAL_MS = 5 * 60 * 1000;
const FOOTER_STATS_DIALOG_REFRESH_MS = 30_000;

type DailyHighscorePoint = ServerStatsDTO['dailyHighscores'][number];

/** Browser-Event für „App installieren“ (PWA). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type AppDevWindow = Window & {
  __triggerPwaInstallHint?: () => void;
  __triggerUpdateBanner?: () => void;
};

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
    MatButton,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    TopToolbarComponent,
    PresetToastHostDirective,
    ConnectionBannerHostDirective,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly localizedPath = localizePath;
  readonly themePreset = inject(ThemePresetService);
  /** Footer-Deep-Link zur Informationsseite (Features); Theme reaktiv (Issue #207). */
  readonly infoLandingFeaturesUrl = computed(() =>
    infoLandingUrl(INFO_LANDING_ANCHORS.features, undefined, this.themePreset.theme()),
  );
  isOnline = signal(true);
  updateAvailable = signal(false);
  updateReloading = signal(false);
  apiStatus = signal<string | null>(null);
  /**
   * Erst true, nachdem die erste Footer-Health-Abfrage im Browser beendet ist.
   * Solange false (SSR/Prerender + kurz beim Laden): kein „Keine Verbindung“ im HTML — sonst wirkt die Seite für Crawler/KI offline.
   */
  footerHealthCheckDone = signal(false);
  /** Schlanker Footer-Status für den grünen Punkt. */
  footerStatus = signal<FooterStatusDTO | null>(null);
  /** Detaillierte Server-Stats nur für den Hilfedialog. */
  footerStats = signal<ServerStatsDTO | null>(null);
  footerStatsLoading = signal(false);
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
  @ViewChild('footerMoreTrigger') private footerMoreTrigger?: MatMenuTrigger;
  @ViewChild('footerMoreButton', { read: ElementRef })
  private footerMoreButton?: ElementRef<HTMLButtonElement>;
  private footerMoreFocusGraceTimer: number | null = null;
  /** Escape hat das Footer-Mehr-Menü geschlossen → Fokus muss auf den Auslöser. */
  private footerMoreClosedByEscape = false;
  private readonly footerMoreEscapeCapture = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.footerMoreTrigger?.menuOpen) {
      this.footerMoreClosedByEscape = true;
    }
  };
  private presetToastRef: ComponentRef<unknown> | null = null;
  private connectionBannerRef: ComponentRef<unknown> | null = null;
  private snackbarTimer: ReturnType<typeof setTimeout> | null = null;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private beforeInstallPromptListener = (e: Event): void =>
    this.onBeforeInstallPrompt(e as BeforeInstallPromptEvent);
  private appInstalledListener = (): void => this.onAppInstalled();

  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly focusService = inject(PresetSnackbarFocusService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly hostDisplayMode = inject(HostDisplayModeService);
  private readonly seo = inject(SeoService);
  private versionSub: Subscription | null = null;
  private routerSub: Subscription | null = null;
  private presetSub: Subscription | null = null;
  /** Browser: `setInterval` / `setTimeout` liefern `number` (nicht Node-`Timeout`). */
  private pwaUpdateIntervalId: number | null = null;
  private pwaUpdateReadyFallbackId: number | null = null;
  private footerStatusIntervalId: number | null = null;
  private footerStatsLoadedAt = 0;
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
  footerStatusPollingSuppressedRoute = signal(
    typeof window !== 'undefined' &&
      this.matchesFooterStatusPollingSuppressedRoute(window.location.pathname),
  );
  /** Hilfe/Legal/News-Archiv: Overlay-Optik — App-Chrome per inert aus der Tab-Reihenfolge. */
  isContentOverlayRoute = signal(
    typeof window !== 'undefined' && isContentOverlayPath(window.location.pathname),
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
  serverStatusWidgetVisible = computed(
    () => this.footerVisible() && !this.footerStatusPollingSuppressedRoute(),
  );
  footerVisibleOffset = signal(0);

  /**
   * Ampelfarbe für den Betriebsstatus-Eintrag im Mehr-Menü.
   * Gemeinsame Quelle: resolveFooterStatusColor (auch ServerStatusWidget).
   */
  footerStatusColor = computed(() =>
    resolveFooterStatusColor(
      this.footerConnectionOk(),
      !this.footerHealthCheckDone(),
      this.footerStatus(),
    ),
  );

  /**
   * Inline-Farbe für den Status-Dot im Mat-Menu-Overlay.
   * Klassen allein verlieren gegen `.mat-mdc-menu-item .mat-icon`; das Overlay
   * liegt außerhalb von `:host`, daher greifen host-scoped ::ng-deep-Regeln nicht.
   */
  footerStatusDotCssColor = computed(() =>
    resolveFooterStatusDotCssColor(this.footerStatusColor()),
  );

  ngOnInit(): void {
    this.seo.applyFromRouter();
    if (isPlatformBrowser(this.platformId)) {
      // Vor Router-Events: kein veralteter Footer-Fokus nach Reload/Locale-Redirect.
      clearStaleContentPageFocusReturn();
      // Capture: Flag setzen bevor Material das Menü schließt (HostListener wäre zu spät).
      document.addEventListener('keydown', this.footerMoreEscapeCapture, true);
    }
    this.presetSub = this.themePreset.presetChanged$.subscribe(() => this.onPresetChanged());
    this.routerSub = this.router.events
      .pipe(
        filter(
          (e): e is NavigationEnd | NavigationCancel | NavigationError =>
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError,
        ),
      )
      .subscribe((event) => {
        if (!(event instanceof NavigationEnd)) {
          // Abbruch/Fehler: Footer-Fokus-Marker nicht über die Navigation hinaus behalten.
          if (isPlatformBrowser(this.platformId)) {
            clearStaleContentPageFocusReturn();
          }
          return;
        }
        this.seo.applyFromRouter();
        if (!isPlatformBrowser(this.platformId)) {
          return;
        }
        // Mehr-Menü liegt im CDK-Overlay (nicht inert) — bei Navigation schließen.
        this.footerMoreTrigger?.closeMenu();
        this.toolbarHidden.set(false);
        this.updateRouteFlags();
        this.refreshFooterStatusPollingState({ immediate: true });
        queueMicrotask(() => this.syncFooterOffsetObserver());
        /* Nur bei Folge-Navigationen: #main-content scrollen (nicht window). Erstes Event überspringen — vermeidet sichtbares „Zucken“. */
        if (this.pendingInitialNavigationEnd) {
          this.pendingInitialNavigationEnd = false;
          // Bootstrap: kein Footer-Fokus (HMR/bfcache/Trap). Skip-Link bleibt erster Tab-Stop.
          clearStaleContentPageFocusReturn();
          queueMicrotask(() => this.blurFooterIfFocused());
        } else if (!event.urlAfterRedirects.includes('#')) {
          requestAnimationFrame(() => {
            this.scrollPrimaryScrollContainerToTop();
            // Content-Overlay-Seiten setzen Fokus selbst (cdkFocusInitial auf „Zurück“).
            // Overlay→Overlay: Marker verwerfen; Chrome-inert bleibt über Angular-Binding.
            if (this.isContentOverlayRoute()) {
              clearStaleContentPageFocusReturn();
              return;
            }
            // Rückkehr aus Hilfe/Legal/News-Archiv: Footer-Link statt Hero-H1.
            if (this.restoreContentPageFocusReturn()) {
              return;
            }
            this.focusPrimaryContent();
          });
        }
      });
    if (isPlatformBrowser(this.platformId)) {
      void this.resetDevServiceWorkerState();
      this.updateRouteFlags();
      this.isOnline.set(navigator.onLine);
      document.addEventListener(
        'visibilitychange',
        this.onDocumentVisibilityForFooterStatusPolling,
      );
      this.refreshFooterStatusPollingState();
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => void this.loadConnectionBanner(), { timeout: 2500 });
      } else {
        setTimeout(() => void this.loadConnectionBanner(), 0);
      }
      this.scheduleNonCriticalStartupWork();
      this.setupPwaInstallPrompt();
    }
  }

  /** Footer-Health, MOTD-Header und PWA-Update-Checks nach dem kritischen Erstload. */
  private scheduleNonCriticalStartupWork(): void {
    const run = (): void => {
      this.refreshFooterStatusPollingState({ immediate: true });
      this.checkForUpdates();
    };
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, 100);
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

  skipToMainContent(event: Event): void {
    event.preventDefault();
    const main = document.getElementById('main-content');
    if (!main) {
      return;
    }
    main.scrollTop = 0;
    main.focus({ preventScroll: true });
  }

  /** Folge-Navigationen werden für Tastatur und Screenreader am neuen Seitenanfang verankert. */
  private focusPrimaryContent(): void {
    const main = document.getElementById('main-content');
    if (!main) {
      return;
    }

    const heading = main.querySelector<HTMLElement>('h1:not([hidden]):not([aria-hidden="true"])');
    const target = heading ?? main;
    const addedProgrammaticTabindex = target !== main && !target.hasAttribute('tabindex');
    if (addedProgrammaticTabindex) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener(
        'blur',
        () => {
          if (target.getAttribute('tabindex') === '-1') {
            target.removeAttribute('tabindex');
          }
        },
        { once: true },
      );
    }

    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  }

  /** Verhindert, dass Bootstrap/HMR den Fokus im Footer lässt (Skip-Link zuerst). */
  private blurFooterIfFocused(): void {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return;
    }
    if (!active.closest('footer.app-footer')) {
      return;
    }
    active.blur();
  }

  /**
   * Nach Schließen von Hilfe/Legal/News-Archiv: Fokus zurück auf den Footer-Link.
   * Nur wenn ein Dismiss in dieser Navigation `markContentPageFocusReturn` gesetzt hat.
   */
  private restoreContentPageFocusReturn(): boolean {
    const target = consumeContentPageFocusReturn();
    if (!target) {
      return false;
    }
    this.cdr.detectChanges();
    return focusFooterContentReturn(target);
  }

  showToolbarForFocus(): void {
    this.toolbarHidden.set(false);
  }

  /**
   * Dev-Server auf `localhost` und frühere PWA-/Preview-Server teilen sich dieselbe Origin.
   * Ein alter ngsw kann deshalb weiterhin alte Chunks oder Responses liefern, obwohl `ng serve`
   * längst neuen Code baut. Im Dev-Modus räumen wir alte Registrierungen/Caches einmalig weg und
   * laden danach neu.
   */
  private async resetDevServiceWorkerState(): Promise<void> {
    if (!isDevMode()) return;
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (!this.isLocalDevHost(window.location.hostname)) return;

    const hadController = !!navigator.serviceWorker.controller;
    let changed = false;

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        changed = (await registration.unregister()) || changed;
      }
    } catch {
      /* ignore */
    }

    if (typeof caches !== 'undefined') {
      try {
        const cacheKeys = await caches.keys();
        for (const cacheKey of cacheKeys) {
          changed = (await caches.delete(cacheKey)) || changed;
        }
      } catch {
        /* ignore */
      }
    }

    if (!changed || !hadController) return;

    try {
      if (sessionStorage.getItem(DEV_SERVICE_WORKER_RESET_MARKER) === '1') return;
      sessionStorage.setItem(DEV_SERVICE_WORKER_RESET_MARKER, '1');
    } catch {
      /* ignore */
    }

    window.location.reload();
  }

  private isLocalDevHost(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  }

  ngOnDestroy(): void {
    this.versionSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.presetSub?.unsubscribe();
    this.connectionBannerRef?.destroy();
    this.connectionBannerRef = null;
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
    this.clearFooterMoreFocusGraceTimers();
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('keydown', this.footerMoreEscapeCapture, true);
      document.removeEventListener('visibilitychange', this.onDocumentVisibilityForPwaUpdate);
      document.removeEventListener(
        'visibilitychange',
        this.onDocumentVisibilityForFooterStatusPolling,
      );
      if (this.pwaUpdateIntervalId !== null) {
        clearInterval(this.pwaUpdateIntervalId);
        this.pwaUpdateIntervalId = null;
      }
      if (this.pwaUpdateReadyFallbackId !== null) {
        clearTimeout(this.pwaUpdateReadyFallbackId);
        this.pwaUpdateReadyFallbackId = null;
      }
      this.stopFooterStatusPolling();
      this.disconnectFooterOffsetObserver();
      window.removeEventListener('beforeinstallprompt', this.beforeInstallPromptListener);
      window.removeEventListener('appinstalled', this.appInstalledListener);
      if (isDevMode()) {
        window.removeEventListener('pwa-install-test', this.pwaInstallTestListener);
        delete (window as AppDevWindow).__triggerPwaInstallHint;
        delete (window as AppDevWindow).__triggerUpdateBanner;
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
      window.addEventListener('pwa-update-test', this.pwaUpdateTestListener);
      /** In DevTools-Konsole ausführen: window.__triggerPwaInstallHint() – zeigt die PWA-Install-Snackbar zum Testen. */
      (window as AppDevWindow).__triggerPwaInstallHint = () =>
        window.dispatchEvent(new CustomEvent('pwa-install-test'));
      /** In DevTools-Konsole ausführen: window.__triggerUpdateBanner() – zeigt den Update-Banner zum Testen. */
      (window as AppDevWindow).__triggerUpdateBanner = () =>
        window.dispatchEvent(new CustomEvent('pwa-update-test'));
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

  private readonly pwaUpdateTestListener = (): void => {
    this.updateAvailable.set(true);
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

  reloadWithUpdate(): void {
    if (this.updateReloading()) return;
    this.updateReloading.set(true);
    /*
     * `activateUpdate()` wuerde den laufenden Tab ohne Neustart auf die neue
     * SW-Version umhaengen. In Live-Sessions ist der vollstaendige Reload die
     * stabile Grenze gegen gemischte App-Shell-/Chunk-Versionen.
     */
    this.reloadPage();
  }

  private reloadPage(): void {
    window.location.reload();
  }

  @HostListener('window:online')
  onOnline(): void {
    this.isOnline.set(true);
    this.requestPwaUpdateCheck();
    this.refreshFooterStatusPollingState({ immediate: true });
  }

  @HostListener('window:offline')
  onOffline(): void {
    this.isOnline.set(false);
    this.apiStatus.set(null);
    this.footerStatus.set(null);
    this.footerStats.set(null);
    this.footerHealthCheckDone.set(true);
    this.stopFooterStatusPolling();
  }

  retryOnline(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (navigator.onLine) {
      this.isOnline.set(true);
      this.refreshFooterStatusPollingState({ immediate: true });
    } else {
      window.location.reload();
    }
  }

  async checkApiConnection(): Promise<void> {
    try {
      const bundle = await trpc.health.footerBundle.query();
      this.apiStatus.set(bundle.check.status);
      this.footerStatus.set(bundle.stats);
    } catch {
      this.apiStatus.set(null);
      this.footerStatus.set(null);
    } finally {
      this.footerHealthCheckDone.set(true);
    }
  }

  private startFooterStatusPolling(): void {
    if (this.footerStatusIntervalId !== null) return;
    this.footerStatusIntervalId = window.setInterval(
      () => void this.checkApiConnection(),
      FOOTER_STATUS_POLL_INTERVAL_MS,
    );
  }

  private stopFooterStatusPolling(): void {
    if (this.footerStatusIntervalId !== null) {
      clearInterval(this.footerStatusIntervalId);
      this.footerStatusIntervalId = null;
    }
  }

  private canPollFooterStatus(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    if (!this.serverStatusWidgetVisible()) return false;
    if (!navigator.onLine) return false;
    return document.visibilityState === 'visible';
  }

  private refreshFooterStatusPollingState(options?: { immediate?: boolean }): void {
    if (!this.canPollFooterStatus()) {
      this.stopFooterStatusPolling();
      return;
    }
    this.startFooterStatusPolling();
    if (options?.immediate) {
      void this.checkApiConnection();
    }
  }

  private readonly onDocumentVisibilityForFooterStatusPolling = (): void => {
    this.refreshFooterStatusPollingState({ immediate: document.visibilityState === 'visible' });
  };

  private decorateFooterStatsForLocalVisualCheck(stats: ServerStatsDTO): ServerStatsDTO {
    if (!isDevMode()) return stats;
    if (typeof window === 'undefined') return stats;
    if (!this.isLocalDevHost(window.location.hostname)) return stats;

    const dailyHighscores = this.buildLocalDevDailyHighscores(stats.dailyHighscores);
    const hasPersistedHistory =
      stats.dailyHighscoresStatistics.max > 0 ||
      stats.dailyHighscores.some((entry) => entry.count > 0);

    return {
      ...stats,
      dailyHighscores,
      dailyHighscoresStatistics: hasPersistedHistory
        ? stats.dailyHighscoresStatistics
        : this.calculateDailyHighscoresStatistics(dailyHighscores),
    };
  }

  private buildLocalDevDailyHighscores(
    points: ServerStatsDTO['dailyHighscores'],
  ): ServerStatsDTO['dailyHighscores'] {
    const peak = Math.max(...points.map((entry) => entry.count), 0);
    const upperBound = Math.max(peak, 120);
    const floor = Math.max(12, Math.round(upperBound * 0.2));

    return points.map((entry, index) => {
      const wave = Math.sin(index / 5.2) * upperBound * 0.18;
      const waveB = Math.cos(index / 8.4) * upperBound * 0.08;
      const staircase = (index % 9) * (upperBound * 0.018);
      const pulse = index % 17 === 0 ? upperBound * 0.16 : index % 13 === 0 ? upperBound * 0.09 : 0;
      const trend = Math.floor(index / 20) * (upperBound * 0.028);
      const count = Math.max(floor, Math.round(floor + wave + waveB + staircase + pulse + trend));

      return {
        ...entry,
        count,
        updatedAt: `${entry.date}T12:00:00.000Z`,
      } satisfies DailyHighscorePoint;
    }) as ServerStatsDTO['dailyHighscores'];
  }

  private calculateDailyHighscoresStatistics(
    points: ServerStatsDTO['dailyHighscores'],
  ): ServerStatsDTO['dailyHighscoresStatistics'] {
    const counts = points.map((entry) => entry.count).sort((left, right) => left - right);
    if (!counts.length) {
      return { median: 0, standardDeviation: 0, max: 0 };
    }

    const middle = Math.floor(counts.length / 2);
    const median =
      counts.length % 2 === 0 ? (counts[middle - 1] + counts[middle]) / 2 : counts[middle];
    const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + (count - mean) ** 2, 0) / counts.length;

    return {
      median: Math.round(median),
      standardDeviation: Math.round(Math.sqrt(variance)),
      max: counts[counts.length - 1],
    };
  }

  private async loadFooterStats(options?: { forceFresh?: boolean }): Promise<void> {
    if (this.footerStatsLoading()) return;

    const forceFresh = options?.forceFresh === true;
    if (
      !forceFresh &&
      this.footerStats() &&
      Date.now() - this.footerStatsLoadedAt < FOOTER_STATS_DIALOG_REFRESH_MS
    ) {
      return;
    }

    this.footerStatsLoading.set(true);
    try {
      const stats = await trpc.health.stats.query();
      this.footerStats.set(this.decorateFooterStatsForLocalVisualCheck(stats));
      this.footerStatsLoadedAt = Date.now();
    } catch {
      this.footerStats.set(null);
    } finally {
      this.footerStatsLoading.set(false);
    }
  }

  async retryApiConnection(): Promise<void> {
    this.apiRetrying.set(true);
    this.footerHealthCheckDone.set(false);
    await this.checkApiConnection();
    this.apiRetrying.set(false);
  }

  /**
   * Nach Escape-Schließen des Footer-Mehr-Menüs Fokus auf den Auslöser sichern.
   * Material-restoreFocus kann gegen Skip-Link-/MOTD-Fokus verlieren (a11y:layout /de/).
   */
  onFooterMoreMenuClosed(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const closedByEscape = this.footerMoreClosedByEscape;
    this.footerMoreClosedByEscape = false;
    if (!closedByEscape) return;
    this.clearFooterMoreFocusGraceTimers();
    const run = (): void => this.ensureFooterMoreFocusAfterEscape();
    queueMicrotask(run);
    this.footerMoreFocusGraceTimer = window.setTimeout(run, 0);
  }

  private clearFooterMoreFocusGraceTimers(): void {
    if (this.footerMoreFocusGraceTimer !== null) {
      window.clearTimeout(this.footerMoreFocusGraceTimer);
      this.footerMoreFocusGraceTimer = null;
    }
  }

  private ensureFooterMoreFocusAfterEscape(): void {
    if (typeof document === 'undefined') return;
    if (this.footerMoreTrigger?.menuOpen) return;
    const more =
      this.footerMoreButton?.nativeElement ??
      document.querySelector<HTMLButtonElement>('button[data-footer-focus="footer-more"]');
    if (!more?.isConnected) return;
    if (document.activeElement === more) return;
    const active = document.activeElement;
    // Nur einen im schließenden Overlay verlorenen Fokus reparieren. Sobald eine Person
    // bereits ein anderes, verbundenes Ziel fokussiert hat, darf der Grace-Callback diesen
    // Fokus nicht wieder zum Footer zurückholen.
    const activeIsTransient =
      active === null ||
      active === document.body ||
      active === document.documentElement ||
      (active instanceof Element &&
        (!active.isConnected ||
          Boolean(active.closest('.mat-mdc-menu-panel, .mat-mdc-menu-content'))));
    if (!activeIsTransient) {
      return;
    }
    try {
      more.focus({ preventScroll: true });
    } catch {
      more.focus();
    }
  }

  /** Betriebsstatus aus dem Mehr-Menü: Menü schließen, Dialog öffnen, Fokus zu „Mehr“. */
  openServerStatusFromMore(): void {
    this.footerMoreTrigger?.closeMenu();
    void this.openServerStatusHelp();
  }

  async openServerStatusHelp(): Promise<void> {
    const { ServerStatusHelpDialogComponent } =
      await import('./shared/server-status-help-dialog/server-status-help-dialog.component');

    const ref = this.dialog.open(ServerStatusHelpDialogComponent, {
      panelClass: 'app-status-help-dialog-panel',
      autoFocus: false,
      restoreFocus: false,
      data: {
        connectionOk: this.footerConnectionOk,
        loading: computed(() => this.footerStatsLoading()),
        stats: this.footerStats,
      },
      width: 'min(54rem, calc(100vw - 2rem))',
      maxWidth: '100vw',
    });
    ref.afterClosed().subscribe(() => {
      this.focusFooterMoreAfterStatusDialog();
    });
    void this.loadFooterStats({ forceFresh: true });
  }

  /**
   * Fokus nach Betriebsstatus-Dialog nur auf ein noch lebendiges Mehr-Target.
   * Bei Navigation weg vom Footer (Feedback/immersiv) kein Fokus auf detached Nodes.
   */
  private focusFooterMoreAfterStatusDialog(): void {
    if (typeof document === 'undefined') return;
    const more = document.querySelector<HTMLElement>('button[data-footer-focus="footer-more"]');
    // footerVisible deckt Feedback-/immersive Host-Routen ab; isConnected/inert den Detach-Fall.
    const usable =
      !!more &&
      more.isConnected &&
      !more.closest('[inert]') &&
      this.footerVisible() &&
      getComputedStyle(more).visibility !== 'hidden' &&
      getComputedStyle(more).display !== 'none';
    if (usable && more) {
      try {
        more.focus({ preventScroll: true });
      } catch {
        more.focus();
      }
      return;
    }
    if (!this.isContentOverlayRoute()) {
      this.focusPrimaryContent();
    }
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
    if (this.footerMoreTrigger?.menuOpen) {
      this.footerMoreClosedByEscape = true;
    }
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
    this.footerStatusPollingSuppressedRoute.set(
      this.matchesFooterStatusPollingSuppressedRoute(routerPath) ||
        this.matchesFooterStatusPollingSuppressedRoute(windowPath),
    );
    this.isPreviewRoute.set(
      this.matchesPreviewRoute(routerPath) || this.matchesPreviewRoute(windowPath),
    );
    this.isContentOverlayRoute.set(
      isContentOverlayPath(fromRouter) || isContentOverlayPath(fromWindow),
    );
    if (!this.isContentOverlayRoute()) {
      rememberNonOverlayPath(fromRouter || fromWindow);
    }
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

  private matchesFooterStatusPollingSuppressedRoute(pathname: string): boolean {
    const normalized = pathname.replace(/^\/(?:de|en|fr|it|es)(?=\/|$)/, '') || '/';
    return (
      normalized.startsWith('/join/') ||
      normalized.startsWith('/feedback/') ||
      /^\/session\/[^/]+(?:\/(?:host|present|vote))?\/?$/.test(normalized)
    );
  }
}
