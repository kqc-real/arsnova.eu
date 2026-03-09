/**
 * Tests für den Health-Router (Story 0.1, 0.2, 0.4).
 * Mocked: Redis (pingRedis) und Prisma (session.count, participant.count).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../redis', () => ({
  pingRedis: vi.fn(),
  getRedis: vi.fn(() => ({
    keys: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../db', () => ({
  prisma: {
    session: { count: vi.fn() },
    participant: { count: vi.fn() },
  },
}));

import { pingRedis } from '../redis';
import { prisma } from '../db';
import { healthRouter, heartbeatGenerator } from '../routers/health';

const caller = healthRouter.createCaller({ req: undefined });

describe('health.check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gibt status "ok" zurück wenn Redis erreichbar ist', async () => {
    vi.mocked(pingRedis).mockResolvedValue(true);

    const result = await caller.check(undefined);

    expect(result.status).toBe('ok');
    expect(result.redis).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(result.version).toBeDefined();
  });

  it('gibt redis "unavailable" zurück wenn Redis nicht erreichbar ist', async () => {
    vi.mocked(pingRedis).mockResolvedValue(false);

    const result = await caller.check(undefined);

    expect(result.status).toBe('ok');
    expect(result.redis).toBe('unavailable');
  });
});

describe('health.stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert Initialwerte (0) wenn keine Sessions existieren', async () => {
    vi.mocked(prisma.session.count).mockResolvedValue(0);
    vi.mocked(prisma.participant.count).mockResolvedValue(0);

    const result = await caller.stats(undefined);

    expect(result.activeSessions).toBe(0);
    expect(result.totalParticipants).toBe(0);
    expect(result.completedSessions).toBe(0);
    expect(result.serverStatus).toBe('healthy');
  });

  it('berechnet serverStatus "healthy" bei < 50 aktiven Sessions', async () => {
    vi.mocked(prisma.session.count)
      .mockResolvedValueOnce(10)   // activeSessions (not FINISHED)
      .mockResolvedValueOnce(5);   // completedSessions (FINISHED)
    vi.mocked(prisma.participant.count).mockResolvedValue(42);

    const result = await caller.stats(undefined);

    expect(result.activeSessions).toBe(10);
    expect(result.totalParticipants).toBe(42);
    expect(result.completedSessions).toBe(5);
    expect(result.serverStatus).toBe('healthy');
  });

  it('berechnet serverStatus "busy" bei 50–199 aktiven Sessions', async () => {
    vi.mocked(prisma.session.count)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(50);
    vi.mocked(prisma.participant.count).mockResolvedValue(500);

    const result = await caller.stats(undefined);

    expect(result.activeSessions).toBe(100);
    expect(result.serverStatus).toBe('busy');
  });

  it('berechnet serverStatus "overloaded" bei >= 200 aktiven Sessions', async () => {
    vi.mocked(prisma.session.count)
      .mockResolvedValueOnce(250)
      .mockResolvedValueOnce(1000);
    vi.mocked(prisma.participant.count).mockResolvedValue(3000);

    const result = await caller.stats(undefined);

    expect(result.activeSessions).toBe(250);
    expect(result.serverStatus).toBe('overloaded');
  });

  it('exponiert keine personenbezogenen Daten – nur aggregierte Zahlen', async () => {
    vi.mocked(prisma.session.count).mockResolvedValue(0);
    vi.mocked(prisma.participant.count).mockResolvedValue(0);

    const result = await caller.stats(undefined);

    const keys = Object.keys(result);
    expect(keys).toEqual(
      expect.arrayContaining(['activeSessions', 'totalParticipants', 'completedSessions', 'activeBlitzRounds', 'serverStatus']),
    );
    expect(keys).not.toContain('participants');
    expect(keys).not.toContain('nicknames');
    expect(keys).not.toContain('emails');
  });
});

describe('health.ping (Story 0.2 – Subscription Heartbeat)', () => {
  it('liefert mindestens einen Heartbeat mit ISO-Timestamp', async () => {
    const stream = heartbeatGenerator(10); // kurzes Intervall für Test
    const { value } = await stream.next();
    expect(value).toBeDefined();
    expect(value).toHaveProperty('heartbeat');
    expect(typeof value!.heartbeat).toBe('string');
    expect(value!.heartbeat).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
