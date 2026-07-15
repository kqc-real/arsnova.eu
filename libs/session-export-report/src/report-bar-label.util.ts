const LEADING_EMOJI_RE = new RegExp(
  String.raw`^(\s*)((?:(?:[\p{Extended_Pictographic}](?:\uFE0F|\uFE0E)?(?:\u200D[\p{Extended_Pictographic}](?:\uFE0F|\uFE0E)?)*)|(?:[\p{Regional_Indicator}]{2})|(?:[#*0-9]\uFE0F?\u20E3))+)(?:\s+([\s\S]*))?$`,
  'u',
);

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
  if (!rest) {
    return `<span class="report-bar-leading-emoji">${escapeHtml(emoji)}</span>`;
  }

  return `<span class="report-bar-leading-emoji">${escapeHtml(emoji)}</span><span class="report-bar-label-text">${escapeHtml(rest)}</span>`;
}
