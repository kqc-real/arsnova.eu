import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import {
  PRODUCT_FEEDBACK_PURGE_CONFIRMATION,
  type ProductFeedbackPurgeScope,
} from '@arsnova/shared-types';
import { localizeKnownServerError } from '../../core/localize-known-server-message';
import { trpc } from '../../core/trpc.client';

export type AdminProductFeedbackPurgeDialogData = {
  untilDate: Date | null;
};

const PURGE_CHANGED_DE = 'Die Auswahl hat sich geändert. Bitte neu zählen und erneut bestätigen.';
const PURGE_PHRASE_DE = 'Sicherheitsabfrage fehlgeschlagen.';

@Component({
  selector: 'app-admin-product-feedback-purge-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButton,
    MatDatepickerModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatProgressSpinner,
    MatRadioButton,
    MatRadioGroup,
    MatSuffix,
  ],
  templateUrl: './admin-product-feedback-purge-dialog.component.html',
  styleUrls: [
    '../../shared/styles/dialog-title-header.scss',
    './admin-product-feedback-purge-dialog.component.scss',
  ],
})
export class AdminProductFeedbackPurgeDialogComponent {
  readonly dialogRef = inject(MatDialogRef<AdminProductFeedbackPurgeDialogComponent>);
  readonly data = inject<AdminProductFeedbackPurgeDialogData>(MAT_DIALOG_DATA);
  readonly confirmationPhrase = PRODUCT_FEEDBACK_PURGE_CONFIRMATION;
  readonly maxUntilDate = this.startOfLocalDay(new Date());

  scope: ProductFeedbackPurgeScope = 'UNTIL';
  untilDate: Date | null = this.clampUntilDate(this.data.untilDate);
  confirmationText = '';

  readonly count = signal<number | null>(null);
  readonly countBusy = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly status = signal<string | null>(null);

  private countGeneration = 0;

  constructor() {
    void this.refreshCount();
  }

  onScopeChanged(): void {
    void this.refreshCount();
  }

  onUntilDateChanged(): void {
    void this.refreshCount();
  }

  canPurge(): boolean {
    return (
      !this.busy() &&
      !this.countBusy() &&
      this.count() !== null &&
      this.phraseMatches() &&
      (this.scope === 'ALL' || this.isUntilDateAllowed(this.untilDate))
    );
  }

  phraseMatches(): boolean {
    return this.confirmationText.trim().toUpperCase() === this.confirmationPhrase;
  }

  close(): void {
    this.dialogRef.close();
  }

  async confirmPurge(): Promise<void> {
    if (!this.canPurge()) return;
    const expectedCount = this.count();
    const input = this.previewInput();
    if (expectedCount === null || !input) return;

    this.busy.set(true);
    this.dialogRef.disableClose = true;
    this.error.set(null);
    this.status.set($localize`:@@admin.productFeedback.purgeBusy:Rückmeldungen werden gelöscht …`);
    try {
      const output = await trpc.admin.productFeedback.purge.mutate({
        ...input,
        expectedCount,
        confirmationText: this.confirmationText,
      });
      this.dialogRef.close(output);
    } catch (error) {
      this.status.set(null);
      this.error.set(this.localizePurgeError(error));
      if (this.trpcCode(error) === 'PRECONDITION_FAILED') {
        await this.refreshCount({ keepError: true });
      }
    } finally {
      this.dialogRef.disableClose = false;
      this.busy.set(false);
    }
  }

  async refreshCount(options?: { keepError?: boolean }): Promise<void> {
    const generation = ++this.countGeneration;
    const input = this.previewInput();
    if (!input) {
      this.count.set(null);
      this.countBusy.set(false);
      return;
    }

    this.countBusy.set(true);
    if (!options?.keepError) {
      this.error.set(null);
    }
    this.status.set(null);
    try {
      const output = await trpc.admin.productFeedback.countForPurge.query(input);
      if (generation !== this.countGeneration) return;
      this.count.set(output.count);
      this.status.set(null);
    } catch (error) {
      if (generation !== this.countGeneration) return;
      this.count.set(null);
      this.status.set(null);
      this.error.set(
        localizeKnownServerError(
          error,
          $localize`:@@admin.productFeedback.purgeError:Die Löschung konnte nicht ausgeführt werden. Versuche es erneut.`,
        ),
      );
    } finally {
      if (generation === this.countGeneration) {
        this.countBusy.set(false);
      }
    }
  }

  private previewInput(): { scope: 'ALL' } | { scope: 'UNTIL'; until: string } | null {
    if (this.scope === 'ALL') return { scope: 'ALL' };
    if (!this.isUntilDateAllowed(this.untilDate) || !this.untilDate) return null;
    return { scope: 'UNTIL', until: this.dayBoundIso(this.untilDate, true) };
  }

  private clampUntilDate(date: Date | null): Date {
    const today = this.startOfLocalDay(new Date());
    if (!date) return today;
    const incoming = this.startOfLocalDay(date);
    return incoming.getTime() > today.getTime() ? today : incoming;
  }

  private isUntilDateAllowed(date: Date | null): boolean {
    if (!date) return false;
    return this.startOfLocalDay(date).getTime() <= this.startOfLocalDay(new Date()).getTime();
  }

  private startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private dayBoundIso(date: Date, endOfDay: boolean): string {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    ).toISOString();
  }

  private trpcCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const candidate = error as { data?: { code?: string }; shape?: { data?: { code?: string } } };
    return candidate.data?.code ?? candidate.shape?.data?.code;
  }

  private localizePurgeError(error: unknown): string {
    const fallback = $localize`:@@admin.productFeedback.purgeError:Die Löschung konnte nicht ausgeführt werden. Versuche es erneut.`;
    const localized = localizeKnownServerError(error, fallback);
    if (localized.includes(PURGE_CHANGED_DE)) {
      return $localize`:@@admin.productFeedback.purgeChanged:Die Anzahl hat sich geändert. Zähle neu und bestätige erneut.`;
    }
    if (localized.includes(PURGE_PHRASE_DE)) {
      return $localize`:@@admin.productFeedback.purgePhraseFailed:Die Sicherheitsphrase stimmt nicht.`;
    }
    return localized;
  }
}
