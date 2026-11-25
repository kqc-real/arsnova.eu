/**
 * Opt-in Laborlauf der Q&A-Zusammenfassung gegen die ausgelieferte private
 * Runtime (llama-server) auf der Laborinstanz. Entwurf des Designs:
 * `docs/referat-thema-1/specs/2026-10-25-1c-labor-design.md`, Ablauf:
 * `docs/referat-thema-1/evidenz/1C/labor-runbook.md`.
 *
 * Pfad: echter tRPC-Router (`qa.summaryContextPreview`, `qa.requestSummary`,
 * `qa.summaryRuntime`) → Queue → Kontextaufbau → Open-Weight-Client → echtes HTTP
 * → aufzeichnender Durchreich-Proxy auf 127.0.0.1 (`lib/recording-proxy.ts`) →
 * Runtime. Gemockt ist nur die Host-Tokenprüfung, wie in den E-Tests. Der Proxy
 * zeichnet den rohen Anfrage-Body und die rohe Antwort (mit `usage` und
 * `timings`) auf, ohne Bytes zu verändern; den Wert des Bearer-Tokens zeichnet er
 * nicht auf.
 *
 * Opt-in über `RUN_QA_SUMMARY_LABOR=1`. Ohne Flag wird die Datei übersprungen.
 * Mit Flag sind Pflicht: `DATABASE_URL`, `REDIS_URL`, `QA_SUMMARY_LABOR_OUT` und
 * entweder `QA_SUMMARY_LABOR_RUNTIME_URL` plus `QA_SUMMARY_LABOR_RUNTIME_TOKEN`
 * (echte Runtime) oder `QA_SUMMARY_LABOR_FAKE_RUNTIME=1` (Trockenlauf gegen die
 * In-Prozess-Test-Runtime; **keine Evidenz**, im JSON als `dryRun` markiert).
 * Fehlt etwas, scheitert der Lauf sofort mit einer Liste der fehlenden Variablen.
 *
 * Queue- und Client-Timeout sind standardmäßig der Release-Wert 90 000 ms.
 * `QA_SUMMARY_LABOR_TIMEOUT_MS` (1 000–300 000, die Produktgrenzen) setzt beide
 * für langsame Laborhardware; das JSON vermerkt die Abweichung
 * (`timeoutDeviatesFromRelease`, Design Frage A4).
 *
 * Keine Zeit-Assertions; geprüft wird nur, dass jeder Lauf einen Endstatus
 * erreicht. Alle Kriterien wertet `evidenz/1C/messung/auswertung.mjs` aus.
 */
import { createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
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
  type QaSummaryContextPreviewDTO,
  type QaSummaryResultV2,
  type QaSummaryRuntimeV2DTO,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { getRedis } from '../redis';
import { canonicalModerationPromptJson } from '../lib/moderationPromptContextPacking';
import {
  QA_SUMMARY_MODERATION_PACKING_PROFILE,
  QA_SUMMARY_TECHNICAL_DEFINITION_TEXT,
  QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT,
  prepareFreshModerationSummaryContext,
  type PreparedModerationSummaryContext,
} from '../lib/moderationSummaryContext';
import { resetOpenWeightLlmClientForTests } from '../lib/openWeightLlmClient';
import {
  OPEN_WEIGHT_LLM_MODEL_ID,
  OPEN_WEIGHT_LLM_MODEL_VERSION,
  OPEN_WEIGHT_LLM_TIMEOUT_MAX_MS,
  OPEN_WEIGHT_LLM_TIMEOUT_MIN_MS,
  isPrivateOpenWeightLlmAddress,
  resolveOpenWeightLlmConfig,
  resolveOpenWeightLlmUrl,
} from '../lib/openWeightLlmConfig';
import { resolveEffectiveQaSummaryTimeoutMs } from '../lib/qaSummaryConfig';
import {
  getQaSummaryRuntime,
  resetQaSummaryQueueForTests,
  waitForQaSummaryIdleForTests,
} from '../lib/qaSummaryQueue';
import { qaRouter } from '../routers/qa';
import {
  TEST_RUNTIME_TOKEN,
  defaultCompletionBodyWithUsage,
  startTestRuntime,
  useTestRuntimeEnv,
  type TestRuntime,
} from './lib/open-weight-test-runtime';
import {
  REFERENCE_SCENARIO_PARTICIPANTS,
  capturePlatformStatistic,
  cleanupFixtures,
  createFixtureRegistry,
  createFullContextScenario,
  createReferenceScenario,
  restorePlatformStatistic,
  type PlatformStatisticSnapshot,
  type ReferenceScenario,
} from './lib/qa-summary-pg-fixture';
import {
  startRecordingProxy,
  type ProxyExchange,
  type RecordingProxy,
} from './lib/recording-proxy';

const RUN = process.env['RUN_QA_SUMMARY_LABOR'] === '1';
const HOST_TOKEN = `host-token-${randomUUID()}`;
const hostCaller = qaRouter.createCaller({ req: {} as never });

/** Vorab festgelegte Standardwerte (Design, Abschnitt „Ablauf“); per Env nur für Trockenläufe. */
const DEFAULT_RUNS = 20;
const DEFAULT_WARMUP = 1;
const DEFAULT_DIRECT_RUNS = 5;
const DEFAULT_L5_RUNS = 0;
const DEFAULT_FAKE_DELAY_MS = 200;
/** Release-Standard (90 s) für Queue- und Client-Timeout, explizit gesetzt. */
const RELEASE_TIMEOUT_MS = 90_000;
/**
 * Obergrenze wie im Produkt (`QA_SUMMARY_TIMEOUT_MAX_MS`, `OPEN_WEIGHT_LLM_TIMEOUT_MAX_MS`).
 * Ein Wert über dem Release-Standard ist eine gekennzeichnete Abweichung (Design, Frage A4).
 */
const LABOR_TIMEOUT_MIN_MS = OPEN_WEIGHT_LLM_TIMEOUT_MIN_MS;
const LABOR_TIMEOUT_MAX_MS = OPEN_WEIGHT_LLM_TIMEOUT_MAX_MS;
const TERMINAL_MARGIN_MS = 60_000;
const OUTER_TIMEOUT_MS = 4 * 60 * 60 * 1000;
/** Vor- und Nachbereitung: Runtime-Abrufe (je höchstens 10 s), Aufräumen der Fixtures. */
const HOOK_TIMEOUT_MS = 300_000;

const COMPLETIONS_PATH = '/v1/chat/completions';
const SLOTS_PATH = '/slots?fail_on_no_slot=1';
const CHAT_COMPLETION_TOP_LEVEL_KEYS = [
  'chat_template_kwargs',
  'max_tokens',
  'messages',
  'model',
  'reasoning_effort',
  'response_format',
  'stream',
  'temperature',
];

type LaborConfig = {
  readonly fake: boolean;
  readonly runtimeUrl: string | null;
  readonly runtimeToken: string | null;
  readonly out: string;
  readonly runs: number;
  readonly warmup: number;
  readonly directRuns: number;
  readonly l5Runs: number;
  readonly fakeDelayMs: number;
  readonly timeoutMs: number;
  readonly baseline: string | null;
  readonly runtimeImage: string | null;
  readonly modelSha256: string | null;
};

function intEnv(name: string, fallback: number, problems: string[]): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) {
    problems.push(`${name} muss eine nicht negative ganze Zahl sein`);
    return fallback;
  }
  return Number(raw);
}

function patternEnv(name: string, pattern: RegExp, problems: string[]): string | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  if (!pattern.test(raw)) {
    problems.push(`${name} hat ein ungültiges Format (erwartet ${pattern.source})`);
    return null;
  }
  return raw;
}

/** Liest und prüft die Labor-Env; wirft mit einer vollständigen Liste aller Probleme. */
async function resolveLaborConfig(): Promise<LaborConfig> {
  const problems: string[] = [];
  const missing = (name: string) => !process.env[name]?.trim();
  for (const name of ['DATABASE_URL', 'REDIS_URL', 'QA_SUMMARY_LABOR_OUT']) {
    if (missing(name)) problems.push(`${name} fehlt`);
  }
  const fake = process.env['QA_SUMMARY_LABOR_FAKE_RUNTIME'] === '1';
  let runtimeUrl: string | null = null;
  let runtimeToken: string | null = null;
  if (fake) {
    if (!missing('QA_SUMMARY_LABOR_RUNTIME_URL') || !missing('QA_SUMMARY_LABOR_RUNTIME_TOKEN')) {
      problems.push(
        'QA_SUMMARY_LABOR_FAKE_RUNTIME=1 schließt QA_SUMMARY_LABOR_RUNTIME_URL/_TOKEN aus',
      );
    }
  } else {
    for (const name of ['QA_SUMMARY_LABOR_RUNTIME_URL', 'QA_SUMMARY_LABOR_RUNTIME_TOKEN']) {
      if (missing(name)) problems.push(`${name} fehlt (oder QA_SUMMARY_LABOR_FAKE_RUNTIME=1)`);
    }
    if (!missing('QA_SUMMARY_LABOR_RUNTIME_URL')) {
      try {
        runtimeUrl = resolveOpenWeightLlmUrl(process.env['QA_SUMMARY_LABOR_RUNTIME_URL']);
        const host = new URL(runtimeUrl!).hostname.replace(/^\[|\]$/g, '');
        const addresses = await lookup(host, { all: true, verbatim: true });
        if (
          addresses.length === 0 ||
          addresses.some(({ address }) => !isPrivateOpenWeightLlmAddress(address))
        ) {
          problems.push(
            'QA_SUMMARY_LABOR_RUNTIME_URL muss ausschließlich auf private Adressen zeigen (wie der Client)',
          );
        }
      } catch (error) {
        problems.push(`QA_SUMMARY_LABOR_RUNTIME_URL: ${(error as Error).message}`);
      }
    }
    if (!missing('QA_SUMMARY_LABOR_RUNTIME_TOKEN')) {
      runtimeToken = process.env['QA_SUMMARY_LABOR_RUNTIME_TOKEN']!;
      // Dieselbe Formatregel wie der Client (`resolveOpenWeightLlmConfig`).
      try {
        resolveOpenWeightLlmConfig({ OPEN_WEIGHT_LLM_TOKEN: runtimeToken });
      } catch {
        problems.push('QA_SUMMARY_LABOR_RUNTIME_TOKEN muss 32 bis 512 URL-sichere Zeichen haben');
      }
    }
  }
  const config: LaborConfig = {
    fake,
    runtimeUrl,
    runtimeToken,
    out: process.env['QA_SUMMARY_LABOR_OUT']?.trim() ?? '',
    runs: intEnv('QA_SUMMARY_LABOR_RUNS', DEFAULT_RUNS, problems),
    warmup: intEnv('QA_SUMMARY_LABOR_WARMUP', DEFAULT_WARMUP, problems),
    directRuns: intEnv('QA_SUMMARY_LABOR_DIRECT_RUNS', DEFAULT_DIRECT_RUNS, problems),
    l5Runs: intEnv('QA_SUMMARY_LABOR_L5_RUNS', DEFAULT_L5_RUNS, problems),
    fakeDelayMs: intEnv('QA_SUMMARY_LABOR_FAKE_DELAY_MS', DEFAULT_FAKE_DELAY_MS, problems),
    timeoutMs: intEnv('QA_SUMMARY_LABOR_TIMEOUT_MS', RELEASE_TIMEOUT_MS, problems),
    baseline: patternEnv('QA_SUMMARY_LABOR_BASELINE', /^[\w.@/-]{1,80}$/, problems),
    runtimeImage: patternEnv(
      'QA_SUMMARY_LABOR_RUNTIME_IMAGE',
      /^[\w.:/-]{1,200}@sha256:[0-9a-f]{64}$/,
      problems,
    ),
    modelSha256: patternEnv('QA_SUMMARY_LABOR_MODEL_SHA256', /^[0-9a-f]{64}$/, problems),
  };
  if (config.runs < 1) problems.push('QA_SUMMARY_LABOR_RUNS muss mindestens 1 sein');
  if (config.timeoutMs < LABOR_TIMEOUT_MIN_MS || config.timeoutMs > LABOR_TIMEOUT_MAX_MS) {
    problems.push(
      `QA_SUMMARY_LABOR_TIMEOUT_MS muss zwischen ${LABOR_TIMEOUT_MIN_MS} und ${LABOR_TIMEOUT_MAX_MS} liegen`,
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `RUN_QA_SUMMARY_LABOR=1, aber die Labor-Konfiguration ist unvollständig:\n- ${problems.join('\n- ')}\nSiehe docs/referat-thema-1/evidenz/1C/labor-runbook.md.`,
    );
  }
  return config;
}

const now = () => performance.now();
const round = (value: number) => Math.round(value * 1000) / 1000;
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const errorText = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

function asV2Runtime(value: unknown): QaSummaryRuntimeV2DTO {
  const runtime = value as QaSummaryRuntimeV2DTO;
  if (runtime.schemaVersion !== 2) throw new Error('summary runtime is not V2');
  return runtime;
}

function outcomeOf(result: QaSummaryResultV2 | null) {
  return {
    status: result?.status ?? null,
    effectiveMode: result?.execution.effectiveMode ?? null,
    fallbackReason: result?.execution.fallback?.reason ?? null,
    snapshotHash: result?.snapshotHash ?? null,
    statements: result?.statements.length ?? null,
    nextSteps: result?.suggestedNextSteps.length ?? null,
  };
}

function firstDifference(actual: string, expected: string): number | null {
  const length = Math.min(actual.length, expected.length);
  for (let index = 0; index < length; index += 1) {
    if (actual[index] !== expected[index]) return index;
  }
  return actual.length === expected.length ? null : length;
}

type ChatBody = {
  messages?: { role?: string; content?: string }[];
  max_tokens?: unknown;
  [key: string]: unknown;
};

/**
 * Prüfschritte wie `parseCompletion` (`openWeightLlmClient.ts`), auf der
 * aufgezeichneten Antwort nachvollzogen. Nur berichtet; maßgeblich ist der
 * Fallback-Grund des Ergebnisses.
 */
function classifyResponse(body: string | null, packedSourceIds: ReadonlySet<string>) {
  if (body === null) return { stage: 'no_response' } as const;
  let envelope: {
    model?: unknown;
    system_fingerprint?: unknown;
    choices?: { finish_reason?: unknown; message?: { content?: unknown } }[];
    usage?: Record<string, unknown>;
    timings?: Record<string, unknown>;
  };
  try {
    envelope = JSON.parse(body) as typeof envelope;
  } catch {
    return { stage: 'invalid_http_json' } as const;
  }
  const meta = {
    model: typeof envelope.model === 'string' ? envelope.model : null,
    systemFingerprint:
      typeof envelope.system_fingerprint === 'string' ? envelope.system_fingerprint : null,
    finishReason: envelope.choices?.[0]?.finish_reason ?? null,
    usage: envelope.usage ?? null,
    timings: envelope.timings ?? null,
  };
  const content = envelope.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return { stage: 'invalid_completion_envelope', ...meta };
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { stage: 'invalid_model_json', contentBytes: Buffer.byteLength(content), ...meta };
  }
  const output = OpenWeightLlmOutputSchema.safeParse(parsed);
  if (!output.success) {
    return { stage: 'output_schema', contentBytes: Buffer.byteLength(content), ...meta };
  }
  if (output.data.taskType !== 'qa_summary') return { stage: 'task_type', ...meta };
  const unknownIds = collectSourceIds(output.data).filter((id) => !packedSourceIds.has(id));
  return {
    stage: unknownIds.length > 0 ? 'question_references' : 'ok',
    contentBytes: Buffer.byteLength(content),
    ...meta,
  };
}

/** Alle Werte unter Schlüsseln `sourceIds` (rekursiv), wie sie die Modellausgabe zitiert. */
function collectSourceIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectSourceIds);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === 'sourceIds' && Array.isArray(child)
      ? child.filter((id): id is string => typeof id === 'string')
      : collectSourceIds(child),
  );
}

type PrepareRecord = {
  call: number;
  startedAt: number;
  endedAt: number | null;
  snapshotHash: string | null;
  error: string | null;
  prepared: PreparedModerationSummaryContext | null;
};

describe.skipIf(!RUN)(
  'Q&A summary lab run against the private runtime (PostgreSQL + Redis)',
  { timeout: OUTER_TIMEOUT_MS },
  () => {
    const registry = createFixtureRegistry();
    let platformBefore: PlatformStatisticSnapshot | null = null;
    let config: LaborConfig | null = null;
    let fakeRuntime: TestRuntime | null = null;
    let proxy: RecordingProxy | null = null;
    let upstream = '';
    let token = '';
    let terminalWaitMs = 0;
    const output: Record<string, unknown> = { completed: false };
    const labor: Record<string, unknown> = {};
    const testsCompleted: string[] = [];
    const expectedTests: string[] = [];

    function requireConfig(): LaborConfig {
      if (!config) throw new Error('Labor-Konfiguration nicht geladen (siehe Fehler in beforeAll)');
      return config;
    }

    /** Liest Kennungen der Runtime direkt (nicht über den Proxy); speichert keine Secrets. */
    async function runtimeMetadata() {
      const get = async (path: string) => {
        const started = now();
        try {
          const response = await fetch(`${upstream}${path}`, {
            headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
            signal: AbortSignal.timeout(10_000),
          });
          const text = await response.text();
          let json: unknown = null;
          try {
            json = JSON.parse(text) as unknown;
          } catch {
            json = null;
          }
          return { path, status: response.status, ms: round(now() - started), json };
        } catch (error) {
          return {
            path,
            status: null,
            ms: round(now() - started),
            json: null,
            error: errorText(error),
          };
        }
      };
      const health = await get('/health');
      const props = await get('/props');
      const models = await get('/v1/models');
      const slots = await get(SLOTS_PATH);
      const p = (props.json ?? {}) as Record<string, unknown>;
      const settings = (p['default_generation_settings'] ?? {}) as Record<string, unknown>;
      const m = (models.json ?? {}) as { data?: { id?: unknown; meta?: unknown }[] };
      return {
        readAt: new Date().toISOString(),
        health: { status: health.status, ms: health.ms, body: health.json },
        props: {
          status: props.status,
          buildInfo: p['build_info'] ?? null,
          modelPath: p['model_path'] ?? null,
          totalSlots: p['total_slots'] ?? null,
          nCtx: settings['n_ctx'] ?? null,
          chatTemplateSha256:
            typeof p['chat_template'] === 'string' ? sha256(p['chat_template']) : null,
        },
        models: {
          status: models.status,
          ids: (m.data ?? []).map((item) => item.id ?? null),
          meta: (m.data ?? []).map((item) => item.meta ?? null),
        },
        slots: {
          status: slots.status,
          count: Array.isArray(slots.json) ? slots.json.length : null,
        },
      };
    }

    async function waitForStored(sessionId: string, started: number) {
      for (;;) {
        const stored = (await getQaSummaryRuntime(sessionId)).result;
        if (stored && stored.status !== 'pending') return stored;
        if (now() - started > terminalWaitMs) {
          throw new Error(`Job erreichte nach ${terminalWaitMs} ms keinen Endstatus`);
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    /**
     * Ein Auftrag wie ein Host: Vorschau, `requestSummary`, Jobende (ohne
     * Kontextaufbau erkannt), dann genau ein `summaryRuntime`. Zeichnet jeden
     * Kontextaufbau mit Zeitpunkten auf (Wrapper ruft die echte Funktion).
     */
    async function runJob(room: ReferenceScenario, viaProxy: RecordingProxy | null) {
      const prepares: PrepareRecord[] = [];
      resetQaSummaryQueueForTests({
        prepare: async (input) => {
          const record: PrepareRecord = {
            call: prepares.length + 1,
            startedAt: now(),
            endedAt: null,
            snapshotHash: null,
            error: null,
            prepared: null,
          };
          prepares.push(record);
          try {
            const prepared = await prepareFreshModerationSummaryContext(input);
            record.snapshotHash = prepared.request.promptContext.snapshotHash;
            record.prepared = prepared;
            return prepared;
          } catch (error) {
            record.error = errorText(error);
            throw error;
          } finally {
            record.endedAt = now();
          }
        },
      });
      // Jeder Lauf isoliert: Circuit-Breaker und In-Flight-Sperre des Clients zurückgesetzt.
      resetOpenWeightLlmClientForTests();
      const exchangesBefore = viaProxy?.exchanges.length ?? 0;

      const origin = now();
      const preview: QaSummaryContextPreviewDTO = await hostCaller.summaryContextPreview({
        sessionId: room.sessionId,
        locale: 'de',
      });
      const requestStartedAt = now();
      const requested = asV2Runtime(
        await hostCaller.requestSummary({ sessionId: room.sessionId, locale: 'de' }),
      );
      const requestEndedAt = now();
      const stored = await waitForStored(room.sessionId, requestStartedAt);
      const jobDoneAt = now();
      const host = asV2Runtime(await hostCaller.summaryRuntime({ sessionId: room.sessionId }));
      const totalEndedAt = now();
      await waitForQaSummaryIdleForTests(terminalWaitMs);
      expect(host.result?.status).toBeDefined();
      expect(host.result?.status).not.toBe('pending');

      const rel = (value: number | null) => (value === null ? null : round(value - origin));
      const jobPrepares = prepares.filter(
        (record) => record.startedAt >= requestEndedAt && record.startedAt < jobDoneAt,
      );
      const before = jobPrepares[0] ?? null;
      const after = jobPrepares[1] ?? null;
      const roleOf = (record: PrepareRecord) =>
        record.startedAt < requestStartedAt
          ? 'preview'
          : record.startedAt < requestEndedAt
            ? 'request'
            : record === before
              ? 'before'
              : record === after
                ? 'after'
                : record.startedAt >= jobDoneAt
                  ? 'read'
                  : 'job-other';

      const exchanges = viaProxy ? viaProxy.exchanges.slice(exchangesBefore) : [];
      const completions = exchanges.filter(
        (exchange) => exchange.method === 'POST' && exchange.path === COMPLETIONS_PATH,
      );
      const slotProbes = exchanges.filter(
        (exchange) => exchange.method === 'GET' && exchange.path === SLOTS_PATH,
      );
      const sent = before?.prepared ?? null;
      const sentBudget = sent?.request.promptContext.budget ?? null;
      const previewCanonical = canonicalModerationPromptJson(preview.promptContext.context);
      const sentCanonical = sent
        ? canonicalModerationPromptJson(sent.request.promptContext.context)
        : null;
      const packedSourceIds = new Set(
        (sent?.request.promptContext ?? preview.promptContext).context.sources.map(
          (source) => source.id,
        ),
      );

      const describeExchange = (exchange: ProxyExchange) => {
        let wire: Record<string, unknown> | null = null;
        if (exchange.path === COMPLETIONS_PATH) {
          let body: ChatBody | null;
          try {
            body = JSON.parse(exchange.requestBody) as ChatBody;
          } catch {
            body = null;
          }
          const messages = body?.messages ?? [];
          const user = messages.find((message) => message.role === 'user')?.content ?? null;
          wire = {
            topLevelKeys: body ? Object.keys(body).sort() : null,
            topLevelKeysAsExpected: body
              ? JSON.stringify(Object.keys(body).sort()) ===
                JSON.stringify(CHAT_COMPLETION_TOP_LEVEL_KEYS)
              : false,
            roles: messages.map((message) => message.role ?? null),
            maxTokens: body?.max_tokens ?? null,
            userMessageBytes: user === null ? null : Buffer.byteLength(user, 'utf8'),
            // L1 (2): User-Nachricht bytegleich mit dem kanonischen Kontext der Vorschau.
            userEqualsPreview: user === previewCanonical,
            userFirstDifferenceToPreview:
              user === null ? null : firstDifference(user, previewCanonical),
            userEqualsSentPrepare: sentCanonical === null ? null : user === sentCanonical,
            // L1 (3): System-Nachrichten = Instruktion und Definition der Vorschau-Versionen.
            systemInstructionMatches:
              messages[0]?.content === QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT,
            systemDefinitionMatches: messages[1]?.content === QA_SUMMARY_TECHNICAL_DEFINITION_TEXT,
            messageContentBytes: messages.reduce(
              (sum, message) => sum + Buffer.byteLength(message.content ?? '', 'utf8'),
              0,
            ),
            response: classifyResponse(exchange.responseBody, packedSourceIds),
          };
        }
        return {
          method: exchange.method,
          path: exchange.path,
          requestHeaderNames: exchange.requestHeaderNames,
          authorizationPresent: exchange.authorizationPresent,
          authorizationMatchesExpected: exchange.authorizationMatchesExpected,
          forwardedBodyIdentical: exchange.forwardedBodyIdentical,
          requestBodyBytes: exchange.requestBodyBytes,
          requestBodySha256: exchange.requestBodySha256,
          responseStatus: exchange.responseStatus,
          responseBodyBytes: exchange.responseBodyBytes,
          responseBodySha256: exchange.responseBodySha256,
          upstreamError: exchange.upstreamError,
          at: {
            requestReceived: rel(exchange.at.requestReceived),
            forwardStarted: rel(exchange.at.forwardStarted),
            upstreamHeaders: rel(exchange.at.upstreamHeaders),
            upstreamEnded: rel(exchange.at.upstreamEnded),
            responseSent: rel(exchange.at.responseSent),
          },
          upstreamMs:
            exchange.at.upstreamEnded === null
              ? null
              : round(exchange.at.upstreamEnded - exchange.at.forwardStarted),
          wire,
          // Rohdaten (synthetische Fixture, kein Token): Anfrage- und Antwort-Body.
          rawRequestBody: exchange.path === COMPLETIONS_PATH ? exchange.requestBody : null,
          rawResponseBody: exchange.path === COMPLETIONS_PATH ? exchange.responseBody : null,
        };
      };

      return {
        sessionId: room.sessionId,
        previewMs: round(requestStartedAt - origin),
        requestMs: round(requestEndedAt - requestStartedAt),
        jobDoneMs: round(jobDoneAt - requestStartedAt),
        totalMs: round(totalEndedAt - requestStartedAt),
        requestStatus: requested.result?.status ?? null,
        preview: {
          snapshotHash: preview.promptContext.snapshotHash,
          selectedMode: preview.selectedMode,
          cache: preview.cache,
          instructionVersion: preview.instructionVersion,
          definitionVersion: preview.definitionVersion,
          budget: preview.promptContext.budget,
          canonicalContextBytes: Buffer.byteLength(previewCanonical, 'utf8'),
        },
        sent: sent
          ? {
              snapshotHash: sent.request.promptContext.snapshotHash,
              budget: sentBudget,
              canonicalContextBytes: Buffer.byteLength(sentCanonical!, 'utf8'),
              areas: Object.fromEntries(
                Object.entries(sent.request.promptContext.context)
                  .filter(
                    ([, value]) => typeof value === 'object' && value !== null && 'state' in value,
                  )
                  .map(([key, value]) => [key, (value as { state: string }).state]),
              ),
            }
          : null,
        stored: outcomeOf(stored),
        host: outcomeOf(host.result),
        prepares: prepares.map((record) => ({
          call: record.call,
          role: roleOf(record),
          startedAt: rel(record.startedAt),
          endedAt: rel(record.endedAt),
          ms: record.endedAt === null ? null : round(record.endedAt - record.startedAt),
          snapshotHash: record.snapshotHash,
          error: record.error,
        })),
        windowInnerMs:
          before && before.endedAt !== null && after
            ? round(after.startedAt - before.endedAt)
            : null,
        completionRequests: completions.length,
        slotProbes: slotProbes.length,
        exchanges: exchanges.map(describeExchange),
      };
    }

    beforeAll(async () => {
      config = await resolveLaborConfig();
      hostAuthMocks.extractHostTokenMock.mockReturnValue(HOST_TOKEN);
      hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
      hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);

      if (config.fake) {
        const delayMs = config.fakeDelayMs;
        fakeRuntime = await startTestRuntime({
          delayMs,
          respond: (body) => ({ status: 200, body: defaultCompletionBodyWithUsage(body, delayMs) }),
          getRoutes: {
            '/health': { status: 200, body: '{"status":"ok"}' },
            '/props': {
              status: 200,
              body: JSON.stringify({
                build_info: 'FAKE-e2e-test-runtime',
                model_path: 'FAKE',
                total_slots: 1,
                default_generation_settings: { n_ctx: 8192 },
                chat_template: 'FAKE',
              }),
            },
            '/v1/models': {
              status: 200,
              body: JSON.stringify({ object: 'list', data: [{ id: 'FAKE', meta: null }] }),
            },
          },
        });
        upstream = fakeRuntime.baseUrl;
        token = TEST_RUNTIME_TOKEN;
      } else {
        upstream = config.runtimeUrl!;
        token = config.runtimeToken!;
      }
      proxy = await startRecordingProxy({ upstream, expectedToken: token });
      useTestRuntimeEnv(proxy, {
        OPEN_WEIGHT_LLM_TOKEN: token,
        QA_SUMMARY_TIMEOUT_MS: String(config.timeoutMs),
        OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: String(config.timeoutMs),
      });
      const effectiveTimeoutMs = resolveEffectiveQaSummaryTimeoutMs();
      terminalWaitMs = effectiveTimeoutMs + TERMINAL_MARGIN_MS;

      const [pg] = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
      const redisInfo = await getRedis().info('server');
      const upstreamUrl = new URL(upstream);
      labor['runtimeKind'] = config.fake ? 'fake-test-runtime' : 'labor-runtime';
      labor['dryRun'] = config.fake;
      labor['metadataBefore'] = await runtimeMetadata();
      const metadata = labor['metadataBefore'] as Awaited<ReturnType<typeof runtimeMetadata>>;
      const pinnedSha = OPEN_WEIGHT_LLM_MODEL_ID.split('@sha256:')[1] ?? null;
      const pinnedBuild = /llama:server-(b\d+)/.exec(OPEN_WEIGHT_LLM_MODEL_VERSION)?.[1] ?? null;
      output['environment'] = {
        startedAt: new Date().toISOString(),
        gitSha: process.env['QA_SUMMARY_LABOR_GIT_SHA'] ?? null,
        gitDirty:
          process.env['QA_SUMMARY_LABOR_GIT_DIRTY'] === undefined
            ? null
            : process.env['QA_SUMMARY_LABOR_GIT_DIRTY'] === 'true',
        baseline: config.baseline,
        cpuModel: cpus()[0]?.model ?? null,
        logicalCores: cpus().length,
        totalMemoryBytes: totalmem(),
        node: process.version,
        postgres: pg?.version ?? null,
        redis: /redis_version:(\S+)/.exec(redisInfo)?.[1] ?? null,
        runtime: {
          kind: labor['runtimeKind'],
          // Adresse nicht aufgezeichnet; nur Schema, Port und ob ein IP-Literal genutzt wurde.
          protocol: upstreamUrl.protocol,
          port: upstreamUrl.port || null,
          ipLiteral: /^[\d.]+$|:/.test(upstreamUrl.hostname),
          imageDigestReported: config.runtimeImage,
          modelSha256Reported: config.modelSha256,
          pinnedModelId: OPEN_WEIGHT_LLM_MODEL_ID,
          pinnedModelVersion: OPEN_WEIGHT_LLM_MODEL_VERSION,
          modelSha256MatchesPinned:
            config.modelSha256 === null ? null : config.modelSha256 === pinnedSha,
          buildInfoMatchesPinned:
            typeof metadata.props.buildInfo === 'string' && pinnedBuild
              ? metadata.props.buildInfo.startsWith(`${pinnedBuild}-`) ||
                metadata.props.buildInfo === pinnedBuild
              : null,
        },
        client: {
          model: resolveOpenWeightLlmConfig().model,
          maxOutputTokensQaSummary: resolveOpenWeightLlmConfig().maxOutputTokens.qa_summary,
          effectiveQaSummaryTimeoutMs: effectiveTimeoutMs,
          packingProfile: {
            modelProfile: QA_SUMMARY_MODERATION_PACKING_PROFILE.modelProfile,
            contextWindowTokens: QA_SUMMARY_MODERATION_PACKING_PROFILE.contextWindowTokens,
            reservedOutputTokens: QA_SUMMARY_MODERATION_PACKING_PROFILE.reservedOutputTokens,
            safetyMarginTokens: QA_SUMMARY_MODERATION_PACKING_PROFILE.safetyMarginTokens,
          },
        },
        fixture: {
          name: 'MODERATION_PROMPT_REFERENCE_*_FIXTURE_V1 (#456 Abschnitt 12), je Lauf neu angelegt',
          participants: REFERENCE_SCENARIO_PARTICIPANTS,
          questions: 6,
          locale: 'de',
        },
        settings: {
          runs: config.runs,
          warmup: config.warmup,
          directRuns: config.directRuns,
          l5RunsPerArm: config.l5Runs,
          fakeDelayMs: config.fake ? config.fakeDelayMs : null,
          terminalWaitMs,
          timeoutMs: config.timeoutMs,
          releaseTimeoutMs: RELEASE_TIMEOUT_MS,
          timeoutDeviatesFromRelease: config.timeoutMs !== RELEASE_TIMEOUT_MS,
          timer: 'performance.now()',
          proxy: 'lib/recording-proxy.ts (127.0.0.1, gepuffert, Body-Bytes unverändert)',
        },
      };
      expectedTests.push('quiet');
      if (config.directRuns > 0) expectedTests.push('direct');
      if (config.l5Runs > 0) expectedTests.push('l5');
    }, HOOK_TIMEOUT_MS);

    afterAll(async () => {
      try {
        resetQaSummaryQueueForTests();
        resetOpenWeightLlmClientForTests();
        if (config && proxy) labor['metadataAfter'] = await runtimeMetadata();
        await proxy?.close();
        await fakeRuntime?.close();
        vi.unstubAllEnvs();
        if (platformBefore) {
          await cleanupFixtures(registry);
          await restorePlatformStatistic(platformBefore);
        }
      } finally {
        if (config?.out && output['environment']) {
          (output['environment'] as Record<string, unknown>)['endedAt'] = new Date().toISOString();
          output['testsCompleted'] = testsCompleted;
          output['completed'] = expectedTests.every((name) => testsCompleted.includes(name));
          output['labor'] = labor;
          mkdirSync(dirname(config.out), { recursive: true });
          writeFileSync(config.out, `${JSON.stringify(output, null, 2)}\n`);
        }
      }
    }, HOOK_TIMEOUT_MS);

    async function freshReferenceRoom(): Promise<ReferenceScenario> {
      if (!platformBefore) platformBefore = await capturePlatformStatistic();
      return createReferenceScenario({ registry });
    }

    it('L1–L4: ruhige Aufträge über den aufzeichnenden Proxy bis zur Runtime', async () => {
      const cfg = requireConfig();
      const runs: unknown[] = [];
      for (let index = 0; index < cfg.warmup + cfg.runs; index += 1) {
        const room = await freshReferenceRoom();
        const run = await runJob(room, proxy);
        runs.push({ index, warmup: index < cfg.warmup, viaProxy: true, ...run });
      }
      labor['quiet'] = {
        note: 'Je Lauf eine neu angelegte Referenzfixture (6 Fragen, N = 200), keine Stimmen während des Auftrags, Blitzlicht aus, Themen aus. Vorschau, dann qa.requestSummary, Jobende über getQaSummaryRuntime (5-ms-Takt, ohne Kontextaufbau), dann genau ein qa.summaryRuntime. requestMs/jobDoneMs/totalMs ab Aufruf von requestSummary. Client zwischen den Läufen zurückgesetzt (Circuit-Breaker isoliert).',
        runs,
      };
      testsCompleted.push('quiet');
    });

    it('Kontrolle: Aufträge ohne Proxy direkt gegen die Runtime (nur Zeiten und Status)', async () => {
      const cfg = requireConfig();
      if (cfg.directRuns === 0) return;
      useTestRuntimeEnv(
        { baseUrl: upstream },
        {
          OPEN_WEIGHT_LLM_TOKEN: token,
          QA_SUMMARY_TIMEOUT_MS: String(cfg.timeoutMs),
          OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: String(cfg.timeoutMs),
        },
      );
      const runs: unknown[] = [];
      try {
        for (let index = 0; index < cfg.directRuns; index += 1) {
          const room = await freshReferenceRoom();
          const run = await runJob(room, null);
          runs.push({ index, warmup: false, viaProxy: false, ...run });
        }
      } finally {
        useTestRuntimeEnv(proxy!, {
          OPEN_WEIGHT_LLM_TOKEN: token,
          QA_SUMMARY_TIMEOUT_MS: String(cfg.timeoutMs),
          OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: String(cfg.timeoutMs),
        });
      }
      labor['direct'] = {
        note: 'Wie quiet, aber OPEN_WEIGHT_LLM_URL direkt auf die Runtime (kein Proxy, keine Body-Aufzeichnung). Kontrolle für den Zeitanteil des Proxys; direkt nach quiet ausgeführt.',
        runs,
      };
      testsCompleted.push('direct');
    });

    it('L5 (optional): Befund T3.1 auf dem echten Pfad – voller Kontext mit YESNO- gegen TEMPO-Runde', async () => {
      const cfg = requireConfig();
      if (cfg.l5Runs === 0) return;
      const testNodeEnv = process.env['NODE_ENV'] ?? 'test';
      const arms: Record<string, unknown[]> = { YESNO: [], TEMPO: [] };
      for (let index = 0; index < cfg.l5Runs; index += 1) {
        // Abwechselnd, Reihenfolge je Iteration getauscht.
        const order =
          index % 2 === 0 ? (['YESNO', 'TEMPO'] as const) : (['TEMPO', 'YESNO'] as const);
        for (const type of order) {
          if (!platformBefore) platformBefore = await capturePlatformStatistic();
          // Fixture unter NODE_ENV=test anlegen (wie M6), erst danach die Umgebung setzen:
          // Themen liest nur der echte Redis-Cache; bei NODE_ENV=test liefert
          // `getWordCloudAnalysisCache()` einen No-op-Cache (Protokoll Teil 3, E15).
          const room = await createFullContextScenario({ registry, quickFeedbackType: type });
          vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'true');
          vi.stubEnv('NODE_ENV', 'development');
          try {
            const run = await runJob(room, proxy);
            arms[type]!.push({
              index,
              warmup: false,
              viaProxy: true,
              quickFeedbackType: type,
              ...run,
            });
          } finally {
            vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'false');
            vi.stubEnv('NODE_ENV', testNodeEnv);
          }
        }
      }
      labor['l5'] = {
        note: 'Volle #456-Fixture (createFullContextScenario) mit live Blitzlicht-Runde YESNO (Negativprobe T3.1) bzw. TEMPO (Kontrolle), ohne Stimmen während des Auftrags; Fixture unter NODE_ENV=test angelegt, Auftrag mit WORD_CLOUD_SEMANTIC_ENABLED=true und NODE_ENV=development (wie M6). Abwechselnd, Reihenfolge je Iteration getauscht.',
        arms,
      };
      testsCompleted.push('l5');
    });
  },
);
