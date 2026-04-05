import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/**
 * „So funktioniert’s“: Nutzerorientierte Anleitung, Layout und Stil wie Legal-Seiten.
 */
@Component({
  selector: 'app-help',
  imports: [MatButton, MatIcon],
  templateUrl: './help.component.html',
  styleUrls: [
    '../../shared/styles/dialog-title-header.scss',
    '../../shared/styles/content-page-backdrop.scss',
    'help.component.scss',
  ],
})
export class HelpComponent {
  private readonly location = inject(Location);

  back(): void {
    this.location.back();
  }
}
