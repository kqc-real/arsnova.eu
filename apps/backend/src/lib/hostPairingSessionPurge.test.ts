import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MemoryEntry = { value: string; expiresAt?: number };

function createMemoryRedis() {
  const store = new Map<string, MemoryEntry>();
  const calls: unknown[][] = [];
  let runIds = ['a'.repeat(40)];
  let waitAof: unknown[] = [[1, 0]];
  const alive = (entry: MemoryEntry | undefined): entry is MemoryEntry => {
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) return false;
    return true;
  };
  const client = {
    async get(key: string) {
      const entry = store.get(key);
      if (!alive(entry)) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string, ...args: Array<string | number>) {
      calls.push(['SET', key, ...args]);
      let ttl: number | undefined;
      let nx = false;
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === 'EX') ttl = Number(args[index + 1]);
        if (args[index] === 'NX') nx = true;
      }
      if (nx && alive(store.get(key))) return null;
      store.set(key, { value, expiresAt: ttl ? Date.now() + ttl * 1_000 : undefined });
      return 'OK';
    },
    async del(...keys: string[]) {
      let removed = 0;
      for (const key of keys) if (store.delete(key)) removed += 1;
      return removed;
    },
    async mget(...keys: string[]) {
      return Promise.all(keys.map((key) => client.get(key)));
    },
    async scan(_cursor: string, _match: 'MATCH', pattern: string, _count: 'COUNT', _limit: number) {
      calls.push(['SCAN', pattern]);
      const prefix = pattern.slice(0, -1);
      return ['0', [...store.keys()].filter((key) => key.startsWith(prefix))] as [string, string[]];
    },
    async eval(script: string, numKeys: number, ...parameters: string[]) {
      calls.push([
        'EVAL',
        script.includes('host_pairing_raw_cas_delete_v1') ? 'raw-cas' : 'lock-release',
      ]);
      const keys = parameters.slice(0, numKeys);
      const args = parameters.slice(numKeys);
      if (script.includes('host_pairing_raw_cas_delete_v1')) {
        let deleted = 0;
        for (let index = 0; index < keys.length; index += 1) {
          if ((await client.get(keys[index]!)) === args[index]) {
            deleted += await client.del(keys[index]!);
          }
        }
        return deleted;
      }
      const [key] = keys;
      const [owner] = args;
      if (key && owner && (await client.get(key)) === owner) return client.del(key);
      return 0;
    },
    async call(command: string, ...args: unknown[]) {
      calls.push([command, ...args]);
      if (command === 'CLIENT') return '41';
      if (command === 'INFO') return `# Server\r\nrun_id:${runIds.shift() ?? 'a'.repeat(40)}\r\n`;
      if (command === 'WAITAOF') return waitAof.shift() ?? [1, 0];
      throw new Error(`Unexpected command: ${command}`);
    },
    async publish() {
      return 1;
    },
    reset() {
      store.clear();
      calls.length = 0;
      runIds = ['a'.repeat(40)];
      waitAof = [[1, 0]];
    },
    store,
    calls,
    setRunIds(values: string[]) {
      runIds = [...values];
    },
    setWaitAof(values: unknown[]) {
      waitAof = [...values];
    },
  };
  return client;
}

const memoryRedis = createMemoryRedis();
const { findSessionByCodeMock } = vi.hoisted(() => ({
  findSessionByCodeMock: vi.fn(),
}));

vi.mock('../redis', () => ({ getRedis: () => memoryRedis }));
vi.mock('../db', () => ({
  prisma: { session: { findUnique: findSessionByCodeMock } },
}));

import {
  buildHostPairingClaimKey,
  buildHostPairingInviteLookupKey,
  buildHostPairingOutcomeKey,
  buildHostPairingRequestLookupKey,
  buildHostPairingSessionIndexKey,
  buildHostPairingSessionKey,
  buildHostPairingSessionPurgeFenceKey,
  buildHostPairingTokenLookupKey,
  createHostPairingInvite,
  invalidateHostPairingForSession,
} from './hostPairing';
import {
  HOST_PAIRING_PURGE_BATCH_SIZE,
  purgeHostPairingForSessions,
} from './hostPairingSessionPurge';

const SESSION_ID = '60000000-0000-4000-8000-000000000001';
const NEW_SESSION_ID = '60000000-0000-4000-8000-000000000002';
const CODE = 'ABC123';
const originalNodeEnv = process.env.NODE_ENV;
const originalRequireDurability = process.env.HOST_PAIRING_PURGE_REQUIRE_DURABILITY;

function record(sessionId: string | null = SESSION_ID) {
  return {
    sessionId,
    version: 4,
    invite: {
      inviteId: 'invite-id',
      secretHash: 'invite-hash',
      createdAt: '2026-10-03T10:00:00.000Z',
      expiresAt: '2026-10-03T10:30:00.000Z',
      screenVisibility: 'PROJECTED',
      state: 'PENDING_APPROVAL',
    },
    pending: {
      requestId: 'request-id',
      inviteId: 'invite-id',
      requestSecretHash: 'request-hash',
      confirmationIndicator: 'Eule · 12',
      deviceLabel: 'Tablet',
      createdAt: '2026-10-03T10:00:00.000Z',
      expiresAt: '2026-10-03T10:30:00.000Z',
      state: 'PENDING_APPROVAL',
    },
    pairedHosts: [
      {
        tokenId: 'token-id',
        tokenHash: 'token-hash',
        deviceLabel: 'Phone',
        pairedAt: '2026-10-03T10:00:00.000Z',
        state: 'CONNECTED',
      },
    ],
  };
}

async function seedBoundArtifacts(sessionId = SESSION_ID, code = CODE): Promise<string[]> {
  const keys = [
    buildHostPairingInviteLookupKey('invite-hash'),
    buildHostPairingRequestLookupKey('request-hash'),
    buildHostPairingTokenLookupKey('token-hash'),
    buildHostPairingClaimKey('request-hash'),
    buildHostPairingOutcomeKey('request-hash'),
  ];
  const payloads = [
    { sessionId, sessionCode: code, inviteId: 'invite-id' },
    { sessionId, sessionCode: code, requestId: 'request-id' },
    { sessionId, sessionCode: code, tokenId: 'token-id', credentialVersion: 0 },
    {
      sessionId,
      sessionCode: code,
      requestId: 'request-id',
      tokenId: 'token-id',
      pairedHostToken: 'clear-token',
    },
    {
      sessionId,
      sessionCode: code,
      requestId: 'request-id',
      tokenId: 'token-id',
      state: 'CONNECTED',
    },
  ];
  await Promise.all(
    keys.map((key, index) => memoryRedis.set(key, JSON.stringify(payloads[index]), 'EX', 600)),
  );
  await memoryRedis.set(
    buildHostPairingSessionIndexKey(sessionId),
    JSON.stringify(keys),
    'EX',
    30_000,
  );
  return keys;
}

beforeEach(() => {
  memoryRedis.reset();
  findSessionByCodeMock.mockReset();
  findSessionByCodeMock.mockResolvedValue({ id: SESSION_ID });
  process.env.NODE_ENV = 'test';
  process.env.HOST_PAIRING_PURGE_REQUIRE_DURABILITY = '1';
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalRequireDurability === undefined) {
    delete process.env.HOST_PAIRING_PURGE_REQUIRE_DURABILITY;
  } else {
    process.env.HOST_PAIRING_PURGE_REQUIRE_DURABILITY = originalRequireDurability;
  }
});

describe('host pairing session purge', () => {
  it('setzt die Fence, löscht Record und sämtliche indexierten Artefakte und bestätigt AOF', async () => {
    const artifactKeys = await seedBoundArtifacts();
    await memoryRedis.set(buildHostPairingSessionKey(CODE), JSON.stringify(record()), 'EX', 600);

    await expect(
      purgeHostPairingForSessions([{ sessionId: SESSION_ID, sessionCode: CODE }]),
    ).resolves.toBe(artifactKeys.length + 2);

    expect(await memoryRedis.get(buildHostPairingSessionPurgeFenceKey(SESSION_ID))).toBe('1');
    expect(await memoryRedis.get(buildHostPairingSessionKey(CODE))).toBeNull();
    for (const key of artifactKeys) expect(await memoryRedis.get(key)).toBeNull();
    expect(memoryRedis.calls).toContainEqual(['WAITAOF', 1, 0, 5_000]);
    expect(
      [...memoryRedis.store.keys()].some((key) =>
        key.startsWith('host:pairing:v1:purge-durability:'),
      ),
    ).toBe(true);
  });

  it('bewahrt bei Code-Wiederverwendung den Record und die Artefakte der neuen sessionId', async () => {
    const oldKeys = await seedBoundArtifacts();
    const newTokenKey = buildHostPairingTokenLookupKey('new-token-hash');
    await memoryRedis.set(
      newTokenKey,
      JSON.stringify({
        sessionId: NEW_SESSION_ID,
        sessionCode: CODE,
        tokenId: 'new-token-id',
        credentialVersion: 0,
      }),
      'EX',
      600,
    );
    await memoryRedis.set(
      buildHostPairingSessionIndexKey(NEW_SESSION_ID),
      JSON.stringify([newTokenKey]),
      'EX',
      600,
    );
    await memoryRedis.set(
      buildHostPairingSessionKey(CODE),
      JSON.stringify({ ...record(NEW_SESSION_ID), invite: null, pending: null }),
      'EX',
      600,
    );

    await purgeHostPairingForSessions([{ sessionId: SESSION_ID, sessionCode: CODE }]);

    expect(await memoryRedis.get(buildHostPairingSessionKey(CODE))).toContain(NEW_SESSION_ID);
    expect(await memoryRedis.get(newTokenKey)).toContain(NEW_SESSION_ID);
    for (const key of oldKeys) expect(await memoryRedis.get(key)).toBeNull();
  });

  it('bereinigt sicher zuordenbare Legacy-Lookups, Claims und Outcomes', async () => {
    await memoryRedis.set(buildHostPairingSessionKey(CODE), JSON.stringify(record(null)));
    await memoryRedis.set(
      buildHostPairingInviteLookupKey('invite-hash'),
      JSON.stringify({ sessionCode: CODE, inviteId: 'invite-id' }),
    );
    await memoryRedis.set(
      buildHostPairingClaimKey('request-hash'),
      JSON.stringify({ tokenId: 'token-id', pairedHostToken: 'legacy-clear-token' }),
    );
    await memoryRedis.set(
      buildHostPairingOutcomeKey('request-hash'),
      JSON.stringify({ tokenId: 'token-id', state: 'CONNECTED' }),
    );
    const unrelated = buildHostPairingOutcomeKey('unrelated-hash');
    await memoryRedis.set(unrelated, JSON.stringify({ state: 'REJECTED' }));

    await purgeHostPairingForSessions([{ sessionId: SESSION_ID, sessionCode: CODE }]);

    expect(await memoryRedis.get(buildHostPairingSessionKey(CODE))).toBeNull();
    expect(await memoryRedis.get(buildHostPairingInviteLookupKey('invite-hash'))).toBeNull();
    expect(await memoryRedis.get(buildHostPairingClaimKey('request-hash'))).toBeNull();
    expect(await memoryRedis.get(buildHostPairingOutcomeKey('request-hash'))).toBeNull();
    expect(await memoryRedis.get(unrelated)).not.toBeNull();
  });

  it('bewahrt die Legacy-Zuordnung ueber invalidate bis zum anschliessenden Purge', async () => {
    await memoryRedis.set(buildHostPairingSessionKey(CODE), JSON.stringify(record(null)));
    await memoryRedis.set(
      buildHostPairingInviteLookupKey('invite-hash'),
      JSON.stringify({ sessionCode: CODE, inviteId: 'invite-id' }),
    );
    await memoryRedis.set(
      buildHostPairingRequestLookupKey('request-hash'),
      JSON.stringify({ sessionCode: CODE, requestId: 'request-id' }),
    );
    await memoryRedis.set(
      buildHostPairingTokenLookupKey('token-hash'),
      JSON.stringify({ sessionCode: CODE, tokenId: 'token-id', credentialVersion: 0 }),
    );
    const claimKey = buildHostPairingClaimKey('request-hash');
    const outcomeKey = buildHostPairingOutcomeKey('request-hash');
    await memoryRedis.set(
      claimKey,
      JSON.stringify({ tokenId: 'token-id', pairedHostToken: 'legacy-clear-token' }),
    );
    await memoryRedis.set(outcomeKey, JSON.stringify({ tokenId: 'token-id', state: 'CONNECTED' }));

    await invalidateHostPairingForSession(CODE);

    expect(await memoryRedis.get(buildHostPairingInviteLookupKey('invite-hash'))).toBeNull();
    expect(await memoryRedis.get(buildHostPairingRequestLookupKey('request-hash'))).toBeNull();
    expect(await memoryRedis.get(buildHostPairingTokenLookupKey('token-hash'))).toBeNull();
    expect(await memoryRedis.get(claimKey)).not.toBeNull();
    expect(await memoryRedis.get(outcomeKey)).toContain(SESSION_ID);
    expect(await memoryRedis.get(buildHostPairingSessionKey(CODE))).toContain('purgeReferences');

    await purgeHostPairingForSessions([{ sessionId: SESSION_ID, sessionCode: CODE }]);

    expect(await memoryRedis.get(buildHostPairingSessionKey(CODE))).toBeNull();
    expect(await memoryRedis.get(claimKey)).toBeNull();
    expect(await memoryRedis.get(outcomeKey)).toBeNull();
  });

  it('laesst den Host-Pairing-Record einer wiederverwendeten Session unangetastet', async () => {
    findSessionByCodeMock.mockResolvedValue({ id: NEW_SESSION_ID });
    const newRecord = JSON.stringify(record(NEW_SESSION_ID));
    await memoryRedis.set(buildHostPairingSessionKey(CODE), newRecord);

    await invalidateHostPairingForSession(CODE, SESSION_ID);

    expect(await memoryRedis.get(buildHostPairingSessionKey(CODE))).toBe(newRecord);
  });

  it('blockiert jeden Late Writer nach dem finalen Purge', async () => {
    await purgeHostPairingForSessions([{ sessionId: SESSION_ID, sessionCode: CODE }]);

    await expect(
      createHostPairingInvite({
        sessionId: SESSION_ID,
        sessionCode: CODE,
        screenVisibility: 'PROJECTED',
      }),
    ).rejects.toMatchObject({ pairingCode: 'SESSION_ENDED' });
    expect(await memoryRedis.get(buildHostPairingSessionKey(CODE))).toBeNull();
  });

  it('schließt Create-vs-Purge unter demselben Code-Lock ohne wiederbelebten Record', async () => {
    const results = await Promise.allSettled([
      createHostPairingInvite({
        sessionId: SESSION_ID,
        sessionCode: CODE,
        screenVisibility: 'PROJECTED',
      }),
      purgeHostPairingForSessions([{ sessionId: SESSION_ID, sessionCode: CODE }]),
    ]);

    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
    expect(await memoryRedis.get(buildHostPairingSessionPurgeFenceKey(SESSION_ID))).toBe('1');
    expect(await memoryRedis.get(buildHostPairingSessionKey(CODE))).toBeNull();
  });

  it('bestätigt Bulk-Purges in Chunks von höchstens 25 Sessions', async () => {
    const events = Array.from({ length: HOST_PAIRING_PURGE_BATCH_SIZE * 2 + 1 }, (_, index) => ({
      sessionId: `session-${index}`,
      sessionCode: `S${String(index).padStart(3, '0')}`,
    }));

    await purgeHostPairingForSessions(events);

    expect(memoryRedis.calls.filter(([command]) => command === 'WAITAOF')).toHaveLength(3);
    const scanCalls = memoryRedis.calls.filter(([command]) => command === 'SCAN');
    expect(scanCalls).toHaveLength(15);
    const firstScanByChunk = [0, 5, 10].map((scanOffset) => {
      const target = scanCalls[scanOffset];
      return memoryRedis.calls.indexOf(target!);
    });
    expect(firstScanByChunk).toHaveLength(3);
    expect(
      firstScanByChunk.map(
        (scanIndex) =>
          memoryRedis.calls
            .slice(0, scanIndex)
            .filter(
              ([command, key]) =>
                command === 'SET' &&
                typeof key === 'string' &&
                key.startsWith('host:pairing:v1:purged-session:'),
            ).length,
      ),
    ).toEqual([25, 50, 51]);
    for (const event of events) {
      expect(await memoryRedis.get(buildHostPairingSessionPurgeFenceKey(event.sessionId))).toBe(
        '1',
      );
    }
  });

  it('bricht fail-closed ab, wenn WAITAOF den lokalen AOF-Fsync nicht bestätigt', async () => {
    memoryRedis.setWaitAof([[0, 0]]);

    await expect(
      purgeHostPairingForSessions([{ sessionId: SESSION_ID, sessionCode: CODE }]),
    ).rejects.toThrow('HOST_PAIRING_PURGE_DURABILITY_UNAVAILABLE');
    expect(await memoryRedis.get(buildHostPairingSessionPurgeFenceKey(SESSION_ID))).toBe('1');
  });

  it('erkennt einen Redis-Neustart zwischen Mutation und Durability-Barrier', async () => {
    memoryRedis.setRunIds(['a'.repeat(40), 'b'.repeat(40)]);

    await expect(
      purgeHostPairingForSessions([{ sessionId: SESSION_ID, sessionCode: CODE }]),
    ).rejects.toThrow('HOST_PAIRING_PURGE_DURABILITY_UNAVAILABLE');
    expect(memoryRedis.calls.some(([command]) => command === 'WAITAOF')).toBe(false);
  });
});
