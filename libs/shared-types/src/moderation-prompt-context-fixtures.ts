import type {
  ModerationPromptContextV1,
  ModerationPromptQuestion,
  ModerationQuestionNlpState,
} from './moderation-prompt-context';
import {
  MODERATION_DOMAIN_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_BUDGET_VERSION,
  MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION,
  MODERATION_PROMPT_DEFINITION_SET_VERSION,
  MODERATION_PROMPT_HASH_MATERIAL_VERSION,
} from './moderation-prompt-context';

type ReferenceQuestionKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * Deterministic issue #456 reference texts. A/B, C/D and E/F are fixture
 * groupings only; they are deliberately not an assertion about encoder output.
 */
export const MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1 = [
  {
    key: 'A',
    sourceId: 'qa-question:11111111-1111-4111-8111-111111111111',
    text: 'Können wir mehr Beispiele zur linearen Regression bearbeiten?',
  },
  {
    key: 'B',
    sourceId: 'qa-question:22222222-2222-4222-8222-222222222222',
    text: 'Gibt es ein weiteres Beispiel zur linearen Regression?',
  },
  {
    key: 'C',
    sourceId: 'qa-question:33333333-3333-4333-8333-333333333333',
    text: 'Ist Kapitel 4 klausurrelevant?',
  },
  {
    key: 'D',
    sourceId: 'qa-question:44444444-4444-4444-8444-444444444444',
    text: 'Müssen wir den vierten Abschnitt für die Prüfung lernen?',
  },
  {
    key: 'E',
    sourceId: 'qa-question:55555555-5555-4555-8555-555555555555',
    text: 'Soll die Anwesenheit verpflichtend sein?',
  },
  {
    key: 'F',
    sourceId: 'qa-question:66666666-6666-4666-8666-666666666666',
    text: 'Sollten wir eine Anwesenheitspflicht einführen?',
  },
] as const;

/**
 * Reference ranking inputs use the persisted session-participant record count
 * N=200 and the current qa-ranking-v1 formula (controversy damping C=20).
 */
export const MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1 = [
  {
    key: 'A',
    sourceId: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[0].sourceId,
    status: 'PENDING',
    answerState: 'unaddressed',
    positive: 80,
    negative: 30,
    net: 50,
    total: 110,
    bestScore: 0.637432407306822,
    controversyScore: 0.46153846153846156,
  },
  {
    key: 'B',
    sourceId: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[1].sourceId,
    status: 'ACTIVE',
    answerState: 'addressed',
    positive: 10,
    negative: 0,
    net: 10,
    total: 10,
    bestScore: 0.7224598312333834,
    controversyScore: 0,
  },
  {
    key: 'C',
    sourceId: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[2].sourceId,
    status: 'PINNED',
    answerState: 'addressed',
    positive: 30,
    negative: 0,
    net: 30,
    total: 30,
    bestScore: 0.886482908609522,
    controversyScore: 0,
  },
  {
    key: 'D',
    sourceId: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[3].sourceId,
    status: 'PENDING',
    answerState: 'unaddressed',
    positive: 12,
    negative: 0,
    net: 12,
    total: 12,
    bestScore: 0.7574992425007574,
    controversyScore: 0,
  },
  {
    key: 'E',
    sourceId: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[4].sourceId,
    status: 'ACTIVE',
    answerState: 'addressed',
    positive: 40,
    negative: 40,
    net: 0,
    total: 80,
    bestScore: 0.392972274311075,
    controversyScore: 0.8,
  },
  {
    key: 'F',
    sourceId: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[5].sourceId,
    status: 'PENDING',
    answerState: 'unaddressed',
    positive: 20,
    negative: 20,
    net: 0,
    total: 40,
    bestScore: 0.35199278797099753,
    controversyScore: 0.6666666666666666,
  },
] as const;

const TOPIC_SOURCE_ID_BY_QUESTION: Record<ReferenceQuestionKey, string> = {
  A: 'semantic-topic:linear-regression-examples',
  B: 'semantic-topic:linear-regression-examples',
  C: 'semantic-topic:exam-scope',
  D: 'semantic-topic:exam-scope',
  E: 'semantic-topic:attendance-policy',
  F: 'semantic-topic:attendance-policy',
};

function classifiedNlp(
  category: 'content' | 'organization' | 'technical',
): ModerationQuestionNlpState {
  return {
    state: 'classified',
    category,
    confidence: { value: 0.91, meaning: 'uncalibrated-model-score' },
    modelId: 'fixture-qa-classifier',
    modelVersion: '1',
    classifiedAt: '2026-01-15T10:00:00.000Z',
  };
}

function toPromptQuestion(
  item: (typeof MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1)[number],
): ModerationPromptQuestion {
  const nlp: ModerationQuestionNlpState =
    item.key === 'F'
      ? {
          state: 'uncertain',
          candidateCategory: 'organization',
          confidence: { value: 0.54, meaning: 'uncalibrated-model-score' },
          modelId: 'fixture-qa-classifier',
          modelVersion: '1',
          analyzedAt: '2026-01-15T10:00:00.000Z',
          reason: 'Fixture für einen ausdrücklich unsicheren Klassifikationsstand.',
        }
      : classifiedNlp(item.key === 'A' || item.key === 'B' ? 'content' : 'organization');

  return {
    sourceId: item.sourceId,
    status: item.status,
    answerState: { state: item.answerState },
    votes: {
      state: 'available',
      positive: item.positive,
      negative: item.negative,
      net: item.net,
      total: item.total,
      bestScore: { state: 'available', value: item.bestScore },
      controversyScore: { state: 'available', value: item.controversyScore },
    },
    nlp,
    topicSourceIds: [TOPIC_SOURCE_ID_BY_QUESTION[item.key]],
  };
}

const REFERENCE_QUESTION_SOURCE_IDS = MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1.map(
  (question) => question.sourceId,
);

/** Complete deterministic context used by later backend and adapter slices. */
export const MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1 = {
  schemaVersion: MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION,
  contractVersion: MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION,
  packedAt: '2026-01-15T10:05:00.000Z',
  hashAlgorithm: 'sha-256',
  hashMaterialVersion: MODERATION_PROMPT_HASH_MATERIAL_VERSION,
  snapshotHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  context: {
    contractVersion: MODERATION_DOMAIN_CONTEXT_CONTRACT_VERSION,
    representation: 'prompt-selection',
    definitionsVersion: MODERATION_PROMPT_DEFINITION_SET_VERSION,
    locale: 'de',
    meta: {
      sourceRevision: 'session-state-r1',
      analysisVersion: 'fixture-analysis-v1',
      selectionVersion: 'fixture-selection-v1',
      revisions: {
        questionText: { state: 'available', value: 'question-text-r1' },
        questionVotes: { state: 'available', value: 'question-votes-r1' },
        questionStatus: { state: 'available', value: 'question-status-r1' },
        questionAnswerState: { state: 'available', value: 'question-answer-state-r1' },
        questionNlp: { state: 'available', value: 'question-nlp-r1' },
        topics: { state: 'available', value: 'questions-r1' },
        learningObjectives: { state: 'available', value: 'objectives-r1' },
        releasedResults: { state: 'available', value: 'quiz-results-r1' },
        feedback: { state: 'unavailable', reason: 'no-data' },
      },
    },
    scope: {
      channels: ['qa', 'quiz'],
      sessionPhase: 'ACTIVE',
      questionFilter: {
        state: 'available',
        statuses: ['PENDING', 'ACTIVE', 'PINNED'],
        timeWindow: { kind: 'entire-session' },
      },
      activeWeighting: { kind: 'qa-ranking', version: 'qa-ranking-v1', sortMode: 'TOP' },
      selectionLimits: {
        questions: 40,
        topics: 12,
        compassSignals: 12,
        learningObjectives: 20,
        resultAggregates: 20,
        feedbackAggregates: 20,
      },
    },
    questions: {
      state: 'available',
      participantBasis: {
        state: 'available',
        kind: 'session-participant-record-count',
        value: 200,
        calculationVersion: 'qa-ranking-v1',
      },
      corpus: {
        total: 6,
        eligible: 6,
        analyzed: 6,
        deduplicated: 6,
        represented: 6,
      },
      items: MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1.map(toPromptQuestion),
    },
    topics: {
      state: 'available',
      analysisVersion: 'fixture-semantic-analysis-v1',
      model: { id: 'fixture-semantic-encoder', version: '1' },
      analyzedAt: '2026-01-15T10:01:00.000Z',
      freshness: { state: 'current', analysisRevision: 'questions-r1' },
      corpus: { eligibleQuestions: 6, analyzedQuestions: 6, representedQuestions: 6 },
      items: [
        {
          sourceId: 'semantic-topic:linear-regression-examples',
          labelOrigin: {
            kind: 'source-extractive',
            sourceQuestionId: REFERENCE_QUESTION_SOURCE_IDS[0],
          },
          labelQuality: { state: 'unavailable', value: null, reason: 'not-collected' },
          clusterConfidence: {
            state: 'available',
            value: 0.94,
            meaning: 'uncalibrated-model-score',
          },
          aggregates: {
            questionCount: 2,
            positiveVotes: 90,
            negativeVotes: 30,
            netVotes: 60,
            totalVotes: 120,
            distinctParticipants: {
              state: 'unavailable',
              value: null,
              reason: 'not-collected',
            },
          },
          scope: {
            membership: 'analyzed-corpus',
            representedMembers: 'context-represented-corpus',
          },
          memberQuestionSourceIds: REFERENCE_QUESTION_SOURCE_IDS.slice(0, 2),
          representedQuestionSourceIds: REFERENCE_QUESTION_SOURCE_IDS.slice(0, 2),
          representativeQuestionSourceId: REFERENCE_QUESTION_SOURCE_IDS[0],
        },
        {
          sourceId: 'semantic-topic:exam-scope',
          labelOrigin: {
            kind: 'source-extractive',
            sourceQuestionId: REFERENCE_QUESTION_SOURCE_IDS[2],
          },
          labelQuality: { state: 'unavailable', value: null, reason: 'not-collected' },
          clusterConfidence: {
            state: 'available',
            value: 0.92,
            meaning: 'uncalibrated-model-score',
          },
          aggregates: {
            questionCount: 2,
            positiveVotes: 42,
            negativeVotes: 0,
            netVotes: 42,
            totalVotes: 42,
            distinctParticipants: {
              state: 'unavailable',
              value: null,
              reason: 'not-collected',
            },
          },
          scope: {
            membership: 'analyzed-corpus',
            representedMembers: 'context-represented-corpus',
          },
          memberQuestionSourceIds: REFERENCE_QUESTION_SOURCE_IDS.slice(2, 4),
          representedQuestionSourceIds: REFERENCE_QUESTION_SOURCE_IDS.slice(2, 4),
          representativeQuestionSourceId: REFERENCE_QUESTION_SOURCE_IDS[2],
        },
        {
          sourceId: 'semantic-topic:attendance-policy',
          labelOrigin: {
            kind: 'source-extractive',
            sourceQuestionId: REFERENCE_QUESTION_SOURCE_IDS[4],
          },
          labelQuality: { state: 'unavailable', value: null, reason: 'not-collected' },
          clusterConfidence: {
            state: 'available',
            value: 0.9,
            meaning: 'uncalibrated-model-score',
          },
          aggregates: {
            questionCount: 2,
            positiveVotes: 60,
            negativeVotes: 60,
            netVotes: 0,
            totalVotes: 120,
            distinctParticipants: {
              state: 'unavailable',
              value: null,
              reason: 'not-collected',
            },
          },
          scope: {
            membership: 'analyzed-corpus',
            representedMembers: 'context-represented-corpus',
          },
          memberQuestionSourceIds: REFERENCE_QUESTION_SOURCE_IDS.slice(4, 6),
          representedQuestionSourceIds: REFERENCE_QUESTION_SOURCE_IDS.slice(4, 6),
          representativeQuestionSourceId: REFERENCE_QUESTION_SOURCE_IDS[4],
        },
      ],
    },
    compass: {
      state: 'available',
      rulesVersion: 'fixture-compass-rules-v1',
      signals: [
        {
          sourceId: 'compass-signal:highest-best-score',
          signal: 'high-best-score',
          basis: 'best-score',
          questionSourceIds: [REFERENCE_QUESTION_SOURCE_IDS[2]],
          value: MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1[2].bestScore,
          reason: 'Frage C hat im Auswahlkorpus den höchsten Best-Score.',
          evidence: [
            {
              sourceId: REFERENCE_QUESTION_SOURCE_IDS[2],
              detail: 'Best-Score 0,886483 bei 30 positiven und 0 negativen Stimmen.',
            },
          ],
          suggestedNextStep: {
            action: 'address-question',
            rationale: 'Den häufig unterstützten Prüfungsbezug explizit beantworten.',
          },
        },
        {
          sourceId: 'compass-signal:highest-controversy',
          signal: 'high-controversy',
          basis: 'controversy-score',
          questionSourceIds: [REFERENCE_QUESTION_SOURCE_IDS[4]],
          value: MODERATION_PROMPT_REFERENCE_RANKING_FIXTURE_V1[4].controversyScore,
          reason: 'Frage E hat im Auswahlkorpus die höchste Kontroversität.',
          evidence: [
            {
              sourceId: REFERENCE_QUESTION_SOURCE_IDS[4],
              detail: 'Kontroversität 0,8 bei 40 positiven und 40 negativen Stimmen.',
            },
          ],
          suggestedNextStep: {
            action: 'open-discussion',
            rationale: 'Die ausgeglichene Kontroverse moderiert zur Diskussion stellen.',
          },
        },
      ],
    },
    learningContext: {
      state: 'available',
      objectives: [
        {
          sourceId: 'learning-objective:linear-regression-application',
          scope: { kind: 'session' },
          origin: { kind: 'manual' },
          confirmation: {
            state: 'confirmed',
            confirmedAt: '2026-01-15T09:45:00.000Z',
            revision: 'objective-r1',
          },
        },
      ],
    },
    releasedResults: {
      state: 'not-released',
      reason: 'Fixture bildet eine laufende Session vor der Ergebnisfreigabe ab.',
    },
    feedback: { state: 'unavailable', reason: 'no-data' },
    sources: [
      ...MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1.map((question) => ({
        id: question.sourceId,
        kind: 'qa-question' as const,
        content: { state: 'included' as const, text: question.text, truncated: false },
      })),
      {
        id: 'semantic-topic:linear-regression-examples',
        kind: 'semantic-topic',
        label: 'Beispiele zur linearen Regression',
      },
      {
        id: 'semantic-topic:exam-scope',
        kind: 'semantic-topic',
        label: 'Prüfungsumfang',
      },
      {
        id: 'semantic-topic:attendance-policy',
        kind: 'semantic-topic',
        label: 'Anwesenheitspflicht',
      },
      {
        id: 'compass-signal:highest-best-score',
        kind: 'compass-signal',
        label: 'Höchster Best-Score im Auswahlkorpus',
      },
      {
        id: 'compass-signal:highest-controversy',
        kind: 'compass-signal',
        label: 'Höchste Kontroversität im Auswahlkorpus',
      },
      {
        id: 'learning-objective:linear-regression-application',
        kind: 'learning-objective',
        text: 'Die Studierenden können lineare Regressionsmodelle anwenden.',
      },
    ],
    limitations: [
      {
        code: 'not-released',
        section: 'released-results',
        detail: 'Quizergebnisse sind in dieser laufenden Session noch nicht freigegeben.',
      },
      {
        code: 'module-unavailable',
        section: 'feedback',
        detail: 'Es liegen keine aggregierten Feedbackdaten vor.',
      },
    ],
  },
  budget: {
    version: MODERATION_PROMPT_BUDGET_VERSION,
    tokenizer: {
      method: 'conservative-estimate',
      id: 'fixture-estimator',
      version: '1',
    },
    modelProfile: 'fixture-private-runtime',
    contextWindowTokens: 8192,
    instructionTokens: 600,
    definitionTokens: 500,
    dataTokens: 1800,
    packedInputTokens: 2900,
    reservedOutputTokens: 1200,
    safetyMarginTokens: 512,
    truncations: [],
  },
} satisfies ModerationPromptContextV1;

/**
 * Valid small context. A computed score of 0 remains distinct from an
 * unavailable metric, while all non-Q&A modules carry explicit states.
 */
export const MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1 = {
  schemaVersion: MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION,
  contractVersion: MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION,
  packedAt: '2026-01-15T10:05:00.000Z',
  hashAlgorithm: 'sha-256',
  hashMaterialVersion: MODERATION_PROMPT_HASH_MATERIAL_VERSION,
  snapshotHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  context: {
    contractVersion: MODERATION_DOMAIN_CONTEXT_CONTRACT_VERSION,
    representation: 'prompt-selection',
    definitionsVersion: MODERATION_PROMPT_DEFINITION_SET_VERSION,
    locale: 'de',
    meta: {
      sourceRevision: 'session-state-minimal-r1',
      analysisVersion: 'fixture-analysis-v1',
      selectionVersion: 'fixture-selection-v1',
      revisions: {
        questionText: { state: 'available', value: 'question-text-r1' },
        questionVotes: { state: 'available', value: 'question-votes-r1' },
        questionStatus: { state: 'available', value: 'question-status-r1' },
        questionAnswerState: { state: 'available', value: 'question-answer-state-r1' },
        questionNlp: { state: 'available', value: 'question-nlp-r1' },
        topics: { state: 'not-applicable', reason: 'Themenmodul ist deaktiviert.' },
        learningObjectives: { state: 'unavailable', reason: 'not-collected' },
        releasedResults: { state: 'available', value: 'quiz-results-r1' },
        feedback: { state: 'not-applicable', reason: 'Kein Feedbackkanal im Scope.' },
      },
    },
    scope: {
      channels: ['qa'],
      sessionPhase: 'ACTIVE',
      questionFilter: {
        state: 'available',
        statuses: ['PENDING'],
        timeWindow: { kind: 'entire-session' },
      },
      activeWeighting: { kind: 'qa-ranking', version: 'qa-ranking-v1', sortMode: 'TOP' },
      selectionLimits: {
        questions: 10,
        topics: 0,
        compassSignals: 0,
        learningObjectives: 0,
        resultAggregates: 0,
        feedbackAggregates: 0,
      },
    },
    questions: {
      state: 'available',
      participantBasis: { state: 'unavailable', reason: 'not-collected' },
      corpus: { total: 1, eligible: 1, analyzed: 1, deduplicated: 1, represented: 1 },
      items: [
        {
          sourceId: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[0].sourceId,
          status: 'PENDING',
          answerState: { state: 'unaddressed' },
          votes: {
            state: 'available',
            positive: 0,
            negative: 0,
            net: 0,
            total: 0,
            bestScore: { state: 'available', value: 0 },
            controversyScore: {
              state: 'unavailable',
              value: null,
              reason: 'not-computable',
            },
          },
          nlp: { state: 'disabled', reason: 'NLP ist im Minimalfixture deaktiviert.' },
          topicSourceIds: [],
        },
      ],
    },
    topics: { state: 'disabled', reason: 'Semantische Themen sind deaktiviert.' },
    compass: { state: 'unavailable', reason: 'no-data' },
    learningContext: { state: 'unavailable', reason: 'not-collected' },
    releasedResults: { state: 'not-released', reason: 'Ergebnisse sind nicht freigegeben.' },
    feedback: { state: 'not-applicable', reason: 'Kein Feedbackkanal im Scope.' },
    sources: [
      {
        id: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[0].sourceId,
        kind: 'qa-question',
        content: {
          state: 'included',
          text: MODERATION_PROMPT_REFERENCE_TEXT_FIXTURE_V1[0].text,
          truncated: false,
        },
      },
    ],
    limitations: [
      {
        code: 'module-disabled',
        section: 'topics',
        detail: 'Semantische Themen sind im Minimalfixture ausdrücklich deaktiviert.',
      },
      {
        code: 'not-released',
        section: 'released-results',
        detail: 'Es werden keine nicht freigegebenen Ergebnisse gepackt.',
      },
    ],
  },
  budget: {
    version: MODERATION_PROMPT_BUDGET_VERSION,
    tokenizer: { method: 'conservative-estimate', id: 'fixture-estimator', version: '1' },
    modelProfile: 'fixture-private-runtime',
    contextWindowTokens: 4096,
    instructionTokens: 400,
    definitionTokens: 400,
    dataTokens: 200,
    packedInputTokens: 1000,
    reservedOutputTokens: 800,
    safetyMarginTokens: 256,
    truncations: [],
  },
} satisfies ModerationPromptContextV1;
