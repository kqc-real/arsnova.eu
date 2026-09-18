import { resolve } from 'node:path';

import {
  QA_ASSEMBLY_EXPECTED_RANKING,
  QA_ASSEMBLY_FEATURED_QUESTIONS,
  QA_ASSEMBLY_RATING_COUNT,
} from './qa-scale-realistic-session.mjs';

export const QA_SCALE_CRITICAL_API_CLASSES = Object.freeze([
  'JOIN_REJOIN',
  'PARTICIPANT_QUERY',
  'QA_PAGE',
  'QA_SUBMIT',
  'QA_RATING',
  'QA_MODERATION',
  'HEALTH_STATS',
]);

const RELEASE_PROFILE = Object.freeze({
  participants: 2_500,
  rejoinSamples: 500,
  questionsPerParticipant: 10,
  totalQuestions: 25_000,
  ratingSamples: QA_ASSEMBLY_RATING_COUNT,
  activeWsClients: 500,
  apiP95ExclusiveMs: 1_000,
  apiP99ExclusiveMs: 2_000,
  technicalErrorRateExclusiveMax: 0.005,
  dbP95MaxMs: 250,
  payloadMaxBytes: 256 * 1024,
  pageMaxItems: 100,
  fanoutP95MaxMs: 3_000,
  reconnectP95MaxMs: 3_000,
  reconnectMaxMs: 10_000,
  soakDurationMinutes: 60,
  rssGrowthMaxBytes: 256 * 1024 * 1024,
  backendEventLoopP99MaxMs: 200,
});

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} muss ein JSON-Objekt sein.`);
  }
  return value;
}

function requireNumber(value, path, { integer = false, min = -Infinity, max = Infinity } = {}) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (integer && !Number.isSafeInteger(value)) ||
    value < min ||
    value > max
  ) {
    const kind = integer ? 'ganze Zahl' : 'endliche Zahl';
    throw new Error(`${path} muss eine ${kind} zwischen ${min} und ${max} sein.`);
  }
  return value;
}

function requireExact(value, expected, path) {
  if (value !== expected) {
    throw new Error(
      `${path} muss für das Releaseprofil exakt ${expected} sein (erhalten: ${value}).`,
    );
  }
}

function assertNoSecretsInConfig(value, path = 'config') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretsInConfig(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (/(?:secret|token|password|credential|database[_-]?url|redis[_-]?url)/iu.test(key)) {
      throw new Error(`${path}.${key} darf keine Laufzeit-Credentials enthalten.`);
    }
    assertNoSecretsInConfig(entry, `${path}.${key}`);
  }
}

export function validateQaScaleConfig(rawConfig) {
  const config = requireObject(rawConfig, 'config');
  assertNoSecretsInConfig(config);
  requireExact(config.schemaVersion, 1, 'config.schemaVersion');
  requireExact(config.profile, 'epic-405-release', 'config.profile');

  const seed = requireObject(config.seed, 'config.seed');
  for (const [key, expected] of [
    ['participants', RELEASE_PROFILE.participants],
    ['rejoinSamples', RELEASE_PROFILE.rejoinSamples],
    ['questionsPerParticipant', RELEASE_PROFILE.questionsPerParticipant],
    ['totalQuestions', RELEASE_PROFILE.totalQuestions],
  ]) {
    requireNumber(seed[key], `config.seed.${key}`, { integer: true, min: 1 });
    requireExact(seed[key], expected, `config.seed.${key}`);
  }
  requireExact(
    seed.participants * seed.questionsPerParticipant,
    seed.totalQuestions,
    'config.seed.participants * config.seed.questionsPerParticipant',
  );

  const websocket = requireObject(config.websocket, 'config.websocket');
  requireNumber(websocket.activeClients, 'config.websocket.activeClients', {
    integer: true,
    min: 1,
  });
  requireExact(
    websocket.activeClients,
    RELEASE_PROFILE.activeWsClients,
    'config.websocket.activeClients',
  );
  requireNumber(websocket.subscriptionPageSize, 'config.websocket.subscriptionPageSize', {
    integer: true,
    min: 1,
    max: RELEASE_PROFILE.pageMaxItems,
  });
  requireExact(
    websocket.subscriptionPageSize,
    RELEASE_PROFILE.pageMaxItems,
    'config.websocket.subscriptionPageSize',
  );

  const concurrency = requireObject(config.concurrency, 'config.concurrency');
  for (const key of ['joins', 'submits', 'queries', 'websockets']) {
    requireNumber(concurrency[key], `config.concurrency.${key}`, {
      integer: true,
      min: 1,
      max: 500,
    });
  }
  requireExact(concurrency.websockets, websocket.activeClients, 'config.concurrency.websockets');

  const sampling = requireObject(config.sampling, 'config.sampling');
  for (const key of ['participantPageSize', 'qaPageSize']) {
    requireNumber(sampling[key], `config.sampling.${key}`, {
      integer: true,
      min: 1,
      max: RELEASE_PROFILE.pageMaxItems,
    });
  }
  for (const [key, min] of [
    ['ratings', 100],
    ['moderations', 100],
    ['healthStats', 100],
  ]) {
    requireNumber(sampling[key], `config.sampling.${key}`, {
      integer: true,
      min,
      max: RELEASE_PROFILE.totalQuestions,
    });
  }
  requireExact(sampling.ratings, RELEASE_PROFILE.ratingSamples, 'config.sampling.ratings');
  if (
    !Array.isArray(sampling.sortModes) ||
    sampling.sortModes.length !== 4 ||
    new Set(sampling.sortModes).size !== 4 ||
    !['TOP', 'BEST', 'CONTROVERSIAL', 'TIME'].every((mode) => sampling.sortModes.includes(mode))
  ) {
    throw new Error(
      'config.sampling.sortModes muss TOP, BEST, CONTROVERSIAL und TIME jeweils genau einmal enthalten.',
    );
  }

  const budgets = requireObject(config.budgets, 'config.budgets');
  for (const [key, expected] of [
    ['apiP95ExclusiveMs', RELEASE_PROFILE.apiP95ExclusiveMs],
    ['apiP99ExclusiveMs', RELEASE_PROFILE.apiP99ExclusiveMs],
    ['technicalErrorRateExclusiveMax', RELEASE_PROFILE.technicalErrorRateExclusiveMax],
    ['dbP95MaxMs', RELEASE_PROFILE.dbP95MaxMs],
    ['payloadMaxBytes', RELEASE_PROFILE.payloadMaxBytes],
    ['pageMaxItems', RELEASE_PROFILE.pageMaxItems],
    ['fanoutP95MaxMs', RELEASE_PROFILE.fanoutP95MaxMs],
    ['reconnectP95MaxMs', RELEASE_PROFILE.reconnectP95MaxMs],
    ['reconnectMaxMs', RELEASE_PROFILE.reconnectMaxMs],
    ['rssGrowthMaxBytes', RELEASE_PROFILE.rssGrowthMaxBytes],
    ['backendEventLoopP99MaxMs', RELEASE_PROFILE.backendEventLoopP99MaxMs],
  ]) {
    requireNumber(budgets[key], `config.budgets.${key}`, { min: 0 });
    requireExact(budgets[key], expected, `config.budgets.${key}`);
  }

  const soak = requireObject(config.soak, 'config.soak');
  requireNumber(soak.durationMinutes, 'config.soak.durationMinutes', {
    integer: true,
    min: 1,
  });
  requireExact(
    soak.durationMinutes,
    RELEASE_PROFILE.soakDurationMinutes,
    'config.soak.durationMinutes',
  );
  requireNumber(soak.warmupSeconds, 'config.soak.warmupSeconds', {
    integer: true,
    min: 1,
    max: 600,
  });
  requireNumber(soak.cycleIntervalMs, 'config.soak.cycleIntervalMs', {
    integer: true,
    min: 250,
    max: 60_000,
  });
  requireNumber(soak.probeIntervalMs, 'config.soak.probeIntervalMs', {
    integer: true,
    min: 1_000,
    max: 60_000,
  });

  return config;
}

export function parseQaScaleArgs(argv) {
  let mode = null;
  let configPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      if (mode) throw new Error('--help darf nicht mit einem Ausführungsmodus kombiniert werden.');
      mode = 'help';
      continue;
    }
    if (argument === '--validate' || argument === '--release' || argument === '--soak') {
      const nextMode = argument.slice(2);
      if (mode) throw new Error('Genau ein Modus ist erlaubt: --validate, --release oder --soak.');
      mode = nextMode;
      continue;
    }
    if (argument === '--config') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--config benötigt einen Dateipfad.');
      }
      configPath = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unbekanntes Argument: ${argument}`);
  }
  if (!mode) {
    throw new Error('Ein expliziter Modus ist erforderlich: --validate, --release oder --soak.');
  }
  return { mode, configPath };
}

function splitList(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function endpointUrl(value, name, protocols) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} ist keine gültige URL.`);
  }
  if (!protocols.includes(url.protocol)) {
    throw new Error(`${name} muss eines der Protokolle ${protocols.join(', ')} verwenden.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} darf keine Zugangsdaten, Query-Parameter oder Fragmente enthalten.`);
  }
  return url.toString().replace(/\/$/, '');
}

function serviceUrl(value, name, protocols) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} ist keine gültige URL.`);
  }
  if (!protocols.includes(url.protocol)) {
    throw new Error(`${name} muss eines der Protokolle ${protocols.join(', ')} verwenden.`);
  }
  return url.toString();
}

export function resolveQaScaleRuntime(env = {}, { mode = 'validate', now = Date.now() } = {}) {
  if (!['validate', 'release', 'soak'].includes(mode)) {
    throw new Error(`Ungültiger Laufzeitmodus: ${mode}`);
  }
  const trpcUrl = endpointUrl(
    String(env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim(),
    'TRPC_URL',
    ['http:', 'https:'],
  );
  const wsUrl = endpointUrl(String(env.WS_URL || 'ws://127.0.0.1:3001').trim(), 'WS_URL', [
    'ws:',
    'wss:',
  ]);
  const diagnosticTrpcUrls = (
    splitList(env.QA_SCALE_DIAGNOSTIC_TRPC_URLS).length > 0
      ? splitList(env.QA_SCALE_DIAGNOSTIC_TRPC_URLS)
      : [trpcUrl]
  ).map((value, index) =>
    endpointUrl(value, `QA_SCALE_DIAGNOSTIC_TRPC_URLS[${index}]`, ['http:', 'https:']),
  );
  const backendProbeUrls = splitList(env.QA_SCALE_BACKEND_PROBE_URLS).map((value, index) =>
    endpointUrl(value, `QA_SCALE_BACKEND_PROBE_URLS[${index}]`, ['http:', 'https:']),
  );
  const diagnosticSecret = String(env.ADMIN_DIAGNOSTIC_SECRET || '').trim();
  const backendProbeToken = String(env.QA_SCALE_BACKEND_PROBE_TOKEN || '').trim();
  const databaseUrl = String(env.DATABASE_URL || '').trim();
  const redisUrl = String(env.REDIS_URL || '').trim();

  if (mode !== 'validate' && diagnosticSecret.length < 32) {
    throw new Error(
      'ADMIN_DIAGNOSTIC_SECRET muss für Release-/Soak-Gates gesetzt und mindestens 32 Zeichen lang sein.',
    );
  }
  if (mode === 'soak') {
    if (!databaseUrl) throw new Error('DATABASE_URL ist für --soak verpflichtend.');
    if (!redisUrl) throw new Error('REDIS_URL ist für --soak verpflichtend.');
    if (backendProbeUrls.length === 0) {
      throw new Error(
        'QA_SCALE_BACKEND_PROBE_URLS ist für --soak verpflichtend (RSS und Backend-Eventloop je Instanz).',
      );
    }
    serviceUrl(databaseUrl, 'DATABASE_URL', ['postgres:', 'postgresql:']);
    serviceUrl(redisUrl, 'REDIS_URL', ['redis:', 'rediss:']);
  }

  return {
    mode,
    trpcUrl,
    wsUrl,
    diagnosticTrpcUrls,
    diagnosticSecret,
    backendProbeUrls,
    backendProbeToken,
    databaseUrl,
    redisUrl,
    reportFile: resolve(
      String(
        env.QA_SCALE_REPORT_FILE ||
          env.REPORT_FILE ||
          `artifacts/load/qa-scale-epic405-${now}.json`,
      ).trim(),
    ),
    junitFile:
      String(env.QA_SCALE_JUNIT_FILE || env.JUNIT_FILE || '').trim() === ''
        ? null
        : resolve(String(env.QA_SCALE_JUNIT_FILE || env.JUNIT_FILE).trim()),
  };
}

export function qaScaleRuntimeForReport(runtime) {
  return {
    mode: runtime.mode,
    trpcOrigin: new URL(runtime.trpcUrl).origin,
    wsOrigin: new URL(runtime.wsUrl).origin,
    diagnosticTargets: runtime.diagnosticTrpcUrls.length,
    backendProbeTargets: runtime.backendProbeUrls.length,
    databaseProbeConfigured: runtime.databaseUrl.length > 0,
    redisProbeConfigured: runtime.redisUrl.length > 0,
    diagnosticAuthenticationConfigured: runtime.diagnosticSecret.length >= 32,
    backendProbeAuthenticationConfigured: runtime.backendProbeToken.length > 0,
  };
}

function assertion(name, passed, expected, actual, message) {
  return {
    name,
    passed: Boolean(passed),
    expected,
    actual,
    ...(!passed && message ? { message } : {}),
  };
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function technicalErrorRate(summary) {
  const denominator = (summary?.successes ?? 0) + (summary?.technicalErrors ?? 0);
  return denominator > 0 ? (summary.technicalErrors ?? 0) / denominator : null;
}

export function evaluateQaScaleGates(config, metrics) {
  validateQaScaleConfig(config);
  const assertions = [];
  const seed = metrics?.seed ?? {};
  const websocket = metrics?.websocket ?? {};
  const api = metrics?.api ?? {};
  const budgets = config.budgets;

  assertions.push(
    assertion(
      'release-seed-participants',
      seed.joinedParticipants === config.seed.participants &&
        seed.participantSummaryCount === config.seed.participants &&
        seed.pagedParticipants === config.seed.participants,
      config.seed.participants,
      {
        joined: seed.joinedParticipants ?? null,
        summary: seed.participantSummaryCount ?? null,
        paged: seed.pagedParticipants ?? null,
      },
      'Der Bestand von 2.500 persistierten Teilnahmen ist nicht dreifach bestätigt.',
    ),
    assertion(
      'release-rejoin-identity',
      seed.rejoinedParticipants === config.seed.rejoinSamples &&
        seed.rejoinIdentityMismatches === 0,
      { rejoined: config.seed.rejoinSamples, identityMismatches: 0 },
      {
        rejoined: seed.rejoinedParticipants ?? null,
        identityMismatches: seed.rejoinIdentityMismatches ?? null,
      },
      'Rejoin ist nicht für 500/500 Identitäten stabil.',
    ),
    assertion(
      'release-bounded-participant-join-events',
      seed.joinEventParticipantCount === config.seed.participants &&
        (seed.joinEventMessages ?? 0) > 0 &&
        seed.joinEventErrors === 0 &&
        finite(seed.joinEventMaxListItems) &&
        seed.joinEventMaxListItems <= budgets.pageMaxItems,
      {
        participantCount: config.seed.participants,
        messages: '> 0',
        errors: 0,
        maxListItems: `<= ${budgets.pageMaxItems}`,
      },
      {
        participantCount: seed.joinEventParticipantCount ?? null,
        messages: seed.joinEventMessages ?? null,
        errors: seed.joinEventErrors ?? null,
        maxListItems: seed.joinEventMaxListItems ?? null,
      },
      'Teilnahme-Join-Events bestätigen den Endbestand nicht in begrenzten Snapshots.',
    ),
    assertion(
      'release-seed-questions',
      seed.acceptedQuestions === config.seed.totalQuestions &&
        seed.qaTotalCount === config.seed.totalQuestions &&
        seed.qaPhysicalQuestionCount === config.seed.totalQuestions &&
        seed.finalSessionQuestionCount === config.seed.totalQuestions,
      config.seed.totalQuestions,
      {
        accepted: seed.acceptedQuestions ?? null,
        listTotal: seed.qaTotalCount ?? null,
        physical: seed.qaPhysicalQuestionCount ?? null,
        quotaTotal: seed.finalSessionQuestionCount ?? null,
      },
      'Der physische 25.000er Fragenbestand ist nicht über Submit, Liste, Bestandszähler und Kontingent bestätigt.',
    ),
    assertion(
      'release-realistic-assembly-ranking',
      seed.ratingSamples === config.sampling.ratings &&
        seed.realisticSession?.successfulRatings === config.sampling.ratings &&
        seed.realisticSession?.technicalRatingErrors === 0 &&
        seed.realisticSession?.featuredQuestions === QA_ASSEMBLY_FEATURED_QUESTIONS.length &&
        Object.entries(QA_ASSEMBLY_EXPECTED_RANKING).every(([sort, featureIndex]) => {
          const expected = QA_ASSEMBLY_FEATURED_QUESTIONS[featureIndex];
          const actual = seed.realisticSession?.rankings?.[sort];
          return (
            actual?.text === expected.text &&
            actual?.positiveVoteCount === expected.positiveVotes &&
            actual?.negativeVoteCount === expected.negativeVotes
          );
        }),
      {
        ratings: config.sampling.ratings,
        successfulRatings: config.sampling.ratings,
        technicalRatingErrors: 0,
        featuredQuestions: QA_ASSEMBLY_FEATURED_QUESTIONS.length,
        winners: Object.fromEntries(
          Object.entries(QA_ASSEMBLY_EXPECTED_RANKING).map(([sort, featureIndex]) => [
            sort,
            QA_ASSEMBLY_FEATURED_QUESTIONS[featureIndex].text,
          ]),
        ),
      },
      {
        ratings: seed.ratingSamples ?? null,
        successfulRatings: seed.realisticSession?.successfulRatings ?? null,
        technicalRatingErrors: seed.realisticSession?.technicalRatingErrors ?? null,
        featuredQuestions: seed.realisticSession?.featuredQuestions ?? null,
        rankings: seed.realisticSession?.rankings ?? null,
      },
      'Die realistische Vote-Verteilung bestätigt die erwarteten TOP-, BEST- und CONTROVERSIAL-Spitzen nicht.',
    ),
    assertion(
      'release-wordcloud-corpus',
      seed.wordCloudCorpus?.outcome === 'SUCCESS' &&
        seed.wordCloudCorpus?.eligibleQuestionCount === config.seed.totalQuestions &&
        seed.wordCloudCorpus?.analyzedQuestionCount === 500 &&
        seed.wordCloudCorpus?.sortMode === 'BEST' &&
        seed.wordCloudCorpus?.filter === 'ALL_ELIGIBLE',
      {
        outcome: 'SUCCESS',
        eligibleQuestionCount: config.seed.totalQuestions,
        analyzedQuestionCount: 500,
        sortMode: 'BEST',
        filter: 'ALL_ELIGIBLE',
      },
      seed.wordCloudCorpus ?? null,
      'Die serverseitige Wortwolke bestätigt nicht exakt die 500 höchstplatzierten Quellen des 25.000er Korpus.',
    ),
    assertion(
      'release-wordcloud-side-load',
      ['SUCCESS', 'EXPECTED_CONFLICT'].includes(seed.wordCloudSideLoad?.outcome) &&
        finite(seed.wordCloudSideLoad?.durationMs),
      'abgeschlossener Analysejob oder revisionsbedingter fachlicher Konflikt',
      seed.wordCloudSideLoad ?? null,
      'Der parallel zu Live-APIs gestartete Wortwolkenjob endete technisch fehlerhaft oder blieb ungemessen.',
    ),
    assertion(
      'release-submit-idempotency',
      seed.idempotencyReplayVerified === true && seed.unexpectedReplays === 0,
      { retryVerified: true, unexpectedReplays: 0 },
      {
        retryVerified: seed.idempotencyReplayVerified ?? false,
        unexpectedReplays: seed.unexpectedReplays ?? null,
      },
      'Der Submit-Idempotency-Vertrag ist nicht nachgewiesen.',
    ),
    assertion(
      'release-limit-rejection',
      seed.limitRejections === 1 && api.byClass?.QA_SUBMIT?.expectedRejectionsByKind?.LIMIT === 1,
      { acceptedByHarness: 1, classifiedInApiMetrics: 1 },
      {
        acceptedByHarness: seed.limitRejections ?? null,
        classifiedInApiMetrics: api.byClass?.QA_SUBMIT?.expectedRejectionsByKind?.LIMIT ?? null,
      },
      'Der zusätzliche Submit wurde nicht genau einmal als fachliche Limit-Ablehnung erfasst.',
    ),
    assertion(
      'release-deadline-rejection',
      seed.deadlineRejections === 1 &&
        api.byClass?.QA_SUBMIT?.expectedRejectionsByKind?.DEADLINE === 1,
      { acceptedByHarness: 1, classifiedInApiMetrics: 1 },
      {
        acceptedByHarness: seed.deadlineRejections ?? null,
        classifiedInApiMetrics: api.byClass?.QA_SUBMIT?.expectedRejectionsByKind?.DEADLINE ?? null,
      },
      'Der Submit nach Q&A-Schließung wurde nicht genau einmal als fachliche Frist-/Kanalablehnung erfasst.',
    ),
  );

  for (const apiClass of QA_SCALE_CRITICAL_API_CLASSES) {
    const summary = api.byClass?.[apiClass];
    const errorRate = technicalErrorRate(summary);
    assertions.push(
      assertion(
        `api-${apiClass.toLowerCase()}-samples`,
        (summary?.samples ?? 0) > 0 && (summary?.successes ?? 0) > 0,
        'mindestens ein erfolgreicher Sample',
        {
          samples: summary?.samples ?? 0,
          successes: summary?.successes ?? 0,
        },
        `${apiClass} besitzt keine belastbare Stichprobe.`,
      ),
      assertion(
        `api-${apiClass.toLowerCase()}-p95`,
        finite(summary?.p95Ms) && summary.p95Ms < budgets.apiP95ExclusiveMs,
        `< ${budgets.apiP95ExclusiveMs} ms`,
        summary?.p95Ms ?? null,
        `${apiClass} verletzt das exklusive p95-Budget.`,
      ),
      assertion(
        `api-${apiClass.toLowerCase()}-p99`,
        finite(summary?.p99Ms) && summary.p99Ms < budgets.apiP99ExclusiveMs,
        `< ${budgets.apiP99ExclusiveMs} ms`,
        summary?.p99Ms ?? null,
        `${apiClass} verletzt das exklusive p99-Budget.`,
      ),
      assertion(
        `api-${apiClass.toLowerCase()}-technical-error-rate`,
        finite(errorRate) && errorRate < budgets.technicalErrorRateExclusiveMax,
        `< ${budgets.technicalErrorRateExclusiveMax}`,
        errorRate,
        `${apiClass} verletzt die technische Fehlerquote.`,
      ),
    );
    if ((summary?.expectedRejections ?? 0) > 0) {
      assertions.push(
        assertion(
          `api-${apiClass.toLowerCase()}-expected-rejection-p95`,
          finite(summary.expectedRejectionP95Ms) &&
            summary.expectedRejectionP95Ms < budgets.apiP95ExclusiveMs,
          `< ${budgets.apiP95ExclusiveMs} ms`,
          summary.expectedRejectionP95Ms ?? null,
          `${apiClass} verletzt für erwartete Ablehnungen das p95-Budget.`,
        ),
        assertion(
          `api-${apiClass.toLowerCase()}-expected-rejection-p99`,
          finite(summary.expectedRejectionP99Ms) &&
            summary.expectedRejectionP99Ms < budgets.apiP99ExclusiveMs,
          `< ${budgets.apiP99ExclusiveMs} ms`,
          summary.expectedRejectionP99Ms ?? null,
          `${apiClass} verletzt für erwartete Ablehnungen das p99-Budget.`,
        ),
      );
    }
  }

  const queryEnvelopeClasses = ['PARTICIPANT_QUERY', 'QA_PAGE'];
  const queryEnvelopeObservations = queryEnvelopeClasses.map((apiClass) => {
    const values = (metrics?.diagnostics?.qaApi ?? [])
      .map((snapshot) => snapshot?.[apiClass])
      .filter((summary) => (summary?.samples ?? 0) > 0 && finite(summary?.p95Ms));
    return {
      apiClass,
      samples: values.reduce((sum, summary) => sum + summary.samples, 0),
      maxP95Ms: values.length > 0 ? Math.max(...values.map((summary) => summary.p95Ms)) : null,
    };
  });
  const queryEnvelopeComplete = queryEnvelopeObservations.every(
    (entry) => entry.samples > 0 && finite(entry.maxP95Ms) && entry.maxP95Ms <= budgets.dbP95MaxMs,
  );

  assertions.push(
    assertion(
      'database-query-envelope-p95',
      queryEnvelopeComplete,
      `serverseitige Query-Hülle je Klasse <= ${budgets.dbP95MaxMs} ms`,
      queryEnvelopeObservations,
      'Die geschützte serverseitige Teilnehmer-/Q&A-Query-Hülle fehlt oder überschreitet das DB-p95-Budget; als Obergrenze schließt sie DB-Laufzeit und Server-Overhead ein.',
    ),
    assertion(
      'payload-http-and-ws',
      finite(api.maxPayloadBytes) &&
        api.maxPayloadBytes <= budgets.payloadMaxBytes &&
        finite(websocket.maxPayloadBytes) &&
        websocket.maxPayloadBytes <= budgets.payloadMaxBytes &&
        (api.payloadViolations ?? 0) === 0 &&
        (websocket.payloadViolations ?? 0) === 0,
      `<= ${budgets.payloadMaxBytes} Bytes je Anwendungspayload`,
      {
        httpMax: api.maxPayloadBytes ?? null,
        wsMax: websocket.maxPayloadBytes ?? null,
        violations: (api.payloadViolations ?? 0) + (websocket.payloadViolations ?? 0),
      },
      'Mindestens ein HTTP-/WS-Anwendungspayload überschreitet 256 KiB oder wurde nicht gemessen.',
    ),
    assertion(
      'page-and-snapshot-size',
      finite(api.maxPageItems) &&
        api.maxPageItems <= budgets.pageMaxItems &&
        finite(websocket.maxPageItems) &&
        websocket.maxPageItems <= budgets.pageMaxItems &&
        (api.pageViolations ?? 0) === 0 &&
        (websocket.pageViolations ?? 0) === 0,
      `<= ${budgets.pageMaxItems} Listeneinträge`,
      {
        httpMax: api.maxPageItems ?? null,
        wsMax: websocket.maxPageItems ?? null,
        violations: (api.pageViolations ?? 0) + (websocket.pageViolations ?? 0),
      },
      'Mindestens eine Seite oder ein Snapshot überschreitet 100 Einträge oder wurde nicht gemessen.',
    ),
    assertion(
      'websocket-exact-active-clients',
      websocket.initialApplied === config.websocket.activeClients &&
        websocket.activeClientsInitial === config.websocket.activeClients &&
        websocket.boundConnectionsInitial === config.websocket.activeClients &&
        websocket.activeClientsAfterReconnect === config.websocket.activeClients &&
        websocket.boundConnectionsAfterReconnect === config.websocket.activeClients,
      config.websocket.activeClients,
      {
        initialApplied: websocket.initialApplied ?? null,
        harnessInitial: websocket.activeClientsInitial ?? null,
        serverInitial: websocket.boundConnectionsInitial ?? null,
        harnessAfterReconnect: websocket.activeClientsAfterReconnect ?? null,
        serverAfterReconnect: websocket.boundConnectionsAfterReconnect ?? null,
      },
      'Das Releaseprofil hatte nicht exakt 500 aktive, serverseitig gebundene WS-Clients.',
    ),
    assertion(
      'websocket-fanout-known-revision',
      websocket.fanout?.targetRevisionKnown === true &&
        websocket.fanout?.applied === config.websocket.activeClients &&
        finite(websocket.fanout?.p95Ms) &&
        websocket.fanout.p95Ms <= budgets.fanoutP95MaxMs,
      {
        applied: config.websocket.activeClients,
        p95Ms: `<= ${budgets.fanoutP95MaxMs}`,
      },
      websocket.fanout ?? null,
      'Die bekannte Q&A-Revision wurde nicht fristgerecht bei 500/500 Clients angewendet.',
    ),
    assertion(
      'websocket-reconnect-known-post-resubscribe-revision',
      websocket.reconnect?.targetRevisionKnown === true &&
        websocket.reconnect?.publishedAfterResubscribe === true &&
        websocket.reconnect?.applied === config.websocket.activeClients &&
        websocket.reconnect?.samples === config.websocket.activeClients,
      {
        targetRevisionKnown: true,
        publishedAfterResubscribe: true,
        applied: config.websocket.activeClients,
        samples: config.websocket.activeClients,
      },
      websocket.reconnect ?? null,
      'Reconnect endet nicht für 500/500 an einer nach Resubscribe publizierten bekannten Revision.',
    ),
    assertion(
      'websocket-reconnect-p95',
      finite(websocket.reconnect?.p95Ms) && websocket.reconnect.p95Ms <= budgets.reconnectP95MaxMs,
      `<= ${budgets.reconnectP95MaxMs} ms`,
      websocket.reconnect?.p95Ms ?? null,
      'Reconnect bis zur Anwendung der Zielrevision verletzt p95.',
    ),
    assertion(
      'websocket-reconnect-max',
      finite(websocket.reconnect?.maxMs) && websocket.reconnect.maxMs <= budgets.reconnectMaxMs,
      `<= ${budgets.reconnectMaxMs} ms`,
      websocket.reconnect?.maxMs ?? null,
      'Mindestens ein Client überschreitet das 10-Sekunden-Reconnect-Gate.',
    ),
    assertion(
      'websocket-subscription-errors',
      websocket.subscriptionErrors === 0,
      0,
      websocket.subscriptionErrors ?? null,
      'Während Initialverbindung oder Reconnect traten Subscription-Fehler auf.',
    ),
  );

  const soak = metrics?.soak ?? { enabled: false };
  if (soak.enabled === true) {
    assertions.push(
      assertion(
        'soak-duration',
        soak.completedDurationMinutes >= config.soak.durationMinutes,
        `>= ${config.soak.durationMinutes} Minuten`,
        soak.completedDurationMinutes ?? null,
        'Der optionale 60-Minuten-Soak wurde nicht vollständig abgeschlossen.',
      ),
      assertion(
        'soak-baseline-after-warmup',
        soak.baselineAfterWarmup === true,
        true,
        soak.baselineAfterWarmup ?? false,
        'Die RSS-Baseline wurde nicht unmittelbar nach dem Warm-up erfasst.',
      ),
      assertion(
        'soak-backend-rss',
        (soak.backend?.instances ?? 0) > 0 &&
          (soak.backend?.errors ?? 0) === 0 &&
          finite(soak.backend?.maxRssGrowthBytes) &&
          soak.backend.maxRssGrowthBytes <= budgets.rssGrowthMaxBytes,
        `RSS-Wachstum je Instanz <= ${budgets.rssGrowthMaxBytes} Bytes`,
        soak.backend ?? null,
        'Backend-RSS fehlt, ist fehlerhaft oder überschreitet 256 MiB.',
      ),
      assertion(
        'soak-backend-eventloop',
        (soak.backend?.instances ?? 0) > 0 &&
          (soak.backend?.errors ?? 0) === 0 &&
          finite(soak.backend?.maxEventLoopP99Ms) &&
          soak.backend.maxEventLoopP99Ms <= budgets.backendEventLoopP99MaxMs,
        `Backend-Eventloop-p99 <= ${budgets.backendEventLoopP99MaxMs} ms`,
        soak.backend ?? null,
        'Die verpflichtende Backend-Eventloop-Probe fehlt oder verletzt das Budget.',
      ),
      assertion(
        'soak-database-probe',
        (soak.database?.samples ?? 0) > 0 &&
          soak.database?.errors === 0 &&
          finite(soak.database?.p95Ms) &&
          soak.database.p95Ms <= budgets.dbP95MaxMs,
        { errors: 0, p95Ms: `<= ${budgets.dbP95MaxMs}` },
        soak.database ?? null,
        'Die verpflichtende DB-Probe fehlt, ist fehlerhaft oder verletzt p95.',
      ),
      assertion(
        'soak-redis-probe',
        (soak.redis?.samples ?? 0) > 0 && soak.redis?.errors === 0,
        { samples: '> 0', errors: 0 },
        soak.redis ?? null,
        'Die verpflichtende Redis-Probe fehlt oder ist fehlerhaft.',
      ),
    );
  }

  if (metrics?.fatalError) {
    assertions.push(
      assertion(
        'runner-completed',
        false,
        'kein Fatalfehler',
        metrics.fatalError,
        'Der Runner wurde vor vollständiger Gate-Auswertung abgebrochen.',
      ),
    );
  }

  return assertions;
}

export function qaScaleGatesPassed(assertions) {
  return (
    Array.isArray(assertions) && assertions.length > 0 && assertions.every((entry) => entry.passed)
  );
}
