import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import type { NicknameTheme, SessionParticipantIdentityMode } from '@arsnova/shared-types';

export interface SessionParticipationProfileDialogData {
  identityMode: SessionParticipantIdentityMode;
  nicknameTheme: NicknameTheme;
  setupStep?: number;
  setupStepCount?: number;
}

export interface SessionParticipationProfileDialogResult {
  identityMode: SessionParticipantIdentityMode;
  nicknameTheme: NicknameTheme;
}

@Component({
  selector: 'app-session-participation-profile-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatIcon,
    MatLabel,
    MatOption,
    MatRadioButton,
    MatRadioGroup,
    MatSelect,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title-header">
      <span class="dialog-title-header__icon" aria-hidden="true">
        <mat-icon>badge</mat-icon>
      </span>
      <span class="dialog-title-header__copy">
        @if (data.setupStep && data.setupStepCount) {
          <span class="dialog-title-header__step" i18n="@@sessionQaSetup.step">
            Schritt {{ data.setupStep }} von {{ data.setupStepCount }}
          </span>
        }
        <span class="dialog-title-header__heading" i18n="@@sessionParticipation.title">
          Teilnahme für Q&A
        </span>
      </span>
    </h2>

    <mat-dialog-content class="participation-profile-dialog__content">
      <p id="participation-profile-description" i18n="@@sessionParticipation.description">
        Lege fest, wie Personen in dieser Session beitreten und wie Verfasserangaben bei Q&A
        erscheinen.
      </p>

      <fieldset>
        <legend i18n="@@sessionParticipation.modeLegend">Namensdarstellung</legend>
        <mat-radio-group
          name="session-participation-mode"
          aria-describedby="participation-profile-description participation-profile-lock"
          [ngModel]="identityMode()"
          (ngModelChange)="identityMode.set($event)"
        >
          <mat-radio-button value="PRESET_PSEUDONYM">
            <span class="participation-profile-dialog__option-copy">
              <strong i18n="@@sessionParticipation.pseudonymLabel">Vorgegebene Pseudonyme</strong>
              <span i18n="@@sessionParticipation.pseudonymHint">
                Jede Person wählt beim Beitritt aus vorgegebenen Namen.
              </span>
            </span>
          </mat-radio-button>
          <mat-radio-button value="CUSTOM_NICKNAME">
            <span class="participation-profile-dialog__option-copy">
              <strong i18n="@@sessionParticipation.customLabel">Eigener Nickname</strong>
              <span i18n="@@sessionParticipation.customHint">
                Personen wählen beim Beitritt selbst einen sichtbaren Namen.
              </span>
            </span>
          </mat-radio-button>
          <mat-radio-button value="ANONYMOUS">
            <span class="participation-profile-dialog__option-copy">
              <strong i18n="@@sessionParticipation.anonymousLabel">Anonymmodus</strong>
              <span i18n="@@sessionParticipation.anonymousHint">
                Beiträge erscheinen ohne sichtbare Verfasserangabe. Technische Session- und
                Sicherheitsdaten können weiterhin verarbeitet werden; dies ist keine vollständige
                Anonymisierung.
              </span>
            </span>
          </mat-radio-button>
        </mat-radio-group>
      </fieldset>

      @if (identityMode() === 'PRESET_PSEUDONYM') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label i18n="@@sessionParticipation.themeLabel">Pseudonymgruppe</mat-label>
          <mat-select
            [ngModel]="nicknameTheme()"
            (ngModelChange)="nicknameTheme.set($event)"
            i18n-aria-label="@@sessionParticipation.themeAria"
            aria-label="Pseudonymgruppe wählen"
          >
            <mat-option value="KINDERGARTEN" i18n="@@sessionParticipation.themeKindergarten"
              >Kita</mat-option
            >
            <mat-option value="PRIMARY_SCHOOL" i18n="@@sessionParticipation.themePrimary"
              >Grundschule</mat-option
            >
            <mat-option value="MIDDLE_SCHOOL" i18n="@@sessionParticipation.themeMiddle"
              >Mittelstufe</mat-option
            >
            <mat-option value="HIGH_SCHOOL" i18n="@@sessionParticipation.themeHigh"
              >Oberstufe</mat-option
            >
            <mat-option value="NOBEL_LAUREATES" i18n="@@sessionParticipation.themeNobel"
              >Nobelpreisträger:innen</mat-option
            >
          </mat-select>
        </mat-form-field>
      }

      <p
        id="participation-profile-lock"
        class="participation-profile-dialog__lock"
        role="note"
        i18n="@@sessionParticipation.lockHint"
      >
        Nach dem ersten erfolgreichen Beitritt ist diese Einstellung für die gesamte Session
        gesperrt. Das gilt auch nach dem Löschen von Teilnahmen oder bei einem Gerätewechsel.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close i18n="@@common.cancel">Abbrechen</button>
      <button
        mat-flat-button
        type="button"
        [mat-dialog-close]="result()"
        i18n="@@sessionParticipation.startQa"
      >
        Q&A starten
      </button>
    </mat-dialog-actions>
  `,
  styleUrls: [
    '../../shared/styles/dialog-title-header.scss',
    './session-participation-profile-dialog.component.scss',
  ],
})
export class SessionParticipationProfileDialogComponent {
  readonly data = inject<SessionParticipationProfileDialogData>(MAT_DIALOG_DATA);

  readonly identityMode = signal<SessionParticipantIdentityMode>(this.data.identityMode);
  readonly nicknameTheme = signal<NicknameTheme>(this.data.nicknameTheme);
  readonly result = computed<SessionParticipationProfileDialogResult>(() => ({
    identityMode: this.identityMode(),
    nicknameTheme: this.nicknameTheme(),
  }));
}
