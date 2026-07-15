/**
 * Workspace entry for local app builds (extensionless re-exports for Angular/Webpack).
 */
export {
  buildSessionResultsReportHtml,
  buildSessionResultsPdfFilename,
  getSessionResultsReportLabelsDe,
  getSessionResultsReportLabelsForLocale,
  type BuildSessionResultsReportOptions,
  type SessionResultsReportLabels,
} from './session-results-report.util';
export {
  renderExportQuestionHtml,
  renderExportMarkdownHtml,
  absolutizeExportAssetImgSrc,
  EXPORT_REPORT_KATEX_CSS_URL,
  EXPORT_REPORT_HLJS_CSS_URL,
} from './markdown-export.util';
export { inlineExportImagesInHtml, assetRelativePathFromSrc } from './markdown-export-images.util';
export {
  extractExportQuestionText,
  stripHostOnlyQuestionNotes,
  stripMarkdownToPlainText,
} from './markdown-plain-text.util';
export {
  filterHistogramBinsForDisplay,
  histogramsEqual,
} from './session-results-report-charts.util';
export {
  buildSessionResultsPdfFooterTemplate,
  buildSessionResultsPlaywrightPdfOptions,
  buildSessionResultsPrintPageFooterCss,
} from './session-results-report-pdf-footer.util';
