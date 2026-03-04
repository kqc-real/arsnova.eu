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

  /** Blur des registrierten Inputs, damit auf Mobile die virtuelle Tastatur schließt. */
  blurInput(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.inputRef?.nativeElement) {
      this.inputRef.nativeElement.blur();
    } else {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  }

  /** Fokus auf das registrierte Input setzen (z. B. nach Snackbar-Dismiss auf der Home-Seite). */
  refocusInput(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.inputRef?.nativeElement) {
      setTimeout(() => this.inputRef!.nativeElement.focus(), 0);
    }
  }
}
