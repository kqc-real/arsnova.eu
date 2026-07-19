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
      correctCount: 24,
      incorrectCount: 4,
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
      correctCount: 20,
      incorrectCount: 5,
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

    expect(html).toContain('Didaktische Quiz-Auswertung');
    expect(html).toContain('Lernstand, mögliche Fehlkonzepte und Nachbesprechungsplan');
    expect(html).toContain('Demo Quiz');
    expect(html).toContain('ABC123');
    expect(html).toContain('So liest du die Auswertung');
    expect(html).toContain('Selbsteinschätzung 1–5');
    expect(html).toContain('Nachbesprechungsimpuls');
    expect(html).toContain('data-continuation="Frage 1 – Fortsetzung:');
    expect(html).not.toContain('<table class="report-question-continued-table');
    expect(html).not.toContain('aria-hidden="true">Fortsetzung');
    expect(html).toContain('Lernstand und Selbsteinschätzung');
    expect(html).toContain('Dein Nachbesprechungsplan');
    expect(html).toContain('Nächste Schritte');
    expect(html).not.toContain('Das solltest du nachbesprechen');
    expect(html).not.toContain('Kurzfazit dieser Session');
    expect(html).toContain('report-cover-continued');
    expect(html).toContain('PI-Frage zur Französischen Revolution');
    expect(html).toContain('Runde 2 (Peer Instruction)');
    expect(html).toContain('Runde 1: 28 Stimmen · Ausgewertet in Runde 2: 25 Stimmen');
    expect(html).toContain('Antwortverteilung');
    expect(html).toContain(
      'Datenschutz: Der Bericht enthält ausschließlich aggregierte Ergebnisse.',
    );
    expect(html).not.toContain('Enthalten: aggregierte Quiz-Ergebnisse');
    expect(html).not.toContain('Ø Punkte');
    expect(html).toContain('Richtig beantwortet');
    expect(html).toContain('Mittlere Sicherheit');
    expect(html).toContain('report-cover-nav');
    expect(html).toContain('report-cover-summary');
    expect(html).toContain('counter(page)');
  });

  it('nimmt nur Fragen mit Fehlkonzept-Hinweis in „Mögliches Fehlkonzept zuerst klären“ auf', () => {
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
              questionTextShort: 'Ohne Fehlkonzept-Hinweis',
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

    expect(html).toContain(
      '2 Fragen werden zur Nachbesprechung empfohlen. Mindestens 2 Personen und mindestens 10 %',
    );
    expect(html).toContain('Dein Nachbesprechungsplan');
    expect(html).toContain('PI-Frage zur Französischen Revolution');
    expect(html).toContain('Was ist 2+2?');

    const planStart = html.indexOf('id="report-action-plan"');
    expect(planStart).toBeGreaterThanOrEqual(0);
    const planSection = html.slice(planStart, html.indexOf('</section>', planStart) + 10);
    const debriefLine =
      planSection.match(
        /Mögliches Fehlkonzept zuerst klären:[\s\S]*?(?=<\/div>\s*<div class="report-action-plan-row"|<\/div>\s*<\/div>)/,
      )?.[0] ?? '';
    expect(debriefLine).toContain('Frage 8');
    expect(debriefLine).toContain('Frage 1');
    expect(debriefLine).not.toContain('Frage 4');
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
    expect(html).toContain('Akzeptierter Bereich');
    expect(html).toContain('Antworten: 28');
    expect(html).toContain('Mittelwert: 3,14');
    expect(html).toContain('Standardabweichung: 0,10');
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
    expect(html).toContain('Selbsteinschätzung wird für den Fragetyp »Umfrage« nicht angeboten.');
  });

  it('unterscheidet nicht unterstützte und deaktivierte Selbsteinschätzung', () => {
    const html = buildSessionResultsReportHtml(
      {
        ...sampleExport,
        questions: [
          {
            questionOrder: 0,
            questionTextShort: 'Umfrage',
            type: 'SURVEY',
            participantCount: 30,
            confidenceEnabled: false,
          },
          {
            questionOrder: 1,
            questionTextShort: 'Codefrage',
            type: 'SINGLE_CHOICE',
            participantCount: 30,
            confidenceEnabled: false,
          },
        ],
        confidenceSummary: {
          ...sampleExport.confidenceSummary!,
          includedQuestionCount: 0,
          responseCount: 0,
          priorityQuestionCount: 0,
          questions: [],
        },
      },
      getDefaultSessionResultsReportLabelsDe(),
      { localeId: 'de' },
    );

    expect(html).toContain('Selbsteinschätzung wird nicht erhoben für Frage 1 (Umfrage).');
    expect(html).toContain('Die Selbsteinschätzung war in diesem Quiz für Frage 2 deaktiviert.');
    expect(html).toContain('Selbsteinschätzung wird für den Fragetyp »Umfrage« nicht angeboten.');
    expect(html).toContain('Selbsteinschätzung von dir in diesem Quiz deaktiviert.');
  });

  it('formatiert Scores und Zeitstempel einheitlich', () => {
    const html = buildSessionResultsReportHtml(
      {
        ...sampleExport,
        teamMode: true,
        teamLeaderboard: [
          {
            rank: 1,
            teamName: 'Team Apfel',
            teamColor: null,
            memberCount: 25,
            totalScore: 11279.2,
            averageScore: 11279.2,
          },
        ],
        bonusTokens: [
          {
            rank: 1,
            nickname: 'Silberner Dodo',
            token: 'BNS-TEST-CODE',
            quizName: 'Demo Quiz',
            totalScore: 12792,
            generatedAt: '2026-07-17T07:21:00.000Z',
          },
        ],
      },
      getDefaultSessionResultsReportLabelsDe(),
      { localeId: 'de', generatedAt: '2026-07-17T08:22:00.000Z' },
    );

    expect(html).toContain('11.279,2');
    expect(html).toContain('12.792');
    expect(html).toContain('17.07.2026');
    expect(html).toContain('Uhr');
    expect(html).toContain('Punkte sind ein Rankingwert');
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
