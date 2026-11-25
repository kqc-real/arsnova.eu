import { createHash } from 'node:crypto';
import {
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1,
  WORD_CLOUD_MAX_ANALYZE_ITEMS,
} from '@arsnova/shared-types';

export const RESOURCE_ISOLATION_FIXTURE_VERSION = 'resource-isolation-fixture-v1';
export const RESOURCE_ISOLATION_FIXTURE_SEED = 0x1a202611;

function assertSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('seed must be an unsigned 32-bit integer.');
  }
}

function projectAnalysisQuestion({ key, text, context }) {
  if (context.votes.state !== 'available') {
    throw new Error('Analysis projection requires available vote counts.');
  }
  return {
    key,
    text: key === 'unrated' || key === 'uncertain-nlp' ? text.replace(/\?$/, ' (0)?') : text,
    status: context.status === 'PINNED' ? 'PINNED' : 'ACTIVE',
    positiveVoteCount: context.votes.positive,
    negativeVoteCount: context.votes.negative,
    upvoteCount: context.votes.net,
  };
}

/** Pure synthetic data: no environment, network, database, clock or random UUIDs. */
export function buildResourceIsolationFixture({ seed = RESOURCE_ISOLATION_FIXTURE_SEED } = {}) {
  assertSeed(seed);
  const source = structuredClone(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1.context.questions);
  const questions = MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1.map(({ key, sourceId, text }) => ({
    key,
    text,
    context: source.items.find((item) => item.sourceId === sourceId),
  }));
  const counterCase = (key, referenceIndex, overrides) => ({
    key,
    text: questions[referenceIndex].text,
    context: {
      ...structuredClone(questions[referenceIndex].context),
      sourceId: `qa-question:lab-${key}`,
      topicSourceIds: [],
      ...overrides,
    },
  });
  const unrated = counterCase('unrated', 0, {
    status: 'ACTIVE',
    votes: {
      state: 'available',
      positive: 0,
      negative: 0,
      net: 0,
      total: 0,
      bestScore: { state: 'available', value: 0 },
      controversyScore: { state: 'available', value: 0 },
    },
    nlp: { state: 'pending' },
  });
  const missingVotes = counterCase('missing-votes', 1, {
    votes: { state: 'unavailable', reason: 'not-collected' },
  });
  const uncertain = counterCase('uncertain-nlp', 5, { status: 'ACTIVE' });
  const pending = counterCase('pending', 3, { status: 'PENDING' });

  // Retain the reference language; numeric suffixes prevent raw-text deduplication.
  // These short controlled variants do not represent natural-language diversity.
  const eligible = [...questions, unrated, uncertain].map(projectAnalysisQuestion);
  let state = seed;
  while (eligible.length < WORD_CLOUD_MAX_ANALYZE_ITEMS) {
    const ordinal = eligible.length - 7;
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const base = questions[state % questions.length];
    eligible.push({
      key: `filler-${String(ordinal).padStart(4, '0')}`,
      text: base.text.replace(/\?$/, ` (${ordinal})?`),
      status: 'ACTIVE',
      positiveVoteCount: 0,
      negativeVoteCount: 0,
      upvoteCount: 0,
    });
  }

  // Distinct controls belong to stored lab data, not the 500-item analysis input.
  const exclusionControls = ['PENDING', 'ARCHIVED', 'DELETED'].map((status) => ({
    ...projectAnalysisQuestion(pending),
    key: `excluded-${status.toLowerCase()}`,
    status,
  }));
  return {
    fixtureVersion: RESOURCE_ISOLATION_FIXTURE_VERSION,
    seed,
    locale: 'de',
    sharedArtifact: { owner: 'Niklas', consumers: ['1A', '1B', '1C'], sourceIssue: 456 },
    reference: { participantBasis: source.participantBasis, questions },
    counterCases: [unrated, missingVotes, uncertain, pending],
    analysis: {
      participantCount: source.participantBasis.value,
      questions: eligible,
      exclusionControls,
    },
  };
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

/** Compact JSON, recursively sorted object keys, preserved array order, no newline. */
export function serializeResourceIsolationFixture(fixture) {
  return JSON.stringify(canonicalValue(fixture));
}

export function hashResourceIsolationFixture(fixture) {
  return createHash('sha256')
    .update(serializeResourceIsolationFixture(fixture), 'utf8')
    .digest('hex');
}
