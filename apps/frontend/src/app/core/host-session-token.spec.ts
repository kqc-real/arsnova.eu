import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearHostToken,
  getSessionEntryCommands,
  getHostToken,
  hasHostToken,
  normalizeHostSessionCode,
  setHostToken,
} from './host-session-token';
import {
  clearHostTokenHandoff,
  hostTabHasToken,
  stageHostTokenHandoff,
  takeHostTokenHandoffSessionCode,
} from './host-session-token-handoff';

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

    expect(takeHostTokenHandoffSessionCode()).toBeNull();
    expect(hasHostToken('ABC123')).toBe(false);
    expect(window.localStorage.getItem('arsnova-host-token-handoff')).toBeNull();
  });

  it('erkennt einen Host-Tab mit bestehendem Token ohne das Handoff zu lesen', () => {
    setHostToken('ABC123', 'existing-token');
    expect(hostTabHasToken()).toBe(true);
    clearHostToken('ABC123');
    expect(hostTabHasToken()).toBe(false);
  });

  it('laesst ein bestehendes Host-Token unangetastet und verbraucht das Handoff nicht', () => {
    setHostToken('ABC123', 'existing-token');
    stageHostTokenHandoff('ABC123');
    expect(getHostToken('ABC123')).toBe('existing-token');
    expect(window.localStorage.getItem('arsnova-host-token-handoff')).toContain('existing-token');
  });

  it('raeumt ein gestagtes Handoff ohne das Host-Token zu loeschen', () => {
    setHostToken('ABC123', 'existing-token');
    stageHostTokenHandoff('ABC123');
    clearHostTokenHandoff();
    expect(window.localStorage.getItem('arsnova-host-token-handoff')).toBeNull();
    expect(getHostToken('ABC123')).toBe('existing-token');
  });
});
