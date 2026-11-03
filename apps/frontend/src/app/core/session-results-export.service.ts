import { DOCUMENT } from '@angular/common';
import { Injectable, LOCALE_ID, inject } from '@angular/core';
import type { SessionExportDTO, SessionResultsPdfProfile } from '@arsnova/shared-types';
import {
  buildSessionResultsReportHtml,
  inlineExportImagesInHtml,
} from '@arsnova/session-export-report';
import { getSessionResultsReportLabels } from './session-results-report-labels';
import { printSessionResultsReport } from './session-results-report-print.util';
import { trpc } from './trpc.client';

export type SessionResultsPdfExportResult = 'pdf-download' | 'pdf-view' | 'print-fallback';
export type SessionResultsPdfDisposition = 'download' | 'view';

export interface SessionResultsPdfExportOptions {
  profile?: SessionResultsPdfProfile;
  disposition?: SessionResultsPdfDisposition;
  onLargeReportHint?: (questionCount: number) => void;
  /**
   * Ansehen-Tab, den der Aufrufer noch in der User-Geste geöffnet hat.
   * `undefined`: der Service öffnet selbst. `null`: das Popup war blockiert.
   * Ein übergebenes Fenster bleibt bei einem Fehler offen, damit ein Retry
   * denselben Tab nutzen kann.
   */
  viewPlaceholder?: Window | null;
}

@Injectable({ providedIn: 'root' })
export class SessionResultsExportService {
  private readonly document = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID) as string;

  /**
   * Ansehen-Tab noch in der User-Geste öffnen, bevor ein Token erneuert wird.
   * Nach einem Await blockieren Safari und andere Popup-Policies das Fenster.
   */
  openViewPlaceholder(): Window | null {
    return this.openViewPlaceholderIfNeeded('view');
  }

  closeViewPlaceholder(placeholder: Window | null): void {
    if (!placeholder || placeholder.closed) {
      return;
    }
    try {
      placeholder.close();
    } catch {
      // Fenster bereits weg oder Close gesperrt.
    }
  }

  async exportPdfFromSessionCode(
    code: string,
    options?: SessionResultsPdfExportOptions,
  ): Promise<SessionResultsPdfExportResult> {
    const callerOwnsPlaceholder = options?.viewPlaceholder !== undefined;
    // Synchron im Klick-Kontext öffnen: nach den tRPC-Awaits blockieren Safari/Popup-Policies.
    const viewPlaceholder = callerOwnsPlaceholder
      ? (options.viewPlaceholder ?? null)
      : this.openViewPlaceholderIfNeeded(options?.disposition);
    try {
      const exportData = await trpc.session.getExportData.query({
        code: code.toUpperCase(),
      });
      return await this.exportPdfFromExportData(exportData, options, viewPlaceholder);
    } catch (error) {
      if (!callerOwnsPlaceholder) {
        this.closeViewPlaceholder(viewPlaceholder);
      }
      throw error;
    }
  }

  async exportPdfFromQuizHistory(
    quizId: string,
    accessProof: string,
    options?: SessionResultsPdfExportOptions,
  ): Promise<SessionResultsPdfExportResult> {
    const profile = options?.profile ?? 'visual';
    const viewPlaceholder = this.openViewPlaceholderIfNeeded(options?.disposition);
    try {
      const exportData = await trpc.session.getLastSessionExportDataForQuiz.query({
        quizId,
        accessProof,
      });
      try {
        const pdf = await trpc.session.getLastSessionExportPdfForQuiz.query({
          quizId,
          accessProof,
          localeId: this.localeId,
          profile,
        });
        return this.deliverPdf(pdf, options?.disposition ?? 'download', viewPlaceholder);
      } catch {
        // Sammlung hat kein Host-Token. Liegen die Daten schon vor, bleibt nur der Browser-Druck.
        return await this.deliverPrintFallback(exportData, profile, viewPlaceholder);
      }
    } catch (error) {
      this.closeViewPlaceholder(viewPlaceholder);
      throw error;
    }
  }

  private async exportPdfFromExportData(
    exportData: SessionExportDTO,
    options?: SessionResultsPdfExportOptions,
    viewPlaceholder: Window | null = null,
  ): Promise<SessionResultsPdfExportResult> {
    const profile = options?.profile ?? 'visual';
    if (exportData.questions.length >= 15) {
      options?.onLargeReportHint?.(exportData.questions.length);
    }

    try {
      const pdf = await trpc.session.getSessionExportPdf.query({
        code: exportData.sessionCode,
        localeId: this.localeId,
        profile,
      });
      return this.deliverPdf(pdf, options?.disposition ?? 'download', viewPlaceholder);
    } catch {
      return await this.deliverPrintFallback(exportData, profile, viewPlaceholder);
    }
  }

  private async deliverPrintFallback(
    exportData: SessionExportDTO,
    profile: SessionResultsPdfProfile,
    viewPlaceholder: Window | null,
  ): Promise<SessionResultsPdfExportResult> {
    const html = await this.buildPrintableReportHtml(exportData, profile);
    const labels = getSessionResultsReportLabels();
    const documentTitle = `${labels.documentTitle} — ${exportData.quizName}`;
    const opened = printSessionResultsReport(html, documentTitle, viewPlaceholder);
    if (!opened) {
      this.closeViewPlaceholder(viewPlaceholder);
      throw new Error('print window blocked');
    }
    return 'print-fallback';
  }

  private async buildPrintableReportHtml(
    exportData: SessionExportDTO,
    profile: SessionResultsPdfProfile,
  ): Promise<string> {
    const labels = getSessionResultsReportLabels();
    const assetBaseUrl = window.location.origin;
    const html = buildSessionResultsReportHtml(exportData, labels, {
      localeId: this.localeId,
      assetBaseUrl,
      pageNumbersViaCss: true,
      pdfUaSafeVisuals: profile === 'pdfUa',
    });
    return inlineExportImagesInHtml(html, { fetchExternal: true, maxImageBytes: 400_000 });
  }

  downloadBase64Export(contentBase64: string, fileName: string, mimeType: string): void {
    const url = this.createBlobUrl(contentBase64, mimeType);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private deliverPdf(
    pdf: { contentBase64: string; fileName: string; mimeType: string },
    disposition: SessionResultsPdfDisposition,
    viewPlaceholder: Window | null = null,
  ): SessionResultsPdfExportResult {
    if (
      disposition === 'view' &&
      this.openBase64Export(pdf.contentBase64, pdf.fileName, pdf.mimeType, viewPlaceholder)
    ) {
      return 'pdf-view';
    }
    this.closeViewPlaceholder(viewPlaceholder);
    this.downloadBase64Export(pdf.contentBase64, pdf.fileName, pdf.mimeType);
    return 'pdf-download';
  }

  /**
   * Öffnet den Ansehen-Tab noch in der User-Geste (vor awaits).
   * Ohne Placeholder fällt Ansehen später still auf Download zurück (Safari/Popup-Policy).
   */
  private openViewPlaceholderIfNeeded(
    disposition: SessionResultsPdfDisposition | undefined,
  ): Window | null {
    if (disposition !== 'view') {
      return null;
    }
    const view = this.document.defaultView;
    if (!view) {
      return null;
    }
    // Kein `noopener` in features — sonst liefert Chromium oft `null` bei offenem Tab.
    const opened = view.open('about:blank', '_blank');
    if (!opened || opened.closed) {
      return null;
    }
    opened.opener = null;
    return opened;
  }

  private openBase64Export(
    contentBase64: string,
    fileName: string,
    mimeType: string,
    viewPlaceholder: Window | null = null,
  ): boolean {
    const view = this.document.defaultView;
    if (!view) {
      return false;
    }
    const url = this.createBlobUrl(contentBase64, mimeType);
    let opened = viewPlaceholder && !viewPlaceholder.closed ? viewPlaceholder : null;
    if (opened) {
      try {
        opened.location.assign(url);
      } catch {
        URL.revokeObjectURL(url);
        return false;
      }
    } else {
      opened = view.open(url, '_blank');
      if (!opened) {
        URL.revokeObjectURL(url);
        return false;
      }
      opened.opener = null;
    }
    try {
      if (opened.document) {
        opened.document.title = fileName;
      }
    } catch {
      // Cross-origin nach Blob-Navigation: Titel nicht setzbar.
    }
    view.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  }

  private createBlobUrl(contentBase64: string, mimeType: string): string {
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  }
}
