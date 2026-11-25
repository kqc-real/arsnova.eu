import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1 as ranking,
  MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1 as texte,
} from '@arsnova/shared-types';
import { laborKorpus } from './korpus.mjs';

test('Summary und Breaker behalten den unveränderten Referenzkorpus', () => {
  for (const consumer of ['summary', 'breaker-summary']) {
    const corpus = laborKorpus(consumer);
    assert.equal(corpus.id, 'summary-reference-v1');
    assert.equal(corpus.texte, texte);
    assert.equal(corpus.ranking, ranking);
  }
});

test('Label hat im tatsächlich sichtbaren Korpus ein identisches Paar und ein Gegenbeispiel', () => {
  const corpus = laborKorpus('label');
  const eligible = new Set(
    corpus.ranking.filter((q) => ['ACTIVE', 'PINNED'].includes(q.status)).map((q) => q.key),
  );
  const groups = new Map();
  for (const q of corpus.texte.filter((q) => eligible.has(q.key)))
    groups.set(q.text, (groups.get(q.text) ?? 0) + 1);
  assert.ok(
    [...groups.values()].some((n) => n >= 2),
    'kein sicher clusterbares Paar',
  );
  assert.ok(groups.size >= 2, 'Gegenbeispiel fehlt');
  assert.notEqual(corpus.id, 'summary-reference-v1');
  assert.equal(corpus.ranking, ranking);
  assert.deepEqual(
    corpus.texte.map((q) => q.key),
    texte.map((q) => q.key),
  );
  assert.notEqual(texte.find((q) => q.key === 'B').text, texte.find((q) => q.key === 'C').text);
});
