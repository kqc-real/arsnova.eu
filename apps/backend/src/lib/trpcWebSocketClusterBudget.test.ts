import { describe, expect, it } from 'vitest';
import type Redis from 'ioredis';
import {
  buildTrpcWsParticipantBudgetKey,
  buildTrpcWsSessionBudgetKey,
  TRPC_WS_GLOBAL_CONNECTIONS_KEY,
  TRPC_WS_INSTANCES_KEY,
  TrpcWebSocketClusterBudget,
} from './trpcWebSocketClusterBudget';

function createInMemoryClusterRedis(options?: {
  delayAdmitMs?: () => number;
  delayExecuteAdmitMs?: () => number;
}) {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, number>>();
  const zsets = new Map<string, Map<string, number>>();

  const zremrangebyscore = (key: string, maxScore: number) => {
    const zset = zsets.get(key);
    if (!zset) return;
    for (const [member, score] of zset) {
      if (score <= maxScore) zset.delete(member);
    }
  };

  const sumLiveHash = (instancesKey: string, hashKey: string, selfId: string): number => {
    const hash = hashes.get(hashKey);
    if (!hash) return 0;
    const live = zsets.get(instancesKey) ?? new Map<string, number>();
    let total = 0;
    for (const [ownerId, count] of [...hash.entries()]) {
      if (count <= 0) {
        hash.delete(ownerId);
      } else if (ownerId === selfId || live.has(ownerId)) {
        total += count;
      } else {
        hash.delete(ownerId);
      }
    }
    return total;
  };

  const hincrby = (hashKey: string, field: string, delta: number): number => {
    const hash = hashes.get(hashKey) ?? new Map<string, number>();
    const next = (hash.get(field) ?? 0) + delta;
    hash.set(field, next);
    hashes.set(hashKey, hash);
    return next;
  };

  const hdel = (hashKey: string, field: string): void => {
    const hash = hashes.get(hashKey);
    if (!hash) return;
    hash.delete(field);
    if (hash.size === 0) hashes.delete(hashKey);
  };

  const client: Pick<Redis, 'eval' | 'zadd' | 'pexpire'> = {
    zadd: (async (key: string, score: number, member: string) => {
      const zset = zsets.get(key) ?? new Map<string, number>();
      zset.set(member, Number(score));
      zsets.set(key, zset);
      return 1;
    }) as unknown as Redis['zadd'],
    pexpire: (async () => 1) as unknown as Redis['pexpire'],
    eval: (async (script: string, numKeys: number, ...rest: string[]) => {
      const keys = rest.slice(0, numKeys);
      const argv = rest.slice(numKeys);
      const isAdmit =
        script.includes('return activeConnections + 1') || script.includes('maxSession');

      if (isAdmit) {
        const preDelay = options?.delayExecuteAdmitMs?.() ?? 0;
        if (preDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, preDelay));
        }
      }

      let result: number;
      if (script.includes('return activeConnections + 1')) {
        // ADMIT_UPGRADE_LUA
        const instancesKey = keys[0]!;
        const globalKey = keys[1]!;
        const reservationKey = keys[8]!;
        const instanceId = argv[0]!;
        const nowMs = Number(argv[1]);
        const leaseTtlMs = Number(argv[2]);
        const maxUpgrades = Number(argv[3]);
        const maxConnections = Number(argv[4]);

        const state = strings.get(reservationKey);
        if (state === 'released') {
          result = -3;
        } else if (state === 'admitted') {
          result = 1;
        } else {
          zremrangebyscore(instancesKey, nowMs);
          const live = zsets.get(instancesKey) ?? new Map<string, number>();
          live.set(instanceId, nowMs + leaseTtlMs);
          zsets.set(instancesKey, live);

          let upgrades = 0;
          for (let i = 2; i <= 7; i += 1) {
            upgrades += Number(strings.get(keys[i]!) ?? 0);
          }
          if (upgrades >= maxUpgrades) {
            result = -1;
          } else {
            const active = sumLiveHash(instancesKey, globalKey, instanceId);
            if (active >= maxConnections) {
              result = -2;
            } else {
              strings.set(reservationKey, 'admitted');
              strings.set(keys[7]!, String(Number(strings.get(keys[7]!) ?? 0) + 1));
              hincrby(globalKey, instanceId, 1);
              result = active + 1;
            }
          }
        }
      } else if (script.includes('maxSession')) {
        // ADMIT_BINDING_LUA
        const instancesKey = keys[0]!;
        const reservationKey = keys[1]!;
        const sessionKey = keys[2]!;
        const participantKey = keys[3];
        const instanceId = argv[0]!;
        const nowMs = Number(argv[1]);
        const leaseTtlMs = Number(argv[2]);
        const maxSession = Number(argv[3]);
        const maxParticipant = Number(argv[4]);

        const state = strings.get(reservationKey);
        if (state === 'released') {
          result = -3;
        } else if (state === 'admitted') {
          result = 1;
        } else {
          zremrangebyscore(instancesKey, nowMs);
          const live = zsets.get(instancesKey) ?? new Map<string, number>();
          live.set(instanceId, nowMs + leaseTtlMs);
          zsets.set(instancesKey, live);

          if (sumLiveHash(instancesKey, sessionKey, instanceId) >= maxSession) {
            result = -1;
          } else if (
            participantKey &&
            sumLiveHash(instancesKey, participantKey, instanceId) >= maxParticipant
          ) {
            result = -2;
          } else {
            strings.set(reservationKey, 'admitted');
            hincrby(sessionKey, instanceId, 1);
            if (participantKey) hincrby(participantKey, instanceId, 1);
            result = 1;
          }
        }
      } else if (script.includes('hasReservation')) {
        // RELEASE_BINDING_LUA
        const instanceId = argv[0]!;
        const hasReservation = argv[1] === '1';
        let startIdx = 0;
        let shouldDecrement = true;
        if (hasReservation) {
          const reservationKey = keys[0]!;
          const state = strings.get(reservationKey);
          if (state === 'released') {
            shouldDecrement = false;
          } else {
            strings.set(reservationKey, 'released');
            if (state !== 'admitted') {
              shouldDecrement = false;
            }
          }
          startIdx = 1;
        }
        if (!shouldDecrement) {
          result = 0;
        } else {
          for (let i = startIdx; i < keys.length; i += 1) {
            const rem = hincrby(keys[i]!, instanceId, -1);
            if (rem <= 0) hdel(keys[i]!, instanceId);
          }
          result = 1;
        }
      } else if (script.includes('ZREM')) {
        zsets.get(keys[0]!)?.delete(argv[0]!);
        hdel(keys[1]!, argv[0]!);
        result = 1;
      } else {
        // RELEASE_CONNECTION_LUA
        const globalKey = keys[0]!;
        const reservationKey = keys[1];
        const instanceId = argv[0]!;
        let shouldDecrement = true;
        if (reservationKey) {
          const state = strings.get(reservationKey);
          if (state === 'released') {
            shouldDecrement = false;
          } else {
            strings.set(reservationKey, 'released');
            if (state !== 'admitted') {
              shouldDecrement = false;
            }
          }
        }
        if (!shouldDecrement) {
          result = 0;
        } else {
          const rem = hincrby(globalKey, instanceId, -1);
          if (rem <= 0) {
            hdel(globalKey, instanceId);
            result = 0;
          } else {
            result = rem;
          }
        }
      }

      if (isAdmit) {
        const postDelay = options?.delayAdmitMs?.() ?? 0;
        if (postDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, postDelay));
        }
      }
      return result;
    }) as unknown as Redis['eval'],
  };

  return {
    client,
    getHashSum(key: string): number {
      const hash = hashes.get(key);
      if (!hash) return 0;
      let total = 0;
      for (const value of hash.values()) total += value;
      return total;
    },
    zsets,
  };
}

describe('TrpcWebSocketClusterBudget', () => {
  it('kompensiert verspätet nach lokalem Timeout erfolgreiche Upgrade- und Binding-EVALs vollständig', async () => {
    let slowAdmit = true;
    // Simuliert: Redis führt ADMIT sofort aus, liefert die Antwort aber erst nach 80 ms (> 25 ms Timeout).
    const store = createInMemoryClusterRedis({
      delayAdmitMs: () => (slowAdmit ? 80 : 0),
    });

    const budget = new TrpcWebSocketClusterBudget({
      instanceId: 'app-a',
      maxClusterConnections: 2,
      maxClusterUpgradesPerMinute: 20,
      maxConnectionsPerSession: 2,
      maxConnectionsPerParticipant: 2,
      operationTimeoutMs: 25,
      redisProvider: () => store.client,
    });

    const sessionCode = 'ABC123';
    const participantKey = 'ABC123:11111111-1111-4111-8111-111111111111';

    // Zwei Verbindungen laufen während einer Redis-Verzögerung in fallback-local,
    // während Redis im Hintergrund die Zähler zunächst gebucht hatte.
    const upg1 = await budget.admitUpgradeReservation();
    const bind1 = await budget.admitBindingReservation({ sessionCode, participantKey });
    const upg2 = await budget.admitUpgradeReservation();
    const bind2 = await budget.admitBindingReservation({ sessionCode, participantKey });

    expect(upg1).toEqual({ decision: 'fallback-local', reservationId: null });
    expect(bind1).toEqual({ decision: 'fallback-local', reservationId: null });
    expect(upg2).toEqual({ decision: 'fallback-local', reservationId: null });
    expect(bind2).toEqual({ decision: 'fallback-local', reservationId: null });

    // Warten bis die verspäteten EVAL-Antworten eingetroffen und automatisch kompensiert sind.
    await new Promise((resolve) => setTimeout(resolve, 120));
    await budget.flushPendingCompensations();

    expect(store.getHashSum(TRPC_WS_GLOBAL_CONNECTIONS_KEY)).toBe(0);
    expect(store.getHashSum(buildTrpcWsSessionBudgetKey(sessionCode))).toBe(0);
    expect(store.getHashSum(buildTrpcWsParticipantBudgetKey(participantKey))).toBe(0);

    // Nach Ende der Störung stehen alle 2 Participant-Slots regulären Reconnects wieder voll zur Verfügung.
    slowAdmit = false;
    await expect(budget.admitUpgrade()).resolves.toBe('admitted');
    await expect(budget.admitUpgrade()).resolves.toBe('admitted');
    await expect(budget.admitBinding({ sessionCode, participantKey })).resolves.toBe('admitted');
    await expect(budget.admitBinding({ sessionCode, participantKey })).resolves.toBe('admitted');

    await budget.close();
  });

  it('storniert noch vor der Redis-Ausführung überholte Reservierungen per Tombstone und bleibt idempotent bei Doppelfreigabe', async () => {
    let delayBeforeExec = true;
    // Simuliert: ADMIT erreicht Redis erst NACH dem Timeout-Tombstone; außerdem Doppelfreigabe einer aktiven Verbindung.
    const store = createInMemoryClusterRedis({
      delayExecuteAdmitMs: () => (delayBeforeExec ? 70 : 0),
    });

    const budget = new TrpcWebSocketClusterBudget({
      instanceId: 'app-b',
      maxClusterConnections: 2,
      maxClusterUpgradesPerMinute: 20,
      maxConnectionsPerSession: 2,
      maxConnectionsPerParticipant: 2,
      operationTimeoutMs: 20,
      redisProvider: () => store.client,
    });

    const timedOut = await budget.admitUpgradeReservation();
    expect(timedOut.decision).toBe('fallback-local');
    await new Promise((resolve) => setTimeout(resolve, 100));
    await budget.flushPendingCompensations();
    expect(store.getHashSum(TRPC_WS_GLOBAL_CONNECTIONS_KEY)).toBe(0);

    // Zwei reguläre Verbindungen reservieren, erste Verbindung doppelt freigeben -> darf Verbindung 2 nicht dekrementieren!
    delayBeforeExec = false;
    const live1 = await budget.admitUpgradeReservation();
    const live2 = await budget.admitUpgradeReservation();
    expect(live1.decision).toBe('admitted');
    expect(live2.decision).toBe('admitted');
    expect(store.getHashSum(TRPC_WS_GLOBAL_CONNECTIONS_KEY)).toBe(2);

    await budget.releaseConnection(live1.reservationId);
    await budget.releaseConnection(live1.reservationId);
    expect(store.getHashSum(TRPC_WS_GLOBAL_CONNECTIONS_KEY)).toBe(1);

    await budget.releaseConnection(live2.reservationId);
    expect(store.getHashSum(TRPC_WS_GLOBAL_CONNECTIONS_KEY)).toBe(0);
    expect(store.zsets.has(TRPC_WS_INSTANCES_KEY)).toBe(true);

    await budget.close();
  });
});
