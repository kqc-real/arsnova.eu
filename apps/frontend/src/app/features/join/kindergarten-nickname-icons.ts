/**
 * Emoji je persistierter Tier-ID, einschließlich historischer Motive.
 */
import { getKindergartenAnimalId, KINDERGARTEN_NICKNAMES_BY_ID } from '@arsnova/shared-types';
import { getEffectiveLocale, type SupportedLocale } from '../../core/locale-from-path';
import { LEGACY_KINDERGARTEN_NICKNAMES } from './legacy-kindergarten-nicknames';

/** Parallel zu `KINDERGARTEN_NICKNAMES_BY_ID`. */
export const KINDERGARTEN_NICKNAME_EMOJIS: readonly string[] = [
  '🐉', // Drache
  '🐸', // Frosch
  '🦁', // Löwe
  '🐬', // Delfin
  '🦊', // Fuchs
  '🦋', // Schmetterling
  '🐋', // Wal
  '🐻', // Bär
  '🐆', // Leopard
  '🐇', // Hase
  '🐺', // Wolf
  '🦪', // Auster
  '🦤', // Dodo
  '🦜', // Papagei
  '🦢', // Schwan
  '🐍', // Schlange
  '🐝', // Biene
  '🐴', // Pferd
  '🦎', // Eidechse
  '🦀', // Krabbe
  '🐞', // Marienkäfer
  '🐭', // Maus
  '🦔', // Igel
  '🦩', // Flamingo
  '🦉', // Eule
  '🐓', // Hahn
  '🦫', // Biber
  '🐛', // Raupe
  '🐹', // Hamster
  '🐒', // Affe
  '🐊', // Krokodil
  '🦡', // Dachs
  '🦗', // Grille
  '🐤', // Küken
  '🐳', // Wal mit Fontäne
  '🐢', // Schildkröte
  '🐟', // Fisch
  '🐑', // Schaf
  '🐶', // Hund
  '🐱', // Katzengesicht
  '🦒', // Giraffe
  '🦓', // Zebra
  '🐯', // Tiger
  '🐨', // Koala
  '🦝', // Waschbär
  '🦛', // Nilpferd
  '🦏', // Nashorn
  '🦙', // Lama
  '🐐', // Ziege
  '🐏', // Widder
  '🐮', // Kuh
  '🐷', // Schwein
  '🐗', // Wildschwein
  '🦆', // Ente
  '🕊️', // Taube
  '🦅', // Adler
  '🦇', // Fledermaus
  '🦚', // Pfau
  '🐧', // Pinguin
  '🦃', // Truthahn
  '🦭', // Robbe
  '🦈', // Hai
  '🐡', // Kugelfisch
  '🐙', // Oktopus
  '🦑', // Kalmar
  '🦐', // Garnele
  '🦞', // Hummer
  '🐌', // Schnecke
  '🐜', // Ameise
  '🕷️', // Spinne
  '🦂', // Skorpion
  '🦟', // Mücke
  '🪰', // Fliege
  '🪲', // Käfer
  '🪳', // Schabe
  '🪱', // Wurm
  '🐀', // Ratte
  '🐿️', // Streifenhörnchen
  '🐵', // Affengesicht
  '🦧', // Orang-Utan
  '🦍', // Gorilla
  '🦬', // Bison
  '🦌', // Hirsch
  '🦘', // Känguru
  '🦥', // Faultier
  '🦦', // Otter
  '🦨', // Stinktier
  '🐘', // Elefant
  '🐃', // Wasserbüffel
  '🐪', // Dromedar
  '🐫', // Trampeltier
  '🫏', // Esel
  '🫎', // Elch
  '🪿', // Gans
  '🪼', // Qualle
  '🦕', // Langhals-Dino
  '🦖', // T-Rex
  '🐂', // Ochse
  '🐔', // Henne
  '🐈‍⬛', // Katze
  '🐥', // Küken von vorn
  '🐣', // Küken im Ei
  '🐕‍🦺', // Assistenzhund
  '🐦‍⬛', // Amsel
  '🐲', // Drachenkopf
  '🐕', // Hund mit Körper
  '🦮', // Blindenführhund
  '🐩', // Pudel
  '🐈', // Katze mit Körper
  '🐅', // Tiger mit Körper
  '🐎', // Galoppierendes Pferd
  '🦄', // Einhorn
  '🐄', // Kuh mit Körper
  '🐖', // Schwein mit Körper
  '🦣', // Mammut
  '🐁', // Maus mit Körper
  '🐰', // Hasengesicht
  '🐻‍❄️', // Eisbär
  '🐼', // Panda
  '🐦', // Vogel
  '🐦‍🔥', // Phönix
  '🫍', // Orca
  '🐠', // Tropenfisch
  '🪸', // Koralle
] as const;

/** Zu kurze Prefixe (z. B. „Roter“) nicht auf ganze Kita-Namen raten. */
const KINDERGARTEN_PREFIX_MATCH_MIN_LENGTH = 8;

function findUniqueKindergartenPrefixIndex(
  names: readonly string[],
  truncatedBase: string,
): number | null {
  if (truncatedBase.length < KINDERGARTEN_PREFIX_MATCH_MIN_LENGTH) {
    return null;
  }
  let matchIndex: number | null = null;
  for (let i = 0; i < names.length; i += 1) {
    const listName = names[i] ?? '';
    if (listName.startsWith(truncatedBase) && listName.length > truncatedBase.length) {
      if (matchIndex !== null) {
        return null;
      }
      matchIndex = i;
    }
  }
  return matchIndex;
}

/** Findet die Tier-ID für aktuelle und gespeicherte Pseudonyme. */
export function findKindergartenNicknameIndex(
  nickname: string,
  locale: SupportedLocale = getEffectiveLocale(),
): number | null {
  const t = nickname.trim().replace(/\s+\d+$/, '');
  if (!t) return null;

  const animalId = getKindergartenAnimalId(t);
  if (animalId !== undefined) return animalId;

  const locales = [
    locale,
    ...Object.keys(KINDERGARTEN_NICKNAMES_BY_ID).filter((key) => key !== locale),
  ] as SupportedLocale[];
  const legacyLists = locales.map((key) => LEGACY_KINDERGARTEN_NICKNAMES[key]);
  const lists = [...locales.map((key) => KINDERGARTEN_NICKNAMES_BY_ID[key]), ...legacyLists];
  for (const list of lists) {
    const exactIndex = list.indexOf(t);
    if (exactIndex >= 0) {
      return exactIndex;
    }
  }

  // Frühere Reservepseudonyme konnten vor dem numerischen Suffix gekürzt werden.
  for (const list of legacyLists) {
    const prefixIndex = findUniqueKindergartenPrefixIndex(list, t);
    if (prefixIndex !== null) {
      return prefixIndex;
    }
  }

  return null;
}

export function findKindergartenNicknameEmoji(
  nickname: string,
  locale: SupportedLocale = getEffectiveLocale(),
  animalId?: number,
): string | null {
  const i = animalId ?? findKindergartenNicknameIndex(nickname, locale);
  return i === null ? null : (KINDERGARTEN_NICKNAME_EMOJIS[i] ?? null);
}

/** Sichtbare Nummer des Tier-Pseudonyms, falls vorhanden. */
export function kindergartenNicknameSequence(nickname: string): string | null {
  return nickname.trim().match(/\s+(\d+)$/)?.[1] ?? null;
}

export type KindergartenNicknameBadge = {
  readonly emoji: string;
  readonly sequence: string | null;
};

export function findKindergartenNicknameBadge(
  nickname: string,
  locale: SupportedLocale = getEffectiveLocale(),
  animalId?: number,
): KindergartenNicknameBadge | null {
  const emoji = findKindergartenNicknameEmoji(nickname, locale, animalId);
  if (!emoji) {
    return null;
  }
  return { emoji, sequence: kindergartenNicknameSequence(nickname) };
}

export function findKindergartenNicknameBadgeLabel(
  nickname: string,
  locale: SupportedLocale = getEffectiveLocale(),
  animalId?: number,
): string | null {
  const badge = findKindergartenNicknameBadge(nickname, locale, animalId);
  if (!badge) {
    return null;
  }
  return badge.sequence ? `${badge.emoji} ${badge.sequence}` : badge.emoji;
}
