import { afterEach, describe, expect, it, vi } from 'vitest';

const sharedRedisStore = new Map<string, { value: string; expiresAt: number }>();

vi.mock('../redis', () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn(async (key: string) => {
      const entry = sharedRedisStore.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        sharedRedisStore.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(
      async (key: string, value: string, pxMode?: string, ttlMs?: number, nxMode?: string) => {
        const existing = sharedRedisStore.get(key);
        if (existing && existing.expiresAt <= Date.now()) {
          sharedRedisStore.delete(key);
        }
        if (nxMode === 'NX' && sharedRedisStore.has(key)) {
          return null;
        }
        const expiresAt =
          Date.now() + (pxMode === 'PX' && typeof ttlMs === 'number' ? ttlMs : 60_000);
        sharedRedisStore.set(key, { value, expiresAt });
        return 'OK';
      },
    ),
    exists: vi.fn(async (key: string) => {
      const entry = sharedRedisStore.get(key);
      if (!entry) return 0;
      if (entry.expiresAt <= Date.now()) {
        sharedRedisStore.delete(key);
        return 0;
      }
      return 1;
    }),
    eval: vi.fn(
      async (script: string, _numKeys: number, key: string, owner: string, ttlMs?: number) => {
        const entry = sharedRedisStore.get(key);
        if (!entry || entry.value !== owner) return 0;
        if (script.includes('PEXPIRE')) {
          entry.expiresAt = Date.now() + Number(ttlMs ?? 30_000);
          return 1;
        }
        sharedRedisStore.delete(key);
        return 1;
      },
    ),
  })),
}));

import { resolveOpenWeightLlmConfig } from './openWeightLlmConfig';
import { resetOpenWeightLlmClientForTests } from './openWeightLlmClient';
import {
  getOpenWeightLlmRuntimeProbe,
  OPEN_WEIGHT_LLM_PROBE_CACHE_TTL_MS,
  resetOpenWeightLlmRuntimeProbeForTests,
} from './openWeightLlmRuntimeProbe';

const enabledEnv = {
  OPEN_WEIGHT_LLM_ENABLED: 'true',
  OPEN_WEIGHT_LLM_URL: 'http://127.0.0.1:8080',
  OPEN_WEIGHT_LLM_TOKEN: 'a'.repeat(32),
} as NodeJS.ProcessEnv;

afterEach(() => {
  sharedRedisStore.clear();
  resetOpenWeightLlmClientForTests();
  resetOpenWeightLlmRuntimeProbeForTests();
});

describe('getOpenWeightLlmRuntimeProbe', () => {
  it('meldet disabled ohne Runtime-Aufruf', async () => {
    const inspect = vi.fn();
    const result = await getOpenWeightLlmRuntimeProbe({
      env: { OPEN_WEIGHT_LLM_ENABLED: 'false' },
      inspect,
    });
    expect(result).toMatchObject({
      enabled: false,
      overall: 'disabled',
      cache: 'skipped',
      modelAlias: null,
      modelReported: null,
    });
    expect(Object.values(result.tasks).every(({ status }) => status === 'disabled')).toBe(true);
    expect(inspect).not.toHaveBeenCalled();
  });

  it('fragt nur den Modellslot ab und reserviert keine Inferenz', async () => {
    const request = vi.fn(async () => ({ status: 200, body: '[]' }));
    resetOpenWeightLlmClientForTests({
      config: () => resolveOpenWeightLlmConfig(enabledEnv),
      request,
    });
    const result = await getOpenWeightLlmRuntimeProbe({ env: enabledEnv });
    expect(result.overall).toBe('ok');
    expect(result.modelReported).toBeNull();
    expect(result.modelAlias).toBeTruthy();
    expect(Object.values(result.tasks)).toEqual(
      Array.from({ length: 3 }, () => ({
        status: 'unknown',
        elapsedMs: null,
        reason: 'availability_only',
      })),
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ method: 'GET', path: '/slots?fail_on_no_slot=1', body: null }),
    );
    expect(sharedRedisStore.size).toBe(0);
  });

  it.each([
    ['busy', 'busy'],
    ['unavailable', 'unavailable'],
    ['misconfigured', 'degraded'],
    ['circuit_open', 'degraded'],
  ] as const)('ordnet Runtime-Status %s als %s ein', async (status, overall) => {
    const inspect = vi.fn(async () => status);
    const result = await getOpenWeightLlmRuntimeProbe({ env: enabledEnv, inspect });
    expect(inspect).toHaveBeenCalledExactlyOnceWith({ reportBusy: true });
    expect(result.overall).toBe(overall);
  });

  it('behält den Mindestabstand bei refresh und misst nach Ablauf erneut', async () => {
    let nowMs = Date.parse('2026-10-14T03:00:00.000Z');
    const inspect = vi.fn(async () => 'ready' as const);
    const options = { env: enabledEnv, inspect, now: () => nowMs };
    expect((await getOpenWeightLlmRuntimeProbe(options)).cache).toBe('live');
    expect((await getOpenWeightLlmRuntimeProbe({ ...options, refresh: true })).cache).toBe('fresh');
    nowMs += OPEN_WEIGHT_LLM_PROBE_CACHE_TTL_MS;
    expect((await getOpenWeightLlmRuntimeProbe(options)).cache).toBe('live');
    expect(inspect).toHaveBeenCalledTimes(2);
  });

  it('prüft das Rate-Limit einmal für parallele Aufrufe', async () => {
    let release: (() => void) | undefined;
    const beforeLiveMeasurement = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const inspect = vi.fn(async () => 'ready' as const);
    const options = { env: enabledEnv, inspect, beforeLiveMeasurement };
    const requests = Array.from({ length: 120 }, () => getOpenWeightLlmRuntimeProbe(options));
    expect(beforeLiveMeasurement).toHaveBeenCalledTimes(1);
    expect(inspect).not.toHaveBeenCalled();
    release?.();
    const results = await Promise.all(requests);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(new Set(results.map(({ checkedAt }) => checkedAt)).size).toBe(1);
  });

  it('fragt nach einem abgelehnten Rate-Limit erst beim nächsten erlaubten Aufruf ab', async () => {
    const inspect = vi.fn(async () => 'ready' as const);
    const options = { env: enabledEnv, inspect };
    const rateError = new Error('rate limit');
    await expect(
      getOpenWeightLlmRuntimeProbe({
        ...options,
        beforeLiveMeasurement: vi.fn().mockRejectedValue(rateError),
      }),
    ).rejects.toThrow(rateError);
    expect(inspect).not.toHaveBeenCalled();
    expect((await getOpenWeightLlmRuntimeProbe(options)).overall).toBe('ok');
  });

  it('teilt Ergebnisse über Redis und verwendet keine alten Inferenzprobe-Ergebnisse', async () => {
    const inspect = vi.fn(async () => 'ready' as const);
    const env = { ...enabledEnv, OPEN_WEIGHT_LLM_SHARED_SLOT_ENABLED: 'true' };
    const options = { env, inspect };
    sharedRedisStore.set('llm:probe:cache:v1', {
      expiresAt: Date.now() + 60_000,
      value: JSON.stringify({
        expiresAt: Date.now() + 60_000,
        value: {
          enabled: true,
          overall: 'busy',
          checkedAt: null,
          cache: 'live',
          modelAlias: null,
          modelReported: null,
          tasks: Object.fromEntries(
            ['topic_label', 'qa_summary', 'learning_objectives'].map((task) => [
              task,
              { status: 'busy', elapsedMs: null, reason: 'busy' },
            ]),
          ),
        },
      }),
    });

    expect(await getOpenWeightLlmRuntimeProbe(options)).toMatchObject({
      cache: 'live',
      overall: 'ok',
    });
    resetOpenWeightLlmRuntimeProbeForTests();
    const follower = await getOpenWeightLlmRuntimeProbe({ ...options, refresh: true });
    expect(follower).toMatchObject({ cache: 'fresh', overall: 'ok' });
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it('meldet bei laufender Nachbarprüfung vorläufig unknown und übernimmt danach den Cache', async () => {
    let complete: (() => void) | undefined;
    const env = { ...enabledEnv, OPEN_WEIGHT_LLM_SHARED_SLOT_ENABLED: 'true' };
    const inspect = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      return 'ready' as const;
    });
    const leader = getOpenWeightLlmRuntimeProbe({ env, inspect });
    await vi.waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));
    resetOpenWeightLlmRuntimeProbeForTests();

    const follower = await getOpenWeightLlmRuntimeProbe({
      env,
      inspect,
      sharedWaitTimeoutMs: 50,
      sharedPollIntervalMs: 10,
    });
    expect(follower).toMatchObject({ overall: 'unknown', cache: 'live' });
    expect(inspect).toHaveBeenCalledTimes(1);
    complete?.();
    await expect(leader).resolves.toMatchObject({ overall: 'ok' });
    await expect(getOpenWeightLlmRuntimeProbe({ env, inspect })).resolves.toMatchObject({
      overall: 'ok',
      cache: 'fresh',
    });
    expect(inspect).toHaveBeenCalledTimes(1);
  });
});
