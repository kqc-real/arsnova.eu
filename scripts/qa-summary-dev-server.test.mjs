import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertLoopbackHost,
  helpText,
  listenQaSummaryDevServer,
  parseQaSummaryInferenceRequest,
  resolveEffectiveQaSummaryDevMode,
  resolveGeminiGenerateUrl,
  resolveHelperInferenceTimeoutMs,
  sanitizeQaSummaryModelOutput,
  summarizeExtractive,
  summarizeWithGemini,
  withExtractiveFallback,
  buildGeminiPrompt,
} from './qa-summary-dev-server.mjs';

const SOURCE_A = 'qa-question:11111111-1111-4111-8111-111111111111';
const SOURCE_B = 'qa-question:22222222-2222-4222-8222-222222222222';
const HASH = 'a'.repeat(64);

const sampleRequest = {
  locale: 'de',
  snapshotHash: HASH,
  sources: [
    { id: SOURCE_A, kind: 'qa-question', text: 'Kommt Kapitel 4 in der Klausur vor?' },
    { id: SOURCE_B, kind: 'qa-question', text: 'Gibt es eine Formelsammlung?' },
  ],
};

test('assertLoopbackHost lehnt 0.0.0.0 ab', () => {
  assert.equal(assertLoopbackHost('127.0.0.1'), '127.0.0.1');
  assert.throws(() => assertLoopbackHost('0.0.0.0'), /Loopback/);
  assert.throws(() => assertLoopbackHost('generativelanguage.googleapis.com'), /Loopback/);
});

test('auto-Modus bleibt extraktiv ohne Gemini-Key', () => {
  assert.equal(resolveEffectiveQaSummaryDevMode({ QA_SUMMARY_DEV_MODE: 'auto' }), 'extractive');
  assert.equal(
    resolveEffectiveQaSummaryDevMode({
      QA_SUMMARY_DEV_MODE: 'auto',
      GEMINI_API_KEY: 'secret',
    }),
    'gemini',
  );
  assert.equal(
    resolveEffectiveQaSummaryDevMode({
      QA_SUMMARY_DEV_MODE: 'extractive',
      GEMINI_API_KEY: 'secret',
    }),
    'extractive',
  );
});

test('parseQaSummaryInferenceRequest lehnt SaaS-fremde Payloads und ungültige Locales ab', () => {
  assert.equal(parseQaSummaryInferenceRequest(null).ok, false);
  assert.equal(parseQaSummaryInferenceRequest({ ...sampleRequest, locale: 'nl' }).ok, false);
  assert.equal(
    parseQaSummaryInferenceRequest({
      ...sampleRequest,
      sources: [{ id: SOURCE_A, kind: 'comment', text: 'x' }],
    }).ok,
    false,
  );
  assert.equal(parseQaSummaryInferenceRequest(sampleRequest).ok, true);
});

test('Gemini-Prompt verlangt Streuung, ready als Default und scanbare Stichpunkte', () => {
  const prompt = buildGeminiPrompt(sampleRequest);
  assert.match(prompt, /status MUST be ready when sources exist/);
  assert.match(prompt, /topic is 1-4 words/);
  assert.match(prompt, /Order bullets by host importance/);
  assert.match(prompt, /Never end a clause/);
  assert.match(prompt, /Attach every listed sourceId/);
  assert.match(prompt, /2 to 4 scan bullets/);
  assert.match(prompt, /Forbidden phrasing/);
});

test('summarizeExtractive bindet nur vorhandene Quellen', () => {
  const output = summarizeExtractive(sampleRequest);
  assert.equal(output.status, 'ready');
  assert.equal(output.modelVersion, 'local-extractive');
  assert.ok(output.statements.length >= 2);
  for (const statement of [...output.statements, ...output.suggestedNextSteps]) {
    assert.ok(statement.sourceIds.every((id) => id === SOURCE_A || id === SOURCE_B));
    assert.match(statement.text, /Kapitel 4|Formelsammlung/);
  }
});

test('summarizeExtractive bleibt ohne Quellen unsicher', () => {
  const output = summarizeExtractive({ locale: 'en', snapshotHash: HASH, sources: [] });
  assert.equal(output.status, 'uncertain');
  assert.equal(output.statements.length, 0);
  assert.match(output.limitations[0] ?? '', /No Q&A sources/);
});

test('sanitizeQaSummaryModelOutput verwirft erfundene Quellen-IDs', () => {
  const output = sanitizeQaSummaryModelOutput(
    {
      status: 'ready',
      statements: [
        { text: 'Erfunden.', sourceIds: ['qa-question:00000000-0000-4000-8000-000000000000'] },
        { text: 'Belegt.', sourceIds: [SOURCE_A] },
      ],
      suggestedNextSteps: [],
      limitations: [],
    },
    new Set([SOURCE_A]),
    'test',
  );
  assert.equal(output.status, 'ready');
  assert.deepEqual(output.statements, [{ text: 'Belegt.', sourceIds: [SOURCE_A] }]);
});

test('sanitizeQaSummaryModelOutput macht belegte Aussagen ready statt uncertain', () => {
  const output = sanitizeQaSummaryModelOutput(
    {
      status: 'uncertain',
      statements: [{ text: 'Klausurfragen häufen sich.', sourceIds: [SOURCE_A] }],
      suggestedNextSteps: [],
      limitations: ['Nur Q&A-Quellen.'],
    },
    new Set([SOURCE_A]),
    'test',
  );
  assert.equal(output.status, 'ready');
  assert.deepEqual(output.statements, [
    { text: 'Klausurfragen häufen sich.', sourceIds: [SOURCE_A] },
  ]);
});

test('sanitizeQaSummaryModelOutput ergaenzt das qa-question-Praefix', () => {
  const output = sanitizeQaSummaryModelOutput(
    {
      status: 'ready',
      statements: [
        {
          text: 'Belegt ohne Prefix.',
          sourceIds: ['11111111-1111-4111-8111-111111111111'],
        },
      ],
      suggestedNextSteps: [],
      limitations: [],
    },
    new Set([SOURCE_A]),
    'test',
  );
  assert.equal(output.status, 'ready');
  assert.deepEqual(output.statements, [{ text: 'Belegt ohne Prefix.', sourceIds: [SOURCE_A] }]);
});

test('sanitizeQaSummaryModelOutput setzt topic und clause zu einem Stichpunkt', () => {
  const output = sanitizeQaSummaryModelOutput(
    {
      status: 'ready',
      statements: [
        { topic: 'Median', clause: 'Formel und Berechnung sind unklar.', sourceIds: [SOURCE_A] },
      ],
      suggestedNextSteps: [],
      limitations: [],
    },
    new Set([SOURCE_A]),
    'test',
  );
  assert.equal(output.status, 'ready');
  assert.deepEqual(output.statements, [
    { text: 'Median: Formel und Berechnung sind unklar.', sourceIds: [SOURCE_A] },
  ]);
});

test('HTTP /summary spricht den Adapter-Vertrag auf Loopback', async () => {
  const { server, host, port } = await listenQaSummaryDevServer({
    host: '127.0.0.1',
    port: 0,
    mode: 'extractive',
    summarizeExtractive,
    summarizeGemini: async () => {
      throw new Error('Gemini darf im extraktiven Test nicht laufen');
    },
  });
  try {
    const health = await fetch(`http://${host}:${port}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).mode, 'extractive');

    const response = await fetch(`http://${host}:${port}/summary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sampleRequest),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ready');
    assert.ok(body.statements[0].sourceIds.includes(SOURCE_A));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('HTTP /summary verlangt Bearer wenn ein Token konfiguriert ist', async () => {
  const { server, host, port } = await listenQaSummaryDevServer({
    host: '127.0.0.1',
    port: 0,
    mode: 'extractive',
    expectedToken: 'dev-token',
    summarizeExtractive,
    summarizeGemini: async () => {
      throw new Error('Gemini darf im Token-Test nicht laufen');
    },
  });
  try {
    const denied = await fetch(`http://${host}:${port}/summary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sampleRequest),
    });
    assert.equal(denied.status, 401);

    const allowed = await fetch(`http://${host}:${port}/summary`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer dev-token',
      },
      body: JSON.stringify(sampleRequest),
    });
    assert.equal(allowed.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Gemini-Pfad nutzt Header-Key und unser JSON, nicht die Gemini-URL als Inference-Host', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    status: 'ready',
                    statements: [{ text: 'Zwei Fragen zur Klausur.', sourceIds: [SOURCE_A] }],
                    suggestedNextSteps: [],
                    limitations: ['Testdaten.'],
                  }),
                },
              ],
            },
          },
        ],
      }),
    };
  };

  const output = await summarizeWithGemini(sampleRequest, {
    apiKey: 'test-key',
    model: 'gemini-3.5-flash-lite',
    fetchImpl,
  });
  assert.equal(output.status, 'ready');
  assert.equal(output.modelVersion, 'gemini:gemini-3.5-flash-lite');
  assert.deepEqual(output.statements[0].sourceIds, [SOURCE_A]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, resolveGeminiGenerateUrl('gemini-3.5-flash-lite'));
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'test-key');
  assert.doesNotMatch(calls[0].url, /test-key/);
  const geminiBody = JSON.parse(calls[0].init.body);
  assert.match(geminiBody.contents[0].parts[0].text, /Kapitel 4/);
  assert.equal(geminiBody.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
  assert.equal(geminiBody.generationConfig.responseMimeType, 'application/json');
  assert.equal(geminiBody.generationConfig.responseSchema, undefined);
  assert.equal(geminiBody.systemInstruction, undefined);
});

test('Gemini-404 erklärt ein abgekündigtes Modell', async () => {
  const output = await summarizeWithGemini(sampleRequest, {
    apiKey: 'test-key',
    model: 'gemini-2.5-flash',
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      json: async () => ({
        error: {
          message:
            'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash',
          status: 'NOT_FOUND',
        },
      }),
    }),
  });
  assert.equal(output.status, 'failed');
  assert.match(output.limitations[0] ?? '', /Modell nicht verfügbar/);
  assert.match(output.limitations[0] ?? '', /gemini-3\.5-flash-lite/);
  assert.equal(output.modelVersion, 'gemini:gemini-2.5-flash:http-404');
});

test('Helper-Timeout liegt unter dem Backend-Timeout', () => {
  assert.equal(resolveHelperInferenceTimeoutMs('30000'), 25_000);
  assert.equal(resolveHelperInferenceTimeoutMs(undefined), 3_000);
  assert.equal(resolveHelperInferenceTimeoutMs('8000'), 3_000);
  assert.equal(resolveHelperInferenceTimeoutMs('2000'), 1_800);
  assert.equal(resolveHelperInferenceTimeoutMs('500'), 300);
});

test('withExtractiveFallback liefert lokale Kurzfassung wenn Gemini failed', () => {
  const output = withExtractiveFallback(sampleRequest, {
    status: 'failed',
    statements: [],
    suggestedNextSteps: [],
    limitations: ['Gemini hat zu lange gedauert.'],
    modelVersion: 'gemini:gemini-3.5-flash-lite:timeout',
  });
  assert.equal(output.status, 'ready');
  assert.ok(output.statements.length >= 1);
  assert.match(output.modelVersion, /extractive/);
  assert.match(output.limitations.join(' '), /lokale Kurzfassung/);
});

test('withExtractiveFallback behält die Gemini-Ursache neben der lokalen Kurzfassung', () => {
  const output = withExtractiveFallback(sampleRequest, {
    status: 'failed',
    statements: [],
    suggestedNextSteps: [],
    limitations: ['Gemini hat den API-Key abgelehnt.'],
    modelVersion: 'gemini:gemini-3.5-flash-lite:http-403',
  });
  assert.equal(output.status, 'ready');
  assert.match(output.limitations.join(' '), /API-Key abgelehnt/);
  assert.match(output.limitations.join(' '), /Lokale Kurzfassung/);
  assert.doesNotMatch(output.limitations.join(' '), /nicht rechtzeitig/);
});

test('--help nennt Loopback-URL und optionalen Gemini-Key', () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'qa-summary-dev-server.mjs');
  const result = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /127\.0\.0\.1:8787\/summary/);
  assert.match(result.stdout, /GEMINI_API_KEY/);
  assert.match(result.stdout, /QA_SUMMARY_INFERENCE_URL/);
  assert.match(helpText(), /nicht Produktion/);
});
