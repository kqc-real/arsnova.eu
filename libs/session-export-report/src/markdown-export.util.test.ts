import { describe, expect, it } from 'vitest';
import { renderExportQuestionHtml } from './markdown-export.util';

describe('renderExportQuestionHtml', () => {
  it('rendert Formeln, Bilder, Code und Lehrer-Tipps vollständig', () => {
    const raw = `### In welcher Sprache ist dieser Code?

> **Unterrichtsidee:** Nutze das als Erkennungsimpuls für Informatik.

\`\`\`java
void draw() {}
\`\`\`

![Die Zahl Pi](https://example.org/pi.gif)`;

    const html = renderExportQuestionHtml(raw);
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('example.org/pi.gif');
    expect(html).toContain('report-inline-image--gif');
    expect(html).toContain('report-blockquote-label');
    expect(html).toContain('report-blockquote--teaching');
    expect(html).toMatch(/report-blockquote-label">Unterrichtsidee<\/p>/);
    expect(html).not.toMatch(/<strong>Unterrichtsidee:<\/strong>/);
    expect(html).toContain('Nutze das als Erkennungsimpuls');
  });

  it('macht relative Asset-Bilder absolut', () => {
    const html = renderExportQuestionHtml('![Demo](/assets/demo/x.png)', {
      assetBaseUrl: 'https://arsnova.eu/de',
    });
    expect(html).toContain('src="https://arsnova.eu/de/assets/demo/x.png"');
  });
});
