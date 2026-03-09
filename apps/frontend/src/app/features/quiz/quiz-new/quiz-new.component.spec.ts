import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuizNewComponent } from './quiz-new.component';
import { QuizStoreService } from '../data/quiz-store.service';

describe('QuizNewComponent', () => {
  const mockStore = {
    createQuiz: vi.fn(),
    importQuiz: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [QuizNewComponent],
      providers: [
        provideRouter([]),
        { provide: QuizStoreService, useValue: mockStore },
      ],
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
        backgroundMusic: null,
        nicknameTheme: 'NOBEL_LAUREATES',
        bonusTokenCount: null,
        readingPhaseEnabled: false,
      },
    });

    component.form.patchValue({ name: 'Test-Quiz', description: '' });

    await component.submit();

    expect(mockStore.createQuiz).toHaveBeenCalledWith({
      name: 'Test-Quiz',
      description: '',
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
        backgroundMusic: null,
        nicknameTheme: 'NOBEL_LAUREATES',
        bonusTokenCount: null,
        readingPhaseEnabled: false,
      },
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/quiz', '928f0bb8-bfd8-442b-9f2e-a7544628a92f']);
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

  it('importiert KI-JSON und navigiert direkt zum importierten Quiz', async () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    mockStore.importQuiz.mockReturnValue({
      id: 'caece014-f7cd-4d26-a101-bd494379f95f',
      name: 'KI Import',
    });

    component.updateAiJsonInput('{"quiz":{"name":"KI Import"}}');
    await component.importAiJson();

    expect(mockStore.importQuiz).toHaveBeenCalledWith({ quiz: { name: 'KI Import' } });
    expect(navigateSpy).toHaveBeenCalledWith(['/quiz', 'caece014-f7cd-4d26-a101-bd494379f95f']);
    expect(component.aiImportError()).toBeNull();
  });

  it('zeigt bei leerer KI-Eingabe eine verständliche Meldung', async () => {
    const fixture = TestBed.createComponent(QuizNewComponent);
    const component = fixture.componentInstance;

    component.updateAiJsonInput('   ');
    await component.importAiJson();

    expect(component.aiImportError()).toBe('Füge zuerst das KI-JSON ein.');
    expect(mockStore.importQuiz).not.toHaveBeenCalled();
  });
});
