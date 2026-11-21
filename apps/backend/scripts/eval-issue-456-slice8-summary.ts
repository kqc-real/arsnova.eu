import { createHash } from 'node:crypto';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_CONTEXT_METADATA_FIXTURE_V1,
  MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
  ModerationAnalysisContextV1Schema,
  type AppLocale,
  type ModerationAnalysisContextV1,
  type ModerationPromptBudgetV1,
} from '@arsnova/shared-types';
import { canonicalModerationPromptJson } from '../src/lib/moderationPromptContextPacking';
import {
  buildIncludedQaQuestionTextsBySourceId,
  buildSummaryGroundingTextsBySourceId,
  countIncludedQaQuestionSources,
  prepareModerationSummaryContextFromAnalysis,
  QA_SUMMARY_ADAPTER_CAPABILITIES,
  QA_SUMMARY_MODERATION_PACKING_PROFILE,
  reconcileTopicSiblingQaCitations,
} from '../src/lib/moderationSummaryContext';
import {
  projectCompactSummaryWireContext,
  runOpenWeightLlmSummaryV2,
  type OpenWeightLlmTimings,
} from '../src/lib/openWeightLlmClient';
import {
  OPEN_WEIGHT_LLM_MODEL_ALIAS,
  OPEN_WEIGHT_LLM_MODEL_ID,
  OPEN_WEIGHT_LLM_MODEL_VERSION,
  OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_DEFAULT_MS,
} from '../src/lib/openWeightLlmConfig';
import { hasAcceptableQaSummaryQuality } from '../src/lib/qaSummaryQuality';

const FIXED_PACKED_AT = new Date('2026-11-21T12:00:00.000Z');
const PACK_BENCHMARK_ITERATIONS = 7;
const LIVE_DETERMINISM_RUNS = 3;

export type Slice8EvalMode = 'pack-only' | 'live';

export type Slice8PackCaseReport = Readonly<{
  caseId: 'reference-full' | 'reference-metadata-only' | 'large-corpus-8k';
  locale: AppLocale;
  snapshotHash: string;
  canonicalContextSha256: string;
  compactWireUserSha256: string;
  instructionSha256: string;
  definitionSha256: string;
  budget: ModerationPromptBudgetV1;
  wire: Readonly<{
    canonicalContextUtf8Bytes: number;
    compactUserUtf8Bytes: number;
    estimatedDataToCompactWireRatio: number;
  }>;
  coverage: Readonly<{
    analyzedQuestions: number;
    representedQuestions: number;
    includedQaSources: number;
    referenceOnlyQaSources: number;
    topicsState: string;
    packedTopics: number;
    compassState: string;
    packedSignals: number;
    learningObjectives: number;
    totalSources: number;
  }>;
  packerMedianMs: number;
  deterministicBitIdentical: boolean;
}>;

export type Slice8LivePassMetrics = Readonly<{
  pass: number;
  status: string;
  elapsedMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  conservativeToRealPromptTokenRatio: number | null;
  finishReason: string | null;
  timings: OpenWeightLlmTimings | null;
  qualityAccepted: boolean;
  statementCount: number;
  citedSourceIds: readonly string[];
  outputSha256: string | null;
}>;

export type Slice8LiveCaseReport = Readonly<{
  caseId: Slice8PackCaseReport['caseId'];
  runs: readonly Slice8LivePassMetrics[];
  allCompletedAndAccepted: boolean;
  deterministicOutputAcrossRuns: boolean;
  medianElapsedMs: number | null;
  medianPromptMs: number | null;
  medianPromptPerSecond: number | null;
}>;

export type Slice8SummaryEvaluationReport = Readonly<{
  schemaVersion: 1;
  mode: Slice8EvalMode;
  generatedAt: string;
  modelIdentity: Readonly<{
    alias: string;
    modelId: string;
    modelVersion: string;
    packingProfile: string;
    contextWindowTokens: number;
    reservedOutputTokens: number;
    safetyMarginTokens: number;
  }>;
  packCases: readonly Slice8PackCaseReport[];
  liveCases: readonly Slice8LiveCaseReport[] | null;
}>;

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : Number(((sorted[mid - 1]! + sorted[mid]!) / 2).toFixed(3));
}

function analysisFromPromptFixture(
  fixture:
    | typeof MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1
    | typeof MODERATION_PROMPT_CONTEXT_METADATA_FIXTURE_V1,
  locale: AppLocale = 'de',
): ModerationAnalysisContextV1 {
  const clone = structuredClone(fixture);
  return ModerationAnalysisContextV1Schema.parse({
    schemaVersion: clone.schemaVersion,
    contractVersion: MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
    assembledAt: '2026-01-15T10:05:00.000Z',
    context: {
      ...clone.context,
      locale,
      representation: 'analysis-candidates',
    },
  });
}

export function buildLargeSlice8SyntheticAnalysis(
  locale: AppLocale = 'de',
): ModerationAnalysisContextV1 {
  const base = analysisFromPromptFixture(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1, locale);
  if (
    base.context.questions.state !== 'available' ||
    base.context.topics.state !== 'available' ||
    base.context.compass.state !== 'available' ||
    base.context.learningContext.state !== 'available'
  ) {
    throw new Error('Reference fixture must expose questions, topics, compass, and objectives.');
  }

  const templateQuestion = base.context.questions.items[0]!;
  const totalQuestions = 120;
  const candidateQuestions = 36;
  const topicIds = Array.from(
    { length: 6 },
    (_, idx) => `semantic-topic:slice8-cluster-${idx + 1}`,
  );
  const categories = ['content', 'organization', 'technical'] as const;
  const statuses = ['PINNED', 'PENDING', 'ACTIVE'] as const;

  const referenceQuestions = base.context.questions.items;
  const questionItems = Array.from({ length: candidateQuestions }, (_, index) => {
    const refQuestion = referenceQuestions[index % referenceQuestions.length]!;
    const sourceId = `qa-question:88888888-8888-4888-8888-${String(index + 1).padStart(12, '0')}`;
    const clusterIdx = index < 24 ? index % topicIds.length : null;
    return {
      ...structuredClone(refQuestion),
      sourceId,
      status: statuses[index % statuses.length]!,
      nlp:
        refQuestion.nlp.state === 'classified'
          ? {
              ...structuredClone(refQuestion.nlp),
              category: categories[index % categories.length]!,
            }
          : structuredClone(templateQuestion.nlp),
      topicSourceIds: clusterIdx !== null ? [topicIds[clusterIdx]!] : [],
    };
  });

  const topicLabels = [
    'Lineare Regression und Residuen',
    'Klausurumfang und Hilfsmittel',
    'Abgabefristen der Übungsblätter',
    'Audioübertragung im Hörsaal',
    'Konfidenzintervalle interpretieren',
    'Peer-Instruction-Zwischenfragen',
  ] as const;

  const templateTopic = base.context.topics.items[0]!;
  const topicItems = topicIds.map((topicId) => {
    const members = questionItems
      .filter((q) => q.topicSourceIds.includes(topicId))
      .map((q) => q.sourceId);
    const representative = members[0]!;
    const positiveVotes = questionItems
      .filter((q) => members.includes(q.sourceId))
      .reduce((sum, q) => sum + (q.votes.state === 'available' ? q.votes.positive : 0), 0);
    const negativeVotes = questionItems
      .filter((q) => members.includes(q.sourceId))
      .reduce((sum, q) => sum + (q.votes.state === 'available' ? q.votes.negative : 0), 0);
    return {
      ...structuredClone(templateTopic),
      sourceId: topicId,
      labelOrigin: {
        kind: 'model-generated' as const,
        modelId: OPEN_WEIGHT_LLM_MODEL_ID,
        modelVersion: OPEN_WEIGHT_LLM_MODEL_VERSION,
        generationVersion: 'topic-label-system-v1',
        derivedFromSourceIds: members.slice(0, 2),
      },
      aggregates: {
        ...structuredClone(templateTopic.aggregates),
        questionCount: members.length,
        positiveVotes,
        negativeVotes,
        netVotes: positiveVotes - negativeVotes,
        totalVotes: positiveVotes + negativeVotes,
      },
      representativeQuestionSourceId: representative,
      memberQuestionSourceIds: members,
      representedQuestionSourceIds: members,
    };
  });

  const qaSources = questionItems.map((item, idx) => ({
    id: item.sourceId,
    kind: 'qa-question' as const,
    content: {
      state: 'included' as const,
      text: `Hörsaalfrage ${idx + 1}: Wie lässt sich das Teilkonzept im aktuellen Vorlesungsabschnitt nachvollziehbar anwenden und prüfen?`,
      truncated: false,
    },
  }));

  const topicSources = topicIds.map((id, idx) => ({
    id,
    kind: 'semantic-topic' as const,
    label: topicLabels[idx]!,
  }));

  const primarySignalId = 'compass-signal:slice8-controversy';
  const secondarySignalId = 'compass-signal:slice8-pinned';
  const controversialQuestion = questionItems[4]!;
  const controversialValue =
    controversialQuestion.votes.state === 'available' &&
    controversialQuestion.votes.controversyScore.state === 'available'
      ? controversialQuestion.votes.controversyScore.value
      : 0.8;
  const signals = [
    {
      sourceId: primarySignalId,
      signal: 'high-controversy' as const,
      basis: 'controversy-score' as const,
      cardKind: 'friction' as const,
      questionSourceIds: [controversialQuestion.sourceId, questionItems[10]!.sourceId],
      value: controversialValue,
      reason: 'Zwei hoch bewertete Hörsaalfragen zeigen geteilte Zustimmung.',
      evidence: [
        {
          sourceId: controversialQuestion.sourceId,
          detail: 'Ausgeglichene Positiv- und Gegenstimmen im Hörsaal.',
        },
        {
          sourceId: questionItems[10]!.sourceId,
          detail: 'Weitere kontroverse Hörsaalfrage.',
        },
      ],
      suggestedNextStep: {
        action: 'open-discussion' as const,
        rationale: 'Kontroverse Einschätzung kurz im Plenum klären.',
      },
    },
    {
      sourceId: secondarySignalId,
      signal: 'pinned-question' as const,
      basis: 'pinned-question-count' as const,
      cardKind: 'topics' as const,
      questionSourceIds: [questionItems[3]!.sourceId],
      value: 1,
      reason: '1 angeheftete Moderationsfrage wartet auf Einordnung.',
      evidence: [
        {
          sourceId: questionItems[3]!.sourceId,
          detail: 'Moderationsstatus PINNED.',
        },
      ],
      suggestedNextStep: {
        action: 'address-question' as const,
        rationale: 'Angeheftete Frage vor dem nächsten Abschnitt beantworten.',
      },
    },
  ];

  const objectiveSources = [
    {
      id: 'learning-objective:slice8-regression',
      kind: 'learning-objective' as const,
      text: 'Die Studierenden können Residuen und Bestimmtheitsmaß sicher interpretieren.',
    },
    {
      id: 'learning-objective:slice8-confidence',
      kind: 'learning-objective' as const,
      text: 'Die Studierenden können Konfidenzintervalle auf Stichproben anwenden.',
    },
  ];

  return ModerationAnalysisContextV1Schema.parse({
    ...base,
    context: {
      ...base.context,
      scope: {
        ...base.context.scope,
        questionFilter: {
          ...base.context.scope.questionFilter,
          statuses: ['PENDING', 'ACTIVE', 'PINNED'],
        },
        selectionLimits: {
          ...base.context.scope.selectionLimits,
          questions: candidateQuestions,
          topics: topicItems.length,
          compassSignals: signals.length,
          learningObjectives: objectiveSources.length,
        },
      },
      questions: {
        ...base.context.questions,
        corpus: {
          total: totalQuestions,
          eligible: totalQuestions,
          analyzed: candidateQuestions,
          deduplicated: candidateQuestions,
          represented: candidateQuestions,
        },
        items: questionItems,
      },
      topics: {
        ...base.context.topics,
        corpus: {
          eligibleQuestions: candidateQuestions,
          analyzedQuestions: candidateQuestions,
          representedQuestions: 24,
        },
        items: topicItems,
      },
      compass: {
        ...base.context.compass,
        primarySignalSourceId: primarySignalId,
        signals,
      },
      learningContext: {
        state: 'available',
        objectives: objectiveSources.map((src, idx) => ({
          sourceId: src.id,
          scope: { kind: 'session' as const },
          origin: { kind: 'manual' as const },
          confirmation: {
            state: 'confirmed' as const,
            confirmedAt: `2026-01-15T09:4${idx}:00.000Z`,
            revision: `slice8-obj-r${idx + 1}`,
          },
        })),
      },
      sources: [
        ...qaSources,
        ...topicSources,
        { id: primarySignalId, kind: 'compass-signal' as const, label: 'Kontroverse im Hörsaal' },
        { id: secondarySignalId, kind: 'compass-signal' as const, label: 'Angeheftete Rückfrage' },
        ...objectiveSources,
      ],
    },
  });
}

function fullContextPlan() {
  return {
    capabilities: QA_SUMMARY_ADAPTER_CAPABILITIES,
    selectedMode: 'full-context' as const,
    fallback: null,
    inferenceConfigured: true,
  };
}

export function evaluateSlice8PackCases(locale: AppLocale = 'de'): readonly Slice8PackCaseReport[] {
  const definitions: ReadonlyArray<{
    readonly caseId: Slice8PackCaseReport['caseId'];
    readonly analysis: ModerationAnalysisContextV1;
  }> = [
    {
      caseId: 'reference-full',
      analysis: analysisFromPromptFixture(MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1, locale),
    },
    {
      caseId: 'reference-metadata-only',
      analysis: analysisFromPromptFixture(MODERATION_PROMPT_CONTEXT_METADATA_FIXTURE_V1, locale),
    },
    {
      caseId: 'large-corpus-8k',
      analysis: buildLargeSlice8SyntheticAnalysis(locale),
    },
  ];

  return definitions.map(({ caseId, analysis }) => {
    const durationsMs: number[] = [];
    const wireHashes = new Set<string>();
    const snapshotHashes = new Set<string>();
    let latestPrepared = prepareModerationSummaryContextFromAnalysis({
      analysis,
      plan: fullContextPlan(),
      packedAt: FIXED_PACKED_AT,
    });

    for (let i = 0; i < PACK_BENCHMARK_ITERATIONS; i += 1) {
      const start = performance.now();
      const prepared = prepareModerationSummaryContextFromAnalysis({
        analysis,
        plan: fullContextPlan(),
        packedAt: FIXED_PACKED_AT,
      });
      const wireUser = projectCompactSummaryWireContext(prepared.request);
      durationsMs.push(Number((performance.now() - start).toFixed(3)));
      wireHashes.add(sha256Hex(wireUser));
      snapshotHashes.add(prepared.request.promptContext.snapshotHash);
      latestPrepared = prepared;
    }

    const { promptContext, instructionText, definitionText } = latestPrepared.request;
    const canonicalContext = canonicalModerationPromptJson(promptContext.context);
    const compactWireUser = projectCompactSummaryWireContext(latestPrepared.request);
    const canonicalBytes = Buffer.byteLength(canonicalContext, 'utf8');
    const compactBytes = Buffer.byteLength(compactWireUser, 'utf8');
    const includedQaSources = countIncludedQaQuestionSources(promptContext);
    const referenceOnlyQaSources = promptContext.context.sources.filter(
      (s) => s.kind === 'qa-question' && s.content.state === 'reference-only',
    ).length;

    return {
      caseId,
      locale,
      snapshotHash: promptContext.snapshotHash,
      canonicalContextSha256: sha256Hex(canonicalContext),
      compactWireUserSha256: sha256Hex(compactWireUser),
      instructionSha256: sha256Hex(instructionText),
      definitionSha256: sha256Hex(definitionText),
      budget: promptContext.budget,
      wire: {
        canonicalContextUtf8Bytes: canonicalBytes,
        compactUserUtf8Bytes: compactBytes,
        estimatedDataToCompactWireRatio:
          compactBytes > 0
            ? Number((promptContext.budget.dataTokens / compactBytes).toFixed(2))
            : 0,
      },
      coverage: {
        analyzedQuestions:
          promptContext.context.questions.state === 'available'
            ? promptContext.context.questions.corpus.analyzed
            : 0,
        representedQuestions:
          promptContext.context.questions.state === 'available'
            ? promptContext.context.questions.corpus.represented
            : 0,
        includedQaSources,
        referenceOnlyQaSources,
        topicsState: promptContext.context.topics.state,
        packedTopics:
          promptContext.context.topics.state === 'available'
            ? promptContext.context.topics.items.length
            : 0,
        compassState: promptContext.context.compass.state,
        packedSignals:
          promptContext.context.compass.state === 'available'
            ? promptContext.context.compass.signals.length
            : 0,
        learningObjectives:
          promptContext.context.learningContext.state === 'available'
            ? promptContext.context.learningContext.objectives.length
            : 0,
        totalSources: promptContext.context.sources.length,
      },
      packerMedianMs: median(durationsMs),
      deterministicBitIdentical: wireHashes.size === 1 && snapshotHashes.size === 1,
    };
  });
}

export function assertSecretFreeSlice8Report(
  serializedReport: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const candidateSecrets = [
    env['OPEN_WEIGHT_LLM_TOKEN'],
    env['QA_SUMMARY_INFERENCE_TOKEN'],
    env['ADMIN_API_TOKEN'],
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length >= 8));

  for (const secret of candidateSecrets) {
    if (serializedReport.includes(secret)) {
      throw new Error('Refusing to emit Slice-8 evaluation report containing a configured secret.');
    }
  }
}

export async function runSlice8SummaryEvaluation(options: {
  readonly mode: Slice8EvalMode;
  readonly locale?: AppLocale;
  readonly liveRuns?: number;
  readonly runner?: typeof runOpenWeightLlmSummaryV2;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<Slice8SummaryEvaluationReport> {
  const locale = options.locale ?? 'de';
  const packCases = evaluateSlice8PackCases(locale);

  if (options.mode === 'pack-only') {
    const report: Slice8SummaryEvaluationReport = {
      schemaVersion: 1,
      mode: 'pack-only',
      generatedAt: FIXED_PACKED_AT.toISOString(),
      modelIdentity: {
        alias: OPEN_WEIGHT_LLM_MODEL_ALIAS,
        modelId: OPEN_WEIGHT_LLM_MODEL_ID,
        modelVersion: OPEN_WEIGHT_LLM_MODEL_VERSION,
        packingProfile: QA_SUMMARY_MODERATION_PACKING_PROFILE.modelProfile,
        contextWindowTokens: QA_SUMMARY_MODERATION_PACKING_PROFILE.contextWindowTokens,
        reservedOutputTokens: QA_SUMMARY_MODERATION_PACKING_PROFILE.reservedOutputTokens,
        safetyMarginTokens: QA_SUMMARY_MODERATION_PACKING_PROFILE.safetyMarginTokens,
      },
      packCases,
      liveCases: null,
    };
    assertSecretFreeSlice8Report(JSON.stringify(report), options.env);
    return report;
  }

  const runner = options.runner ?? runOpenWeightLlmSummaryV2;
  const runCount = Math.max(1, options.liveRuns ?? LIVE_DETERMINISM_RUNS);
  const analysesByCase: Readonly<
    Record<Slice8PackCaseReport['caseId'], ModerationAnalysisContextV1>
  > = {
    'reference-full': analysisFromPromptFixture(
      MODERATION_PROMPT_CONTEXT_REFERENCE_FIXTURE_V1,
      locale,
    ),
    'reference-metadata-only': analysisFromPromptFixture(
      MODERATION_PROMPT_CONTEXT_METADATA_FIXTURE_V1,
      locale,
    ),
    'large-corpus-8k': buildLargeSlice8SyntheticAnalysis(locale),
  };

  const liveCases: Slice8LiveCaseReport[] = [];
  for (const packCase of packCases) {
    const prepared = prepareModerationSummaryContextFromAnalysis({
      analysis: analysesByCase[packCase.caseId],
      plan: fullContextPlan(),
      packedAt: FIXED_PACKED_AT,
    });
    const groundingTextsById = buildSummaryGroundingTextsBySourceId(prepared.request.promptContext);
    const includedQaTextsById = buildIncludedQaQuestionTextsBySourceId(
      prepared.request.promptContext,
    );
    const passes: Slice8LivePassMetrics[] = [];

    for (let pass = 1; pass <= runCount; pass += 1) {
      const res = await runner(prepared.request, {
        signal: AbortSignal.timeout(OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_DEFAULT_MS),
      });
      if (res.status !== 'completed') {
        passes.push({
          pass,
          status: res.status,
          elapsedMs: null,
          promptTokens: null,
          completionTokens: null,
          conservativeToRealPromptTokenRatio: null,
          finishReason: null,
          timings: null,
          qualityAccepted: false,
          statementCount: 0,
          citedSourceIds: [],
          outputSha256: null,
        });
        continue;
      }

      const reconciled = reconcileTopicSiblingQaCitations(
        res.output.output,
        prepared.request.promptContext,
      );
      const qualityAccepted =
        reconciled.status !== 'failed' &&
        hasAcceptableQaSummaryQuality(reconciled, locale, {
          minimumStatements: 1,
          sourceTextsById: groundingTextsById,
          includedQaTextsById,
        });
      const promptTokens = res.telemetry.promptTokens;
      const citedSourceIds = [
        ...new Set(reconciled.statements.flatMap((statement) => statement.sourceIds)),
      ];
      passes.push({
        pass,
        status: res.status,
        elapsedMs: res.telemetry.elapsedMs,
        promptTokens,
        completionTokens: res.telemetry.completionTokens,
        conservativeToRealPromptTokenRatio:
          promptTokens && promptTokens > 0
            ? Number((packCase.budget.packedInputTokens / promptTokens).toFixed(2))
            : null,
        finishReason: res.telemetry.finishReason ?? null,
        timings: res.telemetry.timings ?? null,
        qualityAccepted,
        statementCount: reconciled.statements.length,
        citedSourceIds,
        outputSha256: sha256Hex(JSON.stringify(reconciled)),
      });
    }

    const outputHashes = new Set(passes.map((p) => p.outputSha256).filter(Boolean));
    const elapsedValues = passes
      .map((p) => p.elapsedMs)
      .filter((v): v is number => typeof v === 'number');
    const promptMsValues = passes
      .map((p) => p.timings?.promptMs ?? null)
      .filter((v): v is number => typeof v === 'number');
    const promptRateValues = passes
      .map((p) => p.timings?.promptPerSecond ?? null)
      .filter((v): v is number => typeof v === 'number');

    liveCases.push({
      caseId: packCase.caseId,
      runs: passes,
      allCompletedAndAccepted: passes.every((p) => p.status === 'completed' && p.qualityAccepted),
      deterministicOutputAcrossRuns:
        passes.every((p) => p.status === 'completed') && outputHashes.size === 1,
      medianElapsedMs: elapsedValues.length > 0 ? median(elapsedValues) : null,
      medianPromptMs: promptMsValues.length > 0 ? median(promptMsValues) : null,
      medianPromptPerSecond: promptRateValues.length > 0 ? median(promptRateValues) : null,
    });
  }

  const report: Slice8SummaryEvaluationReport = {
    schemaVersion: 1,
    mode: 'live',
    generatedAt: new Date().toISOString(),
    modelIdentity: {
      alias: OPEN_WEIGHT_LLM_MODEL_ALIAS,
      modelId: OPEN_WEIGHT_LLM_MODEL_ID,
      modelVersion: OPEN_WEIGHT_LLM_MODEL_VERSION,
      packingProfile: QA_SUMMARY_MODERATION_PACKING_PROFILE.modelProfile,
      contextWindowTokens: QA_SUMMARY_MODERATION_PACKING_PROFILE.contextWindowTokens,
      reservedOutputTokens: QA_SUMMARY_MODERATION_PACKING_PROFILE.reservedOutputTokens,
      safetyMarginTokens: QA_SUMMARY_MODERATION_PACKING_PROFILE.safetyMarginTokens,
    },
    packCases,
    liveCases,
  };
  assertSecretFreeSlice8Report(JSON.stringify(report), options.env);
  return report;
}

export function parseSlice8CliMode(argv: readonly string[]): Slice8EvalMode {
  const hasPackOnly = argv.includes('--pack-only');
  const hasLive = argv.includes('--live');
  if (hasPackOnly && hasLive) {
    throw new Error('Choose either --pack-only or --live, not both.');
  }
  if (hasLive) return 'live';
  return 'pack-only';
}

async function main(): Promise<void> {
  const mode = parseSlice8CliMode(process.argv.slice(2));
  const report = await runSlice8SummaryEvaluation({ mode });
  const serialized = JSON.stringify(report, null, 2);
  assertSecretFreeSlice8Report(serialized, process.env);
  process.stdout.write(`${serialized}\n`);
  if (mode === 'live' && report.liveCases?.some((item) => !item.allCompletedAndAccepted)) {
    process.exitCode = 1;
  }
}

const executedPath = process.argv[1] ? path.basename(process.argv[1]) : '';
if (executedPath === 'eval-issue-456-slice8-summary.ts') {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
