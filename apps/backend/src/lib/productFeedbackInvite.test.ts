import type { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, sessionBoundWriteMock, createInviteTokensMock, loggerMock } = vi.hoisted(
  () => ({
    prismaMock: {
      productFeedbackInviteJob: {
        upsert: vi.fn(),
        updateMany: vi.fn(),
      },
    },
    sessionBoundWriteMock: vi.fn(),
    createInviteTokensMock: vi.fn(),
    loggerMock: { warn: vi.fn() },
  }),
);

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('./sessionDeletion', () => ({ runSessionBoundWrite: sessionBoundWriteMock }));
vi.mock('./productFeedbackTokens', () => ({
  createInviteTokensForSession: createInviteTokensMock,
}));
vi.mock('./logger', () => ({ logger: loggerMock }));

import {
  enqueueProductFeedbackInviteJob,
  issueProductFeedbackInvitesAfterFinishAwait,
} from './productFeedbackInvite';

describe('productFeedbackInvite session-bound jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.productFeedbackInviteJob.upsert.mockResolvedValue({});
    prismaMock.productFeedbackInviteJob.updateMany.mockResolvedValue({ count: 1 });
    createInviteTokensMock.mockResolvedValue({ participantInvites: 1, hostInvite: true });
  });

  it('legt nach einem gewonnenen Session-Purge keinen Invite-Job neu an', async () => {
    sessionBoundWriteMock.mockResolvedValue(null);

    await expect(enqueueProductFeedbackInviteJob('deleted-session')).resolves.toBe(false);

    expect(prismaMock.productFeedbackInviteJob.upsert).not.toHaveBeenCalled();
  });

  it('bricht die Invite-Ausstellung ohne Session ab, ohne Job oder Token zu erzeugen', async () => {
    sessionBoundWriteMock.mockResolvedValue(null);

    await expect(issueProductFeedbackInvitesAfterFinishAwait('deleted-session')).resolves.toEqual({
      participantInvites: 0,
      hostInvite: false,
    });

    expect(createInviteTokensMock).not.toHaveBeenCalled();
    expect(prismaMock.productFeedbackInviteJob.upsert).not.toHaveBeenCalled();
    expect(prismaMock.productFeedbackInviteJob.updateMany).not.toHaveBeenCalled();
  });

  it('erstellt den Job innerhalb der gewonnenen Sessionzeilensperre', async () => {
    const tx = {
      productFeedbackInviteJob: prismaMock.productFeedbackInviteJob,
    } as unknown as Prisma.TransactionClient;
    sessionBoundWriteMock.mockImplementationOnce(
      async (
        _sessionId: string,
        operation: (client: Prisma.TransactionClient) => Promise<unknown>,
      ) => operation(tx),
    );

    await expect(enqueueProductFeedbackInviteJob('live-session')).resolves.toBe(true);

    expect(prismaMock.productFeedbackInviteJob.upsert).toHaveBeenCalledWith({
      where: { sessionId: 'live-session' },
      create: { sessionId: 'live-session' },
      update: {},
    });
  });
});
