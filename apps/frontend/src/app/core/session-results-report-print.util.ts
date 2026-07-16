/**
 * Opens a blank tab we can write into for the PDF print fallback.
 * Do NOT pass `noopener` in the features string — modern Chromium then returns
 * `null` while still opening an empty tab. Detach via `opener = null` after we
 * have the Window reference.
 */
function openWritableReportWindow(): Window | null {
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    return null;
  }
  reportWindow.opener = null;
  return reportWindow;
}

/**
 * Fallback when server-side Playwright PDF fails: open the report HTML and
 * trigger the browser print dialog („Als PDF speichern“).
 */
export function printSessionResultsReport(html: string, documentTitle: string): boolean {
  const printWindow = openWritableReportWindow();
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
