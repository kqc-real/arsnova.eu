import { EventEmitter } from 'node:events';

const qaQuestionsEvents = new EventEmitter();
qaQuestionsEvents.setMaxListeners(0);
const qaQuestionsVersions = new Map<string, number>();
const qaQuestionsSignalTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Sicherheitsnetz, falls ein Signal auf einer anderen Instanz verloren geht. */
export const QA_QUESTIONS_SIGNAL_WAIT_MS = 15_000;
/** Host-Token-Prüfung bleibt eng, ohne den 1-Hz-Datenpoll. */
export const QA_QUESTIONS_HOST_SIGNAL_WAIT_MS = 2_000;
export const QA_QUESTIONS_SIGNAL_DEBOUNCE_MS = 150;

function emitQaQuestionsSignalNow(sessionId: string): void {
  const nextVersion = (qaQuestionsVersions.get(sessionId) ?? 0) + 1;
  qaQuestionsVersions.set(sessionId, nextVersion);
  qaQuestionsEvents.emit(sessionId, nextVersion);
}

export function emitQaQuestionsSignal(
  sessionId: string,
  options: { immediate?: boolean } = {},
): void {
  const pendingTimer = qaQuestionsSignalTimers.get(sessionId);
  if (options.immediate) {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      qaQuestionsSignalTimers.delete(sessionId);
    }
    emitQaQuestionsSignalNow(sessionId);
    return;
  }
  if (pendingTimer) {
    return;
  }
  const timer = setTimeout(() => {
    qaQuestionsSignalTimers.delete(sessionId);
    emitQaQuestionsSignalNow(sessionId);
  }, QA_QUESTIONS_SIGNAL_DEBOUNCE_MS);
  timer.unref?.();
  qaQuestionsSignalTimers.set(sessionId, timer);
}

export function getQaQuestionsSignalVersion(sessionId: string): number {
  return qaQuestionsVersions.get(sessionId) ?? 0;
}

export function waitForQaQuestionsSignal(
  sessionId: string,
  currentVersion: number,
  timeoutMs: number,
): Promise<void> {
  if (getQaQuestionsSignalVersion(sessionId) !== currentVersion) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(
      () => {
        qaQuestionsEvents.off(sessionId, onSignal);
        timer = null;
        resolve();
      },
      Math.max(1, timeoutMs),
    );

    const onSignal = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      qaQuestionsEvents.off(sessionId, onSignal);
      resolve();
    };

    qaQuestionsEvents.on(sessionId, onSignal);
  });
}

export function qaSubscriptionWaitMs(
  closesAt: Date | string | null | undefined,
  fallbackMs: number,
  nowMs = Date.now(),
): number {
  if (!closesAt) {
    return Math.max(1, fallbackMs);
  }
  const deadlineMs = closesAt instanceof Date ? closesAt.getTime() : Date.parse(closesAt);
  if (!Number.isFinite(deadlineMs)) {
    return Math.max(1, fallbackMs);
  }
  const remainingMs = deadlineMs - nowMs;
  if (remainingMs <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(fallbackMs, remainingMs));
}

export function resetQaQuestionsSignalsForTests(): void {
  for (const timer of qaQuestionsSignalTimers.values()) {
    clearTimeout(timer);
  }
  qaQuestionsSignalTimers.clear();
  qaQuestionsEvents.removeAllListeners();
  qaQuestionsVersions.clear();
}
