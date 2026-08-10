import { describe, expect, it } from 'vitest';
import type { SessionExportDTO } from '@arsnova/shared-types';
import { getSessionResultsReportLabelsDe } from './labels-de';
import { buildSessionResultsReportHtml } from './session-results-report.util';

describe('Session-Verlauf im Ergebnisbericht', () => {
  it('zeigt Originalnummern, Umfang und geöffnete Fragen ohne Antworten neutral an', () => {
    const data: SessionExportDTO = {
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      sessionCode: 'ABC123',
      quizName: 'Verlaufsquiz',
      finishedAt: '2026-08-10T12:30:00.000Z',
      participantCount: 0,
      teamMode: false,
      questionProgressAvailable: true,
      totalQuestionCount: 3,
      conductedQuestionCount: 1,
      skippedQuestionCount: 1,
      startQuestionOrder: 2,
      questions: [
        {
          questionOrder: 1,
          questionTextShort: 'Geöffnet ohne Antworten',
          questionTextFull: 'Geöffnet ohne Antworten',
          type: 'SINGLE_CHOICE',
          participantCount: 0,
          optionDistribution: [],
        },
      ],
    };

    const html = buildSessionResultsReportHtml(data, getSessionResultsReportLabelsDe(), {
      localeId: 'de',
      generatedAt: '2026-08-10T12:31:00.000Z',
    });

    expect(html).toContain('1 von 3 Fragen durchgeführt · 1 ausgelassen');
    expect(html).toContain('Start bei Frage 2');
    expect(html).toContain('Frage 2 von 3');
    expect(html).toContain('Keine Antworten');
    expect(html).not.toContain('Nie geöffnet');
    expect(html).not.toContain('Ausgelassene Frage');
  });

  it('behauptet für Legacy-Sessions ohne autoritativen Verlauf keinen präzisen Umfang', () => {
    const data: SessionExportDTO = {
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      sessionCode: 'LEGACY',
      quizName: 'Historisches Quiz',
      finishedAt: '2026-08-10T12:30:00.000Z',
      participantCount: 4,
      teamMode: false,
      questionProgressAvailable: false,
      totalQuestionCount: 12,
      conductedQuestionCount: 12,
      skippedQuestionCount: 0,
      startQuestionOrder: 5,
      questions: [],
    };

    const html = buildSessionResultsReportHtml(data, getSessionResultsReportLabelsDe(), {
      localeId: 'de',
      generatedAt: '2026-08-10T12:31:00.000Z',
    });

    expect(html).not.toContain('12 von 12 Fragen durchgeführt');
    expect(html).not.toContain('<dt>Durchführung</dt>');
    expect(html).not.toContain('Start bei Frage');
  });
});
