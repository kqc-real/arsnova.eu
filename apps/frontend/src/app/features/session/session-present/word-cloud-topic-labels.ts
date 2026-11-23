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
  try {
    const result = await options.fetch({ snapshotHash: base.snapshotHash }, signal);
    if (signal.aborted || !options.isCurrent() || result.snapshotHash !== base.snapshotHash) return;
    const labels = new Map(
      result.entries.map(({ key, label, labelOrigin }) => [key, { label, labelOrigin }]),
    );
    options.apply({
      ...base,
      topicLabelsPending: false,
      labelSettlement: result.labelSettlement,
      labelModelId: result.labelModelId,
      labelModelVersion: result.labelModelVersion,
      labelPromptVersion: result.labelPromptVersion,
      entries: base.entries.map((entry) => ({ ...entry, ...labels.get(entry.key) })),
    });
  } catch {
    // The current cloud is already displayed and remains usable after a label failure.
  } finally {
    watcher.destroy();
    unregister();
  }
}
