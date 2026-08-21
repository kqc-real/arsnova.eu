import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  holdSemanticPendingProgress,
  isSemanticTopicCloudResult,
  remainingSemanticPendingHoldMs,
  semanticPendingWaitHintKind,
  WORD_CLOUD_SEMANTIC_MANY_ITEMS_THRESHOLD,
  WORD_CLOUD_SEMANTIC_PENDING_MIN_MS,
  WORD_CLOUD_SEMANTIC_WAIT_HINT_AFTER_MS,
} from './word-cloud-semantic-pending';

describe('word-cloud-semantic-pending', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('haelt den Rest bis zur Mindestanzeige', () => {
    expect(remainingSemanticPendingHoldMs(1_000, 1_200)).toBe(
      WORD_CLOUD_SEMANTIC_PENDING_MIN_MS - 200,
    );
    expect(remainingSemanticPendingHoldMs(1_000, 1_000 + WORD_CLOUD_SEMANTIC_PENDING_MIN_MS)).toBe(
      0,
    );
    expect(remainingSemanticPendingHoldMs(0, 5_000)).toBe(WORD_CLOUD_SEMANTIC_PENDING_MIN_MS);
  });

  it('wartet den Rest, statt sofort aufzuloesen', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const pending = holdSemanticPendingProgress(10_000);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(WORD_CLOUD_SEMANTIC_PENDING_MIN_MS - 200);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    await pending;
    expect(settled).toBe(true);
  });

  it('zeigt den Zeit-Hinweis erst nach der Wartezeit und grob nach Menge', () => {
    expect(semanticPendingWaitHintKind(WORD_CLOUD_SEMANTIC_WAIT_HINT_AFTER_MS - 1, 500)).toBe(
      'none',
    );
    expect(semanticPendingWaitHintKind(WORD_CLOUD_SEMANTIC_WAIT_HINT_AFTER_MS, 12)).toBe('moment');
    expect(
      semanticPendingWaitHintKind(
        WORD_CLOUD_SEMANTIC_WAIT_HINT_AFTER_MS,
        WORD_CLOUD_SEMANTIC_MANY_ITEMS_THRESHOLD,
      ),
    ).toBe('minute');
  });

  it('erkennt nur ready/uncertain Cluster als Themenwolke', () => {
    expect(isSemanticTopicCloudResult({ mode: 'SEMANTIC', status: 'ready' })).toBe(true);
    expect(isSemanticTopicCloudResult({ mode: 'SEMANTIC', status: 'uncertain' })).toBe(true);
    expect(isSemanticTopicCloudResult({ mode: 'SEMANTIC', status: 'disabled' })).toBe(false);
    expect(isSemanticTopicCloudResult({ mode: 'SEMANTIC', status: 'fallback' })).toBe(false);
    expect(isSemanticTopicCloudResult({ mode: 'THEME', status: 'ready' })).toBe(false);
    expect(isSemanticTopicCloudResult(null)).toBe(false);
  });
});
