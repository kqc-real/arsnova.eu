import { describe, expect, it } from 'vitest';
import { presentViewGuard } from './present-view.guard';
import { PRESENT_ROUTES } from './present.routes';

describe('PRESENT_ROUTES', () => {
  it('registriert den Present-Guard nur im lazy Present-Chunk', () => {
    expect(PRESENT_ROUTES).toHaveLength(1);
    expect(PRESENT_ROUTES[0]?.path).toBe('');
    expect(PRESENT_ROUTES[0]?.canActivate).toEqual([presentViewGuard]);
    expect(typeof PRESENT_ROUTES[0]?.loadComponent).toBe('function');
  });
});
