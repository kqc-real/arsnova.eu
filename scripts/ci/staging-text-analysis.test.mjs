import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkTextAnalysis } from '../../deploy/staging/text-analysis-readiness.mjs';

async function sidecars(t, { encoderLocales, italianLemma = 'andare' } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'n-'));
  const spacySocket = join(directory, 'nlp');
  const encoderSocket = join(directory, 'e5');
  const nlp = createServer(async (req, res) => {
    assert.equal(req.url, '/normalize');
    const body = await readJson(req);
    const token =
      body.locale === 'it' ? { text: 'andavano', lemma: italianLemma } : { lemma: 'go' };
    res.end(
      JSON.stringify({
        locale: body.locale,
        modelId: 'spaCy',
        items: [{ id: body.texts[0].id, tokens: [token] }],
      }),
    );
  });
  const encoder = createServer(async (req, res) => {
    assert.equal(req.url, '/embed');
    const body = await readJson(req);
    if (encoderLocales && !encoderLocales.includes(body.locale)) {
      res.writeHead(400).end();
      return;
    }
    res.end(
      JSON.stringify({ modelId: 'E5', items: [{ id: body.items[0].id, embedding: [0.5, 0.5] }] }),
    );
  });
  t.after(async () => {
    await Promise.all(
      [nlp, encoder].map((server) => new Promise((resolve) => server.close(resolve))),
    );
    await rm(directory, { recursive: true, force: true });
  });
  nlp.listen(spacySocket);
  encoder.listen(encoderSocket);
  await Promise.all([once(nlp, 'listening'), once(encoder, 'listening')]);
  return { spacySocket, encoderSocket };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

test('Staging prüft die Textanalyse über beide Sockets in allen fünf Locales', async (t) => {
  const results = await checkTextAnalysis(await sidecars(t));
  assert.deepEqual(
    results.map(({ locale }) => locale),
    ['de', 'en', 'fr', 'es', 'it'],
  );
  assert.ok(results.every(({ nlp, encoder }) => nlp === 'spaCy' && encoder === 'E5'));
});

test('Staging bricht bei einem auf de/en begrenzten Encoder ab', async (t) => {
  const config = await sidecars(t, { encoderLocales: ['de', 'en'] });
  await assert.rejects(checkTextAnalysis(config), /fr Encoder: HTTP 400/);
});

test('Staging erkennt fehlende italienische Lemmatisierung trotz gültiger HTTP-Antwort', async (t) => {
  const config = await sidecars(t, { italianLemma: 'andavano' });
  await assert.rejects(checkTextAnalysis(config), /it spaCy: Keine gültigen Lemmata/);
});
