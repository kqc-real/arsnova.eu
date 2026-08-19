import { QaNlpResultSchema, type QaNlpResult } from '@arsnova/shared-types';
import {
  QA_NLP_EARLY_EXIT_MARGIN,
  QA_NLP_EARLY_EXIT_MIN_TOKENS,
  QA_NLP_FALLBACK_MODEL_VERSION,
  QA_NLP_GATEKEEPER_MODEL_VERSION,
  QA_NLP_MIN_CONFIDENCE_DEFAULT,
  resolveQaNlpMinConfidence,
} from './qaNlpConfig';
import { predictQaNlpFallbackKnn, qaNlpFallbackAccepts } from './qaNlpFallback';
import { getQaNlpGatekeeperModel } from './qaNlpGatekeeper';
import {
  normalizeQaNlpText,
  predictQaNlpNaiveBayes,
  type QaNlpScoredPrediction,
} from './qaNlpNaiveBayes';
import type { QaNlpAnalysisSnapshot } from './qaNlpSnapshot';

export type QaNlpCascadeDecision = QaNlpResult & {
  readonly usedFallback: boolean;
  readonly earlyExit: boolean;
};

function tokenCount(text: string): number {
  const normalized = normalizeQaNlpText(text);
  return normalized ? normalized.split(' ').length : 0;
}

function topTwoMargin(prediction: QaNlpScoredPrediction): number {
  const ranked = Object.values(prediction.scores).sort((left, right) => right - left);
  return (ranked[0] ?? 0) - (ranked[1] ?? 0);
}

export function shouldEarlyExitQaNlp(
  prediction: QaNlpScoredPrediction,
  text: string,
  minConfidence = QA_NLP_MIN_CONFIDENCE_DEFAULT,
): boolean {
  return (
    prediction.confidence >= minConfidence &&
    topTwoMargin(prediction) >= QA_NLP_EARLY_EXIT_MARGIN &&
    tokenCount(text) >= QA_NLP_EARLY_EXIT_MIN_TOKENS
  );
}

function toResult(
  status: 'classified' | 'uncertain',
  prediction: QaNlpScoredPrediction,
  modelVersion: string,
  analyzedAt: Date,
  usedFallback: boolean,
  earlyExit: boolean,
): QaNlpCascadeDecision {
  return {
    ...QaNlpResultSchema.parse({
      status,
      category: prediction.category,
      confidence: Number(prediction.confidence.toFixed(4)),
      modelVersion,
      analyzedAt: analyzedAt.toISOString(),
    }),
    usedFallback,
    earlyExit,
  };
}

export function readQaNlpCascadeFlags(result: QaNlpResult): {
  readonly earlyExit: boolean;
  readonly usedFallback: boolean;
} {
  const maybe = result as QaNlpResult & {
    earlyExit?: boolean;
    usedFallback?: boolean;
  };
  if (typeof maybe.earlyExit === 'boolean' && typeof maybe.usedFallback === 'boolean') {
    return { earlyExit: maybe.earlyExit, usedFallback: maybe.usedFallback };
  }
  return {
    earlyExit:
      result.status === 'classified' && result.modelVersion === QA_NLP_GATEKEEPER_MODEL_VERSION,
    usedFallback: result.modelVersion === QA_NLP_FALLBACK_MODEL_VERSION,
  };
}

/**
 * Level-1-Gatekeeper mit Early-Exit; sonst Level-2-k-NN fuer unsichere,
 * kurzfristige oder knapp gepolte Texte (ADR-0032).
 */
export function classifyQaNlpCascade(
  snapshot: QaNlpAnalysisSnapshot,
  minConfidence = resolveQaNlpMinConfidence(),
  analyzedAt = new Date(),
): QaNlpCascadeDecision {
  const text = snapshot.text.trim();
  if (!text) {
    return {
      ...QaNlpResultSchema.parse({
        status: 'uncertain',
        modelVersion: QA_NLP_GATEKEEPER_MODEL_VERSION,
        analyzedAt: analyzedAt.toISOString(),
      }),
      usedFallback: false,
      earlyExit: false,
    };
  }

  const gatekeeper = predictQaNlpNaiveBayes(getQaNlpGatekeeperModel(), text);
  if (shouldEarlyExitQaNlp(gatekeeper, text, minConfidence)) {
    return toResult(
      'classified',
      gatekeeper,
      QA_NLP_GATEKEEPER_MODEL_VERSION,
      analyzedAt,
      false,
      true,
    );
  }

  const fallback = predictQaNlpFallbackKnn(text);
  const fallbackAccepts = qaNlpFallbackAccepts(fallback);
  if (fallbackAccepts && fallback.category === gatekeeper.category) {
    return toResult('classified', fallback, QA_NLP_FALLBACK_MODEL_VERSION, analyzedAt, true, false);
  }
  if (fallbackAccepts && gatekeeper.confidence < minConfidence) {
    return toResult('classified', fallback, QA_NLP_FALLBACK_MODEL_VERSION, analyzedAt, true, false);
  }

  const bestGuess = fallback.confidence >= gatekeeper.confidence ? fallback : gatekeeper;
  return toResult('uncertain', bestGuess, QA_NLP_FALLBACK_MODEL_VERSION, analyzedAt, true, false);
}
