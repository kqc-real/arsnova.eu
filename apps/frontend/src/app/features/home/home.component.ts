import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { setFeedbackHostToken } from '../../core/feedback-host-token';
import { hasHostToken } from '../../core/host-session-token';
import { setHostToken, trpc } from '../../core/trpc.client';
import { ThemePresetService } from '../../core/theme-preset.service';
import { PresetSnackbarFocusService } from '../../core/preset-snackbar-focus.service';
import {
  localizeKnownServerError,
  sessionNotFoundUiMessage,
} from '../../core/localize-known-server-message';
import { localizeCommands, localizePath } from '../../core/locale-router';
import { navigateToHostSession } from '../../core/session-host-navigation';
import { DEMO_QUIZ_ID, QuizStoreService } from '../quiz/data/quiz-store.service';
import { QUICK_FEEDBACK_PRESET_CHIPS } from '../feedback/feedback.config';
import type {
  MotdInteractionKind,
  MotdPublicDTO,
  QuickFeedbackType,
  SessionInfoDTO,
} from '@arsnova/shared-types';
import {
  clearMotdThumbInteractionKeys,
  hasMotdInteractionRecorded,
  isMotdDismissedForVersion,
  markMotdDismissed,
  markMotdInteractionRecorded,
} from '../../core/motd-storage';
import { resolveMotdAssetOrigin } from '../../core/motd-asset-origin';
import { MotdCurrentService } from '../../core/motd-current.service';
import {
  absolutizeMarkdownHtmlRootAssetImgSrc,
  appendMotdContentVersionToAssetImgSrc,
  renderMarkdownWithoutKatex,
} from '../../shared/markdown-katex.util';
import { MarkdownImageLightboxDirective } from '../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';

@Component({
  selector: 'app-home',
  host: { class: 'route-home' },
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
    MarkdownImageLightboxDirective,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['../../shared/styles/dialog-title-header.scss', './home.component.scss'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly localizedCommands = localizeCommands;
  readonly localizedPath = localizePath;
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly focusService = inject(PresetSnackbarFocusService);
  @ViewChild('sessionCodeInput') private readonly sessionCodeInput?: ElementRef<HTMLInputElement>;
  @ViewChild('syncLinkInput') private readonly syncLinkInput?: ElementRef<HTMLInputElement>;

  sessionCode = signal('');
  codeInputFocused = signal(false);
  codeShaking = signal(false);
  ctaReady = signal(false);
  /** { code, usedAt } – usedAt in ms für relative Anzeige (z.B. „vor 2 Std.“). */
  recentSessionCodes = signal<{ code: string; usedAt: number }[]>([]);
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
  /** Nur Preset Spielerisch: Bühne-Intro und Layout-Hinweise im Template. */
  readonly isPlayfulPreset = computed(() => this.themePreset.preset() === 'spielerisch');
  private readonly quizStore = inject(QuizStoreService);
  /** Sync-Raum-ID für Links zur Quiz-Sync-Seite (z. B. von der Startseite). */
  readonly syncRoomId = this.quizStore.syncRoomId;
  readonly librarySharingMode = this.quizStore.librarySharingMode;
  readonly syncOriginDeviceLabel = this.quizStore.originDeviceLabel;
  readonly syncOriginBrowserLabel = this.quizStore.originBrowserLabel;
  readonly syncPeerInfos = this.quizStore.syncPeerInfos;
  readonly currentDeviceLabel = this.quizStore.currentDeviceLabel;
  readonly currentBrowserLabel = this.quizStore.currentBrowserLabel;
  readonly hostSharingOriginSummary = computed(() => {
    const peer = this.syncPeerInfos()[0] ?? null;
    if (peer) {
      return `${peer.browserLabel} auf ${peer.deviceLabel}`;
    }

    const deviceLabel = this.syncOriginDeviceLabel();
    const browserLabel = this.syncOriginBrowserLabel();
    if (!deviceLabel || !browserLabel) {
      return null;
    }
    if (deviceLabel === this.currentDeviceLabel() && browserLabel === this.currentBrowserLabel()) {
      return null;
    }
    return `${browserLabel} auf ${deviceLabel}`;
  });
  readonly showHostSharingHint = computed(
    () => this.librarySharingMode() === 'shared' && this.hostSharingOriginSummary() !== null,
  );
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
  private readonly sanitizer = inject(DomSanitizer);
  private readonly motdCurrent = inject(MotdCurrentService);
  @ViewChild('motdCloseBtn') private readonly motdCloseBtn?: ElementRef<HTMLButtonElement>;

  /** Aktive MOTD (Epic 10); nur Browser, nach getCurrent. */
  readonly motd = signal<MotdPublicDTO | null>(null);
  readonly motdBodyHtml = signal<SafeHtml | null>(null);
  /** Erzwingt Neuablesung der MOTD-Interaktions-Flags aus localStorage. */
  private readonly motdInteractionRev = signal(0);
  private motdTouchStartY = 0;
  readonly thumbUpRecorded = computed(() => {
    this.motdInteractionRev();
    const m = this.motd();
    return m ? hasMotdInteractionRecorded(m.id, m.contentVersion, 'THUMB_UP') : false;
  });

  readonly thumbDownRecorded = computed(() => {
    this.motdInteractionRev();
    const m = this.motd();
    return m ? hasMotdInteractionRecorded(m.id, m.contentVersion, 'THUMB_DOWN') : false;
  });

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
    // preventScroll: vermeidet Scroll des #main-content zum Code-Feld (kurze Viewports).
    setTimeout(() => this.sessionCodeInput?.nativeElement.focus({ preventScroll: true }), 100);
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
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => void this.validateRecentSessions(), { timeout: 2000 });
      } else {
        setTimeout(() => void this.validateRecentSessions(), 500);
      }
      // MOTD: bald nach erstem Paint, ohne langes Idle-Warten (max. ~400 ms)
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => void this.loadMotdOverlay(), { timeout: 400 });
      } else {
        setTimeout(() => void this.loadMotdOverlay(), 50);
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydownMotd(e: KeyboardEvent): void {
    if (!this.motd()) return;
    if (e.key !== 'Escape') return;
    e.preventDefault();
    void this.dismissMotdOverlay('DISMISS_CLOSE');
  }

  /** Entfernt Sessions, die nicht mehr besucht werden können (cron gelöscht, beendet). */
  private async validateRecentSessions(): Promise<void> {
    const list = this.recentSessionCodes();
    if (list.length === 0) return;
    const visitable = await Promise.all(
      list.map(async (item) => ({ item, ok: await this.isSessionVisitable(item.code) })),
    );
    const kept = visitable.filter((v) => v.ok).map((v) => v.item);
    if (kept.length !== list.length) {
      this.recentSessionCodes.set(kept);
      localStorage.setItem('home-recent-sessions', JSON.stringify(kept));
    }
  }

  private async isSessionVisitable(code: string): Promise<boolean> {
    const { active: fbActive } = await trpc.quickFeedback.isActive
      .query({ sessionCode: code })
      .catch(() => ({ active: false }));
    if (fbActive) return true;
    const session = await trpc.session.getInfo.query({ code }).catch(() => null);
    if (!session) return false;
    return session.status !== 'FINISHED';
  }

  private loadRecentSessionCodes(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = localStorage.getItem('home-recent-sessions');
      const parsed = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const valid: { code: string; usedAt: number }[] = [];
      if (Array.isArray(parsed)) {
        for (let i = 0; i < parsed.length && valid.length < 3; i++) {
          const item = parsed[i];
          if (typeof item === 'string' && /^[A-Z0-9]{6}$/.test(item.trim().toUpperCase())) {
            const usedAt = now - (i === 0 ? 3600_000 : i === 1 ? 86400_000 : 172800_000);
            valid.push({ code: item.trim().toUpperCase(), usedAt });
          } else if (
            item &&
            typeof item === 'object' &&
            typeof (item as { code?: unknown }).code === 'string' &&
            typeof (item as { usedAt?: unknown }).usedAt === 'number'
          ) {
            const rec = item as { code: string; usedAt: number };
            if (/^[A-Z0-9]{6}$/.test(rec.code)) {
              valid.push(rec);
            }
          }
        }
      }
      this.recentSessionCodes.set(valid);
    } catch {
      this.recentSessionCodes.set([]);
    }
  }

  private addToRecentSessionCodes(code: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) return;
    const now = Date.now();
    const current = this.recentSessionCodes();
    const filtered = current.filter((c) => c.code !== normalized);
    const updated = [{ code: normalized, usedAt: now }, ...filtered].slice(0, 3);
    this.recentSessionCodes.set(updated);
    localStorage.setItem('home-recent-sessions', JSON.stringify(updated));
  }

  /** Öffentlich für Template (X-Button) und intern bei Join-Fehler. */
  removeRecentSessionCode(code: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const updated = this.recentSessionCodes().filter((c) => c.code !== code);
    this.recentSessionCodes.set(updated);
    localStorage.setItem('home-recent-sessions', JSON.stringify(updated));
  }

  /** Relative Zeit für „Letzte Sessions“ (z.B. „vor 2 Std.“). */
  recentSessionTime(usedAt: number): string {
    const diff = Date.now() - usedAt;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return $localize`gerade eben`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return $localize`vor ${minutes}\u00A0Min.`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
      return hours === 1 ? $localize`vor 1\u00A0Std.` : $localize`vor ${hours}\u00A0Std.`;
    const days = Math.floor(hours / 24);
    return days === 1 ? $localize`vor 1\u00A0Tag` : $localize`vor ${days}\u00A0Tagen`;
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

  /** Nach unbekanntem Code: Feld leeren und Fokus auf Anfang (neuer Versuch). */
  private clearSessionCodeAndFocusStart(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.sessionCode.set('');
    const el = this.sessionCodeInput?.nativeElement;
    if (!el) return;
    const run = (): void => {
      el.focus();
      try {
        el.setSelectionRange(0, 0);
      } catch {
        /* ignore */
      }
    };
    setTimeout(run, 0);
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

  async openHeroHostTab(tab: 'qa' | 'quickFeedback'): Promise<void> {
    this.joinError.set(null);
    this.joinErrorSessionFinished.set(false);
    this.quickFeedbackError.set(null);

    const code = this.resolveHeroHostCode();
    if (!code) {
      await this.startHeroHostSession(tab);
      return;
    }

    try {
      const session = await trpc.session.getInfo.query({ code });
      const queryParams = this.isHeroTabAvailableForSession(session, tab) ? { tab } : undefined;
      await this.router.navigate(this.localizedCommands(['session', code, 'host']), {
        queryParams,
      });
    } catch {
      await this.router.navigate(this.localizedCommands(['session', code, 'host']), {
        queryParams: { tab },
      });
    }
  }

  private async startHeroHostSession(tab: 'qa' | 'quickFeedback'): Promise<void> {
    try {
      const result =
        tab === 'qa'
          ? await trpc.session.create.mutate({ type: 'Q_AND_A' })
          : await trpc.session.create.mutate({
              type: 'QUIZ',
              quickFeedbackEnabled: true,
            });
      setHostToken(result.code, result.hostToken);
      await navigateToHostSession(this.router, result.code, tab);
    } catch {
      this.joinError.set(
        $localize`:@@home.heroChipStartError:Der Kanal konnte nicht gestartet werden. Bitte versuche es erneut.`,
      );
    }
  }

  private resolveHeroHostCode(): string | null {
    const inputCode = this.sessionCode().trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(inputCode) && hasHostToken(inputCode)) {
      return inputCode;
    }

    const recentHostCode =
      this.recentSessionCodes().find((entry) => hasHostToken(entry.code))?.code ?? null;
    if (recentHostCode) {
      return recentHostCode;
    }

    if (/^[A-Z0-9]{6}$/.test(inputCode)) {
      return inputCode;
    }

    return (
      this.recentSessionCodes().find((entry) => /^[A-Z0-9]{6}$/.test(entry.code))?.code ?? null
    );
  }

  private isHeroTabAvailableForSession(
    session: Pick<SessionInfoDTO, 'type' | 'channels'>,
    tab: 'qa' | 'quickFeedback',
  ): boolean {
    const channels = session.channels;
    if (!channels) {
      return tab === 'qa' && session.type === 'Q_AND_A';
    }
    return tab === 'qa' ? channels.qa.enabled : channels.quickFeedback.enabled;
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
        $localize`:@@homeHostCard.syncLinkError:Bitte einen gültigen Sync-Link einfügen.`,
      );
      this.syncLinkInput?.nativeElement.focus();
      return;
    }

    this.syncLinkError.set(null);
    this.quizStore.activateSyncRoom(docId, { markShared: true, registerOrigin: true });
    await this.router.navigate(this.localizedCommands(['quiz']), {
      queryParams: { syncImported: 1 },
    });
  }

  unlinkSharedLibrary(): void {
    const shouldUnlink =
      typeof globalThis.confirm !== 'function'
        ? true
        : globalThis.confirm(
            $localize`:@@homeHostCard.syncUnlinkConfirmPrompt:Verknüpfung wirklich lösen? Die aktuelle Quiz-Sammlung bleibt auf diesem Gerät erhalten.`,
          );
    if (!shouldUnlink) {
      return;
    }

    this.quizStore.unlinkSharedLibrary();
    this.snackBar.open(
      $localize`:@@homeHostCard.syncUnlinkSuccess:Verknüpfung gelöst. Die Quiz-Sammlung ist jetzt nur auf diesem Gerät aktiv.`,
      '',
      {
        duration: 4500,
        horizontalPosition: 'center',
        verticalPosition: 'top',
      },
    );
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
      if (result.hostToken) {
        setFeedbackHostToken(result.sessionCode, result.hostToken);
      }
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
      const { active: fbActive } = await trpc.quickFeedback.isActive
        .query({ sessionCode: code })
        .catch(() => ({ active: false }));
      if (fbActive) {
        this.addToRecentSessionCodes(code);
        await this.router.navigate(localizeCommands(['feedback', code, 'vote']));
        return;
      }
      const session = await trpc.session.getInfo.query({ code });
      if (session.status === 'FINISHED') {
        this.removeRecentSessionCode(code);
        this.joinErrorSessionFinished.set(true);
        this.joinError.set($localize`Diese Session ist bereits beendet.`);
        this.triggerShake();
        return;
      }
      this.addToRecentSessionCodes(code);
      await this.router.navigate(localizeCommands(['join', code]));
    } catch (err: unknown) {
      this.removeRecentSessionCode(code);
      this.joinErrorSessionFinished.set(false);
      this.joinError.set(localizeKnownServerError(err, sessionNotFoundUiMessage()));
      this.triggerShake();
      this.clearSessionCodeAndFocusStart();
    } finally {
      this.isJoining.set(false);
    }
  }

  private async loadMotdOverlay(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const motd = await this.motdCurrent.getCurrent();
    if (!motd || isMotdDismissedForVersion(motd.id, motd.contentVersion)) {
      return;
    }
    this.motd.set(motd);
    const html = appendMotdContentVersionToAssetImgSrc(
      absolutizeMarkdownHtmlRootAssetImgSrc(
        renderMarkdownWithoutKatex(motd.markdown),
        resolveMotdAssetOrigin(),
      ),
      motd.contentVersion,
    );
    this.motdBodyHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
    setTimeout(() => this.motdCloseBtn?.nativeElement?.focus(), 0);
  }

  private clearMotdOverlay(): void {
    this.motd.set(null);
    this.motdBodyHtml.set(null);
  }

  onMotdBackdropClick(): void {
    void this.dismissMotdOverlay('DISMISS_CLOSE');
  }

  onMotdSheetClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  onMotdTouchStart(event: TouchEvent): void {
    if (
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const t = event.touches[0];
    if (t) this.motdTouchStartY = t.clientY;
  }

  onMotdTouchEnd(event: TouchEvent): void {
    if (
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const t = event.changedTouches[0];
    if (!t) return;
    const dy = t.clientY - this.motdTouchStartY;
    if (dy > 88) {
      void this.dismissMotdOverlay('DISMISS_SWIPE');
    }
  }

  async dismissMotdOverlay(
    kind: Extract<MotdInteractionKind, 'DISMISS_CLOSE' | 'DISMISS_SWIPE'>,
  ): Promise<void> {
    const m = this.motd();
    if (!m) return;
    await this.tryRecordMotdInteraction(kind);
    markMotdDismissed(m.id, m.contentVersion);
    this.clearMotdOverlay();
    this.motdCurrent.invalidate();
  }

  async ackMotd(): Promise<void> {
    const m = this.motd();
    if (!m) return;
    await this.tryRecordMotdInteraction('ACK');
    markMotdDismissed(m.id, m.contentVersion);
    this.clearMotdOverlay();
    this.motdCurrent.invalidate();
  }

  async thumbMotd(up: boolean): Promise<void> {
    const m = this.motd();
    if (!m) return;
    const id = m.id;
    const cv = m.contentVersion;
    const hadUp = hasMotdInteractionRecorded(id, cv, 'THUMB_UP');
    const hadDown = hasMotdInteractionRecorded(id, cv, 'THUMB_DOWN');

    if (hadUp && up) {
      if (await this.mutateMotdInteraction('THUMB_UP_REVOKE')) {
        clearMotdThumbInteractionKeys(id, cv);
        this.motdInteractionRev.update((n) => n + 1);
      }
      return;
    }
    if (hadDown && !up) {
      if (await this.mutateMotdInteraction('THUMB_DOWN_REVOKE')) {
        clearMotdThumbInteractionKeys(id, cv);
        this.motdInteractionRev.update((n) => n + 1);
      }
      return;
    }
    if (hadUp && !up) {
      if (await this.mutateMotdInteraction('THUMB_SWITCH_UP_TO_DOWN')) {
        clearMotdThumbInteractionKeys(id, cv);
        markMotdInteractionRecorded(id, cv, 'THUMB_DOWN');
        this.motdInteractionRev.update((n) => n + 1);
      }
      return;
    }
    if (hadDown && up) {
      if (await this.mutateMotdInteraction('THUMB_SWITCH_DOWN_TO_UP')) {
        clearMotdThumbInteractionKeys(id, cv);
        markMotdInteractionRecorded(id, cv, 'THUMB_UP');
        this.motdInteractionRev.update((n) => n + 1);
      }
      return;
    }
    await this.tryRecordMotdInteraction(up ? 'THUMB_UP' : 'THUMB_DOWN');
  }

  private async mutateMotdInteraction(kind: MotdInteractionKind): Promise<boolean> {
    const m = this.motd();
    if (!m) return false;
    try {
      await trpc.motd.recordInteraction.mutate({
        motdId: m.id,
        contentVersion: m.contentVersion,
        kind,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async tryRecordMotdInteraction(kind: MotdInteractionKind): Promise<void> {
    const m = this.motd();
    if (!m) return;
    if (hasMotdInteractionRecorded(m.id, m.contentVersion, kind)) return;
    try {
      await trpc.motd.recordInteraction.mutate({
        motdId: m.id,
        contentVersion: m.contentVersion,
        kind,
      });
      markMotdInteractionRecorded(m.id, m.contentVersion, kind);
      this.motdInteractionRev.update((n) => n + 1);
    } catch {
      /* optional: still allow dismiss */
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
