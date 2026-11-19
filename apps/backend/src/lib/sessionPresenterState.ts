import {
  FreetextWordCloudPresenterProjectionDTOSchema,
  PresenterPageSchema,
  QaWordCloudPresenterProjectionDTOSchema,
  SessionPresenterSurfaceSchema,
  SetQaPresenterSortModeOutputSchema,
} from '@arsnova/shared-types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getRedis } from '../redis';
import {
  buildSessionPresenterStateKey,
  buildSessionRuntimeDataPurgeFenceKey,
  SESSION_EPHEMERAL_STATE_TTL_SECONDS,
} from './sessionRuntimeDataPurge';
import { isSessionPubSubEnabled } from './sessionStatusPubSub';

const SessionPresenterStateSchema = z.strictObject({
  surface: SessionPresenterSurfaceSchema.optional(),
  finishedQaWordCloud: z.boolean().optional(),
  page: PresenterPageSchema.optional(),
  pageIdentity: z.string().optional(),
  qaProjection: QaWordCloudPresenterProjectionDTOSchema.optional(),
  freetextProjection: FreetextWordCloudPresenterProjectionDTOSchema.optional(),
  qaStageView: SetQaPresenterSortModeOutputSchema.required().optional(),
});

export type SessionPresenterState = z.infer<typeof SessionPresenterStateSchema>;
const localStates = new Map<string, SessionPresenterState>();
const MAX_UPDATE_ATTEMPTS = 16;

const UPDATE_PRESENTER_STATE = `
-- session_presenter_state_cas_v1
if redis.call('EXISTS', KEYS[2]) == 1 then return -1 end
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

function unavailable(cause?: unknown): TRPCError {
  return new TRPCError({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Die Präsentationsansicht ist vorübergehend nicht verfügbar.',
    cause,
  });
}

export async function readSessionPresenterState(sessionId: string): Promise<SessionPresenterState> {
  if (!isSessionPubSubEnabled()) return localStates.get(sessionId) ?? {};
  try {
    const stored = await getRedis().get(buildSessionPresenterStateKey(sessionId));
    return stored === null ? {} : SessionPresenterStateSchema.parse(JSON.parse(stored));
  } catch (cause) {
    throw unavailable(cause);
  }
}

/** Auch bei konkurrierenden Apps gilt die Änderung für den zuletzt gelesenen Zustand. */
export async function updateSessionPresenterState<T>(
  sessionId: string,
  apply: (state: SessionPresenterState) => T,
): Promise<T> {
  if (!isSessionPubSubEnabled()) {
    const state = { ...localStates.get(sessionId) };
    const result = apply(state);
    localStates.set(sessionId, state);
    return result;
  }
  const redis = getRedis();
  const key = buildSessionPresenterStateKey(sessionId);
  const fence = buildSessionRuntimeDataPurgeFenceKey(sessionId);
  for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
    let stored: string | null;
    let state: SessionPresenterState;
    try {
      stored = await redis.get(key);
      state = stored === null ? {} : SessionPresenterStateSchema.parse(JSON.parse(stored));
    } catch (cause) {
      throw unavailable(cause);
    }
    const before = JSON.stringify(state);
    const result = apply(state);
    const after = JSON.stringify(state);
    if (before === after) return result;
    let updated: unknown;
    try {
      updated = await redis.eval(
        UPDATE_PRESENTER_STATE,
        2,
        key,
        fence,
        stored ?? '',
        after,
        SESSION_EPHEMERAL_STATE_TTL_SECONDS,
      );
    } catch (cause) {
      throw unavailable(cause);
    }
    if (updated === 1) return result;
    if (updated === -1)
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
    if (updated !== 0) throw unavailable();
  }
  throw new TRPCError({
    code: 'CONFLICT',
    message: 'Die Projektionsfläche wurde zwischenzeitlich geändert.',
  });
}

export function clearLocalSessionPresenterState(sessionId?: string): void {
  if (sessionId === undefined) localStates.clear();
  else localStates.delete(sessionId);
}
