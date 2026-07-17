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
  privacyNotice:
    'Privacy: This report contains aggregated results only. Real names, IP addresses, and individual votes are not exported. Pseudonym nicknames appear only with bonus codes.',
  feedbackTitle: 'Participant feedback',
  feedbackOverall: 'Overall rating',
  feedbackResponses: 'Ratings',
  feedbackCoverageCompactTemplate: '{0} responses · response rate {1}',
  feedbackQuestionQuality: 'Question quality',
  feedbackWouldRepeat: 'More quizzes wanted',
  feedbackWouldRepeatYes: 'Yes',
  feedbackWouldRepeatNo: 'No',
  confidenceTitle: 'Learning status and self-assessment',
  confidenceLead:
    'Correctness and self-assessment together show solid knowledge, gaps, and possible misconceptions.',
  confidencePriorityAlert: 'Debrief recommended',
  coverActionTitle: 'What to debrief',
  coverActionWrongTemplate: '{0} of {1} incorrect and confident',
  coverActionStartTemplate: 'Recommended starting point: Begin with question {0}.',
  confidenceMastery: 'Solid knowledge',
  confidenceRisk: 'Misconception risk',
  confidenceFragile: 'Fragile knowledge',
  confidenceGap: 'Knowledge gap',
  confidenceMiddle: 'Medium confidence',
  confidenceReadingGuideTitle: 'How to read this section',
  confidenceReadingGuideScale: 'Self-assessment 1–5: Low = 1–2 · Medium = 3 · High = 4–5',
  confidenceReadingGuideMastery: 'Solid knowledge = correct answer + high self-assessment (4–5)',
  confidenceReadingGuideRisk: 'Misconception risk = incorrect answer + high self-assessment (4–5)',
  confidenceReadingGuideFragile: 'Fragile knowledge = correct answer + low self-assessment (1–2)',
  confidenceReadingGuideGap: 'Knowledge gap = incorrect answer + low self-assessment (1–2)',
  confidenceReadingGuideUndecided:
    'Medium confidence = level 3, correct or incorrect; not assigned to a diagnostic category',
  confidenceValidResponses: 'Responses with self-assessment',
  confidenceIncludedQuestions: 'Evaluated questions',
  confidenceSuppressedQuestions: 'Not aggregated (<5 responses with self-assessment)',
  confidenceCoverageTemplate:
    'Self-assessment was collected for {0} of {1} questions, producing {2} responses.',
  confidenceCoverageFormulaTemplate:
    '{0} questions × {1} participants = {2} self-assessment responses.',
  confidenceNotCollectedTemplate: 'No evaluable self-assessment for: {0}.',
  confidenceNotSupportedTemplate: 'Not supported for: {0}.',
  confidenceDisabledTemplate: 'Disabled in this quiz for: {0}.',
  confidenceNotCollectedForQuestion: 'No self-assessment was collected for this question.',
  confidenceNotSupportedForQuestion: 'This question type does not support self-assessment.',
  confidenceDisabledForQuestion: 'Self-assessment was disabled for this question in this quiz.',
  confidencePrioritiesTitle: 'Priority for debrief',
  confidencePriorityRuleTemplate:
    '{0} questions recommended for debrief: At least 2 participants and at least 10% answered incorrectly with high confidence. Individual cases are marked as a notice only.',
  confidenceSignalRuleTemplate:
    '{0} questions at notice level because they received at least one incorrect answer with high confidence.',
  confidenceWrongHigh: 'Incorrect and confident',
  confidenceIncorrectShare: 'Incorrect answers total',
  countOfTemplate: '{0} of {1}',
  confidenceHeatmapTitle: 'Correctness × self-assessment',
  confidenceDistributionTitle: 'Self-assessment distribution',
  confidenceDistributionAxis: 'Number of responses',
  confidenceRowCorrect: 'Correct',
  confidenceRowIncorrect: 'Incorrect',
  confidenceTierLow: 'Low',
  confidenceTierMid: 'Medium',
  confidenceTierHigh: 'High',
  questionsTitle: 'Questions in detail',
  questionNumber: 'Question',
  questionOfTotal: 'Question {0} of {1}',
  questionContinuationTemplate: 'Question {0} – continued: {1}',
  pageNumberFooter: 'Page {0} / {1}',
  questionType: 'Format',
  questionParticipants: 'Participants',
  aggregationRound: 'Aggregation round',
  averageScore: 'Avg. points',
  optionDistribution: 'Answer distribution',
  optionDistributionMcNote:
    'Percent = share of participants who selected this option. With multiple choice, the total may exceed 100%.',
  optionDistributionMcRule:
    'A response is fully correct only when all correct options and no incorrect option were selected.',
  optionDistributionValueTemplate: '{0} · {1} of {2}',
  optionCorrect: 'correct',
  optionIncorrect: 'incorrect',
  multipleChoiceFullyCorrect: 'Fully correct',
  confidenceSection: 'Self-assessment',
  confidenceN: 'Responses',
  confidenceMasteryCol: 'Solid',
  confidenceRiskCol: 'Misconception risk',
  confidenceFragileCol: 'Fragile',
  confidenceGapCol: 'Knowledge gap',
  confidenceUndecidedCol: 'Medium confidence',
  confidenceTopSignal: '⚠ Debrief prompt',
  confidenceTopSignalTemplate: '{1} participants chose “{0}” incorrectly and with high confidence.',
  confidenceActionRecommendationTemplate:
    'Recommendation: Revisit “{0}”, ask participants to justify their choice, and contrast it with the correct solution.',
  confidenceOmissionSignalTemplate:
    '{1} participants answered incorrectly with high confidence. Most often overlooked: “{0}” ({2}×).',
  confidenceOmissionActionTemplate:
    'Recommendation: Clarify why “{0}” is required for a complete solution, and discuss typical omissions.',
  confidenceMcCombinedAllOmittedTemplate:
    '{0} participants answered incorrectly with high confidence. All overlooked the correct option “{1}”. {2} also chose “{3}”.',
  confidenceMcCombinedActionTemplate:
    'First clarify that “{0}” is required for a complete solution. Then explain why “{1}” does not apply.',
  confidenceDegenerateAllHighWrongTemplate: 'Confidence: All {0} responses with high confidence',
  confidenceDegenerateAllHighWrongResult: 'Result: All {0} responses fully incorrect',
  confidenceHighWrongGenericTemplate: '{0} participants answered incorrectly with high confidence.',
  confidenceMasteryZeroNote:
    '0% solid knowledge does not mean 0% correct answers. Correct answers here were mostly given with low or medium confidence.',
  confidenceCompactDistributionTemplate: 'Self-assessment: {0} low · {1} medium · {2} high',
  confidenceMetricsBasisTemplate:
    'Rounded share of all {0} responses with self-assessment (sums to 100%)',
  aggregationRound1: 'Round 1',
  aggregationRound2: 'Round 2 (Peer Instruction)',
  aggregationRound1Context: 'Voting result',
  aggregationRound2Context: 'Result after discussion – round 2',
  roundParticipationGapTemplate: 'Round 1: {0} votes · Evaluated in round 2: {1} votes',
  numericHistogramTitle: 'Estimate distribution',
  numericRound1Histogram: 'Estimates — round 1',
  numericRound2Histogram: 'Estimates — round 2',
  numericDeltaHistogram: 'Change between rounds',
  numericRoundComparisonTitle: 'Estimate round comparison',
  numericComparisonMetric: 'Metric',
  numericComparisonAnswers: 'Responses',
  numericComparisonMean: 'Mean',
  numericComparisonMedian: 'Median',
  numericComparisonStdDev: 'Standard deviation',
  numericComparisonInBand: 'Within tolerance',
  numericNoChangeTemplate: 'No change between rounds: {0} of {1} responses.',
  numericChangeTemplate: 'Change: {0} closer to the reference · {1} farther away · {2} unchanged',
  numericIdenticalHistogram: 'Estimates — both rounds',
  numericIdenticalDistributions: 'No visible change — both distributions are identical.',
  teamLeaderboardTitle: 'Team ranking',
  teamRank: 'Rank',
  teamName: 'Team',
  teamMembers: 'Members',
  teamTotalScore: 'Team score',
  teamAverageScore: 'Avg. points per member',
  teamScoreExplanation:
    'The team score is the mean of member points, keeping teams of different sizes comparable.',
  finalSummaryTitle: 'Next steps',
  finalSummaryPriorityTemplate: '{0} questions should be debriefed',
  finalSummaryMasteryTemplate: '{0} of responses with solid knowledge',
  finalSummaryRiskTemplate: '{0} of responses with misconception risk',
  finalSummaryTopTeamTemplate: '{0} achieved the highest team score',
  nextStepsDebriefFirstTemplate: 'Debrief question {0} first (misconception)',
  nextStepsDebriefNextTemplate: 'Clarify question {0} next',
  nextStepsDebriefOmitTemplate: 'For question {0}, clarify the overlooked option “{1}”.',
  nextStepsDebriefWrongTemplate: 'For question {0}, explain the distinction around “{1}”.',
  nextStepsDebriefWrongVsCorrectTemplate:
    'For question {0}, explain why “{1}” is wrong and “{2}” is correct.',
  nextStepsReteachTemplate: 'Re-explain question {0}',
  nextStepsReteachListTemplate: 'Re-explain questions {0}',
  nextStepsReteachConcreteTemplate: 'For questions {0}, revisit the underlying concepts.',
  nextStepsReinforceTemplate: 'Briefly secure questions {0} (correct but still unsure)',
  nextStepsReinforceConcreteTemplate:
    'For question {0}, confirm the correct solution (success rate {1} — correct but still unsure).',
  scoreExplanation:
    'Points are a ranking value based on correctness, difficulty, response time when a timer is active, and streak bonuses. Self-assessment does not affect points. Because the attainable value depends on the quiz flow, scores are not percentages and cannot be compared across sessions.',
  bonusCodesTitle: 'Bonus codes',
  bonusCodesNotice: 'Pseudonymised codes — mapping only via voluntary email submission.',
  bonusScoreTieNote: 'If scores are equal, the scored response time decides the rank.',
  bonusRank: 'Rank',
  bonusNickname: 'Nickname',
  bonusCode: 'Code',
  bonusScore: 'Points',
  bonusGeneratedAt: 'Generated at',
  freetextResponses: 'Free-text responses',
  shortTextCorrect: 'Answered correctly',
  shortTextIncorrect: 'Answered incorrectly',
  shortTextIncorrectHeading: 'Most common non-accepted answers',
  shortTextIncorrectItemTemplate: '“{0}” · {1} of {2}',
  shortTextSubmittedAnswers: 'Submitted answers',
  numericStats: 'Estimate statistics',
  numericInBandSummaryTemplate: '{0} of {1} responses were within the accepted range {2}–{3}.',
  numericToleranceBand: 'Accepted range',
  numericReference: 'Reference',
  ratingDistribution: 'Rating on a scale from 1 to 5',
  ratingScaleEndpoints: '1 = very unlikely · 5 = very likely',
  generatedBy: 'Created with arsnova.eu',
  tableOfContentsTitle: 'Contents',
  tocFeedback: 'Participant feedback',
  tocConfidence: 'Learning status and self-assessment',
  tocQuestions: 'Questions in detail',
  tocQa: 'Q&A questions',
  tocTeams: 'Team ranking',
  tocBonus: 'Bonus codes',
  coverSummaryQuestions: 'Questions',
  coverSummaryRisk: 'Questions with misconception risk',
  coverSummaryFeedback: 'Participant feedback',
  coverSummaryFeedbackAvgTemplate: '{0} out of 5 ★',
  coverSummaryFeedbackMetaTemplate: '{0} responses',
  coverSummaryParticipants: 'Participants',
  coverPrivacyIncluded:
    'Included: aggregated quiz results, self-assessment, feedback, Q&A (no real names).',
  coverPrivacyExcluded:
    'Not included: real names, IP addresses, individual votes, raw free text with personal data. Pseudonym nicknames only on bonus-code pages.',
  reportLanguage: 'Report language',
  quizContentLanguage: 'Quiz content',
  priorityJumpToQuestion: '→ Question {0}',
  nextQuestion: 'Next question',
  heatmapCellCountNote: 'The number in each cell shows the response count.',
  heatmapLegendToneTitle: 'Diagnostic categories',
  heatmapLegendToneSuccess: '✓ Solid: correct with high self-assessment',
  heatmapLegendToneRisk: '⚠ Misconception risk: incorrect with high self-assessment',
  heatmapLegendToneCaution: '◯ Knowledge gap: incorrect with low self-assessment',
  heatmapLegendToneNeutral: '? Fragile: correct with low self-assessment',
  heatmapLegendToneMid: 'M Medium: self-assessment level 3, whether correct or incorrect',
  heatmapLegendFrequencyHint: 'Symbols identify the diagnostic category.',
  heatmapCompactLegend: '✓ Solid · ⚠ Misconception · ? Fragile · ◯ Knowledge gap · M Medium',
  confidenceScaleEndpoints: '1 = very unsure · 5 = very sure',
  piComparisonTitle: 'Peer Instruction — round 1 vs. round 2',
  freetextMoreTemplate: '+ {0} more responses',
  shortTextExpectedSolutions: 'Accepted solutions',
  ratingStdDev: 'Standard deviation',
  ratingAverageTemplate: 'Avg. {0} out of 5 ★',
  ratingAverageWithSigmaTemplate: 'Avg. {0} out of 5 ★ · σ {1}',
  qaTitle: 'Participant Q&A questions',
  qaStatus: 'Status',
  qaUpvotes: 'Upvotes',
  qaControversial: 'Controversial',
  qaPositive: 'positive',
  qaNegative: 'negative',
  blockquoteTeachingIdea: 'Teaching idea',
  blockquoteHint: 'Note for instructors',
  exportFooterMeta: 'Export {0} · Session {1}',
  actionPlanTitle: 'Your debrief plan',
  actionPlanDebrief: 'Clarify misconception first',
  actionPlanReinforce: 'Briefly secure the correct solution',
  actionPlanReteach: 'Re-explain the basics',
  actionPlanObserve: 'Quick review',
  actionPlanDone: 'Mostly solidified',
  actionPlanStartTemplate: 'Recommended starting point: Question {0}',
  actionPlanCriteriaNote:
    'Automatically prioritized by misconception risk, success rate, and confidence.',
  actionPlanCriteriaLink: 'Classification criteria',
  hardestQuestionsTitle: 'Hardest questions',
  hardestQuestionsLead:
    'Empirical success rate: share of fully correct answers. A low rate can also come from unclear wording or a tight time limit.',
  hardestQuestionRateTemplate: 'Success rate {0} ({1} of {2} fully correct)',
  hardestQuestionDifficultyMismatchTemplate:
    'Configured as “{0}”, but only {1} of graded responses were fully correct — check difficulty or wording.',
  difficultyEasy: 'easy',
  difficultyMedium: 'medium',
  difficultyHard: 'hard',
  participationOverviewTitle: 'Participation over time',
  participationDropTemplate: '{0} of {1} respondents were lost since the start.',
  participationStableTemplate: 'Stable participation: All {0} questions each had {1} respondents.',
  participationDeclineTemplate: 'Participation fell from {0} to {1} responses.',
  questionParticipationTemplate: 'Response rate: {0} of {1} · {2}',
  questionParticipationMissingTemplate: '{0} participants did not answer.',
  roundParticipationDropTemplate:
    'Round 1: {0} responses · Round 2: {1} responses · {2} people did not take part in round 2.',
  distractorAnalysisTitle: 'Selection errors',
  strongestDistractor: 'Strongest distractor',
  distractorChosenByTemplate: 'chosen by {0} people',
  distractorAsAttractiveAsCorrect: 'The incorrect option was as attractive as the correct answer.',
  mcFalseSelection: 'Most common false selection',
  mcOmission: 'Most common omission',
  mcOmissionCountTemplate: 'missed by {0} people',
  unusedDistractorTemplate:
    'Distractor “{0}” was not chosen in this session. If this happens repeatedly, consider revising it.',
  piGainTitle: 'Effect of discussion',
  piGainCorrectTemplate: 'Fully correct: {0} of {1} → {2} of {3}',
  piGainDeltaUpTemplate: '+{0} percentage points',
  piGainDeltaDownTemplate: '−{0} percentage points',
  piGainUnchanged: 'No measurable gain in fully correct answers',
  piGainCeilingTemplate:
    'No further learning gain measurable: Already in round 1, {0} of {1} answers were fully correct. A second round was not needed.',
  piGainCeilingNumericTemplate:
    'No further learning gain measurable: Already in round 1, {0} of {1} answers were within the accepted range. A second round was not needed.',
  piGainWrongToCorrectTemplate: '{0} participants switched from incorrect to correct.',
  piGainCorrectToWrongTemplate: '{0} people switched from correct to incorrect.',
  numericPiGainInBandTemplate: 'Within accepted range: {0} of {1} → {2} of {3}',
  numericPiGainPairedTemplate: '{0} closer to the reference · {1} farther away · {2} unchanged',
  numericPlainInBandTemplate: '{0} of {1} responses were within the accepted range.',
  numericPlainIqrTemplate: 'The middle 50% of estimates were between {0} and {1}.',
  numericPlainExactHalfTemplate: 'At least half of the participants gave exactly {0}.',
  numericPlainMaeTemplate: 'The average deviation from the reference value was {0}.',
  responseTimeTitle: 'Response time',
  responseTimeRound1Title: 'Response time in round 1',
  responseTimeMedianTemplate: 'Median: {0} seconds',
  responseTimeMedianOneTemplate: 'Median: 1 second',
  responseTimeNearDeadlineTemplate:
    '{0} of {1} responses were submitted in the last 20% of the available time.',
  responseTimePressureHint: 'Note: The time limit may have been tight for this question.',
  feedbackCoverageTemplate: 'Feedback rate: {0} of {1} · {2}',
  feedbackWouldRepeatSummaryTemplate: '{0} of {1} want more quizzes · {2}',
  feedbackOverallHighlightTemplate: '{0} of responses rated the session with four or five stars.',
  feedbackNoLowStarsNote: 'Nobody gave one or two stars.',
  feedbackQualityHighlightTemplate:
    '{0} of responses rated question quality with four or five stars.',
  numericPeerCloser: 'Closer to the reference',
  numericPeerUnchanged: 'Unchanged',
  numericPeerFarther: 'Farther away',
  numericPeerChangeBarsTitle: 'Change relative to the reference',
  qaFollowUpTitle: 'Q&A follow-up',
  qaFollowUpCountsTemplate: '{0} questions submitted · {1} answered or archived · {2} still open',
  qaFollowUpTopOpen: 'Most-voted open question',
  qaFollowUpControversial: 'Discussed controversially',
  teamLearningTitle: 'Team learning profile',
  teamLearningLead:
    'Only teams with at least five members. Strength: success rate at least 80% · Needs clarification: at most 40%.',
  teamLearningStrength: 'Strength',
  teamLearningFocus: 'Needs clarification',
  tocActionPlan: 'Debrief plan',
  tocHardestQuestions: 'Hardest questions',
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
