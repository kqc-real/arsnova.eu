import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatBadge } from '@angular/material/badge';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { trpc } from '../../core/trpc.client';
import { ServerStatusWidgetComponent } from '../../shared/server-status-widget/server-status-widget.component';
import { ThemePresetService } from '../../core/theme-preset.service';
import { PresetSnackbarFocusService } from '../../core/preset-snackbar-focus.service';
import { DEMO_QUIZ_ID, QuizStoreService } from '../quiz/data/quiz-store.service';

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
    MatTooltip,
    ServerStatusWidgetComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly focusService = inject(PresetSnackbarFocusService);
  @ViewChild('sessionCodeInput') private readonly sessionCodeInput?: ElementRef<HTMLInputElement>;

  apiStatus = signal<string | null>(null);
  apiRetrying = signal(false);
  redisStatus = signal<string | null>(null);
  sessionCode = signal('');
  codeInputFocused = signal(false);
  codeShaking = signal(false);
  ctaReady = signal(false);
  recentSessionCodes = signal<string[]>([]);
  joinError = signal<string | null>(null);
  isJoining = signal(false);

  readonly themePreset = inject(ThemePresetService);
  private readonly quizStore = inject(QuizStoreService);
  readonly quizCount = computed(() => this.quizStore.quizzes().filter(q => q.id !== DEMO_QUIZ_ID).length);
  private readonly platformId = inject(PLATFORM_ID);

  isValidSessionCode = computed(() => /^[A-Z0-9]{6}$/.test(this.sessionCode()));
  readonly demoSessionCode = 'DEMO01';
  readonly demoQuizId = DEMO_QUIZ_ID;
  readonly codeSlots = [0, 1, 2, 3, 4, 5];

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
    const cta = document.getElementById('participant-entry')
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
    // Health-Check nach First Paint, damit API-Anfrage den kritischen Lade-Pfad nicht blockiert
    if (isPlatformBrowser(this.platformId)) {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => this.checkApiConnection(), { timeout: 2000 });
      } else {
        setTimeout(() => this.checkApiConnection(), 0);
      }
    }
  }

  async checkApiConnection(): Promise<void> {
    try {
      const health = await trpc.health.check.query();
      this.apiStatus.set(health.status);
      this.redisStatus.set(health.redis ?? null);
    } catch {
      this.apiStatus.set(null);
    }
  }

  async retryConnection(): Promise<void> {
    this.apiRetrying.set(true);
    await this.checkApiConnection();
    this.apiRetrying.set(false);
  }

  private loadRecentSessionCodes(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = localStorage.getItem('home-recent-sessions');
      const codes = raw ? (JSON.parse(raw) as string[]) : [];
      const valid = Array.isArray(codes)
        ? codes.filter((c) => typeof c === 'string' && /^[A-Z0-9]{6}$/.test(c.trim().toUpperCase())).slice(0, 3)
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

  feedbackError = signal<string | null>(null);

  async startQuickFeedback(type: 'MOOD' | 'ABCD' | 'YESNO'): Promise<void> {
    this.feedbackError.set(null);
    try {
      const result = await trpc.quickFeedback.create.mutate({
        type,
        theme: this.themePreset.theme(),
        preset: this.themePreset.preset(),
      });
      await this.router.navigate(['/feedback', result.sessionCode]);
    } catch {
      this.feedbackError.set('Feedback konnte nicht gestartet werden. Ist der Server erreichbar?');
    }
  }

  onSessionCodeInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const prev = this.sessionCode();
    const normalized = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    this.sessionCode.set(normalized);
    this.joinError.set(null);
    if (normalized.length === 6 && prev.length < 6) {
      this.triggerCtaPulse();
    }
  }

  async joinSession(): Promise<void> {
    if (this.isJoining()) return;
    const code = this.sessionCode().trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      this.joinError.set('Bitte den 6-stelligen Code eingeben.');
      this.triggerShake();
      this.sessionCodeInput?.nativeElement.focus();
      return;
    }
    this.joinError.set(null);
    this.isJoining.set(true);
    this.addToRecentSessionCodes(code);
    try {
      const fbResult = await trpc.quickFeedback.results.query({ sessionCode: code }).catch(() => null);
      if (fbResult) {
        await this.router.navigate(['/feedback', code, 'vote']);
      } else {
        await this.router.navigate(['/join', code]);
      }
    } catch {
      this.joinError.set('Beitritt fehlgeschlagen.');
      this.triggerShake();
    } finally {
      this.isJoining.set(false);
    }
  }
}
