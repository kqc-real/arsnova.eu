#!/usr/bin/env node
/**
 * Serviert den lokalisierten Build (dist/browser), leitet /trpc (HTTP) und /trpc-ws (WebSocket) ans Backend weiter.
 * Backend muss separat laufen (z. B. npm run dev -w @arsnova/backend).
 * Aufruf: node scripts/serve-localized-with-api.mjs
 * Dann: http://localhost:4200/ → /de/, /en/, /fr/, /it/, /es/ mit funktionierender API inkl. Subscriptions.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distBrowser = path.resolve(__dirname, '../dist/browser');
const PORT = Number.parseInt(process.env.PORT || '4200', 10);
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const WS_PORT = process.env.WS_PORT || '3001';
const YJS_WS_PORT = process.env.YJS_WS_PORT || '3002';
const BACKEND_WS_URL = `ws://localhost:${WS_PORT}`;
const BACKEND_YJS_WS_URL = `ws://localhost:${YJS_WS_PORT}`;
const SUPPORTED_LOCALES = ['de', 'en', 'fr', 'it', 'es'];
const rootIndexFile = path.join(distBrowser, 'index.html');
const rootIndexHtml = fs.readFileSync(rootIndexFile, 'utf8');

const app = express();

const resolveRootMetaFile = (fileName) => {
  for (const locale of SUPPORTED_LOCALES) {
    const candidate = path.join(distBrowser, locale, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  const rootFile = path.join(distBrowser, fileName);
  return fs.existsSync(rootFile) ? rootFile : null;
};

const serveRootMetaFile = (fileName, contentType) => {
  const filePath = resolveRootMetaFile(fileName);
  if (!filePath) return;
  app.get(`/${fileName}`, (_, res) => {
    res.type(contentType);
    res.sendFile(filePath);
  });
};

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
    res
      .status(502)
      .send(
        'Backend nicht erreichbar. Bitte Backend starten (z. B. npm run dev -w @arsnova/backend).',
      );
  }
});

serveRootMetaFile('robots.txt', 'text/plain; charset=utf-8');
serveRootMetaFile('sitemap.xml', 'application/xml; charset=utf-8');
serveRootMetaFile('llms.txt', 'text/markdown; charset=utf-8');

// /assets/* aus de/ (lokalisiert: Icons/Manifest unter /de/ nutzen /assets/ absolut)
app.use('/assets', express.static(path.join(distBrowser, 'de', 'assets')));
// Locale-prefixed assets (Legal-Seiten laden z. B. /en/assets/legal/imprint.en.md).
// fallthrough: false → fehlende Dateien liefern 404 (nicht SPA-index.html), damit Fallback auf .de.md funktioniert
for (const locale of SUPPORTED_LOCALES) {
  app.use(
    `/${locale}/assets`,
    express.static(path.join(distBrowser, locale, 'assets'), { fallthrough: false }),
  );
}
app.use(express.static(distBrowser));

for (const locale of SUPPORTED_LOCALES) {
  const localeIndex = path.join(distBrowser, locale, 'index.html');
  app.get(`/${locale}`, (_, res) => res.sendFile(localeIndex));
  app.get(`/${locale}/`, (_, res) => res.sendFile(localeIndex));
  app.get(new RegExp(`^/${locale}/.+`), (_, res) => res.sendFile(localeIndex));
}

app.get('/', (_, res) => res.sendFile(rootIndexFile));
app.get(/.*/, (_, res) => res.type('html').send(rootIndexHtml));

const server = createServer(app);

const trpcWss = new WebSocketServer({ noServer: true });
trpcWss.on('connection', (clientWs, req) => {
  if (!req.url?.startsWith('/trpc-ws')) {
    clientWs.close();
    return;
  }
  const backendWs = new WebSocket(BACKEND_WS_URL);
  const pendingMessages = [];
  clientWs.on('message', (data, isBinary) => {
    const message = { data: isBinary ? data : data.toString('utf8'), isBinary };
    if (backendWs.readyState === WebSocket.OPEN) {
      backendWs.send(message.data, { binary: message.isBinary });
    } else {
      pendingMessages.push(message);
    }
  });
  clientWs.on('close', () => backendWs.close());
  clientWs.on('error', () => backendWs.close());
  backendWs.on('open', () => {
    for (const message of pendingMessages.splice(0)) {
      backendWs.send(message.data, { binary: message.isBinary });
    }
  });
  backendWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(isBinary ? data : data.toString('utf8'), { binary: isBinary });
    }
  });
  backendWs.on('close', () => clientWs.close());
  backendWs.on('error', (err) => {
    console.error('WebSocket tRPC Backend:', err.message);
    clientWs.close();
  });
});

const yjsWss = new WebSocketServer({ noServer: true });
let yjsBackendErrorLogged = false;
yjsWss.on('connection', (clientWs, req) => {
  const path = req.url?.startsWith('/yjs-ws') ? req.url.slice('/yjs-ws'.length) || '/' : '/';
  const backendUrl = `${BACKEND_YJS_WS_URL}${path}`;
  const backendWs = new WebSocket(backendUrl);
  const pendingMessages = [];
  clientWs.on('message', (data, isBinary) => {
    const message = { data, isBinary };
    if (backendWs.readyState === WebSocket.OPEN) {
      backendWs.send(message.data, { binary: message.isBinary });
    } else {
      pendingMessages.push(message);
    }
  });
  clientWs.on('close', () => backendWs.close());
  clientWs.on('error', () => backendWs.close());
  backendWs.on('open', () => {
    for (const message of pendingMessages.splice(0)) {
      backendWs.send(message.data, { binary: message.isBinary });
    }
  });
  backendWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });
  backendWs.on('close', () => clientWs.close());
  backendWs.on('error', (err) => {
    if (!yjsBackendErrorLogged) {
      yjsBackendErrorLogged = true;
      const msg = err?.code || err?.message || String(err);
      console.error(
        'WebSocket Yjs Backend:',
        msg,
        '(Yjs-Server auf Port',
        YJS_WS_PORT + ' starten)',
      );
    }
    clientWs.close();
  });
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
