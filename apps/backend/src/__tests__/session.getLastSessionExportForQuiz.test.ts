import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';
import { createQuizHistoryAccessProof } from '@arsnova/shared-types';

const { buildSessionResultsPdfMock, hostAuthMocks, prismaMock } = vi.hoisted(() => ({
  buildSessionResultsPdfMock: vi.fn(),
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
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

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });
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
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
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

  trpcDodIt(
    {
      procedure: 'session.getLastSessionExportDataForQuiz',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'liefert NOT_FOUND ohne beendete Session',
    },
    async () => {
      const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
      prismaMock.session.findFirst.mockResolvedValue(null);

      await expect(
        caller.getLastSessionExportDataForQuiz({ quizId: QUIZ_ID, accessProof }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getLastSessionExportDataForQuiz',
      case: 'happy',
      mode: 'direct',
      title: 'liefert die Exportdaten der zuletzt beendeten Session im autorisierten Quiz-Scope',
    },
    async () => {
      const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
      prismaMock.session.findFirst.mockResolvedValue({ code: SESSION_CODE });
      prismaMock.session.findUnique.mockResolvedValue(finishedSessionFixture());

      const result = await caller.getLastSessionExportDataForQuiz({ quizId: QUIZ_ID, accessProof });

      expect(prismaMock.session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'FINISHED', quizId: { in: [QUIZ_ID] } }),
        }),
      );
      expect(result).toMatchObject({ sessionCode: SESSION_CODE, quizName: 'Chemie' });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getLastSessionExportPdfForQuiz',
      case: 'happy',
      mode: 'direct',
      title: 'liefert PDF fuer die zuletzt beendete Session',
    },
    async () => {
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
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getSessionExportPdf',
      case: 'happy',
      mode: 'direct',
      title: 'rendert den host-autorisierten Ergebnisbericht als PDF',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(finishedSessionFixture());

      const result = await caller.getSessionExportPdf({ code: SESSION_CODE, localeId: 'de' });

      expect(result).toMatchObject({
        mimeType: 'application/pdf',
        fileName: 'arsnova-results-test-ABC123.pdf',
      });
      expect(buildSessionResultsPdfMock).toHaveBeenCalledWith(
        expect.objectContaining({ sessionCode: SESSION_CODE }),
        { localeId: 'de', profile: 'visual' },
      );
    },
  );

  it('lädt und rendert einen zusätzlichen parallelen PDF-Request nicht', async () => {
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
    await vi.waitFor(() => {
      expect(buildSessionResultsPdfMock).toHaveBeenCalledOnce();
    });

    try {
      await expect(caller.getLastSessionExportPdfForQuiz(input)).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
      expect(prismaMock.session.findUnique).toHaveBeenCalledOnce();
      expect(buildSessionResultsPdfMock).toHaveBeenCalledOnce();
    } finally {
      releaseRendering();
    }
    await expect(first).resolves.toMatchObject({ mimeType: 'application/pdf' });
  });
});

trpcDodIt(
  {
    procedure: 'session.getLastSessionExportPdfForQuiz',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'lehnt eine unbekannte Quiz-ID vor Session-Lookup und PDF-Rendern ab',
  },
  async () => {
    vi.clearAllMocks();
    prismaMock.quiz.findUnique.mockResolvedValue(null);

    await expect(
      caller.getLastSessionExportPdfForQuiz({
        quizId: QUIZ_ID,
        accessProof: '22222222-2222-4222-8222-222222222222',
        localeId: 'de',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prismaMock.session.findFirst).not.toHaveBeenCalled();
    expect(buildSessionResultsPdfMock).not.toHaveBeenCalled();
  },
);

trpcDodIt(
  {
    procedure: 'session.getSessionExportPdf',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'session.getSessionExportPdf weist ungültige Host-Token vor dem PDF-Rendern ab',
  },
  async () => {
    buildSessionResultsPdfMock.mockClear();
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(
      caller.getSessionExportPdf({ code: SESSION_CODE, localeId: 'de' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(buildSessionResultsPdfMock).not.toHaveBeenCalled();
  },
);
