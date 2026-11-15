import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { starteVerzoegerungsproxy } from './spacy-delay-proxy.mjs';

function anfragen(socketPath, path, { body, timeoutMs = 10000, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(body);
    const req = request(
      {
        socketPath,
        path,
        method: payload ? 'POST' : 'GET',
        headers: {
          ...(payload
            ? { 'content-type': 'application/json', 'content-length': payload.length }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const teile = [];
        res.on('data', (teil) => teile.push(teil));
        res.once('end', () =>
          resolve({
            status: res.statusCode,
            body: Buffer.concat(teile).toString(),
            headers: res.headers,
          }),
        );
        res.once('error', reject);
      },
    );
    req.once('error', reject);
    req.setTimeout(timeoutMs, () =>
      req.destroy(Object.assign(new Error('Test-Timeout.'), { code: 'TIMEOUT' })),
    );
    req.end(payload);
  });
}

async function umgebung(t, optionen = {}) {
  const root = await mkdtemp(join(tmpdir(), 'arsnova-verzoegerung-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const upstreamSocket = join(root, 'upstream.sock');
  const listenSocket = join(root, 'proxy.sock');
  const aufrufe = [];
  const server = createServer(async (req, res) => {
    const teile = [];
    for await (const teil of req) teile.push(teil);
    aufrufe.push({
      path: req.url,
      body: Buffer.concat(teile).toString(),
      header: req.headers['x-labortest'],
    });
    if (req.url.startsWith('/health')) {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json', 'x-laborantwort': 'erhalten' });
    res.end(
      JSON.stringify({
        locale: 'de',
        modelId: 'de_core_news_sm@3.8.0',
        items: [{ id: 'synthetisch', tokens: [{ text: 'Fragen', lemma: 'Frage', pos: 'NOUN' }] }],
      }),
    );
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(upstreamSocket, resolve);
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const proxy = await starteVerzoegerungsproxy({ listenSocket, upstreamSocket, ...optionen });
  t.after(() => proxy.close());
  return { root, upstreamSocket, listenSocket, aufrufe, proxy };
}

test('verzögert die Weiterleitung von normalize und lässt health währenddessen passieren', async (t) => {
  let freigeben;
  let bereit;
  const wartet = new Promise((resolve) => {
    bereit = resolve;
  });
  const freigabe = new Promise((resolve) => {
    freigeben = resolve;
  });
  const env = await umgebung(t, {
    warte: async (ms) => {
      assert.equal(ms, 6000);
      bereit();
      await freigabe;
    },
  });
  const body = '{"locale":"de","texts":[{"id":"synthetisch","text":"Fragen"}]}';
  const normalisierung = anfragen(env.listenSocket, '/normalize', {
    body,
    headers: { 'x-labortest': 'erhalten' },
  });
  await wartet;
  assert.equal(env.aufrufe.length, 0);
  const health = await anfragen(env.listenSocket, '/health?probe=1');
  assert.equal(health.status, 204);
  assert.deepEqual(
    env.aufrufe.map(({ path }) => path),
    ['/health?probe=1'],
  );
  freigeben();
  const antwort = await normalisierung;
  assert.equal(antwort.status, 200);
  assert.equal(JSON.parse(antwort.body).items[0].tokens[0].lemma, 'Frage');
  assert.equal(antwort.headers['x-laborantwort'], 'erhalten');
  assert.equal(env.aufrufe.at(-1).body, body);
  assert.equal(env.aufrufe.at(-1).header, 'erhalten');
  assert.equal((await stat(env.listenSocket)).mode & 0o777, 0o600);
  assert.doesNotMatch(
    JSON.stringify(env.proxy.snapshot()),
    /Fragen|synthetisch|\.sock|text|locale/,
  );
});

test(
  'überschreitet mit den Vertragswerten 6000/5000 ms das Client-Timeout und leitet abgebrochene Arbeit nicht weiter',
  { timeout: 12000 },
  async (t) => {
    const env = await umgebung(t);
    await assert.rejects(
      anfragen(env.listenSocket, '/normalize', { body: '{}', timeoutMs: 5000 }),
      { code: 'TIMEOUT' },
    );
    // Der Clientabbruch muss den noch laufenden Verzögerungstimer aufräumen.
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(env.aufrufe.length, 0);
    assert.equal(env.proxy.snapshot().cancelledBeforeForward, 1);
  },
);

test('behandelt parallele Anfragen unabhängig und beendet wartende Requests beim Schließen', async (t) => {
  const env = await umgebung(t, { delayMs: 10 });
  const antworten = await Promise.all([
    anfragen(env.listenSocket, '/normalize', { body: '{}' }),
    anfragen(env.listenSocket, '/normalize', { body: '{}' }),
  ]);
  assert.ok(antworten.every(({ status }) => status === 200));
  assert.equal(env.proxy.snapshot().forwarded, 2);
  const wartet = anfragen(env.listenSocket, '/normalize', { body: '{}' });
  const fehler = assert.rejects(wartet);
  await env.proxy.close();
  await fehler;
  await assert.rejects(stat(env.listenSocket), { code: 'ENOENT' });
});

test('überschreibt weder Dateien noch vorhandene Sockets und weist unzulässige Konfiguration zurück', async (t) => {
  const env = await umgebung(t, { delayMs: 0 });
  const datei = join(env.root, 'behalten');
  await writeFile(datei, 'unveraendert');
  for (const optionen of [
    { listenSocket: datei },
    { listenSocket: env.listenSocket },
    { listenSocket: env.upstreamSocket },
    { delayMs: -1 },
    { listenSocket: 'relativ.sock' },
  ]) {
    await assert.rejects(
      starteVerzoegerungsproxy({
        listenSocket: join(env.root, 'neu.sock'),
        upstreamSocket: env.upstreamSocket,
        ...optionen,
      }),
    );
  }
  assert.equal(await readFile(datei, 'utf8'), 'unveraendert');
});

test('begrenzt Requests wie der Sidecar und meldet unerreichbare Upstreams ohne Pfadleck', async (t) => {
  const env = await umgebung(t, { delayMs: 0 });
  assert.equal((await anfragen(env.listenSocket, '/unbekannt')).status, 404);
  assert.equal(
    (await anfragen(env.listenSocket, '/normalize', { body: 'x'.repeat(1048577) })).status,
    413,
  );
  assert.equal(env.aufrufe.length, 0);
  await rm(env.upstreamSocket);
  const antwort = await anfragen(env.listenSocket, '/normalize', { body: '{}' });
  assert.equal(antwort.status, 502);
  assert.doesNotMatch(antwort.body, /\.sock|\/tmp\//);
});

test('validiert offline und startet ohne ausdrückliche Laboroption keinen Proxy', async () => {
  const cli = fileURLToPath(new URL('./spacy-delay-proxy.mjs', import.meta.url));
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync(process.execPath, [cli, '--validate'], { timeout: 15000 });
  assert.equal(JSON.parse(stdout).delayMs, 6000);
  await assert.rejects(
    execFileAsync(process.execPath, [cli, '--run'], { timeout: 15000 }),
    (fehler) => {
      assert.equal(fehler.code, 1);
      assert.equal(fehler.stdout, '');
      return true;
    },
  );
});

test('beendet den gestarteten Laborprozess per SIGTERM und schreibt einen Report ohne Socketpfade', async (t) => {
  const env = await umgebung(t, { delayMs: 0 });
  const cli = fileURLToPath(new URL('./spacy-delay-proxy.mjs', import.meta.url));
  const socket = join(env.root, 'cli.sock');
  const report = join(env.root, 'proxy-report.json');
  const lauf = promisify(execFile)(
    process.execPath,
    [cli, '--run', '--lab', '--listen-socket', socket, '--upstream-socket', env.upstreamSocket],
    { timeout: 15000, env: { ...process.env, REPORT_FILE: report, JUNIT_FILE: '' } },
  );
  lauf.child.stdout.once('data', () => lauf.child.kill('SIGTERM'));
  const { stdout } = await lauf;
  assert.equal(JSON.parse(stdout).status, 'ready');
  assert.equal(JSON.parse(await readFile(report, 'utf8')).metrics.delayMs, 6000);
  assert.doesNotMatch(await readFile(report, 'utf8'), /\.sock|\/tmp\//);
  await assert.rejects(stat(socket), { code: 'ENOENT' });
});
