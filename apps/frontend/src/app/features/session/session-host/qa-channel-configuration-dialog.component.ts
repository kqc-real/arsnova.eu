import { Component, ElementRef, LOCALE_ID, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import type {
  NicknameTheme,
  SessionInfoDTO,
  SessionParticipantIdentityMode,
  SessionQaConfigurationDTO,
  SessionQaConfigurationPreviewDTO,
  SessionQaDeadlineSelection,
} from '@arsnova/shared-types';
import { firstValueFrom } from 'rxjs';
import { trpc } from '../../../core/trpc.client';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../../../shared/confirm-leave-dialog/confirm-leave-dialog.component';
import {
  calendarDateToSessionLocalDay,
  clampSessionLocalDateTimeToBounds,
  clampSessionLocalTimeToBounds,
  combineSessionLocalDateAndTime,
  isoToSessionLocalDateTime,
  maxSelectableCalendarDays,
  openSessionDateTimePicker,
  reportSessionDateTimePickerValidity,
  sessionDateTimeLocalBounds,
  sessionDeadlineDateClass,
  sessionLocalDatePart,
  sessionLocalDateTimeToIso,
  sessionLocalDayToCalendarDate,
  sessionLocalTimePart,
} from '../session-local-datetime';

const QA_EXTENSION_DIALOG_OVERLAY = {
  panelClass: 'session-lifecycle-dialog-panel',
  backdropClass: 'session-lifecycle-dialog-backdrop',
} as const;

export interface QaChannelConfigurationDialogData {
  code: string;
  session: SessionInfoDTO;
  profileLocked: boolean;
  setupStep?: number;
  setupStepCount?: number;
  omitParticipationProfile?: boolean;
  /** Harte Obergrenze und Serverzeit aus der Host-Lifecycle, unabhängig von der Vorschau. */
  maxExpiresAt: string;
  serverNow: string;
}

@Component({
  selector: 'app-qa-channel-configuration-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatDatepickerModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    MatSlideToggle,
    MatSuffix,
  ],
  templateUrl: './qa-channel-configuration-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './qa-channel-configuration-dialog.component.scss',
  ],
})
export class QaChannelConfigurationDialogComponent implements OnInit {
  readonly data = inject<QaChannelConfigurationDialogData>(MAT_DIALOG_DATA);
  private readonly localeId = inject(LOCALE_ID);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(
    MatDialogRef<QaChannelConfigurationDialogComponent, SessionQaConfigurationDTO | null>,
  );
  private previewRequest = 0;
  private readonly absoluteTimeInput = viewChild<ElementRef<HTMLInputElement>>('absoluteTimeInput');

  readonly pending = signal(false);
  readonly error = signal<string | null>(null);
  readonly preview = signal<SessionQaConfigurationPreviewDTO | null>(null);
  readonly profileLocked = signal(this.data.profileLocked);
  readonly timeZone = this.data.session.timeZone ?? 'UTC';
  readonly maxSelectableDays = signal(
    maxSelectableCalendarDays(this.data.serverNow, this.data.maxExpiresAt, this.timeZone),
  );
  readonly canReopen = this.isClosedOrExpired();

  qaTitle = this.resolveInitialTitle();
  moderationMode = this.resolveInitialModeration();
  identityMode: SessionParticipantIdentityMode = this.resolveIdentityMode();
  deadlineKind: SessionQaDeadlineSelection['kind'] = this.resolveInitialDeadlineKind();
  days = 1;
  absoluteDate: Date | null = null;
  absoluteTime = '12:00';
  reopenQa = false;

  /** Kompatibel für Tests und Preview: kombiniert Datum und Uhrzeit. */
  get absoluteLocal(): string {
    return combineSessionLocalDateAndTime(this.absoluteDate, this.absoluteTime);
  }

  set absoluteLocal(value: string) {
    if (!value) {
      this.absoluteDate = null;
      this.absoluteTime = '12:00';
      return;
    }
    this.absoluteDate = sessionLocalDayToCalendarDate(sessionLocalDatePart(value));
    this.absoluteTime = sessionLocalTimePart(value);
  }

  constructor() {
    this.absoluteLocal = this.resolveInitialAbsoluteLocal();
  }

  ngOnInit(): void {
    void this.refreshPreview();
  }

  onDeadlineChange(): Promise<void> {
    return this.refreshPreview();
  }

  dialogTitle(): string {
    return this.configurationMode() === 'REPLAN'
      ? $localize`:@@qaConfig.editTitle:Fragerunde bearbeiten`
      : $localize`:@@qaConfig.title:Fragerunde einrichten`;
  }

  confirmLabel(): string {
    const needsExtension = this.preview()?.requiresSessionExtension === true;
    if (this.configurationMode() === 'REPLAN') {
      if (this.willReopenQa()) {
        return needsExtension
          ? $localize`:@@qaConfig.reopenWithExtension:Session verlängern und Fragerunde wieder öffnen`
          : $localize`:@@qaConfig.reopen:Fragerunde wieder öffnen`;
      }
      return needsExtension
        ? $localize`:@@qaConfig.saveWithExtension:Session verlängern und Änderungen speichern`
        : $localize`:@@qaConfig.save:Änderungen speichern`;
    }
    if (needsExtension) {
      return $localize`:@@qaConfig.confirmWithExtension:Session verlängern und Fragerunde öffnen`;
    }
    return $localize`:@@qaConfig.confirm:Fragerunde öffnen`;
  }

  async confirm(): Promise<void> {
    const timeField = this.absoluteTimeInput()?.nativeElement;
    if (timeField?.value) {
      this.absoluteTime = timeField.value;
    }
    const selection = this.buildSelection();
    if (!selection) {
      return;
    }
    if (
      selection.kind === 'ABSOLUTE' &&
      !this.unchangedSavedAbsoluteClosesAt() &&
      timeField &&
      !reportSessionDateTimePickerValidity(timeField)
    ) {
      return;
    }
    if (!this.qaTitle.trim()) {
      this.error.set(
        $localize`:@@qaConfig.invalidTitle:Bitte gib einen Titel für die Fragenwand ein.`,
      );
      return;
    }
    if (this.willReopenQa() && this.deadlineIsNotInTheFuture(selection)) {
      this.error.set(
        $localize`:@@qaConfig.reopenNeedsFutureDeadline:Zum Wiederöffnen brauchst du eine Teilnahmefrist in der Zukunft. Wähle ein neues Datum und eine Uhrzeit.`,
      );
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      let preview: SessionQaConfigurationPreviewDTO;
      try {
        preview = await this.fetchPreview(selection);
      } catch {
        this.error.set(
          $localize`:@@qaConfig.previewError:Die Q&A-Konfiguration konnte nicht geprüft werden. Bitte kontrolliere die Angaben und versuche es erneut.`,
        );
        return;
      }
      this.preview.set(preview);
      if (preview.requiresSessionExtension) {
        const confirmedExtension = await this.confirmRequiredSessionExtension(preview);
        if (!confirmedExtension) {
          return;
        }
      }
      const lifecycle = await trpc.session.getLifecycleForHost.query({ code: this.data.code });
      this.applyAuthoritativeProfileLock(Boolean(lifecycle.firstParticipantJoinedAt));
      const request = {
        code: this.data.code,
        mode: preview.mode,
        selection,
        expectedLifecycleRevision: preview.expectedLifecycleRevision,
        previewServerNow: preview.serverNow,
        confirmedQaClosesAt: preview.newQaClosesAt,
        confirmedExpiresAt: preview.newExpiresAt,
        confirmSessionExtension: preview.requiresSessionExtension,
        reopenQa: this.willReopenQa(),
        qaTitle: this.qaTitle.trim(),
        moderationMode: this.moderationMode,
        participationProfile: this.buildParticipationProfile(),
      };
      let configured: SessionQaConfigurationDTO;
      try {
        configured = await trpc.session.configureQaChannel.mutate(request);
      } catch (error) {
        const refreshed = await trpc.session.getLifecycleForHost.query({ code: this.data.code });
        const joinedWhileDialogWasOpen = Boolean(refreshed.firstParticipantJoinedAt);
        this.applyAuthoritativeProfileLock(joinedWhileDialogWasOpen);
        if (!request.participationProfile || !joinedWhileDialogWasOpen) {
          throw error;
        }
        configured = await trpc.session.configureQaChannel.mutate({
          ...request,
          participationProfile: undefined,
        });
      }
      this.dialogRef.close(configured);
    } catch {
      this.error.set(
        $localize`:@@qaConfig.confirmError:Q&A konnte nicht eingerichtet werden. Lade die Session neu und prüfe die Fristen erneut.`,
      );
    } finally {
      this.pending.set(false);
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }

  private async confirmRequiredSessionExtension(
    preview: SessionQaConfigurationPreviewDTO,
  ): Promise<boolean> {
    const consequences = [
      $localize`:@@qaConfig.extensionNewQa:Zugang für Teilnehmende endet: ${this.formatDateTime(preview.newQaClosesAt)}:date:`,
      $localize`:@@qaConfig.extensionPostProcessing:Fragen einsehen kannst du bis: ${this.formatDateTime(preview.projectedPostProcessingEndsAt)}:date:`,
    ];
    const dialogRef = this.dialog.open(ConfirmLeaveDialogComponent, {
      data: {
        title: $localize`:@@qaConfig.extensionConfirmTitle:Frist bestätigen`,
        message: '',
        consequences,
        confirmLabel: this.confirmLabel(),
        cancelLabel: $localize`:@@common.cancel:Abbrechen`,
      } satisfies ConfirmLeaveDialogData,
      width: 'min(32rem, calc(100vw - 2rem))',
      maxWidth: '100vw',
      autoFocus: 'first-tabbable',
      restoreFocus: false,
      ...QA_EXTENSION_DIALOG_OVERLAY,
    });
    return (await firstValueFrom(dialogRef.afterClosed())) === true;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat(this.localeId, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: this.timeZone,
      timeZoneName: 'short',
    }).format(new Date(value));
  }

  openAbsoluteTimePicker(input: HTMLInputElement): void {
    openSessionDateTimePicker(input);
  }

  absoluteMinLocal(): string {
    return this.absoluteBounds()?.min ?? '';
  }

  absoluteMaxLocal(): string {
    return this.absoluteBounds()?.max ?? '';
  }

  absoluteMinDate(): Date | null {
    const min = this.absoluteMinLocal();
    return min ? sessionLocalDayToCalendarDate(sessionLocalDatePart(min)) : null;
  }

  absoluteMaxDate(): Date | null {
    const max = this.absoluteMaxLocal();
    return max ? sessionLocalDayToCalendarDate(sessionLocalDatePart(max)) : null;
  }

  absoluteTimeMin(): string | null {
    const date = this.absoluteDate;
    const min = this.absoluteMinLocal();
    if (!date || !min) {
      return null;
    }
    if (calendarDateToSessionLocalDay(date) !== sessionLocalDatePart(min)) {
      return null;
    }
    return sessionLocalTimePart(min);
  }

  absoluteTimeMax(): string | null {
    const date = this.absoluteDate;
    const max = this.absoluteMaxLocal();
    if (!date || !max) {
      return null;
    }
    if (calendarDateToSessionLocalDay(date) !== sessionLocalDatePart(max)) {
      return null;
    }
    return sessionLocalTimePart(max);
  }

  absoluteDateClass = (date: Date, view: string): string => {
    const min = this.absoluteMinLocal();
    const max = this.absoluteMaxLocal();
    if (!min || !max) {
      return '';
    }
    return sessionDeadlineDateClass(min, max, this.absoluteLocal)(date, view);
  };

  onAbsoluteDateChange(date: Date | null): void {
    this.absoluteDate = date;
    const bounds = this.absoluteBounds();
    if (date && bounds) {
      this.absoluteTime = clampSessionLocalTimeToBounds(
        date,
        this.absoluteTime,
        bounds.min,
        bounds.max,
      );
    }
    this.error.set(null);
    void this.onDeadlineChange();
  }

  onAbsoluteTimeChange(time: string): void {
    const bounds = this.absoluteBounds();
    if (this.absoluteDate && bounds) {
      this.absoluteTime = clampSessionLocalTimeToBounds(
        this.absoluteDate,
        time,
        bounds.min,
        bounds.max,
      );
    } else {
      this.absoluteTime = time;
    }
    this.error.set(null);
    void this.onDeadlineChange();
  }

  private absoluteBounds(): { min: string; max: string } | null {
    const minExclusive = this.preview()?.serverNow ?? this.data.serverNow;
    const maxInclusive = this.preview()?.maxExpiresAt ?? this.data.maxExpiresAt;
    if (!minExclusive || !maxInclusive) {
      return null;
    }
    return sessionDateTimeLocalBounds(minExclusive, maxInclusive, this.timeZone);
  }

  private async refreshPreview(): Promise<void> {
    const selection = this.buildSelection(true);
    if (!selection || !this.qaTitle.trim()) {
      this.preview.set(null);
      return;
    }
    const requestId = ++this.previewRequest;
    try {
      const next = await this.fetchPreview(selection);
      if (requestId === this.previewRequest) {
        this.preview.set(next);
        this.applyMaxSelectableDays(next.maxExpiresAt, next.serverNow);
      }
    } catch {
      if (requestId === this.previewRequest) {
        this.preview.set(null);
      }
    }
  }

  private async fetchPreview(
    selection: SessionQaDeadlineSelection,
  ): Promise<SessionQaConfigurationPreviewDTO> {
    const mode = this.configurationMode();
    try {
      return await trpc.session.previewQaConfiguration.query({
        code: this.data.code,
        mode,
        selection,
        reopenQa: this.willReopenQa(),
      });
    } catch (error) {
      if (mode === 'INITIAL' && this.isQaAlreadyConfiguredError(error)) {
        return trpc.session.previewQaConfiguration.query({
          code: this.data.code,
          mode: 'REPLAN',
          selection,
          reopenQa: this.willReopenQa(),
        });
      }
      throw error;
    }
  }

  private buildSelection(silent = false): SessionQaDeadlineSelection | null {
    if (this.deadlineKind === 'UNTIL_SESSION_END') {
      return { kind: 'UNTIL_SESSION_END' };
    }
    if (this.deadlineKind === 'DURATION_DAYS') {
      const days = Number(this.days);
      const maxDays = this.maxSelectableDays();
      const upperBound = maxDays >= 1 ? maxDays : 30;
      if (!Number.isInteger(days) || days < 1 || days > upperBound || (!silent && maxDays < 1)) {
        if (!silent) {
          this.error.set(
            maxDays < 1
              ? $localize`:@@qaConfig.noFullDayLeft:Kein voller Kalendertag ist mehr zulässig. Wähle ein Datum und eine Uhrzeit.`
              : $localize`:@@qaConfig.invalidDays:Bitte gib 1 bis ${maxDays}:maxDays: Tage ein.`,
          );
        }
        return null;
      }
      return { kind: 'DURATION_DAYS', days };
    }
    const unchangedClosesAt = this.unchangedSavedAbsoluteClosesAt();
    if (unchangedClosesAt) {
      return { kind: 'ABSOLUTE', closesAt: unchangedClosesAt };
    }
    const local = this.absoluteLocal;
    const bounds = this.absoluteBounds();
    if (!local || !this.absoluteDate) {
      if (!silent) {
        this.error.set($localize`:@@qaConfig.absoluteRequired:Bitte wähle Datum und Uhrzeit.`);
      }
      return null;
    }
    if (!bounds) {
      if (!silent) {
        this.error.set($localize`:@@qaConfig.absoluteRequired:Bitte wähle Datum und Uhrzeit.`);
      }
      return null;
    }
    // Tage kommen nur aus dem erlaubten Kalender; Minuten an den Rändern still korrigieren.
    const clamped = clampSessionLocalDateTimeToBounds(local, bounds.min, bounds.max);
    if (clamped !== local) {
      this.absoluteLocal = clamped;
    }
    try {
      return {
        kind: 'ABSOLUTE',
        closesAt: sessionLocalDateTimeToIso(clamped, this.timeZone),
      };
    } catch {
      if (!silent) {
        this.error.set(
          $localize`:@@qaConfig.invalidLocalDate:Diese Uhrzeit gibt es in der Zeitzone der Session nicht oder sie kommt zweimal vor (Zeitumstellung). Wähle eine andere Minute.`,
        );
      }
      return null;
    }
  }

  private willReopenQa(): boolean {
    return this.configurationMode() === 'REPLAN' && this.canReopen && this.reopenQa;
  }

  private deadlineIsNotInTheFuture(selection: SessionQaDeadlineSelection): boolean {
    if (selection.kind !== 'ABSOLUTE') {
      return false;
    }
    const closesAt = Date.parse(selection.closesAt);
    const nowIso = this.preview()?.serverNow ?? this.data.session.serverNow;
    const now = nowIso ? Date.parse(nowIso) : Number.NaN;
    return Number.isFinite(closesAt) && Number.isFinite(now) && closesAt <= now;
  }

  private unchangedSavedAbsoluteClosesAt(): string | null {
    const saved = this.savedQaClosesAt();
    if (!saved || this.deadlineKind !== 'ABSOLUTE') {
      return null;
    }
    try {
      return this.absoluteLocal === isoToSessionLocalDateTime(saved, this.timeZone) ? saved : null;
    } catch {
      return saved;
    }
  }

  private resolveInitialTitle(): string {
    const saved = this.data.session.channels?.qa?.title?.trim();
    if (saved) {
      return saved;
    }
    return (
      this.data.session.title?.trim() || $localize`:@@qaConfig.defaultTitle:Fragen & Antworten`
    );
  }

  private resolveInitialModeration(): boolean {
    if (this.configurationMode() === 'REPLAN') {
      return this.data.session.channels?.qa?.moderationMode ?? true;
    }
    return true;
  }

  private resolveInitialDeadlineKind(): SessionQaDeadlineSelection['kind'] {
    if (this.configurationMode() !== 'REPLAN') {
      return 'UNTIL_SESSION_END';
    }
    const closesAt = this.savedQaClosesAt();
    const expiresAt = this.data.session.expiresAt;
    if (closesAt && expiresAt && closesAt === expiresAt) {
      return 'UNTIL_SESSION_END';
    }
    return closesAt ? 'ABSOLUTE' : 'UNTIL_SESSION_END';
  }

  private resolveInitialAbsoluteLocal(): string {
    const closesAt = this.savedQaClosesAt();
    if (!closesAt) {
      return '';
    }
    try {
      return isoToSessionLocalDateTime(closesAt, this.timeZone);
    } catch {
      return '';
    }
  }

  private savedQaClosesAt(): string | null {
    return this.data.session.qaClosesAt ?? this.data.session.channels?.qa?.closesAt ?? null;
  }

  private isClosedOrExpired(): boolean {
    const state = this.data.session.channels?.qa?.state;
    return state === 'MANUALLY_CLOSED' || state === 'DEADLINE_EXPIRED';
  }

  private resolveIdentityMode(): SessionParticipantIdentityMode {
    if (this.data.session.anonymousMode) {
      return 'ANONYMOUS';
    }
    return this.data.session.allowCustomNicknames ? 'CUSTOM_NICKNAME' : 'PRESET_PSEUDONYM';
  }

  private configurationMode(): 'INITIAL' | 'REPLAN' {
    const closesAt = this.data.session.qaClosesAt ?? this.data.session.channels?.qa?.closesAt;
    const state = this.data.session.channels?.qa?.state;
    if (
      closesAt ||
      state === 'OPEN' ||
      state === 'MANUALLY_CLOSED' ||
      state === 'DEADLINE_EXPIRED'
    ) {
      return 'REPLAN';
    }
    return 'INITIAL';
  }

  private isQaAlreadyConfiguredError(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('message' in error)) {
      return false;
    }
    return String(error.message).includes('Q&A wurde bereits eingerichtet.');
  }

  private buildParticipationProfile():
    | {
        identityMode: SessionParticipantIdentityMode;
        nicknameTheme: NicknameTheme;
      }
    | undefined {
    if (this.data.omitParticipationProfile || this.profileLocked()) {
      return undefined;
    }
    return {
      nicknameTheme: this.data.session.nicknameTheme ?? 'HIGH_SCHOOL',
      identityMode: this.identityMode,
    };
  }

  private applyMaxSelectableDays(maxExpiresAt: string | undefined, openedAt: string): void {
    this.maxSelectableDays.set(
      maxSelectableCalendarDays(openedAt, maxExpiresAt ?? '', this.timeZone),
    );
  }

  private applyAuthoritativeProfileLock(locked: boolean): void {
    this.profileLocked.set(locked);
    if (locked) {
      this.identityMode = this.resolveIdentityMode();
    }
  }
}
