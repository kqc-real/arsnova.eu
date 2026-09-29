/**
 * Q&A-Passagen-Schwärzung (#485).
 *
 * Offsets sind Unicode-Codepunkte (`[...text]`), nicht UTF-16-Code Units.
 * Der Server erzeugt den Ersatz selbst; Clients senden nur disjunkte Bereiche.
 */

/** Sichtbarer Platzhalter ohne Preisgabe der Originallänge. */
export const QA_REDACTION_PLACEHOLDER = '[geschwärzt]';

/** Höchstzahl getrennter Stellen pro atomarer Schwärzung. */
export const QA_REDACTION_MAX_RANGES = 10;

/**
 * Maximale Codepunkt-Länge einer einzelnen Stelle
 * (Namen und längere sensible Angaben).
 */
export const QA_REDACTION_MAX_RANGE_CODE_POINTS = 80;

/** Mindestlänge einer Stelle. */
export const QA_REDACTION_MIN_RANGE_CODE_POINTS = 1;

export type QaRedactionRange = {
  /** inklusiver Start-Index in Codepunkten */
  start: number;
  /** exklusiver End-Index in Codepunkten */
  end: number;
};

export type QaRedactionFailureReason =
  | 'EMPTY_RANGES'
  | 'TOO_MANY_RANGES'
  | 'INVALID_RANGE'
  | 'OUT_OF_BOUNDS'
  | 'RANGE_TOO_LONG'
  | 'OVERLAPPING_RANGES'
  | 'OVERLAPS_PLACEHOLDER'
  | 'EMPTY_RESULT';

export type QaRedactionApplyResult =
  { ok: true; text: string } | { ok: false; reason: QaRedactionFailureReason };

export function qaTextCodePoints(text: string): string[] {
  return Array.from(text);
}

export function qaCodePointsToText(codePoints: readonly string[]): string {
  return codePoints.join('');
}

/** Alle Vorkommen des Platzhalters als Codepunkt-Spannen `[start, end)`. */
export function findQaRedactionPlaceholderSpans(codePoints: readonly string[]): QaRedactionRange[] {
  const needle = qaTextCodePoints(QA_REDACTION_PLACEHOLDER);
  if (needle.length === 0 || codePoints.length < needle.length) {
    return [];
  }
  const spans: QaRedactionRange[] = [];
  for (let index = 0; index <= codePoints.length - needle.length; index += 1) {
    let match = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (codePoints[index + offset] !== needle[offset]) {
        match = false;
        break;
      }
    }
    if (match) {
      spans.push({ start: index, end: index + needle.length });
      index += needle.length - 1;
    }
  }
  return spans;
}

function rangesOverlap(left: QaRedactionRange, right: QaRedactionRange): boolean {
  return left.start < right.end && right.start < left.end;
}

/**
 * Prüft und wendet disjunkte Schwärzungsbereiche auf den aktuellen Fragetext an.
 * Erzeugt den Platzhalter serverseitig; kein Client-Ersatztext.
 */
export function applyQaPassageRedaction(
  text: string,
  ranges: readonly QaRedactionRange[],
): QaRedactionApplyResult {
  if (ranges.length === 0) {
    return { ok: false, reason: 'EMPTY_RANGES' };
  }
  if (ranges.length > QA_REDACTION_MAX_RANGES) {
    return { ok: false, reason: 'TOO_MANY_RANGES' };
  }

  const codePoints = qaTextCodePoints(text);
  const normalized: QaRedactionRange[] = [];

  for (const range of ranges) {
    if (
      !Number.isInteger(range.start) ||
      !Number.isInteger(range.end) ||
      range.start < 0 ||
      range.end <= range.start
    ) {
      return { ok: false, reason: 'INVALID_RANGE' };
    }
    if (range.end > codePoints.length) {
      return { ok: false, reason: 'OUT_OF_BOUNDS' };
    }
    const length = range.end - range.start;
    if (length < QA_REDACTION_MIN_RANGE_CODE_POINTS) {
      return { ok: false, reason: 'INVALID_RANGE' };
    }
    if (length > QA_REDACTION_MAX_RANGE_CODE_POINTS) {
      return { ok: false, reason: 'RANGE_TOO_LONG' };
    }
    normalized.push({ start: range.start, end: range.end });
  }

  normalized.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1]!;
    const current = normalized[index]!;
    if (rangesOverlap(previous, current)) {
      return { ok: false, reason: 'OVERLAPPING_RANGES' };
    }
  }

  const placeholderSpans = findQaRedactionPlaceholderSpans(codePoints);
  for (const range of normalized) {
    for (const span of placeholderSpans) {
      if (rangesOverlap(range, span)) {
        return { ok: false, reason: 'OVERLAPS_PLACEHOLDER' };
      }
    }
  }

  const placeholderPoints = qaTextCodePoints(QA_REDACTION_PLACEHOLDER);
  const result: string[] = [];
  let cursor = 0;
  for (const range of normalized) {
    result.push(...codePoints.slice(cursor, range.start));
    result.push(...placeholderPoints);
    cursor = range.end;
  }
  result.push(...codePoints.slice(cursor));

  const nextText = qaCodePointsToText(result).trim();
  if (nextText.length === 0) {
    return { ok: false, reason: 'EMPTY_RESULT' };
  }

  return { ok: true, text: nextText };
}

/**
 * Findet alle nicht-überlappenden Vorkommen von `needle` im Text (Codepunkte),
 * die nicht in bestehenden Platzhaltern liegen. Für die mobile Suche.
 */
export function findQaRedactionSearchOccurrences(text: string, needle: string): QaRedactionRange[] {
  const haystack = qaTextCodePoints(text);
  const needlePoints = qaTextCodePoints(needle);
  if (needlePoints.length === 0 || needlePoints.length > QA_REDACTION_MAX_RANGE_CODE_POINTS) {
    return [];
  }
  const blocked = findQaRedactionPlaceholderSpans(haystack);
  const occurrences: QaRedactionRange[] = [];
  for (let index = 0; index <= haystack.length - needlePoints.length; index += 1) {
    let match = true;
    for (let offset = 0; offset < needlePoints.length; offset += 1) {
      if (haystack[index + offset] !== needlePoints[offset]) {
        match = false;
        break;
      }
    }
    if (!match) {
      continue;
    }
    const range = { start: index, end: index + needlePoints.length };
    const blockedHit = blocked.some((span) => rangesOverlap(range, span));
    if (!blockedHit) {
      occurrences.push(range);
    }
    index += needlePoints.length - 1;
  }
  return occurrences;
}

/** Vorschau-Text für die Host-UI (gleiche Logik wie Server). */
export function previewQaPassageRedaction(
  text: string,
  ranges: readonly QaRedactionRange[],
): string | null {
  const result = applyQaPassageRedaction(text, ranges);
  return result.ok ? result.text : null;
}

/**
 * Inhaltliche Textversion für optimistic concurrency.
 * Unabhängig von `updatedAt` (Query-Raw vs. Prisma, Stimmen ohne Textänderung).
 */
export function qaQuestionTextVersion(text: string): string {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `${qaTextCodePoints(text).length.toString(16)}:${(hash >>> 0).toString(16)}`;
}
