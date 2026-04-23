import { MARKDOWN_EMOJI_SHORTCODE_MAP } from './markdown-emoji-shortcodes';

const EMOJI_SHORTCODE_PATTERN = /:([a-z0-9_+-]+):/gi;
const EMOJI_SHORTCODES = new Map(Object.entries(MARKDOWN_EMOJI_SHORTCODE_MAP));
const LEADING_SHORTCODE_PATTERN = /^:([a-z0-9_+-]+):/i;
const LEADING_EMOJI_PATTERN =
  /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Emoji_Presentation}](?:\uFE0F|\u200D[\p{Extended_Pictographic}\p{Emoji_Presentation}])*)/u;

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
