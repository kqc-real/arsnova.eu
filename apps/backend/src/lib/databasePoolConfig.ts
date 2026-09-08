/**
 * pg.Pool-Größe für Prisma-Adapter.
 * Default 10 (node-pg) reicht nicht für 500–600 parallele Vote-Transaktionen.
 */
export const DEFAULT_DATABASE_POOL_MAX = 40;
export const DATABASE_POOL_MAX_MIN = 4;
export const DATABASE_POOL_MAX_CAP = 100;
export const DEFAULT_DATABASE_POOL_CONNECTION_TIMEOUT_MS = 10_000;

export function resolveDatabasePoolMax(
  raw: string | undefined = process.env['DATABASE_POOL_MAX'],
): number {
  if (!raw) return DEFAULT_DATABASE_POOL_MAX;
  const parsed = Number.parseInt(raw, 10);
  if (
    !Number.isFinite(parsed) ||
    parsed < DATABASE_POOL_MAX_MIN ||
    parsed > DATABASE_POOL_MAX_CAP
  ) {
    return DEFAULT_DATABASE_POOL_MAX;
  }
  return parsed;
}

export function resolveDatabasePoolConnectionTimeoutMs(
  raw: string | undefined = process.env['DATABASE_POOL_CONNECTION_TIMEOUT_MS'],
): number {
  if (!raw) return DEFAULT_DATABASE_POOL_CONNECTION_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 60_000) {
    return DEFAULT_DATABASE_POOL_CONNECTION_TIMEOUT_MS;
  }
  return parsed;
}
