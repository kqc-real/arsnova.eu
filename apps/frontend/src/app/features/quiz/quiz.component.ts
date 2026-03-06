import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatIcon } from '@angular/material/icon';

/**
 * Quiz-Shell (Epic 1). Child-Routes: Liste, new, :id, :id/preview, sync/:docId.
 */
@Component({
  selector: 'app-quiz',
  imports: [RouterOutlet, MatIcon],
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.scss',
})
export class QuizComponent {}
