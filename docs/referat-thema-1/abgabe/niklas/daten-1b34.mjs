// Zahlen für Niklas' Teil 1B, Schritte 3–4 (Störung und Betriebsaufwand). Liest alle gewerteten
// Ergebnis-JSONs unter `evidenz/1B/messung/` (auch `.json.gz`, ohne `dev-`):
// - Störreihen `<Datum>-lauf-<variante>-<summary|label>[-NN].json`; Teilreihen (`-01` … `-03`) einer Variante
//   werden gepoolt wie in Niklas' Gesamtauswertungen;
// - gerichtete Breaker-Folgen `…-lauf-breaker-<f1|l3>-summary.json` (ohne Live-Last);
// - S1 (Same-Host) `…-lauf-s1-<label|summary>.json` (andere Struktur: Live und Aufträge unter `treiber`);
// - die Offline-Transportauswertung `2026-11-16-transportauswertung.json`.
// Fehlen die Störreihen, liefert die Funktion `vorhanden: false`, und die Folien zeigen sichtbare Platzhalter
// ([Niklas]); abgabe-lokal.mjs blockiert dann die Abgabe.
//
// Rechenwege wie Niklas' Auswertung: Live-p95 je Aktion gepoolt über alle Fenster mit fasseLaufzeitenZusammen;
// Summary-Zeiten sind Job-Zeiten (experiment.jobs[].jobMs, so lauten die Kriterien), Label-Zeiten
// Client-Zeiten (clientWaitMs; die Label-API legt keine Job-Zeit offen). Gegenprobe: daten-1b34.test.mjs.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { liesJson } from '../../evidenz/1B/json-lesen.mjs';
import { fasseLaufzeitenZusammen } from '../../../../scripts/load/lib/artillery-live-messungen.mjs';

export const MESSUNG_1B = 'evidenz/1B/messung';
const MUSTER =
  /^(\d{4}-\d{2}-\d{2})-lauf-(?!dev-)([a-z0-9]+(?:-[a-z0-9]+)?)-(summary|label)(?:-(\d{2}))?\.json(?:\.gz)?$/;
const TRANSPORT = '2026-11-16-transportauswertung.json';
/**
 * Netzverzögerung der Label-Störungen L1/L2 in ms: Definition laut 1B/archiv/1B-3u4-Planung.md (Störvarianten), in den
 * Ergebnis-JSONs nicht enthalten; im Mitschnitt bestätigt (SYN bis SYN/ACK im Median 50,7 bzw. 500,6 ms,
 * Protokolle l1-label-01/-02 und l2-label).
 */
export const VERZOEGERUNG_1B34_MS = { l1: 50, l2: 500 };
const AKTIONEN = ['join', 'vote', 'qaSubmit', 'blitzlicht'];
const MiB = 1048576;

const median = (werte) => {
  const s = [...werte].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Dateien, die ladeDaten1B34 liest (relativ zu docs/referat-thema-1); für das Bau-Manifest. */
export function eingaben1B34(root) {
  const ordner = join(root, MESSUNG_1B);
  if (!existsSync(ordner)) return [];
  // Ein Lauf zählt einmal, auch wenn .json und .json.gz nebeneinander liegen (.json hat Vorrang).
  const alle = readdirSync(ordner);
  const namen = alle.filter((n) => MUSTER.test(n));
  const laeufe = [...new Set(namen.map((n) => n.replace(/\.gz$/, '')))]
    .sort()
    .map((n) => `${MESSUNG_1B}/${namen.includes(n) ? n : `${n}.gz`}`);
  return alle.includes(TRANSPORT) ? [...laeufe, `${MESSUNG_1B}/${TRANSPORT}`] : laeufe;
}

/** Rechner kurz („i7-10700K, Hyper-V“); Testdaten dürfen einen String liefern. */
function rechnerKurz(j) {
  const r = j.umgebung?.rechner ?? j.rechner;
  if (typeof r === 'string') return r.match(/i\d-\w+/)?.[0] ?? r;
  if (!r) return null;
  return `${r.cpu?.match(/i\d-\w+/)?.[0] ?? r.cpu}${j.umgebung?.hypervisor?.name ? `, ${j.umgebung.hypervisor.name}` : ''}`;
}

/** Live-p95, Plan und Fehler je Aktion, gepoolt über alle Fenster. */
function liveAus(fenster) {
  return Object.fromEntries(
    AKTIONEN.map((a) => {
      const proben = fenster.flatMap((w) => w.actions?.[a]?.latency?.durationSamplesMs ?? []);
      return [
        a,
        {
          p95Ms: fasseLaufzeitenZusammen(proben).p95Ms,
          geplant: fenster.reduce((s, w) => s + (w.actions?.[a]?.planned ?? 0), 0),
          fehler: fenster.reduce((s, w) => s + (w.actions?.[a]?.failed ?? 0), 0),
        },
      ];
    }),
  );
}

/**
 * Eine Reihe aus einer oder mehreren Teildateien (gleiche Variante und gleicher Consumer).
 * @param {object[]} teile geparste Ergebnis-JSONs
 */
function reihe(teile, { datei, dateien, datum, variante, auftrag }) {
  const j0 = teile[0];
  // S1 legt Live-Fenster und Aufträge nur unter `treiber` ab; Störreihen zusätzlich unter `experiment`.
  const fenster = teile.flatMap(
    (j) => j.experiment?.live?.windows ?? j.treiber?.live?.windows ?? [],
  );
  const live = liveAus(fenster);
  const exJobs = teile.flatMap((j) => j.experiment?.jobs ?? []);
  const auftraege = teile.flatMap((j) => j.treiber?.auftraege ?? []);
  const jobs = exJobs.map((x) => x.jobMs).filter((x) => Number.isFinite(x));
  const client = (exJobs.length ? exJobs : auftraege)
    .map((x) => x.clientWaitMs)
    .filter((x) => Number.isFinite(x));
  const zeitArt = auftrag === 'label' ? 'client' : 'job';
  const zeiten = zeitArt === 'client' ? client : jobs;
  const gruende = {};
  for (const x of exJobs.length ? exJobs : auftraege) {
    const g = x.fallbackReason ?? x.labelSettlement ?? x.effectiveMode ?? 'unbekannt';
    gruende[g] = (gruende[g] ?? 0) + 1;
  }
  const res = auftraege.map((x) => x.measurement?.resources).filter(Boolean);
  const cfg = j0.experiment?.config ?? j0.config ?? {};
  const labelTimeout = Number(j0.settings?.OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS) || null;
  return {
    datei,
    dateien,
    teile: teile.length,
    datum,
    variante,
    auftrag,
    n: teile.reduce((s, j) => s + (j.experiment?.config?.n ?? j.config?.n ?? j.n ?? 0), 0) || null,
    // Wirksame Frist des Consumers: Label 30 s (OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS), Summary das Laborbudget.
    timeoutMs:
      auftrag === 'label' && labelTimeout
        ? labelTimeout
        : Number(cfg.timeoutMs ?? j0.timeoutMs) || null,
    commit: String(j0.commit ?? '').slice(0, 8),
    commits: [...new Set(teile.map((j) => String(j.commit ?? '').slice(0, 8)))],
    rechner: rechnerKurz(j0),
    vms: (j0.umgebung?.vms ?? []).map((v) => `${v.name} ${v.vcpu} vCPU/${v.ramGib} GiB`),
    vcpus: (j0.umgebung?.vms ?? []).map((v) => v.vcpu),
    jobsMs: jobs,
    jobMedianMs: median(jobs),
    jobSpanneMs: jobs.length ? [Math.min(...jobs), Math.max(...jobs)] : null,
    clientMs: client,
    zeitArt,
    zeitenMs: zeiten,
    zeitMedianMs: median(zeiten),
    zeitSpanneMs: zeiten.length ? [Math.min(...zeiten), Math.max(...zeiten)] : null,
    gruende,
    uebernommen: auftraege.filter((x) => x.labelModelAccepted === true).length,
    live,
    liveFehler: AKTIONEN.reduce((s, a) => s + live[a].fehler, 0),
    liveGeplant: AKTIONEN.reduce((s, a) => s + live[a].geplant, 0),
    appRssMaxMiB: res.length ? Math.max(...res.map((r) => r.maxRssBytes / MiB)) : null,
    appCpuMax: res.length ? Math.max(...res.map((r) => r.maxCpuPercent)) : null,
    placement: j0.placement ?? null,
  };
}

/** Gerichtete Breaker-Folge: je Auftrag Job-Zeit, Grund und Zahl der Verbindungen zur Runtime. */
function folge(j, datei) {
  return {
    datei,
    commit: String(j.commit ?? '').slice(0, 8),
    timeoutMs: Number(j.experiment?.config?.timeoutMs) || null,
    fakeDelayMs: Number(j.experiment?.config?.fakeDelayMs) || null,
    rechner: rechnerKurz(j),
    jobs: (j.experiment?.jobs ?? []).map((x) => ({
      jobMs: x.jobMs,
      clientMs: x.clientWaitMs,
      grund: x.fallbackReason,
      verbindungen: x.transport?.connections ?? null,
      resets: x.transport?.resets ?? null,
      posts: x.transport?.posts ?? null,
    })),
  };
}

/** @param {string} root docs/referat-thema-1 */
export function ladeDaten1B34(root) {
  const gruppen = new Map();
  const breaker = {};
  const s1 = {};
  let transport = null;
  for (const pfad of eingaben1B34(root)) {
    const name = pfad.split('/').pop();
    if (name === TRANSPORT) {
      const t = liesJson(join(root, pfad));
      transport = {
        datei: pfad,
        commit: String(t.analysisCommit ?? '').slice(0, 8),
        label: t.label?.stats
          ? {
              n: t.label.stats.n,
              netzMedianMs: t.label.stats.networkMedianMs,
              transportMedianMs: t.label.stats.transportMedianMs,
              anteilMedianProzent: t.label.stats.transportOverClientMedianPercent,
              anteilMaxProzent: t.label.stats.transportOverClientMaxPercent,
            }
          : null,
        summary: t.summary?.stats
          ? {
              n: t.summary.stats.n,
              netzMedianMs: t.summary.stats.networkMedianMs,
              transportMedianMs: t.summary.stats.transportMedianMs,
            }
          : null,
      };
      continue;
    }
    const [, datum, variante, auftrag] = name.match(MUSTER);
    const j = liesJson(join(root, pfad));
    if (variante.startsWith('breaker-')) {
      breaker[variante.slice('breaker-'.length)] = folge(j, pfad);
      continue;
    }
    if (variante === 's1') {
      s1[auftrag] = reihe([j], { datei: pfad, dateien: [pfad], datum, variante, auftrag });
      continue;
    }
    if (!j.experiment) continue; // Jonas' Läufe (Schritte 1–2) haben kein experiment-Feld
    const schluessel = `${variante}|${auftrag}`;
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, { datum, variante, auftrag, teile: [] });
    gruppen.get(schluessel).teile.push({ pfad, j });
  }
  const laeufe = [...gruppen.values()].map((g) =>
    reihe(
      g.teile.map((t) => t.j),
      {
        datei: g.teile[0].pfad,
        dateien: g.teile.map((t) => t.pfad),
        datum: g.datum,
        variante: g.variante,
        auftrag: g.auftrag,
      },
    ),
  );
  const finde = (v, a = 'summary') => laeufe.find((l) => l.variante === v && l.auftrag === a);
  return {
    vorhanden: laeufe.length > 0,
    laeufe,
    finde,
    breaker: breaker.f1 && breaker.l3 ? breaker : null,
    s1: s1.label && s1.summary ? s1 : null,
    transport,
    schwellen: schwellen1B34(root),
  };
}

/**
 * Vorab festgelegte Schwellen für Schritt 3 (1B/archiv/1B-3u4-Planung.md, Tabelle „Hypothesen und vorab festgelegte
 * Schwellen“, auf Niklas' Zweig feature-1B-private-inference-3-4 seit Commit 5e758d0a unverändert).
 * Datum aus Git, wenn der Commit lokal vorliegt.
 */
export const SCHWELLEN_1B34 = {
  commit: '5e758d0a',
  datei: 'docs/referat-thema-1/1B/archiv/1B-3u4-Planung.md',
  p95Faktor: 1.1,
  fallbackPufferMs: 1000,
  f1MedianMaxMs: 2000,
  f2ZuF1Min: 10,
};

function schwellen1B34(root) {
  let datum = null;
  try {
    datum = execFileSync('git', ['show', '-s', '--format=%cI', SCHWELLEN_1B34.commit], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    datum = null;
  }
  return { ...SCHWELLEN_1B34, datum };
}
