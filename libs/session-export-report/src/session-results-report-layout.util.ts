import type { QaExportEntry, SessionExportDTO } from '@arsnova/shared-types';
import type { SessionResultsReportLabels } from './labels-de';
import { formatLocaleNumber } from './locale-number.util';
import { stripMarkdownToPlainText } from './markdown-plain-text.util';
import { REPORT_COVER_LOGO_SVG, REPORT_COVER_WORDMARK } from './report-cover-logo';
import { renderQaFollowUpHtml } from './session-results-report-insights.util';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { REPORT_COVER_LOGO_SVG };

export function questionAnchorId(order: number): string {
  return `report-question-${order + 1}`;
}

export function renderCoverSummaryHtml(
  data: SessionExportDTO,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const questionCount = data.questions.length;
  const riskCount =
    data.confidenceSummary?.signalQuestionCount ??
    data.confidenceSummary?.priorityQuestionCount ??
    0;
  const feedbackAvg = data.feedbackSummary?.overallAverage;

  const items = [
    `<div class="report-cover-summary-item"><strong>${questionCount}</strong><span>${escapeHtml(labels.coverSummaryQuestions)}</span></div>`,
    `<div class="report-cover-summary-item"><strong>${data.participantCount.toLocaleString(localeId)}</strong><span>${escapeHtml(labels.coverSummaryParticipants)}</span></div>`,
  ];
  if (data.confidenceSummary) {
    items.push(
      `<div class="report-cover-summary-item report-cover-summary-item--risk"><strong>${riskCount}</strong><span>${escapeHtml(labels.coverSummaryRisk)}</span></div>`,
    );
  }
  if (feedbackAvg !== undefined) {
    const feedbackCount = data.feedbackSummary?.totalResponses ?? 0;
    const avgText = labels.coverSummaryFeedbackAvgTemplate.replace(
      '{0}',
      formatLocaleNumber(feedbackAvg, localeId, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    );
    items.push(
      `<div class="report-cover-summary-item"><strong>${escapeHtml(avgText)}</strong><span>${escapeHtml(labels.coverSummaryFeedback)}</span><span class="report-cover-summary-sub">${escapeHtml(
        labels.coverSummaryFeedbackMetaTemplate.replace(
          '{0}',
          feedbackCount.toLocaleString(localeId),
        ),
      )}</span></div>`,
    );
  }
  return `<div class="report-cover-summary">${items.join('')}</div>`;
}

export function renderCoverBrandHtml(): string {
  return `<div class="report-cover-brand">
    <span class="report-cover-logo">${REPORT_COVER_LOGO_SVG}</span>
    <span class="report-cover-brand-text">${escapeHtml(REPORT_COVER_WORDMARK)}</span>
  </div>`;
}

export function renderCoverNavigationHtml(
  data: SessionExportDTO,
  labels: SessionResultsReportLabels,
): string {
  const items: string[] = [];

  if (data.confidenceSummary?.questions.length) {
    items.push(
      `<a class="report-cover-nav-item" href="#report-action-plan">${escapeHtml(labels.tocActionPlan)} <span aria-hidden="true">↗</span></a>`,
    );
  }
  items.push(
    `<a class="report-cover-nav-item" href="#report-hardest-questions">${escapeHtml(labels.tocHardestQuestions)} <span aria-hidden="true">↗</span></a>`,
  );
  if (data.confidenceSummary) {
    items.push(
      `<a class="report-cover-nav-item" href="#report-confidence">${escapeHtml(labels.tocConfidence)} <span aria-hidden="true">↗</span></a>`,
    );
  }
  items.push(
    `<a class="report-cover-nav-item" href="#report-questions">${escapeHtml(labels.tocQuestions)} <span class="report-cover-nav-count">${data.questions.length}</span> <span aria-hidden="true">↗</span></a>`,
  );
  if (data.feedbackSummary) {
    items.push(
      `<a class="report-cover-nav-item" href="#report-feedback">${escapeHtml(labels.tocFeedback)} <span aria-hidden="true">↗</span></a>`,
    );
  }
  if (data.qaQuestions?.length) {
    items.push(
      `<a class="report-cover-nav-item" href="#report-qa">${escapeHtml(labels.tocQa)} <span class="report-cover-nav-count">${data.qaQuestions.length}</span> <span aria-hidden="true">↗</span></a>`,
    );
  }
  if (data.teamMode && data.teamLeaderboard?.length) {
    items.push(
      `<a class="report-cover-nav-item" href="#report-teams">${escapeHtml(labels.tocTeams)} <span aria-hidden="true">↗</span></a>`,
    );
  }
  if (data.bonusTokens?.length) {
    items.push(
      `<a class="report-cover-nav-item" href="#report-bonus">${escapeHtml(labels.tocBonus)} <span aria-hidden="true">↗</span></a>`,
    );
  }

  if (!items.length) return '';
  return `<nav class="report-cover-nav" aria-label="${escapeHtml(labels.tableOfContentsTitle)}">
    <p class="report-cover-nav-label">${escapeHtml(labels.tableOfContentsTitle)}</p>
    <div class="report-cover-nav-grid">${items.join('')}</div>
  </nav>`;
}

/** @deprecated Nur für Tests — Navigation liegt auf dem Deckblatt. */
export function renderTableOfContentsHtml(
  data: SessionExportDTO,
  labels: SessionResultsReportLabels,
): string {
  return renderCoverNavigationHtml(data, labels);
}

export function renderQaSectionHtml(
  questions: QaExportEntry[],
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  if (!questions.length) return '';
  const rows = questions
    .map(
      (question, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(stripMarkdownToPlainText(question.text))}</td>
        <td>${escapeHtml(question.status)}</td>
        <td>${formatLocaleCountSafe(question.upvoteCount, localeId)}</td>
        <td>${question.isControversial ? escapeHtml(labels.qaControversial) : '—'}</td>
      </tr>`,
    )
    .join('');
  return `<section class="report-section" id="report-qa">
    <h2>${escapeHtml(labels.qaTitle)}</h2>
    ${renderQaFollowUpHtml(questions, labels, localeId)}
    <table class="report-table">
      <thead><tr>
        <th scope="col">#</th>
        <th scope="col">${escapeHtml(labels.questionNumber)}</th>
        <th scope="col">${escapeHtml(labels.qaStatus)}</th>
        <th scope="col">${escapeHtml(labels.qaUpvotes)}</th>
        <th scope="col">${escapeHtml(labels.qaControversial)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function formatLocaleCountSafe(value: number, localeId: string): string {
  return value.toLocaleString(localeId);
}

export function renderCoverPrivacyHtml(labels: SessionResultsReportLabels): string {
  return `<div class="report-privacy">
    <p>${escapeHtml(labels.privacyNotice)}</p>
  </div>`;
}

/** @deprecated Datenschutz liegt kompakt in {@link renderCoverPrivacyHtml}. */
export function renderExtendedPrivacyNotice(labels: SessionResultsReportLabels): string {
  return renderCoverPrivacyHtml(labels);
}

export function priorityQuestionJumpLink(
  questionOrder: number,
  labels: SessionResultsReportLabels,
): string {
  const label = labels.priorityJumpToQuestion.replace('{0}', String(questionOrder + 1));
  return `<a class="report-priority-jump" href="#${questionAnchorId(questionOrder)}">${escapeHtml(label)}</a>`;
}
