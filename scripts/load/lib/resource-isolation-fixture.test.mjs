import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1,
  ModerationPromptQuestionSchema,
  QaQuestionStatusEnum,
  SubmitQaQuestionInputSchema,
} from '@arsnova/shared-types';
import {
  buildResourceIsolationFixture,
  hashResourceIsolationFixture,
  serializeResourceIsolationFixture,
} from './resource-isolation-fixture.mjs';

test('matches the versioned fixture manifest used to identify measurement inputs', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../fixtures/resource-isolation-v1.manifest.json', import.meta.url),
      'utf8',
    ),
  );
  const fixture = buildResourceIsolationFixture();
  assert.equal(hashResourceIsolationFixture(fixture), manifest.sha256);
  assert.equal(fixture.fixtureVersion, manifest.fixtureVersion);
  assert.equal(fixture.seed, manifest.seed);
  assert.equal(fixture.locale, manifest.locale);
  assert.equal(fixture.reference.participantBasis.value, manifest.referenceParticipantCount);
  assert.equal(fixture.analysis.questions.length, manifest.eligibleQuestions);
  assert.equal(fixture.analysis.exclusionControls.length, manifest.exclusionControls);
  assert.deepEqual(fixture.sharedArtifact, manifest.sharedArtifact);
});

test('preserves all six source questions, rankings and original moderation states', () => {
  const original = structuredClone(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1);
  const fixture = buildResourceIsolationFixture();
  assert.equal(fixture.reference.participantBasis.value, 200);
  assert.deepEqual(
    fixture.reference.questions.map(({ key, text, context }) => ({
      key,
      text,
      positive: context.votes.positive,
      negative: context.votes.negative,
      status: context.status,
    })),
    [
      {
        key: 'A',
        text: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[0].text,
        positive: 80,
        negative: 30,
        status: 'PENDING',
      },
      {
        key: 'B',
        text: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[1].text,
        positive: 10,
        negative: 0,
        status: 'ACTIVE',
      },
      {
        key: 'C',
        text: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[2].text,
        positive: 30,
        negative: 0,
        status: 'PINNED',
      },
      {
        key: 'D',
        text: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[3].text,
        positive: 12,
        negative: 0,
        status: 'PENDING',
      },
      {
        key: 'E',
        text: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[4].text,
        positive: 40,
        negative: 40,
        status: 'ACTIVE',
      },
      {
        key: 'F',
        text: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[5].text,
        positive: 20,
        negative: 20,
        status: 'PENDING',
      },
    ],
  );
  for (const { context } of fixture.reference.questions) {
    assert.deepEqual(
      context,
      original.context.questions.items.find(({ sourceId }) => sourceId === context.sourceId),
    );
    ModerationPromptQuestionSchema.parse(context);
  }
  fixture.reference.questions[0].context.votes.positive = 999;
  assert.deepEqual(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1, original);
  assert.equal(buildResourceIsolationFixture().reference.questions[0].context.votes.positive, 80);
});

test('distinguishes unavailable votes, actual zero votes, uncertainty and pending moderation', () => {
  const fixture = buildResourceIsolationFixture();
  const cases = Object.fromEntries(fixture.counterCases.map((entry) => [entry.key, entry.context]));
  assert.deepEqual(cases['missing-votes'].votes, { state: 'unavailable', reason: 'not-collected' });
  assert.equal(cases.unrated.votes.state, 'available');
  assert.equal(cases.unrated.votes.total, 0);
  assert.deepEqual(cases.unrated.votes.bestScore, { state: 'available', value: 0 });
  assert.equal(cases['uncertain-nlp'].nlp.state, 'uncertain');
  assert.equal(cases.pending.status, 'PENDING');
  for (const { context } of fixture.counterCases) ModerationPromptQuestionSchema.parse(context);
  assert.ok(!fixture.analysis.questions.some(({ key }) => key === 'missing-votes'));
});

test('projects exactly 500 distinct eligible texts without losing reference vote counts', () => {
  const fixture = buildResourceIsolationFixture();
  const questions = fixture.analysis.questions;
  assert.equal(questions.length, 500);
  assert.equal(new Set(questions.map(({ key }) => key)).size, 500);
  assert.equal(new Set(questions.map(({ text }) => text)).size, 500);
  for (const question of questions) {
    assert.ok(['ACTIVE', 'PINNED'].includes(question.status));
    assert.equal(question.upvoteCount, question.positiveVoteCount - question.negativeVoteCount);
    SubmitQaQuestionInputSchema.shape.text.parse(question.text);
  }
  assert.equal(questions.find(({ key }) => key === 'A').status, 'ACTIVE');
  assert.equal(questions.find(({ key }) => key === 'A').upvoteCount, 50);
  assert.equal(questions.find(({ key }) => key === 'C').status, 'PINNED');
  assert.equal(questions.find(({ key }) => key === 'unrated').upvoteCount, 0);
  assert.equal(fixture.reference.questions[0].context.status, 'PENDING');
  assert.deepEqual(
    fixture.analysis.exclusionControls.map(({ status }) => status),
    ['PENDING', 'ARCHIVED', 'DELETED'],
  );
  for (const row of fixture.analysis.exclusionControls) {
    QaQuestionStatusEnum.parse(row.status);
    assert.ok(!questions.some(({ key }) => key === row.key));
  }
});

test('reproduces content across builds and seeds without sharing mutable state', () => {
  const first = buildResourceIsolationFixture({ seed: 0 });
  const second = buildResourceIsolationFixture({ seed: 0 });
  const different = buildResourceIsolationFixture({ seed: 1 });
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.analysis.questions.slice(8), different.analysis.questions.slice(8));
  first.analysis.questions[8].text = 'Changed synthetic text';
  assert.notEqual(first.analysis.questions[8].text, second.analysis.questions[8].text);
  assert.equal(buildResourceIsolationFixture({ seed: 0xffffffff }).analysis.questions.length, 500);
  for (const seed of [-1, 0x100000000, 1.5, NaN, Infinity, '1', null]) {
    assert.throws(() => buildResourceIsolationFixture({ seed }), /seed/);
  }
});

test('hashes canonical UTF-8 content and detects changes to texts, votes, flags and seed', () => {
  const fixture = buildResourceIsolationFixture();
  const canonical = serializeResourceIsolationFixture(fixture);
  assert.equal(
    hashResourceIsolationFixture(fixture),
    createHash('sha256').update(canonical, 'utf8').digest('hex'),
  );
  assert.equal(
    serializeResourceIsolationFixture({ b: 2, a: { z: 0, c: 1 } }),
    '{"a":{"c":1,"z":0},"b":2}',
  );
  const reordered = Object.fromEntries(Object.entries(fixture).reverse());
  assert.equal(hashResourceIsolationFixture(reordered), hashResourceIsolationFixture(fixture));
  for (const mutate of [
    (value) => {
      value.analysis.questions[0].text += '!';
    },
    (value) => {
      value.analysis.questions[0].positiveVoteCount += 1;
    },
    (value) => {
      value.analysis.questions[0].status = 'PENDING';
    },
    (value) => {
      value.seed += 1;
    },
    (value) => {
      value.reference.participantBasis.value = 500;
    },
  ]) {
    const changed = structuredClone(fixture);
    mutate(changed);
    assert.notEqual(hashResourceIsolationFixture(changed), hashResourceIsolationFixture(fixture));
  }
});
