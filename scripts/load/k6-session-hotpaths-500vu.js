/**
 * k6-Lasttest für 500er-Hotpaths.
 *
 * Modi:
 * - MODE=join-wave
 * - MODE=active-question
 * - MODE=vote-spike
 *
 * Beispiele (lokal):
 *   MODE=join-wave SESSION_CODE=AB12CD BASE_URL=http://127.0.0.1:3000 k6 run scripts/load/k6-session-hotpaths-500vu.js
 *   MODE=join-wave SESSION_CODE=AB12CD npm run load:k6:hotpaths
 *
 *   MODE=active-question SESSION_CODE=AB12CD PARTICIPANT_IDS="id1,id2,..." QUESTION_ID=<uuid> \
 *     BASE_URL=http://127.0.0.1:3000 k6 run scripts/load/k6-session-hotpaths-500vu.js
 *
 *   MODE=vote-spike SESSION_ID=<uuid> SESSION_CODE=AB12CD PARTICIPANT_IDS="id1,id2,..." QUESTION_ID=<uuid> ANSWER_ID=<uuid> \
 *     BASE_URL=http://127.0.0.1:3000 k6 run scripts/load/k6-session-hotpaths-500vu.js
 *
 * Docker (Linux/WSL2): BASE_URL=http://127.0.0.1:3000, Flag --network host
 * Docker (macOS): BASE_URL=http://host.docker.internal:3000, ohne --network host
 *
 *   docker run --rm -i -e BASE_URL=http://host.docker.internal:3000 -e MODE=join-wave \
 *     -e SESSION_CODE=AB12CD -e VUS=500 grafana/k6 run - <scripts/load/k6-session-hotpaths-500vu.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const base = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const mode = (__ENV.MODE || 'join-wave').trim();
const sessionCode = String(__ENV.SESSION_CODE || '')
  .trim()
  .toUpperCase();
const participantIds = String(__ENV.PARTICIPANT_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const questionId = String(__ENV.QUESTION_ID || '').trim();
const sessionId = String(__ENV.SESSION_ID || '').trim();
const answerId = String(__ENV.ANSWER_ID || '').trim();
const vus = Math.max(1, Number(__ENV.VUS || 500));
const durationSeconds = Math.max(5, Number(__ENV.DURATION_SECONDS || 30));
const errorRateLimit = Number(__ENV.ERROR_RATE_LIMIT || 0.005);
const p95LimitMs = Number(__ENV.P95_LIMIT_MS || 1000);
const p99LimitMs = Number(__ENV.P99_LIMIT_MS || 2000);
const checkRateLimit = Number(__ENV.CHECK_RATE_LIMIT || 0.995);

if (!sessionCode || sessionCode.length !== 6) {
  throw new Error('SESSION_CODE (6 Zeichen) ist erforderlich.');
}

if (mode === 'active-question' && (!questionId || participantIds.length === 0)) {
  throw new Error('Für MODE=active-question sind QUESTION_ID und PARTICIPANT_IDS erforderlich.');
}

if (
  mode === 'vote-spike' &&
  (!sessionId || !questionId || !answerId || participantIds.length === 0)
) {
  throw new Error(
    'Für MODE=vote-spike sind SESSION_ID, QUESTION_ID, ANSWER_ID und PARTICIPANT_IDS erforderlich.',
  );
}

export const options = {
  scenarios: {
    hotpath: {
      executor: 'per-vu-iterations',
      vus,
      iterations: 1,
      maxDuration: '10m',
    },
  },
  thresholds: {
    checks: [`rate>${checkRateLimit}`],
    http_req_failed: [`rate<${errorRateLimit}`],
    http_req_duration: [`p(95)<${p95LimitMs}`, `p(99)<${p99LimitMs}`],
  },
};

function participantIdForVu() {
  if (participantIds.length === 0) {
    return '';
  }
  return participantIds[(__VU - 1) % participantIds.length] || '';
}

function joinWave() {
  const joinUrl = `${base}/trpc/session.join`;
  const pollInput = encodeURIComponent(
    JSON.stringify({
      0: { code: sessionCode },
      1: { code: sessionCode },
    }),
  );
  const pollUrl = `${base}/trpc/session.getInfo,session.getParticipantNicknames?batch=1&input=${pollInput}`;

  const nick = `k6-${__VU}-${__ITER}-${Date.now()}`.slice(0, 30);
  const joinRes = http.post(joinUrl, JSON.stringify({ code: sessionCode, nickname: nick }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(joinRes, { 'join 200': (response) => response.status === 200 });

  const end = Date.now() + durationSeconds * 1000;
  while (Date.now() < end) {
    const pollRes = http.get(pollUrl);
    check(pollRes, { 'join-wave poll 200': (response) => response.status === 200 });
    sleep(0.2 + Math.random() * 0.4);
  }
}

function activeQuestion() {
  const participantId = participantIdForVu();
  const end = Date.now() + durationSeconds * 1000;
  while (Date.now() < end) {
    const questionInput = encodeURIComponent(
      JSON.stringify({
        0: { code: sessionCode, participantId },
      }),
    );
    const questionUrl = `${base}/trpc/session.getCurrentQuestionForStudent?batch=1&input=${questionInput}`;
    const questionRes = http.get(questionUrl);
    check(questionRes, { 'active-question 200': (response) => response.status === 200 });

    if ((__ITER + __VU + Math.floor(Date.now() / 1000)) % 3 === 0) {
      const infoInput = encodeURIComponent(
        JSON.stringify({
          0: { code: sessionCode },
        }),
      );
      const infoUrl = `${base}/trpc/session.getInfo?batch=1&input=${infoInput}`;
      const infoRes = http.get(infoUrl);
      check(infoRes, { 'active-question info 200': (response) => response.status === 200 });
    }
    sleep(1.6 + Math.random() * 0.8);
  }
}

function voteSpike() {
  const participantId = participantIdForVu();
  const voteUrl = `${base}/trpc/vote.submit`;
  const responseTimeMs = 400 + (__VU % 15) * 40;
  const voteRes = http.post(
    voteUrl,
    JSON.stringify({
      sessionId,
      participantId,
      questionId,
      answerIds: [answerId],
      responseTimeMs,
      round: 1,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
  check(voteRes, { 'vote-spike 200': (response) => response.status === 200 });
  sleep(0.01);
}

export default function () {
  if (mode === 'join-wave') {
    joinWave();
    return;
  }
  if (mode === 'active-question') {
    activeQuestion();
    return;
  }
  if (mode === 'vote-spike') {
    voteSpike();
    return;
  }
  throw new Error(`Unbekannter MODE=${mode}`);
}
