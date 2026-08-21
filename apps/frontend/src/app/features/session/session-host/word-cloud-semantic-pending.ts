/** Mindestanzeige der Themen-Vorbereitung, damit Cache-/Fallback-Antworten nicht nur aufblitzen. */
export const WORD_CLOUD_SEMANTIC_PENDING_MIN_MS = 1000;
/** Zeit-Hinweis erst, wenn die Analyse wirklich noch läuft — nicht während des 1-s-Halts. */
export const WORD_CLOUD_SEMANTIC_WAIT_HINT_AFTER_MS = 2000;
export const WORD_CLOUD_SEMANTIC_MANY_ITEMS_THRESHOLD = 100;

export type SemanticPendingWaitHintKind = 'none' | 'moment' | 'minute';

/** Ready/uncertain Themencluster — nicht der 2.x-Phrasen-Fallback. */
export function isSemanticTopicCloudResult(
  result: { readonly mode?: string; readonly status?: string } | null | undefined,
): boolean {
  return (
    result?.mode === 'SEMANTIC' && (result.status === 'ready' || result.status === 'uncertain')
  );
}

export function semanticPendingWaitHintKind(
  pendingElapsedMs: number,
  itemCount: number,
): SemanticPendingWaitHintKind {
  if (pendingElapsedMs < WORD_CLOUD_SEMANTIC_WAIT_HINT_AFTER_MS) {
    return 'none';
  }

  return itemCount >= WORD_CLOUD_SEMANTIC_MANY_ITEMS_THRESHOLD ? 'minute' : 'moment';
}

export function remainingSemanticPendingHoldMs(startedAt: number, now = Date.now()): number {
  if (startedAt <= 0) {
    return WORD_CLOUD_SEMANTIC_PENDING_MIN_MS;
  }

  return Math.max(0, WORD_CLOUD_SEMANTIC_PENDING_MIN_MS - (now - startedAt));
}

export function holdSemanticPendingProgress(startedAt: number): Promise<void> {
  const remaining = remainingSemanticPendingHoldMs(startedAt);
  if (remaining === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, remaining);
  });
}
