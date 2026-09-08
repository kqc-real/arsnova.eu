import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DATABASE_POOL_CONNECTION_TIMEOUT_MS,
  DEFAULT_DATABASE_POOL_MAX,
  resolveDatabasePoolConnectionTimeoutMs,
  resolveDatabasePoolMax,
} from './databasePoolConfig';

describe('databasePoolConfig', () => {
  it('nutzt den Hörsaal-Default statt der pg-10er-Grenze', () => {
    expect(resolveDatabasePoolMax(undefined)).toBe(DEFAULT_DATABASE_POOL_MAX);
    expect(resolveDatabasePoolMax('')).toBe(DEFAULT_DATABASE_POOL_MAX);
    expect(DEFAULT_DATABASE_POOL_MAX).toBeGreaterThanOrEqual(40);
  });

  it('übernimmt gültige Poolgrößen und lehnt Ausreißer ab', () => {
    expect(resolveDatabasePoolMax('24')).toBe(24);
    expect(resolveDatabasePoolMax('3')).toBe(DEFAULT_DATABASE_POOL_MAX);
    expect(resolveDatabasePoolMax('101')).toBe(DEFAULT_DATABASE_POOL_MAX);
    expect(resolveDatabasePoolMax('abc')).toBe(DEFAULT_DATABASE_POOL_MAX);
  });

  it('begrenzt die Wartezeit auf einen freien Pool-Slot', () => {
    expect(resolveDatabasePoolConnectionTimeoutMs(undefined)).toBe(
      DEFAULT_DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    );
    expect(resolveDatabasePoolConnectionTimeoutMs('8000')).toBe(8000);
    expect(resolveDatabasePoolConnectionTimeoutMs('500')).toBe(
      DEFAULT_DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    );
  });
});
