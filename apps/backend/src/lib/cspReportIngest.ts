import { createHmac, randomBytes } from 'node:crypto';
import express, { type ErrorRequestHandler, type Router } from 'express';
import { getRedis } from '../redis';

export const CSP_REPORT_MAX_BODY_BYTES = 32 * 1024;
const MAX_REPORTS_PER_REQUEST = 10;
const MAX_JSON_DEPTH = 8;
const MAX_JSON_STRING_TOKEN_BYTES = 2_048;
const MAX_RELEVANT_STRING_BYTES = 512;
const MAX_MINIMIZED_URL_BYTES = 256;
const MAX_DISTINCT_DIMENSIONS_PER_RETENTION = 256;
const BUCKET_SECONDS = 10;
const WINDOW_SECONDS = 60;
const DEFAULT_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const MAX_RETENTION_SECONDS = DEFAULT_RETENTION_SECONDS;
const STATIC_GLOBAL_MAX_PER_MINUTE = 6_000;
const STATIC_IP_MAX_PER_MINUTE = 120;

export type MinimizedCspReport = {
  effectiveDirective?: string;
  violatedDirective?: string;
  documentUri?: string;
  blockedUri?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  disposition?: 'enforce' | 'report';
  statusCode?: number;
};

export interface CspRedisClient {
  eval(script: string, keyCount: number, ...values: string[]): Promise<unknown>;
}

export type CspReportSignals = {
  receivedLastMinute: number;
  droppedLastMinute: number;
  rateLimitedLastMinute: number;
  evalLastMinute: number;
  scriptHttpsLastMinute: number;
};

type IngestResult =
  | { status: 'accepted' }
  | { status: 'dropped' }
  | { status: 'rate-limited'; retryAfterSeconds: number };

type IngestConfig = {
  globalPerMinute: number;
  ipPerMinute: number;
  fallbackGlobalPerMinute: number;
  retentionSeconds: number;
};

type CspReportIngestOptions = {
  redis?: CspRedisClient;
  hashSecret?: string;
  now?: () => number;
  config?: Partial<IngestConfig>;
};

const INGEST_SCRIPT = `
local globalLimit = tonumber(ARGV[1])
local ipLimit = tonumber(ARGV[2])
local retryAfter = tonumber(ARGV[3])
local retention = tonumber(ARGV[4])
local received = tonumber(ARGV[5])
local dropped = tonumber(ARGV[6])
local evalCount = tonumber(ARGV[7])
local scriptHttpsCount = tonumber(ARGV[8])
local telemetryBucket = ARGV[9]
local dimensionCount = tonumber(ARGV[10])

-- Sieben feste Telemetrie-Slots bilden 60 Sekunden plus Rand-Bucket ab.
if redis.call('HGET', KEYS[3], '_bucket') ~= telemetryBucket then
  redis.call('DEL', KEYS[3])
  redis.call('HSET', KEYS[3], '_bucket', telemetryBucket)
  redis.call('EXPIRE', KEYS[3], 120)
end

local globalCurrent = tonumber(redis.call('GET', KEYS[1])) or 0
if globalCurrent + 1 > globalLimit then
  redis.call('HINCRBY', KEYS[3], 'rateLimited', 1)
  return { 0, 1, retryAfter }
end

local ipCurrent = tonumber(redis.call('GET', KEYS[2])) or 0
if ipCurrent + 1 > ipLimit then
  redis.call('INCR', KEYS[1])
  redis.call('EXPIRE', KEYS[1], 120)
  redis.call('HINCRBY', KEYS[3], 'rateLimited', 1)
  return { 0, 2, retryAfter }
end

redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], 120)
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], 120)
redis.call('HINCRBY', KEYS[3], 'received', received)
redis.call('HINCRBY', KEYS[3], 'dropped', dropped)
redis.call('HINCRBY', KEYS[3], 'eval', evalCount)
redis.call('HINCRBY', KEYS[3], 'scriptHttps', scriptHttpsCount)

if dimensionCount > 0 then
  local membersExists = redis.call('EXISTS', KEYS[4])
  local countsExists = redis.call('EXISTS', KEYS[5])
  local membersTtl = redis.call('TTL', KEYS[4])
  local countsTtl = redis.call('TTL', KEYS[5])
  local newGeneration = membersExists == 0 or countsExists == 0
    or membersTtl < 1 or countsTtl < 1
    or membersTtl > retention or countsTtl > retention

  if newGeneration then
    redis.call('DEL', KEYS[4], KEYS[5])
  end

  for index = 1, dimensionCount do
    local digest = ARGV[10 + index]
    local known = redis.call('SISMEMBER', KEYS[4], digest)
    if known == 1 or redis.call('SCARD', KEYS[4]) < ${MAX_DISTINCT_DIMENSIONS_PER_RETENTION} then
      redis.call('SADD', KEYS[4], digest)
      redis.call('HINCRBY', KEYS[5], digest, 1)
    else
      redis.call('HINCRBY', KEYS[3], 'dropped', 1)
    end
  end

  -- Requests verlängern die Retention nicht. Erst die nächste Generation
  -- erhält nach vollständigem Ablauf wieder eine neue feste TTL.
  if newGeneration then
    redis.call('EXPIRE', KEYS[4], retention)
    redis.call('EXPIRE', KEYS[5], retention)
  end
end
return { 1, 0, 0 }
`;

function boundedPositiveInteger(value: unknown, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function defaultConfig(overrides?: Partial<IngestConfig>): IngestConfig {
  return {
    globalPerMinute: boundedPositiveInteger(
      overrides?.globalPerMinute ?? process.env['CSP_REPORT_GLOBAL_PER_MINUTE'],
      STATIC_GLOBAL_MAX_PER_MINUTE,
      STATIC_GLOBAL_MAX_PER_MINUTE,
    ),
    ipPerMinute: boundedPositiveInteger(
      overrides?.ipPerMinute ?? process.env['CSP_REPORT_PER_IP_PER_MINUTE'],
      STATIC_IP_MAX_PER_MINUTE,
      STATIC_IP_MAX_PER_MINUTE,
    ),
    fallbackGlobalPerMinute: boundedPositiveInteger(
      overrides?.fallbackGlobalPerMinute ?? process.env['CSP_REPORT_FALLBACK_GLOBAL_PER_MINUTE'],
      STATIC_GLOBAL_MAX_PER_MINUTE,
      STATIC_GLOBAL_MAX_PER_MINUTE,
    ),
    retentionSeconds: boundedPositiveInteger(
      overrides?.retentionSeconds ?? process.env['CSP_REPORT_RETENTION_SECONDS'],
      DEFAULT_RETENTION_SECONDS,
      MAX_RETENTION_SECONDS,
    ),
  };
}

function resolveHashSecret(explicit?: string): string {
  const candidates = [explicit, process.env['CSP_REPORT_HASH_SECRET'], process.env['JWT_SECRET']];
  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && Buffer.byteLength(candidate, 'utf8') >= 32,
    ) ?? randomBytes(32).toString('hex')
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function utf8Length(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function truncateUtf8(value: string, maximumBytes: number): string {
  if (utf8Length(value) <= maximumBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (utf8Length(value.slice(0, middle)) <= maximumBytes) low = middle;
    else high = middle - 1;
  }
  return value.slice(0, low);
}

/**
 * Prüft Tiefe und lexikalische Stringgröße vor JSON.parse. Der Scan ist linear,
 * arbeitet direkt auf dem bereits auf 32 KiB begrenzten Raw-Buffer und baut
 * keine attacker-kontrollierte Objektstruktur auf.
 */
function hasBoundedJsonShape(raw: unknown): boolean {
  if (!Buffer.isBuffer(raw)) return false;
  const containers: Array<{ kind: 'array' | 'object'; commas: number }> = [];
  let inString = false;
  let escaped = false;
  let stringStart = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const byte = raw[index]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (byte === 0x5c) {
        escaped = true;
      } else if (byte === 0x22) {
        if (index - stringStart > MAX_JSON_STRING_TOKEN_BYTES) return false;
        inString = false;
      }
      continue;
    }
    if (byte === 0x22) {
      inString = true;
      stringStart = index + 1;
    } else if (byte === 0x7b || byte === 0x5b) {
      containers.push({ kind: byte === 0x5b ? 'array' : 'object', commas: 0 });
      if (containers.length > MAX_JSON_DEPTH) return false;
    } else if (byte === 0x7d || byte === 0x5d) {
      const container = containers.pop();
      if (
        !container ||
        (byte === 0x7d && container.kind !== 'object') ||
        (byte === 0x5d && container.kind !== 'array')
      ) {
        return false;
      }
    } else if (byte === 0x2c && containers.at(-1)?.kind === 'array') {
      const container = containers.at(-1)!;
      container.commas += 1;
      if (container.commas >= MAX_REPORTS_PER_REQUEST) return false;
    }
  }
  return !inString && containers.length === 0;
}

function boundedString(value: unknown): string | undefined {
  if (typeof value !== 'string' || utf8Length(value) > MAX_RELEVANT_STRING_BYTES) {
    return undefined;
  }
  return value;
}

function boundedInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000_000
    ? Number(value)
    : undefined;
}

export function minimizeCspUrl(value: string): string {
  if (utf8Length(value) > MAX_RELEVANT_STRING_BYTES) return 'category:oversize';
  const lowered = value.trim().toLowerCase();
  if (['eval', 'inline', 'about', 'self', 'none'].includes(lowered)) {
    return `category:${lowered}`;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return `scheme:${truncateUtf8(url.protocol.slice(0, -1).toLowerCase(), 32)}`;
    }
    const minimized = `${url.protocol}//${url.host}${url.pathname}`;
    return truncateUtf8(minimized, MAX_MINIMIZED_URL_BYTES);
  } catch {
    return 'category:invalid';
  }
}

function minimizeReport(
  value: unknown,
  format: 'csp-report' | 'reporting-api',
): MinimizedCspReport | null {
  if (!isPlainObject(value)) return null;
  const fieldNames =
    format === 'csp-report'
      ? {
          effectiveDirective: 'effective-directive',
          violatedDirective: 'violated-directive',
          documentUri: 'document-uri',
          blockedUri: 'blocked-uri',
          sourceFile: 'source-file',
          lineNumber: 'line-number',
          columnNumber: 'column-number',
          statusCode: 'status-code',
        }
      : {
          effectiveDirective: 'effectiveDirective',
          violatedDirective: 'violatedDirective',
          documentUri: 'documentURL',
          blockedUri: 'blockedURL',
          sourceFile: 'sourceFile',
          lineNumber: 'lineNumber',
          columnNumber: 'columnNumber',
          statusCode: 'statusCode',
        };
  const effectiveDirective = boundedString(value[fieldNames.effectiveDirective]);
  const violatedDirective = boundedString(value[fieldNames.violatedDirective]);
  const documentUri = boundedString(value[fieldNames.documentUri]);
  const blockedUri = boundedString(value[fieldNames.blockedUri]);
  const sourceFile = boundedString(value[fieldNames.sourceFile]);
  const disposition =
    value['disposition'] === 'enforce' || value['disposition'] === 'report'
      ? value['disposition']
      : undefined;

  if (
    (value[fieldNames.effectiveDirective] !== undefined &&
      typeof value[fieldNames.effectiveDirective] !== 'string') ||
    (value[fieldNames.violatedDirective] !== undefined &&
      typeof value[fieldNames.violatedDirective] !== 'string') ||
    (value[fieldNames.documentUri] !== undefined &&
      typeof value[fieldNames.documentUri] !== 'string') ||
    (value[fieldNames.blockedUri] !== undefined &&
      typeof value[fieldNames.blockedUri] !== 'string') ||
    (value[fieldNames.sourceFile] !== undefined &&
      typeof value[fieldNames.sourceFile] !== 'string') ||
    (typeof value[fieldNames.effectiveDirective] === 'string' &&
      effectiveDirective === undefined) ||
    (typeof value[fieldNames.violatedDirective] === 'string' && violatedDirective === undefined) ||
    (typeof value[fieldNames.documentUri] === 'string' && documentUri === undefined) ||
    (typeof value[fieldNames.blockedUri] === 'string' && blockedUri === undefined) ||
    (typeof value[fieldNames.sourceFile] === 'string' && sourceFile === undefined)
  ) {
    return null;
  }
  const lineNumber = boundedInteger(value[fieldNames.lineNumber]);
  const columnNumber = boundedInteger(value[fieldNames.columnNumber]);
  const statusCode = boundedInteger(value[fieldNames.statusCode]);
  if (
    (value[fieldNames.lineNumber] !== undefined && lineNumber === undefined) ||
    (value[fieldNames.columnNumber] !== undefined && columnNumber === undefined) ||
    (value[fieldNames.statusCode] !== undefined && statusCode === undefined) ||
    (value['disposition'] !== undefined && disposition === undefined)
  ) {
    return null;
  }

  const report: MinimizedCspReport = {
    ...(effectiveDirective === undefined ? {} : { effectiveDirective }),
    ...(violatedDirective === undefined ? {} : { violatedDirective }),
    ...(documentUri === undefined ? {} : { documentUri: minimizeCspUrl(documentUri) }),
    ...(blockedUri === undefined ? {} : { blockedUri: minimizeCspUrl(blockedUri) }),
    ...(sourceFile === undefined ? {} : { sourceFile: minimizeCspUrl(sourceFile) }),
    ...(lineNumber === undefined ? {} : { lineNumber }),
    ...(columnNumber === undefined ? {} : { columnNumber }),
    ...(disposition === undefined ? {} : { disposition }),
    ...(statusCode === undefined ? {} : { statusCode }),
  };
  return Object.keys(report).length > 0 ? report : null;
}

export function parseCspReportPayload(raw: unknown): MinimizedCspReport[] | null {
  if (!Buffer.isBuffer(raw)) return null;
  if (raw.length === 0 || raw.length > CSP_REPORT_MAX_BODY_BYTES || !hasBoundedJsonShape(raw)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8')) as unknown;
  } catch {
    return null;
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0 || parsed.length > MAX_REPORTS_PER_REQUEST) return null;
    const reports: MinimizedCspReport[] = [];
    for (const envelope of parsed) {
      if (
        !isPlainObject(envelope) ||
        envelope['type'] !== 'csp-violation' ||
        !isPlainObject(envelope['body'])
      ) {
        return null;
      }
      const report = minimizeReport(envelope['body'], 'reporting-api');
      if (!report) return null;
      reports.push(report);
    }
    return reports;
  }

  if (!isPlainObject(parsed) || !isPlainObject(parsed['csp-report'])) return null;
  const report = minimizeReport(parsed['csp-report'], 'csp-report');
  return report ? [report] : null;
}

function contentTypeAccepted(header: string | undefined): boolean {
  if (!header) return false;
  const [mediaType, ...parameters] = header.split(';').map((part) => part.trim().toLowerCase());
  if (mediaType !== 'application/csp-report' && mediaType !== 'application/reports+json') {
    return false;
  }
  return parameters.length <= 1 && parameters.every((parameter) => parameter === 'charset=utf-8');
}

export class CspReportIngest {
  private readonly redis: CspRedisClient;
  private readonly hashSecret: string;
  private readonly now: () => number;
  private readonly config: IngestConfig;
  private fallbackWindow = -1;
  private fallbackCount = 0;
  private redisUnavailableUntilMs = 0;

  constructor(options: CspReportIngestOptions = {}) {
    this.redis = options.redis ?? getRedis();
    this.hashSecret = resolveHashSecret(options.hashSecret);
    this.now = options.now ?? Date.now;
    this.config = defaultConfig(options.config);
  }

  private digest(namespace: string, value: string): string {
    return createHmac('sha256', this.hashSecret)
      .update(namespace)
      .update('\0')
      .update(value)
      .digest('hex')
      .slice(0, 32);
  }

  private fallbackDrop(nowMs: number): IngestResult {
    const window = Math.floor(nowMs / (WINDOW_SECONDS * 1000));
    if (window !== this.fallbackWindow) {
      this.fallbackWindow = window;
      this.fallbackCount = 0;
    }
    if (this.fallbackCount < this.config.fallbackGlobalPerMinute) {
      this.fallbackCount += 1;
    } else {
      this.redisUnavailableUntilMs = Math.max(
        this.redisUnavailableUntilMs,
        (window + 1) * WINDOW_SECONDS * 1000,
      );
    }
    return { status: 'dropped' };
  }

  async ingestRaw(ip: string, raw: Buffer): Promise<IngestResult> {
    const nowMs = this.now();
    if (nowMs < this.redisUnavailableUntilMs) return this.fallbackDrop(nowMs);
    return this.ingest(ip, parseCspReportPayload(raw));
  }

  async ingest(ip: string, reports: MinimizedCspReport[] | null): Promise<IngestResult> {
    const nowMs = this.now();
    if (nowMs < this.redisUnavailableUntilMs) return this.fallbackDrop(nowMs);
    const minute = Math.floor(nowMs / (WINDOW_SECONDS * 1000));
    const bucket = Math.floor(nowMs / (BUCKET_SECONDS * 1000));
    const retryAfter = WINDOW_SECONDS - Math.floor((nowMs / 1000) % WINDOW_SECONDS);
    const safeIp = utf8Length(ip) <= 128 ? ip : 'invalid';
    const reportList = reports ?? [];
    const dimensions = reportList.map((report) => this.digest('dimension', JSON.stringify(report)));
    const evalCount = reportList.filter((report) => report.blockedUri === 'category:eval').length;
    const scriptHttpsCount = reportList.filter(isExternalHttpsScriptReport).length;

    try {
      const result = (await this.redis.eval(
        INGEST_SCRIPT,
        5,
        `csp:rl:global:${minute}`,
        `csp:rl:ip:${minute}:${this.digest('ip', safeIp)}`,
        `csp:telemetry:${bucket % (WINDOW_SECONDS / BUCKET_SECONDS + 1)}`,
        'csp:dimensions:members',
        'csp:dimensions:counts',
        String(this.config.globalPerMinute),
        String(this.config.ipPerMinute),
        String(Math.max(1, retryAfter)),
        String(this.config.retentionSeconds),
        '1',
        reports === null ? '1' : '0',
        String(evalCount),
        String(scriptHttpsCount),
        String(bucket),
        String(dimensions.length),
        ...dimensions,
      )) as unknown;
      if (!Array.isArray(result) || result.length < 3) return this.fallbackDrop(nowMs);
      if (Number(result[0]) === 1) return { status: 'accepted' };
      return {
        status: 'rate-limited',
        retryAfterSeconds: Math.max(1, Number(result[2]) || retryAfter),
      };
    } catch {
      this.redisUnavailableUntilMs = nowMs + 5_000;
      return this.fallbackDrop(nowMs);
    }
  }
}

function redisCounter(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function isExternalHttpsScriptReport(report: MinimizedCspReport): boolean {
  if (
    report.effectiveDirective?.startsWith('script-src') !== true ||
    report.blockedUri?.startsWith('https://') !== true ||
    report.documentUri?.startsWith('http') !== true
  ) {
    return false;
  }
  try {
    return new URL(report.blockedUri).origin !== new URL(report.documentUri).origin;
  } catch {
    return false;
  }
}

export async function readCspReportSignals(nowMs: number = Date.now()): Promise<CspReportSignals> {
  const empty: CspReportSignals = {
    receivedLastMinute: 0,
    droppedLastMinute: 0,
    rateLimitedLastMinute: 0,
    evalLastMinute: 0,
    scriptHttpsLastMinute: 0,
  };
  try {
    const currentBucket = Math.floor(nowMs / (BUCKET_SECONDS * 1000));
    const multi = getRedis().multi();
    for (let offset = 0; offset < WINDOW_SECONDS / BUCKET_SECONDS + 1; offset += 1) {
      multi.hgetall(
        `csp:telemetry:${(currentBucket - offset) % (WINDOW_SECONDS / BUCKET_SECONDS + 1)}`,
      );
    }
    const results = await multi.exec();
    if (!results) return empty;
    return results.reduce<CspReportSignals>((signals, entry, index) => {
      const counters =
        entry?.[0] === null && isPlainObject(entry[1]) ? (entry[1] as Record<string, unknown>) : {};
      if (counters['_bucket'] !== String(currentBucket - index)) return signals;
      signals.receivedLastMinute += redisCounter(counters['received']);
      signals.droppedLastMinute += redisCounter(counters['dropped']);
      signals.rateLimitedLastMinute += redisCounter(counters['rateLimited']);
      signals.evalLastMinute += redisCounter(counters['eval']);
      signals.scriptHttpsLastMinute += redisCounter(counters['scriptHttps']);
      return signals;
    }, empty);
  } catch {
    return empty;
  }
}

export function createCspReportRouter(options?: {
  ingest?: Pick<CspReportIngest, 'ingest'>;
}): Router {
  const router = express.Router();
  const defaultIngest = options?.ingest ? null : new CspReportIngest();

  router.use((req, res, next) => {
    if (req.url !== '/') {
      res.status(404).end();
      return;
    }
    if (req.method !== 'POST') {
      res.set('Allow', 'POST').status(405).end();
      return;
    }
    if (!contentTypeAccepted(req.headers['content-type'])) {
      res.status(415).end();
      return;
    }
    const contentEncoding = req.headers['content-encoding']?.trim().toLowerCase();
    if (contentEncoding && contentEncoding !== 'identity') {
      res.status(415).end();
      return;
    }
    next();
  });
  router.use(
    express.raw({
      type: () => true,
      limit: CSP_REPORT_MAX_BODY_BYTES,
      inflate: false,
    }),
  );
  router.use(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const result = options?.ingest
      ? await options.ingest.ingest(req.ip ?? 'unknown', parseCspReportPayload(raw))
      : await defaultIngest!.ingestRaw(req.ip ?? 'unknown', raw);
    if (result.status === 'rate-limited') {
      res.set('Retry-After', String(result.retryAfterSeconds)).status(429).end();
      return;
    }
    res.status(204).end();
  });
  const rawBodyErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      res.status(413).end();
      return;
    }
    res.status(204).end();
  };
  router.use(rawBodyErrorHandler);
  return router;
}
