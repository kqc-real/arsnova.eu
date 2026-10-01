import { describe, expect, it } from 'vitest';
import {
  joinWordCloudAnalysisSegments,
  prepareWordCloudAnalysisText,
  WORD_CLOUD_ANALYSIS_TEXT_VERSION,
} from './word-cloud-analysis-text.js';
import { QA_REDACTION_CHAR, QA_REDACTION_PLACEHOLDER_LEGACY } from './qa-redaction.js';

describe('prepareWordCloudAnalysisText', () => {
  it('exportiert eine stabile Aufbereitungsversion', () => {
    expect(WORD_CLOUD_ANALYSIS_TEXT_VERSION).toBe('2');
  });

  it('entfernt Fett-Marker und behält denselben analysierbaren Text', () => {
    expect(prepareWordCloudAnalysisText('**lineare Regression**')).toEqual({
      segments: ['lineare Regression'],
    });
    expect(prepareWordCloudAnalysisText('lineare Regression')).toEqual({
      segments: ['lineare Regression'],
    });
  });

  it('schließt Markdown-Links einschließlich Linktext aus und trennt Segmente', () => {
    expect(prepareWordCloudAnalysisText('[Regression](https://example.org/statistik)')).toEqual({
      segments: [],
    });
    expect(
      prepareWordCloudAnalysisText('Regression [Literatur](https://example.org) Statistik'),
    ).toEqual({
      segments: ['Regression', 'Statistik'],
    });
  });

  it('schließt Bilder einschließlich Alt-Text aus', () => {
    expect(prepareWordCloudAnalysisText('![Diagramm](https://example.org/bild.png)')).toEqual({
      segments: [],
    });
    expect(prepareWordCloudAnalysisText('Vorher ![x](https://example.org/a.png) nachher')).toEqual({
      segments: ['Vorher', 'nachher'],
    });
  });

  it('schließt alle vier Formelbegrenzer ohne LaTeX-Worttokens aus', () => {
    expect(prepareWordCloudAnalysisText('Siehe $x^2$ bitte')).toEqual({
      segments: ['Siehe', 'bitte'],
    });
    expect(prepareWordCloudAnalysisText('Block $$\\frac{a}{b}$$ Ende')).toEqual({
      segments: ['Block', 'Ende'],
    });
    expect(prepareWordCloudAnalysisText('Inline \\(x^{2}\\) mehr')).toEqual({
      segments: ['Inline', 'mehr'],
    });
    expect(prepareWordCloudAnalysisText('Display \\[a+b\\] fertig')).toEqual({
      segments: ['Display', 'fertig'],
    });
    const joined = joinWordCloudAnalysisSegments(
      prepareWordCloudAnalysisText('Wert $\\frac{a}{b}$ und \\(c\\)').segments,
    );
    expect(joined).not.toMatch(/frac|cdot|\\\\/);
    expect(joined).toBe('Wert\nund');
  });

  it('lässt Code an marked und schließt ihn im Walker aus (kein eigener Code-Parser)', () => {
    const source = ['Vor', '```python', 'print("$x")', '```', 'Nach `inline $y$` Ende'].join('\n');
    expect(prepareWordCloudAnalysisText(source)).toEqual({
      segments: ['Vor', 'Nach', 'Ende'],
    });
  });

  it('behält Listen-, Tabellen- und Zitatinhalte ohne Marker und mit Grenzen', () => {
    expect(prepareWordCloudAnalysisText('- Eins\n- Zwei')).toEqual({
      segments: ['Eins', 'Zwei'],
    });
    expect(prepareWordCloudAnalysisText('> Zitatzeile')).toEqual({
      segments: ['Zitatzeile'],
    });
    expect(prepareWordCloudAnalysisText('| A | B |\n| --- | --- |\n| links | rechts |')).toEqual({
      segments: ['A', 'B', 'links', 'rechts'],
    });
  });

  it('schließt Referenzlinks und -definitionen aus', () => {
    expect(
      prepareWordCloudAnalysisText('[Regression][id]\n\n[id]: https://example.org "Titel"'),
    ).toEqual({
      segments: [],
    });
  });

  it('dekodiert Entities und erzeugt keine amp-Tokens', () => {
    expect(prepareWordCloudAnalysisText('A &amp; B')).toEqual({
      segments: ['A & B'],
    });
  });

  it('schließt Emoji-Kürzel und direkte Emojis aus', () => {
    expect(prepareWordCloudAnalysisText('Hallo :smile: Welt')).toEqual({
      segments: ['Hallo', 'Welt'],
    });
    expect(prepareWordCloudAnalysisText('Hallo 😀 Welt')).toEqual({
      segments: ['Hallo', 'Welt'],
    });
  });

  it('schließt Autolinks und nackte URLs aus', () => {
    expect(prepareWordCloudAnalysisText('Siehe https://example.org/path?q=1 bitte')).toEqual({
      segments: ['Siehe', 'bitte'],
    });
  });

  it('schließt sub/sup-Inhalte aus und erhält Grenzen', () => {
    expect(prepareWordCloudAnalysisText('H<sub>2</sub>O und mehr')).toEqual({
      segments: ['H', 'O und mehr'],
    });
  });

  it('trennt keine Phrasen über ausgeschlossene Bereiche oder Absätze', () => {
    const result = prepareWordCloudAnalysisText(
      'Regression [Literatur](https://example.org) Statistik\n\nZweiter Absatz',
    );
    expect(result.segments).toEqual(['Regression', 'Statistik', 'Zweiter Absatz']);
    expect(result.segments).not.toContain('Regression Statistik');
    expect(result.segments.some((segment) => segment.includes('Regression Statistik'))).toBe(false);
  });

  it('behält zusammenhängende Segmente bei reiner Inline-Hervorhebung', () => {
    expect(prepareWordCloudAnalysisText('lineare **Regression** testen')).toEqual({
      segments: ['lineare Regression testen'],
    });
  });

  it('behandelt Schwärzungen als harte Grenzen', () => {
    expect(prepareWordCloudAnalysisText(`Vor ${QA_REDACTION_PLACEHOLDER_LEGACY} nach`)).toEqual({
      segments: ['Vor', 'nach'],
    });
    expect(prepareWordCloudAnalysisText(`Alpha ${QA_REDACTION_CHAR.repeat(3)} Beta`)).toEqual({
      segments: ['Alpha', 'Beta'],
    });
  });

  it('übersteht fehlerhafte und stark verschachtelte Eingaben', () => {
    expect(() => prepareWordCloudAnalysisText('**offen und $unclosed')).not.toThrow();
    expect(() => prepareWordCloudAnalysisText(`${'**a** '.repeat(200)}ende`)).not.toThrow();
    const nested = prepareWordCloudAnalysisText('***a ***b*** c***');
    expect(Array.isArray(nested.segments)).toBe(true);
  });

  it('liefert leere Segmente für reine Ausschluss-Beiträge', () => {
    expect(prepareWordCloudAnalysisText('$$a+b$$')).toEqual({ segments: [] });
    expect(joinWordCloudAnalysisSegments([])).toBe('');
  });
});
