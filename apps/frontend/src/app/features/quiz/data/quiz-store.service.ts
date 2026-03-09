import {
  Injectable,
  PLATFORM_ID,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import {
  AddQuestionInputSchema,
  CreateQuizInputSchema,
  DifficultyEnum,
  QuizImportSchema,
  QuizExportSchema,
  QUIZ_EXPORT_VERSION,
  type Difficulty,
  type NicknameTheme,
  type QuizExport,
  type TeamAssignment,
} from '@arsnova/shared-types';
import { getYjsWsUrl } from '../../../core/ws-urls';
import demoQuizPayload from '../../../../assets/demo/quiz-demo-showcase.json';

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
  enableSoundEffects: boolean;
  enableRewardEffects: boolean;
  enableMotivationMessages: boolean;
  enableEmojiReactions: boolean;
  anonymousMode: boolean;
  teamMode: boolean;
  teamCount: number | null;
  teamAssignment: TeamAssignment;
  backgroundMusic: string | null;
  nicknameTheme: NicknameTheme;
  bonusTokenCount: number | null;
  readingPhaseEnabled: boolean;
}

export interface QuizDocument {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
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
}

export interface AddQuizQuestionInput {
  text: string;
  type: SupportedQuestionType;
  difficulty: Difficulty;
  answers: Array<{ text: string; isCorrect: boolean }>;
  ratingMin?: number | null;
  ratingMax?: number | null;
  ratingLabelMin?: string | null;
  ratingLabelMax?: string | null;
}

export interface CreateQuizDocumentInput {
  name: string;
  description?: string;
  settings?: Partial<QuizSettings>;
}

export type UpdateQuizSettingsInput = Partial<QuizSettings>;

type ValidatedQuestionInput = {
  text: string;
  type: SupportedQuestionType;
  difficulty: Difficulty;
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

export const QUIZ_STORAGE_KEY = 'quiz-library-v1';
const QUIZ_STORAGE_LEGACY_KEY = QUIZ_STORAGE_KEY;
const QUIZ_YDOC_NAME = 'arsnova-quiz-library-v1';
const QUIZ_YDOC_ROOT_KEY = 'quizzes';
const QUIZ_YDOC_PRESET_KEY = 'home-presets';
const QUIZ_SYNC_ROOM_STORAGE_KEY = 'quiz-sync-room-id';
const QUIZ_SYNC_ROOM_PREFIX = 'quiz-library-room-';
const HOME_THEME_STORAGE_KEY = 'home-theme';
const HOME_PRESET_STORAGE_KEY = 'home-preset';
const HOME_PRESET_OPTIONS_SERIOUS_KEY = 'home-preset-options-serious';
const HOME_PRESET_OPTIONS_PLAYFUL_KEY = 'home-preset-options-spielerisch';
const PRESET_UPDATED_EVENT = 'arsnova:preset-updated';

const QuizMetadataSchema = CreateQuizInputSchema.pick({
  name: true,
  description: true,
});

const QuizSettingsSchema = CreateQuizInputSchema.pick({
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
  backgroundMusic: true,
  nicknameTheme: true,
  bonusTokenCount: true,
  readingPhaseEnabled: true,
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
      message: 'Nur Single Choice, Multiple Choice, Freitext, Umfrage oder Rating ist hier erlaubt.',
    });
    return;
  }

  if (value.type === 'FREETEXT' && value.answers.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['answers'],
      message: 'Freitext-Fragen dürfen keine Antwortoptionen enthalten.',
    });
    return;
  }

  if (value.type === 'FREETEXT') return;

  if (value.type === 'RATING') {
    if (value.answers.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['answers'],
        message: 'Rating-Fragen dürfen keine Antwortoptionen enthalten.',
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
        message: 'Das Rating-Maximum muss größer als das Minimum sein.',
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
      message: 'Umfrage-Fragen dürfen keine korrekten Antworten markieren.',
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
      message: 'Rating-Grenzen sind nur für Rating-Fragen erlaubt.',
    });
  }
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_QUIZ_SETTINGS: QuizSettings = parseQuizSettings({});
type SyncConnectionState = 'connected' | 'connecting' | 'disconnected';

export const DEMO_QUIZ_ID = 'de500000-0000-4000-a000-000000000001';

@Injectable({ providedIn: 'root' })
export class QuizStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly quizDocuments = signal<QuizDocument[]>([]);
  readonly syncRoomId = signal('');
  readonly syncConnectionState = signal<SyncConnectionState>('disconnected');
  private yDoc: Y.Doc | null = null;
  private yRoot: Y.Map<string> | null = null;
  private yPersistence: IndexeddbPersistence | null = null;
  private yProvider: WebsocketProvider | null = null;
  private isApplyingYjsSnapshot = false;
  private hasStoredSyncRoomId = false;
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
    })),
  );

  constructor() {
    const roomId = this.resolveInitialSyncRoomId();
    this.syncRoomId.set(roomId);
    this.loadFromStorage(roomId, !this.hasStoredSyncRoomId);
    this.initYjsPersistence(roomId);
    if (isPlatformBrowser(this.platformId)) {
      globalThis.addEventListener(PRESET_UPDATED_EVENT, this.onPresetUpdated);
    }
  }

  getDemoQuizId(): string | null {
    return this.getQuizById(DEMO_QUIZ_ID) ? DEMO_QUIZ_ID : null;
  }

  createQuiz(input: CreateQuizDocumentInput): QuizDocument {
    const parsed = QuizMetadataSchema.safeParse({
      name: input.name.trim(),
      description: normalizeDescription(input.description),
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Ungültige Quiz-Daten.';
      throw new Error(message);
    }

    const settings = parseQuizSettings(input.settings ?? {});
    const now = new Date().toISOString();
    const created: QuizDocument = {
      id: generateUuid(),
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      createdAt: now,
      updatedAt: now,
      settings,
      questions: [],
    };

    this.quizDocuments.update((current) => [created, ...current]);
    this.persistToStorage();
    return created;
  }

  updateQuizMetadata(
    quizId: string,
    input: { name: string; description?: string | null },
  ): QuizDocument {
    const parsed = QuizMetadataSchema.safeParse({
      name: input.name.trim(),
      description: normalizeDescription(input.description),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Ungültige Quiz-Metadaten.';
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
      updatedAt,
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
        showLeaderboard: document.settings.showLeaderboard,
        allowCustomNicknames: document.settings.allowCustomNicknames,
        defaultTimer: document.settings.defaultTimer,
        enableSoundEffects: document.settings.enableSoundEffects,
        enableRewardEffects: document.settings.enableRewardEffects,
        enableMotivationMessages: document.settings.enableMotivationMessages,
        enableEmojiReactions: document.settings.enableEmojiReactions,
        anonymousMode: document.settings.anonymousMode,
        teamMode: document.settings.teamMode,
        teamCount: document.settings.teamCount,
        teamAssignment: document.settings.teamAssignment,
        backgroundMusic: document.settings.backgroundMusic,
        nicknameTheme: document.settings.nicknameTheme,
        bonusTokenCount: document.settings.bonusTokenCount,
        readingPhaseEnabled: document.settings.readingPhaseEnabled,
        questions: document.questions.map((question) => ({
          text: question.text,
          type: question.type,
          difficulty: question.difficulty,
          order: question.order,
          answers: question.answers.map((answer) => ({
            text: answer.text,
            isCorrect: answer.isCorrect,
          })),
          ratingMin: question.ratingMin,
          ratingMax: question.ratingMax,
          ratingLabelMin: question.ratingLabelMin,
          ratingLabelMax: question.ratingLabelMax,
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

  importQuiz(payload: unknown, overrideId?: string): QuizDocument {
    const parsed = QuizImportSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue
        ? `${formatQuizImportIssuePath(issue.path)}: ${issue.message}`
        : 'Ungültige Import-Datei.';
      throw new Error(`Import fehlgeschlagen: ${message}`);
    }

    const now = new Date().toISOString();
    const imported: QuizDocument = {
      id: overrideId ?? generateUuid(),
      name: parsed.data.quiz.name,
      description: normalizeDescription(parsed.data.quiz.description) ?? null,
      createdAt: now,
      updatedAt: now,
      settings: parseQuizSettings({
        showLeaderboard: parsed.data.quiz.showLeaderboard,
        allowCustomNicknames: parsed.data.quiz.allowCustomNicknames,
        defaultTimer: parsed.data.quiz.defaultTimer ?? null,
        enableSoundEffects: parsed.data.quiz.enableSoundEffects,
        enableRewardEffects: parsed.data.quiz.enableRewardEffects,
        enableMotivationMessages: parsed.data.quiz.enableMotivationMessages,
        enableEmojiReactions: parsed.data.quiz.enableEmojiReactions,
        anonymousMode: parsed.data.quiz.anonymousMode,
        teamMode: parsed.data.quiz.teamMode,
        teamCount: parsed.data.quiz.teamCount ?? null,
        teamAssignment: parsed.data.quiz.teamAssignment,
        backgroundMusic: parsed.data.quiz.backgroundMusic ?? null,
        nicknameTheme: parsed.data.quiz.nicknameTheme,
        bonusTokenCount: parsed.data.quiz.bonusTokenCount ?? null,
        readingPhaseEnabled: parsed.data.quiz.readingPhaseEnabled ?? true,
      }),
      questions: parsed.data.quiz.questions
        .sort((a, b) => a.order - b.order)
        .map((question, index) => ({
          id: generateUuid(),
          text: question.text,
          type: question.type,
          difficulty: question.difficulty,
          order: index,
          answers: question.answers.map((answer) => ({
            id: generateUuid(),
            text: answer.text,
            isCorrect: answer.isCorrect,
          })),
          ratingMin: question.type === 'RATING' ? (question.ratingMin ?? 1) : null,
          ratingMax: question.type === 'RATING' ? (question.ratingMax ?? 5) : null,
          ratingLabelMin:
            question.type === 'RATING'
              ? normalizeNullableLabel(question.ratingLabelMin) ?? null
              : null,
          ratingLabelMax:
            question.type === 'RATING'
              ? normalizeNullableLabel(question.ratingLabelMax) ?? null
              : null,
        })),
    };

    this.quizDocuments.update((current) => [imported, ...current]);
    this.persistToStorage();
    return imported;
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
              questions: [...quiz.questions, question],
            }
          : quiz,
      ),
    );
    this.persistToStorage();

    return question;
  }

  updateQuestion(
    quizId: string,
    questionId: string,
    input: AddQuizQuestionInput,
  ): QuizQuestion {
    const parsed = validateQuestionInput(input);

    const document = this.getQuizById(quizId);
    if (!document) {
      throw new Error('Quiz nicht gefunden.');
    }

    const questionIndex = document.questions.findIndex(
      (question) => question.id === questionId,
    );
    if (questionIndex < 0) {
      throw new Error('Frage nicht gefunden.');
    }

    const existingQuestion = document.questions[questionIndex]!;
    const updatedQuestion: QuizQuestion = {
      ...existingQuestion,
      text: parsed.text,
      type: parsed.type,
      difficulty: parsed.difficulty,
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
        return { ...quiz, updatedAt, questions };
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
        return { ...quiz, updatedAt, questions };
      }),
    );
    this.persistToStorage();
  }

  getQuizById(id: string): QuizDocument | null {
    return this.quizDocuments().find((quiz) => quiz.id === id) ?? null;
  }

  ensureDemoQuiz(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.quizDocuments().some((q) => q.id === DEMO_QUIZ_ID)) return;
    try {
      this.importQuiz(demoQuizPayload, DEMO_QUIZ_ID);
    } catch (e) {
      console.error('[DemoQuiz] Seeding failed:', e);
    }
  }

  activateSyncRoom(roomId: string): void {
    const normalizedRoomId = normalizeSyncRoomId(roomId);
    if (!normalizedRoomId) {
      throw new Error('Ungültige Sync-ID.');
    }
    if (this.syncRoomId() === normalizedRoomId) return;

    this.teardownYjs();
    this.syncRoomId.set(normalizedRoomId);
    this.storeSyncRoomId(normalizedRoomId);

    this.loadFromStorage(normalizedRoomId, false);
    this.initYjsPersistence(normalizedRoomId);
  }

  private loadFromStorage(roomId: string, allowLegacyFallback: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const storageKey = this.storageKeyForRoom(roomId);
      const raw = localStorage.getItem(storageKey);
      const legacyRaw =
        !raw && allowLegacyFallback ? localStorage.getItem(QUIZ_STORAGE_LEGACY_KEY) : null;
      const sourceRaw = raw ?? legacyRaw;
      if (!sourceRaw) return;

      const parsed = JSON.parse(sourceRaw) as unknown;
      const validQuizzes = normalizeStoredQuizzes(parsed);
      this.quizDocuments.set(validQuizzes);

      if (!raw && legacyRaw) {
        this.persistLocalMirror();
      } else if (!Array.isArray(parsed) || validQuizzes.length !== parsed.length) {
        this.persistLocalMirror();
      }
    } catch {
      this.quizDocuments.set([]);
    }
  }

  private persistToStorage(): void {
    this.persistLocalMirror();
    this.writeYjsSnapshot();
  }

  private persistLocalMirror(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const roomId = this.syncRoomId();
    if (!roomId) return;

    try {
      const serialized = JSON.stringify(this.quizDocuments());
      localStorage.setItem(this.storageKeyForRoom(roomId), serialized);
      // Legacy mirror for backward compatibility with existing clients/tests.
      localStorage.setItem(QUIZ_STORAGE_LEGACY_KEY, serialized);
    } catch {
      // Ignore quota/unavailable storage and keep in-memory state.
    }
  }

  private initYjsPersistence(roomId: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      this.yDoc = new Y.Doc();
      this.yRoot = this.yDoc.getMap<string>('quiz-library');
      this.yRoot.observe(this.onYjsRootChanged);

      if (hasIndexedDbSupport()) {
        this.yPersistence = new IndexeddbPersistence(`${QUIZ_YDOC_NAME}:${roomId}`, this.yDoc);
        this.yPersistence.once('synced', () => {
          this.syncFromYjsOrSeed();
        });
      }

      if (hasWebsocketSupport()) {
        this.syncConnectionState.set('connecting');
        this.yProvider = new WebsocketProvider(
          getYjsWsUrl(),
          `${QUIZ_SYNC_ROOM_PREFIX}${roomId}`,
          this.yDoc,
        );
        this.yProvider.on('sync', (isSynced: boolean) => {
          if (isSynced) this.syncFromYjsOrSeed();
        });
        this.yProvider.on('status', ({ status }: { status: SyncConnectionState }) => {
          this.syncConnectionState.set(
            status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected',
          );
        });
      } else {
        this.syncConnectionState.set('disconnected');
      }
    } catch {
      this.teardownYjs();
      this.syncConnectionState.set('disconnected');
    }
  }

  private teardownYjs(): void {
    try {
      this.yRoot?.unobserve(this.onYjsRootChanged);
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

    try {
      const parsed = JSON.parse(raw) as unknown;
      const validQuizzes = normalizeStoredQuizzes(parsed);

      this.isApplyingYjsSnapshot = true;
      this.quizDocuments.set(validQuizzes);
      this.persistLocalMirror();
    } catch {
      // Ignore malformed CRDT payload and keep current in-memory state.
    } finally {
      this.isApplyingYjsSnapshot = false;
    }
  }

  private writeYjsSnapshot(): void {
    if (!this.yRoot || this.isApplyingYjsSnapshot) return;
    try {
      this.yRoot.set(QUIZ_YDOC_ROOT_KEY, JSON.stringify(this.quizDocuments()));
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

  private storeSyncRoomId(roomId: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(QUIZ_SYNC_ROOM_STORAGE_KEY, roomId);
    this.hasStoredSyncRoomId = true;
  }

  private storageKeyForRoom(roomId: string): string {
    return `${QUIZ_STORAGE_KEY}:${roomId}`;
  }
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

  return {
    id,
    name: metadata.data.name,
    description: metadata.data.description ?? null,
    createdAt,
    updatedAt,
    settings: normalizeStoredQuizSettings(candidate['settings']),
    questions,
  };
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
    enableSoundEffects: input.enableSoundEffects,
    enableRewardEffects: input.enableRewardEffects,
    enableMotivationMessages: input.enableMotivationMessages,
    enableEmojiReactions: input.enableEmojiReactions,
    anonymousMode: input.anonymousMode,
    teamMode: input.teamMode,
    teamCount: input.teamCount ?? undefined,
    teamAssignment: input.teamAssignment,
    backgroundMusic: normalizeBackgroundMusic(input.backgroundMusic),
    nicknameTheme: input.nicknameTheme,
    bonusTokenCount: input.bonusTokenCount ?? null,
    readingPhaseEnabled: input.readingPhaseEnabled,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Ungültige Quiz-Einstellungen.';
    throw new Error(message);
  }

  return {
    showLeaderboard: parsed.data.showLeaderboard,
    allowCustomNicknames: parsed.data.allowCustomNicknames,
    defaultTimer: parsed.data.defaultTimer ?? null,
    enableSoundEffects: parsed.data.enableSoundEffects,
    enableRewardEffects: parsed.data.enableRewardEffects,
    enableMotivationMessages: parsed.data.enableMotivationMessages,
    enableEmojiReactions: parsed.data.enableEmojiReactions,
    anonymousMode: parsed.data.anonymousMode,
    teamMode: parsed.data.teamMode,
    teamCount: parsed.data.teamCount ?? null,
    teamAssignment: parsed.data.teamAssignment ?? 'AUTO',
    backgroundMusic: normalizeBackgroundMusic(parsed.data.backgroundMusic) ?? null,
    nicknameTheme: parsed.data.nicknameTheme,
    bonusTokenCount: parsed.data.bonusTokenCount ?? null,
    readingPhaseEnabled: parsed.data.readingPhaseEnabled ?? true,
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
      backgroundMusic: readStringOrNull(candidate['backgroundMusic']),
      nicknameTheme:
        typeof candidate['nicknameTheme'] === 'string'
          ? (candidate['nicknameTheme'] as NicknameTheme)
          : undefined,
      bonusTokenCount: readNumberOrNull(candidate['bonusTokenCount']),
      readingPhaseEnabled: readBoolean(candidate['readingPhaseEnabled']),
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
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Ungültige Frage.';
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
  const ratingLabelMin = parsed.data.type === 'RATING' ? normalizeNullableLabel(parsed.data.ratingLabelMin) ?? null : null;
  const ratingLabelMax = parsed.data.type === 'RATING' ? normalizeNullableLabel(parsed.data.ratingLabelMax) ?? null : null;

  return {
    text: parsed.data.text,
    type: parsed.data.type as SupportedQuestionType,
    difficulty: parsed.data.difficulty,
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
  });
  if (!parsed.success) return null;

  const storedOrder = candidate['order'];
  const order =
    typeof storedOrder === 'number' && Number.isInteger(storedOrder) && storedOrder >= 0
      ? storedOrder
      : fallbackOrder;

  return {
    id,
    text: parsed.data.text,
    type: parsed.data.type as SupportedQuestionType,
    difficulty: parsed.data.difficulty,
    order,
    answers,
    ratingMin: parsed.data.type === 'RATING' ? (parsed.data.ratingMin ?? 1) : null,
    ratingMax: parsed.data.type === 'RATING' ? (parsed.data.ratingMax ?? 5) : null,
    ratingLabelMin:
      parsed.data.type === 'RATING'
        ? normalizeNullableLabel(parsed.data.ratingLabelMin) ?? null
        : null,
    ratingLabelMax:
      parsed.data.type === 'RATING'
        ? normalizeNullableLabel(parsed.data.ratingLabelMax) ?? null
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

  if (
    !snapshot.theme &&
    !snapshot.preset &&
    !snapshot.seriousOptions &&
    !snapshot.playfulOptions
  ) {
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
