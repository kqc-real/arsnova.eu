import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { rateLimitMocks, capabilityMocks, deriveLearningObjectiveDraftsMock, progressMocks } =
  vi.hoisted(() => ({
    rateLimitMocks: {
      prepare: vi.fn(),
      uploadAttempt: vi.fn(),
      uploadStorage: vi.fn(),
    },
    capabilityMocks: {
      issue: vi.fn(),
      reserve: vi.fn(),
      finalize: vi.fn(),
    },
    deriveLearningObjectiveDraftsMock: vi.fn(),
    progressMocks: {
      write: vi.fn(),
      read: vi.fn(),
    },
  }));

vi.mock('../db', () => ({ prisma: {} }));
vi.mock('@prisma/client', () => ({ Prisma: { DbNull: Symbol('DbNull') } }));
vi.mock('../lib/rateLimit', () => ({
  checkLearningObjectiveDerivationPrepareRate: rateLimitMocks.prepare,
  checkQuizUploadAttemptRate: rateLimitMocks.uploadAttempt,
  checkQuizUploadStorageRate: rateLimitMocks.uploadStorage,
}));
vi.mock('../lib/learningObjectiveDerivationCapability', () => ({
  issueLearningObjectiveDerivationCapability: capabilityMocks.issue,
  reserveLearningObjectiveDerivationCapability: capabilityMocks.reserve,
  finalizeLearningObjectiveDerivationCapability: capabilityMocks.finalize,
}));
vi.mock('../lib/learningObjectiveDerivation', () => ({
  deriveLearningObjectiveDrafts: deriveLearningObjectiveDraftsMock,
}));
vi.mock('../lib/learningObjectiveDerivationProgress', () => ({
  writeLearningObjectiveDerivationProgress: progressMocks.write,
  readLearningObjectiveDerivationProgress: progressMocks.read,
}));

import { quizRouter } from '../routers/quiz';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const QUIZ_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';
const CAPABILITY = 'a'.repeat(43);
const correlation = {
  schemaVersion: 1 as const,
  operationId: OPERATION_ID,
  quizId: QUIZ_ID,
  expectedBundleRevision: 4,
};
const runInput = {
  ...correlation,
  capability: CAPABILITY,
  locale: 'de' as const,
  maximumDrafts: 4,
  questions: [
    {
      sourceQuestionId: QUESTION_ID,
      enabled: true,
      text: 'Was ist 2 + 2?',
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'EASY' as const,
      order: 0,
      answers: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
    },
  ],
};

function createCaller(signal?: AbortSignal) {
  return quizRouter.createCaller(
    { req: { ip: '203.0.113.7' } as never },
    signal ? { signal } : undefined,
  );
}

describe('quiz learning-objective derivation capability boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMocks.prepare.mockResolvedValue({ allowed: true, remaining: 599 });
    capabilityMocks.issue.mockResolvedValue({
      ...correlation,
      capability: CAPABILITY,
      expiresAt: '2026-10-05T10:05:00.000Z',
    });
    capabilityMocks.reserve.mockResolvedValue(true);
    capabilityMocks.finalize.mockResolvedValue(undefined);
    deriveLearningObjectiveDraftsMock.mockResolvedValue({
      ...correlation,
      status: 'busy',
      retry: 'manual',
    });
    progressMocks.write.mockResolvedValue(undefined);
    progressMocks.read.mockResolvedValue(null);
  });

  trpcDodIt(
    {
      procedure: 'quiz.prepareLearningObjectiveDerivation',
      case: 'happy',
      mode: 'direct',
      title: 'issues a bound derivation bearer after the shared-NAT rate check',
    },
    async () => {
      const result = await createCaller().prepareLearningObjectiveDerivation(correlation);

      expect(rateLimitMocks.prepare).toHaveBeenCalledWith('203.0.113.7');
      expect(capabilityMocks.issue).toHaveBeenCalledWith(correlation);
      expect(deriveLearningObjectiveDraftsMock).not.toHaveBeenCalled();
      expect(result.capability).toBe(CAPABILITY);
    },
  );

  trpcDodIt(
    {
      procedure: 'quiz.prepareLearningObjectiveDerivation',
      case: 'error',
      mode: 'direct',
      contract: 'TOO_MANY_REQUESTS',
      title: 'rejects derivation preparation when its global budget is exhausted',
    },
    async () => {
      rateLimitMocks.prepare.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 41,
      });

      await expect(
        createCaller().prepareLearningObjectiveDerivation(correlation),
      ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
      expect(capabilityMocks.issue).not.toHaveBeenCalled();
      expect(deriveLearningObjectiveDraftsMock).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'quiz.deriveLearningObjectives',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'rejects missing or replayed derivation authorization before model work',
    },
    async () => {
      capabilityMocks.reserve.mockResolvedValue(false);

      await expect(createCaller().deriveLearningObjectives(runInput)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
      expect(deriveLearningObjectiveDraftsMock).not.toHaveBeenCalled();
      expect(capabilityMocks.finalize).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'quiz.deriveLearningObjectives',
      case: 'happy',
      mode: 'direct',
      title: 'returns an authorized busy result and finalizes the one-shot capability',
    },
    async () => {
      const controller = new AbortController();
      const result = await createCaller(controller.signal).deriveLearningObjectives(runInput);

      expect(capabilityMocks.reserve).toHaveBeenCalledWith(runInput);
      expect(deriveLearningObjectiveDraftsMock).toHaveBeenCalledWith(
        {
          ...correlation,
          locale: runInput.locale,
          maximumDrafts: runInput.maximumDrafts,
          questions: runInput.questions,
        },
        expect.objectContaining({
          signal: controller.signal,
          onProgress: expect.any(Function),
        }),
      );
      expect(deriveLearningObjectiveDraftsMock.mock.calls[0]?.[0]).not.toHaveProperty('capability');
      expect(result).toEqual({ ...correlation, status: 'busy', retry: 'manual' });
      expect(capabilityMocks.finalize).toHaveBeenCalledWith(CAPABILITY);
    },
  );

  it('finalizes the reserved bearer even when derivation fails', async () => {
    deriveLearningObjectiveDraftsMock.mockRejectedValue(new Error('runtime failed'));

    await expect(createCaller().deriveLearningObjectives(runInput)).rejects.toThrow(
      'runtime failed',
    );
    expect(capabilityMocks.finalize).toHaveBeenCalledWith(CAPABILITY);
  });

  it('preserves an authorized runtime result when best-effort Redis cleanup fails', async () => {
    capabilityMocks.finalize.mockRejectedValue(new Error('redis unavailable'));

    await expect(createCaller().deriveLearningObjectives(runInput)).resolves.toEqual({
      ...correlation,
      status: 'busy',
      retry: 'manual',
    });
    expect(capabilityMocks.finalize).toHaveBeenCalledWith(CAPABILITY);
  });

  it('stores derivation group progress for the bound operation', async () => {
    deriveLearningObjectiveDraftsMock.mockImplementation(async (_input, hooks) => {
      await hooks.onProgress({
        completedGroups: 1,
        totalGroups: 3,
        elapsedMs: 12_000,
        promptTokens: 240,
        completionTokens: 48,
        queuedObjectives: 2,
      });
      return { ...correlation, status: 'busy', retry: 'manual' };
    });

    await createCaller().deriveLearningObjectives(runInput);

    expect(progressMocks.write).toHaveBeenCalledWith({
      ...correlation,
      progress: {
        completedGroups: 1,
        totalGroups: 3,
        elapsedMs: 12_000,
        promptTokens: 240,
        completionTokens: 48,
        queuedObjectives: 2,
      },
    });
  });

  trpcDodIt(
    {
      procedure: 'quiz.getLearningObjectiveDerivationProgress',
      case: 'happy',
      mode: 'direct',
      title: 'returns matching derivation progress for the bound operation',
    },
    async () => {
      progressMocks.read.mockResolvedValue({
        completedGroups: 2,
        totalGroups: 4,
        elapsedMs: 30_000,
        promptTokens: 400,
        completionTokens: 80,
        queuedObjectives: 5,
      });

      await expect(
        createCaller().getLearningObjectiveDerivationProgress(correlation),
      ).resolves.toEqual({
        ...correlation,
        found: true,
        progress: {
          completedGroups: 2,
          totalGroups: 4,
          elapsedMs: 30_000,
          promptTokens: 400,
          completionTokens: 80,
          queuedObjectives: 5,
        },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'quiz.getLearningObjectiveDerivationProgress',
      case: 'error',
      mode: 'direct',
      contract: 'VALIDATION',
      title: 'rejects derivation progress without a bound operation key',
    },
    async () => {
      await expect(
        createCaller().getLearningObjectiveDerivationProgress({
          ...correlation,
          operationId: 'not-a-uuid',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(progressMocks.read).not.toHaveBeenCalled();
    },
  );

  it('hides derivation progress for a foreign or missing binding', async () => {
    progressMocks.read.mockResolvedValue(null);

    await expect(
      createCaller().getLearningObjectiveDerivationProgress(correlation),
    ).resolves.toEqual({
      ...correlation,
      found: false,
      progress: null,
    });
  });
});
