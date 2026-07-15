import { MARKDOWN_EMOJI_SHORTCODE_MAP } from './markdown-emoji-shortcodes';

const EMOJI_SHORTCODE_PATTERN = /:([a-z0-9_+-]+):/gi;
const EMOJI_SHORTCODES = new Map(Object.entries(MARKDOWN_EMOJI_SHORTCODE_MAP));

/** `:smile:` → 😊 — wie in der App (`emoji-shortcode.util`). */
export function replaceEmojiShortcodes(value: string): string {
  if (!value) return value;
  return value.replaceAll(EMOJI_SHORTCODE_PATTERN, (full, shortcode: string) => {
    return EMOJI_SHORTCODES.get(shortcode.toLowerCase()) ?? full;
  });
}
