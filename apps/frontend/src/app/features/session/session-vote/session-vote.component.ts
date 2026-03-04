import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';

/**
 * Teilnehmer-Abstimmung (Epic 3).
 * Story 3.1–3.6, 4.1, 4.4, 4.6, 4.8, 5.4–5.8, 7.1, 8.2, 8.3.
 */
@Component({
  selector: 'app-session-vote',
  standalone: true,
  imports: [RouterLink, MatButton, MatCard, MatCardContent, MatIcon],
  templateUrl: './session-vote.component.html',
  styleUrl: './session-vote.component.scss',
})
export class SessionVoteComponent {}
