/** Öffentliche Erreichbarkeitsprüfung der privaten Runtime über ihre Slot-Sonde. */
import {
  OpenWeightLlmRuntimeProbeSchema,
  type OpenWeightLlmProbeTaskResult,
  type OpenWeightLlmProbeTaskStatus,
  type OpenWeightLlmRuntimeProbeDTO,
} from '@arsnova/shared-types';
import { isOpenWeightLlmEnabled, OPEN_WEIGHT_LLM_MODEL_ALIAS } from './openWeightLlmConfig';
import { inspectOpenWeightLlmAvailability } from './openWeightLlmClient';
import { getRedis } from '../redis';
import { acquireRedisLease, type RedisLease } from './redisLease';

/** Ergebnis-Cache und Mindestabstand zwischen Live-Messungen (auch bei refresh). */
export const OPEN_WEIGHT_LLM_PROBE_CACHE_TTL_MS = 5 * 60_000;
const OPEN_WEIGHT_LLM_PROBE_SHARED_CACHE_KEY = 'llm:probe:cache:v2';
const OPEN_WEIGHT_LLM_PROBE_SHARED_INFLIGHT_KEY = 'llm:probe:inflight:v2';
const OPEN_WEIGHT_LLM_PROBE_INFLIGHT_TTL_MS = 30_000;
const OPEN_WEIGHT_LLM_PROBE_INFLIGHT_REFRESH_MS = 10_000;
const OPEN_WEIGHT_LLM_PROBE_REDIS_TIMEOUT_MS = 1_000;
const OPEN_WEIGHT_LLM_PROBE_FOLLOWER_WAIT_MS = 4_000;
const OPEN_WEIGHT_LLM_PROBE_FOLLOWER_POLL_MS = 200;
type ProbeHooks = {
  readonly now?: () => number;
  readonly inspect?: typeof inspectOpenWeightLlmAvailability;
  readonly env?: NodeJS.ProcessEnv;
  readonly sharedWaitTimeoutMs?: number;
  readonly sharedPollIntervalMs?: number;
  /** Der Single-Flight-Leader prüft das Rate-Limit vor der Slot-Sonde. */
  readonly beforeLiveMeasurement?: () => Promise<void>;
};

type CachedProbeEntry = {
  readonly value: OpenWeightLlmRuntimeProbeDTO;
  readonly expiresAt: number;
};

let cachedProbe: CachedProbeEntry | null = null;
let probeInFlight: Promise<OpenWeightLlmRuntimeProbeDTO> | null = null;

function shouldUseSharedProbeCoordination(env: NodeJS.ProcessEnv): boolean {
  return (
    env['OPEN_WEIGHT_LLM_SHARED_SLOT_ENABLED'] === 'true' ||
    env['SESSION_STATUS_PUBSUB_ENABLED'] === 'true'
  );
}

function withRedisTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('probe redis timeout')),
      OPEN_WEIGHT_LLM_PROBE_REDIS_TIMEOUT_MS,
    );
    timer.unref();
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function readSharedCachedProbe(nowMs: number): Promise<CachedProbeEntry | null> {
  const raw = await withRedisTimeout(getRedis().get(OPEN_WEIGHT_LLM_PROBE_SHARED_CACHE_KEY));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { value?: unknown; expiresAt?: unknown };
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= nowMs) {
      return null;
    }
    const value = OpenWeightLlmRuntimeProbeSchema.parse(parsed.value);
    return { value, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

async function writeSharedCachedProbe(entry: CachedProbeEntry, nowMs: number): Promise<void> {
  const ttlMs = Math.max(1_000, entry.expiresAt - nowMs);
  await withRedisTimeout(
    getRedis().set(OPEN_WEIGHT_LLM_PROBE_SHARED_CACHE_KEY, JSON.stringify(entry), 'PX', ttlMs),
  );
}

function probeResult(
  overall: OpenWeightLlmProbeTaskStatus,
  checkedAt: string,
): OpenWeightLlmRuntimeProbeDTO {
  const enabled = overall !== 'disabled';
  const task: OpenWeightLlmProbeTaskResult = {
    status: enabled ? 'unknown' : 'disabled',
    elapsedMs: null,
    reason: enabled ? 'availability_only' : 'disabled',
  };
  return OpenWeightLlmRuntimeProbeSchema.parse({
    enabled,
    overall,
    checkedAt,
    cache: enabled ? 'live' : 'skipped',
    modelAlias: enabled ? OPEN_WEIGHT_LLM_MODEL_ALIAS : null,
    modelReported: null,
    tasks: { topic_label: task, qa_summary: task, learning_objectives: task },
  });
}

async function measureProbe(hooks: ProbeHooks): Promise<OpenWeightLlmRuntimeProbeDTO> {
  const now = hooks.now ?? Date.now;
  const checkedAt = new Date(now()).toISOString();
  const inspect = hooks.inspect ?? inspectOpenWeightLlmAvailability;
  const status = await inspect({ reportBusy: true }).catch(() => 'unavailable' as const);
  switch (status) {
    case 'ready':
      return probeResult('ok', checkedAt);
    case 'circuit_open':
    case 'misconfigured':
      return probeResult('degraded', checkedAt);
    default:
      return probeResult(status, checkedAt);
  }
}

export function resetOpenWeightLlmRuntimeProbeForTests(): void {
  cachedProbe = null;
  probeInFlight = null;
}

export async function getOpenWeightLlmRuntimeProbe(
  options: ProbeHooks & { readonly refresh?: boolean } = {},
): Promise<OpenWeightLlmRuntimeProbeDTO> {
  const now = options.now ?? Date.now;
  const env = options.env ?? process.env;
  if (!isOpenWeightLlmEnabled(env['OPEN_WEIGHT_LLM_ENABLED'])) {
    const value = probeResult('disabled', new Date(now()).toISOString());
    cachedProbe = { value, expiresAt: now() + OPEN_WEIGHT_LLM_PROBE_CACHE_TTL_MS };
    return value;
  }

  // Auch refresh respektiert den Mindestabstand für die Slot-Sonde.
  if (cachedProbe && cachedProbe.expiresAt > now()) {
    return OpenWeightLlmRuntimeProbeSchema.parse({
      ...cachedProbe.value,
      cache: 'fresh',
    });
  }

  if (probeInFlight) {
    return probeInFlight;
  }

  // Claim vor jedem await: parallele Burst-Requests coalescen auf dasselbe Promise;
  // beforeLiveMeasurement (Rate-Limit) läuft nur beim Leader und darf weiter werfen
  // (TOO_MANY_REQUESTS). measureProbe selbst liefert nur strukturierte DTOs.
  const beforeLive = options.beforeLiveMeasurement;
  const useShared = shouldUseSharedProbeCoordination(env);
  probeInFlight = (async () => {
    if (useShared) {
      try {
        const sharedHit = await readSharedCachedProbe(now());
        if (sharedHit) {
          cachedProbe = sharedHit;
          return OpenWeightLlmRuntimeProbeSchema.parse({
            ...sharedHit.value,
            cache: 'fresh',
          });
        }
      } catch {
        // Redis temporär nicht erreichbar -> kontrollierter lokaler Fallback
      }

      let lease: RedisLease | null = null;
      let redisCoordinationAvailable = true;
      try {
        lease = await withRedisTimeout(
          acquireRedisLease(
            OPEN_WEIGHT_LLM_PROBE_SHARED_INFLIGHT_KEY,
            OPEN_WEIGHT_LLM_PROBE_INFLIGHT_TTL_MS,
          ),
        );
      } catch {
        redisCoordinationAvailable = false;
      }

      if (redisCoordinationAvailable && !lease) {
        const waitBudgetMs = Math.max(
          50,
          options.sharedWaitTimeoutMs ?? OPEN_WEIGHT_LLM_PROBE_FOLLOWER_WAIT_MS,
        );
        const pollIntervalMs = Math.max(
          10,
          options.sharedPollIntervalMs ?? OPEN_WEIGHT_LLM_PROBE_FOLLOWER_POLL_MS,
        );
        const deadline = Date.now() + waitBudgetMs;

        while (Date.now() < deadline) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, pollIntervalMs);
            timer.unref();
          });

          try {
            const sharedHit = await readSharedCachedProbe(now());
            if (sharedHit) {
              cachedProbe = sharedHit;
              return OpenWeightLlmRuntimeProbeSchema.parse({
                ...sharedHit.value,
                cache: 'fresh',
              });
            }

            const stillRunning = await withRedisTimeout(
              getRedis().exists(OPEN_WEIGHT_LLM_PROBE_SHARED_INFLIGHT_KEY),
            );
            if (stillRunning === 0) {
              lease = await withRedisTimeout(
                acquireRedisLease(
                  OPEN_WEIGHT_LLM_PROBE_SHARED_INFLIGHT_KEY,
                  OPEN_WEIGHT_LLM_PROBE_INFLIGHT_TTL_MS,
                ),
              );
              if (lease) break;
            }
          } catch {
            // Redis nicht mehr lesbar -> Follower meldet den Status vorläufig als unbekannt.
            break;
          }
        }

        if (!lease) {
          // Bewusst NICHT in cachedProbe schreiben, damit das echte Leader-Ergebnis
          // sofort beim nächsten Aufruf aus dem gemeinsamen Cache übernommen wird.
          return probeResult('unknown', new Date(now()).toISOString());
        }
      }

      if (lease) {
        const activeLease = lease;
        const refreshTimer = setInterval(() => {
          void activeLease.refresh().catch(() => undefined);
        }, OPEN_WEIGHT_LLM_PROBE_INFLIGHT_REFRESH_MS);
        refreshTimer.unref();
        try {
          if (beforeLive) {
            await beforeLive();
          }
          const value = await measureProbe(options);
          const entry: CachedProbeEntry = {
            value,
            expiresAt: now() + OPEN_WEIGHT_LLM_PROBE_CACHE_TTL_MS,
          };
          cachedProbe = entry;
          await writeSharedCachedProbe(entry, now()).catch(() => undefined);
          return value;
        } finally {
          clearInterval(refreshTimer);
          await activeLease.release().catch(() => undefined);
        }
      }
    }

    if (beforeLive) {
      await beforeLive();
    }
    const value = await measureProbe(options);
    cachedProbe = { value, expiresAt: now() + OPEN_WEIGHT_LLM_PROBE_CACHE_TTL_MS };
    return value;
  })().finally(() => {
    probeInFlight = null;
  });

  return probeInFlight;
}
