import { describe, expect, it } from 'vitest';

import {
  extractLeadingEmoji,
  replaceEmojiShortcodes,
  startsWithEmoji,
} from './emoji-shortcode.util';

describe('replaceEmojiShortcodes', () => {
  it('ersetzt bekannte Emoji-Shortcodes', () => {
    expect(replaceEmojiShortcodes('Team :apple:')).toBe('Team 🍎');
    expect(replaceEmojiShortcodes(':rocket: Crew')).toBe('🚀 Crew');
  });

  it('laesst unbekannte Shortcodes unveraendert', () => {
    expect(replaceEmojiShortcodes('Team :unknown_emoji:')).toBe('Team :unknown_emoji:');
  });
});

describe('startsWithEmoji', () => {
  it('erkennt fuehrende Emojis', () => {
    expect(startsWithEmoji('🍎 Team')).toBe(true);
    expect(startsWithEmoji('  🚀 Crew')).toBe(true);
  });

  it('ignoriert normale Teamnamen ohne fuehrendes Emoji', () => {
    expect(startsWithEmoji('Team 🍎')).toBe(false);
    expect(startsWithEmoji('Rot')).toBe(false);
  });
});

describe('extractLeadingEmoji', () => {
  it('liest ein fuehrendes Emoji aus', () => {
    expect(extractLeadingEmoji('🍎 Rot')).toBe('🍎');
    expect(extractLeadingEmoji('  🚀 Crew')).toBe('🚀');
  });

  it('liefert null ohne fuehrendes Emoji', () => {
    expect(extractLeadingEmoji('Rot 🍎')).toBeNull();
    expect(extractLeadingEmoji('Rot')).toBeNull();
  });
});
