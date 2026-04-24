import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatFabButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import type { Unsubscribable } from '@trpc/server/observable';
import { trpc } from '../../core/trpc.client';
import { localizePath } from '../../core/locale-router';
import { sessionCodeAriaLabel as i18nSessionCodeAria } from '../../core/session-code-aria';
import { ThemePresetService } from '../../core/theme-preset.service';
import { feedbackOptions, feedbackTitle } from './feedback.config';
import type { QuickFeedbackResult, QuickFeedbackType } from '@arsnova/shared-types';

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
  imports: [MatButton, MatFabButton, MatCard, MatCardContent, MatIcon, RouterLink],
  templateUrl: './feedback-vote.component.html',
  styleUrl: './feedback-vote.component.scss',
  host: {
    class: 'feedback-vote-shell',
    '[class.feedback-vote-shell--embedded]': 'embeddedInSession()',
  },
})
export class FeedbackVoteComponent implements OnInit, OnDestroy {
  readonly localizedPath = localizePath;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly themePreset = inject(ThemePresetService);
  private styleTimer: ReturnType<typeof setInterval> | null = null;
  private subscription: Unsubscribable | null = null;
  private readonly standaloneVoterId = getOrCreateVoterId();
  readonly sessionCode = input('');
  readonly participantId = input('');
  readonly embeddedInSession = input(false);
  readonly showSessionCode = input(true);

  readonly code = computed(() =>
    (this.sessionCode() || (this.route.snapshot.paramMap.get('code') ?? '')).toUpperCase(),
  );
  readonly effectiveVoterId = computed(() => this.participantId() || this.standaloneVoterId);
  readonly voted = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedbackType = signal<QuickFeedbackType | null>(null);
  readonly loading = signal(true);
  readonly locked = signal(false);
  readonly discussion = signal(false);
  readonly currentRound = signal(1);

  readonly headingText = computed(() => {
    const type = this.feedbackType();
    return type ? feedbackTitle(type) : '';
  });

  readonly currentOptions = computed(() => {
    const type = this.feedbackType();
    return type ? feedbackOptions(type) : [];
  });
  readonly usesLetterButtons = computed(() => {
    const type = this.feedbackType();
    return type === 'ABC' || type === 'ABCD';
  });

  sessionCodeDisplayAria(code: string): string {
    return i18nSessionCodeAria(code);
  }

  ngOnInit(): void {
    void this.init();
  }

  ngOnDestroy(): void {
    if (this.styleTimer) {
      clearInterval(this.styleTimer);
      this.styleTimer = null;
    }
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private async init(): Promise<void> {
    const code = this.code();
    if (!code) {
      this.loading.set(false);
      return;
    }

    if (!this.embeddedInSession()) {
      try {
        const session = await trpc.session.getInfo.query({ code });
        if (session.type === 'QUIZ') {
          await this.router.navigateByUrl(this.localizedPath(`/session/${code}/vote`), {
            replaceUrl: true,
          });
          return;
        }
      } catch {
        // Fallback: standalone Blitzlicht-Route normal weiter behandeln.
      }
    }

    this.voted.set(hasAlreadyVoted(code));
    await this.pollStyle();
    this.subscribeToResults();
    this.loading.set(false);
    this.styleTimer = setInterval(() => void this.pollStyle(), 3000);
  }

  private clearEmbeddedState(): void {
    this.feedbackType.set(null);
    this.locked.set(false);
    this.discussion.set(false);
    this.currentRound.set(1);
  }

  private async pollStyle(): Promise<void> {
    const code = this.code();
    if (!code) {
      return;
    }

    try {
      const result = await trpc.quickFeedback.results.query({ sessionCode: code });
      this.applyResult(result);
    } catch (error) {
      if (this.embeddedInSession()) {
        this.clearEmbeddedState();
        this.error.set(null);
      } else {
        this.error.set(this.localizeFeedbackLoadError(error));
      }
    }
  }

  private subscribeToResults(): void {
    const code = this.code();
    if (!code || this.subscription) {
      return;
    }

    this.subscription = trpc.quickFeedback.onResults.subscribe(
      { sessionCode: code },
      {
        onData: (result) => {
          this.applyResult(result);
          this.loading.set(false);
        },
        onError: () => {
          this.subscription?.unsubscribe();
          this.subscription = null;
          if (!this.embeddedInSession()) {
            this.error.set(
              $localize`:@@sessionTabs.quickFeedbackClosedNotice:Der Blitzlicht-Kanal wurde von der Lehrperson geschlossen. Neue Abstimmungen sind gerade nicht möglich.`,
            );
          }
        },
      },
    );
  }

  private localizeFeedbackLoadError(error: unknown): string {
    const message = (error as { message?: string } | null)?.message ?? '';
    if (message.includes('geschlossen')) {
      return $localize`:@@sessionTabs.quickFeedbackClosedNotice:Der Blitzlicht-Kanal wurde von der Lehrperson geschlossen. Neue Abstimmungen sind gerade nicht möglich.`;
    }
    return $localize`:@@feedback.voteMissing:Feedback-Runde nicht gefunden oder abgelaufen.`;
  }

  private applyResult(result: QuickFeedbackResult): void {
    const code = this.code();
    this.feedbackType.set(result.type);
    this.locked.set(result.locked);
    this.discussion.set(!!result.discussion);
    this.error.set(null);
    this.applyStyle(result.theme, result.preset);

    const newRound = result.currentRound ?? 1;
    if (newRound === 2 && this.currentRound() === 1) {
      this.voted.set(false);
      try {
        localStorage.removeItem(votedStorageKey(code));
      } catch {
        /* private browsing */
      }
    }
    this.currentRound.set(newRound);

    if (result.totalVotes === 0 && this.voted()) {
      this.voted.set(false);
      try {
        localStorage.removeItem(votedStorageKey(code));
      } catch {
        /* private browsing */
      }
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
    const code = this.code();
    if (!code) {
      return;
    }

    try {
      await trpc.quickFeedback.vote.mutate({
        sessionCode: code,
        voterId: this.effectiveVoterId(),
        value,
      });
      this.voted.set(true);
      try {
        localStorage.setItem(votedStorageKey(code), '1');
      } catch {
        /* private browsing */
      }
    } catch (err) {
      const message = (err as { message?: string })?.message ?? '';
      if (message.includes('bereits abgestimmt')) {
        this.voted.set(true);
        try {
          localStorage.setItem(votedStorageKey(code), '1');
        } catch {
          /* private browsing */
        }
      } else {
        this.error.set('Abstimmung fehlgeschlagen.');
      }
    }
  }
}
