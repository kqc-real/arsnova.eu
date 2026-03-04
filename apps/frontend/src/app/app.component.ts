import {
  Component,
  ComponentRef,
  Directive,
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
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { SwUpdate } from '@angular/service-worker';
import { ThemePresetService } from './core/theme-preset.service';
import { PresetSnackbarFocusService } from './core/preset-snackbar-focus.service';
import { Subscription } from 'rxjs';
import { TopToolbarComponent } from './shared/top-toolbar/top-toolbar.component';

const STORAGE_PLAYFUL_WELCOMED = 'home-playful-welcomed';
const STORAGE_PWA_INSTALL_DISMISSED = 'pwa-install-dismissed';
const PWA_INSTALL_DISMISSED_DAYS = 7;

/** Browser-Event für „App installieren“ (PWA). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Directive({ selector: '[presetToastHost]', standalone: true })
class PresetToastHostDirective {
  readonly vcRef = inject(ViewContainerRef);
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatButton, MatIcon, TopToolbarComponent, PresetToastHostDirective],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  readonly year = new Date().getFullYear();
  isOnline = signal(true);
  updateAvailable = signal(false);
  presetSnackbarVisible = signal(false);
  presetToastVisible = signal(false);
  /** Einmalig beim ersten Wechsel auf Spielerisch: Snackbar-Text „Jetzt mit mehr Schwung!“ */
  firstTimePlayfulMessage = signal(false);
  /** PWA installierbar (beforeinstallprompt) – Snackbar-Hinweis v. a. für Mobile sichtbar. */
  installSnackbarVisible = signal(false);
  @ViewChild(PresetToastHostDirective) private presetToastHost?: PresetToastHostDirective;
  private presetToastRef: ComponentRef<unknown> | null = null;
  private snackbarTimer: ReturnType<typeof setTimeout> | null = null;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private beforeInstallPromptListener = (e: Event): void => this.onBeforeInstallPrompt(e as BeforeInstallPromptEvent);
  private appInstalledListener = (): void => this.onAppInstalled();

  readonly themePreset = inject(ThemePresetService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly focusService = inject(PresetSnackbarFocusService);
  private readonly router = inject(Router);
  private versionSub: Subscription | null = null;
  private routerSub: Subscription | null = null;

  /** true wenn gescrollt wurde (für stärkeren Schatten, Elevation). */
  hasScrolled = signal(false);
  /** Toolbar beim Runterscrollen ausblenden, beim Hochscrollen einblenden (UX-Empfehlung, alle Seiten). */
  toolbarHidden = signal(false);
  private lastScrollY = 0;
  private static readonly HIDE_SCROLL_THRESHOLD_PX = 80;

  presetSnackbarIcon = computed(() =>
    this.themePreset.preset() === 'serious' ? 'school' : 'celebration',
  );
  presetSnackbarLabel = computed(() => {
    if (this.firstTimePlayfulMessage() && this.themePreset.preset() === 'spielerisch') {
      return 'Jetzt mit mehr Schwung!';
    }
    return this.themePreset.preset() === 'serious' ? 'Preset: Seriös' : 'Preset: Spielerisch';
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isOnline.set(navigator.onLine);
      this.checkForUpdates();
      this.setupPwaInstallPrompt();
      this.routerSub = this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(() => this.toolbarHidden.set(false));
    }
  }

  ngOnDestroy(): void {
    this.versionSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('beforeinstallprompt', this.beforeInstallPromptListener);
      window.removeEventListener('appinstalled', this.appInstalledListener);
      if (isDevMode()) {
        window.removeEventListener('pwa-install-test', this.pwaInstallTestListener);
        delete (window as unknown as { __triggerPwaInstallHint?: () => void }).__triggerPwaInstallHint;
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
  }

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
  }

  @HostListener('window:offline')
  onOffline(): void {
    this.isOnline.set(false);
  }

  retryOnline(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (navigator.onLine) {
      this.isOnline.set(true);
    } else {
      window.location.reload();
    }
  }

  onPresetChanged(): void {
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

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.presetToastVisible()) {
      this.closePresetToast();
    }
  }
}
