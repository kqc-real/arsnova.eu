import { Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import {
  canRequestQaSummary,
  shouldShowQaSummaryCard,
  sortQaSummaryStatementsByImportance,
  type QaSummaryResult,
  type QaSummaryRuntimeDTO,
  type QaSummarySource,
} from '@arsnova/shared-types';
import { ModerationCompassIconComponent } from './moderation-compass-icon.component';
import {
  extraModerationCompassSources,
  moderationCompassSourceDestination,
  splitModerationSummaryLead,
  visibleModerationCompassSources,
  type ModerationCompassAnalysisMode,
  type ModerationCompassCard,
  type ModerationCompassCardKind,
  type ModerationCompassNextStepReason,
  type ModerationCompassSource,
  type ModerationCompassSourceDestination,
  type ModerationSummaryScanParts,
} from './moderation-compass';
import { localizeQaSummaryChromeLimitation } from './qa-summary-chrome-copy';

export type { ModerationCompassAnalysisMode };

function normalizeSummaryNotice(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

export type ModerationCompassDialogData = {
  cards: () => readonly ModerationCompassCard[];
  analysisMode?: ModerationCompassAnalysisMode;
  onSourceActivate?: (source: ModerationCompassSource, cardKind: ModerationCompassCardKind) => void;
  summaryEnabled?: () => boolean;
  summaryVisibleQuestionCount?: () => number;
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
  encapsulation: ViewEncapsulation.None,
})
export class ModerationCompassDialogComponent {
  readonly data = inject<ModerationCompassDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ModerationCompassDialogComponent>);
  readonly cards = computed(() => this.data.cards());
  readonly hasCards = computed(() => this.cards().length > 0);
  readonly analysisMode = computed(() => this.data.analysisMode ?? 'rule-based');
  readonly showAnalysisStatus = computed(() => this.analysisMode() !== 'rule-based');
  readonly leadCard = computed(
    () => this.cards().find((card) => card.nextStepReason !== undefined) ?? null,
  );
  readonly primaryNextStepReason = computed(() => this.leadCard()?.nextStepReason);
  readonly summaryEnabled = computed(() => this.data.summaryEnabled?.() === true);
  readonly summaryRuntime = computed(() => this.data.summary?.() ?? null);
  readonly summaryResult = computed(() => this.summaryRuntime()?.result ?? null);
  readonly summaryPending = computed(() => this.summaryResult()?.status === 'pending');
  readonly showSummaryCard = computed(() => {
    const runtime = this.summaryRuntime();
    return shouldShowQaSummaryCard({
      enabled: this.summaryEnabled(),
      inferenceConfigured: runtime?.inferenceConfigured === true,
      visibleQuestionCount: this.data.summaryVisibleQuestionCount?.() ?? 0,
      resultStatus: runtime?.result?.status ?? null,
    });
  });
  readonly summaryRequestable = computed(() => {
    const runtime = this.summaryRuntime();
    return canRequestQaSummary({
      enabled: this.summaryEnabled(),
      inferenceConfigured: runtime?.inferenceConfigured === true,
      visibleQuestionCount: this.data.summaryVisibleQuestionCount?.() ?? 0,
    });
  });
  readonly summaryRevealed = signal(false);
  readonly showSummaryNextSteps = computed(() => {
    const result = this.summaryResult();
    return (
      this.primaryNextStepReason() === undefined && (result?.suggestedNextSteps.length ?? 0) > 0
    );
  });
  readonly showSummaryBody = computed(() => {
    const result = this.summaryResult();
    if (!result) {
      return false;
    }
    if (result.status === 'failed') {
      return (
        result.statements.length > 0 ||
        result.sources.length > 0 ||
        this.summaryLimitations(result).length > 0
      );
    }
    return this.summaryRevealed() || this.summaryPending();
  });

  visibleSources(card: ModerationCompassCard): readonly ModerationCompassSource[] {
    return visibleModerationCompassSources(card.sources);
  }

  extraSources(card: ModerationCompassCard): readonly ModerationCompassSource[] {
    return extraModerationCompassSources(card.sources);
  }

  summaryScanParts(text: string): ModerationSummaryScanParts {
    return splitModerationSummaryLead(text, this.summaryResult()?.locale ?? 'de');
  }

  summaryStatements(result: QaSummaryResult): QaSummaryResult['statements'] {
    return sortQaSummaryStatementsByImportance(
      result.statements,
      result.sources.map((source) => source.id),
    );
  }

  moreSourcesLabel(count: number): string {
    return $localize`:@@sessionHost.moderationMoreSources:Noch ${count}:count: anzeigen`;
  }

  sourceDestinationLabel(source: ModerationCompassSource): string {
    return this.destinationLabel(moderationCompassSourceDestination(source));
  }

  summarySourceDestinationLabel(): string {
    return this.destinationLabel('qa');
  }

  sourceJumpAria(source: ModerationCompassSource): string {
    const destination = this.sourceDestinationLabel(source);
    return $localize`:@@sessionHost.moderationSourceOpenAria:Öffnet ${destination}:destination:: ${source.label}:label:`;
  }

  summarySourceJumpAria(source: QaSummarySource): string {
    const destination = this.summarySourceDestinationLabel();
    return $localize`:@@sessionHost.moderationSummarySourceOpenAria:Öffnet ${destination}:destination:: ${source.label}:label:`;
  }

  summarySourcesToggleLabel(count: number): string {
    return $localize`:@@sessionHost.moderationSummarySourcesToggle:Zugehörige Fragen (${count}:count:)`;
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
    this.summaryRevealed.set(true);
    if (this.summaryRequestable()) {
      this.data.onRequestSummary?.();
    }
  }

  summaryStatusText(result: QaSummaryResult | null): string | null {
    if (!result) {
      return null;
    }
    if (result.status === 'pending') {
      return this.genericSummaryStatus(result.status);
    }
    if (result.status !== 'failed' && result.status !== 'uncertain') {
      return null;
    }
    const generic = this.genericSummaryStatus(result.status);
    const specific = result.limitations
      .map((item) => localizeQaSummaryChromeLimitation(item))
      .find((item) => normalizeSummaryNotice(item) !== normalizeSummaryNotice(generic ?? ''));
    return specific ?? generic;
  }

  summaryLimitations(result: QaSummaryResult): readonly string[] {
    const skip = new Set(
      [this.summaryStatusText(result), this.genericSummaryStatus(result.status)]
        .filter((item): item is string => Boolean(item))
        .map(normalizeSummaryNotice),
    );
    return result.limitations
      .map((item) => localizeQaSummaryChromeLimitation(item))
      .filter((item) => !skip.has(normalizeSummaryNotice(item)));
  }

  private genericSummaryStatus(status: QaSummaryResult['status']): string | null {
    switch (status) {
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
        return card.tone === 'alert' || card.tone === 'caution'
          ? $localize`:@@sessionHost.moderationCardTempoBehind:Kommen nicht mit`
          : $localize`:@@sessionHost.moderationCardTempo:Tempo`;
      case 'nextStep':
        return $localize`:@@sessionHost.moderationNowHeading:Als Nächstes`;
    }
  }

  nextStepHeading(): string {
    return $localize`:@@sessionHost.moderationNowHeading:Als Nächstes`;
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

  private destinationLabel(destination: ModerationCompassSourceDestination): string {
    switch (destination) {
      case 'quiz':
        return $localize`:@@sessionHost.moderationSourceChannelQuiz:Quiz`;
      case 'word-cloud':
        return $localize`:@@sessionHost.moderationSourceChannelWordCloud:Wortwolke`;
      case 'quickFeedback':
        return $localize`:@@sessionHost.moderationSourceChannelFeedback:Blitzlicht`;
      default:
        return $localize`:@@sessionHost.moderationSourceChannelQa:Q&A`;
    }
  }
}
