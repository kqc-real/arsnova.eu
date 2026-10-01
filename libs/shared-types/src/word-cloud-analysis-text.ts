/**
 * Übergangslösung bis #498: Markdown/KaTeX vor Wortwolken-Analysen aufbereiten.
 *
 * Grundlage ist `marked.lexer` (eigene `Marked`-Instanz). Ein Token-Walker überspringt
 * ausgeschlossene Inhalte (Links, Bilder, Code, KaTeX, …), reduziert Formatierungen auf
 * Text und setzt Segmentgrenzen.
 *
 * Projektspezifika ohne eigenen Markdown-Parser:
 * - KaTeX über marked-Tokenizer-Erweiterungen (nur außerhalb von Code/Links)
 * - Q&A-Schwärzungen als harte Analysegrenzen vor dem Lexer
 *
 * Unvollständige Formel-Delimiter: konservativ bis Zeilen- bzw. Stringende ausschließen.
 */

import { Marked, type Token, type Tokens } from 'marked';
import { QA_REDACTION_CHAR, QA_REDACTION_PLACEHOLDER_LEGACY } from './qa-redaction';
import { WORD_CLOUD_MAX_ITEM_TEXT_CHARS } from './word-cloud-normalization';

/** Version der Textaufbereitung; gehört in Analyse-/Cache-Schlüssel. */
export const WORD_CLOUD_ANALYSIS_TEXT_VERSION = '3';

export type PrepareWordCloudAnalysisTextResult = {
  readonly segments: string[];
};

const BOUNDARY = '\uE011';
const MAX_MARKED_NESTING = 48;
const PREPARE_CACHE_MAX_ENTRIES = 512;
const MAX_UNICODE_CODE_POINT = 0x10ffff;

const EMOJI_SHORTCODE_PATTERN = /:([a-z0-9_+-]+):/gi;
const UNICODE_EMOJI_PATTERN =
  /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Emoji_Presentation}](?:\uFE0F|\u200D[\p{Extended_Pictographic}\p{Emoji_Presentation}])*)/gu;
const BARE_URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()[\]{}|"']+/gi;
const HTML_ENTITY_PATTERN = /&(?:#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g;

const EMPHASIS_HTML_TAGS = new Set(['em', 'i', 'strong', 'b', 's', 'strike', 'del', 'u', 'mark']);
const EXCLUDE_HTML_TAGS = new Set(['sub', 'sup', 'code', 'pre', 'script', 'style', 'kbd', 'samp']);
const BREAK_HTML_TAGS = new Set(['br', 'hr', 'img']);

type SegmentBuilder = {
  segments: string[];
  buffer: string;
  excludeDepth: number;
  nesting: number;
};

type KatexToken = {
  type: 'katex';
  raw: string;
  text: string;
};

const prepareCache = new Map<string, PrepareWordCloudAnalysisTextResult>();

let analysisMarked: Marked | null = null;

function getAnalysisMarked(): Marked {
  if (analysisMarked) {
    return analysisMarked;
  }
  const instance = new Marked();
  instance.use({
    gfm: true,
    breaks: false,
    extensions: [
      {
        name: 'katexBlock',
        level: 'block',
        start(src: string) {
          if (src.startsWith('$$')) {
            return 0;
          }
          if (src.startsWith('\\[')) {
            return 0;
          }
          return -1;
        },
        tokenizer(src: string): KatexToken | undefined {
          const display = /^\$\$([\s\S]*?)\$\$/.exec(src);
          if (display) {
            return { type: 'katex', raw: display[0], text: display[1] ?? '' };
          }
          const bracket = /^\\\[([\s\S]*?)\\\]/.exec(src);
          if (bracket) {
            return { type: 'katex', raw: bracket[0], text: bracket[1] ?? '' };
          }
          if (src.startsWith('$$')) {
            return { type: 'katex', raw: src, text: src.slice(2) };
          }
          if (src.startsWith('\\[')) {
            return { type: 'katex', raw: src, text: src.slice(2) };
          }
          return undefined;
        },
      },
      {
        name: 'katexInline',
        level: 'inline',
        start(src: string) {
          const dollar = src.indexOf('$');
          const paren = src.indexOf('\\(');
          const bracket = src.indexOf('\\[');
          const candidates = [dollar, paren, bracket].filter((index) => index >= 0);
          return candidates.length > 0 ? Math.min(...candidates) : -1;
        },
        tokenizer(src: string): KatexToken | undefined {
          if (src.startsWith('\\$')) {
            return undefined;
          }
          const display = /^\$\$([^$]*?)\$\$/.exec(src);
          if (display) {
            return { type: 'katex', raw: display[0], text: display[1] ?? '' };
          }
          const paren = /^\\\(([\s\S]*?)\\\)/.exec(src);
          if (paren) {
            return { type: 'katex', raw: paren[0], text: paren[1] ?? '' };
          }
          const bracket = /^\\\[([\s\S]*?)\\\]/.exec(src);
          if (bracket) {
            return { type: 'katex', raw: bracket[0], text: bracket[1] ?? '' };
          }
          const inline = /^\$([^$\n]+?)\$/.exec(src);
          if (inline) {
            return { type: 'katex', raw: inline[0], text: inline[1] ?? '' };
          }
          if (src.startsWith('$$')) {
            const lineEnd = findLineEnd(src, 2);
            return { type: 'katex', raw: src.slice(0, lineEnd), text: src.slice(2, lineEnd) };
          }
          if (src.startsWith('$')) {
            const lineEnd = findLineEnd(src, 1);
            return { type: 'katex', raw: src.slice(0, lineEnd), text: src.slice(1, lineEnd) };
          }
          if (src.startsWith('\\(')) {
            const lineEnd = findLineEnd(src, 2);
            return { type: 'katex', raw: src.slice(0, lineEnd), text: src.slice(2, lineEnd) };
          }
          if (src.startsWith('\\[')) {
            const lineEnd = findLineEnd(src, 2);
            return { type: 'katex', raw: src.slice(0, lineEnd), text: src.slice(2, lineEnd) };
          }
          return undefined;
        },
      },
    ],
  });
  analysisMarked = instance;
  return instance;
}

/**
 * Liefert analysierbare Textsegmente eines Beitrags.
 * Leere Segmente entfallen; ein komplett leeres Ergebnis bedeutet „Beitrag überspringen“.
 * Identische Eingaben (nach Clip) werden pro Prozess wiederverwendet.
 */
export function prepareWordCloudAnalysisText(source: string): PrepareWordCloudAnalysisTextResult {
  if (typeof source !== 'string' || source.length === 0) {
    return { segments: [] };
  }

  const clipped =
    source.length > WORD_CLOUD_MAX_ITEM_TEXT_CHARS
      ? source.slice(0, WORD_CLOUD_MAX_ITEM_TEXT_CHARS)
      : source;

  const cached = prepareCache.get(clipped);
  if (cached) {
    return cached;
  }

  const result = prepareWordCloudAnalysisTextUncached(clipped);
  rememberPrepared(clipped, result);
  return result;
}

/** Joined cleaned text for embeddings / single-string consumers; segments stay separated. */
export function joinWordCloudAnalysisSegments(segments: readonly string[]): string {
  return segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('\n');
}

/** Test-Hilfsfunktion: leert den Aufbereitungs-Cache. */
export function clearWordCloudAnalysisTextCacheForTests(): void {
  prepareCache.clear();
}

function prepareWordCloudAnalysisTextUncached(clipped: string): PrepareWordCloudAnalysisTextResult {
  const prepared = replaceRedactionBoundaries(clipped);

  let tokens: Token[];
  try {
    tokens = getAnalysisMarked().lexer(prepared);
  } catch {
    return finalizeSegments([sanitizeInlineText(prepared)]);
  }

  const builder: SegmentBuilder = {
    segments: [],
    buffer: '',
    excludeDepth: 0,
    nesting: 0,
  };
  walkMarkedTokens(tokens, builder);
  flushSegment(builder);
  return finalizeSegments(builder.segments);
}

function rememberPrepared(key: string, result: PrepareWordCloudAnalysisTextResult): void {
  if (prepareCache.size >= PREPARE_CACHE_MAX_ENTRIES) {
    const oldest = prepareCache.keys().next().value;
    if (typeof oldest === 'string') {
      prepareCache.delete(oldest);
    }
  }
  prepareCache.set(key, result);
}

function finalizeSegments(parts: readonly string[]): PrepareWordCloudAnalysisTextResult {
  const segments: string[] = [];
  for (const part of parts) {
    for (const piece of part.split(BOUNDARY)) {
      const cleaned = collapseWhitespace(piece).trim();
      if (cleaned.length > 0) {
        segments.push(cleaned);
      }
    }
  }
  return { segments };
}

/** Q&A-Schwärzungen als harte Grenzen (projektspezifisch). */
function replaceRedactionBoundaries(source: string): string {
  let next = source.split(QA_REDACTION_PLACEHOLDER_LEGACY).join(BOUNDARY);
  if (next.includes(QA_REDACTION_CHAR)) {
    next = next.replaceAll(new RegExp(`${QA_REDACTION_CHAR}+`, 'g'), BOUNDARY);
  }
  return next;
}

function findLineEnd(source: string, from: number): number {
  const nl = source.indexOf('\n', from);
  return nl === -1 ? source.length : nl;
}

/** Kleiner Walker über marked-Tokens: ausschließen / Text behalten / Grenzen setzen. */
function walkMarkedTokens(tokens: readonly Token[] | undefined, builder: SegmentBuilder): void {
  if (!tokens || tokens.length === 0) {
    return;
  }
  if (builder.nesting >= MAX_MARKED_NESTING) {
    flushSegment(builder);
    return;
  }
  builder.nesting += 1;

  for (const token of tokens) {
    switch (token.type) {
      case 'space':
      case 'hr':
      case 'def':
      case 'code':
      case 'katex':
        flushSegment(builder);
        break;
      case 'heading':
      case 'paragraph':
      case 'blockquote':
        flushSegment(builder);
        walkMarkedTokens(
          (token as Tokens.Heading | Tokens.Paragraph | Tokens.Blockquote).tokens,
          builder,
        );
        flushSegment(builder);
        break;
      case 'list': {
        const list = token as Tokens.List;
        flushSegment(builder);
        for (const item of list.items ?? []) {
          flushSegment(builder);
          walkMarkedTokens(item.tokens, builder);
          flushSegment(builder);
        }
        flushSegment(builder);
        break;
      }
      case 'table': {
        const table = token as Tokens.Table;
        flushSegment(builder);
        for (const cell of table.header ?? []) {
          flushSegment(builder);
          walkMarkedTokens(cell.tokens, builder);
          flushSegment(builder);
        }
        for (const row of table.rows ?? []) {
          for (const cell of row) {
            flushSegment(builder);
            walkMarkedTokens(cell.tokens, builder);
            flushSegment(builder);
          }
        }
        flushSegment(builder);
        break;
      }
      case 'link':
      case 'image':
      case 'codespan':
        flushBoundary(builder);
        break;
      case 'strong':
      case 'em':
      case 'del':
        walkMarkedTokens((token as Tokens.Strong | Tokens.Em | Tokens.Del).tokens, builder);
        break;
      case 'escape':
        appendText(builder, (token as Tokens.Escape).text);
        break;
      case 'text': {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          walkMarkedTokens(textToken.tokens, builder);
        } else {
          appendText(builder, textToken.text);
        }
        break;
      }
      case 'html':
        handleHtmlToken(token as Tokens.HTML, builder);
        break;
      case 'br':
        flushBoundary(builder);
        break;
      default:
        if ('tokens' in token && Array.isArray((token as { tokens?: Token[] }).tokens)) {
          walkMarkedTokens((token as { tokens: Token[] }).tokens, builder);
        }
        break;
    }
  }

  builder.nesting -= 1;
}

function handleHtmlToken(token: Tokens.HTML, builder: SegmentBuilder): void {
  const raw = token.raw ?? token.text ?? '';
  const open = /^<([a-zA-Z][\w:-]*)\b[^>]*>/.exec(raw);
  const close = /^<\/([a-zA-Z][\w:-]*)\s*>/.exec(raw);
  const selfClosing = /^<([a-zA-Z][\w:-]*)\b[^>]*\/>/.exec(raw);

  if (selfClosing) {
    const name = selfClosing[1]!.toLowerCase();
    if (EXCLUDE_HTML_TAGS.has(name) || BREAK_HTML_TAGS.has(name)) {
      flushBoundary(builder);
    }
    return;
  }

  if (open) {
    const name = open[1]!.toLowerCase();
    if (BREAK_HTML_TAGS.has(name)) {
      flushBoundary(builder);
      return;
    }
    if (EXCLUDE_HTML_TAGS.has(name)) {
      builder.excludeDepth += 1;
      flushBoundary(builder);
      return;
    }
    if (EMPHASIS_HTML_TAGS.has(name)) {
      return;
    }
    return;
  }

  if (close) {
    const name = close[1]!.toLowerCase();
    if (EXCLUDE_HTML_TAGS.has(name) && builder.excludeDepth > 0) {
      builder.excludeDepth -= 1;
      flushBoundary(builder);
    }
    return;
  }

  flushBoundary(builder);
}

function appendText(builder: SegmentBuilder, value: string): void {
  if (builder.excludeDepth > 0 || !value) {
    return;
  }
  const sanitized = sanitizeInlineText(value);
  if (!sanitized) {
    if (value.includes(BOUNDARY)) {
      flushBoundary(builder);
    }
    return;
  }
  if (sanitized.includes(BOUNDARY)) {
    const parts = sanitized.split(BOUNDARY);
    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i]) {
        builder.buffer += parts[i]!;
      }
      if (i < parts.length - 1) {
        flushBoundary(builder);
      }
    }
    return;
  }
  builder.buffer += sanitized;
}

function flushBoundary(builder: SegmentBuilder): void {
  flushSegment(builder);
}

function flushSegment(builder: SegmentBuilder): void {
  const cleaned = collapseWhitespace(builder.buffer).trim();
  builder.buffer = '';
  if (cleaned.length > 0) {
    builder.segments.push(cleaned);
  }
}

function sanitizeInlineText(value: string): string {
  let next = value;
  next = next.replace(EMOJI_SHORTCODE_PATTERN, BOUNDARY);
  next = next.replace(UNICODE_EMOJI_PATTERN, BOUNDARY);
  next = next.replace(BARE_URL_PATTERN, BOUNDARY);
  next = decodeBasicEntities(next);
  // marked kann ungültige numerische Entities bereits zu U+FFFD auflösen
  next = next.replaceAll('\uFFFD', BOUNDARY);
  return next;
}

function decodeBasicEntities(value: string): string {
  return value.replace(HTML_ENTITY_PATTERN, (entity) => {
    const named: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&nbsp;': ' ',
    };
    if (named[entity]) {
      return named[entity]!;
    }
    if (entity.startsWith('&#x') || entity.startsWith('&#X')) {
      return codePointToChar(Number.parseInt(entity.slice(3, -1), 16)) ?? BOUNDARY;
    }
    if (entity.startsWith('&#')) {
      return codePointToChar(Number.parseInt(entity.slice(2, -1), 10)) ?? BOUNDARY;
    }
    return BOUNDARY;
  });
}

function codePointToChar(code: number): string | null {
  if (!Number.isInteger(code) || code < 0 || code > MAX_UNICODE_CODE_POINT) {
    return null;
  }
  // Surrogate-Halbwerte sind allein keine gültigen Codepoints für fromCodePoint.
  if (code >= 0xd800 && code <= 0xdfff) {
    return null;
  }
  try {
    return String.fromCodePoint(code);
  } catch {
    return null;
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ');
}
