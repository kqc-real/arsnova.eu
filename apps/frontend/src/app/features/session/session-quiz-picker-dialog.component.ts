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
import type { TeamAssignment } from '@arsnova/shared-types';
import type { QuizSummary } from '../quiz/data/quiz-store.service';

export interface SessionQuizPickerProfile {
  teamMode: boolean;
  teamCount?: number | null;
  teamAssignment?: TeamAssignment;
}

export interface SessionQuizPickerDialogData {
  quizzes: QuizSummary[];
  sessionProfile: SessionQuizPickerProfile | null;
}

@Component({
  selector: 'app-session-quiz-picker-dialog',
  standalone: true,
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIcon],
  templateUrl: './session-quiz-picker-dialog.component.html',
  styleUrls: [
    '../../shared/styles/dialog-title-header.scss',
    './session-quiz-picker-dialog.component.scss',
  ],
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
    return this.teamModeLabel(profile);
  }

  quizMetaLabel(quiz: QuizSummary): string {
    return quiz.questionCount === 1
      ? $localize`:@@sessionQuizPicker.questionCountOne:1 Frage`
      : $localize`:@@sessionQuizPicker.questionCountMany:${quiz.questionCount}:count: Fragen`;
  }

  private teamModeLabel(profile: SessionQuizPickerProfile): string {
    if (!profile.teamMode) {
      return $localize`:@@sessionQuizPicker.teamsDisabled:Teams sind nicht möglich.`;
    }
    return $localize`:@@sessionQuizPicker.teamModeHint:Teams sind aktiv.`;
  }
}
