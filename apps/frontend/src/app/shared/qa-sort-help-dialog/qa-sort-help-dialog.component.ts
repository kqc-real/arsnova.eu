import { Component, LOCALE_ID, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { renderMarkdownWithKatex } from '../markdown-katex.util';
import {
  QA_SORT_HELP_COPY,
  type QaSortHelpKind,
  resolveQaSortHelpLocale,
} from './qa-sort-help.content';

export interface QaSortHelpDialogData {
  kind: QaSortHelpKind;
}

@Component({
  selector: 'app-qa-sort-help-dialog',
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton, MatDialogClose, MatIcon],
  styleUrls: ['../styles/dialog-title-header.scss', './qa-sort-help-dialog.component.scss'],
  template: `
    <h2 mat-dialog-title class="dialog-title-header">
      <span class="dialog-title-header__icon" aria-hidden="true">
        <mat-icon>{{ icon }}</mat-icon>
      </span>
      <span class="dialog-title-header__copy">
        <span class="dialog-title-header__heading">{{ title }}</span>
      </span>
    </h2>
    <mat-dialog-content class="qa-sort-help-dialog__content">
      <div class="markdown-body qa-sort-help-dialog__body" [innerHTML]="bodyHtml"></div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-flat-button
        color="primary"
        type="button"
        mat-dialog-close
        i18n="@@sessionQa.sortHelpClose"
      >
        Schließen
      </button>
    </mat-dialog-actions>
  `,
})
export class QaSortHelpDialogComponent {
  private readonly data = inject<QaSortHelpDialogData>(MAT_DIALOG_DATA);
  private readonly localeId = inject(LOCALE_ID);
  private readonly sanitizer = inject(DomSanitizer);

  readonly kind = this.data.kind;
  readonly icon = this.kind === 'BEST' ? 'auto_awesome' : 'compare_arrows';

  private readonly copy =
    QA_SORT_HELP_COPY[this.kind][resolveQaSortHelpLocale(String(this.localeId))];

  readonly title = this.copy.title;
  readonly bodyHtml: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    renderMarkdownWithKatex(this.copy.markdown, { headingStartLevel: 3 }).html,
  );
}
