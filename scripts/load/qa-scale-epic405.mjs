#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

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
  buildQaAssemblyQuestion,
  buildQaAssemblyVotePlan,
} from './lib/qa-scale-realistic-session.mjs';
import { writeLoadReport } from './lib/reporting.mjs';
import { createHostWsTrpc, createHttpTrpcSingle, createPublicWsTrpc } from './lib/trpc-runtime.mjs';
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { configureQaSessionIfNeeded } from './lib/configure-qa-if-needed.mjs';

const DEFAULT_CONFIG_PATH = fileURLToPath(
  new URL('./qa-scale-epic405.config.json', import.meta.url),
);
const EXPECTED_REJECTION_CODES = new Set([
  'BAD_REQUEST',
  'CONFLICT',
  'FORBIDDEN',
  'PRECONDITION_FAILED',
  'TOO_MANY_REQUESTS',
]);

function usage() {
  return `Epic #405 Q&A-Release-Harness

Verwendung:
  node scripts/load/qa-scale-epic405.mjs --validate [--config <datei>]
  node scripts/load/qa-scale-epic405.mjs --release  [--config <datei>]
  node scripts/load/qa-scale-epic405.mjs --soak     [--config <datei>]

--validate prüft ausschließlich lokale Konfiguration und Laufzeitwerte ohne Netzwerkzugriff.
--release erzeugt 2.500 Teilnahmen, 25.000 realistische Fragen und 10.360 Ratings
          über die API und prüft TOP/BEST/CONTROVERSIAL sowie 500 WS-Clients.
--soak führt danach zusätzlich den verpflichtend instrumentierten 60-Minuten-Soak aus.
`;
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function percentile(values, quantile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return Math.round((sorted[index] ?? 0) * 100) / 100;
}

function maxListItemsDeep(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return 0;
  seen.add(value);
  if (Array.isArray(value)) {
    return Math.max(value.length, ...value.map((entry) => maxListItemsDeep(entry, seen)));
  }
  return Math.max(0, ...Object.values(value).map((entry) => maxListItemsDeep(entry, seen)));
}

function serializedBytes(value) {
  const json = JSON.stringify(value);
  return json === undefined ? 0 : Buffer.byteLength(json, 'utf8');
}

function errorCode(error) {
  return (
    error?.data?.code ?? error?.shape?.data?.code ?? error?.cause?.data?.code ?? error?.code ?? null
  );
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function isExpectedLimitRejection(error) {
  const code = errorCode(error);
  const text = errorText(error).toLocaleLowerCase('de-DE');
  return (
    EXPECTED_REJECTION_CODES.has(code) &&
    (text.includes('kontingent') ||
      text.includes('limit') ||
      text.includes('maximal') ||
      text.includes('25.000'))
  );
}

function isExpectedDeadlineRejection(error) {
  const code = errorCode(error);
  const text = errorText(error).toLocaleLowerCase('de-DE');
  return (
    EXPECTED_REJECTION_CODES.has(code) &&
    (text.includes('frist') ||
      text.includes('abgelaufen') ||
      text.includes('geschlossen') ||
      text.includes('beendet'))
  );
}

class ApiMetrics {
  constructor(config) {
    this.config = config;
    this.buckets = Object.fromEntries(
      QA_SCALE_CRITICAL_API_CLASSES.map((apiClass) => [
        apiClass,
        {
          successes: [],
          technicalErrors: [],
          expectedRejections: [],
          expectedRejectionKinds: new Map(),
          expectedRejectionCodes: new Map(),
        },
      ]),
    );
    this.maxPayloadBytes = 0;
    this.maxPageItems = 0;
    this.payloadViolations = 0;
    this.pageViolations = 0;
  }

  observePayload(value) {
    const bytes = serializedBytes(value);
    const items = maxListItemsDeep(value);
    this.maxPayloadBytes = Math.max(this.maxPayloadBytes, bytes);
    this.maxPageItems = Math.max(this.maxPageItems, items);
    if (bytes > this.config.budgets.payloadMaxBytes) this.payloadViolations += 1;
    if (items > this.config.budgets.pageMaxItems) this.pageViolations += 1;
  }

  async measure(apiClass, operation, { expectedRejection, expectedRejectionKind } = {}) {
    const bucket = this.buckets[apiClass];
    if (!bucket) throw new Error(`Unbekannte API-Klasse: ${apiClass}`);
    const startedAt = performance.now();
    try {
      const value = await operation();
      bucket.successes.push(performance.now() - startedAt);
      this.observePayload(value);
      return value;
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      if (expectedRejection?.(error) === true) {
        bucket.expectedRejections.push(durationMs);
        const kind = expectedRejectionKind ?? 'EXPECTED';
        const code = errorCode(error) ?? 'UNKNOWN';
        bucket.expectedRejectionKinds.set(kind, (bucket.expectedRejectionKinds.get(kind) ?? 0) + 1);
        bucket.expectedRejectionCodes.set(code, (bucket.expectedRejectionCodes.get(code) ?? 0) + 1);
      } else {
        bucket.technicalErrors.push(durationMs);
      }
      throw error;
    }
  }

  report() {
    return {
      byClass: Object.fromEntries(
        Object.entries(this.buckets).map(([apiClass, bucket]) => {
          const normalDurations = [...bucket.successes, ...bucket.technicalErrors];
          return [
            apiClass,
            {
              samples: normalDurations.length + bucket.expectedRejections.length,
              successes: bucket.successes.length,
              technicalErrors: bucket.technicalErrors.length,
              expectedRejections: bucket.expectedRejections.length,
              expectedRejectionsByKind: Object.fromEntries(bucket.expectedRejectionKinds),
              expectedRejectionsByCode: Object.fromEntries(bucket.expectedRejectionCodes),
              p50Ms: percentile(normalDurations, 0.5),
              p95Ms: percentile(normalDurations, 0.95),
              p99Ms: percentile(normalDurations, 0.99),
              maxMs:
                normalDurations.length > 0
                  ? Math.round(Math.max(...normalDurations) * 100) / 100
                  : null,
              expectedRejectionP95Ms: percentile(bucket.expectedRejections, 0.95),
              expectedRejectionP99Ms: percentile(bucket.expectedRejections, 0.99),
            },
          ];
        }),
      ),
      maxPayloadBytes: this.maxPayloadBytes,
      maxPageItems: this.maxPageItems,
      payloadViolations: this.payloadViolations,
      pageViolations: this.pageViolations,
    };
  }
}

class WsPayloadMetrics {
  constructor(config) {
    this.config = config;
    this.maxPayloadBytes = 0;
    this.maxPageItems = 0;
    this.payloadViolations = 0;
    this.pageViolations = 0;
  }

  observe(value) {
    const bytes = serializedBytes(value);
    const items = maxListItemsDeep(value);
    this.maxPayloadBytes = Math.max(this.maxPayloadBytes, bytes);
    this.maxPageItems = Math.max(this.maxPageItems, items);
    if (bytes > this.config.budgets.payloadMaxBytes) this.payloadViolations += 1;
    if (items > this.config.budgets.pageMaxItems) this.pageViolations += 1;
  }

  report() {
    return {
      maxPayloadBytes: this.maxPayloadBytes,
      maxPageItems: this.maxPageItems,
      payloadViolations: this.payloadViolations,
      pageViolations: this.pageViolations,
    };
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function waitUntil(predicate, timeoutMs, intervalMs = 25) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() <= deadline) {
    if (await predicate()) return true;
    await sleep(intervalMs);
  }
  return Boolean(await predicate());
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} nach ${timeoutMs} ms nicht erreicht.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function loadConfig(configPath) {
  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  return validateQaScaleConfig(raw);
}

function participantHttp(runtime, participant) {
  return createHttpTrpcSingle(
    runtime.trpcUrl,
    undefined,
    undefined,
    undefined,
    participant.rejoinToken,
  );
}

async function createConfiguredSession(publicTrpc, runtime, apiMetrics) {
  const created = await publicTrpc.session.create.mutate({
    type: 'Q_AND_A',
    title: `Epic 405 Release ${Date.now()}`,
    qaEnabled: true,
    qaModerationMode: false,
    quickFeedbackEnabled: false,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    anonymousMode: false,
    teamMode: false,
  });
  apiMetrics.observePayload(created);
  const hostTrpc = createHttpTrpcSingle(runtime.trpcUrl, created.hostToken);
  const configured = await configureQaSessionIfNeeded(hostTrpc, created.code, {
    qaTitle: 'Epic 405 Release',
    observePreview: (preview) => apiMetrics.observePayload(preview),
    observeConfigured: (result) => apiMetrics.observePayload(result),
  });
  return {
    code: created.code,
    sessionId: created.sessionId,
    hostToken: created.hostToken,
    hostTrpc,
  };
}

async function seedParticipants(context) {
  const { config, publicTrpc, apiMetrics, session } = context;
  const indexes = Array.from({ length: config.seed.participants }, (_, index) => index);
  const participants = await mapLimit(indexes, config.concurrency.joins, async (index) => {
    const anonymousClientId = randomUUID();
    const nickname = `E405-${String(index + 1).padStart(4, '0')}`;
    const joined = await apiMetrics.measure('JOIN_REJOIN', () =>
      publicTrpc.session.join.mutate({
        code: session.code,
        nickname,
        anonymousClientId,
        joinIdempotencyKey: randomUUID(),
      }),
    );
    if (!joined.rejoinToken) {
      throw new Error(`Join ${index + 1} lieferte kein rejoinToken.`);
    }
    return {
      participantId: joined.participantId,
      nickname: joined.participantNickname,
      anonymousClientId,
      rejoinToken: joined.rejoinToken,
    };
  });

  let rejoinIdentityMismatches = 0;
  const rejoined = await mapLimit(
    participants.slice(0, config.seed.rejoinSamples),
    config.concurrency.joins,
    async (participant) => {
      const result = await apiMetrics.measure('JOIN_REJOIN', () =>
        publicTrpc.session.join.mutate({
          code: session.code,
          nickname: participant.nickname,
          anonymousClientId: participant.anonymousClientId,
          rejoinToken: participant.rejoinToken,
          joinIdempotencyKey: randomUUID(),
        }),
      );
      if (result.participantId !== participant.participantId) {
        rejoinIdentityMismatches += 1;
      }
      participant.rejoinToken = result.rejoinToken;
      return result;
    },
  );

  return {
    participants,
    joinedParticipants: participants.length,
    rejoinedParticipants: rejoined.length,
    rejoinIdentityMismatches,
  };
}

async function verifyParticipantPages(context, participants) {
  const { config, apiMetrics, session } = context;
  const summary = await apiMetrics.measure('PARTICIPANT_QUERY', () =>
    session.hostTrpc.session.getParticipantSummary.query({ code: session.code }),
  );
  const ids = new Set();
  let cursor;
  let revision = null;
  let pageCount = 0;
  do {
    const page = await apiMetrics.measure('PARTICIPANT_QUERY', () =>
      session.hostTrpc.session.searchParticipants.query({
        code: session.code,
        pageSize: config.sampling.participantPageSize,
        ...(cursor ? { cursor } : {}),
      }),
    );
    if (revision !== null && page.revision !== revision) {
      throw new Error('Teilnehmer-Pagination wechselte ohne parallelen Join die Revision.');
    }
    revision = page.revision;
    for (const participant of page.participants) ids.add(participant.id);
    cursor = page.nextCursor ?? undefined;
    pageCount += 1;
    if (pageCount > Math.ceil(config.seed.participants / config.sampling.participantPageSize) + 1) {
      throw new Error('Teilnehmer-Pagination überschritt die erwartete Seitenzahl.');
    }
  } while (cursor);

  const search = await apiMetrics.measure('PARTICIPANT_QUERY', () =>
    session.hostTrpc.session.searchParticipants.query({
      code: session.code,
      search: participants[Math.floor(participants.length / 2)].nickname,
      pageSize: config.sampling.participantPageSize,
    }),
  );
  if (search.participants.length < 1) {
    throw new Error('Teilnehmersuche fand die bekannte Seed-Identität nicht.');
  }
  return {
    participantSummaryCount: summary.participantCount,
    pagedParticipants: ids.size,
    participantPages: pageCount,
  };
}

function startParticipantJoinMonitor(context) {
  const socket = createHostWsTrpc(
    context.runtime.wsUrl,
    context.session.hostToken,
    context.session.code,
  );
  let resolveInitial;
  let rejectInitial;
  const state = {
    ...socket,
    subscription: null,
    latestParticipantCount: null,
    maxRecentArrivals: 0,
    messages: 0,
    errors: 0,
    initial: new Promise((resolvePromise, rejectPromise) => {
      resolveInitial = resolvePromise;
      rejectInitial = rejectPromise;
    }),
  };
  state.subscription = socket.trpc.session.onParticipantJoined.subscribe(
    { code: context.session.code },
    {
      onData(payload) {
        context.wsPayloadMetrics.observe(payload);
        state.messages += 1;
        state.latestParticipantCount = payload?.participantCount ?? null;
        state.maxRecentArrivals = Math.max(
          state.maxRecentArrivals,
          Array.isArray(payload?.recentArrivals) ? payload.recentArrivals.length : 0,
        );
        resolveInitial(payload);
      },
      onError(error) {
        state.errors += 1;
        rejectInitial(error instanceof Error ? error : new Error(String(error)));
      },
    },
  );
  state.close = () => {
    state.subscription?.unsubscribe();
    state.wsClient.close();
  };
  return state;
}

async function seedQuestions(context, participants) {
  const { config, apiMetrics, session } = context;
  const firstQuestionIds = new Array(participants.length);
  let acceptedQuestions = 0;
  let unexpectedReplays = 0;
  let finalSessionQuestionCount = 0;
  let participantsAtQuota = 0;
  let replayCase = null;

  await mapLimit(
    participants,
    config.concurrency.submits,
    async (participant, participantIndex) => {
      const trpc = participantHttp(context.runtime, participant);
      let participantMaxCount = 0;
      for (
        let questionIndex = 0;
        questionIndex < config.seed.questionsPerParticipant;
        questionIndex += 1
      ) {
        const idempotencyKey = randomUUID();
        const input = {
          sessionId: session.sessionId,
          participantId: participant.participantId,
          text: buildQaAssemblyQuestion(participantIndex, questionIndex),
          idempotencyKey,
        };
        const result = await apiMetrics.measure('QA_SUBMIT', () => trpc.qa.submit.mutate(input));
        if (result.replayed) unexpectedReplays += 1;
        acceptedQuestions += 1;
        participantMaxCount = Math.max(participantMaxCount, result.quota.participantQuestionCount);
        finalSessionQuestionCount = Math.max(
          finalSessionQuestionCount,
          result.quota.sessionQuestionCount,
        );
        if (questionIndex === 0) firstQuestionIds[participantIndex] = result.question.id;
        if (participantIndex === 0 && questionIndex === 0) {
          replayCase = { trpc, input, questionId: result.question.id };
        }
      }
      if (participantMaxCount === config.seed.questionsPerParticipant) participantsAtQuota += 1;
    },
  );

  if (acceptedQuestions !== config.seed.totalQuestions) {
    throw new Error(`Nur ${acceptedQuestions}/${config.seed.totalQuestions} Fragen akzeptiert.`);
  }
  if (participantsAtQuota !== config.seed.participants) {
    throw new Error(
      `Nur ${participantsAtQuota}/${config.seed.participants} Teilnahmen erreichten ihr Kontingent.`,
    );
  }
  const replay = await apiMetrics.measure('QA_SUBMIT', () =>
    replayCase.trpc.qa.submit.mutate(replayCase.input),
  );
  const idempotencyReplayVerified =
    replay.replayed === true &&
    replay.question.id === replayCase.questionId &&
    replay.quota.sessionQuestionCount === config.seed.totalQuestions;
  if (!idempotencyReplayVerified) {
    throw new Error('qa.submit replayte den bekannten Idempotency-Key nicht stabil.');
  }

  let limitRejections = 0;
  const limitTrpc = participantHttp(context.runtime, participants[0]);
  try {
    await apiMetrics.measure(
      'QA_SUBMIT',
      () =>
        limitTrpc.qa.submit.mutate({
          sessionId: session.sessionId,
          participantId: participants[0].participantId,
          text: 'Epic405 erwartete zusätzliche Limit-Frage',
          idempotencyKey: randomUUID(),
        }),
      {
        expectedRejection: isExpectedLimitRejection,
        expectedRejectionKind: 'LIMIT',
      },
    );
    throw new Error('Der zusätzliche Limit-Submit wurde unerwartet akzeptiert.');
  } catch (error) {
    if (!isExpectedLimitRejection(error)) throw error;
    limitRejections += 1;
  }

  return {
    acceptedQuestions,
    unexpectedReplays,
    finalSessionQuestionCount,
    participantsAtQuota,
    idempotencyReplayVerified,
    limitRejections,
    firstQuestionIds,
  };
}

async function readAllQaPages(context, sort) {
  const { config, apiMetrics, session } = context;
  const ids = new Set();
  let cursor;
  let revision = null;
  let totalCount = null;
  let sessionQuestionCount = null;
  let pages = 0;
  do {
    const page = await apiMetrics.measure('QA_PAGE', () =>
      session.hostTrpc.qa.list.query({
        sessionId: session.sessionId,
        moderatorView: true,
        sort,
        pageSize: config.sampling.qaPageSize,
        ...(cursor ? { cursor } : {}),
      }),
    );
    if (revision !== null && page.rankingRevision !== revision) {
      throw new Error(`Q&A-Pagination ${sort} wechselte die Ranking-Revision.`);
    }
    revision = page.rankingRevision ?? revision;
    totalCount = page.totalCount ?? totalCount;
    if (sessionQuestionCount !== null && page.sessionQuestionCount !== sessionQuestionCount) {
      throw new Error(`Q&A-Pagination ${sort} wechselte den physischen Bestand.`);
    }
    sessionQuestionCount = page.sessionQuestionCount ?? sessionQuestionCount;
    for (const question of page.questions) ids.add(question.id);
    cursor = page.nextCursor ?? undefined;
    pages += 1;
    if (pages > Math.ceil(config.seed.totalQuestions / config.sampling.qaPageSize) + 1) {
      throw new Error(`Q&A-Pagination ${sort} überschritt die erwartete Seitenzahl.`);
    }
  } while (cursor);
  return {
    sort,
    uniqueQuestions: ids.size,
    totalCount,
    sessionQuestionCount,
    pages,
    revision,
  };
}

async function verifyQaPages(context, participants) {
  const pagination = [];
  for (const sort of context.config.sampling.sortModes) {
    const result = await readAllQaPages(context, sort);
    if (
      result.uniqueQuestions !== context.config.seed.totalQuestions ||
      result.totalCount !== context.config.seed.totalQuestions ||
      result.sessionQuestionCount !== context.config.seed.totalQuestions
    ) {
      throw new Error(
        `${sort} bestätigte Seite/Gesamt/physisch ${result.uniqueQuestions}/${result.totalCount}/${result.sessionQuestionCount} statt 25.000 Fragen.`,
      );
    }
    pagination.push({
      sort,
      uniqueQuestions: result.uniqueQuestions,
      totalCount: result.totalCount,
      sessionQuestionCount: result.sessionQuestionCount,
      pages: result.pages,
    });
  }

  const participantList = await context.apiMetrics.measure('QA_PAGE', () =>
    participantHttp(context.runtime, participants[0]).qa.list.query({
      sessionId: context.session.sessionId,
      participantId: participants[0].participantId,
      pageSize: context.config.sampling.qaPageSize,
    }),
  );
  if (participantList.questions.length > context.config.budgets.pageMaxItems) {
    throw new Error('Teilnehmer-Q&A-Seite überschreitet 100 Einträge.');
  }
  const search = await context.apiMetrics.measure('QA_PAGE', () =>
    context.session.hostTrpc.qa.list.query({
      sessionId: context.session.sessionId,
      moderatorView: true,
      sort: 'TOP',
      search: QA_ASSEMBLY_FEATURED_QUESTIONS[0].text,
      pageSize: context.config.sampling.qaPageSize,
    }),
  );
  if (
    !search.questions.some((question) => question.text === QA_ASSEMBLY_FEATURED_QUESTIONS[0].text)
  ) {
    throw new Error('Q&A-Suche fand die bekannte Seed-Frage nicht.');
  }
  return pagination;
}

async function exerciseRatings(context, participants, firstQuestionIds) {
  const votePlan = buildQaAssemblyVotePlan(participants.length);
  if (votePlan.length !== context.config.sampling.ratings) {
    throw new Error(
      `Das realistische Voteprofil enthält ${votePlan.length} statt ${context.config.sampling.ratings} Ratings.`,
    );
  }
  await mapLimit(votePlan, context.config.concurrency.queries, async (vote) => {
    const participant = participants[vote.voterIndex];
    await context.apiMetrics.measure('QA_RATING', () =>
      participantHttp(context.runtime, participant).qa.vote.mutate({
        questionId: firstQuestionIds[vote.featureIndex],
        participantId: participant.participantId,
        direction: vote.direction,
      }),
    );
  });
  return {
    ratings: votePlan.length,
    successfulRatings: context.apiMetrics.report().byClass.QA_RATING.successes,
    technicalRatingErrors: context.apiMetrics.report().byClass.QA_RATING.technicalErrors,
    featuredQuestions: QA_ASSEMBLY_FEATURED_QUESTIONS.length,
  };
}

async function verifyRealisticRankings(context, firstQuestionIds) {
  const results = {};
  for (const sort of ['TOP', 'BEST', 'CONTROVERSIAL']) {
    const page = await context.apiMetrics.measure('QA_PAGE', () =>
      context.session.hostTrpc.qa.list.query({
        sessionId: context.session.sessionId,
        moderatorView: true,
        sort,
        statuses: ['ACTIVE'],
        pageSize: 20,
      }),
    );
    const expectedIndex = QA_ASSEMBLY_EXPECTED_RANKING[sort];
    const expectedId = firstQuestionIds[expectedIndex];
    const winner = page.questions[0];
    if (winner?.id !== expectedId) {
      throw new Error(
        `${sort} führt mit „${winner?.text ?? 'leer'}“ statt der erwarteten realistischen Spitzenfrage.`,
      );
    }
    for (const [featureIndex, profile] of QA_ASSEMBLY_FEATURED_QUESTIONS.entries()) {
      const question = page.questions.find((entry) => entry.id === firstQuestionIds[featureIndex]);
      if (!question) {
        throw new Error(`${sort} enthält die hervorgehobene Frage ${featureIndex + 1} nicht.`);
      }
      if (
        question.positiveVoteCount !== profile.positiveVotes ||
        question.negativeVoteCount !== profile.negativeVotes
      ) {
        throw new Error(
          `${sort} meldet für Frage ${featureIndex + 1} ${question.positiveVoteCount}/${question.negativeVoteCount} statt ${profile.positiveVotes}/${profile.negativeVotes} positiven/negativen Votes.`,
        );
      }
    }
    results[sort] = {
      questionId: winner.id,
      text: winner.text,
      positiveVoteCount: winner.positiveVoteCount,
      negativeVoteCount: winner.negativeVoteCount,
      bestScore: winner.bestScore,
      controversyScore: winner.controversyScore,
    };
  }
  return results;
}

async function exerciseModeration(context, firstQuestionIds) {
  const indexes = Array.from({ length: context.config.sampling.moderations }, (_, index) => index);
  await mapLimit(indexes, context.config.concurrency.queries, async (index) => {
    await context.apiMetrics.measure('QA_MODERATION', () =>
      context.session.hostTrpc.qa.moderate.mutate({
        sessionCode: context.session.code,
        questionId: firstQuestionIds[1_000 + index],
        action: 'PIN',
      }),
    );
  });
  return indexes.length;
}

async function exerciseHealthStats(context) {
  const indexes = Array.from({ length: context.config.sampling.healthStats }, (_, index) => index);
  await mapLimit(indexes, context.config.concurrency.queries, () =>
    context.apiMetrics.measure('HEALTH_STATS', () => context.publicTrpc.health.stats.query()),
  );
  return indexes.length;
}

async function analyzeQaCorpus(context, { refresh = false } = {}) {
  const startedAt = performance.now();
  try {
    const result = await context.session.hostTrpc.wordCloud.analyzeQa.mutate({
      sessionCode: context.session.code,
      mode: 'THEME',
      locale: 'de',
      metric: 'BEST',
      filter: 'ALL_ELIGIBLE',
      normalization: 'NONE',
      maxEntries: 40,
      refresh,
    });
    context.apiMetrics.observePayload(result);
    return {
      outcome: 'SUCCESS',
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      eligibleQuestionCount: result.eligibleQuestionCount,
      analyzedQuestionCount: result.analyzedQuestionCount,
      corpusRevision: result.corpusRevision,
      sortMode: result.sortMode,
      filter: result.filter,
    };
  } catch (error) {
    return {
      outcome: errorCode(error) === 'CONFLICT' ? 'EXPECTED_CONFLICT' : 'TECHNICAL_ERROR',
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      errorCode: errorCode(error),
      errorMessage: errorText(error),
    };
  }
}

async function verifyClosedChannelRejection(context, participant) {
  const channels = await context.session.hostTrpc.session.closeQaChannel.mutate({
    code: context.session.code,
  });
  context.apiMetrics.observePayload(channels);
  try {
    await context.apiMetrics.measure(
      'QA_SUBMIT',
      () =>
        participantHttp(context.runtime, participant).qa.submit.mutate({
          sessionId: context.session.sessionId,
          participantId: participant.participantId,
          text: 'Epic405 erwartete Frist-/Kanalablehnung',
          idempotencyKey: randomUUID(),
        }),
      {
        expectedRejection: isExpectedDeadlineRejection,
        expectedRejectionKind: 'DEADLINE',
      },
    );
    throw new Error('Der Submit nach Q&A-Schließung wurde unerwartet akzeptiert.');
  } catch (error) {
    if (!isExpectedDeadlineRejection(error)) throw error;
  }
  return 1;
}

function revisionNumber(value) {
  const parsed = Number.parseInt(String(value ?? '').split(':', 1)[0], 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function createQaWsState(context, participant) {
  const socket = createPublicWsTrpc(context.runtime.wsUrl, {
    sessionCode: context.session.code,
    participantId: participant.participantId,
    participantCapability: participant.rejoinToken,
  });
  const http = participantHttp(context.runtime, participant);
  let resolveInitial;
  let rejectInitial;
  let applyGeneration = 0;
  const state = {
    ...socket,
    subscription: null,
    started: false,
    errors: 0,
    messages: 0,
    latestRevision: null,
    latestAppliedAt: null,
    initialAppliedAt: null,
    initial: new Promise((resolvePromise, rejectPromise) => {
      resolveInitial = resolvePromise;
      rejectInitial = rejectPromise;
    }),
  };
  const applyInvalidation = async (payload) => {
    const invalidatedRevision = revisionNumber(payload?.rankingRevision);
    if (invalidatedRevision === null) {
      throw new Error('WS-Invalidierung enthält keine auswertbare Ranking-Revision.');
    }
    const generation = ++applyGeneration;
    const snapshot = await context.apiMetrics.measure('QA_PAGE', () =>
      http.qa.list.query({
        sessionId: context.session.sessionId,
        participantId: participant.participantId,
        pageSize: context.config.websocket.subscriptionPageSize,
      }),
    );
    if (generation !== applyGeneration) return;
    const appliedRevision = revisionNumber(snapshot?.rankingRevision);
    if (appliedRevision === null || appliedRevision < invalidatedRevision) {
      throw new Error(
        `Q&A-Resync blieb hinter der Invalidierung zurück (${String(
          appliedRevision,
        )} < ${invalidatedRevision}).`,
      );
    }
    state.latestRevision = appliedRevision;
    state.latestAppliedAt = performance.now();
    if (state.initialAppliedAt === null) {
      state.initialAppliedAt = state.latestAppliedAt;
      resolveInitial(snapshot);
    }
  };
  state.subscription = socket.trpc.qa.onQuestionsUpdated.subscribe(
    {
      sessionId: context.session.sessionId,
      participantId: participant.participantId,
      pageSize: context.config.websocket.subscriptionPageSize,
    },
    {
      onStarted() {
        state.started = true;
      },
      onData(payload) {
        context.wsPayloadMetrics.observe(payload);
        state.messages += 1;
        void applyInvalidation(payload).catch((error) => {
          state.errors += 1;
          rejectInitial(error instanceof Error ? error : new Error(String(error)));
        });
      },
      onError(error) {
        state.errors += 1;
        rejectInitial(error instanceof Error ? error : new Error(String(error)));
      },
    },
  );
  state.close = () => {
    state.subscription?.unsubscribe();
    state.wsClient.close();
  };
  return state;
}

async function connectQaWsWave(context, participants, label) {
  const states = participants.map((participant) => createQaWsState(context, participant));
  const settled = await Promise.allSettled(
    states.map((state, index) =>
      withTimeout(
        state.initial,
        context.config.budgets.reconnectMaxMs,
        `${label} Client ${index + 1}`,
      ),
    ),
  );
  return {
    states,
    applied: settled.filter((result) => result.status === 'fulfilled').length,
    failures: settled.filter((result) => result.status === 'rejected').length,
  };
}

function closeQaWsWave(states) {
  for (const state of states) state.close();
}

async function heartbeatQaParticipants(context, participants) {
  await mapLimit(participants, context.config.concurrency.queries, (participant) =>
    context.apiMetrics.measure('PARTICIPANT_QUERY', () =>
      participantHttp(context.runtime, participant).session.heartbeatParticipantPresence.mutate({
        code: context.session.code,
        participantId: participant.participantId,
      }),
    ),
  );
}

async function diagnosticSnapshot(context) {
  const snapshots = await Promise.all(
    context.diagnosticTrpc.map((trpc) => trpc.health.securityStats.query()),
  );
  for (const snapshot of snapshots) context.apiMetrics.observePayload(snapshot);
  return {
    boundConnections: snapshots.reduce(
      (sum, snapshot) => sum + snapshot.trpcWebSocketBoundConnectionsActive,
      0,
    ),
    qaApi: snapshots.map((snapshot) => snapshot.qaApi),
  };
}

async function waitForBoundConnections(context, expected, timeoutMs) {
  let latest = null;
  const reached = await waitUntil(
    async () => {
      latest = await diagnosticSnapshot(context);
      return latest.boundConnections === expected;
    },
    timeoutMs,
    100,
  );
  return { reached, snapshot: latest };
}

async function currentQaRevision(context) {
  const page = await context.apiMetrics.measure('QA_PAGE', () =>
    context.session.hostTrpc.qa.list.query({
      sessionId: context.session.sessionId,
      moderatorView: true,
      sort: 'TOP',
      pageSize: 1,
    }),
  );
  const revision = revisionNumber(page.rankingRevision);
  if (revision === null) throw new Error('qa.list lieferte keine bekannte Ranking-Revision.');
  return revision;
}

async function publishKnownRevision(context, participant, targetQuestionId) {
  const before = await currentQaRevision(context);
  await context.apiMetrics.measure('QA_RATING', () =>
    participantHttp(context.runtime, participant).qa.vote.mutate({
      questionId: targetQuestionId,
      participantId: participant.participantId,
      direction: 'UP',
    }),
  );
  const committedAt = performance.now();
  let target = null;
  const known = await waitUntil(
    async () => {
      const current = await currentQaRevision(context);
      if (current > before) target = current;
      return target !== null;
    },
    context.config.budgets.reconnectMaxMs,
    25,
  );
  if (!known) throw new Error('Die gezielt publizierte Serverrevision wurde nicht lesbar.');
  return { targetRevision: target, committedAt };
}

async function waitForAppliedRevision(states, targetRevision, notBefore, timeoutMs, origin) {
  await waitUntil(
    () =>
      states.every(
        (state) =>
          state.latestRevision !== null &&
          state.latestRevision >= targetRevision &&
          state.latestAppliedAt !== null &&
          state.latestAppliedAt >= notBefore,
      ),
    timeoutMs,
    20,
  );
  const latencies = states
    .filter(
      (state) =>
        state.latestRevision !== null &&
        state.latestRevision >= targetRevision &&
        state.latestAppliedAt !== null &&
        state.latestAppliedAt >= notBefore,
    )
    .map((state) => state.latestAppliedAt - origin);
  return {
    applied: latencies.length,
    samples: latencies.length,
    p95Ms: percentile(latencies, 0.95),
    maxMs: latencies.length > 0 ? Math.round(Math.max(...latencies) * 100) / 100 : null,
  };
}

async function runWebSocketGates(context, participants, firstQuestionIds) {
  const activeParticipants = participants.slice(0, context.config.concurrency.websockets);
  const initial = await connectQaWsWave(context, activeParticipants, 'Initiale WS-Anwendung');
  if (initial.applied !== context.config.websocket.activeClients) {
    closeQaWsWave(initial.states);
    throw new Error(`Initiale WS-Anwendung nur ${initial.applied}/500.`);
  }
  await heartbeatQaParticipants(context, activeParticipants);
  const initialBound = await waitForBoundConnections(
    context,
    context.config.websocket.activeClients,
    context.config.budgets.reconnectMaxMs,
  );
  if (!initialBound.reached) {
    closeQaWsWave(initial.states);
    throw new Error(
      `Server meldet ${initialBound.snapshot?.boundConnections ?? 'unbekannt'} statt 500 gebundene WS-Clients.`,
    );
  }

  const fanoutPublished = await publishKnownRevision(
    context,
    participants[600],
    firstQuestionIds[601],
  );
  const fanout = await waitForAppliedRevision(
    initial.states,
    fanoutPublished.targetRevision,
    fanoutPublished.committedAt,
    context.config.budgets.reconnectMaxMs,
    fanoutPublished.committedAt,
  );

  closeQaWsWave(initial.states);
  const disconnected = await waitForBoundConnections(
    context,
    0,
    context.config.budgets.reconnectMaxMs,
  );
  if (!disconnected.reached) {
    throw new Error(
      `Vor der Reconnect-Welle blieben ${disconnected.snapshot?.boundConnections ?? 'unbekannt'} WS-Bindungen aktiv.`,
    );
  }

  const waveReleasedAt = performance.now();
  const reconnect = await connectQaWsWave(context, activeParticipants, 'Reconnect-Resubscribe');
  const allResubscribedAt = Math.max(
    0,
    ...reconnect.states
      .map((state) => state.initialAppliedAt)
      .filter((value) => typeof value === 'number'),
  );
  const reconnectPublished = await publishKnownRevision(
    context,
    participants[700],
    firstQuestionIds[701],
  );
  const reconnectApplied = await waitForAppliedRevision(
    reconnect.states,
    reconnectPublished.targetRevision,
    reconnectPublished.committedAt,
    context.config.budgets.reconnectMaxMs,
    waveReleasedAt,
  );
  const reconnectBound = await waitForBoundConnections(
    context,
    context.config.websocket.activeClients,
    context.config.budgets.reconnectMaxMs,
  );
  const subscriptionErrors =
    initial.states.reduce((sum, state) => sum + state.errors, 0) +
    reconnect.states.reduce((sum, state) => sum + state.errors, 0);

  return {
    states: reconnect.states,
    metrics: {
      initialApplied: initial.applied,
      activeClientsInitial: initial.states.length,
      boundConnectionsInitial: initialBound.snapshot.boundConnections,
      activeClientsAfterReconnect: reconnect.states.length,
      boundConnectionsAfterReconnect: reconnectBound.snapshot?.boundConnections ?? null,
      subscriptionErrors,
      fanout: {
        targetRevisionKnown: Number.isSafeInteger(fanoutPublished.targetRevision),
        ...fanout,
      },
      reconnect: {
        targetRevisionKnown: Number.isSafeInteger(reconnectPublished.targetRevision),
        publishedAfterResubscribe:
          reconnect.applied === context.config.websocket.activeClients &&
          reconnectPublished.committedAt >= allResubscribedAt,
        ...reconnectApplied,
      },
    },
  };
}

async function importWithFallback(packageName, fallbackUrl) {
  try {
    return await import(packageName);
  } catch {
    return import(fallbackUrl);
  }
}

async function createSoakProbeClients(runtime) {
  const pgModule = await importWithFallback(
    'pg',
    new URL('../../apps/backend/node_modules/pg/lib/index.js', import.meta.url).href,
  );
  const Client = pgModule.Client ?? pgModule.default?.Client;
  const database = new Client({
    connectionString: runtime.databaseUrl,
    connectionTimeoutMillis: 5_000,
    query_timeout: 5_000,
  });
  await database.connect();

  const redisModule = await importWithFallback(
    'ioredis',
    new URL('../../apps/backend/node_modules/ioredis/built/index.js', import.meta.url).href,
  );
  const Redis = redisModule.default;
  const redis = new Redis(runtime.redisUrl, {
    connectTimeout: 5_000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  redis.on('error', () => {});
  await redis.connect();
  return {
    database,
    redis,
    async close() {
      await Promise.allSettled([database.end(), redis.quit()]);
    },
  };
}

async function backendProbe(runtime, url) {
  const response = await fetch(url, {
    headers: runtime.backendProbeToken
      ? { Authorization: `Bearer ${runtime.backendProbeToken}` }
      : undefined,
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Backend-Probe HTTP ${response.status}.`);
  const payload = await response.json();
  if (
    typeof payload?.instanceId !== 'string' ||
    payload.instanceId.trim() === '' ||
    !Number.isFinite(payload.rssBytes) ||
    payload.rssBytes < 0 ||
    !Number.isFinite(payload.eventLoopP99Ms) ||
    payload.eventLoopP99Ms < 0
  ) {
    throw new Error('Backend-Probe muss instanceId, rssBytes und eventLoopP99Ms liefern.');
  }
  return {
    instanceId: payload.instanceId,
    rssBytes: payload.rssBytes,
    eventLoopP99Ms: payload.eventLoopP99Ms,
  };
}

async function timedProbe(operation) {
  const startedAt = performance.now();
  try {
    await operation();
    return { ok: true, durationMs: performance.now() - startedAt };
  } catch (error) {
    return { ok: false, durationMs: null, error: errorText(error) };
  }
}

async function collectProbeRound(context, clients, target, phase) {
  const at = new Date().toISOString();
  const backend = await Promise.allSettled(
    context.runtime.backendProbeUrls.map((url) => backendProbe(context.runtime, url)),
  );
  for (const result of backend) {
    if (result.status === 'fulfilled') {
      target.backend.push({ at, phase, ok: true, ...result.value });
    } else {
      target.backend.push({ at, phase, ok: false, error: errorText(result.reason) });
    }
  }
  const database = await timedProbe(() => clients.database.query('SELECT 1'));
  target.database.push({ at, phase, ...database });
  const redis = await timedProbe(async () => {
    const pong = await clients.redis.ping();
    if (pong !== 'PONG') throw new Error(`Redis antwortete ${pong}.`);
  });
  target.redis.push({ at, phase, ...redis });
}

function summarizeTimedProbes(samples) {
  const durations = samples.filter((sample) => sample.ok).map((sample) => sample.durationMs);
  return {
    samples: samples.length,
    successes: durations.length,
    errors: samples.length - durations.length,
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
  };
}

function summarizeBackendProbes(samples) {
  const baseline = samples.filter((sample) => sample.ok && sample.phase === 'BASELINE');
  const baselineByInstance = new Map(
    baseline.map((sample) => [sample.instanceId, sample.rssBytes]),
  );
  const successful = samples.filter((sample) => sample.ok);
  let maxRssGrowthBytes = null;
  for (const sample of successful) {
    const start = baselineByInstance.get(sample.instanceId);
    if (start === undefined) continue;
    maxRssGrowthBytes = Math.max(maxRssGrowthBytes ?? 0, sample.rssBytes - start);
  }
  const duplicateBaselines = baseline.length - baselineByInstance.size;
  return {
    instances: baselineByInstance.size,
    samples: samples.length,
    successfulSamples: successful.length,
    errors: samples.length - successful.length + Math.max(0, duplicateBaselines),
    maxRssGrowthBytes,
    maxEventLoopP99Ms:
      successful.length > 0 ? Math.max(...successful.map((sample) => sample.eventLoopP99Ms)) : null,
  };
}

async function runSoakWorkloadCycle(context, participants, firstQuestionIds, cycle) {
  const participant = participants[cycle % participants.length];
  const activeParticipants = participants.slice(0, context.config.websocket.activeClients);
  const heartbeatBatch = Array.from(
    { length: Math.min(5, activeParticipants.length) },
    (_, offset) => activeParticipants[(cycle * 5 + offset) % activeParticipants.length],
  );
  await Promise.all([
    context.apiMetrics.measure('PARTICIPANT_QUERY', () =>
      context.session.hostTrpc.session.getParticipantSummary.query({
        code: context.session.code,
      }),
    ),
    context.apiMetrics.measure('QA_PAGE', () =>
      context.session.hostTrpc.qa.list.query({
        sessionId: context.session.sessionId,
        moderatorView: true,
        sort: 'TOP',
        pageSize: context.config.sampling.qaPageSize,
      }),
    ),
    context.apiMetrics.measure('HEALTH_STATS', () => context.publicTrpc.health.stats.query()),
    ...heartbeatBatch.map((heartbeatParticipant) =>
      context.apiMetrics.measure('PARTICIPANT_QUERY', () =>
        participantHttp(
          context.runtime,
          heartbeatParticipant,
        ).session.heartbeatParticipantPresence.mutate({
          code: context.session.code,
          participantId: heartbeatParticipant.participantId,
        }),
      ),
    ),
  ]);
  if (cycle % 10 === 0) {
    const targetIndex = (cycle + 1) % participants.length;
    await context.apiMetrics.measure('QA_RATING', () =>
      participantHttp(context.runtime, participant).qa.vote.mutate({
        questionId: firstQuestionIds[targetIndex],
        participantId: participant.participantId,
        direction: cycle % 20 === 0 ? 'UP' : 'DOWN',
      }),
    );
  }
}

async function runSoak(context, participants, firstQuestionIds) {
  const probes = { backend: [], database: [], redis: [] };
  const clients = await createSoakProbeClients(context.runtime);
  try {
    const warmupDeadline = performance.now() + context.config.soak.warmupSeconds * 1_000;
    let cycle = 0;
    while (performance.now() < warmupDeadline) {
      const startedAt = performance.now();
      await runSoakWorkloadCycle(context, participants, firstQuestionIds, cycle);
      cycle += 1;
      await sleep(
        Math.max(0, context.config.soak.cycleIntervalMs - (performance.now() - startedAt)),
      );
    }

    await collectProbeRound(context, clients, probes, 'BASELINE');
    const baselineAt = performance.now();
    const measurementStartedAt = performance.now();
    const durationMs = context.config.soak.durationMinutes * 60_000;
    let nextProbeAt = measurementStartedAt + context.config.soak.probeIntervalMs;
    while (performance.now() - measurementStartedAt < durationMs) {
      const startedAt = performance.now();
      await runSoakWorkloadCycle(context, participants, firstQuestionIds, cycle);
      cycle += 1;
      if (performance.now() >= nextProbeAt) {
        await collectProbeRound(context, clients, probes, 'DURING');
        nextProbeAt += context.config.soak.probeIntervalMs;
      }
      await sleep(
        Math.max(0, context.config.soak.cycleIntervalMs - (performance.now() - startedAt)),
      );
    }
    await collectProbeRound(context, clients, probes, 'FINAL');
    return {
      enabled: true,
      completedDurationMinutes:
        Math.round(((performance.now() - measurementStartedAt) / 60_000) * 100) / 100,
      baselineAfterWarmup:
        baselineAt >= warmupDeadline &&
        probes.backend.some((sample) => sample.ok && sample.phase === 'BASELINE') &&
        probes.database.some((sample) => sample.ok && sample.phase === 'BASELINE') &&
        probes.redis.some((sample) => sample.ok && sample.phase === 'BASELINE'),
      backend: summarizeBackendProbes(probes.backend),
      database: summarizeTimedProbes(probes.database),
      redis: summarizeTimedProbes(probes.redis),
    };
  } finally {
    await clients.close();
  }
}

function safeFatal(error, runtime) {
  let message = errorText(error);
  for (const secret of [
    runtime?.diagnosticSecret,
    runtime?.backendProbeToken,
    runtime?.databaseUrl,
    runtime?.redisUrl,
  ]) {
    if (secret) message = message.replaceAll(secret, '[REDACTED]');
  }
  message = message.replace(/\b[A-Za-z0-9_-]{32,}\b/gu, '[REDACTED]');
  return message.slice(0, 500);
}

async function writeResult(runtime, config, metrics, assertions) {
  return writeLoadReport(
    runtime.reportFile,
    {
      scenario: 'qa-scale-epic405',
      environment: {
        profile: config.profile,
        seed: config.seed,
        websocket: config.websocket,
        concurrency: config.concurrency,
        sampling: config.sampling,
        budgets: config.budgets,
        soak: {
          enabled: runtime.mode === 'soak',
          ...config.soak,
        },
        runtime: qaScaleRuntimeForReport(runtime),
        seedMethod: 'API_ONLY',
        payloadMeasurement:
          'JSON UTF-8 application payload before compression, without protocol overhead',
      },
      metrics,
      assertions,
    },
    { junitPath: runtime.junitFile ?? undefined },
  );
}

async function executeRelease(config, runtime) {
  await waitForBackend(runtime.trpcUrl);
  const apiMetrics = new ApiMetrics(config);
  const wsPayloadMetrics = new WsPayloadMetrics(config);
  const publicTrpc = createHttpTrpcSingle(runtime.trpcUrl);
  const diagnosticTrpc = runtime.diagnosticTrpcUrls.map((url) =>
    createHttpTrpcSingle(url, undefined, undefined, runtime.diagnosticSecret),
  );
  const metrics = {
    seed: {},
    api: {},
    websocket: {},
    soak: { enabled: runtime.mode === 'soak' },
  };
  const context = {
    config,
    runtime,
    apiMetrics,
    wsPayloadMetrics,
    publicTrpc,
    diagnosticTrpc,
    session: null,
  };
  let wsStates = [];
  let joinMonitor = null;
  try {
    context.session = await createConfiguredSession(publicTrpc, runtime, apiMetrics);
    joinMonitor = startParticipantJoinMonitor(context);
    await withTimeout(
      joinMonitor.initial,
      config.budgets.reconnectMaxMs,
      'Host-Teilnahme-Snapshot',
    );
    const participantSeed = await seedParticipants(context);
    const participants = participantSeed.participants;
    const joinSnapshotComplete = await waitUntil(
      () => joinMonitor.latestParticipantCount === config.seed.participants,
      config.budgets.reconnectMaxMs,
      50,
    );
    Object.assign(metrics.seed, {
      joinedParticipants: participantSeed.joinedParticipants,
      rejoinedParticipants: participantSeed.rejoinedParticipants,
      rejoinIdentityMismatches: participantSeed.rejoinIdentityMismatches,
      joinEventParticipantCount: joinMonitor.latestParticipantCount,
      joinEventMaxListItems: joinMonitor.maxRecentArrivals,
      joinEventMessages: joinMonitor.messages,
      joinEventErrors: joinMonitor.errors,
    });
    joinMonitor.close();
    joinMonitor = null;
    if (!joinSnapshotComplete) {
      throw new Error(
        `Host-Teilnahme-Subscription erreichte nur ${metrics.seed.joinEventParticipantCount}/2500.`,
      );
    }
    Object.assign(metrics.seed, await verifyParticipantPages(context, participants));

    const qaStart = await context.session.hostTrpc.session.startQa.mutate({
      code: context.session.code,
    });
    apiMetrics.observePayload(qaStart);
    if (qaStart.status !== 'ACTIVE') {
      throw new Error(`session.startQa lieferte ${qaStart.status} statt ACTIVE.`);
    }

    const questionSeed = await seedQuestions(context, participants);
    Object.assign(metrics.seed, {
      acceptedQuestions: questionSeed.acceptedQuestions,
      unexpectedReplays: questionSeed.unexpectedReplays,
      finalSessionQuestionCount: questionSeed.finalSessionQuestionCount,
      participantsAtQuota: questionSeed.participantsAtQuota,
      idempotencyReplayVerified: questionSeed.idempotencyReplayVerified,
      limitRejections: questionSeed.limitRejections,
    });
    metrics.seed.qaPagination = await verifyQaPages(context, participants);
    metrics.seed.qaTotalCount = metrics.seed.qaPagination[0]?.totalCount ?? null;
    metrics.seed.qaPhysicalQuestionCount =
      metrics.seed.qaPagination[0]?.sessionQuestionCount ?? null;
    const [ratingProfile, moderationSamples, healthStatsSamples, wordCloudSideLoad] =
      await Promise.all([
        exerciseRatings(context, participants, questionSeed.firstQuestionIds),
        exerciseModeration(context, questionSeed.firstQuestionIds),
        exerciseHealthStats(context),
        analyzeQaCorpus(context, { refresh: true }),
      ]);
    metrics.seed.ratingSamples = ratingProfile.ratings;
    metrics.seed.realisticSession = {
      featuredQuestions: ratingProfile.featuredQuestions,
      successfulRatings: ratingProfile.successfulRatings,
      technicalRatingErrors: ratingProfile.technicalRatingErrors,
      rankings: await verifyRealisticRankings(context, questionSeed.firstQuestionIds),
    };
    metrics.seed.wordCloudCorpus = await analyzeQaCorpus(context, { refresh: true });
    if (metrics.seed.wordCloudCorpus.outcome !== 'SUCCESS') {
      throw new Error(
        'Der kanonische 25.000er Wortwolkenkorpus konnte nach dem realistischen Voting nicht analysiert werden.',
      );
    }
    metrics.seed.moderationSamples = moderationSamples;
    metrics.seed.healthStatsSamples = healthStatsSamples;
    metrics.seed.wordCloudSideLoad = wordCloudSideLoad;

    const websocket = await runWebSocketGates(context, participants, questionSeed.firstQuestionIds);
    wsStates = websocket.states;
    metrics.websocket = { ...websocket.metrics, ...wsPayloadMetrics.report() };

    if (runtime.mode === 'soak') {
      metrics.soak = await runSoak(context, participants, questionSeed.firstQuestionIds);
      const finalBound = await waitForBoundConnections(
        context,
        config.websocket.activeClients,
        config.budgets.reconnectMaxMs,
      );
      metrics.websocket.boundConnectionsAfterReconnect =
        finalBound.snapshot?.boundConnections ?? null;
      metrics.websocket.activeClientsAfterReconnect = wsStates.filter(
        (state) => state.errors === 0,
      ).length;
      metrics.websocket.subscriptionErrors = wsStates.reduce((sum, state) => sum + state.errors, 0);
    }

    metrics.seed.deadlineRejections = await verifyClosedChannelRejection(context, participants[0]);

    const diagnostics = await diagnosticSnapshot(context);
    metrics.diagnostics = {
      targets: diagnosticTrpc.length,
      boundConnections: diagnostics.boundConnections,
      qaApi: diagnostics.qaApi,
    };
    metrics.api = apiMetrics.report();
    metrics.websocket = { ...metrics.websocket, ...wsPayloadMetrics.report() };
    return metrics;
  } catch (error) {
    metrics.api = apiMetrics.report();
    metrics.websocket = { ...metrics.websocket, ...wsPayloadMetrics.report() };
    metrics.fatalError = safeFatal(error, runtime);
    return metrics;
  } finally {
    joinMonitor?.close();
    closeQaWsWave(wsStates);
  }
}

async function main() {
  const args = parseQaScaleArgs(process.argv.slice(2));
  if (args.mode === 'help') {
    console.log(usage());
    return;
  }
  const configPath = args.configPath ?? DEFAULT_CONFIG_PATH;
  const config = await loadConfig(configPath);
  const runtime = resolveQaScaleRuntime(process.env, { mode: args.mode });

  if (args.mode === 'validate') {
    console.log(
      JSON.stringify(
        {
          valid: true,
          networkAccess: false,
          configPath,
          profile: config,
          runtime: qaScaleRuntimeForReport(runtime),
        },
        null,
        2,
      ),
    );
    return;
  }

  const metrics = await executeRelease(config, runtime);
  const assertions = evaluateQaScaleGates(config, metrics);
  const passed = qaScaleGatesPassed(assertions);
  await writeResult(runtime, config, metrics, assertions);
  const failed = assertions.filter((entry) => !entry.passed);
  console.log(
    JSON.stringify(
      {
        scenario: 'qa-scale-epic405',
        passed,
        reportFile: runtime.reportFile,
        assertions: assertions.length,
        failed: failed.map((entry) => ({
          name: entry.name,
          expected: entry.expected,
          actual: entry.actual,
        })),
      },
      null,
      2,
    ),
  );
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(errorText(error));
  process.exitCode = 1;
});
