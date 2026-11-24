import { setTimeout as wait } from 'node:timers/promises';
import {
  AnalyzeQaWordCloudInputSchema,
  AnalyzeQaWordCloudOutputSchema,
  type AnalyzeQaWordCloudOutput,
  QA_WORD_CLOUD_MAX_BASIS_LABEL_CHARS,
  QA_WORD_CLOUD_MAX_EXPLANATION_MEMBERS,
  QA_WORD_CLOUD_MAX_EXPLANATION_TEXT_CHARS,
  QA_WORD_CLOUD_MAX_OUTPUT_ENTRIES,
  type AnalyzeWordCloudInput,
  AnalyzeWordCloudInputSchema,
  AnalyzeWordCloudOutputSchema,
  type AnalyzeWordCloudOutput,
  getWordCloudResultDisplayMode,
  isWordCloudPhraseAnalysisVariant,
  prepareWordCloudAnalysisText,
} from '@arsnova/shared-types';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db';
import { logger } from '../lib/logger';
import { isHostSessionTokenValid } from '../lib/hostAuth';
import { isOpenWeightLlmEnabled } from '../lib/openWeightLlmConfig';
import { isOpenWeightLlmPriorityEnabled } from '../lib/openWeightLlmPriority';
import { claimRedisLease } from '../lib/redisLease';
import { getRedis } from '../redis';
import {
  buildQaRankingMetricOrderSql,
  buildQaRankingScoreSelectSql,
  qaRankingCorpusRevision,
} from '../lib/qaRankingSql';
import {
  recordLatestQaSemanticTopicSnapshot,
  type QaSemanticTopicSnapshot,
} from '../lib/qaSemanticTopicSnapshot';
import {
  buildLexicalWordCloudEntries,
  buildThemeWordCloudAnalysis,
} from '../lib/wordCloudAnalysis';
import {
  buildWordCloudSnapshotCacheKey,
  getWordCloudAnalysisCache,
  type WordCloudAnalysisCache,
  type WordCloudSnapshotCacheScope,
} from '../lib/wordCloudAnalysisCache';
import {
  normalizeWordCloudItems,
  type NormalizeWordCloudOptions,
} from '../lib/wordCloudNormalizer';
import {
  buildWordCloudSnapshotHash,
  type WordCloudNormalizationMeta,
} from '../lib/wordCloudNormalization';
import { analyzeSemanticWordCloudSnapshot } from '../lib/wordCloudSemanticAnalyze';
import {
  beginWordCloudAnalysisTelemetry,
  recordWordCloudAnalyzeTelemetry,
} from '../lib/wordCloudNlpTelemetry';
import { acquireQaWordCloudAnalysisLock } from '../lib/qaWordCloudAnalysisLock';
import {
  applyWordCloudTopicLabels,
  getWordCloudTopicLabelTelemetry,
  resolveTopicLabelPhaseBudgetMs,
  labelSemanticWordCloudSnapshot,
} from '../lib/wordCloudTopicLabels';
import { hostProcedure, router } from '../trpc';

export interface AnalyzeWordCloudSnapshotOptions {
  readonly cache?: WordCloudAnalysisCache;
  /** Ausschließlich serverseitig aus der autoritativen Session laden. */
  readonly cacheScope?: WordCloudSnapshotCacheScope;
  readonly signal?: AbortSignal;
  readonly normalize?: typeof normalizeWordCloudItems;
  readonly env?: NodeJS.ProcessEnv;
  readonly sidecar?: NormalizeWordCloudOptions['sidecar'];
  readonly compactOutput?: (output: AnalyzeWordCloudOutput) => AnalyzeWordCloudOutput;
  readonly onFreshOutput?: (
    output: AnalyzeWordCloudOutput,
    effectiveInput: AnalyzeWordCloudInput,
    previous?: AnalyzeWordCloudOutput,
  ) => Promise<void> | void;
  readonly onResolvedInput?: (effectiveInput: AnalyzeWordCloudInput) => void;
  readonly isCurrent?: () => Promise<boolean>;
  readonly labelTopics?: typeof applyWordCloudTopicLabels;
  readonly encode?: typeof analyzeSemanticWordCloudSnapshot;
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

async function enrichWordCloudSnapshot(
  input: AnalyzeWordCloudInput,
  snapshotHash: string,
  cache: WordCloudAnalysisCache,
  options: AnalyzeWordCloudSnapshotOptions,
): Promise<AnalyzeWordCloudOutput> {
  const scope = options.cacheScope;
  const env = options.env ?? process.env;
  const isCurrent = async () => !options.signal?.aborted && ((await options.isCurrent?.()) ?? true);
  const obsolete = () =>
    new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Der Themenstand hat sich geändert.' });
  if (!scope || snapshotHash !== buildWordCloudSnapshotHash(input) || !(await isCurrent())) {
    throw obsolete();
  }
  const cached = await cache.getSnapshot(input, scope);
  if (cached) return cached;

  const preview = await cache.getSnapshot({ ...input, topicLabels: 'preview' }, scope);
  if (!preview?.topicLabelsPending || preview.snapshotHash !== snapshotHash) throw obsolete();
  const base = { ...preview, topicLabelsPending: undefined };
  const budgetMs = resolveTopicLabelPhaseBudgetMs(
    env,
    base.entries.filter((entry) => entry.members.length >= 2).length,
  );
  const timeout = AbortSignal.timeout(budgetMs);
  const controller = new AbortController();
  const signal = AbortSignal.any(
    [timeout, controller.signal, options.signal].filter((item): item is AbortSignal => !!item),
  );
  const key = `${buildWordCloudSnapshotCacheKey(input, scope)}:label-job`;
  const view = (result: AnalyzeWordCloudOutput) => {
    const output = options.compactOutput?.(result) ?? result;
    return { ...output, effectiveMode: getWordCloudResultDisplayMode(output) };
  };

  const claim = await claimRedisLease(key, budgetMs + 5_000).catch(() => null);
  if (!claim) return view(base);
  const { lease, owner } = claim;
  if (!lease) {
    const readResult = async () =>
      (await cache.getSnapshot(input, scope, owner)) ?? (await cache.getSnapshot(input, scope));
    while (!signal.aborted && (await isCurrent())) {
      const settled = await readResult();
      if (settled) return settled;
      if (
        (await getRedis()
          .get(key)
          .catch(() => null)) !== owner
      )
        break;
      await wait(250, undefined, { signal }).catch(() => undefined);
    }
    if (!(await isCurrent())) throw obsolete();
    return (await readResult()) ?? view(base);
  }

  let checkingCurrent = false;
  const watcher = options.isCurrent
    ? setInterval(() => {
        if (checkingCurrent || signal.aborted) return;
        checkingCurrent = true;
        void isCurrent()
          .then((current) => {
            if (!current) controller.abort();
          })
          .catch(() => controller.abort())
          .finally(() => {
            checkingCurrent = false;
          });
      }, 500)
    : undefined;
  try {
    // A completed result may have appeared between our first read and lease acquisition.
    const settled = await cache.getSnapshot(input, scope);
    if (settled) return settled;
    if (!(await isCurrent())) throw obsolete();
    const raw = await (options.labelTopics ?? applyWordCloudTopicLabels)(input, base, {
      sessionId: scope.sessionId,
      signal,
      env,
    });
    if (controller.signal.aborted || !(await isCurrent())) throw obsolete();
    try {
      await options.onFreshOutput?.(raw, input, base);
    } catch (error) {
      logger.warn('wordcloud:fresh_output_hook_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
    }
    if (!(await isCurrent())) throw obsolete();
    const result = view(raw);
    if (!timeout.aborted) await cache.setSnapshot(input, result, scope);
    // Waiters joined this lease generation. Retain valid partial labels briefly
    // without letting a later, independent request reuse a transient result.
    if (timeout.aborted || result.labelSettlement === 'transient') {
      await cache.setSnapshot(input, result, scope, owner);
    }
    return result;
  } finally {
    if (watcher) clearInterval(watcher);
    await lease.release().catch(() => undefined);
  }
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
  const analyzableItems = input.items.filter(isAnalyzableWordCloudItem);
  const requestedLabels = input.topicLabels;
  const effectiveInput: AnalyzeWordCloudInput =
    analyzableItems.length === input.items.length
      ? { ...input, topicLabels: undefined }
      : AnalyzeWordCloudInputSchema.parse({
          ...input,
          topicLabels: undefined,
          items: analyzableItems,
        });
  options.onResolvedInput?.(effectiveInput);
  const env = options.env ?? process.env;
  const progressive =
    isOpenWeightLlmPriorityEnabled(env) &&
    isOpenWeightLlmEnabled(env['OPEN_WEIGHT_LLM_ENABLED']) &&
    effectiveInput.mode === 'SEMANTIC' &&
    (effectiveInput.channel === 'QA' || effectiveInput.channel === 'FREETEXT');
  if (typeof requestedLabels === 'object') {
    if (!progressive) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Themenlabels sind gerade nicht verfügbar.',
      });
    }
    return enrichWordCloudSnapshot(effectiveInput, requestedLabels.snapshotHash, cache, options);
  }
  const previewInput: AnalyzeWordCloudInput | null =
    progressive && requestedLabels === 'preview' && options.cacheScope
      ? { ...effectiveInput, topicLabels: 'preview' }
      : null;

  const cached =
    effectiveInput.refresh === true
      ? null
      : ((await cache.getSnapshot(effectiveInput, options.cacheScope)) ??
        (previewInput ? await cache.getSnapshot(previewInput, options.cacheScope) : null));
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
      labelSettlement: cached.labelSettlement ?? null,
      labelModelAccepted: Boolean(cached.labelModelId),
    });
    const output = options.compactOutput?.(cached) ?? cached;
    return { ...output, effectiveMode: getWordCloudResultDisplayMode(output) };
  }

  const normalized = await normalize(effectiveInput, {
    cache,
    env: options.env,
    sidecar: options.sidecar,
  });
  const semanticOptions = {
    sessionId: options.cacheScope?.sessionId,
    signal: options.signal,
    env: options.env,
    tokensByItemId: normalized.tokensByItemId,
  };
  let rawOutput: AnalyzeWordCloudOutput & { readonly encoderCalled?: boolean };
  if (previewInput) {
    const encoded = await (options.encode ?? analyzeSemanticWordCloudSnapshot)(
      effectiveInput,
      normalized.meta,
      semanticOptions,
    );
    const canLabel =
      !encoded.fallbackUsed &&
      (encoded.status === 'ready' || encoded.status === 'uncertain') &&
      encoded.entries.some((entry) => entry.members.length >= 2);
    rawOutput = {
      ...encoded,
      ...(canLabel ? { topicLabelsPending: true } : {}),
      entries: encoded.entries.map((entry) => ({ ...entry, labelOrigin: 'extractive' })),
    };
  } else {
    rawOutput =
      effectiveInput.mode === 'SEMANTIC'
        ? await labelSemanticWordCloudSnapshot(effectiveInput, normalized.meta, semanticOptions)
        : analyzeFromNormalized(effectiveInput, normalized);
  }
  const topicLabelTelemetry = getWordCloudTopicLabelTelemetry(rawOutput);
  if (options.onFreshOutput) {
    try {
      await options.onFreshOutput(rawOutput, effectiveInput);
    } catch (error) {
      logger.warn('wordcloud:fresh_output_hook_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
  const compact = options.compactOutput?.(rawOutput) ?? rawOutput;
  const output = { ...compact, effectiveMode: getWordCloudResultDisplayMode(compact) };
  await cache.setSnapshot(
    previewInput && rawOutput.topicLabelsPending ? previewInput : effectiveInput,
    rawOutput.topicLabelsPending ? rawOutput : output,
    options.cacheScope,
  );
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
    encoderCalled:
      effectiveInput.mode === 'SEMANTIC' &&
      (rawOutput.encoderCalled ?? Boolean(output.modelVersion)),
    labelSettlement: output.labelSettlement ?? null,
    labelModelAccepted: Boolean(output.labelModelId),
    labelModelCalled: topicLabelTelemetry.labelModelCalled,
    labelCacheHits: topicLabelTelemetry.labelCacheHits,
    labelCacheMisses: topicLabelTelemetry.labelCacheMisses,
  });
  return output;
}

function isAnalyzableWordCloudItem(item: AnalyzeWordCloudInput['items'][number]): boolean {
  return prepareWordCloudAnalysisText(item.text).segments.length > 0;
}

function truncateQaExplanation(
  value: string,
  maxChars = QA_WORD_CLOUD_MAX_EXPLANATION_TEXT_CHARS,
): string {
  return Array.from(value).slice(0, maxChars).join('');
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
        basisLabel:
          entry.basisLabel === null
            ? null
            : truncateQaExplanation(entry.basisLabel, QA_WORD_CLOUD_MAX_BASIS_LABEL_CHARS),
        members: entry.members
          .slice(0, QA_WORD_CLOUD_MAX_EXPLANATION_MEMBERS)
          .map((member) => ({ ...member, text: truncateQaExplanation(member.text) })),
        variants: entry.variants.slice(0, 1).map((variant) => truncateQaExplanation(variant)),
        memberCount,
        membersTruncated:
          entry.membersTruncated === true || memberCount > QA_WORD_CLOUD_MAX_EXPLANATION_MEMBERS,
      };
    }),
  };
}

function resolveFocusedQaWordCloudGroupKey(input: {
  readonly focusQuestionIds: readonly string[];
  readonly analysis: AnalyzeWordCloudOutput;
  readonly semanticSnapshot: QaSemanticTopicSnapshot | null;
  readonly corpusRevision: string;
  readonly corpusItems: readonly { readonly id: string; readonly text: string }[];
}): string | null {
  if (input.focusQuestionIds.length === 0) {
    return null;
  }
  const focusIds = new Set(input.focusQuestionIds);
  const direct = input.analysis.entries.find((entry) =>
    entry.members.some((member) => focusIds.has(member.sourceId)),
  );
  if (direct) {
    return direct.key;
  }

  const snapshot = input.semanticSnapshot;
  if (
    input.analysis.mode !== 'SEMANTIC' ||
    !snapshot ||
    snapshot.corpusRevision !== input.corpusRevision ||
    snapshot.metric !== input.analysis.metric
  ) {
    return null;
  }
  const topic = snapshot.topics.find((candidate) =>
    candidate.members.some((member) => focusIds.has(member.questionId)),
  );
  if (!topic) {
    return null;
  }

  const labelSourceText = input.corpusItems.find(
    (item) => item.id === topic.labelSourceQuestionId,
  )?.text;
  const byLabelSource = input.analysis.entries.find((entry) =>
    entry.members.some((member) => member.sourceId === topic.labelSourceQuestionId),
  );
  if (byLabelSource) {
    return byLabelSource.key;
  }
  if (labelSourceText) {
    const byBasis = input.analysis.entries.find((entry) => entry.basisLabel === labelSourceText);
    if (byBasis) {
      return byBasis.key;
    }
  }
  const modelLabel = topic.modelLabel?.text;
  return modelLabel
    ? (input.analysis.entries.find((entry) => entry.label === modelLabel)?.key ?? null)
    : null;
}

function createRequestDisconnectSignal(req?: import('node:http').IncomingMessage): {
  readonly signal?: AbortSignal;
  readonly cleanup: () => void;
} {
  if (!req || typeof req.once !== 'function') {
    return { cleanup: () => undefined };
  }
  const controller = new AbortController();
  const socket = req.socket;
  const onDisconnect = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };
  req.once('aborted', onDisconnect);
  if (socket && typeof socket.once === 'function') {
    socket.once('close', onDisconnect);
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      if (typeof req.removeListener === 'function') {
        req.removeListener('aborted', onDisconnect);
      }
      if (socket && typeof socket.removeListener === 'function') {
        socket.removeListener('close', onDisconnect);
      }
    },
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
      const disconnect = createRequestDisconnectSignal(ctx.req);
      try {
        return await analyzeWordCloudSnapshot(input, {
          cacheScope: { sessionId: session.id },
          signal: disconnect.signal,
          isCurrent: async () =>
            !!ctx.hostToken && isHostSessionTokenValid(sessionCode, ctx.hostToken),
        });
      } finally {
        disconnect.cleanup();
      }
    }),

  analyzeQa: hostProcedure
    .input(AnalyzeQaWordCloudInputSchema)
    .use(async ({ input, next }) => {
      if (typeof input.topicLabels === 'object') return next();
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
      const corpusRevision = qaRankingCorpusRevision(session.qaRankingRevision, input.metric);
      const statusFilter =
        input.filter === 'PINNED_ONLY'
          ? Prisma.sql`question."status" = 'PINNED'`
          : Prisma.sql`question."status" IN ('PINNED', 'ACTIVE')`;
      const modeOrder = buildQaRankingMetricOrderSql(input.metric);
      const stableMetricTies =
        input.metric === 'TIME'
          ? Prisma.empty
          : Prisma.sql`ranked.status_tie ASC, ranked."createdAt" ASC,`;
      const scoreSelect = buildQaRankingScoreSelectSql();
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
      if (current?.qaRankingRevision !== session.qaRankingRevision) {
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
      const disconnect = createRequestDisconnectSignal(ctx.req);
      let resolvedAnalysisInput: AnalyzeWordCloudInput | null = null;
      let analysis: Omit<AnalyzeWordCloudOutput, 'entries'> & {
        entries: AnalyzeQaWordCloudOutput['entries'];
      };
      try {
        analysis = (await analyzeWordCloudSnapshot(
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
            topicLabels: input.topicLabels,
            corpusRevision: `${corpusRevision}:limit=${input.limit}`,
          },
          {
            cache,
            signal: disconnect.signal,
            isCurrent: async () => {
              if (!ctx.hostToken || !(await isHostSessionTokenValid(sessionCode, ctx.hostToken)))
                return false;
              const latest = await prisma.session.findUnique({
                where: { id: session.id },
                select: { qaRankingRevision: true },
              });
              return latest?.qaRankingRevision === session.qaRankingRevision;
            },
            compactOutput: compactQaWordCloudOutput,
            cacheScope: { sessionId: session.id },
            onResolvedInput: (effectiveAnalysisInput) => {
              resolvedAnalysisInput = effectiveAnalysisInput;
            },
            onFreshOutput: async (rawAnalysis, effectiveAnalysisInput, previous) => {
              await recordLatestQaSemanticTopicSnapshot(
                {
                  cache,
                  scope: { sessionId: session.id },
                  analysisInput: effectiveAnalysisInput,
                  request: input,
                  analysis: rawAnalysis,
                  corpusRevision,
                  eligibleQuestionCount,
                  corpusItems: effectiveAnalysisInput.items,
                },
                previous,
              );
            },
          },
        )) as Omit<AnalyzeWordCloudOutput, 'entries'> & {
          entries: AnalyzeQaWordCloudOutput['entries'];
        };
      } finally {
        disconnect.cleanup();
      }
      const focusQuestionIds = input.focusQuestionIds ?? [];
      const semanticSnapshot =
        focusQuestionIds.length > 0 && input.mode === 'SEMANTIC' && resolvedAnalysisInput !== null
          ? await cache.getQaSemanticTopicSnapshot(resolvedAnalysisInput, {
              sessionId: session.id,
            })
          : null;
      const focusedGroupKey = resolveFocusedQaWordCloudGroupKey({
        focusQuestionIds,
        analysis,
        semanticSnapshot,
        corpusRevision,
        corpusItems: items,
      });
      return {
        ...analysis,
        eligibleQuestionCount,
        analyzedQuestionCount: items.filter(isAnalyzableWordCloudItem).length,
        corpusRevision,
        sortMode: input.metric,
        filter: input.filter,
        ...(focusQuestionIds.length > 0 ? { focusedGroupKey } : {}),
      };
    }),
});
