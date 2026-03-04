import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';

/**
 * Quiz per Sync-Link auf anderem Gerät öffnen (Epic 1).
 * Story 1.6, 1.6a, 1.6b.
 */
@Component({
  selector: 'app-quiz-sync',
  standalone: true,
  imports: [RouterLink, MatButton, MatCard, MatCardContent, MatIcon],
  templateUrl: './quiz-sync.component.html',
  styleUrl: './quiz-sync.component.scss',
})
export class QuizSyncComponent {
  private readonly route = inject(ActivatedRoute);
  readonly docId = this.route.snapshot.paramMap.get('docId') ?? '';
}
