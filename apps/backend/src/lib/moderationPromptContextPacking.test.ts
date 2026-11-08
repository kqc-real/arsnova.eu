import {
  MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_SOURCE_LIMIT,
  MODERATION_PROMPT_CONTEXT_METADATA_FIXTURE_V1,
  MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1,
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  ModerationAnalysisContextV1Schema,
  ModerationPromptContextV1Schema,
  calculateModerationQaBestScoreV1,
  calculateModerationQaControversyScoreV1,
  type ModerationAnalysisContextV1,
  type ModerationPromptContextV1,
} from '@arsnova/shared-types';
import { describe, expect, it } from 'vitest';
import {
  MODERATION_PROMPT_SELECTION_VERSION,
  ModerationPromptPackingCache,
  canonicalModerationPromptJson,
  estimateModerationPromptUtf8Tokens,
  hashModerationAnalysisForPacking,
  packModerationPromptContext,
  type ModerationPromptPackingProfile,
} from './moderationPromptContextPacking';

const PACKED_AT = new Date('2026-01-15T10:06:00.000Z');

function analysisFixture(
  fixture:
    | typeof MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1
    | typeof MODERATION_PROMPT_CONTEXT_METADATA_FIXTURE_V1
    | typeof MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1 = MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  assembledAt = '2026-01-15T10:05:00.000Z',
): ModerationAnalysisContextV1 {
  const cloned = structuredClone(fixture);
  return ModerationAnalysisContextV1Schema.parse({
    schemaVersion: cloned.schemaVersion,
    contractVersion: MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
    assembledAt,
    context: {
      ...cloned.context,
      representation: 'analysis-candidates',
    },
  });
}

function profile(
  overrides: Partial<ModerationPromptPackingProfile> = {},
): ModerationPromptPackingProfile {
  return {
    modelProfile: 'test-private-runtime',
    contextWindowTokens: 100_000,
    instructionText: 'Follow the moderation instructions.',
    definitionText: 'Use only the supplied definitions and sources.',
    reservedOutputTokens: 1_024,
    safetyMarginTokens: 512,
    ...overrides,
  };
}

function pack(analysis = analysisFixture(), packingProfile = profile()): ModerationPromptContextV1 {
  return packModerationPromptContext({
    analysis,
    profile: packingProfile,
    packedAt: PACKED_AT,
  });
}

function availableQuestionItems(analysis: ModerationAnalysisContextV1) {
  if (analysis.context.questions.state !== 'available') {
    throw new Error('Test fixture requires available questions.');
  }
  return analysis.context.questions.items;
}

function withReleasedQuizResult(
  analysis: ModerationAnalysisContextV1,
): ModerationAnalysisContextV1 {
  analysis.context.releasedResults = {
    state: 'available',
    aggregates: [{ sourceId: 'quiz-result-aggregate:packing-release' }],
  };
  analysis.context.sources.push(
    {
      id: 'quiz-question:packing-release',
      kind: 'quiz-question',
      quizScopeId: 'quiz-scope:packing-release',
      text: 'Welche Aussage ist für den freigegebenen Test korrekt?',
      truncated: false,
    },
    {
      id: 'quiz-result-aggregate:packing-release',
      kind: 'quiz-result-aggregate',
      label: 'Freigegebene Richtigkeitsverteilung',
      scope: {
        kind: 'question',
        quizScopeId: 'quiz-scope:packing-release',
        questionSourceId: 'quiz-question:packing-release',
      },
      voteBasis: { kind: 'effective-vote', version: 'effective-vote-v1' },
      population: { kind: 'eligible-submissions', eligible: 200, included: 100 },
      aggregation: {
        rule: 'correctness-summary',
        unit: 'responses',
        correct: 60,
        incorrect: 30,
        unanswered: 10,
      },
    },
  );
  analysis.context.limitations = analysis.context.limitations.filter(
    ({ section, code }) => section !== 'released-results' || code !== 'not-released',
  );
  return ModerationAnalysisContextV1Schema.parse(analysis);
}

function sourceBoundAnalysisFixture(): ModerationAnalysisContextV1 {
  const analysis = analysisFixture();
  if (
    analysis.context.questions.state !== 'available' ||
    analysis.context.learningContext.state !== 'available'
  ) {
    throw new Error('Reference fixture sections must be available.');
  }
  const prototypeQuestion = analysis.context.questions.items[0];
  const prototypeObjective = analysis.context.learningContext.objectives[0];
  if (!prototypeQuestion || !prototypeObjective) {
    throw new Error('Reference fixture candidates are required.');
  }

  const questionSourceId = (index: number) =>
    `qa-question:${index.toString(16).padStart(8, '0')}-0000-4000-8000-${index
      .toString(16)
      .padStart(12, '0')}`;
  const additionalQuestions = Array.from({ length: 194 }, (_, offset) => {
    const index = offset + 7;
    return {
      question: {
        ...structuredClone(prototypeQuestion),
        sourceId: questionSourceId(index),
        topicSourceIds: [],
      },
      source: {
        id: questionSourceId(index),
        kind: 'qa-question' as const,
        content: {
          state: 'included' as const,
          text: `Zusätzliche Frage ${index} für die Prüfung der Quellenobergrenze.`,
          truncated: false,
        },
      },
    };
  });
  analysis.context.questions.items.push(...additionalQuestions.map(({ question }) => question));
  analysis.context.questions.corpus = {
    total: 200,
    eligible: 200,
    analyzed: 200,
    deduplicated: 200,
    represented: 200,
  };

  const additionalObjectives = Array.from({ length: 99 }, (_, offset) => {
    const sourceId = `learning-objective:source-limit-${String(offset + 2).padStart(3, '0')}`;
    return {
      objective: { ...structuredClone(prototypeObjective), sourceId },
      source: {
        id: sourceId,
        kind: 'learning-objective' as const,
        text: `Zusätzliches Lernziel ${offset + 2}.`,
      },
    };
  });
  analysis.context.learningContext.objectives.push(
    ...additionalObjectives.map(({ objective }) => objective),
  );
  const allQuestionSourceIds = analysis.context.questions.items.map(({ sourceId }) => sourceId);
  analysis.context.learningContext.objectives[0]!.scope = {
    kind: 'tasks',
    taskSourceIds: allQuestionSourceIds.slice(0, 100),
  };
  analysis.context.learningContext.objectives[1]!.scope = {
    kind: 'tasks',
    taskSourceIds: allQuestionSourceIds.slice(100),
  };

  const overflowQuestionSourceId = 'quiz-question:source-limit-overflow';
  const results = Array.from({ length: 100 }, (_, offset) => {
    const index = offset + 1;
    const sourceId = `quiz-result-aggregate:source-limit-${String(index).padStart(3, '0')}`;
    return {
      sourceId,
      source: {
        id: sourceId,
        kind: 'quiz-result-aggregate' as const,
        label: `Freigegebenes Ergebnis ${index}`,
        scope:
          index === 100
            ? {
                kind: 'question' as const,
                quizScopeId: 'quiz-scope:source-limit-overflow',
                questionSourceId: overflowQuestionSourceId,
              }
            : { kind: 'quiz' as const, quizScopeId: `quiz-scope:source-limit-${index}` },
        voteBasis: { kind: 'effective-vote' as const, version: 'effective-vote-v1' as const },
        population: { kind: 'eligible-submissions' as const, eligible: 1, included: 1 },
        aggregation: {
          rule: 'completion-summary' as const,
          unit: 'responses' as const,
          completed: 1,
          incomplete: 0,
        },
      },
    };
  });
  analysis.context.releasedResults = {
    state: 'available',
    aggregates: results.map(({ sourceId }) => ({ sourceId })),
  };

  const feedback = Array.from({ length: 95 }, (_, offset) => {
    const index = offset + 1;
    const sourceId = `feedback-aggregate:source-limit-${String(index).padStart(3, '0')}`;
    return {
      sourceId,
      source: {
        id: sourceId,
        kind: 'feedback-aggregate' as const,
        label: `Feedbackverteilung ${index}`,
        scope: {
          channel: 'quickFeedback' as const,
          timeWindow: { kind: 'entire-session' as const },
        },
        population: {
          kind: 'eligible-feedback-responses' as const,
          eligible: 1,
          included: 1,
        },
        aggregation: {
          feedbackType: 'YESNO_BINARY' as const,
          rule: 'flashlight-distribution' as const,
          unit: 'votes' as const,
          buckets: [
            { value: 'YES' as const, count: 1 },
            { value: 'NO' as const, count: 0 },
          ],
        },
      },
    };
  });
  analysis.context.feedback = {
    state: 'available',
    aggregates: feedback.map(({ sourceId }) => ({ sourceId })),
  };

  analysis.context.scope.channels = ['qa', 'quiz', 'quickFeedback'];
  analysis.context.scope.selectionLimits = {
    questions: 200,
    topics: 30,
    compassSignals: 30,
    learningObjectives: 100,
    resultAggregates: 100,
    feedbackAggregates: 100,
  };
  analysis.context.meta.revisions.feedback = {
    state: 'available',
    value: 'feedback-source-limit-r1',
  };
  analysis.context.limitations = [];
  analysis.context.sources.push(
    ...additionalQuestions.map(({ source }) => source),
    ...additionalObjectives.map(({ source }) => source),
    ...results.map(({ source }) => source),
    ...feedback.map(({ source }) => source),
    {
      id: overflowQuestionSourceId,
      kind: 'quiz-question',
      quizScopeId: 'quiz-scope:source-limit-overflow',
      text: 'Abhängige Quizfrage für die Prüfung der Quellenobergrenze.',
      truncated: false,
    },
  );

  return ModerationAnalysisContextV1Schema.parse(analysis);
}

describe('moderation prompt context packing', () => {
  it('packs the six-question reference fixture with strict source closure and exact budget accounting', () => {
    const result = pack();

    expect(ModerationPromptContextV1Schema.parse(result)).toEqual(result);
    expect(result.context.meta.selectionVersion).toBe(MODERATION_PROMPT_SELECTION_VERSION);
    expect(result.context.questions.state).toBe('available');
    expect(
      result.context.questions.state === 'available' && result.context.questions.items,
    ).toHaveLength(6);
    expect(result.context.topics.state === 'available' && result.context.topics.items).toHaveLength(
      3,
    );
    expect(result.budget.dataTokens).toBe(
      Buffer.byteLength(canonicalModerationPromptJson(result.context), 'utf8'),
    );
    expect(result.budget.packedInputTokens).toBe(
      result.budget.instructionTokens + result.budget.definitionTokens + result.budget.dataTokens,
    );
    expect(
      result.budget.packedInputTokens +
        result.budget.reservedOutputTokens +
        result.budget.safetyMarginTokens,
    ).toBeLessThanOrEqual(result.budget.contextWindowTokens);
  });

  it('uses a conservative UTF-8 byte upper bound for Unicode prompt material', () => {
    const analysis = analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1);
    const unicodeText =
      'Deutsch, English, français, español, italiano: Warum gilt 🧪 für 漢字 und café?';
    const source = analysis.context.sources[0];
    if (source?.kind !== 'qa-question') throw new Error('Expected a Q&A source.');
    source.content = { state: 'included', text: unicodeText, truncated: false };

    const packingProfile = profile({
      instructionText: 'Prüfe 🧪.',
      definitionText: 'Begriff: 漢字.',
    });
    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis), packingProfile);
    const canonicalContext = canonicalModerationPromptJson(result.context);

    expect(estimateModerationPromptUtf8Tokens(unicodeText)).toBe(
      Buffer.byteLength(unicodeText, 'utf8'),
    );
    expect(estimateModerationPromptUtf8Tokens(unicodeText)).toBeGreaterThan(unicodeText.length);
    expect(result.budget.instructionTokens).toBe(
      Buffer.byteLength(packingProfile.instructionText, 'utf8'),
    );
    expect(result.budget.definitionTokens).toBe(
      Buffer.byteLength(packingProfile.definitionText, 'utf8'),
    );
    expect(result.budget.dataTokens).toBe(Buffer.byteLength(canonicalContext, 'utf8'));
  });

  it('selects deterministically in code-unit order independently of candidate array order', () => {
    const original = analysisFixture();
    const reordered = analysisFixture();
    if (
      reordered.context.questions.state !== 'available' ||
      reordered.context.topics.state !== 'available' ||
      reordered.context.compass.state !== 'available'
    ) {
      throw new Error('Reference fixture sections must be available.');
    }
    reordered.context.questions.items.reverse();
    reordered.context.topics.items.reverse();
    reordered.context.compass.signals.reverse();
    reordered.context.sources.reverse();
    reordered.context.limitations.reverse();

    expect(pack(ModerationAnalysisContextV1Schema.parse(reordered))).toEqual(pack(original));
  });

  it('keeps classified organization and technical questions visible under a tight budget', () => {
    const analysis = analysisFixture(MODERATION_PROMPT_CONTEXT_METADATA_FIXTURE_V1);
    const questions = availableQuestionItems(analysis);
    const technical = questions[1];
    if (technical?.nlp.state !== 'classified') {
      throw new Error('Reference question must have a classified NLP state.');
    }
    technical.nlp.category = 'technical';
    const parsed = ModerationAnalysisContextV1Schema.parse(analysis);

    let tightlyPacked: ModerationPromptContextV1 | undefined;
    for (let window = 3_000; window <= 30_000; window += 128) {
      try {
        const candidate = pack(
          parsed,
          profile({
            contextWindowTokens: window,
            reservedOutputTokens: 256,
            safetyMarginTokens: 128,
          }),
        );
        const selected =
          candidate.context.questions.state === 'available'
            ? candidate.context.questions.items
            : [];
        if (selected.length >= 2 && selected.length < questions.length) {
          tightlyPacked = candidate;
          break;
        }
      } catch {
        // The metadata-only base is itself too large for the smallest windows.
      }
    }

    expect(tightlyPacked).toBeDefined();
    const selected =
      tightlyPacked?.context.questions.state === 'available'
        ? tightlyPacked.context.questions.items
        : [];
    expect(
      selected.some(({ nlp }) => nlp.state === 'classified' && nlp.category === 'organization'),
    ).toBe(true);
    expect(
      selected.some(({ nlp }) => nlp.state === 'classified' && nlp.category === 'technical'),
    ).toBe(true);
  });

  it('priorisiert für Kurzfassungen repräsentative Themen vor zusätzlichen Einzelfragen', () => {
    const analysis = analysisFixture();
    let comparison:
      { balanced: ModerationPromptContextV1; topicsFirst: ModerationPromptContextV1 } | undefined;

    for (let window = 3_000; window <= 40_000; window += 128) {
      const candidateProfile = profile({
        contextWindowTokens: window,
        reservedOutputTokens: 256,
        safetyMarginTokens: 128,
      });
      try {
        const balanced = packModerationPromptContext({
          analysis,
          profile: candidateProfile,
          packedAt: PACKED_AT,
        });
        const topicsFirst = packModerationPromptContext({
          analysis,
          profile: candidateProfile,
          packedAt: PACKED_AT,
          candidatePriority: 'topics-first',
        });
        const balancedTopics =
          balanced.context.topics.state === 'available' ? balanced.context.topics.items.length : 0;
        const prioritizedTopics =
          topicsFirst.context.topics.state === 'available'
            ? topicsFirst.context.topics.items.length
            : 0;
        if (prioritizedTopics > balancedTopics) {
          comparison = { balanced, topicsFirst };
          break;
        }
      } catch {
        // Die Basismetadaten passen in die kleinsten Testfenster noch nicht.
      }
    }

    expect(comparison).toBeDefined();
    const prioritizedTopics =
      comparison?.topicsFirst.context.topics.state === 'available'
        ? comparison.topicsFirst.context.topics.items
        : [];
    expect(prioritizedTopics.length).toBeGreaterThan(0);
    expect(
      comparison?.topicsFirst.context.sources.some((source) => source.kind === 'qa-question'),
    ).toBe(true);
  });

  it('covers multiple topics plus unvoted, controversial, and supported questions deterministically under a tight budget', () => {
    const analysis = analysisFixture();
    if (
      analysis.context.questions.state !== 'available' ||
      analysis.context.topics.state !== 'available' ||
      analysis.context.compass.state !== 'available'
    ) {
      throw new Error('Reference fixture sections must be available.');
    }
    const supported = analysis.context.questions.items[2];
    const unvoted = analysis.context.questions.items[3];
    const controversial = analysis.context.questions.items[4];
    if (!supported || !unvoted || !controversial || unvoted.votes.state !== 'available') {
      throw new Error('Reference ranking candidates are required.');
    }
    unvoted.votes = {
      ...unvoted.votes,
      positive: 0,
      negative: 0,
      net: 0,
      total: 0,
      bestScore: { state: 'available', value: 0 },
      controversyScore: { state: 'available', value: 0 },
    };
    const candidateQuestionCount = analysis.context.questions.items.length;
    const parsed = ModerationAnalysisContextV1Schema.parse(analysis);

    let tightlyPacked: ModerationPromptContextV1 | undefined;
    let tightProfile: ModerationPromptPackingProfile | undefined;
    for (let window = 3_000; window <= 40_000; window += 128) {
      try {
        const candidateProfile = profile({
          contextWindowTokens: window,
          reservedOutputTokens: 256,
          safetyMarginTokens: 128,
        });
        const candidate = pack(parsed, candidateProfile);
        const selectedQuestions =
          candidate.context.questions.state === 'available'
            ? candidate.context.questions.items
            : [];
        const selectedTopics =
          candidate.context.topics.state === 'available' ? candidate.context.topics.items : [];
        const selectedIds = new Set(selectedQuestions.map(({ sourceId }) => sourceId));
        if (
          selectedTopics.length >= 2 &&
          selectedQuestions.length < candidateQuestionCount &&
          [supported.sourceId, unvoted.sourceId, controversial.sourceId].every((sourceId) =>
            selectedIds.has(sourceId),
          )
        ) {
          tightlyPacked = candidate;
          tightProfile = candidateProfile;
          break;
        }
      } catch {
        // The metadata-only base is itself too large for the smallest windows.
      }
    }

    expect(tightlyPacked).toBeDefined();
    expect(tightProfile).toBeDefined();
    if (!tightlyPacked || !tightProfile) return;
    const selectedQuestions =
      tightlyPacked.context.questions.state === 'available'
        ? tightlyPacked.context.questions.items
        : [];
    const selectedTopics =
      tightlyPacked.context.topics.state === 'available' ? tightlyPacked.context.topics.items : [];
    expect(selectedTopics.length).toBeGreaterThanOrEqual(2);
    expect(selectedQuestions.map(({ sourceId }) => sourceId)).toEqual(
      expect.arrayContaining([supported.sourceId, unvoted.sourceId, controversial.sourceId]),
    );

    const reordered = structuredClone(parsed);
    if (
      reordered.context.questions.state !== 'available' ||
      reordered.context.topics.state !== 'available' ||
      reordered.context.compass.state !== 'available'
    ) {
      throw new Error('Reference fixture sections must be available.');
    }
    reordered.context.questions.items.reverse();
    reordered.context.topics.items.reverse();
    reordered.context.compass.signals.reverse();
    reordered.context.sources.reverse();
    reordered.context.limitations.reverse();
    expect(pack(ModerationAnalysisContextV1Schema.parse(reordered), tightProfile)).toEqual(
      tightlyPacked,
    );
  });

  it('packs a topic-only representative text absent from the ranked question items', () => {
    const analysis = analysisFixture();
    if (
      analysis.context.questions.state !== 'available' ||
      analysis.context.topics.state !== 'available'
    ) {
      throw new Error('Reference fixture sections must be available.');
    }
    const unsafeTopic = analysis.context.topics.items.find(
      ({ sourceId }) => sourceId === 'semantic-topic:linear-regression-examples',
    );
    if (!unsafeTopic) throw new Error('Expected the reference topic.');
    analysis.context.questions.items = analysis.context.questions.items.filter(
      ({ sourceId }) => sourceId !== unsafeTopic.representativeQuestionSourceId,
    );
    analysis.context.questions.corpus.analyzed = analysis.context.questions.items.length;
    analysis.context.questions.corpus.deduplicated = analysis.context.questions.items.length;
    analysis.context.questions.corpus.represented = analysis.context.questions.items.length;

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));

    expect(ModerationPromptContextV1Schema.parse(result)).toEqual(result);
    expect(
      result.context.topics.state === 'available' &&
        result.context.topics.items.some(({ sourceId }) => sourceId === unsafeTopic.sourceId),
    ).toBe(true);
    expect(result.context.sources).toContainEqual(
      expect.objectContaining({
        id: unsafeTopic.representativeQuestionSourceId,
        kind: 'qa-question',
        content: expect.objectContaining({ state: 'included' }),
      }),
    );
    expect(result.budget.truncations).not.toContainEqual({
      section: 'topics',
      omittedItems: expect.any(Number),
      reason: expect.any(String),
    });
  });

  it('deduplicates normalized question text while preserving topic source closure', () => {
    const analysis = analysisFixture();
    if (analysis.context.questions.state !== 'available') {
      throw new Error('Reference fixture questions must be available.');
    }
    const [canonical, duplicate] = analysis.context.questions.items;
    const canonicalSource = analysis.context.sources.find(({ id }) => id === canonical?.sourceId);
    const duplicateSource = analysis.context.sources.find(({ id }) => id === duplicate?.sourceId);
    if (
      !canonical ||
      !duplicate ||
      canonicalSource?.kind !== 'qa-question' ||
      canonicalSource.content.state !== 'included' ||
      duplicateSource?.kind !== 'qa-question'
    ) {
      throw new Error('Expected included Q&A sources.');
    }
    analysis.context.questions.items[1] = {
      ...structuredClone(canonical),
      sourceId: duplicate.sourceId,
    };
    duplicateSource.content = {
      state: 'included',
      text: `»${canonicalSource.content.text}???«`,
      truncated: false,
    };

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));
    const packedDuplicate = result.context.sources.find(({ id }) => id === duplicateSource.id);

    expect(
      result.context.questions.state === 'available' && result.context.questions.items,
    ).toHaveLength(5);
    expect(
      result.context.questions.state === 'available' &&
        result.context.questions.items.find(({ sourceId }) => sourceId === canonical.sourceId),
    ).toMatchObject({
      deduplication: {
        rule: 'normalized-text-and-metadata-v1',
        questionCount: 2,
      },
    });
    expect(packedDuplicate).toMatchObject({
      kind: 'qa-question',
      content: { state: 'reference-only', reason: 'deduplicated' },
    });
    expect(result.budget.truncations).toContainEqual({
      section: 'questions',
      omittedItems: 1,
      reason: 'deduplication',
    });
    expect(ModerationPromptContextV1Schema.parse(result)).toEqual(result);
  });

  it('redirects a deduplicated topic representative and label source to the included canonical question', () => {
    const analysis = analysisFixture();
    if (
      analysis.context.questions.state !== 'available' ||
      analysis.context.topics.state !== 'available'
    ) {
      throw new Error('Reference fixture questions and topics must be available.');
    }
    const [first, second] = analysis.context.questions.items;
    const firstSource = analysis.context.sources.find(({ id }) => id === first?.sourceId);
    const secondSource = analysis.context.sources.find(({ id }) => id === second?.sourceId);
    const topic = analysis.context.topics.items.find(
      ({ sourceId }) => sourceId === first?.topicSourceIds[0],
    );
    if (
      !first ||
      !second ||
      firstSource?.kind !== 'qa-question' ||
      firstSource.content.state !== 'included' ||
      secondSource?.kind !== 'qa-question' ||
      !topic
    ) {
      throw new Error('Expected two included questions in one topic.');
    }
    analysis.context.questions.items[1] = {
      ...structuredClone(first),
      sourceId: second.sourceId,
    };
    secondSource.content = {
      state: 'included',
      text: `»${firstSource.content.text}???«`,
      truncated: false,
    };
    const [canonicalSourceId, duplicateSourceId] = [first.sourceId, second.sourceId].sort();
    topic.representativeQuestionSourceId = duplicateSourceId!;
    topic.labelOrigin = {
      kind: 'source-extractive',
      sourceQuestionId: duplicateSourceId!,
    };

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));
    const packedTopic =
      result.context.topics.state === 'available'
        ? result.context.topics.items.find(({ sourceId }) => sourceId === topic.sourceId)
        : undefined;

    expect(packedTopic).toMatchObject({
      representativeQuestionSourceId: canonicalSourceId,
      labelOrigin: {
        kind: 'source-extractive',
        sourceQuestionId: canonicalSourceId,
      },
      representedQuestionSourceIds: [canonicalSourceId],
    });
    expect(result.context.sources.find(({ id }) => id === duplicateSourceId)).toMatchObject({
      kind: 'qa-question',
      content: { state: 'reference-only', reason: 'deduplicated' },
    });
    expect(ModerationPromptContextV1Schema.parse(result)).toEqual(result);
  });

  it('preserves original topic members as generative label sources during question deduplication', () => {
    const analysis = analysisFixture();
    if (
      analysis.context.questions.state !== 'available' ||
      analysis.context.topics.state !== 'available'
    ) {
      throw new Error('Reference fixture questions and topics must be available.');
    }
    const [first, second] = analysis.context.questions.items;
    const firstSource = analysis.context.sources.find(({ id }) => id === first?.sourceId);
    const secondSource = analysis.context.sources.find(({ id }) => id === second?.sourceId);
    const topic = analysis.context.topics.items.find(
      ({ sourceId }) => sourceId === first?.topicSourceIds[0],
    );
    if (
      !first ||
      !second ||
      firstSource?.kind !== 'qa-question' ||
      firstSource.content.state !== 'included' ||
      secondSource?.kind !== 'qa-question' ||
      !topic
    ) {
      throw new Error('Expected two included questions in one topic.');
    }
    analysis.context.questions.items[1] = {
      ...structuredClone(first),
      sourceId: second.sourceId,
    };
    secondSource.content = {
      state: 'included',
      text: `»${firstSource.content.text}???«`,
      truncated: false,
    };
    const [canonicalSourceId, duplicateSourceId] = [first.sourceId, second.sourceId].sort();
    topic.memberQuestionSourceIds = [canonicalSourceId!, duplicateSourceId!];
    topic.representedQuestionSourceIds = [canonicalSourceId!, duplicateSourceId!];
    topic.representativeQuestionSourceId = duplicateSourceId!;
    topic.aggregates.questionCount = 2;
    topic.labelOrigin = {
      kind: 'model-generated',
      modelId: 'topic-label-model',
      modelVersion: '1',
      generationVersion: 'topic-label-system-v1',
      derivedFromSourceIds: [canonicalSourceId!, duplicateSourceId!],
    };

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));
    const packedTopic =
      result.context.topics.state === 'available'
        ? result.context.topics.items.find(({ sourceId }) => sourceId === topic.sourceId)
        : undefined;

    expect(packedTopic).toMatchObject({
      memberQuestionSourceIds: [canonicalSourceId, duplicateSourceId],
      representedQuestionSourceIds: [canonicalSourceId],
      representativeQuestionSourceId: canonicalSourceId,
      aggregates: { questionCount: 2 },
      labelOrigin: {
        kind: 'model-generated',
        derivedFromSourceIds: [canonicalSourceId, duplicateSourceId],
      },
    });
    expect(ModerationPromptContextV1Schema.parse(result)).toEqual(result);
  });

  it('does not deduplicate questions carrying distinct direct compass references', () => {
    const analysis = analysisFixture();
    if (analysis.context.questions.state !== 'available') {
      throw new Error('Reference fixture questions must be available.');
    }
    const [first, second] = analysis.context.questions.items.slice(4, 6);
    const firstSource = analysis.context.sources.find(({ id }) => id === first?.sourceId);
    const secondSource = analysis.context.sources.find(({ id }) => id === second?.sourceId);
    if (
      !first ||
      !second ||
      firstSource?.kind !== 'qa-question' ||
      firstSource.content.state !== 'included' ||
      secondSource?.kind !== 'qa-question'
    ) {
      throw new Error('Expected two attendance questions.');
    }
    analysis.context.questions.items[5] = {
      ...structuredClone(first),
      sourceId: second.sourceId,
    };
    secondSource.content = {
      state: 'included',
      text: firstSource.content.text,
      truncated: false,
    };

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));

    expect(
      result.context.questions.state === 'available' && result.context.questions.items,
    ).toHaveLength(6);
    expect(result.budget.truncations).not.toContainEqual(
      expect.objectContaining({ section: 'questions', reason: 'deduplication' }),
    );
  });

  it('does not deduplicate equal text when votes, status, or other question metadata differ', () => {
    const analysis = analysisFixture();
    if (analysis.context.questions.state !== 'available') {
      throw new Error('Reference fixture questions must be available.');
    }
    const [first, second] = analysis.context.questions.items;
    const firstSource = analysis.context.sources.find(({ id }) => id === first?.sourceId);
    const secondSource = analysis.context.sources.find(({ id }) => id === second?.sourceId);
    if (
      firstSource?.kind !== 'qa-question' ||
      firstSource.content.state !== 'included' ||
      secondSource?.kind !== 'qa-question'
    ) {
      throw new Error('Expected included Q&A sources.');
    }
    secondSource.content = {
      state: 'included',
      text: firstSource.content.text,
      truncated: false,
    };

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));

    expect(
      result.context.questions.state === 'available' && result.context.questions.items,
    ).toHaveLength(6);
    expect(result.budget.truncations).not.toContainEqual(
      expect.objectContaining({ section: 'questions', reason: 'deduplication' }),
    );
  });

  it('does not deduplicate questions that differ by a semantic operator', () => {
    const analysis = analysisFixture();
    if (analysis.context.questions.state !== 'available') {
      throw new Error('Reference fixture questions must be available.');
    }
    const [first, second] = analysis.context.questions.items;
    const firstSource = analysis.context.sources.find(({ id }) => id === first?.sourceId);
    const secondSource = analysis.context.sources.find(({ id }) => id === second?.sourceId);
    if (
      !first ||
      !second ||
      firstSource?.kind !== 'qa-question' ||
      firstSource.content.state !== 'included' ||
      secondSource?.kind !== 'qa-question'
    ) {
      throw new Error('Expected two included Q&A sources.');
    }
    analysis.context.questions.items[1] = {
      ...structuredClone(first),
      sourceId: second.sourceId,
    };
    firstSource.content = {
      state: 'included',
      text: 'Ist p < 0,05?',
      truncated: false,
    };
    secondSource.content = {
      state: 'included',
      text: 'Ist p > 0,05?',
      truncated: false,
    };

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));

    expect(
      result.context.questions.state === 'available' && result.context.questions.items,
    ).toHaveLength(6);
    expect(result.budget.truncations).not.toContainEqual(
      expect.objectContaining({ section: 'questions', reason: 'deduplication' }),
    );
    expect(result.context.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.sourceId,
          content: expect.objectContaining({ text: 'Ist p < 0,05?' }),
        }),
        expect.objectContaining({
          id: second.sourceId,
          content: expect.objectContaining({ text: 'Ist p > 0,05?' }),
        }),
      ]),
    );
  });

  it('does not strip a factorial operator while normalizing terminal question punctuation', () => {
    const analysis = analysisFixture();
    if (analysis.context.questions.state !== 'available') {
      throw new Error('Reference fixture questions must be available.');
    }
    const [first, second] = analysis.context.questions.items;
    const firstSource = analysis.context.sources.find(({ id }) => id === first?.sourceId);
    const secondSource = analysis.context.sources.find(({ id }) => id === second?.sourceId);
    if (
      !first ||
      !second ||
      firstSource?.kind !== 'qa-question' ||
      firstSource.content.state !== 'included' ||
      secondSource?.kind !== 'qa-question'
    ) {
      throw new Error('Expected two included Q&A sources.');
    }
    analysis.context.questions.items[1] = {
      ...structuredClone(first),
      sourceId: second.sourceId,
    };
    firstSource.content = {
      state: 'included',
      text: 'Was ist 5!?',
      truncated: false,
    };
    secondSource.content = {
      state: 'included',
      text: 'Was ist 5?',
      truncated: false,
    };

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));

    expect(
      result.context.questions.state === 'available' && result.context.questions.items,
    ).toHaveLength(6);
    expect(result.budget.truncations).not.toContainEqual(
      expect.objectContaining({ section: 'questions', reason: 'deduplication' }),
    );
  });

  it('does not strip an internal derivative apostrophe while normalizing outer quotes', () => {
    const analysis = analysisFixture();
    if (analysis.context.questions.state !== 'available') {
      throw new Error('Reference fixture questions must be available.');
    }
    const [first, second] = analysis.context.questions.items;
    const firstSource = analysis.context.sources.find(({ id }) => id === first?.sourceId);
    const secondSource = analysis.context.sources.find(({ id }) => id === second?.sourceId);
    if (
      !first ||
      !second ||
      firstSource?.kind !== 'qa-question' ||
      firstSource.content.state !== 'included' ||
      secondSource?.kind !== 'qa-question'
    ) {
      throw new Error('Expected two included Q&A sources.');
    }
    analysis.context.questions.items[1] = {
      ...structuredClone(first),
      sourceId: second.sourceId,
    };
    firstSource.content = {
      state: 'included',
      text: "Was ist f'(x)?",
      truncated: false,
    };
    secondSource.content = {
      state: 'included',
      text: 'Was ist f(x)?',
      truncated: false,
    };

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));

    expect(
      result.context.questions.state === 'available' && result.context.questions.items,
    ).toHaveLength(6);
    expect(result.budget.truncations).not.toContainEqual(
      expect.objectContaining({ section: 'questions', reason: 'deduplication' }),
    );
  });

  it.each([
    ['case-sensitive mathematical variables', 'Was ist A?', 'Was ist a?'],
    ['compatibility-sensitive notation', 'Was ist x²?', 'Was ist x2?'],
  ])('does not merge %s', (_case, firstText, secondText) => {
    const analysis = analysisFixture();
    if (analysis.context.questions.state !== 'available') {
      throw new Error('Reference fixture questions must be available.');
    }
    const [first, second] = analysis.context.questions.items;
    const firstSource = analysis.context.sources.find(({ id }) => id === first?.sourceId);
    const secondSource = analysis.context.sources.find(({ id }) => id === second?.sourceId);
    if (
      !first ||
      !second ||
      firstSource?.kind !== 'qa-question' ||
      firstSource.content.state !== 'included' ||
      secondSource?.kind !== 'qa-question'
    ) {
      throw new Error('Expected two included Q&A sources.');
    }
    analysis.context.questions.items[1] = {
      ...structuredClone(first),
      sourceId: second.sourceId,
    };
    firstSource.content = { state: 'included', text: firstText, truncated: false };
    secondSource.content = { state: 'included', text: secondText, truncated: false };

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));

    expect(
      result.context.questions.state === 'available' && result.context.questions.items,
    ).toHaveLength(6);
    expect(result.budget.truncations).not.toContainEqual(
      expect.objectContaining({ section: 'questions', reason: 'deduplication' }),
    );
  });

  it('keeps a 25,000-question corpus bounded to the analyzed candidate set', () => {
    const analysis = analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1);
    if (analysis.context.questions.state !== 'available') {
      throw new Error('Reference fixture questions must be available.');
    }
    const prototype = analysis.context.questions.items[0];
    if (!prototype) throw new Error('Minimal fixture question is required.');
    const sourceId = (index: number) =>
      `qa-question:00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
    analysis.context.questions.items = Array.from({ length: 200 }, (_, index) => ({
      ...structuredClone(prototype),
      sourceId: sourceId(index + 1),
    }));
    analysis.context.sources = Array.from({ length: 200 }, (_, index) => ({
      id: sourceId(index + 1),
      kind: 'qa-question' as const,
      content: {
        state: 'included' as const,
        text: `Lastfrage ${index + 1}: Wie lässt sich dieser Aspekt sinnvoll erklären?`,
        truncated: false,
      },
    }));
    analysis.context.questions.corpus.total = 25_000;
    analysis.context.questions.corpus.eligible = 25_000;
    analysis.context.questions.corpus.analyzed = 200;
    analysis.context.questions.corpus.deduplicated = 200;
    analysis.context.questions.corpus.represented = 200;

    const result = pack(ModerationAnalysisContextV1Schema.parse(analysis));

    expect(result.context.questions.state).toBe('available');
    if (result.context.questions.state !== 'available') return;
    expect(result.context.questions.corpus.total).toBe(25_000);
    expect(result.context.questions.corpus.eligible).toBe(25_000);
    expect(result.context.questions.corpus.analyzed).toBe(200);
    expect(result.context.questions.items).toHaveLength(10);
    expect(result.context.sources).toHaveLength(10);
    expect(result.budget.truncations).toContainEqual({
      section: 'questions',
      omittedItems: 190,
      reason: 'item-limit',
    });
  });

  it('reports a dependency bundle rejected by the 500-source prompt bound as an item limit', () => {
    const analysis = sourceBoundAnalysisFixture();
    expect(analysis.context.sources).toHaveLength(MODERATION_PROMPT_SOURCE_LIMIT + 1);

    const largeWindowProfile = profile({
      contextWindowTokens: 5_000_000,
      reservedOutputTokens: 1_024,
      safetyMarginTokens: 512,
    });
    const result = pack(analysis, largeWindowProfile);

    expect(ModerationPromptContextV1Schema.parse(result)).toEqual(result);
    expect(result.context.sources).toHaveLength(MODERATION_PROMPT_SOURCE_LIMIT - 1);
    expect(result.budget.truncations).toContainEqual(
      expect.objectContaining({
        section: 'released-results',
        omittedItems: 1,
        reason: 'item-limit',
      }),
    );
    expect(result.budget.truncations).not.toContainEqual(
      expect.objectContaining({ reason: 'token-budget' }),
    );
    const occupiedWindow =
      result.budget.packedInputTokens +
      result.budget.reservedOutputTokens +
      result.budget.safetyMarginTokens;
    expect(occupiedWindow).toBeLessThan(largeWindowProfile.contextWindowTokens / 2);
  }, 60_000);

  it('omits transport and analysis timestamps from semantic hashes but invalidates semantic changes', () => {
    const first = analysisFixture();
    const timestampOnly = analysisFixture(
      MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
      '2026-01-16T11:06:00Z',
    );
    if (
      timestampOnly.context.questions.state !== 'available' ||
      timestampOnly.context.topics.state !== 'available' ||
      timestampOnly.context.learningContext.state !== 'available'
    ) {
      throw new Error('Reference fixture sections must be available.');
    }
    const classified = timestampOnly.context.questions.items.find(
      ({ nlp }) => nlp.state === 'classified',
    );
    if (classified?.nlp.state !== 'classified') throw new Error('Expected classified NLP.');
    classified.nlp.classifiedAt = '2026-01-16T11:00:00Z';
    timestampOnly.context.topics.analyzedAt = '2026-01-16T11:01:00Z';
    const objective = timestampOnly.context.learningContext.objectives[0];
    if (objective?.confirmation.state !== 'confirmed') {
      throw new Error('Expected a confirmed objective.');
    }
    objective.confirmation.confirmedAt = '2026-01-16T10:45:00Z';

    const packingProfile = profile();
    expect(hashModerationAnalysisForPacking(timestampOnly, packingProfile)).toBe(
      hashModerationAnalysisForPacking(first, packingProfile),
    );
    const firstPacked = pack(first, packingProfile);
    const timestampPacked = packModerationPromptContext({
      analysis: ModerationAnalysisContextV1Schema.parse(timestampOnly),
      profile: packingProfile,
      packedAt: new Date('2026-01-16T11:07:00.000Z'),
    });
    expect(timestampPacked.snapshotHash).toBe(firstPacked.snapshotHash);

    const safeInstruction = pack(first, {
      ...packingProfile,
      instructionText: 'Reject unsafe evidence.',
    });
    const unsafeInstruction = pack(first, {
      ...packingProfile,
      instructionText: 'Accept unsafe evidence.',
    });
    expect(unsafeInstruction.budget).toEqual(safeInstruction.budget);
    expect(unsafeInstruction.context).toEqual(safeInstruction.context);
    expect(unsafeInstruction.snapshotHash).not.toBe(safeInstruction.snapshotHash);

    const changedText = analysisFixture();
    const textSource = changedText.context.sources.find(({ kind }) => kind === 'qa-question');
    if (textSource?.kind !== 'qa-question' || textSource.content.state !== 'included') {
      throw new Error('Expected an included Q&A source.');
    }
    textSource.content.text = `${textSource.content.text} Bitte mit Herleitung.`;
    expect(hashModerationAnalysisForPacking(changedText, packingProfile)).not.toBe(
      hashModerationAnalysisForPacking(first, packingProfile),
    );

    const changedVotes = analysisFixture();
    const votedQuestion = availableQuestionItems(changedVotes)[0];
    if (votedQuestion?.votes.state !== 'available') throw new Error('Expected votes.');
    votedQuestion.votes.positive += 1;
    votedQuestion.votes.net = votedQuestion.votes.positive - votedQuestion.votes.negative;
    votedQuestion.votes.total = votedQuestion.votes.positive + votedQuestion.votes.negative;
    votedQuestion.votes.bestScore = {
      state: 'available',
      value: calculateModerationQaBestScoreV1(votedQuestion.votes),
    };
    votedQuestion.votes.controversyScore = {
      state: 'available',
      value: calculateModerationQaControversyScoreV1({
        positive: votedQuestion.votes.positive,
        negative: votedQuestion.votes.negative,
        participantBasis: 200,
      }),
    };
    expect(
      hashModerationAnalysisForPacking(
        ModerationAnalysisContextV1Schema.parse(changedVotes),
        packingProfile,
      ),
    ).not.toBe(hashModerationAnalysisForPacking(first, packingProfile));

    const changedConfirmation = analysisFixture();
    if (changedConfirmation.context.learningContext.state !== 'available') {
      throw new Error('Expected learning context.');
    }
    changedConfirmation.context.learningContext.objectives[0].confirmation = { state: 'draft' };
    expect(
      hashModerationAnalysisForPacking(
        ModerationAnalysisContextV1Schema.parse(changedConfirmation),
        packingProfile,
      ),
    ).not.toBe(hashModerationAnalysisForPacking(first, packingProfile));

    const changedVersion = analysisFixture();
    changedVersion.context.meta.analysisVersion = 'fixture-analysis-v2';
    expect(hashModerationAnalysisForPacking(changedVersion, packingProfile)).not.toBe(
      hashModerationAnalysisForPacking(first, packingProfile),
    );

    const releasedResult = withReleasedQuizResult(analysisFixture());
    expect(hashModerationAnalysisForPacking(releasedResult, packingProfile)).not.toBe(
      hashModerationAnalysisForPacking(first, packingProfile),
    );
    const packedResult = pack(releasedResult, packingProfile);
    expect(packedResult.context.releasedResults).toEqual({
      state: 'available',
      aggregates: [{ sourceId: 'quiz-result-aggregate:packing-release' }],
    });
    expect(
      packedResult.context.sources.some(
        ({ id, kind }) => id === 'quiz-question:packing-release' && kind === 'quiz-question',
      ),
    ).toBe(true);
  });
});

describe('ModerationPromptPackingCache', () => {
  it('caches keine leeren Q&A-Evidence-Packs', () => {
    const cache = new ModerationPromptPackingCache();
    const analysis = analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1);
    const packingProfile = profile();
    const emptyPack = packModerationPromptContext({
      analysis,
      profile: packingProfile,
      packedAt: PACKED_AT,
    });
    // Force an empty-evidence result through a custom packer while analysis still
    // reports analyzed questions — production sticky extractive path.
    if (emptyPack.context.questions.state !== 'available') {
      throw new Error('Erwartete verfügbare Fragen.');
    }
    emptyPack.context.questions = {
      ...emptyPack.context.questions,
      corpus: { ...emptyPack.context.questions.corpus, analyzed: 20, represented: 0 },
      items: [],
    };
    emptyPack.context.sources = [];

    const input = {
      sessionId: 'session-empty-evidence',
      analysis,
      profile: packingProfile,
      packedAt: PACKED_AT,
      pack: () => structuredClone(emptyPack),
    };
    expect(cache.getOrPackFreshlyAuthorized(input).cache).toBe('miss');
    expect(cache.size).toBe(0);
    expect(cache.getOrPackFreshlyAuthorized(input).cache).toBe('miss');
  });

  it('misses on semantic changes and profile changes', () => {
    const cache = new ModerationPromptPackingCache();
    const first = analysisFixture();
    const packingProfile = profile();
    const input = {
      sessionId: 'session-semantic',
      analysis: first,
      profile: packingProfile,
      packedAt: PACKED_AT,
    };

    expect(cache.getOrPackFreshlyAuthorized(input).cache).toBe('miss');
    expect(cache.getOrPackFreshlyAuthorized(input).cache).toBe('hit');

    const changed = analysisFixture();
    changed.context.meta.analysisVersion = 'fixture-analysis-v2';
    expect(cache.getOrPackFreshlyAuthorized({ ...input, analysis: changed }).cache).toBe('miss');
    expect(
      cache.getOrPackFreshlyAuthorized({
        ...input,
        profile: { ...packingProfile, modelProfile: 'different-private-runtime' },
      }).cache,
    ).toBe('miss');
  });

  it('is TTL/LRU bounded and keys entries by semantic material rather than assembledAt', () => {
    let now = 10_000;
    const cache = new ModerationPromptPackingCache({
      ttlMs: 100,
      maxEntries: 2,
      now: () => now,
    });
    const packingProfile = profile();
    const first = analysisFixture();

    expect(
      cache.getOrPackFreshlyAuthorized({
        sessionId: 'session-a',
        analysis: first,
        profile: packingProfile,
        packedAt: PACKED_AT,
      }).cache,
    ).toBe('miss');
    expect(
      cache.getOrPackFreshlyAuthorized({
        sessionId: 'session-a',
        analysis: analysisFixture(
          MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
          '2026-01-16T10:05:00.000Z',
        ),
        profile: packingProfile,
        packedAt: new Date('2026-01-16T10:06:00.000Z'),
      }).cache,
    ).toBe('hit');
    expect(
      cache.getOrPackFreshlyAuthorized({
        sessionId: 'session-b',
        analysis: first,
        profile: packingProfile,
        packedAt: PACKED_AT,
      }).cache,
    ).toBe('miss');
    expect(cache.size).toBe(2);

    // Refresh A, then adding C must evict B as the least-recently-used entry.
    expect(
      cache.getOrPackFreshlyAuthorized({
        sessionId: 'session-a',
        analysis: first,
        profile: packingProfile,
        packedAt: PACKED_AT,
      }).cache,
    ).toBe('hit');
    expect(
      cache.getOrPackFreshlyAuthorized({
        sessionId: 'session-c',
        analysis: first,
        profile: packingProfile,
        packedAt: PACKED_AT,
      }).cache,
    ).toBe('miss');
    expect(cache.size).toBe(2);
    expect(
      cache.getOrPackFreshlyAuthorized({
        sessionId: 'session-b',
        analysis: first,
        profile: packingProfile,
        packedAt: PACKED_AT,
      }).cache,
    ).toBe('miss');

    now += 101;
    expect(
      cache.getOrPackFreshlyAuthorized({
        sessionId: 'session-b',
        analysis: first,
        profile: packingProfile,
        packedAt: PACKED_AT,
      }).cache,
    ).toBe('miss');
  });

  it('purges a session, fences immediate repopulation, and never serves before input validation', () => {
    let now = 20_000;
    const cache = new ModerationPromptPackingCache({ now: () => now });
    const valid = analysisFixture();
    const packingProfile = profile();
    const input = {
      sessionId: 'session-purge',
      analysis: valid,
      profile: packingProfile,
      packedAt: PACKED_AT,
    };

    expect(cache.getOrPackFreshlyAuthorized(input).cache).toBe('miss');
    cache.invalidateSession(input.sessionId);
    expect(cache.size).toBe(0);
    expect(cache.getOrPackFreshlyAuthorized(input).cache).toBe('purge-fenced');
    expect(cache.size).toBe(0);

    const invalid = structuredClone(valid);
    invalid.assembledAt = 'not-a-timestamp';
    expect(() => cache.getOrPackFreshlyAuthorized({ ...input, analysis: invalid })).toThrow();
    expect(cache.size).toBe(0);

    now += 60_001;
    expect(cache.getOrPackFreshlyAuthorized(input).cache).toBe('miss');
    expect(cache.size).toBe(1);
  });

  it('keeps the purge fence bounded under invalidation-only traffic and expires it', () => {
    let now = 30_000;
    const cache = new ModerationPromptPackingCache({ now: () => now });
    for (let index = 0; index < 10_000; index += 1) {
      cache.invalidateSession(`purged-session-${index}`);
    }
    expect(cache.size).toBe(0);

    const input = {
      sessionId: 'unrelated-session',
      analysis: analysisFixture(),
      profile: profile(),
      packedAt: PACKED_AT,
    };
    expect(cache.getOrPackFreshlyAuthorized(input).cache).toBe('purge-fenced');
    expect(cache.size).toBe(0);

    now += 60_001;
    expect(cache.getOrPackFreshlyAuthorized(input).cache).toBe('miss');
    expect(cache.size).toBe(1);
  });
});
