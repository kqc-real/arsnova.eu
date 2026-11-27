import { DestroyRef, effect, type Injector } from '@angular/core';
import type { AnalyzeWordCloudOutput, AnalyzeWordCloudInput } from '@arsnova/shared-types';

type TopicSnapshot = Exclude<AnalyzeWordCloudInput['topicLabels'], 'preview' | undefined>;

export async function enrichCurrentTopicCloud<T extends AnalyzeWordCloudOutput>(options: {
  readonly base: T;
  readonly injector: Injector;
  readonly signal?: AbortSignal;
  readonly isCurrent: () => boolean;
  readonly fetch: (snapshot: TopicSnapshot, signal: AbortSignal) => Promise<T>;
  readonly apply: (update: T) => void;
  readonly onPendingChange?: (pending: boolean) => void;
}): Promise<void> {
  const { base } = options;
  if (!base.topicLabelsPending || options.signal?.aborted || !options.isCurrent()) return;
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;
  const unregister = options.injector.get(DestroyRef).onDestroy(() => controller.abort());
  const watcher = effect(
    () => {
      if (!options.isCurrent()) controller.abort();
    },
    { injector: options.injector },
  );
  let waiting = true;
  const stopWaiting = () => {
    if (!waiting) return;
    waiting = false;
    options.onPendingChange?.(false);
  };
  signal.addEventListener('abort', stopWaiting, { once: true });
  options.onPendingChange?.(true);
  const settlePreview = () => {
    if (!signal.aborted && options.isCurrent()) {
      options.apply({ ...base, topicLabelsPending: false });
    }
  };
  try {
    const result = await options.fetch({ snapshotHash: base.snapshotHash }, signal);
    if (signal.aborted || !options.isCurrent()) return;
    if (result.snapshotHash !== base.snapshotHash) {
      settlePreview();
      return;
    }
    const labels = new Map(
      result.entries.map(({ key, label, labelOrigin }) => [key, { label, labelOrigin }]),
    );
    options.apply({
      ...base,
      topicLabelsPending: false,
      labelSettlement: result.labelSettlement,
      labelFallbackReason: result.labelFallbackReason,
      reuse: base.reuse || result.reuse ? { ...base.reuse, ...result.reuse } : undefined,
      labelModelId: result.labelModelId,
      labelModelVersion: result.labelModelVersion,
      labelPromptVersion: result.labelPromptVersion,
      entries: base.entries.map((entry) => ({ ...entry, ...labels.get(entry.key) })),
    });
  } catch {
    settlePreview();
  } finally {
    signal.removeEventListener('abort', stopWaiting);
    stopWaiting();
    watcher.destroy();
    unregister();
  }
}
