import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openSessionResultsReportPreview,
  printSessionResultsReport,
} from './session-results-report-print.util';

function mockWritableWindow(): Window {
  const doc = {
    open: vi.fn(),
    write: vi.fn(),
    close: vi.fn(),
    title: '',
    readyState: 'complete',
    addEventListener: vi.fn(),
  };
  return {
    document: doc,
    opener: {} as Window,
    focus: vi.fn(),
    print: vi.fn(),
    addEventListener: vi.fn(),
  } as unknown as Window;
}

describe('session-results-report-print.util', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('schreibt Vorschau-HTML in ein schreibbares Fenster und löst opener', () => {
    const previewWindow = mockWritableWindow();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(previewWindow);

    const opened = openSessionResultsReportPreview(
      '<html><body><p>Bericht</p></body></html>',
      'Titel',
      'Drucken',
    );

    expect(opened).toBe(true);
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(previewWindow.opener).toBeNull();
    expect(previewWindow.document.write).toHaveBeenCalled();
    const written = String(vi.mocked(previewWindow.document.write).mock.calls[0]?.[0] ?? '');
    expect(written).toContain('Bericht');
    expect(written).toContain('report-preview-toolbar');
  });

  it('gibt false zurück, wenn das Popup blockiert ist', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openSessionResultsReportPreview('<html><body></body></html>', 'Titel')).toBe(false);
    expect(printSessionResultsReport('<html><body></body></html>', 'Titel')).toBe(false);
  });

  it('öffnet den Druckdialog nach dem Schreiben', () => {
    const printWindow = mockWritableWindow();
    vi.spyOn(window, 'open').mockReturnValue(printWindow);

    expect(printSessionResultsReport('<html><body><p>PDF</p></body></html>', 'Titel')).toBe(true);
    expect(printWindow.print).toHaveBeenCalled();
  });
});
