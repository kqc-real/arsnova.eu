/**
 * Tests für Rate-Limiting (Story 0.5).
 * Mocked: Redis-Befehle (zremrangebyscore, zcard, zadd, expire, get, setex, ttl, zrange).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const redisMock = {
  zremrangebyscore: vi.fn().mockResolvedValue(0),
  zcard: vi.fn().mockResolvedValue(0),
  zadd: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  get: vi.fn().mockResolvedValue(null),
  setex: vi.fn().mockResolvedValue('OK'),
  ttl: vi.fn().mockResolvedValue(-1),
  zrange: vi.fn().mockResolvedValue([]),
};

vi.mock('../redis', () => ({
  getRedis: vi.fn(() => redisMock),
}));

import {
  checkSlidingWindow,
  checkSessionCodeAttempt,
  recordFailedSessionCodeAttempt,
  checkVoteRate,
  checkSessionCreateRate,
  checkMotdGetCurrentRate,
  checkMotdListArchiveRate,
  checkMotdRecordInteractionRate,
  RATE_LIMIT_ENV,
} from '../lib/rateLimit';

describe('RATE_LIMIT_ENV – Umgebungsvariablen-Defaults (Story 0.5)', () => {
  it('hat korrekte Standardwerte', () => {
    expect(RATE_LIMIT_ENV.sessionCodeAttempts).toBe(5);
    expect(RATE_LIMIT_ENV.sessionCodeWindowMinutes).toBe(5);
    expect(RATE_LIMIT_ENV.sessionCodeLockoutSeconds).toBe(60);
    expect(RATE_LIMIT_ENV.voteRequestsPerSecond).toBe(1);
    expect(RATE_LIMIT_ENV.sessionCreatePerHour).toBe(10);
    expect(RATE_LIMIT_ENV.motdGetCurrentPerMinute).toBe(120);
    expect(RATE_LIMIT_ENV.motdListArchivePerMinute).toBe(60);
    expect(RATE_LIMIT_ENV.motdRecordInteractionPerMinute).toBe(40);
  });
});

describe('checkSlidingWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.get.mockResolvedValue(null);
    redisMock.zcard.mockResolvedValue(0);
  });

  it('erlaubt Request wenn Limit nicht erreicht', async () => {
    redisMock.zcard.mockResolvedValue(2);

    const result = await checkSlidingWindow('test-key', 5, 300);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 5 - 2 - 1 = 2
    expect(redisMock.zadd).toHaveBeenCalled();
    expect(redisMock.expire).toHaveBeenCalled();
  });

  it('blockiert Request wenn Limit erreicht', async () => {
    redisMock.zcard.mockResolvedValue(5);
    redisMock.zrange.mockResolvedValue([String(Date.now() - 100000), '0']);

    const result = await checkSlidingWindow('test-key', 5, 300);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(redisMock.zadd).not.toHaveBeenCalled();
  });

  it('setzt Lockout wenn lockoutKey angegeben und Limit erreicht', async () => {
    redisMock.zcard.mockResolvedValue(5);
    redisMock.zrange.mockResolvedValue([]);

    const result = await checkSlidingWindow('test-key', 5, 300, 'lock-ip', 60);

    expect(result.allowed).toBe(false);
    expect(redisMock.setex).toHaveBeenCalledWith('rl:lockout:lock-ip', 60, '1');
  });

  it('blockiert sofort wenn Lockout aktiv ist', async () => {
    redisMock.get.mockResolvedValue('1');
    redisMock.ttl.mockResolvedValue(45);

    const result = await checkSlidingWindow('test-key', 5, 300, 'lock-ip', 60);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(45);
    expect(redisMock.zcard).not.toHaveBeenCalled();
  });
});

describe('checkSessionCodeAttempt (Story 3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.get.mockResolvedValue(null);
  });

  it('erlaubt Versuch wenn kein Lockout besteht', async () => {
    const result = await checkSessionCodeAttempt('192.168.1.1');
    expect(result.allowed).toBe(true);
  });

  it('blockiert Versuch wenn IP gesperrt ist', async () => {
    redisMock.get.mockResolvedValue('1');
    redisMock.ttl.mockResolvedValue(30);

    const result = await checkSessionCodeAttempt('192.168.1.1');

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(30);
  });
});

describe('recordFailedSessionCodeAttempt (Story 0.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.get.mockResolvedValue(null);
  });

  it('gibt locked=false zurück wenn noch Versuche übrig', async () => {
    redisMock.zcard.mockResolvedValue(2);

    const result = await recordFailedSessionCodeAttempt('10.0.0.1');
    expect(result.locked).toBe(false);
  });

  it('gibt locked=true zurück wenn Limit erreicht', async () => {
    redisMock.zcard.mockResolvedValue(5);
    redisMock.zrange.mockResolvedValue([]);

    const result = await recordFailedSessionCodeAttempt('10.0.0.1');

    expect(result.locked).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('checkVoteRate (Story 3.3b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.get.mockResolvedValue(null);
  });

  it('erlaubt Vote wenn kein kürzlicher Request', async () => {
    redisMock.zcard.mockResolvedValue(0);

    const result = await checkVoteRate('participant-123');

    expect(result.allowed).toBe(true);
  });

  it('blockiert Vote wenn Rate überschritten (1/s)', async () => {
    redisMock.zcard.mockResolvedValue(1);
    redisMock.zrange.mockResolvedValue([String(Date.now()), '0']);

    const result = await checkVoteRate('participant-123');

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('checkSessionCreateRate (Story 2.1a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.get.mockResolvedValue(null);
  });

  it('erlaubt Session-Erstellung wenn Limit nicht erreicht', async () => {
    redisMock.zcard.mockResolvedValue(3);

    const result = await checkSessionCreateRate('172.16.0.1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(6); // 10 - 3 - 1
  });

  it('blockiert Session-Erstellung bei 10 Sessions pro Stunde', async () => {
    redisMock.zcard.mockResolvedValue(10);
    redisMock.zrange.mockResolvedValue([]);

    const result = await checkSessionCreateRate('172.16.0.1');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('MOTD öffentliche API (Epic 10) – Sliding-Window pro IP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.get.mockResolvedValue(null);
  });

  it('checkMotdGetCurrentRate blockiert bei Erreichen des Minuten-Limits', async () => {
    redisMock.zcard.mockResolvedValue(RATE_LIMIT_ENV.motdGetCurrentPerMinute);
    redisMock.zrange.mockResolvedValue([]);

    const result = await checkMotdGetCurrentRate('203.0.113.7');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(redisMock.zremrangebyscore).toHaveBeenCalled();
  });

  it('checkMotdListArchiveRate nutzt eigenen Redis-Key pro IP', async () => {
    redisMock.zcard.mockResolvedValue(0);

    await checkMotdListArchiveRate('198.51.100.2');

    expect(redisMock.zadd).toHaveBeenCalledWith(
      'rl:motd:listArchive:198.51.100.2',
      expect.any(Number),
      expect.any(String),
    );
  });

  it('checkMotdRecordInteractionRate erlaubt Aufruf unterhalb des Limits', async () => {
    redisMock.zcard.mockResolvedValue(0);

    const result = await checkMotdRecordInteractionRate('192.0.2.1');

    expect(result.allowed).toBe(true);
    expect(redisMock.zadd).toHaveBeenCalledWith(
      'rl:motd:recordInteraction:192.0.2.1',
      expect.any(Number),
      expect.any(String),
    );
  });
});
