import { DOCUMENT } from '@angular/common';
import { Injectable, LOCALE_ID, inject } from '@angular/core';
import type { SessionExportPdfOutput, SessionResultsPdfProfile } from '@arsnova/shared-types';
import { trpc } from './trpc.client';

@Injectable({ providedIn: 'root' })
export class SessionResultsExportService {
  private readonly document = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID);

  async exportPdfFromSessionCode(code: string, profile: SessionResultsPdfProfile): Promise<void> {
    const pdf = await trpc.session.getSessionExportPdf.query({
      code: code.toUpperCase(),
      localeId: this.localeId,
      profile,
    });
    this.downloadPdf(pdf);
  }

  async exportPdfFromQuizHistory(
    quizId: string,
    accessProof: string,
    profile: SessionResultsPdfProfile,
  ): Promise<void> {
    const pdf = await trpc.session.getLastSessionExportPdfForQuiz.query({
      quizId,
      accessProof,
      localeId: this.localeId,
      profile,
    });
    this.downloadPdf(pdf);
  }

  private downloadPdf({ contentBase64, fileName, mimeType }: SessionExportPdfOutput): void {
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    try {
      anchor.click();
    } finally {
      // Der Browser braucht die Blob-URL noch, um den Download zu übernehmen.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}
