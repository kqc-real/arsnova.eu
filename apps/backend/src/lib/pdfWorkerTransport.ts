import { chmod, unlink } from 'node:fs/promises';
import { createServer, request as httpRequest, type ServerResponse } from 'node:http';
import type { Page } from 'playwright';
import { z } from 'zod';

export const PDF_WORKER_DEFAULT_SOCKET_PATH = '/run/pdf-worker/render.sock';
export const PDF_WORKER_MAX_REQUEST_BYTES = 16 * 1024 * 1024;
export const PDF_WORKER_MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
export const PDF_WORKER_REQUEST_TIMEOUT_MS = 75_000;
export const PDF_WORKER_BODY_TIMEOUT_MS = 5_000;

export type PdfRenderMode = 'local' | 'worker';
type PdfOptions = NonNullable<Parameters<Page['pdf']>[0]>;

const PdfMarginSchema = z
  .object({
    top: z.string().max(64).optional(),
    right: z.string().max(64).optional(),
    bottom: z.string().max(64).optional(),
    left: z.string().max(64).optional(),
  })
  .strict();

const PdfOptionsSchema = z
  .object({
    format: z.literal('A4'),
    printBackground: z.literal(true),
    displayHeaderFooter: z.boolean(),
    headerTemplate: z.string().max(250_000).optional(),
    footerTemplate: z.string().max(250_000).optional(),
    margin: PdfMarginSchema,
    tagged: z.literal(true),
    outline: z.literal(true),
  })
  .strict();

const PdfWorkerRequestSchema = z
  .object({
    html: z
      .string()
      .min(1)
      .max(12 * 1024 * 1024),
    pdfOptions: PdfOptionsSchema,
  })
  .strict();

export interface PdfWorkerRenderRequest {
  html: string;
  pdfOptions: PdfOptions;
}

export interface PdfWorkerServer {
  close(): Promise<void>;
}

export function resolvePdfRenderMode(
  nodeEnv = process.env['NODE_ENV'],
  configuredMode = process.env['PDF_RENDER_MODE'],
): PdfRenderMode {
  const mode = configuredMode?.trim();
  if (nodeEnv === 'production') {
    if (mode === 'local') {
      throw new Error('PDF_RENDER_MODE=local ist in Produktion nicht zulässig');
    }
    if (mode && mode !== 'worker') {
      throw new Error(`Ungültiger PDF_RENDER_MODE: ${mode}`);
    }
    return 'worker';
  }
  if (!mode) return 'local';
  if (mode === 'local' || mode === 'worker') return mode;
  throw new Error(`Ungültiger PDF_RENDER_MODE: ${mode}`);
}

function socketPathFromEnvironment(): string {
  return process.env['PDF_WORKER_SOCKET_PATH']?.trim() || PDF_WORKER_DEFAULT_SOCKET_PATH;
}

export async function renderPdfViaWorker(
  payload: PdfWorkerRenderRequest,
  options: { socketPath?: string; timeoutMs?: number } = {},
): Promise<Buffer> {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  if (body.byteLength > PDF_WORKER_MAX_REQUEST_BYTES) {
    throw new Error('PDF-Worker-Request überschreitet das Größenlimit');
  }

  return new Promise<Buffer>((resolve, reject) => {
    const request = httpRequest(
      {
        socketPath: options.socketPath ?? socketPathFromEnvironment(),
        path: '/render',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(body.byteLength),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.byteLength;
          if (bytes > PDF_WORKER_MAX_RESPONSE_BYTES) {
            response.destroy(new Error('PDF-Worker-Antwort überschreitet das Größenlimit'));
            return;
          }
          chunks.push(chunk);
        });
        response.once('error', () => reject(new Error('PDF-Worker-Verbindung wurde beendet')));
        response.once('end', () => {
          if (response.statusCode !== 200) {
            reject(new Error(`PDF-Worker antwortete mit Status ${response.statusCode ?? 0}`));
            return;
          }
          const pdf = Buffer.concat(chunks);
          if (pdf.subarray(0, 4).toString('utf8') !== '%PDF') {
            reject(new Error('PDF-Worker lieferte keine PDF-Datei'));
            return;
          }
          resolve(pdf);
        });
      },
    );
    request.setTimeout(options.timeoutMs ?? PDF_WORKER_REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('PDF-Worker-Request hat das Zeitlimit überschritten'));
    });
    request.once('error', () => reject(new Error('PDF-Worker ist nicht erreichbar')));
    request.end(body);
  });
}

function emptyResponse(response: ServerResponse, status: number) {
  response.writeHead(status, {
    'content-length': '0',
    'cache-control': 'no-store',
  });
  response.end();
}

export async function createPdfWorkerServer(options: {
  socketPath?: string;
  bodyTimeoutMs?: number;
  render(payload: PdfWorkerRenderRequest): Promise<Buffer>;
  onError?: (error: unknown) => void;
}): Promise<PdfWorkerServer> {
  const socketPath = options.socketPath ?? socketPathFromEnvironment();
  let workerBusy = false;
  const server = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      request.resume();
      emptyResponse(response, 204);
      return;
    }
    if (
      request.method !== 'POST' ||
      request.url !== '/render' ||
      request.headers['content-type'] !== 'application/json'
    ) {
      request.resume();
      emptyResponse(response, 404);
      return;
    }

    const declaredLength = Number(request.headers['content-length']);
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength < 1 ||
      declaredLength > PDF_WORKER_MAX_REQUEST_BYTES
    ) {
      request.resume();
      emptyResponse(response, 413);
      return;
    }
    if (workerBusy) {
      request.resume();
      emptyResponse(response, 503);
      return;
    }
    workerBusy = true;

    const chunks: Buffer[] = [];
    let bytes = 0;
    let oversized = false;
    let bodyComplete = false;
    const bodyTimeout = setTimeout(() => {
      if (bodyComplete) return;
      workerBusy = false;
      emptyResponse(response, 408);
      request.destroy();
    }, options.bodyTimeoutMs ?? PDF_WORKER_BODY_TIMEOUT_MS);
    request.on('data', (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > PDF_WORKER_MAX_REQUEST_BYTES) {
        oversized = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    request.once('error', (error) => {
      clearTimeout(bodyTimeout);
      if (!bodyComplete) workerBusy = false;
      options.onError?.(error);
    });
    request.once('aborted', () => {
      clearTimeout(bodyTimeout);
      if (!bodyComplete) workerBusy = false;
    });
    request.once('end', async () => {
      bodyComplete = true;
      clearTimeout(bodyTimeout);
      if (oversized || bytes !== declaredLength) {
        workerBusy = false;
        emptyResponse(response, oversized ? 413 : 400);
        return;
      }

      let parsed: PdfWorkerRenderRequest;
      try {
        parsed = PdfWorkerRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        workerBusy = false;
        emptyResponse(response, 400);
        return;
      }

      try {
        const pdf = await options.render(parsed);
        if (
          pdf.byteLength > PDF_WORKER_MAX_RESPONSE_BYTES ||
          pdf.subarray(0, 4).toString('utf8') !== '%PDF'
        ) {
          throw new Error('Renderer lieferte eine ungültige oder zu große PDF-Datei');
        }
        response.writeHead(200, {
          'content-type': 'application/pdf',
          'content-length': String(pdf.byteLength),
          'cache-control': 'no-store',
        });
        response.end(pdf);
      } catch (error) {
        options.onError?.(error);
        emptyResponse(response, 500);
      } finally {
        workerBusy = false;
      }
    });
  });

  await unlink(socketPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => {
      server.off('error', reject);
      resolve();
    });
  });
  await chmod(socketPath, 0o600);

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          void unlink(socketPath)
            .catch((unlinkError: NodeJS.ErrnoException) => {
              if (unlinkError.code !== 'ENOENT') throw unlinkError;
            })
            .then(() => (error ? reject(error) : resolve()), reject);
        });
      }),
  };
}
