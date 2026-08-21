import { describe, expect, it } from 'vitest';
import {
  isDisplayableThemeWordCloudEntry,
  isPhraseLikeWordCloudEntry,
  mergeThemePhrasesWithLemmaUnigrams,
} from './qa-word-cloud-theme-merge';

describe('qa-word-cloud-theme-merge', () => {
  it('behaelt kurze Wortgruppen und laesst ganze Fragen weg', () => {
    expect(isPhraseLikeWordCloudEntry({ key: 'kapitel 4', label: 'Kapitel 4' })).toBe(true);
    expect(
      isPhraseLikeWordCloudEntry({
        key: 'lineare regression',
        label: 'lineare Regression',
      }),
    ).toBe(true);
    expect(isPhraseLikeWordCloudEntry({ key: 'klausur', label: 'Klausur' })).toBe(false);
    expect(
      isPhraseLikeWordCloudEntry({
        key: 'sollen wir zotero oder citavi verwenden?',
        label: 'Sollen wir Zotero oder Citavi verwenden?',
      }),
    ).toBe(false);
  });

  it('zeigt THEME-Unigramme, aber keine Vollfragen', () => {
    expect(isDisplayableThemeWordCloudEntry({ key: 'wahlrecht', label: 'Wahlrecht' })).toBe(true);
    expect(isDisplayableThemeWordCloudEntry({ key: 'kapitel 4', label: 'Kapitel 4' })).toBe(true);
    expect(
      isDisplayableThemeWordCloudEntry({
        key: 'sollen wir zotero oder citavi verwenden?',
        label: 'Sollen wir Zotero oder Citavi verwenden?',
      }),
    ).toBe(false);
  });

  it('mischt Lemma-Unigramme mit kurzen THEME-Phrasen, nicht mit Vollsaetzen', () => {
    const merged = mergeThemePhrasesWithLemmaUnigrams(
      [
        {
          key: 'kapitel 4',
          label: 'Kapitel 4',
          count: 13,
          basisLabel: 'Kapitel 4',
          members: [],
          variants: ['Kapitel 4'],
          confidence: 0.8,
        },
        {
          key: 'sollen wir zotero oder citavi verwenden?',
          label: 'Sollen wir Zotero oder Citavi verwenden?',
          count: 4,
          basisLabel: null,
          members: [],
          variants: ['Sollen wir Zotero oder Citavi verwenden?'],
          confidence: null,
        },
      ],
      [
        {
          key: 'klausur',
          label: 'Klausur',
          count: 8,
          basisLabel: 'Klausur',
          members: [],
          variants: ['Klausur'],
          confidence: null,
        },
      ],
      80,
    );

    expect(merged.map((entry) => entry.label)).toEqual(['Kapitel 4', 'Klausur']);
  });
});
