import { Component, computed, inject } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import type { QaSummaryResult, QaSummaryRuntimeDTO, QaSummarySource } from '@arsnova/shared-types';
import { ModerationCompassIconComponent } from './moderation-compass-icon.component';
import type {
  ModerationCompassAnalysisMode,
  ModerationCompassCard,
  ModerationCompassCardKind,
  ModerationCompassNextStepReason,
  ModerationCompassSource,
} from './moderation-compass';

export type { ModerationCompassAnalysisMode };

export type ModerationCompassDialogData = {
  cards: () => readonly ModerationCompassCard[];
  analysisMode?: ModerationCompassAnalysisMode;
  onSourceActivate?: (source: ModerationCompassSource, cardKind: ModerationCompassCardKind) => void;
  summaryEnabled?: () => boolean;
  summary?: () => QaSummaryRuntimeDTO | null;
  onRequestSummary?: () => void;
  onSummarySourceActivate?: (source: QaSummarySource) => void;
};

@Component({
  selector: 'app-moderation-compass-dialog',
  standalone: true,
  imports: [
    MatButton,
    MatIconButton,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
    ModerationCompassIconComponent,
  ],
  templateUrl: './moderation-compass-dialog.component.html',
  styleUrls: [
    '../../../shared/styles/dialog-title-header.scss',
    './moderation-compass-dialog.component.scss',
  ],
})
export class ModerationCompassDialogComponent {
  readonly data = inject<ModerationCompassDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ModerationCompassDialogComponent>);
  readonly cards = computed(() => this.data.cards());
  readonly hasCards = computed(() => this.cards().length > 0);
  readonly analysisMode = computed(() => this.data.analysisMode ?? 'rule-based');
  readonly summaryEnabled = computed(() => this.data.summaryEnabled?.() === true);
  readonly summaryRuntime = computed(() => this.data.summary?.() ?? null);
  readonly summaryResult = computed(() => this.summaryRuntime()?.result ?? null);
  readonly summaryPending = computed(() => this.summaryResult()?.status === 'pending');

  sourceJumpAria(source: ModerationCompassSource): string {
    return $localize`:@@sessionHost.moderationSourceJumpAria:Zur Quelle: ${source.label}:label:`;
  }

  summarySourceJumpAria(source: QaSummarySource): string {
    return $localize`:@@sessionHost.moderationSummarySourceJumpAria:Zur Quelle: ${source.label}:label:`;
  }

  activateSource(source: ModerationCompassSource, card: ModerationCompassCard): void {
    if (!source.target) {
      return;
    }
    this.data.onSourceActivate?.(source, card.kind);
    this.dialogRef.close();
  }

  activateSummarySource(source: QaSummarySource): void {
    this.data.onSummarySourceActivate?.(source);
    this.dialogRef.close();
  }

  requestSummary(): void {
    if (this.summaryPending()) {
      return;
    }
    this.data.onRequestSummary?.();
  }

  summaryStatusText(result: QaSummaryResult | null): string | null {
    switch (result?.status) {
      case 'pending':
        return $localize`:@@sessionHost.moderationSummaryPending:Die Zusammenfassung wird erstellt.`;
      case 'uncertain':
        return $localize`:@@sessionHost.moderationSummaryUncertain:Die Zusammenfassung ist unsicher.`;
      case 'failed':
        return $localize`:@@sessionHost.moderationSummaryFailed:Die Zusammenfassung ist gerade nicht verfügbar.`;
      default:
        return null;
    }
  }

  cardTitle(card: ModerationCompassCard): string {
    if (card.title) {
      return card.title;
    }
    switch (card.kind) {
      case 'topics':
        return $localize`:@@sessionHost.moderationCardTopics:Häufige Themen`;
      case 'clarification':
        return $localize`:@@sessionHost.moderationCardClarification:Noch klären`;
      case 'friction':
        return $localize`:@@sessionHost.moderationCardFriction:Umstrittene Fragen`;
      case 'tempo':
        return $localize`:@@sessionHost.moderationCardTempo:Tempo`;
      case 'nextStep':
        return $localize`:@@sessionHost.moderationCardNextStep:Nächster Schritt`;
    }
  }

  nextStepHeading(): string {
    return $localize`:@@sessionHost.moderationCardNextStep:Nächster Schritt`;
  }

  cardIcon(card: ModerationCompassCard): string {
    switch (card.kind) {
      case 'topics':
        return 'label';
      case 'clarification':
        return 'help_outline';
      case 'friction':
        return 'compare_arrows';
      case 'tempo':
        return card.title ? 'thumbs_up_down' : 'speed';
      case 'nextStep':
        return 'flag';
    }
  }

  nextStepText(reason: ModerationCompassNextStepReason | undefined): string | null {
    switch (reason) {
      case 'pending-qa':
        return $localize`:@@sessionHost.moderationNextPending:Schau zuerst in die Fragen, die noch auf Freigabe warten.`;
      case 'quiz-confusion':
        return $localize`:@@sessionHost.moderationNextQuiz:Erkläre kurz die Lösung und die typischen Fehler.`;
      case 'quiz-survey':
        return $localize`:@@sessionHost.moderationNextQuizSurvey:Fass kurz die Antwortverteilung zusammen.`;
      case 'quiz-rating':
        return $localize`:@@sessionHost.moderationNextQuizRating:Sprich die Bewertungen kurz an.`;
      case 'controversy':
        return $localize`:@@sessionHost.moderationNextFriction:Greif die umstrittenen Fragen kurz auf.`;
      case 'tempo':
        return $localize`:@@sessionHost.moderationNextTempo:Geh langsamer oder frag, wer nicht mehr folgt.`;
      case 'feedback':
        return $localize`:@@sessionHost.moderationNextFeedback:Sieh dir das Blitzlicht kurz an.`;
      case 'steady':
        return $localize`:@@sessionHost.moderationNextSteady:Es wirkt ruhig. Du kannst so weitermachen.`;
      case 'topics':
        return $localize`:@@sessionHost.moderationNextTopics:Fass die häufigsten Themen kurz zusammen.`;
      default:
        return null;
    }
  }
}
