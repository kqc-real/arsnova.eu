import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import {
  getSkewAdjustedNow,
  recordServerTimeIso,
  resetServerClockSkew,
} from './session-server-clock';

describe('session-server-clock', () => {
  beforeEach(() => {
    resetServerClockSkew();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ohne Sample: getSkewAdjustedNow entspricht Date.now', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(42);
    expect(getSkewAdjustedNow()).toBe(42);
    spy.mockRestore();
  });

  it('setzt den Offset aus dem ersten Serverzeit-Sample', () => {
    recordServerTimeIso(new Date(7000).toISOString(), 2000);
    const spy = vi.spyOn(Date, 'now').mockReturnValue(3000);
    expect(getSkewAdjustedNow()).toBe(8000);
    spy.mockRestore();
  });
});
