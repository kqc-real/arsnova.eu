import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_FEEDBACK_INVITE_TTL_SECONDS } from '@arsnova/shared-types';

const { prismaMock, redisMock, state } = vi.hoisted(() => {
  const state = {
    values: new Map<string, string>(),
    sets: new Map<string, Set<string>>(),
    calls: [] as string[],
    waitAof: [] as Array<[number, number]>,
    runIds: [] as string[],
  };
  const members = (key: string) => state.sets.get(key) ?? new Set<string>();
  const redisMock = {
    get: vi.fn(async (key: string) => state.values.get(key) ?? null),
    mget: vi.fn(async (...keys: string[]) => keys.map((key) => state.values.get(key) ?? null)),
    set: vi.fn(async (key: string, value: string) => {
      state.calls.push('SET');
      state.values.set(key, value);
      return 'OK';
    }),
    smembers: vi.fn(async (key: string) => [...members(key)]),
    scan: vi.fn(async (_cursor: string, _match: string, pattern: string) => {
      const prefix = pattern.slice(0, -1);
      return ['0', [...state.values.keys()].filter((key) => key.startsWith(prefix))];
    }),
    eval: vi.fn(async (script: string, keyCount: number, ...parameters: string[]) => {
      state.calls.push('EVAL');
      const keys = parameters.slice(0, keyCount);
      const args = parameters.slice(keyCount);
      if (script.includes('product_feedback_write_indexed_artifact_v2')) {
        const [key, indexKey, fenceKey] = keys;
        if (state.values.has(fenceKey!)) return -2;
        const [payload, , , mode] = args;
        if (mode === 'NX' && state.values.has(key!)) return 0;
        state.values.set(key!, payload!);
        const index = members(indexKey!);
        index.add(key!);
        state.sets.set(indexKey!, index);
        return 1;
      }
      if (script.includes('product_feedback_claim_invite_v2')) {
        const [slotKey, tokenKey, indexKey, fenceKey] = keys;
        if (state.values.has(fenceKey!) || state.values.get(slotKey!) !== args[0]) return -2;
        state.values.set(tokenKey!, args[1]!);
        state.values.set(slotKey!, args[2]!);
        state.sets.set(indexKey!, new Set([...members(indexKey!), slotKey!, tokenKey!]));
        return 3600;
      }
      if (script.includes('product_feedback_finalize_invite_v2')) {
        const [tokenKey, slotKey, consumeKey, indexKey, fenceKey] = keys;
        if (state.values.has(fenceKey!)) return -2;
        if (state.values.get(tokenKey!) !== args[0]) return 0;
        state.values.set(tokenKey!, args[1]!);
        state.values.delete(slotKey!);
        state.values.delete(consumeKey!);
        state.sets.set(indexKey!, new Set([tokenKey!]));
        return 1;
      }
      if (script.includes('product_feedback_purge_indexed_artifacts_v2')) {
        const [indexKey, fenceKey, metaKey, ...artifactKeys] = keys;
        state.values.set(fenceKey!, '1');
        const index = members(indexKey!);
        if (index.size !== Number(args[1]) || artifactKeys.some((key) => !index.has(key))) {
          return [0, 0];
        }
        let deleted = state.values.delete(metaKey!) ? 1 : 0;
        for (const key of artifactKeys) {
          const raw = state.values.get(key);
          if (raw && (JSON.parse(raw) as { sessionId?: string }).sessionId !== args[2]) {
            return [-1, 0];
          }
          if (state.values.delete(key)) deleted += 1;
        }
        state.sets.delete(indexKey!);
        return [1, deleted];
      }
      if (script.includes('product_feedback_purge_legacy_artifacts_v2')) {
        let deleted = 0;
        for (let index = 0; index < keys.length; index += 1) {
          const raw = state.values.get(keys[index]!);
          const expected = args[index * 2];
          const sessionId = args[index * 2 + 1];
          if (
            raw === expected &&
            (JSON.parse(raw!) as { sessionId?: string }).sessionId === sessionId &&
            state.values.delete(keys[index]!)
          ) {
            deleted += 1;
          }
        }
        return deleted;
      }
      throw new Error('unexpected Redis script');
    }),
    call: vi.fn(async (command: string, ...args: Array<string | number>) => {
      state.calls.push(command);
      if (command === 'CLIENT' && args[0] === 'ID') return 41;
      if (command === 'INFO' && args[0] === 'server') {
        return `# Server\r\nrun_id:${state.runIds.shift() ?? 'a'.repeat(40)}\r\n`;
      }
      if (command === 'WAITAOF') return state.waitAof.shift() ?? [1, 0];
      throw new Error(`unexpected command ${command}`);
    }),
  };
  return {
    state,
    redisMock,
    prismaMock: {
      session: { findUnique: vi.fn() },
      participant: { findMany: vi.fn() },
      productFeedbackInviteLedger: { upsert: vi.fn(async () => ({})) },
      $queryRaw: vi.fn(),
    },
  };
});

vi.mock('../redis', () => ({ getRedis: () => redisMock }));
vi.mock('../db', () => ({ prisma: prismaMock }));

import {
  PRODUCT_FEEDBACK_FOLLOWUP_PREFIX,
  PRODUCT_FEEDBACK_META_PREFIX,
  PRODUCT_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS,
  PRODUCT_FEEDBACK_SLOT_PREFIX,
  PRODUCT_FEEDBACK_TOKEN_PREFIX,
  buildProductFeedbackSessionIndexKey,
  buildProductFeedbackSessionPurgeFenceKey,
  buildSlotKeyForTests,
  claimProductFeedbackInvite,
  createInviteTokensForSession,
  finalizeInviteUsed,
  getInvitePayloadByToken,
  hashToken,
  purgeProductFeedbackInvitesForSessions,
  reserveInviteForSubmit,
} from './productFeedbackTokens';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SESSION_ID = '22222222-2222-4222-8222-222222222222';

function invitePayload(sessionId = SESSION_ID) {
  return {
    sessionId,
    role: 'HOST' as const,
    subjectId: 'host',
    surveyKey: 'POST_SESSION_EASE_HOST_V1' as const,
    surveyVersion: 1,
    sessionKind: 'QUIZ' as const,
    featureAreas: ['quiz'],
    sessionSizeClass: 'S' as const,
    used: false,
  };
}

describe('ProductFeedback session purge fence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    state.values.clear();
    state.sets.clear();
    state.calls.length = 0;
    state.waitAof.length = 0;
    state.runIds.length = 0;
  });

  it('behält die Fence länger als jedes Invite und purgt den gesamten Index', async () => {
    expect(PRODUCT_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS).toBeGreaterThan(
      PRODUCT_FEEDBACK_INVITE_TTL_SECONDS,
    );
    const slot = `${PRODUCT_FEEDBACK_SLOT_PREFIX}slot`;
    const token = `${PRODUCT_FEEDBACK_TOKEN_PREFIX}token`;
    const consume = 'productFeedback:consume:v1:token';
    const meta = `${PRODUCT_FEEDBACK_META_PREFIX}${SESSION_ID}`;
    const followUp = `${PRODUCT_FEEDBACK_FOLLOWUP_PREFIX}anonymous-follow-up`;
    for (const key of [slot, token, consume, meta]) {
      state.values.set(key, JSON.stringify(invitePayload()));
    }
    state.values.set(followUp, JSON.stringify({ feedbackId: 'feedback-1', used: false }));
    state.sets.set(
      buildProductFeedbackSessionIndexKey(SESSION_ID),
      new Set([slot, token, consume, meta]),
    );

    await expect(purgeProductFeedbackInvitesForSessions([SESSION_ID])).resolves.toBe(4);

    expect([...state.values.keys()].filter((key) => key.includes('anonymous-follow-up'))).toEqual([
      followUp,
    ]);
    expect(state.values.get(buildProductFeedbackSessionPurgeFenceKey(SESSION_ID))).toBe('1');
  });

  it('migriert alte Slot-/Token-Payloads per sessionId, ohne fremde oder Follow-up-Daten zu löschen', async () => {
    const oldSlot = `${PRODUCT_FEEDBACK_SLOT_PREFIX}legacy-slot`;
    const oldToken = `${PRODUCT_FEEDBACK_TOKEN_PREFIX}legacy-token`;
    const otherToken = `${PRODUCT_FEEDBACK_TOKEN_PREFIX}other-token`;
    const followUp = `${PRODUCT_FEEDBACK_FOLLOWUP_PREFIX}kept`;
    state.values.set(oldSlot, JSON.stringify({ ...invitePayload(), claimed: false }));
    state.values.set(oldToken, JSON.stringify(invitePayload()));
    state.values.set(otherToken, JSON.stringify(invitePayload(OTHER_SESSION_ID)));
    state.values.set(followUp, JSON.stringify({ feedbackId: 'feedback-1', used: false }));
    state.values.set(`${PRODUCT_FEEDBACK_META_PREFIX}${SESSION_ID}`, '{"legacy":true}');

    await expect(purgeProductFeedbackInvitesForSessions([SESSION_ID])).resolves.toBe(3);

    expect(state.values.has(oldSlot)).toBe(false);
    expect(state.values.has(oldToken)).toBe(false);
    expect(state.values.has(otherToken)).toBe(true);
    expect(state.values.has(followUp)).toBe(true);
  });

  it('blockiert Slot/Claim/Read/Finalize nach gesetzter Fence', async () => {
    const fence = buildProductFeedbackSessionPurgeFenceKey(SESSION_ID);
    state.values.set(fence, '1');
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      status: 'FINISHED',
      quizStarted: true,
      _count: { participants: 2 },
    });
    prismaMock.$queryRaw.mockResolvedValue([{ participantId: 'participant-1', source: 'vote' }]);
    prismaMock.participant.findMany.mockResolvedValue([]);

    await expect(createInviteTokensForSession(SESSION_ID)).resolves.toEqual({
      participantInvites: 0,
      hostInvite: false,
    });
    const slot = buildSlotKeyForTests(SESSION_ID, 'HOST', 'host');
    state.values.set(slot, JSON.stringify({ ...invitePayload(), claimed: false }));
    await expect(
      claimProductFeedbackInvite({ sessionId: SESSION_ID, role: 'HOST', subjectId: 'host' }),
    ).resolves.toBeNull();

    const bearer = 'opaque-invite-token';
    state.values.set(
      `${PRODUCT_FEEDBACK_TOKEN_PREFIX}${hashToken(bearer)}`,
      JSON.stringify(invitePayload()),
    );
    await expect(getInvitePayloadByToken(bearer)).resolves.toBeNull();
    await expect(reserveInviteForSubmit(bearer)).resolves.toBeNull();
    await expect(finalizeInviteUsed(bearer, invitePayload())).resolves.toBe(false);
  });

  it('erfasst Client und run_id vor der Mutation und bestätigt höchstens 25 Sessions pro WAITAOF', async () => {
    vi.stubEnv('PRODUCT_FEEDBACK_PURGE_REQUIRE_DURABILITY', '1');
    const sessions = Array.from(
      { length: 57 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );

    await purgeProductFeedbackInvitesForSessions(sessions);

    expect(state.calls.indexOf('CLIENT')).toBeLessThan(state.calls.indexOf('SET'));
    expect(redisMock.call.mock.calls.filter(([command]) => command === 'WAITAOF')).toHaveLength(3);
  });

  it('bricht bei fehlender AOF-Bestätigung oder gewechseltem Redis-Run fail-closed ab', async () => {
    vi.stubEnv('PRODUCT_FEEDBACK_PURGE_REQUIRE_DURABILITY', '1');
    state.waitAof.push([0, 0]);
    await expect(purgeProductFeedbackInvitesForSessions([SESSION_ID])).rejects.toThrow(
      'PRODUCT_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE',
    );

    state.values.clear();
    state.sets.clear();
    state.waitAof.length = 0;
    state.runIds.push('a'.repeat(40), 'b'.repeat(40));
    await expect(purgeProductFeedbackInvitesForSessions([SESSION_ID])).rejects.toThrow(
      'PRODUCT_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE',
    );
  });
});
