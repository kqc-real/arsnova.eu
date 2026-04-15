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
      sessionCode: string;
      nickname: string;
      rank: number;
      totalScore: number;
    }
  | {
      valid: false;
    };

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

  updateVerifyCode(value: string): void {
    const normalized = value
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 32);
    this.verifyCode.set(normalized);
    this.verifyResult.set(null);
    this.verifyError.set(false);
  }

  canVerifyCode(): boolean {
    return this.verifyCode().trim().length >= 4 && !this.verifyLoading();
  }

  async verifyBonusCode(): Promise<void> {
    if (!this.canVerifyCode()) {
      return;
    }
    const code = this.verifyCode().trim().toUpperCase();
    this.verifyLoading.set(true);
    this.verifyError.set(false);
    this.verifyResult.set(null);
    try {
      const result = await trpc.session.verifyBonusTokenForQuiz.query({
        quizId: this.data.serverQuizId,
        accessProof: this.data.accessProof,
        bonusCode: code,
      });
      this.verifyResult.set(result);
    } catch {
      this.verifyError.set(true);
    } finally {
      this.verifyLoading.set(false);
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
}
