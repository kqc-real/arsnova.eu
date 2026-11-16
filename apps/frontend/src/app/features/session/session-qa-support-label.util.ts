import type { QaQuestionDTO } from '@arsnova/shared-types';
import { formatLocaleCount } from '../../core/locale-number.util';

export function formatQaSupportLabel(
  {
    positiveVoteCount,
    negativeVoteCount,
  }: Pick<QaQuestionDTO, 'positiveVoteCount' | 'negativeVoteCount'>,
  locale: string,
): string | null {
  if (positiveVoteCount === undefined || negativeVoteCount === undefined) {
    return null;
  }

  const total = positiveVoteCount + negativeVoteCount;
  if (total === 0) {
    return $localize`:@@sessionQa.supportNoVotes:Noch keine Stimmen`;
  }

  const share = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(positiveVoteCount / total);
  if (total === 1) {
    return $localize`:@@sessionQa.supportOneVote:${share}:share: dafür · 1 Stimme`;
  }

  const count = formatLocaleCount(total, locale);
  return $localize`:@@sessionQa.supportManyVotes:${share}:share: dafür · ${count}:count: Stimmen`;
}
