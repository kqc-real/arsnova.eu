import { describe, expect, it, vi } from 'vitest';
import type { SessionExportDTO } from '@arsnova/shared-types';
import {
  buildSessionResultsPdf,
  buildSessionResultsPdfFilename,
} from '../lib/session-results-report-pdf';

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(async () => ({
      newPage: vi.fn(async () => ({
        setContent: vi.fn(async () => undefined),
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

  it('baut einen sprachneutralen Dateinamen', () => {
    expect(buildSessionResultsPdfFilename('Übung / Demo', 'ABC123')).toBe(
      'arsnova-results-Ubung-Demo-ABC123.pdf',
    );
  });
});
