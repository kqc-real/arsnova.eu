import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PDF_WORKER_MAX_HTML_BYTES,
  PDF_WORKER_MAX_REQUEST_BYTES,
  PDF_WORKER_MAX_RESPONSE_BYTES,
  PDF_WORKER_RENDER_TIMEOUT_DEFAULT_MS,
  PDF_WORKER_RENDER_TIMEOUT_MAX_MS,
  PDF_WORKER_RENDER_TIMEOUT_MIN_MS,
  PDF_WORKER_REQUEST_TIMEOUT_MS,
  PdfWorkerFatalRenderError,
  createPdfWorkerServer,
  renderPdfViaWorker,
  resolvePdfRenderMode,
  resolvePdfWorkerRenderTimeoutMs,
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

async function getHealthStatus(socketPath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const request = httpRequest({ socketPath, path: '/health', method: 'GET' }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode ?? 0));
    });
    request.once('error', reject);
    request.end();
  });
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

  it('begrenzt die Worker-Deadline sicher unterhalb des App-Timeouts', () => {
    expect(resolvePdfWorkerRenderTimeoutMs(undefined)).toBe(PDF_WORKER_RENDER_TIMEOUT_DEFAULT_MS);
    expect(resolvePdfWorkerRenderTimeoutMs(String(PDF_WORKER_RENDER_TIMEOUT_MIN_MS))).toBe(
      PDF_WORKER_RENDER_TIMEOUT_MIN_MS,
    );
    expect(resolvePdfWorkerRenderTimeoutMs(String(PDF_WORKER_RENDER_TIMEOUT_MAX_MS))).toBe(
      PDF_WORKER_RENDER_TIMEOUT_MAX_MS,
    );
    expect(PDF_WORKER_RENDER_TIMEOUT_MAX_MS).toBeLessThan(PDF_WORKER_REQUEST_TIMEOUT_MS);
    expect(() => resolvePdfWorkerRenderTimeoutMs('4999')).toThrow('muss zwischen');
    expect(() => resolvePdfWorkerRenderTimeoutMs('70001')).toThrow('muss zwischen');
    expect(() => resolvePdfWorkerRenderTimeoutMs('60s')).toThrow('muss eine ganze Zahl sein');
  });

  it('dimensioniert den Transport für 100 zulässige 400-kB-Bilder', () => {
    const maximumBase64ImageBytes = Math.ceil((100 * 400_000 * 4) / 3);
    expect(PDF_WORKER_MAX_HTML_BYTES).toBeGreaterThan(maximumBase64ImageBytes + 4 * 1024 * 1024);
    expect(PDF_WORKER_MAX_REQUEST_BYTES).toBeGreaterThan(PDF_WORKER_MAX_HTML_BYTES);
    expect(PDF_WORKER_MAX_RESPONSE_BYTES).toBeGreaterThan(40_000_000);
  });

  it('überträgt einen bildreichen Report oberhalb des früheren 12-MiB-Caps', async () => {
    const socketPath = await createSocketPath();
    const html = `<main>${'a'.repeat(13 * 1024 * 1024)}</main>`;
    const render = vi.fn(async () => Buffer.from('%PDF-image-heavy'));
    const worker = await createPdfWorkerServer({ socketPath, render });
    workers.push(worker);

    await expect(renderPdfViaWorker({ html, pdfOptions }, { socketPath })).resolves.toEqual(
      Buffer.from('%PDF-image-heavy'),
    );
    expect(render).toHaveBeenCalledWith({ html, pdfOptions });
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

  it('wird bei einer Render-Deadline fatal und fordert einen Prozess-Exit an', async () => {
    const socketPath = await createSocketPath();
    const onRenderDeadline = vi.fn();
    const worker = await createPdfWorkerServer({
      socketPath,
      renderTimeoutMs: 20,
      onRenderDeadline,
      render: () => new Promise<Buffer>(() => undefined),
    });
    workers.push(worker);

    await expect(renderPdfViaWorker({ html: 'hang', pdfOptions }, { socketPath })).rejects.toThrow(
      'PDF-Worker antwortete mit Status 504',
    );
    expect(onRenderDeadline).toHaveBeenCalledOnce();
    await expect(getHealthStatus(socketPath)).resolves.toBe(503);
    await expect(
      renderPdfViaWorker({ html: 'after-timeout', pdfOptions }, { socketPath }),
    ).rejects.toThrow('PDF-Worker antwortete mit Status 503');
  });

  it('bleibt nach fataler Bildnormalisierung unhealthy und nimmt keinen Folgejob an', async () => {
    const socketPath = await createSocketPath();
    const onFatalRender = vi.fn();
    const render = vi.fn(async () => {
      throw new PdfWorkerFatalRenderError('image normalization fatal');
    });
    const worker = await createPdfWorkerServer({
      socketPath,
      render,
      onFatalRender,
    });
    workers.push(worker);

    await expect(renderPdfViaWorker({ html: 'image', pdfOptions }, { socketPath })).rejects.toThrow(
      'PDF-Worker antwortete mit Status 504',
    );
    expect(onFatalRender).toHaveBeenCalledOnce();
    await expect(getHealthStatus(socketPath)).resolves.toBe(503);
    await expect(
      renderPdfViaWorker({ html: 'after-image-timeout', pdfOptions }, { socketPath }),
    ).rejects.toThrow('PDF-Worker antwortete mit Status 503');
    expect(render).toHaveBeenCalledOnce();
  });
});
