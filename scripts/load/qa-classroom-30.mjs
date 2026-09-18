#!/usr/bin/env node
/**
 * Unterrichts-Szenario: Live-Kanal Q&A mit 30 Teilnehmenden.
 *
 * Ablauf:
 * 1. Host erstellt reine Q&A-Session und startet den Kanal
 * 2. 30 TN joinen
 * 3. Jeder TN reicht 3 Fragen ein (90 gesamt)
 * 4. Jeder TN bewertet fremde Fragen (3x hoch, 3x runter)
 * 5. Host pinnt, archiviert und loescht je einige Fragen
 *
 * Run:
 *   npm run load:smoke:qa-classroom-30
 *   PARTICIPANTS=30 TRPC_URL=http://127.0.0.1:3000/trpc node scripts/load/qa-classroom-30.mjs
 */
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';
import { createHttpTrpcSingle } from './lib/trpc-runtime.mjs';
import { configureQaSessionIfNeeded } from './lib/configure-qa-if-needed.mjs';

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 30));
const QUESTIONS_PER_PARTICIPANT = Math.max(1, Number(process.env.QUESTIONS_PER_PARTICIPANT || 3));
const UPVOTES_PER_PARTICIPANT = Math.max(0, Number(process.env.UPVOTES_PER_PARTICIPANT || 3));
const DOWNVOTES_PER_PARTICIPANT = Math.max(0, Number(process.env.DOWNVOTES_PER_PARTICIPANT || 3));
const HOST_PIN_COUNT = Math.max(0, Number(process.env.HOST_PIN_COUNT || 5));
const HOST_ARCHIVE_COUNT = Math.max(0, Number(process.env.HOST_ARCHIVE_COUNT || 5));
const HOST_DELETE_COUNT = Math.max(0, Number(process.env.HOST_DELETE_COUNT || 5));
const JOIN_CONCURRENCY = Math.max(1, Number(process.env.JOIN_CONCURRENCY || 15));
const WRITE_CONCURRENCY = Math.max(1, Number(process.env.WRITE_CONCURRENCY || 20));
const SUBMIT_P95_LIMIT_MS = Math.max(100, Number(process.env.SUBMIT_P95_LIMIT_MS || 1_000));
const VOTE_PHASE_LIMIT_MS = Math.max(500, Number(process.env.VOTE_PHASE_LIMIT_MS || 5_000));

function createHttpClient(hostToken, participantCapability) {
  return createHttpTrpcSingle(TRPC_URL, hostToken, undefined, undefined, participantCapability);
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function summarizeDurations(values) {
  return {
    p50Ms: Math.round(percentile(values, 50)),
    p95Ms: Math.round(percentile(values, 95)),
    maxMs: Math.round(Math.max(0, ...values)),
  };
}

function summarizeErrors(results) {
  const errors = new Map();
  for (const result of results) {
    if (result.status !== 'rejected') continue;
    const message = result.reason?.message ?? String(result.reason ?? 'unknown');
    errors.set(message, (errors.get(message) ?? 0) + 1);
  }
  return Object.fromEntries([...errors.entries()].sort((a, b) => b[1] - a[1]));
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

async function createQaSession(publicTrpc) {
  const { code, hostToken, sessionId } = await publicTrpc.session.create.mutate({
    type: 'Q_AND_A',
    title: `Q&A Unterricht ${Date.now()}`,
    moderationMode: false,
    qaModerationMode: false,
    quickFeedbackEnabled: false,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    anonymousMode: false,
    teamMode: false,
  });
  return { code, hostToken, sessionId };
}

function configureQaSession(hostTrpc, code) {
  return configureQaSessionIfNeeded(hostTrpc, code, { qaTitle: 'Q&A Unterricht' });
}

async function joinParticipants(publicTrpc, code) {
  const indexes = Array.from({ length: PARTICIPANTS }, (_, index) => index);
  return mapLimit(indexes, JOIN_CONCURRENCY, async (index) => {
    const participant = await publicTrpc.session.join.mutate({
      code,
      nickname: `TN ${String(index + 1).padStart(2, '0')}`,
      anonymousClientId: globalThis.crypto.randomUUID(),
      joinIdempotencyKey: globalThis.crypto.randomUUID(),
    });
    if (!participant.rejoinToken) {
      throw new Error(`Join ${index + 1} lieferte keine participant capability.`);
    }
    return {
      ...participant,
      qaTrpc: createHttpClient(undefined, participant.rejoinToken),
    };
  });
}

function buildQuestionText(participantIndex, questionIndex) {
  const topics = [
    'Klausur',
    'Hausaufgabe',
    'Beispiel',
    'Definition',
    'Pruefung',
    'Uebung',
    'Formel',
    'Konzept',
    'Zeitplan',
  ];
  const topic = topics[(participantIndex + questionIndex) % topics.length];
  return `TN ${participantIndex + 1} Frage ${questionIndex + 1}: Koennen wir ${topic} noch einmal erklaeren?`;
}

async function submitQuestions(sessionId, participants) {
  const tasks = [];
  for (let participantIndex = 0; participantIndex < participants.length; participantIndex += 1) {
    const participant = participants[participantIndex];
    for (let questionIndex = 0; questionIndex < QUESTIONS_PER_PARTICIPANT; questionIndex += 1) {
      tasks.push({
        participantIndex,
        questionIndex,
        participant,
        text: buildQuestionText(participantIndex, questionIndex),
      });
    }
  }

  const durations = [];
  const startedAt = performance.now();
  const results = await mapLimit(tasks, WRITE_CONCURRENCY, async (task) => {
    const requestStartedAt = performance.now();
    try {
      const created = await task.participant.qaTrpc.qa.submit.mutate({
        sessionId,
        participantId: task.participant.participantId,
        text: task.text,
        idempotencyKey: globalThis.crypto.randomUUID(),
      });
      return {
        id: created.question.id,
        text: created.question.text,
        status: created.question.status,
        quota: created.quota,
        replayed: created.replayed,
        authorParticipantId: task.participant.participantId,
        participantIndex: task.participantIndex,
      };
    } finally {
      durations.push(performance.now() - requestStartedAt);
    }
  });

  return {
    questions: results,
    totalDurationMs: Math.round(performance.now() - startedAt),
    ...summarizeDurations(durations),
  };
}

function pickVoteTargets(participantIndex, questions) {
  const foreignQuestions = questions.filter((q) => q.participantIndex !== participantIndex);
  const upTargets = [];
  const downTargets = [];
  const votesNeeded = UPVOTES_PER_PARTICIPANT + DOWNVOTES_PER_PARTICIPANT;
  if (foreignQuestions.length < votesNeeded) {
    throw new Error(
      `Zu wenige fremde Fragen fuer TN ${participantIndex + 1}: ${foreignQuestions.length} < ${votesNeeded}`,
    );
  }

  for (let offset = 0; offset < UPVOTES_PER_PARTICIPANT; offset += 1) {
    const index = (participantIndex * 2 + offset) % foreignQuestions.length;
    upTargets.push(foreignQuestions[index]);
  }
  for (let offset = 0; offset < DOWNVOTES_PER_PARTICIPANT; offset += 1) {
    const index =
      (participantIndex * 2 + UPVOTES_PER_PARTICIPANT + offset) % foreignQuestions.length;
    downTargets.push(foreignQuestions[index]);
  }

  return { upTargets, downTargets };
}

async function castParticipantVotes(participant, participantIndex, questions) {
  const { upTargets, downTargets } = pickVoteTargets(participantIndex, questions);
  const voteTasks = [
    ...upTargets.map((question) => ({
      questionId: question.id,
      direction: 'UP',
    })),
    ...downTargets.map((question) => ({
      questionId: question.id,
      direction: 'DOWN',
    })),
  ];

  const durations = [];
  const results = await Promise.allSettled(
    voteTasks.map(async (task) => {
      const requestStartedAt = performance.now();
      try {
        return await participant.qaTrpc.qa.vote.mutate({
          questionId: task.questionId,
          participantId: participant.participantId,
          direction: task.direction,
        });
      } finally {
        durations.push(performance.now() - requestStartedAt);
      }
    }),
  );

  return {
    participantIndex,
    accepted: results.filter((result) => result.status === 'fulfilled').length,
    rejected: results.filter((result) => result.status === 'rejected').length,
    ...summarizeDurations(durations),
    errors: summarizeErrors(results),
  };
}

async function castAllVotes(participants, questions) {
  const startedAt = performance.now();
  const perParticipant = await mapLimit(
    participants.map((participant, index) => ({ participant, index })),
    WRITE_CONCURRENCY,
    async ({ participant, index }) => castParticipantVotes(participant, index, questions),
  );
  return {
    totalDurationMs: Math.round(performance.now() - startedAt),
    perParticipant,
    accepted: perParticipant.reduce((sum, row) => sum + row.accepted, 0),
    rejected: perParticipant.reduce((sum, row) => sum + row.rejected, 0),
  };
}

function pickModerationTargets(questions) {
  const active = questions.filter((question) => question.status === 'ACTIVE');
  const needed = HOST_PIN_COUNT + HOST_ARCHIVE_COUNT + HOST_DELETE_COUNT;
  if (active.length < needed) {
    throw new Error(`Zu wenige ACTIVE-Fragen fuer Host-Moderation: ${active.length} < ${needed}`);
  }

  const pin = active.slice(0, HOST_PIN_COUNT);
  const archive = active.slice(HOST_PIN_COUNT, HOST_PIN_COUNT + HOST_ARCHIVE_COUNT);
  const del = active.slice(
    HOST_PIN_COUNT + HOST_ARCHIVE_COUNT,
    HOST_PIN_COUNT + HOST_ARCHIVE_COUNT + HOST_DELETE_COUNT,
  );
  return { pin, archive, del };
}

async function moderateQuestions(hostTrpc, code, questions) {
  const targets = pickModerationTargets(questions);
  const actions = [
    ...targets.pin.map((question) => ({ question, action: 'PIN' })),
    ...targets.archive.map((question) => ({ question, action: 'ARCHIVE' })),
    ...targets.del.map((question) => ({ question, action: 'DELETE' })),
  ];

  const results = await Promise.allSettled(
    actions.map(async ({ question, action }) => {
      const updated = await hostTrpc.qa.moderate.mutate({
        sessionCode: code,
        questionId: question.id,
        action,
      });
      return { questionId: question.id, action, status: updated.status };
    }),
  );

  return {
    attempted: actions.length,
    accepted: results.filter((result) => result.status === 'fulfilled').length,
    rejected: results.filter((result) => result.status === 'rejected').length,
    errors: summarizeErrors(results),
    results: results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value),
  };
}

function countByStatus(questions) {
  const counts = {};
  for (const question of questions) {
    counts[question.status] = (counts[question.status] ?? 0) + 1;
  }
  return counts;
}

async function listAllHostQuestions(hostTrpc, sessionId) {
  const questions = [];
  let cursor;
  let rankingRevision = null;
  let totalCount = null;
  let pages = 0;
  do {
    const page = await hostTrpc.qa.list.query({
      sessionId,
      moderatorView: true,
      sort: 'TOP',
      pageSize: 100,
      ...(cursor ? { cursor } : {}),
    });
    if (!Array.isArray(page.questions) || page.questions.length > 100) {
      throw new Error('qa.list lieferte keine gültige, auf 100 Einträge begrenzte Seite.');
    }
    if (rankingRevision !== null && page.rankingRevision !== rankingRevision) {
      throw new Error('qa.list wechselte während der Pagination die Ranking-Revision.');
    }
    rankingRevision = page.rankingRevision ?? rankingRevision;
    totalCount = page.totalCount ?? totalCount;
    questions.push(...page.questions);
    cursor = page.nextCursor ?? undefined;
    pages += 1;
  } while (cursor);
  return { questions, pages, rankingRevision, totalCount };
}

async function run() {
  await waitForBackend(TRPC_URL);
  const publicTrpc = createHttpClient();
  const { code, hostToken, sessionId } = await createQaSession(publicTrpc);
  const hostTrpc = createHttpClient(hostToken);
  const qaConfiguration = await configureQaSession(hostTrpc, code);

  const participants = await joinParticipants(publicTrpc, code);
  const qaStart = await hostTrpc.session.startQa.mutate({ code });

  const submitPhase = await submitQuestions(sessionId, participants);
  const votePhase = await castAllVotes(participants, submitPhase.questions);
  const moderatePhase = await moderateQuestions(hostTrpc, code, submitPhase.questions);

  const hostList = await listAllHostQuestions(hostTrpc, sessionId);
  const visibleQuestions = hostList.questions;
  const statusCounts = countByStatus(visibleQuestions);

  const expectedQuestions = PARTICIPANTS * QUESTIONS_PER_PARTICIPANT;
  const expectedVotes = PARTICIPANTS * (UPVOTES_PER_PARTICIPANT + DOWNVOTES_PER_PARTICIPANT);
  const expectedHostActions = HOST_PIN_COUNT + HOST_ARCHIVE_COUNT + HOST_DELETE_COUNT;
  const expectedVisibleAfterModeration = expectedQuestions - HOST_DELETE_COUNT;
  const replayedSubmits = submitPhase.questions.filter((question) => question.replayed).length;
  const participantQuotaMaxima = new Map();
  for (const question of submitPhase.questions) {
    const previous = participantQuotaMaxima.get(question.authorParticipantId) ?? 0;
    participantQuotaMaxima.set(
      question.authorParticipantId,
      Math.max(previous, question.quota.participantQuestionCount),
    );
  }
  const participantsAtExpectedQuota = [...participantQuotaMaxima.values()].filter(
    (count) => count === QUESTIONS_PER_PARTICIPANT,
  ).length;
  const maxSessionQuestionCount = Math.max(
    0,
    ...submitPhase.questions.map((question) => question.quota.sessionQuestionCount),
  );

  const summary = {
    scenario: 'qa-classroom',
    code,
    sessionId,
    participants: PARTICIPANTS,
    qaConfiguredClosesAt: qaConfiguration.qaClosesAt,
    qaStartStatus: qaStart.status,
    questionsPerParticipant: QUESTIONS_PER_PARTICIPANT,
    expectedQuestions,
    submittedQuestions: submitPhase.questions.length,
    submitPhase: {
      totalDurationMs: submitPhase.totalDurationMs,
      p50Ms: submitPhase.p50Ms,
      p95Ms: submitPhase.p95Ms,
      maxMs: submitPhase.maxMs,
      replayed: replayedSubmits,
      participantsAtExpectedQuota,
      maxSessionQuestionCount,
    },
    votesPerParticipant: {
      up: UPVOTES_PER_PARTICIPANT,
      down: DOWNVOTES_PER_PARTICIPANT,
    },
    expectedVotes,
    votePhase: {
      accepted: votePhase.accepted,
      rejected: votePhase.rejected,
      totalDurationMs: votePhase.totalDurationMs,
    },
    hostModeration: {
      pin: HOST_PIN_COUNT,
      archive: HOST_ARCHIVE_COUNT,
      delete: HOST_DELETE_COUNT,
      ...moderatePhase,
    },
    finalStatusCounts: statusCounts,
    hostListPages: hostList.pages,
    hostListTotalCount: hostList.totalCount,
    expectedVisibleAfterModeration,
    visibleAfterModeration: visibleQuestions.length,
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = [];
  if (participants.length !== PARTICIPANTS) {
    failures.push(`Join: ${participants.length}/${PARTICIPANTS}`);
  }
  if (qaStart.status !== 'ACTIVE') {
    failures.push(`Q&A-Start-Status ${qaStart.status}, erwartet ACTIVE`);
  }
  if (submitPhase.questions.length !== expectedQuestions) {
    failures.push(`Fragen: ${submitPhase.questions.length}/${expectedQuestions}`);
  }
  if (replayedSubmits !== 0) {
    failures.push(`Unerwartete Idempotency-Replays: ${replayedSubmits}.`);
  }
  if (participantsAtExpectedQuota !== PARTICIPANTS) {
    failures.push(
      `Teilnahmekontingent: ${participantsAtExpectedQuota}/${PARTICIPANTS} auf ${QUESTIONS_PER_PARTICIPANT}.`,
    );
  }
  if (maxSessionQuestionCount !== expectedQuestions) {
    failures.push(`Sessionkontingent: ${maxSessionQuestionCount}/${expectedQuestions}.`);
  }
  if (submitPhase.p95Ms > SUBMIT_P95_LIMIT_MS) {
    failures.push(`Q&A-Submit-p95 ${submitPhase.p95Ms} ms > ${SUBMIT_P95_LIMIT_MS} ms.`);
  }
  if (votePhase.accepted !== expectedVotes) {
    failures.push(`Votes: ${votePhase.accepted}/${expectedVotes}`);
  }
  if (votePhase.totalDurationMs > VOTE_PHASE_LIMIT_MS) {
    failures.push(`Q&A-Vote-Phase ${votePhase.totalDurationMs} ms > ${VOTE_PHASE_LIMIT_MS} ms.`);
  }
  if (moderatePhase.accepted !== expectedHostActions) {
    failures.push(`Host-Moderation: ${moderatePhase.accepted}/${expectedHostActions}`);
  }
  if ((statusCounts.PINNED ?? 0) !== HOST_PIN_COUNT) {
    failures.push(`PINNED: ${statusCounts.PINNED ?? 0}/${HOST_PIN_COUNT}`);
  }
  if ((statusCounts.ARCHIVED ?? 0) !== HOST_ARCHIVE_COUNT) {
    failures.push(`ARCHIVED: ${statusCounts.ARCHIVED ?? 0}/${HOST_ARCHIVE_COUNT}`);
  }
  if (visibleQuestions.length !== expectedVisibleAfterModeration) {
    failures.push(
      `Sichtbare Fragen: ${visibleQuestions.length}/${expectedVisibleAfterModeration} (nach DELETE)`,
    );
  }
  if (hostList.totalCount !== expectedVisibleAfterModeration) {
    failures.push(
      `qa.list totalCount: ${hostList.totalCount ?? 'fehlt'}/${expectedVisibleAfterModeration}.`,
    );
  }

  await writeScenarioReport({
    scenario: 'qa-classroom-30',
    environment: {
      participants: PARTICIPANTS,
      questionsPerParticipant: QUESTIONS_PER_PARTICIPANT,
      submitP95LimitMs: SUBMIT_P95_LIMIT_MS,
      votePhaseLimitMs: VOTE_PHASE_LIMIT_MS,
    },
    metrics: summary,
    failures,
  });

  if (failures.length > 0) {
    console.error('\nFEHLER');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nOK Q&A-Unterrichtsszenario (30 TN, Fragen + Votes + Moderation) bestanden.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
