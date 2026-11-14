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
import {
  getKindergartenAnimalId,
  KINDERGARTEN_ANIMALS,
  KINDERGARTEN_NICKNAMES_BY_ID,
  LEGACY_KINDERGARTEN_NICKNAMES,
} from '@arsnova/shared-types';
import type { SupportedLocale } from '../../core/locale-from-path';

describe('kindergarten-nickname-icons', () => {
  it('bietet genau 100 Ganzkörpermotive an und hält alle Tier-IDs auflösbar', () => {
    expect(KINDERGARTEN_ANIMALS.de).toHaveLength(100);
    expect(NICKNAME_LISTS.KINDERGARTEN).not.toContain('Frosch');
    expect(NICKNAME_LISTS.KINDERGARTEN).not.toContain('Küken im Ei');
    expect(findKindergartenNicknameEmoji('Frosch 1', 'de')).toBe('🐸');
    expect(KINDERGARTEN_NICKNAME_EMOJIS).toHaveLength(KINDERGARTEN_NICKNAMES_BY_ID.de.length);
  });

  it('hat in allen Locales nur eindeutige Kindergarten-Namen', () => {
    for (const { KINDERGARTEN: names } of Object.values(NICKNAME_LISTS_BY_LOCALE)) {
      expect(names).toHaveLength(93);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('verwendet pro Kindergarten-Eintrag nur eindeutige Bilder', () => {
    expect(new Set(KINDERGARTEN_NICKNAME_EMOJIS).size).toBe(KINDERGARTEN_NICKNAME_EMOJIS.length);
  });

  it('ordnet den Tiernamen aller Sprachen dieselbe ID und dasselbe Icon zu', () => {
    const locales = Object.keys(NICKNAME_LISTS_BY_LOCALE) as SupportedLocale[];
    for (const locale of locales) {
      const animals = KINDERGARTEN_ANIMALS[locale];
      expect(animals.map(({ animalId }) => animalId)).toEqual(
        KINDERGARTEN_ANIMALS.de.map(({ animalId }) => animalId),
      );
      for (const { name, animalId } of animals) {
        expect(getKindergartenAnimalId(name, animalId), name).toBe(animalId);
        expect(findKindergartenNicknameEmoji(`${name} 1`, locale, animalId), name).toBe(
          KINDERGARTEN_NICKNAME_EMOJIS[animalId],
        );
      }
    }
  });

  it('verwendet die Ganzkörpergrafik für kurze und frühere Ganzkörpernamen', () => {
    expect(findKindergartenNicknameEmoji('Hund 1', 'de')).toBe('🐕');
    expect(findKindergartenNicknameEmoji('Hund mit Körper 1', 'de')).toBe('🐕');
    expect(findKindergartenNicknameEmoji('Schwarze Katze 1', 'de')).toBe('🐈‍⬛');
    expect(findKindergartenNicknameEmoji('Katze 1', 'de')).toBe('🐈');
    expect(findKindergartenNicknameEmoji('Katze 1', 'de', 99)).toBe('🐈‍⬛');
    expect(findKindergartenNicknameEmoji('Wal 1', 'de', 34)).toBe('🐳');
    expect(findKindergartenNicknameEmoji('Wal 2', 'de', 6)).toBe('🐋');
  });

  it('findet Index und Emoji für deutsche Labels in der Standard-Locale', () => {
    expect(findKindergartenNicknameIndex('Roter Drache')).toBe(0);
    expect(findKindergartenNicknameEmoji('Roter Drache')).toBe('🐉');
  });

  it('findet ältere englische Pseudonyme unabhängig von der Locale', () => {
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

  it.each([
    ['de', 'Schwan', 'Marienkäfer'],
    ['en', 'Swan', 'Ladybug'],
    ['fr', 'Cygne', 'Coccinelle'],
    ['es', 'Cisne', 'Mariquita'],
    ['it', 'Cigno', 'Coccinella'],
  ] as const)(
    'ordnet %s Schwan und Marienkäfer in der neuen Auswahl korrekt zu',
    (locale, swan, ladybug) => {
      expect(NICKNAME_LISTS_BY_LOCALE[locale].KINDERGARTEN).toContain(swan);
      expect(NICKNAME_LISTS_BY_LOCALE[locale].KINDERGARTEN).toContain(ladybug);
      expect(findKindergartenNicknameEmoji(swan, locale)).toBe('🦢');
      expect(findKindergartenNicknameEmoji(ladybug, locale)).toBe('🐞');
      expect(findKindergartenNicknameBadge(`${swan} 2`, locale)).toEqual({
        emoji: '🦢',
        sequence: '2',
      });
    },
  );

  it('erkennt frühere Schwan-Pseudonyme in gespeicherten Ergebnissen', () => {
    expect(findKindergartenNicknameBadge('Hellblauer Schwan 3')).toEqual({
      emoji: '🦢',
      sequence: '3',
    });
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

  it('ordnet auf 30 Zeichen gekürzte Kita-Reservenamen eindeutig per Prefix zu', () => {
    const fullIndex = LEGACY_KINDERGARTEN_NICKNAMES.de.indexOf('Mahagonifarbener Wasserbüffel');
    expect(fullIndex).toBeGreaterThanOrEqual(0);
    expect(findKindergartenNicknameIndex('Mahagonifarbener Wasserbüffe 3')).toBe(fullIndex);
    expect(findKindergartenNicknameEmoji('Mahagonifarbener Wasserbüffe 3')).toBe('🐃');
    expect(kindergartenNicknameSequence('Mahagonifarbener Wasserbüffe 3')).toBe('3');
    expect(findKindergartenNicknameBadge('Mahagonifarbener Wasserbüffe 3')).toEqual({
      emoji: '🐃',
      sequence: '3',
    });
  });

  it('schätzt kurze oder mehrdeutige Präfixe nicht', () => {
    expect(findKindergartenNicknameIndex('Roter')).toBeNull();
    expect(findKindergartenNicknameIndex('Korallen')).toBeNull();
    expect(findKindergartenNicknameEmoji('Roter')).toBeNull();
  });

  it('gibt null für unbekannte Strings zurück', () => {
    expect(findKindergartenNicknameIndex('Unbekannt')).toBeNull();
    expect(findKindergartenNicknameEmoji('Unbekannt')).toBeNull();
    expect(findKindergartenNicknameIndex('Mahagonifarbener Wasserxyz')).toBeNull();
  });
});
