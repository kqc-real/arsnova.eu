// Tests für das Handout (Task 9): PDF über Playwright, gelesen mit pdf-parse.
// Prüft die Formalia aus Prüfungsdokument Abschnitt 3 (höchstens 5 Seiten, 350–1.800 Wörter,
// Abbildungen nummeriert mit Quelle, Literaturliste, Name und Matrikelnummer aller Gruppenmitglieder,
// ad personam) und die Regel „jede Zahl aus den Daten, mit Rechner und Commit“.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { FESTWERTE, folien, ladeFolienDaten } from './folien.mjs';
import { baueHandout, rendereHandout } from './handout.mjs';
import { wegSvg, zeitzerlegungSvg } from './grafik.mjs';
import { fmt } from './zahlen.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HIER, '../..');
const requireRepo = createRequire(resolve(ROOT, '../../package.json'));

const PLATZHALTER = 'Name, Matrikelnummer: [lokal eintragen]';
/** Erfundene Testwerte; echte Matrikelnummern gehören nie ins Repo. */
const TEST_PERSONEN = [
  { name: 'Testname Jonas', matrikel: 'TEST-MATRIKEL-1' },
  { name: 'Testname Niklas', matrikel: 'TEST-MATRIKEL-2' },
];

const daten = ladeFolienDaten(ROOT);
let ordner;
const r = {};

async function pdfText(pfad) {
  const { PDFParse } = requireRepo('pdf-parse');
  const p = new PDFParse({ data: readFileSync(pfad) });
  try {
    const t = await p.getText();
    return { seiten: t.total, text: t.text };
  } finally {
    await p.destroy();
  }
}

before(async () => {
  ordner = mkdtempSync(join(tmpdir(), 'handout-'));
  for (const [name, personen] of [
    ['ohne', undefined],
    ['mit', TEST_PERSONEN],
  ]) {
    const html = baueHandout(daten, personen);
    const pdf = join(ordner, `${name}.pdf`);
    const layout = await rendereHandout(html, pdf);
    r[name] = { html, layout, ...(await pdfText(pdf)) };
  }
});

after(() => rmSync(ordner, { recursive: true, force: true }));

const woerter = (text) =>
  text
    .replace(/-- \d+ of \d+ --/g, ' ') // Seitentrenner von pdf-parse
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

test('höchstens 5 A4-Seiten, ohne Überlauf auf einer Seite', () => {
  for (const name of ['ohne', 'mit']) {
    const { seiten, layout } = r[name];
    assert.ok(seiten >= 1 && seiten <= 5, `${name}: ${seiten} Seiten`);
    assert.equal(layout.seiten, seiten, `${name}: Seitenabschnitte = PDF-Seiten`);
    assert.deepEqual(layout.ueberlauf, [], `${name}: Inhalt läuft über`);
    assert.deepEqual(layout.zuBreit, [], `${name}: Inhalt breiter als die Seite`);
  }
});

test('Schriften geladen, keine stille Ersatzschrift', () => {
  const g = r.ohne.layout.schriften;
  for (const s of ['Inter 400', 'Inter 700', 'IBM Plex Mono 400']) assert.ok(g.includes(s), s);
});

test('350–1.800 Wörter (Prüfungsdokument), Wachstumsschutz höchstens 1.790, Namen ändern wenig', () => {
  for (const name of ['ohne', 'mit']) {
    const n = woerter(r[name].text);
    assert.ok(n >= 350 && n <= 1800, `${name}: ${n} Wörter`);
    assert.ok(n <= 1790, `${name}: ${n} Wörter, Puffer für echte Namen aufgebraucht`);
  }
  // Platzhalter gegen zweiteilige Namen: höchstens wenige Wörter Unterschied, mindestens 8 Wörter Luft bis 1.800
  const diff = woerter(r.mit.text) - woerter(r.ohne.text);
  assert.ok(Math.abs(diff) <= 4, `Unterschied ${diff}`);
  assert.ok(woerter(r.mit.text) <= 1792, `mit Namen ${woerter(r.mit.text)}`);
});

test('Titel = Titel von Folie J1 (Wartezeit am Client, gerundet), getrennt vom warmen Median', () => {
  const j1 = folien(daten).find((f) => f.id === 'J1');
  const folienZahl = j1.titel.match(/\d+(?:,\d+)?/)[0];
  const h1 = r.ohne.html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '');
  assert.equal(h1, j1.titel);
  assert.equal(folienZahl, fmt(Math.round(daten.auftrag.clientWaitMs / 1000)));
  // Der Text nennt den Auftrag mit Nummer und den warmen Median mit n getrennt.
  const text = r.ohne.html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, '');
  assert.match(
    text,
    new RegExp(`Auftrag ${daten.auftrag.nr}\\b[^.]*${fmt(daten.auftrag.jobMs / 1000, 1)} s`),
  );
  assert.ok(!text.includes(`${folienZahl} s (warm`), 'Auftragszeit als warmer Median ausgegeben');
});

test('ad personam: jede Abschnittsüberschrift nennt Jonas, 1C und 1B haben eigene Abschnitte', () => {
  const h2 = [...r.ohne.html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ''),
  );
  assert.ok(h2.length >= 4, `nur ${h2.length} Abschnitte`);
  for (const h of h2) assert.match(h, /Jonas/, `ohne Jonas: ${h}`);
  assert.ok(
    h2.some((h) => /1C/.test(h) && !/1B/.test(h)),
    'Abschnitt nur für 1C',
  );
  assert.ok(
    h2.some((h) => /1B/.test(h) && !/1C/.test(h)),
    'Abschnitt nur für 1B',
  );
  // Im PDF stehen die Überschriften als Text (keine Grafik).
  const pdf = r.ohne.text.replace(/\s+/g, ' ');
  for (const h of h2) assert.ok(pdf.includes(h.replace(/\s+/g, ' ').trim()), `nicht im PDF: ${h}`);
});

test('Abbildungen durchnummeriert, jede mit Quelle, Rechner und Commit', () => {
  const pdf = r.ohne.text.replace(/\s+/g, ' ');
  assert.match(pdf, /Abb\. 1:/);
  const caps = [...r.ohne.html.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ''),
  );
  assert.ok(caps.length >= 2, `${caps.length} Abbildungen`);
  caps.forEach((c, i) => {
    assert.match(c, new RegExp(`^\\s*Abb\\. ${i + 1}:`), `Nummer ${i + 1}: ${c}`);
    assert.match(c, /Quelle/, `Abb. ${i + 1} ohne Quelle`);
    assert.match(c, /\b[0-9a-f]{8}\b/, `Abb. ${i + 1} ohne Commit`);
    assert.match(c, /ThinkPad P50|i7-8700|PC/, `Abb. ${i + 1} ohne Rechner`);
  });
  for (let i = 1; i <= caps.length; i++) assert.ok(pdf.includes(`Abb. ${i}:`), `Abb. ${i} im PDF`);
});

test('Tabellen mit Zahlen tragen eine Quellenzeile mit Rechner und Commit', () => {
  const tabs = [
    ...r.ohne.html.matchAll(/<table\b[\s\S]*?<\/table>\s*(<p class="quelle"[\s\S]*?<\/p>)?/g),
  ];
  assert.ok(tabs.length >= 2);
  for (const [roh, q] of tabs) {
    if (!/<td[^>]*class="[^"]*\bw\b/.test(roh) && !/class="w"/.test(roh)) continue; // ohne Messwerte
    assert.ok(q, `Tabelle ohne Quellenzeile: ${roh.slice(0, 120)}`);
    assert.match(q, /\b[0-9a-f]{8}\b/, 'Commit');
    assert.match(q, /ThinkPad P50|i7-8700|PC/, 'Rechner');
  }
});

test('Literaturliste vorhanden; jeder Verweis [n] im Text hat einen Eintrag', () => {
  const pdf = r.ohne.text;
  assert.match(pdf, /Literatur/);
  const eintraege = [...r.ohne.html.matchAll(/<li id="q(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(eintraege.length >= 6, `${eintraege.length} Einträge`);
  const text = r.ohne.html.replace(/<ol class="literatur"[\s\S]*?<\/ol>/, '');
  const zitiert = new Set(
    [...text.matchAll(/\[(\d+(?:\s*[,–]\s*\d+)*)\]/g)].flatMap((m) =>
      m[1].split(/\s*,\s*/).flatMap((t) => {
        const [a, b] = t.split(/\s*–\s*/).map(Number);
        return b ? Array.from({ length: b - a + 1 }, (_, k) => a + k) : [a];
      }),
    ),
  );
  for (const z of zitiert) assert.ok(eintraege.includes(z), `[${z}] ohne Eintrag`);
  for (const e of eintraege) assert.ok(zitiert.has(e), `Eintrag [${e}] nie zitiert`);
  for (const pflicht of [
    'ADR-0035',
    'OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK',
    'llama.cpp',
    'timings',
    'CLOUD-COMPUTING-REFERAT-PRUEFUNG',
    'Dossier',
    'docs/referat-thema-1/',
    'llama.cpp/blob/b10524/',
    'abgerufen am 15.11.2026',
  ])
    assert.ok(r.ohne.html.includes(pflicht), `Literatur: ${pflicht}`);
  assert.ok(!r.ohne.html.includes('/blob/master/'), 'Link auf master statt auf den Tag');
  // Autor bzw. Herausgeber und Jahr in jedem Eintrag
  for (const [, e] of r.ohne.html.matchAll(/<li id="q\d+">([\s\S]*?)<\/li>/g)) {
    assert.match(e.replace(/<[^>]+>/g, ''), /^[^:]+\((?:\d{4}|o\. J\.)\):/, e.slice(0, 60));
  }
});

// ------------------------------------------------------------------ Fachliche Prüfung 1

const textOhneSvg = () =>
  r.ohne.html
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ');

test('K1/W2: Hinweis statt „ohne Hinweis“; Gate prüft mehr als die Form', () => {
  const t = textOhneSvg();
  assert.ok(!/ohne (jeden )?Hinweis/.test(t));
  assert.match(t, /Eine ausführliche Zusammenfassung war diesmal nicht möglich/);
  assert.ok(!/prüft nur die Form/.test(t));
  assert.match(t, /Sprache und Thema prüft es nicht/);
});

test('K2/I-10: Untertitel und Kurzantwort nennen den Messstand nach v1.4.0 und den Stand vor dem Gate', () => {
  const unter = r.ohne.html.match(/<p class="unter">([\s\S]*?)<\/p>/)[1];
  assert.match(unter, /Release 1\.3/);
  assert.match(unter, /nach v1\.4\.0/);
  assert.ok(!/gemessen auf Version 1\.4\.0/.test(unter));
  const kurz = r.ohne.html
    .match(/<div class="kasten">([\s\S]*?)<\/div>/)[1]
    .replace(/<[^>]+>/g, '');
  assert.match(kurz, /1\.4\.0/);
  assert.match(kurz, /19 von 20/);
});

test('W4/W5/W9–W12: Abweichungen je Auftrag, Aufgabenabdeckung, Rollen, Kostenfolgen', () => {
  const t = textOhneSvg();
  assert.equal((r.ohne.html.match(/class="grenzen/g) ?? []).length, 2, 'zwei Blöcke');
  for (const re of [
    /Timeout 300 s statt 90 s ab Werk v1\.4\.0, nach Kalibrierung/,
    /4 statt 8 CPUs/,
    /ohne Wrapper/,
    /von Hand abgeschaltet/,
    /Loopback/,
    /5 GiB/,
    /Aufgabenabdeckung 1C/,
    /assertHostSessionAccessFromContext/,
    /CONFLICT/,
    /T2\.3/,
    /E15/,
    /Encoder/,
    /App-Adapter/,
    /--n-predict/,
    /Kosten, Risiko, Betrieb/,
    /wechselnden Prompts/,
    /identischer Snapshot/,
  ])
    assert.match(t, re, String(re));
});

test('KI-Offenlegung: Werkzeug, Modell, Rolle des Autors', () => {
  const pdf = r.ohne.text.replace(/\s+/g, ' ');
  assert.match(pdf, /KI-Offenlegung/);
  assert.match(pdf, /Claude Code/);
  assert.match(pdf, /Opus/);
  assert.match(pdf, /keine menschlichen Gutachten/);
});

test('ohne personen: Platzhalter für beide Gruppenmitglieder, keine Matrikel-ähnliche Ziffernfolge', () => {
  const pdf = r.ohne.text.replace(/\s+/g, ' ');
  assert.equal(pdf.split(PLATZHALTER).length - 1, 2, 'zweimal der Platzhalter');
  assert.match(pdf, /Jonas/);
  assert.match(pdf, /Niklas/);
  // DOIs im Literaturverzeichnis enthalten lange Ziffernfolgen; die zählen nicht.
  const ohneLit = r.ohne.html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<ol class="literatur"[\s\S]*?<\/ol>/, '');
  assert.ok(!/\b\d{6,9}\b/.test(ohneLit), 'Ziffernfolge');
});

test('mit personen: Namen und Matrikelnummern stehen im PDF, kein Platzhalter', () => {
  const pdf = r.mit.text.replace(/\s+/g, ' ');
  for (const p of TEST_PERSONEN) {
    assert.ok(pdf.includes(p.name), p.name);
    assert.ok(pdf.includes(p.matrikel), p.matrikel);
  }
  assert.ok(!pdf.includes('[lokal eintragen]'));
  assert.throws(() => baueHandout(daten, [{ name: 'nur einer', matrikel: 'X' }]));
});

test('Personenangaben werden escaped', () => {
  const html = baueHandout(daten, [
    { name: '<b>A</b>', matrikel: '1&2' },
    { name: 'B', matrikel: 'C' },
  ]);
  assert.ok(html.includes('&lt;b&gt;A&lt;/b&gt;'));
  assert.ok(html.includes('1&amp;2'));
});

// ------------------------------------------------------------------ Zahlen nur aus den Daten

/** Kennungen, die Ziffern enthalten, aber keine Messwerte sind (wie in folien.test.mjs). */
const KENNUNGEN = [
  /\bv1\.[34]\.0-\d+\b/g, // git describe
  /\b1[BC]-\d{3}\b/g,
  /\bADR-\d{4}\b/g,
  /#\d+/g,
  /\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{8,}\b/g,
  /\b(?:Release |Version |v)?1\.[34](?:\.0)?\b/g,
  /§\s?\d+/g, // Abschnitte des Runbooks
  /\bThema 1\b/g,
  /\bSchritte? \d(?:–\d)?\b/g,
  /\b[1][ABC]\b/g,
  /\bH_[A-Z]+\d\b/g,
  /\b[EMNLTUJRG]\d{1,2}(?:\.\d)?[ab]?\b/g,
  /\bt\s?[0-3]\b/g,
  /Qwen3-4B/g,
  /\bQ4_K_M\b/g,
  /\bUTF-8\b/g,
  /\bOpus \d\.\d\b/g,
  /\bi7-\d{4}\w*\b/g,
  /\bAbb\. \d\b/g,
  /\bTab\. \d\b/g,
  /\[\d+(?:\s*[,–]\s*\d+)*\]/g, // Literaturverweise
  /^\s*\d\s/gm, // Abschnittsnummern
  /\b\d\s(?=[A-ZÄÖÜ][a-zäöü])/g, // Abschnittsnummer vor dem Titel
  /\bA4\b/g,
  /[\w./-]*\b\d{4}-\d{2}-\d{2}[\w.-]*/g, // datierte Dateinamen in Quellenangaben
  /\bruns\[\d+\]/g, // Index des Messlaufs in der Quelle
  /\bP50\b/g,
  /\b(?:Abschnitte?|Prüfungsdokument) \d(?:\.\d)?\b/g,
];

function whitelist() {
  const w = new Set();
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
  blaetter(daten.b1);
  ziffern(daten.b1.rechner);
  for (const e of Object.values(daten.c1)) {
    if (typeof e.wert === 'number') zahl(e.wert);
    else ziffern(e.wert);
  }
  blaetter({ a: daten.antwort.auftrag, b: daten.antwort.aussagen, c: daten.antwort.mitTrenner });
  ziffern(daten.antwort.grund);
  blaetter(Object.values(daten.auftrag).filter((v) => typeof v === 'number'));
  blaetter(daten.abgeleitet);
  w.add(fmt(Math.round(daten.auftrag.jobMs / 1000)));
  for (const f of Object.values(FESTWERTE)) zahl(f.wert);
  return w;
}

test('Keine Zahl im Fließtext, die nicht aus den Daten stammt', () => {
  const w = whitelist();
  let s = r.ohne.html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ') // Grafiken prüft grafik.test.mjs
    .replace(/<ol class="literatur"[\s\S]*?<\/ol>/g, ' ')
    .replace(/<(\w+)\b[^>]*data-frei[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ');
  for (const re of KENNUNGEN) s = s.replace(re, ' ');
  for (const t of s.match(/\d+(?:[.,]\d+)*/g) ?? []) {
    assert.ok(w.has(t), `„${t}“ stammt nicht aus den Daten`);
  }
});

test('Gruppen: warmer Median trägt „warm“ und n = 9 im selben Satz', () => {
  const warm = fmt(daten.b1.jobWarmMs / 1000, 1);
  const text = r.ohne.html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, '');
  const saetze = text.split(/(?<=[.;:])\s+/).filter((t) => t.includes(`${warm} s`));
  assert.ok(saetze.length >= 1);
  for (const satz of saetze) {
    assert.match(satz, /warm/, satz);
    assert.match(satz, new RegExp(`n = ${daten.b1.nWarm}`), satz);
  }
});

test('Empfehlungen erscheinen nie als umgesetzt (ADR 1C-004)', () => {
  const text = r.ohne.html.replace(/<[^>]+>/g, ' ');
  assert.match(text, /nicht umgesetzt/);
  assert.ok(
    !/(?<!nicht )umgesetzt(?! wird)\b(?!,? nicht)/.test(text.replace(/nicht umgesetzt/g, '')),
  );
});

test('Grafiken stehen unverändert im Handout (keine Nachbearbeitung im SVG)', () => {
  const { b1, c1 } = daten;
  assert.ok(
    r.ohne.html.includes(wegSvg({ aktiv: null, b1, c1, auftrag: daten.auftrag })),
    'Abb. 1',
  );
  assert.ok(r.ohne.html.includes(zeitzerlegungSvg(b1)), 'Zeitzerlegung');
});

// ------------------------------------------------------------------ Fachliche Prüfung 2

test('I-01: Kurzantwort nennt Netz und Transport in ms vor dem Anteil, mit Hardware-Hinweis', () => {
  const kurz = r.ohne.html
    .match(/<div class="kasten">([\s\S]*?)<\/div>/)[1]
    .replace(/<[^>]+>/g, '');
  const ms = kurz.indexOf(`${fmt(daten.b1.netzMs, 2)} ms`);
  const prozent = kurz.indexOf(`${fmt(daten.b1.inferAnteil * 100, 2)} %`);
  assert.ok(ms >= 0 && prozent > ms, kurz);
  assert.match(kurz, /schnellerer Hardware/);
  assert.match(kurz, new RegExp(`${fmt(daten.b1.transportMs, 1)} ms`));
});

test('I-02 bis I-10 im Handout', () => {
  const t = textOhneSvg();
  assert.match(t, /Override/); // I-02
  assert.ok(!/Runbook §6 bricht ihn\)/.test(t));
  assert.ok(!/verwirft (das Gate )?jede (Modell)?[Aa]ntwort/.test(t)); // I-03
  assert.match(t, new RegExp(`${daten.abgeleitet.gateBeobachtet} geprüfte`));
  assert.ok(!/vor jeder Messung/.test(t)); // I-04
  assert.match(t, /M7b/);
  assert.match(t, /ohne vorherige Freigabe/);
  assert.match(t, /1B-Leitfrage/);
  assert.match(t, /Voting/); // I-05
  assert.ok(!/0,97/.test(t)); // Runde 3, I4: keine Modellvorhersage als Befund
  assert.ok(!/kein neues Risiko/.test(t));
  assert.ok(!/Sennrich/.test(r.ohne.html)); // I-08
  assert.ok(!/mehrere Bytes/.test(t));
  assert.match(t, /3,15 Byte je Token/);
  assert.match(t, /feature-praesentation-jonas/); // I-09
  assert.match(t, new RegExp(daten.antwortCommit));
  assert.match(t, /a19ca70f/); // I-10
  assert.match(t, /v1\.4\.0-184/);
  assert.ok(!/Stand Version 1\.4\.0/.test(t));
});

test('Runde 3: v1.3.0-Werte und Grund, Instruktion und Gate zugleich, Template-Grenze', () => {
  const t = textOhneSvg();
  assert.match(t, /v1\.3\.0/);
  assert.match(t, /Prüfer/);
  assert.match(t, /Instruktion/);
  assert.match(t, /nicht getrennt gemessen/);
  assert.match(t, /budgetierten Teil/);
  assert.ok(!/Release-Timeout|Release ab Werk/.test(t));
  assert.ok(!/Vor dem Gate|vor dem Gate \(/.test(t));
});

test('Runde 4: Gegenprüfung und Gegenalternative je Auftrag, OOM ohne Kausalaussage, Gate-Regel genau', () => {
  const t = textOhneSvg();
  assert.match(t, /V1/);
  assert.match(t, /10 von 10 Änderungsläufen/);
  assert.match(t, /C0/);
  assert.match(t, /B0/);
  assert.match(t, /Gegenalternative/);
  assert.ok(!/\(mehr Tokens\)|weil[^.]*mehr Tokens/.test(t));
  assert.match(t, /jede in der Form/);
  assert.match(t, /Swap des Hosts unbekannt/);
});

test('Runde 5: Validierung am Stand 248029dc benannt', () => {
  assert.match(textOhneSvg(), /Test-Runtime, 248029dc/);
});
