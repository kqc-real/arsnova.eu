import { getSessionResultsReportLabelsDe, type SessionResultsReportLabels } from './labels-de';
import {
  FR_LABEL_OVERRIDES,
  ES_LABEL_OVERRIDES,
  IT_LABEL_OVERRIDES,
} from './labels-i18n.generated';
import { applyFrenchColonTypographyToLabels } from './french-colon-typography.util';

const EN_LABELS: SessionResultsReportLabels = {
  ...getSessionResultsReportLabelsDe(),
  documentTitle: 'Quiz Insights for Teaching',
  coverTitle: 'Quiz Insights for Teaching',
  coverSubtitle: 'Student understanding, possible misconceptions, and a debriefing plan',
  quizName: 'Quiz',
  sessionCode: 'Session code',
  finishedAt: 'Ended at',
  participantCount: 'Participants',
  privacyNotice:
    'Privacy: This report contains aggregated results only. Real names, IP addresses, and individual votes are not exported. Pseudonymous nicknames appear only with bonus codes.',
  feedbackTitle: 'Participant feedback',
  feedbackOverall: 'Overall rating',
  feedbackResponses: 'Ratings',
  feedbackCoverageCompactTemplate: '{0} responses · {1} response rate',
  feedbackQuestionQuality: 'Question quality',
  feedbackWouldRepeat: 'More quizzes wanted',
  feedbackWouldRepeatYes: 'Yes',
  feedbackWouldRepeatNo: 'No',
  confidenceTitle: 'Learner understanding and answer confidence',
  confidenceLead:
    'Correctness and self-rated confidence together show solid understanding, gaps, and possible misconceptions.',
  confidencePriorityAlert: 'Debrief recommended',
  coverActionTitle: 'What to debrief',
  coverActionWrongTemplate: '{0} of {1} incorrect and confident',
  coverActionStartTemplate: 'Recommended starting point: Begin with question {0}.',
  confidenceMastery: 'Solid understanding',
  confidenceRisk: 'Responses indicating a possible misconception',
  confidenceFragile: 'Understanding not yet secure',
  confidenceGap: 'Knowledge gap',
  confidenceMiddle: 'Medium confidence',
  confidenceReadingGuideTitle: 'How to read this section',
  confidenceReadingGuideScale: 'Answer confidence (1–5): Low = 1–2 · Medium = 3 · High = 4–5',
  confidenceReadingGuideMastery:
    'Solid understanding = correct answer + high self-rated confidence (4–5)',
  confidenceReadingGuideRisk:
    'Indicator of a possible misconception = incorrect answer + high self-rated confidence (4–5)',
  confidenceReadingGuideFragile:
    'Understanding not yet secure = correct answer + low self-rated confidence (1–2)',
  confidenceReadingGuideGap: 'Knowledge gap = incorrect answer + low self-rated confidence (1–2)',
  confidenceReadingGuideUndecided:
    'Medium confidence = level 3, correct or incorrect; not assigned to a diagnostic category',
  confidenceValidResponses: 'Responses with self-rated confidence',
  confidenceIncludedQuestions: 'Evaluated questions',
  confidenceSuppressedQuestions: 'Not aggregated (<5 responses with self-rated confidence)',
  confidenceCoverageTemplate:
    'Self-rated confidence was collected for {0} of {1} questions, producing {2} responses.',
  confidenceCoverageFormulaTemplate:
    '{0} questions × {1} participants = {2} self-rated confidence responses.',
  confidenceNotCollectedTemplate: 'No evaluable self-rated confidence for {0}.',
  confidenceNotSupportedTemplate: 'Answer confidence is not collected for {0}.',
  confidenceDisabledTemplate: 'Answer confidence was disabled for {0} in this quiz.',
  confidenceNotCollectedForQuestion: 'Answer confidence was not collected for this question.',
  confidenceNotSupportedForQuestion: 'Answer confidence is not collected for “{0}” questions.',
  confidenceDisabledForQuestion: 'Answer confidence was disabled for this question.',
  confidencePrioritiesTitle: 'Priority for debrief',
  confidencePriorityRuleTemplate:
    '{0} questions are recommended for debriefing. At least two participants—and at least 10% of respondents—answered incorrectly with high confidence. Individual cases are shown for information only.',
  confidenceSignalRuleTemplate:
    '{0} questions at notice level because they received at least one incorrect answer with high confidence.',
  confidenceWrongHigh: 'Incorrect and confident',
  confidenceIncorrectShare: 'Incorrect answers total',
  countOfTemplate: '{0} of {1}',
  confidenceHeatmapTitle: 'Correctness × self-rated confidence',
  confidenceDistributionTitle: 'Self-rated confidence distribution',
  confidenceDistributionAxis: 'Number of responses',
  confidenceRowCorrect: 'Correct',
  confidenceRowIncorrect: 'Incorrect',
  confidenceTierLow: 'Low',
  confidenceTierMid: 'Medium',
  confidenceTierHigh: 'High',
  questionsTitle: 'Question-by-question results',
  questionsLead:
    'Question texts match what participants saw live (including images, formulas, and extra context).',
  backToOverview: '↑ Back to overview',
  lowSuccessRateHintTemplate:
    'Only {0} answered correctly in this session. Consider reviewing the wording, required prior knowledge, and time limit.',
  questionNumber: 'Question',
  questionOfTotal: 'Question {0} of {1}',
  questionContinuationTemplate: 'Question {0} – continued: {1}',
  questionContinuationShortTemplate: 'Question {0} – continued',
  pageNumberFooter: 'Page {0} / {1}',
  questionType: 'Format',
  questionParticipants: 'Participants',
  aggregationRound: 'Aggregation round',
  averageScore: 'Avg. points',
  optionDistribution: 'Answer distribution',
  optionDistributionMcNote:
    'Percentages show the share of participants who selected each option. Because multiple selections were allowed, the total may exceed 100%.',
  optionDistributionMcRule:
    'A response is fully correct only when all correct options and no incorrect option were selected.',
  optionDistributionValueTemplate: '{0} · {1} of {2}',
  optionCorrect: 'correct',
  optionIncorrect: 'incorrect',
  multipleChoiceFullyCorrect: 'Fully correct',
  confidenceSection: 'Answer confidence',
  confidenceN: 'Responses',
  confidenceMasteryCol: 'Solid',
  confidenceRiskCol: 'Possible misconception',
  confidenceFragileCol: 'Not yet secure',
  confidenceGapCol: 'Knowledge gap',
  confidenceUndecidedCol: 'Medium confidence',
  confidenceTopSignal: '⚠ Debrief prompt',
  confidenceTopSignalTemplate: '{1} participants chose “{0}” incorrectly and with high confidence.',
  confidenceActionRecommendationTemplate:
    'Recommendation: Revisit “{0}”, ask participants to justify their choice, and contrast it with the correct solution.',
  confidenceOmissionSignalTemplate:
    '{1} participants answered incorrectly with high confidence. Most often overlooked: “{0}” ({2}×).',
  confidenceOmissionActionTemplate:
    'Recommendation: Clarify why “{0}” is required for a fully correct response, and discuss typical omissions.',
  confidenceMcCombinedAllOmittedTemplate:
    '{0} participants answered incorrectly with high confidence. All of them missed the correct option “{1}”. {2} also selected “{3}”.',
  confidenceMcCombinedActionTemplate:
    'First clarify why “{0}” is required for a fully correct response. Then discuss why “{1}” does not apply.',
  confidenceScCombinedActionTemplate:
    'First explain why “{0}” is the correct answer. Then discuss why “{1}” is incorrect.',
  confidenceResponseCountTemplate: '{0} responses',
  confidenceDegenerateAllHighWrongTemplate: 'Confidence: All {0} responses with high confidence',
  confidenceDegenerateAllHighWrongResult: 'Result: All {0} responses fully incorrect',
  confidenceHighWrongGenericTemplate: '{0} participants answered incorrectly with high confidence.',
  confidenceMasteryZeroNote:
    '0% solid understanding does not mean 0% correct answers. Correct answers here were mostly given with low or medium confidence.',
  confidenceCompactDistributionTemplate: 'Answer confidence: {0} low · {1} medium · {2} high',
  confidenceMetricsBasisTemplate:
    'Rounded share of all {0} responses with self-rated confidence (sums to 100%)',
  aggregationRound1: 'Round 1',
  aggregationRound2: 'Round 2 (Peer Instruction)',
  aggregationRound1Context: 'Voting results',
  aggregationRound2Context: 'Result after discussion – round 2',
  roundParticipationGapTemplate: 'Round 1: {0} votes · Evaluated in round 2: {1} votes',
  numericHistogramTitle: 'Distribution of estimates',
  numericRound1Histogram: 'Estimates — round 1',
  numericRound2Histogram: 'Estimates — round 2',
  numericDeltaHistogram: 'Change between rounds',
  numericRoundComparisonTitle: 'Comparison of estimation rounds',
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
    'The team score is the average of members’ scores, so teams of different sizes remain comparable.',
  finalSummaryTitle: 'Next steps',
  finalSummaryPriorityTemplate: '{0} questions should be debriefed',
  finalSummaryMasteryTemplate: '{0} of responses with solid knowledge',
  finalSummaryRiskTemplate: '{0} of responses indicating a possible misconception',
  finalSummaryTopTeamTemplate: '{0} achieved the highest team score',
  nextStepsDebriefFirstTemplate: 'For Question {0}, address a possible misconception first',
  nextStepsDebriefNextTemplate: 'For Question {0}, clarify next',
  nextStepsDebriefOmitTemplate: 'For Question {0}, address the missed option “{1}”.',
  nextStepsDebriefWrongTemplate: 'For question {0}, explain the distinction around “{1}”.',
  nextStepsDebriefWrongVsCorrectTemplate:
    'For Question {0}, explain why {1} is incorrect and {2} is correct.',
  nextStepsReteachTemplate: 'For Question {0}, revisit the underlying concepts',
  nextStepsReteachListTemplate: 'For Questions {0}, revisit the underlying concepts',
  nextStepsReteachConcreteTemplate: 'For Questions {0}, revisit the underlying concepts.',
  nextStepsReinforceTemplate: 'Briefly reinforce correct answers for questions {0}',
  nextStepsReinforceConcreteTemplate:
    'For Question {0}, reinforce the correct answer; the correct-response rate was {1}, but confidence was not consistently high.',
  nextStepsReinforceLowConfidenceTemplate:
    'For Question {0}, confirm the correct reasoning; the correct-response rate was {1}, but all responses were given with low confidence.',
  scoreExplanation:
    'Points are used for ranking and reflect correctness, question difficulty, response time when a timer is active, and streak bonuses. Answer confidence does not affect points. Because the maximum attainable score depends on the quiz setup and session flow, scores are not percentages and should not be compared across sessions.',
  bonusCodesTitle: 'Bonus codes',
  bonusCodesNotice:
    'Pseudonymous codes can be linked to identities only through voluntary email submission.',
  bonusScoreTieNote: 'If scores are equal, the scored response time decides the rank.',
  bonusRank: 'Rank',
  bonusNickname: 'Nickname',
  bonusCode: 'Code',
  bonusScore: 'Points',
  bonusGeneratedAt: 'Generated at',
  freetextResponses: 'Free-text responses',
  shortTextCorrect: 'Answered correctly',
  shortTextIncorrect: 'Answered incorrectly',
  shortTextIncorrectHeading: 'Most frequent incorrect responses',
  shortTextIncorrectItemTemplate: '“{0}” · {1} of {2}',
  shortTextSubmittedAnswers: 'Submitted answers',
  numericStats: 'Summary statistics',
  numericInBandSummaryTemplate: '{0} of {1} responses were within the accepted range {2}–{3}.',
  numericToleranceBand: 'Accepted range',
  numericReference: 'Reference',
  ratingDistribution: 'Rating on a scale from 1 to 5',
  ratingScaleEndpoints: '1 = very unlikely · 5 = very likely',
  generatedBy: 'Created with arsnova.eu',
  tableOfContentsTitle: 'Contents',
  tocFeedback: 'Participant feedback',
  tocConfidence: 'Learner understanding and answer confidence',
  tocQuestions: 'Question-by-question results',
  tocQa: 'Q&A questions',
  tocTeams: 'Team ranking',
  tocBonus: 'Bonus codes',
  coverSummaryQuestions: 'Questions',
  coverSummaryRisk: 'Questions indicating possible misconceptions',
  coverSummaryRiskNote:
    'A question is flagged when at least two participants—and at least 10% of respondents—answer incorrectly with high confidence.',
  coverSummaryFeedback: 'Participant feedback',
  coverSummaryFeedbackAvgTemplate: '{0} out of 5 ★',
  coverSummaryFeedbackMetaTemplate: '{0} responses',
  coverSummaryParticipants: 'Participants',
  coverPrivacyIncluded:
    'Included: aggregated quiz results, self-rated confidence, feedback, Q&A (no real names).',
  coverPrivacyExcluded:
    'Not included: real names, IP addresses, individual votes, raw free text with personal data. Pseudonymous nicknames only on bonus-code pages.',
  reportLanguage: 'Report language',
  quizContentLanguage: 'Quiz content',
  priorityJumpToQuestion: '→ Question {0}',
  nextQuestion: 'Next question',
  heatmapCellCountNote: 'The number in each cell shows the response count.',
  heatmapLegendToneTitle: 'Diagnostic categories',
  heatmapLegendToneSuccess: '✓ Solid understanding: correct with high self-rated confidence',
  heatmapLegendToneRisk: '⚠ Possible misconception: incorrect with high self-rated confidence',
  heatmapLegendToneCaution: '◯ Knowledge gap: incorrect with low self-rated confidence',
  heatmapLegendToneNeutral:
    '? Understanding not yet secure: correct with low self-rated confidence',
  heatmapLegendToneMid: 'M Medium: self-rated confidence level 3, whether correct or incorrect',
  heatmapLegendFrequencyHint: 'Symbols identify the diagnostic category.',
  heatmapCompactLegend:
    '✓ Solid understanding · ⚠ Possible misconception · ? Not yet secure · ◯ Knowledge gap · M Medium confidence',
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
  actionPlanTitle: 'Your debriefing plan',
  actionPlanDebrief: 'Address possible misconceptions first',
  actionPlanReinforce: 'Briefly reinforce correct answers',
  actionPlanReteach: 'Revisit key concepts',
  actionPlanObserve: 'Quick review',
  actionPlanDone: 'Mostly solidified',
  actionPlanStartTemplate: 'Recommended starting point: Question {0}',
  actionPlanCriteriaNote:
    'Automatically prioritized based on indicators of possible misconceptions, correct-response rates, and answer confidence.',
  actionPlanCriteriaLink: '→ Classification criteria',
  hardestQuestionsTitle: 'Questions with the lowest correct-response rates',
  hardestQuestionsLead:
    'Empirical correct response rate: share of fully correct answers. A low rate can also come from unclear wording or a tight time limit.',
  hardestQuestionRateTemplate: 'Correct-response rate: {0} ({1} of {2} fully correct)',
  hardestQuestionDifficultyMismatchTemplate:
    'Configured as “{0}”, but only {1} of graded responses were fully correct — check difficulty or wording.',
  difficultyEasy: 'easy',
  difficultyMedium: 'medium',
  difficultyHard: 'hard',
  participationOverviewTitle: 'Participation across the quiz',
  participationDropTemplate: '{0} of {1} respondents were lost since the start.',
  participationStableTemplate:
    'Participation was stable: all {0} questions received {1} responses.',
  participationDeclineTemplate: 'Participation fell from {0} to {1} responses.',
  questionParticipationTemplate: 'Response rate: {0} of {1} · {2}',
  questionParticipationMissingTemplate: '{0} participants did not answer.',
  roundParticipationDropTemplate:
    'Round 1: {0} responses · Round 2: {1} responses · {2} participants did not take part in round 2.',
  distractorAnalysisTitle: 'Option analysis',
  strongestDistractor: 'Most frequently selected distractor',
  distractorChosenByTemplate: 'selected by {0} participants',
  optionChosenByTemplate: 'selected by {0} participants',
  distractorAsAttractiveAsCorrect: 'The incorrect option was as attractive as the correct answer.',
  mcFalseSelection: 'Most frequently selected incorrect option',
  mcOmission: 'Most frequently missed correct option',
  mcOmissionCountTemplate: 'missed by {0} participants',
  unusedDistractorTemplate:
    'Incorrect option “{0}” was not chosen in this session. If this repeats, consider revising it.',
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
  piGainCorrectToWrongTemplate: '{0} participants switched from correct to incorrect.',
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
  feedbackWouldRepeatSummaryTemplate: '{0} of {1} participants would like more quizzes · {2}',
  feedbackOverallHighlightTemplate: '{0} of respondents gave the session four or five stars.',
  feedbackNoLowStarsNote: 'Nobody gave one or two stars.',
  feedbackQualityHighlightTemplate:
    '{0} of respondents rated the quality of the questions four or five stars.',
  numericPeerCloser: 'Closer to the reference',
  numericPeerUnchanged: 'Unchanged',
  numericPeerFarther: 'Farther away',
  numericPeerChangeBarsTitle: 'Change relative to the reference value',
  qaFollowUpTitle: 'Q&A follow-up',
  qaFollowUpCountsTemplate: '{0} questions submitted · {1} answered or archived · {2} still open',
  qaFollowUpTopOpen: 'Most-voted open question',
  qaFollowUpControversial: 'Discussed controversially',
  teamLearningTitle: 'Team learning profile',
  teamLearningLead:
    'Only teams with at least five members are shown. Strengths: correct-response rate of at least 80% · Needs review: correct-response rate of 40% or lower.',
  teamLearningStrength: 'Strengths',
  teamLearningFocus: 'Needs review',
  tocActionPlan: 'Debriefing plan',
  tocHardestQuestions: 'Questions with the lowest correct-response rates',
  questionTypeSingleChoice: 'Single-answer question',
  questionTypeMultipleChoice: 'Multiple-answer question',
  questionTypeFreeText: 'Free text',
  questionTypeShortText: 'Short answer',
  questionTypeSurvey: 'Survey',
  questionTypeRating: 'Rating',
  questionTypeNumericEstimate: 'Numerical estimate',
};

function mergeLabels(overrides: Partial<SessionResultsReportLabels>): SessionResultsReportLabels {
  return { ...getSessionResultsReportLabelsDe(), ...overrides };
}

export function getSessionResultsReportLabelsEn(): SessionResultsReportLabels {
  return EN_LABELS;
}

export function getSessionResultsReportLabelsFr(): SessionResultsReportLabels {
  return applyFrenchColonTypographyToLabels(mergeLabels(FR_LABEL_OVERRIDES));
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
