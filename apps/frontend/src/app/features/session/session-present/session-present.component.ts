import { DecimalPipe } from '@angular/common';
import { Component, LOCALE_ID, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { WordCloudComponent } from './word-cloud.component';
import {
  localizeKnownServerError,
  sessionNotFoundUiMessage,
} from '../../../core/localize-known-server-message';
import { trpc } from '../../../core/trpc.client';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import {
  feedbackDisplayIcon,
  feedbackDisplayLabel,
  feedbackResultOrder,
  feedbackTitle,
} from '../../feedback/feedback.config';
import type {
  QaQuestionDTO,
  QuickFeedbackResult,
  SessionInfoDTO,
  TeamLeaderboardEntryDTO,
} from '@arsnova/shared-types';
import { recordServerTimeSample } from '../session-server-clock';
import { localizePath } from '../../../core/locale-router';
import { formatLocaleCount, formatLocalePercent } from '../../../core/locale-number.util';
import {
  getEffectiveLocale,
  localeIdToSupported,
  type SupportedLocale,
} from '../../../core/locale-from-path';
import { MarkdownImageLightboxDirective } from '../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { getWordCloudWeightFromUpvotes } from './word-cloud.util';
import {
  WordCloudTermExtractorService,
  type WordCloudTerm,
  type WordCloudTermDocument,
} from './word-cloud-term.service';

/**
 * Beamer-Ansicht / Presenter-Mode (Epic 2).
 * Story 2.5, 2.6, 3.5, 4.1, 4.4, 4.5, 1.14, 7.1, 8.2, 8.3.
 */
@Component({
  selector: 'app-session-present',
  standalone: true,
  imports: [
    DecimalPipe,
    MatButton,
    MatCard,
    MatCardContent,
    MatIcon,
    RouterLink,
    WordCloudComponent,
    MarkdownImageLightboxDirective,
  ],
  templateUrl: './session-present.component.html',
  styleUrl: './session-present.component.scss',
})
export class SessionPresentComponent implements OnInit, OnDestroy {
  private static readonly META_POLL_MS = 10_000;
  private static readonly LIVE_POLL_MS = 2_000;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly localeId = inject(LOCALE_ID);
  private readonly wordCloudTermExtractor = inject(WordCloudTermExtractorService);
  private readonly themePreset = inject(ThemePresetService);
  private metaPollTimer: ReturnType<typeof setInterval> | null = null;
  private livePollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';
  private readonly onVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.stopPolling();
      return;
    }
    this.startPolling();
    void this.refreshSessionMeta();
    void this.refreshPresenterLiveData();
  };
  readonly localizedPath = localizePath;

  readonly session = signal<SessionInfoDTO | null>(null);
  readonly teamLeaderboard = signal<TeamLeaderboardEntryDTO[]>([]);
  readonly pinnedQaQuestion = signal<QaQuestionDTO | null>(null);
  readonly presenterQaQuestions = signal<QaQuestionDTO[]>([]);
  readonly quickFeedbackResult = signal<QuickFeedbackResult | null>(null);
  readonly freetextResponses = signal<string[]>([]);
  readonly freetextQuestionId = signal<string | null>(null);
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly showHomeCta = signal(false);
  readonly presenterInfo = signal($localize`Warte auf Live-Freitextdaten …`);
  readonly presenterFreetextActive = signal(false);
  readonly freetextWordCloudEyebrow = $localize`:@@sessionWordCloud.freetextEyebrow:Live-Freitext`;
  readonly freetextWordCloudDescription = $localize`:@@sessionWordCloud.freetextDescription:Häufige Wörter aus den Antworten.`;
  readonly freetextWordCloudStageTitle = computed(
    () => this.currentQuestionLabel() ?? $localize`:@@wordCloud.title:Wortwolke`,
  );
  readonly qaWordCloudEyebrow = $localize`:@@sessionWordCloud.qaEyebrow:Q&A-Analyse`;
  readonly qaWordCloudDescription = $localize`:@@sessionWordCloud.qaDescription:Zeigt, welche Wörter und Phrasen in den sichtbaren Q&A-Fragen dominieren.`;
  readonly qaWordCloudTitle = $localize`:@@sessionQa.wordCloudTitle:Q&A-Wortwolke`;
  readonly qaWordCloudWeightingHint = $localize`:@@sessionWordCloud.qaHint:Große Wörter und Phrasen kommen aus häufiger genannten oder stärker unterstützten Fragen.`;
  readonly isPlayfulPreset = computed(() => this.themePreset.preset() === 'spielerisch');
  readonly showPinnedQaQuestion = computed(
    () => this.pinnedQaQuestion() !== null && !this.showTeamFinish(),
  );
  readonly showQaQueue = computed(
    () => this.presenterQaQuestions().length > 0 && !this.showTeamFinish(),
  );
  readonly wordCloudTermLocale = computed<SupportedLocale>(() =>
    getEffectiveLocale(localeIdToSupported(this.localeId)),
  );
  readonly freetextWordCloudTerms = computed<WordCloudTerm[]>(() =>
    this.wordCloudTermExtractor.extractTerms(
      this.freetextResponses().map((response, index) => ({
        id: `response-${index}`,
        body: response,
      })),
      {
        locale: this.wordCloudTermLocale(),
        maxEntries: 80,
        maxNgramLength: 3,
      },
    ),
  );
  readonly presenterQaWordCloudQuestions = computed(() => {
    const questions: QaQuestionDTO[] = [];
    const pinned = this.pinnedQaQuestion();
    if (pinned) {
      questions.push(pinned);
    }
    return [...questions, ...this.presenterQaQuestions()];
  });
  readonly presenterQaWordCloudResponses = computed(() =>
    this.presenterQaWordCloudQuestions().map((question) => question.text),
  );
  readonly presenterQaWordCloudTermDocuments = computed<WordCloudTermDocument[]>(() =>
    this.presenterQaWordCloudQuestions().map((question) => ({
      id: question.id,
      title: question.text,
      weight: getWordCloudWeightFromUpvotes(question.upvoteCount),
    })),
  );
  readonly presenterQaWordCloudTerms = computed<WordCloudTerm[]>(() =>
    this.wordCloudTermExtractor.extractTerms(this.presenterQaWordCloudTermDocuments(), {
      locale: this.wordCloudTermLocale(),
      maxEntries: 80,
      maxNgramLength: 3,
    }),
  );
  readonly presenterQaWordCloudWeightedResponses = computed(() =>
    this.presenterQaWordCloudQuestions().map((question) => ({
      text: question.text,
      weight: getWordCloudWeightFromUpvotes(question.upvoteCount),
    })),
  );
  readonly showQuickFeedbackCard = computed(
    () => this.quickFeedbackResult() !== null && !this.showTeamFinish(),
  );
  readonly showPresenterFreetextStage = computed(
    () => this.presenterFreetextActive() && !this.showTeamFinish(),
  );
  readonly showTeamFinish = computed(() => {
    const session = this.session();
    return (
      session?.teamMode === true &&
      session.status === 'FINISHED' &&
      this.teamLeaderboard().length > 0
    );
  });
  readonly winningTeam = computed(() => this.teamLeaderboard()[0] ?? null);
  readonly teamLeaderboardMaxScore = computed(() =>
    Math.max(1, ...this.teamLeaderboard().map((entry) => entry.totalScore)),
  );
  readonly teamLeaderboardTopScore = computed(() => {
    const board = this.teamLeaderboard();
    if (board.length === 0) return 0;
    return Math.max(...board.map((e) => e.totalScore));
  });
  readonly teamScoreboardHasPoints = computed(() => this.teamLeaderboardTopScore() > 0);
  readonly quickFeedbackEntries = computed(() => {
    const data = this.quickFeedbackResult();
    if (!data) {
      return [];
    }

    const order = feedbackResultOrder(data.type);
    return order.map((key) => ({ key, value: data.distribution[key] ?? 0 }));
  });

  async ngOnInit(): Promise<void> {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (this.code.length !== 6) {
      this.showHomeCta.set(true);
      this.presenterInfo.set($localize`Ungültiger Session-Code.`);
      return;
    }

    await this.refreshSessionMeta();
    await this.refreshPresenterLiveData();
    this.startPolling();
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.stopPolling();
  }

  private startPolling(): void {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    if (!this.metaPollTimer) {
      this.metaPollTimer = setInterval(
        () => void this.refreshSessionMeta(),
        SessionPresentComponent.META_POLL_MS,
      );
    }
    if (!this.livePollTimer) {
      this.livePollTimer = setInterval(
        () => void this.refreshPresenterLiveData(),
        SessionPresentComponent.LIVE_POLL_MS,
      );
    }
  }

  private stopPolling(): void {
    if (this.metaPollTimer) {
      clearInterval(this.metaPollTimer);
      this.metaPollTimer = null;
    }
    if (this.livePollTimer) {
      clearInterval(this.livePollTimer);
      this.livePollTimer = null;
    }
  }

  private async refreshPresenterLiveData(): Promise<void> {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    await this.refreshLiveFreetext();
    await this.refreshQaQuestions();
    await this.refreshQuickFeedbackResult();
  }

  teamScoreBarWidth(totalScore: number): string {
    const max = this.teamLeaderboardMaxScore();
    const percentage = max <= 0 ? 0 : Math.max(10, Math.round((totalScore / max) * 100));
    return `${percentage}%`;
  }

  teamMemberLabel(count: number): string {
    return count === 1 ? $localize`${count} Mitglied` : $localize`${count} Mitglieder`;
  }

  teamLeaderboardRankDisplay(rank: number): string {
    return this.teamScoreboardHasPoints() ? `#${rank}` : '\u2014';
  }

  winningTeamLabel(entry: TeamLeaderboardEntryDTO | null): string | null {
    if (!entry) {
      return null;
    }
    return $localize`${entry.teamName} gewinnt mit ${formatLocaleCount(entry.totalScore, this.localeId)}:totalScore: Punkten!`;
  }

  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(value, {
        imagePolicy: 'external-https-only',
        headingStartLevel: 3,
      }).html,
    );
  }

  quickFeedbackHeading(type: string): string {
    return feedbackTitle(type);
  }

  quickFeedbackDisplayLabel(key: string, type: string): string {
    return feedbackDisplayLabel(key, type);
  }

  quickFeedbackDisplayIcon(key: string, type: string) {
    return feedbackDisplayIcon(key, type);
  }

  quickFeedbackStatusLabel(): string | null {
    const result = this.quickFeedbackResult();
    if (!result) {
      return null;
    }

    if (result.discussion) {
      return $localize`:@@sessionPresent.quickFeedbackStatusDiscussion:Vergleichsrunde läuft`;
    }

    if ((result.currentRound ?? 1) === 2) {
      return $localize`:@@sessionPresent.quickFeedbackStatusRound2:Runde 2 läuft`;
    }

    if (result.locked) {
      return $localize`:@@sessionPresent.quickFeedbackStatusPaused:Pausiert`;
    }

    return $localize`:@@sessionPresent.quickFeedbackStatusActive:Runde 1 läuft`;
  }

  quickFeedbackBarWidth(value: number): string {
    const entries = this.quickFeedbackEntries();
    const max = Math.max(1, ...entries.map((entry) => entry.value));
    return `${Math.max(8, Math.round((value / max) * 100))}%`;
  }

  quickFeedbackPercentage(value: number): string {
    const total = this.quickFeedbackResult()?.totalVotes ?? 0;
    if (total <= 0) {
      return formatLocalePercent(0, this.localeId, 0);
    }
    return formatLocalePercent(Math.round((value / total) * 100), this.localeId, 0);
  }

  formatCount(value: number | null | undefined): string {
    return formatLocaleCount(value ?? 0, this.localeId);
  }

  private async refreshSessionMeta(): Promise<void> {
    try {
      const requestedAt = Date.now();
      const session = await trpc.session.getInfo.query({ code: this.code.toUpperCase() });
      recordServerTimeSample(session.serverTime, requestedAt);
      this.showHomeCta.set(false);
      this.session.set(session);
      if (session.status === 'FINISHED') {
        void this.router.navigateByUrl(localizePath('/'), { replaceUrl: true });
        return;
      }
      this.teamLeaderboard.set([]);
    } catch (error: unknown) {
      this.session.set(null);
      this.showHomeCta.set(true);
      this.presenterInfo.set(localizeKnownServerError(error, sessionNotFoundUiMessage()));
      this.teamLeaderboard.set([]);
      this.pinnedQaQuestion.set(null);
      this.presenterQaQuestions.set([]);
    }
  }

  private async refreshLiveFreetext(): Promise<void> {
    if (!this.session()) {
      return;
    }

    try {
      const data = await trpc.session.getLiveFreetext.query({ code: this.code.toUpperCase() });
      this.freetextResponses.set(data.responses);
      this.freetextQuestionId.set(data.questionId);

      if (data.questionType === 'FREETEXT') {
        this.presenterFreetextActive.set(true);
        this.currentQuestionLabel.set(
          data.questionOrder !== null
            ? $localize`Frage ${data.questionOrder + 1}:questionNumber:: ${data.questionText ?? ''}:questionText:`
            : null,
        );
        this.presenterInfo.set($localize`Live-Freitext wird aktualisiert.`);
      } else if (data.questionType) {
        this.presenterFreetextActive.set(false);
        this.currentQuestionLabel.set(
          data.questionOrder !== null
            ? $localize`Frage ${data.questionOrder + 1}:questionNumber:: ${data.questionText ?? ''}:questionText:`
            : null,
        );
        this.presenterInfo.set($localize`Aktuelle Frage ist keine Freitext-Frage.`);
      } else {
        this.presenterFreetextActive.set(false);
        this.currentQuestionLabel.set(null);
        this.presenterInfo.set($localize`Noch keine aktive Frage.`);
      }
    } catch {
      this.freetextQuestionId.set(null);
      this.presenterFreetextActive.set(false);
      this.presenterInfo.set($localize`Live-Freitextdaten konnten nicht geladen werden.`);
    }
  }

  private async refreshQaQuestions(): Promise<void> {
    const sessionId = this.session()?.id;
    const qaEnabled = this.session()?.channels?.qa.enabled ?? this.session()?.type === 'Q_AND_A';
    if (!sessionId || !qaEnabled || this.showTeamFinish()) {
      this.pinnedQaQuestion.set(null);
      this.presenterQaQuestions.set([]);
      return;
    }

    try {
      const questions = await trpc.qa.list.query({ sessionId });
      const visibleQuestions = questions.filter(
        (question) => question.status === 'PINNED' || question.status === 'ACTIVE',
      );
      const pinned = visibleQuestions.find((question) => question.status === 'PINNED') ?? null;
      const queue = visibleQuestions.filter((question) => question.status === 'ACTIVE');
      this.pinnedQaQuestion.set(pinned);
      this.presenterQaQuestions.set(queue);
    } catch {
      this.pinnedQaQuestion.set(null);
      this.presenterQaQuestions.set([]);
    }
  }

  private async refreshQuickFeedbackResult(): Promise<void> {
    const quickFeedbackEnabled = this.session()?.channels?.quickFeedback.enabled ?? false;
    if (!quickFeedbackEnabled || this.showTeamFinish()) {
      this.quickFeedbackResult.set(null);
      return;
    }

    try {
      const result = await trpc.quickFeedback.results.query({
        sessionCode: this.code.toUpperCase(),
      });
      this.quickFeedbackResult.set(result);
    } catch {
      this.quickFeedbackResult.set(null);
    }
  }
}
