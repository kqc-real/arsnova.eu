import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STOPWORDS,
  aggregateWords,
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

  it('flacht Upvotes fuer die Q&A-Wortwolke per Wurzelgewicht ab', () => {
    expect(getWordCloudWeightFromUpvotes(-5)).toBe(1);
    expect(getWordCloudWeightFromUpvotes(0)).toBe(1);
    expect(getWordCloudWeightFromUpvotes(1)).toBe(2);
    expect(getWordCloudWeightFromUpvotes(4)).toBe(3);
    expect(getWordCloudWeightFromUpvotes(9)).toBe(4);
    expect(getWordCloudWeightFromUpvotes(25)).toBe(6);
  });
});
