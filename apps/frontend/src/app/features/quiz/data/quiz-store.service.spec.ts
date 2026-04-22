import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDemoQuizSeedFingerprint } from './demo-quiz-payload';
import {
  DEMO_QUIZ_ID,
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
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
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
    const aus = imported.questions.find((q) => q.text === 'Aus');
    expect(aus?.enabled).toBe(false);
    const an = imported.questions.find((q) => q.text === 'An');
    expect(an?.enabled).toBe(true);
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

  it('markiert eine Bibliothek beim bewussten Sync als geteilt', () => {
    const service = TestBed.inject(QuizStoreService);

    service.activateSyncRoom('syncroom_123', { markShared: true });

    expect(service.librarySharingMode()).toBe('shared');
  });

  it('merkt sich die ursprüngliche Freigabequelle nur einmalig', () => {
    const service = TestBed.inject(QuizStoreService);

    service.activateSyncRoom('syncroom_123', { markShared: true, registerOrigin: true });
    const firstOriginDevice = service.originDeviceLabel();
    const firstOriginBrowser = service.originBrowserLabel();
    const firstOriginAt = service.originSharedAt();

    service.activateSyncRoom('syncroom_123', { markShared: true, registerOrigin: true });

    expect(service.originDeviceLabel()).toBe(firstOriginDevice);
    expect(service.originBrowserLabel()).toBe(firstOriginBrowser);
    expect(service.originSharedAt()).toBe(firstOriginAt);
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
          name: 'All question formats – high school demo quiz',
          description: null,
          motifImageUrl: null,
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
    expect(service.getQuizById(DEMO_QUIZ_ID)?.name).toBe(
      'Alle Frageformate – Quiz aus der Oberstufe',
    );
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
          name: 'All question formats – high school demo quiz',
          description: null,
          motifImageUrl: null,
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
    expect(service.getQuizById(DEMO_QUIZ_ID)?.name).toBe(
      'Alle Frageformate – Quiz aus der Oberstufe',
    );
  });

  it('Demo-Quiz: kanonischer EN-Titel bei DE-URL → Neu-Import trotz passendem Fingerprint', () => {
    const roomId = '00000000-0000-4000-8000-000000000077';
    localStorage.setItem('quiz-sync-room-id', roomId);
    localStorage.setItem(
      `${QUIZ_STORAGE_KEY}:${roomId}`,
      JSON.stringify([
        {
          id: DEMO_QUIZ_ID,
          name: 'All question formats – high school demo quiz',
          description: null,
          motifImageUrl: null,
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
    expect(service.getQuizById(DEMO_QUIZ_ID)?.name).toBe(
      'Alle Frageformate – Quiz aus der Oberstufe',
    );
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
});
