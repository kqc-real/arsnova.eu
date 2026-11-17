import { expect, it } from 'vitest';
import { AppLocaleEnum } from '@arsnova/shared-types';
import { classifyQaNlpCascade } from '../../src/lib/qaNlpCascade';
import { QA_NLP_MIN_CONFIDENCE_DEFAULT } from '../../src/lib/qaNlpConfig';
import { normalizeQaNlpText } from '../../src/lib/qaNlpNaiveBayes';
import {
  QA_NLP_SEED_EXAMPLES,
  QA_NLP_SEED_LOCALES,
  qaNlpSeedBySplit,
} from '../../src/lib/qaNlpSeed';
import { QA_NLP_LOCALE_EVAL } from './qa-nlp-locale-eval';

it('deckt alle Klassen je Sprache ab und hält den Locale-Prüfsatz getrennt', () => {
  const train = qaNlpSeedBySplit('train');
  const seedTexts = new Set(QA_NLP_SEED_EXAMPLES.map(({ text }) => normalizeQaNlpText(text)));
  for (const example of QA_NLP_LOCALE_EVAL) {
    expect(seedTexts.has(normalizeQaNlpText(example.text))).toBe(false);
  }
  for (const locale of QA_NLP_SEED_LOCALES) {
    const evalExamples = QA_NLP_LOCALE_EVAL.filter((example) => example.locale === locale);
    for (const category of ['content', 'organization', 'technical'] as const) {
      expect(
        train.some((example) => example.locale === locale && example.category === category),
      ).toBe(true);
      expect(evalExamples.filter((example) => example.category === category)).toHaveLength(
        locale === 'mixed' ? 3 : 5,
      );
    }
  }
});

it.each(AppLocaleEnum.options)(
  'klassifiziert mindestens 80 Prozent aller Prüffragen in %s korrekt',
  (locale) => {
    const examples = QA_NLP_LOCALE_EVAL.filter((example) => example.locale === locale);
    const correct = examples.filter(({ text, category }) => {
      const result = classifyQaNlpCascade({ text }, QA_NLP_MIN_CONFIDENCE_DEFAULT);
      return result.status === 'classified' && result.category === category;
    }).length;
    expect(correct / examples.length).toBeGreaterThanOrEqual(0.8);
  },
);
