import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDemoQuizHistoryScopeId } from '@arsnova/shared-types';
import { getDemoQuizExpectedTitle, getDemoQuizSeedFingerprint } from './demo-quiz-payload';
import {
  DEMO_QUIZ_ID,
  QUIZ_STORAGE_KEY,
  QuizStoreService,
  type QuizDocument,
} from './quiz-store.service';

const { createShareMutateMock, validateShareMutateMock } = vi.hoisted(() => ({
  createShareMutateMock: vi.fn(),
  validateShareMutateMock: vi.fn(),
}));

vi.mock('../../../core/trpc.client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/trpc.client')>();
  return {
    ...actual,
    trpc: new Proxy(actual.trpc, {
      get(target, property, receiver) {
        if (property === 'quizSync') {
          return {
            createShare: { mutate: createShareMutateMock },
            rotateShare: Reflect.get(target, property, receiver).rotateShare,
            validateShare: { mutate: validateShareMutateMock },
          };
        }
        return Reflect.get(target, property, receiver);
      },
    }),
  };
});

describe('QuizStoreService', () => {
  const defaultSettings = {
    showLeaderboard: true,
    allowCustomNicknames: true,
    defaultTimer: null,
    enableSoundEffects: true,
    enableRewardEffects: true,
    backgroundMusic: null,
    nicknameTheme: 'NOBEL_LAUREATES' as const,
  };

  beforeEach(() => {
    createShareMutateMock.mockReset();
    validateShareMutateMock.mockReset();
    validateShareMutateMock.mockResolvedValue({ valid: true });
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('startet auf dem reinen Teilnahmeweg keine Demo- oder Sync-Persistenz', () => {
    const service = TestBed.inject(QuizStoreService);

    expect(service.quizzes()).toEqual([]);
    expect(localStorage.getItem('quiz-sync-room-id')).toBeNull();
  });

  it('erstellt ein Quiz und speichert es in localStorage', () => {
    const service = TestBed.inject(QuizStoreService);

    const created = service.createQuiz({
      name: 'Einführung Informatik',
      description: 'Kapitel 1',
    });

    expect(created.id).toBeTruthy();
    const userQuizzes = service.quizzes().filter((q) => q.id !== DEMO_QUIZ_ID);
    expect(userQuizzes.length).toBe(1);
    expect(userQuizzes[0]?.name).toBe('Einführung Informatik');
    expect(userQuizzes[0]?.questionCount).toBe(0);

    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    expect(raw).toBeTruthy();
  });

  it('lädt bereits gespeicherte Quizzes inkl. Fragen beim Start', () => {
    const stored: QuizDocument[] = [
      {
        id: '6b442f6f-2f8a-4bad-95da-69f5e9cd2649',
        name: 'Vorlesung 1',
        description: null,
        motifImageUrl: null,
        motifImageCredit: null,
        createdAt: '2026-03-08T12:00:00.000Z',
        updatedAt: '2026-03-08T12:00:00.000Z',
        settings: defaultSettings,
        questions: [
          {
            id: '9eff562e-51f8-4f72-98a3-2f421ef2b411',
            text: 'Welche Aussagen sind korrekt?',
            type: 'MULTIPLE_CHOICE',
            difficulty: 'MEDIUM',
            order: 0,
            enabled: true,
            timer: null,
            answers: [
              {
                id: 'ec21ad56-d90e-4a7e-9590-75caebc945dd',
                text: 'A',
                isCorrect: true,
              },
              {
                id: '00eb9296-91de-4120-b771-d1a4dfe5eb2f',
                text: 'B',
                isCorrect: false,
              },
            ],
          },
        ],
      },
    ];
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(stored));

    const service = TestBed.inject(QuizStoreService);

    const vorlesung = service.quizzes().find((q) => q.name === 'Vorlesung 1');
    expect(vorlesung).toBeTruthy();
    expect(service.quizzes().filter((q) => q.id !== DEMO_QUIZ_ID).length).toBe(1);
    expect(vorlesung?.questionCount).toBe(1);
    expect(service.getQuizById('6b442f6f-2f8a-4bad-95da-69f5e9cd2649')?.questions.length).toBe(1);
  });

  it('migriert alte Matching-Paare einmalig auf opake IDs und persistiert sie', () => {
    const quizId = '6b442f6f-2f8a-4bad-95da-69f5e9cd2649';
    const questionId = '9eff562e-51f8-4f72-98a3-2f421ef2b411';
    localStorage.setItem(
      QUIZ_STORAGE_KEY,
      JSON.stringify([
        {
          id: quizId,
          name: 'Legacy Matching',
          description: null,
          motifImageUrl: null,
          motifImageCredit: null,
          createdAt: '2026-03-08T12:00:00.000Z',
          updatedAt: '2026-03-08T12:00:00.000Z',
          settings: defaultSettings,
          questions: [
            {
              id: questionId,
              text: 'Ordne zu',
              type: 'MATCHING',
              difficulty: 'MEDIUM',
              order: 0,
              enabled: true,
              timer: null,
              answers: [],
              matchingPairs: [
                { left: 'A', right: '1' },
                { left: 'B', right: '2' },
              ],
            },
          ],
        },
      ]),
    );

    const service = TestBed.inject(QuizStoreService);
    const pairs = service.getQuizById(quizId)?.questions[0]?.matchingPairs ?? [];
    const persisted = JSON.parse(localStorage.getItem(QUIZ_STORAGE_KEY) ?? '[]') as Array<{
      id: string;
      questions: Array<{ matchingPairs: Array<{ leftId: string; rightId: string }> }>;
    }>;
    const persistedPairs = persisted.find((entry) => entry.id === quizId)?.questions[0]
      ?.matchingPairs;

    expect(pairs).toHaveLength(2);
    expect(pairs.every((pair) => /^[0-9a-f-]{36}$/i.test(pair.leftId))).toBe(true);
    expect(pairs.every((pair) => /^[0-9a-f-]{36}$/i.test(pair.rightId))).toBe(true);
    expect(new Set(pairs.flatMap((pair) => [pair.leftId, pair.rightId])).size).toBe(4);
    expect(persistedPairs).toEqual(
      pairs.map(({ leftId, rightId }) => expect.objectContaining({ leftId, rightId })),
    );
  });

  it('fügt eine SINGLE_CHOICE-Frage hinzu', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Test-Quiz' });

    service.addQuestion(created.id, {
      text: 'Was ist 2 + 2?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
    });

    const quiz = service.getQuizById(created.id);
    expect(quiz).toBeTruthy();
    expect(quiz?.questions.length).toBe(1);
    expect(quiz?.questions[0]?.type).toBe('SINGLE_CHOICE');
    expect(quiz?.questions[0]?.timer).toBeNull();
    expect(quiz?.questions[0]?.answers.filter((answer) => answer.isCorrect).length).toBe(1);
    expect(service.quizzes()[0]?.questionCount).toBe(1);
  });

  it('fügt eine MULTIPLE_CHOICE-Frage mit mehreren korrekten Antworten hinzu', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'MC Quiz' });

    service.addQuestion(created.id, {
      text: 'Welche Zahlen sind gerade?',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'MEDIUM',
      answers: [
        { text: '2', isCorrect: true },
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
    });

    const question = service.getQuizById(created.id)?.questions[0];
    expect(question?.type).toBe('MULTIPLE_CHOICE');
    expect(question?.answers.filter((answer) => answer.isCorrect).length).toBe(2);
  });

  it('fügt eine FREETEXT-Frage ohne Antwortoptionen hinzu', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Freitext Quiz' });

    service.addQuestion(created.id, {
      text: 'Was war heute neu für dich?',
      type: 'FREETEXT',
      difficulty: 'MEDIUM',
      answers: [],
    });

    const question = service.getQuizById(created.id)?.questions[0];
    expect(question?.type).toBe('FREETEXT');
    expect(question?.answers).toEqual([]);
  });

  it('bewahrt numericToleranceMode fuer NUMERIC_ESTIMATE in Store, Export und Upload', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Schätzfragen Quiz' });

    service.addQuestion(created.id, {
      text: 'Wie viele Studierende sind im Raum?',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      answers: [],
      numericToleranceMode: 'RELATIVE_PERCENT',
      numericReferenceValue: 100,
      numericTolerancePercent: 10,
      numericInputType: 'DECIMAL',
      numericDecimalPlaces: 2,
      numericMin: 0,
      numericMax: 500,
      numericTwoRounds: true,
    });

    const question = service.getQuizById(created.id)?.questions[0];
    expect(question?.numericToleranceMode).toBe('RELATIVE_PERCENT');

    const exportedQuestion = service.exportQuiz(created.id).quiz.questions[0];
    expect(exportedQuestion).toEqual(
      expect.objectContaining({
        type: 'NUMERIC_ESTIMATE',
        numericToleranceMode: 'RELATIVE_PERCENT',
        numericReferenceValue: 100,
        numericTolerancePercent: 10,
        numericTwoRounds: true,
      }),
    );

    const uploadQuestion = service.getUploadPayload(created.id).questions[0];
    expect(uploadQuestion).toEqual(
      expect.objectContaining({
        type: 'NUMERIC_ESTIMATE',
        numericToleranceMode: 'RELATIVE_PERCENT',
        numericReferenceValue: 100,
        numericTolerancePercent: 10,
        numericTwoRounds: true,
      }),
    );
  });

  it('fügt eine SHORT_TEXT-Frage mit Musterlösungen hinzu', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Kurzantwort Quiz' });

    service.addQuestion(created.id, {
      text: 'Welche Stadt ist die Hauptstadt von Frankreich?',
      type: 'SHORT_TEXT',
      difficulty: 'EASY',
      answers: [
        { text: 'Paris', isCorrect: true },
        { text: 'Die Stadt Paris', isCorrect: true },
      ],
      shortTextMaxLength: 80,
      shortTextCaseSensitive: false,
    });

    const question = service.getQuizById(created.id)?.questions[0];
    expect(question?.type).toBe('SHORT_TEXT');
    expect(question?.shortTextMaxLength).toBe(80);
    expect(question?.shortTextCaseSensitive).toBe(false);
    expect(question?.answers.map((answer) => answer.text)).toEqual(['Paris', 'Die Stadt Paris']);
    expect(question?.answers.every((answer) => answer.isCorrect)).toBe(true);
  });

  it('fügt eine SURVEY-Frage ohne korrekte Antworten hinzu', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Umfrage Quiz' });

    service.addQuestion(created.id, {
      text: 'Wie bewertest du das Tempo?',
      type: 'SURVEY',
      difficulty: 'EASY',
      answers: [
        { text: 'Zu schnell', isCorrect: false },
        { text: 'Passend', isCorrect: false },
        { text: 'Zu langsam', isCorrect: false },
      ],
    });

    const question = service.getQuizById(created.id)?.questions[0];
    expect(question?.type).toBe('SURVEY');
    expect(question?.answers.every((answer) => !answer.isCorrect)).toBe(true);
  });

  it('lädt gespeicherte Quizzes mit allen sieben Fragetypen nach einem Neustart vollständig', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Alle Fragetypen' });

    service.addQuestion(created.id, {
      text: 'Single Choice?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    service.addQuestion(created.id, {
      text: 'Multiple Choice?',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'MEDIUM',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: true },
        { text: 'C', isCorrect: false },
      ],
    });
    service.addQuestion(created.id, {
      text: 'Freitext?',
      type: 'FREETEXT',
      difficulty: 'MEDIUM',
      answers: [],
    });
    service.addQuestion(created.id, {
      text: 'Kurzantwort?',
      type: 'SHORT_TEXT',
      difficulty: 'EASY',
      answers: [{ text: 'QuizExport', isCorrect: true }],
      shortTextMaxLength: 80,
      shortTextEvaluationMode: 'auto',
      shortTextToleranceLevel: 'low',
    });
    service.addQuestion(created.id, {
      text: 'Umfrage?',
      type: 'SURVEY',
      difficulty: 'EASY',
      answers: [
        { text: 'Option A', isCorrect: false },
        { text: 'Option B', isCorrect: false },
      ],
    });
    service.addQuestion(created.id, {
      text: 'Rating?',
      type: 'RATING',
      difficulty: 'EASY',
      answers: [],
      ratingMin: 1,
      ratingMax: 5,
      ratingLabelMin: 'niedrig',
      ratingLabelMax: 'hoch',
    });
    service.addQuestion(created.id, {
      text: 'Schätzung?',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'HARD',
      answers: [],
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericReferenceValue: 180,
      numericIntervalLeft: 120,
      numericIntervalRight: 240,
      numericInputType: 'INTEGER',
      numericMin: 30,
      numericMax: 600,
      numericTwoRounds: true,
    });

    expect(service.getQuizById(created.id)?.questions).toHaveLength(7);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    const reloaded = TestBed.inject(QuizStoreService).getQuizById(created.id);
    expect(reloaded?.questions.map((question) => question.type)).toEqual([
      'SINGLE_CHOICE',
      'MULTIPLE_CHOICE',
      'FREETEXT',
      'SHORT_TEXT',
      'SURVEY',
      'RATING',
      'NUMERIC_ESTIMATE',
    ]);
  });

  it('aktualisiert eine vorhandene Frage', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Update Quiz' });
    const added = service.addQuestion(created.id, {
      text: 'Alte Frage',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });

    service.updateQuestion(created.id, added.id, {
      text: 'Neue Frage',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'HARD',
      answers: [
        { text: 'A1', isCorrect: true },
        { text: 'A2', isCorrect: true },
        { text: 'A3', isCorrect: false },
      ],
    });

    const updated = service.getQuizById(created.id)?.questions[0];
    expect(updated?.text).toBe('Neue Frage');
    expect(updated?.type).toBe('MULTIPLE_CHOICE');
    expect(updated?.difficulty).toBe('HARD');
    expect(updated?.answers.length).toBe(3);
    expect(updated?.answers.filter((answer) => answer.isCorrect).length).toBe(2);
  });

  it('aktualisiert Quiz-Einstellungen', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Konfig Quiz' });

    const settings = service.updateQuizSettings(created.id, {
      showLeaderboard: false,
      defaultTimer: 45,
      nicknameTheme: 'HIGH_SCHOOL',
      backgroundMusic: 'CALM_LOFI',
    });

    expect(settings.showLeaderboard).toBe(false);
    expect(settings.defaultTimer).toBe(45);
    expect(settings.nicknameTheme).toBe('HIGH_SCHOOL');
    expect(settings.backgroundMusic).toBe('CALM_LOFI');
    expect(service.getQuizById(created.id)?.settings.showLeaderboard).toBe(false);
  });

  it('löscht eine vorhandene Frage und ordnet neu', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Delete Quiz' });
    const first = service.addQuestion(created.id, {
      text: 'Frage 1',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    service.addQuestion(created.id, {
      text: 'Frage 2',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      answers: [
        { text: 'C', isCorrect: true },
        { text: 'D', isCorrect: false },
      ],
    });

    service.deleteQuestion(created.id, first.id);

    const questions = service.getQuizById(created.id)?.questions ?? [];
    expect(questions.length).toBe(1);
    expect(questions[0]?.text).toBe('Frage 2');
    expect(questions[0]?.order).toBe(0);
  });

  it('validiert SINGLE_CHOICE: genau eine korrekte Antwort', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'SC Quiz' });

    expect(() =>
      service.addQuestion(created.id, {
        text: 'Falsche SC-Frage',
        type: 'SINGLE_CHOICE',
        difficulty: 'MEDIUM',
        answers: [
          { text: 'A', isCorrect: true },
          { text: 'B', isCorrect: true },
        ],
      }),
    ).toThrowError();

    expect(service.getQuizById(created.id)?.questions.length).toBe(0);
  });

  it('validiert Mindestanzahl Antwortoptionen', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Antworten Quiz' });

    expect(() =>
      service.addQuestion(created.id, {
        text: 'Zu wenige Antworten',
        type: 'MULTIPLE_CHOICE',
        difficulty: 'MEDIUM',
        answers: [{ text: 'Nur eine', isCorrect: true }],
      }),
    ).toThrowError();

    expect(service.getQuizById(created.id)?.questions.length).toBe(0);
  });

  it('validiert SURVEY: keine korrekten Antworten erlaubt', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Survey Regeln' });

    expect(() =>
      service.addQuestion(created.id, {
        text: 'Welche Option bevorzugst du?',
        type: 'SURVEY',
        difficulty: 'MEDIUM',
        answers: [
          { text: 'A', isCorrect: true },
          { text: 'B', isCorrect: false },
        ],
      }),
    ).toThrowError();

    expect(service.getQuizById(created.id)?.questions.length).toBe(0);
  });

  it('validiert FREETEXT: keine Antwortoptionen erlaubt', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Freitext Regeln' });

    expect(() =>
      service.addQuestion(created.id, {
        text: 'Freitext mit Optionen',
        type: 'FREETEXT',
        difficulty: 'MEDIUM',
        answers: [
          { text: 'Sollte', isCorrect: false },
          { text: 'Nicht gehen', isCorrect: false },
        ],
      }),
    ).toThrowError();

    expect(service.getQuizById(created.id)?.questions.length).toBe(0);
  });

  it('validiert eindeutige sichtbare Ordering-Elemente und Kategorienamen', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Strukturierte Eindeutigkeit' });

    expect(() =>
      service.addQuestion(created.id, {
        text: 'Sortiere',
        type: 'ORDERING',
        difficulty: 'MEDIUM',
        answers: [],
        orderingItems: [
          { id: 'step-a', text: 'Start' },
          { id: 'step-b', text: ' Start ' },
          { id: 'step-c', text: 'Ende' },
        ],
      }),
    ).toThrowError(/Elemente müssen eindeutig sein/);

    expect(() =>
      service.addQuestion(created.id, {
        text: 'Ordne zu',
        type: 'CATEGORIZATION',
        difficulty: 'MEDIUM',
        answers: [],
        categories: [
          { id: 'category-a', name: 'Literatur' },
          { id: 'category-b', name: ' Literatur ' },
        ],
        categorizationItems: [
          { id: 'item-a', text: 'A', correctCategoryId: 'category-a' },
          { id: 'item-b', text: 'B', correctCategoryId: 'category-a' },
          { id: 'item-c', text: 'C', correctCategoryId: 'category-b' },
          { id: 'item-d', text: 'D', correctCategoryId: 'category-b' },
        ],
      }),
    ).toThrowError(/Kategorienamen müssen eindeutig sein/);

    expect(service.getQuizById(created.id)?.questions).toHaveLength(0);
  });

  it('ignoriert ungültige gespeicherte Einträge', () => {
    localStorage.setItem(
      QUIZ_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'not-a-uuid',
          name: 'Ungültig',
          createdAt: 'invalid',
          updatedAt: 'invalid',
        },
      ]),
    );

    const service = TestBed.inject(QuizStoreService);

    expect(service.quizzes().filter((q) => q.id !== DEMO_QUIZ_ID)).toEqual([]);
  });

  it('setzt fehlende Einstellungen aus altem Storage auf Defaults', () => {
    localStorage.setItem(
      QUIZ_STORAGE_KEY,
      JSON.stringify([
        {
          id: '6b442f6f-2f8a-4bad-95da-69f5e9cd2649',
          name: 'Legacy Quiz',
          description: null,
          createdAt: '2026-03-08T12:00:00.000Z',
          updatedAt: '2026-03-08T12:00:00.000Z',
          questions: [],
        },
      ]),
    );

    const service = TestBed.inject(QuizStoreService);
    const settings = service.getQuizById('6b442f6f-2f8a-4bad-95da-69f5e9cd2649')?.settings;

    expect(settings).toBeTruthy();
    expect(settings?.showLeaderboard).toBe(true);
    expect(settings?.allowCustomNicknames).toBe(false);
    expect(settings?.defaultTimer).toBeNull();
    expect(settings?.timerScaleByDifficulty).toBe(true);
  });

  it('dupliziert ein Quiz mit neuer ID und "(Kopie)"-Suffix', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Original' });
    service.addQuestion(created.id, {
      text: 'Frage',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    const originalQuestionId = service.getQuizById(created.id)?.questions[0]?.id;

    const duplicated = service.duplicateQuiz(created.id);

    expect(duplicated.id).not.toBe(created.id);
    expect(duplicated.name).toBe('Original (Kopie)');
    expect(duplicated.questions.length).toBe(1);
    expect(duplicated.questions[0]?.id).not.toBe(originalQuestionId);
  });

  it('löscht ein Quiz vollständig aus der lokalen Liste', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Zu löschen' });

    service.deleteQuiz(created.id);

    expect(service.getQuizById(created.id)).toBeNull();
    expect(service.quizzes().some((entry) => entry.id === created.id)).toBe(false);
  });

  it('legt ein gelöschtes Demo-Quiz mit einer neuen unabhängigen Historie erneut an', () => {
    const service = TestBed.inject(QuizStoreService);
    service.createQuiz({ name: 'Eigenes Quiz' });
    expect(service.getQuizById(DEMO_QUIZ_ID)).toBeTruthy();

    service.deleteQuiz(DEMO_QUIZ_ID);

    expect(service.getQuizById(DEMO_QUIZ_ID)).toBeNull();
    expect(service.ensureDemoQuiz()).toBe(true);
    expect(service.getQuizById(DEMO_QUIZ_ID)).toBeTruthy();

    const firstUpload = service.getUploadPayload(DEMO_QUIZ_ID);
    const secondUpload = service.getUploadPayload(DEMO_QUIZ_ID);
    expect(isDemoQuizHistoryScopeId(firstUpload.historyScopeId)).toBe(true);
    expect(firstUpload.historyScopeId).not.toBe(DEMO_QUIZ_ID);
    expect(secondUpload.historyScopeId).toBe(firstUpload.historyScopeId);
  });

  it('migriert den öffentlichen Demo-Legacy-Scope vor dem nächsten Upload', () => {
    const service = TestBed.inject(QuizStoreService);
    service.setLastServerQuizAccessProof(DEMO_QUIZ_ID, DEMO_QUIZ_ID);

    const firstUpload = service.getUploadPayload(DEMO_QUIZ_ID);
    const secondUpload = service.getUploadPayload(DEMO_QUIZ_ID);

    expect(isDemoQuizHistoryScopeId(firstUpload.historyScopeId)).toBe(true);
    expect(firstUpload.historyScopeId).not.toBe(DEMO_QUIZ_ID);
    expect(secondUpload.historyScopeId).toBe(firstUpload.historyScopeId);
  });

  it('exportiert und importiert ein Quiz schema-konform mit neuer ID', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({
      name: 'Export Quiz',
      description: 'Für Export/Import',
      settings: {
        showLeaderboard: false,
        enableRewardEffects: false,
      },
    });
    service.addQuestion(created.id, {
      text: 'Wie war es?',
      type: 'RATING',
      difficulty: 'MEDIUM',
      answers: [],
      skipReadingPhase: true,
      ratingMin: 1,
      ratingMax: 10,
      ratingLabelMin: 'schlecht',
      ratingLabelMax: 'sehr gut',
    });

    const exported = service.exportQuiz(created.id);
    const imported = service.importQuiz(exported);

    expect(exported.exportVersion).toBeGreaterThanOrEqual(1);
    expect(imported.quiz.id).not.toBe(created.id);
    expect(imported.quiz.name).toBe('Export Quiz');
    expect(imported.quiz.questions[0]?.type).toBe('RATING');
    expect(imported.quiz.questions[0]?.ratingMax).toBe(10);
    expect(imported.quiz.questions[0]?.skipReadingPhase).toBe(true);
  });

  it('exportiert enabled:false und stellt den Zustand nach Import wieder her', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Enable-Flag' });
    service.addQuestion(created.id, {
      text: 'Aus',
      type: 'FREETEXT',
      difficulty: 'MEDIUM',
      answers: [],
    });
    service.addQuestion(created.id, {
      text: 'An',
      type: 'FREETEXT',
      difficulty: 'MEDIUM',
      answers: [],
    });
    const doc = service.getQuizById(created.id)!;
    service.setQuestionEnabled(created.id, doc.questions[0]!.id, false);

    const exported = service.exportQuiz(created.id);
    const ausExport = exported.quiz.questions.find((q) => q.text === 'Aus');
    expect(ausExport).toBeTruthy();
    expect((ausExport as { enabled?: boolean }).enabled).toBe(false);

    const imported = service.importQuiz(exported);
    const aus = imported.quiz.questions.find((q) => q.text === 'Aus');
    expect(aus?.enabled).toBe(false);
    const an = imported.quiz.questions.find((q) => q.text === 'An');
    expect(an?.enabled).toBe(true);
  });

  it('exportiert SHORT_TEXT-Konfiguration mit Musterlösungen', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Kurzantwort Export' });

    service.addQuestion(created.id, {
      text: 'Nenne ein Edelgas.',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      answers: [
        { text: 'Neon', isCorrect: true },
        { text: 'Argon', isCorrect: true },
      ],
      shortTextMaxLength: 40,
      shortTextCaseSensitive: true,
    });

    const exportedQuestion = service.exportQuiz(created.id).quiz.questions[0];
    expect(exportedQuestion).toMatchObject({
      type: 'SHORT_TEXT',
      shortTextMaxLength: 40,
      shortTextCaseSensitive: true,
      answers: [
        { text: 'Neon', isCorrect: true },
        { text: 'Argon', isCorrect: true },
      ],
    });
  });

  it('importiert arsnova.click-Exporte ueber einen Kompatibilitaetsfilter', () => {
    const service = TestBed.inject(QuizStoreService);

    const imported = service.importQuiz({
      name: 'Click Import',
      description: 'Aus arsnova.click',
      sessionConfig: {
        readingConfirmationEnabled: false,
        nicks: {
          memberGroups: [{ name: 'Team Rot' }, { name: 'Team Blau' }],
          autoJoinToGroup: true,
          blockIllegalNicks: true,
        },
      },
      questionList: [
        {
          TYPE: 'SingleChoiceQuestion',
          timer: 30,
          questionText: 'Eine richtige Antwort',
          answerOptionList: [
            { answerText: 'A', isCorrect: false },
            { answerText: 'B', isCorrect: true },
          ],
          difficulty: 2,
        },
        {
          TYPE: 'ABCDSurveyQuestion',
          timer: 15,
          questionText: 'Feedback',
          answerOptionList: [
            { answerText: 'A' },
            { answerText: 'B' },
            { answerText: 'C' },
            { answerText: 'D' },
          ],
          difficulty: 5,
        },
        {
          TYPE: 'FreeTextQuestion',
          timer: 45,
          questionText: 'Offene Rueckmeldung',
          answerOptionList: [
            {
              answerText: 'Paris',
              configCaseSensitive: false,
            },
          ],
          difficulty: 8,
        },
        {
          TYPE: 'RangedQuestion',
          timer: 60,
          questionText: 'Schaetzfrage',
          answerOptionList: [],
          rangeMin: 0,
          rangeMax: 1000,
          correctValue: 420,
          difficulty: 6,
        },
      ],
    });

    expect(imported.quiz.name).toBe('Click Import');
    expect(imported.quiz.description).toBe('Aus arsnova.click');
    expect(imported.quiz.settings.readingPhaseEnabled).toBe(false);
    expect(imported.quiz.settings.allowCustomNicknames).toBe(false);
    expect(imported.quiz.settings.teamMode).toBe(true);
    expect(imported.quiz.settings.teamCount).toBe(2);
    expect(imported.quiz.settings.teamAssignment).toBe('AUTO');
    expect(imported.quiz.settings.teamNames).toEqual(['Team Rot', 'Team Blau']);
    expect(imported.quiz.questions.map((question) => question.type)).toEqual([
      'SINGLE_CHOICE',
      'SURVEY',
      'SHORT_TEXT',
      'NUMERIC_ESTIMATE',
    ]);
    expect(imported.quiz.questions[0]?.difficulty).toBe('EASY');
    expect(imported.quiz.questions[1]?.difficulty).toBe('MEDIUM');
    expect(imported.quiz.questions[2]?.difficulty).toBe('HARD');
    expect(imported.quiz.questions[3]?.difficulty).toBe('MEDIUM');
    expect(imported.quiz.questions[0]?.timer).toBe(30);
    expect(imported.quiz.questions[1]?.answers.every((answer) => !answer.isCorrect)).toBe(true);
    expect(imported.quiz.questions[2]).toMatchObject({
      type: 'SHORT_TEXT',
      answers: [{ text: 'Paris', isCorrect: true }],
      shortTextEvaluationKind: 'text',
      shortTextCaseSensitive: false,
      shortTextEvaluationMode: 'exact',
      shortTextToleranceLevel: 'none',
      shortTextAllowPartialCredit: false,
      shortTextTrimWhitespace: true,
      shortTextNormalizeWhitespace: false,
    });
    expect(imported.quiz.questions[3]).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      timer: 60,
      answers: [],
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericReferenceValue: 420,
      numericIntervalLeft: 0,
      numericIntervalRight: 1000,
      numericInputType: 'INTEGER',
      numericMin: null,
      numericMax: null,
      numericTwoRounds: false,
    });
    expect(imported.warnings.some((warning) => warning.kind === 'mapped_question')).toBe(true);
    expect(
      imported.warnings.some(
        (warning) =>
          warning.questionNumber === 2 &&
          warning.message === 'Wurde als normale Umfrage importiert.',
      ),
    ).toBe(true);
    expect(
      imported.warnings.some(
        (warning) =>
          warning.questionNumber === 4 &&
          warning.message === 'Wurde als numerische Schätzfrage importiert.',
      ),
    ).toBe(true);
    expect(
      imported.warnings.some((warning) =>
        warning.message.includes('Freitext-Antworten wurden nicht übernommen'),
      ),
    ).toBe(false);
  });

  it('uebernimmt arsnova.click-Sicherheitsgrad fuer bewertbare Fragen', () => {
    const service = TestBed.inject(QuizStoreService);

    const imported = service.importQuiz({
      name: 'Click Confidence',
      sessionConfig: {
        confidenceSliderEnabled: true,
        confidenceLabelLow: 'Geraten',
        confidenceLabelHigh: 'Sehr sicher',
      },
      questionList: [
        {
          TYPE: 'SingleChoiceQuestion',
          questionText: 'Single Choice',
          answerOptionList: [
            { answerText: 'A', isCorrect: false },
            { answerText: 'B', isCorrect: true },
          ],
        },
        {
          TYPE: 'SurveyQuestion',
          questionText: 'Umfrage',
          answerOptionList: [{ answerText: 'Ja' }, { answerText: 'Nein' }],
        },
        {
          TYPE: 'FreeTextQuestion',
          questionText: 'Kurzantwort',
          answerOptionList: [{ answerText: 'Paris' }],
        },
        {
          TYPE: 'RangedQuestion',
          questionText: 'Schaetzfrage',
          answerOptionList: [],
          rangeMin: 0,
          rangeMax: 10,
          correctValue: 5,
        },
      ],
    });

    expect(imported.quiz.questions[0]).toMatchObject({
      type: 'SINGLE_CHOICE',
      confidenceEnabled: true,
      confidenceLabelLow: 'Geraten',
      confidenceLabelHigh: 'Sehr sicher',
    });
    expect(imported.quiz.questions[1]).toMatchObject({ type: 'SURVEY' });
    expect(imported.quiz.questions[1]?.confidenceEnabled).not.toBe(true);
    expect(imported.quiz.questions[2]).toMatchObject({
      type: 'SHORT_TEXT',
      confidenceEnabled: true,
      confidenceLabelLow: 'Geraten',
      confidenceLabelHigh: 'Sehr sicher',
    });
    expect(imported.quiz.questions[3]).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      confidenceEnabled: true,
      confidenceLabelLow: 'Geraten',
      confidenceLabelHigh: 'Sehr sicher',
    });
    expect(
      imported.warnings.some((warning) =>
        warning.message.includes('Selbsteinschätzung wurde für bewertbare Fragen übernommen'),
      ),
    ).toBe(true);
  });

  it('importiert arsnova.click-Kurzantworten best effort mit praezisen Warnungen', () => {
    const service = TestBed.inject(QuizStoreService);

    const imported = service.importQuiz({
      name: 'Click Short Text Detail',
      questionList: [
        {
          TYPE: 'FreeTextQuestion',
          questionText: 'Nenne die Hauptstadt von Frankreich.',
          answerOptionList: [
            {
              answerText: 'Paris',
              configCaseSensitive: false,
              configTrimWhitespaces: true,
              configUseKeywords: true,
              configUsePunctuation: false,
            },
            {
              answerText: 'paris',
              configCaseSensitive: false,
              configTrimWhitespaces: true,
              configUseKeywords: true,
              configUsePunctuation: false,
            },
          ],
        },
      ],
    });

    expect(imported.quiz.questions[0]).toMatchObject({
      type: 'SHORT_TEXT',
      answers: [{ text: 'Paris', isCorrect: true }],
      shortTextCaseSensitive: false,
      shortTextEvaluationMode: 'exact',
      shortTextToleranceLevel: 'none',
      shortTextAllowPartialCredit: false,
      shortTextTrimWhitespace: true,
      shortTextNormalizeWhitespace: false,
    });
    expect(
      imported.warnings.some(
        (warning) =>
          warning.questionNumber === 1 &&
          warning.message === 'Nicht alle Kurzantwort-Regeln konnten 1:1 übernommen werden.' &&
          warning.detail === 'configUseKeywords, configUsePunctuation',
      ),
    ).toBe(true);
    expect(
      imported.warnings.some(
        (warning) =>
          warning.questionNumber === 1 &&
          warning.message === 'Doppelte Kurzantwort-Musterlösungen wurden zusammengeführt.',
      ),
    ).toBe(true);
  });

  it('importiert arsnova.click-Schaetzfragen mit Dezimalwerten und Toleranzband-Grenzen', () => {
    const service = TestBed.inject(QuizStoreService);

    const imported = service.importQuiz({
      name: 'Click Decimal Range',
      questionList: [
        {
          TYPE: 'RangedQuestion',
          questionText: 'Schaetze die Kreiszahl.',
          rangeMin: 4.5,
          rangeMax: 2.5,
          correctValue: 3.14,
        },
      ],
    });

    expect(imported.quiz.questions[0]).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericReferenceValue: 3.14,
      numericIntervalLeft: 2.5,
      numericIntervalRight: 4.5,
      numericInputType: 'DECIMAL',
      numericDecimalPlaces: 2,
      numericMin: null,
      numericMax: null,
      numericTwoRounds: false,
    });
    expect(
      imported.warnings.some(
        (warning) =>
          warning.questionNumber === 1 &&
          warning.message === 'Vertauschte Bereichsgrenzen der Schätzfrage wurden korrigiert.',
      ),
    ).toBe(true);
  });

  it('uebernimmt arsnova.click-RangedQuestion-Grenzen als akzeptierten Bereich', () => {
    const service = TestBed.inject(QuizStoreService);

    const imported = service.importQuiz({
      name: 'Click Range als Band',
      questionList: [
        {
          TYPE: 'RangedQuestion',
          questionText: 'Wie viele Minuten dauert die Aktivität?',
          rangeMin: 20,
          rangeMax: 40,
          correctValue: 30,
        },
      ],
    });

    expect(imported.quiz.questions[0]).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericReferenceValue: 30,
      numericIntervalLeft: 20,
      numericIntervalRight: 40,
      numericInputType: 'INTEGER',
      numericMin: null,
      numericMax: null,
      numericTwoRounds: false,
    });
    expect(
      imported.warnings.some(
        (warning) =>
          warning.questionNumber === 1 &&
          warning.detail ===
            'rangeMin/rangeMax wurden als absolutes Toleranzband übernommen; correctValue wurde als Referenzwert übernommen.',
      ),
    ).toBe(true);
  });

  it('importiert arsnova.click trotz nicht unterstuetzter Typen mit Warnhinweis', () => {
    const service = TestBed.inject(QuizStoreService);

    const imported = service.importQuiz({
      name: 'Teilweise kompatibel',
      questionList: [
        {
          TYPE: 'UnsupportedQuestion',
          questionText: 'Nicht unterstuetzt',
        },
        {
          TYPE: 'SingleChoiceQuestion',
          questionText: 'Bleibt erhalten',
          answerOptionList: [
            { answerText: 'A', isCorrect: true },
            { answerText: 'B', isCorrect: false },
          ],
        },
      ],
    });

    expect(imported.quiz.name).toBe('Teilweise kompatibel');
    expect(imported.quiz.questions).toHaveLength(1);
    expect(imported.quiz.questions[0]?.text).toBe('Bleibt erhalten');
    expect(imported.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'skipped_question',
          questionNumber: 1,
          questionText: 'Nicht unterstuetzt',
          message: 'Dieser Fragetyp wird in arsnova.eu noch nicht unterstützt.',
        }),
      ]),
    );
  });

  it('ueberspringt ungueltige arsnova.click-Schaetzfragen und importiert den Rest', () => {
    const service = TestBed.inject(QuizStoreService);

    const imported = service.importQuiz({
      name: 'Teilweise gueltige Schaetzfragen',
      questionList: [
        {
          TYPE: 'RangedQuestion',
          questionText: 'Ungueltige Schaetzfrage',
          rangeMin: 5,
          rangeMax: 5,
          correctValue: 5,
        },
        {
          TYPE: 'RangedQuestion',
          questionText: 'Gueltige Schaetzfrage',
          rangeMin: 0,
          rangeMax: 10,
          correctValue: 7,
        },
      ],
    });

    expect(imported.quiz.questions).toHaveLength(1);
    expect(imported.quiz.questions[0]).toMatchObject({
      text: 'Gueltige Schaetzfrage',
      type: 'NUMERIC_ESTIMATE',
      numericReferenceValue: 7,
      numericIntervalLeft: 0,
      numericIntervalRight: 10,
    });
    expect(imported.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'skipped_question',
          questionNumber: 1,
          questionText: 'Ungueltige Schaetzfrage',
          message: 'Schätzfragen benötigen unterschiedliche Bereichsgrenzen.',
        }),
      ]),
    );
  });

  it('getUploadPayload: deaktivierte Fragen fehlen, Reihenfolge wird neu nummeriert', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Live-Filter' });
    service.addQuestion(created.id, {
      text: 'Skip',
      type: 'FREETEXT',
      difficulty: 'MEDIUM',
      answers: [],
    });
    service.addQuestion(created.id, {
      text: 'Keep',
      type: 'FREETEXT',
      difficulty: 'MEDIUM',
      answers: [],
    });
    const doc = service.getQuizById(created.id)!;
    service.setQuestionEnabled(created.id, doc.questions[0]!.id, false);

    const payload = service.getUploadPayload(created.id);
    expect(payload.questions).toHaveLength(1);
    expect(payload.questions[0]?.text).toBe('Keep');
    expect(payload.questions[0]?.order).toBe(0);
  });

  it('liefert verständliche Feldpfade bei KI-Import-Validierungsfehlern', () => {
    const service = TestBed.inject(QuizStoreService);

    expect(() =>
      service.importQuiz({
        exportVersion: 1,
        exportedAt: '2026-03-08T12:00:00.000Z',
        quiz: {
          name: 'KI-Quiz',
          showLeaderboard: true,
          allowCustomNicknames: true,
          defaultTimer: null,
          enableSoundEffects: true,
          enableRewardEffects: true,
          enableMotivationMessages: true,
          enableEmojiReactions: true,
          showQuestionTypeIndicators: true,
          anonymousMode: false,
          teamMode: false,
          teamAssignment: 'AUTO',
          teamNames: [],
          backgroundMusic: null,
          nicknameTheme: 'NOBEL_LAUREATES',
          bonusTokenCount: null,
          readingPhaseEnabled: true,
          questions: [
            {
              text: 'Frage 1',
              type: 'SINGLE_CHOICE',
              difficulty: 'MEDIUM',
              order: 0,
              answers: [{ text: 'A' }],
            },
          ],
        },
      }),
    ).toThrowError(/Frage 1, Antwort 1, Feld "isCorrect"/);
  });

  it('lehnt Datei-Importe mit mehr als QUIZ_UPLOAD_MAX_QUESTIONS Fragen ab', async () => {
    const { QUIZ_UPLOAD_MAX_QUESTIONS } = await import('@arsnova/shared-types');
    const service = TestBed.inject(QuizStoreService);
    const questions = Array.from({ length: QUIZ_UPLOAD_MAX_QUESTIONS + 1 }, (_, order) => ({
      text: `Frage ${order}`,
      type: 'SINGLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      order,
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    }));

    expect(() =>
      service.importQuiz({
        exportVersion: 1,
        exportedAt: '2026-09-22T12:00:00.000Z',
        quiz: {
          name: 'Zu groß',
          showLeaderboard: true,
          allowCustomNicknames: true,
          defaultTimer: null,
          enableSoundEffects: true,
          enableRewardEffects: true,
          enableMotivationMessages: true,
          enableEmojiReactions: true,
          showQuestionTypeIndicators: true,
          anonymousMode: false,
          teamMode: false,
          teamAssignment: 'AUTO',
          teamNames: [],
          backgroundMusic: null,
          nicknameTheme: 'HIGH_SCHOOL',
          bonusTokenCount: null,
          readingPhaseEnabled: true,
          questions,
        },
      }),
    ).toThrow(/maximal|Fragen/i);
  });

  it('validiert RATING-Fragen (nur 1..5 oder 1..10, keine Antwortoptionen)', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Rating Regeln' });

    expect(() =>
      service.addQuestion(created.id, {
        text: 'Ungültiges Rating',
        type: 'RATING',
        difficulty: 'MEDIUM',
        answers: [{ text: 'A', isCorrect: false }],
        ratingMin: 1,
        ratingMax: 7,
      }),
    ).toThrowError();

    expect(service.getQuizById(created.id)?.questions.length).toBe(0);
  });

  it('aktiviert einen gültigen Sync-Raum', () => {
    const service = TestBed.inject(QuizStoreService);

    service.activateSyncRoom('syncroom_123');

    expect(service.syncRoomId()).toBe('syncroom_123');
  });

  it('markiert eine Bibliothek beim bewussten Sync als geteilt', () => {
    const service = TestBed.inject(QuizStoreService);

    service.activateSyncRoom('syncroom_123', { markShared: true });

    expect(service.librarySharingMode()).toBe('shared');
  });

  it('lädt persistierten Share-Token vor der Yjs-Initialisierung beim Reload', () => {
    const roomId = '00000000-0000-4000-8000-000000000321';
    const shareToken = `v1.${roomId}.1.${'a'.repeat(43)}`;
    localStorage.setItem('quiz-sync-room-id', roomId);
    localStorage.setItem('quiz-library-sharing-mode', 'shared');
    localStorage.setItem(`quiz-sync-share-token:${roomId}`, shareToken);

    const service = TestBed.inject(QuizStoreService);

    expect(service.syncRoomId()).toBe(roomId);
    expect(service.syncShareToken()).toBe(shareToken);
    expect(service.syncShareStatus()).toBe('ready');
  });

  it('startet für einen persistierten Legacy-Raum keinen Relay-Provider', async () => {
    localStorage.setItem('quiz-sync-room-id', 'syncroom_123');
    localStorage.setItem('quiz-library-sharing-mode', 'shared');
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0' });
    vi.stubGlobal('WebSocket', class {});
    const service = TestBed.inject(QuizStoreService);
    const loadWebsocketProviderCtor = vi.fn();
    const internals = service as unknown as {
      yDoc: object | null;
      yProvider: object | null;
      loadWebsocketProviderCtor: typeof loadWebsocketProviderCtor;
      attachYjsWebSocketProviderIfNeeded: () => Promise<void>;
    };
    internals.yDoc = { destroy: vi.fn() };
    internals.loadWebsocketProviderCtor = loadWebsocketProviderCtor;

    await internals.attachYjsWebSocketProviderIfNeeded();

    expect(loadWebsocketProviderCtor).not.toHaveBeenCalled();
    expect(internals.yProvider).toBeNull();
    expect(service.syncShareStatus()).toBe('legacy');
    expect(service.syncConnectionState()).toBe('disconnected');
  });

  it('zerstört den vorhandenen Provider beim Import eines Ersatz-Tokens im selben Raum', () => {
    const service = TestBed.inject(QuizStoreService);
    const roomId = service.syncRoomId();
    const oldToken = `v1.${roomId}.1.${'a'.repeat(43)}`;
    const nextToken = `v1.${roomId}.2.${'b'.repeat(43)}`;
    service.activateSyncRoom(roomId, { markShared: true, shareToken: oldToken });
    const destroy = vi.fn();
    const awarenessOff = vi.fn();
    (
      service as unknown as {
        yProvider: { awareness: { off: typeof awarenessOff }; destroy: typeof destroy } | null;
      }
    ).yProvider = {
      awareness: { off: awarenessOff },
      destroy,
    };

    service.activateSyncRoom(roomId, { markShared: true, shareToken: nextToken });

    expect(awarenessOff).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
    expect(service.syncShareToken()).toBe(nextToken);
  });

  it('ignoriert importierte Tokens mit älterer Generation', () => {
    const service = TestBed.inject(QuizStoreService);
    const roomId = service.syncRoomId();
    const currentToken = `v1.${roomId}.2.${'b'.repeat(43)}`;
    const staleToken = `v1.${roomId}.1.${'a'.repeat(43)}`;
    service.activateSyncRoom(roomId, { markShared: true, shareToken: currentToken });
    (
      service as unknown as {
        confirmPendingImportedShareToken: (roomId: string, token: string) => void;
      }
    ).confirmPendingImportedShareToken(roomId, currentToken);

    service.activateSyncRoom(roomId, { markShared: true, shareToken: staleToken });

    expect(service.syncShareToken()).toBe(currentToken);
    expect(localStorage.getItem(`quiz-sync-share-token:${roomId}`)).toBe(currentToken);
    expect(service.syncShareError()).toContain('älterer Sync-Link');
  });

  it('persistiert einen importierten Token erst nach erfolgreichem WebSocket-Sync', () => {
    const service = TestBed.inject(QuizStoreService);
    const roomId = service.syncRoomId();
    const importedToken = `v1.${roomId}.3.${'c'.repeat(43)}`;

    service.activateSyncRoom(roomId, { markShared: true, shareToken: importedToken });

    expect(service.syncShareToken()).toBe(importedToken);
    expect(service.syncShareStatus()).toBe('pending');
    expect(localStorage.getItem(`quiz-sync-share-token:${roomId}`)).toBeNull();

    (
      service as unknown as {
        confirmPendingImportedShareToken: (roomId: string, token: string) => void;
      }
    ).confirmPendingImportedShareToken(roomId, importedToken);

    expect(service.syncShareStatus()).toBe('ready');
    expect(localStorage.getItem(`quiz-sync-share-token:${roomId}`)).toBe(importedToken);
  });

  it('seedet einen neu importierten Share erst nach dem ersten WebSocket-Abgleich', async () => {
    const service = TestBed.inject(QuizStoreService);
    const roomId = '00000000-0000-4000-8000-000000000456';
    const importedToken = `v1.${roomId}.1.${'d'.repeat(43)}`;
    const Y = await import('yjs');
    const yDoc = new Y.Doc();
    const yRoot = yDoc.getMap<string>('quiz-library');
    const yObjectives = yDoc.getMap<string>('quiz-learning-objectives-v1');
    const internals = service as unknown as {
      yDoc: InstanceType<typeof Y.Doc> | null;
      yRoot: import('yjs').Map<string> | null;
      yLearningObjectivesRoot: import('yjs').Map<string> | null;
      initYjsPersistence: (roomId: string) => Promise<void>;
      beginLearningObjectiveYjsRestore: (roomId: string) => void;
      confirmPendingImportedShareToken: (roomId: string, token: string) => void;
      syncFromYjsOrSeed: () => void;
    };
    internals.initYjsPersistence = vi.fn().mockResolvedValue(undefined);

    service.activateSyncRoom(roomId, { markShared: true, shareToken: importedToken });
    internals.beginLearningObjectiveYjsRestore(roomId);
    internals.yDoc = yDoc;
    internals.yRoot = yRoot;
    internals.yLearningObjectivesRoot = yObjectives;

    internals.syncFromYjsOrSeed();

    expect(yRoot.has('quizzes')).toBe(false);
    expect(yRoot.has('quiz-learning-objectives-v1-initialized')).toBe(false);

    internals.confirmPendingImportedShareToken(roomId, importedToken);
    internals.syncFromYjsOrSeed();

    expect(yRoot.get('quizzes')).toBe('[]');
    expect(yRoot.get('quiz-learning-objectives-v1-initialized')).toBe('1');
  });

  it('beendet den Provider dauerhaft bei einem serverseitig abgelehnten Sync-Token', () => {
    const service = TestBed.inject(QuizStoreService);
    const roomId = service.syncRoomId();
    const shareToken = `v1.${roomId}.1.${'c'.repeat(43)}`;
    const destroy = vi.fn();
    const awarenessOff = vi.fn();
    service.syncShareToken.set(shareToken);
    (
      service as unknown as {
        yProvider: {
          awareness: { off: (event: string, listener: unknown) => void };
          destroy: () => void;
        } | null;
      }
    ).yProvider = {
      awareness: { off: awarenessOff },
      destroy,
    };

    (
      service as unknown as {
        handleTerminalYjsShareRejection: (room: string, token: string) => void;
      }
    ).handleTerminalYjsShareRejection(roomId, shareToken);
    (
      service as unknown as {
        handleTerminalYjsShareRejection: (room: string, token: string) => void;
      }
    ).handleTerminalYjsShareRejection(roomId, shareToken);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(service.syncConnectionState()).toBe('disconnected');
    expect(service.syncShareStatus()).toBe('error');
    expect(service.syncShareError()).toContain('ungültig oder wurde ersetzt');
  });

  it('behandelt einen nicht erreichbaren Token-Prüfdienst als transient', async () => {
    const service = TestBed.inject(QuizStoreService);
    const roomId = service.syncRoomId();
    const shareToken = `v1.${roomId}.1.${'c'.repeat(43)}`;
    validateShareMutateMock.mockRejectedValueOnce(new Error('network unavailable'));

    const result = await (
      service as unknown as {
        validateYjsShareToken: (room: string, token: string) => Promise<boolean | null>;
      }
    ).validateYjsShareToken(roomId, shareToken);

    expect(result).toBeNull();
    expect(validateShareMutateMock).toHaveBeenCalledWith({ roomId, shareToken });
    expect(service.syncShareStatus()).not.toBe('error');
  });

  it('setzt einen manipulierten Import bei Verbindungsfehler auf den letzten Token zurück', () => {
    const service = TestBed.inject(QuizStoreService);
    const roomId = service.syncRoomId();
    const trustedToken = `v1.${roomId}.2.${'b'.repeat(43)}`;
    const forgedToken = `v1.${roomId}.999.${'c'.repeat(43)}`;
    service.activateSyncRoom(roomId, { markShared: true, shareToken: trustedToken });
    (
      service as unknown as {
        confirmPendingImportedShareToken: (roomId: string, token: string) => void;
        rejectPendingImportedShareToken: (roomId: string, token: string) => void;
      }
    ).confirmPendingImportedShareToken(roomId, trustedToken);

    service.activateSyncRoom(roomId, { markShared: true, shareToken: forgedToken });
    (
      service as unknown as {
        rejectPendingImportedShareToken: (roomId: string, token: string) => void;
      }
    ).rejectPendingImportedShareToken(roomId, forgedToken);

    expect(service.syncShareToken()).toBe(trustedToken);
    expect(service.syncShareStatus()).toBe('ready');
    expect(localStorage.getItem(`quiz-sync-share-token:${roomId}`)).toBe(trustedToken);
  });

  it('übernimmt eine Rotation aus einem anderen Tab generationsmonoton', () => {
    const service = TestBed.inject(QuizStoreService);
    const roomId = service.syncRoomId();
    const oldToken = `v1.${roomId}.1.${'a'.repeat(43)}`;
    const nextToken = `v1.${roomId}.2.${'b'.repeat(43)}`;
    service.activateSyncRoom(roomId, { markShared: true, shareToken: oldToken });
    const destroy = vi.fn();
    (
      service as unknown as {
        yProvider: { awareness: { off: ReturnType<typeof vi.fn> }; destroy: typeof destroy } | null;
      }
    ).yProvider = { awareness: { off: vi.fn() }, destroy };

    globalThis.dispatchEvent(
      new StorageEvent('storage', {
        key: `quiz-sync-share-token:${roomId}`,
        newValue: nextToken,
      }),
    );

    expect(service.syncShareToken()).toBe(nextToken);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('verwirft eine laufende Provider-Anlage, wenn während der Token-Prüfung rotiert wird', async () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0' });
    vi.stubGlobal('WebSocket', class {});
    const service = TestBed.inject(QuizStoreService);
    const roomId = service.syncRoomId();
    const oldToken = `v1.${roomId}.1.${'a'.repeat(43)}`;
    const nextToken = `v1.${roomId}.2.${'b'.repeat(43)}`;
    let resolveOldValidation!: (valid: boolean) => void;
    const oldValidation = new Promise<boolean>((resolve) => {
      resolveOldValidation = resolve;
    });
    const providerTokens: Array<string | undefined> = [];

    class FakeProvider {
      readonly awareness = {
        setLocalStateField: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      };
      readonly on = vi.fn();
      readonly destroy = vi.fn();

      constructor(
        _url: string,
        _room: string,
        _doc: object,
        options?: { params?: Record<string, string> },
      ) {
        providerTokens.push(options?.params?.['s']);
      }
    }

    const internals = service as unknown as {
      yDoc: object | null;
      yProvider: FakeProvider | null;
      validateYjsShareToken: (room: string, token: string) => Promise<boolean>;
      loadWebsocketProviderCtor: () => Promise<typeof FakeProvider>;
      attachYjsWebSocketProviderIfNeeded: () => Promise<void>;
      teardownYjsProvider: () => void;
    };
    internals.yDoc = { destroy: vi.fn() };
    service.librarySharingMode.set('shared');
    service.syncShareToken.set(oldToken);
    internals.validateYjsShareToken = vi.fn((_room, token) =>
      token === oldToken ? oldValidation : Promise.resolve(true),
    );
    internals.loadWebsocketProviderCtor = vi.fn().mockResolvedValue(FakeProvider);

    const oldAttach = internals.attachYjsWebSocketProviderIfNeeded();
    await vi.waitFor(() =>
      expect(internals.validateYjsShareToken).toHaveBeenCalledWith(roomId, oldToken),
    );

    service.syncShareToken.set(nextToken);
    internals.teardownYjsProvider();
    const nextAttach = internals.attachYjsWebSocketProviderIfNeeded();
    await nextAttach;
    resolveOldValidation(true);
    await oldAttach;

    expect(providerTokens).toEqual([nextToken]);
    expect(internals.yProvider).toBeInstanceOf(FakeProvider);
    expect(internals.yProvider?.destroy).not.toHaveBeenCalled();
  });

  it('merkt sich die ursprüngliche Freigabequelle nur einmalig', () => {
    const service = TestBed.inject(QuizStoreService);

    service.activateSyncRoom('syncroom_123', { markShared: true, secureAsOrigin: true });
    const firstOriginDevice = service.originDeviceLabel();
    const firstOriginBrowser = service.originBrowserLabel();
    const firstOriginAt = service.originSharedAt();

    service.activateSyncRoom('syncroom_123', { markShared: true, secureAsOrigin: true });

    expect(service.originDeviceLabel()).toBe(firstOriginDevice);
    expect(service.originBrowserLabel()).toBe(firstOriginBrowser);
    expect(service.originSharedAt()).toBe(firstOriginAt);
  });

  it('rekeyt einen Legacy-Origin explizit auf einen serverseitig erzeugten Raum', async () => {
    const service = TestBed.inject(QuizStoreService);
    service.activateSyncRoom('syncroom_123', { markShared: true });
    service.createQuiz({ name: 'Legacy-Sammlung' });
    const oldRoomId = service.syncRoomId();
    const newRoomId = '00000000-0000-4000-8000-000000000777';
    const providerRooms: string[] = [];
    class FakeProvider {
      readonly awareness = {
        setLocalStateField: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      };
      readonly on = vi.fn();
      readonly destroy = vi.fn();

      constructor(_url: string, room: string) {
        providerRooms.push(room);
      }
    }
    const internals = service as unknown as {
      yDoc: object | null;
      initYjsPersistence: (roomId: string) => Promise<void>;
      loadWebsocketProviderCtor: () => Promise<typeof FakeProvider>;
      attachYjsWebSocketProviderIfNeeded: () => Promise<void>;
    };
    internals.initYjsPersistence = vi.fn().mockResolvedValue(undefined);
    createShareMutateMock.mockResolvedValue({
      roomId: newRoomId,
      shareToken: `v1.${newRoomId}.1.${'a'.repeat(43)}`,
      generation: 1,
    });

    const link = await service.createSecuredSyncShareLink();
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0' });
    vi.stubGlobal('WebSocket', class {});
    internals.yDoc = { destroy: vi.fn() };
    internals.loadWebsocketProviderCtor = vi.fn().mockResolvedValue(FakeProvider);
    await internals.attachYjsWebSocketProviderIfNeeded();

    expect(oldRoomId).toBe('syncroom_123');
    expect(createShareMutateMock).toHaveBeenCalledWith({
      rotationCapability: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(service.syncRoomId()).toBe(newRoomId);
    expect(service.syncShareStatus()).toBe('ready');
    expect(service.quizzes().some((quiz) => quiz.name === 'Legacy-Sammlung')).toBe(true);
    expect(link).toContain(`/quiz/sync/${newRoomId}#s=`);
    expect(providerRooms).toEqual([`quiz-library-room-${newRoomId}`]);
  });

  it('verwendet bei paralleler Absicherung dasselbe In-flight-Promise', async () => {
    const service = TestBed.inject(QuizStoreService);
    const newRoomId = '00000000-0000-4000-8000-000000000778';
    let resolveCreate:
      ((value: { roomId: string; shareToken: string; generation: number }) => void) | undefined;
    createShareMutateMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    const first = service.createSecuredSyncShareLink();
    const second = service.createSecuredSyncShareLink();

    expect(first).toBe(second);
    expect(createShareMutateMock).toHaveBeenCalledOnce();
    resolveCreate?.({
      roomId: newRoomId,
      shareToken: `v1.${newRoomId}.1.${'c'.repeat(43)}`,
      generation: 1,
    });
    await expect(first).resolves.toContain(`/quiz/sync/${newRoomId}#s=`);
  });

  it('kann eine geteilte Bibliothek wieder entlinken und lokal weiterführen', () => {
    const service = TestBed.inject(QuizStoreService);
    service.createQuiz({ name: 'Geteiltes Quiz' });
    service.activateSyncRoom(service.syncRoomId(), { markShared: true });
    const sharedRoomId = service.syncRoomId();

    service.unlinkSharedLibrary();

    expect(service.librarySharingMode()).toBe('local');
    expect(service.syncRoomId()).not.toBe(sharedRoomId);
    expect(service.quizzes().some((q) => q.name === 'Geteiltes Quiz')).toBe(true);
  });

  it('merkt sich Gerät und Browser bei lokalen Quiz-Änderungen', () => {
    const service = TestBed.inject(QuizStoreService);

    const created = service.createQuiz({ name: 'Metadaten Quiz' });
    service.updateQuizMetadata(created.id, { name: 'Metadaten Quiz v2' });

    const updated = service.getQuizById(created.id);
    expect(updated?.updatedByDeviceId).toBeTruthy();
    expect(updated?.updatedByDeviceLabel).toBeTruthy();
    expect(updated?.updatedByBrowserLabel).toBeTruthy();
  });

  it('lehnt ungültige Sync-IDs ab', () => {
    const service = TestBed.inject(QuizStoreService);

    expect(() => service.activateSyncRoom('abc')).toThrowError('Ungültige Sync-ID.');
  });

  it('leert lokale Quizdaten beim Wechsel in einen unbekannten geteilten Sync-Raum', () => {
    const service = TestBed.inject(QuizStoreService);
    service.createQuiz({ name: 'Lokales Quiz' });

    service.activateSyncRoom('00000000-0000-4000-8000-000000000123', { markShared: true });

    expect(service.quizzes()).toEqual([]);
    expect(service.getDemoQuizId()).toBeNull();
  });

  it('seedet das Demo-Quiz nicht in geteilte Bibliotheken', () => {
    const service = TestBed.inject(QuizStoreService);

    service.activateSyncRoom('00000000-0000-4000-8000-000000000124', { markShared: true });

    expect(service.ensureDemoQuiz()).toBe(false);
    expect(service.quizzes()).toEqual([]);
    expect(service.getDemoQuizId()).toBeNull();
  });

  it('Demo-Quiz: fehlender Seed-Fingerprint oder alter Locale-Only-Key → Neu-Import passend zur Locale', () => {
    const roomId = '00000000-0000-4000-8000-000000000099';
    localStorage.setItem('quiz-sync-room-id', roomId);
    localStorage.setItem(
      `${QUIZ_STORAGE_KEY}:${roomId}`,
      JSON.stringify([
        {
          id: DEMO_QUIZ_ID,
          name: getDemoQuizExpectedTitle('en'),
          description: null,
          motifImageUrl: null,
          motifImageCredit: null,
          createdAt: '2026-03-08T12:00:00.000Z',
          updatedAt: '2026-03-08T12:00:00.000Z',
          settings: defaultSettings,
          questions: [],
        },
      ]),
    );
    localStorage.setItem('arsnova-demo-quiz-locale-v2', 'de');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'de' }],
    });

    const service = TestBed.inject(QuizStoreService);
    expect(service.getQuizById(DEMO_QUIZ_ID)?.name).toBe(getDemoQuizExpectedTitle('de'));
    expect(localStorage.getItem('arsnova-demo-quiz-seed-fp-v1')).toBe(
      getDemoQuizSeedFingerprint('de'),
    );
    expect(localStorage.getItem('arsnova-demo-quiz-locale-v2')).toBeNull();
  });

  it('Demo-Quiz: gespeicherter Fingerprint für andere Locale → Neu-Import', () => {
    const roomId = '00000000-0000-4000-8000-000000000088';
    localStorage.setItem('quiz-sync-room-id', roomId);
    localStorage.setItem(
      `${QUIZ_STORAGE_KEY}:${roomId}`,
      JSON.stringify([
        {
          id: DEMO_QUIZ_ID,
          name: getDemoQuizExpectedTitle('en'),
          description: null,
          motifImageUrl: null,
          motifImageCredit: null,
          createdAt: '2026-03-08T12:00:00.000Z',
          updatedAt: '2026-03-08T12:00:00.000Z',
          settings: defaultSettings,
          questions: [],
        },
      ]),
    );
    localStorage.setItem('arsnova-demo-quiz-seed-fp-v1', getDemoQuizSeedFingerprint('en'));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'de' }],
    });

    const service = TestBed.inject(QuizStoreService);
    expect(service.getQuizById(DEMO_QUIZ_ID)?.name).toBe(getDemoQuizExpectedTitle('de'));
  });

  it('Demo-Quiz: kanonischer EN-Titel bei DE-URL → Neu-Import trotz passendem Fingerprint', () => {
    const roomId = '00000000-0000-4000-8000-000000000077';
    localStorage.setItem('quiz-sync-room-id', roomId);
    localStorage.setItem(
      `${QUIZ_STORAGE_KEY}:${roomId}`,
      JSON.stringify([
        {
          id: DEMO_QUIZ_ID,
          name: getDemoQuizExpectedTitle('en'),
          description: null,
          motifImageUrl: null,
          motifImageCredit: null,
          createdAt: '2026-03-08T12:00:00.000Z',
          updatedAt: '2026-03-08T12:00:00.000Z',
          settings: defaultSettings,
          questions: [],
        },
      ]),
    );
    localStorage.setItem('arsnova-demo-quiz-seed-fp-v1', getDemoQuizSeedFingerprint('de'));

    window.history.pushState({}, '', '/de/quiz');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'de' }],
    });

    const service = TestBed.inject(QuizStoreService);
    expect(service.getQuizById(DEMO_QUIZ_ID)?.name).toBe(getDemoQuizExpectedTitle('de'));
  });

  it('Demo-Quiz: lokale Nutzeränderungen werden beim erneuten Seed-Check nicht überschrieben', () => {
    const service = TestBed.inject(QuizStoreService);
    const demo = service.getQuizById(DEMO_QUIZ_ID);
    const question =
      demo?.questions.find((entry) => entry.text.includes('\\pi')) ?? demo?.questions[1];

    expect(question).toBeDefined();

    service.updateQuestion(DEMO_QUIZ_ID, question!.id, {
      text: 'Was ist die Kreiszahl Pi?',
      type: 'NUMERIC_ESTIMATE',
      difficulty: question!.difficulty,
      timer: question!.timer,
      answers: [],
      skipReadingPhase: question!.skipReadingPhase ?? false,
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericReferenceValue: 3.14,
      numericIntervalLeft: 3.1,
      numericIntervalRight: 3.2,
      numericInputType: 'DECIMAL',
      numericDecimalPlaces: 2,
      numericTwoRounds: false,
    });

    expect(service.ensureDemoQuiz()).toBe(false);
    expect(
      service.getQuizById(DEMO_QUIZ_ID)?.questions.find((entry) => entry.id === question!.id),
    ).toEqual(
      expect.objectContaining({
        text: 'Was ist die Kreiszahl Pi?',
        type: 'NUMERIC_ESTIMATE',
        numericReferenceValue: 3.14,
      }),
    );
  });

  it('Demo-Quiz: gespeicherter Fingerprint mit defekter Schätzfrage → Neu-Import', () => {
    const roomId = '00000000-0000-4000-8000-000000000066';
    localStorage.setItem('quiz-sync-room-id', roomId);
    localStorage.setItem(
      `${QUIZ_STORAGE_KEY}:${roomId}`,
      JSON.stringify([
        {
          id: DEMO_QUIZ_ID,
          name: getDemoQuizExpectedTitle('de'),
          description: null,
          motifImageUrl: null,
          motifImageCredit: null,
          createdAt: '2026-03-08T12:00:00.000Z',
          updatedAt: '2026-03-08T12:00:00.000Z',
          settings: defaultSettings,
          questions: [
            {
              id: '9eff562e-51f8-4f72-98a3-2f421ef2b411',
              text: 'In welchem Jahr begann die Französische Revolution?',
              type: 'NUMERIC_ESTIMATE',
              difficulty: 'MEDIUM',
              order: 0,
              enabled: true,
              timer: null,
              answers: [],
              numericToleranceMode: 'ABSOLUTE_INTERVAL',
              numericReferenceValue: 1789,
              numericInputType: 'INTEGER',
              numericMin: 1500,
              numericMax: 2000,
              numericTwoRounds: true,
            },
          ],
        },
      ]),
    );
    localStorage.setItem('arsnova-demo-quiz-seed-fp-v1', getDemoQuizSeedFingerprint('de'));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'de' }],
    });

    const service = TestBed.inject(QuizStoreService);
    const demo = service.getQuizById(DEMO_QUIZ_ID);
    const piQuestion = demo?.questions.find((question) => question.text.includes('\\pi'));
    const revolutionQuestion = demo?.questions.find(
      (question) =>
        question.type === 'NUMERIC_ESTIMATE' && question.text.includes('Französische Revolution'),
    );

    expect(demo?.questions).toHaveLength(13);
    expect(piQuestion).toEqual(
      expect.objectContaining({
        type: 'NUMERIC_ESTIMATE',
        numericToleranceMode: 'ABSOLUTE_INTERVAL',
        numericReferenceValue: 3.14,
        numericTolerancePercent: null,
        numericIntervalLeft: 3.135,
        numericIntervalRight: 3.15,
        numericInputType: 'DECIMAL',
        numericDecimalPlaces: 2,
        numericMin: 3,
        numericMax: 3.5,
        numericTwoRounds: false,
      }),
    );
    expect(revolutionQuestion).toEqual(
      expect.objectContaining({
        numericToleranceMode: 'ABSOLUTE_INTERVAL',
        numericReferenceValue: 1789,
        numericIntervalLeft: 1788.5,
        numericIntervalRight: 1789.5,
        numericInputType: 'INTEGER',
        numericMin: 1500,
        numericMax: 2000,
        numericTwoRounds: true,
      }),
    );
    expect(service.getUploadPayload(DEMO_QUIZ_ID).questions).toContainEqual(
      expect.objectContaining({
        type: 'NUMERIC_ESTIMATE',
        numericToleranceMode: 'ABSOLUTE_INTERVAL',
        numericReferenceValue: 3.14,
        numericIntervalLeft: 3.135,
        numericIntervalRight: 3.15,
        numericMin: 3,
        numericMax: 3.5,
      }),
    );
    expect(service.getUploadPayload(DEMO_QUIZ_ID).questions).toContainEqual(
      expect.objectContaining({
        type: 'NUMERIC_ESTIMATE',
        numericReferenceValue: 1789,
        numericIntervalLeft: 1788.5,
        numericIntervalRight: 1789.5,
      }),
    );
  });

  it('Demo-Quiz: gespeicherter Fingerprint mit nur einer korrekten Startfrage → Neu-Import', () => {
    const roomId = '00000000-0000-4000-8000-000000000067';
    localStorage.setItem('quiz-sync-room-id', roomId);
    localStorage.setItem(
      `${QUIZ_STORAGE_KEY}:${roomId}`,
      JSON.stringify([
        {
          id: DEMO_QUIZ_ID,
          name: getDemoQuizExpectedTitle('de'),
          description: null,
          motifImageUrl: null,
          motifImageCredit: null,
          createdAt: '2026-03-08T12:00:00.000Z',
          updatedAt: '2999-01-01T00:00:00.000Z',
          settings: defaultSettings,
          questions: [
            {
              id: '9eff562e-51f8-4f72-98a3-2f421ef2b411',
              text: 'In welchem Jahr begann die Französische Revolution?',
              type: 'NUMERIC_ESTIMATE',
              difficulty: 'MEDIUM',
              order: 0,
              enabled: true,
              timer: null,
              answers: [],
              numericToleranceMode: 'ABSOLUTE_INTERVAL',
              numericReferenceValue: 1789,
              numericIntervalLeft: 1700,
              numericIntervalRight: 1900,
              numericInputType: 'INTEGER',
              numericMin: 1500,
              numericMax: 2000,
              numericTwoRounds: true,
            },
          ],
        },
      ]),
    );
    localStorage.setItem('arsnova-demo-quiz-seed-fp-v1', getDemoQuizSeedFingerprint('de'));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'de' }],
    });

    const service = TestBed.inject(QuizStoreService);
    const demo = service.getQuizById(DEMO_QUIZ_ID);

    expect(demo?.questions).toHaveLength(13);
    expect(demo?.questions.map((question) => question.type)).toEqual([
      'SURVEY',
      'FREETEXT',
      'NUMERIC_ESTIMATE',
      'SINGLE_CHOICE',
      'MULTIPLE_CHOICE',
      'SINGLE_CHOICE',
      'SINGLE_CHOICE',
      'SHORT_TEXT',
      'NUMERIC_ESTIMATE',
      'ORDERING',
      'MATCHING',
      'CATEGORIZATION',
      'RATING',
    ]);
  });

  it('getUploadPayload: Kita in localStorage schlägt Oberstufe-Standard im RAM (älteres LS mit Themenliste)', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({
      name: 'Live-Merge',
    });
    service.addQuestion(created.id, {
      text: 'Frage?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    const roomId = localStorage.getItem('quiz-sync-room-id');
    expect(roomId).toBeTruthy();

    const storageKey = `${QUIZ_STORAGE_KEY}:${roomId}`;
    const raw = localStorage.getItem(storageKey);
    expect(raw).toBeTruthy();
    const arr = JSON.parse(raw ?? '[]') as Record<string, unknown>[];
    const idx = arr.findIndex(
      (e) => e && typeof e === 'object' && (e as { id?: string }).id === created.id,
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    const entry = arr[idx] as Record<string, unknown>;
    const prevSettings = entry['settings'] as Record<string, unknown>;
    arr[idx] = {
      ...entry,
      settings: { ...prevSettings, nicknameTheme: 'KINDERGARTEN' },
      updatedAt: '2020-01-01T00:00:00.000Z',
    };
    localStorage.setItem(storageKey, JSON.stringify(arr));

    const payload = service.getUploadPayload(created.id);
    expect(payload.nicknameTheme).toBe('KINDERGARTEN');
  });

  it('getUploadPayload: ein neuerer Speicherstand darf die sichtbare Fragenliste nicht verkürzen', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({
      name: 'Start ab Frage',
    });
    for (const text of ['Erste Frage?', 'Zweite Frage?', 'Startfrage?']) {
      service.addQuestion(created.id, {
        text,
        type: 'SINGLE_CHOICE',
        difficulty: 'MEDIUM',
        answers: [
          { text: 'A', isCorrect: true },
          { text: 'B', isCorrect: false },
        ],
      });
    }

    const roomId = localStorage.getItem('quiz-sync-room-id');
    expect(roomId).toBeTruthy();
    const storageKey = `${QUIZ_STORAGE_KEY}:${roomId}`;
    const arr = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as Record<string, unknown>[];
    const idx = arr.findIndex(
      (entry) => entry && typeof entry === 'object' && (entry as { id?: string }).id === created.id,
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    const entry = arr[idx] as Record<string, unknown>;
    const questions = entry['questions'] as Record<string, unknown>[];
    const settings = entry['settings'] as Record<string, unknown>;
    arr[idx] = {
      ...entry,
      settings: { ...settings, nicknameTheme: 'KINDERGARTEN' },
      questions: questions.slice(2).map((question, order) => ({ ...question, order })),
      updatedAt: '2999-01-01T00:00:00.000Z',
    };
    localStorage.setItem(storageKey, JSON.stringify(arr));

    const payload = service.getUploadPayload(created.id);
    expect(payload.questions.map((question) => question.text)).toEqual([
      'Erste Frage?',
      'Zweite Frage?',
      'Startfrage?',
    ]);
    expect(payload.nicknameTheme).toBe('KINDERGARTEN');
  });

  it('persistiert Lernziele im raumgebundenen Sidecar und remappt sie bei Export, Import und Duplikat', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Lernziel-Quiz' });
    const question = service.addQuestion(created.id, {
      text: 'Was ist Kapselung?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      answers: [
        { text: 'Ein Entwurfsprinzip', isCorrect: true },
        { text: 'Ein Protokoll', isCorrect: false },
      ],
    });
    const objective = service.saveQuizLearningObjective(created.id, {
      text: 'Kapselung erklären',
      scope: { kind: 'question-set', sourceQuestionIds: [question.id] },
      confirmationState: 'confirmed',
    });

    const roomId = localStorage.getItem('quiz-sync-room-id');
    const stored = JSON.parse(
      localStorage.getItem(`quiz-learning-objectives-v1:${roomId}`) ?? '[]',
    ) as Array<{ quizId: string; objectives: Array<{ id: string }> }>;
    expect(stored).toContainEqual(
      expect.objectContaining({
        quizId: created.id,
        objectives: [expect.objectContaining({ id: objective.id })],
      }),
    );

    const exported = service.exportQuiz(created.id);
    expect(exported.exportVersion).toBe(2);
    if (exported.exportVersion !== 2) throw new Error('V2-Export erwartet');
    expect(exported.quiz.sourceQuizId).toBe(created.id);
    expect(exported.quiz.questions[0]?.sourceQuestionId).toBe(question.id);
    expect(exported.quiz.learningObjectives.objectives[0]?.id).toBe(objective.id);

    const duplicated = service.duplicateQuiz(created.id);
    const duplicateQuestionId = duplicated.questions[0]?.id;
    const duplicatedObjective = service.getLearningObjectiveBundle(duplicated.id).objectives[0];
    expect(duplicatedObjective?.id).not.toBe(objective.id);
    expect(duplicatedObjective?.scope).toEqual({
      kind: 'question-set',
      sourceQuestionIds: [duplicateQuestionId],
    });

    const imported = service.importQuiz(exported).quiz;
    const importedQuestionId = imported.questions[0]?.id;
    const importedObjective = service.getLearningObjectiveBundle(imported.id).objectives[0];
    expect(imported.id).not.toBe(created.id);
    expect(importedQuestionId).not.toBe(question.id);
    expect(importedObjective?.id).not.toBe(objective.id);
    expect(importedObjective?.scope).toEqual({
      kind: 'question-set',
      sourceQuestionIds: [importedQuestionId],
    });
  });

  it('unterscheidet beim Upload einen fehlenden Sidecar von einem bewusst leeren Bundle', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Leere Lernziele' });
    service.addQuestion(created.id, {
      text: 'Frage?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'Ja', isCorrect: true },
        { text: 'Nein', isCorrect: false },
      ],
    });

    expect(service.getUploadPayload(created.id).learningObjectives).toBeUndefined();
    const objective = service.saveQuizLearningObjective(created.id, {
      text: 'Die Frage einordnen',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });
    service.deleteQuizLearningObjective(created.id, objective.id, objective.revision);

    expect(service.getUploadPayload(created.id).learningObjectives).toEqual(
      expect.objectContaining({ quizId: created.id, objectives: [] }),
    );
  });

  it('lässt Lernziele mit deaktivierten Pflichtreferenzen vollständig aus und warnt', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Upload-Filter' });
    const disabledQuestion = service.addQuestion(created.id, {
      text: 'Deaktivierte Frage?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    service.addQuestion(created.id, {
      text: 'Aktive Frage?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    service.saveQuizLearningObjective(created.id, {
      text: 'Nur die deaktivierte Aufgabe verstehen',
      scope: { kind: 'question-set', sourceQuestionIds: [disabledQuestion.id] },
      confirmationState: 'draft',
    });
    service.setQuestionEnabled(created.id, disabledQuestion.id, false);

    const payload = service.getUploadPayload(created.id);
    expect(payload.learningObjectives).toEqual(
      expect.objectContaining({ quizId: created.id, objectives: [] }),
    );
    expect(service.takeUploadLearningObjectiveWarning()).toContain('1');
    expect(service.takeUploadLearningObjectiveWarning()).toBeNull();
  });

  it('fordert bei lokalen Lernziel-Updates immer die erwartete Revision', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'CAS' });
    const objective = service.saveQuizLearningObjective(created.id, {
      text: 'Ausgangstext',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });

    expect(() =>
      service.saveQuizLearningObjective(
        created.id,
        {
          text: 'Staler Text',
          scope: { kind: 'quiz-wide' },
          confirmationState: 'draft',
        },
        { objectiveId: objective.id },
      ),
    ).toThrow(/Revisionsstand/);
  });

  it('markiert modellabgeleitete Ziele nur bei semantischen Quellenänderungen als prüfbedürftig', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Stale-Markierung' });
    service.addQuestion(created.id, {
      text: 'Was ist Polymorphie?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'Viele Formen', isCorrect: true },
        { text: 'Ein Datentyp', isCorrect: false },
      ],
    });
    service.addQuestion(created.id, {
      text: 'Welche Aussage bleibt erhalten?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'Diese', isCorrect: true },
        { text: 'Keine', isCorrect: false },
      ],
    });
    const exported = service.exportQuiz(created.id);
    if (exported.exportVersion !== 2) throw new Error('V2-Export erwartet');
    const sourceQuestionId = exported.quiz.questions[0]!.sourceQuestionId;
    exported.quiz.learningObjectives = {
      schemaVersion: 1,
      quizId: created.id,
      revision: 1,
      objectives: [
        {
          id: 'd5d550ca-15df-4878-84d7-a2417597f52e',
          revision: 1,
          text: 'Polymorphie erklären',
          scope: { kind: 'question-set', sourceQuestionIds: [sourceQuestionId] },
          origin: {
            kind: 'model-derived',
            modelId: 'model',
            modelVersion: '1',
            derivationVersion: '1',
            derivedFromSourceQuestionIds: [sourceQuestionId],
            sourceDigest: 'a'.repeat(64),
          },
          confirmation: {
            state: 'confirmed',
            confirmedAt: '2026-10-04T12:00:00.000Z',
            confirmedRevision: 1,
          },
          createdAt: '2026-10-04T12:00:00.000Z',
          updatedAt: '2026-10-04T12:00:00.000Z',
        },
      ],
    };
    const imported = service.importQuiz(exported).quiz;
    const importedQuestion = imported.questions[0]!;

    service.updateQuestion(imported.id, importedQuestion.id, {
      text: importedQuestion.text,
      type: importedQuestion.type,
      difficulty: 'HARD',
      timer: 90,
      answers: importedQuestion.answers.map(({ text, isCorrect }) => ({ text, isCorrect })),
    });
    expect(service.getLearningObjectiveBundle(imported.id).objectives[0]?.confirmation.state).toBe(
      'confirmed',
    );

    service.updateQuestion(imported.id, importedQuestion.id, {
      text: 'Was bedeutet Polymorphie?',
      type: importedQuestion.type,
      difficulty: 'HARD',
      timer: 90,
      answers: importedQuestion.answers.map(({ text, isCorrect }) => ({ text, isCorrect })),
    });
    expect(service.getLearningObjectiveBundle(imported.id).objectives[0]?.confirmation).toEqual(
      expect.objectContaining({ state: 'needs-review', reason: 'source-content-changed' }),
    );

    const staleExport = service.exportQuiz(imported.id);
    const staleImport = service.importQuiz(staleExport).quiz;
    const staleDuplicate = service.duplicateQuiz(imported.id);
    expect(service.getLearningObjectiveBundle(staleImport.id).objectives[0]?.confirmation).toEqual(
      expect.objectContaining({ state: 'needs-review', reason: 'source-content-changed' }),
    );
    expect(
      service.getLearningObjectiveBundle(staleDuplicate.id).objectives[0]?.confirmation,
    ).toEqual(expect.objectContaining({ state: 'needs-review', reason: 'source-content-changed' }));

    service.deleteQuestion(imported.id, importedQuestion.id);
    const removed = service.getLearningObjectiveBundle(imported.id).objectives[0]!;
    expect(removed.confirmation).toEqual(
      expect.objectContaining({ state: 'needs-review', reason: 'source-reference-removed' }),
    );
    const editedDraft = service.saveQuizLearningObjective(
      imported.id,
      {
        text: 'Polymorphie trotz fehlender Quelle prüfen',
        scope: removed.scope,
        confirmationState: 'draft',
      },
      { objectiveId: removed.id, expectedRevision: removed.revision },
    );
    expect(editedDraft.confirmation).toEqual(
      expect.objectContaining({ state: 'needs-review', reason: 'source-reference-removed' }),
    );

    const removedSourceId =
      editedDraft.origin.kind === 'model-derived'
        ? editedDraft.origin.derivedFromSourceQuestionIds[0]
        : null;
    const deletedReferenceExport = service.exportQuiz(imported.id);
    const deletedReferenceImport = service.importQuiz(deletedReferenceExport).quiz;
    const remappedDeletedReference = service.getLearningObjectiveBundle(deletedReferenceImport.id)
      .objectives[0]!;
    expect(remappedDeletedReference.confirmation).toEqual(
      expect.objectContaining({ state: 'needs-review', reason: 'source-reference-removed' }),
    );
    expect(
      remappedDeletedReference.origin.kind === 'model-derived'
        ? remappedDeletedReference.origin.derivedFromSourceQuestionIds[0]
        : null,
    ).not.toBe(removedSourceId);
  });

  it('markiert auch ein bestätigtes manuelles Ziel nach Löschen seiner Aufgabe als prüfbedürftig', () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Manueller Verweis' });
    const question = service.addQuestion(created.id, {
      text: 'Zu löschende Aufgabe?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    service.addQuestion(created.id, {
      text: 'Verbleibende Aufgabe?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    service.saveQuizLearningObjective(created.id, {
      text: 'Aufgabe verstehen',
      scope: { kind: 'question-set', sourceQuestionIds: [question.id] },
      confirmationState: 'confirmed',
    });

    service.deleteQuestion(created.id, question.id);

    expect(service.getLearningObjectiveBundle(created.id).objectives[0]?.confirmation).toEqual(
      expect.objectContaining({ state: 'needs-review', reason: 'source-reference-removed' }),
    );
    const exported = service.exportQuiz(created.id);
    const imported = service.importQuiz(exported).quiz;
    const importedObjective = service.getLearningObjectiveBundle(imported.id).objectives[0]!;
    expect(importedObjective.confirmation).toEqual(
      expect.objectContaining({ state: 'needs-review', reason: 'source-reference-removed' }),
    );
    expect(
      importedObjective.scope.kind === 'question-set'
        ? importedObjective.scope.sourceQuestionIds[0]
        : null,
    ).not.toBe(question.id);
  });

  it('behandelt Marker plus leere Yjs-Map als autoritatives Entfernen statt einen stale Mirror wiederzubeleben', async () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Autoritativ leer' });
    service.addQuestion(created.id, {
      text: 'Frage?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    service.saveQuizLearningObjective(created.id, {
      text: 'Lokaler stale Stand',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });

    const Y = await import('yjs');
    const yDoc = new Y.Doc();
    const yRoot = yDoc.getMap<string>('quiz-library');
    const yObjectives = yDoc.getMap<string>('quiz-learning-objectives-v1');
    yRoot.set('quizzes', localStorage.getItem(QUIZ_STORAGE_KEY) ?? '[]');
    yRoot.set('quiz-learning-objectives-v1-initialized', '1');
    const internals = service as unknown as {
      yDoc: InstanceType<typeof Y.Doc>;
      yRoot: import('yjs').Map<string>;
      yLearningObjectivesRoot: import('yjs').Map<string>;
      syncFromYjsOrSeed: () => void;
      finishLearningObjectiveYjsRestore: () => void;
    };
    // Dieser Test modelliert einen bereits vorhandenen, aber veralteten Mirror,
    // nicht eine neue Bearbeitung während der initialen Wiederherstellung.
    internals.finishLearningObjectiveYjsRestore();
    internals.yDoc = yDoc;
    internals.yRoot = yRoot;
    internals.yLearningObjectivesRoot = yObjectives;
    internals.syncFromYjsOrSeed();

    expect(service.getUploadPayload(created.id).learningObjectives).toBeUndefined();
  });

  it('führt eine lokale Lernzieländerung während der initialen Yjs-Wiederherstellung kausal zusammen', async () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Frühe Bearbeitung' });
    service.addQuestion(created.id, {
      text: 'Frage?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    const original = service.saveQuizLearningObjective(created.id, {
      text: 'Ausgangsfassung',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });
    const remoteBaseline = service.getLearningObjectiveBundle(created.id);

    const Y = await import('yjs');
    const yDoc = new Y.Doc();
    const yRoot = yDoc.getMap<string>('quiz-library');
    const yObjectives = yDoc.getMap<string>('quiz-learning-objectives-v1');
    yRoot.set('quizzes', localStorage.getItem(QUIZ_STORAGE_KEY) ?? '[]');
    yRoot.set('quiz-learning-objectives-v1-initialized', '1');
    yObjectives.set(created.id, JSON.stringify(remoteBaseline));
    const internals = service as unknown as {
      yDoc: InstanceType<typeof Y.Doc> | null;
      yRoot: import('yjs').Map<string> | null;
      yLearningObjectivesRoot: import('yjs').Map<string> | null;
      syncRoomId: () => string;
      beginLearningObjectiveYjsRestore: (roomId: string) => void;
      finishLearningObjectiveYjsRestore: () => void;
      syncFromYjsOrSeed: () => void;
    };
    internals.finishLearningObjectiveYjsRestore();
    internals.yDoc = null;
    internals.yRoot = null;
    internals.yLearningObjectivesRoot = null;
    internals.beginLearningObjectiveYjsRestore(internals.syncRoomId());

    service.saveQuizLearningObjective(
      created.id,
      {
        text: 'Direkt nach dem Öffnen bearbeitet',
        scope: { kind: 'quiz-wide' },
        confirmationState: 'confirmed',
      },
      { objectiveId: original.id, expectedRevision: original.revision },
    );

    internals.yDoc = yDoc;
    internals.yRoot = yRoot;
    internals.yLearningObjectivesRoot = yObjectives;
    internals.syncFromYjsOrSeed();

    expect(service.getLearningObjectiveBundle(created.id).objectives[0]).toEqual(
      expect.objectContaining({
        id: original.id,
        revision: 2,
        text: 'Direkt nach dem Öffnen bearbeitet',
        confirmation: expect.objectContaining({ state: 'confirmed' }),
      }),
    );
    expect(service.learningObjectiveSyncConflicts()).toEqual([]);
  });

  it('seedet einen frischen unmarkierten Yjs-Sidecar aus dem lokalen Mirror', async () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Frischer Sidecar' });
    service.addQuestion(created.id, {
      text: 'Frage?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    service.saveQuizLearningObjective(created.id, {
      text: 'Lokales Ziel',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });

    const Y = await import('yjs');
    const yDoc = new Y.Doc();
    const yRoot = yDoc.getMap<string>('quiz-library');
    const yObjectives = yDoc.getMap<string>('quiz-learning-objectives-v1');
    yRoot.set('quizzes', localStorage.getItem(QUIZ_STORAGE_KEY) ?? '[]');
    const internals = service as unknown as {
      yDoc: InstanceType<typeof Y.Doc>;
      yRoot: import('yjs').Map<string>;
      yLearningObjectivesRoot: import('yjs').Map<string>;
      syncFromYjsOrSeed: () => void;
    };
    internals.yDoc = yDoc;
    internals.yRoot = yRoot;
    internals.yLearningObjectivesRoot = yObjectives;
    internals.syncFromYjsOrSeed();

    expect(yRoot.get('quiz-learning-objectives-v1-initialized')).toBe('1');
    expect(yObjectives.get(created.id)).toBe('oplog-v1');
    expect(yDoc.getMap(`quiz-learning-objectives-v1-oplog:${created.id}`).size).toBeGreaterThan(0);
  });

  it('behält bei einem beschädigten Remote-Sidecar den letzten gültigen Stand ohne ihn zu überschreiben', async () => {
    const service = TestBed.inject(QuizStoreService);
    const created = service.createQuiz({ name: 'Beschädigter Sidecar' });
    service.addQuestion(created.id, {
      text: 'Frage?',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
    service.saveQuizLearningObjective(created.id, {
      text: 'Gültiger lokaler Stand',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });

    const Y = await import('yjs');
    const yDoc = new Y.Doc();
    const yRoot = yDoc.getMap<string>('quiz-library');
    const yObjectives = yDoc.getMap<string>('quiz-learning-objectives-v1');
    yRoot.set('quizzes', localStorage.getItem(QUIZ_STORAGE_KEY) ?? '[]');
    yRoot.set('quiz-learning-objectives-v1-initialized', '1');
    yObjectives.set(created.id, '{kaputt');
    const internals = service as unknown as {
      yDoc: InstanceType<typeof Y.Doc>;
      yRoot: import('yjs').Map<string>;
      yLearningObjectivesRoot: import('yjs').Map<string>;
      syncFromYjsOrSeed: () => void;
      writeYjsSnapshot: () => void;
    };
    internals.yDoc = yDoc;
    internals.yRoot = yRoot;
    internals.yLearningObjectivesRoot = yObjectives;
    internals.syncFromYjsOrSeed();
    internals.writeYjsSnapshot();

    expect(service.getLearningObjectiveBundle(created.id).objectives[0]?.text).toBe(
      'Gültiger lokaler Stand',
    );
    expect(yObjectives.get(created.id)).toBe('{kaputt');
  });

  it('führt gleichzeitige Änderungen an verschiedenen Lernzielen aus dem Yjs-Oplog zusammen', async () => {
    const service = TestBed.inject(QuizStoreService);
    const quiz = service.createQuiz({ name: 'CRDT-Merge' });
    const first = service.saveQuizLearningObjective(quiz.id, {
      text: 'Erstes Ziel',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });
    const second = service.saveQuizLearningObjective(quiz.id, {
      text: 'Zweites Ziel',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });
    const baseline = service.getLearningObjectiveBundle(quiz.id);
    const Y = await import('yjs');
    const yDoc = new Y.Doc();
    const yRoot = yDoc.getMap<string>('quiz-library');
    const yObjectives = yDoc.getMap<string>('quiz-learning-objectives-v1');
    yRoot.set('quizzes', localStorage.getItem(QUIZ_STORAGE_KEY) ?? '[]');
    yRoot.set('quiz-learning-objectives-v1-initialized', '1');
    yObjectives.set(quiz.id, JSON.stringify(baseline));
    const internals = service as unknown as {
      yDoc: InstanceType<typeof Y.Doc>;
      yRoot: import('yjs').Map<string>;
      yLearningObjectivesRoot: import('yjs').Map<string>;
      syncFromYjsOrSeed: () => void;
      applyYjsLearningObjectivesSnapshot: () => void;
    };
    internals.yDoc = yDoc;
    internals.yRoot = yRoot;
    internals.yLearningObjectivesRoot = yObjectives;
    internals.syncFromYjsOrSeed();

    const operations = yDoc.getMap<string>(`quiz-learning-objectives-v1-oplog:${quiz.id}`);
    const seedByObjective = new Map<string, string>();
    for (const [operationId, raw] of operations.entries()) {
      seedByObjective.set((JSON.parse(raw) as { objectiveId: string }).objectiveId, operationId);
    }
    const addBranch = (objective: typeof first, text: string, parentOperationId: string) => {
      const operationId = crypto.randomUUID();
      const next = { ...objective, revision: 2, text, updatedAt: objective.updatedAt };
      operations.set(
        operationId,
        JSON.stringify({
          schemaVersion: 1,
          operationId,
          quizId: quiz.id,
          objectiveId: objective.id,
          kind: 'upsert',
          expectedRevision: 1,
          resultingRevision: 2,
          bundleResultRevision: baseline.revision + 1,
          parentOperationIds: [parentOperationId],
          writtenAt: objective.updatedAt,
          objective: next,
        }),
      );
    };
    addBranch(first, 'Erstes Ziel – Gerät A', seedByObjective.get(first.id)!);
    addBranch(second, 'Zweites Ziel – Gerät B', seedByObjective.get(second.id)!);

    internals.applyYjsLearningObjectivesSnapshot();

    expect(
      service
        .getLearningObjectiveBundle(quiz.id)
        .objectives.map(({ text }) => text)
        .sort(),
    ).toEqual(['Erstes Ziel – Gerät A', 'Zweites Ziel – Gerät B']);
    expect(service.learningObjectiveSyncConflicts()).toEqual([]);
  });

  it('bewahrt divergente kausale Köpfe auf, löst sie bewusst und ignoriert Zukunftsuhren für Autorität', async () => {
    const service = TestBed.inject(QuizStoreService);
    const quiz = service.createQuiz({ name: 'CRDT-Konflikt' });
    const original = service.saveQuizLearningObjective(quiz.id, {
      text: 'Ausgang',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });
    const baseline = service.getLearningObjectiveBundle(quiz.id);
    const Y = await import('yjs');
    const yDoc = new Y.Doc();
    const yRoot = yDoc.getMap<string>('quiz-library');
    const yObjectives = yDoc.getMap<string>('quiz-learning-objectives-v1');
    yRoot.set('quizzes', localStorage.getItem(QUIZ_STORAGE_KEY) ?? '[]');
    yRoot.set('quiz-learning-objectives-v1-initialized', '1');
    yObjectives.set(quiz.id, JSON.stringify(baseline));
    const internals = service as unknown as {
      yDoc: InstanceType<typeof Y.Doc>;
      yRoot: import('yjs').Map<string>;
      yLearningObjectivesRoot: import('yjs').Map<string>;
      syncFromYjsOrSeed: () => void;
      applyYjsLearningObjectivesSnapshot: () => void;
    };
    internals.yDoc = yDoc;
    internals.yRoot = yRoot;
    internals.yLearningObjectivesRoot = yObjectives;
    internals.syncFromYjsOrSeed();
    const operations = yDoc.getMap<string>(`quiz-learning-objectives-v1-oplog:${quiz.id}`);
    const [seedOperationId] = [...operations.keys()];
    const addOperation = (
      operationId: string,
      parentOperationIds: string[],
      revision: number,
      text: string,
      updatedAt: string,
    ) => {
      const objective = { ...original, revision, text, updatedAt };
      operations.set(
        operationId,
        JSON.stringify({
          schemaVersion: 1,
          operationId,
          quizId: quiz.id,
          objectiveId: original.id,
          kind: 'upsert',
          expectedRevision: revision - 1,
          resultingRevision: revision,
          bundleResultRevision: baseline.revision + revision - 1,
          parentOperationIds,
          writtenAt: updatedAt,
          objective,
        }),
      );
    };
    const branchA2 = '10000000-0000-4000-8000-000000000002';
    const branchB2 = '20000000-0000-4000-8000-000000000002';
    addOperation(branchA2, [seedOperationId!], 2, 'Fassung A2', original.updatedAt);
    addOperation(branchB2, [seedOperationId!], 2, 'Fassung B2', '2099-01-01T00:00:00.000Z');
    internals.applyYjsLearningObjectivesSnapshot();

    expect(
      service
        .learningObjectiveSyncConflicts()[0]
        ?.alternatives.map((entry) => entry.objective?.text),
    ).toEqual(['Fassung A2', 'Fassung B2']);

    const branchA3 = '10000000-0000-4000-8000-000000000003';
    addOperation(branchA3, [branchA2], 3, 'Fassung A3', original.updatedAt);
    internals.applyYjsLearningObjectivesSnapshot();
    const conflict = service.learningObjectiveSyncConflicts()[0]!;
    expect(conflict.revision).toBe(3);
    expect(conflict.alternatives.map((entry) => entry.objective?.text)).toEqual([
      'Fassung A3',
      'Fassung B2',
    ]);
    expect(conflict.alternatives.map((entry) => entry.objective?.text)).not.toContain('Fassung A2');

    service.resolveQuizLearningObjectiveSyncConflict(quiz.id, original.id, branchB2);

    const resolved = service.getLearningObjectiveBundle(quiz.id).objectives[0]!;
    expect(resolved).toEqual(expect.objectContaining({ text: 'Fassung B2', revision: 4 }));
    expect(Date.parse(resolved.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse('2099-01-01T00:00:00.000Z'),
    );
    expect(service.learningObjectiveSyncConflicts()).toEqual([]);
    const resolution = [...operations.values()]
      .map((raw) => JSON.parse(raw) as { resultingRevision: number; parentOperationIds: string[] })
      .find((operation) => operation.resultingRevision === 4)!;
    expect(resolution.parentOperationIds).toEqual([branchA3, branchB2].sort());
  });

  it('übersetzt einen späten Legacy-Bundle-Write in Konfliktoperationen ohne parallele Ziele zu löschen', async () => {
    const service = TestBed.inject(QuizStoreService);
    const quiz = service.createQuiz({ name: 'CRDT-Mischversion' });
    const original = service.saveQuizLearningObjective(quiz.id, {
      text: 'Ausgang',
      scope: { kind: 'quiz-wide' },
      confirmationState: 'draft',
    });
    const baseline = service.getLearningObjectiveBundle(quiz.id);
    const Y = await import('yjs');
    const yDoc = new Y.Doc();
    const yRoot = yDoc.getMap<string>('quiz-library');
    const yObjectives = yDoc.getMap<string>('quiz-learning-objectives-v1');
    yRoot.set('quizzes', localStorage.getItem(QUIZ_STORAGE_KEY) ?? '[]');
    yRoot.set('quiz-learning-objectives-v1-initialized', '1');
    yObjectives.set(quiz.id, JSON.stringify(baseline));
    const internals = service as unknown as {
      yDoc: InstanceType<typeof Y.Doc>;
      yRoot: import('yjs').Map<string>;
      yLearningObjectivesRoot: import('yjs').Map<string>;
      syncFromYjsOrSeed: () => void;
      migrateLegacyLearningObjectiveEntries: () => void;
      applyYjsLearningObjectivesSnapshot: () => void;
    };
    internals.yDoc = yDoc;
    internals.yRoot = yRoot;
    internals.yLearningObjectivesRoot = yObjectives;
    internals.syncFromYjsOrSeed();

    const operations = yDoc.getMap<string>(`quiz-learning-objectives-v1-oplog:${quiz.id}`);
    const seedOperationId = [...operations.entries()]
      .map(
        ([operationId, raw]) => [operationId, JSON.parse(raw) as { objectiveId: string }] as const,
      )
      .find(([, operation]) => operation.objectiveId === original.id)?.[0];
    expect(seedOperationId).toBeTruthy();

    const branchAId = '40000000-0000-4000-8000-000000000002';
    const branchA = { ...original, revision: 2, text: 'Fassung aus dem Oplog' };
    operations.set(
      branchAId,
      JSON.stringify({
        schemaVersion: 1,
        operationId: branchAId,
        quizId: quiz.id,
        objectiveId: original.id,
        kind: 'upsert',
        expectedRevision: 1,
        resultingRevision: 2,
        bundleResultRevision: baseline.revision + 1,
        parentOperationIds: [seedOperationId!],
        writtenAt: branchA.updatedAt,
        objective: branchA,
      }),
    );
    const parallelObjectiveId = '50000000-0000-4000-8000-000000000001';
    const parallelOperationId = '50000000-0000-4000-8000-000000000002';
    const parallelObjective = {
      ...original,
      id: parallelObjectiveId,
      revision: 1,
      text: 'Parallel neu angelegt',
    };
    operations.set(
      parallelOperationId,
      JSON.stringify({
        schemaVersion: 1,
        operationId: parallelOperationId,
        quizId: quiz.id,
        objectiveId: parallelObjectiveId,
        kind: 'upsert',
        expectedRevision: null,
        resultingRevision: 1,
        bundleResultRevision: baseline.revision + 1,
        parentOperationIds: [],
        writtenAt: parallelObjective.updatedAt,
        objective: parallelObjective,
      }),
    );

    const legacyBranch = { ...original, revision: 2, text: 'Fassung vom alten Client' };
    yObjectives.set(
      quiz.id,
      JSON.stringify({
        ...baseline,
        revision: baseline.revision + 1,
        objectives: [legacyBranch],
      }),
    );
    internals.migrateLegacyLearningObjectiveEntries();
    internals.applyYjsLearningObjectivesSnapshot();

    expect(yObjectives.get(quiz.id)).toBe('oplog-v1');
    expect(service.getLearningObjectiveBundle(quiz.id).objectives).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: parallelObjectiveId })]),
    );
    expect(
      service
        .learningObjectiveSyncConflicts()[0]
        ?.alternatives.map((alternative) => alternative.objective?.text),
    ).toEqual(expect.arrayContaining(['Fassung aus dem Oplog', 'Fassung vom alten Client']));
  });

  it('bereinigt beim späten Beitritt verwaiste Legacy-Ziele mit Tombstones ohne stale Wiederbelebung', async () => {
    vi.useFakeTimers();
    try {
      const service = TestBed.inject(QuizStoreService);
      const quiz = service.createQuiz({ name: 'Legacy-Löschung' });
      const objective = service.saveQuizLearningObjective(quiz.id, {
        text: 'Nicht wiederbeleben',
        scope: { kind: 'quiz-wide' },
        confirmationState: 'draft',
      });
      const bundle = service.getLearningObjectiveBundle(quiz.id);
      const Y = await import('yjs');
      const yDoc = new Y.Doc();
      const yRoot = yDoc.getMap<string>('quiz-library');
      const yObjectives = yDoc.getMap<string>('quiz-learning-objectives-v1');
      yRoot.set('quizzes', '[]');
      yRoot.set('quiz-learning-objectives-v1-initialized', '1');
      yObjectives.set(quiz.id, JSON.stringify(bundle));
      const internals = service as unknown as {
        yDoc: InstanceType<typeof Y.Doc>;
        yRoot: import('yjs').Map<string>;
        yLearningObjectivesRoot: import('yjs').Map<string>;
        quizDocuments: { set: (value: unknown[]) => void };
        librarySharingMode: { set: (value: 'shared') => void };
        lastSerializedQuizDocuments: string;
        syncFromYjsOrSeed: () => void;
        applyYjsLearningObjectivesSnapshot: () => void;
      };
      internals.yDoc = yDoc;
      internals.yRoot = yRoot;
      internals.yLearningObjectivesRoot = yObjectives;
      internals.quizDocuments.set([]);
      internals.librarySharingMode.set('shared');
      internals.lastSerializedQuizDocuments = 'not-the-remote-payload';
      internals.syncFromYjsOrSeed();

      vi.advanceTimersByTime(1500);

      expect(yObjectives.has(quiz.id)).toBe(false);
      expect(service.getLearningObjectiveBundle(quiz.id).objectives).toEqual([]);
      const operations = yDoc.getMap<string>(`quiz-learning-objectives-v1-oplog:${quiz.id}`);
      const tombstone = [...operations.values()]
        .map((raw) => JSON.parse(raw) as { kind: string; resultingRevision: number })
        .find((operation) => operation.kind === 'delete');
      expect(tombstone).toEqual(expect.objectContaining({ kind: 'delete', resultingRevision: 2 }));

      const staleOperationId = '30000000-0000-4000-8000-000000000001';
      operations.set(
        staleOperationId,
        JSON.stringify({
          schemaVersion: 1,
          operationId: staleOperationId,
          quizId: quiz.id,
          objectiveId: objective.id,
          kind: 'upsert',
          expectedRevision: 0,
          resultingRevision: 1,
          bundleResultRevision: 1,
          parentOperationIds: [],
          writtenAt: '2199-01-01T00:00:00.000Z',
          objective,
        }),
      );
      yObjectives.set(quiz.id, 'oplog-v1');
      internals.applyYjsLearningObjectivesSnapshot();

      expect(service.getLearningObjectiveBundle(quiz.id).objectives).toEqual([]);
      expect(service.learningObjectiveSyncConflicts()[0]?.alternatives).toEqual(
        expect.arrayContaining([expect.objectContaining({ operationId: staleOperationId })]),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
