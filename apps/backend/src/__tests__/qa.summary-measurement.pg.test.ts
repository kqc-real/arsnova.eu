/**
 * Opt-in lokale Messreihe zur Q&A-Zusammenfassung: Rückkehrzeit von
 * `qa.requestSummary` und Gesamtdauer bis zum Endstatus, Kosten eines
 * Kontextaufbaus und der Validierung, Zahl der Kontextaufbauten je Auftrag und
 * Nutzlastgröße sowie eine Variante der Queue ohne erneuten Kontextaufbau nach
 * der Inferenz im Vergleich zur unveränderten Queue.
 *
 * Opt-in über `RUN_QA_SUMMARY_MEASUREMENT=1`; braucht `DATABASE_URL`, `REDIS_URL`
 * und `QA_SUMMARY_MEASUREMENT_OUT` (Zielpfad der JSON-Datei). Läuft nicht in der
 * CI, weil Zeitwerte dort nicht vergleichbar sind. Die Datei enthält **keine**
 * Zeit-Assertions; sie prüft nur, dass jeder Lauf einen Endstatus erreicht, und
 * schreibt alle Rohwerte samt Umgebung.
 *
 * Messinstrumente rufen die echten Funktionen unverändert auf. Gemockt ist nur
 * die Host-Tokenprüfung. Die Test-Runtime ist kein Modell (keine Modellzeit).
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, totalmem } from 'node:os';
import { dirname } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { hostAuthMocks } = vi.hoisted(() => ({
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

import {
  OpenWeightLlmOutputSchema,
  OpenWeightLlmRequestSchema,
  QaSummaryModelOutputV2Schema,
  type QaSummaryResultV2,
  type QaSummaryRuntimeV2DTO,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { getRedis } from '../redis';
import {
  assemblePreparedModerationSummaryContext,
  prepareFreshModerationSummaryContext,
  resolveQaSummaryAdapterPlan,
  type PreparedModerationSummaryContext,
} from '../lib/moderationSummaryContext';
import { resetOpenWeightLlmClientForTests } from '../lib/openWeightLlmClient';
import {
  getQaSummaryRuntime,
  resetQaSummaryQueueForTests,
  waitForQaSummaryIdleForTests,
  type QaSummaryContextPreparer,
} from '../lib/qaSummaryQueue';
import { buildLatestQaSemanticTopicSnapshotCacheKey } from '../lib/wordCloudAnalysisCache';
import { qaRouter } from '../routers/qa';
import {
  TEST_RUNTIME_STATEMENT_TEXT,
  closedLoopbackUrl,
  defaultCompletionBody,
  startTestRuntime,
  useTestRuntimeEnv,
  userMessageOf,
  type TestRuntime,
} from './lib/open-weight-test-runtime';
import {
  REFERENCE_SCENARIO_PARTICIPANTS,
  capturePlatformStatistic,
  changeVote,
  cleanupFixtures,
  createFixtureRegistry,
  createFullContextScenario,
  createReferenceScenario,
  restorePlatformStatistic,
  type PlatformStatisticSnapshot,
  type ReferenceScenario,
} from './lib/qa-summary-pg-fixture';

const RUN = process.env['RUN_QA_SUMMARY_MEASUREMENT'] === '1';
const HOST_TOKEN = `host-token-${randomUUID()}`;
const ACCESS = { hostToken: HOST_TOKEN } as const;
const hostCaller = qaRouter.createCaller({ req: {} as never });

/** Vorab festgelegte Laufzahlen und Runtime-Verzögerung. */
const WARMUP_RUNS = 3;
const MEASURED_RUNS = 20;
const VALIDATION_RUNS = 200;
const V1_RUNS = 10;
const V1_DELAY_MS = 2_000;
const TERMINAL_WAIT_MS = 30_000;
/** Packing-Cache-TTL (`MODERATION_PROMPT_PACKING_CACHE_TTL_MS` = 30 s) plus Abstand. */
const PACKING_CACHE_EXPIRY_STEP_MS = 31_000;
/**
 * Reihenfolge des Variantenvergleichs. `sequential` (Standard): je Variante und
 * Szenario alle Läufe am Stück, unveränderte Queue zuerst. `alternating`: je
 * Iteration ein Lauf jeder Variante, die Reihenfolge wechselt von Iteration zu
 * Iteration. Konstanten-, Env- und JSON-Namen mit `V1` bleiben aus Kompatibilität
 * mit den aufgezeichneten Rohdaten und der Auswertung unverändert.
 */
const V1_MODE =
  process.env['QA_SUMMARY_MEASUREMENT_V1_MODE'] === 'alternating' ? 'alternating' : 'sequential';
const MEASUREMENT_TESTS = ['m1m2m5', 'm3m4', 'v1'] as const;

type Phase = 'request' | 'job' | 'read' | 'other';

type CountedCall = { readonly phase: Phase; readonly real: boolean };

type RunTrace = {
  calls: CountedCall[];
  phase: Phase;
  /** Variante ohne Nachprüfung: Ergebnis des zweiten Kontextaufbaus dieses Auftrags. */
  secondPrepare: PreparedModerationSummaryContext | null;
};

const now = () => performance.now();

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function asV2Runtime(value: unknown): QaSummaryRuntimeV2DTO {
  const runtime = value as QaSummaryRuntimeV2DTO;
  if (runtime.schemaVersion !== 2) throw new Error('summary runtime is not V2');
  return runtime;
}

function resultSummary(result: QaSummaryResultV2 | null) {
  return {
    status: result?.status ?? null,
    effectiveMode: result?.execution.effectiveMode ?? null,
    fallbackReason: result?.execution.fallback?.reason ?? null,
    snapshotHash: result?.snapshotHash ?? null,
    hasRuntimeStatement:
      result?.statements.some((statement) => statement.text === TEST_RUNTIME_STATEMENT_TEXT) ??
      false,
  };
}

/**
 * Zählender Wrapper um den echten Queue-Hook `prepare`. Ruft
 * `prepareFreshModerationSummaryContext` unverändert auf. Mit `skipThird`
 * liefert der dritte Aufruf je Auftrag das Ergebnis des zweiten zurück, statt
 * neu aufzubauen.
 */
function countingPrepare(
  trace: RunTrace,
  options: { skipThird: boolean },
): QaSummaryContextPreparer {
  return async (input) => {
    const index = trace.calls.length + 1;
    if (options.skipThird && index === 3 && trace.secondPrepare) {
      trace.calls.push({ phase: trace.phase, real: false });
      return trace.secondPrepare;
    }
    trace.calls.push({ phase: trace.phase, real: true });
    const prepared = await prepareFreshModerationSummaryContext(input);
    if (index === 2) trace.secondPrepare = prepared;
    return prepared;
  };
}

describe.skipIf(!RUN)(
  'Q&A summary local measurement (PostgreSQL + Redis)',
  { timeout: 1_800_000 },
  () => {
    const registry = createFixtureRegistry();
    let platformBefore: PlatformStatisticSnapshot | null = null;
    /** `completed` wird erst gesetzt, wenn alle Messblöcke durchgelaufen sind. */
    const output: Record<string, unknown> = { completed: false };
    const testsCompleted: string[] = [];
    const scenarioQaVotes: number[] = [];

    async function scenario(): Promise<ReferenceScenario> {
      if (!platformBefore) platformBefore = await capturePlatformStatistic();
      const room = await createReferenceScenario({ registry });
      // Tatsächlich gespeicherte Q&A-Stimmen (statt eines festen Werts).
      scenarioQaVotes.push(
        await prisma.qaUpvote.count({ where: { qaQuestion: { sessionId: room.sessionId } } }),
      );
      return room;
    }

    async function deleteSessionRedisKeys(sessionId: string): Promise<number> {
      const redis = getRedis();
      const keys = await redis.keys(`*${sessionId}*`);
      if (keys.length > 0) await redis.del(...keys);
      return keys.length;
    }

    /**
     * Ein Auftrag über den Router. Wartet ohne Kontextaufbau auf das Ende des
     * Jobs (interner Zustand, sekundär), liest dann genau einmal über
     * `qa.summaryRuntime` (primär, was der Host sieht).
     */
    async function runJob(input: { room: ReferenceScenario; trace: RunTrace }) {
      const started = now();
      input.trace.phase = 'request';
      const requested = asV2Runtime(
        await hostCaller.requestSummary({ sessionId: input.room.sessionId, locale: 'de' }),
      );
      const requestMs = now() - started;
      input.trace.phase = 'job';
      let internal = (await getQaSummaryRuntime(input.room.sessionId));
      while (!internal.result || internal.result.status === 'pending') {
        if (now() - started > TERMINAL_WAIT_MS) throw new Error('Job erreichte keinen Endstatus');
        await new Promise((resolve) => setTimeout(resolve, 5));
        internal = (await getQaSummaryRuntime(input.room.sessionId));
      }
      const jobDoneMs = now() - started;
      input.trace.phase = 'read';
      const primary = asV2Runtime(
        await hostCaller.summaryRuntime({ sessionId: input.room.sessionId }),
      );
      const totalMs = now() - started;
      input.trace.phase = 'other';
      await waitForQaSummaryIdleForTests(TERMINAL_WAIT_MS);
      expect(primary.result?.status).toBeDefined();
      expect(primary.result?.status).not.toBe('pending');
      return {
        requestMs: round(requestMs),
        jobDoneMs: round(jobDoneMs),
        totalMs: round(totalMs),
        requestStatus: requested.result?.status ?? null,
        internal: resultSummary(internal.result),
        primary: resultSummary(primary.result),
      };
    }

    function resetForRun(trace: RunTrace, skipThird: boolean): void {
      trace.calls = [];
      trace.phase = 'other';
      trace.secondPrepare = null;
      resetQaSummaryQueueForTests({ prepare: countingPrepare(trace, { skipThird }) });
      resetOpenWeightLlmClientForTests();
    }

    beforeAll(async () => {
      hostAuthMocks.extractHostTokenMock.mockReturnValue(HOST_TOKEN);
      hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
      hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
      const [pg] = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
      const redisInfo = await getRedis().info('server');
      output['environment'] = {
        startedAt: new Date().toISOString(),
        gitSha: process.env['QA_SUMMARY_MEASUREMENT_GIT_SHA'] ?? null,
        // `true`, wenn `git status --porcelain` beim Start nicht leer war.
        gitDirty:
          process.env['QA_SUMMARY_MEASUREMENT_GIT_DIRTY'] === undefined
            ? null
            : process.env['QA_SUMMARY_MEASUREMENT_GIT_DIRTY'] === 'true',
        cpuModel: cpus()[0]?.model ?? null,
        logicalCores: cpus().length,
        totalMemoryBytes: totalmem(),
        node: process.version,
        postgres: pg?.version ?? null,
        redis: /redis_version:(\S+)/.exec(redisInfo)?.[1] ?? null,
        fixture: {
          name: 'MODERATION_PROMPT_REFERENCE_*_FIXTURE_V1 (#456 Abschnitt 12)',
          participants: REFERENCE_SCENARIO_PARTICIPANTS,
          questions: 6,
          qaVotesPerScenario: scenarioQaVotes,
          locale: 'de',
        },
        settings: {
          warmupRuns: WARMUP_RUNS,
          measuredRuns: MEASURED_RUNS,
          validationRuns: VALIDATION_RUNS,
          v1Runs: V1_RUNS,
          v1DelayMs: V1_DELAY_MS,
          timer: 'performance.now()',
          v1Mode: V1_MODE,
        },
      };
    });

    afterAll(async () => {
      try {
        resetQaSummaryQueueForTests();
        resetOpenWeightLlmClientForTests();
        vi.useRealTimers();
        vi.unstubAllEnvs();
        if (platformBefore) {
          await cleanupFixtures(registry);
          await restorePlatformStatistic(platformBefore);
        }
      } finally {
        const target = process.env['QA_SUMMARY_MEASUREMENT_OUT'];
        if (target && output['environment']) {
          (output['environment'] as Record<string, unknown>)['endedAt'] = new Date().toISOString();
          output['testsCompleted'] = testsCompleted;
          output['completed'] = MEASUREMENT_TESTS.every((name) => testsCompleted.includes(name));
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
        }
      }
    });

    it('Rückkehrzeit, Gesamtdauer, Kontextaufbauten und Nutzlastgröße je Runtime-Bedingung', async () => {
      const room = await scenario();
      const trace: RunTrace = { calls: [], phase: 'other', secondPrepare: null };
      const conditions = [
        { name: 'D=0', delayMs: 0 },
        { name: 'D=2000', delayMs: 2_000 },
        { name: 'unreachable', delayMs: null },
      ] as const;
      const results: Record<string, unknown> = {};
      for (const condition of conditions) {
        const runs: unknown[] = [];
        for (let index = 0; index < WARMUP_RUNS + MEASURED_RUNS; index += 1) {
          resetForRun(trace, false);
          let runtime: TestRuntime | null = null;
          let runtimeUrl: string;
          if (condition.delayMs === null) {
            runtimeUrl = await closedLoopbackUrl();
          } else {
            runtime = await startTestRuntime({ delayMs: condition.delayMs });
            runtimeUrl = runtime.baseUrl;
          }
          useTestRuntimeEnv({ baseUrl: runtimeUrl });
          try {
            const run = await runJob({ room, trace });
            const completion = runtime?.requests.find(
              (request) => request.path === '/v1/chat/completions',
            );
            runs.push({
              warmup: index < WARMUP_RUNS,
              ...run,
              prepareHookCalls: trace.calls.length,
              prepareCallsByPhase: trace.calls.map((call) => call.phase),
              requestBodyBytes: completion ? Buffer.byteLength(completion.rawBody, 'utf8') : null,
              userMessageBytes: completion
                ? Buffer.byteLength(userMessageOf(completion.rawBody), 'utf8')
                : null,
            });
          } finally {
            await runtime?.close();
            vi.unstubAllEnvs();
          }
        }
        results[condition.name] = runs;
      }
      output['m1m2m5'] = {
        note: 'requestMs = Aufruf qa.requestSummary bis Antwort; totalMs = Aufruf bis Antwort des ersten qa.summaryRuntime nach Jobende (Jobende über getQaSummaryRuntime im 5-ms-Takt, ohne Kontextaufbau). Gleiches Szenario je Bedingung; zwischen den Läufen Queue und Client zurückgesetzt, Packing-Cache warm. prepareHookCalls zählt den Queue-Hook inkl. erstem Lesepfad-Abruf.',
        conditions: results,
      };
      testsCompleted.push('m1m2m5');
    });

    it('Kosten eines Kontextaufbaus (warm und kalt) und der Validierung', async () => {
      const room = await scenario();
      useTestRuntimeEnv({ baseUrl: 'http://127.0.0.1:9' });
      const prepareOnce = () =>
        prepareFreshModerationSummaryContext({
          sessionId: room.sessionId,
          locale: 'de',
          access: ACCESS,
        });

      const warm: unknown[] = [];
      await prepareOnce();
      for (let index = 0; index < WARMUP_RUNS + MEASURED_RUNS; index += 1) {
        const started = now();
        const prepared = await prepareOnce();
        warm.push({
          warmup: index < WARMUP_RUNS,
          ms: round(now() - started),
          cache: prepared.preview.cache,
        });
      }

      // Kalt: Packing-Cache-Eintrag über seine echte TTL ablaufen lassen (nur `Date`
      // wird verschoben; `performance.now()` bleibt echt) und Redis-Schlüssel der
      // Session löschen. Der Packing-Cache ist nicht exportiert; ein Eingriff in den
      // Produktivcode ist ausgeschlossen.
      const cold: unknown[] = [];
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        for (let index = 0; index < WARMUP_RUNS + MEASURED_RUNS; index += 1) {
          vi.setSystemTime(
            performance.timeOrigin + performance.now() + (index + 1) * PACKING_CACHE_EXPIRY_STEP_MS,
          );
          const deletedRedisKeys = await deleteSessionRedisKeys(room.sessionId);
          const started = now();
          const prepared = await prepareOnce();
          cold.push({
            warmup: index < WARMUP_RUNS,
            ms: round(now() - started),
            cache: prepared.preview.cache,
            deletedRedisKeys,
          });
        }
      } finally {
        vi.useRealTimers();
      }

      // Isolierte Validierung auf dem promptContext des Kontextaufbaus oben.
      const prepared = await prepareOnce();
      const plan = resolveQaSummaryAdapterPlan();
      const promptContext = prepared.request.promptContext;
      const fakeBody = JSON.stringify({
        messages: [{ role: 'user', content: JSON.stringify(promptContext.context) }],
      });
      const completion = JSON.parse(defaultCompletionBody(fakeBody)) as {
        choices: { message: { content: string } }[];
      };
      const wireOutput = JSON.parse(completion.choices[0]!.message.content) as {
        output: unknown;
      };
      const validation: unknown[] = [];
      for (let index = 0; index < WARMUP_RUNS + VALIDATION_RUNS; index += 1) {
        let started = now();
        const assembled = assemblePreparedModerationSummaryContext({
          promptContext,
          cache: 'hit',
          plan,
        });
        const assembleMs = now() - started;
        started = now();
        const requestParse = OpenWeightLlmRequestSchema.safeParse(assembled.request);
        const requestParseMs = now() - started;
        started = now();
        const clientOutputParse = OpenWeightLlmOutputSchema.safeParse(wireOutput);
        const clientOutputParseMs = now() - started;
        started = now();
        const modelOutputParse = QaSummaryModelOutputV2Schema.safeParse(wireOutput.output);
        const modelOutputParseMs = now() - started;
        expect(requestParse.success && clientOutputParse.success && modelOutputParse.success).toBe(
          true,
        );
        validation.push({
          warmup: index < WARMUP_RUNS,
          assembleMs: round(assembleMs),
          requestParseMs: round(requestParseMs),
          clientOutputParseMs: round(clientOutputParseMs),
          modelOutputParseMs: round(modelOutputParseMs),
          totalMs: round(assembleMs + requestParseMs + clientOutputParseMs),
        });
      }
      vi.unstubAllEnvs();

      output['m3'] = {
        note: 'prepareFreshModerationSummaryContext direkt. warm: Packing-Cache gefüllt. kalt: Cache-Eintrag per TTL abgelaufen (Date um je 31 s verschoben) und Redis-Schlüssel der Session gelöscht.',
        warm,
        cold,
      };
      output['m4'] = {
        note: 'assembleMs = assemblePreparedModerationSummaryContext (strikte Parses von Anfrage und Vorschau sowie Legacy-Projektion). requestParseMs = OpenWeightLlmRequestSchema.safeParse. clientOutputParseMs = OpenWeightLlmOutputSchema.safeParse (wie parseCompletion). modelOutputParseMs = QaSummaryModelOutputV2Schema.safeParse (Teilmenge der Client-Prüfung, nur berichtet). totalMs = assemble + request + clientOutput.',
        promptContextBytes: Buffer.byteLength(JSON.stringify(promptContext), 'utf8'),
        runs: validation,
      };
      testsCompleted.push('m3m4');
    });

    it('Variante ohne erneuten Kontextaufbau nach der Inferenz gegen die unveränderte Queue', async () => {
      const variants = [
        // JSON-Schlüssel: `B` = unveränderte Queue, `V1` = ohne erneuten Kontextaufbau
        // nach der Inferenz (der dritte Aufruf liefert das Ergebnis des zweiten).
        { name: 'B', skipThird: false },
        { name: 'V1', skipThird: true },
      ] as const;
      type Variant = (typeof variants)[number];
      const scenarios = ['change', 'quiet'] as const;
      type Kind = (typeof scenarios)[number];
      type Cell = {
        readonly variant: Variant;
        readonly kind: Kind;
        readonly room: ReferenceScenario;
        readonly trace: RunTrace;
        readonly runs: unknown[];
        voter: number;
      };

      async function createCell(variant: Variant, kind: Kind): Promise<Cell> {
        const room = await scenario();
        // Frage C (PINNED) ist abstimmbar; Stimmen kommen von Teilnehmenden, die
        // C noch nicht bewertet haben (von hinten, je Lauf ein neuer).
        return {
          variant,
          kind,
          room,
          trace: { calls: [], phase: 'other', secondPrepare: null },
          runs: [],
          voter: room.participants.length - 1,
        };
      }

      async function runCell(cell: Cell, index: number, order: number): Promise<void> {
        const { room, trace } = cell;
        resetForRun(trace, cell.variant.skipThird);
        const voterId = room.participants[cell.voter]!.id;
        cell.voter -= 1;
        let voted = false;
        const runtime = await startTestRuntime({
          delayMs: V1_DELAY_MS,
          beforeRespond:
            cell.kind === 'change'
              ? async () => {
                  await changeVote(room.questionIdsByKey.C, voterId, 'UP');
                  voted = true;
                }
              : undefined,
        });
        useTestRuntimeEnv(runtime);
        try {
          const run = await runJob({ room, trace });
          const counted = [...trace.calls];
          const fresh = await hostCaller.summaryContextPreview({
            sessionId: room.sessionId,
            locale: 'de',
          });
          const freshHash = fresh.promptContext.snapshotHash;
          const staleBy = (summary: ReturnType<typeof resultSummary>) => ({
            // Definition 1: ready, dessen Hash nicht dem Stand bei Auslieferung entspricht.
            section6: summary.status === 'ready' && summary.snapshotHash !== freshHash,
            // Definition 2: ready mit Modellaussage, obwohl sich der Stand geändert hat.
            section10: summary.status === 'ready' && summary.hasRuntimeStatement && voted,
          });
          cell.runs.push({
            warmup: index < WARMUP_RUNS,
            iteration: index,
            orderInIteration: order,
            ...run,
            dataChanged: voted,
            freshPreviewHash: freshHash,
            prepareHookCalls: counted.length,
            realPrepares: counted.filter((call) => call.real).length,
            prepareCallsByPhase: counted.map((call) => call.phase),
            stalePrimary: staleBy(run.primary),
            staleSecondary: staleBy(run.internal),
          });
        } finally {
          await runtime.close();
          vi.unstubAllEnvs();
        }
      }

      const results: Record<string, unknown> = {};
      if (V1_MODE === 'sequential') {
        for (const variant of variants) {
          for (const kind of scenarios) {
            const cell = await createCell(variant, kind);
            for (let index = 0; index < WARMUP_RUNS + V1_RUNS; index += 1) {
              await runCell(cell, index, 0);
            }
            results[`${variant.name}/${kind}`] = cell.runs;
          }
        }
      } else {
        for (const kind of scenarios) {
          const cells = [await createCell(variants[0], kind), await createCell(variants[1], kind)];
          for (let index = 0; index < WARMUP_RUNS + V1_RUNS; index += 1) {
            // Gerade Iterationen unveränderte Queue zuerst, ungerade die Variante zuerst.
            const ordered = index % 2 === 0 ? cells : [cells[1]!, cells[0]!];
            for (const [order, cell] of ordered.entries()) await runCell(cell, index, order);
          }
          for (const cell of cells) results[`${cell.variant.name}/${kind}`] = cell.runs;
        }
      }
      output['v1'] = {
        mode: V1_MODE,
        note: 'D = 2000 ms. change: Stimme in beforeRespond (nach der Verzögerung, vor der Antwort). primary = erster qa.summaryRuntime-Abruf nach Jobende; secondary = interner Queue-Zustand (getQaSummaryRuntime, ohne Kontextaufbau) direkt nach Jobende. freshPreviewHash = qa.summaryContextPreview direkt nach dem primären Abruf (nicht mitgezählt).',
        runs: results,
      };
      testsCompleted.push('v1');
    });
  },
);

/*
 * Teil 3 (Design `2026-10-24-1c-teil3-design.md` Abschnitt 5): M6 und M7.
 *
 * Opt-in je Block: `RUN_QA_SUMMARY_MEASUREMENT_M6=1` und/oder `RUN_QA_SUMMARY_MEASUREMENT_M7=1`;
 * Zielpfad `QA_SUMMARY_MEASUREMENT_TEIL3_OUT`. Wie oben keine Zeit-Assertions; geprüft wird nur,
 * dass jeder Lauf einen Endstatus erreicht. Der Messcode von Teil 2 oben bleibt unverändert.
 */
const RUN_M6 = process.env['RUN_QA_SUMMARY_MEASUREMENT_M6'] === '1';
const RUN_M7 = process.env['RUN_QA_SUMMARY_MEASUREMENT_M7'] === '1';
/** Unerreichbare Runtime-URL: Der Kontextaufbau braucht nur den Open-Weight-Plan, keinen Aufruf. */
const NO_RUNTIME_URL = 'http://127.0.0.1:9';
const M6_PAYLOAD_JOBS = 3;
/** Vorab festgelegte Raten (Stimmen je Sekunde) und Runtime-Verzögerung von M7. */
/**
 * Bestätigungsmessung M7b (Nachtrag im Protokoll Teil 3): Raten, n und Seed-Basis sind über
 * `QA_SUMMARY_MEASUREMENT_M7_RATES` (kommagetrennt), `QA_SUMMARY_MEASUREMENT_M7_RUNS` und
 * `QA_SUMMARY_MEASUREMENT_M7_SEED_BASE` überschreibbar; ohne sie gelten die Werte von M7.
 */
function m7Number(name: string): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} ist keine Zahl ≥ 0`);
  return value;
}
const M7_RATES_PER_SECOND: readonly number[] = process.env['QA_SUMMARY_MEASUREMENT_M7_RATES']
  ? process.env['QA_SUMMARY_MEASUREMENT_M7_RATES'].split(',').map((rate) => {
      const value = Number(rate);
      if (!Number.isFinite(value) || value < 0) throw new Error(`Ungültige Rate: ${rate}`);
      return value;
    })
  : [0, 0.1, 0.5, 2];
const M7_MEASURED_RUNS = m7Number('QA_SUMMARY_MEASUREMENT_M7_RUNS') ?? MEASURED_RUNS;
const M7_DELAY_MS = 2_000;
/** Seed je Lauf: Basis + 1000 · Index der Rate + Iteration (Aufwärmläufe zuerst). */
const M7_SEED_BASE = m7Number('QA_SUMMARY_MEASUREMENT_M7_SEED_BASE') ?? 20_261_024;
/**
 * Seed-Ableitung. Standard (M7, M7b): Basis + 1000 · Index der Rate + Iteration.
 * `QA_SUMMARY_MEASUREMENT_M7_SEED_MODE=sha256-m7c` (M7c, Nachtrag im Protokoll Teil 3): erste
 * 4 Bytes (uint32, Big-Endian) von SHA-256("M7c|<Rate>|<Iteration>").
 */
const M7_SEED_MODE =
  process.env['QA_SUMMARY_MEASUREMENT_M7_SEED_MODE'] === 'sha256-m7c'
    ? 'sha256-m7c'
    : 'base-offset';
function m7Seed(rateIndex: number, rate: number, iteration: number): number {
  if (M7_SEED_MODE === 'sha256-m7c') {
    return createHash('sha256').update(`M7c|${rate}|${iteration}`).digest().readUInt32BE(0);
  }
  return M7_SEED_BASE + 1000 * rateIndex + iteration;
}
/**
 * Abstimmbare Fixturefragen: `arsnova_change_qa_vote` lehnt `PENDING` ab
 * (`ARSNOVA_QA_QUESTION_NOT_VOTABLE`); A, D und F sind in der Referenzfixture `PENDING`.
 */
const M7_VOTABLE_KEYS = ['B', 'C', 'E'] as const;
type VotableKey = (typeof M7_VOTABLE_KEYS)[number];

type PromptContext = PreparedModerationSummaryContext['request']['promptContext'];

/** Deterministischer Zufallsgenerator (mulberry32), wie in `auswertung.mjs`. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bereiche des gepackten Kontexts: Zustand und Zahl der Einträge nach dem Packen. */
function packedAreas(promptContext: PromptContext) {
  const context = promptContext.context;
  return {
    topics: {
      state: context.topics.state,
      entries: context.topics.state === 'available' ? context.topics.items.length : 0,
    },
    learningObjectives: {
      state: context.learningContext.state,
      entries:
        context.learningContext.state === 'available'
          ? context.learningContext.objectives.length
          : 0,
    },
    quickFeedback: {
      state: context.feedback.state,
      entries: context.feedback.state === 'available' ? context.feedback.aggregates.length : 0,
    },
    releasedResults: {
      state: context.releasedResults.state,
      entries:
        context.releasedResults.state === 'available'
          ? context.releasedResults.aggregates.length
          : 0,
    },
    compass: {
      state: context.compass.state,
      entries: context.compass.state === 'available' ? context.compass.signals.length : 0,
    },
    sources: context.sources.length,
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return `${error.name}${typeof code === 'string' ? `/${code}` : ''}: ${error.message.slice(0, 200)}`;
  }
  return String(error).slice(0, 200);
}

describe.skipIf(!RUN_M6 && !RUN_M7)(
  'Q&A summary local measurement with full context and voting (PostgreSQL + Redis)',
  { timeout: 1_800_000 },
  () => {
    const registry = createFixtureRegistry();
    let platformBefore: PlatformStatisticSnapshot | null = null;
    const output: Record<string, unknown> = { completed: false };
    const enabled = [...(RUN_M6 ? ['m6'] : []), ...(RUN_M7 ? ['m7'] : [])];
    const testsCompleted: string[] = [];

    async function capturePlatformOnce(): Promise<void> {
      if (!platformBefore) platformBefore = await capturePlatformStatistic();
    }

    async function qaVoteCount(sessionId: string): Promise<number> {
      return prisma.qaUpvote.count({ where: { qaQuestion: { sessionId } } });
    }

    /** Wartet ohne Kontextaufbau, bis der Job der Session einen Endstatus gespeichert hat. */
    async function waitForStoredResult(sessionId: string): Promise<QaSummaryResultV2> {
      const started = now();
      for (;;) {
        const result = (await getQaSummaryRuntime(sessionId)).result;
        if (result && result.status !== 'pending') return result;
        if (now() - started > TERMINAL_WAIT_MS) throw new Error('Job erreichte keinen Endstatus');
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    beforeAll(async () => {
      hostAuthMocks.extractHostTokenMock.mockReturnValue(HOST_TOKEN);
      hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
      hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
      const [pg] = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
      const redisInfo = await getRedis().info('server');
      output['environment'] = {
        startedAt: new Date().toISOString(),
        gitSha: process.env['QA_SUMMARY_MEASUREMENT_GIT_SHA'] ?? null,
        gitDirty:
          process.env['QA_SUMMARY_MEASUREMENT_GIT_DIRTY'] === undefined
            ? null
            : process.env['QA_SUMMARY_MEASUREMENT_GIT_DIRTY'] === 'true',
        cpuModel: cpus()[0]?.model ?? null,
        logicalCores: cpus().length,
        totalMemoryBytes: totalmem(),
        loadAverageAtStart: loadavg(),
        node: process.version,
        postgres: pg?.version ?? null,
        redis: /redis_version:(\S+)/.exec(redisInfo)?.[1] ?? null,
        enabled,
        settings: {
          warmupRuns: WARMUP_RUNS,
          measuredRuns: MEASURED_RUNS,
          validationRuns: VALIDATION_RUNS,
          m6PayloadJobs: M6_PAYLOAD_JOBS,
          m7RatesPerSecond: M7_RATES_PER_SECOND,
          m7MeasuredRuns: M7_MEASURED_RUNS,
          m7DelayMs: M7_DELAY_MS,
          m7SeedBase: M7_SEED_BASE,
          m7SeedMode: M7_SEED_MODE,
          m7SeedRule:
            M7_SEED_MODE === 'sha256-m7c'
              ? 'seed = uint32 big-endian of the first 4 bytes of sha256("M7c|<rate>|<iteration>")'
              : 'seed = m7SeedBase + 1000 * rateIndex + iteration',
          m7VotableKeys: M7_VOTABLE_KEYS,
          timer: 'performance.now()',
        },
      };
    });

    afterAll(async () => {
      try {
        resetQaSummaryQueueForTests();
        resetOpenWeightLlmClientForTests();
        vi.useRealTimers();
        vi.unstubAllEnvs();
        if (platformBefore) {
          await cleanupFixtures(registry);
          await restorePlatformStatistic(platformBefore);
        }
      } finally {
        const target = process.env['QA_SUMMARY_MEASUREMENT_TEIL3_OUT'];
        if (target && output['environment']) {
          const environment = output['environment'] as Record<string, unknown>;
          environment['endedAt'] = new Date().toISOString();
          environment['loadAverageAtEnd'] = loadavg();
          output['testsCompleted'] = testsCompleted;
          output['completed'] = enabled.every((name) => testsCompleted.includes(name));
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
        }
      }
    });

    it.skipIf(!RUN_M6)(
      'Kosten eines Kontextaufbaus, der Validierung und Nutzlastgröße mit vollem #456-Kontext',
      async () => {
        await capturePlatformOnce();
        /**
         * Bedingungen in fester Reihenfolge. `full/YESNO` ist die vorregistrierte Messung.
         * `reference/m3-env` wiederholt M3/M4 aus Teil 2 unter denselben Bedingungen im selben
         * Lauf (Driftkontrolle für den Faktor). `reference/m6-env` ist die Referenzfixture unter der
         * Umgebung von M6 (trennt den Einfluss der Umgebung von dem der Daten). `full/TEMPO` ist
         * exploratorisch: voller Kontext mit TEMPO-Runde, damit „warm“ ein Packing-Cache-Treffer
         * sein kann (Befund T3.1); ohne Blitzlicht-Quelle, also nicht der volle Kontext von H.
         */
        const conditions = [
          { name: 'full/YESNO', role: 'primary', data: 'full', env: 'm6', type: 'YESNO' },
          { name: 'reference/m3-env', role: 'baseline', data: 'reference', env: 'm3', type: null },
          { name: 'reference/m6-env', role: 'baseline', data: 'reference', env: 'm6', type: null },
          { name: 'full/TEMPO', role: 'exploratory', data: 'full', env: 'm6', type: 'TEMPO' },
        ] as const;

        const results: Record<string, unknown> = {};
        for (const condition of conditions) {
          // Fixture unter NODE_ENV=test anlegen, erst danach die Umgebung der Bedingung setzen.
          const room: ReferenceScenario =
            condition.data === 'full'
              ? await createFullContextScenario({
                  registry,
                  quickFeedbackType: condition.type ?? 'YESNO',
                })
              : await createReferenceScenario({ registry });
          const qaVotes = await qaVoteCount(room.sessionId);
          // Schlüssel, die schon nach dem Anlegen der Fixture bestehen, sind deren Eingaben
          // (Themen-Snapshot samt Index), kein Cache des Kontextaufbaus.
          const protectedRedisKeys = await getRedis().keys(`*${room.sessionId}*`);
          if (condition.data === 'full') {
            expect(protectedRedisKeys).toContain(
              buildLatestQaSemanticTopicSnapshotCacheKey(room.sessionId),
            );
          }
          const envOverrides =
            condition.env === 'm6' ? { WORD_CLOUD_SEMANTIC_ENABLED: 'true' } : undefined;
          const applyEnv = (baseUrl: string) => {
            useTestRuntimeEnv({ baseUrl }, envOverrides);
            // Themen liest nur der echte Redis-Cache; bei NODE_ENV=test liefert
            // `getWordCloudAnalysisCache()` einen No-op-Cache (Protokoll Teil 3, E15).
            if (condition.env === 'm6') vi.stubEnv('NODE_ENV', 'development');
          };
          applyEnv(NO_RUNTIME_URL);

          const prepareOnce = () =>
            prepareFreshModerationSummaryContext({
              sessionId: room.sessionId,
              locale: 'de',
              access: ACCESS,
            });
          const describeBuild = (prepared: PreparedModerationSummaryContext) => {
            const promptContext = prepared.request.promptContext;
            return {
              cache: prepared.preview.cache,
              snapshotHash: promptContext.snapshotHash,
              promptContextBytes: Buffer.byteLength(JSON.stringify(promptContext), 'utf8'),
              dataTokens: promptContext.budget.dataTokens,
              truncations: promptContext.budget.truncations,
              areas: packedAreas(promptContext),
            };
          };

          const warm: unknown[] = [];
          await prepareOnce();
          for (let index = 0; index < WARMUP_RUNS + MEASURED_RUNS; index += 1) {
            const started = now();
            const prepared = await prepareOnce();
            const ms = now() - started;
            warm.push({ warmup: index < WARMUP_RUNS, ms: round(ms), ...describeBuild(prepared) });
          }

          // Kalt wie M3: Packing-Cache-Eintrag per TTL ablaufen lassen (nur `Date`), Redis-Schlüssel
          // der Session löschen. Ausgenommen sind die Eingaben der Fixture (Themen-Snapshot): Der
          // Kontextaufbau erzeugt sie nicht neu; ohne sie fehlte ein Bereich.
          const cold: unknown[] = [];
          vi.useFakeTimers({ toFake: ['Date'] });
          try {
            for (let index = 0; index < WARMUP_RUNS + MEASURED_RUNS; index += 1) {
              vi.setSystemTime(
                performance.timeOrigin +
                  performance.now() +
                  (index + 1) * PACKING_CACHE_EXPIRY_STEP_MS,
              );
              const redis = getRedis();
              const keys = (await redis.keys(`*${room.sessionId}*`)).filter(
                (key) => !protectedRedisKeys.includes(key),
              );
              if (keys.length > 0) await redis.del(...keys);
              const started = now();
              const prepared = await prepareOnce();
              const ms = now() - started;
              cold.push({
                warmup: index < WARMUP_RUNS,
                ms: round(ms),
                deletedRedisKeys: keys.length,
                deletedRedisKeyNames: keys,
                ...describeBuild(prepared),
              });
            }
          } finally {
            vi.useRealTimers();
          }

          // Validierung wie M4 auf dem promptContext eines Kontextaufbaus dieser Bedingung.
          const prepared = await prepareOnce();
          const plan = resolveQaSummaryAdapterPlan();
          const promptContext = prepared.request.promptContext;
          const fakeBody = JSON.stringify({
            messages: [{ role: 'user', content: JSON.stringify(promptContext.context) }],
          });
          const completion = JSON.parse(defaultCompletionBody(fakeBody)) as {
            choices: { message: { content: string } }[];
          };
          const wireOutput = JSON.parse(completion.choices[0]!.message.content) as {
            output: unknown;
          };
          const validation: unknown[] = [];
          for (let index = 0; index < WARMUP_RUNS + VALIDATION_RUNS; index += 1) {
            let started = now();
            const assembled = assemblePreparedModerationSummaryContext({
              promptContext,
              cache: 'hit',
              plan,
            });
            const assembleMs = now() - started;
            started = now();
            const requestParse = OpenWeightLlmRequestSchema.safeParse(assembled.request);
            const requestParseMs = now() - started;
            started = now();
            const clientOutputParse = OpenWeightLlmOutputSchema.safeParse(wireOutput);
            const clientOutputParseMs = now() - started;
            started = now();
            const modelOutputParse = QaSummaryModelOutputV2Schema.safeParse(wireOutput.output);
            const modelOutputParseMs = now() - started;
            expect(
              requestParse.success && clientOutputParse.success && modelOutputParse.success,
            ).toBe(true);
            validation.push({
              warmup: index < WARMUP_RUNS,
              assembleMs: round(assembleMs),
              requestParseMs: round(requestParseMs),
              clientOutputParseMs: round(clientOutputParseMs),
              modelOutputParseMs: round(modelOutputParseMs),
              totalMs: round(assembleMs + requestParseMs + clientOutputParseMs),
            });
          }
          vi.unstubAllEnvs();

          // Nutzlast auf dem Draht: Aufträge über den Router gegen die Test-Runtime (D = 0).
          const jobs: unknown[] = [];
          for (let index = 0; index < M6_PAYLOAD_JOBS; index += 1) {
            resetQaSummaryQueueForTests();
            resetOpenWeightLlmClientForTests();
            const runtime = await startTestRuntime({ delayMs: 0 });
            applyEnv(runtime.baseUrl);
            try {
              await hostCaller.requestSummary({ sessionId: room.sessionId, locale: 'de' });
              const stored = await waitForStoredResult(room.sessionId);
              await waitForQaSummaryIdleForTests(TERMINAL_WAIT_MS);
              const posted = runtime.requests.filter(
                (request) => request.path === '/v1/chat/completions',
              );
              jobs.push({
                completionRequests: posted.length,
                requestBodyBytes: posted[0] ? Buffer.byteLength(posted[0].rawBody, 'utf8') : null,
                userMessageBytes: posted[0]
                  ? Buffer.byteLength(userMessageOf(posted[0].rawBody), 'utf8')
                  : null,
                stored: resultSummary(stored),
              });
            } finally {
              await runtime.close();
              vi.unstubAllEnvs();
            }
          }
          resetQaSummaryQueueForTests();
          resetOpenWeightLlmClientForTests();

          results[condition.name] = {
            role: condition.role,
            data: condition.data,
            env:
              condition.env === 'm6'
                ? { NODE_ENV: 'development', WORD_CLOUD_SEMANTIC_ENABLED: 'true' }
                : { NODE_ENV: 'test', WORD_CLOUD_SEMANTIC_ENABLED: 'false' },
            quickFeedbackType: condition.type,
            qaVotes,
            protectedRedisKeys,
            warm,
            cold,
            validation: {
              promptContextBytes: Buffer.byteLength(JSON.stringify(promptContext), 'utf8'),
              runs: validation,
            },
            jobs,
          };
        }

        output['m6'] = {
          note: 'Je Bedingung eine eigene Session. warm/cold/validation wie M3/M4 aus Teil 2 (prepareFreshModerationSummaryContext direkt; kalt: Date je Lauf um 31 s weiter und Redis-Schlüssel der Session gelöscht, ausgenommen die nach dem Anlegen der Fixture schon vorhandenen Schlüssel (protectedRedisKeys: Themen-Snapshot samt Index)). Je Lauf zusätzlich Packing-Cache, snapshotHash, Bytes des promptContext, dataTokens, budget.truncations und Bereiche des gepackten Kontexts. jobs: Aufträge über qa.requestSummary gegen die Test-Runtime mit D = 0, Bytes des rohen Completion-Bodys; stored = gespeicherter Endstatus des Jobs.',
          conditions: results,
        };
        testsCompleted.push('m6');
      },
    );

    it.skipIf(!RUN_M7)(
      'Anteil source_changed bei Q&A-Stimmen als Poisson-Prozess je Rate während eines Auftrags',
      async () => {
        await capturePlatformOnce();

        /** Teilnehmende ohne eigene Frage und ohne Stimme auf der jeweiligen Frage. */
        async function createVoterPool(room: ReferenceScenario) {
          const available = {} as Record<VotableKey, string[]>;
          for (const key of M7_VOTABLE_KEYS) {
            const questionId = room.questionIdsByKey[key];
            const voted = new Set(
              (
                await prisma.qaUpvote.findMany({
                  where: { qaQuestionId: questionId },
                  select: { participantId: true },
                })
              ).map((vote) => vote.participantId),
            );
            const author = (
              await prisma.qaQuestion.findUniqueOrThrow({
                where: { id: questionId },
                select: { participantId: true },
              })
            ).participantId;
            available[key] = room.participants
              .map((participant) => participant.id)
              .filter((id) => id !== author && !voted.has(id));
          }
          return {
            take(key: VotableKey): string {
              const voter = available[key].pop();
              if (!voter) throw new Error(`Keine freie Stimme mehr auf Frage ${key}`);
              return voter;
            },
            remaining: () =>
              Object.fromEntries(M7_VOTABLE_KEYS.map((key) => [key, available[key].length])),
          };
        }

        async function previewHash(sessionId: string) {
          const preview = await hostCaller.summaryContextPreview({ sessionId, locale: 'de' });
          return { hash: preview.promptContext.snapshotHash, cache: preview.cache };
        }

        // Kalibrierung (exploratorisch, nicht Teil von H/K): Ändert jede Stimmenart den Hash?
        useTestRuntimeEnv({ baseUrl: NO_RUNTIME_URL });
        resetQaSummaryQueueForTests();
        {
          const room = await createReferenceScenario({ registry });
          const pool = await createVoterPool(room);
          const steps: unknown[] = [];
          let previous = await previewHash(room.sessionId);
          const second = await previewHash(room.sessionId);
          steps.push({
            step: 'zwei Vorschauen ohne Änderung',
            hashEqual: second.hash === previous.hash,
            secondCache: second.cache,
          });
          previous = second;
          const record = async (
            step: string,
            action: () => Promise<void>,
            compareWith?: string,
          ) => {
            let error: string | null = null;
            try {
              await action();
            } catch (caught) {
              error = errorText(caught);
            }
            const after = await previewHash(room.sessionId);
            steps.push({
              step,
              error,
              hashChangedVsPrevious: after.hash !== previous.hash,
              ...(compareWith === undefined
                ? {}
                : { hashEqualsReference: after.hash === compareWith }),
              cache: after.cache,
            });
            previous = after;
          };
          for (const key of M7_VOTABLE_KEYS) {
            const voter = pool.take(key);
            await record(`UP neue Stimme auf ${key}`, () =>
              changeVote(room.questionIdsByKey[key], voter, 'UP'),
            );
          }
          const downVoter = pool.take('C');
          await record('DOWN neue Stimme auf C', () =>
            changeVote(room.questionIdsByKey.C, downVoter, 'DOWN'),
          );
          const toggleVoter = pool.take('C');
          const beforeToggle = previous.hash;
          await record('UP neue Stimme auf C (Hin)', () =>
            changeVote(room.questionIdsByKey.C, toggleVoter, 'UP'),
          );
          await record(
            'UP derselben Person auf C noch einmal (nimmt die Stimme zurück)',
            () => changeVote(room.questionIdsByKey.C, toggleVoter, 'UP'),
            beforeToggle,
          );
          await record('UP auf PENDING-Frage A', () =>
            changeVote(room.questionIdsByKey.A, room.participants[199]!.id, 'UP'),
          );
          output['m7calibration'] = {
            note: 'Exploratorisch, nicht vorregistriert. Referenzfixture ohne Blitzlicht; je Schritt eine Stimme über arsnova_change_qa_vote, danach qa.summaryContextPreview. hashEqualsReference: Hash nach dem Zurücknehmen gleich dem Hash vor der Hin-Stimme.',
            steps,
          };
        }
        vi.unstubAllEnvs();

        type PrepareRecord = {
          readonly call: number;
          readonly startedAt: number;
          endedAt: number | null;
          snapshotHash: string | null;
          error: string | null;
        };
        type VoteRecord = {
          readonly scheduledAt: number;
          readonly issuedAt: number;
          readonly resolvedAt: number;
          readonly questionKey: VotableKey;
          readonly error: string | null;
        };

        const rates: Record<string, unknown> = {};
        for (const [rateIndex, rate] of M7_RATES_PER_SECOND.entries()) {
          const room = await createReferenceScenario({ registry });
          const qaVotesBefore = await qaVoteCount(room.sessionId);
          const pool = await createVoterPool(room);
          const runs: unknown[] = [];
          for (let iteration = 0; iteration < WARMUP_RUNS + M7_MEASURED_RUNS; iteration += 1) {
            const seed = m7Seed(rateIndex, rate, iteration);
            const prepares: PrepareRecord[] = [];
            resetQaSummaryQueueForTests({
              prepare: async (input) => {
                const record: PrepareRecord = {
                  call: prepares.length + 1,
                  startedAt: now(),
                  endedAt: null,
                  snapshotHash: null,
                  error: null,
                };
                prepares.push(record);
                try {
                  const prepared = await prepareFreshModerationSummaryContext(input);
                  record.snapshotHash = prepared.request.promptContext.snapshotHash;
                  return prepared;
                } catch (error) {
                  record.error = errorText(error);
                  throw error;
                } finally {
                  record.endedAt = now();
                }
              },
            });
            resetOpenWeightLlmClientForTests();
            const runtime = await startTestRuntime({ delayMs: M7_DELAY_MS });
            useTestRuntimeEnv(runtime);
            const votes: VoteRecord[] = [];
            try {
              const origin = now();
              const requested = asV2Runtime(
                await hostCaller.requestSummary({ sessionId: room.sessionId, locale: 'de' }),
              );
              // Stimmen ab der Rückkehr des Auftrags bis zum gespeicherten Endstatus des Jobs.
              const processStartedAt = now();
              let stopped = false;
              let wake: (() => void) | null = null;
              const voting = (async () => {
                if (rate === 0) return;
                const random = mulberry32(seed);
                let offsetMs = 0;
                for (;;) {
                  offsetMs += (-Math.log(1 - random()) / rate) * 1000;
                  const key = M7_VOTABLE_KEYS[Math.floor(random() * M7_VOTABLE_KEYS.length)]!;
                  const waitMs = processStartedAt + offsetMs - now();
                  if (waitMs > 0) {
                    await new Promise<void>((resolve) => {
                      const timer = setTimeout(resolve, waitMs);
                      wake = () => {
                        clearTimeout(timer);
                        resolve();
                      };
                    });
                    wake = null;
                  }
                  if (stopped) return;
                  const voter = pool.take(key);
                  const issuedAt = now();
                  let error: string | null = null;
                  try {
                    await changeVote(room.questionIdsByKey[key], voter, 'UP');
                  } catch (caught) {
                    error = errorText(caught);
                  }
                  votes.push({
                    scheduledAt: processStartedAt + offsetMs - origin,
                    issuedAt: issuedAt - origin,
                    resolvedAt: now() - origin,
                    questionKey: key,
                    error,
                  });
                }
              })();
              const stored = await waitForStoredResult(room.sessionId);
              const jobDoneAt = now();
              stopped = true;
              (wake as (() => void) | null)?.();
              await voting;
              const votingStoppedAt = now();
              // Was der Host danach sieht (Lesepfad mit erneutem Kontextaufbau), nur berichtet.
              const host = asV2Runtime(
                await hostCaller.summaryRuntime({ sessionId: room.sessionId }),
              );
              await waitForQaSummaryIdleForTests(TERMINAL_WAIT_MS);
              expect(stored.status).not.toBe('pending');

              const relative = (value: number | null) =>
                value === null ? null : round(value - origin);
              // Rolle je Aufbau: 1 = Auftrag; danach die beiden Aufbauten des Jobs (vor und nach der
              // Inferenz), sofern vor dem gespeicherten Endstatus begonnen; alles danach ist Lesepfad.
              // Bricht prepare (2) ab, gibt es kein prepare (3).
              const jobPrepares = prepares.filter(
                (record) => record.call >= 2 && record.startedAt < jobDoneAt,
              );
              const second = jobPrepares[0];
              const third = jobPrepares[1];
              const roleOf = (record: PrepareRecord) =>
                record.call === 1
                  ? 'request'
                  : record === second
                    ? 'before'
                    : record === third
                      ? 'after'
                      : record.startedAt >= jobDoneAt
                        ? 'read'
                        : 'job-other';
              runs.push({
                warmup: iteration < WARMUP_RUNS,
                iteration,
                seed,
                requestStatus: requested.result?.status ?? null,
                processStartedAt: relative(processStartedAt),
                jobDoneAt: relative(jobDoneAt),
                votingStoppedAt: relative(votingStoppedAt),
                prepares: prepares.map((record) => ({
                  call: record.call,
                  role: roleOf(record),
                  startedAt: relative(record.startedAt),
                  endedAt: relative(record.endedAt),
                  snapshotHash: record.snapshotHash,
                  error: record.error,
                })),
                // Primär: Ende von prepare (2) bis Beginn von prepare (3).
                windowInnerMs:
                  second && second.endedAt !== null && third
                    ? round(third.startedAt - second.endedAt)
                    : null,
                // Sensitivität: Beginn von prepare (2) bis Ende von prepare (3).
                windowOuterMs:
                  second && third && third.endedAt !== null
                    ? round(third.endedAt - second.startedAt)
                    : null,
                hashChanged:
                  second?.snapshotHash && third?.snapshotHash
                    ? second.snapshotHash !== third.snapshotHash
                    : null,
                completionRequests: runtime.requests.filter(
                  (request) => request.path === '/v1/chat/completions',
                ).length,
                stored: resultSummary(stored),
                host: resultSummary(host.result),
                votes: votes.map((vote) => ({
                  ...vote,
                  scheduledAt: round(vote.scheduledAt),
                  issuedAt: round(vote.issuedAt),
                  resolvedAt: round(vote.resolvedAt),
                })),
              });
            } finally {
              await runtime.close();
              vi.unstubAllEnvs();
            }
          }
          // Schlüssel `r=<Rate>`, damit JSON die Reihenfolge der Raten behält.
          rates[`r=${rate}`] = {
            ratePerSecond: rate,
            qaVotesBefore,
            qaVotesAfter: await qaVoteCount(room.sessionId),
            remainingVotersByKey: pool.remaining(),
            runs,
          };
        }
        resetQaSummaryQueueForTests();
        resetOpenWeightLlmClientForTests();

        output['m7'] = {
          note: 'Referenzfixture ohne Blitzlicht (quickFeedbackEnabled false), je Rate eine neue Session, D = 2000 ms, Umgebung wie Teil 2. Zeiten in ms relativ zum Aufruf von qa.requestSummary (origin). Stimmen: Poisson-Prozess ab Rückkehr des Auftrags (processStartedAt) bis zum gespeicherten Endstatus des Jobs, Zwischenankunftszeiten exponentiell mit Rate r, Frage gleichverteilt aus B/C/E, je Stimme eine Person ohne eigene Frage und ohne bisherige Stimme auf dieser Frage, Richtung UP, über arsnova_change_qa_vote; nacheinander (eine Stimme wartet auf die vorige). issuedAt/resolvedAt begrenzen den Commit. prepares: Queue-Hook, Aufruf 1 = Auftrag, 2 = vor, 3 = nach der Inferenz. stored = gespeicherter Endstatus des Jobs (primär, ohne erneuten Kontextaufbau); host = erster qa.summaryRuntime danach (nur berichtet).',
          rates,
        };
        testsCompleted.push('m7');
      },
    );
  },
);
