import type {
  ConfidenceQuestionSummaryDTO,
  ConfidenceResultDTO,
  NumericRoundComparisonDTO,
  NumericStatsDTO,
  QuestionExportEntry,
  SessionExportDTO,
  SessionConfidenceSummaryDTO,
  SessionFeedbackSummary,
} from '@arsnova/shared-types';
import { formatLocaleCount, formatLocaleNumber } from './locale-number.util';
import { stripMarkdownToPlainText } from './markdown-plain-text.util';
import {
  renderExportQuestionHtml,
  EXPORT_REPORT_KATEX_CSS_URL,
  EXPORT_REPORT_HLJS_CSS_URL,
} from './markdown-export.util';
import { questionTypeLabelForReport, type SessionResultsReportLabels } from './labels-de';
import {
  renderConfidenceHeatmapHtml,
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
  priorityQuestionJumpLink,
} from './session-results-report-layout.util';
import { resolveNumericHistogramOverlayContext } from './numeric-histogram-overlay.util';

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
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function percent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function formatPercentMetric(count: number, total: number, localeId: string): string {
  return `${formatLocaleCount(count, localeId)} (${percent(count, total)} %)`;
}

function confidenceResponseCount(result: ConfidenceResultDTO): number {
  return Object.values(result.distribution).reduce((sum, value) => sum + value, 0);
}

function incorrectCount(question: ConfidenceQuestionSummaryDTO): number {
  const crossTab = question.result.crossTab;
  return crossTab.incorrectHigh + crossTab.incorrectMid + crossTab.incorrectLow;
}

function questionDisplayHtml(
  q: QuestionExportEntry,
  labels: SessionResultsReportLabels,
  assetBaseUrl?: string,
): string {
  return renderExportQuestionHtml(q.questionTextFull ?? q.questionTextShort, {
    assetBaseUrl,
    blockquoteTeachingIdea: labels.blockquoteTeachingIdea,
    blockquoteHint: labels.blockquoteHint,
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
    legendTitle: labels.heatmapLegendTitle,
    legendScale: labels.heatmapLegendScale,
    legendHint: labels.heatmapLegendHint,
  };
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

function numericStatsText(stats: NumericStatsDTO, localeId: string): string {
  const parts: string[] = [`n=${formatLocaleCount(stats.n, localeId)}`];
  if (stats.mean !== null) parts.push(`Ø ${formatLocaleNumber(stats.mean, localeId)}`);
  if (stats.median !== null) parts.push(`Median ${formatLocaleNumber(stats.median, localeId)}`);
  if (stats.stdDev !== null) parts.push(`σ ${formatLocaleNumber(stats.stdDev, localeId)}`);
  return parts.join(' · ');
}

function numericRoundComparisonText(
  comparison: NumericRoundComparisonDTO | undefined,
  localeId: string,
): string {
  if (!comparison) return '';
  const parts = [
    `R1: ${numericStatsText(comparison.round1Stats, localeId)}`,
    `R2: ${numericStatsText(comparison.round2Stats, localeId)}`,
  ];
  if (comparison.meanDelta !== null && comparison.meanDelta !== undefined) {
    parts.push(`Δ Ø ${formatLocaleNumber(comparison.meanDelta, localeId)}`);
  }
  if (comparison.pairedAnalysis) {
    const p = comparison.pairedAnalysis;
    parts.push(
      `Paare ${p.pairedCount}: ${p.closerCount} näher, ${p.fartherCount} weiter, ${p.unchangedCount} gleich`,
    );
  }
  return parts.join(' · ');
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
    html += renderOptionBarsHtml(
      q.optionDistribution.map((option) => ({
        ...option,
        text: stripMarkdownToPlainText(option.text),
      })),
      labels.optionDistribution,
      { optionCorrect: labels.optionCorrect },
      localeId,
    );
  }
  return html;
}

function renderConfidenceSection(
  result: ConfidenceResultDTO,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const total = confidenceResponseCount(result);
  const crossTab = result.crossTab;
  const middle = crossTab.correctMid + crossTab.incorrectMid;
  const topWrong = result.highConfidenceWrongOptions?.[0];
  const cards = `<div class="report-confidence-cards">
    <div class="report-confidence-card"><strong>${escapeHtml(formatPercentMetric(crossTab.correctHigh, total, localeId))}</strong><span>${escapeHtml(labels.confidenceMasteryCol)}</span></div>
    <div class="report-confidence-card"><strong>${escapeHtml(formatPercentMetric(crossTab.incorrectHigh, total, localeId))}</strong><span>${escapeHtml(labels.confidenceRiskCol)}</span></div>
    <div class="report-confidence-card"><strong>${escapeHtml(formatPercentMetric(crossTab.correctLow, total, localeId))}</strong><span>${escapeHtml(labels.confidenceFragileCol)}</span></div>
    <div class="report-confidence-card"><strong>${escapeHtml(formatPercentMetric(crossTab.incorrectLow, total, localeId))}</strong><span>${escapeHtml(labels.confidenceGapCol)}</span></div>
    <div class="report-confidence-card"><strong>${escapeHtml(formatPercentMetric(middle, total, localeId))}</strong><span>${escapeHtml(labels.confidenceUndecidedCol)}</span></div>
    <div class="report-confidence-card"><strong>${topWrong ? escapeHtml(`${stripMarkdownToPlainText(topWrong.text)} (${topWrong.count})`) : '—'}</strong><span>${escapeHtml(labels.confidenceTopSignal)}</span></div>
  </div>`;
  const charts = `<div class="report-chart-grid">
    ${renderConfidenceHeatmapHtml(result.crossTab, heatmapLabels(labels), localeId)}
    ${renderConfidenceDistributionBarsHtml(result, labels.confidenceDistributionTitle, localeId)}
  </div>`;
  return `<h4>${escapeHtml(labels.confidenceSection)} <span class="report-badge">${escapeHtml(labels.confidenceN)}: ${formatLocaleCount(total, localeId)}</span></h4>${charts}${cards}`;
}

function renderQuestion(
  q: QuestionExportEntry,
  labels: SessionResultsReportLabels,
  localeId: string,
  questionTotal: number,
  assetBaseUrl?: string,
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
  </div>`;

  const meta = [
    `<span class="report-meta-item"><strong>${escapeHtml(labels.questionParticipants)}</strong> ${formatLocaleCount(q.participantCount, localeId)}</span>`,
  ];
  if (q.averageScore !== null && q.averageScore !== undefined) {
    meta.push(
      `<span class="report-meta-item"><strong>${escapeHtml(labels.averageScore)}</strong> ${formatLocaleNumber(q.averageScore, localeId)}</span>`,
    );
  }

  let body = renderOptionBars(q, labels, localeId);

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
    body += `<p>${escapeHtml(labels.shortTextCorrect)}: ${formatLocaleCount(q.correctCount ?? 0, localeId)} · ${escapeHtml(labels.shortTextIncorrect)}: ${formatLocaleCount(q.incorrectCount ?? 0, localeId)}</p>`;
    if (q.shortTextIncorrectAggregates?.length) {
      body += `<ul class="report-list">${q.shortTextIncorrectAggregates
        .map(
          (entry) =>
            `<li>${escapeHtml(stripMarkdownToPlainText(entry.text))}: ${formatLocaleCount(entry.count, localeId)}</li>`,
        )
        .join('')}</ul>`;
    }
  }

  if (q.ratingDistribution) {
    body += renderStarRatingBarsHtml(
      q.ratingDistribution,
      labels.ratingDistribution,
      localeId,
      q.ratingAverage,
      q.ratingStandardDeviation,
    );
  }

  if (q.numericStats) {
    body += `<h4>${escapeHtml(labels.numericStats)}</h4><p>${escapeHtml(numericStatsText(q.numericStats, localeId))}</p>`;
    const comparison = numericRoundComparisonText(q.numericRoundComparison, localeId);
    if (comparison) body += `<p class="report-note">${escapeHtml(comparison)}</p>`;
    const numericOverlay =
      q.type === 'NUMERIC_ESTIMATE' ? resolveNumericHistogramOverlayContext(q) : undefined;
    if (q.numericHistogram?.length) {
      body += renderHistogramHtml(
        q.numericHistogram,
        labels.numericHistogramTitle,
        localeId,
        undefined,
        numericOverlay,
        labels,
      );
    }
    body += renderNumericRoundHistogramsHtml(
      q.numericRoundComparison,
      q.numericHistogram,
      {
        round1: labels.numericRound1Histogram,
        round2: labels.numericRound2Histogram,
        delta: labels.numericDeltaHistogram,
      },
      localeId,
      numericOverlay,
      labels,
    );
  }

  if (q.confidenceResult) {
    body += renderConfidenceSection(q.confidenceResult, labels, localeId);
  }

  return `<article class="report-question" id="${questionAnchorId(q.questionOrder)}">
    <div class="report-question-head">
      ${kicker}
      <div class="report-meta">${meta.join('')}</div>
      ${roundContextHtml(q, labels, localeId)}
    </div>
    <div class="report-question-text markdown-body">${questionDisplayHtml(q, labels, assetBaseUrl)}</div>
    ${body ? `<div class="report-question-body">${body}</div>` : ''}
  </article>`;
}

function renderFeedbackSummary(
  feedback: SessionFeedbackSummary,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const overallBars = renderStarRatingBarsHtml(
    feedback.overallDistribution,
    labels.feedbackOverall,
    localeId,
    feedback.overallAverage,
  );
  let details = `<p class="report-coverage">${escapeHtml(labels.feedbackResponses)}: ${formatLocaleCount(feedback.totalResponses, localeId)}</p>`;
  if (feedback.questionQualityAverage !== null && feedback.questionQualityDistribution) {
    details += renderStarRatingBarsHtml(
      feedback.questionQualityDistribution,
      labels.feedbackQuestionQuality,
      localeId,
      feedback.questionQualityAverage,
    );
  }
  if (feedback.wouldRepeatYes > 0 || feedback.wouldRepeatNo > 0) {
    details += `<p class="report-note">${escapeHtml(labels.feedbackWouldRepeat)}: ${escapeHtml(labels.feedbackWouldRepeatYes)} ${formatLocaleCount(feedback.wouldRepeatYes, localeId)} · ${escapeHtml(labels.feedbackWouldRepeatNo)} ${formatLocaleCount(feedback.wouldRepeatNo, localeId)}</p>`;
  }
  return `<section class="report-section report-feedback" id="report-feedback">
    <h2>${escapeHtml(labels.feedbackTitle)}</h2>
    ${overallBars}
    ${details}
  </section>`;
}

function renderConfidenceSummary(
  summary: SessionConfidenceSummaryDTO,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const total = summary.responseCount;
  const priorityQuestions = [...summary.questions]
    .sort((a, b) => {
      const riskDiff = b.result.crossTab.incorrectHigh - a.result.crossTab.incorrectHigh;
      return riskDiff !== 0 ? riskDiff : a.questionOrder - b.questionOrder;
    })
    .slice(0, 3);

  const metrics = `<div class="report-metrics">
    <div class="report-metric report-metric--success"><strong>${percent(summary.crossTab.correctHigh, total)} %</strong><span>${escapeHtml(labels.confidenceMastery)}</span></div>
    <div class="report-metric report-metric--risk"><strong>${percent(summary.crossTab.incorrectHigh, total)} %</strong><span>${escapeHtml(labels.confidenceRisk)}</span></div>
    <div class="report-metric report-metric--fragile"><strong>${percent(summary.crossTab.correctLow, total)} %</strong><span>${escapeHtml(labels.confidenceFragile)}</span></div>
  </div>`;

  const coverage = `<p class="report-coverage">
    ${escapeHtml(labels.confidenceValidResponses)}: ${formatLocaleCount(total, localeId)} ·
    ${escapeHtml(labels.confidenceIncludedQuestions)}: ${formatLocaleCount(summary.includedQuestionCount, localeId)}
    ${summary.suppressedQuestionCount > 0 ? ` · ${escapeHtml(labels.confidenceSuppressedQuestions)}: ${formatLocaleCount(summary.suppressedQuestionCount, localeId)}` : ''}
  </p>`;

  const aggregateCharts = `<div class="report-chart-grid">
    ${renderConfidenceHeatmapHtml(summary.crossTab, heatmapLabels(labels), localeId)}
    ${renderConfidenceDistributionBarsHtml(
      {
        distribution: summary.distribution,
        crossTab: summary.crossTab,
        highConfidenceWrongCount: summary.highConfidenceWrongCount,
      },
      labels.confidenceDistributionTitle,
      localeId,
    )}
  </div>`;

  let priorities = '';
  if (priorityQuestions.length > 0) {
    priorities = `<h3>${escapeHtml(labels.confidencePrioritiesTitle)}</h3><ol class="report-priority-list">${priorityQuestions
      .map((question) => {
        const wrongHigh = question.result.crossTab.incorrectHigh;
        const incorrect = incorrectCount(question);
        return `<li>
          <strong>${escapeHtml(labels.questionNumber)} ${question.questionOrder + 1}</strong>:
          ${escapeHtml(stripMarkdownToPlainText(question.questionTextShort))}
          ${priorityQuestionJumpLink(question.questionOrder, labels)}
          <div class="report-priority-metrics">
            <span>${wrongHigh}/${question.responseCount} · ${percent(wrongHigh, question.responseCount)} % ${escapeHtml(labels.confidenceWrongHigh)}</span>
            <span>${percent(incorrect, question.responseCount)} % ${escapeHtml(labels.confidenceIncorrectShare)}</span>
          </div>
        </li>`;
      })
      .join('')}</ol>`;
  }

  const alert =
    summary.priorityQuestionCount > 0
      ? `<p class="report-alert">${escapeHtml(labels.confidencePriorityAlert)}: ${formatLocaleCount(summary.priorityQuestionCount, localeId)}</p>`
      : '';

  return `<section class="report-section report-confidence" id="report-confidence">
    <h2>${escapeHtml(labels.confidenceTitle)}</h2>
    <p class="report-lead">${escapeHtml(labels.confidenceLead)}</p>
    ${alert}
    ${metrics}
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
  const finishedAt = new Date(data.finishedAt).toLocaleString(localeId);
  const questionTotal = data.questions.length;
  const assetBaseUrl = options.assetBaseUrl;
  const printPageFooterCss = options.pageNumbersViaCss
    ? buildSessionResultsPrintPageFooterCss(labels)
    : '';

  const feedbackHtml = data.feedbackSummary
    ? renderFeedbackSummary(data.feedbackSummary, labels, localeId)
    : '';

  const confidenceHtml = data.confidenceSummary
    ? renderConfidenceSummary(data.confidenceSummary, labels, localeId)
    : '';

  const questionsHtml = data.questions
    .map((question) => renderQuestion(question, labels, localeId, questionTotal, assetBaseUrl))
    .join('');

  const coverNavHtml = renderCoverNavigationHtml(data, labels);
  const coverSummaryHtml = renderCoverSummaryHtml(data, labels, localeId);
  const qaHtml = data.qaQuestions?.length
    ? renderQaSectionHtml(data.qaQuestions, labels, localeId)
    : '';
  const footerMeta = labels.exportFooterMeta
    .replace('{0}', new Date(generatedAt).toLocaleString(localeId))
    .replace('{1}', data.sessionCode);

  let teamHtml = '';
  if (data.teamMode && data.teamLeaderboard?.length) {
    teamHtml = `<section class="report-section" id="report-teams">
      <h2>${escapeHtml(labels.teamLeaderboardTitle)}</h2>
      <table class="report-table">
        <thead><tr>
          <th>${escapeHtml(labels.teamRank)}</th>
          <th>${escapeHtml(labels.teamName)}</th>
          <th>${escapeHtml(labels.teamMembers)}</th>
          <th>${escapeHtml(labels.teamTotalScore)}</th>
          <th>${escapeHtml(labels.teamAverageScore)}</th>
        </tr></thead>
        <tbody>${data.teamLeaderboard
          .map(
            (team) => `<tr>
              <td>${team.rank}</td>
              <td>${escapeHtml(team.teamName)}</td>
              <td>${formatLocaleCount(team.memberCount, localeId)}</td>
              <td>${formatLocaleCount(team.totalScore, localeId)}</td>
              <td>${formatLocaleNumber(team.averageScore, localeId)}</td>
            </tr>`,
          )
          .join('')}</tbody>
      </table>
    </section>`;
  }

  let bonusHtml = '';
  if (data.bonusTokens?.length) {
    bonusHtml = `<section class="report-section" id="report-bonus">
      <h2>${escapeHtml(labels.bonusCodesTitle)}</h2>
      <p class="report-note">${escapeHtml(labels.bonusCodesNotice)}</p>
      <table class="report-table">
        <thead><tr>
          <th>${escapeHtml(labels.bonusRank)}</th>
          <th>${escapeHtml(labels.bonusNickname)}</th>
          <th>${escapeHtml(labels.bonusCode)}</th>
          <th>${escapeHtml(labels.bonusScore)}</th>
          <th>${escapeHtml(labels.bonusGeneratedAt)}</th>
        </tr></thead>
        <tbody>${data.bonusTokens
          .map(
            (token) => `<tr>
              <td>${token.rank}</td>
              <td>${escapeHtml(token.nickname)}</td>
              <td>${escapeHtml(token.token)}</td>
              <td>${formatLocaleCount(token.totalScore, localeId)}</td>
              <td>${escapeHtml(token.generatedAt)}</td>
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
    ${renderCoverBrandHtml()}
    <h1>${escapeHtml(labels.coverTitle)}</h1>
    <p class="report-cover-subtitle">${escapeHtml(labels.coverSubtitle)}</p>
    ${coverSummaryHtml}
    <dl class="report-cover-meta">
      <div><dt>${escapeHtml(labels.quizName)}</dt><dd>${escapeHtml(data.quizName)}</dd></div>
      <div><dt>${escapeHtml(labels.sessionCode)}</dt><dd>${escapeHtml(data.sessionCode)}</dd></div>
      <div><dt>${escapeHtml(labels.finishedAt)}</dt><dd>${escapeHtml(finishedAt)}</dd></div>
      <div><dt>${escapeHtml(labels.participantCount)}</dt><dd>${formatLocaleCount(data.participantCount, localeId)}</dd></div>
    </dl>
    ${coverNavHtml}
    ${renderCoverPrivacyHtml(labels)}
  </section>
  ${feedbackHtml}
  ${confidenceHtml}
  <section class="report-section report-section--questions" id="report-questions">
    <h2 class="report-sr-only">${escapeHtml(labels.questionsTitle)}</h2>
    <div class="report-questions">${questionsHtml}</div>
  </section>
  ${qaHtml}
  ${teamHtml}
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
