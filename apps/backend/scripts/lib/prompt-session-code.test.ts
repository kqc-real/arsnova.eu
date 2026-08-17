import { describe, expect, it } from 'vitest';
import {
  assertConcreteSessionCode,
  normalizeSessionCode,
  resolveSessionCode,
} from './prompt-session-code';

describe('assertConcreteSessionCode', () => {
  it('lehnt den Platzhalter XXXXXX ab', () => {
    expect(() => assertConcreteSessionCode('XXXXXX')).toThrow(/Platzhalter/);
  });

  it('akzeptiert einen konkreten Code', () => {
    expect(() => assertConcreteSessionCode('FRPRUT')).not.toThrow();
  });
});

describe('resolveSessionCode', () => {
  it('normalisiert Kleinbuchstaben', async () => {
    await expect(resolveSessionCode('frprut')).resolves.toBe('FRPRUT');
  });

  it('erklärt XXXXXX als Platzhalter statt als fehlende Session', async () => {
    await expect(resolveSessionCode('XXXXXX')).rejects.toThrow(/Platzhalter/);
  });

  it('lehnt zu kurze Codes ab', async () => {
    await expect(resolveSessionCode('ABC')).rejects.toThrow(/Ungültiger Session-Code/);
  });
});

describe('normalizeSessionCode', () => {
  it('entfernt Leerzeichen', () => {
    expect(normalizeSessionCode(' fr prut ')).toBe('FRPRUT');
  });
});
