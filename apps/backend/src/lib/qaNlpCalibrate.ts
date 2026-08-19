import { QA_NLP_MIN_CONFIDENCE_DEFAULT } from './qaNlpConfig';
import type { QaNlpEvalCounts } from './qaNlpEvaluate';
import { evaluateQaNlpPredictions } from './qaNlpEvaluate';
import type { QaNlpScoredPrediction } from './qaNlpNaiveBayes';
import type { QaNlpSeedExample } from './qaNlpSeed';

/** Schwellen fuer die Gatekeeper-Kalibrierkurve (ADR-0032, Betriebsparameter). */
export const QA_NLP_CALIBRATION_THRESHOLDS = [
  0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9,
] as const;

/**
 * Obergrenze der Uncertain-Rate auf gelabeltem Eval, ab der Level 2 (semantischer
 * Fallback) fachlich gerechtfertigt ist. Kein Produktiv-Freigabekriterium.
 */
export const QA_NLP_LEVEL2_FALLBACK_BUDGET = 0.3;

/** Minimale Accuracy unter als `classified` akzeptierten gelabelten Eval-Beispielen. */
export const QA_NLP_OPERATING_MIN_CLASSIFIED_ACCURACY = 0.8;

export type QaNlpCalibrationPoint = QaNlpEvalCounts & {
  readonly minConfidence: number;
};

export type QaNlpOperatingPoint = {
  readonly minConfidence: number;
  readonly point: QaNlpCalibrationPoint;
  readonly meetsAccuracy: boolean;
  readonly exceedsFallbackBudget: boolean;
  readonly preferredKept: boolean;
  readonly lowestEligibleMinConfidence: number | null;
  readonly rationale: string;
};

export function calibrateQaNlpThreshold(
  examples: readonly QaNlpSeedExample[],
  predict: (text: string) => QaNlpScoredPrediction,
  thresholds: readonly number[] = QA_NLP_CALIBRATION_THRESHOLDS,
): QaNlpCalibrationPoint[] {
  return thresholds.map((minConfidence) => ({
    minConfidence,
    ...evaluateQaNlpPredictions(examples, predict, minConfidence),
  }));
}

/**
 * Behaelt den gelieferten Default, sobald er die Classified-Accuracy erfuellt.
 * Die niedrigste formale Schwelle waere bei ueberconfidenten Modellen oft 0.2
 * und filtert dann nichts — das ist kein Betriebspunkt.
 * Fehlt ein geeigneter Default, wird die niedrigste Schwelle mit ausreichender
 * Accuracy gewaehlt. Liegt keine solche vor, bleibt der Punkt mit der
 * hoechsten Classified-Accuracy; dann ist Level 2 indiziert.
 */
export function recommendQaNlpOperatingPoint(
  curve: readonly QaNlpCalibrationPoint[],
  options: {
    readonly minClassifiedAccuracy?: number;
    readonly maxUncertainRate?: number;
    readonly preferredMinConfidence?: number;
  } = {},
): QaNlpOperatingPoint {
  const minClassifiedAccuracy =
    options.minClassifiedAccuracy ?? QA_NLP_OPERATING_MIN_CLASSIFIED_ACCURACY;
  const maxUncertainRate = options.maxUncertainRate ?? QA_NLP_LEVEL2_FALLBACK_BUDGET;
  const preferredMinConfidence = options.preferredMinConfidence ?? QA_NLP_MIN_CONFIDENCE_DEFAULT;
  if (curve.length === 0) {
    throw new Error('Kalibrierkurve ist leer');
  }

  const eligible = curve.filter(
    (point) => point.classifiedCount > 0 && point.classifiedAccuracy >= minClassifiedAccuracy,
  );
  const lowestEligible = eligible.reduce<QaNlpCalibrationPoint | undefined>(
    (best, point) => (!best || point.minConfidence < best.minConfidence ? point : best),
    undefined,
  );
  const preferred = eligible.find((point) => point.minConfidence === preferredMinConfidence);
  const fallback = curve.reduce((best, point) =>
    point.classifiedAccuracy > best.classifiedAccuracy ? point : best,
  );
  const preferredKept = preferred !== undefined;
  const point = preferred ?? lowestEligible ?? fallback;
  const meetsAccuracy = preferred !== undefined || lowestEligible !== undefined;
  const exceedsFallbackBudget = point.uncertainRate > maxUncertainRate;
  const rationale = preferredKept
    ? exceedsFallbackBudget
      ? `Default ${point.minConfidence} bleibt (Classified-Accuracy ${point.classifiedAccuracy.toFixed(3)}), Uncertain-Rate ${point.uncertainRate.toFixed(3)} ueber Fallback-Budget ${maxUncertainRate}.`
      : `Default ${point.minConfidence} bleibt: Classified-Accuracy ${point.classifiedAccuracy.toFixed(3)}, Uncertain-Rate ${point.uncertainRate.toFixed(3)} unter Fallback-Budget ${maxUncertainRate}.`
    : meetsAccuracy
      ? `Default ${preferredMinConfidence} verfehlt Classified-Accuracy ${minClassifiedAccuracy}; naechste geeignete Schwelle ${point.minConfidence}.`
      : `Keine Schwelle erreicht Classified-Accuracy ${minClassifiedAccuracy}; bester Punkt ${point.minConfidence} mit ${point.classifiedAccuracy.toFixed(3)}.`;

  return {
    minConfidence: point.minConfidence,
    point,
    meetsAccuracy,
    exceedsFallbackBudget,
    preferredKept,
    lowestEligibleMinConfidence: lowestEligible?.minConfidence ?? null,
    rationale,
  };
}
