import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatCard, MatCardActions, MatCardContent } from '@angular/material/card';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatOption } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import {
  DEFAULT_BONUS_TOKEN_COUNT,
  DEFAULT_TEAM_COUNT,
  DEFAULT_TIMER_SECONDS,
  MOTIF_IMAGE_URL_MAX_LENGTH,
  MotifImageUrlSchema,
  QUIZ_PRESETS,
  type NicknameTheme,
  type QuizPreset,
  type TeamAssignment,
} from '@arsnova/shared-types';
import { mergeTimerPresetOptions } from '../default-timer-presets';
import { QuizStoreService, type QuizSettings } from '../data/quiz-store.service';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { LocaleSwitchGuardService } from '../../../core/locale-switch-guard.service';
import { localizeCommands } from '../../../core/locale-router';
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
  styleUrls: ['../../../shared/styles/dialog-title-header.scss', './quiz-new.component.scss'],
})
export class QuizNewComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly quizStore = inject(QuizStoreService);
  private readonly themePreset = inject(ThemePresetService);
  private readonly localeGuard = inject(LocaleSwitchGuardService);

  readonly presetOptions: Array<{ value: QuizPreset; label: string; icon: string }> = [
    { value: 'PLAYFUL', label: $localize`Spielerisch`, icon: 'celebration' },
    { value: 'SERIOUS', label: $localize`Seriös`, icon: 'work' },
  ];

  readonly nicknameThemeOptions: Array<{ value: NicknameTheme; label: string }> = [
    { value: 'NOBEL_LAUREATES', label: $localize`Nobelpreis` },
    {
      value: 'KINDERGARTEN',
      label: $localize`:@@quiz.nicknameTheme.kindergarten:Kindergarten (Tier-Emojis)`,
    },
    { value: 'PRIMARY_SCHOOL', label: $localize`Grundschule` },
    { value: 'MIDDLE_SCHOOL', label: $localize`Mittelstufe` },
    { value: 'HIGH_SCHOOL', label: $localize`Oberstufe` },
  ];

  /** Synchron zu MotifImageUrlSchema / maxlength im Template. */
  readonly motifImageUrlMaxLength = MOTIF_IMAGE_URL_MAX_LENGTH;

  readonly isSaving = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly showSettings = signal(false);
  @ViewChild('quizCreateForm') private quizCreateForm?: ElementRef<HTMLFormElement>;

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(5000)]],
    motifImageUrl: [
      '',
      [Validators.maxLength(MOTIF_IMAGE_URL_MAX_LENGTH), motifImageUrlOptionalHttpsValidator],
    ],
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
    teamCount: this.formBuilder.control<number | null>(DEFAULT_TEAM_COUNT, {
      validators: [Validators.min(2), Validators.max(8)],
    }),
    teamAssignment: this.formBuilder.control<TeamAssignment>('AUTO'),
    teamNamesText: [''],
    nicknameTheme: this.formBuilder.control<NicknameTheme>('NOBEL_LAUREATES'),
    bonusEnabled: [false],
    bonusTokenCount: this.formBuilder.control<number | null>(DEFAULT_BONUS_TOKEN_COUNT, {
      validators: [Validators.min(1), Validators.max(50)],
    }),
  });

  readonly nameControl = this.form.controls.name;
  readonly descriptionControl = this.form.controls.description;
  readonly motifImageUrlControl = this.form.controls.motifImageUrl;
  readonly defaultTimerControl = this.form.controls.defaultTimer;
  readonly teamCountControl = this.form.controls.teamCount;
  readonly teamNamesTextControl = this.form.controls.teamNamesText;
  readonly bonusTokenCountControl = this.form.controls.bonusTokenCount;

  isBonusEnabled(): boolean {
    return this.form.controls.bonusEnabled.value;
  }

  /** Sichtbar wenn vorgegebene Pseudonym-Listen genutzt werden (nicht reiner Anonym-Modus). */
  isNicknameThemeSectionVisible(): boolean {
    return !this.form.controls.anonymousMode.value;
  }

  defaultTimerSelectOptions(): number[] {
    return mergeTimerPresetOptions(this.defaultTimerControl.value);
  }

  onDefaultTimerEnabledChange(checked: boolean): void {
    const c = this.defaultTimerControl;
    if (checked) {
      if (c.value === null) {
        c.setValue(DEFAULT_TIMER_SECONDS);
      }
    } else {
      c.setValue(null);
    }
  }

  ngOnInit(): void {
    this.syncTeamNamesValidation();
    this.localeGuard.register(() => this.form.dirty);
  }

  ngOnDestroy(): void {
    this.localeGuard.unregister();
  }

  isTeamModeEnabled(): boolean {
    return this.form.controls.teamMode.value;
  }

  teamNamePreview(): string[] {
    return buildEffectiveTeamNames(this.teamNamesTextControl.value, this.teamCountControl.value);
  }

  syncTeamNamesValidation(): void {
    applyTeamNamesValidation(
      this.teamNamesTextControl,
      this.form.controls.teamMode.value,
      this.teamCountControl.value,
    );
  }

  presetBadgeLabel(): string {
    if (this.matchesPreset('PLAYFUL')) return $localize`Spielerisch`;
    if (this.matchesPreset('SERIOUS')) return $localize`Seriös`;
    return $localize`Benutzerdefiniert`;
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
      current.readingPhaseEnabled === (target.readingPhaseEnabled ?? current.readingPhaseEnabled) &&
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
      teamNames: parseTeamNamesText(this.form.controls.teamNamesText.value),
      backgroundMusic: null,
      nicknameTheme: this.form.controls.nicknameTheme.value ?? 'NOBEL_LAUREATES',
      bonusTokenCount: this.form.controls.bonusEnabled.value
        ? (this.bonusTokenCountControl.value ?? DEFAULT_BONUS_TOKEN_COUNT)
        : null,
      readingPhaseEnabled: this.form.controls.readingPhaseEnabled.value,
      preset: this.themePreset.preset() === 'serious' ? ('SERIOUS' as const) : ('PLAYFUL' as const),
    };
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.submitError.set(null);
    this.syncTeamNamesValidation();

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
        motifImageUrl: this.motifImageUrlControl.value.trim()
          ? this.motifImageUrlControl.value.trim()
          : null,
        settings: this.readSettingsFromForm(),
      });
      await this.router.navigate(localizeCommands(['quiz', created.id]));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erstellen fehlgeschlagen.';
      this.submitError.set(message);
    } finally {
      this.isSaving.set(false);
    }
  }
}

function motifImageUrlOptionalHttpsValidator(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '').trim();
  if (!v) return null;
  if (MotifImageUrlSchema.safeParse(v).success) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return { motifHttps: true };
  } catch {
    return { motifUrl: true };
  }
  return { motifUrl: true };
}

function parseTeamNamesText(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function buildEffectiveTeamNames(value: string, teamCount: number | null | undefined): string[] {
  const customNames = parseTeamNamesText(value);
  const effectiveCount = normalizeTeamCount(teamCount);
  return Array.from(
    { length: effectiveCount },
    (_, index) => customNames[index] ?? buildDefaultTeamName(index),
  );
}

function applyTeamNamesValidation(
  control: FormControl<string>,
  teamModeEnabled: boolean,
  teamCount: number | null | undefined,
): void {
  if (!teamModeEnabled) {
    control.setErrors(null);
    return;
  }

  const names = parseTeamNamesText(control.value);
  const effectiveCount = normalizeTeamCount(teamCount);
  const normalizedNames = names.map((entry) => entry.toLocaleLowerCase());
  const errors: Record<string, true> = {};

  if (names.length > effectiveCount) {
    errors['tooManyTeamNames'] = true;
  }
  if (names.some((entry) => entry.length > 40)) {
    errors['teamNameTooLong'] = true;
  }
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    errors['duplicateTeamNames'] = true;
  }

  control.setErrors(Object.keys(errors).length > 0 ? errors : null);
}

function normalizeTeamCount(teamCount: number | null | undefined): number {
  return Math.min(8, Math.max(DEFAULT_TEAM_COUNT, teamCount ?? DEFAULT_TEAM_COUNT));
}

function buildDefaultTeamName(index: number): string {
  return `Team ${String.fromCharCode(65 + index)}`;
}
