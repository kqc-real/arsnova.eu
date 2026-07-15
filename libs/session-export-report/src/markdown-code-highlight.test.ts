import { describe, expect, it } from 'vitest';
import { renderExportMarkdownCodeBlockHtml } from './markdown-code-highlight';

describe('renderExportMarkdownCodeBlockHtml', () => {
  it('hebt Java-Code mit hljs hervor', () => {
    const html = renderExportMarkdownCodeBlockHtml({
      type: 'code',
      raw: '```java\nvoid draw() {}\n```',
      text: 'void draw() {}\n',
      lang: 'java',
    });
    expect(html).toContain('class="hljs');
    expect(html).toContain('<span class="hljs-keyword">void</span>');
  });
});
