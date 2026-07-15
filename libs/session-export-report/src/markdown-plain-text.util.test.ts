import { describe, expect, it } from 'vitest';
import {
  extractExportQuestionText,
  stripHostOnlyQuestionNotes,
  stripMarkdownToPlainText,
} from './markdown-plain-text.util';

describe('extractExportQuestionText', () => {
  it('entfernt Unterrichtsidee, Bilder und Fußnoten', () => {
    const raw = `### Wie ist die Stimmung im Raum gerade?

> **Unterrichtsidee:** Nutze das als kurzen Check-in.

![Emotionen](https://example.com/img.jpg)

*Für die Vollansicht anklicken.*`;

    expect(extractExportQuestionText(raw)).toBe('Wie ist die Stimmung im Raum gerade?');
  });

  it('behält ergänzenden Lernkontext nach der Überschrift', () => {
    const raw = `### In welchem Jahr begann die Französische Revolution?

> **Unterrichtsidee:** Nutze das als Schätzfrage.

Gesucht ist das Jahr, das historisch üblicherweise als Beginn gilt.`;

    expect(extractExportQuestionText(raw)).toBe(
      'In welchem Jahr begann die Französische Revolution? Gesucht ist das Jahr, das historisch üblicherweise als Beginn gilt.',
    );
  });

  it('lässt Formel-Autorenzeilen weg und erhält pi in der Überschrift', () => {
    const raw = `### Runde $\\pi$ auf zwei Dezimalstellen.

> **Unterrichtsidee:** MINT-Schätzfrage.

Leonhard Euler:

$$e^{i \\pi} + 1 = 0$$

Karl Weierstraß:

$$\\pi = 2$$`;

    expect(extractExportQuestionText(raw)).toBe('Runde π auf zwei Dezimalstellen.');
  });

  it('entfernt Codeblöcke und Links', () => {
    const raw = `### In welcher Sprache ist dieser Code geschrieben?

> **Unterrichtsidee:** Erkennungsimpuls.

\`\`\`java
void draw() { background(100); }
\`\`\`

Optionaler Impuls: [Video](https://youtube.com/watch?v=abc)`;

    expect(extractExportQuestionText(raw)).toBe('In welcher Sprache ist dieser Code geschrieben?');
  });
});

describe('stripHostOnlyQuestionNotes', () => {
  it('filtert Unterrichtsidee-Zeilen', () => {
    expect(
      stripHostOnlyQuestionNotes('Frage?\n> **Unterrichtsidee:** Nur für Lehrende\nAntwort.'),
    ).toBe('Frage?\nAntwort.');
  });
});

describe('stripMarkdownToPlainText', () => {
  it('wandelt einfaches Markdown um', () => {
    expect(stripMarkdownToPlainText('**Fett** und *kursiv*')).toBe('Fett und kursiv');
  });

  it('ersetzt Emoji-Shortcodes', () => {
    expect(stripMarkdownToPlainText(':smile: Bereit loszulegen')).toBe('😄 Bereit loszulegen');
  });
});
