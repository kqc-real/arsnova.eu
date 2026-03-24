import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

/** Muss mit dem Inline-Skript in `index.html` übereinstimmen (FOUC vermeiden). */
const STORAGE_THEME = 'home-theme';
const STORAGE_PRESET = 'home-preset';
const PRESET_UPDATED_EVENT = 'arsnova:preset-updated';

export type ThemeValue = 'system' | 'dark' | 'light';
export type PresetValue = 'serious' | 'spielerisch';

@Injectable({ providedIn: 'root' })
export class ThemePresetService {
  /** System als Default: folgt der OS-Einstellung (Apple/UX-Best-Practice), Fallback-Verhalten bei fehlender Preference bleibt light. */
  readonly theme = signal<ThemeValue>('system');
  readonly preset = signal<PresetValue>('spielerisch');

  /** Wird bei jedem setPreset() ausgelöst, damit die App z. B. die Preset-Snackbar anzeigen kann (Toolbar + Hero-Toggle). */
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
    }
    if (isPlatformBrowser(this.platformId))
      globalThis.dispatchEvent(new Event(PRESET_UPDATED_EVENT));
    if (!options?.silent) {
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
  }

  private applyPreset(): void {
    const root = this.doc.documentElement;
    if (!root) return;
    root.classList.toggle('preset-playful', this.preset() === 'spielerisch');
  }
}
