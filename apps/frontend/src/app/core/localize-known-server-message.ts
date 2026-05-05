/**
 * TRPC-Fehlermeldungen kommen vom Server auf Deutsch.
 * Bekannte Texte werden für die aktuelle UI-Locale übersetzt.
 */
const SESSION_NOT_FOUND_DE = 'Session nicht gefunden.';
const TRPC_CODE_PREFIXES = [
  'TOO_MANY_REQUESTS',
  'NOT_FOUND',
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INTERNAL_SERVER_ERROR',
] as const;

type UnknownRecord = Record<string, unknown>;

export function sessionNotFoundUiMessage(): string {
  return $localize`:@@session.notFound:Session nicht gefunden.`;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function stripTrpcCodePrefix(message: string): string {
  for (const prefix of TRPC_CODE_PREFIXES) {
    const token = `${prefix}:`;
    if (message.startsWith(token)) {
      return message.slice(token.length).trim();
    }
  }
  return message;
}

function readRetryAfterSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.ceil(value);
  }
  return null;
}

function extractRetryAfterSeconds(error: unknown): number | null {
  const root = asRecord(error);
  if (!root) return null;

  const directCause = asRecord(root['cause']);
  const rootData = asRecord(root['data']);
  const dataCause = asRecord(rootData?.['cause']);
  const shape = asRecord(root['shape']);
  const shapeData = asRecord(shape?.['data']);
  const shapeCause = asRecord(shapeData?.['cause']);

  return (
    readRetryAfterSeconds(directCause?.['retryAfterSeconds']) ??
    readRetryAfterSeconds(dataCause?.['retryAfterSeconds']) ??
    readRetryAfterSeconds(shapeCause?.['retryAfterSeconds']) ??
    null
  );
}

export function localizeKnownServerMessage(message: string): string {
  const normalized = stripTrpcCodePrefix(message);
  if (normalized === SESSION_NOT_FOUND_DE) {
    return sessionNotFoundUiMessage();
  }
  return normalized;
}

function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  const root = asRecord(error);
  const message = root?.['message'];
  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }
  return fallbackMessage;
}

/**
 * Liefert eine UI-taugliche Fehlermeldung inkl. Wartezeit bei Rate-Limits.
 * Meldungen bleiben klar und auffällig, auch wenn der Server nur generisch antwortet.
 */
export function localizeKnownServerError(error: unknown, fallbackMessage: string): string {
  const localizedMessage = localizeKnownServerMessage(extractErrorMessage(error, fallbackMessage));
  const retryAfterSeconds = extractRetryAfterSeconds(error);
  if (!retryAfterSeconds) {
    return localizedMessage;
  }

  const emphasis = $localize`:@@errors.rateLimitAttention:WICHTIG:`;
  const retryHint = $localize`:@@errors.rateLimitRetryAfter:Bitte in ${retryAfterSeconds}:seconds: Sekunden erneut versuchen.`;
  return `${emphasis} ${localizedMessage}\n${retryHint}`;
}
