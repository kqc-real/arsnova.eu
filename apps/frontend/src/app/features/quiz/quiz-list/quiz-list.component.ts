import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';

/**
 * Quiz-Liste (Epic 1).
 * Story 1.1 (Quiz erstellen), 1.8 (Export), 1.9 (Import), 1.10 (Bearbeiten, Löschen).
 */
@Component({
  selector: 'app-quiz-list',
  standalone: true,
  imports: [RouterLink, MatButton, MatCard, MatCardContent, MatIcon],
  templateUrl: './quiz-list.component.html',
  styleUrl: './quiz-list.component.scss',
})
export class QuizListComponent {}
