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
import { MatOption, MatSelect } from '@angular/material/select';
import {
  SESSION_POST_PROCESSING_HOURS,
  type SessionExpirationExtensionSelection,
  type SessionInitialExpirationSelection,
  type SessionLifecycleHostDTO,
} from '@arsnova/shared-types';
import { localizeKnownServerError } from '../../../core/localize-known-server-message';
import {
  addCalendarDays,
  isoToSessionLocalDateTime,
  laterIsoTimestamp,
  maxSelectableCalendarDays,
  openSessionDateTimePicker,
  reportSessionDateTimePickerValidity,
  sessionDateTimeLocalBounds,
  sessionLocalDateTimeToIso,
} from '../session-local-datetime';

type InitialDeadlineKind = 'DURATION_DAYS' | 'ABSOLUTE';

export type SessionExpirationDialogData = (
  | {
      mode: 'INITIAL_CONFIGURATION';
      lifecycle: SessionLifecycleHostDTO;
      /** Dieselbe Frist wie auf der Q&A-Karte. */
      participantAccessEndsAt?: string;
    }
  | {
      mode: 'GLOBAL_WARNING';
      lifecycle: SessionLifecycleHostDTO;
      warningMinutes: 30 | 5;
    }
) & {
  /** Speichert erst nach der Bestätigung. Ein Fehler bleibt in diesem Dialog. */
  submit?: (result: SessionExpirationDialogResult) => Promise<boolean>;
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
    MatOption,
    MatSelect,
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
  readonly maxSelectableDays = signal(
    maxSelectableCalendarDays(
      this.data.lifecycle.createdAt,
      this.data.lifecycle.maxExpiresAt,
      this.data.lifecycle.timeZone,
    ),
  );
  readonly deadlineKind = signal<InitialDeadlineKind>('DURATION_DAYS');
  /** Entspricht dem aktuellen Ende, wenn es genau N Kalendertage ab Erstellung sind. */
  readonly days = signal(this.initialDays());
  readonly absoluteLocal = signal('');
  readonly inputError = signal<string | null>(null);
  readonly checking = signal(false);
  readonly absoluteBounds = sessionDateTimeLocalBounds(
    this.data.mode === 'GLOBAL_WARNING'
      ? laterIsoTimestamp(this.data.lifecycle.expiresAt, this.data.lifecycle.serverNow)
      : this.data.lifecycle.serverNow,
    this.data.lifecycle.maxExpiresAt,
    this.data.lifecycle.timeZone,
  );

  participantAccessEndsAt(): string {
    if (this.data.mode === 'INITIAL_CONFIGURATION' && this.data.participantAccessEndsAt) {
      return this.data.participantAccessEndsAt;
    }
    const stored = this.data.lifecycle.qaClosesAt;
    if (stored && Date.parse(stored) <= Date.parse(this.data.lifecycle.expiresAt)) {
      return stored;
    }
    return this.data.lifecycle.expiresAt;
  }

  currentHostReadUntil(): string {
    return (
      this.data.lifecycle.postProcessingEndsAt ?? this.hostReadUntil(this.data.lifecycle.expiresAt)
    );
  }

  hostReadUntil(accessEndsAt: string): string {
    return new Date(
      Date.parse(accessEndsAt) + SESSION_POST_PROCESSING_HOURS * 60 * 60 * 1000,
    ).toISOString();
  }

  draftAbsoluteEnd(): string | null {
    const local = this.absoluteLocal();
    if (!local) {
      return null;
    }
    try {
      return sessionLocalDateTimeToIso(local, this.data.lifecycle.timeZone);
    } catch {
      return null;
    }
  }

  resolvedDaysEnd(): string | null {
    const days = Number(this.days());
    const maxDays = this.maxSelectableDays();
    if (!Number.isInteger(days) || days < 1 || days > maxDays) {
      return null;
    }
    return addCalendarDays(this.data.lifecycle.createdAt, days, this.data.lifecycle.timeZone);
  }

  onDeadlineKindChange(kind: InitialDeadlineKind): void {
    this.deadlineKind.set(kind);
    this.inputError.set(null);
    if (kind !== 'ABSOLUTE' || this.absoluteLocal()) {
      return;
    }
    const seed = this.resolvedDaysEnd() ?? this.data.lifecycle.expiresAt;
    this.seedAbsoluteLocal(seed);
  }

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

  async chooseDays(): Promise<void> {
    const days = Number(this.days());
    const maxDays = this.maxSelectableDays();
    if (maxDays < 1 || !Number.isInteger(days) || days < 1 || days > maxDays) {
      this.inputError.set(
        maxDays < 1
          ? $localize`:@@sessionLifecycle.noFullDayLeft:Kein voller Kalendertag ist mehr zulässig. Wähle ein Datum und eine Uhrzeit.`
          : $localize`:@@sessionLifecycle.invalidDays:Bitte gib 1 bis ${maxDays}:maxDays: Tage ein.`,
      );
      return;
    }
    await this.submitSelection({
      purpose: 'INITIAL_CONFIGURATION',
      selection: { kind: 'DURATION_DAYS', days },
      timeZone: this.data.lifecycle.timeZone,
    });
  }

  chooseQuick(amount: 'ONE_HOUR' | 'ONE_DAY' | 'SEVEN_DAYS'): void {
    void this.submitSelection({
      purpose: 'GLOBAL_EXTENSION',
      selection: { kind: 'QUICK', amount },
    });
  }

  openAbsolutePicker(input: HTMLInputElement): void {
    openSessionDateTimePicker(input);
  }

  async chooseAbsolute(input: HTMLInputElement): Promise<void> {
    if (input.value) {
      this.absoluteLocal.set(input.value);
    }
    if (!reportSessionDateTimePickerValidity(input)) {
      return;
    }
    try {
      const expiresAt = sessionLocalDateTimeToIso(
        input.value || this.absoluteLocal(),
        this.data.lifecycle.timeZone,
      );
      if (this.data.mode === 'INITIAL_CONFIGURATION') {
        await this.submitSelection({
          purpose: 'INITIAL_CONFIGURATION',
          selection: { kind: 'ABSOLUTE', expiresAt },
          timeZone: this.data.lifecycle.timeZone,
        });
      } else {
        await this.submitSelection({
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

  private async submitSelection(result: SessionExpirationDialogResult): Promise<void> {
    if (!this.data.submit) {
      this.dialogRef.close(result);
      return;
    }
    this.checking.set(true);
    this.inputError.set(null);
    try {
      const saved = await this.data.submit(result);
      if (saved) {
        this.dialogRef.close(null);
      }
    } catch (error) {
      this.inputError.set(
        localizeKnownServerError(
          error,
          $localize`:@@sessionLifecycle.changeError:Die Sessionfrist konnte nicht geändert werden.`,
        ),
      );
    } finally {
      this.checking.set(false);
    }
  }

  private initialDays(): number {
    const maxDays = this.maxSelectableDays();
    if (maxDays < 1) {
      return 0;
    }
    return this.calendarDaysMatching(this.data.lifecycle.expiresAt) ?? Math.min(7, maxDays);
  }

  private calendarDaysMatching(endIso: string): number | null {
    const endMs = Date.parse(endIso);
    if (!Number.isFinite(endMs)) {
      return null;
    }
    const maxDays = this.maxSelectableDays();
    for (let days = 1; days <= maxDays; days += 1) {
      const candidateMs = Date.parse(
        addCalendarDays(this.data.lifecycle.createdAt, days, this.data.lifecycle.timeZone),
      );
      if (candidateMs === endMs) {
        return days;
      }
    }
    return null;
  }

  private seedAbsoluteLocal(iso: string): void {
    try {
      const local = isoToSessionLocalDateTime(iso, this.data.lifecycle.timeZone);
      if (local >= this.absoluteBounds.min && local <= this.absoluteBounds.max) {
        this.absoluteLocal.set(local);
      }
    } catch {
      /* Zeitpunkt liegt außerhalb der Sessionzeitzone oder ist ungültig. */
    }
  }
}
