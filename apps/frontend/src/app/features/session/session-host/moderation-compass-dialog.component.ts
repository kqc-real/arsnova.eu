import { NgTemplateOutlet } from '@angular/common';
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
  parseQaSummaryQuestionSourceId,
  shouldShowQaSummaryCard,
  sortQaSummaryStatementsByImportance,
  type ModerationPromptSection,
  type QaSummaryContextPreviewDTO,
  type QaSummaryPresentationSourceKind,
  type QaSummaryPresentationSourceV2,
  type QaSummaryResult,
  type QaSummaryResultV2,
  type QaSummaryRuntimeCompatibleDTO,
  type QaSummarySource,
} from '@arsnova/shared-types';
import { ModerationCompassIconComponent } from './moderation-compass-icon.component';
import {
  compassSourceSpokenLabel,
  extraModerationCompassSources,
  moderationCompassSourceDestination,
  resolveModerationCompassMoreSourcesKind,
  splitModerationSummaryLead,
  visibleModerationCompassSources,
  type ModerationCompassAnalysisMode,
  type ModerationCompassCard,
  type ModerationCompassCardKind,
  type ModerationCompassMoreSourcesKind,
  type ModerationCompassNextStepReason,
  type ModerationCompassSortMode,
  type ModerationCompassSource,
  type ModerationCompassSourceDestination,
  type ModerationSummaryScanParts,
} from './moderation-compass';
import { replaceEmojiShortcodes } from '../../../shared/emoji-shortcode.util';
import { localizeQaSummaryChromeLimitation } from './qa-summary-chrome-copy';

export type { ModerationCompassAnalysisMode };

function normalizeSummaryNotice(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

function isPromise(value: unknown): value is Promise<void | boolean> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

type CompatibleQaSummaryResult = QaSummaryResult | QaSummaryResultV2;
type CompatibleQaSummarySource = QaSummarySource | QaSummaryPresentationSourceV2;
type SummaryPreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'pending' }
  | { readonly status: 'ready'; readonly preview: QaSummaryContextPreviewDTO }
  | { readonly status: 'failed' };

type SummaryPreviewSectionRow = Readonly<{
  section: ModerationPromptSection;
  state: string;
  count: string;
}>;

export type ModerationCompassDialogData = {
  cards: () => readonly ModerationCompassCard[];
  analysisMode?: ModerationCompassAnalysisMode;
  onSourceActivate?: (
    source: ModerationCompassSource,
    cardKind: ModerationCompassCardKind,
  ) => void | boolean | Promise<void | boolean>;
  summaryEnabled?: () => boolean;
  summaryVisibleQuestionCount?: () => number;
  summary?: () => QaSummaryRuntimeCompatibleDTO | null;
  onRequestSummary?: () => void;
  onSummarySourceActivate?: (source: QaSummarySource) => void;
  onRequestSummaryContextPreview?: () => Promise<QaSummaryContextPreviewDTO>;
  /** Aktuelle Q&A-Sortierung für kontextbezogene Extra-Quellen-Labels. */
  qaSortMode?: () => ModerationCompassSortMode;
  /** True, wenn die Q&A-Wortwolken-Glättung aktiv und aktuell ist. */
  wordCloudSmoothingActive?: () => boolean;
  /** True, wenn die Q&A-Wortwolke im Einzelwort-Modus läuft (keine Phrasen). */
  wordCloudSingleWordsOnly?: () => boolean;
};

@Component({
  selector: 'app-moderation-compass-dialog',
  standalone: true,
  imports: [
    NgTemplateOutlet,
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
  readonly showAnalysisStatus = computed(() => {
    const mode = this.analysisMode();
    return mode !== 'rule-based' && mode !== 'disabled';
  });
  readonly leadCard = computed(
    () => this.cards().find((card) => card.nextStepReason !== undefined) ?? null,
  );
  readonly primaryNextStepReason = computed(() => this.leadCard()?.nextStepReason);
  readonly summaryEnabled = computed(() => this.data.summaryEnabled?.() === true);
  readonly summaryRuntime = computed(() => this.data.summary?.() ?? null);
  readonly summaryResult = computed(() => this.summaryRuntime()?.result ?? null);
  readonly summaryPending = computed(() => this.summaryResult()?.status === 'pending');
  readonly summaryV2Available = computed(() => {
    const runtime = this.summaryRuntime();
    return runtime !== null && 'schemaVersion' in runtime && runtime.schemaVersion === 2;
  });
  readonly showSummaryCard = computed(() => {
    const runtime = this.summaryRuntime();
    return shouldShowQaSummaryCard({
      enabled: this.summaryEnabled(),
      inferenceConfigured: runtime?.inferenceConfigured === true,
      fallbackAvailable: this.summaryV2Available(),
      visibleQuestionCount: this.data.summaryVisibleQuestionCount?.() ?? 0,
      resultStatus: runtime?.result?.status ?? null,
    });
  });
  readonly summaryRequestable = computed(() => {
    const runtime = this.summaryRuntime();
    return canRequestQaSummary({
      enabled: this.summaryEnabled(),
      inferenceConfigured: runtime?.inferenceConfigured === true,
      fallbackAvailable: this.summaryV2Available(),
      visibleQuestionCount: this.data.summaryVisibleQuestionCount?.() ?? 0,
    });
  });
  readonly summaryRevealed = signal(false);
  readonly summaryPreviewState = signal<SummaryPreviewState>({ status: 'idle' });
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

  summaryStatements(result: CompatibleQaSummaryResult): CompatibleQaSummaryResult['statements'] {
    return sortQaSummaryStatementsByImportance(
      result.statements,
      result.sources.map((source) => source.id),
    );
  }

  moreSourcesKind(card: ModerationCompassCard): ModerationCompassMoreSourcesKind {
    return resolveModerationCompassMoreSourcesKind(this.extraSources(card), {
      qaSortMode: this.data.qaSortMode?.() ?? 'BEST',
      wordCloudSmoothingActive: this.data.wordCloudSmoothingActive?.() === true,
      wordCloudSingleWordsOnly: this.data.wordCloudSingleWordsOnly?.() === true,
    });
  }

  moreSourcesLabel(card: ModerationCompassCard): string {
    const extras = this.extraSources(card);
    switch (this.moreSourcesKind(card)) {
      case 'word-cloud-top':
        return $localize`:@@sessionHost.moderationMoreWordCloudTop:Top-Themen der Wortwolke`;
      case 'word-cloud-more':
        return $localize`:@@sessionHost.moderationMoreWordCloudTopics:Weitere Wortwolken-Themen`;
      default:
        return $localize`:@@sessionHost.moderationMoreSources:Weitere Einstiege (${extras.length}:count:)`;
    }
  }

  sourceDestinationLabel(source: ModerationCompassSource): string {
    return this.destinationLabel(moderationCompassSourceDestination(source));
  }

  displaySourceLabel(label: string): string {
    return replaceEmojiShortcodes(label);
  }

  summarySourceDestinationLabel(source: CompatibleQaSummarySource): string {
    switch (source.kind) {
      case 'semantic-topic':
        return $localize`:@@sessionHost.moderationSummarySourceTopic:Thema`;
      case 'quiz-question':
        return this.destinationLabel('quiz');
      case 'learning-objective':
        return $localize`:@@sessionHost.moderationSummarySourceObjective:Lernziel`;
      case 'quiz-result-aggregate':
        return $localize`:@@sessionHost.moderationSummarySourceQuizResult:Quiz-Ergebnis`;
      case 'feedback-aggregate':
        return this.destinationLabel('quickFeedback');
      case 'compass-signal':
        return $localize`:@@sessionHost.moderationSummarySourceCompass:Kompass`;
      default:
        return this.destinationLabel('qa');
    }
  }

  sourceJumpAria(source: ModerationCompassSource): string {
    const destination = this.sourceDestinationLabel(source);
    return $localize`:@@sessionHost.moderationSourceOpenAria:Öffnet ${destination}:destination:: ${this.displaySourceLabel(compassSourceSpokenLabel(source))}:label:`;
  }

  sourceTrackKey(source: ModerationCompassSource): string {
    return [source.kind, source.label, source.evidence ?? '', source.context ?? ''].join('\0');
  }

  summarySourceJumpAria(source: CompatibleQaSummarySource): string {
    const destination = this.summarySourceDestinationLabel(source);
    return $localize`:@@sessionHost.moderationSummarySourceOpenAria:Öffnet ${destination}:destination:: ${this.displaySourceLabel(source.label)}:label:`;
  }

  summarySourcesToggleLabel(result: CompatibleQaSummaryResult): string {
    const count = result.sources.length;
    if ('schemaVersion' in result) {
      return $localize`:@@sessionHost.moderationSummaryEvidenceToggle:Belege (${count}:count:)`;
    }
    return $localize`:@@sessionHost.moderationSummarySourcesToggle:Zugehörige Fragen (${count}:count:)`;
  }

  activateSource(source: ModerationCompassSource, card: ModerationCompassCard): void {
    if (!source.target) {
      return;
    }
    const outcome = this.data.onSourceActivate?.(source, card.kind);
    if (isPromise(outcome)) {
      void outcome.then((shouldClose) => {
        if (shouldClose !== false) {
          this.dialogRef.close();
        }
      });
      return;
    }
    if (outcome === false) {
      return;
    }
    this.dialogRef.close();
  }

  isQaQuestionSummarySource(source: CompatibleQaSummarySource): source is QaSummarySource {
    return source.kind === 'qa-question' && parseQaSummaryQuestionSourceId(source.id) !== null;
  }

  activateSummarySource(source: CompatibleQaSummarySource): void {
    if (!this.isQaQuestionSummarySource(source)) {
      return;
    }
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

  summaryStatusText(result: CompatibleQaSummaryResult | null): string | null {
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

  summaryLimitations(result: CompatibleQaSummaryResult): readonly string[] {
    const skip = new Set(
      [this.summaryStatusText(result), this.genericSummaryStatus(result.status)]
        .filter((item): item is string => Boolean(item))
        .map(normalizeSummaryNotice),
    );
    return result.limitations
      .map((item) => localizeQaSummaryChromeLimitation(item))
      .filter((item) => !skip.has(normalizeSummaryNotice(item)));
  }

  private genericSummaryStatus(status: CompatibleQaSummaryResult['status']): string | null {
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

  async requestSummaryContextPreview(): Promise<void> {
    if (this.summaryPreviewState().status === 'pending') {
      return;
    }
    const request = this.data.onRequestSummaryContextPreview;
    if (!request) {
      this.summaryPreviewState.set({ status: 'failed' });
      return;
    }
    this.summaryPreviewState.set({ status: 'pending' });
    try {
      const preview = await request();
      this.summaryPreviewState.set({ status: 'ready', preview });
    } catch {
      this.summaryPreviewState.set({ status: 'failed' });
    }
  }

  previewSectionRows(preview: QaSummaryContextPreviewDTO): readonly SummaryPreviewSectionRow[] {
    const context = preview.promptContext.context;
    const questionCount =
      context.questions.state === 'available'
        ? `${context.questions.corpus.represented} / ${context.questions.corpus.total}`
        : '—';
    return [
      {
        section: 'questions',
        state: context.questions.state,
        count: questionCount,
      },
      {
        section: 'topics',
        state: context.topics.state,
        count: context.topics.state === 'available' ? String(context.topics.items.length) : '—',
      },
      {
        section: 'compass',
        state: context.compass.state,
        count: context.compass.state === 'available' ? String(context.compass.signals.length) : '—',
      },
      {
        section: 'learning-context',
        state: context.learningContext.state,
        count:
          context.learningContext.state === 'available'
            ? String(context.learningContext.objectives.length)
            : '—',
      },
      {
        section: 'released-results',
        state: context.releasedResults.state,
        count:
          context.releasedResults.state === 'available'
            ? String(context.releasedResults.aggregates.length)
            : '—',
      },
      {
        section: 'feedback',
        state: context.feedback.state,
        count:
          context.feedback.state === 'available' ? String(context.feedback.aggregates.length) : '—',
      },
    ];
  }

  previewSourceGroups(
    preview: QaSummaryContextPreviewDTO,
  ): readonly { kind: QaSummaryPresentationSourceKind; count: number }[] {
    const counts = new Map<QaSummaryPresentationSourceKind, number>();
    for (const source of preview.promptContext.context.sources) {
      counts.set(source.kind, (counts.get(source.kind) ?? 0) + 1);
    }
    return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
  }

  previewSourceKindLabel(kind: QaSummaryPresentationSourceKind): string {
    return this.summarySourceDestinationLabel({ id: kind, kind, label: kind });
  }

  previewSectionLabel(section: ModerationPromptSection): string {
    switch (section) {
      case 'questions':
        return $localize`:@@sessionHost.moderationPreviewSectionQuestions:Fragen`;
      case 'topics':
        return $localize`:@@sessionHost.moderationPreviewSectionTopics:Themen`;
      case 'compass':
        return $localize`:@@sessionHost.moderationPreviewSectionCompass:Kompasssignale`;
      case 'learning-context':
        return $localize`:@@sessionHost.moderationPreviewSectionLearning:Lernkontext`;
      case 'released-results':
        return $localize`:@@sessionHost.moderationPreviewSectionResults:Freigegebene Ergebnisse`;
      case 'feedback':
        return $localize`:@@sessionHost.moderationPreviewSectionFeedback:Blitzlicht`;
    }
  }

  previewStateLabel(state: string): string {
    switch (state) {
      case 'available':
        return $localize`:@@sessionHost.moderationPreviewStateAvailable:verfügbar`;
      case 'disabled':
        return $localize`:@@sessionHost.moderationPreviewStateDisabled:deaktiviert`;
      case 'pending':
        return $localize`:@@sessionHost.moderationPreviewStatePending:ausstehend`;
      case 'failed':
        return $localize`:@@sessionHost.moderationPreviewStateFailed:fehlgeschlagen`;
      case 'not-released':
        return $localize`:@@sessionHost.moderationPreviewStateNotReleased:nicht freigegeben`;
      case 'not-applicable':
        return $localize`:@@sessionHost.moderationPreviewStateNotApplicable:nicht zutreffend`;
      default:
        return $localize`:@@sessionHost.moderationPreviewStateUnavailable:nicht verfügbar`;
    }
  }

  previewModeLabel(preview: QaSummaryContextPreviewDTO): string {
    if (preview.selectedMode === 'full-context') {
      return $localize`:@@sessionHost.moderationPreviewModeFullContext:Vollständiger Kontext`;
    }
    if (preview.selectedMode === 'legacy-text') {
      return $localize`:@@sessionHost.moderationPreviewModeLegacy:Legacy-Text`;
    }
    return $localize`:@@sessionHost.moderationPreviewModeExtractive:Lokaler extraktiver Fallback`;
  }

  cardTitle(card: ModerationCompassCard): string {
    if (card.title) {
      return card.title;
    }
    switch (card.kind) {
      case 'topics':
        return $localize`:@@sessionHost.moderationCardTopics:Häufige Themen`;
      case 'clarification':
        if (card.nextStepReason === 'quiz-freetext') {
          return $localize`:@@sessionHost.moderationCardFreetext:Ähnliche Antworten`;
        }
        if (card.nextStepReason === 'quiz-mention') {
          return $localize`:@@sessionHost.moderationCardMention:Andere Antworten`;
        }
        return $localize`:@@sessionHost.moderationCardClarification:Noch klären`;
      case 'survey':
        return $localize`:@@sessionHost.moderationCardSurvey:Antwortverteilung`;
      case 'friction':
        return $localize`:@@sessionHost.moderationCardFriction:Umstrittene Fragen`;
      case 'tempo':
        return card.tempoStatus === 'TOO_FAST' ||
          card.tempoStatus === 'LOST' ||
          (card.tone === 'alert' && !card.tempoStatus)
          ? $localize`:@@sessionHost.moderationCardTempoBehind:Kommen nicht mit`
          : $localize`:@@sessionHost.moderationCardTempo:Feedback zum Vortragstempo`;
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
        return 'help';
      case 'survey':
        return 'bar_chart';
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
      case 'quiz-freetext':
        return $localize`:@@sessionHost.moderationNextFreetext:Lies die wiederkehrenden Freitextantworten kurz vor.`;
      case 'quiz-mention':
        return $localize`:@@sessionHost.moderationNextMention:Einzelne andere Antworten sind sichtbar. Du musst sie nicht zum Thema machen.`;
      case 'controversy':
        return $localize`:@@sessionHost.moderationNextFriction:Greif die umstrittenen Fragen kurz auf.`;
      case 'tempo':
        return $localize`:@@sessionHost.moderationNextTempo:Geh langsamer oder frag, wer nicht mehr folgt.`;
      case 'tempo-slow':
        return $localize`:@@sessionHost.moderationNextTempoSlow:Die Gruppe kann schneller. Du kannst das Tempo anziehen.`;
      case 'tempo-mixed':
        return $localize`:@@sessionHost.moderationNextTempoMixed:Die Rückmeldungen sind gemischt. Frag kurz nach, woran es liegt.`;
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
