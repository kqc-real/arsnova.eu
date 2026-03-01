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
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res, next) => {
    const indexPath = path.join(frontendDist, 'index.html');
    const csrPath = path.join(frontendDist, 'index.csr.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else if (fs.existsSync(csrPath)) {
      res.sendFile(csrPath);
    } else {
      next();
    }
  });
}

const server = app.listen(PORT, () => {
  logger.info(`🚀 Backend HTTP auf http://localhost:${PORT}`);
  logger.info(`   tRPC: http://localhost:${PORT}/trpc`);
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
    env: { ...process.env, PORT: String(YJS_WS_PORT), HOST: 'localhost' },
    stdio: 'ignore',
  });
  yjsChild.on('error', (err) => {
    logger.warn('Yjs WebSocket-Server Fehler:', (err as Error).message);
  });
  logger.info(`   Yjs WebSocket: ws://localhost:${YJS_WS_PORT}`);
} catch (e) {
  logger.warn('Yjs WebSocket nicht gestartet:', (e as Error).message);
}

function shutdown(): void {
  wsHandler.broadcastReconnectNotification();
  wss.close();
  server.close();
  if (yjsChild) yjsChild.kill();
  closeRedis();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
