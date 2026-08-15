import {
  type AnalyzeWordCloudInput,
  AnalyzeWordCloudInputSchema,
  AnalyzeWordCloudOutputSchema,
  type AnalyzeWordCloudOutput,
} from '@arsnova/shared-types';
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
import { recordWordCloudAnalyzeTelemetry } from '../lib/wordCloudNlpTelemetry';
import { hostProcedure, router } from '../trpc';

export interface AnalyzeWordCloudSnapshotOptions {
  readonly cache?: WordCloudAnalysisCache;
  readonly normalize?: typeof normalizeWordCloudItems;
  readonly env?: NodeJS.ProcessEnv;
  readonly sidecar?: NormalizeWordCloudOptions['sidecar'];
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
    entries,
    ...meta,
  });
}

function analyzeFromNormalized(
  input: AnalyzeWordCloudInput,
  normalized: Awaited<ReturnType<typeof normalizeWordCloudItems>>,
): AnalyzeWordCloudOutput {
  if (input.mode === 'THEME') {
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

  const cached = await cache.getSnapshot(input);
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
    });
    return cached;
  }

  const normalized = await normalize(input, {
    cache,
    env: options.env,
    sidecar: options.sidecar,
  });
  const output = analyzeFromNormalized(input, normalized);
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
  });
  return output;
}

/**
 * Word-Cloud-Analysepfad für den Host.
 * THEME bleibt der deterministische Phrasen-/Anchor-Pfad ohne spaCy.
 * LEXICAL + LEMMA glättet über den Sidecar und fällt hart auf Identity zurück.
 * Freitext-Phrasen kommen über `maxNgramLength` 2/3 in denselben LEXICAL-Snapshot;
 * Q&A-Einzelwörter bleiben bei Default 1. THEME-Fallback bleibt unigram-only.
 */
export const wordCloudRouter = router({
  analyze: hostProcedure
    .input(AnalyzeWordCloudInputSchema)
    .output(AnalyzeWordCloudOutputSchema)
    .mutation(({ input }) => analyzeWordCloudSnapshot(input)),
});
