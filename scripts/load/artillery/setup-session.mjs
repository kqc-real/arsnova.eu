import { createHttpTrpc } from '../lib/trpc-runtime.mjs';

const QUIZ_PAYLOAD = {
  name: `Artillery 500 Live ${Date.now()}`,
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: null,
  timerScaleByDifficulty: false,
  enableSoundEffects: false,
  enableRewardEffects: false,
  enableMotivationMessages: false,
  enableEmojiReactions: false,
  anonymousMode: false,
  teamMode: false,
  teamCount: null,
  teamAssignment: 'AUTO',
  teamNames: [],
  backgroundMusic: null,
  nicknameTheme: 'HIGH_SCHOOL',
  bonusTokenCount: 1,
  readingPhaseEnabled: false,
  preset: 'SERIOUS',
  questions: [
    {
      text: 'Welche Antwort ist korrekt?',
      type: 'SINGLE_CHOICE',
      timer: null,
      difficulty: 'EASY',
      order: 0,
      answers: [
        { text: 'Antwort A', isCorrect: true, order: 0 },
        { text: 'Antwort B', isCorrect: false, order: 1 },
        { text: 'Antwort C', isCorrect: false, order: 2 },
      ],
    },
  ],
};

/**
 * Unified Live-Session: Quiz + Q&A + Blitzlicht, Frage aktiv.
 */
export async function createArtillery500Session(trpcUrl) {
  const publicTrpc = createHttpTrpc(trpcUrl);
  const { quizId } = await publicTrpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  const created = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: true,
    quickFeedbackEnabled: true,
    title: `Artillery 500 ${Date.now()}`,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    anonymousMode: false,
    teamMode: false,
  });

  const hostTrpc = createHttpTrpc(trpcUrl, created.hostToken);
  const opened = await hostTrpc.session.nextQuestion.mutate({ code: created.code });
  if (opened.status === 'QUESTION_OPEN') {
    await hostTrpc.session.revealAnswers.mutate({ code: created.code });
  }

  await hostTrpc.quickFeedback.create.mutate({
    type: 'TEMPO',
    sessionCode: created.code,
  });

  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({
    code: created.code,
  });
  if (!question?.id || !question.answers?.length) {
    throw new Error('Aktive Frage konnte nach Session-Setup nicht geladen werden.');
  }

  return {
    code: created.code,
    hostToken: created.hostToken,
    sessionId: created.sessionId,
    questionId: question.id,
    answerId: question.answers[0].id,
    openedStatus: opened.status,
  };
}

const RECONNECT_QUIZ_PAYLOAD = {
  ...QUIZ_PAYLOAD,
  name: `Artillery Reconnect ${Date.now()}`,
};

/**
 * Quiz-only Session fuer Reconnect-Hochlast (ohne Q&A/Blitzlicht).
 */
export async function createArtilleryReconnectSession(trpcUrl) {
  const publicTrpc = createHttpTrpc(trpcUrl);
  const { quizId } = await publicTrpc.quiz.upload.mutate(RECONNECT_QUIZ_PAYLOAD);
  const created = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    anonymousMode: false,
    teamMode: false,
  });

  const hostTrpc = createHttpTrpc(trpcUrl, created.hostToken);
  const opened = await hostTrpc.session.nextQuestion.mutate({ code: created.code });
  if (opened.status === 'QUESTION_OPEN') {
    await hostTrpc.session.revealAnswers.mutate({ code: created.code });
  }

  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({
    code: created.code,
  });
  if (!question?.id) {
    throw new Error('Aktive Frage konnte nach Reconnect-Session-Setup nicht geladen werden.');
  }

  return {
    code: created.code,
    hostToken: created.hostToken,
    sessionId: created.sessionId,
    questionId: question.id,
    answerId: question.answers?.[0]?.id ?? null,
    openedStatus: opened.status,
  };
}
