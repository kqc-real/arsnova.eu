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
  MotifImageUrlSchema,
  NicknameThemeEnum,
  QuizImportSchema,
  QuizExportSchema,
  QuizUploadInputSchema,
  QUIZ_EXPORT_VERSION,
  type Difficulty,
  type NicknameTheme,
  type QuizPreset,
  type QuizExport,
  type QuizUploadInput,
  type TeamAssignment,
} from '@arsnova/shared-types';
import { getYjsWsUrl } from '../../../core/ws-urls';
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
  | 'SURVEY'
  | 'RATING';

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
  /** false: nicht in Vorschau/Live-Upload; bleibt in der Liste zum späteren Aktivieren */
  enabled: boolean;
  /**
   * Zeitlimit nur für diese Frage (Sekunden). `null` = Quiz-`defaultTimer` verwenden.
   */
  timer: number | null;
  answers: QuizAnswer[];
  ratingMin: number | null;
  ratingMax: number | null;
  ratingLabelMin: string | null;
  ratingLabelMax: string | null;
}

export interface QuizSettings {
  showLeaderboard: boolean;
  allowCustomNicknames: boolean;
  defaultTimer: number | null;
  timerScaleByDifficulty?: boolean;
  enableSoundEffects: boolean;
  enableRewardEffects: boolean;
  enableMotivationMessages: boolean;
  enableEmojiReactions: boolean;
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
  /** `null` oder auslassen = Quiz-`defaultTimer` */
  timer?: number | null;
  answers: Array<{ text: string; isCorrect: boolean }>;
  ratingMin?: number | null;
  ratingMax?: number | null;
  ratingLabelMin?: string | null;
  ratingLabelMax?: string | null;
}

export interface CreateQuizDocumentInput {
  name: string;
  description?: string;
  motifImageUrl?: string | null;
  settings?: Partial<QuizSettings>;
}

export type UpdateQuizSettingsInput = Partial<QuizSettings>;

type ValidatedQuestionInput = {
  text: string;
  type: SupportedQuestionType;
  difficulty: Difficulty;
  timer: number | null;
  answers: Array<{ text: string; isCorrect: boolean }>;
  ratingMin: number | null;
  ratingMax: number | null;
  ratingLabelMin: string | null;
  ratingLabelMax: string | null;
};

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
const QUIZ_SYNC_ROOM_STORAGE_KEY = 'quiz-sync-room-id';
const QUIZ_SYNC_METADATA_PREFIX = 'quiz-sync-meta';
const QUIZ_SYNC_DEVICE_ID_KEY = 'quiz-sync-device-id';
const QUIZ_LIBRARY_SHARING_MODE_KEY = 'quiz-library-sharing-mode';
const QUIZ_SYNC_ROOM_PREFIX = 'quiz-library-room-';
const HOME_THEME_STORAGE_KEY = 'home-theme';
const HOME_PRESET_STORAGE_KEY = 'home-preset';
const HOME_PRESET_OPTIONS_SERIOUS_KEY = 'home-preset-options-serious';
const HOME_PRESET_OPTIONS_PLAYFUL_KEY = 'home-preset-options-spielerisch';
const PRESET_UPDATED_EVENT = 'arsnova:preset-updated';

const QuizMetadataSchema = CreateQuizInputSchema.pick({
  name: true,
  description: true,
  motifImageUrl: true,
});

const QuizSettingsSchema = CreateQuizInputSchema.pick({
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
});

const QuestionCreateSchema = AddQuestionInputSchema.pick({
  text: true,
  type: true,
  difficulty: true,
  answers: true,
  ratingMin: true,
  ratingMax: true,
  ratingLabelMin: true,
  ratingLabelMax: true,
  timer: true,
}).superRefine((value, ctx) => {
  if (
    value.type !== 'MULTIPLE_CHOICE' &&
    value.type !== 'SINGLE_CHOICE' &&
    value.type !== 'FREETEXT' &&
    value.type !== 'SURVEY' &&
    value.type !== 'RATING'
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['type'],
      message:
        'Nur Single Choice, Multiple Choice, Freitext, Umfrage oder Rating ist hier erlaubt.',
    });
    return;
  }

  if (value.type === 'FREETEXT' && value.answers.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['answers'],
      message: $localize`Freitext-Fragen dürfen keine Antwortoptionen enthalten.`,
    });
    return;
  }

  if (value.type === 'FREETEXT') return;

  if (value.type === 'RATING') {
    if (value.answers.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['answers'],
        message: $localize`Rating-Fragen dürfen keine Antwortoptionen enthalten.`,
      });
    }

    const min = value.ratingMin ?? 1;
    const max = value.ratingMax ?? 5;

    if (min !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['ratingMin'],
        message: 'Das Rating-Minimum muss 1 sein.',
      });
    }

    if (max !== 5 && max !== 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['ratingMax'],
        message: 'Das Rating-Maximum muss 5 oder 10 sein.',
      });
    }

    if (max <= min) {
      ctx.addIssue({
        code: 'custom',
        path: ['ratingMax'],
        message: $localize`Das Rating-Maximum muss größer als das Minimum sein.`,
      });
    }

    return;
  }

  if (value.answers.length < 2) {
    ctx.addIssue({
      code: 'custom',
      path: ['answers'],
      message: 'Mindestens zwei Antwortoptionen sind erforderlich.',
    });
    return;
  }

  const correctCount = value.answers.filter((answer) => answer.isCorrect).length;
  if (value.type === 'SURVEY' && correctCount > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['answers'],
      message: $localize`Umfrage-Fragen dürfen keine korrekten Antworten markieren.`,
    });
  }

  if (value.type === 'SINGLE_CHOICE' && correctCount !== 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['answers'],
      message: 'Bei Single Choice muss genau eine Antwort korrekt sein.',
    });
  }

  if (value.type === 'MULTIPLE_CHOICE' && correctCount < 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['answers'],
      message: 'Bei Multiple Choice muss mindestens eine Antwort korrekt sein.',
    });
  }

  if (value.ratingMin !== undefined || value.ratingMax !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['ratingMin'],
      message: $localize`Rating-Grenzen sind nur für Rating-Fragen erlaubt.`,
    });
  }
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_QUIZ_HISTORY_ACCESS_PROOF_PATTERN = /^[a-f0-9]{64}$/i;

const DEFAULT_QUIZ_SETTINGS: QuizSettings = parseQuizSettings({});
type SyncConnectionState = 'connected' | 'connecting' | 'disconnected';
export type LibrarySharingMode = 'local' | 'shared';

export const DEMO_QUIZ_ID = 'de500000-0000-4000-a000-000000000001';

/**
 * Erwarteter Demo-Seed aus Showcase-JSON (Locale + Version + Titel). Alte Keys `arsnova-demo-quiz-locale-v1/v2`
 * allein reichen nicht, wenn der gespeicherte Quiz-Datensatz von der URL-Sprache abweicht.
 */
const DEMO_QUIZ_SEED_FINGERPRINT_KEY = 'arsnova-demo-quiz-seed-fp-v1';

@Injectable({ providedIn: 'root' })
export class QuizStoreService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly quizDocuments = signal<QuizDocument[]>([]);
  readonly syncRoomId = signal('');
  readonly syncConnectionState = signal<SyncConnectionState>('disconnected');
  readonly librarySharingMode = signal<LibrarySharingMode>('local');
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
  private yPersistence: IndexedDbPersistenceInstance | null = null;
  private yProvider: WebsocketProviderInstance | null = null;
  private yjsModulePromise: Promise<YjsModule> | null = null;
  private indexedDbPersistencePromise: Promise<IndexedDbPersistenceCtor> | null = null;
  private websocketProviderPromise: Promise<WebsocketProviderCtor> | null = null;
  private yjsInitGeneration = 0;
  private isApplyingYjsSnapshot = false;
  private hasStoredSyncRoomId = false;
  private lastSerializedQuizDocuments = '[]';
  private lastSerializedRoomId = '';
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

  constructor() {
    const roomId = this.resolveInitialSyncRoomId();
    const currentClient = readCurrentSyncClientPresence();
    this.currentDeviceLabel.set(currentClient.deviceLabel);
    this.currentBrowserLabel.set(currentClient.browserLabel);
    this.librarySharingMode.set(this.resolveInitialLibrarySharingMode());
    this.syncRoomId.set(roomId);
    this.loadSyncMetadata(roomId);
    this.loadFromStorage(roomId, !this.hasStoredSyncRoomId);
    this.ensureDemoQuiz();
    void this.initYjsPersistence(roomId);
    if (isPlatformBrowser(this.platformId)) {
      globalThis.addEventListener(PRESET_UPDATED_EVENT, this.onPresetUpdated);
      // Demo-Quiz-Sprache an URL-Segment koppeln (/de/quiz → /en/quiz ohne Reload).
      this.routerEventsSub = this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => {
          this.ensureDemoQuiz();
        });
    }
  }

  ngOnDestroy(): void {
    this.routerEventsSub?.unsubscribe();
    this.routerEventsSub = null;
    if (isPlatformBrowser(this.platformId)) {
      globalThis.removeEventListener(PRESET_UPDATED_EVENT, this.onPresetUpdated);
    }
    this.teardownYjs();
  }

  getDemoQuizId(): string | null {
    return this.getQuizById(DEMO_QUIZ_ID) ? DEMO_QUIZ_ID : null;
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
    const parsed = QuizMetadataSchema.safeParse({
      name: input.name.trim(),
      description: normalizeDescription(input.description),
      motifImageUrl: normalizeMotifImageUrlInput(input.motifImageUrl),
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
    input: { name: string; description?: string | null; motifImageUrl?: string | null },
  ): QuizDocument {
    const parsed = QuizMetadataSchema.safeParse({
      name: input.name.trim(),
      description: normalizeDescription(input.description),
      motifImageUrl: normalizeMotifImageUrlInput(input.motifImageUrl),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? $localize`Ungültige Quiz-Metadaten.`;
      throw new Error(message);
    }

    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }

    const updatedAt = new Date().toISOString();
    const updated: QuizDocument = {
      ...document,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      motifImageUrl: parsed.data.motifImageUrl ?? null,
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
    const copy: QuizDocument = {
      ...document,
      id: generateUuid(),
      name: buildCopyName(document.name),
      createdAt: now,
      updatedAt: now,
      ...this.currentQuizUpdateSource(),
      lastServerQuizId: null,
      lastServerQuizAccessProof: null,
      questions: document.questions.map((question) => ({
        ...question,
        id: generateUuid(),
        answers: question.answers.map((answer) => ({
          ...answer,
          id: generateUuid(),
        })),
      })),
    };

    this.quizDocuments.update((current) => [copy, ...current]);
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

    this.quizDocuments.update((current) => current.filter((quiz) => quiz.id !== quizId));
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
        name: document.name,
        ...(document.description ? { description: document.description } : {}),
        ...(document.motifImageUrl ? { motifImageUrl: document.motifImageUrl } : {}),
        showLeaderboard: document.settings.showLeaderboard,
        allowCustomNicknames: document.settings.allowCustomNicknames,
        defaultTimer: document.settings.defaultTimer,
        timerScaleByDifficulty: document.settings.timerScaleByDifficulty ?? true,
        enableSoundEffects: document.settings.enableSoundEffects,
        enableRewardEffects: document.settings.enableRewardEffects,
        enableMotivationMessages: document.settings.enableMotivationMessages,
        enableEmojiReactions: document.settings.enableEmojiReactions,
        anonymousMode: document.settings.anonymousMode,
        teamMode: document.settings.teamMode,
        teamCount: document.settings.teamCount,
        teamAssignment: document.settings.teamAssignment,
        teamNames: document.settings.teamNames,
        backgroundMusic: document.settings.backgroundMusic,
        nicknameTheme: document.settings.nicknameTheme,
        bonusTokenCount: document.settings.bonusTokenCount,
        readingPhaseEnabled: document.settings.readingPhaseEnabled,
        questions: document.questions.map((question) => ({
          text: question.text,
          type: question.type,
          difficulty: question.difficulty,
          order: question.order,
          ...(typeof question.timer === 'number' ? { timer: question.timer } : {}),
          answers: question.answers.map((answer) => ({
            text: answer.text,
            isCorrect: answer.isCorrect,
          })),
          ratingMin: question.ratingMin,
          ratingMax: question.ratingMax,
          ratingLabelMin: question.ratingLabelMin,
          ratingLabelMax: question.ratingLabelMax,
          enabled: question.enabled !== false,
        })),
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
    const base =
      lsT > memT
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

    const UPLOAD_DESCRIPTION_MAX = 5000;
    const description =
      document.description && document.description.length > UPLOAD_DESCRIPTION_MAX
        ? document.description.slice(0, UPLOAD_DESCRIPTION_MAX - 3) + '...'
        : document.description;

    const payload: QuizUploadInput = {
      historyScopeId: document.id,
      name: document.name,
      ...(description ? { description } : {}),
      motifImageUrl: normalizeMotifImageUrlInput(document.motifImageUrl) ?? null,
      showLeaderboard: document.settings.showLeaderboard,
      allowCustomNicknames: document.settings.allowCustomNicknames,
      defaultTimer: document.settings.defaultTimer,
      timerScaleByDifficulty: document.settings.timerScaleByDifficulty ?? true,
      enableSoundEffects: document.settings.enableSoundEffects,
      enableRewardEffects: document.settings.enableRewardEffects,
      enableMotivationMessages: document.settings.enableMotivationMessages,
      enableEmojiReactions: document.settings.enableEmojiReactions,
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
      questions: activeQuestions.map((q, index) => ({
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        order: index,
        timer: q.timer ?? null,
        answers: q.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect })),
        ratingMin: q.ratingMin ?? undefined,
        ratingMax: q.ratingMax ?? undefined,
        ratingLabelMin: q.ratingLabelMin ?? undefined,
        ratingLabelMax: q.ratingLabelMax ?? undefined,
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

    const metadata = QuizMetadataSchema.safeParse({
      name: quizData.name.trim(),
      description: normalizeDescription(quizData.description),
      motifImageUrl: normalizeMotifImageUrlInput(quizData.motifImageUrl),
    });
    if (!metadata.success) {
      const message = metadata.error.issues[0]?.message ?? $localize`Ungültige Import-Datei.`;
      throw new Error(`Import fehlgeschlagen: ${message}`);
    }

    const now = new Date().toISOString();
    const imported: QuizDocument = {
      id: overrideId ?? generateUuid(),
      name: metadata.data.name,
      description: metadata.data.description ?? null,
      motifImageUrl: metadata.data.motifImageUrl ?? null,
      createdAt: now,
      updatedAt: now,
      ...this.currentQuizUpdateSource(),
      settings: parseQuizSettings({
        showLeaderboard: quizData.showLeaderboard,
        allowCustomNicknames: quizData.allowCustomNicknames,
        defaultTimer: quizData.defaultTimer ?? null,
        timerScaleByDifficulty: quizData.timerScaleByDifficulty ?? true,
        enableSoundEffects: quizData.enableSoundEffects,
        enableRewardEffects: quizData.enableRewardEffects,
        enableMotivationMessages: quizData.enableMotivationMessages,
        enableEmojiReactions: quizData.enableEmojiReactions,
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
      questions: quizData.questions
        .sort((a, b) => a.order - b.order)
        .map((question, index) => ({
          id: generateUuid(),
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
        })),
    };

    this.quizDocuments.update((current) => [imported, ...current]);
    this.persistToStorage();
    return {
      quiz: imported,
      warnings,
    };
  }

  addQuestion(quizId: string, input: AddQuizQuestionInput): QuizQuestion {
    const parsed = validateQuestionInput(input);

    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }

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
      ratingMin: parsed.ratingMin,
      ratingMax: parsed.ratingMax,
      ratingLabelMin: parsed.ratingLabelMin,
      ratingLabelMax: parsed.ratingLabelMax,
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

    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }

    const questionIndex = document.questions.findIndex((question) => question.id === questionId);
    if (questionIndex < 0) {
      throw new Error('Frage nicht gefunden.');
    }

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
      ratingMin: parsed.ratingMin,
      ratingMax: parsed.ratingMax,
      ratingLabelMin: parsed.ratingLabelMin,
      ratingLabelMax: parsed.ratingLabelMax,
    };

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

  getQuizById(id: string): QuizDocument | null {
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
        return true;
      } catch (e) {
        console.error('[DemoQuiz] Seeding failed:', e);
        return false;
      }
    }

    const titleLocale = detectCanonicalDemoLocaleForTitle(existing.name);
    if (titleLocale !== null && titleLocale !== locale) {
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

  activateSyncRoom(
    roomId: string,
    options?: { markShared?: boolean; registerOrigin?: boolean },
  ): void {
    const normalizedRoomId = normalizeSyncRoomId(roomId);
    if (!normalizedRoomId) {
      throw new Error($localize`Ungültige Sync-ID.`);
    }
    const shouldRegisterOrigin = options?.registerOrigin === true;
    if (options?.markShared) {
      this.setLibrarySharingMode('shared');
    }
    if (this.syncRoomId() === normalizedRoomId) {
      if (options?.markShared) {
        void this.attachYjsWebSocketProviderIfNeeded();
      }
      if (shouldRegisterOrigin) {
        this.recordSyncOriginIfMissing();
      }
      return;
    }

    this.teardownYjs();
    this.syncRoomId.set(normalizedRoomId);
    this.storeSyncRoomId(normalizedRoomId);
    this.loadSyncMetadata(normalizedRoomId);
    if (shouldRegisterOrigin) {
      this.recordSyncOriginIfMissing();
    }

    this.loadFromStorage(normalizedRoomId, false);
    void this.initYjsPersistence(normalizedRoomId);
  }

  /**
   * Trennt die geteilte Quiz-Sammlung und wechselt auf einen neuen lokalen Sync-Raum.
   * Vorhandene Quizze bleiben auf diesem Gerät erhalten.
   */
  unlinkSharedLibrary(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const serialized = this.serializeQuizDocuments();
    const newLocalRoomId = generateUuid();

    this.teardownYjs();
    this.setLibrarySharingMode('local');
    this.syncRoomId.set(newLocalRoomId);
    this.storeSyncRoomId(newLocalRoomId);
    this.loadSyncMetadata(newLocalRoomId);
    this.persistLocalMirror(serialized);
    this.updateSerializedQuizCache(newLocalRoomId, serialized);
    this.ensureDemoQuiz();
    void this.initYjsPersistence(newLocalRoomId);
  }

  private loadFromStorage(roomId: string, allowLegacyFallback: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;

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
      this.quizDocuments.set(validQuizzes);
      this.updateSerializedQuizCache(roomId, JSON.stringify(validQuizzes));

      if (!raw && legacyRaw) {
        this.persistLocalMirror();
      } else if (!Array.isArray(parsed) || validQuizzes.length !== parsed.length) {
        this.persistLocalMirror();
      }
    } catch {
      this.quizDocuments.set([]);
      this.updateSerializedQuizCache(roomId, '[]');
    }
  }

  private persistToStorage(): void {
    this.recordLocalChange();
    const serialized = this.serializeQuizDocuments();
    this.persistLocalMirror(serialized);
    this.writeYjsSnapshot(serialized);
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

  private async initYjsPersistence(roomId: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const generation = ++this.yjsInitGeneration;

    try {
      const Y = await this.loadYjsModule();
      if (!this.canUseYjsSetupResult(generation, roomId)) return;

      const yDoc = new Y.Doc();
      const yRoot = yDoc.getMap<string>('quiz-library');
      yRoot.observe(this.onYjsRootChanged);
      this.yDoc = yDoc;
      this.yRoot = yRoot;

      if (hasIndexedDbSupport()) {
        const IndexeddbPersistence = await this.loadIndexedDbPersistenceCtor();
        if (!this.canUseYjsSetupResult(generation, roomId)) {
          yRoot.unobserve(this.onYjsRootChanged);
          yDoc.destroy();
          return;
        }
        this.yPersistence = new IndexeddbPersistence(`${QUIZ_YDOC_NAME}:${roomId}`, yDoc);
        this.yPersistence.once('synced', () => {
          if (this.yDoc === yDoc && this.syncRoomId() === roomId) {
            this.syncFromYjsOrSeed();
          }
        });
      }

      await this.attachYjsWebSocketProviderIfNeeded(generation, roomId);
    } catch {
      if (this.canUseYjsSetupResult(generation, roomId)) {
        this.teardownYjs();
        this.syncConnectionState.set('disconnected');
      }
    }
  }

  /** Yjs-WebSocket nur bei geteilter Bibliothek – lokal reicht IndexedDB (keine WS-Konsolenfehler ohne Server). */
  private async attachYjsWebSocketProviderIfNeeded(
    expectedGeneration = this.yjsInitGeneration,
    expectedRoomId = this.syncRoomId(),
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

    this.syncConnectionState.set('connecting');
    const WebsocketProvider = await this.loadWebsocketProviderCtor();
    if (!this.canUseYjsSetupResult(expectedGeneration, expectedRoomId) || !this.yDoc) {
      return;
    }

    const yDoc = this.yDoc;
    this.yProvider = new WebsocketProvider(
      getYjsWsUrl(),
      `${QUIZ_SYNC_ROOM_PREFIX}${expectedRoomId}`,
      yDoc,
    );
    this.yProvider.awareness.setLocalStateField(
      'syncClient',
      readCurrentSyncClientPresence(this.currentSyncDeviceId),
    );
    this.yProvider.awareness.on('change', this.onAwarenessChanged);
    this.yProvider.on('sync', (isSynced: boolean) => {
      if (isSynced && this.yDoc === yDoc && this.syncRoomId() === expectedRoomId) {
        this.syncFromYjsOrSeed();
      }
    });
    this.yProvider.on('status', ({ status }: { status: SyncConnectionState }) => {
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

  private teardownYjs(): void {
    this.yjsInitGeneration++;
    try {
      this.yRoot?.unobserve(this.onYjsRootChanged);
    } catch {
      // Best effort cleanup.
    }
    try {
      this.yProvider?.awareness.off('change', this.onAwarenessChanged);
    } catch {
      // Best effort cleanup.
    }
    this.yProvider?.destroy();
    this.yPersistence?.destroy();
    this.yDoc?.destroy();
    this.yProvider = null;
    this.yPersistence = null;
    this.yRoot = null;
    this.yDoc = null;
    this.syncPeerInfos.set([]);
  }

  private canUseYjsSetupResult(generation: number, roomId: string): boolean {
    return (
      isPlatformBrowser(this.platformId) &&
      generation === this.yjsInitGeneration &&
      this.syncRoomId() === roomId
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
    const hasQuizSnapshot = typeof this.yRoot?.get(QUIZ_YDOC_ROOT_KEY) === 'string';
    if (hasQuizSnapshot) {
      this.applyYjsSnapshot();
    } else if (this.quizDocuments().length > 0) {
      this.writeYjsSnapshot();
    }

    const hasPresetSnapshot = typeof this.yRoot?.get(QUIZ_YDOC_PRESET_KEY) === 'string';
    if (hasPresetSnapshot) {
      this.applyYjsPresetSnapshot();
    } else {
      this.writePresetSnapshotToYjs();
    }
  }

  private readonly onYjsRootChanged = (): void => {
    this.applyYjsSnapshot();
    this.applyYjsPresetSnapshot();
  };

  private applyYjsSnapshot(): void {
    if (!this.yRoot) return;

    const raw = this.yRoot.get(QUIZ_YDOC_ROOT_KEY);
    if (typeof raw !== 'string') return;
    if (raw === this.lastSerializedQuizDocuments && this.lastSerializedRoomId === this.syncRoomId())
      return;

    let demoReseeded = false;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const validQuizzes = normalizeStoredQuizzes(parsed);
      const lastRemoteChangedQuiz = determineLastChangedQuiz(this.quizDocuments(), validQuizzes);
      const hadDemoQuiz = validQuizzes.some((q) => q.id === DEMO_QUIZ_ID);

      this.isApplyingYjsSnapshot = true;
      this.quizDocuments.set(validQuizzes);
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
    } catch {
      // Ignore malformed CRDT payload and keep current in-memory state.
    } finally {
      this.isApplyingYjsSnapshot = false;
      // Während isApplyingYjsSnapshot ist writeYjsSnapshot no-op; nach Demo-Neu-Import muss Yjs/IndexedDB nachziehen.
      if (demoReseeded && this.yRoot && isPlatformBrowser(this.platformId)) {
        const serialized = this.serializeQuizDocuments();
        this.updateSerializedQuizCache(this.syncRoomId(), serialized);
        this.writeYjsSnapshot(serialized);
      }
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

  private updateSerializedQuizCache(roomId: string, serialized: string): void {
    this.lastSerializedRoomId = roomId;
    this.lastSerializedQuizDocuments = serialized;
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

  private writeYjsSnapshot(serialized?: string): void {
    if (!this.yRoot || this.isApplyingYjsSnapshot) return;
    const payload = serialized ?? this.serializeQuizDocuments();
    try {
      this.yRoot.set(QUIZ_YDOC_ROOT_KEY, payload);
      this.writePresetSnapshotToYjs();
    } catch {
      // Keep local state even if Yjs write fails.
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

    const generated = generateUuid();
    this.storeSyncRoomId(generated);
    this.hasStoredSyncRoomId = false;
    return generated;
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

  private syncMetadataStorageKey(roomId: string): string {
    return `${QUIZ_SYNC_METADATA_PREFIX}:${roomId}`;
  }
}

/** Rohwert aus Formular/Input für Zod-Metadaten (leer → null). */
function normalizeMotifImageUrlInput(value: string | null | undefined): string | null | undefined {
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
    enableSoundEffects: input.enableSoundEffects,
    enableRewardEffects: input.enableRewardEffects,
    enableMotivationMessages: input.enableMotivationMessages,
    enableEmojiReactions: input.enableEmojiReactions,
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
    enableSoundEffects: parsed.data.enableSoundEffects,
    enableRewardEffects: parsed.data.enableRewardEffects,
    enableMotivationMessages: parsed.data.enableMotivationMessages,
    enableEmojiReactions: parsed.data.enableEmojiReactions,
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
      enableSoundEffects: readBoolean(candidate['enableSoundEffects']),
      enableRewardEffects: readBoolean(candidate['enableRewardEffects']),
      enableMotivationMessages: readBoolean(candidate['enableMotivationMessages']),
      enableEmojiReactions: readBoolean(candidate['enableEmojiReactions']),
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
  const parsed = QuestionCreateSchema.safeParse({
    text: input.text.trim(),
    type: input.type,
    difficulty: input.difficulty,
    answers: input.answers.map((answer) => ({
      text: answer.text.trim(),
      isCorrect: answer.isCorrect,
    })),
    ratingMin: input.ratingMin ?? undefined,
    ratingMax: input.ratingMax ?? undefined,
    ratingLabelMin: normalizeNullableLabel(input.ratingLabelMin),
    ratingLabelMax: normalizeNullableLabel(input.ratingLabelMax),
    timer: input.timer === undefined ? undefined : input.timer,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? $localize`Ungültige Frage.`;
    throw new Error(message);
  }

  const answers =
    parsed.data.type === 'FREETEXT' || parsed.data.type === 'RATING'
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

  return {
    text: parsed.data.text,
    type: parsed.data.type as SupportedQuestionType,
    difficulty: parsed.data.difficulty,
    timer: parsed.data.timer ?? null,
    answers,
    ratingMin,
    ratingMax,
    ratingLabelMin,
    ratingLabelMax,
  };
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

  const parsed = QuestionCreateSchema.safeParse({
    text: candidate['text'],
    type: candidate['type'],
    difficulty: difficultyParsed.data,
    answers: answers.map((answer) => ({
      text: answer.text,
      isCorrect: answer.isCorrect,
    })),
    ratingMin: readNumberOrNull(candidate['ratingMin']) ?? undefined,
    ratingMax: readNumberOrNull(candidate['ratingMax']) ?? undefined,
    ratingLabelMin: readStringOrNull(candidate['ratingLabelMin']) ?? undefined,
    ratingLabelMax: readStringOrNull(candidate['ratingLabelMax']) ?? undefined,
    timer: readNumberOrNull(candidate['timer']) ?? undefined,
  });
  if (!parsed.success) return null;

  const storedOrder = candidate['order'];
  const order =
    typeof storedOrder === 'number' && Number.isInteger(storedOrder) && storedOrder >= 0
      ? storedOrder
      : fallbackOrder;

  const enabledRaw = candidate['enabled'];
  const enabled = enabledRaw !== false;

  return {
    id,
    text: parsed.data.text,
    type: parsed.data.type as SupportedQuestionType,
    difficulty: parsed.data.difficulty,
    order,
    enabled,
    timer: parsed.data.timer ?? null,
    answers,
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
