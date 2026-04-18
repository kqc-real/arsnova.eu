import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import type { QuizSummary } from '../quiz/data/quiz-store.service';

export interface SessionQuizPickerDialogData {
  quizzes: QuizSummary[];
}

@Component({
  selector: 'app-session-quiz-picker-dialog',
  standalone: true,
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIcon],
  styles: [
    `
      .session-quiz-picker__intro {
        margin: 0 0 1rem;
        color: var(--mat-sys-on-surface-variant);
      }

      .session-quiz-picker__list {
        display: grid;
        gap: 0.75rem;
      }

      .session-quiz-picker__item {
        width: 100%;
        min-height: 4.5rem;
        padding: 0.9rem 1rem;
        border-radius: 1rem;
        border: 1px solid rgba(0, 0, 0, 0.12);
        justify-content: space-between;
        text-align: left;
      }

      .session-quiz-picker__item-main {
        display: grid;
        gap: 0.2rem;
        min-width: 0;
      }

      .session-quiz-picker__item-name {
        font-weight: 700;
      }

      .session-quiz-picker__item-meta,
      .session-quiz-picker__empty {
        color: var(--mat-sys-on-surface-variant);
      }

      .session-quiz-picker__item-description {
        color: var(--mat-sys-on-surface);
        opacity: 0.82;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon aria-hidden="true">library_books</mat-icon>
      <span i18n="@@sessionQuizPicker.title">Quiz auswählen</span>
    </h2>
    <mat-dialog-content>
      @if (quizzes.length === 0) {
        <p class="session-quiz-picker__empty" i18n="@@sessionQuizPicker.empty">
          In deiner Quiz-Sammlung ist noch kein Quiz zum Starten vorhanden.
        </p>
      } @else {
        <p class="session-quiz-picker__intro" i18n="@@sessionQuizPicker.intro">
          Wähle das nächste Quiz aus deiner Sammlung für diese Session.
        </p>
        <div class="session-quiz-picker__list">
          @for (quiz of quizzes; track quiz.id) {
            <button
              mat-button
              type="button"
              class="session-quiz-picker__item"
              (click)="pick(quiz.id)"
            >
              <span class="session-quiz-picker__item-main">
                <span class="session-quiz-picker__item-name">{{ quiz.name }}</span>
                <span class="session-quiz-picker__item-meta">{{ quizMetaLabel(quiz) }}</span>
                @if (quiz.description) {
                  <span class="session-quiz-picker__item-description">
                    {{ quiz.description }}
                  </span>
                }
              </span>
              <mat-icon aria-hidden="true">play_arrow</mat-icon>
            </button>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close i18n="@@sessionQuizPicker.cancel">
        Abbrechen
      </button>
    </mat-dialog-actions>
  `,
})
export class SessionQuizPickerDialogComponent {
  readonly data = inject<SessionQuizPickerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<SessionQuizPickerDialogComponent, string>);
  readonly quizzes = [...this.data.quizzes].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );

  pick(quizId: string): void {
    this.dialogRef.close(quizId);
  }

  quizMetaLabel(quiz: QuizSummary): string {
    const parts = [
      quiz.questionCount === 1
        ? $localize`:@@sessionQuizPicker.questionCountOne:1 Frage`
        : $localize`:@@sessionQuizPicker.questionCountMany:${quiz.questionCount}:count: Fragen`,
    ];
    if (quiz.teamMode) {
      parts.push($localize`:@@sessionQuizPicker.teamMode:Teammodus`);
    }
    return parts.join(' · ');
  }
}
