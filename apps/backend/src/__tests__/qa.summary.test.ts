import type { IncomingMessage } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1,
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  ModerationAnalysisContextV1Schema,
  QaSummaryExecutionV2Schema,
} from '@arsnova/shared-types';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: { findUnique: vi.fn() },
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));

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
  QA_SUMMARY_ADAPTER_CAPABILITIES,
  prepareModerationSummaryContextFromAnalysis,
} from '../lib/moderationSummaryContext';
import { resetQaSummaryQueueForTests, waitForQaSummaryIdleForTests } from '../lib/qaSummaryQueue';
import { createExtractiveQaSummaryOutput } from '../lib/qaSummaryExtractive';

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
const plan = {
  capabilities: QA_SUMMARY_ADAPTER_CAPABILITIES,
  selectedMode: 'full-context' as const,
  fallback: null,
  inferenceConfigured: true,
};

const fixture = structuredClone(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1);
const analysis = ModerationAnalysisContextV1Schema.parse({
  schemaVersion: fixture.schemaVersion,
  contractVersion: MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  assembledAt: '2026-01-15T10:05:00.000Z',
  context: { ...fixture.context, representation: 'analysis-candidates' },
});
const prepared = prepareModerationSummaryContextFromAnalysis({
  analysis,
  plan,
  packedAt: new Date('2026-01-15T10:06:00.000Z'),
});
const sourceId = prepared.request.promptContext.context.sources[0]!.id;

function activeSession() {
  return {
    id: SESSION_ID,
    code: 'CODE12',
    type: 'Q_AND_A',
    status: 'ACTIVE',
    endedAt: null,
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    qaEnabled: true,
    qaOpen: true,
    qaClosesAt: new Date('2027-01-01T00:00:00.000Z'),
  };
}

describe('qa summary V2 (issue #456 slice 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('QA_SUMMARY_ENABLED', '');
    resetQaSummaryQueueForTests({
      prepare: async () => prepared,
      plan: () => plan,
      processor: async () => ({
        output: {
          status: 'ready',
          statements: [{ text: 'Ein belegtes Anliegen.', sourceIds: [sourceId] }],
          suggestedNextSteps: [],
          limitations: [],
          modelVersion: 'test-model',
        },
        execution: QaSummaryExecutionV2Schema.parse({
          attemptedMode: 'full-context',
          effectiveMode: 'full-context',
          fallback: null,
        }),
      }),
    });
    hostAuthMocks.extractHostTokenMock.mockImplementation((req: unknown) => {
      const token = (req as { headers?: { 'x-host-token'?: string } } | undefined)?.headers?.[
        'x-host-token'
      ];
      return typeof token === 'string' ? token : null;
    });
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  afterEach(async () => {
    await waitForQaSummaryIdleForTests().catch(() => undefined);
    resetQaSummaryQueueForTests();
    vi.unstubAllEnvs();
  });

  it.each([
    ['de', 'Eine ausführliche Zusammenfassung'],
    ['en', 'A detailed summary'],
    ['fr', 'Un résumé détaillé'],
    ['es', 'Esta vez no ha sido posible'],
    ['it', 'Questa volta non è stato possibile'],
  ] as const)(
    'lokalisiert den extraktiven Fallback in %s und übernimmt die Quelle',
    (locale, copy) => {
      const fixture = MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1;
      const fallbackContext = { ...fixture, context: { ...fixture.context, locale } };
      const source = fallbackContext.context.sources[0]!;
      const result = createExtractiveQaSummaryOutput(fallbackContext);

      expect(result.status).toBe('ready');
      expect(result.statements).toEqual([{ text: source.content.text, sourceIds: [source.id] }]);
      expect(result.limitations[0]).toContain(copy);
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.summaryRuntime',
      case: 'happy',
      mode: 'direct',
      title: 'liefert den V2-Kill-Switch-Zustand ausschließlich an den Host',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(activeSession());
      await expect(hostCaller.summaryRuntime({ sessionId: SESSION_ID })).resolves.toMatchObject({
        schemaVersion: 2,
        enabled: false,
        capabilities: { contractVersion: 'qa-summary-adapter-capabilities-v1' },
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
      prismaMock.session.findUnique.mockResolvedValue(activeSession());
      await expect(caller.summaryRuntime({ sessionId: SESSION_ID })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.requestSummary',
      case: 'happy',
      mode: 'direct',
      title: 'startet bewusst den V2-Kontextpfad und liefert quellengebunden aus',
    },
    async () => {
      vi.stubEnv('QA_SUMMARY_ENABLED', 'true');
      prismaMock.session.findUnique.mockResolvedValue(activeSession());

      const pending = await hostCaller.requestSummary({ sessionId: SESSION_ID, locale: 'de' });
      expect(pending.result?.status).toBe('pending');
      await waitForQaSummaryIdleForTests();
      const ready = await hostCaller.summaryRuntime({ sessionId: SESSION_ID });
      expect(ready.result).toMatchObject({
        schemaVersion: 2,
        status: 'ready',
        statements: [{ sourceIds: [sourceId] }],
        execution: { effectiveMode: 'full-context' },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.summaryContextPreview',
      case: 'happy',
      mode: 'direct',
      title: 'liefert dem Host exakt denselben sicheren gepackten Kontext',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(activeSession());
      const preview = await hostCaller.summaryContextPreview({
        sessionId: SESSION_ID,
        locale: 'de',
      });
      expect(preview.promptContext).toEqual(prepared.request.promptContext);
      expect(preview).not.toHaveProperty('instructionText');
      expect(preview).not.toHaveProperty('definitionText');
    },
  );

  trpcDodIt(
    {
      procedure: 'qa.summaryContextPreview',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'lehnt qa.summaryContextPreview ohne Host-Token ab',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(activeSession());
      await expect(
        caller.summaryContextPreview({ sessionId: SESSION_ID, locale: 'de' }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
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
      vi.stubEnv('QA_SUMMARY_ENABLED', 'true');
      prismaMock.session.findUnique.mockResolvedValue(activeSession());
      await expect(
        caller.requestSummary({ sessionId: SESSION_ID, locale: 'de' }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  it('lehnt den bewussten Auftrag ab wenn der Produkt-Kill-Switch aus ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue(activeSession());
    await expect(
      hostCaller.requestSummary({ sessionId: SESSION_ID, locale: 'de' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('erlaubt dem Host die Zusammenfassung auch in der Nachbereitungsfrist nach Session-Ende', async () => {
    vi.stubEnv('QA_SUMMARY_ENABLED', 'true');
    const endedRecently = new Date(Date.now() - 60_000);
    prismaMock.session.findUnique.mockResolvedValue({
      ...activeSession(),
      status: 'FINISHED',
      endedAt: endedRecently,
      qaClosesAt: endedRecently,
    });

    const pending = await hostCaller.requestSummary({ sessionId: SESSION_ID, locale: 'de' });
    expect(pending.result?.status).toBe('pending');
    await waitForQaSummaryIdleForTests();
    const ready = await hostCaller.summaryRuntime({ sessionId: SESSION_ID });
    expect(ready.result?.status).toBe('ready');
  });
});
