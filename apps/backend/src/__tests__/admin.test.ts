import { TRPCError } from '@trpc/server';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  createAdminSessionTokenMock,
  invalidateAdminSessionTokenMock,
  verifyAdminSecretMock,
  checkAdminLoginAttemptMock,
  rejectInvalidAdminLoginMock,
  requireAdminLoginAttemptPermitMock,
  recordAdminLoginFailureMock,
  logAdminLoginFailureMock,
  extractAdminTokenMock,
  isAdminSessionTokenValidMock,
  fetchSecurityStatsMock,
} = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    platformStatistic: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    session: {
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    quiz: {
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAdminSessionTokenMock: vi.fn(),
  invalidateAdminSessionTokenMock: vi.fn(),
  verifyAdminSecretMock: vi.fn(),
  checkAdminLoginAttemptMock: vi.fn(),
  rejectInvalidAdminLoginMock: vi.fn(),
  requireAdminLoginAttemptPermitMock: vi.fn(),
  recordAdminLoginFailureMock: vi.fn(),
  logAdminLoginFailureMock: vi.fn(),
  extractAdminTokenMock: vi.fn(),
  isAdminSessionTokenValidMock: vi.fn(),
  fetchSecurityStatsMock: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/adminAuth', () => ({
  createAdminSessionToken: createAdminSessionTokenMock,
  invalidateAdminSessionToken: invalidateAdminSessionTokenMock,
  verifyAdminSecret: verifyAdminSecretMock,
  extractAdminToken: extractAdminTokenMock,
  isAdminSessionTokenValid: isAdminSessionTokenValidMock,
}));

vi.mock('../lib/adminLoginProtection', () => ({
  checkAdminLoginAttempt: checkAdminLoginAttemptMock,
  rejectInvalidAdminLogin: rejectInvalidAdminLoginMock,
  requireAdminLoginAttemptPermit: requireAdminLoginAttemptPermitMock,
}));

vi.mock('../lib/abuseTelemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/abuseTelemetry')>()),
  recordAdminLoginFailure: recordAdminLoginFailureMock,
  logAdminLoginFailure: logAdminLoginFailureMock,
}));

vi.mock('../routers/health', () => ({
  fetchSecurityStats: fetchSecurityStatsMock,
}));

import { adminRouter } from '../routers/admin';

const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const SESSION_CODE = 'ABC123';

describe('admin router (Epic 9)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
    vi.clearAllMocks();
    verifyAdminSecretMock.mockReturnValue(true);
    checkAdminLoginAttemptMock.mockResolvedValue({ allowed: true, delayMs: 100 });
    requireAdminLoginAttemptPermitMock.mockImplementation(
      (decision: { allowed: boolean; retryAfterSeconds?: number }) => {
        if (!decision.allowed) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Zu viele Admin-Login-Versuche. Bitte später erneut versuchen.',
            cause: { retryAfterSeconds: decision.retryAfterSeconds },
          });
        }
      },
    );
    rejectInvalidAdminLoginMock.mockRejectedValue(
      new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Ungültige Admin-Zugangsdaten.',
      }),
    );
    createAdminSessionTokenMock.mockResolvedValue({
      token: 'admin-token-1234567890-abcdefghijklmnopqrstuvwxyz',
      expiresAt: new Date('2026-03-14T12:00:00.000Z'),
    });
    extractAdminTokenMock.mockReturnValue('token-xyz');
    isAdminSessionTokenValidMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  trpcDodIt(
    {
      procedure: 'admin.login',
      case: 'happy',
      mode: 'direct',
      title: 'loggt Admin mit gültigem Secret ein',
    },
    async () => {
      const caller = adminRouter.createCaller({ req: undefined });
      const result = await caller.login({ secret: 'topsecret' });

      expect(verifyAdminSecretMock).toHaveBeenCalledWith('topsecret');
      expect(result.token).toBe('admin-token-1234567890-abcdefghijklmnopqrstuvwxyz');
      expect(result.expiresAt).toBe('2026-03-14T12:00:00.000Z');
      expect(checkAdminLoginAttemptMock).toHaveBeenCalledOnce();
      expect(rejectInvalidAdminLoginMock).not.toHaveBeenCalled();
      expect(recordAdminLoginFailureMock).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.monitoringStats',
      case: 'happy',
      mode: 'direct',
      title: 'liefert Monitoring-Metriken ausschließlich über eine gültige Admin-Session',
    },
    async () => {
      const stats = {
        databaseStatus: 'ok',
        sessionCreatePerHour: 120,
        sessionCreateGlobalPerHour: 1_000,
        sessionCodeClientFailuresPerWindow: 20,
        pdfActiveJobs: 0,
        pdfMaxConcurrentJobs: 1,
        pdfCompletedLastMinute: 2,
        pdfFailedLastMinute: 0,
        pdfRejectedLastMinute: 0,
        sessionCreatesLastMinute: 3,
        adminLoginFailuresLastMinute: 0,
        cspReportsReceivedLastMinute: 0,
        cspReportsDroppedLastMinute: 0,
        cspReportsRateLimitedLastMinute: 0,
        cspReportsEvalLastMinute: 0,
        cspReportsScriptHttpsLastMinute: 0,
        rateLimit429LastMinute: 1,
        rateLimit429AlertLastMinute: 1,
        rateLimit429ByCategoryLastMinute: {
          adminLogin: 0,
          sessionCreate: 1,
          quizUpload: 0,
          quickFeedback: 0,
          sessionCode: 0,
          sessionCodeReconnect: 0,
          vote: 0,
          pdf: 0,
          motd: 0,
          other: 0,
        },
        sessionCodeFailuresLastMinute: 4,
        sessionCodeFailuresBySourceLastMinute: { join: 1, lookup: 1, pollReconnect: 2, other: 0 },
        sessionCodeEntryFailuresLastMinute: 2,
        sessionCodeSoftCapDelaysLastMinute: 0,
        sessionCodeSoftCapDelaysBySourceLastMinute: {
          join: 0,
          lookup: 0,
          pollReconnect: 0,
          other: 0,
        },
        sessionCodeEntrySoftCapDelaysLastMinute: 0,
        sessionCodeGlobalSoftCapUtilizationPercent: 2,
        trpcWebSocketConnectionsActive: 12,
        trpcWebSocketConnectionLimit: 1_000,
        trpcWebSocketBoundConnectionsActive: 10,
        trpcWebSocketSessionConnectionLimit: 800,
        trpcWebSocketParticipantConnectionLimit: 2,
        trpcWebSocketSessionCapRejectedLastMinute: 0,
        trpcWebSocketParticipantCapRejectedLastMinute: 0,
        trpcWebSocketRejectedUpgradesLastMinute: 0,
        trpcWebSocketPayloadRejectedLastMinute: 0,
        trpcWebSocketRateLimitedMessagesLastMinute: 0,
        yjsWebSocketConnectionsActive: 6,
        yjsWebSocketRoomsActive: 2,
        yjsWebSocketConnectionLimit: 1_000,
        yjsWebSocketPerRoomConnectionLimit: 200,
        yjsWebSocketRejectedUpgradesLastMinute: 0,
        yjsWebSocketRejectedUpgradesByReasonLastMinute: {
          globalRate: 0,
          invalidPath: 0,
          authorizationUnavailable: 0,
          legacyCutoff: 0,
          tokenRequired: 0,
          invalidToken: 0,
          staleGeneration: 0,
          roomRate: 0,
          globalConnectionCap: 0,
          roomConnectionCap: 0,
        },
        yjsWebSocketPayloadRejectedLastMinute: 0,
        yjsWebSocketRateLimitedMessagesLastMinute: 0,
        yjsWebSocketProtocolErrorsLastMinute: 0,
        yjsWebSocketDocumentRejectedLastMinute: 0,
        yjsWebSocketAwarenessRejectedLastMinute: 0,
        yjsWebSocketOutboundRejectedLastMinute: 0,
      };
      fetchSecurityStatsMock.mockResolvedValue(stats);
      const caller = adminRouter.createCaller({ req: {} as never });

      await expect(caller.monitoringStats()).resolves.toEqual(stats);

      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(caller.monitoringStats()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
      expect(fetchSecurityStatsMock).toHaveBeenCalledOnce();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.login',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'härtet ungültige Admin-Logins progressiv und erfasst sie',
    },
    async () => {
      verifyAdminSecretMock.mockReturnValue(false);
      const caller = adminRouter.createCaller({ req: undefined });

      await expect(caller.login({ secret: 'falsch' })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });

      expect(rejectInvalidAdminLoginMock).toHaveBeenCalledWith(100);
      expect(recordAdminLoginFailureMock).toHaveBeenCalledOnce();
      expect(logAdminLoginFailureMock).toHaveBeenCalledWith(100);
      expect(createAdminSessionTokenMock).not.toHaveBeenCalled();
    },
  );

  it('prüft nach ausgeschöpftem Pre-Auth-Budget kein weiteres Secret', async () => {
    checkAdminLoginAttemptMock.mockResolvedValue({
      allowed: false,
      delayMs: 0,
      retryAfterSeconds: 42,
    });
    const caller = adminRouter.createCaller({ req: undefined });

    await expect(caller.login({ secret: 'nicht-pruefen' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      cause: { retryAfterSeconds: 42 },
    });

    expect(verifyAdminSecretMock).not.toHaveBeenCalled();
    expect(recordAdminLoginFailureMock).toHaveBeenCalledOnce();
    expect(logAdminLoginFailureMock).not.toHaveBeenCalled();
    expect(createAdminSessionTokenMock).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'admin.setLegalHold',
      case: 'happy',
      mode: 'direct',
      title: 'setzt Legal Hold mit Default-Laufzeit',
    },
    async () => {
      const caller = adminRouter.createCaller({ req: {} as never });
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'FINISHED',
        legalHoldUntil: null,
        endedAt: new Date(),
        legalHoldReason: null,
      });
      prismaMock.session.update.mockResolvedValue({});

      const result = await caller.setLegalHold({
        sessionId: SESSION_ID,
        enabled: true,
        reason: 'Behördenfall',
      });

      expect(prismaMock.session.update).toHaveBeenCalled();
      expect(result.window).toBe('POST_SESSION_24H');
      expect(result.legalHoldReason).toBe('Behördenfall');
      expect(result.legalHoldUntil).toBeTruthy();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.deleteSession',
      case: 'happy',
      mode: 'direct',
      title: 'löscht Session endgültig und schreibt Audit-Log',
    },
    async () => {
      const caller = adminRouter.createCaller({ req: {} as never });
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: SESSION_CODE,
        status: 'FINISHED',
        endedAt: new Date(),
        legalHoldUntil: null,
        legalHoldReason: null,
        quizId: '11111111-1111-4111-8111-111111111111',
      });
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<void>) =>
          fn({
            ...prismaMock,
            session: {
              ...prismaMock.session,
              delete: vi.fn().mockResolvedValue({}),
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
              count: vi.fn().mockResolvedValue(0),
            },
            quiz: {
              ...prismaMock.quiz,
              delete: vi.fn().mockResolvedValue({}),
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            adminAuditLog: {
              ...prismaMock.adminAuditLog,
              create: vi.fn().mockResolvedValue({}),
            },
          }),
      );

      const result = await caller.deleteSession({
        sessionId: SESSION_ID,
        reason: 'Rechtliche Löschpflicht',
      });

      expect(result).toEqual({
        deleted: true,
        sessionId: SESSION_ID,
        sessionCode: SESSION_CODE,
      });
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.exportForAuthorities',
      case: 'happy',
      mode: 'direct',
      title: 'exportiert nur durchgeführte Fragen als JSON und schreibt Audit-Log',
    },
    async () => {
      const caller = adminRouter.createCaller({ req: {} as never });
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: SESSION_CODE,
        type: 'QUIZ',
        status: 'FINISHED',
        title: null,
        startedAt: new Date('2026-03-14T08:00:00.000Z'),
        endedAt: new Date('2026-03-14T09:00:00.000Z'),
        legalHoldUntil: null,
        legalHoldReason: null,
        questionProgressComplete: true,
        questionProgress: {
          '22222222-2222-4222-8222-222222222222': {
            state: 'COMPLETED',
            openedAt: '2026-03-14T08:15:00.000Z',
            completedAt: '2026-03-14T08:16:00.000Z',
          },
          '33333333-3333-4333-8333-333333333333': {
            state: 'SKIPPED',
            openedAt: '2026-03-14T08:17:00.000Z',
            skippedAt: '2026-03-14T08:18:00.000Z',
          },
        },
        quiz: {
          name: 'Behördenquiz',
          questions: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              order: 0,
              text: 'Frage 1',
              type: 'SINGLE_CHOICE',
              answers: [
                { id: 'a1', text: 'A', isCorrect: true },
                { id: 'a2', text: 'B', isCorrect: false },
              ],
            },
            {
              id: '33333333-3333-4333-8333-333333333333',
              order: 1,
              text: 'Ausgelassene Frage',
              type: 'SINGLE_CHOICE',
              answers: [{ id: 'a3', text: 'C', isCorrect: true }],
            },
          ],
        },
        votes: [
          {
            questionId: '22222222-2222-4222-8222-222222222222',
            ratingValue: null,
            freeText: null,
            selectedAnswers: [{ answerOptionId: 'a1' }],
          },
          {
            questionId: '33333333-3333-4333-8333-333333333333',
            ratingValue: null,
            freeText: null,
            selectedAnswers: [{ answerOptionId: 'a3' }],
          },
        ],
        _count: { participants: 4 },
      });
      prismaMock.adminAuditLog.create.mockResolvedValue({});

      const result = await caller.exportForAuthorities({
        sessionId: SESSION_ID,
        format: 'JSON',
        reason: 'Behördenanfrage',
      });

      expect(result.format).toBe('JSON');
      expect(result.mimeType).toBe('application/json');
      expect(result.fileName.endsWith('.json')).toBe(true);
      expect(result.contentBase64.length).toBeGreaterThan(10);
      const payload = JSON.parse(Buffer.from(result.contentBase64, 'base64').toString('utf8'));
      expect(payload.quiz.questions).toHaveLength(1);
      expect(payload.quiz.questions[0]).toMatchObject({ order: 0, text: 'Frage 1' });
      expect(payload.aggregates).toHaveLength(1);
      expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'EXPORT_FOR_AUTHORITIES',
            sessionId: SESSION_ID,
            sessionCode: SESSION_CODE,
          }),
        }),
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.exportSessionAsQuizImport',
      case: 'happy',
      mode: 'direct',
      title: 'exportiert Session als importierbares Quiz-JSON',
    },
    async () => {
      const caller = adminRouter.createCaller({ req: {} as never });
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: SESSION_CODE,
        status: 'FINISHED',
        type: 'QUIZ',
        endedAt: new Date('2026-03-14T09:00:00.000Z'),
        legalHoldUntil: null,
        legalHoldReason: null,
        quiz: {
          name: 'Importierbares Quiz',
          description: 'Beschreibung',
          motifImageUrl: null,
          motifImageCredit: null,
          showLeaderboard: true,
          allowCustomNicknames: true,
          defaultTimer: 30,
          enableSoundEffects: true,
          enableRewardEffects: true,
          enableMotivationMessages: true,
          enableEmojiReactions: true,
          anonymousMode: false,
          teamMode: false,
          teamCount: null,
          teamAssignment: 'AUTO',
          teamNames: [],
          backgroundMusic: null,
          nicknameTheme: 'NOBEL_LAUREATES',
          bonusTokenCount: null,
          readingPhaseEnabled: true,
          preset: 'PLAYFUL',
          questions: [
            {
              text: 'Was ist 2+2?',
              type: 'SINGLE_CHOICE',
              timer: 30,
              difficulty: 'EASY',
              order: 0,
              ratingMin: null,
              ratingMax: null,
              ratingLabelMin: null,
              ratingLabelMax: null,
              answers: [
                { text: '4', isCorrect: true },
                { text: '5', isCorrect: false },
              ],
            },
          ],
        },
      });
      prismaMock.adminAuditLog.create.mockResolvedValue({});

      const result = await caller.exportSessionAsQuizImport({
        sessionId: SESSION_ID,
      });

      expect(result.format).toBe('JSON');
      expect(result.mimeType).toBe('application/json');
      expect(result.fileName.endsWith('.json')).toBe(true);
      const payloadRaw = Buffer.from(result.contentBase64, 'base64').toString('utf8');
      const payload = JSON.parse(payloadRaw) as { exportVersion: number; quiz: { name: string } };
      expect(payload.exportVersion).toBe(1);
      expect(payload.quiz.name).toBe('Importierbares Quiz');
      expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'EXPORT_FOR_AUTHORITIES',
            sessionId: SESSION_ID,
            sessionCode: SESSION_CODE,
            reason: 'QUIZ_IMPORT_EXPORT',
          }),
        }),
      );
    },
  );

  it('exportiert SHORT_TEXT-Konfiguration im Quiz-JSON', async () => {
    const caller = adminRouter.createCaller({ req: {} as never });
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: SESSION_CODE,
      status: 'FINISHED',
      type: 'QUIZ',
      endedAt: new Date('2026-03-14T09:00:00.000Z'),
      legalHoldUntil: null,
      legalHoldReason: null,
      quiz: {
        name: 'Kurzantwort Export',
        description: null,
        motifImageUrl: null,
        motifImageCredit: null,
        showLeaderboard: true,
        allowCustomNicknames: true,
        defaultTimer: 30,
        enableSoundEffects: true,
        enableRewardEffects: true,
        enableMotivationMessages: true,
        enableEmojiReactions: true,
        showQuestionTypeIndicators: true,
        anonymousMode: false,
        teamMode: false,
        teamCount: null,
        teamAssignment: 'AUTO',
        teamNames: [],
        backgroundMusic: null,
        nicknameTheme: 'NOBEL_LAUREATES',
        bonusTokenCount: null,
        readingPhaseEnabled: true,
        preset: 'PLAYFUL',
        questions: [
          {
            text: 'Wer schrieb den ersten Algorithmus?',
            type: 'SHORT_TEXT',
            timer: null,
            difficulty: 'MEDIUM',
            order: 0,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            shortTextMaxLength: 40,
            shortTextCaseSensitive: false,
            answers: [
              { text: 'Ada Lovelace', isCorrect: true },
              { text: 'Ada', isCorrect: true },
            ],
          },
        ],
      },
    });
    prismaMock.adminAuditLog.create.mockResolvedValue({});

    const result = await caller.exportSessionAsQuizImport({
      sessionId: SESSION_ID,
    });

    const payloadRaw = Buffer.from(result.contentBase64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadRaw) as {
      quiz: {
        questions: Array<{
          type: string;
          shortTextMaxLength?: number;
          shortTextCaseSensitive?: boolean;
        }>;
      };
    };

    expect(payload.quiz.questions[0]).toMatchObject({
      type: 'SHORT_TEXT',
      shortTextMaxLength: 40,
      shortTextCaseSensitive: false,
    });
  });

  trpcDodIt(
    {
      procedure: 'admin.listSessions',
      case: 'happy',
      mode: 'direct',
      title: 'listet Sessions nach Statuspriorität und letzter Aktivität',
    },
    async () => {
      const caller = adminRouter.createCaller({ req: {} as never });
      prismaMock.session.findMany.mockResolvedValue([
        {
          id: '11111111-1111-4111-8111-111111111111',
          code: 'PAUS01',
          type: 'QUIZ',
          status: 'PAUSED',
          quiz: { name: 'Pause' },
          _count: { participants: 2 },
          startedAt: new Date('2026-03-14T08:00:00.000Z'),
          statusChangedAt: new Date('2026-03-14T11:30:00.000Z'),
          endedAt: null,
          legalHoldUntil: null,
          legalHoldReason: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          code: 'ACTV02',
          type: 'QUIZ',
          status: 'ACTIVE',
          quiz: { name: 'Aktiv neu' },
          _count: { participants: 8 },
          startedAt: new Date('2026-03-14T09:00:00.000Z'),
          statusChangedAt: new Date('2026-03-14T11:50:00.000Z'),
          endedAt: null,
          legalHoldUntil: null,
          legalHoldReason: null,
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          code: 'ACTV01',
          type: 'QUIZ',
          status: 'ACTIVE',
          quiz: { name: 'Aktiv alt' },
          _count: { participants: 5 },
          startedAt: new Date('2026-03-14T08:30:00.000Z'),
          statusChangedAt: new Date('2026-03-14T11:10:00.000Z'),
          endedAt: null,
          legalHoldUntil: null,
          legalHoldReason: null,
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          code: 'FINI01',
          type: 'QUIZ',
          status: 'FINISHED',
          quiz: { name: 'Beendet' },
          _count: { participants: 3 },
          startedAt: new Date('2026-03-14T07:00:00.000Z'),
          statusChangedAt: new Date('2026-03-14T10:00:00.000Z'),
          endedAt: new Date('2026-03-14T10:00:00.000Z'),
          legalHoldUntil: null,
          legalHoldReason: null,
        },
      ]);

      const result = await caller.listSessions({ page: 1, pageSize: 25 });

      expect(result.total).toBe(4);
      expect(result.sessions.map((session) => session.sessionCode)).toEqual([
        'ACTV02',
        'ACTV01',
        'PAUS01',
        'FINI01',
      ]);
      expect(result.sessions[0]?.lastActivityAt).toBe('2026-03-14T11:50:00.000Z');
      expect(result.sessions[3]?.retention.window).toBe('POST_SESSION_24H');
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.deleteAllSessions',
      case: 'happy',
      mode: 'direct',
      title: 'löscht alle Sessions nach Sicherheitsabfrage',
    },
    async () => {
      const caller = adminRouter.createCaller({ req: {} as never });
      prismaMock.session.count.mockResolvedValue(2);
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
          fn({
            ...prismaMock,
            session: {
              ...prismaMock.session,
              deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
            },
            quiz: {
              ...prismaMock.quiz,
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            adminAuditLog: {
              ...prismaMock.adminAuditLog,
              create: vi.fn().mockResolvedValue({}),
            },
          }),
      );

      const result = await caller.deleteAllSessions({
        confirmationText: 'ALLE SESSIONS LOESCHEN',
        expectedSessionCount: 2,
        reason: 'Komplett bereinigen',
      });

      expect(result).toEqual({
        deleted: true,
        deletedSessionCount: 2,
        deletedQuizCount: 1,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.resetMaxParticipantsRecord',
      case: 'happy',
      mode: 'direct',
      title: 'setzt Rekord-Teilnehmerzahl mit Sicherheitsabfrage auf 0 zurück',
    },
    async () => {
      const caller = adminRouter.createCaller({ req: {} as never });
      prismaMock.$queryRaw.mockResolvedValue([{ maxParticipantsSingleSession: 120 }]);
      prismaMock.$executeRaw.mockResolvedValue(1);

      const result = await caller.resetMaxParticipantsRecord({
        confirmationText: 'REKORD RESETZEN',
      });

      expect(result).toEqual({
        reset: true,
        previousMaxParticipantsSingleSession: 120,
        currentMaxParticipantsSingleSession: 0,
      });
      expect(prismaMock.$executeRaw).toHaveBeenCalled();
    },
  );
});

describe('admin router DoD authentication boundary', () => {
  beforeEach(() => {
    extractAdminTokenMock.mockReturnValue('token-xyz');
    isAdminSessionTokenValidMock.mockResolvedValue(true);
  });

  trpcDodIt(
    {
      procedure: 'admin.whoami',
      case: 'happy',
      mode: 'direct',
      title: 'admin.whoami bestätigt gültige Sitzung',
    },
    async () => {
      await expect(adminRouter.createCaller({ req: {} as never }).whoami()).resolves.toEqual({
        authenticated: true,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.logout',
      case: 'happy',
      mode: 'direct',
      title: 'admin.logout invalidiert gültige Sitzung',
    },
    async () => {
      await expect(adminRouter.createCaller({ req: {} as never }).logout()).resolves.toEqual({
        authenticated: true,
      });
      expect(invalidateAdminSessionTokenMock).toHaveBeenCalledWith('token-xyz');
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.getSessionByCode',
      case: 'happy',
      mode: 'direct',
      title: 'admin.getSessionByCode liefert eine aufbewahrte Session mit Fragen',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: SESSION_CODE,
        type: 'QUIZ',
        status: 'FINISHED',
        title: 'Audit',
        startedAt: new Date(),
        statusChangedAt: new Date(),
        endedAt: new Date(),
        legalHoldUntil: null,
        legalHoldReason: null,
        quiz: {
          name: 'Audit-Quiz',
          questions: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              order: 0,
              text: 'Frage',
              type: 'SINGLE_CHOICE',
              answers: [],
            },
          ],
        },
        _count: { participants: 2 },
      });
      const result = await adminRouter
        .createCaller({ req: {} as never })
        .getSessionByCode({ code: SESSION_CODE });
      expect(result).toMatchObject({
        title: 'Audit',
        session: { sessionCode: SESSION_CODE },
        questions: [{ text: 'Frage' }],
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.getSessionDetail',
      case: 'happy',
      mode: 'direct',
      title: 'admin.getSessionDetail liefert eine aufbewahrte Session per ID',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: SESSION_CODE,
        type: 'QUIZ',
        status: 'FINISHED',
        title: null,
        startedAt: new Date(),
        statusChangedAt: new Date(),
        endedAt: new Date(),
        legalHoldUntil: null,
        legalHoldReason: null,
        quiz: { name: 'Audit-Quiz', questions: [] },
        _count: { participants: 2 },
      });
      const result = await adminRouter
        .createCaller({ req: {} as never })
        .getSessionDetail({ sessionId: SESSION_ID });
      expect(result.session).toMatchObject({ sessionId: SESSION_ID, sessionCode: SESSION_CODE });
      expect(prismaMock.session.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SESSION_ID } }),
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.deleteAllSessions',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.deleteAllSessions weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(
        adminRouter.createCaller({ req: {} as never }).deleteAllSessions({} as never),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.deleteSession',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.deleteSession weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(
        adminRouter.createCaller({ req: {} as never }).deleteSession({} as never),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.exportForAuthorities',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.exportForAuthorities weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(
        adminRouter.createCaller({ req: {} as never }).exportForAuthorities({} as never),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.exportSessionAsQuizImport',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.exportSessionAsQuizImport weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(
        adminRouter.createCaller({ req: {} as never }).exportSessionAsQuizImport({} as never),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.getSessionByCode',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.getSessionByCode weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(
        adminRouter.createCaller({ req: {} as never }).getSessionByCode({} as never),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.getSessionDetail',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.getSessionDetail weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(
        adminRouter.createCaller({ req: {} as never }).getSessionDetail({} as never),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.listSessions',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.listSessions weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(
        adminRouter.createCaller({ req: {} as never }).listSessions({} as never),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.logout',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.logout weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(adminRouter.createCaller({ req: {} as never }).logout()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.monitoringStats',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.monitoringStats weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(
        adminRouter.createCaller({ req: {} as never }).monitoringStats(),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.resetMaxParticipantsRecord',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.resetMaxParticipantsRecord weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(
        adminRouter.createCaller({ req: {} as never }).resetMaxParticipantsRecord({} as never),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.setLegalHold',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.setLegalHold weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(
        adminRouter.createCaller({ req: {} as never }).setLegalHold({} as never),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.whoami',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.whoami weist abgelaufene Admin-Sitzungen ab',
    },
    async () => {
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expect(adminRouter.createCaller({ req: {} as never }).whoami()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    },
  );
});
