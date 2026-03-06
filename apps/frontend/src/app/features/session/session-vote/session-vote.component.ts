import { Component } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';

/**
 * Teilnehmer-Abstimmung (Epic 3).
 * Story 3.1–3.6, 4.1, 4.4, 4.6, 4.8, 5.4–5.8, 7.1, 8.2, 8.3.
 */
@Component({
  selector: 'app-session-vote',
  standalone: true,
  imports: [MatCard, MatCardContent],
  templateUrl: './session-vote.component.html',
  styleUrl: './session-vote.component.scss',
})
export class SessionVoteComponent {}
