import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pruefeLiveAktion,
  vergleicheLiveAktionen,
  fasseAnalyseAufrufeZusammen,
  fasseRessourcenZusammen,
} from './resource-isolation-evaluation.mjs';

// Die Erwartungen sind unabhängig von den Auswertungsfunktionen vorgegeben.
function aktion(dauer, { planned = 200, failed = 0, pending = 0, notAttempted = 0 } = {}) {
  const succeeded = planned - failed - pending - notAttempted;
  return {
    planned,
    attempted: planned - notAttempted,
    succeeded,
    failed,
    pending,
    notAttempted,
    skipped: 0,
    accountingValid: true,
    latency: { durationSamplesMs: Array(succeeded).fill(dauer), p95Ms: -999 },
    failureLatency: { durationSamplesMs: Array(failed).fill(100) },
  };
}

test('verlangt relative UND absolute p95-Grenze einschließlich Gleichheit', () => {
  assert.equal(vergleicheLiveAktionen(aktion(100), aktion(110)).passed, true);
  const relativ = vergleicheLiveAktionen(aktion(10), aktion(12));
  assert.equal(relativ.relativePassed, false);
  assert.equal(relativ.absolutePassed, true);
  assert.equal(relativ.passed, false);
  const absolut = vergleicheLiveAktionen(aktion(1000), aktion(1070));
  assert.equal(absolut.relativePassed, true);
  assert.equal(absolut.absolutePassed, false);
  assert.equal(absolut.passed, false);
  assert.equal(vergleicheLiveAktionen(aktion(500), aktion(550)).passed, true);
});

test('berechnet Perzentile aus Rohstichproben und nicht aus gespeicherten Zusammenfassungen', () => {
  const eingabe = aktion(0, { planned: 20 });
  eingabe.latency.durationSamplesMs = [...Array(18).fill(10), 20, 99];
  assert.equal(pruefeLiveAktion(eingabe).p95Ms, 20);
  assert.equal(eingabe.latency.p95Ms, -999);
});

test('prüft 0,5 Prozent Fehler und nicht gesendete Arbeit ohne doppelten Nenner', () => {
  const grenze = pruefeLiveAktion(aktion(100, { failed: 1 }));
  assert.equal(grenze.errorRate, 0.005);
  assert.equal(grenze.errorPassed, true);
  assert.equal(grenze.coveragePassed, true);
  assert.equal(pruefeLiveAktion(aktion(100, { failed: 2 })).errorPassed, false);
  const ungesendet = pruefeLiveAktion(aktion(100, { planned: 100, notAttempted: 1 }));
  assert.equal(ungesendet.errorRate, 0);
  assert.equal(ungesendet.scheduledFailureRate, 0.01);
  assert.equal(ungesendet.coveragePassed, false);
  assert.equal(pruefeLiveAktion(aktion(100, { planned: 100, pending: 1 })).coveragePassed, false);
});

test('lässt leere Stichproben und ungültige Zähler nicht als bestandene Messung gelten', () => {
  const leer = pruefeLiveAktion(aktion(0, { notAttempted: 200 }));
  assert.equal(leer.p95Ms, null);
  assert.equal(leer.available, false);
  assert.equal(vergleicheLiveAktionen(aktion(1), aktion(0, { notAttempted: 200 })).passed, false);
  assert.throws(() => pruefeLiveAktion({ ...aktion(1), attempted: 199 }));
  const defekt = aktion(1);
  defekt.latency.durationSamplesMs[0] = Number.NaN;
  assert.throws(() => pruefeLiveAktion(defekt));
});

test('teilt bei einer Null-Baseline nicht durch null und hält das absolute Quizziel inklusiv', () => {
  const nullwert = vergleicheLiveAktionen(aktion(0), aktion(1));
  assert.equal(nullwert.relativeChange, null);
  assert.equal(nullwert.relativePassed, false);
  assert.equal(vergleicheLiveAktionen(aktion(0), aktion(0)).passed, true);
  assert.equal(pruefeLiveAktion(aktion(1000)).voteTargetPassed, true);
  assert.equal(pruefeLiveAktion(aktion(1000.01)).voteTargetPassed, false);
});

test('zählt Fallbacks, übersprungene und erst nach Fensterende beendete Analysen als unverfügbar', () => {
  const calls = [
    { outcome: 'SUCCESS', durationMs: 100, normalizationApplied: 'LEMMA' },
    { outcome: 'FALLBACK', durationMs: 5000, normalizationFallbackReason: 'TIMEOUT' },
    { outcome: 'SKIPPED_BUSY', durationMs: null },
    { outcome: 'IN_FLIGHT_AT_END', durationMs: null, cleanupOutcome: 'SUCCESS' },
  ];
  const ergebnis = fasseAnalyseAufrufeZusammen({ planned: 4, calls });
  assert.equal(ergebnis.unavailableRate, 0.75);
  assert.equal(ergebnis.fallbackRateOfResponses, 0.5);
  assert.equal(ergebnis.successLatency.p95Ms, 100);
  assert.equal(ergebnis.fallbackLatency.p95Ms, 5000);
  assert.equal(ergebnis.availabilityPassed, false);
  assert.deepEqual(ergebnis.outcomes, {
    SUCCESS: 1,
    FALLBACK: 1,
    SKIPPED_BUSY: 1,
    IN_FLIGHT_AT_END: 1,
  });
});

test('verlangt alle geplanten Analyseergebnisse und prüft die inklusive Ein-Prozent-Grenze', () => {
  const calls = Array.from({ length: 99 }, () => ({
    outcome: 'SUCCESS',
    durationMs: 10,
    normalizationApplied: 'LEMMA',
  }));
  calls.push({ outcome: 'IN_FLIGHT_AT_END', durationMs: null });
  assert.equal(fasseAnalyseAufrufeZusammen({ planned: 100, calls }).availabilityPassed, true);
  assert.throws(() => fasseAnalyseAufrufeZusammen({ planned: 101, calls }));
  assert.throws(() => fasseAnalyseAufrufeZusammen({ planned: 0, calls: [] }));
  assert.throws(() =>
    fasseAnalyseAufrufeZusammen({
      planned: 1,
      calls: [{ outcome: 'SUCCESS', durationMs: 10, normalizationApplied: 'NONE' }],
    }),
  );
});

function stichprobe(
  atMs,
  {
    usage = 0,
    periods = 0,
    throttled = 0,
    peak = 800,
    current = 700,
    oom = 0,
    generation = 1,
  } = {},
) {
  const metrik = (value) => ({ available: true, value, observedAtMs: atMs });
  return {
    atMs,
    containers: [
      {
        alias: 'spacy',
        available: true,
        generation,
        cgroup: {
          available: true,
          metrics: {
            cpuStat: metrik({ usage_usec: usage, nr_periods: periods, nr_throttled: throttled }),
            memoryCurrent: metrik(current),
            memoryPeak: metrik(peak),
            memoryLimit: metrik(1000),
            oomKill: metrik(oom),
          },
        },
      },
    ],
  };
}

test('verwendet Zählerdifferenzen im Messfenster und verwechselt Lebenszeit-Peaks nicht mit Fensterpeaks', () => {
  const snapshots = [
    stichprobe(0, { usage: 100000, periods: 10, throttled: 5, current: 600 }),
    stichprobe(1000, { usage: 600000, periods: 50, throttled: 7, current: 700 }),
  ];
  const ergebnis = fasseRessourcenZusammen({ snapshots })[0];
  assert.equal(ergebnis.cpuPercent, 50);
  assert.equal(ergebnis.throttledPeriodRatio, 0.05);
  assert.equal(ergebnis.throttlingPassed, true);
  assert.equal(ergebnis.sampledPeakMemoryBytes, 700);
  assert.equal(ergebnis.lifetimePeakMemoryBytes, 800);
  assert.equal(ergebnis.memoryRatio, 0.8);
  assert.equal(ergebnis.memoryPassed, true);
  assert.equal(ergebnis.oomKillDelta, 0);
  assert.equal(ergebnis.oomPassed, true);
});

test('verlangt positive CPU-Periodendifferenz und meldet OOM sowie Budgetüberschreitungen', () => {
  const snapshots = [stichprobe(0), stichprobe(1000, { peak: 801, oom: 1 })];
  const ergebnis = fasseRessourcenZusammen({ snapshots })[0];
  assert.equal(ergebnis.throttledPeriodRatio, null);
  assert.equal(ergebnis.throttlingPassed, false);
  assert.equal(ergebnis.memoryPassed, false);
  assert.equal(ergebnis.oomPassed, false);
});

test('verwirft Generationenwechsel, zurückgesetzte Zähler und nicht verfügbare Pflichtmetriken', () => {
  assert.throws(() =>
    fasseRessourcenZusammen({
      snapshots: [stichprobe(0), stichprobe(1000, { generation: 2 })],
    }),
  );
  assert.throws(() =>
    fasseRessourcenZusammen({
      snapshots: [stichprobe(0, { usage: 100 }), stichprobe(1000)],
    }),
  );
  const fehlend = stichprobe(1000);
  fehlend.containers[0].cgroup.metrics.oomKill.available = false;
  assert.throws(() => fasseRessourcenZusammen({ snapshots: [stichprobe(0), fehlend] }));
});

test('verlangt eine echte Generation und verfügbare Metadaten auch für unbegrenzten Speicher', () => {
  const snapshots = [stichprobe(0), stichprobe(1000)];
  for (const s of snapshots) s.containers[0].generation = undefined;
  assert.throws(() => fasseRessourcenZusammen({ snapshots }));
  const unbegrenzt = [stichprobe(0), stichprobe(1000)];
  for (const s of unbegrenzt)
    s.containers[0].cgroup.metrics.memoryLimit = {
      available: false,
      unlimited: true,
      value: null,
    };
  assert.throws(() => fasseRessourcenZusammen({ snapshots: unbegrenzt }));
});
