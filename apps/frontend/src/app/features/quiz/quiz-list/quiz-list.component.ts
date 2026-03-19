import { DatePipe } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { QUIZ_PRESETS, PresetStorageEntrySchema, type QuizPreset, type TeamAssignment } from '@arsnova/shared-types';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { localizeCommands } from '../../../core/locale-router';
import { QuizStoreService, type QuizSettings, type QuizSummary } from '../data/quiz-store.service';
import { trpc } from '../../../core/trpc.client';
import { buildKiQuizSystemPrompt } from '../../../shared/ki-quiz-prompt';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
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
    MatHint,
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
  private readonly sanitizer = inject(DomSanitizer);
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

  renderDescription(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdownWithKatex(value).html);
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

  resetAiImport(): void {
    this.aiJsonInput.set('');
    this.actionError.set(null);
    this.actionInfo.set(null);
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
    const settings = this.readPromptSettingsFromHomePreset();
    const prompt = buildKiQuizSystemPrompt({
      presetLabel: settings.preset === 'SERIOUS' ? $localize`Seriös` : $localize`Spielerisch`,
      presetValue: settings.preset,
      nicknameTheme: settings.nicknameTheme,
      readingPhaseEnabled: settings.readingPhaseEnabled,
      defaultDifficulty: 'MEDIUM',
      showLeaderboard: settings.showLeaderboard,
      allowCustomNicknames: settings.allowCustomNicknames,
      defaultTimer: settings.defaultTimer,
      enableSoundEffects: settings.enableSoundEffects,
      enableRewardEffects: settings.enableRewardEffects,
      enableMotivationMessages: settings.enableMotivationMessages,
      enableEmojiReactions: settings.enableEmojiReactions,
      anonymousMode: settings.anonymousMode,
      teamMode: settings.teamMode,
      teamCount: settings.teamCount,
      teamAssignment: settings.teamAssignment,
      teamNames: settings.teamNames,
      backgroundMusic: settings.backgroundMusic,
      bonusTokenCount: settings.bonusTokenCount,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      this.actionInfo.set($localize`:@@quizList.aiImport.copySuccess:Die Textvorlage ist jetzt in deiner Zwischenablage.`);
    } catch {
      this.actionError.set(
        $localize`:@@quizList.aiImport.copyFailed:Kopieren fehlgeschlagen. Bitte versuche es noch einmal.`,
      );
    }
  }

  private readPromptSettingsFromHomePreset(): QuizSettings {
    const preset: QuizPreset = this.themePreset.preset() === 'serious' ? 'SERIOUS' : 'PLAYFUL';
    const presetDefaults = QUIZ_PRESETS[preset];
    const defaultSettings: QuizSettings = {
      showLeaderboard: presetDefaults.showLeaderboard ?? true,
      allowCustomNicknames: false,
      defaultTimer: preset === 'PLAYFUL' ? 60 : (presetDefaults.defaultTimer ?? null),
      enableSoundEffects: presetDefaults.enableSoundEffects ?? true,
      enableRewardEffects: presetDefaults.enableRewardEffects ?? true,
      enableMotivationMessages: presetDefaults.enableMotivationMessages ?? true,
      enableEmojiReactions: presetDefaults.enableEmojiReactions ?? true,
      anonymousMode: preset === 'SERIOUS',
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
      backgroundMusic: null,
      nicknameTheme: 'NOBEL_LAUREATES',
      bonusTokenCount: null,
      readingPhaseEnabled: presetDefaults.readingPhaseEnabled ?? false,
      preset,
    };

    try {
      const presetKey = PRESET_OPTIONS_STORAGE_PREFIX + this.themePreset.preset();
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(presetKey) : null;
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      const entry = PresetStorageEntrySchema.safeParse(parsed);
      if (!entry.success) {
        return defaultSettings;
      }

      const options = entry.data.options;
      const optionEnabled = (id: string, fallback: boolean) => (id in options ? options[id] === true : fallback);
      const nameMode = entry.data.nameMode;
      const teamMode = optionEnabled('teamMode', false);

      return {
        ...defaultSettings,
        nicknameTheme: entry.data.nicknameThemeValue,
        allowCustomNicknames: nameMode === 'allowCustomNicknames',
        anonymousMode: nameMode === 'anonymousMode',
        showLeaderboard: optionEnabled('showLeaderboard', defaultSettings.showLeaderboard),
        defaultTimer: optionEnabled('defaultTimer', defaultSettings.defaultTimer !== null)
          ? defaultSettings.defaultTimer ?? 60
          : null,
        enableRewardEffects: optionEnabled('enableRewardEffects', defaultSettings.enableRewardEffects),
        enableMotivationMessages: optionEnabled('enableMotivationMessages', defaultSettings.enableMotivationMessages),
        enableEmojiReactions: optionEnabled('enableEmojiReactions', defaultSettings.enableEmojiReactions),
        enableSoundEffects: optionEnabled('enableSoundEffects', defaultSettings.enableSoundEffects),
        readingPhaseEnabled: optionEnabled('readingPhaseEnabled', defaultSettings.readingPhaseEnabled),
        teamMode,
        teamAssignment: optionEnabled('teamAssignment', false) ? ('MANUAL' as TeamAssignment) : 'AUTO',
        teamCount: teamMode ? entry.data.teamCountValue : null,
        backgroundMusic: null,
        bonusTokenCount: optionEnabled('bonusTokenCount', false) ? defaultSettings.bonusTokenCount ?? 3 : null,
      };
    } catch {
      return defaultSettings;
    }
  }

  importAiJson(): void {
    this.actionError.set(null);
    this.actionInfo.set(null);

    const raw = this.aiJsonInput().trim();
    if (!raw) {
      this.actionError.set(
        $localize`:@@quizList.aiImport.empty:Füge zuerst die Antwort aus dem KI-Chat ein.`,
      );
      return;
    }

    try {
      const parsed = parseAiImportPayload(raw);
      const imported = this.quizStore.importQuiz(parsed);
      this.actionInfo.set(
        $localize`:@@quizList.aiImport.success:„${imported.name}:quizName:“ wurde importiert.`,
      );
      this.aiJsonInput.set('');
      this.showAiImport.set(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : $localize`:@@quizList.aiImport.failed:Import fehlgeschlagen. Prüfe, ob du die komplette Antwort aus dem KI-Chat eingefügt hast.`;
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

    await this.startLiveSession({
      quizId,
      includeQuiz: result.enableQuiz,
      includeQa: result.enableQa,
      includeQuickFeedback: result.enableQuickFeedback,
      qaTitle: result.title,
      startWithQa: result.startChannel === 'qa',
      initialTab: result.startChannel,
    });
  }

  private async activateLiveStartShortcutIfRequested(): Promise<void> {
    const requestedQuizId = this.route.snapshot.queryParamMap.get('startLiveQuiz');
    if (requestedQuizId) {
      const quiz = this.quizzes().find((entry) => entry.id === requestedQuizId) ?? null;
      if (quiz) {
        await this.openLiveStartDialog(quiz.id, quiz.name, quiz.questionCount);
        return;
      }
    }

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
    const hasShortcutParams =
      this.route.snapshot.queryParamMap.get('startLive') === '1' ||
      this.route.snapshot.queryParamMap.get('startLiveQuiz') !== null;
    if (!this.startLiveShortcutMode() && !hasShortcutParams) {
      return;
    }

    this.startLiveShortcutMode.set(false);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { startLive: null, startLiveQuiz: null },
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
    initialTab: 'quiz' | 'qa' | 'quickFeedback';
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
            const effectiveTeamMode = optionEnabled('teamMode') || payload.teamMode;
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
              teamMode: effectiveTeamMode,
              teamAssignment: optionEnabled('teamMode')
                ? (optionEnabled('teamAssignment') ? 'MANUAL' : 'AUTO')
                : (payload.teamAssignment ?? 'AUTO'),
              teamCount: optionEnabled('teamMode')
                ? (entry.data.teamCountValue ?? payload.teamCount)
                : payload.teamCount,
              bonusTokenCount: optionEnabled('bonusTokenCount')
                ? (payload.bonusTokenCount ?? 3)
                : payload.bonusTokenCount,
              defaultTimer: optionEnabled('defaultTimer') ? payload.defaultTimer ?? 60 : null,
              backgroundMusic: null,
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
          type: options.includeQa ? 'Q_AND_A' : 'QUIZ',
          title: options.includeQa ? options.qaTitle?.trim() || undefined : undefined,
          quickFeedbackEnabled: options.includeQuickFeedback,
        });
      }

      if (options.startWithQa) {
        await trpc.session.startQa.mutate({ code: result.code });
      }

      this.actionInfo.set($localize`Session ${result.code} gestartet.`);
      await this.router.navigate(localizeCommands(['session', result.code, 'host']), {
        queryParams: options.initialTab === 'quiz' ? undefined : { tab: options.initialTab },
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

function parseAiImportPayload(raw: string): unknown {
  const directParse = tryParseJson(raw);
  if (directParse.ok) {
    return directParse.value;
  }

  const fencedCodeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const fencedCandidate = fencedCodeBlockMatch?.[1]?.trim();
  if (fencedCandidate) {
    const fencedParse = tryParseJson(fencedCandidate);
    if (fencedParse.ok) {
      return fencedParse.value;
    }
  }

  const inlineCandidate = extractBalancedJsonCandidate(raw);
  if (inlineCandidate) {
    const inlineParse = tryParseJson(inlineCandidate);
    if (inlineParse.ok) {
      return inlineParse.value;
    }
  }

  throw directParse.error ?? new Error('Import fehlgeschlagen.');
}

function tryParseJson(value: string): { ok: true; value: unknown } | { ok: false; error: Error | null } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : null };
  }
}

function extractBalancedJsonCandidate(value: string): string | null {
  const startIndex = value.search(/[[{]/);
  if (startIndex < 0) {
    return null;
  }

  const openingChar = value[startIndex];
  const closingChar = openingChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openingChar) {
      depth += 1;
      continue;
    }

    if (char === closingChar) {
      depth -= 1;
      if (depth === 0) {
        return value.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}
