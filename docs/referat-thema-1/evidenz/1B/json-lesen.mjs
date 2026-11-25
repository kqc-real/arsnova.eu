// Liest ein Ergebnis-JSON als .json oder .json.gz (große Rohdaten liegen gzip-komprimiert im Repo).
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

/** Fehlt `pfad` (.json), aber `pfad + '.gz'` existiert, wird die komprimierte Datei gelesen. */
export function liesJson(pfad) {
  const datei =
    !pfad.endsWith('.gz') && !existsSync(pfad) && existsSync(`${pfad}.gz`) ? `${pfad}.gz` : pfad;
  const roh = readFileSync(datei);
  return JSON.parse((datei.endsWith('.gz') ? gunzipSync(roh) : roh).toString('utf8'));
}
