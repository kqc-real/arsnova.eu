import type { IncomingMessage } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks, participantAuthMocks, qaTelemetryMocks, rawQueryResults } =
  vi.hoisted(() => ({
    rawQueryResults: {
      createQuestion: [] as Array<unknown[] | Error>,
      changeVote: [] as Array<unknown[] | Error>,
      rankedQuestions: [] as Array<unknown[] | Error>,
    },
    prismaMock: {
      session: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      participant: {
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      qaQuestion: {
        findMany: vi.fn(),
        aggregate: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      qaUpvote: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        groupBy: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $transaction: vi.fn(),
    },
    hostAuthMocks: {
      extractHostTokenMock: vi.fn(),
      extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
      isHostSessionTokenValidMock: vi.fn(),
    },
    participantAuthMocks: {
      assertParticipantCapabilityMock: vi.fn(),
    },
    qaTelemetryMocks: {
      recordQaQuestionAccepted: vi.fn(),
      recordQaRatingChanged: vi.fn(),
    },
  }));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

vi.mock('../lib/participantAuth', () => ({
  assertParticipantCapability: participantAuthMocks.assertParticipantCapabilityMock,
}));

vi.mock('../lib/qaTelemetry', () => ({
  recordQaQuestionAccepted: qaTelemetryMocks.recordQaQuestionAccepted,
  recordQaRatingChanged: qaTelemetryMocks.recordQaRatingChanged,
}));

import { emitQaQuestionsSignal, resetQaQuestionsSignalsForTests } from '../lib/qaQuestionsSignal';
import { qaRouter, resetSharedQaRankingCacheForTests } from '../routers/qa';

function hostCtx(token: string | null) {
  return {
    req: {
      headers: token ? { 'x-host-token': token } : {},
    } as IncomingMessage,
  };
}

const caller = qaRouter.createCaller(hostCtx(null));
const hostCaller = qaRouter.createCaller(hostCtx('host-token-123'));
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const PARTICIPANT_ID = '33333333-3333-4333-8333-333333333333';
const QUESTION_ID = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY_KEY = '55555555-5555-4555-8555-555555555555';
const OTHER_PARTICIPANT_ID = '66666666-6666-4666-8666-666666666666';
const ACTIVE_QA_SESSION = {
  id: SESSION_ID,
  code: 'CODE12',
  status: 'ACTIVE',
  endedAt: null,
  expiresAt: new Date('2099-01-02T00:00:00.000Z'),
  qaClosesAt: new Date('2099-01-01T00:00:00.000Z'),
  sessionLifecycleRevision: 1,
  qaRankingRevision: 7,
  qaQuestionCount: 0,
  onboardingAnonymousMode: false,
};

type SqlLike = {
  strings: readonly string[];
  values: readonly unknown[];
};

type RankedQaTestRow = {
  id: string;
  participantId: string;
  text: string;
  upvoteCount: number;
  status: 'PENDING' | 'ACTIVE' | 'PINNED' | 'ARCHIVED' | 'DELETED';
  createdAt: Date;
  authorNickname: string | null;
  authorTeamName: string | null;
  myVote: 'UP' | 'DOWN' | null;
  positiveVoteCount: number;
  negativeVoteCount: number;
  bestScore: number;
  controversyScore: number;
  totalCount: number;
};

function isSqlLike(value: unknown): value is SqlLike {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SqlLike>;
  return Array.isArray(candidate.strings) && Array.isArray(candidate.values);
}

function renderSql(strings: readonly string[], values: readonly unknown[]): string {
  return strings
    .map((part, index) => {
      if (index >= values.length) return part;
      const value = values[index];
      return `${part}${isSqlLike(value) ? renderSql(value.strings, value.values) : '?'}`;
    })
    .join('');
}

function rawSqlText(call: readonly unknown[]): string {
  const [query, ...values] = call;
  if (Array.isArray(query)) {
    return renderSql(query as readonly string[], values);
  }
  return isSqlLike(query) ? renderSql(query.strings, query.values) : String(query);
}

function takeRawResult(results: Array<unknown[] | Error>): unknown[] {
  const result = results.shift() ?? [];
  if (result instanceof Error) throw result;
  return result;
}

function rankedQaRow(overrides: Partial<RankedQaTestRow> = {}): RankedQaTestRow {
  return {
    id: QUESTION_ID,
    participantId: OTHER_PARTICIPANT_ID,
    text: 'Testfrage',
    upvoteCount: 0,
    status: 'ACTIVE',
    createdAt: new Date('2026-03-13T12:00:00.000Z'),
    authorNickname: null,
    authorTeamName: null,
    myVote: null,
    positiveVoteCount: 0,
    negativeVoteCount: 0,
    bestScore: 0,
    controversyScore: 0,
    totalCount: 1,
    ...overrides,
  };
}

describe('qa router (Epic 8)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    resetQaQuestionsSignalsForTests();
    resetSharedQaRankingCacheForTests();
    vi.resetAllMocks();
    rawQueryResults.createQuestion.length = 0;
    rawQueryResults.changeVote.length = 0;
    rawQueryResults.rankedQuestions.length = 0;
    hostAuthMocks.extractHostTokenMock.mockImplementation((req: unknown) => {
      const t = (req as { headers?: { 'x-host-token'?: string } } | undefined)?.headers?.[
        'x-host-token'
      ];
      return typeof t === 'string' ? t : null;
    });
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    qaTelemetryMocks.recordQaQuestionAccepted.mockResolvedValue(undefined);
    qaTelemetryMocks.recordQaRatingChanged.mockResolvedValue(undefined);
    prismaMock.$queryRaw.mockImplementation(async (...call: unknown[]) => {
      const sql = rawSqlText(call);
      if (sql.includes('arsnova_create_qa_question')) {
        return takeRawResult(rawQueryResults.createQuestion);
      }
      if (sql.includes('arsnova_change_qa_vote')) {
        return takeRawResult(rawQueryResults.changeVote);
      }
      if (sql.includes('WITH scored AS')) {
        return takeRawResult(rawQueryResults.rankedQuestions);
      }
      throw new Error(`Unerwartete Raw-SQL-Abfrage: ${sql}`);
    });
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (input: unknown) =>
      typeof input === 'function'
        ? (input as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock)
        : Promise.all(input as Promise<unknown>[]),
    );
    prismaMock.qaQuestion.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { updatedAt: null },
      _sum: { upvoteCount: 0 },
    });
    prismaMock.qaQuestion.count.mockResolvedValue(0);
    prismaMock.participant.count.mockResolvedValue(0);
    prismaMock.qaUpvote.findMany.mockResolvedValue([]);
    prismaMock.qaUpvote.groupBy.mockResolvedValue([]);
  });

  trpcDodIt(
    {
      procedure: 'qa.list',
      case: 'happy',
      mode: 'direct',
      title: 'liefert sichtbare Fragen für einen Teilnehmer inklusive Upvote-Status',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        id: SESSION_ID,
        code: 'CODE12',
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: false,
      });
      rawQueryResults.rankedQuestions.push([
        rankedQaRow({
          id: QUESTION_ID,
          text: 'Was ist klausurrelevant?',
          upvoteCount: 4,
          myVote: 'UP',
          positiveVoteCount: 4,
          bestScore: 0.5101,
        }),
      ]);
      prismaMock.qaUpvote.findMany.mockResolvedValue([
        { participantId: PARTICIPANT_ID, qaQuestionId: QUESTION_ID, direction: 'UP' },
      ]);

      const { questions: result } = await caller.list({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
      });

      expect(result).toEqual([
        {
          id: QUESTION_ID,
          text: 'Was ist klausurrelevant?',
          upvoteCount: 4,
          status: 'ACTIVE',
          createdAt: '2026-03-13T12:00:00.000Z',
          hasUpvoted: true,
          isOwn: false,
          myVote: 'UP',
        },
      ]);
      expect(result[0]).not.toHaveProperty('controversyScore');
      expect(result[0]).not.toHaveProperty('isControversial');
      expect(result[0]).not.toHaveProperty('bestScore');
      expect(result[0]).not.toHaveProperty('positiveVoteCount');
      expect(result[0]).not.toHaveProperty('negativeVoteCount');
      expect(result[0]).not.toHaveProperty('moderationCompass');
      expect(result[0]).not.toHaveProperty('compassCards');
      const sql = rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? []);
      expect(sql).toContain(`WHEN 'ACTIVE' THEN 1`);
      expect(sql).not.toContain('GREATEST(');
      expect(sql).not.toContain('POWER(');
    },
  );

  it('teilt dieselbe öffentliche Q&A-Seite nach Revision zwischen Teilnahmen', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 1,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        text: 'Geteilte Seite',
        upvoteCount: 2,
        totalCount: 1,
      }),
    ]);
    prismaMock.qaUpvote.findMany.mockResolvedValue([]);
    prismaMock.qaQuestion.count.mockResolvedValue(0);

    const [first, second] = await Promise.all([
      caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID }),
      caller.list({ sessionId: SESSION_ID, participantId: OTHER_PARTICIPANT_ID }),
    ]);
    const third = await caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID });

    expect(first.questions[0]?.text).toBe('Geteilte Seite');
    expect(second.questions[0]?.text).toBe('Geteilte Seite');
    expect(third.questions[0]?.text).toBe('Geteilte Seite');
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? []);
    expect(sql).toContain(`question."status" IN ('ACTIVE', 'PINNED', 'ARCHIVED')`);
    expect(sql).not.toContain(`question."status" = 'PENDING'`);
  });

  it('gibt fremde PENDING-Fragen nicht über den gemeinsamen Seiten-Cache preis', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 2,
    });
    prismaMock.qaQuestion.count.mockImplementation(
      async (args?: { where?: { participantId?: string; status?: string } }) => {
        if (args?.where?.status === 'PENDING' && args.where.participantId === PARTICIPANT_ID) {
          return 1;
        }
        return 0;
      },
    );
    rawQueryResults.rankedQuestions.push(
      [
        rankedQaRow({
          id: '77777777-7777-4777-8777-777777777777',
          participantId: PARTICIPANT_ID,
          text: 'Noch ungeprüfte Frage von A',
          status: 'PENDING',
          totalCount: 2,
        }),
        rankedQaRow({
          text: 'Öffentlich freigegeben',
          totalCount: 2,
        }),
      ],
      [
        rankedQaRow({
          text: 'Öffentlich freigegeben',
          totalCount: 1,
        }),
      ],
    );

    const authorPage = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });
    const otherPage = await caller.list({
      sessionId: SESSION_ID,
      participantId: OTHER_PARTICIPANT_ID,
    });

    expect(authorPage.questions.map((question) => question.text)).toEqual([
      'Noch ungeprüfte Frage von A',
      'Öffentlich freigegeben',
    ]);
    expect(otherPage.questions.map((question) => question.text)).toEqual([
      'Öffentlich freigegeben',
    ]);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    const authorSql = rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? []);
    const otherSql = rawSqlText(prismaMock.$queryRaw.mock.calls[1] ?? []);
    expect(authorSql).toContain(`question."status" = 'PENDING'`);
    expect(otherSql).not.toContain(`question."status" = 'PENDING'`);

    resetSharedQaRankingCacheForTests();
    prismaMock.$queryRaw.mockImplementation(async (...call: unknown[]) => {
      const sql = rawSqlText(call);
      if (sql.includes('WITH scored AS')) {
        if (sql.includes(`question."status" = 'PENDING'`)) {
          return [
            rankedQaRow({
              id: '77777777-7777-4777-8777-777777777777',
              participantId: PARTICIPANT_ID,
              text: 'Noch ungeprüfte Frage von A',
              status: 'PENDING',
              totalCount: 2,
            }),
            rankedQaRow({
              text: 'Öffentlich freigegeben',
              totalCount: 2,
            }),
          ];
        }
        return [rankedQaRow({ text: 'Öffentlich freigegeben', totalCount: 1 })];
      }
      throw new Error(`Unerwartete Raw-SQL-Abfrage: ${sql}`);
    });
    const [authorAgain, otherAgain] = await Promise.all([
      caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID }),
      caller.list({ sessionId: SESSION_ID, participantId: OTHER_PARTICIPANT_ID }),
    ]);
    expect(authorAgain.questions.map((question) => question.text)).toContain(
      'Noch ungeprüfte Frage von A',
    );
    expect(otherAgain.questions.map((question) => question.text)).not.toContain(
      'Noch ungeprüfte Frage von A',
    );
  });

  it('behandelt einen fehlgeschlagenen geteilten Q&A-Abruf ohne unbehandelte Rejection', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 1,
    });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    rawQueryResults.rankedQuestions.push(new Error('db timeout'));

    try {
      await expect(
        caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID }),
      ).rejects.toThrow('db timeout');
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);

      rawQueryResults.rankedQuestions.push([rankedQaRow({ text: 'Nach Retry sichtbar' })]);
      const retry = await caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID });
      expect(retry.questions[0]?.text).toBe('Nach Retry sichtbar');
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('sortiert die Teilnehmer-Q&A-Liste nach BEST ohne Host-Metriken auszugeben', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: '22222222-2222-4222-8222-222222222222',
        participantId: PARTICIPANT_ID,
        text: 'Stabile Mehrheit',
        upvoteCount: 5,
        createdAt: new Date('2026-03-13T12:01:00.000Z'),
        positiveVoteCount: 5,
        bestScore: 0.5655,
        totalCount: 2,
      }),
      rankedQaRow({
        id: '11111111-1111-4111-8111-111111111111',
        participantId: PARTICIPANT_ID,
        text: 'Nur eine Zustimmung',
        upvoteCount: 1,
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
        positiveVoteCount: 1,
        bestScore: 0.2065,
        totalCount: 2,
      }),
    ]);

    const { questions: result } = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      sort: 'BEST',
    });

    expect(result.map((question) => question.id)).toEqual([
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(result[0]).not.toHaveProperty('bestScore');
    expect(result[0]).not.toHaveProperty('controversyScore');
    expect(result[0]).not.toHaveProperty('isControversial');
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(
      'ranked."bestScore" DESC',
    );
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(`WHEN 'ACTIVE' THEN 0`);
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain('GREATEST(');
  });

  it('sortiert die Teilnehmer-Q&A-Liste nach CONTROVERSIAL', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
    });
    prismaMock.participant.count.mockResolvedValue(20);
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: '11111111-1111-4111-8111-111111111111',
        participantId: PARTICIPANT_ID,
        text: 'Polarisiert stark',
        upvoteCount: 0,
        positiveVoteCount: 5,
        negativeVoteCount: 5,
        controversyScore: 5 / 6,
        totalCount: 2,
      }),
      rankedQaRow({
        id: '22222222-2222-4222-8222-222222222222',
        participantId: PARTICIPANT_ID,
        text: 'Nur Zustimmung',
        upvoteCount: 10,
        positiveVoteCount: 10,
        controversyScore: 0,
        totalCount: 2,
      }),
    ]);

    const { questions: result } = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      sort: 'CONTROVERSIAL',
    });

    expect(result.map((question) => question.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
    expect(result[0]).not.toHaveProperty('controversyScore');
    expect(prismaMock.participant.count).toHaveBeenCalled();
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(
      'ranked."controversyScore" DESC',
    );
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(`WHEN 'ACTIVE' THEN 0`);
  });

  it('sortiert die Teilnehmer-Q&A-Liste nach TIME in der Datenbank', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: '22222222-2222-4222-8222-222222222222',
        participantId: PARTICIPANT_ID,
        text: 'Neuere Frage',
        upvoteCount: 1,
        createdAt: new Date('2026-03-13T12:10:00.000Z'),
        totalCount: 2,
      }),
      rankedQaRow({
        id: '11111111-1111-4111-8111-111111111111',
        participantId: PARTICIPANT_ID,
        text: 'Ältere Frage',
        upvoteCount: 20,
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
        totalCount: 2,
      }),
    ]);

    const { questions: result } = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      sort: 'TIME',
    });

    expect(result.map((question) => question.id)).toEqual([
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
    ]);
    const sql = rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? []);
    expect(sql).toContain('ranked."createdAt" DESC');
    expect(sql).toContain(`WHEN 'ACTIVE' THEN 0`);
    expect(sql).not.toContain('ranked."bestScore" DESC');
    expect(sql).not.toContain('GREATEST(');
    expect(sql).not.toContain('POWER(');
  });

  it('bündelt gleichzeitige Teilnehmer-Rankings derselben Revision und lädt eigene Votes separat', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      type: 'Q_AND_A',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 1,
    });
    let resolveRanking!: (rows: RankedQaTestRow[]) => void;
    const ranking = new Promise<RankedQaTestRow[]>((resolve) => {
      resolveRanking = resolve;
    });
    prismaMock.$queryRaw.mockReturnValue(ranking);
    prismaMock.qaUpvote.findMany.mockImplementation(
      async ({ where }: { where: { participantId: { in: string[] } } }) =>
        where.participantId.in.includes(PARTICIPANT_ID)
          ? [{ participantId: PARTICIPANT_ID, qaQuestionId: QUESTION_ID, direction: 'UP' as const }]
          : [],
    );

    const first = caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      pageSize: 1,
    });
    const second = caller.list({
      sessionId: SESSION_ID,
      participantId: OTHER_PARTICIPANT_ID,
      pageSize: 1,
    });
    await vi.waitFor(() => expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1));
    resolveRanking([rankedQaRow({ id: QUESTION_ID, totalCount: 1, myVote: null })]);

    const [firstPage, secondPage] = await Promise.all([first, second]);

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.qaUpvote.findMany).toHaveBeenCalledTimes(1);
    expect(firstPage.questions[0]?.myVote).toBe('UP');
    expect(secondPage.questions[0]?.myVote).toBeNull();
  });

  it('weist participant-authentifizierte Q&A-Lesezugriffe ohne Participant-ID ab', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
    });
    await expect(caller.list({ sessionId: SESSION_ID })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'qa.presentProjection',
      case: 'happy',
      mode: 'direct',
      title: 'liefert der expliziten öffentlichen Presenter-Projektion nur freigegebene Fragen',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: false,
      });
      rawQueryResults.rankedQuestions.push([
        rankedQaRow({ text: 'Öffentlich freigegeben', status: 'ACTIVE' }),
      ]);

      const result = await caller.presentProjection({ sessionId: SESSION_ID });

      expect(result.questions.map((question) => question.text)).toEqual(['Öffentlich freigegeben']);
      const sql = rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? []);
      expect(sql).toContain(`question."status" IN ('ACTIVE', 'PINNED', 'ARCHIVED')`);
      expect(sql).not.toContain(`question."status" = 'PENDING'`);
    },
  );

  it('liefert der Presenter-Projektion freigegebene Fragen auch bei geschlossenem Beitragskanal', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: false,
      qaModerationMode: false,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({ text: 'Weiterhin sichtbar', status: 'ACTIVE' }),
    ]);

    const result = await caller.presentProjection({ sessionId: SESSION_ID });

    expect(result.state).toBe('CHANNEL_CLOSED');
    expect(result.questions.map((question) => question.text)).toEqual(['Weiterhin sichtbar']);
  });

  trpcDodIt(
    {
      procedure: 'qa.presentProjection',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'weist die öffentliche Presenter-Projektion für eine unbekannte Session zurück',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);
      await expect(caller.presentProjection({ sessionId: SESSION_ID })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    },
  );

  it('liefert Teilnehmenden nach globalem Sessionende keine Q&A-Inhalte', async () => {
    const endedAt = new Date('2026-09-18T08:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      status: 'FINISHED',
      endedAt,
      expiresAt: endedAt,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: new Date('2026-09-20T08:00:00.000Z'),
      qaModerationMode: false,
    });

    await expect(
      caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID }),
    ).resolves.toMatchObject({ questions: [], state: 'SESSION_ENDED' });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('liefert Teilnehmenden nach Quiz-FINISHED bestehende Fragen, solange Q&A offen ist', async () => {
    const endedAt = new Date('2026-09-19T07:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      status: 'FINISHED',
      endedAt,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 1,
    });
    const remainingQuestion = rankedQaRow({
      id: QUESTION_ID,
      participantId: OTHER_PARTICIPANT_ID,
      text: 'Frage bleibt im Forum',
      upvoteCount: 2,
    });
    rawQueryResults.rankedQuestions.push([remainingQuestion], [remainingQuestion]);

    await expect(
      caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID }),
    ).resolves.toMatchObject({
      state: 'ACTIVE',
      questions: [expect.objectContaining({ id: QUESTION_ID, text: 'Frage bleibt im Forum' })],
    });
    await expect(
      caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID }),
    ).resolves.toMatchObject({
      state: 'ACTIVE',
      questions: [expect.objectContaining({ id: QUESTION_ID })],
    });
  });

  it('beendet Teilnehmer-Q&A nach Quiz-FINISHED wenn der Kanal geschlossen oder abgelaufen ist', async () => {
    const endedAt = new Date('2026-09-19T07:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValueOnce({
      ...ACTIVE_QA_SESSION,
      status: 'FINISHED',
      endedAt,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: false,
      qaModerationMode: false,
    });
    await expect(
      caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID }),
    ).resolves.toMatchObject({ questions: [], state: 'SESSION_ENDED' });

    prismaMock.session.findUnique.mockResolvedValueOnce({
      ...ACTIVE_QA_SESSION,
      status: 'FINISHED',
      endedAt,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: new Date('2026-09-19T06:00:00.000Z'),
      qaModerationMode: false,
    });
    await expect(
      caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID }),
    ).resolves.toMatchObject({ questions: [], state: 'SESSION_ENDED' });
  });

  it('liefert der Presenter-Projektion nach Quiz-FINISHED offene Q&A-Fragen', async () => {
    const endedAt = new Date('2026-09-19T07:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      status: 'FINISHED',
      endedAt,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 1,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({ text: 'Weiter auf der Leinwand', status: 'ACTIVE' }),
    ]);

    const result = await caller.presentProjection({ sessionId: SESSION_ID });
    expect(result.state).toBe('ACTIVE');
    expect(result.questions.map((question) => question.text)).toEqual(['Weiter auf der Leinwand']);
  });

  it('begrenzt pageSize auf 500 und liefert einen fortsetzbaren nextCursor', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 501,
    });
    const rows = Array.from({ length: 501 }, (_, index) =>
      rankedQaRow({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        text: `Frage ${index + 1}`,
        totalCount: 501,
      }),
    );
    rawQueryResults.rankedQuestions.push(rows, [rows[500]!]);

    const firstPage = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      pageSize: 500,
    });

    expect(firstPage.questions).toHaveLength(500);
    expect(firstPage.totalCount).toBe(501);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const firstQueryCall = prismaMock.$queryRaw.mock.calls[0] ?? [];
    expect(firstQueryCall.slice(1)).toEqual(expect.arrayContaining([501, 0]));

    const secondPage = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      pageSize: 500,
      cursor: firstPage.nextCursor!,
    });

    expect(secondPage.questions.map((question) => question.text)).toEqual(['Frage 501']);
    expect(secondPage.nextCursor).toBeNull();
    const secondQueryCall = prismaMock.$queryRaw.mock.calls[1] ?? [];
    expect(secondQueryCall.slice(1)).toEqual(expect.arrayContaining([501, 500]));

    await expect(
      caller.list({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        pageSize: 501,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('lehnt eine Folgeseite nach Änderung der Rankingrevision ab', async () => {
    const sessionAtRevisionSeven = {
      ...ACTIVE_QA_SESSION,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 2,
    };
    prismaMock.session.findUnique.mockResolvedValue(sessionAtRevisionSeven);
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({ text: 'Erste Frage', totalCount: 2 }),
      rankedQaRow({
        id: '77777777-7777-4777-8777-777777777777',
        text: 'Zweite Frage',
        totalCount: 2,
      }),
    ]);
    const firstPage = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      pageSize: 1,
    });
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    prismaMock.session.findUnique.mockResolvedValue({
      ...sessionAtRevisionSeven,
      qaRankingRevision: 8,
    });

    await expect(
      caller.list({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        pageSize: 1,
        cursor: firstPage.nextCursor!,
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Die Q&A-Rangliste hat sich geändert. Lade sie bitte neu.',
    });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  trpcDodIt(
    {
      procedure: 'qa.submit',
      case: 'happy',
      mode: 'direct',
      title: 'legt eine neue Frage an und setzt ohne Moderation den Status ACTIVE',
    },
    async () => {
      rawQueryResults.createQuestion.push([
        {
          id: QUESTION_ID,
          text: 'Wie viele Punkte gibt es?',
          upvoteCount: 0,
          status: 'ACTIVE',
          createdAt: new Date('2026-03-13T12:00:00.000Z'),
          replayed: false,
          participantQuestionCount: 1,
          sessionQuestionCount: 1,
        },
      ]);

      const result = await caller.submit({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: '  Wie viele Punkte gibt es?  ',
        idempotencyKey: IDEMPOTENCY_KEY,
      });

      const createCall = prismaMock.$queryRaw.mock.calls[0] ?? [];
      expect(rawSqlText(createCall)).toContain('arsnova_create_qa_question');
      expect(createCall.slice(1, 4)).toEqual([
        SESSION_ID,
        PARTICIPANT_ID,
        'Wie viele Punkte gibt es?',
      ]);
      expect(result.question.status).toBe('ACTIVE');
      expect(result).toMatchObject({
        replayed: false,
        quota: {
          participantQuestionCount: 1,
          participantRemaining: 9,
          sessionQuestionCount: 1,
          sessionRemaining: 24_999,
        },
      });
      expect(prismaMock.qaQuestion.create).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.submit',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt neue Fragen ab, wenn die Session beendet ist',
    },
    async () => {
      rawQueryResults.createQuestion.push(new Error('ARSNOVA_SESSION_ENDED'));

      await expect(
        caller.submit({
          sessionId: SESSION_ID,
          participantId: PARTICIPANT_ID,
          text: 'Noch eine Frage?',
          idempotencyKey: IDEMPOTENCY_KEY,
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Die Session ist beendet. Die Aktion wurde nicht gespeichert.',
      });

      expect(prismaMock.qaQuestion.create).not.toHaveBeenCalled();
    },
  );

  it('begrenzt Studierende auf maximal 10 Fragen pro Session', async () => {
    rawQueryResults.createQuestion.push(new Error('ARSNOVA_QA_PARTICIPANT_LIMIT'));

    await expect(
      caller.submit({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Noch eine Frage?',
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Du kannst pro Session maximal 10 Fragen einreichen.',
    });
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(
      'arsnova_create_qa_question',
    );
  });

  it('zählt einen idempotenten Submit-Replay weder im Teilnehmer- noch im Sessionkontingent doppelt', async () => {
    const storedQuestion = {
      id: QUESTION_ID,
      text: 'Nur einmal zählen',
      upvoteCount: 0,
      status: 'ACTIVE' as const,
      createdAt: new Date('2026-03-13T12:00:00.000Z'),
      participantQuestionCount: 1,
      sessionQuestionCount: 1,
    };
    rawQueryResults.createQuestion.push(
      [{ ...storedQuestion, replayed: false }],
      [{ ...storedQuestion, replayed: true }],
    );
    const input = {
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      text: storedQuestion.text,
      idempotencyKey: IDEMPOTENCY_KEY,
    };

    const first = await caller.submit(input);
    const replay = await caller.submit(input);

    expect(first).toMatchObject({
      replayed: false,
      quota: { participantQuestionCount: 1, sessionQuestionCount: 1 },
    });
    expect(replay).toMatchObject({
      replayed: true,
      quota: { participantQuestionCount: 1, sessionQuestionCount: 1 },
    });
    expect(qaTelemetryMocks.recordQaQuestionAccepted).toHaveBeenCalledTimes(1);
    expect(qaTelemetryMocks.recordQaQuestionAccepted).toHaveBeenCalledWith(QUESTION_ID);
    const createCalls = prismaMock.$queryRaw.mock.calls.filter((call) =>
      rawSqlText(call).includes('arsnova_create_qa_question'),
    );
    expect(createCalls).toHaveLength(2);
    expect(createCalls[0]?.[4]).toBe(createCalls[1]?.[4]);
  });

  it('begrenzt eine Session atomar auf 25.000 Fragen', async () => {
    rawQueryResults.createQuestion.push(new Error('ARSNOVA_QA_SESSION_LIMIT'));

    await expect(
      caller.submit({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Frage 25.001',
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Diese Session hat das Kontingent von 25000 Fragen erreicht.',
    });
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(
      'arsnova_create_qa_question',
    );
  });

  trpcDodIt(
    {
      procedure: 'qa.upvote',
      case: 'happy',
      mode: 'direct',
      title: 'togglet Upvotes pro Teilnehmer und Frage',
    },
    async () => {
      prismaMock.qaQuestion.findUnique.mockResolvedValue({ sessionId: SESSION_ID });
      rawQueryResults.changeVote.push([
        {
          questionId: QUESTION_ID,
          myVote: 'UP',
          upvoteCount: 2,
          changed: true,
        },
      ]);

      const result = await caller.upvote({
        questionId: QUESTION_ID,
        participantId: PARTICIPANT_ID,
      });

      expect(result).toEqual({
        questionId: QUESTION_ID,
        upvoted: true,
        upvoteCount: 2,
      });
      const voteCall = prismaMock.$queryRaw.mock.calls[0] ?? [];
      expect(rawSqlText(voteCall)).toContain('arsnova_change_qa_vote');
      expect(voteCall.slice(1)).toEqual([QUESTION_ID, PARTICIPANT_ID, 'UP']);
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.moderate',
      case: 'happy',
      mode: 'direct',
      title: 'moderiert Fragen und erlaubt mehrfaches Pinnen',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        status: 'ACTIVE',
      });
      prismaMock.qaQuestion.findUnique.mockResolvedValue({
        id: QUESTION_ID,
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Welche Themen kommen dran?',
        upvoteCount: 5,
        status: 'ACTIVE',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
      });
      prismaMock.qaQuestion.update.mockResolvedValue({
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Welche Themen kommen dran?',
        upvoteCount: 5,
        status: 'PINNED',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
      });

      const result = await hostCaller.moderate({
        sessionCode: 'ABC123',
        questionId: QUESTION_ID,
        action: 'PIN',
      });

      expect(prismaMock.qaQuestion.update).toHaveBeenCalledWith({
        where: { id: QUESTION_ID },
        data: { status: 'PINNED' },
        select: expect.any(Object),
      });
      expect(prismaMock.qaQuestion.updateMany).not.toHaveBeenCalled();
      expect(result.status).toBe('PINNED');
    },
  );

  it('löscht Fragen bei Host-Moderation physisch aus PostgreSQL', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      status: 'ACTIVE',
    });
    prismaMock.qaQuestion.findUnique.mockResolvedValueOnce({
      id: QUESTION_ID,
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      text: 'Diese Frage soll entfernt werden',
      upvoteCount: 5,
      status: 'ACTIVE',
      createdAt: new Date('2026-03-13T12:00:00.000Z'),
    });
    prismaMock.qaQuestion.delete.mockResolvedValue({});

    const result = await hostCaller.moderate({
      sessionCode: 'ABC123',
      questionId: QUESTION_ID,
      action: 'DELETE',
    });

    expect(prismaMock.qaQuestion.delete).toHaveBeenCalledWith({
      where: { id: QUESTION_ID },
    });
    expect(prismaMock.qaQuestion.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: QUESTION_ID,
      text: 'Diese Frage soll entfernt werden',
      upvoteCount: 5,
      status: 'DELETED',
    });
  });

  it('moderiert nach Quiz-FINISHED, solange Q&A offen ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: new Date('2099-01-01T00:00:00.000Z'),
      status: 'FINISHED',
      endedAt: new Date('2026-09-19T06:00:00.000Z'),
    });
    prismaMock.qaQuestion.findUnique.mockResolvedValue({
      id: QUESTION_ID,
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      text: 'Bitte freigeben',
      upvoteCount: 0,
      status: 'PENDING',
      createdAt: new Date('2026-09-19T06:05:00.000Z'),
    });
    prismaMock.qaQuestion.update.mockResolvedValue({
      id: QUESTION_ID,
      participantId: PARTICIPANT_ID,
      text: 'Bitte freigeben',
      upvoteCount: 0,
      status: 'ACTIVE',
      createdAt: new Date('2026-09-19T06:05:00.000Z'),
    });

    const result = await hostCaller.moderate({
      sessionCode: 'ABC123',
      questionId: QUESTION_ID,
      action: 'APPROVE',
    });

    expect(result.status).toBe('ACTIVE');
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });

  it('lehnt Host-Moderation nach Quiz-FINISHED ab, wenn Q&A geschlossen ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: new Date('2026-09-19T06:00:00.000Z'),
      status: 'FINISHED',
      endedAt: new Date('2026-09-19T06:00:00.000Z'),
    });

    await expect(
      hostCaller.moderate({
        sessionCode: 'ABC123',
        questionId: QUESTION_ID,
        action: 'APPROVE',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Die Session ist beendet. Fragen und Bewertungen sind nicht mehr möglich.',
    });
    expect(prismaMock.qaQuestion.update).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'qa.moderate',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'lehnt Moderation ohne gültigen Host-Token ab',
    },
    async () => {
      await expect(
        caller.moderate({
          sessionCode: 'ABC123',
          questionId: QUESTION_ID,
          action: 'PIN',
        }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Host-Authentifizierung erforderlich.',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.toggleModeration',
      case: 'happy',
      mode: 'direct',
      title: 'schaltet Q&A-Moderation mit Host-Rechten um',
    },
    async () => {
      prismaMock.session.findFirst.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        id: SESSION_ID,
        status: 'ACTIVE',
      });
      prismaMock.session.update.mockResolvedValue({ qaModerationMode: true });

      const result = await hostCaller.toggleModeration({ sessionCode: 'ABC123', enabled: true });

      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: { qaModerationMode: true, moderationMode: true },
        select: { qaModerationMode: true },
      });
      expect(prismaMock.qaQuestion.updateMany).not.toHaveBeenCalled();
      expect(result).toEqual({ enabled: true });
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.toggleModeration',
      case: 'happy',
      mode: 'direct',
      title: 'deaktiviert die Vorab-Moderation ohne wartende Fragen vorzeitig freizugeben',
    },
    async () => {
      prismaMock.session.findFirst.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        id: SESSION_ID,
        status: 'ACTIVE',
      });
      prismaMock.session.update.mockResolvedValue({ qaModerationMode: false });

      const result = await hostCaller.toggleModeration({ sessionCode: 'ABC123', enabled: false });

      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: { qaModerationMode: false, moderationMode: false },
        select: { qaModerationMode: true },
      });
      expect(prismaMock.qaQuestion.updateMany).not.toHaveBeenCalled();
      expect(result).toEqual({ enabled: false });
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.releasePending',
      case: 'happy',
      mode: 'direct',
      title: 'gibt bei deaktivierter Vorab-Moderation alle wartenden Fragen gesammelt frei',
    },
    async () => {
      prismaMock.session.findFirst.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        status: 'ACTIVE',
      });
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: false,
        moderationMode: false,
      });
      prismaMock.qaQuestion.updateMany.mockResolvedValue({ count: 12 });

      await expect(hostCaller.releasePending({ sessionCode: 'ABC123' })).resolves.toEqual({
        releasedCount: 12,
      });
      expect(prismaMock.qaQuestion.updateMany).toHaveBeenCalledWith({
        where: { sessionId: SESSION_ID, status: 'PENDING' },
        data: { status: 'ACTIVE' },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.releasePending',
      case: 'error',
      mode: 'direct',
      contract: 'CONFLICT',
      title: 'verhindert die Sammelfreigabe bei aktiver Vorab-Moderation',
    },
    async () => {
      prismaMock.session.findFirst.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        status: 'ACTIVE',
      });
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: true,
        moderationMode: true,
      });

      await expect(hostCaller.releasePending({ sessionCode: 'ABC123' })).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'Deaktiviere zuerst die Vorab-Moderation.',
      });
      expect(prismaMock.qaQuestion.updateMany).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.releasePending',
      case: 'error',
      mode: 'direct',
      contract: 'FORBIDDEN',
      title: 'bricht die Sammelfreigabe ab wenn Q&A nach der Vorprüfung geschlossen wurde',
    },
    async () => {
      prismaMock.session.findFirst.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        status: 'ACTIVE',
      });
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: false,
        qaModerationMode: false,
        moderationMode: false,
      });

      await expect(hostCaller.releasePending({ sessionCode: 'ABC123' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Der Q&A-Kanal ist aktuell geschlossen.',
      });
      expect(prismaMock.qaQuestion.updateMany).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.releasePending',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'lehnt die Sammelfreigabe ohne gültigen Host-Token ab',
    },
    async () => {
      await expect(caller.releasePending({ sessionCode: 'ABC123' })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Host-Authentifizierung erforderlich.',
      });
      expect(prismaMock.qaQuestion.updateMany).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.list',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'lehnt qa.list mit moderatorView ohne Host-Token ab',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        id: SESSION_ID,
        code: 'ABC123',
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: true,
      });

      await expect(
        caller.list({ sessionId: SESSION_ID, moderatorView: true }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Host-Authentifizierung erforderlich.',
      });
    },
  );

  it('liefert qa.list mit moderatorView bei gültigem Host-Token', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Noch nicht freigegeben',
        status: 'PENDING',
      }),
    ]);
    prismaMock.qaQuestion.count.mockResolvedValue(1);

    const result = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
    });

    expect(result.questions).toEqual([
      {
        id: QUESTION_ID,
        text: 'Noch nicht freigegeben',
        upvoteCount: 0,
        score: 0,
        status: 'PENDING',
        createdAt: '2026-03-13T12:00:00.000Z',
        positiveVoteCount: 0,
        negativeVoteCount: 0,
        voteCount: 0,
        bestScore: 0,
        controversyScore: 0,
        isControversial: false,
        hasUpvoted: false,
        isOwn: false,
        myVote: null,
      },
    ]);
    expect(result.pendingCount).toBe(1);
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain("WHEN 'PENDING' THEN 0");
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain('GREATEST(');
  });

  it('stellt PENDING im Host-Ranking vor ACTIVE und liefert seitenunabhängigen pendingCount', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
      qaQuestionCount: 101,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        text: 'Freigegebene Top-Frage',
        status: 'ACTIVE',
        upvoteCount: 40,
        positiveVoteCount: 40,
        bestScore: 0.9,
        totalCount: 101,
      }),
    ]);
    prismaMock.qaQuestion.count.mockResolvedValue(1);

    const result = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
      sort: 'BEST',
      pageSize: 100,
    });

    expect(result.pendingCount).toBe(1);
    expect(result.questions.every((question) => question.status === 'ACTIVE')).toBe(true);
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toMatch(
      /WHEN 'PENDING' THEN 0[\s\S]*WHEN 'PINNED' THEN 1[\s\S]*WHEN 'ACTIVE' THEN 1/,
    );
    expect(prismaMock.qaQuestion.count).toHaveBeenCalledWith({
      where: {
        sessionId: SESSION_ID,
        status: 'PENDING',
      },
    });
  });

  it('liefert neben dem gefilterten auch den sitzungsweiten Pending-Zähler', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: QUESTION_ID,
        text: 'Passender Suchtreffer',
        status: 'PENDING',
        totalCount: 1,
      }),
    ]);
    prismaMock.qaQuestion.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

    const result = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
      search: 'Suchtreffer',
    });

    expect(result.pendingCount).toBe(1);
    expect(result.sessionPendingCount).toBe(3);
    expect(prismaMock.qaQuestion.count).toHaveBeenNthCalledWith(1, {
      where: { sessionId: SESSION_ID, status: 'PENDING' },
    });
    expect(prismaMock.qaQuestion.count).toHaveBeenNthCalledWith(2, {
      where: {
        sessionId: SESSION_ID,
        status: 'PENDING',
        text: { contains: 'Suchtreffer', mode: 'insensitive' },
      },
    });
  });

  it('ordnet Host-TOP PINNED vor ACTIVE, auch ohne Stimmen und nach PENDING', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
      qaQuestionCount: 120,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        text: 'Angepinnt ohne Stimmen',
        status: 'PINNED',
        upvoteCount: 0,
        positiveVoteCount: 0,
        totalCount: 120,
      }),
    ]);
    prismaMock.qaQuestion.count.mockResolvedValue(2);

    const result = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
      sort: 'TOP',
      pageSize: 50,
    });

    expect(result.pendingCount).toBe(2);
    expect(result.questions[0]?.status).toBe('PINNED');
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toMatch(
      /WHEN 'PENDING' THEN 0[\s\S]*WHEN 'PINNED' THEN 1[\s\S]*WHEN 'ACTIVE' THEN 2/,
    );
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).not.toMatch(
      /WHEN 'PINNED' THEN 1\s+WHEN 'ACTIVE' THEN 1/,
    );
  });
  it('liefert einem autorisierten Host beendete Q&A-Inhalte innerhalb der 336h nur lesend', async () => {
    const endedAt = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      status: 'FINISHED',
      endedAt,
      expiresAt: endedAt,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: endedAt,
      sessionLifecycleRevision: 5,
      qaModerationMode: true,
      onboardingAnonymousMode: false,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Frage für die Nachbereitung',
        upvoteCount: 2,
        status: 'ARCHIVED',
        authorNickname: 'Ada',
        positiveVoteCount: 2,
        bestScore: 0.3424,
      }),
    ]);

    const result = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
    });

    expect(result.state).toBe('ACTIVE');
    expect(result.questions[0]).toMatchObject({
      id: QUESTION_ID,
      text: 'Frage für die Nachbereitung',
      authorNickname: 'Ada',
    });
  });

  it('liefert nach 336h trotz technischer Legal-Hold-Speicherung keine Host-Q&A-Inhalte', async () => {
    const endedAt = new Date(Date.now() - 337 * 60 * 60 * 1000);
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      status: 'FINISHED',
      endedAt,
      expiresAt: endedAt,
      legalHoldUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: endedAt,
      sessionLifecycleRevision: 6,
      qaModerationMode: true,
      onboardingAnonymousMode: false,
    });

    await expect(
      hostCaller.list({ sessionId: SESSION_ID, moderatorView: true }),
    ).resolves.toMatchObject({
      questions: [],
      state: 'POST_PROCESSING_ENDED',
      endedAt: endedAt.toISOString(),
      sessionLifecycleRevision: 6,
    });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('liefert im Host-Q&A fuer Kindergarten-Sessions den Autor-Nickname fuer Tier-Badges', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'Q_AND_A',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
      onboardingNicknameTheme: 'KINDERGARTEN',
      onboardingAnonymousMode: false,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Kannst du das Beispiel nochmal zeigen?',
        upvoteCount: 3,
        authorNickname: 'Gelber Löwe',
        authorTeamName: 'Team Apfel',
        positiveVoteCount: 3,
        bestScore: 0.4385,
      }),
    ]);

    const { questions: result } = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
    });

    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(
      `participant."nickname" AS "authorNickname"`,
    );
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(
      `author_team."name" AS "authorTeamName"`,
    );
    expect(result[0]).toMatchObject({
      id: QUESTION_ID,
      authorNickname: 'Gelber Löwe',
      authorTeamName: 'Team Apfel',
    });
  });

  it('filtert Host-Q&A nach Autor-Nickname in der Datenbank', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'Q_AND_A',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
      qaQuestionCount: 12,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Nur Fragen dieser Teilnahme',
        upvoteCount: 2,
        authorNickname: 'Gelber Löwe',
        positiveVoteCount: 2,
        bestScore: 0.3424,
      }),
    ]);

    const { questions: result } = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
      authorNickname: 'Gelber Löwe',
    });

    const sql = rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? []);
    expect(sql).toContain('EXISTS');
    expect(sql).toContain('author."nickname"');
    expect(result[0]).toMatchObject({
      id: QUESTION_ID,
      authorNickname: 'Gelber Löwe',
    });
  });

  it('ignoriert authorNickname in der Teilnehmer-Q&A-Liste', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      type: 'Q_AND_A',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 1,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Offene Frage',
        upvoteCount: 1,
        authorNickname: 'Gelber Löwe',
      }),
    ]);

    await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      authorNickname: 'Gelber Löwe',
    });

    const sql = rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? []);
    expect(sql).not.toContain('author."nickname"');
  });

  it('verwendet bei deaktivierter Moderation mit wartenden Fragen den sichtbaren DB-Zähler', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      type: 'Q_AND_A',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 3,
    });
    prismaMock.qaQuestion.count.mockResolvedValueOnce(2);
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: QUESTION_ID,
        participantId: OTHER_PARTICIPANT_ID,
        status: 'ACTIVE',
        totalCount: 1,
      }),
    ]);

    const result = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });

    const sql = rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? []);
    expect(sql).toContain('COUNT(*) OVER() AS "totalCount"');
    expect(result.totalCount).toBe(1);
  });

  it('liefert in der Teilnehmer-Q&A-Liste Autor und Team an den Fragen', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      type: 'Q_AND_A',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 1,
      onboardingAnonymousMode: false,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: QUESTION_ID,
        participantId: OTHER_PARTICIPANT_ID,
        text: 'Offene Frage',
        upvoteCount: 1,
        authorNickname: 'Green frog 1',
        authorTeamName: 'Team 🍎',
      }),
    ]);

    const { questions: result } = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });

    expect(result[0]).toMatchObject({
      id: QUESTION_ID,
      authorNickname: 'Green frog 1',
      authorTeamName: 'Team 🍎',
      isOwn: false,
    });
  });

  it('laesst Autor und Team im anonymen Modus auch bei gesetzten Rohfeldern weg', async () => {
    const anonymousSession = {
      ...ACTIVE_QA_SESSION,
      type: 'Q_AND_A' as const,
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 1,
      onboardingAnonymousMode: true,
    };
    const authoredRow = rankedQaRow({
      id: QUESTION_ID,
      participantId: OTHER_PARTICIPANT_ID,
      text: 'Anonyme Frage',
      upvoteCount: 1,
      authorNickname: 'Green frog 1',
      authorTeamName: 'Team 🍎',
    });

    prismaMock.session.findUnique.mockResolvedValue(anonymousSession);
    rawQueryResults.rankedQuestions.push([authoredRow]);
    const participantList = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });
    expect(participantList.questions[0]).toMatchObject({
      id: QUESTION_ID,
      text: 'Anonyme Frage',
    });
    expect(participantList.questions[0]).not.toHaveProperty('authorNickname');
    expect(participantList.questions[0]).not.toHaveProperty('authorTeamName');

    prismaMock.session.findUnique.mockResolvedValue({
      ...anonymousSession,
      id: SESSION_ID,
      code: 'ABC123',
    });
    rawQueryResults.rankedQuestions.push([authoredRow]);
    const hostList = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
    });
    expect(hostList.questions[0]).not.toHaveProperty('authorNickname');
    expect(hostList.questions[0]).not.toHaveProperty('authorTeamName');

    prismaMock.session.findUnique.mockResolvedValue(anonymousSession);
    rawQueryResults.rankedQuestions.push([authoredRow]);
    const projection = await caller.presentProjection({ sessionId: SESSION_ID });
    expect(projection.questions[0]).not.toHaveProperty('authorNickname');
    expect(projection.questions[0]).not.toHaveProperty('authorTeamName');
  });

  it('sortiert Host-Q&A im BEST-Modus nach Wilson-Score', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
    });
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: '22222222-2222-4222-8222-222222222222',
        participantId: PARTICIPANT_ID,
        text: 'Robuste Zustimmung',
        upvoteCount: 5,
        createdAt: new Date('2026-03-13T12:01:00.000Z'),
        positiveVoteCount: 5,
        bestScore: 0.5655,
        totalCount: 3,
      }),
      rankedQaRow({
        id: '33333333-3333-4333-8333-333333333333',
        participantId: PARTICIPANT_ID,
        text: 'Mehrheit mit Gegenstimme',
        upvoteCount: 3,
        createdAt: new Date('2026-03-13T12:02:00.000Z'),
        positiveVoteCount: 4,
        negativeVoteCount: 1,
        bestScore: 0.3755,
        totalCount: 3,
      }),
      rankedQaRow({
        id: '11111111-1111-4111-8111-111111111111',
        participantId: PARTICIPANT_ID,
        text: 'Nur eine Zustimmung',
        upvoteCount: 1,
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
        positiveVoteCount: 1,
        bestScore: 0.2065,
        totalCount: 3,
      }),
    ]);

    const { questions: result } = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
      sort: 'BEST',
    });

    expect(result.map((question) => question.id)).toEqual([
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(result[0]).toMatchObject({
      score: 5,
      positiveVoteCount: 5,
      negativeVoteCount: 0,
      voteCount: 5,
    });
    expect(result[0]?.bestScore).toBeGreaterThan(result[1]?.bestScore ?? 0);
    expect(result[1]?.bestScore).toBeGreaterThan(result[2]?.bestScore ?? 0);
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(
      'ranked."bestScore" DESC',
    );
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain('?::DOUBLE PRECISION');
  });

  it('liefert Kontroversität im Host-BEST-Modus, damit der Kompass nicht von der Sortierung abhängt', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
    });
    prismaMock.participant.count.mockResolvedValue(20);
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: '11111111-1111-4111-8111-111111111111',
        participantId: PARTICIPANT_ID,
        text: 'Polarisiert stark',
        positiveVoteCount: 5,
        negativeVoteCount: 5,
        bestScore: 0.2366,
        controversyScore: 5 / 6,
      }),
    ]);

    const { questions: result } = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
      sort: 'BEST',
    });

    expect(result[0]).toMatchObject({
      isControversial: true,
      positiveVoteCount: 5,
      negativeVoteCount: 5,
    });
    expect(result[0]?.controversyScore).toBeGreaterThan(0.8);
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(
      'ranked."bestScore" DESC',
    );
  });

  it('liefert Kontroversität im Host-TOP- und TIME-Modus, damit der Kompass nicht von der Sortierung abhängt', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
    });
    prismaMock.participant.count.mockResolvedValue(20);
    const polarRow = rankedQaRow({
      id: '11111111-1111-4111-8111-111111111111',
      participantId: PARTICIPANT_ID,
      text: 'Polarisiert stark',
      positiveVoteCount: 5,
      negativeVoteCount: 5,
      bestScore: 0.2366,
      controversyScore: 5 / 6,
    });

    for (const sort of ['TOP', 'TIME'] as const) {
      rawQueryResults.rankedQuestions.push([polarRow]);
      prismaMock.$queryRaw.mockClear();
      const { questions: result } = await hostCaller.list({
        sessionId: SESSION_ID,
        moderatorView: true,
        sort,
      });
      expect(result[0]).toMatchObject({
        isControversial: true,
        positiveVoteCount: 5,
        negativeVoteCount: 5,
      });
      expect(result[0]?.controversyScore).toBeGreaterThan(0.8);
      const sql = rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? []);
      expect(sql).toContain('GREATEST(');
      expect(sql).toContain('POWER(');
      if (sort === 'TIME') {
        expect(sql).toContain('ranked."createdAt" DESC');
      } else {
        expect(sql).toContain('ranked."upvoteCount" DESC');
      }
    }
  });

  it('sortiert Host-Q&A im CONTROVERSIAL-Modus nach Kontroversität und kennzeichnet starke Polarität', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
    });
    prismaMock.participant.count.mockResolvedValue(20);
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: '11111111-1111-4111-8111-111111111111',
        participantId: PARTICIPANT_ID,
        text: 'Polarisiert stark',
        upvoteCount: 0,
        positiveVoteCount: 5,
        negativeVoteCount: 5,
        bestScore: 0.2366,
        controversyScore: 5 / 6,
        totalCount: 3,
      }),
      rankedQaRow({
        id: '33333333-3333-4333-8333-333333333333',
        participantId: PARTICIPANT_ID,
        text: 'Leicht kontrovers',
        upvoteCount: 0,
        createdAt: new Date('2026-03-13T12:02:00.000Z'),
        positiveVoteCount: 1,
        negativeVoteCount: 1,
        bestScore: 0.0945,
        controversyScore: 0.5,
        totalCount: 3,
      }),
      rankedQaRow({
        id: '22222222-2222-4222-8222-222222222222',
        participantId: PARTICIPANT_ID,
        text: 'Nur Zustimmung',
        upvoteCount: 10,
        createdAt: new Date('2026-03-13T12:01:00.000Z'),
        positiveVoteCount: 10,
        bestScore: 0.7225,
        totalCount: 3,
      }),
    ]);

    const { questions: result } = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
      sort: 'CONTROVERSIAL',
    });

    expect(result.map((question) => question.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      '22222222-2222-4222-8222-222222222222',
    ]);
    expect(result[0]).toMatchObject({
      score: 0,
      positiveVoteCount: 5,
      negativeVoteCount: 5,
      voteCount: 10,
      isControversial: true,
    });
    expect(result[0]?.controversyScore).toBeGreaterThan(0.8);
    expect(result[1]?.controversyScore).toBe(0.5);
    expect(result[1]?.isControversial).toBe(false);
    expect(result[2]?.controversyScore).toBe(0);
    expect(rawSqlText(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain(
      'ranked."controversyScore" DESC',
    );
  });

  it('sortiert im Host-CONTROVERSIAL-Modus die kontroverseste Frage vor weniger kontroversen angehefteten Fragen', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
    });
    prismaMock.participant.count.mockResolvedValue(20);
    rawQueryResults.rankedQuestions.push([
      rankedQaRow({
        id: '22222222-2222-4222-8222-222222222222',
        participantId: PARTICIPANT_ID,
        text: 'Nicht angeheftet, aber polarisiert',
        upvoteCount: 0,
        createdAt: new Date('2026-03-13T12:01:00.000Z'),
        positiveVoteCount: 5,
        negativeVoteCount: 5,
        bestScore: 0.2366,
        controversyScore: 5 / 6,
        totalCount: 2,
      }),
      rankedQaRow({
        id: '11111111-1111-4111-8111-111111111111',
        participantId: PARTICIPANT_ID,
        text: 'Angeheftet, aber eindeutig',
        upvoteCount: 10,
        status: 'PINNED',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
        positiveVoteCount: 10,
        bestScore: 0.7225,
        totalCount: 2,
      }),
    ]);

    const { questions: result } = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
      sort: 'CONTROVERSIAL',
    });

    expect(result.map((question) => question.id)).toEqual([
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(result[0]?.status).toBe('ACTIVE');
    expect(result[1]?.status).toBe('PINNED');
    expect(result[0]?.controversyScore).toBeGreaterThan(result[1]?.controversyScore ?? 0);
  });

  it('lehnt qa.onQuestionsUpdated mit moderatorView ohne Host-Token ab', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
    });

    const stream = await caller.onQuestionsUpdated({ sessionId: SESSION_ID, moderatorView: true });
    const iterator = stream[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Authentifizierung erforderlich.',
    });

    await iterator.return?.(undefined);
  });

  it('beendet die Teilnehmer-Subscription nach globalem Sessionende inhaltsfrei', async () => {
    const endedAt = new Date('2026-09-18T08:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      status: 'FINISHED',
      endedAt,
      expiresAt: endedAt,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: new Date('2026-09-20T08:00:00.000Z'),
    });

    const stream = await caller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });
    const iterator = stream[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'SESSION_ENDED' },
      done: false,
    });
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('haelt die Teilnehmer-Subscription nach Quiz-FINISHED offen, solange Q&A offen ist', async () => {
    const endedAt = new Date('2026-09-19T07:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      status: 'FINISHED',
      endedAt,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
    });

    const stream = await caller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });
    const iterator = stream[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'ACTIVE' },
      done: false,
    });
    await iterator.return?.(undefined);
  });

  it('liefert qa.onQuestionsUpdated als inhaltslose Host-Invalidierung', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({
        ...ACTIVE_QA_SESSION,
        code: 'ABC123',
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
      })
      .mockResolvedValueOnce({
        ...ACTIVE_QA_SESSION,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
      });
    const stream = await hostCaller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      moderatorView: true,
    });
    const iterator = stream[Symbol.asyncIterator]();
    const { value } = await iterator.next();

    expect(hostAuthMocks.isHostSessionTokenValidMock).toHaveBeenCalledWith(
      'ABC123',
      'host-token-123',
    );
    expect(value).toMatchObject({
      kind: 'INVALIDATED',
      state: 'ACTIVE',
      sessionLifecycleRevision: 1,
      rankingRevision: 7,
      participantRevision: 0,
    });
    expect(value).not.toHaveProperty('questions');
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();

    await iterator.return?.(undefined);
  });

  it('meldet Hosts einen geänderten Moderationsmodus auch ohne neue Ranking-Revision', async () => {
    let session = {
      ...ACTIVE_QA_SESSION,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
    };
    prismaMock.session.findUnique.mockImplementation(async () => session);

    const stream = await hostCaller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      moderatorView: true,
    });
    const iterator = stream[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', moderationMode: true, rankingRevision: 7 },
      done: false,
    });

    const modeUpdate = iterator.next();
    session = { ...session, qaModerationMode: false };
    emitQaQuestionsSignal(SESSION_ID, { immediate: true });

    await expect(modeUpdate).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', moderationMode: false, rankingRevision: 7 },
      done: false,
    });
    await iterator.return?.(undefined);
  });

  it('weckt qa.onQuestionsUpdated bei Ranking-Signal statt im Sekundentakt', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
    });

    const stream = await caller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });
    const iterator = stream[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'ACTIVE', rankingRevision: 7 },
      done: false,
    });

    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaRankingRevision: 8,
    });
    emitQaQuestionsSignal(SESSION_ID, { immediate: true });
    await expect(iterator.next()).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'ACTIVE', rankingRevision: 8 },
      done: false,
    });

    await iterator.return?.(undefined);
  });

  it('wendet den Fristablauf einmal an und fällt danach auf das normale Teilnehmerintervall zurück', async () => {
    vi.useFakeTimers();
    const deadline = new Date('2026-09-18T08:00:01.000Z');
    vi.setSystemTime(new Date('2026-09-18T08:00:00.000Z'));
    let session = {
      ...ACTIVE_QA_SESSION,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: deadline,
      participantRevision: 0,
      status: ACTIVE_QA_SESSION.status as string,
      endedAt: ACTIVE_QA_SESSION.endedAt as Date | null,
    };
    prismaMock.session.findUnique.mockImplementation(async () => session);

    const stream = await caller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });
    const iterator = stream[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'ACTIVE' },
      done: false,
    });

    const deadlineUpdate = iterator.next();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(deadlineUpdate).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'DEADLINE_EXPIRED' },
      done: false,
    });

    const readsAtDeadline = prismaMock.session.findUnique.mock.calls.length;
    const authChecksAtDeadline =
      participantAuthMocks.assertParticipantCapabilityMock.mock.calls.length;
    const pendingUpdate = iterator.next();
    await vi.advanceTimersByTimeAsync(60_000);

    const snapshotReads = prismaMock.session.findUnique.mock.calls.length - readsAtDeadline;
    const authorizationChecks =
      participantAuthMocks.assertParticipantCapabilityMock.mock.calls.length - authChecksAtDeadline;
    expect(snapshotReads).toBeGreaterThanOrEqual(4);
    expect(snapshotReads).toBeLessThanOrEqual(Math.ceil(60_000 / 15_000) + 2);
    expect(authorizationChecks).toBe(snapshotReads);

    session = { ...session, status: 'FINISHED', endedAt: new Date() };
    emitQaQuestionsSignal(SESSION_ID, { immediate: true });
    await expect(pendingUpdate).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'SESSION_ENDED' },
      done: false,
    });
    await iterator.return?.(undefined);
  });

  it('macht eine Fristverlängerung nach dem Ablauf wieder sofort sichtbar', async () => {
    vi.useFakeTimers();
    const firstDeadline = new Date('2026-09-18T08:00:01.000Z');
    vi.setSystemTime(new Date('2026-09-18T08:00:00.000Z'));
    let session = {
      ...ACTIVE_QA_SESSION,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: firstDeadline,
      participantRevision: 0,
    };
    prismaMock.session.findUnique.mockImplementation(async () => session);

    const stream = await caller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });
    const iterator = stream[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'ACTIVE' },
    });

    const expired = iterator.next();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(expired).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'DEADLINE_EXPIRED' },
    });

    session = {
      ...session,
      qaOpen: true,
      qaClosesAt: new Date('2026-09-18T08:20:00.000Z'),
      qaRankingRevision: 8,
    };
    emitQaQuestionsSignal(SESSION_ID, { immediate: true });
    await expect(iterator.next()).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'ACTIVE', rankingRevision: 8 },
    });
    await iterator.return?.(undefined);
  });

  it('räumt Listener und Timer beim Unsubscribe der Q&A-Subscription auf', async () => {
    vi.useFakeTimers();
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
    });

    const stream = await caller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();
    const readsAfterSubscribe = prismaMock.session.findUnique.mock.calls.length;
    const closed = iterator.return?.(undefined);
    emitQaQuestionsSignal(SESSION_ID, { immediate: true });
    await expect(closed).resolves.toMatchObject({ done: true });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(prismaMock.session.findUnique.mock.calls.length).toBe(readsAfterSubscribe);
  });

  it('ignoriert die Teilnehmerfrist für den Host-Wartetakt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T08:01:00.000Z'));
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: new Date('2026-09-18T08:00:00.000Z'),
      participantRevision: 0,
    });

    const stream = await hostCaller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      moderatorView: true,
    });
    const iterator = stream[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toMatchObject({
      value: { kind: 'INVALIDATED', state: 'ACTIVE' },
      done: false,
    });

    const readsAtStart = prismaMock.session.findUnique.mock.calls.length;
    const authChecksAtStart = hostAuthMocks.isHostSessionTokenValidMock.mock.calls.length;
    const pendingUpdate = iterator.next();
    await vi.advanceTimersByTimeAsync(60_000);

    const snapshotReads = prismaMock.session.findUnique.mock.calls.length - readsAtStart;
    const authorizationChecks =
      hostAuthMocks.isHostSessionTokenValidMock.mock.calls.length - authChecksAtStart;
    expect(snapshotReads).toBeGreaterThanOrEqual(30);
    expect(snapshotReads).toBeLessThanOrEqual(Math.ceil(60_000 / 2_000) + 2);
    expect(authorizationChecks).toBeGreaterThan(snapshotReads);

    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    emitQaQuestionsSignal(SESSION_ID, { immediate: true });
    await expect(pendingUpdate).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Die Host-Verbindung wurde beendet.',
    });
    await iterator.return?.(undefined);
  });

  it('beendet qa.onQuestionsUpdated nach Widerruf des Host-Tokens', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
    });
    prismaMock.participant.count.mockResolvedValue(0);
    rawQueryResults.rankedQuestions.push([]);

    const stream = await hostCaller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      moderatorView: true,
    });
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();

    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    emitQaQuestionsSignal(SESSION_ID, { immediate: true });
    await expect(iterator.next()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Die Host-Verbindung wurde beendet.',
    });

    await iterator.return?.(undefined);
  });

  it('liefert für Teilnehmende keine Q&A-Inhalte, wenn der Kanal geschlossen ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: false,
      qaModerationMode: false,
    });

    const { questions: result } = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });

    expect(result).toEqual([]);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('lehnt neue Fragen ab, wenn der Q&A-Kanal geschlossen ist', async () => {
    rawQueryResults.createQuestion.push(new Error('ARSNOVA_QA_CLOSED'));

    await expect(
      caller.submit({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Noch eine Frage?',
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Der Q&A-Kanal ist aktuell geschlossen.',
    });
    expect(prismaMock.qaQuestion.create).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'qa.deleteOwn',
      case: 'happy',
      mode: 'direct',
      title: 'markiert die eigene Frage bei geöffnetem Q&A-Kanal als gelöscht',
    },
    async () => {
      prismaMock.qaQuestion.findUnique.mockResolvedValue({
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        sessionId: SESSION_ID,
        status: 'ACTIVE',
      });
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_QA_SESSION,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        status: 'ACTIVE',
      });
      prismaMock.qaQuestion.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        caller.deleteOwn({ questionId: QUESTION_ID, participantId: PARTICIPANT_ID }),
      ).resolves.toEqual({ deleted: true });
      expect(prismaMock.qaQuestion.updateMany).toHaveBeenCalledWith({
        where: {
          id: QUESTION_ID,
          participantId: PARTICIPANT_ID,
          status: { not: 'DELETED' },
        },
        data: { status: 'DELETED' },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.deleteOwn',
      case: 'error',
      mode: 'direct',
      contract: 'FORBIDDEN',
      title: 'verhindert das Löschen einer fremden Q&A-Frage',
    },
    async () => {
      prismaMock.qaQuestion.findUnique.mockResolvedValue({
        id: QUESTION_ID,
        participantId: '55555555-5555-4555-8555-555555555555',
        sessionId: SESSION_ID,
        status: 'ACTIVE',
      });

      await expect(
        caller.deleteOwn({ questionId: QUESTION_ID, participantId: PARTICIPANT_ID }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(prismaMock.qaQuestion.update).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.vote',
      case: 'happy',
      mode: 'direct',
      title: 'liefert Downvote und gewichteten Zähler atomar aus der Datenbankfunktion',
    },
    async () => {
      prismaMock.qaQuestion.findUnique.mockResolvedValue({ sessionId: SESSION_ID });
      rawQueryResults.changeVote.push([
        {
          questionId: QUESTION_ID,
          myVote: 'DOWN',
          upvoteCount: 2,
          changed: true,
        },
      ]);

      const result = await caller.vote({
        questionId: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        direction: 'DOWN',
      });

      expect(result).toEqual({ questionId: QUESTION_ID, myVote: 'DOWN', upvoteCount: 2 });
      const voteCall = prismaMock.$queryRaw.mock.calls[0] ?? [];
      expect(rawSqlText(voteCall)).toContain('arsnova_change_qa_vote');
      expect(voteCall.slice(1)).toEqual([QUESTION_ID, PARTICIPANT_ID, 'DOWN']);
      expect(prismaMock.qaQuestion.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.qaQuestion.update).not.toHaveBeenCalled();
      expect(prismaMock.qaUpvote.create).not.toHaveBeenCalled();
      expect(prismaMock.qaUpvote.update).not.toHaveBeenCalled();
      expect(prismaMock.qaUpvote.delete).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.vote',
      case: 'error',
      mode: 'direct',
      contract: 'FORBIDDEN',
      title: 'verhindert die Bewertung der eigenen Q&A-Frage',
    },
    async () => {
      prismaMock.qaQuestion.findUnique.mockResolvedValue({ sessionId: SESSION_ID });
      rawQueryResults.changeVote.push(new Error('ARSNOVA_QA_OWN_QUESTION'));

      await expect(
        caller.vote({ questionId: QUESTION_ID, participantId: PARTICIPANT_ID, direction: 'UP' }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Du kannst deine eigene Frage nicht bewerten.',
      });
      expect(prismaMock.qaUpvote.findUnique).not.toHaveBeenCalled();
    },
  );
});

trpcDodIt(
  {
    procedure: 'qa.upvote',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'lehnt eine nicht vorhandene Frage mit gueltigem Upvote-Input ab',
  },
  async () => {
    vi.clearAllMocks();
    prismaMock.qaQuestion.findUnique.mockResolvedValue(null);

    await expect(
      caller.upvote({ questionId: QUESTION_ID, participantId: PARTICIPANT_ID }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prismaMock.participant.findUnique).not.toHaveBeenCalled();
  },
);

trpcDodIt(
  {
    procedure: 'qa.toggleModeration',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'qa.toggleModeration weist ungültige Host-Token ab',
  },
  async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(
      hostCaller.toggleModeration({ sessionCode: 'ABC123', enabled: true }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  },
);
