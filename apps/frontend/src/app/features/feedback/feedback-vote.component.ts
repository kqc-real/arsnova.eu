import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatFabButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../core/trpc.client';
import { ThemePresetService } from '../../core/theme-preset.service';
import { MOOD_OPTIONS, YESNO_OPTIONS, ABCD_OPTIONS, feedbackTitle } from './feedback.config';

const VOTER_ID_KEY = 'qf-voter-id';

function getOrCreateVoterId(): string {
  try {
    let id = localStorage.getItem(VOTER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VOTER_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function votedStorageKey(code: string): string {
  return `qf-voted:${code}`;
}

function hasAlreadyVoted(code: string): boolean {
  try {
    return !!localStorage.getItem(votedStorageKey(code));
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-feedback-vote',
  standalone: true,
  imports: [MatFabButton, MatCard, MatCardContent, MatIcon],
  templateUrl: './feedback-vote.component.html',
  styleUrl: './feedback-vote.component.scss',
})
export class FeedbackVoteComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly themePreset = inject(ThemePresetService);
  private styleTimer: ReturnType<typeof setInterval> | null = null;
  private readonly voterId = getOrCreateVoterId();

  readonly code = (this.route.snapshot.paramMap.get('code') ?? '').toUpperCase();
  readonly voted = signal(hasAlreadyVoted(this.code));
  readonly error = signal<string | null>(null);
  readonly feedbackType = signal<'MOOD' | 'ABCD' | 'YESNO' | null>(null);
  readonly loading = signal(true);
  readonly locked = signal(false);
  readonly discussion = signal(false);
  readonly currentRound = signal(1);

  readonly headingText = computed(() => {
    const type = this.feedbackType();
    return type ? feedbackTitle(type) : '';
  });

  readonly moodOptions = MOOD_OPTIONS;
  readonly yesnoOptions = YESNO_OPTIONS;
  readonly abcdOptions = ABCD_OPTIONS;

  constructor() {
    this.init();
  }

  ngOnDestroy(): void {
    if (this.styleTimer) {
      clearInterval(this.styleTimer);
      this.styleTimer = null;
    }
  }

  private async init(): Promise<void> {
    try {
      const result = await trpc.quickFeedback.results.query({ sessionCode: this.code });
      this.feedbackType.set(result.type as 'MOOD' | 'ABCD' | 'YESNO');
      this.locked.set(result.locked);
      this.applyStyle(result.theme, result.preset);
      this.loading.set(false);
      this.styleTimer = setInterval(() => this.pollStyle(), 3000);
    } catch {
      this.error.set('Feedback-Runde nicht gefunden oder abgelaufen.');
      this.loading.set(false);
    }
  }

  private async pollStyle(): Promise<void> {
    try {
      const result = await trpc.quickFeedback.results.query({ sessionCode: this.code });
      this.locked.set(result.locked);
      this.discussion.set(!!result.discussion);
      this.applyStyle(result.theme, result.preset);

      const newRound = result.currentRound ?? 1;
      if (newRound === 2 && this.currentRound() === 1) {
        this.voted.set(false);
        try { localStorage.removeItem(votedStorageKey(this.code)); } catch { /* private browsing */ }
      }
      this.currentRound.set(newRound);

      if (result.totalVotes === 0 && this.voted()) {
        this.voted.set(false);
        try { localStorage.removeItem(votedStorageKey(this.code)); } catch { /* private browsing */ }
      }
    } catch {
      // best-effort
    }
  }

  private applyStyle(theme: string, preset: string): void {
    if (theme === 'dark' || theme === 'light' || theme === 'system') {
      this.themePreset.setTheme(theme);
    }
    if (preset === 'serious' || preset === 'spielerisch') {
      this.themePreset.setPreset(preset, { silent: true });
    }
  }

  async vote(value: string): Promise<void> {
    try {
      await trpc.quickFeedback.vote.mutate({
        sessionCode: this.code,
        voterId: this.voterId,
        value,
      });
      this.voted.set(true);
      try { localStorage.setItem(votedStorageKey(this.code), '1'); } catch { /* private browsing */ }
    } catch (err) {
      const message = (err as { message?: string })?.message ?? '';
      if (message.includes('bereits abgestimmt')) {
        this.voted.set(true);
        try { localStorage.setItem(votedStorageKey(this.code), '1'); } catch { /* private browsing */ }
      } else {
        this.error.set('Abstimmung fehlgeschlagen.');
      }
    }
  }
}
