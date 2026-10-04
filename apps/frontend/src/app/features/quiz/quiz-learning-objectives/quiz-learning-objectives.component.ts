import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import {
  LEARNING_OBJECTIVE_MAX_OBJECTIVES,
  LEARNING_OBJECTIVE_MAX_REFERENCES,
  LEARNING_OBJECTIVE_TEXT_MAX_LENGTH,
  type QuizLearningObjectiveV1,
} from '@arsnova/shared-types';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { QuizStoreService, type QuizQuestion } from '../data/quiz-store.service';

@Component({
  selector: 'app-quiz-learning-objectives',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
  ],
  templateUrl: './quiz-learning-objectives.component.html',
  styleUrl: './quiz-learning-objectives.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizLearningObjectivesComponent {
  private readonly quizStore = inject(QuizStoreService);
  private readonly injector = inject(Injector);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly questionMarkdownCache = new Map<string, SafeHtml>();

  readonly quizId = input.required<string>();
  readonly questions = input.required<readonly QuizQuestion[]>();

  readonly maxTextLength = LEARNING_OBJECTIVE_TEXT_MAX_LENGTH;
  readonly maxObjectives = LEARNING_OBJECTIVE_MAX_OBJECTIVES;
  readonly maxReferences = LEARNING_OBJECTIVE_MAX_REFERENCES;
  readonly referenceLimitMessage = $localize`:@@learningObjectives.referenceLimit:Höchstens ${this.maxReferences}:maxReferences: Aufgaben können einem Lernziel zugeordnet werden.`;
  readonly bundle = computed(() => this.quizStore.getLearningObjectiveBundle(this.quizId()));
  readonly objectives = computed(() => this.bundle().objectives);
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

  private readonly textArea = viewChild<ElementRef<HTMLTextAreaElement>>('objectiveText');

  beginAdd(): void {
    this.editingId.set(null);
    this.editingExpectedRevision.set(null);
    this.text.set('');
    this.scopeKind.set('quiz-wide');
    this.selectedQuestionIds.set(new Set());
    this.confirmationState.set('draft');
    this.pendingDeleteId.set(null);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.formOpen.set(true);
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
    this.focusTextArea();
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
        $localize`:@@learningObjectives.scopeRequired:Wähle mindestens eine Aufgabe oder nutze den gesamten Quizbereich.`,
      );
      this.focusElement('learning-objective-scope-all');
      return;
    }

    const editingId = this.editingId();
    const existing = editingId
      ? this.objectives().find((objective) => objective.id === editingId)
      : undefined;
    const missingScopeReferences = selectedIds.filter((id) => !this.questionIds().has(id));
    if (this.confirmationState() === 'confirmed' && missingScopeReferences.length > 0) {
      this.errorMessage.set(
        $localize`:@@learningObjectives.missingScopeCannotConfirm:Ein Lernziel mit fehlendem Aufgabenverweis kann nicht bestätigt werden. Entferne den Verweis oder wähle einen anderen Bereich.`,
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
        $localize`:@@learningObjectives.missingDerivationCannotConfirm:Eine Herleitungsaufgabe fehlt. Das Ziel bleibt bis zu einer neuen Herleitung prüfbedürftig und kann nicht bestätigt werden.`,
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
    return $localize`:@@learningObjectives.scopeQuestionCount:${objective.scope.sourceQuestionIds.length}:count: Aufgabe(n)`;
  }

  originLabel(objective: QuizLearningObjectiveV1): string {
    return objective.origin.kind === 'model-derived'
      ? $localize`:@@learningObjectives.modelDerived:Modellunterstützt`
      : $localize`:@@learningObjectives.manualOrigin:Manuell erstellt`;
  }

  conflictChoiceAriaLabel(objective: QuizLearningObjectiveV1): string {
    return $localize`:@@learningObjectives.useConflictVersionAria:Fassung übernehmen: ${objective.text}:text:; ${this.statusLabel(objective)}:status:; ${this.scopeLabel(objective)}:scope:; ${this.originLabel(objective)}:origin:`;
  }

  reviewReason(objective: QuizLearningObjectiveV1): string | null {
    if (objective.confirmation.state !== 'needs-review') return null;
    return objective.confirmation.reason === 'source-reference-removed'
      ? $localize`:@@learningObjectives.reviewReferenceRemoved:Eine referenzierte Aufgabe wurde gelöscht. Prüfe den Bereich.`
      : $localize`:@@learningObjectives.reviewSourceChanged:Der Aufgabeninhalt hat sich seit der Herleitung geändert.`;
  }

  private focusTextArea(): void {
    const focus = (): void => this.textArea()?.nativeElement.focus();
    queueMicrotask(focus);
    afterNextRender(focus, { injector: this.injector });
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
