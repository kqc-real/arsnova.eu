import katex from 'katex';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { renderMarkdownCodeBlockHtml } from './markdown-code-highlight';

export interface MarkdownRenderResult {
  html: string;
  katexError: string | null;
}

export type MarkdownImagePolicy = 'external-https-only' | 'allow-relative-and-https';

/**
 * Bereinigt typische Nutzer-/Escape-Artefakte vor KaTeX.
 * `\\n` (Backslash + „n“) ist in KaTeX keine gültige Sequenz und erzeugt „Undefined control sequence: \\n“.
 * Commands wie `\\neq`, `\\nabla`, `\\not`, `\\newline` bleiben erhalten (nach `\\n` folgt ein Buchstabe).
 */
function normalizeMathExpressionBeforeKatex(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\\n(?![a-zA-Z])/g, ' ');
  return s.trim();
}

export function renderMarkdownWithKatex(
  source = '',
  options?: { imagePolicy?: MarkdownImagePolicy },
): MarkdownRenderResult {
  const input = source;
  let katexError: string | null = null;
  const renderedMath: string[] = [];

  const storeRenderedMath = (html: string): string => {
    const index = renderedMath.push(html) - 1;
    return mathPlaceholder(index);
  };

  const renderExpression = (expression: string, displayMode: boolean): string => {
    const normalized = normalizeMathExpressionBeforeKatex(expression);
    try {
      return storeRenderedMath(
        katex.renderToString(normalized, {
          displayMode,
          throwOnError: true,
          strict: 'warn',
          trust: false,
          maxExpand: 1000,
          maxSize: 20,
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

  const markdownHtml = parseMarkdownEscapingInlineHtml(withInlineMath, {
    imagePolicy: options?.imagePolicy ?? 'allow-relative-and-https',
  });
  const html = renderedMath.reduce(
    (current, value, index) => current.replaceAll(mathPlaceholder(index), value),
    markdownHtml,
  );
  return { html: sanitizeMarkdownHtml(html), katexError };
}

function parseMarkdownEscapingInlineHtml(
  source: string,
  options: { imagePolicy: MarkdownImagePolicy },
): string {
  const renderer = new marked.Renderer();
  renderer.code = (token) => renderMarkdownCodeBlockHtml(token);
  renderer.html = ({ text }) => escapeHtml(text);
  renderer.link = ({ href, title, text }): string => {
    const safeHref = sanitizeMarkdownUrl(href, 'link');
    if (!safeHref) {
      return text;
    }
    const hrefEsc = escapeHtml(safeHref);
    const hasTitle = title !== undefined && title !== null && String(title).trim() !== '';
    const titleAttr = hasTitle ? ` title="${escapeHtml(String(title).trim())}"` : '';
    const isExternalHttp = /^https?:\/\//i.test(safeHref);
    const relAttr = isExternalHttp ? ` rel="noopener noreferrer"` : '';
    return `<a href="${hrefEsc}"${titleAttr}${relAttr}>${text}</a>`;
  };
  /** `alt` allein löst keinen Hover-Tooltip aus; `title` schon (optional explizit in `![](url "title")`). */
  renderer.image = ({ href, title, text }): string => {
    const safeHref = sanitizeMarkdownUrl(href, 'image', options.imagePolicy);
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
export function renderMarkdownWithoutKatex(
  source = '',
  options?: { imagePolicy?: MarkdownImagePolicy },
): string {
  return sanitizeMarkdownHtml(
    parseMarkdownEscapingInlineHtml(source, {
      imagePolicy: options?.imagePolicy ?? 'allow-relative-and-https',
    }),
  );
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
  imagePolicy: MarkdownImagePolicy = 'allow-relative-and-https',
): string | null {
  if (!href) return null;
  const value = href.trim();
  if (!value) return null;
  if (value.startsWith('#') || value.startsWith('?')) return value;
  if (type === 'link') {
    if (value.startsWith('/')) {
      return value.startsWith('//') ? null : value;
    }
    if (value.startsWith('./') || value.startsWith('../')) return value;
    if (/^[^\s/:?#]+(?:\/[^\s?#]*)?(?:\?[^\s#]*)?(?:#.*)?$/.test(value)) return value;
  }
  if (type === 'image' && imagePolicy === 'allow-relative-and-https') {
    if (value.startsWith('/')) {
      return value.startsWith('//') ? null : value;
    }
    if (value.startsWith('./') || value.startsWith('../')) return value;
    if (/^[^\s/:?#]+(?:\/[^\s?#]*)?(?:\?[^\s#]*)?(?:#.*)?$/.test(value)) return value;
  }

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

function sanitizeMarkdownHtml(html: string): string {
  // SSR: Auf dem Server existiert kein DOM. Unsere Render-Pipeline escaped inline HTML (renderer.html)
  // und erzwingt URL-Policies für Links/Bilder; DOMPurify wird daher nur im Browser angewendet.
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'hr',
      'strong',
      'em',
      's',
      'code',
      'pre',
      'blockquote',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'a',
      'img',
      'span',
      // KaTeX (MathML + Annotation) – für A11y und Tests.
      'math',
      'semantics',
      'mrow',
      'mi',
      'mo',
      'mn',
      'msup',
      'msub',
      'mfrac',
      'msqrt',
      'mroot',
      'mtext',
      'mspace',
      'mtable',
      'mtr',
      'mtd',
      'mover',
      'munder',
      'munderover',
      'mstyle',
      'annotation',
    ],
    ALLOWED_ATTR: [
      'href',
      'title',
      'src',
      'alt',
      'data-markdown-image-lightbox',
      'class',
      'rel',
      'aria-hidden',
      'xmlns',
      'encoding',
      // KaTeX: Layout über tausende inline style=… auf span; ohne diese wirken Formeln „kaputt“/abgeschnitten.
      'style',
      // MathML: <math display="block"> …
      'display',
    ],
  });
}
