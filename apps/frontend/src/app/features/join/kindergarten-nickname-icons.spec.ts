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

  it('findet Index und Emoji für deutsche und englische Labels', () => {
    expect(findKindergartenNicknameIndex('Blauer Elefant')).toBe(0);
    expect(findKindergartenNicknameEmoji('Blauer Elefant')).toBe('🐘');
    expect(findKindergartenNicknameIndex('Blue elephant')).toBe(0);
    expect(findKindergartenNicknameEmoji('Blue elephant')).toBe('🐘');
  });

  it('gibt null für unbekannte Strings zurück', () => {
    expect(findKindergartenNicknameIndex('Unbekannt')).toBeNull();
    expect(findKindergartenNicknameEmoji('Unbekannt')).toBeNull();
  });
});
