/**
 * ProductFeedback Story 12.1 — Contract-/Token-/Admin-Tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';
import { sampleParticipantIds } from '../lib/productFeedbackTokens';
import { assignSurveyKey, resolveAreaPromptKind } from '../lib/productFeedbackSurvey';
import {
  PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT,
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
      participant: { findFirst: vi.fn() },
      productFeedback: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
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
      del: vi.fn(async (key: string) => {
        redisStore.delete(key);
        return 1;
      }),
      ttl: vi.fn(async () => 3600),
      mget: vi.fn(async (...keys: string[]) => keys.map((k) => redisStore.get(k) ?? null)),
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
      });
      expect(out.inviteToken).toBeNull();
      expect(out.survey).toBeNull();
    },
  );

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

      prismaMock.productFeedback.create.mockResolvedValueOnce({ id: 'fb-1' });
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
      prismaMock.productFeedback.create.mockResolvedValue({ id: 'fb-1' });
      const submitted = await publicCaller.submit({
        inviteToken,
        primaryAnswer: 'EASY',
        area: 'PREPARE_QUIZ',
        locale: 'de',
        deviceClass: 'DESKTOP',
        idempotencyKey: '55555555-5555-4555-8555-555555555555',
      });
      prismaMock.productFeedback.findUnique.mockResolvedValue({ id: 'fb-1', message: null });
      prismaMock.productFeedback.update.mockResolvedValue({ id: 'fb-1' });

      const out = await publicCaller.followUp({
        followUpCapability: submitted.followUpCapability,
        message: 'Die Vorbereitung könnte klarer sein.',
        idempotencyKey: '66666666-6666-4666-8666-666666666666',
      });

      expect(out.ok).toBe(true);
      expect(prismaMock.productFeedback.update).toHaveBeenCalledWith({
        where: { id: 'fb-1' },
        data: { message: 'Die Vorbereitung könnte klarer sein.' },
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
});

describe('admin productFeedback stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractAdminTokenMock.mockReturnValue('admin-session');
    isAdminSessionTokenValidMock.mockResolvedValue(true);
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
});
