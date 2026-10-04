import { createHash } from 'node:crypto';
import { Prisma, type QuestionType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import {
  MODERATION_COMPASS_RULES_VERSION,
  MODERATION_COMPASS_RULE_THRESHOLDS,
  MODERATION_QUIZ_EFFECTIVE_VOTE_BASIS_VERSION,
  MODERATION_QUIZ_ROUND_COMPARISON_BASIS_VERSION,
  CategorizationCategoryInputSchema,
  CategorizationItemInputSchema,
  CategorizationSelectionInputSchema,
  MatchingPairInputSchema,
  MatchingSelectionInputSchema,
  ModerationCompassSectionSchema,
  ModerationPromptLimitationSchema,
  ModerationPromptSourceSchema,
  OrderingItemInputSchema,
  OrderingSequenceInputSchema,
  buildCategorizationStats,
  buildMatchingStats,
  buildOrderingStats,
  collectModerationFeedbackDecision,
  collectModerationQuizFacts,
  isNumericValueInBand,
  planModerationCompass,
  resolveNumericEstimateToleranceMode,
  resolveNumericTolerance,
  selectFrictionQuestionSourceIds,
  selectModerationCompassTopicSourceIds,
  selectPendingModerationQuestionSourceIds,
  type ModerationAnalysisDomainContextV1,
  type ModerationCompassFeedbackDecision,
  type ModerationCompassQuizQuestion,
  type ModerationCompassQuizInsightKind,
  type ModerationPromptSource,
  type ModerationQuizFact,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import type { HostTokenContext } from './hostAuth';
import {
  assertModerationStateStillCurrent,
  loadAuthorizedModerationState,
  type AuthorizedModerationState,
} from './moderationQaContext';
import { isQaControversialLabel, resolveQaControversyThreshold } from './qaControversy';
import {
  loadQuickFeedbackModerationSnapshot,
  type QuickFeedbackModerationProjection,
} from './quickFeedbackModerationSnapshot';
import { parseSessionQuestionProgress } from './sessionQuestionProgress';

const RELEASED_QUESTION_LIMIT = 50;
const COMPLETED_PROGRESS_ID_LIMIT = 500;
const INTERNAL_DETAIL_FACT_RESPONSE_LIMIT = 500;
const RESULT_SIGNAL_LIMIT = 22;

type ReleasedResultsSection = ModerationAnalysisDomainContextV1['releasedResults'];
type ModerationQuestionsSection = ModerationAnalysisDomainContextV1['questions'];
type ModerationTopicsSection = ModerationAnalysisDomainContextV1['topics'];
type ModerationCompassSection = ModerationAnalysisDomainContextV1['compass'];
type ModerationLimitation = ModerationAnalysisDomainContextV1['limitations'][number];
type ModerationSourceRevision =
  ModerationAnalysisDomainContextV1['meta']['revisions']['releasedResults'];
type CompassSignal = Extract<ModerationCompassSection, { state: 'available' }>['signals'][number];

type RawOptionBucket = {
  readonly id: string;
  readonly text: string;
  readonly isCorrect: boolean;
  readonly count: number;
};
type RawNumericPair = readonly [number, number];
type RawRatingBucket = {
  readonly value: number;
  readonly count: number;
};
type RawFactVote = {
  readonly freeText: unknown;
  readonly matchingSelections: unknown;
  readonly orderingSequence: unknown;
  readonly categorizationSelections: unknown;
};

export type ReleasedQuizRow = {
  readonly questionId: string;
  readonly text: string;
  readonly type: QuestionType;
  readonly order: number;
  readonly ratingMin: number | null;
  readonly ratingMax: number | null;
  readonly numericToleranceMode: string | null;
  readonly numericReferenceValue: number | null;
  readonly numericTolerancePercent: number | null;
  readonly numericIntervalLeft: number | null;
  readonly numericIntervalRight: number | null;
  readonly matchingPairs: unknown;
  readonly orderingItems: unknown;
  readonly categories: unknown;
  readonly categorizationItems: unknown;
  readonly participantCount: bigint | number;
  readonly scopeCount: bigint | number;
  readonly effectiveRound: bigint | number;
  readonly effectiveResponseCount: bigint | number;
  readonly correctCount: bigint | number;
  readonly incorrectCount: bigint | number;
  readonly unansweredCount: bigint | number;
  readonly round1ResponseCount: bigint | number;
  readonly round1CorrectCount: bigint | number;
  readonly round1IncorrectCount: bigint | number;
  readonly round2ResponseCount: bigint | number;
  readonly round2CorrectCount: bigint | number;
  readonly round2IncorrectCount: bigint | number;
  readonly options: unknown;
  readonly ratingValueCount: bigint | number;
  readonly ratingBuckets: unknown;
  readonly numericValueCount: bigint | number;
  readonly numericValues: unknown;
  readonly round1NumericValueCount: bigint | number;
  readonly round1NumericValues: unknown;
  readonly round2NumericValueCount: bigint | number;
  readonly round2NumericValues: unknown;
  readonly numericPairCount: bigint | number;
  readonly numericPairs: unknown;
  readonly factVotes: unknown;
};

type SupportedQuizFact = Extract<
  ModerationQuizFact,
  | { type: 'wrong-majority' }
  | { type: 'in-band' }
  | { type: 'numeric-round-worse' }
  | { type: 'numeric-round-farther' }
  | { type: 'matching-confusion' }
  | { type: 'ordering-swap' }
  | { type: 'categorization-miss' }
  | { type: 'wrong-option' }
  | { type: 'numeric-median' }
  | { type: 'numeric-spread' }
  | { type: 'survey-top' }
  | { type: 'histogram-peak-out' }
  | { type: 'round-drop' }
  | { type: 'rating-low' }
  | { type: 'freetext-repeat' }
>;

type ReleasedQuizInsight = {
  readonly questionSourceId: string;
  readonly aggregateSourceIds: readonly string[];
  readonly kind: ModerationCompassQuizInsightKind;
  readonly facts: readonly {
    readonly kind: SupportedQuizFact['type'];
    readonly reason: string;
    readonly sourceId: string;
  }[];
};

export type ReleasedQuizProjection = {
  readonly releasedResults: ReleasedResultsSection;
  readonly sources: readonly ModerationPromptSource[];
  readonly limitations: readonly ModerationLimitation[];
  readonly revision: ModerationSourceRevision;
  readonly fingerprint: string;
  readonly insights: readonly ReleasedQuizInsight[];
};

export type ModerationCompassProjection = {
  readonly compass: ModerationCompassSection;
  readonly sources: readonly ModerationPromptSource[];
  readonly limitations: readonly ModerationLimitation[];
};

export type AuthorizedModerationTeachingSignals = {
  readonly state: AuthorizedModerationState;
  readonly releasedResults: ReleasedResultsSection;
  readonly feedback: ModerationAnalysisDomainContextV1['feedback'];
  readonly compass: ModerationCompassSection;
  readonly sources: readonly ModerationPromptSource[];
  readonly limitations: readonly ModerationLimitation[];
  readonly revisions: {
    readonly releasedResults: ModerationSourceRevision;
    readonly feedback: ModerationAnalysisDomainContextV1['meta']['revisions']['feedback'];
  };
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (typeof nested === 'bigint') return nested.toString();
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.fromEntries(
        Object.entries(nested as Record<string, unknown>).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
    }
    return nested;
  });
}

function limitation(input: ModerationLimitation): ModerationLimitation {
  return ModerationPromptLimitationSchema.parse(input);
}

function truncateSchemaString(text: string, maxLength: number) {
  const normalized = text.trim();
  let bounded = '';
  for (const codePoint of normalized) {
    if (bounded.length + codePoint.length > maxLength) break;
    bounded += codePoint;
  }
  return { text: bounded, truncated: bounded.length < normalized.length };
}

function asCount(value: bigint | number): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'The released-result aggregate contains an invalid count.',
    });
  }
  return count;
}

function finiteNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is number => typeof entry === 'number' && Number.isFinite(entry),
  );
}

function completeBoundedNumberArray(
  value: unknown,
  expectedValue: bigint | number,
): number[] | null {
  const expected = asCount(expectedValue);
  if (expected > INTERNAL_DETAIL_FACT_RESPONSE_LIMIT) return null;
  const values = finiteNumberArray(value);
  return values.length === expected ? values : null;
}

function ratingBuckets(value: unknown): RawRatingBucket[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is RawRatingBucket => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const bucket = entry as Record<string, unknown>;
    return (
      typeof bucket.value === 'number' &&
      Number.isInteger(bucket.value) &&
      Number.isSafeInteger(Number(bucket.count)) &&
      Number(bucket.count) >= 0
    );
  });
}

function numericPairs(value: unknown): RawNumericPair[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is [number, number] =>
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === 'number' &&
      Number.isFinite(entry[0]) &&
      typeof entry[1] === 'number' &&
      Number.isFinite(entry[1]),
  );
}

function optionBuckets(value: unknown): RawOptionBucket[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is RawOptionBucket => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const bucket = entry as Record<string, unknown>;
    return (
      typeof bucket.id === 'string' &&
      typeof bucket.text === 'string' &&
      typeof bucket.isCorrect === 'boolean' &&
      Number.isSafeInteger(Number(bucket.count)) &&
      Number(bucket.count) >= 0
    );
  });
}

function factVotes(value: unknown): RawFactVote[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is RawFactVote => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return true;
  });
}

function completeFreeTextResponses(row: ReleasedQuizRow): string[] | null {
  const expected = asCount(row.effectiveResponseCount);
  if (expected > INTERNAL_DETAIL_FACT_RESPONSE_LIMIT) return null;
  const votes = factVotes(row.factVotes);
  if (votes.length !== expected || votes.some((vote) => typeof vote.freeText !== 'string')) {
    return null;
  }
  return votes.map((vote) => vote.freeText as string);
}

function repeatedFreeTextPatterns(responses: readonly string[]): { count: number }[] {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const normalized = response.trim().replace(/\s+/g, ' ');
    if (normalized.length < MODERATION_COMPASS_RULE_THRESHOLDS.quiz.repeatedTextMinimumLength) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(
      ([, count]) => count >= MODERATION_COMPASS_RULE_THRESHOLDS.quiz.repeatedTextMinimumCount,
    )
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 20)
    .map(([, count]) => ({ count }));
}

function quizScopeId(quizId: string): string {
  return `quiz-scope:${quizId}`;
}

function quizQuestionSourceId(questionId: string): string {
  return `quiz-question:${questionId}`;
}

function aggregateSourceId(questionId: string, suffix: string): string {
  return `quiz-result-aggregate:${questionId}.${suffix}`;
}

function answerOptionId(optionId: string): string {
  return `answer-option:${optionId}`;
}

function uniqueOptionLabels(options: readonly RawOptionBucket[]): string[] {
  const bounded = options.map((option) => truncateSchemaString(option.text, 200).text || 'Option');
  const frequencies = new Map<string, number>();
  bounded.forEach((label) => frequencies.set(label, (frequencies.get(label) ?? 0) + 1));
  const used = new Set<string>();
  return bounded.map((label, index) => {
    let candidate = label;
    if ((frequencies.get(label) ?? 0) > 1 || used.has(candidate)) {
      const suffix = ` (${options[index]!.id})`;
      candidate = `${truncateSchemaString(label, 200 - suffix.length).text}${suffix}`;
    }
    let attempt = 1;
    while (used.has(candidate)) {
      const suffix = ` (${index + 1}-${attempt})`;
      candidate = `${truncateSchemaString(label, 200 - suffix.length).text}${suffix}`;
      attempt += 1;
    }
    used.add(candidate);
    return candidate;
  });
}

async function loadReleasedQuizRows(
  tx: Prisma.TransactionClient,
  state: AuthorizedModerationState,
  completedQuestionIds: readonly string[],
): Promise<ReleasedQuizRow[]> {
  return tx.$queryRaw<ReleasedQuizRow[]>(Prisma.sql`
    WITH completed_scope AS (
      SELECT
        question."id",
        question."text",
        question."type"::text AS "type",
        question."order",
        question."ratingMin",
        question."ratingMax",
        question."numericToleranceMode",
        question."numericReferenceValue",
        question."numericTolerancePercent",
        question."numericIntervalLeft",
        question."numericIntervalRight",
        question."matchingPairs",
        question."orderingItems",
        question."categories",
        question."categorizationItems",
        COUNT(*) OVER () AS "scopeCount"
      FROM "Question" AS question
      WHERE question."quizId" = ${state.quizId}
        AND question."id" IN (${Prisma.join(completedQuestionIds)})
      ORDER BY question."order" ASC, question."id" ASC
      LIMIT ${RELEASED_QUESTION_LIMIT}
    ),
    participant_scope AS (
      SELECT COUNT(*) AS "participantCount"
      FROM "Participant" AS participant
      WHERE participant."sessionId" = ${state.id}
    ),
    effective_round AS (
      SELECT
        question."id" AS "questionId",
        CASE
          WHEN COUNT(vote."id") FILTER (WHERE vote."round" = 2) > 0 THEN 2
          ELSE 1
        END AS "effectiveRound"
      FROM completed_scope AS question
      LEFT JOIN "Vote" AS vote
        ON vote."sessionId" = ${state.id}
       AND vote."questionId" = question."id"
       AND vote."round" IN (1, 2)
      GROUP BY question."id"
    ),
    effective_votes AS (
      SELECT vote.*
      FROM "Vote" AS vote
      INNER JOIN effective_round AS selected
        ON selected."questionId" = vote."questionId"
       AND selected."effectiveRound" = vote."round"
      WHERE vote."sessionId" = ${state.id}
    ),
    effective_fact_votes AS (
      SELECT
        vote.*,
        ROW_NUMBER() OVER (
          PARTITION BY vote."questionId"
          ORDER BY vote."id" ASC
        ) AS "factOrdinal"
      FROM effective_votes AS vote
    ),
    effective_stats AS (
      SELECT
        question."id" AS "questionId",
        COUNT(vote."id") AS "effectiveResponseCount",
        COUNT(vote."id") FILTER (WHERE vote."isCorrect" IS TRUE) AS "correctCount",
        COUNT(vote."id") FILTER (WHERE vote."isCorrect" IS FALSE) AS "incorrectCount",
        COUNT(vote."id") FILTER (WHERE vote."isCorrect" IS NULL) AS "unansweredCount",
        COUNT(vote."ratingValue") AS "ratingValueCount",
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'freeText', vote."freeText",
              'matchingSelections', vote."matchingSelections",
              'orderingSequence', vote."orderingSequence",
              'categorizationSelections', vote."categorizationSelections"
            )
            ORDER BY vote."id" ASC
          ) FILTER (
            WHERE vote."id" IS NOT NULL
              AND vote."factOrdinal" <= ${INTERNAL_DETAIL_FACT_RESPONSE_LIMIT}
          ),
          '[]'::jsonb
        ) AS "factVotes"
      FROM completed_scope AS question
      LEFT JOIN effective_fact_votes AS vote ON vote."questionId" = question."id"
      GROUP BY question."id"
    ),
    rating_counts AS (
      SELECT
        vote."questionId",
        vote."ratingValue" AS "value",
        COUNT(*) AS "count"
      FROM effective_votes AS vote
      WHERE vote."ratingValue" BETWEEN 0 AND 10
      GROUP BY vote."questionId", vote."ratingValue"
    ),
    rating_sets AS (
      SELECT
        question."id" AS "questionId",
        COALESCE(
          jsonb_agg(
            jsonb_build_object('value', rating."value", 'count', rating."count")
            ORDER BY rating."value"
          ) FILTER (WHERE rating."value" IS NOT NULL),
          '[]'::jsonb
        ) AS "ratingBuckets"
      FROM completed_scope AS question
      LEFT JOIN rating_counts AS rating ON rating."questionId" = question."id"
      GROUP BY question."id"
    ),
    effective_numeric_values AS (
      SELECT
        vote."questionId",
        vote."numericValue",
        ROW_NUMBER() OVER (
          PARTITION BY vote."questionId"
          ORDER BY vote."numericValue", vote."id"
        ) AS "numericOrdinal"
      FROM effective_votes AS vote
      WHERE vote."numericValue" IS NOT NULL
    ),
    effective_numeric_sets AS (
      SELECT
        question."id" AS "questionId",
        COUNT(value."numericValue") AS "numericValueCount",
        COALESCE(
          jsonb_agg(value."numericValue" ORDER BY value."numericValue") FILTER (
            WHERE value."numericValue" IS NOT NULL
              AND value."numericOrdinal" <= ${INTERNAL_DETAIL_FACT_RESPONSE_LIMIT}
          ),
          '[]'::jsonb
        ) AS "numericValues"
      FROM completed_scope AS question
      LEFT JOIN effective_numeric_values AS value ON value."questionId" = question."id"
      GROUP BY question."id"
    ),
    round_stats AS (
      SELECT
        question."id" AS "questionId",
        COUNT(vote."id") FILTER (
          WHERE vote."round" = 1 AND vote."isCorrect" IS NOT NULL
        ) AS "round1ResponseCount",
        COUNT(vote."id") FILTER (
          WHERE vote."round" = 1 AND vote."isCorrect" IS TRUE
        ) AS "round1CorrectCount",
        COUNT(vote."id") FILTER (
          WHERE vote."round" = 1 AND vote."isCorrect" IS FALSE
        ) AS "round1IncorrectCount",
        COUNT(vote."id") FILTER (
          WHERE vote."round" = 2 AND vote."isCorrect" IS NOT NULL
        ) AS "round2ResponseCount",
        COUNT(vote."id") FILTER (
          WHERE vote."round" = 2 AND vote."isCorrect" IS TRUE
        ) AS "round2CorrectCount",
        COUNT(vote."id") FILTER (
          WHERE vote."round" = 2 AND vote."isCorrect" IS FALSE
        ) AS "round2IncorrectCount"
      FROM completed_scope AS question
      LEFT JOIN "Vote" AS vote
        ON vote."sessionId" = ${state.id}
       AND vote."questionId" = question."id"
       AND vote."round" IN (1, 2)
      GROUP BY question."id"
    ),
    round_numeric_values AS (
      SELECT
        vote."questionId",
        vote."round",
        vote."numericValue",
        ROW_NUMBER() OVER (
          PARTITION BY vote."questionId", vote."round"
          ORDER BY vote."numericValue", vote."id"
        ) AS "numericOrdinal"
      FROM "Vote" AS vote
      INNER JOIN completed_scope AS question ON question."id" = vote."questionId"
      WHERE vote."sessionId" = ${state.id}
        AND vote."round" IN (1, 2)
        AND vote."numericValue" IS NOT NULL
    ),
    round_numeric_sets AS (
      SELECT
        question."id" AS "questionId",
        COUNT(value."numericValue") FILTER (WHERE value."round" = 1) AS "round1NumericValueCount",
        COALESCE(
          jsonb_agg(value."numericValue" ORDER BY value."numericValue") FILTER (
            WHERE value."round" = 1
              AND value."numericOrdinal" <= ${INTERNAL_DETAIL_FACT_RESPONSE_LIMIT}
          ),
          '[]'::jsonb
        ) AS "round1NumericValues",
        COUNT(value."numericValue") FILTER (WHERE value."round" = 2) AS "round2NumericValueCount",
        COALESCE(
          jsonb_agg(value."numericValue" ORDER BY value."numericValue") FILTER (
            WHERE value."round" = 2
              AND value."numericOrdinal" <= ${INTERNAL_DETAIL_FACT_RESPONSE_LIMIT}
          ),
          '[]'::jsonb
        ) AS "round2NumericValues"
      FROM completed_scope AS question
      LEFT JOIN round_numeric_values AS value ON value."questionId" = question."id"
      GROUP BY question."id"
    ),
    option_counts AS (
      SELECT
        vote."questionId",
        selected."answerOptionId",
        COUNT(*) AS "count"
      FROM effective_votes AS vote
      INNER JOIN "VoteAnswer" AS selected ON selected."voteId" = vote."id"
      GROUP BY vote."questionId", selected."answerOptionId"
    ),
    option_sets AS (
      SELECT
        question."id" AS "questionId",
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', answer."id",
              'text', answer."text",
              'isCorrect', answer."isCorrect",
              'count', COALESCE(option_counts."count", 0)
            )
            ORDER BY answer."id"
          ) FILTER (WHERE answer."id" IS NOT NULL),
          '[]'::jsonb
        ) AS "options"
      FROM completed_scope AS question
      LEFT JOIN "AnswerOption" AS answer ON answer."questionId" = question."id"
      LEFT JOIN option_counts
        ON option_counts."questionId" = question."id"
       AND option_counts."answerOptionId" = answer."id"
      GROUP BY question."id"
    ),
    numeric_pair_rows AS (
      SELECT
        question."id" AS "questionId",
        round1."numericValue" AS "round1Value",
        round2."numericValue" AS "round2Value",
        ROW_NUMBER() OVER (
          PARTITION BY question."id"
          ORDER BY round1."numericValue", round2."numericValue", round1."id", round2."id"
        ) AS "pairOrdinal"
      FROM completed_scope AS question
      INNER JOIN "Vote" AS round1
        ON round1."sessionId" = ${state.id}
       AND round1."questionId" = question."id"
       AND round1."round" = 1
       AND round1."numericValue" IS NOT NULL
      INNER JOIN "Vote" AS round2
        ON round2."sessionId" = round1."sessionId"
       AND round2."questionId" = round1."questionId"
       AND round2."participantId" = round1."participantId"
       AND round2."round" = 2
       AND round2."numericValue" IS NOT NULL
    ),
    numeric_pairs AS (
      SELECT
        question."id" AS "questionId",
        COUNT(pair."questionId") AS "numericPairCount",
        COALESCE(
          jsonb_agg(
            jsonb_build_array(pair."round1Value", pair."round2Value")
            ORDER BY pair."round1Value", pair."round2Value"
          ) FILTER (
            WHERE pair."questionId" IS NOT NULL
              AND pair."pairOrdinal" <= ${INTERNAL_DETAIL_FACT_RESPONSE_LIMIT}
          ),
          '[]'::jsonb
        ) AS "numericPairs"
      FROM completed_scope AS question
      LEFT JOIN numeric_pair_rows AS pair ON pair."questionId" = question."id"
      GROUP BY question."id"
    )
    SELECT
      question."id" AS "questionId",
      question."text",
      question."type",
      question."order",
      question."ratingMin",
      question."ratingMax",
      question."numericToleranceMode",
      question."numericReferenceValue",
      question."numericTolerancePercent",
      question."numericIntervalLeft",
      question."numericIntervalRight",
      question."matchingPairs",
      question."orderingItems",
      question."categories",
      question."categorizationItems",
      participant_scope."participantCount",
      question."scopeCount",
      effective_round."effectiveRound",
      effective_stats."effectiveResponseCount",
      effective_stats."correctCount",
      effective_stats."incorrectCount",
      effective_stats."unansweredCount",
      round_stats."round1ResponseCount",
      round_stats."round1CorrectCount",
      round_stats."round1IncorrectCount",
      round_stats."round2ResponseCount",
      round_stats."round2CorrectCount",
      round_stats."round2IncorrectCount",
      option_sets."options",
      effective_stats."ratingValueCount",
      rating_sets."ratingBuckets",
      effective_numeric_sets."numericValueCount",
      effective_numeric_sets."numericValues",
      round_numeric_sets."round1NumericValueCount",
      round_numeric_sets."round1NumericValues",
      round_numeric_sets."round2NumericValueCount",
      round_numeric_sets."round2NumericValues",
      numeric_pairs."numericPairCount",
      numeric_pairs."numericPairs",
      effective_stats."factVotes"
    FROM completed_scope AS question
    CROSS JOIN participant_scope
    INNER JOIN effective_round ON effective_round."questionId" = question."id"
    INNER JOIN effective_stats ON effective_stats."questionId" = question."id"
    INNER JOIN rating_sets ON rating_sets."questionId" = question."id"
    INNER JOIN effective_numeric_sets ON effective_numeric_sets."questionId" = question."id"
    INNER JOIN round_stats ON round_stats."questionId" = question."id"
    INNER JOIN round_numeric_sets ON round_numeric_sets."questionId" = question."id"
    INNER JOIN option_sets ON option_sets."questionId" = question."id"
    INNER JOIN numeric_pairs ON numeric_pairs."questionId" = question."id"
    ORDER BY question."order" ASC, question."id" ASC
  `);
}

function round4(value: number): number {
  const scaled = value * 10_000;
  return Number.isFinite(scaled) ? Math.round(scaled) / 10_000 : value;
}

function numericStats(values: readonly number[], band: { left: number; right: number } | null) {
  if (values.length === 0) {
    return {
      responseCount: 0,
      median: null,
      standardDeviation: null,
      inBandCount: 0,
      inBandPercent: null,
    } as const;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0 ? sorted[middle - 1]! / 2 + sorted[middle]! / 2 : sorted[middle]!;
  let scale = 0;
  for (const value of values) scale = Math.max(scale, Math.abs(value));
  const normalizedMean =
    scale === 0 ? 0 : values.reduce((sum, value) => sum + value / scale, 0) / values.length;
  const normalizedVariance =
    scale === 0
      ? 0
      : values.reduce((sum, value) => sum + (value / scale - normalizedMean) ** 2, 0) /
        values.length;
  const standardDeviation = scale * Math.sqrt(normalizedVariance);
  if (!Number.isFinite(median) || !Number.isFinite(standardDeviation)) return null;
  const inBandCount = band ? values.filter((value) => isNumericValueInBand(value, band)).length : 0;
  return {
    responseCount: values.length,
    median: round4(median),
    standardDeviation: round4(standardDeviation),
    inBandCount,
    inBandPercent: band ? (inBandCount / values.length) * 100 : null,
  } as const;
}

function niceNumericRange(minimum: number, maximum: number, targetBins: number) {
  const span = maximum - minimum;
  if (!Number.isFinite(span) || span <= 0) return null;
  const rawStep = span / Math.max(1, targetBins);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceFactor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceFactor * magnitude;
  const result = {
    minimum: Math.floor(minimum / step) * step,
    maximum: Math.ceil(maximum / step) * step,
  };
  return Number.isFinite(result.minimum) && Number.isFinite(result.maximum) ? result : null;
}

function numericHistogram(values: readonly number[], band: { left: number; right: number } | null) {
  if (values.length === 0) return [];
  // A zero-percent relative tolerance is a valid exact-match band. It has no
  // positive-width interval that can be represented honestly as histogram
  // buckets, so keep the exact summary and omit optional histogram evidence.
  if (band && band.left === band.right) return undefined;
  const targetBins = 10;
  const valueMin = Math.min(...values);
  const valueMax = Math.max(...values);
  let minimum = band ? Math.min(valueMin, band.left) : valueMin;
  let maximum = band ? Math.max(valueMax, band.right) : valueMax;
  if (minimum === maximum) {
    const padding = Math.max(Math.abs(minimum) * 0.05, 0.5);
    minimum -= padding;
    maximum += padding;
  } else {
    const padding = Math.max((maximum - minimum) * 0.08, 0.5);
    minimum -= padding;
    maximum += padding;
  }
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) return null;
  const range = niceNumericRange(minimum, maximum, targetBins);
  if (!range) return null;
  ({ minimum, maximum } = range);
  const width = (maximum - minimum) / targetBins;
  if (!Number.isFinite(width) || width <= 0) return null;
  const edges = Array.from({ length: targetBins + 1 }, (_, index) => minimum + index * width);
  if (band) {
    const used = new Set<number>();
    for (const boundary of [band.left, band.right]) {
      if (boundary <= minimum || boundary >= maximum) continue;
      const selected = edges
        .map((edge, index) => ({ edge, index }))
        .filter(({ index }) => index > 0 && index < targetBins && !used.has(index))
        .sort(
          (left, right) =>
            Math.abs(left.edge - boundary) - Math.abs(right.edge - boundary) ||
            left.index - right.index,
        )[0];
      if (selected) {
        edges[selected.index] = boundary;
        used.add(selected.index);
      }
    }
    edges.sort((left, right) => left - right);
  }
  if (
    edges.some((edge, index) => !Number.isFinite(edge) || (index > 0 && edge <= edges[index - 1]!))
  ) {
    return null;
  }
  const buckets = Array.from({ length: targetBins }, (_, index) => {
    const from = edges[index]!;
    const to = edges[index + 1]!;
    return {
      // Keep the actual finite edges. Rounding here can collapse distinct
      // narrow-band boundaries (for example 0.00001 and 0.00002) and make an
      // otherwise valid bucket fail the shared from < to invariant.
      from,
      to,
      count: 0,
      inBand: band ? from >= band.left && to <= band.right : false,
    };
  });
  for (const value of values) {
    const inclusiveRightBandIndex = band
      ? buckets.findIndex(
          (bucket) => bucket.inBand && bucket.to === band.right && value === band.right,
        )
      : -1;
    const index =
      inclusiveRightBandIndex >= 0
        ? inclusiveRightBandIndex
        : buckets.findIndex((bucket, bucketIndex) =>
            bucketIndex === buckets.length - 1
              ? value >= bucket.from && value <= bucket.to
              : value >= bucket.from && value < bucket.to,
          );
    if (index >= 0) buckets[index]!.count += 1;
  }
  return buckets;
}

function numericBand(row: ReleasedQuizRow): { left: number; right: number } | null {
  const mode = resolveNumericEstimateToleranceMode(row.numericToleranceMode);
  return resolveNumericTolerance(mode, {
    referenceValue: row.numericReferenceValue,
    tolerancePercent: row.numericTolerancePercent,
    intervalLeft: row.numericIntervalLeft,
    intervalRight: row.numericIntervalRight,
  });
}

function numericReference(row: ReleasedQuizRow, band: { left: number; right: number } | null) {
  const reference = row.numericReferenceValue;
  if (typeof reference !== 'number' || !Number.isFinite(reference)) return null;
  const mode = resolveNumericEstimateToleranceMode(row.numericToleranceMode);
  if (mode === 'RELATIVE_PERCENT') return reference;
  return band && isNumericValueInBand(reference, band) ? reference : null;
}

function numericRoundComparison(
  row: ReleasedQuizRow,
  band: { left: number; right: number } | null,
) {
  const round1Values = completeBoundedNumberArray(
    row.round1NumericValues,
    row.round1NumericValueCount,
  );
  const round2Values = completeBoundedNumberArray(
    row.round2NumericValues,
    row.round2NumericValueCount,
  );
  if (!round1Values || !round2Values) return undefined;
  if (!band || round1Values.length === 0 || round2Values.length === 0) return undefined;
  const round1 = numericStats(round1Values, band);
  const round2 = numericStats(round2Values, band);
  if (!round1 || !round2) return undefined;
  const reference = numericReference(row, band);
  const expectedPairs = asCount(row.numericPairCount);
  const pairs = numericPairs(row.numericPairs);
  const completePairs =
    expectedPairs <= INTERNAL_DETAIL_FACT_RESPONSE_LIMIT && pairs.length === expectedPairs
      ? pairs
      : [];
  let closerCount = 0;
  let fartherCount = 0;
  let unchangedCount = 0;
  let pairedCount = 0;
  if (reference !== null) {
    for (const [before, after] of completePairs) {
      const beforeDistance = Math.abs(before - reference);
      const afterDistance = Math.abs(after - reference);
      if (!Number.isFinite(beforeDistance) || !Number.isFinite(afterDistance)) continue;
      pairedCount += 1;
      if (Math.abs(beforeDistance - afterDistance) < 1e-9) unchangedCount += 1;
      else if (afterDistance < beforeDistance) closerCount += 1;
      else fartherCount += 1;
    }
  }
  return {
    basis: { kind: 'round-comparison', version: MODERATION_QUIZ_ROUND_COMPARISON_BASIS_VERSION },
    round1: { responseCount: round1.responseCount, inBandCount: round1.inBandCount },
    round2: { responseCount: round2.responseCount, inBandCount: round2.inBandCount },
    inBandPercentDelta:
      (round2.inBandCount / round2.responseCount) * 100 -
      (round1.inBandCount / round1.responseCount) * 100,
    ...(reference !== null && pairedCount > 0
      ? {
          pairedAnalysis: {
            pairedCount,
            closerCount,
            fartherCount,
            unchangedCount,
          },
        }
      : {}),
  } as const;
}

function isSupportedFact(fact: ModerationQuizFact): fact is SupportedQuizFact {
  return [
    'wrong-majority',
    'in-band',
    'numeric-round-worse',
    'numeric-round-farther',
    'matching-confusion',
    'ordering-swap',
    'categorization-miss',
    'wrong-option',
    'numeric-median',
    'numeric-spread',
    'survey-top',
    'histogram-peak-out',
    'round-drop',
    'rating-low',
    'freetext-repeat',
  ].includes(fact.type);
}

function detailedQuizFactInput(row: ReleasedQuizRow): Partial<ModerationCompassQuizQuestion> {
  const effectiveResponses = asCount(row.effectiveResponseCount);
  if (effectiveResponses > INTERNAL_DETAIL_FACT_RESPONSE_LIMIT) return {};
  const votes = factVotes(row.factVotes);
  if (votes.length !== effectiveResponses) return {};

  if (row.type === 'MATCHING') {
    const pairs = MatchingPairInputSchema.array().safeParse(row.matchingPairs);
    if (pairs.success) {
      const matchingStats = buildMatchingStats(
        votes.map((vote) => {
          const selections = MatchingSelectionInputSchema.array().safeParse(
            vote.matchingSelections ?? [],
          );
          return { selections: selections.success ? selections.data : [] };
        }),
        pairs.data,
      );
      return { matchingStats };
    }
  }
  if (row.type === 'ORDERING') {
    const items = OrderingItemInputSchema.array().safeParse(row.orderingItems);
    if (items.success) {
      const orderingStats = buildOrderingStats(
        votes.map((vote) => {
          const sequence = OrderingSequenceInputSchema.safeParse(vote.orderingSequence ?? []);
          return { sequence: sequence.success ? sequence.data : [] };
        }),
        items.data,
      );
      return { orderingStats };
    }
  }
  if (row.type === 'CATEGORIZATION') {
    const categories = CategorizationCategoryInputSchema.array().safeParse(row.categories);
    const items = CategorizationItemInputSchema.array().safeParse(row.categorizationItems);
    if (categories.success && items.success) {
      const categorizationStats = buildCategorizationStats(
        votes.map((vote) => {
          const selections = CategorizationSelectionInputSchema.array().safeParse(
            vote.categorizationSelections ?? [],
          );
          return { selections: selections.success ? selections.data : [] };
        }),
        items.data,
        categories.data,
      );
      return { categorizationStats };
    }
  }
  return {};
}

function factsForSource(input: {
  readonly questionType: QuestionType;
  readonly source: Extract<ModerationPromptSource, { kind: 'quiz-result-aggregate' }>;
  readonly row: ReleasedQuizRow;
}): SupportedQuizFact[] {
  const aggregation = input.source.aggregation;
  if (aggregation.rule === 'answer-distribution') {
    const optionsById = new Map(
      optionBuckets(input.row.options).map((option) => [answerOptionId(option.id), option]),
    );
    return collectModerationQuizFacts({
      type: input.questionType,
      ...detailedQuizFactInput(input.row),
      totalVotes: aggregation.responseCount,
      voteDistribution: aggregation.buckets.map((bucket) => ({
        text: bucket.label,
        isCorrect:
          input.questionType === 'SURVEY'
            ? false
            : (optionsById.get(bucket.optionId)?.isCorrect ?? false),
        voteCount: bucket.count,
      })),
    }).filter(isSupportedFact);
  }
  if (aggregation.rule === 'freetext-pattern-summary') {
    const responses = completeFreeTextResponses(input.row);
    if (!responses) return [];
    return collectModerationQuizFacts({
      type: input.questionType,
      totalVotes: aggregation.responseCount,
      freeTextResponses: responses,
    }).filter(
      (fact): fact is Extract<SupportedQuizFact, { type: 'freetext-repeat' }> =>
        fact.type === 'freetext-repeat',
    );
  }
  if (aggregation.rule === 'correctness-summary') {
    return collectModerationQuizFacts({
      type: input.questionType,
      ...detailedQuizFactInput(input.row),
      totalVotes: aggregation.correct + aggregation.incorrect + aggregation.unanswered,
      correctVoterCount: aggregation.correct,
      incorrectVoterCount: aggregation.incorrect,
      roundComparison: aggregation.roundComparison
        ? {
            round1CorrectCount: aggregation.roundComparison.round1.correct,
            round2CorrectCount: aggregation.roundComparison.round2.correct,
          }
        : null,
    }).filter(isSupportedFact);
  }
  if (aggregation.rule === 'rating-summary') {
    return collectModerationQuizFacts({
      type: input.questionType,
      ...detailedQuizFactInput(input.row),
      ratingAvg: aggregation.mean === null ? null : Math.round(aggregation.mean * 10) / 10,
      ratingCount: aggregation.responseCount,
    }).filter(isSupportedFact);
  }
  if (aggregation.rule === 'numeric-summary') {
    const band = numericBand(input.row);
    return collectModerationQuizFacts({
      type: input.questionType,
      numericReferenceValue: numericReference(input.row, band),
      numericIntervalLeft: input.row.numericIntervalLeft,
      numericIntervalRight: input.row.numericIntervalRight,
      numericStats: {
        n: aggregation.responseCount,
        median: aggregation.median,
        stdDev: aggregation.standardDeviation,
        inBandPercent: aggregation.inBandPercent,
      },
      numericHistogram: aggregation.histogram,
      numericRoundComparison: aggregation.roundComparison
        ? {
            inBandPercentDelta: aggregation.roundComparison.inBandPercentDelta,
            pairedAnalysis: aggregation.roundComparison.pairedAnalysis
              ? {
                  closerCount: aggregation.roundComparison.pairedAnalysis.closerCount,
                  fartherCount: aggregation.roundComparison.pairedAnalysis.fartherCount,
                }
              : null,
          }
        : null,
    }).filter(isSupportedFact);
  }
  return [];
}

function buildRowSources(
  row: ReleasedQuizRow,
  actualQuizId: string,
): {
  sources: ModerationPromptSource[];
  insight: ReleasedQuizInsight | null;
  detailFactInputsTruncated: boolean;
} {
  const scopeId = quizScopeId(actualQuizId);
  const questionSourceId = quizQuestionSourceId(row.questionId);
  const questionText = truncateSchemaString(row.text, 500);
  const questionSource = ModerationPromptSourceSchema.parse({
    id: questionSourceId,
    kind: 'quiz-question',
    quizScopeId: scopeId,
    text: questionText.text || 'Question',
    truncated: questionText.truncated || questionText.text.length === 0,
  });
  const aggregates: Extract<ModerationPromptSource, { kind: 'quiz-result-aggregate' }>[] = [];
  const effectiveResponses = asCount(row.effectiveResponseCount);
  const participantCount = asCount(row.participantCount);

  if (['MULTIPLE_CHOICE', 'SINGLE_CHOICE', 'SURVEY'].includes(row.type)) {
    const options = optionBuckets(row.options);
    if (options.length > 0) {
      const labels = uniqueOptionLabels(options);
      const selectionCount = options.reduce((sum, option) => sum + Number(option.count), 0);
      const maximumPerResponse = row.type === 'SINGLE_CHOICE' ? 1 : options.length;
      if (
        selectionCount >= effectiveResponses &&
        selectionCount <= effectiveResponses * maximumPerResponse
      ) {
        aggregates.push(
          ModerationPromptSourceSchema.parse({
            id: aggregateSourceId(row.questionId, 'answers'),
            kind: 'quiz-result-aggregate',
            label: 'Released answer distribution',
            scope: { kind: 'question', quizScopeId: scopeId, questionSourceId },
            voteBasis: {
              kind: 'effective-vote',
              version: MODERATION_QUIZ_EFFECTIVE_VOTE_BASIS_VERSION,
            },
            population: {
              kind: 'eligible-submissions',
              eligible: participantCount,
              included: effectiveResponses,
            },
            aggregation: {
              rule: 'answer-distribution',
              unit: 'selections',
              optionSet: 'all-answer-options',
              responseCount: effectiveResponses,
              selectionCount,
              selectionCardinality: {
                minimumPerResponse: 1,
                maximumPerResponse,
              },
              buckets: options.map((option, index) => ({
                optionId: answerOptionId(option.id),
                label: labels[index]!,
                count: Number(option.count),
              })),
            },
          }) as Extract<ModerationPromptSource, { kind: 'quiz-result-aggregate' }>,
        );
      }
    }
  }

  if (row.type === 'FREETEXT' || row.type === 'SHORT_TEXT') {
    const responses = completeFreeTextResponses(row);
    if (responses) {
      aggregates.push(
        ModerationPromptSourceSchema.parse({
          id: aggregateSourceId(row.questionId, 'freetext-patterns'),
          kind: 'quiz-result-aggregate',
          label: 'Released free-text pattern summary',
          scope: { kind: 'question', quizScopeId: scopeId, questionSourceId },
          voteBasis: {
            kind: 'effective-vote',
            version: MODERATION_QUIZ_EFFECTIVE_VOTE_BASIS_VERSION,
          },
          population: {
            kind: 'eligible-submissions',
            eligible: participantCount,
            included: effectiveResponses,
          },
          aggregation: {
            rule: 'freetext-pattern-summary',
            unit: 'responses',
            responseCount: effectiveResponses,
            repeatedPatterns: repeatedFreeTextPatterns(responses),
          },
        }) as Extract<ModerationPromptSource, { kind: 'quiz-result-aggregate' }>,
      );
    }
  }

  if (
    [
      'MULTIPLE_CHOICE',
      'SINGLE_CHOICE',
      'SHORT_TEXT',
      'MATCHING',
      'ORDERING',
      'CATEGORIZATION',
    ].includes(row.type)
  ) {
    const correct = asCount(row.correctCount);
    const incorrect = asCount(row.incorrectCount);
    const unanswered = asCount(row.unansweredCount);
    const round2ResponseCount = asCount(row.round2ResponseCount);
    const roundComparison =
      Number(row.effectiveRound) === 2 && round2ResponseCount > 0
        ? {
            basis: {
              kind: 'round-comparison' as const,
              version: MODERATION_QUIZ_ROUND_COMPARISON_BASIS_VERSION,
            },
            round1: {
              responseCount: asCount(row.round1ResponseCount),
              correct: asCount(row.round1CorrectCount),
              incorrect: asCount(row.round1IncorrectCount),
            },
            round2: {
              responseCount: round2ResponseCount,
              correct: asCount(row.round2CorrectCount),
              incorrect: asCount(row.round2IncorrectCount),
            },
          }
        : undefined;
    aggregates.push(
      ModerationPromptSourceSchema.parse({
        id: aggregateSourceId(row.questionId, 'correctness'),
        kind: 'quiz-result-aggregate',
        label: 'Released correctness summary',
        scope: { kind: 'question', quizScopeId: scopeId, questionSourceId },
        voteBasis: {
          kind: 'effective-vote',
          version: MODERATION_QUIZ_EFFECTIVE_VOTE_BASIS_VERSION,
        },
        population: {
          kind: 'eligible-submissions',
          eligible: participantCount,
          included: correct + incorrect + unanswered,
        },
        aggregation: {
          rule: 'correctness-summary',
          unit: 'responses',
          correct,
          incorrect,
          unanswered,
          ...(roundComparison ? { roundComparison } : {}),
        },
      }) as Extract<ModerationPromptSource, { kind: 'quiz-result-aggregate' }>,
    );
  }

  if (row.type === 'RATING') {
    const minimum = Math.max(0, Math.min(9, row.ratingMin ?? 1));
    const maximum = Math.max(minimum + 1, Math.min(10, row.ratingMax ?? 5));
    const observedBuckets = ratingBuckets(row.ratingBuckets).filter(
      (bucket) => bucket.value >= minimum && bucket.value <= maximum,
    );
    const expectedResponseCount = asCount(row.ratingValueCount);
    const countsByValue = new Map(
      observedBuckets.map((bucket) => [bucket.value, Number(bucket.count)]),
    );
    const buckets = Array.from({ length: maximum - minimum + 1 }, (_, index) => ({
      value: minimum + index,
      count: countsByValue.get(minimum + index) ?? 0,
    }));
    const responseCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    if (responseCount === expectedResponseCount) {
      const mean =
        responseCount === 0
          ? null
          : buckets.reduce((sum, bucket) => sum + bucket.value * bucket.count, 0) / responseCount;
      aggregates.push(
        ModerationPromptSourceSchema.parse({
          id: aggregateSourceId(row.questionId, 'rating'),
          kind: 'quiz-result-aggregate',
          label: 'Released rating summary',
          scope: { kind: 'question', quizScopeId: scopeId, questionSourceId },
          voteBasis: {
            kind: 'effective-vote',
            version: MODERATION_QUIZ_EFFECTIVE_VOTE_BASIS_VERSION,
          },
          population: {
            kind: 'eligible-submissions',
            eligible: participantCount,
            included: responseCount,
          },
          aggregation: {
            rule: 'rating-summary',
            unit: 'ratings',
            responseCount,
            scale: { minimum, maximum },
            mean,
            buckets,
          },
        }) as Extract<ModerationPromptSource, { kind: 'quiz-result-aggregate' }>,
      );
    }
  }

  if (row.type === 'NUMERIC_ESTIMATE') {
    const values = completeBoundedNumberArray(row.numericValues, row.numericValueCount);
    const band = numericBand(row);
    const stats = values ? numericStats(values, band) : null;
    const histogram = values ? numericHistogram(values, band) : null;
    if (values && stats && histogram !== null) {
      const roundComparison = numericRoundComparison(row, band);
      aggregates.push(
        ModerationPromptSourceSchema.parse({
          id: aggregateSourceId(row.questionId, 'numeric'),
          kind: 'quiz-result-aggregate',
          label: 'Released numeric summary',
          scope: { kind: 'question', quizScopeId: scopeId, questionSourceId },
          voteBasis: {
            kind: 'effective-vote',
            version: MODERATION_QUIZ_EFFECTIVE_VOTE_BASIS_VERSION,
          },
          population: {
            kind: 'eligible-submissions',
            eligible: participantCount,
            included: stats.responseCount,
          },
          aggregation: {
            rule: 'numeric-summary',
            unit: 'numeric-responses',
            responseCount: stats.responseCount,
            median: stats.median,
            standardDeviation: stats.standardDeviation,
            inBandCount: stats.inBandCount,
            inBandPercent: stats.inBandPercent,
            ...(histogram === undefined ? {} : { histogram }),
            ...(roundComparison ? { roundComparison } : {}),
          },
        }) as Extract<ModerationPromptSource, { kind: 'quiz-result-aggregate' }>,
      );
    }
  }

  const detailFactInputsTruncated =
    (asCount(row.effectiveResponseCount) > INTERNAL_DETAIL_FACT_RESPONSE_LIMIT &&
      ['FREETEXT', 'SHORT_TEXT', 'MATCHING', 'ORDERING', 'CATEGORIZATION'].includes(row.type)) ||
    (row.type === 'NUMERIC_ESTIMATE' &&
      [
        row.numericValueCount,
        row.round1NumericValueCount,
        row.round2NumericValueCount,
        row.numericPairCount,
      ].some((count) => asCount(count) > INTERNAL_DETAIL_FACT_RESPONSE_LIMIT));
  if (aggregates.length === 0) {
    return { sources: [], insight: null, detailFactInputsTruncated };
  }
  const facts = aggregates.flatMap((source) =>
    factsForSource({ questionType: row.type, source, row }).map((fact) => ({
      kind: fact.type,
      reason: factReason(fact),
      sourceId: source.id,
    })),
  );
  const kind: ModerationCompassQuizInsightKind =
    row.type === 'SURVEY' ? 'survey' : row.type === 'RATING' ? 'rating' : 'scorable';
  return {
    sources: [questionSource, ...aggregates],
    insight: {
      questionSourceId,
      aggregateSourceIds: aggregates.map((source) => source.id),
      kind,
      facts,
    },
    detailFactInputsTruncated,
  };
}

function notApplicableReleasedResults(reason: string): ReleasedQuizProjection {
  return {
    releasedResults: { state: 'not-applicable', reason },
    sources: [],
    limitations: [],
    revision: { state: 'not-applicable', reason },
    fingerprint: `released-results:not-applicable:${sha256(reason)}`,
    insights: [],
  };
}

/** N8 quiz projection: one bounded set query, no participant identity columns. */
export async function collectReleasedQuizSignals(input: {
  readonly tx: Prisma.TransactionClient;
  readonly state: AuthorizedModerationState;
}): Promise<ReleasedQuizProjection> {
  if (input.state.type !== 'QUIZ' || !input.state.quizId) {
    return notApplicableReleasedResults('Released quiz results do not apply to this session.');
  }
  const progress = parseSessionQuestionProgress(input.state.questionProgress);
  const completedIds = Object.entries(progress)
    .filter(([, entry]) => entry.state === 'COMPLETED')
    .map(([questionId]) => questionId)
    .sort();
  if (completedIds.length === 0) {
    const reason = 'No quiz question has an authoritative COMPLETED release state.';
    const fingerprint = `released-results-v1:${sha256(
      JSON.stringify({ quizId: input.state.quizId, completedIds }),
    )}`;
    return {
      releasedResults: { state: 'not-released', reason },
      sources: [],
      limitations: [
        limitation({ code: 'not-released', section: 'released-results', detail: reason }),
      ],
      revision: { state: 'available', value: fingerprint },
      fingerprint,
      insights: [],
    };
  }

  const boundedCompletedIds = completedIds.slice(0, COMPLETED_PROGRESS_ID_LIMIT);
  const rows = await loadReleasedQuizRows(input.tx, input.state, boundedCompletedIds);
  if (rows.length === 0) {
    const detail = 'Completed question identifiers no longer resolve inside the authorized quiz.';
    return {
      releasedResults: { state: 'unavailable', reason: 'no-data' },
      sources: [],
      limitations: [
        limitation({ code: 'module-unavailable', section: 'released-results', detail }),
      ],
      revision: { state: 'unavailable', reason: 'no-data' },
      fingerprint: `released-results-invalid:${sha256(completedIds.join(','))}`,
      insights: [],
    };
  }

  const sources: ModerationPromptSource[] = [];
  const insights: ReleasedQuizInsight[] = [];
  let unsupportedCompletedQuestions = 0;
  let truncatedDetailFactQuestions = 0;
  for (const row of rows) {
    const built = buildRowSources(row, input.state.quizId);
    sources.push(...built.sources);
    if (built.insight) insights.push(built.insight);
    if (built.sources.length === 0 && !built.detailFactInputsTruncated) {
      unsupportedCompletedQuestions += 1;
    }
    if (built.detailFactInputsTruncated) truncatedDetailFactQuestions += 1;
  }
  const aggregateIds = sources
    .filter((source) => source.kind === 'quiz-result-aggregate')
    .map((source) => ({ sourceId: source.id }));
  const scopeCount = asCount(rows[0]!.scopeCount);
  const truncated =
    completedIds.length > COMPLETED_PROGRESS_ID_LIMIT || scopeCount > RELEASED_QUESTION_LIMIT;
  const limitations: ModerationLimitation[] = [];
  if (truncated) {
    limitations.push(
      limitation({
        code: 'budget-truncated',
        section: 'released-results',
        detail: `Released quiz evidence was deterministically limited to ${RELEASED_QUESTION_LIMIT} completed questions.`,
      }),
    );
  }
  if (scopeCount < boundedCompletedIds.length) {
    limitations.push(
      limitation({
        code: 'source-redacted',
        section: 'released-results',
        detail:
          'At least one COMPLETED progress identifier did not resolve inside the authorized quiz and was omitted.',
      }),
    );
  }
  if (unsupportedCompletedQuestions > 0) {
    limitations.push(
      limitation({
        code: 'module-unavailable',
        section: 'released-results',
        detail:
          'At least one completed question had no supported, contract-serializable aggregate and was omitted.',
      }),
    );
  }
  if (truncatedDetailFactQuestions > 0) {
    limitations.push(
      limitation({
        code: 'budget-truncated',
        section: 'released-results',
        detail: `Raw released-result evidence was omitted for ${truncatedDetailFactQuestions} question(s) above the ${INTERNAL_DETAIL_FACT_RESPONSE_LIMIT}-response bound; aggregates that could not remain complete were omitted.`,
      }),
    );
  }
  const material = canonicalJson({
    quizId: input.state.quizId,
    completedIds,
    scopeCount,
    unsupportedCompletedQuestions,
    truncatedDetailFactQuestions,
    sources,
    insights,
  });
  const fingerprint = `released-results-v1:${sha256(material)}`;
  if (aggregateIds.length === 0) {
    return {
      releasedResults: { state: 'unavailable', reason: 'not-supported' },
      sources: [],
      limitations,
      revision: { state: 'available', value: fingerprint },
      fingerprint,
      insights: [],
    };
  }
  return {
    releasedResults: { state: 'available', aggregates: aggregateIds },
    sources,
    limitations,
    revision: { state: 'available', value: fingerprint },
    fingerprint,
    insights,
  };
}

function factReason(fact: SupportedQuizFact): string {
  switch (fact.type) {
    case 'wrong-majority':
      return `Incorrect released responses outnumber correct responses (${fact.incorrect}/${fact.total}).`;
    case 'in-band':
      return `Only ${fact.percent}% of released numeric responses are inside the expected band.`;
    case 'numeric-round-worse':
      return `The expected-band share fell by ${fact.percentPoints} percentage points in round 2.`;
    case 'numeric-round-farther':
      return 'More paired round-2 estimates moved farther than closer under the stored comparison.';
    case 'matching-confusion':
      return 'A recurring mismatch pattern appears in the released matching responses.';
    case 'ordering-swap':
      return 'A recurring reciprocal swap appears in the released ordering responses.';
    case 'categorization-miss':
      return 'A recurring misclassification pattern appears in the released categorization responses.';
    case 'wrong-option':
      return 'The authoritative released evaluation found a recurring incorrect-option pattern.';
    case 'numeric-spread':
      return 'The released numeric responses are broadly dispersed relative to the expected band.';
    case 'numeric-median':
      return 'The released numeric median is materially separated from the authoritative reference.';
    case 'survey-top':
      return `The leading released survey option has a ${fact.share}% response share.`;
    case 'histogram-peak-out':
      return `The strongest released numeric cluster lies outside the expected band (${fact.share}%).`;
    case 'round-drop':
      return 'The released round-2 correctness count is lower than round 1.';
    case 'rating-low':
      return `The released rating average is ${fact.avg.toFixed(1)}.`;
    case 'freetext-repeat':
      return `The same normalized free-text response recurs across ${fact.count} released submissions.`;
  }
}

function compassSource(id: string, label: string): ModerationPromptSource {
  return ModerationPromptSourceSchema.parse({ id, kind: 'compass-signal', label });
}

function feedbackReason(decision: ModerationCompassFeedbackDecision): string {
  switch (decision.trigger.type) {
    case 'rating-low':
      return `The quick-feedback rating average is ${decision.trigger.average.toFixed(2)}.`;
    case 'split':
      return 'The released quick-feedback responses form a notable split.';
    case 'negative-majority':
      return `A negative quick-feedback option has a ${Math.round(decision.trigger.share * 100)}% majority.`;
    case 'tempo-trend':
      return `The bounded tempo trend is ${decision.trigger.status}.`;
  }
}

/** N9 deterministic projection; all prioritization comes from the shared planner. */
export function buildCompassContext(input: {
  readonly released: ReleasedQuizProjection;
  readonly feedback: QuickFeedbackModerationProjection;
  readonly questions?: ModerationQuestionsSection;
  readonly topics?: ModerationTopicsSection;
  readonly activeSortMode?: AuthorizedModerationState['activeSortMode'];
}): ModerationCompassProjection {
  const questions = input.questions?.state === 'available' ? input.questions : null;
  const topics = input.topics?.state === 'available' ? input.topics : null;
  const participantBasis =
    questions?.participantBasis.state === 'available' ? questions.participantBasis.value : 0;
  const controversyThreshold = resolveQaControversyThreshold(participantBasis);
  const ruleQuestions = (questions?.items ?? []).map((question) => {
    const votes = question.votes.state === 'available' ? question.votes : null;
    const controversyScore =
      votes?.controversyScore.state === 'available' ? votes.controversyScore.value : 0;
    return {
      sourceId: question.sourceId,
      status: question.status,
      positiveVoteCount: votes?.positive ?? 0,
      negativeVoteCount: votes?.negative ?? 0,
      score: votes?.net ?? 0,
      bestScore: votes?.bestScore.state === 'available' ? votes.bestScore.value : 0,
      controversyScore,
      isControversial: isQaControversialLabel({
        controversyScore,
        voteCount: votes?.total ?? 0,
        controversyThreshold,
      }),
    } as const;
  });
  const pendingQuestionSourceIds = selectPendingModerationQuestionSourceIds(
    ruleQuestions,
    input.activeSortMode,
  );
  const frictionQuestionSourceIds = selectFrictionQuestionSourceIds(
    ruleQuestions.filter((question) => question.status !== 'PENDING'),
  );
  const classifiedGroups = [...(questions?.items ?? [])]
    .reduce((groups, question) => {
      if (question.status === 'PENDING' || question.nlp.state !== 'classified') return groups;
      const ids = groups.get(question.nlp.category) ?? [];
      ids.push(question.sourceId);
      groups.set(question.nlp.category, ids);
      return groups;
    }, new Map<'content' | 'organization' | 'technical', string[]>())
    .entries();
  const allClassifiedGroups = [...classifiedGroups]
    .map(([category, sourceIds]) => ({
      category,
      sourceIds: sourceIds.sort((left, right) => left.localeCompare(right)),
      selectorSourceId: `topic-candidate:nlp-category.${category}`,
    }))
    .sort(
      (left, right) =>
        right.sourceIds.length - left.sourceIds.length ||
        left.category.localeCompare(right.category),
    );
  const pinnedTopicCandidates = (questions?.items ?? [])
    .filter((question) => question.status === 'PINNED')
    .map((question) => question.sourceId)
    .slice(0, 2)
    .map((questionSourceId) => ({
      questionSourceId,
      selectorSourceId: `topic-candidate:pinned.${sha256(questionSourceId).slice(0, 32)}`,
    }));
  const allResultFacts = input.released.insights.flatMap((insight) =>
    insight.facts.map((fact, factIndex) => ({
      ...fact,
      questionSourceId: insight.questionSourceId,
      insightKind: insight.kind,
      factIndex,
    })),
  );
  const quizResultSourceIds = allResultFacts.map((fact) => fact.sourceId);
  const feedbackDecision = input.feedback.ruleInput
    ? collectModerationFeedbackDecision(input.feedback.ruleInput)
    : null;
  const feedbackSourceId =
    feedbackDecision && input.feedback.feedback.state === 'available'
      ? input.feedback.feedback.aggregates[0]?.sourceId
      : undefined;
  const questionStatusBySourceId = new Map(
    (questions?.items ?? []).map((question) => [question.sourceId, question.status]),
  );
  const eligibleSemanticTopics =
    topics?.items.filter((topic) =>
      topic.memberQuestionSourceIds.every(
        (sourceId) => questionStatusBySourceId.get(sourceId) !== 'PENDING',
      ),
    ) ?? [];
  const semanticTopicCandidates = eligibleSemanticTopics.map((topic) => ({
    sourceId: topic.sourceId,
    documentFrequency: topic.aggregates.questionCount,
    sourceCount: topic.aggregates.questionCount,
  }));
  const semanticTopicSourceIds = semanticTopicCandidates.map((topic) => topic.sourceId);
  const topicSourceIds = selectModerationCompassTopicSourceIds({
    classified: allClassifiedGroups.map((group) => ({
      sourceId: group.selectorSourceId,
      dedupeKey: `nlp-category:${group.category}`,
    })),
    qaTerms: semanticTopicCandidates,
    freetextTerms: [],
    extras: [
      ...pinnedTopicCandidates.map((candidate) => ({
        sourceId: candidate.selectorSourceId,
      })),
    ],
  });
  const plan = planModerationCompass({
    topicSourceIds,
    pendingQuestionSourceIds,
    frictionQuestionSourceIds,
    quizResultSourceIds,
    quizInsightKind: allResultFacts[0]?.insightKind ?? null,
    feedback:
      feedbackDecision && feedbackSourceId
        ? {
            sourceId: feedbackSourceId,
            tone: feedbackDecision.tone,
            variant: feedbackDecision.variant,
          }
        : null,
  });

  const topicCardSourceIds = plan.cards.find((card) => card.kind === 'topics')?.sourceIds ?? [];
  const clarificationCardSourceIds =
    plan.cards.find((card) => card.kind === 'clarification')?.sourceIds ?? [];
  const frictionCardSourceIds =
    plan.cards.find((card) => card.kind === 'friction')?.sourceIds ?? [];
  const topicCardSourceSet = new Set(topicCardSourceIds);
  const clarificationCardSourceSet = new Set(clarificationCardSourceIds);
  const selectedClassifiedGroups = allClassifiedGroups
    .filter((group) => topicCardSourceSet.has(group.selectorSourceId))
    .map((group) => ({ ...group, sourceIds: group.sourceIds.slice(0, 40) }));
  const selectedPinnedQuestionSourceIds = pinnedTopicCandidates
    .filter((candidate) => topicCardSourceSet.has(candidate.selectorSourceId))
    .map((candidate) => candidate.questionSourceId);
  const selectedSemanticTopicSourceIds = semanticTopicSourceIds.filter((sourceId) =>
    topicCardSourceSet.has(sourceId),
  );
  const selectedPendingQuestionSourceIds = pendingQuestionSourceIds.filter((sourceId) =>
    clarificationCardSourceSet.has(sourceId),
  );
  const selectedResultFacts = allResultFacts.filter((fact) =>
    clarificationCardSourceSet.has(fact.sourceId),
  );
  const resultFacts = selectedResultFacts.slice(0, RESULT_SIGNAL_LIMIT);

  const signals: CompassSignal[] = [];
  const signalSources: ModerationPromptSource[] = [];
  const compassLimitations: ModerationLimitation[] = [];
  const topicSignalSourceIdByPlannerSourceId = new Map<string, string>();
  if (
    allClassifiedGroups.some(
      (group) => topicCardSourceSet.has(group.selectorSourceId) && group.sourceIds.length > 40,
    )
  ) {
    compassLimitations.push(
      limitation({
        code: 'budget-truncated',
        section: 'compass',
        detail:
          'Q&A evidence for a selected classified topic signal was deterministically limited to 40 questions.',
      }),
    );
  }
  if (selectedResultFacts.length > resultFacts.length) {
    compassLimitations.push(
      limitation({
        code: 'budget-truncated',
        section: 'compass',
        detail: `Released-result signals were deterministically limited to ${RESULT_SIGNAL_LIMIT} rule facts.`,
      }),
    );
  }
  const addSignal = (signal: CompassSignal, label: string): boolean => {
    if (signals.length >= 30) return false;
    signals.push(signal);
    signalSources.push(compassSource(signal.sourceId, label));
    return true;
  };
  if (selectedPendingQuestionSourceIds.length > 0) {
    const sourceId = `compass-signal:pending.${sha256(selectedPendingQuestionSourceIds.join(','))}`;
    addSignal(
      {
        sourceId,
        signal: 'pending-moderation',
        basis: 'pending-question-count',
        cardKind: 'clarification',
        questionSourceIds: selectedPendingQuestionSourceIds,
        value: selectedPendingQuestionSourceIds.length,
        reason: `${selectedPendingQuestionSourceIds.length} selected Q&A question(s) await host moderation.`,
        evidence: selectedPendingQuestionSourceIds.map((questionSourceId) => ({
          sourceId: questionSourceId,
          detail: 'This question is explicitly in PENDING moderation state.',
        })),
        suggestedNextStep: {
          action: 'review-moderation',
          rationale: 'Review the pending queue before diagnosing a learning need.',
        },
      },
      'Pending moderation',
    );
  }
  if (frictionCardSourceIds.length > 0) {
    const questionsBySourceId = new Map(
      ruleQuestions.map((question) => [question.sourceId, question]),
    );
    const leadingQuestion = questionsBySourceId.get(frictionCardSourceIds[0]!);
    if (!leadingQuestion) throw new Error('Missing selected Q&A friction evidence.');
    const sourceId = `compass-signal:friction.${sha256(frictionCardSourceIds.join(','))}`;
    addSignal(
      {
        sourceId,
        signal: 'high-controversy',
        basis: 'controversy-score',
        cardKind: 'friction',
        questionSourceIds: [...frictionCardSourceIds],
        value: leadingQuestion.controversyScore,
        reason:
          'The selected authoritative Q&A controversy scores exceed the visible-label threshold.',
        evidence: frictionCardSourceIds.map((sourceId) => ({
          sourceId,
          detail: 'Authoritative Q&A controversy evidence.',
        })),
        suggestedNextStep: {
          action: 'open-discussion',
          rationale: 'Invite clarification around the contested questions.',
        },
      },
      'Q&A controversy',
    );
  }

  for (const group of selectedClassifiedGroups) {
    if (group.sourceIds.length === 0) continue;
    const sourceId = `compass-signal:nlp-category.${sha256(
      `${group.category}:${group.sourceIds.join(',')}`,
    )}`;
    if (
      addSignal(
        {
          sourceId,
          signal: 'high-frequency',
          basis: 'question-frequency',
          cardKind: 'topics',
          questionSourceIds: group.sourceIds,
          value: group.sourceIds.length,
          reason: `${group.sourceIds.length} selected Q&A question(s) share the stored ${group.category} classification.`,
          evidence: group.sourceIds.map((questionSourceId) => ({
            sourceId: questionSourceId,
            detail: `Stored Q&A NLP category: ${group.category}.`,
          })),
          suggestedNextStep: {
            action: 'address-question',
            rationale: 'Address the classified question group as a bounded topic cue.',
          },
        },
        'Q&A classification group',
      )
    ) {
      topicSignalSourceIdByPlannerSourceId.set(group.selectorSourceId, sourceId);
    }
  }

  if (selectedPinnedQuestionSourceIds.length > 0) {
    const sourceId = `compass-signal:pinned.${sha256(selectedPinnedQuestionSourceIds.join(','))}`;
    if (
      addSignal(
        {
          sourceId,
          signal: 'pinned-question',
          basis: 'pinned-question-count',
          cardKind: 'topics',
          questionSourceIds: selectedPinnedQuestionSourceIds,
          value: selectedPinnedQuestionSourceIds.length,
          reason: `${selectedPinnedQuestionSourceIds.length} selected Q&A question(s) are explicitly pinned by the host.`,
          evidence: selectedPinnedQuestionSourceIds.map((questionSourceId) => ({
            sourceId: questionSourceId,
            detail: 'The host explicitly pinned this Q&A question.',
          })),
          suggestedNextStep: {
            action: 'address-question',
            rationale: 'Keep the host-highlighted questions visible in the discussion.',
          },
        },
        'Pinned Q&A questions',
      )
    ) {
      for (const candidate of pinnedTopicCandidates) {
        if (selectedPinnedQuestionSourceIds.includes(candidate.questionSourceId)) {
          topicSignalSourceIdByPlannerSourceId.set(candidate.selectorSourceId, sourceId);
        }
      }
    }
  }

  const leadingTopic = eligibleSemanticTopics.find((topic) =>
    selectedSemanticTopicSourceIds.includes(topic.sourceId),
  );
  if (
    topics &&
    leadingTopic &&
    topics.corpus.eligibleQuestions > 0 &&
    selectedSemanticTopicSourceIds.length > 0
  ) {
    const sourceId = `compass-signal:topic.${sha256(selectedSemanticTopicSourceIds.join(','))}`;
    if (
      addSignal(
        {
          sourceId,
          signal: 'topic-concentration',
          basis: 'topic-question-share',
          cardKind: 'topics',
          questionSourceIds: [],
          value: Math.min(
            1,
            leadingTopic.aggregates.questionCount / topics.corpus.eligibleQuestions,
          ),
          reason:
            'The available semantic-topic snapshot represents measurable shares of the eligible question corpus.',
          evidence: selectedSemanticTopicSourceIds.map((sourceId) => ({
            sourceId,
            detail: 'Stored semantic-topic membership from the analyzed snapshot.',
          })),
          suggestedNextStep: {
            action: 'monitor',
            rationale: 'Monitor whether this topic continues to dominate the question corpus.',
          },
        },
        'Topic concentration',
      )
    ) {
      for (const semanticTopicSourceId of selectedSemanticTopicSourceIds) {
        topicSignalSourceIdByPlannerSourceId.set(semanticTopicSourceId, sourceId);
      }
    }
  }
  for (const fact of resultFacts) {
    const sourceId = `compass-signal:quiz.${sha256(
      `${fact.questionSourceId}:${fact.kind}:${fact.factIndex}`,
    )}`;
    addSignal(
      {
        sourceId,
        signal: 'result-pattern',
        basis: 'released-result-rule-score',
        cardKind: 'clarification',
        questionSourceIds: [],
        value: 1,
        reason: fact.reason,
        evidence: [{ sourceId: fact.sourceId, detail: fact.reason }],
        suggestedNextStep: {
          action: fact.insightKind === 'survey' ? 'monitor' : 'request-clarification',
          rationale:
            fact.insightKind === 'survey'
              ? 'Use the released survey pattern as context without treating it as correctness.'
              : 'Clarify the released result pattern with the group.',
        },
      },
      'Released quiz result pattern',
    );
  }
  if (feedbackDecision && feedbackSourceId) {
    const sourceId = `compass-signal:feedback.${sha256(feedbackSourceId)}`;
    addSignal(
      {
        sourceId,
        signal: 'feedback-pattern',
        basis: 'feedback-rule-score',
        cardKind: 'tempo',
        questionSourceIds: [],
        value: feedbackDecision.ruleScore,
        reason: feedbackReason(feedbackDecision),
        evidence: [{ sourceId: feedbackSourceId, detail: feedbackReason(feedbackDecision) }],
        suggestedNextStep: {
          action: feedbackDecision.trigger.type === 'split' ? 'open-discussion' : 'monitor',
          rationale: 'Respond to the measured quick-feedback pattern without inferring absence.',
        },
      },
      'Quick-feedback pattern',
    );
  }

  const preferredSignal = (() => {
    switch (plan.recommendation?.reason) {
      case 'quiz-confusion':
      case 'quiz-survey':
      case 'quiz-rating':
        return signals.find((signal) => signal.signal === 'result-pattern');
      case 'feedback':
      case 'tempo':
      case 'steady':
        return signals.find((signal) => signal.signal === 'feedback-pattern');
      case 'pending-qa':
        return signals.find((signal) => signal.signal === 'pending-moderation');
      case 'controversy':
        return signals.find((signal) => signal.signal === 'high-controversy');
      case 'topics': {
        const plannerPrimarySignalSourceId = topicCardSourceIds[0]
          ? topicSignalSourceIdByPlannerSourceId.get(topicCardSourceIds[0])
          : undefined;
        return (
          signals.find((signal) => signal.sourceId === plannerPrimarySignalSourceId) ??
          signals.find((signal) => signal.cardKind === 'topics')
        );
      }
      default:
        return undefined;
    }
  })();
  return {
    compass: ModerationCompassSectionSchema.parse({
      state: 'available',
      rulesVersion: MODERATION_COMPASS_RULES_VERSION,
      signals,
      primarySignalSourceId: preferredSignal?.sourceId ?? signals[0]?.sourceId ?? null,
    }),
    sources: signalSources,
    limitations: compassLimitations,
  };
}

/**
 * Internal N8/N9 host-only orchestration. It is intentionally not registered
 * on a router; N10 can combine it with the separately authorized Q&A fragment.
 */
export async function buildAuthorizedModerationTeachingSignals(input: {
  readonly sessionId: string;
  readonly access: HostTokenContext;
  readonly clock?: { readonly now: () => Date };
}): Promise<AuthorizedModerationTeachingSignals> {
  const initial = await loadAuthorizedModerationState(input);
  const initialFeedback = await loadQuickFeedbackModerationSnapshot({
    sessionId: initial.id,
    sessionCode: initial.code,
    enabled: initial.quickFeedbackEnabled,
    eligibleResponses: initial.participantCount,
    observedAt: initial.authorizedAt,
  });
  const released = await prisma.$transaction(
    (tx) => collectReleasedQuizSignals({ tx, state: initial }),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  const current = await loadAuthorizedModerationState(input);
  assertModerationStateStillCurrent(initial, current);

  const [confirmedReleased, confirmedFeedback] = await Promise.all([
    prisma.$transaction((tx) => collectReleasedQuizSignals({ tx, state: initial }), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    }),
    loadQuickFeedbackModerationSnapshot({
      sessionId: initial.id,
      sessionCode: initial.code,
      enabled: initial.quickFeedbackEnabled,
      eligibleResponses: initial.participantCount,
      observedAt: initial.authorizedAt,
    }),
  ]);
  if (
    released.fingerprint !== confirmedReleased.fingerprint ||
    initialFeedback.fingerprint !== confirmedFeedback.fingerprint
  ) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Released teaching evidence changed while the moderation context was built.',
    });
  }
  const final = await loadAuthorizedModerationState(input);
  assertModerationStateStillCurrent(initial, final);
  const compass = buildCompassContext({ released, feedback: initialFeedback });
  return {
    state: final,
    releasedResults: released.releasedResults,
    feedback: initialFeedback.feedback,
    compass: compass.compass,
    sources: [...released.sources, ...initialFeedback.sources, ...compass.sources],
    limitations: [...released.limitations, ...initialFeedback.limitations, ...compass.limitations],
    revisions: {
      releasedResults: released.revision,
      feedback: initialFeedback.revision,
    },
  };
}

export const moderationTeachingSignalsInternals = {
  buildRowSources,
  numericHistogram,
  numericStats,
  factsForSource,
};
