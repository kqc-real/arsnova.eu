import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    participant: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    qaQuestion: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));

import { qaRouter } from '../routers/qa';
import { hashCapability } from '../lib/capabilityCrypto';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const IDEMPOTENCY_KEY = '33333333-3333-4333-8333-333333333333';
const CAPABILITY = 'participant-capability-abcdefghijklmnopqrstuvwxyz';

describe('participant capability router boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lehnt Q&A-Schreibzugriff mit sichtbarer Participant-ID, aber ohne Capability ab', async () => {
    const caller = qaRouter.createCaller({});
    await expect(
      caller.submit({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Darf eine sichtbare ID allein schreiben?',
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(prismaMock.participant.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.qaQuestion.create).not.toHaveBeenCalled();
  });

  it('bindet eine übertragene Capability gleichzeitig an Session und Participant', async () => {
    prismaMock.participant.findFirst.mockResolvedValue(null);
    const caller = qaRouter.createCaller({
      req: { headers: { 'x-participant-capability': CAPABILITY } } as never,
    });
    await expect(
      caller.submit({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Fremde Capability?',
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(prismaMock.participant.findFirst).toHaveBeenCalledWith({
      where: {
        id: PARTICIPANT_ID,
        sessionId: SESSION_ID,
        rejoinCapabilityHash: hashCapability(CAPABILITY),
      },
      select: { id: true },
    });
  });

  it('verlangt auch für den inhaltsfreien Q&A-Endzustand eine Participant-Capability', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      status: 'FINISHED',
      endedAt: new Date('2026-09-15T08:00:00.000Z'),
      expiresAt: new Date('2026-09-16T08:00:00.000Z'),
      type: 'Q_AND_A',
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: null,
      sessionLifecycleRevision: 2,
      onboardingAnonymousMode: false,
    });
    const caller = qaRouter.createCaller({});
    await expect(
      caller.list({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(prismaMock.participant.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.qaQuestion.findMany).not.toHaveBeenCalled();
  });
});
