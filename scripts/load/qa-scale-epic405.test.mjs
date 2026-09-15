import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  QA_SCALE_CRITICAL_API_CLASSES,
  evaluateQaScaleGates,
  parseQaScaleArgs,
  qaScaleGatesPassed,
  qaScaleRuntimeForReport,
  resolveQaScaleRuntime,
  validateQaScaleConfig,
} from './lib/qa-scale-epic405.mjs';
import {
  QA_ASSEMBLY_EXPECTED_RANKING,
  QA_ASSEMBLY_FEATURED_QUESTIONS,
} from './lib/qa-scale-realistic-session.mjs';

const CONFIG_URL = new URL('./qa-scale-epic405.config.json', import.meta.url);

async function canonicalConfig() {
  return JSON.parse(await readFile(CONFIG_URL, 'utf8'));
}

function passingMetrics(config, { soak = false } = {}) {
  const byClass = Object.fromEntries(
    QA_SCALE_CRITICAL_API_CLASSES.map((apiClass) => {
      const successfulSamples = apiClass === 'QA_RATING' ? config.sampling.ratings : 100;
      return [
        apiClass,
        {
          samples: successfulSamples,
          successes: successfulSamples,
          technicalErrors: 0,
          expectedRejections: apiClass === 'QA_SUBMIT' ? 2 : 0,
          expectedRejectionsByKind: apiClass === 'QA_SUBMIT' ? { LIMIT: 1, DEADLINE: 1 } : {},
          expectedRejectionsByCode: apiClass === 'QA_SUBMIT' ? { PRECONDITION_FAILED: 2 } : {},
          p95Ms: 200,
          p99Ms: 400,
          expectedRejectionP95Ms: apiClass === 'QA_SUBMIT' ? 250 : null,
          expectedRejectionP99Ms: apiClass === 'QA_SUBMIT' ? 250 : null,
        },
      ];
    }),
  );
  return {
    seed: {
      joinedParticipants: config.seed.participants,
      participantSummaryCount: config.seed.participants,
      pagedParticipants: config.seed.participants,
      rejoinedParticipants: config.seed.rejoinSamples,
      rejoinIdentityMismatches: 0,
      joinEventParticipantCount: config.seed.participants,
      joinEventMaxListItems: 20,
      joinEventMessages: 100,
      joinEventErrors: 0,
      acceptedQuestions: config.seed.totalQuestions,
      qaTotalCount: config.seed.totalQuestions,
      qaPhysicalQuestionCount: config.seed.totalQuestions,
      finalSessionQuestionCount: config.seed.totalQuestions,
      ratingSamples: config.sampling.ratings,
      realisticSession: {
        featuredQuestions: QA_ASSEMBLY_FEATURED_QUESTIONS.length,
        successfulRatings: config.sampling.ratings,
        technicalRatingErrors: 0,
        rankings: Object.fromEntries(
          Object.entries(QA_ASSEMBLY_EXPECTED_RANKING).map(([sort, featureIndex]) => {
            const question = QA_ASSEMBLY_FEATURED_QUESTIONS[featureIndex];
            return [
              sort,
              {
                text: question.text,
                positiveVoteCount: question.positiveVotes,
                negativeVoteCount: question.negativeVotes,
              },
            ];
          }),
        ),
      },
      wordCloudCorpus: {
        outcome: 'SUCCESS',
        durationMs: 500,
        eligibleQuestionCount: config.seed.totalQuestions,
        analyzedQuestionCount: 500,
        sortMode: 'BEST',
        filter: 'ALL_ELIGIBLE',
      },
      wordCloudSideLoad: {
        outcome: 'EXPECTED_CONFLICT',
        durationMs: 250,
      },
      idempotencyReplayVerified: true,
      unexpectedReplays: 0,
      limitRejections: 1,
      deadlineRejections: 1,
    },
    api: {
      byClass,
      maxPayloadBytes: 64 * 1024,
      maxPageItems: 100,
      payloadViolations: 0,
      pageViolations: 0,
    },
    diagnostics: {
      qaApi: [
        {
          PARTICIPANT_QUERY: { samples: 100, p95Ms: 100 },
          QA_PAGE: { samples: 1_000, p95Ms: 200 },
        },
      ],
    },
    websocket: {
      initialApplied: config.websocket.activeClients,
      activeClientsInitial: config.websocket.activeClients,
      boundConnectionsInitial: config.websocket.activeClients,
      activeClientsAfterReconnect: config.websocket.activeClients,
      boundConnectionsAfterReconnect: config.websocket.activeClients,
      maxPayloadBytes: 64 * 1024,
      maxPageItems: config.websocket.subscriptionPageSize,
      payloadViolations: 0,
      pageViolations: 0,
      subscriptionErrors: 0,
      fanout: {
        targetRevisionKnown: true,
        applied: config.websocket.activeClients,
        p95Ms: 1_500,
      },
      reconnect: {
        targetRevisionKnown: true,
        publishedAfterResubscribe: true,
        applied: config.websocket.activeClients,
        samples: config.websocket.activeClients,
        p95Ms: 2_000,
        maxMs: 4_000,
      },
    },
    soak: soak
      ? {
          enabled: true,
          completedDurationMinutes: config.soak.durationMinutes,
          baselineAfterWarmup: true,
          backend: {
            instances: 2,
            errors: 0,
            maxRssGrowthBytes: 32 * 1024 * 1024,
            maxEventLoopP99Ms: 40,
          },
          database: { samples: 360, errors: 0, p95Ms: 15 },
          redis: { samples: 360, errors: 0, p95Ms: 4 },
        }
      : { enabled: false },
  };
}

test('validiert das unveränderbare Epic-405-Releaseprofil', async () => {
  const config = await canonicalConfig();
  assert.equal(validateQaScaleConfig(config), config);

  for (const [path, mutate] of [
    ['2.500 Teilnahmen', (copy) => (copy.seed.participants = 2_499)],
    ['25.000 Fragen', (copy) => (copy.seed.totalQuestions = 24_999)],
    ['realistisches Voteprofil', (copy) => (copy.sampling.ratings = 10_359)],
    ['exakt 500 WS-Clients', (copy) => (copy.websocket.activeClients = 499)],
    ['p95 darf nicht gelockert werden', (copy) => (copy.budgets.apiP95ExclusiveMs = 1_001)],
    [
      'Reconnect-Maximum darf nicht gelockert werden',
      (copy) => (copy.budgets.reconnectMaxMs = 10_001),
    ],
  ]) {
    const copy = structuredClone(config);
    mutate(copy);
    assert.throws(() => validateQaScaleConfig(copy), undefined, path);
  }
});

test('Argumentparser verlangt einen expliziten, eindeutigen Modus', () => {
  assert.deepEqual(parseQaScaleArgs(['--validate']), { mode: 'validate', configPath: null });
  assert.equal(parseQaScaleArgs(['--release', '--config', './profile.json']).mode, 'release');
  assert.throws(() => parseQaScaleArgs([]), /expliziter Modus/u);
  assert.throws(() => parseQaScaleArgs(['--validate', '--release']), /Genau ein Modus/u);
  assert.throws(() => parseQaScaleArgs(['--unknown']), /Unbekanntes Argument/u);
});

test('Laufzeitkonfiguration hält Secrets vollständig aus dem Report', () => {
  const secret = 'a'.repeat(32);
  const runtime = resolveQaScaleRuntime(
    {
      TRPC_URL: 'https://load.example.test/trpc',
      WS_URL: 'wss://load.example.test/ws',
      ADMIN_DIAGNOSTIC_SECRET: secret,
      QA_SCALE_BACKEND_PROBE_TOKEN: 'probe-token',
    },
    { mode: 'release', now: 123 },
  );
  const reportConfig = qaScaleRuntimeForReport(runtime);
  const serialized = JSON.stringify(reportConfig);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('probe-token'), false);
  assert.equal(reportConfig.diagnosticAuthenticationConfigured, true);

  const databaseUrl = 'postgresql://load_user:db_password@localhost:5432/load';
  const redisUrl = 'redis://:redis_password@localhost:6379/0';
  const soakRuntime = resolveQaScaleRuntime(
    {
      ADMIN_DIAGNOSTIC_SECRET: secret,
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      QA_SCALE_BACKEND_PROBE_URLS: 'https://backend.example.test/runtime',
    },
    { mode: 'soak' },
  );
  const soakReport = JSON.stringify(qaScaleRuntimeForReport(soakRuntime));
  assert.equal(soakReport.includes(databaseUrl), false);
  assert.equal(soakReport.includes(redisUrl), false);
  assert.equal(soakReport.includes('db_password'), false);
  assert.equal(soakReport.includes('redis_password'), false);
});

test('Soak-Konfiguration verlangt DB-, Redis- und Backend-Proben vor Netzwerkzugriff', () => {
  const base = {
    ADMIN_DIAGNOSTIC_SECRET: 'a'.repeat(32),
  };
  assert.throws(() => resolveQaScaleRuntime({}, { mode: 'release' }), /ADMIN_DIAGNOSTIC_SECRET/u);
  assert.throws(
    () => resolveQaScaleRuntime(base, { mode: 'soak' }),
    /DATABASE_URL ist für --soak verpflichtend/u,
  );
  assert.throws(
    () =>
      resolveQaScaleRuntime(
        {
          ...base,
          DATABASE_URL: 'postgresql://user:password@localhost/database',
          REDIS_URL: 'redis://localhost:6379',
        },
        { mode: 'soak' },
      ),
    /QA_SCALE_BACKEND_PROBE_URLS ist für --soak verpflichtend/u,
  );
});

test('akzeptiert einen vollständigen Release- und Soak-Nachweis', async () => {
  const config = await canonicalConfig();
  const releaseAssertions = evaluateQaScaleGates(config, passingMetrics(config));
  assert.equal(qaScaleGatesPassed(releaseAssertions), true);

  const soakAssertions = evaluateQaScaleGates(config, passingMetrics(config, { soak: true }));
  assert.equal(qaScaleGatesPassed(soakAssertions), true);
  assert.equal(
    soakAssertions.some((entry) => entry.name === 'soak-backend-eventloop'),
    true,
  );
});

test('scheitert hart an Grenzwerten, fehlender Revision oder unvollständigen Proben', async () => {
  const config = await canonicalConfig();
  const metrics = passingMetrics(config, { soak: true });
  metrics.api.byClass.QA_SUBMIT.p95Ms = config.budgets.apiP95ExclusiveMs;
  metrics.api.byClass.QA_SUBMIT.technicalErrors = 1;
  metrics.api.byClass.QA_SUBMIT.successes = 199;
  metrics.seed.deadlineRejections = 0;
  metrics.seed.wordCloudCorpus.analyzedQuestionCount = 499;
  metrics.seed.realisticSession.successfulRatings -= 1;
  metrics.seed.realisticSession.rankings.CONTROVERSIAL.text = 'Falsche Spitzenfrage';
  metrics.websocket.reconnect.publishedAfterResubscribe = false;
  metrics.websocket.reconnect.applied = 499;
  metrics.websocket.reconnect.maxMs = config.budgets.reconnectMaxMs + 1;
  metrics.api.maxPayloadBytes = config.budgets.payloadMaxBytes + 1;
  metrics.diagnostics.qaApi[0].QA_PAGE.p95Ms = config.budgets.dbP95MaxMs + 1;
  metrics.websocket.maxPageItems = config.budgets.pageMaxItems + 1;
  metrics.seed.joinEventMaxListItems = config.budgets.pageMaxItems + 1;
  metrics.soak.backend.maxEventLoopP99Ms = null;
  metrics.soak.database.samples = 0;

  const assertions = evaluateQaScaleGates(config, metrics);
  assert.equal(qaScaleGatesPassed(assertions), false);
  for (const name of [
    'api-qa_submit-p95',
    'api-qa_submit-technical-error-rate',
    'release-bounded-participant-join-events',
    'release-deadline-rejection',
    'release-wordcloud-corpus',
    'release-realistic-assembly-ranking',
    'database-query-envelope-p95',
    'payload-http-and-ws',
    'page-and-snapshot-size',
    'websocket-reconnect-known-post-resubscribe-revision',
    'websocket-reconnect-max',
    'soak-backend-eventloop',
    'soak-database-probe',
  ]) {
    assert.equal(assertions.find((entry) => entry.name === name)?.passed, false, name);
  }
});
