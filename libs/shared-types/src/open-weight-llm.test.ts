import { describe, expect, it } from 'vitest';
import {
  hasOnlyAllowedOpenWeightLlmReferences,
  OPEN_WEIGHT_LLM_MAX_REQUEST_BYTES,
  OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  OpenWeightLlmCancelRequestSchema,
  OpenWeightLlmCancelResponseSchema,
  OpenWeightLlmLearningObjectivesRequestSchema,
  OpenWeightLlmLearningObjectivesOutputSchema,
  OpenWeightLlmOutputSchema,
  OpenWeightLlmRequestSchema,
  OpenWeightLlmSummaryOutputSchema,
  OpenWeightLlmTopicLabelOutputSchema,
  type OpenWeightLlmLearningObjectivesRequest,
  type OpenWeightLlmSummaryRequest,
  type OpenWeightLlmTopicLabelRequest,
} from './open-weight-llm.js';

const SOURCE_ID = 'qa-question:11111111-1111-4111-8111-111111111111';
const QUESTION_ID = '22222222-2222-4222-8222-222222222222';

const labelRequest: OpenWeightLlmTopicLabelRequest = {
  schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  taskType: 'topic_label',
  locale: 'de',
  clusterId: 'cluster-1',
  sources: [{ id: SOURCE_ID, text: 'Mehr Beispiele zur linearen Regression.' }],
};

const summaryRequest: OpenWeightLlmSummaryRequest = {
  schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  taskType: 'qa_summary',
  locale: 'de',
  snapshotHash: 'a'.repeat(64),
  sources: [{ id: SOURCE_ID, kind: 'qa-question', text: 'Ist Kapitel 4 klausurrelevant?' }],
};

const learningRequest: OpenWeightLlmLearningObjectivesRequest = {
  schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  taskType: 'learning_objectives',
  locale: 'de',
  requestId: '33333333-3333-4333-8333-333333333333',
  questions: [
    {
      id: QUESTION_ID,
      text: 'Welche Gerade beschreibt y = 2x + 1?',
      answerOptions: [
        { text: 'Steigung 2, Achsenabschnitt 1', isCorrect: true },
        { text: 'Steigung 1, Achsenabschnitt 2', isCorrect: false },
      ],
      solutionExplanation: 'Die Koeffizienten stehen direkt in der Geradengleichung.',
    },
  ],
};

describe('open-weight LLM contracts', () => {
  it('akzeptiert im privaten Abbruchvertrag genau eine Auftrags-ID der Version 4', () => {
    const inferenceId = '12345678-90ab-4def-8abc-1234567890ab';
    expect(OpenWeightLlmCancelRequestSchema.parse({ inferenceId })).toEqual({ inferenceId });
    expect(
      OpenWeightLlmCancelRequestSchema.safeParse({
        inferenceId: '12345678-90ab-7def-8abc-1234567890ab',
      }).success,
    ).toBe(false);
    expect(OpenWeightLlmCancelRequestSchema.safeParse({ inferenceId, slot: 0 }).success).toBe(
      false,
    );
    expect(OpenWeightLlmCancelResponseSchema.safeParse({ status: 'accepted' }).success).toBe(true);
    expect(OpenWeightLlmCancelResponseSchema.safeParse({ status: 'unknown' }).success).toBe(true);
    expect(OpenWeightLlmCancelResponseSchema.safeParse({ status: 'cancelled' }).success).toBe(
      false,
    );
  });

  it('erkennt alle drei versionierten Auftragstypen streng', () => {
    expect(OpenWeightLlmRequestSchema.parse(labelRequest).taskType).toBe('topic_label');
    expect(OpenWeightLlmRequestSchema.parse(summaryRequest).taskType).toBe('qa_summary');
    expect(OpenWeightLlmRequestSchema.parse(learningRequest).taskType).toBe('learning_objectives');
    expect(() =>
      OpenWeightLlmRequestSchema.parse({ ...labelRequest, taskType: 'unknown' }),
    ).toThrow();
    expect(() =>
      OpenWeightLlmRequestSchema.parse({ ...labelRequest, participantId: 'leak' }),
    ).toThrow();
  });

  it('begrenzt jeden Auftrag als UTF-8-Bytebudget für das 4K-Kontextfenster', () => {
    const oversizedLearningRequest = {
      ...learningRequest,
      questions: Array.from({ length: 2 }, (_, index) => ({
        ...learningRequest.questions[0]!,
        id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
        // Jede Aufgabe bleibt einzeln unter den Feldgrenzen; zusammen belegen
        // 1,200 Emoji-Bytes je Aufgabe plus den übrigen JSON-Vertrag.
        text: '🧪'.repeat(300),
      })),
    };
    const oversizedLabelRequest = {
      ...labelRequest,
      sources: Array.from({ length: 6 }, (_, index) => ({
        id: `source-${index}`,
        text: 'x'.repeat(500),
      })),
    };
    const oversizedSummaryRequest = {
      ...summaryRequest,
      sources: Array.from({ length: 6 }, (_, index) => ({
        id: `qa-question:${index}`,
        kind: 'qa-question' as const,
        text: 'x'.repeat(500),
      })),
    };

    for (const request of [
      oversizedLearningRequest,
      oversizedLabelRequest,
      oversizedSummaryRequest,
    ]) {
      const result = OpenWeightLlmRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('UTF-8-Bytes'))).toBe(
          true,
        );
      }
      expect(new TextEncoder().encode(JSON.stringify(request)).byteLength).toBeGreaterThan(
        OPEN_WEIGHT_LLM_MAX_REQUEST_BYTES,
      );
    }
    expect(
      OpenWeightLlmLearningObjectivesRequestSchema.safeParse(oversizedLearningRequest).success,
    ).toBe(false);
  });

  it('verwirft Antworten mit falschem Auftragstyp oder unbekannten Feldern', () => {
    const labelOutput = {
      schemaVersion: 1,
      taskType: 'topic_label',
      label: 'Lineare Regression',
      sourceIds: [SOURCE_ID],
    } as const;
    expect(OpenWeightLlmTopicLabelOutputSchema.parse(labelOutput)).toEqual(labelOutput);
    expect(
      OpenWeightLlmOutputSchema.safeParse({ ...labelOutput, taskType: 'qa_summary' }).success,
    ).toBe(false);
    expect(
      OpenWeightLlmTopicLabelOutputSchema.safeParse({ ...labelOutput, confidence: 0.9 }).success,
    ).toBe(false);
  });

  it('bindet Label- und Summary-Aussagen ausschließlich an Eingabequellen', () => {
    const validLabel = OpenWeightLlmTopicLabelOutputSchema.parse({
      schemaVersion: 1,
      taskType: 'topic_label',
      label: 'Lineare Regression',
      sourceIds: [SOURCE_ID],
    });
    expect(hasOnlyAllowedOpenWeightLlmReferences(labelRequest, validLabel)).toBe(true);
    expect(
      hasOnlyAllowedOpenWeightLlmReferences(labelRequest, {
        ...validLabel,
        sourceIds: ['qa-question:foreign'],
      }),
    ).toBe(false);

    const summary = OpenWeightLlmSummaryOutputSchema.parse({
      schemaVersion: 1,
      taskType: 'qa_summary',
      result: {
        status: 'ready',
        statements: [{ text: 'Kapitel 4 ist wiederholt Thema.', sourceIds: [SOURCE_ID] }],
        suggestedNextSteps: [],
        limitations: [],
        modelVersion: 'runtime-fixture',
      },
    });
    expect(hasOnlyAllowedOpenWeightLlmReferences(summaryRequest, summary)).toBe(true);
    expect(
      hasOnlyAllowedOpenWeightLlmReferences(summaryRequest, {
        ...summary,
        result: {
          ...summary.result,
          statements: [{ text: 'Unbelegt.', sourceIds: ['qa-question:foreign'] }],
        },
      }),
    ).toBe(false);
  });

  it('bindet Lernzielvorschläge ausschließlich an übergebene Aufgaben', () => {
    const output = OpenWeightLlmLearningObjectivesOutputSchema.parse({
      schemaVersion: 1,
      taskType: 'learning_objectives',
      objectives: [
        {
          text: 'Die Studierenden können lineare Funktionen interpretieren.',
          questionIds: [QUESTION_ID],
        },
      ],
      limitations: [],
    });
    expect(hasOnlyAllowedOpenWeightLlmReferences(learningRequest, output)).toBe(true);
    expect(
      hasOnlyAllowedOpenWeightLlmReferences(learningRequest, {
        ...output,
        objectives: [
          {
            text: output.objectives[0]!.text,
            questionIds: ['44444444-4444-4444-8444-444444444444'],
          },
        ],
      }),
    ).toBe(false);
  });
});
