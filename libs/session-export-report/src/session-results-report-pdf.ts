import type { SessionExportDTO } from '@arsnova/shared-types';
import type { SessionResultsReportLabels } from './labels-de';
import {
  buildSessionResultsReportHtml,
  buildSessionResultsPdfFilename,
} from './session-results-report.util';

export interface RenderSessionResultsPdfOptions {
  localeId?: string;
  labels?: SessionResultsReportLabels;
}

export type SessionResultsPdfRenderer = (html: string) => Promise<Buffer>;

let pdfRenderer: SessionResultsPdfRenderer | null = null;

/** Für Tests oder Backend: Playwright/Chromium-Renderer injizieren. */
export function setSessionResultsPdfRenderer(renderer: SessionResultsPdfRenderer | null): void {
  pdfRenderer = renderer;
}

export function hasSessionResultsPdfRenderer(): boolean {
  return pdfRenderer !== null;
}

export async function buildSessionResultsPdf(
  data: SessionExportDTO,
  options: RenderSessionResultsPdfOptions = {},
): Promise<Buffer> {
  if (!pdfRenderer) {
    throw new Error('Session-PDF-Renderer ist nicht konfiguriert.');
  }
  const { getSessionResultsReportLabelsDe } = await import('./labels-de');
  const labels = options.labels ?? getSessionResultsReportLabelsDe();
  const html = buildSessionResultsReportHtml(data, labels, {
    localeId: options.localeId ?? 'de',
  });
  return pdfRenderer(html);
}

export { buildSessionResultsPdfFilename };
