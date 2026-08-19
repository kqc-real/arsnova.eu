import { describe, expect, it } from 'vitest';
import { classifyQaNlpCascade, shouldEarlyExitQaNlp } from './qaNlpCascade';
import { QA_NLP_FALLBACK_MODEL_VERSION, QA_NLP_GATEKEEPER_MODEL_VERSION } from './qaNlpConfig';
import { classifyQaNlpSnapshot, getQaNlpGatekeeperModel } from './qaNlpGatekeeper';
import { predictQaNlpNaiveBayes } from './qaNlpNaiveBayes';
import { qaNlpEvalExamplesWithTag, qaNlpLabeledEvalExamples } from './qaNlpSeed';

describe('qaNlpCascade', () => {
  it('laesst leeren Text unsicher ohne Fallback', () => {
    const result = classifyQaNlpCascade({ text: '  ' });
    expect(result.status).toBe('uncertain');
    expect(result.usedFallback).toBe(false);
    expect(result.earlyExit).toBe(false);
    expect(result.category).toBeUndefined();
  });

  it('behaelt klare Organisationsfragen im Early-Exit', () => {
    const result = classifyQaNlpCascade({
      text: 'Bis wann muss die Hausarbeit abgegeben werden?',
    });
    expect(result.status).toBe('classified');
    expect(result.category).toBe('organization');
    expect(result.earlyExit).toBe(true);
    expect(result.usedFallback).toBe(false);
    expect(result.modelVersion).toBe(QA_NLP_GATEKEEPER_MODEL_VERSION);
  });

  it('schickt kurze oder knapp gepolte Texte in den Fallback', () => {
    const result = classifyQaNlpCascade({ text: 'Hallo zusammen' });
    expect(result.earlyExit).toBe(false);
    expect(result.usedFallback).toBe(true);
    expect(result.modelVersion).toBe(QA_NLP_FALLBACK_MODEL_VERSION);
  });
});

describe('shouldEarlyExitQaNlp', () => {
  it('verlangt Konfidenz, Margin und Mindesttokenzahl', () => {
    const model = getQaNlpGatekeeperModel();
    const prediction = predictQaNlpNaiveBayes(
      model,
      'Bis wann muss die Hausarbeit abgegeben werden?',
    );
    expect(shouldEarlyExitQaNlp(prediction, 'Bis wann muss die Hausarbeit abgegeben werden?')).toBe(
      true,
    );
    expect(shouldEarlyExitQaNlp(prediction, 'Abgabe?')).toBe(false);
  });
});

describe('qaNlpCascade quality', () => {
  it('klassifiziert auf Slang nicht mehr falsch als der Gatekeeper allein', () => {
    const slang = qaNlpEvalExamplesWithTag('slang').filter(
      (example) => !example.tags.includes('ambiguous'),
    );
    expect(slang.length).toBeGreaterThanOrEqual(6);

    let gatekeeperWrong = 0;
    let cascadeWrong = 0;
    for (const example of slang) {
      const gatekeeper = classifyQaNlpSnapshot({ text: example.text });
      const cascade = classifyQaNlpCascade({ text: example.text });
      if (gatekeeper.status === 'classified' && gatekeeper.category !== example.category) {
        gatekeeperWrong += 1;
      }
      if (cascade.status === 'classified' && cascade.category !== example.category) {
        cascadeWrong += 1;
      }
    }
    expect(cascadeWrong).toBeLessThanOrEqual(gatekeeperWrong);
  });

  it('haelt kanonisches Eval nach der Kaskade mehrheitlich korrekt klassifiziert', () => {
    const canonical = qaNlpLabeledEvalExamples().filter((example) =>
      example.tags.includes('canonical'),
    );
    let classifiedCorrect = 0;
    for (const example of canonical) {
      const result = classifyQaNlpCascade({ text: example.text });
      if (result.status === 'classified' && result.category === example.category) {
        classifiedCorrect += 1;
      }
    }
    expect(classifiedCorrect / canonical.length).toBeGreaterThanOrEqual(0.7);
  });

  it('deckt FR- und ES-Eval mit der Kaskade mehrheitlich korrekt ab', () => {
    for (const locale of ['fr', 'es'] as const) {
      const examples = qaNlpLabeledEvalExamples().filter((example) => example.locale === locale);
      expect(examples.length).toBeGreaterThanOrEqual(12);
      let classifiedCorrect = 0;
      for (const example of examples) {
        const result = classifyQaNlpCascade({ text: example.text });
        if (result.status === 'classified' && result.category === example.category) {
          classifiedCorrect += 1;
        }
      }
      expect(classifiedCorrect / examples.length, locale).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('klassifiziert 200 Kaskaden-Snapshots unter 500ms', () => {
    const text = 'Bis wann muss die Hausarbeit abgegeben werden?';
    classifyQaNlpCascade({ text });
    const started = Date.now();
    for (let index = 0; index < 200; index += 1) {
      classifyQaNlpCascade({ text });
    }
    expect(Date.now() - started).toBeLessThan(500);
  });
});
