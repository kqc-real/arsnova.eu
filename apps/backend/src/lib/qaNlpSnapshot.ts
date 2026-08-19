/**
 * Minimierter Snapshot fuer die Q&A-NLP-Kaskade (Story 8.9b / ADR-0032).
 * Der Analyse-Input enthaelt nur den Fragetext, keine Identifikatoren.
 */
export const QA_NLP_SNAPSHOT_MAX_TEXT_CHARS = 500;

export type QaNlpAnalysisSnapshot = {
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
  'id',
] as const;

export function buildQaNlpAnalysisSnapshot(text: string): QaNlpAnalysisSnapshot {
  return { text: text.trim().slice(0, QA_NLP_SNAPSHOT_MAX_TEXT_CHARS) };
}

export function listForbiddenQaNlpSnapshotKeys(value: object): string[] {
  return Object.keys(value).filter((key) =>
    FORBIDDEN_SNAPSHOT_KEYS.includes(key as (typeof FORBIDDEN_SNAPSHOT_KEYS)[number]),
  );
}

export function assertQaNlpSnapshotMinimized(snapshot: QaNlpAnalysisSnapshot): void {
  const keys = Object.keys(snapshot);
  if (keys.length !== 1 || keys[0] !== 'text') {
    throw new Error('Q&A-NLP-Snapshot darf nur das Feld text enthalten');
  }
  if (listForbiddenQaNlpSnapshotKeys(snapshot).length > 0) {
    throw new Error('Q&A-NLP-Snapshot enthaelt verbotene Identifikatoren');
  }
}
