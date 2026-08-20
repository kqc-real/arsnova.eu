import { describe, expect, it } from 'vitest';
import { getGeneratedNicknameFallbackList, NICKNAME_LISTS } from './nickname-themes';

describe('getGeneratedNicknameFallbackList', () => {
  it('schneidet lange Kita-Bases nicht mitten im Wort', () => {
    const longBases = NICKNAME_LISTS.KINDERGARTEN.filter((name) => `${name} 2`.length > 30);
    expect(longBases).toContain('Mahagonifarbener Wasserbüffel');

    const generated = getGeneratedNicknameFallbackList('KINDERGARTEN', 'de', new Set(), 200);

    expect(generated).toContain('Roter Drache 2');
    expect(generated).not.toContain('Mahagonifarbener Wasserbüffe 2');
    for (const base of longBases) {
      expect(generated.some((name) => name.startsWith(`${base.slice(0, -1)} `))).toBe(false);
    }
    expect(generated.every((name) => name.length <= 30)).toBe(true);
  });
});
