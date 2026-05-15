import { describe, expect, it } from 'vitest';
import { WordCloudTermExtractorService } from './word-cloud-term.service';

describe('WordCloudTermExtractorService', () => {
  const service = new WordCloudTermExtractorService();

  it('gewichtet Document-Frequency pro Frage statt roher Worthaeufigkeit', () => {
    const terms = service.extractTerms(
      [
        {
          id: 'q1',
          title: 'Moderation Moderation Moderation Freigabe',
          body: 'Moderation bleibt wichtig',
          weight: 1,
        },
        {
          id: 'q2',
          title: 'Moderation und Freigabe',
          weight: 1,
        },
      ],
      { locale: 'de', maxEntries: 10, maxNgramLength: 1 },
    );

    const moderation = terms.find((term) => term.key === 'moderation');
    const freigabe = terms.find((term) => term.key === 'freigabe');

    expect(moderation?.documentFrequency).toBe(2);
    expect(freigabe?.documentFrequency).toBe(2);
    expect(moderation?.score).toBeLessThan(5);
  });

  it('gewichtet Titel und Tags staerker als Body', () => {
    const terms = service.extractTerms(
      [
        { id: 'q1', title: 'Datenschutz', body: 'Export Export', tags: ['Anonymisierung'] },
        { id: 'q2', title: 'Datenschutz', body: 'Export', tags: ['Anonymisierung'] },
      ],
      { locale: 'de', maxEntries: 10, maxNgramLength: 1 },
    );

    const byKey = new Map(terms.map((term) => [term.key, term]));

    expect(byKey.get('datenschutz')?.score).toBeGreaterThan(byKey.get('export')?.score ?? 0);
    expect(byKey.get('anonymisierung')?.score).toBeGreaterThan(byKey.get('export')?.score ?? 0);
  });

  it('schuetzt technische Begriffe vor der Tokenisierung', () => {
    const terms = service.extractTerms(
      [
        {
          id: 'q1',
          title: 'C++ und C# im Build',
          body: 'npm install meldet HTTP 404',
        },
        {
          id: 'q2',
          title: 'docker compose startet C++ Beispiel',
          body: 'HTTP 404 nach npm install',
        },
      ],
      { locale: 'de', maxEntries: 20 },
    );

    const keys = terms.map((term) => term.key);

    expect(keys).toContain('c++');
    expect(keys).toContain('c#');
    expect(keys).toContain('npm install');
    expect(keys).toContain('docker compose');
    expect(keys).toContain('http 404');
    expect(terms.find((term) => term.key === 'http 404')?.label).toBe('HTTP 404');
  });

  it('extrahiert Bigramme und Trigramme und gewichtet Phrasen staerker als Einzelwoerter', () => {
    const terms = service.extractTerms(
      [
        { id: 'q1', title: 'lineare Regression im Praxisprojekt' },
        { id: 'q2', title: 'lineare Regression fuer Prognosen' },
        { id: 'q3', title: 'lineare Regression im Praxisprojekt vertiefen' },
      ],
      { locale: 'de', maxEntries: 10, maxNgramLength: 3 },
    );

    const lineareRegression = terms.find((term) => term.key === 'lineare regression');
    const regression = terms.find((term) => term.key === 'regression');

    expect(lineareRegression?.kind).toBe('bigram');
    expect(lineareRegression?.score ?? 0).toBeGreaterThan(regression?.score ?? 0);
  });

  it('nutzt adaptive Mindesthaeufigkeit und wertet ubiquitaere Terme ab', () => {
    const documents = Array.from({ length: 50 }, (_, index) => ({
      id: `q${index + 1}`,
      title: `Gemeinsam Thema ${index < 3 ? 'Datenschutz' : `Einzelwort${index}`}`,
    }));

    const terms = service.extractTerms(documents, {
      locale: 'de',
      maxEntries: 20,
      maxNgramLength: 1,
    });

    expect(terms.some((term) => term.key === 'einzelwort20')).toBe(false);
    expect(terms.find((term) => term.key === 'datenschutz')?.documentFrequency).toBe(3);
    expect(terms.find((term) => term.key === 'gemeinsam')?.score ?? 999).toBeLessThan(
      terms.find((term) => term.key === 'datenschutz')?.score ?? 0,
    );
  });

  it('unterstuetzt Forum- und Custom-Stopwoerter in mehreren Sprachen', () => {
    const terms = service.extractTerms(
      [
        { id: 'q1', title: 'question about privacy export' },
        { id: 'q2', title: 'questions about privacy export' },
        { id: 'q3', title: 'privacy export customnoise' },
      ],
      {
        locale: 'en',
        customStopwords: ['customnoise'],
        maxEntries: 10,
        maxNgramLength: 1,
      },
    );

    const keys = terms.map((term) => term.key);

    expect(keys).toContain('privacy');
    expect(keys).toContain('export');
    expect(keys).not.toContain('question');
    expect(keys).not.toContain('questions');
    expect(keys).not.toContain('customnoise');
  });
});
