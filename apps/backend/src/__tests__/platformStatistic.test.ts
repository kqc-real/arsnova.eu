import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaExecuteRaw } = vi.hoisted(() => ({
  prismaExecuteRaw: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: {
    $executeRaw: prismaExecuteRaw,
  },
}));

import { updateMaxParticipantsSingleSession } from '../lib/platformStatistic';

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
});
