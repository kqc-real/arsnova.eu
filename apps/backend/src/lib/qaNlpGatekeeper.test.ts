import { describe, expect, it } from 'vitest';
import { calibrateQaNlpThreshold, recommendQaNlpOperatingPoint } from './qaNlpCalibrate';
import { QA_NLP_GATEKEEPER_MODEL_VERSION, QA_NLP_MIN_CONFIDENCE_DEFAULT } from './qaNlpConfig';
import { evaluateQaNlpPredictions } from './qaNlpEvaluate';
import { classifyQaNlpSnapshot, getQaNlpGatekeeperModel } from './qaNlpGatekeeper';
import { predictQaNlpKeywordBaseline } from './qaNlpKeywordBaseline';
import { predictQaNlpNaiveBayes } from './qaNlpNaiveBayes';
import {
  QA_NLP_SEED_EXAMPLES,
  QA_NLP_SEED_TAGS,
  qaNlpLabeledEvalExamples,
  qaNlpSeedBySplit,
} from './qaNlpSeed';

describe('qaNlpSeed', () => {
  it('deckt alle Kategorien in Train und Eval ab und hat eindeutige Texte', () => {
    const texts = QA_NLP_SEED_EXAMPLES.map((example) => example.text);
    expect(new Set(texts).size).toBe(texts.length);
    for (const split of ['train', 'eval'] as const) {
      const categories = new Set(qaNlpSeedBySplit(split).map((example) => example.category));
      expect(categories).toEqual(new Set(['content', 'organization', 'technical']));
    }
  });

  it('haelt das gelabelte Eval-Set nach Slice 3 gross genug und nach Tags aufgeschluesselt', () => {
    const labeled = qaNlpLabeledEvalExamples();
    const evalExamples = qaNlpSeedBySplit('eval');
    expect(labeled.length).toBeGreaterThanOrEqual(60);
    expect(
      evalExamples.filter((example) => example.tags.includes('ambiguous')).length,
    ).toBeGreaterThanOrEqual(8);
    for (const tag of QA_NLP_SEED_TAGS) {
      const support = evalExamples.filter((example) => example.tags.includes(tag)).length;
      expect(support, tag).toBeGreaterThanOrEqual(tag === 'ambiguous' ? 8 : 6);
    }
    expect(labeled.some((example) => example.locale === 'de')).toBe(true);
    expect(labeled.some((example) => example.locale === 'en')).toBe(true);
    expect(labeled.some((example) => example.locale === 'mixed')).toBe(true);
    expect(labeled.filter((example) => example.locale === 'fr').length).toBeGreaterThanOrEqual(12);
    expect(labeled.filter((example) => example.locale === 'es').length).toBeGreaterThanOrEqual(12);
  });

  it('deckt den Prototype-Split fuer Level 2 in allen Kategorien ab', () => {
    const prototypes = qaNlpSeedBySplit('prototype');
    expect(prototypes.length).toBeGreaterThanOrEqual(16);
    expect(new Set(prototypes.map((example) => example.category))).toEqual(
      new Set(['content', 'organization', 'technical']),
    );
  });
});

describe('qaNlpGatekeeper', () => {
  it('klassifiziert klare Organisations- und Technikfragen', () => {
    const organization = classifyQaNlpSnapshot(
      { text: 'Bis wann muss die Hausarbeit abgegeben werden?' },
      QA_NLP_MIN_CONFIDENCE_DEFAULT,
      new Date('2026-08-19T12:00:00.000Z'),
    );
    expect(organization.status).toBe('classified');
    expect(organization.category).toBe('organization');
    expect(organization.modelVersion).toBe(QA_NLP_GATEKEEPER_MODEL_VERSION);
    expect(organization.confidence).toBeGreaterThan(QA_NLP_MIN_CONFIDENCE_DEFAULT);

    const technical = classifyQaNlpSnapshot({ text: 'Das WLAN im Hoersaal ist gerade tot.' });
    expect(technical.category).toBe('technical');
    expect(technical.status).toBe('classified');
  });

  it('markiert leeren Text als uncertain ohne Kategorie', () => {
    const result = classifyQaNlpSnapshot({ text: '   ' });
    expect(result.status).toBe('uncertain');
    expect(result.category).toBeUndefined();
  });

  it('faellt bei schwach gepolten Texten unter die Konfidenzschwelle', () => {
    const result = classifyQaNlpSnapshot({ text: 'Hallo zusammen' });
    expect(result.status).toBe('uncertain');
    expect(result.category).toBeDefined();
  });
});

describe('qaNlpGatekeeper evaluation', () => {
  const model = getQaNlpGatekeeperModel();
  const train = qaNlpSeedBySplit('train');
  const labeledEval = qaNlpLabeledEvalExamples();
  const canonicalEval = labeledEval.filter((example) => example.tags.includes('canonical'));
  const predictNb = (text: string) => predictQaNlpNaiveBayes(model, text);

  it('haelt Train-Accuracy und kanonisches Eval-F1 ueber der Seed-Schwelle', () => {
    const trainReport = evaluateQaNlpPredictions(train, predictNb, QA_NLP_MIN_CONFIDENCE_DEFAULT);
    const canonicalReport = evaluateQaNlpPredictions(
      canonicalEval,
      predictNb,
      QA_NLP_MIN_CONFIDENCE_DEFAULT,
    );
    const keywordReport = evaluateQaNlpPredictions(
      canonicalEval,
      predictQaNlpKeywordBaseline,
      QA_NLP_MIN_CONFIDENCE_DEFAULT,
    );

    expect(trainReport.accuracy).toBeGreaterThanOrEqual(0.95);
    expect(canonicalReport.macroF1).toBeGreaterThanOrEqual(0.7);
    expect(canonicalReport.macroF1).toBeGreaterThanOrEqual(keywordReport.macroF1 - 0.05);
    expect(labeledEval.length).toBeGreaterThan(canonicalEval.length);
  });

  it('klassifiziert 200 kurze Snapshots unter 200ms', () => {
    const text = 'Kommt der Median in der Klausur vor?';
    const started = Date.now();
    for (let index = 0; index < 200; index += 1) {
      classifyQaNlpSnapshot({ text });
    }
    expect(Date.now() - started).toBeLessThan(200);
  });

  it('liefert eine monotone Kalibrierkurve und einen Betriebspunkt', () => {
    const curve = calibrateQaNlpThreshold(labeledEval, predictNb);
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index]!.uncertainRate).toBeGreaterThanOrEqual(curve[index - 1]!.uncertainRate);
      expect(curve[index]!.classifiedCoverage).toBeLessThanOrEqual(
        curve[index - 1]!.classifiedCoverage,
      );
    }
    const operating = recommendQaNlpOperatingPoint(curve);
    expect(operating.minConfidence).toBe(QA_NLP_MIN_CONFIDENCE_DEFAULT);
    expect(operating.preferredKept).toBe(true);
    expect(operating.meetsAccuracy).toBe(true);
    expect(operating.exceedsFallbackBudget).toBe(false);
    expect(operating.rationale.length).toBeGreaterThan(10);
  });
});
