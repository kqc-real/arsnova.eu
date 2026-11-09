import { Injectable } from '@angular/core';
import type { SessionLiveChannel } from '@arsnova/shared-types';
import { localizePath } from '../../../core/locale-router';
import { normalizeHostSessionCode } from '../../../core/host-session-token';

/**
 * Presenter ab Tablet, nicht auf Smartphones.
 *
 * CSS-Viewports (Layout-px, inkl. Browser-Chrome, Stand 2025/26):
 * - Smartphone-Landscape: oft 700–932 × 320–430 (Höhe < 500).
 * - 8–11"-Tablets Hochformat: 712–834 (Galaxy Tab S4 712, iPad mini 744, iPad/Air 11" 820–834).
 * - 11–13"-Tablets Querformat: 1133–1210 × 712–834 (Tab S4 1138×712, iPad mini 1133×744, iPad Air 1180×820).
 * - 12–14"-Tablets: 1024–1451 × 800–1024 (iPad 13" 1366×1024, Tab S10+ ca. 1400×876).
 * - Beamer/Desktop: typisch ≥1280×720, 1080p = 1920×1080 — nicht die Tablet-Norm.
 *
 * 600px Breite deckt 7–8"-Tablets im Hochformat; 500px Höhe schließt Phone-Landscape aus.
 * HDMI ist im Browser nicht erkennbar.
 */
export const PRESENTER_VIEW_OFFERED_MEDIA = '(min-width: 600px) and (min-height: 500px)';

/**
 * Presenter/Beamer auf Tablets und Desktop anbieten, nicht auf schmalen Smartphones.
 * Ohne `matchMedia` (Tests/SSR) gilt angeboten, damit Hydration und Host-Tests stabil bleiben.
 */
export function isPresenterViewOffered(win: Window | null | undefined): boolean {
  if (!win || typeof win.matchMedia !== 'function') {
    return true;
  }
  try {
    return win.matchMedia(PRESENTER_VIEW_OFFERED_MEDIA).matches;
  } catch {
    return true;
  }
}

export function sessionPresentationPath(sessionCode: string, view: 'host' | 'present'): string {
  return localizePath(`/session/${normalizeHostSessionCode(sessionCode)}/${view}`);
}

interface HostViewPreferences {
  channel: SessionLiveChannel;
}

/** Bedienkontext dieses Tabs. Der Zugriff auf beide Ansichten wird separat geprüft. */
@Injectable({ providedIn: 'root' })
export class SessionPresentationState {
  private startedCode: string | null = null;
  private lastHostView: { code: string; preferences: HostViewPreferences } | null = null;

  hasStarted(code: string): boolean {
    return this.startedCode === normalizeHostSessionCode(code);
  }

  markStarted(code: string): void {
    this.startedCode = normalizeHostSessionCode(code);
  }

  rememberHostView(code: string, preferences: HostViewPreferences): void {
    this.lastHostView = { code: normalizeHostSessionCode(code), preferences };
  }

  hostView(code: string): HostViewPreferences | undefined {
    return this.lastHostView?.code === normalizeHostSessionCode(code)
      ? this.lastHostView.preferences
      : undefined;
  }
}
