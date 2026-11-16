import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFakeRuntime } from './fake-runtime.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const token = 'synthetisches-labor-token-nur-fuer-tests';
async function waitFor(condition) {
  const deadline = performance.now() + 2000;
  while (!condition()) {
    assert.ok(performance.now() < deadline, 'Erwarteter Serverzustand nicht erreicht.');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
async function runtime(t, options = {}) {
  const server = createFakeRuntime({ token, ...options });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => server.shutdown());
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    server,
    request: (path, options = {}) =>
      fetch(url + path, { headers: { authorization: `Bearer ${token}` }, ...options }),
  };
}

test('beide API-Pfade verlangen den Bearer, ohne ihn in Antworten zu spiegeln', async (t) => {
  const { request } = await runtime(t);
  for (const path of ['/slots?fail_on_no_slot=1', '/v1/chat/completions']) {
    const r = await request(path, { headers: { authorization: 'Bearer falsch' } });
    assert.equal(r.status, 401);
    assert.doesNotMatch(await r.text(), /falsch|synthetisches/);
  }
});

test('freie Slots und konfigurierter OpenAI-Body werden unverändert geliefert', async (t) => {
  const body = JSON.stringify({ choices: [{ message: { content: '{"test":true}' } }] });
  const { request } = await runtime(t, { completionBody: body });
  assert.equal((await request('/slots?fail_on_no_slot=1')).status, 200);
  const r = await request('/v1/chat/completions', { method: 'POST', body: '{}' });
  assert.equal(r.status, 200);
  assert.equal(await r.text(), body);
  assert.equal((await request('/summary', { method: 'POST' })).status, 404);
});

test('belegter Slot und Race sind deterministische getrennte Fehlerpfade', async (t) => {
  const busy = await runtime(t, { mode: 'busy' });
  assert.equal((await busy.request('/slots?fail_on_no_slot=1')).status, 503);
  const race = await runtime(t, { mode: 'race' });
  assert.equal((await race.request('/slots?fail_on_no_slot=1')).status, 200);
  assert.equal((await race.request('/v1/chat/completions', { method: 'POST' })).status, 503);
});

test('Verzögerung betrifft Completion, nicht Sonde; Client-Abbruch räumt Timer auf', async (t) => {
  const { request } = await runtime(t, { delayMs: 120 });
  assert.equal((await request('/slots?fail_on_no_slot=1')).status, 200);
  const start = performance.now();
  await (await request('/v1/chat/completions', { method: 'POST' })).text();
  assert.ok(performance.now() - start >= 100);
  // Die Antwort darf nicht allein durch ihren normalen Timer verschwinden.
  const delayed = await runtime(t, { delayMs: 600_000 });
  const { server } = delayed;
  const controller = new AbortController();
  t.after(() => controller.abort());
  const aborted = assert.rejects(
    delayed.request('/v1/chat/completions', { method: 'POST', signal: controller.signal }),
    { name: 'AbortError' },
  );
  await waitFor(() => server.pendingResponses() === 1);
  controller.abort();
  await aborted;
  await waitFor(() => server.pendingResponses() === 0);
  assert.equal(server.pendingResponses(), 0);
});

test('Status, ungültiger Body und verspätete Antworten lassen sich gezielt einstellen', async (t) => {
  const { request } = await runtime(t, { completionStatus: 502, completionBody: 'kaputt' });
  const r = await request('/v1/chat/completions', { method: 'POST' });
  assert.equal(r.status, 502);
  assert.equal(await r.text(), 'kaputt');
});

test('ungültige Konfiguration wird vor dem Lauschen abgewiesen', () => {
  for (const options of [
    { token: '' },
    { token, delayMs: -1 },
    { token, mode: 'unbekannt' },
    { token, completionStatus: 99 },
  ]) {
    assert.throws(() => createFakeRuntime(options));
  }
});

test('CLI lehnt Wildcard- und öffentliche Bind-Adressen vor dem Tokenlesen ab', async () => {
  for (const host of ['0.0.0.0', '::', '8.8.8.8', '192.168.150.10']) {
    await assert.rejects(
      promisify(execFile)(process.execPath, [
        new URL('./fake-runtime.mjs', import.meta.url).pathname,
        '--host',
        host,
        '--token-file',
        '/nicht-vorhanden',
      ]),
      (error) => error.code === 1 && /Konfiguration und Bind/.test(error.stderr),
    );
  }
});

test('Shutdown beendet auch noch wartende Antworten', async (t) => {
  const { request, server } = await runtime(t, { delayMs: 600_000 });
  const r = request('/v1/chat/completions', { method: 'POST' }).catch(() => null);
  await waitFor(() => server.pendingResponses() === 1);
  await server.shutdown();
  await r;
  assert.equal(server.pendingResponses(), 0);
});
