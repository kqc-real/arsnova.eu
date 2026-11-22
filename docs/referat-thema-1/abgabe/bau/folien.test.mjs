// Tests für die Folieninhalte (Task 5): Zeiten, Pflichtfelder, echte Artefakte und die Regel
// „keine Zahl, die nicht aus den Daten stammt“.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
  FESTWERTE,
  MATRIKEL_VERMERK,
  REPO_URL,
  TEILE,
  TITEL,
  folien,
  ladeFolienDaten,
  qrSvg,
  teilVon,
} from './folien.mjs';
import {
  abstimmungSvg,
  fussballfeldSvg,
  gateRasterSvg,
  systemSvg,
  wegSvg,
  zeitzerlegungSvg,
} from './grafik.mjs';
import { fmt } from './zahlen.mjs';
import { mitNotizen } from './notizen.mjs';

// Ablesetexte und Stichpunkte liegen privat (privat/notizen.mjs); ohne sie entfallen die Prüfungen dazu
const OHNE_NOTIZEN = mitNotizen ? false : 'privat/notizen.mjs fehlt (eigenes Repo)';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const daten = ladeFolienDaten(ROOT);
const F = folien(daten);
const nach = (id) => F.find((f) => f.id === id);
const jonas = F.filter((f) => f.teil === 'jonas');
const summe = (liste) => liste.reduce((s, f) => s + f.zeitS, 0);

/**
 * Seit 2026-11-16 (Entscheidung der Autoren): 15 min Redezeit je Person, Fragen kommen hinzu. Aus der Reserve
 * in den Hauptteil: J5b (bis dahin R8), J8b (R2), J10a (R4), J10b (R3), J11 (R13), J13b (R14). Niklas eröffnet
 * (GT, G0, GK, 1A), Jonas spricht J1–J15 und J16, Niklas schließt (1B 3–4, G9, GD).
 * Davor: Budget höchstens etwa 10:30 min samt Rahmenanteil (Absprache 2026-11-16).
 * Davor: Zeiten nach dem zweiten Audit 2026-11-16: G0 bis J16 höchstens 9:00 min (Kursvorschlag 9 + 6, Sprungplan =
 * Plan); J2, J4–J9 und J13 gekürzt. Davor: G0 bis J16 etwa 10:30 min. J11 (Betrieb) ist Reserve R13, J16 steht als
 * Anhang nach G9; J2, J4, J8 und J15 gekürzt. Früher: J14 in die Reserve (R11, fachliche Prüfung 2).
 */
const PLAN = {
  J1: 50,
  J2: 45,
  J3: 45,
  J4: 40,
  J5: 40,
  J5b: 45,
  J6: 55,
  J7: 45,
  J8: 40,
  J8b: 35,
  J9: 50,
  J10: 30,
  J10a: 40,
  J10b: 30,
  J11: 55,
  J12: 60,
  J13: 70,
  J13b: 50,
  J15: 45,
  J16: 3,
  J16b: 2,
};

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

/** Sichtbarer Text ohne Tags; Grafiken aus grafik.mjs sind dort schon getestet und werden entfernt. */
function sichtbar(html) {
  let s = html;
  for (const svg of grafiken()) s = s.split(svg).join(' ');
  s = s.replace(/<(pre|blockquote)\b[^>]*data-artefakt[^>]*>[\s\S]*?<\/\1>/g, ' ');
  return decode(s.replace(/<[^>]+>/g, ' '));
}

let grafikCache;
function grafiken() {
  if (!grafikCache) {
    const { b1, c1, auftrag } = daten;
    grafikCache = [
      ...['klick', 'kontext', 'netz', 'inferenz', 'nachpruefung', 'gate', null].map((aktiv) =>
        wegSvg({ aktiv, b1, c1, auftrag }),
      ),
      zeitzerlegungSvg(b1),
      zeitzerlegungSvg(b1, { kalt: false }),
      zeitzerlegungSvg(b1, { stufen: true }),
      // Seit 2026-11-16: Systembild (GK), Zeitleiste (J12), Raster (J13), eingebettete 1C-Diagramme (R15, R16);
      // ihre Zahlen prüft grafik.test.mjs bzw. stammen aus 1C/1C-diagrams.md.
      systemSvg({ clients: FESTWERTE.liveClients.wert }),
      abstimmungSvg({ auftrag }),
      gateRasterSvg({ n1B: b1.verworfen, n1C: c1.gateAntwortenGesamt.wert }),
      ...Object.values(daten.diagramme).map((d) => d.svg),
      ...[0, 1].map((zoom) => fussballfeldSvg(b1, { zoom })),
    ];
  }
  return grafikCache;
}

/** Kennungen, die Ziffern enthalten, aber keine Messwerte sind. */
const KENNUNGEN = [
  /\bv1\.[34]\.0-\d+\b/g, // git describe
  /\b1[BC]-\d{3}\b/g, // ADR-Nummern
  /\bADR-\d{4}\b/g,
  /#\d+/g, // Issues
  /\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{8,}\b/g, // Commits
  /\bThema 1\b/g,
  /\bDSCC\d{4}\b/g, // Modulnummer (Titelfolie)
  /\b\d{2}\.\d{2}\.\d{4}\b/g, // Prüfungstermin (Titelfolie, TITEL.datum)
  /\breferat-thema-1\b/g, // Ordner im Belegrepository (Dankfolie)
  /\b(?:Release |Version |v)?1\.[34](?:\.0)?\b/g, // Release- und Versionsnummern
  /\bSchritte? \d(?:–\d)?\b/g,
  /\b[1][ABC]\b/g, // Aufträge
  /\bH_[A-Z]+\d\b/g,
  /\b[EMNLTUJRG]\d{1,2}(?:\.\d)?[ab]?\b/g, // Fall- und Folienkennungen
  /\bt\s?[0-3]\b/g, // Messpunkte t0–t3
  /Qwen3-4B(?:-Instruct-2507)?/g,
  /\bQ4_K_M\b/g,
  /\bSHA-256\b/g,
  /\bUTF-8\b/g,
  /\bOpus \d\.\d\b/g,
  /\bv\d\b/g, // Vertragsfassungen
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, // IP-Adressen der Labor-VMs
  /§\s?\d+/g, // Abschnitte des Runbooks
  /#456\b/g,
  /\bZ\.(?: |&nbsp;)\d+(?:, \d+)*/g, // Zeilennummern im Code (R14)
  /\bet al\. \(\d{4}\)/g, // Jahr eines Kurzbelegs im Text
];

function whitelist() {
  const w = new Set(['2026']);
  const zahl = (v) => {
    for (const k of [0, 1, 2, 3]) {
      w.add(fmt(v, k));
      w.add(fmt(v / 1000, k));
      w.add(fmt(v * 100, k));
    }
    for (const x of [...w]) if (x.startsWith('−')) w.add(x.slice(1));
    w.add(String(v));
  };
  const ziffern = (s) => (String(s).match(/\d+(?:[.,]\d+)*/g) ?? []).forEach((t) => w.add(t));
  const blaetter = (o) => {
    if (typeof o === 'number') zahl(o);
    else if (Array.isArray(o)) o.forEach(blaetter);
    else if (o && typeof o === 'object') Object.values(o).forEach(blaetter);
  };
  blaetter(daten.b1); // Zahlen; Commit und Rechner sind Text und bleiben außen vor
  for (const e of Object.values(daten.c1)) {
    if (typeof e.wert === 'number') zahl(e.wert);
    else ziffern(e.wert);
  }
  blaetter({ a: daten.antwort.auftrag, b: daten.antwort.aussagen, c: daten.antwort.mitTrenner });
  const { requestedAt, finishedAt, ...auftragZahlen } = daten.auftrag;
  blaetter(auftragZahlen);
  for (const iso of [requestedAt, finishedAt]) ziffern(iso.slice(11, 23).replace('.', ','));
  blaetter(daten.nutzlast.zahlen);
  blaetter(daten.abgeleitet);
  for (const f of daten.nachbau.fragen) ziffern(f);
  for (const v of Object.values(daten.nachweis)) if (typeof v === 'string') ziffern(v);
  for (const j of daten.nachweis.je)
    for (const v of [j.dauer, j.zusatz, j.vor.dauer, j.vor.zusatz]) ziffern(v);
  for (const v of Object.values(daten.nachweis.zeilen)) ziffern(v);
  for (const f of Object.values(FESTWERTE)) zahl(f.wert);
  return w;
}

test('Jonas-Folien in Reihenfolge mit den geplanten Zeiten, 14:00–15:00 min; Rahmen spricht Niklas', () => {
  assert.deepEqual(
    jonas.map((f) => f.id),
    Object.keys(PLAN),
  );
  for (const f of jonas) assert.equal(f.zeitS, PLAN[f.id], f.id);
  // Jonas spricht seit der Durchsicht 2026-11-18 auch GN (Nachweisumfang, 20 s); zusammen höchstens 15 min.
  const s = summe(jonas) + nach('GN').zeitS;
  assert.ok(s >= 840 && s <= 900, `Summe ${s}`);
  // Die übrigen Rahmenfolien (Titel, Fahrplan, Fazit, Dank) spricht Niklas; sie zählen zu seiner Zeit.
  const rahmen = F.filter((f) => f.teil === 'rahmen');
  assert.deepEqual(
    rahmen.map((f) => f.id),
    ['GT', 'G0', 'GK', 'G9', 'GN', 'GD'],
  );
  for (const f of rahmen) assert.equal(f.sprecher, f.id === 'GN' ? 'jonas' : 'niklas', f.id);
  assert.equal(nach('GN').zeitS, 20);
  // Titel, Fahrplan und Dank zusammen kurz (etwa 25 s plus Leitfrage auf G0); GK (Systembild) 45–60 s
  assert.ok(summe(rahmen.filter((f) => !['G9', 'GK', 'GN'].includes(f.id))) <= 60);
  assert.ok(nach('GK').zeitS >= 45 && nach('GK').zeitS <= 60);
});

test(
  'Stichpunkte: jede Jonas-Folie (außer J16) und Reserve 3–6, [Weiter] je Aufbaustufe',
  { skip: OHNE_NOTIZEN },
  () => {
    for (const f of F.filter((x) => x.sprecher !== 'niklas' && !/^J16b?$/.test(x.id))) {
      assert.ok(f.stichpunkte?.length >= 3 && f.stichpunkte.length <= 6, `${f.id}: Stichpunkte`);
      for (const p of f.stichpunkte)
        assert.ok(p.length <= 130, `${f.id}: Stichpunkt zu lang: ${p}`);
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
    // Erster und letzter Satz wörtlich (Leitfaden F27): Jonas beginnt auf J1 mit der Übernahme von Niklas
    const erster = F.find((f) => f.id === 'J1');
    assert.ok(erster.notiz.startsWith(erster.stichpunkte[0].replace(/^„|“$/g, '')));
    const letzter = F.find((f) => f.id === 'J15');
    assert.ok(
      letzter.notiz.trim().endsWith(letzter.stichpunkte.at(-1).replace(/^\[Weiter\] „|“$/g, '')),
    );
  },
);

test(
  'Aufbau: J7, J9, J12, J13, J15 bei Jonas und GK, je Stufe ein data-ab',
  { skip: OHNE_NOTIZEN },
  () => {
    const mit = F.filter((f) => f.aufbau && f.sprecher !== 'niklas').map((f) => f.id);
    assert.deepEqual(mit, ['J7', 'J9', 'J12', 'J13', 'J15']);
    for (const id of [...mit, 'GK']) {
      const f = nach(id);
      const ab = [...f.inhalt.matchAll(/data-ab="(\d+)"/g)].map((m) => Number(m[1]));
      assert.deepEqual(
        [...new Set(ab)].sort(),
        Array.from({ length: f.aufbau }, (_, i) => i + 1),
        id,
      );
      assert.equal(
        (f.notiz.match(/\[Weiter\]/g) ?? []).length,
        f.aufbau,
        `${id}: [Weiter] je Stufe`,
      );
    }
  },
);

test('Teile: Fahrplan auf G0 in Vortragsreihenfolge, teilVon ordnet jede Hauptfolie zu', () => {
  const g0 = nach('G0').inhalt;
  let pos = 0;
  for (const t of TEILE) {
    const i = g0.indexOf(t.was, pos);
    assert.ok(i > pos, `G0 Fahrplan: ${t.id}`);
    pos = i;
  }
  for (const id of ['GT', 'G0', 'GD']) assert.equal(teilVon(nach(id)), null, id);
  // Vortragsreihenfolge (Design 2026-11-15, Abschnitt 3): Niklas 1A, Jonas, Niklas 1B 3–4, Fazit
  assert.deepEqual(
    TEILE.map((t) => `${t.id}:${t.wer}`),
    ['1a:Niklas', 'jonas:Jonas', '1b34:Niklas', 'fazit:Gemeinsam'],
  );
  assert.equal(teilVon(nach('J5')), 'jonas');
  assert.equal(teilVon(nach('G9')), 'fazit');
  assert.equal(teilVon(nach('GN')), 'fazit');
  assert.equal(teilVon(nach('J16')), null);
  assert.equal(teilVon({ teil: 'reserve', id: 'R0' }), null);
  assert.equal(teilVon({ teil: 'niklas', auftrag: '1A', id: 'N1' }), '1a');
  assert.equal(teilVon({ teil: 'niklas', auftrag: '1B', id: 'M1' }), '1b34');
  // G9 nimmt die Leitfrage von G0 wörtlich auf (Klammer Anfang–Ende)
  const leitfrage = g0.match(/„Wie wirksam[^“]+“/)[0];
  assert.ok(nach('G9').inhalt.includes(leitfrage));
});

test('Kurzfassung: nur Jonas-Folien, Summe 300–420 s; G9 gehört zu Niklas’ Kurzfassung', () => {
  assert.equal(F.find((f) => f.id === 'G9').kurzfassung, true);
  const k = F.filter((f) => f.kurzfassung && f.sprecher !== 'niklas');
  assert.ok(
    k.every((f) => f.teil === 'jonas'),
    'nur Jonas-Folien',
  );
  const s = summe(k);
  assert.ok(s >= 300 && s <= 420, `Summe ${s}`);
});

test(
  'Pflichtfelder: quelle mit Rechner und Commit, notiz, auftrag, station',
  { skip: OHNE_NOTIZEN },
  () => {
    const stationen = new Set([
      'klick',
      'kontext',
      'netz',
      'inferenz',
      'nachpruefung',
      'gate',
      null,
    ]);
    for (const f of F) {
      assert.ok(['rahmen', 'jonas', 'reserve'].includes(f.teil), f.id);
      assert.ok(f.titel?.trim(), `${f.id} titel`);
      assert.ok(f.inhalt?.trim(), `${f.id} inhalt`);
      assert.ok(stationen.has(f.station), `${f.id} station ${f.station}`);
      assert.equal(typeof f.kurzfassung, 'boolean', f.id);
      // J16 ist das Literaturverzeichnis ohne eigene Messwerte (literatur.test.mjs prüft die Einträge).
      if (f.teil === 'rahmen' || /^J16b?$/.test(f.id)) continue;
      assert.ok(f.quelle?.trim(), `${f.id} quelle`);
      assert.ok(f.notiz?.trim(), `${f.id} notiz`);
      assert.match(f.quelle, /\b[0-9a-f]{8}\b/, `${f.id}: Commit in der quelle`);
      assert.match(f.quelle, /ThinkPad P50|i7-8700|Laptop|PC/, `${f.id}: Rechner in der quelle`);
    }
    for (const f of jonas) assert.ok(['1C', '1B', 'beide'].includes(f.auftrag), `${f.id} auftrag`);
  },
);

test(
  'Sprechnotizen passen zur Folienzeit (etwa 130 Wörter je Minute)',
  { skip: OHNE_NOTIZEN },
  () => {
    for (const f of jonas) {
      const woerter = f.notiz.trim().split(/\s+/).length;
      const soll = (f.zeitS * 130) / 60;
      assert.ok(
        woerter >= soll * 0.7 && woerter <= soll * 1.3,
        `${f.id}: ${woerter} Wörter, Soll etwa ${Math.round(soll)}`,
      );
    }
  },
);

test('Rahmen: GT, G0, G9, GD ohne Entwurfsvermerk und Platzhalter; G9 zitiert Niklas', () => {
  for (const id of ['GT', 'G0', 'GK', 'G9', 'GN', 'GD']) assert.equal(nach(id)?.teil, 'rahmen', id);
  for (const id of ['GT', 'G0', 'GK', 'G9', 'GN', 'GD']) {
    assert.doesNotMatch(sichtbar(nach(id).inhalt) + nach(id).notiz, /Entwurf|\[Niklas|\[Satz/, id);
  }
  assert.match(nach('G9').fuss, /Schneider, 2026/);
  assert.deepEqual(
    F.slice(0, 3).map((f) => f.id),
    ['GT', 'G0', 'GK'],
  );
  // Seit 2026-11-22 keine Reservefolien mehr: das Deck endet mit dem Literaturverzeichnis.
  assert.equal(F.at(-1).id, 'J16b');
  // J16 (Literaturverzeichnis) folgt als Anhang nach Fazit und Dank, nicht zwischen J15 und Niklas.
  const haupt = F.filter((f) => f.teil !== 'reserve').map((f) => f.id);
  assert.deepEqual(haupt.slice(-6), ['J15', 'G9', 'GN', 'GD', 'J16', 'J16b']);
  for (const id of ['J16', 'J16b']) assert.equal(nach(id).anhang, true);
});

test('1B mit Schritten ist ein Chip: Schritte stehen im Etikett, nicht daneben (Durchsicht 2026-11-18)', async () => {
  const { etikett } = await import('./folien.mjs');
  assert.equal(etikett('1C'), '<span class="etikett etikett-1c">1C</span>');
  assert.equal(
    etikett('1B', '1–2'),
    '<span class="etikett etikett-1b">1B <span class="etikett-schritte">Schritte 1–2</span></span>',
  );
  for (const f of F) {
    assert.doesNotMatch(f.inhalt, /class="zusatz">Schritte/, `${f.id}: Schritte neben dem Chip`);
    // Schritte als loser Zusatz hinter einem 1B-Etikett
    assert.doesNotMatch(
      f.inhalt,
      /etikett-1b">1B<\/span>\s*<span[^>]*>Schritte/,
      `${f.id}: Schritte neben dem Chip`,
    );
  }
  // Fragezeilen tragen nur Auftragsetiketten, nie Schritte (map(etikett) reichte den Index weiter)
  for (const f of F) {
    const frage = f.inhalt.match(/<p class="folie-frage">[\s\S]*?<\/p>/)?.[0] ?? '';
    assert.doesNotMatch(frage, /etikett-schritte/, `${f.id}: Schritte in der Fragezeile`);
  }
  for (const id of ['GT', 'G0', 'J1', 'G9']) {
    const n = (nach(id).inhalt.match(/etikett-schritte/g) ?? []).length;
    assert.ok(n >= (id === 'J1' ? 1 : 2), `${id}: 1B-Chips mit Schritten (${n})`);
  }
});

test('G0: „Gemeinsam“ mit 1A, 1B, 1C ohne Schritte und „Fazit: Antwort auf die Leitfrage“', () => {
  const g0 = nach('G0').inhalt;
  const spalte = g0.split('<li>').at(-1);
  assert.match(spalte, /Gemeinsam/);
  for (const a of ['1a', '1b', '1c'])
    assert.ok(spalte.includes(`etikett-${a}">${a.toUpperCase()}</span>`), a);
  assert.doesNotMatch(spalte, /etikett-schritte|alle Aufträge/);
  assert.match(spalte, /Fazit: Antwort auf die Leitfrage/);
});

test('GK: „arsnova.eu im Überblick“ mit dem Untertitel aus der Durchsicht', () => {
  const gk = nach('GK');
  assert.equal(gk.titel, 'arsnova.eu im Überblick');
  assert.ok(
    sichtbar(gk.inhalt).includes(
      'Open-Source-Live-App (MIT) für den Hörsaal mit Live-Interaktion in der Lehre, ohne Pflichtkonten, KI nur als Zusatz.',
    ),
  );
});

test('J2: Konfiguration in vier Spalten (Release 1.3, ab Werk, Labor 1B, Labor 1C), J4 ohne Abweichungskasten', () => {
  const j2 = nach('J2').inhalt;
  const tabelle = j2.match(/<table data-konfig[\s\S]*?<\/table>/)?.[0];
  assert.ok(tabelle, 'Tabelle data-konfig auf J2');
  const zellen = (tr) => [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => m[1]);
  const zeilen = [...tabelle.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => zellen(m[1]));
  const ohne = (z) =>
    z
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  assert.deepEqual(zeilen[0].slice(1).map(ohne), [
    'Release 1.3 (Tag v1.3.0)',
    'v1.4.0 ab Werk (gemessener Code)',
    'Labor 1B (zwei VMs)',
    'Labor 1C (Laptop)',
  ]);
  const werte = Object.fromEntries(zeilen.slice(1).map((z) => [ohne(z[0]), z.slice(1)]));
  assert.deepEqual(Object.keys(werte), ['CPUs und Threads', 'Speicher Runtime', 'Summary-Timeout']);
  assert.deepEqual(werte['CPUs und Threads'].map(ohne), ['4', '8', '4', '4']);
  assert.deepEqual(werte['Speicher Runtime'].map(ohne), ['5 GiB', '8 GiB', '8 GiB', '5 GiB']);
  assert.deepEqual(werte['Summary-Timeout'].map(ohne), ['8 s', '90 s', '300 s', '300 s']);
  // Fett genau, was vom gemessenen Code (v1.4.0 ab Werk) abweicht, und nur in den Laborspalten
  const fett = Object.values(werte).map((z) => z.map((c) => /<b>/.test(c)));
  assert.deepEqual(fett, [
    [false, false, true, true],
    [false, false, false, true],
    [false, false, true, true],
  ]);
  assert.doesNotMatch(sichtbar(j2), /Abweichungen und Grenzen/);
  assert.doesNotMatch(sichtbar(nach('J4').inhalt), /Abweichungen und Grenzen/);
});

test('Titelfolie: großer Titel ohne „Thema 1:“, Oberzeile mit Thema und Kurs', () => {
  const gt = nach('GT');
  assert.equal(gt.titel, 'KI-Inferenz im Moderationskompass');
  assert.equal(gt.oberzeile, 'Thema 1 · Cloud Computing');
});

test('Titelfolie: beide Namen, Kurs, Hochschule, Prüfer, Datum; Platz für Matrikelnummern ohne Ziffern', () => {
  const gt = nach('GT');
  const text = sichtbar(gt.inhalt);
  for (const w of ['Niklas Schneider', 'Jonas Weirauch', TITEL.kurs, TITEL.modul, TITEL.hochschule])
    assert.ok(text.includes(w), w);
  assert.ok(text.includes(TITEL.pruefer) && text.includes(TITEL.datum));
  assert.equal(TITEL.hochschule, 'IU Internationale Hochschule');
  assert.equal(TITEL.pruefer, 'Prof. Dr. Klaus Quibeldey-Cirkel');
  assert.equal(TITEL.datum, '24.11.2026');
  const plaetze = [...gt.inhalt.matchAll(/data-matrikel="([^"]+)"[^>]*>([^<]*)</g)];
  assert.deepEqual(
    plaetze.map((m) => m[1]),
    ['Niklas Schneider', 'Jonas Weirauch'],
  );
  for (const m of plaetze) {
    assert.equal(m[2], MATRIKEL_VERMERK);
    assert.doesNotMatch(m[2], /\d/, 'keine Ziffer im Repo');
  }
});

test('Dankfolie: Einladung zu Fragen, Link und offline erzeugter QR-Code zum Belegrepository', async () => {
  const { LITERATUR } = await import('./literatur.mjs');
  const gd = nach('GD');
  assert.match(gd.titel, /Danke/);
  assert.match(gd.titel, /Fragen/);
  assert.ok(gd.inhalt.includes(`href="${REPO_URL}"`));
  assert.match(gd.inhalt, /<svg[^>]+aria-label="QR-Code zum Belegrepository"/);
  assert.equal(gd.quellenverzeichnis, true, 'URL nur zwischen Quellen-Marken');
  // Gleiche Adresse wie der Eintrag der eigenen Arbeit im Literaturverzeichnis
  assert.ok(LITERATUR.some((e) => e.voll.includes(REPO_URL)));
  // QR-Code deterministisch und mit Ruhezone
  assert.equal(qrSvg(REPO_URL), qrSvg(REPO_URL));
  assert.match(qrSvg('x', 100), /viewBox="0 0 29 29"/);
});

test('Keine Reservefolien (seit 2026-11-22 entfernt); aus der Reserve geholte Folien im Hauptteil', () => {
  assert.deepEqual(
    F.filter((f) => f.teil === 'reserve').map((f) => f.id),
    [],
  );
  // Aus der Reserve geholt: Behauptung als Titel, ohne „Reserve:“, mit Station des Auftrags
  const geholt = {
    J5b: 'kontext',
    J8b: 'netz',
    J10a: 'inferenz',
    J10b: 'inferenz',
    J11: 'inferenz',
    J13b: null,
  };
  for (const [id, station] of Object.entries(geholt)) {
    assert.equal(nach(id).teil, 'jonas', id);
    assert.doesNotMatch(nach(id).titel, /Reserve/, id);
    assert.equal(nach(id).station, station, id);
  }
});

test(
  'Abb. 1 und 2 aus 1C/1C-diagrams.md: Daten offline, eigene Ids, keine externen Verweise (Folien R15, R16 seit 2026-11-22 entfernt)',
  { skip: OHNE_NOTIZEN },
  () => {
    for (const k of ['abb1', 'legende', 'abb2']) {
      const d = daten.diagramme[k];
      assert.match(
        d.svg,
        /^<svg[^>]+role="img"[^>]+aria-label="Abb\.|^<svg[^>]+role="img"[^>]+aria-label="Legende/,
      );
      assert.doesNotMatch(d.svg, /my-svg/, `${k}: Ids umbenannt`);
      assert.doesNotMatch(
        d.svg,
        /<image\b|href="https?:|url\(\s*['"]?https?:|@import/,
        `${k}: extern`,
      );
      assert.ok(d.verhaeltnis > 0.5 && d.verhaeltnis < 4, k);
    }
    // Ids je Abbildung verschieden, keine Kollision im Deck
    const ids = (svg) => [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const alle = Object.values(daten.diagramme).flatMap((d) => ids(d.svg));
    assert.equal(new Set(alle).size, alle.length);
    // J3 verweist ohne Unordnung auf die Reserve (eine Zeile Vermerk, Satz in Notiz und Stichpunkten)
    assert.match(
      sichtbar(nach('J3').inhalt),
      /Vereinfacht aus Abb\. 1 und 2 \(1C\/1C-diagrams\.md\)/,
    );
    assert.match(nach('J3').notiz, /UML-Diagramme.*Reserve/);
    assert.ok(nach('J3').stichpunkte.some((p) => /Reserve R15, R16/.test(p)));
  },
);

test('J13 zeigt die echte, gekürzte Modellantwort, den Grund des Tors und den Platz für den Clip', () => {
  const j13 = nach('J13');
  const a = daten.antwort;
  const roh = decode(j13.inhalt);
  const ersteZeile = a.ausgabe.split('\n')[0];
  assert.ok(roh.includes(ersteZeile), 'erste Aussage wörtlich');
  assert.ok(roh.includes(a.grund), 'Grund wörtlich');
  assert.equal(a.torAkzeptiert, false);
  assert.match(j13.inhalt, /data-clip="[^"]+"/);
  assert.ok(!/bearer|authorization/i.test(j13.inhalt), 'kein Token oder Header');
});

test('J6 zeigt einen wörtlichen Ausschnitt der echten Nutzlast aus dem committeten 1C-Beleg', () => {
  const j6 = nach('J6');
  const roh = JSON.parse(gunzipSync(readFileSync(resolve(ROOT, daten.nutzlast.datei))));
  const lauf = roh.labor.quiet.runs[daten.nutzlast.lauf];
  const body = JSON.parse(
    lauf.exchanges.find((e) => e.path === '/v1/chat/completions').rawRequestBody,
  );
  const user = body.messages.find((m) => m.role === 'user').content;
  assert.ok(daten.nutzlast.zeilen.length >= 3);
  for (const z of daten.nutzlast.zeilen) {
    assert.ok(user.includes(z), `nicht wörtlich: ${z}`);
    assert.ok(decode(j6.inhalt).includes(z), `fehlt auf J6: ${z}`);
  }
  assert.equal(lauf.preview.snapshotHash, lauf.sent.snapshotHash);
  assert.ok(j6.inhalt.includes(lauf.preview.snapshotHash.slice(0, 8)));
  assert.ok(j6.quelle.includes(daten.nutzlast.datei.replace(/^.*evidenz\//, 'evidenz/')));
  assert.ok(!/bearer|authorization|sessionId/i.test(j6.inhalt));
});

test('Festwerte (Schwellen, Release-Timeout) stehen wörtlich in ihrer Quelle', () => {
  for (const [name, f] of Object.entries(FESTWERTE)) {
    // git:<tag>:<pfad> = Datei am Release-Tag (unveränderlich), sonst relativ zu docs/referat-thema-1/
    const text = f.quelle.startsWith('git:')
      ? execFileSync('git', ['show', f.quelle.slice(4)], { cwd: ROOT, encoding: 'utf8' })
      : readFileSync(resolve(ROOT, f.quelle), 'utf8');
    assert.ok(text.includes(f.beleg), `${name}: Beleg fehlt in ${f.quelle}`);
    assert.ok(f.beleg.includes(fmt(f.wert)), `${name}: Wert nicht im Beleg`);
  }
});

test('Keine Zahl auf einer Folie, die nicht aus den Daten stammt', () => {
  const w = whitelist();
  // J16: Jahreszahlen, Seiten und DOIs des Literaturverzeichnisses prüft literatur.test.mjs.
  for (const f of F.filter((x) => !/^J16b?$/.test(x.id))) {
    for (const [feld, wert] of [
      ['titel', f.titel],
      ['inhalt', f.inhalt],
      ['notiz', f.notiz ?? ''],
    ]) {
      let s = feld === 'inhalt' ? sichtbar(wert) : wert;
      for (const re of KENNUNGEN) s = s.replace(re, ' ');
      for (const t of s.match(/\d+(?:[.,]\d+)*/g) ?? []) {
        assert.ok(w.has(t), `${f.id} ${feld}: „${t}“ stammt nicht aus den Daten`);
      }
    }
  }
});

test('Gruppen: warme Mediane tragen „warm“ und n = 9, nie „alle 10“ allein', () => {
  const warm = fmt(daten.b1.jobWarmMs / 1000, 1);
  for (const f of F) {
    const s = sichtbar(f.inhalt);
    if (s.includes(`${warm} s`)) assert.match(s, /warm/, `${f.id}: ${warm} s ohne „warm“`);
  }
});

test('Empfehlungen erscheinen nie als umgesetzt (ADR 1C-004)', () => {
  for (const f of F) {
    const s = sichtbar(f.inhalt);
    if (/empfohlen|Empfehlung/.test(s)) assert.match(s, /nicht umgesetzt/, f.id);
    assert.ok(!/\bumgesetzt\b/.test(s.replace(/nicht umgesetzt/g, '')), `${f.id}: „umgesetzt“`);
  }
});

test('Schreibregeln: kein Gedankenstrich-Einschub, kein „nicht X, sondern Y“, Farben nur als Token', () => {
  for (const f of F) {
    const s = `${f.titel} ${sichtbar(f.inhalt)}`;
    assert.ok(!s.includes('—'), `${f.id}: Geviertstrich`);
    assert.ok(!/ – [^–]+ – /.test(s), `${f.id}: Einschub mit Gedankenstrichen`);
    assert.ok(!/\bsondern\b/.test(s), `${f.id}: „sondern“`);
    let html = f.inhalt;
    for (const svg of grafiken()) html = html.split(svg).join('');
    assert.ok(
      !/#[0-9a-fA-F]{3,6}\b/.test(html.replace(/>[^<]*</g, '><')),
      `${f.id}: Farbe ohne Token`,
    );
  }
});

// ---------------------------------------------------------------- Nachbesserungen aus dem Review

test('J2 nennt den Commit des Aufbaus von null aus dessen Bericht', () => {
  const bericht = readFileSync(
    resolve(ROOT, 'evidenz/1B/messung/2026-11-13-aufbau-von-null.txt'),
    'utf8',
  );
  const commit = bericht.match(/^Repo: ([0-9a-f]{40})$/m)[1].slice(0, 8);
  const j2 = nach('J2');
  assert.ok(j2.quelle.includes(commit), `J2 quelle ohne ${commit}`);
  assert.ok(!j2.quelle.includes('747c8f7e'), 'J2 quelle nennt den Bericht vom 2026-11-12');
});

test(
  'J2 legt die CPU-Abweichung offen und behauptet keine Limits wie im Release',
  { skip: OHNE_NOTIZEN },
  () => {
    const j2 = nach('J2');
    const s = sichtbar(j2.inhalt);
    assert.ok(!/Limits wie im Release/.test(s), 'Limits wie im Release');
    // CPUs: Labor 4 gegen 8 ab Werk steht seit 2026-11-18 in der Konfigurationstabelle (Test „J2: Konfiguration …“)
    assert.match(s, /CPUs und Threads/);
    assert.match(s, /Speicherlimits wie ab Werk v1\.4\.0/);
    assert.match(j2.notiz, /4 statt 8/);
  },
);

test(
  'J1 nennt die Wartezeit des verfolgten Auftrags am Client (Klick bis Ergebnis), gerundet',
  { skip: OHNE_NOTIZEN },
  () => {
    const lauf = JSON.parse(
      readFileSync(resolve(ROOT, 'evidenz/1B/messung/2026-11-13-lauf.json'), 'utf8'),
    );
    const nr = daten.antwort.auftrag;
    const t = lauf.treiber.auftraege.find((a) => a.index === nr);
    const sek = fmt(Math.round(t.clientWaitMs / 1000));
    assert.equal(sek, '152');
    const j1 = nach('J1');
    assert.ok(j1.titel.includes(`${sek} Sekunden`), `Titel ohne ${sek} Sekunden: ${j1.titel}`);
    assert.ok(!j1.titel.includes(fmt(daten.b1.jobWarmMs / 1000, 1)), 'Median im Titel');
    assert.match(j1.notiz, /dieser Auftrag/i);
    assert.match(j1.notiz, /Median/);
    assert.match(sichtbar(j1.inhalt), /Median warm, n = 9/);
    // T_job bleibt als serverseitige Jobdauer benannt, nie als Zeit ab dem Klick.
    assert.match(sichtbar(j1.inhalt), /Jobdauer T_job/);
    assert.ok(!/T_job[^.]*vom Klick/.test(j1.notiz + sichtbar(j1.inhalt)));
  },
);

test(
  'Mediane auf J9, J10 tragen die Gruppe warm, n = 9; Notizen trennen Auftrag und Median',
  { skip: OHNE_NOTIZEN },
  () => {
    for (const id of ['J9', 'J10']) {
      assert.match(decode(nach(id).inhalt.replace(/<[^>]+>/g, '')), /warm, n = 9/, id);
      assert.match(nach(id).notiz, /Median/, `${id} notiz`);
    }
  },
);

test(
  'J12 nennt die Bedingung aus ADR 1C-016: nur Runden außer TEMPO',
  { skip: OHNE_NOTIZEN },
  () => {
    const j12 = nach('J12');
    assert.match(sichtbar(j12.inhalt), /TEMPO/);
    assert.match(j12.notiz, /TEMPO/);
    assert.ok(!/Dann endet jeder Auftrag/.test(j12.notiz));
  },
);

test('Jede Jonas-Folie zeigt ihr Auftragsetikett im Inhalt', () => {
  const hat = (html, a) => html.includes(`etikett-${a.toLowerCase()}`) || html.includes(`>${a}<`);
  for (const f of jonas.filter((x) => !/^J16b?$/.test(x.id))) {
    const noetig = f.auftrag === 'beide' ? ['1C', '1B'] : [f.auftrag];
    for (const a of noetig) assert.ok(hat(f.inhalt, a), `${f.id}: Etikett ${a} fehlt`);
  }
});

// ---------------------------------------------------------------- Fachliche Prüfung 1

const alles = (f) => `${f.titel} ${sichtbar(f.inhalt)} ${f.notiz ?? ''}`;
const jonasUndReserve = F.filter((f) => f.teil !== 'rahmen');

test('K1: Der Fallback trägt einen allgemeinen Hinweis; nirgends „ohne Hinweis“', () => {
  for (const f of F) assert.ok(!/ohne (jeden )?Hinweis/.test(alles(f)), `${f.id}: ohne Hinweis`);
  const j13 = nach('J13');
  assert.match(sichtbar(j13.inhalt), /Eine ausführliche Zusammenfassung war diesmal nicht möglich/);
  assert.match(sichtbar(j13.inhalt), /Grund/);
  assert.match(j13.quelle, /qaSummaryExtractive\.ts/);
});

test(
  'K2: Messstand nach v1.4.0 benannt, Stand vor dem Gate mit 19 von 20 full-context',
  { skip: OHNE_NOTIZEN },
  () => {
    for (const id of ['J1', 'J13', 'G9']) {
      assert.match(sichtbar(nach(id).inhalt), /1\.4\.0/, `${id}: Version 1.4.0 fehlt`);
    }
    for (const id of ['J13', 'G9']) {
      assert.match(sichtbar(nach(id).inhalt), /19 von 20/, `${id}: Stand vor dem Gate fehlt`);
    }
    assert.match(nach('J13').notiz, /9f230abc|vor dem Gate|Vor Version 1\.4\.0/);
    // „Release 1.3“ nur für die Architektur, nie als Messstand
    for (const f of F) {
      assert.ok(!/Release 1\.3 nachgebaut/.test(alles(f)), `${f.id}: Release 1.3 nachgebaut`);
      assert.ok(
        !/(gemessen|Messung)[^.]*Release 1\.3/.test(alles(f)),
        `${f.id}: gemessen … Release 1.3`,
      );
    }
    assert.match(sichtbar(nach('J2').inhalt), /1\.4\.0/);
  },
);

test('W1: J8 erklärt den Abstand zwischen Wartezeit am Client und T_job', () => {
  const j8 = nach('J8');
  const s = sichtbar(j8.inhalt);
  assert.match(s, new RegExp(fmt(daten.auftrag.clientWaitMs / 1000, 1)));
  assert.match(s, new RegExp(fmt(daten.auftrag.jobMs / 1000, 1)));
  assert.match(s, /T_job/);
});

test(
  'W2: Das Gate prüft mehr als die Form; Sprache und Inhalt nennt die Folie getrennt',
  { skip: OHNE_NOTIZEN },
  () => {
    for (const f of F) {
      assert.ok(
        !/(prüft|scheitert)[^.]*nur (an )?(die|der) Form/.test(alles(f)),
        `${f.id}: nur die Form`,
      );
    }
    const j13 = nach('J13');
    assert.match(j13.notiz, /Sprache/);
    assert.match(j13.notiz, /mindestens zwei Aussagen|verschiedene Stichwörter/);
    assert.match(sichtbar(nach('J15').inhalt), /inhaltlich/);
  },
);

test(
  'W3: Karte J3 kennzeichnet je Station die Herkunft; Auftrag 2 mit eigenen Werten',
  { skip: OHNE_NOTIZEN },
  () => {
    const j3 = nach('J3');
    const svg = j3.inhalt;
    assert.ok(svg.includes(`${fmt(daten.auftrag.hostReturnMs)} ms`), 'T_host von Auftrag 2');
    assert.ok(svg.includes(`Auftrag ${daten.auftrag.nr}`));
    assert.ok(svg.includes('1C-Test · 248029dc'));
    assert.ok(svg.includes('1C-Labor · def56700'));
    assert.ok(
      !svg.includes(`${fmt(daten.c1.requestMs.wert, 1)} ms`),
      '1C-Klickwert auf dem app-host',
    );
    assert.match(j3.notiz, /1C/);
  },
);

test('W4/W5: Abweichungen und Grenzen je Auftrag offengelegt (seit 2026-11-18 gesammelt auf J2)', () => {
  const j2 = sichtbar(nach('J2').inhalt);
  // Zahlen der Abweichungen prüft „J2: Konfiguration …“; hier die übrigen Abweichungen und das 1C-Labor
  for (const re of [
    /Labor 1B/,
    /Labor 1C/,
    /202\ss/,
    /selbst gebaut/,
    /ohne Wrapper/,
    /Schalter/,
    /von Hand/,
    /ein Rechner/,
    /Loopback/,
  ])
    assert.match(j2, re, `J2: ${re}`);
  const j11 = sichtbar(nach('J11').inhalt);
  assert.match(j11, /5 GiB/);
  assert.match(j11, /21\./);
  assert.match(j11, /9f230abc/);
});

test(
  'W6/W7/W8: Speicher bei wechselnden Prompts, warm = identischer Snapshot, R1 mit den richtigen Kalibrierungen',
  { skip: OHNE_NOTIZEN },
  () => {
    assert.match(sichtbar(nach('J11').inhalt), /wechselnden Prompts/);
    assert.match(nach('J9').notiz, /identisch/);
  },
);

test('W12: J15 nennt Entscheidungen je Auftrag (R12 seit 2026-11-22 entfernt)', () => {
  // ohne die Fragezeile im Kopf (Kopfgrammatik)
  const j15 = sichtbar(nach('J15').inhalt.replace(/<p class="folie-frage">[\s\S]*?<\/p>/, ''));
  assert.match(j15, /nicht umgesetzt/);
  assert.match(j15, /1C/);
  assert.match(j15, /1B/);
});

test(
  'W14/I-06: Ohne freigegebenen Clip zeigt J13 den Nachbau; die Notiz nennt ihn so',
  { skip: OHNE_NOTIZEN },
  () => {
    const ohneClip = folien({ ...daten, clip: null }).find((f) => f.id === 'J13');
    assert.match(ohneClip.notiz, /Nachbau/);
  },
);

test('Abdeckung: R8–R10 nennen Berechtigung, Konsistenzfälle und Rollen mit Belegen', () => {
  assert.match(sichtbar(nach('J5b').inhalt), /assertHostSessionAccessFromContext/);
  for (const f of jonasUndReserve) assert.ok(f.quelle, f.id);
});

// ---------------------------------------------------------------- Fachliche Prüfung 2

const sichtbarAlle = () => F.map((f) => `${f.id}: ${alles(f)}`).join('\n');

test(
  'I-01: Netz in ms zuerst; Prozentanteil nur mit Hinweis auf die langsame CPU',
  { skip: OHNE_NOTIZEN },
  () => {
    assert.match(nach('J9').notiz, /langsame/);
    const j9svg = nach('J9').inhalt;
    assert.match(j9svg, /langsame CPU/);
    assert.ok(!/Transport ist damit rund/.test(nach('J9').notiz));
  },
);

test('I-02: Start ohne Wrapper mit dem richtigen Grund (Override)', () => {
  const j2 = alles(nach('J2'));
  assert.match(j2, /Override/);
  assert.ok(!/weil Runbook §6 ihn bricht|nach dem Runbook nicht läuft/.test(j2));
  assert.ok(!/Laptop nicht mehr hat/.test(j2), 'B-01');
});

test(
  'I-03: Gate-Befund mit Geltungsbereich (38 beobachtete Antworten, ein Modell, eine Fixture)',
  { skip: OHNE_NOTIZEN },
  () => {
    assert.ok(
      !/verwirft (das Gate )?jede (Modell)?[Aa]ntwort/.test(sichtbarAlle()),
      'unbegrenzt „jede Antwort“',
    );
    const j13 = nach('J13');
    assert.match(j13.titel, new RegExp(`${daten.abgeleitet.gateBeobachtet}`));
    assert.match(sichtbar(j13.inhalt), /ein Modell/);
    assert.match(sichtbar(j13.inhalt), /eine Fixture/);
    assert.match(j13.notiz, /failed|ohne Aussagen/);
    assert.match(sichtbar(nach('G9').inhalt), /geprüft/);
  },
);

test('I-04: KI-Anteil und Methode nennen die Ausnahmen der Vorabfestlegung', () => {
  for (const id of ['J4']) {
    const s = sichtbar(nach(id).inhalt);
    assert.ok(!/vor jeder Messung|bevor gemessen wurde|vor jedem Lauf/.test(s), id);
    assert.match(s, /M7b/, id);
    assert.match(s, /ohne vorherige Freigabe/, id);
    assert.match(s, /1B-Leitfrage/, id);
  }
});

test('I-05/R3-I4: Nachprüfung mit belegtem Preis unter Voting, ohne Vorhersage als Tatsache', () => {
  assert.ok(!/kostet fast nichts/.test(nach('J12').titel));
  for (const id of ['J12', 'J15']) {
    const t = alles(nach(id));
    assert.match(t, /Voting/, id);
    assert.match(t, /Stimme/, id);
    assert.ok(!/0,97|0,99/.test(t), `${id}: Vorhersage als Zahl`);
  }
  assert.match(sichtbar(nach('J12').inhalt), /M7/);
  assert.match(sichtbar(nach('J12').inhalt), /nicht belastbar|offen/);
  assert.ok(!/kein neues Risiko/.test(sichtbarAlle()));
});

test(
  'I-06: J13 zeigt den Nachbau der Lehrenden-Sicht mit echtem Inhalt und Hinweistext aus dem App-Code',
  { skip: OHNE_NOTIZEN },
  () => {
    const j13 = nach('J13').inhalt;
    assert.ok(!/Platz für den Clip/.test(j13));
    assert.match(j13, /data-nachbau/);
    assert.match(j13, /Nachbau/);
    for (const frage of daten.nachbau.fragen) assert.ok(decode(j13).includes(frage), frage);
    const quelle = readFileSync(
      resolve(ROOT, '../../apps/backend/src/lib/qaSummaryExtractive.ts'),
      'utf8',
    );
    assert.ok(quelle.includes(daten.nachbau.hinweis), 'Hinweis wörtlich aus dem App-Code');
    assert.ok(decode(j13).includes(daten.nachbau.hinweis));
    // Die Notiz nennt den Nachbau nur ohne Clip (mit Clip ersetzt deck.mjs den Nachbau).
    assert.match(folien({ ...daten, clip: null }).find((f) => f.id === 'J13').notiz, /Nachbau/);
  },
);

test('I-10: Messstand mit git describe; kein „Fork-main, Version 1.4.0 (8e9d1317)“', () => {
  const t = sichtbarAlle();
  assert.ok(!/Fork-main, Version 1\.4\.0/.test(t));
  assert.match(sichtbar(nach('J2').inhalt), /a19ca70f/);
  assert.match(sichtbar(nach('J2').inhalt), /v1\.4\.0-184/);
  assert.match(sichtbar(nach('J1').inhalt), /v1\.4\.0-14/);
});

test(
  'Minor: OOM-Vergleich, Speicherursache, Kaltaussage, Blitzlicht-Typen',
  { skip: OHNE_NOTIZEN },
  () => {
    const j11 = sichtbar(nach('J11').inhalt);
    assert.match(j11, /10 GiB/);
    assert.match(j11, /Laptop und PC/);
    assert.match(nach('J11').notiz, /vermutlich|nicht getrennt gemessen/);
    assert.ok(!/Alle drei Hypothesen sind erfüllt, auch kalt/.test(nach('J9').notiz));
    assert.match(sichtbar(nach('J12').inhalt), /geprüft: YESNO/);
    assert.match(sichtbar(nach('J7').inhalt), /keinem Lauf/);
  },
);

// ---------------------------------------------------------------- Fachliche Prüfung 3

test('R3-I1: Werte ab Werk mit Version; v1.3.0 und der Grund für den Messstand genannt', () => {
  const j2 = sichtbar(nach('J2').inhalt);
  assert.match(j2, /v1\.3\.0/);
  assert.match(j2, /Prüfer/);
  assert.match(j2, /CPUs und Threads/);
  assert.match(j2, /5 GiB/);
  for (const f of F) {
    const t = alles(f);
    assert.ok(
      !/Release-Timeout|\(Release:|Release ab Werk|wie im Release/.test(t),
      `${f.id}: „Release“ ohne Version`,
    );
  }
  // Werte ab Werk mit Version stehen seit 2026-11-18 nur noch in der Tabelle auf J2 (J4 ohne Kasten)
  assert.match(j2, /v1\.4\.0 ab Werk/);
  assert.match(nach('J11').inhalt, /ab Werk v1\.4\.0/);
});

test(
  'R3-I2: 19 von 20 mit Instruktion v2 und ohne Gate; nicht allein dem Gate zugeschrieben',
  { skip: OHNE_NOTIZEN },
  () => {
    for (const id of ['J13', 'J15', 'G9']) {
      const t = alles(nach(id));
      assert.match(t, /Instruktion/, id);
      assert.ok(!/bestand[^.]*vorher/.test(t), `${id}: „bestand … vorher“`);
      assert.ok(!/Vor dem Gate/.test(sichtbar(nach(id).inhalt)), `${id}: „Vor dem Gate“`);
    }
    assert.match(nach('J13').notiz, /zugleich|beides/);
  },
);

test('R3-I5: Kurzfassung enthält J13 und J15', () => {
  for (const id of ['J13', 'J15']) assert.equal(nach(id).kurzfassung, true, id);
});

test(
  'R3-Minor: geprüfte Antworten, App-Überschrift im Nachbau, Ausnahmen in G9, Risiken in J15',
  { skip: OHNE_NOTIZEN },
  () => {
    assert.match(nach('J13').titel, /geprüfte/);
    const html = readFileSync(
      resolve(
        ROOT,
        '../../apps/frontend/src/app/features/session/session-host/moderation-compass-dialog.component.html',
      ),
      'utf8',
    );
    assert.ok(html.includes(daten.nachbau.titel), 'Überschrift aus dem Template');
    assert.ok(decode(nach('J13').inhalt).includes(daten.nachbau.titel));
    assert.match(sichtbar(nach('G9').inhalt), /Ausnahmen/);
    assert.match(nach('J10').notiz, /langsame/);
  },
);

// ---------------------------------------------------------------- Fachliche Prüfung 4

test('R4-I1: Früherer OOM ohne Kausalaussage „weil mehr Tokens“ (ADR 1C-024: nicht getrennt gemessen)', () => {
  const kausal = /weil[^.]*mehr Tokens|\(mehr Tokens/;
  for (const f of F) assert.ok(!kausal.test(alles(f)), f.id);
  // Fragenkatalog liegt privat (privat/, eigenes Repo); fehlt er, entfällt diese Teilprüfung
  const katalogPfad = resolve(ROOT, 'privat/fragenkatalog.md');
  if (existsSync(katalogPfad)) {
    assert.ok(!kausal.test(readFileSync(katalogPfad, 'utf8')), 'Fragenkatalog');
  }
  assert.match(sichtbar(nach('J11').inhalt), /nicht getrennt gemessen/);
});

test(
  'R4-Minor: J4-Notiz ohne „Release“, Swap des Hosts unbekannt, Netz über beide Anfragen',
  { skip: OHNE_NOTIZEN },
  () => {
    assert.ok(!/als im Release/.test(nach('J4').notiz));
    assert.match(sichtbar(nach('J11').inhalt), /Swap des Hosts unbekannt/);
    assert.match(sichtbar(nach('J8').inhalt), /GET \/slots und POST/);
    assert.ok(!/Uhrendrift/.test(alles(nach('J8'))));
    assert.match(nach('J8b').notiz, /Streuung/);
  },
);

// ---------------------------------------------------------------- Fachliche Prüfung 5

test(
  'R5: Gate-Wechsel mit a998ada0, Validierung am Stand 248029dc, Nutzlastpfad, Aufteilung der 38',
  { skip: OHNE_NOTIZEN },
  () => {
    const j13 = nach('J13');
    assert.match(sichtbar(j13.inhalt), /a998ada0/);
    assert.match(sichtbar(j13.inhalt), /uncertain/);
    // Korrigiert 2026-11-16 (Codeprüfung): 12f1d8e4 änderte Instruktion und Gate, a998ada0 nur das Gate
    assert.match(
      j13.notiz,
      /Ein Upstream-Commit änderte Instruktion und Gate zugleich, ein zweiter/,
    );
    assert.match(sichtbar(j13.inhalt), /12f1d8e4\s+änderte Instruktion und Gate/);
    assert.match(nach('J6').notiz, /nur auf dem älteren Stand/);
    for (const id of ['J6', 'J7']) assert.match(nach(id).quelle, /labor\.quiet\.runs\[/, id);
    // J13 nennt die Nutzlast nur mit dem Nachbau (ohne Clip).
    const j13OhneClip = folien({ ...daten, clip: null }).find((f) => f.id === 'J13');
    assert.match(j13OhneClip.quelle, /labor\.quiet\.runs\[/);
    assert.match(
      sichtbar(nach('G9').inhalt),
      new RegExp(`1B ${daten.b1.verworfen}, 1C ${daten.c1.gateAntwortenGesamt.wert}`),
    );
    assert.equal(nach('J11').station, 'inferenz');
  },
);

test(
  'J13: Clip-Angaben stimmen mit dem App-Hinweis überein, die Notiz nennt den Grund des Clip-Laufs',
  { skip: OHNE_NOTIZEN },
  () => {
    assert.ok(daten.clip, 'medien/clip.json fehlt');
    assert.equal(
      daten.clip.hinweis.startsWith(daten.nachbau.hinweis.replace(/…$/, '').trim()),
      true,
    );
    const j13 = folien(daten).find((f) => f.id === 'J13');
    assert.equal(/Timeout/.test(j13.notiz), daten.clip.grund === 'timeout');
    assert.doesNotMatch(`${j13.notiz} ${j13.fuss}`, /power-saver|balanced|Energieprofil/);
    assert.doesNotMatch(j13.notiz, /Rechts ein Nachbau/);
    assert.doesNotMatch(`${j13.fuss} ${j13.quelle}`, /Nachbau/);
    assert.match(j13.quelle, /Hinweis qaSummaryExtractive\.ts/);
    assert.match(j13.quelle, /evidenz\/1B\/2026-11-15-clip\.md/);
    const ohne = folien({ ...daten, clip: null }).find((f) => f.id === 'J13');
    assert.match(ohne.notiz, /Rechts ein Nachbau/);
  },
);

// ZL S. 2–3 und Anhang B: Kurzbelege auf jeder Folie, vollständiges Literaturverzeichnis am Ende.
test('ZL: jede Folie von Jonas, Rahmen und Reserve trägt eine Quellenzeile mit Kurzbeleg', async () => {
  const { LITERATUR } = await import('./literatur.mjs');
  const kurz = LITERATUR.map((e) => e.kurz);
  for (const f of F.filter((x) => !/^J16b?$/.test(x.id))) {
    assert.match(f.fuss, /^Quelle: /, `${f.id}: Fußzeile ohne „Quelle:“`);
    assert.ok(
      kurz.some((k) => f.fuss.includes(k)),
      `${f.id}: kein Kurzbeleg aus dem Literaturverzeichnis in „${f.fuss}“`,
    );
  }
});

test('ZL: ein gemeinsames Verzeichnis auf J16 und J16b, alphabetisch fortlaufend, jeder Eintrag im Deck zitiert', async () => {
  const { LITERATUR } = await import('./literatur.mjs');
  const { niklasTeile } = await import('./teile.mjs');
  const { teil1, teil2 } = niklasTeile(ROOT);
  const alle = [...F, ...teil1, ...teil2];
  const [a, b] = ['J16', 'J16b'].map(nach);
  assert.ok(a && b, 'J16 und J16b');
  assert.deepEqual(
    [a.titel, b.titel],
    ['Literaturverzeichnis (1/2)', 'Literaturverzeichnis (2/2)'],
  );
  for (const f of [a, b]) assert.equal(f.gemeinsam, true, `${f.id} in beiden Druckauszügen`);
  assert.equal(
    F.filter((f) => f.teil === 'jonas').at(-1).id,
    'J16b',
    'J16b ist die letzte Folie von Jonas',
  );
  const norm = (h) => decode(h.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');
  // Reihenfolge der Einträge über beide Folien = LITERATUR (alphabetisch nach ZL)
  const eintraege = [a, b].flatMap((f) =>
    [...f.inhalt.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => norm(m[1])),
  );
  assert.deepEqual(
    eintraege,
    LITERATUR.map((e) => norm(e.voll)),
  );
  // jeder Kurzbeleg einer Fußzeile (Jonas, Rahmen, Niklas) hat genau einen Eintrag; jeder Eintrag wird zitiert
  const zitiert = new Set();
  for (const f of alle.filter((x) => !/^J16b?$/.test(x.id) && x.fuss?.startsWith('Quelle: '))) {
    for (const beleg of f.fuss.slice('Quelle: '.length).split('; ')) {
      const treffer = LITERATUR.filter((e) => beleg === e.kurz || beleg.startsWith(`${e.kurz}, `));
      assert.equal(treffer.length, 1, `${f.id}: „${beleg}“`);
      zitiert.add(treffer[0].schluessel);
    }
  }
  assert.deepEqual(
    LITERATUR.filter((e) => !zitiert.has(e.schluessel)).map((e) => e.schluessel),
    [],
    'unzitierte Einträge',
  );
});

// ---------------------------------------------------------------- Audit 2026-11-16

test('Fußzeile: eine Quellenzeile nur mit Kurzbelegen, ohne Commit und Rechner', () => {
  for (const f of F.filter((x) => !/^J16b?$/.test(x.id))) {
    assert.ok(
      !/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{8}\b/.test(f.fuss),
      `${f.id}: Commit in „${f.fuss}“`,
    );
    assert.ok(!/ThinkPad|i7-|· Laptop|· PC/.test(f.fuss), `${f.id}: Rechner in „${f.fuss}“`);
    assert.ok(!/Weirauch, 2026[abd]/.test(f.fuss), `${f.id}: alter Jahresbuchstabe`);
  }
  // J1 zeigt keine Commits mehr (Versionen nur als git describe, I-10)
  assert.ok(!/\b(a19ca70f|def56700)\b/.test(sichtbar(nach('J1').inhalt)));
});

test(
  'Defensive Formulierungen: Laptop-CPU, Nachlaufwert benannt, Konsistenzprüfung, Transport, Messunsicherheit',
  { skip: OHNE_NOTIZEN },
  () => {
    assert.match(sichtbar(nach('J1').inhalt), /Laptop/);
    assert.match(sichtbar(nach('J1').inhalt), /CPU/);
    // 223,7 s nur als Nachlaufwert benannt; die geringe Nebenlast bleibt im Protokoll (Entscheidung des Autors 2026-11-16)
    const nachlauf = fmt(daten.c1.inferenzS.wert, 1);
    for (const f of F) {
      const t = `${sichtbar(f.inhalt)} ${f.notiz ?? ''}`;
      for (const satz of t.split(/(?<=[.;])\s/)) {
        if (satz.includes(nachlauf))
          assert.match(satz, /Nachlauf|v1\.4\.0/, `${f.id}: ${nachlauf} ohne Nachlauf-Bezug`);
      }
      assert.doesNotMatch(t, /Nebenlast/, `${f.id}: Nebenlast gehört nicht auf Folie oder Notiz`);
    }
    assert.match(alles(nach('J11')), /zu kurz auf beiden Laborrechnern/);
    assert.match(sichtbar(nach('J11').inhalt), new RegExp(fmt(daten.c1.inferenzRuhigS.wert, 1)));
    assert.match(alles(nach('J11')), /nicht dem Cache zu(zu)?ordnen|nicht dem Cache zuordenbar/);
    assert.match(nach('J11').fuss, /Server-specific params/);
    assert.match(sichtbar(nach('J10b').inhalt), /gestoppt/);
    assert.match(alles(nach('J8b')), /nicht nachweisbar/);
    assert.match(sichtbar(nach('J4').inhalt), /Konsistenzprüfung/);
    assert.match(sichtbar(nach('J4').inhalt), /Orientiert an Papadopoulos/);
    assert.match(sichtbar(nach('J8').inhalt), /Messunsicherheit der Uhren/);
    assert.match(sichtbar(nach('J8').inhalt), /Server ohne Inferenz/);
    for (const f of F)
      assert.ok(!/Auflösung|schnellerer Hardware|nicht langsamer/.test(alles(f)), f.id);
    assert.match(nach('J9').notiz, new RegExp(`über ${daten.abgeleitet.anteilPcMin} Prozent`));
    // Qwen: Variante aus dem Manifest, nicht aus Yang et al.
    assert.match(sichtbar(nach('J2').inhalt), /Instruct-2507 Q4_K_M \(Manifest\)/);
    // Warme Spanne neben dem warmen Median (ein Lauf, keine unabhängigen Wiederholungen)
    const spanne = `${fmt(daten.b1.jobWarmSpanneS[0], 1)}–${fmt(daten.b1.jobWarmSpanneS[1], 1)} s`;
    for (const id of ['J1', 'J10a']) assert.ok(sichtbar(nach(id).inhalt).includes(spanne), id);
  },
);

test('J13 nennt die Gate-Ablation in einer Zeile', () => {
  const s = sichtbar(nach('J13').inhalt);
  assert.match(s, /Ablation/);
  assert.ok(s.includes(daten.c1.ablationNeuEnglisch.wert));
  assert.ok(s.includes(daten.c1.ablationAltMeta.wert));
  assert.match(s, /Formregeln/);
});

test('Titel als Aussage: J2, J3, J10, J15; J10 aus den Daten', () => {
  assert.equal(
    nach('J10').titel,
    `Das Netz ist ${fmt(daten.abgeleitet.feldNetzMm, 1)} mm auf ${fmt(daten.abgeleitet.feldM)} m`,
  );
  assert.match(nach('J3').titel, new RegExp(`${fmt(daten.auftrag.hostReturnMs)} ms`));
  assert.match(nach('J15').titel, /Entkopplung bleibt/);
  assert.match(nach('J2').titel, /Produktionscode unverändert/);
  // ohne die Fragezeile im Kopf (Kopfgrammatik)
  const j15 = sichtbar(nach('J15').inhalt.replace(/<p class="folie-frage">[\s\S]*?<\/p>/, ''));
  for (const w of ['Bleibt', 'Empfohlen, nicht umgesetzt', 'Offen', 'Zur Diskussion'])
    assert.match(j15, new RegExp(w));
  assert.equal((j15.match(/\?/g) ?? []).length, 2, 'eine Diskussionsfrage plus Übergabe');
});

test('J13b (bis 2026-11-16 R14): Einordnung Cloud Computing als Rechnung aus dem Code, Zeilen stimmen', () => {
  const r14 = nach('J13b');
  const s = sichtbar(r14.inhalt);
  assert.match(s, /Rechnung aus dem Code, keine Messung/);
  for (const w of [
    'Elastizität',
    'Ressourcenbündelung',
    'Netzzugang',
    'Bulkhead',
    'busy',
    'queue_full',
    'SLO',
  ])
    assert.match(s, new RegExp(w), w);
  const code = (datei) =>
    readFileSync(resolve(ROOT, `../../apps/backend/src/lib/${datei}`), 'utf8').split('\n');
  const client = code('openWeightLlmClient.ts');
  assert.match(client[140], /let inFlight = false/);
  assert.match(client[496], /if \(inFlight\) return \{ status: 'busy'/);
  const config = code('qaSummaryConfig.ts');
  assert.match(config[25], /QA_SUMMARY_QUEUE_LIMIT_DEFAULT = 8/);
  assert.match(config[28], /QA_SUMMARY_CONCURRENCY_DEFAULT = 1/);
  assert.match(code('qaSummaryQueue.ts')[509], /queue\.length \+ running >= config\.queueLimit/);
  // Kurzbeleg wie im Handout: Merkmale S. 2, IaaS S. 3 (Mell & Grance, 2011)
  assert.ok(r14.fuss.includes('Mell & Grance, 2011, S. 2–3'));
});

test(
  'GN: Nachweisumfang aus nachweisumfang.md, gleich der Neuberechnung, ohne Wertung',
  { skip: OHNE_NOTIZEN },
  async () => {
    const { berechneNachweisumfang, kopfzahlen } = await import('./nachweisumfang.mjs');
    const k = kopfzahlen(berechneNachweisumfang());
    assert.deepEqual(
      {
        laborzeit: daten.nachweis.laborzeit,
        tests: daten.nachweis.tests,
        adrs: daten.nachweis.adrs,
        hypothesen: daten.nachweis.hypothesen,
      },
      { laborzeit: k.laborzeitStunden, tests: k.tests, adrs: k.adrs, hypothesen: k.hypothesen },
    );
    const gd = sichtbar(nach('GN').inhalt);
    for (const [wert, was] of [
      [k.laborzeitStunden, 'gewertete Laborzeit'],
      [k.vorarbeitStunden, 'Aufbau, Tests, weitere Läufe'],
      [k.tests, 'automatisierte Tests'],
      [k.adrs, 'ADRs'],
      [k.hypothesen, 'vorab festgelegte Hypothesen'],
    ])
      assert.ok(gd.replace(/\s+/g, ' ').includes(`${wert} ${was}`), `GN: „${wert} ${was}“ fehlt`);
    assert.ok(gd.includes(`gewertete Läufe ${k.zeitraum}`));
    // Laborzeit je Auftrag: Dauer wie in nachweisumfang.md, Balkenlänge proportional, längster Balken voll
    const { laborzeit, dauer } = await import('./nachweisumfang.mjs');
    const je = laborzeit().je;
    const erwartet = {
      '1A': je['1A'],
      '1B Schritte 1–2': je['1B'],
      '1B Schritte 3–4': je['1B 3–4'],
      '1C': je['1C'],
    };
    assert.deepEqual(
      daten.nachweis.je.map((j) => j.dauer),
      Object.values(erwartet).map(dauer),
    );
    // je Auftrag zwei Balken: gewertet (voll) und Aufbau usw. (schraffiert), Länge proportional zur Summe
    const anteile = [...nach('GN').inhalt.matchAll(/\* ([\d.]+)\)"/g)].map((m) => Number(m[1]));
    const max = Math.max(...daten.nachweis.je.map((j) => j.min + j.vor.min));
    assert.deepEqual(
      anteile,
      daten.nachweis.je.flatMap((j) => [j.min, j.vor.min].map((x) => Number((x / max).toFixed(3)))),
    );
    const { vorarbeit } = await import('./nachweisumfang.mjs');
    const v = vorarbeit().je;
    assert.deepEqual(
      daten.nachweis.je.map((j) => j.vor.dauer),
      [v['1A'], v['1B'], v['1B 3–4'], v['1C']].map(dauer),
    );
    // sachlich: keine Commit-Zahlen je Person, keine Wertung
    assert.doesNotMatch(
      gd + nach('GN').notiz,
      /Commits|umfangreich|beeindruck|enorm|unverhältnis|aufwendig/,
    );
    assert.match(nach('GN').notiz, /vom 5\. bis 16\. November/);
  },
);

test('GN: Tests je Werkzeug und Hypothesen je Auftrag wie in nachweisumfang.md, gerafft, ohne Wertung', async () => {
  const { tabellenwerte } = await import('./nachweisumfang.mjs');
  const t = tabellenwerte();
  const r = sichtbar(nach('GN').inhalt).replace(/\s+/g, ' ');
  const wert = (name) => t[name].replace(/\*\*/g, '').replace(/ \(.+\)$/, '');
  for (const [name, kurz] of [
    ['1A Lastwerkzeuge'],
    ['Messwerkzeuge 1B/1C'],
    ['Pester 1B (Windows)'],
    ['Backend 1C'],
    ['1A (Experimentvertrag)', '1A Vertrag'],
    ['1B Schritte 1–2', '1B 1–2'],
    ['1B Schritte 3–4', '1B 3–4'],
    ['1C Einzeltests E', '1C E'],
    ['1C Messungen M', '1C M'],
    ['1C Labor L', '1C L'],
    ['1C Nachlauf N', '1C N'],
    ['1C Gate-Ablation H_A', '1C H_A'],
  ])
    assert.ok(r.includes(`${kurz ?? name} ${wert(name)}`), `GN: ${kurz ?? name} ${wert(name)}`);
  assert.ok(r.includes(`ADRs: ${t.ADRs.replace(/\*\*/g, '')}`));
  assert.match(r, /Rechnerzeit, keine Arbeitszeit/);
  assert.equal(nach('GN').titel, 'Nachweisumfang: Rechnerzeit, Tests, Hypothesen');
  assert.ok(!F.some((f) => f.id === 'R17'), 'R17 ist in GN aufgegangen');
});

test('GD: schlank, ohne Nachweisband, mit dem Satz zum gemeinsamen Fork vor dem Link', () => {
  const gd = nach('GD').inhalt;
  assert.doesNotMatch(gd, /data-nachweis/);
  const satz =
    'Gemeinsam entwickelt im Fork von Niklas Schneider; der Fork von Jonas Weirauch ist auf denselben Stand synchronisiert.';
  assert.ok(gd.includes(satz));
  assert.ok(gd.indexOf(satz) < gd.indexOf(`href="${REPO_URL}"`), 'Satz vor dem Link');
});
