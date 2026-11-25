import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Rastert die Seiten von Niklas' Folien-PDF zu 1600 px breiten PNGs (Höhe proportional).
 * Fehlt das PDF oder `pdftoppm`, kommt `[]` zurück (mit einer Warnzeile auf stderr);
 * das Deck zeigt dann eine Platzhalterfolie „Teil Niklas“.
 */
export async function niklasSeiten(pdfPfad, ausgabeOrdner) {
  if (!existsSync(pdfPfad)) {
    console.error(`niklas-seiten: PDF fehlt (${pdfPfad}), Platzhalter wird verwendet.`);
    return [];
  }
  try {
    mkdirSync(ausgabeOrdner, { recursive: true });
    await execFileAsync('pdftoppm', [
      '-png',
      '-scale-to-x',
      '1600',
      '-scale-to-y',
      '-1',
      pdfPfad,
      join(ausgabeOrdner, 'seite'),
    ]);
  } catch (fehler) {
    console.error(
      `niklas-seiten: pdftoppm fehlgeschlagen (${fehler.code ?? fehler.message}), Platzhalter wird verwendet.`,
    );
    return [];
  }
  return readdirSync(ausgabeOrdner)
    .filter((name) => name.endsWith('.png'))
    .sort()
    .map((name) => join(ausgabeOrdner, name));
}
