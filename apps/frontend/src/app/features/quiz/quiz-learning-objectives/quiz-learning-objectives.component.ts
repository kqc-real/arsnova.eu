import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  LOCALE_ID,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import {
  LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
  LEARNING_OBJECTIVE_MAX_OBJECTIVES,
  LEARNING_OBJECTIVE_MAX_REFERENCES,
  LEARNING_OBJECTIVE_TEXT_MAX_LENGTH,
  LearningObjectiveDerivationQuestionSchema,
  RunLearningObjectiveDerivationInputSchema,
  isNumericToleranceMode,
  normalizeLearningObjectiveText,
  questionSupportsConfidence,
  resolveNumericEstimateToleranceMode,
  type LearningObjectiveDerivationProgress,
  type LearningObjectiveDerivationQuestion,
  type LearningObjectiveDerivationResult,
  type QuizLearningObjectiveV1,
} from '@arsnova/shared-types';
import { formatLocaleCount } from '../../../core/locale-number.util';
import { getEffectiveLocale, localeIdToSupported } from '../../../core/locale-from-path';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { QuizStoreService, type QuizQuestion } from '../data/quiz-store.service';
import { LearningObjectiveDerivationClient } from './learning-objective-derivation.client';
import {
  LEARNING_OBJECTIVE_DERIVATION_PROGRESS_POLL_MS,
  derivationGroupScaleTicks as buildDerivationGroupScaleTicks,
  derivationProgressPercent,
  estimateRemainingDerivationMinutes,
  estimateRemainingDerivationMs,
  splitDerivationDuration,
} from './learning-objective-derivation-progress';
import {
  UpdateBannerSuppressionService,
  bindUpdateBannerSuppression,
} from '../../../core/update-banner-suppression.service';

type DerivationUiStatus = 'idle' | 'pending' | LearningObjectiveDerivationResult['status'];

export function isQuizQuestionEligibleForLearningObjectiveDerivation(
  question: QuizQuestion,
): boolean {
  if (!question.enabled) return false;
  switch (question.type) {
    case 'MULTIPLE_CHOICE':
    case 'SINGLE_CHOICE':
      return question.answers.some((answer) => answer.isCorrect);
    case 'SHORT_TEXT':
    case 'NUMERIC_ESTIMATE':
    case 'MATCHING':
    case 'ORDERING':
    case 'CATEGORIZATION':
      return true;
    case 'FREETEXT':
    case 'SURVEY':
    case 'RATING':
    default:
      return false;
  }
}

export function mapQuestionForLearningObjectiveDerivation(
  question: QuizQuestion,
): LearningObjectiveDerivationQuestion {
  return LearningObjectiveDerivationQuestionSchema.parse({
    sourceQuestionId: question.id,
    enabled: question.enabled,
    text: question.text,
    type: question.type,
    difficulty: question.difficulty,
    order: question.order,
    timer: question.timer ?? null,
    answers: question.answers.map(({ text, isCorrect }) => ({ text, isCorrect })),
    skipReadingPhase: question.skipReadingPhase ?? false,
    ...(question.type === 'RATING'
      ? {
          ratingMin: question.ratingMin ?? undefined,
          ratingMax: question.ratingMax ?? undefined,
          ratingLabelMin: question.ratingLabelMin ?? undefined,
          ratingLabelMax: question.ratingLabelMax ?? undefined,
        }
      : {}),
    ...(question.type === 'SHORT_TEXT'
      ? {
          shortTextEvaluationKind: question.shortTextEvaluationKind ?? undefined,
          shortTextMaxLength: question.shortTextMaxLength ?? undefined,
          shortTextCaseSensitive: question.shortTextCaseSensitive ?? undefined,
          shortTextEvaluationMode: question.shortTextEvaluationMode ?? undefined,
          shortTextToleranceLevel: question.shortTextToleranceLevel ?? undefined,
          shortTextAllowPartialCredit: question.shortTextAllowPartialCredit ?? undefined,
          shortTextTrimWhitespace: question.shortTextTrimWhitespace ?? undefined,
          shortTextNormalizeWhitespace: question.shortTextNormalizeWhitespace ?? undefined,
          numericInputKind: question.numericInputKind ?? undefined,
          numericToleranceMode: isNumericToleranceMode(question.numericToleranceMode)
            ? question.numericToleranceMode
            : undefined,
          numericAbsoluteTolerance: question.numericAbsoluteTolerance ?? undefined,
          numericRelativeTolerancePercent: question.numericRelativeTolerancePercent ?? undefined,
          numericUnitFamily: question.numericUnitFamily ?? undefined,
          numericRequireUnit: question.numericRequireUnit ?? undefined,
          numericAcceptEquivalentUnits: question.numericAcceptEquivalentUnits ?? undefined,
        }
      : {}),
    ...(question.type === 'NUMERIC_ESTIMATE'
      ? {
          numericToleranceMode: resolveNumericEstimateToleranceMode(question.numericToleranceMode),
          numericReferenceValue: question.numericReferenceValue ?? undefined,
          numericTolerancePercent: question.numericTolerancePercent ?? undefined,
          numericIntervalLeft: question.numericIntervalLeft ?? undefined,
          numericIntervalRight: question.numericIntervalRight ?? undefined,
          numericInputType: question.numericInputType ?? undefined,
          numericDecimalPlaces: question.numericDecimalPlaces ?? undefined,
          numericMin: question.numericMin ?? undefined,
          numericMax: question.numericMax ?? undefined,
          numericTwoRounds: question.numericTwoRounds ?? undefined,
        }
      : {}),
    ...(question.type === 'MATCHING'
      ? {
          matchingPairs: question.matchingPairs ?? undefined,
          matchingShuffleRight: question.matchingShuffleRight ?? true,
        }
      : {}),
    ...(question.type === 'ORDERING' ? { orderingItems: question.orderingItems ?? undefined } : {}),
    ...(question.type === 'CATEGORIZATION'
      ? {
          categories: question.categories ?? undefined,
          categorizationItems: question.categorizationItems ?? undefined,
          categorizationShuffleItems: question.categorizationShuffleItems ?? true,
        }
      : {}),
    ...(questionSupportsConfidence(question.type)
      ? {
          confidenceEnabled: question.confidenceEnabled ?? false,
          confidenceLabelLow: question.confidenceLabelLow ?? undefined,
          confidenceLabelHigh: question.confidenceLabelHigh ?? undefined,
        }
      : {}),
  });
}

@Component({
  selector: 'app-quiz-learning-objectives',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatProgressBar,
    MatProgressSpinner,
  ],
  templateUrl: './quiz-learning-objectives.component.html',
  styleUrl: './quiz-learning-objectives.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizLearningObjectivesComponent {
  private readonly quizStore = inject(QuizStoreService);
  private readonly derivationClient = inject(LearningObjectiveDerivationClient);
  private readonly injector = inject(Injector);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = getEffectiveLocale(localeIdToSupported(inject(LOCALE_ID)));
  private readonly questionMarkdownCache = new Map<string, SafeHtml>();
  private readonly objectiveMarkdownCache = new Map<string, SafeHtml>();
  private derivationAbortController: AbortController | null = null;
  private derivationSequence = 0;
  private derivationProgressPollSequence = 0;
  private derivationProgressAppliedPollSequence = 0;
  private derivationProgressTimer: ReturnType<typeof setInterval> | null = null;

  readonly quizId = input.required<string>();
  readonly questions = input.required<readonly QuizQuestion[]>();
  readonly focusedQuestionId = input<string | null>(null);
  readonly panelExpanded = signal(false);

  readonly maxTextLength = LEARNING_OBJECTIVE_TEXT_MAX_LENGTH;
  readonly maxObjectives = LEARNING_OBJECTIVE_MAX_OBJECTIVES;
  readonly maxReferences = LEARNING_OBJECTIVE_MAX_REFERENCES;
  readonly referenceLimitMessage = $localize`:@@learningObjectives.referenceLimit:Höchstens ${this.maxReferences}:maxReferences: Fragen können einem Lernziel zugeordnet werden.`;
  readonly bundle = computed(() => this.quizStore.getLearningObjectiveBundle(this.quizId()));
  readonly allObjectives = computed(() => this.bundle().objectives);
  readonly objectives = computed(() => {
    const focusedId = this.focusedQuestionId();
    const list = this.allObjectives();
    if (!focusedId) return list;
    return list.filter(
      (objective) =>
        objective.scope.kind === 'question-set' &&
        objective.scope.sourceQuestionIds.includes(focusedId),
    );
  });
  readonly eligibleQuestions = computed(() => {
    const focusedId = this.focusedQuestionId();
    return this.questions()
      .filter((question) => !focusedId || question.id === focusedId)
      .filter(isQuizQuestionEligibleForLearningObjectiveDerivation);
  });
  readonly hasEligibleQuestionsForDerivation = computed(() => this.eligibleQuestions().length > 0);
  readonly syncConflicts = computed(() =>
    this.quizStore
      .learningObjectiveSyncConflicts()
      .filter((conflict) => conflict.quizId === this.quizId()),
  );
  readonly syncError = this.quizStore.learningObjectiveSyncError;
  readonly questionIds = computed(() => new Set(this.questions().map((question) => question.id)));
  readonly formOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editingExpectedRevision = signal<number | null>(null);
  readonly text = signal('');
  readonly scopeKind = signal<'quiz-wide' | 'question-set'>('quiz-wide');
  readonly selectedQuestionIds = signal<ReadonlySet<string>>(new Set());
  readonly confirmationState = signal<'draft' | 'confirmed'>('draft');
  readonly pendingDeleteId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly derivationStatus = signal<DerivationUiStatus>('idle');
  readonly derivationMessage = signal<string | null>(null);
  readonly derivationLimitations = signal<readonly string[]>([]);
  readonly derivationProgress = signal<LearningObjectiveDerivationProgress | null>(null);
  readonly derivationProgressPercent = computed(() =>
    derivationProgressPercent(this.derivationProgress()),
  );
  readonly derivationGroupScaleTicks = computed(() =>
    buildDerivationGroupScaleTicks(this.derivationProgress()).map((tick) => ({
      ...tick,
      label: formatLocaleCount(tick.value, this.locale),
    })),
  );
  readonly derivationGroupScaleLabel = computed(() => {
    const progress = this.derivationProgress();
    if (!progress || progress.totalGroups <= 0) return null;
    const completed = formatLocaleCount(progress.completedGroups, this.locale);
    const total = formatLocaleCount(progress.totalGroups, this.locale);
    return $localize`:@@learningObjectives.derivationGroupsScale:Fertig sind ${completed}:completed: von ${total}:total: Fragegruppen.`;
  });
  readonly derivationRemainingEstimate = computed(() => {
    const minutes = estimateRemainingDerivationMinutes(
      estimateRemainingDerivationMs(this.derivationProgress()),
    );
    if (minutes === null) return null;
    if (minutes === 0) {
      return $localize`:@@learningObjectives.derivationRemainingUnderMinute:Noch weniger als eine Minute.`;
    }
    if (minutes === 1) {
      return $localize`:@@learningObjectives.derivationRemainingMinute:Noch etwa 1 Minute.`;
    }
    const count = formatLocaleCount(minutes, this.locale);
    return $localize`:@@learningObjectives.derivationRemainingMinutes:Noch etwa ${count}:minutes: Minuten.`;
  });
  readonly derivationQueuedObjectivesLabel = computed(() => {
    const count = this.derivationProgress()?.queuedObjectives ?? 0;
    if (count <= 0) return null;
    const formatted = formatLocaleCount(count, this.locale);
    return count === 1
      ? $localize`:@@learningObjectives.derivationQueuedObjective:1 Lernziel ist schon formuliert, aber noch nicht in der Liste.`
      : $localize`:@@learningObjectives.derivationQueuedObjectives:${formatted}:count: Lernziele sind schon formuliert, aber noch nicht in der Liste.`;
  });
  readonly derivationIsPending = computed(() => this.derivationStatus() === 'pending');
  readonly confirmAllInProgress = signal(false);
  private readonly updateBannerSuppression = inject(UpdateBannerSuppressionService);
  private readonly objectiveFormBaseline = signal<string | null>(null);
  readonly confirmableGeneratedObjectives = computed(() => {
    const knownQuestionIds = this.questionIds();
    const editingId = this.editingId();
    return this.objectives().filter((objective) => {
      if (objective.id === editingId) return false;
      if (objective.origin.kind !== 'model-derived') return false;
      if (objective.confirmation.state === 'confirmed') return false;
      if (this.hasSyncConflict(objective.id)) return false;
      const scopeQuestionIds =
        objective.scope.kind === 'question-set' ? objective.scope.sourceQuestionIds : [];
      if (scopeQuestionIds.some((questionId) => !knownQuestionIds.has(questionId))) return false;
      return !objective.origin.derivedFromSourceQuestionIds.some(
        (questionId) => !knownQuestionIds.has(questionId),
      );
    });
  });
  readonly derivationCanRetry = computed(() =>
    [
      'busy',
      'aborted',
      'timeout',
      'unavailable',
      'invalid_response',
      'circuit_open',
      'input_too_large',
    ].includes(this.derivationStatus()),
  );

  private readonly textArea = viewChild<ElementRef<HTMLTextAreaElement>>('objectiveText');

  constructor() {
    bindUpdateBannerSuppression(this.updateBannerSuppression, 'learning-objective-draft', () =>
      this.learningObjectiveDraftBlocksUpdateBanner(),
    );
    this.destroyRef.onDestroy(() => {
      this.derivationSequence += 1;
      this.stopDerivationProgressPolling();
      this.derivationAbortController?.abort();
      this.derivationAbortController = null;
    });
  }

  private learningObjectiveDraftBlocksUpdateBanner(): boolean {
    if (this.derivationIsPending() || this.confirmAllInProgress()) return true;
    const baseline = this.objectiveFormBaseline();
    if (!this.formOpen() || baseline === null) return false;
    return this.serializeObjectiveForm() !== baseline;
  }

  private captureObjectiveFormBaseline(): void {
    this.objectiveFormBaseline.set(this.serializeObjectiveForm());
  }

  private serializeObjectiveForm(): string {
    return JSON.stringify({
      text: this.text().trim(),
      scopeKind: this.scopeKind(),
      questionIds: [...this.selectedQuestionIds()].sort(),
      confirmation: this.confirmationState(),
    });
  }

  async deriveLearningObjectives(): Promise<void> {
    if (this.derivationIsPending()) return;

    const operationId = globalThis.crypto.randomUUID();
    const expectedBundleRevision = this.bundle().revision;
    const maximumDrafts = this.maxObjectives - this.allObjectives().length;
    if (maximumDrafts <= 0) {
      this.finishDerivation(
        'unavailable',
        $localize`:@@learningObjectives.derivationCapacity:Für weitere Vorschläge ist kein Platz. Lösche zuerst nicht mehr benötigte Lernziele.`,
      );
      return;
    }
    let questions: LearningObjectiveDerivationQuestion[];
    try {
      const focusedId = this.focusedQuestionId();
      questions = [...this.questions()]
        .filter((question) => !focusedId || question.id === focusedId)
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
        .map(mapQuestionForLearningObjectiveDerivation);
    } catch {
      this.finishDerivation(
        'invalid_response',
        $localize`:@@learningObjectives.derivationInvalidQuiz:Mindestens eine Frage kann nicht sicher für die automatische Herleitung verwendet werden. Prüfe das Quiz und versuche es erneut.`,
      );
      return;
    }
    if (questions.length === 0) {
      this.finishDerivation(
        'no_eligible_questions',
        $localize`:@@learningObjectives.derivationNoEligible:Es gibt noch keine geeignete aktive Frage mit Lösung.`,
      );
      return;
    }

    const sourceSnapshots = new Map(
      questions.map((question) => [question.sourceQuestionId, JSON.stringify(question)]),
    );
    const sequence = ++this.derivationSequence;
    const controller = new AbortController();
    this.derivationAbortController = controller;
    this.derivationStatus.set('pending');
    this.derivationProgress.set(null);
    this.derivationMessage.set(this.derivationPendingMessage());
    this.derivationLimitations.set([]);
    this.focusElement('learning-objective-derive-cancel');
    this.startDerivationProgressPolling({
      schemaVersion: LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
      operationId,
      quizId: this.quizId(),
      expectedBundleRevision,
    });

    try {
      const prepared = await this.derivationClient.prepare({
        schemaVersion: 1,
        operationId,
        quizId: this.quizId(),
        expectedBundleRevision,
      });
      if (!this.isCurrentDerivation(sequence, controller)) return;

      const result = await this.derivationClient.derive(
        RunLearningObjectiveDerivationInputSchema.parse({
          schemaVersion: 1,
          operationId,
          quizId: this.quizId(),
          expectedBundleRevision,
          maximumDrafts,
          locale: this.locale,
          capability: prepared.capability,
          questions,
        }),
        controller.signal,
      );
      if (!this.isCurrentDerivation(sequence, controller)) return;
      if (
        result.operationId !== operationId ||
        result.quizId !== this.quizId() ||
        result.expectedBundleRevision !== expectedBundleRevision
      ) {
        this.finishDerivation(
          'invalid_response',
          $localize`:@@learningObjectives.derivationInvalidResponse:Die Antwort konnte nicht sicher zugeordnet werden. Deine Lernziele bleiben unverändert.`,
        );
        return;
      }
      if (result.status !== 'completed') {
        this.finishDerivation(result.status, this.derivationStatusMessage(result));
        return;
      }
      if (this.bundle().revision !== expectedBundleRevision) {
        this.finishDerivation(
          'unavailable',
          $localize`:@@learningObjectives.derivationBundleConflict:Die Lernziele wurden während der automatischen Herleitung geändert. Deine Änderungen bleiben erhalten. Starte die Herleitung erneut.`,
        );
        return;
      }

      const remainingCapacity = Math.max(0, this.maxObjectives - this.allObjectives().length);
      const draftsToApply = result.drafts.slice(0, remainingCapacity);
      const omittedForCapacity = result.drafts.length - draftsToApply.length;

      let currentSourceSnapshots: Map<string, string>;
      try {
        currentSourceSnapshots = new Map(
          [...this.questions()]
            .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
            .map(mapQuestionForLearningObjectiveDerivation)
            .map((question) => [question.sourceQuestionId, JSON.stringify(question)]),
        );
      } catch {
        currentSourceSnapshots = new Map();
      }
      const referencedQuestionIds = new Set(
        draftsToApply.flatMap((draft) => draft.origin.derivedFromSourceQuestionIds),
      );
      const sourceChanged = [...referencedQuestionIds].some(
        (questionId) => sourceSnapshots.get(questionId) !== currentSourceSnapshots.get(questionId),
      );
      if (sourceChanged) {
        this.finishDerivation(
          'unavailable',
          $localize`:@@learningObjectives.derivationSourceChanged:Mindestens eine verwendete Frage wurde während der automatischen Herleitung geändert oder deaktiviert. Deine Lernziele bleiben unverändert. Starte die Herleitung erneut.`,
        );
        return;
      }

      try {
        const applied = this.quizStore.applyDerivedLearningObjectiveDrafts(
          this.quizId(),
          expectedBundleRevision,
          operationId,
          draftsToApply,
        );
        this.derivationLimitations.set([
          ...result.limitations,
          ...(omittedForCapacity > 0
            ? [
                $localize`:@@learningObjectives.derivationCapacityLimitation:Nicht übernommene Vorschläge: ${omittedForCapacity}:count:. Der Platz für bestehende Lernziele blieb reserviert.`,
              ]
            : []),
        ]);
        this.finishDerivation(
          'completed',
          applied.length === 0
            ? $localize`:@@learningObjectives.derivationCompletedEmpty:Die Herleitung ist abgeschlossen. Es wurden keine neuen Vorschläge hinzugefügt.`
            : applied.length === 1
              ? $localize`:@@learningObjectives.derivationCompletedSingle:Ein Lernzielvorschlag wurde als Entwurf hinzugefügt. Prüfe ihn vor dem Bestätigen.`
              : $localize`:@@learningObjectives.derivationCompleted:${applied.length}:count: Lernzielvorschläge wurden als Entwürfe hinzugefügt. Prüfe sie vor dem Bestätigen.`,
          applied[0] ? `learning-objective-edit-${applied[0].id}` : undefined,
        );
      } catch (error) {
        this.finishDerivation(
          'unavailable',
          error instanceof Error
            ? error.message
            : $localize`:@@learningObjectives.derivationApplyFailed:Die Vorschläge konnten nicht gespeichert werden. Deine bisherigen Lernziele bleiben erhalten.`,
        );
      }
    } catch {
      if (sequence !== this.derivationSequence || controller.signal.aborted) return;
      this.finishDerivation(
        'unavailable',
        $localize`:@@learningObjectives.derivationUnavailable:Die lokale Text-KI ist gerade nicht erreichbar. Du kannst Lernziele manuell eintragen oder es später erneut versuchen.`,
      );
    }
  }

  cancelLearningObjectiveDerivation(): void {
    if (!this.derivationIsPending()) return;
    this.derivationSequence += 1;
    this.derivationAbortController?.abort();
    this.finishDerivation(
      'aborted',
      this.derivationInterruptedMessage('aborted', this.derivationProgress()),
    );
  }

  beginAdd(): void {
    const focusedId = this.focusedQuestionId();
    this.editingId.set(null);
    this.editingExpectedRevision.set(null);
    this.text.set('');
    this.scopeKind.set(focusedId ? 'question-set' : 'quiz-wide');
    this.selectedQuestionIds.set(focusedId ? new Set([focusedId]) : new Set());
    this.confirmationState.set('confirmed');
    this.pendingDeleteId.set(null);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.formOpen.set(true);
    this.captureObjectiveFormBaseline();
    this.focusTextArea();
  }

  beginEdit(objective: QuizLearningObjectiveV1): void {
    this.editingId.set(objective.id);
    this.editingExpectedRevision.set(objective.revision);
    this.text.set(objective.text);
    this.scopeKind.set(objective.scope.kind);
    this.selectedQuestionIds.set(
      new Set(objective.scope.kind === 'question-set' ? objective.scope.sourceQuestionIds : []),
    );
    this.confirmationState.set(
      objective.confirmation.state === 'confirmed' ? 'confirmed' : 'draft',
    );
    this.pendingDeleteId.set(null);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.formOpen.set(true);
    this.captureObjectiveFormBaseline();
    this.focusTextArea();
  }

  confirmAllGeneratedObjectives(): void {
    if (this.derivationIsPending() || this.confirmAllInProgress()) return;
    const targets = this.confirmableGeneratedObjectives();
    if (targets.length === 0) return;

    this.confirmAllInProgress.set(true);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    let confirmed = 0;
    let failureMessage: string | null = null;
    try {
      for (const objective of targets) {
        this.quizStore.saveQuizLearningObjective(
          this.quizId(),
          {
            text: objective.text,
            scope: objective.scope,
            confirmationState: 'confirmed',
          },
          { objectiveId: objective.id, expectedRevision: objective.revision },
        );
        confirmed += 1;
      }
    } catch (error) {
      failureMessage =
        error instanceof Error
          ? error.message
          : $localize`:@@learningObjectives.confirmAllGeneratedFailed:Die Vorschläge konnten nicht bestätigt werden.`;
    } finally {
      this.confirmAllInProgress.set(false);
    }

    if (confirmed > 0) {
      const remainingGenerated = this.objectives().filter(
        (objective) =>
          objective.origin.kind === 'model-derived' && objective.confirmation.state !== 'confirmed',
      ).length;
      this.statusMessage.set(
        remainingGenerated === 0
          ? $localize`:@@learningObjectives.confirmAllGeneratedDone:Alle KI-Vorschläge wurden bestätigt.`
          : confirmed === 1
            ? $localize`:@@learningObjectives.confirmAllGeneratedPartialOne:Ein KI-Vorschlag wurde bestätigt. Die übrigen bleiben offen.`
            : $localize`:@@learningObjectives.confirmAllGeneratedPartialMany:${confirmed}:count: KI-Vorschläge wurden bestätigt. Die übrigen bleiben offen.`,
      );
    }
    if (failureMessage) {
      // Formular ist geschlossen: Fehler sichtbar und in der Live-Region, nicht nur im Formularfeld.
      this.errorMessage.set(failureMessage);
      if (confirmed === 0) {
        this.statusMessage.set(failureMessage);
      }
    }
    this.focusAfterConfirmAll();
  }

  cancelEdit(): void {
    const editingId = this.editingId();
    this.formOpen.set(false);
    this.editingId.set(null);
    this.editingExpectedRevision.set(null);
    this.errorMessage.set(null);
    this.focusElement(
      editingId ? `learning-objective-edit-${editingId}` : 'learning-objective-add',
    );
  }

  setText(value: string): void {
    this.text.set(value);
    this.errorMessage.set(null);
  }

  setScopeKind(value: 'quiz-wide' | 'question-set'): void {
    this.scopeKind.set(value);
    this.errorMessage.set(null);
  }

  setConfirmationState(value: 'draft' | 'confirmed'): void {
    this.confirmationState.set(value);
  }

  toggleQuestion(questionId: string, checked: boolean): void {
    if (
      checked &&
      !this.selectedQuestionIds().has(questionId) &&
      this.selectedQuestionIds().size >= this.maxReferences
    ) {
      this.errorMessage.set(this.referenceLimitMessage);
      return;
    }
    this.selectedQuestionIds.update((current) => {
      const next = new Set(current);
      if (checked) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
    this.errorMessage.set(null);
  }

  removeMissingReference(questionId: string): void {
    this.toggleQuestion(questionId, false);
  }

  isQuestionSelected(questionId: string): boolean {
    return this.selectedQuestionIds().has(questionId);
  }

  isQuestionSelectionDisabled(questionId: string): boolean {
    return (
      !this.selectedQuestionIds().has(questionId) &&
      this.selectedQuestionIds().size >= this.maxReferences
    );
  }

  renderQuestionMarkdown(value: string): SafeHtml {
    const cached = this.questionMarkdownCache.get(value);
    if (cached) return cached;
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(value, {
        escapeListMarkers: true,
        headingStartLevel: 4,
        imagePolicy: 'allow-relative-and-https',
        interactive: false,
      }).html,
    );
    this.questionMarkdownCache.set(value, rendered);
    return rendered;
  }

  displayObjectiveText(value: string): string {
    return normalizeLearningObjectiveText(value, this.locale);
  }

  renderObjectiveMarkdown(value: string): SafeHtml {
    const normalized = normalizeLearningObjectiveText(value, this.locale);
    const cached = this.objectiveMarkdownCache.get(normalized);
    if (cached) return cached;
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(normalized, {
        escapeListMarkers: true,
        headingStartLevel: 4,
        imagePolicy: 'allow-relative-and-https',
        interactive: false,
      }).html,
    );
    this.objectiveMarkdownCache.set(normalized, rendered);
    return rendered;
  }

  hasSyncConflict(objectiveId: string): boolean {
    return this.syncConflicts().some((conflict) => conflict.objectiveId === objectiveId);
  }

  missingReferences(): string[] {
    const known = this.questionIds();
    return [...this.selectedQuestionIds()].filter((id) => !known.has(id));
  }

  save(): void {
    const text = this.text().trim();
    if (!text) {
      this.errorMessage.set($localize`:@@learningObjectives.textRequired:Formuliere ein Lernziel.`);
      this.focusTextArea();
      return;
    }
    if (text.length > this.maxTextLength) {
      this.errorMessage.set($localize`:@@learningObjectives.textTooLong:Das Lernziel ist zu lang.`);
      this.focusTextArea();
      return;
    }
    const selectedIds = [...this.selectedQuestionIds()];
    if (this.scopeKind() === 'question-set' && selectedIds.length === 0) {
      this.errorMessage.set(
        $localize`:@@learningObjectives.scopeRequired:Wähle mindestens eine Frage oder nutze den gesamten Quizbereich.`,
      );
      this.focusElement('learning-objective-scope-all');
      return;
    }

    const editingId = this.editingId();
    const existing = editingId
      ? this.allObjectives().find((objective) => objective.id === editingId)
      : undefined;
    const missingScopeReferences = selectedIds.filter((id) => !this.questionIds().has(id));
    if (this.confirmationState() === 'confirmed' && missingScopeReferences.length > 0) {
      this.errorMessage.set(
        $localize`:@@learningObjectives.missingScopeCannotConfirm:Ein Lernziel mit fehlendem Fragenverweis kann nicht bestätigt werden. Entferne den Verweis oder wähle einen anderen Bereich.`,
      );
      this.focusElement(`learning-objective-remove-missing-${missingScopeReferences[0]}`);
      return;
    }
    if (
      this.confirmationState() === 'confirmed' &&
      existing?.origin.kind === 'model-derived' &&
      existing.origin.derivedFromSourceQuestionIds.some((id) => !this.questionIds().has(id))
    ) {
      this.errorMessage.set(
        $localize`:@@learningObjectives.missingDerivationCannotConfirm:Die ursprüngliche Frage zu diesem KI-Vorschlag fehlt. Bitte erstelle einen neuen Vorschlag oder speichere das Ziel als Entwurf.`,
      );
      this.focusElement('learning-objective-status-draft');
      return;
    }
    try {
      const saved = this.quizStore.saveQuizLearningObjective(
        this.quizId(),
        {
          text,
          scope:
            this.scopeKind() === 'question-set'
              ? { kind: 'question-set', sourceQuestionIds: selectedIds }
              : { kind: 'quiz-wide' },
          confirmationState: this.confirmationState(),
        },
        editingId
          ? {
              objectiveId: editingId,
              expectedRevision: this.editingExpectedRevision() ?? undefined,
            }
          : undefined,
      );
      this.formOpen.set(false);
      this.editingId.set(null);
      this.editingExpectedRevision.set(null);
      this.errorMessage.set(null);
      this.statusMessage.set(
        editingId
          ? $localize`:@@learningObjectives.updated:Lernziel aktualisiert.`
          : $localize`:@@learningObjectives.created:Lernziel hinzugefügt.`,
      );
      this.focusElement(`learning-objective-edit-${saved.id}`);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : $localize`:@@learningObjectives.saveFailed:Lernziel konnte nicht gespeichert werden.`,
      );
      this.focusTextArea();
    }
  }

  requestDelete(objective: QuizLearningObjectiveV1): void {
    this.pendingDeleteId.set(objective.id);
    this.statusMessage.set(
      $localize`:@@learningObjectives.deletePrompt:Löschen bestätigen oder abbrechen.`,
    );
    this.focusElement(`learning-objective-confirm-delete-${objective.id}`);
  }

  cancelDelete(objectiveId: string): void {
    this.pendingDeleteId.set(null);
    this.statusMessage.set(null);
    this.focusElement(`learning-objective-delete-${objectiveId}`);
  }

  confirmDelete(objective: QuizLearningObjectiveV1): void {
    try {
      this.quizStore.deleteQuizLearningObjective(this.quizId(), objective.id, objective.revision);
      this.pendingDeleteId.set(null);
      this.statusMessage.set($localize`:@@learningObjectives.deleted:Lernziel gelöscht.`);
      this.formOpen.set(false);
      this.editingId.set(null);
      this.editingExpectedRevision.set(null);
      this.focusElement('learning-objective-add');
    } catch (error) {
      this.pendingDeleteId.set(null);
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : $localize`:@@learningObjectives.deleteFailed:Lernziel konnte nicht gelöscht werden.`,
      );
      this.focusElement(`learning-objective-edit-${objective.id}`);
    }
  }

  resolveSyncConflict(objectiveId: string, operationId: string): void {
    try {
      this.quizStore.resolveQuizLearningObjectiveSyncConflict(
        this.quizId(),
        objectiveId,
        operationId,
      );
      this.errorMessage.set(null);
      this.statusMessage.set(
        $localize`:@@learningObjectives.syncConflictResolved:Synchronisierungskonflikt gelöst.`,
      );
      const stillExists = this.objectives().some((objective) => objective.id === objectiveId);
      this.focusElement(
        stillExists ? `learning-objective-edit-${objectiveId}` : 'learning-objective-add',
      );
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : $localize`:@@learningObjectives.syncConflictResolveFailed:Der Synchronisierungskonflikt konnte nicht gelöst werden.`,
      );
    }
  }

  statusLabel(objective: QuizLearningObjectiveV1): string {
    switch (objective.confirmation.state) {
      case 'confirmed':
        return $localize`:@@learningObjectives.statusConfirmed:Bestätigt`;
      case 'needs-review':
        return $localize`:@@learningObjectives.statusNeedsReview:Prüfung nötig`;
      default:
        return $localize`:@@learningObjectives.statusDraft:Entwurf`;
    }
  }

  scopeLabel(objective: QuizLearningObjectiveV1): string {
    if (objective.scope.kind === 'quiz-wide') {
      return $localize`:@@learningObjectives.scopeQuizWide:Gesamtes Quiz`;
    }
    return $localize`:@@learningObjectives.scopeQuestionCount:${objective.scope.sourceQuestionIds.length}:count: Frage(n)`;
  }

  originLabel(objective: QuizLearningObjectiveV1): string {
    return objective.origin.kind === 'model-derived'
      ? $localize`:@@learningObjectives.modelDerived:KI-Vorschlag`
      : $localize`:@@learningObjectives.manualOrigin:Manuell erstellt`;
  }

  conflictChoiceAriaLabel(objective: QuizLearningObjectiveV1): string {
    return $localize`:@@learningObjectives.useConflictVersionAria:Fassung übernehmen: ${this.displayObjectiveText(objective.text)}:text:; ${this.statusLabel(objective)}:status:; ${this.scopeLabel(objective)}:scope:; ${this.originLabel(objective)}:origin:`;
  }

  reviewReason(objective: QuizLearningObjectiveV1): string | null {
    if (objective.confirmation.state !== 'needs-review') return null;
    return objective.confirmation.reason === 'source-reference-removed'
      ? $localize`:@@learningObjectives.reviewReferenceRemoved:Eine verknüpfte Frage wurde gelöscht. Prüfe die Zuordnung.`
      : $localize`:@@learningObjectives.reviewSourceChanged:Die verknüpfte Frage hat sich geändert. Bitte prüfe das Lernziel.`;
  }

  private isCurrentDerivation(sequence: number, controller: AbortController): boolean {
    return (
      sequence === this.derivationSequence &&
      !controller.signal.aborted &&
      this.derivationAbortController === controller
    );
  }

  private startDerivationProgressPolling(input: {
    schemaVersion: typeof LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION;
    operationId: string;
    quizId: string;
    expectedBundleRevision: number;
  }): void {
    this.stopDerivationProgressPolling();
    this.derivationProgressPollSequence = 0;
    this.derivationProgressAppliedPollSequence = 0;
    const sequence = this.derivationSequence;
    const poll = (): void => {
      const pollSequence = ++this.derivationProgressPollSequence;
      void this.derivationClient
        .progress(input)
        .then((snapshot) => {
          if (
            pollSequence <= this.derivationProgressAppliedPollSequence ||
            sequence !== this.derivationSequence ||
            !this.derivationIsPending() ||
            !snapshot.found ||
            !snapshot.progress
          ) {
            return;
          }
          this.derivationProgressAppliedPollSequence = pollSequence;
          this.derivationProgress.set(snapshot.progress);
          this.derivationMessage.set(this.derivationPendingMessage());
        })
        .catch(() => undefined);
    };
    poll();
    this.derivationProgressTimer = setInterval(
      poll,
      LEARNING_OBJECTIVE_DERIVATION_PROGRESS_POLL_MS,
    );
  }

  private stopDerivationProgressPolling(): void {
    if (this.derivationProgressTimer) {
      clearInterval(this.derivationProgressTimer);
      this.derivationProgressTimer = null;
    }
  }

  private finishDerivation(
    status: Exclude<DerivationUiStatus, 'idle' | 'pending'>,
    message: string,
    preferredFocusId?: string,
  ): void {
    this.stopDerivationProgressPolling();
    this.derivationAbortController = null;
    this.derivationStatus.set(status);
    this.derivationMessage.set(message);
    if (status !== 'completed') this.derivationLimitations.set([]);
    const startRemainsEnabled = this.allObjectives().length < this.maxObjectives;
    this.focusElement(
      preferredFocusId ??
        (status !== 'completed' && startRemainsEnabled
          ? 'learning-objective-derive'
          : 'learning-objective-derivation-status'),
    );
  }

  private derivationStatusMessage(result: LearningObjectiveDerivationResult): string {
    switch (result.status) {
      case 'busy':
        return $localize`:@@learningObjectives.derivationBusy:Die lokale Text-KI ist gerade ausgelastet. Deine Lernziele bleiben unverändert. Bitte versuche es gleich noch einmal.`;
      case 'disabled':
        return $localize`:@@learningObjectives.derivationDisabled:Automatische Vorschläge sind auf diesem System nicht aktiviert. Du kannst Lernziele weiterhin manuell formulieren.`;
      case 'aborted':
        return this.derivationInterruptedMessage('aborted', result.progress);
      case 'timeout':
        return this.derivationInterruptedMessage('timeout', result.progress);
      case 'unavailable':
        return $localize`:@@learningObjectives.derivationUnavailable:Die lokale Text-KI ist gerade nicht erreichbar. Du kannst Lernziele manuell eintragen oder es später erneut versuchen.`;
      case 'invalid_response':
        return $localize`:@@learningObjectives.derivationInvalidResponse:Die Antwort konnte nicht sicher zugeordnet werden. Deine Lernziele bleiben unverändert.`;
      case 'misconfigured':
        return $localize`:@@learningObjectives.derivationMisconfigured:Automatische Vorschläge sind auf diesem System noch nicht vollständig eingerichtet. Du kannst Lernziele weiterhin manuell formulieren.`;
      case 'circuit_open':
        return $localize`:@@learningObjectives.derivationCircuitOpen:Die automatische Erstellung steht kurzzeitig nicht zur Verfügung. Bitte versuche es in einem Moment noch einmal.`;
      case 'no_eligible_questions':
        return $localize`:@@learningObjectives.derivationNoEligible:Es gibt noch keine geeignete aktive Frage mit Lösung.`;
      case 'input_too_large':
        return $localize`:@@learningObjectives.derivationInputTooLarge:Mindestens eine Frage enthält zu viel Inhalt für die automatische Herleitung. Kürze sie und versuche es erneut.`;
      case 'completed':
        return $localize`:@@learningObjectives.derivationCompletedEmpty:Die Herleitung ist abgeschlossen. Es wurden keine neuen Vorschläge hinzugefügt.`;
    }
  }

  private derivationPendingMessage(): string {
    return $localize`:@@learningObjectives.derivationPendingGroupsIntro:Die Lernziele werden nacheinander aus Fragegruppen formuliert.`;
  }

  private derivationInterruptedMessage(
    reason: 'aborted' | 'timeout',
    progress: LearningObjectiveDerivationProgress | null,
  ): string {
    const why =
      reason === 'timeout'
        ? $localize`:@@learningObjectives.derivationTimeoutWhy:Die Zeit für die gesamte Erstellung ist abgelaufen.`
        : $localize`:@@learningObjectives.derivationAbortedWhy:Die Erstellung wurde abgebrochen.`;
    const unchanged = $localize`:@@learningObjectives.derivationUnchanged:Deine Lernziele bleiben unverändert.`;
    if (!progress || (progress.totalGroups <= 0 && progress.elapsedMs <= 0)) {
      return `${why} ${unchanged}`;
    }
    const parts = [why];
    if (progress.totalGroups > 0) {
      const completed = formatLocaleCount(progress.completedGroups, this.locale);
      const total = formatLocaleCount(progress.totalGroups, this.locale);
      parts.push(
        $localize`:@@learningObjectives.derivationInterruptedGroups:Fertig waren ${completed}:completed: von ${total}:total: Fragegruppen.`,
      );
    }
    if (progress.elapsedMs >= 1000) {
      parts.push(
        $localize`:@@learningObjectives.derivationInterruptedDuration:Dauer: ${this.formatDerivationDuration(progress.elapsedMs)}:duration:.`,
      );
    }
    if (progress.promptTokens > 0 || progress.completionTokens > 0) {
      const read = formatLocaleCount(progress.promptTokens, this.locale);
      const written = formatLocaleCount(progress.completionTokens, this.locale);
      parts.push(
        $localize`:@@learningObjectives.derivationInterruptedVolume:Bisheriger Umfang: ${read}:read: gelesene und ${written}:written: formulierte Texteinheiten.`,
      );
    }
    parts.push(unchanged);
    return parts.join(' ');
  }

  private formatDerivationDuration(elapsedMs: number): string {
    const { minutes, seconds } = splitDerivationDuration(elapsedMs);
    const minuteLabel = formatLocaleCount(minutes, this.locale);
    const secondLabel = formatLocaleCount(seconds, this.locale);
    if (minutes === 0) {
      return $localize`:@@learningObjectives.derivationDurationSeconds:${secondLabel}:seconds: Sekunden`;
    }
    if (seconds === 0) {
      return minutes === 1
        ? $localize`:@@learningObjectives.derivationDurationMinute:1 Minute`
        : $localize`:@@learningObjectives.derivationDurationMinutes:${minuteLabel}:minutes: Minuten`;
    }
    return $localize`:@@learningObjectives.derivationDurationMinutesSeconds:${minuteLabel}:minutes: Minuten und ${secondLabel}:seconds: Sekunden`;
  }

  private focusTextArea(): void {
    const focus = (): void => this.textArea()?.nativeElement.focus();
    queueMicrotask(focus);
    afterNextRender(focus, { injector: this.injector });
  }

  private focusAfterConfirmAll(): void {
    if (this.formOpen()) return;
    if (this.confirmableGeneratedObjectives().length > 0) {
      this.focusElement('learning-objective-confirm-all');
      return;
    }
    const addButton = globalThis.document?.getElementById('learning-objective-add');
    if (addButton instanceof HTMLButtonElement && !addButton.disabled) {
      this.focusElement('learning-objective-add');
      return;
    }
    const firstObjective = this.objectives()[0];
    if (firstObjective) {
      this.focusElement(`learning-objective-edit-${firstObjective.id}`);
    }
  }

  private focusElement(id: string): void {
    const focus = (): void => {
      const target = globalThis.document?.getElementById(id);
      if (!(target instanceof HTMLElement) || target.hasAttribute('disabled')) return;
      const focusTarget = target.matches('button, input, textarea, select, [tabindex]')
        ? target
        : target.querySelector<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
      focusTarget?.focus();
    };
    queueMicrotask(focus);
    afterNextRender(focus, { injector: this.injector });
  }
}
