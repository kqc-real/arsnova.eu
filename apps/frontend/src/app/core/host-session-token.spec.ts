import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearHostToken,
  getHostSessionRole,
  getSessionEntryCommands,
  getHostToken,
  hasHostToken,
  normalizeHostSessionCode,
  setHostSessionRole,
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

  it('merkt die Paired-Host-Rolle und löscht sie mit dem Token', () => {
    setHostToken('ABC123', 'token-123');
    setHostSessionRole('ABC123', 'PAIRED_HOST');
    expect(getHostSessionRole('abc123')).toBe('PAIRED_HOST');
    clearHostToken('ABC123');
    expect(getHostSessionRole('ABC123')).toBeNull();
  });

  it('liefert Join- oder Host-Ziel für den direkten Session-Einstieg', () => {
    expect(getSessionEntryCommands('abc123')).toEqual(['join', 'ABC123']);

    setHostToken('ABC123', 'token-123');

    expect(getSessionEntryCommands('abc123')).toEqual(['session', 'ABC123', 'host']);
  });
});
