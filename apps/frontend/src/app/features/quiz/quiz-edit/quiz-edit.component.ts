import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';

/**
 * Quiz bearbeiten (Epic 1). Child: preview → /quiz/:id/preview.
 * Story 1.2a–1.2c, 1.3, 1.4, 1.7, 1.10, 1.11, 1.12, 1.6a.
 */
@Component({
  selector: 'app-quiz-edit',
  standalone: true,
  imports: [RouterLink, RouterOutlet, MatButton, MatCard, MatCardContent, MatIcon],
  templateUrl: './quiz-edit.component.html',
  styleUrl: './quiz-edit.component.scss',
})
export class QuizEditComponent {
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  isPreviewActive(): boolean {
    return this.route.snapshot.firstChild?.routeConfig?.path === 'preview';
  }
}
