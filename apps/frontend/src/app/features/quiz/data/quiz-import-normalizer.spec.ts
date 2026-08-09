import { describe, expect, it } from 'vitest';
import arsnovaClickMaximalExport from '../../../../../../../docs/examples/quiz-import/arsnova-click-maximal-export.json';
import { normalizeQuizImportPayload } from './quiz-import-normalizer';

function buildClickExport(
  overrides: {
    confidenceSliderEnabled?: boolean;
    confidenceLabelLow?: string;
    confidenceLabelHigh?: string;
    questionList?: unknown[];
  } = {},
) {
  return {
    name: 'Click Confidence Import',
    questionList: overrides.questionList ?? [
      {
        TYPE: 'SingleChoiceQuestion',
        questionText: 'Single Choice',
        answerOptionList: [
          { answerText: 'A', isCorrect: false },
          { answerText: 'B', isCorrect: true },
        ],
      },
      {
        TYPE: 'SurveyQuestion',
        questionText: 'Umfrage',
        answerOptionList: [{ answerText: 'Ja' }, { answerText: 'Nein' }],
      },
      {
        TYPE: 'FreeTextQuestion',
        questionText: 'Kurzantwort',
        answerOptionList: [{ answerText: 'Paris' }],
      },
      {
        TYPE: 'RangedQuestion',
        questionText: 'Schaetzfrage',
        answerOptionList: [],
        rangeMin: 0,
        rangeMax: 10,
        correctValue: 5,
      },
    ],
    sessionConfig: {
      ...(overrides.confidenceSliderEnabled === undefined
        ? {}
        : { confidenceSliderEnabled: overrides.confidenceSliderEnabled }),
      ...(overrides.confidenceLabelLow ? { confidenceLabelLow: overrides.confidenceLabelLow } : {}),
      ...(overrides.confidenceLabelHigh
        ? { confidenceLabelHigh: overrides.confidenceLabelHigh }
        : {}),
    },
  };
}

describe('normalizeQuizImportPayload – arsnova.click Sicherheitsgrad', () => {
  it('uebernimmt confidenceSliderEnabled fuer bewertbare Fragetypen', () => {
    const result = normalizeQuizImportPayload(
      buildClickExport({
        confidenceSliderEnabled: true,
        confidenceLabelLow: 'Geraten',
        confidenceLabelHigh: 'Sehr sicher',
      }),
    );

    const questions = (result.payload as { quiz: { questions: Array<Record<string, unknown>> } })
      .quiz.questions;

    expect(questions[0]).toMatchObject({
      type: 'SINGLE_CHOICE',
      confidenceEnabled: true,
      confidenceLabelLow: 'Geraten',
      confidenceLabelHigh: 'Sehr sicher',
    });
    expect(questions[1]).toMatchObject({ type: 'SURVEY' });
    expect(questions[1]?.confidenceEnabled).not.toBe(true);
    expect(questions[2]).toMatchObject({
      type: 'SHORT_TEXT',
      confidenceEnabled: true,
      confidenceLabelLow: 'Geraten',
      confidenceLabelHigh: 'Sehr sicher',
    });
    expect(questions[3]).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      confidenceEnabled: true,
      confidenceLabelLow: 'Geraten',
      confidenceLabelHigh: 'Sehr sicher',
    });
    expect(
      result.warnings.some((warning) =>
        warning.message.includes('Selbsteinschätzung wurde für bewertbare Fragen übernommen'),
      ),
    ).toBe(true);
  });

  it('ergänzt in nativen Altimporten opake, voneinander unabhängige Struktur-IDs', () => {
    const result = normalizeQuizImportPayload({
      exportVersion: 27,
      quiz: {
        name: 'Legacy-Strukturquiz',
        questions: [
          {
            type: 'MATCHING',
            matchingPairs: [
              { left: 'A', right: '1' },
              { left: 'B', right: '2' },
            ],
          },
          {
            type: 'CATEGORIZATION',
            categorizationItems: [
              { text: 'A', correctCategoryId: 'cat-a' },
              { text: 'B', correctCategoryId: 'cat-b' },
            ],
          },
        ],
      },
    });
    const questions = (result.payload as { quiz: { questions: Array<Record<string, unknown>> } })
      .quiz.questions;
    const pairs = questions[0]?.matchingPairs as Array<Record<string, string>>;
    const items = questions[1]?.categorizationItems as Array<Record<string, string>>;
    const ids = [
      ...pairs.flatMap((pair) => [pair.leftId, pair.rightId]),
      ...items.map((item) => item.id),
    ];

    expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(pairs[0]?.leftId).not.toContain('matching-left');
    expect(pairs[0]?.rightId).not.toContain('matching-right');
    expect(questions[0]?.matchingShuffleRight).toBe(true);
    expect(questions[1]?.categorizationShuffleItems).toBe(true);
  });

  it('setzt keinen Sicherheitsgrad ohne confidenceSliderEnabled', () => {
    const result = normalizeQuizImportPayload(buildClickExport({ confidenceSliderEnabled: false }));

    const questions = (result.payload as { quiz: { questions: Array<Record<string, unknown>> } })
      .quiz.questions;

    for (const question of questions) {
      expect(question.confidenceEnabled).not.toBe(true);
    }
    expect(result.warnings.some((warning) => warning.message.includes('Selbsteinschätzung'))).toBe(
      false,
    );
  });

  it('listet confidenceSliderEnabled nicht mehr unter ignorierten Quiz-Optionen', () => {
    const result = normalizeQuizImportPayload(buildClickExport({ confidenceSliderEnabled: true }));

    const ignored = result.warnings.find((warning) => warning.kind === 'ignored_quiz_options');
    expect(ignored?.detail ?? '').not.toContain('sessionConfig.confidenceSliderEnabled');
  });

  it('importiert das Maximalbeispiel mit aktiviertem Sicherheitsgrad an bewertbaren Fragen', () => {
    const result = normalizeQuizImportPayload(arsnovaClickMaximalExport);
    const questions = (result.payload as { quiz: { questions: Array<Record<string, unknown>> } })
      .quiz.questions;

    expect(questions.find((question) => question.text === 'Single Choice')).toMatchObject({
      confidenceEnabled: true,
    });
    expect(questions.find((question) => question.text === 'Schaetzfrage')).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      confidenceEnabled: true,
    });
    expect(questions.find((question) => question.text === 'ABCD')?.confidenceEnabled).not.toBe(
      true,
    );
  });
});
