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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { PresetStorageEntrySchema } from '@arsnova/shared-types';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { localizeCommands } from '../../../core/locale-router';
import { QuizStoreService, type QuizSummary } from '../data/quiz-store.service';
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
  private readonly snackBar = inject(MatSnackBar);
  readonly quizzes = this.quizStore.quizzes;
  readonly syncRoomId = this.quizStore.syncRoomId;
  readonly syncConnectionState = this.quizStore.syncConnectionState;
  readonly librarySharingMode = this.quizStore.librarySharingMode;
  readonly lastConnectedAt = this.quizStore.lastConnectedAt;
  readonly lastLocalChangeAt = this.quizStore.lastLocalChangeAt;
  readonly lastRemoteSyncAt = this.quizStore.lastRemoteSyncAt;
  readonly lastRemoteChangedQuizName = this.quizStore.lastRemoteChangedQuizName;
  readonly lastRemoteChangedQuizUpdatedAt = this.quizStore.lastRemoteChangedQuizUpdatedAt;
  readonly lastRemoteChangedByDeviceLabel = this.quizStore.lastRemoteChangedByDeviceLabel;
  readonly lastRemoteChangedByBrowserLabel = this.quizStore.lastRemoteChangedByBrowserLabel;
  readonly originSharedAt = this.quizStore.originSharedAt;
  readonly originDeviceLabel = this.quizStore.originDeviceLabel;
  readonly originBrowserLabel = this.quizStore.originBrowserLabel;
  readonly currentDeviceLabel = this.quizStore.currentDeviceLabel;
  readonly currentBrowserLabel = this.quizStore.currentBrowserLabel;
  readonly syncPeerInfos = this.quizStore.syncPeerInfos;
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

  isSharedLibrary(): boolean {
    return this.librarySharingMode() === 'shared';
  }

  syncStatusLabel(): string {
    const state = this.syncConnectionState();
    if (state === 'connected') return $localize`:@@quizList.syncStatusConnected:Verbunden`;
    if (state === 'connecting') return $localize`:@@quizList.syncStatusConnecting:Verbindung wird aufgebaut`;
    return $localize`:@@quizList.syncStatusOffline:Offline`;
  }

  syncCode(): string {
    return this.syncRoomId().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  }

  syncPeerCountLabel(): string {
    const count = this.syncPeerInfos().length;
    if (count === 0) return $localize`:@@quizList.syncPeerCountNone:Gerade kein anderes Gerät aktiv`;
    if (count === 1) return $localize`:@@quizList.syncPeerCountOne:Gerade 1 weiteres Gerät aktiv`;
    return $localize`:@@quizList.syncPeerCountMany:Gerade ${count}:count: weitere Geräte aktiv`;
  }

  deviceSummary(deviceLabel: string, browserLabel: string): string {
    return `${deviceLabel} · ${browserLabel}`;
  }

  formatSyncDateTime(value: string | null): string {
    if (!value) {
      return $localize`:@@quizList.syncTimestampUnknown:Noch keine Daten`;
    }
    return this.formatSyncTimestamp(value) ?? $localize`:@@quizList.syncTimestampUnknown:Noch keine Daten`;
  }

  lastRemoteSyncSummary(): string {
    const quizName = this.lastRemoteChangedQuizName() || this.fallbackLatestQuizName();
    const timestamp = this.formatSyncDateTimeOrNull(this.lastRemoteSyncAt());

    if (!quizName || !timestamp) {
      return $localize`:@@quizList.syncNoRemoteChangesYet:Bisher keine übernommene Änderung`;
    }

    return `${quizName} · ${timestamp}`;
  }

  lastRemoteChangedDeviceSummary(): string {
    const deviceLabel = this.lastRemoteChangedByDeviceLabel();
    const browserLabel = this.lastRemoteChangedByBrowserLabel();
    if (!deviceLabel || !browserLabel) {
      return $localize`:@@quizList.syncDeviceUnknown:Unbekannt`;
    }
    return this.deviceSummary(deviceLabel, browserLabel);
  }

  syncOriginDeviceSummary(): string {
    const deviceLabel = this.originDeviceLabel();
    const browserLabel = this.originBrowserLabel();
    if (!deviceLabel || !browserLabel) {
      return $localize`:@@quizList.syncOriginUnknown:Noch nicht bekannt`;
    }
    return this.deviceSummary(deviceLabel, browserLabel);
  }

  private fallbackLatestQuizName(): string | null {
    const quizzes = this.quizzes();
    if (quizzes.length === 0) {
      return null;
    }

    return quizzes.reduce<QuizSummary | null>((latest, quiz) => {
      if (!latest) return quiz;
      return Date.parse(quiz.updatedAt) > Date.parse(latest.updatedAt) ? quiz : latest;
    }, null)?.name ?? null;
  }

  private formatSyncDateTimeOrNull(value: string | null): string | null {
    if (!value) {
      return null;
    }

    return this.formatSyncDateTime(value) === $localize`:@@quizList.syncTimestampUnknown:Noch keine Daten`
      ? null
      : this.formatSyncDateTime(value);
  }

  async ngOnInit(): Promise<void> {
    try {
      const activeQuizIds = await trpc.session.getActiveQuizIds.query();
      this.activeLiveQuizIds.set(new Set(activeQuizIds));
    } catch {
      this.activeLiveQuizIds.set(new Set());
    }

    await this.handleSyncImportNoticeIfRequested();
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

  private async handleSyncImportNoticeIfRequested(): Promise<void> {
    if (this.route.snapshot.queryParamMap.get('syncImported') !== '1') {
      return;
    }

    const syncedQuizzes = await this.waitForSyncImportSnapshot();
    this.snackBar.open(
      this.buildSyncImportMessage(syncedQuizzes),
      '',
      {
        duration: 9000,
        verticalPosition: 'top',
        horizontalPosition: 'center',
      },
    );
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { syncImported: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async waitForSyncImportSnapshot(): Promise<QuizSummary[]> {
    const currentQuizzes = this.quizzes();
    if (currentQuizzes.length > 0 || this.syncConnectionState() !== 'connecting') {
      return currentQuizzes;
    }

    return await new Promise<QuizSummary[]>((resolve) => {
      const startedAt = Date.now();
      const poll = (): void => {
        const quizzes = this.quizzes();
        if (quizzes.length > 0 || this.syncConnectionState() !== 'connecting' || Date.now() - startedAt >= 4000) {
          resolve(quizzes);
          return;
        }
        setTimeout(poll, 150);
      };
      poll();
    });
  }

  private buildSyncImportMessage(quizzes: QuizSummary[]): string {
    const latestUpdatedAt = quizzes.reduce<string | null>((latest, quiz) => {
      if (!latest) return quiz.updatedAt;
      return Date.parse(quiz.updatedAt) > Date.parse(latest) ? quiz.updatedAt : latest;
    }, null);
    const formattedTimestamp = latestUpdatedAt ? this.formatSyncTimestamp(latestUpdatedAt) : null;

    if (!formattedTimestamp) {
      return $localize`:@@quizList.syncImportedSuccess:Quiz-Bibliothek erfolgreich synchronisiert.`;
    }

    return $localize`:@@quizList.syncImportedSuccessWithTimestamp:Quiz-Bibliothek erfolgreich synchronisiert. Neuester Stand vom ${formattedTimestamp}:timestamp:.`;
  }

  private formatSyncTimestamp(value: string): string | null {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const locale =
      this.document.documentElement.lang ||
      (typeof navigator !== 'undefined' ? navigator.language : '') ||
      'de-DE';

    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
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
            const options = entry.data.options;
            const optionEnabled = (id: string) => options[id] === true;
            const nameMode = entry.data.nameMode;
            payload = {
              ...payload,
              nicknameTheme: entry.data.nicknameThemeValue,
              allowCustomNicknames: nameMode === 'allowCustomNicknames',
              anonymousMode: nameMode === 'anonymousMode',
              showLeaderboard: optionEnabled('showLeaderboard'),
              enableRewardEffects: optionEnabled('enableRewardEffects'),
              enableMotivationMessages: optionEnabled('enableMotivationMessages'),
              enableEmojiReactions: optionEnabled('enableEmojiReactions'),
              enableSoundEffects: optionEnabled('enableSoundEffects'),
              readingPhaseEnabled: optionEnabled('readingPhaseEnabled'),
              teamMode: optionEnabled('teamMode'),
              teamAssignment: optionEnabled('teamAssignment') ? 'MANUAL' : 'AUTO',
              teamCount: optionEnabled('teamMode') ? entry.data.teamCountValue : payload.teamCount,
              bonusTokenCount: optionEnabled('bonusTokenCount') ? payload.bonusTokenCount ?? 3 : null,
              defaultTimer: optionEnabled('defaultTimer') ? payload.defaultTimer ?? 60 : null,
              backgroundMusic: optionEnabled('backgroundMusic') ? payload.backgroundMusic : null,
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
      await this.router.navigate(localizeCommands(['session', result.code, 'host']), {
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
