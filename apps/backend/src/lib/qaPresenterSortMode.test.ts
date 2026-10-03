import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllQaPresenterSortModes,
  clearQaPresenterSortMode,
  resolveQaPresenterStageView,
  setQaPresenterStageView,
} from './qaPresenterSortMode';

describe('qaPresenterSortMode session identity', () => {
  beforeEach(() => clearAllQaPresenterSortModes());

  it('preserves the new session state when a delayed purge clears the old owner', () => {
    setQaPresenterStageView('old-session-id', {
      sortMode: 'TIME',
      search: 'alte frage',
      authorNickname: 'Ada',
    });
    setQaPresenterStageView('new-session-id', {
      sortMode: 'BEST',
      search: 'neue frage',
      authorNickname: 'Grace',
    });

    clearQaPresenterSortMode('old-session-id');

    expect(resolveQaPresenterStageView('old-session-id')).toMatchObject({
      sortMode: 'BEST',
      search: '',
      authorNickname: null,
    });
    expect(resolveQaPresenterStageView('new-session-id')).toMatchObject({
      sortMode: 'BEST',
      search: 'neue frage',
      authorNickname: 'Grace',
    });
  });
});
