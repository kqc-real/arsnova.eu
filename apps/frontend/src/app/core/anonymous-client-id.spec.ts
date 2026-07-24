import { beforeEach, describe, expect, it } from 'vitest';
import { getAnonymousClientId, resetAnonymousClientIdForTests } from './anonymous-client-id';

describe('getAnonymousClientId', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAnonymousClientIdForTests();
  });

  it('erzeugt und stabilisiert eine browserweite zufällige UUID', () => {
    const first = getAnonymousClientId();
    resetAnonymousClientIdForTests();
    const second = getAnonymousClientId();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(second).toBe(first);
    expect(localStorage.getItem('arsnova-anonymous-client-id')).toBe(first);
  });

  it('ersetzt manipulierte oder ungültige Storage-Werte', () => {
    localStorage.setItem('arsnova-anonymous-client-id', 'person@example.org');

    const id = getAnonymousClientId();

    expect(id).not.toContain('@');
    expect(id).not.toBe('person@example.org');
    expect(localStorage.getItem('arsnova-anonymous-client-id')).toBe(id);
  });
});
