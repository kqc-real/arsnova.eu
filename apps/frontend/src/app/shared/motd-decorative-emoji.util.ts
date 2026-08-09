export type MotdTitleDisplay = {
  decorativeEmoji: string | null;
  title: string;
};

const LEADING_DECORATIVE_PUZZLE_EMOJI = /^(🧩\uFE0F?)\s*/u;

/**
 * Das Puzzle-Emoji kennzeichnet die Feature-MOTD rein visuell. Titeltext und Emoji werden
 * getrennt, damit Templates das Emoji mit `aria-hidden` aus der zugänglichen Bezeichnung nehmen.
 */
export function splitMotdDecorativeEmoji(title: string): MotdTitleDisplay {
  const match = title.match(LEADING_DECORATIVE_PUZZLE_EMOJI);
  if (!match) {
    return { decorativeEmoji: null, title };
  }
  return {
    decorativeEmoji: match[1] ?? '🧩',
    title: title.slice(match[0].length),
  };
}

/** Setzt das führende Puzzle-Emoji in einer gerenderten Markdown-Überschrift auf dekorativ. */
export function hideMotdDecorativeEmojiInHeadingHtml(html: string): string {
  return html.replace(
    /(<h[1-6](?:\s[^>]*)?>)\s*(🧩\uFE0F?)\s*/u,
    '$1<span aria-hidden="true">$2</span> ',
  );
}
