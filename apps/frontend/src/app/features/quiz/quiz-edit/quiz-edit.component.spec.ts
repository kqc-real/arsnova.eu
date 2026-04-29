import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizEditComponent } from './quiz-edit.component';
import { QuizStoreService, type QuizDocument } from '../data/quiz-store.service';

const QUIZ_ID = '78cc92d6-a4a5-4e38-8fd5-4bf558412be6';
const QUESTION_ID = '2e7095a8-a780-470b-a068-78d57cab6187';
const SECOND_QUESTION_ID = 'b19e3558-e995-4598-b891-bf33fe752e43';

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
      nicknameTheme: 'HIGH_SCHOOL',
      bonusTokenCount: null,
      readingPhaseEnabled: false,
      preset: 'PLAYFUL',
    },
    questions: [],
  };

  const matDialogMock = {
    open: vi.fn(() => ({
      afterClosed: () => of(true),
    })),
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
    matDialogMock.open.mockReset();
    matDialogMock.open.mockImplementation(() => ({
      afterClosed: () => of(true),
    }));
    TestBed.configureTestingModule({
      imports: [QuizEditComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: QUIZ_ID }),
              queryParamMap: convertToParamMap({}),
              firstChild: null,
            },
          },
        },
        { provide: QuizStoreService, useValue: mockStore },
        { provide: MatDialog, useValue: matDialogMock },
      ],
    });
    // QuizEdit importiert indirekt Material-Dialog-Provider (über MarkdownKatexEditorComponent).
    // Wir overriden explizit, damit Tests keine echten Overlay-Provider benötigen.
    TestBed.overrideProvider(MatDialog, { useValue: matDialogMock });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hält das Panel „Neue Frage“ bei leerem Quiz zunächst geschlossen', () => {
    quiz.questions = [];
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    expect(component.questionFormPanelOpen()).toBe(false);
    expect(component.isNewQuestionFormPanelExpanded()).toBe(false);
  });

  it('klappt die Metadaten-Karte nach Neuanlage (from=new) zu und entfernt den Query-Parameter', async () => {
    quiz.questions = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [QuizEditComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: QUIZ_ID }),
              queryParamMap: convertToParamMap({ from: 'new' }),
              firstChild: null,
            },
          },
        },
        { provide: QuizStoreService, useValue: mockStore },
        { provide: MatDialog, useValue: matDialogMock },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: matDialogMock });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(QuizEditComponent);
    expect(fixture.componentInstance.metadataPanelExpanded()).toBe(false);
    await Promise.resolve();
    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { from: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  it('hält Einstellungsänderungen lokal, bis global gespeichert wird', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    mockStore.updateQuizSettings.mockClear();

    component.settingsForm.controls.nicknameTheme.setValue('KINDERGARTEN');
    component.settingsForm.markAsDirty();
    expect(mockStore.updateQuizSettings).not.toHaveBeenCalled();

    mockStore.updateQuizSettings.mockReturnValue({
      ...quiz.settings,
      nicknameTheme: 'KINDERGARTEN',
    });

    component.saveAll();

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
      timer: null,
      skipReadingPhase: false,
      answers: [
        { text: 'Antwort A', isCorrect: false },
        { text: 'Antwort B', isCorrect: true },
      ],
    });
    expect(mockStore.updateQuestion).not.toHaveBeenCalled();
  });

  it('rendert lokale Bild-URLs in der Gesamtvorschau des Editors und markiert sie als Markdown-Flow', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.questionFormPanelOpen.set(true);
    component.form.controls.text.setValue(
      '![Demo](http://localhost:4200/assets/demo/9_konzeptfragen_panorama.svg)',
    );
    fixture.detectChanges();
    vi.advanceTimersByTime(250);
    fixture.detectChanges();

    const preview = (fixture.nativeElement as HTMLElement).querySelector(
      '.quiz-edit-form__preview-content',
    ) as HTMLElement | null;
    expect(preview?.classList.contains('markdown-body')).toBe(true);
    expect(preview?.innerHTML).toContain(
      'src="http://localhost:4200/assets/demo/9_konzeptfragen_panorama.svg"',
    );
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
      timer: null,
      skipReadingPhase: false,
      answers: [],
    });
  });

  it('speichert den Lesephasen-Override pro Frage', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.form.controls.text.setValue('Direkt loslegen?');
    component.form.controls.questionSkipReadingPhase.setValue(true);
    component.answersArray.at(0).controls.text.setValue('Ja');
    component.answersArray.at(1).controls.text.setValue('Nein');
    component.setSingleCorrect(0);

    component.addQuestion();

    expect(mockStore.addQuestion).toHaveBeenCalledWith(
      QUIZ_ID,
      expect.objectContaining({
        text: 'Direkt loslegen?',
        skipReadingPhase: true,
      }),
    );
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
      timer: null,
      skipReadingPhase: false,
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
        timer: null,
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
      timer: null,
      skipReadingPhase: false,
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
        timer: null,
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

  it('aktiviert den globalen Save-CTA nicht allein durch das Oeffnen des Bearbeitungsmodus', () => {
    quiz.questions = [
      {
        id: QUESTION_ID,
        text: 'Alte Frage',
        type: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        order: 0,
        enabled: true,
        timer: null,
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

    component.editQuestion(QUESTION_ID);
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '.quiz-edit__bottom-actions-save',
    ) as HTMLButtonElement | null;

    expect(component.isEditing()).toBe(true);
    expect(component.hasPendingChanges()).toBe(false);
    expect(saveButton?.disabled).toBe(true);
  });

  it('rendert Markdown und KaTeX in der Fragenkarten-Zusammenfassung', () => {
    quiz.questions = [
      {
        id: QUESTION_ID,
        text: '**Warm-up:** Was ist $2+2$?',
        type: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        order: 0,
        enabled: true,
        timer: null,
        answers: [
          {
            id: '79b35123-ff7f-4ff8-b8bf-a2ca695f57d4',
            text: '4',
            isCorrect: true,
          },
          {
            id: '7f87b192-df9b-45ce-af85-9a44ef0f4b44',
            text: '5',
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

    const summary = (fixture.nativeElement as HTMLElement).querySelector(
      '.quiz-edit-question__summary',
    );
    expect(summary).toBeTruthy();
    expect(summary!.innerHTML).toContain('<strong>Warm-up:</strong>');
    expect(summary!.innerHTML).toContain('katex');
  });

  it('löscht eine vorhandene Frage nach Bestätigung im Dialog', async () => {
    quiz.questions = [
      {
        id: QUESTION_ID,
        text: 'Test',
        type: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        order: 0,
        enabled: true,
        timer: null,
        answers: [],
        ratingMin: null,
        ratingMax: null,
        ratingLabelMin: null,
        ratingLabelMax: null,
      },
    ];

    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.deleteQuestion(QUESTION_ID);

    expect(matDialogMock.open).toHaveBeenCalled();
    await fixture.whenStable();
    expect(mockStore.deleteQuestion).toHaveBeenCalledWith(QUIZ_ID, QUESTION_ID);
  });

  it('löscht keine Frage, wenn der Dialog abgebrochen wird', async () => {
    matDialogMock.open.mockImplementationOnce(() => ({
      afterClosed: () => of(false),
    }));

    quiz.questions = [
      {
        id: QUESTION_ID,
        text: 'Test',
        type: 'SINGLE_CHOICE',
        difficulty: 'EASY',
        order: 0,
        enabled: true,
        timer: null,
        answers: [],
        ratingMin: null,
        ratingMax: null,
        ratingLabelMin: null,
        ratingLabelMax: null,
      },
    ];

    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    mockStore.deleteQuestion.mockClear();

    component.deleteQuestion(QUESTION_ID);

    await fixture.whenStable();
    expect(mockStore.deleteQuestion).not.toHaveBeenCalled();
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
      timer: null,
      skipReadingPhase: false,
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

  it('wandelt Emoji-Shortcodes in Team-Namen beim Speichern um', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    mockStore.updateQuizSettings.mockReturnValue({
      ...quiz,
      settings: {
        ...quiz.settings,
        teamMode: true,
        teamCount: 2,
        teamAssignment: 'AUTO',
        teamNames: ['🍎 Team', '🚀 Crew'],
      },
    });

    component.settingsForm.patchValue({
      teamMode: true,
      teamCount: 2,
      teamAssignment: 'AUTO',
      teamNamesText: ':apple: Team\n:rocket: Crew',
    });

    component.saveSettings();

    expect(component.teamNamePreview()).toEqual(['🍎 Team', '🚀 Crew']);
    expect(mockStore.updateQuizSettings).toHaveBeenCalledWith(
      QUIZ_ID,
      expect.objectContaining({
        teamNames: ['🍎 Team', '🚀 Crew'],
      }),
    );
  });

  it('wendet Preset-Werte auf die Sitzungs-Konfiguration an', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.applySettingsPreset('SERIOUS');

    expect(component.settingsForm.controls.showLeaderboard.value).toBe(false);
    expect(component.settingsForm.controls.enableSoundEffects.value).toBe(false);
    expect(component.settingsForm.controls.anonymousMode.value).toBe(false);
    expect(component.settingsForm.controls.nicknameTheme.value).toBe('HIGH_SCHOOL');
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
    component.settingsForm.controls.defaultTimer.setValue(1);
    fixture.detectChanges();
    const timerSelect = fixture.nativeElement.querySelector(
      '.quiz-edit__settings-card [formcontrolname="defaultTimer"]',
    ) as HTMLElement;
    const focusSpy = vi.spyOn(timerSelect, 'focus');

    component.saveSettings();

    expect(mockStore.updateQuizSettings).not.toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalled();
  });

  it('speichert Metadaten, Einstellungen und Fragen gesammelt mit saveAll', () => {
    mockStore.updateQuizMetadata.mockReturnValue({
      ...quiz,
      name: 'Aktualisiertes Quiz',
      description: 'Neue Beschreibung',
      motifImageUrl: null,
    });
    mockStore.updateQuizSettings.mockReturnValue({
      ...quiz.settings,
      showLeaderboard: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;

    component.metadataForm.patchValue({
      name: 'Aktualisiertes Quiz',
      description: 'Neue Beschreibung',
      motifImageUrl: '',
    });
    component.metadataForm.markAsDirty();
    component.settingsForm.patchValue({
      showLeaderboard: false,
      nicknameTheme: 'KINDERGARTEN',
    });
    component.settingsForm.markAsDirty();
    component.form.controls.text.setValue('Was ist neu?');
    component.answersArray.at(0).controls.text.setValue('Antwort A');
    component.answersArray.at(1).controls.text.setValue('Antwort B');
    component.setSingleCorrect(0);

    component.saveAll();

    expect(mockStore.updateQuizMetadata).toHaveBeenCalledWith(QUIZ_ID, {
      name: 'Aktualisiertes Quiz',
      description: 'Neue Beschreibung',
      motifImageUrl: null,
    });
    expect(mockStore.updateQuizSettings).toHaveBeenCalledWith(
      QUIZ_ID,
      expect.objectContaining({
        showLeaderboard: false,
        nicknameTheme: 'KINDERGARTEN',
      }),
    );
    expect(mockStore.addQuestion).toHaveBeenCalledWith(
      QUIZ_ID,
      expect.objectContaining({
        text: 'Was ist neu?',
      }),
    );
  });

  it('behält Frageänderungen beim Wechsel lokal und speichert sie gesammelt mit saveAll', () => {
    quiz.questions = [
      {
        id: QUESTION_ID,
        text: 'Erste Frage',
        type: 'SINGLE_CHOICE',
        difficulty: 'MEDIUM',
        order: 0,
        enabled: true,
        timer: null,
        skipReadingPhase: false,
        answers: [
          { id: 'a1', text: 'A1', isCorrect: true },
          { id: 'a2', text: 'A2', isCorrect: false },
        ],
        ratingMin: null,
        ratingMax: null,
        ratingLabelMin: null,
        ratingLabelMax: null,
      },
      {
        id: SECOND_QUESTION_ID,
        text: 'Zweite Frage',
        type: 'SINGLE_CHOICE',
        difficulty: 'MEDIUM',
        order: 1,
        enabled: true,
        timer: null,
        skipReadingPhase: false,
        answers: [
          { id: 'b1', text: 'B1', isCorrect: true },
          { id: 'b2', text: 'B2', isCorrect: false },
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

    component.editQuestion(QUESTION_ID);
    component.form.controls.text.setValue('Erste Frage lokal geändert');
    component.answersArray.at(0).controls.text.setValue('A1 neu');

    component.editQuestion(SECOND_QUESTION_ID);

    expect(mockStore.updateQuestion).not.toHaveBeenCalled();
    expect(component.questions()[0]?.text).toBe('Erste Frage lokal geändert');

    component.editQuestion(QUESTION_ID);

    expect(component.form.controls.text.value).toBe('Erste Frage lokal geändert');
    expect(component.answersArray.at(0).controls.text.value).toBe('A1 neu');

    component.saveAll();

    expect(mockStore.updateQuestion).toHaveBeenCalledWith(
      QUIZ_ID,
      QUESTION_ID,
      expect.objectContaining({
        text: 'Erste Frage lokal geändert',
        answers: [
          { text: 'A1 neu', isCorrect: true },
          { text: 'A2', isCorrect: false },
        ],
      }),
    );
  });

  it('fixiert nur noch einen globalen Save-CTA im unteren Aktionsbereich', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    fixture.detectChanges();

    const bottomAction = fixture.nativeElement.querySelector('.quiz-edit__bottom-actions');
    const backLink = bottomAction?.querySelector('a[routerLink=".."]') as HTMLAnchorElement | null;
    const previewLink = bottomAction?.querySelector(
      'a[routerLink="preview"]',
    ) as HTMLAnchorElement | null;
    const saveButton = bottomAction?.querySelector(
      '.quiz-edit__bottom-actions-save',
    ) as HTMLButtonElement | null;
    const cancelButton = bottomAction?.querySelector(
      'button[mat-button], button:not([matButton])',
    ) as HTMLButtonElement | null;
    const metadataSubmit = fixture.nativeElement.querySelector(
      '.quiz-edit__meta-card button[type="submit"]',
    );
    const settingsSubmit = fixture.nativeElement.querySelector(
      '.quiz-edit__settings-card button[type="submit"]',
    );
    const backLinks = fixture.nativeElement.querySelectorAll('a[routerLink=".."]');
    const previewLinks = fixture.nativeElement.querySelectorAll('a[routerLink="preview"]');

    expect(bottomAction).not.toBeNull();
    expect(backLink?.textContent).toContain('Zurück');
    expect(previewLink?.textContent).toContain('Vorschau');
    expect(cancelButton?.textContent).toContain('Verwerfen');
    expect(saveButton?.textContent).toContain('Speichern');
    expect(cancelButton?.getAttribute('aria-label')).toBe('Verwerfen');
    expect(saveButton?.getAttribute('aria-label')).toBe('Speichern');
    expect(backLinks).toHaveLength(1);
    expect(previewLinks).toHaveLength(2);
    expect(metadataSubmit).toBeNull();
    expect(settingsSubmit).toBeNull();
  });

  it('verwirft mit Abbrechen alle lokalen Aenderungen', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.metadataForm.patchValue({ name: 'Entwurfstitel', description: 'Entwurf' });
    component.metadataForm.markAsDirty();
    component.settingsForm.patchValue({ showLeaderboard: false, nicknameTheme: 'KINDERGARTEN' });
    component.settingsForm.markAsDirty();
    component.form.controls.text.setValue('Temporäre Frage');
    component.answersArray.at(0).controls.text.setValue('A');
    component.answersArray.at(1).controls.text.setValue('B');
    component.submitError.set('Fehler');
    component.metadataSubmitError.set('Meta-Fehler');
    component.settingsSubmitError.set('Settings-Fehler');

    component.cancelAllChanges();

    expect(component.metadataForm.controls.name.value).toBe('Test-Quiz');
    expect(component.metadataForm.controls.description.value).toBe('Beschreibung');
    expect(component.settingsForm.controls.showLeaderboard.value).toBe(true);
    expect(component.settingsForm.controls.nicknameTheme.value).toBe('HIGH_SCHOOL');
    expect(component.form.controls.text.value).toBe('');
    expect(component.metadataForm.dirty).toBe(false);
    expect(component.settingsForm.dirty).toBe(false);
    expect(component.hasPendingChanges()).toBe(false);
    expect(component.submitError()).toBeNull();
    expect(component.metadataSubmitError()).toBeNull();
    expect(component.settingsSubmitError()).toBeNull();
  });

  it('aktiviert den globalen Save-CTA bei Aenderungen an der Beschreibung', () => {
    const fixture = TestBed.createComponent(QuizEditComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.onMetadataDescriptionChange('Neue Beschreibung aus dem Editor');
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '.quiz-edit__bottom-actions-save',
    ) as HTMLButtonElement | null;

    expect(component.hasPendingChanges()).toBe(true);
    expect(component.metadataForm.controls.description.dirty).toBe(true);
    expect(saveButton?.disabled).toBe(false);
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
        timer: null,
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
