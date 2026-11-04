import { describe, expect, it } from 'vitest';
import type { HostCurrentQuestionDTO, HostVoteProgressDTO } from '@arsnova/shared-types';
import {
  presenterAllHaveVoted,
  presenterAllSessionReady,
  presenterCanOpenFollowingQuestion,
  presenterOfferDiscussion,
  presenterQuestionMatchesSession,
  presenterTimerBlocksReveal,
  presenterVotingClosed,
} from './presenter-quiz-controls.util';

const question = {
  questionId: '11111111-1111-4111-8111-111111111111',
  order: 0,
  totalQuestions: 2,
  text: 'Frage',
  type: 'SINGLE_CHOICE',
  currentRound: 1,
  hasUnopenedFollowingQuestion: true,
  peerInstructionSuggestion: { suggested: true },
  totalVotes: 1,
} as HostCurrentQuestionDTO;

const progress = {
  questionId: question.questionId,
  questionOrder: 0,
  round: 1,
  totalVotes: 3,
  blockingTimerAccommodationCount: 0,
  peerInstructionSuggestion: { suggested: true },
} as HostVoteProgressDTO;

describe('presenter-quiz-controls.util', () => {
  it('meldet alle Stimmen erst bei voller Teilnehmerzahl', () => {
    expect(presenterAllHaveVoted('ACTIVE', question, progress, 3)).toBe(true);
    expect(presenterAllHaveVoted('ACTIVE', question, progress, 4)).toBe(false);
    expect(presenterAllHaveVoted('RESULTS', question, progress, 3)).toBe(false);
  });

  it('beendet die Abstimmung bei vollem Stand oder Countdown 0', () => {
    expect(presenterVotingClosed('ACTIVE', question, { ...progress, totalVotes: 1 }, 3, 0)).toBe(
      true,
    );
    expect(presenterVotingClosed('ACTIVE', question, progress, 3, 12)).toBe(true);
    expect(presenterVotingClosed('ACTIVE', question, { ...progress, totalVotes: 1 }, 3, 4)).toBe(
      false,
    );
  });

  it('bietet die Diskussionsphase nur in Runde 1 nach der Empfehlung an', () => {
    expect(presenterOfferDiscussion('ACTIVE', question, progress, 3, 12)).toBe(true);
    expect(
      presenterOfferDiscussion('ACTIVE', { ...question, currentRound: 2 }, progress, 3, 0),
    ).toBe(false);
    expect(
      presenterOfferDiscussion(
        'ACTIVE',
        question,
        {
          ...progress,
          totalVotes: 1,
          peerInstructionSuggestion: { suggested: false, reason: 'CORRECTNESS_WINDOW' },
        },
        3,
        4,
      ),
    ).toBe(false);
    expect(
      presenterOfferDiscussion(
        'ACTIVE',
        question,
        { ...progress, totalVotes: 1, peerInstructionSuggestion: undefined },
        3,
        0,
      ),
    ).toBe(false);
    expect(
      presenterOfferDiscussion(
        'ACTIVE',
        question,
        { ...progress, questionId: '22222222-2222-4222-8222-222222222222', totalVotes: 1 },
        3,
        0,
      ),
    ).toBe(true);
  });

  it('verwirft einen Snapshot einer anderen Frage oder Runde', () => {
    expect(presenterQuestionMatchesSession(question, 0, 1)).toBe(true);
    expect(presenterQuestionMatchesSession(question, 1, 1)).toBe(false);
    expect(presenterQuestionMatchesSession(question, 0, 2)).toBe(false);
    expect(presenterQuestionMatchesSession(question, undefined, undefined)).toBe(true);
    expect(presenterQuestionMatchesSession(null, 0, 1)).toBe(false);
  });

  it('sperrt die Freigabe, solange persönliche Fenster laufen', () => {
    expect(
      presenterTimerBlocksReveal(
        'ACTIVE',
        question,
        { ...progress, blockingTimerAccommodationCount: 2 },
        true,
      ),
    ).toBe(true);
    expect(
      presenterTimerBlocksReveal(
        'ACTIVE',
        question,
        { ...progress, blockingTimerAccommodationCount: 2 },
        false,
      ),
    ).toBe(false);
  });

  it('folgt der ungeöffneten Folgefrage', () => {
    expect(presenterCanOpenFollowingQuestion(question)).toBe(true);
    expect(
      presenterCanOpenFollowingQuestion({ ...question, hasUnopenedFollowingQuestion: false }),
    ).toBe(false);
  });

  it('gilt als bereit erst, wenn alle Teilnehmenden verbunden und bereit sind', () => {
    expect(
      presenterAllSessionReady(
        'QUESTION_OPEN',
        { readyCount: 3, connectedCount: 3, allConnectedReady: true },
        3,
      ),
    ).toBe(true);
    expect(
      presenterAllSessionReady(
        'QUESTION_OPEN',
        { readyCount: 2, connectedCount: 2, allConnectedReady: true },
        3,
      ),
    ).toBe(false);
  });
});
