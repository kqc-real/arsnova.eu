import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  ViewEncapsulation,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';

import type { FoyerChipLabel, FoyerChipLabelKind } from './foyer-chip-label.util';

export type FoyerChipColorVariant = 0 | 1 | 2;

export type FoyerEntranceChip = FoyerChipLabel & {
  id: string;
  participantId?: string;
  hiddenParticipantIds?: string[];
  teamId: string | null;
  summary?: boolean;
  sequence: number;
  delayMs: number;
  lane: number;
  direction: 'left' | 'right';
  colorVariant: FoyerChipColorVariant;
  enterDurationMs: number;
  presenceMs: number;
  settleDelayMs: number;
  badgeDelayMs: number;
  badgePresenceMs: number;
  pulseDelayMs: number;
};

@Component({
  selector: 'app-foyer-entrance-layer',
  standalone: true,
  templateUrl: './foyer-entrance-layer.component.html',
  styleUrl: './foyer-entrance-layer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class FoyerEntranceLayerComponent implements OnDestroy {
  readonly chips = input<readonly FoyerEntranceChip[]>([]);
  readonly compact = input(false);
  readonly overlay = input(false);
  private readonly visibleOverlayBadgeIds = signal<Set<string>>(new Set());
  private readonly overlayBadgeRevealTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly overlayBadgeHideTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    effect(() => {
      const chips = this.chips();
      const eligibleIds = new Set(
        chips
          .filter(
            (chip) =>
              this.overlay() &&
              !chip.summary &&
              this.hasExpandableOverlayLabel(chip) &&
              chip.fullLabel.length > 0,
          )
          .map((chip) => chip.id),
      );

      for (const [chipId, timer] of this.overlayBadgeRevealTimers.entries()) {
        if (eligibleIds.has(chipId)) {
          continue;
        }
        clearTimeout(timer);
        this.overlayBadgeRevealTimers.delete(chipId);
      }

      for (const [chipId, timer] of this.overlayBadgeHideTimers.entries()) {
        if (eligibleIds.has(chipId)) {
          continue;
        }
        clearTimeout(timer);
        this.overlayBadgeHideTimers.delete(chipId);
      }

      this.visibleOverlayBadgeIds.update((current) => {
        const next = new Set<string>();
        current.forEach((chipId) => {
          if (eligibleIds.has(chipId)) {
            next.add(chipId);
          }
        });
        return next;
      });

      for (const chip of chips) {
        const visibleBadgeIds = untracked(() => this.visibleOverlayBadgeIds());
        if (
          !this.overlay() ||
          chip.summary ||
          !this.hasExpandableOverlayLabel(chip) ||
          chip.fullLabel.length === 0 ||
          visibleBadgeIds.has(chip.id) ||
          this.overlayBadgeRevealTimers.has(chip.id)
        ) {
          continue;
        }

        const badgeRevealDelayMs = chip.delayMs + chip.badgeDelayMs;

        const revealBadge = () => {
          this.overlayBadgeRevealTimers.delete(chip.id);
          this.visibleOverlayBadgeIds.update((current) => new Set(current).add(chip.id));
          this.scheduleOverlayBadgeHide(chip);
        };

        if (badgeRevealDelayMs <= 0) {
          revealBadge();
          continue;
        }

        const timer = setTimeout(revealBadge, badgeRevealDelayMs);
        this.overlayBadgeRevealTimers.set(chip.id, timer);
      }
    });
  }

  ngOnDestroy(): void {
    this.overlayBadgeRevealTimers.forEach((timer) => clearTimeout(timer));
    this.overlayBadgeRevealTimers.clear();
    this.overlayBadgeHideTimers.forEach((timer) => clearTimeout(timer));
    this.overlayBadgeHideTimers.clear();
    this.visibleOverlayBadgeIds.set(new Set());
  }

  private scheduleOverlayBadgeHide(chip: FoyerEntranceChip): void {
    if (chip.badgePresenceMs <= 0) {
      return;
    }

    const existing = this.overlayBadgeHideTimers.get(chip.id);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.overlayBadgeHideTimers.delete(chip.id);
      this.visibleOverlayBadgeIds.update((current) => {
        if (!current.has(chip.id)) {
          return current;
        }

        const next = new Set(current);
        next.delete(chip.id);
        return next;
      });
    }, chip.badgePresenceMs);

    this.overlayBadgeHideTimers.set(chip.id, timer);
  }

  chipKindClass(kind: FoyerChipLabelKind): string {
    switch (kind) {
      case 'anonymous':
        return 'foyer-entrance-layer__chip--anonymous';
      case 'emoji-only':
        return 'foyer-entrance-layer__chip--emoji-only';
      case 'emoji-with-text':
        return 'foyer-entrance-layer__chip--emoji-with-text';
      default:
        return 'foyer-entrance-layer__chip--text';
    }
  }

  isSummaryChip(chip: FoyerEntranceChip): boolean {
    return chip.summary === true;
  }

  showOverlayNameBadge(chip: FoyerEntranceChip): boolean {
    return this.visibleOverlayBadgeIds().has(chip.id);
  }

  private hasExpandableOverlayLabel(chip: FoyerEntranceChip): boolean {
    if (chip.kind === 'emoji-only') {
      return true;
    }

    if (chip.kind !== 'text') {
      return false;
    }

    return chip.text.trim().length > 0 && chip.text !== chip.fullLabel;
  }

  overlayNameBadgeBefore(chip: FoyerEntranceChip): boolean {
    return chip.direction === 'right';
  }

  overlayInlineStart(chip: FoyerEntranceChip): string {
    if (!this.overlay()) {
      return '50%';
    }

    if (chip.summary) {
      return '50%';
    }

    return '50%';
  }

  overlayBlockStart(chip: FoyerEntranceChip): string {
    if (!this.overlay()) {
      return `calc(1.15rem + (var(--foyer-lane, 0) * 0.52rem))`;
    }

    if (chip.summary) {
      return '76%';
    }

    return '50%';
  }

  overlayGridColumn(chip: FoyerEntranceChip): string {
    if (!this.overlay()) {
      return 'auto';
    }

    if (chip.summary) {
      return '2';
    }

    return '2';
  }

  overlayGridRow(chip: FoyerEntranceChip): string {
    if (!this.overlay()) {
      return 'auto';
    }

    if (chip.summary) {
      return '3';
    }

    return '2';
  }

  overlayTravelX(chip: FoyerEntranceChip): string {
    if (!this.overlay()) {
      return '0px';
    }

    if (chip.summary) {
      const distance = this.maxViewportOrRem(0.2, 14);
      return this.signedPx(distance, chip.direction === 'right');
    }

    const distance = this.maxViewportOrRem(0.48, 32);
    return this.signedPx(distance, chip.direction === 'right');
  }

  overlayTravelY(chip: FoyerEntranceChip): string {
    if (!this.overlay()) {
      return '0px';
    }

    if (chip.summary) {
      return this.px(this.maxViewportHeightOrRem(0.1, 5));
    }

    const offset = this.maxViewportHeightOrRem(0.2, 10);
    const offsets = [-offset, 0, offset] as const;
    return this.px(offsets[chip.lane % offsets.length] ?? 0);
  }

  overlayTiltStart(chip: FoyerEntranceChip): string {
    if (!this.overlay()) {
      return '0deg';
    }

    if (chip.summary) {
      return chip.direction === 'right' ? '6deg' : '-6deg';
    }

    const tilt = chip.direction === 'right' ? 10 : -10;
    return `${tilt}deg`;
  }

  private maxViewportOrRem(viewportFraction: number, rem: number): number {
    const viewportWidth =
      typeof window !== 'undefined' && Number.isFinite(window.innerWidth) ? window.innerWidth : 0;
    return Math.max(viewportWidth * viewportFraction, this.remToPx(rem));
  }

  private maxViewportHeightOrRem(viewportFraction: number, rem: number): number {
    const viewportHeight =
      typeof window !== 'undefined' && Number.isFinite(window.innerHeight) ? window.innerHeight : 0;
    return Math.max(viewportHeight * viewportFraction, this.remToPx(rem));
  }

  private remToPx(rem: number): number {
    const rootFontSize =
      typeof window !== 'undefined' && typeof getComputedStyle === 'function'
        ? Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
        : Number.NaN;

    return rem * (Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16);
  }

  private signedPx(value: number, positive: boolean): string {
    return this.px(positive ? value : -value);
  }

  private px(value: number): string {
    if (!Number.isFinite(value)) {
      return '0px';
    }

    return `${Math.round(value)}px`;
  }
}
