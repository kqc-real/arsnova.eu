import type {
  ConfidenceResultDTO,
  NumericRoundComparisonDTO,
  NumericStatsDTO,
  QuestionExportEntry,
  SessionExportDTO,
  SessionConfidenceSummaryDTO,
  SessionFeedbackSummary,
} from '@arsnova/shared-types';
import {
  questionSupportsConfidence,
  selectConfidencePriorityQuestions,
} from '@arsnova/shared-types';
import { formatLocaleCount, formatLocaleNumber, formatLocaleScore } from './locale-number.util';
import { stripMarkdownToPlainText } from './markdown-plain-text.util';
import {
  renderExportQuestionHtml,
  EXPORT_REPORT_KATEX_CSS_URL,
  EXPORT_REPORT_HLJS_CSS_URL,
} from './markdown-export.util';
import { questionTypeLabelForReport, type SessionResultsReportLabels } from './labels-de';
import {
  renderConfidenceHeatmapHtml,
  renderConfidenceCategoryListHtml,
  renderConfidenceDistributionBarsHtml,
  renderHistogramHtml,
  renderNumericRoundHistogramsHtml,
  renderStarRatingBarsHtml,
  renderOptionBarsHtml,
  renderPeerInstructionOptionComparisonHtml,
  renderFreetextTopBarsHtml,
} from './session-results-report-charts.util';
import { SESSION_RESULTS_REPORT_STYLES } from './session-results-report-styles';
import { buildSessionResultsPrintPageFooterCss } from './session-results-report-pdf-footer.util';
import {
  questionAnchorId,
  renderCoverSummaryHtml,
  renderCoverBrandHtml,
  renderCoverNavigationHtml,
  renderCoverPrivacyHtml,
  renderQaSectionHtml,
} from './session-results-report-layout.util';
import {
  resolveNumericHistogramOverlayContext,
  formatNumericEstimateValue,
  renderNumericInBandSummaryHtml,
  type NumericHistogramOverlayContext,
} from './numeric-histogram-overlay.util';
import {
  renderDebriefActionPlanHtml,
  renderDistractorAnalysisHtml,
  renderHardestQuestionsHtml,
  renderNextStepsSummaryHtml,
  renderNumericPlainLanguageHtml,
  renderPeerInstructionGainHtml,
  renderNumericPeerGainHtml,
  renderQuestionParticipationNote,
  renderResponseTimeHtml,
  renderSessionParticipationHtml,
  renderTeamLearningProfilesHtml,
} from './session-results-report-insights.util';

export type { SessionResultsReportLabels } from './labels-de';
export {
  getSessionResultsReportLabelsDe,
  getSessionResultsReportLabelsForLocale,
} from './labels-locale.util';

export interface BuildSessionResultsReportOptions {
  localeId?: string;
  generatedAt?: string;
  /** Basis-URL für relative Bilder im Fragentext (z. B. https://arsnova.eu/de). */
  assetBaseUrl?: string;
  /**
   * Seitenzahlen per `@page`-CSS (Browser-Druck).
   * Bei Playwright-PDF `false` lassen — dort übernimmt `footerTemplate`.
   */
  pageNumbersViaCss?: boolean;
  /** Bekannte Sprache des Quiz-Inhalts, z. B. `de` oder `en`. */
  quizContentLocale?: string;
  /** Unterrichtsideen aus Fragentexten aufnehmen; standardmäßig nur im Demo-Export. */
  includeTeachingNotes?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function languageDisplayName(language: string, localeId: string): string {
  try {
    return (
      new Intl.DisplayNames([localeId], { type: 'language' }).of(language.slice(0, 2)) ??
      language.slice(0, 2)
    );
  } catch {
    return language.slice(0, 2);
  }
}

function formatReportDateTime(value: string | Date, localeId: string): string {
  const formatted = new Intl.DateTimeFormat(localeId, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
  return localeId.toLowerCase().startsWith('de') ? `${formatted} Uhr` : formatted;
}

function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function confidenceResponseCount(result: ConfidenceResultDTO): number {
  return Object.values(result.distribution).reduce((sum, value) => sum + value, 0);
}

function confidenceTierCounts(result: ConfidenceResultDTO): {
  low: number;
  mid: number;
  high: number;
} {
  return {
    low: result.distribution['1'] + result.distribution['2'],
    mid: result.distribution['3'],
    high: result.distribution['4'] + result.distribution['5'],
  };
}

function confidenceDistributionDiffers(
  current: ConfidenceResultDTO['distribution'],
  overall: ConfidenceResultDTO['distribution'] | undefined,
): boolean {
  if (!overall) return true;
  const currentTotal = Object.values(current).reduce((sum, value) => sum + value, 0);
  const overallTotal = Object.values(overall).reduce((sum, value) => sum + value, 0);
  if (currentTotal <= 0 || overallTotal <= 0) return false;
  const distance = (['1', '2', '3', '4', '5'] as const).reduce(
    (sum, level) => sum + Math.abs(current[level] / currentTotal - overall[level] / overallTotal),
    0,
  );
  return distance / 2 >= 0.15;
}

/** Kurztitel für Fortsetzungszeilen (ohne Unterrichtsidee-Absätze). */
function questionTitleForReport(question: Pick<QuestionExportEntry, 'questionTextShort'>): string {
  return (
    question.questionTextShort
      .split(/\r?\n/)
      .map((line) => stripMarkdownToPlainText(line).trim())
      .find(
        (line) =>
          line.length > 0 &&
          !/^(unterrichtsidee|teaching idea|idée pédagogique|idea didáctica|idea didattica)\b/i.test(
            line,
          ),
      ) ?? stripMarkdownToPlainText(question.questionTextShort)
  );
}

function questionDisplayHtml(
  q: QuestionExportEntry,
  labels: SessionResultsReportLabels,
  assetBaseUrl?: string,
  includeTeachingNotes = false,
): string {
  return renderExportQuestionHtml(q.questionTextFull ?? q.questionTextShort, {
    assetBaseUrl,
    blockquoteTeachingIdea: labels.blockquoteTeachingIdea,
    blockquoteHint: labels.blockquoteHint,
    includeTeachingNotes,
  });
}

function heatmapLabels(labels: SessionResultsReportLabels) {
  return {
    title: labels.confidenceHeatmapTitle,
    rowCorrect: labels.confidenceRowCorrect,
    rowIncorrect: labels.confidenceRowIncorrect,
    tierLow: labels.confidenceTierLow,
    tierMid: labels.confidenceTierMid,
    tierHigh: labels.confidenceTierHigh,
    cellCountNote: labels.heatmapCellCountNote,
    legendToneTitle: labels.heatmapLegendToneTitle,
    legendToneSuccess: labels.heatmapLegendToneSuccess,
    legendToneRisk: labels.heatmapLegendToneRisk,
    legendToneCaution: labels.heatmapLegendToneCaution,
    legendToneNeutral: labels.heatmapLegendToneNeutral,
    legendToneMid: labels.heatmapLegendToneMid,
    legendFrequencyHint: labels.heatmapLegendFrequencyHint,
    compactLegend: labels.heatmapCompactLegend,
    mastery: labels.confidenceMastery,
    risk: labels.confidenceRisk,
    fragile: labels.confidenceFragile,
    gap: labels.confidenceGap,
    middle: labels.confidenceMiddle,
  };
}

function percentagesThatSumTo100(counts: number[], total: number): number[] {
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((count) => (count / total) * 100);
  const roundedDown = exact.map(Math.floor);
  let remainder = 100 - roundedDown.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (const item of order) {
    if (remainder <= 0) break;
    roundedDown[item.index] = (roundedDown[item.index] ?? 0) + 1;
    remainder -= 1;
  }
  return roundedDown;
}

function aggregationRoundLabel(
  q: Pick<QuestionExportEntry, 'aggregationRound'>,
  labels: SessionResultsReportLabels,
): string {
  if (q.aggregationRound === 2) return labels.aggregationRound2;
  if (q.aggregationRound === 1) return labels.aggregationRound1;
  return '—';
}

function roundContextHtml(
  q: Pick<
    QuestionExportEntry,
    'aggregationRound' | 'round1ParticipantCount' | 'round2ParticipantCount' | 'participantCount'
  >,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  if (q.aggregationRound === 2) {
    const round1Count = q.round1ParticipantCount ?? 0;
    const round2Count = q.round2ParticipantCount ?? q.participantCount;
    if (round1Count > round2Count) {
      return `<p class="report-note">${escapeHtml(
        labels.roundParticipationGapTemplate
          .replace('{0}', formatLocaleCount(round1Count, localeId))
          .replace('{1}', formatLocaleCount(round2Count, localeId)),
      )}</p>`;
    }
    return `<p class="report-note">${escapeHtml(labels.aggregationRound2Context)}</p>`;
  }
  if (q.aggregationRound === 1) {
    return `<p class="report-note">${escapeHtml(labels.aggregationRound1Context)}</p>`;
  }
  return '';
}

function formatNumericStatValue(
  value: number,
  localeId: string,
  numericContext?: NumericHistogramOverlayContext,
): string {
  return numericContext
    ? formatNumericEstimateValue(value, numericContext, localeId, true)
    : formatLocaleScore(value, localeId, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

function numericStatsText(
  stats: NumericStatsDTO,
  localeId: string,
  labels: SessionResultsReportLabels,
  numericContext?: NumericHistogramOverlayContext,
): string {
  const parts: string[] = [
    `${labels.numericComparisonAnswers}: ${formatLocaleCount(stats.n, localeId)}`,
  ];
  if (stats.mean !== null)
    parts.push(
      `${labels.numericComparisonMean}: ${formatNumericStatValue(stats.mean, localeId, numericContext)}`,
    );
  if (stats.median !== null)
    parts.push(
      `${labels.numericComparisonMedian}: ${formatNumericStatValue(stats.median, localeId, numericContext)}`,
    );
  if (stats.stdDev !== null)
    parts.push(
      `${labels.numericComparisonStdDev}: ${formatNumericStatValue(stats.stdDev, localeId, numericContext)}`,
    );
  return parts.join(' · ');
}

function renderNumericRoundComparison(
  comparison: NumericRoundComparisonDTO | undefined,
  localeId: string,
  labels: SessionResultsReportLabels,
  numericContext?: NumericHistogramOverlayContext,
): string {
  if (!comparison || comparison.round2Stats.n <= 0) return '';
  const formatNullable = (value: number | null) =>
    value === null ? '—' : formatNumericStatValue(value, localeId, numericContext);
  const formatPercent = (value: number | null) =>
    value === null ? '—' : `${formatLocaleNumber(value, localeId, { maximumFractionDigits: 1 })} %`;
  const rows = [
    [
      labels.numericComparisonAnswers,
      formatLocaleCount(comparison.round1Stats.n, localeId),
      formatLocaleCount(comparison.round2Stats.n, localeId),
    ],
    [
      labels.numericComparisonMean,
      formatNullable(comparison.round1Stats.mean),
      formatNullable(comparison.round2Stats.mean),
    ],
    [
      labels.numericComparisonMedian,
      formatNullable(comparison.round1Stats.median),
      formatNullable(comparison.round2Stats.median),
    ],
    [
      labels.numericComparisonStdDev,
      formatNullable(comparison.round1Stats.stdDev),
      formatNullable(comparison.round2Stats.stdDev),
    ],
    [
      labels.numericComparisonInBand,
      formatPercent(comparison.round1Stats.inBandPercent),
      formatPercent(comparison.round2Stats.inBandPercent),
    ],
  ];
  const change = comparison.pairedAnalysis
    ? comparison.pairedAnalysis.unchangedCount === comparison.pairedAnalysis.pairedCount
      ? labels.numericNoChangeTemplate
          .replace('{0}', formatLocaleCount(comparison.pairedAnalysis.unchangedCount, localeId))
          .replace('{1}', formatLocaleCount(comparison.pairedAnalysis.pairedCount, localeId))
      : labels.numericChangeTemplate
          .replace('{0}', formatLocaleCount(comparison.pairedAnalysis.closerCount, localeId))
          .replace('{1}', formatLocaleCount(comparison.pairedAnalysis.fartherCount, localeId))
          .replace('{2}', formatLocaleCount(comparison.pairedAnalysis.unchangedCount, localeId))
    : '';
  return `<div class="report-numeric-comparison">
    <h4>${escapeHtml(labels.numericRoundComparisonTitle)}</h4>
    <table class="report-table">
      <thead><tr><th scope="col">${escapeHtml(labels.numericComparisonMetric)}</th><th scope="col">${escapeHtml(labels.aggregationRound1)}</th><th scope="col">${escapeHtml(labels.aggregationRound2)}</th></tr></thead>
      <tbody>${rows
        .map(
          ([label, round1, round2]) =>
            `<tr><th scope="row">${escapeHtml(label ?? '')}</th><td>${escapeHtml(round1 ?? '')}</td><td>${escapeHtml(round2 ?? '')}</td></tr>`,
        )
        .join('')}</tbody>
    </table>
    ${change ? `<p class="report-note">${escapeHtml(change)}</p>` : ''}
  </div>`;
}

function renderOptionBars(
  q: QuestionExportEntry,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  let html = '';
  if (
    q.round1OptionDistribution?.length &&
    q.optionDistribution?.length &&
    q.aggregationRound === 2
  ) {
    html += renderPeerInstructionGainHtml(q.roundComparison, labels, localeId);
    html += renderPeerInstructionOptionComparisonHtml(
      q.round1OptionDistribution.map((option) => ({
        ...option,
        text: stripMarkdownToPlainText(option.text),
      })),
      q.optionDistribution.map((option) => ({
        ...option,
        text: stripMarkdownToPlainText(option.text),
      })),
      labels.piComparisonTitle,
      labels.aggregationRound1,
      labels.aggregationRound2,
      labels.optionCorrect,
      localeId,
    );
  }
  if (q.optionDistribution?.length) {
    const visibleOptions =
      q.type === 'SHORT_TEXT'
        ? q.optionDistribution.filter((option) => option.count > 0)
        : q.optionDistribution;
    if (visibleOptions.length === 0) return html;
    html += renderOptionBarsHtml(
      visibleOptions.map((option) => ({
        ...option,
        text: stripMarkdownToPlainText(option.text),
      })),
      q.type === 'SHORT_TEXT' ? labels.shortTextSubmittedAnswers : labels.optionDistribution,
      { optionCorrect: labels.optionCorrect, optionIncorrect: labels.optionIncorrect },
      localeId,
      q.type === 'MULTIPLE_CHOICE' ? labels.optionDistributionMcNote : undefined,
      q.participantCount,
      labels.optionDistributionValueTemplate,
      q.type === 'MULTIPLE_CHOICE' ? labels.optionDistributionMcRule : undefined,
      q.type === 'MULTIPLE_CHOICE' || q.type === 'SINGLE_CHOICE',
    );
    html += renderDistractorAnalysisHtml(q, labels, localeId);
  }
  return html;
}

function renderConfidenceSection(
  result: ConfidenceResultDTO,
  labels: SessionResultsReportLabels,
  localeId: string,
  overallDistribution?: ConfidenceResultDTO['distribution'],
): string {
  const total = confidenceResponseCount(result);
  const topWrong = result.highConfidenceWrongOptions?.[0];
  const topOmission = result.highConfidenceOmittedCorrectOptions?.[0];
  const wrongCount = topWrong?.count ?? 0;
  const omitCount = topOmission?.count ?? 0;
  let topSignalNote = '';

  const useCombined =
    result.highConfidenceWrongCount > 0 &&
    topOmission &&
    topWrong &&
    omitCount >= 2 &&
    wrongCount >= 2 &&
    omitCount >= wrongCount;

  if (useCombined && topOmission && topWrong) {
    const omissionText = stripMarkdownToPlainText(topOmission.text);
    const wrongText = stripMarkdownToPlainText(topWrong.text);
    const signal =
      omitCount >= result.highConfidenceWrongCount
        ? labels.confidenceMcCombinedAllOmittedTemplate
            .replace('{0}', formatLocaleCount(result.highConfidenceWrongCount, localeId))
            .replace('{1}', omissionText)
            .replace('{2}', formatLocaleCount(wrongCount, localeId))
            .replace('{3}', wrongText)
        : labels.confidenceOmissionSignalTemplate
            .replace('{0}', omissionText)
            .replace('{1}', formatLocaleCount(result.highConfidenceWrongCount, localeId))
            .replace('{2}', formatLocaleCount(omitCount, localeId)) +
          ' ' +
          labels.confidenceTopSignalTemplate
            .replace('{0}', wrongText)
            .replace('{1}', formatLocaleCount(wrongCount, localeId));
    topSignalNote = `<aside class="report-top-signal"><strong>${escapeHtml(labels.confidenceTopSignal)}</strong><span>${escapeHtml(
      signal,
    )}</span><p>${escapeHtml(
      labels.confidenceMcCombinedActionTemplate
        .replace('{0}', omissionText)
        .replace('{1}', wrongText),
    )}</p></aside>`;
  } else if (topOmission && omitCount >= wrongCount && result.highConfidenceWrongCount > 0) {
    const omissionText = stripMarkdownToPlainText(topOmission.text);
    topSignalNote = `<aside class="report-top-signal"><strong>${escapeHtml(labels.confidenceTopSignal)}</strong><span>${escapeHtml(
      labels.confidenceOmissionSignalTemplate
        .replace('{0}', omissionText)
        .replace('{1}', formatLocaleCount(result.highConfidenceWrongCount, localeId))
        .replace('{2}', formatLocaleCount(topOmission.count, localeId)),
    )}</span><p>${escapeHtml(labels.confidenceOmissionActionTemplate.replace('{0}', omissionText))}</p></aside>`;
  } else if (topWrong) {
    const topWrongText = stripMarkdownToPlainText(topWrong.text);
    topSignalNote = `<aside class="report-top-signal"><strong>${escapeHtml(labels.confidenceTopSignal)}</strong><span>${escapeHtml(
      labels.confidenceTopSignalTemplate
        .replace('{0}', topWrongText)
        .replace('{1}', formatLocaleCount(topWrong.count, localeId)),
    )}</span><p>${escapeHtml(labels.confidenceActionRecommendationTemplate.replace('{0}', topWrongText))}</p></aside>`;
  } else if (result.highConfidenceWrongCount > 0) {
    topSignalNote = `<aside class="report-top-signal"><strong>${escapeHtml(labels.confidenceTopSignal)}</strong><span>${escapeHtml(
      labels.confidenceHighWrongGenericTemplate.replace(
        '{0}',
        formatLocaleCount(result.highConfidenceWrongCount, localeId),
      ),
    )}</span></aside>`;
  }

  const tierCounts = confidenceTierCounts(result);
  const highOnly =
    total > 0 &&
    tierCounts.high === total &&
    result.crossTab.incorrectHigh === total &&
    result.crossTab.correctHigh === 0;
  if (highOnly) {
    return `<h4>${escapeHtml(labels.confidenceSection)} <span class="report-badge">${escapeHtml(labels.confidenceN)}: ${formatLocaleCount(total, localeId)}</span></h4>
      <div class="report-confidence-degenerate">
        <p><strong>${escapeHtml(
          labels.confidenceDegenerateAllHighWrongTemplate.replace(
            '{0}',
            formatLocaleCount(total, localeId),
          ),
        )}</strong></p>
        <p><strong>${escapeHtml(
          labels.confidenceDegenerateAllHighWrongResult.replace(
            '{0}',
            formatLocaleCount(total, localeId),
          ),
        )}</strong></p>
      </div>
      ${renderConfidenceHeatmapHtml(result.crossTab, heatmapLabels(labels), localeId, 'compact')}
      ${topSignalNote}`;
  }

  const distribution = confidenceDistributionDiffers(result.distribution, overallDistribution)
    ? renderConfidenceDistributionBarsHtml(
        result,
        labels.confidenceDistributionTitle,
        localeId,
        labels.confidenceScaleEndpoints,
        labels.confidenceDistributionAxis,
      )
    : `<p class="report-confidence-distribution-compact">${escapeHtml(
        labels.confidenceCompactDistributionTemplate
          .replace('{0}', formatLocaleCount(tierCounts.low, localeId))
          .replace('{1}', formatLocaleCount(tierCounts.mid, localeId))
          .replace('{2}', formatLocaleCount(tierCounts.high, localeId)),
      )}</p>`;
  const charts = `<div class="report-chart-grid">
    ${renderConfidenceHeatmapHtml(result.crossTab, heatmapLabels(labels), localeId, 'compact')}
    ${distribution}
  </div>`;
  return `<h4>${escapeHtml(labels.confidenceSection)} <span class="report-badge">${escapeHtml(labels.confidenceN)}: ${formatLocaleCount(total, localeId)}</span></h4>${charts}${topSignalNote}`;
}

function renderQuestion(
  q: QuestionExportEntry,
  labels: SessionResultsReportLabels,
  localeId: string,
  questionTotal: number,
  priorityQuestionOrders: ReadonlySet<number>,
  sessionParticipantCount: number,
  overallConfidenceDistribution?: ConfidenceResultDTO['distribution'],
  assetBaseUrl?: string,
  includeTeachingNotes = false,
): string {
  const typeLabel = questionTypeLabelForReport(q.type, labels);
  const roundLabel = q.aggregationRound ? aggregationRoundLabel(q, labels) : null;
  const kicker = `<div class="report-question-kicker">
    <span class="report-question-index">${escapeHtml(
      labels.questionOfTotal
        .replace('{0}', String(q.questionOrder + 1))
        .replace('{1}', String(questionTotal)),
    )}</span>
    <span class="report-badge">${escapeHtml(typeLabel)}</span>
    ${roundLabel ? `<span class="report-badge report-badge--round">${escapeHtml(roundLabel)}</span>` : ''}
    <span class="report-badge">${escapeHtml(labels.questionParticipants)}: ${formatLocaleCount(q.participantCount, localeId)}</span>
  </div>`;

  const numericOverlay =
    q.type === 'NUMERIC_ESTIMATE' ? resolveNumericHistogramOverlayContext(q) : undefined;
  const hasCodeBlock = /```/.test(q.questionTextFull ?? '');
  const nextQuestion =
    q.questionOrder > 0
      ? `<div class="report-next-question">${escapeHtml(labels.nextQuestion)}</div>`
      : '';

  let body = renderOptionBars(q, labels, localeId);
  body = renderQuestionParticipationNote(q, sessionParticipantCount, labels, localeId) + body;

  if (q.freetextAggregates?.length) {
    body += renderFreetextTopBarsHtml(
      q.freetextAggregates.map((entry) => ({
        ...entry,
        text: stripMarkdownToPlainText(entry.text),
      })),
      labels.freetextResponses,
      labels.freetextMoreTemplate,
      localeId,
    );
  }

  if (q.shortTextSolutions?.length) {
    body += `<h4>${escapeHtml(labels.shortTextExpectedSolutions)}</h4><ul class="report-list">${q.shortTextSolutions
      .map((solution) => `<li>${escapeHtml(stripMarkdownToPlainText(solution))}</li>`)
      .join('')}</ul>`;
  }

  if (q.correctCount !== undefined || q.incorrectCount !== undefined) {
    const correctnessTotal = (q.correctCount ?? 0) + (q.incorrectCount ?? 0);
    const correctnessLabel =
      q.type === 'MULTIPLE_CHOICE' ? labels.multipleChoiceFullyCorrect : labels.shortTextCorrect;
    body += `<p class="report-correctness-summary"><strong>${escapeHtml(correctnessLabel)}:</strong> ${escapeHtml(
      labels.countOfTemplate
        .replace('{0}', formatLocaleCount(q.correctCount ?? 0, localeId))
        .replace('{1}', formatLocaleCount(correctnessTotal, localeId)),
    )} · ${percent(q.correctCount ?? 0, correctnessTotal)} %</p>`;
    if (q.shortTextIncorrectAggregates?.length) {
      const totalGraded = (q.correctCount ?? 0) + (q.incorrectCount ?? 0);
      const ranked = [...q.shortTextIncorrectAggregates]
        .sort((left, right) => right.count - left.count || left.text.localeCompare(right.text))
        .slice(0, 5);
      body += `<div class="report-shorttext-incorrect">
        <h4>${escapeHtml(labels.shortTextIncorrectHeading)}</h4>
        <ol class="report-list report-list--ranked">${ranked
          .map(
            (entry) =>
              `<li>${escapeHtml(
                labels.shortTextIncorrectItemTemplate
                  .replace('{0}', stripMarkdownToPlainText(entry.text))
                  .replace('{1}', formatLocaleCount(entry.count, localeId))
                  .replace('{2}', formatLocaleCount(totalGraded, localeId)),
              )}</li>`,
          )
          .join('')}</ol>
      </div>`;
    }
  }

  if (q.ratingDistribution) {
    body += renderStarRatingBarsHtml(
      q.ratingDistribution,
      labels.ratingDistribution,
      localeId,
      q.ratingAverage,
      q.ratingStandardDeviation,
      labels.ratingScaleEndpoints,
    );
  }

  if (q.numericStats) {
    const hasRound2 = (q.numericRoundComparison?.round2Stats.n ?? 0) > 0;
    if (!hasRound2) {
      body += `<h4>${escapeHtml(labels.numericStats)}</h4><p>${escapeHtml(numericStatsText(q.numericStats, localeId, labels, numericOverlay))}</p>`;
      if (numericOverlay) {
        body += renderNumericInBandSummaryHtml(q.numericStats, numericOverlay, labels, localeId);
        body += renderNumericPlainLanguageHtml(q.numericStats, labels, localeId, (value) =>
          formatNumericEstimateValue(value, numericOverlay, localeId, true),
        );
      }
    } else {
      body += renderNumericPeerGainHtml(q.numericRoundComparison, labels, localeId);
    }
    const comparison = renderNumericRoundComparison(
      q.numericRoundComparison,
      localeId,
      labels,
      numericOverlay,
    );
    if (comparison) body += comparison;
    if (q.numericHistogram?.length && !hasRound2) {
      body += renderHistogramHtml(
        q.numericHistogram,
        labels.numericHistogramTitle,
        localeId,
        undefined,
        numericOverlay,
        labels,
        { secondary: true },
      );
    }
    body += renderNumericRoundHistogramsHtml(
      q.numericRoundComparison,
      q.numericHistogram,
      {
        round1: labels.numericRound1Histogram,
        round2: labels.numericRound2Histogram,
        delta: labels.numericDeltaHistogram,
        identical: labels.numericIdenticalHistogram,
        identicalNote: labels.numericIdenticalDistributions,
      },
      localeId,
      numericOverlay,
      labels,
    );
  }

  body += renderResponseTimeHtml(q, labels, localeId);

  if (q.confidenceResult) {
    const confidence = renderConfidenceSection(
      q.confidenceResult,
      labels,
      localeId,
      overallConfidenceDistribution,
    );
    body += `<section class="report-confidence-continuation">${confidence}</section>`;
  } else {
    const reason = !questionSupportsConfidence(q.type)
      ? labels.confidenceNotSupportedForQuestion
      : q.confidenceEnabled === false
        ? labels.confidenceDisabledForQuestion
        : labels.confidenceNotCollectedForQuestion;
    body = body
      ? `<div class="report-question-result-group">${body}<p class="report-note report-confidence-not-collected">${escapeHtml(reason)}</p></div>`
      : `<p class="report-note report-confidence-not-collected">${escapeHtml(reason)}</p>`;
  }

  const questionClasses = [
    'report-question',
    priorityQuestionOrders.has(q.questionOrder) ? 'report-question--priority' : '',
    hasCodeBlock ? 'report-question--code' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const continuation = labels.questionContinuationTemplate
    .replace('{0}', String(q.questionOrder + 1))
    .replace('{1}', questionTitleForReport(q));
  const textHtml = `<div class="report-question-text markdown-body">${questionDisplayHtml(q, labels, assetBaseUrl, includeTeachingNotes)}</div>`;
  const bodyHtml = body ? `<div class="report-question-body">${body}</div>` : '';
  /**
   * Fortsetzungszeile: nur Marker im DOM (für PDF-Nachbearbeitung).
   * Kein thead-Repeat — vermeidet verwaiste/erste-Seiten-„Fortsetzung“ und
   * hält die Lesereihenfolge strikt an der visuellen DOM-Reihenfolge.
   */
  return `<article class="${questionClasses}" id="${questionAnchorId(q.questionOrder)}" data-continuation="${escapeHtml(continuation)}">
    <div class="report-question-head">
      ${nextQuestion}
      ${kicker}
      ${roundContextHtml(q, labels, localeId)}
    </div>
    <div class="report-question-keep-start">${textHtml}</div>
    ${bodyHtml}
  </article>`;
}

function renderFeedbackSummary(
  feedback: SessionFeedbackSummary,
  labels: SessionResultsReportLabels,
  localeId: string,
  sessionParticipantCount: number,
): string {
  const overallBars = renderStarRatingBarsHtml(
    feedback.overallDistribution,
    labels.feedbackOverall,
    localeId,
    feedback.overallAverage,
  );
  const rate =
    sessionParticipantCount > 0
      ? Math.round((feedback.totalResponses / sessionParticipantCount) * 100)
      : 0;
  const positiveOverall =
    (feedback.overallDistribution['4'] ?? 0) + (feedback.overallDistribution['5'] ?? 0);
  const positiveOverallPct =
    feedback.totalResponses > 0 ? Math.round((positiveOverall / feedback.totalResponses) * 100) : 0;
  const lowOverall =
    (feedback.overallDistribution['1'] ?? 0) + (feedback.overallDistribution['2'] ?? 0);
  let details = `<p class="report-coverage">${escapeHtml(
    labels.feedbackCoverageCompactTemplate
      .replace('{0}', formatLocaleCount(feedback.totalResponses, localeId))
      .replace('{1}', formatLocaleCount(rate, localeId)),
  )}</p>`;
  details += `<p class="report-feedback-highlight">${escapeHtml(
    labels.feedbackOverallHighlightTemplate.replace(
      '{0}',
      formatLocaleCount(positiveOverallPct, localeId),
    ),
  )}${
    lowOverall === 0 && feedback.totalResponses > 0
      ? ` ${escapeHtml(labels.feedbackNoLowStarsNote)}`
      : ''
  }</p>`;
  if (feedback.questionQualityAverage !== null && feedback.questionQualityDistribution) {
    const positiveQuality =
      (feedback.questionQualityDistribution['4'] ?? 0) +
      (feedback.questionQualityDistribution['5'] ?? 0);
    const qualityTotal = Object.values(feedback.questionQualityDistribution).reduce(
      (sum, count) => sum + count,
      0,
    );
    const positiveQualityPct =
      qualityTotal > 0 ? Math.round((positiveQuality / qualityTotal) * 100) : 0;
    details += renderStarRatingBarsHtml(
      feedback.questionQualityDistribution,
      labels.feedbackQuestionQuality,
      localeId,
      feedback.questionQualityAverage,
    );
    details += `<p class="report-feedback-highlight">${escapeHtml(
      labels.feedbackQualityHighlightTemplate.replace(
        '{0}',
        formatLocaleCount(positiveQualityPct, localeId),
      ),
    )}</p>`;
  }
  const repeatTotal = feedback.wouldRepeatYes + feedback.wouldRepeatNo;
  if (repeatTotal > 0) {
    const repeatShare = Math.round((feedback.wouldRepeatYes / repeatTotal) * 100);
    details += `<p>${escapeHtml(
      labels.feedbackWouldRepeatSummaryTemplate
        .replace('{0}', formatLocaleCount(feedback.wouldRepeatYes, localeId))
        .replace('{1}', formatLocaleCount(repeatTotal, localeId))
        .replace('{2}', formatLocaleCount(repeatShare, localeId)),
    )}</p>`;
  }
  return `<section class="report-section report-feedback" id="report-feedback">
    <h2>${escapeHtml(labels.feedbackTitle)}</h2>
    ${overallBars}
    ${details}
  </section>`;
}

function renderConfidenceReadingGuide(labels: SessionResultsReportLabels): string {
  return `<aside class="report-confidence-reading-guide">
    <h3>${escapeHtml(labels.confidenceReadingGuideTitle)}</h3>
    <p>${escapeHtml(labels.confidenceReadingGuideScale)}</p>
    <p class="report-confidence-symbol-guide">${escapeHtml(labels.heatmapCompactLegend)}</p>
  </aside>`;
}

function renderConfidenceSummary(
  summary: SessionConfidenceSummaryDTO,
  questions: QuestionExportEntry[],
  participantCount: number,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const total = summary.responseCount;
  const signalQuestionCount =
    summary.signalQuestionCount ??
    summary.questions.filter((question) => question.result.crossTab.incorrectHigh > 0).length;
  const middle = summary.crossTab.correctMid + summary.crossTab.incorrectMid;
  const metricCounts = [
    summary.crossTab.correctHigh,
    summary.crossTab.incorrectHigh,
    summary.crossTab.correctLow,
    summary.crossTab.incorrectLow,
    middle,
  ];
  const metricPercents = percentagesThatSumTo100(metricCounts, total);

  const metrics = `<p class="report-metrics-basis">${escapeHtml(
    labels.confidenceMetricsBasisTemplate.replace('{0}', formatLocaleCount(total, localeId)),
  )}</p><div class="report-metrics report-metrics--five">
    <div class="report-metric report-metric--success"><strong>${metricPercents[0]} %</strong><span>${escapeHtml(labels.confidenceMastery)}</span></div>
    <div class="report-metric report-metric--risk"><strong>${metricPercents[1]} %</strong><span>${escapeHtml(labels.confidenceRisk)}</span></div>
    <div class="report-metric report-metric--fragile"><strong>${metricPercents[2]} %</strong><span>${escapeHtml(labels.confidenceFragile)}</span></div>
    <div class="report-metric report-metric--gap"><strong>${metricPercents[3]} %</strong><span>${escapeHtml(labels.confidenceGap)}</span></div>
    <div class="report-metric report-metric--middle"><strong>${metricPercents[4]} %</strong><span>${escapeHtml(labels.confidenceMiddle)}</span></div>
  </div>`;
  const masteryZeroNote =
    metricPercents[0] === 0 &&
    summary.crossTab.correctHigh === 0 &&
    summary.crossTab.correctMid + summary.crossTab.correctLow > 0
      ? `<p class="report-note">${escapeHtml(labels.confidenceMasteryZeroNote)}</p>`
      : '';

  const withoutConfidence = questions.filter((question) => !question.confidenceResult);
  const unsupportedQuestions = withoutConfidence.filter(
    (question) => !questionSupportsConfidence(question.type),
  );
  const disabledQuestions = withoutConfidence.filter(
    (question) => questionSupportsConfidence(question.type) && question.confidenceEnabled === false,
  );
  const notCollectedQuestions = withoutConfidence.filter(
    (question) => questionSupportsConfidence(question.type) && question.confidenceEnabled !== false,
  );
  const questionList = (entries: QuestionExportEntry[]) =>
    entries
      .map(
        (question) =>
          `${labels.questionNumber} ${question.questionOrder + 1} (${questionTypeLabelForReport(question.type, labels)})`,
      )
      .join(', ');
  const coverageLead = labels.confidenceCoverageTemplate
    .replace('{0}', formatLocaleCount(summary.includedQuestionCount, localeId))
    .replace('{1}', formatLocaleCount(questions.length, localeId))
    .replace('{2}', formatLocaleCount(total, localeId));
  const formula =
    summary.includedQuestionCount * participantCount === total
      ? labels.confidenceCoverageFormulaTemplate
          .replace('{0}', formatLocaleCount(summary.includedQuestionCount, localeId))
          .replace('{1}', formatLocaleCount(participantCount, localeId))
          .replace('{2}', formatLocaleCount(total, localeId))
      : '';
  const missingReasons = [
    unsupportedQuestions.length > 0
      ? labels.confidenceNotSupportedTemplate.replace('{0}', questionList(unsupportedQuestions))
      : '',
    disabledQuestions.length > 0
      ? labels.confidenceDisabledTemplate.replace('{0}', questionList(disabledQuestions))
      : '',
    notCollectedQuestions.length > 0
      ? labels.confidenceNotCollectedTemplate.replace('{0}', questionList(notCollectedQuestions))
      : '',
  ].filter(Boolean);
  const coverage = `<div class="report-coverage">
    <p>${escapeHtml(coverageLead)}</p>
    ${formula ? `<p>${escapeHtml(formula)}</p>` : ''}
    ${missingReasons.map((reason) => `<p>${escapeHtml(reason)}</p>`).join('')}
    ${summary.suppressedQuestionCount > 0 ? `<p>${escapeHtml(labels.confidenceSuppressedQuestions)}: ${formatLocaleCount(summary.suppressedQuestionCount, localeId)}</p>` : ''}
  </div>`;

  const aggregateCharts = `<div class="report-chart-grid">
    ${renderConfidenceCategoryListHtml(summary.crossTab, heatmapLabels(labels), localeId)}
    ${renderConfidenceDistributionBarsHtml(
      {
        distribution: summary.distribution,
        crossTab: summary.crossTab,
        highConfidenceWrongCount: summary.highConfidenceWrongCount,
      },
      labels.confidenceDistributionTitle,
      localeId,
      labels.confidenceScaleEndpoints,
      labels.confidenceDistributionAxis,
    )}
  </div>`;

  // Priorisierte Fragen stehen bereits handlungsleitend auf der Titelseite.
  const priorities = '';

  const alert =
    summary.priorityQuestionCount > 0
      ? `<p class="report-alert">${escapeHtml(
          labels.confidencePriorityRuleTemplate.replace(
            '{0}',
            formatLocaleCount(summary.priorityQuestionCount, localeId),
          ),
        )}</p>`
      : signalQuestionCount > 0
        ? `<p class="report-note">${escapeHtml(
            labels.confidenceSignalRuleTemplate.replace(
              '{0}',
              formatLocaleCount(signalQuestionCount, localeId),
            ),
          )}</p>`
        : '';

  return `<section class="report-section report-confidence" id="report-confidence">
    <h2>${escapeHtml(labels.confidenceTitle)}</h2>
    <p class="report-lead">${escapeHtml(labels.confidenceLead)}</p>
    ${alert}
    ${renderConfidenceReadingGuide(labels)}
    ${metrics}
    ${masteryZeroNote}
    ${coverage}
    ${aggregateCharts}
    ${priorities}
  </section>`;
}

export function buildSessionResultsReportHtml(
  data: SessionExportDTO,
  labels: SessionResultsReportLabels,
  options: BuildSessionResultsReportOptions = {},
): string {
  const localeId = options.localeId ?? 'de';
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const finishedAt = formatReportDateTime(data.finishedAt, localeId);
  const questionTotal = data.questions.length;
  const assetBaseUrl = options.assetBaseUrl;
  const reportLanguage = languageDisplayName(localeId, localeId);
  const quizContentLanguage = options.quizContentLocale
    ? languageDisplayName(options.quizContentLocale, localeId)
    : null;
  const priorityQuestionOrders = new Set(
    data.confidenceSummary
      ? selectConfidencePriorityQuestions(
          data.confidenceSummary.questions,
          data.confidenceSummary.questions.length,
        ).map((question) => question.questionOrder)
      : [],
  );
  const printPageFooterCss = options.pageNumbersViaCss
    ? buildSessionResultsPrintPageFooterCss(labels)
    : '';

  const feedbackHtml = data.feedbackSummary
    ? renderFeedbackSummary(data.feedbackSummary, labels, localeId, data.participantCount)
    : '';

  const confidenceHtml = data.confidenceSummary
    ? renderConfidenceSummary(
        data.confidenceSummary,
        data.questions,
        data.participantCount,
        labels,
        localeId,
      )
    : '';

  const questionsHtml = data.questions
    .map((question) =>
      renderQuestion(
        question,
        labels,
        localeId,
        questionTotal,
        priorityQuestionOrders,
        data.participantCount,
        data.confidenceSummary?.distribution,
        assetBaseUrl,
        options.includeTeachingNotes ?? false,
      ),
    )
    .join('');

  const coverNavHtml = renderCoverNavigationHtml(data, labels);
  const coverSummaryHtml = renderCoverSummaryHtml(data, labels, localeId);
  const actionPlanHtml = renderDebriefActionPlanHtml(data, labels);
  const hardestHtml = renderHardestQuestionsHtml(data, labels, localeId);
  const participationHtml = renderSessionParticipationHtml(data, labels, localeId);
  const finalSummaryHtml = renderNextStepsSummaryHtml(data, labels);
  const qaHtml = data.qaQuestions?.length
    ? renderQaSectionHtml(data.qaQuestions, labels, localeId)
    : '';
  const teamLearningHtml = renderTeamLearningProfilesHtml(data, labels, localeId);
  const footerMeta = labels.exportFooterMeta
    .replace('{0}', formatReportDateTime(generatedAt, localeId))
    .replace('{1}', data.sessionCode);

  let teamHtml = '';
  if (data.teamMode && data.teamLeaderboard?.length) {
    teamHtml = `<section class="report-section" id="report-teams">
      <h2>${escapeHtml(labels.teamLeaderboardTitle)}</h2>
      <p class="report-note">${escapeHtml(labels.scoreExplanation)}</p>
      <table class="report-table">
        <caption>${escapeHtml(labels.teamScoreExplanation)}</caption>
        <thead><tr>
          <th scope="col">${escapeHtml(labels.teamRank)}</th>
          <th scope="col">${escapeHtml(labels.teamName)}</th>
          <th scope="col">${escapeHtml(labels.teamMembers)}</th>
          <th scope="col">${escapeHtml(labels.teamTotalScore)}</th>
        </tr></thead>
        <tbody>${data.teamLeaderboard
          .map(
            (team) => `<tr>
              <td>${team.rank}</td>
              <td>${escapeHtml(team.teamName)}</td>
              <td>${formatLocaleCount(team.memberCount, localeId)}</td>
              <td>${formatLocaleNumber(team.totalScore, localeId, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}</td>
            </tr>`,
          )
          .join('')}</tbody>
      </table>
    </section>`;
  }

  let bonusHtml = '';
  if (data.bonusTokens?.length) {
    const hasTiedScores = data.bonusTokens.some((token, index) =>
      data.bonusTokens!.some(
        (other, otherIndex) =>
          index !== otherIndex &&
          other.totalScore === token.totalScore &&
          other.rank !== token.rank,
      ),
    );
    bonusHtml = `<section class="report-section" id="report-bonus">
      <h2>${escapeHtml(labels.bonusCodesTitle)}</h2>
      <p class="report-note">${escapeHtml(labels.bonusCodesNotice)}</p>
      ${!teamHtml ? `<p class="report-note">${escapeHtml(labels.scoreExplanation)}</p>` : ''}
      ${hasTiedScores ? `<p class="report-note">${escapeHtml(labels.bonusScoreTieNote)}</p>` : ''}
      <table class="report-table">
        <thead><tr>
          <th scope="col">${escapeHtml(labels.bonusRank)}</th>
          <th scope="col">${escapeHtml(labels.bonusNickname)}</th>
          <th scope="col">${escapeHtml(labels.bonusCode)}</th>
          <th scope="col">${escapeHtml(labels.bonusScore)}</th>
          <th scope="col">${escapeHtml(labels.bonusGeneratedAt)}</th>
        </tr></thead>
        <tbody>${data.bonusTokens
          .map(
            (token) => `<tr>
              <td>${token.rank}</td>
              <td>${escapeHtml(token.nickname)}</td>
              <td>${escapeHtml(token.token)}</td>
              <td>${formatLocaleNumber(token.totalScore, localeId, { maximumFractionDigits: 0 })}</td>
              <td>${escapeHtml(formatReportDateTime(token.generatedAt, localeId))}</td>
            </tr>`,
          )
          .join('')}</tbody>
      </table>
    </section>`;
  }

  return `<!DOCTYPE html>
<html lang="${escapeHtml(localeId.slice(0, 2))}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.documentTitle)} — ${escapeHtml(data.quizName)}</title>
  <link rel="stylesheet" href="${EXPORT_REPORT_KATEX_CSS_URL}" crossorigin="anonymous" />
  <link rel="stylesheet" href="${EXPORT_REPORT_HLJS_CSS_URL}" crossorigin="anonymous" />
  <style>${SESSION_RESULTS_REPORT_STYLES}${printPageFooterCss}</style>
</head>
<body>
  <section class="report-cover">
    <div class="report-cover-page">
      ${renderCoverBrandHtml()}
      <h1>${escapeHtml(labels.coverTitle)}</h1>
      <p class="report-cover-subtitle">${escapeHtml(labels.coverSubtitle)}</p>
      ${coverSummaryHtml}
      ${actionPlanHtml}
      <dl class="report-cover-meta">
        <div><dt>${escapeHtml(labels.quizName)}</dt><dd>${escapeHtml(data.quizName)}</dd></div>
        <div><dt>${escapeHtml(labels.sessionCode)}</dt><dd>${escapeHtml(data.sessionCode)}</dd></div>
        <div><dt>${escapeHtml(labels.finishedAt)}</dt><dd>${escapeHtml(finishedAt)}</dd></div>
        <div><dt>${escapeHtml(labels.participantCount)}</dt><dd>${formatLocaleCount(data.participantCount, localeId)}</dd></div>
        <div><dt>${escapeHtml(labels.reportLanguage)}</dt><dd>${escapeHtml(reportLanguage)}</dd></div>
        ${quizContentLanguage ? `<div><dt>${escapeHtml(labels.quizContentLanguage)}</dt><dd>${escapeHtml(quizContentLanguage)}</dd></div>` : ''}
      </dl>
    </div>
    <div class="report-cover-continued">
      ${hardestHtml}
      ${participationHtml}
      ${coverNavHtml}
      ${renderCoverPrivacyHtml(labels)}
    </div>
  </section>
  ${confidenceHtml}
  <section class="report-section report-section--questions" id="report-questions">
    <h2>${escapeHtml(labels.questionsTitle)}</h2>
    <div class="report-questions">${questionsHtml}</div>
  </section>
  ${qaHtml}
  ${finalSummaryHtml}
  ${feedbackHtml}
  ${teamHtml}
  ${teamLearningHtml}
  ${bonusHtml}
  <footer class="report-footer">${escapeHtml(labels.generatedBy)} · ${escapeHtml(footerMeta)}</footer>
</body>
</html>`;
}

export function buildSessionResultsPdfFilename(quizTitle: string, sessionCode: string): string {
  const sanitize = (value: string, fallback: string) => {
    const normalized = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return normalized || fallback;
  };
  return `arsnova-results-${sanitize(quizTitle, 'quiz')}-${sanitize(sessionCode, 'session')}.pdf`;
}
