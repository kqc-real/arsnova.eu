import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAppVersion } from './appVersion.js';

describe('resolveAppVersion', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bevorzugt die serverseitig konfigurierte Release-Version', () => {
    vi.stubEnv('APP_VERSION', ' release-2026.09.06 ');
    vi.stubEnv('GITHUB_SHA', 'abcdef');

    expect(resolveAppVersion('client-version')).toBe('release-2026.09.06');
  });

  it('verwendet den Build-Commit vor einer Client-Angabe', () => {
    vi.stubEnv('APP_VERSION', '');
    vi.stubEnv('GITHUB_SHA', 'abcdef1234567890');

    expect(resolveAppVersion('client-version')).toBe('abcdef123456');
  });

  it('fällt lokal auf Client-Version und Paketversion zurück', () => {
    vi.stubEnv('APP_VERSION', '');
    vi.stubEnv('GITHUB_SHA', '');

    expect(resolveAppVersion(' client-version ')).toBe('client-version');
    expect(resolveAppVersion()).toBe('0.1.0');
  });
});
