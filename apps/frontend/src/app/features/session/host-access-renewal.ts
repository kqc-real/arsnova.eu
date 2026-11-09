import { getHostBrowserCapability } from '../../core/host-recovery-access';
import {
  getHostSessionRole,
  normalizeHostSessionCode,
  setHostToken,
} from '../../core/host-session-token';
import { refreshTrpcWsBinding, trpc } from '../../core/trpc.client';

export const HOST_ACCESS_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const renewals = new Map<string, Promise<void>>();

/** Host und Presenter können sich beim Routenwechsel eine laufende Erneuerung teilen. */
export function renewBrowserHostAccess(sessionCode: string): Promise<void> | null {
  const code = normalizeHostSessionCode(sessionCode);
  if (getHostSessionRole(code) === 'PAIRED_HOST') return null;
  const capability = getHostBrowserCapability(code);
  if (!capability) return null;
  const inFlight = renewals.get(code);
  if (inFlight) return inFlight;

  const renewal = trpc.session.issueHostAccessToken
    .mutate({ code, browserCapability: capability })
    .then(({ hostToken }) => {
      if (getHostBrowserCapability(code) === capability) {
        setHostToken(code, hostToken);
        refreshTrpcWsBinding();
      }
    })
    .catch(() => {
      // Der bisherige Token bleibt bis zu seinem eigenen Ablauf nutzbar.
    })
    .finally(() => renewals.delete(code));
  renewals.set(code, renewal);
  return renewal;
}
