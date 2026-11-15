#!/usr/bin/env node
// Eigenständiger Störungshelfer; niemals als Inferenz-Baseline verwenden.
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export function createFakeRuntime({
  token,
  mode = 'delay',
  delayMs = 0,
  completionStatus = 200,
  completionBody = '{"choices":[{"message":{"role":"assistant","content":"{}"},"finish_reason":"stop"}]}',
} = {}) {
  if (
    typeof token !== 'string' ||
    token.length < 32 ||
    /[\r\n]/.test(token) ||
    !['delay', 'busy', 'race'].includes(mode) ||
    !Number.isInteger(delayMs) ||
    delayMs < 0 ||
    delayMs > 900_000 ||
    !Number.isInteger(completionStatus) ||
    completionStatus < 200 ||
    completionStatus > 599 ||
    typeof completionBody !== 'string'
  )
    throw new Error('Ungültige Fake-Konfiguration.');
  const expected = Buffer.from(`Bearer ${token}`);
  const pending = new Map();
  const server = createServer((req, res) => {
    const header = Buffer.from(req.headers.authorization ?? '');
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(body);
    };
    // Keine Header oder Bodies protokollieren: auch synthetische Prompts bleiben lokal.
    if (header.length !== expected.length || !timingSafeEqual(header, expected)) {
      req.resume();
      send(401, '{"error":"unauthorized"}');
      return;
    }
    if (req.method === 'GET' && ['/slots', '/slots?fail_on_no_slot=1'].includes(req.url)) {
      req.resume();
      send(mode === 'busy' ? 503 : 200, mode === 'busy' ? '{"error":"busy"}' : '[]');
      return;
    }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      req.resume();
      send(404, '{"error":"not_found"}');
      return;
    }
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_048_576 && !res.writableEnded) send(413, '{"error":"body_too_large"}');
    });
    req.on('end', () => {
      if (res.writableEnded || res.destroyed) return;
      if (mode === 'busy' || mode === 'race') {
        send(503, '{"error":"busy"}');
        return;
      }
      const timer = setTimeout(() => {
        pending.delete(res);
        if (!res.destroyed) send(completionStatus, completionBody);
      }, delayMs);
      pending.set(res, timer);
      res.once('close', () => {
        clearTimeout(timer);
        pending.delete(res);
      });
    });
  });
  server.pendingResponses = () => pending.size;
  server.shutdown = async () => {
    for (const [res, timer] of pending) {
      clearTimeout(timer);
      res.destroy();
    }
    pending.clear();
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
  };
  return server;
}

async function main() {
  const { values } = parseArgs({
    options: {
      host: { type: 'string', default: '192.168.150.20' },
      port: { type: 'string', default: '8080' },
      mode: { type: 'string', default: 'delay' },
      'delay-ms': { type: 'string', default: '0' },
      status: { type: 'string', default: '200' },
      'body-file': { type: 'string' },
      'token-file': { type: 'string', default: '.env.llm' },
    },
  });
  if (!['127.0.0.1', '192.168.150.20'].includes(values.host))
    throw new Error('Fake darf nur auf Loopback oder der llm-host-Labor-IP lauschen.');
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Ungültiger Port.');
  const env = await readFile(values['token-file'], 'utf8');
  const token = env.match(/^OPEN_WEIGHT_LLM_TOKEN=([^\r\n]+)$/m)?.[1];
  const server = createFakeRuntime({
    token,
    mode: values.mode,
    delayMs: Number(values['delay-ms']),
    completionStatus: Number(values.status),
    ...(values['body-file'] ? { completionBody: await readFile(values['body-file'], 'utf8') } : {}),
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, values.host, resolve);
  });
  process.stdout.write(
    `Fake bereit: ${values.host}:${port}, Modus ${values.mode}; keine echte Inferenz.\n`,
  );
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void server.shutdown());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    process.stderr.write('Fake konnte nicht gestartet werden; Konfiguration und Bind prüfen.\n');
    process.exitCode = 1;
  });
