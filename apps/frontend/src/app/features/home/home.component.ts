import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatBadge } from '@angular/material/badge';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import {
  MatCard,
  MatCardActions,
  MatCardContent,
  MatCardHeader,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../core/trpc.client';
import { ThemePresetService } from '../../core/theme-preset.service';
import { PresetSnackbarFocusService } from '../../core/preset-snackbar-focus.service';
import { localizeCommands, localizePath } from '../../core/locale-router';
import { DEMO_QUIZ_ID, QuizStoreService } from '../quiz/data/quiz-store.service';
import { QUICK_FEEDBACK_PRESET_CHIPS } from '../feedback/feedback.config';
import type { QuickFeedbackType } from '@arsnova/shared-types';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    MatBadge,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatCard,
    MatCardActions,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
    MatIcon,
    MatIconButton,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly localizedCommands = localizeCommands;
  readonly localizedPath = localizePath;
  private readonly router = inject(Router);
  private readonly focusService = inject(PresetSnackbarFocusService);
  @ViewChild('sessionCodeInput') private readonly sessionCodeInput?: ElementRef<HTMLInputElement>;
  @ViewChild('syncLinkInput') private readonly syncLinkInput?: ElementRef<HTMLInputElement>;

  sessionCode = signal('');
  codeInputFocused = signal(false);
  codeShaking = signal(false);
  ctaReady = signal(false);
  recentSessionCodes = signal<string[]>([]);
  joinError = signal<string | null>(null);
  /** Set when join failed because session is finished (for showing host link). */
  joinErrorSessionFinished = signal(false);
  isJoining = signal(false);
  syncLinkVisible = signal(false);
  syncLinkValue = signal('');
  syncLinkError = signal<string | null>(null);
  quickFeedbackError = signal<string | null>(null);
  quickFeedbackStarting = signal<QuickFeedbackType | null>(null);

  readonly themePreset = inject(ThemePresetService);
  private readonly quizStore = inject(QuizStoreService);
  readonly quizCount = computed(
    () => this.quizStore.quizzes().filter((q) => q.id !== DEMO_QUIZ_ID).length,
  );
  readonly latestHostedQuizId = computed(() => {
    const quizzes = this.quizStore.quizzes().filter((quiz) => quiz.id !== DEMO_QUIZ_ID);
    return quizzes.reduce<string | null>((latestId, quiz) => {
      if (!latestId) {
        return quiz.id;
      }

      const latestQuiz = quizzes.find((candidate) => candidate.id === latestId) ?? null;
      if (!latestQuiz) {
        return quiz.id;
      }

      return Date.parse(quiz.updatedAt) > Date.parse(latestQuiz.updatedAt) ? quiz.id : latestId;
    }, null);
  });
  readonly hasHostedQuiz = computed(() => this.latestHostedQuizId() !== null);
  private readonly platformId = inject(PLATFORM_ID);

  isValidSessionCode = computed(() => /^[A-Z0-9]{6}$/.test(this.sessionCode()));
  readonly codeSlots = [0, 1, 2, 3, 4, 5];
  readonly quickFeedbackPresetChips = QUICK_FEEDBACK_PRESET_CHIPS;

  /** Leertaste schon in keydown verarbeitet → keyup nicht erneut auslösen (vermeidet Doppel-Submit, nutzt keyup für virtuelle Tastatur). */
  private spaceHandledInKeydown = false;

  private static isSpaceKey(e: KeyboardEvent): boolean {
    return e.key === ' ' || e.code === 'Space' || e.keyCode === 32;
  }

  private trySubmitWithSpace(e: KeyboardEvent): void {
    if (!this.isValidSessionCode() || this.isJoining()) return;
    const active = document.activeElement;
    if (active === this.sessionCodeInput?.nativeElement) {
      e.preventDefault();
      this.joinSession();
      return;
    }
    const cta = document
      .getElementById('participant-entry')
      ?.querySelector<HTMLElement>('.home-cta:not([disabled])');
    if (cta?.contains(active)) {
      e.preventDefault();
      this.joinSession();
    }
  }

  /** Keydown (Capture): Ctrl/Cmd+Enter, Leertaste. */
  private keydownListener = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (this.isValidSessionCode()) this.joinSession();
      return;
    }
    if (!HomeComponent.isSpaceKey(e)) return;
    this.spaceHandledInKeydown = true;
    this.trySubmitWithSpace(e);
  };

  /** Keyup (Capture): Leertaste-Fallback für virtuelle Tastaturen (feuern oft nur keyup). */
  private keyupListener = (e: KeyboardEvent): void => {
    if (!HomeComponent.isSpaceKey(e)) return;
    if (this.spaceHandledInKeydown) {
      this.spaceHandledInKeydown = false;
      return;
    }
    this.trySubmitWithSpace(e);
  };

  ngAfterViewInit(): void {
    this.focusService.registerInput(this.sessionCodeInput);
    setTimeout(() => this.sessionCodeInput?.nativeElement.focus(), 100);
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.keydownListener, true);
      document.addEventListener('keyup', this.keyupListener, true);
    }
  }

  ngOnDestroy(): void {
    this.focusService.registerInput(undefined);
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.keydownListener, true);
      document.removeEventListener('keyup', this.keyupListener, true);
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadRecentSessionCodes();
    }
  }

  private loadRecentSessionCodes(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = localStorage.getItem('home-recent-sessions');
      const codes = raw ? (JSON.parse(raw) as string[]) : [];
      const valid = Array.isArray(codes)
        ? codes
            .filter((c) => typeof c === 'string' && /^[A-Z0-9]{6}$/.test(c.trim().toUpperCase()))
            .slice(0, 3)
        : [];
      this.recentSessionCodes.set(valid);
    } catch {
      this.recentSessionCodes.set([]);
    }
  }

  private addToRecentSessionCodes(code: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) return;
    const current = this.recentSessionCodes();
    const filtered = current.filter((c) => c !== normalized);
    const updated = [normalized, ...filtered].slice(0, 3);
    this.recentSessionCodes.set(updated);
    localStorage.setItem('home-recent-sessions', JSON.stringify(updated));
  }

  removeRecentSessionCode(code: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const updated = this.recentSessionCodes().filter((c) => c !== code);
    this.recentSessionCodes.set(updated);
    localStorage.setItem('home-recent-sessions', JSON.stringify(updated));
  }

  /** i18n: aria-label for remove session from list (code is dynamic). */
  removeSessionAriaLabel(code: string): string {
    return $localize`:@@homeRemoveSession:Session ${code} aus Liste entfernen`;
  }

  async joinSessionByCode(code: string): Promise<void> {
    this.sessionCode.set(code);
    await this.joinSession();
  }

  focusCodeInput(): void {
    this.sessionCodeInput?.nativeElement.focus();
  }

  private triggerShake(): void {
    this.codeShaking.set(true);
    setTimeout(() => this.codeShaking.set(false), 400);
  }

  private triggerCtaPulse(): void {
    this.ctaReady.set(false);
    requestAnimationFrame(() => this.ctaReady.set(true));
    setTimeout(() => this.ctaReady.set(false), 350);
  }

  preloadQuiz(): void {
    import('../quiz/quiz.component').then(() => {});
  }

  toggleSyncLinkEntry(): void {
    const nextVisible = !this.syncLinkVisible();
    this.syncLinkVisible.set(nextVisible);
    this.syncLinkError.set(null);
    if (!nextVisible) {
      this.syncLinkValue.set('');
      return;
    }
    setTimeout(() => this.syncLinkInput?.nativeElement.focus(), 0);
  }

  onSyncLinkInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.syncLinkValue.set(target.value);
    this.syncLinkError.set(null);
  }

  async openSyncLink(): Promise<void> {
    const docId = this.extractSyncDocId(this.syncLinkValue());
    if (!docId) {
      this.syncLinkError.set(
        $localize`:@@homeHostCard.syncLinkError:Bitte eine gueltige Sync-ID oder einen gueltigen Sync-Link eingeben.`,
      );
      this.syncLinkInput?.nativeElement.focus();
      return;
    }

    this.syncLinkError.set(null);
    this.quizStore.activateSyncRoom(docId, { markShared: true });
    await this.router.navigate(this.localizedCommands(['quiz']), {
      queryParams: { syncImported: 1 },
    });
  }

  async startQuickFeedback(type: QuickFeedbackType): Promise<void> {
    if (this.quickFeedbackStarting()) return;

    this.quickFeedbackError.set(null);
    this.quickFeedbackStarting.set(type);

    try {
      const result = await trpc.quickFeedback.create.mutate({
        type,
        theme: this.themePreset.theme(),
        preset: this.themePreset.preset(),
      });
      await this.router.navigate(this.localizedCommands(['feedback', result.sessionCode]));
    } catch {
      this.quickFeedbackError.set(
        $localize`:@@homeFeedbackCard.startError:Blitzlicht konnte nicht gestartet werden. Bitte erneut versuchen.`,
      );
    } finally {
      this.quickFeedbackStarting.set(null);
    }
  }

  onSessionCodeInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const prev = this.sessionCode();
    const normalized = target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    this.sessionCode.set(normalized);
    this.joinError.set(null);
    this.quickFeedbackError.set(null);
    if (normalized.length === 6 && prev.length < 6) {
      this.triggerCtaPulse();
    }
  }

  async joinSession(): Promise<void> {
    if (this.isJoining()) return;
    const code = this.sessionCode().trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      this.joinErrorSessionFinished.set(false);
      this.joinError.set($localize`Bitte den 6-stelligen Code eingeben.`);
      this.triggerShake();
      this.sessionCodeInput?.nativeElement.focus();
      return;
    }
    this.joinErrorSessionFinished.set(false);
    this.joinError.set(null);
    this.isJoining.set(true);
    try {
      const fbResult = await trpc.quickFeedback.results
        .query({ sessionCode: code })
        .catch(() => null);
      if (fbResult) {
        this.addToRecentSessionCodes(code);
        await this.router.navigate(localizeCommands(['feedback', code, 'vote']));
        return;
      }
      const session = await trpc.session.getInfo.query({ code });
      if (session.status === 'FINISHED') {
        this.joinErrorSessionFinished.set(true);
        this.joinError.set($localize`Diese Session ist bereits beendet.`);
        this.triggerShake();
        return;
      }
      this.addToRecentSessionCodes(code);
      await this.router.navigate(localizeCommands(['join', code]));
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'message' in err &&
        typeof (err as { message: string }).message === 'string'
          ? (err as { message: string }).message
          : $localize`Session nicht gefunden.`;
      this.joinErrorSessionFinished.set(false);
      this.joinError.set(msg);
      this.triggerShake();
    } finally {
      this.isJoining.set(false);
    }
  }

  private extractSyncDocId(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const rawIdMatch = trimmed.match(/^[a-zA-Z0-9_-]{8,128}$/);
    if (rawIdMatch) {
      return rawIdMatch[0];
    }

    const syncPathMatch = trimmed.match(
      /(?:https?:\/\/[^/]+)?\/(?:(?:de|en|fr|it|es)\/)?quiz\/sync\/([a-zA-Z0-9_-]{8,128})(?:[/?#].*)?$/i,
    );
    return syncPathMatch?.[1] ?? null;
  }
}
