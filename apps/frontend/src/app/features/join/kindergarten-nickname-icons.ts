/**
 * Emoji je Eintrag in KINDERGARTEN (gleiche Reihenfolge wie NICKNAME_LISTS.KINDERGARTEN).
 * Index-basiert, damit alle Locales (de/en/fr/es/it) dieselbe Grafik erhalten.
 */
import type { SupportedLocale } from '../../core/locale-from-path';
import { NICKNAME_LISTS_BY_LOCALE } from './nickname-themes';

const KINDERGARTEN_LOCALES: SupportedLocale[] = ['de', 'en', 'fr', 'es', 'it'];

/** Parallel zu `NICKNAME_LISTS.KINDERGARTEN`. */
export const KINDERGARTEN_NICKNAME_EMOJIS: readonly string[] = [
  '🐘', // Blauer Elefant
  '🦄', // Rotes Einhorn
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
  '🐠', // Goldener Fisch
  '🐦', // Silberner Vogel
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
  '🐎', // Kastanienbraunes Pony
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
  '🦣', // Mondgraues Mammut
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
] as const;

export function kindergartenEmojiAtIndex(index: number): string | null {
  if (index < 0 || index >= KINDERGARTEN_NICKNAME_EMOJIS.length) return null;
  return KINDERGARTEN_NICKNAME_EMOJIS[index] ?? null;
}

/** Findet den Listenindex über alle übersetzten Kindergarten-Strings (gespeicherter Nickname). */
export function findKindergartenNicknameIndex(nickname: string): number | null {
  const t = nickname.trim();
  if (!t) return null;
  for (const loc of KINDERGARTEN_LOCALES) {
    const list = NICKNAME_LISTS_BY_LOCALE[loc].KINDERGARTEN;
    const i = list.indexOf(t);
    if (i >= 0) return i;
  }
  return null;
}

export function findKindergartenNicknameEmoji(nickname: string): string | null {
  const i = findKindergartenNicknameIndex(nickname);
  return i === null ? null : kindergartenEmojiAtIndex(i);
}
