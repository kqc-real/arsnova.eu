import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionResultsExportService } from './session-results-export.service';
import { trpc } from './trpc.client';

vi.mock('./trpc.client', () => ({
  trpc: {
    session: {
      getExportData: { query: vi.fn() },
      getSessionExportPdf: { query: vi.fn() },
      getLastSessionExportDataForQuiz: { query: vi.fn() },
      getLastSessionExportPdfForQuiz: { query: vi.fn() },
    },
  },
}));

const exportData = {
  questionProgressAvailable: false,
  totalQuestionCount: 0,
  conductedQuestionCount: 0,
  skippedQuestionCount: 0,
  sessionId: 'sess-1',
  sessionCode: 'ABC123',
  quizName: 'Demo',
  finishedAt: '2026-03-24T12:30:00.000Z',
  participantCount: 1,
  teamMode: false,
  questions: [
    {
      questionOrder: 0,
      questionTextShort: '',
      type: 'MULTIPLE_CHOICE' as const,
      participantCount: 1,
    },
  ],
  teamLeaderboard: [],
  bonusTokens: [],
};

const pdf = {
  contentBase64: btoa('%PDF-1.4'),
  fileName: 'arsnova-results-Demo-ABC123.pdf',
  mimeType: 'application/pdf' as const,
};

describe('SessionResultsExportService', () => {
  let createObjectURL = vi.fn<(obj: Blob | MediaSource) => void>();
  let revokeObjectURL = vi.fn<(url: string) => void>();

  beforeEach(() => {
    createObjectURL = vi.fn<(obj: Blob | MediaSource) => void>();
    revokeObjectURL = vi.fn<(url: string) => void>();
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      createObjectURL(obj);
      return 'blob:pdf';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
      revokeObjectURL(url);
    });
    vi.mocked(trpc.session.getExportData.query).mockResolvedValue(exportData);
    vi.mocked(trpc.session.getSessionExportPdf.query).mockResolvedValue(pdf);
    vi.mocked(trpc.session.getLastSessionExportDataForQuiz.query).mockResolvedValue(exportData);
    vi.mocked(trpc.session.getLastSessionExportPdfForQuiz.query).mockResolvedValue(pdf);
    TestBed.configureTestingModule({
      providers: [SessionResultsExportService],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('lädt das PDF herunter, wenn die Abschlusskarte exportiert', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const open = vi.spyOn(window, 'open');
    const service = TestBed.inject(SessionResultsExportService);

    await expect(
      service.exportPdfFromSessionCode('ABC123', { profile: 'visual', disposition: 'download' }),
    ).resolves.toBe('pdf-download');
    expect(click).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pdf');
  });

  it('öffnet vor dem PDF-Request einen Placeholder-Tab und navigiert dorthin', async () => {
    const opened = {
      opener: {} as Window,
      closed: false,
      document: { title: '' },
      location: { assign: vi.fn() },
      close: vi.fn(),
    };
    const open = vi.spyOn(window, 'open').mockReturnValue(opened as unknown as Window);
    let openCallOrder = 0;
    open.mockImplementation(() => {
      openCallOrder += 1;
      return opened as unknown as Window;
    });
    let exportDataCallOrder = 0;
    vi.mocked(trpc.session.getExportData.query).mockImplementation(async () => {
      exportDataCallOrder = openCallOrder + 1;
      return exportData;
    });
    const service = TestBed.inject(SessionResultsExportService);

    await expect(
      service.exportPdfFromSessionCode('ABC123', { profile: 'visual', disposition: 'view' }),
    ).resolves.toBe('pdf-view');
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(openCallOrder).toBe(1);
    expect(exportDataCallOrder).toBe(2);
    expect(opened.location.assign).toHaveBeenCalledWith('blob:pdf');
    expect(opened.opener).toBeNull();
    expect(opened.document.title).toBe(pdf.fileName);
    expect(opened.close).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('navigiert einen mitgegebenen Ansehen-Tab und öffnet keinen zweiten', async () => {
    const opened = {
      opener: {} as Window,
      closed: false,
      document: { title: '' },
      location: { assign: vi.fn() },
      close: vi.fn(),
    };
    const open = vi.spyOn(window, 'open');
    const service = TestBed.inject(SessionResultsExportService);

    await expect(
      service.exportPdfFromSessionCode('ABC123', {
        profile: 'visual',
        disposition: 'view',
        viewPlaceholder: opened as unknown as Window,
      }),
    ).resolves.toBe('pdf-view');
    expect(open).not.toHaveBeenCalled();
    expect(opened.location.assign).toHaveBeenCalledWith('blob:pdf');
    expect(opened.close).not.toHaveBeenCalled();
  });

  it('lässt einen mitgegebenen Ansehen-Tab offen, wenn der Abruf scheitert', async () => {
    const opened = { closed: false, close: vi.fn() };
    vi.mocked(trpc.session.getExportData.query).mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    const open = vi.spyOn(window, 'open');
    const service = TestBed.inject(SessionResultsExportService);

    await expect(
      service.exportPdfFromSessionCode('ABC123', {
        disposition: 'view',
        viewPlaceholder: opened as unknown as Window,
      }),
    ).rejects.toThrow('UNAUTHORIZED');
    expect(open).not.toHaveBeenCalled();
    expect(opened.close).not.toHaveBeenCalled();
  });

  it('druckt in den reservierten Ansehen-Tab, wenn das Server-PDF scheitert', async () => {
    vi.mocked(trpc.session.getSessionExportPdf.query).mockRejectedValueOnce(
      new Error('pdf worker down'),
    );
    const printWindow = {
      opener: {},
      closed: false,
      document: {
        readyState: 'complete',
        title: '',
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    };
    const open = vi.spyOn(window, 'open');
    const service = TestBed.inject(SessionResultsExportService);

    await expect(
      service.exportPdfFromSessionCode('ABC123', {
        profile: 'visual',
        disposition: 'view',
        viewPlaceholder: printWindow as unknown as Window,
      }),
    ).resolves.toBe('print-fallback');
    expect(open).not.toHaveBeenCalled();
    expect(printWindow.document.write).toHaveBeenCalled();
    expect(printWindow.print).toHaveBeenCalledOnce();
    expect(printWindow.close).not.toHaveBeenCalled();
  });

  it('fällt auf den Download zurück, wenn das Ansehen-Popup blockiert ist', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const service = TestBed.inject(SessionResultsExportService);

    await expect(
      service.exportPdfFromSessionCode('ABC123', { profile: 'visual', disposition: 'view' }),
    ).resolves.toBe('pdf-download');
    expect(click).toHaveBeenCalledOnce();
  });

  it('schließt den Placeholder und lädt herunter, wenn die Navigation fehlschlägt', async () => {
    const opened = {
      opener: {} as Window,
      closed: false,
      document: { title: '' },
      location: {
        assign: vi.fn(() => {
          throw new Error('navigation blocked');
        }),
      },
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(opened as unknown as Window);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const service = TestBed.inject(SessionResultsExportService);

    await expect(
      service.exportPdfFromSessionCode('ABC123', { profile: 'visual', disposition: 'view' }),
    ).resolves.toBe('pdf-download');
    expect(opened.close).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });

  it('druckt den Sammlungsbericht ohne Host-Token, wenn nur das Server-PDF scheitert', async () => {
    const hostPdf = vi.mocked(trpc.session.getSessionExportPdf.query);
    hostPdf.mockClear();
    vi.mocked(trpc.session.getLastSessionExportPdfForQuiz.query).mockRejectedValueOnce(
      new Error('pdf worker down'),
    );
    const printWindow = {
      opener: {},
      document: {
        readyState: 'complete',
        title: '',
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);
    const service = TestBed.inject(SessionResultsExportService);

    await expect(
      service.exportPdfFromQuizHistory('11111111-1111-4111-8111-111111111111', 'access-proof', {
        profile: 'visual',
      }),
    ).resolves.toBe('print-fallback');
    expect(trpc.session.getLastSessionExportDataForQuiz.query).toHaveBeenCalledWith({
      quizId: '11111111-1111-4111-8111-111111111111',
      accessProof: 'access-proof',
    });
    expect(hostPdf).not.toHaveBeenCalled();
    expect(printWindow.print).toHaveBeenCalledOnce();
  });
});
