import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock, prismaMock, extractHostTokenFromContextMock, isHostSessionTokenValidMock } =
  vi.hoisted(() => ({
    redisMock: {
      hset: vi.fn(),
      hdel: vi.fn(),
      hgetall: vi.fn(),
      expire: vi.fn(),
    },
    prismaMock: {
      session: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
    extractHostTokenFromContextMock: vi.fn(),
    isHostSessionTokenValidMock: vi.fn(),
  }));

vi.mock('../redis', () => ({
  getRedis: () => redisMock,
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/hostAuth', () => ({
  extractHostTokenFromContext: extractHostTokenFromContextMock,
  isHostSessionTokenValid: isHostSessionTokenValidMock,
}));

import { tempoRouter } from '../routers/tempo';

const publicCaller = tempoRouter.createCaller({ req: undefined });
const hostCaller = tempoRouter.createCaller({ req: {} as never });

const CODE = 'ABCDEF';
const PARTICIPANT_ID = '11111111-1111-4111-8111-111111111111';

describe('tempo.vote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.hset.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
  });

  it('setzt den Zustand in Redis wenn der Kanal offen ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      tempoEnabled: true,
      tempoOpen: true,
      status: 'STARTED',
    });

    const result = await publicCaller.vote({
      sessionCode: CODE,
      participantId: PARTICIPANT_ID,
      state: 'speed_up',
    });
    expect(result.ok).toBe(true);
    expect(redisMock.hset).toHaveBeenCalledWith(`tempo:states:${CODE}`, PARTICIPANT_ID, 'speed_up');
    expect(redisMock.expire).toHaveBeenCalledWith(`tempo:states:${CODE}`, 86400);
  });

  it('normalizes session code to uppercase', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      tempoEnabled: true,
      tempoOpen: true,
      status: 'STARTED',
    });
    await publicCaller.vote({
      sessionCode: 'abcdef',
      participantId: PARTICIPANT_ID,
      state: 'following',
    });
    expect(redisMock.hset).toHaveBeenCalledWith('tempo:states:ABCDEF', PARTICIPANT_ID, 'following');
  });

  it('wirft FORBIDDEN wenn tempoEnabled false', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      tempoEnabled: false,
      tempoOpen: true,
      status: 'STARTED',
    });
    await expect(
      publicCaller.vote({ sessionCode: CODE, participantId: PARTICIPANT_ID, state: 'slow_down' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(redisMock.hset).not.toHaveBeenCalled();
  });

  it('wirft FORBIDDEN wenn tempoOpen false', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      tempoEnabled: true,
      tempoOpen: false,
      status: 'STARTED',
    });
    await expect(
      publicCaller.vote({ sessionCode: CODE, participantId: PARTICIPANT_ID, state: 'lost' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('wirft FORBIDDEN wenn Session FINISHED', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      tempoEnabled: true,
      tempoOpen: true,
      status: 'FINISHED',
    });
    await expect(
      publicCaller.vote({ sessionCode: CODE, participantId: PARTICIPANT_ID, state: 'following' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('wirft NOT_FOUND wenn Session nicht existiert', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);
    await expect(
      publicCaller.vote({ sessionCode: CODE, participantId: PARTICIPANT_ID, state: 'following' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('tempo.removeVote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.hdel.mockResolvedValue(1);
  });

  it('entfernt den Eintrag aus Redis', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      tempoEnabled: true,
      tempoOpen: true,
      status: 'STARTED',
    });
    const result = await publicCaller.removeVote({
      sessionCode: CODE,
      participantId: PARTICIPANT_ID,
    });
    expect(result.ok).toBe(true);
    expect(redisMock.hdel).toHaveBeenCalledWith(`tempo:states:${CODE}`, PARTICIPANT_ID);
  });

  it('wirft FORBIDDEN wenn Kanal geschlossen', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      tempoEnabled: true,
      tempoOpen: false,
      status: 'STARTED',
    });
    await expect(
      publicCaller.removeVote({ sessionCode: CODE, participantId: PARTICIPANT_ID }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('tempo.getSnapshot – Aggregationslogik', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.session.findUnique.mockResolvedValue({
      tempoEnabled: true,
      tempoOpen: true,
      status: 'STARTED',
    });
  });

  it('gibt no_data zurück wenn keine Votes vorhanden', async () => {
    redisMock.hgetall.mockResolvedValue({});
    const snap = await publicCaller.getSnapshot({ sessionCode: CODE });
    expect(snap.totalVotes).toBe(0);
    expect(snap.tendency).toBe('no_data');
    expect(snap.distribution).toEqual({ speed_up: 0, following: 0, slow_down: 0, lost: 0 });
  });

  it('berechnet following-Tendenz korrekt (>50% following)', async () => {
    redisMock.hgetall.mockResolvedValue({
      p1: 'following',
      p2: 'following',
      p3: 'following',
      p4: 'speed_up',
    });
    const snap = await publicCaller.getSnapshot({ sessionCode: CODE });
    expect(snap.totalVotes).toBe(4);
    expect(snap.distribution.following).toBe(3);
    expect(snap.tendency).toBe('following');
  });

  it('berechnet too_fast-Tendenz korrekt (≥40% slow_down+lost)', async () => {
    // 2/5 slow_down = 40%, no lost → too_fast (lost < 20%, slow+lost ≥ 40%)
    redisMock.hgetall.mockResolvedValue({
      p1: 'slow_down',
      p2: 'slow_down',
      p3: 'following',
      p4: 'following',
      p5: 'following',
    });
    const snap = await publicCaller.getSnapshot({ sessionCode: CODE });
    expect(snap.tendency).toBe('too_fast');
  });

  it('berechnet lost-Tendenz korrekt (≥20% lost)', async () => {
    // 1/5 lost = 20% → lost-Tendenz (lost-Prüfung vor too_fast)
    redisMock.hgetall.mockResolvedValue({
      p1: 'lost',
      p2: 'following',
      p3: 'following',
      p4: 'following',
      p5: 'following',
    });
    const snap = await publicCaller.getSnapshot({ sessionCode: CODE });
    expect(snap.tendency).toBe('lost');
  });

  it('berechnet underchallenged-Tendenz korrekt (≥40% speed_up)', async () => {
    // 2/5 speed_up = 40%, kein lost ≥ 20%, slow+lost < 40% → underchallenged
    redisMock.hgetall.mockResolvedValue({
      p1: 'speed_up',
      p2: 'speed_up',
      p3: 'following',
      p4: 'following',
      p5: 'following',
    });
    const snap = await publicCaller.getSnapshot({ sessionCode: CODE });
    expect(snap.tendency).toBe('underchallenged');
  });

  it('berechnet heterogeneous-Tendenz wenn kein klares Bild', async () => {
    // speed_up:2, slow_down:2, following:2, lost:0 → kein Schwellwert erreicht
    redisMock.hgetall.mockResolvedValue({
      p1: 'speed_up',
      p2: 'speed_up',
      p3: 'slow_down',
      p4: 'slow_down',
      p5: 'following',
      p6: 'following',
    });
    const snap = await publicCaller.getSnapshot({ sessionCode: CODE });
    expect(snap.tendency).toBe('heterogeneous');
  });

  it('ignoriert unbekannte Zustände in Redis', async () => {
    redisMock.hgetall.mockResolvedValue({
      p1: 'following',
      p2: 'INVALID_STATE',
      p3: '',
    });
    const snap = await publicCaller.getSnapshot({ sessionCode: CODE });
    expect(snap.totalVotes).toBe(1);
  });

  it('verrät keine Einzelzustände – nur Aggregat', async () => {
    redisMock.hgetall.mockResolvedValue({ p1: 'lost', p2: 'following' });
    const snap = await publicCaller.getSnapshot({ sessionCode: CODE });
    expect(Object.keys(snap)).not.toContain('p1');
    expect(Object.keys(snap)).not.toContain('p2');
    expect(snap).toHaveProperty('distribution');
    expect(snap).toHaveProperty('totalVotes');
    expect(snap).toHaveProperty('tendency');
  });
});

describe('tempo.getHostSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractHostTokenFromContextMock.mockReturnValue('host-token');
    isHostSessionTokenValidMock.mockResolvedValue(true);
    redisMock.hgetall.mockResolvedValue({ p1: 'following' });
  });

  it('gibt Snapshot zurück auch wenn Kanal geschlossen', async () => {
    const snap = await hostCaller.getHostSnapshot({ sessionCode: CODE });
    expect(snap.totalVotes).toBe(1);
  });

  it('erfordert Host-Auth', async () => {
    extractHostTokenFromContextMock.mockReturnValue(null);
    await expect(hostCaller.getHostSnapshot({ sessionCode: CODE })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('tempo.setOpen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractHostTokenFromContextMock.mockReturnValue('host-token');
    isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.session.update.mockResolvedValue({});
  });

  it('setzt tempoOpen auf true', async () => {
    prismaMock.session.findUnique.mockResolvedValue({ id: 'sess-1', tempoEnabled: true });
    const result = await hostCaller.setOpen({ sessionCode: CODE, open: true });
    expect(result.open).toBe(true);
    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: { code: CODE },
      data: { tempoOpen: true },
    });
  });

  it('setzt tempoOpen auf false', async () => {
    prismaMock.session.findUnique.mockResolvedValue({ id: 'sess-1', tempoEnabled: true });
    const result = await hostCaller.setOpen({ sessionCode: CODE, open: false });
    expect(result.open).toBe(false);
  });

  it('wirft FORBIDDEN wenn tempoEnabled false', async () => {
    prismaMock.session.findUnique.mockResolvedValue({ id: 'sess-1', tempoEnabled: false });
    await expect(hostCaller.setOpen({ sessionCode: CODE, open: true })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('wirft NOT_FOUND wenn Session nicht existiert', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);
    await expect(hostCaller.setOpen({ sessionCode: CODE, open: true })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('erfordert Host-Auth', async () => {
    extractHostTokenFromContextMock.mockReturnValue(null);
    await expect(hostCaller.setOpen({ sessionCode: CODE, open: true })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
