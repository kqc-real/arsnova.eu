import { Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { infoLandingUrl, type InfoLandingAnchor } from '../../core/info-landing-url';

/**
 * Kontextueller Link zur mehrsprachigen Informationsseite (Issue #192).
 * Öffnet immer in neuem Tab; kein Tracking.
 */
@Component({
  selector: 'app-info-landing-link',
  imports: [MatIcon],
  templateUrl: './info-landing-link.component.html',
  styleUrl: './info-landing-link.component.scss',
})
export class InfoLandingLinkComponent {
  /** Kanonischer Anker ohne `#`. */
  readonly anchor = input.required<InfoLandingAnchor>();
  /** Sichtbarer Linktext (lokalisiert vom Aufrufer). */
  readonly label = input.required<string>();
  /** Optional dichtere Darstellung (z. B. unter Formularfeldern). */
  readonly dense = input(false);

  protected readonly href = computed(() => infoLandingUrl(this.anchor()));

  protected readonly newTabHint = $localize`:@@infoLanding.openInNewTab:öffnet in neuem Tab`;
}
