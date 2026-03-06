import { Component } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';

/**
 * Beamer-Ansicht / Presenter-Mode (Epic 2).
 * Story 2.5, 2.6, 3.5, 4.1, 4.4, 4.5, 1.14, 7.1, 8.2, 8.3.
 */
@Component({
  selector: 'app-session-present',
  standalone: true,
  imports: [MatCard, MatCardContent],
  templateUrl: './session-present.component.html',
  styleUrl: './session-present.component.scss',
})
export class SessionPresentComponent {}
