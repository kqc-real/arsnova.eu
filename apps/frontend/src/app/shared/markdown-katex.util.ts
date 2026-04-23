import katex from 'katex';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { renderMarkdownCodeBlockHtml } from './markdown-code-highlight';
import { MARKDOWN_EMOJI_SHORTCODE_MAP } from './markdown-emoji-shortcodes';

export interface MarkdownRenderResult {
  html: string;
  katexError: string | null;
}

export type MarkdownImagePolicy = 'external-https-only' | 'allow-relative-and-https';

const MARKDOWN_EMOJI_SHORTCODES = new Map(Object.entries(MARKDOWN_EMOJI_SHORTCODE_MAP));

const EMOJI_SHORTCODE_PATTERN = /:([a-z0-9_+-]+):/gi;

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
    // Quiz-/Session-Inhalte sollen standardmäßig nur HTTPS-Bilder akzeptieren.
    // Relative Asset-Pfade bleiben eine explizite Ausnahme für Demo-/Systeminhalte;
    // im lockeren Modus sind in Dev zusätzlich Loopback-HTTP-Bilder erlaubt.
    imagePolicy: options?.imagePolicy ?? 'external-https-only',
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
  renderer.text = ({ text }) => renderMarkdownText(text);
  renderer.link = ({ href, title, text }): string => {
    const safeHref = sanitizeMarkdownUrl(href, 'link');
    if (!safeHref) {
      return text;
    }
    const hrefEsc = escapeHtml(safeHref);
    const hasTitle = title !== undefined && title !== null && String(title).trim() !== '';
    const titleAttr = hasTitle ? ` title="${escapeHtml(String(title).trim())}"` : '';
    const renderedText = looksLikeRenderedHtml(text) ? text : renderMarkdownText(text);
    return `<a href="${hrefEsc}"${titleAttr} target="_blank" rel="noopener noreferrer">${renderedText}</a>`;
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
    return `<img src="${hrefEsc}" alt="${altEsc}" title="${titleEsc}" loading="eager" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer" data-markdown-image-lightbox="true" />`;
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

function renderMarkdownText(value: string): string {
  let html = '';
  let lastIndex = 0;
  for (const match of value.matchAll(EMOJI_SHORTCODE_PATTERN)) {
    const full = match[0];
    const code = match[1];
    const index = match.index ?? 0;
    const emoji = MARKDOWN_EMOJI_SHORTCODES.get(code.toLowerCase());
    if (!emoji) {
      continue;
    }

    html += escapeHtml(value.slice(lastIndex, index));
    html += `<span class="markdown-emoji" title="${escapeHtml(full)}">${emoji}</span>`;
    lastIndex = index + full.length;
  }

  html += escapeHtml(value.slice(lastIndex));
  return html;
}

function looksLikeRenderedHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
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
  if (type === 'image') {
    if (scheme === 'https') return value;
    if (
      scheme === 'http' &&
      imagePolicy === 'allow-relative-and-https' &&
      isLoopbackHttpUrl(value)
    ) {
      return value;
    }
    if (imagePolicy === 'allow-relative-and-https' && scheme === 'blob') {
      return value;
    }
    if (imagePolicy === 'allow-relative-and-https' && isSafeInlineDataImageUrl(value)) {
      return value;
    }
    return null;
  }

  const allowedSchemes = new Set(['https', 'mailto', 'tel']);
  return allowedSchemes.has(scheme) ? value : null;
}

function isLoopbackHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:') return false;

    const host = url.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]'
    );
  } catch {
    return false;
  }
}

function isSafeInlineDataImageUrl(value: string): boolean {
  return /^data:image\/(?:png|apng|avif|gif|jpeg|jpg|webp|bmp);base64,[a-z0-9+/=]+$/i.test(value);
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
      'loading',
      'decoding',
      'crossorigin',
      'referrerpolicy',
      'class',
      'target',
      'rel',
      'aria-hidden',
      'xmlns',
      'encoding',
      // KaTeX: Layout über tausende inline style=… auf span; ohne diese wirken Formeln „kaputt“/abgeschnitten.
      'style',
      // MathML: <math display="block"> …
      'display',
    ],
    // URL-Policies werden bereits vor dem HTML-Bau im Renderer erzwungen; hier müssen wir nur
    // verhindern, dass DOMPurify zulässige Preview-Bildquellen wie `blob:` nachträglich entfernt.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|blob):|data:image\/(?:png|apng|avif|gif|jpeg|jpg|webp|bmp);base64,|[^a-z]|[a-z+.\-.]+(?:[^a-z+.\-:]|$))/i,
  });
}
