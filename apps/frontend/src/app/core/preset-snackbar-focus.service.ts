import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Ermöglicht der AppComponent, beim Anzeigen der Preset-Snackbar das fokussierte
 * Eingabefeld (z. B. Session-Code auf der Home-Seite) zu bluren, damit die virtuelle
 * Tastatur auf Mobile schließt und die Snackbar nicht überdeckt. Beim Schließen der
 * Snackbar kann optional wieder fokussiert werden.
 */
@Injectable({ providedIn: 'root' })
export class PresetSnackbarFocusService {
  private readonly platformId = inject(PLATFORM_ID);

  private inputRef: { nativeElement: HTMLInputElement } | null = null;

  registerInput(ref: { nativeElement: HTMLInputElement } | undefined): void {
    this.inputRef = ref ?? null;
  }

  /** Blur nur des registrierten Inputs (z. B. Session-Code), damit die virtuelle Tastatur schließt. */
  blurInput(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // Kein Fallback auf document.activeElement: sonst verliert z. B. der Desktop-Preset-Toggle
    // nach Pfeiltasten-Wechsel den Fokus, wenn kein Home-Input registriert ist (#180).
    this.inputRef?.nativeElement?.blur();
  }

  /**
   * Fokus auf das registrierte Input setzen (z. B. nach Snackbar-Dismiss oder Theme-Wechsel).
   * Kurze Verzögerung, damit nach Theme-/Preset-Umschaltung DOM/CSS fertig sind und der Fokus hält.
   * Kein Diebstahl, wenn der Fokus in der Toolbar, einem Material-Overlay oder dem MOTD-Dialog
   * liegt — bzw. wenn bereits ein anderes sinnvolles Element fokussiert ist.
   */
  refocusInput(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.inputRef?.nativeElement) return;
    const el = this.inputRef.nativeElement;
    setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof Element) {
        if (
          active.closest('app-top-toolbar') ||
          active.closest('.cdk-overlay-pane') ||
          active.closest('.home-motd-layer')
        ) {
          return;
        }
        if (
          active instanceof HTMLElement &&
          active !== document.body &&
          active !== document.documentElement &&
          active !== el
        ) {
          return;
        }
      }
      el.focus();
    }, 100);
  }
}
