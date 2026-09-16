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
import type { HostRecoveryCardDTO } from '@arsnova/shared-types';
import { resolveLocalizedAppUrl } from '../../../core/locale-router';

export type HostRecoveryCardDialogData = HostRecoveryCardDTO & {
  setupStep?: number;
  setupStepCount?: number;
};

type RecoveryCardField = 'supportId' | 'recoveryCode';

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
  readonly saved = signal(false);
  readonly copiedField = signal<RecoveryCardField | null>(null);
  readonly copyFailed = signal(false);

  fieldValue(field: RecoveryCardField): string {
    return field === 'supportId' ? this.data.supportId : this.data.recoveryCode;
  }

  async copy(field: RecoveryCardField): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    try {
      if (!clipboard) {
        throw new Error('clipboard unavailable');
      }
      await clipboard.writeText(this.fieldValue(field));
      this.copiedField.set(field);
      this.copyFailed.set(false);
    } catch {
      this.copyFailed.set(true);
    }
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
    this.saved.set(true);
  }

  buildDownloadHtml(): string {
    const lang = this.document.documentElement.lang || 'de';
    const heading = $localize`:@@hostRecovery.downloadHeading:Host-Notfallkarte`;
    const why = $localize`:@@hostRecovery.cardWhy:Dein Host-Zugang ist in diesem Browser gespeichert. Mit der Notfallkarte kannst du ihn auf einem anderen Gerät wiederherstellen.`;
    const intro = $localize`:@@hostRecovery.cardIntro:Öffne dazu die Wiederherstellungsseite und gib die Session-Kennung und den Wiederherstellungscode ein.`;
    const supportLabel = $localize`:@@hostRecovery.supportIdLabel:Session-Kennung`;
    const recoveryLabel = $localize`:@@hostRecovery.recoveryCodeLabel:Wiederherstellungscode`;
    const supportHint = $localize`:@@hostRecovery.supportIdHint:Diese Kennung identifiziert die Session bei der Wiederherstellung. Sie ist nicht der öffentliche Beitrittscode.`;
    const recoveryHint = $localize`:@@hostRecovery.recoveryCodeHint:Halte diesen Code geheim. Zusammen mit der Session-Kennung ermöglicht er den Host-Zugang.`;
    const howTo = $localize`:@@hostRecovery.downloadHowTo:So stellst du den Host-Zugang wieder her`;
    const recoveryUrl = this.recoveryUrl;
    const usage = $localize`:@@hostRecovery.downloadUsage:Öffne ${recoveryUrl}:recoveryUrl: und gib Session-Kennung plus Wiederherstellungscode ein.`;
    const recoveryLink = `<a class="usage-link" href="${escapeHtml(recoveryUrl)}">${escapeHtml(recoveryUrl)}</a>`;
    const usageHtml = escapeHtml(usage).replaceAll(escapeHtml(recoveryUrl), recoveryLink);
    const warning = $localize`:@@hostRecovery.cardWarning:Wenn Browserzugang und Notfallkarte verloren sind, wende dich an den Support. Er muss deine Berechtigung für diese Session prüfen. Die Kontaktdaten findest du im »Impressum«.`;
    return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(heading)}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      padding: 1.5rem 1rem 2rem;
      font-family: system-ui, sans-serif;
      line-height: 1.5;
      background: #f4f6f8;
      color: #1a1c1e;
    }
    .card {
      max-width: 40rem;
      margin: 0 auto;
      padding: 1.5rem 1.35rem 1.4rem;
      border: 1px solid #c3c6cf;
      border-radius: 1.25rem;
      background: #fff;
      box-shadow: 0 8px 24px rgb(26 28 30 / 8%);
    }
    h1 {
      margin: 0 0 0.35rem;
      font-size: 1.35rem;
      line-height: 1.3;
    }
    .brand {
      margin: 0 0 0.75rem;
      color: #43474e;
      font-size: 0.95rem;
    }
    .intro {
      margin: 0 0 0.75rem;
      color: #43474e;
      font-size: 0.95rem;
    }
    dl { margin: 0; display: grid; gap: 0.75rem; }
    .field {
      margin: 0;
      padding: 0.85rem 0.95rem;
      border: 1px solid #c3c6cf;
      border-radius: 0.85rem;
      background: #f8f9fb;
    }
    .field--secret {
      border-color: #ba1a1a;
      background: #fff2f1;
    }
    dt {
      margin: 0;
      color: #43474e;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    dd {
      margin: 0.2rem 0 0;
      overflow-wrap: anywhere;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 1.05rem;
      font-weight: 600;
      user-select: all;
    }
    .hint {
      margin: 0.35rem 0 0;
      color: #43474e;
      font-family: system-ui, sans-serif;
      font-size: 0.9rem;
      font-weight: 400;
    }
    h2 {
      margin: 1.25rem 0 0.35rem;
      font-size: 1rem;
    }
    .usage, .warn {
      margin: 0;
    }
    .usage-link {
      overflow-wrap: anywhere;
      color: #0b57d0;
    }
    .warn {
      margin-top: 1rem;
      padding: 0.75rem 0.85rem;
      border-radius: 0.75rem;
      background: #e8f2ff;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #111318; color: #e2e2e6; }
      .card { background: #1b1f24; border-color: #43474e; box-shadow: none; }
      .brand, .intro, dt, .hint { color: #c3c6cf; }
      .field { background: #111318; border-color: #43474e; }
      .field--secret { background: #3f1113; border-color: #ffb4ab; }
      .warn { background: #1d3248; }
      .usage-link { color: #a8c7fa; }
    }
    @media print {
      body { padding: 0; background: #fff; }
      .card { box-shadow: none; }
    }
  </style>
</head>
<body>
  <article class="card">
    <h1>${escapeHtml(heading)}</h1>
    <p class="brand">arsnova.eu</p>
    <p class="intro">${escapeHtml(why)}</p>
    <p class="intro">${escapeHtml(intro)}</p>
    <dl>
      <div class="field">
        <dt>${escapeHtml(supportLabel)}</dt>
        <dd>${escapeHtml(this.data.supportId)}</dd>
        <p class="hint">${escapeHtml(supportHint)}</p>
      </div>
      <div class="field field--secret">
        <dt>${escapeHtml(recoveryLabel)}</dt>
        <dd>${escapeHtml(this.data.recoveryCode)}</dd>
        <p class="hint">${escapeHtml(recoveryHint)}</p>
      </div>
    </dl>
    <h2>${escapeHtml(howTo)}</h2>
    <p class="usage">${usageHtml}</p>
    <p class="warn">${escapeHtml(warning)}</p>
  </article>
</body>
</html>
`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
