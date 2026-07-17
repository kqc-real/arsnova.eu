import { describe, expect, it } from 'vitest';
import {
  buildDebriefActionPlan,
  buildResponseTimeAggregate,
  buildRoundComparisonFromVotes,
  buildTeamLearningProfiles,
  computeCorrectPercentage,
  selectHardestQuestions,
} from './session-export-insights';

describe('session-export-insights', () => {
  it('berechnet empirische Lösungsquote', () => {
    expect(computeCorrectPercentage(3, 7)).toBe(30);
    expect(computeCorrectPercentage(undefined, 7)).toBeNull();
  });

  it('wählt die schwierigsten Fragen nach Lösungsquote', () => {
    const hardest = selectHardestQuestions(
      [
        {
          questionOrder: 0,
          type: 'SINGLE_CHOICE',
          correctCount: 27,
          incorrectCount: 3,
          correctPercentage: 90,
          difficulty: 'EASY',
        },
        {
          questionOrder: 1,
          type: 'MULTIPLE_CHOICE',
          correctCount: 0,
          incorrectCount: 30,
          correctPercentage: 0,
          difficulty: 'EASY',
        },
        {
          questionOrder: 2,
          type: 'SINGLE_CHOICE',
          correctCount: 8,
          incorrectCount: 22,
          correctPercentage: 26.7,
          difficulty: 'MEDIUM',
        },
      ],
      2,
    );
    expect(hardest.map((entry) => entry.questionOrder)).toEqual([1, 2]);
    expect(hardest[0]?.difficultyMismatch).toBe(true);
  });

  it('baut dens Nachbesprechungsplan aus Selbsteinschätzung und Lösungsquote', () => {
    const plan = buildDebriefActionPlan([
      {
        questionOrder: 3,
        responseCount: 30,
        result: {
          crossTab: {
            correctHigh: 2,
            correctMid: 2,
            correctLow: 2,
            incorrectHigh: 20,
            incorrectMid: 2,
            incorrectLow: 2,
          },
        },
      },
      {
        questionOrder: 1,
        responseCount: 30,
        result: {
          crossTab: {
            correctHigh: 5,
            correctMid: 5,
            correctLow: 15,
            incorrectHigh: 0,
            incorrectMid: 2,
            incorrectLow: 3,
          },
        },
      },
      {
        questionOrder: 7,
        responseCount: 30,
        result: {
          crossTab: {
            correctHigh: 24,
            correctMid: 4,
            correctLow: 2,
            incorrectHigh: 0,
            incorrectMid: 0,
            incorrectLow: 0,
          },
        },
      },
      {
        // 50 % richtig, kein Fehlkonzept-Signal → erneut erklären, nicht „absichern“
        questionOrder: 2,
        responseCount: 50,
        result: {
          crossTab: {
            correctHigh: 0,
            correctMid: 10,
            correctLow: 15,
            incorrectHigh: 0,
            incorrectMid: 10,
            incorrectLow: 15,
          },
        },
      },
    ]);
    expect(plan.debrief).toEqual([3]);
    expect(plan.reinforce).toEqual([1]);
    expect(plan.done).toEqual([7]);
    expect(plan.reteach).toEqual([2]);
  });

  it('stuft „überwiegend gefestigt“ über richtig+hoch an allen Antworten ein', () => {
    // 80 % richtig, aber nur 40 % richtig+hoch → absichern, nicht „gefestigt“
    const plan = buildDebriefActionPlan([
      {
        questionOrder: 8,
        responseCount: 50,
        result: {
          crossTab: {
            correctHigh: 20,
            correctMid: 15,
            correctLow: 5,
            incorrectHigh: 0,
            incorrectMid: 5,
            incorrectLow: 5,
          },
        },
      },
    ]);
    expect(plan.done).toEqual([]);
    expect(plan.reinforce).toEqual([8]);
  });

  it('aggregiert Antwortzeiten und Fristnähe', () => {
    const aggregate = buildResponseTimeAggregate([5000, 10000, 18000, 25000, 28000], 30);
    expect(aggregate?.medianResponseTimeMs).toBe(18000);
    expect(aggregate?.nearDeadlineCount).toBe(2);
  });

  it('baut Peer-Instruction-Vergleich aus Votes', () => {
    const answers = [
      { id: 'a', text: 'Richtig', isCorrect: true },
      { id: 'b', text: 'Falsch', isCorrect: false },
    ];
    const comparison = buildRoundComparisonFromVotes(
      answers,
      [
        { participantId: 'p1', selectedAnswers: [{ answerOptionId: 'b' }] },
        { participantId: 'p2', selectedAnswers: [{ answerOptionId: 'b' }] },
        { participantId: 'p3', selectedAnswers: [{ answerOptionId: 'a' }] },
      ],
      [
        { participantId: 'p1', selectedAnswers: [{ answerOptionId: 'a' }] },
        { participantId: 'p2', selectedAnswers: [{ answerOptionId: 'b' }] },
        { participantId: 'p3', selectedAnswers: [{ answerOptionId: 'a' }] },
      ],
    );
    expect(comparison.round1CorrectCount).toBe(1);
    expect(comparison.round2CorrectCount).toBe(2);
    expect(comparison.opinionShift?.wrongToCorrectCount).toBe(1);
  });

  it('klassifiziert Team-Stärken und Klärungsbedarf mit Schwellen und Prozenten', () => {
    const profiles = buildTeamLearningProfiles({
      teams: [
        {
          teamName: 'Team Apfel',
          memberCount: 5,
          memberIds: new Set(['a', 'b', 'c', 'd', 'e']),
        },
      ],
      questions: [
        {
          questionOrder: 1,
          type: 'SINGLE_CHOICE',
          votes: [
            { participantId: 'a', isCorrect: true },
            { participantId: 'b', isCorrect: true },
            { participantId: 'c', isCorrect: true },
            { participantId: 'd', isCorrect: true },
            { participantId: 'e', isCorrect: true },
          ],
        },
        {
          questionOrder: 3,
          type: 'SINGLE_CHOICE',
          votes: [
            { participantId: 'a', isCorrect: false },
            { participantId: 'b', isCorrect: false },
            { participantId: 'c', isCorrect: false },
            { participantId: 'd', isCorrect: true },
            { participantId: 'e', isCorrect: false },
          ],
        },
        {
          questionOrder: 4,
          type: 'SINGLE_CHOICE',
          votes: [
            { participantId: 'a', isCorrect: true },
            { participantId: 'b', isCorrect: true },
            { participantId: 'c', isCorrect: false },
            { participantId: 'd', isCorrect: true },
            { participantId: 'e', isCorrect: false },
          ],
        },
      ],
    });
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.strengthQuestions).toEqual([{ questionOrder: 1, correctPercentage: 100 }]);
    expect(profiles[0]?.focusQuestions).toEqual([{ questionOrder: 3, correctPercentage: 20 }]);
  });
});
