import { describe, expect, it } from 'vitest';
import {
  isNlpSidecarEnabled,
  NLP_CACHE_TTL_DEFAULT_SECONDS,
  NLP_CACHE_TTL_MAX_SECONDS,
  NLP_CACHE_TTL_MIN_SECONDS,
  NLP_DEFAULT_SOCKET_PATH,
  NLP_TIMEOUT_DEFAULT_MS,
  NLP_TIMEOUT_MAX_MS,
  NLP_TIMEOUT_MIN_MS,
  resolveNlpCacheTtlSeconds,
  resolveNlpSidecarConfig,
  resolveNlpSocketPath,
  resolveNlpTimeoutMs,
} from './nlpSidecarConfig';

describe('nlpSidecarConfig', () => {
  it('bleibt ohne Flag und mit jedem Wert ausser true ausgeschaltet', () => {
    expect(isNlpSidecarEnabled(undefined)).toBe(false);
    expect(isNlpSidecarEnabled('false')).toBe(false);
    expect(isNlpSidecarEnabled('1')).toBe(false);
    expect(isNlpSidecarEnabled('true')).toBe(true);
  });

  it('nutzt den internen Unix-Socket als Default', () => {
    expect(resolveNlpSocketPath(undefined)).toBe(NLP_DEFAULT_SOCKET_PATH);
    expect(resolveNlpSocketPath(' /tmp/spacy.sock ')).toBe('/tmp/spacy.sock');
  });

  it('begrenzt das Timeout hart', () => {
    expect(resolveNlpTimeoutMs(undefined)).toBe(NLP_TIMEOUT_DEFAULT_MS);
    expect(resolveNlpTimeoutMs(String(NLP_TIMEOUT_MIN_MS))).toBe(NLP_TIMEOUT_MIN_MS);
    expect(resolveNlpTimeoutMs(String(NLP_TIMEOUT_MAX_MS))).toBe(NLP_TIMEOUT_MAX_MS);
    expect(() => resolveNlpTimeoutMs('abc')).toThrow(/ganze Zahl/);
    expect(() => resolveNlpTimeoutMs('500')).toThrow(/zwischen/);
  });

  it('liest die drei Betriebsgrenzen zusammen', () => {
    expect(
      resolveNlpSidecarConfig({
        NLP_ENABLED: 'true',
        NLP_SOCKET_PATH: '/run/custom/nlp.sock',
        NLP_TIMEOUT_MS: '8000',
        NLP_CACHE_TTL_SECONDS: '900',
      }),
    ).toEqual({
      enabled: true,
      socketPath: '/run/custom/nlp.sock',
      timeoutMs: 8000,
      cacheTtlSeconds: 900,
    });
  });

  it('begrenzt den Cache-TTL hart', () => {
    expect(resolveNlpCacheTtlSeconds(undefined)).toBe(NLP_CACHE_TTL_DEFAULT_SECONDS);
    expect(resolveNlpCacheTtlSeconds(String(NLP_CACHE_TTL_MIN_SECONDS))).toBe(
      NLP_CACHE_TTL_MIN_SECONDS,
    );
    expect(resolveNlpCacheTtlSeconds(String(NLP_CACHE_TTL_MAX_SECONDS))).toBe(
      NLP_CACHE_TTL_MAX_SECONDS,
    );
    expect(() => resolveNlpCacheTtlSeconds('abc')).toThrow(/ganze Zahl/);
    expect(() => resolveNlpCacheTtlSeconds('10')).toThrow(/zwischen/);
  });
});
