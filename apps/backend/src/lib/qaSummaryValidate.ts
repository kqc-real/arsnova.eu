import type {
  QaSummaryModelOutput,
  QaSummaryResult,
  QaSummaryStatement,
} from '@arsnova/shared-types';
import { qaSummarySourceLabel, type QaSummaryAnalysisSnapshot } from './qaSummarySnapshot';

const DROPPED_UNSOURCED_LIMITATION = 'Aussagen ohne belegte Quelle wurden entfernt.';

function bindStatement(
  statement: QaSummaryStatement,
  allowedSourceIds: ReadonlySet<string>,
): QaSummaryStatement | null {
  const sourceIds = [
    ...new Set(statement.sourceIds.filter((sourceId) => allowedSourceIds.has(sourceId))),
  ].slice(0, 8);
  const text = statement.text.trim().slice(0, 400);
  if (!text || sourceIds.length === 0) {
    return null;
  }
  return { text, sourceIds };
}

function uniqueLimitations(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value.trim().slice(0, 280);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    result.push(text);
    if (result.length >= 6) {
      break;
    }
  }
  return result;
}

export function bindQaSummaryModelOutput(input: {
  readonly output: QaSummaryModelOutput;
  readonly snapshot: QaSummaryAnalysisSnapshot;
  readonly snapshotHash: string;
  readonly analyzedAt: string;
}): QaSummaryResult {
  const allowedSourceIds = new Set(input.snapshot.sources.map((source) => source.id));
  const statements = input.output.statements
    .map((statement) => bindStatement(statement, allowedSourceIds))
    .filter((statement): statement is QaSummaryStatement => statement !== null)
    .slice(0, 6);
  const suggestedNextSteps = input.output.suggestedNextSteps
    .map((statement) => bindStatement(statement, allowedSourceIds))
    .filter((statement): statement is QaSummaryStatement => statement !== null)
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
    return {
      status: 'failed',
      statements: [],
      suggestedNextSteps: [],
      limitations:
        limitations.length > 0 ? limitations : ['Die Zusammenfassung ist gerade nicht verfügbar.'],
      sources: [],
      modelVersion: input.output.modelVersion,
      analyzedAt: input.analyzedAt,
      snapshotHash: input.snapshotHash,
      locale: input.snapshot.locale,
    };
  }

  const usedSourceIds = new Set<string>();
  for (const statement of statements) {
    for (const sourceId of statement.sourceIds) {
      usedSourceIds.add(sourceId);
    }
  }
  for (const statement of suggestedNextSteps) {
    for (const sourceId of statement.sourceIds) {
      usedSourceIds.add(sourceId);
    }
  }

  const sources = input.snapshot.sources
    .filter((source) => usedSourceIds.has(source.id))
    .map((source) => ({
      id: source.id,
      kind: source.kind,
      label: qaSummarySourceLabel(source.text),
    }));

  const status =
    input.output.status === 'ready' && statements.length === 0 ? 'uncertain' : input.output.status;

  return {
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
    snapshotHash: input.snapshotHash,
    locale: input.snapshot.locale,
  };
}

export function createPendingQaSummaryResult(input: {
  readonly snapshot: QaSummaryAnalysisSnapshot;
  readonly snapshotHash: string;
}): QaSummaryResult {
  return {
    status: 'pending',
    statements: [],
    suggestedNextSteps: [],
    limitations: [],
    sources: input.snapshot.sources.map((source) => ({
      id: source.id,
      kind: source.kind,
      label: qaSummarySourceLabel(source.text),
    })),
    snapshotHash: input.snapshotHash,
    locale: input.snapshot.locale,
  };
}

export function createFailedQaSummaryResult(input: {
  readonly snapshot: QaSummaryAnalysisSnapshot;
  readonly snapshotHash: string;
  readonly analyzedAt: string;
  readonly reason: string;
  readonly modelVersion?: string;
}): QaSummaryResult {
  return {
    status: 'failed',
    statements: [],
    suggestedNextSteps: [],
    limitations: [input.reason],
    sources: [],
    modelVersion: input.modelVersion,
    analyzedAt: input.analyzedAt,
    snapshotHash: input.snapshotHash,
    locale: input.snapshot.locale,
  };
}

export function createUncertainQaSummaryResult(input: {
  readonly snapshot: QaSummaryAnalysisSnapshot;
  readonly snapshotHash: string;
  readonly analyzedAt: string;
  readonly limitation: string;
}): QaSummaryResult {
  return {
    status: 'uncertain',
    statements: [],
    suggestedNextSteps: [],
    limitations: [input.limitation],
    sources: [],
    analyzedAt: input.analyzedAt,
    snapshotHash: input.snapshotHash,
    locale: input.snapshot.locale,
  };
}
