// Nachweisumfang des Referats (docs/referat-thema-1/nachweisumfang.md) aus dem
// aktuellen Checkout neu berechnen: Laborzeit aus Zeitstempeln der Rohdaten,
// ADRs, vorab festgelegte Hypothesen und statisch gezählte Tests.
//
// Aufruf: node docs/referat-thema-1/abgabe/bau/nachweisumfang.mjs
// Import: import { berechneNachweisumfang, kopfzahlen } from './nachweisumfang.mjs';

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { liesJson } from '../../evidenz/1B/json-lesen.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
/** docs/referat-thema-1 */
export const REFERAT = resolve(HIER, '../..');
const REPO = resolve(REFERAT, '../..');

/**
 * Letzter Upstream-Stand im Fork (`git merge-base upstream/main HEAD`,
 * Stand 16.11.2026). Fest eingetragen, damit die Zählung ohne Remote
 * `upstream` läuft. Neue bzw. geänderte Tests zählen gegen diesen Stand.
 */
export const BASIS = '21734265a5d2e77976168da0d5a84469320178f0';

/** Zeilen, die mit test( oder it( beginnen (node:test, Vitest). */
const TEST_ZEILE = /^\s*(test|it)\(/;
/** Pester: Zeilen, die mit It '…' oder It "…" beginnen. */
const PESTER_ZEILE = /^\s*It\s+['"]/;

const REIHE_1A = 'evidenz/1A/reihe-main-a19ca70f-20261115-122547';
const MESSUNG_1B = 'evidenz/1B/messung';
const MESSUNG_1C = 'evidenz/1C/messung';

/** Gewertete Läufe (Autorenprüfung abgeschlossen), je Auftrag. */
const GEWERTET_1B = [
  '2026-11-13-lauf.json',
  '2026-11-13-lauf-b0.json',
  '2026-11-13-lauf-kalt.json',
  '2026-11-13-lauf-kalt-2.json',
  '2026-11-13-lauf-kalt-3.json',
  '2026-11-13-lauf-kalt-4.json',
  '2026-11-13-lauf-kalt-5.json',
];
const GEWERTET_1C = [
  '2026-11-05-labor.json.gz',
  '2026-11-05-labor-pc.json.gz',
  '2026-11-09-labor-nachlauf.json.gz',
];
/**
 * Niklas' 1B-Läufe Schritte 3–4 (gewertet, ohne `dev-`): Störreihen Summary und Label samt Teilläufen,
 * gerichtete Breaker-Folgen und S1; Protokolle und Autorenprüfung (16.11.) liegen seit dem Merge von PR #26.
 */
const REIHE_1B_3U4 =
  /^2026-11-1[56]-lauf-(?!dev-)[a-z0-9-]+-(summary|label)(-\d{2})?\.json(\.gz)?$/;

/** Quelle je Hypothesengruppe: Datei und Muster der definierenden Stelle. */
const HYPOTHESEN = [
  { gruppe: '1A', datei: '1A/1A-experiment-contract.md', muster: /^- \*\*(H\d):\*\*/gm },
  {
    gruppe: '1B',
    datei: 'specs/2026-11-12-1b-zwei-host-design.md',
    muster: /\*\*(H_[BC]\d)(?: kalt)?:\*\*/g,
  },
  { gruppe: '1B 3–4', datei: '1B/archiv/1B-3u4-Planung.md', muster: /^\| (H[A-Za-z0-9-]*) +\|/gm },
  { gruppe: '1C-E', datei: 'specs/2026-10-24-1c-teil2-design.md', muster: /^\| (E\d+[a-z]?) /gm },
  { gruppe: '1C-E', datei: 'specs/2026-10-24-1c-teil3-design.md', muster: /^\| (E\d+[a-z]?) /gm },
  { gruppe: '1C-M', datei: 'specs/2026-10-24-1c-teil2-design.md', muster: /^\| (M\d) /gm },
  { gruppe: '1C-M', datei: 'specs/2026-10-24-1c-teil3-design.md', muster: /^\| (M\d) /gm },
  { gruppe: '1C-L', datei: 'specs/2026-10-25-1c-labor-design.md', muster: /^\| (L\d) /gm },
  { gruppe: '1C-N', datei: 'specs/2026-11-06-1c-nachlauf-design.md', muster: /^\| (N\d) /gm },
  {
    gruppe: '1C-H_A',
    datei: 'evidenz/1C/2026-11-16-gate-ablation.md',
    muster: /^- \*\*(H_A\d) \(/gm,
  },
];

function git(...args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
}

function zeilen(text) {
  return text.split('\n');
}

function zaehle(text, muster) {
  return zeilen(text).filter((z) => muster.test(z)).length;
}

/** Getrackte und nicht ignorierte, ungetrackte Dateien im Checkout. */
function dateienImCheckout(pfad) {
  return zeilen(git('ls-files', '--cached', '--others', '--exclude-standard', '--', pfad)).filter(
    Boolean,
  );
}

function dateienInBasis(pfad) {
  return new Set(zeilen(git('ls-tree', '-r', '--name-only', BASIS, '--', pfad)).filter(Boolean));
}

function lies(pfadImRepo) {
  return readFileSync(join(REPO, pfadImRepo), 'utf8');
}

function sek(von, bis) {
  return (Date.parse(bis) - Date.parse(von)) / 1000;
}

/** 1A: je Lauf warmup.manifest.startAt (lauf.json) bis timestamp (report.json). */
function laufzeit1A(root, ordner = REIHE_1A) {
  const reihe = join(root, ordner);
  let summe = 0;
  let laeufe = 0;
  let vollstaendig = 0;
  const grenzen = [];
  for (const variante of readdirSync(reihe).filter((d) => /^V\d$/.test(d))) {
    for (const block of readdirSync(join(reihe, variante)).filter((d) => d.startsWith('block-'))) {
      const ordner = join(reihe, variante, block);
      const lauf = JSON.parse(readFileSync(join(ordner, 'lauf.json'), 'utf8'));
      const report = JSON.parse(readFileSync(join(ordner, 'report.json'), 'utf8'));
      summe += sek(lauf.warmup.manifest.startAt, report.timestamp);
      grenzen.push(lauf.warmup.manifest.startAt, report.timestamp);
      laeufe += 1;
      if (lauf.complete === true) vollstaendig += 1;
    }
  }
  return { sek: summe, laeufe, vollstaendig, grenzen };
}

/** 1B: treiber.startedAt bis spätestes treiber.auftraege[].finishedAt. */
function laufzeit1B(root, datei) {
  const { treiber } = liesJson(join(root, MESSUNG_1B, datei));
  const enden = treiber.auftraege.map((a) => Date.parse(a.finishedAt)).filter(Number.isFinite);
  return {
    sek: (Math.max(...enden) - Date.parse(treiber.startedAt)) / 1000,
    auftraege: treiber.auftraege.length,
    grenzen: [Date.parse(treiber.startedAt), Math.max(...enden)],
  };
}

/**
 * 1B 3–4, Zählweise wie Niklas' PR #26: Laufbeginn aus der UTC-Lauf-ID (`lauf`, z. B. 20261115T215523-…) bis zur
 * Ergebniserfassung `umgebung.erfasstAm`; S1 hat keine Lauf-ID, dort Treiberstart. Fehlt `erfasstAm`, gilt das
 * Ende des letzten Auftrags.
 */
function laufzeit1B3u4(root, datei) {
  const j = liesJson(join(root, MESSUNG_1B, datei));
  const basis = laufzeit1B(root, datei);
  const m = String(j.lauf ?? '').match(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)/);
  const start = m
    ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6])
    : Date.parse(j.treiber.startedAt);
  const ende = Date.parse(j.umgebung?.erfasstAm ?? '') || basis.grenzen[1];
  return { sek: (ende - start) / 1000, auftraege: basis.auftraege, grenzen: [start, ende] };
}

/** 1C: environment.startedAt bis environment.endedAt. */
function laufzeit1C(root, datei) {
  const { environment } = JSON.parse(gunzipSync(readFileSync(join(root, MESSUNG_1C, datei))));
  return {
    sek: sek(environment.startedAt, environment.endedAt),
    grenzen: [environment.startedAt, environment.endedAt],
  };
}

/** Kalendertag in Berlin (JJJJ-MM-TT) eines Zeitpunkts. */
function tagBerlin(ms) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(ms));
}

/** Erster Start bis letztes Ende aller gewerteten Läufe, als Berliner Kalendertage. */
function zeitraum(laeufe) {
  const ms = laeufe
    .flatMap((l) => l.grenzen)
    .map((t) => (typeof t === 'number' ? t : Date.parse(t)));
  return { von: tagBerlin(Math.min(...ms)), bis: tagBerlin(Math.max(...ms)) };
}

function summe(werte) {
  return werte.reduce((a, b) => a + b, 0);
}

/** Gewertete Läufe 1B 3–4 (Dateinamen); liegen `.json` und `.json.gz` nebeneinander, zählt `.json` einmal. */
export function dateien1B3u4(root = REFERAT) {
  const namen = readdirSync(join(root, MESSUNG_1B)).filter((d) => REIHE_1B_3U4.test(d));
  return [...new Set(namen.map((d) => d.replace(/\.gz$/, '')))]
    .sort()
    .map((d) => (namen.includes(d) ? d : `${d}.gz`));
}

export function laborzeit(root = REFERAT) {
  const a = laufzeit1A(root);
  const b = GEWERTET_1B.map((d) => laufzeit1B(root, d));
  const c = GEWERTET_1C.map((d) => laufzeit1C(root, d));
  const n = dateien1B3u4(root).map((d) => laufzeit1B3u4(root, d));
  const je = {
    '1A': a.sek,
    '1B': summe(b.map((x) => x.sek)),
    '1B 3–4': summe(n.map((x) => x.sek)),
    '1C': summe(c.map((x) => x.sek)),
  };
  return {
    gewertetSek: summe(Object.values(je)),
    je,
    zeitraum: zeitraum([a, ...b, ...c, ...n]),
    laeufe1A: a.laeufe,
    vollstaendig1A: a.vollstaendig,
    auftraege1B: summe(b.map((x) => x.auftraege)),
    laeufe1C: c.length,
    reihen1B3u4: {
      sek: summe(n.map((x) => x.sek)),
      laeufe: n.length,
      auftraege: summe(n.map((x) => x.auftraege)),
    },
  };
}

export function adrs(root = REFERAT) {
  const dateien = readdirSync(join(root, 'adr')).filter((d) => /^1[BC]-.*\.md$/.test(d));
  return {
    gesamt: dateien.length,
    '1B': dateien.filter((d) => d.startsWith('1B-')).length,
    '1C': dateien.filter((d) => d.startsWith('1C-')).length,
  };
}

export function hypothesen(root = REFERAT) {
  const je = {};
  for (const { gruppe, datei, muster } of HYPOTHESEN) {
    const text = readFileSync(join(root, datei), 'utf8');
    je[gruppe] ??= new Set();
    for (const treffer of text.matchAll(muster)) je[gruppe].add(treffer[1]);
  }
  const anzahl = Object.fromEntries(Object.entries(je).map(([g, s]) => [g, s.size]));
  return { gesamt: summe(Object.values(anzahl)), je: anzahl };
}

/** Statische Testzählung; Tests in Schleifen zählen einmal, nichts wird ausgeführt. */
export function tests() {
  const referat = dateienImCheckout('docs/referat-thema-1');
  const nodeReferat = referat.filter((d) => d.endsWith('.test.mjs'));
  const zaehleDateien = (liste, muster = TEST_ZEILE) =>
    summe(liste.map((d) => zaehle(lies(d), muster)));

  const abgabe = nodeReferat.filter((d) => d.startsWith('docs/referat-thema-1/abgabe/'));
  const evidenz = nodeReferat.filter((d) => !d.startsWith('docs/referat-thema-1/abgabe/'));
  const pester = referat.filter((d) => d.endsWith('.Tests.ps1'));

  const basisLoad = dateienInBasis('scripts/load');
  const load = dateienImCheckout('scripts/load').filter(
    (d) => d.endsWith('.test.mjs') && !basisLoad.has(d),
  );

  const backendPfad = 'apps/backend/src/__tests__';
  const basisBackend = dateienInBasis(backendPfad);
  const backend = dateienImCheckout(backendPfad).filter((d) => /\.test\.ts$/.test(d));
  const backendNeu = backend.filter((d) => !basisBackend.has(d));
  let backendNetto = 0;
  for (const d of backend.filter((x) => basisBackend.has(x))) {
    backendNetto += zaehle(lies(d), TEST_ZEILE) - zaehle(git('show', `${BASIS}:${d}`), TEST_ZEILE);
  }

  const gruppen = {
    evidenz: { tests: zaehleDateien(evidenz), dateien: evidenz.length },
    pester: { tests: zaehleDateien(pester, PESTER_ZEILE), dateien: pester.length },
    load: { tests: zaehleDateien(load), dateien: load.length },
    backend: {
      tests: zaehleDateien(backendNeu) + backendNetto,
      neueDateien: backendNeu.length,
      nettoInGeaenderten: backendNetto,
    },
    abgabe: { tests: zaehleDateien(abgabe), dateien: abgabe.length },
  };
  const ohneAbgabe =
    gruppen.evidenz.tests + gruppen.pester.tests + gruppen.load.tests + gruppen.backend.tests;
  return { ohneAbgabe, gesamt: ohneAbgabe + gruppen.abgabe.tests, gruppen };
}

/** Stand vor dem Löschen alter 1A-Nachweise (Commit ab1619e7, 15.11.2026, „alte A1-Nachweise entfernen“) */
const VOR_LOESCHUNG_1A = 'ab1619e7^';

/**
 * 1A-Läufe aus der Git-Historie: je `V<n>/block-<n>/lauf.json` direkt unter `ordner` (Unterordner wie `vorlauf/`
 * zählen getrennt) warmup.manifest.startAt bis report.json → timestamp, wie die gewertete Reihe.
 */
function laufzeit1AGit(ordner) {
  const basis = `docs/referat-thema-1/${ordner}`;
  const muster = new RegExp(`^${basis.replace(/[.^$]/g, '\\$&')}/V\\d/block-\\d+/lauf\\.json$`);
  const laeufe = zeilen(git('ls-tree', '-r', '--name-only', VOR_LOESCHUNG_1A, '--', basis)).filter(
    (p) => muster.test(p),
  );
  let sekunden = 0;
  for (const p of laeufe) {
    const lauf = JSON.parse(git('show', `${VOR_LOESCHUNG_1A}:${p}`));
    const report = JSON.parse(
      git('show', `${VOR_LOESCHUNG_1A}:${p.replace(/lauf\.json$/, 'report.json')}`),
    );
    // Abgebrochene Läufe haben kein warmup; dann gilt der Start der Messung (manifest.startAt)
    sekunden += sek(lauf.warmup?.manifest?.startAt ?? lauf.manifest.startAt, report.timestamp);
  }
  return { sek: sekunden, laeufe: laeufe.length };
}

/** VM-Starts und -Enden aus dem Systemjournal (systemd-machined), Protokoll evidenz/1B/2026-11-17-vm-laufzeiten.md */
const VM_CSV = 'evidenz/1B/messung/2026-11-17-vm-laufzeiten.csv';

/**
 * Zeitfenster außerhalb der gewerteten Läufe, wie sie in Protokollen stehen: Aufbau, Entwicklungs- und
 * Probeläufe, Kalibrierung, Ursachenversuch, Abbau. `belege` stehen wörtlich in `datei` (Test). Dauer aus
 * `von`/`bis` (über Mitternacht erlaubt), aus `min` (nur Dauer im Protokoll) oder aus den Rohdaten (`json1C`,
 * `vorlauf1A`). 1B Schritte 1–2 kommen vollständig aus dem VM-Journal, nicht aus dieser Liste.
 */
export const FENSTER = [
  // 1A: Vorlauf der gewerteten Reihe (fünf verkürzte Varianten)
  {
    auftrag: '1A',
    was: 'Vorlauf',
    datei: `${REIHE_1A}/vorabnachtrag.md`,
    vorlauf1A: `${REIHE_1A}/vorlauf`,
  },
  // 1A: in ab1619e7 gelöschte Läufe (README: „Frühere Fassungen sind über Git erreichbar“). `vorlauf/` und
  // `reihe-2026-11-12/vorlauf/` tragen dieselben Zeitstempel; gezählt wird nur `vorlauf/`.
  {
    auftrag: '1A',
    was: 'Reihe 12.11., alte Baseline (gelöscht)',
    datei: 'evidenz/1A/README.md',
    belege: ['Frühere Fassungen sind über Git erreichbar'],
    git1A: 'evidenz/1A/reihe-2026-11-12',
  },
  {
    auftrag: '1A',
    was: 'Vorlauf 11.11. (gelöscht)',
    datei: 'evidenz/1A/README.md',
    belege: ['Frühere Fassungen sind über Git erreichbar'],
    git1A: 'evidenz/1A/vorlauf',
  },
  {
    auftrag: '1A',
    was: 'Läufe 11.11. (gelöscht)',
    datei: 'evidenz/1A/README.md',
    belege: ['Frühere Fassungen sind über Git erreichbar'],
    git1A: 'evidenz/1A',
  },
  {
    auftrag: '1A',
    was: 'Vorlauf 14.11. (gelöscht)',
    datei: 'evidenz/1A/README.md',
    belege: ['Frühere Fassungen sind über Git erreichbar'],
    git1A: 'evidenz/1A/reihe-main-a19ca70f-20261114-154617/vorlauf',
  },
  {
    auftrag: '1A',
    was: 'abgebrochener Lauf 14.11. (gelöscht)',
    datei: 'evidenz/1A/README.md',
    belege: ['Frühere Fassungen sind über Git erreichbar'],
    git1A: 'evidenz/1A/reihe-main-a19ca70f-20261114-154617',
  },
  // 1B Schritte 3–4 (Niklas, Windows-Rechner)
  {
    auftrag: '1B 3–4',
    was: 'Aufbau unter Windows',
    datei: 'evidenz/1B/2026-11-15-aufbau-windows.md',
    belege: ['log-up-20261115T190943', 'aufbau-20261115T192944'],
    von: '19:09:43',
    bis: '19:29:44',
  },
  {
    auftrag: '1B 3–4',
    was: 'Wiederanlauf',
    datei: 'evidenz/1B/2026-11-15-aufbau-windows.md',
    belege: ['log-start-20261115T194443', 'aufbau-20261115T194622'],
    von: '19:44:43',
    bis: '19:46:22',
  },
  {
    auftrag: '1B 3–4',
    was: 'Entwicklungslauf F1',
    datei: 'evidenz/1B/2026-11-15-lauf-dev-f1-summary.md',
    belege: ['21:44:43 UTC', '21:50:29 UTC'],
    von: '21:44:43',
    bis: '21:50:29',
  },
  {
    auftrag: '1B 3–4',
    was: 'Entwicklungslauf F2',
    datei: 'evidenz/1B/2026-11-16-lauf-dev-f2-summary.md',
    belege: ['00:02:26 Uhr MEZ', '00:08:12 Uhr MEZ'],
    von: '00:02:26',
    bis: '00:08:12',
  },
  {
    auftrag: '1B 3–4',
    was: 'Entwicklungslauf F2, zweiter',
    datei: 'evidenz/1B/2026-11-16-lauf-dev-f2-summary-v2.md',
    belege: ['23:32:50 UTC', '23:38:36 UTC'],
    von: '23:32:50',
    bis: '23:38:36',
  },
  {
    auftrag: '1B 3–4',
    was: 'Kalibrierung',
    datei: 'evidenz/1B/2026-11-16-kalibrierung.md',
    belege: ['101,099129 s'],
    min: 101.099129 / 60,
  },
  {
    auftrag: '1B 3–4',
    was: 'Entwicklungslauf L3',
    datei: 'evidenz/1B/2026-11-16-lauf-dev-l3-summary.md',
    belege: ['01:35–01:42'],
    von: '01:35',
    bis: '01:42',
  },
  {
    auftrag: '1B 3–4',
    was: 'Entwicklungslauf Slot belegt',
    datei: 'evidenz/1B/2026-11-16-lauf-dev-busy-summary.md',
    belege: ['02:59–03:06'],
    von: '02:59',
    bis: '03:06',
  },
  {
    auftrag: '1B 3–4',
    was: 'Entwicklungslauf Label',
    datei: 'evidenz/1B/2026-11-16-lauf-dev-normal-label.md',
    belege: ['10:34–10:37'],
    von: '10:34',
    bis: '10:37',
  },
  {
    auftrag: '1B 3–4',
    was: 'Diagnose Label',
    datei: 'evidenz/1B/2026-11-16-lauf-dev-normal-label-diagnose.md',
    belege: ['10:56–10:57'],
    von: '10:56',
    bis: '10:57',
  },
  {
    auftrag: '1B 3–4',
    was: 'Entwicklungslauf Label, zweiter',
    datei: 'evidenz/1B/2026-11-16-lauf-dev-normal-label-v2.md',
    belege: ['11:10–11:17'],
    von: '11:10',
    bis: '11:17',
  },
  {
    auftrag: '1B 3–4',
    was: 'Entwicklungslauf L1',
    datei: 'evidenz/1B/2026-11-16-lauf-dev-l1-label.md',
    belege: ['16:32–16:39'],
    von: '16:32',
    bis: '16:39',
  },
  {
    auftrag: '1B 3–4',
    was: 'Entwicklungslauf S1',
    datei: 'evidenz/1B/2026-11-16-lauf-dev-s1-label.md',
    belege: ['20:19:30 UTC', '20:25:57 UTC'],
    von: '20:19:30',
    bis: '20:25:57',
  },
  {
    auftrag: '1B 3–4',
    was: 'Laborabbau',
    datei: 'evidenz/1B/2026-11-16-laborabbau.md',
    belege: ['22:32:50–22:33:03'],
    von: '22:32:50',
    bis: '22:33:03',
  },
  // 1C (Jonas): Kalibrierung und Ursachenversuch am PC, Messungen Teil 2/3, Probe- und Trockenläufe
  {
    auftrag: '1C',
    was: 'Kalibrierung PC',
    datei: 'evidenz/1C/2026-11-05-labor-pc.md',
    belege: ['Kalibrierung 14:37–14:40'],
    von: '14:37',
    bis: '14:40',
  },
  {
    auftrag: '1C',
    was: 'Ursachenversuch U1',
    datei: 'evidenz/1C/2026-11-05-labor-pc.md',
    belege: ['U1 17:11–17:46'],
    von: '17:11',
    bis: '17:46',
  },
  {
    auftrag: '1C',
    was: 'Messung Teil 2, Primärlauf',
    datei: 'evidenz/1C/2026-10-24-teil2.md',
    belege: ['17:41:09–17:44:49 MESZ'],
    von: '17:41:09',
    bis: '17:44:49',
  },
  {
    auftrag: '1C',
    was: 'Messung Teil 2, Robustheit',
    datei: 'evidenz/1C/2026-10-24-teil2.md',
    belege: ['20:24:58–20:28:44 MESZ'],
    von: '20:24:58',
    bis: '20:28:44',
  },
  {
    auftrag: '1C',
    was: 'Messung Teil 3, M6/M7',
    datei: 'evidenz/1C/2026-10-24-teil3.md',
    belege: ['01:09:55–01:14:45 MESZ'],
    von: '01:09:55',
    bis: '01:14:45',
  },
  {
    auftrag: '1C',
    was: 'Messung Teil 3, M7b',
    datei: 'evidenz/1C/2026-10-24-teil3.md',
    belege: ['01:33:04–01:38:18 MESZ'],
    von: '01:33:04',
    bis: '01:38:18',
  },
  {
    auftrag: '1C',
    was: 'Messung Teil 3, M7c',
    datei: 'evidenz/1C/2026-10-24-teil3.md',
    belege: ['01:53:30–01:58:50 MESZ'],
    von: '01:53:30',
    bis: '01:58:50',
  },
  {
    auftrag: '1C',
    was: 'Probelauf 1',
    datei: 'evidenz/1C/2026-10-24-teil3.md',
    json1C: '2026-10-25-probelauf-1.json.gz',
  },
  {
    auftrag: '1C',
    was: 'Probelauf 2',
    datei: 'evidenz/1C/2026-10-24-teil3.md',
    json1C: '2026-10-25-probelauf-2.json.gz',
  },
  {
    auftrag: '1C',
    was: 'Trockenlauf Upstream',
    datei: 'evidenz/1C/2026-11-06-trockenlauf-upstream.md',
    json1C: '2026-11-06-trockenlauf-upstream.json.gz',
  },
];

/** „19:09:43“ → Sekunden des Tages */
function uhr(t) {
  const [h, m, s = 0] = t.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/** Gesamtlänge der Vereinigung von Intervallen [a, b] in ms */
function vereinigung(iv) {
  let summe = 0;
  let a = null;
  let b = null;
  for (const [x, y] of [...iv].sort((p, q) => p[0] - q[0])) {
    if (a === null || x > b) {
      if (a !== null) summe += b - a;
      [a, b] = [x, y];
    } else b = Math.max(b, y);
  }
  return a === null ? 0 : summe + b - a;
}

/** Schnitt zweier Intervallmengen (jeweils erst vereinigt), Länge in ms */
function schnitt(p, q) {
  return vereinigung(p) + vereinigung(q) - vereinigung([...p, ...q]);
}

/** VM-Laufzeit 1B 1–2 aus dem Journal-Auszug: je Instanz Start bis Ende, überlappend nur einmal. */
function vmLaufzeit(root, gewertet) {
  const zeilen = readFileSync(join(root, VM_CSV), 'utf8').trim().split('\n').slice(1);
  const offen = new Map();
  const iv = [];
  for (const z of zeilen) {
    const [zeit, ereignis, vm, instanz] = z.split(',');
    if (ereignis === 'start') offen.set(instanz, Date.parse(zeit));
    else if (offen.has(instanz)) {
      iv.push({ vm, a: offen.get(instanz), b: Date.parse(zeit) });
      offen.delete(instanz);
    }
  }
  if (offen.size) throw new Error(`${VM_CSV}: VM ohne Ende (${[...offen.keys()]})`);
  const paare = (l) => l.map((i) => [i.a, i.b]);
  const win = iv.filter((i) => i.vm === 'arsnova-1b-win');
  const labor = iv.filter((i) => i.vm !== 'arsnova-1b-win');
  return {
    starts: iv.length,
    startsWindows: win.length,
    alleSek: vereinigung(paare(iv)) / 1000,
    laborSek: vereinigung(paare(labor)) / 1000,
    windowsSek: vereinigung(paare(win)) / 1000,
    gewertetDarinSek: schnitt(paare(iv), gewertet) / 1000,
    zeitraum: zeitraum([{ grenzen: iv.flatMap((i) => [i.a, i.b]) }]),
  };
}

/** Aufbau, Tests und weitere Läufe je Auftrag (Sekunden), getrennt von der gewerteten Laborzeit. */
export function vorarbeit(root = REFERAT) {
  const gewertet = GEWERTET_1B.map((d) => laufzeit1B(root, d).grenzen);
  const vm = vmLaufzeit(root, gewertet);
  const fenster = FENSTER.map((f) => {
    let sek;
    let laeufe = 1;
    if (f.git1A) ({ sek, laeufe } = laufzeit1AGit(f.git1A));
    else if (f.vorlauf1A) ({ sek, laeufe } = laufzeit1A(root, f.vorlauf1A));
    else if (f.json1C) sek = laufzeit1C(root, f.json1C).sek;
    else if (f.min !== undefined) sek = f.min * 60;
    else sek = (uhr(f.bis) - uhr(f.von) + 86400) % 86400;
    return { ...f, sek, laeufe };
  });
  const je = { '1A': 0, '1B': vm.alleSek - vm.gewertetDarinSek, '1B 3–4': 0, '1C': 0 };
  for (const f of fenster) je[f.auftrag] += f.sek;
  return { je, gesamtSek: summe(Object.values(je)), vm, fenster };
}

export function berechneNachweisumfang(root = REFERAT) {
  return {
    commit: git('rev-parse', '--short=8', 'HEAD').trim(),
    laborzeit: laborzeit(root),
    vorarbeit: vorarbeit(root),
    adrs: adrs(root),
    hypothesen: hypothesen(root),
    tests: tests(),
  };
}

export function zahl(wert, stellen = 0) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  }).format(wert);
}

/** Sekunden als „7 h 42 min“. */
export function dauer(sekunden) {
  const minuten = Math.round(sekunden / 60);
  const stunden = Math.floor(minuten / 60);
  return stunden ? `${stunden} h ${minuten % 60} min` : `${minuten} min`;
}

/** { von: '2026-11-05', bis: '2026-11-16' } als „5.–16.11.2026“ (gleicher Monat) oder „28.10.–3.11.2026“. */
export function tageSpanne({ von, bis }) {
  const [vj, vm, vt] = von.split('-').map(Number);
  const [bj, bm, bt] = bis.split('-').map(Number);
  if (vj !== bj) return `${vt}.${vm}.${vj}–${bt}.${bm}.${bj}`;
  return vm === bm ? `${vt}.–${bt}.${bm}.${bj}` : `${vt}.${vm}.–${bt}.${bm}.${bj}`;
}

/**
 * Deutsch formatierte Kopfzahlen für Folie und Handout, z. B.
 * „Belege im Repo: 7,7 h gewertete Laborzeit, 301 automatisierte Tests, …“.
 */
export function kopfzahlen(werte = berechneNachweisumfang()) {
  return {
    laborzeitStunden: `${zahl(werte.laborzeit.gewertetSek / 3600, 1)} h`,
    laborzeit: dauer(werte.laborzeit.gewertetSek),
    tests: zahl(werte.tests.ohneAbgabe),
    testsMitAbgabe: zahl(werte.tests.gesamt),
    adrs: zahl(werte.adrs.gesamt),
    hypothesen: zahl(werte.hypothesen.gesamt),
    zeitraum: tageSpanne(werte.laborzeit.zeitraum),
    vorarbeitStunden: `${zahl(werte.vorarbeit.gesamtSek / 3600, 1)} h`,
  };
}

/**
 * Erwartete Wert-Spalte je Zeile (erste Spalte) der Tabellen in
 * docs/referat-thema-1/nachweisumfang.md; nachweisumfang.test.mjs vergleicht.
 */
export function tabellenwerte(werte = berechneNachweisumfang()) {
  const { laborzeit: l, adrs: a, hypothesen: h, tests: t, vorarbeit: v } = werte;
  const k = kopfzahlen(werte);
  const g = t.gruppen;
  return {
    'Gewertete Laborzeit': `**${k.laborzeitStunden}** (${k.laborzeit}, ${zahl(Math.round(l.gewertetSek))} s)`,
    'davon 1A Ressourcenisolation': `${dauer(l.je['1A'])} (${l.laeufe1A} Läufe, ${l.vollstaendig1A} vollständig)`,
    'davon 1B Schritte 1–2': `${dauer(l.je['1B'])} (${l.auftraege1B} Aufträge)`,
    'davon 1B Schritte 3–4': `${dauer(l.je['1B 3–4'])} (${l.reihen1B3u4.laeufe} Läufe, ${l.reihen1B3u4.auftraege} Aufträge)`,
    'davon 1C Laborläufe': `${dauer(l.je['1C'])} (${l.laeufe1C} Läufe)`,
    'Zeitraum der gewerteten Läufe': k.zeitraum,
    'Aufbau, Tests und weitere Läufe': `**${k.vorarbeitStunden}** (${dauer(v.gesamtSek)}, ${zahl(Math.round(v.gesamtSek))} s)`,
    'zusätzlich 1A Ressourcenisolation': `${dauer(v.je['1A'])} (Vorlauf; ${summe(v.fenster.filter((f) => f.git1A).map((f) => f.laeufe))} gelöschte Läufe aus Git)`,
    'zusätzlich 1B Schritte 1–2': `${dauer(v.je['1B'])} (${v.vm.starts} VM-Starts, davon ${v.vm.startsWindows} Windows)`,
    'zusätzlich 1B Schritte 3–4': `${dauer(v.je['1B 3–4'])} (${v.fenster.filter((f) => f.auftrag === '1B 3–4').length} Zeitfenster)`,
    'zusätzlich 1C Laborläufe': `${dauer(v.je['1C'])} (${v.fenster.filter((f) => f.auftrag === '1C').length} Zeitfenster)`,
    'Automatisierte Tests': `**${k.tests}**`,
    ADRs: `**${k.adrs}** (1B: ${a['1B']}, 1C: ${a['1C']})`,
    'Vorab festgelegte Hypothesen und Kriterien': `**${k.hypothesen}**`,
    'Messwerkzeuge 1B/1C': `${g.evidenz.tests} (${g.evidenz.dateien} Dateien)`,
    'Pester 1B (Windows)': `${g.pester.tests} (${g.pester.dateien} Dateien)`,
    '1A Lastwerkzeuge': `${g.load.tests} (${g.load.dateien} neue Dateien)`,
    'Backend 1C': `${g.backend.tests} (${g.backend.neueDateien} neue Dateien, netto ${g.backend.nettoInGeaenderten >= 0 ? '+' : '−'}${Math.abs(g.backend.nettoInGeaenderten)} in geänderten)`,
    '1A (Experimentvertrag)': String(h.je['1A']),
    '1B Schritte 1–2': String(h.je['1B']),
    '1B Schritte 3–4': String(h.je['1B 3–4']),
    '1C Einzeltests E': String(h.je['1C-E']),
    '1C Messungen M': String(h.je['1C-M']),
    '1C Labor L': String(h.je['1C-L']),
    '1C Nachlauf N': String(h.je['1C-N']),
    '1C Gate-Ablation H_A': String(h.je['1C-H_A']),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const werte = berechneNachweisumfang();
  console.log(JSON.stringify({ ...werte, kopfzahlen: kopfzahlen(werte) }, null, 2));
}
