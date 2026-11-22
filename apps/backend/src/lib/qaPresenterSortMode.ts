import type { QaPresenterSortSource, QaQuestionSortMode } from '@arsnova/shared-types';
import {
  readSessionPresenterState,
  updateSessionPresenterState,
  type SessionPresenterState,
} from './sessionPresenterState';

/** Ephemerer Host→Presenter-Bühnenkontext, gebunden an die unveränderliche Session-ID. */
export type QaPresenterStageView = NonNullable<SessionPresenterState['qaStageView']>;

/** Host-Default; Presenter folgt dem Host, bis der Host explizit umschaltet. */
export const QA_PRESENTER_SORT_MODE_DEFAULT: QaQuestionSortMode = 'BEST';

export const QA_PRESENTER_STAGE_VIEW_DEFAULT: QaPresenterStageView = {
  sortMode: QA_PRESENTER_SORT_MODE_DEFAULT,
  search: '',
  pinnedOnly: false,
  authorNickname: null,
  source: 'host',
};

export async function readStoredQaPresenterStageView(
  sessionId: string,
): Promise<QaPresenterStageView | undefined> {
  return (await readSessionPresenterState(sessionId)).qaStageView;
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
): Promise<QaPresenterStageView> {
  return updateSessionPresenterState(sessionId, (state) => {
    const stored = state.qaStageView;
    const source = view.source ?? 'host';
    // Automatische Host-Republishes lassen eine am Presenter gewählte Sortierung stehen.
    if (stored?.source === 'presenter' && source === 'host' && options?.takeover !== true) {
      return stored;
    }
    const keepFilters = source === 'presenter' && stored !== undefined;
    const normalized: QaPresenterStageView = {
      sortMode: view.sortMode,
      search: keepFilters ? stored.search : (view.search ?? '').trim(),
      pinnedOnly: keepFilters ? stored.pinnedOnly : view.pinnedOnly === true,
      authorNickname: keepFilters ? stored.authorNickname : view.authorNickname?.trim() || null,
      source,
    };
    state.qaStageView = normalized;
    return normalized;
  });
}

export async function resolveQaPresenterStageView(
  sessionId: string,
): Promise<QaPresenterStageView> {
  return (await readStoredQaPresenterStageView(sessionId)) ?? QA_PRESENTER_STAGE_VIEW_DEFAULT;
}

export async function resolveQaPresenterSortMode(sessionId: string): Promise<QaQuestionSortMode> {
  return (await resolveQaPresenterStageView(sessionId)).sortMode;
}
