/**
 * Minimale Betriebsstichprobe der drei privaten LLM-Aufträge.
 * Läuft nicht im Footer-Poll; globales Intervall schützt den Inferenz-Slot auch bei refresh.
 */
import {
  MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1,
  MODERATION_PROMPT_DEFINITION_SET_VERSION,
  OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  OpenWeightLlmRuntimeProbeSchema,
  QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION,
  QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
  QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION,
  QA_SUMMARY_V2_SCHEMA_VERSION,
  type OpenWeightLlmLearningObjectivesRequest,
  type OpenWeightLlmRuntimeProbeDTO,
  type OpenWeightLlmProbeTaskResult,
  type OpenWeightLlmProbeTaskStatus,
  type OpenWeightLlmSummaryRequestV2,
  type OpenWeightLlmTopicLabelOutput,
  type OpenWeightLlmTopicLabelRequest,
} from '@arsnova/shared-types';
import {
  isOpenWeightLlmEnabled,
  OPEN_WEIGHT_LLM_MODEL_ALIAS,
  resolveOpenWeightLlmLearningTimeoutMs,
  resolveOpenWeightLlmSummaryTimeoutMs,
} from './openWeightLlmConfig';
import {
  runOpenWeightLlmLearningObjectives,
  runOpenWeightLlmSummaryV2,
  runOpenWeightLlmTopicLabel,
} from './openWeightLlmClient';
import {
  QA_SUMMARY_TECHNICAL_DEFINITION_TEXT,
  QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT,
} from './moderationSummaryContext';
import { getRedis } from '../redis';
import { acquireRedisLease, type RedisLease } from './redisLease';

/** Ergebnis-Cache und Mindestabstand zwischen Live-Messungen (auch bei refresh). */
export const OPEN_WEIGHT_LLM_PROBE_CACHE_TTL_MS = 5 * 60_000;
const OPEN_WEIGHT_LLM_PROBE_SHARED_CACHE_KEY = 'llm:probe:cache:v1';
const OPEN_WEIGHT_LLM_PROBE_SHARED_INFLIGHT_KEY = 'llm:probe:inflight:v1';
const OPEN_WEIGHT_LLM_PROBE_INFLIGHT_TTL_MS = 30_000;
const OPEN_WEIGHT_LLM_PROBE_INFLIGHT_REFRESH_MS = 10_000;
const OPEN_WEIGHT_LLM_PROBE_REDIS_TIMEOUT_MS = 1_000;
const OPEN_WEIGHT_LLM_PROBE_FOLLOWER_WAIT_MS = 15_000;
const OPEN_WEIGHT_LLM_PROBE_FOLLOWER_POLL_MS = 200;
/**
 * Kurzes Probe-Budget für Topic (Erreichbarkeit/Schema).
 * Learning braucht mehr als 20 s, weil der Wire-Schema-Enum und die
 * Lernziel-Ausgabe auf CPU hinter einem Summary-Lauf sonst als `aborted`
 * und damit im Statusdialog als »nicht erreichbar« landen.
 * Summary nutzt die konfigurierte Produktions-Deadline (CPU-Prefill).
 */
export const OPEN_WEIGHT_LLM_PROBE_TASK_TIMEOUT_MS = 20_000;
export const OPEN_WEIGHT_LLM_PROBE_LEARNING_TIMEOUT_MS = 90_000;

export type OpenWeightLlmProbeTaskTimeoutsMs = {
  readonly topic_label: number;
  readonly qa_summary: number;
  readonly learning_objectives: number;
};

/**
 * Topic/Learning: festes kurzes Probe-Budget.
 * Summary: konfiguriertes `OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS` (einzeln geparst,
 * ohne volle Token-/Transport-Validierung). Ungültige Summary-Timeout-Zahlen werfen
 * und werden vom Aufrufer in ein strukturiertes Probe-Ergebnis übersetzt.
 */
export function resolveOpenWeightLlmProbeTaskTimeoutsMs(
  env: NodeJS.ProcessEnv = process.env,
  taskTimeoutOverride?: number,
): OpenWeightLlmProbeTaskTimeoutsMs {
  if (typeof taskTimeoutOverride === 'number') {
    return {
      topic_label: taskTimeoutOverride,
      qa_summary: taskTimeoutOverride,
      learning_objectives: taskTimeoutOverride,
    };
  }
  return {
    topic_label: OPEN_WEIGHT_LLM_PROBE_TASK_TIMEOUT_MS,
    qa_summary: resolveOpenWeightLlmSummaryTimeoutMs(env['OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS']),
    learning_objectives: Math.min(
      resolveOpenWeightLlmLearningTimeoutMs(env['OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS']),
      OPEN_WEIGHT_LLM_PROBE_LEARNING_TIMEOUT_MS,
    ),
  };
}

const PROBE_SOURCE_ID = 'probe-s1';
const PROBE_QUESTION_ID = '11111111-1111-4111-8111-111111111111';
const PROBE_REQUEST_ID = '22222222-2222-4222-8222-222222222222';

const TOPIC_LABEL_REQUEST = {
  schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  taskType: 'topic_label',
  locale: 'de',
  clusterId: 'ops-probe-topic-label',
  sources: [
    { id: PROBE_SOURCE_ID, text: 'Was ist die Steigung der Geraden y = 2x + 1?' },
    {
      id: 'probe-s2',
      text: 'Bestimme die lineare Funktion durch die Punkte (0, 1) und (2, 5).',
    },
  ],
} satisfies OpenWeightLlmTopicLabelRequest;

const TOPIC_LABEL_FALLBACK = {
  schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  taskType: 'topic_label',
  label: 'Probe',
  sourceIds: [PROBE_SOURCE_ID],
} satisfies OpenWeightLlmTopicLabelOutput;

const LEARNING_REQUEST = {
  schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  taskType: 'learning_objectives',
  locale: 'de',
  requestId: PROBE_REQUEST_ID,
  questions: [
    {
      id: PROBE_QUESTION_ID,
      text: 'Welche Gerade beschreibt y = 2x + 1?',
      answerOptions: [
        { text: 'Steigung 2, Achsenabschnitt 1', isCorrect: true },
        { text: 'Steigung 1, Achsenabschnitt 2', isCorrect: false },
      ],
    },
  ],
} satisfies OpenWeightLlmLearningObjectivesRequest;

function buildSummaryV2ProbeRequest(): OpenWeightLlmSummaryRequestV2 {
  const instructionText = QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT;
  const definitionText = QA_SUMMARY_TECHNICAL_DEFINITION_TEXT;
  const instructionTokens = new TextEncoder().encode(instructionText).byteLength;
  const definitionTokens = new TextEncoder().encode(definitionText).byteLength;
  const promptContext = structuredClone(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1);
  const dataTokens = promptContext.budget.dataTokens;
  const packedInputTokens = instructionTokens + definitionTokens + dataTokens;
  const reserved =
    promptContext.budget.reservedOutputTokens + promptContext.budget.safetyMarginTokens;
  promptContext.budget = {
    ...promptContext.budget,
    instructionTokens,
    definitionTokens,
    packedInputTokens,
    contextWindowTokens: Math.max(
      promptContext.budget.contextWindowTokens,
      packedInputTokens + reserved,
    ),
  };
  return {
    schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
    taskType: 'qa_summary',
    requestContract: QA_SUMMARY_CONTEXT_V2_CONTRACT_VERSION,
    outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
    instructionVersion: QA_SUMMARY_TECHNICAL_INSTRUCTION_VERSION,
    instructionText,
    definitionVersion: MODERATION_PROMPT_DEFINITION_SET_VERSION,
    definitionText,
    promptContext,
  };
}

const SUMMARY_V2_REQUEST = buildSummaryV2ProbeRequest();

type ProbeHooks = {
  readonly now?: () => number;
  readonly topicLabel?: typeof runOpenWeightLlmTopicLabel;
  readonly summaryV2?: typeof runOpenWeightLlmSummaryV2;
  readonly learning?: typeof runOpenWeightLlmLearningObjectives;
  readonly env?: NodeJS.ProcessEnv;
  readonly taskTimeoutMs?: number;
  readonly sharedWaitTimeoutMs?: number;
  readonly sharedPollIntervalMs?: number;
  /**
   * Nur für den Single-Flight-Leader vor der Live-Messung (z. B. IP-Rate-Limit).
   * Läuft synchron nach dem Claim von `probeInFlight`, damit parallele Shared-NAT-
   * Bursts coalescen und dieses Gate nicht mehrfach auslösen.
   */
  readonly beforeLiveMeasurement?: () => Promise<void>;
};

type CachedProbeEntry = {
  readonly value: OpenWeightLlmRuntimeProbeDTO;
  readonly expiresAt: number;
};

let cachedProbe: CachedProbeEntry | null = null;
let probeInFlight: Promise<OpenWeightLlmRuntimeProbeDTO> | null = null;

function shouldUseSharedProbeCoordination(env: NodeJS.ProcessEnv): boolean {
  return (
    env['OPEN_WEIGHT_LLM_SHARED_SLOT_ENABLED'] === 'true' ||
    env['SESSION_STATUS_PUBSUB_ENABLED'] === 'true'
  );
}

function withRedisTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('probe redis timeout')),
      OPEN_WEIGHT_LLM_PROBE_REDIS_TIMEOUT_MS,
    );
    timer.unref();
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function readSharedCachedProbe(nowMs: number): Promise<CachedProbeEntry | null> {
  const raw = await withRedisTimeout(getRedis().get(OPEN_WEIGHT_LLM_PROBE_SHARED_CACHE_KEY));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { value?: unknown; expiresAt?: unknown };
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= nowMs) {
      return null;
    }
    const value = OpenWeightLlmRuntimeProbeSchema.parse(parsed.value);
    return { value, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

async function writeSharedCachedProbe(entry: CachedProbeEntry, nowMs: number): Promise<void> {
  const ttlMs = Math.max(1_000, entry.expiresAt - nowMs);
  await withRedisTimeout(
    getRedis().set(OPEN_WEIGHT_LLM_PROBE_SHARED_CACHE_KEY, JSON.stringify(entry), 'PX', ttlMs),
  );
}

function inProgressProbe(checkedAt: string): OpenWeightLlmRuntimeProbeDTO {
  const busyTask: OpenWeightLlmProbeTaskResult = {
    status: 'busy',
    elapsedMs: null,
    reason: 'probe_in_progress',
  };
  return OpenWeightLlmRuntimeProbeSchema.parse({
    enabled: true,
    overall: 'busy',
    checkedAt,
    cache: 'live',
    modelAlias: OPEN_WEIGHT_LLM_MODEL_ALIAS,
    modelReported: null,
    tasks: {
      topic_label: busyTask,
      qa_summary: busyTask,
      learning_objectives: busyTask,
    },
  });
}

function disabledTask(): OpenWeightLlmProbeTaskResult {
  return { status: 'disabled', elapsedMs: null, reason: 'disabled' };
}

function disabledProbe(checkedAt: string): OpenWeightLlmRuntimeProbeDTO {
  return OpenWeightLlmRuntimeProbeSchema.parse({
    enabled: false,
    overall: 'disabled',
    checkedAt,
    cache: 'skipped',
    modelAlias: null,
    modelReported: null,
    tasks: {
      topic_label: disabledTask(),
      qa_summary: disabledTask(),
      learning_objectives: disabledTask(),
    },
  });
}

function misconfiguredTask(): OpenWeightLlmProbeTaskResult {
  return { status: 'unavailable', elapsedMs: null, reason: 'misconfigured' };
}

function misconfiguredProbe(checkedAt: string): OpenWeightLlmRuntimeProbeDTO {
  return OpenWeightLlmRuntimeProbeSchema.parse({
    enabled: true,
    overall: 'unavailable',
    checkedAt,
    cache: 'live',
    modelAlias: OPEN_WEIGHT_LLM_MODEL_ALIAS,
    modelReported: null,
    tasks: {
      topic_label: misconfiguredTask(),
      qa_summary: misconfiguredTask(),
      learning_objectives: misconfiguredTask(),
    },
  });
}

function mapFailureReason(reason: string): OpenWeightLlmProbeTaskStatus {
  switch (reason) {
    case 'busy':
      return 'busy';
    case 'disabled':
      return 'disabled';
    case 'invalid_response':
      return 'degraded';
    case 'timeout':
    case 'aborted':
    case 'circuit_open':
    case 'unavailable':
    case 'misconfigured':
      return 'unavailable';
    default:
      return 'unavailable';
  }
}

function overallFromTasks(
  tasks: OpenWeightLlmRuntimeProbeDTO['tasks'],
): OpenWeightLlmProbeTaskStatus {
  const statuses = [
    tasks.topic_label.status,
    tasks.qa_summary.status,
    tasks.learning_objectives.status,
  ];
  if (statuses.every((status) => status === 'disabled')) return 'disabled';
  if (statuses.every((status) => status === 'ok')) return 'ok';
  if (statuses.every((status) => status === 'unknown')) return 'unknown';
  if (
    statuses.some((status) => status === 'busy') &&
    statuses.every((status) => status === 'busy' || status === 'ok')
  ) {
    return 'busy';
  }
  if (statuses.some((status) => status === 'ok')) return 'degraded';
  if (statuses.some((status) => status === 'busy')) return 'busy';
  return 'unavailable';
}

type TaskRunOutcome = {
  readonly status: string;
  readonly reason?: string;
  readonly model?: string | null;
};

async function runOneTask(
  run: () => Promise<TaskRunOutcome>,
  now: () => number,
): Promise<OpenWeightLlmProbeTaskResult & { readonly model: string | null }> {
  const startedAt = now();
  try {
    const result = await run();
    const elapsedMs = Math.max(0, Math.round(now() - startedAt));
    const model =
      typeof result.model === 'string' && result.model.trim().length > 0
        ? result.model.trim().slice(0, 256)
        : null;
    if (result.status === 'completed') {
      return { status: 'ok', elapsedMs, reason: null, model };
    }
    const reason = result.reason ?? result.status;
    return {
      status: mapFailureReason(reason),
      elapsedMs,
      reason: reason.slice(0, 64),
      model: null,
    };
  } catch {
    return {
      status: 'unavailable',
      elapsedMs: Math.max(0, Math.round(now() - startedAt)),
      reason: 'error',
      model: null,
    };
  }
}

const OPEN_WEIGHT_LLM_PROBE_CANCEL_COOLDOWN_MS = 1_500;

async function waitForProbeCancelCooldown(
  previousOutcome: OpenWeightLlmProbeTaskResult,
): Promise<void> {
  if (previousOutcome.reason === 'aborted' || previousOutcome.reason === 'timeout') {
    await new Promise((resolve) => setTimeout(resolve, OPEN_WEIGHT_LLM_PROBE_CANCEL_COOLDOWN_MS));
  }
}

async function measureProbe(hooks: ProbeHooks): Promise<OpenWeightLlmRuntimeProbeDTO> {
  const env = hooks.env ?? process.env;
  const now = hooks.now ?? Date.now;
  const checkedAt = new Date(now()).toISOString();
  if (!isOpenWeightLlmEnabled(env['OPEN_WEIGHT_LLM_ENABLED'])) {
    return disabledProbe(checkedAt);
  }

  let timeouts: OpenWeightLlmProbeTaskTimeoutsMs;
  try {
    timeouts = resolveOpenWeightLlmProbeTaskTimeoutsMs(env, hooks.taskTimeoutMs);
  } catch {
    // Ungültige Timeout-Env-Werte: strukturierter Status, kein tRPC-Fehler.
    return misconfiguredProbe(checkedAt);
  }

  const topicLabel = hooks.topicLabel ?? runOpenWeightLlmTopicLabel;
  const summaryV2 = hooks.summaryV2 ?? runOpenWeightLlmSummaryV2;
  const learning = hooks.learning ?? runOpenWeightLlmLearningObjectives;

  try {
    const topic = await runOneTask(async () => {
      const result = await topicLabel(TOPIC_LABEL_REQUEST, TOPIC_LABEL_FALLBACK, {
        signal: AbortSignal.timeout(timeouts.topic_label),
      });
      return result.status === 'completed'
        ? { status: 'completed', model: result.telemetry.model }
        : { status: 'fallback', reason: result.reason };
    }, now);

    await waitForProbeCancelCooldown(topic);

    const qaSummary = await runOneTask(async () => {
      const result = await summaryV2(SUMMARY_V2_REQUEST, {
        signal: AbortSignal.timeout(timeouts.qa_summary),
      });
      // Gleiche Erfolgssemantik wie runPreparedQaSummary: schema-valides
      // `{ output: { status: 'failed' } }` gilt produktiv als Fallback, nicht als ok.
      if (result.status === 'completed' && result.output.output.status !== 'failed') {
        return { status: 'completed', model: result.telemetry.model };
      }
      return {
        status: result.status === 'completed' ? 'invalid_response' : result.status,
        reason: result.status === 'completed' ? 'invalid_response' : result.status,
      };
    }, now);

    await waitForProbeCancelCooldown(qaSummary);

    const learningObjectives = await runOneTask(async () => {
      const result = await learning(LEARNING_REQUEST, {
        signal: AbortSignal.timeout(timeouts.learning_objectives),
      });
      return result.status === 'completed'
        ? { status: 'completed', model: result.telemetry.model }
        : { status: result.status, reason: result.status };
    }, now);

    const tasks = {
      topic_label: {
        status: topic.status,
        elapsedMs: topic.elapsedMs,
        reason: topic.reason,
      },
      qa_summary: {
        status: qaSummary.status,
        elapsedMs: qaSummary.elapsedMs,
        reason: qaSummary.reason,
      },
      learning_objectives: {
        status: learningObjectives.status,
        elapsedMs: learningObjectives.elapsedMs,
        reason: learningObjectives.reason,
      },
    };
    const modelReported = topic.model ?? qaSummary.model ?? learningObjectives.model ?? null;

    return OpenWeightLlmRuntimeProbeSchema.parse({
      enabled: true,
      overall: overallFromTasks(tasks),
      checkedAt,
      cache: 'live',
      modelAlias: OPEN_WEIGHT_LLM_MODEL_ALIAS,
      modelReported,
      tasks,
    });
  } catch {
    // Schema-/Unerwartete Fehler: lieber strukturiert unavailable als rejected Promise.
    return OpenWeightLlmRuntimeProbeSchema.parse({
      enabled: true,
      overall: 'unavailable',
      checkedAt,
      cache: 'live',
      modelAlias: OPEN_WEIGHT_LLM_MODEL_ALIAS,
      modelReported: null,
      tasks: {
        topic_label: { status: 'unavailable', elapsedMs: null, reason: 'error' },
        qa_summary: { status: 'unavailable', elapsedMs: null, reason: 'error' },
        learning_objectives: { status: 'unavailable', elapsedMs: null, reason: 'error' },
      },
    });
  }
}

export function resetOpenWeightLlmRuntimeProbeForTests(): void {
  cachedProbe = null;
  probeInFlight = null;
}

/** Exported for contract tests — same V2 request the live probe sends. */
export function getOpenWeightLlmSummaryV2ProbeRequestForTests(): OpenWeightLlmSummaryRequestV2 {
  return SUMMARY_V2_REQUEST;
}

/**
 * true nur, wenn dieser Aufruf *jetzt* eine neue Live-Messung starten würde.
 * Peek-Hilfe für Tests; das autoritative Shared-NAT-Gate ist
 * `beforeLiveMeasurement` innerhalb von `getOpenWeightLlmRuntimeProbe`.
 */
export function wouldOpenWeightLlmRuntimeProbeRequireLiveMeasurement(
  options: { readonly now?: () => number; readonly env?: NodeJS.ProcessEnv } = {},
): boolean {
  const now = options.now ?? Date.now;
  const env = options.env ?? process.env;
  if (!isOpenWeightLlmEnabled(env['OPEN_WEIGHT_LLM_ENABLED'])) {
    return false;
  }
  if (cachedProbe && cachedProbe.expiresAt > now()) {
    return false;
  }
  if (probeInFlight) {
    return false;
  }
  return true;
}

export async function getOpenWeightLlmRuntimeProbe(
  options: ProbeHooks & { readonly refresh?: boolean } = {},
): Promise<OpenWeightLlmRuntimeProbeDTO> {
  const now = options.now ?? Date.now;
  const env = options.env ?? process.env;
  if (!isOpenWeightLlmEnabled(env['OPEN_WEIGHT_LLM_ENABLED'])) {
    const value = disabledProbe(new Date(now()).toISOString());
    cachedProbe = { value, expiresAt: now() + OPEN_WEIGHT_LLM_PROBE_CACHE_TTL_MS };
    return value;
  }

  // refresh darf den Cache/Cooldownkühlzeit nicht umgehen — sonst belegt jeder anonyme
  // Aufruf den einzigen Inferenz-Slot erneut (Shared-NAT-tauglich, kein IP-Budget-Senken).
  if (cachedProbe && cachedProbe.expiresAt > now()) {
    return OpenWeightLlmRuntimeProbeSchema.parse({
      ...cachedProbe.value,
      cache: 'fresh',
    });
  }

  if (probeInFlight) {
    return probeInFlight;
  }

  // Claim vor jedem await: parallele Burst-Requests coalescen auf dasselbe Promise;
  // beforeLiveMeasurement (Rate-Limit) läuft nur beim Leader und darf weiter werfen
  // (TOO_MANY_REQUESTS). measureProbe selbst liefert nur strukturierte DTOs.
  const beforeLive = options.beforeLiveMeasurement;
  const useShared = shouldUseSharedProbeCoordination(env);
  probeInFlight = (async () => {
    if (useShared) {
      try {
        const sharedHit = await readSharedCachedProbe(now());
        if (sharedHit) {
          cachedProbe = sharedHit;
          return OpenWeightLlmRuntimeProbeSchema.parse({
            ...sharedHit.value,
            cache: 'fresh',
          });
        }
      } catch {
        // Redis temporär nicht erreichbar -> kontrollierter lokaler Fallback
      }

      let lease: RedisLease | null = null;
      let redisCoordinationAvailable = true;
      try {
        lease = await withRedisTimeout(
          acquireRedisLease(
            OPEN_WEIGHT_LLM_PROBE_SHARED_INFLIGHT_KEY,
            OPEN_WEIGHT_LLM_PROBE_INFLIGHT_TTL_MS,
          ),
        );
      } catch {
        redisCoordinationAvailable = false;
      }

      if (redisCoordinationAvailable && !lease) {
        const waitBudgetMs = Math.max(
          50,
          options.sharedWaitTimeoutMs ?? OPEN_WEIGHT_LLM_PROBE_FOLLOWER_WAIT_MS,
        );
        const pollIntervalMs = Math.max(
          10,
          options.sharedPollIntervalMs ?? OPEN_WEIGHT_LLM_PROBE_FOLLOWER_POLL_MS,
        );
        const deadline = Date.now() + waitBudgetMs;

        while (Date.now() < deadline) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, pollIntervalMs);
            timer.unref();
          });

          try {
            const sharedHit = await readSharedCachedProbe(now());
            if (sharedHit) {
              cachedProbe = sharedHit;
              return OpenWeightLlmRuntimeProbeSchema.parse({
                ...sharedHit.value,
                cache: 'fresh',
              });
            }

            const stillRunning = await withRedisTimeout(
              getRedis().exists(OPEN_WEIGHT_LLM_PROBE_SHARED_INFLIGHT_KEY),
            );
            if (stillRunning === 0) {
              lease = await withRedisTimeout(
                acquireRedisLease(
                  OPEN_WEIGHT_LLM_PROBE_SHARED_INFLIGHT_KEY,
                  OPEN_WEIGHT_LLM_PROBE_INFLIGHT_TTL_MS,
                ),
              );
              if (lease) break;
            }
          } catch {
            // Redis nicht mehr lesbar -> Follower gibt transientes busy ohne 5-Min-Cache zurück
            break;
          }
        }

        if (!lease) {
          // Bewusst NICHT in cachedProbe schreiben, damit das echte Leader-Ergebnis
          // sofort beim nächsten Aufruf aus llm:probe:cache:v1 übernommen wird.
          return inProgressProbe(new Date(now()).toISOString());
        }
      }

      if (lease) {
        const activeLease = lease;
        const refreshTimer = setInterval(() => {
          void activeLease.refresh().catch(() => undefined);
        }, OPEN_WEIGHT_LLM_PROBE_INFLIGHT_REFRESH_MS);
        refreshTimer.unref();
        try {
          if (beforeLive) {
            await beforeLive();
          }
          const value = await measureProbe(options);
          const entry: CachedProbeEntry = {
            value,
            expiresAt: now() + OPEN_WEIGHT_LLM_PROBE_CACHE_TTL_MS,
          };
          cachedProbe = entry;
          await writeSharedCachedProbe(entry, now()).catch(() => undefined);
          return value;
        } finally {
          clearInterval(refreshTimer);
          await activeLease.release().catch(() => undefined);
        }
      }
    }

    if (beforeLive) {
      await beforeLive();
    }
    const value = await measureProbe(options);
    cachedProbe = { value, expiresAt: now() + OPEN_WEIGHT_LLM_PROBE_CACHE_TTL_MS };
    return value;
  })().finally(() => {
    probeInFlight = null;
  });

  return probeInFlight;
}
