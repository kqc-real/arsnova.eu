import { afterEach, describe, expect, it, vi } from 'vitest';
import { printSessionResultsReport } from './session-results-report-print.util';

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

  it('gibt false zurück, wenn das Popup blockiert ist', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(printSessionResultsReport('<html><body></body></html>', 'Titel')).toBe(false);
  });

  it('schreibt HTML und öffnet den Druckdialog', () => {
    const printWindow = mockWritableWindow();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow);

    expect(printSessionResultsReport('<html><body><p>PDF</p></body></html>', 'Titel')).toBe(true);
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(printWindow.opener).toBeNull();
    expect(printWindow.document.write).toHaveBeenCalled();
    expect(printWindow.print).toHaveBeenCalled();
  });
});
