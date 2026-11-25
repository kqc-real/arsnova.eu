import assert from 'node:assert/strict';
import test from 'node:test';
import { fuehreLivePhaseAus } from './resource-isolation-live.mjs';

test('führt dieselben Szenarioaktionen aus und gibt Ergebnisse erst zum festen Zeitpunkt frei', async () => {
  const aufrufe = [];
  const start = performance.now();
  const aktionen = Object.fromEntries(
    [
      'joinSession',
      'connectParticipantStatusWs',
      'pollSessionInfo',
      'fetchCurrentQuestion',
      'submitVote',
      'maybeSubmitQa',
      'submitBlitzlicht',
      'fetchResultsQuestion',
      'disconnectParticipantStatusWs',
    ].map((name) => [
      name,
      async (user, events) => {
        aufrufe.push([user.vars.index, name]);
        if (name === 'connectParticipantStatusWs') events.emit('counter', 'custom.ws_connected', 1);
        if (name === 'disconnectParticipantStatusWs')
          events.emit('counter', 'custom.ws_disconnected', 1);
      },
    ]),
  );
  const report = await fuehreLivePhaseAus({
    participants: 5,
    rampMs: 100,
    durationMs: 450,
    revealAtMs: 350,
    thinkMs: [1, 1, 1],
    startAtMs: performance.now(),
    aktionen,
    reveal: async () => {
      assert.ok(performance.now() - start >= 350);
    },
  });
  assert.equal(report.completedScenarios, 5);
  assert.equal(report.reveal.succeeded, true);
  assert.ok(report.reveal.startedAtMs >= 350);
  assert.equal(report.maxActiveWebSocketConnections, 5);
  assert.equal(report.activeWebSocketConnectionsAtEnd, 0);
  assert.equal(aufrufe.filter(([, name]) => name === 'submitVote').length, 5);
  for (let i = 0; i < 5; i++)
    assert.deepEqual(
      aufrufe.filter(([index]) => index === i).map(([, name]) => name),
      Object.keys(aktionen),
    );
});

test('schließt die Verbindung auch nach einer abgelehnten Aktion und wiederholt keine Mutation', async () => {
  const aufrufe = [];
  const aktionen = new Proxy(
    {},
    {
      get: (_, name) => async () => {
        aufrufe.push(name);
        if (name === 'submitVote') throw new Error('interner Token');
      },
    },
  );
  const report = await fuehreLivePhaseAus({
    participants: 1,
    rampMs: 10,
    durationMs: 60,
    revealAtMs: 40,
    thinkMs: [0, 0, 0],
    startAtMs: performance.now(),
    aktionen,
    reveal: async () => {},
  });
  assert.equal(report.failedScenarios, 1);
  assert.equal(aufrufe.filter((name) => name === 'submitVote').length, 1);
  assert.equal(aufrufe.at(-1), 'disconnectParticipantStatusWs');
  assert.doesNotMatch(JSON.stringify(report), /Token/);
});

test('startet bei Abbruch keine neue Arbeit und wartet nicht bis zur Ergebnisfreigabe', async () => {
  const abbruch = new AbortController();
  abbruch.abort();
  let aufrufe = 0;
  const report = await fuehreLivePhaseAus({
    participants: 500,
    rampMs: 90000,
    durationMs: 300000,
    revealAtMs: 270000,
    startAtMs: performance.now(),
    signal: abbruch.signal,
    aktionen: { joinSession: async () => aufrufe++ },
    reveal: async () => aufrufe++,
  });
  assert.equal(aufrufe, 0);
  assert.equal(report.interrupted, true);
  assert.equal(report.startedScenarios, 0);
});
