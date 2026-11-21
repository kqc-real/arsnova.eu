// Folieninhalte von Jonas (1C und 1B Schritte 1–2), Reserve und gemeinsamer Rahmen.
// Jede Folie folgt dem Muster Frage → Mechanismus → Zahl → Beleg. Zahlen kommen aus dem Datenmodul
// (zahlen.mjs), aus den committeten Ergebnisdateien (über ladeFolienDaten) oder aus FESTWERTE
// (vorab festgelegte Schwellen und Konfigurationswerte, je mit wörtlichem Beleg; der Test prüft ihn).
//
// Fläche: inhalt füllt die Diagrammfläche der Folie (1380 × 560 px, .folie-flaeche in stil.css).
// Titel, Fußzeile mit Seitenzahl und quelle sowie der wandernde Marker (station) setzt der Bau.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

import qrcode from 'qrcode-generator';

import {
  abstimmungSvg,
  fussballMasse,
  fussballfeldSvg,
  gateRasterSvg,
  systemSvg,
  wegSvg,
  zeitzerlegungSvg,
} from './grafik.mjs';
import { LITERATUR, kurzbeleg, quellenzeile } from './literatur.mjs';
import { fmt, ladeZahlen } from './zahlen.mjs';
import { privat } from './notizen.mjs';

/**
 * Teile des gemeinsamen Vortrags in Reihenfolge (Design 2026-11-15 §3: Niklas eröffnet mit 1A, Jonas erzählt
 * 1C und 1B 1–2 am Stück, Niklas schließt mit 1B 3–4): Fahrplan auf G0 und Teilleiste oben rechts auf jeder
 * Hauptfolie (deck.mjs). etiketten: [Auftrag, Zusatz]; farben: Akzentlinie im Fahrplan (1A Blau, 1C Petrol,
 * 1B Bernstein, Fazit neutral).
 */
export const TEILE = [
  {
    id: '1a',
    kurz: '1A',
    wer: 'Niklas',
    etiketten: [['1A']],
    farben: ['var(--blau)'],
    was: 'App-Host: Reserve neben der Live-Last',
  },
  {
    id: 'jonas',
    kurz: '1C, 1B 1–2',
    wer: 'Jonas',
    etiketten: [['1C'], ['1B', '1–2']],
    farben: ['var(--petrol)', 'var(--bernstein)'],
    was: 'Ein Auftrag über zwei Hosts: Kontextpfad und Zeit',
  },
  {
    id: '1b34',
    kurz: '1B 3–4',
    wer: 'Niklas',
    etiketten: [['1B', '3–4']],
    farben: ['var(--bernstein)'],
    was: 'Zweiter Host gestört: Ersatz und Aufwand',
  },
  {
    id: 'fazit',
    kurz: 'Fazit',
    wer: 'Gemeinsam',
    etiketten: [['1A'], ['1B'], ['1C']],
    farben: ['var(--text-2)'],
    was: 'Fazit: Antwort auf die Leitfrage',
  },
];

/** Angaben der Titelfolie: Modul laut Prüfungsdokument (DSCC0127); Prüfer und Termin nach Angabe der Gruppe (2026-11-16). */
export const TITEL = {
  kurs: 'Cloud Computing',
  modul: 'DSCC0127',
  hochschule: 'IU Internationale Hochschule',
  pruefer: 'Prof. Dr. Klaus Quibeldey-Cirkel',
  datum: '24.11.2026',
};

/**
 * Vermerk im Platz für die Matrikelnummer (Titelfolie, data-matrikel="<Name>"). Die Nummern stehen nie im
 * Repo; abgabe-lokal.mjs ersetzt den Vermerk in einer ignorierten Kopie des Decks.
 */
export const MATRIKEL_VERMERK = 'Matrikelnummer in der Abgabefassung';

/** Rahmenfolien ohne Teilleiste: Titel, Fahrplan, Systembild, Dank. */
export const RAHMEN_OHNE_LEISTE = ['GT', 'G0', 'GK', 'GD'];

/** Teil einer Folie für die Teilleiste; null für Titel, Fahrplan, Dank, Anhang und Reserve. */
export function teilVon(f) {
  if (f.teil === 'reserve' || f.anhang || RAHMEN_OHNE_LEISTE.includes(f.id)) return null;
  if (f.id === 'G9' || f.id === 'GN') return 'fazit';
  if (f.teil === 'jonas') return 'jonas';
  if (f.teil === 'niklas') return f.auftrag === '1A' ? '1a' : '1b34';
  return null;
}

/** Vorab festgelegte Schwellen und Konfigurationswerte; quelle relativ zu docs/referat-thema-1/. */
export const FESTWERTE = {
  releaseTimeoutS: {
    wert: 90,
    text: 'Timeout der Q&A-Zusammenfassung ab Werk, s',
    quelle: 'adr/1C-023-release-timeout-90-s-zu-kurz.md',
    beleg: 'ab Werk ein Timeout von 90 s',
  },
  laborTimeoutS: {
    wert: 300,
    text: 'Timeout im Labor (Obergrenze des Produkts), s',
    quelle: 'adr/1C-020-timeout-300-s-und-kalibrierungsregel.md',
    beleg: 'Timeout 300 s im Laptop-Lauf',
  },
  schwelleNetzMs: {
    wert: 50,
    text: 'H_B1: Netz je Auftrag im Median höchstens, ms',
    quelle: 'adr/1B-008-kernaussagen-und-schwellen.md',
    beleg: 'im Median ≤ 50 ms, Maximum ≤ 200 ms',
  },
  schwelleAdapterS: {
    wert: 2,
    text: 'H_B2: Adapter je Auftrag im Median höchstens, s',
    quelle: 'adr/1B-008-kernaussagen-und-schwellen.md',
    beleg: 'Adapterzeit je Auftrag im Median ≤ 2 s',
  },
  schwelleInferenzProzent: {
    wert: 95,
    text: 'H_B3: Inferenzanteil im Median mindestens, %',
    quelle: 'adr/1B-008-kernaussagen-und-schwellen.md',
    beleg: 'Inferenz ≥ 95 % der Job-Dauer im Median',
  },
  schwelleNachpruefungProzent: {
    wert: 5,
    text: 'Regel 1C-010: Anteil der Nachprüfung unter, %',
    quelle: 'adr/1C-010-nachpruefung-nach-inferenz-beibehalten.md',
    beleg: 'Beide Obergrenzen < 5 %',
  },
  schwelleC0Ms: {
    wert: 5,
    text: 'H_C0: Differenz der Mediane höchstens, ms',
    quelle: 'evidenz/1B/2026-11-13-lauf.md',
    beleg: 'H_C0: Differenz ≤ 5 ms',
  },
  schwelleB0S: {
    wert: 2,
    text: 'H_B0: T_job im Median höchstens, s',
    quelle: 'evidenz/1B/2026-11-13-lauf.md',
    beleg: 'H_B0: alle `unavailable`, Median ≤ 2 s',
  },
  releaseCpus: {
    wert: 8,
    text: 'CPUs und Threads der Runtime ab Werk (v1.4.0, gleich im gemessenen Stand a19ca70f)',
    quelle: 'adr/1B-005-abweichungen-vom-release.md',
    beleg: 'Runtime mit 4 statt 8 CPUs und Threads per Override',
  },
  laborCpus: {
    wert: 4,
    text: 'CPUs und Threads der Runtime im Labor',
    quelle: 'adr/1B-005-abweichungen-vom-release.md',
    beleg: 'Runtime mit 4 statt 8 CPUs und Threads per Override',
  },
  // Release 1.3 selbst (Tag v1.3.0), gelesen mit git show; gemessen wurde ein späterer Stand (ADR 1C-001, 1B-001)
  v13Cpus: {
    wert: 4,
    text: 'CPUs der Runtime am Tag v1.3.0',
    quelle: 'git:v1.3.0:docker-compose.llm.yml',
    beleg: "cpus: '4.0'",
  },
  v13SpeicherGiB: {
    wert: 5,
    text: 'Speicherlimit der Runtime am Tag v1.3.0, GiB (ohne memswap_limit)',
    quelle: 'git:v1.3.0:docker-compose.llm.yml',
    beleg: 'mem_limit: 5g',
  },
  v13TimeoutS: {
    wert: 8,
    text: 'Default QA_SUMMARY_TIMEOUT_MS am Tag v1.3.0, s',
    quelle: 'git:v1.3.0:apps/backend/src/lib/qaSummaryConfig.ts',
    beleg: 'QA_SUMMARY_TIMEOUT_DEFAULT_MS = 8_000',
  },
  // Ergänzt nach der fachlichen Prüfung 1 (Offenlegung, Kalibrierung, Abdeckung)
  schwelleNetzMaxMs: {
    wert: 200,
    text: 'H_B1: Netz je Auftrag höchstens (Maximum), ms',
    quelle: 'adr/1B-008-kernaussagen-und-schwellen.md',
    beleg: 'im Median ≤ 50 ms, Maximum ≤ 200 ms',
  },
  laborSpeicher1BGiB: {
    wert: 8,
    text: '1B-Labor: Speicherlimit der Runtime wie ab Werk v1.4.0, GiB (gewerteter Lauf)',
    quelle: 'evidenz/1B/2026-11-13-lauf.md',
    beleg: 'Runtime-Container mit Release-Limits (8 GiB, 4 CPUs)',
  },
  laborTimeout1BS: {
    wert: 300,
    text: '1B: Timeout nach der Kalibrierungsregel (75 s < I ≤ 270 s), s',
    quelle: 'adr/1B-005-abweichungen-vom-release.md',
    beleg: '75 s < I ≤ 270 s | 300 000 ms (Code-Grenze)',
  },
  kalibrierung1BS: {
    wert: 202,
    text: '1B: Kalibrierung I vor dem gewerteten Lauf, s (202 162 ms)',
    quelle: 'evidenz/1B/2026-11-13-lauf.md',
    beleg: 'I = 202162 ms (`prompt_ms` 81874, `predicted_ms` 120289',
  },
  kalibrierungLaptopS: {
    wert: 196,
    text: '1C: Kalibrierungsanfrage am Laptop (2026-11-04), Wandzeit in s',
    quelle: 'adr/1C-020-timeout-300-s-und-kalibrierungsregel.md',
    beleg: 'HTTP 200 in 196 s Wandzeit',
  },
  kalibrierungLaptopPrefillS: {
    wert: 95,
    text: '1C: Prefill der Laptop-Kalibrierung, s',
    quelle: 'adr/1C-020-timeout-300-s-und-kalibrierungsregel.md',
    beleg: 'Prefill: 2166 Tokens in 95 s',
  },
  kalibrierungLaptopAusgabeS: {
    wert: 101,
    text: '1C: Ausgabe der Laptop-Kalibrierung, s',
    quelle: 'adr/1C-020-timeout-300-s-und-kalibrierungsregel.md',
    beleg: 'Ausgabe: 354 Tokens in 101 s',
  },
  laborCpus1C: {
    wert: 4,
    text: '1C-Nachlauf: CPUs der Runtime (Laborpfad llm-http)',
    quelle: 'evidenz/1C/2026-11-09-labor-nachlauf.md',
    beleg: '`127.0.0.1:8080`, 4 CPUs, 5 GiB, 4 Threads',
  },
  laborSpeicher1CGiB: {
    wert: 5,
    text: '1C-Nachlauf: Speicherlimit der Runtime, GiB (Swap gleich dem Limit)',
    quelle: 'evidenz/1C/2026-11-09-labor-nachlauf.md',
    beleg: '`127.0.0.1:8080`, 4 CPUs, 5 GiB, 4 Threads',
  },
  prodSpeicherGiB: {
    wert: 8,
    text: 'Produktionslimit der Runtime (Inferenz-Host), GiB',
    quelle: 'adr/1C-021-zusatzlauf-produktionslimits-zweiter-rechner.md',
    beleg: '(8 CPUs, 8 GiB, 10 GiB mit Swap, 8 Threads)',
  },
  grenzeGesamtGiB: {
    wert: 10,
    text: 'Speicher plus Swap der Runtime, Produktion (8 + 2) und Labor (5 + 5), GiB',
    quelle: 'adr/1C-021-zusatzlauf-produktionslimits-zweiter-rechner.md',
    beleg: '(8 CPUs, 8 GiB, 10 GiB mit Swap, 8 Threads)',
  },
  prodSwapGiB: {
    wert: 2,
    text: 'Swap über dem Produktionslimit, GiB',
    quelle: 'adr/1C-024-prompt-cache-ram-begrenzen.md',
    beleg: 'Auch mit 8 GiB plus 2 GiB Swap kam der Kill',
  },
  netzAufloesungMs: {
    wert: 1,
    text: 'Messunsicherheit der Netzmessung (zwei VM-Uhren), ms',
    quelle: 'adr/1B-011-zeitbegriffe-und-leitfrage.md',
    beleg: 'zwei Uhren, Auflösung ≈ ± 1 ms',
  },
  nPredictRelease: {
    wert: 768,
    text: '--n-predict im ausgelieferten entrypoint.sh',
    quelle: 'evidenz/1B/2026-11-13-lauf.md',
    beleg:
      'ADR-0035 Z. 184 nennt für `--n-predict` „Richtung 256“, der ausgelieferte `entrypoint.sh` Z. 40 setzt 768',
  },
  nPredictAdr: {
    wert: 256,
    text: '--n-predict laut ADR-0035',
    quelle: 'evidenz/1B/2026-11-13-lauf.md',
    beleg: 'ADR-0035 Z. 184 nennt für `--n-predict` „Richtung 256“',
  },
  antwortTokensMin: {
    wert: 506,
    text: 'Antwortlänge im 1B-Lauf, kleinster Wert (Tokens)',
    quelle: 'evidenz/1B/2026-11-13-lauf.md',
    beleg: 'Die Antworten hatten 506–613 Tokens',
  },
  antwortTokensMax: {
    wert: 613,
    text: 'Antwortlänge im 1B-Lauf, größter Wert (Tokens)',
    quelle: 'evidenz/1B/2026-11-13-lauf.md',
    beleg: 'Die Antworten hatten 506–613 Tokens',
  },
  // Ergänzt 2026-11-16 (Reserve „Einordnung Cloud Computing“, Cache-Folge): Werte aus Code und ADR
  queueLimit: {
    wert: 8,
    text: 'Q&A-Queue: höchstens so viele Aufträge laufend und wartend (Default, Code a19ca70f)',
    quelle: '../../apps/backend/src/lib/qaSummaryConfig.ts',
    beleg: 'QA_SUMMARY_QUEUE_LIMIT_DEFAULT = 8',
  },
  queueParallel: {
    wert: 1,
    text: 'Q&A-Queue: Aufträge gleichzeitig (Default, Code a19ca70f)',
    quelle: '../../apps/backend/src/lib/qaSummaryConfig.ts',
    beleg: 'QA_SUMMARY_CONCURRENCY_DEFAULT = 1',
  },
  sloEndstatusProzent: {
    wert: 95,
    text: 'SLO-Vorschlag: Anteil der Aufträge mit Endstatus nach dem Labor-Timeout, % (Vorschlag, nicht gemessen)',
    quelle: '1B/1B-ergebnis.md',
    beleg: '„95 % der Aufträge haben nach 300 s einen Endstatus“',
  },
  // Ergänzt 2026-11-16 (Kontextfolie GK): Auslegung der App laut Repo-Regeln am gemessenen Stand
  liveClients: {
    wert: 500,
    text: 'Auslegung: gleichzeitige Hörsaal-Clients mindestens, auch hinter gemeinsamem NAT (Repo-Regel, keine Messung)',
    quelle: 'git:a19ca70f:AGENTS.md',
    beleg: 'at least 500 concurrent lecture-hall clients',
  },
  cacheAusAusgabeProzent: {
    wert: 3,
    text: 'Cache-Versuch U1 (PC): Ausgabe im Arm ohne Cache langsamer, Median in %',
    quelle: 'adr/1C-024-prompt-cache-ram-begrenzen.md',
    beleg: 'eine um 3 % langsamere Ausgabe im Arm aus',
  },
};

const ANTWORT = 'evidenz/1B/messung/2026-11-15-abgelehnte-antwort.json';
const LAUF_1B = 'evidenz/1B/messung/2026-11-13-lauf.json';
const NACHLAUF_1C = 'evidenz/1C/messung/2026-11-09-labor-nachlauf.json.gz';
const AUFBAU_VON_NULL = 'evidenz/1B/messung/2026-11-13-aufbau-von-null.txt';
const EXTRAKTIV = '../../apps/backend/src/lib/qaSummaryExtractive.ts';
const CLIP = 'abgabe/bau/medien/clip.json';
const KOMPASS_HTML =
  '../../apps/frontend/src/app/features/session/session-host/moderation-compass-dialog.component.html';

const json = (pfad) => JSON.parse(readFileSync(pfad, 'utf8'));

/** Nachweisumfang (GD): Kopfzahlen aus der committeten Übersicht; nachweisumfang.test.mjs rechnet sie nach. */
export const NACHWEIS = 'nachweisumfang.md';

/**
 * Die vier Kopfzahlen aus der Tabelle „Kopfzahlen“ von nachweisumfang.md (fett gesetzter Wert je Zeile),
 * so wie die Datei sie nennt. Fehlt eine Zeile, bricht der Bau ab.
 */
export function ladeNachweis(root) {
  const md = readFileSync(resolve(root, NACHWEIS), 'utf8');
  const wert = (name) => {
    const m = md.match(new RegExp(`^\\|\\s*${name}\\s*\\|\\s*\\*\\*([^*]+)\\*\\*`, 'm'));
    if (!m) throw new Error(`${NACHWEIS}: Kopfzahl „${name}“ fehlt`);
    return m[1].trim();
  };
  // Alle Tabellenzeilen: erste Spalte → zweite Spalte, Fettdruck entfernt
  const zeilen = {};
  for (const z of md.split('\n')) {
    if (!z.startsWith('|') || /^\|\s*-/.test(z)) continue;
    const [, name, w] = z.split('|').map((x) => x.trim());
    zeilen[name] = w.replace(/\*\*/g, '');
  }
  const zeile = (name) => {
    if (!(name in zeilen)) throw new Error(`${NACHWEIS}: Zeile „${name}“ fehlt`);
    return zeilen[name];
  };
  /** „10 h 56 min (18 Läufe, 128 Aufträge)“ → Dauer, Zusatz, Minuten */
  const dauerZeile = (name) => {
    const m = zeile(name).match(/^((?:(\d+) h )?(\d+) min)(?: \(([^)]+)\))?$/);
    if (!m) throw new Error(`${NACHWEIS}: Dauer in „${name}“ unlesbar`);
    return { dauer: m[1], zusatz: m[4] ?? '', min: Number(m[2] ?? 0) * 60 + Number(m[3]) };
  };
  return {
    datei: NACHWEIS,
    laborzeit: wert('Gewertete Laborzeit'),
    tests: wert('Automatisierte Tests'),
    adrs: wert('ADRs'),
    hypothesen: wert('Vorab festgelegte Hypothesen und Kriterien'),
    zeitraum: zeile('Zeitraum der gewerteten Läufe'),
    /** Commit, auf dem die Datei zuletzt nachgerechnet wurde (Zeile „Stand …“) */
    commit:
      (md.match(/Commit `([0-9a-f]{8})`/) ?? [])[1] ??
      (() => {
        throw new Error(`${NACHWEIS}: Stand-Commit fehlt`);
      })(),
    /** Laborzeit je Auftrag in der Reihenfolge der Datei */
    je: [
      ['1A', '1A Ressourcenisolation', 'davon 1A Ressourcenisolation'],
      ['1B', '1B Schritte 1–2', 'davon 1B Schritte 1–2'],
      ['1B', '1B Schritte 3–4', 'davon 1B Schritte 3–4'],
      ['1C', '1C Laborläufe', 'davon 1C Laborläufe'],
    ].map(([auftrag, was, name]) => ({
      auftrag,
      was,
      ...dauerZeile(name),
      // Aufbau, Tests und weitere Läufe desselben Auftrags (getrennt gezählt)
      vor: dauerZeile(name.replace(/^davon /, 'zusätzlich ')),
    })),
    vorarbeit: wert('Aufbau, Tests und weitere Läufe'),
    zeilen,
  };
}

/** Abb. 1 und 2 aus 1C/1C-diagrams.md (gerenderte Mermaid-SVGs, helles Thema) für R15 und R16. */
export const DIAGRAMME = {
  abb1: [
    'diagrams/1c-context-path-overview.light.svg',
    'Abb. 1: Kontextpfad der Moderationszusammenfassung, Aktivitätsdiagramm (vereinfacht)',
  ],
  legende: ['diagrams/1c-legende.light.svg', 'Legende zu Abb. 1: Farben, Rahmen und Linien'],
  abb2: [
    'diagrams/1c-context-path-overview-sequence.light.svg',
    'Abb. 2: Zeitablauf der Zusammenfassung, UML-Sequenzdiagramm (vereinfacht)',
  ],
};

/**
 * Gerendertes Mermaid-SVG zum Einbetten: Mermaid nennt jedes Diagramm „my-svg“ (Id, CSS-Selektoren,
 * Marker); im Deck stehen mehrere davon, deshalb je Abbildung ein eigener Präfix. Breite und
 * max-width entfallen, das SVG füllt seinen Kasten (Seitenverhältnis aus der viewBox). Keine externen Verweise.
 */
export function ladeDiagramm(root, datei, praefix, label) {
  const roh = readFileSync(resolve(root, datei), 'utf8');
  const start = roh.indexOf('<svg');
  if (start < 0) throw new Error(`${datei}: kein <svg>`);
  let svg = roh.slice(start).trim().replaceAll('my-svg', praefix);
  const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  if (!vb) throw new Error(`${datei}: viewBox fehlt`);
  svg = svg.replace(/^<svg([^>]*)>/, (_, attr) => {
    const a = attr
      .replace(/\swidth="[^"]*"/, '')
      .replace(/\sstyle="[^"]*"/, '')
      .replace(/\srole="[^"]*"/, '')
      .replace(/\saria-[a-z]+="[^"]*"/g, '')
      // Namensräume braucht Inline-SVG in HTML nicht; das Deck enthält so keine http-Adresse.
      .replace(/\sxmlns(?::xlink)?="[^"]*"/g, '');
    return `<svg${a} width="100%" height="100%" role="img" aria-label="${label}" style="display:block;background:var(--grund)">`;
  });
  if (/<image\b|href="https?:|url\(\s*['"]?https?:|@import/i.test(svg)) {
    throw new Error(`${datei}: externer Verweis im SVG`);
  }
  return { datei, svg, verhaeltnis: Math.round((Number(vb[3]) / Number(vb[4])) * 1000) / 1000 };
}

/** Nutzlast-Ausschnitt aus dem committeten Nachlauf (synthetische Referenzfixture #456). */
function ladeNutzlast(root) {
  const roh = JSON.parse(gunzipSync(readFileSync(resolve(root, NACHLAUF_1C))));
  const laeufe = roh.labor.quiet.runs;
  const lauf = laeufe.findIndex((r) => !r.warmup && r.completionRequests === 1);
  const r = laeufe[lauf];
  const ex = r.exchanges.find((e) => e.path === '/v1/chat/completions');
  if (!ex.wire.userEqualsPreview || r.preview.snapshotHash !== r.sent.snapshotHash) {
    throw new Error('Nachlauf: Vorschau und Nutzlast weichen im gewählten Lauf ab');
  }
  const body = JSON.parse(ex.rawRequestBody);
  const ctx = JSON.parse(body.messages.find((m) => m.role === 'user').content);
  const frage = ctx.sources
    .filter((s) => s.kind === 'qa-question' && s.content?.state === 'included')
    .sort((a, b) => a.content.text.length - b.content.text.length)[0];
  const budget = ctx.limitations.find((l) => l.code === 'budget-truncated');
  // Ersatzzusammenfassung wie createExtractiveQaSummaryOutput: enthaltene Q&A-Fragen nach Quellen-ID, höchstens 4.
  const ersatz = ctx.sources
    .filter((s) => s.kind === 'qa-question' && s.content?.state === 'included')
    .sort((x, y) => x.id.localeCompare(y.id))
    .slice(0, 4)
    .map((s) => s.content.text);
  if (ersatz.length !== r.stored.statements) {
    throw new Error(
      'Nachlauf: Ersatzzusammenfassung passt nicht zur gespeicherten Anzahl Aussagen',
    );
  }
  return {
    datei: NACHLAUF_1C,
    lauf,
    zeilen: [
      `"contractVersion":${JSON.stringify(ctx.contractVersion)}`,
      `"feedback":${JSON.stringify(ctx.feedback)}`,
      `"content":${JSON.stringify(frage.content)}`,
    ],
    budgetZeile: JSON.stringify(budget),
    ersatz,
    hashVorschau: r.preview.snapshotHash,
    hashGesendet: r.sent.snapshotHash,
    zahlen: { bodyBytes: ex.requestBodyBytes, userBytes: ex.wire.userMessageBytes },
    commit: roh.environment.gitSha.slice(0, 8),
    cpu: roh.environment.cpuModel,
  };
}

/** Daten aller Folien: Datenmodul, abgelehnte Antwort, der verfolgte Auftrag und der Nutzlast-Ausschnitt. */
export function ladeFolienDaten(root) {
  const z = ladeZahlen(root);
  const antwort = json(resolve(root, ANTWORT));
  const lauf = json(resolve(root, LAUF_1B));
  const nr = antwort.auftrag;
  const t = lauf.treiber.auftraege.find((a) => a.index === nr);
  const zer = lauf.zerlegung.auftraege[nr - 1];
  if (
    !t ||
    !zer ||
    t.effectiveMode !== zer.effectiveMode ||
    t.fallbackReason !== zer.fallbackReason
  ) {
    throw new Error(`Auftrag ${nr} passt nicht zwischen Treiber und Zerlegung`);
  }
  const auftrag = {
    nr,
    requestedAt: t.requestedAt,
    finishedAt: t.finishedAt,
    // Wartezeit am Client vom Klick bis zum Endstatus (Treiber fragt im Sekundentakt nach) und
    // Rückkehr des Host-Aufrufs; T_job (jobMs) ist dagegen die Jobdauer am Server (ADR 1B-011).
    clientWaitMs: t.clientWaitMs,
    hostReturnMs: t.hostReturnMs,
    netzMs: zer.netzMs,
    serverOhneInferenzMs: zer.serverOhneInferenzMs,
    inferMs: zer.inferMs,
    jobMs: zer.jobMs,
  };
  // Commit des Aufbaus von null steht in dessen Bericht (Zeile „Repo: <sha>“).
  const repo = readFileSync(resolve(root, AUFBAU_VON_NULL), 'utf8').match(
    /^Repo: ([0-9a-f]{40})$/m,
  );
  if (!repo) throw new Error(`${AUFBAU_VON_NULL}: Zeile „Repo:“ fehlt`);
  const aufbau = { datei: AUFBAU_VON_NULL, commit: repo[1].slice(0, 8) };
  const nutzlast = ladeNutzlast(root);
  // Hinweistext des extraktiven Fallbacks (de) wörtlich aus dem App-Code.
  const extraktiv = readFileSync(resolve(root, EXTRAKTIV), 'utf8');
  const hinweis = extraktiv.match(/\bde: \{[\s\S]*?limitation:\s*'([^']+)'/)?.[1];
  if (!hinweis) throw new Error(`${EXTRAKTIV}: Hinweistext (de) nicht gefunden`);
  // Überschrift der Karte wörtlich aus dem Template der App (deutsche Quellsprache).
  const titel = readFileSync(resolve(root, KOMPASS_HTML), 'utf8').match(
    /i18n="@@sessionHost\.moderationSummaryTitle"\s*>\s*([^<]+?)\s*</,
  )?.[1];
  if (!titel) throw new Error(`${KOMPASS_HTML}: Überschrift der Zusammenfassung nicht gefunden`);
  const nachbau = {
    fragen: nutzlast.ersatz,
    hinweis,
    titel,
    quelle: EXTRAKTIV.replace(/^\.\.\/\.\.\//, ''),
  };
  // Commit, mit dem der Antwortausschnitt ins Repo kam (Evidenzort im Handout).
  const antwortCommit = execFileSync(
    'git',
    ['log', '--diff-filter=A', '--format=%H', '-1', '--', ANTWORT],
    { cwd: root, encoding: 'utf8' },
  )
    .trim()
    .slice(0, 8);
  if (!/^[0-9a-f]{8}$/.test(antwortCommit)) throw new Error(`${ANTWORT}: Commit nicht gefunden`);
  const feld = fussballMasse(z.b1);
  const abgeleitet = {
    gateBeobachtet: z.b1.verworfen + z.c1.gateAntwortenGesamt.wert,
    // J10-Titel: Feldlänge und Netz im selben Maßstab wie die Grafik
    feldM: feld.feldM,
    feldNetzMm: Math.round(feld.netzMm * 10) / 10,
    // Reserve R14, Rechnung aus dem Code: Aufträge je Stunde bei einem Slot und T_job warm (Laptop)
    auftraegeProStunde: Math.floor(3600 / (z.b1.jobWarmMs / 1000)),
    // J9-Notiz: Inferenzanteil, wenn die Inferenz so lang wäre wie die PC-Kalibrierung (untere Schranke, ganze %)
    anteilPcMin: Math.floor(
      ((z.c1.kalibrierungPcS.wert * 1000) /
        (z.c1.kalibrierungPcS.wert * 1000 + z.b1.transportMs + z.b1.adapterMs)) *
        100,
    ),
    fullContext1B: z.b1.anzahl - z.b1.verworfen,
  };
  // Angaben zum Lehrenden-Clip (Entwicklungslauf, evidenz/1B/2026-11-15-clip.md), falls vorhanden.
  // Der aufgenommene Hinweis muss dem Hinweis im App-Code entsprechen.
  const clipPfad = resolve(root, CLIP);
  const clip = existsSync(clipPfad) ? json(clipPfad) : null;
  if (clip && !clip.hinweis.startsWith(hinweis.replace(/…$/, '').trim())) {
    throw new Error(`${CLIP}: Hinweis weicht vom App-Code ab`);
  }
  const diagramme = Object.fromEntries(
    Object.entries(DIAGRAMME).map(([k, [datei, label]]) => [
      k,
      ladeDiagramm(root, datei, `d1c-${k}`, label),
    ]),
  );
  const nachweis = ladeNachweis(root);
  return {
    ...z,
    nachweis,
    antwort,
    auftrag,
    aufbau,
    nutzlast,
    nachbau,
    antwortCommit,
    abgeleitet,
    clip,
    diagramme,
  };
}

/** Belegrepository (Dankfolie, QR-Code); dieselbe Adresse wie weirauch2026c in literatur.mjs. */
export const REPO_URL = 'https://github.com/NiklasSkulll/arsnova.eu/tree/main/docs/referat-thema-1';

/**
 * QR-Code als SVG, offline erzeugt (qrcode-generator aus den Repo-Abhängigkeiten): ein Pfad aus Modulen,
 * Ruhezone 4 Module, Tinte auf Weiß.
 */
export function qrSvg(text, px = 280) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const rand = 4;
  const d = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (q.isDark(y, x)) d.push(`M${x + rand},${y + rand}h1v1h-1z`);
  }
  const w = n + 2 * rand;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}" width="${px}" height="${px}" role="img" aria-label="QR-Code zum Belegrepository" shape-rendering="crispEdges">` +
    `<rect width="${w}" height="${w}" style="fill:var(--grund)"/><path d="${d.join('')}" style="fill:var(--tinte)"/></svg>`
  );
}

// ---------------------------------------------------------------- Bausteine

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Auftragsetikett; 1B mit Schritten ist ein Chip („1B Schritte 1–2“), Durchsicht 2026-11-18.
const etikett = (a, schritte) =>
  `<span class="etikett etikett-${a.toLowerCase()}">${a}${schritte ? ` <span class="etikett-schritte">Schritte ${schritte}</span>` : ''}</span>`;

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
/** „18,6 h“ → „18,6 Stunden“, „10 h 56 min“ → „10 Stunden 56 Minuten“ (Sprechnotiz) */
const gesprochenDauer = (t) => t.replace(/ h\b/, ' Stunden').replace(/ min\b/, ' Minuten');
/** „5.–16.11.2026“ → „vom 5. bis 16. November“ */
const gesprochenZeitraum = (t) => {
  const m = t.match(/^(\d+)\.(?:(\d+)\.)?–(\d+)\.(\d+)\.\d{4}$/);
  if (!m) throw new Error(`Zeitraum unlesbar: ${t}`);
  const von = m[2] ? `${m[1]}. ${MONATE[m[2] - 1]}` : `${m[1]}.`;
  return `vom ${von} bis ${m[3]}. ${MONATE[m[4] - 1]}`;
};

/**
 * Nachweisumfang auf GD: vier Kennzahlen, darunter die gewertete Laborzeit je Auftrag als Balken (Länge
 * proportional, Farbe des Auftragsetiketts). Werte unverändert aus nachweisumfang.md.
 */
const nachweisLeiste = (n) => {
  const max = Math.max(...n.je.map((j) => j.min + j.vor.min));
  const anteil = (min) => `calc((100% - 280px) * ${(min / max).toFixed(3)})`;
  const kennzahl = (wert, was) =>
    `<div class="nw-zahl"><span class="nw-wert">${esc(wert)}</span><span class="nw-was">${esc(was)}</span></div>`;
  return (
    `<div class="dank-nachweis" data-nachweis>` +
    `<div class="nw-band"><div class="nw-zahlen">` +
    kennzahl(n.laborzeit, 'gewertete Laborzeit') +
    kennzahl(n.vorarbeit, 'Aufbau, Tests, weitere Läufe') +
    kennzahl(n.tests, 'automatisierte Tests') +
    kennzahl(n.adrs, 'ADRs') +
    kennzahl(n.hypothesen, 'vorab festgelegte Hypothesen') +
    `</div>` +
    `<div class="nw-balken" data-nachweis-je>` +
    `<span></span><span class="nw-legende"><span class="nw-l-voll"></span>gewertete Läufe ${esc(n.zeitraum)}` +
    `<span class="nw-l-schraffur"></span>Aufbau, Tests, weitere Läufe</span>` +
    n.je
      .map(
        (j) =>
          `<span class="nw-auftrag">${esc(j.was)}</span>` +
          `<span class="nw-spur nw-${j.auftrag.toLowerCase()}">` +
          `<span class="nw-voll" style="width:${anteil(j.min)}"></span>` +
          `<span class="nw-schraffur" style="width:${anteil(j.vor.min)}"></span>` +
          `<span class="nw-dauer">${esc(j.dauer)} <span class="nw-plus">+ ${esc(j.vor.dauer)}</span></span></span>`,
      )
      .join('') +
    `</div></div></div>`
  );
};

/** Grafik aus grafik.mjs unter einer Frage: füllt die Resthöhe der Fläche, Seitenverhältnis bleibt. */
const grafikBox = (svg) => `<div class="grafik-box">${svg}</div>`;

/** Inhalt der Fläche als Spalte im Fluss (stil.css .flaeche-inhalt); der Beleg sitzt unten. */
// Kurzbelege je Folie: [Schlüssel aus literatur.mjs, Stelle]. Eigene Arbeit ist ein Eintrag (Weirauch, 2026);
// die Fundstelle (Ordner, Datei, ADR) steht im Kurzbeleg wie im Handout. Die Fußzeile zeigt nur diese
// Kurzbelege in einer Zeile; Rechner und Commit stehen in `quelle` (Sprechnotizen) und im Manifest.
const W = 'weirauch2026c';
const ZITATE = {
  GT: [['arsnova2026pruefung', 'Kap. 4.3']],
  G0: [['arsnova2026pruefung', 'Kap. 4.3']],
  GD: [[W, 'Ordner docs/referat-thema-1']],
  GK: [
    ['arsnova2026pruefung', 'Kap. 4.1.1'],
    ['arsnova2026adr0035', 'Kap. 2.1'],
  ],
  J1: [
    ['arsnova2026pruefung', 'Kap. 4.3'],
    [W, 'Ordner evidenz/1B, ADR 1B-011'],
  ],
  J2: [
    [W, 'ADR 1B-005'],
    // ein Slot (Kap. 2.2), Threads und RAM je Topologie (Performance-Steckbrief), geprüft auf a19ca70f
    ['arsnova2026adr0035', 'Kap. 2.2, Abschnitt Performance-Steckbrief'],
    ['yang2025', 'S. 3'],
    // ggml2026 (Werk als Ganzes) fiel 2026-11-18 weg, damit die Fußzeile einzeilig bleibt; llama-server belegt
    // hier ADR-0035, die Software selbst zitieren J8 und J11.
  ],
  J3: [[W, 'Ordner evidenz/1B, 1C-Nachlauf']],
  J4: [
    [W, 'ADR 1B-008, 1C-003, 1C-021'],
    ['papadopoulos2021', 'Kap. 2.3'],
  ],
  J5: [[W, 'ADR 1C-012, Test E5, Nachlauf N3']],
  J5b: [[W, 'Datei 1C/1C-diagrams.md, #456-Bereiche, Test E2']],
  J6: [[W, 'ADR 1C-011, 1C-013, Datei 1C/1C-diagrams.md']],
  J7: [[W, 'ADR 1C-014, Nachlauf N2']],
  J8: [
    [W, 'ADR 1B-006, 1B-011'],
    ['ggml2026', 'Abschnitt Timings and context usage'],
  ],
  J8b: [[W, 'evidenz/1B/2026-11-13-lauf.md, Nachtrag M2']],
  J9: [
    [W, 'Ordner evidenz/1B, ADR 1B-008'],
    ['kwon2023', 'Kap. 2.2'],
  ],
  J10: [
    [W, 'Ordner evidenz/1B'],
    ['kwon2023', 'Kap. 2.2'],
  ],
  J10a: [[W, 'evidenz/1B/2026-11-13-lauf.md, Nachtrag M4']],
  J10b: [[W, 'evidenz/1B/2026-11-13-lauf.md, Nachtrag M3']],
  J11: [
    [W, 'ADR 1C-023, 1C-024'],
    ['ggml2026', 'Abschnitt Server-specific params'],
  ],
  J12: [[W, 'ADR 1C-010, 1C-016, 1C-017, Tests E7, E8']],
  J13: [
    [W, 'ADR 1C-018, Gate-Ablation, Ordner evidenz/1B'],
    ['shankar2024', 'S. 1–2'],
  ],
  J13b: [
    ['mell2011', 'S. 2–3'],
    ['dean2013', 'S. 74'],
    [W, 'ADR 1C-018'],
  ],
  J15: [
    [W, '1C/1C-ergebnis.md, Kap. 5'],
    ['ulrich2016', 'Abschnitt Load Shedding and Graceful Degradation'],
  ],
  G9: [
    [W, '1B/1B-ergebnis.md, 1C/1C-ergebnis.md'],
    ['schneider2026', 'Ordner evidenz/1A und evidenz/1B'],
  ],
  R1: [[W, 'ADR 1C-020, 1B-005']],
  R5: [[W, '1C-Nachlauf, Ordner evidenz/1B, ADR 1B-011']],
  R6: [[W, 'Dateien 1B/1B-eigenanteil.md, 1C/1C-eigenanteil.md']],
  R7: [[W, 'adr/README.md']],
  R9: [[W, '1C/1C-ergebnis.md, Kap. 3']],
  R10: [
    [W, 'Aufbauprotokoll 1B'],
    ['arsnova2026adr0035', 'Kap. 2.4'],
  ],
  R11: [[W, 'Laufprotokoll 1B, Befund C']],
  R12: [[W, '1C/1C-ergebnis.md, Kap. 5']],
  R15: [[W, 'Datei 1C/1C-diagrams.md, Abb. 1']],
  R16: [[W, 'Datei 1C/1C-diagrams.md, Abb. 2']],
  // Niklas' gewertete Läufe 1A und 1B 3–4 zählen in die Laborzeit (gemeinsames Verzeichnis seit 2026-11-18)
  GN: [
    [W, 'Ordner docs/referat-thema-1, Datei nachweisumfang.md'],
    ['schneider2026', 'Ordner evidenz/1A und evidenz/1B'],
  ],
};

const flaeche = (inhalt) => `<div class="flaeche-inhalt">${inhalt}</div>`;

/**
 * Fragezeile (Kopfzeile 3, Kopfgrammatik in README „Designregeln“): zuerst das Etikett des Auftrags (bei
 * Folien zu beiden Aufträgen 1C und 1B), dann die Frage, danach höchstens ein gedämpfter Status
 * („nachträglich ausgewertet“). deck.mjs hebt die Zeile aus der Fläche in den Kopf unter den Titel, damit
 * sie auf jeder Folie im selben Abstand steht; nur der Inhalt darunter wird zentriert.
 * @param {string} text
 * @param {string | string[]} auftrag '1A', '1B', '1C', 'beide' oder eine Liste
 * @param {{ status?: string }} [o]
 */
const frage = (text, auftrag, { status } = {}) => {
  const etiketten = auftrag === 'beide' ? ['1C', '1B'] : [auftrag].flat().filter(Boolean);
  if (!etiketten.length) throw new Error(`Fragezeile ohne Etikett: ${text}`);
  return (
    `<p class="folie-frage">${etiketten.map((a) => etikett(a)).join('')}${text}` +
    `${status ? `<span class="status">${esc(status)}</span>` : ''}</p>`
  );
};

/** Autorzeile (nur auf der ersten Folie jedes Teils, N1 und J1): steht im Kopf unter der Fragezeile. */
const autorZeile = (name) => `<p class="folie-autor">${esc(name)}</p>`;

const liste = (punkte, groesse = 28) =>
  `<ul style="margin:0;padding-left:30px;font-size:${groesse}px;line-height:1.38">` +
  punkte.map((p) => `<li style="margin:0 0 12px">${p}</li>`).join('') +
  '</ul>';

/** Große Zahl (Inter, Tabellenziffern) mit Bezeichnung und Gruppe (Rechner, Stand, n). */
function zahl({
  wert,
  einheit,
  was,
  gruppe,
  farbe = 'var(--tinte)',
  linie = 'var(--blau)',
  gross = 84,
}) {
  return (
    `<div style="border-left:6px solid ${linie};padding:4px 0 4px 24px;margin:0 0 24px">` +
    `<div class="kennzahl" style="font-size:${gross}px;line-height:1.05;color:${farbe}">${wert}` +
    `<span class="einheit" style="font-size:${Math.round(gross * 0.45)}px">${einheit ? ` ${einheit}` : ''}</span></div>` +
    `<div class="zahl-was">${was}</div>` +
    `<div class="vermerk zahl-gruppe">${gruppe}</div></div>`
  );
}

const zweiSpalten = (links, rechts, breite = 800) =>
  `<div style="display:grid;grid-template-columns:${breite}px 1fr;column-gap:70px">` +
  `<div>${links}</div><div>${rechts}</div></div>`;

/** Kleiner Vermerk oben links im Folienrand über dem Titel (bleibt, bis Niklas zustimmt); rechts steht die Teilleiste. */
const entwurf =
  `<p style="position:absolute;left:0;top:-150px;margin:0;padding:0 10px;border:var(--linie-min) dashed var(--linie);` +
  `border-radius:6px;color:var(--gedaempft);font-size:var(--s-min);font-weight:600">Entwurf, mit Niklas abzustimmen</p>`;

const mono = (s) => `<span class="mono">${s}</span>`;
const t = (i) => `t<sub>${i}</sub>`;

/** "2026-11-13T08:20:35.594Z" → "08:20:35,594" (UTC). */
const uhr = (iso) => iso.slice(11, 23).replace('.', ',');

function rechnerKurz(rechner) {
  const cpu = rechner.match(/i7-\w+/)?.[0];
  if (cpu !== 'i7-6820HQ') throw new Error(`unerwarteter Rechner: ${rechner}`);
  return 'ThinkPad P50';
}

// ---------------------------------------------------------------- Folien

/** Hauptfolien dieses Moduls in Vortragsreihenfolge (Niklas' Folien setzt deck.mjs dazwischen). */
export const REIHENFOLGE = [
  'GT',
  'G0',
  'GK',
  'J1',
  'J2',
  'J3',
  'J4',
  'J5',
  'J5b',
  'J6',
  'J7',
  'J8',
  'J8b',
  'J9',
  'J10',
  'J10a',
  'J10b',
  'J11',
  'J12',
  'J13',
  'J13b',
  'J15',
  'G9',
  'GN',
  'GD',
  'J16',
  'J16b',
];

/**
 * Alle Folien in Vortragsreihenfolge: G0, J1–J10, J12, J13, J15, G9, J16 (Anhang), dann Reserve R1–R14
 * (J14 ist R11, J11 ist R13).
 */
export function folien(daten) {
  const { b1: b, c1: c, antwort: a, auftrag: au, nutzlast: nl } = daten;
  const H = b.herkunft;
  const z = {
    netz: fmt(b.netzMs, 2),
    netzMax: fmt(b.netzMaxMs, 2),
    transport: fmt(b.transportMs, 1),
    adapter: fmt(b.adapterMs, 0),
    anteil: fmt(b.inferAnteil * 100, 2),
    jobWarm: fmt(b.jobWarmMs / 1000, 1),
    inferWarm: fmt(b.inferWarmMs / 1000, 1),
    jobKalt: fmt(b.jobKaltMs / 1000, 1),
    kaltMedian: fmt(b.kaltMedianS, 1),
    kaltMin: fmt(b.kaltSpanneS[0], 1),
    kaltMax: fmt(b.kaltSpanneS[1], 1),
    c0: fmt(b.c0DiffMs, 1),
    b0: fmt(b.b0JobMs, 1),
    request: fmt(c.requestMs.wert, 1),
    valMs: fmt(c.validierungMs.wert, 1),
    valP: fmt(c.validierungAnteilProzent.wert, 1),
    q: fmt(c.q.wert, 3),
    infer1C: fmt(c.inferenzS.wert, 1),
    kalPc: fmt(c.kalibrierungPcS.wert, 1),
    delta: fmt(c.speicherDeltaGb.wert, 3),
    nachpr: fmt(c.nachpruefungAnteilProzent.wert, 2),
    auNetz: fmt(au.netzMs, 2),
    auInfer: fmt(au.inferMs / 1000, 1),
    auJob: fmt(au.jobMs / 1000, 1),
    // Klick bis Ergebnis = Wartezeit am Client (Treiber), nicht T_job (Jobdauer am Server).
    auWarte: fmt(au.clientWaitMs / 1000, 1),
    auS: fmt(Math.round(au.clientWaitMs / 1000)),
    auHost: fmt(au.hostReturnMs),
    auInferRund: fmt(Math.round(au.inferMs / 1000)),
    kaltAnteilMin: fmt(b.kaltAnteilSpanne[0] * 100, 2),
    kaltAnteilMax: fmt(b.kaltAnteilSpanne[1] * 100, 2),
    transportAnteil: fmt(b.transportAnteil * 100, 2),
    speicher1B: fmt(b.speicherMaxGb, 2),
    warmMin: fmt(b.jobWarmSpanneS[0], 1),
    warmMax: fmt(b.jobWarmSpanneS[1], 1),
    inferRuhig: fmt(c.inferenzRuhigS.wert, 1),
  };
  const fw = Object.fromEntries(Object.entries(FESTWERTE).map(([k, v]) => [k, fmt(v.wert)]));
  const n = b.anzahl;
  const nWarm = b.nWarm;

  // Quellen mit Rechner und Commit je Gruppe
  const q1B = `${LAUF_1B} · ${rechnerKurz(H.hauptlauf.rechner)} · ${H.hauptlauf.commit.slice(0, 8)}`;
  const q1BN = `evidenz/1B/2026-11-13-lauf.md, Nachtrag · ${rechnerKurz(H.nachtrag.rechner)} · ${H.nachtrag.commit.slice(0, 8)}`;
  const q1C = (...keys) => {
    const gruppen = new Map();
    for (const k of keys) {
      const e = c[k];
      const schluessel = `${e.quelle} · ${e.rechner} · ${e.commit}`;
      gruppen.set(schluessel, true);
    }
    return [...gruppen.keys()].join('; ');
  };
  const qNutzlast = `${nl.datei}, labor.quiet.runs[${nl.lauf}] · Laptop (${rechnerKurz(nl.cpu)}) · ${nl.commit} (def56700)`;
  const qAntwort = `${ANTWORT} (Auftrag ${a.auftrag})`;
  // Messstand: Architektur nach Release 1.3 (ADR-0035), gemessen auf Fork-main mit Version 1.4.0.
  // Produktionscode des 1B-Laufs = Fork-main a19ca70f (git describe v1.4.0-184); Lauf-Commits auf dem
  // 1B-Zweig ändern nur Laborskripte (ADR 1B-001). 1C: def56700 = v1.4.0-14; vor dem Gate 9f230abc = v1.3.0-322.
  const STAND = `Code ${mono('a19ca70f')} (v1.4.0-184); Lauf-Commit ${mono(H.hauptlauf.commit.slice(0, 8))} nur Laborskripte`;
  const kasten = (titel, punkte, linie, groesse = 22) =>
    `<div style="border:var(--linie-min) solid ${linie};border-radius:10px;padding:${groesse > 22 ? '18px 24px 10px' : '12px 20px 6px'}">` +
    `<p style="margin:0 0 ${groesse > 22 ? 10 : 6}px;font-weight:700;font-size:${groesse + 2}px">${titel}</p>` +
    `<ul style="margin:0;padding-left:26px;font-size:${groesse}px;line-height:1.35">` +
    punkte.map((p) => `<li style="margin:0 0 ${groesse > 22 ? 10 : 4}px">${p}</li>`).join('') +
    '</ul></div>';

  const F = [];

  // ------------------------------------------------------------ GT Titel (spricht Niklas)
  // Beide Namen mit Platz für die Matrikelnummer: Die Nummern setzt nur abgabe-lokal.mjs ein (ignorierte
  // Kopie); im Repo steht dort ein neutraler Vermerk (data-matrikel, Name als Schlüssel).
  const titelPerson = (name, etiketten) =>
    `<div class="titel-person">` +
    `<p class="titel-name">${name}</p>` +
    `<p class="titel-auftraege">${etiketten}</p>` +
    `<p class="matrikel" data-matrikel="${name}">${MATRIKEL_VERMERK}</p></div>`;
  F.push({
    id: 'GT',
    teil: 'rahmen',
    auftrag: null,
    oberzeile: 'Thema 1 · Cloud Computing',
    titel: 'KI-Inferenz im Moderationskompass',
    inhalt: flaeche(
      `<p class="titel-unter">Release 1.3 im Labor: App-Host, zweiter Host und private Inferenz unter Last</p>` +
        `<div class="titel-personen">` +
        titelPerson('Niklas Schneider', `${etikett('1A')} ${etikett('1B', '3–4')}`) +
        titelPerson('Jonas Weirauch', `${etikett('1C')} ${etikett('1B', '1–2')}`) +
        `</div>` +
        // Angaben in zwei Gruppen auf dem Raster der Namensspalten
        `<div class="titel-meta">` +
        `<dl><div><dt>Kurs ${TITEL.modul}</dt><dd>${TITEL.kurs}</dd></div>` +
        `<div><dt>Hochschule</dt><dd>${TITEL.hochschule}</dd></div></dl>` +
        `<dl><div><dt>Prüfer</dt><dd>${TITEL.pruefer}</dd></div>` +
        `<div><dt>Datum</dt><dd>${TITEL.datum}</dd></div></dl>` +
        `</div>`,
    ),
    notiz: privat('GT.notiz', {}),
    stichpunkte: privat('GT.stichpunkte', {}),
    zeitS: 10,
    kurzfassung: true,
    sprecher: 'niklas',
    quelle:
      'Prüfungsdokument (Modul DSCC0127, Abschnitt 4.3 Thema 1); Prüfer und Termin nach Angabe der Gruppe (2026-11-16)',
    station: null,
  });

  // ------------------------------------------------------------ G0 Fahrplan (spricht Niklas)
  // Leitfrage wörtlich (Prüfungsdokument 4.3); G9 nimmt sie wieder auf (Klammer Anfang–Ende). Der Fahrplan
  // zeigt die vier Teile in Vortragsreihenfolge; dieselben Teile stehen klein oben rechts auf jeder Folie
  // (Teilleiste, deck.mjs), Leitfaden E24.
  const LEITFRAGE =
    '„Wie wirksam trennt die Architektur von Release 1.3 Anwendung, Kontextaufbau und private Inferenz unter realer Last, und welche Betriebsgrenzen ergeben sich für den Moderationskompass?“';
  F.push({
    id: 'G0',
    teil: 'rahmen',
    auftrag: null,
    titel: 'Eine Leitfrage, vier Teile',
    inhalt: flaeche(
      `<p class="leitfrage"><span class="leitfrage-kopf">Leitfrage</span>${LEITFRAGE}</p>` +
        `<ol data-fahrplan class="fahrplan">` +
        TEILE.map(
          (t, i) =>
            `<li>` +
            `<div class="fahrplan-linie">${t.farben.map((f) => `<span style="background:${f}"></span>`).join('')}</div>` +
            `<p class="fahrplan-wer"><span class="mono">${i + 1}</span> ${t.wer}</p>` +
            `<p class="fahrplan-etiketten">${t.etiketten.map(([a, schritte]) => etikett(a, schritte)).join(' ')}</p>` +
            `<p class="fahrplan-was">${t.was}</p></li>`,
        ).join('') +
        `</ol>`,
    ),
    notiz: privat('G0.notiz', {}),
    stichpunkte: privat('G0.stichpunkte', {}),
    zeitS: 35,
    kurzfassung: true,
    sprecher: 'niklas',
    quelle:
      'Prüfungsdokument Abschnitt 4.3 (Thema 1, Aufträge 1A–1C); rahmen/01-aufteilung.md; Design 2026-11-15, Abschnitt 3 (Reihenfolge)',
    station: null,
  });

  // ------------------------------------------------------------ GK Was ist arsnova? (spricht Niklas)
  // Systembild in drei Stufen in der Reihenfolge des Fahrplans; oben links zeigen die Teile danach ihren
  // Weg als Wegkarte (wegkarte.mjs, deck.mjs ortsmarke).
  F.push({
    id: 'GK',
    teil: 'rahmen',
    auftrag: null,
    titel: 'arsnova.eu im Überblick',
    inhalt: flaeche(
      `<p class="sekundaer" style="margin:0 0 var(--abstand-eng);color:var(--tinte)">Open-Source-Live-App (MIT) für den Hörsaal mit Live-Interaktion in der Lehre, ohne Pflichtkonten, KI nur als Zusatz.</p>` +
        grafikBox(systemSvg({ clients: FESTWERTE.liveClients.wert })),
    ),
    notiz: privat('GK.notiz', { fw }),
    stichpunkte: privat('GK.stichpunkte', { fw }),
    zeitS: 50,
    kurzfassung: true,
    aufbau: 3,
    sprecher: 'niklas',
    quelle:
      'a19ca70f (v1.4.0-184): README.md (Kurzbeschreibung, Produktumfang, Lizenz MIT, keine Pflichtkonten), AGENTS.md (mindestens 500 gleichzeitige Hörsaal-Clients, gemeinsames NAT), docs/features/moderation-compass.md (regelbasierte, quellenbelegte Karten); Prüfungsdokument Abschn. 4.1.1 (Bausteine 1.14a/b spaCy, 8.9a Kompass, 8.9c Zusammenfassung, 8.9d Runtime; Topologie nach ADR-0035: LLM-Rolle auf zweitem privatem Host)',
    station: null,
  });

  // ------------------------------------------------------------ J1
  F.push({
    id: 'J1',
    teil: 'jonas',
    auftrag: 'beide',
    titel: `Ein Klick. ${z.auS} Sekunden. Keine Modellantwort.`,
    inhalt: flaeche(
      frage('Was erlebt die Lehrperson bei einem einzelnen Auftrag?', 'beide') +
        autorZeile('Jonas Weirauch') +
        `<p class="sekundaer" style="margin:0 0 var(--abstand-gruppe);font-size:var(--s-text)">Ein echter Auftrag der Q&amp;A-Zusammenfassung mit synthetischen Daten, verfolgt vom Klick der Lehrperson bis zum Ergebnis. Labor auf einem Laptop, Inferenz auf der CPU, Code nach v1.4.0 (1B: v1.4.0-184, 1C: v1.4.0-14).</p>` +
        `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:60px;font-size:32px;line-height:1.35">` +
        `<div style="border-left:6px solid var(--petrol);padding-left:24px">${etikett('1C')}<p style="margin:14px 0 0">Hält der Kontextpfad seine Zusagen zu Vertrag, Konsistenz und Entkopplung ein?</p></div>` +
        `<div style="border-left:6px solid var(--bernstein);padding-left:24px">${etikett('1B', '1–2')}<p style="margin:14px 0 0">Wo steckt die Zeit, wenn die Inferenz auf einem zweiten Host läuft?</p></div>` +
        `</div>` +
        `<p class="beleg">Auftrag Nr. ${au.nr}: Klick bis Ergebnis ${z.auWarte} s, Jobdauer T_job ${z.auJob} s · Median warm, n = ${nWarm}: ${z.jobWarm} s, Spanne ${z.warmMin}–${z.warmMax} s</p>`,
    ),
    notiz: privat('J1.notiz', { z, au }),
    zeitS: 50,
    kurzfassung: true,
    // Wegmarke oben links: Jonas' ganzer Auftragsweg ohne Hervorhebung, den J2 ff. mit dem Marker abfahren
    marke: 'auftrag',
    quelle: `${q1B} (Auftrag ${au.nr}: treiber.auftraege clientWaitMs, zerlegung.auftraege jobMs; Spanne warm: zerlegung.auftraege 2–${n}); Code: 1B a19ca70f (v1.4.0-184), 1C-Nachlauf def56700 (v1.4.0-14), frühere 1C-Messungen v1.3.0-228 und v1.3.0-322; Leitfragen: Prüfungsdokument 4.3, ADR 1B-011`,
    station: null,
  });

  // ------------------------------------------------------------ J2
  // Host-Bild rechts in voller Höhe der Fläche (Audit: unteres Drittel war leer).
  const host = (name, ip, zeilen) =>
    `<div style="flex:1 1 0;display:flex;flex-direction:column;justify-content:center;border:var(--linie-min) solid var(--bernstein);border-radius:12px;padding:16px 20px;background:var(--bernstein-hell)">` +
    `<div style="font-weight:700;font-size:32px;line-height:1.2">${name}<br><span class="mono" style="font-weight:400;font-size:24px;color:var(--text-2)">${ip}</span></div>` +
    `<div style="font-size:22px;color:var(--text-2);line-height:1.3;margin-top:6px">${zeilen}</div></div>`;
  // Konfiguration je Stand (Durchsicht 2026-11-18): Release 1.3 zum Vergleich, v1.4.0 ab Werk ist der gemessene
  // Code, dazu beide Labore. Fett ist, was vom gemessenen Code abweicht.
  const konfigTabelle = (zeilen) => {
    const th = (t) =>
      `<th style="padding:0 0 8px 18px;font-weight:600;font-size:20px;line-height:1.2;color:var(--gedaempft);text-align:right;vertical-align:bottom">${t}</th>`;
    return (
      `<table data-konfig style="border-collapse:collapse;font-size:24px;width:100%">` +
      `<tr><th></th>${['Release 1.3<br>(Tag v1.3.0)', 'v1.4.0 ab Werk<br>(gemessener Code)', 'Labor 1B<br>(zwei VMs)', 'Labor 1C<br>(Laptop)'].map(th).join('')}</tr>` +
      zeilen
        .map(([name, v13, werk, b, c, einheit]) => {
          const zelle = (w, labor) => {
            const t = `${w}${einheit}`;
            return `<td class="mono" style="padding:8px 0 8px 18px;text-align:right;white-space:nowrap">${labor && w !== werk ? `<b>${t}</b>` : t}</td>`;
          };
          return (
            `<tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:8px 0;font-weight:600;white-space:nowrap">${name}</td>` +
            zelle(v13, false) +
            zelle(werk, false) +
            zelle(b, true) +
            zelle(c, true) +
            `</tr>`
          );
        })
        .join('') +
      `</table>`
    );
  };
  F.push({
    id: 'J2',
    teil: 'jonas',
    auftrag: '1B',
    titel: 'Zwei Hosts nachgebaut, Produktionscode unverändert',
    inhalt: flaeche(
      frage('Lässt sich das Zwei-Host-Release nachbauen, ohne Produktionscode zu ändern?', '1B') +
        `<div style="flex:1 1 auto;min-height:0;display:grid;grid-template-columns:1010px 1fr;column-gap:48px">` +
        `<div style="display:flex;flex-direction:column"><p style="margin:0 0 18px;font-size:28px;line-height:1.38">Aufbau von null mit ${mono('labor.sh up')}, Prüfungen grün; privates Netz, Firewall, Token; Speicherlimits wie ab Werk v1.4.0, Modell per SHA-256 gepinnt</p>` +
        konfigTabelle([
          ['CPUs und Threads', fw.v13Cpus, fw.releaseCpus, fw.laborCpus, fw.laborCpus1C, ''],
          [
            'Speicher Runtime',
            fw.v13SpeicherGiB,
            fw.prodSpeicherGiB,
            fw.laborSpeicher1BGiB,
            fw.laborSpeicher1CGiB,
            ' GiB',
          ],
          [
            'Summary-Timeout',
            fw.v13TimeoutS,
            fw.releaseTimeoutS,
            fw.laborTimeout1BS,
            fw.laborTimeoutS,
            ' s',
          ],
        ]) +
        `<ul style="margin:14px 0 12px;padding-left:24px;font-size:22px;line-height:1.35;color:var(--text-2)">` +
        `<li><b>Fett</b> weicht vom gemessenen Stand ab; gemessen wurde der aktuelle Stand, auf Wunsch des Prüfers</li>` +
        `<li>Timeout ${fw.laborTimeout1BS} s nach Kalibrierung (1B: I = ${fw.kalibrierung1BS}\u00a0s); 1C: ein Rechner, Loopback, Messproxy; PC-Zusatzlauf mit Werkslimits (ADR 1C-021)</li>` +
        `<li>Images selbst gebaut; Start ohne Wrapper (CPU-Override); Summary-Schalter an, Hintergrunddienste von Hand aus</li></ul>` +
        `<p class="vermerk" style="margin-top:auto">${STAND}</p></div>` +
        `<div style="display:flex;flex-direction:column;min-height:0">` +
        host(
          'app-host',
          '192.168.150.10',
          'App, App-Adapter, PostgreSQL, Redis; Encoder nicht gestartet (ab Werk aus)',
        ) +
        `<div style="flex:none;text-align:center;font-size:24px;line-height:1.2;color:var(--bernstein-text);margin:8px 0"><span style="font-size:34px;font-weight:700">↓</span><br>privates Netz, nur app-host → llm-host, Token</div>` +
        host(
          'llm-host',
          '192.168.150.20',
          'llama-server, ein Slot; Qwen3-4B-Instruct-2507 Q4_K_M (Manifest)',
        ) +
        `</div></div>`,
    ),
    notiz: privat('J2.notiz', { fw }),
    zeitS: 45,
    kurzfassung: false,
    quelle: `${daten.aufbau.datei} · ${rechnerKurz(H.hauptlauf.rechner)} · ${daten.aufbau.commit}; Abweichungen: evidenz/1B/2026-11-12-aufbau.md (Komponenten, Befund 2, Abweichungen), evidenz/1B/2026-11-13-lauf.md (Kalibrierung, Versuch 3; Modell laut Manifest Qwen3-4B-Instruct-2507-Q4_K_M), ADR 1B-001, 1B-002, 1B-005, 1B-010`,
    station: null,
  });

  // ------------------------------------------------------------ J3
  F.push({
    id: 'J3',
    teil: 'jonas',
    auftrag: 'beide',
    titel: `Host nach ${z.auHost} ms frei, Inferenz ${z.auInferRund} s`,
    inhalt: flaeche(
      frage('Welchen Weg nimmt ein Auftrag über die zwei Hosts?', 'beide') +
        grafikBox(wegSvg({ aktiv: 'klick', b1: b, c1: c, auftrag: au })) +
        `<p class="beleg">Vereinfacht aus Abb. 1 und 2 (1C/1C-diagrams.md), vollständig in der Reserve (R15, R16)</p>`,
    ),
    notiz: privat('J3.notiz', { au, z }),
    zeitS: 45,
    kurzfassung: true,
    quelle: `${q1B} (Auftrag ${au.nr}: hostReturnMs, inferMs); 1C-Werte: Nachlauf, Laptop (ThinkPad P50) · def56700, und Teil 2, Laptop · 248029dc (Test-Runtime)`,
    station: 'klick',
    // Kopfzeile 1: Die Folie zeigt den Weg groß (kein wandernder Marker), oben links daher der ganze Weg wie J1.
    marke: 'auftrag',
  });

  // ------------------------------------------------------------ J4
  const schritt = (nr, titel, text, farbe) =>
    `<div style="border-top:6px solid ${farbe};padding-top:12px">` +
    `<div style="font-weight:700;font-size:28px;margin:0 0 6px"><span style="color:${farbe}">${nr}</span> ${titel}</div>` +
    `<div style="font-size:24px;color:var(--text-2);line-height:1.35">${text}</div></div>`;
  const hzeile = (h, was, schwelle) =>
    `<tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:8px 12px 8px 0;font-weight:600">${h}</td><td style="padding:8px 12px 8px 0">${was}</td><td style="padding:8px 0">${schwelle}</td></tr>`;
  F.push({
    id: 'J4',
    teil: 'jonas',
    auftrag: 'beide',
    titel: 'Erst die Hypothese, dann die Messung',
    inhalt: flaeche(
      frage('Wie belastbar sind die Messungen?', 'beide') +
        `<div style="display:grid;grid-template-columns:repeat(3,1fr);column-gap:40px;margin-bottom:32px">` +
        schritt(
          'A',
          'Vorab festgelegt',
          'Vor den gewerteten Läufen. Ausnahmen: T3.1 exploratorisch, M7b/c ohne vorherige Freigabe, <span class="nowrap">1B-Leitfrage</span> nach dem Lauf bestätigt',
          'var(--blau)',
        ) +
        schritt(
          'B',
          'Ohne Modell geprüft',
          `${etikett('1C')} Test-Runtime, Negativproben: Ein absichtlicher Fehler muss den Test rot machen`,
          'var(--blau)',
        ) +
        schritt(
          'C',
          'Im Labor gemessen',
          `${etikett('1C')} Nachlauf, echte Runtime<br>${etikett('1B')} Lauf über zwei Hosts, <span class="nowrap">n = ${n}</span>`,
          'var(--blau)',
        ) +
        `</div>` +
        // Abweichungen der Labore stehen seit der Durchsicht 2026-11-18 in der Tabelle auf J2
        `<div style="max-width:1000px">` +
        `<p style="margin:0 0 6px;font-weight:700;font-size:24px">${etikett('1B')} Hypothesen und Schwellen, vorab</p>` +
        `<table style="border-collapse:collapse;font-size:22px;width:100%">` +
        `<tr style="color:var(--gedaempft);text-align:left"><th style="padding:4px 12px 6px 0;font-weight:600">Hypothese</th><th style="padding:4px 12px 6px 0;font-weight:600">Messgröße</th><th style="padding:4px 0 6px;font-weight:600">Schwelle</th></tr>` +
        hzeile(
          'H_B1',
          'Netz je Auftrag',
          `${mono(`Median ≤ ${fw.schwelleNetzMs} ms`)}<br>${mono(`Max. ≤ ${fw.schwelleNetzMaxMs} ms`)}`,
        ) +
        hzeile('H_B2', 'Adapter je Auftrag', mono(`Median ≤ ${fw.schwelleAdapterS} s`)) +
        hzeile(
          'H_B3',
          'Inferenzanteil <span style="color:var(--gedaempft)">(Konsistenzprüfung)</span>',
          mono(`Median ≥ ${fw.schwelleInferenzProzent} %`),
        ) +
        `</table></div>` +
        `<p class="beleg">Orientiert an Papadopoulos et al. (2021); es fehlen Konfidenzintervalle und Wiederholung über Instanzen (n = ${n} aus einem Lauf)</p>`,
    ),
    notiz: privat('J4.notiz', { fw }),
    zeitS: 40,
    kurzfassung: false,
    quelle: `adr/1B-008-kernaussagen-und-schwellen.md; adr/1C-003-teststrategie-modellfrei.md; ${q1B}; Nachlauf 1C (Umgebung, Abweichungen): Laptop (ThinkPad P50) · def56700; ADR 1C-021 (Produktionslimits)`,
    station: null,
  });

  // ------------------------------------------------------------ J5
  F.push({
    id: 'J5',
    teil: 'jonas',
    auftrag: '1C',
    titel: 'Der Host wartet nicht auf das Modell',
    inhalt: flaeche(
      frage('Blockiert ein langsames Modell die Lehrperson?', '1C') +
        zweiSpalten(
          liste([
            `${mono('requestSummary')} baut den Kontext, legt den Auftrag in die Queue und kehrt mit ${mono('pending')} zurück`,
            'Die Queue rechnet danach im Hintergrund, ein Slot, ein Auftrag nach dem anderen',
            '<b>Grenze:</b> Auf den Kontextaufbau wartet der Host doch, er läuft im Aufruf selbst',
          ]),
          zahl({
            wert: z.request,
            einheit: 'ms',
            was: 'Host-Aufruf, Median',
            gruppe: '1C-Nachlauf, Laptop, ein Rechner',
            linie: 'var(--petrol)',
          }) +
            zahl({
              wert: z.infer1C,
              einheit: 's',
              was: 'Inferenz, Median, Nachlauf v1.4.0',
              gruppe: '1C-Nachlauf, Laptop; andere Messung als Auftrag 2',
              linie: 'var(--petrol)',
            }),
          760,
        ) +
        `<p style="margin:0;font-size:24px;color:var(--text-2)">${etikett('1B')}&nbsp; zwei Hosts: Host-Aufruf im Median ${fmt(b.hostMedianMs, 1)} ms (alle ${n}), bei Auftrag ${au.nr} ${z.auHost} ms</p>`,
    ),
    notiz: privat('J5.notiz', { z }),
    zeitS: 40,
    kurzfassung: true,
    quelle: `${q1C('requestMs', 'inferenzS')}; 1B: ${q1B}`,
    station: 'klick',
  });

  // ------------------------------------------------------------ J6
  const artefakt = (name, zeilen, linie) =>
    `<pre data-artefakt="${name}" class="mono" style="margin:0;padding:14px 20px;background:var(--raster);border-left:6px solid ${linie};font-size:var(--s-min);line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere">${zeilen.map(esc).join('\n')}</pre>`;
  F.push({
    id: 'J6',
    teil: 'jonas',
    auftrag: '1C',
    titel: 'Was die Vorschau zeigt, kommt an',
    inhalt: flaeche(
      frage('Bekommt die Runtime genau das, was die Lehrperson in der Vorschau sieht?', '1C') +
        zweiSpalten(
          liste([
            'Kontext aus dem App-Zustand, gegen Schemas geprüft, gepackt',
            `Vorschau = Nutzlast: Hash ${mono(nl.hashVorschau.slice(0, 8))}, Nachricht byte-gleich`,
            'Nur mit gültigem Host-Token; Token und Budget bleiben auf dem Server',
          ]),
          zahl({
            wert: z.valMs,
            einheit: 'ms',
            was: `Validierung = ${z.valP} % eines warmen Aufbaus`,
            gruppe: 'Laptop, Test-Runtime, älterer Stand',
            linie: 'var(--petrol)',
            gross: 64,
          }),
          780,
        ) +
        `<p class="vermerk" style="margin:var(--abstand-gruppe) 0 8px">Echte Nutzlast an die Runtime, Ausschnitt (synthetische Referenzfixture, erster Messlauf des Nachlaufs)</p>` +
        artefakt('nutzlast', ['{…', ...nl.zeilen, '…}'], 'var(--petrol)'),
    ),
    notiz: privat('J6.notiz', { z }),
    zeitS: 55,
    kurzfassung: true,
    quelle: `${qNutzlast}; ${q1C('validierungMs')}; Berechtigung: routers/qa.ts, 1C/1C-diagrams.md · def56700`,
    station: 'kontext',
  });

  // ------------------------------------------------------------ J7
  const qBreite = Math.round(c.q.wert * 1000) / 10;
  F.push({
    id: 'J7',
    teil: 'jonas',
    auftrag: '1C',
    titel: 'Sicher geschätzt, aber Platz verschenkt',
    inhalt: flaeche(
      frage('Wie viel vom Kontextfenster nutzt der Kontext wirklich?', '1C') +
        liste([
          'Das Budget zählt jedes UTF-8-Byte als ein Token: in keinem Lauf lief das Fenster über',
          'Echte Tokens sind nur ein Bruchteil davon; der Template-Anteil ist nicht budgetiert',
        ]) +
        `<div data-ab="1" style="margin:14px 0 10px;display:flex;align-items:baseline;gap:24px">` +
        `<span class="kennzahl" style="font-size:72px;line-height:1.05">q = ${z.q}</span>` +
        `<span style="font-size:28px">echte / geschätzte Tokens, Median</span>` +
        `<span class="vermerk" style="margin:0">1C-Nachlauf, Laptop</span></div>` +
        `<div role="img" aria-label="Balken: echte Tokens als Anteil der Schätzung" style="position:relative;flex:none;height:40px;border:var(--linie-min) solid var(--petrol);border-radius:6px;background:var(--grund)">` +
        // Vorhersage, dann Beleg (Leitfaden „Wow ohne Gimmick“ 1): erst das ganze Budget, dann der genutzte Teil
        `<div data-ab="1" style="position:absolute;left:0;top:0;bottom:0;width:${qBreite}%;background:var(--petrol)"></div>` +
        `<span data-ab="1" style="position:absolute;left:14px;top:4px;font-size:var(--s-min);font-weight:600;color:var(--grund)">echte Tokens</span>` +
        `<span style="position:absolute;right:14px;top:4px;font-size:var(--s-min);color:var(--text-2)">geschätzt = ganzes Budget; rund zwei Drittel bleiben ungenutzt</span></div>` +
        `<p class="vermerk" style="margin:var(--abstand-gruppe) 0 8px">Zugleich meldet dieselbe Nutzlast, wörtlich (umbrochen):</p>` +
        artefakt('budget', [nl.budgetZeile.replace(/,"/g, ',\n "')], 'var(--petrol)') +
        `<p class="sekundaer" style="margin-top:20px">Empfohlen: genauere Zählung prüfen (#17), nicht umgesetzt</p>`,
    ),
    notiz: privat('J7.notiz', { z }),
    zeitS: 45,
    aufbau: 1,
    kurzfassung: false,
    quelle: `${q1C('q')}; Meldung: ${qNutzlast}`,
    station: 'kontext',
  });

  // ------------------------------------------------------------ J8
  const draht =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 380" width="680" height="380" role="img" aria-label="Messpunkte t0 bis t3 am app-host und am llm-host">` +
    `<line x1="110" y1="50" x2="110" y2="370" style="stroke:var(--blau);stroke-width:4"/>` +
    `<line x1="520" y1="50" x2="520" y2="370" style="stroke:var(--bernstein);stroke-width:4"/>` +
    `<text x="110" y="34" text-anchor="middle" style="font:700 26px var(--f-text);fill:var(--tinte)">app-host</text>` +
    `<text x="520" y="34" text-anchor="middle" style="font:700 26px var(--f-text);fill:var(--tinte)">llm-host</text>` +
    `<line x1="110" y1="80" x2="510" y2="120" style="stroke:var(--tinte);stroke-width:3"/>` +
    `<path d="M510,120 l-16,-9 l2,16 z" style="fill:var(--tinte)"/>` +
    `<rect x="508" y="130" width="24" height="170" rx="4" style="fill:var(--bernstein)"/>` +
    `<text x="548" y="222" style="font:600 24px var(--f-text);fill:var(--bernstein-text)">Inferenz</text>` +
    `<line x1="520" y1="310" x2="120" y2="350" style="stroke:var(--tinte);stroke-width:3"/>` +
    `<path d="M120,350 l16,-11 l1,16 z" style="fill:var(--tinte)"/>` +
    [
      [110, 80, 0, 'end'],
      [520, 120, 1, 'start'],
      [520, 310, 2, 'start'],
      [110, 350, 3, 'end'],
    ]
      .map(
        ([x, y, i, anker]) =>
          `<circle cx="${x}" cy="${y}" r="9" style="fill:var(--bernstein)"/>` +
          `<text x="${anker === 'end' ? x - 20 : x + 20}" y="${y + 9}" text-anchor="${anker}" style="font:600 28px var(--f-mono);fill:var(--bernstein-text)">t<tspan dx="-2" dy="6" style="font-size:22px">${i}</tspan></text>`,
      )
      .join('') +
    `</svg>`;
  F.push({
    id: 'J8',
    teil: 'jonas',
    auftrag: '1B',
    titel: 'Gemessen am Draht, auf beiden Hosts',
    inhalt: flaeche(
      frage('Wie trennt man Netz und Inferenz, ohne Produktionscode zu ändern?', '1B') +
        `<div style="display:grid;grid-template-columns:680px 1fr;column-gap:40px">` +
        `<div>${draht}</div><div>` +
        `<p class="sekundaer" style="margin:0 0 12px;color:var(--tinte)">Mitschnitt auf beiden Hosts plus ${mono('timings')}; jede Dauer von einer Uhr; Messunsicherheit der Uhren ≈ ±${fw.netzAufloesungMs} ms. Netz summiert über <span class="nowrap">GET /slots und POST</span>.</p>` +
        `<p class="mono" style="margin:0 0 18px;font-size:28px;font-weight:600">Netz = (${t(3)} − ${t(0)}) − (${t(2)} − ${t(1)})</p>` +
        `<div style="border-left:6px solid var(--bernstein);padding-left:20px;font-size:24px;line-height:1.45">` +
        `<div style="font-weight:700">Unser Auftrag (Nr. ${au.nr})</div>` +
        `<div class="mono">Klick&nbsp;&nbsp;&nbsp;${uhr(au.requestedAt)} UTC</div>` +
        `<div class="mono">Fertig&nbsp;&nbsp;${uhr(au.finishedAt)} UTC</div>` +
        `<div class="mono">Netz &lt; ${fw.netzAufloesungMs} ms · Inferenz ${z.auInfer} s</div>` +
        `<div style="font-size:22px;line-height:1.3;margin-top:4px;color:var(--text-2)">Wartezeit am Client ${z.auWarte} s, T_job ${z.auJob} s</div>` +
        `<div style="font-size:22px;line-height:1.3;margin-top:2px;color:var(--text-2)">Server ohne Inferenz ${fmt(au.serverOhneInferenzMs)} ms, Ausreißer wie Auftrag 3</div></div>` +
        `<p class="vermerk" style="margin-top:16px">Alle ${n}, Median: Netz ${z.netz} ms, Transport ${z.transport} ms</p>` +
        `</div></div>`,
    ),
    notiz: privat('J8.notiz', { au, n, z, fmt }),
    zeitS: 40,
    kurzfassung: false,
    quelle: `${q1B} (Auftrag ${au.nr}: treiber.auftraege, zerlegung.auftraege)`,
    station: 'netz',
    // Wegkarte (wegkarte.mjs MARKEN): Draht auf beiden Hosts, beide Übergänge im Saum
    marke: 'auftrag-netz',
  });

  // ------------------------------------------------------------ J9
  F.push({
    id: 'J9',
    teil: 'jonas',
    auftrag: '1B',
    titel: 'Die Zeit steckt in der Inferenz',
    inhalt: flaeche(
      frage('Wie verteilt sich die Zeit eines Auftrags?', '1B') +
        grafikBox(zeitzerlegungSvg(b, { stufen: true })),
    ),
    notiz: privat('J9.notiz', { fw, z, daten }),
    zeitS: 50,
    kurzfassung: true,
    // Vorhersage, dann Beleg (Leitfaden D18–D20): Schwellen, dann kleine Werte, dann die Inferenz.
    aufbau: 2,
    quelle: `${q1B}; Kalt: ${q1BN}`,
    station: 'inferenz',
    // Wegkarte: Zeitzerlegung des ganzen Auftrags, Saum über den ganzen Weg, Punkt an der Inferenz
    marke: 'auftrag-zeit',
  });

  // ------------------------------------------------------------ J10
  F.push({
    id: 'J10',
    teil: 'jonas',
    auftrag: '1B',
    titel: `Das Netz ist ${fmt(daten.abgeleitet.feldNetzMm, 1)} mm auf ${fmt(daten.abgeleitet.feldM)} m`,
    inhalt: flaeche(
      frage('Wie groß ist das Netz im Verhältnis zum ganzen Auftrag?', '1B') +
        grafikBox(fussballfeldSvg(b, { zoom: 1 })),
    ),
    notiz: privat('J10.notiz', { fmt, daten }),
    zeitS: 30,
    kurzfassung: true,
    quelle: `${q1B}; Maßstab: T_job warm (n = ${nWarm}), Netz und Transport Median über alle ${n}`,
    station: 'inferenz',
  });

  // ------------------------------------------------------------ J12
  F.push({
    id: 'J12',
    teil: 'jonas',
    auftrag: '1C',
    titel: 'Nachprüfung: wenig Zeit, unter Voting riskant',
    inhalt: flaeche(
      frage('Was, wenn sich die Daten ändern, während das Modell rechnet?', '1C') +
        `<div style="flex:none">${abstimmungSvg({ auftrag: au })}</div>` +
        `<p class="vermerk" style="margin:0 0 var(--abstand-gruppe)">Schema: Zeiten aus Auftrag ${au.nr} (1B); die Stimme ist gedacht, der Verwurf ist durch E7 und E8 belegt</p>` +
        `<div style="display:grid;grid-template-columns:330px 1fr;column-gap:56px;align-items:start">` +
        zahl({
          wert: z.nachpr,
          einheit: '%',
          was: 'Zeitanteil der Nachprüfung',
          gruppe: '1C-Nachlauf, Laptop',
          linie: 'var(--petrol)',
          gross: 56,
        }) +
        liste(
          [
            `<b>Preis unter Voting:</b> wie oft eine Stimme verwirft, ist nicht belastbar gemessen (M7 verfehlt); Regel vorab: unter ${fw.schwelleNachpruefungProzent} % bleibt sie`,
            `<b>Befund Blitzlicht:</b> Runde außer TEMPO, Hash hängt an der Uhrzeit (geprüft: YESNO, ${c.yesno.wert} ohne Datenänderung verworfen); Korrektur empfohlen, nicht umgesetzt (#18)`,
          ],
          24,
        ) +
        `</div>`,
    ),
    notiz: privat('J12.notiz', { au, z }),
    zeitS: 60,
    aufbau: 2,
    kurzfassung: false,
    quelle: `Nachlauf N3, N5 · Laptop (ThinkPad P50) · def56700; ADR 1C-017 · Laptop und PC · 9f230abc; E7, E8: evidenz/1C/2026-10-24-teil2.md · Laptop · 248029dc (Test-Runtime)`,
    station: 'nachpruefung',
  });

  // ------------------------------------------------------------ J13
  const aussagen = a.ausgabe.split('\n');
  const gekuerzt = [aussagen[0], '[…]'];
  const nb = daten.nachbau;
  // Nachbau als Karte der App (Kopfzeile mit der Überschrift aus dem Template, Rundung und Schatten
  // wie eine Material-Karte). Der Clip ersetzt im Deck genau diesen Block samt Vermerk „Nachbau,
  // keine Bildschirmaufnahme“, damit eine echte Aufnahme nie so beschriftet wird (deck.mjs).
  const nachbau =
    `<div data-nachbau="j13" style="display:flex;flex-direction:column;width:480px">` +
    `<div style="flex:none;border:var(--linie-min) solid var(--linie);border-radius:14px;background:var(--grund);box-shadow:0 2px 4px rgb(22 32 44 / 0.12), 0 8px 24px rgb(22 32 44 / 0.10);overflow:hidden;font-size:22px;line-height:1.3">` +
    `<p style="margin:0;padding:12px 18px;background:var(--raster);font-weight:700;font-size:24px">${esc(nb.titel)}</p>` +
    `<div style="padding:12px 18px 14px">` +
    `<ul style="margin:0 0 10px;padding-left:24px">${nb.fragen.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` +
    `<p style="margin:0 0 2px;font-weight:700">Hinweise</p>` +
    `<p style="margin:0;color:var(--text-2)">${esc(nb.hinweis)}</p>` +
    `</div></div>` +
    `<p class="vermerk"><span style="display:inline-block;padding:0 10px;border:var(--linie-min) solid var(--linie);border-radius:999px;color:var(--text-2);font-weight:600">Nachbau, keine Bildschirmaufnahme</span></p>` +
    `<p class="vermerk" style="margin-top:4px">Den Grund erfährt die Lehrperson nicht</p>` +
    `</div><!--/nachbau-->`;
  F.push({
    id: 'J13',
    teil: 'jonas',
    auftrag: 'beide',
    titel: `${daten.abgeleitet.gateBeobachtet} geprüfte Antworten, keine besteht das Gate`,
    inhalt: flaeche(
      frage('Warum kommt keine Modellantwort an?', 'beide') +
        `<div style="display:grid;grid-template-columns:1fr auto;column-gap:56px">` +
        `<div>` +
        `<p class="vermerk" style="margin:0 0 8px">Echte Antwort des Modells auf Auftrag ${a.auftrag}, gekürzt, im Original</p>` +
        `<blockquote data-artefakt="antwort" lang="en" style="margin:0 0 12px;padding:10px 20px;border-left:6px solid var(--bernstein);background:var(--bernstein-hell);font-size:22px;line-height:1.3">` +
        gekuerzt.map((s) => `<p style="margin:0 0 4px">${esc(s)}</p>`).join('') +
        `</blockquote>` +
        `<div style="border:var(--linie-min) solid var(--rot);border-radius:8px;padding:8px 18px;margin-bottom:18px">` +
        `<span class="ablehnung" style="font-weight:800;font-size:22px">Verworfen.</span> ` +
        `<span style="font-size:22px">${esc(a.grund)}</span></div>` +
        // Ein Feld je geprüfter Antwort (Stufe 0 Umrisse, Stufe 1 rot), darunter die Kennzahl (Stufe 1).
        `<div data-gate-raster style="flex:none">${gateRasterSvg({ n1B: b.verworfen, n1C: c.gateAntwortenGesamt.wert })}</div>` +
        `<div data-ab="1" style="display:flex;align-items:baseline;gap:22px;margin-top:6px;white-space:nowrap">` +
        `<span class="kennzahl ablehnung" style="font-size:56px;line-height:1">0 / ${daten.abgeleitet.gateBeobachtet}</span>` +
        `<span style="font-size:28px;font-weight:600">bestehen das Gate</span>` +
        `<span style="font-size:22px;color:var(--text-2)">1B ${b.verworfen} von ${n} verworfen</span></div>` +
        // Befund der Offline-Ablation (Nachtrag zu ADR 1C-018) unter der Kennzahl (Stufe 2).
        `<p data-ab="2" style="margin:12px 0 0;font-size:24px;line-height:1.35"><b>Ablation:</b> Neue Antworten verletzen nur Formregeln (${c.ablationNeuEnglisch.wert} englisch); alte hätte das Gate auch verworfen (${c.ablationAltMeta.wert} mit internen Status).</p>` +
        `<p data-ab="2" class="sekundaer" style="margin-top:8px">${mono('12f1d8e4')} änderte Instruktion und Gate, ${mono('a998ada0')} prüft auch uncertain.</p>` +
        `</div>` +
        `<figure data-clip="jonas-gate-clip.webm" style="margin:0;display:flex;flex-direction:column">` +
        nachbau +
        `</figure></div>` +
        // Geltung als einzeiliger Beleg; die Upstream-Commits stehen in Notiz und quelle.
        `<p class="beleg">Geltung: ein Modell, eine Fixture, Code nach v1.4.0. Vor v1.4.0 (Instruktion v2, ohne Gate): ${c.fullContextVorGate.wert} mit Modellzusammenfassung</p>`,
    ),
    notiz: privat('J13.notiz', { b, c, daten }),
    zeitS: 70,
    kurzfassung: true,
    // Stufen vor dem Clip (deck.js: Aufbau vor Clip): Raster rot, dann Ablation; der nächste Druck startet den Clip.
    aufbau: 2,
    quelle: `${qAntwort}; Lauf 1B · ThinkPad P50 · ${H.hauptlauf.commit.slice(0, 8)} (Code a19ca70f); Nachlauf · Laptop · def56700; ADR 1C-018 · 9f230abc; Gate-Ablation: evidenz/1C/2026-11-16-gate-ablation.md · Laptop, offline · def56700 und 9f230abc; Upstream-Commits 12f1d8e4, a998ada0; ${daten.clip ? `Clip: ${daten.clip.quelle}, ${daten.clip.datum}; Hinweis qaSummaryExtractive.ts` : `Nachbau: Nutzlast labor.quiet.runs[${nl.lauf}], Hinweis qaSummaryExtractive.ts`}`,
    station: 'gate',
  });

  // ------------------------------------------------------------ J15
  const folge = (was, text) =>
    `<li style="margin:0 0 10px"><b style="font-weight:600">${was}</b> <span style="color:var(--text-2)">${text}</span></li>`;
  const spalte = (auftrag, linie, kopf, punkte) =>
    `<div style="border-left:6px solid ${linie};padding-left:18px">` +
    `<p style="margin:0 0 6px">${etikett(auftrag)} <span style="color:var(--gedaempft)">${kopf}</span></p>` +
    `<ul style="margin:0;padding:0;list-style:none">${punkte.join('')}</ul></div>`;
  // Entscheidungen je Auftrag mit Kosten, Risiko, Betriebsfolge: im Detail auf R12, J15 verweist darauf.
  const entscheidungen =
    `<div style="display:grid;grid-template-columns:880px 1fr;column-gap:50px;font-size:24px;line-height:1.35">` +
    spalte(
      '1C',
      'var(--petrol)',
      'Kosten, Risiko, Betrieb; Änderungen empfohlen, nicht umgesetzt',
      [
        folge(
          'Bleibt (1C-010 bis 1C-013):',
          'wenig Zeit; Risiko: unter Voting verwirft jede Stimme während der Inferenz die Antwort, Häufigkeit offen (1C-017)',
        ),
        folge(
          'Gate (1C-018):',
          'Abnahmemessung nötig; Risiko: lockere Schwelle zeigt Metaaussagen',
        ),
        folge('Timeout (1C-023):', 'eine Kalibrierung je Host; Slot länger belegt'),
        folge(
          'Cache (1C-024):',
          'eine Zeile im Entry-Point; Risiko: nur ein Slot und ein Auftragstyp gemessen',
        ),
        folge('Zählung (1C-014):', 'Änderung am Packer; Risiko: Fenster läuft über'),
        folge(
          'Snapshot, Blitzlicht (1C-015, 1C-016):',
          'klein; Risiko: Fenster beschreibt die Rundenlaufzeit nicht mehr',
        ),
      ],
    ) +
    spalte('1B', 'var(--bernstein)', 'Konfiguration', [
      folge('Topologie bleibt:', 'Hebel am Inferenz-Host'),
      folge('Aufwand der zweiten Rolle:', 'Niklas'),
      folge('Logs (#19, #20):', 'Kosten: Logzeilen; empfohlen, nicht umgesetzt'),
      folge('Vorher:', 'Gate passend zum Modell (#13)'),
    ]) +
    `</div>`;
  // Drei Spalten statt Textwand (Audit): was bleibt, was empfohlen ist, was offen ist; eine Frage.
  const triple = (kopf, farbe, punkte) =>
    `<div style="border-top:6px solid ${farbe};padding-top:12px">` +
    `<p style="margin:0 0 12px;font-weight:700;font-size:30px;color:${farbe}">${kopf}</p>` +
    `<ul style="margin:0;padding-left:28px;font-size:28px;line-height:1.38">${punkte.map((p) => `<li style="margin:0 0 12px">${p}</li>`).join('')}</ul></div>`;
  F.push({
    id: 'J15',
    teil: 'jonas',
    auftrag: 'beide',
    titel: 'Entkopplung bleibt, Gate neu abstimmen',
    inhalt: flaeche(
      frage('Was bleibt, und was sollte sich ändern?', 'beide') +
        `<div style="display:grid;grid-template-columns:repeat(3,1fr);column-gap:44px">` +
        triple('Bleibt', 'var(--petrol)', [
          `${etikett('1C')} Entkopplung über die Queue, Nachprüfung, Validierung, Vorschau = Nutzlast`,
          `${etikett('1B')} Topologie mit zweitem Host: kostet keine relevante Zeit`,
        ]) +
        triple('Empfohlen, nicht umgesetzt', 'var(--blau)', [
          'Instruktion, Grammatik und Gate gemeinsam abstimmen',
          'Timeout je <span class="nowrap">Inferenz-Host</span> kalibrieren, <span class="nowrap">Prompt-Cache</span> begrenzen',
          'Gründe und Zeiten loggen',
        ]) +
        triple('Offen', 'var(--bernstein-text)', [
          'Wie oft eine Stimme unter Voting die Antwort verwirft',
          'Sprache und Inhalt der Antworten prüft niemand',
        ]) +
        `</div>` +
        `<p class="vermerk">Details: R12 (Kosten, Risiko und Betriebsfolge je Entscheidung)</p>` +
        `<p data-ab="1" class="merksatz"><b>Zur Diskussion:</b> Prüft das Gate das Richtige, wenn die Antworten auch inhaltlich verfehlt sind?</p>` +
        `<p data-ab="2" class="uebergabe">Und wenn der zweite Host langsam ist oder ausfällt? <span class="uebergabe-ziel">→ Niklas ${etikett('1B')}</span></p>`,
    ),
    notiz: privat('J15.notiz', {}),
    zeitS: 45,
    kurzfassung: true,
    // Erst die Entscheidungen, dann die Diskussionsfrage, zuletzt die Übergabe an Niklas.
    aufbau: 2,
    quelle: `1C/1C-ergebnis.md, Abschnitt 5, ADRs 1C-010 bis 1C-024, Abschnitt Folgen (Laptop und PC · 9f230abc; Laptop · def56700); 1B/1B-ergebnis.md, Entscheidung (${rechnerKurz(H.hauptlauf.rechner)} · ${H.hauptlauf.commit.slice(0, 8)})`,
    station: null,
  });

  // ------------------------------------------------------------ G9 Rahmen (gemeinsames Fazit, spricht Niklas)
  // Ein Satz je Person, dann die gemeinsame Antwort auf die Leitfrage. 1B Schritte 3–4 aus Niklas' gewerteten
  // Reihen vom 15./16.11. (abgabe/bau/folien-1b34.mjs, M1–M4); die Überschrift ist nur so stark wie die
  // Belege: Zeitkosten der Trennung (Jonas) und keine Live-Fehler unter Störung (Niklas). Kein Tempovorteil
  // des zweiten Hosts: S1 ist gemischt, ADR 1B-020 begründet die Rolle betrieblich.
  const person = (kopf, farbe, saetze) =>
    `<div style="border-top:6px solid ${farbe};padding-top:14px">` +
    `<p style="margin:0 0 8px;font-weight:700;font-size:28px">${kopf}</p>` +
    saetze.map((x) => `<p style="margin:0 0 10px">${x}</p>`).join('') +
    `</div>`;
  F.push({
    id: 'G9',
    teil: 'rahmen',
    auftrag: null,
    titel: 'Zweiter Host: kaum Zeitkosten, keine Live-Fehler',
    inhalt: flaeche(
      `<p data-leitfrage class="sekundaer" style="margin:0 0 var(--abstand-gruppe)"><b>Leitfrage:</b> ${LEITFRAGE}</p>` +
        `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:56px;font-size:24px;line-height:1.38">` +
        person(`Jonas ${etikett('1C')} ${etikett('1B', '1–2')}`, 'var(--petrol)', [
          `${etikett('1C')} Vertrag, Konsistenz und Entkopplung halten, mit benannten Ausnahmen (T2.3, T3.1). Nach v1.4.0 besteht keine der ${daten.abgeleitet.gateBeobachtet} geprüften Modellantworten das Gate (1B ${b.verworfen}, 1C ${c.gateAntwortenGesamt.wert}; ein Modell, eine Fixture); davor (${mono('9f230abc')}, Instruktion v2, ohne Gate) ${c.fullContextVorGate.wert}.`,
          `${etikett('1B')} Der zweite Host kostet keine relevante Zeit; die Zeit steckt in der Inferenz.`,
        ]) +
        person(`Niklas ${etikett('1A')} ${etikett('1B', '3–4')}`, 'var(--blau)', [
          `${etikett('1A')} Der App-Host trägt die Live-Last fehlerfrei. Die spaCy-Glättung bekommt keine Freigabe: Die vorab festgelegte Regel hält nicht, der Nutzen ist ungemessen.`,
          `${etikett('1B')} Fällt die Inferenz aus oder schweigt sie, kommt der Ersatz, und keine Live-Aktion scheitert. Latenzneutral ist das nicht, und Hänger dämpft der Breaker nicht; den zweiten Host empfiehlt ADR 1B-020 nur betrieblich zu begründen, nicht mit Tempo.`,
        ]) +
        `</div>` +
        `<p class="merksatz" data-ab="1"><b>Gemeinsam:</b> Im Labor kostet die Trennung kaum Zeit, und Störungen der Inferenz werden nicht zu Live-Fehlern. Die Grenzen liegen in der Inferenz selbst, in optionaler Arbeit ohne Nutzenbeleg und im nur qualitativ bewerteten Betriebsaufwand.</p>`,
    ),
    notiz: privat('G9.notiz', {}),
    stichpunkte: privat('G9.stichpunkte', {}),
    zeitS: 45,
    aufbau: 1,
    // Gehört zu Niklas' Kurzfassung: das Fazit fällt nie weg (Sprungplan Niklas).
    kurzfassung: true,
    sprecher: 'niklas',
    quelle:
      '1B/1B-ergebnis.md, 1C/1C-ergebnis.md (Kurzantwort, Verlauf 9f230abc); 1A: abgabe/bau/folien-1a.mjs (N1, N10); 1B Schritte 3–4: abgabe/bau/folien-1b34.mjs (M1–M4), evidenz/1B/messung/2026-11-1{5,6}-lauf-*.json.gz und Breaker-Folgen (i7-10700K, Hyper-V · 5e758d0a, 2b39b9df, 7c64dd6a, 4b135fe8), adr/1B-020-zweite-rolle-betrieblich-begruenden.md',
    station: null,
  });

  // ------------------------------------------------------------ GN Nachweisumfang (spricht Jonas)
  // Seit der Durchsicht 2026-11-18 vor dem Dank statt in der Reserve (R17) und statt des Bands auf GD: Kennzahlen
  // und Rechnerzeit je Auftrag oben, darunter gerafft Tests je Werkzeug und Hypothesen je Auftrag. Alle Werte
  // unverändert aus nachweisumfang.md (Zusätze in Klammern nur dort), keine Summen, keine Wertung.
  const nwGN = daten.nachweis;
  const nwKacheln = (kopf, namen) =>
    `<div class="nw-kacheln"><p class="nw-kopf">${esc(kopf)}</p><dl>` +
    namen
      .map(([name, was = name]) => {
        const wert = String(nwGN.zeilen[name]).replace(/ \(.+\)$/, '');
        return `<div><dt>${esc(was)}</dt><dd>${esc(wert)}</dd></div>`;
      })
      .join('') +
    `</dl></div>`;
  F.push({
    id: 'GN',
    teil: 'rahmen',
    // Belege beider Personen, gesprochen von Jonas: steht in beiden Druckauszügen
    gemeinsam: true,
    auftrag: null,
    titel: 'Nachweisumfang: Rechnerzeit, Tests, Hypothesen',
    inhalt: flaeche(
      frage('Wie viel Messung und Prüfung steckt in den Belegen?', ['1A', '1B', '1C']) +
        nachweisLeiste(nwGN) +
        `<div class="nw-gerafft">` +
        nwKacheln('Automatisierte Tests je Werkzeug', [
          ['1A Lastwerkzeuge'],
          ['Messwerkzeuge 1B/1C'],
          ['Pester 1B (Windows)'],
          ['Backend 1C'],
        ]) +
        nwKacheln('Vorab festgelegte Hypothesen je Auftrag', [
          ['1A (Experimentvertrag)', '1A Vertrag'],
          ['1B Schritte 1–2', '1B 1–2'],
          ['1B Schritte 3–4', '1B 3–4'],
          ['1C Einzeltests E', '1C E'],
          ['1C Messungen M', '1C M'],
          ['1C Labor L', '1C L'],
          ['1C Nachlauf N', '1C N'],
          ['1C Gate-Ablation H_A', '1C H_A'],
        ]) +
        `</div>` +
        `<p class="vermerk" style="margin-top:20px">Rechnerzeit, keine Arbeitszeit · Tests statisch gezählt, ohne die Tests dieses Decks · ADRs: ${esc(nwGN.zeilen.ADRs)}</p>`,
    ),
    notiz: privat('GN.notiz', { gesprochenDauer, nw: nwGN, gesprochenZeitraum }),
    zeitS: 20,
    kurzfassung: false,
    sprecher: 'jonas',
    quelle: `${NACHWEIS}, alle Tabellen, Stand ${daten.nachweis.commit} (nachgerechnet von abgabe/bau/nachweisumfang.mjs auf dem Checkout); Rechner je Lauf: 1C Laptop (ThinkPad P50) und PC (i7-8700), 1B Schritte 1–2 Laptop, 1A und 1B Schritte 3–4 wie in den Protokollen unter evidenz/1A und evidenz/1B`,
    station: null,
  });

  // ------------------------------------------------------------ GD Dank und Fragen (spricht Niklas)
  // Bleibt während der Befragung stehen (Leitfaden E23); Link und QR-Code führen zu allen Belegen.
  const url = REPO_URL.replace(/^https:\/\//, '');
  F.push({
    id: 'GD',
    teil: 'rahmen',
    auftrag: null,
    titel: 'Danke. Wir freuen uns auf Ihre Fragen.',
    inhalt: flaeche(
      `<div class="dank">` +
        `<div class="dank-text">` +
        `<p class="dank-kopf">Alle Belege zum Nachprüfen</p>` +
        `<p class="dank-was">Entscheidungen als ADR, Laufprotokolle, Messdaten und der Bau dieses Decks</p>` +
        `<p class="dank-fork">Gemeinsam entwickelt im Fork von Niklas Schneider; der Fork von Jonas Weirauch ist auf denselben Stand synchronisiert.</p>` +
        `<p class="dank-url mono"><a href="${REPO_URL}">${url.replace('/tree/', '/<wbr>tree/').replace('/docs/', '/<wbr>docs/')}</a></p>` +
        `<p class="dank-namen">Niklas Schneider · Jonas Weirauch</p>` +
        `</div>` +
        `<figure class="dank-qr">${qrSvg(REPO_URL)}<figcaption class="vermerk">Repository, Ordner docs/referat-thema-1</figcaption></figure>` +
        `</div>`,
    ),
    notiz: privat('GD.notiz', {}),
    stichpunkte: privat('GD.stichpunkte', {}),
    zeitS: 15,
    kurzfassung: true,
    sprecher: 'niklas',
    quelle: `${REPO_URL} (Fork, main nach dem Merge); Eintrag weirauch2026c in literatur.mjs; Nachweisumfang auf GN`,
    station: null,
    // Link als Text erlaubt wie im Literaturverzeichnis (deck.mjs setzt die Quellen-Marken).
    quellenverzeichnis: true,
  });

  // ------------------------------------------------------------ J16, J16b Literaturverzeichnis (ZL S. 2–3)
  // Nach GD als Anhang (deck.mjs: anhang), damit es keine Übergabe unterbricht. Seit der Durchsicht 2026-11-18
  // ein gemeinsames Verzeichnis für das ganze Deck auf zwei Folien, alphabetisch fortlaufend; `gemeinsam` hält
  // beide Folien in beiden Druckauszügen (folien-jonas.pdf, folien-niklas.pdf).
  const haelfte = Math.ceil(LITERATUR.length / 2);
  [
    ['J16', LITERATUR.slice(0, haelfte), 1],
    ['J16b', LITERATUR.slice(haelfte), 2],
  ].forEach(([id, eintraege, teilNr]) =>
    F.push({
      id,
      teil: 'jonas',
      anhang: true,
      gemeinsam: true,
      auftrag: 'beide',
      titel: `Literaturverzeichnis (${teilNr}/2)`,
      inhalt: flaeche(
        `<!--quellen--><ul data-literatur style="margin:0;padding:0;list-style:none;font-size:20px;line-height:1.3">` +
          eintraege
            .map(
              (e) =>
                `<li style="break-inside:avoid;margin:0 0 12px;padding-left:28px;text-indent:-28px;overflow-wrap:anywhere">${e.voll}</li>`,
            )
            .join('') +
          `</ul><!--/quellen-->`,
      ),
      notiz: privat(`${id}.notiz`, {}),
      zeitS: teilNr === 1 ? 3 : 2,
      kurzfassung: false,
      quelle:
        'literatur.mjs (gemeinsames Verzeichnis), abgeglichen mit main.bib beider Handouts (PaperLab)',
      fuss: 'Kurzbelege auf den Folien nach IU-Zitierleitfaden; Einträge wie in den Handouts',
      station: null,
    }),
  );

  // ------------------------------------------------------------ Reserve
  const reserve = (id, auftrag, titel, inhalt, notiz, quelle) =>
    F.push({
      id,
      teil: 'reserve',
      auftrag,
      titel,
      inhalt: flaeche(inhalt),
      notiz,
      zeitS: 0,
      kurzfassung: false,
      quelle,
      station: null,
    });

  // Aus der Reserve in den Hauptteil geholt (Redezeit 15 min je Person, Absprache 2026-11-16).
  const haupt = (id, auftrag, titel, inhalt, notiz, quelle, extra) =>
    F.push({
      id,
      teil: 'jonas',
      auftrag,
      titel,
      inhalt: flaeche(inhalt),
      notiz,
      kurzfassung: false,
      quelle,
      station: null,
      ...extra,
    });

  reserve(
    'R1',
    '1C',
    'Reserve: Kalibrierung des Timeouts',
    frage('Warum liefen die Labore mit 300 s statt 90 s?', '1C') +
      zweiSpalten(
        liste(
          [
            `Je Rechner eine Anfrage mit echtem Body, I = ${mono('prompt_ms')} + ${mono('predicted_ms')}`,
            `${etikett('1C')} Laptop: ${fw.kalibrierungLaptopS} s (Prefill ${fw.kalibrierungLaptopPrefillS} s, Ausgabe ${fw.kalibrierungLaptopAusgabeS} s), daher ${fw.laborTimeoutS} s für die Laborläufe am Laptop`,
            `${etikett('1C')} PC, zweiter Rechner: I = ${z.kalPc} s, ebenfalls über ${fw.releaseTimeoutS} s, also ${fw.laborTimeoutS} s`,
            `${etikett('1B')} I = ${fw.kalibrierung1BS} s, nach der Regel aus ADR 1B-005 ebenfalls ${fw.laborTimeout1BS} s`,
            `Ab Werk v1.4.0 ${fw.releaseTimeoutS} s (v1.3.0: ${fw.v13TimeoutS} s); ${fw.laborTimeoutS} s ist die Obergrenze des Produkts, offen als Abweichung`,
          ],
          24,
        ),
        zahl({
          wert: fw.kalibrierungLaptopS,
          einheit: 's',
          was: 'Kalibrierung Laptop (1C)',
          gruppe: 'Laptop · Wandzeit, vor dem ersten Laborlauf',
          linie: 'var(--petrol)',
        }),
        820,
      ),
    privat('R1.notiz', { fw, z }),
    `adr/1C-020-timeout-300-s-und-kalibrierungsregel.md (Laptop; PC · 9f230abc); evidenz/1B/2026-11-13-lauf.md, Kalibrierung (ThinkPad P50 · 3b2aa5e6)`,
  );

  haupt(
    'J8b',
    '1B',
    'Strecke und lokal: kein Unterschied messbar',
    frage('Ist die Strecke zwischen den Hosts langsamer als ein Aufruf im selben Host?', '1B') +
      zweiSpalten(
        liste([
          'Dieselbe kurze Anfrage einmal vom app-host und einmal vom llm-host an sich selbst',
          'Verglichen werden die Mediane beider Seiten',
          `Schwelle vorab: Differenz ≤ ${fw.schwelleC0Ms} ms, erfüllt: kein Unterschied nachweisbar`,
        ]),
        zahl({
          wert: z.c0,
          einheit: 'ms',
          was: 'Differenz der Mediane',
          gruppe: 'Nachtrag M2, Laptop',
          linie: 'var(--bernstein)',
        }),
        760,
      ),
    privat('J8b.notiz', { z, fw }),
    q1BN,
    // Wegkarte: Strecke gegen lokal, beide Übergänge im Saum (wie J8)
    { zeitS: 35, station: 'netz', marke: 'auftrag-netz' },
  );

  haupt(
    'J10b',
    '1B',
    `Runtime gestoppt: Ersatz nach ${z.b0} ms`,
    frage('Was passiert bei gestopptem Runtime-Container?', '1B') +
      zweiSpalten(
        liste([
          `Runtime-Container vor dem Treiber gestoppt (${mono('docker stop')})`,
          `Alle ${b.nB0} Aufträge enden extraktiv mit Grund ${mono('unavailable')}`,
          `Schwelle vorab: Median ≤ ${fw.schwelleB0S} s, erfüllt`,
          'Langsam oder stumm: Niklas, Schritte 3–4',
        ]),
        zahl({
          wert: z.b0,
          einheit: 'ms',
          was: 'T_job, Median',
          gruppe: 'Nachtrag M3, Laptop',
          linie: 'var(--bernstein)',
        }),
        760,
      ),
    privat('J10b.notiz', { b, z, fw }),
    q1BN,
    // Wegkarte: Runtime gestoppt, Stoppzeichen wie Störung F1 auf M1
    { zeitS: 30, station: 'inferenz', marke: 'auftrag-stopp' },
  );

  haupt(
    'J10a',
    '1B',
    `Frisch gestartet: ${z.kaltMedian} s statt ${z.jobWarm} s`,
    frage('Gilt die Aussage auch mit frisch gestarteter Runtime?', '1B') +
      zweiSpalten(
        liste([
          `${b.nKaltLaeufe} Läufe mit je frischer Runtime: Median ${z.kaltMedian} s, Spanne ${z.kaltMin}–${z.kaltMax} s`,
          `Kalter erster Auftrag im gewerteten Lauf: ${z.jobKalt} s`,
          `Zum Vergleich warm: ${z.jobWarm} s (Median warm, n = ${nWarm}; Spanne ${z.warmMin}–${z.warmMax} s, ein Lauf, keine unabhängigen Wiederholungen)`,
          `H_B3 gilt auch kalt in allen ${b.nKaltLaeufe} Läufen (≥ ${fw.schwelleInferenzProzent} %)`,
        ]),
        zahl({
          wert: z.kaltMedian,
          einheit: 's',
          was: 'T_job kalt, Median',
          gruppe: `n = ${b.nKaltLaeufe}, Nachtrag M4, Laptop`,
          linie: 'var(--bernstein)',
        }),
        760,
      ),
    privat('J10a.notiz', { b, z, fw }),
    `${q1BN}; warm und Auftrag 1: ${q1B}`,
    { zeitS: 40, station: 'inferenz' },
  );

  reserve(
    'R5',
    'beide',
    'Reserve: Gültigkeitsgrenzen',
    `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:50px">` +
      `<div><p style="margin:0 0 14px">${etikett('1C')}</p>${liste(
        [
          'Laborrechner mit CPU-Inferenz, ein Slot, Qwen3-4B-Instruct-2507 Q4_K_M; ein Rechner über Loopback',
          'Eine synthetische Fixture, Locale de',
          'Nachlauf auf upstream nur am Laptop',
          'Ein formal korrekter Pfad belegt keine guten Prompts',
          'Keine parallele Last: Aufträge nacheinander, die Leitfrage nennt „reale Last“',
        ],
        22,
      )}</div>` +
      `<div><p style="margin:0 0 14px">${etikett('1B')}</p>${liste(
        [
          'Ein Laptop für beide „Hosts“, die Kerne teilen sich',
          'Virtuelles statt physisches Netz, weniger CPUs als in Produktion',
          'Ein Szenario, ein Modell, eine Reihe',
          `Warm heißt: identische Snapshots, der Prompt kommt aus dem KV-Cache. Bei geändertem Zustand gilt eher der Kaltwert (Median ${z.kaltMedian} s)`,
          `Netz unter der Messunsicherheit der Uhren (≈ ${fw.netzAufloesungMs} ms)`,
          'Privates Netz belegt weder Autorisierung noch Datenschutz; der Token läuft im Klartext über HTTP',
        ],
        22,
      )}</div></div>`,
    privat('R5.notiz', { z }),
    `evidenz/1C/2026-11-09-labor-nachlauf.md (Laptop · def56700); evidenz/1B/2026-11-13-lauf.md (${rechnerKurz(H.hauptlauf.rechner)} · ${H.hauptlauf.commit.slice(0, 8)}); Kaltwert: ${q1BN}`,
  );

  reserve(
    'R6',
    'beide',
    'Reserve: Anteil der KI',
    `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:50px">` +
      `<div><p style="margin:0 0 12px;font-weight:700;font-size:28px">Entschieden und geprüft vom Autor</p>${liste(
        [
          'Hypothesen und Schwellen vor den gewerteten Läufen freigegeben; Ausnahmen: M7b/M7c ohne vorherige Freigabe, T3.1 exploratorisch, 1B-Leitfrage nach dem Lauf bestätigt (ADR 1B-011)',
          'Läufe angestoßen, Wiederholung nach Störung entschieden',
          'Ergebnisse und Protokolle geprüft, Kernzahlen stichprobenartig nachgerechnet',
        ],
        28,
      )}</div>` +
      `<div><p style="margin:0 0 12px;font-weight:700;font-size:28px">Entworfen von der KI</p>${liste(
        [
          'Claude Code, laut Protokollen Claude Opus 5.5 (nicht unabhängig geprüft): Skripte, Tests, Auswertung, Protokolle, Diagramme',
          'Vorschläge für Schwellen und Messmethode, im Design als KI-Vorschlag markiert',
          'Reviews waren KI-Sitzungen, keine menschlichen Gutachten',
        ],
        28,
      )}</div></div>`,
    privat('R6.notiz', {}),
    '1C/1C-eigenanteil.md (Autorenprüfung); adr/1B-011-zeitbegriffe-und-leitfrage.md; 1B/1B-eigenanteil.md (Stand 2026-11-14) · Arbeit an Laptop (ThinkPad P50) und PC (i7-8700) · Baselines 9f230abc, def56700, a19ca70f',
  );

  const adrs = (ids) =>
    ids.map((i) => `<span class="mono" style="white-space:nowrap">${i}</span>`).join(', ');
  reserve(
    'R7',
    '1C',
    'Reserve: ADR-Zählung 1C',
    `<table style="border-collapse:collapse;font-size:28px;width:100%">` +
      `<tr><td style="padding:12px 20px 12px 0;font-weight:700;width:300px">Beibehaltung</td><td>${adrs(['1C-010', '1C-011', '1C-012', '1C-013'])}; dazu ${mono('1C-019')} nur für ${mono('9f230abc')}</td></tr>` +
      `<tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:12px 20px 12px 0;font-weight:700">Empfohlen, nicht umgesetzt</td><td>${adrs(['1C-014', '1C-015', '1C-016', '1C-018', '1C-023', '1C-024'])}</td></tr>` +
      `<tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:12px 20px 12px 0;font-weight:700">Zurückgehalten</td><td>${adrs(['1C-017'])}</td></tr>` +
      `<tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:12px 20px 12px 0;font-weight:700">Methodisch</td><td>${adrs(['1C-001', '1C-002', '1C-003', '1C-004', '1C-005', '1C-020', '1C-021', '1C-022', '1C-025', '1C-026'])}</td></tr>` +
      `</table>` +
      `<p style="margin:24px 0 0;font-size:28px">Das Ergebnis ist eine Empfehlung, kein Patch (ADR 1C-004).</p>`,
    privat('R7.notiz', {}),
    'adr/README.md, Index · Messstände 9f230abc (Laptop und PC) und def56700 (Laptop)',
  );

  const bz = (bereich, quelleFn, schema, pruefung) =>
    `<tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:6px 12px 6px 0;font-weight:600">${bereich}</td>` +
    `<td style="padding:6px 16px 6px 0">${quelleFn}</td><td style="padding:6px 22px 6px 0">${schema}</td><td style="padding:6px 0">${pruefung}</td></tr>`;
  haupt(
    'J5b',
    '1C',
    'Jeder Kontextaufbau prüft die Rechte erneut',
    // Lange Bezeichner in Plex Mono etwas enger (.eng), damit die vier Spalten in die Breite passen.
    frage('Wer darf welchen Teil des Kontexts sehen?', '1C') +
      `<table class="eng" style="border-collapse:collapse;font-size:22px;line-height:1.25;width:100%">` +
      `<tr style="color:var(--gedaempft);text-align:left"><th style="padding:0 12px 6px 0;width:190px;vertical-align:bottom">Bereich (#456)</th><th style="padding:0 0 6px;vertical-align:bottom">Quelle, Funktion</th><th style="padding:0 0 6px;vertical-align:bottom">Schemafassung</th><th style="padding:0 0 6px;vertical-align:bottom">Rechteprüfung</th></tr>` +
      bz(
        'Q&amp;A-Fragen, Stimmen',
        `PostgreSQL, ${mono('collectQaContextCandidates')}`,
        mono('qa-ranking-v1'),
        mono('loadAuthorizedModerationState'),
      ) +
      bz(
        'Semantische Themen',
        `Redis-Snapshot, ${mono('collectQaTopicContext')}`,
        mono('qa-semantic-topic-snapshot-v1'),
        'im Q&amp;A-Aufbau',
      ) +
      bz(
        'Quiz, Blitzlicht, Kompass',
        'PostgreSQL, Redis; Lehrsignale',
        `${mono('effective-vote-v1')}, ${mono('feedback-v1')}`,
        'Prüfungen der Lehrsignale',
      ) +
      bz(
        'Lernziele',
        `PostgreSQL, ${mono('projectLearningContext')}`,
        mono('learning-context-v1'),
        mono('assertLearningSnapshotStillCurrent'),
      ) +
      bz(
        'Zusammensetzung',
        mono('buildModerationPromptContext'),
        mono('moderation-analysis-context-v1'),
        'erste Prüfung',
      ) +
      bz(
        'Vorschau, Auftrag',
        `${mono('qa.summaryContextPreview')}, ${mono('qa.requestSummary')}`,
        mono('qa-summary-context-preview-v1'),
        mono('assertHostSessionAccessFromContext'),
      ) +
      `</table>` +
      `<p style="margin:20px 0 0;font-size:22px">Je Kontextaufbau acht Rechteprüfungen; ohne gültiges Host-Token weder Vorschau noch Auftrag; kein Token im Draht-Body (E2).</p>`,
    privat('J5b.notiz', {}),
    '1C/1C-diagrams.md, #456-Bereiche · Code-Stand def56700 (v1.4.0-14), gelesen am Laptop (ThinkPad P50); E2: evidenz/1C/2026-10-24-teil2.md · Laptop · 248029dc',
    { zeitS: 45, station: 'kontext' },
  );

  reserve(
    'R9',
    '1C',
    'Reserve: 1C Schritte 3–4, Konsistenzfälle',
    `<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:44px">` +
      `<div><p style="margin:0 0 8px;font-weight:700;font-size:28px">Schritt 3</p>${liste(
        [
          'Inkompatible Version: endet an jeder Grenze kontrolliert (T1, E4)',
          `Fehlender Bereich: bleibt mit Zustand und Grund (T2.1 ${mono('disabled')}, T2.2 ${mono('failed')})`,
          'Langsamer oder fehlender Empfänger, belegter Slot, volle Queue: E6a, E6b, E10, E11',
          'Stiller Feldverlust, zwei Ausnahmen: fremde Snapshot-Version gilt als „keine Daten“ (T2.3); Bereich bleibt „available“, aber aus Budgetgründen leer (E15)',
        ],
        22,
      )}</div>` +
      `<div><p style="margin:0 0 8px;font-weight:700;font-size:28px">Schritt 4</p>${liste(
        [
          `Stimme oder gelöschte Quelle nach dem Auftrag: ${mono('source_changed')} (T5, E7, E8); ohne Änderung gültig (E9)`,
          `Stimme während des Kontextaufbaus: ${mono('CONFLICT')} (E12)`,
          `Legacy-Pfad kontrolliert (E13, E14); Runtime fehlt: extraktiv mit ${mono('unavailable')} (E6a)`,
          'Häufigkeit unter Voting nicht belastbar vorhergesagt (M7)',
        ],
        22,
      )}</div></div>`,
    privat('R9.notiz', {}),
    '1C/1C-ergebnis.md, Abschnitt 3 · Tests und Teil 2/3 auf 248029dc (Laptop, ThinkPad P50); Labor def56700',
  );

  const rolle = (name, ort, text) =>
    `<div style="border:var(--linie-min) solid var(--bernstein);border-radius:10px;padding:12px 18px;background:var(--bernstein-hell)">` +
    `<div style="font-weight:700;font-size:28px">${name}</div><div class="mono" style="font-size:22px;color:var(--text-2)">${ort}</div>` +
    `<div style="font-size:22px;margin-top:6px;line-height:1.3">${text}</div></div>`;
  reserve(
    'R10',
    '1B',
    'Reserve: 1B Schritt 1 und ADR-0035',
    `<div style="display:grid;grid-template-columns:repeat(3,1fr);column-gap:28px;margin-bottom:24px">` +
      rolle(
        'App-Adapter',
        'app-host',
        `${mono('openWeightLlmClient.ts')} ruft die Runtime (Bearer-Token); Gate und Fallback in ${mono('qaSummaryRuntimeAdapter.ts')}`,
      ) +
      rolle(
        'Encoder',
        'nicht gestartet',
        'Wortwolken-Encoder, Profil ab Werk aus; keine Abweichung',
      ) +
      rolle(
        'LLM-Server',
        'llm-host',
        `${mono('llama-server')}, ein Slot, lauscht nur im privaten Netz, ${mono('--api-key')}`,
      ) +
      `</div>` +
      liste(
        [
          'Abgleich Punkt für Punkt mit ADR-0035: abweichend nur der Aufbau auf einem Rechner und die CPU-Zahl, einige Punkte im Aufbau nicht prüfbar. Abnahmeprotokoll des Runbooks: abweichend Baseline-Commit statt Tag, Token ohne Passwortmanager, Summary eingeschaltet',
          `Lücke: ADR-0035 nennt für ${mono('--n-predict')} „Richtung ${fw.nPredictAdr}“, das Release setzt ${fw.nPredictRelease}. Die Antworten hatten ${fw.antwortTokensMin}–${fw.antwortTokensMax} Tokens, mit ${fw.nPredictAdr} wären sie abgeschnitten`,
        ],
        24,
      ),
    privat('R10.notiz', {}),
    `evidenz/1B/2026-11-12-aufbau.md (Komponenten, Abgleich) · ThinkPad P50 · a19ca70f; Lücke: evidenz/1B/2026-11-13-lauf.md, Manifest · ${H.hauptlauf.commit.slice(0, 8)}`,
  );

  const logZeile = (was, sichtbar, ok) =>
    `<tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:10px 16px 10px 0">${was}</td>` +
    `<td style="padding:10px 0;${ok ? '' : 'color:var(--rot);font-weight:600'}">${sichtbar}</td></tr>`;
  reserve(
    'R11',
    '1B',
    'Reserve: Was der Betrieb nicht sieht',
    frage('Was davon steht im Log der App?', '1B') +
      zweiSpalten(
        `<table style="border-collapse:collapse;font-size:28px;width:100%">` +
          logZeile('Auftrag gesamt', `ja, ${mono('latencyMs')}`, true) +
          logZeile('Inferenz', 'nein, die App liest die Zeiten nicht aus', false) +
          logZeile('Netz und Adapter', 'nein, nur mit Mitschnitt', false) +
          logZeile('Warum das Gate ablehnt', `nein, nur grob ${mono('invalid_response')}`, false) +
          `</table>` +
          `<p class="sekundaer" style="margin-top:18px">Empfohlen: Zeiten und Grund des Fallbacks ohne Prompttext loggen (#19, #20), nicht umgesetzt</p>`,
        zahl({
          wert: z.transport,
          einheit: 'ms',
          was: 'Transport (Netz + Server ohne Inferenz), Median, alle 10',
          gruppe: `Inferenzanteil ${z.anteil} %, langsame CPU`,
          linie: 'var(--bernstein)',
          gross: 72,
        }),
        820,
      ),
    privat('R11.notiz', {}),
    `evidenz/1B/2026-11-13-lauf.md, Befund C; ${q1B}`,
  );

  reserve(
    'R12',
    'beide',
    'Reserve: Entscheidungen im Detail',
    entscheidungen,
    privat('R12.notiz', {}),
    `1C/1C-ergebnis.md, Abschnitt 5, ADRs 1C-010 bis 1C-024, Abschnitt Folgen (Laptop und PC · 9f230abc; Laptop · def56700); 1B/1B-ergebnis.md, Entscheidung (${rechnerKurz(H.hauptlauf.rechner)} · ${H.hauptlauf.commit.slice(0, 8)})`,
  );

  // ------------------------------------------------------------ R15, R16: Abb. 1 und 2 aus 1C/1C-diagrams.md
  // Gerenderte Mermaid-SVGs (diagrams/*.light.svg), offline eingebettet; Ids je Abbildung umbenannt, damit
  // mehrere Diagramme im selben Dokument nicht kollidieren. Für Fragen zum Ablauf (J3 verweist darauf).
  const dg = daten.diagramme;
  reserve(
    'R15',
    '1C',
    'Reserve: Der Host-Aufruf wartet nie auf das Modell',
    // Abbildung in voller Flächenhöhe (grafik-box), rechts Legende, Notation und Stand.
    `<div class="grafik-box" data-diagramm="abb1" style="gap:40px">${dg.abb1.svg}` +
      `<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:20px">` +
      `<div data-diagramm="legende" style="width:100%;aspect-ratio:${dg.legende.verhaeltnis}">${dg.legende.svg}</div>` +
      `<p class="sekundaer" style="margin:0">Aktivitätsdiagramm, vereinfacht: Bänder sind Prozessschritte und Hosts, Sechsecke Prüfungen. Gespeichert wird die Modellzusammenfassung nur bei gleichem Hash und formgerechter Antwort, sonst der Ersatz mit Grund.</p>` +
      `<p class="vermerk" style="margin:0">Abb. 1 aus 1C/1C-diagrams.md, Stand ${mono('def56700')} (v1.4.0-14)</p>` +
      `</div></div>`,
    privat('R15.notiz', {}),
    '1C/1C-diagrams.md, Abb. 1 (diagrams/1c-context-path-overview.light.svg, Legende diagrams/1c-legende.light.svg) · Code-Stand def56700 (v1.4.0-14, Branch f746ffba), gezeichnet am Laptop (ThinkPad P50)',
  );
  reserve(
    'R16',
    '1C',
    'Reserve: Kontext dreimal gebaut, Status prüft erneut',
    `<div class="grafik-box" data-diagramm="abb2" style="gap:40px">${dg.abb2.svg}` +
      `<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:20px">` +
      `<p class="sekundaer" style="margin:0">UML-Sequenzdiagramm, vereinfacht: gefüllte Spitze = synchroner Aufruf, offene Spitze = asynchrone Nachricht, gestrichelt = Antwort; alt, par und loop sind kombinierte Fragmente, Nummern die Reihenfolge.</p>` +
      `<p class="sekundaer" style="margin:0">Messpunkte t0–t3 (J8) liegen auf den Pfeilen zur Runtime und zurück.</p>` +
      `<p class="vermerk" style="margin:0">Abb. 2 aus 1C/1C-diagrams.md, Stand ${mono('def56700')} (v1.4.0-14)</p>` +
      `</div></div>`,
    privat('R16.notiz', {}),
    '1C/1C-diagrams.md, Abb. 2 (diagrams/1c-context-path-overview-sequence.light.svg) · Code-Stand def56700 (v1.4.0-14, Branch f746ffba), gezeichnet am Laptop (ThinkPad P50)',
  );

  // ------------------------------------------------------------ J11 (bis 2026-11-16 R13): Betrieb
  // 2026-11-16 erst in die Reserve (R13), mit 15 min Redezeit wieder im Hauptteil. Inferenz am Laptop aus dem
  // Laborlauf (9f230abc); den Nachlaufwert (v1.4.0, mehr Ausgabetokens) nennt nur die Notiz.
  const maxS = Math.max(
    c.kalibrierungPcS.wert,
    c.inferenzRuhigS.wert,
    FESTWERTE.releaseTimeoutS.wert,
  );
  const xS = (s) => Math.round((s / maxS) * 520 * 10) / 10;
  const xT = xS(FESTWERTE.releaseTimeoutS.wert);
  const balken = (y, s, label, gruppe) =>
    `<text x="0" y="${y - 14}" style="font:400 24px var(--f-text);fill:var(--tinte)">${label} <tspan style="font:400 22px var(--f-text);fill:var(--gedaempft)">${gruppe}</tspan></text>` +
    `<rect x="0" y="${y}" width="${xS(s)}" height="44" rx="4" style="fill:var(--petrol)"/>` +
    `<text x="${xS(s) + 12}" y="${y + 31}" style="font:600 26px var(--f-mono);fill:var(--tinte)">${fmt(s, 1)} s</text>` +
    `<line x1="${xT}" y1="${y - 6}" x2="${xT}" y2="${y + 50}" style="stroke:var(--rot);stroke-width:4"/>`;
  const timeoutSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 250" width="680" height="250" role="img" aria-label="Inferenzzeiten auf beiden Laborrechnern gegen den Timeout ab Werk v1.4.0">` +
    balken(44, c.kalibrierungPcS.wert, 'Kalibrierung', 'PC') +
    balken(154, c.inferenzRuhigS.wert, 'Inferenz, Median', 'Laptop, 9f230abc') +
    `<line x1="${xT}" y1="204" x2="${xT}" y2="222" style="stroke:var(--rot);stroke-width:4"/>` +
    `<text x="${xT}" y="246" text-anchor="middle" style="font:700 24px var(--f-text);fill:var(--rot)">Timeout ab Werk v1.4.0: ${fw.releaseTimeoutS} s</text>` +
    `</svg>`;
  haupt(
    'J11',
    '1C',
    `${fw.releaseTimeoutS} s Timeout ab Werk sind auf der CPU zu kurz`,
    frage('Reicht die Konfiguration ab Werk für Inferenz auf der CPU?', '1C') +
      `<div style="display:grid;grid-template-columns:680px 1fr;column-gap:60px">` +
      `<div>${timeoutSvg}<p style="margin:14px 0 0;font-size:24px;line-height:1.35">${fw.releaseTimeoutS} s sind zu kurz auf beiden Laborrechnern: Der Modellpfad wäre dort nicht nutzbar.</p><p style="margin:6px 0 0;font-size:var(--s-min);color:var(--gedaempft)">Stand 9f230abc, Laptop und PC mit verschiedenen Limits: kein reiner Rechnervergleich</p></div>` +
      `<div>` +
      zahl({
        wert: `+${z.delta}`,
        einheit: 'GB',
        was: 'Runtime-Speicher je Auftrag, bei wechselnden Prompts, Median',
        gruppe: '1C-Nachlauf, Laptop; Ursache Cache (U1, PC)',
        linie: 'var(--petrol)',
        gross: 52,
      }) +
      `<p style="margin:0 0 10px;font-size:24px;line-height:1.35">Beide Grenzen ${fw.grenzeGesamtGiB} GiB: Labor ${fw.laborSpeicher1CGiB} GiB + ${fw.laborSpeicher1CGiB} GiB Swap, Produktion ${fw.prodSpeicherGiB} GiB + bis zu ${fw.prodSwapGiB} GiB <span class="nowrap" style="color:var(--gedaempft)">(Swap des Hosts unbekannt)</span></p>` +
      `<p style="margin:0 0 10px;font-size:24px;line-height:1.35">OOM-Kill: 9f230abc im ${c.oomAuftrag9f230abc.wert}. Auftrag (Laptop und PC), def56700 schon im <b>${c.oomAuftrag.wert}.</b> <span class="nowrap" style="color:var(--gedaempft)">warum früher: nicht getrennt gemessen</span></p>` +
      `<p style="margin:0;font-size:24px;line-height:1.35">Empfohlen, nicht umgesetzt: Timeout je Inferenz-Host kalibrieren (#16), ${mono('--cache-ram')} begrenzen (#14). Folge laut Versuch: Ausgabe um ${fw.cacheAusAusgabeProzent} % langsamer, nicht dem Cache zuordenbar.</p>` +
      `</div></div>`,
    privat('J11.notiz', { fw, z, c }),
    `ADR 1C-023 (Laptop 9f230abc: evidenz/1C/2026-11-05-labor.md; PC i7-8700 · 9f230abc), ADR 1C-024 (U1, PC · 9f230abc); Nachlauf N3, N6 · Laptop (ThinkPad P50) · def56700; 1B-Speicher: ${q1B}`,
    // Wegkarte: Timeout ab Werk endet vor der Inferenz, Zeichen „zu spät“ wie Störung L3 auf M1
    { zeitS: 55, station: 'inferenz', marke: 'auftrag-timeout' },
  );

  // ------------------------------------------------------------ R14 Einordnung Cloud Computing
  // Keine neue Messung: NIST-Merkmale und IaaS (Mell & Grance 2011, SP 800-145, S. 2–3), Bulkhead und Kapazität aus dem Code (Stand a19ca70f, Zeilen per Serena geprüft 2026-11-16).
  const nist = (merkmal, status, text) =>
    `<tr style="border-top:var(--linie-min) solid var(--linie)"><td style="padding:8px 14px 8px 0;font-weight:600">${merkmal}</td>` +
    `<td style="padding:8px 14px 8px 0;font-weight:700;color:${{ ja: 'var(--petrol)', nein: 'var(--rot)', teils: 'var(--bernstein-text)' }[status]}">${status}</td>` +
    `<td style="padding:8px 0;color:var(--text-2)">${text}</td></tr>`;
  haupt(
    'J13b',
    'beide',
    'Cloud-Sicht: Bulkhead ja, Elastizität nein',
    frage('Was heißt das aus Sicht des Cloud Computing?', 'beide') +
      `<div style="display:grid;grid-template-columns:700px 1fr;column-gap:44px">` +
      `<div><p style="margin:0 0 8px;font-weight:700;font-size:28px">Merkmale nach NIST</p>` +
      `<table style="border-collapse:collapse;font-size:22px;line-height:1.3;width:100%">` +
      nist('Selbstbedienung bei Bedarf', 'nein', 'feste VMs, von Hand nach Runbook aufgebaut') +
      nist('Breiter Netzzugang', 'ja', 'App im Browser; Runtime nur im privaten Netz') +
      nist('Ressourcenbündelung', 'ja', 'alle Sessions teilen einen Slot und einen Prompt-Cache') +
      nist(
        'Schnelle Elastizität',
        'nein',
        'Inferenz skaliert nur vertikal und von Hand; ein Slot bleibt ein Slot',
      ) +
      nist('Messbarer Dienst', 'teils', 'Log nur mit Gesamtzeit je Auftrag (R11)') +
      `</table>` +
      `<p style="margin:14px 0 0;font-size:22px;line-height:1.35">${etikett('1B')} <b>Bulkhead:</b> Der zweite Host ist ein getrennter Fehler- und Ressourcenbereich; die Inferenz konkurriert nicht mit dem Live-Pfad um CPU. Den Effekt habe ich nicht gemessen.</p></div>` +
      `<div><p style="margin:0 0 4px;font-weight:700;font-size:28px">Kapazität ${etikett('1C')}</p>` +
      `<p style="margin:0 0 8px;display:inline-block;padding:0 10px;border:var(--linie-min) dashed var(--linie);border-radius:6px;font-size:var(--s-min);font-weight:600;color:var(--text-2)">Rechnung aus dem Code, keine Messung</p>` +
      liste(
        [
          `Client: ein Aufruf zugleich, ein zweiter bekommt ${mono('busy')} <span style="color:var(--gedaempft)">(${mono('openWeightLlmClient.ts')} Z.&nbsp;141, 497)</span>`,
          `Queue: ${fw.queueParallel} Auftrag gleichzeitig, höchstens ${fw.queueLimit} laufend und wartend, dann ${mono('queue_full')} mit Ersatz <span style="color:var(--gedaempft)">(${mono('qaSummaryConfig.ts')} Z.&nbsp;26, 29; ${mono('qaSummaryQueue.ts')} Z.&nbsp;510)</span>`,
          `Bei ${z.jobWarm} s je warmem Auftrag (Laptop) schafft ein Slot rund ${daten.abgeleitet.auftraegeProStunde} Aufträge pro Stunde`,
        ],
        22,
      ) +
      `<p style="margin:6px 0 4px;font-weight:700;font-size:28px">SLO, Vorschlag</p>` +
      liste(
        [
          `Verfügbarkeit: ${fw.sloEndstatusProzent} % der Aufträge haben nach ${fw.laborTimeoutS} s einen Endstatus`,
          `Nutzen: Anteil ${mono('full-context')} als Ziel; gemessen ${daten.abgeleitet.fullContext1B} von ${n} (Lauf 1B)`,
        ],
        22,
      ) +
      `</div></div>`,
    privat('J13b.notiz', { fw, z, daten, n }),
    `Code a19ca70f (gleich HEAD): apps/backend/src/lib/openWeightLlmClient.ts Z. 141 (inFlight), Z. 497 (busy); qaSummaryConfig.ts Z. 26 (QUEUE_LIMIT_DEFAULT = 8), Z. 29 (CONCURRENCY_DEFAULT = 1); qaSummaryQueue.ts Z. 510 (queue_full); Durchsatz aus T_job warm: ${q1B}; NIST SP 800-145, S. 2–3 (Mell & Grance, 2011); ADR-0035 Abschn. 2.1, 2.2; SLO-Vorschlag: fragenkatalog.md F51; full-context: ${q1B}`,
    { zeitS: 50 },
  );

  // Stichpunkte zum freien Vortrag (Leitfaden F26–F27): 3–6 je Folie, Zahlen mit Einheit, je
  // Aufbaustufe ein „[Weiter]“. Der Fließtext in `notiz` bleibt die ausformulierte Fassung zum Üben.
  // Erster Satz (G0) und letzter Satz (J15) stehen wörtlich in Anführungszeichen.
  const ab = daten.abgeleitet;
  const STICHPUNKTE = privat('J.stichpunkte', { z, au, fw, n, fmt, ab, b, c, daten });
  for (const f of STICHPUNKTE ? F : []) {
    if (f.sprecher === 'niklas' || f.id === 'J16' || f.id === 'J16b') continue;
    const s = STICHPUNKTE[f.id];
    if (!s) throw new Error(`${f.id}: keine Stichpunkte`);
    f.stichpunkte = s;
  }

  // Kurzbelege je Folie (ZL Anhang B: „Quelle: …“ in der Fußzeile), eine Zeile; Rechner und Commit
  // stehen in `quelle` (Sprechnotizen) und im Manifest, nicht auf der Folie.
  for (const f of F) {
    if (f.id === 'J16' || f.id === 'J16b') continue;
    const z = ZITATE[f.id];
    if (!z) throw new Error(`${f.id}: keine Kurzbelege in ZITATE`);
    f.fuss = quellenzeile(z);
  }
  // Ruhiger Marker (Feinschliff 2026-11-16): Jonas' Hauptfolien ohne eigene Station zeigen den ganzen Weg
  // ohne Hervorhebung wie J1, damit der Platz oben links nicht zwischen Folien leer wird und wieder erscheint.
  for (const id of ['J2', 'J4', 'J13b', 'J15']) {
    const f = F.find((x) => x.id === id);
    if (f && !f.station && !f.marke) f.marke = 'auftrag';
  }
  // Vortragsreihenfolge (Redezeit 15 min je Person, Absprache 2026-11-16): aus der Reserve geholte Folien an
  // ihre Station; Reserve danach in Erstellungsreihenfolge.
  const index = (f) => {
    const i = REIHENFOLGE.indexOf(f.id);
    if (i < 0 && f.teil !== 'reserve') throw new Error(`${f.id}: fehlt in REIHENFOLGE`);
    return i < 0 ? REIHENFOLGE.length : i;
  };
  return F.map((f, i) => [f, i])
    .sort((a, b) => index(a[0]) - index(b[0]) || a[1] - b[1])
    .map(([f]) => f);
}

// Bausteine für den Folienentwurf 1A (abgabe/bau/folien-1a.mjs).
export { flaeche, frage, autorZeile, liste, zahl, zweiSpalten, grafikBox, mono, entwurf, etikett };
