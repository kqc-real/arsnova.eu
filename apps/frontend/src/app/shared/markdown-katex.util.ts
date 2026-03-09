import katex from 'katex';
import { marked } from 'marked';

export interface MarkdownRenderResult {
  html: string;
  katexError: string | null;
}

export function renderMarkdownWithKatex(source: string): MarkdownRenderResult {
  const input = source ?? '';
  let katexError: string | null = null;

  const renderExpression = (expression: string, displayMode: boolean): string => {
    try {
      return katex.renderToString(expression.trim(), {
        displayMode,
        throwOnError: true,
        strict: 'ignore',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ungültige KaTeX-Syntax.';
      if (!katexError) {
        katexError = message;
      }
      return `<span class="markdown-katex-error">KaTeX-Fehler: ${escapeHtml(message)}</span>`;
    }
  };

  const withBlockMath = input.replace(/\$\$([\s\S]+?)\$\$/g, (_, expression: string) =>
    renderExpression(expression, true),
  );
  const withInlineMath = withBlockMath.replace(
    /\$([^$\n]+?)\$/g,
    (_, expression: string) => renderExpression(expression, false),
  );

  const html = marked.parse(withInlineMath) as string;
  return { html, katexError };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
