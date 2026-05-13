import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STOPWORDS,
  aggregateWords,
  createWordCloudStopwordContext,
  extractResponseGroupKeys,
  getWordCloudWeightFromNormalizedMetric,
  getWordCloudWeightFromUpvotes,
  getStopwordsForLocale,
  normalizeFreeTextResponseForDisplay,
  responseContainsWord,
} from './word-cloud.util';

describe('aggregateWords', () => {
  it('aggregiert Freitext-Antworten und filtert Stopwords', () => {
    const result = aggregateWords([
      'Teamarbeit und Motivation',
      'Motivation durch Teamarbeit',
      'Klare Struktur und Motivation',
    ]);

    expect(result[0]).toMatchObject({
      word: 'motivation',
      count: 3,
      groupKey: 'motivation',
      variants: ['motivation'],
    });
    expect(result.some((entry) => entry.word === 'und')).toBe(false);
    expect(result.some((entry) => entry.word === 'teamarbeit')).toBe(true);
  });

  it('filtert haeufige deutsche Fragewoerter aus der Q&A-Wortwolke', () => {
    const result = aggregateWords(
      [
        'Wie funktioniert das Beispiel genau?',
        'Welche Formel brauchen wir hier?',
        'Was bedeutet das fuer die Klausur?',
        'Kannst du die Formel bitte noch einmal herleiten?',
      ],
      DEFAULT_STOPWORDS,
      'de',
      'qa',
    );

    expect(result.some((entry) => entry.word === 'wie')).toBe(false);
    expect(result.some((entry) => entry.word === 'welche')).toBe(false);
    expect(result.some((entry) => entry.word === 'was')).toBe(false);
    expect(result.some((entry) => entry.word === 'genau')).toBe(false);
    expect(result.some((entry) => entry.word === 'bitte')).toBe(false);
    expect(result.some((entry) => entry.word === 'formel')).toBe(true);
  });

  it('bildet in der Q&A-Wortwolke leichte Themenphrasen statt nur Einzelwoerter', () => {
    const result = aggregateWords(
      [
        'Kommt Kapitel 4 in der Klausur vor?',
        'Wie funktioniert lineare Regression im Praxisprojekt?',
        'Wann nutzen wir lineare Regression fuer Prognosen?',
      ],
      DEFAULT_STOPWORDS,
      'de',
      'qa',
    );

    expect(result.find((entry) => entry.groupKey === 'kapitel 4')).toMatchObject({
      word: 'kapitel 4',
      groupKey: 'kapitel 4',
    });
    expect(result.find((entry) => entry.groupKey === 'lineare regression')).toMatchObject({
      word: 'lineare regression',
      count: 2,
      groupKey: 'lineare regression',
    });
  });

  it('laesst fachliche Kurzbegriffe mit zwei Zeichen zu, filtert aber Einzelzeichen', () => {
    const result = aggregateWords(['pi KI a b', 'KI hilft bei pi']);

    expect(result.find((entry) => entry.word === 'pi')?.count).toBe(2);
    expect(result.find((entry) => entry.word === 'ki')?.count).toBe(2);
    expect(result.some((entry) => entry.word === 'a')).toBe(false);
    expect(result.some((entry) => entry.word === 'b')).toBe(false);
  });

  it('behaelt numerische Antworten als ganze Tokens und normalisiert Dezimaltrennzeichen', () => {
    const result = aggregateWords(['3.14', '3,14', '7', 'a']);

    expect(result.find((entry) => entry.word === '3.14')).toMatchObject({
      word: '3.14',
      count: 2,
      groupKey: '3.14',
      variants: ['3.14'],
    });
    expect(result.find((entry) => entry.word === '7')).toMatchObject({
      word: '7',
      count: 1,
      groupKey: '7',
      variants: ['7'],
    });
    expect(result.some((entry) => entry.word === '14')).toBe(false);
    expect(result.some((entry) => entry.word === 'a')).toBe(false);
  });

  it('zaehlt Wortgruppen pro Antwort nur einmal, auch bei Wiederholung im selben Text', () => {
    const result = aggregateWords([
      'Motivation Motivation Motivation durch Teamarbeit',
      'Teamarbeit schafft Motivation',
    ]);

    expect(result.find((entry) => entry.word === 'motivation')).toMatchObject({
      word: 'motivation',
      count: 2,
      groupKey: 'motivation',
    });
    expect(result.find((entry) => entry.word === 'teamarbeit')).toMatchObject({
      word: 'teamarbeit',
      count: 2,
      groupKey: 'teamarbeit',
    });
  });

  it('normalisiert reine numerische Antworten verlustfrei fuer die Anzeige', () => {
    expect(normalizeFreeTextResponseForDisplay(' 3, 14529 ')).toBe('3.14529');
    expect(normalizeFreeTextResponseForDisplay('3.14529')).toBe('3.14529');
    expect(normalizeFreeTextResponseForDisplay('Pi ist 3,14')).toBe('Pi ist 3,14');
  });

  it('filtert Antworten ueber normalisierte Tokens statt ueber rohe Teilstrings', () => {
    expect(responseContainsWord('3, 14', '3.14')).toBe(true);
    expect(responseContainsWord('13.14', '3.14')).toBe(false);
    expect(responseContainsWord('spiel', 'pi')).toBe(false);
  });

  it('filtert Q&A-Antworten auch ueber Themenphrasen', () => {
    expect(
      responseContainsWord('Kommt Kapitel 4 in der Klausur vor?', 'kapitel 4', 'de', 'qa'),
    ).toBe(true);
    expect(
      responseContainsWord(
        'Wie funktioniert lineare Regression im Praxisprojekt?',
        'lineare regression',
        'de',
        'qa',
      ),
    ).toBe(true);
    expect(
      responseContainsWord(
        'Wie funktioniert lineare Regression im Praxisprojekt?',
        'kapitel 4',
        'de',
        'qa',
      ),
    ).toBe(false);
  });

  it('bündelt deutsche Wortfamilien auf Gruppenbasis und waehlt eine lesbare Anzeigeform', () => {
    const result = aggregateWords(
      [
        'Validierung und validiert',
        'Wir validieren die Lösung',
        'Visualisierung hilft beim visualisieren',
        'Das Layout hängt und haengt manchmal',
      ],
      DEFAULT_STOPWORDS,
      'de',
    );

    expect(result.find((entry) => entry.groupKey === 'validieren')).toMatchObject({
      word: 'validieren',
      count: 2,
      groupKey: 'validieren',
    });
    expect(result.find((entry) => entry.groupKey === 'validieren')?.variants).toEqual(
      expect.arrayContaining(['validierung', 'validiert', 'validieren']),
    );
    expect(result.find((entry) => entry.groupKey === 'visualisieren')).toMatchObject({
      word: 'visualisieren',
      count: 1,
      groupKey: 'visualisieren',
    });
    expect(result.find((entry) => entry.groupKey === 'visualisieren')?.variants).toEqual(
      expect.arrayContaining(['visualisierung', 'visualisieren']),
    );
    expect(result.find((entry) => entry.groupKey === 'haengen')).toMatchObject({
      word: 'hängen',
      count: 1,
      groupKey: 'haengen',
    });
    expect(result.find((entry) => entry.groupKey === 'haengen')?.variants).toEqual(
      expect.arrayContaining(['hängt', 'haengt']),
    );
  });

  it('filtert Antworten ueber groupKeys statt nur ueber exakte Tokenformen', () => {
    expect(responseContainsWord('Die Validierung fehlt noch', 'validieren', 'de')).toBe(true);
    expect(responseContainsWord('Die Visualisierung hilft', 'visualisieren', 'de')).toBe(true);
    expect(responseContainsWord('Das Layout haengt fest', 'hängen', 'de')).toBe(true);
    expect(responseContainsWord('Das Layout haengt fest', 'visualisieren', 'de')).toBe(false);
  });

  it('nutzt sprachspezifische Stoplisten fuer die unterstuetzten Locales', () => {
    const english = aggregateWords(
      ['What does the formula mean?', 'How does the formula work?'],
      getStopwordsForLocale('en'),
      'en',
    );
    const french = aggregateWords(
      ['Quelle est l’idée centrale ?', 'Comment fonctionne la formule ?'],
      getStopwordsForLocale('fr'),
      'fr',
    );
    const italian = aggregateWords(
      ['Quale formula dobbiamo usare?', 'Come funziona l’analisi?'],
      getStopwordsForLocale('it'),
      'it',
    );
    const spanish = aggregateWords(
      ['¿Qué fórmula necesitamos?', '¿Cómo funciona la dinámica?'],
      getStopwordsForLocale('es'),
      'es',
    );

    expect(english.some((entry) => entry.word === 'what')).toBe(false);
    expect(english.some((entry) => entry.word === 'formula')).toBe(true);

    expect(french.some((entry) => entry.word === 'quelle')).toBe(false);
    expect(french.some((entry) => entry.word === 'idée')).toBe(true);
    expect(french.some((entry) => entry.word === 'formule')).toBe(true);

    expect(italian.some((entry) => entry.word === 'quale')).toBe(false);
    expect(italian.some((entry) => entry.word === 'analisi')).toBe(true);

    expect(spanish.some((entry) => entry.word === 'qué')).toBe(false);
    expect(spanish.some((entry) => entry.word === 'fórmula')).toBe(true);
  });

  it('behaelt kuratierte deutsche Inhaltswoerter trotz aggressiver Upstream-Stopliste', () => {
    const result = aggregateWords([
      'Heute machen wir ein Beispiel, das wirklich besser erklaert wird.',
      'Morgen wird das Beispiel noch besser.',
    ]);

    expect(result.find((entry) => entry.word === 'heute')).toMatchObject({
      word: 'heute',
      count: 1,
    });
    expect(result.find((entry) => entry.word === 'morgen')).toMatchObject({
      word: 'morgen',
      count: 1,
    });
    expect(result.find((entry) => entry.word === 'machen')).toMatchObject({
      word: 'machen',
      count: 1,
    });
    expect(result.find((entry) => entry.word === 'beispiel')).toMatchObject({
      word: 'beispiel',
      count: 2,
    });
    expect(result.find((entry) => entry.word === 'wirklich')).toMatchObject({
      word: 'wirklich',
      count: 1,
    });
    expect(result.find((entry) => entry.word === 'besser')).toMatchObject({
      word: 'besser',
      count: 2,
    });
  });

  it('behaelt kuratierte englische Inhaltswoerter trotz aggressiver Upstream-Stopliste', () => {
    const result = aggregateWords(
      ['We make the example clearer now.', 'Now we make progress together.'],
      getStopwordsForLocale('en'),
      'en',
    );

    expect(result.find((entry) => entry.word === 'make')).toMatchObject({
      word: 'make',
      count: 2,
    });
    expect(result.find((entry) => entry.word === 'now')).toMatchObject({
      word: 'now',
      count: 2,
    });
    expect(result.find((entry) => entry.word === 'example')).toMatchObject({
      word: 'example',
      count: 1,
    });
  });

  it('behaelt kuratierte franzoesische Inhaltswoerter trotz aggressiver Upstream-Stopliste', () => {
    const result = aggregateWords(
      ['Nous allons faire un exemple concret.', 'Faire cela aide pour la formule.'],
      getStopwordsForLocale('fr'),
      'fr',
    );

    expect(result.find((entry) => entry.word === 'faire')).toMatchObject({
      word: 'faire',
      count: 2,
    });
    expect(result.find((entry) => entry.word === 'exemple')).toMatchObject({
      word: 'exemple',
      count: 1,
    });
    expect(result.find((entry) => entry.word === 'formule')).toMatchObject({
      word: 'formule',
      count: 1,
    });
  });

  it('filtert zusaetzliche deutsche Q&A-Fuellwoerter haerter als die Standardwolke', () => {
    const result = aggregateWords(
      [
        'Koennen wir eigentlich kurz noch mal ein paar Schritte zur Formel machen?',
        'Vielleicht noch einen Moment zur Formel, wie wir das gemacht haben?',
      ],
      DEFAULT_STOPWORDS,
      'de',
      'qa',
    );

    expect(result.some((entry) => entry.word === 'eigentlich')).toBe(false);
    expect(result.some((entry) => entry.word === 'kurz')).toBe(false);
    expect(result.some((entry) => entry.word === 'paar')).toBe(false);
    expect(result.some((entry) => entry.word === 'vielleicht')).toBe(false);
    expect(result.some((entry) => entry.word === 'moment')).toBe(false);
    expect(result.some((entry) => entry.word === 'machen')).toBe(false);
    expect(result.some((entry) => entry.word === 'gemacht')).toBe(false);
    expect(result.find((entry) => entry.word === 'formel')).toMatchObject({
      word: 'formel',
      count: 2,
    });
  });

  it('filtert zusaetzliche englische Q&A-Fuellwoerter haerter als die Standardwolke', () => {
    const result = aggregateWords(
      [
        'Could we actually just make the formula simpler again, please?',
        'Maybe we need one more moment to make the formula work.',
      ],
      getStopwordsForLocale('en'),
      'en',
      'qa',
    );

    expect(result.some((entry) => entry.word === 'actually')).toBe(false);
    expect(result.some((entry) => entry.word === 'just')).toBe(false);
    expect(result.some((entry) => entry.word === 'maybe')).toBe(false);
    expect(result.some((entry) => entry.word === 'moment')).toBe(false);
    expect(result.some((entry) => entry.word === 'make')).toBe(false);
    expect(result.some((entry) => entry.word === 'need')).toBe(false);
    expect(result.find((entry) => entry.word === 'formula')).toMatchObject({
      word: 'formula',
      count: 2,
    });
  });

  it('filtert zusaetzliche franzoesische Q&A-Fuellwoerter haerter als die Standardwolke', () => {
    const result = aggregateWords(
      [
        'Comment pouvez-vous faire cela plus simplement ?',
        'Pourquoi avons-nous besoin d’un moment pour faire la formule maintenant ?',
      ],
      getStopwordsForLocale('fr'),
      'fr',
      'qa',
    );

    expect(result.some((entry) => entry.word === 'comment')).toBe(false);
    expect(result.some((entry) => entry.word === 'pourquoi')).toBe(false);
    expect(result.some((entry) => entry.word === 'pouvez')).toBe(false);
    expect(result.some((entry) => entry.word === 'besoin')).toBe(false);
    expect(result.some((entry) => entry.word === 'moment')).toBe(false);
    expect(result.some((entry) => entry.word === 'simplement')).toBe(false);
    expect(result.some((entry) => entry.word === 'maintenant')).toBe(false);
    expect(result.some((entry) => entry.word === 'faire')).toBe(false);
    expect(result.find((entry) => entry.word === 'formule')).toMatchObject({
      word: 'formule',
      count: 1,
    });
  });

  it('filtert zusaetzliche italienische Q&A-Fuellwoerter haerter als die Standardwolke', () => {
    const result = aggregateWords(
      [
        'Quando possiamo fare un momento sulla formula?',
        'Perche abbiamo bisogno di spiegare la formula semplicemente adesso?',
      ],
      getStopwordsForLocale('it'),
      'it',
      'qa',
    );

    expect(result.some((entry) => entry.word === 'quando')).toBe(false);
    expect(result.some((entry) => entry.word === 'fare')).toBe(false);
    expect(result.some((entry) => entry.word === 'momento')).toBe(false);
    expect(result.some((entry) => entry.word === 'perche')).toBe(false);
    expect(result.some((entry) => entry.word === 'bisogno')).toBe(false);
    expect(result.some((entry) => entry.word === 'semplicemente')).toBe(false);
    expect(result.some((entry) => entry.word === 'adesso')).toBe(false);
    expect(result.find((entry) => entry.word === 'formula')).toMatchObject({
      word: 'formula',
      count: 2,
    });
  });

  it('filtert zusaetzliche spanische Q&A-Fuellwoerter haerter als die Standardwolke', () => {
    const result = aggregateWords(
      [
        'Podemos hacer esto ahora, justo para la formula?',
        'Necesitamos un momento simplemente para que la formula funcione.',
      ],
      getStopwordsForLocale('es'),
      'es',
      'qa',
    );

    expect(result.some((entry) => entry.word === 'hacer')).toBe(false);
    expect(result.some((entry) => entry.word === 'ahora')).toBe(false);
    expect(result.some((entry) => entry.word === 'justo')).toBe(false);
    expect(result.some((entry) => entry.word === 'momento')).toBe(false);
    expect(result.some((entry) => entry.word === 'simplemente')).toBe(false);
    expect(result.find((entry) => entry.word === 'formula')).toMatchObject({
      word: 'formula',
      count: 2,
    });
  });

  it('filtert auch dann deutsche Stopwoerter, wenn die UI-Locale englisch ist', () => {
    const result = aggregateWords(
      ['Wie koennen wir das mit dem Beispiel und der Seite besser machen?'],
      getStopwordsForLocale('en'),
      'en',
    );

    expect(result.some((entry) => entry.word === 'wie')).toBe(false);
    expect(result.some((entry) => entry.word === 'koennen')).toBe(false);
    expect(result.some((entry) => entry.word === 'das')).toBe(false);
    expect(result.some((entry) => entry.word === 'mit')).toBe(false);
    expect(result.some((entry) => entry.word === 'dem')).toBe(false);
    expect(result.some((entry) => entry.word === 'und')).toBe(false);
    expect(result.some((entry) => entry.word === 'der')).toBe(false);
    expect(result.some((entry) => entry.word === 'seite')).toBe(true);
  });

  it('filtert Antwort-GroupKeys mit mehrsprachigem Stopwort-Fallback, ohne englisches "die" blind zu verlieren', () => {
    const germanContext = createWordCloudStopwordContext(getStopwordsForLocale('en'), 'en');
    expect(
      responseContainsWord(
        'Wie koennen wir das mit dem Beispiel und der Seite besser machen?',
        'beispiel',
        'en',
      ),
    ).toBe(true);
    expect(
      new Set(
        aggregateWords(
          ['To die or not to die in this example'],
          getStopwordsForLocale('en'),
          'en',
        ).map((entry) => entry.word),
      ).has('die'),
    ).toBe(true);
    expect(
      extractResponseGroupKeys(
        'Wie koennen wir das mit dem Beispiel und der Seite besser machen?',
        germanContext,
      ),
    ).not.toContain('und');
  });

  it('flacht Upvotes fuer die Q&A-Wortwolke per Wurzelgewicht ab', () => {
    expect(getWordCloudWeightFromUpvotes(-5)).toBe(1);
    expect(getWordCloudWeightFromUpvotes(0)).toBe(1);
    expect(getWordCloudWeightFromUpvotes(1)).toBe(2);
    expect(getWordCloudWeightFromUpvotes(4)).toBe(3);
    expect(getWordCloudWeightFromUpvotes(9)).toBe(4);
    expect(getWordCloudWeightFromUpvotes(25)).toBe(6);
  });

  it('gewichtet normalisierte Q&A-Metriken staerker bei hohen Scores', () => {
    expect(getWordCloudWeightFromNormalizedMetric(undefined)).toBe(1);
    expect(getWordCloudWeightFromNormalizedMetric(-0.2)).toBe(1);
    expect(getWordCloudWeightFromNormalizedMetric(0)).toBe(1);
    expect(getWordCloudWeightFromNormalizedMetric(0.25)).toBe(4);
    expect(getWordCloudWeightFromNormalizedMetric(0.5)).toBe(11);
    expect(getWordCloudWeightFromNormalizedMetric(0.75)).toBe(24);
    expect(getWordCloudWeightFromNormalizedMetric(1.2)).toBe(41);
  });
});
