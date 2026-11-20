import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertQaSummaryReplicaStateConfigured,
  isBlockedQaSummaryInferenceHost,
  isQaSummaryEnabled,
  QA_SUMMARY_CONCURRENCY_DEFAULT,
  QA_SUMMARY_TIMEOUT_DEFAULT_MS,
  resolveEffectiveQaSummaryTimeoutMs,
  resolveQaSummaryConfig,
  resolveQaSummaryInferenceUrl,
  resolveQaSummaryMaxSources,
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

  it('begrenzt Timeout hart und deckt den Open-Weight-Summary-Default', () => {
    expect(resolveQaSummaryTimeoutMs(undefined)).toBe(QA_SUMMARY_TIMEOUT_DEFAULT_MS);
    expect(QA_SUMMARY_TIMEOUT_DEFAULT_MS).toBe(90_000);
    expect(resolveQaSummaryTimeoutMs('90000')).toBe(90_000);
    expect(resolveQaSummaryTimeoutMs('300000')).toBe(300_000);
    expect(() => resolveQaSummaryTimeoutMs('abc')).toThrow(/ganze Zahl/);
    expect(() => resolveQaSummaryTimeoutMs('100')).toThrow(/zwischen/);
    expect(() => resolveQaSummaryTimeoutMs('300001')).toThrow(/zwischen/);
  });

  it('hebt das Queue-Timeout nur bei aktivem Open-Weight-Full-Context an', () => {
    const openWeightActive = {
      OPEN_WEIGHT_LLM_ENABLED: 'true',
      OPEN_WEIGHT_LLM_URL: 'http://127.0.0.1:8080',
      OPEN_WEIGHT_LLM_TOKEN: 'a'.repeat(32),
    };
    expect(
      resolveEffectiveQaSummaryTimeoutMs({
        ...openWeightActive,
        QA_SUMMARY_TIMEOUT_MS: '90000',
        OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: '180000',
      }),
    ).toBe(180_000);
    expect(
      resolveEffectiveQaSummaryTimeoutMs({
        ...openWeightActive,
        QA_SUMMARY_TIMEOUT_MS: '200000',
        OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: '90000',
      }),
    ).toBe(200_000);
    // Legacy / Open Weight aus: dokumentiertes QA_SUMMARY_TIMEOUT_MS bleibt wirksam.
    expect(
      resolveEffectiveQaSummaryTimeoutMs({
        OPEN_WEIGHT_LLM_ENABLED: 'false',
        QA_SUMMARY_TIMEOUT_MS: '5000',
        OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: '180000',
      }),
    ).toBe(5_000);
    expect(
      resolveEffectiveQaSummaryTimeoutMs({
        QA_SUMMARY_TIMEOUT_MS: '5000',
        OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: '180000',
      }),
    ).toBe(5_000);
    expect(
      resolveEffectiveQaSummaryTimeoutMs({
        ...openWeightActive,
        QA_SUMMARY_TIMEOUT_MS: '90000',
        OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: 'abc',
      }),
    ).toBe(90_000);
  });

  it('laesst QA_SUMMARY_MAX_SOURCES nicht unter die Frageschwelle fallen', () => {
    expect(resolveQaSummaryMaxSources(undefined)).toBe(20);
    expect(resolveQaSummaryMaxSources('3')).toBe(3);
    expect(() => resolveQaSummaryMaxSources('1')).toThrow(/zwischen 3 und 40/);
    expect(() => resolveQaSummaryMaxSources('2')).toThrow(/zwischen 3 und 40/);
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
        OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS: '9000',
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

  it('erzwingt im Replikabetrieb bei aktiver Summary eine getrennte flüchtige Redis-URL', () => {
    expect(() =>
      assertQaSummaryReplicaStateConfigured({
        SESSION_STATUS_PUBSUB_ENABLED: 'false',
        QA_SUMMARY_ENABLED: 'true',
      }),
    ).not.toThrow();

    expect(() =>
      assertQaSummaryReplicaStateConfigured({
        SESSION_STATUS_PUBSUB_ENABLED: 'true',
        QA_SUMMARY_ENABLED: 'false',
      }),
    ).not.toThrow();

    expect(() =>
      assertQaSummaryReplicaStateConfigured({
        SESSION_STATUS_PUBSUB_ENABLED: 'true',
        QA_SUMMARY_ENABLED: 'true',
      }),
    ).toThrow(/QA_SUMMARY_STATE_REDIS_URL ist erforderlich/);

    expect(() =>
      assertQaSummaryReplicaStateConfigured({
        SESSION_STATUS_PUBSUB_ENABLED: 'true',
        QA_SUMMARY_ENABLED: 'true',
        REDIS_URL: 'redis://redis:6379',
        QA_SUMMARY_STATE_REDIS_URL: 'redis://redis:6379/1',
      }),
    ).toThrow(/eigene flüchtige Redis-Instanz/);

    expect(() =>
      assertQaSummaryReplicaStateConfigured({
        SESSION_STATUS_PUBSUB_ENABLED: 'true',
        QA_SUMMARY_ENABLED: 'true',
        REDIS_URL: 'redis://redis:6379',
        QA_SUMMARY_STATE_REDIS_URL: 'redis://qa-summary-redis:6379',
      }),
    ).not.toThrow();
  });
});
