import { createHostWsTrpc, createHttpTrpc } from '../lib/trpc-runtime.mjs';

/**
 * Host-WebSocket-Monitor fuer Vote-Progress und Status-Fan-out waehrend Artillery-Lauf.
 */
export function startHostMonitor({ trpcUrl, wsUrl, code, hostToken }) {
  const { trpc, wsClient } = createHostWsTrpc(wsUrl, hostToken, code);
  const hostHttp = createHttpTrpc(trpcUrl, hostToken);

  const state = {
    progressMessages: 0,
    progressMaxTotalVotes: 0,
    statusMessages: 0,
    lastStatus: null,
    resultsSeenAt: null,
    subscriptionErrors: 0,
    revealed: false,
  };

  const progressSub = trpc.session.onHostVoteProgressChanged.subscribe(
    { code },
    {
      onData(data) {
        state.progressMessages += 1;
        state.progressMaxTotalVotes = Math.max(state.progressMaxTotalVotes, data?.totalVotes ?? 0);
      },
      onError() {
        state.subscriptionErrors += 1;
      },
    },
  );

  const statusSub = trpc.session.onStatusChanged.subscribe(
    { code },
    {
      onData(data) {
        state.statusMessages += 1;
        state.lastStatus = data?.status ?? null;
        if (data?.status === 'RESULTS' && state.resultsSeenAt === null) {
          state.resultsSeenAt = Date.now();
        }
      },
      onError() {
        state.subscriptionErrors += 1;
      },
    },
  );

  return {
    state,
    async revealResultsOnce() {
      if (state.revealed) return state.lastStatus;
      const result = await hostHttp.session.revealResults.mutate({ code });
      state.revealed = true;
      state.lastStatus = result.status;
      return result.status;
    },
    async getProgressSnapshot() {
      return hostHttp.session.getHostVoteProgress.query({ code });
    },
    stop() {
      progressSub.unsubscribe();
      statusSub.unsubscribe();
      wsClient.close();
    },
  };
}
