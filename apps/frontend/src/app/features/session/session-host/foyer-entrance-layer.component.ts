import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';

import type { FoyerChipLabel, FoyerChipLabelKind } from './foyer-chip-label.util';

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
})
export class FoyerEntranceLayerComponent implements OnDestroy {
  readonly chips = input<readonly FoyerEntranceChip[]>([]);
  readonly compact = input(false);
  readonly overlay = input(false);
  private readonly visibleOverlayBadgeIds = signal<Set<string>>(new Set());
  private readonly overlayBadgeTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

      for (const [chipId, timer] of this.overlayBadgeTimers.entries()) {
        if (eligibleIds.has(chipId)) {
          continue;
        }
        clearTimeout(timer);
        this.overlayBadgeTimers.delete(chipId);
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
          this.overlayBadgeTimers.has(chip.id)
        ) {
          continue;
        }

        const badgeRevealDelayMs = chip.delayMs + chip.badgeDelayMs;

        if (badgeRevealDelayMs <= 0) {
          this.visibleOverlayBadgeIds.update((current) => new Set(current).add(chip.id));
          continue;
        }

        const timer = setTimeout(() => {
          this.overlayBadgeTimers.delete(chip.id);
          this.visibleOverlayBadgeIds.update((current) => new Set(current).add(chip.id));
        }, badgeRevealDelayMs);
        this.overlayBadgeTimers.set(chip.id, timer);
      }
    });
  }

  ngOnDestroy(): void {
    this.overlayBadgeTimers.forEach((timer) => clearTimeout(timer));
    this.overlayBadgeTimers.clear();
    this.visibleOverlayBadgeIds.set(new Set());
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
      return chip.direction === 'right' ? 'max(20vw, 14rem)' : 'calc(-1 * max(20vw, 14rem))';
    }

    return chip.direction === 'right' ? 'max(48vw, 32rem)' : 'calc(-1 * max(48vw, 32rem))';
  }

  overlayTravelY(chip: FoyerEntranceChip): string {
    if (!this.overlay()) {
      return '0px';
    }

    if (chip.summary) {
      return 'max(10vh, 5rem)';
    }

    const offsets = ['calc(-1 * max(20vh, 10rem))', '0px', 'max(20vh, 10rem)'] as const;
    return offsets[chip.lane % offsets.length] ?? '0px';
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
}
