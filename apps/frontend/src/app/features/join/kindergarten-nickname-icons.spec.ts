import { describe, expect, it } from 'vitest';
import {
  findKindergartenNicknameBadge,
  findKindergartenNicknameBadgeLabel,
  findKindergartenNicknameEmoji,
  findKindergartenNicknameIndex,
  kindergartenNicknameSequence,
  KINDERGARTEN_NICKNAME_EMOJIS,
} from './kindergarten-nickname-icons';
import { NICKNAME_LISTS, NICKNAME_LISTS_BY_LOCALE } from './nickname-themes';

describe('kindergarten-nickname-icons', () => {
  it('hat pro Kindergarten-Eintrag ein Emoji', () => {
    expect(KINDERGARTEN_NICKNAME_EMOJIS.length).toBe(NICKNAME_LISTS.KINDERGARTEN.length);
  });

  it('hat in allen Locales nur eindeutige Kindergarten-Namen', () => {
    for (const localeLists of Object.values(NICKNAME_LISTS_BY_LOCALE)) {
      const names = localeLists.KINDERGARTEN;
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('verwendet pro Kindergarten-Eintrag nur eindeutige Bilder', () => {
    expect(new Set(KINDERGARTEN_NICKNAME_EMOJIS).size).toBe(KINDERGARTEN_NICKNAME_EMOJIS.length);
  });

  it('findet Index und Emoji für deutsche Labels in der Standard-Locale', () => {
    expect(findKindergartenNicknameIndex('Roter Drache')).toBe(0);
    expect(findKindergartenNicknameEmoji('Roter Drache')).toBe('🐉');
  });

  it('findet englische Labels nur in der englischen Locale', () => {
    expect(findKindergartenNicknameIndex('Red dragon')).toBe(0);
    expect(findKindergartenNicknameEmoji('Red dragon')).toBe('🐉');
    expect(findKindergartenNicknameIndex('Red dragon', 'en')).toBe(0);
    expect(findKindergartenNicknameEmoji('Red dragon', 'en')).toBe('🐉');
  });

  it('findet Kindergarten-Labels locale-übergreifend mit demselben Emoji', () => {
    expect(findKindergartenNicknameIndex('Lagunenblaue Qualle', 'en')).toBe(94);
    expect(findKindergartenNicknameEmoji('Lagunenblaue Qualle', 'en')).toBe('🪼');
    expect(findKindergartenNicknameIndex('Lagoon blue jellyfish', 'de')).toBe(94);
    expect(findKindergartenNicknameEmoji('Lagoon blue jellyfish', 'de')).toBe('🪼');
  });

  it('ordnet auch generierte Reserve-Namen dem Ursprungs-Emoji zu', () => {
    expect(findKindergartenNicknameIndex('Roter Drache 2')).toBe(0);
    expect(findKindergartenNicknameEmoji('Roter Drache 2')).toBe('🐉');
    expect(kindergartenNicknameSequence('Roter Drache 2')).toBe('2');
    expect(kindergartenNicknameSequence('Roter Drache')).toBeNull();
    expect(findKindergartenNicknameBadge('Roter Drache 2')).toEqual({
      emoji: '🐉',
      sequence: '2',
    });
    expect(findKindergartenNicknameBadge('Roter Drache')).toEqual({
      emoji: '🐉',
      sequence: null,
    });
    expect(findKindergartenNicknameBadgeLabel('Roter Drache 2')).toBe('🐉 2');
  });

  it('gibt null für unbekannte Strings zurück', () => {
    expect(findKindergartenNicknameIndex('Unbekannt')).toBeNull();
    expect(findKindergartenNicknameEmoji('Unbekannt')).toBeNull();
  });
});
