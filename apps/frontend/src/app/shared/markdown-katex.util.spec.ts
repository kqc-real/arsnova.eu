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

  it('erlaubt im lockeren Bildmodus Loopback-HTTP-Bildquellen fuer lokale Vorschauen', () => {
    const result = renderMarkdownWithKatex('![Demo](http://localhost:4200/assets/demo/x.svg)', {
      imagePolicy: 'allow-relative-and-https',
    });

    expect(result.html).toContain('<img');
    expect(result.html).toContain('src="http://localhost:4200/assets/demo/x.svg"');
  });

  it('setzt fuer externe Bilder kompatible Ladeattribute', () => {
    const result = renderMarkdownWithKatex(
      '![Demo](https://upload.wikimedia.org/wikipedia/commons/b/b4/Sixteen_faces_expressing_the_human_passions._Wellcome_L0068375_%28cropped%29.jpg)',
      { imagePolicy: 'allow-relative-and-https' },
    );

    expect(result.html).toContain('loading="eager"');
    expect(result.html).toContain('decoding="async"');
    expect(result.html).toContain('crossorigin="anonymous"');
    expect(result.html).toContain('referrerpolicy="no-referrer"');
  });

  it('erlaubt im lockeren Bildmodus Blob-Bildquellen fuer lokale Vorschauen', () => {
    const result = renderMarkdownWithKatex('![Demo](blob:http://localhost:4200/preview-image)', {
      imagePolicy: 'allow-relative-and-https',
    });

    expect(result.html).toContain('<img');
    expect(result.html).toContain('src="blob:http://localhost:4200/preview-image"');
  });

  it('erlaubt im lockeren Bildmodus sichere data-image-Quellen fuer lokale Vorschauen', () => {
    const result = renderMarkdownWithKatex(
      '![Pixel](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+KDv0WQAAAABJRU5ErkJggg==)',
      {
        imagePolicy: 'allow-relative-and-https',
      },
    );

    expect(result.html).toContain('<img');
    expect(result.html).toContain('src="data:image/png;base64,');
  });

  it('ersetzt bekannte Emoji-Shortcodes in normalem Markdown-Text', () => {
    const result = renderMarkdownWithKatex('Los :rocket: **Apfel :apple:**');

    expect(result.html).toContain('Los <span class="markdown-emoji" title=":rocket:">🚀</span>');
    expect(result.html).toContain(
      '<strong>Apfel <span class="markdown-emoji" title=":apple:">🍎</span></strong>',
    );
  });

  it('nutzt die vollständige Emoji-Datenquelle auch für bislang ungemappte Shortcodes', () => {
    const result = renderMarkdownWithKatex('Gesicht :grinning: Zustimmung :+1:');

    expect(result.html).toContain(
      'Gesicht <span class="markdown-emoji" title=":grinning:">😀</span>',
    );
    expect(result.html).toContain('Zustimmung <span class="markdown-emoji" title=":+1:">👍</span>');
  });

  it('ersetzt Emoji-Shortcodes nicht in Inline-Code oder Link-Zielen', () => {
    const result = renderMarkdownWithKatex(
      '[Start :rocket:](https://example.org/:apple:) `:apple:`',
    );

    expect(result.html).toContain('href="https://example.org/:apple:"');
    expect(result.html).toContain('target="_blank"');
    expect(result.html).toContain('rel="noopener noreferrer"');
    expect(result.html).toContain('referrerpolicy="no-referrer"');
    expect(result.html).toContain('data-markdown-link-kind="external"');
    expect(result.html).toContain('markdown-external-link-icon__svg');
    expect(result.html).toContain('<path d="M9.5 2.5h4v4"');
    expect(result.html).toContain(
      'href="https://example.org/:apple:" title="Externer Link: öffnet eine andere Website" target="_blank"',
    );
    expect(result.html).toContain(
      '<span class="sr-only">Externer Link: öffnet eine andere Website</span>',
    );
    expect(result.html).toContain('<code>:apple:</code>');
  });

  it('rendert Fettungen auch innerhalb von Listen korrekt', () => {
    const result = renderMarkdownWithKatex(
      [
        'Rechte:',
        '',
        '- **Auskunft** über Ihre Daten',
        '- **Berichtigung** unrichtiger Daten',
      ].join('\n'),
    );

    expect(result.html).toContain('<li><strong>Auskunft</strong> über Ihre Daten</li>');
    expect(result.html).toContain('<li><strong>Berichtigung</strong> unrichtiger Daten</li>');
  });
});

describe('renderMarkdownWithoutKatex', () => {
  it('rendert eingezäunte Codeblöcke als pre/code (ohne $-KaTeX)', () => {
    const html = renderMarkdownWithoutKatex('Text\n\n```json\n{"a":1}\n```\n');

    expect(html).toContain('data-markdown-code-block="true"');
    expect(html).toContain('data-markdown-code-copy="true"');
    expect(html).toContain('Code kopieren');
    expect(html).toContain('<pre><code class="hljs language-json">');
    expect(html).toContain('hljs-');
    // JSON wird in Spans zerlegt; Inhalt bleibt erkennbar.
    expect(html).toMatch(/"a"|&quot;a&quot;/);
    expect(html).toMatch(/hljs-(?:attr|number|string|literal|property)/);
    expect(html).not.toContain('katex');
  });

  it('behandelt Fences ohne Sprach-Tag standardmäßig als Python', () => {
    const html = renderMarkdownWithoutKatex('```\nprint(1)\n```\n');
    expect(html).toContain('data-markdown-code-copy="true"');
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
    expect(html).toMatch(/data-markdown-image-state="loading"/);
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
      '[intern](/de/datenschutz) [extern](https://example.org/info) [mail](mailto:test@example.org)',
    );
    expect(html).toContain('href="/de/datenschutz"');
    expect(html).toContain('href="https://example.org/info"');
    expect(html).toContain('href="mailto:test@example.org"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).toContain('data-markdown-link-kind="external"');
    expect(html).toContain('markdown-external-link-icon__svg');
    expect(html).toContain('<path d="M9.5 2.5h4v4"');
    expect(html).toContain(
      'href="https://example.org/info" title="Externer Link: öffnet eine andere Website" target="_blank"',
    );
    expect(html).toContain(
      '<span class="sr-only">Externer Link: öffnet eine andere Website</span>',
    );
    expect(html).not.toContain(
      'href="/de/datenschutz" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"',
    );
  });

  it('markiert absolute Links zur eigenen Domain nicht als extern', () => {
    const html = renderMarkdownWithoutKatex(
      '[home](https://arsnova.eu/info) [www](https://www.arsnova.eu/impressum)',
    );

    expect(html).toContain('href="https://arsnova.eu/info"');
    expect(html).toContain('href="https://www.arsnova.eu/impressum"');
    expect(html).not.toContain('data-markdown-link-kind="external"');
    expect(html).not.toContain('markdown-external-link-icon__svg');
    expect(html).not.toContain('Externer Link: öffnet eine andere Website');
    expect(html).not.toContain('target="_blank"');
  });

  it('ergänzt vorhandene Linktitel bei externen Links um den Extern-Hinweis', () => {
    const html = renderMarkdownWithoutKatex('[Video](https://example.org/demo "Zum Video")');

    expect(html).toContain(
      'href="https://example.org/demo" title="Zum Video · Externer Link: öffnet eine andere Website" target="_blank"',
    );
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

  it('erlaubt lokale Loopback-HTTP-Bildquellen weiterhin im lockeren Bildmodus', () => {
    const html = renderMarkdownWithoutKatex('![lokal](http://127.0.0.1:4200/banner.png)');

    expect(html).toContain('<img');
    expect(html).toContain('src="http://127.0.0.1:4200/banner.png"');
  });

  it('erlaubt Blob-Bildquellen im lockeren Bildmodus', () => {
    const html = renderMarkdownWithoutKatex('![lokal](blob:http://localhost:4200/banner)');

    expect(html).toContain('<img');
    expect(html).toContain('src="blob:http://localhost:4200/banner"');
  });

  it('blockiert unsichere data-URLs ausserhalb sicherer Bildformate', () => {
    const html = renderMarkdownWithoutKatex(
      '![x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    );

    expect(html).toContain('<p>x</p>');
    expect(html).not.toContain('<img ');
  });

  it('ersetzt Emoji-Shortcodes nur in sichtbarem Text, nicht in Bild-Alttexten', () => {
    const html = renderMarkdownWithoutKatex(
      'Text :bulb: ![Alt :apple:](https://example.org/x.svg)',
    );

    expect(html).toContain('Text <span class="markdown-emoji" title=":bulb:">💡</span>');
    expect(html).toContain('alt="Alt :apple:"');
    expect(html).toContain('title="Alt :apple:"');
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
