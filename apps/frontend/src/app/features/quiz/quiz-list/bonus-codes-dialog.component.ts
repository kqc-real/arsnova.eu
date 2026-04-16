import { DatePipe, DecimalPipe, DOCUMENT } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import type { BonusTokenListWithSessionMetaDTO } from '@arsnova/shared-types';
import { trpc } from '../../../core/trpc.client';

export interface BonusCodesDialogData {
  serverQuizId: string;
  accessProof: string;
  quizName: string;
}

type BonusCodeVerificationResult =
  | {
      valid: true;
      code: string;
      previouslyVerified: boolean;
      sessionCode: string;
      nickname: string;
      rank: number;
      totalScore: number;
    }
  | {
      valid: false;
      reason: 'notFound' | 'invalidFormat';
    };

const BONUS_CODE_LENGTH = 13;
const BONUS_CODE_PATTERN = /^BNS-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

@Component({
  selector: 'app-bonus-codes-dialog',
  standalone: true,
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
    MatFormField,
    MatLabel,
    MatInput,
    MatProgressSpinner,
    DecimalPipe,
    DatePipe,
  ],
  templateUrl: './bonus-codes-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './bonus-codes-dialog.component.scss',
  ],
})
export class BonusCodesDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<BonusCodesDialogComponent>);
  private readonly document = inject(DOCUMENT);
  readonly data = inject<BonusCodesDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly sessions = signal<BonusTokenListWithSessionMetaDTO[]>([]);
  readonly verifyCode = signal('');
  readonly verifyResult = signal<BonusCodeVerificationResult | null>(null);
  readonly verifyLoading = signal(false);
  readonly verifyError = signal(false);
  readonly deleteLoading = signal(false);
  readonly deleteError = signal(false);
  private readonly verifiedValidCodes = signal<Record<string, true>>({});

  updateVerifyCode(value: string): void {
    const normalized = value
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, BONUS_CODE_LENGTH);
    this.verifyCode.set(normalized);
    this.verifyResult.set(null);
    this.verifyError.set(false);
    this.deleteError.set(false);
  }

  canVerifyCode(): boolean {
    return this.verifyCode().trim().length >= 4 && !this.verifyLoading();
  }

  shouldShowLoadError(): boolean {
    return (
      this.loadError() &&
      !this.verifyResult() &&
      !this.verifyError() &&
      !this.deleteError() &&
      !this.verifyLoading()
    );
  }

  async verifyBonusCode(): Promise<void> {
    if (!this.canVerifyCode()) {
      return;
    }
    const code = this.verifyCode().trim().toUpperCase();
    if (!BONUS_CODE_PATTERN.test(code)) {
      this.verifyError.set(false);
      this.verifyResult.set({ valid: false, reason: 'invalidFormat' });
      return;
    }
    this.verifyLoading.set(true);
    this.verifyError.set(false);
    this.verifyResult.set(null);
    try {
      const result = await trpc.session.verifyBonusTokenForQuiz.query({
        quizId: this.data.serverQuizId,
        accessProof: this.data.accessProof,
        bonusCode: code,
      });
      if (result.valid) {
        const alreadyVerified = this.isCodeAlreadyVerified(code);
        this.verifyResult.set({
          ...result,
          code,
          previouslyVerified: alreadyVerified,
        });
        this.rememberVerifiedCode(code);
      } else {
        this.verifyResult.set({ valid: false, reason: 'notFound' });
      }
    } catch {
      this.verifyError.set(true);
    } finally {
      this.verifyLoading.set(false);
    }
  }

  canDeleteVerifiedCode(): boolean {
    const result = this.verifyResult();
    return (
      !!result &&
      result.valid &&
      result.previouslyVerified &&
      !this.deleteLoading() &&
      !this.verifyLoading()
    );
  }

  async deleteVerifiedCode(): Promise<void> {
    const result = this.verifyResult();
    if (!result || !result.valid || !result.previouslyVerified || this.deleteLoading()) {
      return;
    }
    this.deleteLoading.set(true);
    this.deleteError.set(false);
    try {
      const deleted = await trpc.session.deleteBonusTokenForQuiz.mutate({
        quizId: this.data.serverQuizId,
        accessProof: this.data.accessProof,
        bonusCode: result.code,
      });
      if (!deleted.deleted) {
        this.deleteError.set(true);
        return;
      }
      this.forgetVerifiedCode(result.code);
      this.removeBonusCodeFromSessionList(result.code);
      this.verifyResult.set({ valid: false, reason: 'notFound' });
      this.verifyCode.set(result.code);
    } catch {
      this.deleteError.set(true);
    } finally {
      this.deleteLoading.set(false);
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      const result = await trpc.session.getBonusTokensForQuiz.query({
        quizId: this.data.serverQuizId,
        accessProof: this.data.accessProof,
      });
      this.sessions.set(result.sessions);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  exportAllCsv(): void {
    const sessions = this.sessions();
    if (sessions.length === 0) return;
    const header = 'Session;Rang;Nickname;Code;Punkte;Generiert am';
    const rows: string[] = [header];
    for (const s of sessions) {
      for (const t of s.tokens) {
        rows.push(
          `${s.sessionCode};${t.rank};${t.nickname};${t.token};${t.totalScore};${t.generatedAt}`,
        );
      }
    }
    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = this.document.createElement('a');
    a.href = url;
    a.download = `bonus-codes-${this.data.quizName.replace(/[^\wäöüÄÖÜß.-]+/gi, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private isCodeAlreadyVerified(code: string): boolean {
    return this.verifiedValidCodes()[code] === true;
  }

  private rememberVerifiedCode(code: string): void {
    this.verifiedValidCodes.update((known) => ({ ...known, [code]: true }));
  }

  private forgetVerifiedCode(code: string): void {
    this.verifiedValidCodes.update((known) => {
      if (!known[code]) return known;
      const next = { ...known };
      delete next[code];
      return next;
    });
  }

  private removeBonusCodeFromSessionList(code: string): void {
    this.sessions.update((sessions) =>
      sessions
        .map((session) => ({
          ...session,
          tokens: session.tokens.filter((token) => token.token !== code),
        }))
        .filter((session) => session.tokens.length > 0),
    );
  }
}
