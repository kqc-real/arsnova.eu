#!/usr/bin/env node
/**
 * Lasttest fuer den vollstaendigen Freitext-/Word-Cloud-Unterrichtspfad.
 *
 * Standard:
 *   node scripts/load/freetext-wordcloud-classroom.mjs
 *
 * Beispiel:
 *   PARTICIPANTS=300 ITERATIONS=5 REPORT_FILE=artifacts/wordcloud.json \
 *     node scripts/load/freetext-wordcloud-classroom.mjs
 *
 * Relevante Umgebungsvariablen:
 *   TRPC_URL                         Default: http://127.0.0.1:3000/trpc
 *   PARTICIPANTS                    30..500, Default: 100
 *   ITERATIONS                      2..10, Default: 3
 *   JOIN_CONCURRENCY                1..500, Default: 25
 *   VOTE_CONCURRENCY                1..500, Default: PARTICIPANTS
 *   VOTE_P95_LIMIT_MS               Default: 1500
 *   HOST_VISIBILITY_P95_LIMIT_MS    Default: 2000
 *   ANALYSIS_P95_LIMIT_MS           Default: 1000
 *   HOST_VISIBILITY_TIMEOUT_MS      Default: 10000
 *   HOST_POLL_INTERVAL_MS           Default: 50
 *   VOTE_COOLDOWN_MS                Default: 1100
 *   MIN_RESPONSE_COMPLETENESS_PCT   0..100, Default: 100
 *   REPORT_FILE                     Default: artifacts/freetext-wordcloud-classroom.json
 *
 * Exitcodes: 0 = bestanden, 1 = Messschwelle/Integritaet verletzt,
 * 2 = Konfiguration oder Laufzeitfehler.
 */
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { createHttpTrpcSingle } from './lib/trpc-runtime.mjs';
import { writeLoadReport } from './lib/reporting.mjs';

const EXIT_OK = 0;
const EXIT_ASSERTION_FAILED = 1;
const EXIT_RUNTIME_ERROR = 2;
const REPORT_FILE = String(
  process.env.REPORT_FILE || 'artifacts/freetext-wordcloud-classroom.json',
).trim();

const RESPONSE_TEMPLATES = [
  'Lineare Regression hilft bei Prognosen im Praxisprojekt.',
  'Die lineare Regression macht Trends im Datensatz sichtbar.',
  'Regression und Visualisierung erleichtern die Interpretation.',
  'Korrelation ist nicht automatisch Kausalitaet.',
  'Die Visualisierung erklaert Ausreisser und Unsicherheit.',
  'Kreuzvalidierung macht Prognosen belastbarer.',
  'Median und Varianz beschreiben den Datensatz.',
  'Das Praxisprojekt verbindet Regression und Visualisierung.',
  'Saubere Daten verbessern Modell und Prognose.',
  'Die Interpretation von Korrelation braucht Kontext.',
  'Lineare Regression und Kreuzvalidierung gehoeren zusammen.',
  'Ausreisser beeinflussen Regression und Trend.',
];

function readNumber(name, fallback, { integer = false, min = -Infinity, max = Infinity } = {}) {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (
    !Number.isFinite(value) ||
    (integer && !Number.isInteger(value)) ||
    value < min ||
    value > max
  ) {
    const kind = integer ? 'Ganzzahl' : 'Zahl';
    throw new Error(`${name} muss eine ${kind} zwischen ${min} und ${max} sein.`);
  }
  return value;
}

function readConfig() {
  if (!REPORT_FILE) throw new Error('REPORT_FILE darf nicht leer sein.');
  const participants = readNumber('PARTICIPANTS', 100, { integer: true, min: 30, max: 500 });
  return {
    trpcUrl: String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim(),
    participants,
    iterations: readNumber('ITERATIONS', 3, { integer: true, min: 2, max: 10 }),
    joinConcurrency: readNumber('JOIN_CONCURRENCY', 25, {
      integer: true,
      min: 1,
      max: 500,
    }),
    voteConcurrency: readNumber('VOTE_CONCURRENCY', participants, {
      integer: true,
      min: 1,
      max: 500,
    }),
    voteP95LimitMs: readNumber('VOTE_P95_LIMIT_MS', 1_500, { min: 1 }),
    hostVisibilityP95LimitMs: readNumber('HOST_VISIBILITY_P95_LIMIT_MS', 2_000, { min: 1 }),
    analysisP95LimitMs: readNumber('ANALYSIS_P95_LIMIT_MS', 1_000, { min: 1 }),
    visibilityTimeoutMs: readNumber('HOST_VISIBILITY_TIMEOUT_MS', 10_000, {
      integer: true,
      min: 100,
    }),
    pollIntervalMs: readNumber('HOST_POLL_INTERVAL_MS', 50, { integer: true, min: 10 }),
    voteCooldownMs: readNumber('VOTE_COOLDOWN_MS', 1_100, { integer: true, min: 1_000 }),
    minCompletenessPct: readNumber('MIN_RESPONSE_COMPLETENESS_PCT', 100, {
      min: 0,
      max: 100,
    }),
    reportFile: resolve(REPORT_FILE),
  };
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function reportableUrl(value) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return 'invalid-url';
  }
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return rounded(sorted[index]);
}

function summarize(values) {
  return {
    samples: values.length,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    maxMs: values.length > 0 ? rounded(Math.max(...values)) : null,
  };
}

function summarizeErrorMessages(results) {
  const counts = new Map();
  for (const result of results) {
    if (result.ok) continue;
    counts.set(result.error, (counts.get(result.error) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1]));
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function responseFor(participantIndex) {
  return RESPONSE_TEMPLATES[participantIndex % RESPONSE_TEMPLATES.length];
}

function multiset(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function sameMultiset(actual, expected) {
  const actualCounts = multiset(actual);
  const expectedCounts = multiset(expected);
  if (actualCounts.size !== expectedCounts.size) return false;
  for (const [value, count] of expectedCounts) {
    if (actualCounts.get(value) !== count) return false;
  }
  return true;
}

function buildQuizPayload(iterations) {
  return {
    name: `Freetext Word Cloud Load ${Date.now()}`,
    description: undefined,
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
    nicknameTheme: 'NOBEL_LAUREATES',
    bonusTokenCount: 1,
    readingPhaseEnabled: false,
    preset: 'SERIOUS',
    questions: Array.from({ length: iterations }, (_, index) => ({
      text: `Welche Erkenntnis nehmt ihr aus der Statistik-Einheit mit? Runde ${index + 1}`,
      type: 'FREETEXT',
      timer: null,
      difficulty: 'EASY',
      order: index,
      answers: [],
    })),
  };
}

async function createSession(publicTrpc, config) {
  const { quizId } = await publicTrpc.quiz.upload.mutate(buildQuizPayload(config.iterations));
  const { code, hostToken, sessionId } = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });
  if (!hostToken) throw new Error('session.create lieferte kein Host-Token.');
  return { quizId, code, hostToken, sessionId };
}

async function joinParticipants(publicTrpc, code, config) {
  const indexes = Array.from({ length: config.participants }, (_, index) => index);
  return mapLimit(indexes, config.joinConcurrency, async (index) => {
    const startedAt = performance.now();
    try {
      const participant = await publicTrpc.session.join.mutate({
        code,
        nickname: `Wolke ${String(index + 1).padStart(3, '0')}`,
      });
      return { ok: true, index, participant, durationMs: rounded(performance.now() - startedAt) };
    } catch (error) {
      return {
        ok: false,
        index,
        error: errorMessage(error),
        durationMs: rounded(performance.now() - startedAt),
      };
    }
  });
}

async function submitVoteWave(publicTrpc, participants, questionId, config) {
  const waveStartedAt = performance.now();
  const results = await mapLimit(participants, config.voteConcurrency, async (entry) => {
    const startedAt = performance.now();
    try {
      await publicTrpc.vote.submit.mutate({
        sessionId: entry.participant.id,
        participantId: entry.participant.participantId,
        questionId,
        freeText: responseFor(entry.index),
        round: 1,
        responseTimeMs: 500 + (entry.index % 250),
      });
      return { ok: true, index: entry.index, durationMs: rounded(performance.now() - startedAt) };
    } catch (error) {
      return {
        ok: false,
        index: entry.index,
        durationMs: rounded(performance.now() - startedAt),
        error: errorMessage(error),
      };
    }
  });
  return {
    results,
    durationMs: rounded(performance.now() - waveStartedAt),
    finishedAt: performance.now(),
  };
}

async function waitForHostVisibility(hostTrpc, code, expectedCount, voteFinishedAt, config) {
  const deadline = performance.now() + config.visibilityTimeoutMs;
  let polls = 0;
  let pollingErrors = 0;
  let lastError = null;
  let snapshot = null;

  while (performance.now() <= deadline) {
    polls += 1;
    try {
      snapshot = await hostTrpc.session.getLiveFreetext.query({ code });
      if (snapshot.responses.length >= expectedCount) {
        return {
          complete: snapshot.responses.length === expectedCount,
          latencyMs: rounded(Math.max(0, performance.now() - voteFinishedAt)),
          polls,
          pollingErrors,
          lastError,
          snapshot,
        };
      }
    } catch (error) {
      pollingErrors += 1;
      lastError = errorMessage(error);
    }
    await sleep(config.pollIntervalMs);
  }

  return {
    complete: false,
    latencyMs: rounded(Math.max(0, performance.now() - voteFinishedAt)),
    polls,
    pollingErrors,
    lastError,
    snapshot,
  };
}

async function analyzeModes(hostTrpc, code, responses, iteration) {
  const items = responses.map((text, index) => ({
    id: `iteration-${iteration}-response-${index}`,
    text,
    weight: 1,
  }));
  const modes = ['LEXICAL', 'THEME'];
  return Promise.all(
    modes.map(async (mode) => {
      const startedAt = performance.now();
      try {
        const result = await hostTrpc.wordCloud.analyze.mutate({
          sessionCode: code,
          mode,
          locale: 'de',
          metric: 'TOP',
          items,
          maxEntries: 50,
        });
        return {
          ok: true,
          mode,
          durationMs: rounded(performance.now() - startedAt),
          resultMode: result.mode,
          entries: result.entries.length,
          fallbackUsed: result.fallbackUsed,
        };
      } catch (error) {
        return {
          ok: false,
          mode,
          durationMs: rounded(performance.now() - startedAt),
          error: errorMessage(error),
        };
      }
    }),
  );
}

async function runIteration({ iteration, publicTrpc, hostTrpc, code, joinedParticipants, config }) {
  const opened = await hostTrpc.session.nextQuestion.mutate({ code });
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id || question.type !== 'FREETEXT') {
    throw new Error(`Iteration ${iteration}: aktive Frage ist nicht der erwartete FREETEXT-Typ.`);
  }

  const expectedResponses = joinedParticipants.map((entry) => responseFor(entry.index));
  const voteWave = await submitVoteWave(publicTrpc, joinedParticipants, question.id, config);
  const successfulVotes = voteWave.results.filter((result) => result.ok);
  const visibility = await waitForHostVisibility(
    hostTrpc,
    code,
    config.participants,
    voteWave.finishedAt,
    config,
  );
  const responses = visibility.snapshot?.responses ?? [];
  const analyses = await analyzeModes(hostTrpc, code, responses, iteration);
  const resultsStatus = await hostTrpc.session.revealResults.mutate({ code });

  return {
    iteration,
    questionId: question.id,
    openedStatus: opened.status,
    resultsStatus: resultsStatus.status,
    votes: {
      expected: config.participants,
      accepted: successfulVotes.length,
      rejected: voteWave.results.length - successfulVotes.length,
      waveDurationMs: voteWave.durationMs,
      durationSamplesMs: voteWave.results.map((result) => result.durationMs),
      ...summarize(voteWave.results.map((result) => result.durationMs)),
      errors: summarizeErrorMessages(voteWave.results),
    },
    hostVisibility: {
      complete: visibility.complete,
      latencyMs: visibility.latencyMs,
      polls: visibility.polls,
      pollingErrors: visibility.pollingErrors,
      lastError: visibility.lastError,
      responseCount: responses.length,
      exactResponseMultiset: sameMultiset(responses, expectedResponses),
      completenessPct: rounded((responses.length / config.participants) * 100),
    },
    analyses,
  };
}

function buildAssertions(config, joinResults, rounds, finishedStatus) {
  const voteDurations = rounds.flatMap((round) => round.votes.durationSamplesMs);
  const visibilityValues = rounds.map((round) => round.hostVisibility.latencyMs);
  const analysisDurations = rounds.flatMap((round) =>
    round.analyses.filter((analysis) => analysis.ok).map((analysis) => analysis.durationMs),
  );
  const voteP95Ms = percentile(voteDurations, 95);
  const visibilityP95Ms = percentile(visibilityValues, 95);
  const analysisP95Ms = percentile(analysisDurations, 95);
  const joined = joinResults.filter((result) => result.ok).length;
  const allAnalyses = rounds.flatMap((round) => round.analyses);
  const minimumCompleteness = Math.min(
    ...rounds.map((round) => round.hostVisibility.completenessPct),
  );

  return [
    {
      name: 'Alle Teilnehmenden beigetreten',
      passed: joined === config.participants,
      expected: config.participants,
      actual: joined,
    },
    {
      name: 'Alle Votes akzeptiert',
      passed: rounds.every(
        (round) => round.votes.accepted === config.participants && round.votes.rejected === 0,
      ),
      expected: config.participants * config.iterations,
      actual: rounds.reduce((sum, round) => sum + round.votes.accepted, 0),
    },
    {
      name: 'Vote-p95 innerhalb Schwelle',
      passed: voteP95Ms !== null && voteP95Ms <= config.voteP95LimitMs,
      limitMs: config.voteP95LimitMs,
      actualMs: voteP95Ms,
    },
    {
      name: 'Host-Sichtbarkeit innerhalb Schwelle',
      passed:
        visibilityP95Ms !== null &&
        visibilityP95Ms <= config.hostVisibilityP95LimitMs &&
        rounds.every((round) => round.hostVisibility.pollingErrors === 0),
      limitMs: config.hostVisibilityP95LimitMs,
      actualP95Ms: visibilityP95Ms,
    },
    {
      name: 'Antworten vollständig und unverändert',
      passed:
        minimumCompleteness >= config.minCompletenessPct &&
        rounds.every((round) => round.hostVisibility.exactResponseMultiset),
      minimumPct: config.minCompletenessPct,
      actualMinimumPct: minimumCompleteness,
    },
    {
      name: 'LEXICAL- und THEME-Analysen erfolgreich',
      passed:
        allAnalyses.length === config.iterations * 2 &&
        allAnalyses.every(
          (analysis) =>
            analysis.ok && analysis.resultMode === analysis.mode && analysis.entries > 0,
        ),
      expected: config.iterations * 2,
      successful: allAnalyses.filter((analysis) => analysis.ok).length,
    },
    {
      name: 'Analyse-p95 innerhalb Schwelle',
      passed: analysisP95Ms !== null && analysisP95Ms <= config.analysisP95LimitMs,
      limitMs: config.analysisP95LimitMs,
      actualMs: analysisP95Ms,
    },
    {
      name: 'Session sauber beendet',
      passed: finishedStatus === 'FINISHED',
      expected: 'FINISHED',
      actual: finishedStatus,
    },
  ];
}

async function execute(config) {
  await waitForBackend(config.trpcUrl, { attempts: 30 });
  const publicTrpc = createHttpTrpcSingle(config.trpcUrl);
  const session = await createSession(publicTrpc, config);
  const hostTrpc = createHttpTrpcSingle(config.trpcUrl, session.hostToken);

  console.log(
    `Freitext-Word-Cloud: ${config.participants} Teilnehmende, ${config.iterations} Messrunden`,
  );
  const joinResults = await joinParticipants(publicTrpc, session.code, config);
  const joinedParticipants = joinResults.filter((result) => result.ok);
  console.log(`Join: ${joinedParticipants.length}/${config.participants}`);

  const rounds = [];
  if (joinedParticipants.length === config.participants) {
    for (let iteration = 1; iteration <= config.iterations; iteration += 1) {
      if (iteration > 1) await sleep(config.voteCooldownMs);
      const round = await runIteration({
        iteration,
        publicTrpc,
        hostTrpc,
        code: session.code,
        joinedParticipants,
        config,
      });
      rounds.push(round);
      console.log(
        `Runde ${iteration}: Votes ${round.votes.accepted}/${config.participants}, ` +
          `Vote-p95 ${round.votes.p95Ms} ms, Host sichtbar ${round.hostVisibility.latencyMs} ms`,
      );
    }
  }

  const finished =
    rounds.length === config.iterations
      ? await hostTrpc.session.nextQuestion.mutate({ code: session.code })
      : { status: null };
  const assertions =
    rounds.length === config.iterations
      ? buildAssertions(config, joinResults, rounds, finished.status)
      : [
          {
            name: 'Alle Teilnehmenden beigetreten',
            passed: false,
            expected: config.participants,
            actual: joinedParticipants.length,
          },
        ];
  const passed = assertions.every((assertion) => assertion.passed);
  const voteP95Ms = percentile(
    rounds.flatMap((round) => round.votes.durationSamplesMs),
    95,
  );
  const visibilityP95Ms = percentile(
    rounds.map((round) => round.hostVisibility.latencyMs),
    95,
  );
  const analysisP95Ms = percentile(
    rounds.flatMap((round) =>
      round.analyses.filter((analysis) => analysis.ok).map((analysis) => analysis.durationMs),
    ),
    95,
  );
  const reportRounds = rounds.map((round) => {
    const { durationSamplesMs: _durationSamplesMs, ...votes } = round.votes;
    return { ...round, votes };
  });

  return {
    report: {
      schemaVersion: 1,
      scenario: 'freetext-wordcloud-classroom',
      timestamp: new Date().toISOString(),
      status: passed ? 'passed' : 'failed',
      environment: {
        trpcUrl: reportableUrl(config.trpcUrl),
        participants: config.participants,
        iterations: config.iterations,
        joinConcurrency: config.joinConcurrency,
        voteConcurrency: config.voteConcurrency,
      },
      session: {
        code: session.code,
        sessionId: session.sessionId,
        quizId: session.quizId,
        finalStatus: finished.status,
      },
      thresholds: {
        voteP95LimitMs: config.voteP95LimitMs,
        hostVisibilityP95LimitMs: config.hostVisibilityP95LimitMs,
        analysisP95LimitMs: config.analysisP95LimitMs,
        minResponseCompletenessPct: config.minCompletenessPct,
      },
      metrics: {
        joinedParticipants: joinedParticipants.length,
        joinErrors: summarizeErrorMessages(joinResults),
        voteP95Ms,
        hostVisibilityP95Ms: visibilityP95Ms,
        analysisP95Ms,
        rounds: reportRounds,
      },
      assertions,
    },
    exitCode: passed ? EXIT_OK : EXIT_ASSERTION_FAILED,
  };
}

async function main() {
  let config;
  try {
    config = readConfig();
    const { report, exitCode } = await execute(config);
    await writeLoadReport(
      config.reportFile,
      {
        scenario: report.scenario,
        timestamp: report.timestamp,
        environment: {
          ...report.environment,
          thresholds: report.thresholds,
        },
        metrics: {
          session: report.session,
          ...report.metrics,
        },
        assertions: report.assertions,
      },
      { junitPath: process.env.JUNIT_FILE || undefined },
    );
    console.log(`Report: ${config.reportFile}`);
    if (exitCode === EXIT_OK) {
      console.log('BESTANDEN: Freitext- und Word-Cloud-Pfad vollständig.');
    } else {
      console.error('FEHLGESCHLAGEN:');
      for (const assertion of report.assertions.filter((entry) => !entry.passed)) {
        console.error(`- ${assertion.name}`);
      }
    }
    return exitCode;
  } catch (error) {
    const message = errorMessage(error);
    const reportFile = config?.reportFile ?? (REPORT_FILE ? resolve(REPORT_FILE) : null);
    const report = {
      schemaVersion: 1,
      scenario: 'freetext-wordcloud-classroom',
      timestamp: new Date().toISOString(),
      status: 'error',
      error: message,
    };
    console.error(`LAUFZEITFEHLER: ${message}`);
    if (reportFile) {
      try {
        await writeLoadReport(
          reportFile,
          {
            scenario: report.scenario,
            timestamp: report.timestamp,
            metrics: { runtimeError: message },
            assertions: [{ name: 'runtime', passed: false, message }],
          },
          { junitPath: process.env.JUNIT_FILE || undefined },
        );
        console.error(`Fehlerreport: ${reportFile}`);
      } catch (reportError) {
        console.error(`Fehlerreport konnte nicht geschrieben werden: ${errorMessage(reportError)}`);
      }
    }
    return EXIT_RUNTIME_ERROR;
  }
}

process.exitCode = await main();
