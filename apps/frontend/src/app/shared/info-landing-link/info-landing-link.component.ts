import { Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { infoLandingUrl, type InfoLandingAnchor } from '../../core/info-landing-url';
import { ThemePresetService } from '../../core/theme-preset.service';
import { PresenterIconComponent } from '../../features/session/presenter-icon.component';

/**
 * Kontextueller Link zur mehrsprachigen Informationsseite (Issue #192 / #207).
 * Öffnet immer in neuem Tab; kein Tracking. Überträgt den aktuellen Darstellungsmodus.
 */
@Component({
  selector: 'app-info-landing-link',
  imports: [MatIcon, PresenterIconComponent],
  templateUrl: './info-landing-link.component.html',
  styleUrl: './info-landing-link.component.scss',
})
export class InfoLandingLinkComponent {
  private readonly themePreset = inject(ThemePresetService);

  /** Kanonischer Anker ohne `#`. */
  readonly anchor = input.required<InfoLandingAnchor>();
  /** Sichtbarer Linktext (lokalisiert vom Aufrufer). */
  readonly label = input.required<string>();
  /** Optional dichtere Darstellung (z. B. unter Formularfeldern). */
  readonly dense = input(false);
  /** Lead-Icon: Info (Standard) oder Beamer-Silhouette für Presenter/Pairing. */
  readonly leadIcon = input<'info' | 'presenter'>('info');

  protected readonly href = computed(() =>
    infoLandingUrl(this.anchor(), undefined, this.themePreset.theme()),
  );

  protected readonly newTabHint = $localize`:@@infoLanding.openInNewTab:öffnet in neuem Tab`;
}
