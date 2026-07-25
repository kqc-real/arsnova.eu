/**
 * Isolierter Chromium-Renderer für Produktions-PDFs.
 *
 * Der Prozess lauscht ausschließlich auf einem dateiberechtigten Unix-Socket.
 * Der Compose-Service besitzt kein Netzwerk und erhält keine App-Secrets.
 */
import { logger } from './lib/logger';
import { PDF_WORKER_DEFAULT_SOCKET_PATH, createPdfWorkerServer } from './lib/pdfWorkerTransport';
import { renderSessionResultsPdfHtmlLocally } from './lib/session-results-report-pdf';

const socketPath = process.env['PDF_WORKER_SOCKET_PATH']?.trim() || PDF_WORKER_DEFAULT_SOCKET_PATH;

async function main(): Promise<void> {
  const worker = await createPdfWorkerServer({
    socketPath,
    render: renderSessionResultsPdfHtmlLocally,
    onError(error) {
      logger.error('pdf-worker:render_failed', {
        errorName: error instanceof Error ? error.name : 'unknown',
      });
    },
  });

  logger.info('pdf-worker:ready', { socketPath });

  let shuttingDown = false;
  async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    await worker.close();
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

void main().catch((error) => {
  logger.error('pdf-worker:start_failed', {
    errorName: error instanceof Error ? error.name : 'unknown',
  });
  process.exit(1);
});
