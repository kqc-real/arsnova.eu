import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuizNewComponent } from './quiz-new.component';
import { QuizStoreService } from '../data/quiz-store.service';

describe('QuizNewComponent', () => {
  const mockStore = {
    createQuiz: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [QuizNewComponent],
      providers: [provideRouter([]), { provide: QuizStoreService, useValue: mockStore }],
    });
  });

  it('erstellt ein Quiz und navigiert zum Editor', async () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    const component = fixture.componentInstance;
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
    });

    component.form.patchValue({ name: 'Test-Quiz', description: '' });

    await component.submit();

    expect(mockStore.createQuiz).toHaveBeenCalledWith({
      name: 'Test-Quiz',
      description: '',
      motifImageUrl: null,
      settings: expect.objectContaining({
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
    expect(component.form.controls.anonymousMode.value).toBe(true);
    expect(component.form.controls.defaultTimer.value).toBeNull();
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
});
