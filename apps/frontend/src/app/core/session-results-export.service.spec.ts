import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionResultsExportService } from './session-results-export.service';
import { trpc } from './trpc.client';

vi.mock('./trpc.client', () => ({
  trpc: {
    session: {
      getSessionExportPdf: { query: vi.fn() },
      getLastSessionExportPdfForQuiz: { query: vi.fn() },
    },
  },
}));

const pdf = {
  contentBase64: btoa('%PDF-1.4'),
  fileName: 'arsnova-results-Demo-ABC123.pdf',
  mimeType: 'application/pdf' as const,
};

describe('SessionResultsExportService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(trpc.session.getSessionExportPdf.query).mockResolvedValue(pdf);
    vi.mocked(trpc.session.getLastSessionExportPdfForQuiz.query).mockResolvedValue(pdf);
    TestBed.configureTestingModule({
      providers: [{ provide: LOCALE_ID, useValue: 'fr' }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(['host', 'history'] as const)(
    'lädt die Server-PDF als Datei herunter (%s)',
    async (source) => {
      vi.useFakeTimers();
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        expect(this.getAttribute('href')).toBe('blob:pdf');
        expect(this.download).toBe(pdf.fileName);
        expect(this.target).toBe('');
        expect(revokeObjectURL).not.toHaveBeenCalled();
      });
      const open = vi.spyOn(window, 'open');
      const service = TestBed.inject(SessionResultsExportService);

      if (source === 'host') {
        await service.exportPdfFromSessionCode('abc123', 'visual');
        expect(trpc.session.getSessionExportPdf.query).toHaveBeenCalledExactlyOnceWith({
          code: 'ABC123',
          localeId: 'fr',
          profile: 'visual',
        });
        expect(trpc.session.getLastSessionExportPdfForQuiz.query).not.toHaveBeenCalled();
      } else {
        await service.exportPdfFromQuizHistory('quiz-id', 'access-proof', 'pdfUa');
        expect(trpc.session.getLastSessionExportPdfForQuiz.query).toHaveBeenCalledExactlyOnceWith({
          quizId: 'quiz-id',
          accessProof: 'access-proof',
          localeId: 'fr',
          profile: 'pdfUa',
        });
        expect(trpc.session.getSessionExportPdf.query).not.toHaveBeenCalled();
      }

      expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ type: 'application/pdf', size: '%PDF-1.4'.length }),
      );
      expect(click).toHaveBeenCalledOnce();
      expect(open).not.toHaveBeenCalled();
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.runOnlyPendingTimers();
      expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:pdf');
    },
  );

  it.each(['host', 'history'] as const)(
    'gibt Serverfehler weiter, ohne einen Tab oder Download zu öffnen (%s)',
    async (source) => {
      const error = { data: { code: source === 'host' ? 'UNAUTHORIZED' : 'TIMEOUT' } };
      vi.mocked(trpc.session.getSessionExportPdf.query).mockRejectedValueOnce(error);
      vi.mocked(trpc.session.getLastSessionExportPdfForQuiz.query).mockRejectedValueOnce(error);
      const open = vi.spyOn(window, 'open');
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
      const service = TestBed.inject(SessionResultsExportService);

      const pending =
        source === 'host'
          ? service.exportPdfFromSessionCode('ABC123', 'visual')
          : service.exportPdfFromQuizHistory('quiz-id', 'access-proof', 'pdfUa');
      await expect(pending).rejects.toBe(error);
      expect(open).not.toHaveBeenCalled();
      expect(click).not.toHaveBeenCalled();
    },
  );
});
