import { Location } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { dismissContentPage } from '../../shared/content-page-nav';

/**
 * „So funktioniert’s“: Nutzerorientierte Anleitung, Layout und Stil wie Legal-Seiten.
 */
@Component({
  selector: 'app-help',
  imports: [MatButton, MatIcon, CdkTrapFocus],
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

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    event.preventDefault();
    this.back();
  }

  back(): void {
    dismissContentPage(this.location, this.router);
  }
}
