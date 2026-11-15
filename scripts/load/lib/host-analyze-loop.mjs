import { setTimeout } from 'node:timers/promises';
import { fasseLaufzeitenZusammen } from './artillery-live-messungen.mjs';

export const ANALYSE_STANDARDWERTE = Object.freeze({
  durationMs: 300_000,
  intervalMs: 10_000,
  offsetsMs: Object.freeze([0, 2000, 4000, 6000, 8000]),
  drainMs: 60_000,
  requestTimeoutMs: 60_000,
});

export const monotoneUhr = {
  now: () => performance.now(),
  async waitUntil(ziel, signal) {
    // Timer können Bruchteile von Millisekunden zu früh aufwachen.
    while (performance.now() < ziel) {
      await setTimeout(
        Math.min(2_147_483_647, Math.max(1, Math.ceil(ziel - performance.now()))),
        undefined,
        { signal },
      );
    }
    signal?.throwIfAborted();
  },
};

export function erstelleAnalyseZeitplan({
  durationMs = ANALYSE_STANDARDWERTE.durationMs,
  intervalMs = ANALYSE_STANDARDWERTE.intervalMs,
  offsetsMs = ANALYSE_STANDARDWERTE.offsetsMs,
} = {}) {
  if (
    ![durationMs, intervalMs].every((wert) => Number.isSafeInteger(wert) && wert > 0) ||
    !Array.isArray(offsetsMs) ||
    offsetsMs.length < 1 ||
    offsetsMs.length > 5 ||
    new Set(offsetsMs).size !== offsetsMs.length ||
    offsetsMs.some((wert) => !Number.isSafeInteger(wert) || wert < 0 || wert >= intervalMs) ||
    Math.ceil(durationMs / intervalMs) * offsetsMs.length > 100_000
  ) {
    throw new Error(
      'Ungültiger Analysezeitplan: positive Millisekundenwerte, eindeutige Versätze und höchstens 100000 Aufrufe erforderlich.',
    );
  }
  return offsetsMs
    .flatMap((versatz, hostIndex) => {
      const aufrufe = [];
      for (let zeit = versatz; zeit < durationMs; zeit += intervalMs) {
        aufrufe.push({ hostIndex, host: `host-${hostIndex + 1}`, scheduledAtMs: zeit });
      }
      return aufrufe;
    })
    .sort((links, rechts) => links.scheduledAtMs - rechts.scheduledAtMs);
}

const FEHLERCODES = new Set([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PRECONDITION_FAILED',
  'TOO_MANY_REQUESTS',
  'TIMEOUT',
  'INTERNAL_SERVER_ERROR',
  'SERVICE_UNAVAILABLE',
  'CLIENT_CLOSED_REQUEST',
]);
const MESSFEHLER = new Set(['TIMEOUT', 'ABORTED', 'INVALID_RESPONSE', 'CORPUS_MISMATCH']);

export function bestimmeAnalyseFehler(fehler) {
  if (MESSFEHLER.has(fehler?.messCode))
    return { outcome: fehler.messCode, errorCode: fehler.messCode };
  if (FEHLERCODES.has(fehler?.data?.code))
    return {
      outcome: fehler.data.code === 'TIMEOUT' ? 'TIMEOUT' : 'REJECTED',
      errorCode: fehler.data.code,
    };
  return {
    outcome: 'ERROR',
    errorCode: fehler?.cause?.name === 'TypeError' ? 'TRANSPORT_ERROR' : 'OTHER',
  };
}

function messfehler(code) {
  return Object.assign(new Error('Analyseaufruf nicht abgeschlossen.'), { messCode: code });
}

async function begrenzterAufruf(aufrufen, { signal, uhr, requestTimeoutMs }) {
  const timer = new AbortController();
  let abbrechen;
  const abbruch = new Promise((_, reject) => {
    abbrechen = () => reject(messfehler('ABORTED'));
    if (signal.aborted) abbrechen();
    else signal.addEventListener('abort', abbrechen, { once: true });
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        if (signal.aborted) throw messfehler('ABORTED');
        return aufrufen();
      }),
      uhr.waitUntil(uhr.now() + requestTimeoutMs, timer.signal).then(() => {
        throw messfehler('TIMEOUT');
      }),
      abbruch,
    ]);
  } finally {
    timer.abort();
    signal.removeEventListener('abort', abbrechen);
  }
}

export async function fuehreAnalyseZeitplanAus({
  aufrufen,
  uhr = monotoneUhr,
  signal = new AbortController().signal,
  startAtMs = uhr.now(),
  durationMs = ANALYSE_STANDARDWERTE.durationMs,
  intervalMs = ANALYSE_STANDARDWERTE.intervalMs,
  offsetsMs = ANALYSE_STANDARDWERTE.offsetsMs,
  drainMs = ANALYSE_STANDARDWERTE.drainMs,
  requestTimeoutMs = ANALYSE_STANDARDWERTE.requestTimeoutMs,
}) {
  const plan = erstelleAnalyseZeitplan({ durationMs, intervalMs, offsetsMs });
  if (
    !Number.isFinite(startAtMs) ||
    !Number.isSafeInteger(drainMs) ||
    drainMs < 0 ||
    drainMs > 60_000 ||
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs <= 0 ||
    requestTimeoutMs > 2_147_483_647
  ) {
    throw new Error(
      'Ungültiger Startzeitpunkt, Anfrage-Timeout oder Auslaufzeit (höchstens 60000 ms).',
    );
  }
  const ende = startAtMs + durationMs;
  const calls = plan.map((eintrag) => ({
    ...eintrag,
    outcome: 'NOT_STARTED',
    startedAtMs: null,
    scheduleDelayMs: null,
    durationMs: null,
    normalizationApplied: null,
    normalizationFallbackReason: null,
    errorCode: null,
    cleanupOutcome: null,
    cleanupErrorCode: null,
    cleanupDurationMs: null,
    cleanupNormalizationApplied: null,
    cleanupNormalizationFallbackReason: null,
  }));
  const belegt = new Map();
  const laufend = new Set();

  function starten(eintrag) {
    const steuerung = new AbortController();
    const aufrufsignal = AbortSignal.any([signal, steuerung.signal]);
    eintrag.startedAtMs = uhr.now() - startAtMs;
    eintrag.outcome = 'RUNNING';
    belegt.set(eintrag.hostIndex, steuerung);
    const aufgabe = (async () => {
      let ergebnis;
      try {
        const antwort = await begrenzterAufruf(
          () => aufrufen({ hostIndex: eintrag.hostIndex, signal: aufrufsignal }),
          { signal: aufrufsignal, uhr, requestTimeoutMs },
        );
        ergebnis = {
          outcome: antwort.fallback ? 'FALLBACK' : 'SUCCESS',
          normalizationApplied: antwort.normalizationApplied,
          normalizationFallbackReason: antwort.normalizationFallbackReason,
        };
      } catch (fehler) {
        ergebnis = bestimmeAnalyseFehler(fehler);
      }
      const dauerMs = uhr.now() - startAtMs - eintrag.startedAtMs;
      if (eintrag.outcome === 'IN_FLIGHT_AT_END' || uhr.now() >= ende) {
        eintrag.outcome = 'IN_FLIGHT_AT_END';
        eintrag.cleanupOutcome = ergebnis.outcome;
        eintrag.cleanupErrorCode = ergebnis.errorCode ?? null;
        eintrag.cleanupDurationMs = dauerMs;
        eintrag.cleanupNormalizationApplied = ergebnis.normalizationApplied ?? null;
        eintrag.cleanupNormalizationFallbackReason = ergebnis.normalizationFallbackReason ?? null;
      } else {
        Object.assign(eintrag, ergebnis, { durationMs: dauerMs });
      }
      steuerung.abort();
      belegt.delete(eintrag.hostIndex);
    })();
    laufend.add(aufgabe);
    aufgabe.finally(() => laufend.delete(aufgabe));
  }

  try {
    for (const eintrag of calls) {
      await uhr.waitUntil(startAtMs + eintrag.scheduledAtMs, signal);
      if (signal.aborted) break;
      eintrag.scheduleDelayMs = Math.max(0, uhr.now() - startAtMs - eintrag.scheduledAtMs);
      if (uhr.now() >= ende) continue;
      if (eintrag.scheduleDelayMs >= intervalMs) eintrag.outcome = 'SKIPPED_DELAYED';
      else if (belegt.has(eintrag.hostIndex)) eintrag.outcome = 'SKIPPED_BUSY';
      else starten(eintrag);
    }
    await uhr.waitUntil(ende, signal);
  } catch (fehler) {
    if (!signal.aborted) throw fehler;
  }

  for (const eintrag of calls)
    if (eintrag.outcome === 'RUNNING') {
      eintrag.outcome = signal.aborted ? 'ABORTED' : 'IN_FLIGHT_AT_END';
    }
  const auslaufstart = uhr.now();
  const timer = new AbortController();
  try {
    if (!signal.aborted)
      await Promise.race([
        Promise.allSettled([...laufend]),
        uhr.waitUntil(ende + drainMs, AbortSignal.any([signal, timer.signal])).catch(() => {}),
      ]);
  } finally {
    timer.abort();
    for (const steuerung of belegt.values()) steuerung.abort();
    await Promise.allSettled([...laufend]);
  }
  const counts = {};
  for (const eintrag of calls) counts[eintrag.outcome] = (counts[eintrag.outcome] ?? 0) + 1;
  const erfolgreich = counts.SUCCESS ?? 0;
  const fallback = counts.FALLBACK ?? 0;
  return {
    planned: calls.length,
    started: calls.filter(({ startedAtMs }) => startedAtMs !== null).length,
    counts,
    interrupted: signal.aborted,
    durationMs,
    observedDurationMs: auslaufstart - startAtMs,
    drainDurationMs: uhr.now() - auslaufstart,
    unavailableRate: calls.length ? (calls.length - erfolgreich) / calls.length : null,
    fallbackRateOfResponses: erfolgreich + fallback ? fallback / (erfolgreich + fallback) : null,
    latency: fasseLaufzeitenZusammen(
      calls
        .filter(({ outcome }) => outcome === 'SUCCESS' || outcome === 'FALLBACK')
        .map(({ durationMs }) => durationMs),
    ),
    calls,
  };
}
