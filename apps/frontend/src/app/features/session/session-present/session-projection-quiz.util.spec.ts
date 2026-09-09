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
  presenterMarkdownWithoutStageLinks,
  presenterQuestionCodeBlocks,
  presenterQuestionCodeColumnMarkdown,
  presenterQuestionCodeMarkdown,
  presenterQuestionHeading,
  presenterQuestionImage,
  presenterQuestionMathMarkdown,
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

  it('zieht für die Freitext-Wortwolke nur die Überschrift', () => {
    const markdown =
      '### Was hilft dir beim Lernen?\n\nDie Antworten werden als **Wortwolke** dargestellt.';
    expect(presenterQuestionHeading(markdown)).toBe('Was hilft dir beim Lernen?');
    expect(presenterQuestionHeading(markdown)).not.toContain('Wortwolke');
  });

  it('zieht für die Beamer-Abstimmung nur die Überschrift, das Bild separat', () => {
    const markdown =
      '### KI-Bild oder echtes Foto?\n\n![Dach](/assets/demo/bett.png "Bett")\n\n*[credit] Pass / Le Brun (1821)*\n\n_Bitte genau hinsehen._';
    expect(presenterQuestionHeading(markdown)).toBe('KI-Bild oder echtes Foto?');
    expect(presenterCompactMarkdown(markdown)).toBe('### KI-Bild oder echtes Foto?');
    expect(presenterCompactMarkdown(markdown)).not.toContain('/assets/demo/bett.png');
    expect(presenterCompactMarkdown(markdown)).not.toContain('Bitte genau hinsehen');
    expect(presenterCompactMarkdown(markdown)).not.toContain('Pass / Le Brun');
    expect(presenterQuestionMathMarkdown(markdown)).toBe('');
    expect(presenterQuestionImage(markdown)).toEqual({
      alt: 'Dach',
      url: '/assets/demo/bett.png',
      credit: 'Pass / Le Brun (1821)',
    });
    expect(
      presenterQuestionImage(
        '### KI-Bild\n\n![Dach](/assets/demo/bett.png)\n\n*[credit] Photo_by_User / Wikimedia*\n',
      )?.credit,
    ).toBe('Photo_by_User / Wikimedia');
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

  it('behält Display-KaTeX mit Label für die Beamer-Abstimmung', () => {
    const markdown =
      '### Runde $\\pi$ auf zwei Dezimalstellen.\n\n![Pi](https://example.com/pi.gif)\n\nLeonhard Euler:\n\n$$e^{i \\pi} + 1 = 0$$\n\nKarl Weierstraß:\n\n$$\\pi = \\int_{-\\infty}^{\\infty} \\frac{\\mathrm{d}x}{1 + x^2}$$';
    expect(presenterCompactMarkdown(markdown)).toBe('### Runde $\\pi$ auf zwei Dezimalstellen.');
    expect(presenterQuestionMathMarkdown(markdown)).toBe(
      'Leonhard Euler:\n\n$$e^{i \\pi} + 1 = 0$$\n\nKarl Weierstraß:\n\n$$\\pi = \\int_{-\\infty}^{\\infty} \\frac{\\mathrm{d}x}{1 + x^2}$$',
    );
    expect(presenterQuestionMathMarkdown(markdown)).not.toContain('example.com/pi.gif');
    expect(presenterQuestionMathMarkdown('### Nur Text')).toBe('');
  });

  it('extrahiert kein Display-KaTeX aus Fenced- oder Inline-Code', () => {
    const fencedOnly =
      '### Shell-PID?\n\n```bash\necho $$\nps -p $$\n```\n\nWähle die richtige Ausgabe.';
    expect(presenterQuestionMathMarkdown(fencedOnly)).toBe('');

    const inlineOnly = '### Was gibt `echo $$` aus?\n\nVergleiche mit `kill $$`.';
    expect(presenterQuestionMathMarkdown(inlineOnly)).toBe('');

    const mixed =
      '### Formel neben Code\n\n```bash\necho $$\n```\n\nEuler:\n\n$$e^{i \\pi} + 1 = 0$$\n\nUnd inline `$$` ignorieren.';
    expect(presenterQuestionMathMarkdown(mixed)).toBe('Euler:\n\n$$e^{i \\pi} + 1 = 0$$');
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

  it('entfernt optionale Impulse und externe Links für die Beamer-Lesephase', () => {
    const markdown =
      '### Aus wie vielen Cubies besteht ein 3×3-Zauberwürfel?\n\nGemeint ist der klassische Rubik’s Cube.\n\nOptionaler Impuls: [Wie man einen 3×3 Zauberwürfel löst](https://www.youtube.com/watch?v=EoINieyz6gE).';
    expect(presenterMarkdownWithoutStageLinks(markdown)).toBe(
      '### Aus wie vielen Cubies besteht ein 3×3-Zauberwürfel?\n\nGemeint ist der klassische Rubik’s Cube.',
    );
    expect(presenterMarkdownWithoutStageLinks(markdown)).not.toContain('Optionaler Impuls');
    expect(presenterMarkdownWithoutStageLinks(markdown)).not.toContain('youtube.com');
    expect(
      presenterMarkdownWithoutStageLinks(
        '### Foto?\n\n![Dach](/assets/demo/bett.png)\n\n*[credit] Pass / Le Brun*',
      ),
    ).toContain('![Dach](/assets/demo/bett.png)');
    expect(
      presenterMarkdownWithoutStageLinks(
        '### Diagramm?\n\n![Schema](https://example.org/image.png)\n\nBitte ablesen.',
      ),
    ).toContain('![Schema](https://example.org/image.png)');
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
