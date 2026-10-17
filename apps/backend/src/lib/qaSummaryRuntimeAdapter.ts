import {
  QaSummaryExecutionV2Schema,
  QaSummaryModelOutputV2Schema,
  sortQaSummaryStatementsByImportance,
  type QaSummaryExecutionV2,
  type QaSummaryFallbackReason,
  type QaSummaryModelOutput,
  type QaSummaryModelOutputV2,
  type QaSummaryStatementV2,
} from '@arsnova/shared-types';
import {
  countIncludedQaQuestionSources,
  createQaSummaryFallback,
  type PreparedModerationSummaryContext,
} from './moderationSummaryContext';
import { runOpenWeightLlmSummaryV2 } from './openWeightLlmClient';
import { runQaSummaryLegacyRequest } from './qaSummaryAdapter';
import { createExtractiveQaSummaryOutput } from './qaSummaryExtractive';
import { DROPPED_UNSOURCED_QA_SUMMARY_LIMITATION } from './qaSummaryValidateV2';

export type QaSummaryPreparedRun = Readonly<{
  output: QaSummaryModelOutputV2;
  execution: QaSummaryExecutionV2;
}>;

function bindLegacyStatement(
  statement: QaSummaryModelOutput['statements'][number],
  allowedSourceIds: ReadonlySet<string>,
): QaSummaryStatementV2 | null {
  const sourceIds = [
    ...new Set(statement.sourceIds.filter((sourceId) => allowedSourceIds.has(sourceId))),
  ].slice(0, 8);
  const text = statement.text.trim();
  return text.length > 0 && sourceIds.length > 0 ? { text, sourceIds } : null;
}

function projectLegacyOutputToModelOutputV2(
  legacy: QaSummaryModelOutput,
  prepared: PreparedModerationSummaryContext,
): QaSummaryModelOutputV2 {
  const rankedSourceIds = prepared.request.promptContext.context.sources.map((source) => source.id);
  const allowedSourceIds = new Set(rankedSourceIds);
  const boundStatements = sortQaSummaryStatementsByImportance(
    legacy.statements
      .map((statement) => bindLegacyStatement(statement, allowedSourceIds))
      .filter((statement): statement is QaSummaryStatementV2 => statement !== null),
    rankedSourceIds,
  );
  const boundSuggestedNextSteps = legacy.suggestedNextSteps
    .map((statement) => bindLegacyStatement(statement, allowedSourceIds))
    .filter((statement): statement is QaSummaryStatementV2 => statement !== null);
  const droppedUnsourced =
    legacy.statements.length -
    boundStatements.length +
    (legacy.suggestedNextSteps.length - boundSuggestedNextSteps.length);
  const statements = boundStatements.slice(0, 4);
  const suggestedNextSteps = boundSuggestedNextSteps.slice(0, 2);
  const rawLimitations = legacy.limitations.map((item) => item.trim()).filter(Boolean);
  const limitations =
    droppedUnsourced > 0
      ? [
          ...rawLimitations
            .filter((item) => item !== DROPPED_UNSOURCED_QA_SUMMARY_LIMITATION)
            .slice(0, 1),
          DROPPED_UNSOURCED_QA_SUMMARY_LIMITATION,
        ]
      : rawLimitations.slice(0, 2);
  const status = legacy.status === 'ready' && statements.length === 0 ? 'uncertain' : legacy.status;

  return QaSummaryModelOutputV2Schema.parse({
    ...legacy,
    status,
    statements,
    suggestedNextSteps,
    limitations,
  });
}

function extractiveRun(
  prepared: PreparedModerationSummaryContext,
  input: {
    readonly attemptedMode: QaSummaryExecutionV2['attemptedMode'];
    readonly reason: QaSummaryFallbackReason;
    readonly retry?: 'manual' | 'not-applicable';
  },
): QaSummaryPreparedRun {
  return {
    output: createExtractiveQaSummaryOutput(prepared.request.promptContext),
    execution: QaSummaryExecutionV2Schema.parse({
      attemptedMode: input.attemptedMode,
      effectiveMode: 'extractive',
      fallback: createQaSummaryFallback('extractive', input.reason, input.retry ?? 'manual'),
    }),
  };
}

function legacyFailureReason(modelVersion: string | undefined): QaSummaryFallbackReason {
  if (modelVersion === 'stub:timeout') return 'timeout';
  if (modelVersion === 'stub:unconfigured' || modelVersion === 'stub:saas-blocked') {
    return 'misconfigured';
  }
  if (modelVersion === 'stub:invalid-output' || modelVersion === 'stub:invalid-input') {
    return 'invalid_response';
  }
  return 'unavailable';
}

function packedAnalyzedQuestionCount(prepared: PreparedModerationSummaryContext): number {
  const questions = prepared.request.promptContext.context.questions;
  return questions.state === 'available' ? questions.corpus.analyzed : 0;
}

export async function runPreparedQaSummary(
  prepared: PreparedModerationSummaryContext,
  options: { readonly signal?: AbortSignal } = {},
): Promise<QaSummaryPreparedRun> {
  if (prepared.plan.selectedMode === 'full-context') {
    // Belt-and-suspenders: never call the runtime when the pack has no Q&A evidence.
    if (
      packedAnalyzedQuestionCount(prepared) > 0 &&
      countIncludedQaQuestionSources(prepared.request.promptContext) === 0
    ) {
      return extractiveRun(prepared, {
        attemptedMode: 'full-context',
        reason: 'no_packed_sources',
      });
    }
    const result = await runOpenWeightLlmSummaryV2(prepared.request, options);
    if (result.status === 'completed' && result.output.output.status !== 'failed') {
      return {
        output: result.output.output,
        execution: QaSummaryExecutionV2Schema.parse({
          attemptedMode: 'full-context',
          effectiveMode: 'full-context',
          fallback: null,
        }),
      };
    }
    return extractiveRun(prepared, {
      attemptedMode: 'full-context',
      reason: result.status === 'completed' ? 'invalid_response' : result.status,
    });
  }

  if (prepared.plan.selectedMode === 'legacy-text') {
    const legacy = await runQaSummaryLegacyRequest(prepared.legacyRequest, options);
    if (legacy.status !== 'failed') {
      return {
        output: projectLegacyOutputToModelOutputV2(legacy, prepared),
        execution: QaSummaryExecutionV2Schema.parse({
          attemptedMode: 'legacy-text',
          effectiveMode: 'legacy-text',
          fallback:
            prepared.plan.fallback ??
            createQaSummaryFallback('legacy-text', 'adapter_incompatible'),
        }),
      };
    }
    return extractiveRun(prepared, {
      attemptedMode: 'legacy-text',
      reason: legacyFailureReason(legacy.modelVersion),
    });
  }

  return extractiveRun(prepared, {
    attemptedMode: null,
    reason: prepared.plan.fallback?.reason ?? 'disabled',
    retry: prepared.plan.fallback?.retry,
  });
}
