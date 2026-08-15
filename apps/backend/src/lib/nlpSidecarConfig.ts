/**
 * Kill-Switch und Betriebsgrenzen für den optionalen spaCy-Sidecar (Story 1.14b).
 *
 * Der Sidecar bleibt intern über einen Unix-Socket erreichbar (Analogie: PDF-Worker).
 * Es gibt keinen öffentlichen Port und keine Python-Laufzeit im Node-App-Container.
 */
export const NLP_DEFAULT_SOCKET_PATH = '/run/spacy/nlp.sock';
export const NLP_TIMEOUT_DEFAULT_MS = 5_000;
export const NLP_TIMEOUT_MIN_MS = 1_000;
export const NLP_TIMEOUT_MAX_MS = 15_000;

export interface NlpSidecarConfig {
  readonly enabled: boolean;
  readonly socketPath: string;
  readonly timeoutMs: number;
}

export function isNlpSidecarEnabled(value = process.env['NLP_ENABLED']): boolean {
  return value === 'true';
}

export function resolveNlpSocketPath(configuredValue = process.env['NLP_SOCKET_PATH']): string {
  const value = configuredValue?.trim();
  return value || NLP_DEFAULT_SOCKET_PATH;
}

export function resolveNlpTimeoutMs(configuredValue = process.env['NLP_TIMEOUT_MS']): number {
  const value = configuredValue?.trim();
  if (!value) return NLP_TIMEOUT_DEFAULT_MS;
  if (!/^\d+$/.test(value)) {
    throw new Error('NLP_TIMEOUT_MS muss eine ganze Zahl sein');
  }
  const timeoutMs = Number(value);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < NLP_TIMEOUT_MIN_MS ||
    timeoutMs > NLP_TIMEOUT_MAX_MS
  ) {
    throw new Error(
      `NLP_TIMEOUT_MS muss zwischen ${NLP_TIMEOUT_MIN_MS} und ${NLP_TIMEOUT_MAX_MS} liegen`,
    );
  }
  return timeoutMs;
}

export function resolveNlpSidecarConfig(env: NodeJS.ProcessEnv = process.env): NlpSidecarConfig {
  return {
    enabled: isNlpSidecarEnabled(env['NLP_ENABLED']),
    socketPath: resolveNlpSocketPath(env['NLP_SOCKET_PATH']),
    timeoutMs: resolveNlpTimeoutMs(env['NLP_TIMEOUT_MS']),
  };
}
