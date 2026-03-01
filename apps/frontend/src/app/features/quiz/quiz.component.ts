import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';

/**
 * Quiz-Verwaltungsseite (Epic 1).
 * Platzhalter – wird mit Story 1.1 (Quiz erstellen) implementiert.
 */
@Component({
  selector: 'app-quiz',
  imports: [RouterLink, MatButton, MatCard, MatCardContent, MatIcon],
  template: `
    <div class="l-page l-section">
      <div class="quiz-page__header">
        <h1 class="quiz-page__title">
          <mat-icon class="quiz-page__title-icon">quiz</mat-icon>
          Meine Quizzes
        </h1>
        <a matButton routerLink="/" aria-label="Zurück zur Startseite">
          <mat-icon>arrow_back</mat-icon>
          Startseite
        </a>
      </div>

      <mat-card appearance="outlined" class="quiz-empty-state">
        <mat-card-content class="quiz-empty-state__content">
          <p class="quiz-empty-state__text">
            Noch keine Quizzes.
          </p>
          <button matButton="filled" aria-label="Neues Quiz erstellen">
            <mat-icon>add_circle</mat-icon>
            Neues Quiz erstellen
          </button>
          <p class="quiz-empty-state__hint">
            Hier Quizzes anlegen und verwalten.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .quiz-page__header {
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .quiz-page__title {
      margin: 0;
      font: var(--mat-sys-headline-small);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .quiz-page__title-icon {
      font-size: 1.5rem;
      width: 1.5rem;
      height: 1.5rem;
    }

    .quiz-empty-state__content {
      text-align: center;
      padding: clamp(2rem, 5vw, 3rem) 1rem;
    }

    .quiz-empty-state__text {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }

    .quiz-empty-state__hint {
      margin: 1rem 0 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `],
})
export class QuizComponent {}
