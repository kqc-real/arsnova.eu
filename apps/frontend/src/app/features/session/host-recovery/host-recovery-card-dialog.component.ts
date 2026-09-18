import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import type { HostRecoveryCardDTO } from '@arsnova/shared-types';
import { localizeCommands, resolveLocalizedAppUrl } from '../../../core/locale-router';
import {
  buildHostRecoveryCardHtml,
  buildHostRecoveryCardPlainText,
  type HostRecoveryCardHtmlLabels,
} from './host-recovery-card-format';

export type HostRecoveryCardDialogData = HostRecoveryCardDTO & {
  setupStep?: number;
  setupStepCount?: number;
};

type RecoveryCardField = 'supportId' | 'recoveryCode' | 'all';

@Component({
  selector: 'app-host-recovery-card-dialog',
  standalone: true,
  imports: [
    MatButton,
    MatCheckbox,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
    MatIconButton,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './host-recovery-card-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './host-recovery-card-dialog.component.scss',
  ],
})
export class HostRecoveryCardDialogComponent {
  private readonly document = inject(DOCUMENT);
  readonly data = inject<HostRecoveryCardDialogData>(MAT_DIALOG_DATA);
  readonly recoveryUrl = resolveLocalizedAppUrl('/host-recovery');
  readonly imprintCommands = localizeCommands(['legal', 'imprint']);
  readonly saved = signal(false);
  readonly copiedField = signal<RecoveryCardField | null>(null);
  readonly copyFailed = signal(false);
  readonly downloadStarted = signal(false);

  fieldValue(field: Exclude<RecoveryCardField, 'all'>): string {
    return field === 'supportId' ? this.data.supportId : this.data.recoveryCode;
  }

  async copy(field: Exclude<RecoveryCardField, 'all'>): Promise<void> {
    await this.writeClipboard(this.fieldValue(field), field);
  }

  async copyAll(): Promise<void> {
    await this.writeClipboard(this.buildPlainText(), 'all');
  }

  download(): void {
    const content = this.buildDownloadHtml();
    const url = URL.createObjectURL(new Blob([content], { type: 'text/html;charset=utf-8' }));
    const anchor = this.document.createElement('a');
    const safeId = this.data.supportId.replace(/[^A-Za-z0-9-]/g, '');
    anchor.href = url;
    anchor.download = `arsnova-host-notfallkarte-${safeId}.html`;
    this.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    this.downloadStarted.set(true);
    this.copyFailed.set(false);
  }

  cardLabels(): HostRecoveryCardHtmlLabels {
    const recoveryUrl = this.recoveryUrl;
    return {
      downloadHeading: $localize`:@@hostRecovery.downloadHeading:Host-Zugangsdaten`,
      downloadIntro: $localize`:@@hostRecovery.downloadIntro:Mit diesen Angaben kannst du deinen Host-Zugang auf einem anderen Gerät oder in einem anderen Browser wiederherstellen.`,
      supportIdLabel: $localize`:@@hostRecovery.supportIdLabel:Session-Kennung`,
      recoveryCodeLabel: $localize`:@@hostRecovery.recoveryCodeLabel:Wiederherstellungscode`,
      recoveryPageLabel: $localize`:@@hostRecovery.recoveryPageLabel:Wiederherstellungsseite`,
      supportIdHint: $localize`:@@hostRecovery.supportIdHint:Beginnt mit ARS-. Den sechsstelligen Teilnahme-Code brauchst du hier nicht.`,
      recoveryCodeHint: $localize`:@@hostRecovery.recoveryCodeHint:Halte diesen Code geheim.`,
      downloadHowTo: $localize`:@@hostRecovery.downloadHowTo:So stellst du den Host-Zugang wieder her`,
      downloadUsage: $localize`:@@hostRecovery.downloadUsage:Öffne ${recoveryUrl}:recoveryUrl: in dem Browser, in dem du die Session moderieren möchtest. Gib dort die Session-Kennung und den Wiederherstellungscode ein.`,
      downloadRotationNotice: $localize`:@@hostRecovery.downloadRotationNotice:Nach einer Wiederherstellung gilt der neu ausgegebene Wiederherstellungscode. Ersetze dann deine bisher gespeicherten Zugangsdaten.`,
      cardWarning: $localize`:@@hostRecovery.cardWarning:Wenn dir der Browserzugang und die gespeicherten Zugangsdaten fehlen, wende dich an den Support. Er muss deine Berechtigung für diese Session prüfen.`,
      supportContactLink: $localize`:@@hostRecovery.supportContactLink:Kontaktdaten im Impressum`,
      supportContactHref: resolveLocalizedAppUrl('/legal/imprint'),
    };
  }

  buildPlainText(): string {
    return buildHostRecoveryCardPlainText(this.data, this.recoveryUrl, this.cardLabels());
  }

  buildDownloadHtml(): string {
    return buildHostRecoveryCardHtml({
      card: this.data,
      recoveryUrl: this.recoveryUrl,
      lang: this.document.documentElement.lang || 'de',
      labels: this.cardLabels(),
    });
  }

  private async writeClipboard(value: string, field: RecoveryCardField): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    try {
      if (!clipboard) {
        throw new Error('clipboard unavailable');
      }
      await clipboard.writeText(value);
      this.copiedField.set(field);
      this.copyFailed.set(false);
      this.downloadStarted.set(false);
    } catch {
      this.copyFailed.set(true);
    }
  }
}
