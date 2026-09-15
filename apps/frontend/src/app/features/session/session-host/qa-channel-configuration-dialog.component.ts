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
  template: `
    <h2 mat-dialog-title class="qa-config__title">
      <mat-icon aria-hidden="true">forum</mat-icon>
      <span i18n="@@qaConfig.title">Q&A-Kanal einrichten</span>
    </h2>

    <mat-dialog-content>
      @if (!preview()) {
        <p i18n="@@qaConfig.intro">
          Lege Titel, Moderation, Teilnahmeprofil und die eigene Q&A-Frist gemeinsam fest.
        </p>

        <fieldset class="qa-config__group" [disabled]="pending()">
          <legend i18n="@@qaConfig.contentLegend">Inhalt</legend>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@qaConfig.qaTitleLabel">Titel der Fragenwand</mat-label>
            <input matInput maxlength="120" [(ngModel)]="qaTitle" />
          </mat-form-field>
          <mat-slide-toggle [(ngModel)]="moderationMode" i18n="@@qaConfig.moderationLabel">
            Neue Fragen vor Veröffentlichung prüfen
          </mat-slide-toggle>
        </fieldset>

        <fieldset class="qa-config__group" [disabled]="pending() || data.profileLocked">
          <legend i18n="@@qaConfig.profileLegend">Teilnahmeprofil</legend>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@qaConfig.identityModeLabel">Sichtbarer Name</mat-label>
            <mat-select [(ngModel)]="identityMode">
              <mat-option value="PRESET_PSEUDONYM" i18n="@@qaConfig.identityPreset">
                Automatisches Pseudonym
              </mat-option>
              <mat-option value="CUSTOM_NICKNAME" i18n="@@qaConfig.identityCustom">
                Eigener Nickname
              </mat-option>
              <mat-option value="ANONYMOUS" i18n="@@qaConfig.identityAnonymous">
                Anonym ohne Verfassername
              </mat-option>
            </mat-select>
          </mat-form-field>
          @if (data.profileLocked) {
            <p class="qa-config__notice" role="status" i18n="@@qaConfig.profileLocked">
              Das Teilnahmeprofil ist nach dem ersten Beitritt gesperrt.
            </p>
          }
        </fieldset>

        <fieldset class="qa-config__group" [disabled]="pending()">
          <legend i18n="@@qaConfig.deadlineLegend">Q&A-Frist</legend>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@qaConfig.deadlineKindLabel">Fristtyp</mat-label>
            <mat-select [(ngModel)]="deadlineKind">
              <mat-option value="UNTIL_SESSION_END" i18n="@@qaConfig.untilSessionEnd">
                Bis zum Sessionende
              </mat-option>
              <mat-option value="DURATION_DAYS" i18n="@@qaConfig.durationDays">
                Für Kalendertage
              </mat-option>
              <mat-option value="ABSOLUTE" i18n="@@qaConfig.absolute">
                Bis Datum und Uhrzeit
              </mat-option>
            </mat-select>
          </mat-form-field>

          @if (deadlineKind === 'DURATION_DAYS') {
            <mat-form-field appearance="outline">
              <mat-label i18n="@@qaConfig.daysLabel">Kalendertage</mat-label>
              <input matInput type="number" min="1" max="30" [(ngModel)]="days" />
            </mat-form-field>
          } @else if (deadlineKind === 'ABSOLUTE') {
            <mat-form-field appearance="outline">
              <mat-label i18n="@@qaConfig.absoluteLabel">Datum und Uhrzeit</mat-label>
              <input matInput type="datetime-local" [(ngModel)]="absoluteLocal" />
            </mat-form-field>
          }
          <p class="qa-config__zone">
            <span i18n="@@qaConfig.timeZone">Zeitzone:</span>
            {{ timeZone }}
          </p>
        </fieldset>
      } @else {
        <section class="qa-config__preview" aria-labelledby="qa-config-preview-title">
          <h3 id="qa-config-preview-title" i18n="@@qaConfig.previewTitle">Verbindliche Vorschau</h3>
          <dl>
            <div>
              <dt i18n="@@qaConfig.previewQaCloses">Q&A schließt</dt>
              <dd>{{ formatDateTime(preview()!.newQaClosesAt) }}</dd>
            </div>
            <div>
              <dt i18n="@@qaConfig.previewSessionEnds">Session endet</dt>
              <dd>{{ formatDateTime(preview()!.newExpiresAt) }}</dd>
            </div>
            <div>
              <dt i18n="@@qaConfig.previewProfile">Teilnahmeprofil</dt>
              <dd>{{ identityModeLabel(identityMode) }}</dd>
            </div>
          </dl>
          @if (preview()!.requiresSessionExtension) {
            <p class="qa-config__warning" role="status" i18n="@@qaConfig.extensionWarning">
              Die Q&A-Frist liegt nach dem bisherigen Sessionende. Beim Bestätigen wird die globale
              Sessionfrist mit verlängert; nur der ursprüngliche Host darf das ausführen.
            </p>
          } @else {
            <p class="qa-config__notice" role="status" i18n="@@qaConfig.noExtension">
              Die globale Sessionfrist bleibt unverändert.
            </p>
          }
        </section>
      }

      @if (error()) {
        <p class="qa-config__error" role="alert">{{ error() }}</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (preview()) {
        <button mat-button type="button" [disabled]="pending()" (click)="edit()" i18n>
          Zurück
        </button>
        <button mat-flat-button type="button" [disabled]="pending()" (click)="confirm()" i18n>
          Q&A verbindlich einrichten
        </button>
      } @else {
        <button mat-button type="button" [disabled]="pending()" (click)="close()" i18n>
          Abbrechen
        </button>
        <button mat-flat-button type="button" [disabled]="pending()" (click)="loadPreview()" i18n>
          Vorschau prüfen
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
      inline-size: min(42rem, 100%);
    }
    .qa-config__title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .qa-config__group {
      display: grid;
      gap: 0.75rem;
      margin-block: 1rem;
      padding: 1rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 0.75rem;
    }
    .qa-config__group legend {
      padding-inline: 0.25rem;
      font-weight: 600;
    }
    mat-form-field {
      inline-size: 100%;
    }
    .qa-config__zone {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .qa-config__preview dl,
    .qa-config__preview dl div {
      display: grid;
      gap: 0.25rem;
    }
    .qa-config__preview dl {
      gap: 0.75rem;
    }
    .qa-config__preview dt {
      color: var(--mat-sys-on-surface-variant);
    }
    .qa-config__preview dd {
      margin: 0;
      font-weight: 600;
    }
    .qa-config__notice,
    .qa-config__warning {
      padding: 0.875rem;
      border-radius: 0.75rem;
    }
    .qa-config__notice {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .qa-config__warning {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .qa-config__error {
      color: var(--mat-sys-error);
    }
  `,
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
      const configured = await trpc.session.configureQaChannel.mutate({
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
      });
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
    if (this.data.profileLocked) {
      return undefined;
    }
    return {
      nicknameTheme: this.data.session.nicknameTheme ?? 'HIGH_SCHOOL',
      identityMode: this.identityMode,
    };
  }
}
