import { describe, expect, it } from 'vitest';
import {
  AnswerOptionRevealedDTOSchema,
  AnswerOptionStudentDTOSchema,
  JoinSessionInputSchema,
  PublicSessionCodeLookupInputSchema,
  previewMaxCorrectScoreAtElapsedSeconds,
  QUIZ_UPLOAD_MAX_OPTIONS_PER_QUESTION,
  QUIZ_UPLOAD_MAX_PAYLOAD_BYTES,
  QUIZ_UPLOAD_MAX_QUESTIONS,
  QuizUploadInputSchema,
  QuestionRevealedDTOSchema,
  QuestionStudentDTOSchema,
  resolvePersonalTimerSeconds,
  SetTimerAccommodationInputSchema,
  SubmitVoteInputSchema,
  evaluateMatchingAnswer,
  evaluateOrderingAnswer,
  evaluateCategorizationAnswer,
  stableShuffleWithContext,
  buildMatchingStats,
  buildOrderingStats,
  TIMER_ACCOMMODATION_EXTENDED_FACTOR,
  TrpcWebSocketParticipantBindingSchema,
} from './schemas.js';

const sessionId = '10000000-0000-4000-8000-000000000001';
const participantId = '10000000-0000-4000-8000-000000000002';
const questionId = '10000000-0000-4000-8000-000000000003';
const answerId = '10000000-0000-4000-8000-000000000004';
const anonymousClientId = '10000000-0000-4000-8000-000000000005';

describe('öffentliche Contract-Schemas', () => {
  const quizUploadBase = {
    name: 'Classroom-Quiz',
    showLeaderboard: true,
    allowCustomNicknames: true,
    enableSoundEffects: true,
    enableRewardEffects: true,
    enableMotivationMessages: true,
    enableEmojiReactions: true,
    anonymousMode: false,
    teamMode: false,
    nicknameTheme: 'NOBEL_LAUREATES' as const,
  };

  it('akzeptiert ein normales Classroom-Quiz deutlich unter den Upload-Caps', () => {
    const questions = Array.from({ length: 100 }, (_, order) => ({
      text: `Frage ${order + 1}`,
      type: 'MULTIPLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      order,
      answers: Array.from({ length: 4 }, (_, answer) => ({
        text: `Antwort ${answer + 1}`,
        isCorrect: answer === 0,
      })),
    }));

    expect(QuizUploadInputSchema.safeParse({ ...quizUploadBase, questions }).success).toBe(true);
  });

  it('weist zu viele Fragen und Antwortoptionen zurück', () => {
    const question = {
      text: 'Frage',
      type: 'MULTIPLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      order: 0,
      answers: Array.from({ length: QUIZ_UPLOAD_MAX_OPTIONS_PER_QUESTION + 1 }, (_, index) => ({
        text: `Antwort ${index}`,
        isCorrect: index === 0,
      })),
    };
    expect(
      QuizUploadInputSchema.safeParse({
        ...quizUploadBase,
        questions: [question],
      }).success,
    ).toBe(false);
    expect(
      QuizUploadInputSchema.safeParse({
        ...quizUploadBase,
        questions: Array.from({ length: QUIZ_UPLOAD_MAX_QUESTIONS + 1 }, (_, order) => ({
          ...question,
          order,
          answers: [{ text: 'Antwort', isCorrect: true }],
        })),
      }).success,
    ).toBe(false);
  });

  it('weist fachlich zu große Quiz-Payloads unterhalb der 2-MiB-Infrastrukturgrenze zurück', () => {
    const questions = Array.from({ length: QUIZ_UPLOAD_MAX_QUESTIONS }, (_, order) => ({
      text: 'F'.repeat(2000),
      type: 'MULTIPLE_CHOICE' as const,
      difficulty: 'MEDIUM' as const,
      order,
      answers: Array.from({ length: QUIZ_UPLOAD_MAX_OPTIONS_PER_QUESTION }, (_, answer) => ({
        text: `${answer}${'A'.repeat(498)}`,
        isCorrect: answer === 0,
      })),
    }));
    const payload = { ...quizUploadBase, description: 'D'.repeat(5000), questions };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
    expect(payloadBytes).toBeGreaterThan(QUIZ_UPLOAD_MAX_PAYLOAD_BYTES);
    expect(payloadBytes).toBeLessThan(2 * 1024 * 1024);
    expect(QuizUploadInputSchema.safeParse(payload).success).toBe(false);
  });

  it('weist Lösungsdaten in studentischen Antwortoptionen strikt zurück', () => {
    const result = AnswerOptionStudentDTOSchema.safeParse({
      id: answerId,
      text: 'Antwort',
      isCorrect: true,
    });

    expect(result.success).toBe(false);
  });

  it('erlaubt Lösungsdaten ausschließlich im aufgelösten Antwortvertrag', () => {
    const result = AnswerOptionRevealedDTOSchema.safeParse({
      id: answerId,
      text: 'Antwort',
      isCorrect: true,
      voteCount: 2,
      votePercentage: 100,
    });

    expect(result.success).toBe(true);
  });

  it('entfernt Lösungs- und Toleranzwerte aus der aktiven Teilnehmerfrage', () => {
    const parsed = QuestionStudentDTOSchema.parse({
      id: questionId,
      text: 'Schätzfrage',
      type: 'NUMERIC_ESTIMATE',
      timer: null,
      difficulty: 'MEDIUM',
      order: 0,
      answers: [],
      numericInputType: 'INTEGER',
      numericReferenceValue: 42,
      numericIntervalLeft: 40,
      numericIntervalRight: 44,
    });

    expect(parsed).not.toHaveProperty('numericReferenceValue');
    expect(parsed).not.toHaveProperty('numericIntervalLeft');
    expect(parsed).not.toHaveProperty('numericIntervalRight');
  });

  it('normalisiert die erste Vote-Runde und begrenzt Folgerunden', () => {
    const baseVote = {
      sessionId,
      participantId,
      questionId,
      answerIds: [answerId],
    };

    expect(SubmitVoteInputSchema.parse(baseVote).round).toBe(1);
    expect(SubmitVoteInputSchema.safeParse({ ...baseVote, round: 2 }).success).toBe(true);
    expect(SubmitVoteInputSchema.safeParse({ ...baseVote, round: 3 }).success).toBe(false);
  });

  it('transportiert die aktive Runde für numerische Zwei-Runden-Ergebnisse', () => {
    const parsed = QuestionRevealedDTOSchema.parse({
      id: questionId,
      text: 'Schätzfrage',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      order: 0,
      answers: [],
      totalVotes: 20,
      numericTwoRounds: true,
      currentRound: 2,
    });

    expect(parsed.numericTwoRounds).toBe(true);
    expect(parsed.currentRound).toBe(2);
  });

  it('erzwingt Session-Code und begrenzte Anzeigenamen', () => {
    expect(
      JoinSessionInputSchema.safeParse({ code: 'ABC123', nickname: 'Ada', anonymousClientId })
        .success,
    ).toBe(true);
    // Übergangskompatibilität für noch aktive Service-Worker-Clients der Vorgängerversion.
    expect(JoinSessionInputSchema.safeParse({ code: 'ABC123', nickname: 'Ada' }).success).toBe(
      true,
    );
    expect(
      JoinSessionInputSchema.safeParse({
        code: 'ABC123',
        nickname: 'Ada',
        anonymousClientId: 'keine-uuid',
      }).success,
    ).toBe(false);
    expect(
      JoinSessionInputSchema.safeParse({ code: 'ABC12', nickname: 'Ada', anonymousClientId })
        .success,
    ).toBe(false);
    expect(
      JoinSessionInputSchema.safeParse({
        code: 'ABC123',
        nickname: 'x'.repeat(31),
        anonymousClientId,
      }).success,
    ).toBe(false);
  });

  it('akzeptiert die optionale Throttle-ID nur als UUID', () => {
    expect(PublicSessionCodeLookupInputSchema.safeParse({ code: 'ABC123' }).success).toBe(true);
    expect(
      PublicSessionCodeLookupInputSchema.safeParse({
        code: 'ABC123',
        anonymousClientId,
      }).success,
    ).toBe(true);
    expect(
      PublicSessionCodeLookupInputSchema.safeParse({
        code: 'ABC123',
        anonymousClientId: 'manipuliert',
      }).success,
    ).toBe(false);
  });

  it('berechnet persönliche Timer-Anpassung ohne Lösungsdaten zu erfordern', () => {
    expect(resolvePersonalTimerSeconds(30, 'DEFAULT')).toBe(30);
    expect(resolvePersonalTimerSeconds(30, 'EXTENDED')).toBe(
      30 * TIMER_ACCOMMODATION_EXTENDED_FACTOR,
    );
    expect(resolvePersonalTimerSeconds(30, 'OFF')).toBeNull();
    expect(resolvePersonalTimerSeconds(null, 'EXTENDED')).toBeNull();

    const parsed = QuestionStudentDTOSchema.parse({
      id: questionId,
      text: 'Frage',
      type: 'SINGLE_CHOICE',
      timer: 300,
      sessionTimer: 30,
      timerAccommodation: 'EXTENDED',
      difficulty: 'MEDIUM',
      order: 0,
      answers: [{ id: answerId, text: 'A' }],
    });
    expect(parsed.timer).toBe(300);
    expect(parsed.sessionTimer).toBe(30);
    expect(parsed.timerAccommodation).toBe('EXTENDED');
    expect(parsed).not.toHaveProperty('isCorrect');

    expect(
      SetTimerAccommodationInputSchema.safeParse({
        code: 'ABC123',
        participantId,
        accommodation: 'OFF',
      }).success,
    ).toBe(true);
    expect(
      SetTimerAccommodationInputSchema.safeParse({
        code: 'ABC123',
        participantId,
        accommodation: 'DOUBLE',
      }).success,
    ).toBe(false);
  });

  it('punktet die Vorschau am Session-Timer und hält in der Nachlaufzeit das Minimum', () => {
    expect(
      previewMaxCorrectScoreAtElapsedSeconds({
        difficulty: 'MEDIUM',
        sessionTimerSeconds: 60,
        elapsedSeconds: 0,
      }),
    ).toBe(2000);
    expect(
      previewMaxCorrectScoreAtElapsedSeconds({
        difficulty: 'MEDIUM',
        sessionTimerSeconds: 60,
        elapsedSeconds: 30,
      }),
    ).toBe(1000);
    expect(
      previewMaxCorrectScoreAtElapsedSeconds({
        difficulty: 'MEDIUM',
        sessionTimerSeconds: 60,
        elapsedSeconds: 60,
      }),
    ).toBe(200);
    expect(
      previewMaxCorrectScoreAtElapsedSeconds({
        difficulty: 'MEDIUM',
        sessionTimerSeconds: 60,
        elapsedSeconds: 120,
      }),
    ).toBe(200);
  });
});

describe('tRPC-WebSocket-Participant-Binding', () => {
  it('normalisiert den Code und akzeptiert eine UUID als optionales Throttle-Signal', () => {
    expect(
      TrpcWebSocketParticipantBindingSchema.parse({
        sessionCode: 'ab12cd',
        participantId,
        'x-host-token': 'bleibt Transport-Metadatum',
      }),
    ).toEqual({ sessionCode: 'AB12CD', participantId });
  });

  it('verwirft nicht kanonisch begrenzbare Codes und ungültige Participant-IDs', () => {
    expect(
      TrpcWebSocketParticipantBindingSchema.safeParse({
        sessionCode: 'TOO-LONG',
        participantId,
      }).success,
    ).toBe(false);
    expect(
      TrpcWebSocketParticipantBindingSchema.safeParse({
        sessionCode: 'ABC123',
        participantId: 'not-a-uuid',
      }).success,
    ).toBe(false);
  });
});

describe('Neue Fragentypen (MATCHING, ORDERING, CATEGORIZATION)', () => {
  it('deterministisches stableShuffleWithContext ist stabil pro Participant & Question', () => {
    const items = ['A', 'B', 'C', 'D', 'E'];
    const p1_q1_run1 = stableShuffleWithContext(items, 'participant-1', 'question-100');
    const p1_q1_run2 = stableShuffleWithContext(items, 'participant-1', 'question-100');
    const p2_q1_run1 = stableShuffleWithContext(items, 'participant-2', 'question-100');

    expect(p1_q1_run1).toEqual(p1_q1_run2);
    expect(p1_q1_run1).not.toEqual(items); // Shuffled
    expect(p1_q1_run1).not.toEqual(p2_q1_run1); // Differing seed for different participant
  });

  it('wertet MATCHING-Antworten korrekt aus (100% Treffer nötig)', () => {
    const pairs = [
      { left: 'HTTP 200', right: 'OK' },
      { left: 'HTTP 404', right: 'Not Found' },
    ];
    const correct = [
      { left: 'HTTP 200', right: 'OK' },
      { left: 'HTTP 404', right: 'Not Found' },
    ];
    const wrong = [
      { left: 'HTTP 200', right: 'Not Found' },
      { left: 'HTTP 404', right: 'OK' },
    ];

    expect(evaluateMatchingAnswer(correct, pairs)).toBe(true);
    expect(evaluateMatchingAnswer(wrong, pairs)).toBe(false);
  });

  it('wertet ORDERING-Antworten korrekt aus', () => {
    const correctSeq = ['id-1', 'id-2', 'id-3'];
    expect(evaluateOrderingAnswer(['id-1', 'id-2', 'id-3'], correctSeq)).toBe(true);
    expect(evaluateOrderingAnswer(['id-2', 'id-1', 'id-3'], correctSeq)).toBe(false);
  });

  it('wertet CATEGORIZATION-Antworten korrekt aus', () => {
    const model = [
      { text: 'Angular', correctCategoryId: 'fe' },
      { text: 'Node', correctCategoryId: 'be' },
    ];
    const correctSel = [
      { text: 'Angular', categoryId: 'fe' },
      { text: 'Node', categoryId: 'be' },
    ];
    const wrongSel = [
      { text: 'Angular', categoryId: 'be' },
      { text: 'Node', categoryId: 'fe' },
    ];

    expect(evaluateCategorizationAnswer(correctSel, model)).toBe(true);
    expect(evaluateCategorizationAnswer(wrongSel, model)).toBe(false);
  });

  it('validiert SubmitVoteInput für MATCHING, ORDERING und CATEGORIZATION', () => {
    const baseVote = { sessionId, participantId, questionId };
    expect(
      SubmitVoteInputSchema.safeParse({
        ...baseVote,
        matchingSelections: [
          { left: 'HTTP 200', right: 'OK' },
          { left: 'HTTP 404', right: 'Not Found' },
        ],
      }).success,
    ).toBe(true);

    expect(
      SubmitVoteInputSchema.safeParse({
        ...baseVote,
        orderingSequence: ['Step 1', 'Step 2', 'Step 3'],
      }).success,
    ).toBe(true);

    expect(
      SubmitVoteInputSchema.safeParse({
        ...baseVote,
        categorizationSelections: [
          { text: 'Angular', categoryId: 'fe' },
          { text: 'Node', categoryId: 'be' },
          { text: 'React', categoryId: 'fe' },
          { text: 'Express', categoryId: 'be' },
        ],
      }).success,
    ).toBe(true);
  });

  it('aggregiert Matching- und Ordering-Statistiken', () => {
    const matchingStats = buildMatchingStats(
      [
        {
          selections: [
            { left: 'A', right: '1' },
            { left: 'B', right: '2' },
          ],
        },
        {
          selections: [
            { left: 'A', right: '2' },
            { left: 'B', right: '1' },
          ],
        },
      ],
      [
        { left: 'A', right: '1' },
        { left: 'B', right: '2' },
      ],
    );
    expect(matchingStats.fullyCorrectCount).toBe(1);
    expect(matchingStats.pairHitRates[0]?.hitRatePercent).toBe(50);
    expect(matchingStats.commonConfusions[0]?.wrongRight).toBe('2');

    const orderingStats = buildOrderingStats(
      [{ sequence: ['a', 'b', 'c'] }, { sequence: ['b', 'a', 'c'] }],
      [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ],
    );
    expect(orderingStats.fullyCorrectCount).toBe(1);
    expect(orderingStats.commonSwaps.length).toBeGreaterThan(0);
    // One adjacent transposition (a↔b) must count once per vote, not twice.
    expect(orderingStats.commonSwaps[0]?.count).toBe(1);
  });
});
