import { describe, expect, it } from 'vitest';
import { buildLexicalWordCloudEntries, buildThemeWordCloudAnalysis } from './wordCloudAnalysis';

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

  it('laesst satzinitiale Frageverben zählt und läuft als Woerter weg', () => {
    const items = [
      { id: 'item-1', text: 'Zählt Kapitel 4 zur Auswahl?', weight: 1 },
      { id: 'item-2', text: 'Zählt die Uhrzeit?', weight: 1 },
      { id: 'item-3', text: 'Läuft der Stream nur Ton?', weight: 1 },
      { id: 'item-4', text: 'Läuft die Demo unter Jupyter?', weight: 1 },
    ];

    const keys = buildLexicalWordCloudEntries(items, 'de', 80).map((entry) => entry.key);
    expect(keys).not.toContain('zaehlt');
    expect(keys).not.toContain('zählt');
    expect(keys).not.toContain('laeuft');
    expect(keys).not.toContain('läuft');
    expect(keys).toContain('kapitel');
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

  it('laesst nackte Zahlen und Satzzeichen als Woerter weg und behaelt Zahlen in Phrasen', () => {
    const items = [
      { id: 'item-1', text: 'Kommt Kapitel 4 in der Klausur vor?', weight: 1 },
      { id: 'item-2', text: 'Brauchen wir Kapitel 4 fuer die Pruefung?', weight: 1 },
      { id: 'item-3', text: 'HTTP 404 bleibt sichtbar', weight: 1 },
      { id: 'item-4', text: 'HTTP 404 bitte erklaeren', weight: 1 },
      { id: 'item-5', text: 'Nach 10 Minuten Pause', weight: 1 },
      { id: 'item-6', text: 'Bitte 10 Minuten einplanen', weight: 1 },
    ];
    const tokensByItemId = new Map([
      [
        'item-1',
        [
          { display: 'Kapitel', lookup: 'kapitel', pos: 'NOUN' },
          { display: '4', lookup: '4', pos: 'NUM' },
          { display: 'Klausur', lookup: 'klausur', pos: 'NOUN' },
        ],
      ],
      [
        'item-2',
        [
          { display: 'Kapitel', lookup: 'kapitel', pos: 'NOUN' },
          { display: '4', lookup: '4', pos: 'NUM' },
          { display: 'Pruefung', lookup: 'pruefung', pos: 'NOUN' },
        ],
      ],
      [
        'item-3',
        [
          { display: 'HTTP', lookup: 'http', pos: 'PROPN' },
          { display: '404', lookup: '404', pos: 'NUM' },
        ],
      ],
      [
        'item-4',
        [
          { display: 'HTTP', lookup: 'http', pos: 'PROPN' },
          { display: '404', lookup: '404', pos: 'NUM' },
        ],
      ],
      [
        'item-5',
        [
          { display: '10', lookup: '10', pos: 'NUM' },
          { display: 'Minuten', lookup: 'minuten', pos: 'NOUN' },
          { display: 'Pause', lookup: 'pause', pos: 'NOUN' },
        ],
      ],
      [
        'item-6',
        [
          { display: '10', lookup: '10', pos: 'NUM' },
          { display: 'Minuten', lookup: 'minuten', pos: 'NOUN' },
        ],
      ],
    ]);

    const wordsOnly = buildLexicalWordCloudEntries(items, 'de', 80, tokensByItemId, 1).map(
      (entry) => entry.key,
    );
    expect(wordsOnly).toContain('kapitel');
    expect(wordsOnly).toContain('minuten');
    expect(wordsOnly).not.toContain('404');
    expect(wordsOnly).not.toContain('10');
    expect(wordsOnly).not.toContain('4');

    const withPhrases = buildLexicalWordCloudEntries(items, 'de', 80, tokensByItemId, 3).map(
      (entry) => entry.key,
    );
    expect(withPhrases).toContain('kapitel 4');
    expect(withPhrases).toContain('http 404');
    expect(withPhrases).not.toContain('4');
    expect(withPhrases).not.toContain('10');
    expect(withPhrases).not.toContain('404');
  });

  it('laesst Interpunktion und Partizipien wie Gelernt als Woerter weg', () => {
    const items = [
      { id: 'item-1', text: 'Was bedeutet .. in der Folie?', weight: 1 },
      { id: 'item-2', text: 'Bitte .. noch einmal erklaeren.', weight: 1 },
      { id: 'item-3', text: 'Kurze Uebungen festigen das Gelernte.', weight: 1 },
      { id: 'item-4', text: 'Gelernt habe ich die Formel.', weight: 1 },
    ];
    const tokensByItemId = new Map([
      [
        'item-1',
        [
          { display: 'bedeutet', lookup: 'bedeutet', pos: 'VERB' },
          { display: '..', lookup: '..', pos: 'PROPN' },
          { display: 'Folie', lookup: 'folie', pos: 'NOUN' },
        ],
      ],
      [
        'item-2',
        [
          { display: '..', lookup: '..', pos: 'X' },
          { display: 'erklaeren', lookup: 'erklaeren', pos: 'VERB' },
        ],
      ],
      [
        'item-3',
        [
          { display: 'Uebungen', lookup: 'uebungen', pos: 'NOUN' },
          { display: 'Gelernte', lookup: 'gelernte', pos: 'NOUN' },
        ],
      ],
      ['item-4', [{ display: 'Gelernt', lookup: 'gelernt', pos: 'VERB' }]],
    ]);

    const keys = buildLexicalWordCloudEntries(items, 'de', 80, tokensByItemId, 1).map(
      (entry) => entry.key,
    );
    expect(keys).toContain('folie');
    expect(keys).toContain('uebungen');
    expect(keys).not.toContain('..');
    expect(keys).not.toContain('gelernt');
    expect(keys).not.toContain('gelernte');
  });
});

describe('buildThemeWordCloudAnalysis', () => {
  it('laesst einzigartige Vollfragen weg und zeigt nur gemeinsame Kurzgruppen', () => {
    const analysis = buildThemeWordCloudAnalysis({
      sessionCode: 'ABC123',
      mode: 'THEME',
      locale: 'de',
      metric: 'TOP',
      normalization: 'NONE',
      maxEntries: 80,
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          weight: 8,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          text: 'Brauchen wir Kapitel 4 fuer die Pruefung?',
          weight: 5,
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          text: 'Sollen wir Zotero oder Citavi verwenden?',
          weight: 4,
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          text: 'Gibt es eine verbindliche BibTeX-Vorlage?',
          weight: 3,
        },
      ],
    });

    expect(analysis.usedThemeAnchors).toBe(true);
    expect(analysis.entries.map((entry) => entry.label)).toEqual(['Kapitel 4']);
    expect(analysis.entries.some((entry) => /Zotero|Citavi|BibTeX/u.test(entry.label))).toBe(false);
  });
});
