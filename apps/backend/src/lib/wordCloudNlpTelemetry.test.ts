import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';
import {
  beginWordCloudAnalysisTelemetry,
  recordWordCloudAnalyzeTelemetry,
  resetWordCloudNlpTelemetryForTests,
  snapshotWordCloudNlpTelemetry,
} from './wordCloudNlpTelemetry';

describe('wordCloudNlpTelemetry', () => {
  beforeEach(() => {
    resetWordCloudNlpTelemetryForTests();
  });

  it('zaehlt Hits, Misses, Sidecar und Timeouts ohne Rohtexte', () => {
    recordWordCloudAnalyzeTelemetry({
      sessionCode: 'ABC123',
      mode: 'LEXICAL',
      metric: 'TOP',
      normalization: 'LEMMA',
      normalizationApplied: 'LEMMA',
      fallbackReason: null,
      durationMs: 12,
      itemCount: 2,
      snapshotCache: 'miss',
      textCacheHits: 1,
      textCacheMisses: 1,
      sidecarCalled: true,
    });
    recordWordCloudAnalyzeTelemetry({
      sessionCode: 'ABC123',
      mode: 'LEXICAL',
      metric: 'TOP',
      normalization: 'LEMMA',
      normalizationApplied: 'NONE',
      fallbackReason: 'TIMEOUT',
      durationMs: 5000,
      itemCount: 2,
      snapshotCache: 'hit',
      textCacheHits: 0,
      textCacheMisses: 0,
      sidecarCalled: false,
    });

    expect(snapshotWordCloudNlpTelemetry()).toEqual({
      snapshotHits: 1,
      snapshotMisses: 1,
      textHits: 1,
      textMisses: 1,
      sidecarCalls: 1,
      timeouts: 1,
      fallbacks: 1,
      inFlight: 0,
      lastLatencyMs: 5000,
    });
  });

  it('begrenzt Inflight auf laufende Analysen und beendet idempotent', () => {
    const finishFirst = beginWordCloudAnalysisTelemetry();
    const finishSecond = beginWordCloudAnalysisTelemetry();
    expect(snapshotWordCloudNlpTelemetry().inFlight).toBe(2);

    finishFirst();
    finishFirst();
    expect(snapshotWordCloudNlpTelemetry().inFlight).toBe(1);

    finishSecond();
    expect(snapshotWordCloudNlpTelemetry().inFlight).toBe(0);
  });

  it('unterscheidet LLM-Aufruf, Modellannahme und Labelcache im Analyse-Log', () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => logger);
    recordWordCloudAnalyzeTelemetry({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      metric: 'BEST',
      normalization: 'NONE',
      normalizationApplied: 'NONE',
      fallbackReason: null,
      durationMs: 42,
      itemCount: 100,
      snapshotCache: 'miss',
      textCacheHits: 0,
      textCacheMisses: 0,
      sidecarCalled: false,
      encoderCalled: true,
      labelSettlement: 'complete',
      labelModelAccepted: true,
      labelModelCalled: false,
      labelCacheHits: 3,
      labelCacheMisses: 0,
    });

    expect(info).toHaveBeenCalledWith(
      'wordcloud:analyze',
      expect.objectContaining({
        labelModelAccepted: true,
        labelModelCalled: false,
        labelCacheHits: 3,
        labelCacheMisses: 0,
      }),
    );
    info.mockRestore();
  });
});
