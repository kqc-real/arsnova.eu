import type { IncomingMessage } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
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
    },
    qaUpvote: {
      groupBy: vi.fn(),
    },
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
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

import { qaRouter } from '../routers/qa';
import {
  enqueueQaNlpJob,
  resetQaNlpQueueForTests,
  waitForQaNlpIdleForTests,
} from '../lib/qaNlpQueue';
import { createStubUnclassifiedQaNlpResult } from '../lib/qaNlpResult';

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

describe('qa NLP cascade (Story 8.9b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetQaNlpQueueForTests();
    hostAuthMocks.extractHostTokenMock.mockImplementation((req: unknown) => {
      const t = (req as { headers?: { 'x-host-token'?: string } } | undefined)?.headers?.[
        'x-host-token'
      ];
      return typeof t === 'string' ? t : null;
    });
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.qaQuestion.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { updatedAt: null },
      _sum: { upvoteCount: 0 },
    });
    prismaMock.qaUpvote.groupBy.mockResolvedValue([]);
    prismaMock.qaQuestion.update.mockResolvedValue({});
  });

  afterEach(async () => {
    await waitForQaNlpIdleForTests().catch(() => undefined);
    resetQaNlpQueueForTests();
    vi.unstubAllEnvs();
  });

  it('liefert qa.nlpRuntime nur fuer den Host und bleibt default aus', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'CODE12',
    });

    await expect(caller.nlpRuntime({ sessionId: SESSION_ID })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(hostCaller.nlpRuntime({ sessionId: SESSION_ID })).resolves.toEqual({
      enabled: false,
    });
  });

  it('streift NLP-Felder in der Teilnehmerliste auch wenn die DB Klassifikation speichert', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
    });
    prismaMock.qaQuestion.findMany.mockResolvedValue([
      {
        id: QUESTION_ID,
        participantId: 'other-participant',
        text: 'Was ist klausurrelevant?',
        upvoteCount: 4,
        status: 'ACTIVE',
        nlpStatus: 'CLASSIFIED',
        nlpCategory: 'CONTENT',
        nlpConfidence: 0.93,
        nlpModelVersion: 'stub',
        nlpAnalyzedAt: new Date('2026-08-19T12:00:00.000Z'),
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
        upvotes: [{ participantId: PARTICIPANT_ID, direction: 'UP' }],
      },
    ]);

    const result = await caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID });

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('nlp');
    expect(result[0]).not.toHaveProperty('nlpStatus');
    expect(result[0]).not.toHaveProperty('nlpModelVersion');
  });

  it('gibt NLP-Hilfssignale nur in der Host-Liste aus wenn die Kaskade an ist', async () => {
    vi.stubEnv('QA_NLP_ENABLED', 'true');
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
    });
    prismaMock.qaQuestion.findMany.mockResolvedValue([
      {
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Noch nicht freigegeben',
        upvoteCount: 0,
        status: 'PENDING',
        nlpStatus: 'PENDING',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
        upvotes: [],
      },
    ]);

    const result = await hostCaller.list({ sessionId: SESSION_ID, moderatorView: true });
    expect(result[0]?.nlp).toEqual({ status: 'pending' });
  });

  it('laesst qa.submit zurueckkehren bevor ein langsamer NLP-Worker fertig ist', async () => {
    vi.stubEnv('QA_NLP_ENABLED', 'true');
    let processed = false;
    resetQaNlpQueueForTests({
      config: () => ({
        enabled: true,
        timeoutMs: 1_000,
        queueLimit: 10,
        concurrency: 1,
      }),
      processor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        processed = true;
        return createStubUnclassifiedQaNlpResult();
      },
      writer: async () => {
        processed = true;
      },
    });
    prismaMock.participant.findUnique.mockResolvedValue({
      id: PARTICIPANT_ID,
      sessionId: SESSION_ID,
      session: {
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: false,
        moderationMode: false,
        status: 'ACTIVE',
      },
    });
    prismaMock.qaQuestion.count.mockResolvedValue(0);
    prismaMock.qaQuestion.create.mockResolvedValue({
      id: QUESTION_ID,
      participantId: PARTICIPANT_ID,
      text: 'Wie viele Punkte gibt es?',
      upvoteCount: 0,
      status: 'ACTIVE',
      nlpStatus: 'PENDING',
      createdAt: new Date('2026-03-13T12:00:00.000Z'),
      upvotes: [],
    });

    const started = Date.now();
    const result = await caller.submit({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      text: 'Wie viele Punkte gibt es?',
    });
    expect(Date.now() - started).toBeLessThan(40);
    expect(processed).toBe(false);
    expect(result).not.toHaveProperty('nlp');
    expect(prismaMock.qaQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nlpStatus: 'PENDING' }),
      }),
    );

    await waitForQaNlpIdleForTests();
    expect(processed).toBe(true);
  });

  it('plant nach Persistenz einen Queue-Job', () => {
    vi.stubEnv('QA_NLP_ENABLED', 'true');
    resetQaNlpQueueForTests({
      config: () => ({
        enabled: true,
        timeoutMs: 200,
        queueLimit: 10,
        concurrency: 1,
      }),
      processor: async () => createStubUnclassifiedQaNlpResult(),
      writer: async () => undefined,
    });
    expect(enqueueQaNlpJob({ questionId: QUESTION_ID, text: 'Test' })).toBe('queued');
  });
});
