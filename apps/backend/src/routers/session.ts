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
  NextQuestionInputSchema,
  GetLiveFreetextInputSchema,
  GetActiveQuizIdsInputSchema,
  JoinSessionInputSchema,
  JoinSessionOutputSchema,
  GetExportDataInputSchema,
  GetSessionExportPdfInputSchema,
  ActiveQuizLiveStatesDTOSchema,
  FreetextSessionExportDTOSchema,
  LiveFreetextDTOSchema,
  SessionInfoDTOSchema,
  SessionExportDTOSchema,
  SessionExportPdfOutputSchema,
  ParticipantDTOSchema,
  SessionParticipantsPayloadSchema,
  SessionParticipantNicknamesPayloadSchema,
  SessionChannelsDTOSchema,
  SessionLiveChannelSchema,
  SessionTeamsPayloadSchema,
  SessionStatusUpdateSchema,
  HostCurrentQuestionDTOSchema,
  HostVoteProgressDTOSchema,
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
  GetLastSessionAnalysisForQuizInputSchema,
  LastSessionAnalysisForQuizOutputSchema,
  GetLastSessionExportDataForQuizInputSchema,
  GetLastSessionExportPdfForQuizInputSchema,
  SubmitSessionFeedbackInputSchema,
  SessionFeedbackSummarySchema,
  GetSessionConfidenceSummaryOutputSchema,
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
  type HostCurrentQuestionDTO,
  type HostVoteProgressDTO,
  type TeamLeaderboardEntryDTO,
  type TeamAssignment,
  type ToleranceLevel,
  type RoundComparisonDTO,
  type NumericInputKind,
  type NumericToleranceMode,
  type NumericUnitFamily,
  type ShortTextEvaluationKind,
  type ShortAnswerEvaluationMode,
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
  isNumericToleranceMode,
  resolveNumericEstimateToleranceMode,
  buildConfidenceResult,
  buildSessionConfidenceSummary,
  questionSupportsConfidence,
  resolveEffectiveAggregationRound,
  buildRoundComparisonFromVotes,
  buildResponseTimeAggregate,
  buildTeamLearningProfiles,
  computeCorrectPercentage,
  type ConfidenceEligibleQuestionType,
  type SessionConfidenceSummary,
  type NumericStatsDTO,
  type NumericHistogramBin,
  type NumericRoundComparisonDTO,
  type Difficulty,
  type TeamLearningProfileEntry,
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
  removeParticipantPresence,
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
import { loadConfidenceResultForQuestion } from '../lib/confidenceAggregation';
import {
  buildSessionResultsPdf,
  buildSessionResultsPdfFilename,
} from '../lib/session-results-report-pdf';
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
const VOTE_PROGRESS_SIGNAL_DEBOUNCE_MS = 150;
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
const sessionVoteProgressEvents = new EventEmitter();
const sessionVoteProgressVersions = new Map<string, number>();
const sessionVoteProgressTimers = new Map<string, ReturnType<typeof setTimeout>>();
sessionStatusEvents.setMaxListeners(0);
sessionParticipantEvents.setMaxListeners(0);
sessionCurrentQuestionEvents.setMaxListeners(0);
sessionVoteProgressEvents.setMaxListeners(0);

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
    for (const timer of sessionVoteProgressTimers.values()) {
      clearTimeout(timer);
    }
    sessionVoteProgressTimers.clear();
    return;
  }
  sessionInfoCache.delete(code);
  statusSnapshotCache.delete(code);
  participantsSnapshotCache.delete(code);
  clearCurrentQuestionCache(code);
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
  const voteProgressTimer = sessionVoteProgressTimers.get(code);
  if (voteProgressTimer) {
    clearTimeout(voteProgressTimer);
    sessionVoteProgressTimers.delete(code);
  }
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
  sessionVoteProgressVersions.clear();
  sessionStatusEvents.removeAllListeners();
  sessionParticipantEvents.removeAllListeners();
  sessionCurrentQuestionEvents.removeAllListeners();
  sessionVoteProgressEvents.removeAllListeners();
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
  for (const key of currentQuestionCache.keys()) {
    if (key.startsWith(`${code}:`)) {
      currentQuestionCache.delete(key);
    }
  }
  for (const key of currentQuestionInFlight.keys()) {
    if (key.startsWith(`${code}:`)) {
      currentQuestionInFlight.delete(key);
    }
  }
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

function sessionVoteProgressEventName(code: string): string {
  return `vote-progress:${code}`;
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

function emitSessionVoteProgressSignalNow(normalizedCode: string): void {
  const nextVersion = (sessionVoteProgressVersions.get(normalizedCode) ?? 0) + 1;
  sessionVoteProgressVersions.set(normalizedCode, nextVersion);
  sessionVoteProgressEvents.emit(sessionVoteProgressEventName(normalizedCode), nextVersion);
}

function emitSessionVoteProgressSignal(code: string, options: { immediate?: boolean } = {}): void {
  const normalizedCode = code.toUpperCase();
  const pendingTimer = sessionVoteProgressTimers.get(normalizedCode);
  if (options.immediate) {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      sessionVoteProgressTimers.delete(normalizedCode);
    }
    emitSessionVoteProgressSignalNow(normalizedCode);
    return;
  }
  if (pendingTimer) {
    return;
  }
  const timer = setTimeout(() => {
    sessionVoteProgressTimers.delete(normalizedCode);
    emitSessionVoteProgressSignalNow(normalizedCode);
  }, VOTE_PROGRESS_SIGNAL_DEBOUNCE_MS);
  timer.unref?.();
  sessionVoteProgressTimers.set(normalizedCode, timer);
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

function getSessionVoteProgressSignalVersion(code: string): number {
  return sessionVoteProgressVersions.get(code.toUpperCase()) ?? 0;
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

async function waitForSessionVoteProgressSignal(
  code: string,
  currentVersion: number,
  timeoutMs: number,
): Promise<void> {
  const normalizedCode = code.toUpperCase();
  if (getSessionVoteProgressSignalVersion(normalizedCode) !== currentVersion) {
    return;
  }
  await new Promise<void>((resolve) => {
    const eventName = sessionVoteProgressEventName(normalizedCode);
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      sessionVoteProgressEvents.off(eventName, onSignal);
      timer = null;
      resolve();
    }, timeoutMs);

    const onSignal = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      sessionVoteProgressEvents.off(eventName, onSignal);
      resolve();
    };

    sessionVoteProgressEvents.on(eventName, onSignal);
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
          activeQuestionStartedAt: true,
          quiz: {
            select: {
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
      const visibleCurrentQuestion = session.status === 'LOBBY' ? null : session.currentQuestion;
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
        currentQuestion: visibleCurrentQuestion,
        currentRound: session.currentRound,
        channels,
        preferredChannel: resolvePreferredLiveChannel(code, channels),
        ...(isActive && {
          activeAt: (session.activeQuestionStartedAt ?? session.statusChangedAt).toISOString(),
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
  emitSessionVoteProgressSignal(normalizedCode, { immediate: true });
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

export function invalidateHostVoteProgressForCode(code: string): void {
  const normalizedCode = code.toUpperCase();
  clearCurrentQuestionCache(normalizedCode);
  emitSessionVoteProgressSignal(normalizedCode);
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
    numericToleranceMode: isNumericToleranceMode(config?.numericToleranceMode)
      ? config.numericToleranceMode
      : null,
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

function getConfidenceDtoFields(question: {
  confidenceEnabled?: boolean | null;
  confidenceLabelLow?: string | null;
  confidenceLabelHigh?: string | null;
}): {
  confidenceEnabled?: boolean;
  confidenceLabelLow?: string | null;
  confidenceLabelHigh?: string | null;
} {
  if (!question.confidenceEnabled) {
    return {};
  }

  return {
    confidenceEnabled: true,
    confidenceLabelLow: question.confidenceLabelLow ?? null,
    confidenceLabelHigh: question.confidenceLabelHigh ?? null,
  };
}

async function withHostConfidenceResult<T>(
  sessionStatus: string,
  sessionId: string,
  question: {
    id: string;
    confidenceEnabled?: boolean | null;
  },
  currentRound: number,
  answersOrdered: Array<{ id: string; text: string; isCorrect: boolean }>,
  dto: T,
): Promise<T> {
  if (sessionStatus !== 'RESULTS' || !question.confidenceEnabled) {
    return dto;
  }

  const confidenceResult = await loadConfidenceResultForQuestion({
    sessionId,
    questionId: question.id,
    round: currentRound,
    answerOptions: answersOrdered,
  });

  if (!confidenceResult) {
    return dto;
  }

  return { ...dto, confidenceResult };
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
      const correctAnswerIds =
        questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE'
          ? (options?.answers ?? []).filter((answer) => answer.isCorrect).map((answer) => answer.id)
          : [];
      let correctVoteCount = 0;
      let incorrectVoteCount = 0;
      for (const vote of votes) {
        const selectedAnswerIds = vote.selectedAnswers.map(
          (selectedAnswer) => selectedAnswer.answerOptionId,
        );
        for (const selectedAnswer of vote.selectedAnswers) {
          answerVoteCounts[selectedAnswer.answerOptionId] =
            (answerVoteCounts[selectedAnswer.answerOptionId] ?? 0) + 1;
        }
        if (correctAnswerIds.length > 0) {
          if (isExactCorrectSelection(selectedAnswerIds, correctAnswerIds)) {
            correctVoteCount += 1;
          } else {
            incorrectVoteCount += 1;
          }
        }
      }
      return {
        totalVotes: votes.length,
        answerVoteCounts,
        freeTextResponses: [],
        incorrectFreeTextResponses: [],
        correctVoteCount,
        incorrectVoteCount,
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
    if (
      (payload.questionType === 'SINGLE_CHOICE' || payload.questionType === 'MULTIPLE_CHOICE') &&
      payload.isCorrect !== undefined
    ) {
      if (payload.isCorrect) {
        nextSummary.correctVoteCount += 1;
      } else {
        nextSummary.incorrectVoteCount += 1;
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

type CompetitionVote = {
  participantId: string;
  questionId: string;
  round: number;
  score: number;
  responseTimeMs: number | null;
};

// Für die Wettbewerbswertung ersetzt Runde 2 die Runde 1 der jeweiligen Frage; Runde-2-Zeiten sind kein Tiebreaker.
function selectEffectiveCompetitionVotes<T extends CompetitionVote>(votes: readonly T[]): T[] {
  const round2QuestionIds = new Set(
    votes.filter((vote) => vote.round === 2).map((vote) => vote.questionId),
  );
  const effectiveVotes = new Map<string, T>();
  for (const vote of votes) {
    const usesRound2 = round2QuestionIds.has(vote.questionId);
    if (usesRound2 ? vote.round !== 2 : vote.round !== 1) {
      continue;
    }
    effectiveVotes.set(`${vote.participantId}:${vote.questionId}`, vote);
  }
  return [...effectiveVotes.values()];
}

function getCompetitionResponseTimeMs(vote: CompetitionVote): number {
  if (vote.score <= 0 || vote.round === 2) {
    return 0;
  }
  return vote.responseTimeMs ?? 0;
}

/** Typen für getExportData-Callbacks (vermeidet implizites any). */
interface QuestionWithAnswersForExport {
  id: string;
  order: number;
  text: string;
  type: string;
  difficulty: Difficulty;
  timer: number | null;
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
  numericReferenceValue: number | null;
  numericTolerancePercent: number | null;
  numericIntervalLeft: number | null;
  numericIntervalRight: number | null;
  numericInputType: string | null;
  numericDecimalPlaces: number | null;
  confidenceEnabled: boolean;
  answers: Array<{ id: string; text: string; isCorrect: boolean }>;
}
interface VoteForExport {
  participantId: string;
  round: number;
  selectedAnswers: Array<{ answerOptionId: string }>;
  freeText?: string | null;
  ratingValue?: number | null;
  numericValue?: number | null;
  score?: number | null;
  confidenceValue?: number | null;
  isCorrect?: boolean | null;
  responseTimeMs?: number | null;
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

function buildConfidenceSummaryForSession(
  questions: Array<{
    id: string;
    order: number;
    text: string;
    type: string;
    confidenceEnabled: boolean;
    answers: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>,
  votes: Array<{
    questionId: string;
    round: number | null;
    confidenceValue: number | null;
    isCorrect: boolean | null;
    selectedAnswers: Array<{ answerOptionId: string }>;
  }>,
): SessionConfidenceSummary | null {
  return buildSessionConfidenceSummary({
    questions: questions.flatMap((question) => {
      if (!question.confidenceEnabled || !questionSupportsConfidence(question.type)) {
        return [];
      }
      const allVotes = votes.filter((vote) => vote.questionId === question.id);
      const { effectiveRound } = resolveEffectiveAggregationRound(allVotes);
      const effectiveVotes = allVotes.filter((vote) => (vote.round ?? 1) === effectiveRound);
      const result = buildConfidenceResult({
        votes: effectiveVotes.map((vote) => ({
          confidenceValue: vote.confidenceValue,
          isCorrect: vote.isCorrect,
          selectedAnswerIds: vote.selectedAnswers.map((selected) => selected.answerOptionId),
        })),
        answerOptions: question.answers,
      });
      return [
        {
          questionOrder: question.order,
          questionTextShort: question.text,
          questionType: question.type as ConfidenceEligibleQuestionType,
          result,
        },
      ];
    }),
  });
}

async function loadSessionConfidenceSummaryByCode(
  code: string,
): Promise<SessionConfidenceSummary | null> {
  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
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
    },
  });
  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  }
  if (session.status !== 'FINISHED' || session.type !== 'QUIZ' || !session.quiz) {
    return null;
  }
  return buildConfidenceSummaryForSession(session.quiz.questions, session.votes);
}

function buildMcScOptionDistribution(
  votes: VoteForExport[],
  orderedOpts: Array<{ id: string; text: string; isCorrect: boolean }>,
): OptionDistributionEntry[] {
  const optionCounts = new Map<string, { count: number; isCorrect?: boolean }>();
  for (const opt of orderedOpts) {
    optionCounts.set(opt.id, { count: 0, isCorrect: opt.isCorrect });
  }
  for (const v of votes) {
    for (const sa of v.selectedAnswers) {
      const cur = optionCounts.get(sa.answerOptionId);
      if (cur) {
        cur.count += 1;
      }
    }
  }
  const total = votes.length || 1;
  return orderedOpts.map((opt) => {
    const { count, isCorrect } = optionCounts.get(opt.id) ?? { count: 0 };
    return {
      text: opt.text,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
      isCorrect,
    };
  });
}

async function loadFinishedQuizSessionExportData(code: string): Promise<SessionExportDTO> {
  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
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
      sessionFeedbacks: {
        select: {
          overallRating: true,
          questionQualityRating: true,
          wouldRepeat: true,
        },
      },
      participants: {
        select: { id: true, teamId: true, team: { select: { name: true } } },
      },
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
  const quizDefaultTimer = session.quiz.defaultTimer ?? null;
  const quizTimerScaleByDifficulty = session.quiz.timerScaleByDifficulty ?? true;
  const votesByQuestion = new Map<string, typeof session.votes>();
  for (const vote of session.votes) {
    const list = votesByQuestion.get(vote.questionId) ?? [];
    list.push(vote);
    votesByQuestion.set(vote.questionId, list);
  }

  const questionEntries: QuestionExportEntry[] = questions.map(
    (q: QuestionWithAnswersForExport) => {
      const allVotes: VoteForExport[] = votesByQuestion.get(q.id) ?? [];
      const {
        effectiveRound: exportRound,
        round1Count,
        round2Count,
      } = resolveEffectiveAggregationRound(allVotes);
      const votes = allVotes.filter((vote) => (vote.round ?? 1) === exportRound);
      const participantCount = votes.length;
      const aggregationRound = allVotes.length > 0 ? exportRound : undefined;
      const round1ParticipantCount = round2Count > 0 ? round1Count : undefined;
      const round2ParticipantCount = round2Count > 0 ? round2Count : undefined;
      const difficulty = (q.difficulty ?? 'MEDIUM') as Difficulty;
      const effectiveTimerSeconds = resolveEffectiveQuestionTimer(
        q.timer,
        quizDefaultTimer,
        difficulty,
        quizTimerScaleByDifficulty,
      );
      // Bei Peer Instruction hat Runde 2 keinen Timer — Antwortzeiten nur aus Runde 1.
      const responseTimeVotes =
        round2Count > 0 ? allVotes.filter((vote) => (vote.round ?? 1) === 1) : votes;
      const responseTimeAggregate = buildResponseTimeAggregate(
        responseTimeVotes.map((vote) => vote.responseTimeMs),
        effectiveTimerSeconds,
      );
      const responseTimeRound = responseTimeAggregate
        ? round2Count > 0
          ? (1 as const)
          : undefined
        : undefined;

      let optionDistribution: OptionDistributionEntry[] | undefined;
      let round1OptionDistribution: OptionDistributionEntry[] | undefined;
      let roundComparison: RoundComparisonDTO | undefined;
      let freetextAggregates: FreetextAggregateEntry[] | undefined;
      let shortTextIncorrectAggregates: FreetextAggregateEntry[] | undefined;
      let shortTextCorrectCount = 0;
      let shortTextIncorrectCount = 0;
      let ratingDistribution: Record<string, number> | undefined;
      let ratingAverage: number | undefined;
      let ratingStandardDeviation: number | undefined;
      let numericStats: NumericStatsDTO | undefined;
      let numericHistogram: NumericHistogramBin[] | undefined;
      let numericRoundComparison: NumericRoundComparisonDTO | undefined;
      let averageScore: number | undefined;
      let confidenceResult: QuestionExportEntry['confidenceResult'];

      switch (q.type) {
        case 'MULTIPLE_CHOICE':
        case 'SINGLE_CHOICE':
        case 'SURVEY': {
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
          optionDistribution = buildMcScOptionDistribution(votes, orderedOpts);
          if (round2Count > 0) {
            const round1Votes = allVotes.filter((vote) => (vote.round ?? 1) === 1);
            const round2Votes = allVotes.filter((vote) => (vote.round ?? 1) === 2);
            round1OptionDistribution = buildMcScOptionDistribution(round1Votes, orderedOpts);
            if (q.type === 'MULTIPLE_CHOICE' || q.type === 'SINGLE_CHOICE') {
              roundComparison = buildRoundComparisonFromVotes(
                orderedOpts,
                round1Votes,
                round2Votes,
              );
            }
          }
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
                ? Math.round(((optionCounts.get(answer.id) ?? 0) / participantCount) * 1000) / 10
                : 0,
            isCorrect: answer.isCorrect,
          }));
          shortTextIncorrectAggregates = Array.from(incorrectCounts.entries(), ([text, count]) => ({
            text,
            count,
          })).sort(
            (left, right) => right.count - left.count || left.text.localeCompare(right.text, 'de'),
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
            ratingStandardDeviation = Math.round(Math.sqrt(variance / votes.length) * 100) / 100;
          }
          break;
        }
        case 'NUMERIC_ESTIMATE': {
          const toleranceMode = resolveNumericEstimateToleranceMode(q.numericToleranceMode);
          const band = resolveNumericTolerance(toleranceMode, {
            referenceValue: q.numericReferenceValue,
            tolerancePercent: q.numericTolerancePercent,
            intervalLeft: q.numericIntervalLeft,
            intervalRight: q.numericIntervalRight,
          });
          const referenceValue = resolveNumericReferenceValueForStats(
            toleranceMode,
            q.numericReferenceValue,
            band,
          );
          const round2Values = allVotes
            .filter((vote) => (vote.round ?? 1) === 2)
            .map((vote) => vote.numericValue)
            .filter((value): value is number => value !== null && value !== undefined);
          const round1Values = allVotes
            .filter((vote) => (vote.round ?? 1) === 1)
            .map((vote) => vote.numericValue)
            .filter((value): value is number => value !== null && value !== undefined);
          const effectiveValues = round2Values.length > 0 ? round2Values : round1Values;
          numericStats = buildNumericStats(effectiveValues, band, referenceValue);
          numericHistogram = buildNumericHistogram(effectiveValues, band);
          if (round2Values.length > 0 || round1Values.length > 0) {
            numericRoundComparison = buildNumericRoundComparisonFromVotes(
              allVotes,
              band,
              referenceValue,
            );
          }
          break;
        }
        default:
          break;
      }

      if (votes.length > 0 && votes.some((v: VoteForExport) => (v.score ?? 0) > 0)) {
        const totalScore = votes.reduce((a: number, v: VoteForExport) => a + (v.score ?? 0), 0);
        averageScore = Math.round((totalScore / votes.length) * 100) / 100;
      }

      if (q.confidenceEnabled) {
        confidenceResult =
          buildConfidenceResult({
            votes: votes.map((vote) => ({
              confidenceValue: vote.confidenceValue,
              isCorrect: vote.isCorrect,
              selectedAnswerIds: vote.selectedAnswers.map((selected) => selected.answerOptionId),
            })),
            answerOptions: (
              q.answers as Array<{
                id: string;
                text: string;
                isCorrect: boolean;
              }>
            ).map((answer) => ({
              id: answer.id,
              text: answer.text,
              isCorrect: answer.isCorrect,
            })),
          }) ?? undefined;
      }

      const includesCorrectnessSummary = questionSupportsConfidence(q.type);
      const correctCount =
        q.type === 'SHORT_TEXT'
          ? shortTextCorrectCount
          : includesCorrectnessSummary
            ? votes.filter((vote) => vote.isCorrect === true).length
            : undefined;
      const incorrectCount =
        q.type === 'SHORT_TEXT'
          ? shortTextIncorrectCount
          : includesCorrectnessSummary
            ? votes.filter((vote) => vote.isCorrect === false).length
            : undefined;
      const correctPercentage = computeCorrectPercentage(correctCount, incorrectCount);

      return {
        questionOrder: q.order,
        questionTextShort: q.text.slice(0, QUESTION_TEXT_SHORT_MAX),
        questionTextFull: q.text,
        type: q.type as QuestionType,
        difficulty,
        participantCount,
        optionDistribution,
        freetextAggregates,
        shortTextSolutions:
          q.type === 'SHORT_TEXT'
            ? q.answers.filter((answer) => answer.isCorrect).map((answer) => answer.text)
            : undefined,
        shortTextIncorrectAggregates:
          q.type === 'SHORT_TEXT' ? shortTextIncorrectAggregates : undefined,
        correctCount,
        incorrectCount,
        correctPercentage: correctPercentage ?? undefined,
        ratingDistribution,
        ratingAverage,
        ratingStandardDeviation,
        numericStats,
        numericHistogram,
        numericRoundComparison,
        numericReferenceValue:
          q.type === 'NUMERIC_ESTIMATE' ? (q.numericReferenceValue ?? null) : undefined,
        numericTolerancePercent:
          q.type === 'NUMERIC_ESTIMATE' ? (q.numericTolerancePercent ?? null) : undefined,
        numericIntervalLeft:
          q.type === 'NUMERIC_ESTIMATE' ? (q.numericIntervalLeft ?? null) : undefined,
        numericIntervalRight:
          q.type === 'NUMERIC_ESTIMATE' ? (q.numericIntervalRight ?? null) : undefined,
        numericToleranceMode:
          q.type === 'NUMERIC_ESTIMATE' ? (q.numericToleranceMode ?? null) : undefined,
        numericInputType:
          q.type === 'NUMERIC_ESTIMATE'
            ? ((q.numericInputType as 'INTEGER' | 'DECIMAL' | null) ?? null)
            : undefined,
        numericDecimalPlaces:
          q.type === 'NUMERIC_ESTIMATE' ? (q.numericDecimalPlaces ?? null) : undefined,
        confidenceEnabled: q.confidenceEnabled,
        confidenceResult,
        aggregationRound,
        round1ParticipantCount,
        round2ParticipantCount,
        round1OptionDistribution,
        roundComparison,
        averageScore,
        effectiveTimerSeconds: responseTimeAggregate?.effectiveTimerSeconds,
        medianResponseTimeMs: responseTimeAggregate?.medianResponseTimeMs,
        q1ResponseTimeMs: responseTimeAggregate?.q1ResponseTimeMs,
        q3ResponseTimeMs: responseTimeAggregate?.q3ResponseTimeMs,
        nearDeadlineCount: responseTimeAggregate?.nearDeadlineCount,
        responseTimeRound,
      };
    },
  );
  const confidenceSummary = buildConfidenceSummaryForSession(questions, session.votes);
  const feedbackRows = buildSessionFeedbackSummaryFromRows(session.sessionFeedbacks ?? []);
  const feedbackSummary = feedbackRows.totalResponses > 0 ? feedbackRows : undefined;

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

  let teamLearningProfiles: TeamLearningProfileEntry[] | undefined;
  if (session.quiz.teamMode === true) {
    const teamsById = new Map<
      string,
      { teamName: string; memberCount: number; memberIds: Set<string> }
    >();
    for (const participant of session.participants) {
      if (!participant.teamId || !participant.team?.name) continue;
      const existing = teamsById.get(participant.teamId);
      if (existing) {
        existing.memberCount += 1;
        existing.memberIds.add(participant.id);
      } else {
        teamsById.set(participant.teamId, {
          teamName: participant.team.name,
          memberCount: 1,
          memberIds: new Set([participant.id]),
        });
      }
    }
    const profiles = buildTeamLearningProfiles({
      teams: [...teamsById.values()],
      questions: questions.map((question: QuestionWithAnswersForExport) => {
        const allVotes = votesByQuestion.get(question.id) ?? [];
        const { effectiveRound } = resolveEffectiveAggregationRound(allVotes);
        const votes = allVotes.filter((vote) => (vote.round ?? 1) === effectiveRound);
        return {
          questionOrder: question.order,
          type: question.type as QuestionType,
          votes: votes.map((vote) => ({
            participantId: vote.participantId,
            isCorrect: vote.isCorrect,
          })),
        };
      }),
    });
    teamLearningProfiles = profiles.length > 0 ? profiles : undefined;
  }

  const qaRows = await prisma.qaQuestion.findMany({
    where: {
      sessionId: session.id,
      status: { in: ['ACTIVE', 'PINNED', 'ARCHIVED'] },
    },
    orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'asc' }],
    select: {
      text: true,
      status: true,
      upvoteCount: true,
    },
  });
  const qaQuestions =
    qaRows.length > 0
      ? qaRows.map((row, index) => ({
          order: index + 1,
          text: row.text,
          status: row.status,
          upvoteCount: row.upvoteCount,
        }))
      : undefined;

  const result: SessionExportDTO = {
    sessionId: session.id,
    sessionCode: session.code,
    quizName,
    finishedAt: session.endedAt?.toISOString() ?? new Date().toISOString(),
    participantCount: session.participants.length,
    teamMode: session.quiz.teamMode === true,
    questions: questionEntries,
    confidenceSummary: confidenceSummary ?? undefined,
    feedbackSummary,
    teamLeaderboard: teamLeaderboard && teamLeaderboard.length > 0 ? teamLeaderboard : undefined,
    teamLearningProfiles,
    bonusTokens,
    qaQuestions,
  };

  return result;
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
      shortTextEvaluationKind: true,
      shortTextMaxLength: true,
      shortTextCaseSensitive: true,
      shortTextEvaluationMode: true,
      shortTextToleranceLevel: true,
      shortTextAllowPartialCredit: true,
      shortTextTrimWhitespace: true,
      shortTextNormalizeWhitespace: true,
      numericInputKind: true,
      ratingMin: true,
      ratingMax: true,
      ratingLabelMin: true,
      ratingLabelMax: true,
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
    questions: quiz.questions.map((question) => {
      const shortTextConfig = resolveShortTextQuestionConfig(question);
      return {
        text: question.text,
        type: question.type,
        timer: question.timer,
        difficulty: question.difficulty,
        order: question.order,
        skipReadingPhase: question.skipReadingPhase,
        ratingMin: question.ratingMin ?? undefined,
        ratingMax: question.ratingMax ?? undefined,
        ratingLabelMin: question.ratingLabelMin ?? undefined,
        ratingLabelMax: question.ratingLabelMax ?? undefined,
        ...(question.type === 'SHORT_TEXT'
          ? {
              shortTextEvaluationKind: shortTextConfig.shortTextEvaluationKind,
              shortTextMaxLength: resolveShortTextMaxLength(shortTextConfig.shortTextMaxLength),
              shortTextCaseSensitive: shortTextConfig.shortTextCaseSensitive,
              shortTextEvaluationMode: shortTextConfig.shortTextEvaluationMode,
              shortTextToleranceLevel: shortTextConfig.shortTextToleranceLevel,
              shortTextAllowPartialCredit: shortTextConfig.shortTextAllowPartialCredit,
              shortTextTrimWhitespace: shortTextConfig.shortTextTrimWhitespace,
              shortTextNormalizeWhitespace: shortTextConfig.shortTextNormalizeWhitespace,
              numericInputKind: shortTextConfig.numericInputKind,
              numericToleranceMode: shortTextConfig.numericToleranceMode,
              numericAbsoluteTolerance: shortTextConfig.numericAbsoluteTolerance ?? undefined,
              numericRelativeTolerancePercent:
                shortTextConfig.numericRelativeTolerancePercent ?? undefined,
              numericUnitFamily: shortTextConfig.numericUnitFamily,
              numericRequireUnit: shortTextConfig.numericRequireUnit,
              numericAcceptEquivalentUnits: shortTextConfig.numericAcceptEquivalentUnits,
            }
          : {}),
        ...(question.type === 'NUMERIC_ESTIMATE'
          ? {
              numericToleranceMode: resolveNumericEstimateToleranceMode(
                question.numericToleranceMode,
              ),
              numericReferenceValue: question.numericReferenceValue ?? undefined,
              numericTolerancePercent: question.numericTolerancePercent ?? undefined,
              numericIntervalLeft: question.numericIntervalLeft ?? undefined,
              numericIntervalRight: question.numericIntervalRight ?? undefined,
              numericInputType:
                (question.numericInputType as 'INTEGER' | 'DECIMAL' | null) ?? undefined,
              numericDecimalPlaces: question.numericDecimalPlaces ?? undefined,
              numericMin: question.numericMin ?? undefined,
              numericMax: question.numericMax ?? undefined,
              numericTwoRounds: question.numericTwoRounds ?? undefined,
            }
          : {}),
        answers: question.answers.map((answer) => ({
          text: answer.text,
          isCorrect: answer.isCorrect,
        })),
      };
    }),
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

async function resolveLastFinishedSessionCodeForQuiz(
  quizId: string,
  accessProof: string,
): Promise<string> {
  const scopedQuizIds = await resolveQuizHistoryScopeIds(quizId, accessProof);
  const session = await prisma.session.findFirst({
    where: {
      quizId: { in: scopedQuizIds },
      status: 'FINISHED',
    },
    orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }],
    select: { code: true },
  });
  if (!session) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Keine abgeschlossene Session für dieses Quiz gefunden.',
    });
  }
  return session.code;
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
  const votes = selectEffectiveCompetitionVotes(
    await prisma.vote.findMany({
      where: { sessionId, round: { in: [1, 2] } },
      select: {
        participantId: true,
        questionId: true,
        round: true,
        score: true,
        responseTimeMs: true,
      },
    }),
  );

  const teamStats = new Map<
    string,
    {
      teamName: string;
      teamColor: string | null;
      rawTotalScore: number;
      totalResponseTimeMs: number;
      memberCount: number;
    }
  >();
  for (const team of teams) {
    teamStats.set(team.id, {
      teamName: team.name,
      teamColor: team.color ?? null,
      rawTotalScore: 0,
      totalResponseTimeMs: 0,
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
    const score = Number(vote.score) || 0;
    stats.rawTotalScore += score;
    stats.totalResponseTimeMs += getCompetitionResponseTimeMs(vote);
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
        totalResponseTimeMs: team.totalResponseTimeMs,
        memberCount: team.memberCount,
        averageScore: normalizedScore,
      };
    })
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        a.totalResponseTimeMs - b.totalResponseTimeMs ||
        a.teamName.localeCompare(b.teamName),
    )
    .map((team, index) => ({
      rank: index + 1,
      teamName: team.teamName,
      teamColor: team.teamColor,
      totalScore: team.totalScore,
      memberCount: team.memberCount,
      averageScore: team.averageScore,
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

function questionSupportsSecondRound(
  question: { type: string; numericTwoRounds?: boolean | null } | null | undefined,
): boolean {
  if (!question) return false;
  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') return true;
  return question.type === 'NUMERIC_ESTIMATE' && question.numericTwoRounds === true;
}

async function buildRoundComparison(
  sessionId: string,
  questionId: string,
  answers: Array<{ id: string; text: string; isCorrect: boolean }>,
): Promise<RoundComparisonDTO> {
  const [round1Votes, round2Votes] = await Promise.all([
    prisma.vote.findMany({
      where: { sessionId, questionId, round: 1 },
      include: { selectedAnswers: true },
    }),
    prisma.vote.findMany({
      where: { sessionId, questionId, round: 2 },
      include: { selectedAnswers: true },
    }),
  ]);
  return buildRoundComparisonFromVotes(
    answers,
    round1Votes.map((vote) => ({
      participantId: vote.participantId,
      selectedAnswers: vote.selectedAnswers.map((selected) => ({
        answerOptionId: selected.answerOptionId,
      })),
    })),
    round2Votes.map((vote) => ({
      participantId: vote.participantId,
      selectedAnswers: vote.selectedAnswers.map((selected) => ({
        answerOptionId: selected.answerOptionId,
      })),
    })),
  );
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

  const votes = selectEffectiveCompetitionVotes(
    await prisma.vote.findMany({
      where: { sessionId: session.id, round: { in: [1, 2] } },
      select: {
        participantId: true,
        questionId: true,
        round: true,
        score: true,
        responseTimeMs: true,
      },
    }),
  );

  const stats = new Map<string, { totalScore: number; totalResponseTimeMs: number }>();
  for (const p of session.participants) {
    stats.set(p.id, { totalScore: 0, totalResponseTimeMs: 0 });
  }
  for (const v of votes) {
    const s = stats.get(v.participantId);
    if (!s) continue;
    s.totalScore += v.score;
    s.totalResponseTimeMs += getCompetitionResponseTimeMs(v);
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
      confidenceEnabled: boolean;
      confidenceLabelLow: string | null;
      confidenceLabelHigh: string | null;
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

function resolveNumericReferenceValueForStats(
  toleranceMode: 'ABSOLUTE_INTERVAL' | 'RELATIVE_PERCENT',
  referenceValue: number | null | undefined,
  band: { left: number; right: number } | null,
): number | null {
  if (referenceValue === null || referenceValue === undefined || !Number.isFinite(referenceValue)) {
    return null;
  }
  if (toleranceMode === 'RELATIVE_PERCENT') {
    return referenceValue;
  }
  return band !== null && isNumericValueInBand(referenceValue, band) ? referenceValue : null;
}

function buildNumericHistogram(
  values: number[],
  band: { left: number; right: number } | null,
  targetBins = 10,
): NumericHistogramBin[] {
  if (values.length === 0) return [];
  const valueMin = Math.min(...values);
  const valueMax = Math.max(...values);
  let min = band ? Math.min(valueMin, band.left) : valueMin;
  let max = band ? Math.max(valueMax, band.right) : valueMax;
  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.05, 0.5);
    min -= padding;
    max += padding;
  } else {
    const padding = Math.max((max - min) * 0.08, 0.5);
    min -= padding;
    max += padding;
  }
  const niceRange = resolveNiceNumericRange(min, max, targetBins);
  min = niceRange.min;
  max = niceRange.max;
  const binWidth = (max - min) / targetBins;
  const edges = Array.from({ length: targetBins + 1 }, (_, index) => min + index * binWidth);
  if (band) {
    const usedIndexes = new Set<number>();
    for (const boundary of [band.left, band.right]) {
      if (boundary <= min || boundary >= max) continue;
      const candidates = edges
        .map((edge, index) => ({ edge, index }))
        .filter(({ index }) => index > 0 && index < targetBins && !usedIndexes.has(index))
        .sort(
          (left, right) =>
            Math.abs(left.edge - boundary) - Math.abs(right.edge - boundary) ||
            left.index - right.index,
        );
      const selected = candidates[0];
      if (selected) {
        edges[selected.index] = boundary;
        usedIndexes.add(selected.index);
      }
    }
    edges.sort((left, right) => left - right);
  }
  const bins: NumericHistogramBin[] = [];
  for (let i = 0; i < targetBins; i++) {
    const from = edges[i]!;
    const to = edges[i + 1]!;
    const count = values.filter((v) =>
      i === targetBins - 1 ? v >= from && v <= to : v >= from && v < to,
    ).length;
    bins.push({
      from: round4(from),
      to: round4(to),
      count,
      inBand: band ? from >= band.left && to <= band.right : false,
    });
  }
  return bins;
}

function resolveNiceNumericRange(
  min: number,
  max: number,
  targetBins: number,
): { min: number; max: number } {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return { min, max };
  const rawStep = span / Math.max(1, targetBins);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceFactor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const niceStep = niceFactor * magnitude;
  return {
    min: Math.floor(min / niceStep) * niceStep,
    max: Math.ceil(max / niceStep) * niceStep,
  };
}

function buildNumericRoundComparisonFromVotes(
  votes: Array<{ participantId: string; round: number; numericValue?: number | null }>,
  band: { left: number; right: number } | null,
  referenceValue: number | null,
): NumericRoundComparisonDTO {
  const round1Votes = votes.filter((vote) => vote.round === 1);
  const round2Votes = votes.filter((vote) => vote.round === 2);
  const round1Values = round1Votes
    .map((vote) => vote.numericValue)
    .filter((value): value is number => value !== null && value !== undefined);
  const round2Values = round2Votes
    .map((vote) => vote.numericValue)
    .filter((value): value is number => value !== null && value !== undefined);
  const round1Stats = buildNumericStats(round1Values, band, referenceValue);
  const round2Stats = buildNumericStats(round2Values, band, referenceValue);

  const r1Map = new Map(
    round1Votes
      .filter((vote) => vote.numericValue !== null && vote.numericValue !== undefined)
      .map((vote) => [vote.participantId, vote.numericValue as number]),
  );
  const r2Map = new Map(
    round2Votes
      .filter((vote) => vote.numericValue !== null && vote.numericValue !== undefined)
      .map((vote) => [vote.participantId, vote.numericValue as number]),
  );
  const deltaValues: number[] = [];
  let closerCount = 0;
  let fartherCount = 0;
  let unchangedCount = 0;
  let pairedCount = 0;

  for (const [participantId, value1] of r1Map) {
    const value2 = r2Map.get(participantId);
    if (value2 === undefined) continue;
    pairedCount++;
    deltaValues.push(value2 - value1);
    if (referenceValue === null) continue;
    const distance1 = Math.abs(value1 - referenceValue);
    const distance2 = Math.abs(value2 - referenceValue);
    if (Math.abs(distance1 - distance2) < 1e-9) {
      unchangedCount++;
    } else if (distance2 < distance1) {
      closerCount++;
    } else {
      fartherCount++;
    }
  }

  return {
    round1Stats,
    round2Stats,
    round1Histogram: buildNumericHistogram(round1Values, band),
    round2Histogram: buildNumericHistogram(round2Values, band),
    meanDelta:
      round1Stats.mean !== null && round2Stats.mean !== null
        ? round4(round2Stats.mean - round1Stats.mean)
        : null,
    medianDelta:
      round1Stats.median !== null && round2Stats.median !== null
        ? round4(round2Stats.median - round1Stats.median)
        : null,
    inBandPercentDelta:
      round1Stats.inBandPercent !== null && round2Stats.inBandPercent !== null
        ? round4(round2Stats.inBandPercent - round1Stats.inBandPercent)
        : null,
    deltaHistogram: deltaValues.length > 0 ? buildNumericHistogram(deltaValues, null) : undefined,
    pairedAnalysis:
      referenceValue !== null && pairedCount > 0
        ? { pairedCount, closerCount, fartherCount, unchangedCount }
        : undefined,
  };
}

async function buildHostCurrentQuestionDto(
  session: HostCurrentQuestionSession | null,
): Promise<z.infer<typeof HostCurrentQuestionDTOSchema> | null> {
  if (!session?.quiz) return null;
  if (session.status === 'LOBBY') return null;
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

  let numericToleranceMode: 'ABSOLUTE_INTERVAL' | 'RELATIVE_PERCENT' | null = null;
  let numericBand: { left: number; right: number } | null = null;
  let numericReferenceValue: number | null = null;
  if (question.type === 'NUMERIC_ESTIMATE') {
    numericToleranceMode = resolveNumericEstimateToleranceMode(question.numericToleranceMode);
    numericBand = resolveNumericTolerance(numericToleranceMode, {
      referenceValue: question.numericReferenceValue,
      tolerancePercent: question.numericTolerancePercent,
      intervalLeft: question.numericIntervalLeft,
      intervalRight: question.numericIntervalRight,
    });
    numericReferenceValue = resolveNumericReferenceValueForStats(
      numericToleranceMode,
      question.numericReferenceValue,
      numericBand,
    );
  }

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
    ...getConfidenceDtoFields(question),
    currentRound: session.currentRound,
    ...(question.type === 'NUMERIC_ESTIMATE'
      ? {
          // Story 1.2d: Numerische Konfiguration für Host (immer sichtbar)
          numericToleranceMode: numericToleranceMode!,
          numericReferenceValue,
          numericTolerancePercent: question.numericTolerancePercent ?? null,
          numericIntervalLeft: question.numericIntervalLeft ?? null,
          numericIntervalRight: question.numericIntervalRight ?? null,
          numericInputType:
            (question.numericInputType as 'INTEGER' | 'DECIMAL' | null) ?? undefined,
          numericDecimalPlaces: question.numericDecimalPlaces ?? null,
          numericMin: question.numericMin ?? null,
          numericMax: question.numericMax ?? null,
          numericTwoRounds: question.numericTwoRounds,
        }
      : {}),
  };

  if (session.status === 'DISCUSSION') {
    return base;
  }

  if (session.status === 'RESULTS' || session.status === 'ACTIVE') {
    const currentRound = session.currentRound;
    const voteWhere = { sessionId: session.id, questionId: question.id, round: currentRound };

    if (question.type === 'NUMERIC_ESTIMATE') {
      const band = numericBand;
      const referenceValue = numericReferenceValue;

      // Kein Herdeneffekt während ACTIVE: nur totalVotes
      if (session.status === 'ACTIVE') {
        const totalVotes = await prisma.vote.count({ where: voteWhere });
        return { ...base, totalVotes };
      }

      // RESULTS: Histogramm + Statistik
      let totalVotes: number;
      let numValues: number[];
      let numericRoundComparison: NumericRoundComparisonDTO | undefined;

      if (currentRound === 2) {
        const roundVotes = await prisma.vote.findMany({
          where: { sessionId: session.id, questionId: question.id, round: { in: [1, 2] } },
          select: { participantId: true, round: true, numericValue: true },
        });
        const currentRoundVotes = roundVotes.filter((vote) => vote.round === currentRound);
        totalVotes = currentRoundVotes.length;
        numValues = currentRoundVotes
          .map((v) => v.numericValue)
          .filter((v): v is number => v !== null && v !== undefined);
        numericRoundComparison = buildNumericRoundComparisonFromVotes(
          roundVotes,
          band,
          referenceValue,
        );
      } else {
        const numVotes = await prisma.vote.findMany({
          where: voteWhere,
          select: { numericValue: true },
        });
        totalVotes = numVotes.length;
        numValues = numVotes
          .map((v) => v.numericValue)
          .filter((v): v is number => v !== null && v !== undefined);
      }
      const numericStats = buildNumericStats(numValues, band, referenceValue);
      const numericHistogram = buildNumericHistogram(numValues, band);

      return withHostConfidenceResult(
        session.status,
        session.id,
        question,
        currentRound,
        answersOrdered,
        {
          ...base,
          totalVotes,
          numericStats,
          numericHistogram,
          numericRoundComparison,
        },
      );
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

      return withHostConfidenceResult(
        session.status,
        session.id,
        question,
        currentRound,
        answersOrdered,
        {
          ...base,
          totalVotes: voteSummary.totalVotes,
          correctVoterCount: voteSummary.correctVoteCount,
          incorrectVoterCount: voteSummary.incorrectVoteCount,
          incorrectFreeTextResponses:
            voteSummary.incorrectFreeTextResponses.length > 0
              ? voteSummary.incorrectFreeTextResponses
              : undefined,
          voteDistribution,
        },
      );
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

    return withHostConfidenceResult(
      session.status,
      session.id,
      question,
      currentRound,
      answersOrdered,
      {
        ...base,
        totalVotes,
        correctVoterCount,
        peerInstructionSuggestion,
        voteDistribution,
        roundComparison,
      },
    );
  }

  return base;
}

type HostCurrentQuestionEnvelope = {
  status: string | null;
  payload: HostCurrentQuestionDTO | null;
};

export function buildHostCurrentQuestionSubscriptionKey(
  envelope: HostCurrentQuestionEnvelope,
): string {
  if (!envelope.payload || envelope.status !== 'ACTIVE') {
    return JSON.stringify(envelope.payload);
  }

  const {
    totalVotes: _totalVotes,
    correctVoterCount: _correctVoterCount,
    incorrectVoterCount: _incorrectVoterCount,
    peerInstructionSuggestion: _peerInstructionSuggestion,
    ratingAvg: _ratingAvg,
    ratingCount: _ratingCount,
    ratingDistribution: _ratingDistribution,
    freeTextResponses: _freeTextResponses,
    incorrectFreeTextResponses: _incorrectFreeTextResponses,
    voteDistribution: _voteDistribution,
    roundComparison: _roundComparison,
    numericHistogram: _numericHistogram,
    numericStats: _numericStats,
    numericRoundComparison: _numericRoundComparison,
    confidenceResult: _confidenceResult,
    ...stablePayload
  } = envelope.payload;

  return JSON.stringify(stablePayload);
}

async function fetchHostCurrentQuestionEnvelope(
  code: string,
): Promise<HostCurrentQuestionEnvelope> {
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
              confidenceEnabled: true,
              confidenceLabelLow: true,
              confidenceLabelHigh: true,
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
  return {
    status: session?.status ?? null,
    payload: await buildHostCurrentQuestionDto(session),
  };
}

async function fetchHostCurrentQuestion(
  code: string,
): Promise<z.infer<typeof HostCurrentQuestionDTOSchema> | null> {
  const envelope = await fetchHostCurrentQuestionEnvelope(code);
  return envelope.payload;
}

async function fetchHostVoteProgress(code: string): Promise<HostVoteProgressDTO | null> {
  const normalizedCode = code.toUpperCase();
  const session = await prisma.session.findUnique({
    where: { code: normalizedCode },
    select: {
      id: true,
      code: true,
      status: true,
      currentQuestion: true,
      currentRound: true,
      quiz: {
        select: {
          questions: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              type: true,
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
              answers: { select: { id: true, text: true, isCorrect: true } },
            },
          },
        },
      },
    },
  });

  if (!session?.quiz || session.status !== 'ACTIVE') {
    return null;
  }
  const questionIndex = session.currentQuestion;
  if (questionIndex === null || questionIndex === undefined) {
    return null;
  }
  const question = session.quiz.questions[questionIndex] ?? null;
  if (!question) {
    return null;
  }

  const round = session.currentRound ?? 1;
  const questionType = question.type as QuestionType;
  const base = {
    questionId: question.id,
    questionOrder: question.order,
    round,
  };

  if (questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE') {
    const voteSummary = await getVoteSummaryCached(
      session.code,
      session.id,
      question.id,
      round,
      questionType,
      { answers: question.answers },
    );
    return {
      ...base,
      totalVotes: voteSummary.totalVotes,
      correctVoterCount: voteSummary.correctVoteCount,
      incorrectVoterCount: voteSummary.incorrectVoteCount,
      peerInstructionSuggestion: buildPeerInstructionSuggestion(
        questionType,
        round,
        voteSummary.correctVoteCount,
        voteSummary.totalVotes,
      ),
    };
  }

  if (questionType === 'SHORT_TEXT') {
    const voteSummary = await getVoteSummaryCached(
      session.code,
      session.id,
      question.id,
      round,
      questionType,
      {
        answers: question.answers,
        ...resolveShortTextQuestionConfig(question),
      },
    );
    return {
      ...base,
      totalVotes: voteSummary.totalVotes,
      correctVoterCount: voteSummary.correctVoteCount,
      incorrectVoterCount: voteSummary.incorrectVoteCount,
    };
  }

  const totalVotes = await getVoteCountCached(session.code, session.id, question.id, round);
  return {
    ...base,
    totalVotes,
  };
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
                _count: { select: { questions: true } },
              },
            })
          : null;
      if (input.quizId && !quiz) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz nicht gefunden.' });
      }
      const startQuestionIndex = input.startQuestionIndex ?? 0;
      if (startQuestionIndex > 0 && !quiz) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Eine Startfrage ist nur für Quiz-Sessions möglich.',
        });
      }
      if (quiz && startQuestionIndex > 0 && startQuestionIndex >= quiz._count.questions) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Startfrage liegt außerhalb des Quiz.',
        });
      }
      const initialCurrentQuestion = startQuestionIndex > 0 ? startQuestionIndex - 1 : null;

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
          currentQuestion: initialCurrentQuestion,
          quizStarted: false,
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
                    motifImageUrl: true,
                    teamNames: true,
                  },
                })
              : null;
          const onboardingProfile = resolveSessionOnboardingProfile(session, q);
          const channels = buildSessionChannels(session);
          const visibleCurrentQuestion =
            session.status === 'LOBBY' ? null : session.currentQuestion;
          return {
            id: session.id,
            code: session.code,
            type: session.type,
            status: session.status,
            currentQuestion: visibleCurrentQuestion,
            currentRound: session.currentRound,
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
              quizStarted: session.quizStarted,
              defaultTimer: q.defaultTimer,
              timerScaleByDifficulty: q.timerScaleByDifficulty,
              backgroundMusic: q.backgroundMusic,
              bonusTokenCount: q.bonusTokenCount,
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

  /** Teilnehmende verlassen die Live-Ansicht: nur Online-Presence entfernen, nicht die Teilnahme. */
  markParticipantOffline: publicProcedure
    .input(GetSessionParticipantInputSchema)
    .output(z.object({ ok: z.boolean() }))
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const participant = await prisma.participant.findFirst({
        where: {
          id: input.participantId,
          session: { code },
        },
        select: { sessionId: true },
      });

      if (participant) {
        await removeParticipantPresence(participant.sessionId, input.participantId);
        clearParticipantsSnapshotCache(code);
        emitSessionParticipantSignal(code);
      }

      return { ok: true };
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
    .input(NextQuestionInputSchema)
    .output(SessionStatusUpdateSchema)
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      const skipCurrentResultQuestion = input.skipCurrentResultQuestion === true;
      const session = await prisma.session.findUnique({
        where: { code },
        include: {
          quiz: {
            select: {
              name: true,
              readingPhaseEnabled: true,
              defaultTimer: true,
              timerScaleByDifficulty: true,
              bonusTokenCount: true,
              questions: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  type: true,
                  skipReadingPhase: true,
                  timer: true,
                  difficulty: true,
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

      if (skipCurrentResultQuestion && !['RESULTS', 'DISCUSSION'].includes(session.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'skipCurrentResultQuestion ist nur aus Status RESULTS oder DISCUSSION erlaubt.',
        });
      }

      const currentIdx = session.currentQuestion ?? -1;
      const nextIdx = currentIdx + (skipCurrentResultQuestion ? 2 : 1);
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
            activeQuestionStartedAt: null,
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
      const effectiveTimer =
        newStatus === 'ACTIVE'
          ? resolveEffectiveQuestionTimer(
              nextQuestion?.timer,
              session.quiz.defaultTimer,
              nextQuestion?.difficulty ?? 'MEDIUM',
              session.quiz.timerScaleByDifficulty ?? true,
            )
          : null;

      let answerDisplayOrderPayload: ReturnType<typeof buildAnswerDisplayOrderForQuiz> | undefined;
      if (nextIdx === 0 && (session.answerDisplayOrder ?? null) === null) {
        const built = buildAnswerDisplayOrderForQuiz(session.quiz.questions);
        if (Object.keys(built).length > 0) {
          answerDisplayOrderPayload = built;
        }
      }

      const now = new Date();
      await prisma.session.update({
        where: { id: session.id },
        data: {
          status: newStatus,
          currentQuestion: nextIdx,
          currentRound: 1,
          quizStarted: true,
          statusChangedAt: now,
          activeQuestionStartedAt: newStatus === 'ACTIVE' ? now : null,
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
        ...(newStatus === 'ACTIVE' && {
          activeAt: now.toISOString(),
          timer: effectiveTimer,
        }),
      };
    }),

  prevQuestion: hostProcedure
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
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      const allowedFrom = ['RESULTS', 'DISCUSSION'];
      if (!allowedFrom.includes(session.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Zurück nur aus Status RESULTS oder DISCUSSION möglich.',
        });
      }
      if (session.currentQuestion === null || session.currentQuestion <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Bereits bei der ersten Frage – Rückwärtsnavigation nicht möglich.',
        });
      }
      const prevIdx = session.currentQuestion - 1;
      await prisma.session.update({
        where: { id: session.id },
        data: {
          status: 'RESULTS',
          currentQuestion: prevIdx,
          currentRound: 1,
          statusChangedAt: new Date(),
        },
      });
      invalidateSessionStatusCachesForCode(code);
      void recordSessionTransitionActivity();
      return {
        status: 'RESULTS' as const,
        currentQuestion: prevIdx,
        currentRound: 1,
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
              defaultTimer: true,
              timerScaleByDifficulty: true,
              questions: {
                orderBy: { order: 'asc' },
                select: { id: true, timer: true, difficulty: true },
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
        data: { status: 'ACTIVE', statusChangedAt: now, activeQuestionStartedAt: now },
      });
      const questionId =
        session.currentQuestion === null || session.currentQuestion === undefined
          ? null
          : (session.quiz?.questions[session.currentQuestion]?.id ?? null);
      const currentQuestion =
        session.currentQuestion === null || session.currentQuestion === undefined
          ? null
          : (session.quiz?.questions[session.currentQuestion] ?? null);
      const effectiveTimer =
        session.currentRound === 2 || !currentQuestion
          ? null
          : resolveEffectiveQuestionTimer(
              currentQuestion.timer,
              session.quiz?.defaultTimer,
              currentQuestion.difficulty ?? 'MEDIUM',
              session.quiz?.timerScaleByDifficulty ?? true,
            );
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
        timer: effectiveTimer,
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
        select: {
          id: true,
          status: true,
          currentQuestion: true,
          currentRound: true,
          quiz: {
            select: {
              questions: {
                orderBy: { order: 'asc' },
                select: { type: true, numericTwoRounds: true },
              },
            },
          },
        },
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
        select: {
          id: true,
          status: true,
          currentQuestion: true,
          currentRound: true,
          quiz: {
            select: {
              questions: {
                orderBy: { order: 'asc' },
                select: { type: true, numericTwoRounds: true },
              },
            },
          },
        },
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
      const question =
        session.currentQuestion !== null && session.currentQuestion !== undefined
          ? (session.quiz?.questions[session.currentQuestion] ?? null)
          : null;
      if (!questionSupportsSecondRound(question)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Diese Frage ist nicht für eine zweite Runde konfiguriert.',
        });
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
        select: {
          id: true,
          status: true,
          currentQuestion: true,
          quiz: {
            select: {
              questions: {
                orderBy: { order: 'asc' },
                select: { type: true, numericTwoRounds: true },
              },
            },
          },
        },
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
      const question =
        session.currentQuestion !== null && session.currentQuestion !== undefined
          ? (session.quiz?.questions[session.currentQuestion] ?? null)
          : null;
      if (!questionSupportsSecondRound(question)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Diese Frage ist nicht für eine zweite Runde konfiguriert.',
        });
      }
      const now = new Date();
      await prisma.session.update({
        where: { id: session.id },
        data: {
          status: 'ACTIVE',
          currentRound: 2,
          statusChangedAt: now,
          activeQuestionStartedAt: now,
        },
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

  getHostVoteProgress: hostProcedure
    .input(GetSessionInfoInputSchema)
    .output(HostVoteProgressDTOSchema.nullable())
    .query(async ({ input }) => fetchHostVoteProgress(input.code)),

  onCurrentQuestionForHostChanged: hostProcedure
    .input(GetSessionInfoInputSchema)
    .subscription(async function* ({ input }) {
      const code = input.code.toUpperCase();
      let lastJson = '';
      while (true) {
        const envelope = await fetchHostCurrentQuestionEnvelope(code);
        const payload = envelope.payload;
        const json = buildHostCurrentQuestionSubscriptionKey(envelope);
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

  onHostVoteProgressChanged: hostProcedure
    .input(GetSessionInfoInputSchema)
    .subscription(async function* ({ input }) {
      const code = input.code.toUpperCase();
      let lastJson = '';
      while (true) {
        const payload = await fetchHostVoteProgress(code);
        const json = JSON.stringify(payload);
        if (json !== lastJson) {
          lastJson = json;
          yield payload;
        }
        const currentVersion = getSessionVoteProgressSignalVersion(code);
        await waitForSessionVoteProgressSignal(
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
      if (session.status === 'LOBBY') return null;
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
          ...getConfidenceDtoFields(question),
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
          ...getConfidenceDtoFields(question),
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
              activeAt: (session.activeQuestionStartedAt ?? session.statusChangedAt).toISOString(),
              ratingMin: question.ratingMin ?? null,
              ratingMax: question.ratingMax ?? null,
              ratingLabelMin: question.ratingLabelMin ?? null,
              ratingLabelMax: question.ratingLabelMax ?? null,
              ...getShortTextDtoFields(question.type, question),
              ...getConfidenceDtoFields(question),
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
            const estimateToleranceMode =
              question.type === 'NUMERIC_ESTIMATE'
                ? resolveNumericEstimateToleranceMode(question.numericToleranceMode)
                : null;
            const numericBand =
              estimateToleranceMode !== null
                ? resolveNumericTolerance(estimateToleranceMode, {
                    referenceValue: question.numericReferenceValue,
                    tolerancePercent: question.numericTolerancePercent,
                    intervalLeft: question.numericIntervalLeft,
                    intervalRight: question.numericIntervalRight,
                  })
                : null;
            const numericRefVal =
              estimateToleranceMode !== null
                ? resolveNumericReferenceValueForStats(
                    estimateToleranceMode,
                    question.numericReferenceValue,
                    numericBand,
                  )
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
              ...getConfidenceDtoFields(question),
              correctVoterCount:
                question.type === 'SHORT_TEXT' ? voteSummary.correctVoteCount : undefined,
              incorrectVoterCount:
                question.type === 'SHORT_TEXT' ? voteSummary.incorrectVoteCount : undefined,
              totalVotes: voteSummary.totalVotes,
              ...(question.type === 'NUMERIC_ESTIMATE'
                ? {
                    numericToleranceMode: estimateToleranceMode ?? undefined,
                    numericReferenceValue: numericRefVal,
                    numericTolerancePercent: question.numericTolerancePercent ?? null,
                    numericIntervalLeft: question.numericIntervalLeft ?? null,
                    numericIntervalRight: question.numericIntervalRight ?? null,
                    numericInputType: question.numericInputType ?? undefined,
                    numericDecimalPlaces: question.numericDecimalPlaces ?? null,
                    numericTwoRounds: question.numericTwoRounds ?? false,
                    currentRound: session.currentRound,
                  }
                : {}),
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
          participants: {
            select: {
              id: true,
              nickname: true,
              team: { select: { name: true, color: true } },
            },
          },
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

      const votes = selectEffectiveCompetitionVotes(
        await prisma.vote.findMany({
          where: { sessionId: session.id, round: { in: [1, 2] } },
          select: {
            participantId: true,
            questionId: true,
            round: true,
            score: true,
            isCorrect: true,
            responseTimeMs: true,
            question: {
              select: {
                type: true,
                answers: { select: { id: true, isCorrect: true } },
              },
            },
            selectedAnswers: { select: { answerOptionId: true } },
          },
        }),
      );

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
        s.totalResponseTimeMs += getCompetitionResponseTimeMs(v);

        if (questionCountsTowardsTotalQuestions(v.question.type as QuestionType)) {
          if (v.question.type === 'SHORT_TEXT' || v.question.type === 'NUMERIC_ESTIMATE') {
            if (v.isCorrect ?? v.score > 0) {
              s.correctCount++;
            }
            continue;
          }
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

      const participantMetaById = new Map(
        session.participants.map((p) => [
          p.id,
          {
            nickname: p.nickname,
            teamName: p.team?.name ?? null,
            teamColor: p.team?.color ?? null,
          },
        ]),
      );

      const entries: LeaderboardEntryDTO[] = [...stats.entries()]
        .map(([pid, s]) => {
          const meta = participantMetaById.get(pid);
          return {
            rank: 0,
            nickname: meta?.nickname ?? '?',
            totalScore: Number(s.totalScore) || 0,
            correctCount: s.correctCount,
            totalQuestions: totalScoredQuestions,
            totalResponseTimeMs: s.totalResponseTimeMs,
            ...(meta?.teamName
              ? {
                  teamName: meta.teamName,
                  teamColor: meta.teamColor,
                }
              : {}),
          };
        })
        .filter((e) => e.totalScore > 0 || e.correctCount > 0)
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
          activeQuestionStartedAt: null,
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
          const [bonusSession, analysisSession] = await Promise.all([
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
              },
              select: { id: true },
            }),
          ]);

          return {
            quizId: entry.quizId,
            hasBonusTokens: bonusSession !== null,
            hasLastSessionAnalysis: analysisSession !== null,
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
   * Aggregierte Auswertung der zuletzt beendeten Live-Session eines Quizzes.
   * Der Besitznachweis entspricht den übrigen Quiz-Sammlungs-Historienpfaden.
   */
  getLastSessionAnalysisForQuiz: publicProcedure
    .input(GetLastSessionAnalysisForQuizInputSchema)
    .output(LastSessionAnalysisForQuizOutputSchema)
    .query(async ({ input }) => {
      const scopedQuizIds = await resolveQuizHistoryScopeIds(input.quizId, input.accessProof);
      const session = await prisma.session.findFirst({
        where: {
          quizId: { in: scopedQuizIds },
          status: 'FINISHED',
        },
        orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }],
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
            select: {
              questionId: true,
              round: true,
              confidenceValue: true,
              isCorrect: true,
              selectedAnswers: { select: { answerOptionId: true } },
            },
          },
          sessionFeedbacks: true,
          _count: { select: { participants: true } },
        },
      });
      if (!session?.quiz) {
        return null;
      }

      const feedbackSummary = buildSessionFeedbackSummaryFromRows(session.sessionFeedbacks);
      return {
        endedAt: session.endedAt?.toISOString() ?? null,
        participantCount: session._count.participants,
        confidenceSummary: buildConfidenceSummaryForSession(session.quiz.questions, session.votes),
        feedbackSummary: feedbackSummary.totalResponses > 0 ? feedbackSummary : null,
      };
    }),

  /**
   * Aggregierte Session-Exportdaten der zuletzt beendeten Live-Session eines Quizzes.
   * Gleiches Berechtigungsmodell wie Bonus-Codes und Nachbesprechungsplan-Export.
   */
  getLastSessionExportDataForQuiz: publicProcedure
    .input(GetLastSessionExportDataForQuizInputSchema)
    .output(SessionExportDTOSchema)
    .query(async ({ input }) => {
      const code = await resolveLastFinishedSessionCodeForQuiz(input.quizId, input.accessProof);
      return loadFinishedQuizSessionExportData(code);
    }),

  /** PDF-Ergebnisbericht der zuletzt beendeten Live-Session eines Quizzes. */
  getLastSessionExportPdfForQuiz: publicProcedure
    .input(GetLastSessionExportPdfForQuizInputSchema)
    .output(SessionExportPdfOutputSchema)
    .query(async ({ input }) => {
      const code = await resolveLastFinishedSessionCodeForQuiz(input.quizId, input.accessProof);
      const data = await loadFinishedQuizSessionExportData(code);
      const pdf = await buildSessionResultsPdf(data, { localeId: input.localeId });
      return {
        fileName: buildSessionResultsPdfFilename(data.quizName, data.sessionCode),
        mimeType: 'application/pdf' as const,
        contentBase64: pdf.toString('base64'),
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
          isCorrect: true,
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
        if (questionType === 'SHORT_TEXT' || questionType === 'NUMERIC_ESTIMATE') {
          wasCorrect = myVote.isCorrect ?? myVote.score > 0;
        } else {
          const selectedSet = new Set(myVote.selectedAnswers.map((a) => a.answerOptionId));
          const correctSet = new Set(correctIds);
          wasCorrect =
            selectedSet.size === correctSet.size &&
            [...selectedSet].every((id) => correctSet.has(id));
        }
      }

      // Alle Votes bis einschließlich dieser Frage (für Ranking)
      const questionsUpToNow = session.quiz.questions
        .slice(0, input.questionIndex + 1)
        .map((q) => q.id);
      const allVotes = selectEffectiveCompetitionVotes(
        await prisma.vote.findMany({
          where: {
            sessionId: session.id,
            round: { in: [1, 2] },
            questionId: { in: questionsUpToNow },
          },
          select: {
            participantId: true,
            questionId: true,
            round: true,
            score: true,
            responseTimeMs: true,
          },
        }),
      );

      const totals = new Map<string, { totalScore: number; totalResponseTimeMs: number }>();
      for (const p of session.participants) {
        totals.set(p.id, { totalScore: 0, totalResponseTimeMs: 0 });
      }
      for (const v of allVotes) {
        const t = totals.get(v.participantId);
        if (!t) continue;
        t.totalScore += Number(v.score) || 0;
        t.totalResponseTimeMs += getCompetitionResponseTimeMs(v);
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
        const prevVotes = selectEffectiveCompetitionVotes(
          await prisma.vote.findMany({
            where: {
              sessionId: session.id,
              round: { in: [1, 2] },
              questionId: { in: prevQuestionIds },
            },
            select: {
              participantId: true,
              questionId: true,
              round: true,
              score: true,
              responseTimeMs: true,
            },
          }),
        );
        const prevTotals = new Map<string, { totalScore: number; totalResponseTimeMs: number }>();
        for (const p of session.participants) {
          prevTotals.set(p.id, { totalScore: 0, totalResponseTimeMs: 0 });
        }
        for (const v of prevVotes) {
          const t = prevTotals.get(v.participantId);
          if (!t) continue;
          t.totalScore += Number(v.score) || 0;
          t.totalResponseTimeMs += getCompetitionResponseTimeMs(v);
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
        correctAnswerIds:
          wasCorrect === false &&
          (questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE')
            ? correctIds
            : undefined,
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

      const votes = selectEffectiveCompetitionVotes(
        await prisma.vote.findMany({
          where: { sessionId: session.id, round: { in: [1, 2] } },
          select: {
            participantId: true,
            questionId: true,
            round: true,
            score: true,
            responseTimeMs: true,
          },
        }),
      );

      const stats = new Map<string, { totalScore: number; totalResponseTimeMs: number }>();
      for (const p of session.participants) {
        stats.set(p.id, { totalScore: 0, totalResponseTimeMs: 0 });
      }
      for (const v of votes) {
        const s = stats.get(v.participantId);
        if (!s) continue;
        s.totalScore += v.score;
        s.totalResponseTimeMs += getCompetitionResponseTimeMs(v);
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
   * Host-Variante mit Token-Prüfung.
   */
  getExportData: hostProcedure
    .input(GetExportDataInputSchema)
    .output(SessionExportDTOSchema)
    .query(async ({ input }) => loadFinishedQuizSessionExportData(input.code)),

  /**
   * Session-Ergebnisbericht als PDF (HTML-Render via Playwright). Host-only.
   */
  getSessionExportPdf: hostProcedure
    .input(GetSessionExportPdfInputSchema)
    .output(SessionExportPdfOutputSchema)
    .query(async ({ input }) => {
      const data = await loadFinishedQuizSessionExportData(input.code);
      const pdf = await buildSessionResultsPdf(data, { localeId: input.localeId });
      return {
        fileName: buildSessionResultsPdfFilename(data.quizName, data.sessionCode),
        mimeType: 'application/pdf' as const,
        contentBase64: pdf.toString('base64'),
      };
    }),

  /** Session-Bewertung abgeben (Story 4.8). Einmalig pro Participant. */
  submitSessionFeedback: publicProcedure
    .input(SubmitSessionFeedbackInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true, status: true, quizStarted: true },
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
      if (!session.quizStarted) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Bewertung nur nach gestartetem Quiz möglich.',
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

  /**
   * Aggregierte Confidence-Auswertung abrufen (Story 1.2i).
   * Öffentlich wie Session-Feedback: nur aggregierte Daten, kein Host-Token nötig.
   */
  getSessionConfidenceSummary: publicProcedure
    .input(GetSessionInfoInputSchema)
    .output(GetSessionConfidenceSummaryOutputSchema)
    .query(async ({ input }) => loadSessionConfidenceSummaryByCode(input.code)),

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
