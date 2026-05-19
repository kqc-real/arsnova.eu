/**
 * Session-Router (Story 2.1a, 3.1, 4.1, 4.2, 4.6, 4.7, 0.5).
 */
import { EventEmitter } from 'node:events';
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
  SessionChannelsDTOSchema,
  SessionLiveChannelSchema,
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
  type ToleranceLevel,
  type RoundComparisonDTO,
  type RoundDistributionEntry,
  type NumericInputKind,
  type NumericToleranceMode,
  type NumericUnitFamily,
  type ShortTextEvaluationKind,
  type ShortAnswerEvaluationMode,
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
  SHORT_TEXT_DEFAULT_EVALUATION_MODE,
  SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
  createQuizHistoryAccessProof,
  createLegacyQuizHistoryAccessProof,
  evaluateNumericAnswer,
  evaluateShortAnswer,
  normalizeShortTextValue,
  resolveEffectiveQuestionTimer,
  resolveNumericQuestionEvaluationSettings,
  resolveShortTextEvaluationKind,
  resolveShortTextMaxLength,
  usesNumericShortTextEvaluation,
  usesShortTextUnitEvaluation,
  resolveNumericTolerance,
  isNumericValueInBand,
  type NumericEstimateToleranceMode,
  type NumericStatsDTO,
  type NumericHistogramBin,
  type NumericRoundComparisonDTO,
  type NumericPairedAnalysisDTO,
} from '@arsnova/shared-types';
import {
  isExactCorrectSelection,
  questionCountsTowardsTotalQuestions,
  questionAffectsStreak,
} from '../lib/quizScoring';
import {
  updateDailyMaxParticipants,
  incrementCompletedSessionsTotal,
  updateMaxParticipantsSingleSession,
} from '../lib/platformStatistic';
import {
  getActiveParticipantCountForSession,
  getActiveParticipantIdsForSession,
  touchParticipantPresence,
} from '../lib/presence';
import { markCountdownSessionActive, recordSessionTransitionActivity } from '../lib/loadSignal';
import { awaitJoinAdmissionSlot } from '../lib/joinAdmission';
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
const PARTICIPANT_NICKNAMES_CACHE_TTL_MS = 5_000;
const participantNicknameCache = new Map<
  string,
  { expiresAt: number; payload: { nicknames: string[]; participantCount: number } }
>();

function getEmojiKey(sessionId: string, questionId: string, round: number): string {
  const r = round >= 1 && round <= 2 ? round : 1;
  return `${sessionId}:${questionId}:r${r}`;
}

function getCachedParticipantNicknames(
  code: string,
): { nicknames: string[]; participantCount: number } | null {
  const cached = participantNicknameCache.get(code);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    participantNicknameCache.delete(code);
    return null;
  }
  return cached.payload;
}

function setCachedParticipantNicknames(
  code: string,
  payload: { nicknames: string[]; participantCount: number },
): void {
  participantNicknameCache.set(code, {
    expiresAt: Date.now() + PARTICIPANT_NICKNAMES_CACHE_TTL_MS,
    payload,
  });
}

export function resetParticipantNicknameCacheForTests(): void {
  participantNicknameCache.clear();
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
const SESSION_INFO_CACHE_TTL_MS = 1_000;
const STATUS_SNAPSHOT_CACHE_TTL_MS = 400;
const PARTICIPANTS_SNAPSHOT_CACHE_TTL_MS = 400;
const CURRENT_QUESTION_CACHE_TTL_MS = 500;
const PARTICIPANT_MEMBERSHIP_CACHE_TTL_MS = 30_000;
const VOTE_COUNT_CACHE_TTL_MS = 15 * 60_000;
const VOTE_SUMMARY_CACHE_TTL_MS = 15 * 60_000;
const CURRENT_QUESTION_EVENT_WAIT_MS = 10_000;
const STATUS_EVENT_WAIT_ACTIVE_MS = 10_000;
const STATUS_EVENT_WAIT_IDLE_MS = 30_000;
const PARTICIPANT_EVENT_WAIT_ACTIVE_MS = 10_000;
const PARTICIPANT_EVENT_WAIT_IDLE_MS = 30_000;
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

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type StatusSnapshotPayload = {
  status: string;
  currentQuestion: number | null;
  activeAt?: string;
  timer?: number | null;
  preset?: string;
  currentRound?: number;
  channels?: z.infer<typeof SessionChannelsDTOSchema>;
  preferredChannel?: z.infer<typeof SessionLiveChannelSchema>;
};

type VoteSummary = {
  totalVotes: number;
  answerVoteCounts: Record<string, number>;
  freeTextResponses: string[];
  incorrectFreeTextResponses: string[];
  correctVoteCount: number;
  incorrectVoteCount: number;
  numericValues: number[]; // Story 1.2d: Numerische Schätzwerte (NUMERIC_ESTIMATE)
};

const sessionInfoCache = new Map<
  string,
  CacheEntry<Omit<z.infer<typeof SessionInfoDTOSchema>, 'serverTime'>>
>();
const statusSnapshotCache = new Map<string, CacheEntry<StatusSnapshotPayload>>();
const participantsSnapshotCache = new Map<
  string,
  CacheEntry<z.infer<typeof SessionParticipantsPayloadSchema>>
>();
const currentQuestionCache = new Map<string, CacheEntry<unknown>>();
const participantMembershipCache = new Map<string, CacheEntry<boolean>>();
const voteCountCache = new Map<string, CacheEntry<number>>();
const voteSummaryCache = new Map<string, CacheEntry<VoteSummary>>();
const preferredLiveChannelByCode = new Map<string, z.infer<typeof SessionLiveChannelSchema>>();
const sessionInfoInFlight = new Map<
  string,
  Promise<Omit<z.infer<typeof SessionInfoDTOSchema>, 'serverTime'>>
>();
const statusSnapshotInFlight = new Map<string, Promise<StatusSnapshotPayload>>();
const participantsSnapshotInFlight = new Map<
  string,
  Promise<z.infer<typeof SessionParticipantsPayloadSchema>>
>();
const currentQuestionInFlight = new Map<string, Promise<unknown>>();
const participantMembershipInFlight = new Map<string, Promise<boolean>>();
const voteCountInFlight = new Map<string, Promise<number>>();
const voteSummaryInFlight = new Map<string, Promise<VoteSummary>>();
const sessionStatusEvents = new EventEmitter();
const sessionStatusVersions = new Map<string, number>();
const sessionParticipantEvents = new EventEmitter();
const sessionParticipantVersions = new Map<string, number>();
const sessionCurrentQuestionEvents = new EventEmitter();
const sessionCurrentQuestionVersions = new Map<string, number>();
sessionStatusEvents.setMaxListeners(0);
sessionParticipantEvents.setMaxListeners(0);
sessionCurrentQuestionEvents.setMaxListeners(0);

function getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
): T {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
  return value;
}

async function getOrComputeCached<T>(
  cache: Map<string, CacheEntry<T>>,
  inFlight: Map<string, Promise<T>>,
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
): Promise<T> {
  const cached = getCachedValue(cache, key);
  if (cached !== null) {
    return cached;
  }
  const existingPromise = inFlight.get(key);
  if (existingPromise) {
    return existingPromise;
  }
  const promise = compute()
    .then((value) => setCachedValue(cache, key, value, ttlMs))
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}

function clearSessionReadCaches(code?: string): void {
  if (!code) {
    sessionInfoCache.clear();
    statusSnapshotCache.clear();
    participantsSnapshotCache.clear();
    currentQuestionCache.clear();
    participantNicknameCache.clear();
    participantMembershipCache.clear();
    voteCountCache.clear();
    voteSummaryCache.clear();
    sessionInfoInFlight.clear();
    statusSnapshotInFlight.clear();
    participantsSnapshotInFlight.clear();
    currentQuestionInFlight.clear();
    participantMembershipInFlight.clear();
    voteCountInFlight.clear();
    voteSummaryInFlight.clear();
    return;
  }
  sessionInfoCache.delete(code);
  statusSnapshotCache.delete(code);
  participantsSnapshotCache.delete(code);
  currentQuestionCache.delete(code);
  participantNicknameCache.delete(code);
  clearVoteCaches(code);
  for (const key of participantMembershipCache.keys()) {
    if (key.startsWith(`${code}:`)) {
      participantMembershipCache.delete(key);
    }
  }
  sessionInfoInFlight.delete(code);
  statusSnapshotInFlight.delete(code);
  participantsSnapshotInFlight.delete(code);
  currentQuestionInFlight.delete(code);
  for (const key of participantMembershipInFlight.keys()) {
    if (key.startsWith(`${code}:`)) {
      participantMembershipInFlight.delete(key);
    }
  }
}

export function resetSessionReadCachesForTests(): void {
  clearSessionReadCaches();
  sessionStatusVersions.clear();
  sessionParticipantVersions.clear();
  sessionCurrentQuestionVersions.clear();
  sessionStatusEvents.removeAllListeners();
  sessionParticipantEvents.removeAllListeners();
  sessionCurrentQuestionEvents.removeAllListeners();
}

function clearSessionInfoCache(code: string): void {
  sessionInfoCache.delete(code);
  sessionInfoInFlight.delete(code);
}

function clearStatusSnapshotCache(code: string): void {
  statusSnapshotCache.delete(code);
  statusSnapshotInFlight.delete(code);
}

function clearParticipantsSnapshotCache(code: string): void {
  participantsSnapshotCache.delete(code);
  participantsSnapshotInFlight.delete(code);
}

function clearCurrentQuestionCache(code: string): void {
  currentQuestionCache.delete(code);
  currentQuestionInFlight.delete(code);
}

function clearVoteCaches(code: string): void {
  for (const key of voteCountCache.keys()) {
    if (key.startsWith(`${code}:`)) {
      voteCountCache.delete(key);
    }
  }
  for (const key of voteCountInFlight.keys()) {
    if (key.startsWith(`${code}:`)) {
      voteCountInFlight.delete(key);
    }
  }
  for (const key of voteSummaryCache.keys()) {
    if (key.startsWith(`${code}:`)) {
      voteSummaryCache.delete(key);
    }
  }
  for (const key of voteSummaryInFlight.keys()) {
    if (key.startsWith(`${code}:`)) {
      voteSummaryInFlight.delete(key);
    }
  }
}

function clearParticipantNicknameCache(code: string): void {
  participantNicknameCache.delete(code);
}

function clearParticipantMembershipCache(code: string): void {
  for (const key of participantMembershipCache.keys()) {
    if (key.startsWith(`${code}:`)) {
      participantMembershipCache.delete(key);
    }
  }
  for (const key of participantMembershipInFlight.keys()) {
    if (key.startsWith(`${code}:`)) {
      participantMembershipInFlight.delete(key);
    }
  }
}

function sessionStatusEventName(code: string): string {
  return `status:${code}`;
}

function sessionParticipantEventName(code: string): string {
  return `participants:${code}`;
}

function sessionCurrentQuestionEventName(code: string): string {
  return `current-question:${code}`;
}

function emitSessionStatusSignal(code: string): void {
  const normalizedCode = code.toUpperCase();
  const nextVersion = (sessionStatusVersions.get(normalizedCode) ?? 0) + 1;
  sessionStatusVersions.set(normalizedCode, nextVersion);
  sessionStatusEvents.emit(sessionStatusEventName(normalizedCode), nextVersion);
}

function emitSessionParticipantSignal(code: string): void {
  const normalizedCode = code.toUpperCase();
  const nextVersion = (sessionParticipantVersions.get(normalizedCode) ?? 0) + 1;
  sessionParticipantVersions.set(normalizedCode, nextVersion);
  sessionParticipantEvents.emit(sessionParticipantEventName(normalizedCode), nextVersion);
}

function emitSessionCurrentQuestionSignal(code: string): void {
  const normalizedCode = code.toUpperCase();
  const nextVersion = (sessionCurrentQuestionVersions.get(normalizedCode) ?? 0) + 1;
  sessionCurrentQuestionVersions.set(normalizedCode, nextVersion);
  sessionCurrentQuestionEvents.emit(sessionCurrentQuestionEventName(normalizedCode), nextVersion);
}

function getSessionStatusSignalVersion(code: string): number {
  return sessionStatusVersions.get(code.toUpperCase()) ?? 0;
}

function getSessionParticipantSignalVersion(code: string): number {
  return sessionParticipantVersions.get(code.toUpperCase()) ?? 0;
}

function getSessionCurrentQuestionSignalVersion(code: string): number {
  return sessionCurrentQuestionVersions.get(code.toUpperCase()) ?? 0;
}

async function waitForSessionStatusSignal(
  code: string,
  currentVersion: number,
  timeoutMs: number,
): Promise<void> {
  const normalizedCode = code.toUpperCase();
  if (getSessionStatusSignalVersion(normalizedCode) !== currentVersion) {
    return;
  }
  await new Promise<void>((resolve) => {
    const eventName = sessionStatusEventName(normalizedCode);
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      sessionStatusEvents.off(eventName, onSignal);
      timer = null;
      resolve();
    }, timeoutMs);

    const onSignal = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      sessionStatusEvents.off(eventName, onSignal);
      resolve();
    };

    sessionStatusEvents.on(eventName, onSignal);
  });
}

async function waitForSessionCurrentQuestionSignal(
  code: string,
  currentVersion: number,
  timeoutMs: number,
): Promise<void> {
  const normalizedCode = code.toUpperCase();
  if (getSessionCurrentQuestionSignalVersion(normalizedCode) !== currentVersion) {
    return;
  }
  await new Promise<void>((resolve) => {
    const eventName = sessionCurrentQuestionEventName(normalizedCode);
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      sessionCurrentQuestionEvents.off(eventName, onSignal);
      timer = null;
      resolve();
    }, timeoutMs);

    const onSignal = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      sessionCurrentQuestionEvents.off(eventName, onSignal);
      resolve();
    };

    sessionCurrentQuestionEvents.on(eventName, onSignal);
  });
}

async function waitForSessionParticipantSignal(
  code: string,
  currentVersion: number,
  timeoutMs: number,
): Promise<void> {
  const normalizedCode = code.toUpperCase();
  if (getSessionParticipantSignalVersion(normalizedCode) !== currentVersion) {
    return;
  }
  await new Promise<void>((resolve) => {
    const eventName = sessionParticipantEventName(normalizedCode);
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      sessionParticipantEvents.off(eventName, onSignal);
      timer = null;
      resolve();
    }, timeoutMs);

    const onSignal = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      sessionParticipantEvents.off(eventName, onSignal);
      resolve();
    };

    sessionParticipantEvents.on(eventName, onSignal);
  });
}

async function fetchStatusSnapshot(code: string): Promise<StatusSnapshotPayload> {
  return getOrComputeCached(
    statusSnapshotCache,
    statusSnapshotInFlight,
    code,
    STATUS_SNAPSHOT_CACHE_TTL_MS,
    async () => {
      const session = await prisma.session.findUnique({
        where: { code },
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
          status: true,
          currentQuestion: true,
          currentRound: true,
          statusChangedAt: true,
          quiz: {
            select: {
              preset: true,
              defaultTimer: true,
              timerScaleByDifficulty: true,
              questions: {
                orderBy: { order: 'asc' },
                select: { timer: true, difficulty: true },
              },
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
      const channels = buildSessionChannels(session);
      return {
        status: session.status,
        currentQuestion: session.currentQuestion,
        currentRound: session.currentRound,
        preset: (session.quiz?.preset as 'PLAYFUL' | 'SERIOUS') || undefined,
        channels,
        preferredChannel: resolvePreferredLiveChannel(code, channels),
        ...(isActive && {
          activeAt: session.statusChangedAt.toISOString(),
          timer: currentTimer,
        }),
      };
    },
  );
}

async function fetchParticipantsSnapshot(
  code: string,
): Promise<z.infer<typeof SessionParticipantsPayloadSchema>> {
  return getOrComputeCached(
    participantsSnapshotCache,
    participantsSnapshotInFlight,
    code,
    PARTICIPANTS_SNAPSHOT_CACHE_TTL_MS,
    async () => {
      const session = await prisma.session.findUnique({
        where: { code },
        select: sessionParticipantsQuerySelect,
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      return buildSessionParticipantsPayload(session);
    },
  );
}

export function invalidateSessionCachesForCode(code: string): void {
  clearSessionReadCaches(code.toUpperCase());
}

export function invalidateSessionMetadataCachesForCode(code: string): void {
  const normalizedCode = code.toUpperCase();
  clearSessionInfoCache(normalizedCode);
}

export function invalidateSessionStatusCachesForCode(code: string): void {
  const normalizedCode = code.toUpperCase();
  clearSessionInfoCache(normalizedCode);
  clearStatusSnapshotCache(normalizedCode);
  clearParticipantsSnapshotCache(normalizedCode);
  clearCurrentQuestionCache(normalizedCode);
  emitSessionStatusSignal(normalizedCode);
  emitSessionParticipantSignal(normalizedCode);
  emitSessionCurrentQuestionSignal(normalizedCode);
}

export function invalidateJoinCachesForCode(code: string): void {
  const normalizedCode = code.toUpperCase();
  clearSessionInfoCache(normalizedCode);
  clearParticipantsSnapshotCache(normalizedCode);
  clearParticipantNicknameCache(normalizedCode);
  clearParticipantMembershipCache(normalizedCode);
  emitSessionParticipantSignal(normalizedCode);
}

export function invalidateCurrentQuestionCachesForCode(code: string): void {
  const normalizedCode = code.toUpperCase();
  clearCurrentQuestionCache(normalizedCode);
  emitSessionCurrentQuestionSignal(normalizedCode);
}

export function resetVoteAggregationCachesForTests(): void {
  voteCountCache.clear();
  voteSummaryCache.clear();
  voteCountInFlight.clear();
  voteSummaryInFlight.clear();
}

function voteCacheKey(code: string, questionId: string, round: number): string {
  return `${code}:${questionId}:${round}`;
}

async function getVoteCountCached(
  code: string,
  sessionId: string,
  questionId: string,
  round: number,
): Promise<number> {
  const key = voteCacheKey(code, questionId, round);
  return getOrComputeCached(voteCountCache, voteCountInFlight, key, VOTE_COUNT_CACHE_TTL_MS, () =>
    prisma.vote.count({
      where: {
        sessionId,
        questionId,
        round,
      },
    }),
  );
}

type ShortTextQuestionConfig = {
  shortTextEvaluationKind?: string | null;
  shortTextMaxLength?: number | null;
  shortTextCaseSensitive?: boolean | null;
  shortTextEvaluationMode?: string | null;
  shortTextToleranceLevel?: string | null;
  shortTextAllowPartialCredit?: boolean | null;
  shortTextTrimWhitespace?: boolean | null;
  shortTextNormalizeWhitespace?: boolean | null;
  numericInputKind?: string | null;
  numericToleranceMode?: string | null;
  numericAbsoluteTolerance?: number | null;
  numericRelativeTolerancePercent?: number | null;
  numericUnitFamily?: string | null;
  numericRequireUnit?: boolean | null;
  numericAcceptEquivalentUnits?: boolean | null;
};

type ShortTextAnswerOption = { id: string; text: string; isCorrect: boolean };

function resolveShortTextQuestionConfig(config?: ShortTextQuestionConfig) {
  const numericSettings = resolveNumericQuestionEvaluationSettings({
    numericInputKind: (config?.numericInputKind as NumericInputKind | null | undefined) ?? null,
    numericToleranceMode:
      (config?.numericToleranceMode as NumericToleranceMode | null | undefined) ?? null,
    numericAbsoluteTolerance: config?.numericAbsoluteTolerance ?? null,
    numericRelativeTolerancePercent: config?.numericRelativeTolerancePercent ?? null,
    numericUnitFamily: (config?.numericUnitFamily as NumericUnitFamily | null | undefined) ?? null,
    numericRequireUnit: config?.numericRequireUnit ?? false,
    numericAcceptEquivalentUnits: config?.numericAcceptEquivalentUnits ?? true,
  });

  return {
    shortTextEvaluationKind: resolveShortTextEvaluationKind(
      (config?.shortTextEvaluationKind as ShortTextEvaluationKind | null | undefined) ?? undefined,
    ),
    shortTextMaxLength: config?.shortTextMaxLength ?? null,
    shortTextCaseSensitive: config?.shortTextCaseSensitive ?? false,
    shortTextEvaluationMode:
      (config?.shortTextEvaluationMode as ShortAnswerEvaluationMode | null | undefined) ??
      SHORT_TEXT_DEFAULT_EVALUATION_MODE,
    shortTextToleranceLevel:
      (config?.shortTextToleranceLevel as ToleranceLevel | null | undefined) ??
      SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
    shortTextAllowPartialCredit: config?.shortTextAllowPartialCredit ?? true,
    shortTextTrimWhitespace: config?.shortTextTrimWhitespace ?? true,
    shortTextNormalizeWhitespace: config?.shortTextNormalizeWhitespace ?? true,
    numericInputKind: numericSettings.inputKind,
    numericToleranceMode: numericSettings.toleranceMode,
    numericAbsoluteTolerance: numericSettings.absoluteTolerance,
    numericRelativeTolerancePercent: numericSettings.relativeTolerancePercent,
    numericUnitFamily: numericSettings.unitFamily,
    numericRequireUnit: numericSettings.requireUnit,
    numericAcceptEquivalentUnits: numericSettings.acceptEquivalentUnits,
  };
}

function getShortTextDtoFields(
  questionType: string,
  config?: ShortTextQuestionConfig,
): {
  shortTextEvaluationKind?: ShortTextEvaluationKind;
  shortTextMaxLength: number | null;
  shortTextCaseSensitive?: boolean;
  shortTextEvaluationMode?: ShortAnswerEvaluationMode;
  shortTextToleranceLevel?: ToleranceLevel;
  shortTextAllowPartialCredit?: boolean;
  shortTextTrimWhitespace?: boolean;
  shortTextNormalizeWhitespace?: boolean;
  numericInputKind?: NumericInputKind;
  numericToleranceMode?: NumericToleranceMode;
  numericAbsoluteTolerance?: number | null;
  numericRelativeTolerancePercent?: number | null;
  numericUnitFamily?: NumericUnitFamily;
  numericRequireUnit?: boolean;
  numericAcceptEquivalentUnits?: boolean;
} {
  if (questionType !== 'SHORT_TEXT') {
    return {
      shortTextEvaluationKind: undefined,
      shortTextMaxLength: null,
      shortTextCaseSensitive: undefined,
      shortTextEvaluationMode: undefined,
      shortTextToleranceLevel: undefined,
      shortTextAllowPartialCredit: undefined,
      shortTextTrimWhitespace: undefined,
      shortTextNormalizeWhitespace: undefined,
      numericInputKind: undefined,
      numericToleranceMode: undefined,
      numericAbsoluteTolerance: undefined,
      numericRelativeTolerancePercent: undefined,
      numericUnitFamily: undefined,
      numericRequireUnit: undefined,
      numericAcceptEquivalentUnits: undefined,
    };
  }

  const resolved = resolveShortTextQuestionConfig(config);
  return {
    shortTextEvaluationKind: resolved.shortTextEvaluationKind,
    shortTextMaxLength: resolveShortTextMaxLength(resolved.shortTextMaxLength),
    shortTextCaseSensitive: resolved.shortTextCaseSensitive,
    shortTextEvaluationMode: resolved.shortTextEvaluationMode,
    shortTextToleranceLevel: resolved.shortTextToleranceLevel,
    shortTextAllowPartialCredit: resolved.shortTextAllowPartialCredit,
    shortTextTrimWhitespace: resolved.shortTextTrimWhitespace,
    shortTextNormalizeWhitespace: resolved.shortTextNormalizeWhitespace,
    numericInputKind: resolved.numericInputKind,
    numericToleranceMode: resolved.numericToleranceMode,
    numericAbsoluteTolerance: resolved.numericAbsoluteTolerance,
    numericRelativeTolerancePercent: resolved.numericRelativeTolerancePercent,
    numericUnitFamily: resolved.numericUnitFamily,
    numericRequireUnit: resolved.numericRequireUnit,
    numericAcceptEquivalentUnits: resolved.numericAcceptEquivalentUnits,
  };
}

function getShortTextDisplayValue(value: string, config?: ShortTextQuestionConfig): string {
  const resolved = resolveShortTextQuestionConfig(config);
  return normalizeShortTextValue(value, {
    caseSensitive: true,
    trimWhitespace: resolved.shortTextTrimWhitespace,
    normalizeWhitespace: resolved.shortTextNormalizeWhitespace,
  });
}

function getShortTextMatchedAnswerId(
  value: string,
  options?: ShortTextQuestionConfig & { answers?: ShortTextAnswerOption[] },
): string | undefined {
  const answers = options?.answers ?? [];
  if (!answers.length) {
    return undefined;
  }

  const resolved = resolveShortTextQuestionConfig(options);
  const evaluation = usesNumericShortTextEvaluation(resolved.shortTextEvaluationKind)
    ? evaluateNumericAnswer({
        modelAnswers: answers.filter((answer) => answer.isCorrect).map((answer) => answer.text),
        studentAnswer: value,
        maxPoints: 1,
        settings: {
          inputKind: resolved.numericInputKind,
          toleranceMode: resolved.numericToleranceMode,
          absoluteTolerance: resolved.numericAbsoluteTolerance,
          relativeTolerancePercent: resolved.numericRelativeTolerancePercent,
          unitFamily: usesShortTextUnitEvaluation(resolved.shortTextEvaluationKind)
            ? resolved.numericUnitFamily
            : 'none',
          requireUnit: usesShortTextUnitEvaluation(resolved.shortTextEvaluationKind)
            ? resolved.numericRequireUnit
            : false,
          acceptEquivalentUnits: usesShortTextUnitEvaluation(resolved.shortTextEvaluationKind)
            ? resolved.numericAcceptEquivalentUnits
            : true,
        },
      })
    : evaluateShortAnswer({
        modelAnswers: answers.filter((answer) => answer.isCorrect).map((answer) => answer.text),
        studentAnswer: value,
        maxPoints: 1,
        maxLength: resolved.shortTextMaxLength,
        settings: {
          caseSensitive: resolved.shortTextCaseSensitive,
          evaluationMode: resolved.shortTextEvaluationMode,
          toleranceLevel: resolved.shortTextToleranceLevel,
          allowPartialCredit: resolved.shortTextAllowPartialCredit,
          trimWhitespace: resolved.shortTextTrimWhitespace,
          normalizeWhitespace: resolved.shortTextNormalizeWhitespace,
        },
      });

  if (evaluation.points <= 0 || !evaluation.matchedModelAnswer) {
    return undefined;
  }

  return answers.find((answer) => answer.isCorrect && answer.text === evaluation.matchedModelAnswer)
    ?.id;
}

async function getVoteSummaryCached(
  code: string,
  sessionId: string,
  questionId: string,
  round: number,
  questionType: QuestionType,
  options?: {
    answers?: Array<{ id: string; text: string; isCorrect: boolean }>;
  } & ShortTextQuestionConfig,
): Promise<VoteSummary> {
  const key = voteCacheKey(code, questionId, round);
  return getOrComputeCached(
    voteSummaryCache,
    voteSummaryInFlight,
    key,
    VOTE_SUMMARY_CACHE_TTL_MS,
    async () => {
      if (questionType === 'FREETEXT') {
        const votes = await prisma.vote.findMany({
          where: { sessionId, questionId, round },
          select: { freeText: true },
        });
        return {
          totalVotes: votes.length,
          answerVoteCounts: {},
          freeTextResponses: votes
            .map((vote) => vote.freeText?.trim())
            .filter((value): value is string => !!value),
          incorrectFreeTextResponses: [],
          correctVoteCount: 0,
          incorrectVoteCount: 0,
          numericValues: [],
        };
      }

      if (questionType === 'SHORT_TEXT') {
        const votes = await prisma.vote.findMany({
          where: { sessionId, questionId, round },
          select: { freeText: true },
        });

        const answerVoteCounts: Record<string, number> = {};
        const incorrectFreeTextResponses: string[] = [];
        let correctVoteCount = 0;
        let incorrectVoteCount = 0;

        for (const vote of votes) {
          const displayValue = getShortTextDisplayValue(vote.freeText ?? '', options);
          const matchedAnswerId = getShortTextMatchedAnswerId(vote.freeText ?? '', options);

          if (matchedAnswerId) {
            answerVoteCounts[matchedAnswerId] = (answerVoteCounts[matchedAnswerId] ?? 0) + 1;
            correctVoteCount += 1;
          } else {
            incorrectVoteCount += 1;
            if (displayValue) {
              incorrectFreeTextResponses.push(displayValue);
            }
          }
        }

        return {
          totalVotes: votes.length,
          answerVoteCounts,
          freeTextResponses: [],
          incorrectFreeTextResponses,
          correctVoteCount,
          incorrectVoteCount,
          numericValues: [],
        };
      }

      if (questionType === 'NUMERIC_ESTIMATE') {
        const votes = await prisma.vote.findMany({
          where: { sessionId, questionId, round },
          select: { numericValue: true },
        });
        return {
          totalVotes: votes.length,
          answerVoteCounts: {},
          freeTextResponses: [],
          incorrectFreeTextResponses: [],
          correctVoteCount: 0,
          incorrectVoteCount: 0,
          numericValues: votes
            .map((vote) => vote.numericValue)
            .filter((value): value is number => value !== null && value !== undefined),
        };
      }

      const votes = await prisma.vote.findMany({
        where: { sessionId, questionId, round },
        select: { selectedAnswers: { select: { answerOptionId: true } } },
      });
      const answerVoteCounts: Record<string, number> = {};
      for (const vote of votes) {
        for (const selectedAnswer of vote.selectedAnswers) {
          answerVoteCounts[selectedAnswer.answerOptionId] =
            (answerVoteCounts[selectedAnswer.answerOptionId] ?? 0) + 1;
        }
      }
      return {
        totalVotes: votes.length,
        answerVoteCounts,
        freeTextResponses: [],
        incorrectFreeTextResponses: [],
        correctVoteCount: 0,
        incorrectVoteCount: 0,
        numericValues: [],
      };
    },
  );
}

export function recordVoteCachesForCode(
  code: string,
  questionId: string,
  round: number,
  payload: {
    answerIds: string[];
    freeText: string | null;
    questionType: QuestionType;
    isCorrect?: boolean;
    numericValue?: number | null;
  },
): void {
  const normalizedCode = code.toUpperCase();
  const key = voteCacheKey(normalizedCode, questionId, round);
  const cachedCount = getCachedValue(voteCountCache, key);
  if (cachedCount !== null) {
    setCachedValue(voteCountCache, key, cachedCount + 1, VOTE_COUNT_CACHE_TTL_MS);
  }

  const cachedSummary = getCachedValue(voteSummaryCache, key);
  if (cachedSummary !== null) {
    const nextSummary: VoteSummary = {
      totalVotes: cachedSummary.totalVotes + 1,
      answerVoteCounts: { ...cachedSummary.answerVoteCounts },
      freeTextResponses: [...cachedSummary.freeTextResponses],
      incorrectFreeTextResponses: [...cachedSummary.incorrectFreeTextResponses],
      correctVoteCount: cachedSummary.correctVoteCount,
      incorrectVoteCount: cachedSummary.incorrectVoteCount,
      numericValues: [...cachedSummary.numericValues],
    };
    for (const answerId of payload.answerIds) {
      nextSummary.answerVoteCounts[answerId] = (nextSummary.answerVoteCounts[answerId] ?? 0) + 1;
    }
    const trimmedFreeText = payload.freeText?.trim();
    if (payload.questionType === 'FREETEXT' && trimmedFreeText) {
      nextSummary.freeTextResponses.push(trimmedFreeText);
    }
    if (payload.questionType === 'SHORT_TEXT') {
      if (payload.isCorrect) {
        nextSummary.correctVoteCount += 1;
      } else {
        nextSummary.incorrectVoteCount += 1;
        if (trimmedFreeText) {
          nextSummary.incorrectFreeTextResponses.push(trimmedFreeText);
        }
      }
    }
    if (payload.numericValue !== null && payload.numericValue !== undefined) {
      nextSummary.numericValues.push(payload.numericValue);
    }
    setCachedValue(voteSummaryCache, key, nextSummary, VOTE_SUMMARY_CACHE_TTL_MS);
  }
}

function participantMembershipCacheKey(code: string, participantId: string): string {
  return `${code}:${participantId}`;
}

async function getParticipantBelongsToSessionCached(
  code: string,
  sessionId: string,
  participantId: string | undefined,
): Promise<boolean> {
  if (!participantId) return false;
  const key = participantMembershipCacheKey(code, participantId);
  return getOrComputeCached(
    participantMembershipCache,
    participantMembershipInFlight,
    key,
    PARTICIPANT_MEMBERSHIP_CACHE_TTL_MS,
    async () => {
      const participant = await prisma.participant.findFirst({
        where: {
          id: participantId,
          sessionId,
        },
        select: { id: true },
      });
      return !!participant;
    },
  );
}

function normalizeTeamLeaderboardScore(rawTotalScore: number, memberCount: number): number {
  if (!Number.isFinite(rawTotalScore) || memberCount <= 0) {
    return 0;
  }

  const averageScore = rawTotalScore / memberCount;
  return Math.round(averageScore * 10) / 10;
}

/** Typen für getExportData-Callbacks (vermeidet implizites any). */
interface QuestionWithAnswersForExport {
  id: string;
  order: number;
  text: string;
  type: string;
  shortTextEvaluationKind: string;
  shortTextMaxLength: number | null;
  shortTextCaseSensitive: boolean;
  shortTextEvaluationMode: string;
  shortTextToleranceLevel: string;
  shortTextAllowPartialCredit: boolean;
  shortTextTrimWhitespace: boolean;
  shortTextNormalizeWhitespace: boolean;
  numericInputKind: string | null;
  numericToleranceMode: string | null;
  numericAbsoluteTolerance: number | null;
  numericRelativeTolerancePercent: number | null;
  numericUnitFamily: string | null;
  numericRequireUnit: boolean;
  numericAcceptEquivalentUnits: boolean;
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
  activeParticipantIds?: Set<string>,
) {
  if (!questionId) return undefined;

  const activeIds = activeParticipantIds ?? (await getActiveParticipantIdsForSession(session.id));
  const readyParticipantIds = await getReadingReadyParticipantIds(session.id, questionId);
  const sessionParticipantIds = new Set(session.participants.map((participant) => participant.id));

  const connectedParticipantIds = [...activeIds].filter((id) => sessionParticipantIds.has(id));
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
  let connectedCount = 0;
  let readingReady: z.infer<typeof ReadingReadyStatusDTOSchema> | undefined;

  if (readingQuestionId) {
    const activeParticipantIds = await getActiveParticipantIdsForSession(session.id);
    readingReady = await buildReadingReadyStatus(
      session,
      readingQuestionId,
      participantId,
      activeParticipantIds,
    );
    connectedCount = readingReady?.connectedCount ?? 0;
  } else if (session.participants.length > 0) {
    connectedCount = await getActiveParticipantCountForSession(session.id);
  }

  return SessionParticipantsPayloadSchema.parse({
    participants: session.participants.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      teamId: p.teamId ?? null,
      teamName: p.team?.name ?? null,
    })),
    participantCount: session.participants.length,
    connectedCount,
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
  showQuestionTypeIndicators: true,
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
      numericToleranceMode: true,
      numericReferenceValue: true,
      numericTolerancePercent: true,
      numericIntervalLeft: true,
      numericIntervalRight: true,
      numericInputType: true,
      numericDecimalPlaces: true,
      numericMin: true,
      numericMax: true,
      numericTwoRounds: true,
      skipReadingPhase: true,
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
    showQuestionTypeIndicators: quiz.showQuestionTypeIndicators,
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
      numericToleranceMode:
        question.type === 'SHORT_TEXT'
          ? ((question.numericToleranceMode as 'exact' | 'absolute' | 'relative' | null) ??
            undefined)
          : undefined,
      numericReferenceValue: question.numericReferenceValue ?? undefined,
      numericTolerancePercent: question.numericTolerancePercent ?? undefined,
      numericIntervalLeft: question.numericIntervalLeft ?? undefined,
      numericIntervalRight: question.numericIntervalRight ?? undefined,
      numericInputType: (question.numericInputType as 'INTEGER' | 'DECIMAL' | null) ?? undefined,
      numericDecimalPlaces: question.numericDecimalPlaces ?? undefined,
      numericMin: question.numericMin ?? undefined,
      numericMax: question.numericMax ?? undefined,
      numericTwoRounds: question.numericTwoRounds ?? undefined,
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
  nicknameTheme: 'KINDERGARTEN',
  allowCustomNicknames: false,
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

function defaultPreferredLiveChannel(
  channels: z.infer<typeof SessionChannelsDTOSchema>,
): z.infer<typeof SessionLiveChannelSchema> {
  if (channels.quiz.enabled) return 'quiz';
  if (channels.qa.enabled) return 'qa';
  if (channels.quickFeedback.enabled) return 'quickFeedback';
  return 'quiz';
}

function resolvePreferredLiveChannel(
  code: string,
  channels: z.infer<typeof SessionChannelsDTOSchema>,
): z.infer<typeof SessionLiveChannelSchema> {
  const stored = preferredLiveChannelByCode.get(code.toUpperCase());
  if (stored === 'quiz' && channels.quiz.enabled) return stored;
  if (stored === 'qa' && channels.qa.enabled) return stored;
  if (stored === 'quickFeedback' && channels.quickFeedback.enabled) return stored;
  return defaultPreferredLiveChannel(channels);
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

  if (
    questionType !== 'SINGLE_CHOICE' &&
    questionType !== 'MULTIPLE_CHOICE' &&
    questionType !== 'NUMERIC_ESTIMATE'
  ) {
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

type HostCurrentQuestionSession = {
  id: string;
  code: string;
  status: string;
  currentQuestion: number | null;
  currentRound: number;
  answerDisplayOrder: Prisma.JsonValue | null;
  quiz: {
    defaultTimer: number | null;
    timerScaleByDifficulty: boolean | null;
    showQuestionTypeIndicators: boolean | null;
    preset: string | null;
    questions: Array<{
      id: string;
      order: number;
      text: string;
      type: string;
      timer: number | null;
      difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      ratingMin: number | null;
      ratingMax: number | null;
      ratingLabelMin: string | null;
      ratingLabelMax: string | null;
      shortTextEvaluationKind: string;
      shortTextMaxLength: number | null;
      shortTextCaseSensitive: boolean;
      shortTextEvaluationMode: string;
      shortTextToleranceLevel: string;
      shortTextAllowPartialCredit: boolean;
      shortTextTrimWhitespace: boolean;
      shortTextNormalizeWhitespace: boolean;
      numericInputKind: string | null;
      numericToleranceMode: string | null;
      numericAbsoluteTolerance: number | null;
      numericRelativeTolerancePercent: number | null;
      numericUnitFamily: string | null;
      numericRequireUnit: boolean;
      numericAcceptEquivalentUnits: boolean;
      skipReadingPhase: boolean;
      numericReferenceValue: number | null;
      numericTolerancePercent: number | null;
      numericIntervalLeft: number | null;
      numericIntervalRight: number | null;
      numericInputType: string | null;
      numericDecimalPlaces: number | null;
      numericMin: number | null;
      numericMax: number | null;
      numericTwoRounds: boolean;
      answers: Array<{ id: string; text: string; isCorrect: boolean }>;
    }>;
  } | null;
};

// ---------------------------------------------------------------------------
// Numerische Schätzfrage – Statistik-Hilfsfunktionen (Story 1.2d)
// ---------------------------------------------------------------------------

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function buildNumericStats(
  values: number[],
  band: { left: number; right: number } | null,
  referenceValue: number | null,
): NumericStatsDTO {
  const n = values.length;
  const empty: NumericStatsDTO = {
    n: 0,
    mean: null,
    median: null,
    stdDev: null,
    q1: null,
    q3: null,
    iqr: null,
    min: null,
    max: null,
    inBandCount: 0,
    inBandPercent: null,
    meanAbsoluteError: null,
    meanRelativeError: null,
  };
  if (n === 0) return empty;

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const median =
    n % 2 === 0 ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : sorted[Math.floor(n / 2)]!;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const q1 = sorted[Math.floor(n / 4)]!;
  const q3 = sorted[Math.min(Math.floor((3 * n) / 4), n - 1)]!;
  const iqr = q3 - q1;
  const min = sorted[0]!;
  const max = sorted[n - 1]!;

  const inBandCount = band ? values.filter((v) => isNumericValueInBand(v, band)).length : 0;
  const inBandPercent = band ? round4((inBandCount / n) * 100) : null;

  const meanAbsoluteError =
    referenceValue !== null
      ? round4(values.reduce((s, v) => s + Math.abs(v - referenceValue), 0) / n)
      : null;
  const meanRelativeError =
    referenceValue !== null && referenceValue !== 0
      ? round4(
          (values.reduce((s, v) => s + Math.abs(v - referenceValue) / Math.abs(referenceValue), 0) /
            n) *
            100,
        )
      : null;

  return {
    n,
    mean: round4(mean),
    median: round4(median),
    stdDev: round4(stdDev),
    q1,
    q3,
    iqr: round4(iqr),
    min,
    max,
    inBandCount,
    inBandPercent,
    meanAbsoluteError,
    meanRelativeError,
  };
}

function buildNumericHistogram(
  values: number[],
  band: { left: number; right: number } | null,
  targetBins = 10,
): NumericHistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [
      {
        from: min,
        to: max,
        count: values.length,
        inBand: band ? isNumericValueInBand(min, band) : false,
      },
    ];
  }
  const binWidth = (max - min) / targetBins;
  const bins: NumericHistogramBin[] = [];
  for (let i = 0; i < targetBins; i++) {
    const from = min + i * binWidth;
    const to = i === targetBins - 1 ? max : min + (i + 1) * binWidth;
    const count = values.filter((v) =>
      i === targetBins - 1 ? v >= from && v <= to : v >= from && v < to,
    ).length;
    const midpoint = (from + to) / 2;
    bins.push({
      from: round4(from),
      to: round4(to),
      count,
      inBand: band ? isNumericValueInBand(midpoint, band) : false,
    });
  }
  return bins.filter((b) => b.count > 0);
}

async function buildNumericRoundComparison(
  sessionId: string,
  questionId: string,
  band: { left: number; right: number } | null,
  referenceValue: number | null,
): Promise<NumericRoundComparisonDTO> {
  const [r1Votes, r2Votes] = await Promise.all([
    prisma.vote.findMany({
      where: { sessionId, questionId, round: 1 },
      select: { participantId: true, numericValue: true },
    }),
    prisma.vote.findMany({
      where: { sessionId, questionId, round: 2 },
      select: { participantId: true, numericValue: true },
    }),
  ]);

  const r1Values = r1Votes
    .map((v) => v.numericValue)
    .filter((v): v is number => v !== null && v !== undefined);
  const r2Values = r2Votes
    .map((v) => v.numericValue)
    .filter((v): v is number => v !== null && v !== undefined);

  const round1Stats = buildNumericStats(r1Values, band, referenceValue);
  const round2Stats = buildNumericStats(r2Values, band, referenceValue);
  const round1Histogram = buildNumericHistogram(r1Values, band);
  const round2Histogram = buildNumericHistogram(r2Values, band);

  let pairedAnalysis: NumericPairedAnalysisDTO | undefined;
  if (r1Votes.length > 0 && r2Votes.length > 0) {
    const r1Map = new Map(
      r1Votes
        .filter((v) => v.numericValue !== null)
        .map((v) => [v.participantId, v.numericValue as number]),
    );
    const r2Map = new Map(
      r2Votes
        .filter((v) => v.numericValue !== null)
        .map((v) => [v.participantId, v.numericValue as number]),
    );

    let closerCount = 0;
    let fartherCount = 0;
    let unchangedCount = 0;
    let pairedCount = 0;

    if (referenceValue !== null) {
      for (const [pid, v1] of r1Map) {
        const v2 = r2Map.get(pid);
        if (v2 === undefined) continue;
        pairedCount++;
        const d1 = Math.abs(v1 - referenceValue);
        const d2 = Math.abs(v2 - referenceValue);
        if (Math.abs(d1 - d2) < 1e-9) {
          unchangedCount++;
        } else if (d2 < d1) {
          closerCount++;
        } else {
          fartherCount++;
        }
      }
    } else {
      // Without reference value, count pairs
      for (const pid of r1Map.keys()) {
        if (r2Map.has(pid)) pairedCount++;
      }
    }

    pairedAnalysis = { pairedCount, closerCount, fartherCount, unchangedCount };
  }

  return {
    round1Stats,
    round2Stats,
    round1Histogram,
    round2Histogram,
    pairedAnalysis,
  };
}

async function buildHostCurrentQuestionDto(
  session: HostCurrentQuestionSession | null,
): Promise<z.infer<typeof HostCurrentQuestionDTOSchema> | null> {
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
    type: question.type as QuestionType,
    difficulty: question.difficulty,
    showQuestionTypeIndicators: session.quiz.showQuestionTypeIndicators ?? true,
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
    ...getShortTextDtoFields(question.type, question),
    currentRound: session.currentRound,
    // Story 1.2d: Numerische Konfiguration für Host (immer sichtbar)
    numericToleranceMode:
      (question.numericToleranceMode as NumericEstimateToleranceMode | null) ?? undefined,
    numericReferenceValue: question.numericReferenceValue ?? null,
    numericTolerancePercent: question.numericTolerancePercent ?? null,
    numericIntervalLeft: question.numericIntervalLeft ?? null,
    numericIntervalRight: question.numericIntervalRight ?? null,
    numericInputType: (question.numericInputType as 'INTEGER' | 'DECIMAL' | null) ?? undefined,
    numericDecimalPlaces: question.numericDecimalPlaces ?? null,
    numericMin: question.numericMin ?? null,
    numericMax: question.numericMax ?? null,
    numericTwoRounds: question.numericTwoRounds,
  };

  if (session.status === 'DISCUSSION') {
    return base;
  }

  if (session.status === 'RESULTS' || session.status === 'ACTIVE') {
    const currentRound = session.currentRound;
    const voteWhere = { sessionId: session.id, questionId: question.id, round: currentRound };

    if (question.type === 'NUMERIC_ESTIMATE') {
      const numVotes = await prisma.vote.findMany({
        where: voteWhere,
        select: { numericValue: true },
      });
      const numValues = numVotes
        .map((v) => v.numericValue)
        .filter((v): v is number => v !== null && v !== undefined);
      const totalVotes = numVotes.length;

      const toleranceMode = question.numericToleranceMode as NumericEstimateToleranceMode | null;
      const band = toleranceMode
        ? resolveNumericTolerance(toleranceMode, {
            referenceValue: question.numericReferenceValue,
            tolerancePercent: question.numericTolerancePercent,
            intervalLeft: question.numericIntervalLeft,
            intervalRight: question.numericIntervalRight,
          })
        : null;

      const referenceValue =
        toleranceMode === 'RELATIVE_PERCENT' ? (question.numericReferenceValue ?? null) : null;

      // Kein Herdeneffekt während ACTIVE: nur totalVotes
      if (session.status === 'ACTIVE') {
        const correctVoterCount =
          band !== null ? numValues.filter((v) => isNumericValueInBand(v, band)).length : undefined;
        const peerInstructionSuggestion = question.numericTwoRounds
          ? buildPeerInstructionSuggestion(
              question.type as QuestionType,
              currentRound,
              correctVoterCount,
              totalVotes,
            )
          : undefined;
        return { ...base, totalVotes, peerInstructionSuggestion };
      }

      // RESULTS: Histogramm + Statistik
      const numericStats = buildNumericStats(numValues, band, referenceValue);
      const numericHistogram = buildNumericHistogram(numValues, band);

      let numericRoundComparison: NumericRoundComparisonDTO | undefined;
      if (session.status === 'RESULTS' && currentRound === 2) {
        numericRoundComparison = await buildNumericRoundComparison(
          session.id,
          question.id,
          band,
          referenceValue,
        );
      }

      return {
        ...base,
        totalVotes,
        numericStats,
        numericHistogram,
        numericRoundComparison,
      };
    }

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
      const texts = freeTextVotes.map((v) => v.freeText?.trim()).filter((t): t is string => !!t);
      return { ...base, freeTextResponses: texts, totalVotes: freeTextVotes.length };
    }

    if (question.type === 'SHORT_TEXT') {
      const voteSummary = await getVoteSummaryCached(
        session.code,
        session.id,
        question.id,
        currentRound,
        question.type as QuestionType,
        {
          answers: answersOrdered,
          ...resolveShortTextQuestionConfig(question),
        },
      );

      if (session.status === 'ACTIVE') {
        return {
          ...base,
          totalVotes: voteSummary.totalVotes,
          correctVoterCount: voteSummary.correctVoteCount,
          incorrectVoterCount: voteSummary.incorrectVoteCount,
        };
      }

      const voteDistribution = answersOrdered.map((answer) => ({
        id: answer.id,
        text: answer.text,
        isCorrect: answer.isCorrect,
        voteCount: voteSummary.answerVoteCounts[answer.id] ?? 0,
        votePercentage:
          voteSummary.totalVotes > 0
            ? Math.round(
                ((voteSummary.answerVoteCounts[answer.id] ?? 0) / voteSummary.totalVotes) * 100,
              )
            : 0,
      }));

      return {
        ...base,
        totalVotes: voteSummary.totalVotes,
        correctVoterCount: voteSummary.correctVoteCount,
        incorrectVoterCount: voteSummary.incorrectVoteCount,
        incorrectFreeTextResponses:
          voteSummary.incorrectFreeTextResponses.length > 0
            ? voteSummary.incorrectFreeTextResponses
            : undefined,
        voteDistribution,
      };
    }

    const choiceVotes = await prisma.vote.findMany({
      where: voteWhere,
      select: { selectedAnswers: { select: { answerOptionId: true } } },
    });

    const totalVotes = choiceVotes.length;
    const answerVoteCounts = new Map<string, number>();
    for (const v of choiceVotes) {
      for (const sa of v.selectedAnswers) {
        answerVoteCounts.set(sa.answerOptionId, (answerVoteCounts.get(sa.answerOptionId) ?? 0) + 1);
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
}

async function fetchHostCurrentQuestion(
  code: string,
): Promise<z.infer<typeof HostCurrentQuestionDTOSchema> | null> {
  const normalizedCode = code.toUpperCase();
  const session = await prisma.session.findUnique({
    where: { code: normalizedCode },
    select: {
      id: true,
      code: true,
      status: true,
      currentQuestion: true,
      currentRound: true,
      answerDisplayOrder: true,
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
              shortTextEvaluationKind: true,
              shortTextMaxLength: true,
              shortTextCaseSensitive: true,
              shortTextEvaluationMode: true,
              shortTextToleranceLevel: true,
              shortTextAllowPartialCredit: true,
              shortTextTrimWhitespace: true,
              shortTextNormalizeWhitespace: true,
              numericInputKind: true,
              numericToleranceMode: true,
              numericAbsoluteTolerance: true,
              numericRelativeTolerancePercent: true,
              numericUnitFamily: true,
              numericRequireUnit: true,
              numericAcceptEquivalentUnits: true,
              numericReferenceValue: true,
              numericTolerancePercent: true,
              numericIntervalLeft: true,
              numericIntervalRight: true,
              numericInputType: true,
              numericDecimalPlaces: true,
              numericMin: true,
              numericMax: true,
              numericTwoRounds: true,
              skipReadingPhase: true,
              answers: { select: { id: true, text: true, isCorrect: true } },
            },
          },
          defaultTimer: true,
          timerScaleByDifficulty: true,
          showQuestionTypeIndicators: true,
          preset: true,
        },
      },
    },
  });
  return buildHostCurrentQuestionDto(session);
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
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      invalidateSessionStatusCachesForCode(code);
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
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
        invalidateSessionMetadataCachesForCode(code);
        return buildSessionChannels(updated);
      }

      return buildSessionChannels(session);
    }),

  enableQuickFeedbackChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
        invalidateSessionMetadataCachesForCode(code);
        return buildSessionChannels(updated);
      }

      return buildSessionChannels(session);
    }),

  attachQuizToSession: hostProcedure
    .input(AttachQuizToSessionInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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

      invalidateSessionStatusCachesForCode(code);
      return buildSessionChannels(updated);
    }),

  closeQaChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      invalidateSessionMetadataCachesForCode(code);
      return buildSessionChannels(updated);
    }),

  reopenQaChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      invalidateSessionMetadataCachesForCode(code);
      return buildSessionChannels(updated);
    }),

  closeQuickFeedbackChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      invalidateSessionMetadataCachesForCode(code);
      return buildSessionChannels(updated);
    }),

  reopenQuickFeedbackChannel: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(UpdateSessionChannelsOutputSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      invalidateSessionMetadataCachesForCode(code);
      return buildSessionChannels(updated);
    }),

  /** Session-Info per Code (für Beitritt, Story 3.1, 3.2). Enthält Nickname-Konfiguration bei QUIZ. */
  getInfo: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionInfoDTOSchema)
    .query(async ({ input }) => {
      const code = input.code.toUpperCase();
      const payload = await getOrComputeCached(
        sessionInfoCache,
        sessionInfoInFlight,
        code,
        SESSION_INFO_CACHE_TTL_MS,
        async () => {
          const session = await prisma.session.findUnique({
            where: { code },
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
                    showQuestionTypeIndicators: true,
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
          const channels = buildSessionChannels(session);
          return {
            id: session.id,
            code: session.code,
            type: session.type,
            status: session.status,
            quizName: q?.name ?? null,
            quizMotifImageUrl: q?.motifImageUrl ?? null,
            title: session.title ?? null,
            channels,
            preferredChannel: resolvePreferredLiveChannel(session.code, channels),
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
              showQuestionTypeIndicators: q.showQuestionTypeIndicators,
              readingPhaseEnabled: q.readingPhaseEnabled,
              defaultTimer: q.defaultTimer,
              timerScaleByDifficulty: q.timerScaleByDifficulty,
              backgroundMusic: q.backgroundMusic,
              bonusTokenCount: q.bonusTokenCount,
              preset: q.preset as 'PLAYFUL' | 'SERIOUS',
            }),
          };
        },
      );
      return {
        ...payload,
        serverTime: new Date().toISOString(),
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
      const code = input.code.toUpperCase();
      const cached = getCachedParticipantNicknames(code);
      if (cached) {
        return cached;
      }
      const session = await prisma.session.findUnique({
        where: { code },
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
      const payload = {
        nicknames: session.participants.map((participant) => participant.nickname),
        participantCount: session.participants.length,
      };
      setCachedParticipantNicknames(code, payload);
      return payload;
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
      emitSessionParticipantSignal(input.code);

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

  /** Subscription: Lobby-Teilnehmerliste (Story 2.2). Wartet primär auf Signalereignisse und nutzt nur einen seltenen Timeout-Fallback. */
  onParticipantJoined: hostProcedure
    .input(GetSessionInfoInputSchema)
    .subscription(async function* ({ input }) {
      const code = input.code.toUpperCase();
      let lastJson = '';
      while (true) {
        const payload = await fetchParticipantsSnapshot(code);
        const json = JSON.stringify(payload);
        if (json !== lastJson) {
          lastJson = json;
          yield payload;
        }
        const waitMs = payload.readingReady
          ? PARTICIPANT_EVENT_WAIT_ACTIVE_MS
          : PARTICIPANT_EVENT_WAIT_IDLE_MS;
        const currentVersion = getSessionParticipantSignalVersion(code);
        await waitForSessionParticipantSignal(code, currentVersion, waitMs);
      }
    }),

  /** Subscription: Status-Wechsel (Story 2.3). Pollt alle 2s und pusht bei Änderung. */
  updatePreset: hostProcedure.input(UpdateSessionPresetInputSchema).mutation(async ({ input }) => {
    const code = input.code.toUpperCase();
    const session = await prisma.session.findUnique({
      where: { code },
      select: { id: true, quizId: true },
    });
    if (!session || !session.quizId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
    }
    await prisma.quiz.update({
      where: { id: session.quizId },
      data: { preset: input.preset },
    });
    invalidateSessionMetadataCachesForCode(code);
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
      invalidateSessionMetadataCachesForCode(code);
      return {
        qaTitle: updated.qaTitle,
        title: updated.title,
      };
    }),

  setPreferredLiveChannel: hostProcedure
    .input(
      z.object({
        code: z.string().length(6),
        channel: SessionLiveChannelSchema,
      }),
    )
    .output(z.object({ preferredChannel: SessionLiveChannelSchema }))
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }

      const channels = buildSessionChannels(session);
      if (input.channel === 'quiz' && !channels.quiz.enabled) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quiz-Kanal ist nicht aktiv.' });
      }
      if (input.channel === 'qa' && !channels.qa.enabled) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Q&A-Kanal ist nicht aktiv.' });
      }
      if (input.channel === 'quickFeedback' && !channels.quickFeedback.enabled) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Blitzlicht-Kanal ist nicht aktiv.',
        });
      }

      preferredLiveChannelByCode.set(code, input.channel);
      invalidateSessionStatusCachesForCode(code);
      return { preferredChannel: input.channel };
    }),

  onStatusChanged: publicProcedure.input(GetSessionInfoInputSchema).subscription(async function* ({
    input,
  }) {
    const code = input.code.toUpperCase();
    let lastJson = '';
    while (true) {
      const payloadBase = await fetchStatusSnapshot(code);
      const json = JSON.stringify(payloadBase);
      if (json !== lastJson) {
        lastJson = json;
        yield { ...payloadBase, serverTime: new Date().toISOString() };
      }
      const waitMs = FAST_STATUS_POLL_SET.has(payloadBase.status)
        ? STATUS_EVENT_WAIT_ACTIVE_MS
        : STATUS_EVENT_WAIT_IDLE_MS;
      const currentVersion = getSessionStatusSignalVersion(code);
      await waitForSessionStatusSignal(code, currentVersion, waitMs);
    }
  }),

  /** Nächste Frage öffnen (Story 2.3). LOBBY/PAUSED/RESULTS/DISCUSSION → QUESTION_OPEN oder ACTIVE; bei Lesephase aus: direkt ACTIVE.
   * Zusätzlich: ACTIVE + currentQuestion null (z. B. nach Q&A-Start aus der Lobby) erlaubt den Start der ersten Quiz-Frage. */
  nextQuestion: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
        invalidateSessionStatusCachesForCode(code);
        await incrementCompletedSessionsTotal();
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
      invalidateSessionStatusCachesForCode(code);
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
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      invalidateSessionStatusCachesForCode(code);
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
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      invalidateSessionStatusCachesForCode(code);
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
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      invalidateSessionStatusCachesForCode(code);
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
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      invalidateSessionStatusCachesForCode(code);
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
    .query(async ({ input }) => fetchHostCurrentQuestion(input.code)),

  onCurrentQuestionForHostChanged: hostProcedure
    .input(GetSessionInfoInputSchema)
    .subscription(async function* ({ input }) {
      const code = input.code.toUpperCase();
      let lastJson = '';
      while (true) {
        const payload = await fetchHostCurrentQuestion(code);
        const json = JSON.stringify(payload);
        if (json !== lastJson) {
          lastJson = json;
          yield payload;
        }
        const currentVersion = getSessionCurrentQuestionSignalVersion(code);
        await waitForSessionCurrentQuestionSignal(
          code,
          currentVersion,
          CURRENT_QUESTION_EVENT_WAIT_MS,
        );
      }
    }),

  /**
   * Aktuelle Frage für Studenten (Story 3.3a):
   * QUESTION_OPEN → QuestionPreviewDTO (nur Stamm), ACTIVE → QuestionStudentDTO (ohne isCorrect),
   * RESULTS → QuestionRevealedDTO (mit isCorrect + Votes), sonst null.
   */
  getCurrentQuestionForStudent: publicProcedure
    .input(GetCurrentQuestionForStudentInputSchema)
    .query(async ({ input }) => {
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
        include: {
          quiz: {
            select: {
              questions: {
                orderBy: { order: 'asc' },
                include: { answers: { select: { id: true, text: true, isCorrect: true } } },
              },
              defaultTimer: true,
              timerScaleByDifficulty: true,
              showQuestionTypeIndicators: true,
              preset: true,
            },
          },
          _count: { select: { participants: true } },
        },
      });
      if (!session?.quiz) return null;
      const quiz = session.quiz;
      const idx = session.currentQuestion;
      if (idx === null || idx === undefined) return null;
      const question = quiz.questions[idx];
      if (!question) return null;

      const participantId = input.participantId;
      let participantBelongsToSession = false;
      if (participantId) {
        participantBelongsToSession = await getParticipantBelongsToSessionCached(
          code,
          session.id,
          participantId,
        );
        if (participantBelongsToSession) {
          void touchParticipantPresence(session.id, participantId);
        }
      }

      const answersOrdered = orderAnswersByDisplayMap(
        question.answers,
        question.id,
        session.answerDisplayOrder,
      );

      const totalQuestions = quiz.questions.length;

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
          showQuestionTypeIndicators: quiz.showQuestionTypeIndicators ?? true,
          order: question.order,
          totalQuestions,
          ratingMin: question.ratingMin ?? null,
          ratingMax: question.ratingMax ?? null,
          ratingLabelMin: question.ratingLabelMin ?? null,
          ratingLabelMax: question.ratingLabelMax ?? null,
          ...getShortTextDtoFields(question.type, question),
          numericInputType: question.numericInputType ?? undefined,
          numericDecimalPlaces: question.numericDecimalPlaces ?? null,
          numericMin: question.numericMin ?? null,
          numericMax: question.numericMax ?? null,
          ...(participantReady !== undefined ? { participantReady } : {}),
        });
      }

      if (session.status === 'DISCUSSION') {
        return QuestionPreviewDTOSchema.parse({
          id: question.id,
          text: question.text,
          type: question.type,
          difficulty: question.difficulty,
          showQuestionTypeIndicators: quiz.showQuestionTypeIndicators ?? true,
          order: question.order,
          totalQuestions,
          ratingMin: question.ratingMin ?? null,
          ratingMax: question.ratingMax ?? null,
          ratingLabelMin: question.ratingLabelMin ?? null,
          ratingLabelMax: question.ratingLabelMax ?? null,
          ...getShortTextDtoFields(question.type, question),
          numericInputType: question.numericInputType ?? undefined,
          numericDecimalPlaces: question.numericDecimalPlaces ?? null,
          numericMin: question.numericMin ?? null,
          numericMax: question.numericMax ?? null,
        });
      }

      if (session.status === 'ACTIVE') {
        const totalVotes = await getVoteCountCached(
          code,
          session.id,
          question.id,
          session.currentRound,
        );
        return (await getOrComputeCached(
          currentQuestionCache,
          currentQuestionInFlight,
          `${code}:active:${session.currentQuestion}:${session.currentRound}`,
          CURRENT_QUESTION_CACHE_TTL_MS,
          async () =>
            QuestionStudentDTOSchema.parse({
              id: question.id,
              text: question.text,
              type: question.type,
              showQuestionTypeIndicators: quiz.showQuestionTypeIndicators ?? true,
              timer:
                session.currentRound === 2
                  ? null
                  : resolveEffectiveQuestionTimer(
                      question.timer,
                      quiz.defaultTimer,
                      question.difficulty,
                      quiz.timerScaleByDifficulty ?? true,
                    ),
              difficulty: question.difficulty,
              order: question.order,
              totalQuestions,
              answers:
                question.type === 'SHORT_TEXT'
                  ? []
                  : answersOrdered.map((a) => ({ id: a.id, text: a.text })),
              activeAt: session.statusChangedAt.toISOString(),
              ratingMin: question.ratingMin ?? null,
              ratingMax: question.ratingMax ?? null,
              ratingLabelMin: question.ratingLabelMin ?? null,
              ratingLabelMax: question.ratingLabelMax ?? null,
              ...getShortTextDtoFields(question.type, question),
              numericInputType: question.numericInputType ?? undefined,
              numericDecimalPlaces: question.numericDecimalPlaces ?? null,
              numericMin: question.numericMin ?? null,
              numericMax: question.numericMax ?? null,
              numericTwoRounds: question.numericTwoRounds ?? false,
              participantCount: session._count.participants,
              totalVotes,
              currentRound: session.currentRound,
            }),
        )) as z.infer<typeof QuestionStudentDTOSchema>;
      }

      if (session.status === 'RESULTS') {
        return (await getOrComputeCached(
          currentQuestionCache,
          currentQuestionInFlight,
          `${code}:results:${session.currentQuestion}:${session.currentRound}`,
          CURRENT_QUESTION_CACHE_TTL_MS,
          async () => {
            const voteSummary = await getVoteSummaryCached(
              code,
              session.id,
              question.id,
              session.currentRound,
              question.type as QuestionType,
              question.type === 'SHORT_TEXT'
                ? {
                    answers: answersOrdered,
                    ...resolveShortTextQuestionConfig(question),
                  }
                : undefined,
            );
            const toleranceModeStr = question.numericToleranceMode as string | null;
            const numericBand =
              toleranceModeStr &&
              (toleranceModeStr === 'ABSOLUTE_INTERVAL' || toleranceModeStr === 'RELATIVE_PERCENT')
                ? resolveNumericTolerance(toleranceModeStr as NumericEstimateToleranceMode, {
                    referenceValue: question.numericReferenceValue,
                    tolerancePercent: question.numericTolerancePercent,
                    intervalLeft: question.numericIntervalLeft,
                    intervalRight: question.numericIntervalRight,
                  })
                : null;
            const numericRefVal =
              toleranceModeStr === 'RELATIVE_PERCENT'
                ? (question.numericReferenceValue ?? null)
                : null;
            const numericStats =
              question.type === 'NUMERIC_ESTIMATE'
                ? buildNumericStats(voteSummary.numericValues, numericBand, numericRefVal)
                : undefined;
            const numericHistogram =
              question.type === 'NUMERIC_ESTIMATE'
                ? buildNumericHistogram(voteSummary.numericValues, numericBand)
                : undefined;

            return QuestionRevealedDTOSchema.parse({
              id: question.id,
              text: question.text,
              type: question.type,
              difficulty: question.difficulty,
              showQuestionTypeIndicators: quiz.showQuestionTypeIndicators ?? true,
              order: question.order,
              totalQuestions,
              answers: answersOrdered.map((a) => ({
                id: a.id,
                text: a.text,
                isCorrect: a.isCorrect,
                voteCount: voteSummary.answerVoteCounts[a.id] ?? 0,
                votePercentage:
                  voteSummary.totalVotes > 0
                    ? Math.round(
                        ((voteSummary.answerVoteCounts[a.id] ?? 0) / voteSummary.totalVotes) * 100,
                      )
                    : 0,
              })),
              freeTextResponses:
                voteSummary.freeTextResponses.length > 0
                  ? voteSummary.freeTextResponses
                  : undefined,
              ...getShortTextDtoFields(question.type, question),
              correctVoterCount:
                question.type === 'SHORT_TEXT' ? voteSummary.correctVoteCount : undefined,
              incorrectVoterCount:
                question.type === 'SHORT_TEXT' ? voteSummary.incorrectVoteCount : undefined,
              totalVotes: voteSummary.totalVotes,
              numericToleranceMode: question.numericToleranceMode ?? undefined,
              numericReferenceValue: question.numericReferenceValue ?? null,
              numericTolerancePercent: question.numericTolerancePercent ?? null,
              numericIntervalLeft: question.numericIntervalLeft ?? null,
              numericIntervalRight: question.numericIntervalRight ?? null,
              numericInputType: question.numericInputType ?? undefined,
              numericDecimalPlaces: question.numericDecimalPlaces ?? null,
              numericStats,
              numericHistogram,
            });
          },
        )) as z.infer<typeof QuestionRevealedDTOSchema>;
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
      const code = input.code.toUpperCase();
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
        where: { code },
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
        await awaitJoinAdmissionSlot(session.id);
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
      invalidateJoinCachesForCode(code);
      void updateMaxParticipantsSingleSession(newParticipantCount);
      void updateDailyMaxParticipants(newParticipantCount);
      void touchParticipantPresence(session.id, participantId);
      const serverTime = new Date().toISOString();
      const channels = buildSessionChannels(session);
      return {
        id: session.id,
        code: session.code,
        type: session.type,
        status: session.status,
        serverTime,
        quizName: session.quiz?.name ?? null,
        quizMotifImageUrl: session.quiz?.motifImageUrl ?? null,
        title: session.title ?? null,
        channels,
        preferredChannel: resolvePreferredLiveChannel(session.code, channels),
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
      const code = input.code.toUpperCase();
      const session = await prisma.session.findUnique({
        where: { code },
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
      invalidateSessionStatusCachesForCode(code);
      await incrementCompletedSessionsTotal();
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
          let shortTextIncorrectAggregates: FreetextAggregateEntry[] | undefined;
          let shortTextCorrectCount: number | undefined;
          let shortTextIncorrectCount: number | undefined;
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
            case 'SHORT_TEXT': {
              const rawAnswers = q.answers as Array<{
                id: string;
                text: string;
                isCorrect: boolean;
              }>;
              const orderedSolutions = orderAnswersByDisplayMap(
                rawAnswers,
                q.id,
                session.answerDisplayOrder,
              );
              const optionCounts = new Map<string, number>();
              for (const answer of orderedSolutions) {
                optionCounts.set(answer.id, 0);
              }

              const incorrectCounts = new Map<string, number>();
              shortTextCorrectCount = 0;
              shortTextIncorrectCount = 0;
              for (const v of votes as VoteForExport[]) {
                const displayValue = getShortTextDisplayValue(v.freeText ?? '', q);
                const matchedAnswerId = getShortTextMatchedAnswerId(v.freeText ?? '', {
                  ...q,
                  answers: orderedSolutions,
                });

                if (matchedAnswerId) {
                  optionCounts.set(matchedAnswerId, (optionCounts.get(matchedAnswerId) ?? 0) + 1);
                  shortTextCorrectCount += 1;
                } else {
                  shortTextIncorrectCount += 1;
                  if (displayValue) {
                    incorrectCounts.set(displayValue, (incorrectCounts.get(displayValue) ?? 0) + 1);
                  }
                }
              }

              optionDistribution = orderedSolutions.map((answer) => ({
                text: answer.text,
                count: optionCounts.get(answer.id) ?? 0,
                percentage:
                  participantCount > 0
                    ? Math.round(((optionCounts.get(answer.id) ?? 0) / participantCount) * 1000) /
                      10
                    : 0,
                isCorrect: answer.isCorrect,
              }));
              shortTextIncorrectAggregates = Array.from(
                incorrectCounts.entries(),
                ([text, count]) => ({ text, count }),
              );
              freetextAggregates = undefined;
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
            shortTextSolutions:
              q.type === 'SHORT_TEXT'
                ? q.answers.filter((answer) => answer.isCorrect).map((answer) => answer.text)
                : undefined,
            shortTextIncorrectAggregates:
              q.type === 'SHORT_TEXT' ? shortTextIncorrectAggregates : undefined,
            correctCount: q.type === 'SHORT_TEXT' ? shortTextCorrectCount : undefined,
            incorrectCount: q.type === 'SHORT_TEXT' ? shortTextIncorrectCount : undefined,
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
