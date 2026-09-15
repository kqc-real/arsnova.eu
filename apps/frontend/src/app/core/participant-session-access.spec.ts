import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearJoinIdempotencyKey,
  getOrCreateJoinIdempotencyKey,
  getParticipantCapability,
  storeParticipantCapability,
} from './participant-session-access';

describe('participant-session-access', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('bindet die persistente Rejoin-Capability an genau einen Sessioncode', () => {
    const capability = 'participant-capability-abcdefghijklmnopqrstuvwxyz';
    storeParticipantCapability('abc123', capability);
    expect(getParticipantCapability('ABC123')).toBe(capability);
    expect(getParticipantCapability('DEF456')).toBeNull();
  });

  it('verwendet innerhalb von zehn Minuten denselben 256-Bit-Idempotency-Key', () => {
    const first = getOrCreateJoinIdempotencyKey('ABC123', 1_000);
    const retry = getOrCreateJoinIdempotencyKey('abc123', 10 * 60 * 1000);
    expect(first).toBe(retry);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/u);
  });

  it('erzeugt nach dem lokalen Replay-Fenster oder bestätigtem Erfolg einen neuen Schlüssel', () => {
    const first = getOrCreateJoinIdempotencyKey('ABC123', 1_000);
    const expired = getOrCreateJoinIdempotencyKey('ABC123', 10 * 60 * 1000 + 1_000);
    expect(expired).not.toBe(first);
    clearJoinIdempotencyKey('ABC123');
    expect(getOrCreateJoinIdempotencyKey('ABC123', 10 * 60 * 1000 + 2_000)).not.toBe(expired);
  });
});
