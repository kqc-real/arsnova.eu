import { describe, expect, it } from 'vitest';
import { planQuestionContinuationStamps } from './session-results-report-continuation.util';

const questions = [
  { questionNumber: 2, label: 'Frage 2 – Fortsetzung: Runde π auf zwei Dezimalstellen.' },
  { questionNumber: 4, label: 'Frage 4 – Fortsetzung: Welche dieser Einsätze eignen sich gut?' },
  { questionNumber: 5, label: 'Frage 5 – Fortsetzung: Wie viele sichtbare Teile?' },
  { questionNumber: 6, label: 'Frage 6 – Fortsetzung: In welcher Sprache?' },
];

describe('planQuestionContinuationStamps', () => {
  it('plant Stempel für Fortsetzungsseiten ohne Fragenkopf', () => {
    const pages = [
      'Quizname CODE Ergebnisbericht Demo Quiz',
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
      { pageIndex: 2, label: questions[0]!.label },
      { pageIndex: 4, label: questions[1]!.label },
      { pageIndex: 5, label: questions[2]!.label },
      { pageIndex: 7, label: questions[3]!.label },
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
});
