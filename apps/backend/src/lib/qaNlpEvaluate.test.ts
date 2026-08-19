import { describe, expect, it } from 'vitest';
import {
  evaluateQaNlpByLocale,
  evaluateQaNlpByTag,
  evaluateQaNlpPredictions,
} from './qaNlpEvaluate';
import type { QaNlpScoredPrediction } from './qaNlpNaiveBayes';
import type { QaNlpSeedExample } from './qaNlpSeed';

function example(
  text: string,
  category: QaNlpSeedExample['category'],
  tags: QaNlpSeedExample['tags'],
  locale: QaNlpSeedExample['locale'] = 'de',
): QaNlpSeedExample {
  return { text, category, split: 'eval', locale, tags };
}

describe('evaluateQaNlpPredictions', () => {
  it('trennt Best-Guess-Accuracy und Classified-Accuracy', () => {
    const examples = [
      example('a', 'content', ['canonical']),
      example('b', 'organization', ['canonical']),
    ];
    const predict = (text: string): QaNlpScoredPrediction =>
      text === 'a'
        ? {
            category: 'content',
            confidence: 0.9,
            scores: { content: 0.9, organization: 0.05, technical: 0.05 },
          }
        : {
            category: 'technical',
            confidence: 0.4,
            scores: { content: 0.2, organization: 0.2, technical: 0.4 },
          };
    const report = evaluateQaNlpPredictions(examples, predict, 0.55);
    expect(report.size).toBe(2);
    expect(report.classifiedCount).toBe(1);
    expect(report.accuracy).toBe(0.5);
    expect(report.classifiedAccuracy).toBe(1);
    expect(report.uncertainRate).toBe(0.5);
  });
});

describe('evaluateQaNlpByTag / byLocale', () => {
  it('zaehlt Mehrfach-Tags in jeder Gruppe und laesst leere Gruppen weg', () => {
    const examples = [
      example('de-typo', 'content', ['typo', 'short'], 'de'),
      example('en-canon', 'organization', ['canonical'], 'en'),
    ];
    const predict = (): QaNlpScoredPrediction => ({
      category: 'content',
      confidence: 0.8,
      scores: { content: 0.8, organization: 0.1, technical: 0.1 },
    });
    const byTag = evaluateQaNlpByTag(examples, predict, 0.55);
    expect(byTag.typo?.size).toBe(1);
    expect(byTag.short?.size).toBe(1);
    expect(byTag.canonical?.size).toBe(1);
    expect(byTag.ambiguous).toBeUndefined();
    const byLocale = evaluateQaNlpByLocale(examples, predict, 0.55);
    expect(byLocale.de?.size).toBe(1);
    expect(byLocale.en?.size).toBe(1);
    expect(byLocale.fr).toBeUndefined();
  });
});
