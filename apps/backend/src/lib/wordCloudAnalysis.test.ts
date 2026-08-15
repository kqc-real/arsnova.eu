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
});
