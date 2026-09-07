import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import type { AdminProductFeedbackLlmExportInput } from '@arsnova/shared-types';
import { localizeKnownServerError } from '../../core/localize-known-server-message';
import { trpc } from '../../core/trpc.client';

export type AdminProductFeedbackLlmExportDialogData = Omit<
  AdminProductFeedbackLlmExportInput,
  'includeMessages' | 'excludeDiscarded'
>;

@Component({
  selector: 'app-admin-product-feedback-llm-export-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatCheckbox,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
    MatProgressSpinner,
  ],
  templateUrl: './admin-product-feedback-llm-export-dialog.component.html',
  styleUrls: [
    '../../shared/styles/dialog-title-header.scss',
    './admin-product-feedback-llm-export-dialog.component.scss',
  ],
})
export class AdminProductFeedbackLlmExportDialogComponent {
  readonly dialogRef = inject(MatDialogRef<AdminProductFeedbackLlmExportDialogComponent>);
  readonly data = inject<AdminProductFeedbackLlmExportDialogData>(MAT_DIALOG_DATA);

  includeMessages = false;
  excludeDiscarded = true;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly status = signal<string | null>(null);

  async downloadMarkdown(): Promise<void> {
    const output = await this.requestExport();
    if (!output) return;
    this.saveFile(output.fileName, output.markdown);
    this.status.set(
      $localize`:@@admin.productFeedback.exportLlmDownloaded:Markdown-Datei gespeichert.`,
    );
  }

  async copyPrompt(): Promise<void> {
    const output = await this.requestExport();
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output.prompt);
      this.status.set($localize`:@@admin.productFeedback.exportLlmCopied:Anweisung kopiert.`);
    } catch {
      this.error.set(
        $localize`:@@admin.productFeedback.exportLlmCopyFailed:Die Anweisung konnte nicht kopiert werden.`,
      );
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  private async requestExport(): Promise<{
    fileName: string;
    markdown: string;
    prompt: string;
  } | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.error.set(null);
    this.status.set($localize`:@@admin.productFeedback.exportLlmPending:Export wird vorbereitet …`);
    try {
      return await trpc.admin.productFeedback.exportForLlm.mutate({
        ...this.data,
        includeMessages: this.includeMessages,
        excludeDiscarded: this.excludeDiscarded,
      });
    } catch (error) {
      this.status.set(null);
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@admin.productFeedback.exportLlmError:Der Export konnte nicht erstellt werden. Versuche es erneut.`,
        ),
      );
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  private saveFile(fileName: string, markdown: string): void {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
