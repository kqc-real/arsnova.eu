import katex from 'katex';
import { marked } from 'marked';

export interface MarkdownRenderResult {
  html: string;
  katexError: string | null;
}

export function renderMarkdownWithKatex(source: string): MarkdownRenderResult {
  const input = source ?? '';
  let katexError: string | null = null;
  const renderedMath: string[] = [];

  const storeRenderedMath = (html: string): string => {
    const index = renderedMath.push(html) - 1;
    return mathPlaceholder(index);
  };

  const renderExpression = (expression: string, displayMode: boolean): string => {
    try {
      return storeRenderedMath(
        katex.renderToString(expression.trim(), {
          displayMode,
          throwOnError: true,
          strict: 'ignore',
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : $localize`Ungültige KaTeX-Syntax.`;
      if (!katexError) {
        katexError = message;
      }
      return storeRenderedMath(
        `<span class="markdown-katex-error">${$localize`KaTeX-Fehler`}: ${escapeHtml(message)}</span>`,
      );
    }
  };

  const withBlockMath = input.replace(/\$\$([\s\S]+?)\$\$/g, (_, expression: string) =>
    renderExpression(expression, true),
  );
  const withInlineMath = withBlockMath.replace(/\$([^$\n]+?)\$/g, (_, expression: string) =>
    renderExpression(expression, false),
  );

  const markdownHtml = parseMarkdownEscapingInlineHtml(withInlineMath);
  const html = renderedMath.reduce(
    (current, value, index) => current.replaceAll(mathPlaceholder(index), value),
    markdownHtml,
  );
  return { html, katexError };
}

function parseMarkdownEscapingInlineHtml(source: string): string {
  const renderer = new marked.Renderer();
  renderer.html = ({ text }) => escapeHtml(text);
  /** `alt` allein löst keinen Hover-Tooltip aus; `title` schon (optional explizit in `![](url "title")`). */
  renderer.image = ({ href, title, text }): string => {
    const hrefEsc = escapeHtml(href);
    const altEsc = escapeHtml(text);
    const hasTitle = title !== undefined && title !== null && String(title).trim() !== '';
    const tooltip = hasTitle ? String(title).trim() : text;
    const titleEsc = escapeHtml(tooltip);
    return `<img src="${hrefEsc}" alt="${altEsc}" title="${titleEsc}" />`;
  };
  return marked.parse(source, { renderer }) as string;
}

/** Markdown → HTML ohne KaTeX (kein `$…$`-Parsing). Für lange System-Prompts mit JSON-Beispielen. */
export function renderMarkdownWithoutKatex(source: string): string {
  return parseMarkdownEscapingInlineHtml(source ?? '');
}

/**
 * Ersetzt `src="/assets/…"` durch absolute URLs, damit MOTD-Bilder in `[innerHTML]` zuverlässig
 * von der Site-Root geladen werden (lokalisiertes `&lt;base href="/de/"&gt;` o. ä.).
 */
export function absolutizeMarkdownHtmlRootAssetImgSrc(html: string, origin: string): string {
  const base = origin.replace(/\/$/, '');
  if (!base) return html;
  return html.replace(/src="\/(assets\/[^"]+)"/g, `src="${base}/$1"`);
}

/**
 * Hängt `cv=&lt;contentVersion&gt;` an MOTD-Bilder unter `/assets/…` an.
 * Der PWA-Service-Worker cached `assets/**` — gleiche URL kann nach Updates einen veralteten
 * Cache-Treffer liefern; neues `contentVersion` (z. B. nach Admin-Speichern) erzwingt einen frischen Fetch.
 */
export function appendMotdContentVersionToAssetImgSrc(
  html: string,
  contentVersion: number,
): string {
  const cv = String(contentVersion);
  const bump = (url: string): string => {
    if (/[?&]cv=\d+/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}cv=${cv}`;
  };
  let out = html.replace(/src="(https?:\/\/[^"]+\/assets\/[^"]+)"/gi, (_full, url: string) => {
    return `src="${bump(url)}"`;
  });
  out = out.replace(/src="(\/assets\/[^"]+)"/gi, (_full, path: string) => {
    return `src="${bump(path)}"`;
  });
  return out;
}

function mathPlaceholder(index: number): string {
  return `KATEXPLACEHOLDERTOKEN${index}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
