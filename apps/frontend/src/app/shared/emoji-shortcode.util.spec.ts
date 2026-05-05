import { describe, expect, it } from 'vitest';

import {
  edgeEmojiMarkerPosition,
  extractEdgeEmoji,
  extractLeadingEmoji,
  extractTrailingEmoji,
  replaceEmojiShortcodes,
  startsWithEmoji,
  stripEdgeEmojiMarker,
  stripLeadingEmojiMarker,
  stripTrailingEmojiMarker,
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

describe('extractTrailingEmoji', () => {
  it('liest ein nachgestelltes Emoji oder einen Shortcode aus', () => {
    expect(extractTrailingEmoji('Team 🍎')).toBe('🍎');
    expect(extractTrailingEmoji('Team :apple:')).toBe('🍎');
    expect(extractTrailingEmoji(':apple:')).toBe('🍎');
  });

  it('liefert null ohne nachgestelltes Emoji', () => {
    expect(extractTrailingEmoji('🍎 Team')).toBeNull();
    expect(extractTrailingEmoji('Rot')).toBeNull();
  });
});

describe('stripTrailingEmojiMarker', () => {
  it('entfernt nachgestellte Emojis und Shortcodes aus Teamnamen', () => {
    expect(stripTrailingEmojiMarker('Team 🍎')).toBe('Team');
    expect(stripTrailingEmojiMarker('Team :apple:')).toBe('Team');
    expect(stripTrailingEmojiMarker(':apple:')).toBe('');
  });
});

describe('edgeEmojiMarkerPosition', () => {
  it('erkennt Emoji-Marker an beiden Raendern', () => {
    expect(edgeEmojiMarkerPosition('🍎 Rot')).toBe('leading');
    expect(edgeEmojiMarkerPosition('Team 🍎')).toBe('trailing');
    expect(edgeEmojiMarkerPosition(':apple:')).toBe('trailing');
  });
});

describe('extractEdgeEmoji', () => {
  it('liest den relevanten Emoji-Marker fuer Teamlabels aus', () => {
    expect(extractEdgeEmoji('🍎 Rot')).toBe('🍎');
    expect(extractEdgeEmoji('Team 🍎')).toBe('🍎');
    expect(extractEdgeEmoji(':apple:')).toBe('🍎');
  });
});

describe('stripEdgeEmojiMarker', () => {
  it('entfernt fuehrende oder nachgestellte Marker fuer die Labelanzeige', () => {
    expect(stripEdgeEmojiMarker('🍎 Rot')).toBe('Rot');
    expect(stripEdgeEmojiMarker('Team 🍎')).toBe('Team');
    expect(stripEdgeEmojiMarker(':apple:')).toBe('');
  });
});
