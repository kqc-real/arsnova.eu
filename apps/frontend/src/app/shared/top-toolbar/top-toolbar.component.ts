import {
  Component,
  ElementRef,
  HostListener,
  Input,
  PLATFORM_ID,
  LOCALE_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { tryExitDocumentFullscreen } from '../../core/document-fullscreen.util';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { MatBadge } from '@angular/material/badge';
import { MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import type { AppLocale } from '@arsnova/shared-types';
import {
  getEffectiveLocale,
  getLocaleFromPath,
  HOME_LANGUAGE_LOCAL_STORAGE_KEY,
  localeIdToSupported,
  SUPPORTED_LOCALES,
} from '../../core/locale-from-path';
import { formatLocaleBadgeCount, formatLocaleCount } from '../../core/locale-number.util';
import { MotdHeaderStateService } from '../../core/motd-header-state.service';
import { MotdArchiveDialogComponent } from '../motd-archive-dialog/motd-archive-dialog.component';
import { ThemePresetService } from '../../core/theme-preset.service';
import { PresetSnackbarFocusService } from '../../core/preset-snackbar-focus.service';
import { LocaleSwitchGuardService } from '../../core/locale-switch-guard.service';
import { isAppHomeRouterUrl, localizePath } from '../../core/locale-router';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../confirm-leave-dialog/confirm-leave-dialog.component';
@Component({
  selector: 'app-top-toolbar',
  standalone: true,
  imports: [
    RouterLink,
    MatBadge,
    MatIconButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatIcon,
    MatTooltip,
  ],
  templateUrl: './top-toolbar.component.html',
  styleUrls: ['./top-toolbar.component.scss'],
})
export class TopToolbarComponent {
  @ViewChild('mobileControls') private mobileControls?: ElementRef<HTMLElement>;
  private controlsMenuTrigger: HTMLButtonElement | null = null;

  readonly localizedPath = localizePath;
  readonly themePreset = inject(ThemePresetService);
  readonly motdHeaderState = inject(MotdHeaderStateService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly localeId = inject(LOCALE_ID);
  private readonly document = inject(DOCUMENT);
  private readonly focusService = inject(PresetSnackbarFocusService);
  private readonly router = inject(Router);
  private readonly localeGuard = inject(LocaleSwitchGuardService);
  private readonly dialog = inject(MatDialog);
  readonly showHomeLink = toSignal(
    this.router.events.pipe(map(() => !isAppHomeRouterUrl(this.router.url))),
    { initialValue: !isAppHomeRouterUrl(this.router.url) },
  );

  readonly supportedLanguages = [
    { code: 'de' as const, label: 'Deutsch' },
    { code: 'en' as const, label: 'English' },
    { code: 'fr' as const, label: 'Français' },
    { code: 'it' as const, label: 'Italiano' },
    { code: 'es' as const, label: 'Español' },
  ];
  language = signal<'de' | 'en' | 'fr' | 'it' | 'es'>('de');
  controlsMenuOpen = signal(false);

  /** Badge-Text (max. „99+“). */
  readonly motdArchiveBadgeText = computed(() => {
    const n = this.motdHeaderState.archiveUnreadCount();
    return formatLocaleBadgeCount(n, this.localeId as string);
  });

  /** Barrierefrei: Zähler in der Beschriftung, wenn Archiv-Einträge existieren. */
  readonly motdArchiveAriaLabel = computed(() => {
    const n = this.motdHeaderState.archiveUnreadCount();
    if (n <= 0) {
      return $localize`:@@motd.toolbarArchiveAria:News und Archiv`;
    }
    if (n === 1) {
      return $localize`:@@motd.toolbarArchiveAriaOne:News und Archiv, eine ungelesene Meldung`;
    }
    return $localize`:@@motd.toolbarArchiveAriaCount:News und Archiv, ${formatLocaleCount(n, this.localeId as string)}:INTERPOLATION: ungelesene Meldungen`;
  });

  /** Kurzinfo beim Hover (unterscheidet ungelesene Meldungen). */
  readonly motdToolbarArchiveTooltip = computed(() => {
    const n = this.motdHeaderState.archiveUnreadCount();
    if (n <= 0) {
      return $localize`:@@motd.toolbarArchiveTooltip:News und Archiv`;
    }
    if (n === 1) {
      return $localize`:@@motd.toolbarArchiveTooltipUnreadOne:News und Archiv · 1 ungelesene Meldung`;
    }
    return $localize`:@@motd.toolbarArchiveTooltipUnreadCount:News und Archiv · ${formatLocaleCount(n, this.localeId as string)}:INTERPOLATION: ungelesene Meldungen`;
  });

  /** true wenn URL-Locale ≠ de, aber nur ein Build (z. B. Dev) → Hinweis anzeigen. */
  showSingleLocaleHint = signal(false);

  /** true wenn gescrollt wurde (stärkerer Schatten). */
  @Input() scrolled = false;
  /** Help/Legal: Toolbar fixiert, kann beim Runterscrollen ausgeblendet werden. */
  @Input() hideOnScroll = false;
  /** Bei hideOnScroll: Toolbar ausgeblendet (translateY -100%). */
  @Input() toolbarHidden = false;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const fromPath = getLocaleFromPath();
      if (fromPath) {
        this.language.set(fromPath);
        this.showSingleLocaleHint.set(
          fromPath !== 'de' && document.documentElement.getAttribute('lang') === 'de',
        );
      } else {
        const stored = localStorage.getItem(HOME_LANGUAGE_LOCAL_STORAGE_KEY);
        if (stored && SUPPORTED_LOCALES.includes(stored as (typeof SUPPORTED_LOCALES)[number])) {
          this.language.set(stored as 'de' | 'en' | 'fr' | 'it' | 'es');
        }
      }
    }
  }

  setLanguage(code: 'de' | 'en' | 'fr' | 'it' | 'es'): void {
    this.language.set(code);
    if (!isPlatformBrowser(this.platformId)) {
      this.closeControlsMenu();
      return;
    }
    localStorage.setItem(HOME_LANGUAGE_LOCAL_STORAGE_KEY, code);
    this.closeControlsMenu();

    const doRedirect = (): void => {
      const pathname = window.location.pathname;
      const hasLocale = /^\/(de|en|fr|it|es)(?:\/|$)/.test(pathname);
      if (hasLocale) {
        const newPath = pathname.replace(/^\/(de|en|fr|it|es)(?=\/|$)/, `/${code}`);
        window.location.href = newPath + window.location.search + window.location.hash;
      } else {
        const rest = pathname === '/' ? '' : pathname;
        window.location.href =
          `/${code}${rest || '/'}` + window.location.search + window.location.hash;
      }
    };

    if (this.localeGuard.hasUnsavedChanges()) {
      const data: ConfirmLeaveDialogData = {
        title: $localize`Sprache wechseln?`,
        message: $localize`Ungespeicherte Änderungen gehen verloren.`,
        consequences: [$localize`Quiz-Entwurf oder -Bearbeitung wird nicht gespeichert.`],
        confirmLabel: $localize`Trotzdem wechseln`,
        cancelLabel: $localize`Abbrechen`,
      };
      const dialogRef = this.dialog.open(ConfirmLeaveDialogComponent, {
        data,
        width: 'min(26rem, calc(100vw - 1.5rem))',
        maxWidth: '100vw',
        autoFocus: 'dialog',
      });
      firstValueFrom(dialogRef.afterClosed()).then((confirmed) => {
        if (confirmed === true) doRedirect();
      });
    } else {
      doRedirect();
    }
  }

  onThemeChange(value: 'system' | 'dark' | 'light'): void {
    const mobileMenuWasOpen = this.controlsMenuOpen();
    this.themePreset.setTheme(value);
    this.closeControlsMenu(mobileMenuWasOpen);
    if (!mobileMenuWasOpen) {
      setTimeout(() => this.focusService.refocusInput(), 0);
    }
  }

  setPreset(value: 'serious' | 'spielerisch', closeMenu = false): void {
    this.themePreset.setPreset(value);
    if (closeMenu) this.closeControlsMenu(true);
  }

  toggleControlsMenu(event?: Event): void {
    if (event?.currentTarget instanceof HTMLButtonElement) {
      this.controlsMenuTrigger = event.currentTarget;
    }
    if (this.controlsMenuOpen()) {
      this.closeControlsMenu();
      return;
    }
    this.controlsMenuOpen.set(true);
    setTimeout(() => {
      this.mobileControls?.nativeElement
        .querySelector<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    }, 0);
  }

  closeControlsMenu(restoreTriggerFocus = false): void {
    this.controlsMenuOpen.set(false);
    if (restoreTriggerFocus) {
      const trigger = this.controlsMenuTrigger;
      setTimeout(() => {
        if (trigger?.isConnected) {
          trigger.focus({ preventScroll: true });
        }
      }, 0);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  closeControlsMenuOnEscape(event: Event): void {
    if (!this.controlsMenuOpen()) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest('.cdk-overlay-pane')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.closeControlsMenu(true);
  }

  /** Logo/Brand: Vollbild verlassen (z. B. Host-Ansicht), Navigation bleibt über routerLink. */
  onBrandLinkClick(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    tryExitDocumentFullscreen(this.document);
  }

  openMotdArchive(): void {
    const locale = getEffectiveLocale(localeIdToSupported(this.localeId)) as AppLocale;
    this.dialog
      .open(MotdArchiveDialogComponent, {
        data: { locale },
        width: 'min(32rem, calc(100vw - 1.5rem))',
        maxWidth: '100vw',
        maxHeight: 'min(90dvh, calc(100vh - 2rem))',
        autoFocus: 'first-tabbable',
        panelClass: 'motd-archive-dialog-panel',
        backdropClass: 'motd-archive-dialog-backdrop',
      })
      .afterClosed()
      .subscribe(() => {
        if (isPlatformBrowser(this.platformId)) {
          void this.motdHeaderState.refresh();
        }
      });
  }
}
