import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { QuizExport } from '@arsnova/shared-types';
import { QUIZ_STORAGE_KEY, QuizStoreService } from './quiz-store.service';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';

import singleChoiceQuiz from '../../../../../../../docs/examples/quiz-import/quiz-single-choice-realistisch.json';
import multipleChoiceQuiz from '../../../../../../../docs/examples/quiz-import/quiz-multiple-choice-realistisch.json';
import surveyQuiz from '../../../../../../../docs/examples/quiz-import/quiz-survey-realistisch.json';
import freetextQuiz from '../../../../../../../docs/examples/quiz-import/quiz-freetext-realistisch.json';
import ratingQuiz from '../../../../../../../docs/examples/quiz-import/quiz-rating-realistisch.json';

interface FixtureExpectation {
  payload: QuizExport;
  expectedType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SURVEY' | 'FREETEXT' | 'RATING';
  expectedName: string;
}

const fixtures: FixtureExpectation[] = [
  {
    payload: singleChoiceQuiz as QuizExport,
    expectedType: 'SINGLE_CHOICE',
    expectedName: 'Physik 1 - Verständnischeck (Single Choice)',
  },
  {
    payload: multipleChoiceQuiz as QuizExport,
    expectedType: 'MULTIPLE_CHOICE',
    expectedName: 'Statistik kompakt - Konzepte (Multiple Choice)',
  },
  {
    payload: surveyQuiz as QuizExport,
    expectedType: 'SURVEY',
    expectedName: 'Lehrveranstaltungsfeedback - Umfrage',
  },
  {
    payload: freetextQuiz as QuizExport,
    expectedType: 'FREETEXT',
    expectedName: 'Mathe-Brückenkurs - Freitext-Reflexion',
  },
  {
    payload: ratingQuiz as QuizExport,
    expectedType: 'RATING',
    expectedName: 'Laborpraktikum - Rating-Check',
  },
];

describe('Quiz example imports (all formats)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('importiert alle Beispiel-Quizzes und prüft fragetyp-spezifische Regeln', () => {
    const service = TestBed.inject(QuizStoreService);

    for (const fixture of fixtures) {
      const imported = service.importQuiz(fixture.payload);
      const expectedQuestionCount = fixture.payload.quiz.questions.length;

      expect(imported.id).toBeTruthy();
      expect(imported.name).toBe(fixture.expectedName);
      expect(imported.questions.length).toBe(expectedQuestionCount);
      expect(imported.questions.every((question) => question.type === fixture.expectedType)).toBe(true);
      expect(imported.questions.every((question) => question.text.trim().length > 0)).toBe(true);

      switch (fixture.expectedType) {
        case 'SINGLE_CHOICE':
          expect(
            imported.questions.every(
              (question) =>
                question.answers.length >= 2 &&
                question.answers.filter((answer) => answer.isCorrect).length === 1,
            ),
          ).toBe(true);
          break;
        case 'MULTIPLE_CHOICE':
          expect(
            imported.questions.every(
              (question) =>
                question.answers.length >= 2 &&
                question.answers.filter((answer) => answer.isCorrect).length >= 1,
            ),
          ).toBe(true);
          break;
        case 'SURVEY':
          expect(
            imported.questions.every(
              (question) =>
                question.answers.length >= 2 &&
                question.answers.every((answer) => !answer.isCorrect),
            ),
          ).toBe(true);
          break;
        case 'FREETEXT':
          expect(imported.questions.every((question) => question.answers.length === 0)).toBe(true);
          break;
        case 'RATING':
          expect(
            imported.questions.every(
              (question) =>
                question.answers.length === 0 &&
                question.ratingMin === 1 &&
                (question.ratingMax === 5 || question.ratingMax === 10) &&
                (question.ratingLabelMin?.length ?? 0) > 0 &&
                (question.ratingLabelMax?.length ?? 0) > 0,
            ),
          ).toBe(true);
          break;
      }
    }

    expect(service.quizzes().length).toBe(fixtures.length);
    expect(localStorage.getItem(QUIZ_STORAGE_KEY)).toBeTruthy();
  });

  it('rendert Markdown + KaTeX aus importierten Fragen ohne Fehler', () => {
    const service = TestBed.inject(QuizStoreService);

    for (const fixture of fixtures) {
      const imported = service.importQuiz(fixture.payload);
      const firstQuestion = imported.questions[0];
      expect(firstQuestion).toBeTruthy();

      if (!firstQuestion) continue;
      const renderedQuestion = renderMarkdownWithKatex(firstQuestion.text);
      expect(renderedQuestion.katexError).toBeNull();
      expect(renderedQuestion.html).toContain('<h3');
      expect(renderedQuestion.html).toContain('katex');

      for (const answer of firstQuestion.answers) {
        const renderedAnswer = renderMarkdownWithKatex(answer.text);
        expect(renderedAnswer.katexError).toBeNull();
      }
    }
  });

  it('unterstützt Export/Import-Roundtrip für alle importierten Beispiel-Quizzes', () => {
    const service = TestBed.inject(QuizStoreService);

    for (const fixture of fixtures) {
      const imported = service.importQuiz(fixture.payload);
      const exported = service.exportQuiz(imported.id);
      const roundtrip = service.importQuiz(exported);

      expect(roundtrip.id).not.toBe(imported.id);
      expect(roundtrip.name).toBe(imported.name);
      expect(roundtrip.questions.length).toBe(imported.questions.length);
      expect(roundtrip.questions[0]?.type).toBe(imported.questions[0]?.type);
      expect(roundtrip.questions[0]?.text).toBe(imported.questions[0]?.text);
    }
  });
});
