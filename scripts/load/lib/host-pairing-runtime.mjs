import { createHttpTrpc } from './trpc-runtime.mjs';

export const HOST_CONNECTION_ENDED = 'Die Host-Verbindung wurde beendet.';

export function createPairingQuizPayload(name) {
  return {
    name,
    description: undefined,
    motifImageUrl: null,
    showLeaderboard: true,
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
    questions: [
      {
        text: 'In welchem Jahr begann die Franzoesische Revolution?',
        type: 'NUMERIC_ESTIMATE',
        timer: null,
        difficulty: 'MEDIUM',
        order: 0,
        answers: [],
        numericToleranceMode: 'ABSOLUTE_INTERVAL',
        numericReferenceValue: 1789,
        numericIntervalLeft: 1700,
        numericIntervalRight: 1900,
        numericInputType: 'INTEGER',
        numericDecimalPlaces: 0,
        numericMin: 1500,
        numericMax: 2000,
        numericTwoRounds: false,
      },
    ],
  };
}

export async function createPairingSession(publicTrpc, trpcUrl, name) {
  const { quizId } = await publicTrpc.quiz.upload.mutate(createPairingQuizPayload(name));
  const created = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: true,
    quickFeedbackEnabled: false,
  });
  return {
    code: created.code,
    hostToken: created.hostToken,
    hostTrpc: createHttpTrpc(trpcUrl, created.hostToken),
  };
}

export function trpcErrorCode(error) {
  return error?.data?.code ?? error?.shape?.data?.code ?? null;
}

export function trpcErrorMessage(error) {
  return String(error?.message ?? error ?? '');
}

export function isUnauthorizedHostError(error) {
  const code = trpcErrorCode(error);
  const message = trpcErrorMessage(error);
  return (
    code === 'UNAUTHORIZED' ||
    message.includes(HOST_CONNECTION_ENDED) ||
    message.includes('Host-Session ungültig') ||
    message.includes('UNAUTHORIZED')
  );
}

export async function expectHostMutationDenied(trpc, code, label) {
  try {
    await trpc.session.nextQuestion.mutate({ code });
  } catch (error) {
    if (isUnauthorizedHostError(error)) {
      return error;
    }
    throw new Error(
      `${label}: erwartete Host-Verweigerung, erhielt ${trpcErrorCode(error) ?? 'ohne Code'}: ${trpcErrorMessage(error)}`,
    );
  }
  throw new Error(`${label}: Host-Mutation wurde unerwartet angenommen.`);
}

export async function pairDevice(originalTrpc, publicTrpc, code, deviceLabel, screenVisibility) {
  const invite = await originalTrpc.session.createHostPairingInvite.mutate({
    code,
    screenVisibility: screenVisibility ?? 'PROJECTED',
  });
  const requested = await publicTrpc.session.requestHostPairing.mutate({
    code,
    pairingSecret: invite.pairingSecret,
    deviceLabel,
  });
  if (!requested.requestId || !requested.requestSecret) {
    throw new Error(`Pairing-Anfrage für ${deviceLabel} lieferte keine Request-Secrets.`);
  }
  const approved = await originalTrpc.session.approveHostPairing.mutate({
    code,
    requestId: requested.requestId,
  });
  const claimed = await publicTrpc.session.getHostPairingRequest.query({
    code,
    requestId: requested.requestId,
    requestSecret: requested.requestSecret,
  });
  const pairedHostToken = claimed.token?.pairedHostToken;
  if (!pairedHostToken || claimed.token?.role !== 'PAIRED_HOST') {
    throw new Error(`Claim für ${deviceLabel} lieferte kein PairedHostToken.`);
  }
  return {
    invite,
    requested,
    approved,
    claimed,
    tokenId: approved.tokenId,
    pairedHostToken,
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForCondition(label, timeoutMs, predicate) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return performance.now() - startedAt;
    }
    await sleep(50);
  }
  throw new Error(`${label} nicht innerhalb von ${timeoutMs} ms erreicht.`);
}

export async function mapLimit(items, limit, mapper) {
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

export function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}
