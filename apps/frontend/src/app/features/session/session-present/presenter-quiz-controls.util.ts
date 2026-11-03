import type {
  HostCurrentQuestionDTO,
  HostVoteProgressDTO,
  ReadingReadyStatusDTO,
  SessionInfoDTO,
} from '@arsnova/shared-types';

export type PresenterQuizPhase = SessionInfoDTO['status'] | null;

/** Stimmen der aktuellen Runde, bevorzugt aus dem Live-Fortschritt. */
export function presenterLiveVoteCount(
  question: HostCurrentQuestionDTO | null,
  progress: HostVoteProgressDTO | null,
): number {
  if (
    progress &&
    question &&
    progress.questionId === question.questionId &&
    progress.questionOrder === question.order &&
    progress.round === (question.currentRound ?? 1)
  ) {
    return progress.totalVotes;
  }
  if (question?.type === 'RATING') {
    return question.ratingCount ?? 0;
  }
  if (question?.type === 'FREETEXT') {
    return question.freeTextResponses?.length ?? 0;
  }
  return question?.totalVotes ?? 0;
}

export function presenterVoteProgressMatches(
  question: HostCurrentQuestionDTO | null,
  progress: HostVoteProgressDTO | null,
): progress is HostVoteProgressDTO {
  return (
    progress !== null &&
    question !== null &&
    progress.questionId === question.questionId &&
    progress.questionOrder === question.order &&
    progress.round === (question.currentRound ?? 1)
  );
}

export function presenterAllHaveVoted(
  status: PresenterQuizPhase,
  question: HostCurrentQuestionDTO | null,
  progress: HostVoteProgressDTO | null,
  participantCount: number,
): boolean {
  if (status !== 'ACTIVE' || participantCount <= 0) {
    return false;
  }
  return presenterLiveVoteCount(question, progress) >= participantCount;
}

export function presenterVotingClosed(
  status: PresenterQuizPhase,
  question: HostCurrentQuestionDTO | null,
  progress: HostVoteProgressDTO | null,
  participantCount: number,
  countdownSeconds: number | null,
): boolean {
  return (
    status === 'ACTIVE' &&
    (presenterAllHaveVoted(status, question, progress, participantCount) || countdownSeconds === 0)
  );
}

/**
 * Persönliche 10×-Fenster sperren Freigabe und Diskussionsstart.
 * »Trotzdem freigeben« bleibt auf dem Host, auch nach dem Raum-Countdown.
 */
export function presenterTimerBlocksReveal(
  status: PresenterQuizPhase,
  question: HostCurrentQuestionDTO | null,
  progress: HostVoteProgressDTO | null,
  timerAccommodationEnabled: boolean,
): boolean {
  if (!timerAccommodationEnabled || status !== 'ACTIVE') {
    return false;
  }
  if (!presenterVoteProgressMatches(question, progress)) {
    return false;
  }
  return (progress.blockingTimerAccommodationCount ?? 0) > 0;
}

export function presenterOfferDiscussion(
  status: PresenterQuizPhase,
  question: HostCurrentQuestionDTO | null,
  progress: HostVoteProgressDTO | null,
  participantCount: number,
  countdownSeconds: number | null,
): boolean {
  if (status !== 'ACTIVE' || !question || (question.currentRound ?? 1) !== 1) {
    return false;
  }
  const suggestion = presenterVoteProgressMatches(question, progress)
    ? (progress.peerInstructionSuggestion ?? question.peerInstructionSuggestion ?? null)
    : (question.peerInstructionSuggestion ?? null);
  if (suggestion?.suggested !== true) {
    return false;
  }
  return presenterVotingClosed(status, question, progress, participantCount, countdownSeconds);
}

export function presenterCanOpenFollowingQuestion(
  question: HostCurrentQuestionDTO | null,
): boolean {
  if (!question) {
    return false;
  }
  if (typeof question.hasUnopenedFollowingQuestion === 'boolean') {
    return question.hasUnopenedFollowingQuestion;
  }
  if (typeof question.hasNextQuestion === 'boolean') {
    return question.hasNextQuestion;
  }
  if (question.totalQuestions === null || question.totalQuestions === undefined) {
    return false;
  }
  return question.order + 1 < question.totalQuestions;
}

/** Alle Teilnehmenden der Session, nicht nur die gerade Verbundenen. */
export function presenterAllSessionReady(
  status: PresenterQuizPhase,
  readingReady: ReadingReadyStatusDTO | null,
  participantCount: number,
): boolean {
  if (status !== 'QUESTION_OPEN' || !readingReady || participantCount <= 0) {
    return false;
  }
  return readingReady.allConnectedReady === true && readingReady.connectedCount >= participantCount;
}
