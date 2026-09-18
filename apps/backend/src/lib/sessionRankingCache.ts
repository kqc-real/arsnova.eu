import { prisma } from '../db';

const SESSION_RANKING_CACHE_TTL_MS = 2_000;
const SESSION_RANKING_CACHE_MAX_ENTRIES = 256;

export type CompetitionVoteRow = {
  participantId: string;
  questionId: string;
  round: number;
  score: number;
  responseTimeMs: number | null;
  isCorrect?: boolean | null;
  question?: {
    type: string;
    answers: { id: string; isCorrect: boolean }[];
  };
  selectedAnswers?: { answerOptionId: string }[];
};

export type ScoreRankingTotals = {
  totalScore: number;
  totalResponseTimeMs: number;
};

type RankingCacheEntry = {
  expiresAt: number;
  promise: Promise<CompetitionVoteRow[]>;
};

const rankingCache = new Map<string, RankingCacheEntry>();

function pruneRankingCache(nowMs: number): void {
  for (const [key, entry] of rankingCache) {
    if (entry.expiresAt <= nowMs) {
      rankingCache.delete(key);
    }
  }
  while (rankingCache.size >= SESSION_RANKING_CACHE_MAX_ENTRIES) {
    const oldestKey = rankingCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    rankingCache.delete(oldestKey);
  }
}

export function selectEffectiveCompetitionVotes<T extends CompetitionVoteRow>(
  votes: readonly T[],
): T[] {
  const round2QuestionIds = new Set(
    votes.filter((vote) => vote.round === 2).map((vote) => vote.questionId),
  );
  const effectiveVotes = new Map<string, T>();
  for (const vote of votes) {
    const usesRound2 = round2QuestionIds.has(vote.questionId);
    if (usesRound2 ? vote.round !== 2 : vote.round !== 1) {
      continue;
    }
    effectiveVotes.set(`${vote.participantId}:${vote.questionId}`, vote);
  }
  return [...effectiveVotes.values()];
}

export function getCompetitionResponseTimeMs(vote: CompetitionVoteRow): number {
  if (vote.score <= 0 || vote.round === 2) {
    return 0;
  }
  return vote.responseTimeMs ?? 0;
}

export function buildScoreRanking(
  participantIds: readonly string[],
  votes: readonly CompetitionVoteRow[],
  questionIds: readonly string[],
): {
  totals: Map<string, ScoreRankingTotals>;
  ranked: Array<{ pid: string } & ScoreRankingTotals>;
} {
  const questionSet = new Set(questionIds);
  const effective = selectEffectiveCompetitionVotes(
    votes.filter((vote) => questionSet.has(vote.questionId)),
  );
  const totals = new Map<string, ScoreRankingTotals>();
  for (const participantId of participantIds) {
    totals.set(participantId, { totalScore: 0, totalResponseTimeMs: 0 });
  }
  for (const vote of effective) {
    const total = totals.get(vote.participantId);
    if (!total) continue;
    total.totalScore += Number(vote.score) || 0;
    total.totalResponseTimeMs += getCompetitionResponseTimeMs(vote);
  }
  const ranked = [...totals.entries()]
    .map(([pid, score]) => ({
      pid,
      totalScore: Number(score.totalScore) || 0,
      totalResponseTimeMs: score.totalResponseTimeMs,
    }))
    .filter((entry) => entry.totalScore > 0)
    .sort(
      (left, right) =>
        right.totalScore - left.totalScore || left.totalResponseTimeMs - right.totalResponseTimeMs,
    );
  return { totals, ranked };
}

export function rankOfParticipant(
  ranked: Array<{ pid: string }>,
  totals: Map<string, ScoreRankingTotals>,
  participantId: string,
): number {
  const totalScore = totals.get(participantId)?.totalScore ?? 0;
  const index = ranked.findIndex((entry) => entry.pid === participantId);
  return totalScore > 0 && index >= 0 ? index + 1 : 0;
}

export async function loadSharedCompetitionVotes(options: {
  sessionId: string;
  questionIds: readonly string[];
  participantRevision: number;
  includeCorrectness: boolean;
}): Promise<CompetitionVoteRow[]> {
  const questionKey = options.questionIds.join(',');
  const cacheKey = [
    options.sessionId,
    options.participantRevision,
    options.includeCorrectness ? 'full' : 'score',
    questionKey,
  ].join(':');
  const nowMs = Date.now();
  const cached = rankingCache.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) {
    return cached.promise;
  }

  pruneRankingCache(nowMs);
  const entry: RankingCacheEntry = {
    expiresAt: Number.POSITIVE_INFINITY,
    promise: Promise.resolve([]),
  };
  entry.promise = prisma.vote
    .findMany({
      where: {
        sessionId: options.sessionId,
        round: { in: [1, 2] },
        questionId: { in: [...options.questionIds] },
      },
      select: options.includeCorrectness
        ? {
            participantId: true,
            questionId: true,
            round: true,
            score: true,
            isCorrect: true,
            responseTimeMs: true,
            question: {
              select: {
                type: true,
                answers: { select: { id: true, isCorrect: true } },
              },
            },
            selectedAnswers: { select: { answerOptionId: true } },
          }
        : {
            participantId: true,
            questionId: true,
            round: true,
            score: true,
            responseTimeMs: true,
          },
    })
    .then((votes) => {
      if (rankingCache.get(cacheKey) !== entry) {
        return votes;
      }
      entry.expiresAt = Date.now() + SESSION_RANKING_CACHE_TTL_MS;
      return votes;
    })
    .catch((error: unknown) => {
      if (rankingCache.get(cacheKey) === entry) {
        rankingCache.delete(cacheKey);
      }
      throw error;
    });
  rankingCache.set(cacheKey, entry);
  return entry.promise;
}

export function invalidateSessionRankingCache(sessionId?: string): void {
  if (!sessionId) {
    rankingCache.clear();
    return;
  }
  for (const key of rankingCache.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      rankingCache.delete(key);
    }
  }
}

export function resetSessionRankingCacheForTests(): void {
  rankingCache.clear();
}
