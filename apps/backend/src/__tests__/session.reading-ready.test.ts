import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, hostAuthMocks, presenceMocks, readingReadyMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
    },
    vote: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
  presenceMocks: {
    touchParticipantPresence: vi.fn(),
    getActiveParticipantCountForSession: vi.fn(),
    getActiveParticipantIdsForSession: vi.fn(),
  },
  readingReadyMocks: {
    markParticipantReadingReady: vi.fn(),
    getReadingReadyParticipantIds: vi.fn(),
    clearReadingReady: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/presence', () => ({
  touchParticipantPresence: presenceMocks.touchParticipantPresence,
  getActiveParticipantCountForSession: presenceMocks.getActiveParticipantCountForSession,
  getActiveParticipantIdsForSession: presenceMocks.getActiveParticipantIdsForSession,
}));

vi.mock('../lib/readingReady', () => ({
  markParticipantReadingReady: readingReadyMocks.markParticipantReadingReady,
  getReadingReadyParticipantIds: readingReadyMocks.getReadingReadyParticipantIds,
  clearReadingReady: readingReadyMocks.clearReadingReady,
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

import {
  invalidateCurrentQuestionCachesForCode,
  resetSessionReadCachesForTests,
  resetVoteAggregationCachesForTests,
  sessionRouter,
} from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const hostCaller = sessionRouter.createCaller({ req: {} as never });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const PARTICIPANT_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID_2 = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';
const QUESTION_ID_2 = '44444444-4444-4444-8444-444444444444';

describe('session reading-ready flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionReadCachesForTests();
    resetVoteAggregationCachesForTests();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    presenceMocks.getActiveParticipantCountForSession.mockResolvedValue(0);
    presenceMocks.getActiveParticipantIdsForSession.mockResolvedValue(new Set());
    readingReadyMocks.getReadingReadyParticipantIds.mockResolvedValue(new Set());
    prismaMock.session.update.mockResolvedValue(undefined);
    prismaMock.vote.count.mockResolvedValue(0);
    prismaMock.vote.findMany.mockResolvedValue([]);
  });

  it('bestätigt Bereitschaft idempotent in QUESTION_OPEN und liefert Fortschritt zurück', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'QUESTION_OPEN',
      currentQuestion: 0,
      participants: [{ id: PARTICIPANT_ID, nickname: 'Ada', teamId: null, team: null }],
      quiz: { questions: [{ id: QUESTION_ID }] },
    });
    presenceMocks.getActiveParticipantIdsForSession.mockResolvedValue(new Set([PARTICIPANT_ID]));
    readingReadyMocks.getReadingReadyParticipantIds.mockResolvedValue(new Set([PARTICIPANT_ID]));

    const result = await caller.confirmReadingReady({
      code: 'ABC123',
      participantId: PARTICIPANT_ID,
      questionId: QUESTION_ID,
    });

    expect(readingReadyMocks.markParticipantReadingReady).toHaveBeenCalledWith(
      SESSION_ID,
      QUESTION_ID,
      PARTICIPANT_ID,
    );
    expect(presenceMocks.touchParticipantPresence).toHaveBeenCalledWith(SESSION_ID, PARTICIPANT_ID);
    expect(result).toEqual({
      connectedCount: 1,
      readyCount: 1,
      allConnectedReady: true,
      participantReady: true,
    });
  });

  it('liefert dem Host den Lesephasen-Fortschritt für aktuell verbundene Teilnehmende', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'QUESTION_OPEN',
      currentQuestion: 0,
      participants: [
        { id: PARTICIPANT_ID, nickname: 'Ada', teamId: null, team: null },
        { id: PARTICIPANT_ID_2, nickname: 'Linus', teamId: null, team: null },
      ],
      quiz: { questions: [{ id: QUESTION_ID }] },
    });
    presenceMocks.getActiveParticipantIdsForSession.mockResolvedValue(
      new Set([PARTICIPANT_ID, PARTICIPANT_ID_2, '99999999-9999-4999-8999-999999999999']),
    );
    readingReadyMocks.getReadingReadyParticipantIds.mockResolvedValue(new Set([PARTICIPANT_ID]));

    const result = await hostCaller.getParticipants({ code: 'ABC123' });

    expect(result.readingReady).toEqual({
      connectedCount: 2,
      readyCount: 1,
      allConnectedReady: false,
    });
    expect(result).toMatchObject({ connectedCount: 2 });
  });

  it('liefert Teilnehmenden den eigenen Ready-Status in QUESTION_OPEN zurück', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'QUESTION_OPEN',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      statusChangedAt: new Date('2026-04-28T10:00:00.000Z'),
      quiz: {
        defaultTimer: null,
        timerScaleByDifficulty: true,
        preset: 'SERIOUS',
        questions: [
          {
            id: QUESTION_ID,
            text: 'Was ist 2 + 2?',
            type: 'SINGLE_CHOICE',
            difficulty: 'MEDIUM',
            order: 0,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [],
          },
        ],
      },
      _count: { participants: 2 },
    });
    prismaMock.participant.findFirst.mockResolvedValue({ id: PARTICIPANT_ID });
    readingReadyMocks.getReadingReadyParticipantIds.mockResolvedValue(new Set([PARTICIPANT_ID]));

    const result = await caller.getCurrentQuestionForStudent({
      code: 'ABC123',
      participantId: PARTICIPANT_ID,
    });

    expect(prismaMock.participant.findFirst).toHaveBeenCalledWith({
      where: { id: PARTICIPANT_ID, sessionId: SESSION_ID },
      select: { id: true },
    });
    expect(presenceMocks.touchParticipantPresence).toHaveBeenCalledWith(SESSION_ID, PARTICIPANT_ID);
    expect(result).toMatchObject({
      id: QUESTION_ID,
      participantReady: true,
    });
  });

  it('räumt den Ready-State beim Freigeben der Antworten auf', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'QUESTION_OPEN',
      currentQuestion: 0,
      currentRound: 1,
      quiz: { questions: [{ id: QUESTION_ID }] },
    });

    const result = await hostCaller.revealAnswers({ code: 'ABC123' });

    expect(readingReadyMocks.clearReadingReady).toHaveBeenCalledWith(SESSION_ID, QUESTION_ID);
    expect(result).toMatchObject({
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
    });
  });

  it('räumt den Ready-State beim Wechsel zur nächsten Frage auf', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        name: 'Quiz',
        readingPhaseEnabled: true,
        bonusTokenCount: 0,
        questions: [
          {
            id: QUESTION_ID,
            type: 'SINGLE_CHOICE',
            skipReadingPhase: false,
            answers: [],
          },
          {
            id: QUESTION_ID_2,
            type: 'SINGLE_CHOICE',
            skipReadingPhase: false,
            answers: [],
          },
        ],
      },
      participants: [],
      bonusTokens: [],
    });

    const result = await hostCaller.nextQuestion({ code: 'ABC123' });

    expect(readingReadyMocks.clearReadingReady).toHaveBeenCalledWith(SESSION_ID, QUESTION_ID);
    expect(result).toMatchObject({
      status: 'QUESTION_OPEN',
      currentQuestion: 1,
      currentRound: 1,
    });
  });

  it('nutzt bei ACTIVE kurzfristig einen Cache fuer wiederholte Current-Question-Abfragen', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      statusChangedAt: new Date('2026-04-28T10:00:00.000Z'),
      quiz: {
        defaultTimer: 30,
        timerScaleByDifficulty: true,
        preset: 'SERIOUS',
        questions: [
          {
            id: QUESTION_ID,
            text: 'Was ist 2 + 2?',
            type: 'SINGLE_CHOICE',
            difficulty: 'MEDIUM',
            order: 0,
            timer: 30,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              {
                id: '55555555-5555-4555-8555-555555555555',
                text: '4',
                isCorrect: true,
              },
            ],
          },
        ],
      },
      _count: { participants: 2 },
    });
    prismaMock.participant.findFirst.mockResolvedValue({ id: PARTICIPANT_ID });
    const voteCountMock = vi.fn().mockResolvedValue(1);
    prismaMock.vote.count = voteCountMock;

    const first = await caller.getCurrentQuestionForStudent({
      code: 'ABC123',
      participantId: PARTICIPANT_ID,
    });
    const second = await caller.getCurrentQuestionForStudent({
      code: 'ABC123',
      participantId: PARTICIPANT_ID,
    });

    expect(first).toMatchObject({ id: QUESTION_ID, totalVotes: 1 });
    expect(second).toMatchObject({ id: QUESTION_ID, totalVotes: 1 });
    expect(voteCountMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.participant.findFirst).toHaveBeenCalledTimes(1);
  });

  it('haelt den Vote-Count nach Current-Question-Invalidierung im eigenen Cache', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      statusChangedAt: new Date('2026-04-28T10:00:00.000Z'),
      quiz: {
        defaultTimer: 30,
        timerScaleByDifficulty: true,
        preset: 'SERIOUS',
        questions: [
          {
            id: QUESTION_ID,
            text: 'Was ist 2 + 2?',
            type: 'SINGLE_CHOICE',
            difficulty: 'MEDIUM',
            order: 0,
            timer: 30,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [{ id: '55555555-5555-4555-8555-555555555555', text: '4', isCorrect: true }],
          },
        ],
      },
      _count: { participants: 2 },
    });
    prismaMock.participant.findFirst.mockResolvedValue({ id: PARTICIPANT_ID });
    const voteCountMock = vi.fn().mockResolvedValue(3);
    prismaMock.vote.count = voteCountMock;

    const first = await caller.getCurrentQuestionForStudent({
      code: 'ABC123',
      participantId: PARTICIPANT_ID,
    });
    invalidateCurrentQuestionCachesForCode('ABC123');
    const second = await caller.getCurrentQuestionForStudent({
      code: 'ABC123',
      participantId: PARTICIPANT_ID,
    });

    expect(first).toMatchObject({ id: QUESTION_ID, totalVotes: 3 });
    expect(second).toMatchObject({ id: QUESTION_ID, totalVotes: 3 });
    expect(voteCountMock).toHaveBeenCalledTimes(1);
  });

  it('haelt die Ergebnisaggregation nach Current-Question-Invalidierung im eigenen Cache', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      statusChangedAt: new Date('2026-04-28T10:00:00.000Z'),
      quiz: {
        defaultTimer: 30,
        timerScaleByDifficulty: true,
        preset: 'SERIOUS',
        questions: [
          {
            id: QUESTION_ID,
            text: 'Was ist 2 + 2?',
            type: 'SINGLE_CHOICE',
            difficulty: 'MEDIUM',
            order: 0,
            timer: 30,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: '55555555-5555-4555-8555-555555555555', text: '4', isCorrect: true },
              { id: '66666666-6666-4666-8666-666666666666', text: '5', isCorrect: false },
            ],
          },
        ],
      },
      _count: { participants: 2 },
    });
    const findManyMock = vi
      .fn()
      .mockResolvedValue([
        { selectedAnswers: [{ answerOptionId: '55555555-5555-4555-8555-555555555555' }] },
        { selectedAnswers: [{ answerOptionId: '66666666-6666-4666-8666-666666666666' }] },
      ]);
    prismaMock.vote.findMany = findManyMock;

    const first = await caller.getCurrentQuestionForStudent({ code: 'ABC123' });
    invalidateCurrentQuestionCachesForCode('ABC123');
    const second = await caller.getCurrentQuestionForStudent({ code: 'ABC123' });

    expect(first).toMatchObject({ id: QUESTION_ID, totalVotes: 2 });
    expect(second).toMatchObject({ id: QUESTION_ID, totalVotes: 2 });
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});
