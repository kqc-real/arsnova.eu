#!/usr/bin/env tsx
/**
 * Druckt Precision/Recall/F1, Slice-Metriken, die Kalibrierkurve des
 * Gatekeepers und die Kaskaden-Kennzahlen (Early-Exit/Fallback) gegen das
 * kuratierte Seed-Set. Kein Produktiv-Freigabeersatz (ADR-0032).
 */
import { format } from 'node:util';
import { classifyQaNlpCascade } from '../src/lib/qaNlpCascade';
import {
  QA_NLP_LEVEL2_FALLBACK_BUDGET,
  QA_NLP_OPERATING_MIN_CLASSIFIED_ACCURACY,
  calibrateQaNlpThreshold,
  recommendQaNlpOperatingPoint,
} from '../src/lib/qaNlpCalibrate';
import { QA_NLP_MIN_CONFIDENCE_DEFAULT } from '../src/lib/qaNlpConfig';
import {
  evaluateQaNlpByLocale,
  evaluateQaNlpByTag,
  evaluateQaNlpPredictions,
} from '../src/lib/qaNlpEvaluate';
import { getQaNlpGatekeeperModel } from '../src/lib/qaNlpGatekeeper';
import { predictQaNlpKeywordBaseline } from '../src/lib/qaNlpKeywordBaseline';
import { predictQaNlpNaiveBayes } from '../src/lib/qaNlpNaiveBayes';
import {
  QA_NLP_SEED_LOCALES,
  QA_NLP_SEED_TAGS,
  qaNlpAmbiguousEvalExamples,
  qaNlpLabeledEvalExamples,
  type QaNlpSeedExample,
} from '../src/lib/qaNlpSeed';

function log(...values: unknown[]): void {
  process.stdout.write(`${format(...values)}\n`);
}

const model = getQaNlpGatekeeperModel();
const labeledEval = qaNlpLabeledEvalExamples();
const ambiguousEval = qaNlpAmbiguousEvalExamples();
const predictNb = (text: string) => predictQaNlpNaiveBayes(model, text);
const nb = evaluateQaNlpPredictions(labeledEval, predictNb, QA_NLP_MIN_CONFIDENCE_DEFAULT);
const keyword = evaluateQaNlpPredictions(
  labeledEval,
  predictQaNlpKeywordBaseline,
  QA_NLP_MIN_CONFIDENCE_DEFAULT,
);
const curve = calibrateQaNlpThreshold(labeledEval, predictNb);
const operating = recommendQaNlpOperatingPoint(curve);

function summarizeCascade(examples: readonly QaNlpSeedExample[]) {
  let classified = 0;
  let correct = 0;
  let fallback = 0;
  let earlyExit = 0;
  for (const example of examples) {
    const result = classifyQaNlpCascade({ text: example.text });
    if (result.usedFallback) {
      fallback += 1;
    }
    if (result.earlyExit) {
      earlyExit += 1;
    }
    if (result.status === 'classified') {
      classified += 1;
      if (result.category === example.category) {
        correct += 1;
      }
    }
  }
  return {
    size: examples.length,
    classifiedCount: classified,
    earlyExitRate: examples.length === 0 ? 0 : earlyExit / examples.length,
    fallbackRate: examples.length === 0 ? 0 : fallback / examples.length,
    classifiedCoverage: examples.length === 0 ? 0 : classified / examples.length,
    classifiedAccuracy: classified === 0 ? 0 : correct / classified,
  };
}

function summarizeCascadeGroups<T extends string>(
  examples: readonly QaNlpSeedExample[],
  keys: readonly T[],
  matches: (example: QaNlpSeedExample, key: T) => boolean,
): Partial<Record<T, ReturnType<typeof summarizeCascade>>> {
  const result: Partial<Record<T, ReturnType<typeof summarizeCascade>>> = {};
  for (const key of keys) {
    const subset = examples.filter((example) => matches(example, key));
    if (subset.length === 0) {
      continue;
    }
    result[key] = summarizeCascade(subset);
  }
  return result;
}

log(
  JSON.stringify(
    {
      modelVersion: model.version,
      minConfidenceDefault: QA_NLP_MIN_CONFIDENCE_DEFAULT,
      productionRelease: false,
      cascade: {
        ...summarizeCascade(labeledEval),
        byTag: summarizeCascadeGroups(labeledEval, QA_NLP_SEED_TAGS, (example, tag) =>
          example.tags.includes(tag),
        ),
        byLocale: summarizeCascadeGroups(
          labeledEval,
          QA_NLP_SEED_LOCALES,
          (example, locale) => example.locale === locale,
        ),
      },
      eval: {
        labeledSize: labeledEval.length,
        ambiguousSize: ambiguousEval.length,
        naiveBayes: nb,
        keywordBaseline: keyword,
        byTag: evaluateQaNlpByTag(labeledEval, predictNb, QA_NLP_MIN_CONFIDENCE_DEFAULT),
        byLocale: evaluateQaNlpByLocale(labeledEval, predictNb, QA_NLP_MIN_CONFIDENCE_DEFAULT),
        ambiguous: evaluateQaNlpPredictions(
          ambiguousEval,
          predictNb,
          QA_NLP_MIN_CONFIDENCE_DEFAULT,
        ),
      },
      calibration: {
        fallbackBudget: QA_NLP_LEVEL2_FALLBACK_BUDGET,
        minClassifiedAccuracy: QA_NLP_OPERATING_MIN_CLASSIFIED_ACCURACY,
        curve: curve.map((point) => ({
          minConfidence: point.minConfidence,
          classifiedAccuracy: Number(point.classifiedAccuracy.toFixed(4)),
          uncertainRate: Number(point.uncertainRate.toFixed(4)),
          classifiedCoverage: Number(point.classifiedCoverage.toFixed(4)),
          macroF1: Number(point.macroF1.toFixed(4)),
        })),
        operatingPoint: {
          minConfidence: operating.minConfidence,
          meetsAccuracy: operating.meetsAccuracy,
          preferredKept: operating.preferredKept,
          exceedsFallbackBudget: operating.exceedsFallbackBudget,
          lowestEligibleMinConfidence: operating.lowestEligibleMinConfidence,
          classifiedAccuracy: Number(operating.point.classifiedAccuracy.toFixed(4)),
          uncertainRate: Number(operating.point.uncertainRate.toFixed(4)),
          rationale: operating.rationale,
        },
      },
    },
    null,
    2,
  ),
);
