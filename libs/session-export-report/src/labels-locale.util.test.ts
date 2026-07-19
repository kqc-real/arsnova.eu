import { describe, expect, it } from 'vitest';
import {
  getSessionResultsReportLabelsDe,
  getSessionResultsReportLabelsEn,
  getSessionResultsReportLabelsEs,
  getSessionResultsReportLabelsFr,
  getSessionResultsReportLabelsIt,
  getSessionResultsReportLabelsForLocale,
  type SessionResultsReportLabels,
} from './labels-locale.util';
import { REPORT_COVER_LOGO_SVG } from './report-cover-logo';

/** Keys that may intentionally match DE (cognates / shared loanwords). */
const ALLOW_SAME_AS_DE: Record<string, ReadonlySet<string>> = {
  en: new Set([
    'quizName',
    'questionType',
    'numericComparisonMedian',
    'teamName',
    'bonusNickname',
    'bonusCode',
    'questionTypeSingleChoice',
    'questionTypeMultipleChoice',
    'qaStatus',
    'qaUpvotes',
    'exportFooterMeta',
  ]),
  fr: new Set(['quizName', 'bonusCode', 'teamRank', 'bonusRank']),
  es: new Set(),
  it: new Set(['quizName']),
};

describe('labels-locale', () => {
  it('folgt dem Glossar für Kernbegriffe (EN/FR/ES/IT)', () => {
    expect(getSessionResultsReportLabelsEn().confidenceRiskCol).toBe('Possible misconception');
    expect(getSessionResultsReportLabelsEn().confidenceSection).toBe('Answer confidence');
    expect(getSessionResultsReportLabelsEn().confidencePriorityRuleTemplate).toContain(
      'are recommended for debriefing',
    );
    expect(getSessionResultsReportLabelsEn().confidencePriorityRuleTemplate).toContain(
      'At least two participants—and at least 10% of respondents—answered incorrectly',
    );
    expect(getSessionResultsReportLabelsEn().confidencePriorityRuleTemplate).toContain(
      'shown for information only',
    );
    expect(getSessionResultsReportLabelsEn().confidenceScCombinedActionTemplate).toContain(
      'is the correct answer',
    );
    expect(getSessionResultsReportLabelsEn().feedbackQualityHighlightTemplate).toContain(
      'rated the quality of the questions four or five stars',
    );
    expect(getSessionResultsReportLabelsEn().confidenceNotSupportedTemplate).toBe(
      'Answer confidence is not collected for {0}.',
    );
    expect(getSessionResultsReportLabelsEn().confidenceDisabledTemplate).toBe(
      'Answer confidence was disabled for {0} in this quiz.',
    );
    expect(getSessionResultsReportLabelsEn().questionTypeNumericEstimate).toBe(
      'Numerical estimate',
    );
    expect(getSessionResultsReportLabelsEn().hardestQuestionRateTemplate).toContain(
      'Correct-response rate:',
    );
    expect(getSessionResultsReportLabelsEn().bonusCodesNotice).toContain(
      'can be linked to identities only through voluntary email submission',
    );
    expect(getSessionResultsReportLabelsEn().actionPlanReinforce).toBe(
      'Briefly reinforce correct answers',
    );
    expect(getSessionResultsReportLabelsEn().heatmapCompactLegend).toContain(
      'Possible misconception',
    );
    expect(getSessionResultsReportLabelsEn().confidenceReadingGuideRisk).toContain(
      'Indicator of a possible misconception',
    );
    expect(getSessionResultsReportLabelsEn().questionTypeSingleChoice).toBe(
      'Single-answer question',
    );
    expect(getSessionResultsReportLabelsFr().hardestQuestionRateTemplate).toContain(
      'Taux de réponses correctes',
    );
    expect(getSessionResultsReportLabelsFr().questionNumber).toBe('Question');
    expect(getSessionResultsReportLabelsFr().confidenceSection).toBe('Confiance dans la réponse');
    expect(getSessionResultsReportLabelsFr().aggregationRound2).toContain('Peer Instruction');
    expect(getSessionResultsReportLabelsFr().aggregationRound2).not.toContain(
      'Instruction par les pairs',
    );
    expect(getSessionResultsReportLabelsFr().actionPlanReinforce).toContain(
      'Consolider brièvement les bonnes réponses',
    );
    expect(getSessionResultsReportLabelsFr().coverSummaryRiskNote).toContain(
      'est signalée lorsqu’au moins deux participants',
    );
    expect(getSessionResultsReportLabelsFr().feedbackTitle).toBe('Avis des participants');
    expect(getSessionResultsReportLabelsFr().confidenceCoverageTemplate).toContain('recueilli');
    expect(getSessionResultsReportLabelsFr().confidenceScCombinedActionTemplate).toContain(
      'est la bonne réponse',
    );
    expect(getSessionResultsReportLabelsFr().confidenceNotSupportedForQuestion).toContain(
      'n’est pas recueillie pour les questions de type',
    );
    expect(getSessionResultsReportLabelsFr().distractorChosenByTemplate).toBe(
      'choisi par {0} participants',
    );
    expect(getSessionResultsReportLabelsFr().optionChosenByTemplate).toBe(
      'choisie par {0} participants',
    );
    expect(getSessionResultsReportLabelsFr().actionPlanStartTemplate).toContain('\u00A0:');
    expect(getSessionResultsReportLabelsFr().confidenceCompactDistributionTemplate).toContain(
      '\u00A0:',
    );
    expect(getSessionResultsReportLabelsFr().multipleChoiceFullyCorrect).toBe(
      'Réponses entièrement correctes',
    );
    expect(getSessionResultsReportLabelsFr().numericPeerCloser).toContain('Plus proches');
    expect(getSessionResultsReportLabelsFr().nextStepsReinforceLowConfidenceTemplate).toContain(
      'faible degré de confiance',
    );
    expect(getSessionResultsReportLabelsEs().tocActionPlan).toBe('Plan para la puesta en común');
    expect(getSessionResultsReportLabelsIt().tocActionPlan).toBe(
      'Piano per la discussione dei risultati',
    );
    expect(getSessionResultsReportLabelsIt().confidenceFragile).toBe(
      'Conoscenze non ancora consolidate',
    );
  });

  it('hat keine unbeabsichtigten DE-Fallbacks in EN/FR/ES/IT', () => {
    const de = getSessionResultsReportLabelsDe();
    const locales: Array<['en' | 'fr' | 'es' | 'it', SessionResultsReportLabels]> = [
      ['en', getSessionResultsReportLabelsEn()],
      ['fr', getSessionResultsReportLabelsFr()],
      ['es', getSessionResultsReportLabelsEs()],
      ['it', getSessionResultsReportLabelsIt()],
    ];
    for (const [locale, labels] of locales) {
      const allow = ALLOW_SAME_AS_DE[locale];
      const leaks = Object.keys(de).filter(
        (key) => labels[key as keyof typeof de] === de[key as keyof typeof de] && !allow.has(key),
      );
      expect(leaks, `${locale} still falls back to DE`).toEqual([]);
    }
  });
  it('liefert FR/ES/IT statt EN-Fallback', () => {
    expect(getSessionResultsReportLabelsFr().coverTitle).toBe('Analyse pédagogique du quiz');
    expect(getSessionResultsReportLabelsEs().coverTitle).toBe(
      'Análisis pedagógico del cuestionario',
    );
    expect(getSessionResultsReportLabelsIt().coverTitle).toBe('Analisi didattica del quiz');
    expect(getSessionResultsReportLabelsForLocale('fr-FR').tableOfContentsTitle).toBe('Sommaire');
  });

  it('behält DE/EN getrennt', () => {
    expect(getSessionResultsReportLabelsDe().coverTitle).toBe('Didaktische Quiz-Auswertung');
    expect(getSessionResultsReportLabelsEn().coverTitle).toBe('Quiz Insights for Teaching');
    expect(getSessionResultsReportLabelsDe().documentTitle).toBe('Didaktische Quiz-Auswertung');
    expect(getSessionResultsReportLabelsEn().documentTitle).toBe('Quiz Insights for Teaching');
  });

  it('lokalisiert neue Cover-/Fragen-Labels auch in FR/ES/IT', () => {
    const de = getSessionResultsReportLabelsDe();
    for (const labels of [
      getSessionResultsReportLabelsFr(),
      getSessionResultsReportLabelsEs(),
      getSessionResultsReportLabelsIt(),
    ]) {
      expect(labels.questionsLead).not.toBe(de.questionsLead);
      expect(labels.backToOverview).not.toBe(de.backToOverview);
      expect(labels.lowSuccessRateHintTemplate).not.toBe(de.lowSuccessRateHintTemplate);
      expect(labels.coverSummaryRiskNote).not.toBe(de.coverSummaryRiskNote);
    }
    expect(getSessionResultsReportLabelsFr().backToOverview).toBe('↑ Retour à l’aperçu');
    expect(getSessionResultsReportLabelsEs().backToOverview).toBe('↑ Volver al resumen');
    expect(getSessionResultsReportLabelsIt().backToOverview).toBe('↑ Torna alla panoramica');
  });

  it('lokalisiert Frageformate glossarkonform', () => {
    expect(getSessionResultsReportLabelsFr().questionTypeMultipleChoice).toBe(
      'Question à réponses multiples',
    );
    expect(getSessionResultsReportLabelsEs().questionTypeSingleChoice).toBe(
      'Pregunta de respuesta única',
    );
    expect(getSessionResultsReportLabelsIt().questionTypeMultipleChoice).toBe(
      'Domanda a risposta multipla',
    );
  });
});

describe('report-cover-logo', () => {
  it('entspricht dem Toolbar-Marken-Icon (EU-Stern, nicht PWA-Icon)', () => {
    expect(REPORT_COVER_LOGO_SVG).toContain('report-cover-logo-svg');
    expect(REPORT_COVER_LOGO_SVG).toContain('#002395');
    expect(REPORT_COVER_LOGO_SVG).toContain('#ffcc00');
    expect(REPORT_COVER_LOGO_SVG).not.toContain('>ars</text>');
    expect(REPORT_COVER_LOGO_SVG).not.toContain('>nova</text>');
  });
});
