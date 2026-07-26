/**
 * Backend-Einstieg: Express + tRPC WebSocket + Yjs WebSocket (Story 0.1, 0.2, 0.3)
 */
import './load-env';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { appRouter } from './routers';
import { getRedis, closeRedis } from './redis';
import { logger } from './lib/logger';
import { shutdownAbuseTelemetry } from './lib/abuseTelemetry';
import { shutdownPdfTelemetry } from './lib/pdfTelemetry';
import { pickLocaleFromAcceptLanguage } from './lib/pick-locale-from-accept-language';
import { TRPC_MAX_BODY_SIZE_BYTES } from './lib/requestLimits';
import { startSessionCleanupScheduler, stopSessionCleanupScheduler } from './lib/sessionCleanup';
import { attachTrustedClientIp, createTrustProxyFunction } from './lib/trustedProxy';
import { resolveTrpcWebSocketConfig, TrpcWebSocketServer } from './lib/trpcWebSocketServer';
import { resolveYjsRelayConfig, YjsRelayServer } from './lib/yjsRelay';
import { createCspReportRouter } from './lib/cspReportIngest';
import { createCspReportOnlyMiddleware } from './lib/cspReportOnly';
import { createHttpCorsMiddleware } from './lib/httpCors';
import {
  assertYjsShareTokenSecretConfigured,
  getYjsShareLegacyUuidCutoffAt,
} from './lib/yjsShareToken';

const PORT = Number(process.env['PORT']) || 3000;

// Produktion: Yjs-Share-HMAC ohne starkes Secret hart abbrechen (W3.4).
assertYjsShareTokenSecretConfigured();
getYjsShareLegacyUuidCutoffAt();

// Redis beim Start initialisieren (Story 0.1)
getRedis();

const app = express();
app.disable('x-powered-by');
/** Hinter Nginx/Proxy: `X-Forwarded-For` / `req.ip` korrekt (Rate-Limit pro echtem Client). */
const trustProxyHops = Number(process.env['TRUST_PROXY_HOPS'] ?? 0);
const trustProxy = createTrustProxyFunction(trustProxyHops);
if (Number.isFinite(trustProxyHops) && trustProxyHops > 0) {
  app.set('trust proxy', trustProxy);
}
// Browser-Reporting-Ausnahme vom tRPC-only-Grundsatz: Raw-Body-Cap, eigenes RL,
// keine Auth- oder Antwort-Payload. Muss vor CORS, tRPC und SPA-Fallback liegen.
app.use('/csp-report', createCspReportRouter());
// Nur erfolgreiche HTML-Dokumentantworten erhalten die optionale Beobachtungspolicy.
// Der Report-Ingest liegt davor und kann daher nie rekursiv einen CSP-Header ausliefern.
app.use(createCspReportOnlyMiddleware());
app.use(compression());
const httpCorsMiddleware = createHttpCorsMiddleware(process.env['NODE_ENV']);
if (httpCorsMiddleware) {
  app.use(httpCorsMiddleware);
}
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req }) => ({ req }),
    maxBodySize: TRPC_MAX_BODY_SIZE_BYTES,
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
  const readFirstAvailableHtml = (...candidates: Array<string | null>): string | null => {
    const filePath = candidates.find((candidate) => candidate && fs.existsSync(candidate));
    return filePath ? fs.readFileSync(filePath, 'utf8') : null;
  };

  // PWA-Update: ngsw.json und index.html nicht cachen, damit der Service Worker neue Versionen erkennt.
  app.use((req, res, next) => {
    if (req.path.endsWith('/ngsw.json') || req.path.endsWith('/index.html')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  });

  if (hasLocalizedBuild) {
    // i18n-Build legt Root-Metadateien nur unter /<locale>/ ab; ohne eigene Route liefert SPA-Fallback HTML.
    const robotsLocaleOrder = [
      ...(fallbackLocale ? [fallbackLocale] : []),
      ...availableLocales.filter((l) => l !== fallbackLocale),
    ];

    const resolveRootMetaFile = (fileName: string): string | null => {
      for (const locale of robotsLocaleOrder) {
        const candidate = path.join(frontendDist, locale, fileName);
        if (fs.existsSync(candidate)) {
          return path.resolve(candidate);
        }
      }
      const rootFile = path.join(frontendDist, fileName);
      return fs.existsSync(rootFile) ? path.resolve(rootFile) : null;
    };

    const robotsFile = resolveRootMetaFile('robots.txt');
    if (robotsFile) {
      const robotsPath = robotsFile;
      app.get('/robots.txt', (_req, res) => {
        res.type('text/plain; charset=utf-8');
        res.sendFile(robotsPath);
      });
    }

    const sitemapFile = resolveRootMetaFile('sitemap.xml');
    if (sitemapFile) {
      const sitemapPath = sitemapFile;
      app.get('/sitemap.xml', (_req, res) => {
        res.type('application/xml; charset=utf-8');
        res.sendFile(sitemapPath);
      });
    }

    const llmsFile = resolveRootMetaFile('llms.txt');
    if (llmsFile) {
      const llmsPath = llmsFile;
      app.get('/llms.txt', (_req, res) => {
        res.type('text/markdown; charset=utf-8');
        res.sendFile(llmsPath);
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
    const spaFallbackHtml = readFirstAvailableHtml(rootIndexPath, fallbackIndexPath);
    app.get(/.*/, (_, res) => {
      if (spaFallbackHtml) {
        res.type('html').send(spaFallbackHtml);
      } else {
        res.status(404).send('Frontend not built');
      }
    });
  } else {
    app.use(express.static(frontendDist));
    const spaFallbackHtml = readFirstAvailableHtml(rootIndexPath, csrPath);
    app.get(/.*/, (_req, res, next) => {
      if (spaFallbackHtml) {
        res.type('html').send(spaFallbackHtml);
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

// WebSocket-Server für tRPC-Subscriptions (Story 0.2 / W2.3a)
const trpcWebSocketConfig = resolveTrpcWebSocketConfig();
const trpcWebSocketServer = new TrpcWebSocketServer(trpcWebSocketConfig);
const wsHandler = applyWSSHandler({
  wss: trpcWebSocketServer.webSocketServer,
  router: appRouter,
  createContext: async ({ req, info }) => ({
    req: attachTrustedClientIp(req, trustProxy),
    connectionParams: info.connectionParams,
  }),
});
trpcWebSocketServer.listen(() => {
  logger.info(`   WebSocket (tRPC): ws://${trpcWebSocketConfig.host}:${trpcWebSocketConfig.port}`);
});

// Story 0.3 / W2.2: gehärteter Yjs-Relay für geteilte Quiz-Sammlungen.
const yjsRelayConfig = resolveYjsRelayConfig();
const yjsRelay = new YjsRelayServer(yjsRelayConfig);
yjsRelay.listen(() => {
  logger.info(`   Yjs WebSocket: ws://${yjsRelayConfig.host}:${yjsRelayConfig.port}`);
});

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  stopSessionCleanupScheduler();
  wsHandler.broadcastReconnectNotification();
  server.close();
  await Promise.all([
    trpcWebSocketServer.close(),
    yjsRelay.close(),
    shutdownAbuseTelemetry(),
    shutdownPdfTelemetry(),
  ]);
  await closeRedis();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
