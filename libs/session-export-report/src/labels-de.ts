import type { QuestionType } from '@arsnova/shared-types';

export interface SessionResultsReportLabels {
  documentTitle: string;
  coverTitle: string;
  coverSubtitle: string;
  quizName: string;
  sessionCode: string;
  finishedAt: string;
  participantCount: string;
  privacyNotice: string;
  feedbackTitle: string;
  feedbackOverall: string;
  feedbackResponses: string;
  feedbackCoverageCompactTemplate: string;
  feedbackQuestionQuality: string;
  feedbackWouldRepeat: string;
  feedbackWouldRepeatYes: string;
  feedbackWouldRepeatNo: string;
  confidenceTitle: string;
  confidenceLead: string;
  confidencePriorityAlert: string;
  coverActionTitle: string;
  coverActionWrongTemplate: string;
  coverActionStartTemplate: string;
  confidenceMastery: string;
  confidenceRisk: string;
  confidenceFragile: string;
  confidenceGap: string;
  confidenceMiddle: string;
  confidenceReadingGuideTitle: string;
  confidenceReadingGuideScale: string;
  confidenceReadingGuideMastery: string;
  confidenceReadingGuideRisk: string;
  confidenceReadingGuideFragile: string;
  confidenceReadingGuideGap: string;
  confidenceReadingGuideUndecided: string;
  confidenceValidResponses: string;
  confidenceIncludedQuestions: string;
  confidenceSuppressedQuestions: string;
  confidenceCoverageTemplate: string;
  confidenceCoverageFormulaTemplate: string;
  confidenceNotCollectedTemplate: string;
  confidenceNotSupportedTemplate: string;
  confidenceDisabledTemplate: string;
  confidenceNotCollectedForQuestion: string;
  confidenceNotSupportedForQuestion: string;
  confidenceDisabledForQuestion: string;
  confidencePrioritiesTitle: string;
  confidencePriorityRuleTemplate: string;
  confidenceSignalRuleTemplate: string;
  confidenceWrongHigh: string;
  confidenceIncorrectShare: string;
  countOfTemplate: string;
  confidenceHeatmapTitle: string;
  confidenceDistributionTitle: string;
  confidenceDistributionAxis: string;
  confidenceRowCorrect: string;
  confidenceRowIncorrect: string;
  confidenceTierLow: string;
  confidenceTierMid: string;
  confidenceTierHigh: string;
  questionsTitle: string;
  questionsLead: string;
  backToOverview: string;
  lowSuccessRateHintTemplate: string;
  questionNumber: string;
  questionOfTotal: string;
  questionContinuationTemplate: string;
  pageNumberFooter: string;
  questionType: string;
  questionParticipants: string;
  aggregationRound: string;
  averageScore: string;
  optionDistribution: string;
  optionDistributionMcNote: string;
  optionDistributionMcRule: string;
  optionDistributionValueTemplate: string;
  optionCorrect: string;
  optionIncorrect: string;
  multipleChoiceFullyCorrect: string;
  confidenceSection: string;
  confidenceN: string;
  confidenceMasteryCol: string;
  confidenceRiskCol: string;
  confidenceFragileCol: string;
  confidenceGapCol: string;
  confidenceUndecidedCol: string;
  confidenceTopSignal: string;
  confidenceTopSignalTemplate: string;
  confidenceActionRecommendationTemplate: string;
  confidenceOmissionSignalTemplate: string;
  confidenceOmissionActionTemplate: string;
  confidenceMcCombinedAllOmittedTemplate: string;
  confidenceMcCombinedActionTemplate: string;
  confidenceDegenerateAllHighWrongTemplate: string;
  confidenceDegenerateAllHighWrongResult: string;
  confidenceHighWrongGenericTemplate: string;
  confidenceMasteryZeroNote: string;
  confidenceCompactDistributionTemplate: string;
  confidenceMetricsBasisTemplate: string;
  aggregationRound1: string;
  aggregationRound2: string;
  aggregationRound1Context: string;
  aggregationRound2Context: string;
  roundParticipationGapTemplate: string;
  numericHistogramTitle: string;
  numericRound1Histogram: string;
  numericRound2Histogram: string;
  numericDeltaHistogram: string;
  numericRoundComparisonTitle: string;
  numericComparisonMetric: string;
  numericComparisonAnswers: string;
  numericComparisonMean: string;
  numericComparisonMedian: string;
  numericComparisonStdDev: string;
  numericComparisonInBand: string;
  numericNoChangeTemplate: string;
  numericChangeTemplate: string;
  numericIdenticalHistogram: string;
  numericIdenticalDistributions: string;
  teamLeaderboardTitle: string;
  teamRank: string;
  teamName: string;
  teamMembers: string;
  teamTotalScore: string;
  teamAverageScore: string;
  teamScoreExplanation: string;
  finalSummaryTitle: string;
  finalSummaryPriorityTemplate: string;
  finalSummaryMasteryTemplate: string;
  finalSummaryRiskTemplate: string;
  finalSummaryTopTeamTemplate: string;
  nextStepsDebriefFirstTemplate: string;
  nextStepsDebriefNextTemplate: string;
  nextStepsDebriefOmitTemplate: string;
  nextStepsDebriefWrongTemplate: string;
  nextStepsDebriefWrongVsCorrectTemplate: string;
  nextStepsReteachTemplate: string;
  nextStepsReteachListTemplate: string;
  nextStepsReteachConcreteTemplate: string;
  nextStepsReinforceTemplate: string;
  nextStepsReinforceConcreteTemplate: string;
  scoreExplanation: string;
  bonusCodesTitle: string;
  bonusCodesNotice: string;
  bonusScoreTieNote: string;
  bonusRank: string;
  bonusNickname: string;
  bonusCode: string;
  bonusScore: string;
  bonusGeneratedAt: string;
  freetextResponses: string;
  shortTextCorrect: string;
  shortTextIncorrect: string;
  shortTextIncorrectHeading: string;
  shortTextIncorrectItemTemplate: string;
  shortTextSubmittedAnswers: string;
  numericStats: string;
  numericInBandSummaryTemplate: string;
  numericToleranceBand: string;
  numericReference: string;
  ratingDistribution: string;
  ratingScaleEndpoints: string;
  generatedBy: string;
  questionTypeSingleChoice: string;
  questionTypeMultipleChoice: string;
  questionTypeFreeText: string;
  questionTypeShortText: string;
  questionTypeSurvey: string;
  questionTypeRating: string;
  questionTypeNumericEstimate: string;
  tableOfContentsTitle: string;
  tocFeedback: string;
  tocConfidence: string;
  tocQuestions: string;
  tocQa: string;
  tocTeams: string;
  tocBonus: string;
  coverSummaryQuestions: string;
  coverSummaryRisk: string;
  coverSummaryRiskNote: string;
  coverSummaryFeedback: string;
  coverSummaryFeedbackAvgTemplate: string;
  coverSummaryFeedbackMetaTemplate: string;
  coverSummaryParticipants: string;
  coverPrivacyIncluded: string;
  coverPrivacyExcluded: string;
  reportLanguage: string;
  quizContentLanguage: string;
  priorityJumpToQuestion: string;
  nextQuestion: string;
  heatmapCellCountNote: string;
  heatmapLegendToneTitle: string;
  heatmapLegendToneSuccess: string;
  heatmapLegendToneRisk: string;
  heatmapLegendToneCaution: string;
  heatmapLegendToneNeutral: string;
  heatmapLegendToneMid: string;
  heatmapLegendFrequencyHint: string;
  heatmapCompactLegend: string;
  confidenceScaleEndpoints: string;
  piComparisonTitle: string;
  freetextMoreTemplate: string;
  shortTextExpectedSolutions: string;
  ratingStdDev: string;
  ratingAverageTemplate: string;
  ratingAverageWithSigmaTemplate: string;
  qaTitle: string;
  qaStatus: string;
  qaUpvotes: string;
  qaControversial: string;
  qaPositive: string;
  qaNegative: string;
  blockquoteTeachingIdea: string;
  blockquoteHint: string;
  exportFooterMeta: string;
  actionPlanTitle: string;
  actionPlanDebrief: string;
  actionPlanReinforce: string;
  actionPlanReteach: string;
  actionPlanObserve: string;
  actionPlanDone: string;
  actionPlanStartTemplate: string;
  actionPlanCriteriaNote: string;
  actionPlanCriteriaLink: string;
  hardestQuestionsTitle: string;
  hardestQuestionsLead: string;
  hardestQuestionRateTemplate: string;
  hardestQuestionDifficultyMismatchTemplate: string;
  difficultyEasy: string;
  difficultyMedium: string;
  difficultyHard: string;
  participationOverviewTitle: string;
  participationDropTemplate: string;
  participationStableTemplate: string;
  participationDeclineTemplate: string;
  questionParticipationTemplate: string;
  questionParticipationMissingTemplate: string;
  roundParticipationDropTemplate: string;
  distractorAnalysisTitle: string;
  strongestDistractor: string;
  distractorChosenByTemplate: string;
  distractorAsAttractiveAsCorrect: string;
  mcFalseSelection: string;
  mcOmission: string;
  mcOmissionCountTemplate: string;
  unusedDistractorTemplate: string;
  piGainTitle: string;
  piGainCorrectTemplate: string;
  piGainDeltaUpTemplate: string;
  piGainDeltaDownTemplate: string;
  piGainUnchanged: string;
  piGainCeilingTemplate: string;
  piGainCeilingNumericTemplate: string;
  piGainWrongToCorrectTemplate: string;
  piGainCorrectToWrongTemplate: string;
  numericPiGainInBandTemplate: string;
  numericPiGainPairedTemplate: string;
  numericPlainInBandTemplate: string;
  numericPlainIqrTemplate: string;
  numericPlainExactHalfTemplate: string;
  numericPlainMaeTemplate: string;
  responseTimeTitle: string;
  responseTimeRound1Title: string;
  responseTimeMedianTemplate: string;
  responseTimeMedianOneTemplate: string;
  responseTimeNearDeadlineTemplate: string;
  responseTimePressureHint: string;
  feedbackCoverageTemplate: string;
  feedbackWouldRepeatSummaryTemplate: string;
  feedbackOverallHighlightTemplate: string;
  feedbackNoLowStarsNote: string;
  feedbackQualityHighlightTemplate: string;
  numericPeerCloser: string;
  numericPeerUnchanged: string;
  numericPeerFarther: string;
  numericPeerChangeBarsTitle: string;
  qaFollowUpTitle: string;
  qaFollowUpCountsTemplate: string;
  qaFollowUpTopOpen: string;
  qaFollowUpControversial: string;
  teamLearningTitle: string;
  teamLearningLead: string;
  teamLearningStrength: string;
  teamLearningFocus: string;
  tocActionPlan: string;
  tocHardestQuestions: string;
}

export function questionTypeLabelForReport(
  type: QuestionType,
  labels: SessionResultsReportLabels,
): string {
  switch (type) {
    case 'SINGLE_CHOICE':
      return labels.questionTypeSingleChoice;
    case 'MULTIPLE_CHOICE':
      return labels.questionTypeMultipleChoice;
    case 'FREETEXT':
      return labels.questionTypeFreeText;
    case 'SHORT_TEXT':
      return labels.questionTypeShortText;
    case 'SURVEY':
      return labels.questionTypeSurvey;
    case 'RATING':
      return labels.questionTypeRating;
    case 'NUMERIC_ESTIMATE':
      return labels.questionTypeNumericEstimate;
    default: {
      const _exhaustive: never = type;
      return String(_exhaustive);
    }
  }
}

export function getSessionResultsReportLabelsDe(): SessionResultsReportLabels {
  return {
    documentTitle: 'Session-Ergebnisbericht',
    coverTitle: 'Didaktische Quiz-Auswertung',
    coverSubtitle: 'Lernstand, Fehlkonzepte und Nachbesprechungsplan',
    quizName: 'Quiz',
    sessionCode: 'Session-Code',
    finishedAt: 'Beendet am',
    participantCount: 'Teilnehmende',
    privacyNotice:
      'Datenschutz: Der Bericht enthält ausschließlich aggregierte Ergebnisse. Klarnamen, IP-Adressen und Einzelstimmen werden nicht exportiert. Pseudonyme Nicknames erscheinen nur bei Bonus-Codes.',
    feedbackTitle: 'Feedback der Teilnehmenden',
    feedbackOverall: 'Gesamtbewertung',
    feedbackResponses: 'Bewertungen',
    feedbackCoverageCompactTemplate: '{0} Rückmeldungen · Rücklauf {1}',
    feedbackQuestionQuality: 'Qualität der Fragen',
    feedbackWouldRepeat: 'Weitere Quizze gewünscht',
    feedbackWouldRepeatYes: 'Ja',
    feedbackWouldRepeatNo: 'Nein',
    confidenceTitle: 'Lernstand und Selbsteinschätzung',
    confidenceLead:
      'Korrektheit und Selbsteinschätzung zusammen zeigen gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
    confidencePriorityAlert: 'Nachbesprechung empfohlen',
    coverActionTitle: 'Das solltest du nachbesprechen',
    coverActionWrongTemplate: '{0} von {1} falsch und sicher',
    coverActionStartTemplate: 'Empfohlener Einstieg: Beginne mit Frage {0}.',
    confidenceMastery: 'Gefestigtes Wissen',
    confidenceRisk: 'Antworten mit Fehlkonzept-Muster',
    confidenceFragile: 'Fragiles Wissen',
    confidenceGap: 'Wissenslücke',
    confidenceMiddle: 'Mittlere Sicherheit',
    confidenceReadingGuideTitle: 'So liest du die Auswertung',
    confidenceReadingGuideScale: 'Selbsteinschätzung 1–5: Niedrig = 1–2 · Mittel = 3 · Hoch = 4–5',
    confidenceReadingGuideMastery:
      'Gefestigtes Wissen = richtige Antwort + hohe Selbsteinschätzung (4–5)',
    confidenceReadingGuideRisk:
      'Antwort mit Fehlkonzept-Muster = falsche Antwort + hohe Selbsteinschätzung (4–5)',
    confidenceReadingGuideFragile:
      'Fragiles Wissen = richtige Antwort + niedrige Selbsteinschätzung (1–2)',
    confidenceReadingGuideGap: 'Wissenslücke = falsche Antwort + niedrige Selbsteinschätzung (1–2)',
    confidenceReadingGuideUndecided:
      'Mittlere Sicherheit = Sicherheitsstufe 3, korrekt oder falsch; keine Diagnosekategorie',
    confidenceValidResponses: 'Antworten mit Selbsteinschätzung',
    confidenceIncludedQuestions: 'Ausgewertete Fragen',
    confidenceSuppressedQuestions: 'Nicht aggregiert (<5 Antworten mit Selbsteinschätzung)',
    confidenceCoverageTemplate:
      'Selbsteinschätzung wurde bei {0} von {1} Fragen erhoben. Dabei entstanden {2} Antworten.',
    confidenceCoverageFormulaTemplate:
      '{0} Fragen × {1} Teilnehmende = {2} Antworten mit Selbsteinschätzung.',
    confidenceNotCollectedTemplate: 'Keine auswertbare Selbsteinschätzung bei: {0}.',
    confidenceNotSupportedTemplate: 'Nicht unterstützt bei: {0}.',
    confidenceDisabledTemplate: 'In diesem Quiz deaktiviert bei: {0}.',
    confidenceNotCollectedForQuestion: 'Für diese Frage wurde keine Selbsteinschätzung erhoben.',
    confidenceNotSupportedForQuestion:
      'Selbsteinschätzung wird für den Fragetyp »{0}« nicht angeboten.',
    confidenceDisabledForQuestion: 'Selbsteinschätzung von dir in diesem Quiz deaktiviert.',
    confidencePrioritiesTitle: 'Priorität für die Nachbesprechung',
    confidencePriorityRuleTemplate:
      '{0} Fragen zur Nachbesprechung empfohlen: Mindestens 2 Personen und mindestens 10 % antworteten falsch und mit hoher Sicherheit. Einzelne Fälle werden nur als Hinweis markiert.',
    confidenceSignalRuleTemplate:
      '{0} Fragen auf Hinweisstufe, weil dort mindestens eine falsche Antwort mit hoher Sicherheit abgegeben wurde.',
    confidenceWrongHigh: 'Falsch und sicher',
    confidenceIncorrectShare: 'Falschantworten insgesamt',
    countOfTemplate: '{0} von {1}',
    confidenceHeatmapTitle: 'Korrektheit × Selbsteinschätzung',
    confidenceDistributionTitle: 'Verteilung der Selbsteinschätzung',
    confidenceDistributionAxis: 'Anzahl Antworten',
    confidenceRowCorrect: 'Richtig',
    confidenceRowIncorrect: 'Falsch',
    confidenceTierLow: 'Niedrig',
    confidenceTierMid: 'Mittel',
    confidenceTierHigh: 'Hoch',
    questionsTitle: 'Fragen im Detail',
    questionsLead:
      'Die Fragentexte entsprechen der Anzeige für Teilnehmende (inkl. Bilder, Formeln und Zusatzkontext).',
    backToOverview: '↑ Zur Übersicht',
    lowSuccessRateHintTemplate:
      '{0} richtig – ungewöhnlich schwierig; ein kurzer Rückblick könnte helfen.',
    questionNumber: 'Frage',
    questionOfTotal: 'Frage {0} von {1}',
    questionContinuationTemplate: 'Frage {0} – Fortsetzung: {1}',
    pageNumberFooter: 'Seite {0} / {1}',
    questionType: 'Format',
    questionParticipants: 'Teilnehmende',
    aggregationRound: 'Aggregationsrunde',
    averageScore: 'Ø Punkte',
    optionDistribution: 'Antwortverteilung',
    optionDistributionMcNote:
      'Prozent = Anteil der Teilnehmenden, die diese Option gewählt haben. Bei Mehrfachauswahl kann die Summe über 100 % liegen.',
    optionDistributionMcRule:
      'Eine Antwort zählt nur dann als vollständig richtig, wenn alle richtigen und keine falsche Option ausgewählt wurden.',
    optionDistributionValueTemplate: '{0} · {1} von {2}',
    optionCorrect: 'korrekt',
    optionIncorrect: 'falsch',
    multipleChoiceFullyCorrect: 'Vollständig richtig',
    confidenceSection: 'Selbsteinschätzung',
    confidenceN: 'Antworten',
    confidenceMasteryCol: 'Gefestigt',
    confidenceRiskCol: 'Fehlkonzept-Muster',
    confidenceFragileCol: 'Fragil',
    confidenceGapCol: 'Wissenslücke',
    confidenceUndecidedCol: 'Mittlere Sicherheit',
    confidenceTopSignal: '⚠ Nachbesprechungsimpuls',
    confidenceTopSignalTemplate: '{1} Teilnehmende wählten „{0}“ falsch und mit hoher Sicherheit.',
    confidenceActionRecommendationTemplate:
      'Empfehlung: Greife „{0}“ erneut auf, lasse die Wahl begründen und stelle sie der richtigen Lösung gegenüber.',
    confidenceOmissionSignalTemplate:
      '{1} Teilnehmende beantworteten die Frage falsch und mit hoher Sicherheit. Häufig übersehen: „{0}“ ({2}×).',
    confidenceOmissionActionTemplate:
      'Empfehlung: Kläre, warum „{0}“ zur vollständigen Lösung gehört, und lasse typische Auslassungen begründen.',
    confidenceMcCombinedAllOmittedTemplate:
      '{0} Teilnehmende beantworteten die Frage falsch und mit hoher Sicherheit. Alle übersahen die richtige Option „{1}“. {2} wählten zusätzlich „{3}“.',
    confidenceMcCombinedActionTemplate:
      'Kläre zuerst, dass „{0}“ zur vollständigen Lösung gehört. Stelle anschließend heraus, weshalb „{1}“ nicht zutrifft.',
    confidenceDegenerateAllHighWrongTemplate:
      'Antwortsicherheit: Alle {0} Antworten mit hoher Sicherheit',
    confidenceDegenerateAllHighWrongResult: 'Ergebnis: Alle {0} Antworten vollständig falsch',
    confidenceHighWrongGenericTemplate:
      '{0} Teilnehmende beantworteten die Frage falsch und mit hoher Sicherheit.',
    confidenceMasteryZeroNote:
      '0 % gefestigt bedeutet nicht 0 % richtige Antworten. Die richtigen Antworten wurden hier überwiegend mit niedriger oder mittlerer Sicherheit gegeben.',
    confidenceCompactDistributionTemplate:
      'Selbsteinschätzung: {0} niedrig · {1} mittel · {2} hoch',
    confidenceMetricsBasisTemplate:
      'Gerundeter Anteil an allen {0} Antworten mit Selbsteinschätzung (Summe 100 %)',
    aggregationRound1: 'Runde 1',
    aggregationRound2: 'Runde 2 (Peer Instruction)',
    aggregationRound1Context: 'Ergebnis der Abstimmung',
    aggregationRound2Context: 'Ergebnis nach Diskussion – Runde 2',
    roundParticipationGapTemplate: 'Runde 1: {0} Stimmen · Ausgewertet in Runde 2: {1} Stimmen',
    numericHistogramTitle: 'Verteilung der Schätzwerte',
    numericRound1Histogram: 'Schätzwerte — Runde 1',
    numericRound2Histogram: 'Schätzwerte — Runde 2',
    numericDeltaHistogram: 'Veränderung zwischen den Runden',
    numericRoundComparisonTitle: 'Vergleich der Schätzrunden',
    numericComparisonMetric: 'Kennzahl',
    numericComparisonAnswers: 'Antworten',
    numericComparisonMean: 'Mittelwert',
    numericComparisonMedian: 'Median',
    numericComparisonStdDev: 'Standardabweichung',
    numericComparisonInBand: 'Im Toleranzbereich',
    numericNoChangeTemplate: 'Keine Veränderung zwischen den Runden: {0} von {1} Antworten.',
    numericChangeTemplate:
      'Veränderung: {0} näher am Referenzwert · {1} weiter entfernt · {2} unverändert',
    numericIdenticalHistogram: 'Schätzwerte — beide Runden',
    numericIdenticalDistributions:
      'Keine sichtbare Veränderung – beide Verteilungen sind identisch.',
    teamLeaderboardTitle: 'Team-Wertung',
    teamRank: 'Rang',
    teamName: 'Team',
    teamMembers: 'Mitglieder',
    teamTotalScore: 'Team-Score',
    teamAverageScore: 'Ø Punkte pro Mitglied',
    teamScoreExplanation:
      'Der Team-Score ist der Mittelwert der Mitgliedspunkte. So bleiben unterschiedlich große Teams vergleichbar.',
    finalSummaryTitle: 'Nächste Schritte',
    finalSummaryPriorityTemplate: '{0} Fragen sollten nachbesprochen werden',
    finalSummaryMasteryTemplate: '{0} der Antworten mit gefestigtem Wissen',
    finalSummaryRiskTemplate: '{0} der Antworten mit Fehlkonzept-Risiko',
    finalSummaryTopTeamTemplate: '{0} erreichte den höchsten Team-Score',
    nextStepsDebriefFirstTemplate: 'Frage {0} zuerst nachbesprechen (Fehlkonzept)',
    nextStepsDebriefNextTemplate: 'Frage {0} als Nächstes klären',
    nextStepsDebriefOmitTemplate: 'Bei Frage {0} die übersehene Option „{1}“ klären.',
    nextStepsDebriefWrongTemplate: 'Bei Frage {0} die Unterscheidung bei „{1}“ erklären.',
    nextStepsDebriefWrongVsCorrectTemplate:
      'Bei Frage {0} erklären, warum „{1}“ falsch und „{2}“ richtig ist.',
    nextStepsReteachTemplate: 'Frage {0} erneut erklären',
    nextStepsReteachListTemplate: 'Fragen {0} erneut erklären',
    nextStepsReteachConcreteTemplate:
      'Bei Fragen {0} die zugrunde liegenden Fachbegriffe wiederholen.',
    nextStepsReinforceTemplate: 'Fragen {0} kurz absichern (richtig, aber noch unsicher)',
    nextStepsReinforceConcreteTemplate:
      'Bei Frage {0} die korrekte Lösung bestätigen (Lösungsquote {1} – richtig, aber noch unsicher).',
    scoreExplanation:
      'Punkte sind ein Rankingwert aus Korrektheit, Schwierigkeit, Antwortzeit bei aktivem Timer und Serienbonus. Die Selbsteinschätzung beeinflusst die Punkte nicht. Da der erreichbare Wert vom Quizverlauf abhängt, sind Punktestände keine Prozentwerte und nicht zwischen Sessions vergleichbar.',
    bonusCodesTitle: 'Bonus-Codes',
    bonusCodesNotice: 'Pseudonymisierte Codes — Zuordnung nur über freiwillige E-Mail-Einreichung.',
    bonusScoreTieNote: 'Bei gleicher Punktzahl entscheidet die gewertete Antwortzeit.',
    bonusRank: 'Rang',
    bonusNickname: 'Nickname',
    bonusCode: 'Code',
    bonusScore: 'Punkte',
    bonusGeneratedAt: 'Generiert am',
    freetextResponses: 'Freitext-Antworten',
    shortTextCorrect: 'Richtig beantwortet',
    shortTextIncorrect: 'Falsch beantwortet',
    shortTextIncorrectHeading: 'Häufigste nicht akzeptierte Antworten',
    shortTextIncorrectItemTemplate: '„{0}“ · {1} von {2}',
    shortTextSubmittedAnswers: 'Eingereichte Antworten',
    numericStats: 'Schätzstatistik',
    numericInBandSummaryTemplate: '{0} von {1} Antworten lagen im akzeptierten Bereich {2}–{3}.',
    numericToleranceBand: 'Akzeptierter Bereich',
    numericReference: 'Referenz',
    ratingDistribution: 'Bewertung auf einer Skala von 1 bis 5',
    ratingScaleEndpoints: '1 = sehr unwahrscheinlich · 5 = sehr wahrscheinlich',
    generatedBy: 'Erstellt mit arsnova.eu',
    questionTypeSingleChoice: 'Single Choice',
    questionTypeMultipleChoice: 'Multiple Choice',
    questionTypeFreeText: 'Freitext',
    questionTypeShortText: 'Kurzantwort',
    questionTypeSurvey: 'Umfrage',
    questionTypeRating: 'Bewertung',
    questionTypeNumericEstimate: 'Numerische Schätzfrage',
    tableOfContentsTitle: 'Inhalt',
    tocFeedback: 'Feedback der Teilnehmenden',
    tocConfidence: 'Lernstand und Selbsteinschätzung',
    tocQuestions: 'Fragen im Detail',
    tocQa: 'Q&A-Fragen',
    tocTeams: 'Team-Wertung',
    tocBonus: 'Bonus-Codes',
    coverSummaryQuestions: 'Fragen',
    coverSummaryRisk: 'Fragen mit Fehlkonzept-Muster',
    coverSummaryRiskNote:
      'Eine Frage zählt dazu, wenn mindestens 2 Personen und mindestens 10 % falsch und sicher geantwortet haben.',
    coverSummaryFeedback: 'Teilnehmendenfeedback',
    coverSummaryFeedbackAvgTemplate: '{0} von 5 ★',
    coverSummaryFeedbackMetaTemplate: '{0} Rückmeldungen',
    coverSummaryParticipants: 'Teilnehmende',
    coverPrivacyIncluded:
      'Enthalten: aggregierte Quiz-Ergebnisse, Selbsteinschätzung, Feedback, Q&A (ohne reale Namen).',
    coverPrivacyExcluded:
      'Nicht enthalten: reale Namen, IP-Adressen, Einzelstimmen, Roh-Freitexte mit Personenbezug. Pseudonyme Nicknames nur bei Bonus-Codes.',
    reportLanguage: 'Berichtssprache',
    quizContentLanguage: 'Quizinhalt',
    priorityJumpToQuestion: '→ Frage {0}',
    nextQuestion: 'Nächste Frage',
    heatmapCellCountNote: 'Die Zahl in jeder Zelle zeigt die Anzahl der Antworten.',
    heatmapLegendToneTitle: 'Diagnosekategorien',
    heatmapLegendToneSuccess: '✓ Gefestigt: richtig und hohe Selbsteinschätzung',
    heatmapLegendToneRisk: '⚠ Fehlkonzept-Muster: falsch und hohe Selbsteinschätzung',
    heatmapLegendToneCaution: '◯ Wissenslücke: falsch und niedrige Selbsteinschätzung',
    heatmapLegendToneNeutral: '? Fragil: richtig und niedrige Selbsteinschätzung',
    heatmapLegendToneMid: 'M Mittel: Selbsteinschätzung 3, unabhängig von richtig oder falsch',
    heatmapLegendFrequencyHint: 'Symbole kennzeichnen die Diagnosekategorie.',
    heatmapCompactLegend: '✓ Gefestigt · ⚠ Fehlkonzept · ? Fragil · ◯ Wissenslücke · M Mittel',
    confidenceScaleEndpoints: '1 = sehr unsicher · 5 = sehr sicher',
    piComparisonTitle: 'Peer Instruction — Runde 1 vs. Runde 2',
    freetextMoreTemplate: '+ {0} weitere Antworten',
    shortTextExpectedSolutions: 'Akzeptierte Lösungen',
    ratingStdDev: 'Standardabweichung',
    ratingAverageTemplate: 'Ø {0} von 5 ★',
    ratingAverageWithSigmaTemplate: 'Ø {0} von 5 ★ · σ {1}',
    qaTitle: 'Q&A-Fragen der Teilnehmenden',
    qaStatus: 'Status',
    qaUpvotes: 'Upvotes',
    qaControversial: 'Umstritten',
    qaPositive: 'positiv',
    qaNegative: 'negativ',
    blockquoteTeachingIdea: 'Unterrichtsidee',
    blockquoteHint: 'Hinweis für Lehrende',
    exportFooterMeta: 'Export {0} · Session {1}',
    actionPlanTitle: 'Dein Nachbesprechungsplan',
    actionPlanDebrief: 'Fehlkonzept zuerst klären',
    actionPlanReinforce: 'Richtige Lösung kurz absichern',
    actionPlanReteach: 'Grundlage erneut erklären',
    actionPlanObserve: 'Kurz überprüfen',
    actionPlanDone: 'Überwiegend gefestigt',
    actionPlanStartTemplate: 'Empfohlener Einstieg: Frage {0}',
    actionPlanCriteriaNote:
      'Automatisch priorisiert nach Fehlkonzept-Risiko, Lösungsquote und Antwortsicherheit.',
    actionPlanCriteriaLink: '→ Kriterien zur Einordnung',
    hardestQuestionsTitle: 'Schwierigste Fragen',
    hardestQuestionsLead:
      'Empirische Lösungsquote: Anteil vollständig richtiger Antworten. Eine niedrige Quote kann auch an Formulierung oder Zeitlimit liegen.',
    hardestQuestionRateTemplate: 'Lösungsquote {0} ({1} von {2} vollständig richtig)',
    hardestQuestionDifficultyMismatchTemplate:
      'Als „{0}“ konfiguriert, aber nur {1} der bewerteten Antworten vollständig richtig – Schwierigkeit oder Formulierung prüfen.',
    difficultyEasy: 'leicht',
    difficultyMedium: 'mittel',
    difficultyHard: 'schwer',
    participationOverviewTitle: 'Teilnahmeverlauf',
    participationDropTemplate: 'Seit Beginn gingen {0} von {1} Antwortenden verloren.',
    participationStableTemplate:
      'Stabile Teilnahme: An allen {0} Fragen beteiligten sich jeweils {1} Personen.',
    participationDeclineTemplate: 'Die Beteiligung sank von {0} auf {1} Antworten.',
    questionParticipationTemplate: 'Antwortquote: {0} von {1} · {2}',
    questionParticipationMissingTemplate: '{0} Teilnehmende gaben keine Antwort ab.',
    roundParticipationDropTemplate:
      'Runde 1: {0} Antworten · Runde 2: {1} Antworten · {2} Personen nahmen an der zweiten Runde nicht mehr teil.',
    distractorAnalysisTitle: 'Auswahlfehler',
    strongestDistractor: 'Stärkster Distraktor (häufigste falsche Antwort)',
    distractorChosenByTemplate: 'gewählt von {0} Personen',
    distractorAsAttractiveAsCorrect:
      'Die falsche Option war genauso attraktiv wie die richtige Antwort.',
    mcFalseSelection: 'Häufigster Auswahlfehler',
    mcOmission: 'Häufigste Auslassung',
    mcOmissionCountTemplate: 'von {0} Personen übersehen',
    unusedDistractorTemplate:
      'Die falsche Option „{0}“ wurde in dieser Session nicht gewählt – ggf. zu offensichtlich.',
    piGainTitle: 'Wirkung der Diskussion',
    piGainCorrectTemplate: 'Vollständig richtig: {0} von {1} → {2} von {3}',
    piGainDeltaUpTemplate: '+{0} Prozentpunkte',
    piGainDeltaDownTemplate: '−{0} Prozentpunkte',
    piGainUnchanged: 'Kein messbarer Zuwachs bei vollständig richtigen Antworten',
    piGainCeilingTemplate:
      'Kein weiterer Lernzuwachs messbar: Bereits in Runde 1 lagen {0} von {1} Antworten vollständig richtig. Eine zweite Runde war fachlich nicht erforderlich.',
    piGainCeilingNumericTemplate:
      'Kein weiterer Lernzuwachs messbar: Bereits in Runde 1 lagen {0} von {1} Antworten im akzeptierten Bereich. Eine zweite Runde war fachlich nicht erforderlich.',
    piGainWrongToCorrectTemplate: '{0} Teilnehmende wechselten von falsch zu richtig.',
    piGainCorrectToWrongTemplate: '{0} Personen wechselten von richtig zu falsch.',
    numericPiGainInBandTemplate: 'Im akzeptierten Bereich: {0} von {1} → {2} von {3}',
    numericPiGainPairedTemplate:
      '{0} näher am Referenzwert · {1} weiter entfernt · {2} unverändert',
    numericPlainInBandTemplate: '{0} von {1} Antworten lagen im akzeptierten Bereich.',
    numericPlainIqrTemplate: 'Die mittleren 50 % der Schätzungen lagen zwischen {0} und {1}.',
    numericPlainExactHalfTemplate: 'Mindestens die Hälfte der Teilnehmenden gab exakt {0} an.',
    numericPlainMaeTemplate: 'Die durchschnittliche Abweichung vom Referenzwert betrug {0}.',
    responseTimeTitle: 'Antwortzeit',
    responseTimeRound1Title: 'Antwortzeit in Runde 1',
    responseTimeMedianTemplate: 'Median: {0} Sekunden',
    responseTimeMedianOneTemplate: 'Median: 1 Sekunde',
    responseTimeNearDeadlineTemplate:
      '{0} von {1} Antworten wurden in den letzten 20 % der verfügbaren Zeit abgegeben.',
    responseTimePressureHint: 'Hinweis: Das Zeitlimit könnte für diese Frage knapp gewesen sein.',
    feedbackCoverageTemplate: 'Feedbackquote: {0} von {1} · {2}',
    feedbackWouldRepeatSummaryTemplate: '{0} von {1} wünschen sich weitere Quizze · {2}',
    feedbackOverallHighlightTemplate:
      '{0} der Rückmeldungen bewerteten die Session mit vier oder fünf Sternen.',
    feedbackNoLowStarsNote: 'Niemand vergab ein oder zwei Sterne.',
    feedbackQualityHighlightTemplate:
      '{0} der Rückmeldungen bewerteten die Fragenqualität mit vier oder fünf Sternen.',
    numericPeerCloser: 'Näher am Referenzwert',
    numericPeerUnchanged: 'Unverändert',
    numericPeerFarther: 'Weiter entfernt',
    numericPeerChangeBarsTitle: 'Veränderung zum Referenzwert',
    qaFollowUpTitle: 'Q&A-Nachbereitung',
    qaFollowUpCountsTemplate:
      '{0} Fragen eingereicht · {1} beantwortet oder archiviert · {2} noch offen',
    qaFollowUpTopOpen: 'Meistgewählte offene Frage',
    qaFollowUpControversial: 'Kontrovers diskutiert',
    teamLearningTitle: 'Team-Lernprofil',
    teamLearningLead:
      'Nur Teams mit mindestens fünf Mitgliedern. Stärke: Lösungsquote mindestens 80 % · Klärungsbedarf: höchstens 40 %.',
    teamLearningStrength: 'Stärke',
    teamLearningFocus: 'Klärungsbedarf',
    tocActionPlan: 'Nachbesprechungsplan',
    tocHardestQuestions: 'Schwierigste Fragen',
  };
}
