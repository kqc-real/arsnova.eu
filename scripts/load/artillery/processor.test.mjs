import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const prozessorUrl = new URL('./processor.mjs', import.meta.url).href;

test('friert laufende Aktionen vor einem späten erfolgreichen Abschluss ein', async (t) => {
  const server = createServer(async (anfrage, antwort) => {
    await Array.fromAsync(anfrage);
    await new Promise((fertig) => setTimeout(fertig, 50));
    antwort.setHeader('content-type', 'application/json');
    antwort.end(JSON.stringify({ result: { data: { ok: true } } }));
  });
  await new Promise((fertig) => server.listen(0, '127.0.0.1', fertig));
  t.after(
    () =>
      new Promise((fertig) => {
        server.closeAllConnections();
        server.close(fertig);
      }),
  );
  const umgebung = await pruefumgebung(t, `http://127.0.0.1:${server.address().port}/trpc`);
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    const p = await import(${JSON.stringify(prozessorUrl)});
    const aufgabe = p.submitVote({vars:{participantId:'person',rejoinToken:'synthetisch'}},{emit(){}});
    const vorher = p.snapshotRuntimeState();
    await aufgabe;
    console.log(JSON.stringify({vorher,nachher:p.snapshotRuntimeState()}));
  `,
    ],
    { env: umgebung.env, timeout: 15000 },
  );
  const { vorher, nachher } = JSON.parse(stdout);
  assert.equal(vorher.voteAttempts, 1);
  assert.equal(vorher.votes, 0);
  assert.equal(vorher.voteDurationMs.length, 0);
  assert.equal(nachher.votes, 1);
  assert.equal(vorher.votes, 0, 'Der frühere Snapshot darf nicht nachträglich verändert werden.');
});

async function pruefumgebung(t, trpcUrl) {
  const ordner = await mkdtemp(join(tmpdir(), 'arsnova-artillery-messung-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  const sessionDatei = join(ordner, 'session.json');
  const zustandsDatei = join(ordner, 'zustand.json');
  await writeFile(
    sessionDatei,
    JSON.stringify({
      trpcUrl,
      code: 'LAB123',
      sessionId: 'test-session',
      questionId: 'test-question',
      answerId: 'test-answer',
    }),
  );
  return {
    zustandsDatei,
    env: {
      ...process.env,
      ARTILLERY_SESSION_FILE: sessionDatei,
      ARTILLERY_STATE_FILE: zustandsDatei,
      ARTILLERY_SKIP_VOTES: '0',
    },
  };
}

test('misst den echten Prozessor über lokales tRPC einschließlich Ablehnung und Verbindungsabbruch', async (t) => {
  const aufrufe = [];
  const zaehler = {};
  const server = createServer(async (anfrage, antwort) => {
    const teile = [];
    for await (const teil of anfrage) teile.push(teil);
    const pfad = anfrage.url.split('/').at(-1);
    const nummer = (zaehler[pfad] = (zaehler[pfad] ?? 0) + 1);
    aufrufe.push({
      pfad,
      capability: anfrage.headers['x-participant-capability'],
      eingabe: JSON.parse(Buffer.concat(teile).toString()),
    });
    if (pfad === 'quickFeedback.vote' && nummer === 3) {
      anfrage.socket.destroy();
      return;
    }
    antwort.setHeader('content-type', 'application/json');
    if (nummer === 1) {
      antwort.end(
        JSON.stringify({
          result: {
            data:
              pfad === 'session.join'
                ? {
                    id: 'test-session',
                    participantId: 'test-person',
                    rejoinToken: 'synthetische-capability',
                  }
                : { ok: true },
          },
        }),
      );
      return;
    }
    const fehlercode =
      pfad === 'vote.submit'
        ? 'BAD_REQUEST'
        : pfad === 'quickFeedback.vote'
          ? 'UNAUTHORIZED'
          : 'TOO_MANY_REQUESTS';
    antwort.statusCode = pfad === 'vote.submit' ? 400 : pfad === 'quickFeedback.vote' ? 401 : 429;
    antwort.end(
      JSON.stringify({
        error: {
          code: -32000,
          message:
            pfad === 'vote.submit'
              ? 'Die Frage ist nicht mehr aktiv. vertraulicher-testtext'
              : 'vertraulicher-testtext',
          data: { code: fehlercode, httpStatus: antwort.statusCode },
        },
      }),
    );
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
  const umgebung = await pruefumgebung(t, `http://127.0.0.1:${server.address().port}/trpc`);
  const programm = `
    const prozessor = await import(${JSON.stringify(prozessorUrl)});
    const ereignisse = [];
    const events = { emit: (...werte) => ereignisse.push(werte) };
    const kontext = { vars: {} };
    await prozessor.joinSession(kontext, events);
    kontext.vars.participantIndex = 5;
    await prozessor.submitVote(kontext, events);
    await prozessor.maybeSubmitQa(kontext, events);
    await prozessor.submitBlitzlicht(kontext, events);
    kontext.vars.participantIndex = 1;
    await prozessor.maybeSubmitQa(kontext, events);
    process.env.ARTILLERY_SKIP_VOTES = '1';
    await prozessor.submitVote(kontext, events);
    process.env.ARTILLERY_SKIP_VOTES = '0';
    await prozessor.submitVote(kontext, events);
    kontext.vars.participantIndex = 5;
    for (const aktion of ['joinSession', 'maybeSubmitQa', 'submitBlitzlicht', 'submitBlitzlicht']) {
      try { await prozessor[aktion](kontext, events); } catch { /* Gezielt ausgelöster Fehler. */ }
    }
    process.stdout.write(JSON.stringify(ereignisse));
  `;
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '-e', programm],
    {
      env: umgebung.env,
      timeout: 20_000,
    },
  );
  const zustand = JSON.parse(await readFile(umgebung.zustandsDatei, 'utf8'));
  assert.equal(zustand.joinAttempts, 2);
  assert.equal(zustand.joins, 1);
  assert.equal(zustand.joinErrors, 1);
  assert.equal(zustand.voteAttempts, 2);
  assert.equal(zustand.votes, 1);
  assert.equal(zustand.voteErrors, 1);
  assert.equal(zustand.voteSkippedInactive, 1);
  assert.equal(zustand.voteRejectedInactive, 1);
  assert.equal(zustand.qaSubmitAttempts, 2);
  assert.equal(zustand.qaSubmitErrors, 1);
  assert.equal(zustand.blitzVoteAttempts, 3);
  assert.equal(zustand.blitzVoteErrors, 2);
  assert.equal(zustand.voteDurationMs.length, 1);
  assert.equal(zustand.voteErrorDurationMs.length, 1);
  assert.equal(zustand.qaSubmitErrorCodes.TOO_MANY_REQUESTS, 1);
  assert.equal(zustand.blitzVoteErrorCodes.UNAUTHORIZED, 1);
  assert.equal(zustand.blitzVoteErrorCodes.TRANSPORT_ERROR, 1);
  assert.equal(aufrufe.length, 9);
  assert.ok(
    aufrufe
      .filter(({ pfad }) => pfad !== 'session.join')
      .every(({ capability }) => capability === 'synthetische-capability'),
  );
  assert.ok(
    aufrufe
      .filter(({ pfad }) => pfad === 'qa.submit')
      .every(({ eingabe }) => typeof eingabe.idempotencyKey === 'string'),
  );
  assert.equal(
    JSON.parse(stdout).filter(
      ([art, name]) => art === 'histogram' && name === 'custom.vote_duration_ms',
    ).length,
    1,
  );
  assert.doesNotMatch(
    JSON.stringify(zustand),
    /synthetische-capability|vertraulicher-testtext|test-person/,
  );
});

test('behält bei parallelen Aufrufen alle 2005 ungerundeten Laufzeiten eines Laufs', async (t) => {
  const umgebung = await pruefumgebung(t, 'http://127.0.0.1:1/trpc');
  // Nur für diesen Mengentest wird die bereits separat geprüfte HTTP-Grenze ersetzt.
  const programm = `
    globalThis.fetch = async () => new Response(JSON.stringify({ result: { data: { ok: true } } }), {
      headers: { 'content-type': 'application/json' }
    });
    const prozessor = await import(${JSON.stringify(prozessorUrl)});
    const kontext = { vars: { participantId: 'test-person', sessionId: 'test-session',
      rejoinToken: 'synthetische-capability', participantIndex: 1 } };
    for (let start = 0; start < 2005; start += 50) {
      await Promise.all(Array.from({ length: Math.min(50, 2005 - start) }, () =>
        prozessor.submitVote(kontext, { emit() {} })));
    }
  `;
  await execFileAsync(process.execPath, ['--input-type=module', '-e', programm], {
    env: umgebung.env,
    timeout: 20_000,
  });
  const zustand = JSON.parse(await readFile(umgebung.zustandsDatei, 'utf8'));
  assert.equal(zustand.votes, 2005);
  assert.equal(zustand.voteDurationMs.length, 2005);
  assert.ok(zustand.voteDurationMs.some((dauer) => !Number.isInteger(dauer)));
});
