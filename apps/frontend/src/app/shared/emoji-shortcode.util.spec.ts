import { describe, expect, it } from 'vitest';

import {
  extractLeadingEmoji,
  replaceEmojiShortcodes,
  startsWithEmoji,
  stripLeadingEmojiMarker,
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
    expect(startsWithEmoji(':apple: Team')).toBe(true);
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
    expect(extractLeadingEmoji(':apple: Rot')).toBe('🍎');
  });

  it('liefert null ohne fuehrendes Emoji', () => {
    expect(extractLeadingEmoji('Rot 🍎')).toBeNull();
    expect(extractLeadingEmoji('Rot')).toBeNull();
  });
});

describe('stripLeadingEmojiMarker', () => {
  it('entfernt fuehrende Emojis und Shortcodes aus Teamnamen', () => {
    expect(stripLeadingEmojiMarker('🍎 Rot')).toBe('Rot');
    expect(stripLeadingEmojiMarker('  🚀 Crew')).toBe('Crew');
    expect(stripLeadingEmojiMarker(':apple: Rot')).toBe('Rot');
  });

  it('laesst normale Teamnamen unveraendert', () => {
    expect(stripLeadingEmojiMarker('Rot')).toBe('Rot');
    expect(stripLeadingEmojiMarker('Team 🍎')).toBe('Team 🍎');
  });
});
