import type { SessionExportDTO } from '@arsnova/shared-types';
import {
  buildSessionResultsReportHtml,
  getDefaultSessionResultsReportLabelsDe,
} from './session-results-report.util';

const sampleExport: SessionExportDTO = {
  sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
  sessionCode: 'ABC123',
  quizName: 'Demo Quiz',
  finishedAt: '2026-03-24T12:30:00.000Z',
  participantCount: 28,
  teamMode: false,
  questions: [
    {
      questionOrder: 0,
      questionTextShort: 'Was ist 2+2?',
      type: 'SINGLE_CHOICE',
      participantCount: 28,
      aggregationRound: 1,
      averageScore: 850,
      optionDistribution: [
        { text: '3', count: 2, percentage: 7.1, isCorrect: false },
        { text: '4', count: 24, percentage: 85.7, isCorrect: true },
        { text: '5', count: 2, percentage: 7.1, isCorrect: false },
      ],
      confidenceResult: {
        distribution: { '1': 1, '2': 2, '3': 4, '4': 10, '5': 11 },
        crossTab: {
          correctHigh: 18,
          correctMid: 4,
          correctLow: 2,
          incorrectHigh: 3,
          incorrectMid: 1,
          incorrectLow: 0,
        },
        highConfidenceWrongCount: 3,
        highConfidenceWrongOptions: [
          { answerId: '11111111-1111-4111-8111-111111111111', text: '5', count: 2 },
        ],
      },
    },
    {
      questionOrder: 7,
      questionTextShort: 'PI-Frage zur Französischen Revolution',
      type: 'SINGLE_CHOICE',
      participantCount: 25,
      aggregationRound: 2,
      round1ParticipantCount: 28,
      round2ParticipantCount: 25,
      optionDistribution: [
        { text: '1789', count: 20, percentage: 80, isCorrect: true },
        { text: '1799', count: 5, percentage: 20, isCorrect: false },
      ],
      confidenceResult: {
        distribution: { '1': 0, '2': 3, '3': 5, '4': 9, '5': 8 },
        crossTab: {
          correctHigh: 15,
          correctMid: 4,
          correctLow: 1,
          incorrectHigh: 4,
          incorrectMid: 1,
          incorrectLow: 0,
        },
        highConfidenceWrongCount: 4,
      },
    },
  ],
  confidenceSummary: {
    responseCount: 53,
    includedQuestionCount: 2,
    suppressedQuestionCount: 0,
    priorityQuestionCount: 2,
    distribution: { '1': 1, '2': 5, '3': 9, '4': 19, '5': 19 },
    crossTab: {
      correctHigh: 33,
      correctMid: 8,
      correctLow: 3,
      incorrectHigh: 7,
      incorrectMid: 2,
      incorrectLow: 0,
    },
    highConfidenceWrongCount: 7,
    questions: [
      {
        questionOrder: 7,
        questionTextShort: 'PI-Frage zur Französischen Revolution',
        questionType: 'SINGLE_CHOICE',
        responseCount: 25,
        result: {
          distribution: { '1': 0, '2': 3, '3': 5, '4': 9, '5': 8 },
          crossTab: {
            correctHigh: 15,
            correctMid: 4,
            correctLow: 1,
            incorrectHigh: 4,
            incorrectMid: 1,
            incorrectLow: 0,
          },
          highConfidenceWrongCount: 4,
        },
      },
      {
        questionOrder: 0,
        questionTextShort: 'Was ist 2+2?',
        questionType: 'SINGLE_CHOICE',
        responseCount: 28,
        result: {
          distribution: { '1': 1, '2': 2, '3': 4, '4': 10, '5': 11 },
          crossTab: {
            correctHigh: 18,
            correctMid: 4,
            correctLow: 2,
            incorrectHigh: 3,
            incorrectMid: 1,
            incorrectLow: 0,
          },
          highConfidenceWrongCount: 3,
        },
      },
    ],
  },
};

describe('buildSessionResultsReportHtml', () => {
  it('erzeugt Deckblatt, Confidence-Summary und Fragen mit Aggregationsrunde', () => {
    const html = buildSessionResultsReportHtml(
      sampleExport,
      getDefaultSessionResultsReportLabelsDe(),
      {
        localeId: 'de',
        generatedAt: '2026-03-24T12:31:00.000Z',
        pageNumbersViaCss: true,
      },
    );

    expect(html).toContain('Ergebnisbericht');
    expect(html).toContain('Demo Quiz');
    expect(html).toContain('ABC123');
    expect(html).toContain('Lernstand und Selbsteinschätzung');
    expect(html).toContain('Priorität für die Nachbesprechung');
    expect(html).toContain('PI-Frage zur Französischen Revolution');
    expect(html).toContain('Runde 2 (Peer Instruction)');
    expect(html).toContain('Runde 1: 28 Stimmen · Ausgewertet in Runde 2: 25 Stimmen');
    expect(html).toContain('Antwortverteilung');
    expect(html).toContain('keine personenbezogenen Daten');
    expect(html).toContain('report-cover-nav');
    expect(html).toContain('report-cover-summary');
    expect(html).toContain('counter(page)');
  });

  it('listet nur Fragen mit Fehlkonzept-Risiko in der Prioritätenliste', () => {
    const html = buildSessionResultsReportHtml(
      {
        ...sampleExport,
        confidenceSummary: {
          ...sampleExport.confidenceSummary!,
          priorityQuestionCount: 2,
          includedQuestionCount: 3,
          questions: [
            ...sampleExport.confidenceSummary!.questions,
            {
              questionOrder: 3,
              questionTextShort: 'Ohne Fehlkonzept-Risiko',
              questionType: 'SINGLE_CHOICE',
              responseCount: 20,
              result: {
                distribution: { '1': 0, '2': 2, '3': 4, '4': 8, '5': 6 },
                crossTab: {
                  correctHigh: 12,
                  correctMid: 4,
                  correctLow: 2,
                  incorrectHigh: 0,
                  incorrectMid: 1,
                  incorrectLow: 1,
                },
                highConfidenceWrongCount: 0,
              },
            },
          ],
        },
      },
      getDefaultSessionResultsReportLabelsDe(),
      { localeId: 'de' },
    );

    expect(html).toMatch(/Nachbesprechung empfohlen[^<]*2/);
    expect(html).toContain('PI-Frage zur Französischen Revolution');
    expect(html).toContain('Was ist 2+2?');
    expect(html).not.toContain('Ohne Fehlkonzept-Risiko');

    const prioritySection = html.slice(
      html.indexOf('report-priority-list'),
      html.indexOf('</ol>', html.indexOf('report-priority-list')) + 5,
    );
    expect(prioritySection.match(/<li>/g)?.length).toBe(2);
  });

  it('rendert Feedback, Heatmap und Histogramm in Phase 2', () => {
    const html = buildSessionResultsReportHtml(
      {
        ...sampleExport,
        feedbackSummary: {
          totalResponses: 28,
          overallAverage: 4.2,
          overallDistribution: { '4': 10, '5': 18 },
          questionQualityAverage: 4.0,
          questionQualityDistribution: { '4': 12, '5': 16 },
          wouldRepeatYes: 22,
          wouldRepeatNo: 6,
        },
        questions: [
          ...sampleExport.questions,
          {
            questionOrder: 2,
            questionTextShort: 'Schätze Pi',
            questionTextFull: 'Schätze den Wert von **Pi** auf zwei Nachkommastellen.',
            type: 'NUMERIC_ESTIMATE',
            participantCount: 28,
            numericStats: {
              n: 28,
              mean: 3.14,
              median: 3.1,
              stdDev: 0.1,
              q1: 3,
              q3: 3.2,
              iqr: 0.2,
              min: 3,
              max: 3.2,
              inBandCount: 26,
              inBandPercent: 92.8,
              meanAbsoluteError: null,
              meanRelativeError: null,
            },
            numericHistogram: [
              { from: 3, to: 3.1, count: 12, inBand: true },
              { from: 3.1, to: 3.2, count: 16, inBand: true },
            ],
            numericReferenceValue: 3.14,
            numericTolerancePercent: 5,
            numericToleranceMode: 'RELATIVE_PERCENT',
            numericInputType: 'DECIMAL',
            numericDecimalPlaces: 2,
          },
        ],
      },
      getDefaultSessionResultsReportLabelsDe(),
    );

    expect(html).toContain('Feedback der Teilnehmenden');
    expect(html).toContain('report-heatmap');
    expect(html).toContain('report-histogram');
    expect(html).toContain('report-hist-band');
    expect(html).toContain('Toleranzband');
    expect(html).toContain('zwei Nachkommastellen');
    expect(html).toContain('katex');
    expect(html).toContain('hljs');
    expect(html).toContain('report-cover-brand');
    expect(html).toContain('markdown-body');
  });

  it('rendert Umfrage-Antwortverteilung', () => {
    const html = buildSessionResultsReportHtml(
      {
        ...sampleExport,
        questions: [
          {
            questionOrder: 0,
            questionTextShort: 'Stimmung',
            questionTextFull:
              '### Wie ist die Stimmung?\n\n![Emotionen](https://example.org/mood.jpg)',
            type: 'SURVEY',
            participantCount: 30,
            optionDistribution: [
              { text: ':smile: Bereit', count: 12, percentage: 40, isCorrect: false },
              { text: ':neutral_face: Ganz okay', count: 18, percentage: 60, isCorrect: false },
            ],
          },
        ],
        confidenceSummary: undefined,
      },
      getDefaultSessionResultsReportLabelsDe(),
      { localeId: 'de', pageNumbersViaCss: true },
    );

    expect(html).toContain('Antwortverteilung');
    expect(html).toContain('report-bars');
    expect(html).toContain('Bereit');
    expect(html).toContain('report-bar-leading-emoji');
    expect(html).toContain('report-bar-label-text');
    expect(html).toContain('😄');
  });

  it('lässt Confidence-Block weg, wenn keine Summary vorliegt', () => {
    const html = buildSessionResultsReportHtml(
      { ...sampleExport, confidenceSummary: undefined },
      getDefaultSessionResultsReportLabelsDe(),
    );
    expect(html).not.toContain('Lernstand und Selbsteinschätzung');
    expect(html).toContain('Fragen im Detail');
  });
});
