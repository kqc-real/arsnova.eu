import { Prisma } from '@prisma/client';
import {
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  MODERATION_ANALYSIS_SOURCE_LIMIT,
  ModerationAnalysisContextV1Schema,
  type SessionLearningObjectivesSnapshot,
} from '@arsnova/shared-types';
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AuthorizedModerationQaContext,
  AuthorizedModerationState,
} from './moderationQaContext';
import type { AuthorizedModerationTeachingSignals } from './moderationTeachingSignals';

const {
  buildQaMock,
  buildTeachingMock,
  loadLearningMock,
  loadStateMock,
  prismaMock,
  qaTaskFindManyMock,
  txMock,
} = vi.hoisted(() => {
  const qaTaskFindManyMock = vi.fn();
  return {
    buildQaMock: vi.fn(),
    buildTeachingMock: vi.fn(),
    loadLearningMock: vi.fn(),
    loadStateMock: vi.fn(),
    prismaMock: { $transaction: vi.fn() },
    qaTaskFindManyMock,
    txMock: { qaQuestion: { findMany: qaTaskFindManyMock } },
  };
});

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('./moderationQaContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./moderationQaContext')>();
  return {
    ...actual,
    buildAuthorizedModerationQaContext: buildQaMock,
    loadAuthorizedModerationState: loadStateMock,
  };
});
vi.mock('./moderationTeachingSignals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./moderationTeachingSignals')>();
  return { ...actual, buildAuthorizedModerationTeachingSignals: buildTeachingMock };
});
vi.mock('./sessionLearningObjectives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sessionLearningObjectives')>();
  return { ...actual, getSessionLearningObjectivesSnapshotWithDb: loadLearningMock };
});

import {
  MODERATION_ANALYSIS_SELECTION_VERSION,
  MODERATION_ANALYSIS_VERSION,
  MODERATION_SOURCE_REVISION_VERSION,
  buildModerationPromptContext,
  moderationPromptContextInternals,
} from './moderationPromptContext';

const SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const QUIZ_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const QUIZ_QUESTION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OBJECTIVE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const DERIVED_OBJECTIVE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const MISSING_QA_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const DELETED_QA_ID = '15151515-1515-4515-8515-151515151515';
const OUTSIDE_CANDIDATE_QA_ID = '17171717-1717-4717-8717-171717171717';
const QA_SOURCE_ID =
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1.context.questions.items[0]!.sourceId;
const QA_QUESTION_ID = QA_SOURCE_ID.slice('qa-question:'.length);
const REFERENCE_CONTEXT = MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1.context;
const QUESTION_OPENED_AT = '2026-10-05T09:40:00.000Z';
const QUESTION_COMPLETED_AT = '2026-10-05T09:45:00.000Z';

function state(overrides: Partial<AuthorizedModerationState> = {}): AuthorizedModerationState {
  return {
    id: SESSION_ID,
    code: 'ABC123',
    type: 'QUIZ',
    status: 'ACTIVE',
    currentQuestion: 0,
    currentRound: 1,
    questionProgress: {
      [QUIZ_QUESTION_ID]: {
        state: 'COMPLETED',
        openedAt: QUESTION_OPENED_AT,
        completedAt: QUESTION_COMPLETED_AT,
      },
    },
    questionProgressComplete: true,
    quizId: QUIZ_ID,
    endedAt: null,
    expiresAt: new Date('2026-10-06T10:00:00.000Z'),
    qaEnabled: true,
    qaOpen: true,
    qaClosesAt: null,
    quickFeedbackEnabled: false,
    quickFeedbackOpen: false,
    participantCount: 200,
    sessionLifecycleRevision: 3,
    qaRankingRevision: 5,
    participantRevision: 7,
    learningContextRevision: 11,
    learningContextConfigured: true,
    activeSortMode: 'TOP',
    authorizedAt: new Date('2026-10-05T10:00:00.000Z'),
    ...overrides,
  };
}

function qaContext(overrides: Partial<AuthorizedModerationQaContext> = {}) {
  const sources = REFERENCE_CONTEXT.sources.filter(
    (source) => source.kind === 'qa-question' || source.kind === 'semantic-topic',
  );
  return {
    state: state(),
    questions: REFERENCE_CONTEXT.questions,
    topics: REFERENCE_CONTEXT.topics,
    sources,
    limitations: [],
    revisions: {
      questionText: { state: 'available', value: 'question-text-v1' },
      questionVotes: { state: 'available', value: 'question-votes-v1' },
      questionStatus: { state: 'available', value: 'question-status-v1' },
      questionAnswerState: { state: 'available', value: 'question-answer-state-v1' },
      questionNlp: { state: 'available', value: 'question-nlp-v1' },
      topics: { state: 'available', value: 'questions-r1' },
    },
    ...overrides,
  } satisfies AuthorizedModerationQaContext;
}

function teachingSignals(overrides: Partial<AuthorizedModerationTeachingSignals> = {}) {
  const sources = REFERENCE_CONTEXT.sources.filter((source) => source.kind === 'compass-signal');
  return {
    state: state(),
    releasedResults: REFERENCE_CONTEXT.releasedResults,
    feedback: REFERENCE_CONTEXT.feedback,
    compass: REFERENCE_CONTEXT.compass,
    sources,
    limitations: [],
    revisions: {
      releasedResults: { state: 'available', value: 'released-results-v1' },
      feedback: { state: 'unavailable', reason: 'no-data' },
    },
    ...overrides,
  } satisfies AuthorizedModerationTeachingSignals;
}

function learningSnapshot(
  overrides: Partial<SessionLearningObjectivesSnapshot> = {},
): SessionLearningObjectivesSnapshot {
  return {
    schemaVersion: 1,
    sessionId: SESSION_ID,
    learningContextRevision: 11,
    configured: true,
    access: { state: 'writable' },
    availableQuizTasks: [
      {
        kind: 'quiz-question',
        questionId: QUIZ_QUESTION_ID,
        text: 'Welche Eigenschaft beschreibt lineare Regression?',
        order: 0,
      },
    ],
    availableQaTasks: [
      {
        kind: 'qa-question',
        questionId: QA_QUESTION_ID,
        text: 'Können wir mehr Beispiele zur linearen Regression bearbeiten?',
      },
    ],
    availableQaTasksTruncated: false,
    objectives: [
      {
        id: OBJECTIVE_ID,
        revision: 2,
        text: 'Die Studierenden können Regression auf ein Beispiel anwenden.',
        scope: {
          kind: 'question-set',
          taskReferences: [
            { kind: 'qa-question', questionId: QA_QUESTION_ID },
            { kind: 'quiz-question', questionId: QUIZ_QUESTION_ID },
          ],
        },
        origin: { kind: 'manual' },
        confirmation: {
          state: 'confirmed',
          confirmedAt: '2026-10-05T09:30:00.000Z',
          confirmedRevision: 2,
        },
        projection: 'session-manual',
        purpose: 'learning-objective',
        createdAt: '2026-10-05T09:00:00.000Z',
        updatedAt: '2026-10-05T09:30:00.000Z',
      },
      {
        id: DERIVED_OBJECTIVE_ID,
        revision: 1,
        text: 'Die Studierenden können die Modellannahmen benennen.',
        scope: {
          kind: 'question-set',
          taskReferences: [{ kind: 'quiz-question', questionId: QUIZ_QUESTION_ID }],
        },
        origin: {
          kind: 'model-derived',
          modelId: 'private-model',
          modelVersion: '1',
          derivationVersion: 'learning-objective-derivation-v1',
          derivedFrom: [{ kind: 'quiz-question', questionId: QUIZ_QUESTION_ID }],
        },
        confirmation: { state: 'draft' },
        projection: 'quiz-projected',
        purpose: 'learning-objective',
        createdAt: '2026-10-05T09:00:00.000Z',
        updatedAt: '2026-10-05T09:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function sequencedUuid(sequence: number): string {
  return `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`;
}

function highCardinalityQaContext(): AuthorizedModerationQaContext {
  const base = qaContext();
  if (base.questions.state !== 'available' || base.topics.state !== 'available') {
    throw new Error('Reference context must expose Q&A questions and topics.');
  }
  const includedSources = base.sources.filter((source) => source.kind === 'qa-question');
  const topicSources = base.sources.filter((source) => source.kind === 'semantic-topic');
  const extraSources = Array.from({ length: 491 }, (_, index) => ({
    id: `qa-question:${sequencedUuid(index + 1)}`,
    kind: 'qa-question' as const,
    content: { state: 'reference-only' as const, reason: 'not-selected' as const },
  }));
  const includedSourceIds = includedSources.map((source) => source.id);
  const extraSourceIds = extraSources.map((source) => source.id);
  const allQuestionSourceIds = [...includedSourceIds, ...extraSourceIds];
  const memberships = [
    [...includedSourceIds.slice(0, 2), ...extraSourceIds.slice(0, 198)],
    [...includedSourceIds.slice(2, 4), ...extraSourceIds.slice(198, 396)],
    [...includedSourceIds.slice(4, 6), ...extraSourceIds.slice(396)],
  ];
  const topics = base.topics.items.map((topic, index) => ({
    ...topic,
    aggregates: {
      ...topic.aggregates,
      questionCount: memberships[index]!.length,
      positiveVotes: 0,
      negativeVotes: 0,
      netVotes: 0,
      totalVotes: 0,
    },
    memberQuestionSourceIds: memberships[index]!,
  }));
  return {
    ...base,
    questions: {
      ...base.questions,
      corpus: {
        total: allQuestionSourceIds.length,
        eligible: allQuestionSourceIds.length,
        analyzed: allQuestionSourceIds.length,
        deduplicated: allQuestionSourceIds.length,
        represented: base.questions.items.length,
      },
    },
    topics: {
      ...base.topics,
      corpus: {
        eligibleQuestions: allQuestionSourceIds.length,
        analyzedQuestions: allQuestionSourceIds.length,
        representedQuestions: base.questions.items.length,
      },
      items: topics,
    },
    sources: [...includedSources, ...extraSources, ...topicSources],
  };
}

function highCardinalityLearningSnapshot(): SessionLearningObjectivesSnapshot {
  const taskIds = Array.from({ length: 100 }, (_, index) => sequencedUuid(index + 1_000));
  return learningSnapshot({
    availableQuizTasks: taskIds.map((questionId, index) => ({
      kind: 'quiz-question',
      questionId,
      text: `Quiz task ${index + 1}`,
      order: index,
    })),
    objectives: taskIds.map((questionId, index) => ({
      id: sequencedUuid(index + 2_000),
      revision: 1,
      text: `Learning objective ${index + 1}`,
      scope: {
        kind: 'question-set',
        taskReferences: [{ kind: 'quiz-question', questionId }],
      },
      origin: { kind: 'manual' },
      confirmation: { state: 'draft' },
      projection: 'quiz-projected',
      purpose: 'learning-objective',
      createdAt: '2026-10-05T09:00:00.000Z',
      updatedAt: '2026-10-05T09:00:00.000Z',
    })),
  });
}

describe('buildModerationPromptContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadStateMock.mockResolvedValue(state());
    buildQaMock.mockResolvedValue(qaContext());
    buildTeachingMock.mockResolvedValue(teachingSignals());
    loadLearningMock.mockResolvedValue(learningSnapshot());
    qaTaskFindManyMock.mockResolvedValue([
      {
        id: QA_QUESTION_ID,
      },
    ]);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) =>
      callback(txMock),
    );
  });

  it('does not treat persisted forum assignments as moderation learning objectives', async () => {
    const assignmentId = '15151515-1515-4515-8515-151515151515';
    loadLearningMock.mockResolvedValue(
      learningSnapshot({
        objectives: [
          ...learningSnapshot().objectives,
          {
            ...learningSnapshot().objectives[0]!,
            id: assignmentId,
            text: 'Sammelt zentrale Fragen zum Fallbeispiel.',
            scope: { kind: 'session' },
            origin: { kind: 'manual' },
            projection: 'session-manual',
            purpose: 'forum-assignment',
            confirmation: {
              state: 'confirmed',
              confirmedAt: '2026-10-05T09:30:00.000Z',
              confirmedRevision: 2,
            },
          },
        ],
      }),
    );

    const result = await buildModerationPromptContext({
      sessionId: SESSION_ID,
      locale: 'de',
      access: { hostToken: 'host-token' },
    });

    expect(result.context.learningContext).toMatchObject({
      state: 'available',
      objectives: expect.arrayContaining([
        expect.objectContaining({ sourceId: `learning-objective:${OBJECTIVE_ID}` }),
      ]),
    });
    expect(JSON.stringify(result.context.learningContext)).not.toContain(assignmentId);
    expect(JSON.stringify(result.context.sources)).not.toContain(
      `learning-objective:${assignmentId}`,
    );
  });

  it.each([null, 'OPENED', 'SKIPPED'] as const)(
    'withholds model-derived objective text for a quiz question with progress %s',
    async (progress) => {
      const sessionState = state({
        questionProgress: progress
          ? {
              [QUIZ_QUESTION_ID]: {
                state: progress,
                openedAt: QUESTION_OPENED_AT,
                ...(progress === 'SKIPPED' ? { skippedAt: QUESTION_COMPLETED_AT } : {}),
              },
            }
          : null,
      });
      loadStateMock.mockResolvedValue(sessionState);
      buildQaMock.mockResolvedValue(qaContext({ state: sessionState }));
      buildTeachingMock.mockResolvedValue(teachingSignals({ state: sessionState }));
      const snapshot = learningSnapshot();
      const solutionText = 'Die richtige Antwort lautet 42.';
      loadLearningMock.mockResolvedValue({
        ...snapshot,
        objectives: snapshot.objectives.map((objective) =>
          objective.id === DERIVED_OBJECTIVE_ID ? { ...objective, text: solutionText } : objective,
        ),
      });

      const result = await buildModerationPromptContext({
        sessionId: SESSION_ID,
        locale: 'de',
        access: { hostToken: 'host-token' },
      });

      expect(result.context.learningContext).toEqual({
        state: 'available',
        objectives: [expect.objectContaining({ sourceId: `learning-objective:${OBJECTIVE_ID}` })],
      });
      expect(result.context.limitations).toContainEqual(
        expect.objectContaining({ code: 'not-released', section: 'learning-context' }),
      );
      expect(JSON.stringify(result.context)).not.toContain(solutionText);
      expect(JSON.stringify(result.context)).not.toContain(DERIVED_OBJECTIVE_ID);
    },
  );

  it('assembles and validates the complete authorized, solution-free analysis graph', async () => {
    const result = await buildModerationPromptContext({
      sessionId: SESSION_ID,
      locale: 'fr',
      access: { hostToken: 'host-token' },
    });

    expect(ModerationAnalysisContextV1Schema.safeParse(result).success).toBe(true);
    expect(result.context.locale).toBe('fr');
    expect(result.context.questions).toEqual(REFERENCE_CONTEXT.questions);
    expect(result.context.topics).toEqual(REFERENCE_CONTEXT.topics);
    expect(result.context.compass).toEqual(REFERENCE_CONTEXT.compass);
    expect(result.context.learningContext).toMatchObject({
      state: 'available',
      objectives: expect.arrayContaining([
        expect.objectContaining({ sourceId: `learning-objective:${OBJECTIVE_ID}` }),
        expect.objectContaining({ sourceId: `learning-objective:${DERIVED_OBJECTIVE_ID}` }),
      ]),
    });
    expect(result.context.sources).toEqual(
      [...result.context.sources].sort((left, right) =>
        left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
      ),
    );
    expect(result.context.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: QA_SOURCE_ID, kind: 'qa-question' }),
        expect.objectContaining({
          id: `quiz-question:${QUIZ_QUESTION_ID}`,
          kind: 'quiz-question',
        }),
      ]),
    );
    expect(result.context.meta).toMatchObject({
      analysisVersion: MODERATION_ANALYSIS_VERSION,
      selectionVersion: MODERATION_ANALYSIS_SELECTION_VERSION,
      sourceRevision: expect.stringMatching(
        new RegExp(`^${MODERATION_SOURCE_REVISION_VERSION}:[a-f0-9]{64}$`),
      ),
    });
    expect(JSON.stringify(result)).not.toMatch(
      /isCorrect|sourceDigest|numericReferenceValue|matchingPairs|orderingItems|categorizationItems/,
    );
    expect(buildTeachingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        qaContext: expect.objectContaining({ questions: qaContext().questions }),
      }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  it('authorizes before the first read and again after the learning snapshot read', async () => {
    const events: string[] = [];
    loadStateMock.mockImplementation(async () => {
      events.push(`auth-${loadStateMock.mock.calls.length}`);
      return state();
    });
    buildQaMock.mockImplementation(async () => {
      events.push('qa');
      return qaContext();
    });
    buildTeachingMock.mockImplementation(async () => {
      events.push('teaching');
      return teachingSignals();
    });
    loadLearningMock.mockImplementation(async () => {
      events.push('learning');
      return learningSnapshot();
    });

    await buildModerationPromptContext({
      sessionId: SESSION_ID,
      locale: 'de',
      access: { hostToken: 'host-token' },
    });

    expect(events[0]).toBe('auth-1');
    expect(events.indexOf('auth-2')).toBeLessThan(events.indexOf('learning'));
    expect(events.indexOf('auth-3')).toBeGreaterThan(events.indexOf('learning'));
  });

  it('omits unresolved, deleted, archived, and inappropriate task references with a limitation', async () => {
    const validSessionObjective = learningSnapshot().objectives[0]!;
    const archivedReferenceObjective = {
      ...validSessionObjective,
      id: '12121212-1212-4212-8212-121212121212',
      scope: {
        kind: 'question-set' as const,
        taskReferences: [{ kind: 'qa-question' as const, questionId: MISSING_QA_ID }],
      },
      confirmation: { state: 'draft' as const },
    };
    const unresolvedReferenceObjective = {
      ...validSessionObjective,
      id: '13131313-1313-4313-8313-131313131313',
      scope: {
        kind: 'question-set' as const,
        taskReferences: [
          {
            kind: 'unresolved-task' as const,
            sourceReferenceId: MISSING_QA_ID,
            sourceKind: 'qa-question' as const,
            reason: 'source-removed' as const,
          },
        ],
      },
      confirmation: {
        state: 'needs-review' as const,
        previousConfirmation: { state: 'draft' as const, revision: 1 },
        currentRevision: 2,
        reason: 'source-reference-removed' as const,
      },
    };
    const deletedReferenceObjective = {
      ...validSessionObjective,
      id: '16161616-1616-4616-8616-161616161616',
      scope: {
        kind: 'question-set' as const,
        taskReferences: [{ kind: 'qa-question' as const, questionId: DELETED_QA_ID }],
      },
      confirmation: { state: 'draft' as const },
    };
    const inappropriateDerivedObjective = {
      ...validSessionObjective,
      id: '14141414-1414-4414-8414-141414141414',
      scope: {
        kind: 'question-set' as const,
        taskReferences: [{ kind: 'qa-question' as const, questionId: QA_QUESTION_ID }],
      },
      origin: {
        kind: 'model-derived' as const,
        modelId: 'private-model',
        modelVersion: '1',
        derivationVersion: 'learning-objective-derivation-v1',
        derivedFrom: [{ kind: 'quiz-question' as const, questionId: QUIZ_QUESTION_ID }],
      },
      confirmation: { state: 'draft' as const },
    };
    loadLearningMock.mockResolvedValue(
      learningSnapshot({
        availableQaTasks: [
          ...learningSnapshot().availableQaTasks,
          { kind: 'qa-question', questionId: MISSING_QA_ID, text: 'Archivierte Frage' },
        ],
        objectives: [
          { ...validSessionObjective, scope: { kind: 'session' }, origin: { kind: 'manual' } },
          archivedReferenceObjective,
          unresolvedReferenceObjective,
          deletedReferenceObjective,
          inappropriateDerivedObjective,
        ] as SessionLearningObjectivesSnapshot['objectives'],
      }),
    );

    const result = await buildModerationPromptContext({
      sessionId: SESSION_ID,
      locale: 'de',
      access: { hostToken: 'host-token' },
    });

    expect(result.context.learningContext).toEqual({
      state: 'available',
      objectives: [expect.objectContaining({ sourceId: `learning-objective:${OBJECTIVE_ID}` })],
    });
    expect(result.context.limitations).toContainEqual(
      expect.objectContaining({
        code: 'source-redacted',
        section: 'learning-context',
        detail: expect.stringContaining('4 learning objective(s)'),
      }),
    );
    expect(JSON.stringify(result)).not.toContain(MISSING_QA_ID);
    expect(JSON.stringify(result)).not.toContain(DELETED_QA_ID);
  });

  it('keeps an authorized learning-objective Q&A source outside the ranked candidate window', async () => {
    const objective = learningSnapshot().objectives[0]!;
    const outsideText =
      'Wie hängt der Regressionskoeffizient mit den Auswertungen in arsnova.eu zusammen?';
    loadLearningMock.mockResolvedValue(
      learningSnapshot({
        availableQaTasks: [
          ...learningSnapshot().availableQaTasks,
          {
            kind: 'qa-question',
            questionId: OUTSIDE_CANDIDATE_QA_ID,
            text: outsideText,
          },
        ],
        objectives: [
          {
            ...objective,
            scope: {
              kind: 'question-set',
              taskReferences: [{ kind: 'qa-question', questionId: OUTSIDE_CANDIDATE_QA_ID }],
            },
          },
        ],
      }),
    );
    qaTaskFindManyMock.mockResolvedValue([{ id: OUTSIDE_CANDIDATE_QA_ID }]);

    const result = await buildModerationPromptContext({
      sessionId: SESSION_ID,
      locale: 'de',
      access: { hostToken: 'host-token' },
    });

    expect(result.context.learningContext).toEqual({
      state: 'available',
      objectives: [expect.objectContaining({ sourceId: `learning-objective:${OBJECTIVE_ID}` })],
    });
    expect(result.context.sources).toContainEqual(
      expect.objectContaining({
        id: `qa-question:${OUTSIDE_CANDIDATE_QA_ID}`,
        kind: 'qa-question',
        content: { state: 'reference-only', reason: 'not-selected' },
      }),
    );
    expect(qaTaskFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PENDING', 'ACTIVE', 'PINNED'] },
        }),
      }),
    );
  });

  it('reuses an authorized reference-only Q&A source without treating it as a duplicate', async () => {
    const objective = learningSnapshot().objectives[0]!;
    const referenceOnlySource = {
      id: `qa-question:${OUTSIDE_CANDIDATE_QA_ID}`,
      kind: 'qa-question' as const,
      content: { state: 'reference-only' as const, reason: 'not-selected' as const },
    };
    buildQaMock.mockResolvedValue(
      qaContext({ sources: [...qaContext().sources, referenceOnlySource] }),
    );
    loadLearningMock.mockResolvedValue(
      learningSnapshot({
        objectives: [
          {
            ...objective,
            scope: {
              kind: 'question-set',
              taskReferences: [{ kind: 'qa-question', questionId: OUTSIDE_CANDIDATE_QA_ID }],
            },
          },
        ],
      }),
    );
    qaTaskFindManyMock.mockResolvedValue([{ id: OUTSIDE_CANDIDATE_QA_ID }]);

    const result = await buildModerationPromptContext({
      sessionId: SESSION_ID,
      locale: 'de',
      access: { hostToken: 'host-token' },
    });

    expect(result.context.sources.filter(({ id }) => id === referenceOnlySource.id)).toEqual([
      referenceOnlySource,
    ]);
    expect(result.context.learningContext).toEqual({
      state: 'available',
      objectives: [expect.objectContaining({ sourceId: `learning-objective:${OBJECTIVE_ID}` })],
    });
  });

  it('fails closed when independently authorized fragments contain a duplicate source ID', async () => {
    const duplicate = qaContext().sources[0]!;
    buildTeachingMock.mockResolvedValue(teachingSignals({ sources: [duplicate] }));

    await expect(
      buildModerationPromptContext({
        sessionId: SESSION_ID,
        locale: 'de',
        access: { hostToken: 'host-token' },
      }),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it('rejects revision drift and host revocation after all content reads', async () => {
    loadStateMock
      .mockResolvedValueOnce(state())
      .mockResolvedValueOnce(state())
      .mockResolvedValueOnce(state({ learningContextRevision: 12 }));

    await expect(
      buildModerationPromptContext({
        sessionId: SESSION_ID,
        locale: 'de',
        access: { hostToken: 'host-token' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(loadLearningMock).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    buildQaMock.mockResolvedValue(qaContext());
    buildTeachingMock.mockResolvedValue(teachingSignals());
    loadLearningMock.mockResolvedValue(learningSnapshot());
    qaTaskFindManyMock.mockResolvedValue([
      {
        id: QA_QUESTION_ID,
      },
    ]);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) =>
      callback(txMock),
    );
    loadStateMock
      .mockResolvedValueOnce(state())
      .mockResolvedValueOnce(state())
      .mockRejectedValueOnce(new TRPCError({ code: 'UNAUTHORIZED' }));

    await expect(
      buildModerationPromptContext({
        sessionId: SESSION_ID,
        locale: 'de',
        access: { hostToken: 'host-token' },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(loadLearningMock).toHaveBeenCalledOnce();
  });

  it('keeps source order and the source revision stable across input ordering', async () => {
    const qa = qaContext();
    const teaching = teachingSignals();
    const snapshot = learningSnapshot();
    buildQaMock
      .mockResolvedValueOnce(qa)
      .mockResolvedValueOnce({ ...qa, sources: [...qa.sources].reverse() });
    buildTeachingMock
      .mockResolvedValueOnce(teaching)
      .mockResolvedValueOnce({ ...teaching, sources: [...teaching.sources].reverse() });
    loadLearningMock
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({ ...snapshot, objectives: [...snapshot.objectives].reverse() });

    const first = await buildModerationPromptContext({
      sessionId: SESSION_ID,
      locale: 'it',
      access: { hostToken: 'host-token' },
    });
    const second = await buildModerationPromptContext({
      sessionId: SESSION_ID,
      locale: 'it',
      access: { hostToken: 'host-token' },
    });

    expect(second.context.sources).toEqual(first.context.sources);
    expect(second.context.learningContext).toEqual(first.context.learningContext);
    expect(second.context.meta.sourceRevision).toBe(first.context.meta.sourceRevision);
  });

  it('keeps the complete bounded candidate graph for later prompt packing', async () => {
    buildQaMock.mockResolvedValue(highCardinalityQaContext());
    buildTeachingMock.mockResolvedValue(
      teachingSignals({
        compass: {
          ...REFERENCE_CONTEXT.compass,
          signals: [],
          primarySignalSourceId: null,
        },
        sources: [],
      }),
    );
    loadLearningMock.mockResolvedValue(highCardinalityLearningSnapshot());

    const result = await buildModerationPromptContext({
      sessionId: SESSION_ID,
      locale: 'de',
      access: { hostToken: 'host-token' },
    });

    expect(ModerationAnalysisContextV1Schema.safeParse(result).success).toBe(true);
    expect(result.context.sources).toHaveLength(700);
    expect(result.context.sources.length).toBeLessThanOrEqual(MODERATION_ANALYSIS_SOURCE_LIMIT);
    expect(result.context.topics).toMatchObject({ state: 'available', items: { length: 3 } });
    expect(result.context.learningContext).toMatchObject({
      state: 'available',
      objectives: expect.arrayContaining([
        expect.objectContaining({ sourceId: `learning-objective:${sequencedUuid(2_000)}` }),
      ]),
    });
    expect(result.context.limitations).not.toContainEqual(
      expect.objectContaining({ code: 'budget-truncated', section: 'topics' }),
    );
  });

  it('prioritizes confirmed learning-objective Q&A bundles before applying the authorization cap', async () => {
    const base = learningSnapshot().objectives[0]!;
    const firstDraftQaIds = Array.from({ length: 100 }, (_, index) =>
      sequencedUuid(20_000 + index),
    );
    const secondDraftQaIds = Array.from({ length: 100 }, (_, index) =>
      sequencedUuid(21_000 + index),
    );
    const confirmedQaId = sequencedUuid(22_000);
    const firstDraftId = sequencedUuid(3_000);
    const secondDraftId = sequencedUuid(3_001);
    const confirmedId = sequencedUuid(3_999);
    const objective = (
      id: string,
      questionIds: readonly string[],
      confirmation: (typeof base)['confirmation'],
    ) => ({
      ...base,
      id,
      scope: {
        kind: 'question-set' as const,
        taskReferences: questionIds.map((questionId) => ({
          kind: 'qa-question' as const,
          questionId,
        })),
      },
      origin: { kind: 'manual' as const },
      confirmation,
    });
    loadLearningMock.mockResolvedValue(
      learningSnapshot({
        objectives: [
          objective(firstDraftId, firstDraftQaIds, { state: 'draft' }),
          objective(secondDraftId, secondDraftQaIds, { state: 'draft' }),
          objective(confirmedId, [confirmedQaId], {
            state: 'confirmed',
            confirmedAt: '2026-10-05T09:30:00.000Z',
            confirmedRevision: 2,
          }),
        ],
      }),
    );
    qaTaskFindManyMock.mockResolvedValue(
      [confirmedQaId, ...firstDraftQaIds].sort().map((id) => ({ id })),
    );

    const result = await buildModerationPromptContext({
      sessionId: SESSION_ID,
      locale: 'de',
      access: { hostToken: 'host-token' },
    });

    expect(qaTaskFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: expect.arrayContaining([confirmedQaId, ...firstDraftQaIds]),
          },
        }),
      }),
    );
    const queriedIds = qaTaskFindManyMock.mock.calls[0]![0].where.id.in as string[];
    expect(queriedIds).toHaveLength(101);
    expect(queriedIds).not.toContain(secondDraftQaIds[0]);
    expect(result.context.learningContext).toMatchObject({
      state: 'available',
      objectives: expect.arrayContaining([
        expect.objectContaining({ sourceId: `learning-objective:${confirmedId}` }),
        expect.objectContaining({ sourceId: `learning-objective:${firstDraftId}` }),
      ]),
    });
    expect(result.context.learningContext).not.toMatchObject({
      objectives: expect.arrayContaining([
        expect.objectContaining({ sourceId: `learning-objective:${secondDraftId}` }),
      ]),
    });
    expect(result.context.limitations).toContainEqual(
      expect.objectContaining({ code: 'budget-truncated', section: 'learning-context' }),
    );
    expect(result.context.limitations).not.toContainEqual(
      expect.objectContaining({ code: 'source-redacted', section: 'learning-context' }),
    );
  });

  it('bounds learning-objective Q&A authorization reads by whole deterministic bundles', () => {
    const base = learningSnapshot().objectives[0]!;
    const objectives = Array.from({ length: 100 }, (_, objectiveIndex) => ({
      ...base,
      id: sequencedUuid(3_000 + objectiveIndex),
      scope: {
        kind: 'question-set' as const,
        taskReferences: Array.from({ length: 100 }, (_, referenceIndex) => ({
          kind: 'qa-question' as const,
          questionId: sequencedUuid(10_000 + objectiveIndex * 100 + referenceIndex),
        })),
      },
    }));

    const selected = moderationPromptContextInternals.selectReferencedQaQuestions(
      learningSnapshot({ objectives }),
    );

    expect(selected.questionIds).toHaveLength(200);
    expect(selected.questionIds).toEqual([...selected.questionIds].sort());
    expect(selected.questionIds).toContain(sequencedUuid(10_000));
    expect(selected.questionIds).toContain(sequencedUuid(10_199));
    expect(selected.questionIds).not.toContain(sequencedUuid(10_200));
    expect(selected.omittedObjectiveIds).toHaveLength(98);
  });
});
