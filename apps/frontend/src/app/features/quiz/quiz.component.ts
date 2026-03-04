import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/**
 * Quiz-Shell (Epic 1). Child-Routes: Liste, new, :id, :id/preview, sync/:docId.
 */
@Component({
  selector: 'app-quiz',
  imports: [RouterLink, RouterOutlet, MatButton, MatIcon],
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.scss',
})
export class QuizComponent {}
