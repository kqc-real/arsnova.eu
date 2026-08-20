/**
 * Kill-Switch und Betriebsgrenzen des optionalen Word-Cloud-Encoders
 * (Story 1.14c Stufe 1).
 *
 * Getrennt von `NLP_ENABLED` (1.14b), `QA_NLP_ENABLED` (8.9b) und
 * `QA_SUMMARY_ENABLED` / `QA_SUMMARY_INFERENCE_URL` (8.9c).
 * Produktiv nur exakt `true` aktiviert den Q&A-Themenpfad.
 * Ohne privaten Socket oder private URL gibt es keinen SaaS-Fallback.
 */
export const WORD_CLOUD_ENCODER_TIMEOUT_DEFAULT_MS = 8_000;
export const WORD_CLOUD_ENCODER_TIMEOUT_MIN_MS = 500;
export const WORD_CLOUD_ENCODER_TIMEOUT_MAX_MS = 30_000;
export const WORD_CLOUD_ENCODER_CACHE_TTL_DEFAULT_SECONDS = 1_800;
export const WORD_CLOUD_ENCODER_CACHE_TTL_MIN_SECONDS = 60;
export const WORD_CLOUD_ENCODER_CACHE_TTL_MAX_SECONDS = 28_800;
export const WORD_CLOUD_ENCODER_DEFAULT_SOCKET_PATH = '/run/wordcloud-encoder/encoder.sock';
export const WORD_CLOUD_ENCODER_CIRCUIT_FAILURE_THRESHOLD = 3;
export const WORD_CLOUD_ENCODER_CIRCUIT_OPEN_MS = 30_000;

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

export interface WordCloudSemanticConfig {
  readonly enabled: boolean;
  readonly socketPath: string;
  readonly inferenceUrl: string | null;
  readonly inferenceToken: string | null;
  readonly timeoutMs: number;
  readonly cacheTtlSeconds: number;
}

export function isWordCloudSemanticEnabled(
  value = process.env['WORD_CLOUD_SEMANTIC_ENABLED'],
): boolean {
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

export function isBlockedWordCloudEncoderHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.+$/, '');
  if (BLOCKED_SAAS_HOSTS.has(host)) {
    return true;
  }
  return host.endsWith('.openai.azure.com');
}

export function resolveWordCloudEncoderSocketPath(
  configuredValue = process.env['WORD_CLOUD_ENCODER_SOCKET_PATH'],
): string {
  const value = configuredValue?.trim();
  return value || WORD_CLOUD_ENCODER_DEFAULT_SOCKET_PATH;
}

export function resolveWordCloudEncoderUrl(
  configuredValue = process.env['WORD_CLOUD_ENCODER_URL'],
): string | null {
  const value = configuredValue?.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('WORD_CLOUD_ENCODER_URL ist keine gültige URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('WORD_CLOUD_ENCODER_URL muss http oder https verwenden');
  }
  if (parsed.username || parsed.password) {
    throw new Error('WORD_CLOUD_ENCODER_URL darf keine Credentials in der URL enthalten');
  }
  if (!parsed.hostname) {
    throw new Error('WORD_CLOUD_ENCODER_URL braucht einen Hostnamen');
  }
  if (isBlockedWordCloudEncoderHost(parsed.hostname)) {
    throw new Error('WORD_CLOUD_ENCODER_URL darf keine öffentlichen SaaS-LLM-Endpunkte verwenden');
  }
  return parsed.toString();
}

export function resolveWordCloudEncoderToken(
  configuredValue = process.env['WORD_CLOUD_ENCODER_TOKEN'],
): string | null {
  const value = configuredValue?.trim();
  return value ? value : null;
}

export function resolveWordCloudEncoderTimeoutMs(
  configuredValue = process.env['WORD_CLOUD_ENCODER_TIMEOUT_MS'],
): number {
  return parseBoundedInt(
    'WORD_CLOUD_ENCODER_TIMEOUT_MS',
    configuredValue,
    WORD_CLOUD_ENCODER_TIMEOUT_DEFAULT_MS,
    WORD_CLOUD_ENCODER_TIMEOUT_MIN_MS,
    WORD_CLOUD_ENCODER_TIMEOUT_MAX_MS,
  );
}

export function resolveWordCloudEncoderCacheTtlSeconds(
  configuredValue = process.env['WORD_CLOUD_ENCODER_CACHE_TTL_SECONDS'],
): number {
  return parseBoundedInt(
    'WORD_CLOUD_ENCODER_CACHE_TTL_SECONDS',
    configuredValue,
    WORD_CLOUD_ENCODER_CACHE_TTL_DEFAULT_SECONDS,
    WORD_CLOUD_ENCODER_CACHE_TTL_MIN_SECONDS,
    WORD_CLOUD_ENCODER_CACHE_TTL_MAX_SECONDS,
  );
}

export function resolveWordCloudSemanticConfig(
  env: NodeJS.ProcessEnv = process.env,
): WordCloudSemanticConfig {
  let inferenceUrl: string | null;
  try {
    inferenceUrl = resolveWordCloudEncoderUrl(env['WORD_CLOUD_ENCODER_URL']);
  } catch {
    inferenceUrl = null;
  }
  return {
    enabled: isWordCloudSemanticEnabled(env['WORD_CLOUD_SEMANTIC_ENABLED']),
    socketPath: resolveWordCloudEncoderSocketPath(env['WORD_CLOUD_ENCODER_SOCKET_PATH']),
    inferenceUrl,
    inferenceToken: resolveWordCloudEncoderToken(env['WORD_CLOUD_ENCODER_TOKEN']),
    timeoutMs: resolveWordCloudEncoderTimeoutMs(env['WORD_CLOUD_ENCODER_TIMEOUT_MS']),
    cacheTtlSeconds: resolveWordCloudEncoderCacheTtlSeconds(
      env['WORD_CLOUD_ENCODER_CACHE_TTL_SECONDS'],
    ),
  };
}

export function isWordCloudEncoderConfigured(config: WordCloudSemanticConfig): boolean {
  return Boolean(config.inferenceUrl || config.socketPath);
}
