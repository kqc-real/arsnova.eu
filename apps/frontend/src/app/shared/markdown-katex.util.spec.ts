import { describe, expect, it } from 'vitest';
import { renderMarkdownWithKatex, renderMarkdownWithoutKatex } from './markdown-katex.util';

describe('renderMarkdownWithKatex', () => {
  it('rendert Markdown und KaTeX-Inline-Ausdrücke', () => {
    const result = renderMarkdownWithKatex('**Test** mit $a^2 + b^2 = c^2$');

    expect(result.html).toContain('<strong>Test</strong>');
    expect(result.html).toContain('katex');
    expect(result.katexError).toBeNull();
  });

  it('liefert bei ungültiger KaTeX-Syntax eine lesbare Fehlermarkierung', () => {
    const result = renderMarkdownWithKatex('Formel: $\\\\frac{1}{2$');

    expect(result.katexError).toBeTruthy();
    expect(result.html).toContain('KaTeX-Fehler');
  });

  it('escaped eingebettetes HTML aus Markdown-Text', () => {
    const result = renderMarkdownWithKatex('<img src=x onerror=alert(1)>');

    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(result.html).not.toContain('<img src=');
  });
});

describe('renderMarkdownWithoutKatex', () => {
  it('rendert eingezäunte Codeblöcke als pre/code (ohne $-KaTeX)', () => {
    const html = renderMarkdownWithoutKatex('Text\n\n```json\n{"a":1}\n```\n');

    expect(html).toContain('<pre><code class="language-json">');
    expect(html).toContain('{&quot;a&quot;:1}');
    expect(html).not.toContain('katex');
  });

  it('lässt Dollarzeichen in JSON-Beispielzeilen unangetastet', () => {
    const html = renderMarkdownWithoutKatex('`$...$` in Beschreibung');

    expect(html).toContain('$...$');
    expect(html).not.toContain('katex');
  });
});
