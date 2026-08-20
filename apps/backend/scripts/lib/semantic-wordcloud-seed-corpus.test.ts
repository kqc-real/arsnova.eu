import { describe, expect, it } from 'vitest';
import {
  buildSemanticQaQuestionPool,
  buildSemanticQaQuestionTexts,
  SEMANTIC_QA_SEED_ITEM_COUNT,
  SEMANTIC_QA_SEED_MAX_CHARS,
} from './semantic-wordcloud-seed-corpus';

describe('semantisches Q&A-Seedkorpus', () => {
  it('fuellt das Analyse-Cap mit eindeutigen Paraphrasen inkl. kanonischer Fixtures', () => {
    const texts = buildSemanticQaQuestionTexts();
    const joined = texts.join('\n');

    expect(texts).toHaveLength(SEMANTIC_QA_SEED_ITEM_COUNT);
    expect(new Set(texts).size).toBe(SEMANTIC_QA_SEED_ITEM_COUNT);
    expect(Math.max(...texts.map((text) => text.length))).toBeLessThanOrEqual(
      SEMANTIC_QA_SEED_MAX_CHARS,
    );
    expect(buildSemanticQaQuestionPool().length).toBeGreaterThanOrEqual(
      SEMANTIC_QA_SEED_ITEM_COUNT,
    );
    expect(joined).toContain('Kommt Kapitel 4 in die Klausur?');
    expect(joined).toContain('Ist Kapitel 4 klausurrelevant?');
    expect(joined).toContain('Brauchen wir Kapitel 4 für die Prüfung?');
    expect(joined).toContain('lineare Regression');
    expect(joined).toContain('Folien von letzter Woche');
    expect(joined).toContain('Beamer-Hänger');
    expect(joined).toContain('zweiten Runde');
    expect(texts.some((text) => text.includes('Bonuspunkte'))).toBe(true);
  });
});
