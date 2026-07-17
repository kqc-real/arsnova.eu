/**
 * Didaktische Klartext-Auswertungen für den Session-Ergebnisbericht.
 * Arbeitet ausschließlich auf vorhandenen Export-Aggregaten.
 */

import type {
  DebriefActionPlan,
  Difficulty,
  HardestQuestionEntry,
  NumericStatsDTO,
  QaExportEntry,
  QuestionExportEntry,
  RoundComparisonDTO,
  SessionExportDTO,
  SessionFeedbackSummary,
  TeamLearningQuestionScore,
} from '@arsnova/shared-types';
import { buildDebriefActionPlan, selectHardestQuestions } from '@arsnova/shared-types';
import type { SessionResultsReportLabels } from './labels-de';
import { formatLocaleCount, formatLocaleNumber } from './locale-number.util';
import { questionAnchorId } from './session-results-report-layout.util';
import { stripMarkdownToPlainText } from './markdown-plain-text.util';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function questionTitle(question: Pick<QuestionExportEntry, 'questionTextShort'>): string {
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

function formatQuestionScoreList(
  entries: readonly TeamLearningQuestionScore[],
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  return entries
    .map(
      (entry) =>
        `${labels.questionNumber} ${entry.questionOrder + 1} · ${formatLocaleNumber(
          entry.correctPercentage,
          localeId,
          { maximumFractionDigits: 0 },
        )} %`,
    )
    .join(', ');
}

function difficultyLabel(
  difficulty: Difficulty | undefined,
  labels: SessionResultsReportLabels,
): string {
  switch (difficulty) {
    case 'EASY':
      return labels.difficultyEasy;
    case 'HARD':
      return labels.difficultyHard;
    case 'MEDIUM':
      return labels.difficultyMedium;
    default:
      return labels.difficultyMedium;
  }
}

export function renderDebriefActionPlanHtml(
  data: SessionExportDTO,
  labels: SessionResultsReportLabels,
): string {
  if (!data.confidenceSummary?.questions.length) return '';
  const plan: DebriefActionPlan = buildDebriefActionPlan(
    data.confidenceSummary.questions,
    data.questions.map((question) => ({
      questionOrder: question.questionOrder,
      correctPercentage: question.correctPercentage,
    })),
  );
  const rows: Array<{ key: keyof DebriefActionPlan; title: string; orders: number[] }> = [
    { key: 'debrief', title: labels.actionPlanDebrief, orders: plan.debrief },
    { key: 'reteach', title: labels.actionPlanReteach, orders: plan.reteach },
    { key: 'reinforce', title: labels.actionPlanReinforce, orders: plan.reinforce },
    { key: 'observe', title: labels.actionPlanObserve, orders: plan.observe },
    { key: 'done', title: labels.actionPlanDone, orders: plan.done },
  ];
  const blocks = rows
    .filter((row) => row.orders.length > 0)
    .map((row) => {
      const links = row.orders
        .map(
          (order) =>
            `<a href="#${questionAnchorId(order)}">${escapeHtml(labels.questionNumber)} ${order + 1}</a>`,
        )
        .join(', ');
      return `<li><strong>${escapeHtml(row.title)}:</strong> ${links}</li>`;
    })
    .join('');
  if (!blocks) return '';
  const startOrder = plan.debrief[0] ?? plan.reteach[0] ?? plan.reinforce[0];
  const startHtml =
    startOrder !== undefined
      ? `<p class="report-action-plan-start">${escapeHtml(
          labels.actionPlanStartTemplate.replace('{0}', String(startOrder + 1)),
        )}</p>`
      : '';
  return `<section class="report-action-plan" id="report-action-plan">
    <h2>${escapeHtml(labels.actionPlanTitle)}</h2>
    <ul>${blocks}</ul>
    ${startHtml}
    <p class="report-note report-action-plan-criteria">${escapeHtml(labels.actionPlanCriteriaNote)}
      <a href="#report-confidence">${escapeHtml(labels.actionPlanCriteriaLink)}</a></p>
  </section>`;
}

export function renderHardestQuestionsHtml(
  data: SessionExportDTO,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const hardest = selectHardestQuestions(data.questions, 3);
  if (!hardest.length) return '';
  const items = hardest
    .map((entry: HardestQuestionEntry) => {
      const question = data.questions.find((q) => q.questionOrder === entry.questionOrder);
      const title = question
        ? questionTitle(question)
        : `${labels.questionNumber} ${entry.questionOrder + 1}`;
      const rate = labels.hardestQuestionRateTemplate
        .replace(
          '{0}',
          formatLocaleNumber(entry.correctPercentage, localeId, { maximumFractionDigits: 0 }),
        )
        .replace('{1}', formatLocaleCount(entry.correctCount, localeId))
        .replace('{2}', formatLocaleCount(entry.totalGraded, localeId));
      const mismatch =
        entry.difficultyMismatch && entry.difficulty
          ? `<span class="report-note">${escapeHtml(
              labels.hardestQuestionDifficultyMismatchTemplate
                .replace('{0}', difficultyLabel(entry.difficulty, labels))
                .replace(
                  '{1}',
                  formatLocaleNumber(entry.correctPercentage, localeId, {
                    maximumFractionDigits: 0,
                  }),
                ),
            )}</span>`
          : '';
      return `<li>
        <a href="#${questionAnchorId(entry.questionOrder)}"><strong>${escapeHtml(labels.questionNumber)} ${entry.questionOrder + 1}</strong> — ${escapeHtml(title)}</a>
        <span>${escapeHtml(rate)}</span>
        ${mismatch}
      </li>`;
    })
    .join('');
  return `<section class="report-hardest-questions" id="report-hardest-questions">
    <h2>${escapeHtml(labels.hardestQuestionsTitle)}</h2>
    <p class="report-note">${escapeHtml(labels.hardestQuestionsLead)}</p>
    <ol>${items}</ol>
  </section>`;
}

export function renderSessionParticipationHtml(
  data: SessionExportDTO,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  if (!data.questions.length || data.participantCount <= 0) return '';
  const counts = data.questions.map((question) => question.participantCount);
  const first = counts[0] ?? 0;
  const last = counts[counts.length - 1] ?? 0;
  const allEqual = counts.every((count) => count === first);

  if (allEqual) {
    return `<section class="report-participation-overview">
    <h3>${escapeHtml(labels.participationOverviewTitle)}</h3>
    <p>${escapeHtml(
      labels.participationStableTemplate
        .replace('{0}', formatLocaleCount(data.questions.length, localeId))
        .replace('{1}', formatLocaleCount(first, localeId)),
    )}</p>
  </section>`;
  }

  const series = data.questions
    .map(
      (question) =>
        `${escapeHtml(labels.questionNumber)} ${question.questionOrder + 1}: ${formatLocaleCount(question.participantCount, localeId)}`,
    )
    .join(' · ');
  const declineNote =
    last < first
      ? `<p>${escapeHtml(
          labels.participationDeclineTemplate
            .replace('{0}', formatLocaleCount(first, localeId))
            .replace('{1}', formatLocaleCount(last, localeId)),
        )}</p>`
      : '';
  return `<section class="report-participation-overview">
    <h3>${escapeHtml(labels.participationOverviewTitle)}</h3>
    <p>${series}</p>
    ${declineNote}
  </section>`;
}

export function renderQuestionParticipationNote(
  question: QuestionExportEntry,
  sessionParticipantCount: number,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  if (sessionParticipantCount <= 0) return '';
  const missing = Math.max(0, sessionParticipantCount - question.participantCount);
  const rate = Math.round((question.participantCount / sessionParticipantCount) * 100);
  const showRate = missing > 0 || rate < 100;
  let html = '';
  if (showRate) {
    html += `<p class="report-participation-note">${escapeHtml(
      labels.questionParticipationTemplate
        .replace('{0}', formatLocaleCount(question.participantCount, localeId))
        .replace('{1}', formatLocaleCount(sessionParticipantCount, localeId))
        .replace('{2}', formatLocaleCount(rate, localeId)),
    )}`;
    if (missing > 0) {
      html += ` ${escapeHtml(
        labels.questionParticipationMissingTemplate.replace(
          '{0}',
          formatLocaleCount(missing, localeId),
        ),
      )}`;
    }
    html += '</p>';
  }
  if (
    question.round1ParticipantCount !== undefined &&
    question.round2ParticipantCount !== undefined &&
    question.round1ParticipantCount > question.round2ParticipantCount
  ) {
    const roundDrop = question.round1ParticipantCount - question.round2ParticipantCount;
    html += `<p class="report-participation-note">${escapeHtml(
      labels.roundParticipationDropTemplate
        .replace('{0}', formatLocaleCount(question.round1ParticipantCount, localeId))
        .replace('{1}', formatLocaleCount(question.round2ParticipantCount, localeId))
        .replace('{2}', formatLocaleCount(roundDrop, localeId)),
    )}</p>`;
  }
  return html;
}

export function renderDistractorAnalysisHtml(
  question: QuestionExportEntry,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const options = question.optionDistribution;
  if (!options?.length) return '';
  const graded = question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE';
  if (!graded) return '';
  const incorrect = options.filter((option) => option.isCorrect === false);
  const correct = options.filter((option) => option.isCorrect === true);
  const parts: string[] = [];

  if (question.type === 'SINGLE_CHOICE') {
    const top = [...incorrect].sort((a, b) => b.count - a.count)[0];
    if (top && top.count > 0) {
      const correctTop = [...correct].sort((a, b) => b.count - a.count)[0];
      const chosen = labels.distractorChosenByTemplate.replace(
        '{0}',
        formatLocaleCount(top.count, localeId),
      );
      const tieNote =
        correctTop && top.count === correctTop.count
          ? ` ${labels.distractorAsAttractiveAsCorrect}`
          : '';
      parts.push(
        `<p><strong>${escapeHtml(labels.strongestDistractor)}:</strong> ${escapeHtml(
          stripMarkdownToPlainText(top.text),
        )} — ${escapeHtml(`${chosen}.${tieNote}`)}</p>`,
      );
    }
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    const falseMarked = [...incorrect].sort((a, b) => b.count - a.count)[0];
    if (falseMarked && falseMarked.count > 0) {
      parts.push(
        `<p><strong>${escapeHtml(labels.mcFalseSelection)}:</strong> ${escapeHtml(
          stripMarkdownToPlainText(falseMarked.text),
        )} — ${escapeHtml(
          labels.distractorChosenByTemplate.replace(
            '{0}',
            formatLocaleCount(falseMarked.count, localeId),
          ),
        )}.</p>`,
      );
    }
    const overlooked = [...correct]
      .map((option) => ({
        ...option,
        missed: Math.max(0, question.participantCount - option.count),
      }))
      .sort((a, b) => b.missed - a.missed)[0];
    if (overlooked && overlooked.missed > 0) {
      parts.push(
        `<p><strong>${escapeHtml(labels.mcOmission)}:</strong> ${escapeHtml(
          stripMarkdownToPlainText(overlooked.text),
        )} — ${escapeHtml(
          labels.mcOmissionCountTemplate.replace(
            '{0}',
            formatLocaleCount(overlooked.missed, localeId),
          ),
        )}.</p>`,
      );
    }
  }

  if (question.participantCount >= 20) {
    const unused = incorrect.filter((option) => option.count === 0);
    for (const option of unused.slice(0, 2)) {
      parts.push(
        `<p class="report-note">${escapeHtml(
          labels.unusedDistractorTemplate.replace('{0}', stripMarkdownToPlainText(option.text)),
        )}</p>`,
      );
    }
  }

  if (!parts.length) return '';
  return `<aside class="report-distractor-analysis">
    <h4>${escapeHtml(labels.distractorAnalysisTitle)}</h4>
    ${parts.join('')}
  </aside>`;
}

function renderPeerCeilingHtml(
  labels: SessionResultsReportLabels,
  localeId: string,
  correctCount: number,
  total: number,
  inBand: boolean,
): string {
  const template = inBand ? labels.piGainCeilingNumericTemplate : labels.piGainCeilingTemplate;
  return `<aside class="report-pi-gain">
    <h4>${escapeHtml(labels.piGainTitle)}</h4>
    <p><strong>${escapeHtml(
      template
        .replace('{0}', formatLocaleCount(correctCount, localeId))
        .replace('{1}', formatLocaleCount(total, localeId)),
    )}</strong></p>
  </aside>`;
}

export function renderPeerInstructionGainHtml(
  comparison: RoundComparisonDTO | undefined,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  if (!comparison) return '';
  const r1 = comparison.round1CorrectCount;
  const r2 = comparison.round2CorrectCount;
  if (r1 === undefined || r2 === undefined) return '';
  const r1Pct = comparison.round1Total > 0 ? Math.round((r1 / comparison.round1Total) * 100) : 0;
  const r2Pct = comparison.round2Total > 0 ? Math.round((r2 / comparison.round2Total) * 100) : 0;
  const delta = r2Pct - r1Pct;

  if (comparison.round1Total > 0 && r1Pct >= 100 && delta <= 0) {
    return renderPeerCeilingHtml(labels, localeId, r1, comparison.round1Total, false);
  }

  const deltaText =
    delta === 0
      ? labels.piGainUnchanged
      : delta > 0
        ? labels.piGainDeltaUpTemplate.replace('{0}', formatLocaleCount(delta, localeId))
        : labels.piGainDeltaDownTemplate.replace(
            '{0}',
            formatLocaleCount(Math.abs(delta), localeId),
          );
  const shift = comparison.opinionShift;

  return `<aside class="report-pi-gain">
    <h4>${escapeHtml(labels.piGainTitle)}</h4>
    <p>${escapeHtml(
      labels.piGainCorrectTemplate
        .replace('{0}', formatLocaleCount(r1, localeId))
        .replace('{1}', formatLocaleCount(comparison.round1Total, localeId))
        .replace('{2}', formatLocaleCount(r2, localeId))
        .replace('{3}', formatLocaleCount(comparison.round2Total, localeId)),
    )}</p>
    <p><strong>${escapeHtml(deltaText)}</strong></p>
    ${
      shift?.wrongToCorrectCount !== undefined
        ? `<p>${escapeHtml(
            labels.piGainWrongToCorrectTemplate.replace(
              '{0}',
              formatLocaleCount(shift.wrongToCorrectCount, localeId),
            ),
          )}</p>`
        : ''
    }
    ${
      shift?.correctToWrongCount !== undefined
        ? `<p>${escapeHtml(
            labels.piGainCorrectToWrongTemplate.replace(
              '{0}',
              formatLocaleCount(shift.correctToWrongCount, localeId),
            ),
          )}</p>`
        : ''
    }
  </aside>`;
}

export function renderNumericPeerGainHtml(
  comparison: QuestionExportEntry['numericRoundComparison'],
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  if (!comparison) return '';
  const r1 = comparison.round1Stats.inBandCount;
  const r2 = comparison.round2Stats.inBandCount;
  const r1Total = comparison.round1Stats.n;
  const r2Total = comparison.round2Stats.n;
  const r1Pct =
    comparison.round1Stats.inBandPercent ?? (r1Total > 0 ? Math.round((r1 / r1Total) * 100) : 0);
  const r2Pct =
    comparison.round2Stats.inBandPercent ?? (r2Total > 0 ? Math.round((r2 / r2Total) * 100) : 0);
  const delta = Math.round(r2Pct - r1Pct);

  if (r1Total > 0 && r1Pct >= 100 && delta <= 0) {
    return renderPeerCeilingHtml(labels, localeId, r1, r1Total, true);
  }

  const deltaText =
    delta === 0
      ? labels.piGainUnchanged
      : delta > 0
        ? labels.piGainDeltaUpTemplate.replace('{0}', formatLocaleCount(delta, localeId))
        : labels.piGainDeltaDownTemplate.replace(
            '{0}',
            formatLocaleCount(Math.abs(delta), localeId),
          );
  const paired = comparison.pairedAnalysis;
  return `<aside class="report-pi-gain">
    <h4>${escapeHtml(labels.piGainTitle)}</h4>
    <p>${escapeHtml(
      labels.numericPiGainInBandTemplate
        .replace('{0}', formatLocaleCount(r1, localeId))
        .replace('{1}', formatLocaleCount(r1Total, localeId))
        .replace('{2}', formatLocaleCount(r2, localeId))
        .replace('{3}', formatLocaleCount(r2Total, localeId)),
    )}</p>
    <p><strong>${escapeHtml(deltaText)}</strong></p>
    ${
      paired
        ? `<p>${escapeHtml(
            labels.numericPiGainPairedTemplate
              .replace('{0}', formatLocaleCount(paired.closerCount, localeId))
              .replace('{1}', formatLocaleCount(paired.fartherCount, localeId))
              .replace('{2}', formatLocaleCount(paired.unchangedCount, localeId)),
          )}</p>`
        : ''
    }
  </aside>`;
}

export function renderNumericPlainLanguageHtml(
  stats: NumericStatsDTO,
  labels: SessionResultsReportLabels,
  _localeId: string,
  formatValue: (value: number) => string,
): string {
  const parts: string[] = [];
  if (stats.q1 !== null && stats.q3 !== null) {
    if (stats.q1 === stats.q3) {
      parts.push(labels.numericPlainExactHalfTemplate.replace('{0}', formatValue(stats.q1)));
    } else {
      parts.push(
        labels.numericPlainIqrTemplate
          .replace('{0}', formatValue(stats.q1))
          .replace('{1}', formatValue(stats.q3)),
      );
    }
  }
  if (stats.meanAbsoluteError !== null) {
    parts.push(labels.numericPlainMaeTemplate.replace('{0}', formatValue(stats.meanAbsoluteError)));
  }
  if (!parts.length) return '';
  return `<ul class="report-numeric-plain">${parts.map((part) => `<li>${escapeHtml(part)}</li>`).join('')}</ul>`;
}

export function renderResponseTimeHtml(
  question: QuestionExportEntry,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  if (
    question.effectiveTimerSeconds === null ||
    question.effectiveTimerSeconds === undefined ||
    question.medianResponseTimeMs === undefined ||
    question.medianResponseTimeMs < 1000 ||
    question.participantCount <= 0
  ) {
    return '';
  }
  const medianSec = Math.max(1, Math.round(question.medianResponseTimeMs / 1000));
  const near = question.nearDeadlineCount ?? 0;
  const fromRound1 =
    question.responseTimeRound === 1 ||
    (question.responseTimeRound === undefined &&
      question.round2ParticipantCount !== undefined &&
      question.round2ParticipantCount > 0);
  const sampleCount =
    fromRound1 && question.round1ParticipantCount !== undefined
      ? question.round1ParticipantCount
      : question.participantCount;
  const title = fromRound1 ? labels.responseTimeRound1Title : labels.responseTimeTitle;
  const medianText =
    medianSec === 1
      ? labels.responseTimeMedianOneTemplate
      : labels.responseTimeMedianTemplate.replace('{0}', formatLocaleCount(medianSec, localeId));
  const pressure =
    sampleCount > 0 && near / sampleCount >= 0.35
      ? `<p class="report-note">${escapeHtml(labels.responseTimePressureHint)}</p>`
      : '';
  return `<aside class="report-response-time">
    <h4>${escapeHtml(title)}</h4>
    <p>${escapeHtml(medianText)}</p>
    <p>${escapeHtml(
      labels.responseTimeNearDeadlineTemplate
        .replace('{0}', formatLocaleCount(near, localeId))
        .replace('{1}', formatLocaleCount(sampleCount, localeId)),
    )}</p>
    ${pressure}
  </aside>`;
}

export function renderFeedbackFollowUpHtml(
  feedback: SessionFeedbackSummary,
  sessionParticipantCount: number,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const rate =
    sessionParticipantCount > 0
      ? Math.round((feedback.totalResponses / sessionParticipantCount) * 100)
      : 0;
  const repeatTotal = feedback.wouldRepeatYes + feedback.wouldRepeatNo;
  const repeatShare =
    repeatTotal > 0 ? Math.round((feedback.wouldRepeatYes / repeatTotal) * 100) : null;
  return `<div class="report-followup">
    <p>${escapeHtml(
      labels.feedbackCoverageTemplate
        .replace('{0}', formatLocaleCount(feedback.totalResponses, localeId))
        .replace('{1}', formatLocaleCount(sessionParticipantCount, localeId))
        .replace('{2}', formatLocaleCount(rate, localeId)),
    )}</p>
    ${
      repeatShare !== null
        ? `<p>${escapeHtml(
            labels.feedbackWouldRepeatSummaryTemplate
              .replace('{0}', formatLocaleCount(feedback.wouldRepeatYes, localeId))
              .replace('{1}', formatLocaleCount(repeatTotal, localeId))
              .replace('{2}', formatLocaleCount(repeatShare, localeId)),
          )}</p>`
        : ''
    }
  </div>`;
}

export function renderQaFollowUpHtml(
  qaQuestions: QaExportEntry[],
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  if (!qaQuestions.length) return '';
  const open = qaQuestions.filter((q) => q.status === 'ACTIVE' || q.status === 'PINNED');
  const closed = qaQuestions.filter((q) => q.status === 'ARCHIVED');
  const topOpen = [...open].sort((a, b) => b.upvoteCount - a.upvoteCount)[0];
  const controversial = qaQuestions.find((q) => q.isControversial);
  return `<div class="report-followup">
    <h3>${escapeHtml(labels.qaFollowUpTitle)}</h3>
    <p>${escapeHtml(
      labels.qaFollowUpCountsTemplate
        .replace('{0}', formatLocaleCount(qaQuestions.length, localeId))
        .replace('{1}', formatLocaleCount(closed.length, localeId))
        .replace('{2}', formatLocaleCount(open.length, localeId)),
    )}</p>
    ${
      topOpen
        ? `<p><strong>${escapeHtml(labels.qaFollowUpTopOpen)}:</strong> ${escapeHtml(topOpen.text)} · ${formatLocaleCount(topOpen.upvoteCount, localeId)} ${escapeHtml(labels.qaUpvotes)}</p>`
        : ''
    }
    ${
      controversial
        ? `<p><strong>${escapeHtml(labels.qaFollowUpControversial)}:</strong> ${escapeHtml(controversial.text)}${
            controversial.positiveVoteCount !== undefined &&
            controversial.negativeVoteCount !== undefined
              ? ` · ${formatLocaleCount(controversial.positiveVoteCount, localeId)} ${escapeHtml(labels.qaPositive)} / ${formatLocaleCount(controversial.negativeVoteCount, localeId)} ${escapeHtml(labels.qaNegative)}`
              : ''
          }</p>`
        : ''
    }
  </div>`;
}

export function renderTeamLearningProfilesHtml(
  data: SessionExportDTO,
  labels: SessionResultsReportLabels,
  localeId: string,
): string {
  const profiles = data.teamLearningProfiles;
  if (!profiles?.length) return '';
  const rows = profiles
    .map((profile) => {
      const strength =
        profile.strengthQuestions.length > 0
          ? formatQuestionScoreList(profile.strengthQuestions, labels, localeId)
          : '—';
      const focus =
        profile.focusQuestions.length > 0
          ? formatQuestionScoreList(profile.focusQuestions, labels, localeId)
          : '—';
      return `<tr>
        <td>${escapeHtml(profile.teamName)}</td>
        <td>${escapeHtml(focus)}</td>
        <td>${escapeHtml(strength)}</td>
      </tr>`;
    })
    .join('');
  return `<section class="report-section" id="report-team-learning">
    <h2>${escapeHtml(labels.teamLearningTitle)}</h2>
    <p class="report-note">${escapeHtml(labels.teamLearningLead)}</p>
    <table class="report-table">
      <thead><tr>
        <th scope="col">${escapeHtml(labels.teamName)}</th>
        <th scope="col">${escapeHtml(labels.teamLearningFocus)}</th>
        <th scope="col">${escapeHtml(labels.teamLearningStrength)}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

/** Nächste Schritte aus dem Nachbesprechungsplan — konkret aus denselben Signalen wie die Impulse. */
export function renderNextStepsSummaryHtml(
  data: SessionExportDTO,
  labels: SessionResultsReportLabels,
): string {
  if (!data.confidenceSummary?.questions.length) return '';
  const plan = buildDebriefActionPlan(
    data.confidenceSummary.questions,
    data.questions.map((question) => ({
      questionOrder: question.questionOrder,
      correctPercentage: question.correctPercentage,
    })),
  );
  const items: string[] = [];

  const questionByOrder = (order: number) =>
    data.questions.find((question) => question.questionOrder === order);

  for (const order of plan.debrief.slice(0, 2)) {
    const question = questionByOrder(order);
    const result = question?.confidenceResult;
    const topOmission = result?.highConfidenceOmittedCorrectOptions?.[0];
    const topWrong = result?.highConfidenceWrongOptions?.[0];
    // Bei Single Choice ist die gewählte falsche Option der klarere Impuls als die „Auslassung“.
    const preferWrong =
      question?.type === 'SINGLE_CHOICE' || (topWrong?.count ?? 0) > (topOmission?.count ?? 0);
    if (preferWrong && topWrong) {
      const correctText = question?.optionDistribution?.find((option) => option.isCorrect)?.text;
      if (correctText) {
        items.push(
          labels.nextStepsDebriefWrongVsCorrectTemplate
            .replace('{0}', String(order + 1))
            .replace('{1}', stripMarkdownToPlainText(topWrong.text))
            .replace('{2}', stripMarkdownToPlainText(correctText)),
        );
      } else {
        items.push(
          labels.nextStepsDebriefWrongTemplate
            .replace('{0}', String(order + 1))
            .replace('{1}', stripMarkdownToPlainText(topWrong.text)),
        );
      }
    } else if (topOmission && (topOmission.count ?? 0) >= (topWrong?.count ?? 0)) {
      items.push(
        labels.nextStepsDebriefOmitTemplate
          .replace('{0}', String(order + 1))
          .replace('{1}', stripMarkdownToPlainText(topOmission.text)),
      );
    } else if (topWrong) {
      items.push(
        labels.nextStepsDebriefWrongTemplate
          .replace('{0}', String(order + 1))
          .replace('{1}', stripMarkdownToPlainText(topWrong.text)),
      );
    } else if (items.length === 0) {
      items.push(labels.nextStepsDebriefFirstTemplate.replace('{0}', String(order + 1)));
    } else {
      items.push(labels.nextStepsDebriefNextTemplate.replace('{0}', String(order + 1)));
    }
  }

  if (plan.reteach.length === 1) {
    items.push(labels.nextStepsReteachTemplate.replace('{0}', String(plan.reteach[0]! + 1)));
  } else if (plan.reteach.length > 1) {
    const list = plan.reteach.map((order) => String(order + 1)).join(', ');
    items.push(labels.nextStepsReteachConcreteTemplate.replace('{0}', list));
  }

  for (const order of plan.reinforce.slice(0, 2)) {
    const question = questionByOrder(order);
    const pct =
      typeof question?.correctPercentage === 'number'
        ? String(Math.round(question.correctPercentage))
        : '—';
    items.push(
      labels.nextStepsReinforceConcreteTemplate
        .replace('{0}', String(order + 1))
        .replace('{1}', pct),
    );
  }

  if (!items.length) return '';
  return `<section class="report-session-summary" id="report-session-summary">
    <h2>${escapeHtml(labels.finalSummaryTitle)}</h2>
    <ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
  </section>`;
}
