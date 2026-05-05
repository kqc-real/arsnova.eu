import { MARKDOWN_EMOJI_SHORTCODE_MAP } from './markdown-emoji-shortcodes';

const EMOJI_SHORTCODE_PATTERN = /:([a-z0-9_+-]+):/gi;
const EMOJI_SHORTCODES = new Map(Object.entries(MARKDOWN_EMOJI_SHORTCODE_MAP));
const LEADING_SHORTCODE_PATTERN = /^:([a-z0-9_+-]+):/i;
const TRAILING_SHORTCODE_PATTERN = /:([a-z0-9_+-]+):$/i;
const LEADING_EMOJI_PATTERN =
  /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Emoji_Presentation}](?:\uFE0F|\u200D[\p{Extended_Pictographic}\p{Emoji_Presentation}])*)/u;
const TRAILING_EMOJI_PATTERN =
  /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Emoji_Presentation}](?:\uFE0F|\u200D[\p{Extended_Pictographic}\p{Emoji_Presentation}])*)$/u;

export function replaceEmojiShortcodes(value: string): string {
  if (!value) {
    return value;
  }

  return value.replaceAll(EMOJI_SHORTCODE_PATTERN, (full, shortcode: string) => {
    return EMOJI_SHORTCODES.get(shortcode.toLowerCase()) ?? full;
  });
}

export function startsWithEmoji(value: string): boolean {
  return extractLeadingEmoji(value) !== null;
}

export function extractLeadingEmoji(value: string): string | null {
  const trimmed = value.trimStart();
  const shortcodeMatch = LEADING_SHORTCODE_PATTERN.exec(trimmed);
  if (shortcodeMatch) {
    return EMOJI_SHORTCODES.get(shortcodeMatch[1]!.toLowerCase()) ?? null;
  }
  const match = LEADING_EMOJI_PATTERN.exec(trimmed);
  return match?.[0] ?? null;
}

export function stripLeadingEmojiMarker(value: string): string {
  if (!value) {
    return value;
  }

  const leadingWhitespaceLength = value.length - value.trimStart().length;
  const trimmed = value.trimStart();
  const shortcodeMatch = LEADING_SHORTCODE_PATTERN.exec(trimmed);
  if (shortcodeMatch && EMOJI_SHORTCODES.has(shortcodeMatch[1]!.toLowerCase())) {
    return trimmed.slice(shortcodeMatch[0].length).trimStart();
  }

  const emojiMatch = LEADING_EMOJI_PATTERN.exec(trimmed);
  if (emojiMatch) {
    return trimmed.slice(emojiMatch[0].length).trimStart();
  }

  return leadingWhitespaceLength > 0 ? value.slice(leadingWhitespaceLength) : value;
}

export function extractTrailingEmoji(value: string): string | null {
  const trimmed = value.trimEnd();
  const shortcodeMatch = TRAILING_SHORTCODE_PATTERN.exec(trimmed);
  if (shortcodeMatch) {
    return EMOJI_SHORTCODES.get(shortcodeMatch[1]!.toLowerCase()) ?? null;
  }
  const match = TRAILING_EMOJI_PATTERN.exec(trimmed);
  return match?.[0] ?? null;
}

export function stripTrailingEmojiMarker(value: string): string {
  if (!value) {
    return value;
  }

  const trimmed = value.trimEnd();
  const shortcodeMatch = TRAILING_SHORTCODE_PATTERN.exec(trimmed);
  if (shortcodeMatch && EMOJI_SHORTCODES.has(shortcodeMatch[1]!.toLowerCase())) {
    return trimmed.slice(0, trimmed.length - shortcodeMatch[0].length).trimEnd();
  }

  const emojiMatch = TRAILING_EMOJI_PATTERN.exec(trimmed);
  if (emojiMatch) {
    return trimmed.slice(0, trimmed.length - emojiMatch[0].length).trimEnd();
  }

  return value;
}

export function edgeEmojiMarkerPosition(value: string): 'leading' | 'trailing' | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const leading = extractLeadingEmoji(trimmed);
  const trailing = extractTrailingEmoji(trimmed);

  if (!leading && !trailing) {
    return null;
  }

  if (trailing) {
    const labelBeforeTrailing = stripTrailingEmojiMarker(trimmed).trim();
    const labelAfterLeading = stripLeadingEmojiMarker(trimmed).trim();
    if (labelBeforeTrailing.length > 0 || labelAfterLeading.length === 0) {
      return 'trailing';
    }
  }

  return leading ? 'leading' : 'trailing';
}

export function extractEdgeEmoji(value: string): string | null {
  const position = edgeEmojiMarkerPosition(value);
  if (position === 'leading') {
    return extractLeadingEmoji(value);
  }
  if (position === 'trailing') {
    return extractTrailingEmoji(value);
  }
  return null;
}

export function stripEdgeEmojiMarker(value: string): string {
  const position = edgeEmojiMarkerPosition(value);
  if (position === 'leading') {
    return stripLeadingEmojiMarker(value);
  }
  if (position === 'trailing') {
    return stripTrailingEmojiMarker(value);
  }
  return value;
}
