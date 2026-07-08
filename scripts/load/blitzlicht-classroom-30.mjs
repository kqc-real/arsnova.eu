#!/usr/bin/env node
/**
 * Unterrichts-Szenario: Blitzlicht-Kanal TEMPO mit 30 Teilnehmenden.
 *
 * Ablauf:
 * 1. Host erstellt Session nur mit Blitzlicht-Kanal
 * 2. 30 TN joinen
 * 3. Host startet Tempo-Runde (Vortragstempo)
 * 4. Jeder TN gibt unterschiedliches Tempo-Feedback (SPEED_UP / FOLLOWING / SLOW_DOWN / LOST)
 *
 * Run:
 *   npm run load:smoke:blitzlicht-classroom-30
 *   PARTICIPANTS=30 TRPC_URL=http://127.0.0.1:3000/trpc node scripts/load/blitzlicht-classroom-30.mjs
 */
let trpcClientModule;
try {
  trpcClientModule = await import('@trpc/client');
} catch {
  trpcClientModule = await import('../../apps/frontend/node_modules/@trpc/client/dist/index.mjs');
}

const { createTRPCProxyClient, httpLink } = trpcClientModule;

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 30));
const JOIN_CONCURRENCY = Math.max(1, Number(process.env.JOIN_CONCURRENCY || 15));
const VOTE_CONCURRENCY = Math.max(1, Number(process.env.VOTE_CONCURRENCY || 30));

const TEMPO_VALUES = ['SPEED_UP', 'FOLLOWING', 'SLOW_DOWN', 'LOST'];

function createHttpClient(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpLink({
        url: TRPC_URL,
        headers: hostToken ? () => ({ 'x-host-token': hostToken }) : undefined,
      }),
    ],
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function waitForBackend() {
  const healthUrl = TRPC_URL.replace(/\/trpc\/?$/, '/health');
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) return;
    } catch {
      // Backend not ready yet.
    }
    await sleep(500);
  }
  throw new Error(`Backend unter ${healthUrl} ist nicht erreichbar.`);
}

function expectedTempoDistribution(participantCount) {
  const distribution = Object.fromEntries(TEMPO_VALUES.map((value) => [value, 0]));
  for (let index = 0; index < participantCount; index += 1) {
    const value = TEMPO_VALUES[index % TEMPO_VALUES.length];
    distribution[value] += 1;
  }
  return distribution;
}

function tempoValueForParticipant(index) {
  return TEMPO_VALUES[index % TEMPO_VALUES.length];
}

async function createBlitzlichtSession(publicTrpc) {
  const { code, hostToken, sessionId } = await publicTrpc.session.create.mutate({
    type: 'QUIZ',
    quickFeedbackEnabled: true,
    qaEnabled: false,
    title: `Blitzlicht Tempo ${Date.now()}`,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    anonymousMode: false,
    teamMode: false,
  });
  return { code, hostToken, sessionId };
}

async function joinParticipants(publicTrpc, code) {
  const indexes = Array.from({ length: PARTICIPANTS }, (_, index) => index);
  return mapLimit(indexes, JOIN_CONCURRENCY, async (index) =>
    publicTrpc.session.join.mutate({
      code,
      nickname: `TN ${String(index + 1).padStart(2, '0')}`,
    }),
  );
}

async function castTempoVotes(publicTrpc, code, participants) {
  const durations = [];
  const startedAt = performance.now();
  const results = await mapLimit(participants, VOTE_CONCURRENCY, async (participant, index) => {
    const requestStartedAt = performance.now();
    const value = tempoValueForParticipant(index);
    try {
      await publicTrpc.quickFeedback.vote.mutate({
        sessionCode: code,
        voterId: participant.participantId,
        value,
      });
      return { index, value, ok: true };
    } catch (error) {
      return {
        index,
        value,
        ok: false,
        error: error?.message ?? String(error),
      };
    } finally {
      durations.push(performance.now() - requestStartedAt);
    }
  });

  return {
    results,
    accepted: results.filter((result) => result.ok).length,
    rejected: results.filter((result) => !result.ok).length,
    totalDurationMs: Math.round(performance.now() - startedAt),
    ...summarizeDurations(durations),
    errors: summarizeErrors(
      results
        .filter((result) => !result.ok)
        .map((result) => ({ status: 'rejected', reason: new Error(result.error) })),
    ),
  };
}

async function run() {
  await waitForBackend();
  const publicTrpc = createHttpClient();
  const { code, hostToken } = await createBlitzlichtSession(publicTrpc);
  const hostTrpc = createHttpClient(hostToken);

  const participants = await joinParticipants(publicTrpc, code);
  const round = await hostTrpc.quickFeedback.create.mutate({
    type: 'TEMPO',
    sessionCode: code,
  });

  const votePhase = await castTempoVotes(publicTrpc, code, participants);
  const hostResults = await hostTrpc.quickFeedback.hostResults.query({ sessionCode: code });
  const isActive = await publicTrpc.quickFeedback.isActive.query({ sessionCode: code });

  const expectedDistribution = expectedTempoDistribution(PARTICIPANTS);
  const distributionMatches = TEMPO_VALUES.every(
    (value) => (hostResults.distribution[value] ?? 0) === expectedDistribution[value],
  );

  const summary = {
    scenario: 'blitzlicht-tempo-classroom',
    code,
    sessionId: round.sessionCode,
    participants: PARTICIPANTS,
    feedbackType: 'TEMPO',
    roundActive: isActive.active,
    expectedVotes: PARTICIPANTS,
    votePhase: {
      accepted: votePhase.accepted,
      rejected: votePhase.rejected,
      totalDurationMs: votePhase.totalDurationMs,
      p50Ms: votePhase.p50Ms,
      p95Ms: votePhase.p95Ms,
      maxMs: votePhase.maxMs,
      errors: votePhase.errors,
    },
    expectedDistribution,
    hostResults: {
      type: hostResults.type,
      locked: hostResults.locked,
      totalVotes: hostResults.totalVotes,
      distribution: hostResults.distribution,
      tempoTrend: hostResults.tempoTrend ?? null,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = [];
  if (participants.length !== PARTICIPANTS) {
    failures.push(`Join: ${participants.length}/${PARTICIPANTS}`);
  }
  if (!isActive.active) {
    failures.push('Blitzlicht-Runde ist nicht aktiv (Redis).');
  }
  if (hostResults.type !== 'TEMPO') {
    failures.push(`Feedback-Typ ${hostResults.type}, erwartet TEMPO`);
  }
  if (votePhase.accepted !== PARTICIPANTS) {
    failures.push(`Votes: ${votePhase.accepted}/${PARTICIPANTS}`);
  }
  if (hostResults.totalVotes !== PARTICIPANTS) {
    failures.push(`Host totalVotes: ${hostResults.totalVotes}/${PARTICIPANTS}`);
  }
  if (!distributionMatches) {
    failures.push('Tempo-Verteilung weicht von der erwarteten Mischung ab.');
  }
  if (!hostResults.tempoTrend) {
    failures.push('tempoTrend fehlt in hostResults.');
  }

  if (failures.length > 0) {
    console.error('\nFEHLER');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nOK Blitzlicht-Unterrichtsszenario (30 TN, Vortragstempo) bestanden.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
