import { describe, expect, it } from 'vitest';
import { decorateLeadingAnswerEmoji } from './leading-answer-emoji.util';

describe('decorateLeadingAnswerEmoji', () => {
  it('wraps a leading emoji at the root with a styling span', () => {
    const html = '😄 Bereit loszulegen';

    expect(decorateLeadingAnswerEmoji(html)).toBe(
      '<span class="answer-leading-emoji">😄</span>Bereit loszulegen',
    );
  });

  it('wraps a leading emoji inside paragraph markup', () => {
    const html = '<p>😭 Gerade etwas überfordert</p>';

    expect(decorateLeadingAnswerEmoji(html)).toBe(
      '<p><span class="answer-leading-emoji">😭</span>Gerade etwas überfordert</p>',
    );
  });

  it('does not decorate non-leading emojis', () => {
    const html = '<p>Team 😄 ist bereit</p>';

    expect(decorateLeadingAnswerEmoji(html)).toBe(html);
  });

  it('does not decorate the same html twice', () => {
    const html = '<p><span class="answer-leading-emoji">😡</span>Genervt</p>';

    expect(decorateLeadingAnswerEmoji(html)).toBe(html);
  });
});
