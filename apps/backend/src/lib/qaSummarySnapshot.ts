import { createHash } from 'node:crypto';
import type { AppLocale } from '@arsnova/shared-types';
import { qaSummaryQuestionSourceId } from '@arsnova/shared-types';

export const QA_SUMMARY_SNAPSHOT_MAX_TEXT_CHARS = 500;
export const QA_SUMMARY_SOURCE_LABEL_MAX_CHARS = 80;

export type QaSummarySnapshotSource = {
  readonly id: string;
  readonly kind: 'qa-question';
  readonly text: string;
};

export type QaSummaryAnalysisSnapshot = {
  readonly locale: AppLocale;
  readonly sources: readonly QaSummarySnapshotSource[];
};

export type QaSummarySnapshotQuestion = {
  readonly id: string;
  readonly text: string;
};

const FORBIDDEN_SNAPSHOT_KEYS = [
  'token',
  'hostToken',
  'adminToken',
  'ip',
  'ipAddress',
  'participantId',
  'participant',
  'nickname',
  'authorNickname',
  'sessionId',
  'questionId',
] as const;

export function qaSummarySourceLabel(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return 'Frage';
  }
  if (trimmed.length <= QA_SUMMARY_SOURCE_LABEL_MAX_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, QA_SUMMARY_SOURCE_LABEL_MAX_CHARS - 1).trimEnd()}…`;
}

export function buildQaSummaryAnalysisSnapshot(input: {
  readonly locale: AppLocale;
  readonly questions: readonly QaSummarySnapshotQuestion[];
  readonly maxSources: number;
  readonly maxTextChars?: number;
}): QaSummaryAnalysisSnapshot {
  const maxTextChars = input.maxTextChars ?? QA_SUMMARY_SNAPSHOT_MAX_TEXT_CHARS;
  const sources: QaSummarySnapshotSource[] = [];
  for (const question of input.questions) {
    if (sources.length >= input.maxSources) {
      break;
    }
    const text = question.text.trim().slice(0, maxTextChars);
    if (!text) {
      continue;
    }
    sources.push({
      id: qaSummaryQuestionSourceId(question.id),
      kind: 'qa-question',
      text,
    });
  }
  return {
    locale: input.locale,
    sources,
  };
}

export function hashQaSummarySnapshot(snapshot: QaSummaryAnalysisSnapshot): string {
  const canonical = JSON.stringify({
    locale: snapshot.locale,
    sources: snapshot.sources.map((source) => ({
      id: source.id,
      kind: source.kind,
      text: source.text,
    })),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function listForbiddenQaSummarySnapshotKeys(value: object): string[] {
  const keys = new Set<string>();
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_SNAPSHOT_KEYS.includes(key as (typeof FORBIDDEN_SNAPSHOT_KEYS)[number])) {
      keys.add(key);
    }
  }
  if ('sources' in value && Array.isArray(value.sources)) {
    for (const source of value.sources) {
      if (!source || typeof source !== 'object') {
        continue;
      }
      for (const key of Object.keys(source)) {
        if (FORBIDDEN_SNAPSHOT_KEYS.includes(key as (typeof FORBIDDEN_SNAPSHOT_KEYS)[number])) {
          keys.add(key);
        }
      }
    }
  }
  return [...keys];
}

export function assertQaSummarySnapshotMinimized(snapshot: QaSummaryAnalysisSnapshot): void {
  const keys = Object.keys(snapshot).sort();
  if (keys.length !== 2 || keys[0] !== 'locale' || keys[1] !== 'sources') {
    throw new Error('Q&A-Summary-Snapshot darf nur locale und sources enthalten');
  }
  if (listForbiddenQaSummarySnapshotKeys(snapshot).length > 0) {
    throw new Error('Q&A-Summary-Snapshot enthaelt verbotene Identifikatoren');
  }
  for (const source of snapshot.sources) {
    const sourceKeys = Object.keys(source).sort();
    if (
      sourceKeys.length !== 3 ||
      sourceKeys[0] !== 'id' ||
      sourceKeys[1] !== 'kind' ||
      sourceKeys[2] !== 'text'
    ) {
      throw new Error('Q&A-Summary-Quelle darf nur id, kind und text enthalten');
    }
  }
}
