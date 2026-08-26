import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearHostToken,
  getSessionEntryCommands,
  getHostToken,
  hasHostToken,
  normalizeHostSessionCode,
  setHostToken,
} from './host-session-token';

describe('host-session-token', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearHostToken('ABC123');
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('normalisiert Session-Codes für Speicherung und Lookup', () => {
    setHostToken('abc123', 'token-123');

    expect(normalizeHostSessionCode(' abc123 ')).toBe('ABC123');
    expect(getHostToken('ABC123')).toBe('token-123');
    expect(hasHostToken('abc123')).toBe(true);
  });

  it('entfernt gespeicherte Tokens wieder', () => {
    setHostToken('ABC123', 'token-123');
    clearHostToken('ABC123');

    expect(getHostToken('ABC123')).toBeNull();
    expect(hasHostToken('ABC123')).toBe(false);
  });

  it('liefert Join- oder Host-Ziel für den direkten Session-Einstieg', () => {
    expect(getSessionEntryCommands('abc123')).toEqual(['join', 'ABC123']);

    setHostToken('ABC123', 'token-123');

    expect(getSessionEntryCommands('abc123')).toEqual(['session', 'ABC123', 'host']);
  });
});
