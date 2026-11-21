// Tests für das Browser-Deck (Task 7): Playwright über file://, Chromium aus den Repo-Abhängigkeiten.
// page.evaluate-Rückrufe laufen im Browser:
/* global document, getComputedStyle, location */
import { Buffer } from 'node:buffer';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { baueDeck } from './deck.mjs';
import { folien, ladeFolienDaten } from './folien.mjs';
import { kameraViewBox, lupeRahmen, zoomDeckkraft } from './grafik.mjs';
import { kopfBefunde, layoutBefunde } from './layout-pruefung.mjs';
import { MARKEN, WEG_AUFTRAG, markeText, markeVon, wegMarke } from './wegkarte.mjs';

const MARKEN_STATIONEN = () =>
  Object.fromEntries(Object.entries(WEG_AUFTRAG.stationen).map(([n, s]) => [n, s.anteil]));

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HIER, '../..');
const requireRepo = createRequire(resolve(HIER, '../../../../package.json'));
const { chromium } = requireRepo('playwright');

const F = folien(ladeFolienDaten(ROOT));
const JONAS = F.filter((f) => f.teil === 'jonas');
const RAHMEN = F.filter((f) => f.teil === 'rahmen');
const RESERVE = F.filter((f) => f.teil === 'reserve');

let ordner;
let browser;
let pngs;
let deckOhneNiklas;
let deckMitNiklas;

before(async () => {
  ordner = mkdtempSync(join(tmpdir(), 'deck-test-'));
  browser = await chromium.launch();
  // Drei kleine 16:9-PNGs als Stellvertreter für Niklas' Seiten.
  const seite = await browser.newPage({ viewport: { width: 320, height: 180 } });
  pngs = [];
  for (const [i, farbe] of ['#dde', '#ded', '#edd'].entries()) {
    await seite.setContent(
      `<body style="margin:0;background:${farbe}"><h1>Niklas ${i}</h1></body>`,
    );
    const pfad = join(ordner, `niklas-${i}.png`);
    await seite.screenshot({ path: pfad });
    pngs.push(pfad);
  }
  await seite.close();
  deckOhneNiklas = join(ordner, 'ohne.html');
  writeFileSync(
    deckOhneNiklas,
    baueDeck(F, { niklas: { teil1: [], teil2: [] }, eingebettet: true }),
  );
  deckMitNiklas = join(ordner, 'mit.html');
  writeFileSync(
    deckMitNiklas,
    baueDeck(F, { niklas: { teil1: pngs.slice(0, 2), teil2: pngs.slice(2) }, eingebettet: true }),
  );
});

after(async () => {
  await browser?.close();
  if (ordner) rmSync(ordner, { recursive: true, force: true });
});

/** Öffnet ein Deck und sammelt Konsolenfehler, Seitenfehler und Anfragen. */
async function oeffne(pfad, { reducedMotion = 'no-preference', hash = '' } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    reducedMotion,
  });
  const page = await context.newPage();
  const fehler = [];
  const anfragen = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') fehler.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => fehler.push(`pageerror: ${e.message}`));
  page.on('request', (r) => anfragen.push(r.url()));
  await page.goto(pathToFileURL(pfad).href + hash);
  await page.evaluate(() => document.fonts.ready);
  return { page, context, fehler, anfragen };
}

const aktuelleId = (page) =>
  page.evaluate(() => document.querySelector('.folie[data-aktuell]')?.dataset.id);

async function geheZu(page, id) {
  for (let i = 0; i < 80 && (await aktuelleId(page)) !== id; i++) {
    await page.keyboard.press('ArrowRight');
  }
  assert.equal(await aktuelleId(page), id);
}

test('baueDeck verlangt eingebettete Ausgabe', () => {
  assert.throws(() => baueDeck(F, { niklas: { teil1: [], teil2: [] }, eingebettet: false }));
});

test('Deck lädt ohne Konsolenfehler und ohne Anfragen außer der Datei selbst', async () => {
  for (const pfad of [deckOhneNiklas, deckMitNiklas]) {
    const { page, context, fehler, anfragen } = await oeffne(pfad);
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    assert.deepEqual(fehler, []);
    const fremd = anfragen.filter((u) => !u.startsWith('data:') && u !== pathToFileURL(pfad).href);
    assert.deepEqual(fremd, [], 'nur die Datei selbst wird geladen');
    await context.close();
  }
});

test('Anzahl Folien = Rahmen + Niklas + Jonas, Reserve getrennt', async () => {
  const faelle = [
    [deckOhneNiklas, 2], // je eine Platzhalterfolie „Teil Niklas“
    [deckMitNiklas, pngs.length],
  ];
  for (const [pfad, niklas] of faelle) {
    const { page, context } = await oeffne(pfad);
    const z = await page.evaluate(() => ({
      haupt: document.querySelectorAll('.folie:not([data-teil="reserve"])').length,
      niklas: document.querySelectorAll('.folie[data-teil="niklas"]').length,
      jonas: [...document.querySelectorAll('.folie[data-teil="jonas"]')].map((s) => s.dataset.id),
      nachG9: document.querySelector('.folie[data-id="G9"]').nextElementSibling?.dataset.id,
      reserve: document.querySelectorAll('.folie[data-teil="reserve"]').length,
      reihenfolge: [...document.querySelectorAll('.folie')].map((s) => s.dataset.teil),
      platzhalter: [...document.querySelectorAll('.folie[data-teil="niklas"] .folie-titel')].map(
        (t) => t.textContent,
      ),
      bilder: document.querySelectorAll('.folie[data-teil="niklas"] img[src^="data:image/png"]')
        .length,
    }));
    assert.equal(z.haupt, RAHMEN.length + niklas + JONAS.length);
    assert.equal(z.niklas, niklas);
    assert.deepEqual(
      z.jonas,
      JONAS.map((f) => f.id),
    );
    assert.equal(z.reserve, RESERVE.length);
    // Nach dem Fazit der Nachweisumfang (GN, Jonas), dann der Dank (Durchsicht 2026-11-18)
    assert.equal(z.nachG9, 'GN', 'Nachweisumfang direkt nach dem Fazit');
    // Reihenfolge (Design 2026-11-15, Abschnitt 3): GT und G0, Niklas 1A, Jonas, Niklas 1B 3–4,
    // G9 und GD, Anhang (J16), Reserve
    const block = z.reihenfolge.filter((t, i, a) => i === 0 || a[i - 1] !== t);
    assert.deepEqual(block, ['rahmen', 'niklas', 'jonas', 'niklas', 'rahmen', 'jonas', 'reserve']);
    if (niklas === 2) {
      assert.deepEqual(z.platzhalter, ['Teil Niklas', 'Teil Niklas']);
    } else {
      assert.equal(z.bilder, niklas);
    }
    await context.close();
  }
});

test('Fußzeile zeigt Seitenzahl im Vortrag und Quelle', async () => {
  const { page, context } = await oeffne(deckOhneNiklas);
  const fuss = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.folie')].map((s) => [
        s.dataset.id,
        s.querySelector('.folie-fuss')?.textContent ?? null,
      ]),
    ),
  );
  const gesamt = RAHMEN.length + 2 + JONAS.length;
  // ohne führende Null wie bei Niklas („2 / 9“); vor J1 stehen GT, G0 und Niklas' 1A (Platzhalter)
  assert.match(fuss.GT, new RegExp(`^1 / ${gesamt} · `));
  assert.match(fuss.G0, new RegExp(`^2 / ${gesamt} · `));
  assert.match(fuss.GK, new RegExp(`^3 / ${gesamt} · `));
  assert.match(fuss.J1, new RegExp(`^5 / ${gesamt} · `));
  assert.match(fuss.R1, /^Reserve R1 · /);
  assert.match(fuss.J16b, new RegExp(`^${gesamt} / ${gesamt} · `));
  await context.close();
});

test('Läufer: ein Element für alle Folien von J1 bis J15, Punkt an der Station der Folie', async () => {
  const { page, context } = await oeffne(deckOhneNiklas);
  const marker = () =>
    page.evaluate(() => {
      const m = document.querySelector('.weg-laeufer[data-an]');
      if (!m) return { aktiv: null, sichtbar: false };
      // Kennung am Element: bleibt sie über alle Folien gleich, ist es derselbe Knoten
      m.dataset.pruefKnoten ??= String(Math.random());
      return {
        knoten: m.dataset.pruefKnoten,
        weg: m.dataset.weg,
        aktiv: m.dataset.aktiv,
        punkt: m.querySelector('.weg-punkt').hasAttribute('data-an'),
        name: m.querySelector('.weg-name').textContent,
        sichtbar: getComputedStyle(m).visibility === 'visible',
      };
    });
  await geheZu(page, 'G0');
  assert.deepEqual(await marker(), { aktiv: null, sichtbar: false }, 'Rahmen ohne Wegkarte');
  await geheZu(page, 'J1');
  const erster = (await marker()).knoten;
  const verlauf = [];
  for (const f of JONAS.filter((x) => !x.anhang)) {
    await geheZu(page, f.id);
    const m = await marker();
    assert.equal(m.knoten, erster, `${f.id}: derselbe Knoten`);
    assert.equal(m.weg, 'auftrag', f.id);
    assert.ok(m.sichtbar, f.id);
    verlauf.push(`${f.id}:${m.aktiv || '-'}`);
    // J3 zeigt den Weg groß mit eigenem Marker: oben links der ganze Weg ohne Punkt
    const station = f.inhalt.includes('class="auftrag"') ? null : f.station;
    assert.equal(m.punkt, Boolean(station), f.id);
    assert.equal(m.aktiv, station ?? '', f.id);
    assert.equal(m.name, station ? markeText(`station:${station}`) : m.name, f.id);
  }
  assert.ok(verlauf.includes('J5:klick') && verlauf.includes('J13:gate'), verlauf.join(' '));
  await context.close();
});

test('Läufer: Punkt fährt, Säume und Zeichen blenden; Saum und Zeichen nur auf den gemeinten Folien', async () => {
  const { page, context } = await oeffne(deckOhneNiklas);
  const an = () =>
    page.evaluate(() => {
      const m = document.querySelector('.weg-laeufer[data-an]');
      return {
        saeume: [...m.querySelectorAll('.weg-saum[data-an]')].map((g) => g.dataset.saum),
        saetze: [...m.querySelectorAll('.weg-satz[data-an]')].map((g) => g.dataset.satz),
      };
    });
  const erwartet = {
    J5: { saeume: [], saetze: [] },
    J8: { saeume: ['netz|var(--bernstein)'], saetze: [] },
    J8b: { saeume: ['netz|var(--bernstein)'], saetze: [] },
    J9: { saeume: ['ganz|var(--blau)'], saetze: [] },
    J10: { saeume: [], saetze: [] },
    J10b: { saeume: [], saetze: ['stopp'] },
    J11: { saeume: [], saetze: ['spaet'] },
    J12: { saeume: [], saetze: [] },
  };
  for (const [id, soll] of Object.entries(erwartet)) {
    await geheZu(page, id);
    assert.deepEqual(await an(), soll, id);
  }
  // Fahrt J5 → J5b: offset-distance läuft als CSS-Übergang, der Punkt steht mittendrin zwischen den Stationen
  await page.keyboard.press('Home');
  await geheZu(page, 'J5');
  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const fahrt = await page.evaluate(() => {
    const p = document.querySelector('.weg-laeufer[data-an] .weg-punkt');
    return {
      laeuft: document
        .getAnimations()
        .some((a) => a.effect?.target === p && a.transitionProperty === 'offset-distance'),
      ist: parseFloat(getComputedStyle(p).offsetDistance),
    };
  });
  const st = MARKEN_STATIONEN();
  assert.ok(fahrt.laeuft, 'Fahrt als Übergang');
  assert.ok(fahrt.ist > st.klick && fahrt.ist < st.kontext, `mittendrin: ${fahrt.ist}`);
  await context.close();
});

test('Reduzierte Bewegung: keine Übergänge an der Wegkarte, Zustand sofort', async () => {
  const normal = await oeffne(deckOhneNiklas);
  await geheZu(normal.page, 'J5');
  await normal.page.keyboard.press('ArrowRight');
  assert.ok(
    (await normal.page.evaluate(() => document.getAnimations().length)) > 0,
    'Gegenprobe: ohne reduzierte Bewegung fährt der Punkt',
  );
  await normal.context.close();

  const ruhig = await oeffne(deckOhneNiklas, { reducedMotion: 'reduce' });
  await geheZu(ruhig.page, 'J4');
  for (let i = 0; i < 12; i++) {
    await ruhig.page.keyboard.press('ArrowRight');
    assert.equal(await ruhig.page.evaluate(() => document.getAnimations().length), 0);
    const z = await ruhig.page.evaluate(() => {
      const m = document.querySelector('.weg-laeufer[data-an]');
      const p = m.querySelector('.weg-punkt');
      return {
        dauer: getComputedStyle(p).transitionDuration,
        aktiv: m.dataset.aktiv,
        ist: getComputedStyle(p).offsetDistance,
        soll: p.style.offsetDistance,
      };
    });
    assert.match(z.dauer, /^0s(, 0s)*$/);
    if (z.aktiv) assert.equal(z.ist, z.soll);
  }
  await ruhig.context.close();
});

test('J13: der Clip startet erst auf Tastendruck, der nächste Druck geht weiter', async () => {
  const medien = join(HIER, 'medien');
  const pfad = join(ordner, 'clip-klick.html');
  writeFileSync(
    pfad,
    baueDeck(F, {
      niklas: { teil1: [], teil2: [] },
      clip: join(medien, 'clip.webm'),
      clipInfo: JSON.parse(readFileSync(join(medien, 'clip.json'), 'utf8')),
      standbild: join(medien, 'clip-standbild.png'),
      eingebettet: true,
    }),
  );
  const { page, context } = await oeffne(pfad);
  await geheZu(page, 'J12');
  // J12 hat zwei Aufbaustufen (Stimme, Verwurf); der dritte Druck wechselt auf J13.
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  assert.equal(await aktuelleId(page), 'J13');
  await page.waitForTimeout(400);
  const laeuft = () =>
    page.evaluate(() => !document.querySelector('.folie[data-id="J13"] video').paused);
  assert.equal(await laeuft(), false, 'kein Autoplay');
  // Seit 2026-11-16 erst die zwei Aufbaustufen (Raster rot, Ablation), dann der Clip (deck.js: Aufbau vor Clip)
  for (let i = 1; i <= 2; i++) {
    await page.keyboard.press('ArrowRight');
    assert.equal(
      await page.evaluate(
        () => document.querySelector('.folie[data-id="J13"]').dataset.aufbauStufe,
      ),
      String(i),
    );
    assert.equal(await laeuft(), false, `Stufe ${i} startet den Clip nicht`);
  }
  await page.keyboard.press('ArrowRight');
  assert.equal(await aktuelleId(page), 'J13', 'erster Druck nach den Stufen startet den Clip');
  await page.waitForFunction(() => !document.querySelector('.folie[data-id="J13"] video').paused);
  // Druck während des Clips: ans Ende springen (Ergebnisbild), auf der Folie bleiben
  await page.keyboard.press('ArrowRight');
  assert.equal(await aktuelleId(page), 'J13', 'Druck während des Clips bleibt auf J13');
  const amEnde = await page.evaluate(() => {
    const v = document.querySelector('.folie[data-id="J13"] video');
    return v.paused && v.currentTime >= v.duration - 0.05;
  });
  assert.equal(amEnde, true, 'Clip steht auf dem letzten Bild');
  await page.keyboard.press('ArrowRight');
  assert.equal(await aktuelleId(page), 'J13b');
  // Zurück: Clip wieder am Anfang, wartet auf den Tastendruck
  await page.keyboard.press('ArrowLeft');
  assert.equal(await aktuelleId(page), 'J13');
  const neu = await page.evaluate(() => {
    const v = document.querySelector('.folie[data-id="J13"] video');
    return { paused: v.paused, t: v.currentTime };
  });
  assert.deepEqual(neu, { paused: true, t: 0 });
  await page.keyboard.press('ArrowRight');
  assert.equal(
    await aktuelleId(page),
    'J13',
    'nach dem Zurückgehen startet ein Druck den Clip neu',
  );
  await context.close();
});

test('J10 zoomt in drei Schritten über kameraViewBox, Beschriftungen über zoomDeckkraft', async () => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const { page, context, fehler } = await oeffne(deckOhneNiklas, { reducedMotion });
    await geheZu(page, 'J9');
    // J9 baut sich in zwei Stufen auf; der dritte Druck wechselt auf J10.
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    assert.equal(await aktuelleId(page), 'J10');
    const stufen = await page.evaluate(() =>
      JSON.parse(document.querySelector('.folie[data-id="J10"]').dataset.zoomStufen),
    );
    assert.equal(stufen.length, 4);
    assert.deepEqual([stufen[0], stufen[3]], [0, 1]);
    for (let i = 0; i < stufen.length; i++) {
      if (i > 0) await page.keyboard.press('ArrowRight');
      assert.equal(await aktuelleId(page), 'J10', `Schritt ${i} bleibt auf J10`);
      await page.waitForFunction(
        (s) => document.querySelector('.folie[data-id="J10"]').dataset.zoomFertig === String(s),
        i,
      );
      const ist = await page.evaluate(() => {
        const k = document.querySelector('.folie[data-id="J10"] svg.kamera');
        const [x, y, w, h] = k.getAttribute('viewBox').split(/\s+/).map(Number);
        const deckkraft = [...k.ownerSVGElement.querySelectorAll('[data-zoom-von]')].map((g) => ({
          von: Number(g.dataset.zoomVon),
          bis: Number(g.dataset.zoomBis),
          o: Number(g.getAttribute('opacity')),
        }));
        const spalten = [...document.querySelectorAll('.folie[data-id="J10"] [data-spalte]')].map(
          (g) => g.dataset.spalte,
        );
        return { x, y, w, h, deckkraft, spalten };
      });
      const soll = kameraViewBox(stufen[i]);
      // Übersichtskarte: Lupenrahmen folgt dem Ausschnitt (gleiche Formel wie lupeRahmen)
      const lupe = await page.evaluate(() => {
        const r = document.querySelector('.folie[data-id="J10"] [data-lupe]');
        return ['x', 'y', 'width', 'height'].map((a) => Number(r.getAttribute(a)));
      });
      const lSoll = lupeRahmen(stufen[i]);
      [lSoll.x, lSoll.y, lSoll.w, lSoll.h].forEach((v, j) =>
        assert.ok(
          Math.abs(lupe[j] - v) <= 1e-4 * lSoll.w,
          `Stufe ${i} Lupe ${j}: ${lupe[j]} statt ${v}`,
        ),
      );
      for (const k of ['x', 'y', 'w', 'h']) {
        assert.ok(
          Math.abs(ist[k] - soll[k]) <= 1e-4 * soll.w,
          `Stufe ${i} ${k}: ${ist[k]} statt ${soll[k]}`,
        );
      }
      for (const g of ist.deckkraft) {
        assert.ok(Math.abs(g.o - zoomDeckkraft(stufen[i], g.von, g.bis)) < 1e-3);
      }
      // Kennzahlen unter dem Feld: Transport ab Stufe 2, Netz ab Stufe 3
      assert.deepEqual(ist.spalten, ['inferenz', 'transport', 'netz']);
      const sichtbar = await page.evaluate(() =>
        [...document.querySelectorAll('.folie[data-id="J10"] [data-spalte]')].map((g) =>
          Number(g.getAttribute('opacity') ?? 1),
        ),
      );
      assert.deepEqual(
        sichtbar,
        [
          [1, 0, 0],
          [1, 0, 0],
          [1, 1, 0],
          [1, 1, 1],
        ][i],
        `Stufe ${i}`,
      );
    }
    await page.keyboard.press('ArrowRight');
    assert.equal(await aktuelleId(page), 'J10a');
    // zurück: J10 im Endzustand, dann schrittweise heraus
    await page.keyboard.press('ArrowLeft');
    assert.equal(await aktuelleId(page), 'J10');
    assert.equal(
      await page.evaluate(() => document.querySelector('.folie[data-id="J10"]').dataset.zoomStufe),
      '3',
    );
    await page.keyboard.press('ArrowLeft');
    assert.equal(await aktuelleId(page), 'J10');
    if (reducedMotion === 'reduce') {
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    }
    assert.deepEqual(fehler, []);
    await context.close();
  }
});

test('J9 und J15 bauen sich auf Tastendruck in zwei Stufen auf; reduziert ohne Übergang, Druck im Endbild', async () => {
  const stand = (page, id) =>
    page.evaluate((i) => {
      const f = document.querySelector(`.folie[data-id="${i}"]`);
      const els = [...f.querySelectorAll('[data-ab]')];
      return {
        stufe: f.dataset.aufbauStufe,
        an: els.filter((e) => e.hasAttribute('data-an')).length,
        alle: els.length,
        sichtbar: els.filter((e) => getComputedStyle(e).opacity === '1').length,
        dauer: [...new Set(els.map((e) => getComputedStyle(e).transitionDuration))],
      };
    }, id);
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const { page, context, fehler } = await oeffne(deckOhneNiklas, { reducedMotion });
    for (const [id, naechste] of [
      ['J9', 'J10'],
      ['J15', 'N2'], // ohne Niklas' Teile: Platzhalter N2 (1B 3–4) folgt auf J15
    ]) {
      await geheZu(page, id);
      let s = await stand(page, id);
      assert.equal(s.stufe, '0', id);
      assert.equal(s.an, 0, `${id}: Stufe 0 zeigt nichts von Stufe 1–2`);
      if (reducedMotion === 'reduce') assert.deepEqual(s.dauer, ['0s'], id);
      await page.keyboard.press('ArrowRight');
      assert.equal(await aktuelleId(page), id);
      await page.keyboard.press('ArrowRight');
      s = await stand(page, id);
      assert.equal(s.an, s.alle, `${id}: Stufe 2 zeigt alles`);
      // zurück baut ab, statt die Folie zu verlassen
      await page.keyboard.press('ArrowLeft');
      assert.equal((await stand(page, id)).stufe, '1');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      assert.equal(await aktuelleId(page), naechste);
      // rückwärts betreten: Endbild
      await page.keyboard.press('ArrowLeft');
      assert.equal((await stand(page, id)).an, s.alle, `${id}: rückwärts im Endbild`);
      await page.keyboard.press('ArrowRight');
    }
    assert.deepEqual(fehler, []);
    await context.close();
  }
  // Druck: alle Stufen sichtbar, auch auf der aktuellen Folie in Stufe 0
  const { page, context } = await oeffne(deckOhneNiklas);
  await geheZu(page, 'J9');
  await page.emulateMedia({ media: 'print' });
  // Das change-Ereignis von matchMedia('print') kommt asynchron.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.folie [data-ab]')].every((e) => e.hasAttribute('data-an')),
  );
  for (const id of ['J9', 'J15']) {
    const s = await stand(page, id);
    assert.equal(s.sichtbar, s.alle, `${id}: Druck zeigt alle Stufen`);
  }
  await context.close();
});

test('Teilleiste oben rechts: aktueller Teil markiert, nicht auf Titel, Fahrplan, Dank, Anhang und Reserve', async () => {
  const { page, context } = await oeffne(deckOhneNiklas);
  const leisten = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.folie')].map((f) => [
        f.dataset.id,
        f.querySelector('.teilleiste li[data-aktiv]')?.textContent ?? null,
      ]),
    ),
  );
  for (const id of ['GT', 'G0', 'GD']) assert.equal(leisten[id], null, id);
  // Reihenfolge der Teile in der Leiste wie im Fahrplan: 1A zuerst
  const reihe = await page.evaluate(() =>
    [...document.querySelectorAll('.folie[data-id="J1"] .teilleiste li')].map((l) => l.textContent),
  );
  assert.deepEqual(reihe, ['1A', '1C, 1B 1–2', '1B 3–4', 'Fazit']);
  assert.equal(leisten.J16, null);
  assert.equal(leisten.R1, null);
  for (const f of JONAS.filter((x) => !x.anhang)) assert.equal(leisten[f.id], '1C, 1B 1–2', f.id);
  assert.equal(leisten.G9, 'Fazit');
  await context.close();
});

test('Tasten: Home, End, Bild ab/auf, Leertaste; Reserve-Übersicht mit r', async () => {
  const { page, context } = await oeffne(deckOhneNiklas);
  await page.keyboard.press('End');
  assert.equal(await aktuelleId(page), 'J16b');
  await page.keyboard.press('Home');
  assert.equal(await aktuelleId(page), 'GT');
  await page.keyboard.press('PageDown');
  assert.equal(await aktuelleId(page), 'G0');
  await page.keyboard.press('PageDown');
  assert.equal(await aktuelleId(page), 'GK', 'Systembild nach dem Fahrplan');
  // GK baut sich in drei Stufen auf; der vierte Druck wechselt zu Niklas.
  for (let i = 0; i < 3; i++) await page.keyboard.press('PageDown');
  assert.equal(await aktuelleId(page), 'GK');
  await page.keyboard.press('PageDown');
  assert.equal(await aktuelleId(page), 'N1', 'Niklas beginnt mit 1A (Platzhalter)');
  await page.keyboard.press('PageDown');
  assert.equal(await aktuelleId(page), 'J1', 'Jonas folgt auf Niklas’ 1A');
  await page.keyboard.press('Space');
  assert.equal(await aktuelleId(page), 'J2');
  await page.keyboard.press('PageUp');
  await geheZu(page, 'J7');

  await page.keyboard.press('r');
  const knoepfe = await page.evaluate(() =>
    [...document.querySelectorAll('.reserve-uebersicht button[data-ziel]')].map(
      (b) => b.dataset.ziel,
    ),
  );
  assert.deepEqual(
    knoepfe,
    RESERVE.map((f) => f.id),
  );
  assert.ok(await page.locator('.reserve-uebersicht').isVisible());
  assert.ok(
    await page.evaluate(() => document.activeElement?.closest('.reserve-uebersicht') !== null),
    'Fokus liegt in der Übersicht',
  );
  await page.keyboard.press('2');
  assert.equal(await aktuelleId(page), RESERVE[1].id);
  assert.ok(!(await page.locator('.reserve-uebersicht').isVisible()));
  await page.keyboard.press('ArrowRight');
  assert.equal(await aktuelleId(page), RESERVE[2].id);
  await page.keyboard.press('Escape');
  assert.equal(await aktuelleId(page), 'J7', 'Escape führt zurück in den Vortrag');

  await page.keyboard.press('r');
  await page.keyboard.press('r');
  assert.ok(!(await page.locator('.reserve-uebersicht').isVisible()));
  assert.equal(await aktuelleId(page), 'J7');
  await context.close();
});

test('Sprungmarke im Adressfeld öffnet die Folie', async () => {
  const { page, context } = await oeffne(deckOhneNiklas, { hash: '#J8' });
  assert.equal(await aktuelleId(page), 'J8');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => location.hash), '#J8b');
  await context.close();
});

test('keine http(s)-Verweise außer im Quellenverzeichnis', async () => {
  for (const pfad of [deckOhneNiklas, deckMitNiklas]) {
    // Ein Quellenverzeichnis (Folie mit quellenverzeichnis: true) steht zwischen diesen Marken.
    const html = readFileSync(pfad, 'utf8').replace(/<!--quellen-->[\s\S]*?<!--\/quellen-->/g, '');
    assert.deepEqual(html.match(/https?:\/\/[^\s"'<)]*/g) ?? [], []);
  }
});

test('Schriften Inter 600 und IBM Plex Mono 400 sind geladen', async () => {
  const { page, context } = await oeffne(deckOhneNiklas);
  const r = await page.evaluate(async () => {
    await document.fonts.ready;
    const geladen = [...document.fonts]
      .filter((f) => f.status === 'loaded')
      .map((f) => `${f.family.replace(/"/g, '')} ${f.weight}`);
    return {
      inter: document.fonts.check('600 24px Inter'),
      plex: document.fonts.check('400 24px "IBM Plex Mono"'),
      geladen,
    };
  });
  assert.ok(r.inter && r.plex);
  assert.ok(r.geladen.includes('Inter 600'), r.geladen.join(', '));
  assert.ok(r.geladen.includes('IBM Plex Mono 400'), r.geladen.join(', '));
  await context.close();
});

test('Druck: jede Folie eine Seite 1600 × 900, J10 im Endzustand, feste Wegkarte je Folie', async () => {
  const seiten = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const { page, context } = await oeffne(deckOhneNiklas);
  await geheZu(page, 'J10'); // Zoom steht auf Stufe 0
  await page.emulateMedia({ media: 'print' });
  // Das change-Ereignis von matchMedia('print') kommt asynchron: auf den Endzustand warten.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.folie[data-zoom-stufen]')].every(
      (s) => s.dataset.zoomFertig === String(JSON.parse(s.dataset.zoomStufen).length - 1),
    ),
  );
  // Druck: der Läufer ist aus, jede Hauptfolie trägt ihre feste Marke im Endbild (Ort, Punkt, Säume, Zeichen)
  const statisch = await page.evaluate(() => ({
    laeufer: [...document.querySelectorAll('.weg-laeufer')].map((l) => getComputedStyle(l).display),
    folien: [...document.querySelectorAll('.folie')].map((s) => {
      const m = s.querySelector(':scope > .weg-marke');
      return [
        s.dataset.id,
        m ? `${m.dataset.marke}|${m.dataset.aktiv ?? ''}` : null,
        m ? getComputedStyle(m).display : 'fehlt',
        m
          ? [...m.querySelectorAll('.weg-zeichen-reihe')]
              .filter((r) => getComputedStyle(r.closest('.weg-stufe') ?? r).opacity === '1')
              .map((r) => [...r.querySelectorAll('[data-zeichen]')].map((z) => z.dataset.zeichen))
          : [],
      ];
    }),
  }));
  assert.ok(
    statisch.laeufer.every((d) => d === 'none'),
    'Läufer nicht im Druck',
  );
  for (const [id, html, display, zeichen] of statisch.folien) {
    const f = F.find((x) => x.id === id);
    const name = f && markeVon(f, { eigenerWeg: f.inhalt.includes('class="auftrag"') });
    if (!name) {
      assert.equal(html, null, id);
      continue;
    }
    assert.notEqual(display, 'none', id);
    assert.equal(html, `${name}|${wegMarke(name).match(/data-aktiv="([a-z]+)"/)?.[1] ?? ''}`, id);
    if (id === 'J10b') assert.deepEqual(zeichen, [['stopp']], id);
    if (id === 'J11') assert.deepEqual(zeichen, [['spaet']], id);
  }
  const vb = await page.evaluate(() =>
    document.querySelector('.folie[data-id="J10"] svg.kamera').getAttribute('viewBox'),
  );
  const soll = kameraViewBox(1);
  assert.ok(Math.abs(Number(vb.split(/\s+/)[2]) - soll.w) < 1e-3, `J10 druckt Zoom 1: ${vb}`);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert.equal(seiten(pdf), RAHMEN.length + 2 + JONAS.length + RESERVE.length);
  // 1600 × 900 px = 1200 × 675 pt
  for (const [, box] of pdf.toString('latin1').matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)) {
    const [, , b, h] = box.trim().split(/\s+/).map(Number);
    assert.ok(Math.abs(b - 1200) < 0.5 && Math.abs(h - 675) < 0.5, `Seitengröße ${box}`);
  }
  writeFileSync(join(ordner, 'druck.pdf'), pdf);
  assert.ok(readFileSync(join(ordner, 'druck.pdf')).length > 10_000);
  await context.close();

  // Nur Jonas' Folien und Reserve (für jonas-folien.pdf in Task 10)
  const nurJonas = await oeffne(deckOhneNiklas, { hash: '' });
  await nurJonas.page.evaluate(() => (document.documentElement.dataset.druck = 'jonas'));
  await nurJonas.page.emulateMedia({ media: 'print' });
  const pdf2 = await nurJonas.page.pdf({ preferCSSPageSize: true, printBackground: true });
  // plus Titelfolie GT mit beiden Namen und GN (gemeinsam, Durchsicht 2026-11-18)
  assert.equal(seiten(pdf2), 2 + JONAS.length + RESERVE.length);
  await nurJonas.context.close();
});

test('Layout: je Folie keine Überlappung von Titel, Frage, Fläche und Fußzeile, nichts außerhalb der Bühne', async () => {
  assert.deepEqual(await layoutBefunde(browser, deckOhneNiklas), []);
});

// ---------------------------------------------------------------- Kopfgrammatik (2026-11-16)

/** Abstände Titel → Fragezeile liegen alle innerhalb ±2 px um ihren Median. */
function gleicherAbstand(abstand) {
  const werte = Object.values(abstand).sort((a, b) => a - b);
  const median = werte[Math.floor(werte.length / 2)];
  return Object.entries(abstand).filter(([, v]) => Math.abs(v - median) > 2);
}

test('Kopfgrammatik: jede Hauptfolie Jonas hat Ort, Titel und Fragezeile im selben Abstand, Etikett zuerst', async () => {
  const { abstand, autor, befunde } = await kopfBefunde(browser, deckOhneNiklas);
  assert.deepEqual(befunde, []);
  assert.deepEqual(
    Object.keys(abstand),
    JONAS.filter((f) => !f.anhang).map((f) => f.id),
  );
  assert.deepEqual(gleicherAbstand(abstand), []);
  // Autorzeile nur auf der ersten Folie des Teils
  assert.deepEqual(autor, ['J1']);
});

test('Kopfgrammatik: Ortsnamen ohne „·“-Zusatz, Status nur in der Fragezeile (statisch)', () => {
  for (const name of Object.keys(MARKEN)) assert.doesNotMatch(markeText(name), /·/, name);
  const html = baueDeck(F, { niklas: { teil1: [], teil2: [] }, eingebettet: true });
  for (const m of html.matchAll(/<p class="weg-beschriftung"[^>]*>([\s\S]*?)<\/p>/g))
    assert.doesNotMatch(m[1].replace(/<[^>]+>/g, ''), /·/);
  // Fragezeile beginnt mit dem Etikett, Status nur am Ende der Fragezeile
  for (const m of html.matchAll(/<p class="folie-frage">([\s\S]*?)<\/p>/g))
    assert.match(m[1], /^<span class="etikett etikett-1[abc]">/);
  const ohneFragen = html.replace(/<p class="folie-frage">[\s\S]*?<\/p>/g, '');
  assert.doesNotMatch(ohneFragen, /class="status"/);
  assert.doesNotMatch(html, /weg-exkurs/);
});

test('Kopfgrammatik-Gegenprobe: Status außerhalb, Etikett nicht zuerst, Zusatz am Ort und verrutschte Frage werden gemeldet', async () => {
  const kaputt = F.map((f) => {
    if (f.id === 'J5')
      return {
        ...f,
        inhalt: f.inhalt.replace('Lehrperson?', 'Lehrperson?<span class="status">x</span> mehr'),
      };
    if (f.id === 'J8')
      return { ...f, inhalt: f.inhalt.replace(/<\/div>$/, '<span class="status">x</span></div>') };
    if (f.id === 'J6')
      return {
        ...f,
        inhalt: f.inhalt.replace(
          /<p class="folie-frage">(<span class="etikett[^>]*>[^<]*<\/span>)/,
          '<p class="folie-frage">Text $1',
        ),
      };
    return f;
  });
  const pfad = join(ordner, 'kopf-kaputt.html');
  writeFileSync(
    pfad,
    baueDeck(kaputt, { niklas: { teil1: [], teil2: [] }, eingebettet: true })
      .replace(
        '<span class="weg-name">Weg eines Auftrags</span>',
        '<span class="weg-name">Weg eines Auftrags · Zusatz</span>',
      )
      // verrutschte Fragezeile auf J7
      .replace(/(data-id="J7"[\s\S]*?<p class="folie-frage")/, '$1 style="margin-top:60px"'),
  );
  const { abstand, befunde } = await kopfBefunde(browser, pfad);
  const text = befunde.join('\n');
  assert.match(text, /J5: Status nicht am Ende der Fragezeile/);
  assert.match(text, /J6: Fragezeile beginnt nicht mit dem Etikett/);
  assert.match(text, /J1: Ort mit Zusatz/);
  assert.match(text, /J8: Status außerhalb der Fragezeile/);
  assert.deepEqual(
    gleicherAbstand(abstand).map(([id]) => id),
    ['J7'],
  );
  assert.throws(
    () =>
      baueDeck(
        F.map((f) =>
          f.id === 'J5'
            ? {
                ...f,
                inhalt: f.inhalt.replace(
                  '<p class="folie-frage">',
                  '<p>x</p><p class="folie-frage">',
                ),
              }
            : f,
        ),
        { niklas: { teil1: [], teil2: [] }, eingebettet: true },
      ),
    /J5: Frage- oder Autorzeile muss am Anfang/,
  );
});

test('ZL: Quellenzeilen in der Fußzeile werden nie abgeschnitten, eine Zeile (Audit 2026-11-16)', async () => {
  const { page, context } = await oeffne(deckOhneNiklas);
  await page.emulateMedia({ media: 'print' });
  const befunde = await page.evaluate(() =>
    [...document.querySelectorAll('.folie-fuss')].flatMap((el) => {
      const zeile = parseFloat(getComputedStyle(el).lineHeight);
      const fehler = [];
      if (el.scrollWidth > el.clientWidth + 1) fehler.push('abgeschnitten');
      if (getComputedStyle(el).textOverflow === 'ellipsis') fehler.push('Ellipse');
      if (el.clientHeight - 12 > zeile + 2) fehler.push('mehr als eine Zeile');
      return fehler.map((f) => `${el.closest('.folie').dataset.id}: ${f}`);
    }),
  );
  await context.close();
  assert.deepEqual(befunde, []);
});

test('Layout mit dem echten Clip (medien/): J13 mit Video, Standbild und Bildunterschrift passt', async () => {
  const medien = join(HIER, 'medien');
  const pfad = join(ordner, 'mit-clip.html');
  writeFileSync(
    pfad,
    baueDeck(F, {
      niklas: { teil1: [], teil2: [] },
      clip: join(medien, 'clip.webm'),
      clipInfo: JSON.parse(readFileSync(join(medien, 'clip.json'), 'utf8')),
      standbild: join(medien, 'clip-standbild.png'),
      eingebettet: true,
    }),
  );
  assert.deepEqual(await layoutBefunde(browser, pfad), []);
});

test('Layout-Gegenprobe: zweizeiliger Titel, überlappender Beleg, große oder mehrzeilige Vermerke und oben klebender Inhalt werden gemeldet', async () => {
  const kaputt = F.map((f) => {
    if (f.id === 'J12') return { ...f, titel: `${f.titel}, ${f.titel}, ${f.titel}` };
    if (f.id === 'J7')
      return {
        ...f,
        inhalt: f.inhalt.replace(
          '<pre data-artefakt="budget" class="mono" style="',
          '<pre data-artefakt="budget" class="mono" style="position:relative;top:120px;',
        ),
      };
    if (f.id === 'J5b') return { ...f, inhalt: f.inhalt.replace('width:100%', 'width:1700px') };
    // Designregeln T und V: mehrzeiliger und zu großer Vermerk, Inhalt oben ohne Zentrierung
    if (f.id === 'J1')
      return { ...f, inhalt: f.inhalt.replace(/(<p class="beleg">)([^<]*)/, '$1$2 $2 $2') };
    if (f.id === 'J15')
      return {
        ...f,
        inhalt: f.inhalt.replace(
          '<p class="vermerk">',
          '<p class="vermerk" style="font-size:28px">',
        ),
      };
    if (f.id === 'R7')
      return {
        ...f,
        inhalt: f.inhalt.replace(
          '<div class="flaeche-inhalt">',
          '<div class="flaeche-inhalt" style="display:block">',
        ),
      };
    return f;
  });
  const pfad = join(ordner, 'kaputt.html');
  writeFileSync(pfad, baueDeck(kaputt, { niklas: { teil1: [], teil2: [] }, eingebettet: true }));
  const befunde = (await layoutBefunde(browser, pfad)).join('\n');
  assert.match(befunde, /J12: Titel zweizeilig/);
  assert.match(befunde, /J7: pre\.mono.* trifft /);
  assert.match(befunde, /J5b: .*(außerhalb der Bühne|ragt aus der Fläche)/);
  assert.match(befunde, /J1: p\.beleg.* Vermerk mehrzeilig/);
  assert.match(befunde, /J15: p\.vermerk.* Vermerk 28 px, zu groß/);
  assert.match(befunde, /R7: Inhalt klebt oben/);
});

test('Clip wird als data-URI in J13 eingebettet', () => {
  const clip = join(ordner, 'clip.webm');
  writeFileSync(clip, Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]));
  const standbild = join(ordner, 'standbild.png');
  writeFileSync(standbild, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const clipInfo = {
    datum: '2026-11-15',
    profil: 'balanced',
    wartezeitS: 171.6,
    raffungS: 4,
    grund: 'gate',
    timeoutMs: 300000,
    hinweis: 'Eine ausführliche Zusammenfassung war diesmal nicht möglich.',
  };
  const html = baueDeck(F, {
    niklas: { teil1: [], teil2: [] },
    clip,
    clipInfo,
    standbild,
    eingebettet: true,
  });
  assert.match(html, /<video[^>]+src="data:video\/webm;base64,GkXfowECAwQ="/);
  // Im PDF steht das Standbild statt des Videos (Druck-CSS der Vorlage).
  assert.match(html, /<img class="clip-standbild" src="data:image\/png;base64,iVBORw=="/);
  const nurJ13 = (h) => h.match(/<section[^>]*data-id="J13"[\s\S]*?<\/section>/)[0];
  assert.match(html, /Laboraufnahme 2026-11-15, 172 s auf 4 s gerafft/);
  assert.match(html, /Illustration, kein Nachweis/);
  // Das Energieprofil gehört ins Protokoll, nicht auf die Folie (Wunsch des Autors).
  assert.doesNotMatch(nurJ13(html), /balanced|power-saver|Energieprofil/);
  // Grund dieses Laufs ehrlich nennen: Timeout, nicht das Gate; Hinweis wörtlich.
  assert.doesNotMatch(nurJ13(html).match(/<figcaption[\s\S]*?<\/figcaption>/)[0], /Timeout/);
  const mitTimeout = baueDeck(F, {
    niklas: { teil1: [], teil2: [] },
    clip,
    clipInfo: { ...clipInfo, grund: 'timeout' },
    standbild,
    eingebettet: true,
  });
  assert.match(mitTimeout, /Abbruch nach 300 s \(Timeout\), nicht das Gate/);
  assert.throws(
    () => baueDeck(F, { niklas: { teil1: [], teil2: [] }, clip, eingebettet: true }),
    /clipInfo/,
  );
  assert.doesNotMatch(html, /data-nachbau/);
  // Der Vermerk gehört zum ersetzten Block: Mit Clip steht nirgends „keine Bildschirmaufnahme“
  // (Schlussprüfung I1), dafür die Bildunterschrift des Clips; ohne Clip umgekehrt.
  const j13 = (h) => h.match(/<section[^>]*data-id="J13"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(j13(html), /keine Bildschirmaufnahme/);
  assert.doesNotMatch(j13(html), /Fallback-Regel/);
  assert.match(j13(html), /Laboraufnahme 2026-11-15/);
  const ohne = baueDeck(F, { niklas: { teil1: [], teil2: [] }, eingebettet: true });
  assert.match(j13(ohne), /Nachbau, keine Bildschirmaufnahme/);
  assert.doesNotMatch(j13(ohne), /Laboraufnahme/);
});
