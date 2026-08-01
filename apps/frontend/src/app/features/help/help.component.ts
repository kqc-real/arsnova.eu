import { Location } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import {
  MatAccordion,
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { localizePath } from '../../core/locale-router';
import { dismissContentPage, shouldDeferContentPageEscape } from '../../shared/content-page-nav';

/**
 * Hilfe & Einstieg: rollen- und erfahrungsbasierte Akkordeons (Issue #190).
 */
@Component({
  selector: 'app-help',
  imports: [
    MatButton,
    MatIcon,
    CdkTrapFocus,
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    RouterLink,
  ],
  templateUrl: './help.component.html',
  styleUrls: [
    '../../shared/styles/dialog-title-header.scss',
    '../../shared/styles/content-page-backdrop.scss',
    'help.component.scss',
  ],
})
export class HelpComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly localizedPath = localizePath;

  /** Locale-sicherer Abschnittsanker (kein reines `#…` wegen `<base href>`). */
  helpSectionHref(sectionId: 'help-host' | 'help-participant'): string {
    return `${localizePath('/help')}#${sectionId}`;
  }

  /**
   * Primärklick/Enter: im Scroll-Container springen, Fragment per replaceState setzen und
   * Fokus auf die Abschnittsüberschrift legen, damit Tab danach in diesem Abschnitt weiterläuft.
   * Kein History-Push — sonst würde dismissContentPage/Zurück nur den Anker entfernen.
   * Modifizierte Klicks (neuer Tab etc.) nutzen den echten `href`.
   */
  onHelpSectionLinkClick(event: MouseEvent, sectionId: 'help-host' | 'help-participant'): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (typeof window === 'undefined') {
      return;
    }
    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }
    const heading =
      section.querySelector<HTMLElement>('h2.help-section__title') ?? (section as HTMLElement);
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Nach In-Page-Sprung Fokus verschieben; sonst bleibt er auf der Rollenkarte und Tab
    // läuft wieder durch die Karten oberhalb des Ziels.
    heading.focus({ preventScroll: true });
    const nextUrl = `${window.location.pathname}${window.location.search}#${sectionId}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (shouldDeferContentPageEscape(this.dialog)) {
      return;
    }
    event.preventDefault();
    this.back();
  }

  back(): void {
    dismissContentPage(this.location, this.router);
  }
}
