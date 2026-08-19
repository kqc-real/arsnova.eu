import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isBlockedQaSummaryInferenceHost,
  isQaSummaryEnabled,
  QA_SUMMARY_CONCURRENCY_DEFAULT,
  QA_SUMMARY_TIMEOUT_DEFAULT_MS,
  resolveQaSummaryConfig,
  resolveQaSummaryInferenceUrl,
  resolveQaSummaryTimeoutMs,
} from './qaSummaryConfig';

describe('qaSummaryConfig', () => {
  beforeEach(() => {
    vi.stubEnv('QA_SUMMARY_ENABLED', '');
    vi.stubEnv('QA_SUMMARY_INFERENCE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bleibt ohne Flag und mit jedem Wert ausser true ausgeschaltet', () => {
    expect(isQaSummaryEnabled(undefined)).toBe(false);
    expect(isQaSummaryEnabled('false')).toBe(false);
    expect(isQaSummaryEnabled('1')).toBe(false);
    expect(isQaSummaryEnabled('TRUE')).toBe(false);
    expect(isQaSummaryEnabled('true')).toBe(true);
  });

  it('begrenzt Timeout hart', () => {
    expect(resolveQaSummaryTimeoutMs(undefined)).toBe(QA_SUMMARY_TIMEOUT_DEFAULT_MS);
    expect(() => resolveQaSummaryTimeoutMs('abc')).toThrow(/ganze Zahl/);
    expect(() => resolveQaSummaryTimeoutMs('100')).toThrow(/zwischen/);
  });

  it('lehnt öffentliche SaaS-LLM-Hosts ab', () => {
    expect(isBlockedQaSummaryInferenceHost('api.openai.com')).toBe(true);
    expect(isBlockedQaSummaryInferenceHost('api.anthropic.com')).toBe(true);
    expect(isBlockedQaSummaryInferenceHost('inference.internal')).toBe(false);
    expect(() => resolveQaSummaryInferenceUrl('https://api.openai.com/v1/chat')).toThrow(/SaaS/);
    expect(resolveQaSummaryInferenceUrl('http://inference:8080/summary')).toBe(
      'http://inference:8080/summary',
    );
    expect(resolveQaSummaryInferenceUrl(undefined)).toBeNull();
  });

  it('liest die Betriebsgrenzen zusammen und fällt bei ungültiger URL auf unkonfiguriert zurück', () => {
    expect(
      resolveQaSummaryConfig({
        QA_SUMMARY_ENABLED: 'true',
        QA_SUMMARY_TIMEOUT_MS: '9000',
        QA_SUMMARY_QUEUE_LIMIT: '4',
        QA_SUMMARY_CONCURRENCY: '1',
        QA_SUMMARY_COOLDOWN_MS: '15000',
        QA_SUMMARY_TTL_MS: '120000',
        QA_SUMMARY_MAX_SOURCES: '10',
        QA_SUMMARY_INFERENCE_URL: 'https://api.openai.com/v1',
      }),
    ).toMatchObject({
      enabled: true,
      timeoutMs: 9000,
      queueLimit: 4,
      concurrency: QA_SUMMARY_CONCURRENCY_DEFAULT,
      cooldownMs: 15000,
      ttlMs: 120000,
      maxSources: 10,
      inferenceUrl: null,
    });
  });
});
