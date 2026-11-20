import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getRedis, closeRedis } from '../redis';
import {
  buildTrpcWsParticipantBudgetKey,
  buildTrpcWsSessionBudgetKey,
  TRPC_WS_GLOBAL_CONNECTIONS_KEY,
  TRPC_WS_INSTANCES_KEY,
  TRPC_WS_UPGRADE_BUCKET_PREFIX,
  TrpcWebSocketClusterBudget,
} from './trpcWebSocketClusterBudget';

describe.skipIf(process.env['RUN_REDIS_SESSION_REPLICA_TESTS'] !== '1')(
  'Gemeinsame tRPC-WebSocket-Cluster-Budgets mit echtem Redis',
  () => {
    const touchedKeys = new Set<string>([TRPC_WS_INSTANCES_KEY, TRPC_WS_GLOBAL_CONNECTIONS_KEY]);

    beforeAll(async () => {
      await getRedis().del(TRPC_WS_INSTANCES_KEY, TRPC_WS_GLOBAL_CONNECTIONS_KEY);
    });

    afterAll(async () => {
      try {
        if (touchedKeys.size > 0) {
          await getRedis().del(...touchedKeys);
        }
      } finally {
        await closeRedis();
        vi.unstubAllEnvs();
      }
    });

    it('erzwingt globales Verbindungs-, Session-, Participant- und Upgrade-Cap über zwei Instanzen', async () => {
      const nowMs = 1_700_000_000_000;
      const bucketBase = Math.floor(nowMs / 10_000);
      for (let offset = 0; offset < 6; offset += 1) {
        touchedKeys.add(`${TRPC_WS_UPGRADE_BUCKET_PREFIX}${bucketBase - offset}`);
      }
      await getRedis().del(...touchedKeys);

      const sessionCode = `S${randomUUID().slice(0, 5).toUpperCase()}`;
      const p1 = `${sessionCode}:${randomUUID()}`;
      const p2 = `${sessionCode}:${randomUUID()}`;
      touchedKeys.add(buildTrpcWsSessionBudgetKey(sessionCode));
      touchedKeys.add(buildTrpcWsParticipantBudgetKey(p1));
      touchedKeys.add(buildTrpcWsParticipantBudgetKey(p2));

      const appA = new TrpcWebSocketClusterBudget({
        instanceId: `app-a-${randomUUID()}`,
        maxClusterConnections: 3,
        maxClusterUpgradesPerMinute: 4,
        maxConnectionsPerSession: 3,
        maxConnectionsPerParticipant: 2,
        leaseTtlMs: 30_000,
        now: () => nowMs,
      });
      const appB = new TrpcWebSocketClusterBudget({
        instanceId: `app-b-${randomUUID()}`,
        maxClusterConnections: 3,
        maxClusterUpgradesPerMinute: 4,
        maxConnectionsPerSession: 3,
        maxConnectionsPerParticipant: 2,
        leaseTtlMs: 30_000,
        now: () => nowMs,
      });

      await expect(appA.admitUpgrade()).resolves.toBe('admitted');
      await expect(appB.admitUpgrade()).resolves.toBe('admitted');
      await expect(appA.admitUpgrade()).resolves.toBe('admitted');
      // 4. gleichzeitige Verbindung scheitert am globalen Verbindungs-Cap (3).
      await expect(appB.admitUpgrade()).resolves.toBe('connection-cap');

      // Participant-Cap (2) greift über App A + App B hinweg.
      await expect(appA.admitBinding({ sessionCode, participantKey: p1 })).resolves.toBe(
        'admitted',
      );
      await expect(appB.admitBinding({ sessionCode, participantKey: p1 })).resolves.toBe(
        'admitted',
      );
      await expect(appB.admitBinding({ sessionCode, participantKey: p1 })).resolves.toBe(
        'participant-cap',
      );

      // Session-Cap (3) greift beim 4. Binding über verschiedene Participants.
      await expect(appA.admitBinding({ sessionCode, participantKey: p2 })).resolves.toBe(
        'admitted',
      );
      await expect(appB.admitBinding({ sessionCode, participantKey: p2 })).resolves.toBe(
        'session-cap',
      );

      // Freigabe erlaubt neues Upgrade bis zum Minutenbudget (4), das 5. innerhalb der Minute wird 429.
      await appA.releaseConnection();
      await expect(appB.admitUpgrade()).resolves.toBe('admitted');
      await appB.releaseConnection();
      await expect(appB.admitUpgrade()).resolves.toBe('rate-limited');

      await appA.releaseBinding({ sessionCode, participantKey: p1 });
      await expect(appB.admitBinding({ sessionCode, participantKey: p2 })).resolves.toBe(
        'admitted',
      );

      await appA.close();
      await appB.close();
    });

    it('bereinigt Reservierungen einer abgestürzten Instanz nach Lease-Ablauf automatisch', async () => {
      let nowMs = 1_800_000_000_000;
      const bucketBase = Math.floor(nowMs / 10_000);
      for (let offset = 0; offset <= 6; offset += 1) {
        touchedKeys.add(`${TRPC_WS_UPGRADE_BUCKET_PREFIX}${bucketBase + offset}`);
      }

      const sessionCode = `C${randomUUID().slice(0, 5).toUpperCase()}`;
      const participantKey = `${sessionCode}:${randomUUID()}`;
      touchedKeys.add(buildTrpcWsSessionBudgetKey(sessionCode));
      touchedKeys.add(buildTrpcWsParticipantBudgetKey(participantKey));

      const crashedApp = new TrpcWebSocketClusterBudget({
        instanceId: `crashed-${randomUUID()}`,
        maxClusterConnections: 1,
        maxClusterUpgradesPerMinute: 100,
        maxConnectionsPerSession: 1,
        maxConnectionsPerParticipant: 1,
        leaseTtlMs: 5_000,
        now: () => nowMs,
      });
      const healthyApp = new TrpcWebSocketClusterBudget({
        instanceId: `healthy-${randomUUID()}`,
        maxClusterConnections: 1,
        maxClusterUpgradesPerMinute: 100,
        maxConnectionsPerSession: 1,
        maxConnectionsPerParticipant: 1,
        leaseTtlMs: 5_000,
        now: () => nowMs,
      });

      await expect(crashedApp.admitUpgrade()).resolves.toBe('admitted');
      await expect(crashedApp.admitBinding({ sessionCode, participantKey })).resolves.toBe(
        'admitted',
      );

      // Solange der Lease von crashedApp noch gültig ist, blockiert healthyApp.
      await expect(healthyApp.admitUpgrade()).resolves.toBe('connection-cap');
      await expect(healthyApp.admitBinding({ sessionCode, participantKey })).resolves.toBe(
        'session-cap',
      );

      // Prozessverlust ohne close(): nach Ablauf von leaseTtlMs übernimmt healthyApp nahtlos.
      nowMs += 6_000;
      await expect(healthyApp.admitUpgrade()).resolves.toBe('admitted');
      await expect(healthyApp.admitBinding({ sessionCode, participantKey })).resolves.toBe(
        'admitted',
      );

      await healthyApp.close();
    });
  },
);
