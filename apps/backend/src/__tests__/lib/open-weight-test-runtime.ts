/**
 * In-Prozess-Test-Runtime für die Ende-zu-Ende-Suiten der Q&A-Zusammenfassung.
 *
 * Ein echter `node:http`-Server auf 127.0.0.1 mit freiem Port bildet die zwei
 * Endpunkte nach, die der Open-Weight-Client von llama-server nutzt:
 * `GET /slots?fail_on_no_slot=1` und `POST /v1/chat/completions`. Er speichert
 * Methode, Pfad, Header und die **rohen Bytes** des Bodys, so wie sie über den
 * Socket ankommen. Die Runtime ist kein Modell; sie antwortet mit einer festen,
 * vertragsgültigen Ausgabe und dient nur der Fehlereinspeisung und kontrollierten
 * Varianten.
 *
 * Zusätzlich bildet sie den Legacy-Text-Vertrag nach (`QA_SUMMARY_INFERENCE_URL`,
 * `qaSummaryAdapter.ts`): `POST` auf {@link TEST_RUNTIME_LEGACY_PATH} mit einem
 * `QaSummaryInferenceRequest` als Body, Antwort ist direkt eine `QaSummaryModelOutput`.
 */
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
  QA_SUMMARY_V2_SCHEMA_VERSION,
  type QaSummaryModelOutput,
} from '@arsnova/shared-types';
import { vi } from 'vitest';

/** Synthetisches Bearer-Token (32+ URL-sichere Zeichen), nur für Tests. */
export const TEST_RUNTIME_TOKEN = 'e2e-test-runtime-token-0123456789abcdef';
/**
 * Erkennungszeichen der beiden Modellaussagen der Test-Runtime. Seit upstream `96b2e46e`
 * verwirft das Quality-Gate (`hasAcceptableQaSummaryQuality`) Antworten mit weniger als
 * zwei Aussagen oder ohne verschiedene Leads in der Form „Lead: Text“ als
 * `invalid_response`; beide Texte erfüllen diese Form.
 */
export const TEST_RUNTIME_STATEMENT_TEXT =
  'Testlauf: Aussage der Test-Runtime zur ersten gepackten Frage.';
export const TEST_RUNTIME_SECOND_STATEMENT_TEXT =
  'Gegenprobe: Zweite Aussage der Test-Runtime zur ersten gepackten Frage.';
export const TEST_RUNTIME_STATEMENT_TEXTS = [
  TEST_RUNTIME_STATEMENT_TEXT,
  TEST_RUNTIME_SECOND_STATEMENT_TEXT,
] as const;
export const TEST_RUNTIME_MODEL_VERSION = 'e2e-test-runtime';
/** Pfad des Legacy-Text-Endpunkts; die volle URL kommt nach `QA_SUMMARY_INFERENCE_URL`. */
export const TEST_RUNTIME_LEGACY_PATH = '/legacy/qa-summary';
/** Erkennungszeichen der beiden Legacy-Aussagen der Test-Runtime (Form wie oben). */
export const TEST_RUNTIME_LEGACY_STATEMENT_TEXT =
  'Legacy-Testlauf: Aussage der Test-Runtime zur ersten gesendeten Quelle.';
export const TEST_RUNTIME_LEGACY_SECOND_STATEMENT_TEXT =
  'Legacy-Gegenprobe: Zweite Aussage der Test-Runtime zur ersten gesendeten Quelle.';
export const TEST_RUNTIME_LEGACY_STATEMENT_TEXTS = [
  TEST_RUNTIME_LEGACY_STATEMENT_TEXT,
  TEST_RUNTIME_LEGACY_SECOND_STATEMENT_TEXT,
] as const;

export type RecordedRuntimeRequest = {
  readonly method: string;
  readonly path: string;
  readonly headers: IncomingHttpHeaders;
  /** Rohe Bytes des empfangenen Bodys, UTF-8-dekodiert, ohne erneute Serialisierung. */
  readonly rawBody: string;
};

export type TestRuntimeOptions = {
  /** HTTP-Status für `GET /slots?fail_on_no_slot=1` (Standard 200; 503 = Slot belegt). */
  readonly slotsStatus?: number;
  /** Verzögerung vor der Antwort auf `POST /v1/chat/completions`. */
  readonly delayMs?: number;
  /** Latch: die Completion-Antwort wartet, bis dieses Promise erfüllt ist. */
  readonly hold?: Promise<void>;
  /** Aktion nach Empfang und vor der Antwort, z. B. eine DB-Änderung. */
  readonly beforeRespond?: (body: string) => Promise<void>;
  /** Ersetzt die Standardantwort der Completion. */
  readonly respond?: (body: string) => { status: number; body: string };
  /**
   * Ersetzt die Standardantwort des Legacy-Endpunkts (Status 200, Body = JSON dieser
   * `QaSummaryModelOutput`). Standard: {@link defaultLegacyOutput}.
   */
  readonly legacyOutput?: (body: string) => QaSummaryModelOutput;
  /**
   * Zusätzliche `GET`-Endpunkte (Pfad → Antwort), z. B. `/props` oder `/v1/models`
   * für Trockenläufe der Laborharness. Ohne Eintrag antwortet ein `GET` mit 404.
   */
  readonly getRoutes?: Readonly<Record<string, { readonly status: number; readonly body: string }>>;
};

export type TestRuntime = {
  readonly baseUrl: string;
  readonly requests: RecordedRuntimeRequest[];
  /**
   * Erfüllt, sobald der erste `POST /v1/chat/completions` (bzw. Legacy-`POST`)
   * vollständig empfangen ist.
   */
  readonly received: Promise<void>;
  close(): Promise<void>;
};

type ChatBody = { messages?: { role?: string; content?: string }[] };

/** Die User-Nachricht (fachlicher Kontext) aus einem rohen Completion-Body. */
export function userMessageOf(rawBody: string): string {
  const parsed = JSON.parse(rawBody) as ChatBody;
  const user = parsed.messages?.find((message) => message.role === 'user');
  if (typeof user?.content !== 'string') throw new Error('Body enthält keine User-Nachricht');
  return user.content;
}

/** Erste `qa-question:`-Quelle in der Reihenfolge der gesendeten Quellenliste. */
export function firstQaQuestionSourceId(rawBody: string): string {
  const context = JSON.parse(userMessageOf(rawBody)) as {
    sources?: { id?: string; kind?: string }[];
  };
  const source = context.sources?.find((item) => item.kind === 'qa-question');
  if (!source?.id) throw new Error('Kontext enthält keine qa-question-Quelle');
  return source.id;
}

/**
 * Gültige `QaSummaryModelOutputV2` im Antwortformat des Clients (Status `ready`):
 * zwei Aussagen, beide an die erste gesendete `qa-question`-Quelle gebunden.
 */
export function defaultCompletionBody(rawBody: string): string {
  const sourceId = firstQaQuestionSourceId(rawBody);
  const content = {
    schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
    taskType: 'qa_summary',
    outputContract: QA_SUMMARY_MODEL_OUTPUT_V2_CONTRACT_VERSION,
    output: {
      status: 'ready',
      statements: TEST_RUNTIME_STATEMENT_TEXTS.map((text) => ({ text, sourceIds: [sourceId] })),
      suggestedNextSteps: [],
      limitations: [],
      modelVersion: TEST_RUNTIME_MODEL_VERSION,
    },
  };
  return completionEnvelope(JSON.stringify(content));
}

/** Quellen-IDs eines rohen Legacy-Bodys (`QaSummaryInferenceRequest`) in Sendereihenfolge. */
export function legacySourceIdsOf(rawBody: string): string[] {
  const parsed = JSON.parse(rawBody) as { sources?: { id?: string }[] };
  const ids = (parsed.sources ?? []).map((source) => source.id);
  if (ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
    throw new Error('Legacy-Body enthält keine Quellen');
  }
  return ids as string[];
}

/** Gültige Legacy-`QaSummaryModelOutput` (Status `ready`): zwei Aussagen zur ersten gesendeten Quelle. */
export function defaultLegacyOutput(rawBody: string): QaSummaryModelOutput {
  const sourceId = legacySourceIdsOf(rawBody)[0]!;
  return {
    status: 'ready',
    statements: TEST_RUNTIME_LEGACY_STATEMENT_TEXTS.map((text) => ({
      text,
      sourceIds: [sourceId],
    })),
    suggestedNextSteps: [],
    limitations: [],
    modelVersion: TEST_RUNTIME_MODEL_VERSION,
  };
}

export function completionEnvelope(content: string): string {
  return JSON.stringify({
    model: TEST_RUNTIME_MODEL_VERSION,
    choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }],
  });
}

/**
 * Wie {@link defaultCompletionBody}, zusätzlich mit `usage`, `timings` und
 * `system_fingerprint` in der Form, die llama-server b10524 liefert
 * (`docs/features/open-weight-llm-runtime.md`, protokollierte Modellprüfung).
 * **Alle Zahlen sind künstlich:** Die Test-Runtime hat keinen Tokenizer und kein
 * Modell. `prompt_tokens` ist ein Viertel der UTF-8-Bytes aller Nachrichteninhalte
 * (aufgerundet), die Zeiten teilen `delayMs` im Verhältnis 4 : 1 auf. Nur für
 * Trockenläufe von Messwerkzeugen, nie als Evidenz.
 */
export function defaultCompletionBodyWithUsage(rawBody: string, delayMs: number): string {
  const envelope = JSON.parse(defaultCompletionBody(rawBody)) as {
    choices: { message: { content: string } }[];
  };
  const parsed = JSON.parse(rawBody) as ChatBody;
  const messageBytes = (parsed.messages ?? []).reduce(
    (sum, message) => sum + Buffer.byteLength(message.content ?? '', 'utf8'),
    0,
  );
  const promptTokens = Math.ceil(messageBytes / 4);
  const completionTokens = Math.ceil(
    Buffer.byteLength(envelope.choices[0]!.message.content, 'utf8') / 4,
  );
  return JSON.stringify({
    ...envelope,
    system_fingerprint: TEST_RUNTIME_MODEL_VERSION,
    usage: {
      completion_tokens: completionTokens,
      prompt_tokens: promptTokens,
      total_tokens: promptTokens + completionTokens,
      prompt_tokens_details: { cached_tokens: 0 },
    },
    timings: {
      cache_n: 0,
      prompt_n: promptTokens,
      prompt_ms: delayMs * 0.8,
      predicted_n: completionTokens,
      predicted_ms: delayMs * 0.2,
    },
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startTestRuntime(options: TestRuntimeOptions = {}): Promise<TestRuntime> {
  const requests: RecordedRuntimeRequest[] = [];
  let markReceived: () => void = () => undefined;
  const received = new Promise<void>((resolve) => {
    markReceived = resolve;
  });

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const path = req.url ?? '';
      requests.push({ method: req.method ?? '', path, headers: req.headers, rawBody });
      void (async () => {
        if (req.method === 'GET' && path === '/slots?fail_on_no_slot=1') {
          const slotsStatus = options.slotsStatus ?? 200;
          res.writeHead(slotsStatus, { 'content-type': 'application/json' });
          res.end(
            slotsStatus === 200
              ? '[]'
              : '{"error":{"code":503,"message":"no slot available","type":"unavailable_error"}}',
          );
          return;
        }
        const getRoute = req.method === 'GET' ? options.getRoutes?.[path] : undefined;
        if (getRoute) {
          res.writeHead(getRoute.status, { 'content-type': 'application/json' });
          res.end(getRoute.body);
          return;
        }
        if (req.method === 'POST' && path === TEST_RUNTIME_LEGACY_PATH) {
          markReceived();
          if (options.hold) await options.hold;
          if (options.beforeRespond) await options.beforeRespond(rawBody);
          const output = (options.legacyOutput ?? defaultLegacyOutput)(rawBody);
          if (res.destroyed) return;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(output));
          return;
        }
        if (req.method !== 'POST' || path !== '/v1/chat/completions') {
          res.writeHead(404).end();
          return;
        }
        markReceived();
        if (options.hold) await options.hold;
        if (options.delayMs) await wait(options.delayMs);
        if (options.beforeRespond) await options.beforeRespond(rawBody);
        const response = options.respond
          ? options.respond(rawBody)
          : { status: 200, body: defaultCompletionBody(rawBody) };
        if (res.destroyed) return;
        res.writeHead(response.status, { 'content-type': 'application/json' });
        res.end(response.body);
      })().catch((error: unknown) => {
        if (!res.destroyed) res.writeHead(500).end(String(error));
      });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** Freier Port, auf dem garantiert niemand lauscht (Server gestartet und wieder geschlossen). */
export async function closedLoopbackUrl(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${port}`;
}

/** Env für den echten Full-Context-Pfad gegen die Test-Runtime (per `vi.stubEnv`). */
export function useTestRuntimeEnv(
  runtime: Pick<TestRuntime, 'baseUrl'>,
  overrides: Readonly<Record<string, string>> = {},
): void {
  vi.stubEnv('OPEN_WEIGHT_LLM_ENABLED', 'true');
  vi.stubEnv('OPEN_WEIGHT_LLM_URL', runtime.baseUrl);
  vi.stubEnv('OPEN_WEIGHT_LLM_TOKEN', TEST_RUNTIME_TOKEN);
  vi.stubEnv('QA_SUMMARY_ENABLED', 'true');
  vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'false');
  // Zeitgrenzen explizit auf die Code-Standardwerte (90 s), damit Fälle mit
  // eigenem Timeout nicht von der Entwicklerumgebung abhängen.
  vi.stubEnv('QA_SUMMARY_TIMEOUT_MS', '90000');
  vi.stubEnv('OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS', '90000');
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
}

/**
 * Env für den Legacy-Text-Pfad gegen die Test-Runtime: Open-Weight aus,
 * `QA_SUMMARY_INFERENCE_URL` auf den Legacy-Endpunkt (per `vi.stubEnv`).
 */
export function useLegacyTestRuntimeEnv(
  runtime: Pick<TestRuntime, 'baseUrl'>,
  overrides: Readonly<Record<string, string>> = {},
): void {
  vi.stubEnv('OPEN_WEIGHT_LLM_ENABLED', 'false');
  vi.stubEnv('OPEN_WEIGHT_LLM_URL', '');
  vi.stubEnv('OPEN_WEIGHT_LLM_TOKEN', '');
  vi.stubEnv('QA_SUMMARY_ENABLED', 'true');
  vi.stubEnv('QA_SUMMARY_INFERENCE_URL', `${runtime.baseUrl}${TEST_RUNTIME_LEGACY_PATH}`);
  vi.stubEnv('QA_SUMMARY_INFERENCE_TOKEN', TEST_RUNTIME_TOKEN);
  vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'false');
  vi.stubEnv('QA_SUMMARY_TIMEOUT_MS', '90000');
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
}
