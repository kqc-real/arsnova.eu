import type { QaNlpCategory } from '@arsnova/shared-types';
import type { QaNlpSeedExample } from './qaNlpSeed';
import type { QaNlpScoredPrediction } from './qaNlpNaiveBayes';
import { QA_NLP_GATEKEEPER_CATEGORIES } from './qaNlpNaiveBayes';

export type QaNlpEvalCounts = {
  readonly accuracy: number;
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
  let uncertain = 0;
  for (const example of examples) {
    const prediction = predict(example.text);
    if (prediction.confidence < minConfidence) {
      uncertain += 1;
    }
    confusion[example.category][prediction.category] += 1;
    if (prediction.category === example.category) {
      correct += 1;
    }
  }

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
    accuracy: examples.length === 0 ? 0 : correct / examples.length,
    macroF1,
    perClass,
    confusion,
    uncertainRate: examples.length === 0 ? 0 : uncertain / examples.length,
  };
}
