/**
 * Kill-Switch und Betriebsgrenzen der optionalen Q&A-NLP-Kaskade (Story 8.9b / ADR-0032).
 *
 * Getrennt von `NLP_ENABLED` (spaCy-Wortwolke, Story 1.14b). Produktiv nur exakt
 * `true` schaltet den Pfad ein; ohne Modellartefakt bleibt der Worker ein Stub.
 */
export const QA_NLP_TIMEOUT_DEFAULT_MS = 2_000;
export const QA_NLP_TIMEOUT_MIN_MS = 200;
export const QA_NLP_TIMEOUT_MAX_MS = 15_000;
export const QA_NLP_QUEUE_LIMIT_DEFAULT = 100;
export const QA_NLP_QUEUE_LIMIT_MIN = 1;
export const QA_NLP_QUEUE_LIMIT_MAX = 1_000;
export const QA_NLP_CONCURRENCY_DEFAULT = 1;
export const QA_NLP_CONCURRENCY_MIN = 1;
export const QA_NLP_CONCURRENCY_MAX = 4;
export const QA_NLP_STUB_MODEL_VERSION = 'stub';

export interface QaNlpConfig {
  readonly enabled: boolean;
  readonly timeoutMs: number;
  readonly queueLimit: number;
  readonly concurrency: number;
}

export function isQaNlpEnabled(value = process.env['QA_NLP_ENABLED']): boolean {
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

export function resolveQaNlpTimeoutMs(configuredValue = process.env['QA_NLP_TIMEOUT_MS']): number {
  return parseBoundedInt(
    'QA_NLP_TIMEOUT_MS',
    configuredValue,
    QA_NLP_TIMEOUT_DEFAULT_MS,
    QA_NLP_TIMEOUT_MIN_MS,
    QA_NLP_TIMEOUT_MAX_MS,
  );
}

export function resolveQaNlpQueueLimit(
  configuredValue = process.env['QA_NLP_QUEUE_LIMIT'],
): number {
  return parseBoundedInt(
    'QA_NLP_QUEUE_LIMIT',
    configuredValue,
    QA_NLP_QUEUE_LIMIT_DEFAULT,
    QA_NLP_QUEUE_LIMIT_MIN,
    QA_NLP_QUEUE_LIMIT_MAX,
  );
}

export function resolveQaNlpConcurrency(
  configuredValue = process.env['QA_NLP_CONCURRENCY'],
): number {
  return parseBoundedInt(
    'QA_NLP_CONCURRENCY',
    configuredValue,
    QA_NLP_CONCURRENCY_DEFAULT,
    QA_NLP_CONCURRENCY_MIN,
    QA_NLP_CONCURRENCY_MAX,
  );
}

export function resolveQaNlpConfig(env: NodeJS.ProcessEnv = process.env): QaNlpConfig {
  return {
    enabled: isQaNlpEnabled(env['QA_NLP_ENABLED']),
    timeoutMs: resolveQaNlpTimeoutMs(env['QA_NLP_TIMEOUT_MS']),
    queueLimit: resolveQaNlpQueueLimit(env['QA_NLP_QUEUE_LIMIT']),
    concurrency: resolveQaNlpConcurrency(env['QA_NLP_CONCURRENCY']),
  };
}
