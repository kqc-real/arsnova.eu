import type { QuizUploadInput } from '@arsnova/shared-types';
import { describe, expect, it } from 'vitest';
import {
  calculateQuizUploadComplexity,
  QUIZ_UPLOAD_GLOBAL_COMPLEXITY_PER_WINDOW_DEFAULT,
  QUIZ_UPLOAD_MAX_COMPLEXITY,
} from './publicCreateCapacity';

describe('quiz upload learning-objective capacity', () => {
  it('charges objective rows, task references, and derivation references', () => {
    const input = {
      questions: [{ answers: [{}, {}] }],
      learningObjectives: {
        objectives: [
          {
            scope: { kind: 'question-set', sourceQuestionIds: ['a', 'b'] },
            origin: { kind: 'model-derived', derivedFromSourceQuestionIds: ['a'] },
          },
        ],
      },
    } as unknown as Pick<QuizUploadInput, 'questions' | 'learningObjectives'>;

    expect(calculateQuizUploadComplexity(input)).toBe(8);
  });

  it('keeps one schema-maximal upload below the global complexity window', () => {
    expect(QUIZ_UPLOAD_MAX_COMPLEXITY).toBe(21_901);
    expect(QUIZ_UPLOAD_GLOBAL_COMPLEXITY_PER_WINDOW_DEFAULT).toBeGreaterThanOrEqual(
      QUIZ_UPLOAD_MAX_COMPLEXITY,
    );
  });
});
