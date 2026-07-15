export {
  buildSessionResultsReportHtml,
  buildSessionResultsPdfFilename,
  type BuildSessionResultsReportOptions,
} from './session-results-report.util.js';
export {
  getSessionResultsReportLabelsDe,
  getSessionResultsReportLabelsForLocale,
  type SessionResultsReportLabels,
} from './labels-locale.util.js';
export {
  buildSessionResultsPdf,
  setSessionResultsPdfRenderer,
  type RenderSessionResultsPdfOptions,
  hasSessionResultsPdfRenderer,
} from './session-results-report-pdf.js';
export {
  renderExportQuestionHtml,
  renderExportMarkdownHtml,
  absolutizeExportAssetImgSrc,
  EXPORT_REPORT_KATEX_CSS_URL,
  EXPORT_REPORT_HLJS_CSS_URL,
} from './markdown-export.util.js';
export {
  inlineExportImagesInHtml,
  assetRelativePathFromSrc,
} from './markdown-export-images.util.js';
export {
  extractExportQuestionText,
  stripHostOnlyQuestionNotes,
  stripMarkdownToPlainText,
} from './markdown-plain-text.util.js';
export {
  filterHistogramBinsForDisplay,
  histogramsEqual,
} from './session-results-report-charts.util.js';
export {
  buildSessionResultsPdfFooterTemplate,
  buildSessionResultsPlaywrightPdfOptions,
  buildSessionResultsPrintPageFooterCss,
} from './session-results-report-pdf-footer.util.js';
