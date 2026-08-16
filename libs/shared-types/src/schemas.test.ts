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
  serializeQuizHistoryAccessMaterial,
  SetTimerAccommodationInputSchema,
  SubmitVoteInputSchema,
  evaluateMatchingAnswer,
  evaluateOrderingAnswer,
  evaluateCategorizationAnswer,
  stableShuffleWithContext,
  buildMatchingStats,
  buildOrderingStats,
  buildCategorizationStats,
  TIMER_ACCOMMODATION_EXTENDED_FACTOR,
  TrpcWebSocketParticipantBindingSchema,
  AnalyzeWordCloudInputSchema,
  WordCloudAnalysisResultDTOSchema,
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

  it('bindet alle strukturierten Lösungen und Shuffle-Optionen in den Historiennachweis ein', () => {
    const serializeQuestion = (question: Record<string, unknown>) =>
      serializeQuizHistoryAccessMaterial({
        ...quizUploadBase,
        questions: [
          {
            text: 'Strukturfrage',
            difficulty: 'MEDIUM',
            order: 0,
            answers: [],
            ...question,
          },
        ],
      } as Parameters<typeof serializeQuizHistoryAccessMaterial>[0]);

    const matching = {
      type: 'MATCHING',
      matchingPairs: [
        { leftId: 'left-a', left: 'A', rightId: 'right-a', right: '1' },
        { leftId: 'left-b', left: 'B', rightId: 'right-b', right: '2' },
      ],
      matchingShuffleRight: true,
    };
    expect(
      serializeQuestion({
        ...matching,
        matchingPairs: matching.matchingPairs.map((pair, index) =>
          index === 0 ? { ...pair, right: 'geändert' } : pair,
        ),
      }),
    ).not.toBe(serializeQuestion(matching));
    expect(serializeQuestion({ ...matching, matchingShuffleRight: false })).not.toBe(
      serializeQuestion(matching),
    );

    const ordering = {
      type: 'ORDERING',
      orderingItems: [
        { id: 'step-a', text: 'A' },
        { id: 'step-b', text: 'B' },
        { id: 'step-c', text: 'C' },
      ],
    };
    expect(
      serializeQuestion({ ...ordering, orderingItems: [...ordering.orderingItems].reverse() }),
    ).not.toBe(serializeQuestion(ordering));

    const categorization = {
      type: 'CATEGORIZATION',
      categories: [
        { id: 'category-a', name: 'A' },
        { id: 'category-b', name: 'B' },
      ],
      categorizationItems: [
        { id: 'item-a', text: 'A1', correctCategoryId: 'category-a' },
        { id: 'item-b', text: 'A2', correctCategoryId: 'category-a' },
        { id: 'item-c', text: 'B1', correctCategoryId: 'category-b' },
        { id: 'item-d', text: 'B2', correctCategoryId: 'category-b' },
      ],
      categorizationShuffleItems: true,
    };
    expect(
      serializeQuestion({
        ...categorization,
        categorizationItems: categorization.categorizationItems.map((item, index) =>
          index === 0 ? { ...item, correctCategoryId: 'category-b' } : item,
        ),
      }),
    ).not.toBe(serializeQuestion(categorization));
    expect(serializeQuestion({ ...categorization, categorizationShuffleItems: false })).not.toBe(
      serializeQuestion(categorization),
    );
  });

  it('weist getrimmt doppelte sichtbare Ordering-Elemente und Kategorienamen zurück', () => {
    const ordering = QuizUploadInputSchema.safeParse({
      ...quizUploadBase,
      questions: [
        {
          text: 'Sortiere',
          type: 'ORDERING',
          difficulty: 'MEDIUM',
          order: 0,
          answers: [],
          orderingItems: [
            { id: 'step-a', text: 'Start' },
            { id: 'step-b', text: ' Start ' },
            { id: 'step-c', text: 'Ende' },
          ],
        },
      ],
    });
    expect(ordering.success).toBe(false);
    if (!ordering.success) {
      expect(ordering.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['questions', 0, 'orderingItems', 1, 'text'] }),
        ]),
      );
    }

    const categorization = QuizUploadInputSchema.safeParse({
      ...quizUploadBase,
      questions: [
        {
          text: 'Ordne zu',
          type: 'CATEGORIZATION',
          difficulty: 'MEDIUM',
          order: 0,
          answers: [],
          categories: [
            { id: 'category-a', name: 'Literatur' },
            { id: 'category-b', name: ' Literatur ' },
          ],
          categorizationItems: [
            { id: 'item-a', text: 'A', correctCategoryId: 'category-a' },
            { id: 'item-b', text: 'B', correctCategoryId: 'category-a' },
            { id: 'item-c', text: 'C', correctCategoryId: 'category-b' },
            { id: 'item-d', text: 'D', correctCategoryId: 'category-b' },
          ],
        },
      ],
    });
    expect(categorization.success).toBe(false);
    if (!categorization.success) {
      expect(categorization.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['questions', 0, 'categories', 1, 'name'] }),
        ]),
      );
    }
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
    for (let seed = 0; seed < 2_000; seed += 1) {
      expect(stableShuffleWithContext(items, `participant-${seed}`, 'question')).toHaveLength(
        items.length,
      );
      expect(stableShuffleWithContext(items, `participant-${seed}`, 'question').sort()).toEqual(
        [...items].sort(),
      );
    }
  });

  it('wertet MATCHING-Antworten korrekt aus (100% Treffer nötig)', () => {
    const pairs = [
      { leftId: 'http-200', left: 'HTTP 200', rightId: 'ok', right: 'OK' },
      { leftId: 'http-404', left: 'HTTP 404', rightId: 'not-found', right: 'Not Found' },
    ];
    const correct = [
      { leftId: 'http-200', rightId: 'ok' },
      { leftId: 'http-404', rightId: 'not-found' },
    ];
    const wrong = [
      { leftId: 'http-200', rightId: 'not-found' },
      { leftId: 'http-404', rightId: 'ok' },
    ];

    expect(evaluateMatchingAnswer(correct, pairs)).toBe(true);
    expect(evaluateMatchingAnswer(wrong, pairs)).toBe(false);
    expect(
      evaluateMatchingAnswer(
        [
          { leftId: 'http-200', rightId: 'ok' },
          { leftId: 'http-200', rightId: 'ok' },
        ],
        pairs,
      ),
    ).toBe(false);
  });

  it('wertet ORDERING-Antworten korrekt aus', () => {
    const correctSeq = ['id-1', 'id-2', 'id-3'];
    expect(evaluateOrderingAnswer(['id-1', 'id-2', 'id-3'], correctSeq)).toBe(true);
    expect(evaluateOrderingAnswer(['id-2', 'id-1', 'id-3'], correctSeq)).toBe(false);
  });

  it('wertet CATEGORIZATION-Antworten korrekt aus', () => {
    const model = [
      { id: 'angular', text: 'Angular', correctCategoryId: 'fe' },
      { id: 'node', text: 'Node', correctCategoryId: 'be' },
    ];
    const correctSel = [
      { itemId: 'angular', categoryId: 'fe' },
      { itemId: 'node', categoryId: 'be' },
    ];
    const wrongSel = [
      { itemId: 'angular', categoryId: 'be' },
      { itemId: 'node', categoryId: 'fe' },
    ];

    expect(evaluateCategorizationAnswer(correctSel, model)).toBe(true);
    expect(evaluateCategorizationAnswer(wrongSel, model)).toBe(false);
    expect(
      evaluateCategorizationAnswer(
        [
          { itemId: 'angular', categoryId: 'fe' },
          { itemId: 'angular', categoryId: 'fe' },
        ],
        model,
      ),
    ).toBe(false);
  });

  it('validiert SubmitVoteInput für MATCHING, ORDERING und CATEGORIZATION', () => {
    const baseVote = { sessionId, participantId, questionId };
    expect(
      SubmitVoteInputSchema.safeParse({
        ...baseVote,
        matchingSelections: [
          { leftId: 'http-200', rightId: 'ok' },
          { leftId: 'http-404', rightId: 'not-found' },
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
          { itemId: 'angular', categoryId: 'fe' },
          { itemId: 'node', categoryId: 'be' },
          { itemId: 'react', categoryId: 'fe' },
          { itemId: 'express', categoryId: 'be' },
        ],
      }).success,
    ).toBe(true);
  });

  it('aggregiert Matching- und Ordering-Statistiken', () => {
    const matchingStats = buildMatchingStats(
      [
        {
          selections: [
            { leftId: 'a', rightId: '1' },
            { leftId: 'b', rightId: '2' },
          ],
        },
        {
          selections: [
            { leftId: 'a', rightId: '2' },
            { leftId: 'b', rightId: '1' },
          ],
        },
      ],
      [
        { leftId: 'a', left: 'A', rightId: '1', right: '1' },
        { leftId: 'b', left: 'B', rightId: '2', right: '2' },
      ],
    );
    expect(matchingStats.fullyCorrectCount).toBe(1);
    expect(matchingStats.pairHitRates[0]?.hitRatePercent).toBe(50);
    expect(matchingStats.commonConfusions[0]?.wrongRight).toBe('2');
    expect(matchingStats.selectionCounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ leftId: 'a', rightId: '1', count: 1 }),
        expect.objectContaining({ leftId: 'a', rightId: '2', count: 1 }),
      ]),
    );

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

    const shiftedOrderingStats = buildOrderingStats(
      [{ sequence: ['b', 'c', 'a'] }],
      [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ],
    );
    expect(shiftedOrderingStats.commonSwaps).toEqual([]);
  });

  it('aggregiert die vollständige Kategorisierungsmatrix über stabile IDs', () => {
    const stats = buildCategorizationStats(
      [
        {
          selections: [
            { itemId: 'angular', categoryId: 'fe' },
            { itemId: 'node', categoryId: 'be' },
          ],
        },
        {
          selections: [
            { itemId: 'angular', categoryId: 'be' },
            { itemId: 'node', categoryId: 'be' },
          ],
        },
      ],
      [
        { id: 'angular', text: 'Angular', correctCategoryId: 'fe' },
        { id: 'node', text: 'Node', correctCategoryId: 'be' },
      ],
      [
        { id: 'fe', name: 'Frontend' },
        { id: 'be', name: 'Backend' },
      ],
    );

    expect(stats.fullyCorrectCount).toBe(1);
    expect(stats.itemCategoryCounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: 'angular', categoryId: 'fe', count: 1 }),
        expect.objectContaining({ itemId: 'angular', categoryId: 'be', count: 1 }),
        expect.objectContaining({ itemId: 'node', categoryId: 'be', count: 2 }),
      ]),
    );
  });
});

describe('Word-Cloud-Normalisierungsvertrag (Story 1.14b)', () => {
  const sourceItem = {
    id: '11111111-1111-4111-8111-111111111111',
    text: 'Kapitel 4',
    weight: 1,
  };

  it('setzt fehlende normalization auf NONE', () => {
    const parsed = AnalyzeWordCloudInputSchema.parse({
      sessionCode: 'ABC123',
      mode: 'LEXICAL',
      locale: 'de',
      metric: 'TOP',
      items: [sourceItem],
    });
    expect(parsed.normalization).toBe('NONE');
    expect(parsed.maxNgramLength).toBeUndefined();
  });

  it('akzeptiert maxNgramLength 1–3 und lehnt andere Längen ab', () => {
    expect(
      AnalyzeWordCloudInputSchema.parse({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        items: [sourceItem],
        maxNgramLength: 3,
      }).maxNgramLength,
    ).toBe(3);

    expect(() =>
      AnalyzeWordCloudInputSchema.parse({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        items: [sourceItem],
        maxNgramLength: 4,
      }),
    ).toThrow();
  });

  it('akzeptiert LEMMA und verlangt die neuen Ergebnisachsen', () => {
    const parsed = AnalyzeWordCloudInputSchema.parse({
      sessionCode: 'ABC123',
      mode: 'LEXICAL',
      locale: 'en',
      metric: 'TOP',
      normalization: 'LEMMA',
      items: [sourceItem],
    });
    expect(parsed.normalization).toBe('LEMMA');

    const result = WordCloudAnalysisResultDTOSchema.safeParse({
      mode: 'LEXICAL',
      locale: 'en',
      metric: 'TOP',
      generatedAt: '2026-08-15T09:00:00.000Z',
      fallbackUsed: false,
      entries: [
        {
          key: 'chapter',
          label: 'chapter',
          count: 1,
          basisLabel: null,
          members: [{ sourceId: sourceItem.id, text: sourceItem.text, weight: 1 }],
          variants: ['chapter'],
          confidence: null,
        },
      ],
    });
    expect(result.success).toBe(false);

    const complete = WordCloudAnalysisResultDTOSchema.parse({
      mode: 'LEXICAL',
      locale: 'en',
      metric: 'TOP',
      generatedAt: '2026-08-15T09:00:00.000Z',
      fallbackUsed: false,
      normalization: 'LEMMA',
      normalizationApplied: 'NONE',
      normalizationFallbackUsed: true,
      normalizationFallbackReason: 'NLP_DISABLED',
      fallbackLocale: 'en',
      analysisVersion: '1.14b.8',
      modelId: null,
      snapshotHash: 'a'.repeat(64),
      entries: [
        {
          key: 'chapter',
          label: 'chapter',
          count: 1,
          basisLabel: null,
          members: [{ sourceId: sourceItem.id, text: sourceItem.text, weight: 1 }],
          variants: ['chapter'],
          confidence: null,
        },
      ],
    });
    expect(complete.normalizationApplied).toBe('NONE');
  });

  it('akzeptiert fr/es und lehnt it als Analyse-Locale ab', () => {
    expect(
      AnalyzeWordCloudInputSchema.parse({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'fr',
        metric: 'TOP',
        items: [sourceItem],
      }).locale,
    ).toBe('fr');
    expect(
      AnalyzeWordCloudInputSchema.parse({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'es',
        metric: 'TOP',
        items: [sourceItem],
      }).locale,
    ).toBe('es');
    expect(() =>
      AnalyzeWordCloudInputSchema.parse({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'it',
        metric: 'TOP',
        items: [sourceItem],
      }),
    ).toThrow();
  });

  it('begrenzt Item-Textlaenge hart', () => {
    expect(() =>
      AnalyzeWordCloudInputSchema.parse({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        items: [{ ...sourceItem, text: 'a'.repeat(4001) }],
      }),
    ).toThrow();
  });
});
