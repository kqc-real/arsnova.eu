import { getRedis } from '../redis';
import { logger } from './logger';

const BUCKET_SECONDS = 10;
const WINDOW_SECONDS = 60;
const WINDOW_BUCKETS = WINDOW_SECONDS / BUCKET_SECONDS;
const BUCKET_TTL_SECONDS = WINDOW_SECONDS * 2;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_COUNTER_VALUE = Number.MAX_SAFE_INTEGER;
const EPOCH_KEY = 'slo:metric:epoch';
const EPOCH_TTL_SECONDS = 86_400;
/** Minimale Stichprobe für belastbare p95/p99-Aussagen im öffentlichen Betriebsbild. */
export const LATENCY_MIN_SAMPLES = 20;

export const LATENCY_BUCKETS_MS = [
  100, 200, 300, 500, 800, 1000, 1500, 2000, 3000, 5000, 10000,
] as const;
const LATENCY_BUCKET_INF = 'inf';

/**
 * Feste Allowlist kontrollierter Gruppenamen — keine Sessioncodes, IDs oder Pfade.
 * Ops-/Statusabfragen sind bewusst leer und zählen nicht zum Kernaktions-RPS.
 */
export const CORE_ACTION_GROUPS = {
  sessionJoin: ['session.join'],
  quizFeedback: ['vote.submit', 'quickFeedback.vote'],
  qa: ['qa.list', 'qa.submit', 'qa.upvote', 'qa.vote'],
  presenter: [
    'session.startQa',
    'session.nextQuestion',
    'session.skipQuestion',
    'session.revealAnswers',
    'session.revealResults',
    'session.startDiscussion',
    'session.startSecondRound',
  ],
  /** Health-/Status-Polling und getInfo gehören nicht zum Kernaktions-RPS. */
  opsReporting: [] as readonly string[],
} as const;

export type CoreActionGroupId = keyof typeof CORE_ACTION_GROUPS;

export const CORE_ACTION_GROUP_IDS = Object.keys(CORE_ACTION_GROUPS) as CoreActionGroupId[];

const TRACKED_PROCEDURE_TO_GROUP = new Map<string, CoreActionGroupId>();
for (const groupId of CORE_ACTION_GROUP_IDS) {
  for (const path of CORE_ACTION_GROUPS[groupId]) {
    TRACKED_PROCEDURE_TO_GROUP.set(path, groupId);
  }
}

/** Alle definierten Kernaktionen (Allowlist); aktuell identisch mit überwachten. */
export const DEFINED_CORE_PROCEDURES = [...TRACKED_PROCEDURE_TO_GROUP.keys()] as const;

export type SloErrorClass = 'server' | 'rateLimit' | 'client';

export type SloMeasurementState = 'AVAILABLE' | 'WARMING_UP' | 'UNAVAILABLE';

export interface SloErrorClasses {
  server: number;
  rateLimit: number;
  client: number;
}

export interface SloGroupSample {
  id: CoreActionGroupId;
  requestsLastMinute: number;
}

/**
 * Aggregierte Kernaktions-SLO-Signale für das rollierende 60s-Fenster.
 * Latenzhistogramme enthalten erfolgreiche und fehlgeschlagene Requests (konsistent).
 */
export interface SloSignals {
  totalRequestsLastMinute: number;
  errorRatePercentLastMinute: number;
  p95LatencyMsLastMinute: number;
  p99LatencyMsLastMinute: number;
  /** false wenn Redis/Telemetrie nicht lesbar — Werte sind dann kein fachliches Null. */
  available: boolean;
  measurementState: SloMeasurementState;
  windowSeconds: typeof WINDOW_SECONDS;
  bucketSeconds: typeof BUCKET_SECONDS;
  observedWindowSeconds: number;
  windowComplete: boolean;
  avgRps: number | null;
  peakRps: number | null;
  errorClasses: SloErrorClasses;
  /** true: fehlgeschlagene Requests gehen in die Latenzverteilung ein. */
  latencyIncludesFailedRequests: true;
  insufficientLatencySample: boolean;
  monitoredProcedures: number;
  definedProcedures: number;
  groups: SloGroupSample[];
  lastSuccessfulReadAt: string | null;
}

type PendingBucket = {
  total: number;
  errorServer: number;
  errorRateLimit: number;
  errorClient: number;
  latency: Map<string, number>;
  groups: Map<CoreActionGroupId, number>;
};

let recordWarned = false;
let readWarned = false;
let flushTimer: NodeJS.Timeout | null = null;
let flushInFlight: Promise<void> | null = null;
let stopping = false;
const pendingBuckets = new Map<number, PendingBucket>();

export function isTrackedLiveProcedure(path: string): boolean {
  return TRACKED_PROCEDURE_TO_GROUP.has(path);
}

export function coreActionGroupForProcedure(path: string): CoreActionGroupId | undefined {
  return TRACKED_PROCEDURE_TO_GROUP.get(path);
}

export function classifySloErrorCode(errorCode: string | undefined): SloErrorClass | null {
  if (!errorCode) return null;
  if (errorCode === 'INTERNAL_SERVER_ERROR' || errorCode === 'TIMEOUT') return 'server';
  if (errorCode === 'TOO_MANY_REQUESTS') return 'rateLimit';
  if (
    errorCode === 'BAD_REQUEST' ||
    errorCode === 'UNAUTHORIZED' ||
    errorCode === 'FORBIDDEN' ||
    errorCode === 'NOT_FOUND' ||
    errorCode === 'CONFLICT' ||
    errorCode === 'PRECONDITION_FAILED' ||
    errorCode === 'PAYLOAD_TOO_LARGE' ||
    errorCode === 'METHOD_NOT_SUPPORTED' ||
    errorCode === 'CLIENT_CLOSED_REQUEST' ||
    errorCode === 'PARSE_ERROR'
  ) {
    return 'client';
  }
  // Unbekannte Codes konservativ als Serverfehler (Gesundheitsverschlechterung).
  return 'server';
}

/** Nur Server- und Überlastungsfehler verschlechtern den öffentlichen Gesundheitszustand. */
export function isHealthAffectingErrorClass(errorClass: SloErrorClass | null): boolean {
  return errorClass === 'server' || errorClass === 'rateLimit';
}

function currentBucket(nowMs: number): number {
  return Math.floor(nowMs / (BUCKET_SECONDS * 1000));
}

function latencyBucketLabel(durationMs: number): string {
  for (const upperBound of LATENCY_BUCKETS_MS) {
    if (durationMs <= upperBound) return String(upperBound);
  }
  return LATENCY_BUCKET_INF;
}

function totalKey(bucket: number): string {
  return `slo:metric:total:${bucket}`;
}

function errorClassKey(bucket: number, errorClass: SloErrorClass): string {
  return `slo:metric:error:${errorClass}:${bucket}`;
}

/** Legacy-Gesamtfehler (Server+RateLimit) für Abwärtskompatibilität mit älteren Buckets. */
function legacyErrorKey(bucket: number): string {
  return `slo:metric:error:${bucket}`;
}

function latencyKey(bucket: number, label: string): string {
  return `slo:metric:latency:${bucket}:${label}`;
}

function groupKey(bucket: number, groupId: CoreActionGroupId): string {
  return `slo:metric:group:${groupId}:${bucket}`;
}

function parseRedisInteger(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function emptyPendingBucket(): PendingBucket {
  return {
    total: 0,
    errorServer: 0,
    errorRateLimit: 0,
    errorClient: 0,
    latency: new Map(),
    groups: new Map(),
  };
}

function ensurePendingBucket(bucket: number): PendingBucket {
  let pending = pendingBuckets.get(bucket);
  if (!pending) {
    if (pendingBuckets.size >= WINDOW_BUCKETS) {
      pendingBuckets.delete(Math.min(...pendingBuckets.keys()));
    }
    pending = emptyPendingBucket();
    pendingBuckets.set(bucket, pending);
  }
  return pending;
}

function scheduleFlush(): void {
  if (
    stopping ||
    flushTimer ||
    flushInFlight ||
    pendingBuckets.size === 0 ||
    process.env['NODE_ENV'] === 'test'
  ) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushSloTelemetry();
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref();
}

function mergePendingBatch(batch: Array<{ bucket: number; pending: PendingBucket }>): void {
  for (const entry of batch) {
    const target = ensurePendingBucket(entry.bucket);
    target.total = Math.min(MAX_COUNTER_VALUE, target.total + entry.pending.total);
    target.errorServer = Math.min(
      MAX_COUNTER_VALUE,
      target.errorServer + entry.pending.errorServer,
    );
    target.errorRateLimit = Math.min(
      MAX_COUNTER_VALUE,
      target.errorRateLimit + entry.pending.errorRateLimit,
    );
    target.errorClient = Math.min(
      MAX_COUNTER_VALUE,
      target.errorClient + entry.pending.errorClient,
    );
    for (const [label, count] of entry.pending.latency) {
      target.latency.set(
        label,
        Math.min(MAX_COUNTER_VALUE, (target.latency.get(label) ?? 0) + count),
      );
    }
    for (const [groupId, count] of entry.pending.groups) {
      target.groups.set(
        groupId,
        Math.min(MAX_COUNTER_VALUE, (target.groups.get(groupId) ?? 0) + count),
      );
    }
  }
}

/**
 * Schreibt gebündelte Zähler/Histogramme in einer Redis-Pipeline.
 * Bei Fehlschlag: Batch zurück in pending (kein Doppelzählen bei Retry).
 */
export function flushSloTelemetry(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = Array.from(pendingBuckets, ([bucket, pending]) => ({
    bucket,
    pending: {
      total: pending.total,
      errorServer: pending.errorServer,
      errorRateLimit: pending.errorRateLimit,
      errorClient: pending.errorClient,
      latency: new Map(pending.latency),
      groups: new Map(pending.groups),
    },
  }));
  pendingBuckets.clear();
  if (batch.length === 0) return Promise.resolve();

  const request = (async () => {
    try {
      const redis = getRedis();
      const multi = redis.multi();
      multi.set(EPOCH_KEY, String(Date.now()), 'EX', EPOCH_TTL_SECONDS, 'NX');
      for (const entry of batch) {
        const { bucket, pending } = entry;
        if (pending.total > 0) {
          multi
            .incrby(totalKey(bucket), pending.total)
            .expire(totalKey(bucket), BUCKET_TTL_SECONDS);
        }
        if (pending.errorServer > 0) {
          multi
            .incrby(errorClassKey(bucket, 'server'), pending.errorServer)
            .expire(errorClassKey(bucket, 'server'), BUCKET_TTL_SECONDS);
          multi
            .incrby(legacyErrorKey(bucket), pending.errorServer)
            .expire(legacyErrorKey(bucket), BUCKET_TTL_SECONDS);
        }
        if (pending.errorRateLimit > 0) {
          multi
            .incrby(errorClassKey(bucket, 'rateLimit'), pending.errorRateLimit)
            .expire(errorClassKey(bucket, 'rateLimit'), BUCKET_TTL_SECONDS);
          multi
            .incrby(legacyErrorKey(bucket), pending.errorRateLimit)
            .expire(legacyErrorKey(bucket), BUCKET_TTL_SECONDS);
        }
        if (pending.errorClient > 0) {
          multi
            .incrby(errorClassKey(bucket, 'client'), pending.errorClient)
            .expire(errorClassKey(bucket, 'client'), BUCKET_TTL_SECONDS);
        }
        for (const [label, count] of pending.latency) {
          multi
            .incrby(latencyKey(bucket, label), count)
            .expire(latencyKey(bucket, label), BUCKET_TTL_SECONDS);
        }
        for (const [groupId, count] of pending.groups) {
          multi
            .incrby(groupKey(bucket, groupId), count)
            .expire(groupKey(bucket, groupId), BUCKET_TTL_SECONDS);
        }
      }
      await multi.exec();
    } catch (error) {
      mergePendingBatch(batch);
      if (!recordWarned) {
        recordWarned = true;
        logger.warn(
          'sloTelemetry.flush: Redis nicht erreichbar, SLO-Telemetrie-Batch wird erneut versucht.',
          error,
        );
      }
    }
  })();

  flushInFlight = request;
  void request.finally(() => {
    if (flushInFlight === request) {
      flushInFlight = null;
      scheduleFlush();
    }
  });
  return request;
}

/**
 * Erfasst eine überwachte Kernaktion im Arbeitsspeicher (kein synchroner Redis-Roundtrip).
 * Fehler der Telemetrie dürfen den fachlichen Request nicht fehlschlagen lassen.
 */
export async function recordLiveRequestTelemetry(input: {
  durationMs: number;
  errorCode?: string;
  groupId?: CoreActionGroupId;
  nowMs?: number;
}): Promise<void> {
  if (process.env['NODE_ENV'] === 'test' || stopping) return;
  const nowMs = input.nowMs ?? Date.now();
  const durationMs = Math.max(0, Math.round(input.durationMs));
  const bucket = currentBucket(nowMs);
  const bucketLabel = latencyBucketLabel(durationMs);
  const errorClass = classifySloErrorCode(input.errorCode);
  const groupId = input.groupId;

  try {
    const pending = ensurePendingBucket(bucket);
    pending.total = Math.min(MAX_COUNTER_VALUE, pending.total + 1);
    pending.latency.set(
      bucketLabel,
      Math.min(MAX_COUNTER_VALUE, (pending.latency.get(bucketLabel) ?? 0) + 1),
    );
    if (errorClass === 'server') {
      pending.errorServer = Math.min(MAX_COUNTER_VALUE, pending.errorServer + 1);
    } else if (errorClass === 'rateLimit') {
      pending.errorRateLimit = Math.min(MAX_COUNTER_VALUE, pending.errorRateLimit + 1);
    } else if (errorClass === 'client') {
      pending.errorClient = Math.min(MAX_COUNTER_VALUE, pending.errorClient + 1);
    }
    if (groupId) {
      pending.groups.set(
        groupId,
        Math.min(MAX_COUNTER_VALUE, (pending.groups.get(groupId) ?? 0) + 1),
      );
    }
    scheduleFlush();
  } catch (err) {
    if (!recordWarned) {
      recordWarned = true;
      logger.warn('sloTelemetry.record: Telemetrie konnte nicht erfasst werden.', err);
    }
  }
}

export function percentileFromHistogram(
  totalCount: number,
  countsByLabel: Map<string, number>,
  percentile: number,
): number {
  if (totalCount <= 0) return 0;
  const threshold = Math.ceil(totalCount * percentile);
  let cumulative = 0;
  for (const upperBound of LATENCY_BUCKETS_MS) {
    const label = String(upperBound);
    cumulative += countsByLabel.get(label) ?? 0;
    if (cumulative >= threshold) return upperBound;
  }
  return 12000;
}

function unavailableSignals(): SloSignals {
  return {
    totalRequestsLastMinute: 0,
    errorRatePercentLastMinute: 0,
    p95LatencyMsLastMinute: 0,
    p99LatencyMsLastMinute: 0,
    available: false,
    measurementState: 'UNAVAILABLE',
    windowSeconds: WINDOW_SECONDS,
    bucketSeconds: BUCKET_SECONDS,
    observedWindowSeconds: 0,
    windowComplete: false,
    avgRps: null,
    peakRps: null,
    errorClasses: { server: 0, rateLimit: 0, client: 0 },
    latencyIncludesFailedRequests: true,
    insufficientLatencySample: true,
    monitoredProcedures: DEFINED_CORE_PROCEDURES.length,
    definedProcedures: DEFINED_CORE_PROCEDURES.length,
    groups: CORE_ACTION_GROUP_IDS.map((id) => ({ id, requestsLastMinute: 0 })),
    lastSuccessfulReadAt: null,
  };
}

function deriveThroughput(params: {
  bucketTotals: number[];
  available: boolean;
  windowComplete: boolean;
  observedWindowSeconds: number;
}): { avgRps: number | null; peakRps: number | null; sampleSize: number } {
  const sampleSize = params.bucketTotals.reduce((sum, value) => sum + value, 0);
  if (!params.available) {
    return { avgRps: null, peakRps: null, sampleSize };
  }
  const observedSeconds = Math.max(1, params.observedWindowSeconds);
  const avgRps = sampleSize / observedSeconds;
  let peakRps = 0;
  for (const count of params.bucketTotals) {
    peakRps = Math.max(peakRps, count / BUCKET_SECONDS);
  }
  return { avgRps, peakRps, sampleSize };
}

export async function readSloSignals(nowMs: number = Date.now()): Promise<SloSignals> {
  if (process.env['NODE_ENV'] === 'test') {
    return {
      ...unavailableSignals(),
      available: true,
      measurementState: 'AVAILABLE',
      windowComplete: true,
      observedWindowSeconds: WINDOW_SECONDS,
      avgRps: 0,
      peakRps: 0,
      lastSuccessfulReadAt: new Date(nowMs).toISOString(),
    };
  }

  try {
    const redis = getRedis();
    const bucket = currentBucket(nowMs);
    const multi = redis.multi();
    const labels = [...LATENCY_BUCKETS_MS.map(String), LATENCY_BUCKET_INF];

    multi.get(EPOCH_KEY);
    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      const bucketId = bucket - offset;
      multi.get(totalKey(bucketId));
      multi.get(errorClassKey(bucketId, 'server'));
      multi.get(errorClassKey(bucketId, 'rateLimit'));
      multi.get(errorClassKey(bucketId, 'client'));
      multi.get(legacyErrorKey(bucketId));
      for (const label of labels) {
        multi.get(latencyKey(bucketId, label));
      }
      for (const groupId of CORE_ACTION_GROUP_IDS) {
        multi.get(groupKey(bucketId, groupId));
      }
    }

    const execResult = await multi.exec();
    if (!execResult) {
      return unavailableSignals();
    }

    let cursor = 0;
    const epochRaw = execResult[cursor++]?.[1];
    const epochMs = parseRedisInteger(epochRaw);
    const hasEpoch = epochMs > 0;
    const ageMs = hasEpoch ? Math.max(0, nowMs - epochMs) : WINDOW_SECONDS * 1000;
    const windowComplete = !hasEpoch || ageMs >= WINDOW_SECONDS * 1000;
    const observedWindowSeconds = !hasEpoch
      ? WINDOW_SECONDS
      : Math.min(
          WINDOW_SECONDS,
          Math.max(BUCKET_SECONDS, Math.ceil(ageMs / 1000) || BUCKET_SECONDS),
        );
    const measurementState: SloMeasurementState = windowComplete ? 'AVAILABLE' : 'WARMING_UP';

    const bucketTotals: number[] = [];
    let totalRequestsLastMinute = 0;
    let errorServer = 0;
    let errorRateLimit = 0;
    let errorClient = 0;
    const latencyCounts = new Map<string, number>();
    const groupTotals = new Map<CoreActionGroupId, number>(
      CORE_ACTION_GROUP_IDS.map((id) => [id, 0]),
    );

    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      const total = parseRedisInteger(execResult[cursor++]?.[1]);
      bucketTotals.push(total);
      totalRequestsLastMinute += total;

      const server = parseRedisInteger(execResult[cursor++]?.[1]);
      const rateLimit = parseRedisInteger(execResult[cursor++]?.[1]);
      const client = parseRedisInteger(execResult[cursor++]?.[1]);
      const legacyError = parseRedisInteger(execResult[cursor++]?.[1]);
      // Prefer klassifizierte Zähler; Legacy nur falls neue Keys noch leer sind.
      if (server + rateLimit > 0 || client > 0) {
        errorServer += server;
        errorRateLimit += rateLimit;
        errorClient += client;
      } else {
        errorServer += legacyError;
      }

      for (const label of labels) {
        const existing = latencyCounts.get(label) ?? 0;
        latencyCounts.set(label, existing + parseRedisInteger(execResult[cursor++]?.[1]));
      }
      for (const groupId of CORE_ACTION_GROUP_IDS) {
        groupTotals.set(
          groupId,
          (groupTotals.get(groupId) ?? 0) + parseRedisInteger(execResult[cursor++]?.[1]),
        );
      }
    }

    const healthErrors = errorServer + errorRateLimit;
    const errorRatePercentLastMinute =
      totalRequestsLastMinute > 0 ? (healthErrors / totalRequestsLastMinute) * 100 : 0;
    const insufficientLatencySample = totalRequestsLastMinute < LATENCY_MIN_SAMPLES;
    const { avgRps, peakRps } = deriveThroughput({
      bucketTotals,
      available: true,
      windowComplete,
      observedWindowSeconds,
    });

    return {
      totalRequestsLastMinute,
      errorRatePercentLastMinute,
      p95LatencyMsLastMinute: insufficientLatencySample
        ? 0
        : percentileFromHistogram(totalRequestsLastMinute, latencyCounts, 0.95),
      p99LatencyMsLastMinute: insufficientLatencySample
        ? 0
        : percentileFromHistogram(totalRequestsLastMinute, latencyCounts, 0.99),
      available: true,
      measurementState,
      windowSeconds: WINDOW_SECONDS,
      bucketSeconds: BUCKET_SECONDS,
      observedWindowSeconds,
      windowComplete,
      avgRps,
      peakRps,
      errorClasses: {
        server: errorServer,
        rateLimit: errorRateLimit,
        client: errorClient,
      },
      latencyIncludesFailedRequests: true,
      insufficientLatencySample,
      monitoredProcedures: DEFINED_CORE_PROCEDURES.length,
      definedProcedures: DEFINED_CORE_PROCEDURES.length,
      groups: CORE_ACTION_GROUP_IDS.map((id) => ({
        id,
        requestsLastMinute: groupTotals.get(id) ?? 0,
      })),
      lastSuccessfulReadAt: new Date(nowMs).toISOString(),
    };
  } catch (err) {
    if (!readWarned) {
      readWarned = true;
      logger.warn(
        'sloTelemetry.read: Redis nicht erreichbar, SLO-Signale werden als nicht verfügbar markiert.',
        err,
      );
    }
    return unavailableSignals();
  }
}

export async function stopSloTelemetry(timeoutMs = 1_000): Promise<void> {
  stopping = true;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const started = Date.now();
  if (flushInFlight) await flushInFlight;
  if (Date.now() - started < timeoutMs && pendingBuckets.size > 0) {
    await flushSloTelemetry();
  }
}

export function resetSloTelemetryForTests(): void {
  stopping = false;
  recordWarned = false;
  readWarned = false;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  flushInFlight = null;
  pendingBuckets.clear();
}

/** Test-/Diagnosehilfe: Throughput-Formeln ohne Redis. */
export function computeThroughputFromBuckets(
  bucketTotals: number[],
  observedWindowSeconds: number,
): { avgRps: number; peakRps: number; sampleSize: number } {
  const sampleSize = bucketTotals.reduce((sum, value) => sum + value, 0);
  const observedSeconds = Math.max(1, observedWindowSeconds);
  let peakRps = 0;
  for (const count of bucketTotals) {
    peakRps = Math.max(peakRps, count / BUCKET_SECONDS);
  }
  return {
    avgRps: sampleSize / observedSeconds,
    peakRps,
    sampleSize,
  };
}
