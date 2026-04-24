import { describe, expect, it } from 'vitest';
import {
  aggregateWords,
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

    expect(result[0]).toEqual({ word: 'motivation', count: 3 });
    expect(result.some((entry) => entry.word === 'und')).toBe(false);
    expect(result.some((entry) => entry.word === 'teamarbeit')).toBe(true);
  });

  it('filtert haeufige deutsche Fragewoerter aus der Q&A-Wortwolke', () => {
    const result = aggregateWords([
      'Wie funktioniert das Beispiel genau?',
      'Welche Formel brauchen wir hier?',
      'Was bedeutet das fuer die Klausur?',
      'Wie laesst sich die Formel herleiten?',
    ]);

    expect(result.some((entry) => entry.word === 'wie')).toBe(false);
    expect(result.some((entry) => entry.word === 'welche')).toBe(false);
    expect(result.some((entry) => entry.word === 'was')).toBe(false);
    expect(result.some((entry) => entry.word === 'formel')).toBe(true);
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

    expect(result.find((entry) => entry.word === '3.14')?.count).toBe(2);
    expect(result.find((entry) => entry.word === '7')?.count).toBe(1);
    expect(result.some((entry) => entry.word === '14')).toBe(false);
    expect(result.some((entry) => entry.word === 'a')).toBe(false);
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

  it('nutzt sprachspezifische Stoplisten fuer die unterstuetzten Locales', () => {
    const english = aggregateWords(
      ['What does the formula mean?', 'How does the formula work?'],
      getStopwordsForLocale('en'),
    );
    const french = aggregateWords(
      ['Quelle est l’idée centrale ?', 'Comment fonctionne la formule ?'],
      getStopwordsForLocale('fr'),
    );
    const italian = aggregateWords(
      ['Quale formula dobbiamo usare?', 'Come funziona l’analisi?'],
      getStopwordsForLocale('it'),
    );
    const spanish = aggregateWords(
      ['¿Qué fórmula necesitamos?', '¿Cómo funciona la dinámica?'],
      getStopwordsForLocale('es'),
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
});
