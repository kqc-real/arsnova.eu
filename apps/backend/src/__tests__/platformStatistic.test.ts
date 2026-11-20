import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaExecuteRaw } = vi.hoisted(() => ({
  prismaExecuteRaw: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: {
    $executeRaw: prismaExecuteRaw,
  },
}));

import {
  flushParticipantMaximaUpdates,
  incrementCompletedSessionsTotal,
  scheduleParticipantMaximaUpdate,
  updateDailyMaxParticipants,
  updateCompletedSessionsTotal,
  updateMaxParticipantsSingleSession,
} from '../lib/platformStatistic';

describe('platformStatistic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaExecuteRaw.mockResolvedValue(1);
  });

  it('führt kein Update aus bei ungültiger Zahl', async () => {
    await updateMaxParticipantsSingleSession(0);
    await updateMaxParticipantsSingleSession(-1);
    await updateMaxParticipantsSingleSession(Number.NaN);
    expect(prismaExecuteRaw).not.toHaveBeenCalled();
  });

  it('führt Update aus bei gültiger Teilnehmerzahl', async () => {
    await updateMaxParticipantsSingleSession(12);
    expect(prismaExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('führt kein Tagesrekord-Update aus bei ungültiger Zahl', async () => {
    await updateDailyMaxParticipants(0);
    await updateDailyMaxParticipants(-1);
    await updateDailyMaxParticipants(Number.NaN);
    expect(prismaExecuteRaw).not.toHaveBeenCalled();
  });

  it('führt Tagesrekord-Update aus bei gültiger Teilnehmerzahl', async () => {
    await updateDailyMaxParticipants(12, new Date('2026-05-04T12:00:00.000Z'));
    expect(prismaExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('bündelt einen Join-Burst auch während eines Schreibvorgangs nach UTC-Tag', async () => {
    const firstDay = new Date('2026-05-04T23:59:59.000Z');
    const secondDay = new Date('2026-05-05T00:00:00.000Z');
    let finishWrite!: (rows: number) => void;
    prismaExecuteRaw.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        finishWrite = resolve;
      }),
    );

    scheduleParticipantMaximaUpdate(10, firstDay);
    scheduleParticipantMaximaUpdate(20, firstDay);
    await Promise.resolve();
    expect(prismaExecuteRaw.mock.calls.map((call) => call.at(-1))).toEqual([20, 20]);

    scheduleParticipantMaximaUpdate(31, firstDay);
    scheduleParticipantMaximaUpdate(29, firstDay);
    scheduleParticipantMaximaUpdate(44, secondDay);
    scheduleParticipantMaximaUpdate(39, secondDay);
    expect(prismaExecuteRaw).toHaveBeenCalledTimes(2);

    finishWrite(1);
    await flushParticipantMaximaUpdates();
    expect(prismaExecuteRaw.mock.calls.map((call) => call.at(-1))).toEqual([
      20, 20, 31, 31, 44, 44,
    ]);
    const dailyUpdates = prismaExecuteRaw.mock.calls.filter((call) => call[2] instanceof Date);
    expect(dailyUpdates.map((call) => call[2])).toEqual([
      new Date('2026-05-04T00:00:00.000Z'),
      new Date('2026-05-04T00:00:00.000Z'),
      secondDay,
    ]);
  });

  it('führt kein Update des completedCounters bei ungültiger Zahl aus', async () => {
    await updateCompletedSessionsTotal(-1);
    await updateCompletedSessionsTotal(Number.NaN);
    expect(prismaExecuteRaw).not.toHaveBeenCalled();
  });

  it('führt Update des completedCounters bei gültiger Zahl aus', async () => {
    await updateCompletedSessionsTotal(42);
    expect(prismaExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('führt kein Inkrement des completedCounters bei ungültiger Zahl aus', async () => {
    await incrementCompletedSessionsTotal(0);
    await incrementCompletedSessionsTotal(-1);
    await incrementCompletedSessionsTotal(Number.NaN);
    expect(prismaExecuteRaw).not.toHaveBeenCalled();
  });

  it('führt Inkrement des completedCounters bei gültiger Zahl aus', async () => {
    await incrementCompletedSessionsTotal(3);
    expect(prismaExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('bleibt bei parallelen Rekord-Updates auf dem Maximum', async () => {
    let persistedMax = 0;
    prismaExecuteRaw.mockImplementation(
      async (_strings: TemplateStringsArray, ...values: unknown[]) => {
        const candidate = values.find((v) => typeof v === 'number') as number | undefined;
        const delayMs = Math.max(0, 20 - (candidate ?? 0));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (typeof candidate === 'number') {
          persistedMax = Math.max(persistedMax, candidate);
        }
        return 1;
      },
    );

    const counts = [3, 11, 7, 19, 5];
    await Promise.all(counts.map((count) => updateMaxParticipantsSingleSession(count)));

    expect(prismaExecuteRaw).toHaveBeenCalledTimes(counts.length);
    expect(persistedMax).toBe(19);
  });

  it('bleibt bei parallelen Tagesrekord-Updates auf dem Maximum', async () => {
    let persistedMax = 0;
    prismaExecuteRaw.mockImplementation(
      async (_strings: TemplateStringsArray, ...values: unknown[]) => {
        const candidate = values.find((v) => typeof v === 'number') as number | undefined;
        const delayMs = Math.max(0, 20 - (candidate ?? 0));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (typeof candidate === 'number') {
          persistedMax = Math.max(persistedMax, candidate);
        }
        return 1;
      },
    );

    const counts = [3, 11, 7, 19, 5];
    await Promise.all(
      counts.map((count) =>
        updateDailyMaxParticipants(count, new Date('2026-05-04T12:00:00.000Z')),
      ),
    );

    expect(prismaExecuteRaw).toHaveBeenCalledTimes(counts.length);
    expect(persistedMax).toBe(19);
  });
});
