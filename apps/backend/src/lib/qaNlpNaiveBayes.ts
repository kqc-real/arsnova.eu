import type { QaNlpCategory } from '@arsnova/shared-types';

export const QA_NLP_GATEKEEPER_CATEGORIES = [
  'content',
  'organization',
  'technical',
] as const satisfies readonly QaNlpCategory[];

export const QA_NLP_FEATURE_DIM = 2048;
export const QA_NLP_CHAR_NGRAM_MIN = 3;
export const QA_NLP_CHAR_NGRAM_MAX = 5;
/** Temperierung der Naive-Bayes-Softmax, damit Konfidenzen nicht bei 1.0 kleben. */
export const QA_NLP_SOFTMAX_TEMPERATURE = 2;
const FNV_OFFSET = 2_166_136_261;
const FNV_PRIME = 16_777_619;

export function normalizeQaNlpText(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fnv1a(feature: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < feature.length; index += 1) {
    hash ^= feature.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0) % QA_NLP_FEATURE_DIM;
}

export function extractQaNlpFeatureCounts(text: string): Int32Array {
  const counts = new Int32Array(QA_NLP_FEATURE_DIM);
  const normalized = normalizeQaNlpText(text);
  if (!normalized) {
    return counts;
  }

  const padded = ` ${normalized} `;
  for (let size = QA_NLP_CHAR_NGRAM_MIN; size <= QA_NLP_CHAR_NGRAM_MAX; size += 1) {
    if (padded.length < size) {
      continue;
    }
    for (let start = 0; start <= padded.length - size; start += 1) {
      counts[fnv1a(`c:${padded.slice(start, start + size)}`)] += 1;
    }
  }

  for (const word of normalized.split(' ')) {
    if (word.length > 0) {
      counts[fnv1a(`w:${word}`)] += 1;
    }
  }
  return counts;
}

export type QaNlpNaiveBayesModel = {
  readonly version: string;
  readonly dim: number;
  readonly labels: readonly QaNlpCategory[];
  readonly logPriors: readonly number[];
  readonly logLikelihood: readonly (readonly number[])[];
};

export function trainQaNlpNaiveBayes(
  examples: ReadonlyArray<{ text: string; category: QaNlpCategory }>,
  version: string,
): QaNlpNaiveBayesModel {
  const labels = QA_NLP_GATEKEEPER_CATEGORIES;
  const labelIndex = new Map<QaNlpCategory, number>(labels.map((label, index) => [label, index]));
  const docCounts = new Float64Array(labels.length);
  const featureCounts = labels.map(() => new Float64Array(QA_NLP_FEATURE_DIM));
  const featureTotals = new Float64Array(labels.length);

  for (const example of examples) {
    const index = labelIndex.get(example.category);
    if (index === undefined) {
      continue;
    }
    docCounts[index] += 1;
    const counts = extractQaNlpFeatureCounts(example.text);
    for (let dim = 0; dim < QA_NLP_FEATURE_DIM; dim += 1) {
      const value = counts[dim] ?? 0;
      if (value > 0) {
        featureCounts[index]![dim] += value;
        featureTotals[index] += value;
      }
    }
  }

  const totalDocs = docCounts.reduce((sum, count) => sum + count, 0);
  const logPriors = labels.map((_, index) => {
    const count = docCounts[index] ?? 0;
    return Math.log((count + 1) / (totalDocs + labels.length));
  });
  const logLikelihood = labels.map((_, index) => {
    const total = (featureTotals[index] ?? 0) + QA_NLP_FEATURE_DIM;
    const row = featureCounts[index]!;
    return Array.from(row, (count) => Math.log((count + 1) / total));
  });

  return {
    version,
    dim: QA_NLP_FEATURE_DIM,
    labels,
    logPriors,
    logLikelihood,
  };
}

export type QaNlpScoredPrediction = {
  readonly category: QaNlpCategory;
  readonly confidence: number;
  readonly scores: Readonly<Record<QaNlpCategory, number>>;
};

function softmax(logScores: readonly number[], temperature = QA_NLP_SOFTMAX_TEMPERATURE): number[] {
  const max = Math.max(...logScores);
  const exps = logScores.map((score) => Math.exp((score - max) / temperature));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map((value) => value / sum);
}

export function predictQaNlpNaiveBayes(
  model: QaNlpNaiveBayesModel,
  text: string,
): QaNlpScoredPrediction {
  const counts = extractQaNlpFeatureCounts(text);
  const logScores = model.labels.map((_, index) => {
    let score = model.logPriors[index] ?? 0;
    const likelihood = model.logLikelihood[index];
    if (!likelihood) {
      return score;
    }
    for (let dim = 0; dim < model.dim; dim += 1) {
      const value = counts[dim] ?? 0;
      if (value > 0) {
        score += value * (likelihood[dim] ?? 0);
      }
    }
    return score;
  });
  const probabilities = softmax(logScores);
  let bestIndex = 0;
  for (let index = 1; index < probabilities.length; index += 1) {
    if ((probabilities[index] ?? 0) > (probabilities[bestIndex] ?? 0)) {
      bestIndex = index;
    }
  }
  const scores = Object.fromEntries(
    model.labels.map((label, index) => [label, probabilities[index] ?? 0]),
  ) as Record<QaNlpCategory, number>;
  return {
    category: model.labels[bestIndex] ?? 'content',
    confidence: probabilities[bestIndex] ?? 0,
    scores,
  };
}
