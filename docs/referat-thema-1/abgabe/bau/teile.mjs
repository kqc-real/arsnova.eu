// Niklas' Teile für das gemeinsame Deck (jonas/bau.mjs, bau-entwurf.mjs): 1A nativ aus seiner Messreihe,
// 1B Schritte 3–4 als Gerüst, das sich aus seinen Ergebnis-JSONs füllt. Dazu die Liste aller gelesenen
// Dateien für das Bau-Manifest.

import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eingaben1A, ladeDaten1A } from './daten-1a.mjs';
import { eingaben1B34, ladeDaten1B34 } from './daten-1b34.mjs';
import { folien1A } from './folien-1a.mjs';
import { folien1B34 } from './folien-1b34.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));

/** @param {string} root docs/referat-thema-1 */
export function niklasTeile(root) {
  return { teil1: folien1A(ladeDaten1A(root)), teil2: folien1B34(ladeDaten1B34(root)) };
}

/** Absolute Pfade aller Eingaben von Niklas' Teilen: Daten, Module (ohne Tests), Auswertungshilfe. */
export function eingabenNiklas(root) {
  return [
    ...eingaben1A(root).map((p) => resolve(root, p)),
    ...eingaben1B34(root).map((p) => resolve(root, p)),
    resolve(root, '../../scripts/load/lib/artillery-live-messungen.mjs'),
    resolve(root, 'evidenz/1B/json-lesen.mjs'),
    // M2 zitiert Zeilen aus diesen Dateien (folien-1b34.mjs, CODE_BELEGE_1B34; Test am Checkout)
    ...['openWeightLlmClient.ts', 'openWeightLlmConfig.ts', 'qaSummaryQueue.ts'].map((n) =>
      resolve(root, '../../apps/backend/src/lib', n),
    ),
    ...readdirSync(HIER)
      .filter((n) => n.endsWith('.mjs') && !n.endsWith('.test.mjs'))
      .sort()
      .map((n) => join(HIER, n)),
  ];
}
