const MONITORING_WARNING_THRESHOLDS = Object.freeze({
  sessionCreatesLastMinute: 30,
  rateLimit429LastMinute: 50,
  sessionCodeEntryFailuresLastMinute: 100,
  sessionCodeEntrySoftCapDelaysLastMinute: 10,
  sessionCodeGlobalSoftCapUtilizationPercent: 80,
  pdfRejectedLastMinute: 5,
  pdfFailedLastMinute: 1,
  cspReportsDroppedLastMinute: 10,
  cspReportsRateLimitedLastMinute: 50,
  cspReportsEvalLastMinute: 1,
  cspReportsScriptHttpsLastMinute: 10,
  trpcWebSocketConnectionsActive: 600,
  trpcWebSocketRejectedUpgradesLastMinute: 50,
  trpcWebSocketPayloadRejectedLastMinute: 1,
  trpcWebSocketRateLimitedMessagesLastMinute: 10,
  yjsWebSocketConnectionsActive: 700,
  yjsWebSocketRejectedUpgradesLastMinute: 50,
  yjsWebSocketPayloadRejectedLastMinute: 1,
  yjsWebSocketRateLimitedMessagesLastMinute: 10,
  yjsWebSocketAwarenessRejectedLastMinute: 1,
});

function successfulSnapshots(series) {
  return (series?.snapshots ?? []).filter((snapshot) => snapshot.ok === true);
}

function finiteValues(snapshots, selector) {
  return snapshots
    .map(selector)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
}

function maxOrNull(values) {
  return values.length > 0 ? Math.max(...values) : null;
}

function firstPreValue(snapshots, selector) {
  const pre = snapshots.find((snapshot) => snapshot.phase === 'PRE');
  const value = pre ? selector(pre) : null;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function assertion(name, passed, actual, expected, message) {
  return {
    name,
    passed,
    actual,
    expected,
    ...(message ? { message } : {}),
  };
}

function noIncreaseAssertion(name, snapshots, selector) {
  const baseline = firstPreValue(snapshots, selector);
  const observed = maxOrNull(
    finiteValues(
      snapshots.filter((snapshot) => snapshot.phase !== 'PRE'),
      selector,
    ),
  );
  return assertion(
    name,
    observed !== null && observed <= baseline,
    { baseline, maxAfterPre: observed },
    'kein Anstieg gegenüber PRE',
  );
}

export function evaluateDemoDurationRun({
  runtime,
  rounds,
  roundErrors,
  participants,
  httpP95LimitMs,
  memoryGrowthLimitMb,
  requireRss = false,
  backendPidConfigured = false,
  redisConfigured = false,
  postgresConfigured = false,
}) {
  const assertions = [];
  const healthChecks = successfulSnapshots(runtime.healthCheck);
  const healthStats = successfulSnapshots(runtime.healthStats);
  const securityStats = successfulSnapshots(runtime.securityStats);
  const expectedVotes = rounds.reduce((sum, round) => sum + round.summary.expectedVotes, 0);
  const acceptedVotes = rounds.reduce((sum, round) => sum + round.summary.totalVotesAccepted, 0);

  assertions.push(
    assertion('mindestens-ein-vollstaendiger-durchlauf', rounds.length > 0, rounds.length, '>= 1'),
    assertion('alle-durchlaeufe-funktional-gruen', roundErrors.length === 0, roundErrors, []),
    assertion(
      'joins-votes-feedback-finished-vollstaendig',
      rounds.every(
        ({ summary, failures }) =>
          failures.length === 0 &&
          summary.participants === participants &&
          summary.totalVotesAccepted === summary.expectedVotes &&
          summary.feedbackAccepted === participants &&
          summary.finishedStatus === 'FINISHED',
      ),
      {
        rounds: rounds.length,
        participantsPerRound: participants,
        acceptedVotes,
        expectedVotes,
      },
      'alle erwarteten Joins, Votes, Feedbacks und FINISHED',
    ),
  );

  assertions.push(
    assertion(
      'monitoring-snapshots-pre-during-post',
      ['PRE', 'DURING', 'POST'].every((phase) =>
        [healthChecks, healthStats, securityStats].every((series) =>
          series.some((snapshot) => snapshot.phase === phase),
        ),
      ),
      {
        healthCheck: healthChecks.map((snapshot) => snapshot.phase),
        healthStats: healthStats.map((snapshot) => snapshot.phase),
        securityStats: securityStats.map((snapshot) => snapshot.phase),
      },
      'PRE, DURING und POST für alle drei Endpunkte',
    ),
    assertion(
      'monitoring-probes-fehlerfrei',
      runtime.healthCheck.errors === 0 &&
        runtime.healthStats.errors === 0 &&
        runtime.securityStats.errors === 0,
      {
        healthCheck: runtime.healthCheck.errors,
        healthStats: runtime.healthStats.errors,
        securityStats: runtime.securityStats.errors,
      },
      0,
    ),
    assertion(
      'service-status-stabil',
      healthStats.length > 0 &&
        healthStats.every((snapshot) => snapshot.stats.serviceStatus === 'stable'),
      [...new Set(healthStats.map((snapshot) => snapshot.stats.serviceStatus))],
      ['stable'],
    ),
    assertion(
      'infrastruktur-health-ok',
      healthChecks.length > 0 &&
        securityStats.length > 0 &&
        healthChecks.every(
          (snapshot) => snapshot.check.status === 'ok' && snapshot.check.redis === 'ok',
        ) &&
        securityStats.every((snapshot) => snapshot.stats.databaseStatus === 'ok'),
      {
        health: [...new Set(healthChecks.map((snapshot) => snapshot.check.status))],
        redis: [...new Set(healthChecks.map((snapshot) => snapshot.check.redis))],
        database: [...new Set(securityStats.map((snapshot) => snapshot.stats.databaseStatus))],
      },
      { health: ['ok'], redis: ['ok'], database: ['ok'] },
    ),
  );

  const securitySelectors = [
    ['keine-neuen-429', (snapshot) => snapshot.stats.rateLimit429LastMinute],
    [
      'keine-neuen-session-code-entry-fehler',
      (snapshot) => snapshot.stats.sessionCodeEntryFailuresLastMinute,
    ],
    [
      'keine-neuen-poll-reconnect-fehler',
      (snapshot) => snapshot.stats.sessionCodeFailuresBySourceLastMinute?.pollReconnect,
    ],
    [
      'keine-neuen-poll-reconnect-delays',
      (snapshot) => snapshot.stats.sessionCodeSoftCapDelaysBySourceLastMinute?.pollReconnect,
    ],
  ];
  assertions.push(
    ...securitySelectors.map(([name, selector]) =>
      noIncreaseAssertion(name, securityStats, selector),
    ),
  );

  const thresholdBreaches = [];
  for (const [field, warning] of Object.entries(MONITORING_WARNING_THRESHOLDS)) {
    const observed = maxOrNull(finiteValues(securityStats, (snapshot) => snapshot.stats[field]));
    if (observed !== null && observed >= warning)
      thresholdBreaches.push({ field, observed, warning });
  }
  assertions.push(
    assertion(
      'keine-monitoring-warnschwelle-erreicht',
      thresholdBreaches.length === 0,
      thresholdBreaches,
      [],
    ),
  );

  const participantBaseline = firstPreValue(
    healthStats,
    (snapshot) => snapshot.stats.totalParticipants,
  );
  const participantMax = maxOrNull(
    finiteValues(healthStats, (snapshot) => snapshot.stats.totalParticipants),
  );
  const participantMaxAfterPre = maxOrNull(
    finiteValues(
      healthStats.filter((snapshot) => snapshot.phase !== 'PRE'),
      (snapshot) => snapshot.stats.totalParticipants,
    ),
  );
  const participantIncrease =
    participantMaxAfterPre === null ? null : participantMaxAfterPre - participantBaseline;
  const votesMax = maxOrNull(
    finiteValues(healthStats, (snapshot) => snapshot.stats.votesLastMinute),
  );
  const transitionsMax = maxOrNull(
    finiteValues(healthStats, (snapshot) => snapshot.stats.sessionTransitionsLastMinute),
  );
  const createsBaseline = firstPreValue(
    securityStats,
    (snapshot) => snapshot.stats.sessionCreatesLastMinute,
  );
  const createsMax = maxOrNull(
    finiteValues(securityStats, (snapshot) => snapshot.stats.sessionCreatesLastMinute),
  );
  const preSecurityAt = Date.parse(
    securityStats.find((snapshot) => snapshot.phase === 'PRE')?.at ?? '',
  );
  const createsAfterFreshWindow = maxOrNull(
    finiteValues(
      securityStats.filter(
        (snapshot) =>
          Number.isFinite(preSecurityAt) && Date.parse(snapshot.at) - preSecurityAt >= 75_000,
      ),
      (snapshot) => snapshot.stats.sessionCreatesLastMinute,
    ),
  );
  const createsVisible =
    createsAfterFreshWindow === null
      ? createsMax !== null && createsMax > createsBaseline
      : createsAfterFreshWindow > 0;
  assertions.push(
    assertion(
      'teilnehmer-signal-sichtbar-und-bounded',
      participantIncrease !== null &&
        participantIncrease >= participants &&
        participantIncrease <= participants,
      {
        baseline: participantBaseline,
        maxAfterPre: participantMaxAfterPre,
        increase: participantIncrease,
      },
      { increaseMin: participants, increaseMax: participants },
    ),
    assertion(
      'vote-signal-sichtbar-und-bounded',
      votesMax !== null && votesMax >= participants && votesMax <= acceptedVotes,
      votesMax,
      { min: participants, max: acceptedVotes, rollingWindow: 'ca. 60-70 s' },
    ),
    assertion(
      'transition-signal-sichtbar-und-bounded',
      transitionsMax !== null && transitionsMax > 0 && transitionsMax <= rounds.length * 50,
      transitionsMax,
      { minExclusive: 0, max: rounds.length * 50, rollingWindow: 'ca. 60-70 s' },
    ),
    assertion(
      'session-create-signal-plausibel',
      createsMax !== null && createsVisible && createsMax <= createsBaseline + rounds.length,
      { baseline: createsBaseline, max: createsMax, maxAfter75Seconds: createsAfterFreshWindow },
      {
        freshWindowMin: 1,
        increaseMax: rounds.length,
        rollingWindow: 'ca. 60-70 s',
      },
    ),
  );

  const httpMeasurable = runtime.targetHttp.successfulSamples > 0;
  assertions.push(
    assertion(
      'http-fehlerfrei',
      httpMeasurable && runtime.targetHttp.errors === 0,
      {
        samples: runtime.targetHttp.samples,
        errors: runtime.targetHttp.errors,
        errorRatePercent: runtime.targetHttp.errorRatePercent,
      },
      { samples: '> 0', errors: 0 },
    ),
    assertion(
      'http-p95-im-budget',
      httpMeasurable && runtime.targetHttp.p95Ms <= httpP95LimitMs,
      runtime.targetHttp.p95Ms,
      `<= ${httpP95LimitMs} ms`,
    ),
  );

  for (const [name, configured, summary] of [
    ['redis-probe-fehlerfrei', redisConfigured, runtime.redisPing],
    ['postgres-probe-fehlerfrei', postgresConfigured, runtime.postgresSelect1],
  ]) {
    assertions.push(
      assertion(
        name,
        !configured ||
          (summary.available === true && summary.successfulSamples > 0 && summary.errors === 0),
        configured
          ? {
              available: summary.available,
              successfulSamples: summary.successfulSamples,
              errors: summary.errors,
            }
          : 'nicht konfiguriert',
        configured ? { available: true, successfulSamples: '> 0', errors: 0 } : 'optional',
      ),
    );
  }

  const rssGrowthBytes = runtime.backendProcess.rssGrowthBytes;
  const rssRequired = requireRss || backendPidConfigured;
  const rssProbeHealthy =
    runtime.backendProcess.available === true &&
    runtime.backendProcess.successfulSamples > 0 &&
    runtime.backendProcess.errors === 0;
  const rssMeasurable = rssProbeHealthy && typeof rssGrowthBytes === 'number';
  assertions.push(
    assertion(
      'backend-rss-wachstum',
      (!rssRequired && !rssMeasurable) ||
        (rssMeasurable && rssGrowthBytes <= memoryGrowthLimitMb * 1024 * 1024),
      {
        available: runtime.backendProcess.available,
        successfulSamples: runtime.backendProcess.successfulSamples,
        errors: runtime.backendProcess.errors,
        growthMb: rssMeasurable ? Math.round((rssGrowthBytes / 1024 / 1024) * 100) / 100 : null,
      },
      rssRequired
        ? {
            available: true,
            successfulSamples: '> 0',
            errors: 0,
            growthMb: `<= ${memoryGrowthLimitMb}`,
          }
        : `<= ${memoryGrowthLimitMb} MiB (optional)`,
    ),
  );

  return {
    assertions,
    passed: assertions.every((entry) => entry.passed),
    summary: {
      completedRounds: rounds.length,
      participantsPerRound: participants,
      expectedVotes,
      acceptedVotes,
      monitoringSamples: healthStats.length,
      maxParticipants: participantMax,
      participantIncrease,
      maxVotesLastMinute: votesMax,
      maxTransitionsLastMinute: transitionsMax,
      maxSessionCreatesLastMinute: createsMax,
      httpSamples: runtime.targetHttp.samples,
      httpP95Ms: runtime.targetHttp.p95Ms,
      httpP99Ms: runtime.targetHttp.p99Ms,
      rssGrowthMb: rssMeasurable ? Math.round((rssGrowthBytes / 1024 / 1024) * 100) / 100 : null,
    },
  };
}

export { MONITORING_WARNING_THRESHOLDS };
