import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionResultsExportService } from './session-results-export.service';
import { trpc } from './trpc.client';

vi.mock('./trpc.client', () => ({
  trpc: {
    session: {
      getExportData: { query: vi.fn() },
      getSessionExportPdf: { query: vi.fn() },
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
});
