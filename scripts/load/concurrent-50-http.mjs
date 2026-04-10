#!/usr/bin/env node
/**
 * Einfacher Lasttest ohne k6: 50 parallele „Nutzer“ (async Loops), die wiederholt
 * `health.stats` per tRPC-Batch-GET abfragen (read-only, lokal unkritisch).
 *
 * Voraussetzung: Backend läuft (z. B. PORT=3000).
 *
 *   BASE_URL=http://127.0.0.1:3000 node scripts/load/concurrent-50-http.mjs
 *   VUS=50 DURATION_MS=30000 node scripts/load/concurrent-50-http.mjs
 */
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const VUS = Math.max(1, Number(process.env.VUS ?? 50));
const DURATION_MS = Math.max(1000, Number(process.env.DURATION_MS ?? 30_000));

const INPUT = encodeURIComponent(JSON.stringify({ 0: { json: null } }));
const URL = `${BASE_URL.replace(/\/$/, '')}/trpc/health.stats?batch=1&input=${INPUT}`;

/** @type {number[]} */
const latencies = [];
let errors = 0;
const t0 = Date.now();

async function virtualUser(id) {
  const endAt = t0 + DURATION_MS;
  while (Date.now() < endAt) {
    const tReq = performance.now();
    try {
      const res = await fetch(URL, { method: 'GET' });
      const dt = performance.now() - tReq;
      latencies.push(dt);
      if (!res.ok) {
        errors++;
        console.error(`[vu ${id}] HTTP ${res.status}`);
      }
    } catch (e) {
      errors++;
      console.error(`[vu ${id}]`, e);
    }
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 350));
  }
}

console.log(
  `Load (Node): ${VUS} parallele Nutzer, ${DURATION_MS} ms, GET health.stats\n→ ${URL.slice(0, 80)}…\n`,
);

await Promise.all(Array.from({ length: VUS }, (_, i) => virtualUser(i)));

latencies.sort((a, b) => a - b);
const n = latencies.length;
const pct = (p) => (n === 0 ? 0 : latencies[Math.min(n - 1, Math.floor((p / 100) * n))]);
const sum = latencies.reduce((a, b) => a + b, 0);

console.log('\n— Ergebnis —');
console.log({
  requests: n,
  errors,
  durationMs: Date.now() - t0,
  rps: n / ((Date.now() - t0) / 1000),
  latencyMs_avg: n ? sum / n : 0,
  latencyMs_p50: pct(50),
  latencyMs_p95: pct(95),
  latencyMs_max: n ? latencies[n - 1] : 0,
});
