import { DOCUMENT } from '@angular/common';
import { Injectable, LOCALE_ID, inject } from '@angular/core';
import type { SessionExportDTO } from '@arsnova/shared-types';
import {
  buildSessionResultsReportHtml,
  inlineExportImagesInHtml,
} from '@arsnova/session-export-report';
import { getSessionResultsReportLabels } from './session-results-report-labels';
import { printSessionResultsReport } from './session-results-report-print.util';
import { trpc } from './trpc.client';

export type SessionResultsPdfExportResult = 'pdf-download' | 'print-fallback';

@Injectable({ providedIn: 'root' })
export class SessionResultsExportService {
  private readonly document = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID) as string;

  async exportPdfFromSessionCode(
    code: string,
    options?: { onLargeReportHint?: (questionCount: number) => void },
  ): Promise<SessionResultsPdfExportResult> {
    const exportData = await trpc.session.getSessionExportData.query({
      code: code.toUpperCase(),
    });
    return this.exportPdfFromExportData(exportData, options);
  }

  async exportPdfFromQuizHistory(
    quizId: string,
    accessProof: string,
    options?: { onLargeReportHint?: (questionCount: number) => void },
  ): Promise<SessionResultsPdfExportResult> {
    const exportData = await trpc.session.getLastSessionExportDataForQuiz.query({
      quizId,
      accessProof,
    });
    try {
      const pdf = await trpc.session.getLastSessionExportPdfForQuiz.query({
        quizId,
        accessProof,
        localeId: this.localeId,
      });
      this.downloadBase64Export(pdf.contentBase64, pdf.fileName, pdf.mimeType);
      return 'pdf-download';
    } catch {
      return this.exportPdfFromExportData(exportData, options);
    }
  }

  private async exportPdfFromExportData(
    exportData: SessionExportDTO,
    options?: { onLargeReportHint?: (questionCount: number) => void },
  ): Promise<SessionResultsPdfExportResult> {
    if (exportData.questions.length >= 15) {
      options?.onLargeReportHint?.(exportData.questions.length);
    }

    try {
      const pdf = await trpc.session.getSessionExportPdf.query({
        code: exportData.sessionCode,
        localeId: this.localeId,
      });
      this.downloadBase64Export(pdf.contentBase64, pdf.fileName, pdf.mimeType);
      return 'pdf-download';
    } catch {
      const html = await this.buildPrintableReportHtml(exportData);
      const labels = getSessionResultsReportLabels();
      const documentTitle = `${labels.documentTitle} — ${exportData.quizName}`;
      const opened = printSessionResultsReport(html, documentTitle);
      if (!opened) {
        throw new Error('print window blocked');
      }
      return 'print-fallback';
    }
  }

  private async buildPrintableReportHtml(exportData: SessionExportDTO): Promise<string> {
    const labels = getSessionResultsReportLabels();
    const assetBaseUrl = window.location.origin;
    const html = buildSessionResultsReportHtml(exportData, labels, {
      localeId: this.localeId,
      assetBaseUrl,
      pageNumbersViaCss: true,
    });
    return inlineExportImagesInHtml(html, { fetchExternal: true, maxImageBytes: 400_000 });
  }

  downloadBase64Export(contentBase64: string, fileName: string, mimeType: string): void {
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
