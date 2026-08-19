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

export type QaSummarySnapshotCandidateStatus =
  'PENDING' | 'ACTIVE' | 'PINNED' | 'ARCHIVED' | 'DELETED';

export type QaSummarySnapshotCandidateNlpStatus =
  'PENDING' | 'CLASSIFIED' | 'UNCERTAIN' | 'DISABLED' | 'FAILED';

export type QaSummarySnapshotCandidate = {
  readonly id: string;
  readonly text: string;
  readonly status: QaSummarySnapshotCandidateStatus;
  readonly upvoteCount: number;
  readonly createdAt: Date;
  readonly nlpStatus?: QaSummarySnapshotCandidateNlpStatus | null;
};

function statusRank(status: QaSummarySnapshotCandidateStatus): number {
  if (status === 'PINNED') return 3;
  if (status === 'PENDING') return 2;
  if (status === 'ACTIVE') return 1;
  return 0;
}

function nlpRank(status: QaSummarySnapshotCandidateNlpStatus | null | undefined): number {
  if (status === 'CLASSIFIED') return 2;
  if (status === 'UNCERTAIN') return 1;
  return 0;
}

export function qaSummaryDedupeKey(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/[''`´‘’‚‛“”„‟«»]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareQaSummarySnapshotCandidates(
  left: QaSummarySnapshotCandidate,
  right: QaSummarySnapshotCandidate,
): number {
  const status = statusRank(right.status) - statusRank(left.status);
  if (status !== 0) return status;
  if (right.upvoteCount !== left.upvoteCount) return right.upvoteCount - left.upvoteCount;
  const nlp = nlpRank(right.nlpStatus) - nlpRank(left.nlpStatus);
  if (nlp !== 0) return nlp;
  const created = left.createdAt.getTime() - right.createdAt.getTime();
  if (created !== 0) return created;
  return left.id.localeCompare(right.id);
}

/**
 * Wählt die Snapshot-Quellen: PINNED/PENDING vor reinem Upvote, Near-Duplicates
 * auf eine kanonische Frage, 8.9b nur als Tie-Break. Das LLM sieht weiter nur
 * `{ id, kind, text }` — Status und NLP bleiben intern.
 */
export function selectQaSummarySnapshotQuestions(
  candidates: readonly QaSummarySnapshotCandidate[],
  maxSources: number,
): QaSummarySnapshotQuestion[] {
  const canonicalByKey = new Map<string, QaSummarySnapshotCandidate>();
  for (const candidate of candidates) {
    const trimmed = candidate.text.trim();
    if (!trimmed) continue;
    const normalized = qaSummaryDedupeKey(trimmed);
    const key = normalized.length > 0 ? normalized : `id:${candidate.id}`;
    const current = canonicalByKey.get(key);
    if (!current || compareQaSummarySnapshotCandidates(candidate, current) < 0) {
      canonicalByKey.set(key, candidate);
    }
  }
  return [...canonicalByKey.values()]
    .sort(compareQaSummarySnapshotCandidates)
    .slice(0, Math.max(0, maxSources))
    .map((candidate) => ({ id: candidate.id, text: candidate.text }));
}

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
