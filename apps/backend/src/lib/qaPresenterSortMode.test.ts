import { beforeEach, describe, expect, it } from 'vitest';
import { resolveQaPresenterStageView, setQaPresenterStageView } from './qaPresenterSortMode';
import { clearLocalSessionPresenterState } from './sessionPresenterState';

describe('qaPresenterSortMode session identity', async () => {
  beforeEach(() => clearLocalSessionPresenterState());

  it('preserves the new session state when a delayed purge clears the old owner', async () => {
    await setQaPresenterStageView('old-session-id', {
      sortMode: 'TIME',
      search: 'alte frage',
      authorNickname: 'Ada',
    });
    await setQaPresenterStageView('new-session-id', {
      sortMode: 'BEST',
      search: 'neue frage',
      authorNickname: 'Grace',
    });

    clearLocalSessionPresenterState('old-session-id');

    expect(await resolveQaPresenterStageView('old-session-id')).toMatchObject({
      sortMode: 'BEST',
      search: '',
      authorNickname: null,
    });
    expect(await resolveQaPresenterStageView('new-session-id')).toMatchObject({
      sortMode: 'BEST',
      search: 'neue frage',
      authorNickname: 'Grace',
    });
  });

  it('behält Filter und Presenter-Sortierung, bis der Host sie übernimmt', async () => {
    await setQaPresenterStageView('session-id', {
      sortMode: 'BEST',
      search: 'mittelwert',
      pinnedOnly: true,
      authorNickname: 'Ada',
    });

    const fromPresenter = await setQaPresenterStageView('session-id', {
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

    const ignoredHostWrite = await setQaPresenterStageView('session-id', {
      sortMode: 'TOP',
      search: '',
    });
    expect(ignoredHostWrite.sortMode).toBe('TIME');
    expect(ignoredHostWrite.source).toBe('presenter');

    const takeover = await setQaPresenterStageView(
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
