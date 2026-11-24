import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const origin = new URL(process.env.OPEN_WEIGHT_LLM_BENCH_URL ?? 'http://127.0.0.1:18080');
const token = process.env.OPEN_WEIGHT_LLM_TOKEN;
const rounds = Number(process.env.OPEN_WEIGHT_LLM_BENCH_ROUNDS ?? 4);
const targeted = process.env.OPEN_WEIGHT_LLM_BENCH_CANCEL_MODE !== 'connection';
assert.ok(token, 'Set OPEN_WEIGHT_LLM_TOKEN to the dedicated test runtime credential');
assert.ok(Number.isSafeInteger(rounds) && rounds >= 0);
assert.ok(['http:', 'https:'].includes(origin.protocol));
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const cancelPath = '/internal/arsnova/cancel';
const chatPath = '/v1/chat/completions';
const expected = { topic_label: 'label', qa_summary: 'topics', learning_objectives: 'objectives' };
const requests = {
  topic_label: readFixture('topic-label-reproduction-request.json'),
  ...readFixture('cancellation-load-requests.json'),
};

function readFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

function post(path, body, signal, customHeaders = headers) {
  return fetch(new URL(path, origin), {
    method: 'POST',
    headers: customHeaders,
    body: JSON.stringify(body),
    signal,
  });
}

function postCompletion(body, inferenceId, signal = AbortSignal.timeout(120_000)) {
  return post(chatPath, { ...body, seed: 42 }, signal, {
    ...headers,
    'x-arsnova-inference-id': inferenceId,
  });
}

async function cancel(inferenceId, expectedStatus) {
  const response = await post(cancelPath, { inferenceId }, AbortSignal.timeout(5_000));
  assert.equal(response.status, 200);
  const { status } = await response.json();
  if (expectedStatus) assert.equal(status, expectedStatus);
  return status;
}

async function readSlot() {
  const response = await fetch(new URL('/slots', origin), {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(response.status, 200);
  const slots = await response.json();
  assert.equal(slots.length, 1, 'This benchmark needs a dedicated one-slot runtime');
  return slots[0];
}

async function untilSlot(predicate, intervalMs, timeoutMs = 60_000) {
  const deadline = performance.now() + timeoutMs;
  do {
    const slot = await readSlot();
    if (predicate(slot)) return slot;
    await delay(intervalMs);
  } while (performance.now() < deadline);
  throw new Error('Timed out waiting for model slot state');
}

async function complete(task, body) {
  const started = performance.now();
  const response = await postCompletion(body, randomUUID());
  assert.equal(response.status, 200);
  const result = await response.json();
  const content = JSON.parse(result.choices[0].message.content);
  assert.ok(Object.hasOwn(content, expected[task]));
  assert.ok(result.usage.completion_tokens > 0);
  return {
    task,
    elapsedMs: performance.now() - started,
    promptTokens: result.usage.prompt_tokens,
    outputTokens: result.usage.completion_tokens,
    outputTokensPerSecond: result.timings?.predicted_per_second,
    outputSha256: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
  };
}

async function verifyControlAuthorization() {
  const missingAuth = await post(
    cancelPath,
    { inferenceId: randomUUID() },
    AbortSignal.timeout(5_000),
    { 'content-type': 'application/json' },
  );
  assert.equal(missingAuth.status, 401);
  await missingAuth.arrayBuffer();
  const invalid = await post(cancelPath, { inferenceId: 0 }, AbortSignal.timeout(5_000));
  assert.equal(invalid.status, 400);
  await invalid.arrayBuffer();
  await cancel(randomUUID(), 'unknown');
}

async function measureCancellation(phase, previousId) {
  const idle = await readSlot();
  assert.equal(idle.is_processing, false);
  const body = structuredClone(requests.learning_objectives);
  body.cache_prompt = false;
  if (phase === 'prefill') {
    const notes = 'Die fiktive Messreihe enthält nummerierte und aufsteigend sortierte Zeitwerte. ';
    body.messages[0].content += `\n\nTestkontext. ${notes.repeat(65)}`;
  }

  const inferenceId = randomUUID();
  const controller = new AbortController();
  const completionSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]);
  const pending = postCompletion(body, inferenceId, completionSignal).then(
    async (response) => ({ status: response.status, body: await response.json() }),
    (error) => ({ error: error.name }),
  );
  try {
    const active = await untilSlot((slot) => {
      if (!slot.is_processing || slot.id_task === idle.id_task) return false;
      if (phase === 'prefill') {
        return slot.n_prompt_tokens >= 1_000 && slot.n_prompt_tokens_processed === 0;
      }
      const tokenState = Array.isArray(slot.next_token) ? slot.next_token[0] : slot.next_token;
      return tokenState?.n_decoded > 0;
    }, 35);

    if (targeted && previousId) {
      await cancel(previousId, 'unknown');
      const slot = await readSlot();
      assert.equal(slot.id_task, active.id_task);
      assert.equal(slot.is_processing, true, 'A late cancellation must keep the new task running');
    }

    const abortAt = new Date().toISOString();
    const started = performance.now();
    let acknowledgedMs;
    if (targeted) {
      // Keep the original socket open to distinguish explicit cancellation from disconnect polling.
      await cancel(inferenceId, 'accepted');
      acknowledgedMs = performance.now() - started;
      const duplicate = await cancel(inferenceId);
      assert.ok(['accepted', 'unknown'].includes(duplicate));
      const terminal = await pending;
      assert.equal(terminal.status, 503);
      assert.equal(terminal.body.error.message, 'inference cancelled');
    } else {
      controller.abort();
      assert.deepEqual(await pending, { error: 'AbortError' });
      // Avoid restarting the one-second socket timer with unrelated slot responses.
      await delay(1_100);
    }

    let lastBusyMs = 0;
    await untilSlot(
      (slot) => {
        if (!slot.is_processing) return true;
        assert.equal(slot.id_task, active.id_task);
        lastBusyMs = performance.now() - started;
        return false;
      },
      targeted ? 15 : 1_100,
    );

    const firstIdleMs = performance.now() - started;
    return {
      inferenceId,
      observation: {
        phase,
        modelTaskId: active.id_task,
        abortAt,
        acknowledgedMs,
        lastBusyMs,
        firstIdleMs,
      },
    };
  } finally {
    controller.abort();
    await pending;
  }
}

if (targeted) await verifyControlAuthorization();
await untilSlot((slot) => !slot.is_processing, 1_100, 15_000);
await complete('topic_label', { ...requests.topic_label, cache_prompt: false });

const jobs = [];
for (let round = 1; round <= rounds; round += 1) {
  for (const [task, body] of Object.entries(requests)) {
    jobs.push({ round, ...(await complete(task, { ...body, cache_prompt: false })) });
  }
}
const prefill = await measureCancellation('prefill');
const generation = await measureCancellation('generation', prefill.inferenceId);
if (targeted) {
  await cancel(generation.inferenceId, 'unknown');
  await complete('topic_label', requests.topic_label);
}

console.log(
  JSON.stringify(
    { targeted, rounds, jobs, aborted: [prefill.observation, generation.observation] },
    null,
    2,
  ),
);
