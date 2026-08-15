/**
 * Beobachtbarkeit für Host-Wortwolkenanalysen (Story 1.14b, Phase 6).
 * Loggt Dauer, Fallback, Sidecar-Nutzung und Cache-Hits — ohne Rohtexte oder Socketpfade.
 */
import { logger } from './logger';

export interface WordCloudAnalyzeTelemetryEvent {
  readonly sessionCode: string;
  readonly mode: string;
  readonly metric: string;
  readonly normalization: string;
  readonly normalizationApplied: string;
  readonly fallbackReason: string | null;
  readonly durationMs: number;
  readonly itemCount: number;
  readonly snapshotCache: 'hit' | 'miss';
  readonly textCacheHits: number;
  readonly textCacheMisses: number;
  readonly sidecarCalled: boolean;
}

export interface WordCloudNlpTelemetrySnapshot {
  snapshotHits: number;
  snapshotMisses: number;
  textHits: number;
  textMisses: number;
  sidecarCalls: number;
  timeouts: number;
  fallbacks: number;
}

const counters: WordCloudNlpTelemetrySnapshot = {
  snapshotHits: 0,
  snapshotMisses: 0,
  textHits: 0,
  textMisses: 0,
  sidecarCalls: 0,
  timeouts: 0,
  fallbacks: 0,
};

export function resetWordCloudNlpTelemetryForTests(): void {
  counters.snapshotHits = 0;
  counters.snapshotMisses = 0;
  counters.textHits = 0;
  counters.textMisses = 0;
  counters.sidecarCalls = 0;
  counters.timeouts = 0;
  counters.fallbacks = 0;
}

export function snapshotWordCloudNlpTelemetry(): WordCloudNlpTelemetrySnapshot {
  return { ...counters };
}

export function recordWordCloudAnalyzeTelemetry(event: WordCloudAnalyzeTelemetryEvent): void {
  if (event.snapshotCache === 'hit') {
    counters.snapshotHits += 1;
  } else {
    counters.snapshotMisses += 1;
  }
  counters.textHits += event.textCacheHits;
  counters.textMisses += event.textCacheMisses;
  if (event.sidecarCalled) {
    counters.sidecarCalls += 1;
  }
  if (event.fallbackReason === 'TIMEOUT') {
    counters.timeouts += 1;
  }
  if (event.fallbackReason) {
    counters.fallbacks += 1;
  }

  logger.info('wordcloud:analyze', {
    sessionCode: event.sessionCode,
    mode: event.mode,
    metric: event.metric,
    normalization: event.normalization,
    normalizationApplied: event.normalizationApplied,
    fallbackReason: event.fallbackReason,
    durationMs: event.durationMs,
    itemCount: event.itemCount,
    snapshotCache: event.snapshotCache,
    textCacheHits: event.textCacheHits,
    textCacheMisses: event.textCacheMisses,
    sidecarCalled: event.sidecarCalled,
  });
}
