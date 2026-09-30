/**
 * k6-Lasttest für öffentliche Betriebsüberwachung (#483 Zusatzauftrag).
 *
 * 500 VUs: je ein Join (Hörsaal-Welle) + paralleles health.stats-Polling.
 * Statuspolling darf den Kernaktions-RPS nicht verzerren (Allowlist ohne health.*).
 *
 * Beispiel:
 *   SESSION_CODE=BN483Q VUS=500 npm run load:k6:ops-monitoring
 *
 * Für Q&A-/Vote-Spikes zusätzlich `npm run load:k6:hotpaths` (MODE=vote-spike).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomBytes } from 'k6/crypto';

const base = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const sessionCode = String(__ENV.SESSION_CODE || '')
  .trim()
  .toUpperCase();
const vus = Math.max(1, Number(__ENV.VUS || 500));
const pollDurationSeconds = Math.max(10, Number(__ENV.DURATION_SECONDS || 30));
const pollEveryVu = Math.max(1, Number(__ENV.STATUS_POLL_EVERY_VU || 10));
const errorRateLimit = Number(__ENV.ERROR_RATE_LIMIT || 0.005);
const p95LimitMs = Number(__ENV.P95_LIMIT_MS || 1000);
const p99LimitMs = Number(__ENV.P99_LIMIT_MS || 2000);

if (!sessionCode || sessionCode.length !== 6) {
  throw new Error('SESSION_CODE (6 Zeichen) ist erforderlich.');
}

export const options = {
  scenarios: {
    joinWave: {
      executor: 'per-vu-iterations',
      vus,
      iterations: 1,
      maxDuration: '10m',
      exec: 'joinWave',
    },
    statusPoll: {
      executor: 'constant-vus',
      vus: Math.max(1, Math.floor(vus / pollEveryVu)),
      duration: `${pollDurationSeconds}s`,
      exec: 'statusPoll',
      startTime: '0s',
    },
  },
  thresholds: {
    http_req_failed: [`rate<${errorRateLimit}`],
    http_req_duration: [`p(95)<${p95LimitMs}`, `p(99)<${p99LimitMs}`],
    'http_req_duration{name:join}': [`p(95)<${p95LimitMs}`],
    'http_req_duration{name:health_stats}': [`p(95)<1500`],
  },
};

function hexBytes(n) {
  return Array.from(new Uint8Array(randomBytes(n)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function uuidV4() {
  const bytes = new Uint8Array(randomBytes(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function joinWave() {
  const nick = `k6-${__VU}-${hexBytes(3)}`.slice(0, 30);
  const joinRes = http.post(
    `${base}/trpc/session.join`,
    JSON.stringify({
      code: sessionCode,
      nickname: nick,
      anonymousClientId: uuidV4(),
      joinIdempotencyKey: hexBytes(32),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'join' },
    },
  );
  check(joinRes, { 'join 200': (response) => response.status === 200 });
  sleep(0.05);
}

export function statusPoll() {
  const input = encodeURIComponent(JSON.stringify({ 0: { json: null } }));
  const end = Date.now() + pollDurationSeconds * 1000;
  while (Date.now() < end) {
    const res = http.get(`${base}/trpc/health.stats?batch=1&input=${input}`, {
      tags: { name: 'health_stats' },
    });
    check(res, {
      'health.stats 200': (response) => response.status === 200,
      'health.stats has trafficQuality': (response) =>
        Boolean(response.body && response.body.includes('trafficQuality')),
    });
    sleep(0.8 + Math.random() * 0.6);
  }
}
