const LEADING_EMOJI_SOURCE = String.raw`(\s*)((?:(?:[\p{Extended_Pictographic}](?:\uFE0F|\uFE0E)?(?:\u200D[\p{Extended_Pictographic}](?:\uFE0F|\uFE0E)?)*)|(?:[\p{Regional_Indicator}]{2})|(?:[#*0-9]\uFE0F?\u20E3))+)(?:\s+)`;

const BLOCK_LEADING_EMOJI_RE = new RegExp(
  String.raw`(<(?:p|li)(?:\s[^>]*)?>)${LEADING_EMOJI_SOURCE}`,
  'u',
);
const ROOT_LEADING_EMOJI_RE = new RegExp(String.raw`^${LEADING_EMOJI_SOURCE}`, 'u');

export function decorateLeadingAnswerEmoji(html: string): string {
  if (!html || html.includes('answer-leading-emoji')) {
    return html;
  }

  const blockDecorated = html.replace(
    BLOCK_LEADING_EMOJI_RE,
    '$1$2<span class="answer-leading-emoji">$3</span>',
  );
  if (blockDecorated !== html) {
    return blockDecorated;
  }

  return html.replace(ROOT_LEADING_EMOJI_RE, '$1<span class="answer-leading-emoji">$2</span>');
}
