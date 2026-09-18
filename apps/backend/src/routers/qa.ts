import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  GetQaNlpRuntimeInputSchema,
  GetQaPresentProjectionInputSchema,
  GetQaQuestionsInputSchema,
  GetQaSummaryRuntimeInputSchema,
  ModerateQaQuestionInputSchema,
  QA_MAX_QUESTIONS_PER_PARTICIPANT,
  QA_MAX_QUESTIONS_PER_SESSION,
  QaNlpRuntimeDTOSchema,
  QaQuestionDTOSchema,
  QaQuestionsInvalidationDTOSchema,
  QaQuestionsListDTOSchema,
  QaSummaryRuntimeDTOSchema,
  QaVoteInputSchema,
  QaVoteOutputSchema,
  RequestQaSummaryInputSchema,
  SubmitQaQuestionInputSchema,
  SubmitQaQuestionOutputSchema,
  ToggleQaModerationInputSchema,
  ToggleQaUpvoteOutputSchema,
  UpvoteQaQuestionInputSchema,
} from '@arsnova/shared-types';
import { assertHostSessionAccessFromContext } from '../lib/hostAuth';
import { waitWhileHostTokenValid } from '../lib/hostRealtimeGuard';
import { prisma } from '../db';
import { isQaNlpEnabled } from '../lib/qaNlpConfig';
import { getQaNlpMetrics } from '../lib/qaNlpQueue';
import { enqueueQaNlpJob } from '../lib/qaNlpQueue';
import { isQaSummaryEnabled } from '../lib/qaSummaryConfig';
import { getQaSummaryRuntime, requestQaSummary } from '../lib/qaSummaryQueue';
import {
  buildSessionRetentionTimeline,
  isSessionEffectivelyFinished,
} from '../lib/sessionLifecycle';
import {
  mapStoredQaNlpResult,
  type QaNlpPersistCategory,
  type QaNlpPersistStatus,
} from '../lib/qaNlpResult';
import { hostProcedure, publicProcedure, router } from '../trpc';
import { assertParticipantCapability } from '../lib/participantAuth';
import { recordQaQuestionAccepted, recordQaRatingChanged } from '../lib/qaTelemetry';
import {
  emitQaQuestionsSignal,
  getQaQuestionsSignalVersion,
  QA_QUESTIONS_HOST_SIGNAL_WAIT_MS,
  QA_QUESTIONS_SIGNAL_WAIT_MS,
  qaSubscriptionWaitMs,
  waitForQaQuestionsSignal,
} from '../lib/qaQuestionsSignal';
import { zAsyncIterable } from '../lib/zAsyncIterable';

const QA_WILSON_Z = 1.96;
const QA_WILSON_Z_SQUARED = QA_WILSON_Z * QA_WILSON_Z;
/** Prisma/pg leitet uncastete Zahlen neben INT-Spalten als integer ab; 1,96² ist 3,8416. */
const QA_WILSON_Z_SQL = Prisma.sql`${QA_WILSON_Z}::DOUBLE PRECISION`;
const QA_WILSON_Z_SQUARED_SQL = Prisma.sql`${QA_WILSON_Z_SQUARED}::DOUBLE PRECISION`;

type QaQuestionVoteRecord = {
  participantId?: string;
  direction?: string | null;
};

type QaQuestionRecord = {
  id: string;
  text: string;
  upvoteCount: number;
  status: 'PENDING' | 'ACTIVE' | 'PINNED' | 'ARCHIVED' | 'DELETED';
  createdAt: Date;
  participantId: string;
  nlpStatus?: QaNlpPersistStatus | null;
  nlpCategory?: QaNlpPersistCategory | null;
  nlpConfidence?: number | null;
  nlpModelVersion?: string | null;
  nlpAnalyzedAt?: Date | null;
  participant?: {
    nickname?: string | null;
  } | null;
  upvotes?: QaQuestionVoteRecord[];
};

type QaQuestionVoteStats = {
  score: number;
  positiveVoteCount?: number;
  negativeVoteCount?: number;
  voteCount?: number;
  bestScore?: number;
  controversyScore?: number;
  isControversial?: boolean;
};

type QaQuestionSortMode = z.infer<typeof GetQaQuestionsInputSchema>['sort'];

type QaSessionLifecycleGate = {
  status?: string | null;
  endedAt?: Date | null;
  expiresAt?: Date | null;
  sessionLifecycleRevision?: number | null;
  qaClosesAt?: Date | null;
};

function isQaSessionEffectivelyFinished(
  session: QaSessionLifecycleGate | null | undefined,
): boolean {
  return (
    !!session &&
    isSessionEffectivelyFinished(
      {
        status: session.status ?? '',
        endedAt: session.endedAt,
        expiresAt: session.expiresAt,
      },
      new Date(),
    )
  );
}

function buildQaQuestionsSnapshot(
  session: QaSessionLifecycleGate,
  questions: z.infer<typeof QaQuestionDTOSchema>[],
  state: z.infer<typeof QaQuestionsListDTOSchema>['state'],
  now = new Date(),
  page: Pick<
    z.infer<typeof QaQuestionsListDTOSchema>,
    | 'rankingRevision'
    | 'nextCursor'
    | 'totalCount'
    | 'sessionQuestionCount'
    | 'sessionRemaining'
    | 'quota'
  > = {},
) {
  const expiresAt =
    session.expiresAt instanceof Date
      ? session.expiresAt
      : new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const retention = buildSessionRetentionTimeline({ ...session, expiresAt }, now);
  return {
    questions,
    state,
    sessionLifecycleRevision: session.sessionLifecycleRevision ?? 0,
    serverNow: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    qaClosesAt: session.qaClosesAt?.toISOString() ?? null,
    endedAt: retention.endedAt?.toISOString() ?? null,
    postProcessingEndsAt: retention.postProcessingEndsAt?.toISOString() ?? null,
    ...page,
  };
}

function buildQaQuestionsInvalidation(
  session: QaSessionLifecycleGate & {
    qaRankingRevision?: number | null;
    participantRevision?: number | null;
  },
  state: z.infer<typeof QaQuestionsListDTOSchema>['state'],
  now = new Date(),
) {
  const expiresAt =
    session.expiresAt instanceof Date
      ? session.expiresAt
      : new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const retention = buildSessionRetentionTimeline({ ...session, expiresAt }, now);
  return QaQuestionsInvalidationDTOSchema.parse({
    kind: 'INVALIDATED',
    state,
    sessionLifecycleRevision: session.sessionLifecycleRevision ?? 0,
    rankingRevision: session.qaRankingRevision ?? 0,
    participantRevision: session.participantRevision ?? 0,
    serverNow: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    qaClosesAt: session.qaClosesAt?.toISOString() ?? null,
    endedAt: retention.endedAt?.toISOString() ?? null,
    postProcessingEndsAt: retention.postProcessingEndsAt?.toISOString() ?? null,
  });
}

/** Schreibende Q&A-Aktionen nach effektivem Session-Ende blockieren. */
function assertQaSessionOpenForParticipants(
  session: QaSessionLifecycleGate | null | undefined,
): void {
  if (isQaSessionEffectivelyFinished(session)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Die Session ist beendet. Fragen und Bewertungen sind nicht mehr möglich.',
    });
  }
}

function assertQaHostContentReadAllowed(
  session: QaSessionLifecycleGate & { expiresAt: Date },
  now = new Date(),
): void {
  if (
    isSessionEffectivelyFinished(
      {
        status: session.status ?? '',
        endedAt: session.endedAt,
        expiresAt: session.expiresAt,
      },
      now,
    ) &&
    !buildSessionRetentionTimeline(session, now).hostPostProcessingAccessAllowed
  ) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Die Host-Nachbereitung dieser Session ist beendet.',
    });
  }
}

function isQaEnabled(session: { type: string; qaEnabled?: boolean | null }): boolean {
  return session.type === 'Q_AND_A' || session.qaEnabled === true;
}

function rethrowQaContributionError(error: unknown): never {
  if (String(error).includes('ARSNOVA_SESSION_ENDED')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Die Session ist beendet.',
      cause: error,
    });
  }
  if (String(error).includes('ARSNOVA_QA_CLOSED')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Der Q&A-Kanal ist aktuell geschlossen.',
      cause: error,
    });
  }
  if (String(error).includes('ARSNOVA_QA_PARTICIPANT_LIMIT')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Du kannst pro Session maximal ${QA_MAX_QUESTIONS_PER_PARTICIPANT} Fragen einreichen.`,
      cause: error,
    });
  }
  if (String(error).includes('ARSNOVA_QA_SESSION_LIMIT')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Diese Session hat das Kontingent von ${QA_MAX_QUESTIONS_PER_SESSION} Fragen erreicht.`,
      cause: error,
    });
  }
  if (String(error).includes('ARSNOVA_PARTICIPANT_NOT_FOUND')) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Teilnahme zur Session nicht gefunden.',
      cause: error,
    });
  }
  if (String(error).includes('ARSNOVA_SESSION_NOT_FOUND')) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Session nicht gefunden.',
      cause: error,
    });
  }
  if (String(error).includes('ARSNOVA_QA_QUESTION_NOT_FOUND')) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.', cause: error });
  }
  if (String(error).includes('ARSNOVA_QA_QUESTION_NOT_VOTABLE')) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Diese Frage kann aktuell nicht bewertet werden.',
      cause: error,
    });
  }
  if (String(error).includes('ARSNOVA_QA_OWN_QUESTION')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Du kannst deine eigene Frage nicht bewerten.',
      cause: error,
    });
  }
  throw error;
}

type QaVoteMutationRow = {
  questionId: string;
  myVote: 'UP' | 'DOWN' | null;
  upvoteCount: number;
  changed: boolean;
};

async function changeQaVote(
  questionId: string,
  participantId: string,
  direction: 'UP' | 'DOWN',
): Promise<QaVoteMutationRow> {
  try {
    const rows = await prisma.$queryRaw<QaVoteMutationRow[]>`
      SELECT *
      FROM arsnova_change_qa_vote(
        ${questionId},
        ${participantId},
        ${direction}::"QaVoteDirection"
      )
    `;
    const result = rows[0];
    if (!result) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Die Bewertung konnte nicht bestätigt werden.',
      });
    }
    return result;
  } catch (error) {
    rethrowQaContributionError(error);
  }
}

function shouldAttachQaNlp(includeNlp: boolean, question: QaQuestionRecord): boolean {
  if (!includeNlp) {
    return false;
  }
  if (isQaNlpEnabled()) {
    return true;
  }
  return (
    question.nlpStatus !== undefined &&
    question.nlpStatus !== null &&
    question.nlpStatus !== 'DISABLED'
  );
}

function mapQaQuestion(
  question: QaQuestionRecord,
  participantId?: string,
  voteStats?: QaQuestionVoteStats,
  includeVoteMetrics = false,
  includeNlp = false,
) {
  const myUpvote = participantId
    ? (question.upvotes ?? []).find((v) => v.participantId === participantId)
    : undefined;
  return QaQuestionDTOSchema.parse({
    id: question.id,
    text: question.text,
    upvoteCount: question.upvoteCount,
    ...(includeVoteMetrics
      ? {
          score: voteStats?.score ?? question.upvoteCount,
        }
      : {}),
    ...(includeVoteMetrics && voteStats?.positiveVoteCount !== undefined
      ? { positiveVoteCount: voteStats.positiveVoteCount }
      : {}),
    ...(includeVoteMetrics && voteStats?.negativeVoteCount !== undefined
      ? { negativeVoteCount: voteStats.negativeVoteCount }
      : {}),
    ...(includeVoteMetrics && voteStats?.voteCount !== undefined
      ? { voteCount: voteStats.voteCount }
      : {}),
    ...(includeVoteMetrics && voteStats?.bestScore !== undefined
      ? { bestScore: voteStats.bestScore }
      : {}),
    ...(includeVoteMetrics && voteStats?.controversyScore !== undefined
      ? { controversyScore: voteStats.controversyScore }
      : {}),
    ...(includeVoteMetrics && voteStats?.isControversial !== undefined
      ? { isControversial: voteStats.isControversial }
      : {}),
    status: question.status,
    createdAt:
      question.createdAt instanceof Date
        ? question.createdAt.toISOString()
        : new Date(question.createdAt).toISOString(),
    ...(question.participant?.nickname ? { authorNickname: question.participant.nickname } : {}),
    myVote: myUpvote ? (myUpvote.direction === 'DOWN' ? 'DOWN' : 'UP') : null,
    isOwn: !!participantId && question.participantId === participantId,
    hasUpvoted: !!myUpvote && myUpvote.direction !== 'DOWN',
    ...(shouldAttachQaNlp(includeNlp, question) ? { nlp: mapStoredQaNlpResult(question) } : {}),
  });
}

type QaPageCursor = {
  v: 1;
  revision: string;
  offset: number;
  sort: QaQuestionSortMode;
  search: string;
  author: string;
  statuses: string;
};

type RankedQaQuestionRow = QaQuestionRecord & {
  authorNickname: string | null;
  myVote: 'UP' | 'DOWN' | null;
  positiveVoteCount: number;
  negativeVoteCount: number;
  bestScore: number;
  controversyScore: number;
  totalCount: bigint | number;
};

type RankedQaPage = {
  questions: z.infer<typeof QaQuestionDTOSchema>[];
  nextCursor: string | null;
  totalCount: number;
};

const QA_PAGE_CACHE_TTL_MS = 2_000;
const QA_PAGE_CACHE_MAX_ENTRIES = 256;
type SharedQaRankingCacheEntry = {
  expiresAt: number;
  promise: Promise<RankedQaQuestionRow[]>;
};
const sharedQaRankingLoads = new Map<string, SharedQaRankingCacheEntry>();

function pruneSharedQaRankingCache(nowMs: number): void {
  for (const [key, entry] of sharedQaRankingLoads) {
    if (entry.expiresAt <= nowMs) {
      sharedQaRankingLoads.delete(key);
    }
  }
  while (sharedQaRankingLoads.size >= QA_PAGE_CACHE_MAX_ENTRIES) {
    const oldestKey = sharedQaRankingLoads.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    sharedQaRankingLoads.delete(oldestKey);
  }
}

export function resetSharedQaRankingCacheForTests(): void {
  sharedQaRankingLoads.clear();
}
type QaOwnVoteLoad = {
  participantId: string;
  questionIds: string[];
  resolve: (votes: Map<string, 'UP' | 'DOWN'>) => void;
  reject: (error: unknown) => void;
};
let pendingQaOwnVoteLoads: QaOwnVoteLoad[] = [];
let qaOwnVoteFlushScheduled = false;

async function flushQaOwnVoteLoads(): Promise<void> {
  qaOwnVoteFlushScheduled = false;
  const loads = pendingQaOwnVoteLoads;
  pendingQaOwnVoteLoads = [];
  if (loads.length === 0) return;

  try {
    const participantIds = [...new Set(loads.map((load) => load.participantId))];
    const questionIds = [...new Set(loads.flatMap((load) => load.questionIds))];
    const votes = await prisma.qaUpvote.findMany({
      where: {
        participantId: { in: participantIds },
        qaQuestionId: { in: questionIds },
      },
      select: { participantId: true, qaQuestionId: true, direction: true },
    });
    const votesByParticipant = new Map<string, Map<string, 'UP' | 'DOWN'>>();
    for (const vote of votes) {
      let participantVotes = votesByParticipant.get(vote.participantId);
      if (!participantVotes) {
        participantVotes = new Map();
        votesByParticipant.set(vote.participantId, participantVotes);
      }
      participantVotes.set(vote.qaQuestionId, vote.direction);
    }
    for (const load of loads) {
      const participantVotes = votesByParticipant.get(load.participantId);
      load.resolve(
        new Map(
          load.questionIds.flatMap((questionId) => {
            const direction = participantVotes?.get(questionId);
            return direction ? [[questionId, direction] as const] : [];
          }),
        ),
      );
    }
  } catch (error) {
    for (const load of loads) load.reject(error);
  }
}

function loadQaOwnVotes(
  participantId: string,
  questionIds: string[],
): Promise<Map<string, 'UP' | 'DOWN'>> {
  return new Promise((resolve, reject) => {
    pendingQaOwnVoteLoads.push({ participantId, questionIds, resolve, reject });
    if (!qaOwnVoteFlushScheduled) {
      qaOwnVoteFlushScheduled = true;
      queueMicrotask(() => void flushQaOwnVoteLoads());
    }
  });
}

function encodeQaPageCursor(cursor: QaPageCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeQaPageCursor(value: string): QaPageCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as QaPageCursor;
    if (
      parsed.v !== 1 ||
      !Number.isInteger(parsed.offset) ||
      parsed.offset < 0 ||
      parsed.offset > QA_MAX_QUESTIONS_PER_SESSION ||
      !['TOP', 'BEST', 'CONTROVERSIAL', 'TIME'].includes(parsed.sort) ||
      typeof parsed.revision !== 'string' ||
      typeof parsed.search !== 'string' ||
      typeof parsed.statuses !== 'string'
    ) {
      throw new Error('invalid cursor');
    }
    return {
      ...parsed,
      author: typeof parsed.author === 'string' ? parsed.author : '',
    };
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Der Q&A-Seitenzeiger ist ungültig.',
    });
  }
}

async function buildQaQuestionPayloadFromDb(options: {
  sessionId: string;
  participantId?: string;
  moderatorView?: boolean;
  sortMode: QaQuestionSortMode;
  participantCountForControversy?: number;
  includeAuthorNickname?: boolean;
  pageSize: number;
  cursor?: string;
  search?: string;
  authorNickname?: string;
  statuses?: Array<QaQuestionRecord['status']>;
  rankingRevision: string;
  totalCountHint?: number;
}): Promise<RankedQaPage> {
  const search = options.search?.trim() ?? '';
  const authorNickname = options.authorNickname?.trim() ?? '';
  const statusesKey = options.statuses?.slice().sort().join(',') ?? '';
  const cursor = options.cursor ? decodeQaPageCursor(options.cursor) : null;
  if (
    cursor &&
    (cursor.revision !== options.rankingRevision ||
      cursor.sort !== options.sortMode ||
      cursor.search !== search ||
      cursor.author !== authorNickname ||
      cursor.statuses !== statusesKey)
  ) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Die Q&A-Rangliste hat sich geändert. Lade sie bitte neu.',
    });
  }
  const offset = cursor?.offset ?? 0;
  const moderatorView = options.moderatorView === true;
  const participantCount = options.participantCountForControversy ?? 0;
  const controversyThreshold = Math.max(1, participantCount * 0.1);
  const controversyThresholdSql = Prisma.sql`${controversyThreshold}::DOUBLE PRECISION`;
  const canSharePublicRanking =
    !moderatorView &&
    options.participantId !== undefined &&
    options.totalCountHint !== undefined &&
    search.length === 0 &&
    authorNickname.length === 0 &&
    statusesKey.length === 0;
  const ownPendingCount =
    canSharePublicRanking && options.participantId
      ? await prisma.qaQuestion.count({
          where: {
            sessionId: options.sessionId,
            participantId: options.participantId,
            status: 'PENDING',
          },
        })
      : 0;
  const shareRankingLoad = canSharePublicRanking && ownPendingCount === 0;
  const visibility = moderatorView
    ? Prisma.empty
    : options.participantId && !shareRankingLoad
      ? Prisma.sql`AND (
          question."status" IN ('ACTIVE', 'PINNED', 'ARCHIVED')
          OR (
            question."status" = 'PENDING'
            AND question."participantId" = ${options.participantId}
          )
        )`
      : Prisma.sql`AND question."status" IN ('ACTIVE', 'PINNED', 'ARCHIVED')`;
  const statusFilter =
    moderatorView && options.statuses && options.statuses.length > 0
      ? Prisma.sql`AND question."status"::TEXT IN (${Prisma.join(options.statuses)})`
      : Prisma.empty;
  const searchFilter = search
    ? Prisma.sql`AND question."text" ILIKE ${`%${search}%`}`
    : Prisma.empty;
  const authorFilter = authorNickname
    ? Prisma.sql`AND EXISTS (
        SELECT 1
        FROM "Participant" AS author
        WHERE author."id" = question."participantId"
          AND author."sessionId" = question."sessionId"
          AND author."nickname" = ${authorNickname}
      )`
    : Prisma.empty;
  const myVoteJoin =
    options.participantId && !shareRankingLoad
      ? Prisma.sql`
        LEFT JOIN "QaUpvote" AS own_vote
          ON own_vote."qaQuestionId" = question."id"
          AND own_vote."participantId" = ${options.participantId}
      `
      : Prisma.empty;
  const myVoteSelect =
    options.participantId && !shareRankingLoad
      ? Prisma.sql`own_vote."direction"`
      : Prisma.sql`NULL::"QaVoteDirection"`;
  const metricFirstRanking =
    moderatorView ||
    options.sortMode === 'BEST' ||
    options.sortMode === 'CONTROVERSIAL' ||
    options.sortMode === 'TIME';
  const statusBucket = metricFirstRanking
    ? Prisma.sql`CASE question."status"
        WHEN 'PINNED' THEN 0
        WHEN 'ACTIVE' THEN 0
        WHEN 'PENDING' THEN 1
        WHEN 'ARCHIVED' THEN 2
        ELSE 3
      END`
    : Prisma.sql`CASE question."status"
        WHEN 'PINNED' THEN 0
        WHEN 'ACTIVE' THEN 1
        WHEN 'PENDING' THEN 2
        WHEN 'ARCHIVED' THEN 3
        ELSE 4
      END`;
  const modeOrder =
    options.sortMode === 'BEST'
      ? Prisma.sql`ranked."bestScore" DESC, ranked."positiveVoteCount" DESC, ranked."upvoteCount" DESC,`
      : options.sortMode === 'CONTROVERSIAL'
        ? Prisma.sql`ranked."controversyScore" DESC, ranked."positiveVoteCount" DESC, ranked."upvoteCount" DESC,`
        : options.sortMode === 'TIME'
          ? Prisma.sql`ranked."createdAt" DESC,`
          : Prisma.sql`ranked."upvoteCount" DESC,`;
  const pageModeOrder =
    options.sortMode === 'BEST'
      ? Prisma.sql`page."bestScore" DESC, page."positiveVoteCount" DESC, page."upvoteCount" DESC,`
      : options.sortMode === 'CONTROVERSIAL'
        ? Prisma.sql`page."controversyScore" DESC, page."positiveVoteCount" DESC, page."upvoteCount" DESC,`
        : options.sortMode === 'TIME'
          ? Prisma.sql`page."createdAt" DESC,`
          : Prisma.sql`page."upvoteCount" DESC,`;
  const createdAtTie =
    options.sortMode === 'TIME' ? Prisma.empty : Prisma.sql`ranked."createdAt" ASC,`;
  const pageCreatedAtTie =
    options.sortMode === 'TIME' ? Prisma.empty : Prisma.sql`page."createdAt" ASC,`;
  const totalCountSelect =
    options.totalCountHint === undefined
      ? Prisma.sql`COUNT(*) OVER() AS "totalCount"`
      : Prisma.sql`${options.totalCountHint}::BIGINT AS "totalCount"`;
  const needsScoreMetrics =
    moderatorView || options.sortMode === 'BEST' || options.sortMode === 'CONTROVERSIAL';
  const scoreSelect = needsScoreMetrics
    ? Prisma.sql`
        CASE
          WHEN question."positiveVoteCount" + question."negativeVoteCount" = 0 THEN 0
          ELSE GREATEST(
            0,
            LEAST(
              1,
              (
                question."positiveVoteCount"::DOUBLE PRECISION
                  / (question."positiveVoteCount" + question."negativeVoteCount")
                + ${QA_WILSON_Z_SQUARED_SQL}
                  / (2 * (question."positiveVoteCount" + question."negativeVoteCount"))
                - ${QA_WILSON_Z_SQL} * SQRT(
                  (
                    (
                      question."positiveVoteCount"::DOUBLE PRECISION
                        / (question."positiveVoteCount" + question."negativeVoteCount")
                    ) * (
                      1 - question."positiveVoteCount"::DOUBLE PRECISION
                        / (question."positiveVoteCount" + question."negativeVoteCount")
                    )
                  ) / (question."positiveVoteCount" + question."negativeVoteCount")
                  + ${QA_WILSON_Z_SQUARED_SQL}
                    / (
                      4 * POWER(
                        question."positiveVoteCount" + question."negativeVoteCount",
                        2
                      )
                    )
                )
              ) / (
                1 + ${QA_WILSON_Z_SQUARED_SQL}
                  / (question."positiveVoteCount" + question."negativeVoteCount")
              )
            )
          )
        END AS "bestScore",
        CASE
          WHEN question."positiveVoteCount" + question."negativeVoteCount" = 0 THEN 0
          ELSE LEAST(
            1,
            2 * LEAST(question."positiveVoteCount", question."negativeVoteCount")
              / (
                question."positiveVoteCount"
                + question."negativeVoteCount"
                + ${controversyThresholdSql}
              )
          )
        END AS "controversyScore"
      `
    : Prisma.sql`
        0::DOUBLE PRECISION AS "bestScore",
        0::DOUBLE PRECISION AS "controversyScore"
      `;

  const loadRows = () => prisma.$queryRaw<RankedQaQuestionRow[]>`
    WITH scored AS (
      SELECT
        question."id",
        question."upvoteCount",
        question."positiveVoteCount",
        question."negativeVoteCount",
        question."status",
        question."createdAt",
        ${statusBucket} AS status_bucket,
        CASE question."status"
          WHEN 'PINNED' THEN 0
          WHEN 'ACTIVE' THEN 1
          WHEN 'PENDING' THEN 2
          WHEN 'ARCHIVED' THEN 3
          ELSE 4
        END AS status_tie,
        ${scoreSelect}
      FROM "QaQuestion" AS question
      WHERE question."sessionId" = ${options.sessionId}
      ${visibility}
      ${statusFilter}
      ${searchFilter}
      ${authorFilter}
    ),
    ranked AS (
      SELECT scored.*, ${totalCountSelect}
      FROM scored
    ),
    page AS (
      SELECT *
      FROM ranked
      ORDER BY
        ranked.status_bucket ASC,
        ${modeOrder}
        ranked.status_tie ASC,
        ${createdAtTie}
        ranked."id" ASC
      LIMIT ${options.pageSize + 1}
      OFFSET ${offset}
    )
    SELECT
      question.*,
      participant."nickname" AS "authorNickname",
      ${myVoteSelect} AS "myVote",
      page.status_bucket,
      page.status_tie,
      page."bestScore",
      page."controversyScore",
      page."totalCount"
    FROM page
    INNER JOIN "QaQuestion" AS question
      ON question."id" = page."id"
    LEFT JOIN "Participant" AS participant
      ON participant."id" = question."participantId"
    ${myVoteJoin}
    ORDER BY
      page.status_bucket ASC,
      ${pageModeOrder}
      page.status_tie ASC,
      ${pageCreatedAtTie}
      page."id" ASC
  `;
  const sharedLoadKey = shareRankingLoad
    ? [
        options.sessionId,
        options.rankingRevision,
        options.sortMode,
        options.pageSize,
        offset,
        options.includeAuthorNickname === true ? 1 : 0,
      ].join(':')
    : null;
  const nowMs = Date.now();
  const cached = sharedLoadKey ? sharedQaRankingLoads.get(sharedLoadKey) : undefined;
  let rowsPromise = cached && cached.expiresAt > nowMs ? cached.promise : undefined;
  if (!rowsPromise) {
    const loadPromise = loadRows();
    if (sharedLoadKey) {
      pruneSharedQaRankingCache(nowMs);
      const entry: SharedQaRankingCacheEntry = {
        expiresAt: Number.POSITIVE_INFINITY,
        promise: loadPromise,
      };
      entry.promise = loadPromise.then(
        (rows) => {
          if (sharedQaRankingLoads.get(sharedLoadKey) === entry) {
            entry.expiresAt = Date.now() + QA_PAGE_CACHE_TTL_MS;
          }
          return rows;
        },
        (error: unknown) => {
          if (sharedQaRankingLoads.get(sharedLoadKey) === entry) {
            sharedQaRankingLoads.delete(sharedLoadKey);
          }
          throw error;
        },
      );
      sharedQaRankingLoads.set(sharedLoadKey, entry);
      rowsPromise = entry.promise;
    } else {
      rowsPromise = loadPromise;
    }
  }
  let rows = await rowsPromise;
  if (shareRankingLoad && options.participantId && rows.length > 0) {
    const ownVoteByQuestionId = await loadQaOwnVotes(
      options.participantId,
      rows.map((row) => row.id),
    );
    rows = rows.map((row) => ({
      ...row,
      myVote: ownVoteByQuestionId.get(row.id) ?? null,
    }));
  }

  const hasNextPage = rows.length > options.pageSize;
  const pageRows = rows.slice(0, options.pageSize);
  const totalCount = Number(pageRows[0]?.totalCount ?? 0);
  const questions = pageRows.map((row) => {
    const positiveVoteCount = Number(row.positiveVoteCount);
    const negativeVoteCount = Number(row.negativeVoteCount);
    const voteCount = positiveVoteCount + negativeVoteCount;
    const bestScore = Number(row.bestScore);
    const controversyScore = Number(row.controversyScore);
    return mapQaQuestion(
      {
        ...row,
        upvoteCount: Number(row.upvoteCount),
        participant:
          options.includeAuthorNickname && row.authorNickname
            ? { nickname: row.authorNickname }
            : undefined,
        upvotes:
          options.participantId && row.myVote
            ? [{ participantId: options.participantId, direction: row.myVote }]
            : [],
      },
      options.participantId,
      {
        score: Number(row.upvoteCount),
        positiveVoteCount,
        negativeVoteCount,
        voteCount,
        bestScore,
        controversyScore,
        isControversial: controversyScore > 0.5 && voteCount >= Math.max(1, controversyThreshold),
      },
      moderatorView,
      moderatorView,
    );
  });

  return {
    questions,
    totalCount,
    nextCursor: hasNextPage
      ? encodeQaPageCursor({
          v: 1,
          revision: options.rankingRevision,
          offset: offset + options.pageSize,
          sort: options.sortMode,
          search,
          author: authorNickname,
          statuses: statusesKey,
        })
      : null,
  };
}

export const qaRouter = router({
  list: publicProcedure
    .input(GetQaQuestionsInputSchema)
    .output(QaQuestionsListDTOSchema)
    .query(async ({ input, ctx }) => {
      const sortMode = input.sort;
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: {
          id: true,
          code: true,
          status: true,
          endedAt: true,
          expiresAt: true,
          type: true,
          qaEnabled: true,
          qaOpen: true,
          qaClosesAt: true,
          sessionLifecycleRevision: true,
          qaRankingRevision: true,
          qaQuestionCount: true,
          qaModerationMode: true,
          onboardingAnonymousMode: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const serverNow = new Date();
      let contentState: z.infer<typeof QaQuestionsListDTOSchema>['state'] = 'ACTIVE';
      if (input.moderatorView) {
        await assertHostSessionAccessFromContext(ctx, session.code);
        const retention = buildSessionRetentionTimeline(session, serverNow);
        if (
          isSessionEffectivelyFinished(session, serverNow) &&
          !retention.hostPostProcessingAccessAllowed
        ) {
          return buildQaQuestionsSnapshot(session, [], 'POST_PROCESSING_ENDED', serverNow);
        }
      } else {
        if (!input.participantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Teilnahme-Capability erforderlich.',
          });
        }
        await assertParticipantCapability({
          ctx,
          sessionId: session.id,
          participantId: input.participantId,
        });
        if (isSessionEffectivelyFinished(session, serverNow)) {
          return buildQaQuestionsSnapshot(session, [], 'SESSION_ENDED', serverNow);
        }
        if (session.qaClosesAt === null) {
          return buildQaQuestionsSnapshot(session, [], 'UNCONFIGURED', serverNow);
        }
        contentState =
          serverNow >= session.qaClosesAt
            ? 'DEADLINE_EXPIRED'
            : session.qaOpen === false
              ? 'CHANNEL_CLOSED'
              : 'ACTIVE';
      }
      if (!isQaEnabled(session)) {
        return buildQaQuestionsSnapshot(session, [], 'CHANNEL_CLOSED', serverNow);
      }
      if (!input.moderatorView && contentState !== 'ACTIVE') {
        return buildQaQuestionsSnapshot(session, [], contentState, serverNow);
      }

      const participantCountForControversy =
        input.moderatorView === true || sortMode === 'CONTROVERSIAL'
          ? await prisma.participant.count({
              where: { sessionId: session.id },
            })
          : undefined;
      const includeAuthorNickname = session.onboardingAnonymousMode !== true;
      const authorNickname = input.moderatorView
        ? input.authorNickname?.trim() || undefined
        : undefined;
      const rankingRevision = `${session.qaRankingRevision}:${sortMode}:${
        sortMode === 'CONTROVERSIAL' ? (participantCountForControversy ?? 0) : ''
      }`;
      const [page, participantQuestionCount] = await Promise.all([
        buildQaQuestionPayloadFromDb({
          sessionId: session.id,
          participantId: input.participantId,
          moderatorView: input.moderatorView,
          sortMode,
          participantCountForControversy,
          includeAuthorNickname,
          pageSize: input.pageSize,
          cursor: input.cursor,
          search: input.search,
          authorNickname,
          statuses: input.statuses,
          rankingRevision,
          totalCountHint:
            !input.search?.trim() &&
            !authorNickname &&
            (!input.statuses || input.statuses.length === 0) &&
            (input.moderatorView === true || session.qaModerationMode === false)
              ? session.qaQuestionCount
              : undefined,
        }),
        input.participantId
          ? prisma.qaQuestion.count({
              where: { sessionId: session.id, participantId: input.participantId },
            })
          : Promise.resolve(0),
      ]);
      const [currentRevision, currentParticipantCount] = await Promise.all([
        prisma.session.findUnique({
          where: { id: session.id },
          select: { qaRankingRevision: true },
        }),
        sortMode === 'CONTROVERSIAL'
          ? prisma.participant.count({ where: { sessionId: session.id } })
          : Promise.resolve(participantCountForControversy),
      ]);
      if (
        currentRevision?.qaRankingRevision !== session.qaRankingRevision ||
        currentParticipantCount !== participantCountForControversy
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Die Q&A-Rangliste hat sich geändert. Lade sie bitte neu.',
        });
      }
      const quota = input.participantId
        ? {
            participantQuestionCount,
            participantRemaining: Math.max(
              0,
              QA_MAX_QUESTIONS_PER_PARTICIPANT - participantQuestionCount,
            ),
            sessionQuestionCount: session.qaQuestionCount,
            sessionRemaining: Math.max(0, QA_MAX_QUESTIONS_PER_SESSION - session.qaQuestionCount),
          }
        : undefined;
      return buildQaQuestionsSnapshot(session, page.questions, contentState, serverNow, {
        rankingRevision,
        nextCursor: page.nextCursor,
        totalCount: page.totalCount,
        sessionQuestionCount: session.qaQuestionCount,
        sessionRemaining: Math.max(0, QA_MAX_QUESTIONS_PER_SESSION - session.qaQuestionCount),
        quota,
      });
    }),

  presentProjection: publicProcedure
    .input(GetQaPresentProjectionInputSchema)
    .output(QaQuestionsListDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: {
          id: true,
          status: true,
          endedAt: true,
          expiresAt: true,
          type: true,
          qaEnabled: true,
          qaOpen: true,
          qaClosesAt: true,
          sessionLifecycleRevision: true,
          qaRankingRevision: true,
          qaQuestionCount: true,
          qaModerationMode: true,
          onboardingAnonymousMode: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const serverNow = new Date();
      if (isSessionEffectivelyFinished(session, serverNow)) {
        return buildQaQuestionsSnapshot(session, [], 'SESSION_ENDED', serverNow);
      }
      if (!isQaEnabled(session)) {
        return buildQaQuestionsSnapshot(session, [], 'CHANNEL_CLOSED', serverNow);
      }
      if (session.qaClosesAt === null) {
        return buildQaQuestionsSnapshot(session, [], 'UNCONFIGURED', serverNow);
      }
      const state =
        serverNow >= session.qaClosesAt
          ? 'DEADLINE_EXPIRED'
          : session.qaOpen === false
            ? 'CHANNEL_CLOSED'
            : 'ACTIVE';
      const rankingRevision = `${session.qaRankingRevision}:`;
      const page = await buildQaQuestionPayloadFromDb({
        sessionId: session.id,
        moderatorView: false,
        sortMode: 'TOP',
        includeAuthorNickname: session.onboardingAnonymousMode !== true,
        pageSize: 100,
        rankingRevision,
        totalCountHint: session.qaModerationMode === false ? session.qaQuestionCount : undefined,
      });
      return buildQaQuestionsSnapshot(session, page.questions, state, serverNow, {
        rankingRevision,
        nextCursor: page.nextCursor,
        totalCount: page.totalCount,
      });
    }),

  nlpRuntime: publicProcedure
    .input(GetQaNlpRuntimeInputSchema)
    .output(QaNlpRuntimeDTOSchema)
    .query(async ({ input, ctx }) => {
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: { id: true, code: true, status: true, endedAt: true, expiresAt: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      await assertHostSessionAccessFromContext(ctx, session.code);
      assertQaHostContentReadAllowed(session);
      const metrics = getQaNlpMetrics();
      return {
        enabled: isQaNlpEnabled(),
        metrics: {
          queueLength: metrics.queueLength,
          lastLatencyMs: metrics.lastLatencyMs,
          completed: metrics.completed,
          failed: metrics.failed,
          skipped: metrics.skipped,
          earlyExit: metrics.earlyExit,
          fallback: metrics.fallback,
          unclassified: metrics.unclassified,
          earlyExitRate: metrics.earlyExitRate,
          fallbackRate: metrics.fallbackRate,
          unclassifiedRate: metrics.unclassifiedRate,
        },
      };
    }),

  summaryRuntime: publicProcedure
    .input(GetQaSummaryRuntimeInputSchema)
    .output(QaSummaryRuntimeDTOSchema)
    .query(async ({ input, ctx }) => {
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: { id: true, code: true, status: true, endedAt: true, expiresAt: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      await assertHostSessionAccessFromContext(ctx, session.code);
      assertQaHostContentReadAllowed(session);
      return getQaSummaryRuntime(input.sessionId);
    }),

  requestSummary: publicProcedure
    .input(RequestQaSummaryInputSchema)
    .output(QaSummaryRuntimeDTOSchema)
    .mutation(async ({ input, ctx }) => {
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: { id: true, code: true, status: true, endedAt: true, expiresAt: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      await assertHostSessionAccessFromContext(ctx, session.code);
      assertQaSessionOpenForParticipants(session);
      if (!isQaSummaryEnabled()) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Die Moderationszusammenfassung ist nicht aktiviert.',
        });
      }
      return requestQaSummary(input.sessionId, input.locale);
    }),

  moderate: hostProcedure
    .input(ModerateQaQuestionInputSchema)
    .output(QaQuestionDTOSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.sessionCode.toUpperCase() },
        select: {
          id: true,
          type: true,
          qaEnabled: true,
          qaClosesAt: true,
          status: true,
          endedAt: true,
          expiresAt: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (!isQaEnabled(session)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Fragen sind in dieser Session nicht aktiviert.',
        });
      }
      assertQaSessionOpenForParticipants(session);

      try {
        const moderated = await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT arsnova_lock_active_session(${session.id})`;
          const question = await tx.qaQuestion.findUnique({
            where: { id: input.questionId },
            select: {
              id: true,
              sessionId: true,
              text: true,
              upvoteCount: true,
              status: true,
              createdAt: true,
            },
          });
          if (!question || question.sessionId !== session.id) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
          }

          if (input.action === 'DELETE') {
            await tx.qaQuestion.delete({ where: { id: question.id } });
            return QaQuestionDTOSchema.parse({
              id: question.id,
              text: question.text,
              upvoteCount: question.upvoteCount,
              status: 'DELETED',
              createdAt: question.createdAt.toISOString(),
              myVote: null,
              isOwn: false,
              hasUpvoted: false,
            });
          }

          let nextStatus = question.status;
          switch (input.action) {
            case 'APPROVE':
            case 'UNPIN':
              nextStatus = 'ACTIVE';
              break;
            case 'PIN':
              nextStatus = 'PINNED';
              break;
            case 'ARCHIVE':
              nextStatus = 'ARCHIVED';
              break;
          }

          if (question.status === 'DELETED') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Gelöschte Fragen können nicht weiter moderiert werden.',
            });
          }

          const updated = await tx.qaQuestion.update({
            where: { id: question.id },
            data: { status: nextStatus },
            select: {
              id: true,
              text: true,
              upvoteCount: true,
              status: true,
              createdAt: true,
              participantId: true,
            },
          });
          return mapQaQuestion(updated);
        });
        emitQaQuestionsSignal(session.id, { immediate: true });
        return moderated;
      } catch (error) {
        if (String(error).includes('ARSNOVA_SESSION_ENDED')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Die Session ist beendet.',
            cause: error,
          });
        }
        throw error;
      }
    }),

  submit: publicProcedure
    .input(SubmitQaQuestionInputSchema)
    .output(SubmitQaQuestionOutputSchema)
    .mutation(async ({ input, ctx }) => {
      await assertParticipantCapability({
        ctx,
        sessionId: input.sessionId,
        participantId: input.participantId,
      });
      const nlpEnabled = isQaNlpEnabled();
      const idempotencyHash = createHash('sha256')
        .update(`${input.sessionId}:${input.participantId}:${input.idempotencyKey}`, 'utf8')
        .digest('hex');
      type CreateQaQuestionRow = {
        id: string;
        text: string;
        upvoteCount: number;
        status: 'PENDING' | 'ACTIVE' | 'PINNED' | 'ARCHIVED' | 'DELETED';
        createdAt: Date;
        replayed: boolean;
        participantQuestionCount: number;
        sessionQuestionCount: number;
      };
      let created: CreateQaQuestionRow;
      try {
        const rows = await prisma.$queryRaw<CreateQaQuestionRow[]>`
          SELECT *
          FROM arsnova_create_qa_question(
            ${input.sessionId},
            ${input.participantId},
            ${input.text.trim()},
            ${idempotencyHash}::CHAR(64),
            ${nlpEnabled ? 'PENDING' : 'DISABLED'}::"QaNlpStatus"
          )
        `;
        const row = rows[0];
        if (!row) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Die Frage konnte nicht bestätigt werden.',
          });
        }
        created = row;
      } catch (error) {
        rethrowQaContributionError(error);
      }

      if (nlpEnabled && !created.replayed) {
        enqueueQaNlpJob({
          sessionId: input.sessionId,
          questionId: created.id,
          text: created.text,
        });
      }
      if (!created.replayed) {
        void recordQaQuestionAccepted(created.id);
        emitQaQuestionsSignal(input.sessionId);
      }
      return {
        question: mapQaQuestion(
          { ...created, participantId: input.participantId },
          input.participantId,
        ),
        quota: {
          participantQuestionCount: created.participantQuestionCount,
          participantRemaining: Math.max(
            0,
            QA_MAX_QUESTIONS_PER_PARTICIPANT - created.participantQuestionCount,
          ),
          sessionQuestionCount: created.sessionQuestionCount,
          sessionRemaining: Math.max(
            0,
            QA_MAX_QUESTIONS_PER_SESSION - created.sessionQuestionCount,
          ),
        },
        replayed: created.replayed,
      };
    }),

  deleteOwn: publicProcedure
    .input(UpvoteQaQuestionInputSchema)
    .output(z.object({ deleted: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const question = await prisma.qaQuestion.findUnique({
        where: { id: input.questionId },
        select: { id: true, participantId: true, status: true, sessionId: true },
      });
      if (!question || question.status === 'DELETED') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }
      await assertParticipantCapability({
        ctx,
        sessionId: question.sessionId,
        participantId: input.participantId,
      });
      if (question.participantId !== input.participantId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Du kannst nur deine eigenen Fragen löschen.',
        });
      }
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT arsnova_lock_active_session(${question.sessionId})`;
          const updated = await tx.qaQuestion.updateMany({
            where: {
              id: input.questionId,
              participantId: input.participantId,
              status: { not: 'DELETED' },
            },
            data: { status: 'DELETED' },
          });
          if (updated.count !== 1) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
          }
        });
      } catch (error) {
        if (String(error).includes('ARSNOVA_SESSION_ENDED')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Die Session ist beendet.',
            cause: error,
          });
        }
        throw error;
      }
      emitQaQuestionsSignal(question.sessionId, { immediate: true });
      return { deleted: true };
    }),

  upvote: publicProcedure
    .input(UpvoteQaQuestionInputSchema)
    .output(ToggleQaUpvoteOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const question = await prisma.qaQuestion.findUnique({
        where: { id: input.questionId },
        select: { sessionId: true },
      });
      if (!question) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }
      await assertParticipantCapability({
        ctx,
        sessionId: question.sessionId,
        participantId: input.participantId,
      });
      const result = await changeQaVote(input.questionId, input.participantId, 'UP');
      if (result.changed) {
        void recordQaRatingChanged(randomUUID());
        emitQaQuestionsSignal(question.sessionId);
      }
      return {
        questionId: result.questionId,
        upvoted: result.myVote === 'UP',
        upvoteCount: result.upvoteCount,
      };
    }),

  vote: publicProcedure
    .input(QaVoteInputSchema)
    .output(QaVoteOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const question = await prisma.qaQuestion.findUnique({
        where: { id: input.questionId },
        select: { sessionId: true },
      });
      if (!question) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }
      await assertParticipantCapability({
        ctx,
        sessionId: question.sessionId,
        participantId: input.participantId,
      });
      const result = await changeQaVote(input.questionId, input.participantId, input.direction);
      if (result.changed) {
        void recordQaRatingChanged(randomUUID());
        emitQaQuestionsSignal(question.sessionId);
      }
      return {
        questionId: result.questionId,
        myVote: result.myVote,
        upvoteCount: result.upvoteCount,
      };
    }),

  toggleModeration: hostProcedure
    .input(ToggleQaModerationInputSchema)
    .output(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const session = await prisma.session.findFirst({
        where: { code: input.sessionCode.toUpperCase() },
        select: { id: true, status: true, endedAt: true, expiresAt: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      assertQaSessionOpenForParticipants(session);
      const updated = await prisma
        .$transaction(async (tx) => {
          await tx.$executeRaw`SELECT arsnova_lock_active_session(${session.id})`;
          return tx.session.update({
            where: { id: session.id },
            data: { qaModerationMode: input.enabled },
            select: { qaModerationMode: true },
          });
        })
        .catch(rethrowQaContributionError);
      emitQaQuestionsSignal(session.id, { immediate: true });
      return { enabled: updated.qaModerationMode };
    }),

  onQuestionsUpdated: publicProcedure
    .input(GetQaQuestionsInputSchema)
    .output(zAsyncIterable(QaQuestionsInvalidationDTOSchema))
    .subscription(async function* ({ input, ctx }) {
      let lastRevisionKey = '';
      const sortMode = input.sort;

      const gateSession = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: {
          id: true,
          code: true,
          status: true,
          endedAt: true,
          expiresAt: true,
          type: true,
          qaEnabled: true,
          qaOpen: true,
          qaClosesAt: true,
          sessionLifecycleRevision: true,
          qaRankingRevision: true,
          participantRevision: true,
        },
      });
      if (!gateSession) {
        return;
      }
      const gateNow = new Date();
      let hostToken: string | undefined;
      if (input.moderatorView) {
        hostToken = await assertHostSessionAccessFromContext(ctx, gateSession.code);
        const retention = buildSessionRetentionTimeline(gateSession, gateNow);
        if (
          isSessionEffectivelyFinished(gateSession, gateNow) &&
          !retention.hostPostProcessingAccessAllowed
        ) {
          yield buildQaQuestionsInvalidation(gateSession, 'POST_PROCESSING_ENDED', gateNow);
          return;
        }
      }
      if (!input.moderatorView) {
        if (!input.participantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Teilnahme-Capability erforderlich.',
          });
        }
        await assertParticipantCapability({
          ctx,
          sessionId: gateSession.id,
          participantId: input.participantId,
        });
        if (isSessionEffectivelyFinished(gateSession, gateNow)) {
          yield buildQaQuestionsInvalidation(gateSession, 'SESSION_ENDED', gateNow);
          return;
        }
      }
      if (!isQaEnabled(gateSession)) {
        yield buildQaQuestionsInvalidation(gateSession, 'CHANNEL_CLOSED', gateNow);
        return;
      }

      const waitForNextTick = async (
        session: {
          id: string;
          qaClosesAt?: Date | null;
        },
        currentVersion: number,
      ) => {
        const waitMs = qaSubscriptionWaitMs(
          input.moderatorView ? null : session.qaClosesAt,
          input.moderatorView ? QA_QUESTIONS_HOST_SIGNAL_WAIT_MS : QA_QUESTIONS_SIGNAL_WAIT_MS,
        );
        const sleeper = () => waitForQaQuestionsSignal(session.id, currentVersion, waitMs);
        if (input.moderatorView) {
          await waitWhileHostTokenValid(gateSession.code, hostToken, sleeper);
          return;
        }
        await sleeper();
      };

      while (true) {
        if (!input.moderatorView) {
          await assertParticipantCapability({
            ctx,
            sessionId: input.sessionId,
            participantId: input.participantId!,
          });
        }
        const session = await prisma.session.findUnique({
          where: { id: input.sessionId },
          select: {
            id: true,
            status: true,
            endedAt: true,
            expiresAt: true,
            type: true,
            qaEnabled: true,
            qaOpen: true,
            qaClosesAt: true,
            sessionLifecycleRevision: true,
            qaRankingRevision: true,
            participantRevision: true,
          },
        });
        if (!session) {
          return;
        }

        if (!isQaEnabled(session)) {
          yield buildQaQuestionsInvalidation(session, 'CHANNEL_CLOSED');
          return;
        }
        const snapshotNow = new Date();
        if (input.moderatorView) {
          const retention = buildSessionRetentionTimeline(session, snapshotNow);
          if (
            isSessionEffectivelyFinished(session, snapshotNow) &&
            !retention.hostPostProcessingAccessAllowed
          ) {
            yield buildQaQuestionsInvalidation(session, 'POST_PROCESSING_ENDED', snapshotNow);
            return;
          }
        } else if (isSessionEffectivelyFinished(session, snapshotNow)) {
          yield buildQaQuestionsInvalidation(session, 'SESSION_ENDED', snapshotNow);
          return;
        }

        const contentState: z.infer<typeof QaQuestionsListDTOSchema>['state'] =
          !input.moderatorView && session.qaClosesAt === null
            ? 'UNCONFIGURED'
            : !input.moderatorView && snapshotNow >= session.qaClosesAt!
              ? 'DEADLINE_EXPIRED'
              : !input.moderatorView && session.qaOpen === false
                ? 'CHANNEL_CLOSED'
                : 'ACTIVE';
        const signalVersion = getQaQuestionsSignalVersion(session.id);
        if (!input.moderatorView && contentState !== 'ACTIVE') {
          const revisionKey = `${contentState}:${session.sessionLifecycleRevision}:${session.qaRankingRevision}:${session.participantRevision}`;
          if (revisionKey !== lastRevisionKey) {
            lastRevisionKey = revisionKey;
            yield buildQaQuestionsInvalidation(session, contentState, snapshotNow);
          }
          await waitForNextTick(session, signalVersion);
          continue;
        }

        const revisionKey = `${contentState}:${session.sessionLifecycleRevision}:${
          session.qaRankingRevision
        }:${sortMode === 'CONTROVERSIAL' ? session.participantRevision : ''}`;
        if (revisionKey === lastRevisionKey) {
          await waitForNextTick(session, signalVersion);
          continue;
        }
        lastRevisionKey = revisionKey;
        yield buildQaQuestionsInvalidation(session, contentState, snapshotNow);

        await waitForNextTick(session, signalVersion);
      }
    }),
});
