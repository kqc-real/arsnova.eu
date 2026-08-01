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
