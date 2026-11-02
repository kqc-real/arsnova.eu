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

  it('behält Filter und Presenter-Sortierung, bis der Host sie übernimmt', () => {
    setQaPresenterStageView('session-id', {
      sortMode: 'BEST',
      search: 'mittelwert',
      pinnedOnly: true,
      authorNickname: 'Ada',
    });

    const fromPresenter = setQaPresenterStageView('session-id', {
      sortMode: 'TIME',
      search: '',
      source: 'presenter',
    });
    expect(fromPresenter).toMatchObject({
      sortMode: 'TIME',
      search: 'mittelwert',
      pinnedOnly: true,
      authorNickname: 'Ada',
      source: 'presenter',
    });

    const ignoredHostWrite = setQaPresenterStageView('session-id', {
      sortMode: 'TOP',
      search: '',
    });
    expect(ignoredHostWrite.sortMode).toBe('TIME');
    expect(ignoredHostWrite.source).toBe('presenter');

    const takeover = setQaPresenterStageView(
      'session-id',
      { sortMode: 'CONTROVERSIAL', search: 'neu' },
      { takeover: true },
    );
    expect(takeover).toMatchObject({
      sortMode: 'CONTROVERSIAL',
      search: 'neu',
      pinnedOnly: false,
      authorNickname: null,
      source: 'host',
    });
  });
});
