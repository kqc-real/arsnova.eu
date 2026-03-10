import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const CODE = 'ABC123';

describe('session.getCurrentQuestionForHost (Story 2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
