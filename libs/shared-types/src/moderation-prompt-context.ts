import { z } from 'zod';

import {
  AbcdValueEnum,
  AppLocaleEnum,
  MoodValueEnum,
  QaNlpCategoryEnum,
  QaQuestionSortModeEnum,
  SessionLiveChannelSchema,
  SessionStatusEnum,
  StarsValueEnum,
  TempoValueEnum,
  TrueFalseUnknownValueEnum,
  YesNoBinaryValueEnum,
  YesNoValueEnum,
} from './schemas';
import {
  MODERATION_COMPASS_CARD_KINDS,
  MODERATION_COMPASS_RULES_VERSION,
} from './moderation-compass-rules.js';

/**
 * Versioned contract for the domain projection and the payload packed for the
 * private moderation model. The authorized collection state deliberately is
 * not a shared DTO: it stays backend-internal and is created only after the
 * applicable host/capability procedure has succeeded.
 */
export const MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION = 1 as const;
export const MODERATION_DOMAIN_CONTEXT_CONTRACT_VERSION = 'moderation-domain-context-v1' as const;
export const MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION =
  'moderation-analysis-context-v1' as const;
export const MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION = 'moderation-prompt-context-v1' as const;
export const MODERATION_PROMPT_DEFINITION_SET_VERSION = 'moderation-prompt-definitions-v1' as const;
export const MODERATION_PROMPT_HASH_MATERIAL_VERSION =
  'moderation-prompt-hash-material-v1' as const;
export const MODERATION_PROMPT_BUDGET_VERSION = 'moderation-prompt-budget-v1' as const;
export const MODERATION_QUIZ_EFFECTIVE_VOTE_BASIS_VERSION = 'effective-vote-v1' as const;
export const MODERATION_QUIZ_ROUND_COMPARISON_BASIS_VERSION = 'round-comparison-v1' as const;

export const MODERATION_PROMPT_SOURCE_ID_PREFIXES = {
  qaQuestion: 'qa-question:',
  semanticTopic: 'semantic-topic:',
  quizQuestion: 'quiz-question:',
  learningObjective: 'learning-objective:',
  quizResultAggregate: 'quiz-result-aggregate:',
  feedbackAggregate: 'feedback-aggregate:',
  compassSignal: 'compass-signal:',
} as const;

export const ModerationPromptDefinitionKeySchema = z.enum([
  'best-score',
  'controversy-score',
  'vote-count',
  'effective-vote',
  'round-comparison',
  'question-frequency',
  'distinct-participants',
  'nlp-category',
  'semantic-topic',
  'pending-question',
  'question-answer-state',
  'model-confidence',
  'compass-rule-score',
  'learning-objective-origin',
  'whole-corpus',
  'analyzed-corpus',
  'candidate-corpus',
  'selected-corpus',
  'quiz-scope-id',
  'quiz-section-scope-id',
  'answer-option-id',
]);
export type ModerationPromptDefinitionKey = z.infer<typeof ModerationPromptDefinitionKeySchema>;

const MODERATION_PROMPT_DEFINITION_KEYS = ModerationPromptDefinitionKeySchema.options;

export const ModerationPromptDefinitionSchema = z
  .object({
    key: ModerationPromptDefinitionKeySchema,
    label: z.string().trim().min(1).max(80),
    meaning: z.string().trim().min(1).max(600),
    caveat: z.string().trim().min(1).max(400).nullable(),
  })
  .strict();
export type ModerationPromptDefinition = z.infer<typeof ModerationPromptDefinitionSchema>;

export const ModerationPromptDefinitionSetV1Schema = z
  .object({
    version: z.literal(MODERATION_PROMPT_DEFINITION_SET_VERSION),
    locale: z.literal('de'),
    definitions: z
      .array(ModerationPromptDefinitionSchema)
      .length(MODERATION_PROMPT_DEFINITION_KEYS.length),
  })
  .strict()
  .superRefine((value, ctx) => {
    const actualKeys = value.definitions.map((definition) => definition.key);
    const uniqueKeys = new Set(actualKeys);
    for (const expectedKey of MODERATION_PROMPT_DEFINITION_KEYS) {
      if (!uniqueKeys.has(expectedKey)) {
        ctx.addIssue({
          code: 'custom',
          path: ['definitions'],
          message: `Definition fehlt: ${expectedKey}`,
        });
      }
    }
    if (uniqueKeys.size !== actualKeys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['definitions'],
        message: 'Definitionsschlüssel müssen eindeutig sein.',
      });
    }
  });
export type ModerationPromptDefinitionSetV1 = z.infer<typeof ModerationPromptDefinitionSetV1Schema>;

export const MODERATION_PROMPT_DEFINITION_SET_V1 = {
  version: MODERATION_PROMPT_DEFINITION_SET_VERSION,
  locale: 'de',
  definitions: [
    {
      key: 'best-score',
      label: 'Best-Score',
      meaning:
        'Wilson-Untergrenze des Anteils positiver Stimmen. Ein höherer Wert bedeutet robustere positive Unterstützung, nicht mehr absolute Stimmen.',
      caveat:
        'Der Wert 0 ist ein berechneter Wert und nicht gleichbedeutend mit fehlenden Daten; der Score misst weder fachliche Qualität noch Lernstand.',
    },
    {
      key: 'controversy-score',
      label: 'Kontroversität',
      meaning:
        'Gedämpftes Maß für das Gleichgewicht positiver und negativer Stimmen auf Basis der explizit angegebenen Raumbezugsgröße.',
      caveat: 'Der Wert misst Uneinigkeit, nicht Wichtigkeit oder Qualität.',
    },
    {
      key: 'vote-count',
      label: 'Stimmen',
      meaning:
        'Positive und negative Stimmen werden getrennt gezählt; Netto ist positiv minus negativ und Gesamt ist positiv plus negativ.',
      caveat:
        'Der historische upvoteCount darf nicht als Zahl positiver Stimmen interpretiert werden.',
    },
    {
      key: 'effective-vote',
      label: 'Effektive Quizstimme',
      meaning:
        'Pro Person und Frage zählt höchstens eine Quizstimme: Sobald für die Frage Runde 2 existiert, ersetzt diese Runde 1; andernfalls zählt Runde 1.',
      caveat:
        'Runde 1 und Runde 2 dürfen weder addiert noch für dieselbe Frage personenübergreifend mit unterschiedlichen Rundengrundlagen vermischt werden.',
    },
    {
      key: 'round-comparison',
      label: 'Rundenvergleich',
      meaning:
        'Vergleicht Runde 1 und Runde 2 derselben Quizfrage als getrennte Populationen; die Rundenwerte werden nicht zur effektiven Stimme zusammengeführt.',
      caveat:
        'Ein Rundenvergleich beschreibt Veränderungen zwischen den Runden und darf nicht als effektive Abstimmung oder kausaler Lerneffekt ausgegeben werden.',
    },
    {
      key: 'question-frequency',
      label: 'Fragehäufigkeit',
      meaning: 'Anzahl fachlich getrennter Fragen oder Beiträge im ausdrücklich benannten Korpus.',
      caveat: 'Nicht mit Stimmen oder der Anzahl verschiedener Personen gleichsetzen.',
    },
    {
      key: 'distinct-participants',
      label: 'Verschiedene Personen',
      meaning:
        'Nur eine ausdrücklich so bezeichnete, datenschutzkonform aggregierte Anzahl verschiedener Personen.',
      caveat: 'Fehlt diese Messung, darf sie nicht aus Stimmen oder Beiträgen geschätzt werden.',
    },
    {
      key: 'nlp-category',
      label: 'Klassifikationskategorie',
      meaning: 'Festes Label aus Inhalt, Organisation oder Technik für genau eine Q&A-Frage.',
      caveat: 'Kategorien sind keine semantisch gebildeten Themen.',
    },
    {
      key: 'semantic-topic',
      label: 'Semantisches Thema',
      meaning: 'Explizit versionierte Gruppierung inhaltlich ähnlicher, referenzierter Fragen.',
      caveat: 'Eine Fixture-Gruppierung ist keine Aussage über den Erfolg eines realen Encoders.',
    },
    {
      key: 'pending-question',
      label: 'Ausstehende Frage',
      meaning:
        'PENDING bezeichnet eine noch nicht als aktiv oder angeheftet veröffentlichte Q&A-Frage.',
      caveat:
        'Der Status ist kein NLP-Verarbeitungsstatus und belegt weder fachlichen Klärungsbedarf noch Lernbedarf.',
    },
    {
      key: 'question-answer-state',
      label: 'Bearbeitungsstand einer Frage',
      meaning:
        'addressed und unaddressed bezeichnen einen ausdrücklich erhobenen Bearbeitungsstand der Q&A-Frage; unavailable kennzeichnet einen nicht verfügbaren Stand.',
      caveat:
        'Der Bearbeitungsstand ist unabhängig von PENDING/ACTIVE/PINNED, NLP-Zustand und Quiz-Antwortvollständigkeit; unaddressed beweist keinen fachlichen Klärungs- oder Lernbedarf.',
    },
    {
      key: 'model-confidence',
      label: 'Modellkonfidenz',
      meaning: 'Unkalibrierter, modellspezifischer Score im Intervall von 0 bis 1.',
      caveat: 'Der Wert ist keine kalibrierte Wahrscheinlichkeit.',
    },
    {
      key: 'compass-rule-score',
      label: 'Kompass-Regelscore',
      meaning:
        'Regelspezifischer normierter Auslösewert im Intervall von 0 bis 1; seine Messbasis und rulesVersion bestimmen die Bedeutung.',
      caveat:
        'Der Wert ist weder Wahrscheinlichkeit noch fachliche Qualität oder Lernstand und darf nicht über verschiedene Messbasen oder Regelversionen hinweg verglichen werden.',
    },
    {
      key: 'learning-objective-origin',
      label: 'Lernzielherkunft',
      meaning: 'Kennzeichnet ein Lernziel getrennt als manuell oder modellabgeleitet.',
      caveat: 'Herkunft und Bestätigung durch den Host sind unabhängige Zustände.',
    },
    {
      key: 'whole-corpus',
      label: 'Gesamtkorpus',
      meaning: 'Alle im autorisierten fachlichen Umfang vorhandenen Elemente vor Filtern.',
      caveat: 'Kann größer sein als der analysierbare oder gepackte Korpus.',
    },
    {
      key: 'analyzed-corpus',
      label: 'Analysekorpus',
      meaning: 'Teilmenge des berechtigten Korpus, für die die jeweilige Analyse vorliegt.',
      caveat: 'Eine Analyse kann fehlen, ausstehen, fehlschlagen oder veraltet sein.',
    },
    {
      key: 'candidate-corpus',
      label: 'Kandidatenkorpus',
      meaning:
        'Vor dem Tokenbudget autorisierte fachliche Kandidaten; sie sind noch nicht für einen Modellauftrag ausgewählt oder gepackt.',
      caveat: 'Kandidaten dürfen die spätere Auswahlgrenze überschreiten.',
    },
    {
      key: 'selected-corpus',
      label: 'Auswahlkorpus',
      meaning: 'Nach Filterung, Deduplizierung und Budgetauswahl tatsächlich gepackte Teilmenge.',
      caveat: 'Nicht ausgewählte Elemente dürfen nicht als nicht vorhanden ausgegeben werden.',
    },
    {
      key: 'quiz-scope-id',
      label: 'Quiz-Scope-ID',
      meaning:
        'Opaker, lokal stabiler Schlüssel für den fachlichen Umfang eines Quiz; keine Quellen-ID und kein Modelltext.',
      caveat: 'Der Schlüssel darf nicht als Quellenreferenz dereferenziert werden.',
    },
    {
      key: 'quiz-section-scope-id',
      label: 'Quizabschnitt-Scope-ID',
      meaning:
        'Opaker, lokal stabiler Schlüssel für einen Abschnitt innerhalb eines Quiz-Scope; keine Quellen-ID und kein Modelltext.',
      caveat: 'Der Schlüssel ist nur zusammen mit der zugehörigen Quiz-Scope-ID eindeutig.',
    },
    {
      key: 'answer-option-id',
      label: 'Antwortoptions-ID',
      meaning:
        'Opaker, innerhalb einer Antwortverteilung eindeutiger Optionsschlüssel; die fachliche Bedeutung steht ausschließlich im separaten Label.',
      caveat: 'Der Schlüssel ist keine Quellenreferenz und enthält keinen Lösungshinweis.',
    },
  ],
} as const satisfies ModerationPromptDefinitionSetV1;

export const ModerationPromptSectionSchema = z.enum([
  'questions',
  'topics',
  'compass',
  'learning-context',
  'released-results',
  'feedback',
]);
export type ModerationPromptSection = z.infer<typeof ModerationPromptSectionSchema>;

const ExplicitUnavailableReasonSchema = z.enum([
  'not-collected',
  'not-supported',
  'outside-scope',
  'no-data',
]);

const ExplicitUnavailableStateSchema = z
  .object({
    state: z.literal('unavailable'),
    reason: ExplicitUnavailableReasonSchema,
  })
  .strict();
const ExplicitDisabledStateSchema = z
  .object({
    state: z.literal('disabled'),
    reason: z.string().trim().min(1).max(200),
  })
  .strict();
const ExplicitPendingStateSchema = z
  .object({
    state: z.literal('pending'),
    reason: z.string().trim().min(1).max(200),
  })
  .strict();
const ExplicitFailedStateSchema = z
  .object({
    state: z.literal('failed'),
    reason: z.string().trim().min(1).max(200),
  })
  .strict();
const ExplicitNotApplicableStateSchema = z
  .object({
    state: z.literal('not-applicable'),
    reason: z.string().trim().min(1).max(200),
  })
  .strict();

export const ModerationMetricUnavailableReasonSchema = z.enum([
  'not-collected',
  'not-computable',
  'outside-scope',
]);

export const ModerationUnitIntervalMetricSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      value: z.number().min(0).max(1),
    })
    .strict(),
  z
    .object({
      state: z.literal('unavailable'),
      value: z.null(),
      reason: ModerationMetricUnavailableReasonSchema,
    })
    .strict(),
]);
export type ModerationUnitIntervalMetric = z.infer<typeof ModerationUnitIntervalMetricSchema>;

const MODERATION_QA_RANKING_WILSON_Z = 1.96;
const MODERATION_QA_RANKING_WILSON_Z_SQUARED =
  MODERATION_QA_RANKING_WILSON_Z * MODERATION_QA_RANKING_WILSON_Z;

/**
 * PostgreSQL and JavaScript both evaluate qa-ranking-v1 with binary64 values.
 * The epsilon permits only their final rounding difference, not rounded or
 * independently supplied score values.
 */
export const MODERATION_QA_RANKING_SCORE_TOLERANCE = 1e-12;

export function calculateModerationQaBestScoreV1(input: {
  readonly positive: number;
  readonly negative: number;
}): number {
  const total = input.positive + input.negative;
  if (total === 0) return 0;

  const positiveShare = input.positive / total;
  const score =
    (positiveShare +
      MODERATION_QA_RANKING_WILSON_Z_SQUARED / (2 * total) -
      MODERATION_QA_RANKING_WILSON_Z *
        Math.sqrt(
          (positiveShare * (1 - positiveShare)) / total +
            MODERATION_QA_RANKING_WILSON_Z_SQUARED / (4 * total * total),
        )) /
    (1 + MODERATION_QA_RANKING_WILSON_Z_SQUARED / total);
  return Math.max(0, Math.min(1, score));
}

export function calculateModerationQaControversyScoreV1(input: {
  readonly positive: number;
  readonly negative: number;
  readonly participantBasis: number;
}): number {
  const total = input.positive + input.negative;
  if (total === 0) return 0;

  const damping = Math.max(1, Math.ceil(input.participantBasis * 0.1));
  return Math.min(1, (2 * Math.min(input.positive, input.negative)) / (total + damping));
}

function matchesModerationQaRankingScore(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= MODERATION_QA_RANKING_SCORE_TOLERANCE;
}

export const ModerationUncalibratedConfidenceMetricSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      value: z.number().min(0).max(1),
      meaning: z.literal('uncalibrated-model-score'),
    })
    .strict(),
  z
    .object({
      state: z.literal('unavailable'),
      value: z.null(),
      reason: ModerationMetricUnavailableReasonSchema,
    })
    .strict(),
]);

export const ModerationQuestionVotesSchema = z
  .object({
    state: z.literal('available'),
    positive: z.number().int().nonnegative(),
    negative: z.number().int().nonnegative(),
    net: z.number().int(),
    total: z.number().int().nonnegative(),
    bestScore: ModerationUnitIntervalMetricSchema,
    controversyScore: ModerationUnitIntervalMetricSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.positive + value.negative !== value.total) {
      ctx.addIssue({
        code: 'custom',
        path: ['total'],
        message: 'total muss positive + negative entsprechen.',
      });
    }
    if (value.positive - value.negative !== value.net) {
      ctx.addIssue({
        code: 'custom',
        path: ['net'],
        message: 'net muss positive - negative entsprechen.',
      });
    }
  });

export const ModerationQuestionVoteStateSchema = z.discriminatedUnion('state', [
  ModerationQuestionVotesSchema,
  z
    .object({
      state: z.literal('unavailable'),
      reason: ModerationMetricUnavailableReasonSchema,
    })
    .strict(),
]);
export type ModerationQuestionVoteState = z.infer<typeof ModerationQuestionVoteStateSchema>;

const ModerationModelConfidenceSchema = z
  .object({
    value: z.number().min(0).max(1),
    meaning: z.literal('uncalibrated-model-score'),
  })
  .strict();

export const ModerationQuestionNlpStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('pending') }).strict(),
  z
    .object({
      state: z.literal('classified'),
      category: QaNlpCategoryEnum,
      confidence: ModerationModelConfidenceSchema,
      modelId: z.string().trim().min(1).max(120),
      modelVersion: z.string().trim().min(1).max(120),
      classifiedAt: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      state: z.literal('uncertain'),
      candidateCategory: QaNlpCategoryEnum.nullable(),
      confidence: ModerationModelConfidenceSchema,
      modelId: z.string().trim().min(1).max(120),
      modelVersion: z.string().trim().min(1).max(120),
      analyzedAt: z.string().datetime(),
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
  z
    .object({
      state: z.literal('disabled'),
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
  z
    .object({
      state: z.literal('failed'),
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
]);
export type ModerationQuestionNlpState = z.infer<typeof ModerationQuestionNlpStateSchema>;

export const ModerationPromptQuestionStatusSchema = z.enum(['PENDING', 'ACTIVE', 'PINNED']);

export const ModerationPromptQuestionAnswerStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unaddressed') }).strict(),
  z.object({ state: z.literal('addressed') }).strict(),
  z
    .object({
      state: z.literal('unavailable'),
      reason: ModerationMetricUnavailableReasonSchema,
    })
    .strict(),
]);

export const ModerationPromptQuestionSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(160),
    status: ModerationPromptQuestionStatusSchema,
    answerState: ModerationPromptQuestionAnswerStateSchema,
    votes: ModerationQuestionVoteStateSchema,
    nlp: ModerationQuestionNlpStateSchema,
    topicSourceIds: z.array(z.string().trim().min(1).max(160)).max(12),
  })
  .strict();
export type ModerationPromptQuestion = z.infer<typeof ModerationPromptQuestionSchema>;

export const ModerationCorpusCountsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    eligible: z.number().int().nonnegative(),
    analyzed: z.number().int().nonnegative(),
    deduplicated: z.number().int().nonnegative(),
    represented: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.eligible > value.total ||
      value.analyzed > value.eligible ||
      value.deduplicated > value.analyzed ||
      value.represented > value.deduplicated
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Es muss represented ≤ deduplicated ≤ analyzed ≤ eligible ≤ total gelten.',
      });
    }
  });

export const ModerationNonnegativeCountMetricSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      value: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      state: z.literal('unavailable'),
      value: z.null(),
      reason: ModerationMetricUnavailableReasonSchema,
    })
    .strict(),
]);

const ModerationParticipantBasisSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      kind: z.literal('session-participant-record-count'),
      value: z.number().int().nonnegative(),
      calculationVersion: z.literal('qa-ranking-v1'),
    })
    .strict(),
  z
    .object({
      state: z.literal('unavailable'),
      reason: ModerationMetricUnavailableReasonSchema,
    })
    .strict(),
]);

export const ModerationQuestionsSectionSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      participantBasis: ModerationParticipantBasisSchema,
      corpus: ModerationCorpusCountsSchema,
      items: z.array(ModerationPromptQuestionSchema).max(200),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.corpus.represented !== value.items.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['corpus', 'represented'],
          message: 'represented muss der Zahl im Kontext dargestellter Fragen entsprechen.',
        });
      }
      value.items.forEach((question, questionIndex) => {
        if (question.votes.state !== 'available') return;

        const expectedBestScore = calculateModerationQaBestScoreV1(question.votes);
        if (
          question.votes.bestScore.state === 'available' &&
          !matchesModerationQaRankingScore(question.votes.bestScore.value, expectedBestScore)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', questionIndex, 'votes', 'bestScore'],
            message:
              'Ein verfügbarer Best-Score muss der qa-ranking-v1-Berechnung aus den Stimmen entsprechen.',
          });
        }

        if (value.participantBasis.state === 'unavailable') {
          if (question.votes.controversyScore.state === 'available') {
            ctx.addIssue({
              code: 'custom',
              path: ['items', questionIndex, 'votes', 'controversyScore'],
              message:
                'Ein verfügbarer Kontroversitätswert benötigt eine verfügbare Teilnehmerbasis.',
            });
          }
          return;
        }

        if (question.votes.total > value.participantBasis.value) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', questionIndex, 'votes', 'total'],
            message: 'Die Gesamtstimmenzahl darf die verfügbare Teilnehmerbasis nicht übersteigen.',
          });
        }

        const expectedControversyScore = calculateModerationQaControversyScoreV1({
          ...question.votes,
          participantBasis: value.participantBasis.value,
        });
        if (
          question.votes.controversyScore.state === 'available' &&
          !matchesModerationQaRankingScore(
            question.votes.controversyScore.value,
            expectedControversyScore,
          )
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', questionIndex, 'votes', 'controversyScore'],
            message:
              'Ein verfügbarer Kontroversitätswert muss der qa-ranking-v1-Berechnung aus Stimmen und Teilnehmerbasis entsprechen.',
          });
        }
      });
    }),
  ExplicitUnavailableStateSchema,
  ExplicitDisabledStateSchema,
  ExplicitPendingStateSchema,
  ExplicitFailedStateSchema,
  ExplicitNotApplicableStateSchema,
]);

const ModerationTopicFreshnessSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('current'),
      analysisRevision: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      state: z.literal('stale'),
      analysisRevision: z.string().trim().min(1).max(120),
      currentRevision: z.string().trim().min(1).max(120),
      reason: z.string().trim().min(1).max(200),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.analysisRevision === value.currentRevision) {
        ctx.addIssue({
          code: 'custom',
          path: ['currentRevision'],
          message: 'Ein veralteter Stand benötigt unterschiedliche Revisionen.',
        });
      }
    }),
]);

export const ModerationSemanticTopicSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(160),
    labelOrigin: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('source-extractive'),
          sourceQuestionId: z.string().trim().min(1).max(160),
        })
        .strict(),
      z.object({ kind: z.literal('manual') }).strict(),
      z
        .object({
          kind: z.literal('model-generated'),
          modelId: z.string().trim().min(1).max(120),
          modelVersion: z.string().trim().min(1).max(120),
          generationVersion: z.string().trim().min(1).max(120),
          derivedFromSourceIds: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
        })
        .strict(),
    ]),
    labelQuality: ModerationUnitIntervalMetricSchema,
    clusterConfidence: ModerationUncalibratedConfidenceMetricSchema,
    aggregates: z
      .object({
        questionCount: z.number().int().positive(),
        positiveVotes: z.number().int().nonnegative(),
        negativeVotes: z.number().int().nonnegative(),
        netVotes: z.number().int(),
        totalVotes: z.number().int().nonnegative(),
        distinctParticipants: ModerationNonnegativeCountMetricSchema,
      })
      .strict()
      .superRefine((value, ctx) => {
        if (value.positiveVotes + value.negativeVotes !== value.totalVotes) {
          ctx.addIssue({
            code: 'custom',
            path: ['totalVotes'],
            message: 'totalVotes muss positiveVotes + negativeVotes entsprechen.',
          });
        }
        if (value.positiveVotes - value.negativeVotes !== value.netVotes) {
          ctx.addIssue({
            code: 'custom',
            path: ['netVotes'],
            message: 'netVotes muss positiveVotes - negativeVotes entsprechen.',
          });
        }
      }),
    scope: z
      .object({
        membership: z.literal('analyzed-corpus'),
        representedMembers: z.literal('context-represented-corpus'),
      })
      .strict(),
    memberQuestionSourceIds: z.array(z.string().trim().min(1).max(160)).min(2).max(200),
    representedQuestionSourceIds: z.array(z.string().trim().min(1).max(160)).min(1).max(200),
    representativeQuestionSourceId: z.string().trim().min(1).max(160),
  })
  .strict()
  .superRefine((value, ctx) => {
    const memberIds = new Set(value.memberQuestionSourceIds);
    const representedIds = new Set(value.representedQuestionSourceIds);
    if (memberIds.size !== value.memberQuestionSourceIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['memberQuestionSourceIds'],
        message: 'Themenmitglieder müssen eindeutig sein.',
      });
    }
    for (const [index, sourceId] of value.representedQuestionSourceIds.entries()) {
      if (!memberIds.has(sourceId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['representedQuestionSourceIds', index],
          message:
            'Dargestellte Themenmitglieder müssen Teil der vollständigen Mitgliedschaft sein.',
        });
      }
    }
    if (representedIds.size !== value.representedQuestionSourceIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['representedQuestionSourceIds'],
        message: 'Dargestellte Themenmitglieder müssen eindeutig sein.',
      });
    }
    if (!memberIds.has(value.representativeQuestionSourceId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['representativeQuestionSourceId'],
        message: 'Die Repräsentanz muss ein Themenmitglied sein.',
      });
    }
    if (!representedIds.has(value.representativeQuestionSourceId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['representativeQuestionSourceId'],
        message: 'Die Repräsentanz muss als dargestelltes Themenmitglied enthalten sein.',
      });
    }
    if (value.aggregates.questionCount !== value.memberQuestionSourceIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['aggregates', 'questionCount'],
        message: 'questionCount muss der vollständigen Themenmitgliedschaft entsprechen.',
      });
    }
    if (
      value.labelOrigin.kind === 'source-extractive' &&
      !memberIds.has(value.labelOrigin.sourceQuestionId)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['labelOrigin', 'sourceQuestionId'],
        message: 'Die extraktive Labelquelle muss ein Themenmitglied sein.',
      });
    }
    if (value.labelOrigin.kind === 'model-generated') {
      value.labelOrigin.derivedFromSourceIds.forEach((sourceId, index) => {
        if (!memberIds.has(sourceId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['labelOrigin', 'derivedFromSourceIds', index],
            message: 'Generative Labelquellen müssen Themenmitglieder sein.',
          });
        }
      });
    }
  });
export type ModerationSemanticTopic = z.infer<typeof ModerationSemanticTopicSchema>;

export const ModerationTopicsSectionSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      analysisVersion: z.string().trim().min(1).max(120),
      model: z
        .object({
          id: z.string().trim().min(1).max(120),
          version: z.string().trim().min(1).max(120),
        })
        .strict(),
      analyzedAt: z.string().datetime(),
      freshness: ModerationTopicFreshnessSchema,
      corpus: z
        .object({
          eligibleQuestions: z.number().int().nonnegative(),
          analyzedQuestions: z.number().int().nonnegative(),
          representedQuestions: z.number().int().nonnegative(),
        })
        .strict()
        .superRefine((value, ctx) => {
          if (
            value.analyzedQuestions > value.eligibleQuestions ||
            value.representedQuestions > value.analyzedQuestions
          ) {
            ctx.addIssue({
              code: 'custom',
              message:
                'Es muss representedQuestions ≤ analyzedQuestions ≤ eligibleQuestions gelten.',
            });
          }
        }),
      items: z.array(ModerationSemanticTopicSchema).max(30),
    })
    .strict(),
  ExplicitUnavailableStateSchema,
  ExplicitDisabledStateSchema,
  ExplicitPendingStateSchema,
  ExplicitFailedStateSchema,
  ExplicitNotApplicableStateSchema,
]);

export const ModerationCompassSignalSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(160),
    signal: z.enum([
      'high-best-score',
      'high-controversy',
      'high-frequency',
      'pinned-question',
      'pending-moderation',
      'unanswered',
      'topic-concentration',
      'learning-gap',
      'result-pattern',
      'feedback-pattern',
    ]),
    basis: z.enum([
      'best-score',
      'controversy-score',
      'question-frequency',
      'pinned-question-count',
      'pending-question-count',
      'unaddressed-question-count',
      'topic-question-share',
      'learning-gap-rule-score',
      'released-result-rule-score',
      'feedback-rule-score',
    ]),
    cardKind: z.enum(MODERATION_COMPASS_CARD_KINDS),
    questionSourceIds: z.array(z.string().trim().min(1).max(160)).max(40),
    value: z.number(),
    reason: z.string().trim().min(1).max(280),
    evidence: z
      .array(
        z
          .object({
            sourceId: z.string().trim().min(1).max(160),
            detail: z.string().trim().min(1).max(280),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    suggestedNextStep: z
      .object({
        action: z.enum([
          'address-question',
          'request-clarification',
          'review-moderation',
          'open-discussion',
          'connect-learning-objective',
          'monitor',
        ]),
        rationale: z.string().trim().min(1).max(280),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expectedBasis = {
      'high-best-score': 'best-score',
      'high-controversy': 'controversy-score',
      'high-frequency': 'question-frequency',
      'pinned-question': 'pinned-question-count',
      'pending-moderation': 'pending-question-count',
      unanswered: 'unaddressed-question-count',
      'topic-concentration': 'topic-question-share',
      'learning-gap': 'learning-gap-rule-score',
      'result-pattern': 'released-result-rule-score',
      'feedback-pattern': 'feedback-rule-score',
    } as const;
    if (value.basis !== expectedBasis[value.signal]) {
      ctx.addIssue({
        code: 'custom',
        path: ['basis'],
        message: `Signaltyp ${value.signal} benötigt die Messbasis ${expectedBasis[value.signal]}.`,
      });
    }
    const expectedCardKind = {
      'high-best-score': 'topics',
      'high-controversy': 'friction',
      'high-frequency': 'topics',
      'pinned-question': 'topics',
      'pending-moderation': 'clarification',
      unanswered: 'clarification',
      'topic-concentration': 'topics',
      'learning-gap': 'clarification',
      'result-pattern': 'clarification',
      'feedback-pattern': 'tempo',
    } as const;
    if (value.cardKind !== expectedCardKind[value.signal]) {
      ctx.addIssue({
        code: 'custom',
        path: ['cardKind'],
        message: `Signaltyp ${value.signal} gehört zur Kartenart ${expectedCardKind[value.signal]}.`,
      });
    }
    if (
      (value.signal === 'pending-moderation') !==
      (value.suggestedNextStep.action === 'review-moderation')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['suggestedNextStep', 'action'],
        message:
          'Nur ein ausstehendes Moderationssignal darf und muss die Aktion review-moderation verwenden.',
      });
    }
  });

export const ModerationCompassSectionSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      rulesVersion: z.literal(MODERATION_COMPASS_RULES_VERSION),
      signals: z.array(ModerationCompassSignalSchema).max(30),
      primarySignalSourceId: z.string().trim().min(1).max(160).nullable(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.signals.length > 0 && value.primarySignalSourceId === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['primarySignalSourceId'],
          message: 'Ein nicht leerer Kompassabschnitt benötigt ein primäres Signal.',
        });
      }
      if (
        value.primarySignalSourceId !== null &&
        !value.signals.some((signal) => signal.sourceId === value.primarySignalSourceId)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['primarySignalSourceId'],
          message: 'Das primäre Kompasssignal muss im selben Kompassabschnitt enthalten sein.',
        });
      }
    }),
  ExplicitUnavailableStateSchema,
  ExplicitDisabledStateSchema,
  ExplicitPendingStateSchema,
  ExplicitFailedStateSchema,
  ExplicitNotApplicableStateSchema,
]);

export const ModerationQuizScopeIdSchema = z
  .string()
  .regex(/^quiz-scope:[a-z0-9][a-z0-9._-]{0,107}$/i);
export type ModerationQuizScopeId = z.infer<typeof ModerationQuizScopeIdSchema>;
export const ModerationQuizSectionScopeIdSchema = z
  .string()
  .regex(/^quiz-section-scope:[a-z0-9][a-z0-9._-]{0,99}$/i);
export type ModerationQuizSectionScopeId = z.infer<typeof ModerationQuizSectionScopeIdSchema>;
export const ModerationAnswerOptionIdSchema = z
  .string()
  .regex(/^answer-option:[a-z0-9][a-z0-9._-]{0,103}$/i);
export type ModerationAnswerOptionId = z.infer<typeof ModerationAnswerOptionIdSchema>;

export const ModerationLearningObjectiveScopeSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('session') }).strict(),
    z
      .object({
        kind: z.literal('quiz'),
        quizScopeId: ModerationQuizScopeIdSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal('section'),
        quizScopeId: ModerationQuizScopeIdSchema,
        sectionScopeId: ModerationQuizSectionScopeIdSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal('tasks'),
        taskSourceIds: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (
      value.kind === 'tasks' &&
      new Set(value.taskSourceIds).size !== value.taskSourceIds.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['taskSourceIds'],
        message: 'Aufgabenreferenzen eines Lernziels müssen eindeutig sein.',
      });
    }
  });

export const ModerationLearningObjectiveOriginSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('manual') }).strict(),
    z
      .object({
        kind: z.literal('model-derived'),
        modelId: z.string().trim().min(1).max(120),
        modelVersion: z.string().trim().min(1).max(120),
        derivationVersion: z.string().trim().min(1).max(120),
        derivedFromSourceIds: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (
      value.kind === 'model-derived' &&
      new Set(value.derivedFromSourceIds).size !== value.derivedFromSourceIds.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['derivedFromSourceIds'],
        message: 'Herleitungsquellen eines Lernziels müssen eindeutig sein.',
      });
    }
  });

export const ModerationLearningObjectiveConfirmationSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('draft') }).strict(),
  z
    .object({
      state: z.literal('confirmed'),
      confirmedAt: z.string().datetime(),
      revision: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      state: z.literal('needs-review'),
      confirmedRevision: z.string().trim().min(1).max(120),
      currentRevision: z.string().trim().min(1).max(120),
      reason: z.string().trim().min(1).max(200),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.confirmedRevision === value.currentRevision) {
        ctx.addIssue({
          code: 'custom',
          path: ['currentRevision'],
          message: 'needs-review benötigt unterschiedliche Revisionen.',
        });
      }
    }),
]);

export const ModerationLearningObjectiveSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(160),
    scope: ModerationLearningObjectiveScopeSchema,
    origin: ModerationLearningObjectiveOriginSchema,
    confirmation: ModerationLearningObjectiveConfirmationSchema,
  })
  .strict();

export const ModerationLearningContextSectionSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      objectives: z.array(ModerationLearningObjectiveSchema).max(100),
    })
    .strict(),
  ExplicitUnavailableStateSchema,
  ExplicitDisabledStateSchema,
  ExplicitPendingStateSchema,
  ExplicitFailedStateSchema,
  ExplicitNotApplicableStateSchema,
]);

const ModerationAggregateReferenceSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(160),
  })
  .strict();

export const ModerationReleasedResultsSectionSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      aggregates: z.array(ModerationAggregateReferenceSchema).max(100),
    })
    .strict(),
  z
    .object({
      state: z.literal('not-released'),
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
  ExplicitUnavailableStateSchema,
  ExplicitPendingStateSchema,
  ExplicitFailedStateSchema,
  ExplicitNotApplicableStateSchema,
]);

export const ModerationFeedbackSectionSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      aggregates: z.array(ModerationAggregateReferenceSchema).max(100),
    })
    .strict(),
  ExplicitUnavailableStateSchema,
  ExplicitDisabledStateSchema,
  ExplicitPendingStateSchema,
  ExplicitFailedStateSchema,
  ExplicitNotApplicableStateSchema,
]);

const ModerationPromptTimeWindowSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('entire-session') }).strict(),
  z
    .object({
      kind: z.literal('interval'),
      from: z.string().datetime(),
      to: z.string().datetime(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (Date.parse(value.from) > Date.parse(value.to)) {
        ctx.addIssue({
          code: 'custom',
          path: ['to'],
          message: 'Das Ende des Zeitfensters darf nicht vor dem Anfang liegen.',
        });
      }
    }),
]);

export const ModerationQuizEffectiveVoteBasisSchema = z
  .object({
    kind: z.literal('effective-vote'),
    version: z.literal(MODERATION_QUIZ_EFFECTIVE_VOTE_BASIS_VERSION),
  })
  .strict();
export type ModerationQuizEffectiveVoteBasis = z.infer<
  typeof ModerationQuizEffectiveVoteBasisSchema
>;

export const ModerationQuizRoundComparisonBasisSchema = z
  .object({
    kind: z.literal('round-comparison'),
    version: z.literal(MODERATION_QUIZ_ROUND_COMPARISON_BASIS_VERSION),
  })
  .strict();
export type ModerationQuizRoundComparisonBasis = z.infer<
  typeof ModerationQuizRoundComparisonBasisSchema
>;

const CorrectnessRoundSnapshotSchema = z
  .object({
    responseCount: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    incorrect: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.correct + value.incorrect !== value.responseCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['responseCount'],
        message: 'Richtige und falsche Antworten müssen die Rundenpopulation abdecken.',
      });
    }
  });

const CorrectnessRoundComparisonSchema = z
  .object({
    basis: ModerationQuizRoundComparisonBasisSchema,
    round1: CorrectnessRoundSnapshotSchema,
    round2: CorrectnessRoundSnapshotSchema,
  })
  .strict();

const NumericRoundSnapshotSchema = z
  .object({
    responseCount: z.number().int().positive(),
    inBandCount: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.inBandCount > value.responseCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['inBandCount'],
        message: 'Treffer im erwarteten Bereich dürfen die Rundenpopulation nicht übersteigen.',
      });
    }
  });

const NumericPairedRoundComparisonSchema = z
  .object({
    pairedCount: z.number().int().positive(),
    closerCount: z.number().int().nonnegative(),
    fartherCount: z.number().int().nonnegative(),
    unchangedCount: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.closerCount + value.fartherCount + value.unchangedCount !== value.pairedCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['pairedCount'],
        message: 'Die paarweisen Vergleichsklassen müssen alle Vergleichspaare abdecken.',
      });
    }
  });

const NumericRoundComparisonSchema = z
  .object({
    basis: ModerationQuizRoundComparisonBasisSchema,
    round1: NumericRoundSnapshotSchema,
    round2: NumericRoundSnapshotSchema,
    inBandPercentDelta: z.number().min(-100).max(100),
    pairedAnalysis: NumericPairedRoundComparisonSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const round1Percent = (value.round1.inBandCount / value.round1.responseCount) * 100;
    const round2Percent = (value.round2.inBandCount / value.round2.responseCount) * 100;
    if (Math.abs(value.inBandPercentDelta - (round2Percent - round1Percent)) > 0.0002) {
      ctx.addIssue({
        code: 'custom',
        path: ['inBandPercentDelta'],
        message: 'Die Änderung des In-Band-Anteils muss zu beiden Runden passen.',
      });
    }
    if (
      value.pairedAnalysis &&
      value.pairedAnalysis.pairedCount >
        Math.min(value.round1.responseCount, value.round2.responseCount)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['pairedAnalysis', 'pairedCount'],
        message: 'Die Zahl der Vergleichspaare darf keine Rundenpopulation übersteigen.',
      });
    }
  });

const QuizAggregatePopulationSchema = z
  .object({
    kind: z.literal('eligible-submissions'),
    eligible: z.number().int().nonnegative(),
    included: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.included > value.eligible) {
      ctx.addIssue({
        code: 'custom',
        path: ['included'],
        message:
          'Die eingeschlossene Population darf die berechtigte Population nicht übersteigen.',
      });
    }
  });

const FeedbackAggregatePopulationSchema = z
  .object({
    kind: z.literal('eligible-feedback-responses'),
    eligible: z.number().int().nonnegative(),
    included: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.included > value.eligible) {
      ctx.addIssue({
        code: 'custom',
        path: ['included'],
        message:
          'Die eingeschlossene Population darf die berechtigte Population nicht übersteigen.',
      });
    }
  });

const QuizResultAggregationSchema = z.discriminatedUnion('rule', [
  z
    .object({
      rule: z.literal('answer-distribution'),
      unit: z.literal('selections'),
      optionSet: z.literal('all-answer-options'),
      responseCount: z.number().int().nonnegative(),
      selectionCount: z.number().int().nonnegative(),
      selectionCardinality: z
        .object({
          minimumPerResponse: z.number().int().positive(),
          maximumPerResponse: z.number().int().positive(),
        })
        .strict()
        .superRefine((value, ctx) => {
          if (value.minimumPerResponse > value.maximumPerResponse) {
            ctx.addIssue({
              code: 'custom',
              path: ['minimumPerResponse'],
              message: 'minimumPerResponse darf maximumPerResponse nicht übersteigen.',
            });
          }
        }),
      buckets: z
        .array(
          z
            .object({
              optionId: ModerationAnswerOptionIdSchema,
              label: z.string().trim().min(1).max(200),
              count: z.number().int().nonnegative(),
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict(),
  z
    .object({
      rule: z.literal('freetext-pattern-summary'),
      unit: z.literal('responses'),
      responseCount: z.number().int().nonnegative(),
      repeatedPatterns: z
        .array(
          z
            .object({
              count: z.number().int().min(2),
            })
            .strict(),
        )
        .max(20),
    })
    .strict()
    .superRefine((value, ctx) => {
      const repeatedResponseCount = value.repeatedPatterns.reduce(
        (sum, pattern) => sum + pattern.count,
        0,
      );
      if (repeatedResponseCount > value.responseCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['repeatedPatterns'],
          message:
            'Wiederholte Freitextmuster dürfen zusammen nicht mehr Antworten als die Population abdecken.',
        });
      }
      value.repeatedPatterns.forEach((pattern, index) => {
        if (pattern.count > value.responseCount) {
          ctx.addIssue({
            code: 'custom',
            path: ['repeatedPatterns', index, 'count'],
            message: 'Ein Freitextmuster darf die Antwortpopulation nicht übersteigen.',
          });
        }
        const nextPattern = value.repeatedPatterns[index + 1];
        if (nextPattern && pattern.count < nextPattern.count) {
          ctx.addIssue({
            code: 'custom',
            path: ['repeatedPatterns', index + 1, 'count'],
            message: 'Freitextmuster müssen absteigend nach Häufigkeit sortiert sein.',
          });
        }
      });
    }),
  z
    .object({
      rule: z.literal('correctness-summary'),
      unit: z.literal('responses'),
      correct: z.number().int().nonnegative(),
      incorrect: z.number().int().nonnegative(),
      unanswered: z.number().int().nonnegative(),
      roundComparison: CorrectnessRoundComparisonSchema.optional(),
    })
    .strict(),
  z
    .object({
      rule: z.literal('rating-summary'),
      unit: z.literal('ratings'),
      responseCount: z.number().int().nonnegative(),
      scale: z
        .object({
          minimum: z.number().int().min(0).max(10),
          maximum: z.number().int().min(1).max(10),
        })
        .strict(),
      mean: z.number().nullable(),
      buckets: z
        .array(
          z
            .object({
              value: z.number().int().min(0).max(10),
              count: z.number().int().nonnegative(),
            })
            .strict(),
        )
        .min(2)
        .max(11),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.scale.minimum >= value.scale.maximum) {
        ctx.addIssue({
          code: 'custom',
          path: ['scale', 'maximum'],
          message: 'Das Skalenmaximum muss größer als das Skalenminimum sein.',
        });
      }
      const expectedValues = Array.from(
        { length: Math.max(0, value.scale.maximum - value.scale.minimum + 1) },
        (_, index) => value.scale.minimum + index,
      );
      const actualValues = value.buckets.map((bucket) => bucket.value).sort((a, b) => a - b);
      if (
        actualValues.length !== expectedValues.length ||
        actualValues.some((bucketValue, index) => bucketValue !== expectedValues[index])
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['buckets'],
          message: 'Rating-Buckets müssen jeden Skalenwert genau einmal enthalten.',
        });
      }
      const bucketTotal = value.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
      if (bucketTotal !== value.responseCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['responseCount'],
          message: 'Die Ratingverteilung muss alle eingeschlossenen Antworten abdecken.',
        });
      }
      if (value.responseCount === 0) {
        if (value.mean !== null) {
          ctx.addIssue({
            code: 'custom',
            path: ['mean'],
            message: 'Ohne Ratingantworten muss der Mittelwert null sein.',
          });
        }
      } else if (value.mean === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['mean'],
          message: 'Mit Ratingantworten ist ein Mittelwert erforderlich.',
        });
      } else {
        const expectedMean =
          value.buckets.reduce((sum, bucket) => sum + bucket.value * bucket.count, 0) /
          value.responseCount;
        if (Math.abs(value.mean - expectedMean) > 1e-12) {
          ctx.addIssue({
            code: 'custom',
            path: ['mean'],
            message: 'Der Ratingmittelwert muss zur vollständigen Verteilung passen.',
          });
        }
      }
    }),
  z
    .object({
      rule: z.literal('numeric-summary'),
      unit: z.literal('numeric-responses'),
      responseCount: z.number().int().nonnegative(),
      median: z.number().nullable(),
      standardDeviation: z.number().nonnegative().nullable(),
      inBandCount: z.number().int().nonnegative(),
      inBandPercent: z.number().min(0).max(100).nullable(),
      histogram: z
        .array(
          z
            .object({
              from: z.number(),
              to: z.number(),
              count: z.number().int().nonnegative(),
              inBand: z.boolean(),
            })
            .strict()
            .superRefine((bucket, ctx) => {
              if (bucket.from >= bucket.to) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['to'],
                  message: 'Die obere Histogrammgrenze muss größer als die untere sein.',
                });
              }
            }),
        )
        .max(50)
        .optional(),
      roundComparison: NumericRoundComparisonSchema.optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.inBandCount > value.responseCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['inBandCount'],
          message: 'Treffer im erwarteten Bereich dürfen die Antwortzahl nicht übersteigen.',
        });
      }
      if (value.responseCount === 0) {
        if (
          value.median !== null ||
          value.standardDeviation !== null ||
          value.inBandCount !== 0 ||
          value.inBandPercent !== null ||
          (value.histogram?.length ?? 0) !== 0 ||
          value.roundComparison !== undefined
        ) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Ohne numerische Antworten müssen Kennzahlen, Histogramm und Rundenvergleich leer sein.',
          });
        }
      } else if (value.median === null || value.standardDeviation === null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Mit numerischen Antworten sind Median und Streuung erforderlich.',
        });
      } else if (value.inBandPercent !== null) {
        const expectedPercent = (value.inBandCount / value.responseCount) * 100;
        if (Math.abs(value.inBandPercent - expectedPercent) > 0.0001) {
          ctx.addIssue({
            code: 'custom',
            path: ['inBandPercent'],
            message: 'Der In-Band-Anteil muss zur Antwortzahl passen.',
          });
        }
      } else if (
        value.inBandCount !== 0 ||
        value.histogram?.some((bucket) => bucket.inBand) ||
        value.roundComparison !== undefined
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['inBandPercent'],
          message: 'Ohne erwarteten Bereich müssen In-Band-Zahl und Rundenvergleich leer bleiben.',
        });
      }
      if (
        value.responseCount > 0 &&
        value.histogram !== undefined &&
        value.histogram.reduce((sum, bucket) => sum + bucket.count, 0) !== value.responseCount
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['histogram'],
          message: 'Das numerische Histogramm muss alle eingeschlossenen Antworten abdecken.',
        });
      }
      const histogram = value.histogram;
      histogram?.forEach((bucket, bucketIndex) => {
        const next = histogram[bucketIndex + 1];
        if (next && bucket.to > next.from) {
          ctx.addIssue({
            code: 'custom',
            path: ['histogram', bucketIndex + 1, 'from'],
            message: 'Numerische Histogramm-Buckets dürfen sich nicht überlappen.',
          });
        }
      });
      if (
        value.roundComparison &&
        (value.roundComparison.round2.responseCount !== value.responseCount ||
          value.roundComparison.round2.inBandCount !== value.inBandCount)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['roundComparison', 'round2'],
          message:
            'Bei vorhandenem Rundenvergleich müssen Population und In-Band-Zahl der effektiven numerischen Übersicht Runde 2 entsprechen.',
        });
      }
    }),
  z
    .object({
      rule: z.literal('score-summary'),
      unit: z.literal('points'),
      responseCount: z.number().int().positive(),
      minimum: z.number(),
      maximum: z.number(),
      mean: z.number(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (
        value.minimum > value.maximum ||
        value.mean < value.minimum ||
        value.mean > value.maximum
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['mean'],
          message: 'minimum ≤ mean ≤ maximum muss gelten.',
        });
      }
    }),
  z
    .object({
      rule: z.literal('completion-summary'),
      unit: z.literal('responses'),
      completed: z.number().int().nonnegative(),
      incomplete: z.number().int().nonnegative(),
    })
    .strict(),
]);

function feedbackCountBucketSchema<T extends z.ZodType>(valueSchema: T) {
  return z
    .object({
      value: valueSchema,
      count: z.number().int().nonnegative(),
    })
    .strict();
}

const FeedbackAggregationSchema = z.discriminatedUnion('feedbackType', [
  z
    .object({
      feedbackType: z.literal('TEMPO'),
      rule: z.literal('tempo-distribution'),
      unit: z.literal('votes'),
      buckets: z.array(feedbackCountBucketSchema(TempoValueEnum)).min(1).max(4),
    })
    .strict(),
  z
    .object({
      feedbackType: z.literal('STARS'),
      rule: z.literal('rating-distribution'),
      unit: z.literal('votes'),
      buckets: z.array(feedbackCountBucketSchema(StarsValueEnum)).min(1).max(5),
    })
    .strict(),
  z
    .object({
      feedbackType: z.literal('MOOD'),
      rule: z.literal('flashlight-distribution'),
      unit: z.literal('votes'),
      buckets: z.array(feedbackCountBucketSchema(MoodValueEnum)).min(1).max(3),
    })
    .strict(),
  z
    .object({
      feedbackType: z.literal('YESNO'),
      rule: z.literal('flashlight-distribution'),
      unit: z.literal('votes'),
      buckets: z.array(feedbackCountBucketSchema(YesNoValueEnum)).min(1).max(3),
    })
    .strict(),
  z
    .object({
      feedbackType: z.literal('YESNO_BINARY'),
      rule: z.literal('flashlight-distribution'),
      unit: z.literal('votes'),
      buckets: z.array(feedbackCountBucketSchema(YesNoBinaryValueEnum)).min(1).max(2),
    })
    .strict(),
  z
    .object({
      feedbackType: z.literal('TRUEFALSE_UNKNOWN'),
      rule: z.literal('flashlight-distribution'),
      unit: z.literal('votes'),
      buckets: z.array(feedbackCountBucketSchema(TrueFalseUnknownValueEnum)).min(1).max(3),
    })
    .strict(),
  z
    .object({
      feedbackType: z.literal('ABCD'),
      rule: z.literal('flashlight-distribution'),
      unit: z.literal('votes'),
      buckets: z.array(feedbackCountBucketSchema(AbcdValueEnum)).min(1).max(4),
    })
    .strict(),
]);

const QaQuestionSourceSchema = z
  .object({
    id: z
      .string()
      .regex(
        /^qa-question:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    kind: z.literal('qa-question'),
    content: z.discriminatedUnion('state', [
      z
        .object({
          state: z.literal('included'),
          text: z.string().trim().min(1).max(500),
          truncated: z.boolean(),
        })
        .strict(),
      z
        .object({
          state: z.literal('reference-only'),
          reason: z.enum(['not-selected', 'budget-truncated', 'deduplicated']),
        })
        .strict(),
    ]),
  })
  .strict();

const SemanticTopicSourceSchema = z
  .object({
    id: z.string().regex(/^semantic-topic:[a-z0-9][a-z0-9._-]{0,139}$/i),
    kind: z.literal('semantic-topic'),
    label: z.string().trim().min(1).max(200),
  })
  .strict();

const QuizQuestionSourceSchema = z
  .object({
    id: z.string().regex(/^quiz-question:[a-z0-9][a-z0-9._-]{0,139}$/i),
    kind: z.literal('quiz-question'),
    quizScopeId: ModerationQuizScopeIdSchema,
    sectionScopeId: ModerationQuizSectionScopeIdSchema.optional(),
    text: z.string().trim().min(1).max(500),
    truncated: z.boolean(),
  })
  .strict();

const LearningObjectiveSourceSchema = z
  .object({
    id: z.string().regex(/^learning-objective:[a-z0-9][a-z0-9._-]{0,135}$/i),
    kind: z.literal('learning-objective'),
    text: z.string().trim().min(1).max(500),
  })
  .strict();

const QuizResultAggregateSourceSchema = z
  .object({
    id: z.string().regex(/^quiz-result-aggregate:[a-z0-9][a-z0-9._-]{0,130}$/i),
    kind: z.literal('quiz-result-aggregate'),
    label: z.string().trim().min(1).max(200),
    scope: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('quiz'),
          quizScopeId: ModerationQuizScopeIdSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal('question'),
          quizScopeId: ModerationQuizScopeIdSchema,
          questionSourceId: z.string().trim().min(1).max(160),
        })
        .strict(),
    ]),
    voteBasis: ModerationQuizEffectiveVoteBasisSchema,
    population: QuizAggregatePopulationSchema,
    aggregation: QuizResultAggregationSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const questionOnlyRule =
      value.aggregation.rule === 'answer-distribution' ||
      value.aggregation.rule === 'freetext-pattern-summary' ||
      value.aggregation.rule === 'correctness-summary' ||
      value.aggregation.rule === 'rating-summary' ||
      value.aggregation.rule === 'numeric-summary';
    const quizOnlyRule = value.aggregation.rule === 'score-summary';
    if (
      (questionOnlyRule && value.scope.kind !== 'question') ||
      (quizOnlyRule && value.scope.kind !== 'quiz')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['aggregation', 'rule'],
        message:
          'Antwort-, Freitextmuster-, Richtigkeits-, Rating- und numerische Aggregate benötigen Fragenscope; Score benötigt Quizscope; Completion erlaubt beide.',
      });
    }

    let includedByAggregation: number;
    switch (value.aggregation.rule) {
      case 'answer-distribution': {
        includedByAggregation = value.aggregation.responseCount;
        const responseCount = value.aggregation.responseCount;
        if (
          value.aggregation.selectionCardinality.maximumPerResponse >
          value.aggregation.buckets.length
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['aggregation', 'selectionCardinality', 'maximumPerResponse'],
            message:
              'maximumPerResponse darf die Zahl vollständig aufgeführter Antwortoptionen nicht übersteigen.',
          });
        }
        if (
          value.aggregation.selectionCount <
            value.aggregation.responseCount *
              value.aggregation.selectionCardinality.minimumPerResponse ||
          value.aggregation.selectionCount >
            value.aggregation.responseCount *
              value.aggregation.selectionCardinality.maximumPerResponse
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['aggregation', 'selectionCount'],
            message:
              'selectionCount muss innerhalb der ausdrücklich angegebenen Auswahlkardinalität liegen.',
          });
        }
        if (
          value.aggregation.buckets.reduce((sum, bucket) => sum + bucket.count, 0) !==
          value.aggregation.selectionCount
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['aggregation', 'selectionCount'],
            message: 'selectionCount muss der Summe aller Optionsauswahlen entsprechen.',
          });
        }
        if (
          new Set(value.aggregation.buckets.map((bucket) => bucket.optionId)).size !==
          value.aggregation.buckets.length
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['aggregation', 'buckets'],
            message: 'Antwortoptions-IDs müssen eindeutig sein.',
          });
        }
        if (
          new Set(value.aggregation.buckets.map((bucket) => bucket.label)).size !==
          value.aggregation.buckets.length
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['aggregation', 'buckets'],
            message: 'Antwortoptions-Labels müssen eindeutig sein.',
          });
        }
        value.aggregation.buckets.forEach((bucket, bucketIndex) => {
          if (bucket.count > responseCount) {
            ctx.addIssue({
              code: 'custom',
              path: ['aggregation', 'buckets', bucketIndex, 'count'],
              message: 'Eine Antwortoption darf höchstens einmal je Antwort gezählt werden.',
            });
          }
        });
        break;
      }
      case 'freetext-pattern-summary':
        includedByAggregation = value.aggregation.responseCount;
        break;
      case 'correctness-summary': {
        includedByAggregation =
          value.aggregation.correct + value.aggregation.incorrect + value.aggregation.unanswered;
        const roundComparison = value.aggregation.roundComparison;
        if (roundComparison) {
          const effectiveRound =
            roundComparison.round2.responseCount > 0
              ? roundComparison.round2
              : roundComparison.round1;
          if (
            value.aggregation.correct !== effectiveRound.correct ||
            value.aggregation.incorrect !== effectiveRound.incorrect
          ) {
            ctx.addIssue({
              code: 'custom',
              path: ['aggregation', 'roundComparison'],
              message:
                'Die Richtigkeitsübersicht muss der effektiven Runde entsprechen: Runde 2 bei vorhandenen Runde-2-Antworten, sonst Runde 1.',
            });
          }
          if (
            roundComparison.round1.responseCount > value.population.eligible ||
            roundComparison.round2.responseCount > value.population.eligible
          ) {
            ctx.addIssue({
              code: 'custom',
              path: ['aggregation', 'roundComparison'],
              message:
                'Keine Rundenpopulation darf die für diese Frage berechtigte Population übersteigen.',
            });
          }
        }
        break;
      }
      case 'rating-summary':
      case 'numeric-summary':
        includedByAggregation = value.aggregation.responseCount;
        if (
          value.aggregation.rule === 'numeric-summary' &&
          value.aggregation.roundComparison &&
          (value.aggregation.roundComparison.round1.responseCount > value.population.eligible ||
            value.aggregation.roundComparison.round2.responseCount > value.population.eligible)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['aggregation', 'roundComparison'],
            message:
              'Keine Rundenpopulation darf die für diese Frage berechtigte Population übersteigen.',
          });
        }
        break;
      case 'score-summary':
        includedByAggregation = value.aggregation.responseCount;
        break;
      case 'completion-summary':
        includedByAggregation = value.aggregation.completed + value.aggregation.incomplete;
        break;
    }
    if (includedByAggregation !== value.population.included) {
      ctx.addIssue({
        code: 'custom',
        path: ['population', 'included'],
        message: 'Die strukturierte Aggregation muss die eingeschlossene Population abdecken.',
      });
    }
  });

const FeedbackAggregateSourceSchema = z
  .object({
    id: z.string().regex(/^feedback-aggregate:[a-z0-9][a-z0-9._-]{0,135}$/i),
    kind: z.literal('feedback-aggregate'),
    label: z.string().trim().min(1).max(200),
    scope: z
      .object({
        channel: z.literal('quickFeedback'),
        timeWindow: ModerationPromptTimeWindowSchema,
      })
      .strict(),
    population: FeedbackAggregatePopulationSchema,
    aggregation: FeedbackAggregationSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const includedByAggregation = value.aggregation.buckets.reduce(
      (sum, bucket) => sum + bucket.count,
      0,
    );
    if (includedByAggregation !== value.population.included) {
      ctx.addIssue({
        code: 'custom',
        path: ['population', 'included'],
        message: 'Die Feedbackverteilung muss die eingeschlossene Population abdecken.',
      });
    }
    if (
      new Set(value.aggregation.buckets.map((bucket) => bucket.value)).size !==
      value.aggregation.buckets.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['aggregation', 'buckets'],
        message: 'Feedbackwerte müssen eindeutig sein.',
      });
    }
  });

const CompassSignalSourceSchema = z
  .object({
    id: z.string().regex(/^compass-signal:[a-z0-9][a-z0-9._-]{0,139}$/i),
    kind: z.literal('compass-signal'),
    label: z.string().trim().min(1).max(200),
  })
  .strict();

export const ModerationPromptSourceSchema = z.discriminatedUnion('kind', [
  QaQuestionSourceSchema,
  SemanticTopicSourceSchema,
  QuizQuestionSourceSchema,
  LearningObjectiveSourceSchema,
  QuizResultAggregateSourceSchema,
  FeedbackAggregateSourceSchema,
  CompassSignalSourceSchema,
]);
export type ModerationPromptSource = z.infer<typeof ModerationPromptSourceSchema>;

export const ModerationPromptLimitationSchema = z
  .object({
    code: z.enum([
      'module-unavailable',
      'module-disabled',
      'analysis-pending',
      'analysis-failed',
      'analysis-stale',
      'not-released',
      'budget-truncated',
      'source-redacted',
      'unsupported-locale',
    ]),
    section: ModerationPromptSectionSchema,
    detail: z.string().trim().min(1).max(280),
  })
  .strict();

const ModerationPromptQuestionFilterSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      statuses: z.array(ModerationPromptQuestionStatusSchema).min(1).max(3),
      timeWindow: ModerationPromptTimeWindowSchema,
    })
    .strict()
    .superRefine((value, ctx) => {
      if (new Set(value.statuses).size !== value.statuses.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['statuses'],
          message: 'Statusfilter müssen eindeutig sein.',
        });
      }
    }),
  ExplicitNotApplicableStateSchema,
]);

const ModerationPromptWeightingSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('qa-ranking'),
      version: z.literal('qa-ranking-v1'),
      sortMode: QaQuestionSortModeEnum,
    })
    .strict(),
  z
    .object({
      kind: z.literal('none'),
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
]);

export const ModerationPromptScopeSchema = z
  .object({
    channels: z.array(SessionLiveChannelSchema).min(1).max(3),
    sessionPhase: SessionStatusEnum,
    questionFilter: ModerationPromptQuestionFilterSchema,
    activeWeighting: ModerationPromptWeightingSchema,
    selectionLimits: z
      .object({
        questions: z.number().int().nonnegative().max(200),
        topics: z.number().int().nonnegative().max(30),
        compassSignals: z.number().int().nonnegative().max(30),
        learningObjectives: z.number().int().nonnegative().max(100),
        resultAggregates: z.number().int().nonnegative().max(100),
        feedbackAggregates: z.number().int().nonnegative().max(100),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.channels).size !== value.channels.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['channels'],
        message: 'Kanäle müssen eindeutig sein.',
      });
    }
  });

export const ModerationSourceRevisionSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('available'),
      value: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      state: z.literal('unavailable'),
      reason: ExplicitUnavailableReasonSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('not-applicable'),
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
]);

export const ModerationDomainMetaV1Schema = z
  .object({
    sourceRevision: z.string().trim().min(1).max(120),
    analysisVersion: z.string().trim().min(1).max(120),
    selectionVersion: z.string().trim().min(1).max(120),
    revisions: z
      .object({
        questionText: ModerationSourceRevisionSchema,
        questionVotes: ModerationSourceRevisionSchema,
        questionStatus: ModerationSourceRevisionSchema,
        questionAnswerState: ModerationSourceRevisionSchema,
        questionNlp: ModerationSourceRevisionSchema,
        topics: ModerationSourceRevisionSchema,
        learningObjectives: ModerationSourceRevisionSchema,
        releasedResults: ModerationSourceRevisionSchema,
        feedback: ModerationSourceRevisionSchema,
      })
      .strict(),
  })
  .strict();

const ModerationDomainContextV1BaseSchema = z
  .object({
    contractVersion: z.literal(MODERATION_DOMAIN_CONTEXT_CONTRACT_VERSION),
    representation: z.enum(['analysis-candidates', 'prompt-selection']),
    definitionsVersion: z.literal(MODERATION_PROMPT_DEFINITION_SET_VERSION),
    locale: AppLocaleEnum,
    meta: ModerationDomainMetaV1Schema,
    scope: ModerationPromptScopeSchema,
    questions: ModerationQuestionsSectionSchema,
    topics: ModerationTopicsSectionSchema,
    compass: ModerationCompassSectionSchema,
    learningContext: ModerationLearningContextSectionSchema,
    releasedResults: ModerationReleasedResultsSectionSchema,
    feedback: ModerationFeedbackSectionSchema,
    sources: z.array(ModerationPromptSourceSchema).max(500),
    limitations: z.array(ModerationPromptLimitationSchema).max(100),
  })
  .strict();
export type ModerationDomainContextV1 = z.infer<typeof ModerationDomainContextV1BaseSchema>;

function addReferenceIssue(
  ctx: z.RefinementCtx,
  sourceKinds: Map<string, ModerationPromptSource['kind']>,
  sourceId: string,
  expectedKinds: readonly ModerationPromptSource['kind'][],
  path: PropertyKey[],
): void {
  const actualKind = sourceKinds.get(sourceId);
  if (!actualKind) {
    ctx.addIssue({ code: 'custom', path, message: `Unbekannte Quellenreferenz: ${sourceId}` });
    return;
  }
  if (!expectedKinds.includes(actualKind)) {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `Quellenart ${actualKind} ist an dieser Stelle unzulässig.`,
    });
  }
}

function observedQuizResponseCount(
  source: Extract<ModerationPromptSource, { kind: 'quiz-result-aggregate' }>,
): number {
  switch (source.aggregation.rule) {
    case 'answer-distribution':
    case 'freetext-pattern-summary':
    case 'rating-summary':
    case 'numeric-summary':
    case 'score-summary':
      return source.aggregation.responseCount;
    case 'correctness-summary':
      return source.aggregation.correct + source.aggregation.incorrect;
    case 'completion-summary':
      return source.aggregation.completed;
  }
}

function validateCommonDomainContext(value: ModerationDomainContextV1, ctx: z.RefinementCtx): void {
  const sourceKinds = new Map<string, ModerationPromptSource['kind']>();
  const sourcesById = new Map<string, ModerationPromptSource>();
  value.sources.forEach((source, index) => {
    if (sourceKinds.has(source.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources', index, 'id'],
        message: 'Quellen-IDs müssen eindeutig sein.',
      });
    }
    sourceKinds.set(source.id, source.kind);
    sourcesById.set(source.id, source);
  });
  value.sources.forEach((source, sourceIndex) => {
    if (source.kind === 'quiz-result-aggregate' && source.scope.kind === 'question') {
      addReferenceIssue(
        ctx,
        sourceKinds,
        source.scope.questionSourceId,
        ['quiz-question'],
        ['sources', sourceIndex, 'scope', 'questionSourceId'],
      );
      const questionSource = sourcesById.get(source.scope.questionSourceId);
      if (
        questionSource?.kind === 'quiz-question' &&
        questionSource.quizScopeId !== source.scope.quizScopeId
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['sources', sourceIndex, 'scope', 'questionSourceId'],
          message: 'Die Quizfrage muss zum Quiz-Scope des Ergebnisaggregats gehören.',
        });
      }
    }
  });

  const availableTopicIds =
    value.topics.state === 'available'
      ? new Set(value.topics.items.map((topic) => topic.sourceId))
      : new Set<string>();
  const availableQuestionsById =
    value.questions.state === 'available'
      ? new Map(value.questions.items.map((question) => [question.sourceId, question] as const))
      : new Map<string, ModerationPromptQuestion>();
  const availableQuestionIds = new Set(availableQuestionsById.keys());
  const availableLearningObjectivesById =
    value.learningContext.state === 'available'
      ? new Map(
          value.learningContext.objectives.map(
            (objective) => [objective.sourceId, objective] as const,
          ),
        )
      : new Map<string, z.infer<typeof ModerationLearningObjectiveSchema>>();
  const availableLearningObjectiveIds = new Set(availableLearningObjectivesById.keys());
  const availableResultAggregateIds =
    value.releasedResults.state === 'available'
      ? new Set(value.releasedResults.aggregates.map((aggregate) => aggregate.sourceId))
      : new Set<string>();
  const availableFeedbackAggregateIds =
    value.feedback.state === 'available'
      ? new Set(value.feedback.aggregates.map((aggregate) => aggregate.sourceId))
      : new Set<string>();
  const availableCompassSignalIds =
    value.compass.state === 'available'
      ? new Set(value.compass.signals.map((signal) => signal.sourceId))
      : new Set<string>();
  if (
    value.learningContext.state === 'available' &&
    availableLearningObjectiveIds.size !== value.learningContext.objectives.length
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['learningContext', 'objectives'],
      message: 'Lernzielquellen müssen innerhalb des Bereichs eindeutig sein.',
    });
  }
  if (
    value.releasedResults.state === 'available' &&
    availableResultAggregateIds.size !== value.releasedResults.aggregates.length
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['releasedResults', 'aggregates'],
      message: 'Ergebnisaggregate müssen innerhalb des Bereichs eindeutig sein.',
    });
  }
  if (
    value.feedback.state === 'available' &&
    availableFeedbackAggregateIds.size !== value.feedback.aggregates.length
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['feedback', 'aggregates'],
      message: 'Feedbackaggregate müssen innerhalb des Bereichs eindeutig sein.',
    });
  }
  if (
    value.compass.state === 'available' &&
    availableCompassSignalIds.size !== value.compass.signals.length
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['compass', 'signals'],
      message: 'Kompasssignalquellen müssen innerhalb des Bereichs eindeutig sein.',
    });
  }
  if (value.topics.state === 'available' && availableTopicIds.size !== value.topics.items.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['topics', 'items'],
      message: 'Themenquellen müssen innerhalb des Bereichs eindeutig sein.',
    });
  }

  if (value.questions.state === 'available') {
    value.questions.items.forEach((question, questionIndex) => {
      addReferenceIssue(
        ctx,
        sourceKinds,
        question.sourceId,
        ['qa-question'],
        ['questions', 'items', questionIndex, 'sourceId'],
      );
      const questionSource = sourcesById.get(question.sourceId);
      if (questionSource?.kind === 'qa-question' && questionSource.content.state !== 'included') {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', 'items', questionIndex, 'sourceId'],
          message: 'Eine im Kontext dargestellte Frage benötigt enthaltenen Quelltext.',
        });
      }
      question.topicSourceIds.forEach((sourceId, topicIndex) => {
        const path = ['questions', 'items', questionIndex, 'topicSourceIds', topicIndex];
        addReferenceIssue(ctx, sourceKinds, sourceId, ['semantic-topic'], path);
        if (!availableTopicIds.has(sourceId)) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: 'Die Themenreferenz muss im verfügbaren Themenabschnitt enthalten sein.',
          });
        }
      });
    });
  }

  if (value.topics.state === 'available') {
    value.topics.items.forEach((topic, topicIndex) => {
      addReferenceIssue(
        ctx,
        sourceKinds,
        topic.sourceId,
        ['semantic-topic'],
        ['topics', 'items', topicIndex, 'sourceId'],
      );
      topic.memberQuestionSourceIds.forEach((sourceId, memberIndex) =>
        addReferenceIssue(
          ctx,
          sourceKinds,
          sourceId,
          ['qa-question'],
          ['topics', 'items', topicIndex, 'memberQuestionSourceIds', memberIndex],
        ),
      );
      topic.representedQuestionSourceIds.forEach((sourceId, memberIndex) => {
        addReferenceIssue(
          ctx,
          sourceKinds,
          sourceId,
          ['qa-question'],
          ['topics', 'items', topicIndex, 'representedQuestionSourceIds', memberIndex],
        );
        const includedSource = sourcesById.get(sourceId);
        if (includedSource?.kind === 'qa-question' && includedSource.content.state !== 'included') {
          ctx.addIssue({
            code: 'custom',
            path: ['topics', 'items', topicIndex, 'representedQuestionSourceIds', memberIndex],
            message: 'Ein dargestelltes Themenmitglied benötigt enthaltenen Quelltext.',
          });
        }
      });
      addReferenceIssue(
        ctx,
        sourceKinds,
        topic.representativeQuestionSourceId,
        ['qa-question'],
        ['topics', 'items', topicIndex, 'representativeQuestionSourceId'],
      );
      const representativeSource = sourcesById.get(topic.representativeQuestionSourceId);
      if (
        representativeSource?.kind === 'qa-question' &&
        representativeSource.content.state !== 'included'
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['topics', 'items', topicIndex, 'representativeQuestionSourceId'],
          message: 'Die Repräsentanz benötigt enthaltenen Quelltext.',
        });
      }
      if (topic.labelOrigin.kind === 'source-extractive') {
        addReferenceIssue(
          ctx,
          sourceKinds,
          topic.labelOrigin.sourceQuestionId,
          ['qa-question'],
          ['topics', 'items', topicIndex, 'labelOrigin', 'sourceQuestionId'],
        );
        const labelSource = sourcesById.get(topic.labelOrigin.sourceQuestionId);
        if (labelSource?.kind === 'qa-question' && labelSource.content.state !== 'included') {
          ctx.addIssue({
            code: 'custom',
            path: ['topics', 'items', topicIndex, 'labelOrigin', 'sourceQuestionId'],
            message: 'Die extraktive Labelquelle benötigt enthaltenen Quelltext.',
          });
        }
      }
      if (topic.labelOrigin.kind === 'model-generated') {
        topic.labelOrigin.derivedFromSourceIds.forEach((sourceId, sourceIndex) =>
          addReferenceIssue(
            ctx,
            sourceKinds,
            sourceId,
            ['qa-question'],
            ['topics', 'items', topicIndex, 'labelOrigin', 'derivedFromSourceIds', sourceIndex],
          ),
        );
      }
    });
  }

  if (value.questions.state === 'available') {
    const seenQuestionSourceIds = new Set<string>();
    value.questions.items.forEach((question, questionIndex) => {
      if (seenQuestionSourceIds.has(question.sourceId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', 'items', questionIndex, 'sourceId'],
          message: 'Fragenquellen müssen innerhalb des Bereichs eindeutig sein.',
        });
      }
      seenQuestionSourceIds.add(question.sourceId);
      if (new Set(question.topicSourceIds).size !== question.topicSourceIds.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', 'items', questionIndex, 'topicSourceIds'],
          message: 'Themenreferenzen einer Frage müssen eindeutig sein.',
        });
      }
    });
  }

  if (value.questions.state === 'available' && value.topics.state === 'available') {
    const questionsBySourceId = new Map(
      value.questions.items.map((question) => [question.sourceId, question] as const),
    );
    const topicsBySourceId = new Map(
      value.topics.items.map((topic) => [topic.sourceId, topic] as const),
    );
    value.questions.items.forEach((question, questionIndex) => {
      question.topicSourceIds.forEach((topicSourceId, topicIndex) => {
        const topic = topicsBySourceId.get(topicSourceId);
        if (topic && !topic.memberQuestionSourceIds.includes(question.sourceId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['questions', 'items', questionIndex, 'topicSourceIds', topicIndex],
            message: 'Die Frage verweist auf ein Thema, das sie nicht als Mitglied führt.',
          });
        }
      });
    });
    value.topics.items.forEach((topic, topicIndex) => {
      topic.memberQuestionSourceIds.forEach((questionSourceId, memberIndex) => {
        const question = questionsBySourceId.get(questionSourceId);
        if (question && !question.topicSourceIds.includes(topic.sourceId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['topics', 'items', topicIndex, 'memberQuestionSourceIds', memberIndex],
            message: 'Das Themenmitglied führt die Gegenreferenz zum Thema nicht.',
          });
        }
      });
    });
  }

  if (value.compass.state === 'available') {
    value.compass.signals.forEach((signal, signalIndex) => {
      addReferenceIssue(
        ctx,
        sourceKinds,
        signal.sourceId,
        ['compass-signal'],
        ['compass', 'signals', signalIndex, 'sourceId'],
      );
      if (new Set(signal.questionSourceIds).size !== signal.questionSourceIds.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['compass', 'signals', signalIndex, 'questionSourceIds'],
          message: 'Fragenreferenzen eines Kompasssignals müssen eindeutig sein.',
        });
      }
      signal.questionSourceIds.forEach((sourceId, questionIndex) => {
        const path = ['compass', 'signals', signalIndex, 'questionSourceIds', questionIndex];
        addReferenceIssue(ctx, sourceKinds, sourceId, ['qa-question'], path);
        if (!availableQuestionIds.has(sourceId)) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: 'Eine Kompass-Fragenreferenz benötigt eine verfügbare Frage.',
          });
        }
      });
      signal.evidence.forEach((evidence, evidenceIndex) => {
        addReferenceIssue(
          ctx,
          sourceKinds,
          evidence.sourceId,
          [
            'qa-question',
            'semantic-topic',
            'quiz-question',
            'learning-objective',
            'quiz-result-aggregate',
            'feedback-aggregate',
          ],
          ['compass', 'signals', signalIndex, 'evidence', evidenceIndex, 'sourceId'],
        );
        const evidenceKind = sourceKinds.get(evidence.sourceId);
        const path = ['compass', 'signals', signalIndex, 'evidence', evidenceIndex, 'sourceId'];
        if (evidenceKind === 'qa-question' && !availableQuestionIds.has(evidence.sourceId)) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: 'Frageevidenz benötigt eine verfügbare, referenzierte Frage.',
          });
        }
        if (evidenceKind === 'semantic-topic' && !availableTopicIds.has(evidence.sourceId)) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: 'Themenevidenz benötigt ein verfügbares, referenziertes Thema.',
          });
        }
        if (
          evidenceKind === 'learning-objective' &&
          !availableLearningObjectiveIds.has(evidence.sourceId)
        ) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: 'Lernzielevidenz benötigt ein verfügbares, referenziertes Lernziel.',
          });
        }
        if (
          evidenceKind === 'quiz-result-aggregate' &&
          !availableResultAggregateIds.has(evidence.sourceId)
        ) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: 'Ergebnisevidenz benötigt ein freigegebenes, referenziertes Aggregat.',
          });
        }
        if (
          evidenceKind === 'feedback-aggregate' &&
          !availableFeedbackAggregateIds.has(evidence.sourceId)
        ) {
          ctx.addIssue({
            code: 'custom',
            path,
            message: 'Feedbackevidenz benötigt ein verfügbares, referenziertes Aggregat.',
          });
        }
      });
      const evidenceKinds = signal.evidence.map((evidence) => sourceKinds.get(evidence.sourceId));
      const hasObservedResultEvidence = signal.evidence.some((evidence) => {
        const source = sourcesById.get(evidence.sourceId);
        return (
          source?.kind === 'quiz-result-aggregate' &&
          availableResultAggregateIds.has(source.id) &&
          observedQuizResponseCount(source) > 0
        );
      });
      const hasObservedFeedbackEvidence = signal.evidence.some((evidence) => {
        const source = sourcesById.get(evidence.sourceId);
        return (
          source?.kind === 'feedback-aggregate' &&
          availableFeedbackAggregateIds.has(source.id) &&
          source.population.included > 0
        );
      });
      const observedResultSources = signal.evidence.flatMap((evidence) => {
        const source = sourcesById.get(evidence.sourceId);
        return source?.kind === 'quiz-result-aggregate' &&
          availableResultAggregateIds.has(source.id) &&
          observedQuizResponseCount(source) > 0
          ? [source]
          : [];
      });
      const evidencedLearningObjectives = signal.evidence.flatMap((evidence) => {
        const objective = availableLearningObjectivesById.get(evidence.sourceId);
        return objective ? [objective] : [];
      });
      const hasMatchingLearningResultScope = evidencedLearningObjectives.some((objective) =>
        observedResultSources.some((result) => {
          if (objective.scope.kind === 'quiz') {
            return objective.scope.quizScopeId === result.scope.quizScopeId;
          }
          if (objective.scope.kind === 'section') {
            if (result.scope.kind !== 'question') return false;
            const resultQuestion = sourcesById.get(result.scope.questionSourceId);
            return (
              resultQuestion?.kind === 'quiz-question' &&
              resultQuestion.quizScopeId === objective.scope.quizScopeId &&
              resultQuestion.sectionScopeId === objective.scope.sectionScopeId
            );
          }
          if (objective.scope.kind === 'tasks') {
            return (
              result.scope.kind === 'question' &&
              objective.scope.taskSourceIds.includes(result.scope.questionSourceId)
            );
          }
          return false;
        }),
      );
      const evidenceQaQuestionIds = new Set(
        signal.evidence
          .filter((evidence) => sourceKinds.get(evidence.sourceId) === 'qa-question')
          .map((evidence) => evidence.sourceId),
      );
      const questionSourceIds = new Set(signal.questionSourceIds);
      signal.questionSourceIds.forEach((sourceId, questionIndex) => {
        if (!evidenceQaQuestionIds.has(sourceId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'questionSourceIds', questionIndex],
            message: 'Jede Kompass-Fragenreferenz benötigt denselben Q&A-Beleg in evidence.',
          });
        }
      });
      signal.evidence.forEach((evidence, evidenceIndex) => {
        if (
          sourceKinds.get(evidence.sourceId) === 'qa-question' &&
          !questionSourceIds.has(evidence.sourceId)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'evidence', evidenceIndex, 'sourceId'],
            message: 'Q&A-Evidenz muss auch in questionSourceIds ausgewiesen sein.',
          });
        }
      });

      const qaSignal =
        signal.signal === 'high-best-score' ||
        signal.signal === 'high-controversy' ||
        signal.signal === 'high-frequency' ||
        signal.signal === 'pinned-question' ||
        signal.signal === 'pending-moderation' ||
        signal.signal === 'unanswered';
      if (qaSignal && signal.questionSourceIds.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['compass', 'signals', signalIndex, 'questionSourceIds'],
          message: `Ein ${signal.signal}-Signal benötigt mindestens eine verfügbare Q&A-Frage.`,
        });
      }
      if (qaSignal && !evidenceKinds.includes('qa-question')) {
        ctx.addIssue({
          code: 'custom',
          path: ['compass', 'signals', signalIndex, 'evidence'],
          message: `Ein ${signal.signal}-Signal benötigt Q&A-Fragenevidenz.`,
        });
      }
      const referencedQuestions = signal.questionSourceIds.flatMap((sourceId) => {
        const question = availableQuestionsById.get(sourceId);
        return question ? [question] : [];
      });
      if (signal.signal === 'high-best-score') {
        const hasMatchingBestScore = referencedQuestions.some(
          (question) =>
            question.votes.state === 'available' &&
            question.votes.bestScore.state === 'available' &&
            question.votes.bestScore.value === signal.value,
        );
        if (!hasMatchingBestScore) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'value'],
            message:
              'Der Wert eines high-best-score-Signals muss einem verfügbaren Best-Score seiner Fragen entsprechen.',
          });
        }
      }
      if (signal.signal === 'high-controversy') {
        const hasMatchingControversy = referencedQuestions.some(
          (question) =>
            question.votes.state === 'available' &&
            question.votes.controversyScore.state === 'available' &&
            question.votes.controversyScore.value === signal.value,
        );
        if (!hasMatchingControversy) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'value'],
            message:
              'Der Wert eines high-controversy-Signals muss einer verfügbaren Kontroversität seiner Fragen entsprechen.',
          });
        }
      }
      if (signal.signal === 'high-frequency') {
        if (!Number.isInteger(signal.value) || signal.value !== signal.questionSourceIds.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'value'],
            message:
              'Der Wert eines high-frequency-Signals muss der Zahl belegter Q&A-Fragen entsprechen.',
          });
        }
      }
      if (signal.signal === 'pinned-question') {
        if (
          !Number.isInteger(signal.value) ||
          signal.value !== signal.questionSourceIds.length ||
          referencedQuestions.some((question) => question.status !== 'PINNED')
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'value'],
            message:
              'Ein pinned-question-Signal zählt genau seine ausdrücklich als PINNED ausgewiesenen Q&A-Fragen.',
          });
        }
      }
      if (signal.signal === 'pending-moderation') {
        if (
          !Number.isInteger(signal.value) ||
          signal.value !== signal.questionSourceIds.length ||
          referencedQuestions.some((question) => question.status !== 'PENDING')
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'value'],
            message:
              'Ein pending-moderation-Signal zählt genau seine ausdrücklich als PENDING ausgewiesenen Q&A-Fragen.',
          });
        }
      }
      if (signal.signal === 'unanswered') {
        if (
          !Number.isInteger(signal.value) ||
          signal.value !== signal.questionSourceIds.length ||
          referencedQuestions.some((question) => question.answerState.state !== 'unaddressed')
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'value'],
            message:
              'Ein unanswered-Signal zählt genau seine ausdrücklich als unaddressed ausgewiesenen Q&A-Fragen.',
          });
        }
      }
      if (signal.signal === 'topic-concentration') {
        if (!evidenceKinds.includes('semantic-topic')) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'evidence'],
            message: 'Ein topic-concentration-Signal benötigt verfügbare Themenevidenz.',
          });
        }
        if (signal.value < 0 || signal.value > 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'value'],
            message: 'Die topic-question-share muss im Intervall von 0 bis 1 liegen.',
          });
        }
      }
      if (signal.signal === 'learning-gap') {
        if (!evidenceKinds.includes('learning-objective')) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'evidence'],
            message: 'Ein learning-gap-Signal benötigt verfügbare Lernzielevidenz.',
          });
        }
        if (!evidenceKinds.includes('quiz-result-aggregate')) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'evidence'],
            message:
              'Ein learning-gap-Signal benötigt zusätzlich beobachtete Evidenz aus einem freigegebenen Quizergebnisaggregat.',
          });
        }
        if (!hasObservedResultEvidence) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'evidence'],
            message:
              'Ein learning-gap-Signal benötigt mindestens eine tatsächlich beobachtete Quizantwort.',
          });
        }
        if (!hasMatchingLearningResultScope) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'evidence'],
            message:
              'Lernziel und beobachtetes Ergebnis eines learning-gap-Signals müssen denselben Quiz-/Section-/Aufgaben-Scope belegen.',
          });
        }
        if (value.releasedResults.state !== 'available') {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'signal'],
            message: 'Ein learning-gap-Signal benötigt verfügbare freigegebene Ergebnisse.',
          });
        }
        if (!value.scope.channels.includes('quiz')) {
          ctx.addIssue({
            code: 'custom',
            path: ['scope', 'channels'],
            message: 'Ein learning-gap-Signal benötigt den Quizkanal.',
          });
        }
        if (signal.value < 0 || signal.value > 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'value'],
            message: 'Der learning-gap-rule-score muss im Intervall von 0 bis 1 liegen.',
          });
        }
      }
      if (signal.signal === 'result-pattern') {
        if (!evidenceKinds.includes('quiz-result-aggregate')) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'evidence'],
            message:
              'Ein result-pattern-Signal benötigt Evidenz aus einem freigegebenen Quizergebnisaggregat.',
          });
        }
        if (!hasObservedResultEvidence) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'evidence'],
            message:
              'Ein result-pattern-Signal benötigt ein Ergebnisaggregat mit mindestens einer beobachteten Quizantwort.',
          });
        }
        if (value.releasedResults.state !== 'available') {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'signal'],
            message: 'Ein result-pattern-Signal benötigt verfügbare freigegebene Ergebnisse.',
          });
        }
        if (!value.scope.channels.includes('quiz')) {
          ctx.addIssue({
            code: 'custom',
            path: ['scope', 'channels'],
            message: 'Ein result-pattern-Signal benötigt den Quizkanal.',
          });
        }
        if (signal.value < 0 || signal.value > 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'value'],
            message: 'Der released-result-rule-score muss im Intervall von 0 bis 1 liegen.',
          });
        }
      }
      if (signal.signal === 'feedback-pattern') {
        if (!evidenceKinds.includes('feedback-aggregate')) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'evidence'],
            message:
              'Ein feedback-pattern-Signal benötigt Evidenz aus einem verfügbaren Feedbackaggregat.',
          });
        }
        if (!hasObservedFeedbackEvidence) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'evidence'],
            message:
              'Ein feedback-pattern-Signal benötigt ein Feedbackaggregat mit mindestens einer beobachteten Rückmeldung.',
          });
        }
        if (value.feedback.state !== 'available') {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'signal'],
            message: 'Ein feedback-pattern-Signal benötigt verfügbares Feedback.',
          });
        }
        if (!value.scope.channels.includes('quickFeedback')) {
          ctx.addIssue({
            code: 'custom',
            path: ['scope', 'channels'],
            message: 'Ein feedback-pattern-Signal benötigt den Quick-Feedback-Kanal.',
          });
        }
        if (signal.value < 0 || signal.value > 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['compass', 'signals', signalIndex, 'value'],
            message: 'Der feedback-rule-score muss im Intervall von 0 bis 1 liegen.',
          });
        }
      }
    });
  }

  if (value.learningContext.state === 'available') {
    value.learningContext.objectives.forEach((objective, objectiveIndex) => {
      addReferenceIssue(
        ctx,
        sourceKinds,
        objective.sourceId,
        ['learning-objective'],
        ['learningContext', 'objectives', objectiveIndex, 'sourceId'],
      );
      if (objective.scope.kind === 'tasks') {
        objective.scope.taskSourceIds.forEach((sourceId, taskIndex) =>
          addReferenceIssue(
            ctx,
            sourceKinds,
            sourceId,
            ['qa-question', 'quiz-question'],
            ['learningContext', 'objectives', objectiveIndex, 'scope', 'taskSourceIds', taskIndex],
          ),
        );
        const taskQuizScopeIds = new Set(
          objective.scope.taskSourceIds.flatMap((sourceId) => {
            const source = sourcesById.get(sourceId);
            return source?.kind === 'quiz-question' ? [source.quizScopeId] : [];
          }),
        );
        if (taskQuizScopeIds.size > 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['learningContext', 'objectives', objectiveIndex, 'scope', 'taskSourceIds'],
            message: 'Quizaufgaben eines Lernziels müssen demselben Quiz-Scope angehören.',
          });
        }
      }
      if (objective.origin.kind === 'model-derived') {
        if (objective.scope.kind === 'session') {
          ctx.addIssue({
            code: 'custom',
            path: ['learningContext', 'objectives', objectiveIndex, 'scope', 'kind'],
            message:
              'Modellabgeleitete Lernziele benötigen einen Quiz-, Abschnitts- oder Aufgaben-Scope.',
          });
        }
        objective.origin.derivedFromSourceIds.forEach((sourceId, sourceIndex) =>
          addReferenceIssue(
            ctx,
            sourceKinds,
            sourceId,
            ['quiz-question'],
            [
              'learningContext',
              'objectives',
              objectiveIndex,
              'origin',
              'derivedFromSourceIds',
              sourceIndex,
            ],
          ),
        );
        const derivedQuizSources = objective.origin.derivedFromSourceIds.flatMap(
          (sourceId, sourceIndex) => {
            const source = sourcesById.get(sourceId);
            return source?.kind === 'quiz-question' ? [{ source, sourceIndex }] : [];
          },
        );
        if (new Set(derivedQuizSources.map(({ source }) => source.quizScopeId)).size > 1) {
          ctx.addIssue({
            code: 'custom',
            path: [
              'learningContext',
              'objectives',
              objectiveIndex,
              'origin',
              'derivedFromSourceIds',
            ],
            message: 'Herleitungsfragen eines Lernziels müssen demselben Quiz-Scope angehören.',
          });
        }
        const scopedObjective = objective.scope;
        if (scopedObjective.kind === 'quiz' || scopedObjective.kind === 'section') {
          derivedQuizSources.forEach(({ source, sourceIndex }) => {
            if (source.quizScopeId !== scopedObjective.quizScopeId) {
              ctx.addIssue({
                code: 'custom',
                path: [
                  'learningContext',
                  'objectives',
                  objectiveIndex,
                  'origin',
                  'derivedFromSourceIds',
                  sourceIndex,
                ],
                message: 'Herleitungsfrage und Lernziel müssen demselben Quiz-Scope angehören.',
              });
            }
            if (
              scopedObjective.kind === 'section' &&
              source.sectionScopeId !== scopedObjective.sectionScopeId
            ) {
              ctx.addIssue({
                code: 'custom',
                path: [
                  'learningContext',
                  'objectives',
                  objectiveIndex,
                  'origin',
                  'derivedFromSourceIds',
                  sourceIndex,
                ],
                message:
                  'Herleitungsfrage und Abschnittslernziel müssen demselben Section-Scope angehören.',
              });
            }
          });
        }
        if (objective.scope.kind === 'tasks') {
          const taskSourceIds = new Set(objective.scope.taskSourceIds);
          objective.scope.taskSourceIds.forEach((sourceId, taskIndex) => {
            if (sourceKinds.get(sourceId) !== 'quiz-question') {
              ctx.addIssue({
                code: 'custom',
                path: [
                  'learningContext',
                  'objectives',
                  objectiveIndex,
                  'scope',
                  'taskSourceIds',
                  taskIndex,
                ],
                message: 'Modellabgeleitete Aufgabenlernziele dürfen nur Quizfragen referenzieren.',
              });
            }
          });
          objective.origin.derivedFromSourceIds.forEach((sourceId, sourceIndex) => {
            if (!taskSourceIds.has(sourceId)) {
              ctx.addIssue({
                code: 'custom',
                path: [
                  'learningContext',
                  'objectives',
                  objectiveIndex,
                  'origin',
                  'derivedFromSourceIds',
                  sourceIndex,
                ],
                message:
                  'Herleitungsquellen eines Aufgabenlernziels müssen in dessen Aufgaben-Scope liegen.',
              });
            }
          });
        }
      }
    });
  }

  if (value.releasedResults.state === 'available') {
    value.releasedResults.aggregates.forEach((aggregate, index) =>
      addReferenceIssue(
        ctx,
        sourceKinds,
        aggregate.sourceId,
        ['quiz-result-aggregate'],
        ['releasedResults', 'aggregates', index, 'sourceId'],
      ),
    );
  }

  if (value.feedback.state === 'available') {
    value.feedback.aggregates.forEach((aggregate, index) =>
      addReferenceIssue(
        ctx,
        sourceKinds,
        aggregate.sourceId,
        ['feedback-aggregate'],
        ['feedback', 'aggregates', index, 'sourceId'],
      ),
    );
  }

  const domainReferencedQaQuestionIds = new Set<string>();
  const domainReferencedQuizQuestionIds = new Set<string>();
  if (value.questions.state === 'available') {
    value.questions.items.forEach((question) =>
      domainReferencedQaQuestionIds.add(question.sourceId),
    );
  }
  if (value.topics.state === 'available') {
    value.topics.items.forEach((topic) => {
      topic.memberQuestionSourceIds.forEach((sourceId) =>
        domainReferencedQaQuestionIds.add(sourceId),
      );
      if (topic.labelOrigin.kind === 'source-extractive') {
        domainReferencedQaQuestionIds.add(topic.labelOrigin.sourceQuestionId);
      } else if (topic.labelOrigin.kind === 'model-generated') {
        topic.labelOrigin.derivedFromSourceIds.forEach((sourceId) =>
          domainReferencedQaQuestionIds.add(sourceId),
        );
      }
    });
  }
  if (value.compass.state === 'available') {
    value.compass.signals.forEach((signal) => {
      signal.questionSourceIds.forEach((sourceId) => domainReferencedQaQuestionIds.add(sourceId));
      signal.evidence.forEach((evidence) => {
        const kind = sourceKinds.get(evidence.sourceId);
        if (kind === 'qa-question') domainReferencedQaQuestionIds.add(evidence.sourceId);
        if (kind === 'quiz-question') domainReferencedQuizQuestionIds.add(evidence.sourceId);
      });
    });
  }
  if (value.learningContext.state === 'available') {
    value.learningContext.objectives.forEach((objective) => {
      if (objective.scope.kind === 'tasks') {
        objective.scope.taskSourceIds.forEach((sourceId) => {
          const kind = sourceKinds.get(sourceId);
          if (kind === 'qa-question') domainReferencedQaQuestionIds.add(sourceId);
          if (kind === 'quiz-question') domainReferencedQuizQuestionIds.add(sourceId);
        });
      }
      if (objective.origin.kind === 'model-derived') {
        objective.origin.derivedFromSourceIds.forEach((sourceId) =>
          domainReferencedQuizQuestionIds.add(sourceId),
        );
      }
    });
  }
  availableResultAggregateIds.forEach((aggregateSourceId) => {
    const aggregateSource = sourcesById.get(aggregateSourceId);
    if (
      aggregateSource?.kind === 'quiz-result-aggregate' &&
      aggregateSource.scope.kind === 'question'
    ) {
      domainReferencedQuizQuestionIds.add(aggregateSource.scope.questionSourceId);
    }
  });

  value.sources.forEach((source, sourceIndex) => {
    let sectionReferenceExists = true;
    switch (source.kind) {
      case 'semantic-topic':
        sectionReferenceExists = availableTopicIds.has(source.id);
        break;
      case 'learning-objective':
        sectionReferenceExists = availableLearningObjectiveIds.has(source.id);
        break;
      case 'quiz-result-aggregate':
        sectionReferenceExists = availableResultAggregateIds.has(source.id);
        break;
      case 'feedback-aggregate':
        sectionReferenceExists = availableFeedbackAggregateIds.has(source.id);
        break;
      case 'compass-signal':
        sectionReferenceExists = availableCompassSignalIds.has(source.id);
        break;
      case 'qa-question':
        sectionReferenceExists = domainReferencedQaQuestionIds.has(source.id);
        break;
      case 'quiz-question':
        sectionReferenceExists = domainReferencedQuizQuestionIds.has(source.id);
        break;
    }
    if (!sectionReferenceExists) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources', sourceIndex, 'id'],
        message:
          'Die Quelle benötigt einen verfügbaren Bereich und eine Referenz in diesem Bereich.',
      });
    }
  });

  const channels = new Set(value.scope.channels);
  const learningUsesQuizScope =
    value.learningContext.state === 'available' &&
    value.learningContext.objectives.some(
      (objective) =>
        objective.scope.kind === 'quiz' ||
        objective.scope.kind === 'section' ||
        (objective.scope.kind === 'tasks' &&
          objective.scope.taskSourceIds.some(
            (sourceId) => sourceKinds.get(sourceId) === 'quiz-question',
          )) ||
        objective.origin.kind === 'model-derived',
    );
  if (
    (value.questions.state === 'available' ||
      value.topics.state === 'available' ||
      domainReferencedQaQuestionIds.size > 0) &&
    !channels.has('qa')
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['scope', 'channels'],
      message: 'Verfügbare Fragen oder Themen benötigen den Q&A-Kanal.',
    });
  }
  if (
    (value.releasedResults.state === 'available' ||
      domainReferencedQuizQuestionIds.size > 0 ||
      learningUsesQuizScope) &&
    !channels.has('quiz')
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['scope', 'channels'],
      message: 'Verfügbare Quizergebnisse benötigen den Quizkanal.',
    });
  }
  if (value.feedback.state === 'available' && !channels.has('quickFeedback')) {
    ctx.addIssue({
      code: 'custom',
      path: ['scope', 'channels'],
      message: 'Verfügbares Feedback benötigt den Quick-Feedback-Kanal.',
    });
  }

  if (value.questions.state === 'available') {
    const questionFilter = value.scope.questionFilter;
    if (questionFilter.state !== 'available') {
      ctx.addIssue({
        code: 'custom',
        path: ['scope', 'questionFilter'],
        message: 'Verfügbare Fragen benötigen einen expliziten Fragefilter.',
      });
    } else {
      value.questions.items.forEach((question, index) => {
        if (!questionFilter.statuses.includes(question.status)) {
          ctx.addIssue({
            code: 'custom',
            path: ['questions', 'items', index, 'status'],
            message: 'Fragenstatus ist nicht im Scopefilter enthalten.',
          });
        }
      });
    }
    if (value.scope.activeWeighting.kind !== 'qa-ranking') {
      ctx.addIssue({
        code: 'custom',
        path: ['scope', 'activeWeighting'],
        message: 'Verfügbare Q&A-Fragen benötigen die aktive Q&A-Gewichtung.',
      });
    }
  }

  const requiredRevisionKeys: Array<keyof typeof value.meta.revisions> = [];
  if (value.questions.state === 'available') {
    requiredRevisionKeys.push('questionText', 'questionStatus', 'questionNlp');
    if (value.questions.items.some((question) => question.answerState.state !== 'unavailable')) {
      requiredRevisionKeys.push('questionAnswerState');
    }
    if (value.questions.items.some((question) => question.votes.state === 'available')) {
      requiredRevisionKeys.push('questionVotes');
    }
  }
  if (value.topics.state === 'available') {
    requiredRevisionKeys.push('topics');
  }
  if (value.learningContext.state === 'available') {
    requiredRevisionKeys.push('learningObjectives');
  }
  if (value.releasedResults.state === 'available') {
    requiredRevisionKeys.push('releasedResults');
  }
  if (value.feedback.state === 'available') {
    requiredRevisionKeys.push('feedback');
  }
  requiredRevisionKeys.forEach((key) => {
    if (value.meta.revisions[key].state !== 'available') {
      ctx.addIssue({
        code: 'custom',
        path: ['meta', 'revisions', key],
        message: `Der verfügbare Bereich benötigt eine verfügbare Revision: ${key}.`,
      });
    }
  });

  if (value.topics.state === 'available' && value.meta.revisions.topics.state === 'available') {
    const expectedRevision =
      value.topics.freshness.state === 'current'
        ? value.topics.freshness.analysisRevision
        : value.topics.freshness.currentRevision;
    if (value.meta.revisions.topics.value !== expectedRevision) {
      ctx.addIssue({
        code: 'custom',
        path: ['meta', 'revisions', 'topics', 'value'],
        message: 'Die Themenrevision muss den aktuellen Fragedatenstand bezeichnen.',
      });
    }
  }
}

function validatePromptPacking(value: ModerationDomainContextV1, ctx: z.RefinementCtx): void {
  const { selectionLimits } = value.scope;
  const packedQuestionItemIds =
    value.questions.state === 'available'
      ? new Set(value.questions.items.map((question) => question.sourceId))
      : new Set<string>();
  if (
    value.questions.state === 'available' &&
    value.questions.items.length > selectionLimits.questions
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['questions', 'items'],
      message: 'Die Zahl gepackter Fragen überschreitet die Auswahlgrenze.',
    });
  }
  if (value.topics.state === 'available' && value.topics.items.length > selectionLimits.topics) {
    ctx.addIssue({
      code: 'custom',
      path: ['topics', 'items'],
      message: 'Die Zahl gepackter Themen überschreitet die Auswahlgrenze.',
    });
  }
  if (value.topics.state === 'available') {
    const representedTopicQuestionIds = new Set(
      value.topics.items.flatMap((topic) => topic.representedQuestionSourceIds),
    );
    if (representedTopicQuestionIds.size !== value.topics.corpus.representedQuestions) {
      ctx.addIssue({
        code: 'custom',
        path: ['topics', 'corpus', 'representedQuestions'],
        message:
          'representedQuestions muss der Zahl eindeutig dargestellter Themenmitgliedstexte entsprechen.',
      });
    }
  }
  if (
    value.compass.state === 'available' &&
    value.compass.signals.length > selectionLimits.compassSignals
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['compass', 'signals'],
      message: 'Die Zahl gepackter Kompasssignale überschreitet die Auswahlgrenze.',
    });
  }
  if (
    value.learningContext.state === 'available' &&
    value.learningContext.objectives.length > selectionLimits.learningObjectives
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['learningContext', 'objectives'],
      message: 'Die Zahl gepackter Lernziele überschreitet die Auswahlgrenze.',
    });
  }
  if (
    value.releasedResults.state === 'available' &&
    value.releasedResults.aggregates.length > selectionLimits.resultAggregates
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['releasedResults', 'aggregates'],
      message: 'Die Zahl gepackter Ergebnisaggregate überschreitet die Auswahlgrenze.',
    });
  }
  if (
    value.feedback.state === 'available' &&
    value.feedback.aggregates.length > selectionLimits.feedbackAggregates
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['feedback', 'aggregates'],
      message: 'Die Zahl gepackter Feedbackaggregate überschreitet die Auswahlgrenze.',
    });
  }

  const sourcesById = new Map(value.sources.map((source) => [source.id, source] as const));
  const reachableSourceIds = new Set<string>();
  const allowedIncludedQuestionTextIds = new Set<string>();
  const reach = (sourceId: string): void => {
    reachableSourceIds.add(sourceId);
  };
  const reachIncludedQuestionText = (sourceId: string): void => {
    reach(sourceId);
    allowedIncludedQuestionTextIds.add(sourceId);
  };

  if (value.questions.state === 'available') {
    value.questions.items.forEach((question) => {
      reachIncludedQuestionText(question.sourceId);
      question.topicSourceIds.forEach(reach);
    });
  }
  if (value.topics.state === 'available') {
    value.topics.items.forEach((topic) => {
      reach(topic.sourceId);
      topic.memberQuestionSourceIds.forEach(reach);
      topic.representedQuestionSourceIds.forEach(reachIncludedQuestionText);
      reachIncludedQuestionText(topic.representativeQuestionSourceId);
      if (topic.labelOrigin.kind === 'source-extractive') {
        reachIncludedQuestionText(topic.labelOrigin.sourceQuestionId);
      } else if (topic.labelOrigin.kind === 'model-generated') {
        topic.labelOrigin.derivedFromSourceIds.forEach(reachIncludedQuestionText);
      }
    });
  }
  if (value.compass.state === 'available') {
    value.compass.signals.forEach((signal) => {
      reach(signal.sourceId);
      signal.questionSourceIds.forEach(reachIncludedQuestionText);
      signal.evidence.forEach((evidence) => {
        reach(evidence.sourceId);
        if (sourcesById.get(evidence.sourceId)?.kind === 'qa-question') {
          allowedIncludedQuestionTextIds.add(evidence.sourceId);
        }
      });
    });
  }
  if (value.learningContext.state === 'available') {
    value.learningContext.objectives.forEach((objective) => {
      reach(objective.sourceId);
      if (objective.scope.kind === 'tasks') {
        objective.scope.taskSourceIds.forEach((sourceId) => {
          reach(sourceId);
          if (sourcesById.get(sourceId)?.kind === 'qa-question') {
            allowedIncludedQuestionTextIds.add(sourceId);
          }
        });
      }
      if (objective.origin.kind === 'model-derived') {
        objective.origin.derivedFromSourceIds.forEach(reach);
      }
    });
  }
  if (value.releasedResults.state === 'available') {
    value.releasedResults.aggregates.forEach((aggregate) => {
      reach(aggregate.sourceId);
      const source = sourcesById.get(aggregate.sourceId);
      if (source?.kind === 'quiz-result-aggregate' && source.scope.kind === 'question') {
        reach(source.scope.questionSourceId);
      }
    });
  }
  if (value.feedback.state === 'available') {
    value.feedback.aggregates.forEach((aggregate) => reach(aggregate.sourceId));
  }

  value.sources.forEach((source, sourceIndex) => {
    if (!reachableSourceIds.has(source.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources', sourceIndex, 'id'],
        message: 'Die gepackte Quelle ist vom ausgewählten Fachgraphen nicht erreichbar.',
      });
    }
    if (
      source.kind === 'qa-question' &&
      source.content.state === 'included' &&
      !allowedIncludedQuestionTextIds.has(source.id)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources', sourceIndex, 'content'],
        message: 'Enthaltener Fragetext benötigt eine gepackte Auswahl- oder Evidenzreferenz.',
      });
    }
    if (
      source.kind === 'qa-question' &&
      source.content.state === 'included' &&
      !packedQuestionItemIds.has(source.id)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources', sourceIndex, 'content'],
        message: 'Enthaltener Q&A-Text muss Teil des ausgewählten Fragenkorpus sein.',
      });
    }
  });

  const includedModelQuestionTexts = value.sources.filter(
    (source) =>
      source.kind === 'quiz-question' ||
      (source.kind === 'qa-question' && source.content.state === 'included'),
  ).length;
  if (includedModelQuestionTexts > selectionLimits.questions) {
    ctx.addIssue({
      code: 'custom',
      path: ['scope', 'selectionLimits', 'questions'],
      message: 'Quellenpfade dürfen die Auswahlgrenze für enthaltene Fragetexte nicht umgehen.',
    });
  }
}

export const ModerationAnalysisDomainContextV1Schema = ModerationDomainContextV1BaseSchema.extend({
  representation: z.literal('analysis-candidates'),
}).superRefine(validateCommonDomainContext);
export type ModerationAnalysisDomainContextV1 = z.infer<
  typeof ModerationAnalysisDomainContextV1Schema
>;

/** Backward-compatible public name for the pre-packing domain projection. */
export const ModerationDomainContextV1Schema = ModerationAnalysisDomainContextV1Schema;

export const ModerationPromptDomainContextV1Schema = ModerationDomainContextV1BaseSchema.extend({
  representation: z.literal('prompt-selection'),
}).superRefine((value, ctx) => {
  validateCommonDomainContext(value, ctx);
  validatePromptPacking(value, ctx);
});
export type ModerationPromptDomainContextV1 = z.infer<typeof ModerationPromptDomainContextV1Schema>;

export const ModerationAnalysisContextV1Schema = z
  .object({
    schemaVersion: z.literal(MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION),
    contractVersion: z.literal(MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION),
    assembledAt: z.string().datetime(),
    context: ModerationAnalysisDomainContextV1Schema,
  })
  .strict();
export type ModerationAnalysisContextV1 = z.infer<typeof ModerationAnalysisContextV1Schema>;

export const ModerationPromptBudgetV1Schema = z
  .object({
    version: z.literal(MODERATION_PROMPT_BUDGET_VERSION),
    tokenizer: z
      .object({
        method: z.enum(['exact-tokenizer', 'conservative-estimate']),
        id: z.string().trim().min(1).max(120),
        version: z.string().trim().min(1).max(120),
      })
      .strict(),
    modelProfile: z.string().trim().min(1).max(120),
    contextWindowTokens: z.number().int().positive(),
    instructionTokens: z.number().int().nonnegative(),
    definitionTokens: z.number().int().nonnegative(),
    dataTokens: z.number().int().nonnegative(),
    packedInputTokens: z.number().int().nonnegative(),
    reservedOutputTokens: z.number().int().nonnegative(),
    safetyMarginTokens: z.number().int().nonnegative(),
    truncations: z
      .array(
        z
          .object({
            section: ModerationPromptSectionSchema,
            omittedItems: z.number().int().positive(),
            reason: z.enum(['item-limit', 'token-budget', 'redaction', 'deduplication']),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expectedInput = value.instructionTokens + value.definitionTokens + value.dataTokens;
    if (value.packedInputTokens !== expectedInput) {
      ctx.addIssue({
        code: 'custom',
        path: ['packedInputTokens'],
        message: 'packedInputTokens muss der Summe der Eingabeteile entsprechen.',
      });
    }
    if (
      value.packedInputTokens + value.reservedOutputTokens + value.safetyMarginTokens >
      value.contextWindowTokens
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['contextWindowTokens'],
        message: 'Eingabe, Antwortreserve und Sicherheitsmarge überschreiten das Kontextfenster.',
      });
    }
  });
export type ModerationPromptBudgetV1 = z.infer<typeof ModerationPromptBudgetV1Schema>;

export const ModerationPromptContextV1Schema = z
  .object({
    schemaVersion: z.literal(MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION),
    contractVersion: z.literal(MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION),
    packedAt: z.string().datetime(),
    hashAlgorithm: z.literal('sha-256'),
    hashMaterialVersion: z.literal(MODERATION_PROMPT_HASH_MATERIAL_VERSION),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    context: ModerationPromptDomainContextV1Schema,
    budget: ModerationPromptBudgetV1Schema,
  })
  .strict();
export type ModerationPromptContextV1 = z.infer<typeof ModerationPromptContextV1Schema>;
