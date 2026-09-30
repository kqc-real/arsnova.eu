import type { QaQuestionSortMode } from '@arsnova/shared-types';

/** Ephemerer Host→Presenter-Bühnenkontext (wie Wortwolken-Projektion, pro Session-Code). */
export type QaPresenterStageView = {
  sortMode: QaQuestionSortMode;
  search: string;
  pinnedOnly: boolean;
  authorNickname: string | null;
};

const qaPresenterStageViewByCode = new Map<string, QaPresenterStageView>();

/** Host-Default; Presenter folgt dem Host, bis der Host explizit umschaltet. */
export const QA_PRESENTER_SORT_MODE_DEFAULT: QaQuestionSortMode = 'BEST';

const QA_PRESENTER_STAGE_VIEW_DEFAULT: QaPresenterStageView = {
  sortMode: QA_PRESENTER_SORT_MODE_DEFAULT,
  search: '',
  pinnedOnly: false,
  authorNickname: null,
};

export function setQaPresenterSortMode(code: string, sortMode: QaQuestionSortMode): void {
  setQaPresenterStageView(code, { sortMode });
}

export function setQaPresenterStageView(
  code: string,
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
  qaPresenterStageViewByCode.set(code.toUpperCase(), normalized);
  return normalized;
}

export function resolveQaPresenterSortMode(code: string): QaQuestionSortMode {
  return resolveQaPresenterStageView(code).sortMode;
}

export function resolveQaPresenterStageView(code: string): QaPresenterStageView {
  return qaPresenterStageViewByCode.get(code.toUpperCase()) ?? QA_PRESENTER_STAGE_VIEW_DEFAULT;
}

export function clearQaPresenterSortMode(code: string): void {
  qaPresenterStageViewByCode.delete(code.toUpperCase());
}

export function clearAllQaPresenterSortModes(): void {
  qaPresenterStageViewByCode.clear();
}
