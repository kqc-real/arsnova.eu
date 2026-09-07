/**
 * TRPC-Fehlermeldungen kommen vom Server auf Deutsch.
 * Bekannte Texte werden für die aktuelle UI-Locale übersetzt.
 */
const SESSION_NOT_FOUND_DE = 'Session nicht gefunden.';
const SESSION_CREATE_RATE_LIMIT_DE =
  'Zu viele Session-Erstellungen. Bitte später erneut versuchen.';
const SESSION_CODE_TOO_MANY_FAILURES_DE_PREFIX = 'Ungültiger Code.';
const SESSION_CODE_TOO_MANY_FAILURES_DE_CONTAINS = 'Zu viele Fehlversuche';
const ADMIN_LOGIN_RATE_LIMIT_MESSAGES_DE = new Set([
  'Zu viele Admin-Login-Versuche. Bitte später erneut versuchen.',
  'Zu viele gleichzeitige Admin-Login-Versuche.',
]);
const HOST_PAIRING_MESSAGES_DE: Record<string, () => string> = {
  'Die Verbindungsanfrage ist abgelaufen.': () =>
    $localize`:@@hostPairing.errorExpired:Die Verbindungsanfrage ist abgelaufen.`,
  'Dieser Verbindungslink ist ungültig oder abgelaufen.': () =>
    $localize`:@@hostPairing.errorInvalidLink:Dieser Verbindungslink ist ungültig oder abgelaufen.`,
  'Es wartet bereits eine Verbindungsanfrage.': () =>
    $localize`:@@hostPairing.errorAlreadyPending:Es wartet bereits eine Verbindungsanfrage.`,
  'Es sind bereits drei weitere Host-Geräte verbunden.': () =>
    $localize`:@@hostPairing.errorCapReached:Es sind bereits drei weitere Geräte verbunden.`,
  'Nur die ursprüngliche Lehrperson kann weitere Geräte verbinden.': () =>
    $localize`:@@hostPairing.errorNotOriginal:Nur du kannst weitere Geräte verbinden.`,
  'Die Verbindung wurde abgelehnt.': () =>
    $localize`:@@hostPairing.errorRejected:Die Verbindung wurde abgelehnt.`,
  'Es gibt keine offene Verbindungsanfrage.': () =>
    $localize`:@@hostPairing.errorNoRequest:Es gibt keine offene Verbindungsanfrage.`,
  'Die Veranstaltung ist bereits beendet.': () =>
    $localize`:@@hostPairing.errorSessionEnded:Die Veranstaltung ist bereits beendet.`,
  'Zu viele Verbindungsversuche. Bitte später erneut versuchen.': () =>
    $localize`:@@hostPairing.errorRateLimited:Zu viele Verbindungsversuche. Bitte später erneut versuchen.`,
  'Die Host-Verbindung wurde beendet.': () =>
    $localize`:@@hostAccess.revokedTitle:Die Host-Verbindung wurde beendet.`,
};
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

function sessionCreateRateLimitUiMessage(): string {
  return $localize`:@@errors.sessionCreateRateLimit:Zu viele Session-Erstellungen. Bitte später erneut versuchen.`;
}

function adminLoginRateLimitUiMessage(): string {
  return $localize`:@@errors.adminLoginRateLimit:Zu viele Admin-Login-Versuche. Bitte später erneut versuchen.`;
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

  const rootData = asRecord(root['data']);
  const shape = asRecord(root['shape']);
  const shapeData = asRecord(shape?.['data']);

  return (
    readRetryAfterSeconds(rootData?.['retryAfterSeconds']) ??
    readRetryAfterSeconds(shapeData?.['retryAfterSeconds']) ??
    null
  );
}

export function localizeKnownServerMessage(message: string): string {
  const normalized = stripTrpcCodePrefix(message);
  if (normalized === SESSION_NOT_FOUND_DE) {
    return sessionNotFoundUiMessage();
  }
  if (normalized === SESSION_CREATE_RATE_LIMIT_DE) {
    return sessionCreateRateLimitUiMessage();
  }
  if (
    normalized.startsWith(SESSION_CODE_TOO_MANY_FAILURES_DE_PREFIX) &&
    normalized.includes(SESSION_CODE_TOO_MANY_FAILURES_DE_CONTAINS)
  ) {
    return $localize`:@@errors.sessionCodeTooManyFailures:Zu viele falsche Codes – kurz warten.`;
  }
  if (ADMIN_LOGIN_RATE_LIMIT_MESSAGES_DE.has(normalized)) {
    return adminLoginRateLimitUiMessage();
  }
  const pairingMessage = HOST_PAIRING_MESSAGES_DE[normalized];
  if (pairingMessage) {
    return pairingMessage();
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

  const retryHint = $localize`:@@errors.rateLimitRetryAfter:Bitte in ${retryAfterSeconds}:seconds: Sekunden erneut versuchen.`;
  return `${localizedMessage}\n${retryHint}`;
}
