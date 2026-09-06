/**
 * ProductFeedback Story 12.1 — Contract-/Token-/Admin-Tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';
import { sampleParticipantIds } from '../lib/productFeedbackTokens';
import { assignSurveyKey, resolveAreaPromptKind } from '../lib/productFeedbackSurvey';
import { isProductFeedbackOriginAllowed } from '../lib/productFeedbackInApp';
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
        delete: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      productFeedbackAuditLog: {
        create: vi.fn(),
        deleteMany: vi.fn(),
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
      $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations)),
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

const inAppContext = {
  locale: 'de' as const,
  appVersion: '2026.9.0',
  routeGroup: 'SESSION_VOTE' as const,
  sessionPhase: 'ACTIVE' as const,
  activeChannel: 'QUIZ' as const,
  deviceClass: 'PHONE' as const,
  browserFamily: 'SAFARI' as const,
  browserMajorVersion: 26,
  osFamily: 'IOS' as const,
  onlineState: 'ONLINE' as const,
  errorRequestId: 'vote.submit:timeout-42',
};

function adminFeedbackRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    source: 'IN_APP',
    role: 'PARTICIPANT',
    surveyKey: null,
    surveyVersion: 1,
    primaryAnswer: null,
    feedbackKind: 'NOT_WORKING',
    area: 'QUIZ_OR_ANSWER',
    impact: 'BLOCKED',
    message: 'Die Abstimmung blieb hängen.',
    messageClearedAt: null,
    locale: 'de',
    appVersion: '2026.9.0',
    sessionKind: null,
    featureAreas: null,
    sessionSizeClass: null,
    deviceClass: 'PHONE',
    routeGroup: 'SESSION_VOTE',
    sessionPhase: 'ACTIVE',
    activeChannel: 'QUIZ',
    browserFamily: 'SAFARI',
    browserMajorVersion: 26,
    osFamily: 'IOS',
    onlineState: 'ONLINE',
    errorRequestId: 'vote.submit:timeout-42',
    triageStatus: 'NEW',
    quarantineStatus: 'NONE',
    duplicateOfId: null,
    githubIssueNumber: null,
    githubIssueUrl: null,
    resolvedInVersion: null,
    publicResolutionUrl: null,
    createdAt: new Date('2026-09-06T08:00:00.000Z'),
    updatedAt: new Date('2026-09-06T08:00:00.000Z'),
    _count: { duplicates: 0 },
    ...overrides,
  };
}

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
  it('akzeptiert die Angular-Dev-Origin auch ohne explizites NODE_ENV', () => {
    expect(
      isProductFeedbackOriginAllowed(
        {
          headers: { origin: 'http://localhost:4200' },
        } as never,
        undefined,
      ),
    ).toBe(true);
  });

  it('öffnet die Angular-Dev-Origin nicht im Produktionsmodus', () => {
    expect(
      isProductFeedbackOriginAllowed(
        {
          headers: { origin: 'http://localhost:4200' },
        } as never,
        'production',
      ),
    ).toBe(false);
  });

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

  trpcDodIt(
    {
      procedure: 'productFeedback.getInAppChallenge',
      case: 'happy',
      mode: 'direct',
      title: 'stellt eine kurzlebige IN_APP-Challenge idempotent aus',
    },
    async () => {
      const input = { idempotencyKey: '88888888-8888-4888-8888-888888888888' };
      const first = await publicCaller.getInAppChallenge(input);
      const second = await publicCaller.getInAppChallenge(input);
      expect(first.challengeToken).toHaveLength(43);
      expect(second).toEqual(first);
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.getInAppChallenge',
      case: 'error',
      mode: 'direct',
      contract: 'FORBIDDEN',
      title: 'lehnt eine fremde Browser-Origin ab',
    },
    async () => {
      const foreignCaller = productFeedbackRouter.createCaller({
        req: {
          headers: {
            origin: 'https://evil.example',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'arsnova.eu',
          },
        } as never,
      });
      await expect(
        foreignCaller.getInAppChallenge({
          idempotencyKey: '89898989-8989-4989-8989-898989898989',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.submitInApp',
      case: 'happy',
      mode: 'direct',
      title: 'persistiert nur den freigegebenen anonymen IN_APP-Kontext',
    },
    async () => {
      const idempotencyKey = '99999999-9999-4999-8999-999999999999';
      const challenge = await publicCaller.getInAppChallenge({ idempotencyKey });
      prismaMock.productFeedback.create.mockResolvedValue({
        id: 'fb-in-app-1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const output = await publicCaller.submitInApp({
        challengeToken: challenge.challengeToken,
        idempotencyKey,
        role: 'PARTICIPANT',
        kind: 'NOT_WORKING',
        area: 'QUIZ_OR_ANSWER',
        context: inAppContext,
      });

      expect(output.ok).toBe(true);
      expect(output.followUpCapability).toHaveLength(64);
      expect(prismaMock.productFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'IN_APP',
          role: 'PARTICIPANT',
          feedbackKind: 'NOT_WORKING',
          area: 'QUIZ_OR_ANSWER',
          routeGroup: 'SESSION_VOTE',
          errorRequestId: 'vote.submit:timeout-42',
        }),
        select: { id: true },
      });
      expect(prismaMock.productFeedback.create.mock.calls[0]?.[0].data).not.toHaveProperty(
        'sessionCode',
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.submitInApp',
      case: 'error',
      mode: 'direct',
      contract: 'CONFLICT',
      title: 'lehnt eine fehlende oder fremd gebundene Challenge ab',
    },
    async () => {
      await expect(
        publicCaller.submitInApp({
          challengeToken: 'missing-challenge-capability-value-12345',
          idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          role: 'GENERAL',
          kind: 'UNCLEAR',
          area: 'HELP',
          context: { ...inAppContext, routeGroup: 'HELP', sessionPhase: 'NONE' },
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.followUpInApp',
      case: 'happy',
      mode: 'direct',
      title: 'ergänzt Impact und quarantänemarkierten Plaintext capability-gebunden',
    },
    async () => {
      const idempotencyKey = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const challenge = await publicCaller.getInAppChallenge({ idempotencyKey });
      prismaMock.productFeedback.create.mockResolvedValue({
        id: 'fb-in-app-2',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const submitted = await publicCaller.submitInApp({
        challengeToken: challenge.challengeToken,
        idempotencyKey,
        role: 'PARTICIPANT',
        kind: 'NOT_WORKING',
        area: 'QUIZ_OR_ANSWER',
        context: inAppContext,
      });
      prismaMock.productFeedback.findUnique.mockResolvedValue({
        id: 'fb-in-app-2',
        source: 'IN_APP',
        feedbackKind: 'NOT_WORKING',
        message: null,
        impact: null,
      });
      prismaMock.productFeedback.update.mockResolvedValue({ id: 'fb-in-app-2' });

      const output = await publicCaller.followUpInApp({
        followUpCapability: submitted.followUpCapability,
        idempotencyKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        message: 'Mein Sessioncode war ABC123.',
        impact: 'BLOCKED',
      });

      expect(output).toEqual({ ok: true });
      expect(prismaMock.productFeedback.update).toHaveBeenCalledWith({
        where: { id: 'fb-in-app-2' },
        data: {
          message: 'Mein Sessioncode war ABC123.',
          impact: 'BLOCKED',
          quarantineStatus: 'FLAGGED',
        },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'productFeedback.followUpInApp',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt Impact bei positivem Feedback ab',
    },
    async () => {
      const idempotencyKey = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const challenge = await publicCaller.getInAppChallenge({ idempotencyKey });
      prismaMock.productFeedback.create.mockResolvedValue({
        id: 'fb-in-app-3',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const submitted = await publicCaller.submitInApp({
        challengeToken: challenge.challengeToken,
        idempotencyKey,
        role: 'GENERAL',
        kind: 'PRAISE',
        area: 'HELP',
        context: { ...inAppContext, routeGroup: 'HELP', sessionPhase: 'NONE' },
      });
      prismaMock.productFeedback.findUnique.mockResolvedValue({
        id: 'fb-in-app-3',
        source: 'IN_APP',
        feedbackKind: 'PRAISE',
        message: null,
        impact: null,
      });

      await expect(
        publicCaller.followUpInApp({
          followUpCapability: submitted.followUpCapability,
          idempotencyKey: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          impact: 'CONTINUED',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
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

describe('adminProductFeedback Triage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminSessionTokenValidMock.mockResolvedValue(true);
    extractAdminTokenMock.mockReturnValue('admin-session');
    prismaMock.productFeedback.update.mockResolvedValue(adminFeedbackRow());
    prismaMock.productFeedback.delete.mockResolvedValue(adminFeedbackRow());
    prismaMock.productFeedbackAuditLog.create.mockResolvedValue({});
  });

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.list',
      case: 'happy',
      mode: 'direct',
      title: 'listet die gefilterte Inbox ohne Freitext',
    },
    async () => {
      prismaMock.productFeedback.findMany.mockResolvedValue([adminFeedbackRow()]);
      const output = await adminCaller.list({ limit: 25, source: 'IN_APP', status: 'NEW' });
      expect(output.items).toHaveLength(1);
      expect(output.items[0]).not.toHaveProperty('message');
      expect(prismaMock.productFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ source: 'IN_APP', triageStatus: 'NEW' }),
        }),
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.getTriageStats',
      case: 'happy',
      mode: 'direct',
      title: 'aggregiert IN_APP-Arten, Blocker und Versionstrends',
    },
    async () => {
      prismaMock.productFeedback.count.mockResolvedValueOnce(12).mockResolvedValueOnce(3);
      prismaMock.productFeedback.groupBy.mockImplementation(async (args: { by: string[] }) => {
        if (args.by[0] === 'feedbackKind') {
          return [{ feedbackKind: 'NOT_WORKING', _count: { _all: 7 } }];
        }
        if (args.by[0] === 'area') {
          return [{ area: 'QUIZ_OR_ANSWER', _count: { _all: 7 } }];
        }
        if (args.by[0] === 'triageStatus') {
          return [{ triageStatus: 'NEW', _count: { _all: 7 } }];
        }
        return [{ appVersion: '2026.9.0', _count: { _all: 7 } }];
      });
      const output = await adminCaller.getTriageStats({});
      expect(output).toMatchObject({ totals: 12, blocking: 3 });
      expect(output.byAppVersion).toEqual([{ key: '2026.9.0', count: 7 }]);
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.getTriageStats',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'schützt IN_APP-Kennzahlen durch Admin-Authentifizierung',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValueOnce(false);
      await expect(adminCaller.getTriageStats({})).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.list',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'verweigert die Inbox ohne gültige Admin-Session',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValueOnce(false);
      await expect(adminCaller.list({ limit: 25 })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.getDetail',
      case: 'happy',
      mode: 'direct',
      title: 'lädt Freitext ausschließlich im Admin-Detail',
    },
    async () => {
      prismaMock.productFeedback.findUnique.mockResolvedValue(adminFeedbackRow());
      const output = await adminCaller.getDetail({
        id: '11111111-1111-4111-8111-111111111111',
      });
      expect(output.message).toBe('Die Abstimmung blieb hängen.');
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.getDetail',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'meldet fehlendes Admin-Detail typisiert',
    },
    async () => {
      prismaMock.productFeedback.findUnique.mockResolvedValue(null);
      await expect(
        adminCaller.getDetail({ id: '11111111-1111-4111-8111-111111111111' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.updateTriage',
      case: 'happy',
      mode: 'direct',
      title: 'ändert Status und protokolliert nur Triage-Metadaten',
    },
    async () => {
      prismaMock.productFeedback.findUnique.mockResolvedValue(adminFeedbackRow());
      const output = await adminCaller.updateTriage({
        id: '11111111-1111-4111-8111-111111111111',
        status: 'REVIEWED',
      });
      expect(output.ok).toBe(true);
      expect(prismaMock.productFeedbackAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'STATUS_CHANGED',
          fromStatus: 'NEW',
          toStatus: 'REVIEWED',
        }),
      });
      expect(prismaMock.productFeedbackAuditLog.create.mock.calls[0]?.[0].data).not.toHaveProperty(
        'message',
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.updateTriage',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'lehnt Statusänderung für fehlenden Datensatz ab',
    },
    async () => {
      prismaMock.productFeedback.findUnique.mockResolvedValue(null);
      await expect(
        adminCaller.updateTriage({
          id: '11111111-1111-4111-8111-111111111111',
          status: 'REVIEWED',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.linkDuplicate',
      case: 'happy',
      mode: 'direct',
      title: 'bündelt ein Duplikat direkt an einen Hauptdatensatz',
    },
    async () => {
      prismaMock.productFeedback.findUnique.mockResolvedValue(
        adminFeedbackRow({
          id: '22222222-2222-4222-8222-222222222222',
        }),
      );
      const output = await adminCaller.linkDuplicate({
        id: '11111111-1111-4111-8111-111111111111',
        duplicateOfId: '22222222-2222-4222-8222-222222222222',
      });
      expect(output.ok).toBe(true);
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.linkDuplicate',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'verhindert Selbst-Duplikate',
    },
    async () => {
      await expect(
        adminCaller.linkDuplicate({
          id: '11111111-1111-4111-8111-111111111111',
          duplicateOfId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.createIssueDraft',
      case: 'happy',
      mode: 'direct',
      title: 'erzeugt einen Issue-Entwurf ohne Originaltext',
    },
    async () => {
      prismaMock.productFeedback.findUnique.mockResolvedValue(adminFeedbackRow());
      const output = await adminCaller.createIssueDraft({
        id: '11111111-1111-4111-8111-111111111111',
      });
      expect(output.title).toContain('Funktioniert nicht');
      expect(output.body).toContain('Bereich: Quizfrage oder Antwort');
      expect(output.body).not.toContain('Die Abstimmung blieb hängen.');
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.createIssueDraft',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'erzeugt keinen Entwurf für fehlendes Feedback',
    },
    async () => {
      prismaMock.productFeedback.findUnique.mockResolvedValue(null);
      await expect(
        adminCaller.createIssueDraft({ id: '11111111-1111-4111-8111-111111111111' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.linkIssue',
      case: 'happy',
      mode: 'direct',
      title: 'verknüpft ein bestehendes GitHub-Issue',
    },
    async () => {
      const output = await adminCaller.linkIssue({
        id: '11111111-1111-4111-8111-111111111111',
        issueNumber: 42,
        issueUrl: 'https://github.com/kqc-real/arsnova.eu/issues/42',
      });
      expect(output.ok).toBe(true);
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.linkIssue',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt fremde Issue-Hosts ab',
    },
    async () => {
      await expect(
        adminCaller.linkIssue({
          id: '11111111-1111-4111-8111-111111111111',
          issueNumber: 42,
          issueUrl: 'https://example.test/issues/42',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.publishIssue',
      case: 'happy',
      mode: 'direct',
      title: 'veröffentlicht bewusst nur den bereinigten Entwurf',
    },
    async () => {
      const previousRepository = process.env['PRODUCT_FEEDBACK_GITHUB_REPOSITORY'];
      const previousToken = process.env['PRODUCT_FEEDBACK_GITHUB_TOKEN'];
      process.env['PRODUCT_FEEDBACK_GITHUB_REPOSITORY'] = 'kqc-real/arsnova.eu';
      process.env['PRODUCT_FEEDBACK_GITHUB_TOKEN'] = 'test-token';
      prismaMock.productFeedback.findUnique.mockResolvedValue(adminFeedbackRow());
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            number: 43,
            html_url: 'https://github.com/kqc-real/arsnova.eu/issues/43',
          }),
          { status: 201 },
        ),
      );
      try {
        const output = await adminCaller.publishIssue({
          id: '11111111-1111-4111-8111-111111111111',
        });
        expect(output.issueNumber).toBe(43);
        const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        expect(request.body).not.toContain('Die Abstimmung blieb hängen.');
      } finally {
        fetchMock.mockRestore();
        if (previousRepository === undefined)
          delete process.env['PRODUCT_FEEDBACK_GITHUB_REPOSITORY'];
        else process.env['PRODUCT_FEEDBACK_GITHUB_REPOSITORY'] = previousRepository;
        if (previousToken === undefined) delete process.env['PRODUCT_FEEDBACK_GITHUB_TOKEN'];
        else process.env['PRODUCT_FEEDBACK_GITHUB_TOKEN'] = previousToken;
      }
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.publishIssue',
      case: 'error',
      mode: 'direct',
      contract: 'PRECONDITION_FAILED',
      title: 'veröffentlicht ohne explizite Konfiguration nichts',
    },
    async () => {
      delete process.env['PRODUCT_FEEDBACK_GITHUB_REPOSITORY'];
      delete process.env['PRODUCT_FEEDBACK_GITHUB_TOKEN'];
      await expect(
        adminCaller.publishIssue({ id: '11111111-1111-4111-8111-111111111111' }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.clearQuarantine',
      case: 'happy',
      mode: 'direct',
      title: 'gibt quarantänemarkierten Text nachvollziehbar frei',
    },
    async () => {
      const output = await adminCaller.clearQuarantine({
        id: '11111111-1111-4111-8111-111111111111',
      });
      expect(output.ok).toBe(true);
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.clearQuarantine',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'verweigert Quarantänefreigabe ohne Admin-Session',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValueOnce(false);
      await expect(
        adminCaller.clearQuarantine({ id: '11111111-1111-4111-8111-111111111111' }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.delete',
      case: 'happy',
      mode: 'direct',
      title: 'löscht Einzelfeedback endgültig und behält ein textfreies Audit',
    },
    async () => {
      prismaMock.productFeedback.findUnique.mockResolvedValue(adminFeedbackRow());
      const output = await adminCaller.delete({
        id: '11111111-1111-4111-8111-111111111111',
      });
      expect(output.ok).toBe(true);
      expect(prismaMock.productFeedback.delete).toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.productFeedback.delete',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'meldet bereits gelöschtes Feedback typisiert',
    },
    async () => {
      prismaMock.productFeedback.findUnique.mockResolvedValue(null);
      await expect(
        adminCaller.delete({ id: '11111111-1111-4111-8111-111111111111' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );
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
    prismaMock.productFeedbackAuditLog.deleteMany.mockResolvedValue({ count: 0 });
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
