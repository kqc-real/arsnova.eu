import { describe, expect, it } from 'vitest';
import { buildQaRankingMetricOrderSql, buildQaRankingScoreSelectSql } from './qaRankingSql';

function flattenSql(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenSql).join('');
  if (value && typeof value === 'object') return flattenSql(Object.values(value));
  return String(value ?? '');
}

describe('qaRankingSql', () => {
  it('uses the persisted directional counters for both scores and a fixed controversy denominator', () => {
    const projection = buildQaRankingScoreSelectSql();
    const sql = flattenSql(projection);

    expect(sql).toContain('question."positiveVoteCount"');
    expect(sql).toContain('question."negativeVoteCount"');
    expect(sql).toContain('END AS "bestScore"');
    expect(sql).toContain('AS "controversyScore"');
    expect(projection.values).toContain(4);
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
