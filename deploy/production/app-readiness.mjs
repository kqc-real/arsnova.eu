import pg from 'pg';

async function checkHttp() {
  const response = await fetch('http://127.0.0.1:3000/trpc/health.check', {
    signal: AbortSignal.timeout(3_000),
  });
  const { result } = await response.json();
  if (!response.ok || result?.data?.status !== 'ok' || result.data.redis !== 'ok') {
    throw new Error('HTTP oder Redis nicht bereit');
  }
}

async function checkDatabase() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3_000,
    query_timeout: 3_000,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    await client.end();
  }
}

async function checkWebSocket() {
  const socket = new WebSocket('ws://127.0.0.1:3001');
  try {
    await new Promise((resolve, reject) => {
      const timeout = AbortSignal.timeout(3_000);
      const fail = () => reject(new Error('tRPC-WebSocket nicht bereit'));
      timeout.addEventListener('abort', fail, { once: true });
      socket.addEventListener('error', fail, { once: true });
      socket.addEventListener('close', fail, { once: true });
      socket.addEventListener('open', () => {
        socket.send(
          JSON.stringify({ id: 1, method: 'subscription', params: { path: 'health.ping' } }),
        );
      });
      socket.addEventListener('message', ({ data }) => {
        const frame = JSON.parse(data);
        if (frame.id === 1 && frame.result?.type === 'data' && frame.result.data?.heartbeat) {
          resolve();
        } else if (frame.id === 1 && frame.error) {
          fail();
        }
      });
    });
  } finally {
    socket.close();
  }
}

try {
  await Promise.all([checkHttp(), checkDatabase(), checkWebSocket()]);
} catch (error) {
  console.error('App-Readiness fehlgeschlagen', error.message);
  process.exitCode = 1;
}
