/**
 * Übergangslösung bis #498: Markdown/KaTeX vor Wortwolken-Analysen aufbereiten.
 *
 * Grundlage ist `marked.lexer`. Ein Token-Walker überspringt ausgeschlossene Inhalte
 * (Links, Bilder, Code, …), reduziert Formatierungen auf Text und setzt Segmentgrenzen.
 *
 * Zusätzlich vor dem Lexer — und nur dort, wo marked unzureichend ist:
 * - KaTeX-Delimiter (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`), weil marked z. B. `\(` als Escape zerlegt
 * - Q&A-Schwärzungen als harte Analysegrenzen
 *
 * Kein eigener Markdown-Parser: Code/Links/Listen/Tabellen kommen ausschließlich aus marked.
 * Unvollständige Formel-Delimiter: konservativ bis Zeilen- bzw. Stringende ausschließen.
 */

import { marked, type Token, type Tokens } from 'marked';
import { QA_REDACTION_CHAR, QA_REDACTION_PLACEHOLDER_LEGACY } from './qa-redaction.js';
import { WORD_CLOUD_MAX_ITEM_TEXT_CHARS } from './word-cloud-normalization.js';

/** Version der Textaufbereitung; gehört in Analyse-/Cache-Schlüssel. */
export const WORD_CLOUD_ANALYSIS_TEXT_VERSION = '2';

export type PrepareWordCloudAnalysisTextResult = {
  readonly segments: string[];
};

const BOUNDARY = '\uE011';
const MAX_MARKED_NESTING = 48;

const EMOJI_SHORTCODE_PATTERN = /:([a-z0-9_+-]+):/gi;
const UNICODE_EMOJI_PATTERN =
  /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Emoji_Presentation}](?:\uFE0F|\u200D[\p{Extended_Pictographic}\p{Emoji_Presentation}])*)/gu;
const BARE_URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()[\]{}|"']+/gi;
const HTML_ENTITY_PATTERN = /&(?:#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g;

const EMPHASIS_HTML_TAGS = new Set(['em', 'i', 'strong', 'b', 's', 'strike', 'del', 'u', 'mark']);
const EXCLUDE_HTML_TAGS = new Set(['sub', 'sup', 'code', 'pre', 'script', 'style', 'kbd', 'samp']);

type SegmentBuilder = {
  segments: string[];
  buffer: string;
  excludeDepth: number;
  nesting: number;
};

/**
 * Liefert analysierbare Textsegmente eines Beitrags.
 * Leere Segmente entfallen; ein komplett leeres Ergebnis bedeutet „Beitrag überspringen“.
 */
export function prepareWordCloudAnalysisText(source: string): PrepareWordCloudAnalysisTextResult {
  if (typeof source !== 'string' || source.length === 0) {
    return { segments: [] };
  }

  const clipped =
    source.length > WORD_CLOUD_MAX_ITEM_TEXT_CHARS
      ? source.slice(0, WORD_CLOUD_MAX_ITEM_TEXT_CHARS)
      : source;

  // Projektspezifika + KaTeX vor marked; restliche Struktur kommt aus dem Lexer.
  const prepared = protectKatexOutsideCode(replaceRedactionBoundaries(clipped));

  let tokens: Token[];
  try {
    tokens = marked.lexer(prepared, { gfm: true, breaks: false });
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

/** Joined cleaned text for embeddings / single-string consumers; segments stay separated. */
export function joinWordCloudAnalysisSegments(segments: readonly string[]): string {
  return segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('\n');
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

/**
 * Ersetzt KaTeX-Bereiche durch Grenzmarker, bevor marked LaTeX-Backslashes escapet.
 * Code-Fences und Inline-Code werden unverändert durchgereicht — marked liefert dafür
 * `code`/`codespan`, die der Walker ausschließt. Kein eigener Markdown-Parser.
 */
function protectKatexOutsideCode(source: string): string {
  let index = 0;
  let out = '';

  while (index < source.length) {
    const fence = readFenceOpen(source, index);
    if (fence) {
      const closed = copyThroughFence(source, index, fence, (chunk) => {
        out += chunk;
      });
      index = closed;
      continue;
    }

    if (source[index] === '`') {
      const closed = copyThroughInlineCode(source, index, (chunk) => {
        out += chunk;
      });
      index = closed;
      continue;
    }

    // Escaped dollar: Literal für marked, kein Formelstart
    if (source.startsWith('\\$', index)) {
      out += '\\$';
      index += 2;
      continue;
    }

    if (source.startsWith('$$', index)) {
      const close = source.indexOf('$$', index + 2);
      if (close === -1) {
        out += BOUNDARY;
        break;
      }
      out += BOUNDARY;
      index = close + 2;
      continue;
    }

    if (source.startsWith('\\[', index)) {
      const close = source.indexOf('\\]', index + 2);
      if (close === -1) {
        out += BOUNDARY;
        break;
      }
      out += BOUNDARY;
      index = close + 2;
      continue;
    }

    if (source.startsWith('\\(', index)) {
      const close = source.indexOf('\\)', index + 2);
      if (close === -1) {
        out += BOUNDARY;
        break;
      }
      out += BOUNDARY;
      index = close + 2;
      continue;
    }

    if (source[index] === '$' && source[index + 1] !== '$') {
      const lineEnd = findLineEnd(source, index + 1);
      const close = source.indexOf('$', index + 1);
      if (close === -1 || close > lineEnd) {
        out += BOUNDARY;
        index = lineEnd;
        continue;
      }
      if (close === index + 1) {
        out += '$';
        index += 1;
        continue;
      }
      out += BOUNDARY;
      index = close + 1;
      continue;
    }

    out += source[index]!;
    index += 1;
  }

  return out;
}

function readFenceOpen(source: string, index: number): '```' | '~~~' | null {
  if (source.startsWith('```', index)) {
    return '```';
  }
  if (source.startsWith('~~~', index)) {
    return '~~~';
  }
  return null;
}

function copyThroughFence(
  source: string,
  start: number,
  fence: '```' | '~~~',
  emit: (chunk: string) => void,
): number {
  const close = source.indexOf(fence, start + 3);
  if (close === -1) {
    emit(source.slice(start));
    return source.length;
  }
  let end = close + 3;
  while (end < source.length && source[end] === fence[0]) {
    end += 1;
  }
  if (source[end] === '\n') {
    end += 1;
  }
  emit(source.slice(start, end));
  return end;
}

function copyThroughInlineCode(
  source: string,
  start: number,
  emit: (chunk: string) => void,
): number {
  let ticks = 1;
  while (source[start + ticks] === '`') {
    ticks += 1;
  }
  const opener = '`'.repeat(ticks);
  const close = source.indexOf(opener, start + ticks);
  if (close === -1) {
    emit(source.slice(start));
    return source.length;
  }
  const end = close + ticks;
  emit(source.slice(start, end));
  return end;
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
    if (EXCLUDE_HTML_TAGS.has(name) || name === 'br' || name === 'hr' || name === 'img') {
      flushBoundary(builder);
    }
    return;
  }

  if (open) {
    const name = open[1]!.toLowerCase();
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
      const code = Number.parseInt(entity.slice(3, -1), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    if (entity.startsWith('&#')) {
      const code = Number.parseInt(entity.slice(2, -1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    return BOUNDARY;
  });
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ');
}
