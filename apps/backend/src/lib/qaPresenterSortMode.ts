import type { QaPresenterSortSource, QaQuestionSortMode } from '@arsnova/shared-types';

/** Ephemerer Host→Presenter-Bühnenkontext, gebunden an die unveränderliche Session-ID. */
export type QaPresenterStageView = {
  sortMode: QaQuestionSortMode;
  search: string;
  pinnedOnly: boolean;
  authorNickname: string | null;
  source: QaPresenterSortSource;
};

const qaPresenterStageViewBySessionId = new Map<string, QaPresenterStageView>();

/** Host-Default; Presenter folgt dem Host, bis der Host explizit umschaltet. */
export const QA_PRESENTER_SORT_MODE_DEFAULT: QaQuestionSortMode = 'BEST';

const QA_PRESENTER_STAGE_VIEW_DEFAULT: QaPresenterStageView = {
  sortMode: QA_PRESENTER_SORT_MODE_DEFAULT,
  search: '',
  pinnedOnly: false,
  authorNickname: null,
  source: 'host',
};

export function setQaPresenterSortMode(sessionId: string, sortMode: QaQuestionSortMode): void {
  setQaPresenterStageView(sessionId, { sortMode });
}

export function hasQaPresenterStageView(sessionId: string): boolean {
  return qaPresenterStageViewBySessionId.has(sessionId);
}

export function setQaPresenterStageView(
  sessionId: string,
  view: {
    sortMode: QaQuestionSortMode;
    search?: string;
    pinnedOnly?: boolean;
    authorNickname?: string | null;
    source?: QaPresenterSortSource;
  },
  options?: { takeover?: boolean },
): QaPresenterStageView {
  const stored = qaPresenterStageViewBySessionId.get(sessionId);
  const source = view.source ?? 'host';
  // Automatische Host-Republishes (Reconnect, Abo, Restart-Heal) lassen eine
  // am Presenter gewählte Sortierung stehen. Nur takeover ersetzt sie.
  if (stored?.source === 'presenter' && source === 'host' && options?.takeover !== true) {
    return stored;
  }
  const keepFilters = source === 'presenter' && stored !== undefined;
  const normalized: QaPresenterStageView = {
    sortMode: view.sortMode,
    search: keepFilters ? stored.search : (view.search ?? '').trim(),
    pinnedOnly: keepFilters ? stored.pinnedOnly : view.pinnedOnly === true,
    authorNickname: keepFilters
      ? stored.authorNickname
      : view.authorNickname?.trim()
        ? view.authorNickname.trim()
        : null,
    source,
  };
  qaPresenterStageViewBySessionId.set(sessionId, normalized);
  return normalized;
}

export function resolveQaPresenterSortMode(sessionId: string): QaQuestionSortMode {
  return resolveQaPresenterStageView(sessionId).sortMode;
}

export function resolveQaPresenterStageView(sessionId: string): QaPresenterStageView {
  return qaPresenterStageViewBySessionId.get(sessionId) ?? QA_PRESENTER_STAGE_VIEW_DEFAULT;
}

export function clearQaPresenterSortMode(sessionId: string): void {
  qaPresenterStageViewBySessionId.delete(sessionId);
}

export function clearAllQaPresenterSortModes(): void {
  qaPresenterStageViewBySessionId.clear();
}
