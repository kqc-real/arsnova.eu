import {
  QA_SUMMARY_RESULT_V2_CONTRACT_VERSION,
  QA_SUMMARY_V2_SCHEMA_VERSION,
  QaSummaryResultV2Schema,
  sortQaSummaryStatementsByImportance,
  type QaSummaryExecutionV2,
  type QaSummaryModelOutputV2,
  type QaSummaryResultV2,
  type QaSummaryStatementV2,
} from '@arsnova/shared-types';
import type { PreparedModerationSummaryContext } from './moderationSummaryContext';

export const DROPPED_UNSOURCED_QA_SUMMARY_LIMITATION =
  'Aussagen ohne belegte Quelle wurden entfernt.';
const DROPPED_UNSOURCED_LIMITATION = DROPPED_UNSOURCED_QA_SUMMARY_LIMITATION;

function truncateCodeUnits(text: string, maxLength: number): string {
  let result = '';
  for (const point of text.trim()) {
    if (result.length + point.length > maxLength) break;
    result += point;
  }
  return result;
}

function bindStatement(
  statement: QaSummaryStatementV2,
  allowedSourceIds: ReadonlySet<string>,
): QaSummaryStatementV2 | null {
  const sourceIds = [
    ...new Set(statement.sourceIds.filter((sourceId) => allowedSourceIds.has(sourceId))),
  ].slice(0, 8);
  const text = truncateCodeUnits(statement.text, 400);
  return text.length > 0 && sourceIds.length > 0 ? { text, sourceIds } : null;
}

function uniqueLimitations(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = truncateCodeUnits(value, 280);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= 6) break;
  }
  return result;
}

export function bindQaSummaryModelOutputV2(input: {
  readonly output: QaSummaryModelOutputV2;
  readonly prepared: PreparedModerationSummaryContext;
  readonly execution: QaSummaryExecutionV2;
  readonly analyzedAt: string;
}): QaSummaryResultV2 {
  const context = input.prepared.request.promptContext;
  const rankedSourceIds = context.context.sources.map((source) => source.id);
  const allowedSourceIds = new Set(rankedSourceIds);
  const statements = sortQaSummaryStatementsByImportance(
    input.output.statements
      .map((statement) => bindStatement(statement, allowedSourceIds))
      .filter((statement): statement is QaSummaryStatementV2 => statement !== null),
    rankedSourceIds,
  ).slice(0, 6);
  const suggestedNextSteps = input.output.suggestedNextSteps
    .map((statement) => bindStatement(statement, allowedSourceIds))
    .filter((statement): statement is QaSummaryStatementV2 => statement !== null)
    .slice(0, 4);
  const dropped =
    input.output.statements.length -
    statements.length +
    (input.output.suggestedNextSteps.length - suggestedNextSteps.length);
  const limitations = uniqueLimitations([
    ...input.output.limitations,
    ...(dropped > 0 ? [DROPPED_UNSOURCED_LIMITATION] : []),
  ]);

  if (input.output.status === 'failed') {
    return QaSummaryResultV2Schema.parse({
      schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
      contractVersion: QA_SUMMARY_RESULT_V2_CONTRACT_VERSION,
      status: 'failed',
      statements: [],
      suggestedNextSteps: [],
      limitations:
        limitations.length > 0 ? limitations : ['Die Zusammenfassung ist gerade nicht verfügbar.'],
      sources: [],
      modelVersion: input.output.modelVersion,
      analyzedAt: input.analyzedAt,
      snapshotHash: context.snapshotHash,
      locale: context.context.locale,
      execution: input.execution,
    });
  }

  const usedSourceIds = new Set(
    [...statements, ...suggestedNextSteps].flatMap((statement) => statement.sourceIds),
  );
  const sources = context.context.sources
    .filter((source) => usedSourceIds.has(source.id))
    .map((source) => ({
      id: source.id,
      kind: source.kind,
      label: input.prepared.presentationLabels.get(source.id) ?? source.id,
    }));
  const status = statements.length === 0 ? 'uncertain' : 'ready';

  return QaSummaryResultV2Schema.parse({
    schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
    contractVersion: QA_SUMMARY_RESULT_V2_CONTRACT_VERSION,
    status,
    statements,
    suggestedNextSteps,
    limitations:
      status === 'uncertain' && limitations.length === 0
        ? ['Die Zusammenfassung ist unsicher.']
        : limitations,
    sources,
    modelVersion: input.output.modelVersion,
    analyzedAt: input.analyzedAt,
    snapshotHash: context.snapshotHash,
    locale: context.context.locale,
    execution: input.execution,
  });
}

export function createPendingQaSummaryResultV2(
  prepared: PreparedModerationSummaryContext,
): QaSummaryResultV2 {
  const context = prepared.request.promptContext;
  return QaSummaryResultV2Schema.parse({
    schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
    contractVersion: QA_SUMMARY_RESULT_V2_CONTRACT_VERSION,
    status: 'pending',
    statements: [],
    suggestedNextSteps: [],
    limitations: [],
    sources: [],
    snapshotHash: context.snapshotHash,
    locale: context.context.locale,
    execution: { attemptedMode: null, effectiveMode: null, fallback: null },
  });
}
