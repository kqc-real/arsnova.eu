// Zahlen und Abbildungen für Niklas' LaTeX-Handout in PaperLab (Typ referat), Auftrag 1A.
// Eine Quelle je Zahl: daten-1a.mjs (auswertung.json der Reihe vom 15.11.2026) und dieselbe Reihe in den
// Rohdaten (plan.json, lauf.json je Lauf). Nichts wird neu gemessen. Schlüssel mit Präfix `exp` sind
// nachträgliche, nicht vorab festgelegte Auswertungen und werden im Handout so gekennzeichnet.
// Ausgabe in <zielordner>: zahlen.tex (\newcommand je Wert) und abb-vergleiche.pdf.
// Abbildungen in Arial wie der Text (Schriftregel RL S. 2), Schrift ≥ 8 pt bei 17 cm Breite.
//
// CLI: node handout-latex-1a.mjs <zielordner>   (braucht git, rsvg-convert und pdffonts)
/* global console, process -- Node-Skript */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { makroName, svgArial, svgMindestschrift, texEsc } from './handout-latex.mjs';
import { fmt } from './zahlen.mjs';
import { AKTIONEN, AUSWERTUNG_1A, ladeDaten1A } from './daten-1a.mjs';
import { VERZOEGERUNG_1B34_MS, ladeDaten1B34 } from './daten-1b34.mjs';
import { vergleichsMatrixSvg } from './grafik-1a.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
/** docs/referat-thema-1 */
const ROOT = resolve(HIER, '../..');
const REPO = resolve(ROOT, '../..');

/**
 * Vorab-Festlegung in Git: Vertrag v1 (Hypothesen und Schwellen), Vertrag v2 (Hash in jedem Lauf-Manifest),
 * Vorabnachtrag mit Reihendefinition für die Baseline a19ca70f. Kennungen, keine Messwerte.
 */
export const VORAB_COMMITS = { vertrag: '2372a037', vertragZwei: '35271586', nachtrag: 'e3b27b32' };
/** Gemessener Anwendungsstand (Manifest `baselineCommit`); Version aus dessen package.json. */
const SPACY_CLIENT = 'apps/backend/src/lib/spacyClient.ts';
/** Schwelle für eine „langsame“ Live-Aktion in der explorativen Zeitlinie (ms), nur beschreibend. */
export const LANGSAM_MS = 100;

const GIB = 1024 ** 3;
const spanne = (werte) => [Math.min(...werte), Math.max(...werte)];
const summe = (werte) => werte.reduce((a, b) => a + b, 0);
const bis = ([a, b], stellen = 0) =>
  fmt(a, stellen) === fmt(b, stellen) ? fmt(a, stellen) : `${fmt(a, stellen)}–${fmt(b, stellen)}`;
/** Abrunden auf `stellen` Nachkommastellen (für „mindestens …“). */
const ab = (wert, stellen) => Math.floor(wert * 10 ** stellen) / 10 ** stellen;

/** p-Quantil nach Nearest Rank, wie im Versuchsvertrag (sortiert[ceil(q·n) − 1]). */
export function nearestRank(werte, q) {
  if (!werte.length) throw new Error('nearestRank: leere Stichprobe');
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.ceil(q * s.length) - 1];
}

/** Rohdaten derselben Reihe: Plan, je Lauf lauf.json, dazu die rohe auswertung.json. */
export function ladeRohdaten1A(root) {
  const reihe = join(root, dirname(dirname(AUSWERTUNG_1A)));
  const plan = JSON.parse(readFileSync(join(reihe, 'plan.json'), 'utf8'));
  const laeufe = plan.runs.map((p) => ({
    variante: p.variant,
    block: p.block,
    lauf: JSON.parse(readFileSync(join(reihe, p.variant, p.run, 'lauf.json'), 'utf8')),
  }));
  const auswertung = JSON.parse(readFileSync(join(root, AUSWERTUNG_1A), 'utf8'));
  return { plan, laeufe, auswertung };
}

function gitDatum(commit) {
  const iso = execFileSync('git', ['log', '-1', '--format=%cs', commit], {
    cwd: REPO,
    encoding: 'utf8',
  }).trim();
  return iso;
}

const deutschesDatum = (iso) => iso.slice(0, 10).split('-').reverse().join('.');
const tageZwischen = (isoA, isoB) =>
  Math.round((Date.parse(isoB.slice(0, 10)) - Date.parse(isoA.slice(0, 10))) / 86400000);

/** Werte aus Git und Quelltext (Kennungen, Daten, eine Konstante des Clients). */
export function ladeKontext1A() {
  const daten = Object.fromEntries(Object.entries(VORAB_COMMITS).map(([k, c]) => [k, gitDatum(c)]));
  const client = readFileSync(join(REPO, SPACY_CLIENT), 'utf8');
  const m = client.match(/export const SPACY_MAX_IN_FLIGHT = (\d+);/);
  if (!m) throw new Error(`${SPACY_CLIENT}: SPACY_MAX_IN_FLIGHT nicht gefunden`);
  return { daten, maxInFlight: Number(m[1]) };
}

/** Explorative Zeitlinie eines Laufs: Indizes der Beitritte über LANGSAM_MS (Abschlussreihenfolge). */
export function langsameBeitritte(lauf) {
  const s = lauf.live.actions.join.latency.durationSamplesMs;
  return s.flatMap((ms, i) => (ms > LANGSAM_MS ? [i] : []));
}

/**
 * Alle Werte des Handouts als flaches Objekt Schlüssel → Text (de-DE, U+2212). Eingaben: Ergebnis von
 * ladeDaten1A, ladeRohdaten1A und ladeKontext1A.
 */
export function makros1A(d, roh, kontext) {
  const { auswertung: a, laeufe } = roh;
  const lauf = (v, b) => laeufe.find((x) => x.variante === v && x.block === b)?.lauf;
  const m = lauf('V2', 1).manifest;
  const m3 = lauf('V3', 1).manifest;
  const m4 = lauf('V4', 1).manifest;
  const last = lauf('V1', 1).analysis.workload;
  const profil = m.profile;
  const spacy = m.services.spacy;
  const verzoegerung = m4.socketMode.match(/^delay-proxy-(\d+)ms$/);
  if (!verzoegerung) throw new Error(`handout-1a: unerwarteter socketMode ${m4.socketMode}`);

  const fehl = d.vergleiche.filter((x) => !x.bestanden);
  const kontrolle = d.vergleiche.filter((x) => x.variante === 'V1');
  const h1Fall = fehl.find((x) => x.variante === 'V2');
  const absolut = fehl.filter((x) => !x.absolutBestanden);
  const v3b5 = (aktion) =>
    d.vergleiche.find((x) => x.variante === 'V3' && x.block === 5 && x.aktion === aktion);
  const runs = (v) => a.runs.filter((r) => r.variant === v);
  const grund = (v, k) => summe(runs(v).map((r) => r.analysis.fallbackReasons?.[k] ?? 0));
  const spacyRes = (v) => runs(v).map((r) => r.resources.find((c) => c.alias === 'spacy'));

  // Laborreserve: Container-CPU je Lauf (Summe, % einer CPU), kleinster freier Host-Speicher.
  const containerCpu = a.runs.map((r) => summe(r.resources.map((c) => c.cpuPercent)));
  const minFreiGiB = Math.min(...a.runs.map((r) => r.collectorHost.minAvailableMemoryBytes)) / GIB;

  // Explorativ 1: V3/Block 5 als zusammenhängendes Ereignis.
  const b5 = lauf('V3', 5);
  const langsam = langsameBeitritte(b5);
  const andere = laeufe
    .filter((x) => !(x.variante === 'V3' && x.block === 5))
    .map((x) => langsameBeitritte(x.lauf).length);
  const ankunft = b5.live.lifecycle.arrivals;
  const fensterS =
    (ankunft[langsam.at(-1)].scheduledAtMs - ankunft[langsam[0]].scheduledAtMs) / 1000;
  const timeoutBloecke = runs('V3')
    .filter((r) => (r.analysis.fallbackReasons?.TIMEOUT ?? 0) > 0)
    .map((r) => r.block);

  // Explorativ 2: gepoolter p95 je Aktion, V2 gegen V1, alle fünf Blöcke zusammen.
  const gepoolt = (v, aktion) =>
    nearestRank(
      laeufe
        .filter((x) => x.variante === v)
        .flatMap((x) => x.lauf.live.actions[aktion].latency.durationSamplesMs),
      0.95,
    );
  const poolDelta = AKTIONEN.map(([k]) => gepoolt('V2', k) - gepoolt('V1', k));
  const v2Beitritt = runs('V2').map((r) => r.live.join.p95Ms);

  const { daten: tag } = kontext;
  const ersterLauf = laeufe
    .map((x) => x.lauf.manifest.startAt)
    .sort()
    .at(0);
  const version = JSON.parse(
    execFileSync('git', ['show', `${a.source.identity.baselineCommit}:package.json`], {
      cwd: REPO,
      encoding: 'utf8',
    }),
  ).version;

  return {
    // Herkunft und Labor
    commitApp: d.herkunft.commit,
    versionApp: version,
    cpus: fmt(d.herkunft.cpus),
    ramGiB: fmt(a.source.hardware.memoryBytes / GIB, 1),
    docker: a.source.hardware.dockerVersion,
    minFreiGiB: fmt(ab(minFreiGiB, 1), 1),
    containerCpu: bis(spanne(containerCpu)),
    /** Höchste Summe aller Container je Lauf in CPUs (nicht Prozent), aufgerundet auf zwei Stellen. */
    containerCpuMax: fmt(Math.ceil(Math.max(...containerCpu)) / 100, 2),
    // Erste vollständige Reihe auf älterem Stand (offengelegt, nicht gewertet; Daten aus Git)
    vorreiheDatum: deutschesDatum(d.vorab.vorreihe.datumDaten),
    vorreiheBaseline: d.vorab.vorreihe.baseline,
    vorreiheCommit: d.vorab.vorreihe.commitDaten,
    vorreiheAuswertung: d.vorab.vorreihe.commitAuswertung,
    vorreiheHEinsFehl: fmt(d.vorab.vorreihe.h1.fehl),
    vorreiheHZweiFehl: fmt(d.vorab.vorreihe.h2.fehl),
    vorreiheAbsolutFehl: fmt(d.vorab.vorreihe.absolutFehl),
    vVierGegendruckJeLauf: fmt(d.v4.gegendruckJeLauf),
    // Last und Plan
    laeufe: fmt(a.runs.length),
    bloecke: fmt(Math.max(...a.runs.map((r) => r.block))),
    teilnehmende: fmt(profil.participants),
    rampeS: fmt(profil.rampMs / 1000),
    fensterS: fmt(profil.durationMs / 1000),
    aufwaermS: fmt(profil.warmupMs / 1000),
    freigabeS: fmt(profil.revealAtMs / 1000),
    analyseHosts: fmt(last.hosts),
    analyseTaktS: fmt(last.intervalMs / 1000),
    analysenJeLauf: fmt((last.hosts * last.durationMs) / last.intervalMs),
    analysenJeVariante: fmt(d.analyseGeplantJeVariante),
    qaJeLauf: fmt(lauf('V1', 1).live.actions.qaSubmit.planned),
    // Budget und Störungen
    spacyCpu: fmt(spacy.cpuLimit),
    spacyRamGiB: fmt(spacy.memoryLimitBytes / GIB),
    spacyPids: fmt(spacy.pidsLimit),
    vDreiCpuLimit: fmt(m3.services.spacy.cpuLimit, 2),
    verzoegerungMs: fmt(Number(verzoegerung[1])),
    timeoutMs: fmt(Number(m4.services.app.flags.NLP_TIMEOUT_MS)),
    maxInFlight: fmt(kontext.maxInFlight),
    // Schwellen (vorab, aus auswertung.json)
    schwelleRelProzent: fmt(d.schwellen.relativ * 100),
    schwelleAbsMs: fmt(d.schwellen.absolutMs),
    fehlerProzent: fmt(d.schwellen.fehler * 100, 1),
    quizZielMs: fmt(d.schwellen.quizZielMs),
    drosselSchwelleProzent: fmt(d.schwellen.drosselung * 100),
    speicherSchwelleProzent: fmt(d.schwellen.speicher * 100),
    speicherSchwelleMiB: fmt(d.v2.limitMiB * d.schwellen.speicher),
    verfuegbarkeitProzent: fmt(d.schwellen.verfuegbarkeit * 100),
    // Vorab-Festlegung (Git)
    commitVertrag: VORAB_COMMITS.vertrag,
    commitVertragZwei: VORAB_COMMITS.vertragZwei,
    commitNachtrag: VORAB_COMMITS.nachtrag,
    datumVertrag: deutschesDatum(tag.vertrag),
    datumVertragZwei: deutschesDatum(tag.vertragZwei),
    datumNachtrag: deutschesDatum(tag.nachtrag),
    datumLauf: deutschesDatum(ersterLauf),
    tageVorher: fmt(tageZwischen(tag.vertrag, ersterLauf)),
    // Live-Ergebnis
    liveGeplant: fmt(d.live.geplant),
    liveErfolgreich: fmt(d.live.erfolgreich),
    liveFehl: fmt(d.live.geplant - d.live.erfolgreich),
    quizMaxMs: fmt(d.live.quizMaxMs),
    vergleiche: fmt(d.vergleiche.length),
    vergleicheFehl: fmt(fehl.length),
    kontrolleN: fmt(kontrolle.length),
    kontrolleFehl: fmt(kontrolle.filter((x) => !x.bestanden).length),
    hEinsN: fmt(d.h1.gesamt),
    hEinsFehl: fmt(d.h1.fehl),
    hZweiN: fmt(d.h2.gesamt),
    hZweiFehl: fmt(d.h2.fehl),
    spacyN: fmt(d.h1.gesamt + d.h2.gesamt),
    spacyFehl: fmt(d.h1.fehl + d.h2.fehl),
    absolutFehl: fmt(absolut.length),
    absolutBlock: fmt(Math.max(...absolut.map((x) => x.block))),
    hEinsBlock: fmt(h1Fall.block),
    hEinsBasisMs: fmt(h1Fall.basisMs, 2),
    hEinsKandidatMs: fmt(h1Fall.kandidatMs, 2),
    hEinsProzent: fmt(h1Fall.relativ * 100),
    vDreiBeitrittMs: fmt(v3b5('join').deltaMs),
    vDreiQuizMs: fmt(v3b5('vote').deltaMs),
    vDreiQaMs: fmt(v3b5('qaSubmit').deltaMs),
    // Ressourcen und Analyse
    vZweiCpu: bis(spanne(spacyRes('V2').map((s) => s.cpuPercent)), 1),
    vZweiDrossel: bis(d.v2.drosselProzent, 1),
    vZweiRamMiB: bis(d.v2.ramMiB),
    vZweiAnalyseS: bis(
      d.v2.analyseP95Ms.map((x) => x / 1000),
      2,
    ),
    vZweiErfolg: fmt(d.v2.erfolg),
    vDreiDrossel: bis(d.v3.drosselProzent),
    vDreiCpu: bis(spanne(spacyRes('V3').map((s) => s.cpuPercent))),
    vDreiAnalyseS: bis(
      d.v3.analyseP95Ms.map((x) => x / 1000),
      1,
    ),
    vDreiErfolg: fmt(d.v3.erfolg),
    vDreiTimeout: fmt(grund('V3', 'TIMEOUT')),
    vDreiGegendruck: fmt(grund('V3', 'SIDECAR_UNAVAILABLE')),
    vVierErsatz: fmt(d.v4.ersatz),
    vVierTimeout: fmt(grund('V4', 'TIMEOUT')),
    vVierGegendruck: fmt(grund('V4', 'SIDECAR_UNAVAILABLE')),
    vVierErsatzS: bis(
      d.v4.ersatzP95Ms.map((x) => x / 1000),
      2,
    ),
    vVierEmpfangen: fmt(summe(runs('V4').map((r) => r.proxy.receivedNormalize))),
    vVierWeitergeleitet: fmt(d.v4.weitergeleitet),
    oomZuwachs: fmt(summe(a.runs.flatMap((r) => r.resources.map((c) => c.oomKillDelta ?? 0)))),
    // Explorativ (nachträglich)
    expLangsamSchwelleMs: fmt(LANGSAM_MS),
    expBFuenfLangsam: fmt(langsam.length),
    expAndereMax: fmt(Math.max(...andere)),
    expAndereN: fmt(andere.length),
    expFensterS: fmt(fensterS),
    expTimeoutBloecke: timeoutBloecke.map((b) => fmt(b)).join(', '),
    expPoolMin: fmt(Math.min(...poolDelta), 1),
    expPoolMax: `${Math.max(...poolDelta) > 0 ? '+' : ''}${fmt(Math.max(...poolDelta), 1)}`,
    expVZweiBeitritt: bis(spanne(v2Beitritt)),
  };
}

/**
 * Werte für 1B, Schritte 3–4 (Abschnitt 6 des Handouts) aus Niklas' gewerteten Reihen (daten-1b34.mjs, dieselben
 * Daten wie M1–M4); Schlüssel mit Präfix `eb`. Leer, wenn Störreihen, Label, Breaker, S1 oder Transport fehlen.
 * Summary mit Job-Zeit, Label mit Client-Zeit (die Label-API legt keine Job-Zeit offen).
 */
export function makros1B34(d) {
  const f1 = d.finde('f1');
  const f1l = d.finde('f1', 'label');
  if (!d.vorhanden || !f1 || !f1l || !d.breaker || !d.s1 || !d.transport?.label) return {};
  const sek = (ms, st = 1) => fmt(ms / 1000, st);
  const s = (v) => d.finde(v);
  const l = (v) => d.finde(v, 'label');
  const AKT = AKTIONEN.map(([k]) => k);
  const stoer = {
    summary: ['busy', 'f2', 'l3'],
    label: ['normal', 'l1', 'l2', 'l3', 'f2'],
  };
  const ratios = Object.entries(stoer).flatMap(([c, vs]) =>
    vs.flatMap((v) => {
      const x = d.finde(v, c);
      const ref = d.finde('f1', c);
      return x ? AKT.map((a) => x.live[a].p95Ms / ref.live[a].p95Ms) : [];
    }),
  );
  const gehalten = Object.entries(stoer).flatMap(([c, vs]) =>
    vs.filter((v) => {
      const x = d.finde(v, c);
      const ref = d.finde('f1', c);
      return x && AKT.every((a) => x.live[a].p95Ms / ref.live[a].p95Ms <= d.schwellen.p95Faktor);
    }),
  );
  const reihen = [...['f1', ...stoer.summary].map(s), ...['f1', ...stoer.label].map(l)].filter(
    Boolean,
  );
  const pr = (r) => fmt((r - 1) * 100);
  const { label: s1l } = d.s1;
  const nl = l('normal');
  return {
    ebRechner: f1.rechner,
    ebVms: f1.vms.join(', '),
    ebCommitSchwellen: d.schwellen.commit,
    ebDatumSchwellen: d.schwellen.datum ? deutschesDatum(d.schwellen.datum) : '15.11.2026',
    ebCommitFEins: f1.commit,
    ebCommitStoerung: s('f2')?.commit ?? '',
    ebCommitLabel: nl.commit,
    ebCommitSEins: s1l.commit,
    ebPufferS: fmt(d.schwellen.fallbackPufferMs / 1000),
    ebFEinsMaxS: fmt(d.schwellen.f1MedianMaxMs / 1000),
    ebFaktorMin: fmt(d.schwellen.f2ZuF1Min),
    ebPProzent: fmt(d.schwellen.p95Faktor * 100),
    ebFristS: fmt(f1.timeoutMs / 1000),
    ebFristLabelS: fmt(f1l.timeoutMs / 1000),
    // Summary (Job-Zeit)
    ebSNormalN: fmt(s('normal').n),
    ebSNormalS: sek(s('normal').zeitMedianMs, 0),
    ebSFEinsN: fmt(f1.n),
    ebSFEinsMs: fmt(f1.zeitMedianMs),
    ebSBusyN: fmt(s('busy').n),
    ebSBusyMs: fmt(s('busy').zeitMedianMs),
    ebSFZweiN: fmt(s('f2').n),
    ebSFZweiS: sek(s('f2').zeitMedianMs),
    ebSLDreiN: fmt(s('l3').n),
    ebSLDreiS: sek(s('l3').zeitMedianMs),
    ebFaktor: fmt(Math.round(s('f2').zeitMedianMs / f1.zeitMedianMs / 100) * 100),
    // Label (Client-Zeit)
    ebLNormalN: fmt(nl.n),
    ebLNormalS: sek(nl.zeitMedianMs),
    ebLUebernommen: fmt(nl.uebernommen),
    ebLFEinsN: fmt(f1l.n),
    ebLFEinsMs: fmt(f1l.zeitMedianMs, f1l.zeitMedianMs % 1 ? 1 : 0),
    ebLLEinsN: fmt(l('l1').n),
    ebLLEinsS: sek(l('l1').zeitMedianMs),
    ebLLZweiN: fmt(l('l2').n),
    ebLLZweiS: sek(l('l2').zeitMedianMs),
    ebLFZweiN: fmt(l('f2').n),
    ebLFZweiS: sek(l('f2').zeitMedianMs),
    ebLLDreiN: fmt(l('l3').n),
    ebLLDreiS: sek(l('l3').zeitMedianMs),
    // Live
    ebLiveFehl: fmt(reihen.reduce((x, r) => x + r.liveFehler, 0)),
    ebLiveGeplant: fmt(reihen.reduce((x, r) => x + r.liveGeplant, 0)),
    ebMaxProzent: pr(Math.max(...ratios)),
    ebGehaltenN: fmt(gehalten.length),
    // Breaker gegen Queue
    ebBreakerOffenMs: fmt(d.breaker.f1.jobs[3].jobMs),
    ebBreakerFristS: fmt(d.breaker.l3.timeoutMs / 1000),
    ebBreakerCommit: d.breaker.f1.commit,
    // Transport
    ebTransportMs: fmt(d.transport.label.transportMedianMs, 1),
    ebTransportProzent: fmt(d.transport.label.anteilMedianProzent, 2),
    // S1 gegen zwei Hosts (Label; Summary hält alle Schwellen)
    ebSEinsN: fmt(s1l.n),
    ebSEinsVcpu: fmt(s1l.placement?.vmVcpu ?? 8),
    ebZweiHostVcpu: f1.vcpus.join(' + '),
    ebLEinsVerzMs: fmt(VERZOEGERUNG_1B34_MS.l1),
    ebLZweiVerzMs: fmt(VERZOEGERUNG_1B34_MS.l2),
    ebSEinsBeitrittProzent: pr(s1l.live.join.p95Ms / nl.live.join.p95Ms),
    ebSEinsQuizProzent: pr(s1l.live.vote.p95Ms / nl.live.vote.p95Ms),
  };
}

/**
 * Festwerte aus Projektquellen, je per Muster aus dem Wortlaut gelesen (keine Literale im Handout): Zielhost und
 * RAM-Schätzung aus ADR-0035 (Abschn. Kontext, 2.1), Inferenzdauer eines LLM-Auftrags aus Jonas' 1B/1B-ergebnis.md.
 */
export function makrosQuellen(root = ROOT) {
  const adr = readFileSync(
    join(root, '../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md'),
    'utf8',
  );
  const host = adr.match(/Live-Host bleibt \*\*(\d+) vCPU \/ (\d+) GB RAM/);
  const ram = adr.match(
    /~(\d+)–(\d+) GB Baseline plus spaCy (\d+) GB, Encoder (\d+) GB, PDF-Worker\s+(\d+) GB\) trägt \*\*kein\*\* zusätzliches ~(\d+)-GB-LLM/,
  );
  const ergebnis = readFileSync(join(root, '1B/1B-ergebnis.md'), 'utf8');
  const warm = ergebnis.match(/warm \(Prompt aus dem Cache, Aufträge 2–10\) im Median ([\d,]+) s/);
  if (!host || !ram || !warm)
    throw new Error('handout-1a: Festwert in ADR-0035 oder 1B/1B-ergebnis.md nicht gefunden');
  const warmS = Number(warm[1].replace(',', '.'));
  return {
    adrZielVcpu: host[1],
    adrZielRamGb: host[2],
    adrBaselineGb: `${ram[1]}–${ram[2]}`,
    adrSpacyGb: ram[3],
    adrEncoderGb: ram[4],
    adrPdfGb: ram[5],
    adrLlmGb: ram[6],
    llmWarmMin: fmt(Math.round(warmS / 60 / 0.5) * 0.5, 1),
  };
}

/** zahlen.tex: Kopf mit Herkunft, dann je Wert ein \newcommand (sortiert, eindeutig). */
export function zahlenTex1A(makros, { commit, datum }) {
  const zeilen = Object.entries(makros)
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([k, v]) => `\\newcommand{\\${makroName(k)}}{${texEsc(v)}}`);
  return (
    `% Automatisch erzeugt von docs/referat-thema-1/abgabe/bau/handout-latex-1a.mjs (arsnova.eu, Fork).\n` +
    `% Stand ${commit}, ${datum}; Quelle ${AUSWERTUNG_1A} und Rohdaten derselben Reihe.\n` +
    `% Nicht von Hand ändern; neu erzeugen.\n` +
    `${zeilen.join('\n')}\n`
  );
}

/**
 * Druckfassung einer Deck-Grafik: Aufbaustufen-Texte (wechselnde Zeilen an derselben Stelle) entfernen,
 * Stufenattribute tilgen und die weiße Hintergrundfläche entfernen, damit die PDF genau den Endzustand ohne
 * Folientext zeigt.
 */
export function druckSvg(svg) {
  return (
    svg
      // Weiße Vollfläche weg: Sonst überdeckt das per trim beschnittene Bild in LaTeX die Bildunterschrift.
      .replace(/<rect width="\d+" height="\d+" fill="#ffffff"\/>/, '')
      .replace(/<g [^>]*class="aufbau-text"[^>]*>[\s\S]*?<\/g>/g, '')
      .replace(/ data-(?:ab|bis)="\d+"/g, '')
      .replace(/ class="aufbau-[^"]*"/g, '')
      .replace(/ style="transition-delay:\d+ms"/g, '')
  );
}

// Druckbreite 170 mm bei viewBox-Breite 1380: 24 Einheiten ≈ 8,4 pt (PaperLab: Schrift ≥ 8 pt).
export const MINDESTSCHRIFT = 24;

// SVG → PDF mit rsvg-convert (cairo), bettet Arial als TrueType ein; wie jonas/handout-latex.mjs.
function svgZuPdf(svg, pfad, { breiteMm }) {
  const tmp = mkdtempSync(join(tmpdir(), 'handout-1a-svg-'));
  try {
    const quelle = join(tmp, 'abb.svg');
    writeFileSync(quelle, svg);
    const breitePt = Math.round((breiteMm / 25.4) * 72);
    execFileSync('rsvg-convert', ['-f', 'pdf', '-w', String(breitePt), '-o', pfad, quelle]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const fonts = execFileSync('pdffonts', [pfad], { encoding: 'utf8' });
  if (/Type 3|Inter|Plex|DejaVu|Liberation/.test(fonts)) {
    throw new Error(`${pfad}: unzulässige Schrift\n${fonts}`);
  }
}

/**
 * viewBox auf den Inhalt verbreitern, wenn Rechtecke über den rechten Rand ragen (Deck-Grafiken sind auf
 * 1380 Einheiten ausgelegt). Gibt das SVG und den Faktor zurück, um den die Schrift wachsen muss, damit sie
 * bei fester Druckbreite nicht unter die Mindestgröße fällt.
 */
export function svgAufInhaltsbreite(svg) {
  const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (!vb) throw new Error('svgAufInhaltsbreite: viewBox fehlt');
  const breite = Number(vb[1]);
  const rechts = Math.max(
    breite,
    ...[...svg.matchAll(/<rect x="(\d+(?:\.\d+)?)"[^>]*? width="(\d+(?:\.\d+)?)"/g)].map(
      (m) => Number(m[1]) + Number(m[2]) + 2,
    ),
  );
  if (rechts === breite) return { svg, faktor: 1 };
  return {
    svg: svg.replace(vb[0], `viewBox="0 0 ${Math.ceil(rechts)} ${vb[2]}"`),
    faktor: Math.ceil(rechts) / breite,
  };
}

/** Die Abbildung des Handouts als druckfertiger SVG-Text (Arial, Mindestschrift ≥ 8 pt bei 17 cm). */
export function abbildungen1A(d) {
  const druck = (roh) => {
    const { svg, faktor } = svgAufInhaltsbreite(svgArial(druckSvg(roh)));
    return svgMindestschrift(svg, Math.ceil(MINDESTSCHRIFT * faktor));
  };
  return { 'abb-vergleiche.pdf': druck(vergleichsMatrixSvg(d)) };
}

export async function erzeuge(ziel) {
  const d = ladeDaten1A(ROOT);
  const makros = {
    ...makros1A(d, ladeRohdaten1A(ROOT), ladeKontext1A()),
    ...makros1B34(ladeDaten1B34(ROOT)),
    ...makrosQuellen(ROOT),
  };
  mkdirSync(ziel, { recursive: true });
  const commit = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const datum = new Date().toISOString().slice(0, 10);
  writeFileSync(join(ziel, 'zahlen.tex'), zahlenTex1A(makros, { commit, datum }));
  for (const [datei, svg] of Object.entries(abbildungen1A(d))) {
    svgZuPdf(svg, join(ziel, datei), { breiteMm: 170 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ziel = process.argv[2];
  if (!ziel) throw new Error('Aufruf: node handout-latex-1a.mjs <zielordner>');
  await erzeuge(resolve(ziel));
  console.log(`erzeugt: ${ziel}`);
}
