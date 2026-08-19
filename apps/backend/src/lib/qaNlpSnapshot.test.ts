import { describe, expect, it } from 'vitest';
import {
  assertQaNlpSnapshotMinimized,
  buildQaNlpAnalysisSnapshot,
  listForbiddenQaNlpSnapshotKeys,
} from './qaNlpSnapshot';

describe('qaNlpSnapshot', () => {
  it('uebernimmt nur den gekuerzten Fragetext', () => {
    const snapshot = buildQaNlpAnalysisSnapshot(`  ${'a'.repeat(600)}  `);
    expect(Object.keys(snapshot)).toEqual(['text']);
    expect(snapshot.text).toHaveLength(500);
    assertQaNlpSnapshotMinimized(snapshot);
  });

  it('erkennt verbotene Identifikatoren im Rohobjekt', () => {
    expect(
      listForbiddenQaNlpSnapshotKeys({
        text: 'Was ist der Median?',
        participantId: '33333333-3333-4333-8333-333333333333',
        nickname: 'Ada',
        ip: '10.0.0.1',
        hostToken: 'secret',
      }),
    ).toEqual(['participantId', 'nickname', 'ip', 'hostToken']);
  });
});
