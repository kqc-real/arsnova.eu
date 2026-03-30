import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LocaleSwitchGuardService } from '../../../core/locale-switch-guard.service';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { debounceTime, firstValueFrom, merge } from 'rxjs';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatCard, MatCardActions, MatCardContent } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import {
  DEFAULT_BONUS_TOKEN_COUNT,
  DEFAULT_TEAM_COUNT,
  DEFAULT_TIMER_SECONDS,
  MOTIF_IMAGE_URL_MAX_LENGTH,
  MotifImageUrlSchema,
  QUIZ_PRESETS,
  SC_FORMAT_PRESETS,
  type Difficulty,
  type NicknameTheme,
  type QuizPreset,
  type ScFormat,
  type TeamAssignment,
} from '@arsnova/shared-types';
import { mergeTimerPresetOptions } from '../default-timer-presets';
import {
  DEMO_QUIZ_ID,
  QuizStoreService,
  type AddQuizQuestionInput,
  type QuizSettings,
  type SupportedQuestionType,
} from '../data/quiz-store.service';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import {
  focusAndScrollElement,
  focusFirstInvalidField,
} from '../../../shared/focus-invalid-field.util';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../../../shared/confirm-leave-dialog/confirm-leave-dialog.component';

type AnswerFormGroup = FormGroup<{
  text: FormControl<string>;
  isCorrect: FormControl<boolean>;
}>;

type QuestionFormGroup = FormGroup<{
  text: FormControl<string>;
  type: FormControl<SupportedQuestionType>;
  difficulty: FormControl<Difficulty>;
  answers: FormArray<AnswerFormGroup>;
  ratingMin: FormControl<number | null>;
  ratingMax: FormControl<number | null>;
  ratingLabelMin: FormControl<string>;
  ratingLabelMax: FormControl<string>;
}>;

type QuizSettingsFormGroup = FormGroup<{
  showLeaderboard: FormControl<boolean>;
  allowCustomNicknames: FormControl<boolean>;
  defaultTimer: FormControl<number | null>;
  enableSoundEffects: FormControl<boolean>;
  enableRewardEffects: FormControl<boolean>;
  enableMotivationMessages: FormControl<boolean>;
  enableEmojiReactions: FormControl<boolean>;
  anonymousMode: FormControl<boolean>;
  readingPhaseEnabled: FormControl<boolean>;
  teamMode: FormControl<boolean>;
  teamCount: FormControl<number | null>;
  teamAssignment: FormControl<TeamAssignment>;
  teamNamesText: FormControl<string>;
  nicknameTheme: FormControl<NicknameTheme>;
  bonusEnabled: FormControl<boolean>;
  bonusTokenCount: FormControl<number | null>;
  preset: FormControl<QuizPreset>;
}>;

type QuizMetadataFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string>;
  motifImageUrl: FormControl<string>;
}>;

/**
 * Quiz bearbeiten (Epic 1). Child: preview → /quiz/:id/preview.
 * Story 1.2a–1.2c, 1.3, 1.4, 1.7, 1.10, 1.11, 1.12, 1.6a.
 */
@Component({
  selector: 'app-quiz-edit',
  standalone: true,
  imports: [
    RouterLink,
    RouterOutlet,
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatButton,
    MatIconButton,
    MatCard,
    MatCardActions,
    MatCardContent,
    MatCheckbox,
    MatExpansionModule,
    MatError,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
  ],
  templateUrl: './quiz-edit.component.html',
  styleUrls: ['../../../shared/styles/dialog-title-header.scss', './quiz-edit.component.scss'],
})
export class QuizEditComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly quizStore = inject(QuizStoreService);
  private readonly localeGuard = inject(LocaleSwitchGuardService);
  private readonly dialog = inject(MatDialog);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  /** Synchron zu MotifImageUrlSchema / maxlength im Metadaten-Formular. */
  readonly motifImageUrlMaxLength = MOTIF_IMAGE_URL_MAX_LENGTH;
  readonly submitError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly editingQuestionId = signal<string | null>(null);
  readonly expandedQuestionIds = signal<Set<string>>(new Set());
  readonly showSettings = signal(false);
  readonly settingsSubmitError = signal<string | null>(null);
  readonly settingsSaved = signal(false);
  readonly metadataSubmitError = signal<string | null>(null);
  readonly metadataSaved = signal(false);
  readonly questionPreviewHtml = signal<SafeHtml | null>(null);
  readonly answerPreviewHtml = signal<SafeHtml[]>([]);
  readonly previewKatexError = signal<string | null>(null);
  readonly questionAddedFeedback = signal(false);
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  @ViewChild('metadataFormElement') private metadataFormElement?: ElementRef<HTMLFormElement>;
  @ViewChild('settingsFormElement') private settingsFormElement?: ElementRef<HTMLFormElement>;
  @ViewChild('questionFormElement') private questionFormElement?: ElementRef<HTMLFormElement>;

  readonly questionTypeOptions: Array<{ value: SupportedQuestionType; label: string }> = [
    { value: 'SINGLE_CHOICE', label: $localize`Single Choice` },
    { value: 'MULTIPLE_CHOICE', label: $localize`Multiple Choice` },
    { value: 'FREETEXT', label: $localize`Freitext` },
    { value: 'SURVEY', label: $localize`Umfrage` },
    { value: 'RATING', label: $localize`Bewertung (1–5 / 1–10)` },
  ];

  readonly presetOptions: Array<{ value: QuizPreset; label: string; icon: string }> = [
    { value: 'PLAYFUL', label: $localize`Spielerisch`, icon: 'celebration' },
    { value: 'SERIOUS', label: $localize`Seriös`, icon: 'work' },
  ];

  readonly scFormatOptions: Array<{ value: ScFormat; label: string }> = Object.entries(
    SC_FORMAT_PRESETS,
  ).map(([value, preset]) => ({
    value: value as ScFormat,
    label: preset.label,
  }));

  readonly difficultyOptions: Array<{ value: Difficulty; label: string }> = [
    { value: 'EASY', label: $localize`:@@quiz.difficulty.easy:Leicht` },
    { value: 'MEDIUM', label: $localize`:@@quiz.difficulty.medium:Mittel` },
    { value: 'HARD', label: $localize`:@@quiz.difficulty.hard:Schwer` },
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

  readonly quiz = computed(() => this.quizStore.getQuizById(this.id));
  readonly questions = computed(() => {
    const quiz = this.quiz();
    if (!quiz) return [];
    return [...quiz.questions].sort((a, b) => a.order - b.order);
  });
  readonly isEditing = computed(() => this.editingQuestionId() !== null);
  /** Panel „Neue Frage“ (oben); beim Inline-Bearbeiten ausgeblendet. */
  readonly questionFormPanelOpen = signal(false);
  readonly isNewQuestionFormPanelExpanded = computed(
    () => !this.isEditing() && this.questionFormPanelOpen(),
  );

  readonly form: QuestionFormGroup = this.formBuilder.group({
    text: this.formBuilder.control('', {
      validators: [Validators.required, Validators.maxLength(2000)],
    }),
    type: this.formBuilder.control<SupportedQuestionType>('SINGLE_CHOICE'),
    difficulty: this.formBuilder.control<Difficulty>('MEDIUM'),
    answers: this.createAnswerArrayForType('SINGLE_CHOICE'),
    ratingMin: this.formBuilder.control<number | null>(1),
    ratingMax: this.formBuilder.control<number | null>(5),
    ratingLabelMin: this.formBuilder.control(''),
    ratingLabelMax: this.formBuilder.control(''),
  });

  readonly settingsForm: QuizSettingsFormGroup = this.formBuilder.group({
    showLeaderboard: this.formBuilder.control(true),
    allowCustomNicknames: this.formBuilder.control(true),
    defaultTimer: this.formBuilder.control<number | null>(null, {
      validators: [Validators.min(5), Validators.max(300)],
    }),
    enableSoundEffects: this.formBuilder.control(true),
    enableRewardEffects: this.formBuilder.control(true),
    enableMotivationMessages: this.formBuilder.control(true),
    enableEmojiReactions: this.formBuilder.control(true),
    anonymousMode: this.formBuilder.control(false),
    readingPhaseEnabled: this.formBuilder.control(false),
    teamMode: this.formBuilder.control(false),
    teamCount: this.formBuilder.control<number | null>(DEFAULT_TEAM_COUNT, {
      validators: [Validators.min(2), Validators.max(8)],
    }),
    teamAssignment: this.formBuilder.control<TeamAssignment>('AUTO'),
    teamNamesText: this.formBuilder.control(''),
    nicknameTheme: this.formBuilder.control<NicknameTheme>('NOBEL_LAUREATES'),
    bonusEnabled: this.formBuilder.control(false),
    bonusTokenCount: this.formBuilder.control<number | null>(DEFAULT_BONUS_TOKEN_COUNT, {
      validators: [Validators.min(1), Validators.max(50)],
    }),
    preset: this.formBuilder.control<QuizPreset>('PLAYFUL'),
  });

  readonly metadataForm: QuizMetadataFormGroup = this.formBuilder.group({
    name: this.formBuilder.control('', {
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: this.formBuilder.control('', {
      validators: [Validators.maxLength(5000)],
    }),
    motifImageUrl: this.formBuilder.control('', {
      validators: [
        Validators.maxLength(MOTIF_IMAGE_URL_MAX_LENGTH),
        motifImageUrlOptionalHttpsValidator,
      ],
    }),
  });

  constructor() {
    if (this.id === DEMO_QUIZ_ID) {
      this.quizStore.ensureDemoQuiz();
    }
    const quiz = this.quiz();
    if (quiz) {
      this.patchMetadataForm(quiz.name, quiz.description, quiz.motifImageUrl);
      this.patchSettingsForm(quiz.settings);
    }
    merge(
      this.settingsForm.controls.nicknameTheme.valueChanges,
      this.settingsForm.controls.allowCustomNicknames.valueChanges,
      this.settingsForm.controls.anonymousMode.valueChanges,
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.persistNameSettingsFromFormToStore());
    this.settingsForm.valueChanges.pipe(debounceTime(450), takeUntilDestroyed()).subscribe(() => {
      if (!this.quiz() || this.settingsForm.invalid) return;
      this.syncAllSettingsFromFormToStore();
    });
    this.scheduleLivePreview();
    this.localeGuard.register(
      () => this.form.dirty || this.settingsForm.dirty || this.metadataForm.dirty,
    );
  }

  ngOnDestroy(): void {
    this.localeGuard.unregister();
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
  }

  get textControl(): FormControl<string> {
    return this.form.controls.text;
  }

  get typeControl(): FormControl<SupportedQuestionType> {
    return this.form.controls.type;
  }

  get answersArray(): FormArray<AnswerFormGroup> {
    return this.form.controls.answers;
  }

  get settingsTimerControl(): FormControl<number | null> {
    return this.settingsForm.controls.defaultTimer;
  }

  get teamCountControl(): FormControl<number | null> {
    return this.settingsForm.controls.teamCount;
  }

  get teamNamesTextControl(): FormControl<string> {
    return this.settingsForm.controls.teamNamesText;
  }

  get bonusTokenCountControl(): FormControl<number | null> {
    return this.settingsForm.controls.bonusTokenCount;
  }

  answerTextControl(index: number): FormControl<string> {
    return this.answersArray.at(index).controls.text;
  }

  isAnswerCorrect(index: number): boolean {
    return this.answersArray.at(index).controls.isCorrect.value;
  }

  questionTypeLabel(type: SupportedQuestionType): string {
    return this.questionTypeOptions.find((option) => option.value === type)?.label ?? type;
  }

  difficultyLabel(value: Difficulty): string {
    return this.difficultyOptions.find((option) => option.value === value)?.label ?? value;
  }

  isPreviewActive(): boolean {
    return this.route.snapshot.firstChild?.routeConfig?.path === 'preview';
  }

  isTeamModeEnabled(): boolean {
    return this.settingsForm.controls.teamMode.value;
  }

  /** Sichtbar wenn vorgegebene Pseudonym-Listen genutzt werden (nicht reiner Anonym-Modus). */
  isNicknameThemeSectionVisible(): boolean {
    return !this.settingsForm.controls.anonymousMode.value;
  }

  defaultTimerSelectOptions(): number[] {
    return mergeTimerPresetOptions(this.settingsTimerControl.value);
  }

  onDefaultTimerEnabledChange(checked: boolean): void {
    const c = this.settingsTimerControl;
    if (checked) {
      if (c.value === null) {
        c.setValue(DEFAULT_TIMER_SECONDS);
      }
    } else {
      c.setValue(null);
    }
  }

  isBonusEnabled(): boolean {
    return this.settingsForm.controls.bonusEnabled.value;
  }

  teamNamePreview(): string[] {
    return buildEffectiveTeamNames(this.teamNamesTextControl.value, this.teamCountControl.value);
  }

  syncTeamNamesValidation(): void {
    applyTeamNamesValidation(
      this.teamNamesTextControl,
      this.settingsForm.controls.teamMode.value,
      this.teamCountControl.value,
    );
  }

  settingsPresetLabel(): string {
    if (this.matchesSettingsPreset('PLAYFUL')) return $localize`Spielerisch`;
    if (this.matchesSettingsPreset('SERIOUS')) return $localize`Seriös`;
    return $localize`Benutzerdefiniert`;
  }

  applySettingsPreset(preset: QuizPreset): void {
    const values = QUIZ_PRESETS[preset];
    this.settingsForm.patchValue(
      {
        showLeaderboard: values.showLeaderboard ?? true,
        enableSoundEffects: values.enableSoundEffects ?? true,
        enableRewardEffects: values.enableRewardEffects ?? true,
        enableMotivationMessages: values.enableMotivationMessages ?? true,
        enableEmojiReactions: values.enableEmojiReactions ?? true,
        anonymousMode: values.anonymousMode ?? false,
        readingPhaseEnabled: values.readingPhaseEnabled ?? false,
        defaultTimer: values.defaultTimer ?? null,
        preset,
      },
      { emitEvent: false },
    );
    this.syncAllSettingsFromFormToStore();
  }

  hasAnswerOptions(): boolean {
    return this.typeControl.value !== 'FREETEXT' && this.typeControl.value !== 'RATING';
  }

  isSingleChoiceType(): boolean {
    return this.typeControl.value === 'SINGLE_CHOICE';
  }

  isMultipleChoiceType(): boolean {
    return this.typeControl.value === 'MULTIPLE_CHOICE';
  }

  isSurveyType(): boolean {
    return this.typeControl.value === 'SURVEY';
  }

  showDifficultySelection(): boolean {
    return this.questionTypeShowsDifficulty(this.typeControl.value);
  }

  isRatingType(): boolean {
    return this.typeControl.value === 'RATING';
  }

  hasRatingConfig(): boolean {
    return this.isRatingType();
  }

  questionTypeHasCorrectAnswers(type: SupportedQuestionType): boolean {
    return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
  }

  questionTypeShowsDifficulty(type: SupportedQuestionType): boolean {
    return type !== 'SURVEY' && type !== 'RATING';
  }

  renderMarkdown(value: string | null | undefined): SafeHtml {
    const source = value ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdownWithKatex(source).html);
  }

  addAnswer(): void {
    if (!this.canAddAnswer()) return;
    this.answersArray.push(this.createAnswerGroup(false));
    this.scheduleLivePreview();
  }

  removeAnswer(index: number): void {
    if (!this.canRemoveAnswer()) return;
    this.answersArray.removeAt(index);
    this.normalizeCorrectSelectionForType();
    this.scheduleLivePreview();
  }

  canAddAnswer(): boolean {
    return this.hasAnswerOptions() && this.answersArray.length < 10;
  }

  canRemoveAnswer(): boolean {
    return this.hasAnswerOptions() && this.answersArray.length > 2;
  }

  onTypeChanged(): void {
    this.ensureAnswerArrayForType();
    this.normalizeCorrectSelectionForType();
    this.scheduleLivePreview();
  }

  applyScFormat(format: ScFormat | null): void {
    if (!format || !this.isSingleChoiceType()) return;
    const preset = SC_FORMAT_PRESETS[format];
    if (!preset) return;

    const hasExistingContent = this.answersArray.controls.some(
      (answer) => answer.controls.text.value.trim().length > 0,
    );
    if (hasExistingContent) {
      const confirmed = globalThis.confirm(
        'Bestehende Antwortoptionen werden ersetzt. Fortfahren?',
      );
      if (!confirmed) return;
    }

    const groups = preset.answers.map((text) => this.createAnswerGroup(false, text));
    this.form.setControl('answers', this.formBuilder.array<AnswerFormGroup>(groups));
    this.submitError.set(null);
    this.scheduleLivePreview();
  }

  onLivePreviewInput(): void {
    this.scheduleLivePreview();
  }

  setSingleCorrect(index: number): void {
    if (this.typeControl.value !== 'SINGLE_CHOICE') return;

    this.answersArray.controls.forEach((group, currentIndex) => {
      group.controls.isCorrect.setValue(currentIndex === index);
    });
    this.scheduleLivePreview();
  }

  toggleMultipleCorrect(index: number, isChecked: boolean): void {
    if (this.typeControl.value !== 'MULTIPLE_CHOICE') return;
    this.answersArray.at(index).controls.isCorrect.setValue(isChecked);
    this.scheduleLivePreview();
  }

  getCorrectSelectionError(): string | null {
    if (!this.questionTypeHasCorrectAnswers(this.typeControl.value)) {
      return null;
    }

    const correctCount = this.answersArray.controls.filter(
      (answer) => answer.controls.isCorrect.value,
    ).length;

    if (this.typeControl.value === 'SINGLE_CHOICE' && correctCount !== 1) {
      return $localize`Wähle genau eine richtige Antwort aus.`;
    }

    if (this.typeControl.value === 'MULTIPLE_CHOICE' && correctCount < 1) {
      return $localize`Wähle mindestens eine richtige Antwort aus.`;
    }

    return null;
  }

  addQuestion(): void {
    this.submitted.set(true);
    this.submitError.set(null);

    this.normalizeCorrectSelectionForType();
    const selectionError = this.getCorrectSelectionError();

    if (this.form.invalid || selectionError) {
      this.form.markAllAsTouched();
      this.submitError.set(selectionError);
      if (this.form.invalid) {
        focusFirstInvalidField(this.questionFormElement?.nativeElement, this.form);
      } else if (selectionError) {
        const selectionControl = this.questionFormElement?.nativeElement.querySelector<HTMLElement>(
          '.quiz-edit-answer__selector button, .quiz-edit-answer__selector .mat-mdc-checkbox input',
        );
        focusAndScrollElement(selectionControl);
      }
      return;
    }

    const questionInput: AddQuizQuestionInput = {
      text: this.textControl.value,
      type: this.typeControl.value,
      difficulty: this.form.controls.difficulty.value,
      answers: this.buildQuestionAnswersForType(),
      ...(this.isRatingType()
        ? {
            ratingMin: this.form.controls.ratingMin.value,
            ratingMax: this.form.controls.ratingMax.value,
            ratingLabelMin: this.form.controls.ratingLabelMin.value,
            ratingLabelMax: this.form.controls.ratingLabelMax.value,
          }
        : {}),
    };

    try {
      const editingQuestionId = this.editingQuestionId();
      if (editingQuestionId) {
        this.quizStore.updateQuestion(this.id, editingQuestionId, questionInput);
        this.editingQuestionId.set(null);
      } else {
        this.quizStore.addQuestion(this.id, questionInput);
        this.showQuestionAddedFeedback();
      }
      this.resetQuestionForm();
      this.submitted.set(false);
      this.scheduleLivePreview();
    } catch (error) {
      const message = error instanceof Error ? error.message : $localize`Speichern fehlgeschlagen.`;
      this.submitError.set(message);
    }
  }

  saveSettings(): void {
    this.settingsSaved.set(false);
    this.settingsSubmitError.set(null);
    this.syncTeamNamesValidation();

    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      focusFirstInvalidField(this.settingsFormElement?.nativeElement, this.settingsForm);
      return;
    }

    try {
      const updated = this.quizStore.updateQuizSettings(this.id, this.readSettingsFromForm());
      this.patchSettingsForm(updated);
      this.settingsSaved.set(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : $localize`Einstellungen konnten nicht gespeichert werden.`;
      this.settingsSubmitError.set(message);
    }
  }

  saveMetadata(): void {
    this.metadataSaved.set(false);
    this.metadataSubmitError.set(null);

    if (this.metadataForm.invalid) {
      this.metadataForm.markAllAsTouched();
      focusFirstInvalidField(this.metadataFormElement?.nativeElement, this.metadataForm);
      return;
    }

    try {
      const updated = this.quizStore.updateQuizMetadata(this.id, {
        name: this.metadataForm.controls.name.value,
        description: this.metadataForm.controls.description.value,
        motifImageUrl: this.metadataForm.controls.motifImageUrl.value.trim()
          ? this.metadataForm.controls.motifImageUrl.value.trim()
          : null,
      });
      this.patchMetadataForm(updated.name, updated.description, updated.motifImageUrl);
      this.metadataSaved.set(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Titel konnte nicht gespeichert werden.';
      this.metadataSubmitError.set(message);
    }
  }

  toggleQuestionExpanded(questionId: string): void {
    this.expandedQuestionIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }

  isQuestionExpanded(questionId: string): boolean {
    return this.expandedQuestionIds().has(questionId);
  }

  ratingSteps(min: number, max: number): number[] {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  onQuestionFormPanelOpenedChange(opened: boolean): void {
    this.questionFormPanelOpen.set(opened);
  }

  editQuestion(questionId: string): void {
    const question = this.questions().find((entry) => entry.id === questionId);
    if (!question) return;

    this.form.controls.text.setValue(question.text);
    this.form.controls.type.setValue(question.type);
    this.form.controls.difficulty.setValue(question.difficulty);
    this.form.setControl('answers', this.createAnswerArrayForType(question.type, question.answers));
    this.form.controls.ratingMin.setValue(question.ratingMin ?? 1);
    this.form.controls.ratingMax.setValue(question.ratingMax ?? 5);
    this.form.controls.ratingLabelMin.setValue(question.ratingLabelMin ?? '');
    this.form.controls.ratingLabelMax.setValue(question.ratingLabelMax ?? '');

    this.editingQuestionId.set(question.id);
    this.submitError.set(null);
    this.submitted.set(false);
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.scheduleLivePreview();

    requestAnimationFrame(() => {
      const el = this.questionFormElement?.nativeElement;
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  cancelEditing(): void {
    this.editingQuestionId.set(null);
    this.resetQuestionForm('SINGLE_CHOICE');
    this.submitted.set(false);
  }

  setQuestionEnabledFlag(questionId: string, enabled: boolean): void {
    try {
      this.quizStore.setQuestionEnabled(this.id, questionId, enabled);
      this.submitError.set(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : $localize`Frage konnte nicht aktualisiert werden.`;
      this.submitError.set(message);
    }
  }

  deleteQuestion(questionId: string): void {
    const doc = this.quiz();
    if (!doc) return;
    const question = doc.questions.find((q) => q.id === questionId);
    if (!question) return;

    const position = question.order + 1;
    const dialogRef = this.dialog.open(ConfirmLeaveDialogComponent, {
      data: {
        title: $localize`:@@quiz.edit.deleteQuestionDialogTitle:Frage löschen?`,
        message: $localize`:@@quiz.edit.deleteQuestionDialogMessage:Frage ${position} wird dauerhaft aus dem Quiz entfernt.`,
        consequences: [
          $localize`:@@quiz.deleteIrreversible:Das lässt sich nicht rückgängig machen.`,
        ],
        confirmLabel: $localize`:@@quiz.edit.deleteQuestionConfirm:Löschen`,
        cancelLabel: $localize`:@@quiz.edit.deleteQuestionCancel:Abbrechen`,
      } satisfies ConfirmLeaveDialogData,
      width: 'min(26rem, calc(100vw - 1.5rem))',
      maxWidth: '100vw',
      autoFocus: 'dialog',
    });

    firstValueFrom(dialogRef.afterClosed()).then((confirmed) => {
      if (confirmed !== true) return;
      try {
        this.quizStore.deleteQuestion(this.id, questionId);
        if (this.editingQuestionId() === questionId) {
          this.cancelEditing();
        }
        this.submitError.set(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : $localize`Löschen fehlgeschlagen.`;
        this.submitError.set(message);
      }
    });
  }

  onQuestionDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    try {
      this.quizStore.reorderQuestions(this.id, event.previousIndex, event.currentIndex);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verschieben fehlgeschlagen.';
      this.submitError.set(message);
    }
  }

  private showQuestionAddedFeedback(): void {
    this.questionAddedFeedback.set(true);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => {
      this.questionAddedFeedback.set(false);
      this.feedbackTimer = null;
    }, 3000);

    requestAnimationFrame(() => {
      const list = this.document.querySelector('.quiz-edit-list');
      if (!list) return;
      const cards = list.querySelectorAll('.quiz-edit-question');
      const lastCard = cards[cards.length - 1];
      lastCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  private createAnswerGroup(isCorrect: boolean, text: string = ''): AnswerFormGroup {
    return this.formBuilder.group({
      text: this.formBuilder.control(text, {
        validators: [Validators.required, Validators.maxLength(500)],
      }),
      isCorrect: this.formBuilder.control(isCorrect),
    });
  }

  private patchSettingsForm(settings: QuizSettings): void {
    this.settingsForm.setValue(
      {
        showLeaderboard: settings.showLeaderboard,
        allowCustomNicknames: settings.allowCustomNicknames,
        defaultTimer: settings.defaultTimer,
        enableSoundEffects: settings.enableSoundEffects,
        enableRewardEffects: settings.enableRewardEffects,
        enableMotivationMessages: settings.enableMotivationMessages,
        enableEmojiReactions: settings.enableEmojiReactions,
        anonymousMode: settings.anonymousMode,
        readingPhaseEnabled: settings.readingPhaseEnabled,
        teamMode: settings.teamMode,
        teamCount: settings.teamCount ?? DEFAULT_TEAM_COUNT,
        teamAssignment: settings.teamAssignment,
        teamNamesText: settings.teamNames.join('\n'),
        nicknameTheme: settings.nicknameTheme,
        bonusEnabled:
          settings.bonusTokenCount !== null &&
          settings.bonusTokenCount !== undefined &&
          settings.bonusTokenCount > 0,
        bonusTokenCount: settings.bonusTokenCount ?? DEFAULT_BONUS_TOKEN_COUNT,
        preset: settings.preset,
      },
      { emitEvent: false },
    );
    this.settingsForm.markAsPristine();
    this.settingsForm.markAsUntouched();
  }

  /** Namensliste / Anonymität: sofort in den Store (Live-Start liest nur den Store, nicht nur das Formular). */
  private persistNameSettingsFromFormToStore(): void {
    if (!this.quiz()) return;
    try {
      this.quizStore.updateQuizSettings(this.id, {
        nicknameTheme: this.settingsForm.controls.nicknameTheme.value ?? 'NOBEL_LAUREATES',
        allowCustomNicknames: this.settingsForm.controls.allowCustomNicknames.value,
        anonymousMode: this.settingsForm.controls.anonymousMode.value,
      });
    } catch {
      /* z. B. Demo-Quiz gesperrt */
    }
  }

  /** Nach Preset-Chips: gesamte Einstellungen wie bei „Übernehmen“ in den Store. */
  private syncAllSettingsFromFormToStore(): void {
    if (!this.quiz()) return;
    try {
      this.quizStore.updateQuizSettings(this.id, this.readSettingsFromForm());
    } catch {
      /* ungültige Team-/Bonus-Kombination — Nutzer kann „Übernehmen“ nutzen */
    }
  }

  private readSettingsFromForm(): QuizSettings {
    return {
      showLeaderboard: this.settingsForm.controls.showLeaderboard.value,
      allowCustomNicknames: this.settingsForm.controls.allowCustomNicknames.value,
      defaultTimer: this.settingsForm.controls.defaultTimer.value,
      enableSoundEffects: this.settingsForm.controls.enableSoundEffects.value,
      enableRewardEffects: this.settingsForm.controls.enableRewardEffects.value,
      enableMotivationMessages: this.settingsForm.controls.enableMotivationMessages.value,
      enableEmojiReactions: this.settingsForm.controls.enableEmojiReactions.value,
      anonymousMode: this.settingsForm.controls.anonymousMode.value,
      teamMode: this.settingsForm.controls.teamMode.value,
      teamCount: this.settingsForm.controls.teamMode.value
        ? this.settingsForm.controls.teamCount.value
        : null,
      teamAssignment: this.settingsForm.controls.teamAssignment.value,
      teamNames: parseTeamNamesText(this.settingsForm.controls.teamNamesText.value),
      backgroundMusic: null,
      nicknameTheme: this.settingsForm.controls.nicknameTheme.value ?? 'NOBEL_LAUREATES',
      bonusTokenCount: this.settingsForm.controls.bonusEnabled.value
        ? (this.settingsForm.controls.bonusTokenCount.value ?? DEFAULT_BONUS_TOKEN_COUNT)
        : null,
      readingPhaseEnabled: this.settingsForm.controls.readingPhaseEnabled.value,
      preset: this.settingsForm.controls.preset.value,
    };
  }

  private matchesSettingsPreset(preset: QuizPreset): boolean {
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

  private patchMetadataForm(
    name: string,
    description: string | null,
    motifImageUrl: string | null,
  ): void {
    this.metadataForm.setValue({
      name,
      description: description ?? '',
      motifImageUrl: motifImageUrl ?? '',
    });
    this.metadataForm.markAsPristine();
    this.metadataForm.markAsUntouched();
  }

  private resetQuestionForm(type: SupportedQuestionType = this.typeControl.value): void {
    this.form.controls.text.reset('');
    this.form.controls.type.reset(type);
    this.form.controls.difficulty.reset('MEDIUM');
    this.form.setControl('answers', this.createAnswerArrayForType(type));
    this.form.controls.ratingMin.reset(1);
    this.form.controls.ratingMax.reset(5);
    this.form.controls.ratingLabelMin.reset('');
    this.form.controls.ratingLabelMax.reset('');

    this.submitError.set(null);
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.scheduleLivePreview();
  }

  private buildQuestionAnswersForType(): AddQuizQuestionInput['answers'] {
    if (!this.hasAnswerOptions()) {
      return [];
    }

    return this.answersArray.controls.map((answer) => ({
      text: answer.controls.text.value,
      isCorrect: this.isSurveyType() ? false : answer.controls.isCorrect.value,
    }));
  }

  private createAnswerArrayForType(
    type: SupportedQuestionType,
    existingAnswers: AddQuizQuestionInput['answers'] = [],
  ): FormArray<AnswerFormGroup> {
    if (type === 'FREETEXT' || type === 'RATING') {
      return this.formBuilder.array<AnswerFormGroup>([]);
    }

    const groups = existingAnswers.map((answer) =>
      this.createAnswerGroup(type === 'SURVEY' ? false : answer.isCorrect, answer.text),
    );

    while (groups.length < 2) {
      groups.push(this.createAnswerGroup(type === 'SINGLE_CHOICE' && groups.length === 0));
    }

    return this.formBuilder.array<AnswerFormGroup>(groups);
  }

  private ensureAnswerArrayForType(): void {
    const type = this.typeControl.value;
    if (type === 'RATING') {
      this.form.controls.ratingMin.setValue(1);
      const max = this.form.controls.ratingMax.value;
      this.form.controls.ratingMax.setValue(max === 10 ? 10 : 5);
    }

    if (!this.hasAnswerOptions()) {
      if (this.answersArray.length > 0) {
        this.form.setControl('answers', this.createAnswerArrayForType(type));
      }
      return;
    }

    if (this.answersArray.length < 2) {
      this.form.setControl('answers', this.createAnswerArrayForType(type));
    }
  }

  private normalizeCorrectSelectionForType(): void {
    if (!this.hasAnswerOptions() || this.answersArray.length === 0) return;

    if (this.isSurveyType()) {
      this.answersArray.controls.forEach((answer) => {
        answer.controls.isCorrect.setValue(false);
      });
      return;
    }

    if (this.isSingleChoiceType()) {
      const selectedIndexes = this.answersArray.controls
        .map((answer, index) => ({ index, isCorrect: answer.controls.isCorrect.value }))
        .filter((entry) => entry.isCorrect)
        .map((entry) => entry.index);
      if (selectedIndexes.length === 0) return;

      const normalizedIndex = selectedIndexes[0]!;
      this.answersArray.controls.forEach((answer, index) => {
        answer.controls.isCorrect.setValue(index === normalizedIndex);
      });
    }
  }

  private scheduleLivePreview(): void {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
    }

    this.previewTimer = setTimeout(() => {
      const questionResult = renderMarkdownWithKatex(this.textControl.value);
      this.questionPreviewHtml.set(this.sanitizer.bypassSecurityTrustHtml(questionResult.html));

      const answerResults = this.answersArray.controls.map((answer) =>
        renderMarkdownWithKatex(answer.controls.text.value),
      );
      this.answerPreviewHtml.set(
        answerResults.map((result) => this.sanitizer.bypassSecurityTrustHtml(result.html)),
      );

      const firstError =
        questionResult.katexError ??
        answerResults.find((result) => result.katexError)?.katexError ??
        null;
      this.previewKatexError.set(firstError);
      this.previewTimer = null;
    }, 200);
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
