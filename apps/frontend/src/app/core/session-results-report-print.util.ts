const PREVIEW_TOOLBAR_STYLES = `
.report-preview-toolbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid #d8dee6;
  background: #f6f8fb;
  font: 13px/1.4 system-ui, sans-serif;
}
.report-preview-toolbar button {
  border: 1px solid #90caf9;
  background: #e3f2fd;
  color: #0d47a1;
  border-radius: 0.45rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  font: inherit;
}
@media print {
  .report-preview-toolbar { display: none !important; }
}
`;

function injectPreviewToolbar(html: string, printLabel: string): string {
  const toolbar = `<div class="report-preview-toolbar"><strong>Vorschau</strong><button type="button" onclick="window.print()">${printLabel}</button></div><style>${PREVIEW_TOOLBAR_STYLES}</style>`;
  return html.replace('<body>', `<body>${toolbar}`);
}

export function printSessionResultsReport(html: string, documentTitle: string): boolean {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    return false;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = documentTitle;
  const triggerPrint = (): void => {
    printWindow.focus();
    printWindow.print();
  };
  if (printWindow.document.readyState === 'complete') {
    triggerPrint();
  } else {
    printWindow.addEventListener('load', triggerPrint, { once: true });
  }
  return true;
}

export function openSessionResultsReportPreview(
  html: string,
  documentTitle: string,
  printLabel = 'Als PDF drucken',
): boolean {
  const previewWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!previewWindow) {
    return false;
  }
  previewWindow.document.open();
  previewWindow.document.write(injectPreviewToolbar(html, printLabel));
  previewWindow.document.close();
  previewWindow.document.title = documentTitle;
  return true;
}
