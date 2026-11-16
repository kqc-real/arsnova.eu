import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summaryOperation, labelOperation } from './auftraege.mjs';

test('Summary pollt bis zum Endstatus und gibt keine Tokens oder Quellen aus', async () => {
  let polls = 0;
  const host = {
    qa: {
      requestSummary: { mutate: async () => ({ result: { status: 'pending' } }) },
      summaryRuntime: {
        query: async () => {
          polls++;
          return {
            result: {
              status: 'ready',
              snapshotHash: 'hash',
              statements: [{}],
              execution: {
                effectiveMode: 'extractive',
                attemptedMode: 'full-context',
                fallback: { reason: 'timeout', retry: 'manual' },
              },
            },
          };
        },
      },
    },
  };
  const r = await summaryOperation({
    hostClient: async () => host,
    sessionId: 'synthetic',
    locale: 'de',
    index: 1,
    wait: async () => {},
  });
  assert.equal(polls, 1);
  assert.equal(r.fallbackReason, 'timeout');
  assert.equal(r.statements, 1);
  assert.equal(r.consumer, 'summary');
  assert.equal(Object.hasOwn(r, 'hostToken'), false);
});
test('beendetes Wartebudget wird nicht als Ergebnis umgedeutet', async () => {
  const host = {
    qa: { requestSummary: { mutate: async () => ({ result: { status: 'pending' } }) } },
  };
  await assert.rejects(
    summaryOperation({
      hostClient: async () => host,
      sessionId: 'x',
      locale: 'de',
      index: 1,
      waitMaxMs: 1,
      now: (() => {
        let t = 0;
        return () => (t += 10);
      })(),
    }),
    /Endstatus/,
  );
});
test('Label ruft den echten SEMANTIC-Hostpfad mit refresh auf und meldet fehlenden Encoder', async () => {
  let input;
  const host = {
    wordCloud: {
      analyzeQa: {
        mutate: async (i) => {
          input = i;
          return { labelSettlement: 'disabled', entries: [] };
        },
      },
    },
  };
  await assert.rejects(
    labelOperation({ hostClient: async () => host, code: 'ABC123', index: 1, locale: 'de' }),
    /Encoder|Label/,
  );
  assert.equal(input.mode, 'SEMANTIC');
  assert.equal(input.refresh, true);
  host.wordCloud.analyzeQa.mutate = async () => ({
    status: 'ready',
    effectiveMode: 'SEMANTIC',
    labelSettlement: 'transient',
    labelModelId: null,
    entries: [],
  });
  assert.equal(
    (await labelOperation({ hostClient: async () => host, code: 'ABC123', index: 1, locale: 'de' }))
      .labelSettlement,
    'transient',
  );
});

test('Label-Abbruch unterscheidet Analysestatus von deaktiviertem Pfad ohne Nutzdaten auszugeben', async () => {
  const host = {
    wordCloud: {
      analyzeQa: {
        mutate: async () => ({
          status: 'failed',
          mode: 'SEMANTIC',
          effectiveMode: 'THEME',
          fallbackUsed: true,
          labelSettlement: null,
          modelVersion: null,
          analyzedQuestionCount: 3,
          entries: [{ text: 'Nicht ins Fehlerprotokoll übernehmen' }],
          hostToken: 'secret-test-token',
        }),
      },
    },
  };
  await assert.rejects(
    labelOperation({ hostClient: async () => host, code: 'ABC123', index: 1, locale: 'de' }),
    (error) => {
      assert.match(error.message, /"status":"failed"/);
      assert.match(error.message, /"fallbackUsed":true/);
      assert.match(error.message, /"labelSettlement":null/);
      assert.match(error.message, /"analyzedQuestionCount":3/);
      assert.doesNotMatch(error.message, /secret-test-token|Nicht ins Fehlerprotokoll/);
      return true;
    },
  );
});
