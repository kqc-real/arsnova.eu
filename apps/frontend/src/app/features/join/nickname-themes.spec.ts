import { describe, expect, it } from 'vitest';
import {
  areOriginalNicknamesExhausted,
  getGeneratedNicknameFallbackList,
  getNicknameList,
} from './nickname-themes';

describe('getGeneratedNicknameFallbackList', () => {
  it('verwendet nach ausgeschöpfter Tiernamenliste eindeutige, vollständige Reservenamen', () => {
    const names = getNicknameList('KINDERGARTEN', 'de');
    const taken = new Set([...names, 'Schwan 2'].map((name) => name.toLowerCase()));

    expect(areOriginalNicknamesExhausted('KINDERGARTEN', 'de', taken)).toBe(true);
    const generated = getGeneratedNicknameFallbackList('KINDERGARTEN', 'de', taken, 500);

    expect(generated).toHaveLength(500);
    expect(new Set(generated).size).toBe(500);
    expect(generated).toContain('Wasserbüffel 2');
    expect(generated).toContain('Schwan 3');
    expect(generated).not.toContain('Schwan 2');
    expect(generated.every((name) => name.length <= 30)).toBe(true);
  });
});
