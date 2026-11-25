import { setTimeout as sleep } from 'node:timers/promises';
import { AnalyzeQaWordCloudInputSchema } from '@arsnova/shared-types';

export async function summaryOperation({
  hostClient,
  sessionId,
  index,
  locale,
  signal,
  waitMaxMs = 900000,
  now = () => performance.now(),
  wait = (ms, s) => sleep(ms, undefined, { signal: s }),
}) {
  const deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(waitMaxMs)]);
  const requestedAt = new Date().toISOString(),
    t0 = now();
  let rt = await (
    await hostClient()
  ).qa.requestSummary.mutate({ sessionId, locale }, { signal: deadline });
  const hostReturnMs = Math.round(now() - t0);
  while (rt.result?.status === 'pending' || rt.result === null) {
    if (now() - t0 > waitMaxMs) throw new Error(`Auftrag ${index}: kein Endstatus im Wartebudget.`);
    await wait(1000, deadline);
    rt = await (await hostClient()).qa.summaryRuntime.query({ sessionId }, { signal: deadline });
  }
  const e = rt.result.execution;
  return {
    consumer: 'summary',
    index,
    requestedAt,
    finishedAt: new Date().toISOString(),
    hostReturnMs,
    clientWaitMs: Math.round(now() - t0),
    status: rt.result.status,
    attemptedMode: e.attemptedMode,
    effectiveMode: e.effectiveMode,
    fallbackReason: e.fallback?.reason ?? null,
    fallbackRetry: e.fallback?.retry ?? null,
    snapshotHash: rt.result.snapshotHash,
    modelVersion: rt.result.modelVersion ?? null,
    statements: rt.result.statements.length,
  };
}

export async function labelOperation({ hostClient, code, index, locale, signal }) {
  const input = AnalyzeQaWordCloudInputSchema.parse({
    sessionCode: code,
    mode: 'SEMANTIC',
    locale,
    metric: 'TOP',
    normalization: 'NONE',
    refresh: true,
    limit: 100,
  });
  const startedAt = performance.now(),
    requestedAt = new Date().toISOString();
  const result = await (
    await hostClient()
  ).wordCloud.analyzeQa.mutate(input, {
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(300000)]),
  });
  if (!result.labelSettlement || result.labelSettlement === 'disabled') {
    // Ein früher Semantic-Fallback ist nicht gleichbedeutend mit einem Kill-Switch.
    // Nur Zustandsfelder ausgeben; keine Einträge, Quellen, IDs oder Tokens.
    const diagnostic = {
      status: result.status ?? null,
      mode: result.mode ?? null,
      effectiveMode: result.effectiveMode ?? null,
      fallbackUsed: result.fallbackUsed ?? null,
      labelSettlement: result.labelSettlement ?? null,
      encoderModelPresent: Boolean(result.modelVersion),
      analyzedQuestionCount: result.analyzedQuestionCount ?? null,
      entries: result.entries.length,
    };
    throw new Error(`Label-Pfad nicht erreicht: ${JSON.stringify(diagnostic)}`);
  }
  return {
    consumer: 'label',
    index,
    requestedAt,
    finishedAt: new Date().toISOString(),
    clientWaitMs: Math.round(performance.now() - startedAt),
    status: result.status,
    attemptedMode: 'SEMANTIC',
    effectiveMode: result.effectiveMode ?? null,
    labelSettlement: result.labelSettlement,
    labelModelAccepted: Boolean(result.labelModelId),
    fallbackReason: null,
    fallbackReasonSource: 'not-exposed-by-label-api',
    fallbackTimingAvailable: false,
    snapshotHash: result.snapshotHash,
    entries: result.entries.length,
  };
}
