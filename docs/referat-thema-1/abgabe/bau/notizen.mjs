// Ablesetexte (notiz) und Stichpunkte liegen lokal in privat/notizen.mjs (nicht Teil der Abgabe).
// Die Folienmodule rufen privat('ID.feld', { werte }) auf; ohne die private Datei bleibt das Feld leer und
// das öffentliche Deck baut trotzdem.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DATEI = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'privat', 'notizen.mjs');
const texte = existsSync(DATEI) ? (await import(pathToFileURL(DATEI).href)).default : null;

/** true, wenn die privaten Notizen vorliegen. */
export const mitNotizen = texte !== null;

/** Notiz oder Stichpunkte einer Folie; undefined ohne lokale Notizen. */
export function privat(schluessel, werte) {
  if (!texte) return undefined;
  const f = texte[schluessel];
  if (!f) throw new Error(`privat/notizen.mjs: Eintrag ${schluessel} fehlt`);
  return f(werte);
}
