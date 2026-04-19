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

    const parts = [this.nameModeLabel(profile), this.teamModeLabel(profile)];
    return parts.join(' ');
  }

  quizMetaLabel(quiz: QuizSummary): string {
    return quiz.questionCount === 1
      ? $localize`:@@sessionQuizPicker.questionCountOne:1 Frage`
      : $localize`:@@sessionQuizPicker.questionCountMany:${quiz.questionCount}:count: Fragen`;
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
