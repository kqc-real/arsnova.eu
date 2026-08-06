import { beforeEach, describe, expect, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { hostAuthMocks, invalidSessionCodeMock, prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    quiz: {
      findUnique: vi.fn(),
    },
    vote: {
      findMany: vi.fn(),
    },
    bonusToken: {
      findFirst: vi.fn(),
    },
    sessionFeedback: {
      findUnique: vi.fn(),
    },
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
  invalidSessionCodeMock: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

vi.mock('../lib/invalidSessionCode', () => ({
  rejectInvalidSessionCode: invalidSessionCodeMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const QUESTION_ID = '7b9fdced-5f8f-4cfa-9176-454fac9570ae';
const PARTICIPANT_ID = '8c0edced-5f8f-4cfa-9176-454fac9570af';
const OTHER_PARTICIPANT_ID = '9d1edced-5f8f-4cfa-9176-454fac9570a0';

describe('session remaining DoD procedure evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    invalidSessionCodeMock.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND' }));
  });

  trpcDodIt(
    {
      procedure: 'session.getBonusTokens',
      case: 'happy',
      mode: 'direct',
      title: 'liefert die sortierten Bonus-Codes einer host-autorisierten Session',
    },
    async () => {
      const generatedAt = new Date('2026-08-06T10:00:00.000Z');
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: 'ABC123',
        quiz: { name: 'Chemie' },
        bonusTokens: [
          {
            token: 'BNS-TEST-1234',
            nickname: 'Ada',
            quizName: 'Chemie',
            totalScore: 42,
            rank: 1,
            generatedAt,
          },
        ],
      });

      const result = await caller.getBonusTokens({ code: 'ABC123' });

      expect(prismaMock.session.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: 'ABC123' } }),
      );
      expect(result).toEqual({
        sessionCode: 'ABC123',
        quizName: 'Chemie',
        tokens: [
          {
            token: 'BNS-TEST-1234',
            nickname: 'Ada',
            quizName: 'Chemie',
            totalScore: 42,
            rank: 1,
            generatedAt: generatedAt.toISOString(),
          },
        ],
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getBonusTokens',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'verweigert Bonus-Codes ohne gültigen Host-Token',
    },
    async () => {
      hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(caller.getBonusTokens({ code: 'ABC123' })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
      expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getPersonalResult',
      case: 'happy',
      mode: 'direct',
      title: 'berechnet Punktestand, Rang und Bonus-Code aus effektiven Votes',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'FINISHED',
        participants: [{ id: PARTICIPANT_ID }, { id: OTHER_PARTICIPANT_ID }],
      });
      prismaMock.vote.findMany.mockResolvedValue([
        {
          participantId: PARTICIPANT_ID,
          questionId: QUESTION_ID,
          round: 1,
          score: 42,
          responseTimeMs: 1_200,
        },
        {
          participantId: OTHER_PARTICIPANT_ID,
          questionId: QUESTION_ID,
          round: 1,
          score: 21,
          responseTimeMs: 900,
        },
      ]);
      prismaMock.bonusToken.findFirst.mockResolvedValue({ token: 'BNS-TEST-1234' });

      const result = await caller.getPersonalResult({
        code: 'ABC123',
        participantId: PARTICIPANT_ID,
      });

      expect(prismaMock.vote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sessionId: SESSION_ID, round: { in: [1, 2] } } }),
      );
      expect(result).toEqual({ totalScore: 42, rank: 1, bonusToken: 'BNS-TEST-1234' });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getPersonalResult',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt persönliche Ergebnisse vor Session-Ende ab',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'ACTIVE',
        participants: [{ id: PARTICIPANT_ID }],
      });

      await expect(
        caller.getPersonalResult({ code: 'ABC123', participantId: PARTICIPANT_ID }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(prismaMock.vote.findMany).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getHasSubmittedFeedback',
      case: 'happy',
      mode: 'direct',
      title: 'meldet eine vorhandene Session-Bewertung für den angegebenen Teilnehmer',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: SESSION_ID });
      prismaMock.sessionFeedback.findUnique.mockResolvedValue({ id: 'feedback-1' });

      const result = await caller.getHasSubmittedFeedback({
        code: 'ABC123',
        participantId: PARTICIPANT_ID,
      });

      expect(prismaMock.sessionFeedback.findUnique).toHaveBeenCalledWith({
        where: {
          sessionId_participantId: { sessionId: SESSION_ID, participantId: PARTICIPANT_ID },
        },
      });
      expect(result).toEqual({ submitted: true });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getHasSubmittedFeedback',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'gibt fehlende Session-Codes an den gemeinsamen Oracle-Schutz weiter',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(
        caller.getHasSubmittedFeedback({ code: 'ABC123', participantId: PARTICIPANT_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(invalidSessionCodeMock).toHaveBeenCalledWith(undefined, 'ABC123', 'pollReconnect');
    },
  );

  trpcDodIt(
    {
      procedure: 'session.react',
      case: 'happy',
      mode: 'direct',
      title: 'speichert eine Emoji-Reaktion pro Teilnehmer und Frage',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'ACTIVE',
        quizId: '0e2edced-5f8f-4cfa-9176-454fac9570ab',
      });
      prismaMock.quiz.findUnique.mockResolvedValue({ enableEmojiReactions: true });

      await expect(
        caller.react({
          sessionId: SESSION_ID,
          questionId: QUESTION_ID,
          participantId: PARTICIPANT_ID,
          emoji: '👏',
        }),
      ).resolves.toEqual({ ok: true });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.react',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt Emoji-Reaktionen außerhalb einer laufenden Frage ab',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'LOBBY',
        quizId: '0e2edced-5f8f-4cfa-9176-454fac9570ab',
      });

      await expect(
        caller.react({
          sessionId: SESSION_ID,
          questionId: QUESTION_ID,
          participantId: PARTICIPANT_ID,
          emoji: '👏',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(prismaMock.quiz.findUnique).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getReactions',
      case: 'happy',
      mode: 'direct',
      title: 'aggregiert gespeicherte Emoji-Reaktionen für die angefragte Runde',
    },
    async () => {
      const reactionSessionId = '1f3edced-5f8f-4cfa-9176-454fac9570ac';
      const reactionQuestionId = '2a4edced-5f8f-4cfa-9176-454fac9570ad';
      prismaMock.session.findUnique.mockResolvedValue({
        id: reactionSessionId,
        status: 'RESULTS',
        quizId: '3b5edced-5f8f-4cfa-9176-454fac9570ae',
      });
      prismaMock.quiz.findUnique.mockResolvedValue({ enableEmojiReactions: true });
      await caller.react({
        sessionId: reactionSessionId,
        questionId: reactionQuestionId,
        participantId: PARTICIPANT_ID,
        emoji: '🎉',
        round: 2,
      });

      const result = await caller.getReactions({
        sessionId: reactionSessionId,
        questionId: reactionQuestionId,
        round: 2,
      });

      expect(result).toEqual({
        reactions: { '👏': 0, '🎉': 1, '😮': 0, '😂': 0, '😢': 0 },
        total: 1,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getReactions',
      case: 'error',
      mode: 'direct',
      contract: 'VALIDATION',
      title: 'weist nicht erlaubte Reaktionsrunden vor dem Resolver ab',
    },
    async () => {
      await expect(
        caller.getReactions({ sessionId: SESSION_ID, questionId: QUESTION_ID, round: 3 }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    },
  );
});
