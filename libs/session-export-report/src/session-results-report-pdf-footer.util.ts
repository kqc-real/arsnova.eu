import type { SessionResultsReportLabels } from './labels-de';

const PDF_PAGE_MARGINS = {
  top: '16mm',
  right: '14mm',
  bottom: '20mm',
  left: '14mm',
} as const;

export interface SessionResultsPdfHeaderContext {
  quizName: string;
  sessionCode: string;
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Playwright/Chromium `headerTemplate` für laufenden Seitenkopf. */
export function buildSessionResultsPdfHeaderTemplate(
  header: SessionResultsPdfHeaderContext,
): string {
  const title = escapeHtml(header.quizName.slice(0, 64));
  const code = escapeHtml(header.sessionCode);
  return `<div style="width:100%;font-size:8px;color:#5c6570;font-family:Segoe UI,system-ui,sans-serif;padding:0 14mm 2mm;border-bottom:1px solid #d8dee6;display:flex;justify-content:space-between;">
    <span>${title}</span>
    <span>${code}</span>
  </div>`;
}

/** Playwright/Chromium `footerTemplate` für `page.pdf({ displayHeaderFooter: true })`. */
export function buildSessionResultsPdfFooterTemplate(labels: SessionResultsReportLabels): string {
  const text = labels.pageNumberFooter
    .replace('{0}', '<span class="pageNumber"></span>')
    .replace('{1}', '<span class="totalPages"></span>');
  return `<div style="width:100%;font-size:9px;color:#5c6570;font-family:Segoe UI,system-ui,sans-serif;text-align:center;padding:0 14mm;">${text}</div>`;
}

/** Zusätzliches `@page`-CSS für Browser-Druck mit lokalisiertem Seitenfuß. */
export function buildSessionResultsPrintPageFooterCss(labels: SessionResultsReportLabels): string {
  const segments = labels.pageNumberFooter.split(/\{0\}|\{1\}/);
  const before = segments[0] ?? '';
  const between = segments[1] ?? ' / ';
  const after = segments[2] ?? '';
  const content = [
    before ? `"${escapeCssString(before)}"` : null,
    'counter(page)',
    `"${escapeCssString(between)}"`,
    'counter(pages)',
    after ? `"${escapeCssString(after)}"` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return `@page { margin-bottom: ${PDF_PAGE_MARGINS.bottom}; @bottom-center { content: ${content}; font: 9pt/1.2 "Segoe UI", system-ui, sans-serif; color: #5c6570; } }`;
}

export function buildSessionResultsPlaywrightPdfOptions(
  labels: SessionResultsReportLabels,
  header: SessionResultsPdfHeaderContext,
) {
  return {
    format: 'A4' as const,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: buildSessionResultsPdfHeaderTemplate(header),
    footerTemplate: buildSessionResultsPdfFooterTemplate(labels),
    margin: { ...PDF_PAGE_MARGINS },
  };
}
