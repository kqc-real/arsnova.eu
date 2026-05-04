/**
 * Session-Router (Story 2.1a, 3.1, 4.1, 4.2, 4.6, 4.7, 0.5).
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import {
  AttachQuizToSessionInputSchema,
  ConfirmReadingReadyInputSchema,
  ConfirmReadingReadyOutputSchema,
  CreateSessionInputSchema,
  CreateSessionOutputSchema,
  GetCurrentQuestionForStudentInputSchema,
  GetSessionInfoInputSchema,
  GetLiveFreetextInputSchema,
  GetActiveQuizIdsInputSchema,
  JoinSessionInputSchema,
  JoinSessionOutputSchema,
  GetExportDataInputSchema,
  ActiveQuizLiveStatesDTOSchema,
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
  GetQuizCollectionHistoryAvailabilityInputSchema,
  GetQuizCollectionHistoryAvailabilityOutputSchema,
  BindQuizHistoryScopeInputSchema,
  BindQuizHistoryScopeOutputSchema,
  BonusTokensForQuizOutputSchema,
  VerifyBonusTokenForQuizInputSchema,
  VerifyBonusTokenForQuizOutputSchema,
  DeleteBonusTokenForQuizInputSchema,
  DeleteBonusTokenForQuizOutputSchema,
  GetLastSessionFeedbackForQuizInputSchema,
  LastSessionFeedbackForQuizOutputSchema,
  SubmitSessionFeedbackInputSchema,
  SessionFeedbackSummarySchema,
  PersonalScorecardDTOSchema,
  ReadingReadyStatusDTOSchema,
  type SessionExportDTO,
  type SessionOnboardingProfileInput,
  type QuestionExportEntry,
  type QuestionType,
  type QuizUploadInput,
  type OptionDistributionEntry,
  type FreetextAggregateEntry,
  type BonusTokenEntryDTO,
  type LeaderboardEntryDTO,
  type NicknameTheme,
  type PeerInstructionSuggestionDTO,
  type TeamLeaderboardEntryDTO,
  type TeamAssignment,
  type RoundComparisonDTO,
  type RoundDistributionEntry,
  type VoterMigrationEntry,
  UpdateSessionPresetInputSchema,
  UpdateSessionQaTitleInputSchema,
  UpdateSessionQaTitleOutputSchema,
  UpdateSessionChannelsOutputSchema,
  GetSessionParticipantInputSchema,
  SendEmojiReactionInputSchema,
  EMOJI_REACTIONS,
  DEFAULT_TEAM_COUNT,
  NicknameThemeEnum,
  createQuizHistoryAccessProof,
  createLegacyQuizHistoryAccessProof,
  resolveEffectiveQuestionTimer,
} from '@arsnova/shared-types';
import {
  isExactCorrectSelection,
  questionCountsTowardsTotalQuestions,
  questionAffectsStreak,
} from '../lib/quizScoring';
import {
  updateDailyMaxParticipants,
  updateMaxParticipantsSingleSession,
} from '../lib/platformStatistic';
import { getActiveParticipantIdsForSession, touchParticipantPresence } from '../lib/presence';
import { markCountdownSessionActive, recordSessionTransitionActivity } from '../lib/loadSignal';
import {
  clearReadingReady,
  getReadingReadyParticipantIds,
  markParticipantReadingReady,
} from '../lib/readingReady';

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

function normalizeTeamLeaderboardScore(rawTotalScore: number, memberCount: number): number {
  if (!Number.isFinite(rawTotalScore) || memberCount <= 0) {
    return 0;
  }

  const averageScore = rawTotalScore / memberCount;
  if (memberCount === 1) {
    return Math.round(averageScore);
  }

  return Math.round(averageScore / 100) * 100;
}

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

const sessionParticipantsQuerySelect = Prisma.validator<Prisma.SessionSelect>()({
  id: true,
  status: true,
  currentQuestion: true,
  participants: {
    orderBy: { joinedAt: 'asc' },
    select: {
      id: true,
      nickname: true,
      teamId: true,
      team: { select: { name: true } },
    },
  },
  quiz: {
    select: {
      questions: {
        orderBy: { order: 'asc' },
        select: { id: true },
      },
    },
  },
});

type SessionParticipantsQueryResult = Prisma.SessionGetPayload<{
  select: typeof sessionParticipantsQuerySelect;
}>;

function getCurrentQuestionIdForReading(session: SessionParticipantsQueryResult): string | null {
  if (session.status !== 'QUESTION_OPEN') return null;
  const idx = session.currentQuestion;
  if (idx === null || idx === undefined) return null;
  return session.quiz?.questions[idx]?.id ?? null;
}

async function buildReadingReadyStatus(
  session: SessionParticipantsQueryResult,
  questionId: string | null,
  participantId?: string,
) {
  if (!questionId) return undefined;

  const activeParticipantIds = await getActiveParticipantIdsForSession(session.id);
  const readyParticipantIds = await getReadingReadyParticipantIds(session.id, questionId);
  const sessionParticipantIds = new Set(session.participants.map((participant) => participant.id));

  const connectedParticipantIds = [...activeParticipantIds].filter((id) =>
    sessionParticipantIds.has(id),
  );
  const readyConnectedCount = connectedParticipantIds.filter((id) =>
    readyParticipantIds.has(id),
  ).length;
  const participantReady = participantId ? readyParticipantIds.has(participantId) : undefined;

  return ReadingReadyStatusDTOSchema.parse({
    connectedCount: connectedParticipantIds.length,
    readyCount: readyConnectedCount,
    allConnectedReady:
      connectedParticipantIds.length > 0 && readyConnectedCount >= connectedParticipantIds.length,
    participantReady,
  });
}

async function buildSessionParticipantsPayload(
  session: SessionParticipantsQueryResult,
  participantId?: string,
) {
  const readingQuestionId = getCurrentQuestionIdForReading(session);
  const readingReady = await buildReadingReadyStatus(session, readingQuestionId, participantId);

  return SessionParticipantsPayloadSchema.parse({
    participants: session.participants.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      teamId: p.teamId ?? null,
      teamName: p.team?.name ?? null,
    })),
    participantCount: session.participants.length,
    ...(readingReady ? { readingReady } : {}),
  });
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

const quizHistoryAccessQuizSelect = Prisma.validator<Prisma.QuizSelect>()({
  id: true,
  historyScopeId: true,
  name: true,
  description: true,
  motifImageUrl: true,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: true,
  timerScaleByDifficulty: true,
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
});

type QuizHistoryAccessQuiz = Prisma.QuizGetPayload<{
  select: typeof quizHistoryAccessQuizSelect;
}>;

function buildQuizHistoryAccessPayload(
  quiz: QuizHistoryAccessQuiz,
  options?: { includeHistoryScopeId?: boolean },
): QuizUploadInput {
  const includeHistoryScopeId = options?.includeHistoryScopeId !== false;
  return {
    ...(includeHistoryScopeId && quiz.historyScopeId
      ? { historyScopeId: quiz.historyScopeId }
      : {}),
    name: quiz.name,
    description: quiz.description ?? undefined,
    motifImageUrl: quiz.motifImageUrl ?? null,
    showLeaderboard: quiz.showLeaderboard,
    allowCustomNicknames: quiz.allowCustomNicknames,
    defaultTimer: quiz.defaultTimer,
    timerScaleByDifficulty: quiz.timerScaleByDifficulty ?? true,
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
  };
}

async function createQuizHistoryProofBuffer(quiz: QuizHistoryAccessQuiz): Promise<Buffer> {
  return normalizeQuizHistoryAccessProof(
    await createQuizHistoryAccessProof(buildQuizHistoryAccessPayload(quiz)),
  );
}

async function createLegacyQuizHistoryProofBuffer(quiz: QuizHistoryAccessQuiz): Promise<Buffer> {
  return normalizeQuizHistoryAccessProof(
    await createLegacyQuizHistoryAccessProof(
      buildQuizHistoryAccessPayload(quiz, { includeHistoryScopeId: false }),
    ),
  );
}

function quizHistoryProofsMatch(expectedProof: Buffer, providedProof: Buffer): boolean {
  return (
    expectedProof.length === providedProof.length && timingSafeEqual(expectedProof, providedProof)
  );
}

async function assertQuizHistoryAccessAuthorized(
  quiz: QuizHistoryAccessQuiz,
  accessProof: string,
): Promise<void> {
  const providedProof = normalizeQuizHistoryAccessProof(accessProof);
  const expectedProofs = [await createQuizHistoryProofBuffer(quiz)];

  // Legacy clients or older local quiz cards may still hold the historical content hash
  // even after the server quiz was rebound to a stable history scope.
  if (quiz.historyScopeId) {
    expectedProofs.push(await createLegacyQuizHistoryProofBuffer(quiz));
  }

  if (
    expectedProofs.some((expectedProof) => quizHistoryProofsMatch(expectedProof, providedProof))
  ) {
    return;
  }

  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Zugriff auf diese Quiz-Historie ist nicht erlaubt.',
  });
}

async function resolveQuizHistoryScopeIds(quizId: string, accessProof: string): Promise<string[]> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: quizHistoryAccessQuizSelect,
  });

  if (!quiz) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz nicht gefunden.' });
  }

  await assertQuizHistoryAccessAuthorized(quiz, accessProof);
  const providedProof = normalizeQuizHistoryAccessProof(accessProof);

  if (quiz.historyScopeId) {
    const scopedQuizzes = await prisma.quiz.findMany({
      where: { historyScopeId: quiz.historyScopeId },
      select: { id: true },
    });
    return scopedQuizzes.map((entry) => entry.id);
  }

  const candidates = await prisma.quiz.findMany({
    where: { name: quiz.name },
    select: quizHistoryAccessQuizSelect,
  });

  const matchingIds: string[] = [];
  for (const candidate of candidates) {
    const candidateProof = await createQuizHistoryProofBuffer(candidate);
    if (quizHistoryProofsMatch(candidateProof, providedProof)) {
      matchingIds.push(candidate.id);
    }
  }

  return matchingIds.length > 0 ? matchingIds : [quizId];
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
    select: quizHistoryAccessQuizSelect,
  });

  const proofByQuizId = new Map<string, Buffer>();
  for (const quiz of quizzes) {
    proofByQuizId.set(quiz.id, await createQuizHistoryProofBuffer(quiz));
  }

  return entries.flatMap((entry) => {
    const expectedProof = proofByQuizId.get(entry.quizId);
    const providedProof = normalizeQuizHistoryAccessProof(entry.accessProof);
    if (!expectedProof || !quizHistoryProofsMatch(expectedProof, providedProof)) {
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

interface SessionOnboardingProfile {
  nicknameTheme: NicknameTheme;
  allowCustomNicknames: boolean;
  anonymousMode: boolean;
  teamMode: boolean;
  teamCount: number | null;
  teamAssignment: TeamAssignment;
  teamNames: string[];
}

const LEGACY_SESSION_ONBOARDING_PROFILE: SessionOnboardingProfile = {
  nicknameTheme: 'HIGH_SCHOOL',
  allowCustomNicknames: true,
  anonymousMode: false,
  teamMode: false,
  teamCount: null,
  teamAssignment: 'AUTO',
  teamNames: [],
};

function normalizeNicknameTheme(value: string | null | undefined): NicknameTheme {
  const parsed = NicknameThemeEnum.safeParse(value);
  return parsed.success ? parsed.data : 'HIGH_SCHOOL';
}

function normalizeSessionOnboardingProfile(
  input:
    | SessionOnboardingProfileInput
    | {
        nicknameTheme?: string | null;
        allowCustomNicknames?: boolean | null;
        anonymousMode?: boolean | null;
        teamMode?: boolean | null;
        teamCount?: number | null;
        teamAssignment?: TeamAssignment | null;
        teamNames?: string[] | null;
      },
): SessionOnboardingProfile {
  const anonymousMode = input.anonymousMode === true;
  const teamMode = input.teamMode === true;
  const teamCount = teamMode
    ? Math.min(8, Math.max(2, input.teamCount ?? DEFAULT_TEAM_COUNT))
    : null;

  return {
    nicknameTheme: normalizeNicknameTheme(input.nicknameTheme),
    allowCustomNicknames: anonymousMode ? false : input.allowCustomNicknames === true,
    anonymousMode,
    teamMode,
    teamCount,
    teamAssignment: teamMode ? (input.teamAssignment ?? 'AUTO') : 'AUTO',
    teamNames: teamMode
      ? normalizeConfiguredTeamNames(input.teamNames).slice(0, teamCount ?? 8)
      : [],
  };
}

function buildSessionOnboardingProfileFromQuiz(quiz: {
  nicknameTheme: string;
  allowCustomNicknames: boolean;
  anonymousMode: boolean;
  teamMode: boolean;
  teamCount: number | null;
  teamAssignment: TeamAssignment;
  teamNames: string[];
}): SessionOnboardingProfile {
  return normalizeSessionOnboardingProfile(quiz);
}

function hasStoredSessionOnboardingProfile(session: {
  onboardingProfileConfigured?: boolean | null;
}): boolean {
  return session.onboardingProfileConfigured === true;
}

function buildStoredSessionOnboardingProfile(session: {
  onboardingNicknameTheme?: string | null;
  onboardingAllowCustomNicknames?: boolean | null;
  onboardingAnonymousMode?: boolean | null;
  onboardingTeamMode?: boolean | null;
  onboardingTeamCount?: number | null;
  onboardingTeamAssignment?: TeamAssignment | null;
  onboardingTeamNames?: string[] | null;
}): SessionOnboardingProfile {
  return normalizeSessionOnboardingProfile({
    nicknameTheme: session.onboardingNicknameTheme,
    allowCustomNicknames: session.onboardingAllowCustomNicknames,
    anonymousMode: session.onboardingAnonymousMode,
    teamMode: session.onboardingTeamMode,
    teamCount: session.onboardingTeamCount,
    teamAssignment: session.onboardingTeamAssignment,
    teamNames: session.onboardingTeamNames,
  });
}

function resolveSessionOnboardingProfile(
  session: {
    onboardingProfileConfigured?: boolean | null;
    onboardingNicknameTheme?: string | null;
    onboardingAllowCustomNicknames?: boolean | null;
    onboardingAnonymousMode?: boolean | null;
    onboardingTeamMode?: boolean | null;
    onboardingTeamCount?: number | null;
    onboardingTeamAssignment?: TeamAssignment | null;
    onboardingTeamNames?: string[] | null;
  },
  quiz?: {
    nicknameTheme: string;
    allowCustomNicknames: boolean;
    anonymousMode: boolean;
    teamMode: boolean;
    teamCount: number | null;
    teamAssignment: TeamAssignment;
    teamNames: string[];
  } | null,
): SessionOnboardingProfile {
  if (hasStoredSessionOnboardingProfile(session)) {
    return buildStoredSessionOnboardingProfile(session);
  }
  if (quiz) {
    return buildSessionOnboardingProfileFromQuiz(quiz);
  }
  return LEGACY_SESSION_ONBOARDING_PROFILE;
}

function buildSessionOnboardingUpdate(profile: SessionOnboardingProfile) {
  return {
    onboardingProfileConfigured: true,
    onboardingNicknameTheme: profile.nicknameTheme,
    onboardingAllowCustomNicknames: profile.allowCustomNicknames,
    onboardingAnonymousMode: profile.anonymousMode,
    onboardingTeamMode: profile.teamMode,
    onboardingTeamCount: profile.teamCount,
    onboardingTeamAssignment: profile.teamMode ? profile.teamAssignment : 'AUTO',
    onboardingTeamNames: profile.teamMode ? profile.teamNames : [],
  };
}

function buildEffectiveTeamNames(profile: SessionOnboardingProfile): string[] {
  if (!profile.teamMode) {
    return [];
  }
  const count = profile.teamCount ?? DEFAULT_TEAM_COUNT;
  return Array.from(
    { length: count },
    (_, index) => profile.teamNames[index] ?? buildDefaultTeamName(index),
  );
}

function areSessionOnboardingProfilesCompatible(
  sessionProfile: SessionOnboardingProfile,
  quizProfile: SessionOnboardingProfile,
): boolean {
  return sessionProfile.teamMode === quizProfile.teamMode;
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

async function buildSessionTeamLeaderboard(
  sessionId: string,
  requestedTeamCount: number,
  configuredTeamNames?: string[] | null,
): Promise<TeamLeaderboardEntryDTO[]> {
  const teams = await ensureSessionTeams(sessionId, requestedTeamCount, configuredTeamNames);
  const participants = await prisma.participant.findMany({
    where: { sessionId },
    select: { id: true, teamId: true },
  });
  const votes = await prisma.vote.findMany({
    where: { sessionId, round: 1 },
    select: { participantId: true, score: true },
  });

  const teamStats = new Map<
    string,
    { teamName: string; teamColor: string | null; rawTotalScore: number; memberCount: number }
  >();
  for (const team of teams) {
    teamStats.set(team.id, {
      teamName: team.name,
      teamColor: team.color ?? null,
      rawTotalScore: 0,
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
    stats.rawTotalScore += Number(vote.score) || 0;
  }

  return [...teamStats.values()]
    .filter((team) => team.memberCount > 0)
    .map((team) => {
      const normalizedScore = normalizeTeamLeaderboardScore(team.rawTotalScore, team.memberCount);
      return {
        rank: 0,
        teamName: team.teamName,
        teamColor: team.teamColor,
        totalScore: normalizedScore,
        memberCount: team.memberCount,
        averageScore: normalizedScore,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore || a.teamName.localeCompare(b.teamName))
    .map((team, index) => ({
      ...team,
      rank: index + 1,
    }));
}

async function assignExistingParticipantsToTeams(
  sessionId: string,
  teamIds: string[],
): Promise<void> {
  if (teamIds.length === 0) {
    return;
  }

  const participants = await prisma.participant.findMany({
    where: { sessionId },
    orderBy: { joinedAt: 'asc' },
    select: { id: true, teamId: true },
  });

  let nextTeamIndex = participants.filter((participant) => participant.teamId).length;
  for (const participant of participants) {
    if (participant.teamId) {
      continue;
    }
    const teamId = teamIds[nextTeamIndex % teamIds.length];
    nextTeamIndex++;
    await prisma.participant.update({
      where: { id: participant.id },
      data: { teamId },
    });
  }
}

function buildSessionChannels(session: {
  type: 'QUIZ' | 'Q_AND_A';
  quizId?: string | null;
  quiz?: object | null;
  qaEnabled?: boolean | null;
  qaOpen?: boolean | null;
  qaTitle?: string | null;
  qaModerationMode?: boolean | null;
  title?: string | null;
  moderationMode?: boolean | null;
  quickFeedbackEnabled?: boolean | null;
  quickFeedbackOpen?: boolean | null;
}) {
  const qaEnabled = session.type === 'Q_AND_A' || session.qaEnabled === true;
  const qaOpen = qaEnabled && session.qaOpen !== false;
  const quickFeedbackEnabled = session.quickFeedbackEnabled === true;
  const quickFeedbackOpen = quickFeedbackEnabled && session.quickFeedbackOpen !== false;

  return {
    quiz: {
      /** Nur bei echtem Quiz (quizId); nicht `session.quiz !== null` — bei getInfo fehlt `include: { quiz }`, dann ist `quiz` undefined und `undefined !== null` wäre true. */
      enabled: session.type !== 'Q_AND_A' && typeof session.quizId === 'string',
    },
    qa: {
      enabled: qaEnabled,
      open: qaOpen,
      title: qaEnabled ? (session.qaTitle ?? session.title ?? null) : null,
      moderationMode: qaEnabled
        ? (session.qaModerationMode ?? session.moderationMode ?? true)
        : false,
    },
    quickFeedback: {
      enabled: quickFeedbackEnabled,
      open: quickFeedbackOpen,
    },
  };
}

/** Anteil vollstaendig korrekter Stimmen (SC/MC, Runde 1): Empfehlung nur in diesem Fenster. */
const PEER_INSTRUCTION_MIN_CORRECTNESS_RATIO = 0.35;
const PEER_INSTRUCTION_MAX_CORRECTNESS_RATIO = 0.7;

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
  currentQuestion: number | null;
  quiz: { name: string; bonusTokenCount: number | null; questions: { type: string }[] } | null;
  participants: { id: string; nickname: string }[];
  bonusTokens: { id: string }[];
}): Promise<void> {
  const topX = session.quiz?.bonusTokenCount;
  if (!topX || topX <= 0 || !session.quiz) return;
  if (session.bonusTokens.length > 0) return;
  const lastQuestionIndex = session.quiz.questions.length - 1;
  if (
    lastQuestionIndex < 0 ||
    session.currentQuestion === null ||
    session.currentQuestion < lastQuestionIndex
  ) {
    return;
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
      const quiz =
        input.quizId !== undefined
          ? await prisma.quiz.findUnique({
              where: { id: input.quizId },
              select: {
                id: true,
                name: true,
                nicknameTheme: true,
                allowCustomNicknames: true,
                anonymousMode: true,
                teamMode: true,
                teamCount: true,
                teamAssignment: true,
                teamNames: true,
              },
            })
          : null;
      if (input.quizId && !quiz) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz nicht gefunden.' });
      }

      const legacyQaOnlySession = input.type === 'Q_AND_A';
      const qaEnabled = legacyQaOnlySession || input.qaEnabled === true;
      const standaloneQaSession =
        (input.type === 'QUIZ' && !input.quizId && qaEnabled) || legacyQaOnlySession;
      const qaOpen = qaEnabled;
      const qaTitle = qaEnabled ? input.qaTitle?.trim() || input.title?.trim() || null : null;
      const qaModerationMode = qaEnabled
        ? (input.qaModerationMode ?? input.moderationMode ?? true)
        : false;
      const quickFeedbackEnabled = input.quickFeedbackEnabled ?? false;
      const quickFeedbackOpen = quickFeedbackEnabled;
      const onboardingProfile = quiz
        ? buildSessionOnboardingProfileFromQuiz(quiz)
        : normalizeSessionOnboardingProfile({
            ...LEGACY_SESSION_ONBOARDING_PROFILE,
            ...input,
          });
      const session = await prisma.session.create({
        data: {
          code,
          type: input.type ?? 'QUIZ',
          quizId: input.quizId ?? null,
          title: standaloneQaSession ? qaTitle : null,
          moderationMode: standaloneQaSession ? qaModerationMode : false,
          qaEnabled,
          qaOpen,
          qaTitle,
          qaModerationMode,
          quickFeedbackEnabled,
          quickFeedbackOpen,
          ...buildSessionOnboardingUpdate(onboardingProfile),
          status: 'LOBBY',
        },
      });
      if (onboardingProfile.teamMode) {
        await ensureSessionTeams(
          session.id,
          onboardingProfile.teamCount ?? DEFAULT_TEAM_COUNT,
          onboardingProfile.teamNames,
        );
      }
      const hostToken = await createHostSessionToken(session.code);
      return {
        sessionId: session.id,
        code: session.code,
        status: session.status,
        quizName: quiz?.name ?? null,
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
        select: { id: true, status: true, type: true, quizId: true, qaEnabled: true, qaOpen: true },
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

      const isQuizWithQaChannel =
        session.type === 'QUIZ' && session.qaEnabled === true && !!session.quizId;
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
      void recordSessionTransitionActivity();

      return {
        status: 'ACTIVE' as const,
        currentQuestion: null,
        currentRound: 1,
        activeAt: now.toISOString(),
      };
    }),

  enableQaChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: {
          id: true,
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      if (session.type !== 'Q_AND_A' && session.qaEnabled !== true) {
        const updated = await prisma.session.update({
          where: { id: session.id },
          data: {
            qaEnabled: true,
            qaOpen: true,
            qaModerationMode: session.qaModerationMode ?? true,
          },
          select: {
            type: true,
            quizId: true,
            qaEnabled: true,
            qaOpen: true,
            qaTitle: true,
            qaModerationMode: true,
            title: true,
            moderationMode: true,
            quickFeedbackEnabled: true,
            quickFeedbackOpen: true,
          },
        });
        return buildSessionChannels(updated);
      }

      return buildSessionChannels(session);
    }),

  enableQuickFeedbackChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: {
          id: true,
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      if (session.quickFeedbackEnabled !== true) {
        const updated = await prisma.session.update({
          where: { id: session.id },
          data: { quickFeedbackEnabled: true, quickFeedbackOpen: true },
          select: {
            type: true,
            quizId: true,
            qaEnabled: true,
            qaOpen: true,
            qaTitle: true,
            qaModerationMode: true,
            title: true,
            moderationMode: true,
            quickFeedbackEnabled: true,
            quickFeedbackOpen: true,
          },
        });
        return buildSessionChannels(updated);
      }

      return buildSessionChannels(session);
    }),

  attachQuizToSession: hostProcedure
    .input(AttachQuizToSessionInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: {
          id: true,
          type: true,
          status: true,
          currentQuestion: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
          onboardingProfileConfigured: true,
          onboardingAllowCustomNicknames: true,
          onboardingAnonymousMode: true,
          onboardingTeamMode: true,
          onboardingTeamCount: true,
          onboardingTeamAssignment: true,
          onboardingTeamNames: true,
          onboardingNicknameTheme: true,
          _count: { select: { participants: true } },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.type !== 'QUIZ' && session.type !== 'Q_AND_A') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nur Live-Sessions können ein Quiz nachträglich anhängen.',
        });
      }
      if (session.status === 'FINISHED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Beendete Sessions können nicht mehr verändert werden.',
        });
      }
      const voteCountForSession =
        session.quizId !== null
          ? await prisma.vote.count({
              where: { sessionId: session.id },
            })
          : 0;
      const canReplaceExistingQuiz =
        session.quizId !== null &&
        session.status === 'LOBBY' &&
        session.currentQuestion === null &&
        voteCountForSession === 0;
      if (session.quizId && !canReplaceExistingQuiz) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Das aktuelle Quiz kann nur vor der ersten gestarteten Frage gewechselt werden.',
        });
      }

      const quiz = await prisma.quiz.findUnique({
        where: { id: input.quizId },
        select: {
          id: true,
          nicknameTheme: true,
          allowCustomNicknames: true,
          anonymousMode: true,
          teamMode: true,
          teamCount: true,
          teamAssignment: true,
          teamNames: true,
        },
      });
      if (!quiz) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz nicht gefunden.' });
      }

      const sessionOnboardingProfile = resolveSessionOnboardingProfile(session, null);
      const quizOnboardingProfile = buildSessionOnboardingProfileFromQuiz(quiz);
      if (
        session._count.participants > 0 &&
        !areSessionOnboardingProfilesCompatible(sessionOnboardingProfile, quizOnboardingProfile)
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Dieses Quiz passt nicht zur Teamsituation der laufenden Session.',
        });
      }
      const existingParticipantsForManualTeams =
        quizOnboardingProfile.teamMode &&
        quizOnboardingProfile.teamAssignment === 'MANUAL' &&
        session._count.participants > 0
          ? await prisma.participant.findMany({
              where: { sessionId: session.id },
              select: { id: true, teamId: true },
            })
          : null;
      if (existingParticipantsForManualTeams?.some((participant) => !participant.teamId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Dieses Quiz erfordert Teamwahl, aber die laufende Session enthält Teilnehmende ohne Teamzuordnung.',
        });
      }

      const updated = await prisma.session.update({
        where: { id: session.id },
        data: {
          type: 'QUIZ',
          quizId: quiz.id,
          currentQuestion: null,
          currentRound: 1,
          answerDisplayOrder: Prisma.JsonNull,
          ...buildSessionOnboardingUpdate(
            hasStoredSessionOnboardingProfile(session)
              ? sessionOnboardingProfile
              : quizOnboardingProfile,
          ),
        },
        select: {
          id: true,
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });

      if (quizOnboardingProfile.teamMode) {
        const teams = await ensureSessionTeams(
          session.id,
          quizOnboardingProfile.teamCount ?? DEFAULT_TEAM_COUNT,
          quizOnboardingProfile.teamNames,
        );
        if (quizOnboardingProfile.teamAssignment === 'AUTO' && session._count.participants > 0) {
          await assignExistingParticipantsToTeams(
            session.id,
            teams.map((team) => team.id),
          );
        }
      }

      return buildSessionChannels(updated);
    }),

  closeQaChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: {
          id: true,
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const qaEnabled = session.type === 'Q_AND_A' || session.qaEnabled === true;
      if (!qaEnabled) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Q&A-Kanal ist nicht aktiviert.' });
      }

      if (session.qaOpen === false) {
        return buildSessionChannels(session);
      }

      const updated = await prisma.session.update({
        where: { id: session.id },
        data: { qaOpen: false },
        select: {
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });
      return buildSessionChannels(updated);
    }),

  reopenQaChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: {
          id: true,
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const qaEnabled = session.type === 'Q_AND_A' || session.qaEnabled === true;
      if (!qaEnabled) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Q&A-Kanal ist nicht aktiviert.' });
      }

      if (session.qaOpen !== false) {
        return buildSessionChannels(session);
      }

      const updated = await prisma.session.update({
        where: { id: session.id },
        data: { qaOpen: true },
        select: {
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });
      return buildSessionChannels(updated);
    }),

  closeQuickFeedbackChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: {
          id: true,
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      if (session.quickFeedbackEnabled !== true) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Blitzlicht-Kanal ist nicht aktiviert.',
        });
      }

      if (session.quickFeedbackOpen === false) {
        return buildSessionChannels(session);
      }

      const updated = await prisma.session.update({
        where: { id: session.id },
        data: { quickFeedbackOpen: false },
        select: {
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });
      return buildSessionChannels(updated);
    }),

  reopenQuickFeedbackChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: {
          id: true,
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      if (session.quickFeedbackEnabled !== true) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Blitzlicht-Kanal ist nicht aktiviert.',
        });
      }

      if (session.quickFeedbackOpen !== false) {
        return buildSessionChannels(session);
      }

      const updated = await prisma.session.update({
        where: { id: session.id },
        data: { quickFeedbackOpen: true },
        select: {
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: true,
          qaModerationMode: true,
          title: true,
          moderationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        },
      });
      return buildSessionChannels(updated);
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
                timerScaleByDifficulty: true,
                backgroundMusic: true,
                teamMode: true,
                teamCount: true,
                teamAssignment: true,
                bonusTokenCount: true,
                preset: true,
                motifImageUrl: true,
                teamNames: true,
              },
            })
          : null;
      const onboardingProfile = resolveSessionOnboardingProfile(session, q);
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
        nicknameTheme: onboardingProfile.nicknameTheme,
        allowCustomNicknames: onboardingProfile.allowCustomNicknames,
        anonymousMode: onboardingProfile.anonymousMode,
        teamMode: onboardingProfile.teamMode,
        teamCount: onboardingProfile.teamCount,
        teamAssignment: onboardingProfile.teamMode ? onboardingProfile.teamAssignment : null,
        teamNames: onboardingProfile.teamMode ? buildEffectiveTeamNames(onboardingProfile) : [],
        ...(q && {
          showLeaderboard: q.showLeaderboard,
          enableSoundEffects: q.enableSoundEffects,
          enableRewardEffects: q.enableRewardEffects,
          enableMotivationMessages: q.enableMotivationMessages,
          enableEmojiReactions: q.enableEmojiReactions,
          readingPhaseEnabled: q.readingPhaseEnabled,
          defaultTimer: q.defaultTimer,
          timerScaleByDifficulty: q.timerScaleByDifficulty,
          backgroundMusic: q.backgroundMusic,
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
        select: sessionParticipantsQuerySelect,
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      return buildSessionParticipantsPayload(session);
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

  confirmReadingReady: publicProcedure
    .input(ConfirmReadingReadyInputSchema)
    .output(ConfirmReadingReadyOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
        select: {
          id: true,
          status: true,
          currentQuestion: true,
          participants: {
            orderBy: { joinedAt: 'asc' },
            select: {
              id: true,
              nickname: true,
              teamId: true,
              team: { select: { name: true } },
            },
          },
          quiz: {
            select: {
              questions: {
                orderBy: { order: 'asc' },
                select: { id: true },
              },
            },
          },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.status !== 'QUESTION_OPEN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Bereitschaft kann nur in der Lesephase bestätigt werden.',
        });
      }

      const questionIdx = session.currentQuestion;
      const currentQuestionId =
        questionIdx === null || questionIdx === undefined
          ? null
          : (session.quiz?.questions[questionIdx]?.id ?? null);
      if (!currentQuestionId || currentQuestionId !== input.questionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Die Lesephase gehört nicht mehr zu dieser Frage.',
        });
      }

      const participantExists = session.participants.some(
        (participant) => participant.id === input.participantId,
      );
      if (!participantExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Teilnehmende oder Session nicht gefunden.',
        });
      }

      await markParticipantReadingReady(session.id, currentQuestionId, input.participantId);
      void touchParticipantPresence(session.id, input.participantId);

      const readingReady = await buildReadingReadyStatus(
        session,
        currentQuestionId,
        input.participantId,
      );
      return ConfirmReadingReadyOutputSchema.parse(
        readingReady ?? {
          connectedCount: 0,
          readyCount: 0,
          allConnectedReady: false,
          participantReady: true,
        },
      );
    }),

  /** Teams einer Session für manuellen Join / Team-Lobby (Story 7.1). */
  getTeams: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionTeamsPayloadSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        include: {
          quiz: {
            select: {
              nicknameTheme: true,
              allowCustomNicknames: true,
              anonymousMode: true,
              teamMode: true,
              teamCount: true,
              teamAssignment: true,
              teamNames: true,
            },
          },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const onboardingProfile = resolveSessionOnboardingProfile(session, session.quiz);
      if (!onboardingProfile.teamMode) {
        return { teams: [], teamCount: 0 };
      }

      const teams = await ensureSessionTeams(
        session.id,
        onboardingProfile.teamCount ?? DEFAULT_TEAM_COUNT,
        onboardingProfile.teamNames,
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
          select: sessionParticipantsQuerySelect,
        });
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
        }
        const payload = await buildSessionParticipantsPayload(session);
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
        select: { id: true, type: true, quizId: true, qaEnabled: true, qaOpen: true },
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
      if (session.type === 'Q_AND_A' || (session.quizId === null && session.qaEnabled === true)) {
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
              timerScaleByDifficulty: true,
              questions: { orderBy: { order: 'asc' }, select: { timer: true, difficulty: true } },
            },
          },
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const isActive = session.status === 'ACTIVE';
      const currentTimer =
        isActive && session.currentQuestion !== null && session.currentRound !== 2
          ? resolveEffectiveQuestionTimer(
              session.quiz?.questions[session.currentQuestion]?.timer,
              session.quiz?.defaultTimer,
              session.quiz?.questions[session.currentQuestion]?.difficulty ?? 'MEDIUM',
              session.quiz?.timerScaleByDifficulty ?? true,
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
                select: {
                  id: true,
                  type: true,
                  skipReadingPhase: true,
                  answers: { select: { id: true } },
                },
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
      const currentQuestionId =
        currentIdx >= 0 ? (session.quiz.questions[currentIdx]?.id ?? null) : null;

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
        if (currentQuestionId) {
          await clearReadingReady(session.id, currentQuestionId);
        }
        void recordSessionTransitionActivity();
        await generateBonusTokens(session);
        return { status: 'FINISHED' as const, currentQuestion: null, currentRound: 1 };
      }

      const nextQuestion = session.quiz.questions[nextIdx];
      const skipReadingPhaseForType =
        nextQuestion?.type === 'SURVEY' || nextQuestion?.type === 'RATING';
      const readingPhase =
        session.quiz.readingPhaseEnabled &&
        !skipReadingPhaseForType &&
        nextQuestion?.skipReadingPhase !== true;
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
      if (currentQuestionId) {
        await clearReadingReady(session.id, currentQuestionId);
      }
      void recordSessionTransitionActivity();
      void markCountdownSessionActive(session.id);
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
        select: {
          id: true,
          status: true,
          currentQuestion: true,
          currentRound: true,
          quiz: {
            select: {
              questions: {
                orderBy: { order: 'asc' },
                select: { id: true },
              },
            },
          },
        },
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
      const questionId =
        session.currentQuestion === null || session.currentQuestion === undefined
          ? null
          : (session.quiz?.questions[session.currentQuestion]?.id ?? null);
      if (questionId) {
        await clearReadingReady(session.id, questionId);
      }
      void recordSessionTransitionActivity();
      void markCountdownSessionActive(session.id);
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
      void recordSessionTransitionActivity();
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
      void recordSessionTransitionActivity();
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
      void recordSessionTransitionActivity();
      void markCountdownSessionActive(session.id);
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
                  difficulty: true,
                  ratingMin: true,
                  ratingMax: true,
                  ratingLabelMin: true,
                  ratingLabelMax: true,
                  answers: { select: { id: true, text: true, isCorrect: true } },
                },
              },
              defaultTimer: true,
              timerScaleByDifficulty: true,
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
        difficulty: question.difficulty,
        timer:
          session.currentRound === 2
            ? null
            : resolveEffectiveQuestionTimer(
                question.timer,
                session.quiz.defaultTimer,
                question.difficulty,
                session.quiz.timerScaleByDifficulty ?? true,
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
    .input(GetCurrentQuestionForStudentInputSchema)
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
              timerScaleByDifficulty: true,
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

      const participantId = input.participantId;
      let participantBelongsToSession = false;
      if (participantId) {
        const participant = await prisma.participant.findFirst({
          where: {
            id: participantId,
            sessionId: session.id,
          },
          select: { id: true },
        });
        participantBelongsToSession = !!participant;
        if (participantBelongsToSession) {
          void touchParticipantPresence(session.id, participantId);
        }
      }

      const answersOrdered = orderAnswersByDisplayMap(
        question.answers,
        question.id,
        session.answerDisplayOrder,
      );

      const totalQuestions = session.quiz.questions.length;

      if (session.status === 'QUESTION_OPEN') {
        const participantReady =
          participantBelongsToSession && participantId
            ? (await getReadingReadyParticipantIds(session.id, question.id)).has(participantId)
            : undefined;
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
          ...(participantReady !== undefined ? { participantReady } : {}),
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
          timer:
            session.currentRound === 2
              ? null
              : resolveEffectiveQuestionTimer(
                  question.timer,
                  session.quiz.defaultTimer,
                  question.difficulty,
                  session.quiz.timerScaleByDifficulty ?? true,
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
    .output(ActiveQuizLiveStatesDTOSchema)
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
        select: {
          quizId: true,
          _count: {
            select: {
              participants: true,
            },
          },
        },
      });

      const countsByQuizId = new Map<string, number>();
      for (const session of sessions) {
        if (!session.quizId) {
          continue;
        }
        const current = countsByQuizId.get(session.quizId) ?? 0;
        // Für die Live-Chips wird der Host explizit mitgezählt.
        countsByQuizId.set(session.quizId, current + session._count.participants + 1);
      }

      return [...countsByQuizId.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([quizId, participantCountIncludingHost]) => ({
          quizId,
          participantCountIncludingHost,
        }));
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
              nicknameTheme: true,
              allowCustomNicknames: true,
              anonymousMode: true,
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
      const onboardingProfile = resolveSessionOnboardingProfile(session, session.quiz);
      const trimmedNickname = input.nickname.trim().slice(0, 30);
      let assignedTeamId: string | undefined;
      let assignedTeamName: string | null = null;
      let participantId: string | null = null;

      if (input.rejoinToken) {
        const existingParticipant = await prisma.participant.findFirst({
          where: {
            id: input.rejoinToken,
            sessionId: session.id,
          },
          select: {
            id: true,
            teamId: true,
            team: {
              select: {
                name: true,
              },
            },
          },
        });
        if (existingParticipant) {
          participantId = existingParticipant.id;
          assignedTeamId = existingParticipant.teamId ?? undefined;
          assignedTeamName = existingParticipant.team?.name ?? null;
        }
      }

      if (onboardingProfile.teamMode) {
        const teams = await ensureSessionTeams(
          session.id,
          onboardingProfile.teamCount ?? DEFAULT_TEAM_COUNT,
          onboardingProfile.teamNames,
        );
        if (teams.length === 0) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Teams konnten nicht vorbereitet werden.',
          });
        }

        if (onboardingProfile.teamAssignment === 'MANUAL') {
          if (!participantId && !input.teamId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bitte wähle ein Team aus.' });
          }
          if (!participantId) {
            const selectedTeam = teams.find((team) => team.id === input.teamId);
            if (!selectedTeam) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ungültiges Team.' });
            }
            assignedTeamId = selectedTeam.id;
            assignedTeamName = selectedTeam.name;
          }
        } else if (!participantId) {
          const participantIndex = session._count.participants;
          const teamIndex = participantIndex % teams.length;
          const autoTeam = teams[teamIndex]!;
          assignedTeamId = autoTeam.id;
          assignedTeamName = autoTeam.name;
        }
      }

      if (!participantId) {
        const participant = await prisma.participant
          .create({
            data: {
              sessionId: session.id,
              nickname: trimmedNickname,
              teamId: assignedTeamId,
            },
          })
          .catch(() => {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Dieser Nickname ist in dieser Session bereits vergeben.',
            });
          });
        participantId = participant.id;
      }
      if (!participantId) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Teilnehmende konnten nicht vorbereitet werden.',
        });
      }

      // Nach Create zählen (nicht _count+1): bei gleichzeitigen Joins ist der Anfangssnapshot sonst zu niedrig — Rekord/Response falsch.
      const newParticipantCount = await prisma.participant.count({
        where: { sessionId: session.id },
      });
      void updateMaxParticipantsSingleSession(newParticipantCount);
      void updateDailyMaxParticipants(newParticipantCount);
      void touchParticipantPresence(session.id, participantId);
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
        nicknameTheme: onboardingProfile.nicknameTheme,
        allowCustomNicknames: onboardingProfile.allowCustomNicknames,
        anonymousMode: onboardingProfile.anonymousMode,
        teamMode: onboardingProfile.teamMode,
        teamCount: onboardingProfile.teamCount,
        teamAssignment: onboardingProfile.teamMode ? onboardingProfile.teamAssignment : null,
        teamNames: onboardingProfile.teamMode ? buildEffectiveTeamNames(onboardingProfile) : [],
        participantId,
        rejoinToken: participantId,
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
          question: {
            select: {
              type: true,
              answers: { select: { id: true, isCorrect: true } },
            },
          },
          selectedAnswers: { select: { answerOptionId: true } },
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
          const correctAnswerIds = v.question.answers
            .filter((answer) => answer.isCorrect)
            .map((answer) => answer.id);
          const selectedAnswerIds = v.selectedAnswers.map((selected) => selected.answerOptionId);
          if (
            correctAnswerIds.length > 0 &&
            isExactCorrectSelection(selectedAnswerIds, correctAnswerIds)
          ) {
            s.correctCount++;
          }
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

  /** Team-Leaderboard: Ranking aller Teams nach harmonisierten Team-Punkten (Story 7.1). */
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
      return buildSessionTeamLeaderboard(
        session.id,
        session.quiz.teamCount ?? DEFAULT_TEAM_COUNT,
        session.quiz.teamNames,
      );
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
          currentQuestion: true,
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
      void recordSessionTransitionActivity();

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
      const scopedQuizIds = await resolveQuizHistoryScopeIds(input.quizId, input.accessProof);

      const sessions = await prisma.session.findMany({
        where: {
          quizId: { in: scopedQuizIds },
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

  getQuizCollectionHistoryAvailability: publicProcedure
    .input(GetQuizCollectionHistoryAvailabilityInputSchema)
    .output(GetQuizCollectionHistoryAvailabilityOutputSchema)
    .query(async ({ input }) => {
      return Promise.all(
        input.map(async (entry) => {
          const scopedQuizIds = await resolveQuizHistoryScopeIds(entry.quizId, entry.accessProof);
          const [bonusSession, feedbackSession] = await Promise.all([
            prisma.session.findFirst({
              where: {
                quizId: { in: scopedQuizIds },
                status: 'FINISHED',
                bonusTokens: { some: {} },
              },
              select: { id: true },
            }),
            prisma.session.findFirst({
              where: {
                quizId: { in: scopedQuizIds },
                status: 'FINISHED',
                sessionFeedbacks: { some: {} },
              },
              select: { id: true },
            }),
          ]);

          return {
            quizId: entry.quizId,
            hasBonusTokens: bonusSession !== null,
            hasLastSessionFeedback: feedbackSession !== null,
          };
        }),
      );
    }),

  /**
   * Bindet alte serverseitige Quizkopien beim ersten Zugriff an eine stabile Quiz-Identität.
   * Das migriert Legacy-Historie (vor historyScopeId) auf die lokale Quiz-ID des Clients.
   */
  bindQuizHistoryScope: publicProcedure
    .input(BindQuizHistoryScopeInputSchema)
    .output(BindQuizHistoryScopeOutputSchema)
    .mutation(async ({ input }) => {
      const quiz = await prisma.quiz.findUnique({
        where: { id: input.quizId },
        select: quizHistoryAccessQuizSelect,
      });

      if (!quiz) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz nicht gefunden.' });
      }

      await assertQuizHistoryAccessAuthorized(quiz, input.accessProof);

      if (quiz.historyScopeId) {
        return { accessProof: quiz.historyScopeId };
      }

      // Legacy-Bestand kennt keine stabile lokale Quiz-ID. Für die einmalige Migration
      // ist der Quizname der beste verfügbare Scope, damit auch ältere Versionen desselben
      // Quizzes (mit früheren Frage-/Antwortständen) wieder an derselben Karte sichtbar werden.
      await prisma.quiz.updateMany({
        where: {
          historyScopeId: null,
          name: quiz.name,
        },
        data: { historyScopeId: input.historyScopeId },
      });

      return { accessProof: input.historyScopeId };
    }),

  /** Bonus-Code serverseitig prüfen (Quiz-Sammlung, Story 4.6). */
  verifyBonusTokenForQuiz: publicProcedure
    .input(VerifyBonusTokenForQuizInputSchema)
    .output(VerifyBonusTokenForQuizOutputSchema)
    .query(async ({ input }) => {
      const scopedQuizIds = await resolveQuizHistoryScopeIds(input.quizId, input.accessProof);
      const normalizedToken = input.bonusCode.trim().toUpperCase();

      const token = await prisma.bonusToken.findFirst({
        where: {
          token: normalizedToken,
          session: {
            quizId: { in: scopedQuizIds },
            status: 'FINISHED',
          },
        },
        include: {
          session: {
            select: {
              code: true,
            },
          },
        },
      });

      if (!token) {
        return { valid: false as const };
      }

      return {
        valid: true as const,
        sessionCode: token.session.code,
        nickname: token.nickname,
        rank: token.rank,
        totalScore: token.totalScore,
      };
    }),

  /** Bonus-Code serverseitig löschen (Quiz-Sammlung, Story 4.6). */
  deleteBonusTokenForQuiz: publicProcedure
    .input(DeleteBonusTokenForQuizInputSchema)
    .output(DeleteBonusTokenForQuizOutputSchema)
    .mutation(async ({ input }) => {
      const scopedQuizIds = await resolveQuizHistoryScopeIds(input.quizId, input.accessProof);
      const normalizedToken = input.bonusCode.trim().toUpperCase();
      const deleted = await prisma.bonusToken.deleteMany({
        where: {
          token: normalizedToken,
          session: {
            quizId: { in: scopedQuizIds },
            status: 'FINISHED',
          },
        },
      });
      return { deleted: deleted.count > 0 };
    }),

  /**
   * Aggregiertes Session-Feedback der zuletzt beendeten Live-Session mit mindestens einer Bewertung
   * (Quiz-Sammlung; gleicher quizId-Zugriff wie getBonusTokensForQuiz).
   */
  getLastSessionFeedbackForQuiz: publicProcedure
    .input(GetLastSessionFeedbackForQuizInputSchema)
    .output(LastSessionFeedbackForQuizOutputSchema)
    .query(async ({ input }) => {
      const scopedQuizIds = await resolveQuizHistoryScopeIds(input.quizId, input.accessProof);

      const session = await prisma.session.findFirst({
        where: {
          quizId: { in: scopedQuizIds },
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
      const teamLeaderboard =
        session.quiz.teamMode === true
          ? await buildSessionTeamLeaderboard(
              session.id,
              session.quiz.teamCount ?? DEFAULT_TEAM_COUNT,
              session.quiz.teamNames,
            )
          : undefined;

      const result: SessionExportDTO = {
        sessionId: session.id,
        sessionCode: session.code,
        quizName,
        finishedAt: session.endedAt?.toISOString() ?? new Date().toISOString(),
        participantCount: session.participants.length,
        teamMode: session.quiz.teamMode === true,
        questions: questionEntries,
        teamLeaderboard:
          teamLeaderboard && teamLeaderboard.length > 0 ? teamLeaderboard : undefined,
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
