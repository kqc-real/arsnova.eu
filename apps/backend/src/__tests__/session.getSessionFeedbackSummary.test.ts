import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    sessionFeedback: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });

describe('session.getSessionFeedbackSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('berechnet Mittelwerte arithmetisch und ignoriert null bei Fragenqualitaet', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
    });
    prismaMock.sessionFeedback.findMany.mockResolvedValue([
      { overallRating: 5, questionQualityRating: 1, wouldRepeat: true },
      { overallRating: 3, questionQualityRating: 2, wouldRepeat: false },
      { overallRating: 1, questionQualityRating: 3, wouldRepeat: null },
      { overallRating: 1, questionQualityRating: null, wouldRepeat: null },
    ]);

    const result = await caller.getSessionFeedbackSummary({ code: 'ABC123' });

    expect(result).toEqual({
      totalResponses: 4,
      overallAverage: 2.5,
      overallDistribution: { '1': 2, '3': 1, '5': 1 },
      questionQualityAverage: 2,
      questionQualityDistribution: { '1': 1, '2': 1, '3': 1 },
      wouldRepeatYes: 1,
      wouldRepeatNo: 1,
    });
  });

  it('liefert null fuer Fragenqualitaet, wenn dazu nichts abgegeben wurde', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
    });
    prismaMock.sessionFeedback.findMany.mockResolvedValue([
      { overallRating: 2, questionQualityRating: null, wouldRepeat: true },
      { overallRating: 4, questionQualityRating: null, wouldRepeat: false },
    ]);

    const result = await caller.getSessionFeedbackSummary({ code: 'ABC123' });

    expect(result.questionQualityAverage).toBeNull();
    expect(result.questionQualityDistribution).toBeNull();
  });
});
