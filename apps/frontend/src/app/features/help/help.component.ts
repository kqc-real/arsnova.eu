import { isPlatformBrowser, Location } from '@angular/common';
import {
  afterNextRender,
  AfterViewInit,
  Component,
  HostListener,
  inject,
  PLATFORM_ID,
} from '@angular/core';
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
import { localizePath, resolveLocalizedAppUrl } from '../../core/locale-router';
import { INFO_LANDING_ANCHORS } from '../../core/info-landing-url';
import { dismissContentPage, shouldDeferContentPageEscape } from '../../shared/content-page-nav';
import { InfoLandingLinkComponent } from '../../shared/info-landing-link/info-landing-link.component';

type HelpRoleSectionId = 'help-host' | 'help-participant';

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
    InfoLandingLinkComponent,
  ],
  templateUrl: './help.component.html',
  styleUrls: [
    '../../shared/styles/dialog-title-header.scss',
    '../../shared/styles/content-page-backdrop.scss',
    'help.component.scss',
  ],
})
export class HelpComponent implements AfterViewInit {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly platformId = inject(PLATFORM_ID);

  /** Erlaubter Deep-Link beim ersten Render (z. B. neuer Tab mit `#help-participant`). */
  private readonly hashSectionOnInit = this.readAllowedHelpSectionHash();
  private initialHashApplied = false;

  /**
   * Bei Deep-Link zum Rollenabschnitt kein Auto-Capture auf den Zurück-Button —
   * sonst gewinnt der Focus-Trap gegen den Abschnittstitel.
   */
  readonly trapAutoCapture = this.hashSectionOnInit === null;

  readonly localizedPath = localizePath;
  readonly infoLandingFeaturesAnchor = INFO_LANDING_ANCHORS.features;
  readonly infoLandingFeaturesLabel = $localize`:@@help.infoLandingLink:Hintergründe und Einsatzmöglichkeiten`;

  constructor() {
    // Hydration / Browser: nach dem ersten Render denselben Scroll-/Fokuspfad wie beim Klick.
    afterNextRender(() => this.applyInitialHelpSectionHash());
  }

  ngAfterViewInit(): void {
    // Zusätzlich nach View-Init (Tests / Umgebungen ohne zuverlässigen afterNextRender-Flush).
    this.applyInitialHelpSectionHash();
  }

  private applyInitialHelpSectionHash(): void {
    if (this.initialHashApplied) {
      return;
    }
    const sectionId = this.hashSectionOnInit ?? this.readAllowedHelpSectionHash();
    if (!sectionId) {
      return;
    }
    this.initialHashApplied = true;
    // Nach scrollPositionRestoration: 'top' und Focus-Trap-Init den Abschnitt ansteuern.
    setTimeout(() => this.focusHelpSection(sectionId), 0);
  }

  /**
   * Browser-`href` für Rollenkarten: locale-sicher auch bei Production-`<base href="/de/">`
   * (Ctrl/Cmd-Klick, Mittelklick, „In neuem Tab öffnen“).
   */
  helpSectionHref(sectionId: HelpRoleSectionId): string {
    const absolute = resolveLocalizedAppUrl('/help');
    try {
      const url = new URL(
        absolute,
        typeof window !== 'undefined' ? window.location.origin : undefined,
      );
      return `${url.pathname}${url.search}#${sectionId}`;
    } catch {
      return `${localizePath('/help')}#${sectionId}`;
    }
  }

  /**
   * Primärklick/Enter: im Scroll-Container springen, Fragment per replaceState setzen und
   * Fokus auf die Abschnittsüberschrift legen, damit Tab danach in diesem Abschnitt weiterläuft.
   * Kein Router-Navigate / History-Push — sonst Scroll-Reset (`scrollPositionRestoration: 'top'`)
   * bzw. Zurück nur auf den Anker.
   * Modifizierte Klicks (neuer Tab etc.) nutzen den echten `href`.
   */
  onHelpSectionLinkClick(event: MouseEvent, sectionId: HelpRoleSectionId): void {
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
    this.focusHelpSection(sectionId);
    const nextUrl = `${window.location.pathname}${window.location.search}#${sectionId}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }

  /** Scrollt und fokussiert einen erlaubten Rollenabschnitt (Klick und initialer Hash). */
  private focusHelpSection(sectionId: HelpRoleSectionId): void {
    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }
    const heading =
      section.querySelector<HTMLElement>('h2.help-section__title') ?? (section as HTMLElement);
    section.scrollIntoView({ behavior: this.scrollBehavior(), block: 'start' });
    // Nach In-Page-Sprung Fokus verschieben; sonst bleibt er auf der Rollenkarte und Tab
    // läuft wieder durch die Karten oberhalb des Ziels.
    heading.focus({ preventScroll: true });
  }

  private readAllowedHelpSectionHash(): HelpRoleSectionId | null {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') {
      return null;
    }
    const hash = window.location.hash.replace(/^#/, '');
    return hash === 'help-host' || hash === 'help-participant' ? hash : null;
  }

  private scrollBehavior(): ScrollBehavior {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
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
