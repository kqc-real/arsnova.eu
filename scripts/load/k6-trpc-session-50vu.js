/**
 * k6: 50 VUs — einmal Join pro VU, dann Lobby-Polling (GET-Batch wie session-participants-50.mjs).
 *
 *   SESSION_CODE=AB12CD BASE_URL=http://127.0.0.1:3000 k6 run scripts/load/k6-trpc-session-50vu.js
 *   docker run --rm -i --network host -e SESSION_CODE=AB12CD -e BASE_URL=http://127.0.0.1:3000 \
 *     grafana/k6 run - <scripts/load/k6-trpc-session-50vu.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const code = __ENV.SESSION_CODE;
if (!code || String(code).trim().length !== 6) {
  throw new Error('SESSION_CODE (6 Zeichen) setzen, z. B. SESSION_CODE=AB12CD');
}

const C = String(code).trim().toUpperCase();
const batchInput = encodeURIComponent(
  JSON.stringify({
    0: { code: C },
    1: { code: C },
  }),
);

/** Pro VU genau eine Iteration: ein Join, dann ~25 s Lobby-Polling (wie das Node-Skript). */
export const options = {
  scenarios: {
    session_lobby: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '5m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const base = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const joinUrl = `${base}/trpc/session.join`;
  const pollUrl = `${base}/trpc/session.getInfo,session.getParticipantNicknames?batch=1&input=${batchInput}`;

  const nick = `k6-${__VU}-${__ITER}-${Date.now()}`.slice(0, 30);
  const joinRes = http.post(joinUrl, JSON.stringify({ code: C, nickname: nick }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(joinRes, {
    'join 200': (r) => r.status === 200,
  });

  const end = Date.now() + 25000;
  while (Date.now() < end) {
    const res = http.get(pollUrl);
    check(res, {
      'poll 200': (r) => r.status === 200,
    });
    sleep(0.1 + Math.random() * 0.25);
  }
}
