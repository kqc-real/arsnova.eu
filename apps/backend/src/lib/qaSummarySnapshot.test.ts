import { describe, expect, it } from 'vitest';
import { qaSummaryQuestionSourceId } from '@arsnova/shared-types';
import {
  assertQaSummarySnapshotMinimized,
  buildQaSummaryAnalysisSnapshot,
  hashQaSummarySnapshot,
  listForbiddenQaSummarySnapshotKeys,
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
});
