// Zahlen für Niklas' Folien 1A, gelesen aus seiner committeten Messreihe vom 15.11.2026 (Auswertung,
// Laufdateien, Ressourcenstichproben, Plan) und aus Git (Datum der Vorab-Festlegung). Dieselben Felder und
// Rechenwege wie scripts/load/render-resource-isolation-pdfs.mjs; daten-1a.test.mjs gleicht die Befunde ab.
// Nichts wird hier neu gemessen. Nachträgliche, nicht vorab festgelegte Auswertungen stehen unter
// `explorativ` und werden auf Folien und im Handout als solche gekennzeichnet.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

export const REIHE_1A = 'evidenz/1A/reihe-main-a19ca70f-20261115-122547';
export const AUSWERTUNG_1A = `${REIHE_1A}/auswertung/auswertung.json`;
export const VERTRAG_1A = '1A-experiment-contract.md';
/** App-Code, aus dem die Gegendruckgrenze des spaCy-Clients gelesen wird (nur gelesen). */
export const SPACY_CLIENT = '../../apps/backend/src/lib/spacyClient.ts';

/**
 * Vorab-Festlegung in Git: Commit, an dem die Regel bzw. die Reihe festgehalten wurde. Das Datum liest
 * daten-1a.mjs aus Git (Committer-Datum); der Test prüft, dass die Schwellen im Vertrag v1 schon stehen.
 */
export const KETTE_1A = [
  { commit: '2372a037', was: 'Regel festgelegt (Vertrag v1)' },
  { commit: '35271586', was: 'Vertrag v2, Schwellen unverändert' },
  { commit: 'e3b27b32', was: 'Nachtrag und Reihe für a19ca70f' },
];

/**
 * Erste vollständige Reihe auf dem älteren Stand (Daten 35271586, Auswertung 97bfcfc9), später aus dem
 * Arbeitsbaum entfernt (ab1619e7). Gleicher Vertrag, Seed und Fixture; offengelegt, gewertet wird sie nicht.
 */
export const VORREIHE_1A = {
  commitDaten: '35271586',
  commitAuswertung: '97bfcfc9',
  pfad: 'docs/referat-thema-1/evidenz/1A/auswertung/auswertung.json',
};

/** Aktionen der Live-Last in Vortragsreihenfolge, mit kurzer deutscher Bezeichnung. */
export const AKTIONEN = [
  ['join', 'Beitritt'],
  ['vote', 'Quiz'],
  ['qaSubmit', 'Q&A'],
  ['blitzlicht', 'Tempo'],
];
export const VARIANTEN = ['V0', 'V1', 'V2', 'V3', 'V4'];

const spanne = (werte) => [Math.min(...werte), Math.max(...werte)];
const summe = (werte) => werte.reduce((a, b) => a + b, 0);
const MiB = 1048576;
const GiB = 1073741824;
/** Nearest Rank wie in Niklas' Auswertung: sortiert[ceil(q · n) − 1]. */
export const rang = (werte, q) => {
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.ceil(q * s.length) - 1];
};

/** Alle Dateien, die ladeDaten1A liest (relativ zu docs/referat-thema-1); für das Bau-Manifest. */
export function eingaben1A(root) {
  const plan = JSON.parse(readFileSync(join(root, REIHE_1A, 'plan.json'), 'utf8'));
  return [
    AUSWERTUNG_1A,
    `${REIHE_1A}/plan.json`,
    VERTRAG_1A,
    SPACY_CLIENT,
    ...plan.runs.flatMap((p) => [
      `${REIHE_1A}/${p.variant}/${p.run}/lauf.json`,
      `${REIHE_1A}/${p.variant}/${p.run}/ressourcen.json.gz`,
    ]),
  ];
}

/** Kennzahlen der früheren Reihe aus Git (nur gelesen). */
function ladeVorreihe(root, vertragSha) {
  const a = JSON.parse(
    execFileSync('git', ['show', `${VORREIHE_1A.commitAuswertung}:${VORREIHE_1A.pfad}`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
  const id = a.source.identity;
  if (id.contractSha256 !== vertragSha) throw new Error('daten-1a: Vorreihe mit anderem Vertrag');
  const fehl = a.comparisons.filter((c) => !c.passed);
  return {
    ...VORREIHE_1A,
    datumDaten: gitDatum(root, VORREIHE_1A.commitDaten),
    datumAuswertung: gitDatum(root, VORREIHE_1A.commitAuswertung),
    baseline: id.baselineCommit.slice(0, 8),
    gleicherSeed: id.orderSeed,
    fixtureSha: id.fixtureSha256.slice(0, 8),
    h1: { fehl: a.hypotheses.H1.failedComparisons, gesamt: a.hypotheses.H1.totalComparisons },
    h2: { fehl: a.hypotheses.H2.failedComparisons, gesamt: a.hypotheses.H2.totalComparisons },
    kontrolleFehl: fehl.filter((c) => c.variant === 'V1').length,
    absolutFehl: a.comparisons.filter((c) => !c.absolutePassed).length,
    vergleicheFehl: fehl.length,
  };
}

function gitDatum(root, commit) {
  // Committer-Datum in Ortszeit des Commits, z. B. 2026-11-07T16:19:22+01:00
  return execFileSync('git', ['show', '-s', '--format=%cI', commit], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}

/** @param {string} root docs/referat-thema-1 */
export function ladeDaten1A(root) {
  const roh = readFileSync(join(root, AUSWERTUNG_1A));
  const a = JSON.parse(roh);
  if (a.schemaVersion !== 1 || a.runs.length !== 25 || a.comparisons.length !== 80) {
    throw new Error('daten-1a: vollständige Auswertung (25 Läufe, 80 Vergleiche) erwartet');
  }
  const plan = JSON.parse(readFileSync(join(root, REIHE_1A, 'plan.json'), 'utf8'));
  const laufDatei = (v, b) => join(root, REIHE_1A, v, `block-0${b}`);
  const lauf = new Map();
  const ressourcen = new Map();
  for (const p of plan.runs) {
    const k = `${p.variant}/${p.block}`;
    lauf.set(k, JSON.parse(readFileSync(join(laufDatei(p.variant, p.block), 'lauf.json'), 'utf8')));
    ressourcen.set(
      k,
      JSON.parse(
        gunzipSync(readFileSync(join(laufDatei(p.variant, p.block), 'ressourcen.json.gz'))),
      ),
    );
  }

  const laeufe = (v) => a.runs.filter((r) => r.variant === v).sort((x, y) => x.block - y.block);
  const spacy = (v) => laeufe(v).map((r) => r.resources.find((c) => c.alias === 'spacy'));
  const ausgang = (v, k) => summe(laeufe(v).map((r) => r.analysis.outcomes[k] ?? 0));
  const grund = (v, k) => summe(laeufe(v).map((r) => r.analysis.fallbackReasons?.[k] ?? 0));

  const vergleiche = a.comparisons.map((c) => ({
    variante: c.variant,
    gegen: c.baselineVariant,
    block: c.block,
    aktion: c.action,
    basisMs: c.baseline.p95Ms,
    kandidatMs: c.candidate.p95Ms,
    deltaMs: c.absoluteChangeMs,
    relativ: c.relativeChange,
    relativBestanden: c.relativePassed,
    absolutBestanden: c.absolutePassed,
    bestanden: c.passed,
  }));
  const v3b5 = vergleiche.filter((x) => x.variante === 'V3' && x.block === 5);

  // Laufreihenfolge: Position im Plan (1–25) je Variante und Block
  const laufNr = new Map(plan.runs.map((p, i) => [`${p.variant}/${p.block}`, i + 1]));

  // Live-p95 je Lauf und Aktion (Auswertung), für das Punktdiagramm
  const laufP95 = a.runs.map((r) => ({
    variante: r.variant,
    block: r.block,
    nr: laufNr.get(`${r.variant}/${r.block}`),
    p95: Object.fromEntries(AKTIONEN.map(([k]) => [k, r.live[k].p95Ms])),
  }));

  // Konfiguration aus den Laufmanifesten (je Variante identisch; der Test prüft das)
  const manifest = (v) => lauf.get(`${v}/1`).manifest;
  const flags = manifest('V2').services.app.flags;
  // Optionale Analysedienste (8.9b Q&A-Klassifikation, Encoder der semantischen Wortwolke, LLM) in allen
  // Läufen aus; der Encoder-Container ist in keinem Manifest gestartet.
  const OPTIONAL_AUS = ['QA_NLP_ENABLED', 'WORD_CLOUD_SEMANTIC_ENABLED', 'OPEN_WEIGHT_LLM_ENABLED'];
  const optionalAus = [...lauf.values()].every(
    (l) =>
      OPTIONAL_AUS.every((k) => l.manifest.services.app.flags[k] === 'false') &&
      !Object.keys(l.manifest.services).some((n) => /encoder|llm/i.test(n)),
  );
  if (!optionalAus) throw new Error('daten-1a: optionale Analysedienste nicht in allen Läufen aus');
  const spacyClient = readFileSync(resolve(root, SPACY_CLIENT), 'utf8');
  const maxInFlight = Number(spacyClient.match(/SPACY_MAX_IN_FLIGHT = (\d+);/)?.[1]);
  if (!maxInFlight) throw new Error('daten-1a: SPACY_MAX_IN_FLIGHT nicht gefunden');

  // Vorab-Festlegung: Vertragshash der Reihe = Hash des Vertrags im Repo
  const vertrag = readFileSync(join(root, VERTRAG_1A));
  const vertragSha = createHash('sha256').update(vertrag).digest('hex');
  if (vertragSha !== a.source.identity.contractSha256) {
    throw new Error('daten-1a: Vertrag im Repo weicht vom Hash der Reihe ab');
  }
  const ersterLauf = [...lauf.values()].map((l) => l.manifest.startAt).sort()[0];
  const kette = KETTE_1A.map((k) => ({ ...k, datum: gitDatum(root, k.commit) }));
  const tageVorher = Math.floor((Date.parse(ersterLauf) - Date.parse(kette[0].datum)) / 86_400_000);

  // ---------------------------------------------------------------- explorativ (nachträglich)
  // Langsame Live-Aktionen (> 100 ms) je Lauf: V3/Block 5 gegen alle übrigen Läufe.
  const GRENZE_LANGSAM_MS = 100;
  const langsam = (k, aktion) =>
    lauf
      .get(k)
      .live.actions[aktion].latency.durationSamplesMs.filter((ms) => ms > GRENZE_LANGSAM_MS).length;
  const andere = [...lauf.keys()].filter((k) => k !== 'V3/5');
  const v3b5Lauf = lauf.get('V3/5');
  const ankunft = v3b5Lauf.live.lifecycle.arrivals;
  // Zuordnung Stichprobe i ↔ i-te Ankunft ist eine Näherung (Stichproben in Abschlussreihenfolge).
  const beitritte = v3b5Lauf.live.actions.join.latency.durationSamplesMs.map((ms, i) => ({
    tS: ankunft[i].scheduledAtMs / 1000,
    ms,
  }));
  const langsameBeitritte = beitritte.filter((b) => b.ms > GRENZE_LANGSAM_MS);
  const analyse = v3b5Lauf.analysis.analysis.calls.map((c) => ({
    startS: c.startedAtMs / 1000,
    dauerS: c.durationMs / 1000,
    ausgang: c.outcome,
    grund: c.normalizationFallbackReason,
  }));
  const cpuVerlauf = (k) =>
    ressourcen
      .get(k)
      .snapshots.filter((s) => s.phase === 'DURING')
      .map((s) => {
        const g = (al) =>
          s.containers.find((c) => c.alias === al)?.delta?.cpuPercent?.value ?? null;
        return { tS: s.atMs / 1000, app: g('app'), postgres: g('postgres'), spacy: g('spacy') };
      });
  const v3b5Cpu = cpuVerlauf('V3/5');
  const pgMax = (k) => {
    const v = cpuVerlauf(k).filter((p) => p.postgres !== null);
    const max = Math.max(...v.map((p) => p.postgres));
    return { max, tS: v.find((p) => p.postgres === max).tS };
  };
  const pgAndere = andere.map(pgMax);
  const lastAlle = [...ressourcen.values()].flatMap((r) =>
    r.snapshots.map((s) => s.host?.loadAverage?.value?.[0]).filter((x) => x != null),
  );
  const timeouts = analyse.filter((c) => c.grund === 'TIMEOUT');
  const v3TimeoutsGesamt = grund('V3', 'TIMEOUT');
  const wsP95 = (k) => lauf.get(k).live.websocket.connectLatency.p95Ms;

  // Gepoolte p95 je Variante (alle 5 Blöcke) und Spannweite der Lauf-p95 innerhalb einer Variante
  const proben = (v, aktion) =>
    [1, 2, 3, 4, 5].flatMap(
      (b) => lauf.get(`${v}/${b}`).live.actions[aktion].latency.durationSamplesMs,
    );
  const gepoolt = Object.fromEntries(
    VARIANTEN.map((v) => [
      v,
      Object.fromEntries(
        AKTIONEN.map(([k]) => [k, { p95: rang(proben(v, k), 0.95), n: proben(v, k).length }]),
      ),
    ]),
  );
  const streuung = Object.fromEntries(
    VARIANTEN.map((v) => [
      v,
      Object.fromEntries(AKTIONEN.map(([k]) => [k, spanne(laeufe(v).map((r) => r.live[k].p95Ms))])),
    ]),
  );

  // Laborreserve: Summe der Container-CPU je Lauf (Mittel im Fenster) und freier Host-Speicher
  const containerSumme = a.runs.map((r) => summe(r.resources.map((c) => c.cpuPercent ?? 0)));
  const appRam = a.runs.map(
    (r) => r.resources.find((c) => c.alias === 'app').lifetimePeakMemoryBytes / MiB,
  );

  const spacyKonfig = (v) => manifest(v).services.spacy;
  return {
    schwellen: {
      relativ: a.thresholds.relativeP95,
      absolutMs: a.thresholds.absoluteP95Ms,
      fehler: a.thresholds.errorRate,
      quizZielMs: a.thresholds.voteP95Ms,
      drosselung: a.thresholds.throttledPeriodRatio,
      speicher: a.thresholds.memoryRatio,
      verfuegbarkeit: a.thresholds.analysisUnavailableRate,
    },
    h1: { fehl: a.hypotheses.H1.failedComparisons, gesamt: a.hypotheses.H1.totalComparisons },
    h2: { fehl: a.hypotheses.H2.failedComparisons, gesamt: a.hypotheses.H2.totalComparisons },
    normalbetrieb: a.normalOperation,
    live: {
      geplant: summe(a.runs.map((r) => summe(Object.values(r.live).map((x) => x.planned)))),
      erfolgreich: summe(a.runs.map((r) => summe(Object.values(r.live).map((x) => x.succeeded)))),
      fehlgeschlagen: summe(a.runs.map((r) => summe(Object.values(r.live).map((x) => x.failed)))),
      quizMaxMs: Math.max(...a.runs.map((r) => r.live.vote.p95Ms)),
      jeLauf: Object.fromEntries(AKTIONEN.map(([k]) => [k, a.runs[0].live[k].planned])),
      laeufe: a.runs.length,
      jeAktion: Object.fromEntries(
        AKTIONEN.map(([k]) => [
          k,
          {
            geplant: summe(a.runs.map((r) => r.live[k].planned)),
            erfolgreich: summe(a.runs.map((r) => r.live[k].succeeded)),
          },
        ]),
      ),
    },
    laufP95,
    vergleiche,
    v3Block5MaxDeltaMs: Math.max(...v3b5.map((x) => x.deltaMs)),
    v2: {
      ramMiB: spanne(spacy('V2').map((s) => s.lifetimePeakMemoryBytes / MiB)),
      cpuProzent: spanne(spacy('V2').map((s) => s.cpuPercent)),
      drosselProzent: spanne(spacy('V2').map((s) => s.throttledPeriodRatio * 100)),
      analyseP95Ms: spanne(laeufe('V2').map((r) => r.analysis.successLatency.p95Ms)),
      erfolg: ausgang('V2', 'SUCCESS'),
      limitMiB: spacy('V2')[0].memoryLimitBytes / MiB,
    },
    v1: {
      ersatz: ausgang('V1', 'FALLBACK'),
      ersatzP95Ms: spanne(laeufe('V1').map((r) => r.analysis.fallbackLatency.p95Ms)),
    },
    v3: {
      cpuProzent: spanne(spacy('V3').map((s) => s.cpuPercent)),
      drosselProzent: spanne(spacy('V3').map((s) => s.throttledPeriodRatio * 100)),
      ramMiB: spanne(spacy('V3').map((s) => s.lifetimePeakMemoryBytes / MiB)),
      analyseP95Ms: spanne(laeufe('V3').map((r) => r.analysis.successLatency.p95Ms)),
      erfolg: ausgang('V3', 'SUCCESS'),
      ersatz: ausgang('V3', 'FALLBACK'),
      offen: ausgang('V3', 'IN_FLIGHT_AT_END'),
      timeouts: v3TimeoutsGesamt,
    },
    v4: {
      cpuProzent: spanne(spacy('V4').map((s) => s.cpuPercent)),
      ersatz: ausgang('V4', 'FALLBACK'),
      offen: ausgang('V4', 'IN_FLIGHT_AT_END'),
      ersatzTimeout: grund('V4', 'TIMEOUT'),
      ersatzGegendruck: grund('V4', 'SIDECAR_UNAVAILABLE'),
      /** Je Lauf gleich viele SIDECAR_UNAVAILABLE (Gegendruck bei zwei offenen Anfragen); sonst null. */
      gegendruckJeLauf: (() => {
        const w = new Set(laeufe('V4').map((r) => r.analysis.fallbackReasons.SIDECAR_UNAVAILABLE));
        return w.size === 1 ? [...w][0] : null;
      })(),
      ersatzP95Ms: spanne(laeufe('V4').map((r) => r.analysis.fallbackLatency.p95Ms)),
      weitergeleitet: summe(laeufe('V4').map((r) => r.proxy.forwarded)),
      empfangenJeLauf: laeufe('V4')[0].proxy.receivedNormalize,
      verzoegerungMs: laeufe('V4')[0].proxy.delayMs,
    },
    konfig: {
      optionalAus,
      timeoutMs: Number(flags.NLP_TIMEOUT_MS),
      maxInFlight,
      spacy: Object.fromEntries(
        ['V2', 'V3', 'V4'].map((v) => [
          v,
          {
            cpu: spacyKonfig(v).cpuLimit,
            speicherGiB: spacyKonfig(v).memoryLimitBytes / GiB,
            pids: spacyKonfig(v).pidsLimit,
          },
        ]),
      ),
      profil: plan.profile,
      dienste: Object.entries(manifest('V2').services).map(([alias, s]) => ({
        alias,
        cpu: s.cpuLimit,
        speicherGiB: s.memoryLimitBytes ? s.memoryLimitBytes / GiB : null,
        pids: s.pidsLimit,
      })),
      hosts: new Set(v3b5Lauf.analysis.analysis.calls.map((c) => c.host)).size,
      fixtureSessions: manifest('V1').fixtureImport.analysisSessions,
      seed: manifest('V1').orderSeed,
    },
    /** Analyse-p95 je Block (s): V1 Ersatz (lexikalisch), V2/V3 Erfolg, V4 Ersatz nach Timeout. */
    analyseJeBlockS: {
      V1: laeufe('V1').map((r) => r.analysis.fallbackLatency.p95Ms / 1000),
      V2: laeufe('V2').map((r) => r.analysis.successLatency.p95Ms / 1000),
      V3: laeufe('V3').map((r) => r.analysis.successLatency.p95Ms / 1000),
      V4: laeufe('V4').map((r) => r.analysis.fallbackLatency.p95Ms / 1000),
    },
    analyseGeplantJeVariante: summe(laeufe('V2').map((r) => r.analysis.planned)),
    /** Je Variante mit spaCy: Anteil gedrosselter Perioden (%) und Speicherspitze (MiB) je Block 1–5. */
    drosselung: Object.fromEntries(
      ['V2', 'V3', 'V4'].map((v) => [v, spacy(v).map((s) => s.throttledPeriodRatio * 100)]),
    ),
    speicher: Object.fromEntries(
      ['V2', 'V3', 'V4'].map((v) => [v, spacy(v).map((s) => s.lifetimePeakMemoryBytes / MiB)]),
    ),
    /** Gleiche Daten in jedem Lauf: Fixture-Hash und Korpusprüfung vor/nach jedem Lauf. */
    gleicheDaten: {
      fixture: new Set([...lauf.values()].map((l) => l.manifest.fixtureSha256)).size === 1,
      korpusUnveraendert: [...lauf.values()].every(
        (l) => l.analysis?.corpus?.unchanged === true || l.manifest.variant === 'V0',
      ),
      vertragInAllenLaeufen: [...lauf.values()].every(
        (l) => l.manifest.contractSha256 === a.source.identity.contractSha256,
      ),
    },
    vorab: {
      vorreihe: ladeVorreihe(root, vertragSha),
      kette,
      ersterLauf,
      tageVorher,
      vertragSha: vertragSha.slice(0, 8),
    },
    labor: {
      containerCpuProzent: spanne(containerSumme),
      minFreiGiB: Math.min(...a.runs.map((r) => r.collectorHost.minAvailableMemoryBytes)) / GiB,
      /** Für „mindestens“: auf eine Nachkommastelle abgerundet (11,65 → 11,6), wie im Handout. */
      minFreiGiBAb:
        Math.floor(
          (Math.min(...a.runs.map((r) => r.collectorHost.minAvailableMemoryBytes)) / GiB) * 10,
        ) / 10,
      swapUnberuehrt: a.runs.every(
        (r) => r.collectorHost.minSwapFreeBytes === a.runs[0].collectorHost.minSwapFreeBytes,
      ),
      appRamMiB: spanne(appRam),
      speicherGiB: a.source.hardware.memoryBytes / GiB,
    },
    explorativ: {
      grenzeMs: GRENZE_LANGSAM_MS,
      laufNr: laufNr.get('V3/5'),
      langsam: Object.fromEntries(AKTIONEN.map(([k]) => [k, langsam('V3/5', k)])),
      langsamAndereMax: Math.max(
        ...andere.flatMap((k) => AKTIONEN.map(([aktion]) => langsam(k, aktion))),
      ),
      beitritte,
      fenster: spanne(langsameBeitritte.map((b) => b.tS)),
      fensterS: Math.round(
        Math.max(...langsameBeitritte.map((b) => b.tS)) -
          Math.min(...langsameBeitritte.map((b) => b.tS)),
      ),
      analyse,
      timeouts: timeouts.length,
      timeoutStartS: timeouts.map((c) => c.startS),
      cpu: v3b5Cpu,
      appCpuMax: Math.max(...v3b5Cpu.map((p) => p.app ?? 0)),
      pgMax: pgMax('V3/5'),
      pgAndere: spanne(pgAndere.map((p) => p.max)),
      pgAndereZeitS: spanne(pgAndere.map((p) => p.tS)),
      wsP95: wsP95('V3/5'),
      wsP95Andere: spanne(andere.map(wsP95)),
      lastMax: Math.max(...lastAlle),
      gepoolt,
      /** Gepoolte p95 V2 − V1 (ms), kleinste und größte Abweichung über die vier Aktionen. */
      abweichungV2V1: spanne(AKTIONEN.map(([k]) => gepoolt.V2[k].p95 - gepoolt.V1[k].p95)),
      streuung,
      /** Grobe Rechnung: Wahrscheinlichkeit, dass eine wirkungslose Komponente alle 20 Vergleiche besteht. */
      zufallsChance:
        (1 -
          vergleiche.filter((x) => x.variante === 'V1' && !x.bestanden).length /
            a.hypotheses.H1.totalComparisons) **
        a.hypotheses.H1.totalComparisons,
    },
    herkunft: {
      commit: a.source.identity.baselineCommit.slice(0, 8),
      auswertungSha: createHash('sha256').update(roh).digest('hex').slice(0, 16),
      cpus: a.source.hardware.cpus,
      kernel: a.source.hardware.kernel,
      os: a.source.hardware.os,
      datei: AUSWERTUNG_1A,
    },
  };
}
