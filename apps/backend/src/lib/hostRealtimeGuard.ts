/**
 * Beendet Host-Realtime für ein widerrufenes Paired-Host-Token,
 * ohne bestehende Original-Host-Subscriptions zu verändern.
 */
import { TRPCError } from '@trpc/server';
import { isHostSessionTokenValid, resolveHostSessionAccess } from './hostAuth';
import { subscribePairedHostTokenInvalidation } from './hostPairing';

export const HOST_CONNECTION_ENDED_MESSAGE = 'Die Host-Verbindung wurde beendet.';

function hostConnectionEndedError(): TRPCError {
  return new TRPCError({
    code: 'UNAUTHORIZED',
    message: HOST_CONNECTION_ENDED_MESSAGE,
  });
}

/**
 * Wartet auf das nächste Realtime-Tick. Ein PAIRED_HOST-Token wird
 * bei Widerruf sofort ungültig — auch bei schon offener Subscription.
 */
export async function waitWhileHostTokenValid(
  sessionCode: string,
  token: string | undefined,
  waiter: () => Promise<void>,
): Promise<void> {
  if (!token) {
    throw hostConnectionEndedError();
  }
  const access = await resolveHostSessionAccess(sessionCode, token);
  if (!access) {
    throw hostConnectionEndedError();
  }

  if (access.role !== 'PAIRED_HOST') {
    await waiter();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const unsubscribe = subscribePairedHostTokenInvalidation(sessionCode, token, () => {
      unsubscribe();
      reject(hostConnectionEndedError());
    });
    void isHostSessionTokenValid(sessionCode, token).then(
      (valid) => {
        if (!valid) {
          unsubscribe();
          reject(hostConnectionEndedError());
          return;
        }
        void waiter().then(
          () => {
            unsubscribe();
            resolve();
          },
          (error: unknown) => {
            unsubscribe();
            reject(error);
          },
        );
      },
      (error: unknown) => {
        unsubscribe();
        reject(error);
      },
    );
  });

  if (!(await isHostSessionTokenValid(sessionCode, token))) {
    throw hostConnectionEndedError();
  }
}
