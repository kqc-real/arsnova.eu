import { createHash } from 'node:crypto';
import type {
  AnalyzeWordCloudInput,
  AnalyzeWordCloudOutput,
  WordCloudLemmaApplication,
} from '@arsnova/shared-types';
import {
  resolveWordCloudLemmaApplication,
  WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION,
} from '@arsnova/shared-types';
import { resolveNlpSidecarConfig } from './nlpSidecarConfig';

export interface WordCloudNormalizationMeta {
  readonly normalization: AnalyzeWordCloudOutput['normalization'];
  readonly normalizationApplied: AnalyzeWordCloudOutput['normalizationApplied'];
  readonly normalizationFallbackUsed: boolean;
  readonly normalizationFallbackReason: AnalyzeWordCloudOutput['normalizationFallbackReason'];
  readonly fallbackLocale: AnalyzeWordCloudOutput['fallbackLocale'];
  readonly analysisVersion: string;
  readonly modelId: string | null;
  readonly snapshotHash: string;
}

export function buildWordCloudSnapshotHash(
  input: Pick<AnalyzeWordCloudInput, 'mode' | 'locale' | 'metric' | 'normalization' | 'items'>,
): string {
  const canonical = JSON.stringify({
    analysisVersion: WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION,
    mode: input.mode,
    locale: input.locale,
    metric: input.metric,
    normalization: input.normalization,
    items: [...input.items]
      .map((item) => ({ id: item.id, text: item.text, weight: item.weight }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function toWordCloudNormalizationMeta(
  input: AnalyzeWordCloudInput,
  decision: WordCloudLemmaApplication,
): WordCloudNormalizationMeta {
  return {
    normalization: decision.requested,
    normalizationApplied: decision.applied,
    normalizationFallbackUsed: decision.fallbackUsed,
    normalizationFallbackReason: decision.reason,
    fallbackLocale: input.locale,
    analysisVersion: WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION,
    modelId: decision.modelId,
    snapshotHash: buildWordCloudSnapshotHash(input),
  };
}

/**
 * Synchroner Meta-Resolver ohne Sidecar-Versuch.
 * `sidecarAvailable` bleibt bewusst false, solange der Aufrufer den Connect nicht bestätigt.
 */
export function resolveWordCloudNormalizationMeta(
  input: AnalyzeWordCloudInput,
  env: NodeJS.ProcessEnv = process.env,
  sidecarAvailable = false,
): WordCloudNormalizationMeta {
  const nlp = resolveNlpSidecarConfig(env);
  return toWordCloudNormalizationMeta(
    input,
    resolveWordCloudLemmaApplication({
      requested: input.normalization,
      mode: input.mode,
      locale: input.locale,
      nlpEnabled: nlp.enabled,
      sidecarAvailable,
    }),
  );
}
