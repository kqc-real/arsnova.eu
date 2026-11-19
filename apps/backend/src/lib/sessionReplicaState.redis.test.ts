import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

async function loadReplica() {
  vi.resetModules();
  return {
    ...(await import('../redis')),
    ...(await import('./sessionRuntimeDataPurge')),
    ...(await import('./sessionPresenterState')),
    ...(await import('./qaPresenterSortMode')),
    ...(await import('./sessionEmojiReactions')),
  };
}

describe.skipIf(process.env['RUN_REDIS_SESSION_REPLICA_TESTS'] !== '1')(
  'Gemeinsamer Presenter- und Emoji-Zustand mit echtem Redis',
  () => {
    let appA: Awaited<ReturnType<typeof loadReplica>>;
    let appB: Awaited<ReturnType<typeof loadReplica>>;
    const sessions: string[] = [];

    function newSession() {
      const id = randomUUID();
      sessions.push(id);
      return id;
    }

    beforeAll(async () => {
      vi.stubEnv('SESSION_STATUS_PUBSUB_ENABLED', 'true');
      appA = await loadReplica();
      appB = await loadReplica();
      expect(appA.getRedis()).not.toBe(appB.getRedis());
    });

    afterAll(async () => {
      try {
        if (sessions.length > 0) {
          await appA
            .getRedis()
            .del(
              ...sessions.flatMap((id) => [
                appA.buildSessionPresenterStateKey(id),
                appA.buildSessionEmojiReactionsKey(id),
                appA.buildSessionRuntimeDataPurgeFenceKey(id),
              ]),
            );
        }
      } finally {
        await Promise.all([appA?.closeRedis(), appB?.closeRedis()]);
        vi.unstubAllEnvs();
      }
    });

    it('liest Fläche und Seitenkontext auf B und erhält konkurrierende Seitenschritte', async () => {
      const sessionId = newSession();
      const page = { context: randomUUID(), index: 0, count: 5, sectionStarts: [0, 3] };
      await appA.updateSessionPresenterState(sessionId, (state) => {
        state.surface = 'qaWordCloud';
        state.page = page;
        state.pageIdentity = 'qa:1';
      });
      await expect(appB.readSessionPresenterState(sessionId)).resolves.toMatchObject({
        surface: 'qaWordCloud',
        page,
      });
      const move = (app: typeof appA) =>
        app.updateSessionPresenterState(sessionId, (state) => {
          if (!state.page) throw new Error('Fehlender Seitenkontext');
          state.page = { ...state.page, index: state.page.index + 1 };
        });
      await Promise.all([move(appA), move(appB)]);
      await expect(appA.readSessionPresenterState(sessionId)).resolves.toMatchObject({
        surface: 'qaWordCloud',
        page: { ...page, index: 2 },
      });
    });

    it('teilt Q&A-Filter und erhält die Presenter-Übernahme bis zum expliziten Host-Wechsel', async () => {
      const sessionId = newSession();
      const filter = { search: 'Redis', pinnedOnly: true, authorNickname: 'Ada' };
      await appA.setQaPresenterStageView(sessionId, { ...filter, sortMode: 'BEST' });
      await expect(appB.resolveQaPresenterStageView(sessionId)).resolves.toEqual({
        ...filter,
        sortMode: 'BEST',
        source: 'host',
      });
      await appB.setQaPresenterStageView(sessionId, { sortMode: 'TIME', source: 'presenter' });
      await appA.setQaPresenterStageView(sessionId, { sortMode: 'BEST' });
      await expect(appA.resolveQaPresenterStageView(sessionId)).resolves.toEqual({
        ...filter,
        sortMode: 'TIME',
        source: 'presenter',
      });
      await appA.setQaPresenterStageView(
        sessionId,
        { sortMode: 'BEST', search: 'Yjs' },
        { takeover: true },
      );
      await expect(appB.resolveQaPresenterStageView(sessionId)).resolves.toEqual({
        sortMode: 'BEST',
        search: 'Yjs',
        pinnedOnly: false,
        authorNickname: null,
        source: 'host',
      });
    });

    it('ersetzt Emoji-Reaktionen über Replikate hinweg und trennt Fragen und Runden', async () => {
      const scope = { sessionId: newSession(), questionId: randomUUID(), round: 1 };
      await appA.recordSessionEmojiReaction(scope, 'first', '👏');
      await expect(appB.readSessionEmojiReactions(scope)).resolves.toMatchObject({
        total: 1,
        reactions: { '👏': 1 },
      });
      await Promise.all([
        appA.recordSessionEmojiReaction(scope, 'first', '🎉'),
        appB.recordSessionEmojiReaction(scope, 'first', '🎉'),
        appB.recordSessionEmojiReaction(scope, 'second', '👏'),
        appA.recordSessionEmojiReaction({ ...scope, round: 2 }, 'first', '😂'),
      ]);
      await expect(appA.readSessionEmojiReactions(scope)).resolves.toMatchObject({
        total: 2,
        reactions: { '👏': 1, '🎉': 1, '😂': 0 },
      });
      await expect(appB.readSessionEmojiReactions({ ...scope, round: 2 })).resolves.toMatchObject({
        total: 1,
        reactions: { '😂': 1, '🎉': 0 },
      });
      await expect(
        appB.readSessionEmojiReactions({ ...scope, questionId: randomUUID() }),
      ).resolves.toMatchObject({ total: 0 });
    });

    it('löscht beide Zustände und weist späte Writes von der anderen App ab', async () => {
      const scope = { sessionId: newSession(), questionId: randomUUID(), round: 1 };
      const { sessionId } = scope;
      await appA.updateSessionPresenterState(sessionId, (state) => {
        state.surface = 'qaWordCloud';
      });
      await appA.recordSessionEmojiReaction(scope, 'first', '👏');
      await appA.purgeSessionRuntimeData(sessionId);
      await expect(appB.readSessionPresenterState(sessionId)).resolves.toEqual({});
      await expect(appB.readSessionEmojiReactions(scope)).resolves.toMatchObject({ total: 0 });
      await expect(
        appB.updateSessionPresenterState(sessionId, (state) => {
          state.surface = 'qaWordCloud';
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(appB.recordSessionEmojiReaction(scope, 'first', '🎉')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  },
);
