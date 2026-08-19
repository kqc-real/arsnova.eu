import { describe, expect, it } from 'vitest';
import {
  AnswerOptionRevealedDTOSchema,
  QaQuestionDTOSchema,
  QuestionStudentDTOSchema,
} from '@arsnova/shared-types';

describe('DTO security (Story 2.4)', () => {
  const validStudentPayload = {
    id: '11111111-1111-4111-8111-111111111111',
    text: 'Welche Antwort ist korrekt?',
    type: 'SINGLE_CHOICE' as const,
    timer: 30,
    difficulty: 'MEDIUM' as const,
    order: 1,
    answers: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Antwort A',
      },
    ],
  };

  it('accepts valid ACTIVE payload without isCorrect (QuestionStudentDTO)', () => {
    const parsed = QuestionStudentDTOSchema.parse(validStudentPayload);
    expect(parsed.answers[0]).toEqual({
      id: validStudentPayload.answers[0]!.id,
      text: validStudentPayload.answers[0]!.text,
    });
    expect(Object.prototype.hasOwnProperty.call(parsed.answers[0] ?? {}, 'isCorrect')).toBe(false);
  });

  it('rejects ACTIVE payload if answer option contains isCorrect (strict)', () => {
    const withIsCorrect = {
      ...validStudentPayload,
      answers: [{ id: validStudentPayload.answers[0]!.id, text: 'Antwort A', isCorrect: true }],
    };
    const result = QuestionStudentDTOSchema.safeParse(withIsCorrect);
    expect(result.success).toBe(false);
  });

  it('requires isCorrect in RESULTS payloads (AnswerOptionRevealedDTO)', () => {
    const missingIsCorrect = AnswerOptionRevealedDTOSchema.safeParse({
      id: '33333333-3333-4333-8333-333333333333',
      text: 'Antwort B',
      voteCount: 4,
      votePercentage: 40,
    });
    expect(missingIsCorrect.success).toBe(false);

    const withIsCorrect = AnswerOptionRevealedDTOSchema.safeParse({
      id: '33333333-3333-4333-8333-333333333333',
      text: 'Antwort B',
      isCorrect: false,
      voteCount: 4,
      votePercentage: 40,
    });
    expect(withIsCorrect.success).toBe(true);
    if (withIsCorrect.success) {
      expect(withIsCorrect.data.isCorrect).toBe(false);
    }
  });

  it('strips solution data (correctCategoryId) from CATEGORIZATION QuestionStudentDTO', () => {
    const categorizationStudentPayload = {
      id: '11111111-1111-4111-8111-111111111111',
      text: 'Ordne die Elemente zu',
      type: 'CATEGORIZATION' as const,
      timer: 30,
      difficulty: 'MEDIUM' as const,
      order: 1,
      answers: [],
      categories: [{ id: 'cat1', name: 'Kategorie 1' }],
      categorizationItems: [{ id: 'item-1', text: 'Element A' }],
    };

    const parsed = QuestionStudentDTOSchema.parse(categorizationStudentPayload);
    expect(parsed.categorizationItems?.[0]).toEqual({ id: 'item-1', text: 'Element A' });
    expect(
      Object.prototype.hasOwnProperty.call(
        parsed.categorizationItems?.[0] ?? {},
        'correctCategoryId',
      ),
    ).toBe(false);
  });

  it('strips matching solution pairing from ACTIVE MATCHING QuestionStudentDTO', () => {
    const matchingStudentPayload = {
      id: '22222222-2222-4222-8222-222222222222',
      text: 'Ordne zu',
      type: 'MATCHING' as const,
      timer: 30,
      difficulty: 'MEDIUM' as const,
      order: 1,
      answers: [],
      matchingLeftOptions: [{ id: 'status-200', text: 'HTTP 200' }],
      matchingRightOptions: [{ id: 'meaning-ok', text: 'OK' }],
    };

    const parsed = QuestionStudentDTOSchema.parse(matchingStudentPayload);
    expect(parsed.matchingLeftOptions).toEqual([{ id: 'status-200', text: 'HTTP 200' }]);
    expect(parsed.matchingRightOptions).toEqual([{ id: 'meaning-ok', text: 'OK' }]);
    expect((parsed as Record<string, unknown>)['matchingPairs']).toBeUndefined();
  });

  it('accepts participant Q&A payloads without host-only controversy fields', () => {
    const parsed = QaQuestionDTOSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      text: 'Was ist klausurrelevant?',
      upvoteCount: 4,
      status: 'ACTIVE',
      createdAt: '2026-03-13T12:00:00.000Z',
      hasUpvoted: true,
      isOwn: false,
      myVote: 'UP',
    });

    expect(parsed).not.toHaveProperty('controversyScore');
    expect(parsed).not.toHaveProperty('isControversial');
    expect(parsed).not.toHaveProperty('bestScore');
    expect(parsed).not.toHaveProperty('score');
    expect(parsed).not.toHaveProperty('moderationCompass');
    expect(parsed).not.toHaveProperty('compassCards');
  });

  it('does not require nlp on participant Q&A payloads', () => {
    const parsed = QaQuestionDTOSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      text: 'Was ist klausurrelevant?',
      upvoteCount: 4,
      status: 'ACTIVE',
      createdAt: '2026-03-13T12:00:00.000Z',
      hasUpvoted: true,
      isOwn: false,
      myVote: 'UP',
    });

    expect(parsed).not.toHaveProperty('nlp');
    expect(parsed).not.toHaveProperty('nlpStatus');
    expect(parsed).not.toHaveProperty('modelVersion');
  });

  it('strips compass and moderation artifacts from participant question payloads', () => {
    const parsed = QuestionStudentDTOSchema.parse({
      ...validStudentPayload,
      moderationCompass: { cards: [] },
      compassCards: [{ kind: 'topics' }],
      numericHistogram: [{ from: 1, to: 2, count: 3, inBand: false }],
      correctVoterCount: 4,
      isCorrect: true,
    });

    expect(parsed).not.toHaveProperty('moderationCompass');
    expect(parsed).not.toHaveProperty('compassCards');
    expect(parsed).not.toHaveProperty('numericHistogram');
    expect(parsed).not.toHaveProperty('correctVoterCount');
    expect(parsed).not.toHaveProperty('isCorrect');
  });
});
