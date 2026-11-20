import {
  MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1,
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  ModerationAnalysisContextV1Schema,
  QaSummaryExecutionV2Schema,
  type ModerationAnalysisContextV1,
} from '@arsnova/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QA_SUMMARY_ADAPTER_CAPABILITIES,
  assemblePreparedModerationSummaryContext,
  prepareModerationSummaryContextFromAnalysis,
  type PreparedModerationSummaryContext,
} from './moderationSummaryContext';
import type { QaSummaryConfig } from './qaSummaryConfig';
import {
  getQaSummaryRuntime,
  getQaSummaryRuntimeFresh,
  invalidateQaSummaryForSession,
  requestQaSummary,
  resetQaSummaryQueueForTests,
  waitForQaSummaryIdleForTests,
} from './qaSummaryQueue';

const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const ACCESS = { hostToken: 'host-token-123' } as const;

const fullContextPlan = {
  capabilities: QA_SUMMARY_ADAPTER_CAPABILITIES,
  selectedMode: 'full-context' as const,
  fallback: null,
  inferenceConfigured: true,
};

function analysisFixture(
  fixture:
    | typeof MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1
    | typeof MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1 = MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
): ModerationAnalysisContextV1 {
  const clone = structuredClone(fixture);
  return ModerationAnalysisContextV1Schema.parse({
    schemaVersion: clone.schemaVersion,
    contractVersion: MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
    assembledAt: '2026-01-15T10:05:00.000Z',
    context: { ...clone.context, representation: 'analysis-candidates' },
  });
}

function preparedReference(): PreparedModerationSummaryContext {
  return prepareModerationSummaryContextFromAnalysis({
    analysis: analysisFixture(),
    plan: fullContextPlan,
    packedAt: new Date('2026-01-15T10:06:00.000Z'),
  });
}

function preparedMinimal(): PreparedModerationSummaryContext {
  return prepareModerationSummaryContextFromAnalysis({
    analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1),
    plan: fullContextPlan,
    packedAt: new Date('2026-01-15T10:06:00.000Z'),
  });
}

function withHash(
  prepared: PreparedModerationSummaryContext,
  hashCharacter: string,
): PreparedModerationSummaryContext {
  const promptContext = structuredClone(prepared.request.promptContext);
  promptContext.snapshotHash = hashCharacter.repeat(64);
  return assemblePreparedModerationSummaryContext({
    promptContext,
    cache: 'miss',
    plan: prepared.plan,
  });
}

function testConfig(overrides: Partial<QaSummaryConfig> = {}): QaSummaryConfig {
  return {
    enabled: true,
    timeoutMs: 200,
    queueLimit: 8,
    concurrency: 1,
    cooldownMs: 30_000,
    ttlMs: 1_800_000,
    maxSources: 20,
    inferenceUrl: null,
    inferenceToken: null,
    ...overrides,
  };
}

function completedRun(prepared: PreparedModerationSummaryContext) {
  const sourceId = prepared.request.promptContext.context.sources[0]?.id;
  if (!sourceId) throw new Error('Fixture needs one packed source.');
  return {
    output: {
      status: 'ready' as const,
      statements: [{ text: 'Es gibt ein wiederkehrendes Anliegen.', sourceIds: [sourceId] }],
      suggestedNextSteps: [],
      limitations: [],
      modelVersion: 'test-model',
    },
    execution: QaSummaryExecutionV2Schema.parse({
      attemptedMode: 'full-context',
      effectiveMode: 'full-context',
      fallback: null,
    }),
  };
}

describe('qaSummaryQueue V2', () => {
  afterEach(() => resetQaSummaryQueueForTests());

  it('nimmt ohne Produktflag keinen Job an und baut keinen Kontext', async () => {
    const prepare = vi.fn(async () => preparedReference());
    resetQaSummaryQueueForTests({
      config: () => testConfig({ enabled: false }),
      plan: () => fullContextPlan,
      prepare,
    });

    const runtime = await requestQaSummary(SESSION_ID, 'de', ACCESS);
    expect(runtime).toMatchObject({ schemaVersion: 2, enabled: false, result: null });
    expect(prepare).not.toHaveBeenCalled();
  });

  it('durchläuft initiale, Vor- und Nachprüfung und liefert ein V2-Ergebnis', async () => {
    const prepared = preparedReference();
    const prepare = vi.fn(async () => prepared);
    const processor = vi.fn(async () => completedRun(prepared));
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      plan: () => fullContextPlan,
      prepare,
      processor,
    });

    const pending = await requestQaSummary(SESSION_ID, 'de', ACCESS);
    expect(pending.result?.status).toBe('pending');
    await waitForQaSummaryIdleForTests();
    expect((await getQaSummaryRuntime(SESSION_ID)).result).toMatchObject({
      schemaVersion: 2,
      status: 'ready',
      execution: { effectiveMode: 'full-context', fallback: null },
    });
    expect(prepare).toHaveBeenCalledTimes(3);
    expect(processor).toHaveBeenCalledTimes(1);
  });

  it('baut beim Polling eines pending-Ergebnisses keinen Kontext neu', async () => {
    const prepared = preparedReference();
    const prepare = vi.fn(async () => prepared);
    let scheduled: (() => void) | undefined;
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      plan: () => fullContextPlan,
      prepare,
      processor: async () => completedRun(prepared),
      schedule: (fn) => {
        scheduled = fn;
      },
    });

    await requestQaSummary(SESSION_ID, 'de', ACCESS);
    expect(prepare).toHaveBeenCalledTimes(1);
    await expect(getQaSummaryRuntimeFresh(SESSION_ID, ACCESS)).resolves.toMatchObject({
      result: { status: 'pending' },
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(scheduled).toBeTypeOf('function');
  });

  it('verwirft generative Ausgabe wenn sich Quellen während der Inferenz ändern', async () => {
    const before = withHash(preparedReference(), 'a');
    const after = withHash(preparedReference(), 'b');
    const prepare = vi
      .fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      plan: () => fullContextPlan,
      prepare,
      processor: async () => completedRun(before),
    });

    await requestQaSummary(SESSION_ID, 'de', ACCESS);
    await waitForQaSummaryIdleForTests();
    const result = (await getQaSummaryRuntime(SESSION_ID)).result;
    expect(result?.snapshotHash).toBe('b'.repeat(64));
    expect(result?.execution).toMatchObject({
      effectiveMode: 'extractive',
      fallback: { reason: 'source_changed' },
    });
    expect(result?.statements[0]?.text).not.toContain('wiederkehrendes Anliegen');
  });

  it('liefert bei entzogenem Host-Zugriff keine Quellen aus', async () => {
    const prepared = preparedReference();
    const permissionError = Object.assign(new Error('Host access revoked'), {
      code: 'UNAUTHORIZED',
    });
    const prepare = vi.fn().mockResolvedValueOnce(prepared).mockRejectedValueOnce(permissionError);
    const processor = vi.fn(async () => completedRun(prepared));
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      plan: () => fullContextPlan,
      prepare,
      processor,
    });

    await requestQaSummary(SESSION_ID, 'de', ACCESS);
    await waitForQaSummaryIdleForTests();

    expect(processor).not.toHaveBeenCalled();
    expect((await getQaSummaryRuntime(SESSION_ID)).result).toMatchObject({
      status: 'failed',
      statements: [],
      suggestedNextSteps: [],
      sources: [],
      execution: {
        effectiveMode: 'rule-based',
        fallback: { reason: 'permission_changed' },
      },
    });
  });

  it('revalidiert ein fertiges Ergebnis unmittelbar vor der Auslieferung', async () => {
    const before = withHash(preparedReference(), 'c');
    const after = withHash(preparedReference(), 'd');
    let current = before;
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      plan: () => fullContextPlan,
      prepare: async () => current,
      processor: async () => completedRun(before),
    });

    await requestQaSummary(SESSION_ID, 'de', ACCESS);
    await waitForQaSummaryIdleForTests();
    current = after;
    const delivered = await getQaSummaryRuntimeFresh(SESSION_ID, ACCESS);
    expect(delivered.result).toMatchObject({
      snapshotHash: 'd'.repeat(64),
      execution: { effectiveMode: 'extractive', fallback: { reason: 'source_changed' } },
    });
  });

  it('liefert kein Ergebnis aus, das während des Quellenabgleichs invalidiert wurde', async () => {
    const prepared = preparedReference();
    let releaseRead: (() => void) | undefined;
    let blockNextPrepare = false;
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      plan: () => fullContextPlan,
      prepare: async () => {
        if (blockNextPrepare) {
          await new Promise<void>((resolve) => {
            releaseRead = resolve;
          });
        }
        return prepared;
      },
      processor: async () => completedRun(prepared),
    });
    await requestQaSummary(SESSION_ID, 'de', ACCESS);
    await waitForQaSummaryIdleForTests();
    blockNextPrepare = true;

    const reading = getQaSummaryRuntimeFresh(SESSION_ID, ACCESS);
    await vi.waitFor(() => expect(releaseRead).toBeTypeOf('function'));
    await invalidateQaSummaryForSession(SESSION_ID);
    releaseRead?.();
    await expect(reading).resolves.toMatchObject({ result: null });
  });

  it('bricht den laufenden Processor beim Queue-Timeout ab und gibt den Slot frei', async () => {
    const prepared = preparedReference();
    let observedAbort = false;
    let calls = 0;
    resetQaSummaryQueueForTests({
      config: () => testConfig({ timeoutMs: 20 }),
      plan: () => fullContextPlan,
      prepare: async () => prepared,
      processor: async (_prepared, { signal }) => {
        calls += 1;
        if (calls > 1) return completedRun(prepared);
        return new Promise((resolve) => {
          signal.addEventListener(
            'abort',
            () => {
              observedAbort = signal.aborted;
              resolve(completedRun(prepared));
            },
            { once: true },
          );
        });
      },
    });

    await requestQaSummary(SESSION_ID, 'de', ACCESS);
    await waitForQaSummaryIdleForTests();
    expect(observedAbort).toBe(true);
    expect((await getQaSummaryRuntime(SESSION_ID)).result?.execution.fallback?.reason).toBe(
      'timeout',
    );

    await requestQaSummary(SESSION_ID, 'de', ACCESS);
    await waitForQaSummaryIdleForTests();
    expect(calls).toBe(2);
    expect((await getQaSummaryRuntime(SESSION_ID)).result?.status).toBe('ready');
  });

  it('bricht und verwirft laufende Artefakte bei Session-Purge', async () => {
    const prepared = preparedReference();
    let started = false;
    let aborted = false;
    resetQaSummaryQueueForTests({
      config: () => testConfig({ timeoutMs: 1_000 }),
      plan: () => fullContextPlan,
      prepare: async () => prepared,
      processor: async (_prepared, { signal }) =>
        new Promise((resolve) => {
          started = true;
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              resolve(completedRun(prepared));
            },
            { once: true },
          );
        }),
    });

    await requestQaSummary(SESSION_ID, 'de', ACCESS);
    await vi.waitFor(() => expect(started).toBe(true));
    await invalidateQaSummaryForSession(SESSION_ID);
    await waitForQaSummaryIdleForTests();
    expect(aborted).toBe(true);
    expect((await getQaSummaryRuntime(SESSION_ID)).result).toBeNull();
  });

  it('löscht den ephemeren Host-Token nach dem Job aus dem Queue-Objekt', async () => {
    const prepared = preparedReference();
    let queuedAccess: { hostToken?: string } | undefined;
    let prepareCalls = 0;
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      plan: () => fullContextPlan,
      prepare: async ({ access }) => {
        prepareCalls += 1;
        if (prepareCalls > 1) queuedAccess = access;
        return prepared;
      },
      processor: async () => completedRun(prepared),
    });

    await requestQaSummary(SESSION_ID, 'de', ACCESS);
    await waitForQaSummaryIdleForTests();
    expect(queuedAccess).toBeDefined();
    expect(queuedAccess?.hostToken).toBeUndefined();
  });

  it('ruft bei weniger als drei berechtigten Fragen keinen Processor auf', async () => {
    const prepared = preparedMinimal();
    const processor = vi.fn(async () => completedRun(prepared));
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      plan: () => fullContextPlan,
      prepare: async () => prepared,
      processor,
    });

    const runtime = await requestQaSummary(SESSION_ID, 'de', ACCESS);
    expect(runtime.result).toMatchObject({ status: 'uncertain' });
    expect(processor).not.toHaveBeenCalled();
  });

  it('ersetzt ein fertiges Ergebnis wenn der berechtigte Korpus unter drei Fragen schrumpft', async () => {
    const before = preparedReference();
    const after = preparedMinimal();
    let current = before;
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      plan: () => fullContextPlan,
      prepare: async () => current,
      processor: async () => completedRun(before),
    });

    await requestQaSummary(SESSION_ID, 'de', ACCESS);
    await waitForQaSummaryIdleForTests();
    const oldResult = (await getQaSummaryRuntime(SESSION_ID)).result;
    expect(oldResult?.status).toBe('ready');
    expect(oldResult?.sources.length).toBeGreaterThan(0);

    current = after;
    const refreshed = await requestQaSummary(SESSION_ID, 'de', ACCESS);

    expect(refreshed.result).toMatchObject({
      status: 'uncertain',
      snapshotHash: after.request.promptContext.snapshotHash,
      statements: [],
      sources: [],
    });
    expect(refreshed.result?.snapshotHash).not.toBe(oldResult?.snapshotHash);
  });

  it('reiht bei überlappendem Kontextaufbau derselben Session nur einen Job ein', async () => {
    const prepared = preparedReference();
    let prepareCalls = 0;
    let releaseSecondPrepare: (() => void) | undefined;
    let notifySecondPrepare: (() => void) | undefined;
    const secondPrepareStarted = new Promise<void>((resolve) => {
      notifySecondPrepare = resolve;
    });
    const secondPrepareBlocked = new Promise<void>((resolve) => {
      releaseSecondPrepare = resolve;
    });
    let releaseProcessor: (() => void) | undefined;
    let notifyProcessor: (() => void) | undefined;
    const processorStarted = new Promise<void>((resolve) => {
      notifyProcessor = resolve;
    });
    const processorBlocked = new Promise<void>((resolve) => {
      releaseProcessor = resolve;
    });
    const processor = vi.fn(async () => {
      notifyProcessor?.();
      await processorBlocked;
      return completedRun(prepared);
    });
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      plan: () => fullContextPlan,
      prepare: async () => {
        prepareCalls += 1;
        if (prepareCalls === 2) {
          notifySecondPrepare?.();
          await secondPrepareBlocked;
        }
        return prepared;
      },
      processor,
    });

    const firstRequest = requestQaSummary(SESSION_ID, 'de', ACCESS);
    const secondRequest = requestQaSummary(SESSION_ID, 'de', ACCESS);
    await secondPrepareStarted;
    await expect(firstRequest).resolves.toMatchObject({ result: { status: 'pending' } });
    await processorStarted;

    releaseSecondPrepare?.();
    await expect(secondRequest).resolves.toMatchObject({ result: { status: 'pending' } });
    expect(processor).toHaveBeenCalledTimes(1);

    releaseProcessor?.();
    await waitForQaSummaryIdleForTests();
    expect(processor).toHaveBeenCalledTimes(1);
    expect((await getQaSummaryRuntime(SESSION_ID)).result?.status).toBe('ready');
  });
});
