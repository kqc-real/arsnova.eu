import { describe, expect, it } from 'vitest';
import { buildQaRankingMetricOrderSql, buildQaRankingScoreSelectSql } from './qaRankingSql';

function flattenSql(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenSql).join('');
  if (value && typeof value === 'object') return flattenSql(Object.values(value));
  return String(value ?? '');
}

describe('qaRankingSql', () => {
  it('uses the persisted directional counters for both qa-ranking-v1 scores', () => {
    const sql = flattenSql(buildQaRankingScoreSelectSql(200));

    expect(sql).toContain('question."positiveVoteCount"');
    expect(sql).toContain('question."negativeVoteCount"');
    expect(sql).toContain('END AS "bestScore"');
    expect(sql).toContain('END AS "controversyScore"');
    expect(sql).toContain('20');
  });

  it.each([
    ['TOP', 'ranked."upvoteCount" DESC'],
    ['BEST', 'ranked."bestScore" DESC'],
    ['CONTROVERSIAL', 'ranked."controversyScore" DESC'],
    ['TIME', 'ranked."createdAt" DESC'],
  ] as const)('keeps the established %s metric order', (sortMode, expected) => {
    expect(flattenSql(buildQaRankingMetricOrderSql(sortMode))).toContain(expected);
  });

  it('supports the existing page alias without interpolating arbitrary identifiers', () => {
    const sql = flattenSql(buildQaRankingMetricOrderSql('BEST', 'page'));
    expect(sql).toContain('page."bestScore" DESC');
    expect(sql).not.toContain('ranked.');
  });
});
