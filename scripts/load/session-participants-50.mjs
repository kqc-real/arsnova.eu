#!/usr/bin/env node
/**
 * Lasttest: 50 „Teilnehmer“ gegen eine **echte** Session (Lobby-Flow).
 *
 * Pro virtuellem Nutzer (VU):
 * 1. POST `session.join` (einmal, eindeutiger Nickname)
 * 2. Schleife bis DURATION_MS: GET-Batch `session.getInfo` + `session.getParticipantNicknames`
 *    (öffentliche Reads wie bei Kollisions-/Lobby-Checks)
 *
 * Voraussetzungen:
 * - Backend läuft (HTTP + DB), Session existiert und ist **nicht** FINISHED.
 * - `SESSION_CODE` = 6 Zeichen (wie im UI), z. B. aus einer vom Host geöffneten Lobby.
 *
 * Hinweise:
 * - Join legt echte `Participant`-Zeilen an — für Wiederholungen neue Session nutzen oder DB bereinigen.
 * - tRPC-Subscriptions (WebSocket, z. B. `session.onStatusChanged`) sind hier nicht enthalten;
 *   dafür separat k6+WebSocket oder Client-Tooling (siehe Kommentar am Dateiende).
 *
 *   SESSION_CODE=AB12CD BASE_URL=http://127.0.0.1:3000 node scripts/load/session-participants-50.mjs
 *   VUS=50 DURATION_MS=20000 SESSION_CODE=AB12CD node scripts/load/session-participants-50.mjs
 */
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const WS_PORT = process.env.WS_PORT ?? '3001';
const VUS = Math.max(1, Number(process.env.VUS ?? 50));
const DURATION_MS = Math.max(1000, Number(process.env.DURATION_MS ?? 30_000));
const SESSION_CODE_RAW = process.env.SESSION_CODE ?? '';

const base = BASE_URL.replace(/\/$/, '');
const SESSION_CODE = String(SESSION_CODE_RAW).trim().toUpperCase();

if (!/^[A-Z0-9]{6}$/.test(SESSION_CODE)) {
  console.error(
    'Bitte SESSION_CODE setzen (genau 6 Zeichen, alphanumerisch), z. B. SESSION_CODE=AB12CD',
  );
  process.exit(1);
}

const BATCH_LOBBY_PATH = 'session.getInfo,session.getParticipantNicknames';

function batchLobbyUrl() {
  const input = encodeURIComponent(
    JSON.stringify({
      0: { code: SESSION_CODE },
      1: { code: SESSION_CODE },
    }),
  );
  return `${base}/trpc/${BATCH_LOBBY_PATH}?batch=1&input=${input}`;
}

const LOBBY_GET_URL = batchLobbyUrl();
const JOIN_URL = `${base}/trpc/session.join`;

/** @type {number[]} */
const latencies = [];
let joinErrors = 0;
let pollErrors = 0;
let pollRequests = 0;

const t0 = Date.now();

function pushLatency(ms) {
  latencies.push(ms);
}

function randomNick(vuId) {
  const s = `${t0}-${vuId}-${Math.random().toString(36).slice(2, 9)}`;
  return `ld${s}`.slice(0, 30);
}

async function virtualUser(id) {
  const nickname = randomNick(id);
  const tJoin = performance.now();
  try {
    const res = await fetch(JOIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: SESSION_CODE, nickname }),
    });
    const dt = performance.now() - tJoin;
    pushLatency(dt);
    if (!res.ok) {
      joinErrors++;
      const text = await res.text().catch(() => '');
      console.error(`[vu ${id}] join HTTP ${res.status}`, text.slice(0, 200));
      return;
    }
  } catch (e) {
    joinErrors++;
    console.error(`[vu ${id}] join`, e);
    return;
  }

  const endAt = t0 + DURATION_MS;
  while (Date.now() < endAt) {
    const tReq = performance.now();
    pollRequests++;
    try {
      const res = await fetch(LOBBY_GET_URL, { method: 'GET' });
      const dt = performance.now() - tReq;
      pushLatency(dt);
      if (!res.ok) {
        pollErrors++;
        console.error(`[vu ${id}] poll HTTP ${res.status}`);
      }
    } catch (e) {
      pollErrors++;
      console.error(`[vu ${id}] poll`, e);
    }
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 220));
  }
}

console.log(
  `Session-Last (Node): ${VUS} VUs, ${DURATION_MS} ms\n` +
    `  Session: ${SESSION_CODE}\n` +
    `  POST ${JOIN_URL}\n` +
    `  GET  ${LOBBY_GET_URL.slice(0, 96)}…\n` +
    `  (tRPC-WS für Subscriptions: ws://127.0.0.1:${WS_PORT} — nicht Teil dieses Skripts)\n`,
);

await Promise.all(Array.from({ length: VUS }, (_, i) => virtualUser(i)));

latencies.sort((a, b) => a - b);
const n = latencies.length;
const pct = (p) => (n === 0 ? 0 : latencies[Math.min(n - 1, Math.floor((p / 100) * n))]);
const sum = latencies.reduce((a, b) => a + b, 0);

console.log('\n— Ergebnis —');
console.log({
  sessionCode: SESSION_CODE,
  joinAttempts: VUS,
  joinErrors,
  pollRequests,
  pollErrors,
  totalSamples: n,
  durationMs: Date.now() - t0,
  rps: n / ((Date.now() - t0) / 1000),
  latencyMs_avg: n ? sum / n : 0,
  latencyMs_p50: pct(50),
  latencyMs_p95: pct(95),
  latencyMs_max: n ? latencies[n - 1] : 0,
});
