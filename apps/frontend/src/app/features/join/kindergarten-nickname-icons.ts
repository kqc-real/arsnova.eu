/**
 * Emoji je Eintrag in KINDERGARTEN (gleiche Reihenfolge wie NICKNAME_LISTS.KINDERGARTEN).
 * Index-basiert, damit alle Locales (de/en/fr/es/it) dieselbe Grafik erhalten.
 */
import { getEffectiveLocale, type SupportedLocale } from '../../core/locale-from-path';
import { NICKNAME_LISTS_BY_LOCALE } from './nickname-themes';

/** Parallel zu `NICKNAME_LISTS.KINDERGARTEN`. */
export const KINDERGARTEN_NICKNAME_EMOJIS: readonly string[] = [
  '🐉', // Roter Drache
  '🐸', // Grüner Frosch
  '🦁', // Gelber Löwe
  '🐬', // Lila Delfin
  '🦊', // Oranger Fuchs
  '🦋', // Rosa Schmetterling
  '🐋', // Türkiser Wal
  '🐻', // Brauner Bär
  '🐆', // Schwarzer Panther
  '🐇', // Weißer Hase
  '🐺', // Grauer Wolf
  '🦪', // Goldene Auster
  '🦤', // Silberner Dodo
  '🦜', // Bunter Papagei
  '🦢', // Hellblauer Schwan
  '🐍', // Dunkelgrüne Schlange
  '🐝', // Zitronengelbe Biene
  '🐴', // Pfirsichfarbenes Pferd
  '🦎', // Mintgrüne Eidechse
  '🦀', // Korallenroter Krebs
  '🐞', // Himmelblauer Marienkäfer
  '🐭', // Olivgrüne Maus
  '🦔', // Beiger Igel
  '🦩', // Lachsfarbener Flamingo
  '🦉', // Lavendelblaue Eule
  '🐓', // Senfgelber Hahn
  '🦫', // Tannengrüner Biber
  '🐛', // Apfelgrüne Raupe
  '🐹', // Maulwurfsgrauer Hamster
  '🐒', // Kastanienbrauner Pavian
  '🐊', // Salbeigrünes Krokodil
  '🦡', // Terrakottafarbener Dachs
  '🦗', // Smaragdgrüne Libelle (näherungsweise)
  '🐤', // Safrangelber Vogel
  '🐳', // Indigoblauer Wal
  '🐢', // Magenta Schildkröte
  '🐟', // Petrolfarbener Fisch
  '🐑', // Vanillefarbenes Lamm
  '🐶', // Türkisfarbener Hund
  '🐱', // Korallenfarbene Katze
  '🦒', // Himmelblaue Giraffe
  '🦓', // Zitronengrünes Zebra
  '🐯', // Kupferfarbener Tiger
  '🐨', // Moosgrüner Koala
  '🦝', // Kirschroter Waschbär
  '🦛', // Saphirblaues Nilpferd
  '🦏', // Sandfarbenes Nashorn
  '🦙', // Jadegrünes Lama
  '🐐', // Sonnengelbe Ziege
  '🐏', // Nebelgrauer Widder
  '🐮', // Brombeerfarbene Kuh
  '🐷', // Tannengrünes Schwein
  '🐗', // Honigfarbener Eber
  '🦆', // Petrolblaue Ente
  '🕊️', // Cremefarbene Taube
  '🦅', // Rubinfarbener Adler
  '🦇', // Mitternachtsblaue Fledermaus
  '🦚', // Pistaziengrüner Pfau
  '🐧', // Aprikosenfarbener Pinguin
  '🦃', // Malvenfarbener Truthahn
  '🦭', // Bernsteinfarbene Robbe
  '🦈', // Karamellfarbener Hai
  '🐡', // Eisblauer Kugelfisch
  '🐙', // Rosenholzfarbener Oktopus
  '🦑', // Mintfarbener Tintenfisch
  '🦐', // Safrangerote Garnele
  '🦞', // Lavendelfarbener Hummer
  '🐌', // Honiggelbe Schnecke
  '🐜', // Silbergraue Ameise
  '🕷️', // Kastanienrote Spinne
  '🦂', // Olivfarbener Skorpion
  '🦟', // Türkisfarbene Mücke
  '🪰', // Sonnorange Fliege
  '🪲', // Pflaumenfarbener Käfer
  '🪳', // Karamellfarbene Schabe
  '🪱', // Regenbogenfarbiger Wurm
  '🐀', // Wolkengraue Ratte
  '🐿️', // Meeresgrünes Eichhörnchen
  '🐵', // Kirschrosa Affe
  '🦧', // Azurfarbener Orang-Utan
  '🦍', // Waldgrüner Gorilla
  '🦬', // Perlmuttfarbener Bison
  '🦌', // Silberbraunes Reh
  '🦘', // Korallenfarbenes Känguru
  '🦥', // Nebelgraues Faultier
  '🦦', // Seegrüner Otter
  '🦨', // Veilchenfarbenes Stinktier
  '🐘', // Blauer Elefant
  '🐃', // Mahagonifarbener Wasserbüffel
  '🐪', // Sandbeiges Kamel
  '🐫', // Dünenfarbenes Trampeltier
  '🫏', // Schiefergrauer Esel
  '🫎', // Moosbrauner Elch
  '🪿', // Schneeweiße Gans
  '🪼', // Lagunenblaue Qualle
  '🦕', // Bernsteinfarbener Langhals
  '🦖', // Kirschroter T-Rex
  '🐂', // Stahlgrauer Ochse
  '🐔', // Honiggelbe Henne
  '🐈‍⬛', // Schwarze Katze
  '🐥', // Goldgelbes Küken
  '🐣', // Silbernes Schlüpfküken
  '🐕‍🦺', // Türkiser Assistenzhund
  '🐦‍⬛', // Kobaltblauer Rabe
  '🐲', // Korallenfarbener Drachenkopf
] as const;

export function kindergartenEmojiAtIndex(index: number): string | null {
  if (index < 0 || index >= KINDERGARTEN_NICKNAME_EMOJIS.length) return null;
  return KINDERGARTEN_NICKNAME_EMOJIS[index] ?? null;
}

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

function kindergartenListsByLocalePreference(
  locale: SupportedLocale,
): readonly (readonly string[])[] {
  const localizedList = NICKNAME_LISTS_BY_LOCALE[locale].KINDERGARTEN;
  const otherLists = (
    Object.entries(NICKNAME_LISTS_BY_LOCALE) as [
      SupportedLocale,
      (typeof NICKNAME_LISTS_BY_LOCALE)[SupportedLocale],
    ][]
  )
    .filter(([candidateLocale]) => candidateLocale !== locale)
    .map(([, lists]) => lists.KINDERGARTEN);
  return [localizedList, ...otherLists];
}

/** Findet den Listenindex in der aktiven UI-Locale oder explizit angegebenen Locale. */
export function findKindergartenNicknameIndex(
  nickname: string,
  locale: SupportedLocale = getEffectiveLocale(),
): number | null {
  const t = nickname.trim().replace(/\s+\d+$/, '');
  if (!t) return null;

  const lists = kindergartenListsByLocalePreference(locale);
  for (const list of lists) {
    const exactIndex = list.indexOf(t);
    if (exactIndex >= 0) {
      return exactIndex;
    }
  }

  for (const list of lists) {
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
): string | null {
  const i = findKindergartenNicknameIndex(nickname, locale);
  return i === null ? null : kindergartenEmojiAtIndex(i);
}

/** Fortlaufende Reserve-Nummer nach erschöpfter Kindergarten-Liste, sonst null. */
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
): KindergartenNicknameBadge | null {
  const emoji = findKindergartenNicknameEmoji(nickname, locale);
  if (!emoji) {
    return null;
  }
  return { emoji, sequence: kindergartenNicknameSequence(nickname) };
}

export function findKindergartenNicknameBadgeLabel(
  nickname: string,
  locale: SupportedLocale = getEffectiveLocale(),
): string | null {
  const badge = findKindergartenNicknameBadge(nickname, locale);
  if (!badge) {
    return null;
  }
  return badge.sequence ? `${badge.emoji} ${badge.sequence}` : badge.emoji;
}
