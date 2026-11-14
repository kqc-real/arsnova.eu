/** Assign shared places by score to an already sorted leaderboard before taking a page. */
export function withPresenterPlaces<T extends { totalScore: number }>(entries: readonly T[]) {
  let place = 0;
  return entries.map((entry, index) => {
    if (index === 0 || entry.totalScore !== entries[index - 1].totalScore) {
      place = index + 1;
    }
    return { ...entry, place };
  });
}

export function leaderboardHasPoints(entries: readonly { totalScore: number }[]): boolean {
  return entries.some((entry) => entry.totalScore > 0);
}
