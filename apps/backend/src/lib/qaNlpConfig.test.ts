import { describe, expect, it } from 'vitest';
import {
  isQaNlpEnabled,
  QA_NLP_CONCURRENCY_DEFAULT,
  QA_NLP_QUEUE_LIMIT_DEFAULT,
  QA_NLP_TIMEOUT_DEFAULT_MS,
  resolveQaNlpConfig,
  resolveQaNlpConcurrency,
  resolveQaNlpQueueLimit,
  resolveQaNlpTimeoutMs,
} from './qaNlpConfig';

describe('qaNlpConfig', () => {
  it('bleibt ohne Flag und mit jedem Wert ausser true ausgeschaltet', () => {
    expect(isQaNlpEnabled(undefined)).toBe(false);
    expect(isQaNlpEnabled('false')).toBe(false);
    expect(isQaNlpEnabled('1')).toBe(false);
    expect(isQaNlpEnabled('TRUE')).toBe(false);
    expect(isQaNlpEnabled('true')).toBe(true);
  });

  it('begrenzt Timeout, Queue-Limit und Parallelitaet hart', () => {
    expect(resolveQaNlpTimeoutMs(undefined)).toBe(QA_NLP_TIMEOUT_DEFAULT_MS);
    expect(resolveQaNlpQueueLimit(undefined)).toBe(QA_NLP_QUEUE_LIMIT_DEFAULT);
    expect(resolveQaNlpConcurrency(undefined)).toBe(QA_NLP_CONCURRENCY_DEFAULT);
    expect(() => resolveQaNlpTimeoutMs('abc')).toThrow(/ganze Zahl/);
    expect(() => resolveQaNlpTimeoutMs('50')).toThrow(/zwischen/);
    expect(() => resolveQaNlpQueueLimit('0')).toThrow(/zwischen/);
    expect(() => resolveQaNlpConcurrency('8')).toThrow(/zwischen/);
  });

  it('liest die Betriebsgrenzen zusammen', () => {
    expect(
      resolveQaNlpConfig({
        QA_NLP_ENABLED: 'true',
        QA_NLP_TIMEOUT_MS: '1500',
        QA_NLP_QUEUE_LIMIT: '20',
        QA_NLP_CONCURRENCY: '2',
      }),
    ).toEqual({
      enabled: true,
      timeoutMs: 1500,
      queueLimit: 20,
      concurrency: 2,
    });
  });
});
