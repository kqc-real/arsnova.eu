import type { AnalyzeWordCloudInput, WordCloudLemmaLocale } from '@arsnova/shared-types';
import type { SpacyNormalizeResponse } from './spacyClient';

export interface WordCloudLemmaFixture {
  readonly id: string;
  readonly locale: WordCloudLemmaLocale;
  readonly items: AnalyzeWordCloudInput['items'];
  readonly sidecarItems: SpacyNormalizeResponse['items'];
  readonly expectedKeys: readonly string[];
  readonly unexpectedKeys?: readonly string[];
  readonly expectedLabels?: Readonly<Record<string, string>>;
}

/**
 * Kuratierte de/en/fr/es-Fälle für Story 1.14b (lexikalische Qualitätsstufe).
 * Die Sidecar-Tokens sind die erwartete spaCy-Antwort; die Tests mocken sie.
 */
export const WORD_CLOUD_LEMMA_FIXTURES: readonly WordCloudLemmaFixture[] = [
  {
    id: 'de-noun-flexion',
    locale: 'de',
    items: [
      { id: 'item-1', text: 'Häuser', weight: 2 },
      { id: 'item-2', text: 'Haus', weight: 1 },
    ],
    sidecarItems: [
      { id: 'item-1', tokens: [{ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' }] },
      { id: 'item-2', tokens: [{ text: 'Haus', lemma: 'Haus', pos: 'NOUN' }] },
    ],
    expectedKeys: ['haus'],
    unexpectedKeys: ['haeuser', 'häuser'],
    expectedLabels: { haus: 'Haus' },
  },
  {
    id: 'de-proper-name',
    locale: 'de',
    items: [{ id: 'item-1', text: 'Berlin', weight: 1 }],
    sidecarItems: [
      { id: 'item-1', tokens: [{ text: 'Berlin', lemma: 'berlin', pos: 'PROPN', entType: 'GPE' }] },
    ],
    expectedKeys: ['berlin'],
    expectedLabels: { berlin: 'Berlin' },
  },
  {
    id: 'de-verb-noun-family',
    locale: 'de',
    items: [
      { id: 'item-1', text: 'validieren', weight: 1 },
      { id: 'item-2', text: 'validiert', weight: 1 },
      { id: 'item-3', text: 'Validierung', weight: 1 },
    ],
    sidecarItems: [
      { id: 'item-1', tokens: [{ text: 'validieren', lemma: 'validieren', pos: 'VERB' }] },
      { id: 'item-2', tokens: [{ text: 'validiert', lemma: 'validieren', pos: 'VERB' }] },
      { id: 'item-3', tokens: [{ text: 'Validierung', lemma: 'Validierung', pos: 'NOUN' }] },
    ],
    expectedKeys: ['validierung'],
    unexpectedKeys: ['validieren', 'validiert'],
    expectedLabels: { validierung: 'Validierung' },
  },
  {
    id: 'de-verb-adj-flexion',
    locale: 'de',
    items: [
      { id: 'item-1', text: 'macht kurze Beispiele', weight: 1 },
      { id: 'item-2', text: 'brauche Beispiele', weight: 1 },
      { id: 'item-3', text: 'verliere den Faden', weight: 1 },
    ],
    sidecarItems: [
      {
        id: 'item-1',
        tokens: [
          { text: 'macht', lemma: 'machen', pos: 'VERB' },
          { text: 'kurze', lemma: 'kurz', pos: 'ADJ' },
          { text: 'Beispiele', lemma: 'Beispiel', pos: 'NOUN' },
        ],
      },
      {
        id: 'item-2',
        tokens: [
          { text: 'brauche', lemma: 'brauchen', pos: 'VERB' },
          { text: 'Beispiele', lemma: 'Beispiel', pos: 'NOUN' },
        ],
      },
      {
        id: 'item-3',
        tokens: [
          { text: 'verliere', lemma: 'verlieren', pos: 'VERB' },
          { text: 'den', lemma: 'der', pos: 'DET' },
          { text: 'Faden', lemma: 'Faden', pos: 'NOUN' },
        ],
      },
    ],
    expectedKeys: ['beispiel', 'faden'],
    unexpectedKeys: [
      'macht',
      'machen',
      'brauche',
      'brauchen',
      'kurze',
      'kurz',
      'verliere',
      'verlieren',
    ],
    expectedLabels: { beispiel: 'Beispiel', faden: 'Faden' },
  },
  {
    id: 'de-light-verb-flexion',
    locale: 'de',
    items: [
      { id: 'item-1', text: 'Das hilft beim Lernen', weight: 1 },
      { id: 'item-2', text: 'Es bleibt spannend', weight: 1 },
      { id: 'item-3', text: 'kurze Pausen helfen', weight: 1 },
      { id: 'item-4', text: 'verliere den Faden', weight: 1 },
    ],
    sidecarItems: [
      {
        id: 'item-1',
        tokens: [
          { text: 'Das', lemma: 'der', pos: 'DET' },
          { text: 'hilft', lemma: 'helfen', pos: 'VERB' },
          { text: 'beim', lemma: 'beim', pos: 'ADP' },
          { text: 'Lernen', lemma: 'lernen', pos: 'VERB' },
        ],
      },
      {
        id: 'item-2',
        tokens: [
          { text: 'Es', lemma: 'es', pos: 'PRON' },
          { text: 'bleibt', lemma: 'bleiben', pos: 'VERB' },
          { text: 'spannend', lemma: 'spannend', pos: 'ADJ' },
        ],
      },
      {
        id: 'item-3',
        tokens: [
          { text: 'kurze', lemma: 'kurz', pos: 'ADJ' },
          { text: 'Pausen', lemma: 'Pause', pos: 'NOUN' },
          { text: 'helfen', lemma: 'helfen', pos: 'VERB' },
        ],
      },
      {
        id: 'item-4',
        tokens: [
          { text: 'verliere', lemma: 'verlieren', pos: 'VERB' },
          { text: 'den', lemma: 'der', pos: 'DET' },
          { text: 'Faden', lemma: 'Faden', pos: 'NOUN' },
        ],
      },
    ],
    expectedKeys: ['lernen', 'pause', 'faden'],
    unexpectedKeys: [
      'hilft',
      'helfen',
      'bleibt',
      'bleiben',
      'kurze',
      'kurz',
      'spannend',
      'verliere',
      'verlieren',
    ],
    expectedLabels: { pause: 'Pause', faden: 'Faden', lernen: 'Lernen' },
  },
  {
    id: 'de-compound-and-typo',
    locale: 'de',
    items: [
      { id: 'item-1', text: 'Wahlrecht', weight: 2 },
      { id: 'item-2', text: 'Wahrecht', weight: 1 },
    ],
    sidecarItems: [
      { id: 'item-1', tokens: [{ text: 'Wahlrecht', lemma: 'Wahlrecht', pos: 'NOUN' }] },
      { id: 'item-2', tokens: [{ text: 'Wahrecht', lemma: 'Wahrecht', pos: 'NOUN' }] },
    ],
    expectedKeys: ['wahlrecht', 'wahrecht'],
  },
  {
    id: 'de-no-semantic-merge',
    locale: 'de',
    items: [
      { id: 'item-1', text: 'Struktur', weight: 1 },
      { id: 'item-2', text: 'Aufbau', weight: 1 },
    ],
    sidecarItems: [
      { id: 'item-1', tokens: [{ text: 'Struktur', lemma: 'Struktur', pos: 'NOUN' }] },
      { id: 'item-2', tokens: [{ text: 'Aufbau', lemma: 'Aufbau', pos: 'NOUN' }] },
    ],
    expectedKeys: ['struktur', 'aufbau'],
  },
  {
    id: 'de-technical-terms',
    locale: 'de',
    items: [
      { id: 'item-1', text: 'C++', weight: 1 },
      { id: 'item-2', text: 'HTTP 404', weight: 1 },
    ],
    sidecarItems: [
      { id: 'item-1', tokens: [{ text: 'C++', lemma: 'C++', pos: 'PROPN' }] },
      {
        id: 'item-2',
        tokens: [
          { text: 'HTTP', lemma: 'HTTP', pos: 'PROPN' },
          { text: '404', lemma: '404', pos: 'NUM' },
        ],
      },
    ],
    expectedKeys: ['c++', 'http'],
  },
  {
    id: 'en-noun-plural',
    locale: 'en',
    items: [
      { id: 'item-1', text: 'cats', weight: 2 },
      { id: 'item-2', text: 'cat', weight: 1 },
    ],
    sidecarItems: [
      { id: 'item-1', tokens: [{ text: 'cats', lemma: 'cat', pos: 'NOUN' }] },
      { id: 'item-2', tokens: [{ text: 'cat', lemma: 'cat', pos: 'NOUN' }] },
    ],
    expectedKeys: ['cat'],
    unexpectedKeys: ['cats'],
    expectedLabels: { cat: 'cat' },
  },
  {
    id: 'de-code-switch',
    locale: 'de',
    items: [{ id: 'item-1', text: 'Das Feature', weight: 1 }],
    sidecarItems: [
      {
        id: 'item-1',
        tokens: [
          { text: 'Das', lemma: 'der', pos: 'DET' },
          { text: 'Feature', lemma: 'Feature', pos: 'NOUN' },
        ],
      },
    ],
    expectedKeys: ['feature'],
    unexpectedKeys: ['das'],
    expectedLabels: { feature: 'Feature' },
  },
  {
    id: 'fr-noun-plural',
    locale: 'fr',
    items: [
      { id: 'item-1', text: 'maisons', weight: 2 },
      { id: 'item-2', text: 'maison', weight: 1 },
    ],
    sidecarItems: [
      { id: 'item-1', tokens: [{ text: 'maisons', lemma: 'maison', pos: 'NOUN' }] },
      { id: 'item-2', tokens: [{ text: 'maison', lemma: 'maison', pos: 'NOUN' }] },
    ],
    expectedKeys: ['maison'],
    unexpectedKeys: ['maisons'],
    expectedLabels: { maison: 'maison' },
  },
  {
    id: 'es-noun-plural',
    locale: 'es',
    items: [
      { id: 'item-1', text: 'casas', weight: 2 },
      { id: 'item-2', text: 'casa', weight: 1 },
    ],
    sidecarItems: [
      { id: 'item-1', tokens: [{ text: 'casas', lemma: 'casa', pos: 'NOUN' }] },
      { id: 'item-2', tokens: [{ text: 'casa', lemma: 'casa', pos: 'NOUN' }] },
    ],
    expectedKeys: ['casa'],
    unexpectedKeys: ['casas'],
    expectedLabels: { casa: 'casa' },
  },
];
