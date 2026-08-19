import { describe, expect, it } from 'vitest';
import { QA_NLP_GATEKEEPER_MODEL_VERSION, QA_NLP_MIN_CONFIDENCE_DEFAULT } from './qaNlpConfig';
import { evaluateQaNlpPredictions } from './qaNlpEvaluate';
import { classifyQaNlpSnapshot, getQaNlpGatekeeperModel } from './qaNlpGatekeeper';
import { predictQaNlpKeywordBaseline } from './qaNlpKeywordBaseline';
import { predictQaNlpNaiveBayes } from './qaNlpNaiveBayes';
import { QA_NLP_SEED_EXAMPLES, qaNlpSeedBySplit } from './qaNlpSeed';

describe('qaNlpSeed', () => {
  it('deckt alle Kategorien in Train und Eval ab und hat eindeutige Texte', () => {
    const texts = QA_NLP_SEED_EXAMPLES.map((example) => example.text);
    expect(new Set(texts).size).toBe(texts.length);
    for (const split of ['train', 'eval'] as const) {
      const categories = new Set(qaNlpSeedBySplit(split).map((example) => example.category));
      expect(categories).toEqual(new Set(['content', 'organization', 'technical']));
    }
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
  const evalExamples = qaNlpSeedBySplit('eval').filter(
    (example) => !example.tags.includes('ambiguous'),
  );
  const predictNb = (text: string) => predictQaNlpNaiveBayes(model, text);

  it('haelt Train-Accuracy und Eval-F1 ueber der Freigabeschwelle des Seed-Sets', () => {
    const trainReport = evaluateQaNlpPredictions(train, predictNb, QA_NLP_MIN_CONFIDENCE_DEFAULT);
    const evalReport = evaluateQaNlpPredictions(
      evalExamples,
      predictNb,
      QA_NLP_MIN_CONFIDENCE_DEFAULT,
    );
    const keywordReport = evaluateQaNlpPredictions(
      evalExamples,
      predictQaNlpKeywordBaseline,
      QA_NLP_MIN_CONFIDENCE_DEFAULT,
    );

    expect(trainReport.accuracy).toBeGreaterThanOrEqual(0.95);
    expect(evalReport.macroF1).toBeGreaterThanOrEqual(0.7);
    expect(evalReport.macroF1).toBeGreaterThanOrEqual(keywordReport.macroF1 - 0.05);
  });

  it('klassifiziert 200 kurze Snapshots unter 200ms', () => {
    const text = 'Kommt der Median in der Klausur vor?';
    const started = Date.now();
    for (let index = 0; index < 200; index += 1) {
      classifyQaNlpSnapshot({ text });
    }
    expect(Date.now() - started).toBeLessThan(200);
  });
});
