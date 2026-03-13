import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  QUIZ_STORAGE_KEY,
  QuizStoreService,
  type QuizDocument,
} from './quiz-store.service';

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
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('erstellt ein Quiz und speichert es in localStorage', () => {
    const service = TestBed.inject(QuizStoreService);

    const created = service.createQuiz({
      name: 'Einführung Informatik',
      description: 'Kapitel 1',
    });

    expect(created.id).toBeTruthy();
    expect(service.quizzes().length).toBe(1);
    expect(service.quizzes()[0]?.name).toBe('Einführung Informatik');
    expect(service.quizzes()[0]?.questionCount).toBe(0);

    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    expect(raw).toBeTruthy();
  });

  it('lädt bereits gespeicherte Quizzes inkl. Fragen beim Start', () => {
    const stored: QuizDocument[] = [
      {
        id: '6b442f6f-2f8a-4bad-95da-69f5e9cd2649',
        name: 'Vorlesung 1',
        description: null,
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

    expect(service.quizzes().length).toBe(1);
    expect(service.quizzes()[0]?.name).toBe('Vorlesung 1');
    expect(service.quizzes()[0]?.questionCount).toBe(1);
    expect(service.getQuizById('6b442f6f-2f8a-4bad-95da-69f5e9cd2649')?.questions.length).toBe(1);
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

    expect(service.quizzes()).toEqual([]);
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
    expect(settings?.allowCustomNicknames).toBe(true);
    expect(settings?.defaultTimer).toBeNull();
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
      ratingMin: 1,
      ratingMax: 10,
      ratingLabelMin: 'schlecht',
      ratingLabelMax: 'sehr gut',
    });

    const exported = service.exportQuiz(created.id);
    const imported = service.importQuiz(exported);

    expect(exported.exportVersion).toBeGreaterThanOrEqual(1);
    expect(imported.id).not.toBe(created.id);
    expect(imported.name).toBe('Export Quiz');
    expect(imported.questions[0]?.type).toBe('RATING');
    expect(imported.questions[0]?.ratingMax).toBe(10);
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

  it('lehnt ungültige Sync-IDs ab', () => {
    const service = TestBed.inject(QuizStoreService);

    expect(() => service.activateSyncRoom('abc')).toThrowError('Ungültige Sync-ID.');
  });
});
