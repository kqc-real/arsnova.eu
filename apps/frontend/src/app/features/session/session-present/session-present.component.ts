import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { WordCloudComponent } from './word-cloud.component';
import { trpc } from '../../../core/trpc.client';
import type { SessionInfoDTO, TeamLeaderboardEntryDTO } from '@arsnova/shared-types';

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
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly code = this.route.parent?.snapshot.paramMap.get('code') ?? '';

  readonly session = signal<SessionInfoDTO | null>(null);
  readonly teamLeaderboard = signal<TeamLeaderboardEntryDTO[]>([]);
  readonly freetextResponses = signal<string[]>([]);
  readonly currentQuestionLabel = signal<string | null>(null);
  readonly presenterInfo = signal($localize`Warte auf Live-Freitextdaten …`);
  readonly isPlayfulPreset = computed(() => this.session()?.preset === 'PLAYFUL');
  readonly showTeamFinish = computed(() => {
    const session = this.session();
    return session?.teamMode === true && session.status === 'FINISHED' && this.teamLeaderboard().length > 0;
  });
  readonly winningTeam = computed(() => this.teamLeaderboard()[0] ?? null);
  readonly teamLeaderboardMaxScore = computed(() =>
    Math.max(1, ...this.teamLeaderboard().map((entry) => entry.totalScore)),
  );

  async ngOnInit(): Promise<void> {
    if (this.code.length !== 6) {
      this.presenterInfo.set($localize`Ungültiger Session-Code.`);
      return;
    }

    await this.refreshSessionMeta();
    await this.refreshLiveFreetext();
    this.pollTimer = setInterval(() => {
      void this.refreshSessionMeta();
      void this.refreshLiveFreetext();
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

  private async refreshSessionMeta(): Promise<void> {
    try {
      const session = await trpc.session.getInfo.query({ code: this.code.toUpperCase() });
      this.session.set(session);
      if (session.teamMode && session.status === 'FINISHED') {
        const teamEntries = await trpc.session.getTeamLeaderboard.query({ code: this.code.toUpperCase() });
        this.teamLeaderboard.set(teamEntries);
      } else {
        this.teamLeaderboard.set([]);
      }
    } catch {
      this.session.set(null);
      this.teamLeaderboard.set([]);
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
}
