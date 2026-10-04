import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import {
  MODERATION_QA_RANKING_SCORE_TOLERANCE,
  ModerationPromptLimitationSchema,
  ModerationPromptSourceSchema,
  ModerationQuestionsSectionSchema,
  ModerationTopicsSectionSchema,
  calculateModerationQaBestScoreV1,
  calculateModerationQaControversyScoreV1,
  type ModerationAnalysisDomainContextV1,
  type ModerationPromptQuestion,
  type ModerationPromptSource,
  type QaQuestionSortMode,
  type SessionStatus,
  type WordCloudWeightMetric,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { assertHostSessionAccessFromContext, type HostTokenContext } from './hostAuth';
import { resolveQaPresenterSortMode } from './qaPresenterSortMode';
import { buildQaRankingMetricOrderSql, buildQaRankingScoreSelectSql } from './qaRankingSql';
import {
  hashQaSemanticTopicMemberText,
  type QaSemanticTopicSnapshot,
} from './qaSemanticTopicSnapshot';
import { buildSessionRetentionTimeline, isSessionEffectivelyFinished } from './sessionLifecycle';
import { getWordCloudAnalysisCache, type WordCloudAnalysisCache } from './wordCloudAnalysisCache';
import { isWordCloudSemanticEnabled } from './wordCloudSemanticConfig';

const MODERATION_QA_CANDIDATE_LIMIT = 200;
const MODERATION_QA_TOPIC_LIMIT = 30;
const MODERATION_QA_TOPIC_MEMBER_LIMIT = 200;
const MODERATION_QA_TOPIC_SNAPSHOT_MEMBER_LIMIT = 500;
const MODERATION_QA_SOURCE_LIMIT = 500;
const MODERATION_QA_NLP_MODEL_ID = 'qa-nlp-cascade';

type ModerationQaStatus = 'PENDING' | 'ACTIVE' | 'PINNED';

type ModerationQuestionsSection = ModerationAnalysisDomainContextV1['questions'];
type ModerationTopicsSection = ModerationAnalysisDomainContextV1['topics'];
type ModerationLimitation = ModerationAnalysisDomainContextV1['limitations'][number];
type ModerationSourceRevision =
  ModerationAnalysisDomainContextV1['meta']['revisions']['questionText'];

type ModerationSessionRow = {
  id: string;
  code: string;
  type: 'QUIZ' | 'Q_AND_A';
  status: SessionStatus;
  endedAt: Date | null;
  expiresAt: Date;
  qaEnabled: boolean;
  qaOpen: boolean;
  qaClosesAt: Date | null;
  sessionLifecycleRevision: number;
  qaRankingRevision: number;
  participantRevision: number;
};

export type AuthorizedModerationState = ModerationSessionRow & {
  readonly activeSortMode: QaQuestionSortMode;
  readonly authorizedAt: Date;
};

type QaCandidateRow = {
  id: string | null;
  text: string | null;
  upvoteCount: number | null;
  positiveVoteCount: number | null;
  negativeVoteCount: number | null;
  status: ModerationQaStatus | null;
  createdAt: Date | null;
  nlpStatus: 'PENDING' | 'CLASSIFIED' | 'UNCERTAIN' | 'DISABLED' | 'FAILED' | null;
  nlpCategory: 'CONTENT' | 'ORGANIZATION' | 'TECHNICAL' | null;
  nlpConfidence: number | null;
  nlpModelVersion: string | null;
  nlpAnalyzedAt: Date | null;
  bestScore: number | null;
  controversyScore: number | null;
  totalCount: bigint | number;
  eligibleCount: bigint | number;
};

export type QaContextQuestionRecord = {
  readonly id: string;
  readonly text: string;
  readonly status: ModerationQaStatus;
  readonly positiveVoteCount: number;
  readonly negativeVoteCount: number;
};

export type ModerationQaCandidateProjection = {
  readonly questions: ModerationQuestionsSection;
  readonly sources: readonly ModerationPromptSource[];
  readonly recordsById: ReadonlyMap<string, QaContextQuestionRecord>;
  readonly nlpRevision: string;
  readonly revisions: {
    readonly questionText: string;
    readonly questionVotes: string;
    readonly questionStatus: string;
  };
};

export type ModerationQaTopicProjection = {
  readonly questions: ModerationQuestionsSection;
  readonly topics: ModerationTopicsSection;
  readonly sources: readonly ModerationPromptSource[];
  readonly limitations: readonly ModerationLimitation[];
  readonly revision: ModerationSourceRevision;
};

export type AuthorizedModerationQaContext = {
  readonly state: AuthorizedModerationState;
  readonly questions: ModerationQuestionsSection;
  readonly topics: ModerationTopicsSection;
  readonly sources: readonly ModerationPromptSource[];
  readonly limitations: readonly ModerationLimitation[];
  readonly revisions: {
    readonly questionText: ModerationSourceRevision;
    readonly questionVotes: ModerationSourceRevision;
    readonly questionStatus: ModerationSourceRevision;
    readonly questionAnswerState: ModerationSourceRevision;
    readonly questionNlp: ModerationSourceRevision;
    readonly topics: ModerationSourceRevision;
  };
};

function sessionSelect() {
  return {
    id: true,
    code: true,
    type: true,
    status: true,
    endedAt: true,
    expiresAt: true,
    qaEnabled: true,
    qaOpen: true,
    qaClosesAt: true,
    sessionLifecycleRevision: true,
    qaRankingRevision: true,
    participantRevision: true,
  } as const;
}

function assertHostContentReadAllowed(session: ModerationSessionRow, now: Date): void {
  if (
    isSessionEffectivelyFinished(session, now) &&
    !buildSessionRetentionTimeline(session, now).hostPostProcessingAccessAllowed
  ) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Die Host-Nachbereitung dieser Session ist beendet.',
    });
  }
}

/** N5: resolve immutable session state and validate the actual host capability. */
export async function loadAuthorizedModerationState(input: {
  readonly sessionId: string;
  readonly access: HostTokenContext;
  readonly clock?: { readonly now: () => Date };
}): Promise<AuthorizedModerationState> {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    select: sessionSelect(),
  });
  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  }

  await assertHostSessionAccessFromContext(input.access, session.code);
  const now = input.clock?.now() ?? new Date();
  assertHostContentReadAllowed(session, now);
  return {
    ...session,
    activeSortMode: resolveQaPresenterSortMode(session.id),
    authorizedAt: now,
  };
}

function qaSourceId(questionId: string): string {
  return `qa-question:${questionId}`;
}

function truncateSchemaString(
  text: string,
  maxLength: number,
): {
  readonly text: string;
  readonly truncated: boolean;
} {
  const normalized = text.trim();
  let bounded = '';
  for (const codePoint of normalized) {
    if (bounded.length + codePoint.length > maxLength) break;
    bounded += codePoint;
  }
  return { text: bounded, truncated: bounded.length < normalized.length };
}

function truncateQuestionText(text: string): {
  readonly text: string;
  readonly truncated: boolean;
} {
  return truncateSchemaString(text, 500);
}

function mapNlpCategory(
  category: QaCandidateRow['nlpCategory'],
): 'content' | 'organization' | 'technical' | null {
  if (category === 'CONTENT') return 'content';
  if (category === 'ORGANIZATION') return 'organization';
  if (category === 'TECHNICAL') return 'technical';
  return null;
}

function malformedNlpResult(): ModerationPromptQuestion['nlp'] {
  return {
    state: 'failed',
    reason: 'The stored classification result is incomplete and cannot be used safely.',
  };
}

export function projectStoredQaNlp(
  row: Pick<
    QaCandidateRow,
    'nlpStatus' | 'nlpCategory' | 'nlpConfidence' | 'nlpModelVersion' | 'nlpAnalyzedAt'
  >,
): ModerationPromptQuestion['nlp'] {
  const status = row.nlpStatus ?? 'DISABLED';
  if (status === 'PENDING') return { state: 'pending' };
  if (status === 'DISABLED') {
    return {
      state: 'disabled',
      reason: 'Optional Q&A classification is disabled or was not collected for this question.',
    };
  }
  if (status === 'FAILED') {
    return { state: 'failed', reason: 'The stored Q&A classification failed.' };
  }

  const category = mapNlpCategory(row.nlpCategory);
  const confidence = row.nlpConfidence;
  const modelVersion = row.nlpModelVersion?.trim();
  const validConfidence =
    typeof confidence === 'number' &&
    Number.isFinite(confidence) &&
    confidence >= 0 &&
    confidence <= 1;
  if (!validConfidence || !modelVersion || modelVersion.length > 120) {
    return malformedNlpResult();
  }

  if (status === 'CLASSIFIED') {
    if (!category || !row.nlpAnalyzedAt) return malformedNlpResult();
    return {
      state: 'classified',
      category,
      confidence: { value: confidence, meaning: 'uncalibrated-model-score' },
      modelId: MODERATION_QA_NLP_MODEL_ID,
      modelVersion,
      classifiedAt: row.nlpAnalyzedAt.toISOString(),
    };
  }

  if (!row.nlpAnalyzedAt) return malformedNlpResult();
  return {
    state: 'uncertain',
    candidateCategory: category,
    confidence: { value: confidence, meaning: 'uncalibrated-model-score' },
    modelId: MODERATION_QA_NLP_MODEL_ID,
    modelVersion,
    analyzedAt: row.nlpAnalyzedAt.toISOString(),
    reason: 'The stored classifier result did not meet the classification threshold.',
  };
}

function buildNlpRevision(rows: readonly QaCandidateRow[]): string {
  const material = rows
    .filter((row): row is QaCandidateRow & { id: string } => row.id !== null)
    .map((row) => ({
      id: row.id,
      status: row.nlpStatus,
      category: row.nlpCategory,
      confidence: row.nlpConfidence,
      modelVersion: row.nlpModelVersion,
      analyzedAt: row.nlpAnalyzedAt?.toISOString() ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return `qa-nlp:${createHash('sha256').update(JSON.stringify(material)).digest('hex')}`;
}

async function loadQaCandidateRows(
  tx: Prisma.TransactionClient,
  state: AuthorizedModerationState,
  participantCount: number,
): Promise<QaCandidateRow[]> {
  const scoreSelect = buildQaRankingScoreSelectSql(participantCount);
  const modeOrder = buildQaRankingMetricOrderSql(state.activeSortMode);
  const pageModeOrder = buildQaRankingMetricOrderSql(state.activeSortMode, 'page');
  const createdAtTie =
    state.activeSortMode === 'TIME' ? Prisma.empty : Prisma.sql`ranked."createdAt" ASC,`;
  const pageCreatedAtTie =
    state.activeSortMode === 'TIME' ? Prisma.empty : Prisma.sql`page."createdAt" ASC,`;

  return tx.$queryRaw<QaCandidateRow[]>(Prisma.sql`
    WITH scope_counts AS (
      SELECT
        COUNT(*) FILTER (WHERE question."status" <> 'DELETED') AS "totalCount",
        COUNT(*) FILTER (
          WHERE question."status" IN ('PENDING', 'ACTIVE', 'PINNED')
        ) AS "eligibleCount"
      FROM "QaQuestion" AS question
      WHERE question."sessionId" = ${state.id}
    ),
    scored AS (
      SELECT
        question."id",
        question."text",
        question."upvoteCount",
        question."positiveVoteCount",
        question."negativeVoteCount",
        question."status",
        question."createdAt",
        question."nlpStatus",
        question."nlpCategory",
        question."nlpConfidence",
        question."nlpModelVersion",
        question."nlpAnalyzedAt",
        CASE question."status"
          WHEN 'PINNED' THEN 0
          WHEN 'PENDING' THEN 1
          WHEN 'ACTIVE' THEN 2
          ELSE 3
        END AS status_bucket,
        CASE question."status"
          WHEN 'PINNED' THEN 0
          WHEN 'ACTIVE' THEN 1
          WHEN 'PENDING' THEN 2
          ELSE 3
        END AS status_tie,
        ${scoreSelect}
      FROM "QaQuestion" AS question
      WHERE question."sessionId" = ${state.id}
        AND question."status" IN ('PENDING', 'ACTIVE', 'PINNED')
    ),
    ranked AS (
      SELECT * FROM scored
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
      LIMIT ${MODERATION_QA_CANDIDATE_LIMIT}
    )
    SELECT
      page."id",
      page."text",
      page."upvoteCount",
      page."positiveVoteCount",
      page."negativeVoteCount",
      page."status",
      page."createdAt",
      page."nlpStatus",
      page."nlpCategory",
      page."nlpConfidence",
      page."nlpModelVersion",
      page."nlpAnalyzedAt",
      page."bestScore",
      page."controversyScore",
      scope_counts."totalCount",
      scope_counts."eligibleCount"
    FROM scope_counts
    LEFT JOIN page ON TRUE
    ORDER BY
      page.status_bucket ASC,
      ${pageModeOrder}
      page.status_tie ASC,
      ${pageCreatedAtTie}
      page."id" ASC
  `);
}

function validatedRankingScore(input: {
  readonly actual: number | null;
  readonly expected: number;
  readonly metric: 'bestScore' | 'controversyScore';
}): number {
  if (
    input.actual === null ||
    !Number.isFinite(input.actual) ||
    input.actual < 0 ||
    input.actual > 1 ||
    Math.abs(input.actual - input.expected) > MODERATION_QA_RANKING_SCORE_TOLERANCE
  ) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Die autoritative Q&A-Rangprojektion ist inkonsistent (${input.metric}).`,
    });
  }
  return input.actual;
}

/** N6: bounded, identity-free Q&A candidate projection from persisted counters/NLP only. */
export async function collectQaContextCandidates(input: {
  readonly tx: Prisma.TransactionClient;
  readonly state: AuthorizedModerationState;
  readonly participantCount: number;
}): Promise<ModerationQaCandidateProjection> {
  const rows = await loadQaCandidateRows(input.tx, input.state, input.participantCount);
  const availableRows = rows.filter(
    (
      row,
    ): row is QaCandidateRow & {
      id: string;
      text: string;
      positiveVoteCount: number;
      negativeVoteCount: number;
      status: ModerationQaStatus;
    } =>
      row.id !== null &&
      row.text !== null &&
      row.positiveVoteCount !== null &&
      row.negativeVoteCount !== null &&
      row.status !== null,
  );
  const total = Number(rows[0]?.totalCount ?? 0);
  const eligible = Number(rows[0]?.eligibleCount ?? 0);
  const questions: ModerationPromptQuestion[] = availableRows.map((row) => {
    const positive = Number(row.positiveVoteCount);
    const negative = Number(row.negativeVoteCount);
    const bestScore = validatedRankingScore({
      actual: row.bestScore,
      expected: calculateModerationQaBestScoreV1({ positive, negative }),
      metric: 'bestScore',
    });
    const controversyScore = validatedRankingScore({
      actual: row.controversyScore,
      expected: calculateModerationQaControversyScoreV1({
        positive,
        negative,
        participantBasis: input.participantCount,
      }),
      metric: 'controversyScore',
    });
    return {
      sourceId: qaSourceId(row.id),
      status: row.status,
      answerState: { state: 'unavailable', reason: 'not-collected' },
      votes: {
        state: 'available',
        positive,
        negative,
        net: positive - negative,
        total: positive + negative,
        bestScore: {
          state: 'available',
          value: bestScore,
        },
        controversyScore: {
          state: 'available',
          value: controversyScore,
        },
      },
      nlp: projectStoredQaNlp(row),
      topicSourceIds: [],
    };
  });
  const questionSection = ModerationQuestionsSectionSchema.parse({
    state: 'available',
    participantBasis: {
      state: 'available',
      kind: 'session-participant-record-count',
      value: input.participantCount,
      calculationVersion: 'qa-ranking-v1',
    },
    corpus: {
      total,
      eligible,
      analyzed: availableRows.length,
      deduplicated: availableRows.length,
      represented: availableRows.length,
    },
    items: questions,
  });
  const sources = availableRows.map((row) => {
    const content = truncateQuestionText(row.text);
    return ModerationPromptSourceSchema.parse({
      id: qaSourceId(row.id),
      kind: 'qa-question',
      content: { state: 'included', ...content },
    });
  });
  const recordsById = new Map<string, QaContextQuestionRecord>(
    availableRows.map((row) => [
      row.id,
      {
        id: row.id,
        text: row.text,
        status: row.status,
        positiveVoteCount: Number(row.positiveVoteCount),
        negativeVoteCount: Number(row.negativeVoteCount),
      },
    ]),
  );
  const questionRevision = `qa-ranking-v1:${input.state.qaRankingRevision}`;
  return {
    questions: questionSection,
    sources,
    recordsById,
    nlpRevision: buildNlpRevision(rows),
    revisions: {
      questionText: questionRevision,
      questionStatus: questionRevision,
      questionVotes: `${questionRevision}:participants:${input.state.participantRevision}:${input.participantCount}`,
    },
  };
}

type QaTopicMemberRow = {
  readonly id: string;
  readonly text: string;
  readonly status: 'ACTIVE' | 'PINNED';
  readonly positiveVoteCount: number;
  readonly negativeVoteCount: number;
};

function semanticTopicSourceId(topicId: string): string {
  return 'semantic-topic:' + topicId;
}

function truncateTopicLabel(text: string): string | null {
  const bounded = truncateSchemaString(text, 200).text;
  return bounded || null;
}

function buildCurrentQaSemanticCorpusRevision(input: {
  readonly state: AuthorizedModerationState;
  readonly participantCount: number;
  readonly metric: WordCloudWeightMetric;
}): string {
  const participantPart = input.metric === 'CONTROVERSIAL' ? input.participantCount : '';
  return input.state.qaRankingRevision + ':' + participantPart;
}

function limitation(input: ModerationLimitation): ModerationLimitation {
  return ModerationPromptLimitationSchema.parse(input);
}

async function loadQaTopicMemberRows(
  tx: Prisma.TransactionClient,
  state: AuthorizedModerationState,
  memberIds: readonly string[],
): Promise<readonly QaTopicMemberRow[]> {
  if (memberIds.length === 0) return [];
  const rows = await tx.qaQuestion.findMany({
    where: {
      sessionId: state.id,
      id: { in: [...memberIds] },
      status: { in: ['ACTIVE', 'PINNED'] },
    },
    select: {
      id: true,
      text: true,
      status: true,
      positiveVoteCount: true,
      negativeVoteCount: true,
    },
  });
  return rows.filter(
    (row): row is QaTopicMemberRow => row.status === 'ACTIVE' || row.status === 'PINNED',
  );
}

function unavailableTopicProjection(input: {
  readonly candidates: ModerationQaCandidateProjection;
  readonly topics: ModerationTopicsSection;
  readonly revision: ModerationSourceRevision;
  readonly limitations?: readonly ModerationLimitation[];
}): ModerationQaTopicProjection {
  return {
    questions: input.candidates.questions,
    topics: input.topics,
    sources: input.candidates.sources,
    limitations: input.limitations ?? [],
    revision: input.revision,
  };
}

/**
 * N7: projects a previously completed semantic analysis without invoking the
 * encoder. Membership is revalidated in one bounded session-scoped query.
 */
export async function collectQaTopicContext(input: {
  readonly tx: Prisma.TransactionClient;
  readonly state: AuthorizedModerationState;
  readonly participantCount: number;
  readonly candidates: ModerationQaCandidateProjection;
  readonly snapshot: QaSemanticTopicSnapshot | null;
  readonly semanticEnabled?: boolean;
}): Promise<ModerationQaTopicProjection> {
  const semanticEnabled = input.semanticEnabled ?? isWordCloudSemanticEnabled();
  if (!semanticEnabled) {
    return unavailableTopicProjection({
      candidates: input.candidates,
      topics: {
        state: 'disabled',
        reason: 'Semantische Q&A-Themen sind serverseitig deaktiviert.',
      },
      revision: {
        state: 'not-applicable',
        reason: 'Semantische Q&A-Themen sind serverseitig deaktiviert.',
      },
      limitations: [
        limitation({
          code: 'module-disabled',
          section: 'topics',
          detail: 'Semantische Q&A-Themen sind serverseitig deaktiviert.',
        }),
      ],
    });
  }
  if (input.snapshot === null) {
    return unavailableTopicProjection({
      candidates: input.candidates,
      topics: { state: 'unavailable', reason: 'no-data' },
      revision: { state: 'unavailable', reason: 'no-data' },
      limitations: [
        limitation({
          code: 'module-unavailable',
          section: 'topics',
          detail: 'Für diese Session liegt noch keine nutzbare semantische Q&A-Analyse vor.',
        }),
      ],
    });
  }

  const uniqueMemberIds = [
    ...new Set(
      input.snapshot.topics.flatMap((topic) => topic.members.map((member) => member.questionId)),
    ),
  ];
  if (uniqueMemberIds.length > MODERATION_QA_TOPIC_SNAPSHOT_MEMBER_LIMIT) {
    return unavailableTopicProjection({
      candidates: input.candidates,
      topics: {
        state: 'failed',
        reason: 'Der gespeicherte Themenstand überschreitet die begrenzte Mitgliedschaft.',
      },
      revision: { state: 'unavailable', reason: 'not-collected' },
      limitations: [
        limitation({
          code: 'analysis-failed',
          section: 'topics',
          detail: 'Der Themenstand wurde ohne Datenbankzugriff verworfen: mehr als 500 Mitglieder.',
        }),
      ],
    });
  }

  const memberRows = await loadQaTopicMemberRows(input.tx, input.state, uniqueMemberIds);
  const rowsById = new Map(memberRows.map((row) => [row.id, row] as const));
  const sourceById = new Map(
    input.candidates.sources.map((source) => [source.id, source] as const),
  );
  const topicItems: Extract<ModerationTopicsSection, { state: 'available' }>['items'] = [];
  const questionTopicIds = new Map<string, string[]>();
  const representedQuestionIds = new Set<string>();
  let invalidMembership = false;
  let budgetTruncated = false;

  for (const snapshotTopic of input.snapshot.topics) {
    if (topicItems.length >= MODERATION_QA_TOPIC_LIMIT) {
      budgetTruncated = true;
      continue;
    }
    if (snapshotTopic.members.length < 2) {
      continue;
    }
    if (snapshotTopic.members.length > MODERATION_QA_TOPIC_MEMBER_LIMIT) {
      budgetTruncated = true;
      continue;
    }

    const currentMembers: QaTopicMemberRow[] = [];
    let topicMembershipValid = true;
    for (const member of snapshotTopic.members) {
      const current = rowsById.get(member.questionId);
      if (!current || hashQaSemanticTopicMemberText(current.text) !== member.textDigest) {
        topicMembershipValid = false;
        break;
      }
      currentMembers.push(current);
    }
    const labelRow = rowsById.get(snapshotTopic.labelSourceQuestionId);
    const label = labelRow ? truncateTopicLabel(labelRow.text) : null;
    if (!topicMembershipValid || !labelRow || !label) {
      invalidMembership = true;
      continue;
    }

    const topicSource = semanticTopicSourceId(snapshotTopic.topicId);
    const memberQuestionSourceIds = currentMembers.map((member) => qaSourceId(member.id));
    const additionalQuestionSources = memberQuestionSourceIds.filter(
      (sourceId) => !sourceById.has(sourceId),
    );
    if (sourceById.size + additionalQuestionSources.length + 1 > MODERATION_QA_SOURCE_LIMIT) {
      budgetTruncated = true;
      continue;
    }

    const candidateMemberIds = new Set(
      currentMembers
        .filter((member) => input.candidates.recordsById.has(member.id))
        .map((member) => member.id),
    );
    candidateMemberIds.add(labelRow.id);
    const representedQuestionSourceIds = currentMembers
      .filter((member) => candidateMemberIds.has(member.id))
      .map((member) => qaSourceId(member.id));
    if (representedQuestionSourceIds.length === 0) {
      invalidMembership = true;
      continue;
    }

    for (const member of currentMembers) {
      const sourceId = qaSourceId(member.id);
      if (!sourceById.has(sourceId)) {
        sourceById.set(
          sourceId,
          ModerationPromptSourceSchema.parse(
            member.id === labelRow.id
              ? {
                  id: sourceId,
                  kind: 'qa-question',
                  content: { state: 'included', ...truncateQuestionText(member.text) },
                }
              : {
                  id: sourceId,
                  kind: 'qa-question',
                  content: { state: 'reference-only', reason: 'not-selected' },
                },
          ),
        );
      }
    }
    sourceById.set(
      topicSource,
      ModerationPromptSourceSchema.parse({
        id: topicSource,
        kind: 'semantic-topic',
        label,
      }),
    );

    const positiveVotes = currentMembers.reduce((sum, member) => sum + member.positiveVoteCount, 0);
    const negativeVotes = currentMembers.reduce((sum, member) => sum + member.negativeVoteCount, 0);
    topicItems.push({
      sourceId: topicSource,
      labelOrigin: {
        kind: 'source-extractive',
        sourceQuestionId: qaSourceId(labelRow.id),
      },
      labelQuality: { state: 'unavailable', value: null, reason: 'not-collected' },
      clusterConfidence: {
        state: 'available',
        value: snapshotTopic.confidence,
        meaning: 'uncalibrated-model-score',
      },
      aggregates: {
        questionCount: currentMembers.length,
        positiveVotes,
        negativeVotes,
        netVotes: positiveVotes - negativeVotes,
        totalVotes: positiveVotes + negativeVotes,
        distinctParticipants: {
          state: 'unavailable',
          value: null,
          reason: 'not-collected',
        },
      },
      scope: {
        membership: 'analyzed-corpus',
        representedMembers: 'context-represented-corpus',
      },
      memberQuestionSourceIds,
      representedQuestionSourceIds,
      representativeQuestionSourceId: qaSourceId(labelRow.id),
    });
    for (const member of currentMembers) {
      const sourceId = qaSourceId(member.id);
      if (input.candidates.recordsById.has(member.id)) {
        questionTopicIds.set(sourceId, [topicSource]);
      }
    }
    representedQuestionSourceIds.forEach((sourceId) => representedQuestionIds.add(sourceId));
  }

  const currentCorpusRevision = buildCurrentQaSemanticCorpusRevision({
    state: input.state,
    participantCount: input.participantCount,
    metric: input.snapshot.metric,
  });
  const metricCurrent = input.snapshot.metric === input.state.activeSortMode;
  const revisionCurrent = input.snapshot.corpusRevision === currentCorpusRevision;
  const freshnessCurrent = metricCurrent && revisionCurrent && !invalidMembership;
  const currentRevision = freshnessCurrent
    ? input.snapshot.corpusRevision
    : invalidMembership && metricCurrent && revisionCurrent
      ? currentCorpusRevision + '|membership-invalid'
      : revisionCurrent
        ? currentCorpusRevision + '|metric=' + input.state.activeSortMode
        : currentCorpusRevision;
  const limitations: ModerationLimitation[] = [];
  if (!freshnessCurrent || invalidMembership) {
    limitations.push(
      limitation({
        code: 'analysis-stale',
        section: 'topics',
        detail: invalidMembership
          ? 'Mindestens ein Themenmitglied ist nicht mehr unverändert und autorisiert verfügbar.'
          : 'Der Themenstand entspricht nicht mehr der aktuellen Q&A-Revision oder Sortierung.',
      }),
    );
  }
  if (invalidMembership) {
    limitations.push(
      limitation({
        code: 'source-redacted',
        section: 'topics',
        detail:
          'Betroffene Themen wurden vollständig ausgelassen; alte Labels wurden nicht übernommen.',
      }),
    );
  }
  if (budgetTruncated) {
    limitations.push(
      limitation({
        code: 'budget-truncated',
        section: 'topics',
        detail:
          'Themen außerhalb der Grenzen von 30 Themen, 200 Mitgliedern oder 500 Quellen wurden ausgelassen.',
      }),
    );
  }

  const questions =
    input.candidates.questions.state === 'available'
      ? ModerationQuestionsSectionSchema.parse({
          ...input.candidates.questions,
          items: input.candidates.questions.items.map((question) => ({
            ...question,
            topicSourceIds: questionTopicIds.get(question.sourceId) ?? [],
          })),
        })
      : input.candidates.questions;
  const topics = ModerationTopicsSectionSchema.parse({
    state: 'available',
    analysisVersion: input.snapshot.analysisVersion,
    model: input.snapshot.model,
    analyzedAt: input.snapshot.analyzedAt,
    freshness: freshnessCurrent
      ? { state: 'current', analysisRevision: input.snapshot.corpusRevision }
      : {
          state: 'stale',
          analysisRevision: input.snapshot.corpusRevision,
          currentRevision,
          reason: 'Q&A-Revision oder aktive Sortierung hat sich seit der Analyse geändert.',
        },
    corpus: {
      eligibleQuestions: input.snapshot.eligibleQuestionCount,
      analyzedQuestions: input.snapshot.analyzedQuestionCount,
      representedQuestions: representedQuestionIds.size,
    },
    items: topicItems,
  });
  return {
    questions,
    topics,
    sources: [...sourceById.values()],
    limitations,
    revision: { state: 'available', value: currentRevision },
  };
}

function isQaEnabled(state: AuthorizedModerationState): boolean {
  return state.type === 'Q_AND_A' || state.qaEnabled;
}

function availableRevision(value: string): ModerationSourceRevision {
  return { state: 'available', value };
}

function assertModerationStateStillCurrent(
  initial: AuthorizedModerationState,
  current: AuthorizedModerationState,
): void {
  const unchanged =
    initial.id === current.id &&
    initial.code === current.code &&
    initial.type === current.type &&
    initial.status === current.status &&
    initial.endedAt?.getTime() === current.endedAt?.getTime() &&
    initial.expiresAt.getTime() === current.expiresAt.getTime() &&
    initial.qaEnabled === current.qaEnabled &&
    initial.qaOpen === current.qaOpen &&
    initial.qaClosesAt?.getTime() === current.qaClosesAt?.getTime() &&
    initial.sessionLifecycleRevision === current.sessionLifecycleRevision &&
    initial.qaRankingRevision === current.qaRankingRevision &&
    initial.participantRevision === current.participantRevision &&
    initial.activeSortMode === current.activeSortMode;
  if (!unchanged) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Der autorisierte Q&A-Kontext hat sich während des Aufbaus geändert.',
    });
  }
}

function disabledQaContext(state: AuthorizedModerationState): AuthorizedModerationQaContext {
  const reason = 'Der Q&A-Kanal ist für diese Session deaktiviert.';
  const revision = { state: 'not-applicable', reason } as const;
  return {
    state,
    questions: { state: 'disabled', reason },
    topics: { state: 'disabled', reason },
    sources: [],
    limitations: [
      limitation({ code: 'module-disabled', section: 'questions', detail: reason }),
      limitation({ code: 'module-disabled', section: 'topics', detail: reason }),
    ],
    revisions: {
      questionText: revision,
      questionVotes: revision,
      questionStatus: revision,
      questionAnswerState: revision,
      questionNlp: revision,
      topics: revision,
    },
  };
}

/**
 * Internal N5/N6/N7 service. It intentionally is not registered as a tRPC
 * route; later slices consume the validated fragments inside the host-only
 * moderation build path.
 */
export async function buildAuthorizedModerationQaContext(input: {
  readonly sessionId: string;
  readonly access: HostTokenContext;
  readonly clock?: { readonly now: () => Date };
  readonly cache?: WordCloudAnalysisCache;
}): Promise<AuthorizedModerationQaContext> {
  const initial = await loadAuthorizedModerationState({
    sessionId: input.sessionId,
    access: input.access,
    clock: input.clock,
  });
  if (!isQaEnabled(initial)) {
    const current = await loadAuthorizedModerationState({
      sessionId: input.sessionId,
      access: input.access,
      clock: input.clock,
    });
    assertModerationStateStillCurrent(initial, current);
    return disabledQaContext(current);
  }

  const semanticEnabled = isWordCloudSemanticEnabled();
  const cache = input.cache ?? getWordCloudAnalysisCache();
  const snapshot = semanticEnabled
    ? await cache.getLatestQaSemanticTopicSnapshot({ sessionId: initial.id }).catch(() => null)
    : null;
  const collected = await prisma.$transaction(
    async (tx) => {
      const participantCount = await tx.participant.count({
        where: { sessionId: initial.id },
      });
      const candidates = await collectQaContextCandidates({
        tx,
        state: initial,
        participantCount,
      });
      if (
        candidates.questions.state === 'available' &&
        candidates.questions.corpus.eligible === 0
      ) {
        return {
          candidates,
          topics: unavailableTopicProjection({
            candidates,
            topics: { state: 'unavailable', reason: 'no-data' },
            revision: { state: 'unavailable', reason: 'no-data' },
          }),
        };
      }
      return {
        candidates,
        topics: await collectQaTopicContext({
          tx,
          state: initial,
          participantCount,
          candidates,
          snapshot,
          semanticEnabled,
        }),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  const current = await loadAuthorizedModerationState({
    sessionId: input.sessionId,
    access: input.access,
    clock: input.clock,
  });
  assertModerationStateStillCurrent(initial, current);
  const questionRevision = {
    questionText: availableRevision(collected.candidates.revisions.questionText),
    questionVotes: availableRevision(collected.candidates.revisions.questionVotes),
    questionStatus: availableRevision(collected.candidates.revisions.questionStatus),
    questionAnswerState: {
      state: 'unavailable',
      reason: 'not-collected',
    } as const,
    questionNlp: availableRevision(collected.candidates.nlpRevision),
  };
  return {
    state: current,
    questions: collected.topics.questions,
    topics: collected.topics.topics,
    sources: collected.topics.sources,
    limitations: collected.topics.limitations,
    revisions: {
      ...questionRevision,
      topics: collected.topics.revision,
    },
  };
}

export const moderationQaContextInternals = {
  qaSourceId,
  semanticTopicSourceId,
  truncateQuestionText,
  buildCurrentQaSemanticCorpusRevision,
};
