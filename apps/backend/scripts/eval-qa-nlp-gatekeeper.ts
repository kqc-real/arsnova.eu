#!/usr/bin/env tsx
/**
 * Druckt Precision/Recall/F1, Slice-Metriken und die Kalibrierkurve des
 * Q&A-NLP-Gatekeepers gegen das kuratierte Seed-Set.
 * Kein Produktiv-Freigabeersatz; dient der lokalen Messung (ADR-0032).
 */
import { format } from 'node:util';
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
import { qaNlpAmbiguousEvalExamples, qaNlpLabeledEvalExamples } from '../src/lib/qaNlpSeed';

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

log(
  JSON.stringify(
    {
      modelVersion: model.version,
      minConfidenceDefault: QA_NLP_MIN_CONFIDENCE_DEFAULT,
      productionRelease: false,
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
