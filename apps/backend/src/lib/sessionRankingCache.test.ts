import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    vote: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import {
  buildScoreRanking,
  loadSharedCompetitionVotes,
  rankOfParticipant,
  resetSessionRankingCacheForTests,
  selectEffectiveCompetitionVotes,
} from './sessionRankingCache';

describe('sessionRankingCache', () => {
  beforeEach(() => {
    resetSessionRankingCacheForTests();
    vi.clearAllMocks();
  });

  it('ersetzt Runde 1 durch Runde 2 und ignoriert Runde-2-Zeiten', () => {
    const votes = selectEffectiveCompetitionVotes([
      {
        participantId: 'p1',
        questionId: 'q1',
        round: 1,
        score: 1000,
        responseTimeMs: 500,
      },
      {
        participantId: 'p1',
        questionId: 'q1',
        round: 2,
        score: 800,
        responseTimeMs: 10,
      },
    ]);
    expect(votes).toEqual([expect.objectContaining({ round: 2, score: 800 })]);
    const ranking = buildScoreRanking(['p1', 'p2'], votes, ['q1']);
    expect(ranking.totals.get('p1')?.totalResponseTimeMs).toBe(0);
  });

  it('teilt denselben Stimmenstand zwischen parallelen und warmen Abrufen', async () => {
    prismaMock.vote.findMany.mockResolvedValue([
      {
        participantId: 'p1',
        questionId: 'q1',
        round: 1,
        score: 1200,
        responseTimeMs: 400,
      },
    ]);

    const [first, second] = await Promise.all([
      loadSharedCompetitionVotes({
        sessionId: 'sess-1',
        questionIds: ['q1'],
        participantRevision: 3,
        includeCorrectness: false,
      }),
      loadSharedCompetitionVotes({
        sessionId: 'sess-1',
        questionIds: ['q1'],
        participantRevision: 3,
        includeCorrectness: false,
      }),
    ]);
    const third = await loadSharedCompetitionVotes({
      sessionId: 'sess-1',
      questionIds: ['q1'],
      participantRevision: 3,
      includeCorrectness: false,
    });

    expect(first).toHaveLength(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(prismaMock.vote.findMany).toHaveBeenCalledTimes(1);
  });

  it('trennt Sessions und Wertungsgrenzen voneinander', async () => {
    prismaMock.vote.findMany.mockResolvedValue([]);
    await loadSharedCompetitionVotes({
      sessionId: 'sess-a',
      questionIds: ['q1'],
      participantRevision: 1,
      includeCorrectness: false,
    });
    await loadSharedCompetitionVotes({
      sessionId: 'sess-b',
      questionIds: ['q1'],
      participantRevision: 1,
      includeCorrectness: false,
    });
    expect(prismaMock.vote.findMany).toHaveBeenCalledTimes(2);
  });

  it('leitet den vorherigen Rang aus demselben Stimmenbestand ab', () => {
    const votes = [
      { participantId: 'p1', questionId: 'q1', round: 1, score: 1000, responseTimeMs: 200 },
      { participantId: 'p2', questionId: 'q1', round: 1, score: 900, responseTimeMs: 100 },
      { participantId: 'p1', questionId: 'q2', round: 1, score: 100, responseTimeMs: 300 },
      { participantId: 'p2', questionId: 'q2', round: 1, score: 400, responseTimeMs: 150 },
    ];
    const current = buildScoreRanking(['p1', 'p2'], votes, ['q1', 'q2']);
    const previous = buildScoreRanking(['p1', 'p2'], votes, ['q1']);
    expect(rankOfParticipant(previous.ranked, previous.totals, 'p1')).toBe(1);
    expect(rankOfParticipant(current.ranked, current.totals, 'p1')).toBe(2);
  });
});
