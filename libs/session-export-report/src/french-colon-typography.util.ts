/**
 * Französische Typografie: geschütztes Leerzeichen vor Doppelpunkten.
 * Code, URLs und Uhrzeiten bleiben unverändert.
 */

const PROTECT_PLACEHOLDER = '\uE000';

function protectMatches(text: string, pattern: RegExp, bucket: string[]): string {
  return text.replace(pattern, (match) => {
    const index = bucket.length;
    bucket.push(match);
    return `${PROTECT_PLACEHOLDER}${index}${PROTECT_PLACEHOLDER}`;
  });
}

function restoreMatches(text: string, bucket: string[]): string {
  return text.replace(
    new RegExp(`${PROTECT_PLACEHOLDER}(\\d+)${PROTECT_PLACEHOLDER}`, 'g'),
    (_, index) => bucket[Number(index)] ?? '',
  );
}

/**
 * Setzt vor jedem Doppelpunkt `\u00A0`, außer in URLs, Uhrzeiten und Code-ähnlichen Fragmenten.
 */
export function applyFrenchColonTypography(text: string): string {
  if (!text.includes(':')) return text;

  const bucket: string[] = [];
  let working = text;

  // URLs (http/https) und Protocol-relative Links.
  working = protectMatches(working, /https?:\/\/[^\s<]+/gi, bucket);
  working = protectMatches(working, /\/\/[^\s<]+/g, bucket);
  // Uhrzeiten: 8:41, 08:41:00
  working = protectMatches(working, /\b\d{1,2}:\d{2}(?::\d{2})?\b/g, bucket);
  // Windows-Pfade / Laufwerksbuchstaben
  working = protectMatches(working, /\b[A-Za-z]:\\[^\s]*/g, bucket);
  // Emoji-/Markdown-Shortcodes (:smile:, :neutral_face:)
  working = protectMatches(working, /:[a-zA-Z0-9_+-]+:/g, bucket);
  // Inline-Code und fenced code
  working = protectMatches(working, /`[^`]+`/g, bucket);
  working = protectMatches(working, /```[\s\S]*?```/g, bucket);

  // Optional vorhandenes Leerzeichen/NNBSP vor dem Doppelpunkt → NBSP.
  // Entspricht localeüblich: label.replace(/\s*:/g, '\u00A0:'), aber ohne Newlines.
  working = working.replace(/[\t\v\f \u00A0\u202F\u2007\u2009]*:/g, '\u00A0:');

  return restoreMatches(working, bucket);
}

/**
 * Wendet die FR-Doppelpunkt-Typografie nur auf Textknoten im HTML an
 * (keine Tags, keine style/script/code/pre-Inhalte).
 */
export function applyFrenchColonTypographyToHtml(html: string): string {
  const bucket: string[] = [];
  let working = html;

  // Ganze Blöcke schützen, in denen `:` technisch ist.
  working = protectMatches(working, /<(style|script|code|pre)\b[^>]*>[\s\S]*?<\/\1>/gi, bucket);

  working = working.replace(
    /(<[^>]+>)|([^<]+)/g,
    (match, tag: string | undefined, text: string | undefined) => {
      if (tag) return tag;
      if (!text) return match;
      return applyFrenchColonTypography(text);
    },
  );

  return restoreMatches(working, bucket);
}

export function applyFrenchColonTypographyToLabels<T extends object>(labels: T): T {
  const out = { ...labels } as T;
  for (const key of Object.keys(out) as (keyof T)[]) {
    const value = out[key];
    if (typeof value === 'string') {
      out[key] = applyFrenchColonTypography(value) as T[keyof T];
    }
  }
  return out;
}
