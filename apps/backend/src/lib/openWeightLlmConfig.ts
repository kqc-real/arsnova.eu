import { BlockList, isIP } from 'node:net';

export const OPEN_WEIGHT_LLM_DEFAULT_SOCKET_PATH = '/run/open-weight-llm/llm.sock';
export const OPEN_WEIGHT_LLM_LABEL_TIMEOUT_DEFAULT_MS = 30_000;
export const OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_DEFAULT_MS = 90_000;
/**
 * Per-batch budget for learning-objective generation. A five-locale completion
 * is about 400–600 output tokens and about 25–35 seconds on 8 CPU cores.
 * 300 seconds stays above that so the JSON grammar is not cut off before `}`.
 */
export const OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_DEFAULT_MS = 300_000;
export const OPEN_WEIGHT_LLM_TIMEOUT_MIN_MS = 1_000;
export const OPEN_WEIGHT_LLM_TIMEOUT_MAX_MS = 300_000;
export const OPEN_WEIGHT_LLM_CIRCUIT_FAILURE_THRESHOLD = 3;
export const OPEN_WEIGHT_LLM_CIRCUIT_OPEN_MS = 30_000;
/** Persisted audit identity: canonical repository plus the verified GGUF digest. */
export const OPEN_WEIGHT_LLM_MODEL_ID =
  'unsloth/gemma-3-4b-it-qat-GGUF@sha256:6a9baaf400db52a6855d2a0a20a5b4747ea9febbd304b7e2ecd8ab3a20711bb2';
/** Source revision, quantization and inference runtime used with that artifact. */
export const OPEN_WEIGHT_LLM_MODEL_VERSION =
  'revision:0f80a8ebec6d07600bc3790a042a075527692b49|quant:Q4_0|llama:server-b10524';
export const OPEN_WEIGHT_LLM_MODEL_ALIAS = 'gemma-3-4b-it-qat-q4_0';

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

const PRIVATE_RUNTIME_ADDRESSES = new BlockList();
PRIVATE_RUNTIME_ADDRESSES.addSubnet('127.0.0.0', 8, 'ipv4');
PRIVATE_RUNTIME_ADDRESSES.addSubnet('10.0.0.0', 8, 'ipv4');
PRIVATE_RUNTIME_ADDRESSES.addSubnet('172.16.0.0', 12, 'ipv4');
PRIVATE_RUNTIME_ADDRESSES.addSubnet('192.168.0.0', 16, 'ipv4');
PRIVATE_RUNTIME_ADDRESSES.addAddress('::1', 'ipv6');
PRIVATE_RUNTIME_ADDRESSES.addSubnet('fc00::', 7, 'ipv6');

export type OpenWeightLlmTransport =
  | { readonly kind: 'http'; readonly baseUrl: string }
  | { readonly kind: 'unix'; readonly socketPath: string };

export interface OpenWeightLlmConfig {
  readonly enabled: boolean;
  readonly transport: OpenWeightLlmTransport | null;
  readonly token: string | null;
  readonly model: string;
  readonly timeoutsMs: Readonly<{
    topic_label: number;
    qa_summary: number;
    learning_objectives: number;
  }>;
  readonly maxOutputTokens: Readonly<{
    topic_label: number;
    qa_summary: number;
    learning_objectives: number;
  }>;
}

export function isOpenWeightLlmEnabled(value = process.env['OPEN_WEIGHT_LLM_ENABLED']): boolean {
  return value === 'true';
}

export function normalizeOpenWeightLlmHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase().replace(/\.+$/, '');
  return normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized;
}

function ipv4MappedFromIpv6(host: string): string | null {
  return host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1] ?? null;
}

export function isBlockedOpenWeightLlmHost(hostname: string): boolean {
  const host = normalizeOpenWeightLlmHostname(hostname);
  return (
    [...BLOCKED_SAAS_HOSTS].some(
      (blockedHost) => host === blockedHost || host.endsWith(`.${blockedHost}`),
    ) || host.endsWith('.openai.azure.com')
  );
}

/** Accept exactly loopback, RFC1918 or Unique-Local IPv6 addresses. */
export function isPrivateOpenWeightLlmAddress(address: string): boolean {
  const host = normalizeOpenWeightLlmHostname(address);
  const mappedIpv4 = ipv4MappedFromIpv6(host);
  if (mappedIpv4) {
    return PRIVATE_RUNTIME_ADDRESSES.check(mappedIpv4, 'ipv4');
  }
  const version = isIP(host);
  if (version === 4) return PRIVATE_RUNTIME_ADDRESSES.check(host, 'ipv4');
  if (version === 6) return PRIVATE_RUNTIME_ADDRESSES.check(host, 'ipv6');
  return false;
}

export function resolveOpenWeightLlmUrl(
  configuredValue = process.env['OPEN_WEIGHT_LLM_URL'],
): string | null {
  const value = configuredValue?.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('OPEN_WEIGHT_LLM_URL ist keine gültige URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('OPEN_WEIGHT_LLM_URL muss http oder https verwenden');
  }
  if (parsed.username || parsed.password) {
    throw new Error('OPEN_WEIGHT_LLM_URL darf keine Credentials in der URL enthalten');
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('OPEN_WEIGHT_LLM_URL muss eine Basis-URL ohne Pfad, Query oder Fragment sein');
  }
  if (!parsed.hostname || isBlockedOpenWeightLlmHost(parsed.hostname)) {
    throw new Error('OPEN_WEIGHT_LLM_URL darf keinen öffentlichen SaaS-LLM-Endpunkt verwenden');
  }
  return parsed.origin;
}

export function resolveOpenWeightLlmSocketPath(
  configuredValue = process.env['OPEN_WEIGHT_LLM_SOCKET_PATH'],
): string | null {
  const value = configuredValue?.trim();
  if (!value) return null;
  if (!value.startsWith('/') || !value.endsWith('.sock') || value.length > 256) {
    throw new Error('OPEN_WEIGHT_LLM_SOCKET_PATH muss ein absoluter .sock-Pfad sein');
  }
  return value;
}

function resolveOpenWeightLlmToken(configuredValue: string | undefined): string | null {
  if (!configuredValue?.trim()) return null;
  const value = configuredValue;
  if (value.length < 32 || value.length > 512 || !/^[A-Za-z0-9._~-]+$/.test(value)) {
    throw new Error('OPEN_WEIGHT_LLM_TOKEN muss 32 bis 512 URL-sichere ASCII-Zeichen enthalten');
  }
  return value;
}

function parseBoundedInt(
  name: string,
  configuredValue: string | undefined,
  fallback: number,
): number {
  const value = configuredValue?.trim();
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} muss eine ganze Zahl sein`);
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < OPEN_WEIGHT_LLM_TIMEOUT_MIN_MS ||
    parsed > OPEN_WEIGHT_LLM_TIMEOUT_MAX_MS
  ) {
    throw new Error(
      `${name} muss zwischen ${OPEN_WEIGHT_LLM_TIMEOUT_MIN_MS} und ${OPEN_WEIGHT_LLM_TIMEOUT_MAX_MS} liegen`,
    );
  }
  return parsed;
}

/**
 * Task-Timeouts einzeln auflösen — ohne Token-/Transport-Validierung.
 * Betriebsprobe und Queue-Alignment dürfen nicht an der vollen Config scheitern.
 */
export function resolveOpenWeightLlmLabelTimeoutMs(
  configuredValue: string | undefined = process.env['OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS'],
): number {
  return parseBoundedInt(
    'OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS',
    configuredValue,
    OPEN_WEIGHT_LLM_LABEL_TIMEOUT_DEFAULT_MS,
  );
}

export function resolveOpenWeightLlmSummaryTimeoutMs(
  configuredValue: string | undefined = process.env['OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS'],
): number {
  return parseBoundedInt(
    'OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS',
    configuredValue,
    OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_DEFAULT_MS,
  );
}

export function resolveOpenWeightLlmLearningTimeoutMs(
  configuredValue: string | undefined = process.env['OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS'],
): number {
  return parseBoundedInt(
    'OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS',
    configuredValue,
    OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_DEFAULT_MS,
  );
}

export function resolveOpenWeightLlmConfig(
  env: NodeJS.ProcessEnv = process.env,
): OpenWeightLlmConfig {
  const url = resolveOpenWeightLlmUrl(env['OPEN_WEIGHT_LLM_URL']);
  const socketPath = resolveOpenWeightLlmSocketPath(env['OPEN_WEIGHT_LLM_SOCKET_PATH']);
  if (url && socketPath) {
    throw new Error(
      'OPEN_WEIGHT_LLM_URL und OPEN_WEIGHT_LLM_SOCKET_PATH sind gegenseitig exklusiv',
    );
  }
  return {
    enabled: isOpenWeightLlmEnabled(env['OPEN_WEIGHT_LLM_ENABLED']),
    transport: url
      ? { kind: 'http', baseUrl: url }
      : socketPath
        ? { kind: 'unix', socketPath }
        : null,
    token: resolveOpenWeightLlmToken(env['OPEN_WEIGHT_LLM_TOKEN']),
    model: OPEN_WEIGHT_LLM_MODEL_ALIAS,
    timeoutsMs: {
      topic_label: resolveOpenWeightLlmLabelTimeoutMs(env['OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS']),
      qa_summary: resolveOpenWeightLlmSummaryTimeoutMs(env['OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS']),
      learning_objectives: resolveOpenWeightLlmLearningTimeoutMs(
        env['OPEN_WEIGHT_LLM_LEARNING_TIMEOUT_MS'],
      ),
    },
    maxOutputTokens: {
      topic_label: 96,
      qa_summary: 640,
      learning_objectives: 768,
    },
  };
}
