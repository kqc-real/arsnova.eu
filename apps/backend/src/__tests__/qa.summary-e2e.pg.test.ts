/**
 * Ende-zu-Ende-Nachweis der Q&A-Zusammenfassung: echter tRPC-Router
 * (`qa.summaryContextPreview`, `qa.requestSummary`, `qa.summaryRuntime`,
 * `qa.moderate`) → Queue → Kontextaufbau → Open-Weight-Client → echtes HTTP →
 * In-Prozess-Test-Runtime auf 127.0.0.1. Gegen PostgreSQL und Redis mit der
 * #456-Referenzfixture (sechs Fragen, N = 200 Teilnehmende).
 *
 * Opt-in über `RUN_PG_QA_SUMMARY_E2E_TESTS=1`; braucht `DATABASE_URL` und
 * `REDIS_URL`. Gemockt ist nur die Host-Tokenprüfung (wie in der Hash-Suite).
 * Die Test-Runtime ist kein Modell: Sie antwortet mit einer festen,
 * vertragsgültigen Ausgabe und dient nur der Fault-Injection.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  MODERATION_PROMPT_DEFINITION_SET_VERSION,
  QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION,
  QaSummaryInferenceRequestSchema,
  type QaSummaryContextPreviewDTO,
  type QaSummaryResultV2,
  type QaSummaryRuntimeV2DTO,
} from '@arsnova/shared-types';
import { canonicalModerationPromptJson } from '../lib/moderationPromptContextPacking';
import { DROPPED_UNSOURCED_QA_SUMMARY_LIMITATION } from '../lib/qaSummaryValidateV2';
import {
  QA_SUMMARY_TECHNICAL_DEFINITION_TEXT,
  QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT,
  prepareFreshModerationSummaryContext,
  projectLegacyQaSummaryRequest,
} from '../lib/moderationSummaryContext';
import { resetOpenWeightLlmClientForTests } from '../lib/openWeightLlmClient';
import {
  getQaSummaryQueueMetrics,
  getQaSummaryRuntime,
  resetQaSummaryQueueForTests,
  waitForQaSummaryIdleForTests,
} from '../lib/qaSummaryQueue';
import { prisma } from '../db';
import { getRedis } from '../redis';
import { qaRouter } from '../routers/qa';
import { quickFeedbackRouter } from '../routers/quickFeedback';
import {
  TEST_RUNTIME_LEGACY_PATH,
  TEST_RUNTIME_LEGACY_STATEMENT_TEXTS,
  TEST_RUNTIME_MODEL_VERSION,
  TEST_RUNTIME_STATEMENT_TEXTS,
  TEST_RUNTIME_TOKEN,
  closedLoopbackUrl,
  completionEnvelope,
  firstQaQuestionSourceId,
  legacySourceIdsOf,
  startTestRuntime,
  useLegacyTestRuntimeEnv,
  useTestRuntimeEnv,
  userMessageOf,
  type RecordedRuntimeRequest,
  type TestRuntime,
  type TestRuntimeOptions,
} from './lib/open-weight-test-runtime';
import {
  capturePlatformStatistic,
  changeVote,
  cleanupFixtures,
  createFixtureRegistry,
  createReferenceScenario,
  createReleasedQuiz,
  deleteFixtureRedisKeys,
  quizVote,
  restorePlatformStatistic,
  type SessionOptions,
  type PlatformStatisticSnapshot,
  type ReferenceScenario,
} from './lib/qa-summary-pg-fixture';

const RUN_PG = process.env['RUN_PG_QA_SUMMARY_E2E_TESTS'] === '1';
const HOST_TOKEN = `host-token-${randomUUID()}`;
const hostCaller = qaRouter.createCaller({ req: {} as never });
/** Obergrenze für das Warten auf einen Endstatus; der Normalfall liegt weit darunter. */
const TERMINAL_WAIT_MS = 15_000;
/**
 * Erkennungsmarke des Lua-Skripts, mit dem `loadQuickFeedbackModerationSnapshot`
 * (`apps/backend/src/lib/quickFeedbackModerationSnapshot.ts`) die Blitzlicht-Runde liest.
 */
const QUICK_FEEDBACK_READ_SCRIPT_MARKER = 'QUICK_FEEDBACK_READ_MODERATION_SNAPSHOT';
/** Meldung von `assertModerationStateStillCurrent` (`moderationQaContext.ts`). */
const MODERATION_STATE_CONFLICT_MESSAGE =
  'Der autorisierte Q&A-Kontext hat sich während des Aufbaus geändert.';
/** Packing-Cache-TTL (`MODERATION_PROMPT_PACKING_CACHE_TTL_MS` = 30 s) plus Abstand. */
const PACKING_CACHE_EXPIRY_STEP_MS = 31_000;

/**
 * Oberste Schlüssel des Bodys, wie `buildChatCompletionBody` in
 * `apps/backend/src/lib/openWeightLlmClient.ts` sie für `qa_summary` V2 setzt.
 */
const CHAT_COMPLETION_TOP_LEVEL_KEYS = [
  'chat_template_kwargs',
  'max_tokens',
  'messages',
  'model',
  'reasoning_effort',
  'response_format',
  'stream',
  'temperature',
] as const;

type ChatMessage = { readonly role: string; readonly content: string };

function asV2Runtime(value: unknown): QaSummaryRuntimeV2DTO {
  const runtime = value as QaSummaryRuntimeV2DTO;
  if (runtime.schemaVersion !== 2) throw new Error('summary runtime is not V2');
  return runtime;
}

function completionRequests(runtime: TestRuntime): RecordedRuntimeRequest[] {
  return runtime.requests.filter(
    (request) => request.method === 'POST' && request.path === '/v1/chat/completions',
  );
}

/** Erste abweichende Byteposition (UTF-8) mit kurzem Ausschnitt, sonst `null`. */
function firstByteDifference(actual: string, expected: string): string | null {
  const a = Buffer.from(actual, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.equals(b)) return null;
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
  const excerpt = (buffer: Buffer) =>
    buffer.subarray(Math.max(0, index - 40), index + 60).toString('utf8');
  return `Byte ${index} (Länge ${a.length} statt ${b.length}): gesendet …${excerpt(a)}… erwartet …${excerpt(b)}…`;
}

/** Bricht mit klarer Meldung ab, statt auf den globalen Test-Timeout zu warten. */
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Kein Aussagetext und keine Modellversion der Test-Runtime im Ergebnis. */
function expectNoRuntimeStatement(result: QaSummaryResultV2, runtimeTexts: readonly string[]) {
  const texts = [...result.statements, ...result.suggestedNextSteps].map((item) => item.text);
  for (const runtimeText of runtimeTexts) expect(texts).not.toContain(runtimeText);
  expect(result.modelVersion).not.toBe(TEST_RUNTIME_MODEL_VERSION);
}

function messagesOf(rawBody: string): ChatMessage[] {
  return (JSON.parse(rawBody) as { messages: ChatMessage[] }).messages;
}

type PackedPromptContext = QaSummaryContextPreviewDTO['promptContext']['context'];

/** Ende des Zeitfensters der Blitzlicht-Quelle im gepackten Kontext, sonst `null`. */
function feedbackWindowEnd(context: PackedPromptContext): string | null {
  for (const source of context.sources) {
    if (source.kind === 'feedback-aggregate' && source.scope.timeWindow.kind === 'interval') {
      return source.scope.timeWindow.to;
    }
  }
  return null;
}

/** Gepackter Kontext ohne `meta.sourceRevision` und ohne Ende des Blitzlicht-Zeitfensters. */
function withoutBuildTimeFields(context: PackedPromptContext) {
  const { sourceRevision: _sourceRevision, ...meta } = context.meta;
  return {
    ...context,
    meta,
    sources: context.sources.map((source) =>
      source.kind === 'feedback-aggregate' && source.scope.timeWindow.kind === 'interval'
        ? {
            ...source,
            scope: { ...source.scope, timeWindow: { ...source.scope.timeWindow, to: null } },
          }
        : source,
    ),
  };
}

/**
 * Der Aufbau der Referenzfixture (200 Teilnehmende, 282 Stimmen über
 * `arsnova_change_qa_vote`) dauert lokal einige Sekunden je Test.
 */
const TEST_TIMEOUT_MS = 60_000;

describe.skipIf(!RUN_PG)(
  'Q&A summary end to end through the runtime (PostgreSQL + Redis)',
  { timeout: TEST_TIMEOUT_MS },
  () => {
    const registry = createFixtureRegistry();
    const runtimes: TestRuntime[] = [];
    let platformBefore: PlatformStatisticSnapshot | null = null;

    async function scenario(
      session?: Omit<SessionOptions, 'registry'>,
    ): Promise<ReferenceScenario> {
      if (!platformBefore) platformBefore = await capturePlatformStatistic();
      return createReferenceScenario({ registry, session });
    }

    async function legacyRuntimeWith(options: TestRuntimeOptions = {}): Promise<TestRuntime> {
      const runtime = await startTestRuntime(options);
      runtimes.push(runtime);
      useLegacyTestRuntimeEnv(runtime);
      return runtime;
    }

    function legacyRequests(runtime: TestRuntime): RecordedRuntimeRequest[] {
      return runtime.requests.filter(
        (request) => request.method === 'POST' && request.path === TEST_RUNTIME_LEGACY_PATH,
      );
    }

    async function runtimeWith(
      options: TestRuntimeOptions = {},
      env: Readonly<Record<string, string>> = {},
    ): Promise<TestRuntime> {
      const runtime = await startTestRuntime(options);
      runtimes.push(runtime);
      useTestRuntimeEnv(runtime, env);
      return runtime;
    }

    async function preview(sessionId: string): Promise<QaSummaryContextPreviewDTO> {
      return hostCaller.summaryContextPreview({ sessionId, locale: 'de' });
    }

    async function requestSummary(sessionId: string): Promise<QaSummaryRuntimeV2DTO> {
      return asV2Runtime(await hostCaller.requestSummary({ sessionId, locale: 'de' }));
    }

    /** Fragt `qa.summaryRuntime` ab, bis der Status nicht mehr `pending` ist (begrenzt). */
    async function waitForTerminal(sessionId: string): Promise<QaSummaryRuntimeV2DTO> {
      const started = performance.now();
      for (;;) {
        const runtime = asV2Runtime(await hostCaller.summaryRuntime({ sessionId }));
        if (runtime.result && runtime.result.status !== 'pending') return runtime;
        if (performance.now() - started > TERMINAL_WAIT_MS) {
          throw new Error(
            `summaryRuntime blieb ${TERMINAL_WAIT_MS} ms lang ${runtime.result?.status ?? 'leer'}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }

    /**
     * Wartet ohne Kontextaufbau auf das Ende des Jobs und liefert den gespeicherten
     * Queue-Zustand (`getQaSummaryRuntime`), bevor der Lesepfad ihn korrigieren kann.
     */
    async function waitForStoredJobResult(sessionId: string): Promise<QaSummaryResultV2> {
      const started = performance.now();
      for (;;) {
        const stored = (await getQaSummaryRuntime(sessionId)).result;
        if (stored && stored.status !== 'pending') {
          await waitForQaSummaryIdleForTests(TERMINAL_WAIT_MS);
          return (await getQaSummaryRuntime(sessionId)).result!;
        }
        if (performance.now() - started > TERMINAL_WAIT_MS) {
          throw new Error(`Job blieb ${TERMINAL_WAIT_MS} ms lang ${stored?.status ?? 'leer'}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    /** K (1)–(4) des Falls „Vorschau = Nutzlast“ auf dem rohen Runtime-Body. */
    function expectPayloadEqualsPreview(
      runtime: TestRuntime,
      shown: QaSummaryContextPreviewDTO,
      final: QaSummaryRuntimeV2DTO,
    ): void {
      const completions = completionRequests(runtime);
      expect(completions).toHaveLength(1);
      const rawBody = completions[0]!.rawBody;
      expect(completions[0]!.headers['authorization']).toBe(`Bearer ${TEST_RUNTIME_TOKEN}`);

      // (1) Gleicher Revisionsstand.
      expect(final.result!.snapshotHash).toBe(shown.promptContext.snapshotHash);

      // (2) User-Nachricht bytegleich mit dem kanonischen Kontext der Vorschau.
      const expectedUser = canonicalModerationPromptJson(shown.promptContext.context);
      const messages = messagesOf(rawBody);
      expect(messages.map((message) => message.role)).toEqual(['system', 'system', 'user']);
      expect(firstByteDifference(userMessageOf(rawBody), expectedUser)).toBeNull();
      // Auch auf Ebene der rohen Bytes: der JSON-kodierte Kontext steht so im Body.
      expect(rawBody).toContain(JSON.stringify(expectedUser));

      // (3) System-Nachrichten = Instruktion und Definition der von der Vorschau genannten Versionen.
      expect(shown.instructionVersion).toBe(QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION);
      expect(shown.definitionVersion).toBe(MODERATION_PROMPT_DEFINITION_SET_VERSION);
      expect(messages[0]!.content).toBe(QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT);
      expect(messages[1]!.content).toBe(QA_SUMMARY_TECHNICAL_DEFINITION_TEXT);
      expect(messages[1]!.content).toContain(shown.definitionVersion);

      // (4) ready, full-context, beide Aussagen an dieselbe gepackte Q&A-Quelle gebunden.
      const result = final.result!;
      expect(result.status).toBe('ready');
      expect(result.execution).toEqual({
        attemptedMode: 'full-context',
        effectiveMode: 'full-context',
        fallback: null,
      });
      expect(result.statements.map((statement) => statement.text)).toEqual([
        ...TEST_RUNTIME_STATEMENT_TEXTS,
      ]);
      const [citedId] = result.statements[0]!.sourceIds;
      expect(result.statements[1]!.sourceIds).toEqual([citedId]);
      const packedSource = shown.promptContext.context.sources.find(
        (source) => source.id === citedId,
      );
      expect(packedSource).toMatchObject({ kind: 'qa-question', content: { state: 'included' } });
      expect(result.sources.map((source) => source.id)).toEqual([citedId]);
    }

    /**
     * Durchreichender Wrapper um `eval` des Redis-Singletons (Systemgrenze). Er reagiert
     * nur auf den Blitzlicht-Lesezugriff des Lehrsignal-Aufbaus dieser Session
     * (`loadQuickFeedbackModerationSnapshot`), nur solange `armed` gilt und nur einmal:
     * Dann läuft `onSeam`, danach die echte Redis-Operation mit unveränderten Argumenten.
     * Ihr Ergebnis geht unverändert zurück; der Wrapper ändert kein Ergebnis.
     */
    function wrapQuickFeedbackRead(sessionCode: string, onSeam: () => Promise<void>) {
      const redis = getRedis();
      const originalEval = redis.eval.bind(redis) as (...args: unknown[]) => Promise<unknown>;
      const seam = { armed: false, hits: 0 };
      const spy = vi.spyOn(redis, 'eval').mockImplementation((async (...args: unknown[]) => {
        if (
          seam.armed &&
          typeof args[0] === 'string' &&
          args[0].includes(QUICK_FEEDBACK_READ_SCRIPT_MARKER) &&
          args[2] === `qf:${sessionCode.toUpperCase()}`
        ) {
          seam.armed = false;
          seam.hits += 1;
          await onSeam();
        }
        return originalEval(...args);
      }) as never);
      return { seam, restore: () => spy.mockRestore() };
    }

    /** Startet über den echten Router eine session-gebundene Blitzlicht-Runde ohne Stimmen. */
    async function startQuickFeedbackRound(sessionCode: string, type: 'YESNO' | 'TEMPO') {
      await quickFeedbackRouter.createCaller({}).create({ type, sessionCode });
    }

    /** Datenstand, den ein Kontextaufbau liest: Session-Zeile, Blitzlicht-Runde, Q&A-Stimmen. */
    async function dataState(room: ReferenceScenario) {
      return {
        session: await prisma.session.findUniqueOrThrow({ where: { id: room.sessionId } }),
        quickFeedback: await getRedis().get(`qf:${room.code}`),
        qaUpvotes: await prisma.qaUpvote.count({
          where: { qaQuestion: { sessionId: room.sessionId } },
        }),
      };
    }

    beforeEach(async () => {
      vi.clearAllMocks();
      hostAuthMocks.extractHostTokenMock.mockReturnValue(HOST_TOKEN);
      hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
      hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
      resetQaSummaryQueueForTests();
      resetOpenWeightLlmClientForTests();
      await deleteFixtureRedisKeys(registry);
    });

    afterEach(async () => {
      try {
        await waitForQaSummaryIdleForTests(TERMINAL_WAIT_MS);
      } finally {
        resetQaSummaryQueueForTests();
        resetOpenWeightLlmClientForTests();
        await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
        vi.unstubAllEnvs();
      }
    });

    afterAll(async () => {
      if (!platformBefore) return;
      await cleanupFixtures(registry);
      await restorePlatformStatistic(platformBefore);
    });

    it('sendet genau den fachlichen Kontext der Host-Vorschau an die Runtime und liefert eine gebundene Modellaussage', async () => {
      const room = await scenario();
      const runtime = await runtimeWith();

      const shown = await preview(room.sessionId);
      expect(shown.selectedMode).toBe('full-context');

      const requested = await requestSummary(room.sessionId);
      expect(requested.result?.status).toBe('pending');
      const final = await waitForTerminal(room.sessionId);

      expectPayloadEqualsPreview(runtime, shown, final);
    });

    it('sendet auch nach abgelaufenem Packing-Cache genau den fachlichen Kontext der Host-Vorschau, obwohl jeder Kontextaufbau neu packt', async () => {
      const room = await scenario();
      const runtime = await runtimeWith();
      const cacheStates: string[] = [];
      // Ohne diesen Schritt stammen Vorschau und Nutzlast aus demselben Eintrag des
      // Packing-Caches (TTL 30 s). Hier wird nur `Date` vor jedem Kontextaufbau über
      // die TTL hinaus verschoben; Timer, `setImmediate`, `AbortSignal` und
      // `performance.now()` bleiben echt. Der Hook ruft die echte Funktion unverändert auf.
      vi.useFakeTimers({ toFake: ['Date'], now: Date.now() });
      try {
        resetQaSummaryQueueForTests({
          prepare: async (input) => {
            vi.setSystemTime(Date.now() + PACKING_CACHE_EXPIRY_STEP_MS);
            const prepared = await prepareFreshModerationSummaryContext(input);
            cacheStates.push(prepared.preview.cache);
            return prepared;
          },
        });

        const shown = await preview(room.sessionId);
        expect(shown.cache).toBe('miss');
        expect(shown.selectedMode).toBe('full-context');

        const requested = await requestSummary(room.sessionId);
        expect(requested.result?.status).toBe('pending');
        const final = await waitForTerminal(room.sessionId);

        // Vorschau, Auftrag, Job vor und nach der Inferenz, erster Lesepfad-Abruf:
        // jeder Aufbau hat neu gepackt.
        expect(cacheStates).toEqual(['miss', 'miss', 'miss', 'miss', 'miss']);
        expectPayloadEqualsPreview(runtime, shown, final);
      } finally {
        vi.useRealTimers();
      }
    });

    it('lässt Host-Token, Sitzungs- und Teilnehmendenkennungen sowie Hüllenfelder nicht in den Runtime-Body', async () => {
      const room = await scenario();
      const runtime = await runtimeWith();

      const shown = await preview(room.sessionId);
      await requestSummary(room.sessionId);
      const final = await waitForTerminal(room.sessionId);
      expect(final.result!.status).toBe('ready');
      expect(final.result!.execution).toMatchObject({
        effectiveMode: 'full-context',
        fallback: null,
      });

      const completions = completionRequests(runtime);
      expect(completions).toHaveLength(1);
      const rawBody = completions[0]!.rawBody;

      expect(rawBody).not.toContain(HOST_TOKEN);
      expect(rawBody).not.toContain(room.sessionId);
      expect(rawBody).not.toContain(room.code);
      for (const participant of room.participants) {
        expect(rawBody).not.toContain(participant.id);
      }
      const nicknames = await prisma.participant.findMany({
        where: { sessionId: room.sessionId },
        select: { nickname: true },
      });
      expect(nicknames).toHaveLength(room.participants.length);
      for (const { nickname } of nicknames) {
        expect(rawBody).not.toContain(nickname);
      }
      expect(rawBody).not.toContain(shown.promptContext.snapshotHash);
      expect(rawBody).not.toContain(shown.promptContext.packedAt);
      expect(rawBody).not.toContain('"snapshotHash"');
      expect(rawBody).not.toContain('"packedAt"');
      expect(rawBody).not.toContain('"budget"');
      expect(rawBody).not.toContain(JSON.stringify(shown.promptContext.budget));

      expect(rawBody).toContain('moderation-domain-context-v1');
      expect(Object.keys(JSON.parse(rawBody) as Record<string, unknown>).sort()).toEqual([
        ...CHAT_COMPLETION_TOP_LEVEL_KEYS,
      ]);
    });

    it('sendet nach einer Stimme zwischen Vorschau und Auftrag den neuen Stand statt der Vorschau', async () => {
      const room = await scenario();
      const runtime = await runtimeWith();

      const shown = await preview(room.sessionId);
      // Frage C ist PINNED und damit abstimmbar; der letzte Teilnehmende hat noch nicht abgestimmt.
      await changeVote(room.questionIdsByKey.C, room.participants.at(-1)!.id, 'UP');
      await requestSummary(room.sessionId);
      const final = await waitForTerminal(room.sessionId);
      expect(final.result!.status).toBe('ready');
      expect(final.result!.execution).toMatchObject({
        effectiveMode: 'full-context',
        fallback: null,
      });

      const completions = completionRequests(runtime);
      expect(completions).toHaveLength(1);
      const sentUser = userMessageOf(completions[0]!.rawBody);

      // (1) Hash der Vorschau ≠ Hash des Ergebnisses.
      expect(final.result!.snapshotHash).not.toBe(shown.promptContext.snapshotHash);
      // (2) User-Nachricht ≠ Kontext der Vorschau.
      expect(sentUser).not.toBe(canonicalModerationPromptJson(shown.promptContext.context));
      // (3) User-Nachricht = Kontext einer frischen Vorschau nach der Stimme.
      const fresh = await preview(room.sessionId);
      expect(sentUser).toBe(canonicalModerationPromptJson(fresh.promptContext.context));
      expect(final.result!.snapshotHash).toBe(fresh.promptContext.snapshotHash);
    });

    it('übernimmt keine Modellantwort mit fremder Ausgabe-Version und fällt mit invalid_response zurück', async () => {
      const room = await scenario();
      const foreignText = 'Aussage einer fremden Ausgabe-Version.';
      const runtime = await runtimeWith({
        // Gekennzeichnete Negativprobe: sonst gültige Ausgabe der Version 1
        // (`result` statt `output`), deren Quelle aus der V2-Anfrage stammt.
        respond: (body) => ({
          status: 200,
          body: completionEnvelope(
            JSON.stringify({
              schemaVersion: 1,
              taskType: 'qa_summary',
              result: {
                status: 'ready',
                statements: [{ text: foreignText, sourceIds: [firstQaQuestionSourceId(body)] }],
                suggestedNextSteps: [],
                limitations: [],
                modelVersion: TEST_RUNTIME_MODEL_VERSION,
              },
            }),
          ),
        }),
      });

      const requested = await requestSummary(room.sessionId);
      expect(requested.result?.status).toBe('pending');
      const final = await waitForTerminal(room.sessionId);

      expect(completionRequests(runtime)).toHaveLength(1);
      const result = final.result!;
      // „Regelbasiert“ heißt im Code: deterministischer extraktiver Fallback ohne Modell.
      expect(result.execution).toMatchObject({
        attemptedMode: 'full-context',
        effectiveMode: 'extractive',
        fallback: { mode: 'extractive', reason: 'invalid_response' },
      });
      expectNoRuntimeStatement(result, [foreignText, ...TEST_RUNTIME_STATEMENT_TEXTS]);
      // Queue danach frei.
      await waitForQaSummaryIdleForTests(TERMINAL_WAIT_MS);
      expect(getQaSummaryQueueMetrics()).toMatchObject({ queueLength: 0, running: 0, failed: 0 });
    });

    it('lässt den Host nicht auf die Runtime warten: requestSummary kehrt pending zurück, solange die Runtime die Antwort hält', async () => {
      const room = await scenario();
      let release: () => void = () => undefined;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      const runtime = await runtimeWith({ hold });

      try {
        // Ein synchroner Job würde hier bis zur Runtime-Antwort blockieren; die kommt
        // erst nach dem Lösen des Latches unten. Deshalb begrenzt warten.
        const requested = await withTimeout(
          requestSummary(room.sessionId),
          5_000,
          'requestSummary kehrte nicht zurück, solange die Runtime die Antwort hielt',
        );
        await withTimeout(
          runtime.received,
          5_000,
          'Runtime hat den Completion-Request nicht empfangen',
        );

        // (1) Mutation aufgelöst und pending, Request empfangen, Latch offen.
        expect(requested.result?.status).toBe('pending');
        expect(completionRequests(runtime)).toHaveLength(1);
        // (2) summaryRuntime meldet weiter pending. Der Latch ist hier noch offen:
        // `release` wird erst im `finally` unten aufgerufen.
        const during = asV2Runtime(await hostCaller.summaryRuntime({ sessionId: room.sessionId }));
        expect(during.result?.status).toBe('pending');
      } finally {
        release();
      }

      // (3) Nach dem Lösen wird ready erreicht.
      const final = await waitForTerminal(room.sessionId);
      expect(final.result!.status).toBe('ready');
      expect(final.result!.execution.effectiveMode).toBe('full-context');
    });

    it('meldet bei nicht erreichbarer Runtime erst pending und dann einen Fallback mit Grund unavailable', async () => {
      const room = await scenario();
      useTestRuntimeEnv({ baseUrl: await closedLoopbackUrl() });

      const requested = await requestSummary(room.sessionId);
      expect(requested.result?.status).toBe('pending');
      const final = await waitForTerminal(room.sessionId);

      expect(final.result!.execution).toMatchObject({
        attemptedMode: 'full-context',
        effectiveMode: 'extractive',
        fallback: { mode: 'extractive', reason: 'unavailable' },
      });
      expectNoRuntimeStatement(final.result!, TEST_RUNTIME_STATEMENT_TEXTS);
    });

    it('bricht eine zu langsame Runtime nach dem Client-Timeout ab und meldet den Grund timeout', async () => {
      const room = await scenario();
      // Client-Timeout 1 s (kleinster erlaubter Wert). Das Queue-Wall-Clock ist laut
      // `resolveEffectiveQaSummaryTimeoutMs` (qaSummaryConfig.ts) max(QA_SUMMARY_TIMEOUT_MS,
      // OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS) = max(90 000, 1 000) = 90 000 ms. Es greift
      // also der Client-Timeout (`classifyCaughtError` → `timeout`), nicht die Queue.
      const timeoutMs = 1_000;
      const runtime = await runtimeWith(
        { delayMs: 2_500 },
        { OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: String(timeoutMs) },
      );

      const started = performance.now();
      const requested = await requestSummary(room.sessionId);
      expect(requested.result?.status).toBe('pending');
      const final = await waitForTerminal(room.sessionId);
      const totalMs = performance.now() - started;

      expect(completionRequests(runtime)).toHaveLength(1);
      expect(final.result!.execution).toMatchObject({
        attemptedMode: 'full-context',
        effectiveMode: 'extractive',
        fallback: { mode: 'extractive', reason: 'timeout' },
      });
      expectNoRuntimeStatement(final.result!, TEST_RUNTIME_STATEMENT_TEXTS);
      // Der Queue-Timeout hat nicht gegriffen.
      expect(getQaSummaryQueueMetrics().timeouts).toBe(0);
      expect(totalMs).toBeLessThan(timeoutMs + 2_000);
    });

    it('verwirft die Modellaussage als source_changed, wenn sich während der Inferenz eine Stimme ändert', async () => {
      const room = await scenario();
      const runtime = await runtimeWith({
        // Während des Runtime-Aufrufs, vor der Antwort: echte Stimme über die DB-Funktion.
        beforeRespond: async () => {
          await changeVote(room.questionIdsByKey.C, room.participants.at(-1)!.id, 'UP');
        },
      });

      await requestSummary(room.sessionId);
      // Erst der gespeicherte Job-Zustand (ohne erneuten Kontextaufbau), dann der Host-Pfad,
      // der ein veraltetes Ergebnis beim Lesen selbst korrigieren könnte.
      const stored = await waitForStoredJobResult(room.sessionId);
      const final = await waitForTerminal(room.sessionId);
      const fresh = await preview(room.sessionId);

      // Job-Ebene: an prepare (3) gebunden.
      expect(stored.execution).toMatchObject({
        attemptedMode: 'full-context',
        effectiveMode: 'extractive',
        fallback: { reason: 'source_changed' },
      });
      expectNoRuntimeStatement(stored, TEST_RUNTIME_STATEMENT_TEXTS);
      expect(stored.snapshotHash).toBe(fresh.promptContext.snapshotHash);

      const completions = completionRequests(runtime);
      expect(completions).toHaveLength(1);
      // Gesendet wurde der Stand vor der Stimme.
      expect(userMessageOf(completions[0]!.rawBody)).not.toBe(
        canonicalModerationPromptJson(fresh.promptContext.context),
      );

      const result = final.result!;
      expect(result.execution).toMatchObject({
        attemptedMode: 'full-context',
        effectiveMode: 'extractive',
        fallback: { reason: 'source_changed' },
      });
      expectNoRuntimeStatement(result, TEST_RUNTIME_STATEMENT_TEXTS);
      expect(result.snapshotHash).toBe(fresh.promptContext.snapshotHash);
    });

    it('verwirft die Modellaussage als source_changed und entfernt die Quelle, wenn der Host die zitierte Frage während der Inferenz löscht', async () => {
      const room = await scenario();
      let deleted: { sourceId: string; questionId: string; text: string } | null = null;
      const runtime = await runtimeWith({
        // Löscht genau die Frage, die die Antwort der Runtime zitiert.
        beforeRespond: async (body) => {
          const sourceId = firstQaQuestionSourceId(body);
          const questionId = sourceId.slice('qa-question:'.length);
          const { text } = await prisma.qaQuestion.findUniqueOrThrow({
            where: { id: questionId },
            select: { text: true },
          });
          deleted = { sourceId, questionId, text };
          await hostCaller.moderate({ sessionCode: room.code, questionId, action: 'DELETE' });
        },
      });

      await requestSummary(room.sessionId);
      // Erst der gespeicherte Job-Zustand (ohne erneuten Kontextaufbau), dann der Host-Pfad.
      const stored = await waitForStoredJobResult(room.sessionId);
      const final = await waitForTerminal(room.sessionId);
      const fresh = await preview(room.sessionId);

      expect(completionRequests(runtime)).toHaveLength(1);
      expect(deleted).not.toBeNull();
      const { sourceId: deletedId, questionId, text: deletedText } = deleted!;
      // qa.moderate DELETE entfernt die Frage physisch.
      await expect(prisma.qaQuestion.count({ where: { id: questionId } })).resolves.toBe(0);

      const expectWithoutDeletedSource = (result: QaSummaryResultV2) => {
        expect(result.execution).toMatchObject({
          attemptedMode: 'full-context',
          effectiveMode: 'extractive',
          fallback: { reason: 'source_changed' },
        });
        expectNoRuntimeStatement(result, TEST_RUNTIME_STATEMENT_TEXTS);
        expect(result.sources.map((source) => source.id)).not.toContain(deletedId);
        for (const statement of [...result.statements, ...result.suggestedNextSteps]) {
          expect(statement.sourceIds).not.toContain(deletedId);
          expect(statement.text).not.toContain(deletedText);
        }
        expect(JSON.stringify(result)).not.toContain(deletedId);
        expect(JSON.stringify(result)).not.toContain(deletedText);
      };
      // Job-Ebene: an prepare (3) gebunden.
      expectWithoutDeletedSource(stored);
      expect(stored.snapshotHash).toBe(fresh.promptContext.snapshotHash);
      // Host-Pfad.
      expectWithoutDeletedSource(final.result!);
    });

    it('Kontrolle: bleibt bei einer Quizstimme auf eine laufende Frage während der Inferenz ready', async () => {
      const quiz = await createReleasedQuiz(registry);
      const room = await scenario(quiz.sessionOptions);
      const runtime = await runtimeWith({
        beforeRespond: async () => {
          await quizVote({
            sessionId: room.sessionId,
            participantId: room.participants[0]!.id,
            question: quiz.running,
          });
        },
      });

      await requestSummary(room.sessionId);
      const final = await waitForTerminal(room.sessionId);

      expect(completionRequests(runtime)).toHaveLength(1);
      // Die Quizstimme ist tatsächlich während der Inferenz gespeichert worden.
      await expect(
        prisma.vote.count({ where: { sessionId: room.sessionId, questionId: quiz.running.id } }),
      ).resolves.toBe(1);
      expect(final.result!.status).toBe('ready');
      expect(final.result!.execution).toEqual({
        attemptedMode: 'full-context',
        effectiveMode: 'full-context',
        fallback: null,
      });
      expect(final.result!.statements.map((statement) => statement.text)).toEqual([
        ...TEST_RUNTIME_STATEMENT_TEXTS,
      ]);
    });

    it('meldet bei belegtem Inferenz-Slot erst pending und dann einen Fallback mit Grund busy, ohne die Completion aufzurufen', async () => {
      const room = await scenario();
      const runtime = await runtimeWith({ slotsStatus: 503 });

      const requested = await requestSummary(room.sessionId);
      expect(requested.result?.status).toBe('pending');
      const final = await waitForTerminal(room.sessionId);

      expect(final.result!.execution).toMatchObject({
        attemptedMode: 'full-context',
        effectiveMode: 'extractive',
        fallback: { mode: 'extractive', reason: 'busy' },
      });
      expectNoRuntimeStatement(final.result!, TEST_RUNTIME_STATEMENT_TEXTS);
      // Die Runtime hat nur die Slot-Abfrage gesehen, keinen POST.
      expect(runtime.requests.map((request) => `${request.method} ${request.path}`)).toEqual([
        'GET /slots?fail_on_no_slot=1',
      ]);
      expect(completionRequests(runtime)).toHaveLength(0);
    });

    it('weist bei voller Queue einen dritten Auftrag sofort mit queue_full ab und arbeitet die beiden angenommenen Aufträge danach normal ab', async () => {
      const rooms = [await scenario(), await scenario(), await scenario()] as const;
      let release: () => void = () => undefined;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      // Die Grenze in `requestQaSummary` zählt laufende und wartende Jobs
      // (`queue.length + running >= queueLimit`). Ein laufender und ein wartender Job
      // brauchen deshalb QA_SUMMARY_QUEUE_LIMIT=2 (siehe Protokoll, Abweichungen).
      const runtime = await runtimeWith(
        { hold },
        { QA_SUMMARY_QUEUE_LIMIT: '2', QA_SUMMARY_CONCURRENCY: '1' },
      );
      // Zählt Kontextaufbauten je Session; ruft die echte Funktion unverändert auf.
      const prepares = new Map<string, number>();
      resetQaSummaryQueueForTests({
        prepare: async (input) => {
          prepares.set(input.sessionId, (prepares.get(input.sessionId) ?? 0) + 1);
          return prepareFreshModerationSummaryContext(input);
        },
      });

      let third: QaSummaryRuntimeV2DTO;
      try {
        // Job 1 läuft und hängt in der Runtime.
        const first = await requestSummary(rooms[0].sessionId);
        expect(first.result?.status).toBe('pending');
        await withTimeout(runtime.received, 5_000, 'Job 1 hat die Runtime nicht erreicht');
        // Job 2 wartet in der Queue.
        const second = await requestSummary(rooms[1].sessionId);
        expect(second.result?.status).toBe('pending');
        expect(getQaSummaryQueueMetrics()).toMatchObject({ queueLength: 1, running: 1 });

        // Job 3: sofortiges Ergebnis, während Job 1 noch hängt.
        third = await withTimeout(
          requestSummary(rooms[2].sessionId),
          5_000,
          'requestSummary für Job 3 kehrte bei voller Queue nicht zurück',
        );
        expect(completionRequests(runtime)).toHaveLength(1);
        expect(getQaSummaryQueueMetrics()).toMatchObject({
          queueLength: 1,
          running: 1,
          queueRejected: 1,
        });
      } finally {
        release();
      }

      // (1) Job 3 endet sofort mit queue_full, ohne Job: nur der Kontextaufbau des Auftrags selbst.
      expect(third.result?.status).not.toBe('pending');
      expect(third.result?.execution).toMatchObject({
        attemptedMode: 'full-context',
        effectiveMode: 'extractive',
        fallback: { mode: 'extractive', reason: 'queue_full' },
      });
      expectNoRuntimeStatement(third.result!, TEST_RUNTIME_STATEMENT_TEXTS);

      // (3) Jobs 1 und 2 enden ready über die Runtime.
      for (const room of rooms.slice(0, 2)) {
        const final = await waitForTerminal(room.sessionId);
        expect(final.result!.status).toBe('ready');
        expect(final.result!.execution).toEqual({
          attemptedMode: 'full-context',
          effectiveMode: 'full-context',
          fallback: null,
        });
      }
      await waitForQaSummaryIdleForTests(TERMINAL_WAIT_MS);

      // (2) Genau zwei POSTs, je einer für Job 1 und Job 2, in dieser Reihenfolge.
      const completions = completionRequests(runtime);
      expect(completions).toHaveLength(2);
      const sentQuestionIds = completions.map((request) =>
        firstQaQuestionSourceId(request.rawBody).slice('qa-question:'.length),
      );
      const owner = await prisma.qaQuestion.findMany({
        where: { id: { in: sentQuestionIds } },
        select: { id: true, sessionId: true },
      });
      expect(sentQuestionIds.map((id) => owner.find((row) => row.id === id)?.sessionId)).toEqual([
        rooms[0].sessionId,
        rooms[1].sessionId,
      ]);

      // Danach ist nichts liegen geblieben, und für Session 3 lief kein Job-Kontextaufbau.
      expect(getQaSummaryQueueMetrics()).toMatchObject({ queueLength: 0, running: 0 });
      expect(prepares.get(rooms[2].sessionId)).toBe(1);
      expect(
        (await getQaSummaryRuntime(rooms[2].sessionId)).result?.execution.fallback?.reason,
      ).toBe('queue_full');
    }, 120_000);

    it('lehnt den Auftrag mit CONFLICT ab und legt keinen Job an, wenn während des Kontextaufbaus eine Q&A-Stimme eingeht', async () => {
      const room = await scenario({ quickFeedbackEnabled: true });
      const runtime = await runtimeWith();
      // Frage C ist PINNED und damit abstimmbar; der letzte Teilnehmende hat noch nicht abgestimmt.
      const questionId = room.questionIdsByKey.C;
      const voterId = room.participants.at(-1)!.id;
      const { seam, restore } = wrapQuickFeedbackRead(room.code, () =>
        changeVote(questionId, voterId, 'UP'),
      );

      try {
        seam.armed = true;
        await expect(requestSummary(room.sessionId)).rejects.toMatchObject({
          code: 'CONFLICT',
          message: MODERATION_STATE_CONFLICT_MESSAGE,
        });
      } finally {
        seam.armed = false;
        restore();
      }

      // Die Stimme ist genau einmal während des Aufbaus über die DB-Funktion gespeichert worden.
      expect(seam.hits).toBe(1);
      await expect(
        prisma.qaUpvote.count({ where: { qaQuestionId: questionId, participantId: voterId } }),
      ).resolves.toBe(1);
      // Kein Job, keine Runtime-Anfrage, summaryRuntime ohne laufenden Job.
      expect(getQaSummaryQueueMetrics()).toMatchObject({ queueLength: 0, running: 0 });
      const after = asV2Runtime(await hostCaller.summaryRuntime({ sessionId: room.sessionId }));
      expect(after.result).toBeNull();
      await waitForQaSummaryIdleForTests(TERMINAL_WAIT_MS);
      expect(runtime.requests).toHaveLength(0);
    });

    it('Kontrolle: nimmt den Auftrag ohne Stimme im selben Kontextaufbau an und meldet pending', async () => {
      const room = await scenario({ quickFeedbackEnabled: true });
      const runtime = await runtimeWith();
      // Gleicher Wrapper an derselben Stelle, aber ohne Stimme.
      const { seam, restore } = wrapQuickFeedbackRead(room.code, async () => undefined);

      let requested: QaSummaryRuntimeV2DTO;
      try {
        seam.armed = true;
        requested = await requestSummary(room.sessionId);
      } finally {
        seam.armed = false;
        restore();
      }

      expect(seam.hits).toBe(1);
      expect(requested.result?.status).toBe('pending');
      const final = await waitForTerminal(room.sessionId);
      expect(final.result!.status).toBe('ready');
      expect(completionRequests(runtime)).toHaveLength(1);
    });

    it('nutzt bei abgeschaltetem Open-Weight-Pfad den Legacy-Text-Vertrag und bindet die Aussage an eine gepackte Quelle', async () => {
      const room = await scenario();
      const runtime = await legacyRuntimeWith();

      const shown = await preview(room.sessionId);
      expect(shown.selectedMode).toBe('legacy-text');
      const requested = await requestSummary(room.sessionId);
      expect(requested.result?.status).toBe('pending');
      const final = await waitForTerminal(room.sessionId);

      // Der Legacy-Vertrag ging raus: genau ein POST auf den Legacy-Endpunkt, kein
      // Open-Weight-Aufruf, Body bytegleich der Legacy-Projektion des Vorschaukontexts.
      expect(runtime.requests.map((request) => `${request.method} ${request.path}`)).toEqual([
        `POST ${TEST_RUNTIME_LEGACY_PATH}`,
      ]);
      const [sent] = legacyRequests(runtime);
      expect(sent!.headers['authorization']).toBe(`Bearer ${TEST_RUNTIME_TOKEN}`);
      expect(sent!.headers['content-type']).toBe('application/json');
      expect(final.result!.snapshotHash).toBe(shown.promptContext.snapshotHash);
      expect(
        firstByteDifference(
          sent!.rawBody,
          JSON.stringify(projectLegacyQaSummaryRequest(shown.promptContext)),
        ),
      ).toBeNull();
      // Der rohe Body erfüllt den Legacy-Vertrag; das Schema entfernt dabei kein Feld.
      const legacyBody: unknown = JSON.parse(sent!.rawBody);
      const parsedLegacy = QaSummaryInferenceRequestSchema.parse(legacyBody);
      expect(parsedLegacy).toEqual(legacyBody);
      expect(parsedLegacy.snapshotHash).toBe(shown.promptContext.snapshotHash);

      // Modus und Status wie H.
      const result = final.result!;
      expect(result.status).toBe('ready');
      expect(result.execution).toMatchObject({
        attemptedMode: 'legacy-text',
        effectiveMode: 'legacy-text',
        fallback: { mode: 'legacy-text', reason: 'adapter_incompatible' },
      });
      expect(result.modelVersion).toBe(TEST_RUNTIME_MODEL_VERSION);
      expect(result.statements.map((statement) => statement.text)).toEqual([
        ...TEST_RUNTIME_LEGACY_STATEMENT_TEXTS,
      ]);
      // Jede Quellen-ID einer Aussage ist eine gepackte (und gesendete) Quelle.
      const packedIds = new Set(shown.promptContext.context.sources.map((source) => source.id));
      const sentIds = new Set(legacySourceIdsOf(sent!.rawBody));
      const citedIds = [...result.statements, ...result.suggestedNextSteps].flatMap(
        (statement) => statement.sourceIds,
      );
      expect(citedIds.length).toBeGreaterThan(0);
      for (const id of citedIds) {
        expect(packedIds.has(id)).toBe(true);
        expect(sentIds.has(id)).toBe(true);
      }
      expect(result.sources.map((source) => source.id)).toEqual([...new Set(citedIds)]);
    });

    it('verwirft im Legacy-Text-Pfad eine Aussage mit unbekannter Quellen-ID bei der Übernahme des Legacy-Ergebnisses und vermerkt das als Einschränkung', async () => {
      const room = await scenario();
      const unknownId = `qa-question:${randomUUID()}`;
      const unknownText = 'Legacy-Aussage mit unbekannter Quelle.';
      const runtime = await legacyRuntimeWith({
        legacyOutput: (body) => ({
          status: 'ready',
          statements: [
            ...TEST_RUNTIME_LEGACY_STATEMENT_TEXTS.map((text) => ({
              text,
              sourceIds: [legacySourceIdsOf(body)[0]!],
            })),
            { text: unknownText, sourceIds: [unknownId] },
          ],
          suggestedNextSteps: [],
          limitations: [],
          modelVersion: TEST_RUNTIME_MODEL_VERSION,
        }),
      });

      await requestSummary(room.sessionId);
      const final = await waitForTerminal(room.sessionId);

      expect(legacyRequests(runtime)).toHaveLength(1);
      expect(legacyRequests(runtime)[0]!.rawBody).not.toContain(unknownId);
      const result = final.result!;
      expect(result.status).toBe('ready');
      expect(result.execution.effectiveMode).toBe('legacy-text');
      expect(result.statements.map((statement) => statement.text)).toEqual([
        ...TEST_RUNTIME_LEGACY_STATEMENT_TEXTS,
      ]);
      expect(result.limitations).toContain(DROPPED_UNSOURCED_QA_SUMMARY_LIMITATION);
      // Die unbekannte ID fehlt überall im Ergebnis, ebenso der Text ihrer Aussage.
      expect(JSON.stringify(result)).not.toContain(unknownId);
      expect(JSON.stringify(result)).not.toContain(unknownText);
    });

    it('meldet im Legacy-Text-Pfad uncertain, wenn alle Aussagen nur unbekannte Quellen-IDs nennen', async () => {
      const room = await scenario();
      const unknownIds = [`qa-question:${randomUUID()}`, `qa-question:${randomUUID()}`];
      const runtime = await legacyRuntimeWith({
        legacyOutput: () => ({
          status: 'ready',
          statements: unknownIds.map((id, index) => ({
            text: `Legacy-Aussage ${index + 1} mit unbekannter Quelle.`,
            sourceIds: [id],
          })),
          suggestedNextSteps: [],
          limitations: [],
          modelVersion: TEST_RUNTIME_MODEL_VERSION,
        }),
      });

      await requestSummary(room.sessionId);
      const final = await waitForTerminal(room.sessionId);

      expect(legacyRequests(runtime)).toHaveLength(1);
      const result = final.result!;
      expect(result.status).toBe('uncertain');
      expect(result.execution.effectiveMode).toBe('legacy-text');
      expect(result.statements).toEqual([]);
      expect(result.sources).toEqual([]);
      expect(result.limitations).toContain(DROPPED_UNSOURCED_QA_SUMMARY_LIMITATION);
      for (const id of unknownIds) expect(JSON.stringify(result)).not.toContain(id);
    });

    // Exploratorisch, nicht vorregistriert: Die beiden folgenden Tests charakterisieren den
    // Befund „zeitabhängige sourceRevision“ (Protokoll Teil 3, nach E15). Sie halten das
    // heutige Verhalten fest, nicht ein Sollverhalten. Ursache laut Code: Die Blitzlicht-Quelle
    // trägt als Ende ihres Zeitfensters den Zeitpunkt des Aufbaus
    // (`loadQuickFeedbackModerationSnapshot`), und `meta.sourceRevision` sowie `snapshotHash`
    // schließen dieses Ende ein.
    it('Negativprobe: liefert bei einer Blitzlicht-Runde vom Typ YESNO ohne Stimmen und ohne Datenänderung bei jedem Kontextaufbau einen neuen snapshotHash und verwirft die Modellaussage als source_changed', async () => {
      const room = await scenario({ quickFeedbackEnabled: true });
      const runtime = await runtimeWith();
      await startQuickFeedbackRound(room.code, 'YESNO');
      const before = await dataState(room);
      expect(before.quickFeedback).not.toBeNull();

      const first = await preview(room.sessionId);
      const second = await preview(room.sessionId);

      // Seit upstream `96b2e46e` (Auswahl `topics-first`, neue Force-Fit-Stufen) fällt die
      // Blitzlicht-Quelle der Referenzfixture aus Budgetgründen aus dem gepackten Kontext;
      // das Modell sieht sie nicht (Trockenlauf 2026-11-06, Protokoll).
      expect(
        first.promptContext.context.sources.some((source) => source.kind === 'feedback-aggregate'),
      ).toBe(false);
      expect(first.promptContext.budget.truncations).toContainEqual(
        expect.objectContaining({ section: 'feedback', reason: 'token-budget' }),
      );
      // Zwei Aufbauten ohne Datenänderung: trotzdem anderer Hash und andere Revision …
      expect(second.promptContext.snapshotHash).not.toBe(first.promptContext.snapshotHash);
      expect(second.promptContext.context.meta.sourceRevision).not.toBe(
        first.promptContext.context.meta.sourceRevision,
      );
      // … der gepackte Kontext ist sonst gleich. Der Packing-Cache trifft nicht.
      expect(withoutBuildTimeFields(second.promptContext.context)).toEqual(
        withoutBuildTimeFields(first.promptContext.context),
      );
      expect(second.cache).toBe('miss');

      // Der Job ruft die Runtime auf und verwirft ihre Aussage als source_changed.
      const requested = await requestSummary(room.sessionId);
      expect(requested.result?.status).toBe('pending');
      const stored = await waitForStoredJobResult(room.sessionId);
      expect(completionRequests(runtime)).toHaveLength(1);
      expect(stored.execution).toMatchObject({
        attemptedMode: 'full-context',
        effectiveMode: 'extractive',
        fallback: { reason: 'source_changed' },
      });
      expectNoRuntimeStatement(stored, TEST_RUNTIME_STATEMENT_TEXTS);

      // Jeder Abruf von qa.summaryRuntime baut neu und bindet das Ergebnis mit neuem Hash.
      const polledOnce = await waitForTerminal(room.sessionId);
      const polledTwice = asV2Runtime(
        await hostCaller.summaryRuntime({ sessionId: room.sessionId }),
      );
      expect(polledOnce.result!.execution.fallback?.reason).toBe('source_changed');
      expect(polledOnce.result!.snapshotHash).not.toBe(stored.snapshotHash);
      expect(polledTwice.result!.execution.fallback?.reason).toBe('source_changed');
      expect(polledTwice.result!.snapshotHash).not.toBe(polledOnce.result!.snapshotHash);

      // Ein erneuter Auftrag ist kein Cache-Treffer und ruft die Runtime noch einmal auf.
      const again = await requestSummary(room.sessionId);
      expect(again.result?.status).toBe('pending');
      await waitForStoredJobResult(room.sessionId);
      expect(completionRequests(runtime)).toHaveLength(2);
      expect(getQaSummaryQueueMetrics().cacheHits).toBe(0);

      // Zwischen allen Aufbauten hat sich nichts geändert.
      expect(await dataState(room)).toEqual(before);
    });

    it('Kontrolle: liefert bei einer Blitzlicht-Runde vom Typ TEMPO ohne Datenänderung denselben snapshotHash, endet ready und beantwortet einen erneuten Auftrag aus dem Cache', async () => {
      const room = await scenario({ quickFeedbackEnabled: true });
      const runtime = await runtimeWith();
      await startQuickFeedbackRound(room.code, 'TEMPO');
      const before = await dataState(room);
      expect(before.quickFeedback).not.toBeNull();

      const first = await preview(room.sessionId);
      const second = await preview(room.sessionId);

      // Gleicher Lesepfad, aber für TEMPO entsteht keine Blitzlicht-Quelle mit Zeitfenster.
      // Seit `96b2e46e` fehlt die Blitzlicht-Quelle im gepackten Kontext beider Arme (bei
      // YESNO aus Budgetgründen, Test oben); diese Prüfung trennt die Arme also nicht mehr,
      // unterscheidend sind hier Hash, `sourceRevision` und der Cache-Treffer.
      expect(feedbackWindowEnd(first.promptContext.context)).toBeNull();
      expect(second.promptContext.snapshotHash).toBe(first.promptContext.snapshotHash);
      expect(second.promptContext.context.meta.sourceRevision).toBe(
        first.promptContext.context.meta.sourceRevision,
      );
      expect(second.cache).toBe('hit');

      const requested = await requestSummary(room.sessionId);
      expect(requested.result?.status).toBe('pending');
      const stored = await waitForStoredJobResult(room.sessionId);
      expect(completionRequests(runtime)).toHaveLength(1);
      expect(stored.status).toBe('ready');
      expect(stored.execution).toEqual({
        attemptedMode: 'full-context',
        effectiveMode: 'full-context',
        fallback: null,
      });
      expect(stored.snapshotHash).toBe(first.promptContext.snapshotHash);

      const polledOnce = await waitForTerminal(room.sessionId);
      const polledTwice = asV2Runtime(
        await hostCaller.summaryRuntime({ sessionId: room.sessionId }),
      );
      expect(polledOnce.result!.snapshotHash).toBe(stored.snapshotHash);
      expect(polledTwice.result!.snapshotHash).toBe(stored.snapshotHash);
      expect(polledTwice.result!.status).toBe('ready');

      // Ein erneuter Auftrag innerhalb des Cooldowns ist ein Cache-Treffer ohne Runtime-Aufruf.
      const again = await requestSummary(room.sessionId);
      expect(again.result?.status).toBe('ready');
      expect(getQaSummaryQueueMetrics().cacheHits).toBe(1);
      await waitForQaSummaryIdleForTests(TERMINAL_WAIT_MS);
      expect(completionRequests(runtime)).toHaveLength(1);

      expect(await dataState(room)).toEqual(before);
    });
  },
);
