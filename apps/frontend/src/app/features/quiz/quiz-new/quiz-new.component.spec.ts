import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuizNewComponent } from './quiz-new.component';
import { QuizStoreService } from '../data/quiz-store.service';

describe('QuizNewComponent', () => {
  const mockStore = {
    createQuiz: vi.fn(),
  };

  const matDialogMock = {
    open: vi.fn(() => ({
      afterClosed: () => of(true),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    matDialogMock.open.mockReset();
    matDialogMock.open.mockImplementation(() => ({
      afterClosed: () => of(true),
    }));
    TestBed.configureTestingModule({
      imports: [QuizNewComponent],
      providers: [
        provideRouter([]),
        { provide: QuizStoreService, useValue: mockStore },
        { provide: MatDialog, useValue: matDialogMock },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: matDialogMock });
  });

  it('erstellt ein Quiz und navigiert zum Editor', async () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    mockStore.createQuiz.mockReturnValue({
      id: '928f0bb8-bfd8-442b-9f2e-a7544628a92f',
      name: 'Test-Quiz',
      description: null,
      createdAt: '2026-03-08T12:00:00.000Z',
      updatedAt: '2026-03-08T12:00:00.000Z',
      settings: {
        showLeaderboard: true,
        allowCustomNicknames: false,
        defaultTimer: null,
        timerScaleByDifficulty: true,
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
    });

    component.form.patchValue({ name: 'Test-Quiz', description: '' });

    await component.submit();

    expect(mockStore.createQuiz).toHaveBeenCalledWith({
      name: 'Test-Quiz',
      description: '',
      motifImageUrl: null,
      settings: expect.objectContaining({
        showLeaderboard: true,
        allowCustomNicknames: false,
        defaultTimer: 60,
        timerScaleByDifficulty: true,
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
        timerScaleByDifficulty: true,
        preset: 'PLAYFUL',
      }),
    });
    expect(navigateSpy).toHaveBeenCalledWith(['quiz', '928f0bb8-bfd8-442b-9f2e-a7544628a92f'], {
      queryParams: { from: 'new' },
    });
  });

  it('erstellt kein Quiz bei ungültigem Formular', async () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const nameInput = fixture.nativeElement.querySelector(
      'input[formcontrolname="name"]',
    ) as HTMLInputElement;
    const focusSpy = vi.spyOn(nameInput, 'focus');

    component.form.patchValue({ name: '', description: '' });
    await component.submit();

    expect(mockStore.createQuiz).not.toHaveBeenCalled();
    expect(component.form.invalid).toBe(true);
    expect(focusSpy).toHaveBeenCalled();
  });

  it('setzt mit dem Serious-Preset zentrale Optionen auf seriös', () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    const component = fixture.componentInstance;

    component.applyPreset('SERIOUS');

    expect(component.form.controls.showLeaderboard.value).toBe(false);
    expect(component.form.controls.enableSoundEffects.value).toBe(false);
    expect(component.form.controls.anonymousMode.value).toBe(false);
    expect(component.form.controls.allowCustomNicknames.value).toBe(false);
    expect(component.form.controls.nicknameTheme.value).toBe('HIGH_SCHOOL');
    expect(component.form.controls.defaultTimer.value).toBeNull();
    expect(component.form.controls.timerScaleByDifficulty.value).toBe(true);
  });

  it('setzt mit dem Playful-Preset den Standard-Timer auf 60 Sekunden', () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    const component = fixture.componentInstance;

    component.applyPreset('PLAYFUL');

    expect(component.form.controls.defaultTimer.value).toBe(60);
    expect(component.form.controls.timerScaleByDifficulty.value).toBe(true);
  });

  it('übernimmt allowCustomNicknames beim Speichern aus dem Formular (z. B. aktiviert)', async () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    const component = fixture.componentInstance;

    component.form.patchValue({
      name: 'Preset-Quiz',
      allowCustomNicknames: true,
    });

    mockStore.createQuiz.mockReturnValue({
      id: '928f0bb8-bfd8-442b-9f2e-a7544628a92f',
      name: 'Preset-Quiz',
      description: null,
      createdAt: '2026-03-08T12:00:00.000Z',
      updatedAt: '2026-03-08T12:00:00.000Z',
      settings: {
        showLeaderboard: true,
        allowCustomNicknames: true,
        defaultTimer: null,
        timerScaleByDifficulty: true,
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
    });

    await component.submit();

    expect(mockStore.createQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          preset: 'PLAYFUL',
          allowCustomNicknames: true,
        }),
      }),
    );
  });

  it('verhindert das Erstellen bei doppelten Team-Namen', async () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    const component = fixture.componentInstance;

    component.form.patchValue({
      name: 'Team-Quiz',
      teamMode: true,
      teamCount: 2,
      teamNamesText: 'Rot\nRot',
    });

    await component.submit();

    expect(component.teamNamesTextControl.hasError('duplicateTeamNames')).toBe(true);
    expect(mockStore.createQuiz).not.toHaveBeenCalled();
  });

  it('wandelt Emoji-Shortcodes in Team-Namen vor dem Speichern um', async () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    mockStore.createQuiz.mockReturnValue({
      id: '928f0bb8-bfd8-442b-9f2e-a7544628a92f',
      name: 'Emoji-Quiz',
      description: null,
      createdAt: '2026-03-08T12:00:00.000Z',
      updatedAt: '2026-03-08T12:00:00.000Z',
      settings: {
        showLeaderboard: true,
        allowCustomNicknames: false,
        defaultTimer: null,
        timerScaleByDifficulty: true,
        enableSoundEffects: true,
        enableRewardEffects: true,
        enableMotivationMessages: true,
        enableEmojiReactions: true,
        anonymousMode: false,
        teamMode: true,
        teamCount: 2,
        teamAssignment: 'AUTO',
        teamNames: ['🍎 Team', '🚀 Crew'],
        backgroundMusic: null,
        nicknameTheme: 'HIGH_SCHOOL',
        bonusTokenCount: null,
        readingPhaseEnabled: false,
        preset: 'PLAYFUL',
      },
    });

    component.form.patchValue({
      name: 'Emoji-Quiz',
      teamMode: true,
      teamCount: 2,
      teamNamesText: ':apple: Team\n:rocket: Crew',
    });

    await component.submit();

    expect(component.teamNamePreview()).toEqual(['🍎 Team', '🚀 Crew']);
    expect(mockStore.createQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          teamNames: ['🍎 Team', '🚀 Crew'],
        }),
      }),
    );
  });

  it('zeigt einen Hinweis, wenn lokale Startwerte vom Preset-Standard abweichen', () => {
    localStorage.setItem(
      'home-preset-options-spielerisch',
      JSON.stringify({
        options: { teamMode: true },
        nameMode: 'nicknameTheme',
        nicknameThemeValue: 'NOBEL_LAUREATES',
        teamCountValue: 2,
      }),
    );

    const fixture = TestBed.createComponent(QuizNewComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Startprofil');
    expect(text).toContain('Startwerte prüfen');
  });

  it('zeigt keinen Hinweis bei gespeicherten Preset-Standardwerten', () => {
    localStorage.setItem(
      'home-preset-options-spielerisch',
      JSON.stringify({
        options: {
          showLeaderboard: true,
          enableRewardEffects: true,
          enableMotivationMessages: true,
          enableEmojiReactions: true,
          bonusTokenCount: false,
          defaultTimer: true,
          readingPhaseEnabled: false,
          teamMode: false,
          teamAssignment: false,
          enableSoundEffects: true,
        },
        nameMode: 'nicknameTheme',
        nicknameThemeValue: 'HIGH_SCHOOL',
        teamCountValue: 2,
      }),
    );

    const fixture = TestBed.createComponent(QuizNewComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).not.toContain('Startwerte prüfen');
  });

  it('fixiert den primaeren Weiter-CTA im unteren Aktionsbereich', () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    fixture.detectChanges();

    const bottomAction = fixture.nativeElement.querySelector('.quiz-new-page__bottom-action');
    const submitButton = fixture.nativeElement.querySelector(
      '.quiz-new-page__bottom-action button[type="submit"][form="quiz-create-form"]',
    ) as HTMLButtonElement | null;
    const inlineSubmitButton = fixture.nativeElement.querySelector(
      '.quiz-form__actions button[type="submit"]',
    );

    expect(bottomAction).not.toBeNull();
    expect(submitButton?.textContent).toContain('Weiter zu den Fragen');
    expect(inlineSubmitButton).toBeNull();
  });
});
