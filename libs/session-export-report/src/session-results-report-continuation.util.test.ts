import { describe, expect, it } from 'vitest';
import {
  planQuestionContinuationStamps,
  stripPdfRunningHeader,
  toWinAnsiSafe,
} from './session-results-report-continuation.util';

const questions = [
  {
    questionNumber: 2,
    label: 'Frage 2 – Fortsetzung: Runde π auf zwei Dezimalstellen.',
    shortLabel: 'Frage 2 – Fortsetzung',
  },
  {
    questionNumber: 4,
    label: 'Frage 4 – Fortsetzung: Welche dieser Einsätze eignen sich gut?',
    shortLabel: 'Frage 4 – Fortsetzung',
  },
  {
    questionNumber: 5,
    label: 'Frage 5 – Fortsetzung: Wie viele sichtbare Teile?',
    shortLabel: 'Frage 5 – Fortsetzung',
  },
  {
    questionNumber: 6,
    label: 'Frage 6 – Fortsetzung: In welcher Sprache?',
    shortLabel: 'Frage 6 – Fortsetzung',
  },
];

describe('toWinAnsiSafe', () => {
  it('ersetzt Gedankenstrich/Apostroph und behält π für den Symbol-Font', () => {
    expect(toWinAnsiSafe('Frage 2 – Fortsetzung: Runde π.')).toBe(
      'Frage 2 - Fortsetzung: Runde π.',
    );
    expect(toWinAnsiSafe('Question 5 — suite : Rubik’s Cube')).toBe(
      "Question 5 - suite : Rubik's Cube",
    );
  });
});

describe('stripPdfRunningHeader', () => {
  it('landet auf dem Teamprofil statt mitten in „réponses correctes“ im Fließtext', () => {
    const page =
      "Showcase pédagogique : démo QCG4W4 Profil d'apprentissage des équipes Uniquement les équipes d'au moins cinq membres. Points forts : taux de réponses correctes d'au moins 80 %";
    const stripped = stripPdfRunningHeader(page);
    expect(stripped.startsWith("Profil d'apprentissage")).toBe(true);
    expect(stripped.startsWith('réponses correctes')).toBe(false);
  });
});

describe('planQuestionContinuationStamps', () => {
  it('plant Stempel für Fortsetzungsseiten ohne Fragenkopf', () => {
    const pages = [
      'Quizname CODE Didaktische Quiz-Auswertung Demo Quiz',
      'Quizname CODE Fragen im Detail FRAGE 2 VON 9 Numerische Schätzfrage Runde π',
      'Quizname CODE Verteilung der Schätzwerte Akzeptierter Bereich Selbsteinschätzung',
      'Quizname CODE FRAGE 4 VON 9 Multiple Choice Antwortverteilung',
      'Quizname CODE Selbsteinschätzung Antworten: 30 Nachbesprechungsimpuls NÄCHSTE FRAGE FRAGE 5 VON 9',
      'Quizname CODE Auswahlfehler Stärkster Distraktor: 22',
      'Quizname CODE FRAGE 6 VON 9 Single Choice',
      'Quizname CODE Für diese Frage war die Selbsteinschätzung in diesem Quiz deaktiviert. NÄCHSTE FRAGE FRAGE 7',
    ];

    const plan = planQuestionContinuationStamps(pages, questions);
    expect(plan).toEqual([
      {
        pageIndex: 2,
        label: questions[0]!.label,
        shortLabel: questions[0]!.shortLabel,
      },
      {
        pageIndex: 4,
        label: questions[1]!.label,
        shortLabel: questions[1]!.shortLabel,
      },
      {
        pageIndex: 5,
        label: questions[2]!.label,
        shortLabel: questions[2]!.shortLabel,
      },
      {
        pageIndex: 7,
        label: questions[3]!.label,
        shortLabel: questions[3]!.shortLabel,
      },
    ]);
  });

  it('stempelt nicht, wenn die Seite bereits mit Fortsetzung oder Fragenkopf beginnt', () => {
    const pages = [
      'Quizname CODE FRAGE 4 VON 9 Multiple Choice',
      'Quizname CODE Frage 4 – Fortsetzung: Welche dieser Einsätze? Selbsteinschätzung',
      'Quizname CODE NÄCHSTE FRAGE FRAGE 5 VON 9 Auswahlfehler',
    ];
    expect(planQuestionContinuationStamps(pages, questions)).toEqual([]);
  });

  it('plant Stempel auch für französische Fortsetzungsseiten', () => {
    const frQuestions = [
      {
        questionNumber: 4,
        label: 'Question 4 — suite : Lesquels de ces usages conviennent à une question flash ?',
        shortLabel: 'Question 4 — suite',
      },
      {
        questionNumber: 5,
        label:
          'Question 5 — suite : Combien de pièces visibles possède le Rubik’s Cube classique ?',
        shortLabel: 'Question 5 — suite',
      },
    ];
    const pages = [
      'Quiz CODE Question 4 sur 9 Question à réponses multiples',
      'Quiz CODE Analyse des options Option incorrecte la plus souvent choisie',
      'Quiz CODE Question 5 sur 9 Question à réponse unique',
      'Quiz CODE Confiance dans la réponse · 30 réponses',
    ];
    expect(planQuestionContinuationStamps(pages, frQuestions)).toEqual([
      {
        pageIndex: 1,
        label: frQuestions[0]!.label,
        shortLabel: frQuestions[0]!.shortLabel,
      },
      {
        pageIndex: 3,
        label: frQuestions[1]!.label,
        shortLabel: frQuestions[1]!.shortLabel,
      },
    ]);
  });

  it('stempelt keine Teamprofil-/Bonus-Seiten nach den Fragen', () => {
    const frQuestions = [
      {
        questionNumber: 9,
        label: 'Question 9 — suite : Quelle est la probabilité…',
        shortLabel: 'Question 9 — suite',
      },
    ];
    const pages = [
      'Quiz CODE Question 9 sur 9 Échelle Confiance dans la réponse',
      "Quiz CODE Profil d'apprentissage des équipes Uniquement les équipes. Points forts : taux de réponses correctes d'au moins 80 %. Codes bonus",
    ];
    expect(planQuestionContinuationStamps(pages, frQuestions)).toEqual([]);
  });
});
