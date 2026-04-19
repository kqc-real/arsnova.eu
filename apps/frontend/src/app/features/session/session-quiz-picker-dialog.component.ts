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
import type { NicknameTheme, TeamAssignment } from '@arsnova/shared-types';
import type { QuizSummary } from '../quiz/data/quiz-store.service';

export interface SessionQuizPickerProfile {
  nicknameTheme: NicknameTheme;
  allowCustomNicknames: boolean;
  anonymousMode: boolean;
  teamMode: boolean;
  teamCount: number | null;
  teamAssignment: TeamAssignment;
}

export interface SessionQuizPickerDialogData {
  quizzes: QuizSummary[];
  sessionProfile: SessionQuizPickerProfile | null;
}

@Component({
  selector: 'app-session-quiz-picker-dialog',
  standalone: true,
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIcon],
  styles: [
    `
      .session-quiz-picker__title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .session-quiz-picker__title mat-icon {
        color: var(--mat-sys-primary);
      }

      .session-quiz-picker__intro {
        margin: 0 0 0.85rem;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-medium);
      }

      .session-quiz-picker__profile-card {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.85rem;
        align-items: start;
        margin: 0 0 1rem;
        padding: 0.95rem 1rem;
        border: 1px solid color-mix(in srgb, var(--mat-sys-primary) 18%, var(--mat-sys-outline));
        border-radius: 1rem;
        background: color-mix(
          in srgb,
          var(--mat-sys-primary-container) 52%,
          var(--mat-sys-surface-container-high)
        );
      }

      .session-quiz-picker__profile-icon {
        margin-top: 0.05rem;
        color: var(--mat-sys-primary);
      }

      .session-quiz-picker__profile-copy {
        display: grid;
        gap: 0.3rem;
        min-width: 0;
      }

      .session-quiz-picker__profile-heading {
        margin: 0;
        color: var(--mat-sys-on-surface);
        font: var(--mat-sys-title-small);
        font-weight: 700;
      }

      .session-quiz-picker__list {
        display: grid;
        gap: 0.75rem;
      }

      .session-quiz-picker__empty-state {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.9rem;
        align-items: start;
        margin: 0;
        padding: 1rem 1rem 1rem 1.05rem;
        border: 1px solid color-mix(in srgb, var(--mat-sys-error) 32%, var(--mat-sys-outline));
        border-radius: 1rem;
        background: color-mix(in srgb, var(--mat-sys-error-container) 72%, var(--mat-sys-surface));
      }

      .session-quiz-picker__empty-icon {
        margin-top: 0.05rem;
        color: var(--mat-sys-error);
      }

      .session-quiz-picker__item {
        width: 100%;
        min-height: 4.5rem;
        padding: 0.9rem 1rem;
        border-radius: 1rem;
        border: 1px solid color-mix(in srgb, var(--mat-sys-outline) 75%, transparent);
        background: color-mix(
          in srgb,
          var(--mat-sys-surface-container) 76%,
          var(--mat-sys-surface)
        );
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
      .session-quiz-picker__empty,
      .session-quiz-picker__profile-text {
        color: var(--mat-sys-on-surface-variant);
      }

      .session-quiz-picker__profile-text {
        margin: 0;
        font: var(--mat-sys-body-small);
      }

      .session-quiz-picker__empty {
        margin: 0;
        color: var(--mat-sys-on-error-container);
        font: var(--mat-sys-body-medium);
        font-weight: 600;
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
    <h2 mat-dialog-title class="session-quiz-picker__title">
      <mat-icon aria-hidden="true">library_books</mat-icon>
      <span i18n="@@sessionQuizPicker.title">Quiz auswählen</span>
    </h2>
    <mat-dialog-content>
      @if (profileSummary(); as profileSummary) {
        <section class="session-quiz-picker__profile-card" role="note">
          <mat-icon class="session-quiz-picker__profile-icon" aria-hidden="true">badge</mat-icon>
          <div class="session-quiz-picker__profile-copy">
            <p
              class="session-quiz-picker__profile-heading"
              i18n="@@sessionQuizPicker.profileHeading"
            >
              Aktuelles Onboarding-Profil der Teilnehmenden
            </p>
            <p class="session-quiz-picker__profile-text">{{ profileSummary }}</p>
          </div>
        </section>
      }
      @if (quizzes.length === 0) {
        <section class="session-quiz-picker__empty-state" role="alert" aria-live="polite">
          <mat-icon class="session-quiz-picker__empty-icon" aria-hidden="true">
            warning_amber
          </mat-icon>
          <p class="session-quiz-picker__empty" i18n="@@sessionQuizPicker.empty">
            Zum aktuellen Onboarding-Profil deiner Teilnehmenden passt aktuell kein Quiz aus deiner
            Sammlung.
          </p>
        </section>
      } @else {
        <p class="session-quiz-picker__intro" i18n="@@sessionQuizPicker.intro">
          Wähle ein Quiz, das zum aktuellen Onboarding-Profil deiner Teilnehmenden passt:
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
  readonly sessionProfile = this.data.sessionProfile;

  pick(quizId: string): void {
    this.dialogRef.close(quizId);
  }

  profileSummary(): string | null {
    const profile = this.sessionProfile;
    if (!profile) {
      return null;
    }

    const parts = [this.nameModeLabel(profile), this.teamModeLabel(profile)];
    return parts.join(' ');
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

  private nameModeLabel(profile: SessionQuizPickerProfile): string {
    if (profile.anonymousMode) {
      return $localize`:@@sessionQuizPicker.nameModeAnonymous:Anonyme Teilnahme.`;
    }
    if (profile.allowCustomNicknames) {
      return $localize`:@@sessionQuizPicker.nameModeCustom:Freie Nicknames sind erlaubt.`;
    }
    if (profile.nicknameTheme === 'KINDERGARTEN') {
      return $localize`:@@sessionQuizPicker.nameModeKindergarten:Feste Tier-Emojis als Pseudonyme.`;
    }
    return $localize`:@@sessionQuizPicker.nameModeTheme:Feste Pseudonyme aus ${this.nicknameThemeLabel(profile.nicknameTheme)}.`;
  }

  private teamModeLabel(profile: SessionQuizPickerProfile): string {
    if (!profile.teamMode) {
      return $localize`:@@sessionQuizPicker.teamsDisabled:Teams sind nicht möglich.`;
    }
    const count = profile.teamCount ?? 2;
    const assignment =
      profile.teamAssignment === 'MANUAL'
        ? $localize`:@@sessionQuizPicker.teamAssignmentManual:manuelle Teamwahl`
        : $localize`:@@sessionQuizPicker.teamAssignmentAuto:automatische Teamzuweisung`;
    return $localize`:@@sessionQuizPicker.teamModeHint:Teams sind aktiv (${count} Teams, ${assignment}).`;
  }

  private nicknameThemeLabel(theme: NicknameTheme): string {
    switch (theme) {
      case 'NOBEL_LAUREATES':
        return $localize`:@@sessionQuizPicker.nicknameThemeNobel:Nobelpreis`;
      case 'KINDERGARTEN':
        return $localize`:@@sessionQuizPicker.nicknameThemeKindergarten:Kindergarten`;
      case 'PRIMARY_SCHOOL':
        return $localize`:@@sessionQuizPicker.nicknameThemePrimary:Grundschule`;
      case 'MIDDLE_SCHOOL':
        return $localize`:@@sessionQuizPicker.nicknameThemeMiddle:Mittelstufe`;
      case 'HIGH_SCHOOL':
      default:
        return $localize`:@@sessionQuizPicker.nicknameThemeHigh:Oberstufe`;
    }
  }
}
