import { chmod, mkdtemp, rm, unlink } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SpacyClientError,
  normalizeWithSpacySidecar,
  probeSpacySidecarHealth,
  resetSpacyClientInFlightForTests,
  SPACY_MAX_TEXT_CHARS,
} from './spacyClient';
import type { NlpSidecarConfig } from './nlpSidecarConfig';

const closers: Array<() => Promise<void>> = [];
const tempDirectories: string[] = [];

async function createSocketPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'arsnova-spacy-'));
  tempDirectories.push(directory);
  return join(directory, 'nlp.sock');
}

function nlpConfig(socketPath: string, timeoutMs = 1_000): NlpSidecarConfig {
  return { enabled: true, socketPath, timeoutMs, cacheTtlSeconds: 1800 };
}

async function startMockSidecar(
  socketPath: string,
  handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>,
): Promise<void> {
  await unlink(socketPath).catch(() => undefined);
  const server = createServer((request, response) => {
    void Promise.resolve(handler(request, response)).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500);
      }
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.listen(socketPath, () => resolve());
    server.once('error', reject);
  });
  await chmod(socketPath, 0o600);
  closers.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  response.writeHead(statusCode, {
    'content-type': 'application/json',
    'content-length': String(payload.byteLength),
  });
  response.end(payload);
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const lemmaResponse = {
  locale: 'de' as const,
  modelId: 'de_core_news_sm@3.8.0',
  items: [
    {
      id: 'item-1',
      tokens: [{ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' }],
    },
  ],
};

afterEach(async () => {
  resetSpacyClientInFlightForTests();
  await Promise.all(closers.splice(0).map((close) => close()));
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('spacyClient', () => {
  it('normalisiert ueber einen Unix-Socket und prueft die Gesundheit', async () => {
    const socketPath = await createSocketPath();
    await startMockSidecar(socketPath, async (request, response) => {
      if (request.method === 'GET' && request.url === '/health') {
        response.writeHead(204);
        response.end();
        return;
      }
      expect(request.method).toBe('POST');
      expect(request.url).toBe('/normalize');
      const body = JSON.parse(await readBody(request)) as { locale: string; texts: unknown[] };
      expect(body.locale).toBe('de');
      expect(body.texts).toHaveLength(1);
      sendJson(response, 200, lemmaResponse);
    });

    const config = nlpConfig(socketPath);
    await expect(probeSpacySidecarHealth(config)).resolves.toBe(true);
    await expect(
      normalizeWithSpacySidecar('de', [{ id: 'item-1', text: 'Häuser' }], config),
    ).resolves.toEqual(lemmaResponse);
  });

  it('gibt bei fehlendem Socket keine Pfaddetails preis', async () => {
    const socketPath = await createSocketPath();
    const error = await normalizeWithSpacySidecar(
      'de',
      [{ id: 'item-1', text: 'Haus' }],
      nlpConfig(socketPath),
    )
      .then(() => undefined)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SpacyClientError);
    expect((error as SpacyClientError).code).toBe('UNAVAILABLE');
    expect((error as Error).message).toBe('NLP-Sidecar ist nicht erreichbar');
    expect((error as Error).message).not.toContain(socketPath);
    await expect(probeSpacySidecarHealth(nlpConfig(socketPath))).resolves.toBe(false);
  });

  it('meldet Timeout ohne Socketpfad, wenn der Sidecar nicht antwortet', async () => {
    const socketPath = await createSocketPath();
    await startMockSidecar(socketPath, () => undefined);

    const error = await normalizeWithSpacySidecar(
      'de',
      [{ id: 'item-1', text: 'Haus' }],
      nlpConfig(socketPath, 1_000),
    )
      .then(() => undefined)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SpacyClientError);
    expect((error as SpacyClientError).code).toBe('TIMEOUT');
    expect((error as Error).message).not.toContain(socketPath);
  });

  it('lehnt ungueltige Antworten und fremde Modell-IDs ab', async () => {
    const socketPath = await createSocketPath();
    await startMockSidecar(socketPath, (_request, response) => {
      sendJson(response, 200, { locale: 'de', modelId: 'wrong_model@0', items: [] });
    });

    await expect(
      normalizeWithSpacySidecar('de', [{ id: 'item-1', text: 'Haus' }], nlpConfig(socketPath)),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('begrenzt parallele Normalize-Requests', async () => {
    const socketPath = await createSocketPath();
    await startMockSidecar(socketPath, () => undefined);
    const config = nlpConfig(socketPath, 1_000);
    const texts = [{ id: 'item-1', text: 'Haus' }] as const;

    const first = normalizeWithSpacySidecar('de', texts, config);
    const second = normalizeWithSpacySidecar('de', texts, config);
    const third = normalizeWithSpacySidecar('de', texts, config);

    await expect(third).rejects.toMatchObject({ code: 'BACKPRESSURE' });
    await expect(first).rejects.toMatchObject({ code: 'TIMEOUT' });
    await expect(second).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('lehnt zu lange Texte ab, ohne den Socket zu nutzen', async () => {
    const socketPath = await createSocketPath();
    await expect(
      normalizeWithSpacySidecar(
        'de',
        [{ id: 'item-1', text: 'x'.repeat(SPACY_MAX_TEXT_CHARS + 1) }],
        nlpConfig(socketPath),
      ),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('liefert fuer leere Snapshots das gepinnte Modell ohne Connect', async () => {
    await expect(
      normalizeWithSpacySidecar('en', [], nlpConfig('/tmp/arsnova-unused-nlp.sock')),
    ).resolves.toEqual({
      locale: 'en',
      modelId: 'en_core_web_sm@3.8.0',
      items: [],
    });
  });
});
