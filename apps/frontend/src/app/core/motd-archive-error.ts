import { localizeKnownServerError } from './localize-known-server-message';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

/**
 * Zeigt strukturierte Serverfehler lokalisiert an, aber keine technischen
 * Transport- oder Parsermeldungen aus dem Browser.
 */
export function localizeMotdArchiveError(error: unknown, fallbackMessage: string): string {
  const root = asRecord(error);
  const shape = asRecord(root?.['shape']);
  const hasServerErrorData =
    asRecord(root?.['data']) !== null || asRecord(shape?.['data']) !== null;

  return hasServerErrorData ? localizeKnownServerError(error, fallbackMessage) : fallbackMessage;
}
