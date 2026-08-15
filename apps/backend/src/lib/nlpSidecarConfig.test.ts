import { describe, expect, it } from 'vitest';
import {
  isNlpSidecarEnabled,
  NLP_DEFAULT_SOCKET_PATH,
  NLP_TIMEOUT_DEFAULT_MS,
  NLP_TIMEOUT_MAX_MS,
  NLP_TIMEOUT_MIN_MS,
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
      }),
    ).toEqual({
      enabled: true,
      socketPath: '/run/custom/nlp.sock',
      timeoutMs: 8000,
    });
  });
});
