import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashCapability } from './capabilityCrypto';
import {
  PARTICIPANT_JOIN_REPLAY_MS,
  expireParticipantJoinReplayEnvelopes,
  prepareParticipantJoin,
} from './participantJoin';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PARTICIPANT_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-09-15T08:00:00.000Z');

function createTx() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ now: NOW }]),
    session: {
      update: vi.fn().mockResolvedValue({ nextParticipantNumber: 7 }),
    },
    participant: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: PARTICIPANT_ID,
        participantNumber: 7,
        nickname: 'Roter Drache 7',
        teamId: null,
        timerAccommodation: 'DEFAULT',
        team: null,
      }),
      update: vi.fn().mockResolvedValue({ id: PARTICIPANT_ID }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    participantJoinReplay: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'replay-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('prepareParticipantJoin', () => {
  beforeEach(() => {
    process.env['JWT_SECRET'] = 'participant-join-tests-secret-at-least-32-bytes';
  });

  it('vergibt Nummer und Preset-Nickname atomar und persistiert nur den Capability-Hash', async () => {
    const tx = createTx();

    const result = await prepareParticipantJoin({
      tx: tx as never,
      sessionId: SESSION_ID,
      requestedNickname: 'Roter Drache',
      profile: { allowCustomNicknames: false, anonymousMode: false },
      joinIdempotencyKey: 'join-key-abcdefghijklmnopqrstuvwxyz0123456789',
    });

    expect(tx.session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { nextParticipantNumber: { increment: 1 } },
      select: { nextParticipantNumber: true },
    });
    expect(result).toMatchObject({
      participantId: PARTICIPANT_ID,
      participantNumber: 7,
      nickname: 'Roter Drache 7',
      rejoined: false,
    });
    expect(result.rejoinCapability).toHaveLength(43);
    expect(tx.participant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participantNumber: 7,
          nickname: 'Roter Drache 7',
          rejoinCapabilityHash: hashCapability(result.rejoinCapability),
        }),
      }),
    );
    expect(JSON.stringify(tx.participant.create.mock.calls)).not.toContain(result.rejoinCapability);
  });

  it('liefert einen bestätigten Join mit demselben Schlüssel aus dem geschützten Replay', async () => {
    const firstTx = createTx();
    const first = await prepareParticipantJoin({
      tx: firstTx as never,
      sessionId: SESSION_ID,
      requestedNickname: 'Roter Drache',
      profile: { allowCustomNicknames: false, anonymousMode: false },
      joinIdempotencyKey: 'join-key-abcdefghijklmnopqrstuvwxyz0123456789',
    });
    const replayCreate = firstTx.participantJoinReplay.create.mock.calls[0]![0].data;
    const replayTx = createTx();
    replayTx.participantJoinReplay.findUnique.mockResolvedValue({
      ...replayCreate,
      participant: {
        id: PARTICIPANT_ID,
        participantNumber: 7,
        nickname: 'Roter Drache 7',
        teamId: null,
        timerAccommodation: 'DEFAULT',
        team: null,
      },
    });

    const replay = await prepareParticipantJoin({
      tx: replayTx as never,
      sessionId: SESSION_ID,
      requestedNickname: 'Anderer Name',
      profile: { allowCustomNicknames: false, anonymousMode: false },
      joinIdempotencyKey: 'join-key-abcdefghijklmnopqrstuvwxyz0123456789',
    });

    expect(replay).toEqual({ ...first, rejoined: true });
    expect(replayTx.session.update).not.toHaveBeenCalled();
    expect(replayTx.participant.create).not.toHaveBeenCalled();
  });

  it('lehnt denselben Schlüssel nach zehn Minuten ab statt eine neue Teilnahme anzulegen', async () => {
    const tx = createTx();
    tx.participantJoinReplay.findUnique.mockResolvedValue({
      expiresAt: new Date(NOW.getTime() - 1),
      encryptedEnvelope: null,
      participant: null,
    });

    await expect(
      prepareParticipantJoin({
        tx: tx as never,
        sessionId: SESSION_ID,
        requestedNickname: 'Roter Drache',
        profile: { allowCustomNicknames: false, anonymousMode: false },
        joinIdempotencyKey: 'join-key-abcdefghijklmnopqrstuvwxyz0123456789',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(tx.session.update).not.toHaveBeenCalled();
    expect(tx.participant.create).not.toHaveBeenCalled();
  });

  it('bindet eine Rejoin-Capability an Session und Hash statt an die sichtbare Participant-ID', async () => {
    const tx = createTx();
    tx.participant.findFirst.mockResolvedValue({
      id: PARTICIPANT_ID,
      participantNumber: 3,
      nickname: 'Ada 3',
      teamId: null,
      timerAccommodation: 'DEFAULT',
      productFeedbackClaimTokenHash: null,
      team: null,
    });

    const result = await prepareParticipantJoin({
      tx: tx as never,
      sessionId: SESSION_ID,
      requestedNickname: 'Ignoriert',
      profile: { allowCustomNicknames: false, anonymousMode: false },
      rejoinCapability: 'rejoin-capability-abcdefghijklmnopqrstuvwxyz',
      joinIdempotencyKey: 'join-key-abcdefghijklmnopqrstuvwxyz0123456789',
    });

    expect(tx.participant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sessionId: SESSION_ID,
          rejoinCapabilityHash: hashCapability('rejoin-capability-abcdefghijklmnopqrstuvwxyz'),
        },
      }),
    );
    expect(result).toMatchObject({
      participantId: PARTICIPANT_ID,
      participantNumber: 3,
      rejoined: true,
    });
    expect(tx.session.update).not.toHaveBeenCalled();
  });

  it('wiederverwendet dieselbe Teilnahme für dieselbe anonymousClientId trotz anderem Nickname', async () => {
    const tx = createTx();
    const clientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    tx.participant.findFirst.mockResolvedValue({
      id: PARTICIPANT_ID,
      participantNumber: 4,
      nickname: 'Erste Identität 4',
      teamId: null,
      timerAccommodation: 'DEFAULT',
      productFeedbackClaimTokenHash: null,
      team: null,
    });

    const result = await prepareParticipantJoin({
      tx: tx as never,
      sessionId: SESSION_ID,
      requestedNickname: 'Zweite Identität',
      profile: { allowCustomNicknames: true, anonymousMode: false },
      anonymousClientId: clientId,
      joinIdempotencyKey: 'join-key-client-bind-abcdefghijklmnopqrstuvwxyz',
    });

    expect(result).toMatchObject({
      participantId: PARTICIPANT_ID,
      participantNumber: 4,
      nickname: 'Erste Identität 4',
      rejoined: true,
    });
    expect(tx.participant.create).not.toHaveBeenCalled();
    expect(tx.participant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PARTICIPANT_ID },
        data: expect.objectContaining({
          rejoinCapabilityHash: hashCapability(result.rejoinCapability),
        }),
      }),
    );
    expect(tx.participant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PARTICIPANT_ID },
        data: { anonymousClientIdHash: hashCapability(clientId) },
      }),
    );
  });

  it('persistiert den Client-Hash bei neuer Teilnahme', async () => {
    const tx = createTx();
    const clientId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    await prepareParticipantJoin({
      tx: tx as never,
      sessionId: SESSION_ID,
      requestedNickname: 'Roter Drache',
      profile: { allowCustomNicknames: false, anonymousMode: false },
      anonymousClientId: clientId,
      joinIdempotencyKey: 'join-key-new-client-abcdefghijklmnopqrstuvwxyz',
    });

    expect(tx.participant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          anonymousClientIdHash: hashCapability(clientId),
        }),
      }),
    );
  });
});

describe('expireParticipantJoinReplayEnvelopes', () => {
  it('entfernt nach dem Replay-Fenster nur das geheime Envelope und behält den Tombstone', async () => {
    const tx = createTx();
    await expireParticipantJoinReplayEnvelopes(
      tx as never,
      new Date(NOW.getTime() + PARTICIPANT_JOIN_REPLAY_MS),
    );
    expect(tx.participantJoinReplay.updateMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lte: new Date(NOW.getTime() + PARTICIPANT_JOIN_REPLAY_MS) },
        encryptedEnvelope: { not: null },
      },
      data: { encryptedEnvelope: null },
    });
  });
});
