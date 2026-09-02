import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

export type ThemeValue = 'system' | 'dark' | 'light';
export type PresetValue = 'serious' | 'spielerisch';

/** Muss mit dem Inline-Skript in `index.html` übereinstimmen (FOUC vermeiden). */
const STORAGE_THEME = 'home-theme';
const STORAGE_PRESET = 'home-preset';
const PRESET_UPDATED_EVENT = 'arsnova:preset-updated';
const DEFAULT_THEME: ThemeValue = 'dark';
const THEME_COLOR_LIGHT = '#f5f5f5';
const THEME_COLOR_DARK = '#1c1b1f';

@Injectable({ providedIn: 'root' })
export class ThemePresetService {
  /** Dark als Default; Option System folgt weiterhin der OS-Einstellung. */
  readonly theme = signal<ThemeValue>(DEFAULT_THEME);
  readonly preset = signal<PresetValue>('spielerisch');

  /** Wird bei echten Preset-Wechseln ausgelöst, damit die App z. B. die Preset-Snackbar anzeigen kann. */
  private readonly presetChangedSource = new Subject<void>();
  readonly presetChanged$ = this.presetChangedSource.asObservable();

  private readonly platformId = inject(PLATFORM_ID);
  private readonly doc = inject(DOCUMENT);

  constructor() {
    this.initFromStorage();
  }

  private initFromStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedTheme = localStorage.getItem(STORAGE_THEME);
      if (storedTheme === 'system' || storedTheme === 'dark' || storedTheme === 'light') {
        this.theme.set(storedTheme);
      }

      const storedPreset = localStorage.getItem(STORAGE_PRESET);
      const preset = storedPreset === 'serioes' ? 'serious' : storedPreset; // Migration
      if (preset === 'serious' || preset === 'spielerisch') {
        this.preset.set(preset);
        if (preset !== storedPreset) localStorage.setItem(STORAGE_PRESET, preset);
      }
    }
    // Auch SSR/Prerender: Klassen am <html>, sonst fehlt preset-playful im statischen HTML → kurz „seriös“.
    this.applyTheme();
    this.applyPreset();
  }

  setTheme(value: ThemeValue): void {
    const unchanged = this.theme() === value;
    if (unchanged) {
      return;
    }
    this.theme.set(value);
    if (isPlatformBrowser(this.platformId)) localStorage.setItem(STORAGE_THEME, value);
    this.applyTheme();
    if (isPlatformBrowser(this.platformId))
      globalThis.dispatchEvent(new Event(PRESET_UPDATED_EVENT));
  }

  setPreset(value: PresetValue, options?: { silent?: boolean }): void {
    const unchanged = this.preset() === value;
    if (!unchanged) {
      this.preset.set(value);
      if (isPlatformBrowser(this.platformId)) localStorage.setItem(STORAGE_PRESET, value);
      this.applyPreset();
      if (isPlatformBrowser(this.platformId))
        globalThis.dispatchEvent(new Event(PRESET_UPDATED_EVENT));
    }
    // Kein presetChanged$ bei gleichem Wert — sonst Snackbar/Blur beim Start (z. B. saveAndClose, doppelte Aufrufe).
    if (!options?.silent && !unchanged) {
      this.presetChangedSource.next();
    }
  }

  private applyTheme(): void {
    const root = this.doc.documentElement;
    if (!root) return;
    root.classList.remove('dark', 'light');
    const selected = this.theme();
    if (selected === 'dark') {
      root.classList.add('dark');
    } else if (selected === 'light') {
      root.classList.add('light');
    }
    this.applyThemeColor(selected);
  }

  private applyThemeColor(selected: ThemeValue): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const metas = Array.from(this.doc.querySelectorAll('meta[name="theme-color"]'));
    if (metas.length === 0) {
      return;
    }
    if (selected === 'system') {
      for (const meta of metas) {
        const media = meta.getAttribute('media') ?? '';
        meta.setAttribute('content', media.includes('dark') ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
      }
      return;
    }
    const color = selected === 'light' ? THEME_COLOR_LIGHT : THEME_COLOR_DARK;
    for (const meta of metas) {
      meta.setAttribute('content', color);
    }
  }

  private applyPreset(): void {
    const root = this.doc.documentElement;
    if (!root) return;
    root.classList.toggle('preset-playful', this.preset() === 'spielerisch');
  }
}
