#!/usr/bin/env node
/**
 * Ersetzt confidence-bezogene UI-Texte von Sicherheit/Sicherheitsgrad/Konfidenz
 * auf Selbsteinschätzung in messages*.xlf.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localeDir = path.join(__dirname, '../src/locale');

const SOURCE_REPLACEMENTS = [
  ['Niedrige Selbsteinschätzung (optional)', 'Niedrige Antwortsicherheit'],
  ['Hohe Selbsteinschätzung (optional)', 'Hohe Antwortsicherheit'],
  ['Lernstand und Sicherheit', 'Lernstand und Selbsteinschätzung'],
  [
    'Die Verbindung aus Korrektheit und Sicherheit zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
    'Die Verbindung aus Korrektheit und Selbsteinschätzung zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
  ],
  ['Antworten mit Sicherheitsgrad:', 'Antworten mit Selbsteinschätzung:'],
  ['falsch + hohe Selbsteinschätzung', 'falsch + hohe Antwortsicherheit'],
  [' Sicherheit der Antworten ', ' Selbsteinschätzung '],
  ['Sicherheit der Antworten', 'Selbsteinschätzung'],
  [
    ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Sicherheit. ',
    ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung. ',
  ],
  [
    'Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Sicherheit.',
    'Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung.',
  ],
  ['Korrektheit und Sicherheit', 'Korrektheit und Selbsteinschätzung'],
  [' Häufig falsch mit hoher Sicherheit ', ' Häufig falsch mit hoher Selbsteinschätzung '],
  ['Häufig falsch mit hoher Sicherheit', 'Häufig falsch mit hoher Selbsteinschätzung'],
  ['Dein Sicherheitsgrad:', 'Deine Selbsteinschätzung:'],
  ['Sicherheitsgrad:', 'Selbsteinschätzung:'],
  ['Sicherheitsgrad von 1 bis 5', 'Selbsteinschätzung von 1 bis 5'],
  ['Sicherheitsgrad ', 'Selbsteinschätzung '],
  [
    'Gib deinen Sicherheitsgrad an, bevor du absendest.',
    'Gib deine Selbsteinschätzung an, bevor du absendest.',
  ],
  ['Konfidenz n;', 'Selbsteinschätzung n;'],
  ['Einzelne Konfidenzwerte', 'Einzelne Selbsteinschätzungen'],
];

const TARGETS = {
  en: new Map([
    ['Niedrige Antwortsicherheit', 'Low answer confidence'],
    ['Hohe Antwortsicherheit', 'High answer confidence'],
    ['Lernstand und Selbsteinschätzung', 'Learning status and self-assessment'],
    [
      'Die Verbindung aus Korrektheit und Selbsteinschätzung zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
      'The link between correctness and self-assessment shows solid knowledge, knowledge gaps, and possible misconceptions.',
    ],
    ['Antworten mit Selbsteinschätzung:', 'Answers with self-assessment:'],
    ['falsch + hohe Antwortsicherheit', 'wrong + high answer confidence'],
    ['Selbsteinschätzung', 'Self-assessment'],
    [
      ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung. ',
      ' Right or wrong—and how confident? Especially important: wrong despite high self-assessment. ',
    ],
    ['Korrektheit und Selbsteinschätzung', 'Correctness and self-assessment'],
    [' Häufig falsch mit hoher Selbsteinschätzung ', ' Often wrong with high self-assessment '],
    ['Deine Selbsteinschätzung:', 'Your self-assessment:'],
    ['Selbsteinschätzung:', 'Self-assessment:'],
    ['Selbsteinschätzung von 1 bis 5', 'Self-assessment from 1 to 5'],
    ['Selbsteinschätzung ', 'Self-assessment '],
    [
      'Gib deine Selbsteinschätzung an, bevor du absendest.',
      'Give your self-assessment before submitting.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt.',
      'Aggregated analysis of the latest completed live session. Individual self-assessments and nicknames are not shown.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt. ',
      ' Aggregated analysis of the latest completed live session. Individual self-assessments and nicknames are not shown. ',
    ],
    [
      ' Für diesen Durchlauf liegt keine auswertbare Selbsteinschätzungs-Zusammenfassung vor.',
      'No self-assessment summary can be evaluated for this session.',
    ],
    [
      'Frage Nr.;Fragentext;Typ;Teilnehmende;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Risiko;Fragil;Erkannte Wissenslücke;Unentschieden;Häufigste selbstsicher falsche Antwort;Details',
      'Question no.;Question text;Type;Participants;Avg. points;Self-assessment n;Solid;Misconception risk;Fragile;Detected gap;Undecided;Strongest signal;Details',
    ],
  ]),
  fr: new Map([
    ['Niedrige Antwortsicherheit', 'Faible certitude de réponse'],
    ['Hohe Antwortsicherheit', 'Forte certitude de réponse'],
    ['Lernstand und Selbsteinschätzung', "Niveau d'apprentissage et autoévaluation"],
    [
      'Die Verbindung aus Korrektheit und Selbsteinschätzung zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
      'Le lien entre justesse et autoévaluation montre les acquis solides, les lacunes et les possibles fausses conceptions.',
    ],
    ['Antworten mit Selbsteinschätzung:', 'Réponses avec autoévaluation :'],
    ['falsch + hohe Antwortsicherheit', 'faux + forte certitude de réponse'],
    ['Selbsteinschätzung', 'Autoévaluation'],
    [
      ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung. ',
      ' Juste ou faux — et avec quelle assurance ? Surtout : faux malgré une autoévaluation élevée. ',
    ],
    ['Korrektheit und Selbsteinschätzung', 'Justesse et autoévaluation'],
    [' Häufig falsch mit hoher Selbsteinschätzung ', ' Souvent faux avec autoévaluation élevée '],
    ['Deine Selbsteinschätzung:', 'Ton autoévaluation :'],
    ['Selbsteinschätzung:', 'Autoévaluation :'],
    ['Selbsteinschätzung von 1 bis 5', 'Autoévaluation de 1 à 5'],
    ['Selbsteinschätzung ', 'Autoévaluation '],
    [
      'Gib deine Selbsteinschätzung an, bevor du absendest.',
      'Indique ton autoévaluation avant d’envoyer.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt.',
      'Analyse agrégée du dernier live terminé. Les autoévaluations individuelles et les pseudonymes ne sont pas affichés.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt. ',
      ' Analyse agrégée du dernier live terminé. Les autoévaluations individuelles et les pseudonymes ne sont pas affichés. ',
    ],
    [
      ' Für diesen Durchlauf liegt keine auswertbare Selbsteinschätzungs-Zusammenfassung vor.',
      'Aucune synthèse d’autoévaluation exploitable n’est disponible pour cette session.',
    ],
    [
      'Frage Nr.;Fragentext;Typ;Teilnehmende;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Risiko;Fragil;Erkannte Wissenslücke;Unentschieden;Häufigste selbstsicher falsche Antwort;Details',
      'N° question;Texte;Type;Participants;Ø points;Autoévaluation n;Consolidé;Risque de fausse conception;Fragile;Lacune détectée;Indécis;Signal le plus fort;Détails',
    ],
  ]),
  es: new Map([
    ['Niedrige Antwortsicherheit', 'Baja seguridad de respuesta'],
    ['Hohe Antwortsicherheit', 'Alta seguridad de respuesta'],
    ['Lernstand und Selbsteinschätzung', 'Nivel de aprendizaje y autoevaluación'],
    [
      'Die Verbindung aus Korrektheit und Selbsteinschätzung zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
      'La relación entre corrección y autoevaluación muestra conocimiento consolidado, lagunas y posibles conceptos erróneos.',
    ],
    ['Antworten mit Selbsteinschätzung:', 'Respuestas con autoevaluación:'],
    ['falsch + hohe Antwortsicherheit', 'incorrecto + alta seguridad de respuesta'],
    ['Selbsteinschätzung', 'Autoevaluación'],
    [
      ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung. ',
      ' ¿Correcto o incorrecto — y con qué seguridad? Especialmente importante: incorrecto pese a autoevaluación alta. ',
    ],
    ['Korrektheit und Selbsteinschätzung', 'Corrección y autoevaluación'],
    [
      ' Häufig falsch mit hoher Selbsteinschätzung ',
      ' A menudo incorrecto con autoevaluación alta ',
    ],
    ['Deine Selbsteinschätzung:', 'Tu autoevaluación:'],
    ['Selbsteinschätzung:', 'Autoevaluación:'],
    ['Selbsteinschätzung von 1 bis 5', 'Autoevaluación de 1 a 5'],
    ['Selbsteinschätzung ', 'Autoevaluación '],
    [
      'Gib deine Selbsteinschätzung an, bevor du absendest.',
      'Indica tu autoevaluación antes de enviar.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt.',
      'Análisis agregado de la última sesión en directo finalizada. No se muestran autoevaluaciones individuales ni apodos.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt. ',
      ' Análisis agregado de la última sesión en directo finalizada. No se muestran autoevaluaciones individuales ni apodos. ',
    ],
    [
      ' Für diesen Durchlauf liegt keine auswertbare Selbsteinschätzungs-Zusammenfassung vor.',
      'No hay un resumen de autoevaluación evaluable para esta sesión.',
    ],
    [
      'Frage Nr.;Fragentext;Typ;Teilnehmende;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Risiko;Fragil;Erkannte Wissenslücke;Unentschieden;Häufigste selbstsicher falsche Antwort;Details',
      'N.º pregunta;Texto;Tipo;Participantes;Ø puntos;Autoevaluación n;Consolidado;Riesgo de concepto erróneo;Frágil;Laguna detectada;Indeciso;Señal más fuerte;Detalles',
    ],
  ]),
  it: new Map([
    ['Niedrige Antwortsicherheit', 'Bassa sicurezza di risposta'],
    ['Hohe Antwortsicherheit', 'Alta sicurezza di risposta'],
    ['Lernstand und Selbsteinschätzung', 'Livello di apprendimento e autovalutazione'],
    [
      'Die Verbindung aus Korrektheit und Selbsteinschätzung zeigt gefestigtes Wissen, Wissenslücken und mögliche Fehlkonzepte.',
      'Il legame tra correttezza e autovalutazione mostra conoscenze consolidate, lacune e possibili misconcezioni.',
    ],
    ['Antworten mit Selbsteinschätzung:', 'Risposte con autovalutazione:'],
    ['falsch + hohe Antwortsicherheit', 'sbagliato + alta sicurezza di risposta'],
    ['Selbsteinschätzung', 'Autovalutazione'],
    [
      ' Richtig oder falsch — und wie sicher? Besonders wichtig: falsch trotz hoher Selbsteinschätzung. ',
      ' Giusto o sbagliato — e quanto sei sicuro? Soprattutto: sbagliato nonostante autovalutazione alta. ',
    ],
    ['Korrektheit und Selbsteinschätzung', 'Correttezza e autovalutazione'],
    [' Häufig falsch mit hoher Selbsteinschätzung ', ' Spesso sbagliato con autovalutazione alta '],
    ['Deine Selbsteinschätzung:', 'La tua autovalutazione:'],
    ['Selbsteinschätzung:', 'Autovalutazione:'],
    ['Selbsteinschätzung von 1 bis 5', 'Autovalutazione da 1 a 5'],
    ['Selbsteinschätzung ', 'Autovalutazione '],
    [
      'Gib deine Selbsteinschätzung an, bevor du absendest.',
      'Indica la tua autovalutazione prima di inviare.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt.',
      'Analisi aggregata dell’ultima sessione live conclusa. Autovalutazioni individuali e pseudonimi non vengono mostrati.',
    ],
    [
      ' Aggregierte Auswertung des zuletzt beendeten Live-Durchlaufs. Einzelne Selbsteinschätzungen und Nicknames werden nicht angezeigt. ',
      ' Analisi aggregata dell’ultima sessione live conclusa. Autovalutazioni individuali e pseudonimi non vengono mostrati. ',
    ],
    [
      ' Für diesen Durchlauf liegt keine auswertbare Selbsteinschätzungs-Zusammenfassung vor.',
      'Non è disponibile un riepilogo di autovalutazione valutabile per questa sessione.',
    ],
    [
      'Frage Nr.;Fragentext;Typ;Teilnehmende;Ø Punkte;Selbsteinschätzung n;Gefestigt;Fehlkonzept-Risiko;Fragil;Erkannte Wissenslücke;Unentschieden;Häufigste selbstsicher falsche Antwort;Details',
      'N. domanda;Testo;Tipo;Partecipanti;Ø punti;Autovalutazione n;Consolidato;Rischio misconcezione;Fragile;Lacuna rilevata;Indeciso;Segnale più forte;Dettagli',
    ],
  ]),
};

const REPORT_TARGETS = {
  en: {
    'sessionReport.privacyNotice':
      'Privacy: This report contains aggregated results only. Real names, IP addresses, and individual votes are not exported. Pseudonym nicknames appear only with bonus codes.',
    'sessionReport.confidenceNotCollectedTemplate': 'No evaluable self-assessment for: {0}.',
    'sessionReport.confidenceNotSupportedTemplate': 'Not supported for: {0}.',
    'sessionReport.confidenceDisabledTemplate': 'Disabled in this quiz for: {0}.',
    'sessionReport.confidenceNotSupportedForQuestion':
      'This question type does not support self-assessment.',
    'sessionReport.confidenceDisabledForQuestion':
      'Self-assessment was disabled for this question in this quiz.',
    'sessionReport.confidenceTopSignal': '⚠ Debrief prompt',
    'sessionReport.confidenceTopSignalTemplate':
      '{1} participants chose “{0}” incorrectly and with high confidence.',
    'sessionReport.confidenceDistributionAxis': 'Number of responses',
    'sessionReport.numericIdenticalHistogram': 'Estimates — both rounds',
    'sessionReport.numericIdenticalDistributions':
      'No visible change — both distributions are identical.',
    'sessionReport.nextQuestion': 'Next question',
    'sessionReport.heatmapCellCountNote':
      'The number and mini bar show the count of responses with a self-assessment.',
    'sessionReport.heatmapLegendToneSuccess': '✓ Solid: correct with high self-assessment',
    'sessionReport.heatmapLegendToneRisk':
      '⚠ Misconception risk: incorrect with high self-assessment',
    'sessionReport.heatmapLegendToneMid':
      'M Medium: self-assessment level 3, whether correct or incorrect',
    'sessionReport.heatmapLegendFrequencyHint': 'Symbols identify the diagnostic category.',
    'sessionReport.heatmapCompactLegend':
      '✓ Solid · ⚠ Misconception · ? Fragile · ◯ Knowledge gap · M Medium',
    'sessionReport.numericComparisonStdDev': 'Standard deviation',
    'sessionReport.numericToleranceBand': 'Accepted range',
    'sessionReport.numericInBandSummaryTemplate':
      '{0} of {1} responses were within the accepted range {2}–{3}.',
    'sessionReport.scoreExplanation':
      'Points are a ranking value based on correctness, difficulty, response time when a timer is active, and streak bonuses. Self-assessment does not affect points. Because the attainable value depends on the quiz flow, scores are not percentages and cannot be compared across sessions.',
    'sessionReport.confidencePriorityRuleTemplate':
      '{0} questions recommended for debrief: At least 2 participants and at least 10% answered incorrectly with high confidence. Individual cases are marked as a notice only.',
    'sessionReport.confidenceSignalRuleTemplate':
      '{0} questions at notice level because they received at least one incorrect answer with high confidence.',
    'sessionReport.confidenceMiddle': 'Medium confidence',
    'sessionReport.questionContinuationTemplate': 'Question {0} continued: {1}',
    'sessionReport.confidenceReadingGuideUndecided':
      'Medium confidence = level 3, correct or incorrect; not assigned to a diagnostic category',
    'sessionReport.confidenceWrongHigh': 'Incorrect and confident',
    'sessionReport.confidenceIncorrectShare': 'Incorrect answers total',
    'sessionReport.optionDistributionMcNote':
      'Percent = share of participants who selected this option. With multiple choice, the total may exceed 100%.',
    'sessionReport.confidenceUndecidedCol': 'Medium confidence',
    'sessionReport.aggregationRound1Context': 'Voting result',
    'sessionReport.aggregationRound2Context': 'Result after discussion – round 2',
    'sessionReport.teamTotalScore': 'Team score',
    'sessionReport.shortTextCorrect': 'Answered correctly',
    'sessionReport.shortTextIncorrect': 'Answered incorrectly',
    'sessionReport.ratingDistribution': 'Rating on a scale from 1 to 5',
    'sessionReport.coverSummaryRisk': 'Questions with misconception risk',
    'sessionReport.heatmapLegendToneCaution': '○ Knowledge gap: incorrect with low self-assessment',
    'sessionReport.heatmapLegendToneNeutral': '? Fragile: correct with low self-assessment',
    'sessionReport.shortTextExpectedSolutions': 'Accepted solutions',
    'sessionReport.exportFooterMeta': 'Export {0} · Session {1}',
  },
  fr: {
    'sessionReport.privacyNotice':
      'Confidentialité : ce rapport contient uniquement des résultats agrégés. Les noms réels, adresses IP et votes individuels ne sont pas exportés. Les pseudonymes apparaissent uniquement avec les codes bonus.',
    'sessionReport.confidenceNotCollectedTemplate': 'Aucune autoévaluation exploitable pour : {0}.',
    'sessionReport.confidenceNotSupportedTemplate': 'Non prise en charge pour : {0}.',
    'sessionReport.confidenceDisabledTemplate': 'Désactivée dans ce quiz pour : {0}.',
    'sessionReport.confidenceNotSupportedForQuestion':
      'Ce type de question ne prend pas en charge l’autoévaluation.',
    'sessionReport.confidenceDisabledForQuestion':
      'L’autoévaluation était désactivée pour cette question dans ce quiz.',
    'sessionReport.confidenceTopSignal': '⚠ Piste de débriefing',
    'sessionReport.confidenceTopSignalTemplate':
      '{1} participants ont choisi « {0} » incorrectement et avec forte certitude.',
    'sessionReport.confidenceDistributionAxis': 'Nombre de réponses',
    'sessionReport.numericIdenticalHistogram': 'Estimations — les deux tours',
    'sessionReport.numericIdenticalDistributions':
      'Aucun changement visible — les deux distributions sont identiques.',
    'sessionReport.nextQuestion': 'Question suivante',
    'sessionReport.heatmapCellCountNote':
      'Le nombre et la mini-barre indiquent le nombre de réponses avec autoévaluation.',
    'sessionReport.heatmapLegendToneSuccess': '✓ Consolidé : correct avec autoévaluation élevée',
    'sessionReport.heatmapLegendToneRisk':
      '⚠ Risque d’idée fausse : incorrect avec autoévaluation élevée',
    'sessionReport.heatmapLegendToneMid': 'M Moyen : autoévaluation 3, correct ou incorrect',
    'sessionReport.heatmapLegendFrequencyHint':
      'Les symboles identifient la catégorie diagnostique.',
    'sessionReport.heatmapCompactLegend':
      '✓ Consolidé · ⚠ Idée fausse · ? Fragile · ◯ Lacune · M Moyen',
    'sessionReport.numericComparisonStdDev': 'Écart type',
    'sessionReport.numericToleranceBand': 'Plage acceptée',
    'sessionReport.numericInBandSummaryTemplate':
      '{0} réponses sur {1} se situaient dans la plage acceptée {2}–{3}.',
    'sessionReport.scoreExplanation':
      'Les points sont une valeur de classement fondée sur la justesse, la difficulté, le temps de réponse lorsqu’un minuteur est actif et les bonus de série. L’autoévaluation n’influence pas les points. La valeur atteignable dépendant du déroulement du quiz, les scores ne sont ni des pourcentages ni comparables entre les sessions.',
    'sessionReport.confidencePriorityRuleTemplate':
      '{0} questions recommandées pour le débriefing : au moins 2 personnes et au moins 10 % ont répondu incorrectement avec forte certitude. Les cas isolés sont seulement signalés.',
    'sessionReport.confidenceSignalRuleTemplate':
      '{0} questions au niveau signalement car elles ont reçu au moins une réponse incorrecte avec forte certitude.',
    'sessionReport.confidenceMiddle': 'Certitude moyenne',
    'sessionReport.questionContinuationTemplate': 'Suite de la question {0} : {1}',
    'sessionReport.confidenceReadingGuideUndecided':
      'Certitude moyenne = niveau 3, correct ou incorrect ; aucune catégorie diagnostique',
    'sessionReport.confidenceWrongHigh': 'Incorrect et certain',
    'sessionReport.confidenceIncorrectShare': 'Réponses incorrectes au total',
    'sessionReport.optionDistributionMcNote':
      'Pourcentage = part des participants ayant choisi cette option. En choix multiple, la somme peut dépasser 100 %.',
    'sessionReport.confidenceUndecidedCol': 'Certitude moyenne',
    'sessionReport.aggregationRound1Context': 'Résultat du vote',
    'sessionReport.aggregationRound2Context': 'Résultat après discussion – tour 2',
    'sessionReport.teamTotalScore': 'Score de l’équipe',
    'sessionReport.shortTextCorrect': 'Réponses correctes',
    'sessionReport.shortTextIncorrect': 'Réponses incorrectes',
    'sessionReport.ratingDistribution': 'Évaluation sur une échelle de 1 à 5',
    'sessionReport.coverSummaryRisk': 'Questions avec risque d’idée fausse',
    'sessionReport.heatmapLegendToneCaution': '○ Lacune : incorrect avec autoévaluation faible',
    'sessionReport.heatmapLegendToneNeutral': '? Fragile : correct avec autoévaluation faible',
    'sessionReport.shortTextExpectedSolutions': 'Solutions acceptées',
    'sessionReport.exportFooterMeta': 'Export {0} · Séance {1}',
  },
  es: {
    'sessionReport.privacyNotice':
      'Privacidad: este informe contiene únicamente resultados agregados. No se exportan nombres reales, direcciones IP ni votos individuales. Los apodos seudónimos solo aparecen con códigos bonus.',
    'sessionReport.confidenceNotCollectedTemplate': 'Sin autoevaluación evaluable en: {0}.',
    'sessionReport.confidenceNotSupportedTemplate': 'No compatible con: {0}.',
    'sessionReport.confidenceDisabledTemplate': 'Desactivada en este quiz para: {0}.',
    'sessionReport.confidenceNotSupportedForQuestion':
      'Este tipo de pregunta no admite autoevaluación.',
    'sessionReport.confidenceDisabledForQuestion':
      'La autoevaluación estaba desactivada para esta pregunta en este quiz.',
    'sessionReport.confidenceTopSignal': '⚠ Impulso para el análisis',
    'sessionReport.confidenceTopSignalTemplate':
      '{1} participantes eligieron «{0}» incorrectamente y con alta seguridad.',
    'sessionReport.confidenceDistributionAxis': 'Número de respuestas',
    'sessionReport.numericIdenticalHistogram': 'Estimaciones — ambas rondas',
    'sessionReport.numericIdenticalDistributions':
      'Sin cambios visibles — ambas distribuciones son idénticas.',
    'sessionReport.nextQuestion': 'Siguiente pregunta',
    'sessionReport.heatmapCellCountNote':
      'El número y la minibarra indican la cantidad de respuestas con autoevaluación.',
    'sessionReport.heatmapLegendToneSuccess': '✓ Consolidado: correcto con autoevaluación alta',
    'sessionReport.heatmapLegendToneRisk':
      '⚠ Riesgo de concepto erróneo: incorrecto con autoevaluación alta',
    'sessionReport.heatmapLegendToneMid': 'M Media: autoevaluación 3, correcta o incorrecta',
    'sessionReport.heatmapLegendFrequencyHint':
      'Los símbolos identifican la categoría diagnóstica.',
    'sessionReport.heatmapCompactLegend':
      '✓ Consolidado · ⚠ Concepto erróneo · ? Frágil · ◯ Laguna · M Media',
    'sessionReport.numericComparisonStdDev': 'Desviación estándar',
    'sessionReport.numericToleranceBand': 'Rango aceptado',
    'sessionReport.numericInBandSummaryTemplate':
      '{0} de {1} respuestas quedaron en el rango aceptado {2}–{3}.',
    'sessionReport.scoreExplanation':
      'Los puntos son un valor de clasificación basado en la corrección, la dificultad, el tiempo de respuesta cuando hay un temporizador activo y las bonificaciones por racha. La autoevaluación no influye en los puntos. Como el valor alcanzable depende del desarrollo del quiz, las puntuaciones no son porcentajes ni se pueden comparar entre sesiones.',
    'sessionReport.confidencePriorityRuleTemplate':
      'Se recomiendan {0} preguntas para el análisis: al menos 2 personas y al menos el 10 % respondieron incorrectamente con alta seguridad. Los casos aislados solo se señalan.',
    'sessionReport.confidenceSignalRuleTemplate':
      '{0} preguntas en nivel de aviso porque recibieron al menos una respuesta incorrecta con alta seguridad.',
    'sessionReport.confidenceMiddle': 'Seguridad media',
    'sessionReport.questionContinuationTemplate': 'Continuación de la pregunta {0}: {1}',
    'sessionReport.confidenceReadingGuideUndecided':
      'Seguridad media = nivel 3, correcta o incorrecta; sin categoría diagnóstica',
    'sessionReport.confidenceWrongHigh': 'Incorrecta y segura',
    'sessionReport.confidenceIncorrectShare': 'Respuestas incorrectas en total',
    'sessionReport.optionDistributionMcNote':
      'Porcentaje = proporción de participantes que eligieron esta opción. En opción múltiple, la suma puede superar el 100 %.',
    'sessionReport.confidenceUndecidedCol': 'Seguridad media',
    'sessionReport.aggregationRound1Context': 'Resultado de la votación',
    'sessionReport.aggregationRound2Context': 'Resultado tras el debate – ronda 2',
    'sessionReport.teamTotalScore': 'Puntuación del equipo',
    'sessionReport.shortTextCorrect': 'Respondidas correctamente',
    'sessionReport.shortTextIncorrect': 'Respondidas incorrectamente',
    'sessionReport.ratingDistribution': 'Valoración en una escala de 1 a 5',
    'sessionReport.coverSummaryRisk': 'Preguntas con riesgo de concepto erróneo',
    'sessionReport.heatmapLegendToneCaution': '○ Laguna: incorrecto con autoevaluación baja',
    'sessionReport.heatmapLegendToneNeutral': '? Frágil: correcto con autoevaluación baja',
    'sessionReport.shortTextExpectedSolutions': 'Soluciones aceptadas',
    'sessionReport.exportFooterMeta': 'Exportación {0} · Sesión {1}',
  },
  it: {
    'sessionReport.privacyNotice':
      'Privacy: questo rapporto contiene esclusivamente risultati aggregati. Nomi reali, indirizzi IP e voti individuali non vengono esportati. I nickname pseudonimi compaiono solo con i codici bonus.',
    'sessionReport.confidenceNotCollectedTemplate': 'Nessuna autovalutazione valutabile per: {0}.',
    'sessionReport.confidenceNotSupportedTemplate': 'Non supportata per: {0}.',
    'sessionReport.confidenceDisabledTemplate': 'Disattivata in questo quiz per: {0}.',
    'sessionReport.confidenceNotSupportedForQuestion':
      'Questo tipo di domanda non supporta l’autovalutazione.',
    'sessionReport.confidenceDisabledForQuestion':
      'L’autovalutazione era disattivata per questa domanda in questo quiz.',
    'sessionReport.confidenceTopSignal': '⚠ Spunto per il debriefing',
    'sessionReport.confidenceTopSignalTemplate':
      '{1} partecipanti hanno scelto «{0}» in modo errato e con alta sicurezza.',
    'sessionReport.confidenceDistributionAxis': 'Numero di risposte',
    'sessionReport.numericIdenticalHistogram': 'Stime — entrambi i round',
    'sessionReport.numericIdenticalDistributions':
      'Nessun cambiamento visibile — le due distribuzioni sono identiche.',
    'sessionReport.nextQuestion': 'Domanda successiva',
    'sessionReport.heatmapCellCountNote':
      'Il numero e la mini-barra indicano il numero di risposte con autovalutazione.',
    'sessionReport.heatmapLegendToneSuccess': '✓ Consolidata: corretta con autovalutazione alta',
    'sessionReport.heatmapLegendToneRisk': '⚠ Rischio di errore: errata con autovalutazione alta',
    'sessionReport.heatmapLegendToneMid': 'M Media: autovalutazione 3, corretta o errata',
    'sessionReport.heatmapLegendFrequencyHint': 'I simboli identificano la categoria diagnostica.',
    'sessionReport.heatmapCompactLegend':
      '✓ Consolidata · ⚠ Errore · ? Fragile · ◯ Lacuna · M Media',
    'sessionReport.numericComparisonStdDev': 'Deviazione standard',
    'sessionReport.numericToleranceBand': 'Intervallo accettato',
    'sessionReport.numericInBandSummaryTemplate':
      '{0} risposte su {1} rientravano nell’intervallo accettato {2}–{3}.',
    'sessionReport.scoreExplanation':
      'I punti sono un valore di classifica basato su correttezza, difficoltà, tempo di risposta quando è attivo un timer e bonus serie. L’autovalutazione non influisce sui punti. Poiché il valore raggiungibile dipende dallo svolgimento del quiz, i punteggi non sono percentuali e non sono confrontabili tra sessioni.',
    'sessionReport.confidencePriorityRuleTemplate':
      'Sono consigliate {0} domande per il debriefing: almeno 2 persone e almeno il 10% hanno risposto in modo errato con alta sicurezza. I casi isolati vengono solo segnalati.',
    'sessionReport.confidenceSignalRuleTemplate':
      '{0} domande al livello di avviso perché hanno ricevuto almeno una risposta errata con alta sicurezza.',
    'sessionReport.confidenceMiddle': 'Sicurezza media',
    'sessionReport.questionContinuationTemplate': 'Continuazione della domanda {0}: {1}',
    'sessionReport.confidenceReadingGuideUndecided':
      'Sicurezza media = livello 3, corretta o errata; nessuna categoria diagnostica',
    'sessionReport.confidenceWrongHigh': 'Errata e sicura',
    'sessionReport.confidenceIncorrectShare': 'Risposte errate totali',
    'sessionReport.optionDistributionMcNote':
      'Percentuale = quota di partecipanti che ha scelto questa opzione. Nella scelta multipla la somma può superare il 100 %.',
    'sessionReport.confidenceUndecidedCol': 'Sicurezza media',
    'sessionReport.aggregationRound1Context': 'Risultato della votazione',
    'sessionReport.aggregationRound2Context': 'Risultato dopo la discussione – round 2',
    'sessionReport.teamTotalScore': 'Punteggio della squadra',
    'sessionReport.shortTextCorrect': 'Risposte correttamente',
    'sessionReport.shortTextIncorrect': 'Risposte in modo errato',
    'sessionReport.ratingDistribution': 'Valutazione su una scala da 1 a 5',
    'sessionReport.coverSummaryRisk': 'Domande con rischio di errore concettuale',
    'sessionReport.heatmapLegendToneCaution': '○ Lacuna: errata con autovalutazione bassa',
    'sessionReport.heatmapLegendToneNeutral': '? Fragile: corretta con autovalutazione bassa',
    'sessionReport.shortTextExpectedSolutions': 'Soluzioni accettate',
    'sessionReport.exportFooterMeta': 'Export {0} · Sessione {1}',
  },
};

function applySourceReplacements(text) {
  let result = text;
  for (const [from, to] of SOURCE_REPLACEMENTS) {
    result = result.split(from).join(to);
  }
  return result;
}

function decodeXml(text) {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function encodeXml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function patchTarget(sourceText, locale) {
  const map = TARGETS[locale];
  if (!map) return null;
  const decoded = decodeXml(sourceText.trim());
  if (map.has(decoded)) return map.get(decoded);
  if (map.has(sourceText.trim())) return map.get(sourceText.trim());
  if (map.has(` ${decoded} `)) return map.get(` ${decoded} `);
  return null;
}

function patchFile(filePath, locale) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = applySourceReplacements(content);

  if (locale) {
    content = content.replace(/<trans-unit\b[^>]*>([\s\S]*?)<\/trans-unit>/g, (unit, inner) => {
      const idMatch = unit.match(/<trans-unit\b[^>]*\bid="([^"]+)"/);
      const sourceMatch = inner.match(/<source>([\s\S]*?)<\/source>/);
      if (!sourceMatch) return unit;
      const newTarget =
        (idMatch ? REPORT_TARGETS[locale]?.[idMatch[1]] : undefined) ??
        patchTarget(sourceMatch[1], locale);
      if (!newTarget) return unit;
      if (inner.includes('<target>')) {
        return unit.replace(
          /<target>[\s\S]*?<\/target>/,
          `<target>${encodeXml(newTarget)}</target>`,
        );
      }
      return unit.replace(
        /<\/source>/,
        `</source>\n        <target>${encodeXml(newTarget)}</target>`,
      );
    });
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

patchFile(path.join(localeDir, 'messages.xlf'));
for (const locale of ['en', 'fr', 'es', 'it']) {
  patchFile(path.join(localeDir, `messages.${locale}.xlf`), locale);
}

console.log('patched confidence UI i18n');
