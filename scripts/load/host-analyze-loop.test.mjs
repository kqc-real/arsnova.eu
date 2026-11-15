import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildResourceIsolationFixture,
  hashResourceIsolationFixture,
} from './lib/resource-isolation-fixture.mjs';
import { fuehreHostAnalyseAus, pruefeAnalyseZuordnung } from './host-analyze-loop.mjs';

const fixture = buildResourceIsolationFixture();
const sha256 = hashResourceIsolationFixture(fixture);
const execFileAsync = promisify(execFile);
const runner = fileURLToPath(new URL('./host-analyze-loop.mjs', import.meta.url));
const sessions = Array.from({ length: 5 }, (_, index) => ({
  sessionId: randomUUID(),
  sessionCode: `LAB00${index}`,
  hostToken: `vertraulicher-host-token-${index}`,
}));
const konfiguration = (trpcUrl) => ({
  trpcUrl,
  fixtureSeed: fixture.seed,
  fixtureSha256: sha256,
  sessions,
  durationMs: 400,
  intervalMs: 200,
  offsetsMs: [0, 20, 40, 60, 80],
  requestTimeoutMs: 1000,
  drainMs: 100,
});

async function testserver(
  t,
  { antwortAendern, korpusAendern, analyseFehler, korpusVerzoegernMs = 0, beiAnalyse } = {},
) {
  const aufrufe = [];
  const server = createServer(async (anfrage, antwort) => {
    const url = new URL(anfrage.url, 'http://127.0.0.1');
    const teile = [];
    for await (const teil of anfrage) teile.push(teil);
    const eingabe =
      anfrage.method === 'GET'
        ? JSON.parse(url.searchParams.get('input'))
        : JSON.parse(Buffer.concat(teile).toString());
    const token = anfrage.headers['x-host-token'];
    const host = sessions.find(({ hostToken }) => hostToken === token);
    assert.ok(host, 'Host-Autorisierung muss vorhanden sein.');
    const pfad = url.pathname.split('/').at(-1);
    const nummer = aufrufe.filter(
      (aufruf) => aufruf.token === token && aufruf.pfad === pfad,
    ).length;
    aufrufe.push({ pfad, eingabe, token });
    antwort.setHeader('content-type', 'application/json');
    if (pfad === 'qa.list') {
      if (korpusVerzoegernMs)
        await new Promise((resolve) => setTimeout(resolve, korpusVerzoegernMs));
      assert.equal(eingabe.sessionId, host.sessionId);
      assert.equal(eingabe.moderatorView, true);
      assert.deepEqual(eingabe.statuses, ['ACTIVE', 'PINNED']);
      const snapshot = {
        questions: fixture.analysis.questions.map((frage) => ({
          ...frage,
          id: randomUUID(),
          createdAt: '2026-11-07T00:00:00.000Z',
          passagesRedacted: false,
          myVote: null,
          isOwn: false,
          hasUpvoted: false,
        })),
        totalCount: 500,
        nextCursor: null,
        rankingRevision: '7:TOP:',
        state: 'ACTIVE',
        sessionLifecycleRevision: 0,
        serverNow: '2026-11-07T00:00:00.000Z',
        expiresAt: '2026-11-08T00:00:00.000Z',
        qaClosesAt: null,
        endedAt: null,
        postProcessingEndsAt: null,
      };
      korpusAendern?.(snapshot, nummer);
      antwort.end(JSON.stringify({ result: { data: snapshot } }));
      return;
    }
    assert.equal(pfad, 'wordCloud.analyzeQa');
    beiAnalyse?.();
    assert.deepEqual(eingabe, {
      sessionCode: host.sessionCode,
      mode: 'LEXICAL',
      locale: 'de',
      metric: 'TOP',
      normalization: 'LEMMA',
      limit: 500,
      filter: 'ALL_ELIGIBLE',
      refresh: true,
    });
    if (analyseFehler) {
      antwort.statusCode = 403;
      antwort.end(
        JSON.stringify({
          error: {
            code: -32003,
            message: `${token} http://interne-adresse/trpc`,
            data: { code: 'FORBIDDEN', httpStatus: 403 },
          },
        }),
      );
      return;
    }
    const daten = {
      mode: 'LEXICAL',
      effectiveMode: 'LEXICAL',
      locale: 'de',
      metric: 'TOP',
      generatedAt: '2026-11-07T00:00:00.000Z',
      fallbackUsed: false,
      status: 'ready',
      modelVersion: null,
      normalization: 'LEMMA',
      normalizationApplied: nummer === 0 ? 'LEMMA' : 'NONE',
      normalizationFallbackUsed: nummer !== 0,
      normalizationFallbackReason: nummer === 0 ? null : 'NLP_DISABLED',
      fallbackLocale: 'de',
      analysisVersion: 'test-version',
      modelId: null,
      snapshotHash: 'a'.repeat(64),
      entries: [],
      eligibleQuestionCount: 500,
      analyzedQuestionCount: 500,
      corpusRevision: '7:',
      sortMode: 'TOP',
      filter: 'ALL_ELIGIBLE',
    };
    antwortAendern?.(daten, nummer);
    antwort.end(JSON.stringify({ result: { data: daten } }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return { aufrufe, trpcUrl: `http://127.0.0.1:${server.address().port}/trpc` };
}

test('validiert den Standardzeitplan ohne Netzwerk und ohne Zugangsdaten', async () => {
  const { stdout } = await execFileAsync(process.execPath, [runner, '--validate'], {
    env: { ...process.env, TRPC_URL: 'ungueltig', DATABASE_URL: 'ungueltig' },
    timeout: 15000,
  });
  const bericht = JSON.parse(stdout);
  assert.equal(bericht.planned, 150);
  assert.equal(bericht.fixture.sha256, sha256);
  assert.equal(bericht.durationMs, 300000);
  assert.doesNotMatch(stdout, /hostToken|sessionId|sessionCode|ungueltig/);
});

test('weist doppelte Sessions, fehlende Tokens, ungültige URLs und falsche Fixture-Identitäten zurück', () => {
  const gueltig = konfiguration('http://127.0.0.1:3000/trpc');
  assert.doesNotThrow(() => pruefeAnalyseZuordnung(gueltig));
  for (const aenderung of [
    { sessions: sessions.slice(1) },
    { sessions: [...sessions.slice(0, 4), sessions[0]] },
    { sessions: [{ ...sessions[0], hostToken: '' }, ...sessions.slice(1)] },
    { sessions: [{ ...sessions[0], sessionId: 'ungueltig' }, ...sessions.slice(1)] },
    { fixtureSha256: '0'.repeat(64) },
    { fixtureSeed: -1 },
    { trpcUrl: 'file:///tmp/test' },
    { trpcUrl: 'http://name:vertraulicher-host-token@localhost/trpc' },
    { offsetsMs: [0] },
    { durationMs: -1 },
    { drainMs: 60001 },
    { requestTimeoutMs: 0 },
  ])
    assert.throws(
      () => pruefeAnalyseZuordnung({ ...gueltig, ...aenderung }),
      (fehler) => {
        assert.doesNotMatch(fehler.message, /vertraulicher-host-token|file:\/\/|name:/);
        return true;
      },
    );
});

test('erkennt dieselbe Session auch bei unterschiedlicher Großschreibung', () => {
  const config = konfiguration('http://127.0.0.1:3000/trpc');
  assert.throws(() =>
    pruefeAnalyseZuordnung({
      ...config,
      sessions: [
        ...sessions.slice(0, 4),
        { ...sessions[4], sessionCode: sessions[0].sessionCode.toLowerCase() },
      ],
    }),
  );
  assert.throws(() =>
    pruefeAnalyseZuordnung({
      ...config,
      sessions: [
        { ...sessions[0], sessionId: 'abcdefab-cdef-4abc-8def-abcdefabcdef' },
        ...sessions.slice(1, 4),
        { ...sessions[4], sessionId: 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF' },
      ],
    }),
  );
});

test('verwendet das echte tRPC-Protokoll mit Host-Tokens, festem Korpus und getrennten Ergebnisklassen', async (t) => {
  const { aufrufe, trpcUrl } = await testserver(t);
  const bericht = await fuehreHostAnalyseAus(konfiguration(trpcUrl));
  assert.equal(bericht.corpus.verifiedBefore, true);
  assert.equal(bericht.corpus.verifiedAfter, true);
  assert.equal(bericht.corpus.unchanged, true);
  assert.equal(bericht.analysis.planned, 10);
  assert.equal(bericht.analysis.started, 10);
  assert.equal(bericht.analysis.counts.SUCCESS, 5);
  assert.equal(bericht.analysis.counts.FALLBACK, 5);
  assert.equal(bericht.analysis.unavailableRate, 0.5);
  assert.equal(bericht.analysis.calls.at(-1).normalizationFallbackReason, 'NLP_DISABLED');
  assert.equal(aufrufe.filter(({ pfad }) => pfad === 'qa.list').length, 10);
  assert.doesNotMatch(
    JSON.stringify(bericht),
    /vertraulicher-host-token|LAB00|sessionId|127\.0\.0\.1|createdAt/,
  );
});

test('startet bei abweichenden Korpusinhalten keine Analyse und erfindet keine Messwerte', async (t) => {
  const { aufrufe, trpcUrl } = await testserver(t, {
    korpusAendern: (snapshot) => {
      snapshot.questions[0].positiveVoteCount++;
    },
  });
  const bericht = await fuehreHostAnalyseAus(konfiguration(trpcUrl));
  assert.equal(bericht.corpus.verifiedBefore, false);
  assert.equal(bericht.analysis.started, 0);
  assert.equal(bericht.analysis.counts.NOT_STARTED, 10);
  assert.equal(bericht.analysis.latency.p95Ms, null);
  assert.ok(aufrufe.every(({ pfad }) => pfad === 'qa.list'));
});

test('erkennt Korpusänderungen nach dem Messfenster und in Analyseantworten', async (t) => {
  const { trpcUrl } = await testserver(t, {
    korpusAendern: (snapshot, nummer) => {
      if (nummer > 0) snapshot.rankingRevision = '8:TOP:';
    },
    antwortAendern: (daten, nummer) => {
      if (nummer > 0) daten.corpusRevision = '8:';
    },
  });
  const bericht = await fuehreHostAnalyseAus(konfiguration(trpcUrl));
  assert.equal(bericht.corpus.unchanged, false);
  assert.equal(bericht.analysis.counts.CORPUS_MISMATCH, 5);
});

test('weist ungültige Analyseantworten zurück und speichert nur sichere Fehlercodes', async (t) => {
  const ungueltig = await testserver(t, {
    antwortAendern: (daten) => {
      delete daten.normalizationApplied;
    },
  });
  const erster = await fuehreHostAnalyseAus(konfiguration(ungueltig.trpcUrl));
  assert.equal(erster.analysis.counts.INVALID_RESPONSE, 10);
  const verboten = await testserver(t, { analyseFehler: true });
  const zweiter = await fuehreHostAnalyseAus(konfiguration(verboten.trpcUrl));
  assert.equal(zweiter.analysis.counts.REJECTED, 10);
  assert.ok(zweiter.analysis.calls.every(({ errorCode }) => errorCode === 'FORBIDDEN'));
  assert.doesNotMatch(JSON.stringify(zweiter), /vertraulicher-host-token|interne-adresse|LAB00/);
});

test('verwirft auch zwischenzeitliche Korpusabweichungen bei später wiederhergestelltem Bestand', async (t) => {
  const { trpcUrl } = await testserver(t, {
    antwortAendern: (daten, nummer) => {
      if (nummer > 0) daten.snapshotHash = 'b'.repeat(64);
    },
  });
  const bericht = await fuehreHostAnalyseAus(konfiguration(trpcUrl));
  assert.equal(bericht.corpus.verifiedAfter, true);
  assert.equal(bericht.analysis.counts.CORPUS_MISMATCH, 5);
  assert.equal(bericht.corpus.unchanged, false);
});

test('kennzeichnet Zeitüberschreitungen der Korpusprüfung ohne Analyseversuche', async (t) => {
  const { trpcUrl } = await testserver(t, { korpusVerzoegernMs: 50 });
  const bericht = await fuehreHostAnalyseAus({ ...konfiguration(trpcUrl), requestTimeoutMs: 5 });
  assert.equal(bericht.analysis.started, 0);
  assert.ok(bericht.corpus.checks.every(({ errorCode }) => errorCode === 'TIMEOUT'));
});

test('weist ungültige CLI-Aufrufe ohne Ausgabe von Optionen oder Zugangsdaten zurück', async () => {
  for (const args of [
    [],
    ['--run'],
    ['--validate', '--run'],
    ['--validate', '--sessions-file', 'unbekannt'],
    ['--vertraulicher-host-token'],
    ['--run', '--sessions-file'],
  ]) {
    await assert.rejects(
      execFileAsync(process.execPath, [runner, ...args], { timeout: 15000 }),
      (fehler) => {
        assert.equal(fehler.code, 1);
        assert.equal(fehler.stdout, '');
        assert.doesNotMatch(fehler.stderr, /vertraulicher-host-token|unbekannt|stack/i);
        return true;
      },
    );
  }
});

test('schreibt beim CLI-Lauf bereinigte JSON- und JUnit-Artefakte', async (t) => {
  const { trpcUrl } = await testserver(t);
  const ordner = await mkdtemp(join(tmpdir(), 'arsnova-analyse-cli-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  const zuordnung = join(ordner, 'zuordnung.json');
  await writeFile(zuordnung, JSON.stringify(konfiguration(trpcUrl)), { mode: 0o600 });
  const report = join(ordner, 'report.json');
  const junit = join(ordner, 'report.xml');
  const { stdout } = await execFileAsync(
    process.execPath,
    [runner, '--run', '--sessions-file', zuordnung],
    {
      timeout: 15000,
      env: { ...process.env, REPORT_FILE: report, JUNIT_FILE: junit },
    },
  );
  assert.equal(JSON.parse(stdout).analysis.planned, 10);
  const artefakt = await readFile(report, 'utf8');
  assert.equal(JSON.parse(artefakt).metrics.analysis.planned, 10);
  assert.match(await readFile(junit, 'utf8'), /failures="0"/);
  assert.doesNotMatch(artefakt + stdout, /vertraulicher-host-token|LAB00|sessionId|127\.0\.0\.1/);
});

test('speichert bei SIGINT einen unvollständigen Lauf und beendet den CLI-Prozess', async (t) => {
  let lauf;
  let signalGesendet = false;
  const { trpcUrl } = await testserver(t, {
    beiAnalyse: () => {
      if (!signalGesendet) {
        signalGesendet = true;
        lauf.child.kill('SIGINT');
      }
    },
  });
  const ordner = await mkdtemp(join(tmpdir(), 'arsnova-analyse-abbruch-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  const zuordnung = join(ordner, 'zuordnung.json');
  const report = join(ordner, 'report.json');
  await writeFile(zuordnung, JSON.stringify({ ...konfiguration(trpcUrl), durationMs: 10000 }), {
    mode: 0o600,
  });
  lauf = execFileAsync(process.execPath, [runner, '--run', '--sessions-file', zuordnung], {
    timeout: 15000,
    env: { ...process.env, REPORT_FILE: report, JUNIT_FILE: '' },
  });
  await assert.rejects(lauf, (fehler) => {
    assert.equal(fehler.code, 1);
    assert.equal(JSON.parse(fehler.stdout).analysis.interrupted, true);
    assert.doesNotMatch(fehler.stdout + fehler.stderr, /vertraulicher-host-token|LAB00/);
    return true;
  });
  const bericht = JSON.parse(await readFile(report, 'utf8'));
  assert.ok(bericht.assertions.some(({ passed }) => !passed));
  assert.ok(bericht.metrics.analysis.counts.NOT_STARTED > 0);
});
