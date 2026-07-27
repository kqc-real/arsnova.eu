import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDemoDurationRun } from './lib/demo-duration-evaluation.mjs';

function security(phase, overrides = {}) {
  return {
    at: new Date().toISOString(),
    phase,
    ok: true,
    durationMs: 1,
    stats: {
      databaseStatus: 'ok',
      sessionCreatesLastMinute: phase === 'PRE' ? 0 : 1,
      rateLimit429LastMinute: 0,
      sessionCodeEntryFailuresLastMinute: 0,
      sessionCodeEntrySoftCapDelaysLastMinute: 0,
      sessionCodeGlobalSoftCapUtilizationPercent: 0,
      sessionCodeFailuresBySourceLastMinute: { pollReconnect: 0 },
      sessionCodeSoftCapDelaysBySourceLastMinute: { pollReconnect: 0 },
      pdfRejectedLastMinute: 0,
      pdfFailedLastMinute: 0,
      cspReportsDroppedLastMinute: 0,
      cspReportsRateLimitedLastMinute: 0,
      cspReportsEvalLastMinute: 0,
      cspReportsScriptHttpsLastMinute: 0,
      trpcWebSocketConnectionsActive: 0,
      trpcWebSocketRejectedUpgradesLastMinute: 0,
      trpcWebSocketPayloadRejectedLastMinute: 0,
      trpcWebSocketRateLimitedMessagesLastMinute: 0,
      yjsWebSocketConnectionsActive: 0,
      yjsWebSocketRejectedUpgradesLastMinute: 0,
      yjsWebSocketPayloadRejectedLastMinute: 0,
      yjsWebSocketRateLimitedMessagesLastMinute: 0,
      yjsWebSocketAwarenessRejectedLastMinute: 0,
      ...overrides,
    },
  };
}

function runtimeFixture() {
  const phases = ['PRE', 'DURING', 'POST'];
  return {
    targetHttp: {
      samples: 100,
      successfulSamples: 100,
      errors: 0,
      errorRatePercent: 0,
      p95Ms: 40,
      p99Ms: 80,
    },
    healthCheck: {
      errors: 0,
      snapshots: phases.map((phase) => ({
        phase,
        ok: true,
        check: { status: 'ok', redis: 'ok' },
      })),
    },
    healthStats: {
      errors: 0,
      snapshots: phases.map((phase) => ({
        phase,
        ok: true,
        stats: {
          serviceStatus: 'stable',
          totalParticipants: phase === 'DURING' ? 30 : 0,
          votesLastMinute: phase === 'PRE' ? 0 : 300,
          sessionTransitionsLastMinute: phase === 'PRE' ? 0 : 20,
        },
      })),
    },
    securityStats: {
      errors: 0,
      snapshots: phases.map((phase) => security(phase)),
    },
    redisPing: { available: false, successfulSamples: 0, errors: 0 },
    postgresSelect1: { available: false, successfulSamples: 0, errors: 0 },
    backendProcess: { available: false, rssGrowthBytes: null },
  };
}

function roundFixture() {
  return {
    round: 1,
    durationMs: 12_000,
    failures: [],
    summary: {
      participants: 30,
      expectedVotes: 300,
      totalVotesAccepted: 300,
      feedbackAccepted: 30,
      finishedStatus: 'FINISHED',
    },
  };
}

function evaluate(runtime = runtimeFixture()) {
  return evaluateDemoDurationRun({
    runtime,
    rounds: [roundFixture()],
    roundErrors: [],
    participants: 30,
    httpP95LimitMs: 1_000,
    memoryGrowthLimitMb: 256,
  });
}

test('akzeptiert plausible rollierende Demo-Monitoringdaten', () => {
  const result = evaluate();
  assert.equal(result.passed, true);
  assert.equal(result.summary.acceptedVotes, 300);
  assert.equal(
    result.assertions.every((entry) => entry.passed),
    true,
  );
});

test('wertet unerwünschte Rolling-Signale gegenüber PRE statt als exakten Snapshot aus', () => {
  const runtime = runtimeFixture();
  runtime.securityStats.snapshots = [
    security('PRE', {
      rateLimit429LastMinute: 3,
      sessionCodeFailuresBySourceLastMinute: { pollReconnect: 2 },
    }),
    security('DURING', {
      rateLimit429LastMinute: 2,
      sessionCodeFailuresBySourceLastMinute: { pollReconnect: 1 },
    }),
    security('POST', {
      rateLimit429LastMinute: 0,
      sessionCodeFailuresBySourceLastMinute: { pollReconnect: 0 },
    }),
  ];
  const result = evaluate(runtime);
  assert.equal(result.assertions.find((entry) => entry.name === 'keine-neuen-429').passed, true);
  assert.equal(
    result.assertions.find((entry) => entry.name === 'keine-neuen-poll-reconnect-fehler').passed,
    true,
  );
});

test('verwirft Monitoring-Warnschwellen und HTTP-Latenzverletzungen', () => {
  const runtime = runtimeFixture();
  runtime.targetHttp.p95Ms = 1_001;
  runtime.securityStats.snapshots[1].stats.sessionCreatesLastMinute = 30;
  const result = evaluate(runtime);
  assert.equal(result.passed, false);
  assert.equal(
    result.assertions.find((entry) => entry.name === 'keine-monitoring-warnschwelle-erreicht')
      .passed,
    false,
  );
  assert.equal(
    result.assertions.find((entry) => entry.name === 'http-p95-im-budget').passed,
    false,
  );
});
