import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';

describe('session.getParticipants (Story 2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert Teilnehmerliste und -anzahl für gültigen Code', async () => {
    const p1Id = '11111111-1111-4111-8111-111111111111';
    const p2Id = '22222222-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      participants: [
        { id: p1Id, nickname: 'Marie Curie' },
        { id: p2Id, nickname: 'Albert Einstein' },
      ],
    });

    const result = await caller.getParticipants({ code: 'ABC123' });

    expect(result.participantCount).toBe(2);
    expect(result.participants).toHaveLength(2);
    expect(result.participants[0]).toEqual({
      id: p1Id,
      nickname: 'Marie Curie',
      teamId: null,
      teamName: null,
    });
    expect(result.participants[1]).toEqual({
      id: p2Id,
      nickname: 'Albert Einstein',
      teamId: null,
      teamName: null,
    });
    expect(prismaMock.session.findUnique).toHaveBeenCalledWith({
      where: { code: 'ABC123' },
      include: {
        participants: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            nickname: true,
            teamId: true,
            team: { select: { name: true } },
          },
        },
      },
    });
  });

  it('liefert leere Liste wenn keine Teilnehmer', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'XYZ789',
      participants: [],
    });

    const result = await caller.getParticipants({ code: 'XYZ789' });

    expect(result.participantCount).toBe(0);
    expect(result.participants).toEqual([]);
  });

  it('wirft NOT_FOUND bei unbekanntem Code', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);

    await expect(caller.getParticipants({ code: 'NONEXI' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Session nicht gefunden.',
    });
  });
});
