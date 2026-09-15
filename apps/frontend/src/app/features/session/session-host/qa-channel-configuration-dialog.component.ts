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
}

@Component({
  selector: 'app-qa-channel-configuration-dialog',
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
    MatSlideToggle,
  ],
  templateUrl: './qa-channel-configuration-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './qa-channel-configuration-dialog.component.scss',
  ],
})
export class QaChannelConfigurationDialogComponent {
  readonly data = inject<QaChannelConfigurationDialogData>(MAT_DIALOG_DATA);
  private readonly localeId = inject(LOCALE_ID);
  private readonly dialogRef = inject(
    MatDialogRef<QaChannelConfigurationDialogComponent, SessionQaConfigurationDTO | null>,
  );

  readonly pending = signal(false);
  readonly error = signal<string | null>(null);
  readonly preview = signal<SessionQaConfigurationPreviewDTO | null>(null);
  readonly profileLocked = signal(this.data.profileLocked);
  readonly timeZone = this.data.session.timeZone ?? 'UTC';

  qaTitle =
    this.data.session.title?.trim() || $localize`:@@qaConfig.defaultTitle:Fragen & Antworten`;
  moderationMode = true;
  identityMode: SessionParticipantIdentityMode = this.resolveIdentityMode();
  deadlineKind: SessionQaDeadlineSelection['kind'] = 'UNTIL_SESSION_END';
  days = 1;
  absoluteLocal = '';

  async loadPreview(): Promise<void> {
    const selection = this.buildSelection();
    if (!selection || !this.qaTitle.trim()) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      this.preview.set(
        await trpc.session.previewQaConfiguration.query({
          code: this.data.code,
          mode: this.configurationMode(),
          selection,
        }),
      );
    } catch {
      this.error.set(
        $localize`:@@qaConfig.previewError:Die Q&A-Konfiguration konnte nicht geprüft werden. Bitte kontrolliere die Angaben und versuche es erneut.`,
      );
    } finally {
      this.pending.set(false);
    }
  }

  async confirm(): Promise<void> {
    const selection = this.buildSelection();
    if (!selection || !this.preview()) {
      return;
    }
    const preview = this.preview()!;
    this.pending.set(true);
    this.error.set(null);
    try {
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

  edit(): void {
    this.preview.set(null);
    this.error.set(null);
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

  identityModeLabel(mode: SessionParticipantIdentityMode): string {
    switch (mode) {
      case 'PRESET_PSEUDONYM':
        return $localize`:@@qaConfig.identityPreset:Automatisches Pseudonym`;
      case 'CUSTOM_NICKNAME':
        return $localize`:@@qaConfig.identityCustom:Eigener Nickname`;
      case 'ANONYMOUS':
        return $localize`:@@qaConfig.identityAnonymous:Anonym ohne Verfassername`;
    }
  }

  private buildSelection(): SessionQaDeadlineSelection | null {
    if (this.deadlineKind === 'UNTIL_SESSION_END') {
      return { kind: 'UNTIL_SESSION_END' };
    }
    if (this.deadlineKind === 'DURATION_DAYS') {
      const days = Number(this.days);
      if (!Number.isInteger(days) || days < 1 || days > 30) {
        this.error.set($localize`:@@qaConfig.invalidDays:Bitte gib 1 bis 30 Kalendertage ein.`);
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
      this.error.set(
        $localize`:@@qaConfig.invalidLocalDate:Diese lokale Uhrzeit ist in der Sessionzeitzone nicht eindeutig oder ungültig.`,
      );
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
    return this.data.session.qaClosesAt ? 'REPLAN' : 'INITIAL';
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

  private applyAuthoritativeProfileLock(locked: boolean): void {
    this.profileLocked.set(locked);
    if (locked) {
      this.identityMode = this.resolveIdentityMode();
    }
  }
}
