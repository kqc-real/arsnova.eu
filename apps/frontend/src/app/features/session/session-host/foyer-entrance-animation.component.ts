import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SessionParticipantsPayload } from '@arsnova/shared-types';
import { findKindergartenNicknameEmoji } from '../../join/kindergarten-nickname-icons';

/**
 * Story 5.4a: Foyer-Einflug im Preset Spielerisch
 *
 * Verspielte Animation für Teilnehmenden-Chips während der Lobby-Phase.
 * Nur im Preset "Spielerisch" aktiv.
 *
 * Features:
 * - Bunte Chips fliegen von außen ins Foyer ein
 * - Eigenständiger arsnova.eu-Stil (nicht Kahoot-Kopie)
 * - Respektiert enableRewardEffects & prefers-reduced-motion
 * - Responsive & performant
 * - Beamer-tauglich
 */

export interface FoyerChip {
  id: string;
  nickname: string;
  emoji?: string;
  colorIndex: number;
  startX: number;
  startY: number;
  delay: number;
  hasEntered: boolean;
}

@Component({
  selector: 'app-foyer-entrance-animation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './foyer-entrance-animation.component.html',
  styleUrls: ['./foyer-entrance-animation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoyerEntranceAnimationComponent implements OnInit, OnDestroy {
  /**
   * Input: Die aktuelle Teilnehmer-Liste (wird von session-host bereitgestellt)
   */
  @Input()
  set participantsData(payload: SessionParticipantsPayload | null) {
    if (payload?.participants) {
      this.onParticipantsUpdate(payload.participants);
    }
  }

  /**
   * Input: Gibt an, ob Effekte aktiviert sind (enableRewardEffects)
   */
  @Input()
  set animationEnabled(enabled: boolean) {
    this.animationEnabledSignal.set(enabled);
  }

  /**
   * Input: Gibt an, ob es sich um das Spielerisch-Preset handelt
   */
  @Input()
  set isPlayfulPreset(playful: boolean) {
    this.isPlayfulSignal.set(playful);
  }

  /**
   * Farb-Palette für Chips (Material 3 inspiriert)
   */
  private readonly CHIP_COLORS = [
    '#FF6B6B', // Rot
    '#4ECDC4', // Teal
    '#45B7D1', // Blau
    '#FFA07A', // Orange
    '#98D8C8', // Grün
    '#F7DC6F', // Gelb
    '#BB8FCE', // Lila
    '#85C1E2', // Hellblau
  ];

  // Signals
  private animationEnabledSignal = signal(true);
  private isPlayfulSignal = signal(true);
  private previousParticipantIds = signal<Set<string>>(new Set());
  private chips = signal<FoyerChip[]>([]);
  private prefersReducedMotion = signal(this.checkPrefersReducedMotion());

  // Computed
  readonly shouldAnimateChips = computed(
    () => this.animationEnabledSignal() && this.isPlayfulSignal() && !this.prefersReducedMotion(),
  );

  readonly animatingChips = computed(() => {
    const chips = this.chips();
    return this.shouldAnimateChips() ? chips : [];
  });

  readonly staticChips = computed(() => {
    const chips = this.chips();
    return this.prefersReducedMotion() ? chips : [];
  });

  // Expose für Template
  readonly prefersReducedMotionSignal = this.prefersReducedMotion;

  constructor() {
    // Media-Query für prefers-reduced-motion monitoren
    effect(
      () => {
        if (typeof window !== 'undefined' && window.matchMedia) {
          const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
          const listener = (e: MediaQueryListEvent) => {
            this.prefersReducedMotion.set(e.matches);
          };
          mediaQuery.addEventListener('change', listener);

          return () => {
            mediaQuery.removeEventListener('change', listener);
          };
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    // Initialisierung falls nötig
  }

  ngOnDestroy(): void {
    // Cleanup: Signals aufräumen
    this.chips.set([]);
    this.previousParticipantIds.set(new Set());
  }

  /**
   * Wird aufgerufen, wenn sich die Teilnehmer-Liste ändert.
   * Neue Teilnehmende werden erkannt und bekommen eine Animation.
   */
  private onParticipantsUpdate(participants: Array<{ id: string; nickname: string }>): void {
    const currentIds = new Set(participants.map((p) => p.id));
    const previousIds = this.previousParticipantIds();

    // Finde neue Teilnehmende
    const newParticipantIds = new Set<string>();
    for (const id of currentIds) {
      if (!previousIds.has(id)) {
        newParticipantIds.add(id);
      }
    }

    // Entferne Teilnehmende, die gegangen sind
    const removedIds = new Set<string>();
    for (const id of previousIds) {
      if (!currentIds.has(id)) {
        removedIds.add(id);
      }
    }

    // Update chips
    let updatedChips = [...this.chips()];

    // Entferne Chips für Teilnehmende, die gegangen sind
    updatedChips = updatedChips.filter((chip) => !removedIds.has(chip.id));

    // Füge neue Chips für neue Teilnehmende hinzu
    for (const participant of participants) {
      if (newParticipantIds.has(participant.id)) {
        const newChip = this.createChip(participant);
        updatedChips.push(newChip);

        // Trigger Animation nach kurzer Verzögerung
        setTimeout(() => {
          const chipIndex = updatedChips.findIndex((c) => c.id === newChip.id);
          if (chipIndex !== -1) {
            updatedChips[chipIndex] = { ...updatedChips[chipIndex], hasEntered: true };
            this.chips.set([...updatedChips]);
          }
        }, 50);
      }
    }

    this.chips.set(updatedChips);
    this.previousParticipantIds.set(currentIds);
  }

  /**
   * Erstellt einen neuen Chip für einen Teilnehmenden
   */
  private createChip(participant: { id: string; nickname: string }): FoyerChip {
    const colorIndex = Math.floor(Math.random() * this.CHIP_COLORS.length);
    const emojiValue = findKindergartenNicknameEmoji(participant.nickname);

    // Zufällige Start-Position vom Rand
    // Berechnung basierend auf Container-Größe für bessere Responsivität
    const edge = Math.floor(Math.random() * 4);
    let startX = 0;
    let startY = 0;

    // Diese Positionen werden mit CSS-Transform umgesetzt
    // Die echten Positionen berechnen sich zur Laufzeit basierend auf Container
    switch (edge) {
      case 0: // Von links
        startX = Math.random() * 50;
        startY = Math.random() * 150;
        break;
      case 1: // Von rechts
        startX = Math.random() * 50 + 50;
        startY = Math.random() * 150;
        break;
      case 2: // Von oben
        startX = Math.random() * 100;
        startY = Math.random() * 50;
        break;
      case 3: // Von unten
        startX = Math.random() * 100;
        startY = Math.random() * 50 + 50;
        break;
    }

    return {
      id: participant.id,
      nickname: participant.nickname,
      emoji: emojiValue ?? undefined,
      colorIndex,
      startX,
      startY,
      delay: Math.random() * 200, // Staggered entrance
      hasEntered: false,
    };
  }

  /**
   * Gibt die Chip-Farbe zurück
   */
  getChipColor(colorIndex: number): string {
    return this.CHIP_COLORS[colorIndex % this.CHIP_COLORS.length];
  }

  /**
   * Prüft prefers-reduced-motion
   */
  private checkPrefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }

  /**
   * Gibt die Initialen des Nicknames zurück (fallback für Chips ohne Emoji)
   */
  getInitials(nickname: string): string {
    const parts = nickname.trim().split(/\s+/);
    if (parts.length >= 2) {
      return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
    }
    return nickname.slice(0, 2).toUpperCase();
  }
}
