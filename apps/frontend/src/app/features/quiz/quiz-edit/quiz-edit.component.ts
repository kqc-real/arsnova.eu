import { DOCUMENT, formatNumber, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  LOCALE_ID,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocaleSwitchGuardService } from '../../../core/locale-switch-guard.service';
import {
  confidenceDefaultLabelHigh,
  confidenceDefaultLabelLow,
  resolveConfidenceLabelHigh,
  resolveConfidenceLabelLow,
} from '../../../shared/confidence-default-labels';
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
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
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
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  DEFAULT_BONUS_TOKEN_COUNT,
  DEFAULT_TEAM_COUNT,
  DEFAULT_TIMER_SECONDS,
  MOTIF_IMAGE_URL_MAX_LENGTH,
  NUMERIC_DEFAULT_INPUT_KIND,
  NUMERIC_DEFAULT_TOLERANCE_MODE,
  NUMERIC_DEFAULT_UNIT_FAMILY,
  MotifImageUrlSchema,
  QUIZ_PRESETS,
  SC_FORMAT_PRESETS,
  SHORT_TEXT_DEFAULT_EVALUATION_KIND,
  SHORT_TEXT_DEFAULT_MAX_LENGTH,
  SHORT_TEXT_DEFAULT_EVALUATION_MODE,
  SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
  SHORT_TEXT_MAX_LENGTH_LIMIT,
  CONFIDENCE_SCALE_MAX,
  CONFIDENCE_SCALE_MIN,
  evaluateNumericAnswer,
  evaluateShortAnswer,
  isNumericToleranceMode,
  questionSupportsConfidence,
  normalizeShortTextValue,
  resolveNumericEstimateToleranceMode,
  resolveNumericTolerance,
  resolveNumericQuestionEvaluationSettings,
  resolveShortTextEvaluationKind,
  resolveShortTextMaxLength,
  type Difficulty,
  type NicknameTheme,
  type NumericInputKind,
  type NumericToleranceMode,
  type NumericUnitFamily,
  type QuestionNumericToleranceMode,
  type QuizPreset,
  type ScFormat,
  type ShortAnswerEvaluationMode,
  type ShortTextEvaluationKind,
  type TeamAssignment,
  type ToleranceLevel,
  usesNumericShortTextEvaluation,
  usesShortTextUnitEvaluation,
} from '@arsnova/shared-types';
import { mergeTimerPresetOptions } from '../default-timer-presets';
import {
  DEMO_QUIZ_ID,
  QuizStoreService,
  type AddQuizQuestionInput,
  type QuizQuestion,
  type QuizSettings,
  type SupportedQuestionType,
} from '../data/quiz-store.service';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { MarkdownImageLightboxDirective } from '../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { MarkdownKatexEditorComponent } from '../../../shared/markdown-katex-editor/markdown-katex-editor.component';
import { decorateLeadingAnswerEmoji } from '../../../shared/leading-answer-emoji.util';
import { answerOptionColor, answerOptionShape } from '../../../shared/answer-option-badge.util';
import { AnswerOptionBadgeComponent } from '../../../shared/answer-option-badge/answer-option-badge.component';
import { InfoLandingLinkComponent } from '../../../shared/info-landing-link/info-landing-link.component';
import { INFO_LANDING_ANCHORS } from '../../../core/info-landing-url';
import { replaceEmojiShortcodes } from '../../../shared/emoji-shortcode.util';
import {
  focusAndScrollElement,
  focusFirstInvalidField,
  scrollElementIntoAppShell,
} from '../../../shared/focus-invalid-field.util';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../../../shared/confirm-leave-dialog/confirm-leave-dialog.component';
import { confirmDiscardUnsavedChanges } from '../../../shared/confirm-leave-dialog/confirm-unsaved-changes';

type AnswerFormGroup = FormGroup<{
  text: FormControl<string>;
  isCorrect: FormControl<boolean>;
}>;

type MatchingPairFormGroup = FormGroup<{
  leftId: FormControl<string>;
  left: FormControl<string>;
  rightId: FormControl<string>;
  right: FormControl<string>;
}>;

type OrderingItemFormGroup = FormGroup<{
  id: FormControl<string>;
  text: FormControl<string>;
}>;

type CategorizationCategoryFormGroup = FormGroup<{
  id: FormControl<string>;
  name: FormControl<string>;
}>;

type CategorizationItemFormGroup = FormGroup<{
  id: FormControl<string>;
  text: FormControl<string>;
  correctCategoryId: FormControl<string>;
}>;

type QuestionFormGroup = FormGroup<{
  text: FormControl<string>;
  type: FormControl<SupportedQuestionType>;
  difficulty: FormControl<Difficulty>;
  questionTimer: FormControl<number | null>;
  questionSkipReadingPhase: FormControl<boolean>;
  answers: FormArray<AnswerFormGroup>;
  ratingMin: FormControl<number | null>;
  ratingMax: FormControl<number | null>;
  ratingLabelMin: FormControl<string>;
  ratingLabelMax: FormControl<string>;
  shortTextEvaluationKind: FormControl<ShortTextEvaluationKind>;
  shortTextMaxLength: FormControl<number | null>;
  shortTextCaseSensitive: FormControl<boolean>;
  shortTextEvaluationMode: FormControl<ShortAnswerEvaluationMode>;
  shortTextToleranceLevel: FormControl<ToleranceLevel>;
  shortTextAllowPartialCredit: FormControl<boolean>;
  shortTextTrimWhitespace: FormControl<boolean>;
  shortTextNormalizeWhitespace: FormControl<boolean>;
  numericInputKind: FormControl<NumericInputKind>;
  numericToleranceMode: FormControl<QuestionNumericToleranceMode>;
  numericAbsoluteTolerance: FormControl<number | null>;
  numericRelativeTolerancePercent: FormControl<number | null>;
  numericUnitFamily: FormControl<NumericUnitFamily>;
  numericRequireUnit: FormControl<boolean>;
  numericAcceptEquivalentUnits: FormControl<boolean>;
  // Story 1.2d: Numerische Schätzfrage
  numericReferenceValue: FormControl<number | null>;
  numericTolerancePercent: FormControl<number | null>;
  numericIntervalLeft: FormControl<number | null>;
  numericIntervalRight: FormControl<number | null>;
  numericInputType: FormControl<'INTEGER' | 'DECIMAL'>;
  numericDecimalPlaces: FormControl<number | null>;
  numericMin: FormControl<number | null>;
  numericMax: FormControl<number | null>;
  numericTwoRounds: FormControl<boolean>;
  confidenceEnabled: FormControl<boolean>;
  confidenceLabelLow: FormControl<string>;
  confidenceLabelHigh: FormControl<string>;
  matchingPairs: FormArray<MatchingPairFormGroup>;
  matchingShuffleRight: FormControl<boolean>;
  orderingItems: FormArray<OrderingItemFormGroup>;
  categories: FormArray<CategorizationCategoryFormGroup>;
  categorizationItems: FormArray<CategorizationItemFormGroup>;
  categorizationShuffleItems: FormControl<boolean>;
}>;

type ShortTextPreviewExample = {
  label: string;
  studentAnswer: string;
  outcome: string;
  tone: 'full' | 'partial' | 'rejected';
};

type NumericEstimatePresetValue = 'year' | 'measurement' | 'percent' | 'magnitude';

type NumericEstimateConfigPreview = {
  rangeMinLabel: string;
  rangeMaxLabel: string;
  toleranceLabel: string | null;
  plausibilityLabel: string | null;
  referenceLabel: string | null;
  toleranceStyle: { left: number; width: number } | null;
  referenceStyle: { left: number } | null;
  note: string;
};

type ParsedNumericPreviewAnswer = {
  value: number;
  unit: string | null;
  unitFamily: Exclude<NumericUnitFamily, 'none'> | null;
  factor: number | null;
  decimalSeparator: ',' | '.' | null;
};

const NUMERIC_PREVIEW_INPUT_REGEX = /^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))(?:\s*([a-zA-Z]+))?$/;
const NUMERIC_PREVIEW_UNIT_FACTORS: Record<
  Exclude<NumericUnitFamily, 'none'>,
  Record<string, number>
> = {
  length: { mm: 0.001, cm: 0.01, m: 1, km: 1000 },
  mass: { mg: 0.001, g: 1, kg: 1000, t: 1_000_000 },
  time: { ms: 0.001, s: 1, min: 60, h: 3600 },
  volume: { ml: 0.001, l: 1 },
};

function previewUnitFamilyForUnit(unit: string): Exclude<NumericUnitFamily, 'none'> | null {
  for (const [family, units] of Object.entries(NUMERIC_PREVIEW_UNIT_FACTORS)) {
    if (unit in units) {
      return family as Exclude<NumericUnitFamily, 'none'>;
    }
  }

  return null;
}

function parseNumericPreviewAnswer(value: string): ParsedNumericPreviewAnswer | null {
  const match = NUMERIC_PREVIEW_INPUT_REGEX.exec(value.trim().replace(/\s+/g, ' '));
  if (!match?.[1]) {
    return null;
  }

  const decimalSeparator = match[1].includes(',') ? ',' : match[1].includes('.') ? '.' : null;
  const numericValue = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const unit = match[2]?.toLowerCase() ?? null;
  if (!unit) {
    return {
      value: numericValue,
      unit: null,
      unitFamily: null,
      factor: null,
      decimalSeparator,
    };
  }

  const unitFamily = previewUnitFamilyForUnit(unit);
  return {
    value: numericValue,
    unit,
    unitFamily,
    factor: unitFamily ? NUMERIC_PREVIEW_UNIT_FACTORS[unitFamily][unit] : null,
    decimalSeparator,
  };
}

function formatNumericPreviewValue(
  value: number,
  decimalSeparator: ',' | '.' | null,
  preferredFractionDigits = 4,
): string {
  const rounded = Number(value.toFixed(preferredFractionDigits));
  const normalized = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return decimalSeparator === ',' ? normalized.replace('.', ',') : normalized;
}

type QuizSettingsFormGroup = FormGroup<{
  showLeaderboard: FormControl<boolean>;
  allowCustomNicknames: FormControl<boolean>;
  defaultTimer: FormControl<number | null>;
  timerScaleByDifficulty: FormControl<boolean>;
  enableSoundEffects: FormControl<boolean>;
  enableRewardEffects: FormControl<boolean>;
  enableMotivationMessages: FormControl<boolean>;
  enableEmojiReactions: FormControl<boolean>;
  showQuestionTypeIndicators: FormControl<boolean>;
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

type QuizMetadataComparable = {
  name: string;
  description: string | null;
  motifImageUrl: string | null;
};

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
    MatSlideToggle,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    MarkdownImageLightboxDirective,
    MarkdownKatexEditorComponent,
    AnswerOptionBadgeComponent,
    InfoLandingLinkComponent,
  ],
  templateUrl: './quiz-edit.component.html',
  styleUrls: ['../../../shared/styles/dialog-title-header.scss', './quiz-edit.component.scss'],
})
export class QuizEditComponent implements OnDestroy {
  readonly infoLandingEstimateAnchor = INFO_LANDING_ANCHORS.numericEstimate;
  readonly infoLandingEstimateLabel = $localize`:@@quizEdit.infoLandingEstimate:Schätzfragen didaktisch einsetzen`;
  readonly infoLandingConfidenceAnchor = INFO_LANDING_ANCHORS.confidence;
  readonly infoLandingConfidenceLabel = $localize`:@@quizEdit.infoLandingConfidence:Selbsteinschätzung und Nachbesprechung verstehen`;

  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly quizStore = inject(QuizStoreService);
  private readonly localeGuard = inject(LocaleSwitchGuardService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly localeId = inject(LOCALE_ID);
  private readonly markdownCache = new Map<string, SafeHtml>();
  private readonly answerMarkdownCache = new Map<string, SafeHtml>();
  private readonly localeDirtyGetter = (): boolean => this.hasPendingChanges();
  private confirmDiscardInFlight: Promise<boolean> | null = null;
  /**
   * Letzter mit dem Store abgeglichener Formularstand. Während Preview nur syncen,
   * wenn das Formular noch diesem Stand entspricht (keine echten Parent-Entwürfe).
   */
  private lastSyncedSettingsJson: string | null = null;
  private lastSyncedMetadataJson: string | null = null;
  private lastSyncedQuestionId: string | null = null;
  private lastSyncedQuestionJson: string | null = null;
  private readonly previewRouteActive = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.isPreviewActive()),
      startWith(this.isPreviewActive()),
    ),
    { initialValue: this.isPreviewActive() },
  );

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  /** Synchron zu MotifImageUrlSchema / maxlength im Metadaten-Formular. */
  readonly motifImageUrlMaxLength = MOTIF_IMAGE_URL_MAX_LENGTH;
  readonly submitError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly editingQuestionId = signal<string | null>(null);
  readonly questionReorderAnnouncement = signal('');
  readonly questionDrafts = signal<Record<string, AddQuizQuestionInput>>({});
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
  readonly orderingSolutionAnnouncement = signal('');
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private lastQuestionTypeForConfidence: SupportedQuestionType = 'SINGLE_CHOICE';
  @ViewChild('metadataFormElement') private metadataFormElement?: ElementRef<HTMLFormElement>;
  @ViewChild('settingsFormElement') private settingsFormElement?: ElementRef<HTMLFormElement>;
  @ViewChild('questionFormElement') private questionFormElement?: ElementRef<HTMLFormElement>;

  readonly questionTypeOptions: Array<{ value: SupportedQuestionType; label: string }> = [
    {
      value: 'NUMERIC_ESTIMATE',
      label: $localize`:@@quizPreview.typeNumericEstimate:Numerische Schätzfrage`,
    },
    { value: 'SINGLE_CHOICE', label: $localize`Single Choice` },
    { value: 'MULTIPLE_CHOICE', label: $localize`Multiple Choice` },
    { value: 'FREETEXT', label: $localize`Freitext` },
    { value: 'SHORT_TEXT', label: $localize`:@@quizPreview.typeShortText:Kurzantwort` },
    { value: 'SURVEY', label: $localize`Umfrage` },
    { value: 'RATING', label: $localize`Bewertung (1–5 / 1–10)` },
    {
      value: 'MATCHING',
      label: $localize`:@@quizPreview.typeMatching:Zuordnung`,
    },
    {
      value: 'ORDERING',
      label: $localize`:@@quizPreview.typeOrdering:Reihenfolge`,
    },
    {
      value: 'CATEGORIZATION',
      label: $localize`:@@quizPreview.typeCategorization:Kategorisierung`,
    },
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

  readonly numericEstimatePresetOptions: Array<{
    value: NumericEstimatePresetValue;
    label: string;
    hint: string;
    icon: string;
  }> = [
    {
      value: 'year',
      label: $localize`:@@quizEdit.numericPresetYearLabel:Jahreszahl`,
      hint: $localize`:@@quizEdit.numericPresetYearHint:Ganzzahl, 1500–2000 plausibel, 1700–1900 akzeptiert, zwei Runden.`,
      icon: 'event',
    },
    {
      value: 'measurement',
      label: $localize`:@@quizEdit.numericPresetMeasurementLabel:Messwert`,
      hint: $localize`:@@quizEdit.numericPresetMeasurementHint:Dezimalwert mit einer Nachkommastelle und engem absoluten Toleranzband.`,
      icon: 'straighten',
    },
    {
      value: 'percent',
      label: $localize`:@@quizEdit.numericPresetPercentLabel:Prozentwert`,
      hint: $localize`:@@quizEdit.numericPresetPercentHint:Ganzzahl von 0 bis 100 mit zehn Prozentpunkten Toleranz.`,
      icon: 'percent',
    },
    {
      value: 'magnitude',
      label: $localize`:@@quizEdit.numericPresetMagnitudeLabel:Größenordnung`,
      hint: $localize`:@@quizEdit.numericPresetMagnitudeHint:Große Ganzzahl mit relativem Toleranzband für Schätzungen in Größenordnungen.`,
      icon: 'finance',
    },
  ];

  readonly difficultyOptions: Array<{ value: Difficulty; label: string }> = [
    { value: 'EASY', label: $localize`:@@quiz.difficulty.easy:Leicht` },
    { value: 'MEDIUM', label: $localize`:@@quiz.difficulty.medium:Mittel` },
    { value: 'HARD', label: $localize`:@@quiz.difficulty.hard:Schwer` },
  ];

  readonly shortTextEvaluationModeOptions: Array<{
    value: ShortAnswerEvaluationMode;
    label: string;
    hint: string;
  }> = [
    {
      value: 'exact',
      label: $localize`:@@quizEdit.shortTextModeExactLabel:Nur exakt gleich`,
      hint: $localize`:@@quizEdit.shortTextModeExactHint:Akzeptiert nur identische Schreibweisen.`,
    },
    {
      value: 'auto',
      label: $localize`:@@quizEdit.shortTextModeAutoLabel:Kleine Tippfehler erlauben`,
      hint: $localize`:@@quizEdit.shortTextModeAutoHint:Für die meisten Fachbegriffe: berücksichtigt exakte Treffer, kleine Tippfehler, Buchstabendreher und fehlende Zeichen.`,
    },
    {
      value: 'hamming',
      label: $localize`:@@quizEdit.shortTextModeHammingLabel:Gleiche Länge, kleine Buchstabendreher`,
      hint: $localize`:@@quizEdit.shortTextModeHammingHint:Für gleich lange Begriffe mit einem falschen oder vertauschten Buchstaben.`,
    },
    {
      value: 'levenshtein',
      label: $localize`:@@quizEdit.shortTextModeLevenshteinLabel:Auch fehlende oder zusätzliche Zeichen erlauben`,
      hint: $localize`:@@quizEdit.shortTextModeLevenshteinHint:Für Begriffe mit einem fehlenden oder zusätzlichen Zeichen.`,
    },
  ];

  readonly shortTextEvaluationKindOptions: Array<{
    value: ShortTextEvaluationKind;
    label: string;
    hint: string;
  }> = [
    {
      value: 'text',
      label: $localize`:@@quizEdit.shortTextEvaluationKindText:Mit Textähnlichkeit bewerten`,
      hint: $localize`:@@quizEdit.shortTextEvaluationKindTextHint:Geeignet für Fachbegriffe und feste Schreibweisen mit kleinen Tippfehlern.`,
    },
    {
      value: 'numeric',
      label: $localize`:@@quizEdit.shortTextEvaluationKindNumeric:Zahlen bewerten`,
      hint: $localize`:@@quizEdit.shortTextEvaluationKindNumericHint:Bewertet Zahlenwerte statt Zeichenähnlichkeit und unterstützt exakte, absolute oder relative Toleranzen.`,
    },
    {
      value: 'numeric_unit',
      label: $localize`:@@quizEdit.shortTextEvaluationKindNumericUnit:Zahlen und Einheiten bewerten`,
      hint: $localize`:@@quizEdit.shortTextEvaluationKindNumericUnitHint:Prüft Zahlenwerte zusammen mit einer kuratierten Einheitenfamilie und erklärt fehlende oder abweichende Einheiten.`,
    },
  ];

  readonly numericInputKindOptions: Array<{ value: NumericInputKind; label: string }> = [
    { value: 'integer', label: $localize`:@@quizEdit.numericInputKindInteger:Ganzzahl` },
    { value: 'decimal', label: $localize`:@@quizEdit.numericInputKindDecimal:Dezimalzahl` },
  ];

  readonly numericToleranceModeOptions: Array<{ value: NumericToleranceMode; label: string }> = [
    { value: 'exact', label: $localize`:@@quizEdit.numericToleranceExact:Exakte Zahl` },
    {
      value: 'absolute',
      label: $localize`:@@quizEdit.numericToleranceAbsolute:Absolute Toleranz`,
    },
    {
      value: 'relative',
      label: $localize`:@@quizEdit.numericToleranceRelative:Relative Toleranz (%)`,
    },
  ];

  readonly numericUnitFamilyOptions: Array<{ value: NumericUnitFamily; label: string }> = [
    { value: 'length', label: $localize`:@@quizEdit.numericUnitFamilyLength:Länge` },
    { value: 'mass', label: $localize`:@@quizEdit.numericUnitFamilyMass:Masse` },
    { value: 'time', label: $localize`:@@quizEdit.numericUnitFamilyTime:Zeit` },
    { value: 'volume', label: $localize`:@@quizEdit.numericUnitFamilyVolume:Volumen` },
  ];

  readonly shortTextToleranceOptions: Array<{ value: ToleranceLevel; label: string }> = [
    { value: 'none', label: $localize`:@@quizEdit.shortTextToleranceNone:Keine Toleranz` },
    { value: 'low', label: $localize`:@@quizEdit.shortTextToleranceLow:Niedrig` },
    { value: 'medium', label: $localize`:@@quizEdit.shortTextToleranceMedium:Mittel` },
    { value: 'high', label: $localize`:@@quizEdit.shortTextToleranceHigh:Großzügig` },
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
    const drafts = this.questionDrafts();
    return [...quiz.questions]
      .sort((a, b) => a.order - b.order)
      .map((question) => {
        const draft = drafts[question.id];
        return draft ? this.mergeQuestionWithDraft(question, draft) : question;
      });
  });
  readonly isEditing = computed(() => this.editingQuestionId() !== null);
  /** Panel „Neue Frage“ (oben); Standard eingeklappt, beim Inline-Bearbeiten ausgeblendet. */
  readonly questionFormPanelOpen = signal(false);
  readonly isNewQuestionFormPanelExpanded = computed(
    () => !this.isEditing() && this.questionFormPanelOpen(),
  );
  /** Metadaten-Karte; nach Schritt „Quiz neu“ (from=new) sofort eingeklappt – Initialwert aus URL, nicht erst im Constructor. */
  readonly metadataPanelExpanded = signal(this.route.snapshot.queryParamMap?.get('from') !== 'new');

  readonly form: QuestionFormGroup = this.formBuilder.group({
    text: this.formBuilder.control('', {
      validators: [Validators.required, Validators.maxLength(2000)],
    }),
    type: this.formBuilder.control<SupportedQuestionType>('SINGLE_CHOICE'),
    difficulty: this.formBuilder.control<Difficulty>('MEDIUM'),
    questionTimer: this.formBuilder.control<number | null>(null),
    questionSkipReadingPhase: this.formBuilder.control(false),
    answers: this.createAnswerArrayForType('SINGLE_CHOICE'),
    ratingMin: this.formBuilder.control<number | null>(1),
    ratingMax: this.formBuilder.control<number | null>(5),
    ratingLabelMin: this.formBuilder.control(''),
    ratingLabelMax: this.formBuilder.control(''),
    shortTextEvaluationKind: this.formBuilder.control<ShortTextEvaluationKind>(
      SHORT_TEXT_DEFAULT_EVALUATION_KIND,
    ),
    shortTextMaxLength: this.formBuilder.control<number | null>(SHORT_TEXT_DEFAULT_MAX_LENGTH, {
      validators: [Validators.min(1), Validators.max(SHORT_TEXT_MAX_LENGTH_LIMIT)],
    }),
    shortTextCaseSensitive: this.formBuilder.control(false),
    shortTextEvaluationMode: this.formBuilder.control<ShortAnswerEvaluationMode>(
      SHORT_TEXT_DEFAULT_EVALUATION_MODE,
    ),
    shortTextToleranceLevel: this.formBuilder.control<ToleranceLevel>(
      SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
    ),
    shortTextAllowPartialCredit: this.formBuilder.control(true),
    shortTextTrimWhitespace: this.formBuilder.control(true),
    shortTextNormalizeWhitespace: this.formBuilder.control(true),
    numericInputKind: this.formBuilder.control<NumericInputKind>(NUMERIC_DEFAULT_INPUT_KIND),
    numericToleranceMode: this.formBuilder.control<QuestionNumericToleranceMode>(
      NUMERIC_DEFAULT_TOLERANCE_MODE,
    ),
    numericAbsoluteTolerance: this.formBuilder.control<number | null>(null, {
      validators: [Validators.min(0)],
    }),
    numericRelativeTolerancePercent: this.formBuilder.control<number | null>(null, {
      validators: [Validators.min(0)],
    }),
    numericUnitFamily: this.formBuilder.control<NumericUnitFamily>(NUMERIC_DEFAULT_UNIT_FAMILY),
    numericRequireUnit: this.formBuilder.control(false),
    numericAcceptEquivalentUnits: this.formBuilder.control(true),
    // Story 1.2d: Numerische Schätzfrage
    numericReferenceValue: this.formBuilder.control<number | null>(null),
    numericTolerancePercent: this.formBuilder.control<number | null>(10),
    numericIntervalLeft: this.formBuilder.control<number | null>(null),
    numericIntervalRight: this.formBuilder.control<number | null>(null),
    numericInputType: this.formBuilder.control<'INTEGER' | 'DECIMAL'>('DECIMAL'),
    numericDecimalPlaces: this.formBuilder.control<number | null>(2),
    numericMin: this.formBuilder.control<number | null>(null),
    numericMax: this.formBuilder.control<number | null>(null),
    numericTwoRounds: this.formBuilder.control<boolean>(false),
    confidenceEnabled: this.formBuilder.control(true),
    confidenceLabelLow: this.formBuilder.control(confidenceDefaultLabelLow(), {
      validators: [Validators.maxLength(50)],
    }),
    confidenceLabelHigh: this.formBuilder.control(confidenceDefaultLabelHigh(), {
      validators: [Validators.maxLength(50)],
    }),
    matchingPairs: this.formBuilder.array<MatchingPairFormGroup>([]),
    matchingShuffleRight: this.formBuilder.control(true),
    orderingItems: this.formBuilder.array<OrderingItemFormGroup>([]),
    categories: this.formBuilder.array<CategorizationCategoryFormGroup>([]),
    categorizationItems: this.formBuilder.array<CategorizationItemFormGroup>([]),
    categorizationShuffleItems: this.formBuilder.control(true),
  });

  readonly settingsForm: QuizSettingsFormGroup = this.formBuilder.group({
    showLeaderboard: this.formBuilder.control(true),
    allowCustomNicknames: this.formBuilder.control(false),
    defaultTimer: this.formBuilder.control<number | null>(null, {
      validators: [Validators.min(5), Validators.max(300)],
    }),
    timerScaleByDifficulty: this.formBuilder.control(true),
    enableSoundEffects: this.formBuilder.control(true),
    enableRewardEffects: this.formBuilder.control(true),
    enableMotivationMessages: this.formBuilder.control(true),
    enableEmojiReactions: this.formBuilder.control(true),
    showQuestionTypeIndicators: this.formBuilder.control(true),
    anonymousMode: this.formBuilder.control(false),
    readingPhaseEnabled: this.formBuilder.control(false),
    teamMode: this.formBuilder.control(false),
    teamCount: this.formBuilder.control<number | null>(DEFAULT_TEAM_COUNT, {
      validators: [Validators.min(2), Validators.max(8)],
    }),
    teamAssignment: this.formBuilder.control<TeamAssignment>('AUTO'),
    teamNamesText: this.formBuilder.control(''),
    nicknameTheme: this.formBuilder.control<NicknameTheme>('HIGH_SCHOOL'),
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
      this.rememberSyncedFormBaseline(quiz);
    }
    if (this.route.snapshot.queryParamMap?.get('from') === 'new') {
      queueMicrotask(() => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { from: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    }
    this.scheduleLivePreview();
    this.localeGuard.register(this.localeDirtyGetter);
    effect(() => {
      const quizDoc = this.quiz();
      const previewActive = this.previewRouteActive();
      if (!quizDoc || !previewActive) return;
      untracked(() => this.syncFormsFromStoreDuringPreview(quizDoc));
    });
  }

  ngOnDestroy(): void {
    this.localeGuard.unregister(this.localeDirtyGetter);
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

  get matchingPairsArray(): FormArray<MatchingPairFormGroup> {
    return this.form.controls.matchingPairs;
  }

  get orderingItemsArray(): FormArray<OrderingItemFormGroup> {
    return this.form.controls.orderingItems;
  }

  get categoriesArray(): FormArray<CategorizationCategoryFormGroup> {
    return this.form.controls.categories;
  }

  get categorizationItemsArray(): FormArray<CategorizationItemFormGroup> {
    return this.form.controls.categorizationItems;
  }

  get shortTextMaxLengthControl(): FormControl<number | null> {
    return this.form.controls.shortTextMaxLength;
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

  /** Kurztext für die Fragenliste: eigenes Limit oder Quiz-Standard. */
  questionTimerDisplay(question: QuizQuestion): string {
    if (question.timer !== null) {
      return `${question.timer} s`;
    }
    return $localize`:@@quiz.edit.questionTimerQuizDefault:Quiz-Standard`;
  }

  isPreviewActive(): boolean {
    return this.route.snapshot.firstChild?.routeConfig?.path === 'preview';
  }

  /** CanDeactivate: Hinweis bei ungespeicherten Änderungen vor dem Verlassen der Edit-Route. */
  async canDeactivate(): Promise<boolean> {
    return this.confirmDiscardPendingChangesIfNeeded();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.localeGuard.isFullPageUnloadConfirmed()) return;
    if (!this.hasPendingChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  hasPendingChanges(): boolean {
    return (
      this.hasUnsavedMetadataChanges() ||
      this.hasUnsavedSettingsChanges() ||
      this.hasUnsavedQuestionChanges()
    );
  }

  onMetadataDescriptionChange(value: string): void {
    const control = this.metadataForm.controls.description;
    control.setValue(value);
    control.markAsDirty();
    control.markAsTouched();
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

  questionTimerUsesQuizDefault(): boolean {
    return this.form.controls.questionTimer.value === null;
  }

  questionTimerSelectOptions(): number[] {
    return mergeTimerPresetOptions(this.form.controls.questionTimer.value);
  }

  onQuestionTimerInheritChange(useQuizDefault: boolean): void {
    const c = this.form.controls.questionTimer;
    if (useQuizDefault) {
      c.setValue(null);
    } else {
      if (c.value === null) {
        const fallback = this.quiz()?.settings.defaultTimer ?? DEFAULT_TIMER_SECONDS;
        c.setValue(fallback);
      }
    }
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
        showQuestionTypeIndicators: values.showQuestionTypeIndicators ?? true,
        anonymousMode: values.anonymousMode ?? false,
        allowCustomNicknames: values.allowCustomNicknames ?? false,
        nicknameTheme: values.nicknameTheme ?? 'HIGH_SCHOOL',
        readingPhaseEnabled: values.readingPhaseEnabled ?? false,
        defaultTimer: values.defaultTimer ?? null,
        preset,
      },
      { emitEvent: false },
    );
    this.settingsForm.markAsDirty();
  }

  hasAnswerOptions(): boolean {
    const t = this.typeControl.value;
    return (
      t !== 'FREETEXT' &&
      t !== 'RATING' &&
      t !== 'NUMERIC_ESTIMATE' &&
      t !== 'MATCHING' &&
      t !== 'ORDERING' &&
      t !== 'CATEGORIZATION'
    );
  }

  isNumericEstimateType(): boolean {
    return this.typeControl.value === 'NUMERIC_ESTIMATE';
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

  isShortTextType(): boolean {
    return this.typeControl.value === 'SHORT_TEXT';
  }

  showDifficultySelection(): boolean {
    return this.questionTypeShowsDifficulty(this.typeControl.value);
  }

  isRatingType(): boolean {
    return this.typeControl.value === 'RATING';
  }

  isMatchingType(): boolean {
    return this.typeControl.value === 'MATCHING';
  }

  isOrderingType(): boolean {
    return this.typeControl.value === 'ORDERING';
  }

  isCategorizationType(): boolean {
    return this.typeControl.value === 'CATEGORIZATION';
  }

  hasRatingConfig(): boolean {
    return this.isRatingType();
  }

  hasMatchingConfig(): boolean {
    return this.isMatchingType();
  }

  hasOrderingConfig(): boolean {
    return this.isOrderingType();
  }

  hasCategorizationConfig(): boolean {
    return this.isCategorizationType();
  }

  hasConfidenceConfig(): boolean {
    return questionSupportsConfidence(this.typeControl.value);
  }

  readonly confidenceLabelLowPlaceholder = confidenceDefaultLabelLow();
  readonly confidenceLabelHighPlaceholder = confidenceDefaultLabelHigh();

  questionTypeSupportsConfidence(type: SupportedQuestionType): boolean {
    return questionSupportsConfidence(type);
  }

  confidenceSteps(): number[] {
    return this.ratingSteps(CONFIDENCE_SCALE_MIN, CONFIDENCE_SCALE_MAX);
  }

  confidencePreviewLabelLow(): string {
    return resolveConfidenceLabelLow(this.form.controls.confidenceLabelLow.value);
  }

  confidencePreviewLabelHigh(): string {
    return resolveConfidenceLabelHigh(this.form.controls.confidenceLabelHigh.value);
  }

  confidenceLabelForQuestion(
    question: { confidenceLabelLow?: string | null; confidenceLabelHigh?: string | null },
    bound: 'low' | 'high',
  ): string {
    return bound === 'low'
      ? resolveConfidenceLabelLow(question.confidenceLabelLow)
      : resolveConfidenceLabelHigh(question.confidenceLabelHigh);
  }

  onConfidenceEnabledChanged(): void {
    if (this.form.controls.confidenceEnabled.value) {
      this.applyConfidenceLabelDefaultsIfEmpty();
    }
    this.onLivePreviewInput();
  }

  private applyConfidenceLabelDefaultsIfEmpty(): void {
    if (!this.form.controls.confidenceLabelLow.value.trim()) {
      this.form.controls.confidenceLabelLow.setValue(confidenceDefaultLabelLow());
    }
    if (!this.form.controls.confidenceLabelHigh.value.trim()) {
      this.form.controls.confidenceLabelHigh.setValue(confidenceDefaultLabelHigh());
    }
  }

  confidencePreviewAriaLabel(): string {
    const low = this.confidencePreviewLabelLow();
    const high = this.confidencePreviewLabelHigh();
    if (low && high) {
      return $localize`:@@quizEdit.confidencePreviewAriaWithLabels:Fünfstufige Skala von 1 bis 5, niedrig: ${low}:low:, hoch: ${high}:high:`;
    }
    if (low) {
      return $localize`:@@quizEdit.confidencePreviewAriaWithLow:Fünfstufige Skala von 1 bis 5, niedrig: ${low}:low:`;
    }
    if (high) {
      return $localize`:@@quizEdit.confidencePreviewAriaWithHigh:Fünfstufige Skala von 1 bis 5, hoch: ${high}:high:`;
    }
    return $localize`:@@quizEdit.confidencePreviewAria:Fünfstufige Skala von 1 bis 5`;
  }

  hasShortTextConfig(): boolean {
    return this.isShortTextType();
  }

  isShortTextNumericMode(): boolean {
    return usesNumericShortTextEvaluation(this.form.controls.shortTextEvaluationKind.value);
  }

  isShortTextUnitMode(): boolean {
    return usesShortTextUnitEvaluation(this.form.controls.shortTextEvaluationKind.value);
  }

  onShortTextEvaluationKindChanged(): void {
    if (
      this.form.controls.shortTextEvaluationKind.value === 'numeric_unit' &&
      this.form.controls.numericUnitFamily.value === NUMERIC_DEFAULT_UNIT_FAMILY
    ) {
      this.form.controls.numericUnitFamily.setValue('length');
    }
    this.scheduleLivePreview();
  }

  questionTypeHasCorrectAnswers(type: SupportedQuestionType): boolean {
    return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
  }

  questionTypeShowsDifficulty(type: SupportedQuestionType): boolean {
    return type !== 'SURVEY' && type !== 'RATING';
  }

  hasNumericConfig(): boolean {
    return this.isNumericEstimateType();
  }

  numericIsRelativeMode(): boolean {
    return this.form.controls.numericToleranceMode.value === 'RELATIVE_PERCENT';
  }

  numericIsAbsoluteMode(): boolean {
    return this.form.controls.numericToleranceMode.value === 'ABSOLUTE_INTERVAL';
  }

  numericIsDecimalInput(): boolean {
    return this.form.controls.numericInputType.value === 'DECIMAL';
  }

  applyNumericEstimatePreset(value: NumericEstimatePresetValue): void {
    const controls = this.form.controls;
    switch (value) {
      case 'year':
        controls.numericInputType.setValue('INTEGER');
        controls.numericDecimalPlaces.setValue(null);
        controls.numericToleranceMode.setValue('ABSOLUTE_INTERVAL');
        controls.numericReferenceValue.setValue(1789);
        controls.numericTolerancePercent.setValue(null);
        controls.numericIntervalLeft.setValue(1700);
        controls.numericIntervalRight.setValue(1900);
        controls.numericMin.setValue(1500);
        controls.numericMax.setValue(2000);
        controls.numericTwoRounds.setValue(true);
        break;
      case 'measurement':
        controls.numericInputType.setValue('DECIMAL');
        controls.numericDecimalPlaces.setValue(1);
        controls.numericToleranceMode.setValue('ABSOLUTE_INTERVAL');
        controls.numericReferenceValue.setValue(100);
        controls.numericTolerancePercent.setValue(null);
        controls.numericIntervalLeft.setValue(95);
        controls.numericIntervalRight.setValue(105);
        controls.numericMin.setValue(0);
        controls.numericMax.setValue(200);
        controls.numericTwoRounds.setValue(true);
        break;
      case 'percent':
        controls.numericInputType.setValue('INTEGER');
        controls.numericDecimalPlaces.setValue(null);
        controls.numericToleranceMode.setValue('ABSOLUTE_INTERVAL');
        controls.numericReferenceValue.setValue(50);
        controls.numericTolerancePercent.setValue(null);
        controls.numericIntervalLeft.setValue(45);
        controls.numericIntervalRight.setValue(55);
        controls.numericMin.setValue(0);
        controls.numericMax.setValue(100);
        controls.numericTwoRounds.setValue(false);
        break;
      case 'magnitude':
        controls.numericInputType.setValue('INTEGER');
        controls.numericDecimalPlaces.setValue(null);
        controls.numericToleranceMode.setValue('RELATIVE_PERCENT');
        controls.numericReferenceValue.setValue(1_000_000);
        controls.numericTolerancePercent.setValue(20);
        controls.numericIntervalLeft.setValue(null);
        controls.numericIntervalRight.setValue(null);
        controls.numericMin.setValue(0);
        controls.numericMax.setValue(10_000_000);
        controls.numericTwoRounds.setValue(true);
        break;
    }
    this.form.markAsDirty();
    this.scheduleLivePreview();
  }

  numericEstimateConfigPreview(): NumericEstimateConfigPreview | null {
    if (!this.isNumericEstimateType()) return null;

    const band = resolveNumericTolerance(
      resolveNumericEstimateToleranceMode(this.form.controls.numericToleranceMode.value),
      {
        referenceValue: this.form.controls.numericReferenceValue.value,
        tolerancePercent: this.form.controls.numericTolerancePercent.value,
        intervalLeft: this.form.controls.numericIntervalLeft.value,
        intervalRight: this.form.controls.numericIntervalRight.value,
      },
    );
    const min = this.form.controls.numericMin.value;
    const max = this.form.controls.numericMax.value;
    const reference = this.form.controls.numericReferenceValue.value;
    const values = [min, max, band?.left, band?.right, reference].filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value),
    );

    if (values.length === 0) {
      return null;
    }

    let rangeMin = Math.min(...values);
    let rangeMax = Math.max(...values);
    if (rangeMin === rangeMax) {
      rangeMin -= 1;
      rangeMax += 1;
    }

    const valuePosition = (value: number): number =>
      Math.min(100, Math.max(0, ((value - rangeMin) / (rangeMax - rangeMin)) * 100));
    const toleranceStyle =
      band && band.right >= rangeMin && band.left <= rangeMax
        ? {
            left: valuePosition(Math.max(band.left, rangeMin)),
            width: Math.max(
              1,
              valuePosition(Math.min(band.right, rangeMax)) -
                valuePosition(Math.max(band.left, rangeMin)),
            ),
          }
        : null;
    const referenceStyle =
      typeof reference === 'number' && reference >= rangeMin && reference <= rangeMax
        ? { left: valuePosition(reference) }
        : null;

    return {
      rangeMinLabel: this.formatNumericEstimateEditorValue(rangeMin),
      rangeMaxLabel: this.formatNumericEstimateEditorValue(rangeMax),
      toleranceLabel: band
        ? $localize`:@@quizEdit.numericPreviewToleranceLabel:Toleranzband ${this.formatNumericEstimateEditorValue(
            band.left,
          )}:left: bis ${this.formatNumericEstimateEditorValue(band.right)}:right:`
        : null,
      plausibilityLabel: this.numericEstimatePlausibilityLabel(min, max),
      referenceLabel:
        typeof reference === 'number'
          ? $localize`:@@quizEdit.numericPreviewReferenceLabel:Referenz ${this.formatNumericEstimateEditorValue(
              reference,
            )}:reference:`
          : null,
      toleranceStyle,
      referenceStyle,
      note: this.numericEstimatePreviewNote(band, min, max),
    };
  }

  private numericEstimatePreviewNote(
    band: { left: number; right: number } | null,
    min: number | null,
    max: number | null,
  ): string {
    if (!band) {
      return $localize`:@@quizEdit.numericPreviewIncomplete:Toleranzband wird angezeigt, sobald Grenzen oder Referenz und Prozentwert vollständig sind.`;
    }
    if (
      typeof min === 'number' &&
      typeof max === 'number' &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      (band.left < min || band.right > max)
    ) {
      return $localize`:@@quizEdit.numericPreviewToleranceOutside:Plausibilitätsgrenzen und Toleranzband passen noch nicht zusammen. Werte im Band sollten auch eingebbar sein.`;
    }
    return $localize`:@@quizEdit.numericPreviewReady:Plausibilität begrenzt erlaubte Eingaben; das Toleranzband entscheidet über Punkte.`;
  }

  private numericEstimatePlausibilityLabel(min: number | null, max: number | null): string | null {
    const hasMin = typeof min === 'number' && Number.isFinite(min);
    const hasMax = typeof max === 'number' && Number.isFinite(max);
    if (hasMin && hasMax) {
      return $localize`:@@quizEdit.numericPreviewPlausibilityRange:Plausibilität ${this.formatNumericEstimateEditorValue(
        min,
      )}:min: bis ${this.formatNumericEstimateEditorValue(max)}:max:`;
    }
    if (hasMin) {
      return $localize`:@@quizEdit.numericPreviewPlausibilityMin:Plausibilität ab ${this.formatNumericEstimateEditorValue(
        min,
      )}:min:`;
    }
    if (hasMax) {
      return $localize`:@@quizEdit.numericPreviewPlausibilityMax:Plausibilität bis ${this.formatNumericEstimateEditorValue(
        max,
      )}:max:`;
    }
    return null;
  }

  private formatNumericEstimateEditorValue(value: number): string {
    if (this.numericEstimateEditorUsesYearFormat()) {
      return new Intl.NumberFormat(this.localeId, {
        maximumFractionDigits: 0,
        useGrouping: false,
      }).format(value);
    }
    const digits =
      this.form.controls.numericInputType.value === 'INTEGER'
        ? '1.0-0'
        : `1.0-${Math.max(0, Math.min(4, this.form.controls.numericDecimalPlaces.value ?? 2))}`;
    return formatNumber(value, this.localeId, digits);
  }

  private numericEstimateEditorUsesYearFormat(): boolean {
    if (this.form.controls.numericInputType.value !== 'INTEGER') return false;
    const text = this.textControl.value;
    if (/\b(jahr|jahreszahl|year|année|annee|año|ano|anno|wann)\b/i.test(text)) {
      return true;
    }
    const min = this.form.controls.numericMin.value;
    const max = this.form.controls.numericMax.value;
    return (
      typeof min === 'number' &&
      typeof max === 'number' &&
      min >= 1000 &&
      max <= 2200 &&
      max - min <= 1000
    );
  }

  renderMarkdown(value: string | null | undefined): SafeHtml {
    const source = value ?? '';
    const cached = this.markdownCache.get(source);
    if (cached) {
      return cached;
    }
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(source, {
        imagePolicy: 'allow-relative-and-https',
        headingStartLevel: 3,
      }).html,
    );
    this.markdownCache.set(source, rendered);
    return rendered;
  }

  renderAnswerMarkdown(value: string | null | undefined): SafeHtml {
    const source = value ?? '';
    const cached = this.answerMarkdownCache.get(source);
    if (cached) {
      return cached;
    }
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      decorateLeadingAnswerEmoji(
        renderMarkdownWithKatex(source, {
          imagePolicy: 'allow-relative-and-https',
          headingStartLevel: 4,
        }).html,
      ),
    );
    this.answerMarkdownCache.set(source, rendered);
    return rendered;
  }

  previewAnswerColor(index: number): string {
    return answerOptionColor(index);
  }

  previewAnswerShape(index: number): string {
    return answerOptionShape(
      index,
      this.typeControl.value,
      this.settingsForm.controls.showQuestionTypeIndicators.value,
    );
  }

  showQuestionTypeIndicators(): boolean {
    return this.settingsForm.controls.showQuestionTypeIndicators.value;
  }

  answerEditorLabel(index: number): string {
    if (this.isShortTextType()) {
      return $localize`:@@quizEdit.shortTextSolutionLabel:Musterlösung ${index + 1}:solutionNumber:`;
    }

    return $localize`:@@quizEdit.answerLabel:Antwort ${index + 1}:answerNumber:`;
  }

  markSingleCorrectAriaLabel(answerNumber: number): string {
    return $localize`:@@quizEdit.markAnswerCorrectAria:Antwort ${answerNumber}:answerNumber: als richtig markieren`;
  }

  toggleMultipleCorrectAriaLabel(answerNumber: number): string {
    return $localize`:@@quizEdit.toggleAnswerCorrectAria:Antwort ${answerNumber}:answerNumber: richtig`;
  }

  removeAnswerAriaLabel(answerNumber: number): string {
    return $localize`:@@quizEdit.removeAnswerAria:Antwort ${answerNumber}:answerNumber: entfernen`;
  }

  questionExpandAriaLabel(expanded: boolean): string {
    return expanded
      ? $localize`:@@quizEdit.collapseQuestionAria:Frage zuklappen`
      : $localize`:@@quizEdit.expandQuestionAria:Frage aufklappen`;
  }

  answerPreviewLabel(): string {
    return this.isShortTextType()
      ? $localize`:@@quizEdit.shortTextSolutionsPreviewLabel:Musterlösungen`
      : $localize`:@@quizEdit.livePreviewAnswersLabel:Antworten`;
  }

  addAnswerButtonLabel(): string {
    return this.isShortTextType()
      ? $localize`:@@quizEdit.addShortTextSolution:Weitere Musterlösung`
      : $localize`Weitere Antwort`;
  }

  shortTextEvaluationModeLabel(mode: ShortAnswerEvaluationMode | null | undefined): string {
    return (
      this.shortTextEvaluationModeOptions.find((option) => option.value === mode)?.label ??
      this.shortTextEvaluationModeOptions.find(
        (option) => option.value === SHORT_TEXT_DEFAULT_EVALUATION_MODE,
      )?.label ??
      mode ??
      SHORT_TEXT_DEFAULT_EVALUATION_MODE
    );
  }

  shortTextToleranceLabel(level: ToleranceLevel | null | undefined): string {
    return (
      this.shortTextToleranceOptions.find((option) => option.value === level)?.label ??
      this.shortTextToleranceOptions.find(
        (option) => option.value === SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
      )?.label ??
      level ??
      SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL
    );
  }

  shortTextSelectedEvaluationHint(): string {
    const evaluationKind = resolveShortTextEvaluationKind(
      this.form.controls.shortTextEvaluationKind.value,
    );
    if (evaluationKind !== 'text') {
      return (
        this.shortTextEvaluationKindOptions.find((option) => option.value === evaluationKind)
          ?.hint ?? ''
      );
    }

    return (
      this.shortTextEvaluationModeOptions.find(
        (option) => option.value === this.form.controls.shortTextEvaluationMode.value,
      )?.hint ?? ''
    );
  }

  shortTextEvaluationKindLabel(kind: ShortTextEvaluationKind | null | undefined): string {
    return (
      this.shortTextEvaluationKindOptions.find((option) => option.value === kind)?.label ??
      this.shortTextEvaluationKindOptions.find(
        (option) => option.value === SHORT_TEXT_DEFAULT_EVALUATION_KIND,
      )?.label ??
      kind ??
      SHORT_TEXT_DEFAULT_EVALUATION_KIND
    );
  }

  numericInputKindLabel(kind: NumericInputKind | null | undefined): string {
    return (
      this.numericInputKindOptions.find((option) => option.value === kind)?.label ??
      this.numericInputKindOptions.find((option) => option.value === NUMERIC_DEFAULT_INPUT_KIND)
        ?.label ??
      kind ??
      NUMERIC_DEFAULT_INPUT_KIND
    );
  }

  numericToleranceModeLabel(mode: NumericToleranceMode | null | undefined): string {
    return (
      this.numericToleranceModeOptions.find((option) => option.value === mode)?.label ??
      this.numericToleranceModeOptions.find(
        (option) => option.value === NUMERIC_DEFAULT_TOLERANCE_MODE,
      )?.label ??
      mode ??
      NUMERIC_DEFAULT_TOLERANCE_MODE
    );
  }

  numericUnitFamilyLabel(family: NumericUnitFamily | null | undefined): string {
    return (
      this.numericUnitFamilyOptions.find((option) => option.value === family)?.label ??
      family ??
      NUMERIC_DEFAULT_UNIT_FAMILY
    );
  }

  shortTextConfigSummary(
    question: Pick<
      QuizQuestion,
      | 'shortTextEvaluationKind'
      | 'shortTextMaxLength'
      | 'shortTextCaseSensitive'
      | 'shortTextEvaluationMode'
      | 'shortTextToleranceLevel'
      | 'shortTextAllowPartialCredit'
      | 'shortTextTrimWhitespace'
      | 'shortTextNormalizeWhitespace'
      | 'numericInputKind'
      | 'numericToleranceMode'
      | 'numericAbsoluteTolerance'
      | 'numericRelativeTolerancePercent'
      | 'numericUnitFamily'
      | 'numericRequireUnit'
      | 'numericAcceptEquivalentUnits'
    >,
  ): string {
    const evaluationKind = resolveShortTextEvaluationKind(question.shortTextEvaluationKind);
    if (evaluationKind !== 'text') {
      const numericSettings = resolveNumericQuestionEvaluationSettings({
        numericInputKind: question.numericInputKind ?? null,
        numericToleranceMode: isNumericToleranceMode(question.numericToleranceMode)
          ? question.numericToleranceMode
          : null,
        numericAbsoluteTolerance: question.numericAbsoluteTolerance ?? null,
        numericRelativeTolerancePercent: question.numericRelativeTolerancePercent ?? null,
        numericUnitFamily: question.numericUnitFamily ?? null,
        numericRequireUnit: question.numericRequireUnit ?? false,
        numericAcceptEquivalentUnits: question.numericAcceptEquivalentUnits ?? true,
      });
      const parts = [
        $localize`:@@quizEdit.shortTextMaxLengthSummary:Max. ${resolveShortTextMaxLength(question.shortTextMaxLength)}:maxLength: Zeichen`,
        this.shortTextEvaluationKindLabel(evaluationKind),
        this.numericInputKindLabel(numericSettings.inputKind),
        this.numericToleranceModeLabel(numericSettings.toleranceMode),
      ];

      if (
        numericSettings.toleranceMode === 'absolute' &&
        numericSettings.absoluteTolerance !== null
      ) {
        parts.push(
          $localize`:@@quizEdit.numericToleranceAbsoluteSummary:±${numericSettings.absoluteTolerance}:tolerance: absolut`,
        );
      }
      if (
        numericSettings.toleranceMode === 'relative' &&
        numericSettings.relativeTolerancePercent !== null
      ) {
        parts.push(
          $localize`:@@quizEdit.numericToleranceRelativeSummary:±${numericSettings.relativeTolerancePercent}:tolerance: % relativ`,
        );
      }

      if (evaluationKind === 'numeric_unit') {
        parts.push(
          $localize`:@@quizEdit.numericUnitFamilySummary:Einheiten: ${this.numericUnitFamilyLabel(numericSettings.unitFamily)}:unitFamily:`,
        );
        parts.push(
          numericSettings.requireUnit
            ? $localize`:@@quizEdit.numericRequireUnitSummary:Einheit erforderlich`
            : $localize`:@@quizEdit.numericUnitOptionalSummary:Einheit optional`,
        );
        parts.push(
          numericSettings.acceptEquivalentUnits
            ? $localize`:@@quizEdit.numericEquivalentUnitsSummary:Äquivalente Einheiten erlaubt`
            : $localize`:@@quizEdit.numericExactUnitsSummary:Nur exakt angegebene Einheit`,
        );
      }

      return parts.join(' · ');
    }

    const parts = [
      $localize`:@@quizEdit.shortTextMaxLengthSummary:Max. ${resolveShortTextMaxLength(question.shortTextMaxLength)}:maxLength: Zeichen`,
      this.shortTextEvaluationModeLabel(question.shortTextEvaluationMode),
    ];
    if ((question.shortTextEvaluationMode ?? SHORT_TEXT_DEFAULT_EVALUATION_MODE) !== 'exact') {
      parts.push(
        $localize`:@@quizEdit.shortTextToleranceSummary:Toleranz: ${this.shortTextToleranceLabel(question.shortTextToleranceLevel)}:tolerance:`,
      );
    }
    if (question.shortTextCaseSensitive) {
      parts.push($localize`:@@quizEdit.shortTextCaseSensitiveSummary:Groß-/Kleinschreibung zählt`);
    }
    if ((question.shortTextAllowPartialCredit ?? true) === false) {
      parts.push($localize`:@@quizEdit.shortTextFullCreditOnlySummary:Nur volle Punkte`);
    }
    if (
      (question.shortTextTrimWhitespace ?? true) === false ||
      (question.shortTextNormalizeWhitespace ?? true) === false
    ) {
      parts.push(
        $localize`:@@quizEdit.shortTextWhitespaceStrictSummary:Leerzeichen werden streng geprüft`,
      );
    }
    return parts.join(' · ');
  }

  shortTextDidacticWarning(): string {
    if (this.isShortTextNumericMode()) {
      return this.isShortTextUnitMode()
        ? $localize`:@@quizEdit.shortTextDidacticWarningNumericUnit:Lege mindestens eine Referenzlösung mit Einheit fest, halte das Einheitenset klein und aktiviere Pflicht-Einheiten nur, wenn die Einheit fachlich wirklich bewertet werden soll.`
        : $localize`:@@quizEdit.shortTextDidacticWarningNumeric:Lege mindestens eine klare Referenzzahl fest und wähle die Toleranz so, dass sie Rechenungenauigkeit erlaubt, aber fachlich falsche Werte klar ausschließt.`;
    }

    return $localize`:@@quizEdit.shortTextDidacticWarning:Verwende tolerante Bewertung nur bei eindeutigen Fachbegriffen. Für offene Formulierungen sind mehrere Musterlösungen meist fairer als hohe Toleranz.`;
  }

  shortTextSolutionsHint(): string {
    if (!this.isShortTextType()) {
      return '';
    }

    return this.isShortTextNumericMode()
      ? this.isShortTextUnitMode()
        ? $localize`:@@quizEdit.shortTextSolutionsHintNumericUnit:Hinterlege mindestens eine und höchstens zehn Referenzlösungen mit unterstützter Einheit, zum Beispiel „2 m“.`
        : $localize`:@@quizEdit.shortTextSolutionsHintNumeric:Hinterlege mindestens eine und höchstens zehn Referenzlösungen als Zahl, zum Beispiel „3,5“.`
      : $localize`:@@quizEdit.shortTextSolutionsHint:Hinterlege mindestens eine und höchstens zehn Musterlösungen. Alle Varianten gelten als richtige Kurzantwort.`;
  }

  shortTextPreviewExamples(): ShortTextPreviewExample[] {
    if (!this.isShortTextType()) {
      return [];
    }

    const modelAnswers = this.answersArray.controls
      .map((answer) => answer.controls.text.value.trim())
      .filter((answer) => answer.length > 0);
    if (modelAnswers.length === 0) {
      return [];
    }

    if (this.isShortTextNumericMode()) {
      return this.numericShortTextPreviewExamples(modelAnswers);
    }

    const baseAnswer = modelAnswers[0]!;
    const examples = [
      {
        label: $localize`:@@quizEdit.shortTextPreviewExactLabel:Exakte Eingabe`,
        studentAnswer: baseAnswer,
      },
      {
        label: this.shortTextEvaluationModeLabel('hamming'),
        studentAnswer: this.createShortTextTranspositionExample(baseAnswer),
      },
      {
        label: $localize`:@@quizEdit.shortTextPreviewLengthLabel:Fehlendes oder zusätzliches Zeichen`,
        studentAnswer: this.createShortTextLengthVariation(baseAnswer),
      },
      {
        label: $localize`:@@quizEdit.shortTextPreviewWrongLabel:Anderer Begriff`,
        studentAnswer: this.createShortTextWrongExample(baseAnswer, modelAnswers),
      },
    ];

    const seenExamples = new Set<string>();
    return examples
      .filter((example) => {
        if (!example.studentAnswer.trim() || seenExamples.has(example.studentAnswer)) {
          return false;
        }
        seenExamples.add(example.studentAnswer);
        return true;
      })
      .map((example) => {
        const result = evaluateShortAnswer({
          modelAnswers,
          studentAnswer: example.studentAnswer,
          maxPoints: 100,
          maxLength: resolveShortTextMaxLength(this.form.controls.shortTextMaxLength.value),
          settings: {
            caseSensitive: this.form.controls.shortTextCaseSensitive.value,
            evaluationMode: this.form.controls.shortTextEvaluationMode.value,
            toleranceLevel: this.form.controls.shortTextToleranceLevel.value,
            allowPartialCredit: this.form.controls.shortTextAllowPartialCredit.value,
            trimWhitespace: this.form.controls.shortTextTrimWhitespace.value,
            normalizeWhitespace: this.form.controls.shortTextNormalizeWhitespace.value,
          },
        });

        let outcome: string;
        let tone: ShortTextPreviewExample['tone'];
        if (result.points >= result.maxPoints && result.maxPoints > 0) {
          outcome =
            result.normalizedDistance === 0
              ? $localize`:@@quizEdit.shortTextPreviewOutcomeFull:Volle Punkte`
              : $localize`:@@quizEdit.shortTextPreviewOutcomeAccepted:Akzeptiert`;
          tone = 'full';
        } else if (result.points > 0) {
          outcome = $localize`:@@quizEdit.shortTextPreviewOutcomePartial:Teilpunkte (${result.points}:points: %)`;
          tone = 'partial';
        } else {
          outcome = $localize`:@@quizEdit.shortTextPreviewOutcomeRejected:Nicht akzeptiert`;
          tone = 'rejected';
        }

        return {
          label: example.label,
          studentAnswer: example.studentAnswer,
          outcome,
          tone,
        };
      });
  }

  private numericShortTextPreviewExamples(modelAnswers: string[]): ShortTextPreviewExample[] {
    const baseAnswer = modelAnswers[0]!;
    const parsedBase = parseNumericPreviewAnswer(baseAnswer);
    if (!parsedBase) {
      return [];
    }

    const examples: Array<{ label: string; studentAnswer: string }> = [
      {
        label: $localize`:@@quizEdit.shortTextPreviewExactLabel:Exakte Eingabe`,
        studentAnswer: baseAnswer,
      },
    ];

    const withinTolerance = this.createNumericTolerancePreview(parsedBase);
    if (withinTolerance && withinTolerance !== baseAnswer) {
      examples.push({
        label: $localize`:@@quizEdit.shortTextPreviewNumericToleranceLabel:Innerhalb der Toleranz`,
        studentAnswer: withinTolerance,
      });
    }

    if (this.isShortTextUnitMode()) {
      const equivalentUnit = this.createEquivalentUnitPreview(parsedBase);
      if (equivalentUnit && equivalentUnit !== baseAnswer) {
        examples.push({
          label: $localize`:@@quizEdit.shortTextPreviewEquivalentUnitLabel:Äquivalente Einheit`,
          studentAnswer: equivalentUnit,
        });
      }

      examples.push({
        label: $localize`:@@quizEdit.shortTextPreviewMissingUnitLabel:Fehlende Einheit`,
        studentAnswer: formatNumericPreviewValue(parsedBase.value, parsedBase.decimalSeparator),
      });
    }

    examples.push({
      label: $localize`:@@quizEdit.shortTextPreviewWrongLabel:Klar falscher Wert`,
      studentAnswer: this.createWrongNumericPreview(parsedBase),
    });

    const settings = this.resolveCurrentNumericPreviewSettings();
    return examples.map((example) => {
      const result = evaluateNumericAnswer({
        modelAnswers,
        studentAnswer: example.studentAnswer,
        maxPoints: 100,
        settings,
      });

      let outcome: string;
      let tone: ShortTextPreviewExample['tone'];
      if (result.points >= result.maxPoints && result.maxPoints > 0) {
        outcome =
          result.feedbackCategory === 'exact_match'
            ? $localize`:@@quizEdit.shortTextPreviewOutcomeFull:Volle Punkte`
            : $localize`:@@quizEdit.shortTextPreviewOutcomeAccepted:Akzeptiert`;
        tone = 'full';
      } else if (result.points > 0) {
        outcome = $localize`:@@quizEdit.shortTextPreviewOutcomePartial:Teilpunkte (${result.points}:points: %) `;
        tone = 'partial';
      } else {
        outcome = $localize`:@@quizEdit.shortTextPreviewOutcomeRejected:Nicht akzeptiert`;
        tone = 'rejected';
      }

      return {
        label: example.label,
        studentAnswer: example.studentAnswer,
        outcome: outcome.trim(),
        tone,
      };
    });
  }

  private resolveCurrentNumericPreviewSettings() {
    const evaluationKind = resolveShortTextEvaluationKind(
      this.form.controls.shortTextEvaluationKind.value,
    );
    const numericSettings = resolveNumericQuestionEvaluationSettings({
      numericInputKind: this.form.controls.numericInputKind.value,
      numericToleranceMode: isNumericToleranceMode(this.form.controls.numericToleranceMode.value)
        ? this.form.controls.numericToleranceMode.value
        : NUMERIC_DEFAULT_TOLERANCE_MODE,
      numericAbsoluteTolerance: this.form.controls.numericAbsoluteTolerance.value,
      numericRelativeTolerancePercent: this.form.controls.numericRelativeTolerancePercent.value,
      numericUnitFamily: this.form.controls.numericUnitFamily.value,
      numericRequireUnit: this.form.controls.numericRequireUnit.value,
      numericAcceptEquivalentUnits: this.form.controls.numericAcceptEquivalentUnits.value,
    });

    return {
      inputKind: numericSettings.inputKind,
      toleranceMode: numericSettings.toleranceMode,
      absoluteTolerance: numericSettings.absoluteTolerance,
      relativeTolerancePercent: numericSettings.relativeTolerancePercent,
      unitFamily: evaluationKind === 'numeric_unit' ? numericSettings.unitFamily : 'none',
      requireUnit: evaluationKind === 'numeric_unit' ? numericSettings.requireUnit : false,
      acceptEquivalentUnits:
        evaluationKind === 'numeric_unit' ? numericSettings.acceptEquivalentUnits : true,
    };
  }

  private createNumericTolerancePreview(parsedBase: ParsedNumericPreviewAnswer): string | null {
    const toleranceMode = isNumericToleranceMode(this.form.controls.numericToleranceMode.value)
      ? this.form.controls.numericToleranceMode.value
      : NUMERIC_DEFAULT_TOLERANCE_MODE;
    let nextValue = parsedBase.value;

    if (toleranceMode === 'absolute') {
      const tolerance = this.form.controls.numericAbsoluteTolerance.value ?? 0;
      if (tolerance <= 0) {
        return null;
      }
      nextValue += tolerance / 2;
    } else if (toleranceMode === 'relative') {
      const relativeTolerance = this.form.controls.numericRelativeTolerancePercent.value ?? 0;
      if (relativeTolerance <= 0) {
        return null;
      }
      const delta = Math.max(Math.abs(parsedBase.value) * (relativeTolerance / 200), 0.1);
      nextValue += delta;
    } else {
      return null;
    }

    return this.formatNumericPreviewAnswer(nextValue, parsedBase.unit, parsedBase.decimalSeparator);
  }

  private createEquivalentUnitPreview(parsedBase: ParsedNumericPreviewAnswer): string | null {
    if (!parsedBase.unitFamily || !parsedBase.unit || !parsedBase.factor) {
      return null;
    }

    const unitEntries = Object.entries(NUMERIC_PREVIEW_UNIT_FACTORS[parsedBase.unitFamily]).filter(
      ([unit]) => unit !== parsedBase.unit,
    );
    const canonicalValue = parsedBase.value * parsedBase.factor;
    for (const [unit, factor] of unitEntries) {
      const converted = canonicalValue / factor;
      if (!Number.isFinite(converted)) {
        continue;
      }
      if (Math.abs(converted) >= 0.1 && Math.abs(converted) < 10_000) {
        return this.formatNumericPreviewAnswer(converted, unit, parsedBase.decimalSeparator);
      }
    }

    return null;
  }

  private createWrongNumericPreview(parsedBase: ParsedNumericPreviewAnswer): string {
    const toleranceMode = isNumericToleranceMode(this.form.controls.numericToleranceMode.value)
      ? this.form.controls.numericToleranceMode.value
      : NUMERIC_DEFAULT_TOLERANCE_MODE;
    let nextValue: number;

    if (toleranceMode === 'absolute') {
      const tolerance = this.form.controls.numericAbsoluteTolerance.value ?? 0;
      nextValue = parsedBase.value + Math.max(tolerance + Math.max(tolerance / 2, 0.5), 1);
    } else if (toleranceMode === 'relative') {
      const relativeTolerance = this.form.controls.numericRelativeTolerancePercent.value ?? 0;
      const delta = Math.max(Math.abs(parsedBase.value) * ((relativeTolerance + 20) / 100), 1);
      nextValue = parsedBase.value + delta;
    } else if (this.form.controls.numericInputKind.value === 'integer') {
      nextValue = parsedBase.value + 1;
    } else {
      nextValue = parsedBase.value + 0.5;
    }

    return this.formatNumericPreviewAnswer(nextValue, parsedBase.unit, parsedBase.decimalSeparator);
  }

  private formatNumericPreviewAnswer(
    value: number,
    unit: string | null,
    decimalSeparator: ',' | '.' | null,
  ): string {
    const formattedValue = formatNumericPreviewValue(value, decimalSeparator);
    return unit ? `${formattedValue} ${unit}` : formattedValue;
  }

  private createShortTextTranspositionExample(value: string): string {
    if (value.length < 2) {
      return value;
    }

    const characters = [...value];
    let swapIndex = -1;

    for (let index = 1; index < characters.length - 1; index += 1) {
      const current = characters[index];
      const next = characters[index + 1];
      if (current && next && /\S/u.test(current) && /\S/u.test(next) && current !== next) {
        swapIndex = index;
        break;
      }
    }

    if (swapIndex === -1) {
      swapIndex = 0;
    }

    [characters[swapIndex], characters[swapIndex + 1]] = [
      characters[swapIndex + 1]!,
      characters[swapIndex]!,
    ];

    return characters.join('');
  }

  private createShortTextLengthVariation(value: string): string {
    if (value.length >= 5) {
      return value.slice(0, -1);
    }
    return `${value}x`;
  }

  private createShortTextWrongExample(value: string, modelAnswers: string[]): string {
    const candidates = ['andere Antwort', 'ganz falsch', `${value}???`];
    return (
      candidates.find((candidate) => !modelAnswers.includes(candidate) && candidate !== value) ??
      `${value}??`
    );
  }

  private resolveShortTextQuestionSettings(question: {
    type: string;
    shortTextEvaluationKind?: ShortTextEvaluationKind | null;
    shortTextMaxLength?: number | null;
    shortTextCaseSensitive?: boolean | null;
    shortTextEvaluationMode?: ShortAnswerEvaluationMode | null;
    shortTextToleranceLevel?: ToleranceLevel | null;
    shortTextAllowPartialCredit?: boolean | null;
    shortTextTrimWhitespace?: boolean | null;
    shortTextNormalizeWhitespace?: boolean | null;
    numericInputKind?: NumericInputKind | null;
    numericToleranceMode?: QuestionNumericToleranceMode | null;
    numericAbsoluteTolerance?: number | null;
    numericRelativeTolerancePercent?: number | null;
    numericUnitFamily?: NumericUnitFamily | null;
    numericRequireUnit?: boolean | null;
    numericAcceptEquivalentUnits?: boolean | null;
  }): {
    shortTextEvaluationKind: ShortTextEvaluationKind | null;
    shortTextMaxLength: number | null;
    shortTextCaseSensitive: boolean | null;
    shortTextEvaluationMode: ShortAnswerEvaluationMode | null;
    shortTextToleranceLevel: ToleranceLevel | null;
    shortTextAllowPartialCredit: boolean | null;
    shortTextTrimWhitespace: boolean | null;
    shortTextNormalizeWhitespace: boolean | null;
    numericInputKind: NumericInputKind | null;
    numericToleranceMode: NumericToleranceMode | null;
    numericAbsoluteTolerance: number | null;
    numericRelativeTolerancePercent: number | null;
    numericUnitFamily: NumericUnitFamily | null;
    numericRequireUnit: boolean | null;
    numericAcceptEquivalentUnits: boolean | null;
  } {
    if (question.type !== 'SHORT_TEXT') {
      return {
        shortTextEvaluationKind: null,
        shortTextMaxLength: null,
        shortTextCaseSensitive: null,
        shortTextEvaluationMode: null,
        shortTextToleranceLevel: null,
        shortTextAllowPartialCredit: null,
        shortTextTrimWhitespace: null,
        shortTextNormalizeWhitespace: null,
        numericInputKind: null,
        numericToleranceMode: null,
        numericAbsoluteTolerance: null,
        numericRelativeTolerancePercent: null,
        numericUnitFamily: null,
        numericRequireUnit: null,
        numericAcceptEquivalentUnits: null,
      };
    }

    const numericSettings = resolveNumericQuestionEvaluationSettings({
      numericInputKind: question.numericInputKind ?? null,
      numericToleranceMode: isNumericToleranceMode(question.numericToleranceMode)
        ? question.numericToleranceMode
        : null,
      numericAbsoluteTolerance: question.numericAbsoluteTolerance ?? null,
      numericRelativeTolerancePercent: question.numericRelativeTolerancePercent ?? null,
      numericUnitFamily: question.numericUnitFamily ?? null,
      numericRequireUnit: question.numericRequireUnit ?? false,
      numericAcceptEquivalentUnits: question.numericAcceptEquivalentUnits ?? true,
    });

    return {
      shortTextEvaluationKind: resolveShortTextEvaluationKind(
        question.shortTextEvaluationKind ?? SHORT_TEXT_DEFAULT_EVALUATION_KIND,
      ),
      shortTextMaxLength: resolveShortTextMaxLength(question.shortTextMaxLength),
      shortTextCaseSensitive: question.shortTextCaseSensitive ?? false,
      shortTextEvaluationMode:
        question.shortTextEvaluationMode ?? SHORT_TEXT_DEFAULT_EVALUATION_MODE,
      shortTextToleranceLevel:
        question.shortTextToleranceLevel ?? SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
      shortTextAllowPartialCredit: question.shortTextAllowPartialCredit ?? true,
      shortTextTrimWhitespace: question.shortTextTrimWhitespace ?? true,
      shortTextNormalizeWhitespace: question.shortTextNormalizeWhitespace ?? true,
      numericInputKind: numericSettings.inputKind,
      numericToleranceMode: numericSettings.toleranceMode,
      numericAbsoluteTolerance: numericSettings.absoluteTolerance,
      numericRelativeTolerancePercent: numericSettings.relativeTolerancePercent,
      numericUnitFamily: numericSettings.unitFamily,
      numericRequireUnit: numericSettings.requireUnit,
      numericAcceptEquivalentUnits: numericSettings.acceptEquivalentUnits,
    };
  }

  addAnswer(): void {
    if (!this.canAddAnswer()) return;
    this.answersArray.push(this.createAnswerGroup(this.isShortTextType()));
    this.scheduleLivePreview();
  }

  removeAnswer(index: number): void {
    if (!this.canRemoveAnswer()) return;
    this.answersArray.removeAt(index);
    this.normalizeCorrectSelectionForType();
    this.scheduleLivePreview();
  }

  addMatchingPair(): void {
    if (this.matchingPairsArray.length >= 6) return;
    this.matchingPairsArray.push(this.createMatchingPairGroup());
    this.onLivePreviewInput();
  }

  removeMatchingPair(index: number): void {
    if (this.matchingPairsArray.length <= 2) return;
    this.matchingPairsArray.removeAt(index);
    this.onLivePreviewInput();
  }

  addOrderingItem(): void {
    if (this.orderingItemsArray.length >= 8) return;
    this.orderingItemsArray.push(this.createOrderingItemGroup());
    this.onLivePreviewInput();
  }

  removeOrderingItem(index: number): void {
    if (this.orderingItemsArray.length <= 3) return;
    this.orderingItemsArray.removeAt(index);
    this.onLivePreviewInput();
  }

  moveOrderingSolutionItem(index: number, target: 'start' | 'up' | 'down' | 'end'): void {
    const length = this.orderingItemsArray.length;
    if (index < 0 || index >= length || length < 2) return;
    const nextIndex =
      target === 'start'
        ? 0
        : target === 'end'
          ? length - 1
          : target === 'up'
            ? Math.max(0, index - 1)
            : Math.min(length - 1, index + 1);
    if (nextIndex === index) return;

    const item = this.orderingItemsArray.at(index);
    this.orderingItemsArray.removeAt(index, { emitEvent: false });
    this.orderingItemsArray.insert(nextIndex, item, { emitEvent: false });
    this.orderingItemsArray.markAsDirty();
    this.orderingItemsArray.updateValueAndValidity();
    this.onLivePreviewInput();

    const label = item.controls.text.value.trim() || $localize`Element`;
    this.orderingSolutionAnnouncement.set(
      $localize`:@@quizEdit.orderingMovedAnnouncement:${label}:item: steht jetzt an Position ${
        nextIndex + 1
      }:position: von ${length}:total:.`,
    );
  }

  orderingMoveLabel(
    itemText: string,
    position: number,
    target: 'start' | 'up' | 'down' | 'end',
  ): string {
    const label = itemText.trim() || $localize`Element ${position}:position:`;
    if (target === 'start') {
      return $localize`:@@quizEdit.orderingMoveStart:${label}:item: an den Anfang verschieben`;
    }
    if (target === 'end') {
      return $localize`:@@quizEdit.orderingMoveEnd:${label}:item: ans Ende verschieben`;
    }
    if (target === 'up') {
      return $localize`:@@quizEdit.orderingMoveUp:${label}:item: nach oben verschieben`;
    }
    return $localize`:@@quizEdit.orderingMoveDown:${label}:item: nach unten verschieben`;
  }

  orderingActionsLabel(itemText: string, position: number): string {
    const label = itemText.trim() || $localize`Element ${position}:position:`;
    return $localize`:@@quizEdit.orderingActionsLabel:Position von ${label}:item: ändern`;
  }

  matchingRemoveLabel(position: number): string {
    return $localize`:@@quizEdit.removeMatchingPair:Paar ${position}:position: entfernen`;
  }

  orderingRemoveLabel(itemText: string, position: number): string {
    const label = itemText.trim() || $localize`Element ${position}:position:`;
    return $localize`:@@quizEdit.removeOrderingItem:${label}:item: entfernen`;
  }

  categoryRemoveLabel(position: number): string {
    return $localize`:@@quizEdit.removeCategory:Kategorie ${position}:position: entfernen`;
  }

  categorizationRemoveLabel(itemText: string, position: number): string {
    const label = itemText.trim() || $localize`Element ${position}:position:`;
    return $localize`:@@quizEdit.removeCategorizationItem:${label}:item: entfernen`;
  }

  addCategory(): void {
    if (this.categoriesArray.length >= 4) return;
    this.categoriesArray.push(this.createCategoryGroup());
    this.onLivePreviewInput();
  }

  removeCategory(index: number): void {
    if (this.categoriesArray.length <= 2) return;
    const removedId = this.categoriesArray.at(index).controls.id.value;
    this.categoriesArray.removeAt(index);
    const fallbackId = this.categoriesArray.at(0)?.controls.id.value ?? '';
    this.categorizationItemsArray.controls.forEach((item) => {
      if (item.controls.correctCategoryId.value === removedId) {
        item.controls.correctCategoryId.setValue(fallbackId);
      }
    });
    this.onLivePreviewInput();
  }

  addCategorizationItem(): void {
    if (this.categorizationItemsArray.length >= 12) return;
    const fallbackId = this.categoriesArray.at(0)?.controls.id.value ?? '';
    this.categorizationItemsArray.push(this.createCategorizationItemGroup(fallbackId));
    this.onLivePreviewInput();
  }

  removeCategorizationItem(index: number): void {
    if (this.categorizationItemsArray.length <= 4) return;
    this.categorizationItemsArray.removeAt(index);
    this.onLivePreviewInput();
  }

  categoryNameForId(
    categoryId: string,
    categories: Array<{ id: string; name: string }> = this.categoriesArray.controls.map(
      (category) => ({
        id: category.controls.id.value,
        name: category.controls.name.value,
      }),
    ),
  ): string {
    const category = categories.find((entry) => entry.id === categoryId);
    return category?.name?.trim() || $localize`:@@quizEdit.unnamedCategory:Unbenannte Kategorie`;
  }

  matchingConfigSummary(question: QuizQuestion): string {
    const count = question.matchingPairs?.length ?? 0;
    return $localize`:@@quizEdit.matchingSummary:${count}:count: Zuordnungspaare`;
  }

  orderingConfigSummary(question: QuizQuestion): string {
    const count = question.orderingItems?.length ?? 0;
    return $localize`:@@quizEdit.orderingSummary:${count}:count: Elemente in Reihenfolge`;
  }

  categorizationConfigSummary(question: QuizQuestion): string {
    const categoryCount = question.categories?.length ?? 0;
    const itemCount = question.categorizationItems?.length ?? 0;
    return $localize`:@@quizEdit.categorizationSummary:${categoryCount}:categoryCount: Kategorien, ${itemCount}:itemCount: Elemente`;
  }

  canAddAnswer(): boolean {
    return this.hasAnswerOptions() && this.answersArray.length < 10;
  }

  canRemoveAnswer(): boolean {
    if (!this.hasAnswerOptions()) {
      return false;
    }

    return this.isShortTextType() ? this.answersArray.length > 1 : this.answersArray.length > 2;
  }

  onTypeChanged(): void {
    if (this.isNumericEstimateType()) {
      this.form.controls.numericToleranceMode.setValue(
        resolveNumericEstimateToleranceMode(this.form.controls.numericToleranceMode.value),
      );
    } else if (!isNumericToleranceMode(this.form.controls.numericToleranceMode.value)) {
      this.form.controls.numericToleranceMode.setValue(NUMERIC_DEFAULT_TOLERANCE_MODE);
    }
    if (!this.hasConfidenceConfig()) {
      this.form.controls.confidenceEnabled.setValue(false);
      this.form.controls.confidenceLabelLow.setValue('');
      this.form.controls.confidenceLabelHigh.setValue('');
    } else if (!questionSupportsConfidence(this.lastQuestionTypeForConfidence)) {
      this.form.controls.confidenceEnabled.setValue(true);
      this.applyConfidenceLabelDefaultsIfEmpty();
    }
    this.lastQuestionTypeForConfidence = this.typeControl.value;
    this.resetStructuredFieldsForType(this.typeControl.value);
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

  saveAll(): boolean {
    this.metadataSaved.set(false);
    this.settingsSaved.set(false);

    const shouldSaveMetadata = this.hasUnsavedMetadataChanges();
    const shouldSaveSettings = this.hasUnsavedSettingsChanges();
    const shouldSaveQuestion = this.hasUnsavedQuestionChanges();
    const shouldShowSaveConfirmation =
      shouldSaveMetadata || shouldSaveSettings || shouldSaveQuestion;

    if (!shouldSaveMetadata && !shouldSaveSettings && !shouldSaveQuestion) {
      return true;
    }

    if (shouldSaveMetadata && !this.validateMetadataForm()) {
      return false;
    }

    if (shouldSaveSettings && !this.validateSettingsForm()) {
      return false;
    }

    if (this.hasActiveQuestionFormChanges() && !this.validateQuestionForm()) {
      return false;
    }

    if (this.isEditing()) {
      this.persistCurrentQuestionDraft();
    }

    if (this.hasStoredQuestionDrafts()) {
      const invalidQuestionId = this.firstInvalidStoredQuestionDraftId();
      if (invalidQuestionId) {
        this.editQuestion(invalidQuestionId);
        this.validateQuestionForm();
        return false;
      }
    }

    let saved = true;

    if (shouldSaveMetadata) {
      saved = this.commitMetadata() && saved;
    }

    if (shouldSaveSettings) {
      saved = this.commitSettings() && saved;
    }

    if (shouldSaveQuestion) {
      saved = this.commitAllQuestionChanges() && saved;
    }

    const savedAll = saved && !this.hasPendingChanges();
    if (savedAll && shouldShowSaveConfirmation) {
      this.showSaveConfirmation();
    }
    return savedAll;
  }

  openPreview(): void {
    if (!this.saveAll()) {
      return;
    }
    // Offenes Fragenformular nicht in die Preview mitnehmen: sonst bleibt nach
    // Preview-Saves ein veralteter Parent-Stand zurück und wirkt wie ein Entwurf.
    this.cancelEditing();
    void this.router.navigate(['preview'], {
      relativeTo: this.route,
      queryParams: { returnTo: 'edit' },
    });
  }

  addAnotherQuestion(): void {
    if (!this.saveAll()) {
      return;
    }

    this.editingQuestionId.set(null);
    this.resetQuestionForm('SINGLE_CHOICE');
    this.submitted.set(false);
    this.submitError.set(null);
    this.questionFormPanelOpen.set(true);

    requestAnimationFrame(() => {
      const el = this.questionFormElement?.nativeElement;
      scrollElementIntoAppShell(el, 'start');
      const firstEditable = el?.querySelector<HTMLElement>(
        'textarea, input, [contenteditable="true"], button, [tabindex]:not([tabindex="-1"])',
      );
      firstEditable?.focus({ preventScroll: true });
    });
  }

  private commitAllQuestionChanges(): boolean {
    try {
      for (const [questionId, questionInput] of this.sortedStoredQuestionDraftEntries()) {
        this.quizStore.updateQuestion(this.id, questionId, questionInput);
      }

      if (!this.isEditing() && this.hasActiveQuestionFormChanges()) {
        this.quizStore.addQuestion(this.id, this.buildQuestionInputFromForm());
        this.showQuestionAddedFeedback();
      }

      this.questionDrafts.set({});
      this.editingQuestionId.set(null);
      this.resetQuestionForm('SINGLE_CHOICE');
      this.submitted.set(false);
      this.submitError.set(null);
      this.scheduleLivePreview();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : $localize`Speichern fehlgeschlagen.`;
      this.submitError.set(message);
      return false;
    }
  }

  private commitSettings(): boolean {
    try {
      const updated = this.quizStore.updateQuizSettings(this.id, this.readSettingsFromForm());
      this.patchSettingsForm(updated);
      this.rememberSyncedSettingsBaseline(updated);
      this.settingsSaved.set(true);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : $localize`Einstellungen konnten nicht gespeichert werden.`;
      this.settingsSubmitError.set(message);
      return false;
    }
  }

  private commitMetadata(): boolean {
    try {
      const updated = this.quizStore.updateQuizMetadata(this.id, this.readMetadataFromForm());
      this.patchMetadataForm(updated.name, updated.description, updated.motifImageUrl);
      this.rememberSyncedMetadataBaseline({
        name: updated.name,
        description: updated.description,
        motifImageUrl: updated.motifImageUrl,
      });
      this.metadataSaved.set(true);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Titel konnte nicht gespeichert werden.';
      this.metadataSubmitError.set(message);
      return false;
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

    const previousQuestionId = this.editingQuestionId();
    if (previousQuestionId && previousQuestionId !== questionId) {
      this.persistCurrentQuestionDraft();
    }

    const comparable = this.toComparableQuestionInput(question);
    this.applyQuestionInputToForm(comparable);

    this.editingQuestionId.set(question.id);
    this.lastSyncedQuestionId = question.id;
    this.lastSyncedQuestionJson = JSON.stringify(comparable);
    this.submitError.set(null);
    this.submitted.set(false);
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.scheduleLivePreview();

    requestAnimationFrame(() => {
      const el = this.questionFormElement?.nativeElement;
      scrollElementIntoAppShell(el, 'start');
    });
  }

  cancelEditing(): void {
    const editingQuestionId = this.editingQuestionId();
    if (editingQuestionId) {
      this.removeQuestionDraft(editingQuestionId);
    }
    this.editingQuestionId.set(null);
    this.lastSyncedQuestionId = null;
    this.lastSyncedQuestionJson = null;
    this.resetQuestionForm('SINGLE_CHOICE');
    this.submitted.set(false);
  }

  cancelAllChanges(): void {
    const quiz = this.quiz();
    if (!quiz) return;

    this.patchMetadataForm(quiz.name, quiz.description, quiz.motifImageUrl);
    this.patchSettingsForm(quiz.settings);
    this.rememberSyncedFormBaseline(quiz);
    this.questionDrafts.set({});
    this.resetQuestionForm('SINGLE_CHOICE');
    this.editingQuestionId.set(null);
    this.submitted.set(false);
    this.submitError.set(null);
    this.metadataSubmitError.set(null);
    this.settingsSubmitError.set(null);
    this.metadataSaved.set(false);
    this.settingsSaved.set(false);
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

  private showSaveConfirmation(): void {
    this.snackBar.open(
      $localize`:@@quizEdit.saveConfirmation:Änderungen gespeichert. Frage, Quizdaten und Einstellungen sind jetzt in Vorschau und Live-Quiz übernommen.`,
      '',
      {
        duration: 6000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
      },
    );
  }

  private async confirmDiscardPendingChangesIfNeeded(): Promise<boolean> {
    if (!this.hasPendingChanges()) return true;
    if (this.confirmDiscardInFlight) return this.confirmDiscardInFlight;
    this.confirmDiscardInFlight = confirmDiscardUnsavedChanges(this.dialog).finally(() => {
      this.confirmDiscardInFlight = null;
    });
    return this.confirmDiscardInFlight;
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
        this.removeQuestionDraft(questionId);
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
      this.announceQuestionReorder(event.previousIndex, event.currentIndex);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : $localize`Verschieben fehlgeschlagen.`;
      this.submitError.set(message);
    }
  }

  moveQuestion(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= this.questions().length) {
      return;
    }

    try {
      this.quizStore.reorderQuestions(this.id, index, targetIndex);
      this.announceQuestionReorder(index, targetIndex);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : $localize`Verschieben fehlgeschlagen.`;
      this.submitError.set(message);
    }
  }

  moveQuestionUpLabel(position: number): string {
    return $localize`:@@quiz.edit.moveQuestionUp:Frage ${position}:position: nach oben verschieben`;
  }

  moveQuestionDownLabel(position: number): string {
    return $localize`:@@quiz.edit.moveQuestionDown:Frage ${position}:position: nach unten verschieben`;
  }

  dragQuestionLabel(position: number): string {
    return $localize`:@@quiz.edit.dragQuestion:Frage ${position}:position: durch Ziehen verschieben`;
  }

  private announceQuestionReorder(previousIndex: number, currentIndex: number): void {
    const previousPosition = previousIndex + 1;
    const currentPosition = currentIndex + 1;
    const total = this.questions().length;
    const message = $localize`:@@quiz.edit.questionMovedAnnouncement:Frage ${previousPosition}:previousPosition: wurde an Position ${currentPosition}:currentPosition: von ${total}:total: verschoben.`;

    this.questionReorderAnnouncement.set('');
    queueMicrotask(() => this.questionReorderAnnouncement.set(message));
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

  private createMatchingPairGroup(
    leftId = newQuestionItemId(),
    left = '',
    rightId = newQuestionItemId(),
    right = '',
  ): MatchingPairFormGroup {
    return this.formBuilder.group({
      leftId: this.formBuilder.control(leftId, { validators: [Validators.required] }),
      left: this.formBuilder.control(left, {
        validators: [Validators.required, Validators.maxLength(500)],
      }),
      rightId: this.formBuilder.control(rightId, { validators: [Validators.required] }),
      right: this.formBuilder.control(right, {
        validators: [Validators.required, Validators.maxLength(500)],
      }),
    });
  }

  private createMatchingPairArray(
    pairs: Array<{ leftId: string; left: string; rightId: string; right: string }>,
  ): FormArray<MatchingPairFormGroup> {
    return this.formBuilder.array<MatchingPairFormGroup>(
      pairs.map((pair) =>
        this.createMatchingPairGroup(pair.leftId, pair.left, pair.rightId, pair.right),
      ),
    );
  }

  private createOrderingItemGroup(id = newQuestionItemId(), text = ''): OrderingItemFormGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control(id, { validators: [Validators.required] }),
      text: this.formBuilder.control(text, {
        validators: [Validators.required, Validators.maxLength(500)],
      }),
    });
  }

  private createOrderingItemArray(
    items: Array<{ id: string; text: string }>,
  ): FormArray<OrderingItemFormGroup> {
    return this.formBuilder.array<OrderingItemFormGroup>(
      items.map((item) => this.createOrderingItemGroup(item.id, item.text)),
    );
  }

  private createCategoryGroup(
    id = newQuestionItemId(),
    name = '',
  ): CategorizationCategoryFormGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control(id, { validators: [Validators.required] }),
      name: this.formBuilder.control(name, {
        validators: [Validators.required, Validators.maxLength(200)],
      }),
    });
  }

  private createCategoryArray(
    categories: Array<{ id: string; name: string }>,
  ): FormArray<CategorizationCategoryFormGroup> {
    return this.formBuilder.array<CategorizationCategoryFormGroup>(
      categories.map((category) => this.createCategoryGroup(category.id, category.name)),
    );
  }

  private createCategorizationItemGroup(
    correctCategoryId = '',
    text = '',
    id = newQuestionItemId(),
  ): CategorizationItemFormGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control(id, { validators: [Validators.required] }),
      text: this.formBuilder.control(text, {
        validators: [Validators.required, Validators.maxLength(500)],
      }),
      correctCategoryId: this.formBuilder.control(correctCategoryId, {
        validators: [Validators.required],
      }),
    });
  }

  private createCategorizationItemArray(
    items: Array<{ id: string; text: string; correctCategoryId: string }>,
  ): FormArray<CategorizationItemFormGroup> {
    return this.formBuilder.array<CategorizationItemFormGroup>(
      items.map((item) =>
        this.createCategorizationItemGroup(item.correctCategoryId, item.text, item.id),
      ),
    );
  }

  private defaultMatchingPairs(): Array<{
    leftId: string;
    left: string;
    rightId: string;
    right: string;
  }> {
    return [
      { leftId: newQuestionItemId(), left: '', rightId: newQuestionItemId(), right: '' },
      { leftId: newQuestionItemId(), left: '', rightId: newQuestionItemId(), right: '' },
    ];
  }

  private defaultOrderingItems(): Array<{ id: string; text: string }> {
    return Array.from({ length: 3 }, () => ({ id: newQuestionItemId(), text: '' }));
  }

  private defaultCategorizationConfig(): {
    categories: Array<{ id: string; name: string }>;
    categorizationItems: Array<{ id: string; text: string; correctCategoryId: string }>;
  } {
    const firstCategoryId = newQuestionItemId();
    const secondCategoryId = newQuestionItemId();
    return {
      categories: [
        { id: firstCategoryId, name: '' },
        { id: secondCategoryId, name: '' },
      ],
      categorizationItems: Array.from({ length: 4 }, () => ({
        id: newQuestionItemId(),
        text: '',
        correctCategoryId: firstCategoryId,
      })),
    };
  }

  private resetStructuredFieldsForType(type: SupportedQuestionType): void {
    if (type === 'MATCHING') {
      this.form.setControl(
        'matchingPairs',
        this.createMatchingPairArray(this.defaultMatchingPairs()),
      );
      this.form.setControl('orderingItems', this.createOrderingItemArray([]));
      this.form.setControl('categories', this.createCategoryArray([]));
      this.form.setControl('categorizationItems', this.createCategorizationItemArray([]));
      return;
    }

    if (type === 'ORDERING') {
      this.form.setControl('matchingPairs', this.createMatchingPairArray([]));
      this.form.setControl(
        'orderingItems',
        this.createOrderingItemArray(this.defaultOrderingItems()),
      );
      this.form.setControl('categories', this.createCategoryArray([]));
      this.form.setControl('categorizationItems', this.createCategorizationItemArray([]));
      return;
    }

    if (type === 'CATEGORIZATION') {
      const defaults = this.defaultCategorizationConfig();
      this.form.setControl('matchingPairs', this.createMatchingPairArray([]));
      this.form.setControl('orderingItems', this.createOrderingItemArray([]));
      this.form.setControl('categories', this.createCategoryArray(defaults.categories));
      this.form.setControl(
        'categorizationItems',
        this.createCategorizationItemArray(defaults.categorizationItems),
      );
      return;
    }

    this.form.setControl('matchingPairs', this.createMatchingPairArray([]));
    this.form.setControl('orderingItems', this.createOrderingItemArray([]));
    this.form.setControl('categories', this.createCategoryArray([]));
    this.form.setControl('categorizationItems', this.createCategorizationItemArray([]));
  }

  private patchSettingsForm(settings: QuizSettings): void {
    this.settingsForm.setValue(
      {
        showLeaderboard: settings.showLeaderboard,
        allowCustomNicknames: settings.allowCustomNicknames,
        defaultTimer: settings.defaultTimer,
        timerScaleByDifficulty: settings.timerScaleByDifficulty ?? true,
        enableSoundEffects: settings.enableSoundEffects,
        enableRewardEffects: settings.enableRewardEffects,
        enableMotivationMessages: settings.enableMotivationMessages,
        enableEmojiReactions: settings.enableEmojiReactions,
        showQuestionTypeIndicators: settings.showQuestionTypeIndicators,
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

  private readSettingsFromForm(): QuizSettings {
    return {
      showLeaderboard: this.settingsForm.controls.showLeaderboard.value,
      allowCustomNicknames: this.settingsForm.controls.allowCustomNicknames.value,
      defaultTimer: this.settingsForm.controls.defaultTimer.value,
      timerScaleByDifficulty: this.settingsForm.controls.timerScaleByDifficulty.value,
      enableSoundEffects: this.settingsForm.controls.enableSoundEffects.value,
      enableRewardEffects: this.settingsForm.controls.enableRewardEffects.value,
      enableMotivationMessages: this.settingsForm.controls.enableMotivationMessages.value,
      enableEmojiReactions: this.settingsForm.controls.enableEmojiReactions.value,
      showQuestionTypeIndicators: this.settingsForm.controls.showQuestionTypeIndicators.value,
      anonymousMode: this.settingsForm.controls.anonymousMode.value,
      teamMode: this.settingsForm.controls.teamMode.value,
      teamCount: this.settingsForm.controls.teamMode.value
        ? this.settingsForm.controls.teamCount.value
        : null,
      teamAssignment: this.settingsForm.controls.teamAssignment.value,
      teamNames: parseTeamNamesText(this.settingsForm.controls.teamNamesText.value),
      backgroundMusic: null,
      nicknameTheme: this.settingsForm.controls.nicknameTheme.value ?? 'HIGH_SCHOOL',
      bonusTokenCount: this.settingsForm.controls.bonusEnabled.value
        ? (this.settingsForm.controls.bonusTokenCount.value ?? DEFAULT_BONUS_TOKEN_COUNT)
        : null,
      readingPhaseEnabled: this.settingsForm.controls.readingPhaseEnabled.value,
      preset: this.settingsForm.controls.preset.value,
    };
  }

  private hasUnsavedMetadataChanges(): boolean {
    const quiz = this.quiz();
    if (!quiz) {
      return this.metadataForm.dirty;
    }

    return (
      JSON.stringify(this.readMetadataFromForm()) !==
      JSON.stringify({
        name: quiz.name.trim(),
        description: normalizeNullableText(quiz.description),
        motifImageUrl: normalizeNullableText(quiz.motifImageUrl),
      } satisfies QuizMetadataComparable)
    );
  }

  private hasUnsavedSettingsChanges(): boolean {
    const quiz = this.quiz();
    if (!quiz) {
      return this.settingsForm.dirty;
    }

    return (
      JSON.stringify(this.toComparableSettings(this.readSettingsFromForm())) !==
      JSON.stringify(this.toComparableSettings(quiz.settings))
    );
  }

  private readMetadataFromForm(): QuizMetadataComparable {
    return {
      name: this.metadataForm.controls.name.value.trim(),
      description: normalizeNullableText(this.metadataForm.controls.description.value),
      motifImageUrl: normalizeNullableText(this.metadataForm.controls.motifImageUrl.value),
    };
  }

  private toComparableSettings(settings: QuizSettings): QuizSettings {
    return {
      showLeaderboard: settings.showLeaderboard,
      allowCustomNicknames: settings.allowCustomNicknames,
      defaultTimer: settings.defaultTimer ?? null,
      timerScaleByDifficulty: settings.timerScaleByDifficulty ?? true,
      enableSoundEffects: settings.enableSoundEffects,
      enableRewardEffects: settings.enableRewardEffects,
      enableMotivationMessages: settings.enableMotivationMessages,
      enableEmojiReactions: settings.enableEmojiReactions,
      showQuestionTypeIndicators: settings.showQuestionTypeIndicators,
      anonymousMode: settings.anonymousMode,
      teamMode: settings.teamMode,
      teamCount: settings.teamMode ? (settings.teamCount ?? DEFAULT_TEAM_COUNT) : null,
      teamAssignment: settings.teamAssignment,
      teamNames: normalizeTeamNamesForCompare(settings.teamNames),
      backgroundMusic: null,
      nicknameTheme: settings.nicknameTheme ?? 'HIGH_SCHOOL',
      bonusTokenCount:
        settings.bonusTokenCount !== null &&
        settings.bonusTokenCount !== undefined &&
        settings.bonusTokenCount > 0
          ? settings.bonusTokenCount
          : null,
      readingPhaseEnabled: settings.readingPhaseEnabled ?? true,
      preset: settings.preset ?? 'PLAYFUL',
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
      current.showQuestionTypeIndicators ===
        (target.showQuestionTypeIndicators ?? current.showQuestionTypeIndicators) &&
      current.anonymousMode === (target.anonymousMode ?? current.anonymousMode) &&
      current.readingPhaseEnabled === (target.readingPhaseEnabled ?? current.readingPhaseEnabled) &&
      current.defaultTimer === (target.defaultTimer ?? current.defaultTimer) &&
      current.timerScaleByDifficulty ===
        (target.timerScaleByDifficulty ?? current.timerScaleByDifficulty) &&
      current.allowCustomNicknames ===
        (target.allowCustomNicknames ?? current.allowCustomNicknames) &&
      current.nicknameTheme === (target.nicknameTheme ?? current.nicknameTheme)
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

  private rememberSyncedFormBaseline(quiz: {
    name: string;
    description: string | null;
    motifImageUrl: string | null;
    settings: QuizSettings;
  }): void {
    this.rememberSyncedSettingsBaseline(quiz.settings);
    this.rememberSyncedMetadataBaseline({
      name: quiz.name,
      description: quiz.description,
      motifImageUrl: quiz.motifImageUrl,
    });
  }

  private rememberSyncedSettingsBaseline(settings: QuizSettings): void {
    this.lastSyncedSettingsJson = JSON.stringify(this.toComparableSettings(settings));
  }

  private rememberSyncedMetadataBaseline(metadata: {
    name: string;
    description: string | null;
    motifImageUrl: string | null;
  }): void {
    this.lastSyncedMetadataJson = JSON.stringify({
      name: metadata.name.trim(),
      description: normalizeNullableText(metadata.description),
      motifImageUrl: normalizeNullableText(metadata.motifImageUrl),
    } satisfies QuizMetadataComparable);
  }

  /**
   * Während die Preview gemountet ist: Parent-Formulare an Store anbinden,
   * sofern sie noch dem zuletzt synchronisierten Stand entsprechen.
   */
  private syncFormsFromStoreDuringPreview(quiz: {
    name: string;
    description: string | null;
    motifImageUrl: string | null;
    settings: QuizSettings;
    questions: QuizQuestion[];
  }): void {
    const storeSettingsJson = JSON.stringify(this.toComparableSettings(quiz.settings));
    const formSettingsJson = JSON.stringify(this.toComparableSettings(this.readSettingsFromForm()));
    if (this.lastSyncedSettingsJson === null || formSettingsJson === this.lastSyncedSettingsJson) {
      this.patchSettingsForm(quiz.settings);
      this.lastSyncedSettingsJson = storeSettingsJson;
    }

    const storeMetadataJson = JSON.stringify({
      name: quiz.name.trim(),
      description: normalizeNullableText(quiz.description),
      motifImageUrl: normalizeNullableText(quiz.motifImageUrl),
    } satisfies QuizMetadataComparable);
    const formMetadataJson = JSON.stringify(this.readMetadataFromForm());
    if (this.lastSyncedMetadataJson === null || formMetadataJson === this.lastSyncedMetadataJson) {
      this.patchMetadataForm(quiz.name, quiz.description, quiz.motifImageUrl);
      this.lastSyncedMetadataJson = storeMetadataJson;
    }

    this.syncActiveQuestionFormFromStoreDuringPreview(quiz.questions);
  }

  private syncActiveQuestionFormFromStoreDuringPreview(questions: QuizQuestion[]): void {
    const editingQuestionId = this.editingQuestionId();
    if (!editingQuestionId) return;

    const storeQuestion = questions.find((question) => question.id === editingQuestionId);
    if (!storeQuestion) {
      this.cancelEditing();
      return;
    }

    const storeJson = JSON.stringify(this.toComparableQuestionInput(storeQuestion));
    const formJson = JSON.stringify(
      this.toComparableQuestionInput(this.buildQuestionInputFromForm()),
    );
    if (
      this.lastSyncedQuestionId !== editingQuestionId ||
      (this.lastSyncedQuestionJson !== null && formJson !== this.lastSyncedQuestionJson)
    ) {
      return;
    }

    this.applyQuestionInputToForm(this.toComparableQuestionInput(storeQuestion));
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.removeQuestionDraft(editingQuestionId);
    this.lastSyncedQuestionJson = storeJson;
    this.scheduleLivePreview();
  }

  private validateMetadataForm(): boolean {
    this.metadataSubmitError.set(null);
    if (this.metadataForm.invalid) {
      this.metadataPanelExpanded.set(true);
      this.metadataForm.markAllAsTouched();
      focusFirstInvalidField(this.metadataFormElement?.nativeElement, this.metadataForm);
      return false;
    }
    return true;
  }

  private validateSettingsForm(): boolean {
    this.settingsSubmitError.set(null);
    this.syncTeamNamesValidation();

    if (this.settingsForm.invalid) {
      this.showSettings.set(true);
      this.settingsForm.markAllAsTouched();
      focusFirstInvalidField(this.settingsFormElement?.nativeElement, this.settingsForm);
      return false;
    }
    return true;
  }

  private validateQuestionForm(): boolean {
    this.submitted.set(true);
    this.submitError.set(null);

    this.normalizeCorrectSelectionForType();
    const selectionError = this.getCorrectSelectionError();

    if (this.form.invalid || selectionError) {
      if (!this.isEditing()) {
        this.questionFormPanelOpen.set(true);
      }
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
      return false;
    }

    return true;
  }

  private hasUnsavedQuestionChanges(): boolean {
    if (this.hasStoredQuestionDrafts()) {
      return true;
    }

    return this.hasActiveQuestionFormChanges();
  }

  private hasActiveQuestionFormChanges(): boolean {
    if (this.isEditing()) {
      const editingQuestionId = this.editingQuestionId();
      const currentQuestion = editingQuestionId
        ? this.quiz()?.questions.find((question) => question.id === editingQuestionId)
        : null;
      if (!currentQuestion) {
        return true;
      }

      return (
        JSON.stringify(this.toComparableQuestionInput(currentQuestion)) !==
        JSON.stringify(this.toComparableQuestionInput(this.buildQuestionInputFromForm()))
      );
    }

    if (this.textControl.value.trim().length > 0) {
      return true;
    }

    if (this.typeControl.value !== 'SINGLE_CHOICE') {
      return true;
    }

    if (this.form.controls.difficulty.value !== 'MEDIUM') {
      return true;
    }

    if (this.form.controls.questionTimer.value !== null) {
      return true;
    }

    if (this.form.controls.questionSkipReadingPhase.value) {
      return true;
    }

    if (this.answersArray.length !== 2) {
      return true;
    }

    const hasNonDefaultSingleChoiceAnswers =
      this.typeControl.value === 'SINGLE_CHOICE' &&
      this.answersArray.length === 2 &&
      this.answersArray.at(0).controls.text.value.trim().length === 0 &&
      this.answersArray.at(1).controls.text.value.trim().length === 0 &&
      this.answersArray.at(0).controls.isCorrect.value === true &&
      this.answersArray.at(1).controls.isCorrect.value === false;

    if (
      !hasNonDefaultSingleChoiceAnswers &&
      this.answersArray.controls.some(
        (answer) => answer.controls.text.value.trim().length > 0 || answer.controls.isCorrect.value,
      )
    ) {
      return true;
    }

    if (
      this.form.controls.ratingMin.value !== 1 ||
      this.form.controls.ratingMax.value !== 5 ||
      this.form.controls.ratingLabelMin.value.trim().length > 0 ||
      this.form.controls.ratingLabelMax.value.trim().length > 0
    ) {
      return true;
    }

    if (
      this.form.controls.shortTextEvaluationKind.value !== SHORT_TEXT_DEFAULT_EVALUATION_KIND ||
      this.form.controls.shortTextMaxLength.value !== SHORT_TEXT_DEFAULT_MAX_LENGTH ||
      this.form.controls.shortTextCaseSensitive.value !== false ||
      this.form.controls.shortTextEvaluationMode.value !== SHORT_TEXT_DEFAULT_EVALUATION_MODE ||
      this.form.controls.shortTextToleranceLevel.value !== SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL ||
      this.form.controls.shortTextAllowPartialCredit.value !== true ||
      this.form.controls.shortTextTrimWhitespace.value !== true ||
      this.form.controls.shortTextNormalizeWhitespace.value !== true ||
      this.form.controls.numericInputKind.value !== NUMERIC_DEFAULT_INPUT_KIND ||
      this.form.controls.numericToleranceMode.value !== NUMERIC_DEFAULT_TOLERANCE_MODE ||
      this.form.controls.numericAbsoluteTolerance.value !== null ||
      this.form.controls.numericRelativeTolerancePercent.value !== null ||
      this.form.controls.numericUnitFamily.value !== NUMERIC_DEFAULT_UNIT_FAMILY ||
      this.form.controls.numericRequireUnit.value !== false ||
      this.form.controls.numericAcceptEquivalentUnits.value !== true
    ) {
      return true;
    }

    return false;
  }

  private hasStoredQuestionDrafts(): boolean {
    return Object.keys(this.questionDrafts()).length > 0;
  }

  private persistCurrentQuestionDraft(): void {
    const editingQuestionId = this.editingQuestionId();
    if (!editingQuestionId) return;

    const currentQuestion = this.quiz()?.questions.find(
      (question) => question.id === editingQuestionId,
    );
    if (!currentQuestion) return;

    const currentInput = this.buildQuestionInputFromForm();
    if (
      JSON.stringify(this.toComparableQuestionInput(currentQuestion)) ===
      JSON.stringify(this.toComparableQuestionInput(currentInput))
    ) {
      this.removeQuestionDraft(editingQuestionId);
      return;
    }

    this.questionDrafts.update((drafts) => ({
      ...drafts,
      [editingQuestionId]: currentInput,
    }));
  }

  private removeQuestionDraft(questionId: string): void {
    this.questionDrafts.update((drafts) => {
      if (!(questionId in drafts)) {
        return drafts;
      }
      const next = { ...drafts };
      delete next[questionId];
      return next;
    });
  }

  private sortedStoredQuestionDraftEntries(): Array<[string, AddQuizQuestionInput]> {
    const orderByQuestionId = new Map(
      this.quiz()?.questions.map((question) => [question.id, question.order]) ?? [],
    );
    return Object.entries(this.questionDrafts()).sort(
      ([leftId], [rightId]) =>
        (orderByQuestionId.get(leftId) ?? Number.MAX_SAFE_INTEGER) -
        (orderByQuestionId.get(rightId) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  private firstInvalidStoredQuestionDraftId(): string | null {
    for (const [questionId, questionInput] of this.sortedStoredQuestionDraftEntries()) {
      if (!this.isQuestionInputValid(questionInput)) {
        return questionId;
      }
    }
    return null;
  }

  private buildQuestionInputFromForm(): AddQuizQuestionInput {
    const shortTextEvaluationKind = resolveShortTextEvaluationKind(
      this.form.controls.shortTextEvaluationKind.value,
    );
    const shortTextNumericToleranceMode = isNumericToleranceMode(
      this.form.controls.numericToleranceMode.value,
    )
      ? this.form.controls.numericToleranceMode.value
      : NUMERIC_DEFAULT_TOLERANCE_MODE;
    const numericEstimateToleranceMode = resolveNumericEstimateToleranceMode(
      this.form.controls.numericToleranceMode.value,
    );
    const shortTextInput = !this.isShortTextType()
      ? {}
      : shortTextEvaluationKind === 'text'
        ? {
            shortTextMaxLength: this.form.controls.shortTextMaxLength.value,
            shortTextCaseSensitive: this.form.controls.shortTextCaseSensitive.value,
            shortTextEvaluationMode: this.form.controls.shortTextEvaluationMode.value,
            shortTextToleranceLevel: this.form.controls.shortTextToleranceLevel.value,
            shortTextAllowPartialCredit: this.form.controls.shortTextAllowPartialCredit.value,
            shortTextTrimWhitespace: this.form.controls.shortTextTrimWhitespace.value,
            shortTextNormalizeWhitespace: this.form.controls.shortTextNormalizeWhitespace.value,
          }
        : {
            shortTextEvaluationKind,
            shortTextMaxLength: this.form.controls.shortTextMaxLength.value,
            numericInputKind: this.form.controls.numericInputKind.value,
            numericToleranceMode: shortTextNumericToleranceMode,
            numericAbsoluteTolerance: this.form.controls.numericAbsoluteTolerance.value,
            numericRelativeTolerancePercent:
              this.form.controls.numericRelativeTolerancePercent.value,
            ...(shortTextEvaluationKind === 'numeric_unit'
              ? {
                  numericUnitFamily: this.form.controls.numericUnitFamily.value,
                  numericRequireUnit: this.form.controls.numericRequireUnit.value,
                  numericAcceptEquivalentUnits:
                    this.form.controls.numericAcceptEquivalentUnits.value,
                }
              : {}),
          };

    return {
      text: this.textControl.value,
      type: this.typeControl.value,
      difficulty: this.form.controls.difficulty.value,
      timer: this.form.controls.questionTimer.value,
      answers: this.buildQuestionAnswersForType(),
      skipReadingPhase: this.form.controls.questionSkipReadingPhase.value,
      ...(this.isRatingType()
        ? {
            ratingMin: this.form.controls.ratingMin.value,
            ratingMax: this.form.controls.ratingMax.value,
            ratingLabelMin: this.form.controls.ratingLabelMin.value,
            ratingLabelMax: this.form.controls.ratingLabelMax.value,
          }
        : {}),
      ...shortTextInput,
      ...(this.isNumericEstimateType()
        ? {
            numericToleranceMode: numericEstimateToleranceMode,
            numericReferenceValue: this.form.controls.numericReferenceValue.value,
            numericTolerancePercent:
              numericEstimateToleranceMode === 'RELATIVE_PERCENT'
                ? this.form.controls.numericTolerancePercent.value
                : null,
            numericIntervalLeft:
              numericEstimateToleranceMode === 'ABSOLUTE_INTERVAL'
                ? this.form.controls.numericIntervalLeft.value
                : null,
            numericIntervalRight:
              numericEstimateToleranceMode === 'ABSOLUTE_INTERVAL'
                ? this.form.controls.numericIntervalRight.value
                : null,
            numericInputType: this.form.controls.numericInputType.value,
            numericDecimalPlaces: this.form.controls.numericDecimalPlaces.value,
            numericMin: this.form.controls.numericMin.value,
            numericMax: this.form.controls.numericMax.value,
            numericTwoRounds: this.form.controls.numericTwoRounds.value,
          }
        : {}),
      ...(this.hasConfidenceConfig()
        ? {
            confidenceEnabled: this.form.controls.confidenceEnabled.value,
            ...(this.form.controls.confidenceEnabled.value
              ? {
                  confidenceLabelLow: this.form.controls.confidenceLabelLow.value,
                  confidenceLabelHigh: this.form.controls.confidenceLabelHigh.value,
                }
              : {}),
          }
        : {}),
      ...(this.isMatchingType()
        ? {
            matchingPairs: this.matchingPairsArray.controls.map((pair) => ({
              leftId: pair.controls.leftId.value,
              left: pair.controls.left.value,
              rightId: pair.controls.rightId.value,
              right: pair.controls.right.value,
            })),
            matchingShuffleRight: this.form.controls.matchingShuffleRight.value,
          }
        : {}),
      ...(this.isOrderingType()
        ? {
            orderingItems: this.orderingItemsArray.controls.map((item) => ({
              id: item.controls.id.value,
              text: item.controls.text.value,
            })),
          }
        : {}),
      ...(this.isCategorizationType()
        ? {
            categories: this.categoriesArray.controls.map((category) => ({
              id: category.controls.id.value,
              name: category.controls.name.value,
            })),
            categorizationItems: this.categorizationItemsArray.controls.map((item) => ({
              id: item.controls.id.value,
              text: item.controls.text.value,
              correctCategoryId: item.controls.correctCategoryId.value,
            })),
            categorizationShuffleItems: this.form.controls.categorizationShuffleItems.value,
          }
        : {}),
    };
  }

  private toComparableQuestionInput(
    question:
      | AddQuizQuestionInput
      | {
          text: string;
          type: SupportedQuestionType;
          difficulty: Difficulty;
          timer: number | null;
          answers: Array<{ text: string; isCorrect: boolean }>;
          skipReadingPhase?: boolean;
          ratingMin?: number | null;
          ratingMax?: number | null;
          ratingLabelMin?: string | null;
          ratingLabelMax?: string | null;
          shortTextEvaluationKind?: ShortTextEvaluationKind | null;
          shortTextMaxLength?: number | null;
          shortTextCaseSensitive?: boolean | null;
          shortTextEvaluationMode?: ShortAnswerEvaluationMode | null;
          shortTextToleranceLevel?: ToleranceLevel | null;
          shortTextAllowPartialCredit?: boolean | null;
          shortTextTrimWhitespace?: boolean | null;
          shortTextNormalizeWhitespace?: boolean | null;
          numericInputKind?: NumericInputKind | null;
          numericToleranceMode?: QuestionNumericToleranceMode | null;
          numericAbsoluteTolerance?: number | null;
          numericRelativeTolerancePercent?: number | null;
          numericUnitFamily?: NumericUnitFamily | null;
          numericRequireUnit?: boolean | null;
          numericAcceptEquivalentUnits?: boolean | null;
          numericReferenceValue?: number | null;
          numericTolerancePercent?: number | null;
          numericIntervalLeft?: number | null;
          numericIntervalRight?: number | null;
          numericInputType?: 'INTEGER' | 'DECIMAL' | null;
          numericDecimalPlaces?: number | null;
          numericMin?: number | null;
          numericMax?: number | null;
          numericTwoRounds?: boolean | null;
          confidenceEnabled?: boolean | null;
          confidenceLabelLow?: string | null;
          confidenceLabelHigh?: string | null;
          matchingPairs?: Array<{
            leftId: string;
            left: string;
            rightId: string;
            right: string;
          }>;
          matchingShuffleRight?: boolean;
          orderingItems?: Array<{ id: string; text: string }>;
          categories?: Array<{ id: string; name: string }>;
          categorizationItems?: Array<{
            id: string;
            text: string;
            correctCategoryId: string;
          }>;
          categorizationShuffleItems?: boolean;
        },
  ): AddQuizQuestionInput {
    const shortTextSettings = this.resolveShortTextQuestionSettings(question);
    return {
      text: question.text,
      type: question.type,
      difficulty: question.difficulty,
      timer: question.timer ?? null,
      answers: question.answers.map((answer) => ({
        text: answer.text,
        isCorrect: answer.isCorrect,
      })),
      skipReadingPhase: question.skipReadingPhase ?? false,
      ...(question.type === 'RATING'
        ? {
            ratingMin: question.ratingMin ?? 1,
            ratingMax: question.ratingMax ?? 5,
            ratingLabelMin: question.ratingLabelMin ?? '',
            ratingLabelMax: question.ratingLabelMax ?? '',
          }
        : {}),
      ...(question.type === 'SHORT_TEXT'
        ? {
            ...shortTextSettings,
          }
        : {}),
      ...(question.type === 'NUMERIC_ESTIMATE'
        ? {
            numericToleranceMode: resolveNumericEstimateToleranceMode(
              question.numericToleranceMode,
            ),
            numericReferenceValue: question.numericReferenceValue ?? null,
            numericTolerancePercent: question.numericTolerancePercent ?? 10,
            numericIntervalLeft: question.numericIntervalLeft ?? null,
            numericIntervalRight: question.numericIntervalRight ?? null,
            numericInputType: question.numericInputType ?? 'DECIMAL',
            numericDecimalPlaces: question.numericDecimalPlaces ?? 2,
            numericMin: question.numericMin ?? null,
            numericMax: question.numericMax ?? null,
            numericTwoRounds: question.numericTwoRounds ?? false,
          }
        : {}),
      ...(question.type === 'MATCHING'
        ? {
            matchingPairs: question.matchingPairs ?? [],
            matchingShuffleRight: question.matchingShuffleRight ?? true,
          }
        : {}),
      ...(question.type === 'ORDERING'
        ? {
            orderingItems: question.orderingItems ?? [],
          }
        : {}),
      ...(question.type === 'CATEGORIZATION'
        ? {
            categories: question.categories ?? [],
            categorizationItems: question.categorizationItems ?? [],
            categorizationShuffleItems: question.categorizationShuffleItems ?? true,
          }
        : {}),
      ...(questionSupportsConfidence(question.type)
        ? {
            confidenceEnabled: question.confidenceEnabled ?? false,
            confidenceLabelLow: question.confidenceLabelLow ?? '',
            confidenceLabelHigh: question.confidenceLabelHigh ?? '',
          }
        : {}),
    };
  }

  private applyQuestionInputToForm(question: AddQuizQuestionInput): void {
    this.form.controls.text.setValue(question.text);
    this.form.controls.type.setValue(question.type);
    this.form.controls.difficulty.setValue(question.difficulty);
    this.form.setControl('answers', this.createAnswerArrayForType(question.type, question.answers));
    this.form.setControl(
      'matchingPairs',
      this.createMatchingPairArray(question.matchingPairs ?? []),
    );
    this.form.controls.matchingShuffleRight.setValue(question.matchingShuffleRight ?? true);
    this.form.setControl(
      'orderingItems',
      this.createOrderingItemArray(question.orderingItems ?? []),
    );
    this.form.setControl('categories', this.createCategoryArray(question.categories ?? []));
    this.form.setControl(
      'categorizationItems',
      this.createCategorizationItemArray(question.categorizationItems ?? []),
    );
    this.form.controls.categorizationShuffleItems.setValue(
      question.categorizationShuffleItems ?? true,
    );
    this.form.controls.ratingMin.setValue(question.ratingMin ?? 1);
    this.form.controls.ratingMax.setValue(question.ratingMax ?? 5);
    this.form.controls.ratingLabelMin.setValue(question.ratingLabelMin ?? '');
    this.form.controls.ratingLabelMax.setValue(question.ratingLabelMax ?? '');
    const shortTextSettings = this.resolveShortTextQuestionSettings(question);
    this.form.controls.shortTextEvaluationKind.setValue(
      shortTextSettings.shortTextEvaluationKind ?? SHORT_TEXT_DEFAULT_EVALUATION_KIND,
    );
    this.form.controls.shortTextMaxLength.setValue(shortTextSettings.shortTextMaxLength);
    this.form.controls.shortTextCaseSensitive.setValue(
      shortTextSettings.shortTextCaseSensitive ?? false,
    );
    this.form.controls.shortTextEvaluationMode.setValue(
      shortTextSettings.shortTextEvaluationMode ?? SHORT_TEXT_DEFAULT_EVALUATION_MODE,
    );
    this.form.controls.shortTextToleranceLevel.setValue(
      shortTextSettings.shortTextToleranceLevel ?? SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
    );
    this.form.controls.shortTextAllowPartialCredit.setValue(
      shortTextSettings.shortTextAllowPartialCredit ?? true,
    );
    this.form.controls.shortTextTrimWhitespace.setValue(
      shortTextSettings.shortTextTrimWhitespace ?? true,
    );
    this.form.controls.shortTextNormalizeWhitespace.setValue(
      shortTextSettings.shortTextNormalizeWhitespace ?? true,
    );
    this.form.controls.numericInputKind.setValue(
      shortTextSettings.numericInputKind ?? NUMERIC_DEFAULT_INPUT_KIND,
    );
    this.form.controls.numericToleranceMode.setValue(
      shortTextSettings.numericToleranceMode ?? NUMERIC_DEFAULT_TOLERANCE_MODE,
    );
    this.form.controls.numericAbsoluteTolerance.setValue(
      shortTextSettings.numericAbsoluteTolerance,
    );
    this.form.controls.numericRelativeTolerancePercent.setValue(
      shortTextSettings.numericRelativeTolerancePercent,
    );
    this.form.controls.numericUnitFamily.setValue(
      shortTextSettings.numericUnitFamily ?? NUMERIC_DEFAULT_UNIT_FAMILY,
    );
    this.form.controls.numericRequireUnit.setValue(shortTextSettings.numericRequireUnit ?? false);
    this.form.controls.numericAcceptEquivalentUnits.setValue(
      shortTextSettings.numericAcceptEquivalentUnits ?? true,
    );
    this.form.controls.questionTimer.setValue(question.timer ?? null);
    this.form.controls.questionSkipReadingPhase.setValue(question.skipReadingPhase ?? false);
    if (question.type === 'NUMERIC_ESTIMATE') {
      this.form.controls.numericToleranceMode.setValue(
        resolveNumericEstimateToleranceMode(question.numericToleranceMode),
      );
    }
    this.form.controls.numericReferenceValue.setValue(question.numericReferenceValue ?? null);
    this.form.controls.numericTolerancePercent.setValue(question.numericTolerancePercent ?? 10);
    this.form.controls.numericIntervalLeft.setValue(question.numericIntervalLeft ?? null);
    this.form.controls.numericIntervalRight.setValue(question.numericIntervalRight ?? null);
    this.form.controls.numericInputType.setValue(question.numericInputType ?? 'DECIMAL');
    this.form.controls.numericDecimalPlaces.setValue(question.numericDecimalPlaces ?? 2);
    this.form.controls.numericMin.setValue(question.numericMin ?? null);
    this.form.controls.numericMax.setValue(question.numericMax ?? null);
    this.form.controls.numericTwoRounds.setValue(question.numericTwoRounds ?? false);
    this.form.controls.confidenceEnabled.setValue(question.confidenceEnabled ?? false);
    if (question.confidenceEnabled) {
      this.form.controls.confidenceLabelLow.setValue(
        question.confidenceLabelLow?.trim() || confidenceDefaultLabelLow(),
      );
      this.form.controls.confidenceLabelHigh.setValue(
        question.confidenceLabelHigh?.trim() || confidenceDefaultLabelHigh(),
      );
    } else {
      this.form.controls.confidenceLabelLow.setValue(question.confidenceLabelLow ?? '');
      this.form.controls.confidenceLabelHigh.setValue(question.confidenceLabelHigh ?? '');
    }
    this.lastQuestionTypeForConfidence = question.type;
  }

  private mergeQuestionWithDraft(
    question: QuizQuestion,
    draft: AddQuizQuestionInput,
  ): QuizQuestion {
    const shortTextSettings = this.resolveShortTextQuestionSettings(draft);
    return {
      ...question,
      text: draft.text,
      type: draft.type,
      difficulty: draft.difficulty,
      timer: draft.timer ?? null,
      skipReadingPhase: draft.skipReadingPhase ?? false,
      answers: draft.answers.map((answer, index) => ({
        id: question.answers[index]?.id ?? `${question.id}-draft-${index}`,
        text: answer.text,
        isCorrect: answer.isCorrect,
      })),
      ratingMin: draft.type === 'RATING' ? (draft.ratingMin ?? 1) : null,
      ratingMax: draft.type === 'RATING' ? (draft.ratingMax ?? 5) : null,
      ratingLabelMin: draft.type === 'RATING' ? (draft.ratingLabelMin ?? '') : null,
      ratingLabelMax: draft.type === 'RATING' ? (draft.ratingLabelMax ?? '') : null,
      ...shortTextSettings,
      numericToleranceMode:
        draft.type === 'NUMERIC_ESTIMATE'
          ? resolveNumericEstimateToleranceMode(draft.numericToleranceMode)
          : shortTextSettings.numericToleranceMode,
      numericReferenceValue:
        draft.type === 'NUMERIC_ESTIMATE' ? (draft.numericReferenceValue ?? null) : null,
      numericTolerancePercent:
        draft.type === 'NUMERIC_ESTIMATE' ? (draft.numericTolerancePercent ?? null) : null,
      numericIntervalLeft:
        draft.type === 'NUMERIC_ESTIMATE' ? (draft.numericIntervalLeft ?? null) : null,
      numericIntervalRight:
        draft.type === 'NUMERIC_ESTIMATE' ? (draft.numericIntervalRight ?? null) : null,
      numericInputType: draft.type === 'NUMERIC_ESTIMATE' ? (draft.numericInputType ?? null) : null,
      numericDecimalPlaces:
        draft.type === 'NUMERIC_ESTIMATE' ? (draft.numericDecimalPlaces ?? null) : null,
      numericMin: draft.type === 'NUMERIC_ESTIMATE' ? (draft.numericMin ?? null) : null,
      numericMax: draft.type === 'NUMERIC_ESTIMATE' ? (draft.numericMax ?? null) : null,
      numericTwoRounds:
        draft.type === 'NUMERIC_ESTIMATE' ? (draft.numericTwoRounds ?? false) : false,
      confidenceEnabled: questionSupportsConfidence(draft.type)
        ? (draft.confidenceEnabled ?? false)
        : false,
      confidenceLabelLow:
        questionSupportsConfidence(draft.type) && (draft.confidenceEnabled ?? false)
          ? (normalizeNullableText(draft.confidenceLabelLow) ?? null)
          : null,
      confidenceLabelHigh:
        questionSupportsConfidence(draft.type) && (draft.confidenceEnabled ?? false)
          ? (normalizeNullableText(draft.confidenceLabelHigh) ?? null)
          : null,
      matchingPairs: draft.type === 'MATCHING' ? (draft.matchingPairs ?? undefined) : undefined,
      matchingShuffleRight:
        draft.type === 'MATCHING' ? (draft.matchingShuffleRight ?? true) : undefined,
      orderingItems: draft.type === 'ORDERING' ? (draft.orderingItems ?? undefined) : undefined,
      categories: draft.type === 'CATEGORIZATION' ? (draft.categories ?? undefined) : undefined,
      categorizationItems:
        draft.type === 'CATEGORIZATION' ? (draft.categorizationItems ?? undefined) : undefined,
      categorizationShuffleItems:
        draft.type === 'CATEGORIZATION' ? (draft.categorizationShuffleItems ?? true) : undefined,
    };
  }

  private resetQuestionForm(type: SupportedQuestionType = this.typeControl.value): void {
    this.form.controls.text.reset('');
    this.form.controls.type.reset(type);
    this.form.controls.difficulty.reset('MEDIUM');
    this.form.controls.questionTimer.reset(null);
    this.form.controls.questionSkipReadingPhase.reset(false);
    this.form.setControl('answers', this.createAnswerArrayForType(type));
    this.resetStructuredFieldsForType(type);
    this.form.controls.matchingShuffleRight.reset(true);
    this.form.controls.categorizationShuffleItems.reset(true);
    this.form.controls.ratingMin.reset(1);
    this.form.controls.ratingMax.reset(5);
    this.form.controls.ratingLabelMin.reset('');
    this.form.controls.ratingLabelMax.reset('');
    this.form.controls.shortTextEvaluationKind.reset(SHORT_TEXT_DEFAULT_EVALUATION_KIND);
    this.form.controls.shortTextMaxLength.reset(SHORT_TEXT_DEFAULT_MAX_LENGTH);
    this.form.controls.shortTextCaseSensitive.reset(false);
    this.form.controls.shortTextEvaluationMode.reset(SHORT_TEXT_DEFAULT_EVALUATION_MODE);
    this.form.controls.shortTextToleranceLevel.reset(SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL);
    this.form.controls.shortTextAllowPartialCredit.reset(true);
    this.form.controls.shortTextTrimWhitespace.reset(true);
    this.form.controls.shortTextNormalizeWhitespace.reset(true);
    this.form.controls.numericInputKind.reset(NUMERIC_DEFAULT_INPUT_KIND);
    this.form.controls.numericToleranceMode.reset(
      type === 'NUMERIC_ESTIMATE' ? 'ABSOLUTE_INTERVAL' : NUMERIC_DEFAULT_TOLERANCE_MODE,
    );
    this.form.controls.numericAbsoluteTolerance.reset(null);
    this.form.controls.numericRelativeTolerancePercent.reset(null);
    this.form.controls.numericUnitFamily.reset(NUMERIC_DEFAULT_UNIT_FAMILY);
    this.form.controls.numericRequireUnit.reset(false);
    this.form.controls.numericAcceptEquivalentUnits.reset(true);
    // Story 1.2d: Numerische Schätzfrage
    this.form.controls.numericReferenceValue.reset(null);
    this.form.controls.numericTolerancePercent.reset(10);
    this.form.controls.numericIntervalLeft.reset(null);
    this.form.controls.numericIntervalRight.reset(null);
    this.form.controls.numericInputType.reset('DECIMAL');
    this.form.controls.numericDecimalPlaces.reset(2);
    this.form.controls.numericMin.reset(null);
    this.form.controls.numericMax.reset(null);
    this.form.controls.numericTwoRounds.reset(false);
    const confidenceEnabled = questionSupportsConfidence(type);
    this.form.controls.confidenceEnabled.reset(confidenceEnabled);
    if (confidenceEnabled) {
      this.applyConfidenceLabelDefaultsIfEmpty();
    } else {
      this.form.controls.confidenceLabelLow.reset('');
      this.form.controls.confidenceLabelHigh.reset('');
    }
    this.lastQuestionTypeForConfidence = type;

    this.submitError.set(null);
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.scheduleLivePreview();
  }

  private isQuestionInputValid(question: AddQuizQuestionInput): boolean {
    if (question.text.length === 0 || question.text.length > 2000) {
      return false;
    }

    const timer = question.timer ?? null;
    if (timer !== null && (timer < 5 || timer > 300)) {
      return false;
    }

    if (
      question.type === 'FREETEXT' ||
      question.type === 'RATING' ||
      question.type === 'NUMERIC_ESTIMATE'
    ) {
      if (question.type === 'NUMERIC_ESTIMATE') {
        const mode = resolveNumericEstimateToleranceMode(question.numericToleranceMode);
        if (mode === 'RELATIVE_PERCENT') {
          if (
            question.numericReferenceValue === null ||
            question.numericReferenceValue === undefined
          )
            return false;
          if (question.numericReferenceValue === 0) return false;
          if (
            question.numericTolerancePercent === null ||
            question.numericTolerancePercent === undefined
          )
            return false;
        } else {
          if (question.numericIntervalLeft === null || question.numericIntervalLeft === undefined)
            return false;
          if (question.numericIntervalRight === null || question.numericIntervalRight === undefined)
            return false;
          if (question.numericIntervalLeft >= question.numericIntervalRight) return false;
        }
      }
      return question.answers.length === 0;
    }

    if (question.type === 'MATCHING') {
      if (question.answers.length > 0) return false;
      const pairs = question.matchingPairs ?? [];
      if (pairs.length < 2 || pairs.length > 6) return false;
      const lefts = new Set<string>();
      const rights = new Set<string>();
      const leftIds = new Set<string>();
      const rightIds = new Set<string>();
      for (const pair of pairs) {
        const left = pair.left.trim();
        const right = pair.right.trim();
        if (!left || left.length > 500 || !right || right.length > 500) return false;
        if (!pair.leftId || !pair.rightId) return false;
        if (
          lefts.has(left) ||
          rights.has(right) ||
          leftIds.has(pair.leftId) ||
          rightIds.has(pair.rightId)
        )
          return false;
        lefts.add(left);
        rights.add(right);
        leftIds.add(pair.leftId);
        rightIds.add(pair.rightId);
      }
      return true;
    }

    if (question.type === 'ORDERING') {
      if (question.answers.length > 0) return false;
      const items = question.orderingItems ?? [];
      if (items.length < 3 || items.length > 8) return false;
      const ids = new Set<string>();
      const texts = new Set<string>();
      for (const item of items) {
        const text = item.text.trim();
        if (!item.id.trim() || !text || text.length > 500) return false;
        if (ids.has(item.id) || texts.has(text)) return false;
        ids.add(item.id);
        texts.add(text);
      }
      return true;
    }

    if (question.type === 'CATEGORIZATION') {
      if (question.answers.length > 0) return false;
      const categories = question.categories ?? [];
      const categorizationItems = question.categorizationItems ?? [];
      if (categories.length < 2 || categories.length > 4) return false;
      if (categorizationItems.length < 4 || categorizationItems.length > 12) return false;
      const categoryIds = new Set(categories.map((category) => category.id));
      const categoryNames = new Set<string>();
      if (categoryIds.size !== categories.length) return false;
      for (const category of categories) {
        const name = category.name.trim();
        if (!category.id.trim() || !name || name.length > 200) return false;
        if (categoryNames.has(name)) return false;
        categoryNames.add(name);
      }
      const itemTexts = new Set<string>();
      const itemIds = new Set<string>();
      for (const item of categorizationItems) {
        const text = item.text.trim();
        if (!text || text.length > 500) return false;
        if (!item.id || itemTexts.has(text) || itemIds.has(item.id)) return false;
        if (!categoryIds.has(item.correctCategoryId)) return false;
        itemTexts.add(text);
        itemIds.add(item.id);
      }
      return true;
    }

    if (question.type === 'SHORT_TEXT') {
      if (question.answers.length < 1 || question.answers.length > 10) {
        return false;
      }

      const shortTextSettings = this.resolveShortTextQuestionSettings(question);
      const seenSolutions = new Set<string>();

      for (const answer of question.answers) {
        if (answer.text.length === 0 || answer.text.length > 500 || !answer.isCorrect) {
          return false;
        }

        const normalized = normalizeShortTextValue(answer.text, {
          caseSensitive: shortTextSettings.shortTextCaseSensitive ?? false,
          maxLength: shortTextSettings.shortTextMaxLength,
          trimWhitespace: shortTextSettings.shortTextTrimWhitespace ?? true,
          normalizeWhitespace: shortTextSettings.shortTextNormalizeWhitespace ?? true,
        });
        if (seenSolutions.has(normalized)) {
          return false;
        }
        seenSolutions.add(normalized);
      }

      return true;
    }

    if (question.answers.length < 2 || question.answers.length > 10) {
      return false;
    }

    if (question.answers.some((answer) => answer.text.length === 0 || answer.text.length > 500)) {
      return false;
    }

    const correctCount = question.answers.filter((answer) => answer.isCorrect).length;
    if (question.type === 'SINGLE_CHOICE') {
      return correctCount === 1;
    }

    if (question.type === 'MULTIPLE_CHOICE') {
      return correctCount >= 1;
    }

    return true;
  }

  private buildQuestionAnswersForType(): AddQuizQuestionInput['answers'] {
    if (!this.hasAnswerOptions()) {
      return [];
    }

    return this.answersArray.controls.map((answer) => ({
      text: answer.controls.text.value,
      isCorrect: this.isSurveyType()
        ? false
        : this.isShortTextType()
          ? true
          : answer.controls.isCorrect.value,
    }));
  }

  private createAnswerArrayForType(
    type: SupportedQuestionType,
    existingAnswers: AddQuizQuestionInput['answers'] = [],
  ): FormArray<AnswerFormGroup> {
    if (
      type === 'FREETEXT' ||
      type === 'RATING' ||
      type === 'NUMERIC_ESTIMATE' ||
      type === 'MATCHING' ||
      type === 'ORDERING' ||
      type === 'CATEGORIZATION'
    ) {
      return this.formBuilder.array<AnswerFormGroup>([]);
    }

    const groups = existingAnswers.map((answer) =>
      this.createAnswerGroup(
        type === 'SURVEY' ? false : type === 'SHORT_TEXT' ? true : answer.isCorrect,
        answer.text,
      ),
    );

    const minimumAnswers = type === 'SHORT_TEXT' ? 1 : 2;
    while (groups.length < minimumAnswers) {
      groups.push(
        this.createAnswerGroup(
          type === 'SHORT_TEXT' || (type === 'SINGLE_CHOICE' && groups.length === 0),
        ),
      );
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

    if (type === 'SHORT_TEXT' && this.form.controls.shortTextMaxLength.value === null) {
      this.form.controls.shortTextMaxLength.setValue(SHORT_TEXT_DEFAULT_MAX_LENGTH);
    }

    if (type === 'SHORT_TEXT') {
      const hasAnySolutionText = this.answersArray.controls.some(
        (answer) => answer.controls.text.value.trim().length > 0,
      );
      if (!hasAnySolutionText && this.answersArray.length !== 1) {
        this.form.setControl('answers', this.createAnswerArrayForType(type));
        return;
      }
    }

    if (!this.hasAnswerOptions()) {
      if (this.answersArray.length > 0) {
        this.form.setControl('answers', this.createAnswerArrayForType(type));
      }
      return;
    }

    const minimumAnswers = type === 'SHORT_TEXT' ? 1 : 2;
    if (this.answersArray.length < minimumAnswers) {
      this.form.setControl('answers', this.createAnswerArrayForType(type));
    }
  }

  private normalizeCorrectSelectionForType(): void {
    if (!this.hasAnswerOptions() || this.answersArray.length === 0) return;

    if (this.isShortTextType()) {
      this.answersArray.controls.forEach((answer) => {
        answer.controls.isCorrect.setValue(true);
      });
      return;
    }

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
      const questionResult = renderMarkdownWithKatex(this.textControl.value, {
        imagePolicy: 'allow-relative-and-https',
        headingStartLevel: 3,
      });
      this.questionPreviewHtml.set(this.sanitizer.bypassSecurityTrustHtml(questionResult.html));

      const answerResults = this.answersArray.controls.map((answer) =>
        renderMarkdownWithKatex(answer.controls.text.value, {
          imagePolicy: 'allow-relative-and-https',
          headingStartLevel: 4,
        }),
      );
      this.answerPreviewHtml.set(
        answerResults.map((result) =>
          this.sanitizer.bypassSecurityTrustHtml(decorateLeadingAnswerEmoji(result.html)),
        ),
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
    .map((entry) => replaceEmojiShortcodes(entry.trim()))
    .filter((entry) => entry.length > 0);
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTeamNamesForCompare(value: readonly string[] | null | undefined): string[] {
  return parseTeamNamesText((value ?? []).join('\n'));
}

function newQuestionItemId(): string {
  return globalThis.crypto.randomUUID();
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
