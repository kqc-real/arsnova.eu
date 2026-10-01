import { describe, expect, it } from 'vitest';
import {
  clearWordCloudAnalysisTextCacheForTests,
  joinWordCloudAnalysisSegments,
  prepareWordCloudAnalysisText,
  WORD_CLOUD_ANALYSIS_TEXT_VERSION,
} from './word-cloud-analysis-text.js';
import { QA_REDACTION_CHAR, QA_REDACTION_PLACEHOLDER_LEGACY } from './qa-redaction.js';

describe('prepareWordCloudAnalysisText', () => {
  it('exportiert eine stabile Aufbereitungsversion', () => {
    expect(WORD_CLOUD_ANALYSIS_TEXT_VERSION).toBe('4');
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

  it('lässt Dollarzeichen in Linkzielen und Code an marked und behält Folgetext', () => {
    expect(prepareWordCloudAnalysisText('[Link](https://example.org/$foo) Statistik')).toEqual({
      segments: ['Statistik'],
    });
    expect(prepareWordCloudAnalysisText('Vor `inline $y$` Ende')).toEqual({
      segments: ['Vor', 'Ende'],
    });
    const source = ['Vor', '```python', 'print("$x")', '```', 'Nach'].join('\n');
    expect(prepareWordCloudAnalysisText(source)).toEqual({
      segments: ['Vor', 'Nach'],
    });
  });

  it('schließt Formeln auch nach ungeschlossenem Backtick aus (marked-Textkontext)', () => {
    expect(prepareWordCloudAnalysisText('Vor `open $\\frac{a}{b}$ weiter')).toEqual({
      segments: ['Vor `open', 'weiter'],
    });
  });

  it('behält escaped Closing-Dollar als Literal', () => {
    expect(prepareWordCloudAnalysisText('Preis \\$5 und Text')).toEqual({
      segments: ['Preis $5 und Text'],
    });
  });

  it('schließt Formeln atomar trotz escaptem Dollar im Ausdruck', () => {
    expect(prepareWordCloudAnalysisText('Vor $\\text{Preis \\$5} + x$ nach')).toEqual({
      segments: ['Vor', 'nach'],
    });
    expect(prepareWordCloudAnalysisText('A $$a \\\\$ b$$ B')).toEqual({
      segments: ['A', 'B'],
    });
    // Gerade Backslash-Anzahl: Dollar ist Schlussdelimiter; Rest `$ nach` ist offene Formel → ausgeschlossen
    expect(prepareWordCloudAnalysisText('Vor $a \\\\$ b$ nach')).toEqual({
      segments: ['Vor', 'b'],
    });
    expect(prepareWordCloudAnalysisText('Inline \\(\\text{\\$}\\) Ende')).toEqual({
      segments: ['Inline', 'Ende'],
    });
  });

  it('dekodiert gängige named Entities und Emoji-Codepoints', () => {
    expect(prepareWordCloudAnalysisText('M&uuml;ller erkl&auml;rt Regression')).toEqual({
      segments: ['Müller erklärt Regression'],
    });
    expect(prepareWordCloudAnalysisText('A &#x1F600; B')).toEqual({
      segments: ['A', 'B'],
    });
  });

  it('erkennt variable Fence-Längen über marked', () => {
    const source = ['Vor', '````', 'code $x$', '````', 'Nach'].join('\n');
    expect(prepareWordCloudAnalysisText(source)).toEqual({
      segments: ['Vor', 'Nach'],
    });
  });

  it('setzt Grenzen für br, br/ und Markdown-Hardbreaks', () => {
    expect(prepareWordCloudAnalysisText('Vor<br>nach')).toEqual({
      segments: ['Vor', 'nach'],
    });
    expect(prepareWordCloudAnalysisText('Vor<br/>nach')).toEqual({
      segments: ['Vor', 'nach'],
    });
    expect(prepareWordCloudAnalysisText('Vor<br />nach')).toEqual({
      segments: ['Vor', 'nach'],
    });
    expect(prepareWordCloudAnalysisText('Vor  \nnach')).toEqual({
      segments: ['Vor', 'nach'],
    });
  });

  it('stürzt bei ungültigen numerischen Entities nicht ab', () => {
    expect(() =>
      prepareWordCloudAnalysisText('Vor &#999999999; nach und &#x110000; Ende'),
    ).not.toThrow();
    expect(prepareWordCloudAnalysisText('Vor &#999999999; nach und &#x110000; Ende')).toEqual({
      segments: ['Vor', 'nach und', 'Ende'],
    });
    expect(prepareWordCloudAnalysisText('A &#x1F600; B')).toEqual({
      segments: ['A', 'B'],
    });
    // Surrogat-Halbwert allein → leer verwerfen, Korpus bleibt analysierbar
    expect(prepareWordCloudAnalysisText('Alpha &#xD800; Beta')).toEqual({
      segments: ['Alpha', 'Beta'],
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

  it('wiederverwendet Aufbereitungsergebnisse für identische Eingaben', () => {
    clearWordCloudAnalysisTextCacheForTests();
    const first = prepareWordCloudAnalysisText('lineare Regression');
    const second = prepareWordCloudAnalysisText('lineare Regression');
    expect(second).toBe(first);
  });
});
