import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  QA_ASSEMBLY_EXPECTED_RANKING,
  QA_ASSEMBLY_FEATURED_QUESTIONS,
  QA_ASSEMBLY_RATING_COUNT,
  buildQaAssemblyQuestion,
  buildQaAssemblyVotePlan,
} from './lib/qa-scale-realistic-session.mjs';

test('erzeugt 25.000 fachlich lesbare Fragen für eine Mitarbeitervollversammlung', () => {
  const questions = Array.from({ length: 2_500 }, (_, participantIndex) =>
    Array.from({ length: 10 }, (_, questionIndex) =>
      buildQaAssemblyQuestion(participantIndex, questionIndex),
    ),
  ).flat();

  assert.equal(questions.length, 25_000);
  assert.equal(new Set(questions).size >= 1_000, true);
  assert.equal(
    questions.every((question) => question.length >= 40 && question.length <= 500),
    true,
  );
  assert.deepEqual(
    questions.slice(0, 51).filter((_, index) => index % 10 === 0),
    QA_ASSEMBLY_FEATURED_QUESTIONS.map((question) => question.text),
  );
});

test('verteilt Zustimmung und Ablehnung reproduzierbar ohne Selbst- oder Doppelvotes', () => {
  const plan = buildQaAssemblyVotePlan(2_500);
  assert.equal(plan.length, QA_ASSEMBLY_RATING_COUNT);

  for (const [featureIndex, expected] of QA_ASSEMBLY_FEATURED_QUESTIONS.entries()) {
    const votes = plan.filter((vote) => vote.featureIndex === featureIndex);
    assert.equal(votes.filter((vote) => vote.direction === 'UP').length, expected.positiveVotes);
    assert.equal(votes.filter((vote) => vote.direction === 'DOWN').length, expected.negativeVotes);
    assert.equal(
      votes.some((vote) => vote.voterIndex === featureIndex),
      false,
    );
    assert.equal(new Set(votes.map((vote) => vote.voterIndex)).size, votes.length);
  }
});

test('definiert robuste Mehrheits- und Kontroversenspitzen getrennt', () => {
  assert.equal(QA_ASSEMBLY_EXPECTED_RANKING.TOP, 0);
  assert.equal(QA_ASSEMBLY_EXPECTED_RANKING.BEST, 0);
  assert.equal(QA_ASSEMBLY_EXPECTED_RANKING.CONTROVERSIAL, 4);
  assert.equal(
    QA_ASSEMBLY_FEATURED_QUESTIONS[0].positiveVotes >
      QA_ASSEMBLY_FEATURED_QUESTIONS[4].positiveVotes,
    true,
  );
  assert.equal(
    Math.abs(
      QA_ASSEMBLY_FEATURED_QUESTIONS[4].positiveVotes -
        QA_ASSEMBLY_FEATURED_QUESTIONS[4].negativeVotes,
    ) <= 20,
    true,
  );
});
