import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisHashes = new Map<string, Map<string, number>>();
const appliedFlushKeys = new Set<string>();
let failNextRedisEval = false;

vi.mock('../redis', () => ({
  getRedis: vi.fn(() => ({
    eval: vi.fn(async (_script: string, _numKeys: number, flushKey: string, ...args: string[]) => {
      if (failNextRedisEval) {
        failNextRedisEval = false;
        throw new Error('redis transient failure');
      }
      if (appliedFlushKeys.has(flushKey)) {
        return 0;
      }
      appliedFlushKeys.add(flushKey);
      for (let index = 1; index < args.length; index += 4) {
        const hashKey = args[index]!;
        const field = args[index + 1]!;
        const delta = Number.parseInt(args[index + 2]!, 10);
        const hash = redisHashes.get(hashKey) ?? new Map<string, number>();
        hash.set(field, (hash.get(field) ?? 0) + delta);
        redisHashes.set(hashKey, hash);
      }
      return 1;
    }),
    multi: vi.fn(() => {
      const keys: string[] = [];
      return {
        hgetall(key: string) {
          keys.push(key);
          return this;
        },
        async exec() {
          return keys.map((key) => {
            const hash = redisHashes.get(key);
            return [
              null,
              hash
                ? Object.fromEntries(
                    Array.from(hash.entries(), ([field, count]) => [field, String(count)]),
                  )
                : {},
            ] as const;
          });
        },
      };
    }),
  })),
}));

import {
  flushQaApiDiagnostics,
  QA_API_DIAGNOSTICS_WINDOW_MS,
  readClusterQaApiDiagnostics,
  recordQaApiDiagnostic,
  resetQaApiDiagnosticsForTests,
  snapshotQaApiDiagnostics,
} from './qaApiDiagnostics';

describe('qaApiDiagnostics', () => {
  beforeEach(() => {
    redisHashes.clear();
    appliedFlushKeys.clear();
    failNextRedisEval = false;
    resetQaApiDiagnosticsForTests();
  });

  it('trennt Erfolg, erwartete Ablehnung und technische Fehler je API-Klasse', () => {
    recordQaApiDiagnostic({ path: 'qa.submit', durationMs: 15 });
    recordQaApiDiagnostic({
      path: 'qa.submit',
      durationMs: 25,
      errorCode: 'TOO_MANY_REQUESTS',
      errorMessage: 'Fragenkontingent erreicht',
    });
    recordQaApiDiagnostic({
      path: 'qa.submit',
      durationMs: 35,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'interner Fehler',
    });

    expect(snapshotQaApiDiagnostics().QA_SUBMIT).toEqual({
      samples: 3,
      successes: 1,
      expectedRejections: 1,
      technicalErrors: 1,
      p95Ms: 35,
      p99Ms: 35,
      expectedRejectionP95Ms: 25,
      expectedRejectionP99Ms: 25,
      limitRejections: 1,
      deadlineRejections: 0,
    });
  });

  it('ignoriert unbekannte Pfade und hält höchstens 1.000 Laufzeitproben', () => {
    recordQaApiDiagnostic({ path: 'quiz.upload', durationMs: 99 });
    for (let index = 0; index < 1_050; index += 1) {
      recordQaApiDiagnostic({ path: 'qa.list', durationMs: index });
    }

    const snapshot = snapshotQaApiDiagnostics();
    expect(snapshot.QA_PAGE.samples).toBe(1_000);
    expect(snapshot.QA_PAGE.successes).toBe(1_000);
    expect(snapshot.QA_PAGE.p99Ms).toBe(1_039);
    expect(Object.keys(snapshot)).not.toContain('quiz.upload');
  });

  it('verwirft veraltete Samples außerhalb des rollierenden 15-Minuten-Fensters', () => {
    const t0 = 1_700_000_000_000;
    recordQaApiDiagnostic({
      path: 'vote.submit',
      durationMs: 900,
      errorCode: 'INTERNAL_SERVER_ERROR',
      nowMs: t0,
    });
    recordQaApiDiagnostic({
      path: 'vote.submit',
      durationMs: 40,
      nowMs: t0 + QA_API_DIAGNOSTICS_WINDOW_MS + 1_000,
    });

    const snapshot = snapshotQaApiDiagnostics(t0 + QA_API_DIAGNOSTICS_WINDOW_MS + 1_000);
    expect(snapshot.VOTE).toMatchObject({
      samples: 1,
      successes: 1,
      technicalErrors: 0,
      p95Ms: 40,
    });
  });

  it('aggregiert Replikat-Samples clusterweit über Redis-Minutenbuckets ohne Doppelzählung bei Retry', async () => {
    const nowMs = 1_700_000_040_000;
    // Replikat A: 12 schnelle Joins im vorherigen Minutenbucket
    for (let i = 0; i < 12; i += 1) {
      recordQaApiDiagnostic({ path: 'session.join', durationMs: 120, nowMs: nowMs - 60_000 });
    }
    failNextRedisEval = true;
    await flushQaApiDiagnostics();
    // Retry mit identischer Flush-ID wendet das Batch genau einmal an
    await flushQaApiDiagnostics();

    // Replikat B (simuliert nach lokalem Reset): 10 weitere Joins + 2 Limit-Ablehnungen im aktuellen Bucket
    resetQaApiDiagnosticsForTests();
    for (let i = 0; i < 10; i += 1) {
      recordQaApiDiagnostic({ path: 'session.join', durationMs: 240, nowMs });
    }
    recordQaApiDiagnostic({
      path: 'session.join',
      durationMs: 30,
      errorCode: 'TOO_MANY_REQUESTS',
      errorMessage: 'Limit erreicht',
      nowMs,
    });
    recordQaApiDiagnostic({
      path: 'session.join',
      durationMs: 45,
      errorCode: 'FORBIDDEN',
      errorMessage: 'Session geschlossen',
      nowMs,
    });

    const cluster = await readClusterQaApiDiagnostics({ nowMs, forceCluster: true });
    expect(cluster.JOIN_REJOIN).toEqual({
      samples: 24,
      successes: 22,
      expectedRejections: 2,
      technicalErrors: 0,
      p95Ms: 250,
      p99Ms: 250,
      expectedRejectionP95Ms: 50,
      expectedRejectionP99Ms: 50,
      limitRejections: 1,
      deadlineRejections: 1,
    });
  });
});
