import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuizEditComponent } from './quiz-edit.component';
import { QuizStoreService, type QuizDocument } from '../data/quiz-store.service';

const QUIZ_ID = '78cc92d6-a4a5-4e38-8fd5-4bf558412be6';
const QUESTION_ID = '2e7095a8-a780-470b-a068-78d57cab6187';

describe('QuizEditComponent', () => {
  const quiz: QuizDocument = {
    id: QUIZ_ID,
    name: 'Test-Quiz',
    description: 'Beschreibung',
    motifImageUrl: null,
    createdAt: '2026-03-08T12:00:00.000Z',
    updatedAt: '2026-03-08T12:00:00.000Z',
    settings: {
      showLeaderboard: true,
      allowCustomNicknames: true,
      defaultTimer: null,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
      backgroundMusic: null,
      nicknameTheme: 'NOBEL_LAUREATES',
      bonusTokenCount: null,
      readingPhaseEnabled: false,
      preset: 'PLAYFUL',
    },
    questions: [],
  };

  const mockStore = {
    getQuizById: vi.fn((id: string) => (id === QUIZ_ID ? quiz : null)),
    addQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    updateQuizMetadata: vi.fn(),
    updateQuizSettings: vi.fn(),
    deleteQuestion: vi.fn(),
    setQuestionEnabled: vi.fn(),
  };

  beforeEach(() => {
    quiz.questions = [];
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [QuizEditComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: QUIZ_ID }),
              firstChild: null,
            },
          },
        },
        { provide: QuizStoreService, useValue: mockStore },
      ],
    });
  });

  it('synchronisiert nicknameTheme in den Store ohne Einstellungen-Übernehmen', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    mockStore.updateQuizSettings.mockClear();
    component.settingsForm.controls.nicknameTheme.setValue('KINDERGARTEN');
    expect(mockStore.updateQuizSettings).toHaveBeenCalledWith(
      QUIZ_ID,
      expect.objectContaining({
        nicknameTheme: 'KINDERGARTEN',
        allowCustomNicknames: true,
        anonymousMode: false,
      }),
    );
  });

  it('fügt bei gültigen Daten eine Frage hinzu', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.form.controls.text.setValue('Was ist korrekt?');
    component.answersArray.at(0).controls.text.setValue('Antwort A');
    component.answersArray.at(1).controls.text.setValue('Antwort B');
    component.setSingleCorrect(1);

    component.addQuestion();

    expect(mockStore.addQuestion).toHaveBeenCalledWith(QUIZ_ID, {
      text: 'Was ist korrekt?',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      answers: [
        { text: 'Antwort A', isCorrect: false },
        { text: 'Antwort B', isCorrect: true },
      ],
    });
    expect(mockStore.updateQuestion).not.toHaveBeenCalled();
  });

  it('speichert eine FREETEXT-Frage ohne Antwortoptionen', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.form.controls.type.setValue('FREETEXT');
    component.onTypeChanged();
    component.form.controls.text.setValue('Was nimmst du heute mit?');

    component.addQuestion();

    expect(mockStore.addQuestion).toHaveBeenCalledWith(QUIZ_ID, {
      text: 'Was nimmst du heute mit?',
      type: 'FREETEXT',
      difficulty: 'MEDIUM',
      answers: [],
    });
  });

  it('speichert eine SURVEY-Frage ohne korrekte Antworten', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.form.controls.type.setValue('SURVEY');
    component.onTypeChanged();
    component.form.controls.text.setValue('Wie war das Tempo?');
    component.answersArray.at(0).controls.text.setValue('Zu schnell');
    component.answersArray.at(1).controls.text.setValue('Passend');
    component.answersArray.at(0).controls.isCorrect.setValue(true);

    component.addQuestion();

    expect(mockStore.addQuestion).toHaveBeenCalledWith(QUIZ_ID, {
      text: 'Wie war das Tempo?',
      type: 'SURVEY',
      difficulty: 'MEDIUM',
      answers: [
        { text: 'Zu schnell', isCorrect: false },
        { text: 'Passend', isCorrect: false },
      ],
    });
  });

  it('blendet bei Umfrage die Schwierigkeit im Formular aus', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.form.controls.type.setValue('SURVEY');
    component.onTypeChanged();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Schwierigkeit');
  });

  it('blendet bei Bewertung die Schwierigkeit im Formular aus', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.form.controls.type.setValue('RATING');
    component.onTypeChanged();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Schwierigkeit');
  });

  it('aktualisiert eine vorhandene Frage im Bearbeitungsmodus', () => {
    quiz.questions = [
      {
        id: QUESTION_ID,
        text: 'Alte Frage',
        type: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        order: 0,
        enabled: true,
        answers: [
          {
            id: '79b35123-ff7f-4ff8-b8bf-a2ca695f57d4',
            text: 'Alt A',
            isCorrect: true,
          },
          {
            id: '7f87b192-df9b-45ce-af85-9a44ef0f4b44',
            text: 'Alt B',
            isCorrect: false,
          },
        ],
        ratingMin: null,
        ratingMax: null,
        ratingLabelMin: null,
        ratingLabelMax: null,
      },
    ];

    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.editQuestion(QUESTION_ID);
    component.form.controls.text.setValue('Neue Frage');
    component.answersArray.at(0).controls.text.setValue('Neu A');
    component.answersArray.at(1).controls.text.setValue('Neu B');
    component.setSingleCorrect(1);

    component.addQuestion();

    expect(mockStore.updateQuestion).toHaveBeenCalledWith(QUIZ_ID, QUESTION_ID, {
      text: 'Neue Frage',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      answers: [
        { text: 'Neu A', isCorrect: false },
        { text: 'Neu B', isCorrect: true },
      ],
    });
    expect(component.editingQuestionId()).toBeNull();
  });

  it('blendet das Panel „Neue Frage“ aus und aktiviert den Bearbeitungsmodus', () => {
    quiz.questions = [
      {
        id: QUESTION_ID,
        text: 'Alte Frage',
        type: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        order: 0,
        enabled: true,
        answers: [
          {
            id: '79b35123-ff7f-4ff8-b8bf-a2ca695f57d4',
            text: 'Alt A',
            isCorrect: true,
          },
          {
            id: '7f87b192-df9b-45ce-af85-9a44ef0f4b44',
            text: 'Alt B',
            isCorrect: false,
          },
        ],
        ratingMin: null,
        ratingMax: null,
        ratingLabelMin: null,
        ratingLabelMax: null,
      },
    ];

    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.questionFormPanelOpen.set(true);
    expect(component.isNewQuestionFormPanelExpanded()).toBe(true);

    component.editQuestion(QUESTION_ID);

    expect(component.isEditing()).toBe(true);
    expect(component.isNewQuestionFormPanelExpanded()).toBe(false);
  });

  it('löscht eine vorhandene Frage', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.deleteQuestion(QUESTION_ID);

    expect(mockStore.deleteQuestion).toHaveBeenCalledWith(QUIZ_ID, QUESTION_ID);
  });

  it('normalisiert bei Single Choice auf genau eine korrekte Antwort', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.form.controls.text.setValue('Ungültige SC Frage');
    component.answersArray.at(0).controls.text.setValue('A');
    component.answersArray.at(1).controls.text.setValue('B');
    component.answersArray.at(0).controls.isCorrect.setValue(true);
    component.answersArray.at(1).controls.isCorrect.setValue(true);

    component.addQuestion();

    expect(mockStore.addQuestion).toHaveBeenCalledWith(QUIZ_ID, {
      text: 'Ungültige SC Frage',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    });
  });

  it('wendet ein SC-Schnellformat an und ersetzt Antwortoptionen', () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.answersArray.at(0).controls.text.setValue('Alt A');
    component.answersArray.at(1).controls.text.setValue('Alt B');

    component.applyScFormat('YES_NO_MAYBE');

    expect(confirmSpy).toHaveBeenCalled();
    expect(component.answersArray.length).toBe(3);
    expect(component.answersArray.at(0).controls.text.value).toBe('Ja');
    expect(component.answersArray.at(1).controls.text.value).toBe('Nein');
    expect(component.answersArray.at(2).controls.text.value).toBe('Vielleicht');
    confirmSpy.mockRestore();
  });

  it('speichert Sitzungs-Konfigurationen für das Quiz', () => {
    mockStore.updateQuizSettings.mockReturnValue({
      showLeaderboard: false,
      allowCustomNicknames: false,
      defaultTimer: 60,
      enableSoundEffects: false,
      enableRewardEffects: true,
      enableMotivationMessages: false,
      enableEmojiReactions: true,
      anonymousMode: true,
      teamMode: true,
      teamCount: 3,
      teamAssignment: 'MANUAL',
      teamNames: ['Rot', 'Blau', 'Gold'],
      backgroundMusic: 'CALM_LOFI',
      nicknameTheme: 'HIGH_SCHOOL',
      bonusTokenCount: 5,
      readingPhaseEnabled: true,
      preset: 'SERIOUS',
    });
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.settingsForm.patchValue({
      showLeaderboard: false,
      allowCustomNicknames: false,
      defaultTimer: 60,
      enableSoundEffects: false,
      enableRewardEffects: true,
      enableMotivationMessages: false,
      enableEmojiReactions: true,
      anonymousMode: true,
      teamMode: true,
      teamCount: 3,
      teamAssignment: 'MANUAL',
      teamNamesText: 'Rot\nBlau\nGold',
      nicknameTheme: 'HIGH_SCHOOL',
      bonusEnabled: true,
      bonusTokenCount: 5,
      readingPhaseEnabled: true,
      preset: 'SERIOUS',
    });

    component.saveSettings();

    expect(mockStore.updateQuizSettings).toHaveBeenCalledWith(
      QUIZ_ID,
      expect.objectContaining({
        showLeaderboard: false,
        allowCustomNicknames: false,
        defaultTimer: 60,
        enableSoundEffects: false,
        enableRewardEffects: true,
        teamMode: true,
        teamCount: 3,
        teamAssignment: 'MANUAL',
        teamNames: ['Rot', 'Blau', 'Gold'],
        backgroundMusic: null,
        nicknameTheme: 'HIGH_SCHOOL',
      }),
    );
    expect(component.settingsSaved()).toBe(true);
  });

  it('verhindert das Speichern von Einstellungen bei doppelten Team-Namen', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.settingsForm.patchValue({
      teamMode: true,
      teamCount: 2,
      teamNamesText: 'Rot\nRot',
    });

    component.saveSettings();

    expect(component.teamNamesTextControl.hasError('duplicateTeamNames')).toBe(true);
    expect(mockStore.updateQuizSettings).not.toHaveBeenCalled();
  });

  it('wendet Preset-Werte auf die Sitzungs-Konfiguration an', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.applySettingsPreset('SERIOUS');

    expect(component.settingsForm.controls.showLeaderboard.value).toBe(false);
    expect(component.settingsForm.controls.enableSoundEffects.value).toBe(false);
    expect(component.settingsForm.controls.anonymousMode.value).toBe(true);
    expect(component.settingsForm.controls.defaultTimer.value).toBeNull();
  });

  it('speichert Quiz-Metadaten (Name/Beschreibung)', () => {
    mockStore.updateQuizMetadata.mockReturnValue({
      ...quiz,
      name: 'Aktualisierter Name',
      description: 'Neue Beschreibung',
    });
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.metadataForm.patchValue({
      name: 'Aktualisierter Name',
      description: 'Neue Beschreibung',
      motifImageUrl: '',
    });

    component.saveMetadata();

    expect(mockStore.updateQuizMetadata).toHaveBeenCalledWith(QUIZ_ID, {
      name: 'Aktualisierter Name',
      description: 'Neue Beschreibung',
      motifImageUrl: null,
    });
    expect(component.metadataSaved()).toBe(true);
  });

  it('fokussiert bei ungültigen Metadaten das erste Fehlerfeld', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const nameInput = fixture.nativeElement.querySelector(
      '.quiz-edit__meta-card input[formcontrolname="name"]',
    ) as HTMLInputElement;
    const focusSpy = vi.spyOn(nameInput, 'focus');

    component.metadataForm.controls.name.setValue('');
    component.saveMetadata();

    expect(mockStore.updateQuizMetadata).not.toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalled();
  });

  it('fokussiert bei ungültigen Einstellungen das erste Fehlerfeld', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    component.showSettings.set(true);
    fixture.detectChanges();
    const timerInput = fixture.nativeElement.querySelector(
      '.quiz-edit__settings-card input[formcontrolname="defaultTimer"]',
    ) as HTMLInputElement;
    const focusSpy = vi.spyOn(timerInput, 'focus');

    component.settingsForm.controls.defaultTimer.setValue(1);
    component.saveSettings();

    expect(mockStore.updateQuizSettings).not.toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalled();
  });

  it('springt bei fehlender Korrektmarkierung zur ersten Auswahlhilfe', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.controls.text.setValue('Ungültige SC Frage');
    component.answersArray.at(0).controls.text.setValue('A');
    component.answersArray.at(1).controls.text.setValue('B');
    component.answersArray.at(0).controls.isCorrect.setValue(false);
    component.answersArray.at(1).controls.isCorrect.setValue(false);
    fixture.detectChanges();

    const selectorButton = fixture.nativeElement.querySelector(
      '.quiz-edit-answer__selector button',
    ) as HTMLButtonElement;
    const focusSpy = vi.spyOn(selectorButton, 'focus');

    component.addQuestion();

    expect(mockStore.addQuestion).not.toHaveBeenCalled();
    expect(component.submitError()).toBe('Wähle genau eine richtige Antwort aus.');
    expect(focusSpy).toHaveBeenCalled();
  });

  it('rendert Markdown und KaTeX in der Fragenliste', () => {
    quiz.questions = [
      {
        id: QUESTION_ID,
        text: 'Formel: $a^2+b^2=c^2$',
        type: 'SINGLE_CHOICE',
        difficulty: 'MEDIUM',
        order: 0,
        enabled: true,
        answers: [
          {
            id: '1f013086-724d-4c5f-8354-53b3dcda4f27',
            text: '**Korrekte** Antwort',
            isCorrect: true,
          },
          {
            id: 'f38fcd4b-f1ca-4188-8e22-f80244e8a3d0',
            text: 'Distraktor',
            isCorrect: false,
          },
        ],
        ratingMin: null,
        ratingMax: null,
        ratingLabelMin: null,
        ratingLabelMax: null,
      },
    ];

    const fixture = TestBed.createComponent(QuizEditComponent);
    fixture.detectChanges();

    const expandBtn = fixture.nativeElement.querySelector(
      '.quiz-edit-question__expand-btn',
    ) as HTMLButtonElement;
    expandBtn.click();
    fixture.detectChanges();

    const questionKatex = fixture.nativeElement.querySelector(
      '.quiz-edit-list .quiz-edit-question__text .katex',
    ) as HTMLElement | null;
    const answerStrong = fixture.nativeElement.querySelector(
      '.quiz-edit-list .quiz-edit-question__answer-text strong',
    ) as HTMLElement | null;

    expect(questionKatex).not.toBeNull();
    expect(answerStrong).not.toBeNull();
    expect(answerStrong?.textContent).toContain('Korrekte');
  });
});
