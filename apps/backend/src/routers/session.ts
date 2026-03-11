/**
 * Session-Router (Story 2.1a, 3.1, 4.1, 4.2, 4.6, 4.7, 0.5).
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  CreateSessionInputSchema,
  CreateSessionOutputSchema,
  GetSessionInfoInputSchema,
  GetLiveFreetextInputSchema,
  JoinSessionInputSchema,
  JoinSessionOutputSchema,
  GetExportDataInputSchema,
  ActiveQuizIdsDTOSchema,
  FreetextSessionExportDTOSchema,
  LiveFreetextDTOSchema,
  SessionInfoDTOSchema,
  SessionExportDTOSchema,
  SessionParticipantsPayloadSchema,
  SessionStatusUpdateSchema,
  HostCurrentQuestionDTOSchema,
  QuestionStudentDTOSchema,
  QuestionPreviewDTOSchema,
  QuestionRevealedDTOSchema,
  LeaderboardEntryDTOSchema,
  type SessionExportDTO,
  type QuestionExportEntry,
  type QuestionType,
  type OptionDistributionEntry,
  type FreetextAggregateEntry,
  type BonusTokenEntryDTO,
  type LeaderboardEntryDTO,
  type RoundComparisonDTO,
  type RoundDistributionEntry,
  type VoterMigrationEntry,
  UpdateSessionPresetInputSchema,
} from '@arsnova/shared-types';
import { questionCountsTowardsTotalQuestions } from '../lib/quizScoring';
import { publicProcedure, router, getClientIp } from '../trpc';
import { prisma } from '../db';
import {
  checkSessionCreateRate,
  isSessionCodeLockedOut,
  recordFailedSessionCodeAttempt,
} from '../lib/rateLimit';
import { randomBytes } from 'crypto';

const QUESTION_TEXT_SHORT_MAX = 100;

/** Typen für getExportData-Callbacks (vermeidet implizites any). */
interface QuestionWithAnswersForExport {
  id: string;
  order: number;
  text: string;
  type: string;
  answers: Array<{ id: string; text: string; isCorrect: boolean }>;
}
interface VoteForExport {
  selectedAnswers: Array<{ answerOptionId: string }>;
  freeText?: string | null;
  ratingValue?: number | null;
  score?: number | null;
}
interface BonusTokenForExport {
  token: string;
  nickname: string;
  quizName: string;
  totalScore: number;
  rank: number;
  generatedAt: Date;
}

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes(1)[0]! % chars.length];
  }
  return code;
}

async function ensureUniqueSessionCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateSessionCode();
    const existing = await prisma.session.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Konnte keinen freien Session-Code erzeugen.' });
}

async function buildRoundComparison(
  sessionId: string,
  questionId: string,
  answers: Array<{ id: string; text: string; isCorrect: boolean }>,
): Promise<RoundComparisonDTO> {
  const correctIds = new Set(answers.filter((a) => a.isCorrect).map((a) => a.id));

  type VoteWithAnswers = { participantId: string; selectedAnswers: { answerOptionId: string }[] };

  const buildDistribution = async (round: number): Promise<{ total: number; dist: RoundDistributionEntry[]; correctCount: number; votes: VoteWithAnswers[] }> => {
    const votes = await prisma.vote.findMany({
      where: { sessionId, questionId, round },
      include: { selectedAnswers: true },
    });
    const total = votes.length;
    const counts = new Map<string, number>();
    for (const v of votes) {
      for (const sa of v.selectedAnswers) {
        counts.set(sa.answerOptionId, (counts.get(sa.answerOptionId) ?? 0) + 1);
      }
    }
    const dist: RoundDistributionEntry[] = answers.map((a) => ({
      id: a.id,
      text: a.text,
      isCorrect: a.isCorrect,
      voteCount: counts.get(a.id) ?? 0,
      votePercentage: total > 0 ? Math.round(((counts.get(a.id) ?? 0) / total) * 100) : 0,
    }));
    const correctCount = correctIds.size > 0
      ? votes.filter((v) => {
          const selected = new Set(v.selectedAnswers.map((sa) => sa.answerOptionId));
          if (selected.size !== correctIds.size) return false;
          for (const id of correctIds) { if (!selected.has(id)) return false; }
          return true;
        }).length
      : 0;
    return { total, dist, correctCount, votes };
  };

  const r1 = await buildDistribution(1);
  const r2 = await buildDistribution(2);

  const isCorrectVote = (v: VoteWithAnswers): boolean => {
    if (correctIds.size === 0) return false;
    const sel = new Set(v.selectedAnswers.map((sa) => sa.answerOptionId));
    if (sel.size !== correctIds.size) return false;
    for (const id of correctIds) { if (!sel.has(id)) return false; }
    return true;
  };

  const answerKey = (v: VoteWithAnswers): string =>
    v.selectedAnswers.map((sa) => sa.answerOptionId).sort().join(',');

  const r1ByParticipant = new Map(r1.votes.map((v) => [v.participantId, v]));
  const r2ByParticipant = new Map(r2.votes.map((v) => [v.participantId, v]));

  const answerTextById = new Map(answers.map((a) => [a.id, a.text]));

  const primaryAnswer = (v: VoteWithAnswers): string =>
    v.selectedAnswers.length > 0 ? v.selectedAnswers[0]!.answerOptionId : '';

  let bothRoundsCount = 0;
  let changedCount = 0;
  let wrongToCorrectCount = 0;
  let correctToWrongCount = 0;

  const migrationCounts = new Map<string, number>();

  for (const [pid, v1] of r1ByParticipant) {
    const v2 = r2ByParticipant.get(pid);
    if (!v2) continue;
    bothRoundsCount++;
    if (answerKey(v1) !== answerKey(v2)) {
      changedCount++;
      const wasCorrect = isCorrectVote(v1);
      const nowCorrect = isCorrectVote(v2);
      if (!wasCorrect && nowCorrect) wrongToCorrectCount++;
      if (wasCorrect && !nowCorrect) correctToWrongCount++;

      const fromId = primaryAnswer(v1);
      const toId = primaryAnswer(v2);
      if (fromId && toId) {
        const mKey = `${fromId}|${toId}`;
        migrationCounts.set(mKey, (migrationCounts.get(mKey) ?? 0) + 1);
      }
    }
  }

  const migrations: VoterMigrationEntry[] = [];
  for (const [mKey, count] of migrationCounts) {
    const [fromId, toId] = mKey.split('|');
    const fromText = answerTextById.get(fromId!) ?? fromId!;
    const toText = answerTextById.get(toId!) ?? toId!;
    migrations.push({ from: fromText, to: toText, count });
  }
  migrations.sort((a, b) => b.count - a.count);

  return {
    round1Total: r1.total,
    round2Total: r2.total,
    round1Distribution: r1.dist,
    round2Distribution: r2.dist,
    round1CorrectCount: r1.correctCount,
    round2CorrectCount: r2.correctCount,
    opinionShift: bothRoundsCount > 0
      ? {
          bothRoundsCount,
          changedCount,
          changedPercentage: Math.round((changedCount / bothRoundsCount) * 100),
          wrongToCorrectCount: correctIds.size > 0 ? wrongToCorrectCount : undefined,
          correctToWrongCount: correctIds.size > 0 ? correctToWrongCount : undefined,
          migrations: migrations.length > 0 ? migrations : undefined,
        }
      : undefined,
  };
}

export const sessionRouter = router({
  /** Session erstellen (Story 2.1a). Rate-Limit: 10/h pro IP (Story 0.5). */
  create: publicProcedure
    .input(CreateSessionInputSchema)
    .output(CreateSessionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx);
      const limit = await checkSessionCreateRate(ip);
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Maximal ${limit.remaining === 0 ? '0' : '10'} Sessions pro Stunde. Bitte später erneut versuchen.`,
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }
      const code = await ensureUniqueSessionCode();
      const session = await prisma.session.create({
        data: {
          code,
          type: input.type ?? 'QUIZ',
          quizId: input.quizId ?? null,
          title: input.title ?? null,
          moderationMode: input.moderationMode ?? false,
          status: 'LOBBY',
        },
        include: { quiz: { select: { name: true } } },
      });
      return {
        sessionId: session.id,
        code: session.code,
        status: session.status,
        quizName: session.quiz?.name ?? null,
      };
    }),

  /** Session-Info per Code (für Beitritt, Story 3.1, 3.2). Enthält Nickname-Konfiguration bei QUIZ. */
  getInfo: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionInfoDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: {
            select: {
              name: true,
              nicknameTheme: true,
              allowCustomNicknames: true,
              anonymousMode: true,
              showLeaderboard: true,
              enableSoundEffects: true,
              enableRewardEffects: true,
              enableMotivationMessages: true,
              enableEmojiReactions: true,
              readingPhaseEnabled: true,
              defaultTimer: true,
              backgroundMusic: true,
              teamMode: true,
              teamCount: true,
              teamAssignment: true,
              bonusTokenCount: true,
              preset: true,
            },
          },
          _count: { select: { participants: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const q = session.quiz;
      return {
        id: session.id,
        code: session.code,
        type: session.type,
        status: session.status,
        quizName: q?.name ?? null,
        title: session.title ?? null,
        participantCount: session._count.participants,
        ...(q && {
          nicknameTheme: q.nicknameTheme ?? 'NOBEL_LAUREATES',
          allowCustomNicknames: q.allowCustomNicknames,
          anonymousMode: q.anonymousMode,
          showLeaderboard: q.showLeaderboard,
          enableSoundEffects: q.enableSoundEffects,
          enableRewardEffects: q.enableRewardEffects,
          enableMotivationMessages: q.enableMotivationMessages,
          enableEmojiReactions: q.enableEmojiReactions,
          readingPhaseEnabled: q.readingPhaseEnabled,
          defaultTimer: q.defaultTimer,
          backgroundMusic: q.backgroundMusic,
          teamMode: q.teamMode,
          teamCount: q.teamCount,
          teamAssignment: q.teamAssignment,
          bonusTokenCount: q.bonusTokenCount,
          preset: q.preset as 'PLAYFUL' | 'SERIOUS',
        }),
      };
    }),

  /** Teilnehmerliste einer Session (Story 2.2 Lobby). */
  getParticipants: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionParticipantsPayloadSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: { participants: { orderBy: { joinedAt: 'asc' }, select: { id: true, nickname: true } } },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      return {
        participants: session.participants.map((p) => ({ id: p.id, nickname: p.nickname })),
        participantCount: session.participants.length,
      };
    }),

  /** Subscription: Lobby-Teilnehmerliste (Story 2.2). Pollt alle 2s und pusht bei Änderung. */
  onParticipantJoined: publicProcedure
    .input(GetSessionInfoInputSchema)
    .subscription(async function* ({ input }) {
      const code = input.code.toUpperCase();
      let lastJson = '';
      while (true) {
        const session = await prisma.session.findUnique({
          where: { code },
          include: { participants: { orderBy: { joinedAt: 'asc' }, select: { id: true, nickname: true } } },
        });
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
        }
        const payload = {
          participants: session.participants.map((p) => ({ id: p.id, nickname: p.nickname })),
          participantCount: session.participants.length,
        };
        const json = JSON.stringify(payload);
        if (json !== lastJson) {
          lastJson = json;
          yield payload;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }),

  /** Subscription: Status-Wechsel (Story 2.3). Pollt alle 2s und pusht bei Änderung. */
  updatePreset: publicProcedure
    .input(UpdateSessionPresetInputSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true, quizId: true },
      });
      if (!session || !session.quizId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      await prisma.quiz.update({
        where: { id: session.quizId },
        data: { preset: input.preset },
      });
      return { preset: input.preset };
    }),

  onStatusChanged: publicProcedure
    .input(GetSessionInfoInputSchema)
    .subscription(async function* ({ input }) {
      const code = input.code.toUpperCase();
      let lastJson = '';
      while (true) {
        const session = await prisma.session.findUnique({
          where: { code },
          select: {
            status: true,
            currentQuestion: true,
            currentRound: true,
            statusChangedAt: true,
            quiz: {
              select: {
                preset: true,
                questions: { orderBy: { order: 'asc' }, select: { timer: true } },
              },
            },
          },
        });
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
        }
        const isActive = session.status === 'ACTIVE';
        const currentTimer = isActive && session.currentQuestion !== null
          ? session.quiz?.questions[session.currentQuestion]?.timer ?? null
          : null;
        const payload: { status: string; currentQuestion: number | null; activeAt?: string; timer?: number | null; preset?: string; currentRound?: number } = {
          status: session.status,
          currentQuestion: session.currentQuestion,
          currentRound: session.currentRound,
          preset: (session.quiz?.preset as 'PLAYFUL' | 'SERIOUS') || undefined,
          ...(isActive && {
            activeAt: session.statusChangedAt.toISOString(),
            timer: currentTimer,
          }),
        };
        const json = JSON.stringify(payload);
        if (json !== lastJson) {
          lastJson = json;
          yield payload;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }),

  /** Nächste Frage öffnen (Story 2.3). LOBBY/PAUSED/RESULTS → QUESTION_OPEN oder ACTIVE; bei Lesephase aus: direkt ACTIVE. */
  nextQuestion: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: {
            select: {
              readingPhaseEnabled: true,
              questions: { orderBy: { order: 'asc' }, select: { id: true } },
            },
          },
        },
      });
      if (!session?.quiz) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session oder Quiz nicht gefunden.' });
      }
      const questionCount = session.quiz.questions.length;
      if (questionCount === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quiz hat keine Fragen.' });
      }
      const allowedFrom = ['LOBBY', 'PAUSED', 'RESULTS', 'DISCUSSION'];
      if (!allowedFrom.includes(session.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Nächste Frage nur aus Status LOBBY, PAUSED, RESULTS oder DISCUSSION. Aktuell: ${session.status}.`,
        });
      }

      const currentIdx = session.currentQuestion ?? -1;
      const nextIdx = currentIdx + 1;

      if (nextIdx >= questionCount) {
        const now = new Date();
        await prisma.session.update({
          where: { id: session.id },
          data: { status: 'FINISHED', currentQuestion: null, currentRound: 1, statusChangedAt: now, endedAt: now },
        });
        return { status: 'FINISHED' as const, currentQuestion: null, currentRound: 1 };
      }

      const readingPhase = session.quiz.readingPhaseEnabled;
      const newStatus = readingPhase ? ('QUESTION_OPEN' as const) : ('ACTIVE' as const);
      await prisma.session.update({
        where: { id: session.id },
        data: { status: newStatus, currentQuestion: nextIdx, currentRound: 1, statusChangedAt: new Date() },
      });
      return {
        status: newStatus,
        currentQuestion: nextIdx,
        currentRound: 1,
        ...(newStatus === 'ACTIVE' && { activeAt: new Date().toISOString() }),
      };
    }),

  /** Antwortoptionen freigeben – Lesephase beenden (Story 2.3). Nur bei QUESTION_OPEN. */
  revealAnswers: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true, status: true, currentQuestion: true, currentRound: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status !== 'QUESTION_OPEN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Antworten freigeben nur im Status QUESTION_OPEN (Lesephase).',
        });
      }
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'ACTIVE', statusChangedAt: new Date() },
      });
      return {
        status: 'ACTIVE' as const,
        currentQuestion: session.currentQuestion,
        currentRound: session.currentRound,
        activeAt: new Date().toISOString(),
      };
    }),

  /** Ergebnis anzeigen (Story 2.3). Nur bei ACTIVE. */
  revealResults: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true, status: true, currentQuestion: true, currentRound: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status !== 'ACTIVE') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ergebnis anzeigen nur im Status ACTIVE.',
        });
      }
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'RESULTS', statusChangedAt: new Date() },
      });
      return {
        status: 'RESULTS' as const,
        currentQuestion: session.currentQuestion,
        currentRound: session.currentRound,
      };
    }),

  /** Diskussionsphase starten (Story 2.7 Peer Instruction). Nur bei ACTIVE (Runde 1). */
  startDiscussion: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true, status: true, currentQuestion: true, currentRound: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Diskussionsphase nur aus Status ACTIVE.' });
      }
      if (session.currentRound !== 1) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Diskussionsphase nur nach Runde 1.' });
      }
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'DISCUSSION', statusChangedAt: new Date() },
      });
      return {
        status: 'DISCUSSION' as const,
        currentQuestion: session.currentQuestion,
        currentRound: 1,
      };
    }),

  /** Zweite Abstimmungsrunde starten (Story 2.7 Peer Instruction). Nur bei DISCUSSION. */
  startSecondRound: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true, status: true, currentQuestion: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status !== 'DISCUSSION') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Zweite Runde nur aus Status DISCUSSION.' });
      }
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'ACTIVE', currentRound: 2, statusChangedAt: new Date() },
      });
      return {
        status: 'ACTIVE' as const,
        currentQuestion: session.currentQuestion,
        currentRound: 2,
        activeAt: new Date().toISOString(),
      };
    }),

  /** Aktuelle Frage für Host-Ansicht (Story 2.3): Text + Antwortoptionen inkl. isCorrect. */
  getCurrentQuestionForHost: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(HostCurrentQuestionDTOSchema.nullable())
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: {
            select: {
              questions: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  order: true,
                  text: true,
                  type: true,
                  timer: true,
                  ratingMin: true,
                  ratingMax: true,
                  ratingLabelMin: true,
                  ratingLabelMax: true,
                  answers: { select: { id: true, text: true, isCorrect: true } },
                },
              },
            },
          },
        },
      });
      if (!session?.quiz) return null;
      const idx = session.currentQuestion;
      if (idx === null || idx === undefined) return null;
      const questions = session.quiz.questions;
      const question = questions[idx] ?? null;
      if (!question) return null;

      const base = {
        order: question.order,
        text: question.text,
        type: question.type as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'FREETEXT' | 'RATING' | 'SURVEY',
        timer: question.timer ?? null,
        answers: question.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })),
        ratingMin: question.ratingMin ?? null,
        ratingMax: question.ratingMax ?? null,
        ratingLabelMin: question.ratingLabelMin ?? null,
        ratingLabelMax: question.ratingLabelMax ?? null,
        currentRound: session.currentRound,
      };

      if (session.status === 'DISCUSSION') {
        return base;
      }

      if (session.status === 'RESULTS' || session.status === 'ACTIVE') {
        const currentRound = session.currentRound;
        const votesForCurrentRound = await prisma.vote.findMany({
          where: { sessionId: session.id, questionId: question.id, round: currentRound },
          include: { selectedAnswers: true },
        });

        if (question.type === 'RATING') {
          const values = votesForCurrentRound.map((v) => v.ratingValue).filter((v): v is number => v !== null && v !== undefined);
          const count = values.length;
          const avg = count > 0 ? Math.round((values.reduce((s, v) => s + v, 0) / count) * 10) / 10 : null;
          const dist: Record<string, number> = {};
          for (const v of values) {
            const key = String(v);
            dist[key] = (dist[key] ?? 0) + 1;
          }
          return { ...base, ratingAvg: avg, ratingCount: count, ratingDistribution: dist, totalVotes: count };
        }

        if (question.type === 'FREETEXT') {
          const texts = votesForCurrentRound
            .map((v) => v.freeText?.trim())
            .filter((t): t is string => !!t);
          return { ...base, freeTextResponses: texts, totalVotes: votesForCurrentRound.length };
        }

        const totalVotes = votesForCurrentRound.length;
        const answerVoteCounts = new Map<string, number>();
        for (const v of votesForCurrentRound) {
          for (const sa of v.selectedAnswers) {
            answerVoteCounts.set(sa.answerOptionId, (answerVoteCounts.get(sa.answerOptionId) ?? 0) + 1);
          }
        }

        const correctIds = new Set(
          question.answers.filter((a) => a.isCorrect).map((a) => a.id),
        );
        const correctVoterCount = correctIds.size > 0
          ? votesForCurrentRound.filter((v) => {
              const selected = new Set(v.selectedAnswers.map((sa) => sa.answerOptionId));
              if (selected.size !== correctIds.size) return false;
              for (const id of correctIds) { if (!selected.has(id)) return false; }
              return true;
            }).length
          : undefined;

        const voteDistribution = question.answers.map((a) => ({
          id: a.id,
          text: a.text,
          isCorrect: a.isCorrect,
          voteCount: answerVoteCounts.get(a.id) ?? 0,
          votePercentage: totalVotes > 0 ? Math.round(((answerVoteCounts.get(a.id) ?? 0) / totalVotes) * 100) : 0,
        }));

        let roundComparison: RoundComparisonDTO | undefined;
        if (session.status === 'RESULTS' && currentRound === 2) {
          roundComparison = await buildRoundComparison(session.id, question.id, question.answers);
        }

        return {
          ...base,
          totalVotes,
          correctVoterCount,
          voteDistribution,
          roundComparison,
        };
      }

      return base;
    }),

  /**
   * Aktuelle Frage für Studenten (Story 3.3a):
   * QUESTION_OPEN → QuestionPreviewDTO (nur Stamm), ACTIVE → QuestionStudentDTO (ohne isCorrect),
   * RESULTS → QuestionRevealedDTO (mit isCorrect + Votes), sonst null.
   */
  getCurrentQuestionForStudent: publicProcedure
    .input(GetSessionInfoInputSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: {
            select: {
              questions: {
                orderBy: { order: 'asc' },
                include: { answers: { select: { id: true, text: true, isCorrect: true } } },
              },
            },
          },
          _count: { select: { votes: true, participants: true } },
        },
      });
      if (!session?.quiz) return null;
      const idx = session.currentQuestion;
      if (idx === null || idx === undefined) return null;
      const question = session.quiz.questions[idx];
      if (!question) return null;

      if (session.status === 'QUESTION_OPEN') {
        return QuestionPreviewDTOSchema.parse({
          id: question.id,
          text: question.text,
          type: question.type,
          difficulty: question.difficulty,
          order: question.order,
          ratingMin: question.ratingMin ?? null,
          ratingMax: question.ratingMax ?? null,
          ratingLabelMin: question.ratingLabelMin ?? null,
          ratingLabelMax: question.ratingLabelMax ?? null,
        });
      }

      if (session.status === 'DISCUSSION') {
        return QuestionPreviewDTOSchema.parse({
          id: question.id,
          text: question.text,
          type: question.type,
          difficulty: question.difficulty,
          order: question.order,
          ratingMin: question.ratingMin ?? null,
          ratingMax: question.ratingMax ?? null,
          ratingLabelMin: question.ratingLabelMin ?? null,
          ratingLabelMax: question.ratingLabelMax ?? null,
        });
      }

      if (session.status === 'ACTIVE') {
        const voteCount = await prisma.vote.count({
          where: { sessionId: session.id, questionId: question.id, round: session.currentRound },
        });
        const participantCount = session._count.participants;
        return QuestionStudentDTOSchema.parse({
          id: question.id,
          text: question.text,
          type: question.type,
          timer: question.timer,
          difficulty: question.difficulty,
          order: question.order,
          answers: question.answers.map((a) => ({ id: a.id, text: a.text })),
          activeAt: session.statusChangedAt.toISOString(),
          ratingMin: question.ratingMin ?? null,
          ratingMax: question.ratingMax ?? null,
          ratingLabelMin: question.ratingLabelMin ?? null,
          ratingLabelMax: question.ratingLabelMax ?? null,
          participantCount,
          totalVotes: voteCount,
          currentRound: session.currentRound,
        });
      }

      if (session.status === 'RESULTS') {
        const votes = await prisma.vote.findMany({
          where: { sessionId: session.id, questionId: question.id },
          include: { selectedAnswers: true },
        });
        const totalVotes = votes.length;
        const answerVoteCounts = new Map<string, number>();
        for (const v of votes) {
          for (const sa of v.selectedAnswers) {
            answerVoteCounts.set(sa.answerOptionId, (answerVoteCounts.get(sa.answerOptionId) ?? 0) + 1);
          }
        }
        return QuestionRevealedDTOSchema.parse({
          id: question.id,
          text: question.text,
          type: question.type,
          difficulty: question.difficulty,
          order: question.order,
          answers: question.answers.map((a) => ({
            id: a.id,
            text: a.text,
            isCorrect: a.isCorrect,
            voteCount: answerVoteCounts.get(a.id) ?? 0,
            votePercentage: totalVotes > 0 ? Math.round(((answerVoteCounts.get(a.id) ?? 0) / totalVotes) * 100) : 0,
          })),
          freeTextResponses: question.type === 'FREETEXT'
            ? votes.map((v) => v.freeText?.trim()).filter((t): t is string => !!t)
            : undefined,
          totalVotes,
        });
      }

      return null;
    }),

  /** Quiz-IDs mit laufender Session (Story 1.10: Löschsperre in Quiz-Liste). */
  getActiveQuizIds: publicProcedure
    .output(ActiveQuizIdsDTOSchema)
    .query(async () => {
      const sessions = await prisma.session.findMany({
        where: {
          status: { not: 'FINISHED' },
          quizId: { not: null },
        },
        select: { quizId: true },
        distinct: ['quizId'],
      });

      return sessions
        .map((session) => session.quizId)
        .filter((quizId): quizId is string => typeof quizId === 'string');
    }),

  /** Live-Freitextdaten der aktuell aktiven Frage (Story 1.14, polling-ready). */
  getLiveFreetext: publicProcedure
    .input(GetLiveFreetextInputSchema)
    .output(LiveFreetextDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: {
            select: {
              questions: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  order: true,
                  type: true,
                  text: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const question = session.quiz?.questions.find((entry) => entry.order === session.currentQuestion) ?? null;
      if (!question || question.type !== 'FREETEXT') {
        return {
          sessionId: session.id,
          questionId: question?.id ?? null,
          questionOrder: question?.order ?? null,
          questionType: (question?.type as QuestionType | undefined) ?? null,
          questionText: question?.text ?? null,
          responses: [],
          updatedAt: new Date().toISOString(),
        };
      }

      const votes = await prisma.vote.findMany({
        where: {
          sessionId: session.id,
          questionId: question.id,
          freeText: { not: null },
        },
        orderBy: { votedAt: 'asc' },
        select: { freeText: true },
      });

      const responses = votes
        .map((vote) => vote.freeText?.trim() ?? '')
        .filter((value) => value.length > 0);

      return {
        sessionId: session.id,
        questionId: question.id,
        questionOrder: question.order,
        questionType: question.type as QuestionType,
        questionText: question.text,
        responses,
        updatedAt: new Date().toISOString(),
      };
    }),

  /** Aggregierte Freitextdaten über alle Freitextfragen einer Session (Story 1.14). */
  getFreetextSessionExport: publicProcedure
    .input(GetLiveFreetextInputSchema)
    .output(FreetextSessionExportDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: {
            select: {
              questions: {
                where: { type: 'FREETEXT' },
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  order: true,
                  text: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const freetextQuestions = session.quiz?.questions ?? [];
      if (freetextQuestions.length === 0) {
        return {
          sessionId: session.id,
          sessionCode: session.code,
          exportedAt: new Date().toISOString(),
          entries: [],
        };
      }

      const questionIds = freetextQuestions.map((question) => question.id);
      const votes = await prisma.vote.findMany({
        where: {
          sessionId: session.id,
          questionId: { in: questionIds },
          freeText: { not: null },
        },
        select: {
          questionId: true,
          freeText: true,
        },
      });

      const votesByQuestion = new Map<string, Map<string, number>>();
      for (const vote of votes) {
        const text = vote.freeText?.trim() ?? '';
        if (!text) continue;
        const aggregates = votesByQuestion.get(vote.questionId) ?? new Map<string, number>();
        aggregates.set(text, (aggregates.get(text) ?? 0) + 1);
        votesByQuestion.set(vote.questionId, aggregates);
      }

      const entries = freetextQuestions.map((question) => {
        const aggregates = votesByQuestion.get(question.id) ?? new Map<string, number>();
        return {
          questionId: question.id,
          questionOrder: question.order,
          questionText: question.text,
          aggregates: [...aggregates.entries()]
            .map(([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text)),
        };
      });

      return {
        sessionId: session.id,
        sessionCode: session.code,
        exportedAt: new Date().toISOString(),
        entries,
      };
    }),

  /** Session beitreten (Story 3.1). Rate-Limit: 5 Fehlversuche/5 Min, 60s Lockout (Story 0.5). */
  join: publicProcedure
    .input(JoinSessionInputSchema)
    .output(JoinSessionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx);
      const lockout = await isSessionCodeLockedOut(ip);
      if (lockout.locked) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Fehlversuche. Bitte warten Sie vor dem nächsten Versuch.',
          cause: { retryAfterSeconds: lockout.retryAfterSeconds },
        });
      }
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: { quiz: { select: { name: true } }, _count: { select: { participants: true } } },
      });
      if (!session) {
        const after = await recordFailedSessionCodeAttempt(ip);
        if (after.locked) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Ungültiger Code. Zu viele Fehlversuche – bitte warten Sie vor dem nächsten Versuch.',
            cause: { retryAfterSeconds: after.retryAfterSeconds },
          });
        }
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status === 'FINISHED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Diese Session ist bereits beendet.' });
      }
      const participant = await prisma.participant.create({
        data: { sessionId: session.id, nickname: input.nickname.trim().slice(0, 30) },
      }).catch(() => {
        throw new TRPCError({ code: 'CONFLICT', message: 'Dieser Nickname ist in dieser Session bereits vergeben.' });
      });
      return {
        id: session.id,
        code: session.code,
        type: session.type,
        status: session.status,
        quizName: session.quiz?.name ?? null,
        title: session.title ?? null,
        participantCount: session._count.participants + 1,
        participantId: participant.id,
      };
    }),

  /** Leaderboard: Ranking aller Teilnehmer nach Gesamtpunktzahl (Story 4.1). */
  getLeaderboard: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(z.array(LeaderboardEntryDTOSchema))
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: {
            select: {
              showLeaderboard: true,
              questions: { select: { type: true } },
            },
          },
          participants: { select: { id: true, nickname: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (!session.quiz?.showLeaderboard) {
        return [];
      }

      const totalScoredQuestions = session.quiz.questions.filter(
        (q) => questionCountsTowardsTotalQuestions(q.type as QuestionType),
      ).length;

      const votes = await prisma.vote.findMany({
        where: { sessionId: session.id, round: 1 },
        select: {
          participantId: true,
          score: true,
          responseTimeMs: true,
          question: { select: { type: true } },
          selectedAnswers: { select: { answerOption: { select: { isCorrect: true } } } },
        },
      });

      const stats = new Map<string, { totalScore: number; correctCount: number; totalResponseTimeMs: number }>();
      for (const p of session.participants) {
        stats.set(p.id, { totalScore: 0, correctCount: 0, totalResponseTimeMs: 0 });
      }

      for (const v of votes) {
        const s = stats.get(v.participantId);
        if (!s) continue;
        s.totalScore += v.score;
        s.totalResponseTimeMs += v.responseTimeMs ?? 0;

        if (questionCountsTowardsTotalQuestions(v.question.type as QuestionType)) {
          const correctIds = v.selectedAnswers.filter((sa) => sa.answerOption.isCorrect);
          const allCorrect = correctIds.length > 0 &&
            correctIds.length === v.selectedAnswers.length;
          if (allCorrect) s.correctCount++;
        }
      }

      const nicknameById = new Map(session.participants.map((p) => [p.id, p.nickname]));

      const entries: LeaderboardEntryDTO[] = [...stats.entries()]
        .map(([pid, s]) => ({
          rank: 0,
          nickname: nicknameById.get(pid) ?? '?',
          totalScore: s.totalScore,
          correctCount: s.correctCount,
          totalQuestions: totalScoredQuestions,
          totalResponseTimeMs: s.totalResponseTimeMs,
        }))
        .sort((a, b) => b.totalScore - a.totalScore || a.totalResponseTimeMs - b.totalResponseTimeMs);

      for (let i = 0; i < entries.length; i++) {
        entries[i].rank = i + 1;
      }

      return entries;
    }),

  /** Session manuell beenden (Story 4.2). Setzt Status FINISHED, endedAt, räumt Redis auf. */
  end: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true, status: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status === 'FINISHED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Session ist bereits beendet.' });
      }
      const now = new Date();
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'FINISHED', currentQuestion: null, currentRound: 1, statusChangedAt: now, endedAt: now },
      });
      return { status: 'FINISHED' as const, currentQuestion: null, currentRound: 1 };
    }),

  /**
   * Liefert aggregierte Export-Daten für eine beendete Session (Story 4.7).
   * Nur für Session-Status FINISHED; nur anonymisierte/aggregierte Daten (DSGVO-konform).
   * TODO: Berechtigung prüfen (nur Dozent/Ersteller der Session), sobald Auth vorhanden.
   */
  getExportData: publicProcedure
    .input(GetExportDataInputSchema)
    .output(SessionExportDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        include: {
          quiz: {
            include: {
              questions: {
                orderBy: { order: 'asc' },
                include: { answers: true },
              },
            },
          },
          votes: {
            include: {
              selectedAnswers: { include: { answerOption: true } },
            },
          },
          bonusTokens: true,
          participants: { select: { id: true } },
        },
      });

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status !== 'FINISHED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Export nur für beendete Sessions verfügbar.',
        });
      }
      if (session.type !== 'QUIZ' || !session.quiz) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Export nur für Quiz-Sessions verfügbar.',
        });
      }

      const quizName = session.quiz.name;
      const questions = session.quiz.questions;
      const votesByQuestion = new Map<string, typeof session.votes>();
      for (const vote of session.votes) {
        const list = votesByQuestion.get(vote.questionId) ?? [];
        list.push(vote);
        votesByQuestion.set(vote.questionId, list);
      }

      const questionEntries: QuestionExportEntry[] = questions.map((q: QuestionWithAnswersForExport) => {
        const votes: VoteForExport[] = votesByQuestion.get(q.id) ?? [];
        const participantCount = votes.length;

        let optionDistribution: OptionDistributionEntry[] | undefined;
        let freetextAggregates: FreetextAggregateEntry[] | undefined;
        let ratingDistribution: Record<string, number> | undefined;
        let ratingAverage: number | undefined;
        let ratingStandardDeviation: number | undefined;
        let averageScore: number | undefined;

        switch (q.type) {
          case 'MULTIPLE_CHOICE':
          case 'SINGLE_CHOICE': {
            const optionCounts = new Map<string, { count: number; isCorrect?: boolean }>();
            for (const opt of q.answers as Array<{ id: string; text: string; isCorrect: boolean }>) {
              optionCounts.set(opt.id, { count: 0, isCorrect: opt.isCorrect });
            }
            for (const v of votes) {
              for (const sa of v.selectedAnswers) {
                const key = sa.answerOptionId;
                const cur = optionCounts.get(key);
                if (cur) {
                  cur.count += 1;
                }
              }
            }
            const total = votes.length || 1;
            optionDistribution = (q.answers as Array<{ id: string; text: string; isCorrect: boolean }>).map((opt) => {
              const { count, isCorrect } = optionCounts.get(opt.id) ?? { count: 0 };
              return {
                text: opt.text,
                count,
                percentage: Math.round((count / total) * 1000) / 10,
                isCorrect,
              };
            });
            break;
          }
          case 'FREETEXT': {
            const byText = new Map<string, number>();
            for (const v of votes as VoteForExport[]) {
              const t = (v.freeText ?? '').trim() || '(leer)';
            byText.set(t, (byText.get(t) ?? 0) + 1);
            }
            freetextAggregates = Array.from(byText.entries(), ([text, count]) => ({ text, count }));
            break;
          }
          case 'RATING': {
            const dist: Record<string, number> = {};
            let sum = 0;
            for (const v of votes as VoteForExport[]) {
              if (v.ratingValue !== null && v.ratingValue !== undefined) {
                const key = String(v.ratingValue);
                dist[key] = (dist[key] ?? 0) + 1;
                sum += v.ratingValue;
              }
            }
            ratingDistribution = Object.keys(dist).length > 0 ? dist : undefined;
            if (votes.length > 0 && Object.keys(dist).length > 0) {
              ratingAverage = Math.round((sum / votes.length) * 100) / 100;
              const avg = sum / votes.length;
              let variance = 0;
              for (const v of votes as VoteForExport[]) {
                if (v.ratingValue !== null && v.ratingValue !== undefined) {
                  variance += (v.ratingValue - avg) ** 2;
                }
              }
              ratingStandardDeviation =
                Math.round(Math.sqrt(variance / votes.length) * 100) / 100;
            }
            break;
          }
          case 'SURVEY':
            // Keine spezielle Verteilung im Export-Schema; participantCount reicht
            break;
          default:
            break;
        }

        if (votes.length > 0 && votes.some((v: VoteForExport) => (v.score ?? 0) > 0)) {
          const totalScore = votes.reduce((a: number, v: VoteForExport) => a + (v.score ?? 0), 0);
          averageScore = Math.round((totalScore / votes.length) * 100) / 100;
        }

        return {
          questionOrder: q.order,
          questionTextShort: q.text.slice(0, QUESTION_TEXT_SHORT_MAX),
          type: q.type as QuestionType,
          participantCount,
          optionDistribution,
          freetextAggregates,
          ratingDistribution,
          ratingAverage,
          ratingStandardDeviation,
          averageScore,
        };
      });

      const bonusTokens: BonusTokenEntryDTO[] | undefined = session.bonusTokens.length
        ? session.bonusTokens.map((t: BonusTokenForExport) => ({
            token: t.token,
            nickname: t.nickname,
            quizName: t.quizName,
            totalScore: t.totalScore,
            rank: t.rank,
            generatedAt: t.generatedAt.toISOString(),
          }))
        : undefined;

      const result: SessionExportDTO = {
        sessionId: session.id,
        sessionCode: session.code,
        quizName,
        finishedAt: session.endedAt?.toISOString() ?? new Date().toISOString(),
        participantCount: session.participants.length,
        questions: questionEntries,
        bonusTokens,
      };

      return result;
    }),
});
