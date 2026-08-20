import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { toWordCloudSemanticSourceId } from '@arsnova/shared-types';
import {
  embedWithWordCloudEncoder,
  resetWordCloudEncoderClientForTests,
  WordCloudEncoderError,
} from './wordCloudEncoderClient';
import type { WordCloudSemanticConfig } from './wordCloudSemanticConfig';

const snapshotHash = createHash('sha256').update('fixture').digest('hex');

const baseConfig = {
  enabled: true,
  socketPath: '/tmp/missing-encoder.sock',
  inferenceUrl: 'http://127.0.0.1:8790/embed',
  inferenceToken: null,
  timeoutMs: 8000,
  cacheTtlSeconds: 1800,
} as const satisfies WordCloudSemanticConfig;

const request = {
  locale: 'de' as const,
  snapshotHash,
  items: [{ id: toWordCloudSemanticSourceId('q1'), text: 'Kommt Kapitel 4 in die Klausur?' }],
};

describe('wordCloudEncoderClient', () => {
  afterEach(() => {
    resetWordCloudEncoderClientForTests();
  });

  it('blockiert SaaS-Hosts auch wenn die URL gesetzt ist', async () => {
    resetWordCloudEncoderClientForTests({
      config: () => ({
        ...baseConfig,
        inferenceUrl: 'https://api.openai.com/v1/embeddings',
      }),
    });

    await expect(embedWithWordCloudEncoder(request)).rejects.toMatchObject({
      code: 'SAAS_BLOCKED',
    });
  });

  it('weist ueberlange und schemawidrige Antworten zurueck', async () => {
    resetWordCloudEncoderClientForTests({
      config: () => baseConfig,
      fetch: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ modelId: 'x', modelVersion: 'x', items: [] }),
      }),
    });

    await expect(embedWithWordCloudEncoder(request)).rejects.toBeInstanceOf(WordCloudEncoderError);

    resetWordCloudEncoderClientForTests({
      config: () => baseConfig,
      fetch: async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            modelId: 'intfloat/multilingual-e5-small',
            modelVersion: `intfloat/multilingual-e5-small@${'a'.repeat(12)}`,
            items: [
              {
                id: request.items[0]!.id,
                embedding: [1, 0, 0, 0],
              },
            ],
          }),
      }),
    });

    const result = await embedWithWordCloudEncoder(request);
    expect(result.items).toHaveLength(1);
    expect(result.modelId).toContain('e5-small');
  });

  it('meldet Timeout ohne Rohtext', async () => {
    resetWordCloudEncoderClientForTests({
      config: () => baseConfig,
      fetch: async () => {
        const error = new Error('Aborted');
        error.name = 'TimeoutError';
        throw error;
      },
    });

    await expect(embedWithWordCloudEncoder(request)).rejects.toMatchObject({ code: 'TIMEOUT' });
    try {
      await embedWithWordCloudEncoder(request);
    } catch (error) {
      expect(String(error)).not.toContain('Klausur');
    }
  });
});
