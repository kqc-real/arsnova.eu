/**
 * ProductFeedback Story 12.1 — Contract-/Token-/Admin-Tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';
import { sampleParticipantIds } from '../lib/productFeedbackTokens';
import { assignSurveyKey, resolveAreaPromptKind } from '../lib/productFeedbackSurvey';
import {
  PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT,
  SessionExportDTOSchema,
  getProductFeedbackSurveyDefinition,
  isAreaAllowedForSurvey,
  isPrimaryAnswerAllowedForSurvey,
  mapParticipantCountToSizeClass,
} from '@arsnova/shared-types';

const redisStore = new Map<string, string>();

const { prismaMock, redisMock, extractAdminTokenMock, isAdminSessionTokenValidMock } = vi.hoisted(
  () => ({
    prismaMock: {
      session: { findUnique: vi.fn() },
      participant: { findFirst: vi.fn(), findMany: vi.fn() },
      productFeedback: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      productFeedbackInviteLedger: {
        upsert: vi.fn(async () => ({})),
        aggregate: vi.fn(async () => ({ _sum: { count: 0 } })),
      },
      productFeedbackInviteJob: {
        upsert: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findMany: vi.fn(async () => []),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      $queryRaw: vi.fn(),
    },
    redisMock: {
      get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
      set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
        const nx = args.includes('NX');
        if (nx && redisStore.has(key)) return null;
        redisStore.set(key, value);
        return 'OK';
      }),
      del: vi.fn(async (...keys: string[]) => {
        let deleted = 0;
        for (const key of keys) {
          if (redisStore.delete(key)) deleted += 1;
        }
        return deleted;
      }),
      ttl: vi.fn(async () => 3600),
      mget: vi.fn(async (...keys: string[]) => keys.map((k) => redisStore.get(k) ?? null)),
      eval: vi.fn(
        async (
          _script: string,
          _keyCount: number,
          slotKey: string,
          tokenKey: string,
          expectedSlot: string,
          tokenPayload: string,
          claimedSlot: string,
        ) => {
          if (redisStore.get(slotKey) !== expectedSlot || redisStore.has(tokenKey)) return 0;
          redisStore.set(tokenKey, tokenPayload);
          redisStore.set(slotKey, claimedSlot);
          return 3600;
        },
      ),
      smembers: vi.fn(async () => [] as string[]),
      pipeline: vi.fn(() => {
        const ops: Array<() => void> = [];
        const api = {
          set: (key: string, value: string, ..._args: unknown[]) => {
            ops.push(() => {
              redisStore.set(key, value);
            });
            return api;
          },
          exec: async () => {
            for (const op of ops) op();
            return [];
          },
        };
        return api;
      }),
    },
    extractAdminTokenMock: vi.fn(() => 'admin-session'),
    isAdminSessionTokenValidMock: vi.fn(async () => true),
  }),
);

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../redis', () => ({ getRedis: () => redisMock }));
vi.mock('../lib/rateLimit', () => ({
  checkProductFeedbackClaimRate: vi.fn(async () => ({ allowed: true })),
  checkProductFeedbackMutateRate: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('../lib/hostAuth', () => ({
  extractHostTokenFromContext: vi.fn(() => 'host-token'),
  isHostSessionTokenValid: vi.fn(async () => true),
}));
vi.mock('../lib/adminAuth', () => ({
  extractAdminToken: extractAdminTokenMock,
  isAdminSessionTokenValid: isAdminSessionTokenValidMock,
  verifyAdminSecret: vi.fn(() => false),
}));

import { productFeedbackRouter } from '../routers/productFeedback';
import { adminProductFeedbackRouter } from '../routers/adminProductFeedback';
import {
  createInviteTokensForSession,
  claimProductFeedbackInvite,
  hashToken,
  buildSlotKeyForTests,
} from '../lib/productFeedbackTokens';
import { buildProductFeedbackAdminStats } from '../lib/productFeedbackStats';
import {
  cleanupProductFeedbackInviteJobs,
  cleanupProductFeedbackMessages,
  cleanupProductFeedbackRecords,
} from '../lib/productFeedbackCleanup';

const publicCaller = productFeedbackRouter.createCaller({ req: undefined });
const adminCaller = adminProductFeedbackRouter.createCaller({ req: {} as never });

async function createHostInviteToken(): Promise<string> {
  prismaMock.session.findUnique.mockResolvedValue({
    id: 'sess-1',
    code: 'ABC123',
    status: 'FINISHED',
    quizStarted: true,
    _count: { participants: 5 },
  });
  prismaMock.$queryRaw.mockResolvedValue([{ participantId: 'p1', source: 'vote' }]);
  await createInviteTokensForSession('sess-1');
  const token = await claimProductFeedbackInvite({
    sessionId: 'sess-1',
    role: 'HOST',
    subjectId: 'host',
  });
  expect(token).toBeTruthy();
  return token!;
}

describe('ProductFeedback helpers', () => {
  it('weist Ease/Value deterministisch zu', () => {
    const a = assignSurveyKey('PARTICIPANT', 'sess:p1');
    const b = assignSurveyKey('PARTICIPANT', 'sess:p1');
    expect(a).toBe(b);
    expect(
      a === 'POST_SESSION_EASE_PARTICIPANT_V1' || a === 'POST_SESSION_VALUE_PARTICIPANT_V1',
    ).toBe(true);
  });

  it('sampled max 25 und mind. 1 ab 3 Geeigneten', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `p${i}`);
    expect(sampleParticipantIds('s1', ids).length).toBe(1);
    const many = Array.from({ length: 400 }, (_, i) => `p${i}`);
    expect(sampleParticipantIds('s1', many).length).toBeLessThanOrEqual(25);
  });

  it('mappt Größenklassen und Area-Prompt', () => {
    expect(mapParticipantCountToSizeClass(5)).toBe('XS');
    expect(mapParticipantCountToSizeClass(250)).toBe('XL');
    expect(resolveAreaPromptKind('EASY')).toBe('strength');
    expect(resolveAreaPromptKind('HARD')).toBe('hurdle');
  });

  it('validiert Primärantwort und Bereich je Survey', () => {
    const key = 'POST_SESSION_EASE_HOST_V1' as const;
    expect(isPrimaryAnswerAllowedForSurvey(key, 'EASY')).toBe(true);
    expect(isPrimaryAnswerAllowedForSurvey(key, 'YES')).toBe(false);
    expect(isAreaAllowedForSurvey(key, 'PREPARE_QUIZ')).toBe(true);
    expect(isAreaAllowedForSurvey(key, 'JOIN')).toBe(false);
    expect(getProductFeedbackSurveyDefinition(key).primaryAnswers).toHaveLength(3);
  });

  it('schließt ProductFeedback aus dem Session-Exportvertrag aus', () => {
    expect(SessionExportDTOSchema.keyof().options).not.toContain('productFeedback');
  });

  it('liefert Area-Optionen in Nutzungsflow-Reihenfolge', () => {
    expect(getProductFeedbackSurveyDefinition('POST_SESSION_EASE_PARTICIPANT_V1').areas).toEqual([
      'JOIN',
      'ORIENTATION',
      'ANSWER',
      'QA_OR_QUICKFEEDBACK',
      'RESULTS',
      'TECH',
      'ACCESSIBILITY',
      'OTHER',
    ]);
    expect(getProductFeedbackSurveyDefinition('POST_SESSION_VALUE_HOST_V1').areas).toEqual([
      'PREPARE_QUIZ',
      'START_SESSION',
      'INVITE',
      'LIVE_CONTROL',
      'QA_OR_QUICKFEEDBACK',
      'RESULTS',
      'PDF_EXPORT',
      'TECH',
      'ACCESSIBILITY',
      'OTHER',
    ]);
    expect(getProductFeedbackSurveyDefinition('POST_SESSION_EASE_HOST_V1').primaryAnswers).toEqual([
      'EASY',
      'MINOR_FRICTION',
      'HARD',
    ]);
  });
});

describe('productFeedback router', () => {
  beforeEach(() => {
    redisStore.clear();
    vi.clearAllMocks();
    prismaMock.productFeedback.findUnique.mockResolvedValue(null);
    prismaMock.productFeedback.findFirst.mockResolvedValue(null);
    prismaMock.productFeedback.findMany.mockResolvedValue([]);
    prismaMock.participant.findMany.mockResolvedValue([]);
  });

  trpcDodIt(
    {
      procedure: 'productFeedback.claimInvite',
      case: 'happy',
      mode: 'direct',
      title: 'liefert null ohne Einladung',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'FINISHED',
      });
      prismaMock.participant.findFirst.mockResolvedValue({ id: 'part-1' });
      const out = await publicCaller.claimInvite({
        sessionCode: 'ABC123',
        role: 'PARTICIPANT',
        participantId: '11111111-1111-4111-8111-111111111111',
        participantClaimToken: 'participant-claim-token-value-1234567890',
      });
      expect(out.inviteToken).toBeNull();
      expect(out.survey).toBeNull();
    },
  );

  it('bindet persistierte Follow-up-Idempotenz an die verwendete Capability', async () => {
    const capability = 'already-finalized-capability-value-123456';
    const idempotencyKey = '99999999-9999-4999-8999-999999999999';
    prismaMock.productFeedback.findUnique.mockResolvedValueOnce({ id: 'fb-1' });
    const out = await publicCaller.followUp({
      followUpCapability: capability,
      message: 'Bereits gespeichert',
      idempotencyKey,
    });
    expect(out).toEqual({ ok: true });
    expect(prismaMock.productFeedback.findUnique).toHaveBeenCalledWith({
      where: {
        followUpIdempotencyHash: hashToken(`${hashToken(capability)}:${idempotencyKey}`),
      },
      select: { id: true },
    });
    expect(prismaMock.productFeedback.update).not.toHaveBeenCalled();
  });

  it('liefert einen bereits persistierten Submit nach Redis-/Prozessfehler idempotent aus', async () => {
    const inviteToken = 'persisted-invite-token-value-1234567890';
    prismaMock.productFeedback.findUnique.mockResolvedValueOnce({
      id: 'fb-persisted',
      createdAt: new Date(),
      inviteFingerprint: hashToken(inviteToken),
    });

    const out = await publicCaller.submit({
      inviteToken,
      primaryAnswer: 'EASY',
      area: 'PREPARE_QUIZ',
      locale: 'de',
      deviceClass: 'DESKTOP',
      idempotencyKey: '88888888-8888-4888-8888-888888888888',
    });

    expect(out.ok).toBe(true);
    expect(out.followUpCapability).toBeTruthy();
    expect(prismaMock.productFeedback.create).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'productFeedback.claimInvite',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt Teilnehmer-Claims ohne participantId ab',
    },
    async () => {
      await expect(
        publicCaller.claimInvite({
          sessionCode: 'ABC123',
          role: 'PARTICIPANT',
        } as never),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.getSurvey',
      case: 'happy',
      mode: 'direct',
      title: 'liefert die Survey-Definition einer gültigen Einladung',
    },
    async () => {
      const inviteToken = await createHostInviteToken();

      const out = await publicCaller.getSurvey({ inviteToken });

      expect(out.inviteToken).toBe(inviteToken);
      expect(out.survey.role).toBe('HOST');
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.getSurvey',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'lehnt ein ungültiges Invite-Token ab',
    },
    async () => {
      await expect(
        publicCaller.getSurvey({ inviteToken: 'missing-token-value-xx' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.submit',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'lehnt ungültiges Invite-Token ab',
    },
    async () => {
      await expect(
        publicCaller.submit({
          inviteToken: 'missing-token-value-xx',
          primaryAnswer: 'EASY',
          area: 'JOIN',
          locale: 'de',
          deviceClass: 'DESKTOP',
          idempotencyKey: '22222222-2222-4222-8222-222222222222',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.submit',
      case: 'happy',
      mode: 'direct',
      title: 'gibt Invite bei Persistenzfehler wieder frei',
    },
    async () => {
      const token = await createHostInviteToken();

      prismaMock.productFeedback.create.mockRejectedValueOnce(new Error('db down'));
      await expect(
        publicCaller.submit({
          inviteToken: token,
          primaryAnswer: 'EASY',
          area: 'PREPARE_QUIZ',
          locale: 'de',
          deviceClass: 'DESKTOP',
          idempotencyKey: '33333333-3333-4333-8333-333333333333',
        }),
      ).rejects.toThrow('db down');

      prismaMock.productFeedback.create.mockResolvedValueOnce({
        id: 'fb-1',
        createdAt: new Date(),
        inviteFingerprint: hashToken(token),
      });
      const retry = await publicCaller.submit({
        inviteToken: token,
        primaryAnswer: 'EASY',
        area: 'PREPARE_QUIZ',
        locale: 'de',
        deviceClass: 'DESKTOP',
        idempotencyKey: '44444444-4444-4444-8444-444444444444',
      });
      expect(retry.ok).toBe(true);
      expect(retry.followUpCapability).toBeTruthy();
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.followUp',
      case: 'happy',
      mode: 'direct',
      title: 'ergänzt eine Rückmeldung mit der Capability aus submit',
    },
    async () => {
      const inviteToken = await createHostInviteToken();
      prismaMock.productFeedback.create.mockResolvedValue({
        id: 'fb-1',
        createdAt: new Date(),
        inviteFingerprint: hashToken(inviteToken),
      });
      const submitted = await publicCaller.submit({
        inviteToken,
        primaryAnswer: 'EASY',
        area: 'PREPARE_QUIZ',
        locale: 'de',
        deviceClass: 'DESKTOP',
        idempotencyKey: '55555555-5555-4555-8555-555555555555',
      });
      prismaMock.productFeedback.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'fb-1',
        message: null,
        followUpIdempotencyHash: null,
      });
      prismaMock.productFeedback.update.mockResolvedValue({ id: 'fb-1' });

      const out = await publicCaller.followUp({
        followUpCapability: submitted.followUpCapability,
        message: 'Die Vorbereitung könnte klarer sein.',
        idempotencyKey: '66666666-6666-4666-8666-666666666666',
      });

      expect(out.ok).toBe(true);
      expect(prismaMock.productFeedback.update).toHaveBeenCalledWith({
        where: { id: 'fb-1' },
        data: {
          message: 'Die Vorbereitung könnte klarer sein.',
          followUpIdempotencyHash: hashToken(
            `${hashToken(submitted.followUpCapability)}:66666666-6666-4666-8666-666666666666`,
          ),
        },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.followUp',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'lehnt eine ungültige Follow-up-Capability ab',
    },
    async () => {
      await expect(
        publicCaller.followUp({
          followUpCapability: 'missing-follow-up-capability',
          message: 'Ergänzung',
          idempotencyKey: '77777777-7777-4777-8777-777777777777',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );
});

describe('createInviteTokensForSession', () => {
  beforeEach(() => {
    redisStore.clear();
    vi.clearAllMocks();
  });

  it('stellt Eignungs-Slots ohne Klartext-Bearer und Claim liefert Token', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      code: 'ABC123',
      status: 'FINISHED',
      quizStarted: true,
      _count: { participants: 5 },
    });
    prismaMock.$queryRaw.mockResolvedValue([
      { participantId: 'p1', source: 'vote' },
      { participantId: 'p2', source: 'vote' },
      { participantId: 'p3', source: 'vote' },
    ]);
    prismaMock.participant.findMany.mockResolvedValue([
      {
        id: 'p1',
        productFeedbackClaimTokenHash: hashToken('claim-token-p1-value-123456789012345'),
      },
      {
        id: 'p2',
        productFeedbackClaimTokenHash: hashToken('claim-token-p2-value-123456789012345'),
      },
      {
        id: 'p3',
        productFeedbackClaimTokenHash: hashToken('claim-token-p3-value-123456789012345'),
      },
    ]);

    const result = await createInviteTokensForSession('sess-1');
    expect(result.hostInvite).toBe(true);
    expect(result.participantInvites).toBeGreaterThanOrEqual(1);

    const hostSlot = buildSlotKeyForTests('sess-1', 'HOST', 'host');
    const slotRaw = redisStore.get(hostSlot);
    expect(slotRaw).toBeTruthy();
    const slot = JSON.parse(slotRaw!) as { claimed: boolean; sessionId: string };
    expect(slot.claimed).toBe(false);
    expect(slot.sessionId).toBe('sess-1');
    expect(slotRaw).not.toMatch(/"used"/);

    const token = await claimProductFeedbackInvite({
      sessionId: 'sess-1',
      role: 'HOST',
      subjectId: 'host',
    });
    expect(token).toBeTruthy();
    const payloadRaw = redisStore.get(`productFeedback:token:v1:${hashToken(token!)}`);
    expect(payloadRaw).toBeTruthy();
    const payload = JSON.parse(payloadRaw!) as { sessionId: string; used: boolean };
    expect(payload.sessionId).toBe('sess-1');
    expect(payload.used).toBe(false);

    const claimedSlot = JSON.parse(redisStore.get(hostSlot)!) as { claimed: boolean };
    expect(claimedSlot.claimed).toBe(true);

    // Zweiter Claim liefert null
    expect(
      await claimProductFeedbackInvite({
        sessionId: 'sess-1',
        role: 'HOST',
        subjectId: 'host',
      }),
    ).toBeNull();
  });

  it('bindet Teilnehmer-Claims an den geheimen Besitznachweis und stellt nur ein Token aus', async () => {
    const sessionId = 'sess-participant';
    const participantId = 'participant-1';
    const claimToken = 'participant-secret-value-123456789012345';
    const slot = buildSlotKeyForTests(sessionId, 'PARTICIPANT', participantId);
    redisStore.set(
      slot,
      JSON.stringify({
        sessionId,
        role: 'PARTICIPANT',
        subjectId: participantId,
        surveyKey: 'POST_SESSION_EASE_PARTICIPANT_V1',
        surveyVersion: 1,
        featureAreas: [],
        claimed: false,
        participantClaimTokenHash: hashToken(claimToken),
      }),
    );

    expect(
      await claimProductFeedbackInvite({
        sessionId,
        role: 'PARTICIPANT',
        subjectId: participantId,
        participantClaimToken: 'wrong-secret-value-1234567890123456789',
      }),
    ).toBeNull();

    const results = await Promise.all([
      claimProductFeedbackInvite({
        sessionId,
        role: 'PARTICIPANT',
        subjectId: participantId,
        participantClaimToken: claimToken,
      }),
      claimProductFeedbackInvite({
        sessionId,
        role: 'PARTICIPANT',
        subjectId: participantId,
        participantClaimToken: claimToken,
      }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe('admin productFeedback stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractAdminTokenMock.mockReturnValue('admin-session');
    isAdminSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.productFeedback.findMany.mockResolvedValue([]);
  });

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.getStats',
      case: 'happy',
      mode: 'direct',
      title: 'liefert aggregierte Produktfeedback-Statistiken für Admins',
    },
    async () => {
      prismaMock.productFeedback.count.mockResolvedValue(0);
      prismaMock.productFeedback.groupBy.mockResolvedValue([]);

      const out = await adminCaller.getStats({});

      expect(out.totals).toBe(0);
      expect(prismaMock.productFeedback.count).toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.getStats',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'weist Statistikaufrufe ohne Admin-Sitzung ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);

      await expect(adminCaller.getStats({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(prismaMock.productFeedback.count).not.toHaveBeenCalled();
    },
  );

  it('unterdrückt feine Segmente unter MIN_SEGMENT', async () => {
    prismaMock.productFeedback.count.mockResolvedValue(6);
    prismaMock.productFeedback.groupBy.mockImplementation(async (args: { by: string[] }) => {
      if (args.by.length === 2) {
        return [
          { surveyKey: 'POST_SESSION_EASE_HOST_V1', primaryAnswer: 'EASY', _count: { _all: 4 } },
          { surveyKey: 'POST_SESSION_EASE_HOST_V1', primaryAnswer: 'HARD', _count: { _all: 5 } },
        ];
      }
      if (args.by[0] === 'primaryAnswer') {
        return [
          { primaryAnswer: 'EASY', _count: { _all: 4 } },
          { primaryAnswer: 'HARD', _count: { _all: 2 } },
        ];
      }
      return [];
    });

    const stats = await buildProductFeedbackAdminStats({});
    expect(stats.totals).toBe(6);
    expect(
      stats.bySurveyAndPrimary.every((r) => r.count >= PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT),
    ).toBe(true);
    expect(stats.bySurveyAndPrimary).toHaveLength(1);
  });

  it('liefert leere Admin-Stats', async () => {
    prismaMock.productFeedback.count.mockResolvedValue(0);
    prismaMock.productFeedback.groupBy.mockResolvedValue([]);
    const out = await buildProductFeedbackAdminStats({});
    expect(out.totals).toBe(0);
    expect(out.byPrimaryAnswer).toEqual([]);
  });

  it('aggregiert Versionen, Sessionart, Funktionsbereiche sowie positive und Hürden-Bereiche', async () => {
    prismaMock.productFeedback.count.mockResolvedValue(10);
    prismaMock.productFeedback.findMany.mockResolvedValue(
      Array.from({ length: 5 }, () => ({ featureAreas: ['qa'] })),
    );
    prismaMock.productFeedback.groupBy.mockImplementation(
      async (args: { by: string[]; where?: { primaryAnswer?: unknown } }) => {
        if (args.by[0] === 'appVersion') {
          return [{ appVersion: 'release-42', _count: { _all: 5 } }];
        }
        if (args.by[0] === 'surveyVersion') {
          return [{ surveyVersion: 1, _count: { _all: 5 } }];
        }
        if (args.by[0] === 'sessionKind') {
          return [{ sessionKind: 'QUIZ', _count: { _all: 5 } }];
        }
        if (args.by[0] === 'area' && args.where?.primaryAnswer) {
          return [{ area: 'RESULTS', _count: { _all: 5 } }];
        }
        return [];
      },
    );

    const stats = await buildProductFeedbackAdminStats({});
    expect(stats.byAppVersion).toEqual([{ key: 'release-42', count: 5 }]);
    expect(stats.bySurveyVersion).toEqual([{ key: '1', count: 5 }]);
    expect(stats.bySessionKind).toEqual([{ key: 'QUIZ', count: 5 }]);
    expect(stats.byFeatureArea).toEqual([{ key: 'qa', count: 5 }]);
    expect(stats.byPositiveArea).toEqual([{ key: 'RESULTS', count: 5 }]);
    expect(stats.byHurdleArea).toEqual([{ key: 'RESULTS', count: 5 }]);
  });
});

describe('Invite nach Session-Cleanup', () => {
  beforeEach(() => {
    redisStore.clear();
    vi.clearAllMocks();
  });

  it('Token überlebt Session-Redis-Cleanup und bleibt claim-/submitfähig', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      code: 'ABC123',
      status: 'FINISHED',
      quizStarted: true,
      _count: { participants: 5 },
    });
    prismaMock.$queryRaw.mockResolvedValue([{ participantId: 'p1', source: 'vote' }]);

    await createInviteTokensForSession('sess-1');
    const token = await claimProductFeedbackInvite({
      sessionId: 'sess-1',
      role: 'HOST',
      subjectId: 'host',
    });
    expect(token).toBeTruthy();

    // Simuliert Session-Redis-Cleanup: nur Session-/QF-Keys, nicht productFeedback:*
    for (const key of [...redisStore.keys()]) {
      if (!key.startsWith('productFeedback:')) redisStore.delete(key);
    }

    const { getInvitePayloadByToken, markInviteUsed } =
      await import('../lib/productFeedbackTokens');
    const payload = await getInvitePayloadByToken(token!);
    expect(payload?.sessionId).toBe('sess-1');
    expect(payload?.used).toBe(false);

    const used = await markInviteUsed(token!);
    expect(used?.payload.sessionId).toBe('sess-1');
    expect(await getInvitePayloadByToken(token!)).toBeNull();
  });

  it('lehnt abgelaufene und bereits verbrauchte Tokens typisiert ab', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      code: 'ABC123',
      status: 'FINISHED',
      quizStarted: true,
      _count: { participants: 3 },
    });
    prismaMock.$queryRaw.mockResolvedValue([{ participantId: 'p1', source: 'vote' }]);
    await createInviteTokensForSession('sess-1');
    const token = await claimProductFeedbackInvite({
      sessionId: 'sess-1',
      role: 'HOST',
      subjectId: 'host',
    });
    expect(token).toBeTruthy();

    // verbrauchen
    const { markInviteUsed } = await import('../lib/productFeedbackTokens');
    await markInviteUsed(token!);

    await expect(
      publicCaller.submit({
        inviteToken: token!,
        primaryAnswer: 'EASY',
        area: 'PREPARE_QUIZ',
        locale: 'de',
        appVersion: '0.1.0',
        deviceClass: 'DESKTOP',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      publicCaller.submit({
        inviteToken: 'expired-or-unknown-token',
        primaryAnswer: 'EASY',
        area: 'PREPARE_QUIZ',
        locale: 'de',
        appVersion: '0.1.0',
        deviceClass: 'DESKTOP',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('ProductFeedback Retention-Cleanup', () => {
  it('entfernt Freitext nach 90 Tagen, behält aber den strukturierten Datensatz', async () => {
    prismaMock.productFeedback.updateMany.mockResolvedValue({ count: 1 });
    await expect(cleanupProductFeedbackMessages()).resolves.toBe(1);
    expect(prismaMock.productFeedback.updateMany).toHaveBeenCalledWith({
      where: {
        message: { not: null },
        messageClearedAt: null,
        createdAt: { lt: expect.any(Date) },
      },
      data: {
        message: null,
        messageClearedAt: expect.any(Date),
      },
    });
  });

  it('löscht strukturierte Datensätze erst an der 13-Monats-Grenze', async () => {
    prismaMock.productFeedback.deleteMany.mockResolvedValue({ count: 1 });
    await expect(cleanupProductFeedbackRecords()).resolves.toBe(1);
    expect(prismaMock.productFeedback.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
    });
  });

  it('entfernt nur alte erledigte oder endgültig fehlgeschlagene Jobs', async () => {
    prismaMock.productFeedbackInviteJob.deleteMany.mockResolvedValue({ count: 2 });
    await expect(cleanupProductFeedbackInviteJobs()).resolves.toBe(2);
    expect(prismaMock.productFeedbackInviteJob.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
        OR: [{ completedAt: { not: null } }, { attempts: { gte: 8 } }],
      },
    });
  });
});
