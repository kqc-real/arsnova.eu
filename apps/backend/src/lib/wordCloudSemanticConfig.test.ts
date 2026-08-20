import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isBlockedWordCloudEncoderHost,
  isPrivateWordCloudEncoderHttpHost,
  isWordCloudSemanticEnabled,
  resolveWordCloudEncoderUrl,
  resolveWordCloudSemanticConfig,
} from './wordCloudSemanticConfig';

describe('wordCloudSemanticConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bleibt default aus und ist nicht NLP_ENABLED oder QA_SUMMARY_*', () => {
    vi.stubEnv('NLP_ENABLED', 'true');
    vi.stubEnv('QA_NLP_ENABLED', 'true');
    vi.stubEnv('QA_SUMMARY_ENABLED', 'true');
    vi.stubEnv('QA_SUMMARY_INFERENCE_URL', 'http://127.0.0.1:8787/summary');
    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'false');

    expect(isWordCloudSemanticEnabled()).toBe(false);
    const config = resolveWordCloudSemanticConfig();
    expect(config.enabled).toBe(false);
    expect(config.inferenceUrl).toBeNull();
  });

  it('aktiviert nur bei exakt true', () => {
    expect(isWordCloudSemanticEnabled('TRUE')).toBe(false);
    expect(isWordCloudSemanticEnabled('1')).toBe(false);
    expect(isWordCloudSemanticEnabled('true')).toBe(true);
  });

  it('lehnt oeffentliche Encoder-Ziele ab und erlaubt nur Loopback oder RFC1918', () => {
    expect(() => resolveWordCloudEncoderUrl('https://api.openai.com/v1/embeddings')).toThrow(
      /Loopback|private/,
    );
    expect(() => resolveWordCloudEncoderUrl('https://example.com/embed')).toThrow(
      /Loopback|private/,
    );
    expect(() => resolveWordCloudEncoderUrl('https://8.8.8.8/embed')).toThrow(/Loopback|private/);
    expect(isBlockedWordCloudEncoderHost('api.deepseek.com')).toBe(true);
    expect(isPrivateWordCloudEncoderHttpHost('example.com')).toBe(false);
    expect(isPrivateWordCloudEncoderHttpHost('127.0.0.1')).toBe(true);
    expect(isPrivateWordCloudEncoderHttpHost('localhost')).toBe(true);
    expect(isPrivateWordCloudEncoderHttpHost('10.1.2.3')).toBe(true);
    expect(isPrivateWordCloudEncoderHttpHost('::1')).toBe(true);
    expect(resolveWordCloudEncoderUrl('http://127.0.0.1:8790/embed')).toBe(
      'http://127.0.0.1:8790/embed',
    );
    expect(resolveWordCloudEncoderUrl('http://localhost:8790/embed')).toBe(
      'http://localhost:8790/embed',
    );
    expect(resolveWordCloudEncoderUrl('http://10.0.0.8:8790/embed')).toBe(
      'http://10.0.0.8:8790/embed',
    );
  });

  it('verwirft eine ungueltige Encoder-URL still als unkonfiguriert', () => {
    const config = resolveWordCloudSemanticConfig({
      WORD_CLOUD_SEMANTIC_ENABLED: 'true',
      WORD_CLOUD_ENCODER_URL: 'https://api.openai.com/v1',
    });
    expect(config.enabled).toBe(true);
    expect(config.inferenceUrl).toBeNull();

    const publicConfig = resolveWordCloudSemanticConfig({
      WORD_CLOUD_SEMANTIC_ENABLED: 'true',
      WORD_CLOUD_ENCODER_URL: 'https://example.com/embed',
    });
    expect(publicConfig.inferenceUrl).toBeNull();
  });

  it('akzeptiert Encoder-Timeout bis 120 s fuer CPU-e5', () => {
    const config = resolveWordCloudSemanticConfig({
      WORD_CLOUD_SEMANTIC_ENABLED: 'true',
      WORD_CLOUD_ENCODER_URL: 'http://127.0.0.1:8790/embed',
      WORD_CLOUD_ENCODER_TIMEOUT_MS: '120000',
    });
    expect(config.timeoutMs).toBe(120_000);
    expect(() =>
      resolveWordCloudSemanticConfig({
        WORD_CLOUD_SEMANTIC_ENABLED: 'true',
        WORD_CLOUD_ENCODER_TIMEOUT_MS: '120001',
      }),
    ).toThrow(/WORD_CLOUD_ENCODER_TIMEOUT_MS/);
  });
});
