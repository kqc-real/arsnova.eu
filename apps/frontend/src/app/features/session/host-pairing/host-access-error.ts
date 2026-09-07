type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function readMessage(error: unknown): string {
  const root = asRecord(error);
  const message = root?.['message'];
  return typeof message === 'string' ? message : '';
}

function readTrpcCode(error: unknown): string | null {
  const root = asRecord(error);
  const data = asRecord(root?.['data']);
  const code = data?.['code'];
  if (typeof code === 'string' && code.length > 0) {
    return code;
  }
  const message = readMessage(error);
  if (message.startsWith('UNAUTHORIZED')) return 'UNAUTHORIZED';
  if (message.startsWith('FORBIDDEN')) return 'FORBIDDEN';
  return null;
}

export function isHostAccessRevokedError(error: unknown): boolean {
  if (readTrpcCode(error) === 'UNAUTHORIZED') {
    return true;
  }
  const message = readMessage(error);
  return (
    message.includes('Die Host-Verbindung wurde beendet.') ||
    message.includes('Host-Session ungültig oder abgelaufen.')
  );
}

export function isOriginalHostForbiddenError(error: unknown): boolean {
  if (readTrpcCode(error) === 'FORBIDDEN') {
    return true;
  }
  return readMessage(error).includes('Nur die ursprüngliche Lehrperson');
}
