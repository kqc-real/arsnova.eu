import { Prisma } from '@prisma/client';
import {
  QA_CONTROVERSY_DAMPING,
  QA_RANKING_VERSION,
  type QaQuestionSortMode,
} from '@arsnova/shared-types';

const QA_WILSON_Z = 1.96;
const QA_WILSON_Z_SQUARED = QA_WILSON_Z * QA_WILSON_Z;

/** Prisma/pg otherwise derives uncast numeric parameters beside INT columns as integers. */
const QA_WILSON_Z_SQL = Prisma.sql`${QA_WILSON_Z}::DOUBLE PRECISION`;
const QA_WILSON_Z_SQUARED_SQL = Prisma.sql`${QA_WILSON_Z_SQUARED}::DOUBLE PRECISION`;

export function qaRankingCorpusRevision(revision: number, metric: QaQuestionSortMode): string {
  return `${revision}:${metric === 'CONTROVERSIAL' ? QA_RANKING_VERSION : ''}`;
}

/** The calling query must use `question` as its QaQuestion alias. */
export function buildQaRankingScoreSelectSql(): Prisma.Sql {
  return Prisma.sql`
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
    2.0::DOUBLE PRECISION * LEAST(question."positiveVoteCount", question."negativeVoteCount")
      / (
        question."positiveVoteCount"::DOUBLE PRECISION
        + question."negativeVoteCount"
        + ${QA_CONTROVERSY_DAMPING}::DOUBLE PRECISION
      ) AS "controversyScore"
  `;
}

/** Metric portion only; callers retain their established status and stable tie breakers. */
export function buildQaRankingMetricOrderSql(
  sortMode: QaQuestionSortMode,
  rowAlias: 'ranked' | 'page' = 'ranked',
): Prisma.Sql {
  if (rowAlias === 'page') {
    if (sortMode === 'BEST') {
      return Prisma.sql`page."bestScore" DESC, page."positiveVoteCount" DESC, page."upvoteCount" DESC,`;
    }
    if (sortMode === 'CONTROVERSIAL') {
      return Prisma.sql`page."controversyScore" DESC, page."positiveVoteCount" DESC, page."upvoteCount" DESC,`;
    }
    if (sortMode === 'TIME') {
      return Prisma.sql`page."createdAt" DESC,`;
    }
    return Prisma.sql`page."upvoteCount" DESC,`;
  }

  if (sortMode === 'BEST') {
    return Prisma.sql`ranked."bestScore" DESC, ranked."positiveVoteCount" DESC, ranked."upvoteCount" DESC,`;
  }
  if (sortMode === 'CONTROVERSIAL') {
    return Prisma.sql`ranked."controversyScore" DESC, ranked."positiveVoteCount" DESC, ranked."upvoteCount" DESC,`;
  }
  if (sortMode === 'TIME') {
    return Prisma.sql`ranked."createdAt" DESC,`;
  }
  return Prisma.sql`ranked."upvoteCount" DESC,`;
}
