#!/usr/bin/env node
/**
 * Abnahme des tokenbasierten Yjs-Upgrade-Pfads unter 500 gleichzeitigen
 * Verbindungen. Sendet bewusst keine Yjs-Updates: Gemessen werden Relay-Upgrade,
 * Redis-Tokenprüfung und vollständiger Reconnect-Fan-out.
 */
import process from 'node:process';
import WebSocket from 'ws';

const clients = positiveInteger('CLIENTS', 500);
const timeoutMs = positiveInteger('CONNECT_TIMEOUT_MS', 15_000);
const p95LimitMs = positiveInteger('CONNECT_P95_LIMIT_MS', 5_000);
const baseUrl = String(process.env.YJS_WS_URL || 'ws://127.0.0.1:3002')
  .trim()
  .replace(/\/+$/, '');
const token = String(process.env.YJS_SHARE_TOKEN || '').trim();
const tokenMatch =
  /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.[1-9][0-9]{0,9}\.[A-Za-z0-9_-]{43}$/i.exec(
    token,
  );

if (!tokenMatch) {
  console.error('YJS_SHARE_TOKEN mit gültigem v1-Format ist erforderlich.');
  process.exit(2);
}

const room = `quiz-library-room-${tokenMatch[1]}`;
const target = `${baseUrl}/${room}?s=${encodeURIComponent(token)}`;

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    console.error(`${name} muss eine positive ganze Zahl sein.`);
    process.exit(2);
  }
  return value;
}

function percentile(values, percentage) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentage / 100) * sorted.length) - 1),
  );
  return Math.round(sorted[index] ?? 0);
}

async function connectWave(label) {
  const waveStartedAt = performance.now();
  const connections = await Promise.all(
    Array.from({ length: clients }, (_, index) => {
      const startedAt = performance.now();
      return new Promise((resolve, reject) => {
        const socket = new WebSocket(target);
        const timeout = setTimeout(() => {
          socket.terminate();
          reject(new Error(`${label}: Client ${index + 1} Timeout nach ${timeoutMs} ms`));
        }, timeoutMs);
        socket.once('open', () => {
          clearTimeout(timeout);
          resolve({ socket, latencyMs: performance.now() - startedAt });
        });
        socket.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }),
  );
  const latencies = connections.map(({ latencyMs }) => latencyMs);
  return {
    sockets: connections.map(({ socket }) => socket),
    metrics: {
      samples: latencies.length,
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      maxMs: Math.round(Math.max(...latencies)),
      waveMs: Math.round(performance.now() - waveStartedAt),
    },
  };
}

async function closeWave(sockets) {
  await Promise.all(
    sockets.map(
      (socket) =>
        new Promise((resolve) => {
          const timeout = setTimeout(() => {
            socket.terminate();
            resolve();
          }, 2_000);
          socket.once('close', () => {
            clearTimeout(timeout);
            resolve();
          });
          socket.close(1000);
        }),
    ),
  );
}

let initial;
let reconnect;
try {
  console.log(`Verbinde ${clients} tokenautorisierte Clients …`);
  initial = await connectWave('Initial');
  await closeWave(initial.sockets);
  console.log(`Reconnecte ${clients} tokenautorisierte Clients …`);
  reconnect = await connectWave('Reconnect');
  await closeWave(reconnect.sockets);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const result = {
  clients,
  tokenAuth: true,
  initial: initial.metrics,
  reconnect: reconnect.metrics,
  thresholds: { connectP95LimitMs: p95LimitMs },
};
console.log(JSON.stringify(result, null, 2));

if (initial.metrics.p95Ms > p95LimitMs || reconnect.metrics.p95Ms > p95LimitMs) {
  console.error(`Connect-p95 überschreitet ${p95LimitMs} ms.`);
  process.exit(1);
}
