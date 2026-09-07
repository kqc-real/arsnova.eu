#!/usr/bin/env node
/**
 * Story 2.10 Slice 5 — Missbrauchs-/Security-E2E gegen ein laufendes Backend.
 *
 * Deckt den DoD-Missbrauchspfad live ab:
 * - oeffentlicher QR → Pending ohne Host-Rechte → Reject ohne Token
 * - Privat ohne Approve → kein Token
 * - Cap 3 → weitere Freigabe fehl, nach Widerruf wieder moeglich
 * - Approve → Host-Aktion → Widerruf invalidiert HTTP und WebSocket
 *
 * Presenter ohne Freigabe-UI bleibt der Browser-Smoke
 * `smoke:host-pairing-security` (getrennte Kontexte).
 *
 * Run:
 *   npm run load:smoke:host-pairing-security
 *   TRPC_URL=http://127.0.0.1:3000/trpc WS_URL=ws://127.0.0.1:3001 node scripts/load/host-pairing-security-e2e.mjs
 */
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';
import { createHttpTrpc, createHostWsTrpc } from './lib/trpc-runtime.mjs';
import {
  HOST_CONNECTION_ENDED,
  createPairingSession,
  expectHostMutationDenied,
  isUnauthorizedHostError,
  pairDevice,
  sleep,
  trpcErrorMessage,
  waitForCondition,
} from './lib/host-pairing-runtime.mjs';

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const WS_URL = String(process.env.WS_URL || 'ws://127.0.0.1:3001').trim();

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${prefix}${label}${suffix}`);
}

async function claimOrPending(publicTrpc, code, requested) {
  return publicTrpc.session.getHostPairingRequest.query({
    code,
    requestId: requested.requestId,
    requestSecret: requested.requestSecret,
  });
}

async function runPublicReject(originalTrpc, publicTrpc, code) {
  const invite = await originalTrpc.session.createHostPairingInvite.mutate({
    code,
    screenVisibility: 'PROJECTED',
  });
  const requested = await publicTrpc.session.requestHostPairing.mutate({
    code,
    pairingSecret: invite.pairingSecret,
    deviceLabel: 'Oeffentlicher Scan',
  });
  if (requested.state !== 'PENDING_APPROVAL' || !requested.requestId) {
    throw new Error('Oeffentlicher Scan erreichte nicht PENDING_APPROVAL.');
  }
  const pending = await claimOrPending(publicTrpc, code, requested);
  if (pending.state !== 'PENDING_APPROVAL' || pending.token) {
    throw new Error('Pending-Claim lieferte unerwartet ein Token.');
  }
  await expectHostMutationDenied(publicTrpc, code, 'Pending ohne Token');
  await originalTrpc.session.rejectHostPairing.mutate({
    code,
    requestId: requested.requestId,
  });
  const rejected = await claimOrPending(publicTrpc, code, requested);
  if (rejected.state !== 'REJECTED' || rejected.token) {
    throw new Error(`Reject lieferte ${rejected.state} mit Token=${Boolean(rejected.token)}.`);
  }
  logStep(true, 'Oeffentlicher QR bleibt Pending und nach Reject ohne Token');
}

async function runPrivateNoGrant(originalTrpc, publicTrpc, code) {
  const invite = await originalTrpc.session.createHostPairingInvite.mutate({
    code,
    screenVisibility: 'PRIVATE',
  });
  const requested = await publicTrpc.session.requestHostPairing.mutate({
    code,
    pairingSecret: invite.pairingSecret,
    deviceLabel: 'Privates Handy',
  });
  const pending = await claimOrPending(publicTrpc, code, requested);
  if (pending.state !== 'PENDING_APPROVAL' || pending.token) {
    throw new Error('Privat-Pfad hat ohne Approve ein Token ausgestellt.');
  }
  await expectHostMutationDenied(publicTrpc, code, 'Privat ohne Approve');
  await originalTrpc.session.rejectHostPairing.mutate({
    code,
    requestId: requested.requestId,
  });
  logStep(true, 'Privat ohne Approve stellt kein Token aus');
}

async function runCapAndRevokeSlot(originalTrpc, publicTrpc, code) {
  const paired = [];
  for (let index = 0; index < 3; index += 1) {
    paired.push(await pairDevice(originalTrpc, publicTrpc, code, `Cap-Geraet ${index + 1}`));
  }
  const fourthInvite = await originalTrpc.session.createHostPairingInvite.mutate({
    code,
    screenVisibility: 'PROJECTED',
  });
  try {
    await publicTrpc.session.requestHostPairing.mutate({
      code,
      pairingSecret: fourthInvite.pairingSecret,
      deviceLabel: 'Cap-Geraet 4',
    });
    throw new Error('Vierte Pairing-Anfrage wurde trotz Cap angenommen.');
  } catch (error) {
    if (trpcErrorMessage(error).includes('Vierte Pairing')) throw error;
    const message = trpcErrorMessage(error);
    if (!message.includes('drei weitere Host-Geräte') && !message.includes('drei weitere')) {
      throw new Error(`Cap-Negativ lieferte unerwartete Meldung: ${message}`, { cause: error });
    }
  }
  await originalTrpc.session.revokePairedHost.mutate({
    code,
    tokenId: paired[0].tokenId,
  });
  const replacement = await pairDevice(originalTrpc, publicTrpc, code, 'Cap-Geraet nach Widerruf');
  const listed = await originalTrpc.session.listPairedHosts.query({ code });
  if (listed.devices.length !== 3) {
    throw new Error(
      `Nach Cap-Widerruf sind ${listed.devices.length} Geraete verbunden, erwartet 3.`,
    );
  }
  logStep(
    true,
    'Cap 3 blockiert weitere Freigabe, nach Widerruf wieder moeglich',
    replacement.tokenId,
  );
}

async function runApproveActionRevoke(originalTrpc, publicTrpc, trpcUrl, wsUrl, code) {
  const paired = await pairDevice(originalTrpc, publicTrpc, code, 'Freigegebenes Smartphone');
  const pairedHttp = createHttpTrpc(trpcUrl, paired.pairedHostToken);
  const started = await pairedHttp.session.nextQuestion.mutate({ code });
  if (started.status !== 'ACTIVE' && started.status !== 'QUESTION_OPEN') {
    throw new Error(`Paired Host konnte die Frage nicht starten (status=${started.status}).`);
  }

  const { trpc: pairedWs, wsClient } = createHostWsTrpc(wsUrl, paired.pairedHostToken);
  let wsEnded = false;
  let wsEndMessage = '';
  const subscription = pairedWs.session.onHostVoteProgressChanged.subscribe(
    { code },
    {
      onError(error) {
        wsEndMessage = trpcErrorMessage(error);
        if (wsEndMessage.includes(HOST_CONNECTION_ENDED) || isUnauthorizedHostError(error)) {
          wsEnded = true;
        }
      },
    },
  );
  await sleep(600);
  await originalTrpc.session.revokePairedHost.mutate({
    code,
    tokenId: paired.tokenId,
  });
  await waitForCondition('Widerruf beendet Host-WebSocket', 8_000, () => wsEnded);
  try {
    await pairedHttp.session.revealResults.mutate({ code });
    throw new Error('Widerrufenes Token durfte weiterhin revealResults ausfuehren.');
  } catch (error) {
    if (trpcErrorMessage(error).includes('Widerrufenes Token')) throw error;
    if (!isUnauthorizedHostError(error)) {
      throw new Error(`HTTP nach Widerruf: ${trpcErrorMessage(error)}`, { cause: error });
    }
  }
  subscription.unsubscribe();
  wsClient.close();
  if (
    !wsEndMessage.includes(HOST_CONNECTION_ENDED) &&
    !isUnauthorizedHostError({ message: wsEndMessage })
  ) {
    throw new Error(`WS-Abbruch ohne Host-Ended-Meldung: ${wsEndMessage}`);
  }
  const stillOriginal = await originalTrpc.session.getHostVoteProgress.query({ code });
  if (stillOriginal == null) {
    throw new Error('Original-Host verlor nach Widerruf den Vote-Progress-Zugriff.');
  }
  logStep(true, 'Approve, Host-Aktion und Widerruf invalidieren HTTP+WS', wsEndMessage);
}

async function run() {
  await waitForBackend(TRPC_URL, { attempts: 30 });
  const publicTrpc = createHttpTrpc(TRPC_URL);
  const first = await createPairingSession(publicTrpc, TRPC_URL, `Pairing Security ${Date.now()}`);
  const failures = [];

  try {
    await runPublicReject(first.hostTrpc, publicTrpc, first.code);
    await runPrivateNoGrant(first.hostTrpc, publicTrpc, first.code);
    await runCapAndRevokeSlot(first.hostTrpc, publicTrpc, first.code);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  const second = await createPairingSession(
    publicTrpc,
    TRPC_URL,
    `Pairing Security Revoke ${Date.now()}`,
  );
  try {
    await runApproveActionRevoke(second.hostTrpc, publicTrpc, TRPC_URL, WS_URL, second.code);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  const metrics = {
    publicRejectSession: first.code,
    revokeSession: second.code,
    failureCount: failures.length,
  };
  console.log(JSON.stringify(metrics, null, 2));

  await writeScenarioReport({
    scenario: 'host-pairing-security-e2e',
    environment: { trpcUrl: TRPC_URL, wsUrl: WS_URL },
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

  console.log('\nOK Host-Pairing-Security-E2E bestanden.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
