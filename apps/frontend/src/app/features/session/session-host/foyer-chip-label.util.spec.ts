import { describe, expect, it } from 'vitest';

import { buildFoyerChipLabel, truncateLabelGraphemes } from './foyer-chip-label.util';

describe('foyer-chip-label.util', () => {
  it('kuerzt lange Namen graphem-sicher fuer entspannte Chips', () => {
    const label = buildFoyerChipLabel({ nickname: 'Maximilian' });

    expect(label.kind).toBe('text');
    expect(label.text).toBe('Maximil…');
    expect(label.ariaLabel).toBe('Maximilian');
  });

  it('bildet im dichten Modus kompakte Initialen fuer mehrteilige Namen', () => {
    const label = buildFoyerChipLabel({ nickname: 'Ada Lovelace', dense: true });

    expect(label.kind).toBe('text');
    expect(label.text).toBe('AL');
    expect(label.ariaLabel).toBe('Ada Lovelace');
  });

  it('haelt im lesbaren Dense-Modus wenigstens den Vornamen statt Initialen', () => {
    const label = buildFoyerChipLabel({
      nickname: 'Marie Curie',
      dense: true,
      preferReadableText: true,
    });

    expect(label.kind).toBe('text');
    expect(label.text).toBe('Marie');
    expect(label.ariaLabel).toBe('Marie Curie');
  });

  it('laesst im lesbaren Dense-Modus auch laengere Vornamen stehen', () => {
    const label = buildFoyerChipLabel({
      nickname: 'Alexandrina Victoria',
      dense: true,
      preferReadableText: true,
    });

    expect(label.kind).toBe('text');
    expect(label.text).toBe('Alexandrina');
    expect(label.ariaLabel).toBe('Alexandrina Victoria');
  });

  it('nutzt im Kindergarten-Fall im dichten Modus nur das Emoji', () => {
    const label = buildFoyerChipLabel({
      nickname: 'Faultier Fritzi',
      kindergartenEmoji: '🦥',
      dense: true,
    });

    expect(label.kind).toBe('emoji-only');
    expect(label.emoji).toBe('🦥');
    expect(label.text).toBe('');
    expect(label.ariaLabel).toBe('Faultier Fritzi');
  });

  it('nutzt im Kindergarten-Fall bei Begruessungsmodus weiterhin einen separaten Volltextpfad', () => {
    const label = buildFoyerChipLabel({
      nickname: 'Mintgrüne Eidechse',
      kindergartenEmoji: '🦎',
      preferFullText: true,
    });

    expect(label.kind).toBe('emoji-with-text');
    expect(label.emoji).toBe('🦎');
    expect(label.text).toBe('Mintgrüne Eidechse');
    expect(label.ariaLabel).toBe('Mintgrüne Eidechse');
  });

  it('verwendet im anonymen Modus einen neutralen Token', () => {
    const label = buildFoyerChipLabel({ nickname: 'Ada', anonymousMode: true });

    expect(label.kind).toBe('anonymous');
    expect(label.text).toBe('?');
    expect(label.ariaLabel).toContain('Teilnehmende Person');
  });

  it('trennt kombinierte Emoji-Grapheme nicht beim Abschneiden', () => {
    expect(truncateLabelGraphemes('👩🏽‍🏫Lehrkraft', 1)).toBe('👩🏽‍🏫…');
  });
});
