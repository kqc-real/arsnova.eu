import type { QaQuestionSortMode } from '@arsnova/shared-types';

/** Ephemerer Host→Presenter-Sortiermodus (wie Wortwolken-Projektion, pro Session-Code). */
const qaPresenterSortModeByCode = new Map<string, QaQuestionSortMode>();

/** Host-Default; Presenter folgt dem Host, bis der Host explizit umschaltet. */
export const QA_PRESENTER_SORT_MODE_DEFAULT: QaQuestionSortMode = 'BEST';

export function setQaPresenterSortMode(code: string, sortMode: QaQuestionSortMode): void {
  qaPresenterSortModeByCode.set(code.toUpperCase(), sortMode);
}

export function resolveQaPresenterSortMode(code: string): QaQuestionSortMode {
  return qaPresenterSortModeByCode.get(code.toUpperCase()) ?? QA_PRESENTER_SORT_MODE_DEFAULT;
}

export function clearQaPresenterSortMode(code: string): void {
  qaPresenterSortModeByCode.delete(code.toUpperCase());
}

export function clearAllQaPresenterSortModes(): void {
  qaPresenterSortModeByCode.clear();
}
