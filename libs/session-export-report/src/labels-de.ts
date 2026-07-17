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
  feedbackQuestionQuality: string;
  feedbackWouldRepeat: string;
  feedbackWouldRepeatYes: string;
  feedbackWouldRepeatNo: string;
  confidenceTitle: string;
  confidenceLead: string;
  confidencePriorityAlert: string;
  confidenceMastery: string;
  confidenceRisk: string;
  confidenceFragile: string;
  confidenceValidResponses: string;
  confidenceIncludedQuestions: string;
  confidenceSuppressedQuestions: string;
  confidencePrioritiesTitle: string;
  confidenceWrongHigh: string;
  confidenceIncorrectShare: string;
  confidenceHeatmapTitle: string;
  confidenceDistributionTitle: string;
  confidenceRowCorrect: string;
  confidenceRowIncorrect: string;
  confidenceTierLow: string;
  confidenceTierMid: string;
  confidenceTierHigh: string;
  questionsTitle: string;
  questionNumber: string;
  questionOfTotal: string;
  pageNumberFooter: string;
  questionType: string;
  questionParticipants: string;
  aggregationRound: string;
  averageScore: string;
  optionDistribution: string;
  optionCorrect: string;
  confidenceSection: string;
  confidenceN: string;
  confidenceMasteryCol: string;
  confidenceRiskCol: string;
  confidenceFragileCol: string;
  confidenceGapCol: string;
  confidenceUndecidedCol: string;
  confidenceTopSignal: string;
  aggregationRound1: string;
  aggregationRound2: string;
  aggregationRound1Context: string;
  aggregationRound2Context: string;
  roundParticipationGapTemplate: string;
  numericHistogramTitle: string;
  numericRound1Histogram: string;
  numericRound2Histogram: string;
  numericDeltaHistogram: string;
  teamLeaderboardTitle: string;
  teamRank: string;
  teamName: string;
  teamMembers: string;
  teamTotalScore: string;
  teamAverageScore: string;
  bonusCodesTitle: string;
  bonusCodesNotice: string;
  bonusRank: string;
  bonusNickname: string;
  bonusCode: string;
  bonusScore: string;
  bonusGeneratedAt: string;
  freetextResponses: string;
  shortTextCorrect: string;
  shortTextIncorrect: string;
  numericStats: string;
  numericToleranceBand: string;
  numericReference: string;
  ratingDistribution: string;
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
  coverSummaryFeedback: string;
  coverSummaryParticipants: string;
  coverPrivacyIncluded: string;
  coverPrivacyExcluded: string;
  priorityJumpToQuestion: string;
  heatmapLegendTitle: string;
  heatmapLegendScale: string;
  heatmapLegendHint: string;
  piComparisonTitle: string;
  freetextMoreTemplate: string;
  shortTextExpectedSolutions: string;
  ratingStdDev: string;
  qaTitle: string;
  qaStatus: string;
  qaUpvotes: string;
  qaControversial: string;
  blockquoteTeachingIdea: string;
  blockquoteHint: string;
  exportFooterMeta: string;
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
    coverTitle: 'Ergebnisbericht',
    coverSubtitle: 'Aggregierte Session-Auswertung für Lehrende',
    quizName: 'Quiz',
    sessionCode: 'Session-Code',
    finishedAt: 'Beendet am',
    participantCount: 'Teilnehmende',
    privacyNotice: 'Export für Dokumentation und Evaluation — keine personenbezogenen Daten.',
    feedbackTitle: 'Feedback der Teilnehmenden',
    feedbackOverall: 'Gesamtbewertung',
    feedbackResponses: 'Bewertungen',
    feedbackQuestionQuality: 'Qualität der Fragen',
    feedbackWouldRepeat: 'Nochmal mitmachen?',
    feedbackWouldRepeatYes: 'Ja',
    feedbackWouldRepeatNo: 'Nein',
    confidenceTitle: 'Lernstand und Selbsteinschätzung',
    confidenceLead:
      'Korrektheit und Selbsteinschätzung zusammen zeigen gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
    confidencePriorityAlert: 'Nachbesprechung empfohlen',
    confidenceMastery: 'Gefestigtes Wissen',
    confidenceRisk: 'Fehlkonzept-Risiko',
    confidenceFragile: 'Fragiles Wissen',
    confidenceValidResponses: 'Antworten mit Selbsteinschätzung',
    confidenceIncludedQuestions: 'Ausgewertete Fragen',
    confidenceSuppressedQuestions: 'Nicht aggregiert (<5 Antworten mit Selbsteinschätzung)',
    confidencePrioritiesTitle: 'Priorität für die Nachbesprechung',
    confidenceWrongHigh: 'falsch + hohe Antwortsicherheit',
    confidenceIncorrectShare: 'Falschantworten gesamt',
    confidenceHeatmapTitle: 'Korrektheit × Selbsteinschätzung',
    confidenceDistributionTitle: 'Verteilung der Selbsteinschätzung',
    confidenceRowCorrect: 'Richtig',
    confidenceRowIncorrect: 'Falsch',
    confidenceTierLow: 'Niedrig',
    confidenceTierMid: 'Mittel',
    confidenceTierHigh: 'Hoch',
    questionsTitle: 'Fragen im Detail',
    questionNumber: 'Frage',
    questionOfTotal: 'Frage {0} von {1}',
    pageNumberFooter: 'Seite {0} / {1}',
    questionType: 'Format',
    questionParticipants: 'Teilnehmende',
    aggregationRound: 'Aggregationsrunde',
    averageScore: 'Ø Punkte',
    optionDistribution: 'Antwortverteilung',
    optionCorrect: 'korrekt',
    confidenceSection: 'Selbsteinschätzung',
    confidenceN: 'Antworten',
    confidenceMasteryCol: 'Gefestigt',
    confidenceRiskCol: 'Fehlkonzept-Risiko',
    confidenceFragileCol: 'Fragil',
    confidenceGapCol: 'Wissenslücke',
    confidenceUndecidedCol: 'Unentschieden',
    confidenceTopSignal: 'Stärkstes Signal',
    aggregationRound1: 'Runde 1',
    aggregationRound2: 'Runde 2 (Peer Instruction)',
    aggregationRound1Context: 'Ergebnis aus Aggregationsrunde 1',
    aggregationRound2Context: 'Ergebnis nach Diskussion (Peer Instruction)',
    roundParticipationGapTemplate: 'Runde 1: {0} Stimmen · Ausgewertet in Runde 2: {1} Stimmen',
    numericHistogramTitle: 'Verteilung der Schätzwerte',
    numericRound1Histogram: 'Schätzwerte — Runde 1',
    numericRound2Histogram: 'Schätzwerte — Runde 2',
    numericDeltaHistogram: 'Veränderung zwischen den Runden',
    teamLeaderboardTitle: 'Team-Wertung',
    teamRank: 'Rang',
    teamName: 'Team',
    teamMembers: 'Mitglieder',
    teamTotalScore: 'Team-Punkte',
    teamAverageScore: 'Ø Punkte pro Mitglied',
    bonusCodesTitle: 'Bonus-Codes',
    bonusCodesNotice: 'Pseudonymisierte Codes — Zuordnung nur über freiwillige E-Mail-Einreichung.',
    bonusRank: 'Rang',
    bonusNickname: 'Nickname',
    bonusCode: 'Code',
    bonusScore: 'Punkte',
    bonusGeneratedAt: 'Generiert am',
    freetextResponses: 'Freitext-Antworten',
    shortTextCorrect: 'Richtige Antworten',
    shortTextIncorrect: 'Falsche Antworten',
    numericStats: 'Schätzstatistik',
    numericToleranceBand: 'Toleranzband',
    numericReference: 'Referenz',
    ratingDistribution: 'Bewertungsverteilung',
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
    coverSummaryRisk: 'Mit Fehlkonzept-Risiko',
    coverSummaryFeedback: 'Ø Session-Bewertung',
    coverSummaryParticipants: 'Teilnehmende',
    coverPrivacyIncluded:
      'Enthalten: aggregierte Quiz-Ergebnisse, Selbsteinschätzung, Feedback, Q&A (ohne Nicknames).',
    coverPrivacyExcluded:
      'Nicht enthalten: Einzelstimmen, Nicknames, IP-Adressen, Roh-Freitexte mit Personenbezug.',
    priorityJumpToQuestion: '→ Frage {0}',
    heatmapLegendTitle: 'Legende',
    heatmapLegendScale: 'Intensität nach Anteil an allen Antworten mit Selbsteinschätzung',
    heatmapLegendHint: 'Zahl = Anzahl Antworten in der Zelle',
    piComparisonTitle: 'Peer Instruction — Runde 1 vs. Runde 2',
    freetextMoreTemplate: '+ {0} weitere Antworten',
    shortTextExpectedSolutions: 'Erwartete Lösungen',
    ratingStdDev: 'Standardabweichung',
    qaTitle: 'Q&A-Fragen der Teilnehmenden',
    qaStatus: 'Status',
    qaUpvotes: 'Upvotes',
    qaControversial: 'Umstritten',
    blockquoteTeachingIdea: 'Unterrichtsidee',
    blockquoteHint: 'Hinweis für Lehrende',
    exportFooterMeta: 'Export {0} · Session {1} · Schema v2',
  };
}
