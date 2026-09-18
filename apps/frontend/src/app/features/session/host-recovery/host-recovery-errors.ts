type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

export function readRecoveryErrorMessage(error: unknown): string {
  const root = asRecord(error);
  const message = root?.['message'];
  return typeof message === 'string' ? message : '';
}

export function readRecoveryErrorCode(error: unknown): string | null {
  const root = asRecord(error);
  const data = asRecord(root?.['data']);
  const code = data?.['code'];
  if (typeof code === 'string' && code.length > 0) return code;
  const message = readRecoveryErrorMessage(error);
  const prefix = message.split(':', 1)[0];
  return prefix && prefix !== message ? prefix : null;
}

export function isRecoveryNetworkError(error: unknown): boolean {
  const message = readRecoveryErrorMessage(error).toLowerCase();
  const code = readRecoveryErrorCode(error);
  if (code === 'TIMEOUT' || code === 'CLIENT_CLOSED_REQUEST') return true;
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('antwort nach erfolgreicher aktivierung verloren')
  );
}

export function isRecoveryUnauthorizedError(error: unknown): boolean {
  const code = readRecoveryErrorCode(error);
  const message = readRecoveryErrorMessage(error);
  return code === 'UNAUTHORIZED' || message.startsWith('UNAUTHORIZED');
}

export function isRecoveryServerError(error: unknown): boolean {
  const code = readRecoveryErrorCode(error);
  return (
    code === 'INTERNAL_SERVER_ERROR' ||
    code === 'BAD_GATEWAY' ||
    code === 'SERVICE_UNAVAILABLE' ||
    code === 'GATEWAY_TIMEOUT' ||
    code === 'BAD_REQUEST' ||
    code === 'PRECONDITION_FAILED'
  );
}

export type RecoveryRequestKind = 'prepare' | 'activate' | 'issue';

export type RecoveryPublicError =
  'genericError' | 'networkError' | 'serverError' | 'activationUnconfirmed' | 'storageError';

export function classifyRecoveryRequestError(
  error: unknown,
  kind: RecoveryRequestKind,
): RecoveryPublicError {
  if (isRecoveryUnauthorizedError(error)) return 'genericError';
  if (isRecoveryNetworkError(error)) return 'networkError';
  if (isRecoveryServerError(error)) return 'serverError';
  if (kind === 'activate') {
    return 'activationUnconfirmed';
  }
  return 'serverError';
}
