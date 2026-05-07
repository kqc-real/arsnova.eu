import { describe, expect, it } from 'vitest';
import {
  findKindergartenNicknameEmoji,
  findKindergartenNicknameIndex,
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
    expect(findKindergartenNicknameIndex('Red dragon')).toBeNull();
    expect(findKindergartenNicknameEmoji('Red dragon')).toBeNull();
    expect(findKindergartenNicknameIndex('Red dragon', 'en')).toBe(0);
    expect(findKindergartenNicknameEmoji('Red dragon', 'en')).toBe('🐉');
  });

  it('gibt null für unbekannte Strings zurück', () => {
    expect(findKindergartenNicknameIndex('Unbekannt')).toBeNull();
    expect(findKindergartenNicknameEmoji('Unbekannt')).toBeNull();
  });
});
