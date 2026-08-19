import type { QaNlpCategory } from '@arsnova/shared-types';
import {
  QA_NLP_SEED_LOCALES,
  QA_NLP_SEED_TAGS,
  type QaNlpSeedExample,
  type QaNlpSeedLocale,
  type QaNlpSeedTag,
} from './qaNlpSeed';
import type { QaNlpScoredPrediction } from './qaNlpNaiveBayes';
import { QA_NLP_GATEKEEPER_CATEGORIES } from './qaNlpNaiveBayes';

export type QaNlpEvalCounts = {
  readonly size: number;
  readonly classifiedCount: number;
  /** Best-Guess-Accuracy ueber alle gelabelten Beispiele, unabhaengig von der Schwelle. */
  readonly accuracy: number;
  /** Accuracy nur unter den Beispielen mit Konfidenz >= minConfidence. */
  readonly classifiedAccuracy: number;
  readonly classifiedCoverage: number;
  readonly macroF1: number;
  readonly perClass: Readonly<
    Record<QaNlpCategory, { precision: number; recall: number; f1: number; support: number }>
  >;
  readonly confusion: Readonly<Record<QaNlpCategory, Record<QaNlpCategory, number>>>;
  readonly uncertainRate: number;
};

function emptyConfusion(): Record<QaNlpCategory, Record<QaNlpCategory, number>> {
  return {
    content: { content: 0, organization: 0, technical: 0 },
    organization: { content: 0, organization: 0, technical: 0 },
    technical: { content: 0, organization: 0, technical: 0 },
  };
}

export function evaluateQaNlpPredictions(
  examples: readonly QaNlpSeedExample[],
  predict: (text: string) => QaNlpScoredPrediction,
  minConfidence: number,
): QaNlpEvalCounts {
  const confusion = emptyConfusion();
  let correct = 0;
  let classifiedCorrect = 0;
  let classifiedCount = 0;
  for (const example of examples) {
    const prediction = predict(example.text);
    const classified = prediction.confidence >= minConfidence;
    if (classified) {
      classifiedCount += 1;
    }
    confusion[example.category][prediction.category] += 1;
    if (prediction.category === example.category) {
      correct += 1;
      if (classified) {
        classifiedCorrect += 1;
      }
    }
  }
  const uncertain = examples.length - classifiedCount;

  const perClass = {} as Record<
    QaNlpCategory,
    { precision: number; recall: number; f1: number; support: number }
  >;
  for (const label of QA_NLP_GATEKEEPER_CATEGORIES) {
    const support = QA_NLP_GATEKEEPER_CATEGORIES.reduce(
      (sum, predicted) => sum + confusion[label][predicted],
      0,
    );
    const truePositives = confusion[label][label];
    const predictedPositives = QA_NLP_GATEKEEPER_CATEGORIES.reduce(
      (sum, gold) => sum + confusion[gold][label],
      0,
    );
    const precision = predictedPositives === 0 ? 0 : truePositives / predictedPositives;
    const recall = support === 0 ? 0 : truePositives / support;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    perClass[label] = { precision, recall, f1, support };
  }
  const macroF1 =
    QA_NLP_GATEKEEPER_CATEGORIES.reduce((sum, label) => sum + perClass[label].f1, 0) /
    QA_NLP_GATEKEEPER_CATEGORIES.length;

  return {
    size: examples.length,
    classifiedCount,
    accuracy: examples.length === 0 ? 0 : correct / examples.length,
    classifiedAccuracy: classifiedCount === 0 ? 0 : classifiedCorrect / classifiedCount,
    classifiedCoverage: examples.length === 0 ? 0 : classifiedCount / examples.length,
    macroF1,
    perClass,
    confusion,
    uncertainRate: examples.length === 0 ? 0 : uncertain / examples.length,
  };
}

function evaluateNonEmptyGroups<T extends string>(
  examples: readonly QaNlpSeedExample[],
  predict: (text: string) => QaNlpScoredPrediction,
  minConfidence: number,
  keys: readonly T[],
  matches: (example: QaNlpSeedExample, key: T) => boolean,
): Partial<Record<T, QaNlpEvalCounts>> {
  const result: Partial<Record<T, QaNlpEvalCounts>> = {};
  for (const key of keys) {
    const subset = examples.filter((example) => matches(example, key));
    if (subset.length === 0) {
      continue;
    }
    result[key] = evaluateQaNlpPredictions(subset, predict, minConfidence);
  }
  return result;
}

export function evaluateQaNlpByTag(
  examples: readonly QaNlpSeedExample[],
  predict: (text: string) => QaNlpScoredPrediction,
  minConfidence: number,
): Partial<Record<QaNlpSeedTag, QaNlpEvalCounts>> {
  return evaluateNonEmptyGroups(
    examples,
    predict,
    minConfidence,
    QA_NLP_SEED_TAGS,
    (example, tag) => example.tags.includes(tag),
  );
}

export function evaluateQaNlpByLocale(
  examples: readonly QaNlpSeedExample[],
  predict: (text: string) => QaNlpScoredPrediction,
  minConfidence: number,
): Partial<Record<QaNlpSeedLocale, QaNlpEvalCounts>> {
  return evaluateNonEmptyGroups(
    examples,
    predict,
    minConfidence,
    QA_NLP_SEED_LOCALES,
    (example, locale) => example.locale === locale,
  );
}
