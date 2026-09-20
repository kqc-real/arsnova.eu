import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import type { TeamAssignment } from '@arsnova/shared-types';
import { DEMO_QUIZ_ID, type QuizSummary } from '../quiz/data/quiz-store.service';

export interface SessionQuizPickerProfile {
  teamMode: boolean;
  teamCount?: number | null;
  teamAssignment?: TeamAssignment;
}

export interface SessionQuizPickerDialogData {
  quizzes: QuizSummary[];
  sessionProfile: SessionQuizPickerProfile | null;
  emptyRoom?: boolean;
}

export interface SessionQuizPickerResult {
  quizId: string;
  adoptQuizTeams: boolean;
}

@Component({
  selector: 'app-session-quiz-picker-dialog',
  standalone: true,
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle, MatIcon],
  templateUrl: './session-quiz-picker-dialog.component.html',
  styleUrls: [
    '../../shared/styles/dialog-title-header.scss',
    './session-quiz-picker-dialog.component.scss',
  ],
})
export class SessionQuizPickerDialogComponent {
  readonly data = inject<SessionQuizPickerDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<SessionQuizPickerDialogComponent, SessionQuizPickerResult | false>,
  );
  readonly quizzes = [...this.data.quizzes].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
  readonly sessionProfile = this.data.sessionProfile;

  pick(quizId: string, adoptQuizTeams = false): void {
    this.dialogRef.close({ quizId, adoptQuizTeams });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  isCompatible(quiz: QuizSummary): boolean {
    const profile = this.sessionProfile;
    if (!profile) {
      return true;
    }
    if (profile.teamMode === quiz.teamMode) {
      return true;
    }
    if (
      (this.data.emptyRoom === true || quiz.id === DEMO_QUIZ_ID) &&
      !profile.teamMode &&
      quiz.teamMode
    ) {
      return true;
    }
    return false;
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

  mismatchHint(quiz: QuizSummary): string {
    return quiz.teamMode
      ? $localize`:@@sessionQuizPicker.mismatchTeam:Teambindung passt nicht. Du kannst alle im Raum den Teams dieses Quiz zuordnen.`
      : $localize`:@@sessionQuizPicker.mismatchSolo:Teambindung passt nicht. Du kannst die Teams auflösen und alle einzeln spielen lassen.`;
  }

  adoptLabel(quiz: QuizSummary): string {
    return quiz.teamMode
      ? $localize`:@@sessionQuizPicker.adoptTeam:Teams neu zuordnen`
      : $localize`:@@sessionQuizPicker.adoptSolo:Ohne Teams starten`;
  }

  private teamModeLabel(profile: SessionQuizPickerProfile): string {
    if (!profile.teamMode) {
      if (this.data.emptyRoom) {
        return $localize`:@@sessionQuizPicker.emptyRoomHint:Noch niemand im Raum. Jedes Quiz richtet die Teambindung mit ein.`;
      }
      return $localize`:@@sessionQuizPicker.teamsDisabled:Keine aktiven Teams. Einzelspieler-Quizze startest du direkt. Bei einem Team-Quiz kannst du alle im Raum den Teams des Quiz zuordnen.`;
    }
    return $localize`:@@sessionQuizPicker.teamModeHint:Aktive Teams. Team-Quizze übernehmen die aktuelle Struktur. Ein Einzelspieler-Quiz kannst du trotzdem wählen – dann endet die Teambindung.`;
  }
}
