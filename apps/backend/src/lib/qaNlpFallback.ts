import type { QaNlpCategory } from '@arsnova/shared-types';
import {
  QA_NLP_FALLBACK_K,
  QA_NLP_FALLBACK_MIN_AGREEMENT,
  QA_NLP_FALLBACK_MIN_SIMILARITY,
} from './qaNlpConfig';
import {
  extractQaNlpFeatureCounts,
  QA_NLP_FEATURE_DIM,
  QA_NLP_GATEKEEPER_CATEGORIES,
  type QaNlpScoredPrediction,
} from './qaNlpNaiveBayes';
import { qaNlpSeedBySplit } from './qaNlpSeed';

type QaNlpPrototype = {
  readonly category: QaNlpCategory;
  readonly vector: Float32Array;
};

let cachedPrototypes: readonly QaNlpPrototype[] | null = null;

function l2NormalizeCounts(counts: Int32Array): Float32Array {
  const vector = new Float32Array(QA_NLP_FEATURE_DIM);
  let sumSquares = 0;
  for (let index = 0; index < QA_NLP_FEATURE_DIM; index += 1) {
    const value = counts[index] ?? 0;
    vector[index] = value;
    sumSquares += value * value;
  }
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) {
    return vector;
  }
  for (let index = 0; index < QA_NLP_FEATURE_DIM; index += 1) {
    vector[index] = (vector[index] ?? 0) / norm;
  }
  return vector;
}

function cosine(left: Float32Array, right: Float32Array): number {
  let dot = 0;
  for (let index = 0; index < QA_NLP_FEATURE_DIM; index += 1) {
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return dot;
}

export function getQaNlpFallbackPrototypes(): readonly QaNlpPrototype[] {
  if (cachedPrototypes) {
    return cachedPrototypes;
  }
  const examples = [...qaNlpSeedBySplit('train'), ...qaNlpSeedBySplit('prototype')];
  cachedPrototypes = examples.map((example) => ({
    category: example.category,
    vector: l2NormalizeCounts(extractQaNlpFeatureCounts(example.text)),
  }));
  return cachedPrototypes;
}

export function resetQaNlpFallbackModelForTests(): void {
  cachedPrototypes = null;
}

export function predictQaNlpFallbackKnn(text: string): QaNlpScoredPrediction {
  const query = l2NormalizeCounts(extractQaNlpFeatureCounts(text));
  const neighbors = getQaNlpFallbackPrototypes()
    .map((prototype) => ({
      category: prototype.category,
      similarity: cosine(query, prototype.vector),
    }))
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, QA_NLP_FALLBACK_K);

  const votes = {
    content: 0,
    organization: 0,
    technical: 0,
  } satisfies Record<QaNlpCategory, number>;
  const similaritySum = { ...votes };
  for (const neighbor of neighbors) {
    votes[neighbor.category] += 1;
    similaritySum[neighbor.category] += neighbor.similarity;
  }

  let best: QaNlpCategory = 'content';
  for (const label of QA_NLP_GATEKEEPER_CATEGORIES) {
    if (votes[label] > votes[best]) {
      best = label;
    }
  }
  const agreement = neighbors.length === 0 ? 0 : votes[best] / neighbors.length;
  const meanSimilarity = votes[best] === 0 ? 0 : similaritySum[best] / votes[best];
  const confident =
    agreement >= QA_NLP_FALLBACK_MIN_AGREEMENT && meanSimilarity >= QA_NLP_FALLBACK_MIN_SIMILARITY;
  const scores = {
    content: votes.content / Math.max(neighbors.length, 1),
    organization: votes.organization / Math.max(neighbors.length, 1),
    technical: votes.technical / Math.max(neighbors.length, 1),
  };

  return {
    category: best,
    confidence: confident ? Math.min(1, Math.max(agreement, meanSimilarity)) : agreement * 0.5,
    scores,
  };
}

export function qaNlpFallbackAccepts(prediction: QaNlpScoredPrediction): boolean {
  return (
    prediction.confidence >= QA_NLP_FALLBACK_MIN_AGREEMENT &&
    (prediction.scores[prediction.category] ?? 0) >= QA_NLP_FALLBACK_MIN_AGREEMENT
  );
}
