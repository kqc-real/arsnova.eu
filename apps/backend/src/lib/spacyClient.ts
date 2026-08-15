/*
 * HTTP-Client für den optionalen spaCy-Sidecar (Story 1.14b, Phase 2).
 *
 * Transport: Unix-Socket (`NLP_SOCKET_PATH`), analog zum PDF-Worker.
 * Öffentliche Fehler enthalten keinen Socketpfad.
 *
 * Sidecar-Vertrag (Phase 3 implementiert den Dienst):
 * - GET  /health    → 200 | 204
 * - POST /normalize → { locale, texts: [{ id, text }] }
 *                   ← { locale, modelId, items: [{ id, tokens: [{ text, lemma, pos, entType? }] }] }
 */
import { request as httpRequest } from 'node:http';
import { z } from 'zod';
import { WORD_CLOUD_MAX_ITEM_TEXT_CHARS, wordCloudLemmaModelId } from '@arsnova/shared-types';
import { resolveNlpSidecarConfig, type NlpSidecarConfig } from './nlpSidecarConfig';

export const SPACY_MAX_IN_FLIGHT = 2;
export const SPACY_MAX_TEXT_CHARS = WORD_CLOUD_MAX_ITEM_TEXT_CHARS;
export const SPACY_MAX_REQUEST_BYTES = 1_048_576;
export const SPACY_MAX_RESPONSE_BYTES = 1_048_576;
export const SPACY_MAX_TOKENS_PER_TEXT = 2_000;

export type SpacyClientFailureCode =
  'UNAVAILABLE' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'BACKPRESSURE';

export class SpacyClientError extends Error {
  readonly code: SpacyClientFailureCode;

  constructor(code: SpacyClientFailureCode) {
    super(messageFor(code));
    this.name = 'SpacyClientError';
    this.code = code;
  }
}

const SpacyTokenSchema = z.object({
  text: z.string().min(1).max(256),
  lemma: z.string().min(1).max(256),
  pos: z.string().min(1).max(16),
  entType: z.string().max(32).nullable().optional(),
});

const SpacyNormalizeResponseSchema = z.object({
  locale: z.enum(['de', 'en']),
  modelId: z.string().min(1).max(128),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        tokens: z.array(SpacyTokenSchema).max(SPACY_MAX_TOKENS_PER_TEXT),
      }),
    )
    .max(500),
});

export type SpacyNormalizeToken = z.infer<typeof SpacyTokenSchema>;
export type SpacyNormalizeResponse = z.infer<typeof SpacyNormalizeResponseSchema>;

export interface SpacyNormalizeText {
  readonly id: string;
  readonly text: string;
}

let inFlight = 0;

export function resetSpacyClientInFlightForTests(): void {
  inFlight = 0;
}

export async function probeSpacySidecarHealth(
  config: NlpSidecarConfig = resolveNlpSidecarConfig(),
): Promise<boolean> {
  if (!config.enabled) {
    return false;
  }
  try {
    const status = await socketRequest({
      config,
      method: 'GET',
      path: '/health',
      body: null,
      countsForBackpressure: false,
    });
    return status.statusCode === 200 || status.statusCode === 204;
  } catch {
    return false;
  }
}

export async function normalizeWithSpacySidecar(
  locale: 'de' | 'en',
  texts: readonly SpacyNormalizeText[],
  config: NlpSidecarConfig = resolveNlpSidecarConfig(),
): Promise<SpacyNormalizeResponse> {
  if (!config.enabled) {
    throw new SpacyClientError('UNAVAILABLE');
  }
  if (texts.length === 0) {
    const modelId = wordCloudLemmaModelId(locale);
    if (!modelId) {
      throw new SpacyClientError('INVALID_RESPONSE');
    }
    return { locale, modelId, items: [] };
  }
  if (texts.some((item) => item.text.length > SPACY_MAX_TEXT_CHARS)) {
    throw new SpacyClientError('UNAVAILABLE');
  }

  const payload = Buffer.from(JSON.stringify({ locale, texts }), 'utf8');
  if (payload.byteLength > SPACY_MAX_REQUEST_BYTES) {
    throw new SpacyClientError('UNAVAILABLE');
  }

  const raw = await socketRequest({
    config,
    method: 'POST',
    path: '/normalize',
    body: payload,
    countsForBackpressure: true,
  });
  if (raw.statusCode === 503) {
    throw new SpacyClientError('UNAVAILABLE');
  }
  if (raw.statusCode !== 200) {
    throw new SpacyClientError('INVALID_RESPONSE');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.body.toString('utf8'));
  } catch {
    throw new SpacyClientError('INVALID_RESPONSE');
  }

  const result = SpacyNormalizeResponseSchema.safeParse(parsed);
  const expectedModelId = wordCloudLemmaModelId(locale);
  if (
    !result.success ||
    result.data.locale !== locale ||
    !expectedModelId ||
    result.data.modelId !== expectedModelId ||
    result.data.items.length !== texts.length
  ) {
    throw new SpacyClientError('INVALID_RESPONSE');
  }

  const expectedIds = new Set(texts.map((item) => item.id));
  const receivedIds = new Set(result.data.items.map((item) => item.id));
  if (
    expectedIds.size !== receivedIds.size ||
    [...expectedIds].some((id) => !receivedIds.has(id))
  ) {
    throw new SpacyClientError('INVALID_RESPONSE');
  }

  return result.data;
}

function messageFor(code: SpacyClientFailureCode): string {
  switch (code) {
    case 'TIMEOUT':
      return 'NLP-Sidecar hat das Zeitlimit überschritten';
    case 'INVALID_RESPONSE':
      return 'NLP-Sidecar lieferte eine ungültige Antwort';
    case 'BACKPRESSURE':
      return 'NLP-Sidecar ist ausgelastet';
    default:
      return 'NLP-Sidecar ist nicht erreichbar';
  }
}

function socketRequest(input: {
  readonly config: NlpSidecarConfig;
  readonly method: 'GET' | 'POST';
  readonly path: '/health' | '/normalize';
  readonly body: Buffer | null;
  readonly countsForBackpressure: boolean;
}): Promise<{ statusCode: number; body: Buffer }> {
  if (input.countsForBackpressure && inFlight >= SPACY_MAX_IN_FLIGHT) {
    return Promise.reject(new SpacyClientError('BACKPRESSURE'));
  }
  if (input.countsForBackpressure) {
    inFlight += 1;
  }

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
          if (bytes > SPACY_MAX_RESPONSE_BYTES) {
            response.destroy();
            finish(() => reject(new SpacyClientError('INVALID_RESPONSE')));
            return;
          }
          chunks.push(buffer);
        });
        response.once('error', () => finish(() => reject(new SpacyClientError('UNAVAILABLE'))));
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
      finish(() => reject(new SpacyClientError('TIMEOUT')));
    });
    request.once('error', (error: NodeJS.ErrnoException) => {
      if (error instanceof SpacyClientError) {
        finish(() => reject(error));
        return;
      }
      const timeoutError =
        error.code === 'TIMEOUT' ||
        error.message.includes('TIMEOUT') ||
        error.message.includes('Zeitlimit');
      finish(() => reject(new SpacyClientError(timeoutError ? 'TIMEOUT' : 'UNAVAILABLE')));
    });
    request.end(input.body);
  }).finally(() => {
    if (input.countsForBackpressure) {
      inFlight = Math.max(0, inFlight - 1);
    }
  });
}
