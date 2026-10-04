import {
  Injectable,
  LOCALE_ID,
  OnDestroy,
  PLATFORM_ID,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import {
  AddQuestionInputSchema,
  CreateQuizInputSchema,
  DifficultyEnum,
  MotifImageCreditSchema,
  MotifImageUrlSchema,
  NicknameThemeEnum,
  QuizImportSchema,
  QuizExportSchema,
  QuizLearningObjectiveBundleV1Schema,
  QuizUploadInputSchema,
  LEARNING_OBJECTIVE_REVISION_MAX,
  QUIZ_EXPORT_VERSION,
  QUIZ_UPLOAD_MAX_QUESTIONS,
  SHORT_TEXT_DEFAULT_EVALUATION_KIND,
  SHORT_TEXT_DEFAULT_EVALUATION_MODE,
  SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
  isNumericToleranceMode,
  normalizeShortTextValue,
  resolveNumericEstimateToleranceMode,
  resolveNumericQuestionEvaluationSettings,
  resolveShortAnswerEvaluationSettings,
  resolveShortTextEvaluationKind,
  resolveShortTextMaxLength,
  questionSupportsConfidence,
  usesNumericShortTextEvaluation,
  type Difficulty,
  type AddQuestionInput,
  type NicknameTheme,
  type NumericInputKind,
  type NumericToleranceMode,
  type NumericUnitFamily,
  type QuestionNumericToleranceMode,
  type QuizPreset,
  type QuizExport,
  type QuizLearningObjectiveBundleV1,
  type LearningObjectiveNeedsReviewReason,
  type QuizLearningObjectiveScope,
  type QuizLearningObjectiveV1,
  type QuizUploadInput,
  type ShortAnswerEvaluationMode,
  type ShortTextEvaluationKind,
  type TeamAssignment,
  type ToleranceLevel,
  type MatchingPairInput,
  DEMO_QUIZ_HISTORY_SCOPE_ID,
  isDemoQuizHistoryScopeId,
  type OrderingItemInput,
  type CategorizationCategoryInput,
  type CategorizationItemInput,
} from '@arsnova/shared-types';
import { getYjsWsUrl } from '../../../core/ws-urls';
import { trpc } from '../../../core/trpc.client';
import { resolveLocalizedAppUrl } from '../../../core/locale-router';
import {
  getEffectiveLocale,
  getHomeLanguagePreference,
  getLocaleFromPath,
  localeIdToSupported,
  parseLeadingLocaleFromPathOrUrl,
  type SupportedLocale,
} from '../../../core/locale-from-path';
import {
  detectCanonicalDemoLocaleForTitle,
  getDemoQuizPayload,
  getDemoQuizSeedFingerprint,
  normalizeDemoQuizLocale,
} from './demo-quiz-payload';
import { normalizeQuizImportPayload, type QuizImportWarning } from './quiz-import-normalizer';
import { replaceEmojiShortcodes } from '../../../shared/emoji-shortcode.util';
export type { QuizImportWarning } from './quiz-import-normalizer';

export type SupportedQuestionType =
  | 'MULTIPLE_CHOICE'
  | 'SINGLE_CHOICE'
  | 'FREETEXT'
  | 'SHORT_TEXT'
  | 'SURVEY'
  | 'RATING'
  | 'NUMERIC_ESTIMATE'
  | 'MATCHING'
  | 'ORDERING'
  | 'CATEGORIZATION';

export interface QuizAnswer {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  text: string;
  type: SupportedQuestionType;
  difficulty: Difficulty;
  order: number;
  enabled: boolean;
  timer: number | null;
  answers: QuizAnswer[];
  skipReadingPhase?: boolean;
  ratingMin: number | null;
  ratingMax: number | null;
  ratingLabelMin: string | null;
  ratingLabelMax: string | null;
  shortTextEvaluationKind?: ShortTextEvaluationKind | null;
  shortTextMaxLength?: number | null;
  shortTextCaseSensitive?: boolean | null;
  shortTextEvaluationMode?: ShortAnswerEvaluationMode | null;
  shortTextToleranceLevel?: ToleranceLevel | null;
  shortTextAllowPartialCredit?: boolean | null;
  shortTextTrimWhitespace?: boolean | null;
  shortTextNormalizeWhitespace?: boolean | null;
  numericInputKind?: NumericInputKind | null;
  numericToleranceMode?: QuestionNumericToleranceMode | null;
  numericAbsoluteTolerance?: number | null;
  numericRelativeTolerancePercent?: number | null;
  numericUnitFamily?: NumericUnitFamily | null;
  numericRequireUnit?: boolean | null;
  numericAcceptEquivalentUnits?: boolean | null;
  // Story 1.2d: Numerische Schätzfrage
  numericReferenceValue?: number | null;
  numericTolerancePercent?: number | null;
  numericIntervalLeft?: number | null;
  numericIntervalRight?: number | null;
  numericInputType?: 'INTEGER' | 'DECIMAL' | null;
  numericDecimalPlaces?: number | null;
  numericMin?: number | null;
  numericMax?: number | null;
  numericTwoRounds?: boolean;
  confidenceEnabled?: boolean;
  confidenceLabelLow?: string | null;
  confidenceLabelHigh?: string | null;
  // Story 1.2g: Matching
  matchingPairs?: MatchingPairInput[];
  matchingShuffleRight?: boolean;
  // Story 1.2h: Ordering
  orderingItems?: OrderingItemInput[];
  // Story 1.2j: Categorization
  categories?: CategorizationCategoryInput[];
  categorizationItems?: CategorizationItemInput[];
  categorizationShuffleItems?: boolean;
}

export interface QuizSettings {
  showLeaderboard: boolean;
  allowCustomNicknames: boolean;
  defaultTimer: number | null;
  timerScaleByDifficulty?: boolean;
  enableTimerAccommodation?: boolean;
  enableSoundEffects: boolean;
  enableRewardEffects: boolean;
  enableMotivationMessages: boolean;
  enableEmojiReactions: boolean;
  showQuestionTypeIndicators: boolean;
  anonymousMode: boolean;
  teamMode: boolean;
  teamCount: number | null;
  teamAssignment: TeamAssignment;
  teamNames: string[];
  backgroundMusic: string | null;
  nicknameTheme: NicknameTheme;
  bonusTokenCount: number | null;
  readingPhaseEnabled: boolean;
  preset: QuizPreset;
}

export interface QuizDocument {
  id: string;
  name: string;
  description: string | null;
  /** HTTPS-URL, optionales Motivbild (Host, Quiz-Kanal). */
  motifImageUrl: string | null;
  /** Optionaler Bildnachweis zum Motivbild (Lobby / Quizstart). */
  motifImageCredit: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByDeviceId?: string | null;
  updatedByDeviceLabel?: string | null;
  updatedByBrowserLabel?: string | null;
  /** Letzte Server-Quiz-ID nach quiz.upload (für Bonus-Codes in der Sammlung, nicht am Live-Host). */
  lastServerQuizId?: string | null;
  /** Stable Quiz-ID für den zuletzt hochgeladenen Historien-Scope. */
  lastServerQuizAccessProof?: string | null;
  settings: QuizSettings;
  questions: QuizQuestion[];
}

export interface QuizSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  teamMode: boolean;
  hasBonus: boolean;
  /** Server-Quiz-ID nach letztem quiz.upload (Bonus-Codes in der Sammlung). */
  lastServerQuizId: string | null;
  lastServerQuizAccessProof: string | null;
}

export interface QuizImportResult {
  quiz: QuizDocument;
  warnings: QuizImportWarning[];
}

export interface SaveQuizLearningObjectiveInput {
  text: string;
  scope: QuizLearningObjectiveScope;
  confirmationState: 'draft' | 'confirmed';
}

/**
 * Für Live-Upload: Namensliste aus RAM vs. localStorage zusammenführen.
 * Wenn genau eine Seite eine „spezielle“ Liste hat (nicht Oberstufe-Standard), gewinnt diese —
 * auch wenn der andere Stand ein neueres updatedAt hat (typisch: RAM durch Yjs/Tab veraltet, LS noch Kita).
 */
function pickNameParticipationSettings(
  mem: QuizDocument,
  ls: QuizDocument,
): Pick<QuizSettings, 'nicknameTheme' | 'allowCustomNicknames' | 'anonymousMode'> {
  const themeMem = NicknameThemeEnum.safeParse(mem.settings.nicknameTheme).success
    ? mem.settings.nicknameTheme
    : ('HIGH_SCHOOL' as NicknameTheme);
  const themeLs = NicknameThemeEnum.safeParse(ls.settings.nicknameTheme).success
    ? ls.settings.nicknameTheme
    : ('HIGH_SCHOOL' as NicknameTheme);
  const memRich = themeMem !== 'HIGH_SCHOOL';
  const lsRich = themeLs !== 'HIGH_SCHOOL';
  const memT = Date.parse(mem.updatedAt);
  const lsT = Date.parse(ls.updatedAt);

  if (memRich && !lsRich) {
    return {
      nicknameTheme: themeMem,
      allowCustomNicknames: mem.settings.allowCustomNicknames,
      anonymousMode: mem.settings.anonymousMode,
    };
  }
  if (!memRich && lsRich) {
    return {
      nicknameTheme: themeLs,
      allowCustomNicknames: ls.settings.allowCustomNicknames,
      anonymousMode: ls.settings.anonymousMode,
    };
  }
  if (memRich && lsRich && themeMem !== themeLs) {
    return memT >= lsT
      ? {
          nicknameTheme: themeMem,
          allowCustomNicknames: mem.settings.allowCustomNicknames,
          anonymousMode: mem.settings.anonymousMode,
        }
      : {
          nicknameTheme: themeLs,
          allowCustomNicknames: ls.settings.allowCustomNicknames,
          anonymousMode: ls.settings.anonymousMode,
        };
  }
  return memT >= lsT
    ? {
        nicknameTheme: themeMem,
        allowCustomNicknames: mem.settings.allowCustomNicknames,
        anonymousMode: mem.settings.anonymousMode,
      }
    : {
        nicknameTheme: themeLs,
        allowCustomNicknames: ls.settings.allowCustomNicknames,
        anonymousMode: ls.settings.anonymousMode,
      };
}

export interface AddQuizQuestionInput {
  text: string;
  type: SupportedQuestionType;
  difficulty: Difficulty;
  timer?: number | null;
  answers: Array<{ text: string; isCorrect: boolean }>;
  skipReadingPhase?: boolean;
  ratingMin?: number | null;
  ratingMax?: number | null;
  ratingLabelMin?: string | null;
  ratingLabelMax?: string | null;
  shortTextEvaluationKind?: ShortTextEvaluationKind | null;
  shortTextMaxLength?: number | null;
  shortTextCaseSensitive?: boolean | null;
  shortTextEvaluationMode?: ShortAnswerEvaluationMode | null;
  shortTextToleranceLevel?: ToleranceLevel | null;
  shortTextAllowPartialCredit?: boolean | null;
  shortTextTrimWhitespace?: boolean | null;
  shortTextNormalizeWhitespace?: boolean | null;
  numericInputKind?: NumericInputKind | null;
  numericToleranceMode?: QuestionNumericToleranceMode | null;
  numericAbsoluteTolerance?: number | null;
  numericRelativeTolerancePercent?: number | null;
  numericUnitFamily?: NumericUnitFamily | null;
  numericRequireUnit?: boolean | null;
  numericAcceptEquivalentUnits?: boolean | null;
  // Story 1.2d: Numerische Schätzfrage
  numericReferenceValue?: number | null;
  numericTolerancePercent?: number | null;
  numericIntervalLeft?: number | null;
  numericIntervalRight?: number | null;
  numericInputType?: 'INTEGER' | 'DECIMAL' | null;
  numericDecimalPlaces?: number | null;
  numericMin?: number | null;
  numericMax?: number | null;
  numericTwoRounds?: boolean;
  confidenceEnabled?: boolean;
  confidenceLabelLow?: string | null;
  confidenceLabelHigh?: string | null;
  matchingPairs?: MatchingPairInput[];
  matchingShuffleRight?: boolean;
  orderingItems?: OrderingItemInput[];
  categories?: CategorizationCategoryInput[];
  categorizationItems?: CategorizationItemInput[];
  categorizationShuffleItems?: boolean;
}

export interface CreateQuizDocumentInput {
  name: string;
  description?: string;
  motifImageUrl?: string | null;
  motifImageCredit?: string | null;
  settings?: Partial<QuizSettings>;
}

export type UpdateQuizSettingsInput = Partial<QuizSettings>;

type ValidatedQuestionInput = {
  text: string;
  type: SupportedQuestionType;
  difficulty: Difficulty;
  timer: number | null;
  answers: Array<{ text: string; isCorrect: boolean }>;
  skipReadingPhase: boolean;
  ratingMin: number | null;
  ratingMax: number | null;
  ratingLabelMin: string | null;
  ratingLabelMax: string | null;
  shortTextEvaluationKind: ShortTextEvaluationKind | null;
  shortTextMaxLength: number | null;
  shortTextCaseSensitive: boolean | null;
  shortTextEvaluationMode: ShortAnswerEvaluationMode | null;
  shortTextToleranceLevel: ToleranceLevel | null;
  shortTextAllowPartialCredit: boolean | null;
  shortTextTrimWhitespace: boolean | null;
  shortTextNormalizeWhitespace: boolean | null;
  numericInputKind: NumericInputKind | null;
  numericToleranceMode: QuestionNumericToleranceMode | null;
  numericAbsoluteTolerance: number | null;
  numericRelativeTolerancePercent: number | null;
  numericUnitFamily: NumericUnitFamily | null;
  numericRequireUnit: boolean | null;
  numericAcceptEquivalentUnits: boolean | null;
  // Story 1.2d: Numerische Schätzfrage
  numericReferenceValue: number | null;
  numericTolerancePercent: number | null;
  numericIntervalLeft: number | null;
  numericIntervalRight: number | null;
  numericInputType: 'INTEGER' | 'DECIMAL' | null;
  numericDecimalPlaces: number | null;
  numericMin: number | null;
  numericMax: number | null;
  numericTwoRounds: boolean;
  confidenceEnabled: boolean;
  confidenceLabelLow: string | null;
  confidenceLabelHigh: string | null;
  matchingPairs: MatchingPairInput[] | null;
  matchingShuffleRight: boolean;
  orderingItems: OrderingItemInput[] | null;
  categories: CategorizationCategoryInput[] | null;
  categorizationItems: CategorizationItemInput[] | null;
  categorizationShuffleItems: boolean;
};

type ShortTextQuestionSettingsInput = {
  type: string;
  shortTextEvaluationKind?: ShortTextEvaluationKind | null;
  shortTextMaxLength?: number | null;
  shortTextCaseSensitive?: boolean | null;
  shortTextEvaluationMode?: ShortAnswerEvaluationMode | null;
  shortTextToleranceLevel?: ToleranceLevel | null;
  shortTextAllowPartialCredit?: boolean | null;
  shortTextTrimWhitespace?: boolean | null;
  shortTextNormalizeWhitespace?: boolean | null;
  numericInputKind?: NumericInputKind | null;
  numericToleranceMode?: QuestionNumericToleranceMode | null;
  numericAbsoluteTolerance?: number | null;
  numericRelativeTolerancePercent?: number | null;
  numericUnitFamily?: NumericUnitFamily | null;
  numericRequireUnit?: boolean | null;
  numericAcceptEquivalentUnits?: boolean | null;
};

type ResolvedShortTextQuestionSettings = {
  shortTextEvaluationKind: ShortTextEvaluationKind | null;
  shortTextMaxLength: number | null;
  shortTextCaseSensitive: boolean | null;
  shortTextEvaluationMode: ShortAnswerEvaluationMode | null;
  shortTextToleranceLevel: ToleranceLevel | null;
  shortTextAllowPartialCredit: boolean | null;
  shortTextTrimWhitespace: boolean | null;
  shortTextNormalizeWhitespace: boolean | null;
  numericInputKind: NumericInputKind | null;
  numericToleranceMode: NumericToleranceMode | null;
  numericAbsoluteTolerance: number | null;
  numericRelativeTolerancePercent: number | null;
  numericUnitFamily: NumericUnitFamily | null;
  numericRequireUnit: boolean | null;
  numericAcceptEquivalentUnits: boolean | null;
};

function resolveQuestionShortTextSettings(
  question: ShortTextQuestionSettingsInput,
): ResolvedShortTextQuestionSettings {
  if (question.type !== 'SHORT_TEXT') {
    return {
      shortTextEvaluationKind: null,
      shortTextMaxLength: null,
      shortTextCaseSensitive: null,
      shortTextEvaluationMode: null,
      shortTextToleranceLevel: null,
      shortTextAllowPartialCredit: null,
      shortTextTrimWhitespace: null,
      shortTextNormalizeWhitespace: null,
      numericInputKind: null,
      numericToleranceMode: null,
      numericAbsoluteTolerance: null,
      numericRelativeTolerancePercent: null,
      numericUnitFamily: null,
      numericRequireUnit: null,
      numericAcceptEquivalentUnits: null,
    };
  }

  const settings = resolveShortAnswerEvaluationSettings({
    evaluationMode: question.shortTextEvaluationMode ?? SHORT_TEXT_DEFAULT_EVALUATION_MODE,
    toleranceLevel: question.shortTextToleranceLevel ?? SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
    allowPartialCredit: question.shortTextAllowPartialCredit ?? true,
    caseSensitive: question.shortTextCaseSensitive ?? false,
    trimWhitespace: question.shortTextTrimWhitespace ?? true,
    normalizeWhitespace: question.shortTextNormalizeWhitespace ?? true,
  });
  const numericSettings = resolveNumericQuestionEvaluationSettings({
    numericInputKind: question.numericInputKind ?? null,
    numericToleranceMode: isNumericToleranceMode(question.numericToleranceMode)
      ? question.numericToleranceMode
      : null,
    numericAbsoluteTolerance: question.numericAbsoluteTolerance ?? null,
    numericRelativeTolerancePercent: question.numericRelativeTolerancePercent ?? null,
    numericUnitFamily: question.numericUnitFamily ?? null,
    numericRequireUnit: question.numericRequireUnit ?? false,
    numericAcceptEquivalentUnits: question.numericAcceptEquivalentUnits ?? true,
  });

  return {
    shortTextEvaluationKind: resolveShortTextEvaluationKind(
      question.shortTextEvaluationKind ?? SHORT_TEXT_DEFAULT_EVALUATION_KIND,
    ),
    shortTextMaxLength: resolveShortTextMaxLength(question.shortTextMaxLength),
    shortTextCaseSensitive: settings.caseSensitive,
    shortTextEvaluationMode: settings.evaluationMode,
    shortTextToleranceLevel: settings.toleranceLevel,
    shortTextAllowPartialCredit: settings.allowPartialCredit,
    shortTextTrimWhitespace: settings.trimWhitespace,
    shortTextNormalizeWhitespace: settings.normalizeWhitespace,
    numericInputKind: numericSettings.inputKind,
    numericToleranceMode: numericSettings.toleranceMode,
    numericAbsoluteTolerance: numericSettings.absoluteTolerance,
    numericRelativeTolerancePercent: numericSettings.relativeTolerancePercent,
    numericUnitFamily: numericSettings.unitFamily,
    numericRequireUnit: numericSettings.requireUnit,
    numericAcceptEquivalentUnits: numericSettings.acceptEquivalentUnits,
  };
}

type QuestionConfidenceSettingsInput = {
  type: string;
  confidenceEnabled?: boolean | null;
  confidenceLabelLow?: string | null;
  confidenceLabelHigh?: string | null;
};

function resolveQuestionConfidenceSettings(question: QuestionConfidenceSettingsInput): {
  confidenceEnabled: boolean;
  confidenceLabelLow: string | null;
  confidenceLabelHigh: string | null;
} {
  if (!questionSupportsConfidence(question.type)) {
    return {
      confidenceEnabled: false,
      confidenceLabelLow: null,
      confidenceLabelHigh: null,
    };
  }

  const enabled = question.confidenceEnabled === true;
  return {
    confidenceEnabled: enabled,
    confidenceLabelLow: enabled
      ? (normalizeNullableLabel(question.confidenceLabelLow) ?? null)
      : null,
    confidenceLabelHigh: enabled
      ? (normalizeNullableLabel(question.confidenceLabelHigh) ?? null)
      : null,
  };
}

type QuestionCreateData = Omit<AddQuestionInput, 'order'>;

interface HomePresetSnapshot {
  theme: string | null;
  preset: string | null;
  seriousOptions: string | null;
  playfulOptions: string | null;
}

interface SyncMetadataSnapshot {
  lastConnectedAt: string | null;
  lastLocalChangeAt: string | null;
  lastRemoteSyncAt: string | null;
  lastRemoteChangedQuizName: string | null;
  lastRemoteChangedQuizUpdatedAt: string | null;
  lastRemoteChangedByDeviceLabel: string | null;
  lastRemoteChangedByBrowserLabel: string | null;
  originSharedAt: string | null;
  originDeviceLabel: string | null;
  originBrowserLabel: string | null;
}

interface SyncClientPresence {
  deviceId: string;
  deviceLabel: string;
  browserLabel: string;
}

type YDoc = import('yjs').Doc;
type YMapDoc<T> = import('yjs').Map<T>;
type YjsModule = typeof import('yjs');
type IndexedDbPersistenceCtor = typeof import('y-indexeddb').IndexeddbPersistence;
type IndexedDbPersistenceInstance = import('y-indexeddb').IndexeddbPersistence;
type WebsocketProviderCtor = typeof import('y-websocket').WebsocketProvider;
type WebsocketProviderInstance = import('y-websocket').WebsocketProvider;

export interface SyncPeerInfo {
  deviceId: string;
  deviceLabel: string;
  browserLabel: string;
}

export const QUIZ_STORAGE_KEY = 'quiz-library-v1';
const QUIZ_STORAGE_LEGACY_KEY = QUIZ_STORAGE_KEY;
const QUIZ_YDOC_NAME = 'arsnova-quiz-library-v1';
const QUIZ_YDOC_ROOT_KEY = 'quizzes';
const QUIZ_YDOC_PRESET_KEY = 'home-presets';
const QUIZ_LEARNING_OBJECTIVES_ROOT_KEY = 'quiz-learning-objectives-v1';
const QUIZ_LEARNING_OBJECTIVES_INITIALIZED_KEY = 'quiz-learning-objectives-v1-initialized';
const QUIZ_LEARNING_OBJECTIVES_STORAGE_PREFIX = 'quiz-learning-objectives-v1';
const QUIZ_LEARNING_OBJECTIVES_OPLOG_MARKER = 'oplog-v1';
const QUIZ_LEARNING_OBJECTIVES_OPLOG_PREFIX = 'quiz-learning-objectives-v1-oplog';
const QUIZ_LEARNING_OBJECTIVES_OPLOG_HARD_LIMIT = 4096;
const QUIZ_LEARNING_OBJECTIVES_OPLOG_RECENT_PER_OBJECTIVE = 8;
const QUIZ_LEARNING_OBJECTIVES_DELETE_SETTLEMENT_MS = 1500;
const QUIZ_IMPORTED_PERSISTENCE_SYNC_TIMEOUT_MS = 5000;
const QUIZ_IMPORTED_PERSISTENCE_CLEAR_TIMEOUT_MS = 1000;
const QUIZ_SYNC_ROOM_STORAGE_KEY = 'quiz-sync-room-id';
const QUIZ_SYNC_METADATA_PREFIX = 'quiz-sync-meta';
const QUIZ_SYNC_DEVICE_ID_KEY = 'quiz-sync-device-id';
const QUIZ_SYNC_SHARE_TOKEN_PREFIX = 'quiz-sync-share-token';
const QUIZ_SYNC_ROTATION_CAPABILITY_PREFIX = 'quiz-sync-rotation-capability';
const QUIZ_LIBRARY_SHARING_MODE_KEY = 'quiz-library-sharing-mode';
const QUIZ_SYNC_ROOM_PREFIX = 'quiz-library-room-';
const YJS_SHARE_QUERY_PARAM = 's';
const SYNC_ROOM_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOME_THEME_STORAGE_KEY = 'home-theme';
const HOME_PRESET_STORAGE_KEY = 'home-preset';
const HOME_PRESET_OPTIONS_SERIOUS_KEY = 'home-preset-options-serious';
const HOME_PRESET_OPTIONS_PLAYFUL_KEY = 'home-preset-options-spielerisch';
const PRESET_UPDATED_EVENT = 'arsnova:preset-updated';

interface LearningObjectiveYjsOperation {
  schemaVersion: 1;
  operationId: string;
  quizId: string;
  objectiveId: string;
  kind: 'upsert' | 'delete';
  expectedRevision: number | null;
  resultingRevision: number;
  bundleResultRevision: number;
  parentOperationIds: string[];
  writtenAt: string;
  objective?: QuizLearningObjectiveV1;
}

interface PendingInitialLearningObjectiveOperation {
  operation: LearningObjectiveYjsOperation;
  baseFingerprint: string | null;
}

export interface QuizLearningObjectiveSyncAlternative {
  operationId: string;
  kind: 'upsert' | 'delete';
  objective: QuizLearningObjectiveV1 | null;
}

export interface QuizLearningObjectiveSyncConflict {
  quizId: string;
  objectiveId: string;
  revision: number;
  headOperationIds: string[];
  alternatives: QuizLearningObjectiveSyncAlternative[];
}

interface MaterializedLearningObjectiveOperations {
  bundle: QuizLearningObjectiveBundleV1;
  conflicts: QuizLearningObjectiveSyncConflict[];
  operationsByObjective: Map<string, LearningObjectiveYjsOperation[]>;
  highestOperationsByObjective: Map<string, LearningObjectiveYjsOperation[]>;
  malformed: boolean;
}

const QuizMetadataSchema = CreateQuizInputSchema.pick({
  name: true,
  description: true,
  motifImageUrl: true,
  motifImageCredit: true,
});

const QuizSettingsSchema = CreateQuizInputSchema.pick({
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: true,
  timerScaleByDifficulty: true,
  enableTimerAccommodation: true,
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
});

function getLocalQuestionValidationIssues(
  value: QuestionCreateData,
): Array<{ path: Array<string | number>; message: string }> {
  const issues: Array<{ path: Array<string | number>; message: string }> = [];
  const normalizedRatingLabelMin = normalizeNullableLabel(value.ratingLabelMin);
  const normalizedRatingLabelMax = normalizeNullableLabel(value.ratingLabelMax);
  const hasConfidenceConfig =
    value.confidenceEnabled === true ||
    normalizeNullableLabel(value.confidenceLabelLow) !== undefined ||
    normalizeNullableLabel(value.confidenceLabelHigh) !== undefined;
  const hasRatingConfig =
    value.ratingMin !== undefined ||
    value.ratingMax !== undefined ||
    normalizedRatingLabelMin !== undefined ||
    normalizedRatingLabelMax !== undefined;
  const hasShortTextConfig =
    value.shortTextEvaluationKind !== undefined ||
    value.shortTextMaxLength !== undefined ||
    value.shortTextCaseSensitive !== undefined ||
    value.shortTextEvaluationMode !== undefined ||
    value.shortTextToleranceLevel !== undefined ||
    value.shortTextAllowPartialCredit !== undefined ||
    value.shortTextTrimWhitespace !== undefined ||
    value.shortTextNormalizeWhitespace !== undefined ||
    value.numericInputKind !== undefined ||
    value.numericToleranceMode !== undefined ||
    value.numericAbsoluteTolerance !== undefined ||
    value.numericRelativeTolerancePercent !== undefined ||
    value.numericUnitFamily !== undefined ||
    value.numericRequireUnit !== undefined ||
    value.numericAcceptEquivalentUnits !== undefined;
  const hasMatchingConfig =
    value.matchingPairs !== undefined || value.matchingShuffleRight !== undefined;
  const hasOrderingConfig = value.orderingItems !== undefined;
  const hasCategorizationConfig =
    value.categories !== undefined ||
    value.categorizationItems !== undefined ||
    value.categorizationShuffleItems !== undefined;

  if (value.type !== 'RATING' && hasRatingConfig) {
    issues.push({
      path: ['ratingMin'],
      message: $localize`Rating-Grenzen sind nur für Rating-Fragen erlaubt.`,
    });
  }

  if (!questionSupportsConfidence(value.type) && hasConfidenceConfig) {
    issues.push({
      path: ['confidenceEnabled'],
      message: $localize`:@@quizEdit.confidenceConfigTypeError:Selbsteinschätzung ist nur für bewertbare Fragen erlaubt.`,
    });
  }

  if (value.type === 'NUMERIC_ESTIMATE') {
    return issues; // Validierung der numerischen Felder erfolgt im Editor
  }

  if (value.type !== 'SHORT_TEXT' && hasShortTextConfig) {
    issues.push({
      path: ['shortTextMaxLength'],
      message: $localize`:@@quizEdit.shortTextConfigTypeError:Kurzantwort-Einstellungen sind nur für Kurzantwort-Fragen erlaubt.`,
    });
  }

  if (value.type === 'FREETEXT') {
    if (value.answers.length > 0) {
      issues.push({
        path: ['answers'],
        message: $localize`Freitext-Fragen dürfen keine Antwortoptionen enthalten.`,
      });
    }
    return issues;
  }

  if (value.type === 'SHORT_TEXT') {
    if (value.answers.length < 1) {
      issues.push({
        path: ['answers'],
        message: $localize`:@@quizEdit.shortTextSolutionsRequired:Kurzantwort-Fragen brauchen mindestens eine Musterlösung.`,
      });
      return issues;
    }

    if (usesNumericShortTextEvaluation(value.shortTextEvaluationKind)) {
      return issues;
    }

    const seenSolutions = new Set<string>();
    const shortTextSettings = resolveQuestionShortTextSettings({
      type: value.type,
      shortTextEvaluationKind: value.shortTextEvaluationKind,
      shortTextMaxLength: value.shortTextMaxLength,
      shortTextCaseSensitive: value.shortTextCaseSensitive,
      shortTextEvaluationMode: value.shortTextEvaluationMode,
      shortTextToleranceLevel: value.shortTextToleranceLevel,
      shortTextAllowPartialCredit: value.shortTextAllowPartialCredit,
      shortTextTrimWhitespace: value.shortTextTrimWhitespace,
      shortTextNormalizeWhitespace: value.shortTextNormalizeWhitespace,
      numericInputKind: value.numericInputKind,
      numericToleranceMode: value.numericToleranceMode,
      numericAbsoluteTolerance: value.numericAbsoluteTolerance,
      numericRelativeTolerancePercent: value.numericRelativeTolerancePercent,
      numericUnitFamily: value.numericUnitFamily,
      numericRequireUnit: value.numericRequireUnit,
      numericAcceptEquivalentUnits: value.numericAcceptEquivalentUnits,
    });

    for (const [index, answer] of value.answers.entries()) {
      if (!answer.isCorrect) {
        issues.push({
          path: ['answers', index, 'isCorrect'],
          message: $localize`:@@quizEdit.shortTextSolutionsAlwaysValid:Musterlösungen sind immer gültige Lösungen.`,
        });
      }

      const normalized = normalizeShortTextValue(answer.text, {
        caseSensitive: shortTextSettings.shortTextCaseSensitive ?? false,
        maxLength: shortTextSettings.shortTextMaxLength,
        trimWhitespace: shortTextSettings.shortTextTrimWhitespace ?? true,
        normalizeWhitespace: shortTextSettings.shortTextNormalizeWhitespace ?? true,
      });
      if (seenSolutions.has(normalized)) {
        issues.push({
          path: ['answers', index, 'text'],
          message: $localize`:@@quizEdit.shortTextDuplicateSolutions:Doppelte Musterlösungen sind nicht erlaubt.`,
        });
      }
      seenSolutions.add(normalized);
    }

    return issues;
  }

  if (value.type === 'RATING') {
    if (value.answers.length > 0) {
      issues.push({
        path: ['answers'],
        message: $localize`Rating-Fragen dürfen keine Antwortoptionen enthalten.`,
      });
    }

    const min = value.ratingMin ?? 1;
    const max = value.ratingMax ?? 5;

    if (min !== 1) {
      issues.push({
        path: ['ratingMin'],
        message: 'Das Rating-Minimum muss 1 sein.',
      });
    }

    if (max !== 5 && max !== 10) {
      issues.push({
        path: ['ratingMax'],
        message: 'Das Rating-Maximum muss 5 oder 10 sein.',
      });
    }

    if (max <= min) {
      issues.push({
        path: ['ratingMax'],
        message: $localize`Das Rating-Maximum muss größer als das Minimum sein.`,
      });
    }

    return issues;
  }

  if (value.type === 'MATCHING') {
    if (hasOrderingConfig || hasCategorizationConfig || hasShortTextConfig) {
      issues.push({
        path: ['matchingPairs'],
        message: $localize`Zuordnungsfragen erlauben nur Zuordnungs-Konfiguration.`,
      });
    }
    if (value.answers.length > 0) {
      issues.push({
        path: ['answers'],
        message: $localize`Zuordnungsfragen verwenden keine Antwortoptionen.`,
      });
    }
    const pairs = value.matchingPairs ?? [];
    if (pairs.length < 2 || pairs.length > 6) {
      issues.push({
        path: ['matchingPairs'],
        message: $localize`Zuordnungsfragen benötigen 2 bis 6 Paare.`,
      });
      return issues;
    }
    const lefts = new Set<string>();
    const rights = new Set<string>();
    const leftIds = new Set<string>();
    const rightIds = new Set<string>();
    for (const [index, pair] of pairs.entries()) {
      const left = pair.left.trim();
      const right = pair.right.trim();
      if (lefts.has(left)) {
        issues.push({
          path: ['matchingPairs', index, 'left'],
          message: $localize`Linke Begriffe müssen eindeutig sein.`,
        });
      }
      if (rights.has(right)) {
        issues.push({
          path: ['matchingPairs', index, 'right'],
          message: $localize`Rechte Begriffe müssen eindeutig sein.`,
        });
      }
      if (leftIds.has(pair.leftId) || rightIds.has(pair.rightId)) {
        issues.push({
          path: ['matchingPairs', index],
          message: $localize`Zuordnungs-IDs müssen eindeutig sein.`,
        });
      }
      lefts.add(left);
      rights.add(right);
      leftIds.add(pair.leftId);
      rightIds.add(pair.rightId);
    }
    return issues;
  }

  if (value.type === 'ORDERING') {
    if (hasMatchingConfig || hasCategorizationConfig || hasShortTextConfig) {
      issues.push({
        path: ['orderingItems'],
        message: $localize`Reihenfolgefragen erlauben nur Reihenfolge-Konfiguration.`,
      });
    }
    if (value.answers.length > 0) {
      issues.push({
        path: ['answers'],
        message: $localize`Reihenfolgefragen verwenden keine Antwortoptionen.`,
      });
    }
    const items = value.orderingItems ?? [];
    if (items.length < 3 || items.length > 8) {
      issues.push({
        path: ['orderingItems'],
        message: $localize`Reihenfolgefragen benötigen 3 bis 8 Elemente.`,
      });
      return issues;
    }
    const ids = new Set<string>();
    const texts = new Set<string>();
    for (const [index, item] of items.entries()) {
      const text = item.text.trim();
      if (texts.has(text)) {
        issues.push({
          path: ['orderingItems', index, 'text'],
          message: $localize`Elemente müssen eindeutig sein.`,
        });
      }
      if (ids.has(item.id)) {
        issues.push({
          path: ['orderingItems', index, 'id'],
          message: $localize`Element-IDs müssen eindeutig sein.`,
        });
      }
      texts.add(text);
      ids.add(item.id);
    }
    return issues;
  }

  if (value.type === 'CATEGORIZATION') {
    if (hasMatchingConfig || hasOrderingConfig || hasShortTextConfig) {
      issues.push({
        path: ['categories'],
        message: $localize`Kategorisierungsfragen erlauben nur Kategorisierungs-Konfiguration.`,
      });
    }
    if (value.answers.length > 0) {
      issues.push({
        path: ['answers'],
        message: $localize`Kategorisierungsfragen verwenden keine Antwortoptionen.`,
      });
    }
    const categories = value.categories ?? [];
    const categorizationItems = value.categorizationItems ?? [];
    if (categories.length < 2 || categories.length > 4) {
      issues.push({
        path: ['categories'],
        message: $localize`Kategorisierungsfragen benötigen 2 bis 4 Kategorien.`,
      });
    }
    if (categorizationItems.length < 4 || categorizationItems.length > 12) {
      issues.push({
        path: ['categorizationItems'],
        message: $localize`Kategorisierungsfragen benötigen 4 bis 12 Elemente.`,
      });
      return issues;
    }
    const categoryIds = new Set(categories.map((category) => category.id));
    const categoryNames = new Set<string>();
    if (categoryIds.size !== categories.length) {
      issues.push({
        path: ['categories'],
        message: $localize`Kategorie-IDs müssen eindeutig sein.`,
      });
    }
    for (const [index, category] of categories.entries()) {
      const name = category.name.trim();
      if (categoryNames.has(name)) {
        issues.push({
          path: ['categories', index, 'name'],
          message: $localize`:@@quizEdit.duplicateCategoryNames:Kategorienamen müssen eindeutig sein.`,
        });
      }
      categoryNames.add(name);
    }
    const itemTexts = new Set<string>();
    const itemIds = new Set<string>();
    for (const [index, item] of categorizationItems.entries()) {
      const text = item.text.trim();
      if (itemTexts.has(text)) {
        issues.push({
          path: ['categorizationItems', index, 'text'],
          message: $localize`Elemente müssen eindeutig sein.`,
        });
      }
      if (itemIds.has(item.id)) {
        issues.push({
          path: ['categorizationItems', index, 'id'],
          message: $localize`Element-IDs müssen eindeutig sein.`,
        });
      }
      itemTexts.add(text);
      itemIds.add(item.id);
      if (!categoryIds.has(item.correctCategoryId)) {
        issues.push({
          path: ['categorizationItems', index, 'correctCategoryId'],
          message: $localize`Zielkategorie muss existieren.`,
        });
      }
    }
    return issues;
  }

  if (hasMatchingConfig || hasOrderingConfig || hasCategorizationConfig) {
    issues.push({
      path: ['type'],
      message: $localize`Matching-/Reihenfolge-/Kategorisierungs-Konfiguration ist für diesen Fragetyp nicht erlaubt.`,
    });
  }

  if (value.answers.length < 2) {
    issues.push({
      path: ['answers'],
      message: 'Mindestens zwei Antwortoptionen sind erforderlich.',
    });
    return issues;
  }

  const correctCount = value.answers.filter((answer) => answer.isCorrect).length;
  if (value.type === 'SURVEY' && correctCount > 0) {
    issues.push({
      path: ['answers'],
      message: $localize`Umfrage-Fragen dürfen keine korrekten Antworten markieren.`,
    });
  }

  if (value.type === 'SINGLE_CHOICE' && correctCount !== 1) {
    issues.push({
      path: ['answers'],
      message: 'Bei Single Choice muss genau eine Antwort korrekt sein.',
    });
  }

  if (value.type === 'MULTIPLE_CHOICE' && correctCount < 1) {
    issues.push({
      path: ['answers'],
      message: 'Bei Multiple Choice muss mindestens eine Antwort korrekt sein.',
    });
  }

  return issues;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_QUIZ_HISTORY_ACCESS_PROOF_PATTERN = /^[a-f0-9]{64}$/i;

const DEFAULT_QUIZ_SETTINGS: QuizSettings = parseQuizSettings({});
type SyncConnectionState = 'connected' | 'connecting' | 'disconnected';
export type LibrarySharingMode = 'local' | 'shared';

export const DEMO_QUIZ_ID = DEMO_QUIZ_HISTORY_SCOPE_ID;

/**
 * Erwarteter Demo-Seed aus Showcase-JSON (Locale + Version + Payload-Hash). Alte Keys
 * `arsnova-demo-quiz-locale-v1/v2` allein reichen nicht, wenn der gespeicherte
 * Quiz-Datensatz von der URL-Sprache oder dem aktuellen Demo-Inhalt abweicht.
 */
const DEMO_QUIZ_SEED_FINGERPRINT_KEY = 'arsnova-demo-quiz-seed-fp-v1';
const DEMO_QUIZ_USER_MODIFIED_KEY_PREFIX = 'arsnova-demo-quiz-user-modified-v1';

function demoQuizMatchesSeedPayload(document: QuizDocument, payload: unknown): boolean {
  const payloadQuestions =
    payload && typeof payload === 'object'
      ? (payload as { quiz?: { questions?: unknown[] } }).quiz?.questions
      : undefined;
  if (!Array.isArray(payloadQuestions)) return false;

  const numericEstimateMatches = (
    actual: QuizDocument['questions'][number],
    expected: Record<string, unknown>,
  ): boolean => {
    const expectedMode = resolveNumericEstimateToleranceMode(
      readStringOrNull(expected['numericToleranceMode']),
    );
    if (actual.numericToleranceMode !== expectedMode) return false;

    const expectedReference = readNumberOrNull(expected['numericReferenceValue']);
    if (expectedReference === null || expectedReference === undefined) return false;
    if (actual.numericReferenceValue !== expectedReference) return false;

    if (expectedMode === 'ABSOLUTE_INTERVAL') {
      const expectedLeft = readNumberOrNull(expected['numericIntervalLeft']);
      const expectedRight = readNumberOrNull(expected['numericIntervalRight']);
      if (expectedLeft === null || expectedLeft === undefined) return false;
      if (expectedRight === null || expectedRight === undefined) return false;
      if (actual.numericIntervalLeft !== expectedLeft) return false;
      if (actual.numericIntervalRight !== expectedRight) return false;
    } else {
      const expectedPercent = readNumberOrNull(expected['numericTolerancePercent']);
      if (expectedPercent === null || expectedPercent === undefined) return false;
      if (actual.numericTolerancePercent !== expectedPercent) return false;
    }

    const expectedInputType = readStringOrNull(expected['numericInputType']);
    if (expectedInputType !== null && expectedInputType !== undefined) {
      if (actual.numericInputType !== expectedInputType) return false;
    }

    const expectedDecimalPlaces = readNumberOrNull(expected['numericDecimalPlaces']);
    if (
      expectedDecimalPlaces !== null &&
      expectedDecimalPlaces !== undefined &&
      actual.numericDecimalPlaces !== expectedDecimalPlaces
    ) {
      return false;
    }

    const expectedMin = readNumberOrNull(expected['numericMin']);
    if (expectedMin !== null && expectedMin !== undefined && actual.numericMin !== expectedMin) {
      return false;
    }

    const expectedMax = readNumberOrNull(expected['numericMax']);
    if (expectedMax !== null && expectedMax !== undefined && actual.numericMax !== expectedMax) {
      return false;
    }

    const expectedTwoRounds = readBoolean(expected['numericTwoRounds']);
    if (expectedTwoRounds !== undefined && actual.numericTwoRounds !== expectedTwoRounds) {
      return false;
    }

    return true;
  };

  if (document.questions.length !== payloadQuestions.length) return false;
  for (let index = 0; index < payloadQuestions.length; index += 1) {
    const expectedQuestion = payloadQuestions[index];
    const actualQuestion = document.questions[index];
    if (!expectedQuestion || typeof expectedQuestion !== 'object' || !actualQuestion) {
      return false;
    }

    const expectedQuestionRecord = expectedQuestion as Record<string, unknown>;
    const expectedType = expectedQuestionRecord['type'];
    if (actualQuestion.type !== expectedType || actualQuestion.order !== index) {
      return false;
    }

    if (
      expectedType === 'NUMERIC_ESTIMATE' &&
      !numericEstimateMatches(actualQuestion, expectedQuestionRecord)
    ) {
      return false;
    }
  }

  return true;
}

@Injectable({ providedIn: 'root' })
export class QuizStoreService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly quizDocuments = signal<QuizDocument[]>([]);
  private readonly learningObjectiveBundles = signal<
    Readonly<Record<string, QuizLearningObjectiveBundleV1>>
  >({});
  readonly syncRoomId = signal('');
  readonly syncConnectionState = signal<SyncConnectionState>('disconnected');
  readonly librarySharingMode = signal<LibrarySharingMode>('local');
  /** Signiertes Share-Token für den Yjs-Relay (nie loggen). */
  readonly syncShareToken = signal<string | null>(null);
  /** True, wenn dieses Gerät die Rotations-Capability hält (Ursprung). */
  readonly canInvalidateSyncLink = signal(false);
  /** Origin-Share-Registrierung: pending bis Token da ist; Copy erst bei ready. */
  readonly syncShareStatus = signal<'idle' | 'pending' | 'ready' | 'error' | 'legacy'>('idle');
  readonly syncShareError = signal<string | null>(null);
  readonly lastConnectedAt = signal<string | null>(null);
  readonly lastLocalChangeAt = signal<string | null>(null);
  readonly lastRemoteSyncAt = signal<string | null>(null);
  readonly lastRemoteChangedQuizName = signal<string | null>(null);
  readonly lastRemoteChangedQuizUpdatedAt = signal<string | null>(null);
  readonly lastRemoteChangedByDeviceLabel = signal<string | null>(null);
  readonly lastRemoteChangedByBrowserLabel = signal<string | null>(null);
  readonly originSharedAt = signal<string | null>(null);
  readonly originDeviceLabel = signal<string | null>(null);
  readonly originBrowserLabel = signal<string | null>(null);
  readonly currentDeviceLabel = signal('Dieses Gerät');
  readonly currentBrowserLabel = signal('');
  readonly syncPeerInfos = signal<SyncPeerInfo[]>([]);
  private yDoc: YDoc | null = null;
  private yRoot: YMapDoc<string> | null = null;
  private yLearningObjectivesRoot: YMapDoc<string> | null = null;
  private yPersistence: IndexedDbPersistenceInstance | null = null;
  private pendingImportedPersistenceSyncTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private yProvider: WebsocketProviderInstance | null = null;
  private yjsModulePromise: Promise<YjsModule> | null = null;
  private indexedDbPersistencePromise: Promise<IndexedDbPersistenceCtor> | null = null;
  private websocketProviderPromise: Promise<WebsocketProviderCtor> | null = null;
  private securedShareCreationPromise: Promise<string> | null = null;
  private pendingImportedShareToken: {
    roomId: string;
    token: string;
    previousToken: string | null;
  } | null = null;
  private pendingImportedQuizRestore: {
    roomId: string;
    baselineSerialized: string;
    latestSerialized: string;
    persistenceStarted: boolean;
    persistenceSynced: boolean;
    providerSynced: boolean;
    providerPresetSerialized: string | null;
    providerSerialized: string | null;
  } | null = null;
  private yjsInitGeneration = 0;
  private yjsProviderAttachGeneration = 0;
  private hostLibraryStarted = false;
  /** Absichern als Origin nur nach explizitem secureAsOrigin (nie aus fehlendem Share-Token). */
  private pendingSecureAsOrigin = false;
  private isApplyingYjsSnapshot = false;
  private hasStoredSyncRoomId = false;
  private lastSerializedQuizDocuments = '[]';
  private lastSerializedRoomId = '';
  private lastSerializedLearningObjectives = '[]';
  private lastSerializedLearningObjectivesRoomId = '';
  private malformedLearningObjectiveKeys = new Set<string>();
  private isWritingYjsSnapshot = false;
  private learningObjectiveYjsRestoreRoomId: string | null = null;
  private learningObjectiveYjsRestorePending = false;
  private pendingInitialLearningObjectiveMirror: Record<
    string,
    QuizLearningObjectiveBundleV1
  > | null = null;
  private pendingInitialLearningObjectiveOperations: PendingInitialLearningObjectiveOperation[] =
    [];
  private readonly pendingLearningObjectiveDeleteSettlements = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private pendingSyncMetadataRoomId: string | null = null;
  private pendingSyncMetadataSnapshot: SyncMetadataSnapshot | null = null;
  private hasPendingSyncMetadataFlush = false;
  private readonly currentSyncDeviceId = this.resolveCurrentSyncDeviceId();
  private readonly localeId = inject(LOCALE_ID);
  private readonly router = inject(Router);
  private routerEventsSub: Subscription | null = null;
  private readonly onPresetUpdated = (): void => {
    this.writePresetSnapshotToYjs();
  };
  private readonly onStorageChanged = (event: StorageEvent): void => {
    const roomId = this.syncRoomId();
    if (
      event.key !== this.shareTokenStorageKey(roomId) ||
      !event.newValue ||
      (event.storageArea && event.storageArea !== localStorage)
    ) {
      return;
    }
    const changed = this.acceptShareTokenMonotonically(roomId, event.newValue, 'storage');
    if (changed) {
      this.teardownYjsProvider();
      void this.attachYjsWebSocketProviderIfNeeded(this.yjsInitGeneration, roomId);
    }
  };

  readonly quizzes: Signal<QuizSummary[]> = computed(() =>
    this.quizDocuments().map((quiz) => ({
      id: quiz.id,
      name: quiz.name,
      description: quiz.description,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      questionCount: quiz.questions.length,
      teamMode: quiz.settings.teamMode === true,
      hasBonus:
        quiz.settings.bonusTokenCount !== null &&
        quiz.settings.bonusTokenCount !== undefined &&
        quiz.settings.bonusTokenCount > 0,
      lastServerQuizId: quiz.lastServerQuizId ?? null,
      lastServerQuizAccessProof: quiz.lastServerQuizAccessProof ?? null,
    })),
  );

  /** Warning produced while preparing a live upload with omitted learning objectives. */
  readonly uploadLearningObjectiveWarning = signal<string | null>(null);
  /** Concurrent same-revision CRDT branches retained until a deliberate next revision resolves them. */
  readonly learningObjectiveSyncConflicts = signal<QuizLearningObjectiveSyncConflict[]>([]);
  /** Corrupt or over-limit sidecars stay untouched and keep the last validated local snapshot. */
  readonly learningObjectiveSyncError = signal<string | null>(null);

  constructor() {
    const roomId = this.resolveInitialSyncRoomId();
    const currentClient = readCurrentSyncClientPresence();
    this.currentDeviceLabel.set(currentClient.deviceLabel);
    this.currentBrowserLabel.set(currentClient.browserLabel);
    this.librarySharingMode.set(this.resolveInitialLibrarySharingMode());
    this.syncRoomId.set(roomId);
    this.loadSyncMetadata(roomId);
    this.loadShareSecrets(roomId);
    if (this.librarySharingMode() === 'shared') {
      this.syncShareStatus.set(this.syncShareToken() ? 'ready' : 'legacy');
    }
    if (this.shouldRestoreHostLibraryImmediately()) {
      this.ensureHostLibraryReady();
    }
  }

  /**
   * Startet Demo, lokale Persistenz und Yjs erst bei Hostabsicht oder vorhandener Bibliothek.
   * Der reine Teilnahmeweg auf der Startseite bleibt davon unberührt.
   */
  ensureHostLibraryReady(): void {
    if (this.hostLibraryStarted) {
      return;
    }
    this.hostLibraryStarted = true;
    let roomId = this.syncRoomId().trim();
    if (!roomId) {
      roomId = this.resolveInitialSyncRoomId();
      this.syncRoomId.set(roomId);
      this.loadSyncMetadata(roomId);
      this.loadShareSecrets(roomId);
    }
    const allowLegacyFallback = !this.hasStoredSyncRoomId;
    if (isPlatformBrowser(this.platformId) && !this.hasStoredSyncRoomId) {
      this.storeSyncRoomId(roomId);
      this.hasStoredSyncRoomId = true;
    }
    this.loadFromStorage(roomId, allowLegacyFallback);
    this.ensureDemoQuiz();
    void this.initYjsPersistence(roomId);
    this.attachHostLibraryBrowserListeners();
  }

  private attachHostLibraryBrowserListeners(): void {
    if (!isPlatformBrowser(this.platformId) || this.routerEventsSub) {
      return;
    }
    globalThis.addEventListener(PRESET_UPDATED_EVENT, this.onPresetUpdated);
    globalThis.addEventListener('storage', this.onStorageChanged);
    this.routerEventsSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.ensureDemoQuiz();
      });
  }

  private shouldRestoreHostLibraryImmediately(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    if (this.hasStoredSyncRoomId || this.librarySharingMode() === 'shared') {
      return true;
    }
    try {
      const storedLibrary = localStorage.getItem(QUIZ_STORAGE_KEY);
      if (storedLibrary && storedLibrary !== '[]') {
        return true;
      }
    } catch {
      return false;
    }
    return this.hasExplicitSyncLink();
  }

  private hasExplicitSyncLink(): boolean {
    try {
      const params = new URLSearchParams(globalThis.location?.search ?? '');
      return params.has('sync') || params.has('room') || params.has('share');
    } catch {
      return false;
    }
  }

  ngOnDestroy(): void {
    this.routerEventsSub?.unsubscribe();
    this.routerEventsSub = null;
    if (isPlatformBrowser(this.platformId)) {
      globalThis.removeEventListener(PRESET_UPDATED_EVENT, this.onPresetUpdated);
      globalThis.removeEventListener('storage', this.onStorageChanged);
    }
    this.teardownYjs();
  }

  getDemoQuizId(): string | null {
    return this.getQuizById(DEMO_QUIZ_ID) ? DEMO_QUIZ_ID : null;
  }

  learningObjectivesForQuiz(quizId: string): Signal<QuizLearningObjectiveBundleV1> {
    return computed(
      () =>
        this.learningObjectiveBundles()[quizId] ?? {
          schemaVersion: 1,
          quizId,
          revision: 0,
          objectives: [],
        },
    );
  }

  getLearningObjectiveBundle(quizId: string): QuizLearningObjectiveBundleV1 {
    return (
      this.learningObjectiveBundles()[quizId] ?? {
        schemaVersion: 1,
        quizId,
        revision: 0,
        objectives: [],
      }
    );
  }

  saveQuizLearningObjective(
    quizId: string,
    input: SaveQuizLearningObjectiveInput,
    options?: { objectiveId?: string; expectedRevision?: number },
  ): QuizLearningObjectiveV1 {
    const quiz = this.quizDocuments().find((candidate) => candidate.id === quizId);
    if (!quiz) {
      throw new Error($localize`:@@learningObjectives.quizMissing:Quiz nicht gefunden.`);
    }

    const bundle = this.getLearningObjectiveBundle(quizId);
    if (
      options?.objectiveId &&
      this.learningObjectiveSyncConflicts().some(
        (conflict) => conflict.quizId === quizId && conflict.objectiveId === options.objectiveId,
      )
    ) {
      throw new Error(
        $localize`:@@learningObjectives.syncConflictMustResolve:Wähle zuerst bewusst eine der synchronisierten Fassungen aus.`,
      );
    }
    const existing = options?.objectiveId
      ? bundle.objectives.find((objective) => objective.id === options.objectiveId)
      : undefined;
    if (options?.objectiveId && !existing) {
      throw new Error($localize`:@@learningObjectives.objectiveMissing:Lernziel nicht gefunden.`);
    }
    if (existing && options?.expectedRevision === undefined) {
      throw new Error(
        $localize`:@@learningObjectives.expectedRevisionRequired:Änderungen an einem Lernziel benötigen den geladenen Revisionsstand.`,
      );
    }
    if (
      existing &&
      options?.expectedRevision !== undefined &&
      existing.revision !== options.expectedRevision
    ) {
      throw new Error(
        $localize`:@@learningObjectives.localConflict:Das Lernziel wurde inzwischen geändert. Lade den aktuellen Stand und versuche es erneut.`,
      );
    }

    const now = monotoneLearningObjectiveTimestamp(existing);
    const revision = existing ? existing.revision + 1 : 1;
    const knownQuestionIds = new Set(quiz.questions.map((question) => question.id));
    const hasMissingScopeReference =
      input.scope.kind === 'question-set' &&
      input.scope.sourceQuestionIds.some((id) => !knownQuestionIds.has(id));
    const hasMissingDerivationReference =
      existing?.origin.kind === 'model-derived' &&
      existing.origin.derivedFromSourceQuestionIds.some((id) => !knownQuestionIds.has(id));
    const hasMissingReference = hasMissingScopeReference || hasMissingDerivationReference;
    if (hasMissingReference && input.confirmationState === 'confirmed') {
      throw new Error(
        $localize`:@@learningObjectives.missingScopeCannotConfirm:Ein Lernziel mit fehlendem Aufgabenverweis kann nicht bestätigt werden.`,
      );
    }
    const previousConfirmation = existing
      ? existing.confirmation.state === 'needs-review'
        ? existing.confirmation.previousConfirmation
        : existing.confirmation.state === 'confirmed'
          ? {
              state: 'confirmed' as const,
              revision: existing.confirmation.confirmedRevision,
              confirmedAt: existing.confirmation.confirmedAt,
            }
          : { state: 'draft' as const, revision: existing.revision }
      : { state: 'draft' as const, revision: 0 };
    const objective: QuizLearningObjectiveV1 = {
      id: existing?.id ?? generateUuid(),
      revision,
      text: input.text.trim(),
      scope: input.scope,
      origin: existing?.origin ?? { kind: 'manual' },
      confirmation: hasMissingReference
        ? {
            state: 'needs-review',
            previousConfirmation,
            currentRevision: revision,
            reason: 'source-reference-removed',
          }
        : input.confirmationState === 'confirmed'
          ? { state: 'confirmed', confirmedAt: now, confirmedRevision: revision }
          : { state: 'draft' },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const nextBundle = QuizLearningObjectiveBundleV1Schema.parse({
      ...bundle,
      revision: bundle.revision + 1,
      objectives: existing
        ? bundle.objectives.map((candidate) =>
            candidate.id === objective.id ? objective : candidate,
          )
        : [...bundle.objectives, objective],
    });
    this.malformedLearningObjectiveKeys.delete(quizId);
    this.learningObjectiveBundles.update((current) => ({ ...current, [quizId]: nextBundle }));
    this.markDemoQuizUserModified(quizId);
    this.persistToStorage();
    return objective;
  }

  deleteQuizLearningObjective(quizId: string, objectiveId: string, expectedRevision: number): void {
    if (
      this.learningObjectiveSyncConflicts().some(
        (conflict) => conflict.quizId === quizId && conflict.objectiveId === objectiveId,
      )
    ) {
      throw new Error(
        $localize`:@@learningObjectives.syncConflictMustResolve:Wähle zuerst bewusst eine der synchronisierten Fassungen aus.`,
      );
    }
    const bundle = this.getLearningObjectiveBundle(quizId);
    const objective = bundle.objectives.find((candidate) => candidate.id === objectiveId);
    if (!objective) {
      throw new Error($localize`:@@learningObjectives.objectiveMissing:Lernziel nicht gefunden.`);
    }
    if (objective.revision !== expectedRevision) {
      throw new Error(
        $localize`:@@learningObjectives.localConflict:Das Lernziel wurde inzwischen geändert. Lade den aktuellen Stand und versuche es erneut.`,
      );
    }
    const nextBundle = QuizLearningObjectiveBundleV1Schema.parse({
      ...bundle,
      revision: bundle.revision + 1,
      objectives: bundle.objectives.filter((candidate) => candidate.id !== objectiveId),
    });
    this.malformedLearningObjectiveKeys.delete(quizId);
    this.learningObjectiveBundles.update((current) => ({ ...current, [quizId]: nextBundle }));
    this.markDemoQuizUserModified(quizId);
    this.persistToStorage();
  }

  resolveQuizLearningObjectiveSyncConflict(
    quizId: string,
    objectiveId: string,
    operationId: string,
  ): void {
    const conflict = this.learningObjectiveSyncConflicts().find(
      (candidate) => candidate.quizId === quizId && candidate.objectiveId === objectiveId,
    );
    const alternative = conflict?.alternatives.find(
      (candidate) => candidate.operationId === operationId,
    );
    if (!conflict || !alternative) {
      throw new Error(
        $localize`:@@learningObjectives.syncConflictGone:Der Synchronisierungskonflikt ist nicht mehr aktuell. Prüfe den neuesten Stand.`,
      );
    }
    const bundle = this.getLearningObjectiveBundle(quizId);
    const nextRevision = conflict.revision + 1;
    if (nextRevision > LEARNING_OBJECTIVE_REVISION_MAX) {
      throw new Error(
        $localize`:@@learningObjectives.revisionLimit:Dieses Lernziel hat die maximale Revisionszahl erreicht.`,
      );
    }
    const now = monotoneLearningObjectiveTimestamp(alternative.objective ?? undefined);
    const chosen = alternative.objective
      ? {
          ...alternative.objective,
          revision: nextRevision,
          updatedAt: now,
          confirmation:
            alternative.objective.confirmation.state === 'confirmed'
              ? {
                  state: 'confirmed' as const,
                  confirmedAt: now,
                  confirmedRevision: nextRevision,
                }
              : alternative.objective.confirmation.state === 'needs-review'
                ? {
                    ...alternative.objective.confirmation,
                    currentRevision: nextRevision,
                  }
                : { state: 'draft' as const },
        }
      : null;
    const withoutConflicted = bundle.objectives.filter((objective) => objective.id !== objectiveId);
    const nextBundle = QuizLearningObjectiveBundleV1Schema.parse({
      ...bundle,
      revision: Math.max(bundle.revision, conflict.revision) + 1,
      objectives: chosen ? [...withoutConflicted, chosen] : withoutConflicted,
    });
    const operationMap = this.learningObjectiveOperationMap(quizId);
    if (!operationMap || !this.yDoc || !this.yLearningObjectivesRoot) {
      throw new Error(
        $localize`:@@learningObjectives.syncUnavailable:Der Synchronisierungsstand ist nicht verfügbar. Versuche es nach dem erneuten Verbinden noch einmal.`,
      );
    }
    const resolutionOperationId = generateUuid();
    const resolution: LearningObjectiveYjsOperation = {
      schemaVersion: 1,
      operationId: resolutionOperationId,
      quizId,
      objectiveId,
      kind: chosen ? 'upsert' : 'delete',
      expectedRevision: conflict.revision,
      resultingRevision: nextRevision,
      bundleResultRevision: nextBundle.revision,
      parentOperationIds: [...conflict.headOperationIds].sort(),
      writtenAt: now,
      ...(chosen ? { objective: chosen } : {}),
    };
    this.isWritingYjsSnapshot = true;
    try {
      this.yDoc.transact(() => {
        if (!this.appendLearningObjectiveOperation(operationMap, resolution)) {
          throw new Error('learning-objective-oplog-limit');
        }
        this.yLearningObjectivesRoot!.set(quizId, QUIZ_LEARNING_OBJECTIVES_OPLOG_MARKER);
      }, this);
    } finally {
      this.isWritingYjsSnapshot = false;
    }
    this.learningObjectiveBundles.update((current) => ({ ...current, [quizId]: nextBundle }));
    this.markDemoQuizUserModified(quizId);
    this.persistToStorage();
    this.applyYjsLearningObjectivesSnapshot();
  }

  takeUploadLearningObjectiveWarning(): string | null {
    const warning = this.uploadLearningObjectiveWarning();
    this.uploadLearningObjectiveWarning.set(null);
    return warning;
  }

  private currentQuizUpdateSource(): Pick<
    QuizDocument,
    'updatedByDeviceId' | 'updatedByDeviceLabel' | 'updatedByBrowserLabel'
  > {
    return {
      updatedByDeviceId: this.currentSyncDeviceId,
      updatedByDeviceLabel: this.currentDeviceLabel(),
      updatedByBrowserLabel: this.currentBrowserLabel(),
    };
  }

  createQuiz(input: CreateQuizDocumentInput): QuizDocument {
    this.ensureHostLibraryReady();
    const parsed = QuizMetadataSchema.safeParse({
      name: input.name.trim(),
      description: normalizeDescription(input.description),
      motifImageUrl: normalizeMotifImageUrlInput(input.motifImageUrl),
      motifImageCredit: normalizeMotifImageCreditInput(input.motifImageCredit),
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? $localize`Ungültige Quiz-Daten.`;
      throw new Error(message);
    }

    const settings = parseQuizSettings(input.settings ?? {});
    const now = new Date().toISOString();
    const created: QuizDocument = {
      id: generateUuid(),
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      motifImageUrl: parsed.data.motifImageUrl ?? null,
      motifImageCredit: parsed.data.motifImageCredit ?? null,
      createdAt: now,
      updatedAt: now,
      ...this.currentQuizUpdateSource(),
      lastServerQuizId: null,
      lastServerQuizAccessProof: null,
      settings,
      questions: [],
    };

    this.quizDocuments.update((current) => [created, ...current]);
    this.persistToStorage();
    return created;
  }

  updateQuizMetadata(
    quizId: string,
    input: {
      name: string;
      description?: string | null;
      motifImageUrl?: string | null;
      motifImageCredit?: string | null;
    },
  ): QuizDocument {
    const parsed = QuizMetadataSchema.safeParse({
      name: input.name.trim(),
      description: normalizeDescription(input.description),
      motifImageUrl: normalizeMotifImageUrlInput(input.motifImageUrl),
      motifImageCredit: normalizeMotifImageCreditInput(input.motifImageCredit),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? $localize`Ungültige Quiz-Metadaten.`;
      throw new Error(message);
    }

    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }
    this.markDemoQuizUserModified(quizId);

    const updatedAt = new Date().toISOString();
    const updated: QuizDocument = {
      ...document,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      motifImageUrl: parsed.data.motifImageUrl ?? null,
      motifImageCredit: parsed.data.motifImageCredit ?? null,
      updatedAt,
      ...this.currentQuizUpdateSource(),
    };

    this.quizDocuments.update((current) =>
      current.map((quiz) => (quiz.id === quizId ? updated : quiz)),
    );
    this.persistToStorage();
    return updated;
  }

  updateQuizSettings(quizId: string, input: UpdateQuizSettingsInput): QuizSettings {
    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }
    this.markDemoQuizUserModified(quizId);

    const nextSettings = parseQuizSettings({
      ...document.settings,
      ...input,
    });
    const updatedAt = new Date().toISOString();

    this.quizDocuments.update((current) =>
      current.map((quiz) =>
        quiz.id === quizId
          ? {
              ...quiz,
              settings: nextSettings,
              updatedAt,
              ...this.currentQuizUpdateSource(),
            }
          : quiz,
      ),
    );
    this.persistToStorage();
    return nextSettings;
  }

  duplicateQuiz(quizId: string): QuizDocument {
    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }

    const now = new Date().toISOString();
    const copiedQuizId = generateUuid();
    const questionIdMap = new Map<string, string>();
    const copiedQuestions = document.questions.map((question) => {
      const copiedQuestionId = generateUuid();
      questionIdMap.set(question.id, copiedQuestionId);
      return {
        ...question,
        id: copiedQuestionId,
        answers: question.answers.map((answer) => ({
          ...answer,
          id: generateUuid(),
        })),
      };
    });
    const copy: QuizDocument = {
      ...document,
      id: copiedQuizId,
      name: buildCopyName(document.name),
      createdAt: now,
      updatedAt: now,
      ...this.currentQuizUpdateSource(),
      lastServerQuizId: null,
      lastServerQuizAccessProof: null,
      questions: copiedQuestions,
    };

    this.quizDocuments.update((current) => [copy, ...current]);
    const sourceBundle = this.learningObjectiveBundles()[quizId];
    if (sourceBundle) {
      const copiedBundle = remapLearningObjectiveBundle(
        sourceBundle,
        copiedQuizId,
        questionIdMap,
        now,
      );
      if (copiedBundle) {
        this.learningObjectiveBundles.update((current) => ({
          ...current,
          [copiedQuizId]: copiedBundle,
        }));
      }
    }
    this.persistToStorage();
    return copy;
  }

  /**
   * Nach erfolgreichem quiz.upload: Server-Quiz-ID merken (Bonus-Codes in der Sammlung).
   */
  setLastServerUploadAccess(localQuizId: string, serverQuizId: string, accessProof: string): void {
    if (!UUID_PATTERN.test(serverQuizId)) return;
    this.quizDocuments.update((current) =>
      current.map((quiz) =>
        quiz.id === localQuizId
          ? {
              ...quiz,
              lastServerQuizId: serverQuizId,
              lastServerQuizAccessProof: accessProof,
              updatedAt: new Date().toISOString(),
              ...this.currentQuizUpdateSource(),
            }
          : quiz,
      ),
    );
    this.persistToStorage();
  }

  setLastServerQuizAccessProof(localQuizId: string, accessProof: string): void {
    if (
      !UUID_PATTERN.test(localQuizId) ||
      (!UUID_PATTERN.test(accessProof) &&
        !LEGACY_QUIZ_HISTORY_ACCESS_PROOF_PATTERN.test(accessProof))
    ) {
      return;
    }

    this.quizDocuments.update((current) =>
      current.map((quiz) =>
        quiz.id === localQuizId
          ? {
              ...quiz,
              lastServerQuizAccessProof: accessProof,
            }
          : quiz,
      ),
    );
    this.persistToStorage();
  }

  deleteQuiz(quizId: string): void {
    const exists = this.quizDocuments().some((quiz) => quiz.id === quizId);
    if (!exists) {
      throw new Error('Quiz nicht gefunden.');
    }

    this.markDemoQuizUserModified(quizId);
    this.quizDocuments.update((current) => current.filter((quiz) => quiz.id !== quizId));
    this.malformedLearningObjectiveKeys.delete(quizId);
    this.learningObjectiveBundles.update((current) => {
      if (!current[quizId]) return current;
      const next = { ...current };
      delete next[quizId];
      return next;
    });
    this.persistToStorage();
  }

  exportQuiz(quizId: string): QuizExport {
    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }

    const exportPayload: QuizExport = {
      exportVersion: QUIZ_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      quiz: {
        sourceQuizId: document.id,
        name: document.name,
        ...(document.description ? { description: document.description } : {}),
        ...(document.motifImageUrl ? { motifImageUrl: document.motifImageUrl } : {}),
        ...(document.motifImageCredit ? { motifImageCredit: document.motifImageCredit } : {}),
        showLeaderboard: document.settings.showLeaderboard,
        allowCustomNicknames: document.settings.allowCustomNicknames,
        defaultTimer: document.settings.defaultTimer,
        timerScaleByDifficulty: document.settings.timerScaleByDifficulty ?? true,
        enableTimerAccommodation: document.settings.enableTimerAccommodation ?? true,
        enableSoundEffects: document.settings.enableSoundEffects,
        enableRewardEffects: document.settings.enableRewardEffects,
        enableMotivationMessages: document.settings.enableMotivationMessages,
        enableEmojiReactions: document.settings.enableEmojiReactions,
        showQuestionTypeIndicators: document.settings.showQuestionTypeIndicators,
        anonymousMode: document.settings.anonymousMode,
        teamMode: document.settings.teamMode,
        teamCount: document.settings.teamCount,
        teamAssignment: document.settings.teamAssignment,
        teamNames: document.settings.teamNames,
        backgroundMusic: document.settings.backgroundMusic,
        nicknameTheme: document.settings.nicknameTheme,
        bonusTokenCount: document.settings.bonusTokenCount,
        readingPhaseEnabled: document.settings.readingPhaseEnabled,
        learningObjectives: this.getLearningObjectiveBundle(document.id),
        questions: document.questions.map((question) => {
          const shortTextSettings = resolveQuestionShortTextSettings(question);
          return {
            sourceQuestionId: question.id,
            text: question.text,
            type: question.type,
            difficulty: question.difficulty,
            order: question.order,
            ...(typeof question.timer === 'number' ? { timer: question.timer } : {}),
            answers: question.answers.map((answer) => ({
              text: answer.text,
              isCorrect: answer.isCorrect,
            })),
            skipReadingPhase: question.skipReadingPhase,
            ratingMin: question.ratingMin,
            ratingMax: question.ratingMax,
            ratingLabelMin: question.ratingLabelMin,
            ratingLabelMax: question.ratingLabelMax,
            confidenceEnabled: question.confidenceEnabled,
            confidenceLabelLow: question.confidenceLabelLow,
            confidenceLabelHigh: question.confidenceLabelHigh,
            ...(question.type === 'SHORT_TEXT'
              ? {
                  shortTextEvaluationKind: shortTextSettings.shortTextEvaluationKind ?? undefined,
                  shortTextMaxLength: shortTextSettings.shortTextMaxLength ?? undefined,
                  shortTextCaseSensitive: shortTextSettings.shortTextCaseSensitive ?? undefined,
                  shortTextEvaluationMode: shortTextSettings.shortTextEvaluationMode ?? undefined,
                  shortTextToleranceLevel: shortTextSettings.shortTextToleranceLevel ?? undefined,
                  shortTextAllowPartialCredit:
                    shortTextSettings.shortTextAllowPartialCredit ?? undefined,
                  shortTextTrimWhitespace: shortTextSettings.shortTextTrimWhitespace ?? undefined,
                  shortTextNormalizeWhitespace:
                    shortTextSettings.shortTextNormalizeWhitespace ?? undefined,
                  numericInputKind: shortTextSettings.numericInputKind ?? undefined,
                  numericToleranceMode: shortTextSettings.numericToleranceMode ?? undefined,
                  numericAbsoluteTolerance: shortTextSettings.numericAbsoluteTolerance ?? undefined,
                  numericRelativeTolerancePercent:
                    shortTextSettings.numericRelativeTolerancePercent ?? undefined,
                  numericUnitFamily: shortTextSettings.numericUnitFamily ?? undefined,
                  numericRequireUnit: shortTextSettings.numericRequireUnit ?? undefined,
                  numericAcceptEquivalentUnits:
                    shortTextSettings.numericAcceptEquivalentUnits ?? undefined,
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
                  numericInputType: question.numericInputType ?? undefined,
                  numericDecimalPlaces: question.numericDecimalPlaces ?? undefined,
                  numericMin: question.numericMin ?? undefined,
                  numericMax: question.numericMax ?? undefined,
                  numericTwoRounds: question.numericTwoRounds ?? undefined,
                }
              : {}),
            ...(question.type === 'MATCHING'
              ? {
                  matchingPairs: question.matchingPairs ?? undefined,
                  matchingShuffleRight: question.matchingShuffleRight ?? true,
                }
              : {}),
            ...(question.type === 'ORDERING'
              ? { orderingItems: question.orderingItems ?? undefined }
              : {}),
            ...(question.type === 'CATEGORIZATION'
              ? {
                  categories: question.categories ?? undefined,
                  categorizationItems: question.categorizationItems ?? undefined,
                  categorizationShuffleItems: question.categorizationShuffleItems ?? true,
                }
              : {}),
            enabled: question.enabled !== false,
          };
        }),
      },
    };

    const parsed = QuizExportSchema.safeParse(exportPayload);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Quiz konnte nicht exportiert werden.';
      throw new Error(message);
    }
    return parsed.data;
  }

  /** Liest ein normalisiertes Quiz aus dem Browser-Spiegel (gleicher Sync-Raum). */
  private readNormalizedQuizFromLocalStorage(quizId: string): QuizDocument | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const roomId = this.syncRoomId();
    if (!roomId) return null;
    try {
      const storageKey = this.storageKeyForRoom(roomId);
      const raw =
        globalThis.localStorage.getItem(storageKey) ??
        globalThis.localStorage.getItem(QUIZ_STORAGE_LEGACY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      const entry = parsed.find(
        (item) => item && typeof item === 'object' && (item as { id?: string }).id === quizId,
      );
      if (!entry || typeof entry !== 'object') return null;
      return normalizeStoredQuiz(entry);
    } catch {
      return null;
    }
  }

  /**
   * Baut den effektiven Quiz-Datensatz für Live-Upload: Fragen/Metadaten vom neueren Stand (RAM vs. LS),
   * Namensliste/Anonymität per pickNameParticipationSettings (spezielle Themenliste gewinnt gegen Oberstufe-Standard im RAM).
   */
  private composeQuizDocumentForLiveUpload(quizId: string): QuizDocument | null {
    const memDoc = this.getQuizById(quizId);
    if (!memDoc) return null;
    const lsDoc = this.readNormalizedQuizFromLocalStorage(quizId);
    if (!lsDoc) return memDoc;
    const memT = Date.parse(memDoc.updatedAt);
    const lsT = Date.parse(lsDoc.updatedAt);
    // Live-Start darf die sichtbare Quizstruktur nicht durch einen stale/gekürzten Speicherstand verkleinern.
    const storageWouldShrinkVisibleQuiz = lsDoc.questions.length < memDoc.questions.length;
    const base =
      lsT > memT && !storageWouldShrinkVisibleQuiz
        ? { ...lsDoc, settings: { ...lsDoc.settings } }
        : { ...memDoc, settings: { ...memDoc.settings } };
    const namePick = pickNameParticipationSettings(memDoc, lsDoc);
    return {
      ...base,
      settings: {
        ...base.settings,
        ...namePick,
      },
    };
  }

  /**
   * Erzeugt das Upload-Payload für quiz.upload (Story 2.1a – Live schalten).
   * Validiert gegen QuizUploadInputSchema; wirft bei ungültigen Daten.
   */
  getUploadPayload(quizId: string): QuizUploadInput {
    this.uploadLearningObjectiveWarning.set(null);
    const document = this.composeQuizDocumentForLiveUpload(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }
    if (document.questions.length === 0) {
      throw new Error('Quiz muss mindestens eine Frage enthalten.');
    }

    const activeQuestions = [...document.questions]
      .filter((q) => q.enabled !== false)
      .sort((a, b) => a.order - b.order);

    if (activeQuestions.length === 0) {
      throw new Error(
        $localize`:@@quizStore.uploadNeedsActiveQuestion:Mindestens eine aktive Frage ist für den Live-Start nötig.`,
      );
    }

    const activeQuestionIds = new Set(activeQuestions.map((question) => question.id));
    const sourceBundle = this.learningObjectiveBundles()[quizId];
    const uploadObjectives = sourceBundle?.objectives.filter((objective) => {
      const scopedIds =
        objective.scope.kind === 'question-set' ? objective.scope.sourceQuestionIds : [];
      const derivationIds =
        objective.origin.kind === 'model-derived'
          ? objective.origin.derivedFromSourceQuestionIds
          : [];
      return [...scopedIds, ...derivationIds].every((id) => activeQuestionIds.has(id));
    });
    const omittedObjectiveCount =
      sourceBundle && uploadObjectives
        ? sourceBundle.objectives.length - uploadObjectives.length
        : 0;
    if (omittedObjectiveCount > 0) {
      this.uploadLearningObjectiveWarning.set(
        $localize`:@@learningObjectives.uploadOmitted:${omittedObjectiveCount}:count: Lernziel(e) wurden nicht live geschaltet, weil mindestens eine referenzierte Aufgabe fehlt oder deaktiviert ist.`,
      );
    }
    const uploadBundle =
      sourceBundle && uploadObjectives
        ? QuizLearningObjectiveBundleV1Schema.parse({
            ...sourceBundle,
            objectives: uploadObjectives,
          })
        : undefined;

    const UPLOAD_DESCRIPTION_MAX = 5000;
    const description =
      document.description && document.description.length > UPLOAD_DESCRIPTION_MAX
        ? document.description.slice(0, UPLOAD_DESCRIPTION_MAX - 3) + '...'
        : document.description;

    let historyScopeId = document.id;
    if (document.id === DEMO_QUIZ_ID) {
      const existingScope = document.lastServerQuizAccessProof;
      historyScopeId =
        isDemoQuizHistoryScopeId(existingScope) && existingScope !== DEMO_QUIZ_HISTORY_SCOPE_ID
          ? existingScope
          : `${DEMO_QUIZ_HISTORY_SCOPE_ID.slice(0, 4)}${generateUuid().slice(4)}`;
      if (historyScopeId !== existingScope) {
        this.setLastServerQuizAccessProof(document.id, historyScopeId);
      }
    }

    const payload: QuizUploadInput = {
      historyScopeId,
      sourceQuizId: document.id,
      name: document.name,
      ...(description ? { description } : {}),
      motifImageUrl: normalizeMotifImageUrlInput(document.motifImageUrl) ?? null,
      motifImageCredit: normalizeMotifImageCreditInput(document.motifImageCredit) ?? null,
      showLeaderboard: document.settings.showLeaderboard,
      allowCustomNicknames: document.settings.allowCustomNicknames,
      defaultTimer: document.settings.defaultTimer,
      timerScaleByDifficulty: document.settings.timerScaleByDifficulty ?? true,
      enableTimerAccommodation: document.settings.enableTimerAccommodation ?? true,
      enableSoundEffects: document.settings.enableSoundEffects,
      enableRewardEffects: document.settings.enableRewardEffects,
      enableMotivationMessages: document.settings.enableMotivationMessages,
      enableEmojiReactions: document.settings.enableEmojiReactions,
      showQuestionTypeIndicators: document.settings.showQuestionTypeIndicators,
      anonymousMode: document.settings.anonymousMode,
      teamMode: document.settings.teamMode,
      teamCount: document.settings.teamCount ?? undefined,
      teamAssignment: document.settings.teamAssignment,
      teamNames: document.settings.teamNames,
      backgroundMusic: document.settings.backgroundMusic ?? undefined,
      nicknameTheme: document.settings.nicknameTheme,
      bonusTokenCount: document.settings.bonusTokenCount ?? undefined,
      readingPhaseEnabled: document.settings.readingPhaseEnabled,
      preset: document.settings.preset,
      ...(uploadBundle ? { learningObjectives: uploadBundle } : {}),
      questions: activeQuestions.map((q, index) => ({
        sourceQuestionId: q.id,
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        order: index,
        timer: q.timer ?? null,
        answers: q.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect })),
        skipReadingPhase: q.skipReadingPhase ?? false,
        ...(q.type === 'RATING'
          ? {
              ratingMin: q.ratingMin ?? undefined,
              ratingMax: q.ratingMax ?? undefined,
              ratingLabelMin: q.ratingLabelMin ?? undefined,
              ratingLabelMax: q.ratingLabelMax ?? undefined,
            }
          : {}),
        ...(q.type === 'SHORT_TEXT'
          ? {
              shortTextEvaluationKind: q.shortTextEvaluationKind ?? undefined,
              shortTextMaxLength: q.shortTextMaxLength ?? undefined,
              shortTextCaseSensitive: q.shortTextCaseSensitive ?? undefined,
              shortTextEvaluationMode: q.shortTextEvaluationMode ?? undefined,
              shortTextToleranceLevel: q.shortTextToleranceLevel ?? undefined,
              shortTextAllowPartialCredit: q.shortTextAllowPartialCredit ?? undefined,
              shortTextTrimWhitespace: q.shortTextTrimWhitespace ?? undefined,
              shortTextNormalizeWhitespace: q.shortTextNormalizeWhitespace ?? undefined,
              numericInputKind: q.numericInputKind ?? undefined,
              numericToleranceMode: isNumericToleranceMode(q.numericToleranceMode)
                ? q.numericToleranceMode
                : undefined,
              numericAbsoluteTolerance: q.numericAbsoluteTolerance ?? undefined,
              numericRelativeTolerancePercent: q.numericRelativeTolerancePercent ?? undefined,
              numericUnitFamily: q.numericUnitFamily ?? undefined,
              numericRequireUnit: q.numericRequireUnit ?? undefined,
              numericAcceptEquivalentUnits: q.numericAcceptEquivalentUnits ?? undefined,
            }
          : {}),
        ...(q.type === 'NUMERIC_ESTIMATE'
          ? {
              numericToleranceMode: resolveNumericEstimateToleranceMode(q.numericToleranceMode),
              numericReferenceValue: q.numericReferenceValue ?? undefined,
              numericTolerancePercent: q.numericTolerancePercent ?? undefined,
              numericIntervalLeft: q.numericIntervalLeft ?? undefined,
              numericIntervalRight: q.numericIntervalRight ?? undefined,
              numericInputType: q.numericInputType ?? undefined,
              numericDecimalPlaces: q.numericDecimalPlaces ?? undefined,
              numericMin: q.numericMin ?? undefined,
              numericMax: q.numericMax ?? undefined,
              numericTwoRounds: q.numericTwoRounds ?? undefined,
            }
          : {}),
        ...(q.type === 'MATCHING'
          ? {
              matchingPairs: q.matchingPairs ?? undefined,
              matchingShuffleRight: q.matchingShuffleRight ?? true,
            }
          : {}),
        ...(q.type === 'ORDERING' ? { orderingItems: q.orderingItems ?? undefined } : {}),
        ...(q.type === 'CATEGORIZATION'
          ? {
              categories: q.categories ?? undefined,
              categorizationItems: q.categorizationItems ?? undefined,
              categorizationShuffleItems: q.categorizationShuffleItems ?? true,
            }
          : {}),
        ...(questionSupportsConfidence(q.type)
          ? {
              confidenceEnabled: q.confidenceEnabled ?? false,
              confidenceLabelLow: q.confidenceLabelLow ?? undefined,
              confidenceLabelHigh: q.confidenceLabelHigh ?? undefined,
            }
          : {}),
      })),
    };

    const parsed = QuizUploadInputSchema.safeParse(payload);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? $localize`Ungültige Quiz-Daten für Live-Start.`;
      throw new Error(message);
    }
    return parsed.data;
  }

  importQuiz(payload: unknown, overrideId?: string): QuizImportResult {
    let normalizedPayload: unknown;
    let normalizedSourceQuiz: QuizExport['quiz'] | undefined;
    let warnings: QuizImportWarning[];
    try {
      ({
        payload: normalizedPayload,
        sourceQuiz: normalizedSourceQuiz,
        warnings,
      } = normalizeQuizImportPayload(payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : $localize`Ungültige Import-Datei.`;
      throw new Error(`Import fehlgeschlagen: ${message}`, { cause: error });
    }

    let quizData: QuizExport['quiz'];
    if (normalizedSourceQuiz) {
      quizData = normalizedSourceQuiz;
    } else {
      const parsed = QuizImportSchema.safeParse(normalizedPayload);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const message = issue
          ? `${formatQuizImportIssuePath(issue.path)}: ${issue.message}`
          : $localize`Ungültige Import-Datei.`;
        throw new Error(`Import fehlgeschlagen: ${message}`);
      }
      quizData = parsed.data.quiz;
    }

    if (quizData.questions.length > QUIZ_UPLOAD_MAX_QUESTIONS) {
      throw new Error(
        $localize`:@@quizList.import.tooManyQuestions:Import erlaubt maximal ${QUIZ_UPLOAD_MAX_QUESTIONS}:maxQuestions: Fragen. Reduziere die Datei und versuche es erneut.`,
      );
    }

    const metadata = QuizMetadataSchema.safeParse({
      name: quizData.name.trim(),
      description: normalizeDescription(quizData.description),
      motifImageUrl: normalizeMotifImageUrlInput(quizData.motifImageUrl),
      motifImageCredit: normalizeMotifImageCreditInput(quizData.motifImageCredit),
    });
    if (!metadata.success) {
      const message = metadata.error.issues[0]?.message ?? $localize`Ungültige Import-Datei.`;
      throw new Error(`Import fehlgeschlagen: ${message}`);
    }

    const now = new Date().toISOString();
    const importedQuizId = overrideId ?? generateUuid();
    const importedQuestionIdMap = new Map<string, string>();
    const imported: QuizDocument = {
      id: importedQuizId,
      name: metadata.data.name,
      description: metadata.data.description ?? null,
      motifImageUrl: metadata.data.motifImageUrl ?? null,
      motifImageCredit: metadata.data.motifImageCredit ?? null,
      createdAt: now,
      updatedAt: now,
      ...this.currentQuizUpdateSource(),
      settings: parseQuizSettings({
        showLeaderboard: quizData.showLeaderboard,
        allowCustomNicknames: quizData.allowCustomNicknames,
        defaultTimer: quizData.defaultTimer ?? null,
        timerScaleByDifficulty: quizData.timerScaleByDifficulty ?? true,
        enableTimerAccommodation: quizData.enableTimerAccommodation ?? true,
        enableSoundEffects: quizData.enableSoundEffects,
        enableRewardEffects: quizData.enableRewardEffects,
        enableMotivationMessages: quizData.enableMotivationMessages,
        enableEmojiReactions: quizData.enableEmojiReactions,
        showQuestionTypeIndicators: quizData.showQuestionTypeIndicators ?? true,
        anonymousMode: quizData.anonymousMode,
        teamMode: quizData.teamMode,
        teamCount: quizData.teamCount ?? null,
        teamAssignment: quizData.teamAssignment,
        teamNames: quizData.teamNames ?? [],
        backgroundMusic: quizData.backgroundMusic ?? null,
        nicknameTheme: quizData.nicknameTheme,
        bonusTokenCount: quizData.bonusTokenCount ?? null,
        readingPhaseEnabled: quizData.readingPhaseEnabled ?? true,
        preset: ((quizData as Record<string, unknown>)['preset'] as QuizPreset) ?? 'PLAYFUL',
      }),
      questions: [...quizData.questions]
        .sort((a, b) => a.order - b.order)
        .map((question, index) => {
          const importedQuestionId = generateUuid();
          if ('sourceQuestionId' in question) {
            importedQuestionIdMap.set(question.sourceQuestionId, importedQuestionId);
          }
          const shortTextSettings = resolveQuestionShortTextSettings(question);
          const confidenceSettings = resolveQuestionConfidenceSettings(question);
          const isNumericEstimate = question.type === 'NUMERIC_ESTIMATE';
          const isMatching = question.type === 'MATCHING';
          const isOrdering = question.type === 'ORDERING';
          const isCategorization = question.type === 'CATEGORIZATION';
          return {
            id: importedQuestionId,
            text: question.text,
            type: question.type,
            difficulty: question.difficulty,
            order: index,
            enabled: question.enabled !== false,
            timer: question.timer === undefined || question.timer === null ? null : question.timer,
            answers: question.answers.map((answer) => ({
              id: generateUuid(),
              text: answer.text,
              isCorrect: answer.isCorrect,
            })),
            skipReadingPhase: question.skipReadingPhase ?? false,
            ratingMin: question.type === 'RATING' ? (question.ratingMin ?? 1) : null,
            ratingMax: question.type === 'RATING' ? (question.ratingMax ?? 5) : null,
            ratingLabelMin:
              question.type === 'RATING'
                ? (normalizeNullableLabel(question.ratingLabelMin) ?? null)
                : null,
            ratingLabelMax:
              question.type === 'RATING'
                ? (normalizeNullableLabel(question.ratingLabelMax) ?? null)
                : null,
            ...confidenceSettings,
            ...shortTextSettings,
            numericToleranceMode: isNumericEstimate
              ? resolveNumericEstimateToleranceMode(question.numericToleranceMode)
              : shortTextSettings.numericToleranceMode,
            numericReferenceValue: isNumericEstimate
              ? (question.numericReferenceValue ?? null)
              : null,
            numericTolerancePercent: isNumericEstimate
              ? (question.numericTolerancePercent ?? null)
              : null,
            numericIntervalLeft: isNumericEstimate ? (question.numericIntervalLeft ?? null) : null,
            numericIntervalRight: isNumericEstimate
              ? (question.numericIntervalRight ?? null)
              : null,
            numericInputType: isNumericEstimate ? (question.numericInputType ?? 'DECIMAL') : null,
            numericDecimalPlaces: isNumericEstimate
              ? (question.numericDecimalPlaces ?? null)
              : null,
            numericMin: isNumericEstimate ? (question.numericMin ?? null) : null,
            numericMax: isNumericEstimate ? (question.numericMax ?? null) : null,
            numericTwoRounds: isNumericEstimate ? (question.numericTwoRounds ?? false) : false,
            matchingPairs: isMatching ? (question.matchingPairs ?? undefined) : undefined,
            matchingShuffleRight: isMatching ? (question.matchingShuffleRight ?? true) : undefined,
            orderingItems: isOrdering ? (question.orderingItems ?? undefined) : undefined,
            categories: isCategorization ? (question.categories ?? undefined) : undefined,
            categorizationItems: isCategorization
              ? (question.categorizationItems ?? undefined)
              : undefined,
            categorizationShuffleItems: isCategorization
              ? (question.categorizationShuffleItems ?? true)
              : undefined,
          };
        }),
    };

    let importedBundle: QuizLearningObjectiveBundleV1 | null = null;
    if ('learningObjectives' in quizData) {
      importedBundle = remapLearningObjectiveBundle(
        quizData.learningObjectives,
        importedQuizId,
        importedQuestionIdMap,
        now,
      );
      if (!importedBundle) {
        throw new Error(
          $localize`:@@learningObjectives.importReferenceError:Import fehlgeschlagen: Lernzielreferenzen konnten nicht eindeutig zugeordnet werden.`,
        );
      }
    }
    this.quizDocuments.update((current) => [imported, ...current]);
    if (importedBundle) {
      this.learningObjectiveBundles.update((current) => ({
        ...current,
        [importedQuizId]: importedBundle!,
      }));
    }
    this.persistToStorage();
    return {
      quiz: imported,
      warnings,
    };
  }

  addQuestion(quizId: string, input: AddQuizQuestionInput): QuizQuestion {
    const parsed = validateQuestionInput(input);
    const shortTextSettings = resolveQuestionShortTextSettings(parsed);

    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }
    this.markDemoQuizUserModified(quizId);

    const question: QuizQuestion = {
      id: generateUuid(),
      text: parsed.text,
      type: parsed.type,
      difficulty: parsed.difficulty,
      order: document.questions.length,
      enabled: true,
      timer: parsed.timer,
      answers: parsed.answers.map((answer) => ({
        id: generateUuid(),
        text: answer.text,
        isCorrect: answer.isCorrect,
      })),
      skipReadingPhase: parsed.skipReadingPhase,
      ratingMin: parsed.ratingMin,
      ratingMax: parsed.ratingMax,
      ratingLabelMin: parsed.ratingLabelMin,
      ratingLabelMax: parsed.ratingLabelMax,
      ...resolveQuestionConfidenceSettings(parsed),
      ...shortTextSettings,
      numericToleranceMode:
        parsed.type === 'NUMERIC_ESTIMATE'
          ? resolveNumericEstimateToleranceMode(parsed.numericToleranceMode)
          : shortTextSettings.numericToleranceMode,
      numericReferenceValue: parsed.numericReferenceValue,
      numericTolerancePercent: parsed.numericTolerancePercent,
      numericIntervalLeft: parsed.numericIntervalLeft,
      numericIntervalRight: parsed.numericIntervalRight,
      numericInputType: parsed.numericInputType,
      numericDecimalPlaces: parsed.numericDecimalPlaces,
      numericMin: parsed.numericMin,
      numericMax: parsed.numericMax,
      numericTwoRounds: parsed.numericTwoRounds,
      matchingPairs: parsed.type === 'MATCHING' ? (parsed.matchingPairs ?? undefined) : undefined,
      matchingShuffleRight:
        parsed.type === 'MATCHING' ? (parsed.matchingShuffleRight ?? true) : undefined,
      orderingItems: parsed.type === 'ORDERING' ? (parsed.orderingItems ?? undefined) : undefined,
      categories: parsed.type === 'CATEGORIZATION' ? (parsed.categories ?? undefined) : undefined,
      categorizationItems:
        parsed.type === 'CATEGORIZATION' ? (parsed.categorizationItems ?? undefined) : undefined,
      categorizationShuffleItems:
        parsed.type === 'CATEGORIZATION' ? (parsed.categorizationShuffleItems ?? true) : undefined,
    };

    const updatedAt = new Date().toISOString();
    this.quizDocuments.update((current) =>
      current.map((quiz) =>
        quiz.id === quizId
          ? {
              ...quiz,
              updatedAt,
              ...this.currentQuizUpdateSource(),
              questions: [...quiz.questions, question],
            }
          : quiz,
      ),
    );
    this.persistToStorage();

    return question;
  }

  updateQuestion(quizId: string, questionId: string, input: AddQuizQuestionInput): QuizQuestion {
    const parsed = validateQuestionInput(input);
    const shortTextSettings = resolveQuestionShortTextSettings(parsed);

    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }

    const questionIndex = document.questions.findIndex((question) => question.id === questionId);
    if (questionIndex < 0) {
      throw new Error('Frage nicht gefunden.');
    }
    this.markDemoQuizUserModified(quizId);

    const existingQuestion = document.questions[questionIndex]!;
    const updatedQuestion: QuizQuestion = {
      ...existingQuestion,
      text: parsed.text,
      type: parsed.type,
      difficulty: parsed.difficulty,
      timer: parsed.timer,
      answers: parsed.answers.map((answer, index) => ({
        id: existingQuestion.answers[index]?.id ?? generateUuid(),
        text: answer.text,
        isCorrect: answer.isCorrect,
      })),
      skipReadingPhase: parsed.skipReadingPhase,
      ratingMin: parsed.ratingMin,
      ratingMax: parsed.ratingMax,
      ratingLabelMin: parsed.ratingLabelMin,
      ratingLabelMax: parsed.ratingLabelMax,
      ...resolveQuestionConfidenceSettings(parsed),
      ...shortTextSettings,
      numericToleranceMode:
        parsed.type === 'NUMERIC_ESTIMATE'
          ? resolveNumericEstimateToleranceMode(parsed.numericToleranceMode)
          : shortTextSettings.numericToleranceMode,
      numericReferenceValue: parsed.numericReferenceValue,
      numericTolerancePercent: parsed.numericTolerancePercent,
      numericIntervalLeft: parsed.numericIntervalLeft,
      numericIntervalRight: parsed.numericIntervalRight,
      numericInputType: parsed.numericInputType,
      numericDecimalPlaces: parsed.numericDecimalPlaces,
      numericMin: parsed.numericMin,
      numericMax: parsed.numericMax,
      numericTwoRounds: parsed.numericTwoRounds,
      matchingPairs: parsed.type === 'MATCHING' ? (parsed.matchingPairs ?? undefined) : undefined,
      matchingShuffleRight:
        parsed.type === 'MATCHING' ? (parsed.matchingShuffleRight ?? true) : undefined,
      orderingItems: parsed.type === 'ORDERING' ? (parsed.orderingItems ?? undefined) : undefined,
      categories: parsed.type === 'CATEGORIZATION' ? (parsed.categories ?? undefined) : undefined,
      categorizationItems:
        parsed.type === 'CATEGORIZATION' ? (parsed.categorizationItems ?? undefined) : undefined,
      categorizationShuffleItems:
        parsed.type === 'CATEGORIZATION' ? (parsed.categorizationShuffleItems ?? true) : undefined,
    };

    if (
      questionSemanticFingerprint(existingQuestion) !== questionSemanticFingerprint(updatedQuestion)
    ) {
      this.markLearningObjectivesForQuestion(quizId, questionId, 'source-content-changed');
    }

    const updatedAt = new Date().toISOString();
    this.quizDocuments.update((current) =>
      current.map((quiz) => {
        if (quiz.id !== quizId) return quiz;
        const questions = [...quiz.questions];
        questions[questionIndex] = updatedQuestion;
        return { ...quiz, updatedAt, ...this.currentQuizUpdateSource(), questions };
      }),
    );
    this.persistToStorage();

    return updatedQuestion;
  }

  reorderQuestions(quizId: string, previousIndex: number, currentIndex: number): void {
    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }
    if (previousIndex === currentIndex) return;
    this.markDemoQuizUserModified(quizId);

    const updatedAt = new Date().toISOString();
    this.quizDocuments.update((current) =>
      current.map((quiz) => {
        if (quiz.id !== quizId) return quiz;
        const questions = [...quiz.questions];
        const [moved] = questions.splice(previousIndex, 1);
        questions.splice(currentIndex, 0, moved);
        return {
          ...quiz,
          updatedAt,
          ...this.currentQuizUpdateSource(),
          questions: questions.map((q, i) => ({ ...q, order: i })),
        };
      }),
    );
    this.persistToStorage();
  }

  deleteQuestion(quizId: string, questionId: string): void {
    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }

    const hasQuestion = document.questions.some((question) => question.id === questionId);
    if (!hasQuestion) {
      throw new Error('Frage nicht gefunden.');
    }
    this.markDemoQuizUserModified(quizId);
    this.markLearningObjectivesForQuestion(quizId, questionId, 'source-reference-removed');

    const updatedAt = new Date().toISOString();
    this.quizDocuments.update((current) =>
      current.map((quiz) => {
        if (quiz.id !== quizId) return quiz;
        const questions = quiz.questions
          .filter((question) => question.id !== questionId)
          .map((question, index) => ({ ...question, order: index }));
        return { ...quiz, updatedAt, ...this.currentQuizUpdateSource(), questions };
      }),
    );
    this.persistToStorage();
  }

  setQuestionEnabled(quizId: string, questionId: string, enabled: boolean): void {
    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }

    const questionIndex = document.questions.findIndex((question) => question.id === questionId);
    if (questionIndex < 0) {
      throw new Error('Frage nicht gefunden.');
    }
    this.markDemoQuizUserModified(quizId);

    const updatedAt = new Date().toISOString();
    this.quizDocuments.update((current) =>
      current.map((quiz) => {
        if (quiz.id !== quizId) return quiz;
        const questions = [...quiz.questions];
        const q = questions[questionIndex]!;
        questions[questionIndex] = { ...q, enabled };
        return { ...quiz, updatedAt, ...this.currentQuizUpdateSource(), questions };
      }),
    );
    this.persistToStorage();
  }

  private markLearningObjectivesForQuestion(
    quizId: string,
    questionId: string,
    reason: LearningObjectiveNeedsReviewReason,
  ): void {
    const bundle = this.learningObjectiveBundles()[quizId];
    if (!bundle) return;
    let changed = false;
    const objectives = bundle.objectives.map((objective) => {
      const isDerivedFromQuestion =
        objective.origin.kind === 'model-derived' &&
        objective.origin.derivedFromSourceQuestionIds.includes(questionId);
      const isScopedToQuestion =
        objective.scope.kind === 'question-set' &&
        objective.scope.sourceQuestionIds.includes(questionId);
      const isAffected =
        reason === 'source-reference-removed'
          ? isScopedToQuestion || isDerivedFromQuestion
          : isDerivedFromQuestion;
      if (!isAffected) {
        return objective;
      }
      if (
        objective.confirmation.state === 'needs-review' &&
        (objective.confirmation.reason === reason ||
          objective.confirmation.reason === 'source-reference-removed')
      ) {
        return objective;
      }

      const nextRevision = objective.revision + 1;
      const previousConfirmation =
        objective.confirmation.state === 'confirmed'
          ? {
              state: 'confirmed' as const,
              revision: objective.confirmation.confirmedRevision,
              confirmedAt: objective.confirmation.confirmedAt,
            }
          : objective.confirmation.state === 'draft'
            ? { state: 'draft' as const, revision: objective.revision }
            : objective.confirmation.previousConfirmation;
      changed = true;
      const updatedAt = monotoneLearningObjectiveTimestamp(objective);
      return {
        ...objective,
        revision: nextRevision,
        updatedAt,
        confirmation: {
          state: 'needs-review' as const,
          previousConfirmation,
          currentRevision: nextRevision,
          reason,
        },
      };
    });
    if (!changed) return;

    const nextBundle = QuizLearningObjectiveBundleV1Schema.parse({
      ...bundle,
      revision: bundle.revision + 1,
      objectives,
    });
    this.learningObjectiveBundles.update((current) => ({ ...current, [quizId]: nextBundle }));
  }

  getQuizById(id: string): QuizDocument | null {
    this.ensureHostLibraryReady();
    return this.quizDocuments().find((quiz) => quiz.id === id) ?? null;
  }

  /**
   * @returns true wenn ein Import/Neu-Seed ausgeführt wurde (für Yjs-Flush nach applyYjsSnapshot).
   */
  ensureDemoQuiz(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    if (this.librarySharingMode() === 'shared') return false;

    const locale = this.resolveActiveDemoLocale();
    const payload = getDemoQuizPayload(locale);
    const expectedFp = getDemoQuizSeedFingerprint(locale);
    const existing = this.getQuizById(DEMO_QUIZ_ID);
    const storedFp = this.readDemoQuizSeedFingerprint();

    const reseedDemoFromPayload = (): boolean => {
      try {
        this.quizDocuments.update((current) => current.filter((q) => q.id !== DEMO_QUIZ_ID));
        this.importQuiz(payload, DEMO_QUIZ_ID);
        this.writeDemoQuizSeedFingerprint(expectedFp);
        this.clearDemoQuizUserModified();
        return true;
      } catch (e) {
        console.error('[DemoQuiz] Reseed failed:', e);
        return false;
      }
    };

    if (!existing) {
      try {
        this.importQuiz(payload, DEMO_QUIZ_ID);
        this.writeDemoQuizSeedFingerprint(expectedFp);
        this.clearDemoQuizUserModified();
        return true;
      } catch (e) {
        console.error('[DemoQuiz] Seeding failed:', e);
        return false;
      }
    }

    if (this.isDemoQuizUserModified()) {
      return false;
    }

    const titleLocale = detectCanonicalDemoLocaleForTitle(existing.name);
    if (titleLocale !== null && titleLocale !== locale) {
      return reseedDemoFromPayload();
    }

    if (!demoQuizMatchesSeedPayload(existing, payload)) {
      return reseedDemoFromPayload();
    }

    if (storedFp !== expectedFp) {
      return reseedDemoFromPayload();
    }

    return false;
  }

  private resolveActiveDemoLocale(): SupportedLocale {
    if (!isPlatformBrowser(this.platformId)) {
      return normalizeDemoQuizLocale(String(this.localeId));
    }

    const fromPath = getLocaleFromPath();
    const fromRouter = parseLeadingLocaleFromPathOrUrl(this.router.url);
    if (fromPath && fromRouter && fromPath !== fromRouter) {
      return fromPath;
    }
    const fromSegment = fromPath ?? fromRouter;
    if (fromSegment) {
      return fromSegment;
    }

    const fromSaved = getHomeLanguagePreference();
    if (fromSaved) {
      return fromSaved;
    }

    return getEffectiveLocale(localeIdToSupported(String(this.localeId)));
  }

  private readDemoQuizSeedFingerprint(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(DEMO_QUIZ_SEED_FINGERPRINT_KEY);
      return raw && raw.length > 0 ? raw : null;
    } catch {
      /* ignore */
    }
    return null;
  }

  private writeDemoQuizSeedFingerprint(fingerprint: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(DEMO_QUIZ_SEED_FINGERPRINT_KEY, fingerprint);
      localStorage.removeItem('arsnova-demo-quiz-locale-v1');
      localStorage.removeItem('arsnova-demo-quiz-locale-v2');
    } catch {
      /* ignore */
    }
  }

  private demoQuizUserModifiedStorageKey(): string {
    const roomId = this.syncRoomId();
    return roomId
      ? `${DEMO_QUIZ_USER_MODIFIED_KEY_PREFIX}:${roomId}`
      : DEMO_QUIZ_USER_MODIFIED_KEY_PREFIX;
  }

  private isDemoQuizUserModified(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      return localStorage.getItem(this.demoQuizUserModifiedStorageKey()) === '1';
    } catch {
      return false;
    }
  }

  private markDemoQuizUserModified(quizId: string): void {
    if (quizId !== DEMO_QUIZ_ID || !isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(this.demoQuizUserModifiedStorageKey(), '1');
    } catch {
      /* ignore */
    }
  }

  private clearDemoQuizUserModified(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.removeItem(this.demoQuizUserModifiedStorageKey());
    } catch {
      /* ignore */
    }
  }

  /**
   * Aktiviert einen Sync-Raum.
   * `secureAsOrigin` darf nur gesetzt werden, wenn dieses Gerät die Sammlung bewusst
   * absichern soll (eigene lokale Bibliothek oder vorhandene Rotations-Capability) —
   * nie allein aus dem Fehlen eines Share-Tokens ableiten.
   */
  activateSyncRoom(
    roomId: string,
    options?: { markShared?: boolean; secureAsOrigin?: boolean; shareToken?: string | null },
  ): void {
    this.hostLibraryStarted = true;
    this.attachHostLibraryBrowserListeners();
    const normalizedRoomId = normalizeSyncRoomId(roomId);
    if (!normalizedRoomId) {
      throw new Error($localize`Ungültige Sync-ID.`);
    }
    const shouldSecureAsOrigin = options?.secureAsOrigin === true;
    const sameRoom = this.syncRoomId() === normalizedRoomId;
    this.pendingSecureAsOrigin = shouldSecureAsOrigin;
    this.syncShareError.set(null);
    if (options?.markShared) {
      this.setLibrarySharingMode('shared');
    }
    if (sameRoom) {
      let importedTokenChanged = false;
      if (options?.shareToken) {
        importedTokenChanged = this.acceptShareTokenMonotonically(
          normalizedRoomId,
          options.shareToken,
          'import',
        );
        if (importedTokenChanged) {
          // Recreate the document so an already restored IndexedDB snapshot
          // cannot be mixed into the authoritative first provider snapshot.
          this.teardownYjs();
          void this.initYjsPersistence(normalizedRoomId);
        }
      } else {
        this.loadShareSecrets(normalizedRoomId);
        this.syncShareStatus.set(this.syncShareToken() ? 'ready' : 'legacy');
      }
      if (shouldSecureAsOrigin) {
        this.recordSyncOriginIfMissing();
      }
      if (
        options?.markShared &&
        !importedTokenChanged &&
        this.pendingImportedShareToken?.roomId !== normalizedRoomId
      ) {
        void this.ensureShareRegisteredAndConnect();
      }
      return;
    }

    this.teardownYjs();
    this.syncRoomId.set(normalizedRoomId);
    this.storeSyncRoomId(normalizedRoomId);
    this.loadSyncMetadata(normalizedRoomId);
    this.loadShareSecrets(normalizedRoomId);
    if (options?.shareToken) {
      const tokenChanged = this.acceptShareTokenMonotonically(
        normalizedRoomId,
        options.shareToken,
        'import',
      );
      if (tokenChanged) {
        this.teardownYjsProvider();
      }
    } else if (shouldSecureAsOrigin) {
      this.syncShareStatus.set('pending');
    } else {
      this.syncShareStatus.set(this.syncShareToken() ? 'ready' : 'legacy');
    }
    if (shouldSecureAsOrigin) {
      this.recordSyncOriginIfMissing();
    }

    this.loadFromStorage(normalizedRoomId, false);
    if (this.pendingImportedShareToken?.roomId === normalizedRoomId) {
      const serialized = this.serializeQuizDocuments();
      this.pendingImportedQuizRestore = {
        roomId: normalizedRoomId,
        baselineSerialized: serialized,
        latestSerialized: serialized,
        persistenceStarted: false,
        persistenceSynced: !hasIndexedDbSupport(),
        providerSynced: false,
        providerPresetSerialized: null,
        providerSerialized: null,
      };
    }
    void this.initYjsPersistence(normalizedRoomId);
  }

  /** True, wenn ein kopierbarer Share-Token vorliegt. */
  hasSyncShareToken(): boolean {
    return !!this.syncShareToken();
  }

  /**
   * Erstellt einen abgesicherten Share immer in einem serverseitig gewählten
   * neuen Raum. Dadurch kann keine alte UUID per First-Writer übernommen werden.
   */
  createSecuredSyncShareLink(): Promise<string> {
    if (this.syncShareToken() && this.canInvalidateSyncLink()) {
      return Promise.resolve(this.buildSyncShareLink());
    }
    this.securedShareCreationPromise ??= this.performCreateSecuredSyncShareLink().finally(() => {
      this.securedShareCreationPromise = null;
    });
    return this.securedShareCreationPromise;
  }

  private async performCreateSecuredSyncShareLink(): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error($localize`Sync-Link kann nur im Browser erstellt werden.`);
    }
    this.syncShareStatus.set('pending');
    this.syncShareError.set(null);
    const capability = this.createRotationCapability();
    try {
      const result = await trpc.quizSync.createShare.mutate({
        rotationCapability: capability,
      });
      this.rekeySharedLibraryRoomKeepingShared(result.roomId);
      this.persistRotationCapability(result.roomId, capability);
      this.persistShareToken(result.roomId, result.shareToken);
      this.recordSyncOriginIfMissing();
      this.pendingSecureAsOrigin = false;
      this.syncShareStatus.set('ready');
      void this.initYjsPersistence(result.roomId);
      return this.buildSyncShareLink(result.roomId);
    } catch (error) {
      this.syncShareStatus.set('error');
      this.syncShareError.set(
        error instanceof Error
          ? error.message
          : $localize`Abgesicherter Sync-Link konnte nicht erstellt werden.`,
      );
      throw error;
    }
  }

  /** Öffentlicher Sync-Link; das URL-Fragment wird nie an HTTP-Server/Logs übertragen. */
  buildSyncShareLink(roomId: string = this.syncRoomId()): string {
    const base = resolveLocalizedAppUrl(`/quiz/sync/${roomId}`);
    const token = this.syncShareToken();
    if (!token || !isSyncRoomUuid(roomId)) {
      return base;
    }
    const url = new URL(base, globalThis.location?.origin ?? 'http://localhost');
    url.hash = `${YJS_SHARE_QUERY_PARAM}=${encodeURIComponent(token)}`;
    return `${url.origin}${url.pathname}${url.hash}`;
  }

  /**
   * Ungültig machen: erhöht die Share-Generation serverseitig und aktualisiert
   * den lokalen Token. Andere Geräte brauchen den neuen Link.
   */
  async invalidateSyncShareLink(): Promise<string> {
    const roomId = this.syncRoomId();
    if (!isSyncRoomUuid(roomId)) {
      throw new Error($localize`Sync-Link kann für diese Sammlung nicht ungültig gemacht werden.`);
    }
    if (!this.syncShareToken()) {
      throw new Error($localize`Sync-Link ist noch nicht bereit.`);
    }
    const capability = this.readRotationCapability(roomId);
    if (!capability) {
      throw new Error(
        $localize`Nur das Gerät, das den Sync-Link erstellt hat, kann ihn ungültig machen.`,
      );
    }
    this.syncShareStatus.set('pending');
    try {
      const result = await trpc.quizSync.rotateShare.mutate({
        roomId,
        rotationCapability: capability,
      });
      this.persistShareToken(roomId, result.shareToken);
      this.syncShareStatus.set('ready');
      this.syncShareError.set(null);
      this.teardownYjsProvider();
      await this.attachYjsWebSocketProviderIfNeeded(this.yjsInitGeneration, roomId);
      return this.buildSyncShareLink(roomId);
    } catch (error) {
      this.syncShareStatus.set('error');
      this.syncShareError.set(
        error instanceof Error
          ? error.message
          : $localize`Sync-Link konnte nicht ungültig gemacht werden.`,
      );
      throw error;
    }
  }

  /**
   * Trennt die geteilte Quiz-Sammlung und wechselt auf einen neuen lokalen Sync-Raum.
   * Vorhandene Quizze bleiben auf diesem Gerät erhalten.
   */
  unlinkSharedLibrary(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const serialized = this.serializeQuizDocuments();
    const serializedLearningObjectives = this.serializeLearningObjectiveBundles();
    const newLocalRoomId = generateUuid();

    this.teardownYjs();
    this.setLibrarySharingMode('local');
    this.syncRoomId.set(newLocalRoomId);
    this.storeSyncRoomId(newLocalRoomId);
    this.loadSyncMetadata(newLocalRoomId);
    this.persistLocalMirror(serialized);
    this.persistLearningObjectiveMirror(serializedLearningObjectives);
    this.updateSerializedQuizCache(newLocalRoomId, serialized);
    this.updateSerializedLearningObjectiveCache(newLocalRoomId, serializedLearningObjectives);
    this.ensureDemoQuiz();
    void this.initYjsPersistence(newLocalRoomId);
  }

  private loadFromStorage(roomId: string, allowLegacyFallback: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.loadLearningObjectivesFromStorage(roomId);

    try {
      const storageKey = this.storageKeyForRoom(roomId);
      const raw = localStorage.getItem(storageKey);
      const legacyRaw =
        !raw && allowLegacyFallback ? localStorage.getItem(QUIZ_STORAGE_LEGACY_KEY) : null;
      const sourceRaw = raw ?? legacyRaw;
      if (!sourceRaw) {
        this.quizDocuments.set([]);
        this.updateSerializedQuizCache(roomId, '[]');
        return;
      }

      const parsed = JSON.parse(sourceRaw) as unknown;
      const validQuizzes = normalizeStoredQuizzes(parsed);
      const normalizedSerialized = JSON.stringify(validQuizzes);
      this.quizDocuments.set(validQuizzes);
      this.updateSerializedQuizCache(roomId, normalizedSerialized);

      if (!raw && legacyRaw) {
        this.persistLocalMirror(normalizedSerialized);
      } else if (sourceRaw !== normalizedSerialized) {
        this.persistLocalMirror(normalizedSerialized);
      }
    } catch {
      this.quizDocuments.set([]);
      this.updateSerializedQuizCache(roomId, '[]');
    }
  }

  private persistToStorage(): void {
    this.recordLocalChange();
    const serialized = this.serializeQuizDocuments();
    const serializedLearningObjectives = this.serializeLearningObjectiveBundles();
    if (
      !this.isApplyingYjsSnapshot &&
      this.pendingImportedShareToken?.roomId === this.syncRoomId()
    ) {
      const pendingRestore = this.pendingImportedQuizRestore;
      if (pendingRestore?.roomId === this.syncRoomId()) {
        pendingRestore.latestSerialized = serialized;
      }
    }
    this.capturePendingInitialLearningObjectiveOperations();
    this.persistLocalMirror(serialized);
    this.persistLearningObjectiveMirror(serializedLearningObjectives);
    this.writeYjsSnapshot(serialized, serializedLearningObjectives);
  }

  private persistLocalMirror(serialized?: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const roomId = this.syncRoomId();
    if (!roomId) return;
    const payload = serialized ?? this.serializeQuizDocuments();

    try {
      localStorage.setItem(this.storageKeyForRoom(roomId), payload);
      // Legacy mirror for backward compatibility with existing clients/tests.
      localStorage.setItem(QUIZ_STORAGE_LEGACY_KEY, payload);
      this.updateSerializedQuizCache(roomId, payload);
    } catch {
      // Ignore quota/unavailable storage and keep in-memory state.
    }
  }

  private loadLearningObjectivesFromStorage(roomId: string): void {
    this.malformedLearningObjectiveKeys.clear();
    try {
      const raw = localStorage.getItem(this.learningObjectiveStorageKey(roomId));
      if (!raw) {
        this.learningObjectiveBundles.set({});
        this.updateSerializedLearningObjectiveCache(roomId, '[]');
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      const bundles: Record<string, QuizLearningObjectiveBundleV1> = {};
      if (Array.isArray(parsed)) {
        for (const candidate of parsed) {
          const result = QuizLearningObjectiveBundleV1Schema.safeParse(candidate);
          if (result.success) bundles[result.data.quizId] = result.data;
        }
      }
      this.learningObjectiveBundles.set(bundles);
      const normalized = JSON.stringify(
        Object.values(bundles).sort((a, b) => a.quizId.localeCompare(b.quizId)),
      );
      this.updateSerializedLearningObjectiveCache(roomId, normalized);
      if (raw !== normalized) this.persistLearningObjectiveMirror(normalized);
    } catch {
      this.learningObjectiveBundles.set({});
      this.updateSerializedLearningObjectiveCache(roomId, '[]');
    }
  }

  private beginLearningObjectiveYjsRestore(roomId: string): void {
    if (
      this.learningObjectiveYjsRestorePending &&
      this.learningObjectiveYjsRestoreRoomId === roomId
    ) {
      return;
    }
    this.learningObjectiveYjsRestoreRoomId = roomId;
    this.learningObjectiveYjsRestorePending = true;
    this.pendingInitialLearningObjectiveMirror = this.learningObjectiveBundles();
    this.pendingInitialLearningObjectiveOperations = [];
  }

  /**
   * Preserve edits made while y-indexeddb is still restoring its Y.Doc. The
   * operations receive their causal parent only after the persisted oplog is
   * available, so an early local edit becomes a normal branch/conflict instead
   * of being replaced by the first remote snapshot.
   */
  private capturePendingInitialLearningObjectiveOperations(): void {
    const previous = this.pendingInitialLearningObjectiveMirror;
    if (!this.learningObjectiveYjsRestorePending || !previous) return;

    const current = this.learningObjectiveBundles();
    const quizIds = new Set([...Object.keys(previous), ...Object.keys(current)]);
    for (const quizId of [...quizIds].sort()) {
      const previousBundle = previous[quizId];
      const currentBundle = current[quizId];
      const previousById = new Map(
        (previousBundle?.objectives ?? []).map((objective) => [objective.id, objective]),
      );
      const currentById = new Map(
        (currentBundle?.objectives ?? []).map((objective) => [objective.id, objective]),
      );
      const objectiveIds = new Set([...previousById.keys(), ...currentById.keys()]);

      for (const objectiveId of [...objectiveIds].sort()) {
        const before = previousById.get(objectiveId);
        const after = currentById.get(objectiveId);
        if (
          before &&
          after &&
          objectivePayloadFingerprint(before) === objectivePayloadFingerprint(after)
        ) {
          continue;
        }
        if (!before && !after) continue;

        const operationId = generateUuid();
        if (after) {
          const expectedRevision = Math.max(0, after.revision - 1);
          this.pendingInitialLearningObjectiveOperations.push({
            operation: {
              schemaVersion: 1,
              operationId,
              quizId,
              objectiveId,
              kind: 'upsert',
              expectedRevision,
              resultingRevision: after.revision,
              bundleResultRevision: currentBundle?.revision ?? after.revision,
              parentOperationIds: [],
              writtenAt: after.updatedAt,
              objective: after,
            },
            baseFingerprint:
              before?.revision === expectedRevision ? objectivePayloadFingerprint(before) : null,
          });
          continue;
        }

        if (!before) continue;

        if (before.revision >= LEARNING_OBJECTIVE_REVISION_MAX) {
          this.learningObjectiveSyncError.set(
            $localize`:@@learningObjectives.revisionLimit:Dieses Lernziel hat die maximale Revisionszahl erreicht.`,
          );
          continue;
        }
        this.pendingInitialLearningObjectiveOperations.push({
          operation: {
            schemaVersion: 1,
            operationId,
            quizId,
            objectiveId,
            kind: 'delete',
            expectedRevision: before.revision,
            resultingRevision: before.revision + 1,
            bundleResultRevision:
              currentBundle?.revision ??
              Math.min(LEARNING_OBJECTIVE_REVISION_MAX, (previousBundle?.revision ?? 0) + 1),
            parentOperationIds: [],
            writtenAt: monotoneLearningObjectiveTimestamp(before),
          },
          baseFingerprint: objectivePayloadFingerprint(before),
        });
      }
    }
    this.pendingInitialLearningObjectiveMirror = current;
  }

  private flushPendingInitialLearningObjectiveOperations(): boolean {
    if (!this.yDoc || !this.yLearningObjectivesRoot) return false;
    if (this.pendingInitialLearningObjectiveOperations.length === 0) return true;

    this.isWritingYjsSnapshot = true;
    try {
      this.yDoc.transact(() => {
        for (const pending of this.pendingInitialLearningObjectiveOperations) {
          const operationMap = this.learningObjectiveOperationMap(pending.operation.quizId);
          if (!operationMap) throw new Error('learning-objective-oplog-unavailable');
          if (operationMap.has(pending.operation.operationId)) continue;
          const materialized = materializeLearningObjectiveOperations(
            pending.operation.quizId,
            operationMap,
          );
          if (operationMap.size > 0 && materialized.malformed) {
            throw new Error('learning-objective-oplog-invalid');
          }
          const parentOperationIds = pending.baseFingerprint
            ? (materialized.operationsByObjective.get(pending.operation.objectiveId) ?? [])
                .filter(
                  (candidate) =>
                    candidate.kind === 'upsert' &&
                    candidate.resultingRevision === pending.operation.expectedRevision &&
                    objectivePayloadFingerprint(candidate.objective!) === pending.baseFingerprint,
                )
                .sort((left, right) => left.operationId.localeCompare(right.operationId))
                .slice(0, 1)
                .map((candidate) => candidate.operationId)
            : [];
          if (
            !this.appendLearningObjectiveOperation(operationMap, {
              ...pending.operation,
              parentOperationIds,
            })
          ) {
            throw new Error('learning-objective-oplog-limit');
          }
          this.yLearningObjectivesRoot!.set(
            pending.operation.quizId,
            QUIZ_LEARNING_OBJECTIVES_OPLOG_MARKER,
          );
        }
      }, this);
      return true;
    } catch {
      this.learningObjectiveSyncError.set(
        $localize`:@@learningObjectives.syncLimit:Der synchronisierte Lernzielverlauf ist zu groß. Änderungen bleiben lokal, bis der Konflikt bereinigt wurde.`,
      );
      return false;
    } finally {
      this.isWritingYjsSnapshot = false;
    }
  }

  private finishLearningObjectiveYjsRestore(): void {
    this.learningObjectiveYjsRestorePending = false;
    this.learningObjectiveYjsRestoreRoomId = null;
    this.pendingInitialLearningObjectiveMirror = null;
    this.pendingInitialLearningObjectiveOperations = [];
  }

  private persistLearningObjectiveMirror(serialized?: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const roomId = this.syncRoomId();
    if (!roomId) return;
    const payload = serialized ?? this.serializeLearningObjectiveBundles();
    try {
      localStorage.setItem(this.learningObjectiveStorageKey(roomId), payload);
      this.updateSerializedLearningObjectiveCache(roomId, payload);
    } catch {
      // Ignore quota/unavailable storage and keep in-memory state.
    }
  }

  private async initYjsPersistence(roomId: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    this.beginLearningObjectiveYjsRestore(roomId);

    const generation = ++this.yjsInitGeneration;

    try {
      const Y = await this.loadYjsModule();
      if (!this.canUseYjsSetupResult(generation, roomId)) return;

      const yDoc = new Y.Doc();
      const yRoot = yDoc.getMap<string>('quiz-library');
      const yLearningObjectivesRoot = yDoc.getMap<string>(QUIZ_LEARNING_OBJECTIVES_ROOT_KEY);
      yRoot.observe(this.onYjsRootChanged);
      yLearningObjectivesRoot.observe(this.onYjsLearningObjectivesChanged);
      yDoc.on('update', this.onYjsDocumentUpdated);
      this.yDoc = yDoc;
      this.yRoot = yRoot;
      this.yLearningObjectivesRoot = yLearningObjectivesRoot;

      const deferPersistenceUntilProvider =
        hasIndexedDbSupport() &&
        this.pendingImportedShareToken?.roomId === roomId &&
        this.pendingImportedQuizRestore?.roomId === roomId;
      if (!hasIndexedDbSupport()) {
        this.handleInitialYjsSourceSynced(roomId, 'persistence');
      } else if (!deferPersistenceUntilProvider) {
        await this.attachYjsIndexedDbPersistence(roomId, yDoc, generation);
      }

      await this.ensureShareRegisteredAndConnect(generation, roomId);
    } catch {
      if (this.canUseYjsSetupResult(generation, roomId)) {
        this.teardownYjs();
        this.syncConnectionState.set('disconnected');
      }
    }
  }

  private async attachYjsIndexedDbPersistence(
    roomId: string,
    yDoc: YDoc,
    generation: number,
  ): Promise<void> {
    if (this.yPersistence || !hasIndexedDbSupport()) return;
    const IndexeddbPersistence = await this.loadIndexedDbPersistenceCtor();
    if (!this.canUseYjsSetupResult(generation, roomId) || this.yDoc !== yDoc) return;
    const persistence = new IndexeddbPersistence(`${QUIZ_YDOC_NAME}:${roomId}`, yDoc);
    this.yPersistence = persistence;
    persistence.once('synced', () => {
      if (this.yPersistence === persistence && this.yDoc === yDoc && this.syncRoomId() === roomId) {
        this.clearPendingImportedPersistenceSyncTimeout();
        this.handleInitialYjsSourceSynced(roomId, 'persistence');
      }
    });
    this.schedulePendingImportedPersistenceSyncTimeout(roomId, yDoc, generation, persistence);
  }

  private schedulePendingImportedPersistenceSyncTimeout(
    roomId: string,
    yDoc: YDoc,
    generation: number,
    persistence: IndexedDbPersistenceInstance,
  ): void {
    const pendingShare = this.pendingImportedShareToken;
    const pendingRestore = this.pendingImportedQuizRestore;
    if (
      pendingShare?.roomId !== roomId ||
      pendingRestore?.roomId !== roomId ||
      !pendingRestore.providerSynced
    ) {
      return;
    }

    this.clearPendingImportedPersistenceSyncTimeout();
    this.pendingImportedPersistenceSyncTimeoutId = setTimeout(() => {
      this.pendingImportedPersistenceSyncTimeoutId = null;
      void this.recoverPendingImportedPersistenceFailure(roomId, yDoc, generation, persistence);
    }, QUIZ_IMPORTED_PERSISTENCE_SYNC_TIMEOUT_MS);
  }

  private clearPendingImportedPersistenceSyncTimeout(): void {
    if (this.pendingImportedPersistenceSyncTimeoutId === null) return;
    clearTimeout(this.pendingImportedPersistenceSyncTimeoutId);
    this.pendingImportedPersistenceSyncTimeoutId = null;
  }

  private async recoverPendingImportedPersistenceFailure(
    roomId: string,
    yDoc: YDoc,
    generation: number,
    persistence: IndexedDbPersistenceInstance | null = null,
  ): Promise<void> {
    if (!this.canUseYjsSetupResult(generation, roomId) || this.yDoc !== yDoc) return;
    if (
      this.pendingImportedShareToken?.roomId !== roomId ||
      this.pendingImportedQuizRestore?.roomId !== roomId ||
      !this.pendingImportedQuizRestore.providerSynced
    ) {
      return;
    }
    if (persistence !== null && this.yPersistence !== persistence) return;
    if (persistence === null && this.yPersistence !== null) return;

    this.clearPendingImportedPersistenceSyncTimeout();
    if (persistence !== null) {
      this.yPersistence = null;
      const cacheCleared = await this.clearFailedImportedPersistence(roomId, persistence);
      if (
        !this.canUseYjsSetupResult(generation, roomId) ||
        this.yDoc !== yDoc ||
        this.yPersistence !== null ||
        this.pendingImportedShareToken?.roomId !== roomId ||
        this.pendingImportedQuizRestore?.roomId !== roomId
      ) {
        return;
      }
      if (!cacheCleared) {
        // Never confirm an import while a known stale cache could be attached
        // normally on the next reload and forwarded to the live relay.
        this.teardownYjs();
        this.syncConnectionState.set('disconnected');
        return;
      }
    }
    this.handleInitialYjsSourceSynced(roomId, 'persistence');
  }

  private async clearFailedImportedPersistence(
    roomId: string,
    persistence: IndexedDbPersistenceInstance,
  ): Promise<boolean> {
    let clearTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const clearResult = await Promise.race([
      Promise.resolve()
        .then(() => persistence.clearData())
        .then(
          () => true,
          () => false,
        ),
      new Promise<boolean>((resolve) => {
        clearTimeoutId = setTimeout(
          () => resolve(false),
          QUIZ_IMPORTED_PERSISTENCE_CLEAR_TIMEOUT_MS,
        );
      }),
    ]);
    if (clearTimeoutId !== null) clearTimeout(clearTimeoutId);
    if (clearResult) return true;

    return this.deleteIndexedDbDatabase(`${QUIZ_YDOC_NAME}:${roomId}`);
  }

  private deleteIndexedDbDatabase(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (deleted: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(deleted);
      };
      const timeoutId = setTimeout(() => finish(false), QUIZ_IMPORTED_PERSISTENCE_CLEAR_TIMEOUT_MS);
      try {
        const request = globalThis.indexedDB.deleteDatabase(name);
        request.onsuccess = () => finish(true);
        request.onerror = () => finish(false);
        // A blocked deletion stays pending until the old connection closes;
        // only onsuccess proves that a later reload cannot restore stale data.
      } catch {
        finish(false);
      }
    });
  }

  /** Yjs-WebSocket nur bei geteilter Bibliothek – lokal reicht IndexedDB (keine WS-Konsolenfehler ohne Server). */
  private async attachYjsWebSocketProviderIfNeeded(
    expectedGeneration = this.yjsInitGeneration,
    expectedRoomId = this.syncRoomId(),
    expectedProviderGeneration = this.yjsProviderAttachGeneration,
  ): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.yDoc || this.yProvider) return;
    if (this.librarySharingMode() !== 'shared') {
      this.syncConnectionState.set('disconnected');
      return;
    }
    if (!hasWebsocketSupport()) {
      this.syncConnectionState.set('disconnected');
      return;
    }

    const roomId = this.syncRoomId();
    if (!roomId) {
      this.syncConnectionState.set('disconnected');
      return;
    }
    if (!isSyncRoomUuid(roomId)) {
      this.syncConnectionState.set('disconnected');
      this.syncShareStatus.set('legacy');
      return;
    }

    this.syncConnectionState.set('connecting');
    const shareToken = this.syncShareToken();
    if (shareToken) {
      const valid = await this.validateYjsShareToken(expectedRoomId, shareToken);
      if (
        !this.canAttachYjsProvider(
          expectedGeneration,
          expectedProviderGeneration,
          expectedRoomId,
          shareToken,
        )
      ) {
        return;
      }
      if (valid === false) {
        this.handleTerminalYjsShareRejection(expectedRoomId, shareToken);
        return;
      }
    }

    const WebsocketProvider = await this.loadWebsocketProviderCtor();
    if (
      !this.canAttachYjsProvider(
        expectedGeneration,
        expectedProviderGeneration,
        expectedRoomId,
        shareToken,
      )
    ) {
      return;
    }

    const yDoc = this.yDoc;
    const provider = new WebsocketProvider(
      getYjsWsUrl(),
      `${QUIZ_SYNC_ROOM_PREFIX}${expectedRoomId}`,
      yDoc,
      shareToken
        ? {
            params: { [YJS_SHARE_QUERY_PARAM]: shareToken },
          }
        : undefined,
    );
    if (
      !this.canAttachYjsProvider(
        expectedGeneration,
        expectedProviderGeneration,
        expectedRoomId,
        shareToken,
      ) ||
      this.yDoc !== yDoc
    ) {
      provider.destroy();
      return;
    }
    this.yProvider = provider;
    provider.awareness.setLocalStateField(
      'syncClient',
      readCurrentSyncClientPresence(this.currentSyncDeviceId),
    );
    provider.awareness.on('change', this.onAwarenessChanged);
    provider.on('sync', (isSynced: boolean) => {
      if (isSynced && this.yDoc === yDoc && this.syncRoomId() === expectedRoomId) {
        this.handleInitialYjsSourceSynced(expectedRoomId, 'provider', shareToken);
      }
    });
    let rejectionCheckInFlight = false;
    provider.on('connection-error', () => {
      if (this.yProvider !== provider || !shareToken || rejectionCheckInFlight) return;
      rejectionCheckInFlight = true;
      void this.validateYjsShareToken(expectedRoomId, shareToken)
        .then((valid) => {
          if (valid === false && this.yProvider === provider) {
            this.handleTerminalYjsShareRejection(expectedRoomId, shareToken);
          }
        })
        .finally(() => {
          rejectionCheckInFlight = false;
        });
    });
    provider.on('status', ({ status }: { status: SyncConnectionState }) => {
      const nextState =
        status === 'connected'
          ? 'connected'
          : status === 'connecting'
            ? 'connecting'
            : 'disconnected';
      this.syncConnectionState.set(nextState);
      if (nextState === 'connected') {
        this.recordConnectedAt();
      }
    });
  }

  /**
   * Prüft nur die endgültige Token-Autorisierung. Ein nicht erreichbarer
   * Prüfdienst bleibt transient und darf das normale Reconnect nicht stoppen.
   */
  private async validateYjsShareToken(roomId: string, shareToken: string): Promise<boolean | null> {
    try {
      return (await trpc.quizSync.validateShare.mutate({ roomId, shareToken })).valid;
    } catch {
      return null;
    }
  }

  private handleTerminalYjsShareRejection(roomId: string, shareToken: string): void {
    const pending = this.pendingImportedShareToken;
    if (pending?.roomId === roomId && pending.token === shareToken) {
      this.rejectPendingImportedShareToken(roomId, shareToken);
      return;
    }
    if (this.syncRoomId() !== roomId || this.syncShareToken() !== shareToken) return;
    this.teardownYjsProvider();
    this.syncShareStatus.set('error');
    this.syncShareError.set(
      $localize`Dieser Sync-Link ist ungültig oder wurde ersetzt. Bitte verwende einen aktuellen Link.`,
    );
  }

  private teardownYjs(): void {
    this.yjsInitGeneration++;
    this.clearPendingImportedPersistenceSyncTimeout();
    try {
      this.yRoot?.unobserve(this.onYjsRootChanged);
      this.yLearningObjectivesRoot?.unobserve(this.onYjsLearningObjectivesChanged);
      this.yDoc?.off('update', this.onYjsDocumentUpdated);
    } catch {
      // Best effort cleanup.
    }
    this.teardownYjsProvider();
    this.yPersistence?.destroy();
    this.yDoc?.destroy();
    this.yPersistence = null;
    this.yRoot = null;
    this.yLearningObjectivesRoot = null;
    this.yDoc = null;
    this.finishLearningObjectiveYjsRestore();
    for (const timeoutId of this.pendingLearningObjectiveDeleteSettlements.values()) {
      clearTimeout(timeoutId);
    }
    this.pendingLearningObjectiveDeleteSettlements.clear();
    this.syncPeerInfos.set([]);
  }

  /** Trennt nur den Relay-Provider; Y.Doc und IndexedDB bleiben erhalten. */
  private teardownYjsProvider(): void {
    this.yjsProviderAttachGeneration++;
    try {
      this.yProvider?.awareness.off('change', this.onAwarenessChanged);
    } catch {
      // Best effort cleanup.
    }
    this.yProvider?.destroy();
    this.yProvider = null;
    this.syncPeerInfos.set([]);
    this.syncConnectionState.set('disconnected');
  }

  private canUseYjsSetupResult(generation: number, roomId: string): boolean {
    return (
      isPlatformBrowser(this.platformId) &&
      generation === this.yjsInitGeneration &&
      this.syncRoomId() === roomId
    );
  }

  private canAttachYjsProvider(
    yjsGeneration: number,
    providerGeneration: number,
    roomId: string,
    shareToken: string | null,
  ): boolean {
    return (
      this.canUseYjsSetupResult(yjsGeneration, roomId) &&
      providerGeneration === this.yjsProviderAttachGeneration &&
      this.syncShareToken() === shareToken &&
      this.yDoc !== null &&
      this.yProvider === null
    );
  }

  private loadYjsModule(): Promise<YjsModule> {
    this.yjsModulePromise ??= import('yjs');
    return this.yjsModulePromise;
  }

  private loadIndexedDbPersistenceCtor(): Promise<IndexedDbPersistenceCtor> {
    this.indexedDbPersistencePromise ??= import('y-indexeddb').then(
      (module) => module.IndexeddbPersistence,
    );
    return this.indexedDbPersistencePromise;
  }

  private loadWebsocketProviderCtor(): Promise<WebsocketProviderCtor> {
    this.websocketProviderPromise ??= import('y-websocket').then(
      (module) => module.WebsocketProvider,
    );
    return this.websocketProviderPromise;
  }

  private syncFromYjsOrSeed(): void {
    // A newly imported share has no authoritative local IndexedDB state yet.
    // Wait for the provider's first successful sync before seeding anything;
    // otherwise an empty local snapshot can win Y.Map's last-writer merge and
    // erase the already shared library. The provider confirms the pending token
    // only after both the provider and IndexedDB restore have completed.
    if (this.pendingImportedShareToken?.roomId === this.syncRoomId()) return;

    const hasLearningObjectiveMarker =
      this.yRoot?.get(QUIZ_LEARNING_OBJECTIVES_INITIALIZED_KEY) === '1';
    const hasLearningObjectiveSnapshot =
      hasLearningObjectiveMarker || (this.yLearningObjectivesRoot?.size ?? 0) > 0;
    if (hasLearningObjectiveSnapshot) {
      this.migrateLegacyLearningObjectiveEntries();
      if (this.flushPendingInitialLearningObjectiveOperations()) {
        this.finishLearningObjectiveYjsRestore();
        this.applyYjsLearningObjectivesSnapshot();
      }
    } else {
      this.finishLearningObjectiveYjsRestore();
    }

    const hasQuizSnapshot = typeof this.yRoot?.get(QUIZ_YDOC_ROOT_KEY) === 'string';
    if (hasQuizSnapshot) {
      if (this.applyYjsSnapshot()) {
        this.reapplyPendingImportedQuizChanges();
      }
    } else if (this.quizDocuments().length > 0) {
      this.pendingImportedQuizRestore = null;
      this.writeYjsSnapshot();
    } else {
      this.pendingImportedQuizRestore = null;
    }

    const hasPresetSnapshot = typeof this.yRoot?.get(QUIZ_YDOC_PRESET_KEY) === 'string';
    if (hasPresetSnapshot) {
      this.applyYjsPresetSnapshot();
    } else {
      this.writePresetSnapshotToYjs();
    }

    if (!hasLearningObjectiveMarker) {
      this.writeYjsSnapshot();
    }
  }

  private handleInitialYjsSourceSynced(
    roomId: string,
    source: 'persistence' | 'provider',
    shareToken: string | null = null,
  ): void {
    const pendingShare = this.pendingImportedShareToken;
    const pendingRestore = this.pendingImportedQuizRestore;
    if (pendingShare?.roomId === roomId) {
      if (pendingRestore?.roomId !== roomId) return;
      if (source === 'provider') {
        if (!shareToken || pendingShare.token !== shareToken) return;
        if (!this.capturePendingImportedProviderSnapshot()) return;
        pendingRestore.providerSynced = true;
        if (!pendingRestore.persistenceSynced && !pendingRestore.persistenceStarted) {
          const yDoc = this.yDoc;
          if (!yDoc) return;
          pendingRestore.persistenceStarted = true;
          // Keep a stale IndexedDB update away from the live relay. y-indexeddb
          // applies cached updates with its own origin, which y-websocket would
          // otherwise forward before the authoritative provider snapshot is
          // restored below.
          this.teardownYjsProvider();
          const generation = this.yjsInitGeneration;
          void this.attachYjsIndexedDbPersistence(roomId, yDoc, generation).catch(() => {
            if (this.canUseYjsSetupResult(generation, roomId) && this.yDoc === yDoc) {
              void this.recoverPendingImportedPersistenceFailure(roomId, yDoc, generation);
            }
          });
        }
      } else {
        // Imported rooms attach IndexedDB only after capturing an isolated
        // provider snapshot. Ignore callbacks from a superseded persistence.
        if (!pendingRestore.providerSynced) return;
        pendingRestore.persistenceSynced = true;
      }
      if (!pendingRestore.providerSynced || !pendingRestore.persistenceSynced) return;

      let providerQuizzes: QuizDocument[];
      try {
        providerQuizzes = normalizeStoredQuizzes(
          JSON.parse(pendingRestore.providerSerialized ?? '[]') as unknown,
        );
      } catch {
        return;
      }
      const merged = this.rebasePendingImportedQuizChanges(providerQuizzes);
      const serialized = JSON.stringify(merged);
      this.quizDocuments.set(merged);
      this.restorePendingImportedProviderPreset();
      this.confirmPendingImportedShareToken(roomId, pendingShare.token);
      this.pendingImportedQuizRestore = null;
      this.persistLocalMirror(serialized);
      this.writeYjsSnapshot(serialized, undefined, pendingRestore.providerPresetSerialized);
      this.syncFromYjsOrSeed();
      void this.attachYjsWebSocketProviderIfNeeded(this.yjsInitGeneration, roomId);
      return;
    }

    if (source === 'provider') {
      this.confirmPendingImportedShareToken(roomId, shareToken);
    }
    this.syncFromYjsOrSeed();
  }

  private capturePendingImportedProviderSnapshot(): boolean {
    const pendingRestore = this.pendingImportedQuizRestore;
    if (!pendingRestore || pendingRestore.roomId !== this.syncRoomId()) return false;
    const raw = this.yRoot?.get(QUIZ_YDOC_ROOT_KEY);
    try {
      pendingRestore.providerSerialized =
        typeof raw === 'string'
          ? JSON.stringify(normalizeStoredQuizzes(JSON.parse(raw) as unknown))
          : '[]';
      const rawPreset = this.yRoot?.get(QUIZ_YDOC_PRESET_KEY);
      try {
        const providerPreset =
          typeof rawPreset === 'string'
            ? normalizeHomePresetSnapshot(JSON.parse(rawPreset) as unknown)
            : null;
        pendingRestore.providerPresetSerialized = providerPreset
          ? JSON.stringify(providerPreset)
          : null;
      } catch {
        pendingRestore.providerPresetSerialized = null;
      }
      return true;
    } catch {
      return false;
    }
  }

  private restorePendingImportedProviderPreset(): void {
    const pendingRestore = this.pendingImportedQuizRestore;
    if (!pendingRestore || !this.yDoc || !this.yRoot || !isPlatformBrowser(this.platformId)) return;

    let providerPreset: HomePresetSnapshot | null;
    try {
      providerPreset = pendingRestore.providerPresetSerialized
        ? normalizeHomePresetSnapshot(
            JSON.parse(pendingRestore.providerPresetSerialized) as unknown,
          )
        : null;
    } catch {
      return;
    }

    this.isWritingYjsSnapshot = true;
    try {
      this.yDoc.transact(() => {
        if (pendingRestore.providerPresetSerialized === null) {
          this.yRoot!.delete(QUIZ_YDOC_PRESET_KEY);
        } else {
          this.yRoot!.set(QUIZ_YDOC_PRESET_KEY, pendingRestore.providerPresetSerialized);
        }
      }, this);
      try {
        applyHomePresetSnapshot(
          providerPreset ?? {
            theme: null,
            preset: null,
            seriousOptions: null,
            playfulOptions: null,
          },
        );
      } catch {
        // localStorage may be disabled or full. The authoritative Yjs value is
        // already restored; do not strand the imported share in pending state.
      }
    } finally {
      this.isWritingYjsSnapshot = false;
    }
  }

  private readonly onYjsRootChanged = (
    _event: import('yjs').YMapEvent<string>,
    transaction: import('yjs').Transaction,
  ): void => {
    if (this.isWritingYjsSnapshot) return;
    if (
      this.yProvider !== null &&
      transaction.origin === this.yProvider &&
      this.pendingImportedQuizRestore?.providerSynced
    ) {
      this.capturePendingImportedProviderSnapshot();
    }
    if (!this.learningObjectiveYjsRestorePending) {
      this.migrateLegacyLearningObjectiveEntries();
      this.applyYjsLearningObjectivesSnapshot();
    }
    this.applyYjsSnapshot();
    this.applyYjsPresetSnapshot();
  };

  private readonly onYjsLearningObjectivesChanged = (): void => {
    if (this.isWritingYjsSnapshot || this.learningObjectiveYjsRestorePending) return;
    this.migrateLegacyLearningObjectiveEntries();
    this.applyYjsLearningObjectivesSnapshot();
    this.applyYjsSnapshot();
  };

  private readonly onYjsDocumentUpdated = (_update: Uint8Array, origin: unknown): void => {
    if (origin === this || this.isWritingYjsSnapshot || this.learningObjectiveYjsRestorePending) {
      return;
    }
    this.migrateLegacyLearningObjectiveEntries();
    this.applyYjsLearningObjectivesSnapshot();
  };

  private learningObjectiveOperationMap(quizId: string): YMapDoc<string> | null {
    if (!this.yDoc || !UUID_PATTERN.test(quizId)) return null;
    return this.yDoc.getMap<string>(`${QUIZ_LEARNING_OBJECTIVES_OPLOG_PREFIX}:${quizId}`);
  }

  /**
   * Converts the former whole-bundle value to append-only per-objective operations.
   * The operation map and format marker are committed in one Yjs transaction so a
   * concurrent offline writer cannot observe a marker without its migration seed.
   */
  private migrateLegacyLearningObjectiveEntries(): void {
    if (
      !this.yDoc ||
      !this.yLearningObjectivesRoot ||
      this.isWritingYjsSnapshot ||
      this.isApplyingYjsSnapshot
    ) {
      return;
    }
    const legacy: Array<{ quizId: string; bundle: QuizLearningObjectiveBundleV1 }> = [];
    for (const [quizId, raw] of this.yLearningObjectivesRoot.entries()) {
      if (raw === QUIZ_LEARNING_OBJECTIVES_OPLOG_MARKER || !UUID_PATTERN.test(quizId)) continue;
      try {
        const parsed = QuizLearningObjectiveBundleV1Schema.safeParse(JSON.parse(raw) as unknown);
        if (parsed.success && parsed.data.quizId === quizId) {
          legacy.push({ quizId, bundle: parsed.data });
        }
      } catch {
        // Malformed legacy values intentionally remain untouched.
      }
    }
    if (legacy.length === 0) return;

    this.isWritingYjsSnapshot = true;
    try {
      this.yDoc.transact(() => {
        for (const { quizId, bundle } of legacy) {
          const operationMap = this.learningObjectiveOperationMap(quizId);
          if (!operationMap) continue;
          if (!this.appendLegacyLearningObjectiveBundleOperations(quizId, operationMap, bundle)) {
            continue;
          }
          this.yLearningObjectivesRoot!.set(quizId, QUIZ_LEARNING_OBJECTIVES_OPLOG_MARKER);
        }
      }, this);
    } finally {
      this.isWritingYjsSnapshot = false;
    }
  }

  /**
   * A mixed-version peer can write a legacy whole-bundle value after this
   * client has already migrated the quiz. Translate that value into causal
   * operations as well: equal-revision edits become visible conflicts instead
   * of being discarded, while a stale bundle cannot infer deletion of a goal
   * that was created concurrently in the oplog.
   */
  private appendLegacyLearningObjectiveBundleOperations(
    quizId: string,
    operationMap: YMapDoc<string>,
    bundle: QuizLearningObjectiveBundleV1,
  ): boolean {
    const materialized = materializeLearningObjectiveOperations(quizId, operationMap);
    if (operationMap.size > 0 && materialized.malformed) {
      this.malformedLearningObjectiveKeys.add(quizId);
      return false;
    }

    const currentById = new Map(
      materialized.bundle.objectives.map((objective) => [objective.id, objective]),
    );
    const desiredById = new Map(bundle.objectives.map((objective) => [objective.id, objective]));
    const pending: LearningObjectiveYjsOperation[] = [];

    for (const objective of bundle.objectives) {
      const current = currentById.get(objective.id);
      if (
        current &&
        objectivePayloadFingerprint(current) === objectivePayloadFingerprint(objective)
      ) {
        continue;
      }
      const objectiveOperations = materialized.operationsByObjective.get(objective.id) ?? [];
      const expectedRevision = objective.revision === 0 ? null : objective.revision - 1;
      const parentCandidates =
        expectedRevision === null
          ? []
          : objectiveOperations.filter(
              (operation) => operation.resultingRevision === expectedRevision,
            );
      // A legacy bundle has no operation identity. Claim one causal parent only
      // when it is unambiguous; otherwise the rootless branch remains a head and
      // requires deliberate conflict resolution.
      const parentOperationIds =
        parentCandidates.length === 1 ? [parentCandidates[0]!.operationId] : [];
      const operationId = generateUuid();
      pending.push({
        schemaVersion: 1,
        operationId,
        quizId,
        objectiveId: objective.id,
        kind: 'upsert',
        expectedRevision,
        resultingRevision: objective.revision,
        bundleResultRevision: bundle.revision,
        parentOperationIds,
        writtenAt: objective.updatedAt,
        objective,
      });
    }

    for (const [objectiveId, current] of currentById.entries()) {
      if (desiredById.has(objectiveId)) continue;
      const objectiveOperations = materialized.operationsByObjective.get(objectiveId) ?? [];
      const latestKnownBundleRevision = Math.max(
        0,
        ...objectiveOperations.map((operation) => operation.bundleResultRevision),
      );
      // Missing entries in an equally old whole-bundle snapshot can be caused
      // by a concurrent create on another client. Only a strictly newer bundle
      // is allowed to express deletion of an already materialized objective.
      if (bundle.revision <= latestKnownBundleRevision) continue;
      if (current.revision >= LEARNING_OBJECTIVE_REVISION_MAX) return false;
      const heads = materialized.highestOperationsByObjective.get(objectiveId) ?? [];
      const operationId = generateUuid();
      pending.push({
        schemaVersion: 1,
        operationId,
        quizId,
        objectiveId,
        kind: 'delete',
        expectedRevision: current.revision,
        resultingRevision: current.revision + 1,
        bundleResultRevision: bundle.revision,
        parentOperationIds: heads.map((operation) => operation.operationId).sort(),
        writtenAt: monotoneLearningObjectiveTimestamp(current),
      });
    }

    if (operationMap.size + pending.length > QUIZ_LEARNING_OBJECTIVES_OPLOG_HARD_LIMIT) {
      this.learningObjectiveSyncError.set(
        $localize`:@@learningObjectives.syncLimit:Der synchronisierte Lernzielverlauf ist zu groß. Änderungen bleiben lokal, bis der Konflikt bereinigt wurde.`,
      );
      return false;
    }
    for (const operation of pending) {
      operationMap.set(operation.operationId, JSON.stringify(operation));
    }
    return true;
  }

  private applyYjsLearningObjectivesSnapshot(): void {
    if (!this.yLearningObjectivesRoot) return;
    const bundles: Record<string, QuizLearningObjectiveBundleV1> = {};
    const malformedKeys = new Set<string>();
    const conflicts: QuizLearningObjectiveSyncConflict[] = [];
    const current = this.learningObjectiveBundles();
    for (const [key, raw] of this.yLearningObjectivesRoot.entries()) {
      if (typeof raw !== 'string') {
        malformedKeys.add(key);
        if (current[key]) bundles[key] = current[key];
        continue;
      }
      if (raw === QUIZ_LEARNING_OBJECTIVES_OPLOG_MARKER) {
        const operationMap = this.learningObjectiveOperationMap(key);
        const materialized = operationMap
          ? materializeLearningObjectiveOperations(key, operationMap)
          : null;
        if (!materialized || materialized.malformed) {
          malformedKeys.add(key);
          if (current[key]) bundles[key] = current[key];
          continue;
        }
        bundles[key] = materialized.bundle;
        conflicts.push(...materialized.conflicts);
        continue;
      }
      try {
        const parsed = QuizLearningObjectiveBundleV1Schema.safeParse(JSON.parse(raw) as unknown);
        if (parsed.success && parsed.data.quizId === key) {
          bundles[key] = parsed.data;
        } else {
          malformedKeys.add(key);
          if (current[key]) bundles[key] = current[key];
        }
      } catch {
        malformedKeys.add(key);
        if (current[key]) bundles[key] = current[key];
      }
    }
    this.malformedLearningObjectiveKeys = malformedKeys;
    this.learningObjectiveSyncConflicts.set(conflicts);
    this.learningObjectiveSyncError.set(
      malformedKeys.size > 0
        ? $localize`:@@learningObjectives.syncInvalid:Mindestens ein synchronisierter Lernzielstand ist beschädigt oder zu groß. Der letzte gültige Stand bleibt erhalten.`
        : null,
    );
    const serialized = JSON.stringify(
      Object.values(bundles).sort((a, b) => a.quizId.localeCompare(b.quizId)),
    );
    if (
      serialized === this.lastSerializedLearningObjectives &&
      this.lastSerializedLearningObjectivesRoomId === this.syncRoomId()
    ) {
      return;
    }
    this.learningObjectiveBundles.set(bundles);
    this.persistLearningObjectiveMirror(serialized);
  }

  private applyYjsSnapshot(): boolean {
    if (!this.yRoot) return false;

    const raw = this.yRoot.get(QUIZ_YDOC_ROOT_KEY);
    if (typeof raw !== 'string') return false;
    if (
      this.pendingImportedQuizRestore?.roomId !== this.syncRoomId() &&
      raw === this.lastSerializedQuizDocuments &&
      this.lastSerializedRoomId === this.syncRoomId()
    ) {
      return true;
    }

    let demoReseeded = false;
    let learningObjectivesChanged = false;
    let applied = false;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const remoteQuizzes = normalizeStoredQuizzes(parsed);
      const validQuizzes = this.rebasePendingImportedQuizChanges(remoteQuizzes);
      const previousQuizzes = this.quizDocuments();
      const objectivesBefore = this.serializeLearningObjectiveBundles();
      const lastRemoteChangedQuiz = determineLastChangedQuiz(previousQuizzes, validQuizzes);
      const hadDemoQuiz = validQuizzes.some((q) => q.id === DEMO_QUIZ_ID);

      this.isApplyingYjsSnapshot = true;
      this.reconcileRemoteQuestionChanges(previousQuizzes, validQuizzes);
      learningObjectivesChanged = objectivesBefore !== this.serializeLearningObjectiveBundles();
      this.quizDocuments.set(validQuizzes);
      this.scheduleLearningObjectiveCleanupForMissingQuizzes(previousQuizzes, validQuizzes, raw);
      if (lastRemoteChangedQuiz) {
        this.recordRemoteSync(lastRemoteChangedQuiz);
      }
      demoReseeded = this.ensureDemoQuiz();
      // Nicht den alten Yjs-Rohstring spiegeln: ensureDemoQuiz kann importiert haben — sonst LS + Fingerprint widerspricht dem Inhalt.
      if (hadDemoQuiz) {
        this.persistLocalMirror(this.serializeQuizDocuments());
      } else {
        this.persistToStorage();
      }
      applied = true;
    } catch {
      // Ignore malformed CRDT payload and keep current in-memory state.
    } finally {
      this.isApplyingYjsSnapshot = false;
      // Während isApplyingYjsSnapshot ist writeYjsSnapshot no-op; nach Demo-Neu-Import muss Yjs/IndexedDB nachziehen.
      if (demoReseeded && this.yRoot && isPlatformBrowser(this.platformId)) {
        const serialized = this.serializeQuizDocuments();
        this.updateSerializedQuizCache(this.syncRoomId(), serialized);
        this.writeYjsSnapshot(serialized);
      } else if (learningObjectivesChanged) {
        const serializedLearningObjectives = this.serializeLearningObjectiveBundles();
        this.persistLearningObjectiveMirror(serializedLearningObjectives);
        this.writeYjsSnapshot(undefined, serializedLearningObjectives);
      }
    }
    return applied;
  }

  private reapplyPendingImportedQuizChanges(): void {
    const pending = this.pendingImportedQuizRestore;
    if (!pending || pending.roomId !== this.syncRoomId()) return;

    let baseline: QuizDocument[];
    let latest: QuizDocument[];
    try {
      baseline = normalizeStoredQuizzes(JSON.parse(pending.baselineSerialized) as unknown);
      latest = normalizeStoredQuizzes(JSON.parse(pending.latestSerialized) as unknown);
    } catch {
      this.pendingImportedQuizRestore = null;
      return;
    }
    this.pendingImportedQuizRestore = null;

    const { quizzes: merged, hasDelta } = this.mergeQuizDocumentDelta(
      baseline,
      latest,
      this.quizDocuments(),
    );
    if (!hasDelta) return;
    this.quizDocuments.set(merged);
    const serialized = JSON.stringify(merged);
    this.persistLocalMirror(serialized);
    this.writeYjsSnapshot(serialized);
  }

  private rebasePendingImportedQuizChanges(remoteQuizzes: QuizDocument[]): QuizDocument[] {
    const pending = this.pendingImportedQuizRestore;
    if (!pending || pending.roomId !== this.syncRoomId()) return remoteQuizzes;

    try {
      const baseline = normalizeStoredQuizzes(JSON.parse(pending.baselineSerialized) as unknown);
      const latest = normalizeStoredQuizzes(JSON.parse(pending.latestSerialized) as unknown);
      const { quizzes: merged } = this.mergeQuizDocumentDelta(baseline, latest, remoteQuizzes);
      pending.baselineSerialized = JSON.stringify(remoteQuizzes);
      pending.latestSerialized = JSON.stringify(merged);
      return merged;
    } catch {
      this.pendingImportedQuizRestore = null;
      return remoteQuizzes;
    }
  }

  private mergeQuizDocumentDelta(
    baseline: readonly QuizDocument[],
    latest: readonly QuizDocument[],
    target: readonly QuizDocument[],
  ): { quizzes: QuizDocument[]; hasDelta: boolean } {
    const baselineById = new Map(baseline.map((quiz) => [quiz.id, quiz]));
    const latestById = new Map(latest.map((quiz) => [quiz.id, quiz]));
    const mergedById = new Map(target.map((quiz) => [quiz.id, quiz]));
    let hasDelta = false;

    for (const quiz of latest) {
      const before = baselineById.get(quiz.id);
      if (before && JSON.stringify(before) === JSON.stringify(quiz)) continue;
      mergedById.set(quiz.id, quiz);
      hasDelta = true;
    }
    for (const quiz of baseline) {
      if (latestById.has(quiz.id)) continue;
      mergedById.delete(quiz.id);
      hasDelta = true;
    }

    return {
      quizzes: [...mergedById.values()].sort(
        (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      ),
      hasDelta,
    };
  }

  private reconcileRemoteQuestionChanges(
    previousQuizzes: readonly QuizDocument[],
    nextQuizzes: readonly QuizDocument[],
  ): void {
    const nextByQuizId = new Map(nextQuizzes.map((quiz) => [quiz.id, quiz]));
    for (const previousQuiz of previousQuizzes) {
      const nextQuiz = nextByQuizId.get(previousQuiz.id);
      // A whole quiz may disappear temporarily during IndexedDB/provider reconciliation.
      if (!nextQuiz) continue;
      const nextQuestions = new Map(nextQuiz.questions.map((question) => [question.id, question]));
      for (const previousQuestion of previousQuiz.questions) {
        const nextQuestion = nextQuestions.get(previousQuestion.id);
        if (!nextQuestion) {
          this.markLearningObjectivesForQuestion(
            previousQuiz.id,
            previousQuestion.id,
            'source-reference-removed',
          );
        } else if (
          questionSemanticFingerprint(previousQuestion) !==
          questionSemanticFingerprint(nextQuestion)
        ) {
          this.markLearningObjectivesForQuestion(
            previousQuiz.id,
            previousQuestion.id,
            'source-content-changed',
          );
        }
      }
    }
  }

  private scheduleLearningObjectiveCleanupForMissingQuizzes(
    previousQuizzes: readonly QuizDocument[],
    nextQuizzes: readonly QuizDocument[],
    observedQuizPayload: string,
  ): void {
    const nextIds = new Set(nextQuizzes.map((quiz) => quiz.id));
    for (const quiz of nextQuizzes) {
      const pending = this.pendingLearningObjectiveDeleteSettlements.get(quiz.id);
      if (pending) clearTimeout(pending);
      this.pendingLearningObjectiveDeleteSettlements.delete(quiz.id);
    }
    const candidateIds = new Set([
      ...previousQuizzes.map((quiz) => quiz.id),
      ...Object.keys(this.learningObjectiveBundles()),
      ...Array.from(this.yLearningObjectivesRoot?.keys() ?? []).filter((key) =>
        UUID_PATTERN.test(key),
      ),
    ]);
    for (const quizId of candidateIds) {
      if (
        nextIds.has(quizId) ||
        quizId === DEMO_QUIZ_ID ||
        !this.learningObjectiveBundles()[quizId] ||
        this.pendingLearningObjectiveDeleteSettlements.has(quizId)
      ) {
        continue;
      }
      const timeoutId = setTimeout(() => {
        this.pendingLearningObjectiveDeleteSettlements.delete(quizId);
        if (
          this.yRoot?.get(QUIZ_YDOC_ROOT_KEY) !== observedQuizPayload ||
          this.quizDocuments().some((quiz) => quiz.id === quizId)
        ) {
          return;
        }
        this.learningObjectiveBundles.update((current) => {
          if (!current[quizId]) return current;
          const next = { ...current };
          delete next[quizId];
          return next;
        });
        // writeYjsSnapshot first appends objective tombstones, then removes the
        // legacy root entry in the same transaction. Returning offline edits at
        // lower revisions can therefore never resurrect a deleted quiz sidecar.
        this.persistToStorage();
      }, QUIZ_LEARNING_OBJECTIVES_DELETE_SETTLEMENT_MS);
      this.pendingLearningObjectiveDeleteSettlements.set(quizId, timeoutId);
    }
  }

  private loadSyncMetadata(roomId: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const raw = localStorage.getItem(this.syncMetadataStorageKey(roomId));
      if (!raw) {
        this.lastConnectedAt.set(null);
        this.lastLocalChangeAt.set(null);
        this.lastRemoteSyncAt.set(null);
        this.lastRemoteChangedQuizName.set(null);
        this.lastRemoteChangedQuizUpdatedAt.set(null);
        this.lastRemoteChangedByDeviceLabel.set(null);
        this.lastRemoteChangedByBrowserLabel.set(null);
        this.originSharedAt.set(null);
        this.originDeviceLabel.set(null);
        this.originBrowserLabel.set(null);
        return;
      }
      const snapshot = normalizeSyncMetadataSnapshot(JSON.parse(raw) as unknown);
      this.lastConnectedAt.set(snapshot.lastConnectedAt);
      this.lastLocalChangeAt.set(snapshot.lastLocalChangeAt);
      this.lastRemoteSyncAt.set(snapshot.lastRemoteSyncAt);
      this.lastRemoteChangedQuizName.set(snapshot.lastRemoteChangedQuizName);
      this.lastRemoteChangedQuizUpdatedAt.set(snapshot.lastRemoteChangedQuizUpdatedAt);
      this.lastRemoteChangedByDeviceLabel.set(snapshot.lastRemoteChangedByDeviceLabel);
      this.lastRemoteChangedByBrowserLabel.set(snapshot.lastRemoteChangedByBrowserLabel);
      this.originSharedAt.set(snapshot.originSharedAt);
      this.originDeviceLabel.set(snapshot.originDeviceLabel);
      this.originBrowserLabel.set(snapshot.originBrowserLabel);
    } catch {
      this.lastConnectedAt.set(null);
      this.lastLocalChangeAt.set(null);
      this.lastRemoteSyncAt.set(null);
      this.lastRemoteChangedQuizName.set(null);
      this.lastRemoteChangedQuizUpdatedAt.set(null);
      this.lastRemoteChangedByDeviceLabel.set(null);
      this.lastRemoteChangedByBrowserLabel.set(null);
      this.originSharedAt.set(null);
      this.originDeviceLabel.set(null);
      this.originBrowserLabel.set(null);
    }
  }

  private persistSyncMetadata(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const roomId = this.syncRoomId();
    if (!roomId) return;

    const snapshot: SyncMetadataSnapshot = {
      lastConnectedAt: this.lastConnectedAt(),
      lastLocalChangeAt: this.lastLocalChangeAt(),
      lastRemoteSyncAt: this.lastRemoteSyncAt(),
      lastRemoteChangedQuizName: this.lastRemoteChangedQuizName(),
      lastRemoteChangedQuizUpdatedAt: this.lastRemoteChangedQuizUpdatedAt(),
      lastRemoteChangedByDeviceLabel: this.lastRemoteChangedByDeviceLabel(),
      lastRemoteChangedByBrowserLabel: this.lastRemoteChangedByBrowserLabel(),
      originSharedAt: this.originSharedAt(),
      originDeviceLabel: this.originDeviceLabel(),
      originBrowserLabel: this.originBrowserLabel(),
    };

    this.pendingSyncMetadataRoomId = roomId;
    this.pendingSyncMetadataSnapshot = snapshot;
    if (this.hasPendingSyncMetadataFlush) {
      return;
    }

    this.hasPendingSyncMetadataFlush = true;
    queueMicrotask(() => {
      const pendingRoomId = this.pendingSyncMetadataRoomId;
      const pendingSnapshot = this.pendingSyncMetadataSnapshot;
      this.hasPendingSyncMetadataFlush = false;
      this.pendingSyncMetadataRoomId = null;
      this.pendingSyncMetadataSnapshot = null;
      if (!pendingRoomId || !pendingSnapshot || !isPlatformBrowser(this.platformId)) return;

      try {
        localStorage.setItem(
          this.syncMetadataStorageKey(pendingRoomId),
          JSON.stringify(pendingSnapshot),
        );
      } catch {
        // Ignore quota/unavailable storage and keep in-memory metadata.
      }
    });
  }

  private recordConnectedAt(): void {
    this.lastConnectedAt.set(new Date().toISOString());
    this.persistSyncMetadata();
  }

  private recordLocalChange(): void {
    this.lastLocalChangeAt.set(new Date().toISOString());
    this.persistSyncMetadata();
  }

  private recordRemoteSync(changedQuiz: QuizDocument): void {
    this.lastRemoteSyncAt.set(new Date().toISOString());
    this.lastRemoteChangedQuizName.set(changedQuiz.name);
    this.lastRemoteChangedQuizUpdatedAt.set(changedQuiz.updatedAt);
    this.lastRemoteChangedByDeviceLabel.set(changedQuiz.updatedByDeviceLabel ?? null);
    this.lastRemoteChangedByBrowserLabel.set(changedQuiz.updatedByBrowserLabel ?? null);
    this.persistSyncMetadata();
  }

  private recordSyncOriginIfMissing(): void {
    if (this.originSharedAt() && this.originDeviceLabel() && this.originBrowserLabel()) {
      return;
    }

    this.originSharedAt.set(this.originSharedAt() ?? new Date().toISOString());
    this.originDeviceLabel.set(this.originDeviceLabel() ?? this.currentDeviceLabel());
    this.originBrowserLabel.set(this.originBrowserLabel() ?? this.currentBrowserLabel());
    this.persistSyncMetadata();
  }

  private serializeQuizDocuments(): string {
    return JSON.stringify(this.quizDocuments());
  }

  private serializeLearningObjectiveBundles(): string {
    return JSON.stringify(
      Object.values(this.learningObjectiveBundles()).sort((a, b) =>
        a.quizId.localeCompare(b.quizId),
      ),
    );
  }

  private updateSerializedQuizCache(roomId: string, serialized: string): void {
    this.lastSerializedRoomId = roomId;
    this.lastSerializedQuizDocuments = serialized;
  }

  private updateSerializedLearningObjectiveCache(roomId: string, serialized: string): void {
    this.lastSerializedLearningObjectivesRoomId = roomId;
    this.lastSerializedLearningObjectives = serialized;
  }

  private readonly onAwarenessChanged = (): void => {
    const states = this.yProvider?.awareness.getStates();
    if (!states) {
      this.syncPeerInfos.set([]);
      return;
    }

    const peersByDeviceId = new Map<string, SyncPeerInfo>();
    for (const awarenessState of states.values()) {
      const candidate = normalizeSyncClientPresence(
        (awarenessState as Record<string, unknown>)['syncClient'],
      );
      if (!candidate || candidate.deviceId === this.currentSyncDeviceId) continue;
      peersByDeviceId.set(candidate.deviceId, {
        deviceId: candidate.deviceId,
        deviceLabel: candidate.deviceLabel,
        browserLabel: candidate.browserLabel,
      });
    }

    this.syncPeerInfos.set(Array.from(peersByDeviceId.values()));
  };

  private appendLearningObjectiveOperation(
    operationMap: YMapDoc<string>,
    operation: LearningObjectiveYjsOperation,
  ): boolean {
    if (operationMap.size >= QUIZ_LEARNING_OBJECTIVES_OPLOG_HARD_LIMIT) {
      this.learningObjectiveSyncError.set(
        $localize`:@@learningObjectives.syncLimit:Der synchronisierte Lernzielverlauf ist zu groß. Änderungen bleiben lokal, bis der Konflikt bereinigt wurde.`,
      );
      return false;
    }
    operationMap.set(operation.operationId, JSON.stringify(operation));
    return true;
  }

  private synchronizeLearningObjectiveBundleOperations(
    quizId: string,
    desired: QuizLearningObjectiveBundleV1 | undefined,
  ): void {
    const operationMap = this.learningObjectiveOperationMap(quizId);
    if (!operationMap) return;
    const materialized = materializeLearningObjectiveOperations(quizId, operationMap);
    if (materialized.malformed) {
      this.malformedLearningObjectiveKeys.add(quizId);
      return;
    }

    const remoteById = new Map(
      materialized.bundle.objectives.map((objective) => [objective.id, objective]),
    );
    const desiredById = new Map(
      (desired?.objectives ?? []).map((objective) => [objective.id, objective]),
    );
    const objectiveIds = new Set([...remoteById.keys(), ...desiredById.keys()]);
    const bundleResultRevision = desired?.revision ?? Math.max(materialized.bundle.revision + 1, 1);

    for (const objectiveId of [...objectiveIds].sort()) {
      const remote = remoteById.get(objectiveId);
      const next = desiredById.get(objectiveId);
      if (
        remote &&
        next &&
        objectivePayloadFingerprint(remote) === objectivePayloadFingerprint(next)
      ) {
        continue;
      }
      if (remote && next && next.revision <= remote.revision) {
        // A stale local mirror never gets promoted over a newer CRDT revision.
        continue;
      }

      const parents = (materialized.highestOperationsByObjective.get(objectiveId) ?? [])
        .map((operation) => operation.operationId)
        .sort();
      const operationId = generateUuid();
      const resultingRevision = next?.revision ?? (remote?.revision ?? 0) + 1;
      const operation: LearningObjectiveYjsOperation = {
        schemaVersion: 1,
        operationId,
        quizId,
        objectiveId,
        kind: next ? 'upsert' : 'delete',
        expectedRevision:
          parents.length === 0 && !remote
            ? next && next.revision === 1
              ? 0
              : null
            : (remote?.revision ?? Math.max(0, resultingRevision - 1)),
        resultingRevision,
        bundleResultRevision,
        parentOperationIds: parents,
        // Diagnostic only. Authority and pruning never consult wall-clock time.
        writtenAt: next?.updatedAt ?? new Date().toISOString(),
        ...(next ? { objective: next } : {}),
      };
      if (!this.appendLearningObjectiveOperation(operationMap, operation)) return;
    }

    this.pruneSettledLearningObjectiveOperations(quizId, operationMap);
  }

  private pruneSettledLearningObjectiveOperations(
    quizId: string,
    operationMap: YMapDoc<string>,
  ): void {
    if (
      operationMap.size <=
      QUIZ_LEARNING_OBJECTIVES_OPLOG_RECENT_PER_OBJECTIVE * Math.max(1, 16)
    ) {
      return;
    }
    const materialized = materializeLearningObjectiveOperations(quizId, operationMap);
    if (materialized.malformed) return;
    const keep = new Set<string>();
    for (const [objectiveId, operations] of materialized.operationsByObjective.entries()) {
      const heads = materialized.highestOperationsByObjective.get(objectiveId) ?? [];
      const headIds = new Set(heads.map((operation) => operation.operationId));
      for (const operation of heads) keep.add(operation.operationId);
      const settledTail = operations
        .filter((operation) => !headIds.has(operation.operationId))
        .sort(
          (left, right) =>
            right.resultingRevision - left.resultingRevision ||
            left.operationId.localeCompare(right.operationId),
        )
        .slice(0, QUIZ_LEARNING_OBJECTIVES_OPLOG_RECENT_PER_OBJECTIVE);
      for (const operation of settledTail) keep.add(operation.operationId);
    }
    for (const operationId of operationMap.keys()) {
      if (!keep.has(operationId)) operationMap.delete(operationId);
    }
  }

  private writeYjsSnapshot(
    serialized?: string,
    serializedLearningObjectives?: string,
    serializedHomePreset?: string | null,
  ): void {
    if (!this.yRoot || !this.yLearningObjectivesRoot || !this.yDoc || this.isApplyingYjsSnapshot) {
      return;
    }
    if (this.pendingImportedShareToken?.roomId === this.syncRoomId()) return;
    const payload = serialized ?? this.serializeQuizDocuments();
    const deferLearningObjectives = this.learningObjectiveYjsRestorePending;
    try {
      if (!deferLearningObjectives) this.migrateLegacyLearningObjectiveEntries();
      const bundles = this.learningObjectiveBundles();
      const quizIds = new Set([
        ...Object.keys(bundles),
        ...Array.from(this.yLearningObjectivesRoot.keys()).filter((key) => UUID_PATTERN.test(key)),
      ]);
      this.isWritingYjsSnapshot = true;
      this.yDoc.transact(() => {
        this.yRoot!.set(QUIZ_YDOC_ROOT_KEY, payload);
        if (!deferLearningObjectives) {
          this.yRoot!.set(QUIZ_LEARNING_OBJECTIVES_INITIALIZED_KEY, '1');
          for (const quizId of [...quizIds].sort()) {
            if (this.malformedLearningObjectiveKeys.has(quizId)) continue;
            const bundle = bundles[quizId];
            this.synchronizeLearningObjectiveBundleOperations(quizId, bundle);
            if (bundle) {
              this.yLearningObjectivesRoot!.set(quizId, QUIZ_LEARNING_OBJECTIVES_OPLOG_MARKER);
            } else {
              this.yLearningObjectivesRoot!.delete(quizId);
            }
          }
        }
      }, this);
      if (!deferLearningObjectives) {
        this.updateSerializedLearningObjectiveCache(
          this.syncRoomId(),
          serializedLearningObjectives ?? this.serializeLearningObjectiveBundles(),
        );
      }
      if (serializedHomePreset === undefined) {
        this.writePresetSnapshotToYjs();
      } else if (serializedHomePreset === null) {
        this.yRoot.delete(QUIZ_YDOC_PRESET_KEY);
      } else {
        this.yRoot.set(QUIZ_YDOC_PRESET_KEY, serializedHomePreset);
      }
    } catch {
      // Keep local state even if Yjs write fails.
    } finally {
      this.isWritingYjsSnapshot = false;
    }
  }

  private applyYjsPresetSnapshot(): void {
    if (!this.yRoot || !isPlatformBrowser(this.platformId)) return;

    const raw = this.yRoot.get(QUIZ_YDOC_PRESET_KEY);
    if (typeof raw !== 'string') return;

    try {
      const snapshot = normalizeHomePresetSnapshot(JSON.parse(raw) as unknown);
      if (!snapshot) return;
      this.isApplyingYjsSnapshot = true;
      applyHomePresetSnapshot(snapshot);
    } catch {
      // Ignore malformed preference snapshot.
    } finally {
      this.isApplyingYjsSnapshot = false;
    }
  }

  private writePresetSnapshotToYjs(): void {
    if (!this.yRoot || this.isApplyingYjsSnapshot || !isPlatformBrowser(this.platformId)) return;
    try {
      const snapshot = readHomePresetSnapshot();
      if (!snapshot) {
        this.yRoot.delete(QUIZ_YDOC_PRESET_KEY);
        return;
      }
      this.yRoot.set(QUIZ_YDOC_PRESET_KEY, JSON.stringify(snapshot));
    } catch {
      // Keep local state even if preference sync fails.
    }
  }

  private resolveInitialSyncRoomId(): string {
    if (!isPlatformBrowser(this.platformId)) {
      return 'local-only';
    }

    const stored = localStorage.getItem(QUIZ_SYNC_ROOM_STORAGE_KEY);
    const normalizedStored = normalizeSyncRoomId(stored);
    if (normalizedStored) {
      this.hasStoredSyncRoomId = true;
      return normalizedStored;
    }

    return generateUuid();
  }

  private resolveInitialLibrarySharingMode(): LibrarySharingMode {
    if (!isPlatformBrowser(this.platformId)) {
      return 'local';
    }

    return localStorage.getItem(QUIZ_LIBRARY_SHARING_MODE_KEY) === 'shared' ? 'shared' : 'local';
  }

  private resolveCurrentSyncDeviceId(): string {
    if (!isPlatformBrowser(this.platformId)) {
      return 'server';
    }

    const stored = localStorage.getItem(QUIZ_SYNC_DEVICE_ID_KEY);
    if (stored) {
      return stored;
    }

    const generated = generateUuid();
    localStorage.setItem(QUIZ_SYNC_DEVICE_ID_KEY, generated);
    return generated;
  }

  private storeSyncRoomId(roomId: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(QUIZ_SYNC_ROOM_STORAGE_KEY, roomId);
    this.hasStoredSyncRoomId = true;
  }

  private setLibrarySharingMode(mode: LibrarySharingMode): void {
    this.librarySharingMode.set(mode);
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(QUIZ_LIBRARY_SHARING_MODE_KEY, mode);
  }

  private storageKeyForRoom(roomId: string): string {
    return `${QUIZ_STORAGE_KEY}:${roomId}`;
  }

  private learningObjectiveStorageKey(roomId: string): string {
    return `${QUIZ_LEARNING_OBJECTIVES_STORAGE_PREFIX}:${roomId}`;
  }

  private syncMetadataStorageKey(roomId: string): string {
    return `${QUIZ_SYNC_METADATA_PREFIX}:${roomId}`;
  }

  private shareTokenStorageKey(roomId: string): string {
    return `${QUIZ_SYNC_SHARE_TOKEN_PREFIX}:${roomId}`;
  }

  private rotationCapabilityStorageKey(roomId: string): string {
    return `${QUIZ_SYNC_ROTATION_CAPABILITY_PREFIX}:${roomId}`;
  }

  private loadShareSecrets(roomId: string): void {
    if (this.pendingImportedShareToken?.roomId !== roomId) {
      this.pendingImportedShareToken = null;
      this.pendingImportedQuizRestore = null;
    }
    if (!isPlatformBrowser(this.platformId)) {
      this.syncShareToken.set(null);
      this.canInvalidateSyncLink.set(false);
      return;
    }
    try {
      const token = localStorage.getItem(this.shareTokenStorageKey(roomId));
      this.syncShareToken.set(token && token.length > 0 ? token : null);
      this.canInvalidateSyncLink.set(!!this.readRotationCapability(roomId));
    } catch {
      this.syncShareToken.set(null);
      this.canInvalidateSyncLink.set(false);
    }
  }

  private persistShareToken(roomId: string, shareToken: string): void {
    if (this.pendingImportedShareToken?.roomId === roomId) {
      this.pendingImportedShareToken = null;
    }
    this.syncShareToken.set(shareToken);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(this.shareTokenStorageKey(roomId), shareToken);
    } catch {
      // Ignore quota errors; in-memory token still used for this session.
    }
  }

  private confirmPendingImportedShareToken(roomId: string, token: string | null): void {
    const pending = this.pendingImportedShareToken;
    if (!token || pending?.roomId !== roomId || pending.token !== token) return;
    this.persistShareToken(roomId, token);
    this.syncShareStatus.set('ready');
    this.syncShareError.set(null);
  }

  private rejectPendingImportedShareToken(roomId: string, token: string | null): void {
    const pending = this.pendingImportedShareToken;
    if (!token || pending?.roomId !== roomId || pending.token !== token) return;
    this.clearPendingImportedPersistenceSyncTimeout();
    this.pendingImportedShareToken = null;
    this.pendingImportedQuizRestore = null;
    this.syncShareToken.set(pending.previousToken);
    this.syncShareStatus.set(pending.previousToken ? 'ready' : 'error');
    this.syncShareError.set($localize`Ungültiger Sync-Share-Token wurde ignoriert.`);
    this.teardownYjsProvider();
    const yDoc = this.yDoc;
    const generation = this.yjsInitGeneration;
    if (yDoc && !this.yPersistence) {
      if (hasIndexedDbSupport()) {
        void this.attachYjsIndexedDbPersistence(roomId, yDoc, generation).catch(() => {
          if (this.canUseYjsSetupResult(generation, roomId) && this.yDoc === yDoc) {
            this.teardownYjs();
            this.syncConnectionState.set('disconnected');
          }
        });
      } else {
        this.handleInitialYjsSourceSynced(roomId, 'persistence');
      }
    }
    if (pending.previousToken) {
      queueMicrotask(() => {
        void this.attachYjsWebSocketProviderIfNeeded(this.yjsInitGeneration, roomId);
      });
    }
  }

  /**
   * Import-/Storage-Tokens dürfen den aktiven Raum nur vorwärts bewegen.
   * Gleichgenerationige abweichende Tokens sind ebenfalls ungültig, da der
   * serverseitige HMAC für Raum und Generation deterministisch ist.
   */
  private acceptShareTokenMonotonically(
    roomId: string,
    candidate: string,
    source: 'import' | 'storage',
  ): boolean {
    const incoming = parseSyncShareToken(candidate);
    if (!incoming || incoming.roomId !== roomId.toLowerCase()) {
      this.syncShareStatus.set(this.syncShareToken() ? 'ready' : 'error');
      this.syncShareError.set($localize`Ungültiger Sync-Share-Token wurde ignoriert.`);
      return false;
    }

    const currentToken = this.syncShareToken();
    const current = currentToken ? parseSyncShareToken(currentToken) : null;
    if (
      current?.roomId === incoming.roomId &&
      (current.generation > incoming.generation ||
        (current.generation === incoming.generation && currentToken !== candidate.trim()))
    ) {
      this.syncShareStatus.set('ready');
      this.syncShareError.set($localize`Ein älterer Sync-Link wurde ignoriert.`);
      return false;
    }

    const normalized = candidate.trim();
    const changed = currentToken !== normalized;
    const repeatedPendingImport =
      source === 'import' &&
      !changed &&
      this.pendingImportedShareToken?.roomId === roomId &&
      this.pendingImportedShareToken.token === normalized &&
      this.pendingImportedQuizRestore?.roomId === roomId;
    this.syncShareToken.set(normalized);
    if (source === 'import' && changed) {
      this.pendingImportedShareToken = {
        roomId,
        token: normalized,
        previousToken: currentToken,
      };
      const serialized = this.serializeQuizDocuments();
      this.pendingImportedQuizRestore = {
        roomId,
        baselineSerialized: serialized,
        latestSerialized: serialized,
        persistenceStarted: false,
        persistenceSynced: !hasIndexedDbSupport(),
        providerSynced: false,
        providerPresetSerialized: null,
        providerSerialized: null,
      };
      this.syncShareStatus.set('pending');
    } else if (repeatedPendingImport) {
      // Opening the same share URL again must not turn an unfinished import
      // into a confirmed one. In particular, retain the failed-cache state so
      // a later provider sync cannot persist the token without cache recovery.
      this.syncShareStatus.set('pending');
    } else {
      this.pendingImportedShareToken = null;
      this.pendingImportedQuizRestore = null;
      this.syncShareStatus.set('ready');
    }
    this.syncShareError.set(null);
    return changed;
  }

  private readRotationCapability(roomId: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const value = localStorage.getItem(this.rotationCapabilityStorageKey(roomId));
      return value && /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : null;
    } catch {
      return null;
    }
  }

  private persistRotationCapability(roomId: string, capability: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(this.rotationCapabilityStorageKey(roomId), capability.toLowerCase());
      this.canInvalidateSyncLink.set(true);
    } catch {
      this.canInvalidateSyncLink.set(false);
    }
  }

  private createRotationCapability(): string {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private async ensureShareRegisteredAndConnect(
    expectedGeneration = this.yjsInitGeneration,
    expectedRoomId = this.syncRoomId(),
  ): Promise<void> {
    if (this.librarySharingMode() === 'shared' && isSyncRoomUuid(expectedRoomId)) {
      if (this.syncShareToken()) {
        this.syncShareStatus.set(
          this.pendingImportedShareToken?.roomId === expectedRoomId ? 'pending' : 'ready',
        );
      } else if (this.pendingSecureAsOrigin) {
        await this.createSecuredSyncShareLink();
        return;
      } else if (!this.syncShareToken()) {
        this.syncShareStatus.set('legacy');
      }
    }
    await this.attachYjsWebSocketProviderIfNeeded(expectedGeneration, expectedRoomId);
  }

  /** Neuer Raum bei behaltenem shared-Mode (Legacy-Migration / Claim-Schutz). */
  private rekeySharedLibraryRoomKeepingShared(newRoomId: string): void {
    const serialized = this.serializeQuizDocuments();
    const serializedLearningObjectives = this.serializeLearningObjectiveBundles();
    this.teardownYjs();
    this.setLibrarySharingMode('shared');
    this.syncRoomId.set(newRoomId);
    this.storeSyncRoomId(newRoomId);
    this.loadSyncMetadata(newRoomId);
    this.syncShareToken.set(null);
    this.canInvalidateSyncLink.set(false);
    this.persistLocalMirror(serialized);
    this.persistLearningObjectiveMirror(serializedLearningObjectives);
    this.updateSerializedQuizCache(newRoomId, serialized);
    this.updateSerializedLearningObjectiveCache(newRoomId, serializedLearningObjectives);
  }
}

function isSyncRoomUuid(value: string): boolean {
  return SYNC_ROOM_UUID_RE.test(value.trim());
}

function parseSyncShareToken(value: string): { roomId: string; generation: number } | null {
  const match =
    /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([1-9][0-9]{0,9})\.[A-Za-z0-9_-]{43}$/i.exec(
      value.trim(),
    );
  if (!match?.[1] || !match[2]) return null;
  const generation = Number(match[2]);
  if (!Number.isSafeInteger(generation) || generation < 1) return null;
  return { roomId: match[1].toLowerCase(), generation };
}

/** Rohwert aus Formular/Input für Zod-Metadaten (leer → null). */
function normalizeMotifImageUrlInput(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = String(value).trim();
  return t.length === 0 ? null : t;
}

function normalizeMotifImageCreditInput(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = String(value).trim();
  return t.length === 0 ? null : t;
}

function readStoredMotifImageUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  return MotifImageUrlSchema.safeParse(t).success ? t : null;
}

function readStoredMotifImageCredit(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  return MotifImageCreditSchema.safeParse(t).success ? t : null;
}

function normalizeStoredQuiz(value: unknown): QuizDocument | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const id = candidate['id'];
  const createdAt = candidate['createdAt'];
  const updatedAt = candidate['updatedAt'];

  if (
    typeof id !== 'string' ||
    !UUID_PATTERN.test(id) ||
    typeof createdAt !== 'string' ||
    !isValidDateString(createdAt) ||
    typeof updatedAt !== 'string' ||
    !isValidDateString(updatedAt)
  ) {
    return null;
  }

  const description = normalizeDescription(readDescription(candidate['description']));
  const metadata = QuizMetadataSchema.safeParse({
    name: candidate['name'],
    description,
    motifImageUrl: readStoredMotifImageUrl(candidate['motifImageUrl']),
    motifImageCredit: readStoredMotifImageCredit(candidate['motifImageCredit']),
  });
  if (!metadata.success) return null;

  const questionsRaw = Array.isArray(candidate['questions']) ? candidate['questions'] : [];
  const normalizedQuestions: QuizQuestion[] = [];
  for (const [index, questionValue] of questionsRaw.entries()) {
    const question = normalizeStoredQuestion(questionValue, index);
    if (question) normalizedQuestions.push(question);
  }

  const questions = normalizedQuestions
    .sort((a, b) => a.order - b.order)
    .map((question, index) => ({ ...question, order: index }));

  const rawLastServer = readStringOrNull(candidate['lastServerQuizId']);
  const lastServerQuizId = rawLastServer && UUID_PATTERN.test(rawLastServer) ? rawLastServer : null;
  const rawLastServerAccessProof = readStringOrNull(candidate['lastServerQuizAccessProof']);
  const lastServerQuizAccessProof =
    rawLastServerAccessProof &&
    (UUID_PATTERN.test(rawLastServerAccessProof) || /^[a-f0-9]{64}$/.test(rawLastServerAccessProof))
      ? rawLastServerAccessProof
      : null;

  return {
    id,
    name: metadata.data.name,
    description: metadata.data.description ?? null,
    motifImageUrl: metadata.data.motifImageUrl ?? null,
    motifImageCredit: metadata.data.motifImageCredit ?? null,
    createdAt,
    updatedAt,
    updatedByDeviceId: readStringOrNull(candidate['updatedByDeviceId']) ?? null,
    updatedByDeviceLabel: readStringOrNull(candidate['updatedByDeviceLabel']) ?? null,
    updatedByBrowserLabel: readStringOrNull(candidate['updatedByBrowserLabel']) ?? null,
    lastServerQuizId,
    lastServerQuizAccessProof,
    settings: normalizeStoredQuizSettings(candidate['settings']),
    questions,
  };
}

function determineLastChangedQuiz(
  previousQuizzes: QuizDocument[],
  nextQuizzes: QuizDocument[],
): QuizDocument | null {
  const previousById = new Map(previousQuizzes.map((quiz) => [quiz.id, quiz]));
  const changed = nextQuizzes.filter((quiz) => {
    const previous = previousById.get(quiz.id);
    return !previous || previous.updatedAt !== quiz.updatedAt;
  });

  if (changed.length === 0) {
    return null;
  }

  return changed.reduce<QuizDocument | null>((latest, quiz) => {
    if (!latest) return quiz;
    return Date.parse(quiz.updatedAt) > Date.parse(latest.updatedAt) ? quiz : latest;
  }, null);
}

function normalizeStoredQuizzes(value: unknown): QuizDocument[] {
  if (!Array.isArray(value)) return [];

  const validQuizzes: QuizDocument[] = [];
  for (const entry of value) {
    const normalized = normalizeStoredQuiz(entry);
    if (normalized) validQuizzes.push(normalized);
  }

  return validQuizzes.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function parseQuizSettings(input: Partial<QuizSettings>): QuizSettings {
  const parsed = QuizSettingsSchema.safeParse({
    showLeaderboard: input.showLeaderboard,
    allowCustomNicknames: input.allowCustomNicknames,
    defaultTimer: input.defaultTimer ?? null,
    timerScaleByDifficulty: input.timerScaleByDifficulty ?? true,
    enableTimerAccommodation: input.enableTimerAccommodation ?? true,
    enableSoundEffects: input.enableSoundEffects,
    enableRewardEffects: input.enableRewardEffects,
    enableMotivationMessages: input.enableMotivationMessages,
    enableEmojiReactions: input.enableEmojiReactions,
    showQuestionTypeIndicators: input.showQuestionTypeIndicators,
    anonymousMode: input.anonymousMode,
    teamMode: input.teamMode,
    teamCount: input.teamCount ?? undefined,
    teamAssignment: input.teamAssignment,
    teamNames: normalizeTeamNames(input.teamNames),
    backgroundMusic: normalizeBackgroundMusic(input.backgroundMusic),
    nicknameTheme: input.nicknameTheme,
    bonusTokenCount: input.bonusTokenCount ?? null,
    readingPhaseEnabled: input.readingPhaseEnabled,
    preset: input.preset,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? $localize`Ungültige Quiz-Einstellungen.`;
    throw new Error(message);
  }

  return {
    showLeaderboard: parsed.data.showLeaderboard,
    allowCustomNicknames: parsed.data.allowCustomNicknames,
    defaultTimer: parsed.data.defaultTimer ?? null,
    timerScaleByDifficulty: parsed.data.timerScaleByDifficulty ?? true,
    enableTimerAccommodation: parsed.data.enableTimerAccommodation ?? true,
    enableSoundEffects: parsed.data.enableSoundEffects,
    enableRewardEffects: parsed.data.enableRewardEffects,
    enableMotivationMessages: parsed.data.enableMotivationMessages,
    enableEmojiReactions: parsed.data.enableEmojiReactions,
    showQuestionTypeIndicators: parsed.data.showQuestionTypeIndicators ?? true,
    anonymousMode: parsed.data.anonymousMode,
    teamMode: parsed.data.teamMode,
    teamCount: parsed.data.teamCount ?? null,
    teamAssignment: parsed.data.teamAssignment ?? 'AUTO',
    teamNames: parsed.data.teamNames ?? [],
    backgroundMusic: normalizeBackgroundMusic(parsed.data.backgroundMusic) ?? null,
    nicknameTheme: parsed.data.nicknameTheme,
    bonusTokenCount: parsed.data.bonusTokenCount ?? null,
    readingPhaseEnabled: parsed.data.readingPhaseEnabled ?? true,
    preset: parsed.data.preset ?? 'PLAYFUL',
  };
}

function normalizeStoredQuizSettings(value: unknown): QuizSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_QUIZ_SETTINGS };
  }

  const candidate = value as Record<string, unknown>;
  const teamCountValue = readNumberOrNull(candidate['teamCount']);
  try {
    return parseQuizSettings({
      showLeaderboard: readBoolean(candidate['showLeaderboard']),
      allowCustomNicknames: readBoolean(candidate['allowCustomNicknames']),
      defaultTimer: readNumberOrNull(candidate['defaultTimer']),
      timerScaleByDifficulty: readBoolean(candidate['timerScaleByDifficulty']),
      enableTimerAccommodation: readBoolean(candidate['enableTimerAccommodation']),
      enableSoundEffects: readBoolean(candidate['enableSoundEffects']),
      enableRewardEffects: readBoolean(candidate['enableRewardEffects']),
      enableMotivationMessages: readBoolean(candidate['enableMotivationMessages']),
      enableEmojiReactions: readBoolean(candidate['enableEmojiReactions']),
      showQuestionTypeIndicators: readBoolean(candidate['showQuestionTypeIndicators']),
      anonymousMode: readBoolean(candidate['anonymousMode']),
      teamMode: readBoolean(candidate['teamMode']),
      teamCount: teamCountValue === null ? null : teamCountValue,
      teamAssignment:
        typeof candidate['teamAssignment'] === 'string'
          ? (candidate['teamAssignment'] as TeamAssignment)
          : undefined,
      teamNames: readStringArray(candidate['teamNames']),
      backgroundMusic: readStringOrNull(candidate['backgroundMusic']),
      nicknameTheme: (() => {
        if (typeof candidate['nicknameTheme'] !== 'string') return undefined;
        const parsedTheme = NicknameThemeEnum.safeParse(candidate['nicknameTheme']);
        return parsedTheme.success ? parsedTheme.data : undefined;
      })(),
      bonusTokenCount: readNumberOrNull(candidate['bonusTokenCount']),
      readingPhaseEnabled: readBoolean(candidate['readingPhaseEnabled']),
      preset:
        typeof candidate['preset'] === 'string' ? (candidate['preset'] as QuizPreset) : undefined,
    });
  } catch {
    return { ...DEFAULT_QUIZ_SETTINGS };
  }
}

function validateQuestionInput(input: AddQuizQuestionInput): ValidatedQuestionInput {
  const parsed = AddQuestionInputSchema.safeParse({
    text: input.text.trim(),
    type: input.type,
    difficulty: input.difficulty,
    order: 0,
    answers: input.answers.map((answer) => ({
      text: answer.text.trim(),
      isCorrect: answer.isCorrect,
    })),
    skipReadingPhase: input.skipReadingPhase ?? false,
    ratingMin: input.ratingMin ?? undefined,
    ratingMax: input.ratingMax ?? undefined,
    ratingLabelMin: normalizeNullableLabel(input.ratingLabelMin),
    ratingLabelMax: normalizeNullableLabel(input.ratingLabelMax),
    shortTextEvaluationKind: input.shortTextEvaluationKind ?? undefined,
    shortTextMaxLength: input.shortTextMaxLength ?? undefined,
    shortTextCaseSensitive: input.shortTextCaseSensitive ?? undefined,
    shortTextEvaluationMode: input.shortTextEvaluationMode ?? undefined,
    shortTextToleranceLevel: input.shortTextToleranceLevel ?? undefined,
    shortTextAllowPartialCredit: input.shortTextAllowPartialCredit ?? undefined,
    shortTextTrimWhitespace: input.shortTextTrimWhitespace ?? undefined,
    shortTextNormalizeWhitespace: input.shortTextNormalizeWhitespace ?? undefined,
    numericInputKind: input.numericInputKind ?? undefined,
    numericToleranceMode: input.numericToleranceMode ?? undefined,
    numericAbsoluteTolerance: input.numericAbsoluteTolerance ?? undefined,
    numericRelativeTolerancePercent: input.numericRelativeTolerancePercent ?? undefined,
    numericUnitFamily: input.numericUnitFamily ?? undefined,
    numericRequireUnit: input.numericRequireUnit ?? undefined,
    numericAcceptEquivalentUnits: input.numericAcceptEquivalentUnits ?? undefined,
    timer: input.timer === undefined ? undefined : input.timer,
    numericReferenceValue: input.numericReferenceValue ?? undefined,
    numericTolerancePercent: input.numericTolerancePercent ?? undefined,
    numericIntervalLeft: input.numericIntervalLeft ?? undefined,
    numericIntervalRight: input.numericIntervalRight ?? undefined,
    numericInputType: input.numericInputType ?? undefined,
    numericDecimalPlaces: input.numericDecimalPlaces ?? undefined,
    numericMin: input.numericMin ?? undefined,
    numericMax: input.numericMax ?? undefined,
    numericTwoRounds: input.numericTwoRounds ?? undefined,
    matchingPairs: input.matchingPairs?.map((pair) => ({
      leftId: pair.leftId,
      left: pair.left.trim(),
      rightId: pair.rightId,
      right: pair.right.trim(),
    })),
    matchingShuffleRight: input.matchingShuffleRight ?? undefined,
    orderingItems: input.orderingItems,
    categories: input.categories,
    categorizationItems: input.categorizationItems?.map((item) => ({
      id: item.id,
      text: item.text.trim(),
      correctCategoryId: item.correctCategoryId,
    })),
    categorizationShuffleItems: input.categorizationShuffleItems ?? undefined,
    ...(questionSupportsConfidence(input.type)
      ? {
          confidenceEnabled: input.confidenceEnabled ?? undefined,
          confidenceLabelLow: normalizeNullableLabel(input.confidenceLabelLow),
          confidenceLabelHigh: normalizeNullableLabel(input.confidenceLabelHigh),
        }
      : {}),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? $localize`Ungültige Frage.`;
    throw new Error(message);
  }

  const localIssue = getLocalQuestionValidationIssues(parsed.data)[0];
  if (localIssue) {
    throw new Error(localIssue.message);
  }

  const isNumeric = parsed.data.type === 'NUMERIC_ESTIMATE';
  const isStructured =
    parsed.data.type === 'MATCHING' ||
    parsed.data.type === 'ORDERING' ||
    parsed.data.type === 'CATEGORIZATION';
  const answers =
    parsed.data.type === 'FREETEXT' || parsed.data.type === 'RATING' || isNumeric || isStructured
      ? []
      : parsed.data.answers.map((answer) => ({
          text: answer.text,
          isCorrect: parsed.data.type === 'SURVEY' ? false : answer.isCorrect,
        }));

  const ratingMin = parsed.data.type === 'RATING' ? (parsed.data.ratingMin ?? 1) : null;
  const ratingMax = parsed.data.type === 'RATING' ? (parsed.data.ratingMax ?? 5) : null;
  const ratingLabelMin =
    parsed.data.type === 'RATING'
      ? (normalizeNullableLabel(parsed.data.ratingLabelMin) ?? null)
      : null;
  const ratingLabelMax =
    parsed.data.type === 'RATING'
      ? (normalizeNullableLabel(parsed.data.ratingLabelMax) ?? null)
      : null;
  const shortTextSettings = resolveQuestionShortTextSettings(parsed.data);
  const confidenceSettings = resolveQuestionConfidenceSettings(parsed.data);

  return {
    text: parsed.data.text,
    type: parsed.data.type as SupportedQuestionType,
    difficulty: parsed.data.difficulty,
    timer: parsed.data.timer ?? null,
    answers,
    skipReadingPhase: parsed.data.skipReadingPhase ?? false,
    ratingMin,
    ratingMax,
    ratingLabelMin,
    ratingLabelMax,
    ...shortTextSettings,
    ...confidenceSettings,
    numericToleranceMode: isNumeric
      ? resolveNumericEstimateToleranceMode(parsed.data.numericToleranceMode)
      : shortTextSettings.numericToleranceMode,
    numericReferenceValue: isNumeric ? (input.numericReferenceValue ?? null) : null,
    numericTolerancePercent: isNumeric ? (input.numericTolerancePercent ?? null) : null,
    numericIntervalLeft: isNumeric ? (input.numericIntervalLeft ?? null) : null,
    numericIntervalRight: isNumeric ? (input.numericIntervalRight ?? null) : null,
    numericInputType: isNumeric
      ? ((input.numericInputType as 'INTEGER' | 'DECIMAL' | null | undefined) ?? 'DECIMAL')
      : null,
    numericDecimalPlaces: isNumeric ? (input.numericDecimalPlaces ?? null) : null,
    numericMin: isNumeric ? (input.numericMin ?? null) : null,
    numericMax: isNumeric ? (input.numericMax ?? null) : null,
    numericTwoRounds: isNumeric ? (input.numericTwoRounds ?? false) : false,
    matchingPairs: parsed.data.type === 'MATCHING' ? (parsed.data.matchingPairs ?? null) : null,
    matchingShuffleRight:
      parsed.data.type === 'MATCHING' ? (parsed.data.matchingShuffleRight ?? true) : true,
    orderingItems: parsed.data.type === 'ORDERING' ? (parsed.data.orderingItems ?? null) : null,
    categories: parsed.data.type === 'CATEGORIZATION' ? (parsed.data.categories ?? null) : null,
    categorizationItems:
      parsed.data.type === 'CATEGORIZATION' ? (parsed.data.categorizationItems ?? null) : null,
    categorizationShuffleItems:
      parsed.data.type === 'CATEGORIZATION'
        ? (parsed.data.categorizationShuffleItems ?? true)
        : true,
  };
}

function normalizeStoredMatchingPairs(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const pair = entry as Record<string, unknown>;
    return {
      leftId:
        typeof pair['leftId'] === 'string' && pair['leftId'].length > 0
          ? pair['leftId']
          : generateUuid(),
      left: pair['left'],
      rightId:
        typeof pair['rightId'] === 'string' && pair['rightId'].length > 0
          ? pair['rightId']
          : generateUuid(),
      right: pair['right'],
    };
  });
}

function normalizeStoredCategorizationItems(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const item = entry as Record<string, unknown>;
    return {
      id: typeof item['id'] === 'string' && item['id'].length > 0 ? item['id'] : generateUuid(),
      text: item['text'],
      correctCategoryId: item['correctCategoryId'],
    };
  });
}

function normalizeStoredQuestion(value: unknown, fallbackOrder: number): QuizQuestion | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const id = candidate['id'];
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null;

  const answersRaw = Array.isArray(candidate['answers']) ? candidate['answers'] : [];
  const answers: QuizAnswer[] = [];
  for (const answer of answersRaw) {
    const normalized = normalizeStoredAnswer(answer);
    if (normalized) answers.push(normalized);
  }

  const difficultyRaw =
    typeof candidate['difficulty'] === 'string' ? candidate['difficulty'] : 'MEDIUM';
  const difficultyParsed = DifficultyEnum.safeParse(difficultyRaw);
  if (!difficultyParsed.success) return null;
  const typeRaw = typeof candidate['type'] === 'string' ? candidate['type'] : null;
  const isStoredRating = typeRaw === 'RATING';
  const isStoredShortText = typeRaw === 'SHORT_TEXT';
  const isStoredNumericEstimate = typeRaw === 'NUMERIC_ESTIMATE';
  const isStoredMatching = typeRaw === 'MATCHING';
  const isStoredOrdering = typeRaw === 'ORDERING';
  const isStoredCategorization = typeRaw === 'CATEGORIZATION';

  const parsed = AddQuestionInputSchema.safeParse({
    text: candidate['text'],
    type: candidate['type'],
    difficulty: difficultyParsed.data,
    order: 0,
    answers: answers.map((answer) => ({
      text: answer.text,
      isCorrect: answer.isCorrect,
    })),
    skipReadingPhase: readBoolean(candidate['skipReadingPhase']) ?? false,
    timer: readNumberOrNull(candidate['timer']) ?? undefined,
    ...(isStoredRating
      ? {
          ratingMin: readNumberOrNull(candidate['ratingMin']) ?? undefined,
          ratingMax: readNumberOrNull(candidate['ratingMax']) ?? undefined,
          ratingLabelMin: readStringOrNull(candidate['ratingLabelMin']) ?? undefined,
          ratingLabelMax: readStringOrNull(candidate['ratingLabelMax']) ?? undefined,
        }
      : {}),
    ...(isStoredShortText
      ? {
          shortTextEvaluationKind:
            readStringOrNull(candidate['shortTextEvaluationKind']) ?? undefined,
          shortTextMaxLength: readNumberOrNull(candidate['shortTextMaxLength']) ?? undefined,
          shortTextCaseSensitive: readBoolean(candidate['shortTextCaseSensitive']) ?? undefined,
          shortTextEvaluationMode:
            readStringOrNull(candidate['shortTextEvaluationMode']) ?? undefined,
          shortTextToleranceLevel:
            readStringOrNull(candidate['shortTextToleranceLevel']) ?? undefined,
          shortTextAllowPartialCredit:
            readBoolean(candidate['shortTextAllowPartialCredit']) ?? undefined,
          shortTextTrimWhitespace: readBoolean(candidate['shortTextTrimWhitespace']) ?? undefined,
          shortTextNormalizeWhitespace:
            readBoolean(candidate['shortTextNormalizeWhitespace']) ?? undefined,
          numericInputKind: readStringOrNull(candidate['numericInputKind']) ?? undefined,
          numericToleranceMode: readStringOrNull(candidate['numericToleranceMode']) ?? undefined,
          numericAbsoluteTolerance:
            readNumberOrNull(candidate['numericAbsoluteTolerance']) ?? undefined,
          numericRelativeTolerancePercent:
            readNumberOrNull(candidate['numericRelativeTolerancePercent']) ?? undefined,
          numericUnitFamily: readStringOrNull(candidate['numericUnitFamily']) ?? undefined,
          numericRequireUnit: readBoolean(candidate['numericRequireUnit']) ?? undefined,
          numericAcceptEquivalentUnits:
            readBoolean(candidate['numericAcceptEquivalentUnits']) ?? undefined,
        }
      : {}),
    ...(isStoredNumericEstimate
      ? {
          numericToleranceMode: readStringOrNull(candidate['numericToleranceMode']) ?? undefined,
          numericReferenceValue: readNumberOrNull(candidate['numericReferenceValue']) ?? undefined,
          numericTolerancePercent:
            readNumberOrNull(candidate['numericTolerancePercent']) ?? undefined,
          numericIntervalLeft: readNumberOrNull(candidate['numericIntervalLeft']) ?? undefined,
          numericIntervalRight: readNumberOrNull(candidate['numericIntervalRight']) ?? undefined,
          numericInputType: readStringOrNull(candidate['numericInputType']) ?? undefined,
          numericDecimalPlaces: readNumberOrNull(candidate['numericDecimalPlaces']) ?? undefined,
          numericMin: readNumberOrNull(candidate['numericMin']) ?? undefined,
          numericMax: readNumberOrNull(candidate['numericMax']) ?? undefined,
          numericTwoRounds: readBoolean(candidate['numericTwoRounds']) ?? undefined,
        }
      : {}),
    ...(isStoredMatching
      ? {
          matchingPairs: normalizeStoredMatchingPairs(candidate['matchingPairs']),
          matchingShuffleRight: readBoolean(candidate['matchingShuffleRight']) ?? true,
        }
      : {}),
    ...(isStoredOrdering
      ? {
          orderingItems: Array.isArray(candidate['orderingItems'])
            ? candidate['orderingItems']
            : undefined,
        }
      : {}),
    ...(isStoredCategorization
      ? {
          categories: Array.isArray(candidate['categories']) ? candidate['categories'] : undefined,
          categorizationItems: normalizeStoredCategorizationItems(candidate['categorizationItems']),
          categorizationShuffleItems: readBoolean(candidate['categorizationShuffleItems']) ?? true,
        }
      : {}),
    ...(typeRaw && questionSupportsConfidence(typeRaw)
      ? {
          confidenceEnabled: readBoolean(candidate['confidenceEnabled']) ?? undefined,
          confidenceLabelLow: readStringOrNull(candidate['confidenceLabelLow']) ?? undefined,
          confidenceLabelHigh: readStringOrNull(candidate['confidenceLabelHigh']) ?? undefined,
        }
      : {}),
  });
  if (!parsed.success) return null;

  if (getLocalQuestionValidationIssues(parsed.data).length > 0) {
    return null;
  }

  const storedOrder = candidate['order'];
  const order =
    typeof storedOrder === 'number' && Number.isInteger(storedOrder) && storedOrder >= 0
      ? storedOrder
      : fallbackOrder;

  const enabledRaw = candidate['enabled'];
  const enabled = enabledRaw !== false;
  const shortTextSettings = resolveQuestionShortTextSettings(parsed.data);
  const confidenceSettings = resolveQuestionConfidenceSettings(parsed.data);

  const isNumericStored = parsed.data.type === 'NUMERIC_ESTIMATE';
  return {
    id,
    text: parsed.data.text,
    type: parsed.data.type as SupportedQuestionType,
    difficulty: parsed.data.difficulty,
    order,
    enabled,
    timer: parsed.data.timer ?? null,
    answers,
    skipReadingPhase: parsed.data.skipReadingPhase ?? false,
    ratingMin: parsed.data.type === 'RATING' ? (parsed.data.ratingMin ?? 1) : null,
    ratingMax: parsed.data.type === 'RATING' ? (parsed.data.ratingMax ?? 5) : null,
    ratingLabelMin:
      parsed.data.type === 'RATING'
        ? (normalizeNullableLabel(parsed.data.ratingLabelMin) ?? null)
        : null,
    ratingLabelMax:
      parsed.data.type === 'RATING'
        ? (normalizeNullableLabel(parsed.data.ratingLabelMax) ?? null)
        : null,
    ...confidenceSettings,
    ...shortTextSettings,
    numericToleranceMode: isNumericStored
      ? resolveNumericEstimateToleranceMode(parsed.data.numericToleranceMode)
      : shortTextSettings.numericToleranceMode,
    numericReferenceValue: isNumericStored
      ? readNumberOrNull(candidate['numericReferenceValue'])
      : null,
    numericTolerancePercent: isNumericStored
      ? readNumberOrNull(candidate['numericTolerancePercent'])
      : null,
    numericIntervalLeft: isNumericStored
      ? readNumberOrNull(candidate['numericIntervalLeft'])
      : null,
    numericIntervalRight: isNumericStored
      ? readNumberOrNull(candidate['numericIntervalRight'])
      : null,
    numericInputType: isNumericStored
      ? ((readStringOrNull(candidate['numericInputType']) ?? 'DECIMAL') as 'INTEGER' | 'DECIMAL')
      : null,
    numericDecimalPlaces: isNumericStored
      ? readNumberOrNull(candidate['numericDecimalPlaces'])
      : null,
    numericMin: isNumericStored ? readNumberOrNull(candidate['numericMin']) : null,
    numericMax: isNumericStored ? readNumberOrNull(candidate['numericMax']) : null,
    numericTwoRounds: isNumericStored
      ? (readBoolean(candidate['numericTwoRounds']) ?? false)
      : false,
    matchingPairs:
      parsed.data.type === 'MATCHING' ? (parsed.data.matchingPairs ?? undefined) : undefined,
    matchingShuffleRight:
      parsed.data.type === 'MATCHING' ? (parsed.data.matchingShuffleRight ?? true) : undefined,
    orderingItems:
      parsed.data.type === 'ORDERING' ? (parsed.data.orderingItems ?? undefined) : undefined,
    categories:
      parsed.data.type === 'CATEGORIZATION' ? (parsed.data.categories ?? undefined) : undefined,
    categorizationItems:
      parsed.data.type === 'CATEGORIZATION'
        ? (parsed.data.categorizationItems ?? undefined)
        : undefined,
    categorizationShuffleItems:
      parsed.data.type === 'CATEGORIZATION'
        ? (parsed.data.categorizationShuffleItems ?? true)
        : undefined,
  };
}

function normalizeStoredAnswer(value: unknown): QuizAnswer | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const id = candidate['id'];
  const text = candidate['text'];
  const isCorrect = candidate['isCorrect'];

  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null;
  if (typeof text !== 'string' || text.trim().length === 0 || text.length > 500) return null;
  if (typeof isCorrect !== 'boolean') return null;

  return { id, text: text.trim(), isCorrect };
}

function buildCopyName(value: string): string {
  const suffix = ' (Kopie)';
  const maxLength = 200;
  if (value.length + suffix.length <= maxLength) {
    return `${value}${suffix}`;
  }
  return `${value.slice(0, Math.max(1, maxLength - suffix.length)).trimEnd()}${suffix}`;
}

function normalizeDescription(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeBackgroundMusic(value: string | null | undefined): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableLabel(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTeamNames(value: string[] | null | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => replaceEmojiShortcodes(entry.trim()))
    .filter((entry) => entry.length > 0);
}

function readDescription(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readNumberOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === 'number' ? value : undefined;
}

function readStringOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : undefined;
}

function isValidDateString(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function formatQuizImportIssuePath(path: PropertyKey[]): string {
  if (path.length === 0) return 'Import-Datei';

  const questionIndex = path.indexOf('questions');
  const answerIndex = path.indexOf('answers');
  const segments: string[] = [];

  if (questionIndex >= 0 && typeof path[questionIndex + 1] === 'number') {
    segments.push(`Frage ${Number(path[questionIndex + 1]) + 1}`);
  }
  if (answerIndex >= 0 && typeof path[answerIndex + 1] === 'number') {
    segments.push(`Antwort ${Number(path[answerIndex + 1]) + 1}`);
  }

  const last = path[path.length - 1];
  if (typeof last === 'string') {
    const labels: Record<string, string> = {
      isCorrect: 'Feld "isCorrect"',
      text: 'Feld "text"',
      type: 'Feld "type"',
      difficulty: 'Feld "difficulty"',
      order: 'Feld "order"',
      name: 'Feld "name"',
      quiz: 'Quiz',
      exportVersion: 'Feld "exportVersion"',
    };
    const label = labels[last] ?? `Feld "${last}"`;
    if (!segments.includes(label) && last !== 'questions' && last !== 'answers') {
      segments.push(label);
    }
  }

  return segments.length > 0 ? segments.join(', ') : 'Import-Datei';
}

function normalizeHomePresetSnapshot(value: unknown): HomePresetSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;

  return {
    theme: readStringOrNull(candidate['theme']) ?? null,
    preset: readStringOrNull(candidate['preset']) ?? null,
    seriousOptions: readStringOrNull(candidate['seriousOptions']) ?? null,
    playfulOptions: readStringOrNull(candidate['playfulOptions']) ?? null,
  };
}

function readHomePresetSnapshot(): HomePresetSnapshot | null {
  const snapshot: HomePresetSnapshot = {
    theme: localStorage.getItem(HOME_THEME_STORAGE_KEY),
    preset: localStorage.getItem(HOME_PRESET_STORAGE_KEY),
    seriousOptions: localStorage.getItem(HOME_PRESET_OPTIONS_SERIOUS_KEY),
    playfulOptions: localStorage.getItem(HOME_PRESET_OPTIONS_PLAYFUL_KEY),
  };

  if (!snapshot.theme && !snapshot.preset && !snapshot.seriousOptions && !snapshot.playfulOptions) {
    return null;
  }

  return snapshot;
}

function applyHomePresetSnapshot(snapshot: HomePresetSnapshot): void {
  setStorageValue(HOME_THEME_STORAGE_KEY, snapshot.theme);
  setStorageValue(HOME_PRESET_STORAGE_KEY, snapshot.preset);
  setStorageValue(HOME_PRESET_OPTIONS_SERIOUS_KEY, snapshot.seriousOptions);
  setStorageValue(HOME_PRESET_OPTIONS_PLAYFUL_KEY, snapshot.playfulOptions);
  globalThis.dispatchEvent(new Event(PRESET_UPDATED_EVENT));
}

function setStorageValue(key: string, value: string | null): void {
  if (value === null) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, value);
  }
}

function normalizeSyncMetadataSnapshot(value: unknown): SyncMetadataSnapshot {
  if (!value || typeof value !== 'object') {
    return {
      lastConnectedAt: null,
      lastLocalChangeAt: null,
      lastRemoteSyncAt: null,
      lastRemoteChangedQuizName: null,
      lastRemoteChangedQuizUpdatedAt: null,
      lastRemoteChangedByDeviceLabel: null,
      lastRemoteChangedByBrowserLabel: null,
      originSharedAt: null,
      originDeviceLabel: null,
      originBrowserLabel: null,
    };
  }

  const candidate = value as Record<string, unknown>;
  return {
    lastConnectedAt: readIsoDateOrNull(candidate['lastConnectedAt']),
    lastLocalChangeAt: readIsoDateOrNull(candidate['lastLocalChangeAt']),
    lastRemoteSyncAt: readIsoDateOrNull(candidate['lastRemoteSyncAt']),
    lastRemoteChangedQuizName: readStringOrNull(candidate['lastRemoteChangedQuizName']) ?? null,
    lastRemoteChangedQuizUpdatedAt: readIsoDateOrNull(candidate['lastRemoteChangedQuizUpdatedAt']),
    lastRemoteChangedByDeviceLabel:
      readStringOrNull(candidate['lastRemoteChangedByDeviceLabel']) ?? null,
    lastRemoteChangedByBrowserLabel:
      readStringOrNull(candidate['lastRemoteChangedByBrowserLabel']) ?? null,
    originSharedAt: readIsoDateOrNull(candidate['originSharedAt']),
    originDeviceLabel: readStringOrNull(candidate['originDeviceLabel']) ?? null,
    originBrowserLabel: readStringOrNull(candidate['originBrowserLabel']) ?? null,
  };
}

function normalizeSyncClientPresence(value: unknown): SyncClientPresence | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const deviceId = candidate['deviceId'];
  const deviceLabel = candidate['deviceLabel'];
  const browserLabel = candidate['browserLabel'];
  if (
    typeof deviceId !== 'string' ||
    typeof deviceLabel !== 'string' ||
    typeof browserLabel !== 'string'
  ) {
    return null;
  }
  if (!deviceId.trim() || !deviceLabel.trim() || !browserLabel.trim()) {
    return null;
  }
  return {
    deviceId,
    deviceLabel,
    browserLabel,
  };
}

function readCurrentSyncClientPresence(deviceId?: string): SyncClientPresence {
  return {
    deviceId: deviceId ?? generateUuid(),
    deviceLabel: detectDeviceLabel(),
    browserLabel: detectBrowserLabel(),
  };
}

function detectDeviceLabel(): string {
  if (typeof navigator === 'undefined') {
    return 'Device';
  }
  const userAgent = navigator.userAgent;
  if (/iPhone/i.test(userAgent)) return 'iPhone';
  if (/iPad/i.test(userAgent)) return 'iPad';
  if (/Android/i.test(userAgent) && /Mobile/i.test(userAgent)) return 'Android Phone';
  if (/Android/i.test(userAgent)) return 'Android Tablet';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'Mac';
  if (/Windows/i.test(userAgent)) return 'Windows PC';
  if (/Linux/i.test(userAgent)) return 'Linux PC';
  return 'Device';
}

function detectBrowserLabel(): string {
  if (typeof navigator === 'undefined') {
    return 'Browser';
  }
  const userAgent = navigator.userAgent;
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/Edg\//i.test(userAgent)) return 'Edge';
  if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return 'Chrome';
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'Safari';
  return 'Browser';
}

function readIsoDateOrNull(value: unknown): string | null {
  return typeof value === 'string' && isValidDateString(value) ? value : null;
}

function hasIndexedDbSupport(): boolean {
  return typeof globalThis.indexedDB !== 'undefined';
}

function hasWebsocketSupport(): boolean {
  if (typeof globalThis.WebSocket === 'undefined') return false;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return !/jsdom/i.test(userAgent);
}

function normalizeSyncRoomId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(trimmed)) return null;
  return trimmed;
}

function questionSemanticFingerprint(question: QuizQuestion): string {
  return JSON.stringify({
    text: question.text,
    type: question.type,
    answers: question.answers.map(({ text, isCorrect }) => ({ text, isCorrect })),
    ratingMin: question.ratingMin,
    ratingMax: question.ratingMax,
    ratingLabelMin: question.ratingLabelMin,
    ratingLabelMax: question.ratingLabelMax,
    shortTextEvaluationKind: question.shortTextEvaluationKind,
    shortTextMaxLength: question.shortTextMaxLength,
    shortTextCaseSensitive: question.shortTextCaseSensitive,
    shortTextEvaluationMode: question.shortTextEvaluationMode,
    shortTextToleranceLevel: question.shortTextToleranceLevel,
    shortTextAllowPartialCredit: question.shortTextAllowPartialCredit,
    shortTextTrimWhitespace: question.shortTextTrimWhitespace,
    shortTextNormalizeWhitespace: question.shortTextNormalizeWhitespace,
    numericInputKind: question.numericInputKind,
    numericToleranceMode: question.numericToleranceMode,
    numericAbsoluteTolerance: question.numericAbsoluteTolerance,
    numericRelativeTolerancePercent: question.numericRelativeTolerancePercent,
    numericUnitFamily: question.numericUnitFamily,
    numericRequireUnit: question.numericRequireUnit,
    numericAcceptEquivalentUnits: question.numericAcceptEquivalentUnits,
    numericReferenceValue: question.numericReferenceValue,
    numericTolerancePercent: question.numericTolerancePercent,
    numericIntervalLeft: question.numericIntervalLeft,
    numericIntervalRight: question.numericIntervalRight,
    numericInputType: question.numericInputType,
    numericDecimalPlaces: question.numericDecimalPlaces,
    numericMin: question.numericMin,
    numericMax: question.numericMax,
    numericTwoRounds: question.numericTwoRounds,
    matchingPairs: question.matchingPairs,
    matchingShuffleRight: question.matchingShuffleRight,
    orderingItems: question.orderingItems,
    categories: question.categories,
    categorizationItems: question.categorizationItems,
    categorizationShuffleItems: question.categorizationShuffleItems,
  });
}

function objectivePayloadFingerprint(objective: QuizLearningObjectiveV1): string {
  return JSON.stringify(objective);
}

function monotoneLearningObjectiveTimestamp(objective?: QuizLearningObjectiveV1): string {
  const timestamps = [Date.now()];
  if (objective) {
    timestamps.push(Date.parse(objective.createdAt), Date.parse(objective.updatedAt));
    if (objective.confirmation.state === 'confirmed') {
      timestamps.push(Date.parse(objective.confirmation.confirmedAt));
    } else if (
      objective.confirmation.state === 'needs-review' &&
      objective.confirmation.previousConfirmation.state === 'confirmed'
    ) {
      timestamps.push(Date.parse(objective.confirmation.previousConfirmation.confirmedAt));
    }
  }
  return new Date(Math.max(...timestamps.filter(Number.isFinite))).toISOString();
}

function materializeLearningObjectiveOperations(
  quizId: string,
  operationMap: YMapDoc<string>,
): MaterializedLearningObjectiveOperations {
  const empty = (): MaterializedLearningObjectiveOperations => ({
    bundle: { schemaVersion: 1, quizId, revision: 0, objectives: [] },
    conflicts: [],
    operationsByObjective: new Map(),
    highestOperationsByObjective: new Map(),
    malformed: true,
  });
  if (operationMap.size > QUIZ_LEARNING_OBJECTIVES_OPLOG_HARD_LIMIT) return empty();

  const operationsByObjective = new Map<string, LearningObjectiveYjsOperation[]>();
  const operationById = new Map<string, LearningObjectiveYjsOperation>();
  let bundleRevision = 0;
  for (const [operationId, raw] of operationMap.entries()) {
    const operation = parseLearningObjectiveYjsOperation(raw, operationId, quizId);
    if (!operation) return empty();
    const current = operationsByObjective.get(operation.objectiveId) ?? [];
    current.push(operation);
    operationsByObjective.set(operation.objectiveId, current);
    operationById.set(operation.operationId, operation);
    bundleRevision = Math.max(bundleRevision, operation.bundleResultRevision);
  }

  for (const operation of operationById.values()) {
    if (operation.expectedRevision === null && operation.parentOperationIds.length > 0) {
      return empty();
    }
    for (const parentId of operation.parentOperationIds) {
      const parent = operationById.get(parentId);
      if (!parent) continue;
      if (
        parent.objectiveId !== operation.objectiveId ||
        parent.resultingRevision >= operation.resultingRevision ||
        (operation.expectedRevision !== null &&
          parent.resultingRevision > operation.expectedRevision)
      ) {
        return empty();
      }
    }
  }

  const objectives: QuizLearningObjectiveV1[] = [];
  const conflicts: QuizLearningObjectiveSyncConflict[] = [];
  const highestOperationsByObjective = new Map<string, LearningObjectiveYjsOperation[]>();
  for (const [objectiveId, operations] of operationsByObjective.entries()) {
    const referencedOperationIds = new Set(
      operations.flatMap((operation) => operation.parentOperationIds),
    );
    const heads = operations
      .filter((operation) => !referencedOperationIds.has(operation.operationId))
      .sort(
        (left, right) =>
          right.resultingRevision - left.resultingRevision ||
          left.operationId.localeCompare(right.operationId),
      );
    if (heads.length === 0) return empty();
    highestOperationsByObjective.set(objectiveId, heads);

    const alternatives = new Map<string, LearningObjectiveYjsOperation>();
    for (const operation of heads) {
      const fingerprint =
        operation.kind === 'delete'
          ? 'delete'
          : `upsert:${objectivePayloadFingerprint(operation.objective!)}`;
      if (!alternatives.has(fingerprint)) alternatives.set(fingerprint, operation);
    }
    const distinct = [...alternatives.values()].sort(
      (left, right) =>
        right.resultingRevision - left.resultingRevision ||
        left.operationId.localeCompare(right.operationId),
    );
    const canonical = distinct[0]!;
    if (canonical.kind === 'upsert') objectives.push(canonical.objective!);
    if (distinct.length > 1) {
      conflicts.push({
        quizId,
        objectiveId,
        revision: Math.max(...heads.map((operation) => operation.resultingRevision)),
        headOperationIds: heads.map((operation) => operation.operationId).sort(),
        alternatives: distinct.map((operation) => ({
          operationId: operation.operationId,
          kind: operation.kind,
          objective: operation.objective ?? null,
        })),
      });
    }
  }

  objectives.sort((left, right) => left.id.localeCompare(right.id));
  const parsedBundle = QuizLearningObjectiveBundleV1Schema.safeParse({
    schemaVersion: 1,
    quizId,
    revision: bundleRevision,
    objectives,
  });
  if (!parsedBundle.success) return empty();
  return {
    bundle: parsedBundle.data,
    conflicts,
    operationsByObjective,
    highestOperationsByObjective,
    malformed: false,
  };
}

function parseLearningObjectiveYjsOperation(
  raw: unknown,
  mapOperationId: string,
  quizId: string,
): LearningObjectiveYjsOperation | null {
  if (typeof raw !== 'string' || raw.length > 32_000) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const kind = candidate['kind'];
  const expectedKeys = new Set([
    'schemaVersion',
    'operationId',
    'quizId',
    'objectiveId',
    'kind',
    'expectedRevision',
    'resultingRevision',
    'bundleResultRevision',
    'parentOperationIds',
    'writtenAt',
    ...(kind === 'upsert' ? ['objective'] : []),
  ]);
  if (Object.keys(candidate).some((key) => !expectedKeys.has(key))) return null;
  if (
    candidate['schemaVersion'] !== 1 ||
    candidate['operationId'] !== mapOperationId ||
    !UUID_PATTERN.test(mapOperationId) ||
    candidate['quizId'] !== quizId ||
    !UUID_PATTERN.test(quizId) ||
    typeof candidate['objectiveId'] !== 'string' ||
    !UUID_PATTERN.test(candidate['objectiveId']) ||
    (kind !== 'upsert' && kind !== 'delete') ||
    (candidate['expectedRevision'] !== null &&
      (typeof candidate['expectedRevision'] !== 'number' ||
        !Number.isInteger(candidate['expectedRevision']) ||
        candidate['expectedRevision'] < 0 ||
        candidate['expectedRevision'] > LEARNING_OBJECTIVE_REVISION_MAX)) ||
    !Number.isInteger(candidate['resultingRevision']) ||
    (candidate['resultingRevision'] as number) < 0 ||
    (candidate['resultingRevision'] as number) > LEARNING_OBJECTIVE_REVISION_MAX ||
    !Number.isInteger(candidate['bundleResultRevision']) ||
    (candidate['bundleResultRevision'] as number) < 0 ||
    (candidate['bundleResultRevision'] as number) > LEARNING_OBJECTIVE_REVISION_MAX ||
    !Array.isArray(candidate['parentOperationIds']) ||
    candidate['parentOperationIds'].length > 128 ||
    candidate['parentOperationIds'].some(
      (parentId) => typeof parentId !== 'string' || !UUID_PATTERN.test(parentId),
    ) ||
    new Set(candidate['parentOperationIds']).size !== candidate['parentOperationIds'].length ||
    typeof candidate['writtenAt'] !== 'string' ||
    !isValidDateString(candidate['writtenAt'])
  ) {
    return null;
  }
  const expectedRevision = candidate['expectedRevision'] as number | null;
  const resultingRevision = candidate['resultingRevision'] as number;
  if (expectedRevision !== null && resultingRevision !== expectedRevision + 1) return null;
  if (kind === 'delete') {
    if (expectedRevision === null || 'objective' in candidate) return null;
  } else {
    const objectiveBundle = QuizLearningObjectiveBundleV1Schema.safeParse({
      schemaVersion: 1,
      quizId,
      revision: candidate['bundleResultRevision'],
      objectives: [candidate['objective']],
    });
    if (
      !objectiveBundle.success ||
      objectiveBundle.data.objectives[0]?.id !== candidate['objectiveId'] ||
      objectiveBundle.data.objectives[0]?.revision !== resultingRevision
    ) {
      return null;
    }
  }
  return candidate as unknown as LearningObjectiveYjsOperation;
}

function remapLearningObjectiveBundle(
  source: QuizLearningObjectiveBundleV1,
  quizId: string,
  questionIdMap: ReadonlyMap<string, string>,
  now: string,
): QuizLearningObjectiveBundleV1 | null {
  const orphanIdMap = new Map<string, string>();
  const remapIds = (ids: readonly string[], allowOrphans: boolean): string[] | null => {
    const mapped = ids.map((id) => {
      const questionId = questionIdMap.get(id);
      if (questionId) return questionId;
      if (!allowOrphans) return undefined;
      const existingOrphanId = orphanIdMap.get(id);
      if (existingOrphanId) return existingOrphanId;
      const orphanId = generateUuid();
      orphanIdMap.set(id, orphanId);
      return orphanId;
    });
    return mapped.every((id): id is string => typeof id === 'string') ? mapped : null;
  };

  const objectives: QuizLearningObjectiveV1[] = [];
  for (const objective of source.objectives) {
    const allowOrphans =
      objective.confirmation.state === 'needs-review' &&
      objective.confirmation.reason === 'source-reference-removed';
    const scopedIds =
      objective.scope.kind === 'question-set'
        ? remapIds(objective.scope.sourceQuestionIds, allowOrphans)
        : undefined;
    const derivedIds =
      objective.origin.kind === 'model-derived'
        ? remapIds(objective.origin.derivedFromSourceQuestionIds, allowOrphans)
        : undefined;
    if (scopedIds === null || derivedIds === null) return null;

    const revision = 1;
    const confirmation =
      objective.confirmation.state === 'confirmed'
        ? {
            state: 'confirmed' as const,
            confirmedAt: now,
            confirmedRevision: revision,
          }
        : objective.confirmation.state === 'needs-review'
          ? {
              state: 'needs-review' as const,
              previousConfirmation:
                objective.confirmation.previousConfirmation.state === 'confirmed'
                  ? {
                      state: 'confirmed' as const,
                      revision: 0,
                      confirmedAt: now,
                    }
                  : { state: 'draft' as const, revision: 0 },
              currentRevision: revision,
              reason: objective.confirmation.reason,
            }
          : { state: 'draft' as const };
    objectives.push({
      ...objective,
      id: generateUuid(),
      revision,
      scope:
        objective.scope.kind === 'question-set'
          ? { kind: 'question-set', sourceQuestionIds: scopedIds! }
          : { kind: 'quiz-wide' },
      origin:
        objective.origin.kind === 'model-derived'
          ? {
              ...objective.origin,
              derivedFromSourceQuestionIds: derivedIds!,
            }
          : { kind: 'manual' },
      confirmation,
      createdAt: now,
      updatedAt: now,
    });
  }

  const parsed = QuizLearningObjectiveBundleV1Schema.safeParse({
    schemaVersion: 1,
    quizId,
    revision: source.objectives.length > 0 ? 1 : 0,
    objectives,
  });
  return parsed.success ? parsed.data : null;
}

function generateUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
