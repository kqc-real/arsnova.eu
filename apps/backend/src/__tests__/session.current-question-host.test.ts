import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    vote: {
      findMany: vi.fn(),
    },
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
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
const CODE = 'ABC123';

describe('session.getCurrentQuestionForHost (Story 2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.vote.findMany.mockResolvedValue([]);
  });

  it('liefert aktuelle Frage mit Antwortoptionen und isCorrect', async () => {
    const a1Id = 'aaaaaaaa-1111-4111-8111-111111111111';
    const a2Id = 'bbbbbbbb-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quiz: {
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Was ist 2+2?',
            type: 'SINGLE_CHOICE',
            answers: [
              { id: a1Id, text: '3', isCorrect: false },
              { id: a2Id, text: '4', isCorrect: true },
            ],
          },
        ],
      },
      currentQuestion: 0,
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.order).toBe(0);
    expect(result!.text).toBe('Was ist 2+2?');
    expect(result!.type).toBe('SINGLE_CHOICE');
    expect(result!.answers).toHaveLength(2);
    expect(result!.answers[0]).toEqual({ id: a1Id, text: '3', isCorrect: false });
    expect(result!.answers[1]).toEqual({ id: a2Id, text: '4', isCorrect: true });
  });

  it('skaliert den Host-Timer nach Schwierigkeitsgrad, wenn die Quiz-Option aktiv ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: 40,
        timerScaleByDifficulty: true,
        preset: 'PLAYFUL',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Transferfrage',
            type: 'SINGLE_CHOICE',
            difficulty: 'HARD',
            timer: null,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: true },
              { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: false },
            ],
          },
        ],
      },
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.timer).toBe(80);
  });

  it('laesst einen expliziten Frage-Timer im Host unveraendert', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: 40,
        timerScaleByDifficulty: true,
        preset: 'PLAYFUL',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Transferfrage',
            type: 'SINGLE_CHOICE',
            difficulty: 'HARD',
            timer: 30,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: true },
              { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: false },
            ],
          },
        ],
      },
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.timer).toBe(30);
  });

  it('liefert in Peer-Instruction-Runde 2 keinen Host-Timer mehr', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 2,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: 40,
        timerScaleByDifficulty: true,
        preset: 'PLAYFUL',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Transferfrage',
            type: 'SINGLE_CHOICE',
            difficulty: 'HARD',
            timer: 30,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: true },
              { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: false },
            ],
          },
        ],
      },
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.timer).toBeNull();
  });

  it('liefert in aktiver Runde 1 nur Stimmenzahl plus Peer-Instruction-Empfehlung ohne Verteilung', async () => {
    const wrongId = 'aaaaaaaa-1111-4111-8111-111111111111';
    const correctId = 'bbbbbbbb-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: null,
        preset: 'SERIOUS',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Was ist 2+2?',
            type: 'SINGLE_CHOICE',
            timer: null,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: wrongId, text: '3', isCorrect: false },
              { id: correctId, text: '4', isCorrect: true },
            ],
          },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { selectedAnswers: [{ answerOptionId: correctId }] },
      { selectedAnswers: [{ answerOptionId: correctId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
    ]);

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.totalVotes).toBe(4);
    expect(result!.peerInstructionSuggestion).toEqual({
      suggested: true,
      reason: 'CORRECTNESS_WINDOW',
    });
    expect(result!.voteDistribution).toBeUndefined();
    expect(result!.correctVoterCount).toBeUndefined();
  });

  it('liefert keine Peer-Instruction-Empfehlung wenn Anteil vollstaendig korrekter Stimmen unter 35 %', async () => {
    const wrongId = 'aaaaaaaa-1111-4111-8111-111111111111';
    const correctId = 'bbbbbbbb-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: null,
        preset: 'SERIOUS',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Was ist 2+2?',
            type: 'SINGLE_CHOICE',
            timer: null,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: wrongId, text: '3', isCorrect: false },
              { id: correctId, text: '4', isCorrect: true },
            ],
          },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { selectedAnswers: [{ answerOptionId: correctId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
    ]);

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.totalVotes).toBe(4);
    expect(result!.peerInstructionSuggestion).toBeUndefined();
  });

  it('liefert null wenn keine Session', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);

    const result = await caller.getCurrentQuestionForHost({ code: 'NONEXI' });

    expect(result).toBeNull();
  });

  it('liefert null wenn currentQuestion null (noch in Lobby)', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      currentQuestion: null,
      quiz: {
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Frage',
            type: 'SINGLE_CHOICE',
            answers: [],
          },
        ],
      },
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).toBeNull();
  });

  it('liefert null wenn kein Quiz (Q&A-Session)', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      currentQuestion: 0,
      quiz: null,
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).toBeNull();
  });

  it('lehnt die Host-Abfrage ohne gültigen Token ab', async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);

    await expect(caller.getCurrentQuestionForHost({ code: CODE })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Session ungültig oder abgelaufen.',
    });
  });
});
