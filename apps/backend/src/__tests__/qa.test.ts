import type { IncomingMessage } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks, qaTelemetryMocks, rawQueryResults } = vi.hoisted(() => ({
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
  assertParticipantCapability: vi.fn(),
}));

vi.mock('../lib/qaTelemetry', () => ({
  recordQaQuestionAccepted: qaTelemetryMocks.recordQaQuestionAccepted,
  recordQaRatingChanged: qaTelemetryMocks.recordQaRatingChanged,
}));

import { qaRouter } from '../routers/qa';

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
  beforeEach(() => {
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
    },
  );

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
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'CODE12',
      status: 'FINISHED',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
    });

    await expect(
      caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID }),
    ).resolves.toMatchObject({ questions: [], state: 'SESSION_ENDED' });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('begrenzt pageSize auf 100 und liefert einen fortsetzbaren nextCursor', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
      qaQuestionCount: 101,
    });
    const rows = Array.from({ length: 101 }, (_, index) =>
      rankedQaRow({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        text: `Frage ${index + 1}`,
        totalCount: 101,
      }),
    );
    rawQueryResults.rankedQuestions.push(rows, [rows[100]!]);

    const firstPage = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      pageSize: 100,
    });

    expect(firstPage.questions).toHaveLength(100);
    expect(firstPage.totalCount).toBe(101);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const firstQueryCall = prismaMock.$queryRaw.mock.calls[0] ?? [];
    expect(firstQueryCall.at(-2)).toBe(101);
    expect(firstQueryCall.at(-1)).toBe(0);

    const secondPage = await caller.list({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      pageSize: 100,
      cursor: firstPage.nextCursor!,
    });

    expect(secondPage.questions.map((question) => question.text)).toEqual(['Frage 101']);
    expect(secondPage.nextCursor).toBeNull();
    const secondQueryCall = prismaMock.$queryRaw.mock.calls[1] ?? [];
    expect(secondQueryCall.at(-2)).toBe(101);
    expect(secondQueryCall.at(-1)).toBe(100);

    await expect(
      caller.list({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        pageSize: 101,
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
        data: { qaModerationMode: true },
        select: { qaModerationMode: true },
      });
      expect(result).toEqual({ enabled: true });
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

    const { questions: result } = await hostCaller.list({
      sessionId: SESSION_ID,
      moderatorView: true,
    });

    expect(result).toEqual([
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
    expect(result[0]).toMatchObject({
      id: QUESTION_ID,
      authorNickname: 'Gelber Löwe',
    });
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
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_QA_SESSION,
      id: SESSION_ID,
      code: 'ABC123',
      status: 'FINISHED',
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
      value: { kind: 'INVALIDATED', state: 'SESSION_ENDED' },
      done: false,
    });
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
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
