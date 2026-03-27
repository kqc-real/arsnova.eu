/**
 * Backend-Einstieg: Express + tRPC WebSocket + Yjs WebSocket (Story 0.1, 0.2, 0.3)
 */
import './load-env';
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
import { pickLocaleFromAcceptLanguage } from './lib/pick-locale-from-accept-language';
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
  const fallbackLocale = availableLocales.includes('en') ? 'en' : (availableLocales[0] ?? null);
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
    // i18n-Build legt robots.txt nur unter /<locale>/ ab; ohne eigene Route liefert SPA-Fallback HTML → SEO-Tools „invalid“.
    const robotsLocaleOrder = [
      ...(fallbackLocale ? [fallbackLocale] : []),
      ...availableLocales.filter((l) => l !== fallbackLocale),
    ];
    let robotsFile: string | null = null;
    for (const locale of robotsLocaleOrder) {
      const candidate = path.join(frontendDist, locale, 'robots.txt');
      if (fs.existsSync(candidate)) {
        robotsFile = path.resolve(candidate);
        break;
      }
    }
    if (!robotsFile) {
      const rootRobots = path.join(frontendDist, 'robots.txt');
      if (fs.existsSync(rootRobots)) {
        robotsFile = path.resolve(rootRobots);
      }
    }
    if (robotsFile) {
      const robotsPath = robotsFile;
      app.get('/robots.txt', (_req, res) => {
        res.type('text/plain; charset=utf-8');
        res.sendFile(robotsPath);
      });
    }

    let sitemapFile: string | null = null;
    for (const locale of robotsLocaleOrder) {
      const candidate = path.join(frontendDist, locale, 'sitemap.xml');
      if (fs.existsSync(candidate)) {
        sitemapFile = path.resolve(candidate);
        break;
      }
    }
    if (!sitemapFile) {
      const rootSitemap = path.join(frontendDist, 'sitemap.xml');
      if (fs.existsSync(rootSitemap)) {
        sitemapFile = path.resolve(rootSitemap);
      }
    }
    if (sitemapFile) {
      const sitemapPath = sitemapFile;
      app.get('/sitemap.xml', (_req, res) => {
        res.type('application/xml; charset=utf-8');
        res.sendFile(sitemapPath);
      });
    }

    // /assets/* aus de/ (lokalisiert: Manifest-Icons werden unter /assets referenziert)
    app.use('/assets', express.static(path.join(frontendDist, fallbackLocale ?? 'en', 'assets')));
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

    app.get('/', (req, res) => {
      const chosen = pickLocaleFromAcceptLanguage(
        req.headers['accept-language'],
        availableLocales,
        fallbackLocale ?? 'en',
      );
      const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      res.set('Vary', 'Accept-Language');
      res.set('Cache-Control', 'private, no-cache');
      res.redirect(302, `/${chosen}/${query}`);
    });
    // Fallback für nicht-lokalisierte SPA-Routen → Root-Index (Client-Sprachwahl / Noscript-Links)
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
  /** Bind-Adresse: In Docker muss 0.0.0.0 sein, sonst erreicht Nginx (Port-Mapping) den Prozess nicht. */
  const yjsHost = process.env['YJS_WS_HOST'] ?? process.env['HOST'] ?? '127.0.0.1';
  yjsChild = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(YJS_WS_PORT), HOST: yjsHost },
    stdio: 'ignore',
  });
  yjsChild.on('error', (err) => {
    logger.warn('Yjs WebSocket-Server Fehler:', (err as Error).message);
  });
  yjsChild.on('exit', (code, signal) => {
    if (code !== 0 && signal === null) {
      logger.warn(`Yjs WebSocket-Server beendet mit Exit-Code ${String(code)}`);
    }
  });
  logger.info(`   Yjs WebSocket: ws://${yjsHost}:${YJS_WS_PORT}`);
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
