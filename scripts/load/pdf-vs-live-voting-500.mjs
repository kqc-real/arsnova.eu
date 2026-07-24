#!/usr/bin/env node
/**
 * W0.2-Abnahme: 500 gleichzeitige Votes unter dauerhaft ausgeschöpftem PDF-Cap.
 *
 * Voraussetzung: lokales Backend mit PostgreSQL und Redis.
 *
 * REPORT_FILE=output/load/pdf-vs-live-voting-500.json \
 *   npm run load:pdf-vs-voting:500
 */
import { performance } from 'node:perf_hooks';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { createArtillery500Session } from './artillery/setup-session.mjs';
import { createHttpTrpcSingle } from './lib/trpc-runtime.mjs';
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';

const TRPC_URLS = String(
  process.env.TRPC_URLS || process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc',
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const TRPC_URL = TRPC_URLS[0];
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 500));
const JOIN_CONCURRENCY = Math.max(1, Number(process.env.JOIN_CONCURRENCY || 75));
const VOTE_CONCURRENCY = Math.max(1, Number(process.env.VOTE_CONCURRENCY || 75));
const PDF_QUESTIONS = Math.max(5, Number(process.env.PDF_QUESTIONS || 20));
const PDF_VOTE_COOLDOWN_MS = Math.max(1_000, Number(process.env.PDF_VOTE_COOLDOWN_MS || 1_100));
const EXPECTED_PDF_CAP = Math.max(1, Number(process.env.EXPECTED_PDF_CAP || 1));
const VOTE_P95_LIMIT_MS = Math.max(100, Number(process.env.VOTE_P95_LIMIT_MS || 1_500));
const VOTE_P99_LIMIT_MS = Math.max(100, Number(process.env.VOTE_P99_LIMIT_MS || 3_000));
const VOTE_ERROR_RATE_LIMIT = Math.max(0, Number(process.env.VOTE_ERROR_RATE_LIMIT || 0.01));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, percentileValue) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * percentileValue) - 1);
  return Math.round(sorted[index] * 100) / 100;
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function isTooManyRequests(error) {
  return (
    error?.data?.code === 'TOO_MANY_REQUESTS' ||
    error?.shape?.data?.code === 'TOO_MANY_REQUESTS' ||
    String(error?.message ?? error).includes('TOO_MANY_REQUESTS')
  );
}

function trpcUrlForIndex(index) {
  return TRPC_URLS[index % TRPC_URLS.length];
}

function pdfQuizPayload() {
  return {
    name: `W0.2 PDF Lastbericht ${Date.now()}`,
    description: 'Reproduzierbarer Lastbericht für PDF-vs.-Voting.',
    motifImageUrl: null,
    showLeaderboard: false,
    allowCustomNicknames: true,
    defaultTimer: null,
    timerScaleByDifficulty: false,
    enableSoundEffects: false,
    enableRewardEffects: false,
    enableMotivationMessages: false,
    enableEmojiReactions: false,
    anonymousMode: false,
    teamMode: false,
    teamCount: null,
    teamAssignment: 'AUTO',
    teamNames: [],
    backgroundMusic: null,
    nicknameTheme: 'HIGH_SCHOOL',
    bonusTokenCount: 1,
    readingPhaseEnabled: false,
    preset: 'SERIOUS',
    questions: Array.from({ length: PDF_QUESTIONS }, (_, index) => ({
      text: `Lastbericht Frage ${index + 1}: Welche Antwort ist korrekt?`,
      type: 'SINGLE_CHOICE',
      timer: null,
      difficulty: 'MEDIUM',
      order: index,
      answers: [
        { text: 'Antwort A', isCorrect: true, order: 0 },
        { text: 'Antwort B', isCorrect: false, order: 1 },
        { text: 'Antwort C', isCorrect: false, order: 2 },
        { text: 'Antwort D', isCorrect: false, order: 3 },
      ],
    })),
  };
}

async function createFinishedPdfSession() {
  const publicTrpc = createHttpTrpcSingle(TRPC_URL);
  const { quizId } = await publicTrpc.quiz.upload.mutate(pdfQuizPayload());
  const created = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    anonymousMode: false,
    teamMode: false,
  });
  const hostTrpc = createHttpTrpcSingle(TRPC_URL, created.hostToken);
  const participantIds = await joinParticipants(created, 'PDF');
  let acceptedVotes = 0;

  for (let index = 0; index < PDF_QUESTIONS; index += 1) {
    const opened = await hostTrpc.session.nextQuestion.mutate({ code: created.code });
    if (opened.status === 'QUESTION_OPEN') {
      await hostTrpc.session.revealAnswers.mutate({ code: created.code });
    }
    const question = await publicTrpc.session.getCurrentQuestionForStudent.query({
      code: created.code,
    });
    if (!question?.id || !question.answers?.[0]?.id) {
      throw new Error(`PDF-Testfrage ${index + 1} konnte nicht geladen werden.`);
    }
    const votes = await submitVotes(
      {
        sessionId: created.sessionId,
        questionId: question.id,
        answerId: question.answers[0].id,
      },
      participantIds,
    );
    if (votes.failed > 0) {
      throw new Error(
        `PDF-Testfrage ${index + 1}: ${votes.failed}/${votes.attempted} Votes fehlgeschlagen.`,
      );
    }
    acceptedVotes += votes.successful;
    await hostTrpc.session.revealResults.mutate({ code: created.code });
    await sleep(PDF_VOTE_COOLDOWN_MS);
  }
  const finished = await hostTrpc.session.nextQuestion.mutate({ code: created.code });
  if (finished.status !== 'FINISHED') {
    throw new Error(`PDF-Testsession endet mit ${finished.status} statt FINISHED.`);
  }
  return {
    code: created.code,
    hostToken: created.hostToken,
    participants: participantIds.length,
    votes: acceptedVotes,
  };
}

async function joinParticipants(session, nicknamePrefix = 'LIVE') {
  const indexes = Array.from({ length: PARTICIPANTS }, (_, index) => index);
  return mapConcurrent(indexes, JOIN_CONCURRENCY, async (index) => {
    const trpc = createHttpTrpcSingle(trpcUrlForIndex(index));
    const joined = await trpc.session.join.mutate({
      code: session.code,
      nickname: `${nicknamePrefix}-${String(index + 1).padStart(4, '0')}`,
    });
    return joined.participantId;
  });
}

async function submitVotes(session, participantIds) {
  const results = await mapConcurrent(
    participantIds,
    VOTE_CONCURRENCY,
    async (participantId, index) => {
      const trpc = createHttpTrpcSingle(trpcUrlForIndex(index));
      const startedAt = performance.now();
      try {
        await trpc.vote.submit.mutate({
          sessionId: session.sessionId,
          participantId,
          questionId: session.questionId,
          answerIds: [session.answerId],
          responseTimeMs: 500,
          round: 1,
        });
        return { ok: true, durationMs: performance.now() - startedAt };
      } catch (error) {
        return {
          ok: false,
          durationMs: performance.now() - startedAt,
          error: String(error?.message ?? error),
        };
      }
    },
  );
  const successful = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);
  const durations = successful.map((result) => result.durationMs);
  return {
    attempted: results.length,
    successful: successful.length,
    failed: failed.length,
    errorRate: results.length > 0 ? failed.length / results.length : 1,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    maxMs: percentile(durations, 1),
    errors: failed.slice(0, 10).map((result) => result.error),
  };
}

async function main() {
  await waitForBackend(TRPC_URL);
  const pdfSession = await createFinishedPdfSession();

  const baselineSession = await createArtillery500Session(TRPC_URL);
  const baselineParticipantIds = await joinParticipants(baselineSession, 'BASE');
  const baselineVotes = await submitVotes(baselineSession, baselineParticipantIds);

  const liveSession = await createArtillery500Session(TRPC_URL);
  const participantIds = await joinParticipants(liveSession, 'LOAD');

  let stopPdfWorkers = false;
  const pdfMetrics = { completed: 0, failed: 0, rejected: 0 };
  const createPdfWorker = () => {
    const trpc = createHttpTrpcSingle(TRPC_URL, pdfSession.hostToken);
    return async () => {
      while (!stopPdfWorkers) {
        try {
          await trpc.session.getSessionExportPdf.query({
            code: pdfSession.code,
            localeId: 'de',
            profile: 'visual',
          });
          pdfMetrics.completed += 1;
        } catch (error) {
          if (isTooManyRequests(error)) {
            pdfMetrics.rejected += 1;
          } else {
            pdfMetrics.failed += 1;
            await sleep(50);
          }
        }
      }
    };
  };
  const workers = Array.from({ length: EXPECTED_PDF_CAP }, () => createPdfWorker()());
  const probeTrpc = createHttpTrpcSingle(TRPC_URL, pdfSession.hostToken);
  let additionalRequestRejected = false;
  let metricsAtCap;
  let votesUnderPdfLoad;
  const healthTrpc = createHttpTrpcSingle(TRPC_URL);
  try {
    await sleep(100);
    for (let attempt = 0; attempt < 10 && !additionalRequestRejected; attempt += 1) {
      try {
        await probeTrpc.session.getSessionExportPdf.query({
          code: pdfSession.code,
          localeId: 'de',
          profile: 'visual',
        });
      } catch (error) {
        if (isTooManyRequests(error)) {
          additionalRequestRejected = true;
          pdfMetrics.rejected += 1;
        } else {
          throw error;
        }
      }
    }
    metricsAtCap = await healthTrpc.health.stats.query();
    votesUnderPdfLoad = await submitVotes(liveSession, participantIds);
  } finally {
    stopPdfWorkers = true;
    await Promise.all(workers);
  }
  const metricsAfterLoad = await healthTrpc.health.stats.query();

  let recoveryPdfSucceeded = false;
  try {
    await probeTrpc.session.getSessionExportPdf.query({
      code: pdfSession.code,
      localeId: 'de',
      profile: 'visual',
    });
    recoveryPdfSucceeded = true;
  } catch {
    recoveryPdfSucceeded = false;
  }

  const failures = [];
  if (pdfSession.participants !== PARTICIPANTS) {
    failures.push(`PDF-Fixture-Teilnehmende: ${pdfSession.participants}/${PARTICIPANTS}`);
  }
  if (pdfSession.votes !== PARTICIPANTS * PDF_QUESTIONS) {
    failures.push(`PDF-Fixture-Votes: ${pdfSession.votes}/${PARTICIPANTS * PDF_QUESTIONS}`);
  }
  if (baselineParticipantIds.length !== PARTICIPANTS) {
    failures.push(`Baseline-Teilnehmende: ${baselineParticipantIds.length}/${PARTICIPANTS}`);
  }
  if (participantIds.length !== PARTICIPANTS) {
    failures.push(`Teilnehmende: ${participantIds.length}/${PARTICIPANTS}`);
  }
  if (!additionalRequestRejected) {
    failures.push('Zusätzlicher paralleler PDF-Request wurde nicht mit 429 abgelehnt.');
  }
  if (
    metricsAtCap.pdfActiveJobs !== metricsAtCap.pdfMaxConcurrentJobs ||
    metricsAtCap.pdfMaxConcurrentJobs !== EXPECTED_PDF_CAP
  ) {
    failures.push(
      `PDF-Cap nicht sichtbar: aktiv=${metricsAtCap.pdfActiveJobs}, cap=${metricsAtCap.pdfMaxConcurrentJobs}`,
    );
  }
  if (metricsAtCap.pdfRejectedLastMinute < 1) {
    failures.push('health.stats zeigt keine PDF-Ablehnung.');
  }
  if (baselineVotes.errorRate >= VOTE_ERROR_RATE_LIMIT) {
    failures.push(`Baseline-Fehlerquote ${(baselineVotes.errorRate * 100).toFixed(2)} %`);
  }
  if (baselineVotes.p95Ms >= VOTE_P95_LIMIT_MS) {
    failures.push(`Baseline-p95 ${baselineVotes.p95Ms} ms`);
  }
  if (baselineVotes.p99Ms >= VOTE_P99_LIMIT_MS) {
    failures.push(`Baseline-p99 ${baselineVotes.p99Ms} ms`);
  }
  if (votesUnderPdfLoad.errorRate >= VOTE_ERROR_RATE_LIMIT) {
    failures.push(`PDF-Last-Fehlerquote ${(votesUnderPdfLoad.errorRate * 100).toFixed(2)} %`);
  }
  if (votesUnderPdfLoad.p95Ms >= VOTE_P95_LIMIT_MS) {
    failures.push(`PDF-Last-p95 ${votesUnderPdfLoad.p95Ms} ms`);
  }
  if (votesUnderPdfLoad.p99Ms >= VOTE_P99_LIMIT_MS) {
    failures.push(`PDF-Last-p99 ${votesUnderPdfLoad.p99Ms} ms`);
  }
  if (metricsAfterLoad.pdfActiveJobs !== 0) {
    failures.push(`PDF-Recovery: noch ${metricsAfterLoad.pdfActiveJobs} Jobs aktiv.`);
  }
  if (!recoveryPdfSucceeded) {
    failures.push('PDF-Recovery ohne Neustart fehlgeschlagen.');
  }

  const summary = {
    scenario: 'pdf-vs-live-voting-500',
    participants: {
      target: PARTICIPANTS,
      baselineJoined: baselineParticipantIds.length,
      joined: participantIds.length,
      sourceIp: '127.0.0.1',
      distinctParticipantIds: new Set(participantIds).size,
    },
    system: {
      targetEnvironment: process.env.TARGET_ENVIRONMENT || 'local',
      target: {
        platform: process.env.TARGET_PLATFORM || platform(),
        release: process.env.TARGET_RELEASE || release(),
        arch: process.env.TARGET_ARCH || arch(),
        logicalCpuCount: Number(process.env.TARGET_LOGICAL_CPU_COUNT || cpus().length),
        totalMemoryBytes: Number(process.env.TARGET_TOTAL_MEMORY_BYTES || totalmem()),
        nodeVersion: process.env.TARGET_NODE_VERSION || process.version,
      },
      loadGenerator: {
        platform: platform(),
        release: release(),
        arch: arch(),
        logicalCpuCount: cpus().length,
        totalMemoryBytes: totalmem(),
        nodeVersion: process.version,
      },
    },
    pdf: {
      questionsPerReport: PDF_QUESTIONS,
      fixtureParticipants: pdfSession.participants,
      fixtureVotes: pdfSession.votes,
      additionalRequestRejected,
      workerResults: pdfMetrics,
      metricsAtCap: {
        activeJobs: metricsAtCap.pdfActiveJobs,
        maxConcurrentJobs: metricsAtCap.pdfMaxConcurrentJobs,
        completedLastMinute: metricsAtCap.pdfCompletedLastMinute,
        failedLastMinute: metricsAtCap.pdfFailedLastMinute,
        rejectedLastMinute: metricsAtCap.pdfRejectedLastMinute,
      },
      metricsAfterLoad: {
        activeJobs: metricsAfterLoad.pdfActiveJobs,
        maxConcurrentJobs: metricsAfterLoad.pdfMaxConcurrentJobs,
      },
      recoveryPdfSucceeded,
    },
    votes: {
      baseline: baselineVotes,
      underPdfLoad: votesUnderPdfLoad,
      delta: {
        p50Ms: Math.round((votesUnderPdfLoad.p50Ms - baselineVotes.p50Ms) * 100) / 100,
        p95Ms: Math.round((votesUnderPdfLoad.p95Ms - baselineVotes.p95Ms) * 100) / 100,
        p99Ms: Math.round((votesUnderPdfLoad.p99Ms - baselineVotes.p99Ms) * 100) / 100,
        errorRate: votesUnderPdfLoad.errorRate - baselineVotes.errorRate,
      },
    },
    thresholds: {
      p95Ms: VOTE_P95_LIMIT_MS,
      p99Ms: VOTE_P99_LIMIT_MS,
      errorRate: VOTE_ERROR_RATE_LIMIT,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
  await writeScenarioReport({
    scenario: summary.scenario,
    environment: {
      participants: PARTICIPANTS,
      joinConcurrency: JOIN_CONCURRENCY,
      voteConcurrency: VOTE_CONCURRENCY,
      pdfQuestions: PDF_QUESTIONS,
      pdfParticipants: pdfSession.participants,
      pdfVotes: pdfSession.votes,
      expectedPdfCap: EXPECTED_PDF_CAP,
      sameSourceIp: true,
      transportChannels: TRPC_URLS.length,
      targetEnvironment: summary.system.targetEnvironment,
      targetLogicalCpuCount: summary.system.target.logicalCpuCount,
      targetTotalMemoryBytes: summary.system.target.totalMemoryBytes,
      loadGeneratorLogicalCpuCount: summary.system.loadGenerator.logicalCpuCount,
      loadGeneratorTotalMemoryBytes: summary.system.loadGenerator.totalMemoryBytes,
    },
    metrics: summary,
    failures,
  });

  if (failures.length > 0) {
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('\nOK PDF-vs.-Live-Voting-500 bestanden.');
  }
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
