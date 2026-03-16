/**
 * Backend-Einstieg: Express + tRPC WebSocket + Yjs WebSocket (Story 0.1, 0.2, 0.3)
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import { appRouter } from './routers';
import { getRedis, closeRedis } from './redis';
import { logger } from './lib/logger';
import { startSessionCleanupScheduler, stopSessionCleanupScheduler } from './lib/sessionCleanup';

const PORT = Number(process.env['PORT']) || 3000;
const WS_PORT = Number(process.env['WS_PORT']) || 3001;
const YJS_WS_PORT = Number(process.env['YJS_WS_PORT']) || 3002;

// Redis beim Start initialisieren (Story 0.1)
getRedis();

const app = express();
const isProduction = process.env['NODE_ENV'] === 'production';
app.use(compression());
app.use(cors(isProduction ? {} : { origin: 'http://localhost:4200' }));
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req }) => ({ req }),
  }),
);

// In Production: Angular-Build als statische Dateien ausliefern (Docker / lokaler Prod-Build)
const frontendDistBase = path.resolve(__dirname, '../../frontend/dist');
const frontendDist = fs.existsSync(path.join(frontendDistBase, 'browser'))
  ? path.join(frontendDistBase, 'browser')
  : frontendDistBase;
const supportedLocales = ['de', 'en', 'fr', 'it', 'es'] as const;
if (fs.existsSync(frontendDist)) {
  const rootIndexPath = path.join(frontendDist, 'index.html');
  const csrPath = path.join(frontendDist, 'index.csr.html');
  const availableLocales = supportedLocales.filter((locale) =>
    fs.existsSync(path.join(frontendDist, locale, 'index.html')),
  );
  const fallbackLocale = availableLocales.includes('de') ? 'de' : (availableLocales[0] ?? null);
  const fallbackIndexPath = fallbackLocale
    ? path.join(frontendDist, fallbackLocale, 'index.html')
    : null;
  const hasLocalizedBuild = availableLocales.length > 0;

  // PWA-Update: ngsw.json und index.html nicht cachen, damit der Service Worker neue Versionen erkennt.
  app.use((req, res, next) => {
    if (req.path.endsWith('/ngsw.json') || req.path.endsWith('/index.html')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  });

  if (hasLocalizedBuild) {
    // /assets/* aus de/ (lokalisiert: Manifest-Icons werden unter /assets referenziert)
    app.use('/assets', express.static(path.join(frontendDist, fallbackLocale ?? 'de', 'assets')));
    // Locale-prefixed assets: fallthrough false → fehlende Dateien liefern 404 statt SPA-index
    for (const locale of availableLocales) {
      app.use(
        `/${locale}/assets`,
        express.static(path.join(frontendDist, locale, 'assets'), { fallthrough: false }),
      );
    }
    app.use(express.static(frontendDist));

    for (const locale of availableLocales) {
      const localeIndexPath = path.join(frontendDist, locale, 'index.html');
      app.get(`/${locale}`, (_, res) => res.sendFile(localeIndexPath));
      app.get(`/${locale}/`, (_, res) => res.sendFile(localeIndexPath));
      app.get(new RegExp(`^/${locale}/.+`), (_, res) => res.sendFile(localeIndexPath));
    }

    app.get('/', (_, res) => {
      if (fs.existsSync(rootIndexPath)) {
        res.sendFile(rootIndexPath);
      } else if (fallbackIndexPath) {
        res.sendFile(fallbackIndexPath);
      } else {
        res.status(404).send('Frontend not built');
      }
    });
    // Fallback für nicht-lokalisierte SPA-Routen → Root-Index (leitet auf /de/)
    app.get('*', (_, res) => {
      if (fs.existsSync(rootIndexPath)) {
        res.sendFile(rootIndexPath);
      } else if (fallbackIndexPath) {
        res.sendFile(fallbackIndexPath);
      } else {
        res.status(404).send('Frontend not built');
      }
    });
  } else {
    app.use(express.static(frontendDist));
    app.get('*', (_req, res, next) => {
      if (fs.existsSync(rootIndexPath)) {
        res.sendFile(rootIndexPath);
      } else if (fs.existsSync(csrPath)) {
        res.sendFile(csrPath);
      } else {
        next();
      }
    });
  }
}

const server = app.listen(PORT, () => {
  logger.info(`🚀 Backend HTTP auf http://localhost:${PORT}`);
  logger.info(`   tRPC: http://localhost:${PORT}/trpc`);
  startSessionCleanupScheduler();
});

// WebSocket-Server für tRPC-Subscriptions (Story 0.2)
const wss = new WebSocketServer({ port: WS_PORT });
const wsHandler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext: async ({ req }) => ({ req }),
});
logger.info(`   WebSocket (tRPC): ws://localhost:${WS_PORT}`);

// Story 0.3: Yjs WebSocket-Server (Zwei-Tabs-Sync für Quiz)
let yjsChild: ReturnType<typeof spawn> | null = null;
try {
  const serverPath = path.join(
    path.dirname(require.resolve('@y/websocket-server/package.json')),
    'src',
    'server.js',
  );
  yjsChild = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(YJS_WS_PORT), HOST: '127.0.0.1' },
    stdio: 'ignore',
  });
  yjsChild.on('error', (err) => {
    logger.warn('Yjs WebSocket-Server Fehler:', (err as Error).message);
  });
  yjsChild.on('exit', (code, signal) => {
    if (code !== 0 && signal == null) {
      logger.warn(`Yjs WebSocket-Server beendet mit Exit-Code ${String(code)}`);
    }
  });
  logger.info(`   Yjs WebSocket: ws://localhost:${YJS_WS_PORT}`);
} catch (e) {
  logger.warn('Yjs WebSocket nicht gestartet:', (e as Error).message);
}

function shutdown(): void {
  stopSessionCleanupScheduler();
  wsHandler.broadcastReconnectNotification();
  wss.close();
  server.close();
  if (yjsChild) yjsChild.kill();
  closeRedis();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
