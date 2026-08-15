import type { AnalyzeWordCloudInput } from '@arsnova/shared-types';
import type { SpacyNormalizeResponse } from './spacyClient';

export interface WordCloudLemmaFixture {
  readonly id: string;
  readonly locale: 'de' | 'en';
  readonly items: AnalyzeWordCloudInput['items'];
  readonly sidecarItems: SpacyNormalizeResponse['items'];
  readonly expectedKeys: readonly string[];
  readonly unexpectedKeys?: readonly string[];
  readonly expectedLabels?: Readonly<Record<string, string>>;
}

/**
 * Kuratierte de/en-Fälle für Story 1.14b (erste Qualitätsstufe).
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
    expectedKeys: ['validieren'],
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
      { id: 'item-1', text: 'verstehen', weight: 1 },
      { id: 'item-2', text: 'nachvollziehen', weight: 1 },
    ],
    sidecarItems: [
      { id: 'item-1', tokens: [{ text: 'verstehen', lemma: 'verstehen', pos: 'VERB' }] },
      { id: 'item-2', tokens: [{ text: 'nachvollziehen', lemma: 'nachvollziehen', pos: 'VERB' }] },
    ],
    expectedKeys: ['verstehen', 'nachvollziehen'],
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
];
