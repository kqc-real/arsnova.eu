import { ActivatedRouteSnapshot } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { readSessionCodeFromSnapshot } from './session-route-code';

describe('readSessionCodeFromSnapshot', () => {
  it('liest den Code aus einem Vorfahren, wenn die Child-Route ihn nicht selbst trägt', () => {
    const parent = new ActivatedRouteSnapshot();
    parent.params = { code: 'abc123' };
    const child = new ActivatedRouteSnapshot();
    Object.defineProperty(child, 'parent', {
      configurable: true,
      get: () => parent,
    });
    Object.defineProperty(child, 'pathFromRoot', {
      configurable: true,
      get: () => [parent, child],
    });

    expect(readSessionCodeFromSnapshot(child)).toBe('abc123');
  });
});
