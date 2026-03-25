import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { WordCloudComponent } from './word-cloud.component';
import { trpc } from '../../../core/trpc.client';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import {
  feedbackDisplayIcon,
  feedbackDisplayLabel,
  feedbackTitle,
  MOOD_OPTIONS,
  YESNO_OPTIONS,
  ABCD_OPTIONS,
} from '../../feedback/feedback.config';
import type {
  QaQuestionDTO,
  QuickFeedbackResult,
  SessionInfoDTO,
  TeamLeaderboardEntryDTO,
} from '@arsnova/shared-types';
import { recordServerTimeIso } from '../session-server-clock';

/**
 * Beamer-Ansicht / Presenter-Mode (Epic 2).
 * Story 2.5, 2.6, 3.5, 4.1, 4.4, 4.5, 1.14, 7.1, 8.2, 8.3.
 */
@Component({
  selector: 'app-session-present',
  standalone: true,
  imports: [DecimalPipe, MatCard, MatCardContent, MatIcon, WordCloudComponent],
  templateUrl: './session-present.component.html',
  styleUrl: './session-present.component.scss',
})
export class SessionPresentComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';

  readonly session = signal<SessionInfoDTO | null>(null);
  readonly teamLeaderboard = signal<TeamLeaderboardEntryDTO[]>([]);
  readonly pinnedQaQuestion = signal<QaQuestionDTO | null>(null);
  readonly presenterQaQuestions = signal<QaQuestionDTO[]>([]);
  readonly quickFeedbackResult = signal<QuickFeedbackResult | null>(null);
  readonly freetextResponses = signal<string[]>([]);
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly presenterInfo = signal($localize`Warte auf Live-Freitextdaten …`);
  readonly isPlayfulPreset = computed(() => this.session()?.preset === 'PLAYFUL');
  readonly showPinnedQaQuestion = computed(
    () => this.pinnedQaQuestion() !== null && !this.showTeamFinish(),
  );
  readonly showQaQueue = computed(
    () => this.presenterQaQuestions().length > 0 && !this.showTeamFinish(),
  );
  readonly showQuickFeedbackCard = computed(
    () => this.quickFeedbackResult() !== null && !this.showTeamFinish(),
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
  readonly quickFeedbackEntries = computed(() => {
    const data = this.quickFeedbackResult();
    if (!data) {
      return [];
    }

    const orderMap: Record<string, string[]> = {
      MOOD: MOOD_OPTIONS.map((o) => o.value),
      YESNO: YESNO_OPTIONS.map((o) => o.value),
      ABCD: ABCD_OPTIONS.map((o) => o.value),
    };
    const order = orderMap[data.type] ?? Object.keys(data.distribution);
    return order.map((key) => ({ key, value: data.distribution[key] ?? 0 }));
  });

  async ngOnInit(): Promise<void> {
    if (this.code.length !== 6) {
      this.presenterInfo.set($localize`Ungültiger Session-Code.`);
      return;
    }

    await this.refreshSessionMeta();
    await this.refreshLiveFreetext();
    await this.refreshQaQuestions();
    await this.refreshQuickFeedbackResult();
    this.pollTimer = setInterval(() => {
      void this.refreshSessionMeta();
      void this.refreshLiveFreetext();
      void this.refreshQaQuestions();
      void this.refreshQuickFeedbackResult();
    }, 2000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  teamScoreBarWidth(totalScore: number): string {
    const max = this.teamLeaderboardMaxScore();
    const percentage = max <= 0 ? 0 : Math.max(10, Math.round((totalScore / max) * 100));
    return `${percentage}%`;
  }

  teamMemberLabel(count: number): string {
    return count === 1 ? $localize`${count} Mitglied` : $localize`${count} Mitglieder`;
  }

  winningTeamLabel(entry: TeamLeaderboardEntryDTO | null): string | null {
    if (!entry) {
      return null;
    }
    return $localize`${entry.teamName} gewinnt mit ${entry.totalScore}:totalScore: Punkten!`;
  }

  renderMarkdown(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(renderMarkdownWithKatex(value).html);
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
      return '0';
    }
    return String(Math.round((value / total) * 100));
  }

  private async refreshSessionMeta(): Promise<void> {
    try {
      const session = await trpc.session.getInfo.query({ code: this.code.toUpperCase() });
      recordServerTimeIso(session.serverTime);
      this.session.set(session);
      if (session.teamMode && session.status === 'FINISHED') {
        const teamEntries = await trpc.session.getTeamLeaderboard.query({
          code: this.code.toUpperCase(),
        });
        this.teamLeaderboard.set(teamEntries);
      } else {
        this.teamLeaderboard.set([]);
      }
    } catch {
      this.session.set(null);
      this.teamLeaderboard.set([]);
      this.pinnedQaQuestion.set(null);
      this.presenterQaQuestions.set([]);
    }
  }

  private async refreshLiveFreetext(): Promise<void> {
    try {
      const data = await trpc.session.getLiveFreetext.query({ code: this.code.toUpperCase() });
      this.freetextResponses.set(data.responses);

      if (data.questionType === 'FREETEXT') {
        this.currentQuestionLabel.set(
          data.questionOrder !== null
            ? $localize`Frage ${data.questionOrder + 1}:questionNumber:: ${data.questionText ?? ''}:questionText:`
            : null,
        );
        this.presenterInfo.set($localize`Live-Freitext wird aktualisiert.`);
      } else if (data.questionType) {
        this.currentQuestionLabel.set(
          data.questionOrder !== null
            ? $localize`Frage ${data.questionOrder + 1}:questionNumber:: ${data.questionText ?? ''}:questionText:`
            : null,
        );
        this.presenterInfo.set($localize`Aktuelle Frage ist keine Freitext-Frage.`);
      } else {
        this.currentQuestionLabel.set(null);
        this.presenterInfo.set($localize`Noch keine aktive Frage.`);
      }
    } catch {
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
