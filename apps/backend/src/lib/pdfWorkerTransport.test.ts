import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PDF_WORKER_MAX_REQUEST_BYTES,
  PDF_WORKER_MAX_RESPONSE_BYTES,
  createPdfWorkerServer,
  renderPdfViaWorker,
  resolvePdfRenderMode,
  type PdfWorkerServer,
} from './pdfWorkerTransport';

const workers: PdfWorkerServer[] = [];
const tempDirectories: string[] = [];
const pdfOptions = {
  format: 'A4' as const,
  printBackground: true,
  displayHeaderFooter: false,
  margin: { top: '18mm', right: '14mm', bottom: '18mm', left: '14mm' },
  tagged: true,
  outline: true,
};

async function createSocketPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'arsnova-pdf-worker-'));
  tempDirectories.push(directory);
  return join(directory, 'render.sock');
}

afterEach(async () => {
  await Promise.all(workers.splice(0).map((worker) => worker.close()));
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('PDF-Worker-Transport', () => {
  it('verwendet in Produktion sicher den Worker und lokal den In-Process-Renderer', () => {
    expect(resolvePdfRenderMode('production', undefined)).toBe('worker');
    expect(resolvePdfRenderMode('production', 'worker')).toBe('worker');
    expect(resolvePdfRenderMode('development', undefined)).toBe('local');
    expect(resolvePdfRenderMode('test', undefined)).toBe('local');
    expect(resolvePdfRenderMode(undefined, undefined)).toBe('local');
    expect(resolvePdfRenderMode('development', 'local')).toBe('local');
    expect(() => resolvePdfRenderMode('production', 'local')).toThrow(
      'PDF_RENDER_MODE=local ist in Produktion nicht zulässig',
    );
    expect(() => resolvePdfRenderMode('production', 'unexpected')).toThrow(
      'Ungültiger PDF_RENDER_MODE',
    );
  });

  it('überträgt HTML ausschließlich über einen 0600-Unix-Socket', async () => {
    const socketPath = await createSocketPath();
    const render = vi.fn(async ({ html }: { html: string }) =>
      Buffer.from(`%PDF-1.7\n${html.length}`),
    );
    const worker = await createPdfWorkerServer({ socketPath, render });
    workers.push(worker);

    const response = await renderPdfViaWorker(
      {
        html: '<!doctype html><title>Isoliert</title>',
        pdfOptions,
      },
      { socketPath },
    );

    expect(response.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(render).toHaveBeenCalledWith({
      html: '<!doctype html><title>Isoliert</title>',
      pdfOptions,
    });
    expect((await stat(socketPath)).mode & 0o777).toBe(0o600);
  });

  it('gibt bei einem fehlenden Socket keine internen Pfaddetails preis', async () => {
    const socketPath = await createSocketPath();
    const error = await renderPdfViaWorker({ html: '<h1>Test</h1>', pdfOptions }, { socketPath })
      .then(() => undefined)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('PDF-Worker ist nicht erreichbar');
    expect((error as Error).message).not.toContain(socketPath);
  });

  it('lehnt übergroße Requests client- und serverseitig vor dem Rendern ab', async () => {
    const socketPath = await createSocketPath();
    const render = vi.fn(async () => Buffer.from('%PDF'));
    const worker = await createPdfWorkerServer({ socketPath, render });
    workers.push(worker);

    await expect(
      renderPdfViaWorker(
        {
          html: 'x'.repeat(PDF_WORKER_MAX_REQUEST_BYTES),
          pdfOptions,
        },
        { socketPath },
      ),
    ).rejects.toThrow('PDF-Worker-Request überschreitet');

    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const request = httpRequest(
        {
          socketPath,
          path: '/render',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': String(PDF_WORKER_MAX_REQUEST_BYTES + 1),
          },
        },
        (incoming) => {
          let body = '';
          incoming.setEncoding('utf8');
          incoming.on('data', (chunk) => (body += chunk));
          incoming.on('end', () => resolve({ status: incoming.statusCode ?? 0, body }));
        },
      );
      request.once('error', reject);
      request.end('{}');
    });

    expect(response).toEqual({ status: 413, body: '' });
    expect(render).not.toHaveBeenCalled();
  });

  it('löst einen steckengebliebenen Request-Body fail-closed auf', async () => {
    const socketPath = await createSocketPath();
    const render = vi.fn(async () => Buffer.from('%PDF'));
    const worker = await createPdfWorkerServer({ socketPath, render, bodyTimeoutMs: 20 });
    workers.push(worker);

    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        {
          socketPath,
          path: '/render',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': '100',
          },
        },
        (response) => {
          response.resume();
          response.once('end', () => resolve(response.statusCode ?? 0));
        },
      );
      request.once('error', reject);
      request.flushHeaders();
    });

    expect(status).toBe(408);
    expect(render).not.toHaveBeenCalled();
  });

  it('begrenzt Worker-Antworten und gibt keine internen Fehlerdetails preis', async () => {
    const socketPath = await createSocketPath();
    const worker = await createPdfWorkerServer({
      socketPath,
      render: async ({ html }) => {
        if (html === 'throw') throw new Error('internes Worker-Secret');
        return Buffer.alloc(PDF_WORKER_MAX_RESPONSE_BYTES + 1);
      },
    });
    workers.push(worker);

    await expect(renderPdfViaWorker({ html: 'large', pdfOptions }, { socketPath })).rejects.toThrow(
      'PDF-Worker antwortete mit Status 500',
    );
    await expect(renderPdfViaWorker({ html: 'throw', pdfOptions }, { socketPath })).rejects.toThrow(
      'PDF-Worker antwortete mit Status 500',
    );

    const socketContents = await readFile(socketPath).catch(() => Buffer.alloc(0));
    expect(socketContents.toString()).not.toContain('internes Worker-Secret');
  });

  it('erzwingt zusätzlich im Worker genau einen parallelen Renderjob', async () => {
    const socketPath = await createSocketPath();
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let renderStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      renderStarted = resolve;
    });
    const worker = await createPdfWorkerServer({
      socketPath,
      render: async () => {
        renderStarted();
        await firstBlocked;
        return Buffer.from('%PDF');
      },
    });
    workers.push(worker);

    const first = renderPdfViaWorker({ html: 'first', pdfOptions }, { socketPath });
    await started;
    await expect(
      renderPdfViaWorker({ html: 'second', pdfOptions }, { socketPath }),
    ).rejects.toThrow('PDF-Worker antwortete mit Status 503');
    releaseFirst();
    await expect(first).resolves.toEqual(Buffer.from('%PDF'));
  });
});
