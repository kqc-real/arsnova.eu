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
  prepareWordCloudAnalysisText,
} from '@arsnova/shared-types';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db';
import { logger } from '../lib/logger';
import { buildQaRankingMetricOrderSql, buildQaRankingScoreSelectSql } from '../lib/qaRankingSql';
import { recordLatestQaSemanticTopicSnapshot } from '../lib/qaSemanticTopicSnapshot';
import {
  buildLexicalWordCloudEntries,
  buildThemeWordCloudAnalysis,
} from '../lib/wordCloudAnalysis';
import {
  getWordCloudAnalysisCache,
  type WordCloudAnalysisCache,
  type WordCloudSnapshotCacheScope,
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
  /** Ausschließlich serverseitig aus der autoritativen Session laden. */
  readonly cacheScope?: WordCloudSnapshotCacheScope;
  readonly normalize?: typeof normalizeWordCloudItems;
  readonly env?: NodeJS.ProcessEnv;
  readonly sidecar?: NormalizeWordCloudOptions['sidecar'];
  readonly compactOutput?: (output: AnalyzeWordCloudOutput) => AnalyzeWordCloudOutput;
  readonly onFreshOutput?: (
    output: AnalyzeWordCloudOutput,
    effectiveInput: AnalyzeWordCloudInput,
  ) => Promise<void> | void;
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
  const analyzableItems = input.items.filter(
    (item) => prepareWordCloudAnalysisText(item.text).segments.length > 0,
  );
  const effectiveInput: AnalyzeWordCloudInput =
    analyzableItems.length === input.items.length
      ? input
      : AnalyzeWordCloudInputSchema.parse({ ...input, items: analyzableItems });

  const cached =
    effectiveInput.refresh === true
      ? null
      : await cache.getSnapshot(effectiveInput, options.cacheScope);
  if (cached) {
    recordWordCloudAnalyzeTelemetry({
      sessionCode: effectiveInput.sessionCode,
      mode: effectiveInput.mode,
      metric: effectiveInput.metric,
      normalization: effectiveInput.normalization,
      normalizationApplied: cached.normalizationApplied,
      fallbackReason: cached.normalizationFallbackReason,
      durationMs: Date.now() - startedAt,
      itemCount: effectiveInput.items.length,
      snapshotCache: 'hit',
      textCacheHits: 0,
      textCacheMisses: 0,
      sidecarCalled: false,
      encoderCalled: false,
    });
    return options.compactOutput?.(cached) ?? cached;
  }

  const normalized = await normalize(effectiveInput, {
    cache,
    env: options.env,
    sidecar: options.sidecar,
  });
  const rawOutput =
    effectiveInput.mode === 'SEMANTIC'
      ? await analyzeSemanticWordCloudSnapshot(effectiveInput, normalized.meta, {
          sessionId: options.cacheScope?.sessionId,
          env: options.env,
          tokensByItemId: normalized.tokensByItemId,
        })
      : analyzeFromNormalized(effectiveInput, normalized);
  if (options.onFreshOutput) {
    try {
      await options.onFreshOutput(rawOutput, effectiveInput);
    } catch (error) {
      logger.warn('wordcloud:fresh_output_hook_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
  const output = options.compactOutput?.(rawOutput) ?? rawOutput;
  await cache.setSnapshot(effectiveInput, output, options.cacheScope);
  recordWordCloudAnalyzeTelemetry({
    sessionCode: effectiveInput.sessionCode,
    mode: effectiveInput.mode,
    metric: effectiveInput.metric,
    normalization: effectiveInput.normalization,
    normalizationApplied: output.normalizationApplied,
    fallbackReason: output.normalizationFallbackReason,
    durationMs: Date.now() - startedAt,
    itemCount: effectiveInput.items.length,
    snapshotCache: 'miss',
    textCacheHits: normalized.cache.textHits,
    textCacheMisses: normalized.cache.textMisses,
    sidecarCalled: normalized.cache.sidecarCalled,
    encoderCalled: effectiveInput.mode === 'SEMANTIC' && Boolean(output.modelVersion),
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
 * SEMANTIC (1.14c/1.14d) clustert Host-Q&A und Host-Freitext über den privaten Encoder;
 * ohne Kill-Switch oder bei totem Server bleibt der 2.x-Phrasenpfad.
 * LEXICAL + LEMMA glättet über den Sidecar und fällt hart auf Identity zurück.
 * Freitext-Phrasen kommen über `maxNgramLength` 2/3 in denselben LEXICAL-Snapshot;
 * Q&A-Einzelwörter bleiben bei Default 1. THEME-/SEMANTIC-Fallback bleibt unigram-only.
 */
export const wordCloudRouter = router({
  analyze: hostProcedure
    .input(AnalyzeWordCloudInputSchema)
    .output(AnalyzeWordCloudOutputSchema)
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
        select: { id: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      return analyzeWordCloudSnapshot(input, { cacheScope: { sessionId: session.id } });
    }),

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
      const modeOrder = buildQaRankingMetricOrderSql(input.metric);
      const stableMetricTies =
        input.metric === 'TIME'
          ? Prisma.empty
          : Prisma.sql`ranked.status_tie ASC, ranked."createdAt" ASC,`;
      const scoreSelect = buildQaRankingScoreSelectSql(participantCount);
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
            ${scoreSelect},
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
          ${stableMetricTies}
          ranked."id" ASC
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
      const eligibleQuestionCount = Number(corpus[0]?.eligibleCount ?? 0);
      const cache = getWordCloudAnalysisCache();
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
        {
          cache,
          compactOutput: compactQaWordCloudOutput,
          cacheScope: { sessionId: session.id },
          onFreshOutput: async (rawAnalysis, effectiveAnalysisInput) => {
            await recordLatestQaSemanticTopicSnapshot({
              cache,
              scope: { sessionId: session.id },
              request: input,
              analysis: rawAnalysis,
              corpusRevision,
              eligibleQuestionCount,
              corpusItems: effectiveAnalysisInput.items,
            });
          },
        },
      )) as Omit<AnalyzeWordCloudOutput, 'entries'> & {
        entries: AnalyzeQaWordCloudOutput['entries'];
      };
      return {
        ...analysis,
        eligibleQuestionCount,
        analyzedQuestionCount: corpus.length,
        corpusRevision,
        sortMode: input.metric,
        filter: input.filter,
      };
    }),
});
