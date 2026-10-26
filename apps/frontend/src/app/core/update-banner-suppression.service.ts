import {
  DestroyRef,
  type EffectRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';

/** Gründe, aus denen ein Reload beim PWA-Update Eingaben verwerfen würde. */
export type UpdateBannerSuppressionReason =
  | 'quiz-edit'
  | 'quiz-new'
  | 'quiz-preview'
  | 'participant-draft'
  | 'feedback-submit'
  | 'product-feedback-draft'
  | 'learning-objective-draft'
  | 'session-learning-objective-draft'
  | 'markdown-link-draft'
  | 'markdown-image-draft'
  | 'admin-motd-draft'
  | 'admin-motd-template-draft'
  | 'host-qa-title'
  | 'join-draft';

/**
 * Auswahl, Freitext, Zahl, Bewertung und Konfidenz sowie eine angefangene
 * Q&A-Frage liegen bis zum Absenden nur im Seiten-Speicher. Reihenfolge,
 * Zuordnung und Kategorisierung stehen bereits in localStorage.
 */
export function participantDraftBlocksUpdateBanner(state: {
  voteSent: boolean;
  selectedAnswerCount: number;
  freeText: string;
  numericInput: string;
  ratingValue: number | null;
  confidenceValue: number | null;
  qaDraft: string;
}): boolean {
  if (state.qaDraft.trim().length > 0) return true;
  if (state.voteSent) return false;
  return (
    state.selectedAnswerCount > 0 ||
    state.freeText.length > 0 ||
    state.numericInput.length > 0 ||
    state.ratingValue !== null ||
    state.confidenceValue !== null
  );
}

/** Laufender Titel-Speichervorgang oder vom Server abweichender Entwurf. */
export function qaTitleDraftBlocksUpdateBanner(state: {
  editing: boolean;
  saving: boolean;
  draft: string;
  serverTitle: string;
}): boolean {
  if (state.saving) return true;
  if (!state.editing) return false;
  return state.draft.trim() !== state.serverTitle.trim();
}

/**
 * Hält einen Unterdrückungsgrund an `blocked`. Beim Zerstören der aufrufenden
 * Komponente wird der Grund entfernt, auch wenn das letzte Signal noch wahr war.
 */
export function bindUpdateBannerSuppression(
  service: UpdateBannerSuppressionService,
  reason: UpdateBannerSuppressionReason,
  blocked: () => boolean,
): EffectRef {
  const ref = effect(() => {
    const active = blocked();
    untracked(() => service.set(reason, active));
  });
  inject(DestroyRef).onDestroy(() => {
    ref.destroy();
    service.set(reason, false);
  });
  return ref;
}

@Injectable({ providedIn: 'root' })
export class UpdateBannerSuppressionService {
  private readonly reasons = signal<ReadonlySet<UpdateBannerSuppressionReason>>(new Set());

  readonly active = computed(() => this.reasons().size > 0);

  set(reason: UpdateBannerSuppressionReason, suppress: boolean): void {
    this.reasons.update((current) => {
      if (current.has(reason) === suppress) return current;
      const next = new Set(current);
      if (suppress) next.add(reason);
      else next.delete(reason);
      return next;
    });
  }
}
