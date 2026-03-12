import { DecimalPipe, DOCUMENT } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject, signal, computed, effect } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import QRCode from 'qrcode';
import type { Unsubscribable } from '@trpc/server/observable';
import type { Subscription } from 'rxjs';
import { trpc } from '../../../core/trpc.client';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { SoundService } from '../../../core/sound.service';
import {
  ConfirmLeaveDialogComponent,
  type ConfirmLeaveDialogData,
} from '../../../shared/confirm-leave-dialog/confirm-leave-dialog.component';
import type {
  BonusTokenEntryDTO,
  HostCurrentQuestionDTO,
  LeaderboardEntryDTO,
  SessionFeedbackSummary,
  SessionInfoDTO,
  SessionParticipantsPayload,
  SessionStatusUpdate,
} from '@arsnova/shared-types';
import { WordCloudComponent } from '../session-present/word-cloud.component';
import { CountdownFingersComponent } from '../../../shared/countdown-fingers/countdown-fingers.component';

const ANSWER_COLORS = ['#1565c0', '#e65100', '#2e7d32', '#6a1b9a', '#c62828', '#00838f', '#4e342e', '#37474f'];
const ANSWER_SHAPES = ['\u25B3', '\u25CB', '\u25A1', '\u25C7', '\u2606', '\u2B21', '\u2B20', '\u2BC6'];

/**
 * Host-Ansicht: Lobby + Präsentations-Steuerung (Epic 2).
 * Story 2.1a, 2.2, 2.3, 2.4, 4.2, 4.6, 4.7, 4.8, 7.1, 8.1, 8.4.
 */
@Component({
  selector: 'app-session-host',
  standalone: true,
  imports: [
    DecimalPipe,
    MatButton,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardSubtitle,
    MatCardTitle,
    MatIcon,
    WordCloudComponent,
    CountdownFingersComponent,
  ],
  templateUrl: './session-host.component.html',
  styleUrl: './session-host.component.scss',
})
export class SessionHostComponent implements OnInit, OnDestroy {
  session = signal<SessionInfoDTO | null>(null);
  /** Lobby: Live-Teilnehmerliste (Story 2.2). */
  readonly participantsPayload = signal<SessionParticipantsPayload | null>(null);
  /** Live-Status für Steuerung (Story 2.3). */
  readonly statusUpdate = signal<SessionStatusUpdate | null>(null);
  readonly controlPending = signal(false);
  private participantSub: Unsubscribable | null = null;
  private statusSub: Unsubscribable | null = null;
  private presetSub: Subscription | null = null;
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly themePreset = inject(ThemePresetService);
  private readonly sound = inject(SoundService);
  private readonly dialog = inject(MatDialog);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
  readonly freetextResponses = signal<string[]>([]);
  readonly wordCloudInfo = signal('Warte auf Live-Freitextdaten …');
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly exportStatus = signal<string | null>(null);
  readonly exportExporting = signal(false);
  readonly leaderboard = signal<LeaderboardEntryDTO[]>([]);
  readonly leaderboardLoading = signal(false);
  readonly bonusTokens = signal<BonusTokenEntryDTO[]>([]);
  readonly feedbackSummary = signal<SessionFeedbackSummary | null>(null);
  /** Aktuelle Frage für Host (Text + Antwortoptionen), null wenn keine Frage aktiv. */
  readonly currentQuestionForHost = signal<HostCurrentQuestionDTO | null>(null);
  /** Emoji-Reaktionen der Teilnehmer in der Ergebnis-Phase (Story 5.8). */
  readonly emojiReactions = signal<{ reactions: Record<string, number>; total: number } | null>(null);
  /** Countdown in Sekunden (null = kein Timer, Story 3.5). */
  readonly countdownSeconds = signal<number | null>(null);
  /** true, sobald der Countdown 0 erreicht hat (bis zum nächsten Start). */
  readonly countdownEnded = signal(false);
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private fingerHideTimeout: ReturnType<typeof setTimeout> | null = null;
  readonly Math = Math;

  /** Reihenfolge der Emojis für die Reaktions-Anzeige (Story 5.8). */
  readonly emojiOrder: readonly string[] = ['👏', '🎉', '😮', '😂', '😢'];

  showFingerCountdown(): boolean {
    const s = this.countdownSeconds();
    return this.effectiveStatus() === 'ACTIVE' && s !== null && s >= 0 && s <= 5 && this.themePreset.preset() === 'spielerisch';
  }

  /** Stimmenzahl der aktuellen Frage (für Vergleich mit Teilnehmerzahl). */
  private getVoteCountForCurrentQuestion(q: HostCurrentQuestionDTO | null): number {
    if (!q) return 0;
    if (q.type === 'RATING') return q.ratingCount ?? 0;
    if (q.type === 'FREETEXT') return q.freeTextResponses?.length ?? 0;
    return q.totalVotes ?? 0;
  }

  readonly allHaveVoted = computed(() => {
    if (this.effectiveStatus() !== 'ACTIVE') return false;
    const participants = this.participantsPayload()?.participantCount ?? 0;
    if (participants <= 0) return false;
    const votes = this.getVoteCountForCurrentQuestion(this.currentQuestionForHost());
    return votes >= participants;
  });

  private previousStatus: string | null = null;

  constructor() {
    effect(() => {
      if (this.allHaveVoted()) {
        this.stopCountdown();
        this.countdownSeconds.set(null);
        this.sound.stopAllSfx();
      }
    });
    effect(() => {
      if (this.countdownEnded()) {
        this.sound.stopMusic();
      }
    });
    effect(() => {
      const status = this.effectiveStatus();
      if (status === 'FINISHED' || status === 'RESULTS') {
        void this.loadLeaderboard();
      }
    });
    // Story 5.1: Sound-Effekte bei Status-Wechsel
    effect(() => {
      const status = this.effectiveStatus();
      const prev = this.previousStatus;
      this.previousStatus = status;
      if (!status || status === prev) return;
      const settings = this.session();
      if (!settings?.enableSoundEffects) return;
      this.sound.unlock();
      if (status === 'ACTIVE' && prev !== 'ACTIVE') {
        this.sound.stopAllSfx();
        void this.sound.play('questionStart');
      } else if (status === 'FINISHED') {
        this.sound.stopAllSfx();
        void this.sound.play('sessionEnd');
      } else if (status === 'RESULTS' || status === 'QUESTION_OPEN') {
        this.sound.stopAllSfx();
      }
    });
  }

  getColor(index: number): string { return ANSWER_COLORS[index % ANSWER_COLORS.length]; }
  getShape(index: number): string { return ANSWER_SHAPES[index % ANSWER_SHAPES.length]; }
  getLetter(index: number): string { return String.fromCharCode(65 + index); }

  ratingBarRange(q: HostCurrentQuestionDTO): number[] {
    const min = q.ratingMin ?? 1;
    const max = q.ratingMax ?? 5;
    const range: number[] = [];
    for (let i = min; i <= max; i++) range.push(i);
    return range;
  }

  /** Verteilung der Sterne als lesbare Zeile (z. B. "1× 4 ★ · 2× 5 ★"). */
  getFeedbackDistributionLine(dist: Record<string, number>): string | null {
    if (!dist || Object.keys(dist).length === 0) return null;
    const parts: string[] = [];
    for (let star = 1; star <= 5; star++) {
      const n = dist[String(star)] ?? 0;
      if (n > 0) parts.push(`${n}× ${star} ★`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  /** Für Lobby: volle Beitritts-URL (präsentierbar, Story 2.1b QR-Code). */
  get joinUrl(): string {
    const origin = typeof this.document?.defaultView?.location?.origin === 'string'
      ? this.document.defaultView.location.origin
      : '';
    return origin ? `${origin}/join/${this.code}` : `/join/${this.code}`;
  }

  /** QR-Code als Data-URL für joinUrl (Beamer-tauglich, Story 2.1b). */
  readonly qrDataUrl = signal<string>('');

  async ngOnInit(): Promise<void> {
    if (this.code.length !== 6) return;
    try {
      const session = await trpc.session.getInfo.query({ code: this.code.toUpperCase() });
      this.session.set(session);
      if (session.preset === 'PLAYFUL' || session.preset === 'SERIOUS') {
        this.themePreset.setPreset(session.preset === 'PLAYFUL' ? 'spielerisch' : 'serious', { silent: true });
      }
    } catch {
      this.session.set(null);
    }

    await this.generateQrCode();
    await this.refreshLiveFreetext();
    await this.refreshCurrentQuestionForHost();
    this.sound.stopMusic();
    this.pollTimer = setInterval(() => {
      void this.refreshLiveFreetext();
      void this.refreshCurrentQuestionForHost();
      void this.refreshEmojiReactions();
      this.syncMusic();
    }, 2000);
    this.syncMusic();

    if (this.code.length === 6) {
      this.participantSub = trpc.session.onParticipantJoined.subscribe(
        { code: this.code.toUpperCase() },
        {
          onData: (data) => this.participantsPayload.set(data),
          onError: () => {},
        },
      );
      this.statusSub = trpc.session.onStatusChanged.subscribe(
        { code: this.code.toUpperCase() },
        {
          onData: (data) => this.statusUpdate.set({
            status: data.status as SessionStatusUpdate['status'],
            currentQuestion: data.currentQuestion,
            activeAt: data.activeAt,
          }),
          onError: () => {},
        },
      );

      this.presetSub = this.themePreset.presetChanged$.subscribe(() => {
        const preset = this.themePreset.preset() === 'serious' ? 'SERIOUS' as const : 'PLAYFUL' as const;
        void trpc.session.updatePreset.mutate({ code: this.code.toUpperCase(), preset });
      });

      this.document.addEventListener('click', this.unlockListener, { once: true });
      this.document.addEventListener('keydown', this.unlockListener, { once: true });
    }
  }

  private unlockListener = (): void => {
    this.sound.unlock();
    this.document.removeEventListener('click', this.unlockListener);
    this.document.removeEventListener('keydown', this.unlockListener);
  };

  ngOnDestroy(): void {
    this.participantSub?.unsubscribe();
    this.participantSub = null;
    this.statusSub?.unsubscribe();
    this.statusSub = null;
    this.presetSub?.unsubscribe();
    this.presetSub = null;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.stopCountdown();
    this.sound.stopAll();
    this.document.removeEventListener('click', this.unlockListener);
    this.document.removeEventListener('keydown', this.unlockListener);
  }

  /** Warnt den Host, wenn er den Tab schließt oder die Seite neu lädt. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isSessionActive()) {
      event.preventDefault();
    }
  }

  /** Prüft, ob die Session noch läuft (nicht FINISHED und nicht null). */
  private isSessionActive(): boolean {
    const status = this.effectiveStatus();
    return status !== null && status !== 'FINISHED';
  }

  /**
   * CanDeactivate-Guard-Hook: zeigt einen Bestätigungsdialog,
   * wenn die Session noch läuft.
   */
  async canDeactivate(): Promise<boolean> {
    if (!this.isSessionActive()) return true;

    const status = this.effectiveStatus();
    const participants = this.participantsPayload()?.participantCount ?? 0;

    const consequences: string[] = [
      'Die Session läuft im Hintergrund weiter – Teilnehmende bleiben verbunden.',
      'Du verlierst die Steuerung (nächste Frage, Timer, Ergebnisse zeigen).',
    ];
    if (participants > 0) {
      consequences.push(`${participants} Teilnehmende warten auf deine Steuerung.`);
    }
    if (status === 'ACTIVE' || status === 'QUESTION_OPEN') {
      consequences.push('Die aktuelle Frage bleibt offen – kein automatisches Weiterschalten.');
    }

    const dialogRef = this.dialog.open(ConfirmLeaveDialogComponent, {
      data: {
        title: 'Session verlassen?',
        message: 'Deine Session ist noch aktiv.',
        consequences,
        confirmLabel: 'Trotzdem verlassen',
        cancelLabel: 'Zurück zur Session',
      } satisfies ConfirmLeaveDialogData,
      width: '26rem',
      autoFocus: 'dialog',
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return result === true;
  }

  private startCountdown(timerSeconds: number | null | undefined, activeAt?: string): void {
    this.stopCountdown();
    this.countdownEnded.set(false);
    if (!timerSeconds || timerSeconds <= 0) {
      this.countdownSeconds.set(null);
      return;
    }
    const start = activeAt ? new Date(activeAt).getTime() : Date.now();
    const deadline = start + timerSeconds * 1000;

    const tick = (): void => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      this.countdownSeconds.set(remaining);
      if (remaining > 0 && remaining <= 5 && this.session()?.enableSoundEffects) {
        if (remaining === 1) {
          void this.sound.play('countdownEnd');
        } else {
          void this.sound.play('countdownTick');
        }
      }
      if (remaining <= 0) {
        this.stopCountdown();
        this.countdownSeconds.set(0);
        this.countdownEnded.set(true);
        this.fingerHideTimeout = setTimeout(() => {
          this.countdownSeconds.set(null);
          this.fingerHideTimeout = null;
        }, 5000);
      }
    };

    tick();
    this.countdownTimer = setInterval(tick, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    if (this.fingerHideTimeout) { clearTimeout(this.fingerHideTimeout); this.fingerHideTimeout = null; }
    this.sound.stopMusic();
  }

  /**
   * Stoppt Hintergrundmusik (Hintergrundmusik im Host deaktiviert).
   * Wird vom Poll-Timer alle 2s und beim Init aufgerufen.
   */
  private syncMusic(): void {
    this.sound.stopMusic();
  }

  async exportFreetextSessionCsv(): Promise<void> {
    try {
      const data = await trpc.session.getFreetextSessionExport.query({ code: this.code.toUpperCase() });
      const rows = ['questionOrder,questionText,response,count'];
      for (const entry of data.entries) {
        for (const aggregate of entry.aggregates) {
          rows.push(
            [
              entry.questionOrder + 1,
              escapeCsv(entry.questionText),
              escapeCsv(aggregate.text),
              aggregate.count,
            ].join(','),
          );
        }
      }
      const content = rows.join('\n');
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = this.document.createElement('a');
      anchor.href = url;
      anchor.download = `freetext-session_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      this.exportStatus.set('Session-CSV exportiert.');
    } catch {
      this.exportStatus.set('Session-CSV konnte nicht exportiert werden.');
    }
  }

  private async generateQrCode(): Promise<void> {
    try {
      const url = await QRCode.toDataURL(this.joinUrl, { width: 320, margin: 2 });
      this.qrDataUrl.set(url);
    } catch {
      // best-effort
    }
  }

  /** Effektiver Status (Subscription oder Initial getInfo). */
  effectiveStatus(): SessionInfoDTO['status'] | null {
    const su = this.statusUpdate();
    const s = this.session();
    return su?.status ?? s?.status ?? null;
  }

  /** Lesbare Phasen-Beschreibung für Dozenten-Info und Publikum. */
  phaseLabel(status: SessionInfoDTO['status'] | null, allVoted = false, countdownEnded = false): string {
    if (!status) return '—';
    if (status === 'ACTIVE' && (allVoted || countdownEnded)) {
      return 'Abstimmung beendet – warte auf Auswertung';
    }
    const labels: Record<SessionInfoDTO['status'], string> = {
      LOBBY: 'Lobby – Teilnehmende können beitreten',
      QUESTION_OPEN: 'Lesephase – Frage sichtbar, Antworten noch gesperrt',
      ACTIVE: 'Abstimmung läuft',
      PAUSED: 'Pausiert',
      RESULTS: 'Ergebnisse werden angezeigt',
      DISCUSSION: 'Diskussionsphase – Austausch vor zweiter Runde',
      FINISHED: 'Session beendet',
    };
    return labels[status] ?? status;
  }

  effectiveCurrentQuestion(): number | null {
    const su = this.statusUpdate();
    return su?.currentQuestion ?? null;
  }

  /** True, wenn die aktuelle Frage die letzte ist – dann zeigt der Steuerungs-Button „Session beenden“. */
  isLastQuestion(): boolean {
    const q = this.currentQuestionForHost();
    if (!q || q.totalQuestions === null || q.totalQuestions === undefined) return false;
    return q.order + 1 >= q.totalQuestions;
  }

  /** Markdown + KaTeX für Frage- und Antworttexte (wie Quiz-Vorschau). */
  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdownWithKatex(value).html);
  }

  async nextQuestion(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.nextQuestion.mutate({ code: this.code.toUpperCase() });
      this.currentQuestionForHost.set(null);
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
      if (result.status === 'ACTIVE') {
        this.startCountdown(this.currentQuestionForHost()?.timer, result.activeAt);
      }
    } finally {
      this.controlPending.set(false);
    }
  }

  async revealAnswers(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      const result = await trpc.session.revealAnswers.mutate({ code: this.code.toUpperCase() });
      this.currentQuestionForHost.set(null);
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
      this.startCountdown(this.currentQuestionForHost()?.timer, result.activeAt);
    } finally {
      this.controlPending.set(false);
    }
  }

  async revealResults(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.revealResults.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
    } finally {
      this.controlPending.set(false);
    }
  }

  async startDiscussion(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.startDiscussion.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
    } finally {
      this.controlPending.set(false);
    }
  }

  async startSecondRound(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      const result = await trpc.session.startSecondRound.mutate({ code: this.code.toUpperCase() });
      this.currentQuestionForHost.set(null);
      this.statusUpdate.set(result);
      await this.refreshCurrentQuestionForHost();
      this.startCountdown(this.currentQuestionForHost()?.timer, result.activeAt);
    } finally {
      this.controlPending.set(false);
    }
  }

  async refreshEmojiReactions(): Promise<void> {
    if (this.effectiveStatus() !== 'RESULTS' || !this.session()?.enableEmojiReactions) {
      this.emojiReactions.set(null);
      return;
    }
    const sid = this.session()?.id;
    const qid = this.currentQuestionForHost()?.questionId;
    if (!sid || !qid) {
      this.emojiReactions.set(null);
      return;
    }
    try {
      const data = await trpc.session.getReactions.query({ sessionId: sid, questionId: qid });
      this.emojiReactions.set(data);
    } catch {
      this.emojiReactions.set(null);
    }
  }

  async loadLeaderboard(): Promise<void> {
    if (!this.code || this.leaderboardLoading()) return;
    this.leaderboardLoading.set(true);
    try {
      const entries = await trpc.session.getLeaderboard.query({ code: this.code.toUpperCase() });
      this.leaderboard.set(entries);
    } catch {
      this.leaderboard.set([]);
    } finally {
      this.leaderboardLoading.set(false);
    }
    if (this.effectiveStatus() === 'FINISHED') {
      this.loadBonusTokens();
      this.loadFeedbackSummary();
    }
  }

  async loadBonusTokens(): Promise<void> {
    if (!this.code) return;
    try {
      const result = await trpc.session.getBonusTokens.query({ code: this.code.toUpperCase() });
      this.bonusTokens.set(result.tokens);
    } catch {
      this.bonusTokens.set([]);
    }
  }

  async loadFeedbackSummary(): Promise<void> {
    if (!this.code) return;
    try {
      const summary = await trpc.session.getSessionFeedbackSummary.query({ code: this.code.toUpperCase() });
      if (summary.totalResponses > 0) {
        this.feedbackSummary.set(summary);
      }
    } catch { /* noop */ }
  }

  exportBonusTokensCsv(): void {
    const tokens = this.bonusTokens();
    if (tokens.length === 0) return;
    const header = 'Rang;Nickname;Code;Punkte;Generiert am';
    const rows = tokens.map((t) =>
      `${t.rank};${t.nickname};${t.token};${t.totalScore};${t.generatedAt}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = this.document.createElement('a');
    a.href = url;
    a.download = `bonus-codes-${this.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async exportSessionResultsCsv(): Promise<void> {
    const sid = this.session()?.id;
    if (!sid || this.exportExporting()) return;
    this.exportStatus.set(null);
    this.exportExporting.set(true);
    try {
      const data = await trpc.session.getExportData.query({ sessionId: sid });
      const rows: string[] = [
        'Frage Nr.;Fragentext;Typ;Teilnehmer;Ø Punkte;Details',
      ];

      for (const q of data.questions) {
        let details = '';
        if (q.optionDistribution) {
          details = q.optionDistribution
            .map((o) => `${stripMarkdownToPlainText(o.text)}: ${o.count} (${o.percentage}%)${o.isCorrect ? ' ✓' : ''}`)
            .join(' | ');
        } else if (q.freetextAggregates) {
          details = q.freetextAggregates
            .map((f) => `${stripMarkdownToPlainText(f.text)}: ${f.count}`)
            .join(' | ');
        } else if (q.ratingDistribution) {
          details = Object.entries(q.ratingDistribution)
            .map(([k, v]) => `${k}★: ${v}`)
            .join(' | ');
          if (q.ratingAverage !== null && q.ratingAverage !== undefined) details += ` (Ø ${q.ratingAverage})`;
        }

        rows.push(
          [
            q.questionOrder + 1,
            escapeCsv(stripMarkdownToPlainText(q.questionTextShort)),
            q.type,
            q.participantCount,
            q.averageScore ?? '',
            escapeCsv(details),
          ].join(';'),
        );
      }

      if (data.bonusTokens && data.bonusTokens.length > 0) {
        rows.push('');
        rows.push('Bonus-Codes');
        rows.push('Rang;Nickname;Code;Punkte;Generiert am');
        for (const t of data.bonusTokens) {
          rows.push(`${t.rank};${t.nickname};${t.token};${t.totalScore};${t.generatedAt}`);
        }
      }

      const csv = '\uFEFF' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = this.document.createElement('a');
      a.href = url;
      a.download = `ergebnis-export-${data.sessionCode}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      this.exportStatus.set('Ergebnis-CSV exportiert.');
    } catch {
      this.exportStatus.set('Export fehlgeschlagen.');
    } finally {
      this.exportExporting.set(false);
    }
  }

  async endSession(): Promise<void> {
    if (this.controlPending() || !this.code) return;
    this.controlPending.set(true);
    try {
      this.stopCountdown();
      this.countdownSeconds.set(null);
      const result = await trpc.session.end.mutate({ code: this.code.toUpperCase() });
      this.statusUpdate.set(result);
      this.currentQuestionForHost.set(null);
    } finally {
      this.controlPending.set(false);
    }
  }

  private async refreshCurrentQuestionForHost(): Promise<void> {
    if (!this.code || this.code.length !== 6) return;
    try {
      const q = await trpc.session.getCurrentQuestionForHost.query({ code: this.code.toUpperCase() });
      this.currentQuestionForHost.set(q);
    } catch {
      this.currentQuestionForHost.set(null);
    }
  }

  private async refreshLiveFreetext(): Promise<void> {
    try {
      const data = await trpc.session.getLiveFreetext.query({ code: this.code.toUpperCase() });
      this.freetextResponses.set(data.responses);

      if (data.questionType === 'FREETEXT') {
        this.currentQuestionLabel.set(
          data.questionOrder !== null ? `Frage ${data.questionOrder + 1}: ${data.questionText ?? ''}` : null,
        );
        this.wordCloudInfo.set('Live-Freitext wird aktualisiert.');
      } else if (data.questionType) {
        this.currentQuestionLabel.set(
          data.questionOrder !== null ? `Frage ${data.questionOrder + 1}: ${data.questionText ?? ''}` : null,
        );
        this.wordCloudInfo.set('Aktuelle Frage ist keine Freitext-Frage.');
      } else {
        this.currentQuestionLabel.set(null);
        this.wordCloudInfo.set('Noch keine aktive Frage.');
      }
    } catch {
      this.wordCloudInfo.set('Live-Freitextdaten konnten nicht geladen werden.');
    }
  }
}

/** Markdown/KaTeX für CSV-Export in lesbaren Fließtext umwandeln. */
function stripMarkdownToPlainText(s: string): string {
  const t = s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/^#+\s*/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
