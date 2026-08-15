import { createHash } from 'node:crypto';
import type { AnalyzeWordCloudInput, AnalyzeWordCloudOutput } from '@arsnova/shared-types';
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

/**
 * Phase 1 hat noch keinen spaCy-Client. Der Sidecar gilt deshalb nie als erreichbar;
 * NLP_ENABLED steuert nur, ob später überhaupt ein Connect versucht würde.
 */
export function isWordCloudLemmaSidecarAvailable(): boolean {
  return false;
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

export function resolveWordCloudNormalizationMeta(
  input: AnalyzeWordCloudInput,
  env: NodeJS.ProcessEnv = process.env,
): WordCloudNormalizationMeta {
  const nlp = resolveNlpSidecarConfig(env);
  const decision = resolveWordCloudLemmaApplication({
    requested: input.normalization,
    mode: input.mode,
    locale: input.locale,
    nlpEnabled: nlp.enabled,
    sidecarAvailable: isWordCloudLemmaSidecarAvailable(),
  });

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
