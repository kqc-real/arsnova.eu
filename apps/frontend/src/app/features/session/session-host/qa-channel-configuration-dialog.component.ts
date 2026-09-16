import { Component, LOCALE_ID, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
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
import { trpc } from '../../../core/trpc.client';
import { sessionLocalDateTimeToIso } from '../session-local-datetime';

export interface QaChannelConfigurationDialogData {
  code: string;
  session: SessionInfoDTO;
  profileLocked: boolean;
  setupStep?: number;
  setupStepCount?: number;
}

@Component({
  selector: 'app-qa-channel-configuration-dialog',
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
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    MatSlideToggle,
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
  private readonly dialogRef = inject(
    MatDialogRef<QaChannelConfigurationDialogComponent, SessionQaConfigurationDTO | null>,
  );
  private previewRequest = 0;

  readonly pending = signal(false);
  readonly error = signal<string | null>(null);
  readonly preview = signal<SessionQaConfigurationPreviewDTO | null>(null);
  readonly profileLocked = signal(this.data.profileLocked);
  readonly maxSelectableDays = signal(30);
  readonly timeZone = this.data.session.timeZone ?? 'UTC';

  qaTitle =
    this.data.session.title?.trim() || $localize`:@@qaConfig.defaultTitle:Fragen & Antworten`;
  moderationMode = true;
  identityMode: SessionParticipantIdentityMode = this.resolveIdentityMode();
  deadlineKind: SessionQaDeadlineSelection['kind'] = 'UNTIL_SESSION_END';
  days = 1;
  absoluteLocal = '';

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
    if (this.configurationMode() === 'REPLAN') {
      return $localize`:@@qaConfig.save:Änderungen speichern`;
    }
    if (this.preview()?.requiresSessionExtension) {
      return $localize`:@@qaConfig.confirmWithExtension:Session verlängern und Fragerunde öffnen`;
    }
    return $localize`:@@qaConfig.confirm:Fragerunde öffnen`;
  }

  async confirm(): Promise<void> {
    const selection = this.buildSelection();
    if (!selection) {
      return;
    }
    if (!this.qaTitle.trim()) {
      this.error.set(
        $localize`:@@qaConfig.invalidTitle:Bitte gib einen Titel für die Fragenwand ein.`,
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
        this.applyMaxSelectableDays(next.maxExpiresAt);
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
      });
    } catch (error) {
      if (mode === 'INITIAL' && this.isQaAlreadyConfiguredError(error)) {
        return trpc.session.previewQaConfiguration.query({
          code: this.data.code,
          mode: 'REPLAN',
          selection,
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
      if (!Number.isInteger(days) || days < 1 || days > this.maxSelectableDays()) {
        if (!silent) {
          const maxDays = this.maxSelectableDays();
          this.error.set(
            $localize`:@@qaConfig.invalidDays:Bitte gib 1 bis ${maxDays}:maxDays: Tage ein.`,
          );
        }
        return null;
      }
      return { kind: 'DURATION_DAYS', days };
    }
    try {
      return {
        kind: 'ABSOLUTE',
        closesAt: sessionLocalDateTimeToIso(this.absoluteLocal, this.timeZone),
      };
    } catch {
      if (!silent) {
        this.error.set(
          $localize`:@@qaConfig.invalidLocalDate:Diese lokale Uhrzeit ist in der Sessionzeitzone nicht eindeutig oder ungültig.`,
        );
      }
      return null;
    }
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
    if (this.profileLocked()) {
      return undefined;
    }
    return {
      nicknameTheme: this.data.session.nicknameTheme ?? 'HIGH_SCHOOL',
      identityMode: this.identityMode,
    };
  }

  private applyMaxSelectableDays(maxExpiresAt: string | undefined): void {
    const start = Date.parse(this.data.session.serverNow ?? this.data.session.serverTime);
    const end = Date.parse(maxExpiresAt ?? '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return;
    }
    this.maxSelectableDays.set(Math.max(1, Math.min(30, Math.floor((end - start) / 86_400_000))));
  }

  private applyAuthoritativeProfileLock(locked: boolean): void {
    this.profileLocked.set(locked);
    if (locked) {
      this.identityMode = this.resolveIdentityMode();
    }
  }
}
