import { describe, expect, it, vi } from 'vitest';
import type { SessionExportDTO } from '@arsnova/shared-types';
import {
  buildSessionResultsPdf,
  buildSessionResultsPdfFilename,
  createPdfExternalImageLoader,
  PDF_IMAGE_INLINE_DEADLINE_MS,
  PDF_MAX_EXTERNAL_IMAGE_BYTES,
  PDF_MAX_EXTERNAL_IMAGE_PIXELS,
  PDF_MAX_EXTERNAL_IMAGES,
} from '../lib/session-results-report-pdf';

const mocks = vi.hoisted(() => ({
  route: vi.fn(
    async (
      _pattern: RegExp,
      _handler: (route: { abort: (reason: string) => Promise<void> }) => Promise<void>,
    ) => undefined,
  ),
  setContent: vi.fn(async (_html: string, _options?: unknown) => undefined),
  fetchSafeExternalImage: vi.fn(),
}));

vi.mock('../lib/safeExternalImageFetch', () => ({
  fetchSafeExternalImage: mocks.fetchSafeExternalImage,
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(async () => ({
      newPage: vi.fn(async () => ({
        route: mocks.route,
        setContent: mocks.setContent,
        pdf: vi.fn(async (options?: { displayHeaderFooter?: boolean }) => {
          expect(options?.displayHeaderFooter).toBe(true);
          return Buffer.from('%PDF-1.4\n% test');
        }),
      })),
      close: vi.fn(async () => undefined),
    })),
  },
}));

const sampleExport: SessionExportDTO = {
  sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
  sessionCode: 'ABC123',
  quizName: 'Demo Quiz',
  finishedAt: '2026-03-24T12:30:00.000Z',
  participantCount: 30,
  teamMode: false,
  questions: [
    {
      questionOrder: 0,
      questionTextShort: 'Was ist 2+2?',
      questionTextFull: 'Was ist **2+2**?',
      type: 'SINGLE_CHOICE',
      participantCount: 30,
      optionDistribution: [
        { text: '4', count: 25, percentage: 83.3, isCorrect: true },
        { text: '5', count: 5, percentage: 16.7, isCorrect: false },
      ],
    },
  ],
};

describe('buildSessionResultsPdf', () => {
  it('erzeugt eine gültige PDF-Datei', async () => {
    const buffer = await buildSessionResultsPdf(sampleExport);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });

  it('ersetzt abgelehnte Bilder, inlinet CSS und sperrt Chromium-Netzwerk', async () => {
    mocks.fetchSafeExternalImage.mockRejectedValueOnce(new Error('blocked target'));
    const imageUrl = 'https://images.example.test/internal.png';
    const exportWithImage: SessionExportDTO = {
      ...sampleExport,
      questions: [
        {
          ...sampleExport.questions[0],
          questionTextFull: `Bild: ![intern](${imageUrl})`,
        },
      ],
    };

    await buildSessionResultsPdf(exportWithImage);

    const html = String(mocks.setContent.mock.calls.at(-1)?.[0]);
    expect(html).not.toContain(imageUrl);
    expect(html).not.toContain('cdn.jsdelivr.net');
    expect(html).toContain('data:image/gif;base64,');
    expect(html).toContain('data-pdf-source="katex"');
    expect(html).toContain('data-pdf-source="highlight"');
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).not.toContain('url(fonts/');

    const [urlPattern, routeHandler] = mocks.route.mock.calls.at(-1) ?? [];
    expect(urlPattern).toEqual(/^(?:https?|file):/i);
    const abort = vi.fn(async (_reason: string) => undefined);
    expect(routeHandler).toBeDefined();
    await routeHandler!({ abort });
    expect(abort).toHaveBeenCalledWith('blockedbyclient');
  });

  it('baut einen sprachneutralen Dateinamen', () => {
    expect(buildSessionResultsPdfFilename('Übung / Demo', 'ABC123')).toBe(
      'arsnova-results-Ubung-Demo-ABC123.pdf',
    );
  });

  it('begrenzt Anzahl und Gesamtdauer externer Bildabrufe', async () => {
    let nowMs = 0;
    const fetchImage = vi.fn(async () => ({
      bytes: new Uint8Array([1]),
      mimeType: 'image/png' as const,
      width: 1,
      height: 1,
      pixelCount: 1,
    }));
    const loader = createPdfExternalImageLoader(() => nowMs, fetchImage);
    const options = { timeoutMs: 15_000, maxImageBytes: 400_000 };

    for (let index = 0; index < PDF_MAX_EXTERNAL_IMAGES; index += 1) {
      await expect(
        loader(`https://images.example.test/${index}.png`, options),
      ).resolves.not.toBeNull();
    }
    await expect(loader('https://images.example.test/overflow.png', options)).resolves.toBeNull();
    expect(fetchImage).toHaveBeenCalledTimes(PDF_MAX_EXTERNAL_IMAGES);

    const deadlineLoader = createPdfExternalImageLoader(() => nowMs, fetchImage);
    nowMs = PDF_IMAGE_INLINE_DEADLINE_MS + 1;
    await expect(
      deadlineLoader('https://images.example.test/late.png', options),
    ).resolves.toBeNull();
  });

  it('begrenzt komprimierte Bytes und dekodierte Pixel je Report', async () => {
    const options = { timeoutMs: 15_000, maxImageBytes: 400_000 };
    const byteFetch = vi
      .fn()
      .mockResolvedValueOnce({
        bytes: new Uint8Array(PDF_MAX_EXTERNAL_IMAGE_BYTES),
        mimeType: 'image/png' as const,
        width: 1,
        height: 1,
        pixelCount: 1,
      })
      .mockResolvedValueOnce({
        bytes: new Uint8Array([1]),
        mimeType: 'image/png' as const,
        width: 1,
        height: 1,
        pixelCount: 1,
      });
    const byteLoader = createPdfExternalImageLoader(Date.now, byteFetch);
    await expect(byteLoader('https://images.example.test/a.png', options)).resolves.not.toBeNull();
    await expect(byteLoader('https://images.example.test/b.png', options)).resolves.toBeNull();

    const pixelFetch = vi.fn(async () => ({
      bytes: new Uint8Array([1]),
      mimeType: 'image/png' as const,
      width: 4_000,
      height: 4_000,
      pixelCount: 16_000_000,
    }));
    const pixelLoader = createPdfExternalImageLoader(Date.now, pixelFetch);
    await expect(pixelLoader('https://images.example.test/a.png', options)).resolves.not.toBeNull();
    await expect(pixelLoader('https://images.example.test/b.png', options)).resolves.not.toBeNull();
    await expect(pixelLoader('https://images.example.test/c.png', options)).resolves.toBeNull();
    expect(PDF_MAX_EXTERNAL_IMAGE_PIXELS).toBe(40_000_000);
  });
});
