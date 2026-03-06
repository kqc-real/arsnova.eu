import { Component } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/**
 * Hilfe-Seite: Nutzerorientierte Anleitung, inhaltlich am Backlog ausgerichtet.
 */
@Component({
  selector: 'app-help',
  imports: [MatIcon],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss'],
})
export class HelpComponent {}
