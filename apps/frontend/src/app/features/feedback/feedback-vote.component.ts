import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { trpc } from '../../core/trpc.client';

interface VoteOption {
  value: string;
  label: string;
  icon?: string;
}

const MOOD_OPTIONS: VoteOption[] = [
  { value: 'POSITIVE', label: 'Gut', icon: '😊' },
  { value: 'NEUTRAL', label: 'Okay', icon: '😐' },
  { value: 'NEGATIVE', label: 'Schlecht', icon: '😟' },
];

const YESNO_OPTIONS: VoteOption[] = [
  { value: 'YES', label: 'Ja', icon: '👍' },
  { value: 'NO', label: 'Nein', icon: '👎' },
  { value: 'MAYBE', label: 'Vielleicht', icon: '🤷' },
];

const ABCD_OPTIONS: VoteOption[] = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
];

@Component({
  selector: 'app-feedback-vote',
  standalone: true,
  imports: [MatButton, MatCard, MatCardContent, MatIcon],
  templateUrl: './feedback-vote.component.html',
  styleUrl: './feedback-vote.component.scss',
})
export class FeedbackVoteComponent {
  private readonly route = inject(ActivatedRoute);

  readonly code = this.route.snapshot.paramMap.get('code') ?? '';
  readonly voted = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedbackType = signal<'MOOD' | 'ABCD' | 'YESNO' | null>(null);
  readonly loading = signal(true);

  readonly moodOptions = MOOD_OPTIONS;
  readonly yesnoOptions = YESNO_OPTIONS;
  readonly abcdOptions = ABCD_OPTIONS;

  constructor() {
    this.detectType();
  }

  private async detectType(): Promise<void> {
    try {
      const result = await trpc.quickFeedback.results.query({ sessionCode: this.code });
      this.feedbackType.set(result.type as 'MOOD' | 'ABCD');
      this.loading.set(false);
    } catch {
      this.error.set('Feedback-Runde nicht gefunden oder abgelaufen.');
      this.loading.set(false);
    }
  }

  async vote(value: string): Promise<void> {
    try {
      await trpc.quickFeedback.vote.mutate({ sessionCode: this.code, value });
      this.voted.set(true);
    } catch {
      this.error.set('Abstimmung fehlgeschlagen.');
    }
  }
}
