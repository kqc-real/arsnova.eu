import { Component, input, signal, OnDestroy, OnInit } from '@angular/core';
import { MatButton } from '@angular/material/button';
import type { TempoState } from '@arsnova/shared-types';
import { trpc } from '../../../core/trpc.client';

type TempoOption = { state: TempoState; emoji: string; label: string; ariaLabel: string };

const OPTIONS: TempoOption[] = [
  {
    state: 'speed_up',
    emoji: '🚀',
    label: $localize`:@@tempo.state.speedUp:Schneller`,
    ariaLabel: $localize`:@@tempo.vote.ariaSpeedUp:Schneller – Ich kann gut folgen, das Tempo darf höher sein`,
  },
  {
    state: 'following',
    emoji: '🙂',
    label: $localize`:@@tempo.state.following:Ich folge`,
    ariaLabel: $localize`:@@tempo.vote.ariaFollowing:Ich folge – Das Tempo passt`,
  },
  {
    state: 'slow_down',
    emoji: '🐢',
    label: $localize`:@@tempo.state.slowDown:Langsamer`,
    ariaLabel: $localize`:@@tempo.vote.ariaSlowDown:Langsamer – Es geht zu schnell`,
  },
  {
    state: 'lost',
    emoji: '😵',
    label: $localize`:@@tempo.state.lost:Verloren`,
    ariaLabel: $localize`:@@tempo.vote.ariaLost:Verloren – Ich bin abgehängt`,
  },
];

@Component({
  selector: 'app-tempo-vote',
  standalone: true,
  imports: [MatButton],
  template: `
    <div
      class="tempo-vote"
      role="group"
      aria-label="Tempo-Rückmeldung"
      i18n-aria-label="@@tempo.vote.groupAria"
    >
      <p class="tempo-vote__label" i18n="@@tempo.vote.prompt">Wie läuft das Tempo für dich?</p>
      <div class="tempo-vote__buttons">
        @for (opt of options; track opt.state) {
          <button
            mat-button
            class="tempo-vote__btn"
            [class.tempo-vote__btn--active]="activeState() === opt.state"
            [attr.aria-pressed]="activeState() === opt.state"
            [attr.aria-label]="opt.ariaLabel"
            (click)="onTap(opt.state)"
          >
            <span class="tempo-vote__emoji" aria-hidden="true">{{ opt.emoji }}</span>
            <span class="tempo-vote__btn-label">{{ opt.label }}</span>
          </button>
        }
      </div>
      <p class="tempo-vote__anon" i18n="@@tempo.vote.anonHint">Dein Feedback ist anonym.</p>
    </div>
  `,
  styleUrl: './tempo-vote.component.scss',
})
export class TempoVoteComponent implements OnInit, OnDestroy {
  readonly sessionCode = input.required<string>();
  readonly participantId = input.required<string>();

  readonly options = OPTIONS;
  readonly activeState = signal<TempoState | null>(null);
  private pending = false;

  ngOnInit(): void {
    const stored = localStorage.getItem(this.storageKey());
    if (stored && OPTIONS.some((o) => o.state === stored)) {
      this.activeState.set(stored as TempoState);
    }
  }

  ngOnDestroy(): void {}

  private storageKey(): string {
    return `tempo-state-${this.sessionCode()}`;
  }

  async onTap(state: TempoState): Promise<void> {
    if (this.pending) return;
    this.pending = true;

    try {
      if (this.activeState() === state) {
        // Zweiter Tap auf gleiche Option → entfernen
        await trpc.tempo.removeVote.mutate({
          sessionCode: this.sessionCode(),
          participantId: this.participantId(),
        });
        this.activeState.set(null);
        localStorage.removeItem(this.storageKey());
      } else {
        await trpc.tempo.vote.mutate({
          sessionCode: this.sessionCode(),
          participantId: this.participantId(),
          state,
        });
        this.activeState.set(state);
        localStorage.setItem(this.storageKey(), state);
      }
    } catch {
      // Netzwerkfehler: Zustand nicht übernehmen
    } finally {
      this.pending = false;
    }
  }
}
