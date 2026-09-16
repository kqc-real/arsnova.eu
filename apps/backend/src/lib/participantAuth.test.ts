import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    participant: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));

import { assertParticipantCapability, extractParticipantCapability } from './participantAuth';
import { hashCapability } from './capabilityCrypto';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const CAPABILITY = 'participant-capability-abcdefghijklmnopqrstuvwxyz';

describe('participantAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liest die Capability aus HTTP und WebSocket, niemals aus der Participant-ID', () => {
    expect(
      extractParticipantCapability({
        req: { headers: { 'x-participant-capability': CAPABILITY } } as never,
      }),
    ).toBe(CAPABILITY);
    expect(
      extractParticipantCapability({
        connectionParams: { participantCapability: CAPABILITY, participantId: PARTICIPANT_ID },
      }),
    ).toBe(CAPABILITY);
    expect(
      extractParticipantCapability({ connectionParams: { participantId: PARTICIPANT_ID } }),
    ).toBeNull();
  });

  it('bindet den Hash gleichzeitig an Teilnehmer und Session', async () => {
    prismaMock.participant.findFirst.mockResolvedValue({ id: PARTICIPANT_ID });
    await assertParticipantCapability({
      ctx: {
        req: { headers: { 'x-participant-capability': CAPABILITY } } as never,
      },
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
    });
    expect(prismaMock.participant.findFirst).toHaveBeenCalledWith({
      where: {
        id: PARTICIPANT_ID,
        sessionId: SESSION_ID,
        rejoinCapabilityHash: hashCapability(CAPABILITY),
      },
      select: { id: true },
    });
  });

  it('weist fehlende, fremde und widerrufene Capabilities mit derselben Antwort ab', async () => {
    prismaMock.participant.findFirst.mockResolvedValue(null);
    await expect(
      assertParticipantCapability({
        ctx: {},
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Teilnahme-Nachweis ungültig oder abgelaufen.',
    });
    await expect(
      assertParticipantCapability({
        ctx: {
          req: { headers: { 'x-participant-capability': CAPABILITY } } as never,
        },
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Teilnahme-Nachweis ungültig oder abgelaufen.',
    });
  });
});
