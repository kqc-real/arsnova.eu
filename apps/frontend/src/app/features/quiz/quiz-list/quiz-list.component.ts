import { DatePipe } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { PresetStorageEntrySchema } from '@arsnova/shared-types';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { QuizStoreService } from '../data/quiz-store.service';
import { trpc } from '../../../core/trpc.client';
import { buildKiQuizSystemPrompt } from '../../../shared/ki-quiz-prompt';
import { LiveSessionDialogComponent } from './live-session-dialog.component';

const PRESET_OPTIONS_STORAGE_PREFIX = 'home-preset-options-';

/**
 * Quiz-Liste (Epic 1).
 * Story 1.1 (Quiz erstellen), 1.8 (Export), 1.9 (Import), 1.10 (Bearbeiten, Löschen).
 */
@Component({
  selector: 'app-quiz-list',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatButton,
    MatIconButton,
    MatCard,
    MatCardContent,
    MatFormField,
    MatIcon,
    MatInput,
    MatLabel,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatTooltip,
  ],
  templateUrl: './quiz-list.component.html',
  styleUrl: './quiz-list.component.scss',
})
export class QuizListComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly quizStore = inject(QuizStoreService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly themePreset = inject(ThemePresetService);
  private readonly dialog = inject(MatDialog);
  readonly quizzes = this.quizStore.quizzes;
  readonly actionInfo = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly activeLiveQuizIds = signal<Set<string>>(new Set());
  readonly showAiImport = signal(false);
  readonly aiJsonInput = signal('');
  readonly startLiveShortcutMode = signal(false);
  /** Wird true, während quiz.upload + session.create laufen (Story 2.1a). */
  readonly liveStartPending = signal(false);

  /** Für i18n-matTooltip: Mindestens eine Frage erforderlich. */
  tooltipMinQuestions(): string {
    return $localize`:@@quizList.tooltipMinQuestions:Für ein Quiz brauchst du mindestens eine Frage.`;
  }

  /** Für i18n-matTooltip: Kann nicht gelöscht werden, solange das Quiz live ist. */
  tooltipDeleteLive(): string {
    return $localize`:@@quizList.tooltipDeleteLive:Kann nicht gelöscht werden, solange das Quiz live ist.`;
  }

  getQuizOpenAriaLabel(quizName: string): string {
    return $localize`:@@quizList.ariaQuizOpen:Quiz ${quizName}:quizName: öffnen`;
  }

  getQuizActionsAriaLabel(quizName: string): string {
    return $localize`:@@quizList.ariaQuizActions:Aktionen für Quiz ${quizName}:quizName:`;
  }

  async ngOnInit(): Promise<void> {
    try {
      const activeQuizIds = await trpc.session.getActiveQuizIds.query();
      this.activeLiveQuizIds.set(new Set(activeQuizIds));
    } catch {
      this.activeLiveQuizIds.set(new Set());
    }

    await this.activateLiveStartShortcutIfRequested();
  }

  toggleAiImport(): void {
    this.showAiImport.update((visible) => !visible);
    this.actionError.set(null);
    this.actionInfo.set(null);
  }

  updateAiJsonInput(value: string): void {
    this.aiJsonInput.set(value);
  }

  duplicateQuiz(quizId: string): void {
    this.actionError.set(null);
    try {
      const duplicate = this.quizStore.duplicateQuiz(quizId);
      this.actionInfo.set($localize`„${duplicate.name}“ wurde dupliziert.`);
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : $localize`Duplizieren fehlgeschlagen.`);
    }
  }

  deleteQuiz(quizId: string, quizName: string): void {
    this.actionError.set(null);
    if (this.isQuizLive(quizId)) {
      this.actionInfo.set($localize`„${quizName}“ ist gerade live und kann nicht gelöscht werden.`);
      return;
    }
    const confirmed = globalThis.confirm(
      $localize`„${quizName}“ wirklich löschen? Das lässt sich nicht rückgängig machen.`,
    );
    if (!confirmed) return;

    try {
      this.quizStore.deleteQuiz(quizId);
      this.actionInfo.set($localize`„${quizName}“ wurde gelöscht.`);
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : $localize`Löschen fehlgeschlagen.`);
    }
  }

  exportQuiz(quizId: string): void {
    this.actionError.set(null);
    try {
      const quiz = this.quizStore.exportQuiz(quizId);
      const filename = this.buildExportFilename(quiz.quiz.name);
      const payload = JSON.stringify(quiz, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = this.document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      this.actionInfo.set($localize`„${quiz.quiz.name}“ wurde exportiert.`);
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : $localize`Export fehlgeschlagen.`);
    }
  }

  async onImportFileSelected(event: Event): Promise<void> {
    this.actionError.set(null);
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const imported = this.quizStore.importQuiz(parsed);
      this.actionInfo.set($localize`„${imported.name}“ wurde importiert.`);
      target.value = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : $localize`Import fehlgeschlagen.`;
      this.actionError.set(message);
      target.value = '';
    }
  }

  async copyKiPrompt(): Promise<void> {
    const prompt = buildKiQuizSystemPrompt({
      presetLabel: 'Standard',
      nicknameTheme: 'NOBEL_LAUREATES',
      readingPhaseEnabled: true,
      defaultDifficulty: 'MEDIUM',
    });
    try {
      await navigator.clipboard.writeText(prompt);
      this.actionInfo.set($localize`Prompt in die Zwischenablage kopiert.`);
    } catch {
      this.actionError.set($localize`Kopieren fehlgeschlagen – bitte manuell kopieren.`);
    }
  }

  importAiJson(): void {
    this.actionError.set(null);
    this.actionInfo.set(null);

    const raw = this.aiJsonInput().trim();
    if (!raw) {
      this.actionError.set($localize`Füge zuerst das KI-JSON ein.`);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const imported = this.quizStore.importQuiz(parsed);
      this.actionInfo.set($localize`KI-„${imported.name}“ wurde importiert.`);
      this.aiJsonInput.set('');
      this.showAiImport.set(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : $localize`KI-Import fehlgeschlagen.`;
      this.actionError.set(message);
    }
  }

  isQuizLive(quizId: string): boolean {
    return this.activeLiveQuizIds().has(quizId);
  }

  async openLiveStartDialog(quizId: string, quizName: string, questionCount: number): Promise<void> {
    if (this.liveStartPending()) {
      return;
    }

    await this.clearLiveStartShortcut();

    const dialogRef = this.dialog.open(LiveSessionDialogComponent, {
      width: '32rem',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: false,
      panelClass: 'live-session-dialog-panel',
      backdropClass: 'live-session-dialog-backdrop',
      data: {
        quizName,
        quizCanStart: questionCount > 0,
      },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) {
      return;
    }

    if (result.startMode === 'Q_AND_A') {
      await this.startLiveSession({
        quizId,
        includeQuiz: result.enableQuiz,
        includeQa: result.enableQa,
        includeQuickFeedback: result.enableQuickFeedback,
        qaTitle: result.title,
        startWithQa: true,
      });
      return;
    }

    await this.startLiveSession({
      quizId,
      includeQuiz: result.enableQuiz,
      includeQa: result.enableQa,
      includeQuickFeedback: result.enableQuickFeedback,
      qaTitle: result.title,
      startWithQa: false,
    });
  }

  private async activateLiveStartShortcutIfRequested(): Promise<void> {
    if (this.route.snapshot.queryParamMap.get('startLive') !== '1') {
      return;
    }

    const quizzes = this.quizzes();
    if (quizzes.length === 1) {
      const quiz = quizzes[0]!;
      await this.openLiveStartDialog(quiz.id, quiz.name, quiz.questionCount);
      return;
    }

    this.startLiveShortcutMode.set(true);
  }

  private async clearLiveStartShortcut(): Promise<void> {
    if (!this.startLiveShortcutMode() && this.route.snapshot.queryParamMap.get('startLive') !== '1') {
      return;
    }

    this.startLiveShortcutMode.set(false);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { startLive: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Quiz live schalten (Story 2.1a): Upload + Session erstellen, dann zur Host-Ansicht.
   * Übernimmt das aktuell gewählte Home-Preset (z. B. Altersgruppe Kita) in den Upload-Payload.
   */
  private async startLiveSession(options: {
    quizId: string;
    includeQuiz: boolean;
    includeQa: boolean;
    includeQuickFeedback: boolean;
    qaTitle?: string;
    startWithQa: boolean;
  }): Promise<void> {
    this.actionError.set(null);
    this.actionInfo.set(null);
    this.liveStartPending.set(true);
    try {
      let result: { code: string };

      if (options.includeQuiz) {
        let payload = this.quizStore.getUploadPayload(options.quizId);
        const presetKey = PRESET_OPTIONS_STORAGE_PREFIX + this.themePreset.preset();
        try {
          const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(presetKey) : null;
          const parsed = raw ? (JSON.parse(raw) as unknown) : null;
          const entry = PresetStorageEntrySchema.safeParse(parsed);
          if (entry.success) {
            payload = {
              ...payload,
              nicknameTheme: entry.data.nicknameThemeValue,
              allowCustomNicknames: entry.data.nameMode === 'allowCustomNicknames',
            };
          }
        } catch {
          // Preset-Optionen nicht lesbar → Quiz-Einstellungen unverändert nutzen
        }
        const { quizId: uploadedQuizId } = await trpc.quiz.upload.mutate(payload);
        result = await trpc.session.create.mutate({
          quizId: uploadedQuizId,
          type: 'QUIZ',
          qaEnabled: options.includeQa,
          qaTitle: options.includeQa ? options.qaTitle?.trim() || undefined : undefined,
          quickFeedbackEnabled: options.includeQuickFeedback,
        });
      } else {
        result = await trpc.session.create.mutate({
          type: 'Q_AND_A',
          title: options.qaTitle?.trim() || undefined,
          quickFeedbackEnabled: options.includeQuickFeedback,
        });
      }

      if (options.startWithQa) {
        await trpc.session.startQa.mutate({ code: result.code });
      }

      this.actionInfo.set($localize`Session ${result.code} gestartet.`);
      await this.router.navigate(['/session', result.code, 'host'], {
        queryParams: options.startWithQa ? { tab: 'qa' } : undefined,
      });
    } catch (error) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: string }).message)
          : $localize`Live-Start fehlgeschlagen.`;
      if (msg.includes('TOO_MANY_REQUESTS') || msg.includes('Sessions pro Stunde')) {
        this.actionError.set($localize`Zu viele Sessions – bitte später erneut versuchen.`);
      } else {
        this.actionError.set(msg);
      }
    } finally {
      this.liveStartPending.set(false);
    }
  }

  private buildExportFilename(quizName: string): string {
    const date = new Date().toISOString().slice(0, 10);
    const safeName = quizName
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'quiz';
    return `${safeName}_${date}.json`;
  }
}
