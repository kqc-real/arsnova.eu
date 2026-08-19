import { describe, expect, it } from 'vitest';
import {
  QA_NLP_CALIBRATION_THRESHOLDS,
  QA_NLP_LEVEL2_FALLBACK_BUDGET,
  QA_NLP_OPERATING_MIN_CLASSIFIED_ACCURACY,
  calibrateQaNlpThreshold,
  recommendQaNlpOperatingPoint,
  type QaNlpCalibrationPoint,
} from './qaNlpCalibrate';
import type { QaNlpEvalCounts } from './qaNlpEvaluate';
import type { QaNlpScoredPrediction } from './qaNlpNaiveBayes';
import type { QaNlpSeedExample } from './qaNlpSeed';

function example(text: string, category: QaNlpSeedExample['category']): QaNlpSeedExample {
  return {
    text,
    category,
    split: 'eval',
    locale: 'de',
    tags: ['canonical'],
  };
}

function prediction(
  category: QaNlpScoredPrediction['category'],
  confidence: number,
): QaNlpScoredPrediction {
  return { category, confidence, scores: { content: 0, organization: 0, technical: 0 } };
}

function emptyCounts(overrides: Partial<QaNlpEvalCounts>): QaNlpEvalCounts {
  return {
    size: 10,
    classifiedCount: 10,
    accuracy: 1,
    classifiedAccuracy: 1,
    classifiedCoverage: 1,
    macroF1: 1,
    perClass: {
      content: { precision: 1, recall: 1, f1: 1, support: 4 },
      organization: { precision: 1, recall: 1, f1: 1, support: 3 },
      technical: { precision: 1, recall: 1, f1: 1, support: 3 },
    },
    confusion: {
      content: { content: 4, organization: 0, technical: 0 },
      organization: { content: 0, organization: 3, technical: 0 },
      technical: { content: 0, organization: 0, technical: 3 },
    },
    uncertainRate: 0,
    ...overrides,
  };
}

describe('calibrateQaNlpThreshold', () => {
  it('hebt die Uncertain-Rate mit der Schwelle an', () => {
    const examples = [
      example('klar', 'content'),
      example('mittel', 'organization'),
      example('schwach', 'technical'),
    ];
    const predict = (text: string): QaNlpScoredPrediction => {
      if (text === 'klar') return prediction('content', 0.9);
      if (text === 'mittel') return prediction('organization', 0.6);
      return prediction('technical', 0.3);
    };
    const curve = calibrateQaNlpThreshold(examples, predict, [0.2, 0.55, 0.8]);
    expect(curve.map((point) => point.uncertainRate)).toEqual([0, 1 / 3, 2 / 3]);
    expect(curve.map((point) => point.classifiedCoverage)).toEqual([1, 2 / 3, 1 / 3]);
    expect(curve[1]?.classifiedAccuracy).toBe(1);
  });
});

describe('recommendQaNlpOperatingPoint', () => {
  it('behaelt den Default wenn er die Classified-Accuracy erfuellt', () => {
    const curve: QaNlpCalibrationPoint[] = [
      { minConfidence: 0.2, ...emptyCounts({ classifiedAccuracy: 0.82, uncertainRate: 0 }) },
      { minConfidence: 0.55, ...emptyCounts({ classifiedAccuracy: 0.9, uncertainRate: 0.2 }) },
      { minConfidence: 0.8, ...emptyCounts({ classifiedAccuracy: 0.95, uncertainRate: 0.5 }) },
    ];
    const operating = recommendQaNlpOperatingPoint(curve);
    expect(operating.minConfidence).toBe(0.55);
    expect(operating.preferredKept).toBe(true);
    expect(operating.lowestEligibleMinConfidence).toBe(0.2);
    expect(operating.meetsAccuracy).toBe(true);
    expect(operating.exceedsFallbackBudget).toBe(false);
  });

  it('markiert Level-2-Bedarf wenn die Uncertain-Rate das Budget sprengt', () => {
    const curve: QaNlpCalibrationPoint[] = [
      {
        minConfidence: 0.55,
        ...emptyCounts({ classifiedAccuracy: 0.88, uncertainRate: 0.45, classifiedCoverage: 0.55 }),
      },
    ];
    const operating = recommendQaNlpOperatingPoint(curve);
    expect(operating.meetsAccuracy).toBe(true);
    expect(operating.preferredKept).toBe(true);
    expect(operating.exceedsFallbackBudget).toBe(true);
    expect(operating.rationale).toContain('ueber Fallback-Budget');
  });

  it('weicht auf die niedrigste geeignete Schwelle aus wenn der Default fehlt', () => {
    const curve: QaNlpCalibrationPoint[] = [
      { minConfidence: 0.4, ...emptyCounts({ classifiedAccuracy: 0.82, uncertainRate: 0.1 }) },
      { minConfidence: 0.7, ...emptyCounts({ classifiedAccuracy: 0.91, uncertainRate: 0.2 }) },
    ];
    const operating = recommendQaNlpOperatingPoint(curve);
    expect(operating.preferredKept).toBe(false);
    expect(operating.minConfidence).toBe(0.4);
    expect(operating.lowestEligibleMinConfidence).toBe(0.4);
  });

  it('nutzt den besten Punkt wenn keine Schwelle die Accuracy schafft', () => {
    const curve: QaNlpCalibrationPoint[] = [
      { minConfidence: 0.4, ...emptyCounts({ classifiedAccuracy: 0.5, uncertainRate: 0.1 }) },
      { minConfidence: 0.7, ...emptyCounts({ classifiedAccuracy: 0.6, uncertainRate: 0.4 }) },
    ];
    const operating = recommendQaNlpOperatingPoint(curve);
    expect(operating.meetsAccuracy).toBe(false);
    expect(operating.preferredKept).toBe(false);
    expect(operating.minConfidence).toBe(0.7);
  });
});

describe('qaNlpCalibrate constants', () => {
  it('haelt Budget und Default-Schwelle im kalibrierten Raster', () => {
    expect(QA_NLP_CALIBRATION_THRESHOLDS).toContain(0.55);
    expect(QA_NLP_LEVEL2_FALLBACK_BUDGET).toBe(0.3);
    expect(QA_NLP_OPERATING_MIN_CLASSIFIED_ACCURACY).toBe(0.8);
  });
});
