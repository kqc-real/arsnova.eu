import {
  MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1,
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  ModerationAnalysisContextV1Schema,
  type AppLocale,
  type ModerationAnalysisContextV1,
} from '@arsnova/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QA_SUMMARY_MODERATION_PACKING_PROFILE,
  QA_SUMMARY_TECHNICAL_DEFINITION_TEXT,
  QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT,
  assemblePreparedModerationSummaryContext,
  countIncludedQaQuestionSources,
  createQaSummaryFallback,
  ensureMinimumQaQuestionCoverage,
  prepareModerationSummaryContextFromAnalysis,
  qaSummaryTechnicalHandoffTokenCounts,
  resolveQaSummaryAdapterPlan,
} from './moderationSummaryContext';
import {
  canonicalModerationPromptJson,
  estimateModerationPromptUtf8Tokens,
} from './moderationPromptContextPacking';
import { resetQaSummaryAdapterForTests } from './qaSummaryAdapter';
import { createExtractiveQaSummaryOutput } from './qaSummaryExtractive';
import { runPreparedQaSummary } from './qaSummaryRuntimeAdapter';
import { bindQaSummaryModelOutputV2 } from './qaSummaryValidateV2';

function withEmptyQaEvidence(
  promptContext: ReturnType<
    typeof prepareModerationSummaryContextFromAnalysis
  >['request']['promptContext'],
): typeof promptContext {
  const emptyPack = structuredClone(promptContext);
  if (emptyPack.context.questions.state !== 'available') {
    throw new Error('Erwartete verfügbare Fragen im Pack.');
  }
  emptyPack.context.questions = {
    ...emptyPack.context.questions,
    corpus: {
      total: 21,
      eligible: 21,
      analyzed: 21,
      deduplicated: 21,
      represented: 0,
    },
    items: [],
  };
  emptyPack.context.sources = [];
  emptyPack.budget.truncations = [
    { section: 'questions', omittedItems: 21, reason: 'token-budget' },
  ];
  emptyPack.budget.dataTokens = estimateModerationPromptUtf8Tokens(
    canonicalModerationPromptJson(emptyPack.context),
  );
  emptyPack.budget.packedInputTokens =
    emptyPack.budget.instructionTokens +
    emptyPack.budget.definitionTokens +
    emptyPack.budget.dataTokens;
  return emptyPack;
}

function analysisFixture(
  fixture:
    | typeof MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1
    | typeof MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1,
  locale: AppLocale = 'de',
): ModerationAnalysisContextV1 {
  const clone = structuredClone(fixture);
  return ModerationAnalysisContextV1Schema.parse({
    schemaVersion: clone.schemaVersion,
    contractVersion: MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
    assembledAt: '2026-01-15T10:05:00.000Z',
    context: { ...clone.context, locale, representation: 'analysis-candidates' },
  });
}

const plan = {
  capabilities: resolveQaSummaryAdapterPlan().capabilities,
  selectedMode: 'full-context' as const,
  fallback: null,
  inferenceConfigured: true,
};

describe('moderationSummaryContext', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetQaSummaryAdapterForTests();
  });

  it('bindet die exakten technischen Texte an die konservativen UTF-8-Zähler', () => {
    const counts = qaSummaryTechnicalHandoffTokenCounts();
    expect(counts).toEqual({
      instructionTokens: Buffer.byteLength(QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT, 'utf8'),
      definitionTokens: Buffer.byteLength(QA_SUMMARY_TECHNICAL_DEFINITION_TEXT, 'utf8'),
    });
    expect(QA_SUMMARY_TECHNICAL_INSTRUCTION_TEXT).toContain('2 to 4 short statements');
    const prepared = prepareModerationSummaryContextFromAnalysis({
      analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1),
      plan,
    });
    expect(prepared.request.instructionVersion).toBe('qa-summary-technical-handoff-v2');
    expect(prepared.preview.instructionVersion).toBe('qa-summary-technical-handoff-v2');
    expect(prepared.request.promptContext.budget).toMatchObject(counts);
    expect(
      prepared.request.promptContext.budget.packedInputTokens +
        prepared.request.promptContext.budget.reservedOutputTokens +
        prepared.request.promptContext.budget.safetyMarginTokens,
    ).toBeLessThanOrEqual(QA_SUMMARY_MODERATION_PACKING_PROFILE.contextWindowTokens);
  });

  it('packt den Referenzkontext im 8192-Profil mit Q&A-Belegen und sichtbaren Kürzungen', () => {
    const prepared = prepareModerationSummaryContextFromAnalysis({
      analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1),
      plan,
    });
    expect(countIncludedQaQuestionSources(prepared.request.promptContext)).toBeGreaterThan(0);
    expect(prepared.request.promptContext.budget.contextWindowTokens).toBe(8_192);
    expect(
      prepared.request.promptContext.budget.packedInputTokens +
        prepared.request.promptContext.budget.reservedOutputTokens +
        prepared.request.promptContext.budget.safetyMarginTokens,
    ).toBeLessThanOrEqual(QA_SUMMARY_MODERATION_PACKING_PROFILE.contextWindowTokens);
    expect(prepared.request.promptContext.budget.truncations.length).toBeGreaterThan(0);
    expect(prepared.plan.selectedMode).toBe('full-context');
  });

  it('hält semantische Themenmitgliedschaft und questionCount konsistent wenn >12 Fragen gekürzt werden', () => {
    const base = analysisFixture(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1);
    if (base.context.questions.state !== 'available' || base.context.topics.state !== 'available') {
      throw new Error('Erwartete verfügbare Fragen und Themen im Referenzfixture.');
    }
    const templateQuestion = base.context.questions.items[1]!;
    const templateSource = base.context.sources.find((source) => source.kind === 'qa-question');
    if (!templateSource || templateSource.kind !== 'qa-question') {
      throw new Error('Erwartete Q&A-Quelle im Referenzfixture.');
    }

    const firstTopic = base.context.topics.items[0]!;
    const extraQuestions = Array.from({ length: 14 }, (_, index) => {
      const sourceId = `qa-question:99999999-9999-4999-8999-${String(index + 1).padStart(12, '0')}`;
      const isThirdTopicMember = index === 12 || index === 13;
      const topicId = isThirdTopicMember ? firstTopic.sourceId : undefined;
      return {
        question: {
          ...structuredClone(templateQuestion),
          sourceId,
          status: 'ACTIVE' as const,
          votes: {
            state: 'available' as const,
            positive: 0,
            negative: 0,
            net: 0,
            total: 0,
            bestScore: { state: 'available' as const, value: 0 },
            controversyScore: { state: 'available' as const, value: 0 },
          },
          topicSourceIds: topicId ? [topicId] : [],
        },
        source: {
          ...structuredClone(templateSource),
          id: sourceId,
          content: {
            state: 'included' as const,
            text: `Zusatzfrage ${index + 1} mit niedrigem Rang zur Konsistenzprüfung.`,
            truncated: false,
          },
        },
      };
    });

    const extraTopicMemberIds = extraQuestions.slice(12).map(({ question }) => question.sourceId);
    const updatedFirstTopic = {
      ...firstTopic,
      aggregates: {
        ...firstTopic.aggregates,
        questionCount: firstTopic.memberQuestionSourceIds.length + extraTopicMemberIds.length,
      },
      memberQuestionSourceIds: [...firstTopic.memberQuestionSourceIds, ...extraTopicMemberIds],
      representedQuestionSourceIds: [
        ...firstTopic.representedQuestionSourceIds,
        ...extraTopicMemberIds,
      ],
    };

    const allQuestions = [
      ...base.context.questions.items,
      ...extraQuestions.map(({ question }) => question),
    ];
    const analysis = ModerationAnalysisContextV1Schema.parse({
      ...base,
      context: {
        ...base.context,
        questions: {
          ...base.context.questions,
          corpus: {
            total: allQuestions.length,
            eligible: allQuestions.length,
            analyzed: allQuestions.length,
            deduplicated: allQuestions.length,
            represented: allQuestions.length,
          },
          items: allQuestions,
        },
        topics: {
          ...base.context.topics,
          corpus: {
            eligibleQuestions: allQuestions.length,
            analyzedQuestions: allQuestions.length,
            representedQuestions:
              base.context.topics.corpus.representedQuestions + extraTopicMemberIds.length,
          },
          items: [updatedFirstTopic, ...base.context.topics.items.slice(1)],
        },
        sources: [...base.context.sources, ...extraQuestions.map(({ source }) => source)],
      },
    });

    const prepared = prepareModerationSummaryContextFromAnalysis({ analysis, plan });
    expect(prepared.plan.selectedMode).toBe('full-context');
    expect(prepared.request.promptContext.context.topics.state).toBe('available');
    if (prepared.request.promptContext.context.topics.state === 'available') {
      for (const topic of prepared.request.promptContext.context.topics.items) {
        expect(topic.memberQuestionSourceIds.length).toBeGreaterThanOrEqual(2);
        expect(topic.aggregates.questionCount).toBe(topic.memberQuestionSourceIds.length);
      }
    }
  });

  it('hält value und reason bei gekürzten zählbasierten Kompass-Signalen synchron', () => {
    const base = analysisFixture(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1);
    if (
      base.context.questions.state !== 'available' ||
      base.context.compass.state !== 'available'
    ) {
      throw new Error('Erwartete verfügbare Fragen und Kompass im Referenzfixture.');
    }
    const questionIds = base.context.questions.items.map((item) => item.sourceId);
    const analysis = ModerationAnalysisContextV1Schema.parse({
      ...base,
      context: {
        ...base.context,
        scope: {
          ...base.context.scope,
          selectionLimits: {
            ...base.context.scope.selectionLimits,
            topics: 0,
          },
        },
        questions: {
          ...base.context.questions,
          items: base.context.questions.items.map((item) => ({
            ...item,
            topicSourceIds: [],
          })),
        },
        topics: {
          state: 'disabled',
          reason: 'no-semantic-topics',
        },
        compass: {
          ...base.context.compass,
          primarySignalSourceId: 'compass-signal:high-frequency-test',
          signals: [
            {
              sourceId: 'compass-signal:high-frequency-test',
              signal: 'high-frequency',
              basis: 'question-frequency',
              cardKind: 'topics',
              questionSourceIds: questionIds,
              value: questionIds.length,
              reason: `${questionIds.length} selected Q&A question(s) share the stored technical classification.`,
              evidence: questionIds.map((sourceId) => ({
                sourceId,
                detail: 'Stored Q&A NLP category: technical.',
              })),
              suggestedNextStep: {
                action: 'address-question',
                rationale: 'Address the classified question group as a bounded topic cue.',
              },
            },
          ],
        },
        sources: [
          ...base.context.sources.filter(
            (source) => source.kind !== 'semantic-topic' && source.kind !== 'compass-signal',
          ),
          {
            id: 'compass-signal:high-frequency-test',
            kind: 'compass-signal',
            label: 'Q&A classification group',
          },
        ],
      },
    });

    const prepared = prepareModerationSummaryContextFromAnalysis({ analysis, plan });
    if (prepared.request.promptContext.context.compass.state !== 'available') {
      throw new Error('Erwartete verfügbaren Kompass im gepackten Kontext.');
    }
    const freqSignal = prepared.request.promptContext.context.compass.signals.find(
      (signal) => signal.sourceId === 'compass-signal:high-frequency-test',
    );
    expect(freqSignal).toBeDefined();
    expect(freqSignal?.value).toBe(freqSignal?.questionSourceIds.length);
    expect(freqSignal?.value).toBeLessThan(questionIds.length);
    expect(freqSignal?.reason).toBe(
      `${freqSignal?.value} selected Q&A question(s) share the stored technical classification.`,
    );
  });

  it('stellt Mindest-Q&A-Coverage her wenn der erste Pack keine included Sources liefert', () => {
    const analysis = analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1);
    const prepared = prepareModerationSummaryContextFromAnalysis({ analysis, plan });
    const emptyFirstPack = withEmptyQaEvidence(prepared.request.promptContext);

    expect(countIncludedQaQuestionSources(emptyFirstPack)).toBe(0);
    const recovered = ensureMinimumQaQuestionCoverage({
      analysis,
      initialPack: emptyFirstPack,
    });
    expect(countIncludedQaQuestionSources(recovered)).toBeGreaterThan(0);
  });

  it('force-fitted Full-context wenn Truncate-Baseline wegen Shell-Budget leer bleibt', () => {
    const base = analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1);
    if (base.context.questions.state !== 'available') {
      throw new Error('Erwartete verfügbare Fragen im Minimalfixture.');
    }
    const templateQuestion = base.context.questions.items[0]!;
    const templateSource = base.context.sources.find((source) => source.kind === 'qa-question');
    if (!templateSource || templateSource.kind !== 'qa-question') {
      throw new Error('Erwartete Q&A-Quelle im Minimalfixture.');
    }
    const items = Array.from({ length: 20 }, (_, index) => ({
      ...structuredClone(templateQuestion),
      sourceId: `qa-question:00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    const sources = items.map((question, index) => ({
      ...structuredClone(templateSource),
      id: question.sourceId,
      content: {
        state: 'included' as const,
        text: `Produktionsfrage ${index}: ${'Wort '.repeat(60)}`.slice(0, 350),
        truncated: false,
      },
    }));
    const analysis = ModerationAnalysisContextV1Schema.parse({
      ...base,
      assembledAt: '2026-10-15T05:31:38.381Z',
      context: {
        ...base.context,
        questions: {
          ...base.context.questions,
          items,
          corpus: {
            total: 21,
            eligible: 20,
            analyzed: 20,
            deduplicated: 20,
            represented: 20,
          },
        },
        sources,
        scope: {
          ...base.context.scope,
          selectionLimits: {
            ...base.context.scope.selectionLimits,
            questions: 20,
          },
        },
        // At ctx-8192, ~18 fat question-limitations leave headroom too small for
        // truncate-only recovery but still allow the slim force-fit pack.
        limitations: Array.from({ length: 18 }, (_, index) => ({
          code: 'budget-truncated' as const,
          section: 'questions' as const,
          detail: `detail-${index}-`.padEnd(200, '.'),
        })),
      },
    });

    const prepared = prepareModerationSummaryContextFromAnalysis({ analysis, plan });
    const included = countIncludedQaQuestionSources(prepared.request.promptContext);
    expect(included).toBeGreaterThan(0);
    // Larger force-fit candidates are tried first (5→1), so more than one question
    // should land when the slim shell allows it.
    expect(included).toBeGreaterThanOrEqual(3);
    expect(prepared.plan.selectedMode).toBe('full-context');
    expect(prepared.plan.fallback).toBeNull();
    expect(prepared.request.promptContext.context.limitations).toContainEqual(
      expect.objectContaining({ detail: 'qa-force-fit' }),
    );
    expect(prepared.request.promptContext.context.scope.questionFilter).toMatchObject(
      analysis.context.scope.questionFilter,
    );
  });

  it('diversifiziert Force-Fit über PENDING, PINNED und ACTIVE per Round-Robin', () => {
    const base = analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1);
    if (base.context.questions.state !== 'available') {
      throw new Error('Erwartete verfügbare Fragen im Minimalfixture.');
    }
    const templateQuestion = base.context.questions.items[0]!;
    const templateSource = base.context.sources.find((source) => source.kind === 'qa-question');
    if (!templateSource || templateSource.kind !== 'qa-question') {
      throw new Error('Erwartete Q&A-Quelle im Minimalfixture.');
    }
    const statuses = [
      ...Array.from({ length: 6 }, () => 'PENDING' as const),
      'PINNED' as const,
      'ACTIVE' as const,
    ];
    const items = statuses.map((status, index) => ({
      ...structuredClone(templateQuestion),
      sourceId: `qa-question:00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      status,
    }));
    const sources = items.map((question, index) => ({
      ...structuredClone(templateSource),
      id: question.sourceId,
      content: {
        state: 'included' as const,
        text: `Statusfrage ${question.status} ${index}: ${'Wort '.repeat(40)}`.slice(0, 280),
        truncated: false,
      },
    }));
    const analysis = ModerationAnalysisContextV1Schema.parse({
      ...base,
      assembledAt: '2026-10-15T05:31:38.381Z',
      context: {
        ...base.context,
        questions: {
          ...base.context.questions,
          items,
          corpus: {
            total: 8,
            eligible: 8,
            analyzed: 8,
            deduplicated: 8,
            represented: 8,
          },
        },
        sources,
        scope: {
          ...base.context.scope,
          questionFilter: {
            state: 'available' as const,
            statuses: ['PENDING', 'ACTIVE', 'PINNED'],
            timeWindow: { kind: 'entire-session' as const },
          },
          selectionLimits: {
            ...base.context.scope.selectionLimits,
            questions: 8,
          },
        },
        limitations: Array.from({ length: 18 }, (_, index) => ({
          code: 'budget-truncated' as const,
          section: 'questions' as const,
          detail: `mix-${index}-`.padEnd(200, '.'),
        })),
      },
    });

    const prepared = prepareModerationSummaryContextFromAnalysis({ analysis, plan });
    expect(prepared.request.promptContext.context.limitations).toContainEqual(
      expect.objectContaining({ detail: 'qa-force-fit' }),
    );
    const packedStatuses = new Set(
      prepared.request.promptContext.context.questions.state === 'available'
        ? prepared.request.promptContext.context.questions.items.map((question) => question.status)
        : [],
    );
    expect(packedStatuses.has('PENDING')).toBe(true);
    expect(packedStatuses.has('PINNED')).toBe(true);
    expect(packedStatuses.has('ACTIVE')).toBe(true);
  });

  it('erreicht Force-Fit auch wenn die Baseline-Shell selbst das Budget sprengt', () => {
    const base = analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1);
    if (base.context.questions.state !== 'available') {
      throw new Error('Erwartete verfügbare Fragen im Minimalfixture.');
    }
    const templateQuestion = base.context.questions.items[0]!;
    const templateSource = base.context.sources.find((source) => source.kind === 'qa-question');
    if (!templateSource || templateSource.kind !== 'qa-question') {
      throw new Error('Erwartete Q&A-Quelle im Minimalfixture.');
    }
    const items = Array.from({ length: 5 }, (_, index) => ({
      ...structuredClone(templateQuestion),
      sourceId: `qa-question:00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    const sources = items.map((question, index) => ({
      ...structuredClone(templateSource),
      id: question.sourceId,
      content: {
        state: 'included' as const,
        text: `Frage ${index}: ${'Inhalt '.repeat(40)}`.slice(0, 280),
        truncated: false,
      },
    }));
    const analysis = ModerationAnalysisContextV1Schema.parse({
      ...base,
      assembledAt: '2026-10-15T05:31:38.381Z',
      context: {
        ...base.context,
        questions: {
          ...base.context.questions,
          items,
          corpus: {
            total: 5,
            eligible: 5,
            analyzed: 5,
            deduplicated: 5,
            represented: 5,
          },
        },
        sources,
        scope: {
          ...base.context.scope,
          selectionLimits: {
            ...base.context.scope.selectionLimits,
            questions: 5,
          },
        },
        // Enough fat question-limitations that even the empty baseline shell exceeds 8192.
        limitations: Array.from({ length: 40 }, (_, index) => ({
          code: 'budget-truncated' as const,
          section: 'questions' as const,
          detail: `shell-${index}-`.padEnd(280, '.'),
        })),
      },
    });

    const prepared = prepareModerationSummaryContextFromAnalysis({ analysis, plan });
    expect(countIncludedQaQuestionSources(prepared.request.promptContext)).toBeGreaterThan(0);
    expect(prepared.plan.selectedMode).toBe('full-context');
    expect(prepared.request.promptContext.context.limitations).toContainEqual(
      expect.objectContaining({ detail: 'qa-force-fit' }),
    );
  });

  it('stuft Full-context auf extractive herab wenn analysierte Fragen ohne included Sources bleiben', () => {
    const base = prepareModerationSummaryContextFromAnalysis({
      analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1),
      plan,
    });
    const prepared = assemblePreparedModerationSummaryContext({
      promptContext: withEmptyQaEvidence(base.request.promptContext),
      cache: 'miss',
      plan,
    });
    expect(prepared.plan.selectedMode).toBeNull();
    expect(prepared.plan.fallback).toMatchObject({
      mode: 'extractive',
      reason: 'no_packed_sources',
    });
    expect(prepared.preview.selectedMode).toBeNull();
    expect(prepared.preview.fallback).toMatchObject({ reason: 'no_packed_sources' });
  });

  it('ruft bei Full-context ohne packed Sources kein Modell auf', async () => {
    const base = prepareModerationSummaryContextFromAnalysis({
      analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1),
      plan,
    });
    const prepared = {
      ...base,
      request: {
        ...base.request,
        promptContext: withEmptyQaEvidence(base.request.promptContext),
      },
      plan,
    };

    const run = await runPreparedQaSummary(prepared);
    expect(run.execution.attemptedMode).toBe('full-context');
    expect(run.execution.effectiveMode).toBe('extractive');
    expect(run.execution.fallback).toMatchObject({ reason: 'no_packed_sources' });
  });

  it('filtert und sortiert Legacy-Statements gegen den Kontext vor der 4/2/2-Kappung', async () => {
    const legacyPlan = {
      capabilities: resolveQaSummaryAdapterPlan().capabilities,
      selectedMode: 'legacy-text' as const,
      fallback: createQaSummaryFallback('legacy-text', 'adapter_incompatible'),
      inferenceConfigured: true,
    };
    const prepared = prepareModerationSummaryContextFromAnalysis({
      analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1),
      plan: legacyPlan,
    });
    const [firstSourceId, secondSourceId] = prepared.request.promptContext.context.sources.map(
      (source) => source.id,
    );
    if (!firstSourceId || !secondSourceId) {
      throw new Error('Erwartete mindestens zwei Quellen im Referenzfixture.');
    }

    resetQaSummaryAdapterForTests({
      config: () => ({
        enabled: true,
        timeoutMs: 1_000,
        queueLimit: 8,
        concurrency: 1,
        cooldownMs: 30_000,
        ttlMs: 1_800_000,
        maxSources: 20,
        inferenceUrl: 'http://127.0.0.1:8787/summary',
        inferenceToken: null,
      }),
      fetch: async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: 'ready',
            statements: [
              { text: 'Fremd 1', sourceIds: ['qa-question:foreign-1'] },
              { text: 'Fremd 2', sourceIds: ['qa-question:foreign-2'] },
              { text: 'Fremd 3', sourceIds: ['qa-question:foreign-3'] },
              { text: 'Fremd 4', sourceIds: ['qa-question:foreign-4'] },
              { text: 'Zweiter Beleg', sourceIds: [secondSourceId, 'qa-question:foreign-5'] },
              { text: 'Erster Beleg', sourceIds: [firstSourceId] },
            ],
            suggestedNextSteps: [
              { text: 'Fremder Schritt 1', sourceIds: ['qa-question:foreign-1'] },
              { text: 'Fremder Schritt 2', sourceIds: ['qa-question:foreign-2'] },
              { text: 'Gültiger Schritt', sourceIds: [firstSourceId] },
            ],
            limitations: ['Hinweis 1', 'Hinweis 2', 'Hinweis 3'],
            modelVersion: 'legacy-fixture',
          }),
      }),
    });

    const run = await runPreparedQaSummary(prepared);
    expect(run.output.status).toBe('ready');
    expect(run.output.statements).toEqual([
      { text: 'Erster Beleg', sourceIds: [firstSourceId] },
      { text: 'Zweiter Beleg', sourceIds: [secondSourceId] },
    ]);
    expect(run.output.suggestedNextSteps).toEqual([
      { text: 'Gültiger Schritt', sourceIds: [firstSourceId] },
    ]);
    expect(run.output.limitations).toEqual([
      'Hinweis 1',
      'Aussagen ohne belegte Quelle wurden entfernt.',
    ]);

    const bound = bindQaSummaryModelOutputV2({
      output: run.output,
      prepared,
      execution: run.execution,
      analyzedAt: '2026-10-17T07:30:00.000Z',
    });
    expect(bound.status).toBe('ready');
    expect(bound.statements.map((item) => item.text)).toEqual(['Erster Beleg', 'Zweiter Beleg']);
    expect(bound.limitations).toContain('Aussagen ohne belegte Quelle wurden entfernt.');
  });

  it('verwendet für Vorschau und Auftrag dasselbe gepackte Objekt ohne technische Prompttexte', () => {
    const prepared = prepareModerationSummaryContextFromAnalysis({
      analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1),
      plan,
    });
    expect(prepared.preview.promptContext).toEqual(prepared.request.promptContext);
    expect(prepared.preview).not.toHaveProperty('instructionText');
    expect(prepared.preview).not.toHaveProperty('definitionText');
  });

  it('wählt Full-context, Legacy oder extraktiv anhand expliziter Adapterkonfiguration', () => {
    vi.stubEnv('OPEN_WEIGHT_LLM_ENABLED', 'true');
    vi.stubEnv('OPEN_WEIGHT_LLM_URL', 'http://127.0.0.1:8080');
    vi.stubEnv('OPEN_WEIGHT_LLM_TOKEN', 'a'.repeat(32));
    expect(resolveQaSummaryAdapterPlan()).toMatchObject({
      selectedMode: 'full-context',
      fallback: null,
      inferenceConfigured: true,
    });

    vi.stubEnv('OPEN_WEIGHT_LLM_ENABLED', 'false');
    vi.stubEnv('OPEN_WEIGHT_LLM_URL', '');
    vi.stubEnv('OPEN_WEIGHT_LLM_TOKEN', '');
    vi.stubEnv('QA_SUMMARY_INFERENCE_URL', 'http://127.0.0.1:8787/summary');
    expect(resolveQaSummaryAdapterPlan()).toMatchObject({
      selectedMode: 'legacy-text',
      fallback: { mode: 'legacy-text', reason: 'adapter_incompatible' },
    });

    vi.stubEnv('QA_SUMMARY_INFERENCE_URL', '');
    expect(resolveQaSummaryAdapterPlan()).toMatchObject({
      selectedMode: null,
      inferenceConfigured: false,
      fallback: { mode: 'extractive', reason: 'disabled', retry: 'not-applicable' },
    });
  });

  it.each([
    ['de', '»', '«'],
    ['en', '“', '”'],
    ['fr', '« ', ' »'],
    ['es', '«', '»'],
    ['it', '«', '»'],
  ] as const)(
    'formatiert den extraktiven Beleg in %s mit lokalen Anführungszeichen',
    (locale, open, close) => {
      const prepared = prepareModerationSummaryContextFromAnalysis({
        analysis: analysisFixture(MODERATION_PROMPT_CONTEXT_MINIMAL_FIXTURE_V1, locale),
        plan,
      });
      const output = createExtractiveQaSummaryOutput(prepared.request.promptContext);
      expect(output.status).toBe('ready');
      expect(output.statements[0]?.text).toContain(open);
      expect(output.statements[0]?.text).toContain(close);
      expect(output.statements[0]?.sourceIds).toEqual([
        prepared.request.promptContext.context.sources[0]?.id,
      ]);
    },
  );
});
