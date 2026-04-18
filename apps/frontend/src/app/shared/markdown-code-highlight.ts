import hljs from 'highlight.js/lib/common';
import type { Tokens } from 'marked';

/** Standard-Sprache, wenn beim Fence keine Sprache angegeben ist (`` ``` `` ohne Tag). */
export const DEFAULT_MARKDOWN_FENCE_LANGUAGE = 'python';

/**
 * Übliche Kurz-IDs aus Markdown-Fences (` ```js `) → highlight.js-Sprachnamen.
 */
const HLJS_LANG_ALIASES: Readonly<Record<string, string>> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  yml: 'yaml',
  sh: 'bash',
  zsh: 'bash',
  ksh: 'bash',
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Wie marked: erste „Wort“-Zeichenkette aus der Sprachzeile für `language-…`. */
function fenceLanguageClassToken(lang: string | undefined): string {
  const first = (lang ?? '').match(/^\S+/)?.[0];
  if (!first) return '';
  return `language-${escapeHtml(first)}`;
}

function resolveHljsLanguage(raw: string | undefined): string | null {
  const key = raw?.trim().match(/^\S+/)?.[0]?.toLowerCase();
  if (!key) return null;
  const name = HLJS_LANG_ALIASES[key] ?? key;
  return hljs.getLanguage(name) ? name : null;
}

/**
 * HTML für einen Markdown-Codeblock (` ```lang ` bzw. eingerückt), inkl. Syntax-Highlighting.
 */
export function renderMarkdownCodeBlockHtml({ text, lang }: Tokens.Code): string {
  const normalized = text.replace(/\n$/, '') + '\n';
  const body = normalized.replace(/\n$/, '');

  const explicitLang = (lang ?? '').trim().length > 0;

  let highlighted: string;
  try {
    const resolved = explicitLang
      ? resolveHljsLanguage(lang)
      : resolveHljsLanguage(DEFAULT_MARKDOWN_FENCE_LANGUAGE);
    if (resolved) {
      highlighted = hljs.highlight(body, { language: resolved }).value;
    } else if (explicitLang) {
      highlighted = hljs.highlightAuto(body).value;
    } else {
      highlighted = hljs.highlight(body, { language: 'plaintext' }).value;
    }
  } catch {
    highlighted = escapeHtml(body);
  }

  const langClass = explicitLang
    ? fenceLanguageClassToken(lang)
    : `language-${escapeHtml(DEFAULT_MARKDOWN_FENCE_LANGUAGE)}`;
  const classes = ['hljs', langClass].filter(Boolean).join(' ');
  return `<pre><code class="${classes}">${highlighted}</code></pre>\n`;
}
