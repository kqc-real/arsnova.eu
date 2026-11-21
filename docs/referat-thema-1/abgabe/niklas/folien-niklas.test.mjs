// Prüft Niklas' Folien im gemeinsamen Deck: Reihenfolge und Zeiten, Sprechnotizen in zwei Fassungen,
// Kurzbelege nach ZL, Zahlen nur aus den Daten, Layoutwächter, einzeilige Fußzeilen, Druckauszug und
// den Aufbau in Stufen (N6, N7) mit und ohne reduzierte Bewegung.
// Aufruf: node --test docs/referat-thema-1/abgabe/niklas/*.test.mjs
/* global document, getComputedStyle */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fmt } from '../jonas/zahlen.mjs';
import { kopfBefunde, layoutBefunde } from '../jonas/layout-pruefung.mjs';
import { baueEntwurf, notizenNiklas } from './bau-entwurf.mjs';
import { ladeDaten1A } from './daten-1a.mjs';
import { eingaben1B34, ladeDaten1B34 } from './daten-1b34.mjs';
import { STUFE_1B34, ersatzSvg, folien1B34 } from './folien-1b34.mjs';
import { LITERATUR_1A, kurzbeleg1A } from './literatur-1a.mjs';
import { mitNotizen } from '../jonas/notizen.mjs';

// Ablesetexte und Stichpunkte liegen privat (privat/notizen.mjs); ohne sie entfallen die Prüfungen dazu
const OHNE_NOTIZEN = mitNotizen ? false : 'privat/notizen.mjs fehlt (eigenes Repo)';

const HIER = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(HIER, '../..');
const { chromium } = createRequire(resolve(HIER, '../../../../package.json'))('playwright');
const { html, n1a, n1b, alle } = baueEntwurf();
const d = ladeDaten1A(ROOT);

const haupt1A = n1a.filter((f) => f.teil === 'niklas' && !f.anhang);
const reserve1A = n1a.filter((f) => f.teil === 'reserve');
const summe = (l) => l.reduce((s, f) => s + f.zeitS, 0);
const ohneTags = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

let ordner;
let browser;
let deck;
before(async () => {
  ordner = mkdtempSync(join(tmpdir(), 'niklas-test-'));
  deck = join(ordner, 'deck.html');
  writeFileSync(deck, html);
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (ordner) rmSync(ordner, { recursive: true, force: true });
});

// ---------------------------------------------------------------- Aufbau und Zeit

test('1A: neun Folien im Vortrag (N6b, N8 seit 2026-11-17 wieder Reserve RN1, RN4), Literatur gemeinsam (kein NL)', () => {
  assert.deepEqual(
    haupt1A.map((f) => f.id),
    ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N9', 'N10'],
  );
  assert.deepEqual(
    n1a.filter((f) => f.anhang).map((f) => f.id),
    [],
  );
  assert.deepEqual(
    reserve1A.map((f) => f.id),
    ['RN1', 'RN2', 'RN4'],
  );
  assert.ok(reserve1A.every((f) => /^Reserve: /.test(f.titel)));
  assert.ok(reserve1A.every((f) => f.autor === 'niklas' && f.zeitS === 0));
  assert.ok(haupt1A.every((f) => f.auftrag === '1A' && f.station === null));
});

test('Zeit: Niklas 14:00–15:00 min samt Rahmen (Titel, Fahrplan, Systembild, Fazit, Dank); N2, N4, N7; Kurzfassung', () => {
  const s = summe(haupt1A);
  assert.ok(s >= 450 && s <= 490, `1A ${s} s`);
  // Rahmenfolien spricht Niklas (Absprache 2026-11-16) außer GN, den Nachweisumfang spricht Jonas (Durchsicht
  // 2026-11-18); 1B 3–4 vier Folien, höchstens 240 s (2026-11-17)
  const rahmen = alle.filter((f) => f.teil === 'rahmen' && f.id !== 'GN');
  assert.deepEqual(
    rahmen.map((f) => f.id),
    ['GT', 'G0', 'GK', 'G9', 'GD'],
  );
  for (const f of rahmen) assert.equal(f.sprecher, 'niklas', f.id);
  assert.equal(alle.find((f) => f.id === 'GN').sprecher, 'jonas');
  assert.ok(n1b.length === 4 && summe(n1b) <= 240, `1B 3–4 ${summe(n1b)} s`);
  const gesamt = s + summe(n1b) + summe(rahmen);
  // Entscheidung der Autoren 2026-11-16: 15 min Redezeit je Person (ersetzt höchstens 10:30 min)
  assert.ok(gesamt >= 840 && gesamt <= 900, `Niklas ${gesamt} s`);
  // Prüfungsschritt 1 (N2), Vorab-Festlegung (N4), Diskussionskern Ursache (N7): je 30–50 s
  for (const id of ['N2', 'N4', 'N7']) {
    const f = haupt1A.find((x) => x.id === id);
    assert.ok(f.zeitS >= 30 && f.zeitS <= 50, `${id}: ${f.zeitS} s`);
  }
  const kurz = haupt1A.filter((f) => f.kurzfassung).map((f) => f.id);
  for (const id of ['N1', 'N4', 'N6', 'N7', 'N10']) assert.ok(kurz.includes(id), id);
});

test('Titel: Behauptung in einer Zeile (höchstens 44 Zeichen), Reserve mit „Reserve:“', () => {
  for (const f of [...haupt1A, ...reserve1A]) {
    const t = ohneTags(f.titel).trim();
    const ohneReserve = t.replace(/^Reserve: /, '');
    assert.ok(ohneReserve.length <= 50, `${f.id}: ${t.length} Zeichen`);
    if (f.teil === 'reserve') assert.match(t, /^Reserve: /);
  }
});

test(
  'Sprechnotizen: Fließtext etwa 130 Wörter je Minute, 3–6 Stichpunkte, [Weiter] je Stufe',
  { skip: OHNE_NOTIZEN },
  () => {
    for (const f of haupt1A) {
      const woerter = f.notiz.trim().split(/\s+/).length;
      const soll = (f.zeitS * 130) / 60;
      assert.ok(
        woerter >= soll * 0.7 && woerter <= soll * 1.3,
        `${f.id}: ${woerter} Wörter, Soll etwa ${Math.round(soll)}`,
      );
      assert.ok(f.stichpunkte.length >= 3 && f.stichpunkte.length <= 6, `${f.id}: Stichpunkte`);
      const stufen = f.aufbau ?? 0;
      assert.equal(
        (f.notiz.match(/\[Weiter\]/g) ?? []).length,
        stufen,
        `${f.id}: [Weiter] in notiz`,
      );
      assert.equal(
        f.stichpunkte.filter((p) => p.startsWith('[Weiter]')).length,
        stufen,
        `${f.id}: [Weiter] in Stichpunkten`,
      );
    }
    for (const f of reserve1A) assert.ok(f.notiz && f.stichpunkte.length >= 3, f.id);
    const md = notizenNiklas(alle, n1a, n1b);
    assert.match(md, /^# Sprechnotizen Niklas/);
    assert.match(md, /\*\*Stichpunkte\*\*/);
    assert.match(md, /\*\*Fließtext\*\*/);
    assert.match(md, /## G9 /);
    assert.match(md, /## RN2 /);
    assert.doesNotMatch(md, /## NL /, 'Literatur ohne Redezeit nicht in den Notizen');
  },
);

test(
  'Erzählbogen: G0 eröffnet, N10 übergibt an Jonas, J15 zurück an Niklas, M1 nimmt die Frage auf',
  { skip: OHNE_NOTIZEN },
  () => {
    // Design 2026-11-15, Abschnitt 3: zwei Sprecherwechsel mit den abgestimmten Übergangssätzen
    assert.match(alle.find((f) => f.id === 'G0').notiz, /Ich beginne mit 1A auf dem App-Host/);
    assert.match(haupt1A[0].notiz, /^Ich beginne auf dem App-Host/);
    assert.match(
      ohneTags(haupt1A.at(-1).inhalt),
      /Was, wenn wir die schwere Arbeit auslagern\?.*Jonas/,
    );
    const j1 = alle.find((f) => f.id === 'J1');
    assert.match(j1.notiz, /^Danke, Niklas\./);
    const j15 = alle.find((f) => f.id === 'J15');
    assert.match(
      ohneTags(j15.inhalt),
      /Und wenn der zweite Host langsam ist oder ausfällt\?.*Niklas/,
    );
    assert.match(n1b[0].notiz, /^Danke, Jonas\. .*zweite Host langsam ist oder ausfällt/);
    assert.match(alle.find((f) => f.id === 'GD').notiz, /Fragen/);
  },
);

test('Schreibregeln: kein Geviertstrich, kein „sondern“, keine Hex-Farbe im HTML, keine Nebenlast', () => {
  for (const f of [...n1a, ...n1b]) {
    const text = [f.titel, f.inhalt, f.notiz, ...(f.stichpunkte ?? [])].join(' ');
    assert.doesNotMatch(text, /—/, f.id);
    assert.doesNotMatch(text, /\bsondern\b/, f.id);
    assert.doesNotMatch(text, /Nebenlast|Störprozess/, f.id);
    assert.doesNotMatch(
      f.inhalt.replace(/<svg[\s\S]*?<\/svg>/g, ''),
      /#[0-9a-fA-F]{3,6}\b/,
      `${f.id}: Hex-Farbe`,
    );
  }
  // gefährliche Formulierungen aus dem Brief (Ursache offen, kein Signifikanztest)
  for (const f of n1a) {
    const t = [f.titel, ohneTags(f.inhalt), f.notiz].join(' ');
    assert.doesNotMatch(t, /signifikant|Ursache gefunden|spaCy bremst/, f.id);
  }
});

// ---------------------------------------------------------------- Zahlen nur aus den Daten

/** Alle Zahlen der Daten in den Schreibweisen der Folien (fmt mit 0–2 Stellen, ×100, ÷1000, ×1000). */
function erlaubt() {
  const w = new Set();
  const zahl = (n) => {
    const b = Math.abs(n);
    for (const x of [b, b * 100, b / 1000, b * 1000, b / 1024, b / 100]) {
      if (!Number.isFinite(x)) continue;
      for (const st of [0, 1, 2]) w.add(fmt(x, st));
    }
  };
  const lauf = (o) => {
    if (typeof o === 'number') zahl(o);
    else if (Array.isArray(o)) o.forEach(lauf);
    else if (o && typeof o === 'object') Object.values(o).forEach(lauf);
  };
  lauf(d);
  // abgeleitet: Takt der Analyse (Fenster / Abrufe je Lehrende*r) und Lehrende × Takt
  const takt = d.konfig.profil.durationMs / 1000 / (d.analyseGeplantJeVariante / d.konfig.hosts);
  zahl(takt);
  zahl(takt * d.konfig.hosts);
  // abgeleitet (N7, Maßstab des Ausreißers): gesamtes Messfenster aller Läufe in Minuten
  zahl((d.live.laeufe * d.konfig.profil.durationMs) / 60000);
  for (let i = 0; i <= 5; i++) w.add(String(i)); // Blöcke, Varianten, Stufen
  return w;
}
// Festwerte außerhalb der Messreihe, je mit Beleg: 8 vCPU (ADR-0035, Zielhost), 0,1 s (Achsenmarke).
// 16 GB und ~4 GB (ADR-0035, Abschn. 2.1), 2,5 min (Jonas' 1B-ergebnis.md, warm im Median 148,6 s).
const FESTWERTE_NIKLAS = {
  8: 'ADR-0035 „8 vCPU“',
  '0,1': 'Achsenmarke 0,1 s',
  '2,5': '1B-ergebnis.md „im Median 148,6 s“',
  // N8, Bild zur Drosselung: Standardtakt von cpu.max (Kernel-Doku cgroup v2, „max 100000“ µs = 100 ms)
  100: 'Kernel-Doku cgroup v2, cpu.max „max 100000“',
};

test('Keine Zahl auf den 1A-Folien, die nicht aus den Daten kommt', { skip: OHNE_NOTIZEN }, () => {
  const adr = readFileSync(
    resolve(
      ROOT,
      '../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md',
    ),
    'utf8',
  );
  assert.match(adr, /8 vCPU/);
  assert.match(adr, /16-GB-Live-Host/);
  assert.match(adr, /~4-GB-LLM/);
  assert.match(readFileSync(resolve(ROOT, '1B-ergebnis.md'), 'utf8'), /im Median 148,6 s/);
  const w = erlaubt();
  const KENNUNG =
    /\b(?:8\.9b|16-GB|~?4-GB|[VHNMRJG]\d+|1[ABC]|ADR-\d{4}|v\d(?:\.\d)+(?:-\d+)?|[0-9a-f]{8}|cgroup v2|Vertrag v\d|Version \d(?:\.\d)*|20\d\d|p\d\d|Abschn\. [\d.]+|Z\. \d+)\b/g;
  const DATUM = /\d{2}\.\d{2}\.(?:\d{4})?/g;
  for (const f of [...haupt1A, ...reserve1A]) {
    const texte = [f.titel, ohneTags(f.inhalt), f.notiz, ...f.stichpunkte];
    for (const t of texte) {
      for (const z of t
        .replace(DATUM, ' ')
        .replace(KENNUNG, ' ')
        .match(/\d+(?:[.,]\d+)*/g) ?? []) {
        assert.ok(w.has(z) || z in FESTWERTE_NIKLAS, `${f.id}: „${z}“ nicht aus den Daten`);
      }
    }
  }
});

// ---------------------------------------------------------------- Literatur und Fußzeilen

test('ZL: jede Folie trägt Kurzbelege aus dem Verzeichnis, jeder Eintrag wird zitiert', () => {
  const kurz = new Set(LITERATUR_1A.map((e) => e.kurz));
  const zitiert = new Set();
  for (const f of [...haupt1A, ...reserve1A]) {
    assert.ok(f.fuss.startsWith('Quelle: '), f.id);
    for (const beleg of f.fuss.slice('Quelle: '.length).split('; ')) {
      const k = [...kurz].find((x) => beleg === x || beleg.startsWith(`${x}, `));
      assert.ok(k, `${f.id}: „${beleg}“ fehlt im Verzeichnis`);
      zitiert.add(k);
    }
    // Rechner und Commit gehören in die quelle, nicht in die Fußzeile
    assert.doesNotMatch(f.fuss, /\b[0-9a-f]{8}\b|WSL2/, f.id);
    assert.match(f.quelle, /WSL2|1A-auswertung|Laufdateien/, f.id);
  }
  assert.deepEqual(
    [...kurz].filter((k) => !zitiert.has(k)),
    [],
    'unzitierte Einträge',
  );
  assert.throws(() => kurzbeleg1A('fehlt2020'), /fehlt2020/);
  // Niklas' Einträge stehen im gemeinsamen Verzeichnis (J16, J16b), kein eigenes NL mehr
  assert.ok(!n1a.some((f) => f.id === 'NL'));
});

test('Literatur 1A alphabetisch, ohne „o. J.“ und Abrufdatum, DOI mit https', () => {
  const voll = LITERATUR_1A.map((e) => e.voll);
  assert.deepEqual(
    voll,
    [...voll].sort((a, b) => a.localeCompare(b, 'de')),
  );
  for (const v of voll) {
    assert.doesNotMatch(v, /o\. J\.|abgerufen|Zugriff am/);
    assert.doesNotMatch(v, /[^/]doi\.org/);
  }
});

const BIB_NIKLAS = `${process.env.HOME}/Documents/Code/PaperLab/scientific-papers/presentation/presentation-semester-7-cloud-computing-1a-1b_niklas/main.bib`;
test(
  'dieselben Schlüssel wie in Niklas’ Handout (PaperLab main.bib)',
  {
    skip: !(() => {
      try {
        readFileSync(BIB_NIKLAS);
        return true;
      } catch {
        return false;
      }
    })(),
  },
  () => {
    const bib = readFileSync(BIB_NIKLAS, 'utf8');
    for (const e of LITERATUR_1A) {
      assert.ok(
        new RegExp(`@\\w+\\{${e.schluessel},`).test(bib),
        `${e.schluessel} fehlt in main.bib`,
      );
    }
  },
);

// ---------------------------------------------------------------- 1B 3–4 Gerüst

test(
  '1B 3–4: M1–M4 aus den Ergebnis-JSONs ohne Platzhalter; ohne Daten eine Platzhalterfolie',
  { skip: OHNE_NOTIZEN },
  () => {
    assert.deepEqual(
      n1b.map((f) => f.id),
      ['M1', 'M2', 'M3', 'M4'],
    );
    for (const f of n1b) {
      const t = [f.titel, ohneTags(f.inhalt), f.fuss, f.notiz, ...f.stichpunkte].join(' ');
      assert.doesNotMatch(t, /\[Niklas|\[Satz|\[Titel|Entwurf/, f.id);
      assert.match(f.quelle, /i7-10700K/, f.id);
    }
    const d1b = ladeDaten1B34(ROOT);
    assert.equal(d1b.finde('f1').jobMedianMs, 48);
    assert.equal(d1b.finde('f2').jobMedianMs, 134732);
    for (const l of d1b.laeufe) assert.equal(l.liveFehler, 0, l.datei);
    assert.match(n1b[0].inhalt, />48 ms</);
    // überholte Aussagen von M2 alt (vor PR #26) kommen nicht wieder
    const text = n1b.map((f) => [ohneTags(f.inhalt), f.notiz].join(' ')).join(' ');
    assert.doesNotMatch(text, /kein Vergleich mit einem LLM|wie ADR-0035/i);
    assert.match(n1b[3].fuss, /ADR 1B-020/);
    const leer = folien1B34();
    assert.equal(leer.length, 1);
    assert.match(leer[0].titel, /\[Titel\]/);
    assert.match(ohneTags(leer[0].inhalt) + leer[0].fuss, /\[Niklas\]/);
  },
);

test('1B 3–4 füllt sich aus Ergebnis-JSONs (Median selbst gerechnet, p95 gepoolt)', () => {
  const wurzel = mkdtempSync(join(tmpdir(), 'niklas-1b-'));
  try {
    mkdirSync(join(wurzel, 'evidenz/1B/messung'), { recursive: true });
    const fenster = (ms) => ({
      complete: true,
      actions: Object.fromEntries(
        ['join', 'vote', 'qaSubmit', 'blitzlicht'].map((a) => [
          a,
          {
            planned: 20,
            succeeded: 20,
            failed: 0,
            latency: { durationSamplesMs: Array(20).fill(ms) },
          },
        ]),
      ),
    });
    const datei = (tag, jobs, ms) => ({
      tag,
      commit: '5e758d0a1234',
      umgebung: { rechner: 'i7-10700K' },
      experiment: {
        config: { n: jobs.length, timeoutMs: 300000 },
        jobs: jobs.map((j) => ({ jobMs: j, fallbackReason: 'unavailable' })),
        live: { windows: [fenster(ms), fenster(ms)] },
      },
      treiber: {
        auftraege: [
          { measurement: { resources: { maxRssBytes: 471 * 1048576, maxCpuPercent: 58 } } },
        ],
      },
    });
    writeFileSync(
      join(wurzel, 'evidenz/1B/messung/2026-11-15-lauf-f1-summary.json'),
      JSON.stringify(datei('f1-summary', [57, 128, 48, 43, 117, 47, 47, 46, 48, 212], 30)),
    );
    writeFileSync(
      join(wurzel, 'evidenz/1B/messung/2026-11-15-lauf-dev-f1-summary.json'),
      JSON.stringify(datei('dev-f1-summary', [1], 1)),
    );
    const dd = ladeDaten1B34(wurzel);
    assert.equal(dd.laeufe.length, 1, 'dev-Läufe zählen nicht');
    const f1 = dd.finde('f1');
    assert.equal(f1.jobMedianMs, 48);
    assert.equal(f1.live.join.p95Ms, 30);
    assert.equal(f1.liveGeplant, 160);
    // ohne Label, Breaker, S1 und Transport bleibt die Platzhalterfolie: nichts Halbes im Deck
    assert.equal(folien1B34(dd).length, 1);
    assert.match(folien1B34(dd)[0].fuss, /\[Niklas\]/);
  } finally {
    rmSync(wurzel, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- im Browser

test('Layout: Niklas-Folien und Rahmen ohne Überlappung, Vermerke einzeilig, kein Inhalt oben klebend', async () => {
  const befunde = (await layoutBefunde(browser, deck)).filter((b) => /^(N|M|RN|G)/.test(b));
  assert.deepEqual(befunde, []);
});

test('Kopfgrammatik im gemeinsamen Deck: Ort, Titel, Fragezeile im selben Abstand (±2 px) auf allen Hauptfolien beider Teile', async () => {
  const { abstand, autor, befunde } = await kopfBefunde(browser, deck);
  assert.deepEqual(befunde, []);
  const ids = Object.keys(abstand);
  for (const f of [...haupt1A, ...n1b]) assert.ok(ids.includes(f.id), f.id);
  assert.ok(ids.includes('J1') && ids.includes('J15'));
  // Rahmen (GT, G0, GK, G9, GD), Anhang und Reserve folgen der Kopfgrammatik nicht (README Designregeln)
  for (const id of ['GT', 'G0', 'GK', 'G9', 'GN', 'GD', 'J16', 'J16b', 'RN2'])
    assert.ok(!ids.includes(id), id);
  const werte = Object.values(abstand).sort((a, b) => a - b);
  const median = werte[Math.floor(werte.length / 2)];
  assert.deepEqual(
    Object.entries(abstand).filter(([, v]) => Math.abs(v - median) > 2),
    [],
  );
  // Autorzeile nur auf der ersten Folie jedes Teils
  assert.deepEqual(autor, ['N1', 'J1']);
  // Status („nachträglich ausgewertet“) nach der Frage statt an der Stelle des Etiketts
  for (const id of ['N7']) {
    const f = haupt1A.find((x) => x.id === id);
    assert.match(
      f.inhalt,
      /<p class="folie-frage"><span class="etikett etikett-1a">1A<\/span>[^<]+<span class="status">nachträglich ausgewertet<\/span><\/p>/,
      id,
    );
  }
});

test('Reihenfolge: GT, G0, GK, Niklas 1A, Jonas, Niklas 1B 3–4, G9, GN, GD, Literatur (J16, J16b), Reserve', async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(pathToFileURL(deck).href);
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('.folie')].map((f) => [f.dataset.id, f.dataset.teil]),
  );
  await page.close();
  const pos = (id) => ids.findIndex(([x]) => x === id);
  assert.deepEqual(
    ids.slice(0, 4).map(([x]) => x),
    ['GT', 'G0', 'GK', 'N1'],
  );
  // Niklas 1A → Jonas → Niklas 1B 3–4 → Fazit (Design 2026-11-15, Abschnitt 3)
  assert.equal(pos('J1'), pos('N10') + 1, 'Jonas folgt direkt auf N10');
  assert.equal(pos('M1'), pos('J15') + 1, '1B 3–4 folgt direkt auf J15');
  assert.ok(pos('M2') < pos('G9'));
  assert.deepEqual(
    ids.slice(pos('G9') + 1, pos('G9') + 5).map(([x]) => x),
    ['GN', 'GD', 'J16', 'J16b'],
  );
  assert.ok(!ids.some(([x]) => x === 'NL'), 'kein eigenes Verzeichnis 1A mehr');
  assert.ok(pos('RN2') > pos('J16b'));
  assert.equal(ids.find(([x]) => x === 'RN2')[1], 'reserve');
});

/** Sichtbare Folien im Druck mit ?druck=… */
async function druckAuszug(art) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(`${pathToFileURL(deck).href}?druck=${art}`);
  await page.emulateMedia({ media: 'print' });
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('.folie')]
      .filter((f) => getComputedStyle(f).display !== 'none')
      .map((f) => f.dataset.id),
  );
  await page.close();
  return ids;
}

test('Druck ?druck=niklas: genau Niklas’ Folien samt gemeinsamer Literatur und Reserve; Jonas ohne RN', async () => {
  // Titelfolie (beide Namen, lokal mit Matrikelnummern) steht in jedem Einzel-PDF.
  assert.deepEqual(await druckAuszug('niklas'), [
    'GT',
    ...haupt1A.map((f) => f.id),
    ...n1b.map((f) => f.id),
    // Nachweisumfang und gemeinsames Literaturverzeichnis in beiden Auszügen (Durchsicht 2026-11-18)
    'GN',
    'J16',
    'J16b',
    ...reserve1A.map((f) => f.id),
  ]);
  const jonas = await druckAuszug('jonas');
  assert.equal(jonas[0], 'GT');
  assert.ok(jonas.includes('J16') && jonas.includes('J16b'), 'Literatur im Jonas-PDF');
  assert.ok(!jonas.some((id) => /^(N|M|RN)/.test(id)), 'keine Niklas-Folie im Jonas-PDF');
});

test('Fußzeilen der Niklas-Folien einzeilig, nicht abgeschnitten', async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(pathToFileURL(deck).href);
  await page.emulateMedia({ media: 'print' });
  const befunde = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '.folie[data-teil="niklas"] .folie-fuss, .folie[data-autor="niklas"] .folie-fuss',
      ),
    ].flatMap((el) => {
      const zeile = parseFloat(getComputedStyle(el).lineHeight);
      const fehler = [];
      if (el.scrollWidth > el.clientWidth + 1) fehler.push('abgeschnitten');
      if (el.clientHeight - 12 > zeile + 2) fehler.push('mehr als eine Zeile');
      return fehler.map((f) => `${el.closest('.folie').dataset.id}: ${f}`);
    }),
  );
  await page.close();
  assert.deepEqual(befunde, []);
});

/** Öffnet das Deck auf der Folie vor `id` und zählt je Tastendruck die eingeblendeten Elemente. */
async function ablauf(id, stufen, reducedMotion) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    reducedMotion,
  });
  const page = await context.newPage();
  await page.goto(`${pathToFileURL(deck).href}#${id}`);
  const an = () =>
    page.evaluate(() => {
      const f = document.querySelector('.folie[data-aktuell]');
      return `${f.dataset.id}:${f.dataset.aufbauStufe ?? '-'}:${f.querySelectorAll('[data-ab][data-an]').length}`;
    });
  const verlauf = [await an()];
  for (let i = 0; i < stufen + 1; i++) {
    await page.keyboard.press('ArrowRight');
    verlauf.push(await an());
  }
  await page.keyboard.press('ArrowLeft'); // zurück ins Endbild
  verlauf.push(await an());
  const uebergang = await page.evaluate(
    (fid) =>
      getComputedStyle(document.querySelector(`.folie[data-id="${fid}"] [data-ab]`))
        .transitionDuration,
    id,
  );
  await context.close();
  return { verlauf, uebergang };
}

test('N6 baut in drei Stufen auf: 4, dann 7, dann 11 Treffer; rückwärts ins Endbild', async () => {
  const { verlauf, uebergang } = await ablauf('N6', 3, 'no-preference');
  // je Stufe: Treffer-Zellen plus genau eine Erklärzeile
  // Stufe 0: nur Umrisse und Erklärzeile; ab Stufe 1 zusätzlich die graue Füllung samt Legende „hält“
  assert.deepEqual(verlauf, ['N6:0:1', 'N6:1:6', 'N6:2:9', 'N6:3:13', 'N7:0:0', 'N6:3:13']);
  const ms = parseFloat(uebergang.split(',')[0]) * 1000;
  assert.ok(ms >= 150 && ms <= 300, `Übergang ${uebergang}`);
});

test('N7 baut in zwei Stufen auf (Latenz, dann Analyse, dann CPU); reduzierte Bewegung ohne Übergang', async () => {
  const normal = await ablauf('N7', 2, 'no-preference');
  // Stufe 0: nichts mit data-ab; 1: Band und Analyse; 2: zusätzlich CPU
  assert.deepEqual(normal.verlauf, ['N7:0:0', 'N7:1:2', 'N7:2:3', 'N9:0:0', 'N7:2:3']);
  const reduziert = await ablauf('N7', 2, 'reduce');
  assert.deepEqual(reduziert.verlauf, normal.verlauf);
  assert.equal(reduziert.uebergang, '0s');
});

test('Druck: N6 und N7 stehen im Endbild', async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(pathToFileURL(deck).href);
  await page.emulateMedia({ media: 'print' });
  await page.waitForFunction(
    () =>
      document.querySelector('.folie[data-id="N6"]').dataset.aufbauStufe === '3' &&
      document.querySelector('.folie[data-id="N7"]').dataset.aufbauStufe === '2',
  );
  const sichtbar = await page.evaluate(() =>
    ['N6', 'N7'].map(
      (id) =>
        [...document.querySelectorAll(`.folie[data-id="${id}"] [data-ab]`)].filter(
          (el) => el.hasAttribute('data-an') && getComputedStyle(el).opacity === '1',
        ).length,
    ),
  );
  await page.close();
  assert.deepEqual(sichtbar, [13, 3]);
});

// ---------------------------------------------------------------- Ergänzt 2026-11-16: Wegmarken, M1 in Stufen

test('Wegmarke: 1A auf eigenem Weg, je Folie die erwartete Station; 1B 3–4 auf Jonas’ Weg', async () => {
  const { MARKEN, STOERUNG_ZEICHEN } = await import('../jonas/wegkarte.mjs');
  const marken = Object.fromEntries([...haupt1A, ...n1b].map((f) => [f.id, f.marke]));
  assert.deepEqual(marken, {
    N1: '1a-weg',
    N2: '1a-app',
    N3: '1a-varianten',
    N4: '1a-regel',
    N5: '1a-live',
    N6: '1a-regel',
    N7: '1a-wirkung',
    N9: '1a-ersatz',
    N10: '1a-wortwolke',
    M1: '1b-stoerung',
    M2: '1b-breaker',
    M3: '1b-alle',
    M4: '1b-s1',
  });
  // Station des Punkts und hervorgehobene Strecken je Marke
  const ort = (m) =>
    [MARKEN[m].station ?? '-', MARKEN[m].abschnitte?.map((a) => a.name).join('+') ?? ''].join(' ');
  assert.deepEqual(Object.fromEntries(Object.entries(marken).map(([id, m]) => [id, ort(m)])), {
    N1: '- ',
    N2: 'app ',
    N3: 'app analyse',
    N4: 'live live+analyse',
    N5: 'live live',
    N6: 'live live+analyse',
    N7: 'live ',
    N9: 'ersatz ',
    N10: 'wortwolke ',
    M1: '- zweiterHost',
    M2: '- zweiterHost',
    M3: '- zweiterHost',
    M4: '- zweiterHost',
  });
  assert.equal(MARKEN['1a-wirkung'].wirkung, true);
  for (const f of haupt1A) {
    assert.equal(MARKEN[f.marke].weg, '1a', f.id);
    assert.deepEqual(MARKEN[f.marke].teil, ['1A'], f.id);
  }
  // 1B 3–4: Jonas' Auftragsweg, Strecke über den zweiten Host in Bernstein
  for (const f of n1b) {
    const m = MARKEN[f.marke];
    assert.equal(m.weg, 'auftrag', f.id);
    assert.deepEqual(
      m.abschnitte.map((a) => a.name),
      ['zweiterHost'],
      f.id,
    );
    // S1 (M4): die Strecke über den zweiten Host entfällt, gestrichelt
    assert.equal(Boolean(m.abschnitte[0].gestrichelt), f.id === 'M4', f.id);
    assert.equal(m.farbe, 'var(--bernstein)', f.id);
  }
  // Stufen der Marke auf M1 = Stufen der Störungen auf M1 (STUFE_1B34)
  const stufen = {};
  for (const st of MARKEN['1b-stoerung'].stufen) for (const z of st.zeichen) stufen[z] = st.ab;
  assert.deepEqual(stufen, {
    stopp: STUFE_1B34.f1,
    belegt: STUFE_1B34.busy,
    drop: STUFE_1B34.f2,
    langsam: STUFE_1B34.l1,
    spaet: STUFE_1B34.l3,
  });
  assert.equal(STUFE_1B34.l1, STUFE_1B34.l2);
  assert.deepEqual(MARKEN['1b-alle'].zeichen, Object.keys(STOERUNG_ZEICHEN));
  // Im Deck: Druckmarke je Folie mit Beschriftung und Etikett, keine Reste der Systembild-Miniatur
  for (const f of [...haupt1A, ...n1b]) {
    const folie = html.match(new RegExp(`<section[^>]*data-id="${f.id}"[\\s\\S]*?</section>`))[0];
    assert.match(folie, new RegExp(`class="weg-mini weg-marke" data-marke="${f.marke}"`), f.id);
    assert.match(folie, /<p class="weg-beschriftung"[^>]*><span class="weg-(name|stufen)"/, f.id);
    assert.match(folie, /class="etikett etikett-1[ab]"/, f.id);
  }
  assert.doesNotMatch(html, /ort-mini|data-ort=|Ort im Systembild/);
});

test('Wegkarte: jede Station jedes Wegs wird besucht, je Teil in nicht fallender Wegreihenfolge', async () => {
  const { WEGE, laeuferZustand, markeVon } = await import('../jonas/wegkarte.mjs');
  const jonas = alle.filter((f) => f.teil === 'jonas' && !f.anhang);
  const teile = { '1A': haupt1A, 'Jonas 1C/1B': jonas, '1B 3–4': n1b };
  const besucht = { auftrag: new Set(), '1a': new Set() };
  for (const [teil, folien] of Object.entries(teile)) {
    let vorher = -1;
    for (const f of folien) {
      const name = markeVon(f, { eigenerWeg: f.inhalt.includes('class="auftrag"') });
      assert.ok(name, `${f.id}: Hauptfolie ohne Wegkarte`);
      const z = laeuferZustand(name);
      if (z.station === null) continue;
      assert.ok(z.anteil >= vorher, `${teil}: ${f.id} springt zurück (${z.station})`);
      vorher = z.anteil;
      besucht[z.weg].add(z.station);
    }
  }
  // Seit 2026-11-17 zeigt nur noch die Reserve RN4 die Station spaCy (Zeit für 1B 3–4); sie zählt hier mit,
  // die Reihenfolge prüft nur den Vortrag.
  for (const f of reserve1A) {
    const z = f.marke ? laeuferZustand(f.marke) : null;
    if (z?.station) besucht[z.weg].add(z.station);
  }
  for (const [weg, stationen] of Object.entries(besucht))
    assert.deepEqual([...stationen].sort(), Object.keys(WEGE[weg].stationen).sort(), weg);
});

/** Zustand der Wegkarte auf dem Bildschirm (Läufer) nach jedem Tastendruck von `start` bis `ende`. */
async function laeuferVerlauf(start, ende, reducedMotion = 'no-preference') {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    reducedMotion,
  });
  const page = await context.newPage();
  await page.goto(`${pathToFileURL(deck).href}#${start}`);
  const verlauf = [];
  for (let i = 0; i < 80; i++) {
    verlauf.push(
      await page.evaluate(() => {
        const f = document.querySelector('.folie[data-aktuell]');
        const an = [...document.querySelectorAll('.weg-laeufer[data-an]')];
        const m = an[0];
        // Kennung am Element: bleibt sie über die Folien gleich, ist es derselbe DOM-Knoten
        if (m) m.dataset.pruefKnoten ??= String(Math.random());
        return {
          id: f.dataset.id,
          stufe: f.dataset.aufbauStufe ?? null,
          wege: an.map((x) => x.dataset.weg),
          knoten: m?.dataset.pruefKnoten ?? null,
          aktiv: m?.dataset.aktiv ?? null,
          saeume: m ? [...m.querySelectorAll('.weg-saum[data-an]')].map((g) => g.dataset.saum) : [],
          wirkung: Boolean(m?.querySelector('.weg-wirkung[data-an]')),
          satz: m?.querySelector('.weg-satz[data-an]')?.dataset.satz ?? '',
          animationen: document.getAnimations().length,
          statischSichtbar: [
            ...document.querySelectorAll('.folie[data-aktuell] > .weg-marke'),
          ].some((x) => getComputedStyle(x).display !== 'none'),
        };
      }),
    );
    if (verlauf.at(-1).id === ende) break;
    await page.keyboard.press('ArrowRight');
  }
  await context.close();
  return verlauf;
}

test('Wegkarte N1–N10 und M1–M4: ein beständiger Läufer je Weg wie bei Jonas', async () => {
  const v = await laeuferVerlauf('N1', 'G9');
  const n = v.filter((x) => x.id.startsWith('N'));
  const m = v.filter((x) => x.id.startsWith('M'));
  const j = v.filter((x) => x.id.startsWith('J'));
  // 1A: derselbe DOM-Knoten über alle Folien
  assert.equal(new Set(n.map((x) => x.knoten)).size, 1, 'N: ein Knoten');
  assert.ok(n.every((x) => x.wege.join() === '1a'));
  // J und M teilen sich den Auftragsweg: derselbe Knoten von J1 bis M2
  assert.equal(new Set([...j, ...m].map((x) => x.knoten)).size, 1, 'J und M: ein Knoten');
  assert.ok([...j, ...m].every((x) => x.wege.join() === 'auftrag'));
  assert.notEqual(n[0].knoten, m[0].knoten, 'zwei Wege, zwei Läufer');
  assert.ok(
    v.every((x) => !x.statischSichtbar),
    'feste Druckmarke auf dem Bildschirm ausgeblendet',
  );
  // der Punkt fährt die Stationen von 1A der Reihe nach an
  assert.deepEqual(
    [...new Set(n.map((x) => x.aktiv).filter(Boolean))],
    ['app', 'live', 'ersatz', 'wortwolke'],
  );
  // Säume und Zeichen nur, wo sie die Aussage der Folie zeigen
  const bei = (id, stufe = null) => v.find((x) => x.id === id && x.stufe === stufe);
  assert.deepEqual(bei('N2').saeume, []);
  assert.deepEqual(bei('N3').saeume, ['analyse|var(--blau)']);
  assert.deepEqual(bei('N4').saeume, ['live|var(--blau)', 'analyse|var(--blau)|gestrichelt']);
  assert.deepEqual(bei('N5').saeume, ['live|var(--blau)']);
  assert.equal(bei('N7', '0').wirkung, true);
  assert.equal(bei('N9', '0').wirkung, false);
  assert.deepEqual(bei('M1', '0').saeume, ['zweiterHost|var(--bernstein)']);
  assert.deepEqual(
    ['0', '1', '2', '3'].map((s) => bei('M1', s).satz),
    ['', 'stopp,belegt', 'drop,langsam', 'spaet'],
  );
  assert.deepEqual(
    ['0', '1'].map((s) => bei('M2', s).satz),
    ['stopp', 'spaet'],
  );
  assert.equal(bei('M3', '0').satz, 'stopp,belegt,drop,langsam,spaet');
  assert.deepEqual(bei('M4', '0').saeume, ['zweiterHost|var(--bernstein)|gestrichelt']);
  // Rahmen danach (G9): keine Wegkarte
  assert.deepEqual(v.at(-1).wege, []);
});

test('Wegkarte: innerhalb von 1A fährt der Punkt, der Wechsel N10 → J1 blendet über', async () => {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${pathToFileURL(deck).href}#N9`);
  await page.waitForTimeout(400);
  // N9 baut in zwei Stufen auf; danach N9 → N10: Ersatz → Wortwolke
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const fahrt = await page.evaluate(() => {
    const p = document.querySelector('.weg-laeufer[data-weg="1a"] .weg-punkt');
    return {
      laeuft: document.getAnimations().some((a) => a.effect?.target === p),
      ist: parseFloat(getComputedStyle(p).offsetDistance),
      soll: parseFloat(p.style.offsetDistance),
    };
  });
  assert.ok(fahrt.laeuft && fahrt.ist < fahrt.soll, `Punkt fährt: ${JSON.stringify(fahrt)}`);
  await page.waitForTimeout(700);
  // N10 baut in zwei Stufen auf (Diskussion, Übergabe); danach N10 → J1
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(120);
  const blende = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.weg-laeufer')].map((l) => [
        l.dataset.weg,
        Number(getComputedStyle(l).opacity),
      ]),
    ),
  );
  assert.ok(blende['1a'] > 0 && blende['1a'] < 1, `1A blendet aus: ${blende['1a']}`);
  assert.ok(blende.auftrag > 0 && blende.auftrag < 1, `Auftrag blendet ein: ${blende.auftrag}`);
  await context.close();
});

test('Wegkarte mit reduzierter Bewegung: keine Übergänge, Zustand sofort', async () => {
  const v = await laeuferVerlauf('N1', 'M2', 'reduce');
  assert.deepEqual(
    v.filter((x) => x.animationen).map((x) => x.id),
    [],
  );
  assert.equal(v.at(-1).id, 'M2');
  const normal = await laeuferVerlauf('N1', 'N3');
  assert.ok(
    normal.some((x) => x.animationen > 0),
    'Gegenprobe: ohne Einstellung gibt es Übergänge',
  );
});

test('Druck: jede Folie von 1A und 1B 3–4 trägt ihre feste Wegkarte im Endbild, kein Läufer', async () => {
  const { wegMarke } = await import('../jonas/wegkarte.mjs');
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(pathToFileURL(deck).href);
  await page.emulateMedia({ media: 'print' });
  await page.waitForFunction(
    () => document.querySelector('.folie[data-id="M1"]').dataset.aufbauStufe === '3',
  );
  const r = await page.evaluate(() => ({
    laeufer: [...document.querySelectorAll('.weg-laeufer')].map((l) => getComputedStyle(l).display),
    folien: Object.fromEntries(
      [...document.querySelectorAll('.folie[data-id^="N"], .folie[data-id^="M"]')].map((s) => {
        const m = s.querySelector(':scope > .weg-marke');
        return [
          s.dataset.id,
          {
            marke: m?.dataset.marke,
            aktiv: m?.dataset.aktiv ?? null,
            display: m ? getComputedStyle(m).display : 'fehlt',
            zeichen: m
              ? [...m.querySelectorAll('.weg-stufe, .weg-zeichen-ort > .weg-zeichen-reihe')]
                  .filter((x) => getComputedStyle(x).opacity === '1')
                  .flatMap((x) =>
                    [...x.querySelectorAll('[data-zeichen]')].map((z) => z.dataset.zeichen),
                  )
              : [],
          },
        ];
      }),
    ),
  }));
  await page.close();
  assert.ok(r.laeufer.every((d) => d === 'none'));
  for (const f of [...haupt1A, ...n1b]) {
    const z = r.folien[f.id];
    assert.equal(z.marke, f.marke, f.id);
    assert.notEqual(z.display, 'none', f.id);
    assert.equal(z.aktiv, wegMarke(f.marke).match(/data-aktiv="([a-z]+)"/)?.[1] ?? null, f.id);
  }
  // Endbild: M1 Stufe 3 („zu spät“), M2 Stufe 1 („zu spät“), M3 alle fünf, M4 keine
  assert.deepEqual(r.folien.M1.zeichen, ['spaet']);
  assert.deepEqual(r.folien.M2.zeichen, ['spaet']);
  assert.deepEqual(r.folien.M3.zeichen, ['stopp', 'belegt', 'drop', 'langsam', 'spaet']);
  assert.deepEqual(r.folien.M4.zeichen, []);
});

test(
  'M1: Störungen als Stufen (Stopp und Slot, DROP, zu spät) und Maßstab aus dem Verhältnis der Mediane',
  { skip: OHNE_NOTIZEN },
  () => {
    const d1b = ladeDaten1B34(ROOT);
    const m1 = n1b.find((f) => f.id === 'M1');
    assert.equal(m1.aufbau, 3);
    const stufen = Object.fromEntries(
      [...m1.inhalt.matchAll(/data-ab="(\d)" data-stoerung="([a-z0-9]+)"/g)].map((m) => [
        m[2],
        Number(m[1]),
      ]),
    );
    assert.deepEqual(stufen, { f1: 1, busy: 1, l1: 2, l2: 2, f2: 2, l3: 3 });
    assert.equal((m1.notiz.match(/\[Weiter\]/g) ?? []).length, 3);
    // Faktor DROP/Stopp wie im F2-Protokoll (134.732 / 48 ≈ 2.807), auf Hunderter gerundet
    const faktor =
      Math.round(d1b.finde('f2').jobMedianMs / d1b.finde('f1').jobMedianMs / 100) * 100;
    assert.equal(faktor, 2800);
    assert.match(ohneTags(m1.inhalt), /rund 2\.800-mal so lang/);
    // Kreis = Summary, Raute = Label; zwei Fristen
    assert.match(m1.inhalt, /Frist Label 30 s/);
    assert.match(m1.inhalt, /Frist Summary 300 s/);
  },
);

test('M2: zitierte Codezeilen stimmen am Checkout (Breaker zählt aborted nicht)', async () => {
  const { CODE_BELEGE_1B34 } = await import('./folien-1b34.mjs');
  const repo = join(ROOT, '..', '..');
  for (const [datei, zeile, inhalt] of CODE_BELEGE_1B34) {
    const z = readFileSync(join(repo, datei), 'utf8').split('\n')[zeile - 1];
    assert.ok(z.includes(inhalt), `${datei}:${zeile}: ${z.trim()}`);
  }
  const m2 = n1b.find((f) => f.id === 'M2');
  assert.match(ohneTags(m2.inhalt), /openWeightLlmClient\.ts:188/);
  assert.match(m2.quelle, /runWithQueueTimeout/);
  assert.equal(m2.aufbau, 1);
});

test('1B 3–4 liest .json.gz; liegen .json und .json.gz nebeneinander, zählt der Lauf einmal', () => {
  const wurzel = mkdtempSync(join(tmpdir(), 'niklas-1b-gz-'));
  try {
    const dir = join(wurzel, 'evidenz/1B/messung');
    mkdirSync(dir, { recursive: true });
    const roh = JSON.stringify({ tag: 'x', experiment: { jobs: [{ jobMs: 5 }] } });
    writeFileSync(join(dir, '2026-11-15-lauf-f1-summary.json.gz'), gzipSync(roh));
    writeFileSync(join(dir, '2026-11-16-lauf-l3-summary.json'), roh);
    writeFileSync(join(dir, '2026-11-16-lauf-l3-summary.json.gz'), gzipSync(roh));
    assert.deepEqual(eingaben1B34(wurzel), [
      'evidenz/1B/messung/2026-11-15-lauf-f1-summary.json.gz',
      'evidenz/1B/messung/2026-11-16-lauf-l3-summary.json',
    ]);
    const dd = ladeDaten1B34(wurzel);
    assert.equal(dd.laeufe.length, 2);
    assert.equal(dd.finde('f1').jobMedianMs, 5);
  } finally {
    rmSync(wurzel, { recursive: true, force: true });
  }
});

test('N4 schreibt H1 und H2 im Regelkasten aus und nennt den Versuchsvertrag als Quelle', () => {
  const n4 = n1a.find((f) => f.id === 'N4');
  const text = ohneTags(n4.inhalt);
  assert.match(text, /H1:[^.]*V2[^.]*V1/);
  assert.match(text, /H2:[^.]*V3[^.]*V4/);
  assert.match(n4.quelle, /1A-experiment-contract\.md/);
});

test('M1 zeigt je Zeile die Zahl der Aufträge je Consumer und eine Lesehilfe', () => {
  const d1b = ladeDaten1B34(ROOT);
  const svg = ersatzSvg(d1b);
  assert.match(svg, />Jeder Punkt ein Auftrag; gleiche Zeiten liegen übereinander</);
  // n je Zeile und Consumer stammt aus zeitenMs.length; fehlt ein Consumer, steht ein Strich
  const n = Object.fromEntries(
    [...svg.matchAll(/<text data-n="(\w+)-(\w+)"[^>]*>([^<]*)<\/text>/g)].map((m) => [
      `${m[1]}-${m[2]}`,
      m[3],
    ]),
  );
  assert.equal(n['normal-summary'], '10');
  assert.equal(n['normal-label'], '30');
  assert.equal(n['l2-label'], '3');
  assert.equal(n['busy-label'], '–');
  for (const v of ['normal', 'f1', 'busy', 'l1', 'l2', 'f2', 'l3'])
    for (const [c, r] of [
      ['summary', d1b.finde(v)],
      ['label', d1b.finde(v, 'label')],
    ])
      if (`${v}-${c}` in n)
        assert.equal(n[`${v}-${c}`], r ? String(r.zeitenMs.length) : '–', `${v}-${c}`);
  assert.equal(Object.keys(n).length, 14);
});
