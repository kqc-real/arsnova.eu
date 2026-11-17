import { signal } from '@angular/core';
import type { FreetextWordCloudVisibility } from '@arsnova/shared-types';
import { trpc } from '../../core/trpc.client';

export class FreetextWordCloudVisibilityState {
  readonly snapshot = signal<FreetextWordCloudVisibility | null>(null);
  readonly pending = signal(false);
  private sequence = 0;
  private appliedSequence = 0;

  beginRead(): number {
    return ++this.sequence;
  }

  applyRead(sequence: number, snapshot: FreetextWordCloudVisibility | null): void {
    if (this.pending() || sequence < this.appliedSequence) return;
    this.appliedSequence = sequence;
    this.snapshot.set(snapshot);
  }

  async update(code: string, questionId: string, label: string, hidden: boolean): Promise<void> {
    if (this.pending() || this.snapshot()?.questionId !== questionId) {
      throw new Error('Freitext visibility scope changed');
    }

    this.pending.set(true);
    try {
      const snapshot = await trpc.session.setFreetextWordCloudEntryVisibility.mutate(
        { code, questionId, label, hidden },
        { signal: AbortSignal.timeout(10_000) },
      );
      this.snapshot.set(snapshot);
    } finally {
      // Discard polling responses started before the mutation settled.
      this.appliedSequence = ++this.sequence;
      this.pending.set(false);
    }
  }
}
