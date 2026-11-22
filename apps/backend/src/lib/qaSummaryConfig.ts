/**
 * Kill-Switch und Betriebsgrenzen der optionalen Moderationszusammenfassung
 * (Story 8.9c / ADR-0032).
 *
 * Getrennt von `QA_NLP_ENABLED` (8.9b) und `NLP_ENABLED` (spaCy 1.14b).
 * Produktiv nur exakt `true` schaltet den Host-Button und die Queue ein.
 * Ohne private `QA_SUMMARY_INFERENCE_URL` gibt es keinen Cloud-Fallback.
 */
import { QA_SUMMARY_MIN_VISIBLE_QUESTIONS } from '@arsnova/shared-types';
import {
  isOpenWeightLlmEnabled,
  resolveOpenWeightLlmConfig,
  resolveOpenWeightLlmSummaryTimeoutMs,
} from './openWeightLlmConfig';

/**
 * Queue wall-clock around the private open-weight summary call.
 * Must cover CPU prefill for the 8k packing profile; the old 8s/30s Gemini-era
 * ceiling forced extractive fallback before llama.cpp could answer.
 * When the Open-Weight full-context path is active, the effective budget is
 * max(QA_SUMMARY_TIMEOUT_MS, OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS).
 */
export const QA_SUMMARY_TIMEOUT_DEFAULT_MS = 90_000;
export const QA_SUMMARY_TIMEOUT_MIN_MS = 500;
export const QA_SUMMARY_TIMEOUT_MAX_MS = 300_000;
export const QA_SUMMARY_QUEUE_LIMIT_DEFAULT = 8;
export const QA_SUMMARY_QUEUE_LIMIT_MIN = 1;
export const QA_SUMMARY_QUEUE_LIMIT_MAX = 32;
export const QA_SUMMARY_CONCURRENCY_DEFAULT = 1;
export const QA_SUMMARY_CONCURRENCY_MIN = 1;
export const QA_SUMMARY_CONCURRENCY_MAX = 2;
export const QA_SUMMARY_COOLDOWN_DEFAULT_MS = 30_000;
export const QA_SUMMARY_COOLDOWN_MIN_MS = 5_000;
export const QA_SUMMARY_COOLDOWN_MAX_MS = 120_000;
export const QA_SUMMARY_TTL_DEFAULT_MS = 1_800_000;
export const QA_SUMMARY_TTL_MIN_MS = 60_000;
export const QA_SUMMARY_TTL_MAX_MS = 28_800_000;
export const QA_SUMMARY_MAX_SOURCES_DEFAULT = 20;
export const QA_SUMMARY_MAX_SOURCES_MIN = QA_SUMMARY_MIN_VISIBLE_QUESTIONS;
export const QA_SUMMARY_MAX_SOURCES_MAX = 40;
export const QA_SUMMARY_STUB_MODEL_VERSION = 'stub';

const BLOCKED_SAAS_HOSTS = new Set([
  'api.openai.com',
  'chatgpt.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.cohere.com',
  'api.cohere.ai',
  'api.mistral.ai',
  'api.groq.com',
  'api.together.xyz',
  'openrouter.ai',
  'api.fireworks.ai',
  'api.deepseek.com',
]);

export interface QaSummaryConfig {
  readonly enabled: boolean;
  readonly timeoutMs: number;
  readonly queueLimit: number;
  readonly concurrency: number;
  readonly cooldownMs: number;
  readonly ttlMs: number;
  readonly maxSources: number;
  readonly inferenceUrl: string | null;
  readonly inferenceToken: string | null;
}

export function isQaSummaryEnabled(value = process.env['QA_SUMMARY_ENABLED']): boolean {
  return value === 'true';
}

function parseBoundedInt(
  name: string,
  configuredValue: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = configuredValue?.trim();
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} muss eine ganze Zahl sein`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} muss zwischen ${min} und ${max} liegen`);
  }
  return parsed;
}

export function isBlockedQaSummaryInferenceHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.+$/, '');
  if (BLOCKED_SAAS_HOSTS.has(host)) {
    return true;
  }
  return host.endsWith('.openai.azure.com');
}

export function resolveQaSummaryInferenceUrl(
  configuredValue = process.env['QA_SUMMARY_INFERENCE_URL'],
): string | null {
  const value = configuredValue?.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('QA_SUMMARY_INFERENCE_URL ist keine gültige URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('QA_SUMMARY_INFERENCE_URL muss http oder https verwenden');
  }
  if (parsed.username || parsed.password) {
    throw new Error('QA_SUMMARY_INFERENCE_URL darf keine Credentials in der URL enthalten');
  }
  if (!parsed.hostname) {
    throw new Error('QA_SUMMARY_INFERENCE_URL braucht einen Hostnamen');
  }
  if (isBlockedQaSummaryInferenceHost(parsed.hostname)) {
    throw new Error(
      'QA_SUMMARY_INFERENCE_URL darf keine öffentlichen SaaS-LLM-Endpunkte verwenden',
    );
  }
  return parsed.toString();
}

export function resolveQaSummaryInferenceToken(
  configuredValue = process.env['QA_SUMMARY_INFERENCE_TOKEN'],
): string | null {
  const value = configuredValue?.trim();
  return value ? value : null;
}

export function resolveQaSummaryTimeoutMs(
  configuredValue = process.env['QA_SUMMARY_TIMEOUT_MS'],
): number {
  return parseBoundedInt(
    'QA_SUMMARY_TIMEOUT_MS',
    configuredValue,
    QA_SUMMARY_TIMEOUT_DEFAULT_MS,
    QA_SUMMARY_TIMEOUT_MIN_MS,
    QA_SUMMARY_TIMEOUT_MAX_MS,
  );
}

/** true nur bei aktivem, transportfähigem Open-Weight-Full-Context (nicht Legacy). */
function isOpenWeightFullContextPathActive(env: NodeJS.ProcessEnv): boolean {
  if (!isOpenWeightLlmEnabled(env['OPEN_WEIGHT_LLM_ENABLED'])) {
    return false;
  }
  try {
    const config = resolveOpenWeightLlmConfig(env);
    return config.transport !== null && config.token !== null;
  } catch {
    return false;
  }
}

/**
 * Effektives Queue-Wall-Clock. Anhebung auf den Open-Weight-Summary-Timeout nur,
 * wenn der Full-Context-Pfad wirklich aktiv ist — sonst behält
 * `QA_SUMMARY_TIMEOUT_MS` seine dokumentierte Wirkung (Legacy/disabled).
 */
export function resolveEffectiveQaSummaryTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const queueTimeoutMs = resolveQaSummaryTimeoutMs(env['QA_SUMMARY_TIMEOUT_MS']);
  if (!isOpenWeightFullContextPathActive(env)) {
    return queueTimeoutMs;
  }
  let openWeightTimeoutMs = queueTimeoutMs;
  try {
    openWeightTimeoutMs = resolveOpenWeightLlmSummaryTimeoutMs(
      env['OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS'],
    );
  } catch {
    // Ungültiges Open-Weight-Timeout bleibt Client-Sache; Queue nutzt den eigenen Wert.
  }
  return Math.min(QA_SUMMARY_TIMEOUT_MAX_MS, Math.max(queueTimeoutMs, openWeightTimeoutMs));
}

export function resolveQaSummaryQueueLimit(
  configuredValue = process.env['QA_SUMMARY_QUEUE_LIMIT'],
): number {
  return parseBoundedInt(
    'QA_SUMMARY_QUEUE_LIMIT',
    configuredValue,
    QA_SUMMARY_QUEUE_LIMIT_DEFAULT,
    QA_SUMMARY_QUEUE_LIMIT_MIN,
    QA_SUMMARY_QUEUE_LIMIT_MAX,
  );
}

export function resolveQaSummaryConcurrency(
  configuredValue = process.env['QA_SUMMARY_CONCURRENCY'],
): number {
  return parseBoundedInt(
    'QA_SUMMARY_CONCURRENCY',
    configuredValue,
    QA_SUMMARY_CONCURRENCY_DEFAULT,
    QA_SUMMARY_CONCURRENCY_MIN,
    QA_SUMMARY_CONCURRENCY_MAX,
  );
}

export function resolveQaSummaryCooldownMs(
  configuredValue = process.env['QA_SUMMARY_COOLDOWN_MS'],
): number {
  return parseBoundedInt(
    'QA_SUMMARY_COOLDOWN_MS',
    configuredValue,
    QA_SUMMARY_COOLDOWN_DEFAULT_MS,
    QA_SUMMARY_COOLDOWN_MIN_MS,
    QA_SUMMARY_COOLDOWN_MAX_MS,
  );
}

export function resolveQaSummaryTtlMs(configuredValue = process.env['QA_SUMMARY_TTL_MS']): number {
  return parseBoundedInt(
    'QA_SUMMARY_TTL_MS',
    configuredValue,
    QA_SUMMARY_TTL_DEFAULT_MS,
    QA_SUMMARY_TTL_MIN_MS,
    QA_SUMMARY_TTL_MAX_MS,
  );
}

export function resolveQaSummaryMaxSources(
  configuredValue = process.env['QA_SUMMARY_MAX_SOURCES'],
): number {
  return parseBoundedInt(
    'QA_SUMMARY_MAX_SOURCES',
    configuredValue,
    QA_SUMMARY_MAX_SOURCES_DEFAULT,
    QA_SUMMARY_MAX_SOURCES_MIN,
    QA_SUMMARY_MAX_SOURCES_MAX,
  );
}

export function resolveQaSummaryConfig(env: NodeJS.ProcessEnv = process.env): QaSummaryConfig {
  let inferenceUrl: string | null;
  try {
    inferenceUrl = resolveQaSummaryInferenceUrl(env['QA_SUMMARY_INFERENCE_URL']);
  } catch {
    inferenceUrl = null;
  }
  return {
    enabled: isQaSummaryEnabled(env['QA_SUMMARY_ENABLED']),
    timeoutMs: resolveEffectiveQaSummaryTimeoutMs(env),
    queueLimit: resolveQaSummaryQueueLimit(env['QA_SUMMARY_QUEUE_LIMIT']),
    concurrency: resolveQaSummaryConcurrency(env['QA_SUMMARY_CONCURRENCY']),
    cooldownMs: resolveQaSummaryCooldownMs(env['QA_SUMMARY_COOLDOWN_MS']),
    ttlMs: resolveQaSummaryTtlMs(env['QA_SUMMARY_TTL_MS']),
    maxSources: resolveQaSummaryMaxSources(env['QA_SUMMARY_MAX_SOURCES']),
    inferenceUrl,
    inferenceToken: resolveQaSummaryInferenceToken(env['QA_SUMMARY_INFERENCE_TOKEN']),
  };
}

function normalizeRedisInstanceEndpoint(url: URL): string {
  const defaultPort = url.protocol === 'rediss:' ? '6380' : '6379';
  return `${url.hostname.trim().toLowerCase()}:${url.port || defaultPort}`;
}

/**
 * Verhindert im Replikabetrieb (`SESSION_STATUS_PUBSUB_ENABLED=true`), dass eine
 * aktivierte Q&A-Moderationszusammenfassung still auf den prozesslokalen
 * In-Memory-Store zurückfällt oder das persistente Haupt-Redis (`REDIS_URL`) mitnutzt.
 */
export function assertQaSummaryReplicaStateConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (env['SESSION_STATUS_PUBSUB_ENABLED'] !== 'true') return;
  if (!isQaSummaryEnabled(env['QA_SUMMARY_ENABLED'])) return;

  const rawStateUrl = env['QA_SUMMARY_STATE_REDIS_URL']?.trim();
  if (!rawStateUrl) {
    throw new Error(
      'QA_SUMMARY_STATE_REDIS_URL ist erforderlich, wenn QA_SUMMARY_ENABLED im Replikabetrieb aktiv ist',
    );
  }

  let stateUrl: URL;
  try {
    stateUrl = new URL(rawStateUrl);
  } catch {
    throw new Error('QA_SUMMARY_STATE_REDIS_URL ist keine gültige Redis-URL');
  }
  if (stateUrl.protocol !== 'redis:' && stateUrl.protocol !== 'rediss:') {
    throw new Error('QA_SUMMARY_STATE_REDIS_URL muss redis:// oder rediss:// verwenden');
  }
  if (!stateUrl.hostname) {
    throw new Error('QA_SUMMARY_STATE_REDIS_URL braucht einen Hostnamen');
  }

  const rawMainUrl = env['REDIS_URL']?.trim();
  if (rawMainUrl) {
    try {
      const mainUrl = new URL(rawMainUrl);
      if (
        (mainUrl.protocol === 'redis:' || mainUrl.protocol === 'rediss:') &&
        normalizeRedisInstanceEndpoint(mainUrl) === normalizeRedisInstanceEndpoint(stateUrl)
      ) {
        throw new Error(
          'QA_SUMMARY_STATE_REDIS_URL muss auf eine eigene flüchtige Redis-Instanz getrennt von REDIS_URL zeigen',
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('QA_SUMMARY_STATE_REDIS_URL')) {
        throw error;
      }
    }
  }
}
