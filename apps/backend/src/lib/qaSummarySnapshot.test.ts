import { describe, expect, it } from 'vitest';
import { qaSummaryQuestionSourceId } from '@arsnova/shared-types';
import {
  assertQaSummarySnapshotMinimized,
  buildQaSummaryAnalysisSnapshot,
  hashQaSummarySnapshot,
  listForbiddenQaSummarySnapshotKeys,
  qaSummaryDedupeKey,
  selectQaSummarySnapshotQuestions,
  type QaSummarySnapshotCandidate,
} from './qaSummarySnapshot';

const QUESTION_ID = '11111111-1111-4111-8111-111111111111';

describe('qaSummarySnapshot', () => {
  it('uebernimmt nur locale und gekuerzte Fragetexte mit Quell-IDs', () => {
    const snapshot = buildQaSummaryAnalysisSnapshot({
      locale: 'de',
      questions: [
        { id: QUESTION_ID, text: `  ${'a'.repeat(600)}  ` },
        { id: '22222222-2222-4222-8222-222222222222', text: '   ' },
      ],
      maxSources: 20,
    });
    expect(Object.keys(snapshot).sort()).toEqual(['locale', 'sources']);
    expect(snapshot.sources).toHaveLength(1);
    expect(snapshot.sources[0]?.id).toBe(qaSummaryQuestionSourceId(QUESTION_ID));
    expect(snapshot.sources[0]?.text).toHaveLength(500);
    assertQaSummarySnapshotMinimized(snapshot);
    expect(hashQaSummarySnapshot(snapshot)).toHaveLength(64);
  });

  it('erkennt verbotene Identifikatoren im Rohobjekt', () => {
    expect(
      listForbiddenQaSummarySnapshotKeys({
        locale: 'de',
        sources: [],
        participantId: '33333333-3333-4333-8333-333333333333',
        nickname: 'Ada',
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      }),
    ).toEqual(['participantId', 'nickname', 'sessionId']);
  });

  it('normalisiert Near-Duplicates fuer die Kanonisierung', () => {
    expect(qaSummaryDedupeKey('  Wann ist die Klausur?? ')).toBe(
      qaSummaryDedupeKey('wann ist die klausur'),
    );
  });

  it('rangiert PINNED und PENDING vor reinem Upvote und behaelt unsichere NLP-Fragen', () => {
    const selected = selectQaSummarySnapshotQuestions(
      [
        candidate({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          text: 'Wann ist die Klausur?',
          status: 'ACTIVE',
          upvoteCount: 80,
          nlpStatus: 'CLASSIFIED',
        }),
        candidate({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          text: 'Bitte Mikrofon lauter.',
          status: 'PENDING',
          upvoteCount: 1,
          nlpStatus: 'UNCERTAIN',
        }),
        candidate({
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          text: 'Kapitel 4 in der Klausur?',
          status: 'PINNED',
          upvoteCount: 0,
          nlpStatus: 'DISABLED',
        }),
      ],
      20,
    );
    expect(selected.map((question) => question.id)).toEqual([
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ]);
  });

  it('bevorzugt CLASSIFIED nur als Tie-Break bei gleichem Status und Upvote', () => {
    const selected = selectQaSummarySnapshotQuestions(
      [
        candidate({
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          text: 'Geht der Beamer?',
          upvoteCount: 4,
          nlpStatus: 'UNCERTAIN',
        }),
        candidate({
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          text: 'Ist WLAN kaputt?',
          upvoteCount: 4,
          nlpStatus: 'CLASSIFIED',
        }),
      ],
      2,
    );
    expect(selected[0]?.id).toBe('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  });

  it('behaelt von Near-Duplicates die hoeher gerankte kanonische Frage', () => {
    const selected = selectQaSummarySnapshotQuestions(
      [
        candidate({
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          text: 'Wann ist die Klausur???',
          upvoteCount: 2,
        }),
        candidate({
          id: '99999999-9999-4999-8999-999999999999',
          text: 'Wann ist die Klausur?',
          upvoteCount: 12,
        }),
      ],
      20,
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe('99999999-9999-4999-8999-999999999999');
  });

  it('laesst Status und NLP nicht in den minimierten Snapshot', () => {
    const questions = selectQaSummarySnapshotQuestions(
      [
        candidate({
          id: QUESTION_ID,
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          status: 'PINNED',
          nlpStatus: 'CLASSIFIED',
        }),
      ],
      20,
    );
    const snapshot = buildQaSummaryAnalysisSnapshot({
      locale: 'de',
      questions,
      maxSources: 20,
    });
    expect(snapshot.sources[0]).toEqual({
      id: qaSummaryQuestionSourceId(QUESTION_ID),
      kind: 'qa-question',
      text: 'Kommt Kapitel 4 in der Klausur vor?',
    });
    assertQaSummarySnapshotMinimized(snapshot);
  });
});

function candidate(
  overrides: Partial<QaSummarySnapshotCandidate> & Pick<QaSummarySnapshotCandidate, 'id' | 'text'>,
): QaSummarySnapshotCandidate {
  return {
    status: 'ACTIVE',
    upvoteCount: 0,
    createdAt: new Date('2026-08-19T10:00:00.000Z'),
    nlpStatus: 'DISABLED',
    ...overrides,
  };
}
