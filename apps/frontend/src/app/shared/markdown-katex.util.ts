import katex from 'katex';
import { marked } from 'marked';

export interface MarkdownRenderResult {
  html: string;
  katexError: string | null;
}

export function renderMarkdownWithKatex(source = ''): MarkdownRenderResult {
  const input = source;
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
      const katexErrorLabel = $localize`KaTeX-Fehler`;
      if (!katexError) {
        katexError = message;
      }
      return storeRenderedMath(
        `<span class="markdown-katex-error">${katexErrorLabel}: ${escapeHtml(message)}</span>`,
      );
    }
  };

  const withBlockMath = input.replaceAll(/\$\$([\s\S]+?)\$\$/g, (_, expression: string) =>
    renderExpression(expression, true),
  );
  const withInlineMath = withBlockMath.replaceAll(/\$([^$\n]+?)\$/g, (_, expression: string) =>
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
  renderer.link = ({ href, title, text }): string => {
    const safeHref = sanitizeMarkdownUrl(href, 'link');
    if (!safeHref) {
      return text;
    }
    const hrefEsc = escapeHtml(safeHref);
    const hasTitle = title !== undefined && title !== null && String(title).trim() !== '';
    const titleAttr = hasTitle ? ` title="${escapeHtml(String(title).trim())}"` : '';
    return `<a href="${hrefEsc}"${titleAttr}>${text}</a>`;
  };
  /** `alt` allein löst keinen Hover-Tooltip aus; `title` schon (optional explizit in `![](url "title")`). */
  renderer.image = ({ href, title, text }): string => {
    const safeHref = sanitizeMarkdownUrl(href, 'image');
    if (!safeHref) {
      return escapeHtml(text);
    }
    const hrefEsc = escapeHtml(safeHref);
    const altEsc = escapeHtml(text);
    const hasTitle = title !== undefined && title !== null && String(title).trim() !== '';
    const tooltip = hasTitle ? String(title).trim() : text;
    const titleEsc = escapeHtml(tooltip);
    return `<img src="${hrefEsc}" alt="${altEsc}" title="${titleEsc}" data-markdown-image-lightbox="true" />`;
  };
  return marked.parse(source, { renderer }) as string;
}

/** Markdown → HTML ohne KaTeX (kein `$…$`-Parsing). Für lange System-Prompts mit JSON-Beispielen. */
export function renderMarkdownWithoutKatex(source = ''): string {
  return parseMarkdownEscapingInlineHtml(source);
}

/**
 * Ersetzt MOTD-Bilder unter `/assets/...` oder `assets/...` durch absolute URLs relativ zur aktuellen
 * Build-Basis (z. B. `https://arsnova.eu/de/`). Das hält lokalisierte Builds und Admin-Preview konsistent.
 */
export function absolutizeMarkdownHtmlRootAssetImgSrc(html: string, origin: string): string {
  const base = origin.replace(/\/$/, '');
  if (!base) return html;
  return html
    .replaceAll(/src="\/(assets\/[^"]+)"/g, `src="${base}/$1"`)
    .replaceAll(/src="(assets\/[^"]+)"/g, `src="${base}/$1"`);
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
  let out = html.replaceAll(/src="(https?:\/\/[^"']+\/assets\/[^"']+)"/gi, (_full, url: string) => {
    return `src="${bump(url)}"`;
  });
  out = out.replaceAll(/src="(\/assets\/[^"']+)"/gi, (_full, path: string) => {
    return `src="${bump(path)}"`;
  });
  return out;
}

function mathPlaceholder(index: number): string {
  return `KATEXPLACEHOLDERTOKEN${index}`;
}

function sanitizeMarkdownUrl(
  href: string | null | undefined,
  type: 'link' | 'image',
): string | null {
  if (!href) return null;
  const value = href.trim();
  if (!value) return null;
  if (value.startsWith('#') || value.startsWith('?')) return value;
  if (value.startsWith('/')) {
    return value.startsWith('//') ? null : value;
  }
  if (value.startsWith('./') || value.startsWith('../')) return value;
  if (/^[^\s/:?#]+(?:\/[^\s?#]*)?(?:\?[^\s#]*)?(?:#.*)?$/.test(value)) return value;

  const schemeMatch = /^([a-zA-Z][a-zA-Z\d+.-]*):/.exec(value);
  if (!schemeMatch) return null;

  const scheme = schemeMatch[1].toLowerCase();
  const allowedSchemes =
    type === 'image' ? new Set(['https']) : new Set(['https', 'mailto', 'tel']);
  return allowedSchemes.has(scheme) ? value : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
