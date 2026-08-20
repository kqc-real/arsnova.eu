#!/usr/bin/env node
/**
 * Lokaler privater Inferenz-Helfer für Story 8.9c (nicht für Produktion).
 *
 * Spricht denselben Vertrag wie der Backend-Adapter:
 * POST /summary  QaSummaryInferenceRequest → QaSummaryModelOutput
 *
 * Standard: lokal-extraktiv, kein Cloud. Optional GEMINI_API_KEY: der Helfer
 * übersetzt nach Gemini; arsnova.eu spricht nur 127.0.0.1, nie Google.
 *
 *   npm run qa-summary:dev
 *   QA_SUMMARY_ENABLED=true
 *   QA_SUMMARY_INFERENCE_URL=http://127.0.0.1:8787/summary
 */
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const QA_SUMMARY_DEV_DEFAULT_PORT = 8787;
export const QA_SUMMARY_DEV_DEFAULT_HOST = '127.0.0.1';
export const QA_SUMMARY_DEV_MAX_BODY_BYTES = 65_536;
export const QA_SUMMARY_DEV_DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const QA_SUMMARY_DEV_LOCALES = Object.freeze(['de', 'en', 'fr', 'es', 'it']);

const LOCALES = new Set(QA_SUMMARY_DEV_LOCALES);
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

const COPY = {
  de: {
    asked: '',
    next: 'Als Nächstes: ',
    limitation: 'Nur sichtbare Q&A-Fragen, keine Teilnehmendenbewertung.',
    empty: 'Es liegen keine Q&A-Quellen vor.',
    quoteStart: '„',
    quoteEnd: '“',
  },
  en: {
    asked: '',
    next: 'Up next: ',
    limitation: 'Visible Q&A questions only; no participant evaluation.',
    empty: 'No Q&A sources are available.',
    quoteStart: '"',
    quoteEnd: '"',
  },
  fr: {
    asked: '',
    next: 'À suivre : ',
    limitation: 'Uniquement les questions Q&R visibles, sans évaluation des participant·e·s.',
    empty: 'Aucune source Q&R n’est disponible.',
    quoteStart: '« ',
    quoteEnd: ' »',
  },
  es: {
    asked: '',
    next: 'Lo siguiente: ',
    limitation: 'Solo preguntas de Q&A visibles; sin evaluación de participantes.',
    empty: 'No hay fuentes de Q&A.',
    quoteStart: '«',
    quoteEnd: '»',
  },
  it: {
    asked: '',
    next: 'A seguire: ',
    limitation: 'Solo domande Q&A visibili, nessuna valutazione delle persone partecipanti.',
    empty: 'Non ci sono fonti Q&A.',
    quoteStart: '«',
    quoteEnd: '»',
  },
};

export function loadDotEnvFile(filePath, env = process.env) {
  if (!existsSync(filePath)) return false;
  const text = readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (!key || env[key] !== undefined) continue;
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return true;
}

export function assertLoopbackHost(host) {
  const normalized = String(host ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (LOOPBACK_HOSTS.has(normalized)) return normalized;
  throw new Error('Der Dev-Server darf nur auf Loopback binden (127.0.0.1).');
}

export function resolveQaSummaryDevMode(env = process.env) {
  const configured = env['QA_SUMMARY_DEV_MODE']?.trim().toLowerCase();
  if (configured === 'extractive' || configured === 'gemini' || configured === 'auto') {
    return configured;
  }
  return 'auto';
}

export function resolveEffectiveQaSummaryDevMode(env = process.env) {
  const mode = resolveQaSummaryDevMode(env);
  const hasKey = Boolean(env['GEMINI_API_KEY']?.trim());
  if (mode === 'gemini') return 'gemini';
  if (mode === 'extractive') return 'extractive';
  return hasKey ? 'gemini' : 'extractive';
}

function clip(text, max) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function quoted(copy, prefix, text, max = 400) {
  const overhead = prefix.length + copy.quoteStart.length + copy.quoteEnd.length;
  const inner = clip(text, Math.max(8, max - overhead));
  return `${prefix}${copy.quoteStart}${inner}${copy.quoteEnd}`;
}

function parseSource(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const kind = raw.kind;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!id || id.length > 80) return null;
  if (kind !== 'qa-question') return null;
  if (!text || text.length > 500) return null;
  return { id, kind, text };
}

export function parseQaSummaryInferenceRequest(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'JSON-Objekt erwartet.' };
  }
  const locale = payload.locale;
  if (!LOCALES.has(locale)) {
    return { ok: false, error: 'locale muss de, en, fr, es oder it sein.' };
  }
  const snapshotHash = typeof payload.snapshotHash === 'string' ? payload.snapshotHash : '';
  if (!snapshotHash || snapshotHash.length > 64) {
    return { ok: false, error: 'snapshotHash ist ungültig.' };
  }
  if (!Array.isArray(payload.sources) || payload.sources.length > 40) {
    return { ok: false, error: 'sources muss ein Array mit höchstens 40 Einträgen sein.' };
  }
  const sources = [];
  for (const entry of payload.sources) {
    const parsed = parseSource(entry);
    if (!parsed) {
      return { ok: false, error: 'sources enthält einen ungültigen Eintrag.' };
    }
    sources.push(parsed);
  }
  return { ok: true, request: { locale, snapshotHash, sources } };
}

function resolveAllowedSourceId(rawId, allowedIds) {
  if (typeof rawId !== 'string') return null;
  const id = rawId.trim();
  if (!id) return null;
  if (allowedIds.has(id)) return id;
  const prefixed = id.startsWith('qa-question:') ? id : `qa-question:${id}`;
  return allowedIds.has(prefixed) ? prefixed : null;
}

function composeStatementText(statement) {
  const topic =
    typeof statement.topic === 'string' ? statement.topic.trim().replace(/:+$/g, '') : '';
  const clause = typeof statement.clause === 'string' ? statement.clause.trim() : '';
  if (topic && clause) {
    return `${topic}: ${clause}`;
  }
  return typeof statement.text === 'string' ? statement.text : '';
}

function bindStatement(statement, allowedIds) {
  if (!statement || typeof statement !== 'object') return null;
  const text = clip(composeStatementText(statement), 400);
  if (!text) return null;
  const rawIds = Array.isArray(statement.sourceIds) ? statement.sourceIds : [];
  const sourceIds = [
    ...new Set(rawIds.map((id) => resolveAllowedSourceId(id, allowedIds)).filter(Boolean)),
  ].slice(0, 8);
  if (sourceIds.length === 0) return null;
  return { text, sourceIds };
}

export function sanitizeQaSummaryModelOutput(output, allowedIds, modelVersion) {
  const statements = (Array.isArray(output?.statements) ? output.statements : [])
    .map((statement) => bindStatement(statement, allowedIds))
    .filter(Boolean)
    .slice(0, 6);
  const suggestedNextSteps = (
    Array.isArray(output?.suggestedNextSteps) ? output.suggestedNextSteps : []
  )
    .map((statement) => bindStatement(statement, allowedIds))
    .filter(Boolean)
    .slice(0, 4);
  const limitations = [
    ...new Set(
      (Array.isArray(output?.limitations) ? output.limitations : [])
        .map((item) => clip(typeof item === 'string' ? item : '', 280))
        .filter(Boolean),
    ),
  ].slice(0, 6);

  if (output?.status === 'failed') {
    return {
      status: 'failed',
      statements: [],
      suggestedNextSteps: [],
      limitations:
        limitations.length > 0 ? limitations : ['Die Zusammenfassung ist gerade nicht verfügbar.'],
      modelVersion,
    };
  }

  const status = statements.length === 0 ? 'uncertain' : 'ready';
  return {
    status,
    statements,
    suggestedNextSteps,
    limitations:
      status === 'uncertain' && limitations.length === 0
        ? ['Die Zusammenfassung ist unsicher.']
        : limitations,
    modelVersion,
  };
}

export function summarizeExtractive(request) {
  const copy = COPY[request.locale] ?? COPY.de;
  const modelVersion = 'local-extractive';
  if (request.sources.length === 0) {
    return {
      status: 'uncertain',
      statements: [],
      suggestedNextSteps: [],
      limitations: [copy.empty],
      modelVersion,
    };
  }

  const picked = request.sources.slice(0, 4);
  const statements = picked.map((source) => ({
    text: quoted(copy, copy.asked, source.text),
    sourceIds: [source.id],
  }));
  const first = picked[0];
  const suggestedNextSteps = first
    ? [{ text: quoted(copy, copy.next, first.text), sourceIds: [first.id] }]
    : [];

  return sanitizeQaSummaryModelOutput(
    {
      status: 'ready',
      statements,
      suggestedNextSteps,
      limitations: [copy.limitation],
    },
    new Set(request.sources.map((source) => source.id)),
    modelVersion,
  );
}

export function buildGeminiPrompt(request) {
  const lines = request.sources.map((source) => `- ${source.id}: ${source.text}`);
  return [
    'You brief the live-session host. They scan this in a few seconds during class.',
    `Write all statement and next-step texts in locale "${request.locale}".`,
    'Return JSON only with keys status, statements, suggestedNextSteps, limitations.',
    'status MUST be ready when sources exist and at least one statement cites a listed sourceId.',
    'status is uncertain only when sources are empty or no statement can be grounded.',
    'status is failed only for a technical problem.',
    'Each statement and next step is { "topic": string, "clause": string, "sourceIds": string[] }.',
    'Use 2 to 4 scan bullets when sources exist. One lecture concern per bullet.',
    'Order bullets by host importance: first the theme backed by the earliest listed sources or the most sourceIds.',
    'topic is 1-4 words. clause is one complete concrete ask, at most 14 words. Never write a protocol sentence.',
    'Informal host voice (du / tu / tú / you). No protocol or essay tone.',
    'Forbidden phrasing: Es gibt, Zudem, Ein Studierender, Ein Teilnehmer, Teilnehmende erbitten, sowie+inklusive stacks, optimal integriert, participants request, furthermore it is asked, concrete inquiries.',
    'Never end a clause with und, oder, von, sowie, or a hanging comma. Do not mention individual students.',
    'Do not pack two topics into one bullet.',
    'Good (de): "Median: Formel und Berechnung sind unklar." / "Kapitel 4: Wiederholung und Klausurrelevanz." / "Übungen: Visualisierungen und Ergebnis-Check."',
    'Bad (de): "Es gibt konkrete Nachfragen zur Berechnung und zur Formel des Medians." / "Teilnehmende erbitten zusätzliches Anschauungsmaterial sowie eine Wiederholung von Kapitel 4 inklusive Klärung der Klausurrelevanz." / "Übungen: Planbarkeit bei den kommenden und."',
    'Next steps: 1-2 short imperatives, same Topic: clause pattern when useful.',
    'If many questions overlap, still return ready and summarize the dominant themes once.',
    'Attach every listed sourceId that supports the bullet, including the qa-question: prefix.',
    'Do not invent source IDs. Do not evaluate individual participants. Do not propose automated actions.',
    'If sources are empty, return status uncertain and no statements.',
    'Sources:',
    lines.length > 0 ? lines.join('\n') : '(none)',
  ].join('\n');
}

export function resolveGeminiGenerateUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

/** Helper must finish before the backend AbortSignal, otherwise the host sees stub:timeout. */
export function resolveHelperInferenceTimeoutMs(backendTimeoutMs, fallback = 8_000) {
  const parsed = Number.parseInt(String(backendTimeoutMs), 10);
  const backend = Number.isFinite(parsed) && parsed >= 500 ? parsed : fallback;
  const withLead = backend - 5_000;
  if (withLead >= 200) {
    return withLead;
  }
  return Math.max(100, backend - 200);
}

export function withExtractiveFallback(request, geminiOutput) {
  if (geminiOutput?.status !== 'failed') {
    return geminiOutput;
  }
  const extractive = summarizeExtractive(request);
  if (extractive.status !== 'ready') {
    return geminiOutput;
  }
  const original = (geminiOutput.limitations ?? [])
    .map((item) => String(item).trim())
    .filter(Boolean);
  const timedOut =
    /timeout/i.test(String(geminiOutput.modelVersion ?? '')) ||
    original.some((item) => /zu lange|timeout/i.test(item));
  const note = timedOut ? 'Modell nicht rechtzeitig; lokale Kurzfassung.' : 'Lokale Kurzfassung.';
  return {
    ...extractive,
    limitations: [...new Set([...original, note, ...(extractive.limitations ?? [])])].slice(0, 6),
    modelVersion: clip(`${geminiOutput.modelVersion ?? 'gemini'}+extractive`, 64),
  };
}

export function limitationFromGeminiHttpError(status, payload) {
  const message = typeof payload?.error?.message === 'string' ? payload.error.message : '';
  if (status === 401 || status === 403) {
    return 'Gemini hat den API-Key abgelehnt.';
  }
  if (status === 429) {
    return 'Gemini ist überlastet (Rate-Limit).';
  }
  if (status === 404 || /no longer available/i.test(message)) {
    return `Gemini-Modell nicht verfügbar. Aktuell: ${QA_SUMMARY_DEV_DEFAULT_GEMINI_MODEL}.`;
  }
  return 'Gemini hat die Anfrage abgelehnt.';
}

export async function summarizeWithGemini(request, options) {
  const apiKey = options.apiKey?.trim();
  const model = options.model?.trim() || QA_SUMMARY_DEV_DEFAULT_GEMINI_MODEL;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 3_000;
  const allowedIds = new Set(request.sources.map((source) => source.id));
  const modelVersion = `gemini:${clip(model, 48)}`;

  if (!apiKey) {
    return sanitizeQaSummaryModelOutput(
      {
        status: 'failed',
        statements: [],
        suggestedNextSteps: [],
        limitations: ['GEMINI_API_KEY fehlt für den Gemini-Modus.'],
      },
      allowedIds,
      modelVersion,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(resolveGeminiGenerateUrl(model), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildGeminiPrompt(request) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: 'MINIMAL' },
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
    return sanitizeQaSummaryModelOutput(
      {
        status: 'failed',
        statements: [],
        suggestedNextSteps: [],
        limitations: [
          timedOut ? 'Gemini hat zu lange gedauert.' : 'Gemini ist gerade nicht erreichbar.',
        ],
      },
      allowedIds,
      timedOut ? `${modelVersion}:timeout` : `${modelVersion}:error`,
    );
  } finally {
    clearTimeout(timer);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return sanitizeQaSummaryModelOutput(
      {
        status: 'failed',
        statements: [],
        suggestedNextSteps: [],
        limitations: [
          response.ok
            ? 'Gemini lieferte keine gültige JSON-Antwort.'
            : limitationFromGeminiHttpError(response.status, null),
        ],
      },
      allowedIds,
      response.ok ? `${modelVersion}:invalid` : `${modelVersion}:http-${response.status}`,
    );
  }

  if (!response.ok) {
    return sanitizeQaSummaryModelOutput(
      {
        status: 'failed',
        statements: [],
        suggestedNextSteps: [],
        limitations: [limitationFromGeminiHttpError(response.status, payload)],
      },
      allowedIds,
      `${modelVersion}:http-${response.status}`,
    );
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
  if (!text) {
    return sanitizeQaSummaryModelOutput(
      {
        status: 'failed',
        statements: [],
        suggestedNextSteps: [],
        limitations: ['Gemini lieferte keinen Text.'],
      },
      allowedIds,
      `${modelVersion}:empty`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return sanitizeQaSummaryModelOutput(
      {
        status: 'failed',
        statements: [],
        suggestedNextSteps: [],
        limitations: ['Gemini lieferte kein JSON-Objekt.'],
      },
      allowedIds,
      `${modelVersion}:invalid`,
    );
  }

  return sanitizeQaSummaryModelOutput(parsed, allowedIds, modelVersion);
}

export async function readJsonBody(request, maxBytes = QA_SUMMARY_DEV_MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('payload-too-large');
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  if (size === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function unauthorized(response) {
  sendJson(response, 401, {
    status: 'failed',
    statements: [],
    suggestedNextSteps: [],
    limitations: ['Unauthorized.'],
    modelVersion: 'local-dev:unauthorized',
  });
}

export async function handleQaSummaryDevRequest(request, response, options) {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { ok: true, mode: options.mode });
    return;
  }
  if (request.method !== 'POST' || url.pathname !== '/summary') {
    sendJson(response, 404, { error: 'Not Found' });
    return;
  }

  const expectedToken = options.expectedToken?.trim();
  if (expectedToken) {
    const header = request.headers.authorization ?? '';
    if (header !== `Bearer ${expectedToken}`) {
      unauthorized(response);
      return;
    }
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    if (error instanceof Error && error.code === 'PAYLOAD_TOO_LARGE') {
      sendJson(response, 413, { error: 'Payload too large' });
      return;
    }
    sendJson(response, 400, { error: 'JSON erwartet.' });
    return;
  }

  const parsed = parseQaSummaryInferenceRequest(payload);
  if (!parsed.ok) {
    sendJson(response, 400, { error: parsed.error });
    return;
  }

  let output =
    options.mode === 'gemini'
      ? await options.summarizeGemini(parsed.request)
      : options.summarizeExtractive(parsed.request);
  if (options.mode === 'gemini') {
    output = withExtractiveFallback(parsed.request, output);
  }
  sendJson(response, 200, output);
}

export function createQaSummaryDevServer(options) {
  const host = assertLoopbackHost(options.host ?? QA_SUMMARY_DEV_DEFAULT_HOST);
  const server = createServer((request, response) => {
    void handleQaSummaryDevRequest(request, response, options).catch(() => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: 'Interner Fehler.' });
      } else {
        response.end();
      }
    });
  });
  return { server, host };
}

export function listenQaSummaryDevServer(options) {
  const { server, host } = createQaSummaryDevServer(options);
  const port = options.port ?? 0;
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Serveradresse unbekannt.'));
        return;
      }
      resolve({ server, host, port: address.port });
    });
  });
}

export function helpText() {
  return `Lokaler 8.9c-Inferenzhelfer (nur Loopback, nicht Produktion)

Nutzung:
  npm run qa-summary:dev
  npm run dev:qa-summary

Backend (.env, nicht Produktion):
  QA_SUMMARY_ENABLED=true
  QA_SUMMARY_INFERENCE_URL=http://127.0.0.1:${QA_SUMMARY_DEV_DEFAULT_PORT}/summary

Optional Gemini (Key nur im Helfer, nie als QA_SUMMARY_INFERENCE_URL):
  GEMINI_API_KEY=...
  GEMINI_MODEL=${QA_SUMMARY_DEV_DEFAULT_GEMINI_MODEL}
  QA_SUMMARY_DEV_MODE=auto|extractive|gemini

Ohne Key bleibt der Helfer lokal-extraktiv. Q&A-Texte verlassen den Rechner nur mit Gemini-Key.
`;
}

function writeLine(text) {
  process.stdout.write(`${text}\n`);
}

async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes('--help') || argv.includes('-h')) {
    writeLine(helpText());
    return 0;
  }

  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  loadDotEnvFile(path.join(repoRoot, '.env'), env);

  const host = assertLoopbackHost(env['QA_SUMMARY_DEV_HOST'] || QA_SUMMARY_DEV_DEFAULT_HOST);
  const port = Number.parseInt(
    String(env['QA_SUMMARY_DEV_PORT'] || QA_SUMMARY_DEV_DEFAULT_PORT),
    10,
  );
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('QA_SUMMARY_DEV_PORT ist ungültig.');
  }

  const mode = resolveEffectiveQaSummaryDevMode(env);
  if (mode === 'gemini') {
    process.stderr.write(
      'Warnung: GEMINI_API_KEY gesetzt — Q&A-Texte gehen an Google Gemini (nur dieser lokale Helfer).\n',
    );
  }

  const geminiTimeoutMs = resolveHelperInferenceTimeoutMs(env['QA_SUMMARY_TIMEOUT_MS']);
  const { server, port: boundPort } = await listenQaSummaryDevServer({
    host,
    port,
    mode,
    expectedToken: env['QA_SUMMARY_INFERENCE_TOKEN'],
    summarizeExtractive,
    summarizeGemini: (request) =>
      summarizeWithGemini(request, {
        apiKey: env['GEMINI_API_KEY'],
        model: env['GEMINI_MODEL'],
        timeoutMs: Number.isFinite(geminiTimeoutMs) ? geminiTimeoutMs : 3_000,
      }),
  });

  writeLine(`qa-summary-dev lauscht auf http://${host}:${boundPort}/summary (mode=${mode})`);
  writeLine('Backend braucht QA_SUMMARY_ENABLED=true und QA_SUMMARY_INFERENCE_URL auf diese URL.');

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return undefined;
}

function isMainModule() {
  const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
  return import.meta.url === entry;
}

if (isMainModule()) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  });
}
