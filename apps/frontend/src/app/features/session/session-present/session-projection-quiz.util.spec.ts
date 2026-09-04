import { describe, expect, it } from 'vitest';
import type { HostCurrentQuestionDTO } from '@arsnova/shared-types';
import {
  matchingCorrectColumns,
  matchingMatrixColumns,
  matchingMatrixRows,
  numericHistogramBarPercent,
  presenterCodeColumnCount,
  presenterCompactMarkdown,
  presenterCorrectPairResults,
  presenterMarkdownWithoutCode,
  presenterQuestionCodeBlocks,
  presenterQuestionCodeColumnMarkdown,
  presenterQuestionCodeMarkdown,
  presenterQuestionHeading,
  presenterQuestionImage,
  ratingScaleValues,
  stableSeededShuffle,
} from './session-projection-quiz.util';

function baseQuestion(overrides: Partial<HostCurrentQuestionDTO> = {}): HostCurrentQuestionDTO {
  return {
    questionId: '11111111-1111-4111-8111-111111111111',
    order: 0,
    text: 'Frage',
    type: 'MATCHING',
    difficulty: 'MEDIUM',
    answers: [],
    ...overrides,
  };
}

describe('session-projection-quiz.util', () => {
  it('mappt Zuordnungspaare auf Matrixachsen', () => {
    const question = baseQuestion({
      matchingPairs: [
        { leftId: 'l1', left: 'A', rightId: 'r1', right: '1' },
        { leftId: 'l2', left: 'B', rightId: 'r2', right: '2' },
      ],
    });

    expect(matchingMatrixRows(question).map((row) => row.label)).toEqual(['A', 'B']);
    expect(matchingMatrixColumns(question).map((column) => column.label)).toEqual(['1', '2']);
    expect(matchingCorrectColumns(question)).toEqual({ l1: 'r1', l2: 'r2' });
  });

  it('bildet die Bewertungsskala und Histogrammhöhen', () => {
    expect(ratingScaleValues(baseQuestion({ type: 'RATING', ratingMin: 0, ratingMax: 2 }))).toEqual(
      [0, 1, 2],
    );
    expect(numericHistogramBarPercent(4, [{ count: 1 }, { count: 4 }, { count: 2 }])).toBe(100);
    expect(numericHistogramBarPercent(2, [{ count: 1 }, { count: 4 }, { count: 2 }])).toBe(50);
  });

  it('mischt Optionen stabil und unabhängig von der Kanon-Reihenfolge', () => {
    const items = [
      { id: 'a', text: 'Alpha' },
      { id: 'b', text: 'Beta' },
      { id: 'c', text: 'Gamma' },
    ];
    const shuffled = stableSeededShuffle(items, 'seed-1', (item) => item.id);
    const reversed = stableSeededShuffle([...items].reverse(), 'seed-1', (item) => item.id);
    expect(shuffled.map((item) => item.id).sort()).toEqual(['a', 'b', 'c']);
    expect(stableSeededShuffle(items, 'seed-1', (item) => item.id)).toEqual(shuffled);
    expect(reversed).toEqual(shuffled);
  });

  it('zieht für die Beamer-Abstimmung nur die Überschrift, das Bild separat', () => {
    const markdown =
      '### KI-Bild oder echtes Foto?\n\n![Dach](/assets/demo/bett.png "Bett")\n\n*[credit] Pass / Le Brun (1821)*\n\n_Bitte genau hinsehen._';
    expect(presenterQuestionHeading(markdown)).toBe('KI-Bild oder echtes Foto?');
    expect(presenterCompactMarkdown(markdown)).toBe('### KI-Bild oder echtes Foto?');
    expect(presenterCompactMarkdown(markdown)).not.toContain('/assets/demo/bett.png');
    expect(presenterCompactMarkdown(markdown)).not.toContain('Bitte genau hinsehen');
    expect(presenterCompactMarkdown(markdown)).not.toContain('Pass / Le Brun');
    expect(presenterQuestionImage(markdown)).toEqual({
      alt: 'Dach',
      url: '/assets/demo/bett.png',
      credit: 'Pass / Le Brun (1821)',
    });
    expect(
      presenterQuestionImage(
        '### KI-Bild\n\n![Dach](/assets/demo/bett.png)\n\n_Bitte genau hinsehen._',
      ),
    ).toEqual({
      alt: 'Dach',
      url: '/assets/demo/bett.png',
      credit: null,
    });
    expect(presenterQuestionImage('### Nur Text')).toBeNull();
  });

  it('rechnet die Trefferquote je richtigem Paar', () => {
    const pairs = presenterCorrectPairResults(
      [{ id: 'l1', label: 'Berlin' }],
      [
        { id: 'r1', label: 'Deutschland' },
        { id: 'r2', label: 'Frankreich' },
      ],
      [
        { rowId: 'l1', columnId: 'r1', count: 6 },
        { rowId: 'l1', columnId: 'r2', count: 2 },
      ],
      { l1: 'r1' },
    );
    expect(pairs).toEqual([{ id: 'l1', from: 'Berlin', to: 'Deutschland', count: 6, percent: 75 }]);
  });

  it('trennt Frage und Fenced-Code für die Beamer-Ansicht', () => {
    const markdown =
      '### Für welche Umgebung?\n\n```java\nvoid setup() {\n  size(130, 130, OPENGL);\n}\n```';
    expect(presenterMarkdownWithoutCode(markdown)).toBe('### Für welche Umgebung?');
    expect(presenterQuestionCodeBlocks(markdown)).toEqual([
      { language: 'java', source: 'void setup() {\n  size(130, 130, OPENGL);\n}\n' },
    ]);
    expect(presenterQuestionCodeMarkdown(markdown)).toContain('size(130, 130, OPENGL)');
    expect(presenterQuestionCodeMarkdown(markdown)).not.toContain('Für welche Umgebung');
    expect(presenterCodeColumnCount('```\nline\n```')).toBe(1);
    expect(
      presenterCodeColumnCount(
        '```\n' + Array.from({ length: 24 }, (_, index) => `line${index}`).join('\n') + '\n```',
      ),
    ).toBe(2);
    expect(
      presenterCodeColumnCount(
        '```\n' + Array.from({ length: 48 }, (_, index) => `line${index}`).join('\n') + '\n```',
      ),
    ).toBe(3);
    const twoColumnMarkdown =
      '```java\n' + Array.from({ length: 24 }, (_, index) => `line${index}`).join('\n') + '\n```';
    const columns = presenterQuestionCodeColumnMarkdown(twoColumnMarkdown);
    expect(columns).toHaveLength(2);
    expect(columns[0]).toContain('line0');
    expect(columns[0]).not.toContain('line12');
    expect(columns[1]).toContain('line12');
    expect(columns[0]).toMatch(/line0\nline1/);
  });
});
