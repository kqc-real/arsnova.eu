import { MARKDOWN_EMOJI_SHORTCODE_MAP } from './markdown-emoji-shortcodes';

const EMOJI_SHORTCODE_PATTERN = /:([a-z0-9_+-]+):/gi;
const EMOJI_SHORTCODES = new Map(Object.entries(MARKDOWN_EMOJI_SHORTCODE_MAP));
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
  return LEADING_EMOJI_PATTERN.test(value.trimStart());
}

export function extractLeadingEmoji(value: string): string | null {
  const trimmed = value.trimStart();
  const match = LEADING_EMOJI_PATTERN.exec(trimmed);
  return match?.[0] ?? null;
}
