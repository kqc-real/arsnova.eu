import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, checkQuizUploadAttemptRateMock, checkQuizUploadStorageRateMock } = vi.hoisted(
  () => ({
    prismaMock: {
      quiz: {
        create: vi.fn(),
      },
      quizLearningObjectiveBundle: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    checkQuizUploadAttemptRateMock: vi.fn(),
    checkQuizUploadStorageRateMock: vi.fn(),
  }),
);

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkQuizUploadAttemptRate: checkQuizUploadAttemptRateMock,
  checkQuizUploadStorageRate: checkQuizUploadStorageRateMock,
}));

import { quizRouter } from '../routers/quiz';

const caller = quizRouter.createCaller({});
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_QUIZ_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_QUESTION_ID = '33333333-3333-4333-8333-333333333333';
const OBJECTIVE_ID = '44444444-4444-4444-8444-444444444444';

describe('quiz.upload (Story 2.1a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quiz.create.mockResolvedValue({ id: QUIZ_ID });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    checkQuizUploadAttemptRateMock.mockResolvedValue({ allowed: true, remaining: 1199 });
    checkQuizUploadStorageRateMock.mockResolvedValue({ allowed: true, remaining: 299 });
  });

  trpcDodIt(
    {
      procedure: 'quiz.upload',
      case: 'happy',
      mode: 'direct',
      title: 'erstellt Quiz mit Fragen und Antworten und liefert quizId',
    },
    async () => {
      const input = {
        name: 'Test-Quiz',
        showLeaderboard: true,
        allowCustomNicknames: true,
        enableSoundEffects: true,
        enableRewardEffects: true,
        enableMotivationMessages: true,
        enableEmojiReactions: true,
        anonymousMode: false,
        teamMode: false,
        teamNames: [],
        nicknameTheme: 'NOBEL_LAUREATES' as const,
        questions: [
          {
            text: 'Was ist 2+2?',
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

      const result = await caller.upload(input);

      expect(result.quizId).toBe(QUIZ_ID);
      expect(checkQuizUploadAttemptRateMock).toHaveBeenCalledWith('0.0.0.0');
      expect(checkQuizUploadStorageRateMock).toHaveBeenCalledWith('0.0.0.0', {
        payloadBytes: expect.any(Number),
        complexity: 4,
      });
      expect(prismaMock.quiz.create).toHaveBeenCalledTimes(1);
      const createCall = prismaMock.quiz.create.mock.calls[0]![0];
      expect(createCall.data.name).toBe('Test-Quiz');
      expect(createCall.data.questions.create).toHaveLength(1);
      expect(createCall.data.questions.create[0].text).toBe('Was ist 2+2?');
      expect(createCall.data.questions.create[0].answers.create).toHaveLength(2);
      expect(createCall.data.questions.create[0].answers.create[1]).toEqual({
        text: '4',
        isCorrect: true,
      });
      expect(createCall.data.motifImageUrl).toBeNull();
      expect(createCall.data.timerScaleByDifficulty).toBe(true);
    },
  );

  it('stages source identities and objective references atomically with the quiz upload', async () => {
    await caller.upload({
      name: 'Quiz mit Lernzielen',
      showLeaderboard: true,
      allowCustomNicknames: false,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      nicknameTheme: 'HIGH_SCHOOL',
      sourceQuizId: SOURCE_QUIZ_ID,
      questions: [
        {
          sourceQuestionId: SOURCE_QUESTION_ID,
          text: 'Was ist eine Steigung?',
          type: 'SINGLE_CHOICE',
          difficulty: 'MEDIUM',
          order: 0,
          answers: [
            { text: 'Eine Änderungsrate', isCorrect: true },
            { text: 'Ein Achsenabschnitt', isCorrect: false },
          ],
        },
      ],
      learningObjectives: {
        schemaVersion: 1,
        quizId: SOURCE_QUIZ_ID,
        revision: 0,
        objectives: [
          {
            id: OBJECTIVE_ID,
            revision: 0,
            text: 'Steigungen interpretieren',
            scope: { kind: 'question-set', sourceQuestionIds: [SOURCE_QUESTION_ID] },
            origin: { kind: 'manual' },
            confirmation: { state: 'draft' },
            createdAt: '2026-10-04T08:00:00.000Z',
            updatedAt: '2026-10-04T08:00:00.000Z',
          },
        ],
      },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const quizCreate = prismaMock.quiz.create.mock.calls[0]![0];
    const storedQuestion = quizCreate.data.questions.create[0];
    expect(storedQuestion).toMatchObject({ sourceQuestionId: SOURCE_QUESTION_ID });
    expect(storedQuestion.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(prismaMock.quizLearningObjectiveBundle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quizId: QUIZ_ID,
        sourceQuizId: SOURCE_QUIZ_ID,
        objectives: {
          create: [
            expect.objectContaining({
              objectiveId: OBJECTIVE_ID,
              references: {
                create: [
                  expect.objectContaining({
                    kind: 'TASK',
                    questionId: storedQuestion.id,
                  }),
                ],
              },
            }),
          ],
        },
      }),
    });
    expect(checkQuizUploadStorageRateMock).toHaveBeenCalledWith('0.0.0.0', {
      payloadBytes: expect.any(Number),
      complexity: 6,
    });
  });

  trpcDodIt(
    {
      procedure: 'quiz.upload',
      case: 'error',
      mode: 'direct',
      contract: 'TOO_MANY_REQUESTS',
      title: 'begrenzt Upload-Spam vor jedem Datenbankschreibzugriff',
    },
    async () => {
      checkQuizUploadStorageRateMock.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 120,
      });
      const input = {
        name: 'Spam',
        showLeaderboard: true,
        allowCustomNicknames: true,
        enableSoundEffects: true,
        enableRewardEffects: true,
        enableMotivationMessages: true,
        enableEmojiReactions: true,
        anonymousMode: false,
        teamMode: false,
        nicknameTheme: 'NOBEL_LAUREATES' as const,
        questions: [
          {
            text: 'Frage',
            type: 'SINGLE_CHOICE' as const,
            difficulty: 'MEDIUM' as const,
            order: 0,
            answers: [{ text: 'A', isCorrect: true }],
          },
        ],
      };

      await expect(caller.upload(input)).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
        cause: { retryAfterSeconds: 120 },
      });
      expect(prismaMock.quiz.create).not.toHaveBeenCalled();
    },
  );

  it('ignoriert gefälschte Proxy-Header für beide Quiz-Upload-Budgets', async () => {
    const trustedIpCaller = quizRouter.createCaller({
      req: {
        ip: '198.51.100.77',
        headers: {
          'cf-connecting-ip': '203.0.113.1',
          'true-client-ip': '203.0.113.2',
          'x-forwarded-for': '203.0.113.3',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
    });

    await trustedIpCaller.upload({
      name: 'Trusted IP',
      showLeaderboard: true,
      allowCustomNicknames: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      nicknameTheme: 'NOBEL_LAUREATES',
      questions: [
        {
          text: 'Frage',
          type: 'SINGLE_CHOICE',
          difficulty: 'MEDIUM',
          order: 0,
          answers: [{ text: 'A', isCorrect: true }],
        },
      ],
    });

    expect(checkQuizUploadAttemptRateMock).toHaveBeenCalledWith('198.51.100.77');
    expect(checkQuizUploadStorageRateMock).toHaveBeenCalledWith(
      '198.51.100.77',
      expect.any(Object),
    );
  });

  it('speichert SHORT_TEXT-Konfiguration und Musterlösungen', async () => {
    const input = {
      name: 'Kurzantwort-Quiz',
      showLeaderboard: true,
      allowCustomNicknames: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      questions: [
        {
          text: 'Wer schrieb den ersten Algorithmus?',
          type: 'SHORT_TEXT' as const,
          difficulty: 'MEDIUM' as const,
          order: 0,
          shortTextMaxLength: 40,
          shortTextCaseSensitive: false,
          answers: [
            { text: 'Ada Lovelace', isCorrect: true },
            { text: 'Ada', isCorrect: true },
          ],
        },
      ],
    };

    await caller.upload(input);

    expect(prismaMock.quiz.create.mock.calls[0]![0].data.questions.create[0]).toMatchObject({
      type: 'SHORT_TEXT',
      shortTextMaxLength: 40,
      shortTextCaseSensitive: false,
      answers: {
        create: [
          { text: 'Ada Lovelace', isCorrect: true },
          { text: 'Ada', isCorrect: true },
        ],
      },
    });
  });

  it('speichert nicknameTheme KINDERGARTEN', async () => {
    const input = {
      name: 'Kita',
      showLeaderboard: true,
      allowCustomNicknames: false,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'KINDERGARTEN' as const,
      questions: [
        {
          text: 'Frage',
          type: 'SINGLE_CHOICE' as const,
          difficulty: 'MEDIUM' as const,
          order: 0,
          answers: [{ text: 'A', isCorrect: true }],
        },
      ],
    };

    await caller.upload(input);

    expect(prismaMock.quiz.create.mock.calls[0]![0].data.nicknameTheme).toBe('KINDERGARTEN');
  });

  it('speichert motifImageUrl und motifImageCredit (HTTPS)', async () => {
    const input = {
      name: 'Mit Motiv',
      motifImageUrl: 'https://example.com/bild.png' as const,
      motifImageCredit: 'Pass / Le Brun (1821)' as const,
      showLeaderboard: true,
      allowCustomNicknames: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      questions: [
        {
          text: 'Frage',
          type: 'SINGLE_CHOICE' as const,
          difficulty: 'MEDIUM' as const,
          order: 0,
          answers: [{ text: 'A', isCorrect: true }],
        },
      ],
    };

    await caller.upload(input);

    expect(prismaMock.quiz.create.mock.calls[0]![0].data.motifImageUrl).toBe(
      'https://example.com/bild.png',
    );
    expect(prismaMock.quiz.create.mock.calls[0]![0].data.motifImageCredit).toBe(
      'Pass / Le Brun (1821)',
    );
  });

  it('speichert motifImageUrl (HTTPS)', async () => {
    const input = {
      name: 'Mit Motiv',
      motifImageUrl: 'https://example.com/bild.png' as const,
      showLeaderboard: true,
      allowCustomNicknames: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      questions: [
        {
          text: 'Frage',
          type: 'SINGLE_CHOICE' as const,
          difficulty: 'MEDIUM' as const,
          order: 0,
          answers: [{ text: 'A', isCorrect: true }],
        },
      ],
    };

    await caller.upload(input);

    expect(prismaMock.quiz.create.mock.calls[0]![0].data.motifImageUrl).toBe(
      'https://example.com/bild.png',
    );
  });

  it('speichert deaktivierte Timer-Skalierung explizit', async () => {
    const input = {
      name: 'Ohne Skalierung',
      showLeaderboard: true,
      allowCustomNicknames: true,
      defaultTimer: 40,
      timerScaleByDifficulty: false,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      questions: [
        {
          text: 'Frage',
          type: 'SINGLE_CHOICE' as const,
          difficulty: 'HARD' as const,
          order: 0,
          answers: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false },
          ],
        },
      ],
    };

    await caller.upload(input);

    expect(prismaMock.quiz.create.mock.calls[0]![0].data.timerScaleByDifficulty).toBe(false);
  });

  it('akzeptiert leeres motifImageUrl (wird zu null)', async () => {
    const input = {
      name: 'Ohne Motiv',
      motifImageUrl: '' as const,
      showLeaderboard: true,
      allowCustomNicknames: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      questions: [
        {
          text: 'Frage',
          type: 'SINGLE_CHOICE' as const,
          difficulty: 'MEDIUM' as const,
          order: 0,
          answers: [{ text: 'A', isCorrect: true }],
        },
      ],
    };

    await caller.upload(input);

    expect(prismaMock.quiz.create.mock.calls[0]![0].data.motifImageUrl).toBeNull();
  });

  it('speichert motifImageUrl als root-relativen Asset-Pfad', async () => {
    const input = {
      name: 'Mit lokalem Motiv',
      motifImageUrl: '/assets/demo/brainstorming.svg' as const,
      showLeaderboard: true,
      allowCustomNicknames: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      questions: [
        {
          text: 'Frage',
          type: 'SINGLE_CHOICE' as const,
          difficulty: 'MEDIUM' as const,
          order: 0,
          answers: [{ text: 'A', isCorrect: true }],
        },
      ],
    };

    await caller.upload(input);

    expect(prismaMock.quiz.create.mock.calls[0]![0].data.motifImageUrl).toBe(
      '/assets/demo/brainstorming.svg',
    );
  });

  it('übernimmt readingPhaseEnabled (default true)', async () => {
    const input = {
      name: 'Quiz',
      showLeaderboard: false,
      allowCustomNicknames: false,
      enableSoundEffects: false,
      enableRewardEffects: false,
      enableMotivationMessages: false,
      enableEmojiReactions: false,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      questions: [
        {
          text: 'Frage',
          type: 'SINGLE_CHOICE' as const,
          difficulty: 'MEDIUM' as const,
          order: 0,
          answers: [{ text: 'A', isCorrect: true }],
        },
      ],
    };

    await caller.upload(input);

    expect(prismaMock.quiz.create.mock.calls[0]![0].data.readingPhaseEnabled).toBe(true);
  });

  it('übernimmt skipReadingPhase pro Frage', async () => {
    const input = {
      name: 'Quiz',
      showLeaderboard: false,
      allowCustomNicknames: false,
      enableSoundEffects: false,
      enableRewardEffects: false,
      enableMotivationMessages: false,
      enableEmojiReactions: false,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      questions: [
        {
          text: 'Frage',
          type: 'MULTIPLE_CHOICE' as const,
          difficulty: 'MEDIUM' as const,
          order: 0,
          skipReadingPhase: true,
          answers: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false },
          ],
        },
      ],
    };

    await caller.upload(input);

    expect(
      prismaMock.quiz.create.mock.calls[0]![0].data.questions.create[0]?.skipReadingPhase,
    ).toBe(true);
  });
});
