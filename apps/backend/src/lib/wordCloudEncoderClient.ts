/**
 * Client für den privaten Word-Cloud-Encoder (Story 1.14c Stufe 1).
 *
 * Transport: Unix-Socket analog spaCy oder internes HTTP analog 8.9c.
 * Browser und Teilnehmende sprechen den Dienst nie an. Rohtexte stehen nicht in Fehlern.
 */
import { request as httpRequest } from 'node:http';
import { z } from 'zod';
import {
  WORD_CLOUD_MAX_ANALYZE_ITEMS,
  WORD_CLOUD_MAX_ITEM_ID_CHARS,
  WORD_CLOUD_MAX_ITEM_TEXT_CHARS,
  WORD_CLOUD_SEMANTIC_LOCALES,
} from '@arsnova/shared-types';
import {
  isBlockedWordCloudEncoderHost,
  resolveWordCloudSemanticConfig,
  type WordCloudSemanticConfig,
} from './wordCloudSemanticConfig';

export const WORD_CLOUD_ENCODER_MAX_IN_FLIGHT = 1;
export const WORD_CLOUD_ENCODER_MAX_REQUEST_BYTES = 1_048_576;
export const WORD_CLOUD_ENCODER_MAX_RESPONSE_BYTES = 4_194_304;

export type WordCloudEncoderFailureCode =
  'UNAVAILABLE' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'BACKPRESSURE' | 'SAAS_BLOCKED';

export class WordCloudEncoderError extends Error {
  readonly code: WordCloudEncoderFailureCode;

  constructor(code: WordCloudEncoderFailureCode) {
    super(messageFor(code));
    this.name = 'WordCloudEncoderError';
    this.code = code;
  }
}

export const WordCloudEncoderItemSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(WORD_CLOUD_MAX_ITEM_ID_CHARS + 16),
  text: z.string().trim().min(1).max(WORD_CLOUD_MAX_ITEM_TEXT_CHARS),
});

export const WordCloudEncoderRequestSchema = z.object({
  locale: z.enum(WORD_CLOUD_SEMANTIC_LOCALES),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  items: z.array(WordCloudEncoderItemSchema).max(WORD_CLOUD_MAX_ANALYZE_ITEMS),
});

const WordCloudEncoderVectorSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(WORD_CLOUD_MAX_ITEM_ID_CHARS + 16),
  embedding: z.array(z.number().finite()).min(2).max(1024),
});

export const WordCloudEncoderResponseSchema = z.object({
  modelId: z.string().min(1).max(128),
  modelVersion: z.string().min(1).max(128),
  items: z.array(WordCloudEncoderVectorSchema).max(WORD_CLOUD_MAX_ANALYZE_ITEMS),
});

export type WordCloudEncoderRequest = z.infer<typeof WordCloudEncoderRequestSchema>;
export type WordCloudEncoderResponse = z.infer<typeof WordCloudEncoderResponseSchema>;

export type WordCloudEncoderFetch = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

type EncoderHooks = {
  fetch: WordCloudEncoderFetch;
  config: () => WordCloudSemanticConfig;
  socketRequest?: typeof defaultSocketRequest;
};

function createDefaultHooks(): EncoderHooks {
  return {
    fetch: globalThis.fetch as WordCloudEncoderFetch,
    config: () => resolveWordCloudSemanticConfig(),
  };
}

let hooks: EncoderHooks = createDefaultHooks();
let inFlight = 0;

export function resetWordCloudEncoderClientForTests(overrides?: Partial<EncoderHooks>): void {
  hooks = {
    ...createDefaultHooks(),
    ...overrides,
  };
  inFlight = 0;
}

export function assertWordCloudEncoderSnapshotMinimized(
  items: readonly { id: string; text: string }[],
): void {
  for (const item of items) {
    const keys = Object.keys(item).sort();
    if (keys.length !== 2 || keys[0] !== 'id' || keys[1] !== 'text') {
      throw new WordCloudEncoderError('INVALID_RESPONSE');
    }
  }
}

export async function embedWithWordCloudEncoder(
  request: WordCloudEncoderRequest,
  config: WordCloudSemanticConfig = hooks.config(),
): Promise<WordCloudEncoderResponse> {
  if (!config.enabled) {
    throw new WordCloudEncoderError('UNAVAILABLE');
  }
  const parsedRequest = WordCloudEncoderRequestSchema.safeParse(request);
  if (!parsedRequest.success) {
    throw new WordCloudEncoderError('INVALID_RESPONSE');
  }
  assertWordCloudEncoderSnapshotMinimized(parsedRequest.data.items);

  if (inFlight >= WORD_CLOUD_ENCODER_MAX_IN_FLIGHT) {
    throw new WordCloudEncoderError('BACKPRESSURE');
  }
  inFlight += 1;
  try {
    if (config.inferenceUrl) {
      return await embedOverHttp(parsedRequest.data, config);
    }
    return await embedOverSocket(parsedRequest.data, config);
  } finally {
    inFlight = Math.max(0, inFlight - 1);
  }
}

async function embedOverHttp(
  request: WordCloudEncoderRequest,
  config: WordCloudSemanticConfig,
): Promise<WordCloudEncoderResponse> {
  const url = config.inferenceUrl;
  if (!url) {
    throw new WordCloudEncoderError('UNAVAILABLE');
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new WordCloudEncoderError('UNAVAILABLE');
  }
  if (isBlockedWordCloudEncoderHost(parsedUrl.hostname)) {
    throw new WordCloudEncoderError('SAAS_BLOCKED');
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (config.inferenceToken) {
    headers.authorization = `Bearer ${config.inferenceToken}`;
  }

  let response: Awaited<ReturnType<WordCloudEncoderFetch>>;
  try {
    response = await hooks.fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    throw toEncoderError(error);
  }
  if (response.status === 503) {
    throw new WordCloudEncoderError('BACKPRESSURE');
  }
  if (!response.ok) {
    throw new WordCloudEncoderError('UNAVAILABLE');
  }
  const text = await response.text();
  if (text.length > WORD_CLOUD_ENCODER_MAX_RESPONSE_BYTES) {
    throw new WordCloudEncoderError('INVALID_RESPONSE');
  }
  return parseEncoderResponse(text, request);
}

async function embedOverSocket(
  request: WordCloudEncoderRequest,
  config: WordCloudSemanticConfig,
): Promise<WordCloudEncoderResponse> {
  const payload = Buffer.from(JSON.stringify(request), 'utf8');
  if (payload.byteLength > WORD_CLOUD_ENCODER_MAX_REQUEST_BYTES) {
    throw new WordCloudEncoderError('INVALID_RESPONSE');
  }
  const raw = await (hooks.socketRequest ?? defaultSocketRequest)({
    config,
    method: 'POST',
    path: '/embed',
    body: payload,
  });
  if (raw.statusCode === 503) {
    throw new WordCloudEncoderError('BACKPRESSURE');
  }
  if (raw.statusCode !== 200) {
    throw raw.statusCode === 0
      ? new WordCloudEncoderError('UNAVAILABLE')
      : new WordCloudEncoderError('INVALID_RESPONSE');
  }
  return parseEncoderResponse(raw.body.toString('utf8'), request);
}

function parseEncoderResponse(
  raw: string,
  request: WordCloudEncoderRequest,
): WordCloudEncoderResponse {
  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    throw new WordCloudEncoderError('INVALID_RESPONSE');
  }
  const parsed = WordCloudEncoderResponseSchema.safeParse(json);
  if (!parsed.success || parsed.data.items.length !== request.items.length) {
    throw new WordCloudEncoderError('INVALID_RESPONSE');
  }
  const expectedIds = new Set(request.items.map((item) => item.id));
  const receivedIds = new Set(parsed.data.items.map((item) => item.id));
  if (
    expectedIds.size !== receivedIds.size ||
    [...expectedIds].some((id) => !receivedIds.has(id))
  ) {
    throw new WordCloudEncoderError('INVALID_RESPONSE');
  }
  const dimension = parsed.data.items[0]?.embedding.length ?? 0;
  if (parsed.data.items.some((item) => item.embedding.length !== dimension)) {
    throw new WordCloudEncoderError('INVALID_RESPONSE');
  }
  return parsed.data;
}

function defaultSocketRequest(input: {
  readonly config: WordCloudSemanticConfig;
  readonly method: 'GET' | 'POST';
  readonly path: '/health' | '/embed';
  readonly body: Buffer | null;
}): Promise<{ statusCode: number; body: Buffer }> {
  return new Promise<{ statusCode: number; body: Buffer }>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      callback();
    };

    const request = httpRequest(
      {
        socketPath: input.config.socketPath,
        path: input.path,
        method: input.method,
        headers:
          input.body === null
            ? { 'content-length': '0' }
            : {
                'content-type': 'application/json',
                'content-length': String(input.body.byteLength),
              },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer | string) => {
          const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
          bytes += buffer.byteLength;
          if (bytes > WORD_CLOUD_ENCODER_MAX_RESPONSE_BYTES) {
            response.destroy();
            finish(() => reject(new WordCloudEncoderError('INVALID_RESPONSE')));
            return;
          }
          chunks.push(buffer);
        });
        response.once('error', () =>
          finish(() => reject(new WordCloudEncoderError('UNAVAILABLE'))),
        );
        response.once('end', () => {
          finish(() =>
            resolve({
              statusCode: response.statusCode ?? 0,
              body: Buffer.concat(chunks),
            }),
          );
        });
      },
    );

    request.setTimeout(input.config.timeoutMs, () => {
      request.destroy();
      finish(() => reject(new WordCloudEncoderError('TIMEOUT')));
    });
    request.once('error', (error: NodeJS.ErrnoException) => {
      if (error instanceof WordCloudEncoderError) {
        finish(() => reject(error));
        return;
      }
      const timeoutError =
        error.code === 'TIMEOUT' ||
        error.message.includes('TIMEOUT') ||
        error.message.includes('Zeitlimit');
      finish(() => reject(new WordCloudEncoderError(timeoutError ? 'TIMEOUT' : 'UNAVAILABLE')));
    });
    request.end(input.body);
  });
}

function toEncoderError(error: unknown): WordCloudEncoderError {
  if (error instanceof WordCloudEncoderError) {
    return error;
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return new WordCloudEncoderError('TIMEOUT');
  }
  return new WordCloudEncoderError('UNAVAILABLE');
}

function messageFor(code: WordCloudEncoderFailureCode): string {
  switch (code) {
    case 'TIMEOUT':
      return 'Word-Cloud-Encoder hat das Zeitlimit überschritten';
    case 'INVALID_RESPONSE':
      return 'Word-Cloud-Encoder lieferte eine ungültige Antwort';
    case 'BACKPRESSURE':
      return 'Word-Cloud-Encoder ist ausgelastet';
    case 'SAAS_BLOCKED':
      return 'Öffentliche SaaS-Endpunkte sind nicht zulässig';
    default:
      return 'Word-Cloud-Encoder ist nicht erreichbar';
  }
}
