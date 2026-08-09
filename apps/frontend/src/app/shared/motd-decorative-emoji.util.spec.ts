import { describe, expect, it } from 'vitest';
import {
  hideMotdDecorativeEmojiInHeadingHtml,
  splitMotdDecorativeEmoji,
} from './motd-decorative-emoji.util';

describe('MOTD-Dekorations-Emoji', () => {
  it('trennt das führende Puzzle-Emoji vom zugänglichen Titel', () => {
    expect(splitMotdDecorativeEmoji('🧩 Neu: Zuordnen. Sortieren. Kategorisieren.')).toEqual({
      decorativeEmoji: '🧩',
      title: 'Neu: Zuordnen. Sortieren. Kategorisieren.',
    });
  });

  it('lässt Titel ohne bekanntes Dekorations-Emoji unverändert', () => {
    expect(splitMotdDecorativeEmoji('Aktuelle Meldung')).toEqual({
      decorativeEmoji: null,
      title: 'Aktuelle Meldung',
    });
  });

  it('verbirgt das Puzzle-Emoji in gerenderten Markdown-Überschriften vor Screenreadern', () => {
    expect(hideMotdDecorativeEmojiInHeadingHtml('<h3>🧩 New: Match. Order. Categorize.</h3>')).toBe(
      '<h3><span aria-hidden="true">🧩</span> New: Match. Order. Categorize.</h3>',
    );
  });
});
