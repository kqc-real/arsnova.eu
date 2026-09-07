#!/usr/bin/env node
/**
 * Story 2.10 Slice 5 — Last-/Reconnect-Nachweis am Pairing-Cap.
 *
 * Ablauf:
 * 1. Original-Host + 3 Paired Hosts (Cap) + Presenter-Statuskanal
 * 2. N Lecture-Hall-Clients von einem Runner (Shared-NAT)
 * 3. Vote-Welle
 * 4. Paired-Host-Reconnect
 * 5. Presenter-Kanalwechsel
 * 6. Widerruf eines Paired Hosts bei noch verbundenen Teilnehmenden
 *
 * Run:
 *   npm run load:smoke:host-pairing-classroom-30
 *   PARTICIPANTS=500 npm run load:smoke:host-pairing-cap-500
 *   PARTICIPANTS=30 TRPC_URL=http://127.0.0.1:3000/trpc WS_URL=ws://127.0.0.1:3001 node scripts/load/host-pairing-cap-load.mjs
 */
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';
import { createHttpTrpc, createHostWsTrpc } from './lib/trpc-runtime.mjs';
import {
  HOST_CONNECTION_ENDED,
  createPairingSession,
  isUnauthorizedHostError,
  mapLimit,
  pairDevice,
  percentile,
  sleep,
  trpcErrorMessage,
  waitForCondition,
} from './lib/host-pairing-runtime.mjs';

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const WS_URL = String(process.env.WS_URL || 'ws://127.0.0.1:3001').trim();
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 30));
const JOIN_CONCURRENCY = Math.max(1, Number(process.env.JOIN_CONCURRENCY || 15));
const VOTE_P95_LIMIT_MS = Math.max(
  100,
  Number(process.env.VOTE_P95_LIMIT_MS || (PARTICIPANTS > 100 ? 4_000 : 1_000)),
);
const PROGRESS_MESSAGE_LIMIT = Math.max(4, Number(process.env.PROGRESS_MESSAGE_LIMIT || 20));
const CURRENT_QUESTION_MESSAGE_LIMIT = Math.max(
  1,
  Number(process.env.CURRENT_QUESTION_MESSAGE_LIMIT || 2),
);

function attachHostProgress(trpc, code) {
  const state = {
    progressMessages: 0,
    progressMaxTotalVotes: 0,
    currentQuestionMessages: 0,
    currentQuestionVoteBearingMessages: 0,
    subscriptionErrors: 0,
    lastError: '',
    ended: false,
  };
  const currentQuestionSub = trpc.session.onCurrentQuestionForHostChanged.subscribe(
    { code },
    {
      onData(data) {
        state.currentQuestionMessages += 1;
        if ((data?.totalVotes ?? 0) > 0) {
          state.currentQuestionVoteBearingMessages += 1;
        }
      },
      onError(error) {
        state.subscriptionErrors += 1;
        state.lastError = trpcErrorMessage(error);
        if (state.lastError.includes(HOST_CONNECTION_ENDED) || isUnauthorizedHostError(error)) {
          state.ended = true;
        }
      },
    },
  );
  const progressSub = trpc.session.onHostVoteProgressChanged.subscribe(
    { code },
    {
      onData(data) {
        state.progressMessages += 1;
        state.progressMaxTotalVotes = Math.max(state.progressMaxTotalVotes, data?.totalVotes ?? 0);
      },
      onError(error) {
        state.subscriptionErrors += 1;
        state.lastError = trpcErrorMessage(error);
        if (state.lastError.includes(HOST_CONNECTION_ENDED) || isUnauthorizedHostError(error)) {
          state.ended = true;
        }
      },
    },
  );
  return {
    state,
    unsubscribe() {
      currentQuestionSub.unsubscribe();
      progressSub.unsubscribe();
    },
  };
}

async function joinParticipants(publicTrpc, code) {
  const indexes = Array.from({ length: PARTICIPANTS }, (_, index) => index);
  return mapLimit(indexes, JOIN_CONCURRENCY, async (index) =>
    publicTrpc.session.join.mutate({
      code,
      nickname: `Load ${String(index + 1).padStart(3, '0')}`,
      anonymousClientId: globalThis.crypto.randomUUID(),
    }),
  );
}

async function voteSpike(publicTrpc, joined, questionId) {
  const responseTimes = [];
  const startedAt = performance.now();
  const results = await Promise.allSettled(
    joined.map(async (participant, index) => {
      const requestStartedAt = performance.now();
      await publicTrpc.vote.submit.mutate({
        sessionId: participant.id,
        participantId: participant.participantId,
        questionId,
        numericValue: 1700 + (index % 201),
        round: 1,
        responseTimeMs: 400 + (index % 50),
      });
      responseTimes.push(performance.now() - requestStartedAt);
    }),
  );
  return {
    durationMs: performance.now() - startedAt,
    failed: results.filter((result) => result.status === 'rejected').length,
    p50Ms: percentile(responseTimes, 50),
    p95Ms: percentile(responseTimes, 95),
    maxMs: Math.max(0, ...responseTimes),
  };
}

async function run() {
  await waitForBackend(TRPC_URL, { attempts: 30 });
  const publicTrpc = createHttpTrpc(TRPC_URL);
  const session = await createPairingSession(
    publicTrpc,
    TRPC_URL,
    `Pairing Cap Load ${Date.now()}`,
  );
  const { code, hostToken, hostTrpc } = session;
  const failures = [];

  const paired = [];
  for (let index = 0; index < 3; index += 1) {
    paired.push(await pairDevice(hostTrpc, publicTrpc, code, `Last-Geraet ${index + 1}`));
  }
  const listed = await hostTrpc.session.listPairedHosts.query({ code });
  if (listed.devices.length !== 3) {
    failures.push(`Cap-Vorbereitung listete ${listed.devices.length} Geraete statt 3.`);
  }

  const originalWs = createHostWsTrpc(WS_URL, hostToken);
  const originalProgress = attachHostProgress(originalWs.trpc, code);
  let presenterStatus = null;
  const presenterSub = originalWs.trpc.session.onStatusChanged.subscribe(
    { code },
    {
      onData(data) {
        presenterStatus = data?.preferredChannel ?? presenterStatus;
      },
    },
  );

  const pairedClients = paired.map((device) => {
    const ws = createHostWsTrpc(WS_URL, device.pairedHostToken);
    return {
      device,
      http: createHttpTrpc(TRPC_URL, device.pairedHostToken),
      ws,
      progress: attachHostProgress(ws.trpc, code),
    };
  });

  await sleep(750);
  await hostTrpc.session.nextQuestion.mutate({ code });
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id) {
    failures.push('Aktuelle Frage konnte nach nextQuestion nicht geladen werden.');
  }

  const joined = question?.id ? await joinParticipants(publicTrpc, code) : [];
  const spike = question?.id
    ? await voteSpike(publicTrpc, joined, question.id)
    : { durationMs: 0, failed: PARTICIPANTS, p50Ms: 0, p95Ms: 0, maxMs: 0 };
  await sleep(2_000);

  if (joined.length !== PARTICIPANTS) {
    failures.push(`Join lieferte ${joined.length} statt ${PARTICIPANTS} Teilnehmende.`);
  }
  if (spike.failed > 0) {
    failures.push(`${spike.failed} Vote-Requests sind fehlgeschlagen.`);
  }
  if (spike.p95Ms > VOTE_P95_LIMIT_MS) {
    failures.push(`Vote-Submit-p95 ${Math.round(spike.p95Ms)} ms > ${VOTE_P95_LIMIT_MS} ms.`);
  }
  if (originalProgress.state.currentQuestionVoteBearingMessages > 0) {
    failures.push('Votes haben den vollstaendigen Host-Fragenkanal geflutet.');
  }
  if (originalProgress.state.currentQuestionMessages > CURRENT_QUESTION_MESSAGE_LIMIT) {
    failures.push(
      `Current-Question-Messages ${originalProgress.state.currentQuestionMessages} > ${CURRENT_QUESTION_MESSAGE_LIMIT}.`,
    );
  }
  for (const [index, client] of [
    originalProgress,
    ...pairedClients.map((item) => item.progress),
  ].entries()) {
    if (client.state.progressMessages > PROGRESS_MESSAGE_LIMIT) {
      failures.push(
        `Host ${index} Vote-Progress-Messages ${client.state.progressMessages} > ${PROGRESS_MESSAGE_LIMIT}.`,
      );
    }
    if (client.state.progressMaxTotalVotes !== PARTICIPANTS) {
      failures.push(
        `Host ${index} sah nur ${client.state.progressMaxTotalVotes} von ${PARTICIPANTS} Votes.`,
      );
    }
  }

  const reconnectTarget = pairedClients[0];
  reconnectTarget.progress.unsubscribe();
  reconnectTarget.ws.wsClient.close();
  await sleep(250);
  reconnectTarget.ws = createHostWsTrpc(WS_URL, reconnectTarget.device.pairedHostToken);
  reconnectTarget.progress = attachHostProgress(reconnectTarget.ws.trpc, code);
  await sleep(600);
  const reconnectSnapshot = await reconnectTarget.http.session.getHostVoteProgress.query({
    code,
  });
  if ((reconnectSnapshot?.totalVotes ?? 0) !== PARTICIPANTS) {
    failures.push(
      `Reconnect-Snapshot meldete ${reconnectSnapshot?.totalVotes ?? 0} statt ${PARTICIPANTS} Votes.`,
    );
  }

  await hostTrpc.session.setPreferredLiveChannel.mutate({ code, channel: 'qa' });
  const qaInfo = await publicTrpc.session.getInfo.query({ code });
  if (qaInfo.preferredChannel !== 'qa') {
    failures.push(`Presenter-Wechsel auf Q&A fehlte (channel=${qaInfo.preferredChannel}).`);
  }
  await hostTrpc.session.setPreferredLiveChannel.mutate({ code, channel: 'quiz' });
  const quizInfo = await publicTrpc.session.getInfo.query({ code });
  if (quizInfo.preferredChannel !== 'quiz') {
    failures.push(`Presenter-Rueckwechsel auf Quiz fehlte (channel=${quizInfo.preferredChannel}).`);
  }

  const revoked = pairedClients[1];
  await hostTrpc.session.revokePairedHost.mutate({
    code,
    tokenId: revoked.device.tokenId,
  });
  try {
    await waitForCondition(
      'Widerruf unter Last beendet WS',
      8_000,
      () => revoked.progress.state.ended,
    );
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  try {
    await revoked.http.session.revealResults.mutate({ code });
    failures.push('Widerrufenes Geraet durfte unter Last weiter steuern.');
  } catch (error) {
    if (!isUnauthorizedHostError(error)) {
      failures.push(`HTTP nach Widerruf unter Last: ${trpcErrorMessage(error)}`);
    }
  }
  try {
    await reconnectTarget.http.session.getHostVoteProgress.query({ code });
  } catch (error) {
    failures.push(
      `Gueltiger Paired Host verlor nach fremdem Widerruf den Zugriff: ${trpcErrorMessage(error)}`,
    );
  }
  try {
    await hostTrpc.session.revealResults.mutate({ code });
  } catch (error) {
    failures.push(
      `Original-Host konnte nach Widerruf nicht mehr steuern: ${trpcErrorMessage(error)}`,
    );
  }

  originalProgress.unsubscribe();
  presenterSub.unsubscribe();
  originalWs.wsClient.close();
  for (const client of pairedClients) {
    client.progress.unsubscribe();
    client.ws.wsClient.close();
  }

  const metrics = {
    code,
    participants: PARTICIPANTS,
    sharedNatRunner: true,
    pairedHosts: 3,
    voteSpikeDurationMs: Math.round(spike.durationMs),
    voteSubmitP50Ms: Math.round(spike.p50Ms),
    voteSubmitP95Ms: Math.round(spike.p95Ms),
    voteSubmitMaxMs: Math.round(spike.maxMs),
    failedVotes: spike.failed,
    originalProgressMessages: originalProgress.state.progressMessages,
    originalCurrentQuestionMessages: originalProgress.state.currentQuestionMessages,
    presenterStatusLast: presenterStatus,
    presenterChannelAfterSwitch: quizInfo?.preferredChannel ?? null,
    revokedWsEnded: revoked.progress.state.ended,
    revokedWsMessage: revoked.progress.state.lastError,
  };
  console.log(JSON.stringify(metrics, null, 2));

  await writeScenarioReport({
    scenario: PARTICIPANTS >= 500 ? 'host-pairing-cap-500' : 'host-pairing-classroom-30',
    environment: {
      participants: PARTICIPANTS,
      joinConcurrency: JOIN_CONCURRENCY,
      voteP95LimitMs: VOTE_P95_LIMIT_MS,
      sharedNat: true,
    },
    metrics,
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

  console.log(
    `\nOK Host-Pairing-Cap-Last bestanden (${PARTICIPANTS} TN, 3 Paired Hosts, Shared-NAT).`,
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
