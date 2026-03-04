import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';

/**
 * Neues Quiz anlegen (Epic 1).
 * Story 1.1 (Quiz erstellen).
 */
@Component({
  selector: 'app-quiz-new',
  standalone: true,
  imports: [RouterLink, MatButton, MatCard, MatCardContent, MatIcon],
  templateUrl: './quiz-new.component.html',
  styleUrl: './quiz-new.component.scss',
})
export class QuizNewComponent {}
