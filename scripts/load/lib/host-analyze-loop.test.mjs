import assert from 'node:assert/strict';
import test from 'node:test';
import { erstelleAnalyseZeitplan, fuehreAnalyseZeitplanAus } from './host-analyze-loop.mjs';

function virtuelleUhr() {
  let zeit = 0;
  const wartende = new Set();
  return {
    now: () => zeit,
    waitUntil(ziel, signal) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      if (ziel <= zeit) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const eintrag = {
          ziel,
          resolve: () => {
            bereinigen();
            resolve();
          },
        };
        const abbrechen = () => {
          bereinigen();
          reject(signal.reason);
        };
        const bereinigen = () => {
          wartende.delete(eintrag);
          signal?.removeEventListener('abort', abbrechen);
        };
        signal?.addEventListener('abort', abbrechen, { once: true });
        wartende.add(eintrag);
      });
    },
    async bis(ziel) {
      zeit = ziel;
      // Promise-Ketten von tRPC, Messung und Zeitplan vollständig abarbeiten.
      for (let schritt = 0; schritt < 40; schritt++) {
        for (const eintrag of [...wartende]) if (eintrag.ziel <= zeit) eintrag.resolve();
        await Promise.resolve();
      }
    },
  };
}

const erfolgreich = {
  normalizationApplied: 'LEMMA',
  normalizationFallbackReason: null,
  fallback: false,
};

test('plant 150 feste Aufrufe über fünf Hosts ohne Aufruf am Intervallende', () => {
  const plan = erstelleAnalyseZeitplan();
  assert.equal(plan.length, 150);
  assert.deepEqual(
    plan.slice(0, 5).map(({ scheduledAtMs }) => scheduledAtMs),
    [0, 2000, 4000, 6000, 8000],
  );
  assert.equal(plan.at(-1).scheduledAtMs, 298000);
  for (let host = 0; host < 5; host++)
    assert.equal(plan.filter(({ hostIndex }) => hostIndex === host).length, 30);
  for (const optionen of [
    { durationMs: 0 },
    { intervalMs: NaN },
    { offsetsMs: [0, 0] },
    { offsetsMs: [-1] },
    { offsetsMs: [10000] },
  ]) {
    assert.throws(() => erstelleAnalyseZeitplan(optionen));
  }
});

test('misst Laufzeiten, Fallback und Fehler je geplantem Aufruf getrennt', async () => {
  const uhr = virtuelleUhr();
  let anzahl = 0;
  const lauf = fuehreAnalyseZeitplanAus({
    durationMs: 30,
    intervalMs: 10,
    offsetsMs: [0],
    uhr,
    aufrufen: async () => {
      anzahl++;
      await uhr.waitUntil(uhr.now() + 2);
      if (anzahl === 1) return erfolgreich;
      if (anzahl === 2)
        return {
          normalizationApplied: 'NONE',
          normalizationFallbackReason: 'TIMEOUT',
          fallback: true,
        };
      throw Object.assign(new Error('vertraulicher Text'), { data: { code: 'CONFLICT' } });
    },
  });
  for (const zeit of [0, 2, 10, 12, 20, 22, 30]) await uhr.bis(zeit);
  const bericht = await lauf;
  assert.deepEqual(
    bericht.calls.map(({ outcome }) => outcome),
    ['SUCCESS', 'FALLBACK', 'REJECTED'],
  );
  assert.deepEqual(
    bericht.calls.map(({ durationMs }) => durationMs),
    [2, 2, 2],
  );
  assert.equal(bericht.calls[2].errorCode, 'CONFLICT');
  assert.equal(bericht.unavailableRate, 2 / 3);
  assert.equal(bericht.fallbackRateOfResponses, 1 / 2);
  assert.doesNotMatch(JSON.stringify(bericht), /vertraulicher Text/);
});

test('überspringt einen belegten Host und lässt andere Hosts unabhängig weiterlaufen', async () => {
  const uhr = virtuelleUhr();
  const lauf = fuehreAnalyseZeitplanAus({
    durationMs: 25,
    intervalMs: 10,
    offsetsMs: [0, 2],
    uhr,
    aufrufen: async ({ hostIndex }) => {
      await uhr.waitUntil(uhr.now() + (hostIndex === 0 ? 15 : 1));
      return erfolgreich;
    },
  });
  for (const zeit of [0, 2, 3, 10, 12, 13, 15, 20, 22, 23, 25, 35]) await uhr.bis(zeit);
  const bericht = await lauf;
  assert.deepEqual(
    bericht.calls.filter(({ hostIndex }) => hostIndex === 0).map(({ outcome }) => outcome),
    ['SUCCESS', 'SKIPPED_BUSY', 'IN_FLIGHT_AT_END'],
  );
  assert.equal(
    bericht.calls.filter(({ hostIndex, outcome }) => hostIndex === 1 && outcome === 'SUCCESS')
      .length,
    3,
  );
  assert.equal(bericht.calls.at(-2).cleanupOutcome, 'SUCCESS');
  assert.equal(bericht.counts.SUCCESS, 4);
});

test('holt bei verspätetem Zeitplan keine veralteten Aufrufe nach', async () => {
  const uhr = virtuelleUhr();
  const zeiten = [];
  const lauf = fuehreAnalyseZeitplanAus({
    durationMs: 40,
    intervalMs: 10,
    offsetsMs: [0],
    uhr,
    aufrufen: async () => {
      zeiten.push(uhr.now());
      return erfolgreich;
    },
  });
  await uhr.bis(0);
  await uhr.bis(35);
  await uhr.bis(40);
  const bericht = await lauf;
  assert.deepEqual(zeiten, [0, 35]);
  assert.deepEqual(
    bericht.calls.map(({ outcome }) => outcome),
    ['SUCCESS', 'SKIPPED_DELAYED', 'SKIPPED_DELAYED', 'SUCCESS'],
  );
  assert.equal(bericht.calls.at(-1).scheduleDelayMs, 5);
});

test('beendet das Fenster ohne neue Arbeit und bricht nach der Auslaufzeit offene Arbeit ab', async () => {
  const uhr = virtuelleUhr();
  let abgebrochen = false;
  const lauf = fuehreAnalyseZeitplanAus({
    durationMs: 10,
    intervalMs: 10,
    offsetsMs: [0],
    drainMs: 5,
    requestTimeoutMs: 100,
    uhr,
    aufrufen: async ({ signal }) => {
      signal.addEventListener(
        'abort',
        () => {
          abgebrochen = true;
        },
        { once: true },
      );
      await new Promise(() => {});
    },
  });
  await uhr.bis(0);
  await uhr.bis(10);
  await uhr.bis(15);
  const bericht = await lauf;
  assert.equal(abgebrochen, true);
  assert.equal(bericht.calls[0].outcome, 'IN_FLIGHT_AT_END');
  assert.equal(bericht.calls[0].cleanupOutcome, 'ABORTED');
  assert.equal(bericht.unavailableRate, 1);
});

test('trennt clientseitiges Timeout und Signalabbruch von Backendfehlern', async () => {
  const uhr = virtuelleUhr();
  const signalgeber = new AbortController();
  const lauf = fuehreAnalyseZeitplanAus({
    durationMs: 40,
    intervalMs: 10,
    offsetsMs: [0],
    requestTimeoutMs: 5,
    signal: signalgeber.signal,
    uhr,
    aufrufen: () => new Promise(() => {}),
  });
  await uhr.bis(0);
  await uhr.bis(5);
  await uhr.bis(10);
  signalgeber.abort();
  await uhr.bis(12);
  const bericht = await lauf;
  assert.equal(bericht.interrupted, true);
  assert.deepEqual(
    bericht.calls.map(({ outcome }) => outcome),
    ['TIMEOUT', 'ABORTED', 'NOT_STARTED', 'NOT_STARTED'],
  );
  assert.equal(bericht.planned, 4);
  assert.equal(bericht.started, 2);
});

test('startet mit der echten Uhr keine Aktion vor ihrem festen Termin', async () => {
  const bericht = await fuehreAnalyseZeitplanAus({
    durationMs: 100,
    intervalMs: 5,
    offsetsMs: [0],
    aufrufen: async () => erfolgreich,
  });
  assert.ok(
    bericht.calls.every(
      ({ startedAtMs, scheduledAtMs }) => startedAtMs === null || startedAtMs >= scheduledAtMs,
    ),
  );
  assert.ok(bericht.observedDurationMs >= 100);
});

test('bewahrt späte Normalisierungsmetadaten ausschließlich als Bereinigungsergebnis', async () => {
  const uhr = virtuelleUhr();
  const lauf = fuehreAnalyseZeitplanAus({
    durationMs: 10,
    intervalMs: 10,
    offsetsMs: [0],
    uhr,
    aufrufen: async () => {
      await uhr.waitUntil(12);
      return {
        normalizationApplied: 'NONE',
        normalizationFallbackReason: 'SIDECAR_UNAVAILABLE',
        fallback: true,
      };
    },
  });
  for (const zeit of [0, 10, 12]) await uhr.bis(zeit);
  const { calls, counts } = await lauf;
  assert.equal(calls[0].outcome, 'IN_FLIGHT_AT_END');
  assert.equal(calls[0].normalizationFallbackReason, null);
  assert.equal(calls[0].cleanupNormalizationApplied, 'NONE');
  assert.equal(calls[0].cleanupNormalizationFallbackReason, 'SIDECAR_UNAVAILABLE');
  assert.equal(counts.FALLBACK ?? 0, 0);
});
