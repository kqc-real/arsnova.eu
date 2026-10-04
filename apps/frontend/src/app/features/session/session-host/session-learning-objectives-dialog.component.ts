import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
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
  type SessionLearningObjectiveDTO,
  type SessionLearningObjectiveResolvedTaskReference,
  type SessionLearningObjectivesSnapshot,
} from '@arsnova/shared-types';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { trpc } from '../../../core/trpc.client';

export interface SessionLearningObjectiveTaskOption {
  reference: SessionLearningObjectiveResolvedTaskReference;
  label: string;
}

export interface SessionLearningObjectivesDialogData {
  code: string;
  hasQuiz: () => boolean;
}

type LoadState = 'loading' | 'ready' | 'error';
type ScopeKind = 'session' | 'quiz-wide' | 'question-set';

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
  private readonly taskMarkdownCache = new Map<string, SafeHtml>();

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

  readonly isReadOnly = computed(() => this.snapshot()?.access.state === 'read-only');
  readonly objectives = computed(() => this.snapshot()?.objectives ?? []);
  readonly taskOptions = computed(() => {
    const byKey = new Map<string, SessionLearningObjectiveTaskOption>();
    for (const task of this.snapshot()?.availableQaTasks ?? []) {
      const reference = { kind: 'qa-question' as const, questionId: task.questionId };
      byKey.set(referenceKey(reference), {
        reference,
        label: task.text,
      });
    }
    for (const task of this.snapshot()?.availableQuizTasks ?? []) {
      const reference = { kind: 'quiz-question' as const, questionId: task.questionId };
      byKey.set(referenceKey(reference), {
        reference,
        label: $localize`:@@sessionLearningObjectives.quizTaskLabel:Quizaufgabe ${task.order + 1}:order:: ${task.text}:text:`,
      });
    }
    for (const objective of this.objectives()) {
      if (objective.scope.kind !== 'question-set') continue;
      for (const reference of objective.scope.taskReferences) {
        if (reference.kind === 'unresolved-task') continue;
        const key = referenceKey(reference);
        if (!byKey.has(key)) {
          byKey.set(key, {
            reference,
            label:
              reference.kind === 'qa-question'
                ? $localize`:@@sessionLearningObjectives.qaTaskFallback:Q&A-Frage`
                : $localize`:@@sessionLearningObjectives.quizTaskFallback:Quizaufgabe`,
          });
        }
      }
    }
    return [...byKey.values()];
  });
  readonly selectableTaskOptions = computed(() =>
    this.editingModelDerived()
      ? this.taskOptions().filter((option) => option.reference.kind === 'quiz-question')
      : this.taskOptions(),
  );

  private readonly textArea = viewChild<ElementRef<HTMLTextAreaElement>>('objectiveText');

  constructor() {
    void this.loadSnapshot(false);
  }

  close(): void {
    if (!this.pending()) this.dialogRef.close();
  }

  retryLoad(): void {
    void this.loadSnapshot(false);
  }

  beginAdd(): void {
    if (this.isReadOnly()) return;
    this.editingId.set(null);
    this.expectedRevision.set(null);
    this.text.set('');
    this.scopeKind.set('session');
    this.selectedTaskKeys.set(new Set());
    this.confirmationState.set('draft');
    this.editingModelDerived.set(false);
    this.mustReplaceUnresolvedScope.set(false);
    this.hasUnresolvedDerivation.set(false);
    this.scopeTouched.set(false);
    this.pendingDeleteId.set(null);
    this.clearMessages();
    this.formOpen.set(true);
    this.focusTextArea();
  }

  beginEdit(objective: SessionLearningObjectiveDTO): void {
    if (this.isReadOnly()) return;
    this.editingId.set(objective.id);
    this.expectedRevision.set(objective.revision);
    this.text.set(objective.text);
    this.scopeKind.set(objective.scope.kind);
    const references =
      objective.scope.kind === 'question-set' ? objective.scope.taskReferences : [];
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

  async save(): Promise<void> {
    if (
      !this.formOpen() ||
      this.pending() ||
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
          ? $localize`:@@sessionLearningObjectives.textRequired:Formuliere ein Lernziel.`
          : $localize`:@@sessionLearningObjectives.textTooLong:Das Lernziel ist zu lang.`,
      );
      this.focusTextArea();
      return;
    }
    if (this.mustReplaceUnresolvedScope() && !this.scopeTouched()) {
      this.errorMessage.set(
        $localize`:@@sessionLearningObjectives.rescopeRequired:Mindestens ein Aufgabenverweis ist nicht mehr verfügbar. Wähle den Bereich neu, bevor du speicherst.`,
      );
      this.focusScopeChoice();
      return;
    }

    if (this.confirmationState() === 'confirmed' && this.hasUnresolvedDerivation()) {
      this.errorMessage.set(
        $localize`:@@sessionLearningObjectives.missingDerivationCannotConfirm:Eine Herleitungsaufgabe fehlt. Das Ziel bleibt bis zu einer neuen Herleitung prüfbedürftig und kann nicht bestätigt werden.`,
      );
      this.focusElement('session-learning-objective-status-draft');
      return;
    }

    const selected = this.selectableTaskOptions()
      .filter((option) => this.selectedTaskKeys().has(referenceKey(option.reference)))
      .map((option) => option.reference);
    if (this.scopeKind() === 'question-set' && selected.length === 0) {
      this.errorMessage.set(
        $localize`:@@sessionLearningObjectives.taskRequired:Wähle mindestens eine Aufgabe oder einen anderen Bereich.`,
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
            scope:
              this.scopeKind() === 'question-set'
                ? { kind: 'question-set', taskReferences: selected }
                : this.scopeKind() === 'session'
                  ? { kind: 'session' }
                  : { kind: 'quiz-wide' },
            confirmationState: this.confirmationState(),
          },
        ],
      });
      this.snapshot.set(result);
      this.formOpen.set(false);
      this.editingId.set(null);
      this.conflictMessage.set(null);
      this.statusMessage.set(
        this.expectedRevision() === null
          ? $localize`:@@sessionLearningObjectives.created:Lernziel hinzugefügt.`
          : $localize`:@@sessionLearningObjectives.updated:Lernziel aktualisiert.`,
      );
      this.focusElement(`session-learning-objective-edit-${objectiveId}`);
    } catch (error) {
      if (isConflictError(error)) {
        await this.handleSaveConflict(objectiveId);
      } else {
        this.errorMessage.set(
          $localize`:@@sessionLearningObjectives.saveFailed:Lernziel konnte nicht gespeichert werden. Versuche es erneut.`,
        );
        this.focusTextArea();
      }
    } finally {
      this.setPending(false);
    }
  }

  requestDelete(objectiveId: string): void {
    if (this.isReadOnly()) return;
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
    if (!snapshot || this.pending() || this.isReadOnly()) return;
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
      this.statusMessage.set($localize`:@@sessionLearningObjectives.deleted:Lernziel gelöscht.`);
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
          $localize`:@@sessionLearningObjectives.deleteFailed:Lernziel konnte nicht gelöscht werden.`,
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
        return $localize`:@@sessionLearningObjectives.reviewReferenceRemoved:Eine referenzierte Aufgabe wurde entfernt. Ordne den Bereich neu oder leite das Ziel erneut her.`;
      case 'derivation-replaced':
        return $localize`:@@sessionLearningObjectives.reviewDerivationReplaced:Die Herleitung wurde ersetzt. Prüfe das Ziel, bevor du es erneut bestätigst.`;
      default:
        return $localize`:@@sessionLearningObjectives.reviewSourceChanged:Der Inhalt einer Herleitungsaufgabe hat sich geändert. Prüfe das Ziel erneut.`;
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
    return $localize`:@@sessionLearningObjectives.scopeTasks:${objective.scope.taskReferences.length}:count: Aufgabe(n)`;
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
    if (this.pending()) return;
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
    const latest = this.objectives().find((objective) => objective.id === objectiveId);
    this.formOpen.set(false);
    this.editingId.set(null);
    this.conflictMessage.set(
      latest
        ? $localize`:@@sessionLearningObjectives.saveConflict:Der Stand hat sich geändert. Die aktuelle Serverfassung wurde geladen. Öffne das Lernziel erneut und gleiche deine Änderung ab.`
        : $localize`:@@sessionLearningObjectives.rowRemovedConflict:Dieses Lernziel wurde inzwischen gelöscht. Die aktuelle Liste wurde geladen.`,
    );
    this.focusElement('session-learning-objectives-conflict');
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
        : 'session-learning-objective-scope-session',
    );
  }

  private setPending(value: boolean): void {
    this.pending.set(value);
    this.dialogRef.disableClose = value;
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
