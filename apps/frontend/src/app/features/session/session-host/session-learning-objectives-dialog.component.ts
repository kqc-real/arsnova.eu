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
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import {
  LEARNING_OBJECTIVE_MAX_OBJECTIVES,
  LEARNING_OBJECTIVE_MAX_REFERENCES,
  LEARNING_OBJECTIVE_TEXT_MAX_LENGTH,
  normalizeLearningObjectiveText,
  type DeriveSessionLearningObjectivesResult,
  type SessionLearningObjectiveDTO,
  type SessionLearningObjectiveResolvedTaskReference,
  type SessionLearningObjectivesSnapshot,
} from '@arsnova/shared-types';
import { getEffectiveLocale, localeIdToSupported } from '../../../core/locale-from-path';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { trpc } from '../../../core/trpc.client';
import {
  learningObjectiveAppliesToQuestion,
  learningObjectiveQuestionNumbers,
  quizQuestionNumberById,
  sortLearningObjectivesByQuestionNumber,
} from './session-learning-objective-match';
import {
  UpdateBannerSuppressionService,
  bindUpdateBannerSuppression,
} from '../../../core/update-banner-suppression.service';

export interface SessionLearningObjectiveTaskOption {
  reference: SessionLearningObjectiveResolvedTaskReference;
  label: string;
}

export interface SessionLearningObjectivesDialogData {
  code: string;
  hasQuiz: () => boolean;
  mode?: () => 'quiz' | 'qa';
  focusedQuestionId?: () => string | null;
  focusedQuestionEligibleForDerivation?: () => boolean;
}

type LoadState = 'loading' | 'ready' | 'error';
type ScopeKind = 'session' | 'quiz-wide' | 'question-set';
type DerivationUiStatus = 'idle' | 'pending' | DeriveSessionLearningObjectivesResult['status'];

@Component({
  selector: 'app-session-learning-objectives-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  templateUrl: './session-learning-objectives-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './session-learning-objectives-dialog.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionLearningObjectivesDialogComponent {
  readonly data = inject<SessionLearningObjectivesDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<SessionLearningObjectivesDialogComponent>);
  private readonly injector = inject(Injector);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = getEffectiveLocale(localeIdToSupported(inject(LOCALE_ID)));
  private readonly taskMarkdownCache = new Map<string, SafeHtml>();
  private readonly objectiveMarkdownCache = new Map<string, SafeHtml>();
  private derivationAbortController: AbortController | null = null;
  private derivationSequence = 0;

  readonly maxTextLength = LEARNING_OBJECTIVE_TEXT_MAX_LENGTH;
  readonly maxObjectives = LEARNING_OBJECTIVE_MAX_OBJECTIVES;
  readonly maxReferences = LEARNING_OBJECTIVE_MAX_REFERENCES;
  readonly referenceLimitMessage = $localize`:@@sessionLearningObjectives.referenceLimit:Höchstens ${this.maxReferences}:maxReferences: Aufgaben können einem Lernziel zugeordnet werden.`;
  readonly loadState = signal<LoadState>('loading');
  readonly snapshot = signal<SessionLearningObjectivesSnapshot | null>(null);
  readonly pending = signal(false);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly conflictMessage = signal<string | null>(null);
  readonly authoritativeReloadRequired = signal(false);
  readonly formOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly expectedRevision = signal<number | null>(null);
  readonly text = signal('');
  readonly scopeKind = signal<ScopeKind>('session');
  readonly selectedTaskKeys = signal<ReadonlySet<string>>(new Set());
  readonly confirmationState = signal<'draft' | 'confirmed'>('draft');
  readonly editingModelDerived = signal(false);
  readonly mustReplaceUnresolvedScope = signal(false);
  readonly hasUnresolvedDerivation = signal(false);
  readonly scopeTouched = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly derivationStatus = signal<DerivationUiStatus>('idle');
  readonly derivationMessage = signal<string | null>(null);
  readonly derivationLimitations = signal<readonly string[]>([]);
  readonly derivationIsPending = computed(() => this.derivationStatus() === 'pending');
  private readonly updateBannerSuppression = inject(UpdateBannerSuppressionService);
  private readonly objectiveFormBaseline = signal<string | null>(null);
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

  readonly isQaMode = computed(() => this.data.mode?.() === 'qa');
  readonly focusedQuestionId = computed(() =>
    this.isQaMode() ? null : (this.data.focusedQuestionId?.() ?? null),
  );
  readonly isQuestionFocused = computed(() => this.focusedQuestionId() !== null);
  readonly isReadOnly = computed(() => this.snapshot()?.access.state === 'read-only');
  readonly allObjectives = computed(() => this.snapshot()?.objectives ?? []);
  readonly objectives = computed(() => {
    const all = this.allObjectives();
    if (this.isQaMode()) {
      return all.filter((objective) => isQaForumAssignmentObjective(objective));
    }
    const learningObjectives = all.filter((objective) => !isQaForumAssignmentObjective(objective));
    const focusedId = this.focusedQuestionId();
    if (focusedId) {
      return learningObjectives.filter((objective) =>
        learningObjectiveAppliesToQuestion(objective, focusedId),
      );
    }
    return learningObjectives;
  });
  readonly confirmedObjectives = computed(() =>
    this.objectives().filter(isConfirmedLearningObjective),
  );
  readonly isAudiencePresentation = computed(() => {
    if (this.formOpen()) return false;
    if (this.isQaMode()) return this.objectives().length > 0;
    return this.confirmedObjectives().length > 0;
  });
  readonly isOverview = computed(() => !this.isQaMode() && !this.isQuestionFocused());
  private readonly questionNumberById = computed(() =>
    quizQuestionNumberById(this.snapshot()?.availableQuizTasks ?? []),
  );
  readonly visibleObjectives = computed(() => {
    const list = this.isQaMode() ? this.objectives() : this.confirmedObjectives();
    if (!this.isOverview()) return list;
    return sortLearningObjectivesByQuestionNumber(list, this.snapshot()?.availableQuizTasks ?? []);
  });
  /** Ableitung und Entwürfe bleiben im Quiz-Editor. */
  readonly hasEligibleQuizTasksForDerivation = computed(() => false);

  readonly taskOptions = computed(() => {
    const byKey = new Map<string, SessionLearningObjectiveTaskOption>();
    for (const task of this.snapshot()?.availableQaTasks ?? []) {
      const reference = { kind: 'qa-question' as const, questionId: task.questionId };
      byKey.set(referenceKey(reference), {
        reference,
        label: task.text,
      });
    }
    if (!this.isQaMode()) {
      for (const task of this.snapshot()?.availableQuizTasks ?? []) {
        const reference = { kind: 'quiz-question' as const, questionId: task.questionId };
        byKey.set(referenceKey(reference), {
          reference,
          label: $localize`:@@sessionLearningObjectives.quizTaskLabel:Frage ${task.order + 1}:order:: ${task.text}:text:`,
        });
      }
    }
    for (const objective of this.objectives()) {
      if (objective.scope.kind !== 'question-set') continue;
      for (const reference of objective.scope.taskReferences) {
        if (reference.kind === 'unresolved-task') continue;
        if (this.isQaMode() && reference.kind === 'quiz-question') continue;
        const key = referenceKey(reference);
        if (!byKey.has(key)) {
          byKey.set(key, {
            reference,
            label:
              reference.kind === 'qa-question'
                ? $localize`:@@sessionLearningObjectives.qaTaskFallback:Q&A-Aufgabe`
                : $localize`:@@sessionLearningObjectives.quizTaskFallback:Frage`,
          });
        }
      }
    }
    return [...byKey.values()];
  });
  readonly selectableTaskOptions = computed(() => {
    if (this.isQaMode()) {
      return this.taskOptions().filter((option) => option.reference.kind === 'qa-question');
    }
    if (this.editingModelDerived() || this.data.hasQuiz()) {
      const quizOnly = this.taskOptions().filter(
        (option) => option.reference.kind === 'quiz-question',
      );
      if (quizOnly.length > 0 || this.editingModelDerived()) {
        return quizOnly;
      }
    }
    return this.taskOptions();
  });

  private readonly textArea = viewChild<ElementRef<HTMLTextAreaElement>>('objectiveText');

  constructor() {
    bindUpdateBannerSuppression(
      this.updateBannerSuppression,
      'session-learning-objective-draft',
      () => this.learningObjectiveDraftBlocksUpdateBanner(),
    );
    this.destroyRef.onDestroy(() => {
      this.derivationSequence += 1;
      this.derivationAbortController?.abort();
      this.derivationAbortController = null;
    });
    void this.loadSnapshot(false);
  }

  private learningObjectiveDraftBlocksUpdateBanner(): boolean {
    if (this.pending() || this.derivationIsPending()) return true;
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
      taskKeys: [...this.selectedTaskKeys()].sort(),
      confirmation: this.confirmationState(),
    });
  }

  close(): void {
    if (!this.pending() && !this.derivationIsPending()) this.dialogRef.close();
  }

  retryLoad(): void {
    void this.loadSnapshot(false);
  }

  async deriveLearningObjectives(): Promise<void> {
    if (
      !this.isQaMode() ||
      this.derivationIsPending() ||
      this.pending() ||
      this.isReadOnly() ||
      this.isQaMode()
    ) {
      return;
    }
    const snapshot = this.snapshot();
    if (!snapshot) return;

    const maximumDrafts = this.maxObjectives - this.allObjectives().length;
    if (maximumDrafts <= 0) {
      this.finishDerivation(
        'unavailable',
        $localize`:@@learningObjectives.derivationCapacity:Für weitere Vorschläge ist kein Platz. Lösche zuerst nicht mehr benötigte Lernziele.`,
      );
      return;
    }

    const operationId = generateUuid();
    const expectedLearningContextRevision = snapshot.learningContextRevision;
    const focusedId = this.focusedQuestionId();
    const sequence = ++this.derivationSequence;
    const controller = new AbortController();
    this.derivationAbortController = controller;
    this.derivationStatus.set('pending');
    this.derivationMessage.set(
      $localize`:@@learningObjectives.derivationPending:Vorschläge werden ausschließlich aus den Quizaufgaben formuliert.`,
    );
    this.derivationLimitations.set([]);
    this.dialogRef.disableClose = true;
    this.focusElement('session-learning-objective-derive-cancel');

    try {
      const result = await trpc.session.deriveLearningObjectives.mutate(
        {
          code: this.data.code,
          operationId,
          expectedLearningContextRevision,
          maximumDrafts,
          locale: this.locale,
          ...(focusedId ? { questionId: focusedId } : {}),
        },
        { signal: controller.signal },
      );
      if (!this.isCurrentDerivation(sequence, controller)) return;
      if (
        result.operationId !== operationId ||
        result.expectedLearningContextRevision !== expectedLearningContextRevision
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
      this.snapshot.set(result.snapshot);
      this.derivationLimitations.set(result.limitations);
      this.finishDerivation(
        'completed',
        result.appliedCount === 0
          ? $localize`:@@learningObjectives.derivationCompletedEmpty:Die Herleitung ist abgeschlossen. Es wurden keine neuen Vorschläge hinzugefügt.`
          : result.appliedCount === 1
            ? $localize`:@@learningObjectives.derivationCompletedSingle:Ein Lernzielvorschlag wurde als Entwurf hinzugefügt. Prüfe ihn vor dem Bestätigen.`
            : $localize`:@@learningObjectives.derivationCompleted:${result.appliedCount}:count: Lernzielvorschläge wurden als Entwürfe hinzugefügt. Prüfe sie vor dem Bestätigen.`,
      );
    } catch (error) {
      if (sequence !== this.derivationSequence || controller.signal.aborted) return;
      if (isConflictError(error)) {
        await this.loadSnapshot(true);
        this.finishDerivation(
          'unavailable',
          $localize`:@@learningObjectives.derivationBundleConflict:Die Lernziele wurden während der automatischen Herleitung geändert. Deine Änderungen bleiben erhalten. Starte die Herleitung erneut.`,
        );
        return;
      }
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
      $localize`:@@learningObjectives.derivationAborted:Die automatische Erstellung wurde abgebrochen. Deine Lernziele bleiben unverändert.`,
    );
  }

  beginAdd(): void {
    if (this.isReadOnly() || !this.isQaMode()) return;
    const focusedId = this.focusedQuestionId();
    this.editingId.set(null);
    this.expectedRevision.set(null);
    this.text.set('');
    if (focusedId) {
      const ref: SessionLearningObjectiveResolvedTaskReference = {
        kind: 'quiz-question',
        questionId: focusedId,
      };
      this.scopeKind.set('question-set');
      this.selectedTaskKeys.set(new Set([referenceKey(ref)]));
    } else if (!this.isQaMode() && this.data.hasQuiz()) {
      this.scopeKind.set('quiz-wide');
      this.selectedTaskKeys.set(new Set());
    } else {
      this.scopeKind.set('session');
      this.selectedTaskKeys.set(new Set());
    }
    this.confirmationState.set('confirmed');
    this.editingModelDerived.set(false);
    this.mustReplaceUnresolvedScope.set(false);
    this.hasUnresolvedDerivation.set(false);
    this.scopeTouched.set(false);
    this.pendingDeleteId.set(null);
    this.clearMessages();
    this.formOpen.set(true);
    this.captureObjectiveFormBaseline();
    this.focusTextArea();
  }

  beginEdit(objective: SessionLearningObjectiveDTO): void {
    if (this.isReadOnly() || !this.isQaMode()) return;
    this.editingId.set(objective.id);
    this.expectedRevision.set(objective.revision);
    this.text.set(objective.text);
    this.scopeKind.set(this.isQaMode() ? 'session' : objective.scope.kind);
    const references =
      !this.isQaMode() && objective.scope.kind === 'question-set'
        ? objective.scope.taskReferences
        : [];
    this.selectedTaskKeys.set(
      new Set(
        references
          .filter(
            (reference): reference is SessionLearningObjectiveResolvedTaskReference =>
              reference.kind !== 'unresolved-task',
          )
          .map(referenceKey),
      ),
    );
    this.confirmationState.set(
      objective.confirmation.state === 'confirmed' ? 'confirmed' : 'draft',
    );
    this.editingModelDerived.set(objective.origin.kind === 'model-derived');
    this.mustReplaceUnresolvedScope.set(
      references.some((reference) => reference.kind === 'unresolved-task'),
    );
    this.hasUnresolvedDerivation.set(
      objective.origin.kind === 'model-derived' &&
        objective.origin.derivedFrom.some((reference) => reference.kind === 'unresolved-task'),
    );
    this.scopeTouched.set(false);
    this.pendingDeleteId.set(null);
    this.clearMessages();
    this.formOpen.set(true);
    this.captureObjectiveFormBaseline();
    this.focusTextArea();
  }

  cancelEdit(): void {
    const editingId = this.editingId();
    this.formOpen.set(false);
    this.editingId.set(null);
    this.clearMessages();
    this.focusElement(
      editingId ? `session-learning-objective-edit-${editingId}` : 'session-learning-objective-add',
    );
  }

  setScopeKind(value: ScopeKind): void {
    this.scopeKind.set(value);
    this.scopeTouched.set(true);
    this.errorMessage.set(null);
  }

  setText(value: string): void {
    this.text.set(value);
    this.errorMessage.set(null);
  }

  setConfirmationState(value: 'draft' | 'confirmed'): void {
    this.confirmationState.set(value);
  }

  toggleTask(reference: SessionLearningObjectiveResolvedTaskReference, checked: boolean): void {
    const key = referenceKey(reference);
    if (
      checked &&
      !this.selectedTaskKeys().has(key) &&
      this.selectedTaskKeys().size >= this.maxReferences
    ) {
      this.errorMessage.set(this.referenceLimitMessage);
      return;
    }
    this.selectedTaskKeys.update((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
    this.scopeTouched.set(true);
    this.errorMessage.set(null);
  }

  isTaskSelected(reference: SessionLearningObjectiveResolvedTaskReference): boolean {
    return this.selectedTaskKeys().has(referenceKey(reference));
  }

  isTaskSelectionDisabled(reference: SessionLearningObjectiveResolvedTaskReference): boolean {
    const key = referenceKey(reference);
    return !this.selectedTaskKeys().has(key) && this.selectedTaskKeys().size >= this.maxReferences;
  }

  renderTaskMarkdown(value: string): SafeHtml {
    const source = value.replace(/:\s+(?=#{1,6}\s)/, ':\n\n');
    const cached = this.taskMarkdownCache.get(source);
    if (cached) return cached;
    const rendered = this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(source, {
        escapeListMarkers: true,
        headingStartLevel: 4,
        imagePolicy: 'allow-relative-and-https',
        interactive: false,
      }).html,
    );
    this.taskMarkdownCache.set(source, rendered);
    return rendered;
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

  async save(): Promise<void> {
    if (
      !this.isQaMode() ||
      !this.formOpen() ||
      this.pending() ||
      this.derivationIsPending() ||
      this.isReadOnly() ||
      this.authoritativeReloadRequired()
    ) {
      return;
    }
    const snapshot = this.snapshot();
    if (!snapshot) return;
    const text = this.text().trim();
    if (!text || text.length > this.maxTextLength) {
      this.errorMessage.set(
        !text
          ? this.isQaMode()
            ? $localize`:@@sessionQaAssignments.textRequired:Formuliere einen Auftrag.`
            : $localize`:@@sessionLearningObjectives.textRequired:Formuliere ein Lernziel.`
          : this.isQaMode()
            ? $localize`:@@sessionQaAssignments.textTooLong:Der Auftrag ist zu lang.`
            : $localize`:@@sessionLearningObjectives.textTooLong:Das Lernziel ist zu lang.`,
      );
      this.focusTextArea();
      return;
    }
    if (this.mustReplaceUnresolvedScope() && !this.scopeTouched()) {
      this.errorMessage.set(
        $localize`:@@sessionLearningObjectives.rescopeRequired:Mindestens ein Fragenverweis ist nicht mehr verfügbar. Wähle den Bereich neu, bevor du speicherst.`,
      );
      this.focusScopeChoice();
      return;
    }

    if (this.confirmationState() === 'confirmed' && this.hasUnresolvedDerivation()) {
      this.errorMessage.set(
        $localize`:@@sessionLearningObjectives.missingDerivationCannotConfirm:Die ursprüngliche Frage zu diesem KI-Vorschlag fehlt. Bitte erstelle einen neuen Vorschlag oder speichere das Ziel als Entwurf.`,
      );
      this.focusElement('session-learning-objective-status-draft');
      return;
    }

    const selected = this.selectableTaskOptions()
      .filter((option) => this.selectedTaskKeys().has(referenceKey(option.reference)))
      .map((option) => option.reference);
    if (this.scopeKind() === 'question-set' && selected.length === 0) {
      this.errorMessage.set(
        $localize`:@@sessionLearningObjectives.taskRequired:Wähle mindestens eine Frage oder einen anderen Bereich.`,
      );
      this.focusScopeChoice();
      return;
    }

    const objectiveId = this.editingId() ?? generateUuid();
    this.setPending(true);
    this.clearMessages();
    try {
      const result = await trpc.session.saveLearningObjectives.mutate({
        code: this.data.code,
        expectedLearningContextRevision: snapshot.learningContextRevision,
        mutations: [
          {
            action: 'upsert',
            objectiveId,
            expectedRevision: this.editingId() ? this.expectedRevision() : null,
            text,
            scope: this.isQaMode()
              ? { kind: 'session' }
              : this.scopeKind() === 'question-set'
                ? { kind: 'question-set', taskReferences: selected }
                : this.scopeKind() === 'session'
                  ? { kind: 'session' }
                  : { kind: 'quiz-wide' },
            confirmationState: this.isQaMode() ? 'confirmed' : this.confirmationState(),
            purpose: this.isQaMode() ? 'forum-assignment' : 'learning-objective',
          },
        ],
      });
      this.snapshot.set(result);
      this.formOpen.set(false);
      this.editingId.set(null);
      this.conflictMessage.set(null);
      this.statusMessage.set(
        this.expectedRevision() === null
          ? this.isQaMode()
            ? $localize`:@@sessionQaAssignments.created:Auftrag hinzugefügt.`
            : $localize`:@@sessionLearningObjectives.created:Lernziel hinzugefügt.`
          : this.isQaMode()
            ? $localize`:@@sessionQaAssignments.updated:Auftrag aktualisiert.`
            : $localize`:@@sessionLearningObjectives.updated:Lernziel aktualisiert.`,
      );
      this.focusElement(`session-learning-objective-edit-${objectiveId}`);
    } catch (error) {
      if (isConflictError(error)) {
        await this.handleSaveConflict(objectiveId);
      } else {
        this.errorMessage.set(
          this.isQaMode()
            ? $localize`:@@sessionQaAssignments.saveFailed:Auftrag konnte nicht gespeichert werden. Versuche es erneut.`
            : $localize`:@@sessionLearningObjectives.saveFailed:Lernziel konnte nicht gespeichert werden. Versuche es erneut.`,
        );
        this.focusTextArea();
      }
    } finally {
      this.setPending(false);
    }
  }

  requestDelete(objectiveId: string): void {
    if (this.isReadOnly() || !this.isQaMode()) return;
    this.pendingDeleteId.set(objectiveId);
    this.statusMessage.set(
      $localize`:@@sessionLearningObjectives.deletePrompt:Löschen bestätigen oder abbrechen.`,
    );
    this.focusElement(`session-learning-objective-confirm-delete-${objectiveId}`);
  }

  cancelDelete(objectiveId: string): void {
    this.pendingDeleteId.set(null);
    this.statusMessage.set(null);
    this.focusElement(`session-learning-objective-delete-${objectiveId}`);
  }

  async confirmDelete(objective: SessionLearningObjectiveDTO): Promise<void> {
    const snapshot = this.snapshot();
    if (
      !this.isQaMode() ||
      !snapshot ||
      this.pending() ||
      this.derivationIsPending() ||
      this.isReadOnly()
    ) {
      return;
    }
    this.setPending(true);
    this.clearMessages();
    try {
      const result = await trpc.session.saveLearningObjectives.mutate({
        code: this.data.code,
        expectedLearningContextRevision: snapshot.learningContextRevision,
        mutations: [
          {
            action: 'delete',
            objectiveId: objective.id,
            expectedRevision: objective.revision,
          },
        ],
      });
      this.snapshot.set(result);
      this.pendingDeleteId.set(null);
      this.statusMessage.set(
        this.isQaMode()
          ? $localize`:@@sessionQaAssignments.deleted:Auftrag gelöscht.`
          : $localize`:@@sessionLearningObjectives.deleted:Lernziel gelöscht.`,
      );
      this.focusElement('session-learning-objective-add', 'session-learning-objectives-heading');
    } catch (error) {
      if (isConflictError(error)) {
        this.authoritativeReloadRequired.set(true);
        const reloaded = await this.loadSnapshot(true);
        this.conflictMessage.set(
          reloaded
            ? $localize`:@@sessionLearningObjectives.deleteConflict:Der Stand hat sich geändert. Prüfe die neu geladene Liste und lösche bei Bedarf erneut.`
            : $localize`:@@sessionLearningObjectives.conflictReloadFailed:Der Stand hat sich geändert, konnte aber nicht neu geladen werden. Änderungen bleiben gesperrt, bis das Neuladen gelingt.`,
        );
        if (reloaded) this.authoritativeReloadRequired.set(false);
        this.pendingDeleteId.set(null);
        this.focusElement('session-learning-objectives-conflict');
      } else {
        this.errorMessage.set(
          this.isQaMode()
            ? $localize`:@@sessionQaAssignments.deleteFailed:Auftrag konnte nicht gelöscht werden.`
            : $localize`:@@sessionLearningObjectives.deleteFailed:Lernziel konnte nicht gelöscht werden.`,
        );
        this.focusElement(`session-learning-objective-delete-${objective.id}`);
      }
    } finally {
      this.setPending(false);
    }
  }

  statusLabel(objective: SessionLearningObjectiveDTO): string {
    switch (objective.confirmation.state) {
      case 'confirmed':
        return $localize`:@@sessionLearningObjectives.statusConfirmed:Bestätigt`;
      case 'needs-review':
        return $localize`:@@sessionLearningObjectives.statusNeedsReview:Prüfung nötig`;
      default:
        return $localize`:@@sessionLearningObjectives.statusDraft:Entwurf`;
    }
  }

  reviewReason(objective: SessionLearningObjectiveDTO): string | null {
    if (objective.confirmation.state !== 'needs-review') return null;
    switch (objective.confirmation.reason) {
      case 'source-reference-removed':
        return $localize`:@@sessionLearningObjectives.reviewReferenceRemoved:Eine verknüpfte Frage wurde entfernt. Ordne den Bereich neu zu oder erstelle einen neuen Vorschlag.`;
      case 'derivation-replaced':
        return $localize`:@@sessionLearningObjectives.reviewDerivationReplaced:Der Vorschlag wurde aktualisiert. Bitte prüfe das Lernziel erneut.`;
      default:
        return $localize`:@@sessionLearningObjectives.reviewSourceChanged:Die verknüpfte Frage hat sich geändert. Bitte prüfe das Lernziel erneut.`;
    }
  }

  ownershipLabel(objective: SessionLearningObjectiveDTO): string {
    switch (objective.projection) {
      case 'quiz-projected':
        return $localize`:@@sessionLearningObjectives.projected:Aus dem Quiz übernommen`;
      case 'session-override':
        return $localize`:@@sessionLearningObjectives.override:In dieser Session angepasst`;
      default:
        return $localize`:@@sessionLearningObjectives.manual:In dieser Session erstellt`;
    }
  }

  scopeLabel(objective: SessionLearningObjectiveDTO): string {
    if (objective.scope.kind === 'session') {
      return $localize`:@@sessionLearningObjectives.scopeSession:Ganze Session`;
    }
    if (objective.scope.kind === 'quiz-wide') {
      return $localize`:@@sessionLearningObjectives.scopeQuiz:Gesamtes Quiz`;
    }
    return $localize`:@@sessionLearningObjectives.scopeTasks:${objective.scope.taskReferences.length}:count: Frage(n)`;
  }

  overviewQuestionLabel(objective: SessionLearningObjectiveDTO): string | null {
    if (!this.isOverview()) return null;
    if (objective.scope.kind === 'quiz-wide' || objective.scope.kind === 'session') {
      return this.scopeLabel(objective);
    }
    const numbers = learningObjectiveQuestionNumbers(objective, this.questionNumberById());
    if (numbers.length === 0) return null;
    if (numbers.length === 1) {
      return $localize`:@@sessionLearningObjectives.overviewQuestion:Frage ${numbers[0]}:number:`;
    }
    const list = new Intl.ListFormat(this.locale, {
      style: 'long',
      type: 'conjunction',
    }).format(numbers.map(String));
    return $localize`:@@sessionLearningObjectives.overviewQuestions:Fragen ${list}:list:`;
  }

  hasUnresolvedReferences(objective: SessionLearningObjectiveDTO): boolean {
    const scopeUnresolved =
      objective.scope.kind === 'question-set' &&
      objective.scope.taskReferences.some((reference) => reference.kind === 'unresolved-task');
    const originUnresolved =
      objective.origin.kind === 'model-derived' &&
      objective.origin.derivedFrom.some((reference) => reference.kind === 'unresolved-task');
    return scopeUnresolved || originUnresolved;
  }

  async retryConflictReload(): Promise<void> {
    if (this.pending() || this.derivationIsPending()) return;
    this.setPending(true);
    const reloaded = await this.loadSnapshot(true);
    this.setPending(false);
    if (!reloaded) {
      this.conflictMessage.set(
        $localize`:@@sessionLearningObjectives.conflictReloadFailed:Der Stand hat sich geändert, konnte aber nicht neu geladen werden. Änderungen bleiben gesperrt, bis das Neuladen gelingt.`,
      );
      this.focusElement('session-learning-objectives-conflict');
      return;
    }
    this.authoritativeReloadRequired.set(false);
    this.formOpen.set(false);
    this.editingId.set(null);
    this.conflictMessage.set(
      $localize`:@@sessionLearningObjectives.conflictReloaded:Der aktuelle Stand wurde geladen. Öffne das Lernziel erneut, um deine Änderung abzugleichen.`,
    );
    this.focusElement('session-learning-objectives-conflict');
  }

  private async loadSnapshot(preserveForm: boolean): Promise<boolean> {
    if (!preserveForm) {
      this.loadState.set('loading');
      this.clearMessages();
    }
    try {
      const result = await trpc.session.getLearningObjectives.query({ code: this.data.code });
      this.snapshot.set(result);
      this.loadState.set('ready');
      return true;
    } catch {
      if (!preserveForm) this.loadState.set('error');
      return false;
    }
  }

  private async handleSaveConflict(objectiveId: string): Promise<void> {
    this.authoritativeReloadRequired.set(true);
    const reloaded = await this.loadSnapshot(true);
    if (!reloaded) {
      this.conflictMessage.set(
        $localize`:@@sessionLearningObjectives.conflictReloadFailed:Der Stand hat sich geändert, konnte aber nicht neu geladen werden. Änderungen bleiben gesperrt, bis das Neuladen gelingt.`,
      );
      this.focusElement('session-learning-objectives-conflict');
      return;
    }
    this.authoritativeReloadRequired.set(false);
    const latest = this.allObjectives().find((objective) => objective.id === objectiveId);
    this.formOpen.set(false);
    this.editingId.set(null);
    this.conflictMessage.set(
      latest
        ? $localize`:@@sessionLearningObjectives.saveConflict:Der Stand hat sich geändert. Die aktuelle Serverfassung wurde geladen. Öffne das Lernziel erneut und gleiche deine Änderung ab.`
        : $localize`:@@sessionLearningObjectives.rowRemovedConflict:Dieses Lernziel wurde inzwischen gelöscht. Die aktuelle Liste wurde geladen.`,
    );
    this.focusElement('session-learning-objectives-conflict');
  }

  private isCurrentDerivation(sequence: number, controller: AbortController): boolean {
    return (
      sequence === this.derivationSequence &&
      !controller.signal.aborted &&
      this.derivationAbortController === controller
    );
  }

  private finishDerivation(
    status: Exclude<DerivationUiStatus, 'idle' | 'pending'>,
    message: string,
    preferredFocusId?: string,
  ): void {
    this.derivationAbortController = null;
    this.dialogRef.disableClose = this.pending();
    this.derivationStatus.set(status);
    this.derivationMessage.set(message);
    if (status !== 'completed') this.derivationLimitations.set([]);
    const startRemainsEnabled = this.allObjectives().length < this.maxObjectives;
    this.focusElement(
      preferredFocusId ??
        (status !== 'completed' && startRemainsEnabled
          ? 'session-learning-objective-derive'
          : 'session-learning-objective-derivation-status'),
    );
  }

  private derivationStatusMessage(result: DeriveSessionLearningObjectivesResult): string {
    switch (result.status) {
      case 'busy':
        return $localize`:@@learningObjectives.derivationBusy:Die lokale Text-KI ist gerade ausgelastet. Deine Lernziele bleiben unverändert. Bitte versuche es gleich noch einmal.`;
      case 'disabled':
        return $localize`:@@learningObjectives.derivationDisabled:Automatische Vorschläge sind auf diesem System nicht aktiviert. Du kannst Lernziele weiterhin manuell formulieren.`;
      case 'aborted':
        return $localize`:@@learningObjectives.derivationAborted:Die automatische Erstellung wurde abgebrochen. Deine Lernziele bleiben unverändert.`;
      case 'timeout':
        return $localize`:@@learningObjectives.derivationTimeout:Die automatische Erstellung hat zu lange gedauert. Deine Lernziele bleiben unverändert.`;
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

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.statusMessage.set(null);
  }

  private focusTextArea(): void {
    const focus = (): void => this.textArea()?.nativeElement.focus();
    queueMicrotask(focus);
    afterNextRender(focus, { injector: this.injector });
  }

  private focusScopeChoice(): void {
    const firstTask =
      this.scopeKind() === 'question-set' ? this.selectableTaskOptions()[0] : undefined;
    this.focusElement(
      firstTask
        ? `session-learning-objective-task-${referenceKey(firstTask.reference)}`
        : 'session-learning-objective-scope-quiz',
      'session-learning-objective-scope-session',
    );
  }

  private setPending(value: boolean): void {
    this.pending.set(value);
    this.dialogRef.disableClose = value || this.derivationIsPending();
  }

  private focusElement(primaryId: string, fallbackId?: string): void {
    const focus = (): void => {
      const primary = globalThis.document?.getElementById(primaryId);
      const fallback = fallbackId ? globalThis.document?.getElementById(fallbackId) : null;
      const target = primary instanceof HTMLElement ? primary : fallback;
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

export function isConfirmedLearningObjective(objective: SessionLearningObjectiveDTO): boolean {
  return objective.confirmation.state === 'confirmed';
}

export function isQaForumAssignmentObjective(objective: SessionLearningObjectiveDTO): boolean {
  return objective.purpose === 'forum-assignment';
}

function referenceKey(reference: SessionLearningObjectiveResolvedTaskReference): string {
  return `${reference.kind}:${reference.questionId}`;
}

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    data?: { code?: unknown };
    shape?: { data?: { code?: unknown } };
    message?: unknown;
  };
  return (
    candidate.data?.code === 'CONFLICT' ||
    candidate.shape?.data?.code === 'CONFLICT' ||
    (typeof candidate.message === 'string' && candidate.message.includes('CONFLICT'))
  );
}

function generateUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
