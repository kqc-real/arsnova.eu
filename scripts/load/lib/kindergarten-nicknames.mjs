import { KINDERGARTEN_NICKNAMES } from '@arsnova/shared-types';

/**
 * @param {number} index
 * @param {string} [locale='de']
 */
export function kindergartenNickname(index, locale = 'de') {
  const lang = String(locale || 'de')
    .trim()
    .slice(0, 2)
    .toLowerCase();
  const list = KINDERGARTEN_NICKNAMES[lang] ?? KINDERGARTEN_NICKNAMES.de;
  const base = list[index % list.length];
  const cycle = Math.floor(index / list.length);
  return cycle === 0 ? base : `${base} ${cycle + 1}`;
}
