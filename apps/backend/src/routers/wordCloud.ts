import {
  AnalyzeQaWordCloudInputSchema,
  AnalyzeQaWordCloudOutputSchema,
  type AnalyzeQaWordCloudOutput,
  QA_WORD_CLOUD_MAX_EXPLANATION_MEMBERS,
  QA_WORD_CLOUD_MAX_EXPLANATION_TEXT_CHARS,
  QA_WORD_CLOUD_MAX_OUTPUT_ENTRIES,
  type AnalyzeWordCloudInput,
  AnalyzeWordCloudInputSchema,
  AnalyzeWordCloudOutputSchema,
  type AnalyzeWordCloudOutput,
  isWordCloudPhraseAnalysisVariant,
} from '@arsnova/shared-types';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db';
import {
  buildLexicalWordCloudEntries,
  buildThemeWordCloudAnalysis,
} from '../lib/wordCloudAnalysis';
import {
  getWordCloudAnalysisCache,
  type WordCloudAnalysisCache,
} from '../lib/wordCloudAnalysisCache';
import {
  normalizeWordCloudItems,
  type NormalizeWordCloudOptions,
} from '../lib/wordCloudNormalizer';
import type { WordCloudNormalizationMeta } from '../lib/wordCloudNormalization';
import {
  beginWordCloudAnalysisTelemetry,
  recordWordCloudAnalyzeTelemetry,
} from '../lib/wordCloudNlpTelemetry';
import { acquireQaWordCloudAnalysisLock } from '../lib/qaWordCloudAnalysisLock';
import { analyzeSemanticWordCloudSnapshot } from '../lib/wordCloudSemanticAnalyze';
import { hostProcedure, router } from '../trpc';

export interface AnalyzeWordCloudSnapshotOptions {
  readonly cache?: WordCloudAnalysisCache;
  readonly normalize?: typeof normalizeWordCloudItems;
  readonly env?: NodeJS.ProcessEnv;
  readonly sidecar?: NormalizeWordCloudOptions['sidecar'];
  readonly compactOutput?: (output: AnalyzeWordCloudOutput) => AnalyzeWordCloudOutput;
}

function buildAnalysisOutput(
  input: AnalyzeWordCloudInput,
  entries: AnalyzeWordCloudOutput['entries'],
  themeFallbackUsed: boolean,
  meta: WordCloudNormalizationMeta,
): AnalyzeWordCloudOutput {
  return AnalyzeWordCloudOutputSchema.parse({
    mode: input.mode,
    locale: input.locale,
    metric: input.metric,
    generatedAt: new Date().toISOString(),
    fallbackUsed: themeFallbackUsed,
    status: 'ready',
    modelVersion: null,
    entries,
    ...meta,
  });
}

function analyzeFromNormalized(
  input: AnalyzeWordCloudInput,
  normalized: Awaited<ReturnType<typeof normalizeWordCloudItems>>,
): AnalyzeWordCloudOutput {
  if (isWordCloudPhraseAnalysisVariant(input.mode)) {
    const analysis = buildThemeWordCloudAnalysis(input);
    if (!analysis.usedThemeAnchors || analysis.entries.length === 0) {
      return buildAnalysisOutput(
        input,
        buildLexicalWordCloudEntries(
          input.items,
          input.locale,
          input.maxEntries,
          normalized.tokensByItemId,
          1,
        ),
        true,
        normalized.meta,
      );
    }
    return buildAnalysisOutput(input, analysis.entries, false, normalized.meta);
  }

  return buildAnalysisOutput(
    input,
    buildLexicalWordCloudEntries(
      input.items,
      input.locale,
      input.maxEntries,
      normalized.tokensByItemId,
      input.maxNgramLength ?? 1,
    ),
    false,
    normalized.meta,
  );
}

/**
 * Host-Analyse inkl. Text-/Snapshot-Cache. Transiente Sidecar-Fehler werden nicht
 * persistiert, damit ein Retry den Dienst erneut versucht.
 */
export async function analyzeWordCloudSnapshot(
  input: AnalyzeWordCloudInput,
  options: AnalyzeWordCloudSnapshotOptions = {},
): Promise<AnalyzeWordCloudOutput> {
  const startedAt = Date.now();
  const cache = options.cache ?? getWordCloudAnalysisCache();
  const normalize = options.normalize ?? normalizeWordCloudItems;

  const cached = input.refresh === true ? null : await cache.getSnapshot(input);
  if (cached) {
    recordWordCloudAnalyzeTelemetry({
      sessionCode: input.sessionCode,
      mode: input.mode,
      metric: input.metric,
      normalization: input.normalization,
      normalizationApplied: cached.normalizationApplied,
      fallbackReason: cached.normalizationFallbackReason,
      durationMs: Date.now() - startedAt,
      itemCount: input.items.length,
      snapshotCache: 'hit',
      textCacheHits: 0,
      textCacheMisses: 0,
      sidecarCalled: false,
      encoderCalled: false,
    });
    return options.compactOutput?.(cached) ?? cached;
  }

  const normalized = await normalize(input, {
    cache,
    env: options.env,
    sidecar: options.sidecar,
  });
  const rawOutput =
    input.mode === 'SEMANTIC'
      ? await analyzeSemanticWordCloudSnapshot(input, normalized.meta, {
          env: options.env,
          tokensByItemId: normalized.tokensByItemId,
        })
      : analyzeFromNormalized(input, normalized);
  const output = options.compactOutput?.(rawOutput) ?? rawOutput;
  await cache.setSnapshot(input, output);
  recordWordCloudAnalyzeTelemetry({
    sessionCode: input.sessionCode,
    mode: input.mode,
    metric: input.metric,
    normalization: input.normalization,
    normalizationApplied: output.normalizationApplied,
    fallbackReason: output.normalizationFallbackReason,
    durationMs: Date.now() - startedAt,
    itemCount: input.items.length,
    snapshotCache: 'miss',
    textCacheHits: normalized.cache.textHits,
    textCacheMisses: normalized.cache.textMisses,
    sidecarCalled: normalized.cache.sidecarCalled,
    encoderCalled: input.mode === 'SEMANTIC' && Boolean(output.modelVersion),
  });
  return output;
}

function truncateQaExplanation(value: string): string {
  return Array.from(value).slice(0, QA_WORD_CLOUD_MAX_EXPLANATION_TEXT_CHARS).join('');
}

function compactQaWordCloudOutput(output: AnalyzeWordCloudOutput): AnalyzeWordCloudOutput {
  return {
    ...output,
    entries: output.entries.slice(0, QA_WORD_CLOUD_MAX_OUTPUT_ENTRIES).map((entry) => {
      const memberCount = entry.memberCount ?? entry.members.length;
      return {
        ...entry,
        key: truncateQaExplanation(entry.key),
        label: truncateQaExplanation(entry.label),
        basisLabel: entry.basisLabel === null ? null : truncateQaExplanation(entry.basisLabel),
        members: entry.members
          .slice(0, QA_WORD_CLOUD_MAX_EXPLANATION_MEMBERS)
          .map((member) => ({ ...member, text: truncateQaExplanation(member.text) })),
        variants: entry.variants.slice(0, 1).map(truncateQaExplanation),
        memberCount,
        membersTruncated:
          entry.membersTruncated === true || memberCount > QA_WORD_CLOUD_MAX_EXPLANATION_MEMBERS,
      };
    }),
  };
}

/**
 * Word-Cloud-Analysepfad für den Host.
 * THEME bleibt der deterministische Phrasen-/Anchor-Pfad ohne spaCy.
 * SEMANTIC (1.14c Stufe 1) clustert Host-Q&A über den privaten Encoder;
 * ohne Kill-Switch oder bei totem Server bleibt der 2.x-Phrasenpfad.
 * LEXICAL + LEMMA glättet über den Sidecar und fällt hart auf Identity zurück.
 * Freitext-Phrasen kommen über `maxNgramLength` 2/3 in denselben LEXICAL-Snapshot;
 * Q&A-Einzelwörter bleiben bei Default 1. THEME-/SEMANTIC-Fallback bleibt unigram-only.
 */
export const wordCloudRouter = router({
  analyze: hostProcedure
    .input(AnalyzeWordCloudInputSchema)
    .output(AnalyzeWordCloudOutputSchema)
    .mutation(({ input }) => analyzeWordCloudSnapshot(input)),

  analyzeQa: hostProcedure
    .input(AnalyzeQaWordCloudInputSchema)
    .use(async ({ input, next }) => {
      let release: (() => Promise<void>) | null;
      try {
        release = await acquireQaWordCloudAnalysisLock(input.sessionCode);
      } catch {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Die Q&A-Analyse ist derzeit nicht verfügbar.',
        });
      }
      if (!release) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Für diese Session läuft bereits eine Q&A-Analyse.',
        });
      }
      const finishTelemetry = beginWordCloudAnalysisTelemetry();
      try {
        return await next();
      } finally {
        finishTelemetry();
        await release().catch(() => undefined);
      }
    })
    .output(AnalyzeQaWordCloudOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const sessionCode = (ctx.hostSessionCode ?? input.sessionCode).toUpperCase();
      if (sessionCode !== input.sessionCode.toUpperCase()) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Host-Token und Session-Code passen nicht zusammen.',
        });
      }
      const session = await prisma.session.findUnique({
        where: { code: sessionCode },
        select: { id: true, qaRankingRevision: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const participantCount =
        input.metric === 'CONTROVERSIAL'
          ? await prisma.participant.count({ where: { sessionId: session.id } })
          : 0;
      const corpusRevision = `${session.qaRankingRevision}:${
        input.metric === 'CONTROVERSIAL' ? participantCount : ''
      }`;
      const statusFilter =
        input.filter === 'PINNED_ONLY'
          ? Prisma.sql`question."status" = 'PINNED'`
          : Prisma.sql`question."status" IN ('PINNED', 'ACTIVE')`;
      const modeOrder =
        input.metric === 'BEST'
          ? Prisma.sql`ranked."bestScore" DESC, ranked."positiveVoteCount" DESC, ranked."upvoteCount" DESC, ranked.status_tie ASC, ranked."createdAt" ASC, ranked."id" ASC`
          : input.metric === 'CONTROVERSIAL'
            ? Prisma.sql`ranked."controversyScore" DESC, ranked."positiveVoteCount" DESC, ranked."upvoteCount" DESC, ranked.status_tie ASC, ranked."createdAt" ASC, ranked."id" ASC`
            : input.metric === 'TIME'
              ? Prisma.sql`ranked."createdAt" DESC, ranked."id" ASC`
              : Prisma.sql`ranked."upvoteCount" DESC, ranked.status_tie ASC, ranked."createdAt" ASC, ranked."id" ASC`;
      const controversyThreshold = Math.max(1, participantCount * 0.1);
      const controversyThresholdSql = Prisma.sql`${controversyThreshold}::DOUBLE PRECISION`;
      type CorpusRow = {
        id: string;
        text: string;
        upvoteCount: number;
        positiveVoteCount: number;
        negativeVoteCount: number;
        createdAt: Date;
        bestScore: number;
        controversyScore: number;
        eligibleCount: bigint | number;
      };
      const corpus = await prisma.$queryRaw<CorpusRow[]>`
        WITH scored AS (
          SELECT
            question."id",
            question."text",
            question."upvoteCount",
            question."positiveVoteCount",
            question."negativeVoteCount",
            question."createdAt",
            CASE
              WHEN question."positiveVoteCount" + question."negativeVoteCount" = 0 THEN 0
              ELSE GREATEST(
                0,
                LEAST(
                  1,
                  (
                    question."positiveVoteCount"::DOUBLE PRECISION
                      / (question."positiveVoteCount" + question."negativeVoteCount")
                    + 3.8416
                      / (2 * (question."positiveVoteCount" + question."negativeVoteCount"))
                    - 1.96 * SQRT(
                      (
                        (
                          question."positiveVoteCount"::DOUBLE PRECISION
                            / (question."positiveVoteCount" + question."negativeVoteCount")
                        ) * (
                          1 - question."positiveVoteCount"::DOUBLE PRECISION
                            / (question."positiveVoteCount" + question."negativeVoteCount")
                        )
                      ) / (question."positiveVoteCount" + question."negativeVoteCount")
                      + 3.8416 / (
                        4 * POWER(
                          question."positiveVoteCount" + question."negativeVoteCount",
                          2
                        )
                      )
                    )
                  ) / (
                    1 + 3.8416
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
            END AS "controversyScore",
            CASE question."status" WHEN 'PINNED' THEN 0 ELSE 1 END AS status_tie
          FROM "QaQuestion" AS question
          WHERE question."sessionId" = ${session.id}
            AND ${statusFilter}
        ),
        ranked AS (
          SELECT scored.*, COUNT(*) OVER() AS "eligibleCount"
          FROM scored
        )
        SELECT *
        FROM ranked
        ORDER BY
          ${modeOrder}
        LIMIT ${input.limit}
      `;
      const current = await prisma.session.findUnique({
        where: { id: session.id },
        select: { qaRankingRevision: true },
      });
      const currentParticipantCount =
        input.metric === 'CONTROVERSIAL'
          ? await prisma.participant.count({ where: { sessionId: session.id } })
          : participantCount;
      if (
        current?.qaRankingRevision !== session.qaRankingRevision ||
        currentParticipantCount !== participantCount
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Der Q&A-Korpus hat sich geändert. Starte die Analyse bitte erneut.',
        });
      }
      const normalizedWeight = (value: number) =>
        Math.min(28, 1 + Math.max(0, Math.round(Math.max(0, Math.min(1, value)) ** 2 * 40)));
      const upvoteWeight = (value: number) =>
        1 + Math.max(0, Math.round(Math.sqrt(Math.max(0, Math.round(value)))));
      const items = corpus.map((question) => ({
        id: question.id,
        text: question.text,
        weight:
          input.metric === 'BEST'
            ? normalizedWeight(question.bestScore)
            : input.metric === 'CONTROVERSIAL'
              ? normalizedWeight(question.controversyScore)
              : input.metric === 'TIME'
                ? 1
                : upvoteWeight(question.upvoteCount),
      }));
      const analysis = (await analyzeWordCloudSnapshot(
        {
          sessionCode: input.sessionCode.toUpperCase(),
          mode: input.mode,
          locale: input.locale,
          metric: input.metric,
          channel: 'QA',
          normalization: input.normalization,
          items,
          maxEntries: input.maxEntries,
          maxNgramLength: input.maxNgramLength,
          refresh: input.refresh,
          corpusRevision: `${corpusRevision}:limit=${input.limit}`,
        },
        { compactOutput: compactQaWordCloudOutput },
      )) as Omit<AnalyzeWordCloudOutput, 'entries'> & {
        entries: AnalyzeQaWordCloudOutput['entries'];
      };
      return {
        ...analysis,
        eligibleQuestionCount: Number(corpus[0]?.eligibleCount ?? 0),
        analyzedQuestionCount: corpus.length,
        corpusRevision,
        sortMode: input.metric,
        filter: input.filter,
      };
    }),
});
