import { Component, Input, PLATFORM_ID, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { tryExitDocumentFullscreen } from '../../core/document-fullscreen.util';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ThemePresetService } from '../../core/theme-preset.service';
import { PresetSnackbarFocusService } from '../../core/preset-snackbar-focus.service';
import { LocaleSwitchGuardService } from '../../core/locale-switch-guard.service';
import { getLocaleFromPath, SUPPORTED_LOCALES } from '../../core/locale-from-path';
import { localizePath } from '../../core/locale-router';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../confirm-leave-dialog/confirm-leave-dialog.component';

const STORAGE_LANG = 'home-language';

@Component({
  selector: 'app-top-toolbar',
  standalone: true,
  imports: [
    RouterLink,
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
  readonly localizedPath = localizePath;
  readonly themePreset = inject(ThemePresetService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly focusService = inject(PresetSnackbarFocusService);
  private readonly router = inject(Router);
  private readonly localeGuard = inject(LocaleSwitchGuardService);
  private readonly dialog = inject(MatDialog);
  readonly showHomeLink = toSignal(this.router.events.pipe(map(() => this.router.url !== '/')), {
    initialValue: false,
  });

  readonly supportedLanguages = [
    { code: 'de' as const, label: 'Deutsch' },
    { code: 'en' as const, label: 'English' },
    { code: 'fr' as const, label: 'Français' },
    { code: 'it' as const, label: 'Italiano' },
    { code: 'es' as const, label: 'Español' },
  ];
  language = signal<'de' | 'en' | 'fr' | 'it' | 'es'>('de');
  controlsMenuOpen = signal(false);

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
        const stored = localStorage.getItem(STORAGE_LANG);
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
    localStorage.setItem(STORAGE_LANG, code);
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
        width: '26rem',
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
    this.themePreset.setTheme(value);
    this.closeControlsMenu();
    setTimeout(() => this.focusService.refocusInput(), 0);
  }

  setPreset(value: 'serious' | 'spielerisch', closeMenu = false): void {
    this.themePreset.setPreset(value);
    if (closeMenu) this.closeControlsMenu();
  }

  toggleControlsMenu(): void {
    this.controlsMenuOpen.set(!this.controlsMenuOpen());
  }

  closeControlsMenu(): void {
    this.controlsMenuOpen.set(false);
  }

  /** Logo/Brand: Vollbild verlassen (z. B. Host-Ansicht), Navigation bleibt über routerLink. */
  onBrandLinkClick(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    tryExitDocumentFullscreen(this.document);
  }
}
