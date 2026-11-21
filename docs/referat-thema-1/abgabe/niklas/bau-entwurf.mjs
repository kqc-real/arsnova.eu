#!/usr/bin/env node
// Schneller Probebau nur für Niklas' Teil: das gemeinsame Deck mit seinen nativen Folien (teile.mjs),
// dazu sein Folien-PDF und seine Sprechnotizen in niklas/ausgabe/. Die abgestimmten Ausgaben samt
// Manifest baut jonas/bau.mjs (dort auch niklas-folien.pdf und sprechnotizen-niklas.md).
//
// Aufruf: node docs/referat-thema-1/abgabe/niklas/bau-entwurf.mjs [--ausgabe <ordner>]
// Ausgaben: entwurf-deck.html, entwurf-1a.pdf (nur Niklas' Folien), sprechnotizen-1a.md
/* global console */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { parseArgs } from 'node:util';

import {
  baueSprechnotizen,
  drucke,
  folienNiklas,
  pauseNiklas,
  sprungzieleNiklas,
} from '../jonas/bau.mjs';
import { baueDeck } from '../jonas/deck.mjs';
import { folien, ladeFolienDaten } from '../jonas/folien.mjs';
import { niklasTeile } from './teile.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HIER, '../..');
const REPO = resolve(ROOT, '../..');
const JONAS = join(HIER, '../jonas');
const requireRepo = createRequire(join(REPO, 'package.json'));

/** Deck-HTML (ohne Formatierung) mit nativen Niklas-Folien; für Bau und Tests. */
export function baueEntwurf() {
  const { teil1: n1a, teil2: n1b } = niklasTeile(ROOT);
  const alle = folien(ladeFolienDaten(ROOT));
  const clip = join(JONAS, 'medien/clip.webm');
  const mitClip = existsSync(clip);
  const html = baueDeck(alle, {
    niklas: { teil1: n1a, teil2: n1b },
    ...(mitClip
      ? {
          clip,
          clipInfo: JSON.parse(readFileSync(join(JONAS, 'medien/clip.json'), 'utf8')),
          standbild: join(JONAS, 'medien/clip-standbild.png'),
        }
      : {}),
    eingebettet: true,
  });
  return { html, n1a, n1b, alle };
}

/** Sprechnotizen für Niklas (Stichpunkte und Fließtext), wie sprechnotizen-niklas.md aus bau.mjs. */
export function notizenNiklas(alle, n1a, n1b) {
  return baueSprechnotizen(folienNiklas(alle, { teil1: n1a, teil2: n1b }), {
    person: 'Niklas',
    quelle: '`abgabe/niklas/folien-1a.mjs`, `folien-1b34.mjs` und GT, G0, G9, GD in `folien.mjs`',
    sprungziele: sprungzieleNiklas(alle, { teil1: n1a, teil2: n1b }),
    pause: pauseNiklas(alle, { teil1: n1a, teil2: n1b }),
  });
}

async function main() {
  const { values: o } = parseArgs({ options: { ausgabe: { type: 'string' } } });
  const ausgabe = resolve(o.ausgabe ?? join(HIER, 'ausgabe'));
  const { chromium } = requireRepo('playwright');
  const { format, resolveConfig } = requireRepo('prettier');
  const formatierung = (await resolveConfig(join(REPO, 'package.json'))) ?? {};

  const { html: roh, n1a, n1b, alle } = baueEntwurf();
  mkdirSync(ausgabe, { recursive: true });
  const deck = join(ausgabe, 'entwurf-deck.html');
  writeFileSync(deck, await format(roh, { ...formatierung, parser: 'html' }));
  const browser = await chromium.launch();
  try {
    await drucke(
      browser,
      `${pathToFileURL(deck).href}?druck=niklas`,
      join(ausgabe, 'entwurf-1a.pdf'),
    );
  } finally {
    await browser.close();
  }
  const notizen = notizenNiklas(alle, n1a, n1b);
  writeFileSync(
    join(ausgabe, 'sprechnotizen-1a.md'),
    await format(notizen, { ...formatierung, parser: 'markdown' }),
  );
  console.log(`Entwurf: ${ausgabe}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
