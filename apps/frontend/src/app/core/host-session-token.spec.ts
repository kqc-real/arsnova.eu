import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearHostToken,
  getSessionEntryCommands,
  getHostToken,
  hasAnyHostToken,
  hasHostToken,
  normalizeHostSessionCode,
  setHostToken,
  stageHostTokenHandoff,
  takeHostTokenHandoffSessionCode,
} from './host-session-token';

describe('host-session-token', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    clearHostToken('ABC123');
  });

  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('normalisiert Session-Codes für Speicherung und Lookup', () => {
    setHostToken('abc123', 'token-123');

    expect(normalizeHostSessionCode(' abc123 ')).toBe('ABC123');
    expect(getHostToken('ABC123')).toBe('token-123');
    expect(hasHostToken('abc123')).toBe(true);
    expect(hasAnyHostToken()).toBe(true);
  });

  it('entfernt gespeicherte Tokens wieder', () => {
    setHostToken('ABC123', 'token-123');
    clearHostToken('ABC123');

    expect(getHostToken('ABC123')).toBeNull();
    expect(hasHostToken('ABC123')).toBe(false);
    expect(hasAnyHostToken()).toBe(false);
  });

  it('liefert Join- oder Host-Ziel für den direkten Session-Einstieg', () => {
    expect(getSessionEntryCommands('abc123')).toEqual(['join', 'ABC123']);

    setHostToken('ABC123', 'token-123');

    expect(getSessionEntryCommands('abc123')).toEqual(['session', 'ABC123', 'host']);
  });

  it('uebernimmt ein frisches Token-Handoff in denselben Tab', () => {
    setHostToken('ABC123', 'token-123');
    stageHostTokenHandoff('ABC123');
    clearHostToken('ABC123');

    expect(takeHostTokenHandoffSessionCode()).toBe('ABC123');
    expect(getHostToken('ABC123')).toBe('token-123');
    expect(window.localStorage.getItem('arsnova-host-token-handoff')).toBeNull();
  });

  it('verwirft abgelaufene Token-Handoffs', () => {
    window.localStorage.setItem(
      'arsnova-host-token-handoff',
      JSON.stringify({
        code: 'ABC123',
        token: 'stale-token',
        expiresAt: Date.now() - 1,
      }),
    );

    expect(hasHostToken('ABC123')).toBe(false);
    expect(window.localStorage.getItem('arsnova-host-token-handoff')).toBeNull();
  });
});
