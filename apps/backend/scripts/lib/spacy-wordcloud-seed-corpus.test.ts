import { describe, expect, it } from 'vitest';
import { isSessionCode, normalizeSessionCode } from './prompt-session-code';
import {
  buildSpacyFreetextResponses,
  buildSpacyQaQuestionTexts,
  SPACY_WORDCLOUD_SEED_ITEM_CHARS,
  SPACY_WORDCLOUD_SEED_ITEM_COUNT,
} from './spacy-wordcloud-seed-corpus';

describe('normalizeSessionCode', () => {
  it('normalisiert Kleinbuchstaben, Leerzeichen und gibt gültige Codes frei', () => {
    expect(normalizeSessionCode(' ab12cd ')).toBe('AB12CD');
    expect(isSessionCode(normalizeSessionCode('ab12cd'))).toBe(true);
    expect(isSessionCode(normalizeSessionCode('ab12'))).toBe(false);
    expect(isSessionCode(normalizeSessionCode('ABC12!'))).toBe(false);
  });
});

describe('spaCy-Wortwolken-Seedkorpus', () => {
  it('füllt Freitext bis zum Analyse-Cap mit Flexion, Phrasen und langem Text', () => {
    const responses = buildSpacyFreetextResponses();
    const joined = responses.join('\n');

    expect(responses).toHaveLength(SPACY_WORDCLOUD_SEED_ITEM_COUNT);
    expect(responses.every((text) => text.length > 0)).toBe(true);
    expect(Math.max(...responses.map((text) => text.length))).toBeLessThanOrEqual(
      SPACY_WORDCLOUD_SEED_ITEM_CHARS,
    );
    expect(joined).toContain('Beispiel');
    expect(joined).toContain('Beispiele');
    expect(joined).toContain('Beispielen');
    expect(joined).toContain('Übung');
    expect(joined).toContain('Übungen');
    expect(joined).toContain('konkrete Beispiele');
    expect(joined).toContain('kurze Pausen');
    expect(joined).toContain('ChatGPT');
    expect(joined).toContain('HTTP 404');
    expect(joined).toContain('Struktur');
    expect(joined).toContain('Aufbau');
    expect(responses.some((text) => text.length >= 400)).toBe(true);
    expect(new Set(responses).size).toBeGreaterThan(40);
  });

  it('füllt Q&A bis zum Analyse-Cap mit Kurzfragen, Flexion und Sortier-tauglichen Texten', () => {
    const questions = buildSpacyQaQuestionTexts();
    const joined = questions.join('\n');

    expect(questions).toHaveLength(SPACY_WORDCLOUD_SEED_ITEM_COUNT);
    expect(questions.every((text) => text.length > 0)).toBe(true);
    expect(Math.max(...questions.map((text) => text.length))).toBeLessThanOrEqual(
      SPACY_WORDCLOUD_SEED_ITEM_CHARS,
    );
    expect(joined).toContain('Frage');
    expect(joined).toContain('Fragen');
    expect(joined).toContain('Beispiel');
    expect(joined).toContain('Beispiele');
    expect(joined).toContain('Übung');
    expect(joined).toContain('Visualisierung');
    expect(questions.some((text) => text.length < 80)).toBe(true);
    expect(questions.some((text) => text.length >= 280)).toBe(true);
  });
});
