import { Component, LOCALE_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import type {
  SessionExpirationExtensionSelection,
  SessionInitialExpirationSelection,
  SessionLifecycleHostDTO,
} from '@arsnova/shared-types';
import { sessionLocalDateTimeToIso } from '../session-time-zone';

export type SessionExpirationDialogData =
  | {
      mode: 'INITIAL_CONFIGURATION';
      lifecycle: SessionLifecycleHostDTO;
    }
  | {
      mode: 'GLOBAL_WARNING';
      lifecycle: SessionLifecycleHostDTO;
      warningMinutes: 30 | 5;
    };

export type SessionExpirationDialogResult =
  | {
      purpose: 'INITIAL_CONFIGURATION';
      selection: SessionInitialExpirationSelection;
      timeZone: string;
    }
  | {
      purpose: 'GLOBAL_EXTENSION';
      selection: SessionExpirationExtensionSelection;
    };

@Component({
  selector: 'app-session-expiration-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
  ],
  templateUrl: './session-expiration-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './session-expiration-dialog.component.scss',
  ],
})
export class SessionExpirationDialogComponent {
  readonly data = inject<SessionExpirationDialogData>(MAT_DIALOG_DATA);
  private readonly localeId = inject(LOCALE_ID);
  private readonly dialogRef = inject(
    MatDialogRef<SessionExpirationDialogComponent, SessionExpirationDialogResult | null>,
  );
  readonly days = signal(7);
  readonly absoluteLocal = signal('');
  readonly inputError = signal<string | null>(null);

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(this.localeId, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: this.data.lifecycle.timeZone,
      timeZoneName: 'short',
    }).format(new Date(value));
  }

  chooseDays(): void {
    const days = Number(this.days());
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      this.inputError.set(
        $localize`:@@sessionLifecycle.invalidDays:Bitte gib 1 bis 30 Kalendertage ein.`,
      );
      return;
    }
    this.dialogRef.close({
      purpose: 'INITIAL_CONFIGURATION',
      selection: { kind: 'DURATION_DAYS', days },
      timeZone: this.data.lifecycle.timeZone,
    });
  }

  chooseQuick(amount: 'ONE_HOUR' | 'ONE_DAY' | 'SEVEN_DAYS'): void {
    this.dialogRef.close({
      purpose: 'GLOBAL_EXTENSION',
      selection: { kind: 'QUICK', amount },
    });
  }

  chooseAbsolute(): void {
    try {
      const expiresAt = sessionLocalDateTimeToIso(
        this.absoluteLocal(),
        this.data.lifecycle.timeZone,
      );
      if (this.data.mode === 'INITIAL_CONFIGURATION') {
        this.dialogRef.close({
          purpose: 'INITIAL_CONFIGURATION',
          selection: { kind: 'ABSOLUTE', expiresAt },
          timeZone: this.data.lifecycle.timeZone,
        });
      } else {
        this.dialogRef.close({
          purpose: 'GLOBAL_EXTENSION',
          selection: { kind: 'ABSOLUTE', expiresAt },
        });
      }
    } catch {
      this.inputError.set(
        $localize`:@@sessionLifecycle.invalidLocalDate:Diese lokale Uhrzeit ist in der Sessionzeitzone nicht eindeutig oder ungültig.`,
      );
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
