import { afterEach, describe, expect, it, vi } from 'vitest';

type MemoryEntry = { value: string; expiresAt?: number };

const { memoryRedis } = vi.hoisted(() => {
  const store = new Map<string, MemoryEntry>();
  const alive = (entry: MemoryEntry | undefined): entry is MemoryEntry =>
    Boolean(entry && (!entry.expiresAt || entry.expiresAt > Date.now()));
  return {
    memoryRedis: {
      store,
      async get(key: string) {
        const entry = store.get(key);
        if (!alive(entry)) {
          store.delete(key);
          return null;
        }
        return entry.value;
      },
      async set(key: string, value: string, ...args: Array<string | number>) {
        let ttl: number | undefined;
        for (let index = 0; index < args.length; index += 1) {
          if (args[index] === 'EX') ttl = Number(args[index + 1]);
        }
        store.set(key, {
          value,
          expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
        });
        return 'OK';
      },
    },
  };
});

vi.mock('../redis', () => ({ getRedis: () => memoryRedis }));

import {
  readLearningObjectiveDerivationProgress,
  writeLearningObjectiveDerivationProgress,
} from './learningObjectiveDerivationProgress';

const correlation = {
  schemaVersion: 1 as const,
  operationId: '11111111-1111-4111-8111-111111111111',
  quizId: '22222222-2222-4222-8222-222222222222',
  expectedBundleRevision: 4,
};
const progress = {
  completedGroups: 1,
  totalGroups: 3,
  elapsedMs: 12_500,
  promptTokens: 240,
  completionTokens: 48,
  queuedObjectives: 2,
};

describe('learning-objective derivation progress store', () => {
  afterEach(() => {
    memoryRedis.store.clear();
  });

  it('returns progress only for the exact operation binding', async () => {
    await writeLearningObjectiveDerivationProgress({ ...correlation, progress });

    await expect(readLearningObjectiveDerivationProgress(correlation)).resolves.toEqual(progress);
    await expect(
      readLearningObjectiveDerivationProgress({
        ...correlation,
        quizId: '33333333-3333-4333-8333-333333333333',
      }),
    ).resolves.toBeNull();
    await expect(
      readLearningObjectiveDerivationProgress({
        ...correlation,
        expectedBundleRevision: 5,
      }),
    ).resolves.toBeNull();
  });

  it('ignores corrupt stored payloads', async () => {
    memoryRedis.store.set(`learning-objective-derivation:progress:v1:${correlation.operationId}`, {
      value: '{not-json',
    });

    await expect(readLearningObjectiveDerivationProgress(correlation)).resolves.toBeNull();
  });
});
