#!/usr/bin/env node
/* global process */
/**
 * E3b C3: minimaler llama.cpp-Stub auf 127.0.0.1, der die Slot-Probe beantwortet,
 * die eigentliche Inferenz aber nie beantwortet (simuliert hängenden CPU-Prefill).
 *
 * Endpunkte (vgl. apps/backend/src/lib/openWeightLlmClient.ts):
 *   GET  /slots?fail_on_no_slot=1  -> 200 (ein freier Slot)
 *   GET  /health                   -> 200
 *   POST /v1/chat/completions      -> keine Antwort (Socket bleibt offen bis Client abbricht)
 *   POST /completion               -> keine Antwort
 * Usage: node e3b-hanging-llm-stub.mjs <port> <requestLogJsonl>
 */
import http from 'node:http';
import fs from 'node:fs';

const PORT = Number(process.argv[2] ?? 59998);
const LOG = process.argv[3] ?? '/dev/stdout';
const log = (entry) =>
  fs.appendFileSync(LOG, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);

const server = http.createServer((req, res) => {
  const started = Date.now();
  let bytes = 0;
  req.on('data', (chunk) => (bytes += chunk.length));
  const auth = req.headers.authorization ? 'bearer-present' : 'none';
  if (req.method === 'GET' && req.url.startsWith('/slots')) {
    log({ method: req.method, url: req.url, auth, action: 'answer-200' });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify([{ id: 0, is_processing: false }]));
    return;
  }
  if (req.method === 'GET' && req.url.startsWith('/health')) {
    log({ method: req.method, url: req.url, auth, action: 'answer-200' });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"status":"ok"}');
    return;
  }
  log({ method: req.method, url: req.url, auth, action: 'hang' });
  res.on('close', () => {
    log({
      method: req.method,
      url: req.url,
      action: 'client-closed',
      bodyBytes: bytes,
      heldMs: Date.now() - started,
    });
  });
  // bewusst keine Antwort
});
server.keepAliveTimeout = 0;
server.requestTimeout = 0;
server.headersTimeout = 0;
server.listen(PORT, '127.0.0.1', () => log({ event: 'listening', port: PORT }));
for (const sig of ['SIGINT', 'SIGTERM'])
  process.on(sig, () => {
    log({ event: 'stop' });
    process.exit(0);
  });
