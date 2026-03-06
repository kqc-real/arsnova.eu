import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';

/**
 * Teilnehmer-Einstieg (QR/Link). Nach Nickname/anon → Redirect auf session/:code/vote.
 * Story 2.1b, 3.1, 3.2, 3.6, 7.1.
 */
@Component({
  selector: 'app-join',
  standalone: true,
  imports: [MatCard, MatCardContent],
  templateUrl: './join.component.html',
  styleUrl: './join.component.scss',
})
export class JoinComponent {
  private readonly route = inject(ActivatedRoute);
  readonly code = this.route.snapshot.paramMap.get('code') ?? '';
}
