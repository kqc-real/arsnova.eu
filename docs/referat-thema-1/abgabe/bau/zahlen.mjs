// Datenmodul: jede Zahl auf Jonas' Folien und im Handout kommt von hier.
// 1B wird aus den committeten Ergebnis-JSONs gerechnet, 1C steht als Konstante
// mit wörtlichem Beleg aus der Quelle (der Test prüft den Beleg gegen die Datei).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MESSUNG = 'evidenz/1B/messung/';
const DATEIEN = {
  lauf: `${MESSUNG}2026-11-13-lauf.json`,
  kalt: [
    `${MESSUNG}2026-11-13-lauf-kalt.json`,
    `${MESSUNG}2026-11-13-lauf-kalt-2.json`,
    `${MESSUNG}2026-11-13-lauf-kalt-3.json`,
    `${MESSUNG}2026-11-13-lauf-kalt-4.json`,
    `${MESSUNG}2026-11-13-lauf-kalt-5.json`,
  ],
  c0: `${MESSUNG}2026-11-13-kontrolle-c0.json`,
  b0: `${MESSUNG}2026-11-13-lauf-b0.json`,
};

function median(werte) {
  const s = [...werte].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 1B-Kennzahlen, ungerundet. Warm = Aufträge 2-10 (n = 9), Kalt = Auftrag 1 bzw. fünf frische Läufe (ADR 1B-011). */
export function zahlen1B(lauf, kaltLaeufe, c0, b0) {
  const k = lauf.zerlegung.kennzahlen;
  // Nachtrag M2-M4 (Kalt, C0, B0) lief auf einem anderen Commit als der Hauptlauf.
  // Rechner: Kalt- und B0-JSON nennen ihn; das C0-JSON nennt keinen, das Protokoll
  // (evidenz/1B/2026-11-13-lauf.md, Nachtrag) sagt "Rechner wie oben" (gleiche Maschine).
  const nachtragLaeufe = [...kaltLaeufe, c0, b0];
  const nachtragCommit = new Set(nachtragLaeufe.map((l) => l.commit));
  const nachtragRechner = new Set([...kaltLaeufe, b0].map((l) => l.rechner));
  if (nachtragCommit.size !== 1 || nachtragRechner.size !== 1) {
    throw new Error('Nachtrag-Laeufe haben uneinheitlichen Commit oder Rechner');
  }
  const kaltS = kaltLaeufe.map((l) => l.zerlegung.kennzahlen.kalt.jobMsMedian / 1000);
  const kaltAnteil = kaltLaeufe.map((l) => l.zerlegung.kennzahlen.kalt.inferAnteilMedian);
  return {
    netzMs: k.netz.medianMs,
    netzMaxMs: k.netz.maxMs,
    transportMs: median(lauf.zerlegung.auftraege.map((a) => a.netzMs + a.serverOhneInferenzMs)),
    adapterMs: k.adapter.medianMs,
    inferAnteil: k.inferAnteilMedian,
    jobWarmMs: k.warm.jobMsMedian,
    inferWarmMs: k.warm.inferMsMedian,
    jobKaltMs: k.kalt.jobMsMedian,
    // Spanne der warmen Aufträge (2-10) im gewerteten Lauf, in s: ein Lauf, keine unabhängigen Wiederholungen.
    jobWarmSpanneS: (() => {
      const w = lauf.zerlegung.auftraege.slice(1).map((a) => a.jobMs / 1000);
      return [Math.min(...w), Math.max(...w)];
    })(),
    kaltMedianS: median(kaltS),
    kaltSpanneS: [Math.min(...kaltS), Math.max(...kaltS)],
    // H_B3 kalt misst den Inferenzanteil je Lauf, dazu Netz im Median über die fünf Läufe (Nachtrag M4).
    kaltAnteilSpanne: [Math.min(...kaltAnteil), Math.max(...kaltAnteil)],
    kaltNetzMedianMs: median(kaltLaeufe.map((l) => l.zerlegung.kennzahlen.netz.medianMs)),
    // Transportanteil T_transport / T_job, Median je Auftrag über alle Aufträge (ADR 1B-011).
    transportAnteil: median(
      lauf.zerlegung.auftraege.map((a) => (a.netzMs + a.serverOhneInferenzMs) / a.jobMs),
    ),
    // Server ohne Inferenz (HTTP, Template, Tokenisierung), Median je Auftrag (ADR 1B-011: 17,4 ms).
    serverOhneMedianMs: median(lauf.zerlegung.auftraege.map((a) => a.serverOhneInferenzMs)),
    // T_host: Rückkehr von qa.requestSummary im Treiber, Median über alle Aufträge (ADR 1B-011).
    hostMedianMs: median(lauf.treiber.auftraege.map((a) => a.hostReturnMs)),
    // Höchster Speicher des Runtime-Containers im Lauf (Proben alle 15 s), in GB (10^9 Byte).
    speicherMaxGb: lauf.speicher.maxBytes / 1e9,
    c0DiffMs: c0.kennzahlen.differenzMs,
    b0JobMs: b0.b0.kennzahlen.medianJobMs,
    anzahl: lauf.n,
    nWarm: k.warm.n,
    nKaltLaeufe: kaltLaeufe.length,
    // Aufträge, deren Modellantwort das Tor verworfen hat (Ersatz extraktiv, invalid_response).
    verworfen: lauf.zerlegung.auftraege.filter(
      (a) => a.effectiveMode === 'extractive' && a.fallbackReason === 'invalid_response',
    ).length,
    nB0: b0.b0.kennzahlen.n,
    commit: lauf.commit,
    rechner: lauf.rechner,
    herkunft: {
      hauptlauf: { commit: lauf.commit, rechner: lauf.rechner, anzahl: lauf.n },
      nachtrag: { commit: [...nachtragCommit][0], rechner: [...nachtragRechner][0] },
    },
  };
}

/** Zahl im de-DE-Format mit festen Nachkommastellen; Minuszeichen U+2212. */
export function fmt(wert, stellen = 0) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  })
    .format(wert)
    .replace('-', '−');
}

const NACHLAUF = 'evidenz/1C/2026-11-09-labor-nachlauf.md';
const NACHLAUF_STAND = 'def56700 (Branch f746ffba)';

/** quelle relativ zu docs/referat-thema-1/. Laptop = ThinkPad P50, PC = i7-8700. */
export const ZAHLEN_1C = {
  requestMs: {
    wert: 29.4,
    text: 'Host-Aufruf (requestMs), Median in ms',
    quelle: NACHLAUF,
    beleg: 'Median 29,4 ms, max. 50,7 ms',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  validierungMs: {
    wert: 1.2,
    text: 'Strikte Validierung je Kontextaufbau, ms',
    quelle: 'evidenz/1C/2026-10-24-teil2.md',
    beleg: 'Median(Validierung) / Median(prepare warm) = 1,2 / 76,2 = **1,6 %**',
    rechner: 'Laptop (ThinkPad P50)',
    commit: '248029dc',
  },
  validierungAnteilProzent: {
    wert: 1.6,
    text: 'Anteil der Validierung an einem warmen Kontextaufbau, %',
    quelle: 'evidenz/1C/2026-10-24-teil2.md',
    beleg: '1,2 / 76,2 = **1,6 %**',
    rechner: 'Laptop (ThinkPad P50)',
    commit: '248029dc',
  },
  q: {
    wert: 0.318,
    text: 'Verhältnis echte zu geschätzten Prompt-Tokens (q), Median',
    quelle: NACHLAUF,
    beleg: 'Median **0,318** (95 %-KI 0,316–0,318)',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  inferenzS: {
    wert: 223.7,
    text: 'Inferenz (Prefill + Ausgabe), Median in s',
    quelle: NACHLAUF,
    beleg: '**223,7 s** (209,6–248,3)',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  inferenzRuhigS: {
    wert: 163.4,
    text: 'Inferenz (Prefill + Ausgabe), Median in s, Laborlauf 2026-11-05',
    quelle: 'evidenz/1C/2026-11-05-labor.md',
    beleg: '163,4 s (Prefill 76,2 s, Ausgabe 86,6 s)',
    rechner: 'Laptop (ThinkPad P50)',
    commit: '9f230abc',
  },
  kalibrierungPcS: {
    wert: 98.7,
    text: 'Kalibrierung I = prompt_ms + predicted_ms am PC, s',
    quelle: 'adr/1C-020-timeout-300-s-und-kalibrierungsregel.md',
    beleg: 'I = 98,7 s (Prefill 43 701,9 ms, Ausgabe 55 040,9 ms)',
    rechner: 'PC (i7-8700)',
    commit: '9f230abc',
  },
  speicherDeltaGb: {
    wert: 0.419,
    text: 'Wachstum des Container-Speichers je Auftrag, GB (Median)',
    quelle: NACHLAUF,
    beleg: 'Median Δ je Auftrag **0,419 GB**',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  oomAuftrag: {
    wert: 19,
    text: 'Auftrag, in dem die Runtime per OOM beendet wird',
    quelle: NACHLAUF,
    beleg: 'diesmal schon im 19. Auftrag',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  oomAuftrag9f230abc: {
    wert: 21,
    text: 'OOM-Kill beim 21. Auftrag (Aufwärmlauf mitgezählt)',
    quelle: 'adr/1C-024-prompt-cache-ram-begrenzen.md',
    beleg: 'führt beim 21. Auftrag zum OOM-Kill',
    rechner: 'Laptop (ThinkPad P50) und PC (i7-8700)',
    commit: '9f230abc',
  },
  nachpruefungAnteilProzent: {
    wert: 0.03,
    text: 'Anteil der Nachprüfung (prepare (3)) am Auftrag, %',
    quelle: NACHLAUF,
    beleg: 'Anteil s = prepare (3) / `totalMs` = 0,03 %',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  yesno: {
    wert: '5 von 5',
    text: 'YESNO endet als source_changed (Blitzlicht-Befund T3.1)',
    quelle: 'adr/1C-016-zeitabhaengiger-hash-blitzlicht.md',
    beleg: 'YESNO 5 von 5 `source_changed` bei aus Budgetgründen gekürztem Blitzlicht-Bereich',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  fullContextN4: {
    wert: '0 von 20',
    text: 'Aufträge mit Endstatus full-context (N4)',
    quelle: 'adr/1C-018-quality-gate-verwirft-echte-antworten.md',
    beleg: 'Anteil `full-context` 0 von 20 (Wilson 0–16,1 %)',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  fullContextVorGate: {
    wert: '19 von 20',
    text: 'Aufträge mit Endstatus full-context vor dem Gate (L4, Instruktion v2)',
    quelle: 'adr/1C-018-quality-gate-verwirft-echte-antworten.md',
    beleg: '19 von 20 `full-context`, kein `invalid_response`',
    rechner: 'Laptop (ThinkPad P50)',
    commit: '9f230abc',
  },
  n1LaeufeMitAufruf: {
    wert: 18,
    text: 'Messläufe mit Completion-Aufruf, in denen Vorschau = Nutzlast geprüft wurde (N1)',
    quelle: NACHLAUF,
    beleg: 'In allen **18** Messläufen mit Completion-Aufruf 0 Abweichungen',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  gateAntwortenGesamt: {
    wert: 28,
    text: 'Aufgezeichnete Modellantworten im Nachlauf, alle gegen das Gate geprüft',
    quelle: NACHLAUF,
    beleg: 'Alle 28 aufgezeichneten Modellantworten',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  bytesJeToken: {
    wert: 3.15,
    text: 'Bytes je echtem Prompt-Token im Mittel (N2)',
    quelle: NACHLAUF,
    beleg: '3,15 Byte je Token',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  m7VorhersageLaptop: {
    wert: 0.99,
    text: 'Mittlere vorhergesagte Verwerfungswahrscheinlichkeit unter Voting (M7-Modell, Laborfenster)',
    quelle: 'adr/1C-017-m7-empfehlung-zurueckgehalten.md',
    beleg: 'mittlere Vorhersage mit dem gemessenen Fenster 0,99 (Laptop) und 0,97 (PC)',
    rechner: 'Laptop (ThinkPad P50)',
    commit: '9f230abc',
  },
  m7VorhersagePc: {
    wert: 0.97,
    text: 'Mittlere vorhergesagte Verwerfungswahrscheinlichkeit unter Voting (M7-Modell, Laborfenster)',
    quelle: 'adr/1C-017-m7-empfehlung-zurueckgehalten.md',
    beleg: 'mittlere Vorhersage mit dem gemessenen Fenster 0,99 (Laptop) und 0,97 (PC)',
    rechner: 'PC (i7-8700)',
    commit: '9f230abc',
  },
  gateAntworten: {
    wert: '0 von 28',
    text: 'Aufgezeichnete Modellantworten, die das Quality-Gate bestehen',
    quelle: NACHLAUF,
    beleg: '**0 von 28 bestehen.**',
    rechner: 'Laptop (ThinkPad P50)',
    commit: NACHLAUF_STAND,
  },
  ablationNeuEnglisch: {
    wert: '22 von 28',
    text: 'Nachlauf-Antworten, die eine Wortzählung als englisch einstuft (Gate-Ablation, nachträglich)',
    quelle: 'evidenz/1C/2026-11-16-gate-ablation.md',
    beleg: 'stuft 22 der 28 Nachlauf-Antworten als englisch ein',
    rechner: 'Laptop (ThinkPad P50), offline ausgewertet',
    commit: NACHLAUF_STAND,
  },
  ablationAltMeta: {
    wert: '26 von 59',
    text: 'Antworten von 9f230abc, die eine Inhaltsregel des Gates verletzen (Gate-Ablation, H_A2)',
    quelle: 'evidenz/1C/2026-11-16-gate-ablation.md',
    beleg: 'Auf `9f230abc` verletzen 26 von 59 Antworten (44 %) eine Inhaltsregel',
    rechner: 'Laptop (ThinkPad P50) und PC (i7-8700), offline ausgewertet',
    commit: '9f230abc',
  },
};

const sha256 = (pfad) => createHash('sha256').update(readFileSync(pfad)).digest('hex');
const json = (pfad) => JSON.parse(readFileSync(pfad, 'utf8'));

/** root = docs/referat-thema-1. Liefert 1B-Zahlen, 1C-Konstanten und Prüfsummen der gelesenen Quellen. */
export function ladeZahlen(root) {
  const p = (rel) => resolve(root, rel);
  const kalt = DATEIEN.kalt.map((f) => json(p(f)));
  const b1 = zahlen1B(json(p(DATEIEN.lauf)), kalt, json(p(DATEIEN.c0)), json(p(DATEIEN.b0)));
  const quellen = {
    lauf: sha256(p(DATEIEN.lauf)),
    c0: sha256(p(DATEIEN.c0)),
    b0: sha256(p(DATEIEN.b0)),
  };
  DATEIEN.kalt.forEach((f, i) => {
    quellen[`kalt${i + 1}`] = sha256(p(f));
  });
  return { b1, c1: ZAHLEN_1C, quellen };
}
