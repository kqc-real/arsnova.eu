import { Component, Input, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { ThemePresetService } from '../../core/theme-preset.service';
import { PresetSnackbarFocusService } from '../../core/preset-snackbar-focus.service';

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
  readonly themePreset = inject(ThemePresetService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly focusService = inject(PresetSnackbarFocusService);
  private readonly router = inject(Router);
  readonly showHomeLink = toSignal(
    this.router.events.pipe(map(() => this.router.url !== '/')),
    { initialValue: false },
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

  /** true wenn gescrollt wurde (stärkerer Schatten). */
  @Input() scrolled = false;
  /** Help/Legal: Toolbar fixiert, kann beim Runterscrollen ausgeblendet werden. */
  @Input() hideOnScroll = false;
  /** Bei hideOnScroll: Toolbar ausgeblendet (translateY -100%). */
  @Input() toolbarHidden = false;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(STORAGE_LANG);
      if (stored && ['de', 'en', 'fr', 'it', 'es'].includes(stored)) {
        this.language.set(stored as 'de' | 'en' | 'fr' | 'it' | 'es');
      }
    }
  }

  setLanguage(code: 'de' | 'en' | 'fr' | 'it' | 'es'): void {
    this.language.set(code);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_LANG, code);
    }
    this.closeControlsMenu();
    setTimeout(() => this.focusService.refocusInput(), 0);
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
}
