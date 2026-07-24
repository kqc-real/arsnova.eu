import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuizHistoryAccessProof } from '@arsnova/shared-types';

const { buildSessionResultsPdfMock, prismaMock } = vi.hoisted(() => ({
  buildSessionResultsPdfMock: vi.fn(),
  prismaMock: {
    quiz: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    session: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    qaQuestion: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/session-results-report-pdf', () => ({
  buildSessionResultsPdf: buildSessionResultsPdfMock,
  buildSessionResultsPdfFilename: vi.fn(() => 'arsnova-results-test-ABC123.pdf'),
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_CODE = 'ABC123';
const QUIZ_INPUT = {
  name: 'Chemie',
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: null,
  timerScaleByDifficulty: false,
  enableSoundEffects: true,
  enableRewardEffects: true,
  enableMotivationMessages: true,
  enableEmojiReactions: true,
  anonymousMode: false,
  teamMode: false,
  teamCount: undefined,
  teamAssignment: 'AUTO' as const,
  teamNames: [],
  backgroundMusic: undefined,
  nicknameTheme: 'NOBEL_LAUREATES' as const,
  bonusTokenCount: 3,
  readingPhaseEnabled: true,
  preset: 'PLAYFUL' as const,
  questions: [
    {
      text: 'Was ist Wasser?',
      type: 'SINGLE_CHOICE' as const,
      timer: null,
      difficulty: 'EASY' as const,
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [
        { text: 'H2O', isCorrect: true },
        { text: 'CO2', isCorrect: false },
      ],
    },
  ],
};

function finishedSessionFixture() {
  return {
    id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
    code: SESSION_CODE,
    status: 'FINISHED',
    type: 'QUIZ',
    endedAt: new Date('2026-03-10T12:00:00.000Z'),
    answerDisplayOrder: null,
    quiz: {
      name: 'Chemie',
      teamMode: false,
      teamCount: null,
      teamNames: [],
      questions: [],
    },
    votes: [],
    bonusTokens: [],
    sessionFeedbacks: [],
    participants: [{ id: 'p1' }],
  };
}

describe('session.getLastSessionExportForQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildSessionResultsPdfMock.mockResolvedValue(Buffer.from('%PDF-1.4\n% test'));
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      ...QUIZ_INPUT,
      description: null,
      teamCount: null,
      backgroundMusic: null,
      questions: QUIZ_INPUT.questions.map((question) => ({
        ...question,
        ratingMin: null,
        ratingMax: null,
        ratingLabelMin: null,
        ratingLabelMax: null,
      })),
    });
    prismaMock.quiz.findMany.mockResolvedValue([
      {
        id: QUIZ_ID,
        ...QUIZ_INPUT,
        description: null,
        teamCount: null,
        backgroundMusic: null,
        questions: QUIZ_INPUT.questions.map((question) => ({
          ...question,
          ratingMin: null,
          ratingMax: null,
          ratingLabelMin: null,
          ratingLabelMax: null,
        })),
      },
    ]);
    prismaMock.qaQuestion.findMany.mockResolvedValue([]);
  });

  it('liefert NOT_FOUND ohne beendete Session', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.session.findFirst.mockResolvedValue(null);

    await expect(
      caller.getLastSessionExportDataForQuiz({ quizId: QUIZ_ID, accessProof }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('liefert PDF fuer die zuletzt beendete Session', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.session.findFirst.mockResolvedValue({ code: SESSION_CODE });
    prismaMock.session.findUnique.mockResolvedValue(finishedSessionFixture());

    const result = await caller.getLastSessionExportPdfForQuiz({
      quizId: QUIZ_ID,
      accessProof,
      localeId: 'de',
    });

    expect(result.mimeType).toBe('application/pdf');
    expect(result.fileName).toBe('arsnova-results-test-ABC123.pdf');
    expect(result.contentBase64.length).toBeGreaterThan(0);
  });

  it('lädt und rendert beim dritten parallelen PDF-Request keine Exportdaten', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.session.findFirst.mockResolvedValue({ code: SESSION_CODE });
    prismaMock.session.findUnique.mockResolvedValue(finishedSessionFixture());
    let releaseRendering!: () => void;
    const renderingBlocked = new Promise<void>((resolve) => {
      releaseRendering = resolve;
    });
    buildSessionResultsPdfMock.mockImplementation(async () => {
      await renderingBlocked;
      return Buffer.from('%PDF-1.4\n% test');
    });
    const input = { quizId: QUIZ_ID, accessProof, localeId: 'de' as const };

    const first = caller.getLastSessionExportPdfForQuiz(input);
    const second = caller.getLastSessionExportPdfForQuiz(input);
    await vi.waitFor(() => {
      expect(buildSessionResultsPdfMock).toHaveBeenCalledTimes(2);
    });

    try {
      await expect(caller.getLastSessionExportPdfForQuiz(input)).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
      expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(2);
      expect(buildSessionResultsPdfMock).toHaveBeenCalledTimes(2);
    } finally {
      releaseRendering();
    }
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });
});
