/**
 * Kill-Switch und Betriebsgrenzen der optionalen Moderationszusammenfassung
 * (Story 8.9c / ADR-0032).
 *
 * Getrennt von `QA_NLP_ENABLED` (8.9b) und `NLP_ENABLED` (spaCy 1.14b).
 * Produktiv nur exakt `true` schaltet den Host-Button und die Queue ein.
 * Ohne private `QA_SUMMARY_INFERENCE_URL` gibt es keinen Cloud-Fallback.
 */
export const QA_SUMMARY_TIMEOUT_DEFAULT_MS = 8_000;
export const QA_SUMMARY_TIMEOUT_MIN_MS = 500;
export const QA_SUMMARY_TIMEOUT_MAX_MS = 30_000;
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
export const QA_SUMMARY_MAX_SOURCES_MIN = 1;
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
    timeoutMs: resolveQaSummaryTimeoutMs(env['QA_SUMMARY_TIMEOUT_MS']),
    queueLimit: resolveQaSummaryQueueLimit(env['QA_SUMMARY_QUEUE_LIMIT']),
    concurrency: resolveQaSummaryConcurrency(env['QA_SUMMARY_CONCURRENCY']),
    cooldownMs: resolveQaSummaryCooldownMs(env['QA_SUMMARY_COOLDOWN_MS']),
    ttlMs: resolveQaSummaryTtlMs(env['QA_SUMMARY_TTL_MS']),
    maxSources: resolveQaSummaryMaxSources(env['QA_SUMMARY_MAX_SOURCES']),
    inferenceUrl,
    inferenceToken: resolveQaSummaryInferenceToken(env['QA_SUMMARY_INFERENCE_TOKEN']),
  };
}
