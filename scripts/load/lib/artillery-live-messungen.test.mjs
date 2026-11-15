import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { writeScenarioReport } from './reporting.mjs';
import {
  initialisiereLiveMessungen,
  fasseLiveMessungenZusammen,
  pruefeLiveMessungen,
} from './artillery-live-messungen.mjs';

function vollstaendigerLauf(anzahl = 5) {
  const zustand = initialisiereLiveMessungen();
  for (const [versuche, erfolge, laufzeiten, geplant] of [
    ['joinAttempts', 'joins', 'joinDurationMs', anzahl],
    ['voteAttempts', 'votes', 'voteDurationMs', anzahl],
    ['qaSubmitAttempts', 'qaSubmits', 'qaSubmitDurationMs', Math.floor(anzahl / 5)],
    ['blitzVoteAttempts', 'blitzVotes', 'blitzVoteDurationMs', anzahl],
  ]) {
    zustand[versuche] = geplant;
    zustand[erfolge] = geplant;
    zustand[laufzeiten] = Array.from({ length: geplant }, (_, index) => index + 0.25);
  }
  return zustand;
}

test('weist alle vier Aktionen mit Rohstichproben und ungerundeten Perzentilen aus', () => {
  const bericht = fasseLiveMessungenZusammen(vollstaendigerLauf(), { participants: 5 });
  assert.deepEqual(Object.keys(bericht), ['join', 'vote', 'qaSubmit', 'blitzlicht']);
  for (const name of ['join', 'vote', 'blitzlicht']) {
    assert.equal(bericht[name].planned, 5);
    assert.equal(bericht[name].attempted, 5);
    assert.equal(bericht[name].succeeded, 5);
    assert.equal(bericht[name].failed, 0);
    assert.equal(bericht[name].errorRate, 0);
    assert.equal(bericht[name].latency.p50Ms, 2.25);
    assert.equal(bericht[name].latency.p95Ms, 4.25);
    assert.deepEqual(bericht[name].latency.durationSamplesMs, [0.25, 1.25, 2.25, 3.25, 4.25]);
  }
  assert.equal(bericht.qaSubmit.planned, 1);
  assert.deepEqual(pruefeLiveMessungen(bericht), []);
});

test('lässt leere oder unvollständige Messungen nicht als Null-Latenz bestehen', () => {
  const leer = fasseLiveMessungenZusammen({}, { participants: 5 });
  assert.equal(leer.vote.latency.available, false);
  assert.equal(leer.vote.latency.p95Ms, null);
  assert.equal(leer.vote.errorRate, null);
  assert.equal(leer.vote.notAttempted, 5);
  assert.ok(pruefeLiveMessungen(leer).length >= 4);
  const fehlend = vollstaendigerLauf();
  fehlend.voteDurationMs = [];
  const bericht = fasseLiveMessungenZusammen(fehlend, { participants: 5 });
  assert.equal(bericht.vote.accountingValid, false);
  assert.ok(pruefeLiveMessungen(bericht).some((text) => text.includes('Quizstimme')));
});

test('trennt übersprungene, noch laufende und nicht gestartete Aktionen von Fehlern', () => {
  const zustand = vollstaendigerLauf();
  Object.assign(zustand, {
    voteAttempts: 3,
    votes: 1,
    voteErrors: 1,
    voteSkippedInactive: 1,
    voteDurationMs: [1.5],
    voteErrorDurationMs: [9.75],
  });
  const { vote } = fasseLiveMessungenZusammen(zustand, { participants: 5 });
  assert.equal(vote.failed, 1);
  assert.equal(vote.skipped, 1);
  assert.equal(vote.pending, 1);
  assert.equal(vote.notAttempted, 1);
  assert.equal(vote.errorRate, 1 / 3);
  assert.equal(vote.scheduledFailureRate, 4 / 5);
  assert.equal(vote.failureLatency.p95Ms, 9.75);
  assert.ok(pruefeLiveMessungen({ vote }).length > 0);
});

test('prüft die Fehlerquote einschließlich Gleichheit und ohne Zusammenlegen der Aktionen', () => {
  const zustand = vollstaendigerLauf(200);
  zustand.votes = 199;
  zustand.voteErrors = 1;
  zustand.voteDurationMs.pop();
  zustand.voteErrorDurationMs = [200];
  const bericht = fasseLiveMessungenZusammen(zustand, { participants: 200 });
  assert.deepEqual(pruefeLiveMessungen(bericht, { minSuccessRatio: 0.9 }), []);
  bericht.vote.errorRate = 0.0051;
  assert.ok(
    pruefeLiveMessungen(bericht, { minSuccessRatio: 0.9 }).some((text) =>
      text.includes('Fehlerquote'),
    ),
  );
});

test('kennzeichnet nicht vorgesehene Aktionen ausdrücklich als nicht anwendbar', () => {
  const zustand = vollstaendigerLauf(1);
  zustand.voteAttempts = 0;
  zustand.votes = 0;
  zustand.voteDurationMs = [];
  zustand.voteSkippedInactive = 1;
  const bericht = fasseLiveMessungenZusammen(zustand, { participants: 1, votesEnabled: false });
  assert.equal(bericht.vote.applicable, false);
  assert.equal(bericht.vote.latency.available, false);
  assert.equal(bericht.qaSubmit.applicable, false);
  assert.deepEqual(pruefeLiveMessungen(bericht), []);
});

test('erhält mehr als 2000 Stichproben und erkennt beschädigte oder doppelte Zählungen', () => {
  const zustand = vollstaendigerLauf(2005);
  let bericht = fasseLiveMessungenZusammen(zustand, { participants: 2005 });
  assert.equal(bericht.vote.latency.samples, 2005);
  assert.equal(bericht.vote.latency.durationSamplesMs[0], 0.25);
  zustand.voteDurationMs[0] = NaN;
  bericht = fasseLiveMessungenZusammen(zustand, { participants: 2005 });
  assert.equal(bericht.vote.latency.available, false);
  assert.ok(pruefeLiveMessungen(bericht).length > 0);
  zustand.joinAttempts += 1;
  assert.equal(
    fasseLiveMessungenZusammen(zustand, { participants: 2005 }).join.accountingValid,
    false,
  );
});

test('initialisiert Wiederanlaufdaten ohne gemeinsam veränderbare Arrays und Fehlerzähler', () => {
  const original = vollstaendigerLauf();
  original.voteErrorCodes = { TOO_MANY_REQUESTS: 1 };
  const kopie = initialisiereLiveMessungen(original);
  kopie.voteDurationMs.push(100);
  kopie.voteErrorCodes.TOO_MANY_REQUESTS = 2;
  assert.equal(original.voteDurationMs.length, 5);
  assert.equal(original.voteErrorCodes.TOO_MANY_REQUESTS, 1);
});

test('weist ungültige Grenzwerte und unerwartete Aufrufe nicht anwendbarer Aktionen zurück', () => {
  const bericht = fasseLiveMessungenZusammen(vollstaendigerLauf(), { participants: 5 });
  for (const errorRateLimit of [NaN, -1, 2]) {
    assert.throws(() => pruefeLiveMessungen(bericht, { errorRateLimit }), /Fehlergrenze/);
  }
  for (const minSuccessRatio of [NaN, -1, 2, {}]) {
    assert.throws(() => pruefeLiveMessungen(bericht, { minSuccessRatio }), /Mindestanteil/);
  }
  bericht.vote.applicable = false;
  assert.ok(pruefeLiveMessungen(bericht).some((text) => text.includes('nicht vorgesehene')));
});

test('erhält fehlende Messwerte und fehlgeschlagene Gates im JSON- und JUnit-Artefakt', async (t) => {
  const ordner = await mkdtemp(join(tmpdir(), 'arsnova-live-bericht-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  const liveActions = fasseLiveMessungenZusammen({}, { participants: 500 });
  const failures = pruefeLiveMessungen(liveActions);
  await writeScenarioReport({
    filePath: join(ordner, 'bericht.json'),
    junitPath: join(ordner, 'bericht.xml'),
    scenario: 'artillery-500-live-session',
    metrics: { layers: { liveActions } },
    failures,
  });
  const bericht = JSON.parse(await readFile(join(ordner, 'bericht.json'), 'utf8'));
  assert.equal(bericht.metrics.layers.liveActions.vote.latency.p95Ms, null);
  assert.equal(bericht.metrics.layers.liveActions.qaSubmit.notAttempted, 100);
  assert.ok(bericht.assertions.length > 0);
  assert.ok(bericht.assertions.every(({ passed }) => passed === false));
  const junit = await readFile(join(ordner, 'bericht.xml'), 'utf8');
  assert.match(junit, new RegExp(`failures="${failures.length}"`));
});
