/**
 * Session-Router (Story 2.1a, 3.1, 4.6, 4.7, 0.5).
 */
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
  type SessionExportDTO,
  type QuestionExportEntry,
  type QuestionType,
  type OptionDistributionEntry,
  type FreetextAggregateEntry,
  type BonusTokenEntryDTO,
} from '@arsnova/shared-types';
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

  /** Session-Info per Code (für Beitritt, Story 3.1). */
  getInfo: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionInfoDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: { quiz: { select: { name: true } }, _count: { select: { participants: true } } },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      return {
        id: session.id,
        code: session.code,
        type: session.type,
        status: session.status,
        quizName: session.quiz?.name ?? null,
        title: session.title ?? null,
        participantCount: session._count.participants,
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
  onStatusChanged: publicProcedure
    .input(GetSessionInfoInputSchema)
    .subscription(async function* ({ input }) {
      const code = input.code.toUpperCase();
      let lastJson = '';
      while (true) {
        const session = await prisma.session.findUnique({
          where: { code },
          select: { status: true, currentQuestion: true },
        });
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
        }
        const payload = {
          status: session.status,
          currentQuestion: session.currentQuestion,
        };
        const json = JSON.stringify(payload);
        if (json !== lastJson) {
          lastJson = json;
          yield payload;
        }
        await new Promise((r) => setTimeout(r, 2000));
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
      const allowedFrom = ['LOBBY', 'PAUSED', 'RESULTS'];
      if (!allowedFrom.includes(session.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Nächste Frage nur aus Status LOBBY, PAUSED oder RESULTS. Aktuell: ${session.status}.`,
        });
      }

      const currentIdx = session.currentQuestion ?? -1;
      const nextIdx = currentIdx + 1;

      if (nextIdx >= questionCount) {
        await prisma.session.update({
          where: { id: session.id },
          data: { status: 'FINISHED', currentQuestion: null },
        });
        return { status: 'FINISHED' as const, currentQuestion: null };
      }

      const readingPhase = session.quiz.readingPhaseEnabled;
      const newStatus = readingPhase ? ('QUESTION_OPEN' as const) : ('ACTIVE' as const);
      await prisma.session.update({
        where: { id: session.id },
        data: { status: newStatus, currentQuestion: nextIdx },
      });
      return { status: newStatus, currentQuestion: nextIdx };
    }),

  /** Antwortoptionen freigeben – Lesephase beenden (Story 2.3). Nur bei QUESTION_OPEN. */
  revealAnswers: publicProcedure
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
      if (session.status !== 'QUESTION_OPEN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Antworten freigeben nur im Status QUESTION_OPEN (Lesephase).',
        });
      }
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'ACTIVE' },
      });
      return {
        status: 'ACTIVE' as const,
        currentQuestion: session.currentQuestion,
      };
    }),

  /** Ergebnis anzeigen (Story 2.3). Nur bei ACTIVE. */
  revealResults: publicProcedure
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
      if (session.status !== 'ACTIVE') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ergebnis anzeigen nur im Status ACTIVE.',
        });
      }
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'RESULTS' },
      });
      return {
        status: 'RESULTS' as const,
        currentQuestion: session.currentQuestion,
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
      return {
        order: question.order,
        text: question.text,
        type: question.type as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'FREETEXT' | 'RATING',
        answers: question.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })),
      };
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
