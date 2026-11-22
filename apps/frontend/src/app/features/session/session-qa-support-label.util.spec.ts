import { formatQaSupportLabel } from './session-qa-support-label.util';

describe('formatQaSupportLabel', () => {
  it.each([
    [1, 0, '100\u00a0% dafür · 1 Stimme'],
    [0, 1, '0\u00a0% dafür · 1 Stimme'],
    [2, 1, '66,7\u00a0% dafür · 3 Stimmen'],
    [0, 0, 'Noch keine Stimmen'],
  ])('formats %i votes in favor and %i against', (positiveVoteCount, negativeVoteCount, label) => {
    expect(formatQaSupportLabel({ positiveVoteCount, negativeVoteCount }, 'de')).toBe(label);
  });

  it('omits the label when the vote breakdown is unavailable', () => {
    expect(formatQaSupportLabel({ positiveVoteCount: 1 }, 'de')).toBeNull();
  });
});
