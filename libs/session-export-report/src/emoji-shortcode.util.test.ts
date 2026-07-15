import { describe, expect, it } from 'vitest';
import { replaceEmojiShortcodes } from './emoji-shortcode.util';

describe('replaceEmojiShortcodes', () => {
  it('ersetzt bekannte Shortcodes', () => {
    expect(replaceEmojiShortcodes(':smile: Bereit')).toBe('😄 Bereit');
    expect(replaceEmojiShortcodes(':cry: Müde')).toBe('😭 Müde');
    expect(replaceEmojiShortcodes(':rage: Genervt')).toBe('😡 Genervt');
    expect(replaceEmojiShortcodes(':neutral_face: Okay')).toBe('😐 Okay');
  });

  it('lässt unbekannte Shortcodes unverändert', () => {
    expect(replaceEmojiShortcodes(':unknown_emoji: Text')).toBe(':unknown_emoji: Text');
  });
});
