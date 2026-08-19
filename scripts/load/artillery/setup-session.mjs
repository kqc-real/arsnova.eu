import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createHttpTrpc } from '../lib/trpc-runtime.mjs';

const execFileAsync = promisify(execFile);
const ARTILLERY_DIR = dirname(fileURLToPath(import.meta.url));

async function mintHostToken(sessionCode) {
  const configured = String(process.env.HOST_TOKEN || '').trim();
  if (configured) {
    return configured;
  }
  const backendDir = join(ARTILLERY_DIR, '../../../apps/backend');
  const script = `
    import { createHostSessionToken } from './src/lib/hostAuth.ts';
    createHostSessionToken(${JSON.stringify(sessionCode)})
      .then((token) => {
        console.log(token);
        process.exit(0);
      })
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  `;
  const { stdout } = await execFileAsync('npx', ['tsx', '-e', script], {
    cwd: backendDir,
    encoding: 'utf8',
  });
  const token = stdout.trim();
  if (!token) {
    throw new Error(`Host-Token für Session ${sessionCode} konnte nicht erzeugt werden.`);
  }
  return token;
}

/**
 * Bindet Artillery an eine bereits laufende Live-Session (Join, Q&A, Blitzlicht, WS).
 */
export async function attachArtillery500Session(trpcUrl, rawCode) {
  const code = String(rawCode || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    throw new Error('SESSION_CODE muss genau 6 alphanumerische Zeichen haben.');
  }
  const publicTrpc = createHttpTrpc(trpcUrl);
  const info = await publicTrpc.session.getInfo.query({ code });
  if (!info?.id) {
    throw new Error(`Session ${code} nicht gefunden.`);
  }
  const hostToken = await mintHostToken(code);
  if (!String(process.env.HOST_TOKEN || '').trim()) {
    console.warn(
      `Host-Token für Session ${code} neu ausgestellt. Das bisherige Host-Token ist ungültig; HOST_TOKEN setzen, um das zu vermeiden.`,
    );
  }
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id) {
    throw new Error(`Session ${code} hat keine aktuelle Frage für Artillery.`);
  }
  return {
    quizId: info.id,
    code: info.code,
    hostToken,
    sessionId: info.id,
    questionId: question.id,
    answerId: question.answers?.[0]?.id ?? null,
    openedStatus: info.status,
    attachedExisting: true,
  };
}

export const ARTILLERY_QUIZ_PAYLOAD = {
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
  const { quizId } = await publicTrpc.quiz.upload.mutate(ARTILLERY_QUIZ_PAYLOAD);
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
    quizId,
    code: created.code,
    hostToken: created.hostToken,
    sessionId: created.sessionId,
    questionId: question.id,
    answerId: question.answers[0].id,
    openedStatus: opened.status,
  };
}

const RECONNECT_QUIZ_PAYLOAD = {
  ...ARTILLERY_QUIZ_PAYLOAD,
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
    quizId,
    code: created.code,
    hostToken: created.hostToken,
    sessionId: created.sessionId,
    questionId: question.id,
    answerId: question.answers?.[0]?.id ?? null,
    openedStatus: opened.status,
  };
}
