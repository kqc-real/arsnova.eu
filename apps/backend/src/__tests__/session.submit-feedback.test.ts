import { beforeEach, describe, expect, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    sessionFeedback: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: vi.fn(),
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const feedbackInput = {
  code: 'ABC123',
  participantId: '11111111-1111-4111-8111-111111111111',
  overallRating: 4,
  questionQualityRating: 5,
  wouldRepeat: true,
};

describe('session.submitSessionFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  trpcDodIt(
    {
      procedure: 'session.submitSessionFeedback',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt Bewertungen ab, wenn kein Quiz gestartet wurde',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'FINISHED',
        quizStarted: false,
      });

      await expect(caller.submitSessionFeedback(feedbackInput)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Bewertung nur nach gestartetem Quiz möglich.',
      });
      expect(prismaMock.sessionFeedback.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.sessionFeedback.create).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.submitSessionFeedback',
      case: 'happy',
      mode: 'direct',
      title: 'speichert Bewertungen nach einem gestarteten Quiz',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'FINISHED',
        quizStarted: true,
      });
      prismaMock.sessionFeedback.findUnique.mockResolvedValue(null);
      prismaMock.sessionFeedback.create.mockResolvedValue({ id: 'feedback-1' });

      await expect(caller.submitSessionFeedback(feedbackInput)).resolves.toEqual({ success: true });
      expect(prismaMock.sessionFeedback.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'sess-1',
          participantId: feedbackInput.participantId,
          overallRating: 4,
          questionQualityRating: 5,
          wouldRepeat: true,
        },
      });
    },
  );
});
