import { describe, expect, it } from 'vitest';
import {
  absolutizeMarkdownHtmlRootAssetImgSrc,
  appendMotdContentVersionToAssetImgSrc,
  renderMarkdownWithKatex,
  renderMarkdownWithoutKatex,
} from './markdown-katex.util';

describe('renderMarkdownWithKatex', () => {
  it('rendert Markdown und KaTeX-Inline-Ausdrücke', () => {
    const result = renderMarkdownWithKatex('**Test** mit $a^2 + b^2 = c^2$');

    expect(result.html).toContain('<strong>Test</strong>');
    expect(result.html).toContain('katex');
    expect(result.katexError).toBeNull();
  });

  it('liefert bei ungültiger KaTeX-Syntax eine lesbare Fehlermarkierung', () => {
    const result = renderMarkdownWithKatex(String.raw`Formel: $\frac{1}{2$`);

    expect(result.katexError).toBeTruthy();
    expect(result.html).toContain('KaTeX-Fehler');
  });

  it('toleriert Backslash-n-Artefakte in Block-Math (kein Undefined control sequence)', () => {
    const result = renderMarkdownWithKatex(String.raw`$$\n$$`);

    expect(result.katexError).toBeNull();
    expect(result.html).toContain('katex');
  });

  it('lässt \\neq in Block-Math unverändert gültig rendern', () => {
    const result = renderMarkdownWithKatex(String.raw`$$\neq 0$$`);

    expect(result.katexError).toBeNull();
    expect(result.html).toContain('katex');
  });

  it('toleriert Backslash-n-Artefakte in Inline-Math', () => {
    const result = renderMarkdownWithKatex(String.raw`$\n$`);

    expect(result.katexError).toBeNull();
    expect(result.html).toContain('katex');
  });

  it('behält KaTeX-HTML-Styles nach DOMPurify (mehrzeiliges Block-Math)', () => {
    const result = renderMarkdownWithKatex('$$\nx^2\n$$');

    expect(result.katexError).toBeNull();
    expect(result.html).toContain('katex');
    expect(result.html).toContain('style=');
    expect(result.html).toContain('display="block"');
  });

  it('escaped eingebettetes HTML aus Markdown-Text', () => {
    const result = renderMarkdownWithKatex('<img src=x onerror=alert(1)>');

    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(result.html).not.toContain('<img src=');
  });

  it('blockiert relative Bildquellen standardmäßig in Quiz-/Session-Inhalten', () => {
    const result = renderMarkdownWithKatex('![Demo](/assets/demo/x.svg)');

    expect(result.html).toContain('<p>Demo</p>');
    expect(result.html).not.toContain('<img ');
    expect(result.html).not.toContain('src="/assets/demo/x.svg"');
  });
});

describe('renderMarkdownWithoutKatex', () => {
  it('rendert eingezäunte Codeblöcke als pre/code (ohne $-KaTeX)', () => {
    const html = renderMarkdownWithoutKatex('Text\n\n```json\n{"a":1}\n```\n');

    expect(html).toContain('<pre><code class="hljs language-json">');
    expect(html).toContain('hljs-');
    // JSON wird in Spans zerlegt; Inhalt bleibt erkennbar.
    expect(html).toMatch(/"a"|&quot;a&quot;/);
    expect(html).toMatch(/hljs-(?:attr|number|string|literal|property)/);
    expect(html).not.toContain('katex');
  });

  it('behandelt Fences ohne Sprach-Tag standardmäßig als Python', () => {
    const html = renderMarkdownWithoutKatex('```\nprint(1)\n```\n');
    expect(html).toContain('<pre><code class="hljs language-python">');
    expect(html).toContain('hljs-');
  });

  it('lässt Dollarzeichen in JSON-Beispielzeilen unangetastet', () => {
    const html = renderMarkdownWithoutKatex('`$...$` in Beschreibung');

    expect(html).toContain('$...$');
    expect(html).not.toContain('katex');
  });

  it('setzt bei Markdown-Bildern title für Hover-Tooltip (Fallback: Alt-Text)', () => {
    const html = renderMarkdownWithoutKatex('![Kurzinfo](assets/demo/x.svg)');
    expect(html).toMatch(/alt="Kurzinfo"/);
    expect(html).toMatch(/title="Kurzinfo"/);
    expect(html).toMatch(/data-markdown-image-lightbox="true"/);
  });

  it('blockiert relative Bildquellen im strikten Modus (Quiz-Inhalte)', () => {
    const html = renderMarkdownWithoutKatex('![A](assets/demo/x.svg)', {
      imagePolicy: 'external-https-only',
    });
    expect(html).toContain('<p>A</p>');
    expect(html).not.toContain('<img ');
    expect(html).not.toContain('src="assets/demo/x.svg"');
  });

  it('erlaubt https-Bildquellen im strikten Modus (Quiz-Inhalte)', () => {
    const html = renderMarkdownWithoutKatex('![A](https://example.org/x.svg)', {
      imagePolicy: 'external-https-only',
    });
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.org/x.svg"');
  });

  it('nutzt optionalen Markdown-Bildtitel als title-Attribut', () => {
    const html = renderMarkdownWithoutKatex('![a](b.svg "Expliziter Titel")');
    expect(html).toMatch(/title="Expliziter Titel"/);
  });

  it('entfernt javascript-Links aus dem gerenderten HTML', () => {
    const html = renderMarkdownWithoutKatex('[klick](javascript:alert(1))');
    expect(html).toContain('<p>klick</p>');
    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).not.toContain('<a ');
  });

  it('entfernt javascript-Bildquellen aus dem gerenderten HTML', () => {
    const html = renderMarkdownWithoutKatex('![Alarm](javascript:alert(1))');
    expect(html).toContain('<p>Alarm</p>');
    expect(html).not.toContain('<img ');
    expect(html).not.toContain('src="javascript:alert(1)"');
  });

  it('erlaubt sichere relative und https-Links weiterhin', () => {
    const html = renderMarkdownWithoutKatex(
      '[intern](/de/datenschutz) [extern](https://arsnova.eu/info) [mail](mailto:test@example.org)',
    );
    expect(html).toContain('href="/de/datenschutz"');
    expect(html).toContain('href="https://arsnova.eu/info"');
    expect(html).toContain('href="mailto:test@example.org"');
  });

  it('entfernt unsichere http-Links und http-Bildquellen', () => {
    const html = renderMarkdownWithoutKatex(
      '[unsicher](http://arsnova.eu/info) ![unsicher](http://arsnova.eu/banner.png)',
    );
    expect(html).not.toContain('href="http://arsnova.eu/info"');
    expect(html).not.toContain('src="http://arsnova.eu/banner.png"');
    expect(html).not.toContain('<img ');
    expect(html).toContain('unsicher');
  });

  it('absolutizeMarkdownHtmlRootAssetImgSrc setzt MOTD-Banner auf volle Origin-URL', () => {
    const raw = '<p><img src="/assets/images/AI-REVOLUTION.png" alt="" title="" /></p>';
    const out = absolutizeMarkdownHtmlRootAssetImgSrc(raw, 'https://arsnova.eu/de');
    expect(out).toContain('src="https://arsnova.eu/de/assets/images/AI-REVOLUTION.png"');
  });

  it('absolutizeMarkdownHtmlRootAssetImgSrc normalisiert auch assets/ ohne führenden Slash', () => {
    const raw = '<p><img src="assets/images/AI-REVOLUTION.png" alt="" title="" /></p>';
    const out = absolutizeMarkdownHtmlRootAssetImgSrc(raw, 'https://arsnova.eu/en');
    expect(out).toContain('src="https://arsnova.eu/en/assets/images/AI-REVOLUTION.png"');
  });

  it('appendMotdContentVersionToAssetImgSrc hängt cv an /assets/-Bilder (PWA-Cache-Bust)', () => {
    const raw = '<p><img src="https://arsnova.eu/assets/images/AI-REVOLUTION.png" alt="" /></p>';
    const out = appendMotdContentVersionToAssetImgSrc(raw, 8);
    expect(out).toContain('src="https://arsnova.eu/assets/images/AI-REVOLUTION.png?cv=8"');
  });

  it('appendMotdContentVersionToAssetImgSrc verdoppelt cv nicht', () => {
    const raw = '<img src="https://x/assets/a.png?cv=3" alt="" />';
    expect(appendMotdContentVersionToAssetImgSrc(raw, 99)).toBe(raw);
  });
});
