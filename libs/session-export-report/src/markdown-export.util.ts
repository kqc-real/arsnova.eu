import katex from 'katex';
import { marked } from 'marked';
import { replaceEmojiShortcodes } from './emoji-shortcode.util';
import { renderExportMarkdownCodeBlockHtml } from './markdown-code-highlight';

export interface RenderExportMarkdownOptions {
  /** Basis-URL für relative Bildpfade (`/assets/…`). */
  assetBaseUrl?: string;
  blockquoteTeachingIdea?: string;
  blockquoteHint?: string;
  /** Unterrichtsideen aus dem Fragentext im Ergebnisbericht anzeigen. */
  includeTeachingNotes?: boolean;
}

export interface RenderExportMarkdownResult {
  html: string;
  katexError: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeMathExpressionBeforeKatex(raw: string): string {
  return raw
    .trim()
    .replace(/\\n(?![a-zA-Z])/g, ' ')
    .trim();
}

function mathPlaceholder(index: number): string {
  return `KATEXPLACEHOLDERTOKEN${index}`;
}

function sanitizeExportImageUrl(href: string | null | undefined): string | null {
  if (!href) return null;
  const value = href.trim();
  if (!value) return null;
  if (value.startsWith('//') || value.includes('\\')) return null;
  if (value.startsWith('/assets/') || value.startsWith('assets/')) return value;
  if (value.startsWith('/')) return value.startsWith('//') ? null : value;
  if (value.startsWith('./') || value.startsWith('../')) return value;
  const schemeMatch = /^([a-zA-Z][a-zA-Z\d+.-]*):/.exec(value);
  if (!schemeMatch) return null;
  const scheme = schemeMatch[1].toLowerCase();
  if (scheme === 'https') return value;
  if (scheme === 'http') {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host === '127.0.0.1' ||
        host === '0.0.0.0'
      ) {
        return value;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function sanitizeExportLinkUrl(href: string | null | undefined): string | null {
  if (!href) return null;
  const value = href.trim();
  if (!value) return null;
  if (value.startsWith('#') || value.startsWith('?')) return value;
  if (value.startsWith('/')) return value.startsWith('//') ? null : value;
  const schemeMatch = /^([a-zA-Z][a-zA-Z\d+.-]*):/.exec(value);
  if (!schemeMatch) return null;
  const scheme = schemeMatch[1].toLowerCase();
  return scheme === 'https' || scheme === 'mailto' || scheme === 'tel' ? value : null;
}

function parseExportMarkdown(source: string): string {
  const renderer = new marked.Renderer();
  renderer.code = (token) => renderExportMarkdownCodeBlockHtml(token);
  renderer.html = ({ text }) => escapeHtml(text);
  renderer.link = ({ href, title, text }) => {
    const safeHref = sanitizeExportLinkUrl(href);
    if (!safeHref) return escapeHtml(text);
    const titleAttr = title ? ` title="${escapeHtml(String(title))}"` : '';
    return `<a href="${escapeHtml(safeHref)}"${titleAttr}>${escapeHtml(text)}</a>`;
  };
  renderer.image = ({ href, title, text }) => {
    const safeHref = sanitizeExportImageUrl(href);
    if (!safeHref) return escapeHtml(text);
    const titleAttr = title ? ` title="${escapeHtml(String(title))}"` : '';
    const extension = safeHref.split(/[?#]/)[0]?.split('.').pop()?.toLowerCase() ?? '';
    const kindClass =
      extension === 'gif'
        ? ' report-inline-image--gif'
        : extension === 'svg'
          ? ' report-inline-image--svg'
          : '';
    return `<img class="report-inline-image${kindClass}" src="${escapeHtml(safeHref)}" alt="${escapeHtml(text)}"${titleAttr} loading="eager" decoding="async" />`;
  };
  return marked.parse(source, { renderer }) as string;
}

function removeUnsupportedPdfImagePrompts(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const plain = line
        .replaceAll(/[*_`[\]()]/g, ' ')
        .replaceAll(/\s+/g, ' ')
        .trim();
      return !/^(click|tap|klick|tippe|anklicken|ouvrir|haz clic|fare clic).*(full view|vollansicht|vue complète|vista completa|visualizzazione completa)/i.test(
        plain,
      );
    })
    .join('\n');
}

function removeTeachingNotes(source: string): string {
  return source.replace(/(^|\n)((?:>[^\n]*(?:\n|$))+)/g, (match, prefix: string, block: string) =>
    /Unterrichtsidee|Teaching idea/i.test(block) ? prefix : match,
  );
}

/** Relative Asset-Pfade in HTML absolut setzen (für PDF-Render). */
export function absolutizeExportAssetImgSrc(html: string, origin: string): string {
  const base = origin.replace(/\/$/, '');
  if (!base) return html;
  return html
    .replaceAll(/src="\/(assets\/[^"]+)"/g, `src="${base}/$1"`)
    .replaceAll(/src="(assets\/[^"]+)"/g, `src="${base}/$1"`);
}

export function renderExportMarkdownHtml(
  source = '',
  options: RenderExportMarkdownOptions = {},
): RenderExportMarkdownResult {
  const withoutTeachingNotes =
    options.includeTeachingNotes === false ? removeTeachingNotes(source) : source;
  const input = replaceEmojiShortcodes(removeUnsupportedPdfImagePrompts(withoutTeachingNotes));
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
      const message = error instanceof Error ? error.message : 'Ungültige KaTeX-Syntax.';
      if (!katexError) katexError = message;
      return storeRenderedMath(
        `<span class="markdown-katex-error">KaTeX-Fehler: ${escapeHtml(message)}</span>`,
      );
    }
  };

  const withBlockMath = input.replaceAll(/\$\$([\s\S]+?)\$\$/g, (_, expression: string) =>
    renderExpression(expression, true),
  );
  const withInlineMath = withBlockMath.replaceAll(/\$([^$\n]+?)\$/g, (_, expression: string) =>
    renderExpression(expression, false),
  );

  let html = renderedMath.reduce(
    (current, value, index) => current.replaceAll(mathPlaceholder(index), value),
    parseExportMarkdown(withInlineMath),
  );

  if (options.assetBaseUrl) {
    html = absolutizeExportAssetImgSrc(html, options.assetBaseUrl);
  }

  html = labelExportBlockquotes(html, options);

  return { html, katexError };
}

function labelExportBlockquotes(html: string, options: RenderExportMarkdownOptions): string {
  const teachingLabel = escapeHtml(options.blockquoteTeachingIdea ?? 'Unterrichtsidee');
  const hintLabel = escapeHtml(options.blockquoteHint ?? 'Hinweis für Lehrende');
  return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (_match, inner: string) => {
    const plain = inner.replace(/<[^>]+>/g, ' ').trim();
    if (
      /Unterrichtsidee|Teaching idea|Idée pédagogique|Idea didáctica|Idea didattica/i.test(plain)
    ) {
      return `<blockquote class="report-blockquote report-blockquote--teaching"><p class="report-blockquote-label">${teachingLabel}</p>${stripBlockquoteLabelPrefix(inner, 'teaching')}</blockquote>`;
    }
    if (
      /Hinweis(?: für Lehrende)?|Note for instructors|Note pour|Nota para|Nota per/i.test(plain)
    ) {
      return `<blockquote class="report-blockquote report-blockquote--hint"><p class="report-blockquote-label">${hintLabel}</p>${stripBlockquoteLabelPrefix(inner, 'hint')}</blockquote>`;
    }
    return `<blockquote class="report-blockquote">${inner}</blockquote>`;
  });
}

const TEACHING_LABEL_PREFIX =
  /^\s*(<p\b[^>]*>)(?:\s*<strong>)?\s*(?:Unterrichtsidee|Teaching idea|Idée pédagogique|Idea didáctica|Idea didattica)\s*:?\s*(?:<\/strong>)?\s*/i;
const HINT_LABEL_PREFIX =
  /^\s*(<p\b[^>]*>)(?:\s*<strong>)?\s*(?:Hinweis(?: für Lehrende)?|Note for instructors|Note pour les enseignant(?:e)?s|Nota para docentes|Nota per docenti)\s*:?\s*(?:<\/strong>)?\s*/i;

function stripBlockquoteLabelPrefix(inner: string, kind: 'teaching' | 'hint'): string {
  return inner.replace(kind === 'teaching' ? TEACHING_LABEL_PREFIX : HINT_LABEL_PREFIX, '$1');
}

/** Vollständiger Fragentext für Export inkl. Lehrer-Tipps (Unterrichtsidee). */
export function renderExportQuestionHtml(
  value: string,
  options: RenderExportMarkdownOptions = {},
): string {
  return renderExportMarkdownHtml(value.trim(), options).html;
}

export const EXPORT_REPORT_KATEX_CSS_URL =
  'https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css';

export const EXPORT_REPORT_HLJS_CSS_URL =
  'https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github.min.css';
