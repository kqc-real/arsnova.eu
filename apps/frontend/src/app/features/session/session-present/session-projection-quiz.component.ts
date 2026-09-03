import { DecimalPipe } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input, LOCALE_ID } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { EMOJI_REACTIONS } from '@arsnova/shared-types';
import type {
  HostCurrentQuestionDTO,
  HostVoteProgressDTO,
  NumericRoundComparisonDTO,
  NumericStatsDTO,
  SessionInfoDTO,
} from '@arsnova/shared-types';
import { AnswerOptionBadgeComponent } from '../../../shared/answer-option-badge/answer-option-badge.component';
import { CountdownFingersComponent } from '../../../shared/countdown-fingers/countdown-fingers.component';
import { formatLocaleCount, formatLocaleNumber } from '../../../core/locale-number.util';
import { ThemePresetService } from '../../../core/theme-preset.service';
import { MarkdownImageLightboxDirective } from '../../../shared/markdown-image-lightbox/markdown-image-lightbox.directive';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';
import { questionTypeLabel } from '../../../shared/question-type-label';
import {
  categorizationCorrectColumns,
  categorizationMatrixCells,
  categorizationMatrixColumns,
  categorizationMatrixRows,
  matchingCorrectColumns,
  matchingMatrixCells,
  matchingMatrixColumns,
  matchingMatrixRows,
  numericHistogramBarPercent,
  orderingCorrectColumns,
  orderingMatrixCells,
  orderingMatrixColumns,
  orderingMatrixRows,
  presenterCodeColumnCount,
  presenterCompactMarkdown,
  presenterMarkdownWithoutCode,
  presenterQuestionCodeBlocks,
  presenterQuestionCodeColumnMarkdown,
  presenterQuestionImage,
  presenterCorrectPairResults,
  ratingScaleValues,
  stableSeededShuffle,
} from './session-projection-quiz.util';

type PresenterEmojiReactions = {
  reactions: Record<string, number>;
  total: number;
};

@Component({
  selector: 'app-session-projection-quiz',
  standalone: true,
  imports: [
    DecimalPipe,
    MatCard,
    MatCardContent,
    MatIcon,
    AnswerOptionBadgeComponent,
    CountdownFingersComponent,
    MarkdownImageLightboxDirective,
  ],
  templateUrl: './session-projection-quiz.component.html',
  styleUrl: './session-projection-quiz.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class SessionProjectionQuizComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly themePreset = inject(ThemePresetService);
  private readonly localeId = inject(LOCALE_ID);

  readonly question = input<HostCurrentQuestionDTO | null>(null);
  readonly status = input<SessionInfoDTO['status'] | null>(null);
  readonly voteProgress = input<HostVoteProgressDTO | null>(null);
  readonly participantCount = input(0);
  readonly countdownSeconds = input<number | null>(null);
  readonly emojiReactions = input<PresenterEmojiReactions | null>(null);
  readonly emojiOrder = EMOJI_REACTIONS;
  readonly showEmojiReactions = computed(
    () =>
      (this.status() === 'ACTIVE' || this.status() === 'RESULTS') &&
      (this.emojiReactions()?.total ?? 0) > 0,
  );

  readonly motifImageUrl = input<string | null>(null);

  readonly isReadingPhase = computed(() => this.status() === 'QUESTION_OPEN');
  readonly isActive = computed(() => this.status() === 'ACTIVE');
  readonly isResults = computed(() => this.status() === 'RESULTS');
  readonly isDiscussion = computed(() => this.status() === 'DISCUSSION');
  readonly revealCorrectness = computed(() => this.isResults());

  readonly questionTypeName = computed(() => {
    const type = this.question()?.type;
    return type ? questionTypeLabel(type) : '';
  });

  readonly liveVoteCount = computed(() => {
    const question = this.question();
    const progress = this.voteProgress();
    if (
      progress &&
      question &&
      progress.questionId === question.questionId &&
      progress.questionOrder === question.order &&
      progress.round === (question.currentRound ?? 1)
    ) {
      return progress.totalVotes;
    }
    if (question?.type === 'RATING') {
      return question.ratingCount ?? 0;
    }
    if (question?.type === 'FREETEXT') {
      return question.freeTextResponses?.length ?? 0;
    }
    return question?.totalVotes ?? 0;
  });

  readonly voteProgressPercent = computed(() => {
    const participants = this.participantCount();
    if (participants <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((this.liveVoteCount() / participants) * 100)));
  });

  readonly showChoiceAnswers = computed(() => {
    const question = this.question();
    if (!question || this.isReadingPhase()) {
      return false;
    }
    if (
      question.type === 'FREETEXT' ||
      question.type === 'RATING' ||
      question.type === 'NUMERIC_ESTIMATE' ||
      question.type === 'MATCHING' ||
      question.type === 'ORDERING' ||
      question.type === 'CATEGORIZATION'
    ) {
      return false;
    }
    if (question.type === 'SHORT_TEXT' && !this.isResults()) {
      return false;
    }
    return question.answers.length > 0;
  });
  readonly hasDenseAnswerCopy = computed(() => {
    const answers = this.question()?.answers ?? [];
    if (answers.length < 4) {
      return false;
    }
    const lengths = answers.map((answer) => answer.text.trim().length);
    return Math.max(...lengths, 0) > 16 || lengths.reduce((sum, length) => sum + length, 0) > 56;
  });

  readonly showRoundComparison = computed(() => {
    const comparison = this.question()?.roundComparison;
    return (
      this.isResults() &&
      !!comparison &&
      comparison.round1Distribution.length > 0 &&
      this.question()?.type !== 'FREETEXT'
    );
  });

  readonly showVoteDistribution = computed(
    () =>
      this.isResults() &&
      !this.showRoundComparison() &&
      (this.question()?.voteDistribution?.length ?? 0) > 0 &&
      this.question()?.type !== 'FREETEXT',
  );

  readonly ratingValues = computed(() => {
    const question = this.question();
    return question ? ratingScaleValues(question) : [];
  });

  readonly matchingRows = computed(() => {
    const question = this.question();
    return question ? matchingMatrixRows(question) : [];
  });
  readonly matchingColumns = computed(() => {
    const question = this.question();
    return question ? matchingMatrixColumns(question) : [];
  });
  readonly matchingCells = computed(() => {
    const question = this.question();
    return question ? matchingMatrixCells(question) : [];
  });
  readonly matchingCorrect = computed(() => {
    const question = this.question();
    return question ? matchingCorrectColumns(question) : {};
  });
  readonly matchingResultPairs = computed(() =>
    presenterCorrectPairResults(
      this.matchingRows(),
      this.matchingColumns(),
      this.matchingCells(),
      this.matchingCorrect(),
    ),
  );

  readonly orderingRows = computed(() => {
    const question = this.question();
    return question ? orderingMatrixRows(question) : [];
  });
  readonly orderingColumns = computed(() => {
    const question = this.question();
    return question ? orderingMatrixColumns(question) : [];
  });
  readonly orderingCells = computed(() => {
    const question = this.question();
    return question ? orderingMatrixCells(question) : [];
  });
  readonly orderingCorrect = computed(() => {
    const question = this.question();
    return question ? orderingCorrectColumns(question) : {};
  });
  readonly orderingResultPairs = computed(() =>
    presenterCorrectPairResults(
      this.orderingRows(),
      this.orderingColumns(),
      this.orderingCells(),
      this.orderingCorrect(),
    ),
  );

  readonly categorizationRows = computed(() => {
    const question = this.question();
    return question ? categorizationMatrixRows(question) : [];
  });
  readonly categorizationColumns = computed(() => {
    const question = this.question();
    return question ? categorizationMatrixColumns(question) : [];
  });
  readonly categorizationCells = computed(() => {
    const question = this.question();
    return question ? categorizationMatrixCells(question) : [];
  });
  readonly categorizationCorrect = computed(() => {
    const question = this.question();
    return question ? categorizationCorrectColumns(question) : {};
  });
  readonly categorizationResultPairs = computed(() =>
    presenterCorrectPairResults(
      this.categorizationRows(),
      this.categorizationColumns(),
      this.categorizationCells(),
      this.categorizationCorrect(),
    ),
  );

  readonly compactQuestionMarkdown = computed(() =>
    presenterCompactMarkdown(this.question()?.text ?? ''),
  );

  readonly hasQuestionCode = computed(
    () => presenterQuestionCodeBlocks(this.question()?.text ?? '').length > 0,
  );
  readonly showFingerCountdown = computed(() => {
    const seconds = this.countdownSeconds();
    return (
      this.isActive() &&
      !this.hasQuestionCode() &&
      seconds !== null &&
      seconds >= 0 &&
      seconds <= 5 &&
      this.themePreset.preset() === 'spielerisch'
    );
  });

  readonly questionCodeColumnMarkdown = computed(() =>
    presenterQuestionCodeColumnMarkdown(this.question()?.text ?? ''),
  );

  readonly questionCodeColumnCount = computed(
    () =>
      this.questionCodeColumnMarkdown().length ||
      presenterCodeColumnCount(this.question()?.text ?? ''),
  );

  readonly questionTitleMarkdown = computed(() => {
    const text = this.question()?.text ?? '';
    if (this.hasQuestionCode()) {
      const withoutCode = presenterMarkdownWithoutCode(text);
      if (this.isReadingPhase()) {
        return withoutCode;
      }
      return presenterCompactMarkdown(withoutCode);
    }
    return this.isReadingPhase() ? text : this.compactQuestionMarkdown();
  });

  readonly showStageColumn = computed(() => {
    const question = this.question();
    if (!question) {
      return false;
    }
    if (question.type === 'FREETEXT' && this.isResults()) {
      return false;
    }
    if (this.isReadingPhase()) {
      return this.hasQuestionCode();
    }
    return true;
  });

  readonly questionVisual = computed(() => {
    if (this.isReadingPhase()) {
      return null;
    }
    const fromQuestion = presenterQuestionImage(this.question()?.text ?? '');
    if (fromQuestion) {
      return fromQuestion;
    }
    const isFirstQuestion = (this.question()?.order ?? -1) === 0;
    const motif = isFirstQuestion ? this.motifImageUrl()?.trim() : '';
    if (!motif) {
      return null;
    }
    return {
      url: motif,
      alt: $localize`:@@sessionHost.quizMotifImageAlt:Motivbild zum Quiz`,
    };
  });

  readonly matchingLeftOptions = computed(() =>
    (this.question()?.matchingPairs ?? []).map((pair) => ({
      id: pair.leftId,
      text: pair.left,
    })),
  );

  readonly matchingRightOptions = computed(() => {
    const question = this.question();
    if (!question) {
      return [];
    }
    return stableSeededShuffle(
      (question.matchingPairs ?? []).map((pair) => ({
        id: pair.rightId,
        text: pair.right,
      })),
      question.questionId,
      (item) => item.id,
    );
  });

  readonly orderingPreviewItems = computed(() => {
    const question = this.question();
    if (!question) {
      return [];
    }
    return stableSeededShuffle(
      question.orderingItems ?? [],
      question.questionId,
      (item) => item.id,
    );
  });

  readonly categorizationPreviewCategories = computed(() => this.question()?.categories ?? []);

  readonly categorizationPreviewItems = computed(() => {
    const question = this.question();
    if (!question) {
      return [];
    }
    return stableSeededShuffle(
      question.categorizationItems ?? [],
      question.questionId,
      (item) => item.id,
    );
  });

  readonly showsDifficulty = computed(() => {
    const type = this.question()?.type;
    return type !== undefined && type !== 'SURVEY' && type !== 'RATING';
  });

  readonly isLastQuestion = computed(() => {
    const question = this.question();
    return question?.totalQuestions !== undefined && question.order + 1 === question.totalQuestions;
  });

  readonly isSecondRound = computed(() => (this.question()?.currentRound ?? 1) === 2);

  readonly difficultyLabel = computed(() => {
    switch (this.question()?.difficulty) {
      case 'EASY':
        return $localize`:@@quiz.difficulty.easy:Leicht`;
      case 'MEDIUM':
        return $localize`:@@quiz.difficulty.medium:Mittel`;
      case 'HARD':
        return $localize`:@@quiz.difficulty.hard:Schwer`;
      default:
        return '';
    }
  });

  readonly numericRangeHint = computed(() => {
    const question = this.question();
    if (!question || question.type !== 'NUMERIC_ESTIMATE') {
      return null;
    }
    const min = question.numericMin;
    const max = question.numericMax;
    if (min !== undefined && min !== null && max !== undefined && max !== null) {
      return $localize`:@@sessionVote.numericInputRangeBoth:Erlaubte Eingabe: ${min}:min: bis ${max}:max:`;
    }
    if (min !== undefined && min !== null) {
      return $localize`:@@sessionVote.numericInputRangeMin:Erlaubte Eingabe: mindestens ${min}:min:`;
    }
    if (max !== undefined && max !== null) {
      return $localize`:@@sessionVote.numericInputRangeMax:Erlaubte Eingabe: höchstens ${max}:max:`;
    }
    return null;
  });

  readonly numericModeLabel = computed(() => {
    const question = this.question();
    if (!question || question.type !== 'NUMERIC_ESTIMATE') {
      return null;
    }
    if (question.numericInputType === 'INTEGER') {
      return $localize`:@@sessionVote.numericInputModeInteger:Ganzzahl`;
    }
    if (question.numericInputType === 'DECIMAL') {
      return $localize`:@@sessionVote.numericInputModeDecimal:Dezimalzahl`;
    }
    return null;
  });

  readonly numericFormatHint = computed(() => {
    const question = this.question();
    if (!question || question.type !== 'NUMERIC_ESTIMATE') {
      return null;
    }
    if (question.numericInputType === 'INTEGER') {
      return $localize`:@@sessionVote.numericFormatInteger:Gib eine ganze Zahl ohne Nachkommastellen ein.`;
    }
    const maxDecimalPlaces = question.numericDecimalPlaces;
    if (maxDecimalPlaces !== undefined && maxDecimalPlaces !== null) {
      return $localize`:@@sessionVote.numericFormatDecimalPlaces:Komma oder Punkt möglich, maximal ${maxDecimalPlaces}:maxDecimalPlaces: Nachkommastellen.`;
    }
    if (question.numericInputType === 'DECIMAL') {
      return $localize`:@@sessionVote.numericFormatDecimal:Komma oder Punkt möglich.`;
    }
    return null;
  });

  phaseLabel(): string {
    const status = this.status();
    if (status === 'QUESTION_OPEN') {
      return $localize`:@@sessionPresent.quizPhaseReading:Lesephase`;
    }
    if (status === 'ACTIVE') {
      return $localize`:@@sessionPresent.quizPhaseVoting:Abstimmung`;
    }
    if (status === 'DISCUSSION') {
      return $localize`:@@sessionPresent.quizPhaseDiscussion:Diskussion`;
    }
    if (status === 'RESULTS') {
      return $localize`:@@sessionPresent.quizPhaseResults:Ergebnisse`;
    }
    if (status === 'PAUSED') {
      return $localize`:@@sessionPresent.quizPhasePaused:Pausiert`;
    }
    return '';
  }

  onQuestionVisualError(event: Event): void {
    const el = event.target;
    if (el instanceof HTMLElement) {
      el.closest('.session-projection-quiz__visual')?.remove();
    }
  }

  renderMarkdown(value: string, headingStartLevel: 1 | 2 | 3 | 4 | 5 | 6 = 2): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      renderMarkdownWithKatex(value, {
        headingStartLevel,
        imagePolicy: 'external-https-and-app-assets',
        // Labels like „9. November 1918“ must not become a one-item <ol> shown as „1.“.
        escapeListMarkers: headingStartLevel >= 4,
      }).html,
    );
  }

  renderAnswerMarkdown(value: string): SafeHtml {
    const html = renderMarkdownWithKatex(value, {
      headingStartLevel: 4,
      imagePolicy: 'external-https-and-app-assets',
      escapeListMarkers: true,
    }).html;
    const leadingEmoji =
      /(<(?:p|h[1-6])(?:\s[^>]*)?>)(\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)\s+/u;
    return this.sanitizer.bypassSecurityTrustHtml(
      html.replace(
        leadingEmoji,
        '$1<span class="session-projection-quiz__answer-leading-emoji">$2</span>&nbsp;',
      ),
    );
  }

  ratingCount(value: number): number {
    return this.question()?.ratingDistribution?.[String(value)] ?? 0;
  }

  ratingBarPercent(value: number): number {
    const total = this.question()?.ratingCount ?? 0;
    if (total <= 0) {
      return 0;
    }
    return Math.round((this.ratingCount(value) / total) * 100);
  }

  histogramBarPercent(count: number): number {
    return numericHistogramBarPercent(count, this.question()?.numericHistogram ?? []);
  }

  readonly freetextTopAnswers = computed(() => {
    const responses = this.question()?.freeTextResponses ?? [];
    const counts = new Map<string, number>();
    for (const raw of responses) {
      const text = raw.trim();
      if (!text) {
        continue;
      }
      counts.set(text, (counts.get(text) ?? 0) + 1);
    }
    const total = responses.length;
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], this.localeId))
      .slice(0, 8)
      .map(([text, count]) => ({
        text,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
  });

  evaluationHeadline(): string | null {
    const question = this.question();
    if (!this.isResults() || !question) {
      return null;
    }
    if (question.type === 'NUMERIC_ESTIMATE') {
      return null;
    }
    if (question.type === 'MATCHING') {
      return this.structuredCorrectSummary(
        question.matchingStats?.fullyCorrectCount,
        question.matchingStats?.totalVotes ?? question.totalVotes,
      );
    }
    if (question.type === 'ORDERING') {
      return this.structuredCorrectSummary(
        question.orderingStats?.fullyCorrectCount,
        question.orderingStats?.totalVotes ?? question.totalVotes,
      );
    }
    if (question.type === 'CATEGORIZATION') {
      return this.structuredCorrectSummary(
        question.categorizationStats?.fullyCorrectCount,
        question.categorizationStats?.totalVotes ?? question.totalVotes,
      );
    }
    if (question.type === 'FREETEXT') {
      const count = question.freeTextResponses?.length ?? question.totalVotes ?? 0;
      return this.freetextCountLabel(count);
    }
    if (question.type === 'RATING') {
      return this.ratingSubmittedLabel(question.ratingCount ?? 0, this.participantCount());
    }
    if (
      question.correctVoterCount !== undefined &&
      question.correctVoterCount !== null &&
      question.type !== 'SURVEY' &&
      !this.showRoundComparison()
    ) {
      return this.correctAllVotersLabel(question.correctVoterCount, question.totalVotes ?? 0);
    }
    if ((question.totalVotes ?? 0) > 0) {
      return this.votesCastLabel(question.totalVotes ?? 0, this.participantCount());
    }
    return null;
  }

  numericInsightStats(): NumericStatsDTO | null {
    const question = this.question();
    if (!question || question.type !== 'NUMERIC_ESTIMATE') {
      return null;
    }
    return question.numericRoundComparison?.round2Stats ?? question.numericStats ?? null;
  }

  numericRoundComparison(): NumericRoundComparisonDTO | null {
    return this.question()?.numericRoundComparison ?? null;
  }

  numericPrimaryCaption(stats: NumericStatsDTO): string {
    if (stats.median !== null) {
      return $localize`:@@sessionHost.numericPrimaryMedian:Median`;
    }
    if (stats.mean !== null) {
      return $localize`:@@sessionHost.numericPrimaryMean:Mittelwert`;
    }
    return $localize`:@@sessionHost.numericPrimaryResponses:Schätzungen`;
  }

  numericPrimaryValue(stats: NumericStatsDTO): string {
    if (stats.median !== null) {
      return this.formatNumericValue(stats.median);
    }
    if (stats.mean !== null) {
      return this.formatNumericValue(stats.mean);
    }
    return this.formatCount(stats.n);
  }

  numericInBandValue(stats: NumericStatsDTO): string | null {
    if (stats.inBandPercent === null || stats.n <= 0) {
      return null;
    }
    return `${this.formatCount(stats.inBandCount)}/${this.formatCount(stats.n)}`;
  }

  numericInBandCaption(stats: NumericStatsDTO): string | null {
    if (stats.inBandPercent === null || stats.n <= 0) {
      return null;
    }
    return $localize`:@@sessionHost.numericInBandCaption:${formatLocaleNumber(
      stats.inBandPercent,
      this.localeId,
      { maximumFractionDigits: 1 },
    )}:percent: % im akzeptierten Bereich`;
  }

  numericErrorValue(stats: NumericStatsDTO): string | null {
    if (stats.meanAbsoluteError === null) {
      return null;
    }
    return this.formatNumericValue(stats.meanAbsoluteError);
  }

  numericErrorCaption(): string {
    return $localize`:@@sessionHost.numericMeanAbsoluteErrorCaption:Mittlerer Abstand zur Referenz`;
  }

  numericInterpretation(stats: NumericStatsDTO): string | null {
    if (stats.n <= 0) {
      return null;
    }
    const parts: string[] = [];
    if (stats.inBandPercent !== null) {
      parts.push(
        $localize`:@@sessionHost.numericInterpretationSingleInBand:${formatLocaleNumber(
          stats.inBandCount,
          this.localeId,
        )}:inBand: von ${formatLocaleNumber(stats.n, this.localeId)}:total: Schätzungen liegen im Toleranzband.`,
      );
    }
    if (stats.meanAbsoluteError !== null) {
      parts.push(
        $localize`:@@sessionHost.numericInterpretationSingleError:Der mittlere Abstand zur Referenz beträgt ${this.formatNumericValue(
          stats.meanAbsoluteError,
        )}:error:.`,
      );
    } else if (stats.median !== null) {
      parts.push(
        $localize`:@@sessionHost.numericInterpretationSingleMedian:Der Median liegt bei ${this.formatNumericValue(
          stats.median,
        )}:median:.`,
      );
    }
    return parts.length > 0 ? parts.join(' ') : null;
  }

  numericPairedValue(comparison: NumericRoundComparisonDTO): string | null {
    const paired = comparison.pairedAnalysis;
    if (!paired || paired.pairedCount <= 0) {
      return null;
    }
    return `${this.formatCount(paired.closerCount)}/${this.formatCount(paired.pairedCount)}`;
  }

  numericPairedCaption(): string {
    return $localize`:@@sessionHost.numericPairedInsightCaption:näher am Referenzwert`;
  }

  numericReferenceLabel(): string | null {
    const value = this.question()?.numericReferenceValue;
    if (value === null || value === undefined) {
      return null;
    }
    return $localize`:@@sessionPresent.quizNumericReference:Referenz ${this.formatNumericValue(value)}:value:`;
  }

  formatCount(value: number | null | undefined): string {
    return formatLocaleCount(value ?? 0, this.localeId);
  }

  private formatNumericValue(value: number): string {
    const abs = Math.abs(value);
    const maximumFractionDigits = Number.isInteger(value) ? 0 : abs >= 100 ? 1 : 2;
    return formatLocaleNumber(value, this.localeId, { maximumFractionDigits });
  }

  private votesCastLabel(votes: number, participantTotal: number | null | undefined): string {
    const totalStr =
      participantTotal !== undefined && participantTotal !== null
        ? formatLocaleCount(participantTotal, this.localeId)
        : '?';
    const voteCount = formatLocaleCount(votes, this.localeId);
    if (votes === 1) {
      return $localize`:@@sessionHost.votesCastOne:${voteCount}:voteCount: von ${totalStr}:participantTotal: hat abgestimmt`;
    }
    return $localize`:@@sessionHost.votesCastMany:${voteCount}:voteCount: von ${totalStr}:participantTotal: haben abgestimmt`;
  }

  private ratingSubmittedLabel(count: number, participantTotal: number | null | undefined): string {
    const totalStr =
      participantTotal !== undefined && participantTotal !== null
        ? formatLocaleCount(participantTotal, this.localeId)
        : '?';
    const voteCount = formatLocaleCount(count, this.localeId);
    if (count === 1) {
      return $localize`:@@sessionHost.ratingSubmittedOne:${voteCount}:voteCount: von ${totalStr}:participantTotal: hat bewertet`;
    }
    return $localize`:@@sessionHost.ratingSubmittedMany:${voteCount}:voteCount: von ${totalStr}:participantTotal: haben bewertet`;
  }

  private correctAllVotersLabel(correct: number, total: number): string {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return $localize`:@@sessionHost.correctAllVoters:${formatLocaleCount(correct, this.localeId)}:correctCount: von ${formatLocaleCount(total, this.localeId)}:voteTotal: komplett richtig (${formatLocaleCount(pct, this.localeId)}:percentage:\u00a0%)`;
  }

  private structuredCorrectSummary(
    fullyCorrectCount: number | undefined,
    totalVotes: number | undefined,
  ): string | null {
    const correct = fullyCorrectCount ?? 0;
    const total = totalVotes ?? 0;
    if (total <= 0) {
      return null;
    }
    const percent = Math.round((correct / total) * 100);
    return $localize`:@@sessionHost.structuredCorrectSummary:${correct}:correct: von ${total}:total: vollständig korrekt (${percent}:percent:\u00a0%)`;
  }

  private freetextCountLabel(count: number): string {
    if (count === 1) {
      return $localize`:@@sessionPresent.quizFreetextCountOne:${this.formatCount(count)}:count: Antwort`;
    }
    return $localize`:@@sessionPresent.quizFreetextCountMany:${this.formatCount(count)}:count: Antworten`;
  }

  opinionShiftChangedMindLabel(changed: number, both: number, pct: number): string {
    return $localize`:@@sessionHost.opinionShiftChangedMind:${formatLocaleCount(changed, this.localeId)}:changed: von ${formatLocaleCount(both, this.localeId)}:both: (${formatLocaleCount(pct, this.localeId)}:pct:\u00a0%) änderten ihre Meinung`;
  }

  opinionShiftWrongToCorrectLabel(count: number): string {
    return $localize`:@@sessionHost.opinionShiftWrongToCorrect:↑ ${count}:count: falsch → richtig`;
  }

  opinionShiftCorrectToWrongLabel(count: number): string {
    return $localize`:@@sessionHost.opinionShiftCorrectToWrong:↓ ${count}:count: richtig → falsch`;
  }
}
