import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatFabButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import type { Unsubscribable } from '@trpc/server/observable';
import { trpc } from '../../core/trpc.client';
import { localizePath } from '../../core/locale-router';
import { sessionCodeAriaLabel as i18nSessionCodeAria } from '../../core/session-code-aria';
import { feedbackOptions, feedbackTitle, isTempoFeedbackType } from './feedback.config';
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

function tempoSelectionStorageKey(code: string): string {
  return `qf-tempo-selection:${code}`;
}

function readStoredTempoSelection(code: string): string | null {
  try {
    return localStorage.getItem(tempoSelectionStorageKey(code));
  } catch {
    return null;
  }
}

function writeStoredTempoSelection(code: string, value: string | null): void {
  try {
    if (value) {
      localStorage.setItem(tempoSelectionStorageKey(code), value);
    } else {
      localStorage.removeItem(tempoSelectionStorageKey(code));
    }
  } catch {
    /* private browsing */
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
  readonly starValues = [1, 2, 3, 4, 5] as const;
  readonly localizedPath = localizePath;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private subscription: Unsubscribable | null = null;
  private readonly standaloneVoterId = getOrCreateVoterId();
  readonly sessionCode = input('');
  readonly participantId = input('');
  readonly participantName = input<string | null>(null);
  readonly participantAvatar = input<string | null>(null);
  readonly participantTeamName = input<string | null>(null);
  readonly sessionTitle = input<string | null>(null);
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
  readonly hoveredStar = signal(0);
  readonly submitting = signal(false);
  readonly selectedTempoValue = signal<string | null>(null);

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
    return type === 'ABCD';
  });
  readonly usesStarRating = computed(() => this.feedbackType() === 'STARS');
  readonly isTempoFeedback = computed(() => isTempoFeedbackType(this.feedbackType()));
  readonly sessionTitleLabel = computed(() => this.sessionTitle()?.trim() || null);
  readonly participantIdentityLabel = computed(() => this.participantName()?.trim() || null);
  readonly participantIdentityCaption = computed(() =>
    this.participantIdentityLabel()
      ? $localize`:@@feedback.voteContextParticipant:Du bist als`
      : null,
  );
  readonly participantAvatarLabel = computed(() => this.participantAvatar()?.trim() || null);
  readonly participantTeamLabel = computed(() => this.participantTeamName()?.trim() || null);
  readonly showSessionContext = computed(
    () => !!this.code() && (this.showSessionCode() || this.embeddedInSession()),
  );
  readonly sessionContextAriaLabel = computed(() => {
    const parts = [
      $localize`:@@sessionTabs.quickFeedback:Blitzlicht`,
      this.sessionCodeDisplayAria(this.code()),
      this.participantName()?.trim()
        ? $localize`:@@feedback.voteParticipantContextAria:Du bist als ${this.participantIdentityLabel()}:name: dabei`
        : $localize`:@@feedback.voteParticipantRoleContextAria:Teilnehmeransicht`,
    ];
    const title = this.sessionTitleLabel();
    const team = this.participantTeamLabel();
    if (title) {
      parts.push(title);
    }
    if (team) {
      parts.push($localize`:@@feedback.voteParticipantTeamContextAria:Team ${team}:team:`);
    }
    return parts.join(', ');
  });

  sessionCodeDisplayAria(code: string): string {
    return i18nSessionCodeAria(code);
  }

  starRatingAriaLabel(value: number): string {
    return $localize`:@@feedback.starRatingAria:${value}:value: von 5 Sternen`;
  }

  tempoOptionAriaLabel(label: string, value: string): string {
    if (this.selectedTempoValue() === value) {
      return $localize`:@@feedback.tempoOptionSelectedAria:${label}:label: ausgewählt, erneut tippen zum Entfernen`;
    }
    return label;
  }

  @HostListener('document:click', ['$event'])
  clearTempoSelectionFromBackdrop(event: MouseEvent): void {
    const selectedValue = this.selectedTempoValue();
    if (!this.isTempoFeedback() || !selectedValue || this.submitting()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const interactiveTarget = target.closest('a, button, input, select, textarea, [role="button"]');
    if (interactiveTarget) {
      return;
    }

    void this.vote(selectedValue);
  }

  ngOnInit(): void {
    void this.init();
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
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

    this.voted.set(hasAlreadyVoted(code));
    if (!this.embeddedInSession() && (await this.redirectStandaloneQuizSession(code))) {
      return;
    }

    await this.pollStyle();
    this.subscribeToResults();
    this.loading.set(false);
    this.pollTimer = setInterval(() => void this.pollStyle(), 3000);
  }

  private async redirectStandaloneQuizSession(code: string): Promise<boolean> {
    try {
      const session = await trpc.session.getInfo.query({ code });
      if (session.type === 'QUIZ' && session.status !== 'FINISHED') {
        await this.router.navigateByUrl(
          this.localizedPath(`/session/${code}/vote?tab=quickFeedback`),
          {
            replaceUrl: true,
          },
        );
        return true;
      }
    } catch {
      // Standalone-Blitzlicht oder abgelaufener Code: normale Feedback-Route weiter behandeln.
    }
    return false;
  }

  private clearEmbeddedState(): void {
    this.feedbackType.set(null);
    this.locked.set(false);
    this.discussion.set(false);
    this.currentRound.set(1);
    this.hoveredStar.set(0);
    this.selectedTempoValue.set(null);
  }

  private async pollStyle(): Promise<boolean> {
    const code = this.code();
    if (!code) {
      return false;
    }

    try {
      const result = await trpc.quickFeedback.results.query({ sessionCode: code });
      this.applyResult(result);
      return true;
    } catch (error) {
      if (this.embeddedInSession()) {
        this.clearEmbeddedState();
        this.error.set(null);
      } else {
        this.error.set(this.localizeFeedbackLoadError(error));
      }
      return false;
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
    const previousType = this.feedbackType();
    this.feedbackType.set(result.type);
    this.locked.set(result.locked);
    this.discussion.set(!!result.discussion);
    this.hoveredStar.set(0);
    this.error.set(null);

    if (result.type === 'TEMPO') {
      this.voted.set(false);
      this.selectedTempoValue.set(result.totalVotes > 0 ? readStoredTempoSelection(code) : null);
      if (result.totalVotes === 0) {
        writeStoredTempoSelection(code, null);
      }
    } else if (previousType === 'TEMPO') {
      this.selectedTempoValue.set(null);
      writeStoredTempoSelection(code, null);
    }

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

    if (result.type !== 'TEMPO' && result.totalVotes === 0 && this.voted()) {
      this.voted.set(false);
      try {
        localStorage.removeItem(votedStorageKey(code));
      } catch {
        /* private browsing */
      }
    }
  }

  async vote(value: string): Promise<void> {
    const code = this.code();
    if (!code || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    try {
      await trpc.quickFeedback.vote.mutate({
        sessionCode: code,
        voterId: this.effectiveVoterId(),
        value,
      });
      if (this.isTempoFeedback()) {
        const nextValue = this.selectedTempoValue() === value ? null : value;
        this.selectedTempoValue.set(nextValue);
        writeStoredTempoSelection(code, nextValue);
        return;
      }
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
    } finally {
      this.submitting.set(false);
    }
  }
}
