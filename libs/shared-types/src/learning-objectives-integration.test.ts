import { describe, expect, it } from 'vitest';
import {
  AttachQuizToSessionInputSchema,
  AttachQuizToSessionOutputSchema,
  QUIZ_EXPORT_LEGACY_VERSION,
  QUIZ_EXPORT_VERSION,
  QuizExportSchema,
  QuizExportV1Schema,
  QuizExportV2Schema,
  QuizImportSchema,
  QuizUploadInputSchema,
  serializeQuizHistoryAccessMaterial,
} from './schemas.js';
import type { QuizLearningObjectiveBundleV1 } from './learning-objectives.js';

const SOURCE_QUIZ_ID = '10000000-0000-4000-8000-000000000001';
const SOURCE_QUESTION_A_ID = '10000000-0000-4000-8000-000000000002';
const SOURCE_QUESTION_B_ID = '10000000-0000-4000-8000-000000000003';
const OBJECTIVE_ID = '10000000-0000-4000-8000-000000000004';
const SERVER_QUIZ_ID = '10000000-0000-4000-8000-000000000005';
const SESSION_ID = '10000000-0000-4000-8000-000000000006';
const OPERATION_ID = '10000000-0000-4000-8000-000000000007';
const SERVER_QUESTION_ID = '10000000-0000-4000-8000-000000000008';

const settings = {
  name: 'Regressionsquiz',
  showLeaderboard: true,
  allowCustomNicknames: true,
  enableSoundEffects: true,
  enableRewardEffects: true,
  enableMotivationMessages: true,
  enableEmojiReactions: true,
  anonymousMode: false,
  teamMode: false,
  nicknameTheme: 'HIGH_SCHOOL' as const,
};

const question = {
  text: 'Was beschreibt die Steigung?',
  type: 'SINGLE_CHOICE' as const,
  difficulty: 'MEDIUM' as const,
  order: 0,
  answers: [
    { text: 'Die erwartete Änderung von y je Einheit x.', isCorrect: true },
    { text: 'Nur den Achsenabschnitt.', isCorrect: false },
  ],
};

function bundle(
  sourceQuestionIds: string[] = [SOURCE_QUESTION_A_ID],
): QuizLearningObjectiveBundleV1 {
  return {
    schemaVersion: 1,
    quizId: SOURCE_QUIZ_ID,
    revision: 1,
    objectives: [
      {
        id: OBJECTIVE_ID,
        revision: 1,
        text: 'Die Studierenden können Regressionsparameter interpretieren.',
        scope: { kind: 'question-set', sourceQuestionIds },
        origin: { kind: 'manual' },
        confirmation: { state: 'draft' },
        createdAt: '2026-10-04T08:00:00.000Z',
        updatedAt: '2026-10-04T08:00:00.000Z',
      },
    ],
  };
}

function bundleWithRemovedSource(
  sourceQuestionId = SOURCE_QUESTION_B_ID,
): QuizLearningObjectiveBundleV1 {
  return {
    schemaVersion: 1,
    quizId: SOURCE_QUIZ_ID,
    revision: 2,
    objectives: [
      {
        id: OBJECTIVE_ID,
        revision: 2,
        text: 'Die Studierenden können Regressionsparameter interpretieren.',
        scope: { kind: 'question-set', sourceQuestionIds: [sourceQuestionId] },
        origin: { kind: 'manual' },
        confirmation: {
          state: 'needs-review',
          previousConfirmation: { state: 'draft', revision: 1 },
          currentRevision: 2,
          reason: 'source-reference-removed',
        },
        createdAt: '2026-10-04T08:00:00.000Z',
        updatedAt: '2026-10-04T09:00:00.000Z',
      },
    ],
  };
}

function exportV1() {
  return {
    exportVersion: QUIZ_EXPORT_LEGACY_VERSION,
    exportedAt: '2026-10-04T08:00:00.000Z',
    quiz: { ...settings, questions: [question] },
  };
}

function exportV2() {
  return {
    exportVersion: QUIZ_EXPORT_VERSION,
    exportedAt: '2026-10-04T08:00:00.000Z',
    quiz: {
      ...settings,
      sourceQuizId: SOURCE_QUIZ_ID,
      questions: [{ ...question, sourceQuestionId: SOURCE_QUESTION_A_ID }],
      learningObjectives: bundle(),
    },
  };
}

describe('learning-objective upload integration', () => {
  it('keeps a legacy upload valid while requiring all-or-none source identity', () => {
    expect(QuizUploadInputSchema.safeParse({ ...settings, questions: [question] }).success).toBe(
      true,
    );

    expect(
      QuizUploadInputSchema.safeParse({
        ...settings,
        sourceQuizId: SOURCE_QUIZ_ID,
        questions: [question],
      }).success,
    ).toBe(false);

    expect(
      QuizUploadInputSchema.safeParse({
        ...settings,
        questions: [{ ...question, sourceQuestionId: SOURCE_QUESTION_A_ID }],
      }).success,
    ).toBe(false);
  });

  it('accepts one consistent bundle and rejects duplicate, foreign, or cross-quiz references', () => {
    const valid = {
      ...settings,
      sourceQuizId: SOURCE_QUIZ_ID,
      learningObjectives: bundle(),
      questions: [
        { ...question, sourceQuestionId: SOURCE_QUESTION_A_ID },
        { ...question, order: 1, sourceQuestionId: SOURCE_QUESTION_B_ID },
      ],
    };
    expect(QuizUploadInputSchema.safeParse(valid).success).toBe(true);
    expect(
      QuizUploadInputSchema.safeParse({
        ...valid,
        learningObjectives: { ...bundle(), objectives: [] },
      }).success,
    ).toBe(true);

    expect(
      QuizUploadInputSchema.safeParse({
        ...valid,
        questions: valid.questions.map((entry) => ({
          ...entry,
          sourceQuestionId: SOURCE_QUESTION_A_ID,
        })),
      }).success,
    ).toBe(false);

    expect(
      QuizUploadInputSchema.safeParse({
        ...valid,
        learningObjectives: bundle(['10000000-0000-4000-8000-000000000099']),
      }).success,
    ).toBe(false);

    expect(
      QuizUploadInputSchema.safeParse({
        ...valid,
        learningObjectives: {
          ...bundle(),
          quizId: '10000000-0000-4000-8000-000000000098',
        },
      }).success,
    ).toBe(false);
  });

  it('does not silently change the established quiz-history proof material', () => {
    const legacy = { ...settings, questions: [question] };
    const identified = {
      ...settings,
      sourceQuizId: SOURCE_QUIZ_ID,
      learningObjectives: bundle(),
      questions: [{ ...question, sourceQuestionId: SOURCE_QUESTION_A_ID }],
    };
    expect(serializeQuizHistoryAccessMaterial(identified)).toBe(
      serializeQuizHistoryAccessMaterial(legacy),
    );
  });
});

describe('strict quiz export/import versions', () => {
  it('imports exact v1 and v2 payloads and exposes explicit version narrowing', () => {
    expect(QuizExportV1Schema.safeParse(exportV1()).success).toBe(true);
    expect(QuizExportV2Schema.safeParse(exportV2()).success).toBe(true);
    expect(QuizExportSchema.safeParse(exportV1()).success).toBe(true);
    expect(QuizExportSchema.safeParse(exportV2()).success).toBe(true);
    expect(QuizImportSchema.safeParse(exportV1()).success).toBe(true);
    expect(QuizImportSchema.safeParse(exportV2()).success).toBe(true);
  });

  it('rejects unknown future versions and v2 fields disguised as v1', () => {
    expect(
      QuizExportSchema.safeParse({ ...exportV2(), exportVersion: QUIZ_EXPORT_VERSION + 1 }).success,
    ).toBe(false);

    expect(
      QuizExportSchema.safeParse({
        ...exportV1(),
        quiz: {
          ...exportV1().quiz,
          sourceQuizId: SOURCE_QUIZ_ID,
          learningObjectives: bundle(),
        },
      }).success,
    ).toBe(false);
  });

  it('rejects missing, duplicate, foreign, and cross-quiz v2 identities', () => {
    const valid = exportV2();
    const { learningObjectives: _bundle, ...withoutBundleQuiz } = valid.quiz;
    expect(QuizExportSchema.safeParse({ ...valid, quiz: withoutBundleQuiz }).success).toBe(false);

    expect(
      QuizExportSchema.safeParse({
        ...valid,
        quiz: {
          ...valid.quiz,
          questions: [valid.quiz.questions[0], { ...valid.quiz.questions[0], order: 1 }],
        },
      }).success,
    ).toBe(false);

    expect(
      QuizExportSchema.safeParse({
        ...valid,
        quiz: { ...valid.quiz, learningObjectives: bundle([SOURCE_QUESTION_B_ID]) },
      }).success,
    ).toBe(false);

    expect(
      QuizExportSchema.safeParse({
        ...valid,
        quiz: {
          ...valid.quiz,
          learningObjectives: {
            ...valid.quiz.learningObjectives,
            quizId: '10000000-0000-4000-8000-000000000098',
          },
        },
      }).success,
    ).toBe(false);
  });

  it('preserves explicitly stale removed references in V2 backups but rejects them for live upload', () => {
    const staleExport = {
      ...exportV2(),
      quiz: {
        ...exportV2().quiz,
        learningObjectives: bundleWithRemovedSource(),
      },
    };
    expect(QuizExportV2Schema.safeParse(staleExport).success).toBe(true);
    expect(QuizImportSchema.safeParse(staleExport).success).toBe(true);

    expect(
      QuizUploadInputSchema.safeParse({
        ...settings,
        sourceQuizId: SOURCE_QUIZ_ID,
        learningObjectives: bundleWithRemovedSource(),
        questions: [{ ...question, sourceQuestionId: SOURCE_QUESTION_A_ID }],
      }).success,
    ).toBe(false);

    const falselyCurrent = bundleWithRemovedSource();
    falselyCurrent.objectives[0]!.confirmation = { state: 'draft' };
    const invalidExport = {
      ...staleExport,
      quiz: { ...staleExport.quiz, learningObjectives: falselyCurrent },
    };
    expect(QuizExportV2Schema.safeParse(invalidExport).success).toBe(false);
  });
});

describe('learning-objective attach contract', () => {
  it('accepts legacy omission or a complete new-client CAS tuple, never a partial tuple', () => {
    const legacy = { code: 'ABC123', quizId: SERVER_QUIZ_ID };
    expect(AttachQuizToSessionInputSchema.safeParse(legacy).success).toBe(true);
    expect(
      AttachQuizToSessionInputSchema.safeParse({
        ...legacy,
        expectedLearningContextRevision: 0,
        learningContextOperationId: OPERATION_ID,
      }).success,
    ).toBe(true);
    expect(
      AttachQuizToSessionInputSchema.safeParse({
        ...legacy,
        expectedLearningContextRevision: 0,
      }).success,
    ).toBe(false);
  });

  it('returns channels and the authoritative projection under the replay operation ID', () => {
    expect(
      AttachQuizToSessionOutputSchema.safeParse({
        learningContextOperationId: OPERATION_ID,
        quiz: { enabled: true },
        qa: { enabled: false, open: false, title: null, moderationMode: false },
        quickFeedback: { enabled: false, open: false },
        learningObjectives: {
          schemaVersion: 1,
          sessionId: SESSION_ID,
          learningContextRevision: 1,
          configured: true,
          access: { state: 'writable' },
          availableQuizTasks: [
            {
              kind: 'quiz-question',
              questionId: SERVER_QUESTION_ID,
              text: question.text,
              order: question.order,
            },
          ],
          objectives: [],
        },
      }).success,
    ).toBe(true);
  });
});
