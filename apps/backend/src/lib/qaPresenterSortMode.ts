import type { QaQuestionSortMode } from '@arsnova/shared-types';

/** Ephemerer Host→Presenter-Bühnenkontext, gebunden an die unveränderliche Session-ID. */
export type QaPresenterStageView = {
  sortMode: QaQuestionSortMode;
  search: string;
  pinnedOnly: boolean;
  authorNickname: string | null;
};

const qaPresenterStageViewBySessionId = new Map<string, QaPresenterStageView>();

/** Host-Default; Presenter folgt dem Host, bis der Host explizit umschaltet. */
export const QA_PRESENTER_SORT_MODE_DEFAULT: QaQuestionSortMode = 'BEST';

const QA_PRESENTER_STAGE_VIEW_DEFAULT: QaPresenterStageView = {
  sortMode: QA_PRESENTER_SORT_MODE_DEFAULT,
  search: '',
  pinnedOnly: false,
  authorNickname: null,
};

export function setQaPresenterSortMode(sessionId: string, sortMode: QaQuestionSortMode): void {
  setQaPresenterStageView(sessionId, { sortMode });
}

export function setQaPresenterStageView(
  sessionId: string,
  view: {
    sortMode: QaQuestionSortMode;
    search?: string;
    pinnedOnly?: boolean;
    authorNickname?: string | null;
  },
): QaPresenterStageView {
  const normalized: QaPresenterStageView = {
    sortMode: view.sortMode,
    search: (view.search ?? '').trim(),
    pinnedOnly: view.pinnedOnly === true,
    authorNickname: view.authorNickname?.trim() ? view.authorNickname.trim() : null,
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
