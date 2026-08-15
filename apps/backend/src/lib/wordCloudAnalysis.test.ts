import { describe, expect, it } from 'vitest';
import { buildLexicalWordCloudEntries } from './wordCloudAnalysis';

describe('wordCloudAnalysis token hook', () => {
  it('buendelt lexikalische Eintraege ueber injizierte Lemma-Tokens', () => {
    const items = [
      { id: 'item-1', text: 'Häuser', weight: 2 },
      { id: 'item-2', text: 'Haus', weight: 1 },
    ];

    const identity = buildLexicalWordCloudEntries(items, 'de');
    expect(identity.map((entry) => entry.key).sort()).toEqual(['haeuser', 'haus']);

    const smoothed = buildLexicalWordCloudEntries(
      items,
      'de',
      undefined,
      new Map([
        ['item-1', [{ display: 'Haus', lookup: 'haus' }]],
        ['item-2', [{ display: 'Haus', lookup: 'haus' }]],
      ]),
    );

    expect(smoothed).toMatchObject([
      {
        key: 'haus',
        label: 'Haus',
        count: 3,
        variants: ['Haus'],
      },
    ]);
  });

  it('nimmt Lemma-Bigramme nur auf, wenn maxNgramLength Phrasen erlaubt', () => {
    const items = [
      { id: 'item-1', text: 'lineare Regression hilft', weight: 1 },
      { id: 'item-2', text: 'lineare Regressionen helfen', weight: 1 },
    ];
    const lemmaTokens = new Map([
      [
        'item-1',
        [
          { display: 'lineare', lookup: 'lineare', pos: 'ADJ' },
          { display: 'Regression', lookup: 'regression', pos: 'NOUN' },
          { display: 'helfen', lookup: 'helfen', pos: 'VERB' },
        ],
      ],
      [
        'item-2',
        [
          { display: 'lineare', lookup: 'lineare', pos: 'ADJ' },
          { display: 'Regression', lookup: 'regression', pos: 'NOUN' },
          { display: 'helfen', lookup: 'helfen', pos: 'VERB' },
        ],
      ],
    ]);

    const wordsOnly = buildLexicalWordCloudEntries(items, 'de', undefined, lemmaTokens, 1);
    expect(wordsOnly.map((entry) => entry.key)).toEqual(['regression']);

    const withPhrases = buildLexicalWordCloudEntries(items, 'de', undefined, lemmaTokens, 3);
    const phraseKeys = withPhrases.map((entry) => entry.key);
    expect(phraseKeys).toEqual(['regression', 'lineare regression']);
    expect(phraseKeys).not.toContain('lineare');
    expect(phraseKeys).not.toContain('helfen');
    expect(phraseKeys).not.toContain('regression helfen');
    expect(phraseKeys).not.toContain('lineare regression helfen');
    expect(withPhrases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'lineare regression',
          label: 'lineare Regression',
          count: 2,
        }),
      ]),
    );
  });

  it('laesst seltene Unigramme und Phrasen in großen Snapshots weg', () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      id: `item-${index}`,
      text:
        index < 3
          ? 'gute Beispiele'
          : index < 5
            ? 'seltene Phrase'
            : `Antwort ${index} ohne Phrase`,
      weight: 1,
    }));
    const tokensByItemId = new Map(
      items.map((item, index) => [
        item.id,
        index < 3
          ? [
              { display: 'gute', lookup: 'gute' },
              { display: 'Beispiel', lookup: 'beispiel' },
            ]
          : index < 5
            ? [
                { display: 'seltene', lookup: 'seltene' },
                { display: 'Phrase', lookup: 'phrase' },
              ]
            : [{ display: `Antwort${index}`, lookup: `antwort${index}` }],
      ]),
    );

    const entries = buildLexicalWordCloudEntries(items, 'de', 80, tokensByItemId, 3);
    const keys = entries.map((entry) => entry.key);
    expect(keys).toEqual(['beispiel']);
    expect(keys).not.toContain('gute');
    expect(keys).not.toContain('gute beispiel');
    expect(keys).not.toContain('seltene phrase');
    expect(keys).not.toContain('seltene');
    expect(keys.some((key) => key.startsWith('antwort'))).toBe(false);
  });

  it('filtert gebeugte Funktionswoerter in Einzelwoertern auch nach dem Lemma', () => {
    const items = [
      { id: 'item-1', text: 'Struktur hilft', weight: 1 },
      { id: 'item-2', text: 'Struktur bleibt', weight: 1 },
      { id: 'item-3', text: 'kurze Pausen', weight: 1 },
      { id: 'item-4', text: 'verliere Faden', weight: 1 },
    ];
    const tokensByItemId = new Map([
      [
        'item-1',
        [
          { display: 'Struktur', lookup: 'struktur', pos: 'NOUN' },
          { display: 'helfen', lookup: 'helfen', surfaceLookup: 'hilft', pos: 'VERB' },
        ],
      ],
      [
        'item-2',
        [
          { display: 'Struktur', lookup: 'struktur', pos: 'NOUN' },
          { display: 'bleiben', lookup: 'bleiben', surfaceLookup: 'bleibt', pos: 'VERB' },
        ],
      ],
      [
        'item-3',
        [
          { display: 'kurz', lookup: 'kurz', surfaceLookup: 'kurze', pos: 'ADJ' },
          { display: 'Pause', lookup: 'pause', pos: 'NOUN' },
        ],
      ],
      [
        'item-4',
        [
          { display: 'verlieren', lookup: 'verlieren', surfaceLookup: 'verliere', pos: 'VERB' },
          { display: 'Faden', lookup: 'faden', pos: 'NOUN' },
        ],
      ],
    ]);

    const keys = buildLexicalWordCloudEntries(items, 'de', 80, tokensByItemId, 1).map(
      (entry) => entry.key,
    );
    expect(keys.sort()).toEqual(['faden', 'pause', 'struktur']);
    expect(keys).not.toContain('hilft');
    expect(keys).not.toContain('helfen');
    expect(keys).not.toContain('bleibt');
    expect(keys).not.toContain('bleiben');
    expect(keys).not.toContain('kurze');
    expect(keys).not.toContain('kurz');
    expect(keys).not.toContain('verliere');
    expect(keys).not.toContain('verlieren');
  });

  it('filtert seltene Unigramme auch ohne Phrasenmodus', () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      id: `item-${index}`,
      text: index < 3 ? 'Haus' : `Unikat ${index}`,
      weight: 1,
    }));
    const tokensByItemId = new Map(
      items.map((item, index) => [
        item.id,
        index < 3
          ? [{ display: 'Haus', lookup: 'haus' }]
          : [{ display: `Unikat${index}`, lookup: `unikat${index}` }],
      ]),
    );

    const entries = buildLexicalWordCloudEntries(items, 'de', 80, tokensByItemId, 1);
    expect(entries.map((entry) => entry.key)).toEqual(['haus']);
  });

  it('filtert Funktionswoerter wie nicht, sonst und dann', () => {
    const items = [
      { id: 'item-1', text: 'nicht sonst dann Beispiele', weight: 1 },
      { id: 'item-2', text: 'sonst dann nicht Beispiele', weight: 1 },
      { id: 'item-3', text: 'dann nicht sonst Beispiele', weight: 1 },
    ];

    const identity = buildLexicalWordCloudEntries(items, 'de');
    expect(identity.map((entry) => entry.key)).toEqual(['beispiele']);
    expect(identity[0]?.label).toBe('Beispiele');

    const smoothed = buildLexicalWordCloudEntries(
      items,
      'de',
      undefined,
      new Map(
        items.map((item) => [
          item.id,
          [
            { display: 'nicht', lookup: 'nicht' },
            { display: 'sonst', lookup: 'sonst' },
            { display: 'dann', lookup: 'dann' },
            { display: 'Beispiel', lookup: 'beispiel' },
          ],
        ]),
      ),
    );
    expect(smoothed.map((entry) => entry.key)).toEqual(['beispiel']);
    expect(smoothed[0]?.label).toBe('Beispiel');
  });
});
