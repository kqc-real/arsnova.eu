import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { QuizExport } from '@arsnova/shared-types';
import { DEMO_QUIZ_ID, QUIZ_STORAGE_KEY, QuizStoreService } from './quiz-store.service';
import { renderMarkdownWithKatex } from '../../../shared/markdown-katex.util';

import singleChoiceQuiz from '../../../../../../../docs/examples/quiz-import/quiz-single-choice-realistisch.json';
import multipleChoiceQuiz from '../../../../../../../docs/examples/quiz-import/quiz-multiple-choice-realistisch.json';
import surveyQuiz from '../../../../../../../docs/examples/quiz-import/quiz-survey-realistisch.json';
import freetextQuiz from '../../../../../../../docs/examples/quiz-import/quiz-freetext-realistisch.json';
import ratingQuiz from '../../../../../../../docs/examples/quiz-import/quiz-rating-realistisch.json';
import wordCloudQuiz from '../../../../../../../docs/examples/quiz-import/quiz-word-cloud-komplett.json';
import mixedQuiz from '../../../../../../../docs/examples/quiz-import/quiz-mixed-realistisch.json';
import compactFeedbackQuiz from '../../../../../../../docs/examples/quiz-import/quiz-unterrichtsfeedback-kompakt.json';
import arsnovaClickMaximalExport from '../../../../../../../docs/examples/quiz-import/arsnova-click-maximal-export.json';

type QuestionType =
  'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SURVEY' | 'FREETEXT' | 'RATING' | 'NUMERIC_ESTIMATE';

interface FixtureExpectation {
  payload: QuizExport;
  allowedTypes: QuestionType[];
  expectedName: string;
}

const fixtures: FixtureExpectation[] = [
  {
    payload: singleChoiceQuiz as QuizExport,
    allowedTypes: ['SINGLE_CHOICE'],
    expectedName: 'Physik 1 - Verständnischeck (Single Choice)',
  },
  {
    payload: multipleChoiceQuiz as QuizExport,
    allowedTypes: ['MULTIPLE_CHOICE'],
    expectedName: 'Statistik kompakt - Konzepte (Multiple Choice)',
  },
  {
    payload: surveyQuiz as QuizExport,
    allowedTypes: ['SURVEY'],
    expectedName: 'Lehrveranstaltungsfeedback - Umfrage',
  },
  {
    payload: freetextQuiz as QuizExport,
    allowedTypes: ['FREETEXT'],
    expectedName: 'Mathe-Brückenkurs - Freitext-Reflexion',
  },
  {
    payload: ratingQuiz as QuizExport,
    allowedTypes: ['RATING'],
    expectedName: 'Laborpraktikum - Rating-Check',
  },
  {
    payload: wordCloudQuiz as QuizExport,
    allowedTypes: ['FREETEXT'],
    expectedName: 'Digitalisierung - Word-Cloud Komplettbeispiel',
  },
  {
    payload: mixedQuiz as QuizExport,
    allowedTypes: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SURVEY', 'FREETEXT', 'RATING'],
    expectedName: 'MINT-Kompakt - Mixed Format Demo',
  },
  {
    payload: compactFeedbackQuiz as QuizExport,
    allowedTypes: ['SINGLE_CHOICE', 'SURVEY', 'FREETEXT', 'RATING'],
    expectedName: 'Unterrichtsfeedback - Kompakt',
  },
];

describe('Quiz example imports (all formats)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  it('importiert alle Beispiel-Quizzes und prüft fragetyp-spezifische Regeln', () => {
    const service = TestBed.inject(QuizStoreService);

    for (const fixture of fixtures) {
      const imported = service.importQuiz(fixture.payload).quiz;
      const expectedQuestionCount = fixture.payload.quiz.questions.length;

      expect(imported.id).toBeTruthy();
      expect(imported.name).toBe(fixture.expectedName);
      expect(imported.questions.length).toBe(expectedQuestionCount);
      expect(
        imported.questions.every((question) => fixture.allowedTypes.includes(question.type)),
      ).toBe(true);
      expect(imported.questions.every((question) => question.text.trim().length > 0)).toBe(true);

      for (const question of imported.questions) {
        switch (question.type) {
          case 'SINGLE_CHOICE':
            expect(question.answers.length).toBeGreaterThanOrEqual(2);
            expect(question.answers.filter((answer) => answer.isCorrect).length).toBe(1);
            break;
          case 'MULTIPLE_CHOICE':
            expect(question.answers.length).toBeGreaterThanOrEqual(2);
            expect(
              question.answers.filter((answer) => answer.isCorrect).length,
            ).toBeGreaterThanOrEqual(1);
            break;
          case 'SURVEY':
            expect(question.answers.length).toBeGreaterThanOrEqual(2);
            expect(question.answers.every((answer) => !answer.isCorrect)).toBe(true);
            break;
          case 'FREETEXT':
            expect(question.answers.length).toBe(0);
            break;
          case 'RATING':
            expect(question.answers.length).toBe(0);
            expect(question.ratingMin).toBe(1);
            expect(question.ratingMax === 5 || question.ratingMax === 10).toBe(true);
            expect((question.ratingLabelMin?.length ?? 0) > 0).toBe(true);
            expect((question.ratingLabelMax?.length ?? 0) > 0).toBe(true);
            break;
          case 'NUMERIC_ESTIMATE':
            expect(question.answers.length).toBe(0);
            expect(question.numericToleranceMode).toBe('ABSOLUTE_INTERVAL');
            expect(typeof question.numericReferenceValue).toBe('number');
            expect(typeof question.numericMin).toBe('number');
            expect(typeof question.numericMax).toBe('number');
            break;
        }
      }
    }

    expect(service.quizzes().filter((q) => q.id !== DEMO_QUIZ_ID).length).toBe(fixtures.length);
    expect(localStorage.getItem(QUIZ_STORAGE_KEY)).toBeTruthy();
  });

  it('rendert Markdown + KaTeX aus importierten Fragen ohne Fehler', () => {
    const service = TestBed.inject(QuizStoreService);

    for (const fixture of fixtures) {
      const imported = service.importQuiz(fixture.payload).quiz;
      const firstQuestion = imported.questions[0];
      expect(firstQuestion).toBeTruthy();

      if (!firstQuestion) continue;
      const renderedQuestion = renderMarkdownWithKatex(firstQuestion.text, {
        headingStartLevel: 3,
      });
      expect(renderedQuestion.katexError).toBeNull();
      expect(renderedQuestion.html).toContain('<h3');
      if (firstQuestion.text.includes('$')) {
        expect(renderedQuestion.html).toContain('katex');
      }

      for (const answer of firstQuestion.answers) {
        const renderedAnswer = renderMarkdownWithKatex(answer.text);
        expect(renderedAnswer.katexError).toBeNull();
      }
    }
  });

  it('unterstützt Export/Import-Roundtrip für alle importierten Beispiel-Quizzes', () => {
    const service = TestBed.inject(QuizStoreService);

    for (const fixture of fixtures) {
      const imported = service.importQuiz(fixture.payload).quiz;
      const exported = service.exportQuiz(imported.id);
      const roundtrip = service.importQuiz(exported).quiz;

      expect(roundtrip.id).not.toBe(imported.id);
      expect(roundtrip.name).toBe(imported.name);
      expect(roundtrip.questions.length).toBe(imported.questions.length);
      expect(roundtrip.questions[0]?.type).toBe(imported.questions[0]?.type);
      expect(roundtrip.questions[0]?.text).toBe(imported.questions[0]?.text);
    }
  });

  it('importiert das arsnova.click-Maximalbeispiel inklusive RangedQuestion', () => {
    const service = TestBed.inject(QuizStoreService);

    const imported = service.importQuiz(arsnovaClickMaximalExport).quiz;
    const estimateQuestion = imported.questions.find(
      (question) => question.text === 'Schaetzfrage',
    );

    expect(imported.name).toBe('Maximal Export Quiz');
    expect(imported.questions).toHaveLength(8);
    expect(imported.questions.map((question) => question.type)).toContain('NUMERIC_ESTIMATE');
    expect(
      imported.questions.find((question) => question.text === 'Single Choice')?.confidenceEnabled,
    ).toBe(true);
    expect(
      imported.questions.find((question) => question.text === 'ABCD')?.confidenceEnabled,
    ).not.toBe(true);
    expect(estimateQuestion).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      timer: 60,
      confidenceEnabled: true,
      numericToleranceMode: 'ABSOLUTE_INTERVAL',
      numericReferenceValue: 420,
      numericIntervalLeft: 0,
      numericIntervalRight: 1000,
      numericInputType: 'INTEGER',
      numericMin: null,
      numericMax: null,
      numericTwoRounds: false,
    });
  });
});
