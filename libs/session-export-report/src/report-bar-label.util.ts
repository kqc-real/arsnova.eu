const LEADING_EMOJI_RE = new RegExp(
  String.raw`^(\s*)((?:(?:[\p{Extended_Pictographic}](?:\uFE0F|\uFE0E)?(?:\u200D[\p{Extended_Pictographic}](?:\uFE0F|\uFE0E)?)*)|(?:[\p{Regional_Indicator}]{2})|(?:[#*0-9]\uFE0F?\u20E3))+)(?:\s+([\s\S]*))?$`,
  'u',
);

function getEmojiSvgHtml(emoji: string): string {
  // Common mood / quiz survey emojis
  if (/^(?:😄|😃|😀|😊|🙂|😁|😆|🥰)$/u.test(emoji)) {
    return `<svg class="report-bar-emoji-svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" role="presentation"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5.5" cy="6" r="1" fill="currentColor"/><circle cx="10.5" cy="6" r="1" fill="currentColor"/><path d="M4.5 9.5 C5.5 12, 10.5 12, 11.5 9.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
  if (/^(?:😐|😶|😑)$/u.test(emoji)) {
    return `<svg class="report-bar-emoji-svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" role="presentation"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5.5" cy="6" r="1" fill="currentColor"/><circle cx="10.5" cy="6" r="1" fill="currentColor"/><line x1="5" y1="10.5" x2="11" y2="10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
  if (/^(?:😢|😭|🙁|☹️?|😞|🥺|😩|😫)$/u.test(emoji)) {
    return `<svg class="report-bar-emoji-svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" role="presentation"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5.5" cy="6" r="1" fill="currentColor"/><circle cx="10.5" cy="6" r="1" fill="currentColor"/><path d="M4.5 11.5 C5.5 9.5, 10.5 9.5, 11.5 11.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
  if (/^(?:😡|😠|😤|🤬)$/u.test(emoji)) {
    return `<svg class="report-bar-emoji-svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" role="presentation"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 5.5 L7 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M12 5.5 L9 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="5.5" cy="7.5" r="0.9" fill="currentColor"/><circle cx="10.5" cy="7.5" r="0.9" fill="currentColor"/><path d="M5 11.5 C6 10, 10 10, 11 11.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }
  if (/^👍$/u.test(emoji)) {
    return `<svg class="report-bar-emoji-svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" role="presentation"><path d="M4 7 v6 h2 v-6 z M7 7 h3.5 a1.5 1.5 0 0 1 1.4 2 l-1 3.5 a1 1 0 0 1 -1 0.5 h-3 v-6 l2 -4 a1 1 0 0 1 1 1 z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  }
  if (/^👎$/u.test(emoji)) {
    return `<svg class="report-bar-emoji-svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" role="presentation"><path d="M4 3 v6 h2 v-6 z M7 9 h3.5 a1.5 1.5 0 0 0 1.4 -2 l-1 -3.5 a1 1 0 0 0 -1 -0.5 h-3 v6 l2 4 a1 1 0 0 0 1 -1 z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  }
  if (/^(?:⭐|🌟|✨)$/u.test(emoji)) {
    return `<svg class="report-bar-emoji-svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" role="presentation"><path d="M8 1 L10 5.5 L15 6 L11.2 9.5 L12.5 14.5 L8 12 L3.5 14.5 L4.8 9.5 L1 6 L6 5.5 Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  }
  if (/^🚀$/u.test(emoji)) {
    return `<svg class="report-bar-emoji-svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" role="presentation"><path d="M8 2 C11 2 13 4 13 8 L11 10 L8 8 L6 10 L3 8 C3 4 5 2 8 2 Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 2 L13 8 L8 13 L3 8 Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
  }

  // Fallback for any other emoji: SVG bullet disc
  return `<svg class="report-bar-emoji-svg report-bar-bullet-svg" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" role="presentation"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>`;
}

/** Führendes Emoji vom Antworttext trennen — wie in der App (`leading-answer-emoji.util`). */
export function formatReportBarLabelHtml(
  text: string,
  escapeHtml: (value: string) => string,
): string {
  const match = text.match(LEADING_EMOJI_RE);
  if (!match?.[2]) {
    return escapeHtml(text);
  }

  const emoji = match[2];
  const rest = (match[3] ?? '').trimStart();
  const svgHtml = getEmojiSvgHtml(emoji);

  const emojiSpan = `<span class="report-bar-leading-emoji" title="${escapeHtml(emoji)}"><span class="report-emoji-svg-wrap" aria-hidden="true">${svgHtml}</span><span class="report-emoji-glyph" aria-hidden="true">${escapeHtml(emoji)}</span></span>`;

  if (!rest) {
    return emojiSpan;
  }

  return `${emojiSpan}<span class="report-bar-label-text">${escapeHtml(rest)}</span>`;
}
