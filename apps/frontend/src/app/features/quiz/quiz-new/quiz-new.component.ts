import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatCard,
  MatCardActions,
  MatCardContent,
  MatCardHeader,
  MatCardTitle,
} from '@angular/material/card';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatOption } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import {
  QUIZ_PRESETS,
  type NicknameTheme,
  type QuizPreset,
  type TeamAssignment,
} from '@arsnova/shared-types';
import { QuizStoreService, type QuizSettings } from '../data/quiz-store.service';
import { buildKiQuizSystemPrompt } from '../../../shared/ki-quiz-prompt';
import { focusFirstInvalidField } from '../../../shared/focus-invalid-field.util';

/**
 * Neues Quiz anlegen (Epic 1).
 * Story 1.1 (Quiz erstellen).
 */
@Component({
  selector: 'app-quiz-new',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButton,
    MatCheckbox,
    MatCard,
    MatCardActions,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    MatError,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
  ],
  templateUrl: './quiz-new.component.html',
  styleUrl: './quiz-new.component.scss',
})
export class QuizNewComponent {
  private readonly document = inject(DOCUMENT);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly quizStore = inject(QuizStoreService);

  readonly presetOptions: Array<{ value: QuizPreset; label: string }> = [
    { value: 'PLAYFUL', label: 'Spielerisch' },
    { value: 'SERIOUS', label: 'Seriös' },
  ];

  readonly nicknameThemeOptions: Array<{ value: NicknameTheme; label: string }> = [
    { value: 'NOBEL_LAUREATES', label: 'Nobelpreisträger:innen' },
    { value: 'KINDERGARTEN', label: 'Kita' },
    { value: 'PRIMARY_SCHOOL', label: 'Grundschule' },
    { value: 'MIDDLE_SCHOOL', label: 'Mittelstufe' },
    { value: 'HIGH_SCHOOL', label: 'Oberstufe' },
  ];

  readonly backgroundMusicOptions: Array<{ value: string; label: string }> = [
    { value: '', label: 'Keine Musik' },
    { value: 'CALM_LOFI', label: 'Calm LoFi' },
    { value: 'UPBEAT_POP', label: 'Upbeat Pop' },
    { value: 'FOCUS_AMBIENT', label: 'Focus Ambient' },
  ];

  readonly isSaving = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly promptStatus = signal<string | null>(null);
  readonly showSettings = signal(false);
  readonly showAiImport = signal(false);
  readonly aiJsonInput = signal('');
  readonly aiImportStatus = signal<string | null>(null);
  readonly aiImportError = signal<string | null>(null);
  @ViewChild('quizCreateForm') private quizCreateForm?: ElementRef<HTMLFormElement>;

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(1000)]],
    showLeaderboard: [true],
    allowCustomNicknames: [true],
    defaultTimer: this.formBuilder.control<number | null>(null, {
      validators: [Validators.min(5), Validators.max(300)],
    }),
    enableSoundEffects: [true],
    enableRewardEffects: [true],
    enableMotivationMessages: [true],
    enableEmojiReactions: [true],
    anonymousMode: [false],
    readingPhaseEnabled: [false],
    teamMode: [false],
    teamCount: this.formBuilder.control<number | null>(null, {
      validators: [Validators.min(2), Validators.max(8)],
    }),
    teamAssignment: this.formBuilder.control<TeamAssignment>('AUTO'),
    backgroundMusic: [''],
    nicknameTheme: this.formBuilder.control<NicknameTheme>('NOBEL_LAUREATES'),
    bonusTokenCount: this.formBuilder.control<number | null>(null, {
      validators: [Validators.min(1), Validators.max(50)],
    }),
  });

  readonly nameControl = this.form.controls.name;
  readonly descriptionControl = this.form.controls.description;
  readonly defaultTimerControl = this.form.controls.defaultTimer;
  readonly teamCountControl = this.form.controls.teamCount;
  readonly bonusTokenCountControl = this.form.controls.bonusTokenCount;

  isTeamModeEnabled(): boolean {
    return this.form.controls.teamMode.value;
  }

  presetBadgeLabel(): string {
    if (this.matchesPreset('PLAYFUL')) return 'Spielerisch';
    if (this.matchesPreset('SERIOUS')) return 'Seriös';
    return 'Benutzerdefiniert';
  }

  applyPreset(preset: QuizPreset): void {
    const values = QUIZ_PRESETS[preset];
    this.form.patchValue({
      showLeaderboard: values.showLeaderboard ?? true,
      enableSoundEffects: values.enableSoundEffects ?? true,
      enableRewardEffects: values.enableRewardEffects ?? true,
      enableMotivationMessages: values.enableMotivationMessages ?? true,
      enableEmojiReactions: values.enableEmojiReactions ?? true,
      anonymousMode: values.anonymousMode ?? false,
      readingPhaseEnabled: values.readingPhaseEnabled ?? false,
      defaultTimer: values.defaultTimer ?? null,
    });
  }

  async copyKiPrompt(): Promise<void> {
    this.promptStatus.set(null);
    const settings = this.readSettingsFromForm();
    const prompt = buildKiQuizSystemPrompt({
      presetLabel: this.presetBadgeLabel(),
      nicknameTheme: settings.nicknameTheme,
      readingPhaseEnabled: settings.readingPhaseEnabled,
      defaultDifficulty: 'MEDIUM',
    });

    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (!clipboard) {
        throw new Error('Clipboard API nicht verfügbar.');
      }
      await clipboard.writeText(prompt);
      this.promptStatus.set('KI-Prompt kopiert.');
    } catch {
      this.promptStatus.set('Kopieren nicht möglich. Prüfe die Browser-Berechtigung.');
    }
  }

  toggleAiImport(): void {
    this.showAiImport.update((visible) => !visible);
    this.aiImportError.set(null);
    this.aiImportStatus.set(null);
  }

  updateAiJsonInput(value: string): void {
    this.aiJsonInput.set(value);
  }

  async onAiImportFileSelected(event: Event): Promise<void> {
    this.aiImportError.set(null);
    this.aiImportStatus.set(null);
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      await this.importAiPayload(raw);
    } finally {
      target.value = '';
    }
  }

  async importAiJson(): Promise<void> {
    const raw = this.aiJsonInput().trim();
    if (!raw) {
      this.aiImportError.set('Füge zuerst das KI-JSON ein.');
      return;
    }
    await this.importAiPayload(raw);
  }

  private matchesPreset(preset: QuizPreset): boolean {
    const target = QUIZ_PRESETS[preset];
    const current = this.readSettingsFromForm();
    return (
      current.showLeaderboard === (target.showLeaderboard ?? current.showLeaderboard) &&
      current.enableSoundEffects === (target.enableSoundEffects ?? current.enableSoundEffects) &&
      current.enableRewardEffects === (target.enableRewardEffects ?? current.enableRewardEffects) &&
      current.enableMotivationMessages ===
        (target.enableMotivationMessages ?? current.enableMotivationMessages) &&
      current.enableEmojiReactions ===
        (target.enableEmojiReactions ?? current.enableEmojiReactions) &&
      current.anonymousMode === (target.anonymousMode ?? current.anonymousMode) &&
      current.readingPhaseEnabled ===
        (target.readingPhaseEnabled ?? current.readingPhaseEnabled) &&
      current.defaultTimer === (target.defaultTimer ?? current.defaultTimer)
    );
  }

  private readSettingsFromForm(): QuizSettings {
    return {
      showLeaderboard: this.form.controls.showLeaderboard.value,
      allowCustomNicknames: this.form.controls.allowCustomNicknames.value,
      defaultTimer: this.defaultTimerControl.value,
      enableSoundEffects: this.form.controls.enableSoundEffects.value,
      enableRewardEffects: this.form.controls.enableRewardEffects.value,
      enableMotivationMessages: this.form.controls.enableMotivationMessages.value,
      enableEmojiReactions: this.form.controls.enableEmojiReactions.value,
      anonymousMode: this.form.controls.anonymousMode.value,
      teamMode: this.form.controls.teamMode.value,
      teamCount: this.form.controls.teamMode.value ? this.teamCountControl.value : null,
      teamAssignment: this.form.controls.teamAssignment.value ?? 'AUTO',
      backgroundMusic: this.form.controls.backgroundMusic.value || null,
      nicknameTheme: this.form.controls.nicknameTheme.value ?? 'NOBEL_LAUREATES',
      bonusTokenCount: this.bonusTokenCountControl.value,
      readingPhaseEnabled: this.form.controls.readingPhaseEnabled.value,
    };
  }

  private async importAiPayload(raw: string): Promise<void> {
    this.aiImportError.set(null);
    this.aiImportStatus.set(null);

    try {
      const payload = JSON.parse(raw) as unknown;
      const imported = this.quizStore.importQuiz(payload);
      this.aiImportStatus.set(`KI-Quiz „${imported.name}“ importiert.`);
      this.aiJsonInput.set('');
      this.showAiImport.set(false);
      await this.router.navigate(['/quiz', imported.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'KI-Import fehlgeschlagen.';
      this.aiImportError.set(message);
    }
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.submitError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidField(this.quizCreateForm?.nativeElement, this.form);
      return;
    }

    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    try {
      const created = this.quizStore.createQuiz({
        name: this.nameControl.value,
        description: this.descriptionControl.value,
        settings: this.readSettingsFromForm(),
      });
      await this.router.navigate(['/quiz', created.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erstellen fehlgeschlagen.';
      this.submitError.set(message);
    } finally {
      this.isSaving.set(false);
    }
  }
}
