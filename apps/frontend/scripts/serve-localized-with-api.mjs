#!/usr/bin/env node
/**
 * Serviert den lokalisierten Build (dist/browser), leitet /trpc (HTTP) und /trpc-ws (WebSocket) ans Backend weiter.
 * Backend muss separat laufen (z. B. npm run dev -w @arsnova/backend).
 * Aufruf: node scripts/serve-localized-with-api.mjs
 * Dann: http://localhost:4200/ → /de/, /de/ und /en/ mit funktionierender API inkl. Subscriptions.
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distBrowser = path.resolve(__dirname, '../dist/browser');
const PORT = 4200;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const WS_PORT = process.env.WS_PORT || '3001';
const YJS_WS_PORT = process.env.YJS_WS_PORT || '3002';
const BACKEND_WS_URL = `ws://localhost:${WS_PORT}`;
const BACKEND_YJS_WS_URL = `ws://localhost:${YJS_WS_PORT}`;

const app = express();

app.use('/trpc', express.raw({ type: '*/*' }), async (req, res) => {
  const pathAndQuery = req.url?.startsWith('/') ? req.url : `/${req.url ?? ''}`;
  const target = `${BACKEND_URL}/trpc${pathAndQuery}`;
  try {
    const opts = {
      method: req.method,
      headers: { ...req.headers, host: new URL(BACKEND_URL).host },
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body?.length) opts.body = req.body;
    const backendRes = await fetch(target, opts);
    const headers = Object.fromEntries(backendRes.headers.entries());
    delete headers['content-encoding'];
    delete headers['transfer-encoding'];
    res.status(backendRes.status).set(headers);
    const body = await backendRes.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (err) {
    console.error('Backend nicht erreichbar:', err.message);
    res.status(502).send('Backend nicht erreichbar. Bitte Backend starten (z. B. npm run dev -w @arsnova/backend).');
  }
});

// /assets/* aus de/ (lokalisiert: Icons/Manifest unter /de/ nutzen /assets/ absolut)
app.use('/assets', express.static(path.join(distBrowser, 'de', 'assets')));
// Locale-prefixed assets (Legal-Seiten laden z. B. /en/assets/legal/imprint.de.md).
// fallthrough: false → fehlende Dateien liefern 404 (nicht SPA-index.html), damit Fallback auf .de.md funktioniert
app.use('/de/assets', express.static(path.join(distBrowser, 'de', 'assets'), { fallthrough: false }));
app.use('/en/assets', express.static(path.join(distBrowser, 'en', 'assets'), { fallthrough: false }));
app.use(express.static(distBrowser));

app.get('/de', (_, res) => res.sendFile(path.join(distBrowser, 'de', 'index.html')));
app.get('/de/', (_, res) => res.sendFile(path.join(distBrowser, 'de', 'index.html')));
app.get(/^\/de\/.+/, (_, res) => res.sendFile(path.join(distBrowser, 'de', 'index.html')));
app.get('/en', (_, res) => res.sendFile(path.join(distBrowser, 'en', 'index.html')));
app.get('/en/', (_, res) => res.sendFile(path.join(distBrowser, 'en', 'index.html')));
app.get(/^\/en\/.+/, (_, res) => res.sendFile(path.join(distBrowser, 'en', 'index.html')));

app.get('/', (_, res) => res.sendFile(path.join(distBrowser, 'index.html')));

const server = createServer(app);

const trpcWss = new WebSocketServer({ noServer: true });
trpcWss.on('connection', (clientWs, req) => {
  if (!req.url?.startsWith('/trpc-ws')) {
    clientWs.close();
    return;
  }
  const backendWs = new WebSocket(BACKEND_WS_URL);
  backendWs.on('open', () => {
    clientWs.on('message', (data) => backendWs.send(data));
    clientWs.on('close', () => backendWs.close());
    // tRPC expects JSON text frames; ensure we never forward binary to the client
    backendWs.on('message', (data) => {
      const text = typeof data === 'string' ? data : (Buffer.isBuffer(data) ? data.toString('utf8') : String(data));
      clientWs.send(text);
    });
    backendWs.on('close', () => clientWs.close());
  });
  backendWs.on('error', (err) => {
    console.error('WebSocket tRPC Backend:', err.message);
    clientWs.close();
  });
  clientWs.on('error', () => backendWs.close());
});

const yjsWss = new WebSocketServer({ noServer: true });
let yjsBackendErrorLogged = false;
yjsWss.on('connection', (clientWs, req) => {
  const path = req.url?.startsWith('/yjs-ws') ? req.url.slice('/yjs-ws'.length) || '/' : '/';
  const backendUrl = `${BACKEND_YJS_WS_URL}${path}`;
  const backendWs = new WebSocket(backendUrl);
  backendWs.on('open', () => {
    clientWs.on('message', (data) => backendWs.send(data));
    clientWs.on('close', () => backendWs.close());
    backendWs.on('message', (data) => clientWs.send(data));
    backendWs.on('close', () => clientWs.close());
  });
  backendWs.on('error', (err) => {
    if (!yjsBackendErrorLogged) {
      yjsBackendErrorLogged = true;
      const msg = err?.code || err?.message || String(err);
      console.error('WebSocket Yjs Backend:', msg, '(Yjs-Server auf Port', YJS_WS_PORT + ' starten)');
    }
    clientWs.close();
  });
  clientWs.on('error', () => backendWs.close());
});

server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/trpc-ws')) {
    trpcWss.handleUpgrade(req, socket, head, (ws) => trpcWss.emit('connection', ws, req));
  } else if (req.url?.startsWith('/yjs-ws')) {
    yjsWss.handleUpgrade(req, socket, head, (ws) => yjsWss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`Lokalisierter Build: http://localhost:${PORT}/ (→ /de/)`);
  console.log(`  /trpc → ${BACKEND_URL}`);
  console.log(`  /trpc-ws → ws://localhost:${WS_PORT}`);
  console.log(`  /yjs-ws → ws://localhost:${YJS_WS_PORT}`);
  console.log('Backend muss laufen (z. B. npm run dev -w @arsnova/backend).');
});
