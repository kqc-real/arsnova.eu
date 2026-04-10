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
  GetActiveQuizIdsInputSchema,
  JoinSessionInputSchema,
  JoinSessionOutputSchema,
  GetExportDataInputSchema,
  ActiveQuizIdsDTOSchema,
  FreetextSessionExportDTOSchema,
  LiveFreetextDTOSchema,
  SessionInfoDTOSchema,
  SessionExportDTOSchema,
  ParticipantDTOSchema,
  SessionParticipantsPayloadSchema,
  SessionParticipantNicknamesPayloadSchema,
  SessionTeamsPayloadSchema,
  SessionStatusUpdateSchema,
  HostCurrentQuestionDTOSchema,
  QuestionStudentDTOSchema,
  QuestionPreviewDTOSchema,
  QuestionRevealedDTOSchema,
  LeaderboardEntryDTOSchema,
  TeamLeaderboardEntryDTOSchema,
  BonusTokenListDTOSchema,
  GetBonusTokensForQuizInputSchema,
  BonusTokensForQuizOutputSchema,
  GetLastSessionFeedbackForQuizInputSchema,
  LastSessionFeedbackForQuizOutputSchema,
  SubmitSessionFeedbackInputSchema,
  SessionFeedbackSummarySchema,
  PersonalScorecardDTOSchema,
  type SessionExportDTO,
  type QuestionExportEntry,
  type QuestionType,
  type OptionDistributionEntry,
  type FreetextAggregateEntry,
  type BonusTokenEntryDTO,
  type LeaderboardEntryDTO,
  type PeerInstructionSuggestionDTO,
  type TeamLeaderboardEntryDTO,
  type RoundComparisonDTO,
  type RoundDistributionEntry,
  type VoterMigrationEntry,
  UpdateSessionPresetInputSchema,
  UpdateSessionQaTitleInputSchema,
  UpdateSessionQaTitleOutputSchema,
  GetSessionParticipantInputSchema,
  SendEmojiReactionInputSchema,
  EMOJI_REACTIONS,
  DEFAULT_TEAM_COUNT,
  NicknameThemeEnum,
  createQuizHistoryAccessProof,
} from '@arsnova/shared-types';
import { questionCountsTowardsTotalQuestions, questionAffectsStreak } from '../lib/quizScoring';
import { updateMaxParticipantsSingleSession } from '../lib/platformStatistic';

/**
 * In-Memory-Store für Emoji-Reaktionen (Story 5.8).
 * Key: `sessionId:questionId:r{round}` (Peer Instruction: Runde 1 und 2 getrennt).
 * Flüchtig – kein Redis/DB nötig.
 */
const emojiStore = new Map<string, Map<string, string>>();

function getEmojiKey(sessionId: string, questionId: string, round: number): string {
  const r = round >= 1 && round <= 2 ? round : 1;
  return `${sessionId}:${questionId}:r${r}`;
}
import { publicProcedure, router, getClientIp, hostProcedure } from '../trpc';
import { prisma } from '../db';
import { createHostSessionToken } from '../lib/hostAuth';
import {
  checkSessionCreateRate,
  isSessionCodeLockedOut,
  recordFailedSessionCodeAttempt,
  shouldBypassSessionCreateRate,
} from '../lib/rateLimit';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  buildAnswerDisplayOrderForQuiz,
  orderAnswersByDisplayMap,
} from '../lib/answerDisplayOrder';

const QUESTION_TEXT_SHORT_MAX = 100;
const PARTICIPANT_SUBSCRIPTION_POLL_MS = 2000;
const STATUS_SUBSCRIPTION_FAST_POLL_MS = 1000;
const STATUS_SUBSCRIPTION_SLOW_POLL_MS = 2000;
const FAST_STATUS_POLL_SET = new Set(['ACTIVE', 'QUESTION_OPEN', 'DISCUSSION']);
const TEAM_COLORS = [
  '#1E88E5',
  '#43A047',
  '#F4511E',
  '#8E24AA',
  '#FDD835',
  '#00897B',
  '#6D4C41',
  '#5E35B1',
] as const;

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

/** Aggregiert SessionFeedback-Zeilen (getSessionFeedbackSummary / Quiz-Sammlung). */
function buildSessionFeedbackSummaryFromRows(
  feedbacks: Array<{
    overallRating: number;
    questionQualityRating: number | null;
    wouldRepeat: boolean | null;
  }>,
): z.infer<typeof SessionFeedbackSummarySchema> {
  const totalResponses = feedbacks.length;
  if (totalResponses === 0) {
    return {
      totalResponses: 0,
      overallAverage: 0,
      overallDistribution: {},
      questionQualityAverage: null,
      questionQualityDistribution: null,
      wouldRepeatYes: 0,
      wouldRepeatNo: 0,
    };
  }

  const overallDist: Record<string, number> = {};
  let overallSum = 0;
  const qqDist: Record<string, number> = {};
  let qqSum = 0;
  let qqCount = 0;
  let repeatYes = 0;
  let repeatNo = 0;

  for (const f of feedbacks) {
    const key = String(f.overallRating);
    overallDist[key] = (overallDist[key] ?? 0) + 1;
    overallSum += f.overallRating;

    if (f.questionQualityRating !== null && f.questionQualityRating !== undefined) {
      const qqKey = String(f.questionQualityRating);
      qqDist[qqKey] = (qqDist[qqKey] ?? 0) + 1;
      qqSum += f.questionQualityRating;
      qqCount++;
    }

    if (f.wouldRepeat === true) repeatYes++;
    else if (f.wouldRepeat === false) repeatNo++;
  }

  return {
    totalResponses,
    overallAverage: Math.round((overallSum / totalResponses) * 100) / 100,
    overallDistribution: overallDist,
    questionQualityAverage: qqCount > 0 ? Math.round((qqSum / qqCount) * 100) / 100 : null,
    questionQualityDistribution: qqCount > 0 ? qqDist : null,
    wouldRepeatYes: repeatYes,
    wouldRepeatNo: repeatNo,
  };
}

function normalizeQuizHistoryAccessProof(proof: string): Buffer {
  return Buffer.from(proof.trim(), 'utf8');
}

async function assertQuizHistoryAccess(quizId: string, accessProof: string): Promise<void> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      name: true,
      description: true,
      motifImageUrl: true,
      showLeaderboard: true,
      allowCustomNicknames: true,
      defaultTimer: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: true,
      teamMode: true,
      teamCount: true,
      teamAssignment: true,
      teamNames: true,
      backgroundMusic: true,
      nicknameTheme: true,
      bonusTokenCount: true,
      readingPhaseEnabled: true,
      preset: true,
      questions: {
        orderBy: { order: 'asc' },
        select: {
          text: true,
          type: true,
          timer: true,
          difficulty: true,
          order: true,
          ratingMin: true,
          ratingMax: true,
          ratingLabelMin: true,
          ratingLabelMax: true,
          answers: {
            select: {
              text: true,
              isCorrect: true,
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz nicht gefunden.' });
  }

  const expectedProof = normalizeQuizHistoryAccessProof(
    await createQuizHistoryAccessProof({
      name: quiz.name,
      description: quiz.description ?? undefined,
      motifImageUrl: quiz.motifImageUrl ?? null,
      showLeaderboard: quiz.showLeaderboard,
      allowCustomNicknames: quiz.allowCustomNicknames,
      defaultTimer: quiz.defaultTimer,
      enableSoundEffects: quiz.enableSoundEffects,
      enableRewardEffects: quiz.enableRewardEffects,
      enableMotivationMessages: quiz.enableMotivationMessages,
      enableEmojiReactions: quiz.enableEmojiReactions,
      anonymousMode: quiz.anonymousMode,
      teamMode: quiz.teamMode,
      teamCount: quiz.teamCount ?? undefined,
      teamAssignment: quiz.teamAssignment,
      teamNames: quiz.teamNames,
      backgroundMusic: quiz.backgroundMusic ?? undefined,
      nicknameTheme: quiz.nicknameTheme,
      bonusTokenCount: quiz.bonusTokenCount ?? undefined,
      readingPhaseEnabled: quiz.readingPhaseEnabled,
      preset: quiz.preset === 'SERIOUS' ? 'SERIOUS' : 'PLAYFUL',
      questions: quiz.questions.map((question) => ({
        text: question.text,
        type: question.type,
        timer: question.timer,
        difficulty: question.difficulty,
        order: question.order,
        ratingMin: question.ratingMin ?? undefined,
        ratingMax: question.ratingMax ?? undefined,
        ratingLabelMin: question.ratingLabelMin ?? undefined,
        ratingLabelMax: question.ratingLabelMax ?? undefined,
        answers: question.answers.map((answer) => ({
          text: answer.text,
          isCorrect: answer.isCorrect,
        })),
      })),
    }),
  );
  const providedProof = normalizeQuizHistoryAccessProof(accessProof);

  if (
    expectedProof.length !== providedProof.length ||
    !timingSafeEqual(expectedProof, providedProof)
  ) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Zugriff auf diese Quiz-Historie ist nicht erlaubt.',
    });
  }
}

async function collectAuthorizedQuizHistoryIds(
  entries: Array<{ quizId: string; accessProof: string }>,
): Promise<string[]> {
  if (entries.length === 0) {
    return [];
  }

  const quizIds = [...new Set(entries.map((entry) => entry.quizId))];
  const quizzes = await prisma.quiz.findMany({
    where: { id: { in: quizIds } },
    select: {
      id: true,
      name: true,
      description: true,
      motifImageUrl: true,
      showLeaderboard: true,
      allowCustomNicknames: true,
      defaultTimer: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: true,
      teamMode: true,
      teamCount: true,
      teamAssignment: true,
      teamNames: true,
      backgroundMusic: true,
      nicknameTheme: true,
      bonusTokenCount: true,
      readingPhaseEnabled: true,
      preset: true,
      questions: {
        orderBy: { order: 'asc' },
        select: {
          text: true,
          type: true,
          timer: true,
          difficulty: true,
          order: true,
          ratingMin: true,
          ratingMax: true,
          ratingLabelMin: true,
          ratingLabelMax: true,
          answers: {
            select: {
              text: true,
              isCorrect: true,
            },
          },
        },
      },
    },
  });

  const proofByQuizId = new Map<string, Buffer>();
  for (const quiz of quizzes) {
    proofByQuizId.set(
      quiz.id,
      normalizeQuizHistoryAccessProof(
        await createQuizHistoryAccessProof({
          name: quiz.name,
          description: quiz.description ?? undefined,
          motifImageUrl: quiz.motifImageUrl ?? null,
          showLeaderboard: quiz.showLeaderboard,
          allowCustomNicknames: quiz.allowCustomNicknames,
          defaultTimer: quiz.defaultTimer,
          enableSoundEffects: quiz.enableSoundEffects,
          enableRewardEffects: quiz.enableRewardEffects,
          enableMotivationMessages: quiz.enableMotivationMessages,
          enableEmojiReactions: quiz.enableEmojiReactions,
          anonymousMode: quiz.anonymousMode,
          teamMode: quiz.teamMode,
          teamCount: quiz.teamCount ?? undefined,
          teamAssignment: quiz.teamAssignment,
          teamNames: quiz.teamNames,
          backgroundMusic: quiz.backgroundMusic ?? undefined,
          nicknameTheme: quiz.nicknameTheme,
          bonusTokenCount: quiz.bonusTokenCount ?? undefined,
          readingPhaseEnabled: quiz.readingPhaseEnabled,
          preset: quiz.preset === 'SERIOUS' ? 'SERIOUS' : 'PLAYFUL',
          questions: quiz.questions.map((question) => ({
            text: question.text,
            type: question.type,
            timer: question.timer,
            difficulty: question.difficulty,
            order: question.order,
            ratingMin: question.ratingMin ?? undefined,
            ratingMax: question.ratingMax ?? undefined,
            ratingLabelMin: question.ratingLabelMin ?? undefined,
            ratingLabelMax: question.ratingLabelMax ?? undefined,
            answers: question.answers.map((answer) => ({
              text: answer.text,
              isCorrect: answer.isCorrect,
            })),
          })),
        }),
      ),
    );
  }

  return entries.flatMap((entry) => {
    const expectedProof = proofByQuizId.get(entry.quizId);
    const providedProof = normalizeQuizHistoryAccessProof(entry.accessProof);
    if (
      !expectedProof ||
      expectedProof.length !== providedProof.length ||
      !timingSafeEqual(expectedProof, providedProof)
    ) {
      return [];
    }
    return [entry.quizId];
  });
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
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Konnte keinen freien Session-Code erzeugen.',
  });
}

function buildDefaultTeamName(index: number): string {
  return `Team ${String.fromCharCode(65 + index)}`;
}

function normalizeConfiguredTeamNames(teamNames: string[] | null | undefined): string[] {
  if (!Array.isArray(teamNames)) {
    return [];
  }

  return teamNames
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

async function ensureSessionTeams(
  sessionId: string,
  requestedTeamCount: number,
  configuredTeamNames?: string[] | null,
) {
  const effectiveTeamCount = Math.min(8, Math.max(2, requestedTeamCount));
  const teamNames = normalizeConfiguredTeamNames(configuredTeamNames);
  const existing = await prisma.team.findMany({
    where: { sessionId },
    include: { _count: { select: { participants: true } } },
    orderBy: { name: 'asc' },
  });
  if (existing.length > 0) {
    return existing;
  }

  await prisma.team.createMany({
    data: Array.from({ length: effectiveTeamCount }, (_, index) => ({
      sessionId,
      name: teamNames[index] ?? buildDefaultTeamName(index),
      color: TEAM_COLORS[index] ?? null,
    })),
  });

  return prisma.team.findMany({
    where: { sessionId },
    include: { _count: { select: { participants: true } } },
    orderBy: { name: 'asc' },
  });
}

function buildSessionChannels(session: {
  type: 'QUIZ' | 'Q_AND_A';
  quizId?: string | null;
  quiz?: object | null;
  qaEnabled?: boolean | null;
  qaTitle?: string | null;
  qaModerationMode?: boolean | null;
  title?: string | null;
  moderationMode?: boolean | null;
  quickFeedbackEnabled?: boolean | null;
}) {
  const qaEnabled = session.type === 'Q_AND_A' || session.qaEnabled === true;

  return {
    quiz: {
      enabled:
        session.type !== 'Q_AND_A' && (typeof session.quizId === 'string' || session.quiz !== null),
    },
    qa: {
      enabled: qaEnabled,
      title: qaEnabled ? (session.qaTitle ?? session.title ?? null) : null,
      moderationMode: qaEnabled
        ? (session.qaModerationMode ?? session.moderationMode ?? true)
        : false,
    },
    quickFeedback: {
      enabled: session.quickFeedbackEnabled === true,
    },
  };
}

const PLAYFUL_FALLBACK_TIMER_SECONDS = 60;
/** Anteil vollstaendig korrekter Stimmen (SC/MC, Runde 1): Empfehlung nur in diesem Fenster. */
const PEER_INSTRUCTION_MIN_CORRECTNESS_RATIO = 0.35;
const PEER_INSTRUCTION_MAX_CORRECTNESS_RATIO = 0.7;

function resolveQuestionTimer(
  questionTimer: number | null | undefined,
  defaultTimer: number | null | undefined,
  preset: 'PLAYFUL' | 'SERIOUS' | null | undefined,
): number | null {
  if (typeof questionTimer === 'number' && questionTimer > 0) {
    return questionTimer;
  }
  if (typeof defaultTimer === 'number' && defaultTimer > 0) {
    return defaultTimer;
  }
  return preset === 'PLAYFUL' ? PLAYFUL_FALLBACK_TIMER_SECONDS : null;
}

function buildPeerInstructionSuggestion(
  questionType: QuestionType,
  currentRound: number,
  correctVoterCount: number | undefined,
  totalVotes: number,
): PeerInstructionSuggestionDTO | undefined {
  if (currentRound !== 1 || totalVotes <= 0) {
    return undefined;
  }

  if (questionType !== 'SINGLE_CHOICE' && questionType !== 'MULTIPLE_CHOICE') {
    return undefined;
  }

  if (correctVoterCount === undefined) {
    return undefined;
  }

  const correctnessRatio = correctVoterCount / totalVotes;
  if (
    correctnessRatio < PEER_INSTRUCTION_MIN_CORRECTNESS_RATIO ||
    correctnessRatio > PEER_INSTRUCTION_MAX_CORRECTNESS_RATIO
  ) {
    return undefined;
  }

  return {
    suggested: true,
    reason: 'CORRECTNESS_WINDOW',
  };
}

async function buildRoundComparison(
  sessionId: string,
  questionId: string,
  answers: Array<{ id: string; text: string; isCorrect: boolean }>,
): Promise<RoundComparisonDTO> {
  const correctIds = new Set(answers.filter((a) => a.isCorrect).map((a) => a.id));

  type VoteWithAnswers = { participantId: string; selectedAnswers: { answerOptionId: string }[] };

  const buildDistribution = async (
    round: number,
  ): Promise<{
    total: number;
    dist: RoundDistributionEntry[];
    correctCount: number;
    votes: VoteWithAnswers[];
  }> => {
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
    const correctCount =
      correctIds.size > 0
        ? votes.filter((v) => {
            const selected = new Set(v.selectedAnswers.map((sa) => sa.answerOptionId));
            if (selected.size !== correctIds.size) return false;
            for (const id of correctIds) {
              if (!selected.has(id)) return false;
            }
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
    for (const id of correctIds) {
      if (!sel.has(id)) return false;
    }
    return true;
  };

  const answerKey = (v: VoteWithAnswers): string =>
    v.selectedAnswers
      .map((sa) => sa.answerOptionId)
      .sort()
      .join(',');

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
    opinionShift:
      bothRoundsCount > 0
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

/**
 * Generiert BNS-Codes im Format BNS-XXXX-XXXX (12 Zeichen, kryptografisch sicher).
 */
function generateBonusCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = 'BNS-';
  for (let i = 0; i < 4; i++) code += chars[bytes[i]! % chars.length];
  code += '-';
  for (let i = 4; i < 8; i++) code += chars[bytes[i]! % chars.length];
  return code;
}

/**
 * Generiert Bonus-Tokens für die Top X Teilnehmer (Story 4.6).
 * Nur wenn bonusTokenCount konfiguriert und noch keine Tokens existieren.
 */
async function generateBonusTokens(session: {
  id: string;
  quiz: { name: string; bonusTokenCount: number | null; questions: { type: string }[] } | null;
  participants: { id: string; nickname: string }[];
  bonusTokens: { id: string }[];
}): Promise<void> {
  const topX = session.quiz?.bonusTokenCount;
  if (!topX || topX <= 0 || !session.quiz) return;
  if (session.bonusTokens.length > 0) return;

  const votes = await prisma.vote.findMany({
    where: { sessionId: session.id, round: 1 },
    select: { participantId: true, score: true, responseTimeMs: true },
  });

  const stats = new Map<string, { totalScore: number; totalResponseTimeMs: number }>();
  for (const p of session.participants) {
    stats.set(p.id, { totalScore: 0, totalResponseTimeMs: 0 });
  }
  for (const v of votes) {
    const s = stats.get(v.participantId);
    if (!s) continue;
    s.totalScore += v.score;
    s.totalResponseTimeMs += v.responseTimeMs ?? 0;
  }

  const nicknameById = new Map(session.participants.map((p) => [p.id, p.nickname]));
  const ranked = [...stats.entries()]
    .map(([pid, s]) => ({ pid, ...s }))
    .sort((a, b) => b.totalScore - a.totalScore || a.totalResponseTimeMs - b.totalResponseTimeMs);

  // Teilnehmer mit 0 Punkten erhalten keinen Bonus
  const eligible = ranked.filter((e) => e.totalScore > 0);
  const topEntries = eligible.slice(0, topX);
  if (topEntries.length === 0) return;

  const tokenData = topEntries.map((entry, i) => ({
    token: generateBonusCode(),
    sessionId: session.id,
    participantId: entry.pid,
    nickname: nicknameById.get(entry.pid) ?? `Teilnehmende #${i + 1}`,
    quizName: session.quiz!.name,
    totalScore: entry.totalScore,
    rank: i + 1,
  }));

  await prisma.bonusToken.createMany({ data: tokenData });
}

export const sessionRouter = router({
  /** Session erstellen (Story 2.1a). Rate-Limit: 10/h pro IP (Story 0.5). */
  create: publicProcedure
    .input(CreateSessionInputSchema)
    .output(CreateSessionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx);
      if (!shouldBypassSessionCreateRate(ip)) {
        const limit = await checkSessionCreateRate(ip);
        if (!limit.allowed) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `Maximal ${limit.remaining === 0 ? '0' : '10'} Sessions pro Stunde. Bitte später erneut versuchen.`,
            cause: { retryAfterSeconds: limit.retryAfterSeconds },
          });
        }
      }
      const code = await ensureUniqueSessionCode();
      const isQaOnlySession = input.type === 'Q_AND_A';
      const qaEnabled = isQaOnlySession || input.qaEnabled === true;
      const qaTitle = qaEnabled ? input.qaTitle?.trim() || input.title?.trim() || null : null;
      const qaModerationMode = qaEnabled
        ? (input.qaModerationMode ?? input.moderationMode ?? true)
        : false;
      const session = await prisma.session.create({
        data: {
          code,
          type: input.type ?? 'QUIZ',
          quizId: isQaOnlySession ? null : (input.quizId ?? null),
          title: isQaOnlySession ? qaTitle : null,
          moderationMode: isQaOnlySession ? qaModerationMode : false,
          qaEnabled,
          qaTitle,
          qaModerationMode,
          quickFeedbackEnabled: input.quickFeedbackEnabled ?? false,
          status: 'LOBBY',
        },
        include: {
          quiz: { select: { name: true, teamMode: true, teamCount: true, teamNames: true } },
        },
      });
      if (session.type === 'QUIZ' && session.quiz?.teamMode) {
        await ensureSessionTeams(
          session.id,
          session.quiz.teamCount ?? DEFAULT_TEAM_COUNT,
          session.quiz.teamNames,
        );
      }
      const hostToken = await createHostSessionToken(session.code);
      return {
        sessionId: session.id,
        code: session.code,
        status: session.status,
        quizName: session.quiz?.name ?? null,
        hostToken,
      };
    }),

  /** Q&A-Session aus der Lobby starten (Story 8.1).
   * - Nur Q&A (ohne Quiz): LOBBY → ACTIVE, Teilnehmer sehen „Fragerunde läuft“.
   * - Quiz mit Fragen-Kanal: Status bleibt LOBBY – Q&A ist nutzbar, die Quiz-Beitrittsphase (Lobby) bleibt erhalten bis zur ersten Frage. */
  startQa: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true, status: true, type: true, qaEnabled: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.type !== 'Q_AND_A' && session.qaEnabled !== true) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Q&A-Start ist nur für Sessions mit aktiviertem Fragen-Kanal verfügbar.',
        });
      }
      if (session.status !== 'LOBBY') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Q&A-Session kann nur aus Status LOBBY gestartet werden. Aktuell: ${session.status}.`,
        });
      }

      const isQuizWithQaChannel = session.type === 'QUIZ' && session.qaEnabled === true;
      if (isQuizWithQaChannel) {
        return {
          status: 'LOBBY' as const,
          currentQuestion: null,
          currentRound: 1,
        };
      }

      const now = new Date();
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'ACTIVE', statusChangedAt: now },
      });

      return {
        status: 'ACTIVE' as const,
        currentQuestion: null,
        currentRound: 1,
        activeAt: now.toISOString(),
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
          _count: { select: { participants: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const q =
        session.quizId !== null
          ? await prisma.quiz.findUnique({
              where: { id: session.quizId },
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
                motifImageUrl: true,
              },
            })
          : null;
      const serverTime = new Date().toISOString();
      return {
        id: session.id,
        code: session.code,
        type: session.type,
        status: session.status,
        serverTime,
        quizName: q?.name ?? null,
        quizMotifImageUrl: q?.motifImageUrl ?? null,
        title: session.title ?? null,
        channels: buildSessionChannels(session),
        participantCount: session._count.participants,
        ...(q && {
          nicknameTheme: (() => {
            const nt = NicknameThemeEnum.safeParse(q.nicknameTheme);
            return nt.success ? nt.data : 'NOBEL_LAUREATES';
          })(),
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
  getParticipants: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionParticipantsPayloadSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
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
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      return {
        participants: session.participants.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          teamId: p.teamId ?? null,
          teamName: p.team?.name ?? null,
        })),
        participantCount: session.participants.length,
      };
    }),

  /** Öffentliche Nickname-Liste für Kollisionserkennung beim Join. */
  getParticipantNicknames: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionParticipantNicknamesPayloadSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          participants: {
            orderBy: { joinedAt: 'asc' },
            select: { nickname: true },
          },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      return {
        nicknames: session.participants.map((participant) => participant.nickname),
        participantCount: session.participants.length,
      };
    }),

  /** Öffentliche Self-Info für Teilnehmende ohne komplette Teilnehmerliste preiszugeben. */
  getParticipantSelf: publicProcedure
    .input(GetSessionParticipantInputSchema)
    .output(ParticipantDTOSchema.nullable())
    .query(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const participant = await prisma.participant.findFirst({
        where: {
          id: input.participantId,
          sessionId: session.id,
        },
        select: {
          id: true,
          nickname: true,
          teamId: true,
          team: { select: { name: true } },
        },
      });
      if (!participant) {
        return null;
      }

      return {
        id: participant.id,
        nickname: participant.nickname,
        teamId: participant.teamId ?? null,
        teamName: participant.team?.name ?? null,
      };
    }),

  /** Teams einer Session für manuellen Join / Team-Lobby (Story 7.1). */
  getTeams: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionTeamsPayloadSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: { select: { teamMode: true, teamCount: true, teamNames: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (!session.quiz?.teamMode) {
        return { teams: [], teamCount: 0 };
      }

      const teams = await ensureSessionTeams(
        session.id,
        session.quiz.teamCount ?? DEFAULT_TEAM_COUNT,
        session.quiz.teamNames,
      );
      return {
        teams: teams.map((team) => ({
          id: team.id,
          name: team.name,
          color: team.color ?? null,
          memberCount: team._count.participants,
        })),
        teamCount: teams.length,
      };
    }),

  /** Subscription: Lobby-Teilnehmerliste (Story 2.2). Pollt alle 2s und pusht bei Änderung. */
  onParticipantJoined: hostProcedure
    .input(GetSessionInfoInputSchema)
    .subscription(async function* ({ input }) {
      const code = input.code.toUpperCase();
      let lastJson = '';
      while (true) {
        const session = await prisma.session.findUnique({
          where: { code },
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
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
        }
        const payload = {
          participants: session.participants.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            teamId: p.teamId ?? null,
            teamName: p.team?.name ?? null,
          })),
          participantCount: session.participants.length,
        };
        const json = JSON.stringify(payload);
        if (json !== lastJson) {
          lastJson = json;
          yield payload;
        }
        await new Promise((r) => setTimeout(r, PARTICIPANT_SUBSCRIPTION_POLL_MS));
      }
    }),

  /** Subscription: Status-Wechsel (Story 2.3). Pollt alle 2s und pusht bei Änderung. */
  updatePreset: hostProcedure.input(UpdateSessionPresetInputSchema).mutation(async ({ input }) => {
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

  /** Q&A-Kanaltitel ändern (Host; Teilnehmende sehen den Titel beim nächsten getInfo-Poll). */
  updateQaTitle: hostProcedure
    .input(UpdateSessionQaTitleInputSchema)
    .output(UpdateSessionQaTitleOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
        select: { id: true, type: true, qaEnabled: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const qaActive = session.type === 'Q_AND_A' || session.qaEnabled === true;
      if (!qaActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Q&A-Kanal ist nicht aktiv.' });
      }
      const trimmed = input.qaTitle?.trim() ?? '';
      const value = trimmed.length > 0 ? trimmed.slice(0, 200) : null;
      const data: { qaTitle: string | null; title?: string | null } = { qaTitle: value };
      if (session.type === 'Q_AND_A') {
        data.title = value;
      }
      const updated = await prisma.session.update({
        where: { id: session.id },
        data,
        select: { qaTitle: true, title: true },
      });
      return {
        qaTitle: updated.qaTitle,
        title: updated.title,
      };
    }),

  onStatusChanged: publicProcedure.input(GetSessionInfoInputSchema).subscription(async function* ({
    input,
  }) {
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
              defaultTimer: true,
              questions: { orderBy: { order: 'asc' }, select: { timer: true } },
            },
          },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const isActive = session.status === 'ACTIVE';
      const currentTimer =
        isActive && session.currentQuestion !== null
          ? resolveQuestionTimer(
              session.quiz?.questions[session.currentQuestion]?.timer,
              session.quiz?.defaultTimer,
              session.quiz?.preset as 'PLAYFUL' | 'SERIOUS' | undefined,
            )
          : null;
      const payloadBase: {
        status: string;
        currentQuestion: number | null;
        activeAt?: string;
        timer?: number | null;
        preset?: string;
        currentRound?: number;
      } = {
        status: session.status,
        currentQuestion: session.currentQuestion,
        currentRound: session.currentRound,
        preset: (session.quiz?.preset as 'PLAYFUL' | 'SERIOUS') || undefined,
        ...(isActive && {
          activeAt: session.statusChangedAt.toISOString(),
          timer: currentTimer,
        }),
      };
      const json = JSON.stringify(payloadBase);
      if (json !== lastJson) {
        lastJson = json;
        yield { ...payloadBase, serverTime: new Date().toISOString() };
      }
      const pollMs = FAST_STATUS_POLL_SET.has(session.status)
        ? STATUS_SUBSCRIPTION_FAST_POLL_MS
        : STATUS_SUBSCRIPTION_SLOW_POLL_MS;
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }),

  /** Nächste Frage öffnen (Story 2.3). LOBBY/PAUSED/RESULTS/DISCUSSION → QUESTION_OPEN oder ACTIVE; bei Lesephase aus: direkt ACTIVE.
   * Zusätzlich: ACTIVE + currentQuestion null (z. B. nach Q&A-Start aus der Lobby) erlaubt den Start der ersten Quiz-Frage. */
  nextQuestion: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: {
            select: {
              name: true,
              readingPhaseEnabled: true,
              bonusTokenCount: true,
              questions: {
                orderBy: { order: 'asc' },
                select: { id: true, type: true, answers: { select: { id: true } } },
              },
            },
          },
          participants: { select: { id: true, nickname: true } },
          bonusTokens: { select: { id: true }, take: 1 },
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
      const awaitingFirstQuizQuestion =
        session.status === 'ACTIVE' && session.currentQuestion === null;
      if (!allowedFrom.includes(session.status) && !awaitingFirstQuizQuestion) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Nächste Frage nur aus Status LOBBY, PAUSED, RESULTS oder DISCUSSION — oder ACTIVE ohne laufende Frage. Aktuell: ${session.status}.`,
        });
      }

      const currentIdx = session.currentQuestion ?? -1;
      const nextIdx = currentIdx + 1;

      if (nextIdx >= questionCount) {
        const now = new Date();
        await prisma.session.update({
          where: { id: session.id },
          data: {
            status: 'FINISHED',
            currentQuestion: null,
            currentRound: 1,
            statusChangedAt: now,
            endedAt: now,
          },
        });
        await generateBonusTokens(session);
        return { status: 'FINISHED' as const, currentQuestion: null, currentRound: 1 };
      }

      const nextQuestion = session.quiz.questions[nextIdx];
      const skipReadingPhaseForType =
        nextQuestion?.type === 'SURVEY' || nextQuestion?.type === 'RATING';
      const readingPhase = session.quiz.readingPhaseEnabled && !skipReadingPhaseForType;
      const newStatus = readingPhase ? ('QUESTION_OPEN' as const) : ('ACTIVE' as const);

      let answerDisplayOrderPayload: ReturnType<typeof buildAnswerDisplayOrderForQuiz> | undefined;
      if (nextIdx === 0 && (session.answerDisplayOrder ?? null) === null) {
        const built = buildAnswerDisplayOrderForQuiz(session.quiz.questions);
        if (Object.keys(built).length > 0) {
          answerDisplayOrderPayload = built;
        }
      }

      await prisma.session.update({
        where: { id: session.id },
        data: {
          status: newStatus,
          currentQuestion: nextIdx,
          currentRound: 1,
          statusChangedAt: new Date(),
          ...(answerDisplayOrderPayload && { answerDisplayOrder: answerDisplayOrderPayload }),
        },
      });
      return {
        status: newStatus,
        currentQuestion: nextIdx,
        currentRound: 1,
        ...(newStatus === 'ACTIVE' && { activeAt: new Date().toISOString() }),
      };
    }),

  /** Antwortoptionen freigeben – Lesephase beenden (Story 2.3). Nur bei QUESTION_OPEN. */
  revealAnswers: hostProcedure
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
      const now = new Date();
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'ACTIVE', statusChangedAt: now },
      });
      return {
        status: 'ACTIVE' as const,
        currentQuestion: session.currentQuestion,
        currentRound: session.currentRound,
        activeAt: now.toISOString(),
      };
    }),

  /** Ergebnis anzeigen (Story 2.3). Nur bei ACTIVE. */
  revealResults: hostProcedure
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
  startDiscussion: hostProcedure
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
          message: 'Diskussionsphase nur aus Status ACTIVE.',
        });
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
  startSecondRound: hostProcedure
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
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Zweite Runde nur aus Status DISCUSSION.',
        });
      }
      const now = new Date();
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'ACTIVE', currentRound: 2, statusChangedAt: now },
      });
      return {
        status: 'ACTIVE' as const,
        currentQuestion: session.currentQuestion,
        currentRound: 2,
        activeAt: now.toISOString(),
      };
    }),

  /** Aktuelle Frage für Host-Ansicht (Story 2.3): Text + Antwortoptionen inkl. isCorrect. */
  getCurrentQuestionForHost: hostProcedure
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
              defaultTimer: true,
              preset: true,
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

      const answersOrdered = orderAnswersByDisplayMap(
        question.answers,
        question.id,
        session.answerDisplayOrder,
      );

      const base = {
        questionId: question.id,
        order: question.order,
        totalQuestions: questions.length,
        text: question.text,
        type: question.type as
          | 'SINGLE_CHOICE'
          | 'MULTIPLE_CHOICE'
          | 'FREETEXT'
          | 'RATING'
          | 'SURVEY',
        timer: resolveQuestionTimer(
          question.timer,
          session.quiz.defaultTimer,
          session.quiz.preset as 'PLAYFUL' | 'SERIOUS' | undefined,
        ),
        answers: answersOrdered.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })),
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
        const voteWhere = { sessionId: session.id, questionId: question.id, round: currentRound };

        if (question.type === 'RATING') {
          const ratingVotes = await prisma.vote.findMany({
            where: voteWhere,
            select: { ratingValue: true },
          });
          const values = ratingVotes
            .map((v) => v.ratingValue)
            .filter((v): v is number => v !== null && v !== undefined);
          const count = values.length;
          const avg =
            count > 0 ? Math.round((values.reduce((s, v) => s + v, 0) / count) * 10) / 10 : null;
          const dist: Record<string, number> = {};
          for (const v of values) {
            const key = String(v);
            dist[key] = (dist[key] ?? 0) + 1;
          }
          return {
            ...base,
            ratingAvg: avg,
            ratingCount: count,
            ratingDistribution: dist,
            totalVotes: count,
          };
        }

        if (question.type === 'FREETEXT') {
          const freeTextVotes = await prisma.vote.findMany({
            where: voteWhere,
            select: { freeText: true },
          });
          const texts = freeTextVotes
            .map((v) => v.freeText?.trim())
            .filter((t): t is string => !!t);
          return { ...base, freeTextResponses: texts, totalVotes: freeTextVotes.length };
        }

        const choiceVotes = await prisma.vote.findMany({
          where: voteWhere,
          select: { selectedAnswers: { select: { answerOptionId: true } } },
        });

        const totalVotes = choiceVotes.length;
        const answerVoteCounts = new Map<string, number>();
        for (const v of choiceVotes) {
          for (const sa of v.selectedAnswers) {
            answerVoteCounts.set(
              sa.answerOptionId,
              (answerVoteCounts.get(sa.answerOptionId) ?? 0) + 1,
            );
          }
        }

        const correctIds = new Set(answersOrdered.filter((a) => a.isCorrect).map((a) => a.id));
        const correctVoterCount =
          correctIds.size > 0
            ? choiceVotes.filter((v) => {
                const selected = new Set(v.selectedAnswers.map((sa) => sa.answerOptionId));
                if (selected.size !== correctIds.size) return false;
                for (const id of correctIds) {
                  if (!selected.has(id)) return false;
                }
                return true;
              }).length
            : undefined;

        const peerInstructionSuggestion = buildPeerInstructionSuggestion(
          question.type as QuestionType,
          currentRound,
          correctVoterCount,
          totalVotes,
        );

        if (session.status === 'ACTIVE') {
          return {
            ...base,
            totalVotes,
            peerInstructionSuggestion,
          };
        }

        const voteDistribution = answersOrdered.map((a) => ({
          id: a.id,
          text: a.text,
          isCorrect: a.isCorrect,
          voteCount: answerVoteCounts.get(a.id) ?? 0,
          votePercentage:
            totalVotes > 0 ? Math.round(((answerVoteCounts.get(a.id) ?? 0) / totalVotes) * 100) : 0,
        }));

        let roundComparison: RoundComparisonDTO | undefined;
        if (session.status === 'RESULTS' && currentRound === 2) {
          roundComparison = await buildRoundComparison(session.id, question.id, answersOrdered);
        }

        return {
          ...base,
          totalVotes,
          correctVoterCount,
          peerInstructionSuggestion,
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
              defaultTimer: true,
              preset: true,
            },
          },
          _count: { select: { participants: true } },
        },
      });
      if (!session?.quiz) return null;
      const idx = session.currentQuestion;
      if (idx === null || idx === undefined) return null;
      const question = session.quiz.questions[idx];
      if (!question) return null;

      const answersOrdered = orderAnswersByDisplayMap(
        question.answers,
        question.id,
        session.answerDisplayOrder,
      );

      const totalQuestions = session.quiz.questions.length;

      if (session.status === 'QUESTION_OPEN') {
        return QuestionPreviewDTOSchema.parse({
          id: question.id,
          text: question.text,
          type: question.type,
          difficulty: question.difficulty,
          order: question.order,
          totalQuestions,
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
          totalQuestions,
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
          timer: resolveQuestionTimer(
            question.timer,
            session.quiz.defaultTimer,
            session.quiz.preset as 'PLAYFUL' | 'SERIOUS' | undefined,
          ),
          difficulty: question.difficulty,
          order: question.order,
          totalQuestions,
          answers: answersOrdered.map((a) => ({ id: a.id, text: a.text })),
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
        const voteWhere = { sessionId: session.id, questionId: question.id };
        let totalVotes = 0;
        const answerVoteCounts = new Map<string, number>();
        let freeTextResponses: string[] | undefined;

        if (question.type === 'FREETEXT') {
          const votes = await prisma.vote.findMany({
            where: voteWhere,
            select: { freeText: true },
          });
          totalVotes = votes.length;
          freeTextResponses = votes.map((v) => v.freeText?.trim()).filter((t): t is string => !!t);
        } else {
          const votes = await prisma.vote.findMany({
            where: voteWhere,
            select: { selectedAnswers: { select: { answerOptionId: true } } },
          });
          totalVotes = votes.length;
          for (const v of votes) {
            for (const sa of v.selectedAnswers) {
              answerVoteCounts.set(
                sa.answerOptionId,
                (answerVoteCounts.get(sa.answerOptionId) ?? 0) + 1,
              );
            }
          }
        }
        return QuestionRevealedDTOSchema.parse({
          id: question.id,
          text: question.text,
          type: question.type,
          difficulty: question.difficulty,
          order: question.order,
          totalQuestions,
          answers: answersOrdered.map((a) => ({
            id: a.id,
            text: a.text,
            isCorrect: a.isCorrect,
            voteCount: answerVoteCounts.get(a.id) ?? 0,
            votePercentage:
              totalVotes > 0
                ? Math.round(((answerVoteCounts.get(a.id) ?? 0) / totalVotes) * 100)
                : 0,
          })),
          freeTextResponses,
          totalVotes,
        });
      }

      return null;
    }),

  /** Quiz-IDs mit laufender Session, begrenzt auf authorisierte Quizkopien aus der Sammlung. */
  getActiveQuizIds: publicProcedure
    .input(GetActiveQuizIdsInputSchema)
    .output(ActiveQuizIdsDTOSchema)
    .query(async ({ input }) => {
      const authorizedQuizIds = await collectAuthorizedQuizHistoryIds(input);
      if (authorizedQuizIds.length === 0) {
        return [];
      }

      const sessions = await prisma.session.findMany({
        where: {
          status: { not: 'FINISHED' },
          quizId: { in: authorizedQuizIds },
        },
        select: { quizId: true },
        distinct: ['quizId'],
      });

      return sessions
        .map((session) => session.quizId)
        .filter((quizId): quizId is string => typeof quizId === 'string');
    }),

  /** Live-Freitextdaten der aktuell aktiven Frage (Story 1.14, polling-ready). */
  getLiveFreetext: hostProcedure
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

      const question =
        session.quiz?.questions.find((entry) => entry.order === session.currentQuestion) ?? null;
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
  getFreetextSessionExport: hostProcedure
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
        include: {
          quiz: {
            select: {
              name: true,
              teamMode: true,
              teamCount: true,
              teamAssignment: true,
              teamNames: true,
              motifImageUrl: true,
            },
          },
          _count: { select: { participants: true } },
        },
      });
      if (!session) {
        const after = await recordFailedSessionCodeAttempt(ip);
        if (after.locked) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message:
              'Ungültiger Code. Zu viele Fehlversuche – bitte warten Sie vor dem nächsten Versuch.',
            cause: { retryAfterSeconds: after.retryAfterSeconds },
          });
        }
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status === 'FINISHED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Diese Session ist bereits beendet.' });
      }
      let assignedTeamId: string | undefined;
      let assignedTeamName: string | null = null;
      if (session.quiz?.teamMode) {
        const teams = await ensureSessionTeams(
          session.id,
          session.quiz.teamCount ?? DEFAULT_TEAM_COUNT,
          session.quiz.teamNames,
        );
        if (teams.length === 0) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Teams konnten nicht vorbereitet werden.',
          });
        }

        if (session.quiz.teamAssignment === 'MANUAL') {
          if (!input.teamId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bitte wähle ein Team aus.' });
          }
          const selectedTeam = teams.find((team) => team.id === input.teamId);
          if (!selectedTeam) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ungültiges Team.' });
          }
          assignedTeamId = selectedTeam.id;
          assignedTeamName = selectedTeam.name;
        } else {
          const participantIndex = session._count.participants;
          const teamIndex = participantIndex % teams.length;
          const autoTeam = teams[teamIndex]!;
          assignedTeamId = autoTeam.id;
          assignedTeamName = autoTeam.name;
        }
      }
      const participant = await prisma.participant
        .create({
          data: {
            sessionId: session.id,
            nickname: input.nickname.trim().slice(0, 30),
            teamId: assignedTeamId,
          },
        })
        .catch(() => {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Dieser Nickname ist in dieser Session bereits vergeben.',
          });
        });
      // Nach Create zählen (nicht _count+1): bei gleichzeitigen Joins ist der Anfangssnapshot sonst zu niedrig — Rekord/Response falsch.
      const newParticipantCount = await prisma.participant.count({
        where: { sessionId: session.id },
      });
      void updateMaxParticipantsSingleSession(newParticipantCount);
      const serverTime = new Date().toISOString();
      return {
        id: session.id,
        code: session.code,
        type: session.type,
        status: session.status,
        serverTime,
        quizName: session.quiz?.name ?? null,
        quizMotifImageUrl: session.quiz?.motifImageUrl ?? null,
        title: session.title ?? null,
        channels: buildSessionChannels(session),
        participantCount: newParticipantCount,
        participantId: participant.id,
        teamId: assignedTeamId ?? null,
        teamName: assignedTeamName,
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

      const totalScoredQuestions = session.quiz.questions.filter((q) =>
        questionCountsTowardsTotalQuestions(q.type as QuestionType),
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

      const stats = new Map<
        string,
        { totalScore: number; correctCount: number; totalResponseTimeMs: number }
      >();
      for (const p of session.participants) {
        stats.set(p.id, { totalScore: 0, correctCount: 0, totalResponseTimeMs: 0 });
      }

      for (const v of votes) {
        const s = stats.get(v.participantId);
        if (!s) continue;
        s.totalScore += Number(v.score) || 0;
        s.totalResponseTimeMs += v.responseTimeMs ?? 0;

        if (questionCountsTowardsTotalQuestions(v.question.type as QuestionType)) {
          const correctIds = v.selectedAnswers.filter((sa) => sa.answerOption.isCorrect);
          const allCorrect =
            correctIds.length > 0 && correctIds.length === v.selectedAnswers.length;
          if (allCorrect) s.correctCount++;
        }
      }

      const nicknameById = new Map(session.participants.map((p) => [p.id, p.nickname]));

      const entries: LeaderboardEntryDTO[] = [...stats.entries()]
        .map(([pid, s]) => ({
          rank: 0,
          nickname: nicknameById.get(pid) ?? '?',
          totalScore: Number(s.totalScore) || 0,
          correctCount: s.correctCount,
          totalQuestions: totalScoredQuestions,
          totalResponseTimeMs: s.totalResponseTimeMs,
        }))
        .filter((e) => e.totalScore > 0)
        .sort(
          (a, b) => b.totalScore - a.totalScore || a.totalResponseTimeMs - b.totalResponseTimeMs,
        );

      for (let i = 0; i < entries.length; i++) {
        entries[i].rank = i + 1;
      }

      return entries;
    }),

  /** Team-Leaderboard: Ranking aller Teams nach Gesamtpunktzahl (Story 7.1). */
  getTeamLeaderboard: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(z.array(TeamLeaderboardEntryDTOSchema))
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: { select: { teamMode: true, teamCount: true, teamNames: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (!session.quiz?.teamMode) {
        return [];
      }

      const teams = await ensureSessionTeams(
        session.id,
        session.quiz.teamCount ?? DEFAULT_TEAM_COUNT,
        session.quiz.teamNames,
      );
      const participants = await prisma.participant.findMany({
        where: { sessionId: session.id },
        select: { id: true, teamId: true },
      });
      const votes = await prisma.vote.findMany({
        where: { sessionId: session.id, round: 1 },
        select: { participantId: true, score: true },
      });

      const teamStats = new Map<
        string,
        { teamName: string; teamColor: string | null; totalScore: number; memberCount: number }
      >();
      for (const team of teams) {
        teamStats.set(team.id, {
          teamName: team.name,
          teamColor: team.color ?? null,
          totalScore: 0,
          memberCount: 0,
        });
      }

      const participantTeam = new Map<string, string>();
      for (const participant of participants) {
        if (!participant.teamId) continue;
        participantTeam.set(participant.id, participant.teamId);
        const stats = teamStats.get(participant.teamId);
        if (stats) {
          stats.memberCount += 1;
        }
      }

      for (const vote of votes) {
        const teamId = participantTeam.get(vote.participantId);
        if (!teamId) continue;
        const stats = teamStats.get(teamId);
        if (!stats) continue;
        stats.totalScore += Number(vote.score) || 0;
      }

      const entries: TeamLeaderboardEntryDTO[] = [...teamStats.values()]
        .filter((team) => team.memberCount > 0)
        .sort(
          (a, b) =>
            b.totalScore - a.totalScore ||
            b.memberCount - a.memberCount ||
            a.teamName.localeCompare(b.teamName),
        )
        .map((team, index) => ({
          rank: index + 1,
          teamName: team.teamName,
          teamColor: team.teamColor,
          totalScore: team.totalScore,
          memberCount: team.memberCount,
          averageScore:
            team.memberCount > 0 ? Number((team.totalScore / team.memberCount).toFixed(2)) : 0,
        }));

      return entries;
    }),

  /** Session manuell beenden (Story 4.2, 4.6). Setzt FINISHED, endedAt, generiert Bonus-Codes. */
  end: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: {
          id: true,
          status: true,
          quizId: true,
          quiz: {
            select: {
              name: true,
              bonusTokenCount: true,
              questions: { select: { type: true } },
            },
          },
          participants: { select: { id: true, nickname: true } },
          bonusTokens: { select: { id: true }, take: 1 },
        },
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
        data: {
          status: 'FINISHED',
          currentQuestion: null,
          currentRound: 1,
          statusChangedAt: now,
          endedAt: now,
        },
      });

      await generateBonusTokens(session);

      return { status: 'FINISHED' as const, currentQuestion: null, currentRound: 1 };
    }),

  /** Bonus-Codes für Dozent abrufen (Story 4.6). Nur bei FINISHED. */
  getBonusTokens: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(BonusTokenListDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: { select: { name: true } },
          bonusTokens: { orderBy: { rank: 'asc' } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      return {
        sessionId: session.id,
        sessionCode: session.code,
        quizName: session.quiz?.name ?? '',
        tokens: session.bonusTokens.map((t) => ({
          token: t.token,
          nickname: t.nickname,
          quizName: t.quizName,
          totalScore: t.totalScore,
          rank: t.rank,
          generatedAt: t.generatedAt.toISOString(),
        })),
      };
    }),

  /**
   * Bonus-Codes aller beendeten Durchläufe zu einer Server-Quiz-ID (Story 4.6).
   * Nicht auf dem Live-Host anzeigen (Mitzeichnen-Risiko) – Abruf in der Quiz-Sammlung.
   */
  getBonusTokensForQuiz: publicProcedure
    .input(GetBonusTokensForQuizInputSchema)
    .output(BonusTokensForQuizOutputSchema)
    .query(async ({ input }) => {
      await assertQuizHistoryAccess(input.quizId, input.accessProof);

      const sessions = await prisma.session.findMany({
        where: {
          quizId: input.quizId,
          status: 'FINISHED',
          bonusTokens: { some: {} },
        },
        orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }],
        take: 25,
        include: {
          quiz: { select: { name: true } },
          bonusTokens: { orderBy: { rank: 'asc' } },
        },
      });

      return {
        sessions: sessions.map((session) => ({
          sessionCode: session.code,
          quizName: session.quiz?.name ?? '',
          endedAt: session.endedAt?.toISOString() ?? null,
          tokens: session.bonusTokens.map((t) => ({
            token: t.token,
            nickname: t.nickname,
            quizName: t.quizName,
            totalScore: t.totalScore,
            rank: t.rank,
            generatedAt: t.generatedAt.toISOString(),
          })),
        })),
      };
    }),

  /**
   * Aggregiertes Session-Feedback der zuletzt beendeten Live-Session mit mindestens einer Bewertung
   * (Quiz-Sammlung; gleicher quizId-Zugriff wie getBonusTokensForQuiz).
   */
  getLastSessionFeedbackForQuiz: publicProcedure
    .input(GetLastSessionFeedbackForQuizInputSchema)
    .output(LastSessionFeedbackForQuizOutputSchema)
    .query(async ({ input }) => {
      await assertQuizHistoryAccess(input.quizId, input.accessProof);

      const session = await prisma.session.findFirst({
        where: {
          quizId: input.quizId,
          status: 'FINISHED',
          sessionFeedbacks: { some: {} },
        },
        orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }],
        select: { id: true, endedAt: true },
      });
      if (!session) {
        return null;
      }

      const feedbacks = await prisma.sessionFeedback.findMany({
        where: { sessionId: session.id },
      });
      const summary = buildSessionFeedbackSummaryFromRows(feedbacks);
      if (summary.totalResponses === 0) {
        return null;
      }

      return {
        endedAt: session.endedAt?.toISOString() ?? null,
        summary,
      };
    }),

  /** Persönliche Scorecard nach einer Frage (Story 5.6). Abrufbar bei Status RESULTS oder FINISHED. */
  getPersonalScorecard: publicProcedure
    .input(
      z.object({
        code: z.string().length(6),
        participantId: z.string().uuid(),
        questionIndex: z.number().int().min(0),
        round: z.number().int().min(1).max(2).optional().default(1),
      }),
    )
    .output(PersonalScorecardDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: {
            include: {
              questions: {
                orderBy: { order: 'asc' },
                include: { answers: { select: { id: true, isCorrect: true } } },
              },
            },
          },
          participants: { select: { id: true } },
        },
      });
      if (!session?.quiz) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session oder Quiz nicht gefunden.' });
      }
      if (!['RESULTS', 'FINISHED', 'DISCUSSION', 'PAUSED'].includes(session.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Scorecard nur bei RESULTS, DISCUSSION, PAUSED oder FINISHED verfügbar.',
        });
      }

      const question = session.quiz.questions[input.questionIndex];
      if (!question) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }

      const questionType = question.type as QuestionType;
      const isScored = questionAffectsStreak(questionType);
      const correctIds = question.answers.filter((a) => a.isCorrect).map((a) => a.id);

      const myVote = await prisma.vote.findUnique({
        where: {
          sessionId_participantId_questionId_round: {
            sessionId: session.id,
            participantId: input.participantId,
            questionId: question.id,
            round: input.round,
          },
        },
        select: {
          score: true,
          streakCount: true,
          streakBonus: true,
          selectedAnswers: { select: { answerOptionId: true } },
        },
      });

      const baseScore =
        myVote && isScored
          ? myVote.streakBonus > 0
            ? Math.round(myVote.score / myVote.streakBonus)
            : myVote.score
          : 0;
      const streakCount = myVote?.streakCount ?? 0;
      const streakMultiplier = myVote?.streakBonus ?? 1.0;
      const questionScore = myVote?.score ?? 0;

      let wasCorrect: boolean | null = null;
      if (isScored && myVote) {
        const selectedSet = new Set(myVote.selectedAnswers.map((a) => a.answerOptionId));
        const correctSet = new Set(correctIds);
        wasCorrect =
          selectedSet.size === correctSet.size &&
          [...selectedSet].every((id) => correctSet.has(id));
      }

      // Alle Votes bis einschließlich dieser Frage (für Ranking)
      const questionsUpToNow = session.quiz.questions
        .slice(0, input.questionIndex + 1)
        .map((q) => q.id);
      const allVotes = await prisma.vote.findMany({
        where: {
          sessionId: session.id,
          round: input.round,
          questionId: { in: questionsUpToNow },
        },
        select: { participantId: true, score: true, responseTimeMs: true },
      });

      const totals = new Map<string, { totalScore: number; totalResponseTimeMs: number }>();
      for (const p of session.participants) {
        totals.set(p.id, { totalScore: 0, totalResponseTimeMs: 0 });
      }
      for (const v of allVotes) {
        const t = totals.get(v.participantId);
        if (!t) continue;
        t.totalScore += Number(v.score) || 0;
        t.totalResponseTimeMs += v.responseTimeMs ?? 0;
      }

      const ranked = [...totals.entries()]
        .map(([pid, s]) => ({
          pid,
          totalScore: Number(s.totalScore) || 0,
          totalResponseTimeMs: s.totalResponseTimeMs,
        }))
        .filter((e) => e.totalScore > 0)
        .sort(
          (a, b) => b.totalScore - a.totalScore || a.totalResponseTimeMs - b.totalResponseTimeMs,
        );
      const totalScore = totals.get(input.participantId)?.totalScore ?? 0;
      const myIdx = ranked.findIndex((e) => e.pid === input.participantId);
      const currentRank = totalScore > 0 && myIdx >= 0 ? myIdx + 1 : 0;

      // Vorheriger Rang (nach vorheriger Frage)
      let previousRank: number | null = null;
      if (input.questionIndex > 0) {
        const prevQuestionIds = session.quiz.questions
          .slice(0, input.questionIndex)
          .map((q) => q.id);
        const prevVotes = await prisma.vote.findMany({
          where: {
            sessionId: session.id,
            round: input.round,
            questionId: { in: prevQuestionIds },
          },
          select: { participantId: true, score: true, responseTimeMs: true },
        });
        const prevTotals = new Map<string, { totalScore: number; totalResponseTimeMs: number }>();
        for (const p of session.participants) {
          prevTotals.set(p.id, { totalScore: 0, totalResponseTimeMs: 0 });
        }
        for (const v of prevVotes) {
          const t = prevTotals.get(v.participantId);
          if (!t) continue;
          t.totalScore += Number(v.score) || 0;
          t.totalResponseTimeMs += v.responseTimeMs ?? 0;
        }
        const prevRanked = [...prevTotals.entries()]
          .map(([pid, s]) => ({
            pid,
            totalScore: Number(s.totalScore) || 0,
            totalResponseTimeMs: s.totalResponseTimeMs,
          }))
          .filter((e) => e.totalScore > 0)
          .sort(
            (a, b) => b.totalScore - a.totalScore || a.totalResponseTimeMs - b.totalResponseTimeMs,
          );
        const prevScore = prevTotals.get(input.participantId)?.totalScore ?? 0;
        const prevIdx = prevRanked.findIndex((e) => e.pid === input.participantId);
        previousRank = prevScore > 0 && prevIdx >= 0 ? prevIdx + 1 : 0;
      }

      const rankChange =
        previousRank !== null && currentRank > 0 && previousRank > 0
          ? previousRank - currentRank
          : 0;

      const totalQuestions = session.quiz.questions.length;
      return {
        questionOrder: input.questionIndex + 1,
        totalQuestions,
        wasCorrect,
        correctAnswerIds: wasCorrect === false ? correctIds : undefined,
        questionScore,
        baseScore,
        streakCount,
        streakMultiplier,
        currentRank,
        previousRank,
        rankChange,
        totalScore,
      };
    }),

  /** Persönliches Ergebnis für einen Studenten (Story 4.6: Bonus-Code). */
  getPersonalResult: publicProcedure
    .input(
      z.object({
        code: z.string().length(6),
        participantId: z.string().uuid(),
      }),
    )
    .output(
      z.object({
        totalScore: z.number(),
        rank: z.number(),
        bonusToken: z.string().nullable(),
      }),
    )
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: {
          id: true,
          status: true,
          participants: { select: { id: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status !== 'FINISHED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ergebnis nur nach Session-Ende verfügbar.',
        });
      }

      const votes = await prisma.vote.findMany({
        where: { sessionId: session.id, round: 1 },
        select: { participantId: true, score: true, responseTimeMs: true },
      });

      const stats = new Map<string, { totalScore: number; totalResponseTimeMs: number }>();
      for (const p of session.participants) {
        stats.set(p.id, { totalScore: 0, totalResponseTimeMs: 0 });
      }
      for (const v of votes) {
        const s = stats.get(v.participantId);
        if (!s) continue;
        s.totalScore += v.score;
        s.totalResponseTimeMs += v.responseTimeMs ?? 0;
      }

      const ranked = [...stats.entries()]
        .map(([pid, s]) => ({ pid, ...s }))
        .filter((e) => e.totalScore > 0)
        .sort(
          (a, b) => b.totalScore - a.totalScore || a.totalResponseTimeMs - b.totalResponseTimeMs,
        );

      const myStat = stats.get(input.participantId);
      const myScore = myStat?.totalScore ?? 0;
      const myIndex = ranked.findIndex((e) => e.pid === input.participantId);
      const myRank = myScore > 0 && myIndex >= 0 ? myIndex + 1 : 0;

      const token = await prisma.bonusToken.findFirst({
        where: { sessionId: session.id, participantId: input.participantId },
        select: { token: true },
      });

      return {
        totalScore: myScore,
        rank: myRank,
        bonusToken: token?.token ?? null,
      };
    }),

  /**
   * Liefert aggregierte Export-Daten für eine beendete Session (Story 4.7).
   * Nur für Session-Status FINISHED; nur anonymisierte/aggregierte Daten (DSGVO-konform).
   */
  getExportData: hostProcedure
    .input(GetExportDataInputSchema)
    .output(SessionExportDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
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

      const questionEntries: QuestionExportEntry[] = questions.map(
        (q: QuestionWithAnswersForExport) => {
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
              const rawAnswers = q.answers as Array<{
                id: string;
                text: string;
                isCorrect: boolean;
              }>;
              const orderedOpts = orderAnswersByDisplayMap(
                rawAnswers,
                q.id,
                session.answerDisplayOrder,
              );
              const optionCounts = new Map<string, { count: number; isCorrect?: boolean }>();
              for (const opt of orderedOpts) {
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
              optionDistribution = orderedOpts.map((opt) => {
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
              freetextAggregates = Array.from(byText.entries(), ([text, count]) => ({
                text,
                count,
              }));
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
        },
      );

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

  /** Session-Bewertung abgeben (Story 4.8). Einmalig pro Participant. */
  submitSessionFeedback: publicProcedure
    .input(SubmitSessionFeedbackInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true, status: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status !== 'FINISHED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Bewertung nur nach Session-Ende möglich.',
        });
      }

      const existing = await prisma.sessionFeedback.findUnique({
        where: {
          sessionId_participantId: { sessionId: session.id, participantId: input.participantId },
        },
      });
      if (existing) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Du hast bereits bewertet.' });
      }

      await prisma.sessionFeedback.create({
        data: {
          sessionId: session.id,
          participantId: input.participantId,
          overallRating: input.overallRating,
          questionQualityRating: input.questionQualityRating,
          wouldRepeat: input.wouldRepeat,
        },
      });
      return { success: true };
    }),

  /** Prüfen, ob dieser Teilnehmer bereits eine Session-Bewertung abgegeben hat (Story 4.8). */
  getHasSubmittedFeedback: publicProcedure
    .input(
      z.object({
        code: z.string().length(6),
        participantId: z.string().uuid(),
      }),
    )
    .output(z.object({ submitted: z.boolean() }))
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const existing = await prisma.sessionFeedback.findUnique({
        where: {
          sessionId_participantId: { sessionId: session.id, participantId: input.participantId },
        },
      });
      return { submitted: !!existing };
    }),

  /** Aggregierte Session-Bewertung abrufen (Story 4.8). Für Dozent und Teilnehmende. */
  getSessionFeedbackSummary: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionFeedbackSummarySchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const feedbacks = await prisma.sessionFeedback.findMany({
        where: { sessionId: session.id },
      });

      return buildSessionFeedbackSummaryFromRows(feedbacks);
    }),

  /** Emoji-Reaktion senden (Story 5.8). Max 1 pro Teilnehmer pro Frage. */
  react: publicProcedure
    .input(SendEmojiReactionInputSchema)
    .output(z.object({ ok: z.boolean() }))
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: { id: true, status: true, quizId: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status !== 'ACTIVE' && session.status !== 'RESULTS') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Emoji-Reaktionen nur während Abstimmung oder Ergebnis-Phase.',
        });
      }

      const quiz = session.quizId
        ? await prisma.quiz.findUnique({
            where: { id: session.quizId },
            select: { enableEmojiReactions: true },
          })
        : null;
      if (!quiz?.enableEmojiReactions) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Emoji-Reaktionen sind deaktiviert.' });
      }

      const round = input.round ?? 1;
      const key = getEmojiKey(input.sessionId, input.questionId, round);
      let map = emojiStore.get(key);
      if (!map) {
        map = new Map();
        emojiStore.set(key, map);
      }

      map.set(input.participantId, input.emoji);

      return { ok: true };
    }),

  /** Emoji-Reaktionen für eine Frage abrufen (Story 5.8, Host/Beamer). */
  getReactions: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        questionId: z.string().uuid(),
        round: z.number().int().min(1).max(2).optional().default(1),
      }),
    )
    .output(
      z.object({
        reactions: z.record(z.string(), z.number()),
        total: z.number(),
      }),
    )
    .query(({ input }) => {
      const round = input.round ?? 1;
      const key = getEmojiKey(input.sessionId, input.questionId, round);
      const map = emojiStore.get(key);
      if (!map || map.size === 0) {
        const empty: Record<string, number> = {};
        for (const e of EMOJI_REACTIONS) empty[e] = 0;
        return { reactions: empty, total: 0 };
      }
      const counts: Record<string, number> = {};
      for (const e of EMOJI_REACTIONS) counts[e] = 0;
      for (const emoji of map.values()) {
        if (emoji in counts) counts[emoji]++;
      }
      return { reactions: counts, total: map.size };
    }),
});
