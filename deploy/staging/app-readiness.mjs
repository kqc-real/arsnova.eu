import { error as logError } from 'node:console';
import { get } from 'node:http';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import Redis from 'ioredis';
import pg from 'pg';

const host = process.argv[2] ?? '127.0.0.1';

async function checkHttp() {
  const response = await globalThis.fetch(`http://${host}:3000/trpc/health.check`, {
    signal: globalThis.AbortSignal.timeout(4_000),
  });
  const { result } = await response.json();
  if (!response.ok || result?.data?.status !== 'ok' || result.data.redis !== 'ok') {
    throw new Error('HTTP oder Redis nicht bereit');
  }
}

async function checkDatabase() {
  const database = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3_000,
    query_timeout: 3_000,
  });
  try {
    await database.connect();
    await database.query('SELECT 1');
  } finally {
    await database.end();
  }
}

async function checkWebSocket() {
  const socket = new globalThis.WebSocket(`ws://${host}:3001`);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('tRPC-WebSocket-Timeout')), 4_000);
      const failed = () => {
        clearTimeout(timeout);
        reject(new Error('tRPC-WebSocket nicht bereit'));
      };
      socket.addEventListener('open', () => {
        socket.send(
          JSON.stringify({ id: 1, method: 'subscription', params: { path: 'health.ping' } }),
        );
      });
      socket.addEventListener('message', ({ data }) => {
        const frame = JSON.parse(data);
        if (frame.id === 1 && frame.result?.type === 'data' && frame.result.data?.heartbeat) {
          clearTimeout(timeout);
          resolve();
        } else if (frame.id === 1 && frame.error) {
          failed();
        }
      });
      socket.addEventListener('error', failed);
      socket.addEventListener('close', failed);
    });
  } finally {
    socket.close();
  }
}

function checkSocketHealth(socketPath) {
  return new Promise((resolve, reject) => {
    const request = get({ socketPath, path: '/health' }, (response) => {
      response.resume();
      if (response.statusCode === 204) resolve();
      else reject(new Error('Socket-Dienst nicht bereit'));
    });
    request.setTimeout(3_000, () => request.destroy(new Error('Socket-Healthcheck-Timeout')));
    request.on('error', reject);
  });
}

async function checkSummaryRedis() {
  const redis = new Redis(process.env.QA_SUMMARY_STATE_REDIS_URL, {
    connectTimeout: 1_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: 0,
  });
  try {
    if ((await redis.ping()) !== 'PONG') throw new Error('Q&A-Summary-Redis nicht bereit');
  } finally {
    redis.disconnect();
  }
}

const checks = [
  ['HTTP/Redis', checkHttp()],
  ['PostgreSQL', checkDatabase()],
  ['tRPC-WebSocket', checkWebSocket()],
  ['PDF-Worker', checkSocketHealth('/run/pdf-worker/render.sock')],
  ['spaCy', checkSocketHealth('/run/spacy/nlp.sock')],
  ['Q&A-Summary-Redis', checkSummaryRedis()],
];
const results = await Promise.allSettled(checks.map(([, task]) => task));
const failed = checks.filter((_, index) => results[index].status === 'rejected');
if (failed.length > 0) {
  logError('Staging-Readiness fehlgeschlagen für ' + failed.map(([name]) => name).join(', '));
  process.exitCode = 1;
}
