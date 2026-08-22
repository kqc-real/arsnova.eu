import type { IncomingMessage } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';
import { qaSummaryQuestionSourceId } from '@arsnova/shared-types';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    qaQuestion: {
      findMany: vi.fn(),
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
import { resetQaSummaryQueueForTests, waitForQaSummaryIdleForTests } from '../lib/qaSummaryQueue';
import { buildQaSummaryAnalysisSnapshot } from '../lib/qaSummarySnapshot';

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
const QUESTION_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
] as const;
const SOURCE_ID = qaSummaryQuestionSourceId(QUESTION_IDS[0]);

const snapshot = buildQaSummaryAnalysisSnapshot({
  locale: 'de',
  questions: QUESTION_IDS.map((id, index) => ({
    id,
    text: `Offene Frage ${index + 1}?`,
  })),
  maxSources: 20,
});

describe('qa summary (Story 8.9c)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('QA_SUMMARY_ENABLED', '');
    resetQaSummaryQueueForTests({
      loadSnapshot: async () => snapshot,
      processor: async () => ({
        status: 'ready',
        statements: [{ text: 'Es gibt eine Klausurfrage.', sourceIds: [SOURCE_ID] }],
        suggestedNextSteps: [],
        limitations: [],
        modelVersion: 'stub',
      }),
    });
    hostAuthMocks.extractHostTokenMock.mockImplementation((req: unknown) => {
      const t = (req as { headers?: { 'x-host-token'?: string } } | undefined)?.headers?.[
        'x-host-token'
      ];
      return typeof t === 'string' ? t : null;
    });
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  afterEach(async () => {
    await waitForQaSummaryIdleForTests().catch(() => undefined);
    resetQaSummaryQueueForTests();
    vi.unstubAllEnvs();
  });

  trpcDodIt(
    {
      procedure: 'qa.summaryRuntime',
      case: 'happy',
      mode: 'direct',
      title: 'liefert den Kill-Switch-Zustand nur an den Host und bleibt default aus',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: 'CODE12',
      });

      await expect(hostCaller.summaryRuntime({ sessionId: SESSION_ID })).resolves.toEqual({
        enabled: false,
        inferenceConfigured: false,
        result: null,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.summaryRuntime',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'lehnt qa.summaryRuntime ohne Host-Token ab',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: 'CODE12',
      });

      await expect(caller.summaryRuntime({ sessionId: SESSION_ID })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Host-Authentifizierung erforderlich.',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.requestSummary',
      case: 'happy',
      mode: 'direct',
      title: 'startet on demand eine Host-Zusammenfassung und kehrt sofort zurück',
    },
    async () => {
      vi.stubEnv('QA_SUMMARY_ENABLED', 'true');
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: 'CODE12',
      });

      const pending = await hostCaller.requestSummary({ sessionId: SESSION_ID, locale: 'de' });
      expect(pending.enabled).toBe(true);
      expect(pending.result?.status).toBe('pending');
      await waitForQaSummaryIdleForTests();
      const ready = await hostCaller.summaryRuntime({ sessionId: SESSION_ID });
      expect(ready.result?.status).toBe('ready');
      expect(ready.result?.statements[0]?.sourceIds).toEqual([SOURCE_ID]);
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.requestSummary',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'lehnt qa.requestSummary ohne Host-Token ab',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: 'CODE12',
      });

      await expect(
        caller.requestSummary({ sessionId: SESSION_ID, locale: 'de' }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Host-Authentifizierung erforderlich.',
      });
    },
  );

  it('lehnt qa.requestSummary ab wenn der Kill-Switch aus ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'CODE12',
    });

    await expect(
      hostCaller.requestSummary({ sessionId: SESSION_ID, locale: 'de' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Die Moderationszusammenfassung ist nicht aktiviert.',
    });
  });
});
