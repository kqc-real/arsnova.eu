function bestSourceRank(sourceIds: readonly string[], rank: ReadonlyMap<string, number>): number {
  let best = Number.POSITIVE_INFINITY;
  for (const sourceId of sourceIds) {
    const value = rank.get(sourceId);
    if (value !== undefined && value < best) {
      best = value;
    }
  }
  return best;
}

/**
 * Host scan order: snapshot rank first (pinned/pending/upvotes), then more
 * supporting sources, then original model order.
 */
export function sortQaSummaryStatementsByImportance<
  T extends { readonly sourceIds: readonly string[] },
>(statements: readonly T[], rankedSourceIds: readonly string[]): T[] {
  const rank = new Map(rankedSourceIds.map((sourceId, index) => [sourceId, index]));
  return statements
    .map((statement, index) => ({ statement, index }))
    .sort((left, right) => {
      const byRank =
        bestSourceRank(left.statement.sourceIds, rank) -
        bestSourceRank(right.statement.sourceIds, rank);
      if (byRank !== 0) {
        return byRank;
      }
      const byWeight = right.statement.sourceIds.length - left.statement.sourceIds.length;
      if (byWeight !== 0) {
        return byWeight;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.statement);
}
