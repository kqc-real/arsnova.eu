import { describe, expect, it } from 'vitest';
import { renderMarkdownWithKatex } from './markdown-katex.util';

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
});
