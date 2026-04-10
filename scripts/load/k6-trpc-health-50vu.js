/**
 * k6: 50 virtuelle Nutzer, 30 s, wiederholter tRPC-GET `health.stats`.
 *
 * Installation: https://k6.io/docs/get-started/installation/
 * Oder: docker run --rm -i --network host grafana/k6 run - <scripts/load/k6-trpc-health-50vu.js
 *
 *   BASE_URL=http://127.0.0.1:3000 k6 run scripts/load/k6-trpc-health-50vu.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const INPUT = encodeURIComponent(JSON.stringify({ 0: { json: null } }));

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const base = __ENV.BASE_URL || 'http://127.0.0.1:3000';
  const url = `${base.replace(/\/$/, '')}/trpc/health.stats?batch=1&input=${INPUT}`;
  const res = http.get(url);
  check(res, {
    'status 200': (r) => r.status === 200,
    'json body': (r) => r.body && r.body.includes('activeSessions'),
  });
  sleep(0.2 + Math.random() * 0.35);
}
