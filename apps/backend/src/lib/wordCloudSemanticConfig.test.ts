import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isBlockedWordCloudEncoderHost,
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

  it('lehnt öffentliche SaaS-Hosts ab', () => {
    expect(() => resolveWordCloudEncoderUrl('https://api.openai.com/v1/embeddings')).toThrow(
      /SaaS/,
    );
    expect(isBlockedWordCloudEncoderHost('api.deepseek.com')).toBe(true);
    expect(resolveWordCloudEncoderUrl('http://127.0.0.1:8790/embed')).toBe(
      'http://127.0.0.1:8790/embed',
    );
  });

  it('verwirft eine ungueltige Encoder-URL still als unkonfiguriert', () => {
    const config = resolveWordCloudSemanticConfig({
      WORD_CLOUD_SEMANTIC_ENABLED: 'true',
      WORD_CLOUD_ENCODER_URL: 'https://api.openai.com/v1',
    });
    expect(config.enabled).toBe(true);
    expect(config.inferenceUrl).toBeNull();
  });
});
