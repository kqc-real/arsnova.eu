import { getSessionResultsReportLabelsDe, type SessionResultsReportLabels } from './labels-de';
import {
  FR_LABEL_OVERRIDES,
  ES_LABEL_OVERRIDES,
  IT_LABEL_OVERRIDES,
} from './labels-i18n.generated';

const EN_LABELS: SessionResultsReportLabels = {
  ...getSessionResultsReportLabelsDe(),
  documentTitle: 'Session results report',
  coverTitle: 'Results report',
  coverSubtitle: 'Aggregated session evaluation for instructors',
  quizName: 'Quiz',
  sessionCode: 'Session code',
  finishedAt: 'Ended at',
  participantCount: 'Participants',
  privacyNotice: 'Export for documentation and evaluation — no personal data.',
  feedbackTitle: 'Participant feedback',
  feedbackOverall: 'Overall rating',
  feedbackResponses: 'Ratings',
  feedbackQuestionQuality: 'Question quality',
  feedbackWouldRepeat: 'Would join again?',
  feedbackWouldRepeatYes: 'Yes',
  feedbackWouldRepeatNo: 'No',
  confidenceTitle: 'Learning status and self-assessment',
  confidenceLead:
    'Correctness and self-assessment together show solid knowledge, gaps, and possible misconceptions.',
  confidencePriorityAlert: 'Debrief recommended',
  confidenceMastery: 'Solid knowledge',
  confidenceRisk: 'Misconception risk',
  confidenceFragile: 'Fragile knowledge',
  confidenceValidResponses: 'Responses with self-assessment',
  confidenceIncludedQuestions: 'Evaluated questions',
  confidenceSuppressedQuestions: 'Questions hidden for privacy',
  confidencePrioritiesTitle: 'Priority for debrief',
  confidenceWrongHigh: 'wrong + high answer confidence',
  confidenceIncorrectShare: 'Incorrect answers total',
  confidenceHeatmapTitle: 'Correctness × self-assessment',
  confidenceDistributionTitle: 'Self-assessment distribution',
  confidenceRowCorrect: 'Correct',
  confidenceRowIncorrect: 'Incorrect',
  confidenceTierLow: 'Low',
  confidenceTierMid: 'Medium',
  confidenceTierHigh: 'High',
  questionsTitle: 'Questions in detail',
  questionNumber: 'Question',
  questionOfTotal: 'Question {0} of {1}',
  pageNumberFooter: 'Page {0} / {1}',
  questionType: 'Format',
  questionParticipants: 'Participants',
  aggregationRound: 'Aggregation round',
  averageScore: 'Avg. points',
  optionDistribution: 'Answer distribution',
  optionCorrect: 'correct',
  confidenceSection: 'Self-assessment',
  confidenceN: 'Responses',
  confidenceMasteryCol: 'Solid',
  confidenceRiskCol: 'Misconception risk',
  confidenceFragileCol: 'Fragile',
  confidenceGapCol: 'Knowledge gap',
  confidenceUndecidedCol: 'Undecided',
  confidenceTopSignal: 'Strongest signal',
  aggregationRound1: 'Round 1',
  aggregationRound2: 'Round 2 (Peer Instruction)',
  aggregationRound1Context: 'Result from aggregation round 1',
  aggregationRound2Context: 'Result after discussion (Peer Instruction)',
  roundParticipationGapTemplate: 'Round 1: {0} votes · Evaluated in round 2: {1} votes',
  numericHistogramTitle: 'Estimate distribution',
  numericRound1Histogram: 'Estimates — round 1',
  numericRound2Histogram: 'Estimates — round 2',
  numericDeltaHistogram: 'Change between rounds',
  teamLeaderboardTitle: 'Team ranking',
  teamRank: 'Rank',
  teamName: 'Team',
  teamMembers: 'Members',
  teamTotalScore: 'Team points',
  teamAverageScore: 'Avg. points per member',
  bonusCodesTitle: 'Bonus codes',
  bonusCodesNotice: 'Pseudonymised codes — mapping only via voluntary email submission.',
  bonusRank: 'Rank',
  bonusNickname: 'Nickname',
  bonusCode: 'Code',
  bonusScore: 'Points',
  bonusGeneratedAt: 'Generated at',
  freetextResponses: 'Free-text responses',
  shortTextCorrect: 'Correct answers',
  shortTextIncorrect: 'Incorrect answers',
  numericStats: 'Estimate statistics',
  numericToleranceBand: 'Tolerance band',
  numericReference: 'Reference',
  ratingDistribution: 'Rating distribution',
  generatedBy: 'Created with arsnova.eu',
  tableOfContentsTitle: 'Contents',
  tocFeedback: 'Participant feedback',
  tocConfidence: 'Learning status and self-assessment',
  tocQuestions: 'Questions in detail',
  tocQa: 'Q&A questions',
  tocTeams: 'Team ranking',
  tocBonus: 'Bonus codes',
  coverSummaryQuestions: 'Questions',
  coverSummaryRisk: 'With misconception risk',
  coverSummaryFeedback: 'Avg. session rating',
  coverSummaryParticipants: 'Participants',
  coverPrivacyIncluded:
    'Included: aggregated quiz results, self-assessment, feedback, Q&A (no nicknames).',
  coverPrivacyExcluded:
    'Not included: individual votes, nicknames, IP addresses, raw free text with personal data.',
  priorityJumpToQuestion: '→ Question {0}',
  heatmapLegendTitle: 'Legend',
  heatmapLegendScale: 'Intensity by share of all self-assessed responses',
  heatmapLegendHint: 'Number = responses in cell',
  piComparisonTitle: 'Peer Instruction — round 1 vs. round 2',
  freetextMoreTemplate: '+ {0} more responses',
  shortTextExpectedSolutions: 'Expected solutions',
  ratingStdDev: 'Standard deviation',
  qaTitle: 'Participant Q&A questions',
  qaStatus: 'Status',
  qaUpvotes: 'Upvotes',
  qaControversial: 'Controversial',
  blockquoteTeachingIdea: 'Teaching idea',
  blockquoteHint: 'Note for instructors',
  exportFooterMeta: 'Export {0} · Session {1} · Schema v2',
};

function mergeLabels(overrides: Partial<SessionResultsReportLabels>): SessionResultsReportLabels {
  return { ...getSessionResultsReportLabelsDe(), ...overrides };
}

export function getSessionResultsReportLabelsEn(): SessionResultsReportLabels {
  return EN_LABELS;
}

export function getSessionResultsReportLabelsFr(): SessionResultsReportLabels {
  return mergeLabels(FR_LABEL_OVERRIDES);
}

export function getSessionResultsReportLabelsEs(): SessionResultsReportLabels {
  return mergeLabels(ES_LABEL_OVERRIDES);
}

export function getSessionResultsReportLabelsIt(): SessionResultsReportLabels {
  return mergeLabels(IT_LABEL_OVERRIDES);
}

export function getSessionResultsReportLabelsForLocale(
  localeId: string,
): SessionResultsReportLabels {
  const lang = localeId.slice(0, 2).toLowerCase();
  switch (lang) {
    case 'en':
      return getSessionResultsReportLabelsEn();
    case 'fr':
      return getSessionResultsReportLabelsFr();
    case 'es':
      return getSessionResultsReportLabelsEs();
    case 'it':
      return getSessionResultsReportLabelsIt();
    case 'de':
      return getSessionResultsReportLabelsDe();
    default:
      return getSessionResultsReportLabelsDe();
  }
}

export { getSessionResultsReportLabelsDe };
export type { SessionResultsReportLabels } from './labels-de';
